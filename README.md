# Public Operations Observatory

Public Operations Observatory preserves durable, evidence-linked public product signals and turns them into restrained operating briefings.

The Phase 0 program is intentionally GitHub-first. Its first runnable release, v0.1, provides a PostgreSQL-backed idempotent GitHub collector, explicit checkpoints and provenance, release/documentation/communication annotations, and a weekly Markdown briefing for Hermes-Relay. Phase 1 adds a private, authenticated, evidence-backed Overview served by a Next.js web process through the Overview API; it is not a public dashboard and does not add Google Play, multi-tenancy, a plugin marketplace, or public action execution.

See:

- [Phase 0 contract](docs/phase-0-contract.md)
- [Website analytics decision](docs/analytics-decision.md)
- [Phase 1 private deployment](docs/phase-1-deployment.md)

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
# Re-run the idempotent normalizer independently when replaying source observations.
corepack pnpm normalize:github
corepack pnpm exec tsx src/cli.ts annotate add \
  --kind release \
  --at 2026-08-11T12:00:00Z \
  --title "Example release" \
  --url https://github.com/example/project/releases/tag/v1.0.0
corepack pnpm briefing:weekly
corepack pnpm maintenance:retention
```

Briefings are written under `./out` by default. Without `--end`, the CLI uses the most recent completed Monday-to-Monday UTC week. Use `briefing weekly --end YYYY-MM-DD` through `src/cli.ts` to reproduce another fixed UTC window.

## Quality gates

```bash
corepack pnpm install --frozen-lockfile
corepack pnpm build:workspace
corepack pnpm format:check
corepack pnpm lint:workspace
corepack pnpm typecheck:workspace
corepack pnpm test:workspace
corepack pnpm test:e2e
corepack pnpm audit --audit-level high
docker compose config --quiet
```

Playwright uses a loopback-only deterministic fixture API that returns contract-valid Overview responses. It does not add a production mock fallback. With migrated test PostgreSQL running, `DATABASE_URL=... corepack pnpm db:verify-read-role` verifies the dedicated read-model role can perform only the normalized/durable reads required by the Overview and cannot read raw observations or write durable data.

The Phase 1 web/API token is server-only: set `OBSERVATORY_API_TOKEN` on the Next.js server and matching `API_AUTH_TOKEN` on the private API. Never use a `NEXT_PUBLIC_` token or expose the API to the browser. Browser analytics, telemetry, URL unfurls, and remote previews remain prohibited until the CTA allowlist, privacy notice, retention, and transmission-validation gate is satisfied. See the deployment guide for TLS/auth proxy, no-store, timeout, and least-privilege details.

## Scheduling

Run `collect:github` on the supplied six-hour cadence (`02:15`, `08:15`, `14:15`, and `20:15` UTC), `briefing:weekly` once per week after collection, and `maintenance:retention` daily. Durable systemd service/timer templates for all three jobs live under `ops/systemd/`; copy them to `~/.config/systemd/user/`, adjust the working directory if needed, then enable the timers with `systemctl --user enable --now public-operations-observatory-{collect,briefing,retention}.timer`. `Persistent=true` catches up missed runs after downtime. The authenticated Overview API can optionally expose manual refresh by configuring `API_REFRESH_EXECUTABLE` and `API_REFRESH_ARGUMENTS_JSON`; arguments are fixed at startup and executed without a shell.

The collector writes immutable source observations, then an independently runnable normalizer persists durable normalized records. Metric evaluation reads those records through versioned definitions rather than collector payload paths. The retention command removes raw GitHub source observations after 90 days, redacts diagnostic details after 30 days, and records cutoffs, deletion counts, unnormalized expirations, and any overdue remainder in `retention_runs`; normalized records remain durable indefinitely. An unnormalized fragment is retained for the full replay window, then deleted and surfaced separately in the audit rather than silently retained beyond policy. Add release, documentation, and major public-communication annotations before generating the briefing; annotations are append-only and record chronology, never causation.

Deployment-specific backup transport, secret, and network configuration stays outside this public repository. To exercise a backup restore against a disposable database, set `DATABASE_URL`, `OBSERVATORY_RESTORE_DATABASE_URL`, and `OBSERVATORY_BACKUP_TEST_DIR`, then run `corepack pnpm maintenance:verify-restore`. The command creates a custom-format dump, restores it, compares migration and observation counts, and removes the disposable database.

The collector obtains star totals only from the public repository summary. It deliberately does not call GitHub's identity-bearing stargazer-history endpoint; daily snapshots provide the durable star history without receiving account identities.
