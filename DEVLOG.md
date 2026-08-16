# Development log

## 2026-08-09 — AXI-122 Phase 0 contract

- Established the public product and repository identity.
- Recorded the GitHub-only Phase 0/v0.1 boundary, architecture seams, privacy contract, retention defaults, and presentation constraints.
- Compared Umami, Plausible, and GoatCounter using official sources; selected the existing self-hosted Umami deployment with a strict aggregate-only adapter boundary.
- Kept website analytics explicitly non-blocking for the GitHub collector and weekly Markdown briefing.
- Added the runnable TypeScript/pnpm Phase 0 foundation: PostgreSQL migrations, idempotent observations and transactional checkpoints, public GitHub signal collection, versioned metric definitions, manual annotations, and deterministic evidence-linked weekly briefings.
- Added an independently persisted normalization boundary and routed briefing metrics through versioned definitions.
- Removed identity-bearing stargazer history requests; star history now comes from aggregate repository snapshots.
- Enforced successful-run checkpoints in application and database layers, with append-only historical checkpoint provenance.
- Added auditable 90-day source-observation retention, deterministic per-resource API quota reporting, durable systemd schedules, and executable backup/restore verification.

## 2026-08-11 — AXI-173 Phase 1 Overview verification

- Added deterministic Playwright coverage for desktop, tablet, 390 px and 320 px mobile layouts; responsive navigation and modal focus; skip-link focus; horizontal overflow; complete and partial states; exact trend/evidence labels; zero-height bars; reduced motion; disabled navigation; and console/page-error absence.
- Kept fixture responses in a loopback-only test API consumed by the real server-side web client. Browser checks assert the server token appears only as the API `Authorization` header, never in browser resources, and that no analytics request is made.
- Added separate CI workspace, live PostgreSQL, and deterministic browser jobs with generic local-only credentials.
- Added repeatable least-privilege PostgreSQL grant verification: required normalized/durable read-model SELECTs succeed while raw observation reads and durable writes are denied.
- Documented the private TLS/auth-proxy boundary, server-only web-to-API token, explicit database grants, no-store/deadline requirements, and analytics prohibition gate.
- Published an unlisted, visibly labelled deterministic fixture review artifact and captured desktop/mobile visual evidence; it is review-only and does not represent production data or deployment.

## 2026-08-13 — Phase 1 CI configuration isolation

- Fixed the PostgreSQL CI lane failing before migration because GitHub Actions injects `GITHUB_REPOSITORY` as `owner/repository`, while the collector expected that name to contain a bare repository slug.
- Namespaced collector target configuration as `OBSERVATORY_GITHUB_OWNER` and `OBSERVATORY_GITHUB_REPOSITORY` so platform metadata cannot override application configuration.
- Added regression coverage for the GitHub Actions environment collision and reverified the workspace, PostgreSQL, least-privilege read-role, and browser lanes.

## 2026-08-13 — Production data-surface buildout

- Replaced the single Overview composition with three supported, route-aware operating views: Executive Pulse, Reach & Acquisition, and Delivery & Sources.
- Kept every displayed fact inside `OverviewReadModelV1`: fixed 7-day windows only, independent GitHub aggregate signals without conversion or attribution language, and an explicit distinction between the supplied release record and totals observed across trend intervals.
- Added registry-derived Magic UI primitives to the shared UI package using `motion/react`: animated grid, blur fade, border beam, number ticker, particles, and shimmer button, with server-safe initialization and reduced-motion behavior.
- Preserved server-only API access, bounded evidence links, generic failure details, page-level context on failure, partial and unavailable states, exact accessible tables, and existing disabled navigation for unsupported areas.
- Added responsive navigation and layouts for all three routes, internal scrolling plus an explicit mobile hint for the exact Reach table, and verified no document overflow at 390 px or 320 px.
- Expanded unit, axe, and Playwright coverage across selectors, surfaces, route state, API failure context, complete and partial fixtures, evidence dialogs, console errors, analytics absence, reduced motion, and desktop/mobile behavior.

## 2026-08-14 — Current operational view and manual refresh

- Added an explicit `current` Overview view using the latest persisted evidence at transaction time while preserving the completed Monday-to-Monday contract as the API-compatible historical default.
- Made Current the default web view, added a Completed week switch, retained partial current values, reported observed traffic-day coverage, and withheld deltas when either comparison interval is incomplete.
- Prevented first-ever snapshots of older cumulative release counters from being presented as interval downloads.
- Added an authenticated, bodyless refresh endpoint backed by the fixed `public-operations-observatory-collect.service` operation. Concurrent refresh requests join one in-flight trigger; collector and read-only API database responsibilities remain separate.
- Added a server action and accessible Refresh now control with pending, success, and failure states. Browser requests never receive the internal API credential or collector command.
- Changed the supplied GitHub collection timer to four daily runs at `02:15`, `08:15`, `14:15`, and `20:15` UTC and made Playwright ports overridable so deterministic browser tests can coexist with the live development runtime.

## 2026-08-15 — Primary-source historical reconstruction

- Added an explicit, bounded `backfill github-history` command that reconstructs daily active-star cohort and open-issue state before the first directly observed snapshot, then passes the derived aggregates through the existing immutable observation and normalization boundaries.
- Used GitHub stargazer timestamps only in the importer and discarded account objects before persistence. Star history is labelled as a lower bound because later unstars disappear from the current cohort; issue history is labelled reconstructed from creation and close/reopen events.
- Kept unchanged reruns idempotent and prevented reconstructed points from overlapping directly observed repository/issue snapshots.
- Added a separate, versioned 180-day historical-context API and accessible Reach & Acquisition charts for Stars, Open issues, Views, and Clones. The strict seven-day `OverviewReadModelV1` contract remains unchanged; every historical series carries its method, source link, limitation, exact endpoints, and point count.
- Classified collection runs as `snapshot` or `history_backfill` so reconstruction cannot advance operational freshness. Lower-bound star operands expose prior values but do not produce an exact delta.
- Kept unrecoverable evidence unavailable: GitHub traffic remains limited to the source retention window, and present cumulative release-download counters are not assigned to historical dates.
- Deployed the independent history contract and migration to the private operator runtime after workspace, PostgreSQL/least-privilege, and browser CI passed. Live verification covered authenticated Current, Completed, and history responses; unauthenticated history remained denied.
- Exercised the real Refresh now path after deployment: it completed without browser errors, created a successful snapshot run, and left history-backfill run counts unchanged. Live visual QA at 1440, 768, 390, and 320 pixels found and fixed history-summary label collisions; rendered text now remains inside its column with no document overflow.

## 2026-08-15 — Reach evidence workspace redesign

- Rebuilt Reach & Acquisition as a compact evidence workspace matching the approved 1586 × 992 operating target: project navigation, command controls, four immediately visible KPI cards, unified signal history, exact current-window values, provenance and limitations, evidence health, and collection activity.
- Added a typed Reach metric registry that normalizes Stars, Open issues, Views, and Clones into reusable presentation models. Metric identity, values, evidence method, coverage, comparison support, chart behavior, and limitations remain separate from route-level layout.
- Preserved evidence semantics throughout the new composition: unsupported comparisons remain unavailable, retained prior observations remain visible independently of delta support, reconstructed history is visually distinct from an independently observed latest endpoint, and traffic coverage reflects only directly observed days.
- Added a zero-based, accessible six-month history chart with exact values, evidence-method legend, filled trend area, endpoint guide, and an explicit empty state. Exact current values remain immediately readable with reduced motion enabled.
- Added responsive 768 px, 390 px, and 320 px compositions. The 390 px layout uses a compact two-by-two KPI grid, 320 px retains one-column cards, and exact tables scroll internally with an explicit mobile affordance; no required viewport has document-level horizontal overflow.
- Expanded registry, component, shell, partial-evidence, reduced-motion, responsive, and production Playwright coverage. Verification included workspace and web tests, lint, typecheck, production build, formatting, PostgreSQL integration, deterministic browser screenshots, and the full production-mode E2E suite.
- Deployed the redesigned workspace after all workspace, PostgreSQL, least-privilege, and browser CI lanes passed. Live Current and Completed rendering, authentication interception, responsive containment, and the fixed manual-refresh path were verified against real evidence.
