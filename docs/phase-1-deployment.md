# Phase 1 private deployment

The Phase 1 Overview is a **private operator surface**, not a public dashboard. The repository does not provide an internet-facing deployment topology or production credentials. Deployment-specific hosts, secrets, backup transport, and network details remain outside this public repository.

## Boundary and request path

```text
operator browser --TLS + authenticated reverse proxy--> Next.js web
Next.js server --Bearer token, private network/TLS--> Overview API
Overview API --least-privilege role, TLS/private network--> PostgreSQL
```

- Terminate TLS at an authenticating reverse proxy. The proxy must deny unauthenticated requests before they reach the Next.js server and should supply standard forwarded headers only from trusted peers.
- Keep the web and API origins private. Do not expose the API directly to browsers or the public internet.
- `OBSERVATORY_API_TOKEN` is a server-only web-to-API credential. It must equal the API's `API_AUTH_TOKEN`, live only in server secret storage, never use a `NEXT_PUBLIC_` name, never be rendered into HTML/client JavaScript, and never be logged. Rotate both ends together.
- Set `OBSERVATORY_API_BASE_URL` to the private HTTPS API origin. Plain HTTP is accepted only for local development loopback.
- Production API authentication bypass is prohibited and rejected by configuration.

## Read-only database identity

Run migrations and collectors with separate privileged identities. The Overview API must use a dedicated PostgreSQL login that inherits or is granted the `observatory_read_model` role defined by the repeatable verification script:

```sql
GRANT USAGE ON SCHEMA public TO observatory_read_model;
GRANT SELECT ON normalized_records, collection_runs, source_checkpoint_history,
  annotations, briefing_revisions TO observatory_read_model;
```

Do **not** grant this role access to `observations` (which contains raw payloads), schema ownership, sequence access, DML, DDL, bypass-RLS, role creation, database creation, or superuser. Do not grant `SELECT ON ALL TABLES`; new tables require explicit review. Apply the grants with an administrative migration/deployment identity, then verify them against the migrated database:

```bash
DATABASE_URL=postgresql://ADMIN@HOST/observatory corepack pnpm db:verify-read-role
```

The check proves the read-model's required normalized/durable reads execute while raw-observation reads and durable writes fail. The script creates only a `NOLOGIN` group role; create a deployment-specific login outside this repository, grant it membership, and store its password in the deployment secret manager.

## Deadlines, caching, and logs

- API defaults: 2 s database connection timeout, 5 s query/statement timeout, 10 s request timeout, bounded pool/concurrency/rate limits. Tune only within the validated configuration ranges and keep upstream proxy timeouts slightly longer than the API deadline.
- The read model executes in one `READ ONLY`, `REPEATABLE READ` transaction. The database identity remains read-only even if application code regresses.
- API responses are `Cache-Control: private, no-store`; the Next.js fetch is also `cache: 'no-store'`. The authenticating proxy must not cache Overview HTML or API responses. Avoid shared/CDN caches.
- Redact `Authorization` at every hop. Do not log response bodies, database URLs, evidence content, query parameters carrying secrets, or server environment values.
- Retain the API's CSP/referrer/content-type/frame protections. Apply an appropriate private web CSP and `Referrer-Policy: no-referrer` at the proxy.

## Analytics prohibition

Do not add analytics, telemetry pixels, session replay, third-party embeds, URL unfurls, or remote preview metadata to the private Overview. The existing self-hosted Umami source is a separate aggregate-only input, not browser instrumentation. Browser analytics remain prohibited until all of these are reviewed and satisfied:

1. CTA/event allowlist,
2. operator-facing privacy notice,
3. retention configuration,
4. transmission validation proving only allowlisted aggregate data leaves the browser boundary.

Until that gate passes, the expected browser network trace contains only the private web origin and local static resources. Evidence URLs are plain, labelled external links with no prefetch or unfurl.

## Deployment verification

Before promoting a build:

```bash
corepack pnpm install --frozen-lockfile
corepack pnpm build:workspace
corepack pnpm format:check:workspace
corepack pnpm lint:workspace
corepack pnpm typecheck:workspace
corepack pnpm test:workspace
corepack pnpm test:e2e
corepack pnpm audit --audit-level high
docker compose config --quiet
git diff --check
```

Run migrations, the full workspace suite, and `db:verify-read-role` once with a disposable/live test PostgreSQL service. Browser checks intentionally use a contract-valid deterministic fixture API on loopback; there is no production mock fallback. The unlisted Artifact Preview is review-only fixture data, visibly labelled, and is not the private deployment.
