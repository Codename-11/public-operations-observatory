# Phase 0 Implementation Plan

> **For Hermes:** Execute task-by-task with specification review followed by code-quality review.

**Goal:** Deliver a runnable PostgreSQL-backed GitHub signal collector and deterministic weekly evidence-linked Markdown briefing.

**Architecture:** A Node.js 22 TypeScript CLI separates source API access, immutable observations, normalization, metric selection, and presentation. PostgreSQL owns runs, observations, transactional checkpoints, annotations, and briefing revisions. Website analytics remains an independent future adapter using the approved aggregate-only Umami boundary.

**Tech stack:** TypeScript, pnpm, PostgreSQL 16, native `fetch`, `pg`, Zod, Vitest, Docker Compose.

---

1. Bootstrap strict TypeScript/pnpm quality gates and PostgreSQL development service.
2. Add migration runner and durable observation/checkpoint schema.
3. Add deterministic snapshot identity and transactional observation store.
4. Add a GitHub API client with rate-limit/provenance metadata and bounded retries.
5. Collect repository, traffic, issue/PR, workflow, release, and asset signals without bodies or comments.
6. Generate a fixed-window weekly Markdown briefing with evidence links, freshness, gaps, and caveats.
7. Verify idempotency, partial failure handling, migrations, collection, and briefing generation against the local PostgreSQL service.
