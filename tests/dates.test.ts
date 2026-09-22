import { describe, expect, it } from "vitest";
import {
  addDays,
  daysBetween,
  eachDay,
  eachMonth,
  localDateOf,
  localDateOfHourEnding,
  localHourEnding,
  monthEnd,
  monthLabel,
  monthOfDate,
  monthStart,
  nextMonth,
  ordsFecha,
  ordsMidnightZ,
  previousMonth,
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

  it("enumerates the months a range touches, inclusive of both ends", () => {
    expect(eachMonth("2026-01-15", "2026-03-02")).toEqual([
      { year: 2026, month: 1 },
      { year: 2026, month: 2 },
      { year: 2026, month: 3 },
    ]);
    expect(eachMonth("2025-12-31", "2026-01-01")).toEqual([
      { year: 2025, month: 12 },
      { year: 2026, month: 1 },
    ]);
    // A month paged to its own start is one month, and a backwards range is none.
    expect(eachMonth("2026-05-01", "2026-05-01")).toEqual([{ year: 2026, month: 5 }]);
    expect(eachMonth("2026-05-01", "2026-04-30")).toEqual([]);
  });

  it("bounds a month and steps over year ends", () => {
    expect(monthStart({ year: 2026, month: 2 })).toBe("2026-02-01");
    expect(monthEnd({ year: 2026, month: 2 })).toBe("2026-02-28");
    expect(monthEnd({ year: 2024, month: 2 })).toBe("2024-02-29");
    expect(monthEnd({ year: 2026, month: 12 })).toBe("2026-12-31");
    expect(nextMonth({ year: 2026, month: 12 })).toEqual({ year: 2027, month: 1 });
    expect(previousMonth({ year: 2026, month: 1 })).toEqual({ year: 2025, month: 12 });
    expect(monthOfDate("2026-09-22")).toEqual({ year: 2026, month: 9 });
    expect(monthLabel({ year: 2026, month: 9 })).toBe("2026-09");
  });

  it("puts the Ecuadorian day five hours behind UTC", () => {
    expect(todayEc(new Date("2026-09-22T03:00:00Z"))).toBe("2026-09-21");
    expect(todayEc(new Date("2026-09-22T05:00:00Z"))).toBe("2026-09-22");
  });
});
