# Phase 0 implementation contract

Status: Settled for the GitHub foundation; website analytics provider approval remains pending.

## Identity

- Product: Public Operations Observatory
- Repository: `Codename-11/public-operations-observatory`
- Canonical local checkout convention: `~/projects/public-operations-observatory`
- Initial observed product: Hermes-Relay

The repository and its documentation are public and general-purpose. Deployment instructions must not assume a particular private network, hostname, identity provider, secret store, reverse proxy, or backup service.

## Staged boundary

Phase 0 is the signal-foundation program. v0.1 is its first runnable release.

### v0.1 includes

- GitHub-only collection for repository stars, forks, traffic, issues, pull requests, workflows, releases, and release-asset download counters.
- PostgreSQL durable state with append-only observations, idempotent snapshot keys, explicit source checkpoints, collection-run records, and provenance.
- Normalized records and versioned metric definitions kept separate from collectors and presentation.
- Manual annotations for releases, documentation changes, and major public communications. Annotations may establish chronology, not causation.
- A deterministic weekly Hermes-Relay Markdown briefing with evidence links, collection timestamps, source freshness, missing-data warnings, and caveats.
- Headless operation through documented commands and a durable schedule. No web application is required.

### Deferred beyond v0.1

- Website reach and CTA collection until Bailey approves an analytics provider and the event allowlist.
- Google Play, aggregate product-utilization telemetry, social/community connectors, and private work-management data.
- Dashboards, configurable dashboard composition, saved views, alert-triage UI, or arbitrary presentation plugins.
- Public report publishing, public replies, or any other public action execution.
- Multi-tenancy, a plugin marketplace, runtime third-party code, portfolio views, or SaaS billing.

## Architecture boundaries

```text
GitHub API
  -> source collector
  -> immutable source observation + collection run
  -> normalizer
  -> normalized record
  -> versioned metric definition/query
  -> Markdown briefing renderer

PostgreSQL owns observations, checkpoints, provenance, annotations,
briefing inputs, and generated briefing revisions.
```

Collectors do not format reports. Normalizers do not call source APIs. Metric definitions do not own storage. Briefing rendering consumes versioned records/metrics and emits evidence references. These boundaries are package/API contracts even if v0.1 ships as one deployable process.

Each snapshot uses a stable source, scope, record kind, external identity, observed-at bucket, and payload/version digest. Re-running a time bucket must update run status and reuse existing observations rather than duplicate facts. Checkpoints advance only in the same database transaction as the observations they cover.

The GitHub collector is independently deployable from any future website-analytics collector. Analytics approval or outage cannot stop GitHub snapshots or briefing generation.

## Privacy contract

The Observatory must not collect or derive:

- user identity or cross-source identity;
- cookies, browser storage identifiers, persistent identifiers, or fingerprinting;
- session replay, heatmaps, keystrokes, form values, query-string payloads, or DOM/content capture;
- private repository data, private issue payloads, credentials, internal hostnames, or private product payloads;
- Hermes-Relay message text, prompts, commands, screenshots, file names, device identifiers, IP addresses, or other product-content telemetry.

v0.1 stores only the GitHub fields needed to reproduce public metrics and evidence links. It does not duplicate issue/PR bodies or comments. GitHub traffic is retained only as aggregate counts exposed by GitHub.

If website analytics is approved later, the event allowlist is limited to page views and named public CTA events. Event names and properties must be code-reviewed constants; free-form values, account identifiers, URLs with query strings, and product-derived properties are rejected.

## Retention defaults

| Data class | Default | Rationale |
| --- | ---: | --- |
| Normalized GitHub observations, metric observations, checkpoints, provenance, annotations, briefing revisions | Indefinite | They are the durable historical record Phase 0 exists to preserve. |
| Minimal raw GitHub response fragments required for replay | 90 days | Supports parser recovery without retaining redundant public content indefinitely. |
| Collector diagnostics and redacted error details | 30 days | Enough for operating review while limiting incidental metadata. |
| Database backups | 35 days | Bounded recovery window; restore tests remain required. |
| Approved website aggregate page/CTA observations | 13 rolling months | Enables annual comparison without visitor-level history. |
| Analytics-provider visitor/session drill-down | Not ingested | Outside the Observatory contract even if a provider exposes it. |

Retention jobs are idempotent and auditable. A configuration change may shorten retention, but extending it requires an explicit recorded decision.

## Presentation and Magic UI

v0.1 produces Markdown and does not ship a dashboard. Any later web application starts with accessible shadcn/ui primitives. Magic UI may be used sparingly for one-time orientation or emphasis only when it improves comprehension. It must not drive metric meaning, status, navigation, or routine motion.

All later motion must respect `prefers-reduced-motion`, remain functional rather than decorative, avoid continuous animation, and preserve WCAG 2.2 AA contrast, keyboard access, semantic structure, non-color status cues, and tabular alternatives for charts.

## Operating cadence

- Schedule durable GitHub snapshots at least daily; use a shorter cadence only for endpoints whose retention window or operational value requires it.
- Record collection time, source freshness expectation, last successful checkpoint, API/rate-limit state, and partial failures.
- Generate one weekly Markdown briefing from a fixed window and metric-definition version.
- Link every material claim to a source URL or persisted observation reference.
- State unavailable or stale inputs directly. Never interpolate missing data or assert that an annotation caused a metric change.

## Decision gates

The GitHub collector and briefing work may proceed from this contract. Website instrumentation may proceed only after Bailey approves the provider, deployment mode, event allowlist, and 13-month aggregate retention. No release, deployment, or public report publication is authorized by this document.
