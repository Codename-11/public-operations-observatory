# Website analytics decision

Status: Approved. Use the existing self-hosted Umami deployment.

Website analytics is a separate Phase 0 input and does not block the GitHub collector or weekly briefing.

## Non-negotiable contract

The integration may collect aggregate page reach and an allowlist of named public CTA counts. It may not collect user identity, cookies, browser-storage identifiers, fingerprinting, persistent identifiers, session replay, heatmaps, form values, free-form event properties, query strings, private payloads, or product-content telemetry. The Observatory will not ingest visitor/session drill-down records.

## Decision matrix

| Criterion        | Umami                                                                                                                                                                                                        | Plausible                                                                                                                                                                      | GoatCounter                                                                                                                                                                                                                                                              |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Privacy model    | Official docs state no cookies, cross-site tracking, fingerprinting, or personal data. The product also exposes anonymous session and journey features, which must be disabled/ignored for this contract.[1] | Official policy states aggregate-only measurement, no cookies or persistent identifiers, no stored raw IP/User-Agent, and a daily salt that prevents cross-day recognition.[2] | Default storage is aggregate tables. It stores no IP, full User-Agent, browser identifier, or tracker ID; an IP+User-Agent mapping can exist in memory for up to eight hours. Individual pageview storage exists but is disabled by default and must remain disabled.[4] |
| CTA support      | Built-in custom events and API.[1]                                                                                                                                                                           | Custom events/goals are available; event names/properties still require a strict allowlist.                                                                                    | Click/custom events are supported; the event path doubles as the event name.[5]                                                                                                                                                                                          |
| Extraction path  | Full REST API for self-hosted or cloud use.[1]                                                                                                                                                               | Stats/export APIs are available; Community Edition omits some premium APIs/features and has a slower release cadence.[3]                                                       | JSON API supports statistics and cursor-based exports, but is currently unversioned under `/api/v0` and may change.[6]                                                                                                                                                   |
| Operating burden | Moderate self-hosted Node/PostgreSQL service; an instance being available is not itself a selection reason.                                                                                                  | Managed cloud is lowest-ops. Community Edition is self-hostable but the operator owns backups, upgrades, capacity, security, and bot filtering.[3]                             | Lowest self-host burden and simplest data model; API stability and coarse event modeling are weaker.                                                                                                                                                                     |
| Contract fit     | Acceptable with hard feature/configuration constraints.                                                                                                                                                      | Strongest documented fit and clearest aggregate boundary.                                                                                                                      | Strong default aggregation, but the in-memory visit mapping and unversioned API deserve explicit acceptance.                                                                                                                                                             |

## Decision

Use the existing self-hosted Umami deployment for bounded website reach and CTA measurement.

Rationale:

1. Umami is already operated for the website, so retaining it avoids a second analytics service and subscription.
2. Its documented no-cookie, no-cross-site-tracking, no-fingerprinting, and no-personal-data model satisfies the Observatory boundary when collection and export are constrained.[1]
3. Its pageview, custom-event, and API surfaces cover the approved metrics: aggregate page reach and a small named CTA allowlist.
4. The Observatory will not ingest Umami session, journey, retention, cohort, or visitor drill-down data. The adapter consumes only approved aggregate observations.
5. The analytics adapter remains independent from the GitHub collector and implements a normalized observation boundary, preserving future provider portability.

Managed Plausible remains the low-operations alternative if the existing Umami deployment is retired. GoatCounter remains the simplicity alternative when coarse CTA semantics and an unversioned API are acceptable.

## Approval checklist

Before adding any tracker:

- The deployment uses the approved existing self-hosted Umami service.
- The public privacy notice names the provider and collected aggregates.
- The code-reviewed allowlist contains only page views and named CTA events.
- Query strings and free-form properties are stripped before transmission.
- Session/journey/individual-pageview features are disabled where possible and never exported.
- Provider-native retention is set to 13 rolling months or shorter.
- A validation capture confirms no cookies, browser storage, identity fields, private payloads, or product-content properties are sent.

## Sources

[1] https://docs.umami.is/docs — Umami documentation: Introduction
[2] https://plausible.io/data-policy — Plausible data policy
[3] https://plausible.io/self-hosted-web-analytics — Plausible self-hosted analytics
[4] https://goatcounter.com/help/privacy — GoatCounter privacy policy
[5] https://www.goatcounter.com/help/events — GoatCounter events documentation
[6] https://www.goatcounter.com/help/api — GoatCounter JSON API documentation
