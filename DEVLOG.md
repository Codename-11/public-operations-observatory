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
