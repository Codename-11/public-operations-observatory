import type {
  OverviewFreshnessV1,
  OverviewSourceV1,
} from '@public-operations-observatory/contracts';
import { Card, CardContent, CardHeader, StatusBadge } from '@public-operations-observatory/ui';

const timestamp = (value: string | null): string =>
  value
    ? new Intl.DateTimeFormat('en-GB', {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: 'UTC',
      }).format(new Date(value))
    : 'Unavailable';
const badge = (value: OverviewSourceV1['availability']) =>
  value === 'complete'
    ? 'available'
    : value === 'failed'
      ? 'error'
      : value === 'empty'
        ? 'unavailable'
        : value;

export function SourceFreshness({
  freshness,
  sources,
}: {
  freshness: OverviewFreshnessV1;
  sources: OverviewSourceV1[];
}) {
  return (
    <Card aria-labelledby="freshness-title">
      <CardHeader>
        <div>
          <h2 id="freshness-title">Source freshness</h2>
          <p>UTC collection checkpoints</p>
        </div>
      </CardHeader>
      <CardContent>
        <dl className="freshness-summary">
          <div>
            <dt>Checked</dt>
            <dd>{timestamp(freshness.checkedAt)}</dd>
          </div>
          <div>
            <dt>Last successful</dt>
            <dd>{timestamp(freshness.lastSuccessfulAt)}</dd>
          </div>
          <div>
            <dt>Stale after</dt>
            <dd>{timestamp(freshness.staleAfter)}</dd>
          </div>
        </dl>
        <ul className="source-list">
          {sources.map((source) => (
            <li key={source.key}>
              <div>
                <strong>{source.label}</strong>
                <span>Last success {timestamp(source.lastSuccessfulAt)}</span>
              </div>
              <StatusBadge status={badge(source.availability)} detail={source.availability} />
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
