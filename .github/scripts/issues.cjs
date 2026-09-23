/* global module */
// One tracking issue per failure mode, opened or updated when it happens and closed when the
// same workflow next goes green. Required from actions/github-script steps:
//
//   const issues = require('./.github/scripts/issues.cjs');
//   await issues.report({ github, context }, { label, title, body });   // open, or comment on the open one
//   await issues.resolve({ github, context }, { label, body });         // close every open one
//
// A label names the failure mode (`ingest-failure`, `model-failure`, `stale-feed`, ...), so a
// failure that repeats for a week is one issue with seven comments rather than seven issues,
// and "is anything broken" is one label filter away.

const runUrl = (context) => `${context.serverUrl}/${context.repo.owner}/${context.repo.repo}/actions/runs/${context.runId}`;

async function openIssues({ github, context }, label) {
  const { data } = await github.rest.issues.listForRepo({
    owner: context.repo.owner,
    repo: context.repo.repo,
    state: 'open',
    labels: label,
    per_page: 100,
  });
  // The endpoint also lists pull requests; only issues are ours.
  return data.filter((issue) => !issue.pull_request);
}

async function report({ github, context }, { label, title, body }) {
  const text = `${body}\n\nRun: ${runUrl(context)}`;
  const existing = await openIssues({ github, context }, label);
  if (existing.length > 0) {
    await github.rest.issues.createComment({
      owner: context.repo.owner,
      repo: context.repo.repo,
      issue_number: existing[0].number,
      body: text,
    });
    return existing[0].number;
  }
  const { data } = await github.rest.issues.create({
    owner: context.repo.owner,
    repo: context.repo.repo,
    title,
    body: text,
    labels: [label],
  });
  return data.number;
}

async function resolve({ github, context }, { label, body }) {
  for (const issue of await openIssues({ github, context }, label)) {
    await github.rest.issues.createComment({
      owner: context.repo.owner,
      repo: context.repo.repo,
      issue_number: issue.number,
      body: `${body ?? 'Resolved: a later run of the same workflow succeeded.'}\n\nRun: ${runUrl(context)}`,
    });
    await github.rest.issues.update({
      owner: context.repo.owner,
      repo: context.repo.repo,
      issue_number: issue.number,
      state: 'closed',
      state_reason: 'completed',
    });
  }
}

module.exports = { report, resolve };
