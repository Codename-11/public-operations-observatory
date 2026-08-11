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
