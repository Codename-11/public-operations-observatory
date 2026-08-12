import type { OverviewTrendPointV1 } from '@public-operations-observatory/contracts';
import { Table } from '@public-operations-observatory/ui';

const formatDate = (value: string): string =>
  new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeZone: 'UTC' }).format(
    new Date(value),
  );

export function TrendDataTable({
  points,
  label,
  unit,
}: {
  points: OverviewTrendPointV1[];
  label: string;
  unit: string;
}) {
  return (
    <Table aria-label={`${label} data`}>
      <caption className="sr-only">
        {label} by UTC interval, measured in {unit}
      </caption>
      <thead>
        <tr>
          <th scope="col">Interval</th>
          <th scope="col">{unit}</th>
          <th scope="col">Availability</th>
        </tr>
      </thead>
      <tbody>
        {points.map((point) => (
          <tr key={point.timestamp}>
            <th scope="row">{formatDate(point.timestamp)}</th>
            <td>{point.value ?? 'Unavailable'}</td>
            <td>{point.availability}</td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}
