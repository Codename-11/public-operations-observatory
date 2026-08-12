# Phase 1 Overview Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Ship a fixed, read-only Hermes-Relay Overview that renders real Phase 0 PostgreSQL data with deterministic historical provenance and the approved Observatory design.

**Architecture:** Keep the existing Phase 0 CLI and migration stream intact. Add shared Zod contracts, a repeatable-read PostgreSQL read model, a small authenticated Fastify API, and a Next.js application that consumes only that API. The first slice exposes one code-owned project and one completed seven-day UTC window; unsupported attention actions and representative mockup claims are omitted.

**Tech Stack:** Node 22, pnpm workspace, TypeScript, PostgreSQL, Fastify, Zod, Next.js, React, Tailwind CSS, source-owned shadcn/ui primitives, Recharts, Vitest, Testing Library, jest-axe, Playwright.

---

## Fixed product boundary

- Route: `/projects/hermes-relay` with `/` redirecting there.
- Project registry: `hermes-relay` → `Codename-11/hermes-relay`.
- Default period: latest completed Monday-to-Monday UTC week versus the prior equal week.
- Supported attention: source failures, partial runs, stale collection, missing successful checkpoint, and incomplete required metric windows only.
- Unsupported: item-level issue/PR/check alerts, acknowledgement/snooze/Forge actions, source administration, dashboard configuration, Umami presentation, public publishing, and arbitrary query APIs.
- Production deployment must fail closed without configured authentication. Development bypass is permitted only when `NODE_ENV !== "production"` and must be explicit.
- Web/API processes must not read raw `observations.payload` or run migrations, collectors, normalization, retention, or briefing generation.

## Determinism and privacy invariants

Every read includes `scope`, metric-definition version, exclusive `windowEnd`, and `asOf`. All Overview queries execute in one read-only `REPEATABLE READ` transaction. Results carry total ordering and provenance references. No raw payloads, identities, diagnostic bodies, authorization material, visitor/session data, or unrestricted URLs enter the response.

---

### Task 1: Establish workspace packages and shared contracts

**Objective:** Add workspace structure and a versioned `OverviewReadModelV1` contract without changing Phase 0 runtime behavior.

**Files:**

- Modify: `pnpm-workspace.yaml`
- Modify: `package.json`
- Create: `packages/contracts/package.json`
- Create: `packages/contracts/tsconfig.json`
- Create: `packages/contracts/src/overview.ts`
- Create: `packages/contracts/src/index.ts`
- Create: `packages/contracts/tests/overview.test.ts`

**Steps:**

1. Write failing contract tests for valid complete/partial states, strict unknown-key rejection, canonical ISO timestamps, allowlisted availability values, and URL validation.
2. Run the contracts test and confirm failure.
3. Implement strict Zod request/response schemas for project, window/as-of, freshness, warnings, changes, trend, release, briefing summary, sources, attention source exceptions, and provenance.
4. Export inferred TypeScript types.
5. Add recursive root scripts while preserving existing Phase 0 scripts.
6. Run contract tests, root typecheck, and Phase 0 tests.
7. Commit: `feat: add Phase 1 overview contracts`.

### Task 2: Implement the deterministic PostgreSQL Overview read model

**Objective:** Assemble the real Overview response inside one read-only repeatable-read transaction.

**Files:**

- Create: `packages/read-model/package.json`
- Create: `packages/read-model/tsconfig.json`
- Create: `packages/read-model/src/overview.ts`
- Create: `packages/read-model/src/project-registry.ts`
- Create: `packages/read-model/src/index.ts`
- Create: `packages/read-model/tests/overview.integration.test.ts`

**Steps:**

1. Seed PostgreSQL fixtures containing complete, partial, stale, late-backfilled, release-counter-reset, and tie-ordering cases.
2. Write failing tests for canonical completed-week bounds, current/prior metrics, net star movement, release download intervals, evidence/provenance, partial suppression, source exceptions, and late-backfill invariance.
3. Confirm failures.
4. Implement code-owned project lookup and strict project-key rejection.
5. Begin a `READ ONLY ISOLATION LEVEL REPEATABLE READ` transaction, capture `transaction_timestamp()` when `asOf` is absent, and execute all reads through that client.
6. Use explicit parameterized SQL and total deterministic ordering. Never query raw observation payloads.
7. Parse the assembled response through `OverviewReadModelV1Schema` before returning it.
8. Run integration tests and the complete root suite.
9. Commit: `feat: add deterministic overview read model`.

### Task 3: Add the authenticated read-only API

**Objective:** Expose the Overview contract through a narrow Fastify route with fail-closed production authentication.

**Files:**

- Create: `apps/api/package.json`
- Create: `apps/api/tsconfig.json`
- Create: `apps/api/src/config.ts`
- Create: `apps/api/src/auth.ts`
- Create: `apps/api/src/server.ts`
- Create: `apps/api/src/routes/projects-overview.ts`
- Create: `apps/api/src/problem-details.ts`
- Create: `apps/api/tests/projects-overview.test.ts`

**Steps:**

1. Write failing tests for unauthenticated denial, production startup without auth, explicit non-production bypass, malformed/duplicate/unknown parameters, unsupported periods/projects, request bodies, security headers, response validation, and sanitized errors.
2. Confirm failures.
3. Implement `GET /api/v1/projects/:projectKey/overview` with fixed `period=7d`, strict optional ISO `windowEnd`/`asOf`, no body, and RFC 9457 errors.
4. Add bounded pool/query timeouts, private/no-store caching, CSP/referrer/frame/content-type headers, sanitized aggregate logging, and coarse concurrency/rate limits without identity profiling.
5. Add `/health` returning only `{ "ok": true }`.
6. Run API tests and complete workspace verification.
7. Commit: `feat: expose read-only overview API`.

### Task 4: Build the Observatory shell and semantic UI primitives

**Objective:** Establish the accessible visual system and responsive shell before wiring metric panels.

**Files:**

- Create: `apps/web/package.json`
- Create: `apps/web/tsconfig.json`
- Create: `apps/web/next.config.ts`
- Create: `apps/web/app/layout.tsx`
- Create: `apps/web/app/globals.css`
- Create: `apps/web/app/page.tsx`
- Create: `apps/web/app/projects/[projectKey]/layout.tsx`
- Create: `apps/web/components/shell/*`
- Create: `packages/ui/package.json`
- Create: `packages/ui/src/*`
- Create: `apps/web/tests/shell.test.tsx`

**Steps:**

1. Add self-hosted Manrope, Inter, and IBM Plex Mono assets or package-provided local font files; no browser Google Fonts requests.
2. Encode DESIGN.md colors, typography, spacing, radii, focus, and reduced-motion tokens in CSS variables.
3. Add source-owned Button, Badge, Card, Alert, Sheet, Skeleton, Separator, Table, Tooltip, and ToggleGroup primitives.
4. Write failing shell tests for landmarks, skip links, focus visibility hooks, active navigation, mobile sheet, reduced-motion behavior, and absence of dead links.
5. Implement the responsive shell and project/review context bar.
6. Use no Magic UI by default; if orientation motion is added, it is one-shot, ≤160ms, and disabled for reduced motion.
7. Run component tests, axe checks, and production build.
8. Commit: `feat: add Observatory application shell`.

### Task 5: Render the real Overview panels

**Objective:** Replace the representative mockup values with real API-backed Overview panels and honest unsupported states.

**Files:**

- Create: `apps/web/lib/api.ts`
- Create: `apps/web/app/projects/[projectKey]/page.tsx`
- Create: `apps/web/components/overview/changed-strip.tsx`
- Create: `apps/web/components/overview/trend-panel.tsx`
- Create: `apps/web/components/overview/trend-data-table.tsx`
- Create: `apps/web/components/overview/source-attention-rail.tsx`
- Create: `apps/web/components/overview/latest-release-context.tsx`
- Create: `apps/web/components/overview/source-freshness.tsx`
- Create: `apps/web/components/overview/evidence-sheet.tsx`
- Create: `apps/web/tests/overview.test.tsx`

**Steps:**

1. Write failing tests for complete, partial, stale, failed, empty, no-release, no-briefing, and unsupported-attention states.
2. Confirm failures.
3. Fetch the validated API contract server-side; do not access PostgreSQL from Next.js.
4. Render net star-count change, views, clones, release-download intervals, open-issue context, prior comparison, and provenance only when supported.
5. Rename the mockup chart to `Release asset downloads`; never imply a discovery funnel or release causation.
6. Render source exceptions only; omit inactive issue/PR/check actions.
7. Add an accessible chart table, focusable evidence sheet, external-link labeling, `rel="noopener noreferrer"`, and no remote previews/unfurls.
8. Isolate panel failures and preserve unaffected content.
9. Run component, accessibility, type, and build checks.
10. Commit: `feat: render evidence-backed Overview`.

### Task 6: Add browser and deployment verification

**Objective:** Prove the UI works end-to-end without weakening the privacy or authentication boundary.

**Files:**

- Create: `tests/e2e/overview.spec.ts`
- Create: `playwright.config.ts`
- Modify: `.github/workflows/ci.yml`
- Modify: `README.md`
- Modify: `DEVLOG.md`
- Create: `docs/phase-1-deployment.md`

**Steps:**

1. Document the private deployment boundary, authenticating TLS proxy assumption, read-only PostgreSQL role/grants, timeouts, cache policy, and explicit prohibition on analytics until the existing gate is satisfied.
2. Add Playwright tests for desktop/mobile layout, keyboard navigation, no horizontal overflow, evidence opening, partial banners, reduced motion, and no console errors.
3. Add CI jobs for workspace tests/build and browser checks using deterministic fixtures.
4. Verify dedicated DB role cannot select raw payloads or perform writes.
5. Run format, lint, typecheck, all unit/integration/component tests, production builds, Playwright, audit, Compose validation, and `git diff --check`.
6. Deploy an unlisted review preview using safe fixture data, capture desktop/mobile screenshots, and visually inspect them.
7. Commit: `test: verify Phase 1 Overview end to end`.

### Task 7: Independent review and delivery

**Objective:** Merge only after strict specification, security, and visual review.

**Steps:**

1. Dispatch a spec-compliance review against DESIGN.md, AXI-173, and this plan.
2. Fix every concrete blocker and re-review.
3. Dispatch code-quality/security review.
4. Fix every concrete blocker and re-review.
5. Run the canonical verification suite from a clean checkout.
6. Prepare the public PR body for Bailey’s approval.
7. Open the PR, watch CI, merge after approval, verify `main`, and move AXI-173 to Done.
