#!/usr/bin/env bash
set -euo pipefail

role=$(id -un)
dev=${LEDGER_DB:-freelanceledger}
test_db=${LEDGER_TEST_DB:-freelanceledger_test}
port=${PGPORT:-5432}
socket=/var/run/postgresql

if [[ "$role" == root || "$role" == postgres ]]; then
  echo 'Run as your regular Ubuntu user with sudo access.' >&2
  exit 1
fi
for database in "$dev" "$test_db"; do
  if [[ ! "$database" =~ ^[a-z][a-z0-9_]{0,62}$ || "$database" =~ ^(postgres|template0|template1)$ ]]; then
    echo 'Choose a valid application database name.' >&2
    exit 1
  fi
done
if [[ "$dev" == "$test_db" ]]; then
  echo 'Choose distinct development and test databases.' >&2
  exit 1
fi

sudo service postgresql start
sudo -u postgres psql -X -w -h "$socket" -p "$port" -d postgres \
  -v ON_ERROR_STOP=1 -v role="$role" -v dev="$dev" -v test_db="$test_db" <<'SQL'
SELECT pg_advisory_lock(48392101);
SELECT format('CREATE ROLE %I LOGIN', :'role')
WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = :'role')
\gexec
SELECT format('CREATE DATABASE %I OWNER %I', name, :'role')
FROM (VALUES (:'dev'), (:'test_db')) AS requested(name)
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = name)
\gexec
SELECT count(*) = 2 AS owned
FROM pg_database
WHERE datname IN (:'dev', :'test_db') AND pg_get_userbyid(datdba) = :'role'
\gset
\if :owned
\else
  DO $$ BEGIN RAISE EXCEPTION 'An existing database has a different owner.'; END $$;
\endif
SQL
for database in "$dev" "$test_db"; do
  psql -X -w -h "$socket" -p "$port" -U "$role" -d "$database" -Atc 'SELECT current_database()'
done
