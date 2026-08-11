import { dayBucket, type JsonValue, type ObservationInput } from '../domain/observation.js';
import type { CollectionRun, ObservationStore } from '../db/observation-store.js';
import type { GitHubClient } from './client.js';

type CollectionStore = Pick<ObservationStore, 'beginRun' | 'finishRun' | 'persistBatch'>;
type GitHubReader = Pick<GitHubClient, 'getJson' | 'sourceMetadata'>;

interface RepositoryResponse {
  stargazers_count: number;
  forks_count: number;
  open_issues_count: number;
  html_url: string;
  pushed_at: string | null;
  private: boolean;
  visibility: string;
}

interface TrafficPoint {
  timestamp: string;
  count: number;
  uniques: number;
}

interface TrafficResponse {
  count: number;
  uniques: number;
  views?: TrafficPoint[];
  clones?: TrafficPoint[];
}

interface SearchResponse {
  total_count: number;
}

interface WorkflowRunsResponse {
  total_count: number;
  workflow_runs: Array<{ status: string | null; conclusion: string | null; created_at: string }>;
}

interface ReleaseResponse {
  id: number;
  tag_name: string;
  html_url: string;
  published_at: string | null;
  prerelease: boolean;
  draft: boolean;
  assets: Array<{ id: number; download_count: number }>;
}

interface StargazerResponse {
  starred_at: string;
}

export interface GitHubCollectionResult {
  inserted: number;
  observations: number;
  errors: string[];
}

interface SectionResult {
  observations: ObservationInput[];
  error?: string;
}

const source = 'github';
const schemaVersion = 1;

export async function collectGitHub(
  client: GitHubReader,
  store: CollectionStore,
  owner: string,
  repository: string,
  now: Date = new Date(),
): Promise<GitHubCollectionResult> {
  const scope = `${owner}/${repository}`;
  const run = await store.beginRun(source, scope);
  const repositorySection = await capture('repository', () =>
    collectRepository(client, owner, repository, now),
  );
  if (repositorySection.error) {
    await finishFailedRun(store, run, client, new Error(repositorySection.error));
    throw new Error(repositorySection.error);
  }
  const sections = [
    repositorySection,
    ...(await Promise.all([
      capture('traffic-views', () => collectTraffic(client, owner, repository, now, 'views')),
      capture('traffic-clones', () => collectTraffic(client, owner, repository, now, 'clones')),
      capture('issues', () => collectIssueAndPullCounts(client, owner, repository, now)),
      capture('workflows', () => collectWorkflows(client, owner, repository, now)),
      capture('releases', () => collectReleases(client, owner, repository, now)),
      capture('stargazers', () => collectStargazers(client, owner, repository)),
    ])),
  ];

  const observations = sections.flatMap((section) => section.observations);
  const errors = sections.flatMap((section) => (section.error ? [section.error] : []));

  try {
    const inserted = await store.persistBatch(
      run,
      observations,
      {
        key: 'daily-collection',
        observedAt: now,
        cursor: {
          observedAt: now.toISOString(),
          successfulSections: sections.length - errors.length,
          failedSections: errors.length,
        },
      },
      {
        status: errors.length === 0 ? 'succeeded' : 'partial',
        sourceMetadata: client.sourceMetadata,
        ...(errors.length > 0 ? { errorSummary: errors.join('; ').slice(0, 1_000) } : {}),
      },
    );
    return { inserted, observations: observations.length, errors };
  } catch (error) {
    await finishFailedRun(store, run, client, error);
    throw error;
  }
}

async function finishFailedRun(
  store: CollectionStore,
  run: CollectionRun,
  client: GitHubReader,
  error: unknown,
): Promise<void> {
  await store.finishRun(
    run.id,
    'failed',
    client.sourceMetadata,
    error instanceof Error ? error.message.slice(0, 1_000) : 'Unknown persistence failure',
  );
}

async function capture(
  name: string,
  action: () => Promise<ObservationInput[]>,
): Promise<SectionResult> {
  try {
    return { observations: await action() };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { observations: [], error: `${name}: ${message}` };
  }
}

async function collectRepository(
  client: GitHubReader,
  owner: string,
  repository: string,
  now: Date,
): Promise<ObservationInput[]> {
  const data = await client.getJson<RepositoryResponse>(`/repos/${owner}/${repository}`);
  if (data.private || data.visibility !== 'public') {
    throw new Error('Private repositories are outside the Observatory privacy contract');
  }
  return [
    observation(
      owner,
      repository,
      'repository.summary',
      'repository',
      dayBucket(now),
      {
        stars: data.stargazers_count,
        forks: data.forks_count,
        openItemsReportedByGitHub: data.open_issues_count,
        pushedAt: data.pushed_at,
      },
      data.html_url,
    ),
  ];
}

async function collectTraffic(
  client: GitHubReader,
  owner: string,
  repository: string,
  now: Date,
  kind: 'clones' | 'views',
): Promise<ObservationInput[]> {
  const data = await client.getJson<TrafficResponse>(
    `/repos/${owner}/${repository}/traffic/${kind}?per=day`,
  );
  const points = kind === 'views' ? data.views : data.clones;
  const evidenceUrl = `https://github.com/${owner}/${repository}/graphs/traffic`;
  const observations = (points ?? []).map((point) =>
    observation(
      owner,
      repository,
      `traffic.${kind}`,
      point.timestamp,
      dayBucket(new Date(point.timestamp)),
      {
        count: point.count,
        uniques: point.uniques,
      },
      evidenceUrl,
    ),
  );
  observations.push(
    observation(
      owner,
      repository,
      `traffic.${kind}.window`,
      'window',
      dayBucket(now),
      {
        count: data.count,
        uniques: data.uniques,
      },
      evidenceUrl,
    ),
  );
  return observations;
}

async function collectIssueAndPullCounts(
  client: GitHubReader,
  owner: string,
  repository: string,
  now: Date,
): Promise<ObservationInput[]> {
  const repoQuery = encodeURIComponent(`repo:${owner}/${repository}`);
  const [openIssues, closedIssues, openPulls, closedPulls] = await Promise.all([
    client.getJson<SearchResponse>(`/search/issues?q=${repoQuery}+is:issue+is:open&per_page=1`),
    client.getJson<SearchResponse>(`/search/issues?q=${repoQuery}+is:issue+is:closed&per_page=1`),
    client.getJson<SearchResponse>(`/search/issues?q=${repoQuery}+is:pr+is:open&per_page=1`),
    client.getJson<SearchResponse>(`/search/issues?q=${repoQuery}+is:pr+is:closed&per_page=1`),
  ]);
  const bucket = dayBucket(now);
  return [
    observation(
      owner,
      repository,
      'issues.summary',
      'issues',
      bucket,
      {
        open: openIssues.total_count,
        closed: closedIssues.total_count,
      },
      `https://github.com/${owner}/${repository}/issues`,
    ),
    observation(
      owner,
      repository,
      'pulls.summary',
      'pulls',
      bucket,
      {
        open: openPulls.total_count,
        closed: closedPulls.total_count,
      },
      `https://github.com/${owner}/${repository}/pulls`,
    ),
  ];
}

async function collectWorkflows(
  client: GitHubReader,
  owner: string,
  repository: string,
  now: Date,
): Promise<ObservationInput[]> {
  const data = await client.getJson<WorkflowRunsResponse>(
    `/repos/${owner}/${repository}/actions/runs?per_page=100`,
  );
  const conclusions: Record<string, number> = {};
  for (const run of data.workflow_runs) {
    const key = run.conclusion ?? run.status ?? 'unknown';
    conclusions[key] = (conclusions[key] ?? 0) + 1;
  }
  return [
    observation(
      owner,
      repository,
      'workflows.summary',
      'workflow-runs',
      dayBucket(now),
      {
        totalRuns: data.total_count,
        recentSampleSize: data.workflow_runs.length,
        recentConclusions: conclusions,
      },
      `https://github.com/${owner}/${repository}/actions`,
    ),
  ];
}

async function collectReleases(
  client: GitHubReader,
  owner: string,
  repository: string,
  now: Date,
): Promise<ObservationInput[]> {
  const releases = await client.getJson<ReleaseResponse[]>(
    `/repos/${owner}/${repository}/releases?per_page=100`,
  );
  return releases
    .filter((release) => !release.draft)
    .map((release) =>
      observation(
        owner,
        repository,
        'release.summary',
        String(release.id),
        dayBucket(now),
        {
          tag: release.tag_name,
          publishedAt: release.published_at,
          prerelease: release.prerelease,
          totalAssetDownloads: release.assets.reduce(
            (total, asset) => total + asset.download_count,
            0,
          ),
          assets: release.assets.map((asset) => ({
            id: asset.id,
            downloads: asset.download_count,
          })),
        },
        release.html_url,
      ),
    );
}

async function collectStargazers(
  client: GitHubReader,
  owner: string,
  repository: string,
): Promise<ObservationInput[]> {
  const daily = new Map<string, number>();
  for (let page = 1; page <= 100; page += 1) {
    const stargazers = await client.getJson<StargazerResponse[]>(
      `/repos/${owner}/${repository}/stargazers?per_page=100&page=${page}`,
      'application/vnd.github.star+json',
    );
    for (const star of stargazers) {
      const bucket = dayBucket(new Date(star.starred_at)).toISOString();
      daily.set(bucket, (daily.get(bucket) ?? 0) + 1);
    }
    if (stargazers.length < 100) break;
    if (page === 100) {
      throw new Error('Stargazer history exceeds the explicit 10,000-entry collection bound');
    }
  }
  const evidenceUrl = `https://github.com/${owner}/${repository}/stargazers`;
  return [...daily.entries()].map(([bucket, count]) =>
    observation(owner, repository, 'stars.daily', bucket, new Date(bucket), { count }, evidenceUrl),
  );
}

function observation(
  owner: string,
  repository: string,
  recordKind: string,
  externalId: string,
  observedBucket: Date,
  payload: JsonValue,
  evidenceUrl: string,
): ObservationInput {
  return {
    source,
    scope: `${owner}/${repository}`,
    recordKind,
    externalId,
    observedBucket,
    schemaVersion,
    payload,
    evidenceUrl,
  };
}
