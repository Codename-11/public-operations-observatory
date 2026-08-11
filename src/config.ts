import { z } from 'zod';

const optionalToken = z.string().trim().min(1).optional();
const githubSlug = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9_.-]+$/, 'must be a GitHub owner or repository slug')
  .refine((value) => value !== '.' && value !== '..', 'must not be a path segment');

export const configSchema = z.object({
  DATABASE_URL: z.string().url(),
  GITHUB_TOKEN: optionalToken,
  GITHUB_OWNER: githubSlug.default('Codename-11'),
  GITHUB_REPOSITORY: githubSlug.default('hermes-relay'),
  OBSERVATORY_OUTPUT_DIR: z.string().trim().min(1).default('./out'),
  OBSERVATORY_FRESHNESS_HOURS: z.coerce.number().positive().default(30),
});

export type Config = z.infer<typeof configSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  return configSchema.parse(env);
}
