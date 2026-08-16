import type { OverviewTrendPointV1 } from '@public-operations-observatory/contracts';
import { Table } from '@public-operations-observatory/ui';
import type { ObservatoryTimezone } from '../../lib/timezone';
import { useTimezone } from '../timezone/timezone-provider';

const formatDate = (value: string, timeZone: ObservatoryTimezone): string =>
  new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeZone }).format(new Date(value));

export function TrendDataTable({
  points,
  label,
  unit,
}: {
  points: OverviewTrendPointV1[];
  label: string;
  unit: string;
}) {
  const { timezone } = useTimezone();
  return (
    <Table aria-label={`${label} data`}>
      <caption className="sr-only">
        {label} by interval, measured in {unit}
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
            <th scope="row">{formatDate(point.timestamp, timezone)}</th>
            <td>{point.value ?? 'Unavailable'}</td>
            <td>{point.availability}</td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}
