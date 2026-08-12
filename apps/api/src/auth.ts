import { createHash, timingSafeEqual } from 'node:crypto';

import type { FastifyRequest } from 'fastify';

import type { ApiConfig } from './config.js';

const digest = (value: string): Buffer => createHash('sha256').update(value, 'utf8').digest();

export const isAuthorized = (request: FastifyRequest, config: ApiConfig): boolean => {
  if (config.authBypass && config.nodeEnv !== 'production') return true;
  if (config.authToken === undefined) return false;

  const header = request.headers.authorization;
  if (header === undefined || !header.startsWith('Bearer ')) return false;
  const candidate = header.slice('Bearer '.length);
  if (candidate.length === 0 || candidate.includes(',') || candidate.trim() !== candidate)
    return false;

  return timingSafeEqual(digest(candidate), digest(config.authToken));
};
