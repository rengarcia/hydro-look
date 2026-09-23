/**
 * The github-script helpers the workflows require: tracking issues (open once, comment while
 * the failure lasts, close on green) and the missed-slot arithmetic the freshness workflow uses.
 */

import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const scripts = join(import.meta.dirname, "..", ".github", "scripts");
const issues = require(join(scripts, "issues.cjs")) as {
  report: (gh: unknown, opts: { label: string; title: string; body: string }) => Promise<number>;
  resolve: (gh: unknown, opts: { label: string; body?: string }) => Promise<void>;
};
const slots = require(join(scripts, "slots.cjs")) as {
  dailyCrons: (text: string) => [number, number][];
  lastDueSlot: (crons: [number, number][], now: Date, graceMs: number) => Date | null;
  missed: (gh: unknown, workflow: string, slot: Date | null) => Promise<boolean>;
};

/** Just enough of Octokit to hold issues in memory. */
function fakeGithub() {
  const store: { number: number; labels: string[]; state: string; comments: string[]; title: string; pull_request?: object }[] = [
    { number: 1, labels: ["ingest-failure"], state: "open", comments: [], title: "a pull request", pull_request: {} },
  ];
  const rest = {
    issues: {
      listForRepo: async ({ labels, state }: { labels: string; state: string }) => ({
        data: store.filter((i) => i.state === state && i.labels.includes(labels)),
      }),
      create: async ({ title, labels }: { title: string; labels: string[] }) => {
        const issue = { number: store.length + 1, labels, state: "open", comments: [], title };
        store.push(issue);
        return { data: issue };
      },
      createComment: async ({ issue_number, body }: { issue_number: number; body: string }) => {
        store.find((i) => i.number === issue_number)!.comments.push(body);
      },
      update: async ({ issue_number, state }: { issue_number: number; state: string }) => {
        store.find((i) => i.number === issue_number)!.state = state;
      },
    },
  };
  const context = { serverUrl: "https://github.com", repo: { owner: "o", repo: "r" }, runId: 42 };
  return { gh: { github: { rest }, context }, store };
}

describe("tracking issues", () => {
  it("opens one issue per label, comments while it lasts, and closes it on green", async () => {
    const { gh, store } = fakeGithub();
    const first = await issues.report(gh, { label: "ingest-failure", title: "Daily ingest failed", body: "fetch failure" });
    const second = await issues.report(gh, { label: "ingest-failure", title: "Daily ingest failed", body: "again" });
    expect(second).toBe(first);
    const issue = store.find((i) => i.number === first)!;
    expect(issue.comments).toEqual(["again\n\nRun: https://github.com/o/r/actions/runs/42"]);
    // The pull request sharing the label is not mistaken for the issue.
    expect(store.filter((i) => !i.pull_request && i.labels.includes("ingest-failure"))).toHaveLength(1);

    await issues.report(gh, { label: "model-failure", title: "Model step failed", body: "forecast" });
    await issues.resolve(gh, { label: "ingest-failure" });
    expect(issue.state).toBe("closed");
    expect(store.find((i) => i.labels.includes("model-failure"))!.state).toBe("open");
  });
});

describe("missed daily slots", () => {
  const crons = slots.dailyCrons(readFileSync(join(import.meta.dirname, "..", ".github", "workflows", "daily.yml"), "utf8"));

  it("reads the daily crons, which sit on odd minutes", () => {
    expect(crons).toEqual([
      [47, 12],
      [53, 16],
    ]);
  });

  it("finds the latest slot that should have started, allowing for delay", () => {
    const hours2 = 2 * 3600e3;
    expect(slots.lastDueSlot(crons, new Date("2026-09-23T15:41:00Z"), hours2)?.toISOString()).toBe("2026-09-23T12:47:00.000Z");
    expect(slots.lastDueSlot(crons, new Date("2026-09-23T19:49:00Z"), hours2)?.toISOString()).toBe("2026-09-23T16:53:00.000Z");
    // Before today's first slot is due, yesterday's second one is the one to look for.
    expect(slots.lastDueSlot(crons, new Date("2026-09-23T13:00:00Z"), hours2)?.toISOString()).toBe("2026-09-22T16:53:00.000Z");
  });

  it("reports a slot with no scheduled run created after it", async () => {
    const runs = (created: string[]) => ({
      github: { rest: { actions: { listWorkflowRuns: async () => ({ data: { workflow_runs: created.map((created_at) => ({ created_at })) } }) } } },
      context: { repo: { owner: "o", repo: "r" } },
    });
    const due = new Date("2026-09-23T12:47:00Z");
    expect(await slots.missed(runs(["2026-09-23T16:58:00Z"]), "daily.yml", due)).toBe(false);
    expect(await slots.missed(runs(["2026-09-22T19:47:00Z"]), "daily.yml", due)).toBe(true);
    expect(await slots.missed(runs([]), "daily.yml", null)).toBe(false);
  });
});
