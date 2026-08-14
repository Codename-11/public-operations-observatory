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
