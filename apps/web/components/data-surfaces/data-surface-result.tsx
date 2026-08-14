import type { OverviewReadModelV1 } from '@public-operations-observatory/contracts';
import { ErrorState } from '@public-operations-observatory/ui';
import type { ComponentType } from 'react';

import type { OverviewApiResult } from '../../lib/api';

export function DataSurfaceResult({
  result,
  surface: Surface,
  eyebrow,
  heading,
}: {
  result: OverviewApiResult;
  surface: ComponentType<{ overview: OverviewReadModelV1 }>;
  eyebrow: string;
  heading: string;
}) {
  return result.ok ? (
    <Surface overview={result.data} />
  ) : (
    <div className="data-surface">
      <header className="data-surface-header">
        <div className="data-surface-header__copy">
          <p className="data-surface-eyebrow">{eyebrow}</p>
          <h1>{heading}</h1>
          <p>The requested operating view could not be assembled from the Overview API.</p>
        </div>
      </header>
      <ErrorState
        title="Overview unavailable"
        available="Application navigation and project context"
        retry="Retry after API connectivity and authentication are restored."
      >
        {result.message}
      </ErrorState>
    </div>
  );
}
