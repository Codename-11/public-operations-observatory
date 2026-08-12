'use client';

import type { OverviewProvenanceV1 } from '@public-operations-observatory/contracts';
import { Button, EvidenceLink, Sheet } from '@public-operations-observatory/ui';
import { useState } from 'react';

const date = (value: string): string =>
  new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'UTC',
  }).format(new Date(value));

export function EvidenceSheet({ provenance }: { provenance: OverviewProvenanceV1 }) {
  const [open, setOpen] = useState(false);
  return (
    <Sheet
      open={open}
      onOpenChange={setOpen}
      title="Evidence and provenance"
      description="Bounded references used by this Overview response"
      closeLabel="Close evidence"
      trigger={
        <Button type="button" size="compact">
          Review evidence
        </Button>
      }
    >
      <dl className="evidence-metadata">
        <div>
          <dt>Scope</dt>
          <dd>{provenance.scope}</dd>
        </div>
        <div>
          <dt>Metric definition</dt>
          <dd>v{provenance.metricDefinitionVersion}</dd>
        </div>
        <div>
          <dt>Window end</dt>
          <dd>{date(provenance.windowEnd)}</dd>
        </div>
        <div>
          <dt>As of</dt>
          <dd>{date(provenance.asOf)}</dd>
        </div>
      </dl>
      {provenance.references.length === 0 ? (
        <p>No bounded evidence references are available.</p>
      ) : (
        <ol className="evidence-list">
          {provenance.references.map((reference) => {
            const host = reference.evidenceUrl ? new URL(reference.evidenceUrl).hostname : null;
            return (
              <li key={reference.ref}>
                <strong>{reference.ref}</strong>
                <span>
                  {reference.sourceKey} · observed {date(reference.observedAt)}
                </span>
                {reference.evidenceUrl && host ? (
                  <EvidenceLink
                    href={reference.evidenceUrl}
                    aria-label={`Open ${reference.ref} evidence on ${host} (opens in a new tab)`}
                  >
                    Open evidence on {host}
                  </EvidenceLink>
                ) : (
                  <span>No external evidence link</span>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </Sheet>
  );
}
