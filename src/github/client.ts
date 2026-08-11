export interface GitHubRateLimit extends Record<string, unknown> {
  limit?: number;
  remaining?: number;
  resetAt?: string;
}

export class GitHubApiError extends Error {
  public constructor(
    message: string,
    public readonly status: number,
    public readonly path: string,
  ) {
    super(message);
    this.name = 'GitHubApiError';
  }
}

export class GitHubClient {
  private rateLimit: GitHubRateLimit = {};

  public constructor(
    private readonly token: string | undefined,
    private readonly fetchImplementation: typeof fetch = fetch,
    private readonly sleep: (milliseconds: number) => Promise<void> = (milliseconds) =>
      new Promise((resolve) => setTimeout(resolve, milliseconds)),
  ) {}

  public get sourceMetadata(): GitHubRateLimit {
    return { ...this.rateLimit };
  }

  public async getJson<T>(path: string, accept = 'application/vnd.github+json'): Promise<T> {
    let lastError: unknown;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const response = await this.fetchImplementation(`https://api.github.com${path}`, {
          headers: {
            Accept: accept,
            'X-GitHub-Api-Version': '2022-11-28',
            'User-Agent': 'public-operations-observatory/0.1',
            ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
          },
          signal: AbortSignal.timeout(15_000),
        });
        this.updateRateLimit(response.headers);
        if (response.ok) return (await response.json()) as T;

        const retryable = response.status === 429 || response.status >= 500;
        if (retryable && attempt < 2) {
          await response.body?.cancel();
          await this.sleep(retryDelay(response, attempt));
          continue;
        }
        const body = (await response.text()).slice(0, 300);
        throw new GitHubApiError(
          `GitHub request failed (${response.status}): ${body}`,
          response.status,
          path,
        );
      } catch (error) {
        lastError = error;
        if (error instanceof GitHubApiError || attempt === 2) throw error;
        await this.sleep(250 * 2 ** attempt);
      }
    }
    throw lastError instanceof Error ? lastError : new Error('GitHub request failed');
  }

  private updateRateLimit(headers: Headers): void {
    const limit = parseInteger(headers.get('x-ratelimit-limit'));
    const remaining = parseInteger(headers.get('x-ratelimit-remaining'));
    const resetAt = parseReset(headers.get('x-ratelimit-reset'));
    this.rateLimit = {
      ...(limit === undefined
        ? this.rateLimit.limit === undefined
          ? {}
          : { limit: this.rateLimit.limit }
        : { limit: Math.max(limit, this.rateLimit.limit ?? 0) }),
      ...(remaining === undefined
        ? this.rateLimit.remaining === undefined
          ? {}
          : { remaining: this.rateLimit.remaining }
        : { remaining: Math.min(remaining, this.rateLimit.remaining ?? remaining) }),
      ...(resetAt === undefined ? {} : { resetAt }),
    };
  }
}

function retryDelay(response: Response, attempt: number): number {
  const retryAfter = parseInteger(response.headers.get('retry-after'));
  return retryAfter === undefined ? 250 * 2 ** attempt : Math.min(retryAfter * 1_000, 5_000);
}

function parseInteger(value: string | null): number | undefined {
  if (value === null) return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseReset(value: string | null): string | undefined {
  const seconds = parseInteger(value);
  return seconds === undefined ? undefined : new Date(seconds * 1000).toISOString();
}
