#!/bin/sh
# Creates an empty PostgreSQL database for one e2e test server (dropping an
# old one of the same name) and provisions the Passbox roles in it.
# PASSBOX_E2E_DATABASE_URL is a superuser connection, for example
# postgres://postgres:postgres@localhost:5432/postgres. Needs psql.
set -eu
: "${PASSBOX_E2E_DATABASE_URL:?set PASSBOX_E2E_DATABASE_URL to a PostgreSQL superuser URL (see CONTRIBUTING.md)}"
name="$1"
roles="$(dirname "$0")/../crates/server/sql/roles.sql"
psql "$PASSBOX_E2E_DATABASE_URL" -X -q -v ON_ERROR_STOP=1 \
  -c "SET client_min_messages = warning" \
  -c "DROP DATABASE IF EXISTS $name WITH (FORCE)" \
  -c "CREATE DATABASE $name" \
  -c "\\connect $name" \
  -f "$roles" > /dev/null
