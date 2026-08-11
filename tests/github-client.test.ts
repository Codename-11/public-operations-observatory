import { describe, expect, it, vi } from 'vitest';

import { GitHubClient, type GitHubApiError } from '../src/github/client.js';

describe('GitHubClient', () => {
  it('sends required headers and captures rate-limit metadata', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ stargazers_count: 42 }), {
        status: 200,
        headers: {
          'content-type': 'application/json',
          'x-ratelimit-limit': '5000',
          'x-ratelimit-remaining': '4999',
          'x-ratelimit-reset': '1786500000',
          'x-ratelimit-resource': 'core',
        },
      }),
    );
    const client = new GitHubClient('secret-token', fetchMock);

    await expect(client.getJson('/repos/acme/project')).resolves.toEqual({
      stargazers_count: 42,
    });
    const request = fetchMock.mock.calls[0];
    expect(request?.[0]).toBe('https://api.github.com/repos/acme/project');
    expect(request?.[1]?.headers).toMatchObject({
      Authorization: 'Bearer secret-token',
      'X-GitHub-Api-Version': '2022-11-28',
    });
    expect(request?.[1]?.signal).toBeInstanceOf(AbortSignal);
    expect(client.sourceMetadata).toMatchObject({
      resources: { core: { limit: 5000, remaining: 4999 } },
    });
  });

  it('returns a bounded error without leaking authorization', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response('forbidden', { status: 403 }));
    const client = new GitHubClient('secret-token', fetchMock);

    await expect(client.getJson('/forbidden')).rejects.toEqual(
      expect.objectContaining<Partial<GitHubApiError>>({
        name: 'GitHubApiError',
        status: 403,
        path: '/forbidden',
      }),
    );
  });

  it('retries transient responses and preserves the lowest observed remaining quota', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response('temporary', {
          status: 503,
          headers: { 'x-ratelimit-remaining': '100' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'content-type': 'application/json', 'x-ratelimit-remaining': '4999' },
        }),
      );
    const sleep = vi.fn<(milliseconds: number) => Promise<void>>().mockResolvedValue();
    const client = new GitHubClient(undefined, fetchMock, sleep);

    await expect(client.getJson('/transient')).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(250);
    expect(client.sourceMetadata.resources.unknown?.remaining).toBe(100);
  });

  it('retries GitHub 403 rate-limit responses', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response('rate limited', {
          status: 403,
          headers: { 'retry-after': '0', 'x-ratelimit-remaining': '0' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      );
    const sleep = vi.fn<(milliseconds: number) => Promise<void>>().mockResolvedValue();
    const client = new GitHubClient(undefined, fetchMock, sleep);

    await expect(client.getJson('/rate-limited')).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(0);
  });

  it('keeps deterministic quota snapshots per GitHub resource', async () => {
    const response = (resource: string, remaining: number, reset: number) =>
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: {
          'content-type': 'application/json',
          'x-ratelimit-resource': resource,
          'x-ratelimit-limit': resource === 'search' ? '30' : '5000',
          'x-ratelimit-remaining': String(remaining),
          'x-ratelimit-reset': String(reset),
        },
      });
    const first = new GitHubClient(
      undefined,
      vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(response('core', 100, 1_786_500_000))
        .mockResolvedValueOnce(response('search', 20, 1_786_500_100))
        .mockResolvedValueOnce(response('core', 100, 1_786_500_200)),
    );
    const second = new GitHubClient(
      undefined,
      vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(response('core', 100, 1_786_500_200))
        .mockResolvedValueOnce(response('search', 20, 1_786_500_100))
        .mockResolvedValueOnce(response('core', 100, 1_786_500_000)),
    );
    for (const client of [first, second]) {
      await Promise.all([client.getJson('/one'), client.getJson('/two'), client.getJson('/three')]);
    }
    expect(first.sourceMetadata).toEqual(second.sourceMetadata);
    expect(Object.keys(first.sourceMetadata.resources)).toEqual(['core', 'search']);
  });
});
