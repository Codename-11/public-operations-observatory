import { execFile } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';

import { readOverview as readOverviewFromDatabase } from '@public-operations-observatory/read-model';
import Fastify, { type FastifyInstance } from 'fastify';
import pg from 'pg';

import { loadConfig, type ApiConfig } from './config.js';
import { sendProblem } from './problem-details.js';
import { registerProjectsRefresh, type RefreshTrigger } from './routes/projects-refresh.js';
import { registerProjectsOverview, type OverviewReader } from './routes/projects-overview.js';

export type { OverviewReader } from './routes/projects-overview.js';
export type { RefreshTrigger } from './routes/projects-refresh.js';

interface BuildServerOptions {
  config: ApiConfig;
  readOverview?: OverviewReader;
  pool?: pg.Pool;
  triggerRefresh?: RefreshTrigger;
}

const execFileAsync = promisify(execFile);

interface GlobalLimiter {
  active: number;
  windowStartedAt: number;
  requestsInWindow: number;
}

const securityHeaders = {
  'cache-control': 'private, no-store',
  'content-security-policy': "default-src 'none'; frame-ancestors 'none'",
  'referrer-policy': 'no-referrer',
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
} as const;

export const buildServer = (options: BuildServerOptions): FastifyInstance => {
  if (options.config.nodeEnv === 'production' && options.config.authBypass) {
    throw new Error('Authentication bypass cannot run in production');
  }
  if (options.config.nodeEnv === 'production' && options.config.authToken === undefined) {
    throw new Error('Authentication is required in production');
  }

  const app = Fastify({
    logger:
      options.config.nodeEnv === 'production'
        ? {
            redact: ['req.headers.authorization'],
            serializers: { req: (request) => ({ method: request.method }) },
          }
        : false,
    requestTimeout: options.config.requestTimeoutMs,
    exposeHeadRoutes: false,
  });
  const limiter: GlobalLimiter = { active: 0, windowStartedAt: Date.now(), requestsInWindow: 0 };
  const releaseActiveRequest = new WeakMap<object, () => void>();
  let ownedPool: pg.Pool | undefined;
  let reader = options.readOverview;
  if (reader === undefined) {
    ownedPool =
      options.pool ??
      new pg.Pool({
        connectionString: options.config.databaseUrl,
        max: options.config.poolMax,
        connectionTimeoutMillis: options.config.connectionTimeoutMs,
        idleTimeoutMillis: options.config.idleTimeoutMs,
        query_timeout: options.config.queryTimeoutMs,
        statement_timeout: options.config.queryTimeoutMs,
        application_name: 'observatory-overview-api',
      });
    const pool = ownedPool;
    reader = async (request, signal) =>
      readOverviewFromDatabase(pool, request, signal === undefined ? {} : { signal });
  }
  const triggerRefresh =
    options.triggerRefresh ??
    (options.config.refreshEnabled
      ? async () => {
          await execFileAsync(
            '/usr/bin/systemctl',
            ['--user', 'start', 'public-operations-observatory-collect.service'],
            {
              timeout: options.config.refreshTimeoutMs,
              maxBuffer: 64 * 1_024,
              windowsHide: true,
            },
          );
        }
      : undefined);

  app.addHook('onRequest', async (request, reply) => {
    for (const [name, value] of Object.entries(securityHeaders)) reply.header(name, value);

    const now = Date.now();
    if (now - limiter.windowStartedAt >= options.config.rateLimitWindowMs) {
      limiter.windowStartedAt = now;
      limiter.requestsInWindow = 0;
    }
    if (limiter.requestsInWindow >= options.config.rateLimitMax) {
      return sendProblem(reply, 429, 'Too many requests.');
    }
    if (limiter.active >= options.config.concurrencyLimit) {
      return sendProblem(reply, 503, 'The service is busy.');
    }
    limiter.requestsInWindow += 1;
    limiter.active += 1;

    let released = false;
    const release = (): void => {
      if (released) return;
      released = true;
      request.raw.off('aborted', release);
      reply.raw.off('close', release);
      releaseActiveRequest.delete(request);
      limiter.active = Math.max(0, limiter.active - 1);
    };
    releaseActiveRequest.set(request, release);
    request.raw.once('aborted', release);
    reply.raw.once('close', release);
  });

  app.addHook('onError', (request, _reply, _error, done) => {
    releaseActiveRequest.get(request)?.();
    done();
  });

  app.addHook('onResponse', async (request, reply) => {
    releaseActiveRequest.get(request)?.();
    if (options.config.nodeEnv === 'production') {
      request.log.info(
        { method: request.method, route: request.routeOptions.url, statusCode: reply.statusCode },
        'request completed',
      );
    }
  });

  app.get('/health', async (_request, reply) => reply.send({ ok: true }));
  registerProjectsOverview(app, { config: options.config, readOverview: reader });
  registerProjectsRefresh(app, {
    config: options.config,
    ...(triggerRefresh === undefined ? {} : { triggerRefresh }),
  });

  app.setNotFoundHandler((_request, reply) =>
    sendProblem(reply, 404, 'The requested resource was not found.'),
  );
  app.setErrorHandler((error, request, reply) => {
    if (reply.sent) return;
    const status =
      typeof error === 'object' &&
      error !== null &&
      'statusCode' in error &&
      error.statusCode === 400
        ? 400
        : 500;
    request.log.error({ statusCode: status, category: 'request_failure' }, 'request failed');
    void sendProblem(
      reply,
      status,
      status === 400 ? 'The request is invalid.' : 'The request could not be completed.',
    );
  });

  if (ownedPool !== undefined && options.pool === undefined) {
    app.addHook('onClose', async () => ownedPool?.end());
  }
  return app;
};

const main = async (): Promise<void> => {
  const config = loadConfig();
  const app = buildServer({ config });
  await app.listen({ host: config.host, port: config.port });
};

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(() => {
    process.exitCode = 1;
  });
}
