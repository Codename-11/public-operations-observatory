export function latestCompletedUtcWeekEnd(now: Date): Date {
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const daysSinceMonday = (end.getUTCDay() + 6) % 7;
  end.setUTCDate(end.getUTCDate() - daysSinceMonday);
  return end;
}
