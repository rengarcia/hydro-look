/**
 * The masthead's "hace 3 h": the one formatter that runs in the reader's browser.
 */

import { describe, expect, it } from "vitest";
import { agoEs, agoTone } from "../src/lib/site/ago.ts";
import { listEs } from "../src/lib/site/schema-doc.ts";

const AT = "2026-10-06T12:47:00Z";
const after = (minutes: number) => Date.parse(AT) + minutes * 60_000;

describe("agoEs", () => {
  it("says minutes, then hours, then days", () => {
    expect(agoEs(AT, after(0))).toBe("hace un momento");
    expect(agoEs(AT, after(12))).toBe("hace 12 min");
    expect(agoEs(AT, after(3 * 60 + 20))).toBe("hace 3 h");
    expect(agoEs(AT, after(47 * 60))).toBe("hace 47 h");
    expect(agoEs(AT, after(3 * 24 * 60))).toBe("hace 3 días");
  });

  it("does not go negative when the reader's clock is behind the runner's", () => {
    expect(agoEs(AT, after(-5))).toBe("hace un momento");
  });

  it("has nothing to say about a stamp it cannot read", () => {
    expect(agoEs("not a time", after(0))).toBeNull();
  });
});

describe("agoTone", () => {
  it("stays good through the overnight gap and warns once runs have been missed", () => {
    expect(agoTone(AT, after(12 * 60))).toBe("good");
    expect(agoTone(AT, after(20 * 60))).toBe("watch");
    expect(agoTone(AT, after(36 * 60))).toBe("tight");
    expect(agoTone("not a time", after(0))).toBe("tight");
  });
});

describe("listEs", () => {
  it("joins with commas and a final y", () => {
    expect(listEs([])).toBe("");
    expect(listEs(["a"])).toBe("a");
    expect(listEs(["a", "b"])).toBe("a y b");
    expect(listEs(["a", "b", "c"])).toBe("a, b y c");
  });
});
