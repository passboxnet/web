#!/bin/sh
# Creates an empty PostgreSQL database for one e2e test server (dropping an
# old one of the same name) and provisions the Passbox roles in it.
# PASSBOX_E2E_DATABASE_URL is a superuser connection, for example
# postgres://postgres:postgres@localhost:5432/postgres. Needs psql.
set -eu
: "${PASSBOX_E2E_DATABASE_URL:?set PASSBOX_E2E_DATABASE_URL to a PostgreSQL superuser URL (see CONTRIBUTING.md)}"
PASSBOX_TEST_DATABASE_URL="$PASSBOX_E2E_DATABASE_URL" \
  exec sh "$(dirname "$0")/../scripts/test-database.sh" create "$1"
