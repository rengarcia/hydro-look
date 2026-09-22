#!/usr/bin/env bash
# Regenerate the forecast from the committed tables and push it, retrying against the branch tip.
#
# The forecast is a pure function of what is already in `data/curated`, which makes the conflict
# story simpler than the ingest's: there is nothing staged to replay, so a rejected push is
# resolved by resetting to the new tip and forecasting again. The second run sees whatever rows
# the other job landed and produces the forecast that tip deserves, rather than merging two
# documents that were computed from different data.
#
# That is also why the forecast runs *after* the ingest has pushed: it should stand on the day
# that just landed, not on yesterday's.
set -euo pipefail

MESSAGE="${1:?commit message required}"
BRANCH="${BRANCH:?BRANCH required}"
LOG="${LOG:-/dev/null}"
ATTEMPTS="${ATTEMPTS:-5}"

git config user.name "github-actions[bot]"
git config user.email "41898282+github-actions[bot]@users.noreply.github.com"

for attempt in $(seq 1 "$ATTEMPTS"); do
  git fetch origin "$BRANCH"
  git reset --hard "origin/$BRANCH"

  # A modelling failure must not be papered over: leave the previous forecast committed and
  # exit non-zero so the step is visibly red, rather than pushing a half-written document.
  if ! npm run forecast 2>&1 | tee -a "$LOG"; then
    echo "Forecast failed; the previously committed forecast is left in place."
    exit 1
  fi

  git add data/curated/forecast_runs data/curated/forecast_values data/reports public/api/forecast.json
  if git diff --cached --quiet; then
    echo "Forecast unchanged."
    exit 0
  fi

  git commit -m "$MESSAGE"
  if git push origin "HEAD:$BRANCH"; then
    echo "Pushed on attempt $attempt."
    exit 0
  fi

  echo "Push rejected (attempt $attempt); another run got there first. Re-forecasting onto the new tip."
  sleep $((attempt * 5))
done

echo "Could not push after $ATTEMPTS attempts."
exit 1
