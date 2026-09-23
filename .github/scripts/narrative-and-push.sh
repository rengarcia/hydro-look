#!/usr/bin/env bash
# Phase 6b: write the day's narrative over the numbers the models just pushed, and commit it.
#
# Unlike the models, this step costs money per call, so it cannot share their "reset and redo
# everything" answer to a lost push race — a second attempt would pay the gateway twice for one
# paragraph. It borrows the ingest's answer instead: call once, stage the result in a directory,
# and let the retry loop (push-loop.sh) repeat only the cheap part, `narrative apply`, which
# upserts one snapshot row and copies one JSON file onto whatever the tip holds by then.
#
# Everything the script can decide not to do, it decides inside `npm run narrative` and says so
# in the log: no `AI_GATEWAY_API_KEY` (the sandbox, CI, a fork), a payload whose hash and prompt
# match the last answered snapshot, or a rate limit that outlasted its one retry. In each of
# those either nothing is staged, and this exits 0 having pushed nothing, or a `skipped` row is
# staged and committed so the spend log shows the attempt.
#
# Exit status is the narrative command's own — non-zero only for a `failed` attempt — after the
# snapshot row for it has been pushed. The workflow runs this with `continue-on-error`, so a red
# step here never marks an ingest that has already landed as failed.
set -euo pipefail

MESSAGE="${1:?commit message required}"
BRANCH="${BRANCH:?BRANCH required}"
STAGE_DIR="${STAGE_DIR:?STAGE_DIR required}"
LOG="${LOG:-/dev/null}"
LABEL="Narrative"

# shellcheck source=SCRIPTDIR/push-loop.sh
source "$(dirname "$0")/push-loop.sh"

# The step summary gets the call's cost and latency and the spend to date, whichever way the
# script ends. Latency is the wall clock around the one gateway call; the snapshot table records
# tokens and cost but not time.
STARTED_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
LATENCY_MS=""
# shellcheck disable=SC2317  # invoked by the EXIT trap
summarise() {
  if [ -n "${GITHUB_STEP_SUMMARY:-}" ]; then
    npx tsx scripts/narrative-summary.ts --since "$STARTED_AT" ${LATENCY_MS:+--latency-ms "$LATENCY_MS"} >> "$GITHUB_STEP_SUMMARY" || true
  fi
}
trap summarise EXIT

# Stand on the tip the models just pushed, so the payload is built from today's documents and
# the no-op check sees every snapshot already committed.
git fetch origin "$BRANCH"
git reset --hard "origin/$BRANCH"

rm -rf "$STAGE_DIR"
set +e
CALL_START_MS=$(date +%s%3N)
npm run narrative -- --stage "$STAGE_DIR" 2>&1 | tee -a "$LOG"
NARRATIVE_STATUS=${PIPESTATUS[0]}
LATENCY_MS=$(( $(date +%s%3N) - CALL_START_MS ))
set -e

if [ ! -f "$STAGE_DIR/snapshot.json" ]; then
  echo "Nothing staged; nothing to commit."
  exit "$NARRATIVE_STATUS"
fi

# shellcheck disable=SC2317  # invoked by push_with_retry
apply_staged() {
  npm run narrative -- apply --in "$STAGE_DIR" 2>&1 | tee -a "$LOG"
}

push_with_retry "$MESSAGE" apply_staged data/curated/narrative_snapshots public/api/narrative.json
exit "$NARRATIVE_STATUS"
