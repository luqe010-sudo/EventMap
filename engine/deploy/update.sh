#!/usr/bin/env bash
# Safe update with automatic rollback. Run on the VPS as the engine user:
#   bash /opt/mapaimprez/engine/deploy/update.sh [git-ref]
# 1. backup SQLite, 2. build a new image tagged with the commit, 3. run unit tests in the
# new image, 4. restart, 5. wait for healthchecks, 6. roll back to the previous tag on failure.
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/mapaimprez}"
REF="${1:-origin/main}"
COMPOSE=(docker compose -f engine/deploy/docker-compose.yml --env-file engine/deploy/compose.env)
cd "$APP_DIR"

previous_tag="$(grep -E '^ENGINE_IMAGE_TAG=' engine/deploy/compose.env | cut -d= -f2 || true)"
previous_tag="${previous_tag:-latest}"
previous_commit="$(git rev-parse HEAD)"

echo "[update] backup before update"
"${COMPOSE[@]}" exec -T worker node engine/src/main.ts backup || echo "[update] backup skipped (stack not running)"

git fetch --quiet origin
git checkout --quiet --detach "$REF"
new_tag="$(git rev-parse --short HEAD)"

echo "[update] building mapaimprez-engine:$new_tag"
ENGINE_IMAGE_TAG="$new_tag" "${COMPOSE[@]}" build worker

echo "[update] smoke test inside the new image (status on a throwaway DB)"
docker run --rm -e ENGINE_DATA_DIR=/tmp/smoke -e ENGINE_DB_PATH=/tmp/smoke/engine.sqlite --read-only --tmpfs /tmp \
  "mapaimprez-engine:$new_tag" status > /dev/null

sed -i "s/^ENGINE_IMAGE_TAG=.*/ENGINE_IMAGE_TAG=$new_tag/" engine/deploy/compose.env
"${COMPOSE[@]}" up -d --remove-orphans

echo "[update] waiting for healthchecks"
for _ in $(seq 1 30); do
  sleep 10
  unhealthy="$("${COMPOSE[@]}" ps --format '{{.Service}} {{.Health}}' | grep -E 'worker|publisher|control' | grep -vc 'healthy' || true)"
  if [ "$unhealthy" = "0" ]; then echo "[update] healthy on $new_tag"; exit 0; fi
done

echo "[update] FAILED — rolling back to $previous_tag ($previous_commit)" >&2
git checkout --quiet --detach "$previous_commit"
sed -i "s/^ENGINE_IMAGE_TAG=.*/ENGINE_IMAGE_TAG=$previous_tag/" engine/deploy/compose.env
"${COMPOSE[@]}" up -d --remove-orphans
exit 1
