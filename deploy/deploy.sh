#!/usr/bin/env bash
#
# Global Market League -- one deploy.
#
#     sudo /opt/GMCL-Evert/deploy/deploy.sh
#
# Fetches, rebuilds and restarts. Everything here is safe to run twice, and it
# stops on the first failure rather than restarting a service over a build
# that did not finish.
#
# It does not touch .env, nginx's config, or the database. Those change rarely
# and by hand; this is the part that changes every time.

set -Eeuo pipefail

REPO=${REPO:-/opt/GMCL-Evert}
BRANCH=${BRANCH:-main}
SERVICE=${SERVICE:-gmcl-api}
OWNER=${OWNER:-root}

cd "$REPO"

echo "==> was: $(git rev-parse --short HEAD) on $(git rev-parse --abbrev-ref HEAD)"

# Hard reset rather than pull. A server is not a place to resolve a merge, and
# anything committed here that is not on the remote is not deployable anyway.
# It is reported first so an accident is visible before it is discarded.
git fetch --prune origin
if ! git diff --quiet || ! git diff --cached --quiet; then
    echo "!!  uncommitted changes in $REPO -- they are about to be discarded:"
    git status --short
fi
git checkout -B "$BRANCH" "origin/$BRANCH"
git reset --hard "origin/$BRANCH"

echo "==> now: $(git rev-parse --short HEAD) on $BRANCH"

# The frontend. `npm ci` and not `npm install`: the lockfile is the input, and
# a deploy is not the place to discover a new minor version of anything.
npm ci
npm run build

# The API.
[ -d .venv ] || python3 -m venv .venv
.venv/bin/pip install --quiet --upgrade pip
.venv/bin/pip install --quiet -r requirements.txt

# A fresh build is owned by whoever ran this. nginx reads dist/, uvicorn reads
# the rest. OWNER is root today because that is what the service runs as; see
# deploy/gmcl-api.service for moving it to its own user.
chown -R "$OWNER:$OWNER" "$REPO"
chmod 600 "$REPO/.env"

# This box hosts several sites. Reloading nginx below touches all of them, so
# a config error anywhere is this deploy's problem -- which is what `nginx -t`
# at the end is for, before the reload rather than after it.

systemctl restart "$SERVICE"

# Restart returns as soon as the process is spawned, so this asks the thing
# itself rather than trusting that. A worker that cannot reach Postgres dies a
# moment after starting, and that must fail the deploy rather than pass it.
#
# 401 is the pass here: /api/me without a cookie is unauthenticated, which is
# an answer. Anything 5xx, or nothing at all, is not.
code=000
for _ in $(seq 1 20); do
    code=$(curl -sS -o /dev/null -w '%{http_code}' http://127.0.0.1:8011/api/me 2>/dev/null || echo 000)
    [[ $code =~ ^[24] ]] && break
    sleep 0.5
done

if ! [[ $code =~ ^[24] ]]; then
    echo "!!  API did not come up (HTTP $code). Last lines:"
    journalctl -u "$SERVICE" -n 30 --no-pager
    exit 1
fi
echo "==> api answering ($code on /api/me)"

nginx -t
systemctl reload nginx

echo "==> deployed $(git rev-parse --short HEAD)"
