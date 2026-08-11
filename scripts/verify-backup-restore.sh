#!/usr/bin/env bash
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL is required}"
: "${OBSERVATORY_RESTORE_DATABASE_URL:?OBSERVATORY_RESTORE_DATABASE_URL is required and must identify a disposable database}"
: "${OBSERVATORY_BACKUP_TEST_DIR:?OBSERVATORY_BACKUP_TEST_DIR is required}"

if [[ "$DATABASE_URL" == "$OBSERVATORY_RESTORE_DATABASE_URL" ]]; then
  printf 'Source and restore database URLs must differ.\n' >&2
  exit 1
fi

mkdir -p "$OBSERVATORY_BACKUP_TEST_DIR"
dump_path="$OBSERVATORY_BACKUP_TEST_DIR/observatory-restore-test.dump"
restore_database_name=$(python3 -c 'import sys; from urllib.parse import unquote, urlparse; print(unquote(urlparse(sys.argv[1]).path.lstrip("/")))' "$OBSERVATORY_RESTORE_DATABASE_URL")
if [[ -z "$restore_database_name" ]]; then
  printf 'OBSERVATORY_RESTORE_DATABASE_URL must include a database name.\n' >&2
  exit 1
fi
drop_restore_database() {
  printf "SELECT format('DROP DATABASE IF EXISTS %%I WITH (FORCE)', :'dbname') \\gexec\n" |
    psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -v dbname="$restore_database_name" >/dev/null
}
cleanup() {
  drop_restore_database >/dev/null 2>&1 || true
}
trap cleanup EXIT

pg_dump --format=custom --file="$dump_path" "$DATABASE_URL"
drop_restore_database
printf "SELECT format('CREATE DATABASE %%I', :'dbname') \\gexec\n" |
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -v dbname="$restore_database_name" >/dev/null
pg_restore --no-owner --dbname="$OBSERVATORY_RESTORE_DATABASE_URL" "$dump_path"

source_migrations=$(psql "$DATABASE_URL" -Atc 'SELECT count(*) FROM schema_migrations')
restored_migrations=$(psql "$OBSERVATORY_RESTORE_DATABASE_URL" -Atc 'SELECT count(*) FROM schema_migrations')
source_observations=$(psql "$DATABASE_URL" -Atc 'SELECT count(*) FROM observations')
restored_observations=$(psql "$OBSERVATORY_RESTORE_DATABASE_URL" -Atc 'SELECT count(*) FROM observations')
source_normalized=$(psql "$DATABASE_URL" -Atc 'SELECT count(*) FROM normalized_records')
restored_normalized=$(psql "$OBSERVATORY_RESTORE_DATABASE_URL" -Atc 'SELECT count(*) FROM normalized_records')

[[ "$source_migrations" == "$restored_migrations" ]]
[[ "$source_observations" == "$restored_observations" ]]
[[ "$source_normalized" == "$restored_normalized" ]]
printf 'Restore verified: migrations=%s observations=%s normalized_records=%s\n' \
  "$restored_migrations" "$restored_observations" "$restored_normalized"
