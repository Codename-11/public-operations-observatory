import {
  HistoricalContextReadModelV1Schema,
  HistoricalContextRequestSchema,
  type HistoricalContextReadModelV1,
  type HistoricalContextRequest,
} from '@public-operations-observatory/contracts';
import type { FastifyInstance, FastifyRequest } from 'fastify';

import { isAuthorized } from '../auth.js';
import type { ApiConfig } from '../config.js';
import { sendProblem } from '../problem-details.js';

export type HistoryReader = (
  request: HistoricalContextRequest,
  signal?: AbortSignal,
) => Promise<unknown>;

class RouteDeadlineError extends Error {}
class RequestAbortedError extends Error {}

interface RouteDependencies {
  config: ApiConfig;
  readHistory: HistoryReader;
}

export const registerProjectsHistory = (
  app: FastifyInstance,
  dependencies: RouteDependencies,
): void => {
  app.get<{ Params: { projectKey: string } }>(
    '/api/v1/projects/:projectKey/history',
    async (request, reply) => {
      if (!isAuthorized(request, dependencies.config)) {
        reply.header('www-authenticate', 'Bearer realm="observatory"');
        return sendProblem(reply, 401, 'Authentication is required.');
      }
      if (
        request.headers['content-length'] !== undefined ||
        request.headers['transfer-encoding'] !== undefined
      ) {
        return sendProblem(reply, 400, 'Request bodies are not accepted.');
      }
      if (request.params.projectKey !== 'hermes-relay') {
        return sendProblem(reply, 404, 'The requested project is not supported.');
      }
      const query = parseQuery(request);
      if (query === undefined) return sendProblem(reply, 400, 'The query parameters are invalid.');
      const parsed = HistoricalContextRequestSchema.safeParse({
        projectKey: request.params.projectKey,
        period: query.period,
        ...(query.asOf === undefined ? {} : { asOf: query.asOf }),
      });
      if (!parsed.success) return sendProblem(reply, 400, 'The query parameters are invalid.');

      try {
        const value = await readWithDeadline(
          request,
          dependencies.config.requestTimeoutMs,
          (signal) => dependencies.readHistory(parsed.data, signal),
        );
        const response = HistoricalContextReadModelV1Schema.safeParse(value);
        if (!response.success) throw new Error('Invalid historical context response');
        if (request.raw.aborted || reply.sent) return reply;
        return reply
          .type('application/json')
          .send(response.data satisfies HistoricalContextReadModelV1);
      } catch (error) {
        if (error instanceof RequestAbortedError) return reply;
        if (error instanceof RouteDeadlineError) {
          if (reply.sent || request.raw.aborted) return reply;
          return sendProblem(reply, 504, 'The request timed out.');
        }
        throw error;
      }
    },
  );
};

function parseQuery(request: FastifyRequest): Record<string, string> | undefined {
  const rawUrl = request.raw.url ?? '';
  const question = rawUrl.indexOf('?');
  const rawQuery = question === -1 ? '' : rawUrl.slice(question + 1);
  if (/%(?![0-9a-fA-F]{2})/.test(rawQuery)) return undefined;
  const query = new URLSearchParams(rawQuery);
  const allowed = new Set(['period', 'asOf']);
  const parsed: Record<string, string> = {};
  for (const key of query.keys()) {
    if (!allowed.has(key) || query.getAll(key).length !== 1) return undefined;
    parsed[key] = query.get(key) ?? '';
  }
  return parsed;
}

async function readWithDeadline(
  request: FastifyRequest,
  timeoutMs: number,
  read: (signal: AbortSignal) => Promise<unknown>,
): Promise<unknown> {
  const controller = new AbortController();
  let timer: NodeJS.Timeout | undefined;
  let rejectAborted: ((error: RequestAbortedError) => void) | undefined;
  const aborted = new Promise<never>((_resolve, reject) => {
    rejectAborted = reject;
  });
  const onAborted = (): void => {
    controller.abort();
    rejectAborted?.(new RequestAbortedError('Request aborted'));
  };
  request.raw.once('aborted', onAborted);
  const deadline = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new RouteDeadlineError('Route deadline exceeded'));
    }, timeoutMs);
    timer.unref();
  });
  try {
    return await Promise.race([
      Promise.resolve().then(() => read(controller.signal)),
      deadline,
      aborted,
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
    request.raw.off('aborted', onAborted);
  }
}
