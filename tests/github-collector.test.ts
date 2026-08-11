import { describe, expect, it } from 'vitest';

import type { ObservationInput } from '../src/domain/observation.js';
import type { CheckpointInput, CollectionRun, RunCompletion } from '../src/db/observation-store.js';
import { collectGitHub } from '../src/github/collector.js';

class FakeGitHubReader {
  public readonly sourceMetadata = { remaining: 4990 };
  public readonly requestedPaths: string[] = [];

  public constructor(private readonly privateRepository = false) {}

  public getJson<T>(path: string): Promise<T> {
    this.requestedPaths.push(path);
    let value: unknown;
    if (path === '/repos/Codename-11/hermes-relay') {
      value = {
        stargazers_count: 100,
        forks_count: 10,
        open_issues_count: 4,
        html_url: 'https://github.com/Codename-11/hermes-relay',
        pushed_at: '2026-08-11T12:00:00Z',
        private: this.privateRepository,
        visibility: this.privateRepository ? 'private' : 'public',
      };
    } else if (path.includes('/traffic/views')) {
      value = {
        count: 20,
        uniques: 15,
        views: [{ timestamp: '2026-08-11T00:00:00Z', count: 20, uniques: 15 }],
      };
    } else if (path.includes('/traffic/clones')) {
      value = {
        count: 8,
        uniques: 6,
        clones: [{ timestamp: '2026-08-11T00:00:00Z', count: 8, uniques: 6 }],
      };
    } else if (path.includes('/search/issues')) {
      value = { total_count: path.includes('is:open') ? 3 : 12 };
    } else if (path.includes('/actions/runs')) {
      value = {
        total_count: 2,
        workflow_runs: [
          { status: 'completed', conclusion: 'success', created_at: '2026-08-11T00:00:00Z' },
          { status: 'completed', conclusion: 'failure', created_at: '2026-08-10T00:00:00Z' },
        ],
      };
    } else if (path.includes('/releases')) {
      value = [
        {
          id: 1,
          tag_name: 'android-v1.0.0',
          html_url: 'https://github.com/Codename-11/hermes-relay/releases/tag/android-v1.0.0',
          published_at: '2026-08-10T00:00:00Z',
          prerelease: false,
          draft: false,
          assets: [{ id: 10, download_count: 25 }],
        },
      ];
    } else if (path.includes('/stargazers')) {
      value = [{ starred_at: '2026-08-10T01:00:00Z' }, { starred_at: '2026-08-10T02:00:00Z' }];
    } else {
      throw new Error(`Unexpected path: ${path}`);
    }
    return Promise.resolve(value as T);
  }
}

class FakeStore {
  public persisted: ObservationInput[] = [];
  public status = '';

  public beginRun(source: string, scope: string) {
    return Promise.resolve({ id: 'run-1', source, scope });
  }

  public withCollectionLock<T>(_source: string, _scope: string, action: () => Promise<T>) {
    return action();
  }

  public persistBatch(
    _run: CollectionRun,
    observations: ObservationInput[],
    _checkpoint: CheckpointInput,
    completion: RunCompletion,
  ) {
    this.persisted = observations;
    this.status = completion.status;
    return Promise.resolve(observations.length);
  }

  public finishRun(_id: string, status: string) {
    this.status = status;
    return Promise.resolve();
  }
}

describe('collectGitHub', () => {
  it('collects aggregate public signals without stargazer identities', async () => {
    const store = new FakeStore();
    const result = await collectGitHub(
      new FakeGitHubReader(),
      store,
      'Codename-11',
      'hermes-relay',
      new Date('2026-08-11T12:00:00Z'),
    );

    expect(result.errors).toEqual([]);
    expect(store.status).toBe('succeeded');
    expect(store.persisted.map((item) => item.recordKind)).toEqual(
      expect.arrayContaining([
        'repository.summary',
        'traffic.views',
        'traffic.clones',
        'issues.summary',
        'pulls.summary',
        'workflows.summary',
        'release.summary',
        'stars.daily',
      ]),
    );
    const serialized = JSON.stringify(store.persisted);
    expect(serialized).not.toContain('login');
    expect(serialized).not.toContain('user');
  });

  it('rejects a private repository before requesting any secondary endpoint', async () => {
    const reader = new FakeGitHubReader(true);
    const store = new FakeStore();

    await expect(
      collectGitHub(reader, store, 'Codename-11', 'hermes-relay', new Date('2026-08-11T12:00:00Z')),
    ).rejects.toThrow('Private repositories are outside the Observatory privacy contract');
    expect(reader.requestedPaths).toEqual(['/repos/Codename-11/hermes-relay']);
    expect(store.persisted).toEqual([]);
    expect(store.status).toBe('failed');
  });
});
