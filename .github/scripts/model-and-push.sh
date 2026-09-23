#!/usr/bin/env bash
# Regenerate both models from the committed tables and push them, retrying against the branch tip.
#
# Both are pure functions of what is already in `data/curated`, which makes the conflict story
# simpler than the ingest's: there is nothing staged to replay, so a rejected push is resolved by
# resetting to the new tip and modelling again. The second run sees whatever rows the other job
# landed and produces the documents that tip deserves, rather than merging two that were computed
# from different data. The loop itself lives in push-loop.sh, shared with the narrative step.
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
LABEL="Models"

# shellcheck source=SCRIPTDIR/push-loop.sh
source "$(dirname "$0")/push-loop.sh"

# A modelling failure must not be papered over: leave the previous documents committed and
# return non-zero so the step is visibly red, rather than pushing a half-written one.
regenerate_models() {
  if ! npm run forecast 2>&1 | tee -a "$LOG"; then
    echo "Forecast failed; the previously committed forecast is left in place."
    return 1
  fi

  # The 7-day point is M4's only while the committed M4 backtest covers exactly the ladder's
  # origins, and the ladder gains one a week into every month. When that is the *only* reason
  # the switch fell back, rerun the backtest (~6.5 min, once a month) and forecast again. Any
  # other reason -- settings changed, M4 no longer winning -- is left as a fallback for a person
  # to read in forecast.json's `horizon_switch`, never refreshed away.
  if node -e '
    const s = require("./public/api/forecast.json").horizon_switch;
    process.exit(s && s.status === "fallback" && /no longer covers the ladder/.test(s.reason) ? 0 : 1);
  '; then
    echo "M4 backtest is behind the ladder; rerunning it before forecasting again."
    if npm run backtest:m4 2>&1 | tee -a "$LOG" && npm run forecast 2>&1 | tee -a "$LOG"; then
      :
    else
      echo "M4 refresh failed; the forecast above, with seven days on M3, is what gets committed."
    fi
  fi

  if ! npm run adequacy 2>&1 | tee -a "$LOG"; then
    echo "Adequacy failed; the previously committed adequacy document is left in place."
    return 1
  fi
  npm run score 2>&1 | tee -a "$LOG" || echo "Scorecard failed; the scorecard blocks the models just wrote are left in place."

  # Only now can latest.json carry today's risk tier; see the note at the top.
  if ! npm run publish:api 2>&1 | tee -a "$LOG"; then
    echo "latest.json could not be rebuilt; the copy apply-and-push.sh committed is left in place."
    return 1
  fi
}

push_with_retry "$MESSAGE" regenerate_models \
  data/curated/forecast_runs data/curated/forecast_values data/curated/adequacy_runs \
  data/curated/adequacy_values data/reports public/api
