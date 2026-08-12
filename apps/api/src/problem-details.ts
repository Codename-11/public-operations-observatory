import type { FastifyReply } from 'fastify';

export interface ProblemDetails {
  type: 'about:blank';
  title: string;
  status: number;
  detail: string;
}

const titles: Record<number, string> = {
  400: 'Bad Request',
  401: 'Unauthorized',
  404: 'Not Found',
  405: 'Method Not Allowed',
  429: 'Too Many Requests',
  500: 'Internal Server Error',
  503: 'Service Unavailable',
  504: 'Gateway Timeout',
};

export const sendProblem = (reply: FastifyReply, status: number, detail: string): FastifyReply =>
  reply
    .code(status)
    .type('application/problem+json')
    .send({
      type: 'about:blank',
      title: titles[status] ?? 'Error',
      status,
      detail,
    } satisfies ProblemDetails);
