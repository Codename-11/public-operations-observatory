import { dayBucket, type JsonValue, type ObservationInput } from '../domain/observation.js';
import type { CollectionRun, ObservationStore } from '../db/observation-store.js';
import type { GitHubClient } from './client.js';

type BackfillStore = Pick<
  ObservationStore,
  'beginRun' | 'finishRun' | 'persistBatch' | 'withCollectionLock'
>;
type GitHubReader = Pick<GitHubClient, 'getJson' | 'sourceMetadata'>;

interface RepositoryResponse {
  html_url: string;
  private: boolean;
  visibility: string;
}

interface StargazerResponse {
  starred_at: string;
}

interface IssueResponse {
  number: number;
  created_at: string;
  pull_request?: unknown;
}

interface IssueEventResponse {
  id: number;
  event: string;
  created_at: string;
  issue: { number: number; pull_request?: unknown };
}

export interface GitHubHistoryBackfillOptions {
  since: Date;
  throughExclusive: Date;
  generatedAt?: Date;
}

export interface GitHubHistoryBackfillResult {
  inserted: number;
  observations: number;
  starPoints: number;
  issuePoints: number;
  limitations: string[];
}

const source = 'github';
const schemaVersion = 1;
const dayMs = 24 * 60 * 60 * 1_000;

export async function backfillGitHubHistory(
  client: GitHubReader,
  store: BackfillStore,
  owner: string,
  repository: string,
  options: GitHubHistoryBackfillOptions,
): Promise<GitHubHistoryBackfillResult> {
  const scope = `${owner}/${repository}`;
  const since = dayBucket(options.since);
  const throughExclusive = dayBucket(options.throughExclusive);
  const generatedAt = options.generatedAt ?? new Date();
  if (since >= throughExclusive)
    throw new Error('History backfill requires since before throughExclusive');

  return store.withCollectionLock(source, scope, async () => {
    const run = await store.beginRun(source, scope, 'history_backfill');
    try {
      const repositoryData = await client.getJson<RepositoryResponse>(
        `/repos/${owner}/${repository}`,
      );
      if (repositoryData.private || repositoryData.visibility !== 'public') {
        throw new Error('Private repositories are outside the Observatory privacy contract');
      }

      const [stargazers, issues, events] = await Promise.all([
        paginate<StargazerResponse>(
          client,
          `/repos/${owner}/${repository}/stargazers`,
          'application/vnd.github.star+json',
        ),
        paginate<IssueResponse>(client, `/repos/${owner}/${repository}/issues?state=all`),
        paginate<IssueEventResponse>(client, `/repos/${owner}/${repository}/issues/events`),
      ]);

      const starObservations = buildStarObservations(
        owner,
        repository,
        stargazers,
        since,
        throughExclusive,
      );
      const issueObservations = buildIssueObservations(
        owner,
        repository,
        issues.filter((issue) => issue.pull_request === undefined),
        events.filter((event) => event.issue.pull_request === undefined),
        since,
        throughExclusive,
      );
      const observations = [...starObservations, ...issueObservations];
      const limitations = [
        'Star history is a lower-bound reconstruction from users who currently star the repository; later unstars are absent.',
        'Issue history is reconstructed from issue creation and close/reopen events.',
        'GitHub traffic history before the API retention window cannot be recovered from these sources.',
        'Historical release download timing cannot be reconstructed from current cumulative asset counters.',
      ];
      const inserted = await store.persistBatch(
        run,
        observations,
        {
          key: 'historical-backfill-v1',
          observedAt: generatedAt,
          cursor: {
            generatedAt: generatedAt.toISOString(),
            since: since.toISOString(),
            throughExclusive: throughExclusive.toISOString(),
            starPoints: starObservations.length,
            issuePoints: issueObservations.length,
          },
        },
        {
          status: 'succeeded',
          sourceMetadata: {
            ...client.sourceMetadata,
            backfill: {
              version: 1,
              since: since.toISOString(),
              throughExclusive: throughExclusive.toISOString(),
              limitations,
            },
          },
        },
      );
      return {
        inserted,
        observations: observations.length,
        starPoints: starObservations.length,
        issuePoints: issueObservations.length,
        limitations,
      };
    } catch (error) {
      await finishFailedRun(store, run, client, error);
      throw error;
    }
  });
}

async function paginate<T>(client: GitHubReader, basePath: string, accept?: string): Promise<T[]> {
  const output: T[] = [];
  for (let page = 1; page <= 100; page += 1) {
    const separator = basePath.includes('?') ? '&' : '?';
    const rows = await client.getJson<T[]>(
      `${basePath}${separator}per_page=100&page=${page}`,
      accept,
    );
    output.push(...rows);
    if (rows.length < 100) return output;
  }
  throw new Error('GitHub history pagination exceeded 100 pages');
}

function buildStarObservations(
  owner: string,
  repository: string,
  stargazers: StargazerResponse[],
  since: Date,
  throughExclusive: Date,
): ObservationInput[] {
  const starredAt = stargazers
    .map((stargazer) => parseTimestamp(stargazer.starred_at, 'stargazer timestamp'))
    .sort((left, right) => left.getTime() - right.getTime());
  const observations: ObservationInput[] = [];
  let cohortCount = starredAt.filter((timestamp) => timestamp < since).length;
  let index = cohortCount;
  for (let bucket = new Date(since); bucket < throughExclusive; bucket = addDay(bucket)) {
    const next = addDay(bucket);
    while (index < starredAt.length) {
      const timestamp = starredAt[index];
      if (!timestamp || timestamp >= next) break;
      cohortCount += 1;
      index += 1;
    }
    observations.push(
      observation(
        owner,
        repository,
        'repository.summary',
        'repository-history',
        bucket,
        {
          stars: cohortCount,
          derivation: {
            method: 'current-stargazer-cohort',
            lowerBound: true,
          },
        },
        `https://github.com/${owner}/${repository}/stargazers`,
      ),
    );
  }
  return observations;
}

function buildIssueObservations(
  owner: string,
  repository: string,
  issues: IssueResponse[],
  events: IssueEventResponse[],
  since: Date,
  throughExclusive: Date,
): ObservationInput[] {
  const transitions = new Map<number, Array<{ id: number; at: Date; open: boolean }>>();
  for (const event of events) {
    if (event.event !== 'closed' && event.event !== 'reopened') continue;
    const existing = transitions.get(event.issue.number) ?? [];
    existing.push({
      id: event.id,
      at: parseTimestamp(event.created_at, 'issue event timestamp'),
      open: event.event === 'reopened',
    });
    transitions.set(event.issue.number, existing);
  }
  for (const issueTransitions of transitions.values()) {
    issueTransitions.sort(
      (left, right) => left.at.getTime() - right.at.getTime() || left.id - right.id,
    );
  }
  const issueStates = issues.map((issue) => ({
    number: issue.number,
    createdAt: parseTimestamp(issue.created_at, 'issue creation timestamp'),
    transitions: transitions.get(issue.number) ?? [],
  }));
  const observations: ObservationInput[] = [];
  for (let bucket = new Date(since); bucket < throughExclusive; bucket = addDay(bucket)) {
    const next = addDay(bucket);
    let open = 0;
    let created = 0;
    for (const issue of issueStates) {
      if (issue.createdAt >= next) continue;
      created += 1;
      let isOpen = true;
      for (const transition of issue.transitions) {
        if (transition.at >= next) break;
        isOpen = transition.open;
      }
      if (isOpen) open += 1;
    }
    observations.push(
      observation(
        owner,
        repository,
        'issues.summary',
        'issues-history',
        bucket,
        {
          open,
          closed: created - open,
          derivation: {
            method: 'issue-state-events',
            reconstructed: true,
          },
        },
        `https://github.com/${owner}/${repository}/issues?q=is%3Aissue`,
      ),
    );
  }
  return observations;
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

function parseTimestamp(value: string, label: string): Date {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new Error(`Invalid ${label}`);
  return parsed;
}

function addDay(date: Date): Date {
  return new Date(date.getTime() + dayMs);
}

async function finishFailedRun(
  store: BackfillStore,
  run: CollectionRun,
  client: GitHubReader,
  error: unknown,
): Promise<void> {
  await store.finishRun(
    run.id,
    'failed',
    client.sourceMetadata,
    error instanceof Error ? error.message.slice(0, 1_000) : 'Unknown history backfill failure',
  );
}
