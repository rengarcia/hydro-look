# shellcheck shell=bash
# Sourced, not run: the reset-regenerate-commit-push loop shared by the steps that write
# documents derived from what is already committed.
#
#   push_with_retry MESSAGE REGENERATE PATH...
#
# Each attempt resets to the branch tip, calls the shell function REGENERATE, stages PATH...,
# and pushes. A rejected push means another run landed first, so the next attempt starts from
# that newer tip and regenerates on top of it rather than merging two outputs computed from
# different data. REGENERATE returning non-zero stops the loop with nothing pushed.
#
# REGENERATE has to be cheap to repeat. The models are (they read the tables and touch no
# network); the narrative is not, which is why narrative-and-push.sh makes its one gateway call
# before the loop and only *applies* the staged result inside it.
#
# Expects BRANCH, and optionally ATTEMPTS (default 5) and LABEL (for the "unchanged" line).

push_with_retry() {
  local message="$1" regenerate="$2"
  shift 2

  git config user.name "github-actions[bot]"
  git config user.email "41898282+github-actions[bot]@users.noreply.github.com"

  local attempt path
  for attempt in $(seq 1 "${ATTEMPTS:-5}"); do
    git fetch origin "$BRANCH"
    git reset --hard "origin/$BRANCH"

    "$regenerate" || return 1

    # A path that does not exist yet (the first narrative snapshot, say) is skipped rather than
    # handed to `git add`, which would refuse the whole command over it.
    for path in "$@"; do
      if [ -e "$path" ]; then git add -- "$path"; fi
    done
    if git diff --cached --quiet; then
      echo "${LABEL:-Output} unchanged."
      return 0
    fi

    git commit -m "$message"
    if git push origin "HEAD:$BRANCH"; then
      echo "Pushed on attempt $attempt."
      return 0
    fi

    echo "Push rejected (attempt $attempt); another run got there first. Regenerating onto the new tip."
    sleep $((attempt * 5))
  done

  echo "Could not push after ${ATTEMPTS:-5} attempts."
  return 1
}
