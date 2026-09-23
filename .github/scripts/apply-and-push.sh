#!/usr/bin/env bash
# Merge a staged ingest run into data/ and push it, retrying against the branch tip.
#
# The curated tables and raw files are generated files that several runs write at once (a
# daily ingest and a backfill can finish seconds apart). Rebasing one run's commit onto the
# other's produces an add/add conflict in files nobody edited by hand, so instead each attempt
# resets to the tip and re-applies the staged batch: `ingest apply` is an upsert, so applying
# the same batch to newer data is always correct and never loses the other run's rows.
#
# The batch arrives as a workflow artifact uploaded by the fetch job before this runs, so a
# batch this script fails to land is still downloadable and can be replayed by hand with
# `npm run ingest -- apply --in <dir>` (see the README).
#
# A run that found nothing new commits nothing: when the only lines that changed are
# `generated_at` stamps, the attempt is discarded instead of committed, so `git log` answers
# "did this run find anything".
#
# Env: BRANCH, BATCH_DIR; optionally ATTEMPTS (default 5), SUMMARY (a file for the Markdown run
# summary, appended to $GITHUB_STEP_SUMMARY when the script exits).
set -euo pipefail

MESSAGE="${1:?commit message required}"
BRANCH="${BRANCH:?BRANCH required}"
BATCH_DIR="${BATCH_DIR:?BATCH_DIR required}"
ATTEMPTS="${ATTEMPTS:-5}"
SUMMARY="${SUMMARY:-}"

if [ ! -f "$BATCH_DIR/batch.json" ]; then
  echo "No staged batch at $BATCH_DIR; the ingest step produced nothing to commit."
  exit 0
fi

# shellcheck disable=SC2317  # invoked by the EXIT trap
publish_summary() {
  if [ -n "$SUMMARY" ] && [ -f "$SUMMARY" ] && [ -n "${GITHUB_STEP_SUMMARY:-}" ]; then
    cat "$SUMMARY" >> "$GITHUB_STEP_SUMMARY"
  fi
}
trap publish_summary EXIT

# Whether the staged changes hold anything but `generated_at` stamps. `grep -c` reads all of its
# input, so no stage of the pipe dies of SIGPIPE and fails it under pipefail.
has_real_changes() {
  local changed
  changed=$(git diff --cached -U0 --no-color \
    | grep -E '^[+-]' \
    | grep -vE '^(\+\+\+|---) ' \
    | grep -vcE '^[+-][[:space:]]*"generated_at": ' || true)
  [ "${changed:-0}" -gt 0 ]
}

git config user.name "github-actions[bot]"
git config user.email "41898282+github-actions[bot]@users.noreply.github.com"

for attempt in $(seq 1 "$ATTEMPTS"); do
  # A failed fetch is a failed attempt, not the end of the script: under `set -e` it used to
  # abort with the batch unapplied.
  if ! git fetch origin "$BRANCH"; then
    echo "Fetch failed (attempt $attempt); trying again."
    sleep $((attempt * 5))
    continue
  fi
  git reset --hard "origin/$BRANCH"

  APPLY_FAILED=0
  CHECK_FAILED=0
  PUBLISH_FAILED=0
  npm run ingest -- apply --in "$BATCH_DIR" ${SUMMARY:+--summary "$SUMMARY"} || APPLY_FAILED=1

  # Refresh the public status document from what was just written. It reports freshness even
  # when the gate does not, because the site's job is to show how old the data is. A failing
  # check does not abort the commit: the rows are already fetched and archived, and losing them
  # would help nobody -- the failure is recorded in the document and in the step's exit code.
  npm run check -- --freshness --out public/api/status.json || CHECK_FAILED=1

  # And the current-state document the site's tiles read. Like the status document it is a pure
  # function of what was just written, so it belongs in this loop rather than in a later step:
  # a run that lands rows and leaves latest.json describing yesterday would have the page and
  # the tables disagreeing until the next ingest. Same reasoning on failure -- record it in the
  # exit code, do not throw away rows that are already fetched and archived.
  npm run publish:api || PUBLISH_FAILED=1

  git add data
  if [ -d public ]; then git add public; fi
  if ! has_real_changes; then
    echo "No data changes."
    git reset -q --hard "origin/$BRANCH"
    exit $(( APPLY_FAILED | CHECK_FAILED | PUBLISH_FAILED ))
  fi

  git commit -m "$MESSAGE"
  if git push origin "HEAD:$BRANCH"; then
    echo "Pushed on attempt $attempt."
    if [ "$CHECK_FAILED" -ne 0 ]; then echo "Quality checks failed; see public/api/status.json."; fi
    if [ "$PUBLISH_FAILED" -ne 0 ]; then echo "latest.json could not be built; the previous one is left in place."; fi
    exit $(( APPLY_FAILED | CHECK_FAILED | PUBLISH_FAILED ))
  fi

  echo "Push rejected (attempt $attempt); another run got there first. Re-applying onto the new tip."
  sleep $((attempt * 5))
done

echo "Could not push after $ATTEMPTS attempts. The batch is still in this run's artifacts; see the README to replay it."
exit 1
