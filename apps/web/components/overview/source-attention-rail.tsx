import type { OverviewSourceAttentionExceptionV1 } from '@public-operations-observatory/contracts';
import {
  Card,
  CardContent,
  CardHeader,
  EmptyState,
  EvidenceLink,
} from '@public-operations-observatory/ui';

export function SourceAttentionRail({
  exceptions,
}: {
  exceptions: OverviewSourceAttentionExceptionV1[];
}) {
  return (
    <Card aria-labelledby="attention-title">
      <CardHeader>
        <div>
          <h2 id="attention-title">Source attention</h2>
          <p>Collection and metric-window exceptions only</p>
        </div>
      </CardHeader>
      <CardContent>
        {exceptions.length === 0 ? (
          <EmptyState kind="no-exceptions">No current source exceptions</EmptyState>
        ) : (
          <ul className="attention-list">
            {exceptions.map((item) => (
              <li
                className={`attention-item attention-item--${item.severity}`}
                key={`${item.sourceKey}:${item.kind}:${item.detectedAt}`}
              >
                <strong>{item.title}</strong>
                <p>{item.detail}</p>
                <span>
                  {item.sourceKey} · {item.severity}
                </span>
                {item.evidenceUrl ? (
                  <EvidenceLink
                    href={item.evidenceUrl}
                    aria-label={`Open evidence for ${item.title} (opens in a new tab)`}
                  >
                    Inspect evidence
                  </EvidenceLink>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
