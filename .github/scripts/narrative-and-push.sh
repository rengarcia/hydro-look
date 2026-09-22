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

# shellcheck source=push-loop.sh
source "$(dirname "$0")/push-loop.sh"

# Stand on the tip the models just pushed, so the payload is built from today's documents and
# the no-op check sees every snapshot already committed.
git fetch origin "$BRANCH"
git reset --hard "origin/$BRANCH"

rm -rf "$STAGE_DIR"
set +e
npm run narrative -- --stage "$STAGE_DIR" 2>&1 | tee -a "$LOG"
NARRATIVE_STATUS=${PIPESTATUS[0]}
set -e

if [ ! -f "$STAGE_DIR/snapshot.json" ]; then
  echo "Nothing staged; nothing to commit."
  exit "$NARRATIVE_STATUS"
fi

apply_staged() {
  npm run narrative -- apply --in "$STAGE_DIR" 2>&1 | tee -a "$LOG"
}

push_with_retry "$MESSAGE" apply_staged data/curated/narrative_snapshots public/api/narrative.json
exit "$NARRATIVE_STATUS"
