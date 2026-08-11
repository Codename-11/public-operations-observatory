export interface GitHubRateLimit {
  limit?: number;
  remaining?: number;
  resetAt?: string;
}

export interface GitHubSourceMetadata extends Record<string, unknown> {
  resources: Record<string, GitHubRateLimit>;
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
  private readonly rateLimits = new Map<string, GitHubRateLimit>();

  public constructor(
    private readonly token: string | undefined,
    private readonly fetchImplementation: typeof fetch = fetch,
    private readonly sleep: (milliseconds: number) => Promise<void> = (milliseconds) =>
      new Promise((resolve) => setTimeout(resolve, milliseconds)),
  ) {}

  public get sourceMetadata(): GitHubSourceMetadata {
    return {
      resources: Object.fromEntries(
        [...this.rateLimits.entries()]
          .sort(([left], [right]) => left.localeCompare(right))
          .map(([resource, quota]) => [resource, { ...quota }]),
      ),
    };
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

        const rateLimited =
          response.status === 403 &&
          (response.headers.has('retry-after') ||
            response.headers.get('x-ratelimit-remaining') === '0');
        const retryable = rateLimited || response.status === 429 || response.status >= 500;
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
    const resource = headers.get('x-ratelimit-resource') ?? 'unknown';
    const limit = parseInteger(headers.get('x-ratelimit-limit'));
    const remaining = parseInteger(headers.get('x-ratelimit-remaining'));
    const resetAt = parseReset(headers.get('x-ratelimit-reset'));
    if (limit === undefined && remaining === undefined && resetAt === undefined) return;
    const candidate: GitHubRateLimit = {
      ...(limit === undefined ? {} : { limit }),
      ...(remaining === undefined ? {} : { remaining }),
      ...(resetAt === undefined ? {} : { resetAt }),
    };
    const current = this.rateLimits.get(resource);
    if (!current || isMoreConstrained(candidate, current)) this.rateLimits.set(resource, candidate);
  }
}

function isMoreConstrained(candidate: GitHubRateLimit, current: GitHubRateLimit): boolean {
  const candidateRemaining = candidate.remaining ?? Number.POSITIVE_INFINITY;
  const currentRemaining = current.remaining ?? Number.POSITIVE_INFINITY;
  if (candidateRemaining !== currentRemaining) return candidateRemaining < currentRemaining;
  const candidateReset = candidate.resetAt ?? '';
  const currentReset = current.resetAt ?? '';
  if (candidateReset !== currentReset) return candidateReset > currentReset;
  return (
    (candidate.limit ?? Number.POSITIVE_INFINITY) < (current.limit ?? Number.POSITIVE_INFINITY)
  );
}

function retryDelay(response: Response, attempt: number): number {
  const retryAfter = parseInteger(response.headers.get('retry-after'));
  if (retryAfter !== undefined) return Math.min(retryAfter * 1_000, 5_000);
  const reset = parseInteger(response.headers.get('x-ratelimit-reset'));
  if (reset !== undefined) return Math.min(Math.max(reset * 1_000 - Date.now(), 0), 5_000);
  return 250 * 2 ** attempt;
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
