#!/bin/sh
# Apply migrations and demo seed, then start the API.
set -e
alembic upgrade head
if [ "${SEED_DEMO_DATA:-true}" = "true" ]; then
  python -m app.db.seed
fi
exec "$@"
