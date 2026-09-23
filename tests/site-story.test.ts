/**
 * The page's headlines are rules over numbers, and a rule that picks the wrong words prints a
 * wrong statement in the largest type on the page. These pin each rule to the numbers it claims
 * to describe, including the day the design was drawn on.
 */

import { describe, expect, it } from "vitest";
import {
  adequacyHeadline,
  countWord,
  direction,
  inflowHeadline,
  joinDays,
  marginClause,
  modelShort,
  monthSpan,
  skillTone,
  weekday,
  wholeYears,
} from "../src/lib/site/story.ts";

describe("adequacyHeadline", () => {
  it("says the first horizon's answer, then the worst one's when it is worse", () => {
    const horizons = [
      { horizon_days: 7, tier: "vigilancia" as const },
      { horizon_days: 14, tier: "vigilancia" as const },
      { horizon_days: 30, tier: "vigilancia" as const },
      { horizon_days: 60, tier: "ajustado" as const },
      { horizon_days: 90, tier: "ajustado" as const },
    ];
    expect(adequacyHeadline(horizons)).toBe("¿Alcanza la energía? Hoy sí, por poco. A 60 días, no del todo.");
  });

  it("does not promise a later problem when nothing gets worse", () => {
    const horizons = [
      { horizon_days: 7, tier: "holgado" as const },
      { horizon_days: 90, tier: "holgado" as const },
    ];
    expect(adequacyHeadline(horizons)).toBe("¿Alcanza la energía? Hoy sí. Y así sigue hasta los 90 días.");
  });

  it("names the first horizon that reaches the worst tier", () => {
    const horizons = [
      { horizon_days: 7, tier: "holgado" as const },
      { horizon_days: 30, tier: "deficit" as const },
      { horizon_days: 90, tier: "deficit" as const },
    ];
    expect(adequacyHeadline(horizons)).toBe("¿Alcanza la energía? Hoy sí. A 30 días, no.");
  });
});

describe("inflowHeadline", () => {
  it("calls the 29th percentile thin and the middle fifth usual", () => {
    expect(inflowHeadline(29)).toBe("El río llega más flaco que de costumbre.");
    expect(inflowHeadline(50)).toBe("El río llega como de costumbre.");
    expect(inflowHeadline(85)).toBe("El río llega mucho más crecido que de costumbre.");
  });

  it("says nothing about the river when there is no percentile", () => {
    expect(inflowHeadline(null)).not.toMatch(/flaco|crecido|costumbre/);
  });
});

describe("marginClause", () => {
  it("uses the tier as the closing word", () => {
    expect(marginClause("ajustado", 60, 90)).toEqual({ before: "A 60 días el margen nacional queda corto:", word: "ajustado" });
    expect(marginClause("holgado", 7, 90).before).toContain("90 días");
  });
});

describe("direction", () => {
  it("treats less than half a centimetre a day as holding", () => {
    expect(direction(-0.2129)).toBe("down");
    expect(direction(0.08)).toBe("up");
    expect(direction(0.004)).toBe("flat");
    expect(direction(null)).toBe("flat");
  });
});

describe("small words", () => {
  it("writes small counts in words and larger ones as numerals", () => {
    expect(countWord(12, true)).toBe("Doce");
    expect(countWord(2)).toBe("dos");
    expect(countWord(105)).toBe("105");
  });

  it("counts only whole elapsed years", () => {
    expect(wholeYears("2014-09-20", "2026-09-21")).toBe(12);
    expect(wholeYears("2014-09-22", "2026-09-21")).toBe(11);
  });

  it("names the weekday without a clock or a zone", () => {
    expect(weekday("2026-09-21")).toBe("lunes");
  });

  it("names a span of months", () => {
    expect(monthSpan("2023-10-27", "2023-12-31")).toBe("oct–dic 2023");
    expect(monthSpan("2024-09-23", "2025-01-10")).toBe("sep 2024–ene 2025");
  });

  it("joins horizons as prose", () => {
    expect(joinDays([14, 30])).toBe("14 y 30");
    expect(joinDays([7, 14, 30])).toBe("7, 14 y 30");
  });

  it("shortens a model id to its rung", () => {
    expect(modelShort("M4-gbm-m3-residual")).toBe("M4");
  });

  it("calls a skill within five percent of zero a tie", () => {
    expect(skillTone(0.112)).toBe("water");
    expect(skillTone(-0.012)).toBe("muted");
    expect(skillTone(-0.2)).toBe("tight");
  });
});
