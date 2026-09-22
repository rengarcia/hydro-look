#!/usr/bin/env bash
# Merge a staged ingest run into data/ and push it, retrying against the branch tip.
#
# The curated tables and raw bundles are generated files that several runs write at once (a
# daily ingest and a backfill can finish seconds apart). Rebasing one run's commit onto the
# other's produces an add/add conflict in files nobody edited by hand, so instead each attempt
# resets to the tip and re-applies the staged batch: `ingest apply` is an upsert, so applying
# the same batch to newer data is always correct and never loses the other run's rows.
set -euo pipefail

MESSAGE="${1:?commit message required}"
BRANCH="${BRANCH:?BRANCH required}"
BATCH_DIR="${BATCH_DIR:?BATCH_DIR required}"
ATTEMPTS="${ATTEMPTS:-5}"

if [ ! -f "$BATCH_DIR/batch.json" ]; then
  echo "No staged batch at $BATCH_DIR; the ingest step produced nothing to commit."
  exit 0
fi

git config user.name "github-actions[bot]"
git config user.email "41898282+github-actions[bot]@users.noreply.github.com"

for attempt in $(seq 1 "$ATTEMPTS"); do
  git fetch origin "$BRANCH"
  git reset --hard "origin/$BRANCH"

  npm run ingest -- apply --in "$BATCH_DIR" || APPLY_FAILED=1

  # Refresh the public status document from what was just written. It reports freshness even
  # when the gate does not, because the site's job is to show how old the data is. A failing
  # check does not abort the commit: the rows are already fetched and archived, and losing them
  # would help nobody -- the failure is recorded in the document and in the step's exit code.
  npm run check -- --freshness --out public/api/status.json || CHECK_FAILED=1

  git add data
  if [ -d public ]; then git add public; fi
  if git diff --cached --quiet; then
    echo "No data changes."
    exit $(( ${APPLY_FAILED:-0} | ${CHECK_FAILED:-0} ))
  fi

  git commit -m "$MESSAGE"
  if git push origin "HEAD:$BRANCH"; then
    echo "Pushed on attempt $attempt."
    if [ -n "${CHECK_FAILED:-}" ]; then echo "Quality checks failed; see public/api/status.json."; fi
    exit $(( ${APPLY_FAILED:-0} | ${CHECK_FAILED:-0} ))
  fi

  echo "Push rejected (attempt $attempt); another run got there first. Re-applying onto the new tip."
  sleep $((attempt * 5))
done

echo "Could not push after $ATTEMPTS attempts."
exit 1
