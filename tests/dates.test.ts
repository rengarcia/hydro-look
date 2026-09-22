import { describe, expect, it } from "vitest";
import {
  addDays,
  daysBetween,
  eachDay,
  localDateOf,
  localDateOfHourEnding,
  localHourEnding,
  ordsFecha,
  ordsMidnightZ,
  smecFecha,
  todayEc,
} from "../src/lib/util/dates.ts";

describe("Ecuadorian local days", () => {
  it("reads the ORDS local-midnight stamp as its own day", () => {
    expect(localDateOf("2026-09-20T05:00:00Z")).toBe("2026-09-20");
    expect(localDateOf("2015-09-20T05:00:00Z")).toBe("2015-09-20");
  });

  it("keeps an hour-ending series on the day it belongs to", () => {
    // The 24 hours of 2024-10-15 run from 06:00Z that day to 05:00Z the next.
    expect(localDateOfHourEnding("2024-10-15T06:00:00Z")).toBe("2024-10-15");
    expect(localDateOfHourEnding("2024-10-16T05:00:00Z")).toBe("2024-10-15");
    expect(localHourEnding("2024-10-15T06:00:00Z")).toBe(1);
    expect(localHourEnding("2024-10-16T05:00:00Z")).toBe(24);
  });

  it("formats the query parameters each source expects", () => {
    expect(ordsFecha("2026-09-20")).toBe("20/09/2026 00:00:00");
    expect(smecFecha("2026-09-20")).toBe("2026/09/20");
    expect(ordsMidnightZ("2026-09-20")).toBe("2026-09-20T05:00:00Z");
  });

  it("does arithmetic across month and year boundaries", () => {
    expect(addDays("2026-02-28", 1)).toBe("2026-03-01");
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
    expect(daysBetween("2026-01-01", "2026-12-31")).toBe(364);
    expect(eachDay("2026-09-19", "2026-09-21")).toEqual(["2026-09-19", "2026-09-20", "2026-09-21"]);
  });

  it("puts the Ecuadorian day five hours behind UTC", () => {
    expect(todayEc(new Date("2026-09-22T03:00:00Z"))).toBe("2026-09-21");
    expect(todayEc(new Date("2026-09-22T05:00:00Z"))).toBe("2026-09-22");
  });
});
