#!/usr/bin/env bash
# Regenerate both models from the committed tables and push them, retrying against the branch tip.
#
# Both are pure functions of what is already in `data/curated`, which makes the conflict story
# simpler than the ingest's: there is nothing staged to replay, so a rejected push is resolved by
# resetting to the new tip and modelling again. The second run sees whatever rows the other job
# landed and produces the documents that tip deserves, rather than merging two that were computed
# from different data.
#
# That is also why this runs *after* the ingest has pushed: the models should stand on the day
# that just landed, not on yesterday's.
#
# `publish:api` runs again at the end, and has to. `apply-and-push.sh` wrote `latest.json` before
# the adequacy model existed for today, so the copy it committed carries yesterday's risk tier;
# rebuilding it here is what keeps the page's headline and `adequacy.json` from disagreeing for a
# day. It is cheap and it is a pure function of the same tables, so running it twice costs a
# second and buys the guarantee.
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

  # A modelling failure must not be papered over: leave the previous documents committed and
  # exit non-zero so the step is visibly red, rather than pushing a half-written one.
  if ! npm run forecast 2>&1 | tee -a "$LOG"; then
    echo "Forecast failed; the previously committed forecast is left in place."
    exit 1
  fi

  if ! npm run adequacy 2>&1 | tee -a "$LOG"; then
    echo "Adequacy failed; the previously committed adequacy document is left in place."
    exit 1
  fi

  # Only now can latest.json carry today's risk tier; see the note at the top.
  if ! npm run publish:api 2>&1 | tee -a "$LOG"; then
    echo "latest.json could not be rebuilt; the copy apply-and-push.sh committed is left in place."
    exit 1
  fi

  git add data/curated/forecast_runs data/curated/forecast_values data/curated/adequacy_runs \
    data/curated/adequacy_values data/reports public/api
  if git diff --cached --quiet; then
    echo "Models unchanged."
    exit 0
  fi

  git commit -m "$MESSAGE"
  if git push origin "HEAD:$BRANCH"; then
    echo "Pushed on attempt $attempt."
    exit 0
  fi

  echo "Push rejected (attempt $attempt); another run got there first. Re-modelling onto the new tip."
  sleep $((attempt * 5))
done

echo "Could not push after $ATTEMPTS attempts."
exit 1
