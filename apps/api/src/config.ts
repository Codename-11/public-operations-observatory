const DEFAULTS = {
  host: '127.0.0.1',
  port: 3_000,
  poolMax: 4,
  connectionTimeoutMs: 2_000,
  idleTimeoutMs: 10_000,
  queryTimeoutMs: 5_000,
  requestTimeoutMs: 10_000,
  concurrencyLimit: 16,
  rateLimitMax: 120,
  rateLimitWindowMs: 60_000,
} as const;

export interface ApiConfig {
  nodeEnv: 'development' | 'test' | 'production';
  host: string;
  port: number;
  databaseUrl: string;
  authToken?: string;
  authBypass: boolean;
  poolMax: number;
  connectionTimeoutMs: number;
  idleTimeoutMs: number;
  queryTimeoutMs: number;
  requestTimeoutMs: number;
  concurrencyLimit: number;
  rateLimitMax: number;
  rateLimitWindowMs: number;
}

const integer = (
  environment: NodeJS.ProcessEnv,
  key: string,
  fallback: number,
  minimum: number,
  maximum: number,
): number => {
  const raw = environment[key];
  if (raw === undefined) return fallback;
  if (!/^\d+$/.test(raw)) throw new Error(`${key} must be an integer`);
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${key} must be between ${minimum} and ${maximum}`);
  }
  return value;
};

const boolean = (environment: NodeJS.ProcessEnv, key: string): boolean => {
  const raw = environment[key];
  if (raw === undefined || raw === 'false') return false;
  if (raw === 'true') return true;
  throw new Error(`${key} must be true or false`);
};

export const loadConfig = (environment: NodeJS.ProcessEnv = process.env): ApiConfig => {
  const rawNodeEnv = environment.NODE_ENV ?? 'development';
  if (!['development', 'test', 'production'].includes(rawNodeEnv)) {
    throw new Error('NODE_ENV must be development, test, or production');
  }
  const nodeEnv = rawNodeEnv as ApiConfig['nodeEnv'];
  const databaseUrl = environment.DATABASE_URL;
  if (databaseUrl === undefined || databaseUrl.length === 0) {
    throw new Error('DATABASE_URL is required');
  }
  const authToken = environment.API_AUTH_TOKEN;
  if (authToken !== undefined && (authToken.length < 20 || authToken.length > 1_024)) {
    throw new Error('API_AUTH_TOKEN must be between 20 and 1024 characters');
  }
  const authBypass = boolean(environment, 'API_AUTH_BYPASS');
  if (nodeEnv === 'production' && authBypass) {
    throw new Error('API_AUTH_BYPASS cannot be enabled in production');
  }
  if (nodeEnv === 'production' && authToken === undefined) {
    throw new Error('API_AUTH_TOKEN is required in production');
  }
  if (!authBypass && authToken === undefined) {
    throw new Error('API_AUTH_TOKEN is required unless non-production bypass is explicit');
  }

  return {
    nodeEnv,
    host: environment.API_HOST ?? DEFAULTS.host,
    port: integer(environment, 'API_PORT', DEFAULTS.port, 1, 65_535),
    databaseUrl,
    ...(authToken === undefined ? {} : { authToken }),
    authBypass,
    poolMax: integer(environment, 'API_DB_POOL_MAX', DEFAULTS.poolMax, 1, 32),
    connectionTimeoutMs: integer(
      environment,
      'API_DB_CONNECTION_TIMEOUT_MS',
      DEFAULTS.connectionTimeoutMs,
      100,
      30_000,
    ),
    idleTimeoutMs: integer(
      environment,
      'API_DB_IDLE_TIMEOUT_MS',
      DEFAULTS.idleTimeoutMs,
      1_000,
      120_000,
    ),
    queryTimeoutMs: integer(
      environment,
      'API_DB_QUERY_TIMEOUT_MS',
      DEFAULTS.queryTimeoutMs,
      100,
      30_000,
    ),
    requestTimeoutMs: integer(
      environment,
      'API_REQUEST_TIMEOUT_MS',
      DEFAULTS.requestTimeoutMs,
      500,
      60_000,
    ),
    concurrencyLimit: integer(
      environment,
      'API_CONCURRENCY_LIMIT',
      DEFAULTS.concurrencyLimit,
      1,
      128,
    ),
    rateLimitMax: integer(environment, 'API_RATE_LIMIT_MAX', DEFAULTS.rateLimitMax, 1, 10_000),
    rateLimitWindowMs: integer(
      environment,
      'API_RATE_LIMIT_WINDOW_MS',
      DEFAULTS.rateLimitWindowMs,
      1_000,
      3_600_000,
    ),
  };
};
