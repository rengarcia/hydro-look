/**
 * The workflows pass these flags straight from GitHub inputs, and an unset input arrives as an
 * empty string rather than as a missing flag. That distinction has already cost one silent
 * bug, so it is pinned here.
 */

import { describe, expect, it } from "vitest";
import { parseOptions, positiveNumber } from "../src/lib/options.ts";

describe("parseOptions", () => {
  it("defaults an empty --days to one day rather than to zero", () => {
    // `--days ""` is what `DAYS: ${{ inputs.days }}` produces on a scheduled run. Number("")
    // is 0, which would run the 12-month reports and silently skip every per-day report.
    expect(parseOptions(["daily", "--days", ""]).days).toBe(1);
    expect(parseOptions(["daily"]).days).toBe(1);
    expect(parseOptions(["daily", "--days", "3"]).days).toBe(3);
  });

  it("treats every other empty string as unset too", () => {
    const options = parseOptions(["backfill", "--to", "", "--plants", "", "--source", "", "--out", "", "--rate-ms", ""]);
    expect(options.to).toBeUndefined();
    expect(options.source).toBe("all");
    expect(options.plants).toEqual(["ago", "man", "ccs"]);
    expect(options.out).toBeUndefined();
    expect(options.rateMs).toBe(1000);
  });

  it("rejects a nonsensical number instead of silently doing nothing", () => {
    // `--days -1` is rejected by parseArgs itself as an ambiguous argument, hence the `=`.
    expect(() => parseOptions(["daily", "--days=-1"])).toThrow(/positive number/);
    expect(() => parseOptions(["daily", "--days", "0"])).toThrow(/positive number/);
    expect(() => parseOptions(["daily", "--days", "many"])).toThrow(/positive number/);
    expect(positiveNumber(undefined, 7)).toBe(7);
  });

  it("validates dates, sources and plant codes", () => {
    expect(parseOptions(["backfill", "--from", "2016-05-01"]).from).toBe("2016-05-01");
    expect(() => parseOptions(["backfill", "--from", "01/05/2016"])).toThrow(/ISO date/);
    expect(() => parseOptions(["backfill", "--source", "ords-magic"])).toThrow(/--source must be one of/);
    expect(() => parseOptions(["backfill", "--plants", "ago,xyz"])).toThrow(/unknown plant code "xyz"/);
  });

  it("keeps the staging flags apart", () => {
    expect(parseOptions(["daily", "--out", "/tmp/batch"]).out).toBe("/tmp/batch");
    expect(parseOptions(["apply", "--in", "/tmp/batch"])).toMatchObject({ command: "apply", in: "/tmp/batch" });
  });
});
