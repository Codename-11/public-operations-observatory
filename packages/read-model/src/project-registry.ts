import type { OverviewProjectV1 } from '@public-operations-observatory/contracts';

const projects = {
  'hermes-relay': {
    key: 'hermes-relay',
    name: 'Hermes-Relay',
    repository: 'Codename-11/hermes-relay',
    scope: 'Codename-11/hermes-relay',
  },
} as const satisfies Record<string, OverviewProjectV1>;

export type ProjectKey = keyof typeof projects;

export function getProject(projectKey: string): OverviewProjectV1 {
  if (!Object.hasOwn(projects, projectKey)) {
    throw new Error(`Unknown Observatory project: ${projectKey}`);
  }
  return projects[projectKey as ProjectKey];
}
