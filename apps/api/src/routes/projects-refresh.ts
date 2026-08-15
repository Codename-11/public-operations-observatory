import type { FastifyInstance } from 'fastify';

import { isAuthorized } from '../auth.js';
import type { ApiConfig } from '../config.js';
import { sendProblem } from '../problem-details.js';

export type RefreshTrigger = () => Promise<void>;

interface RouteDependencies {
  config: ApiConfig;
  triggerRefresh?: RefreshTrigger;
}

export const registerProjectsRefresh = (
  app: FastifyInstance,
  dependencies: RouteDependencies,
): void => {
  let inFlight: Promise<void> | undefined;

  app.post<{ Params: { projectKey: string } }>(
    '/api/v1/projects/:projectKey/refresh',
    async (request, reply) => {
      if (!isAuthorized(request, dependencies.config)) {
        reply.header('www-authenticate', 'Bearer realm="observatory"');
        return sendProblem(reply, 401, 'Authentication is required.');
      }
      const contentLength = request.headers['content-length'];
      if (
        request.headers['transfer-encoding'] !== undefined ||
        (contentLength !== undefined && contentLength !== '0')
      ) {
        return sendProblem(reply, 400, 'Request bodies are not accepted.');
      }
      if (request.params.projectKey !== 'hermes-relay') {
        return sendProblem(reply, 404, 'The requested project is not supported.');
      }
      if (dependencies.triggerRefresh === undefined) {
        return sendProblem(reply, 503, 'Refresh is not configured.');
      }

      const joined = inFlight !== undefined;
      inFlight ??= dependencies.triggerRefresh().finally(() => {
        inFlight = undefined;
      });
      try {
        await inFlight;
        return reply.type('application/json').send({ status: 'completed', joined });
      } catch {
        return sendProblem(reply, 500, 'Refresh could not be completed.');
      }
    },
  );
};
