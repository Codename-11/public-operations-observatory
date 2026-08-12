import type { OverviewChangeV1 } from '@public-operations-observatory/contracts';
import { EvidenceLink } from '@public-operations-observatory/ui';

const number = new Intl.NumberFormat('en-US');
const signed = (value: number): string => `${value > 0 ? '+' : ''}${number.format(value)}`;

export function ChangedStrip({ changes }: { changes: OverviewChangeV1[] }) {
  return (
    <section className="overview-section" aria-labelledby="changed-title">
      <header className="overview-section__header">
        <div>
          <p className="eyebrow">Completed seven-day window</p>
          <h2 id="changed-title">What changed</h2>
        </div>
      </header>
      <div className="changed-strip">
        {changes.map((change) => {
          return (
            <article
              className={`metric-tile metric-tile--${change.availability}`}
              key={change.metricKey}
            >
              <h3>{change.label}</h3>
              {change.delta !== null && change.current !== null && change.previous !== null ? (
                <>
                  <strong className="metric-value">{signed(change.delta)}</strong>
                  <span>{number.format(change.current)} current</span>
                  <span>{number.format(change.previous)} prior</span>
                </>
              ) : (
                <strong className="metric-unavailable">{change.label} unavailable</strong>
              )}
              {change.availability !== 'complete' ? (
                <span className="availability-label">{change.availability}</span>
              ) : null}
              {change.evidenceUrl ? (
                <EvidenceLink
                  href={change.evidenceUrl}
                  aria-label={`Open ${change.label} evidence (opens in a new tab)`}
                >
                  Inspect evidence
                </EvidenceLink>
              ) : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}
