import type {
  OverviewBriefingSummaryV1,
  OverviewReleaseV1,
} from '@public-operations-observatory/contracts';
import {
  Card,
  CardContent,
  CardHeader,
  EmptyState,
  EvidenceLink,
  PanelState,
} from '@public-operations-observatory/ui';

const date = (value: string): string =>
  new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeZone: 'UTC' }).format(
    new Date(value),
  );

function ReleaseRecord({ release }: { release: OverviewReleaseV1 | null }) {
  if (release === null)
    return (
      <PanelState state="partial" title="Release availability unknown">
        Release fields are unavailable.
      </PanelState>
    );
  if (release.availability === 'empty')
    return <EmptyState kind="no-records">No release in this period</EmptyState>;
  if (release.availability === 'failed')
    return (
      <PanelState state="error" title="Release unavailable">
        No release value is shown.
      </PanelState>
    );
  return (
    <article>
      {release.availability !== 'complete' ? (
        <PanelState
          state={release.availability === 'stale' ? 'stale' : 'partial'}
          title={`${release.availability === 'stale' ? 'Stale' : 'Partial'} release context`}
        >
          Retained release fields are shown; unavailable fields are labelled.
        </PanelState>
      ) : null}
      <h3>{release.tagName ?? 'Release tag unavailable'}</h3>
      {release.name ? <p>{release.name}</p> : null}
      <dl>
        <div>
          <dt>Published</dt>
          <dd>{release.publishedAt ? date(release.publishedAt) : 'Unknown'}</dd>
        </div>
        <div>
          <dt>Asset downloads</dt>
          <dd>{release.assetDownloads ?? 'Unavailable'}</dd>
        </div>
      </dl>
      {release.evidenceUrl ? (
        <EvidenceLink
          href={release.evidenceUrl}
          aria-label={`Open ${release.tagName ?? 'retained'} release evidence on GitHub (opens in a new tab)`}
        >
          Release evidence
        </EvidenceLink>
      ) : null}
    </article>
  );
}

function BriefingRecord({ briefing }: { briefing: OverviewBriefingSummaryV1 }) {
  if (briefing.availability === 'failed')
    return (
      <PanelState state="error" title="Briefing unavailable">
        No briefing value is shown.
      </PanelState>
    );
  if (briefing.availability === 'empty') return <p>No briefing for this period</p>;
  return (
    <>
      {briefing.availability !== 'complete' ? (
        <PanelState
          state={briefing.availability === 'stale' ? 'stale' : 'partial'}
          title={`${briefing.availability === 'stale' ? 'Stale' : 'Partial'} briefing context`}
        >
          Retained briefing fields are shown; unavailable fields are labelled.
        </PanelState>
      ) : null}
      <p>{briefing.summary ?? 'Briefing summary unavailable'}</p>
      <span>
        {briefing.generatedAt
          ? `Generated ${date(briefing.generatedAt)}`
          : 'Generated date unknown'}
      </span>
    </>
  );
}

export function LatestReleaseContext({
  release,
  briefing,
}: {
  release: OverviewReleaseV1 | null;
  briefing: OverviewBriefingSummaryV1;
}) {
  return (
    <Card aria-labelledby="release-title">
      <CardHeader>
        <div>
          <h2 id="release-title">Latest release context</h2>
          <p>Release and briefing records available for review</p>
        </div>
      </CardHeader>
      <CardContent className="release-context">
        <ReleaseRecord release={release} />
        <div className="briefing-context">
          <h3>Briefing context</h3>
          <BriefingRecord briefing={briefing} />
        </div>
      </CardContent>
    </Card>
  );
}
