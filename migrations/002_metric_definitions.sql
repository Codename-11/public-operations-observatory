CREATE TABLE IF NOT EXISTS metric_definitions (
  metric_key text NOT NULL,
  version integer NOT NULL CHECK (version > 0),
  source_kind text NOT NULL,
  value_path text NOT NULL,
  unit text NOT NULL,
  aggregation text NOT NULL,
  description text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (metric_key, version)
);

INSERT INTO metric_definitions
  (metric_key, version, source_kind, value_path, unit, aggregation, description)
VALUES
  ('github.stars', 1, 'repository.summary', 'stars', 'count', 'latest', 'Current repository star count.'),
  ('github.forks', 1, 'repository.summary', 'forks', 'count', 'latest', 'Current repository fork count.'),
  ('github.views', 1, 'traffic.views', 'count', 'count', 'sum_window', 'Page views reported by GitHub during the briefing window.'),
  ('github.unique_views', 1, 'traffic.views', 'uniques', 'count', 'sum_window', 'Daily unique page views summed over the briefing window; not deduplicated across days.'),
  ('github.clones', 1, 'traffic.clones', 'count', 'count', 'sum_window', 'Repository clones reported by GitHub during the briefing window.'),
  ('github.open_issues', 1, 'issues.summary', 'open', 'count', 'latest', 'Open issue count excluding pull requests.'),
  ('github.open_pulls', 1, 'pulls.summary', 'open', 'count', 'latest', 'Open pull request count.'),
  ('github.workflow_runs', 1, 'workflows.summary', 'totalRuns', 'count', 'latest', 'All-time GitHub Actions workflow run count.'),
  ('github.release_asset_downloads', 1, 'release.summary', 'totalAssetDownloads', 'count', 'latest_per_release', 'Cumulative public release-asset downloads at collection time.')
ON CONFLICT DO NOTHING;
