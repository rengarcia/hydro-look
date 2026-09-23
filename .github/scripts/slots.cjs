/* global module */
// Did a scheduled workflow actually fire? GitHub drops or delays scheduled runs on busy minutes,
// and a slot that never fires leaves no failed run behind to open an issue from; this is how the
// freshness workflow notices one.
//
//   const slots = require('./.github/scripts/slots.cjs');
//   const crons = slots.dailyCrons(fs.readFileSync('.github/workflows/daily.yml', 'utf8'));
//   const due = slots.lastDueSlot(crons, new Date(), 2 * 3600e3);   // the latest slot at least 2 h old
//   const missed = await slots.missed({ github, context }, 'daily.yml', due);

/** `minute hour * * *` crons from a workflow file, as [minute, hour] pairs. */
function dailyCrons(workflowText) {
  const crons = [];
  for (const match of workflowText.matchAll(/cron:\s*"(\d+) (\d+) \* \* \*"/g)) {
    crons.push([Number(match[1]), Number(match[2])]);
  }
  return crons;
}

/**
 * The most recent slot that is at least `graceMs` old: the one that should have started by now
 * even allowing for GitHub's usual delay. Looks back over today and yesterday (UTC).
 */
function lastDueSlot(crons, now, graceMs) {
  let due = null;
  for (const dayOffset of [0, -1]) {
    for (const [minute, hour] of crons) {
      const slot = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + dayOffset, hour, minute));
      if (slot.getTime() <= now.getTime() - graceMs && (due === null || slot > due)) due = slot;
    }
  }
  return due;
}

/** Whether no scheduled run of `workflow` was created at or after `slot`. */
async function missed({ github, context }, workflow, slot) {
  if (!slot) return false;
  const { data } = await github.rest.actions.listWorkflowRuns({
    owner: context.repo.owner,
    repo: context.repo.repo,
    workflow_id: workflow,
    event: "schedule",
    per_page: 10,
  });
  return !data.workflow_runs.some((run) => new Date(run.created_at) >= slot);
}

module.exports = { dailyCrons, lastDueSlot, missed };
