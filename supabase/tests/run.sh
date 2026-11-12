#!/usr/bin/env bash
# Lokale Tests des Supabase-Schemas mit reinem Postgres 16.
#   supabase/tests/run.sh
# Startet bei Bedarf einen eigenen Cluster (Standard: /tmp/claude-0/pg, Port 54329),
# legt eine frische Datenbank an, spielt Stub + Migrationen + Tests ein.
# Exit-Code ≠ 0, sobald ein Test fehlschlägt.
set -euo pipefail

HIER="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MIGRATIONEN="$(cd "$HIER/../migrations" && pwd)"
PGBIN="${PGBIN:-/usr/lib/postgresql/16/bin}"
PGDATA_DIR="${PGTEST_DIR:-/tmp/claude-0/pg}"
PORT="${PGTEST_PORT:-54329}"
DB="bos_test"

# Postgres läuft nicht als root -> Befehle ggf. als Benutzer "postgres" ausführen
if [ "$(id -u)" = "0" ]; then
  PGUSER_OS="${PGTEST_OS_USER:-postgres}"
  als() { su "$PGUSER_OS" -s /bin/bash -c "$(printf '%q ' "$@")"; }
  # Elternverzeichnisse müssen für den postgres-Benutzer durchquerbar sein
  d="$(dirname "$PGDATA_DIR")"
  mkdir -p "$d"
  while [ "$d" != "/" ]; do
    if ! su "$PGUSER_OS" -s /bin/bash -c "test -x '$d'"; then chmod o+x "$d"; fi
    d="$(dirname "$d")"
  done
else
  als() { "$@"; }
fi

if [ ! -f "$PGDATA_DIR/PG_VERSION" ]; then
  echo "» initdb $PGDATA_DIR"
  if [ "$(id -u)" = "0" ]; then mkdir -p "$PGDATA_DIR" && chown "$PGUSER_OS" "$PGDATA_DIR"; fi
  als "$PGBIN/initdb" -D "$PGDATA_DIR" -U postgres -A trust -E UTF8 --locale=C.UTF-8 >/dev/null
fi

if ! als "$PGBIN/pg_ctl" -D "$PGDATA_DIR" status >/dev/null 2>&1; then
  echo "» starte Postgres auf Port $PORT"
  als "$PGBIN/pg_ctl" -D "$PGDATA_DIR" -l "$PGDATA_DIR/server.log" -w \
    -o "-p $PORT -k $PGDATA_DIR -c listen_addresses=''" start >/dev/null
fi

PSQL=("$PGBIN/psql" -h "$PGDATA_DIR" -p "$PORT" -U postgres -X -q -v ON_ERROR_STOP=1)

als "${PSQL[@]}" -d postgres -c "drop database if exists $DB" -c "create database $DB" >/dev/null

# Dateien als Standardeingabe übergeben (der postgres-Benutzer darf das Repo evtl. nicht lesen)
lauf() { local f="$1"; echo "» $(basename "$f")"; als "${PSQL[@]}" -d "$DB" < "$f"; }

lauf "$HIER/supabase_stub.sql"
for f in "$MIGRATIONEN"/*.sql; do lauf "$f"; done
lauf "$HIER/00_helpers.sql"

status=0
for f in "$HIER"/[1-9]*_*.sql; do
  echo "» $(basename "$f")"
  if ! als "${PSQL[@]}" -d "$DB" -t -A < "$f" 2>&1 | sed -e 's/^psql:[^ ]* NOTICE:  /  /' -e 's/^NOTICE:  /  /' -e '/^$/d' -e '/^[0-9a-f-]\{36\}$/d'; then
    status=1
  fi
done

if [ "$status" = "0" ]; then echo "✔ alle Tests bestanden"; else echo "✘ Tests fehlgeschlagen" >&2; fi
exit "$status"
