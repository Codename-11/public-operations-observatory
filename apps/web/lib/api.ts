import 'server-only';

import {
  OverviewReadModelV1Schema,
  type OverviewReadModelV1,
} from '@public-operations-observatory/contracts';

export type OverviewApiFailureKind = 'configuration' | 'network' | 'status' | 'invalid-response';

export type OverviewApiResult =
  | { ok: true; data: OverviewReadModelV1 }
  | { ok: false; kind: OverviewApiFailureKind; message: string };

export type RefreshApiResult =
  { ok: true } | { ok: false; kind: OverviewApiFailureKind; message: string };

interface FetchOverviewOptions {
  fetcher?: typeof fetch;
  baseUrl?: string;
  token?: string;
  view?: 'current' | 'completed';
}

const failure = (kind: OverviewApiFailureKind): OverviewApiResult => ({
  ok: false,
  kind,
  message: 'Overview data is unavailable.',
});

const configuredBaseUrl = (value: string | undefined): URL | undefined => {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    const localHttp =
      url.protocol === 'http:' &&
      (url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '::1');
    if (
      (url.protocol !== 'https:' && !localHttp) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    ) {
      return undefined;
    }
    return url;
  } catch {
    return undefined;
  }
};

export async function fetchOverview(
  projectKey: string,
  options: FetchOverviewOptions = {},
): Promise<OverviewApiResult> {
  const baseUrl = configuredBaseUrl(options.baseUrl ?? process.env.OBSERVATORY_API_BASE_URL);
  const token = options.token ?? process.env.OBSERVATORY_API_TOKEN;
  if (!baseUrl || !token || token.trim() === '' || projectKey !== 'hermes-relay') {
    return failure('configuration');
  }

  const endpoint = new URL(
    `/api/v1/projects/${encodeURIComponent(projectKey)}/overview?period=7d&view=${options.view ?? 'current'}`,
    baseUrl,
  );
  let response: Response;
  try {
    response = await (options.fetcher ?? fetch)(endpoint.toString(), {
      method: 'GET',
      headers: { accept: 'application/json', authorization: `Bearer ${token}` },
      cache: 'no-store',
      redirect: 'error',
    });
  } catch {
    return failure('network');
  }

  if (!response.ok) return failure('status');
  const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';
  if (contentType && !contentType.includes('application/json')) {
    return failure('invalid-response');
  }

  try {
    const value: unknown = await response.json();
    const parsed = OverviewReadModelV1Schema.safeParse(value);
    return parsed.success ? { ok: true, data: parsed.data } : failure('invalid-response');
  } catch {
    return failure('invalid-response');
  }
}

export async function requestOverviewRefresh(
  projectKey: string,
  options: Omit<FetchOverviewOptions, 'view'> = {},
): Promise<RefreshApiResult> {
  const baseUrl = configuredBaseUrl(options.baseUrl ?? process.env.OBSERVATORY_API_BASE_URL);
  const token = options.token ?? process.env.OBSERVATORY_API_TOKEN;
  if (!baseUrl || !token || token.trim() === '' || projectKey !== 'hermes-relay') {
    return failure('configuration');
  }

  const endpoint = new URL(`/api/v1/projects/${encodeURIComponent(projectKey)}/refresh`, baseUrl);
  let response: Response;
  try {
    response = await (options.fetcher ?? fetch)(endpoint.toString(), {
      method: 'POST',
      headers: { accept: 'application/json', authorization: ['Bearer', token].join(' ') },
      cache: 'no-store',
      redirect: 'error',
    });
  } catch {
    return failure('network');
  }
  return response.ok ? { ok: true } : failure('status');
}
