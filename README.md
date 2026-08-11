# Public Operations Observatory

Public Operations Observatory preserves durable, evidence-linked public product signals and turns them into restrained operating briefings.

The Phase 0 program is intentionally GitHub-first. Its first runnable release, v0.1, provides a PostgreSQL-backed idempotent GitHub collector, explicit checkpoints and provenance, release/documentation/communication annotations, and a weekly Markdown briefing for Hermes-Relay. It does not include a dashboard, Google Play, multi-tenancy, a plugin marketplace, or public action execution.

See:

- [Phase 0 contract](docs/phase-0-contract.md)
- [Website analytics decision](docs/analytics-decision.md)

The existing self-hosted Umami deployment is approved as a separate aggregate-only input. Its adapter remains gated on the reviewed CTA allowlist, privacy notice, retention configuration, and transmission validation; it does not block the GitHub collector or weekly briefing.

## Local operating loop

Requirements: Node.js 22+, Corepack/pnpm, Docker with Compose, and a GitHub token that can read repository traffic.

```bash
cp .env.example .env
# Set GITHUB_TOKEN in .env; never commit the file.
corepack pnpm install --frozen-lockfile
docker compose up -d --wait
corepack pnpm db:migrate
corepack pnpm collect:github
corepack pnpm exec tsx src/cli.ts annotate add \
  --kind release \
  --at 2026-08-11T12:00:00Z \
  --title "Example release" \
  --url https://github.com/example/project/releases/tag/v1.0.0
corepack pnpm briefing:weekly
corepack pnpm maintenance:retention
```

Briefings are written under `./out` by default. Use `briefing weekly --end YYYY-MM-DD` through `src/cli.ts` when reproducing a fixed UTC window.

## Quality gates

```bash
corepack pnpm format:check
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm test
corepack pnpm build
docker compose config --quiet
```

## Scheduling

Run `collect:github` at least daily, `briefing:weekly` once per week after collection, and `maintenance:retention` daily. The retention command redacts diagnostic details after 30 days and records each policy execution in `retention_runs`; the aggregate observations remain durable. Add release, documentation, and major public-communication annotations before generating the briefing; annotations record chronology, never causation. The commands are process-manager agnostic; deployment-specific cron, backup, secret, and network configuration stays outside this public repository.
