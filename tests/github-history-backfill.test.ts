import { describe, expect, it } from 'vitest';

import type { CheckpointInput, CollectionRun, RunCompletion } from '../src/db/observation-store.js';
import type { ObservationInput } from '../src/domain/observation.js';
import { backfillGitHubHistory } from '../src/github/history-backfill.js';

class FakeGitHubReader {
  public readonly sourceMetadata = { resources: { core: { remaining: 4_900 } } };
  public readonly requested: Array<{ path: string; accept?: string }> = [];

  public constructor(private readonly privateRepository = false) {}

  public getJson<T>(path: string, accept?: string): Promise<T> {
    this.requested.push({ path, ...(accept === undefined ? {} : { accept }) });
    const page = Number(new URL(`https://api.github.com${path}`).searchParams.get('page') ?? '1');
    let value: unknown;
    if (path === '/repos/Codename-11/hermes-relay') {
      value = {
        html_url: 'https://github.com/Codename-11/hermes-relay',
        private: this.privateRepository,
        visibility: this.privateRepository ? 'private' : 'public',
      };
    } else if (path.includes('/stargazers')) {
      value =
        page === 1
          ? [
              { starred_at: '2026-04-09T19:33:06Z', user: { login: 'must-not-persist' } },
              { starred_at: '2026-04-11T01:00:00Z', user: { login: 'also-private' } },
            ]
          : [];
    } else if (path.includes('/issues/events')) {
      value =
        page === 1
          ? [
              {
                id: 1,
                event: 'closed',
                created_at: '2026-04-10T12:00:00Z',
                issue: { number: 1 },
              },
              {
                id: 2,
                event: 'reopened',
                created_at: '2026-04-10T12:00:00Z',
                issue: { number: 1 },
              },
              {
                id: 3,
                event: 'closed',
                created_at: '2026-04-10T15:00:00Z',
                issue: { number: 99, pull_request: {} },
              },
            ]
          : [];
    } else if (path.includes('/issues?')) {
      value =
        page === 1
          ? [
              { number: 1, created_at: '2026-04-09T10:00:00Z' },
              { number: 2, created_at: '2026-04-10T13:00:00Z' },
              { number: 99, created_at: '2026-04-09T09:00:00Z', pull_request: {} },
            ]
          : [];
    } else {
      throw new Error(`Unexpected path: ${path}`);
    }
    return Promise.resolve(value as T);
  }
}

class FakeStore {
  public persisted: ObservationInput[] = [];
  public checkpoint: CheckpointInput | undefined;
  public completion: RunCompletion | undefined;
  public status = '';
  public operation = '';

  public beginRun(
    source: string,
    scope: string,
    operation: 'snapshot' | 'history_backfill' = 'snapshot',
  ): Promise<CollectionRun> {
    this.operation = operation;
    return Promise.resolve({ id: 'history-run', source, scope });
  }

  public withCollectionLock<T>(_source: string, _scope: string, action: () => Promise<T>) {
    return action();
  }

  public persistBatch(
    _run: CollectionRun,
    observations: ObservationInput[],
    checkpoint: CheckpointInput | undefined,
    completion: RunCompletion,
  ): Promise<number> {
    this.persisted = observations;
    this.checkpoint = checkpoint;
    this.completion = completion;
    return Promise.resolve(observations.length);
  }

  public finishRun(_id: string, status: string): Promise<void> {
    this.status = status;
    return Promise.resolve();
  }
}

describe('backfillGitHubHistory', () => {
  it('derives daily star-cohort and issue-state snapshots without persisting identities', async () => {
    const reader = new FakeGitHubReader();
    const store = new FakeStore();
    const result = await backfillGitHubHistory(reader, store, 'Codename-11', 'hermes-relay', {
      since: new Date('2026-04-09T00:00:00Z'),
      throughExclusive: new Date('2026-04-12T00:00:00Z'),
      generatedAt: new Date('2026-08-15T00:00:00Z'),
    });

    expect(result).toMatchObject({ observations: 6, starPoints: 3, issuePoints: 3 });
    expect(store.operation).toBe('history_backfill');
    expect(store.completion?.status).toBe('succeeded');
    expect(store.checkpoint?.key).toBe('historical-backfill-v1');
    expect(
      store.persisted
        .filter(({ recordKind }) => recordKind === 'repository.summary')
        .map(({ payload }) => payload),
    ).toEqual([
      { stars: 1, derivation: { method: 'current-stargazer-cohort', lowerBound: true } },
      { stars: 1, derivation: { method: 'current-stargazer-cohort', lowerBound: true } },
      { stars: 2, derivation: { method: 'current-stargazer-cohort', lowerBound: true } },
    ]);
    expect(
      store.persisted
        .filter(({ recordKind }) => recordKind === 'issues.summary')
        .map(({ payload }) => payload),
    ).toEqual([
      { open: 1, closed: 0, derivation: { method: 'issue-state-events', reconstructed: true } },
      { open: 2, closed: 0, derivation: { method: 'issue-state-events', reconstructed: true } },
      { open: 2, closed: 0, derivation: { method: 'issue-state-events', reconstructed: true } },
    ]);
    expect(JSON.stringify(store.persisted)).not.toContain('must-not-persist');
    expect(reader.requested.find(({ path }) => path.includes('/stargazers'))?.accept).toBe(
      'application/vnd.github.star+json',
    );
  });

  it('produces stable payloads for unchanged source history', async () => {
    const first = new FakeStore();
    const second = new FakeStore();
    const options = {
      since: new Date('2026-04-09T00:00:00Z'),
      throughExclusive: new Date('2026-04-12T00:00:00Z'),
    };
    await backfillGitHubHistory(new FakeGitHubReader(), first, 'Codename-11', 'hermes-relay', {
      ...options,
      generatedAt: new Date('2026-08-15T00:00:00Z'),
    });
    await backfillGitHubHistory(new FakeGitHubReader(), second, 'Codename-11', 'hermes-relay', {
      ...options,
      generatedAt: new Date('2026-08-16T00:00:00Z'),
    });
    expect(second.persisted).toEqual(first.persisted);
  });

  it('rejects private repositories before requesting historical endpoints', async () => {
    const reader = new FakeGitHubReader(true);
    const store = new FakeStore();
    await expect(
      backfillGitHubHistory(reader, store, 'Codename-11', 'hermes-relay', {
        since: new Date('2026-04-09T00:00:00Z'),
        throughExclusive: new Date('2026-04-12T00:00:00Z'),
      }),
    ).rejects.toThrow('Private repositories');
    expect(reader.requested).toHaveLength(1);
    expect(store.status).toBe('failed');
  });
});
