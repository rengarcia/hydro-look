/**
 * `lib/site/format.ts`: the one place the site decides how a number, a date or a code is said in
 * Spanish. The assertions are about the decisions — a missing number is a dash and never a zero,
 * dates are built from their parts and never through a clock, codes find their labels whether the
 * document is from before the contract or after it.
 */

import { describe, expect, it } from "vitest";
import {
  EM_DASH,
  basinLabel,
  basinName,
  capitalise,
  conceptLabel,
  dateWithYear,
  declarationLabel,
  ecStamp,
  feedLabel,
  findingText,
  longDate,
  num,
  pct,
  shortDate,
  signed,
} from "../src/lib/site/format.ts";

describe("numbers", () => {
  it("writes Ecuador's thousands point and decimal comma", () => {
    expect(num(2138.37, 2)).toBe("2.138,37");
    expect(num(0.5, 1)).toBe("0,5");
  });

  it("prints a number the project does not have as a dash, never as zero", () => {
    for (const missing of [null, undefined, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(num(missing)).toBe(EM_DASH);
      expect(signed(missing)).toBe(EM_DASH);
      expect(pct(missing)).toBe(EM_DASH);
    }
  });

  it("signs a slope, because the sign is the message", () => {
    expect(signed(0.21, 2)).toBe("+0,21");
    expect(signed(-0.21, 2)).toBe("-0,21");
    expect(signed(0, 2)).toBe("0,00");
  });

  it("puts a space before the per-cent sign, as Spanish typesetting does", () => {
    expect(pct(72.4, 1)).toBe("72,4 %");
  });
});

describe("dates", () => {
  it("builds a date from its parts, so no timezone can move it a day", () => {
    expect(longDate("2026-09-21")).toBe("21 de septiembre de 2026");
    expect(longDate("2026-01-01T03:00:00Z")).toBe("1 de enero de 2026");
    expect(shortDate("2026-09-01")).toBe("1 sep");
    expect(dateWithYear("2026-12-31")).toBe("31 dic 2026");
  });

  it("has a dash for a date it cannot read", () => {
    expect(longDate(null)).toBe(EM_DASH);
    expect(longDate("")).toBe(EM_DASH);
  });

  it("stamps an instant in Ecuador's time, across midnight", () => {
    // 03:10 UTC on the 23rd is 22:10 on the 22nd in Guayaquil.
    expect(ecStamp("2026-09-23T03:10:00Z")).toBe("22 sep 2026, 22:10 (hora de Ecuador)");
    expect(ecStamp("not a time")).toBe("not a time");
  });
});

describe("codes and their labels", () => {
  it("reads a feed's Spanish label from the document, or from its English name in an older one", () => {
    expect(feedLabel({ label_es: "ORDS: cotas y caudales", feed: "anything" })).toBe("ORDS: cotas y caudales");
    expect(feedLabel({ feed: "ORDS levels and inflows (repDiaHid12m)" })).toBe("ORDS: cotas y caudales");
    expect(feedLabel({ feed: "XM Colombian storage" })).toBe("XM: embalses de Colombia");
  });

  it("labels a band declaration by code or by the old English phrase", () => {
    expect(declarationLabel({ declaration: "report_endpoint" })).toBe("servicio de reportes");
    expect(declarationLabel({ declaration: "dashboard chart title" })).toBe("título del gráfico del tablero");
    expect(declarationLabel({ declaration: "report_endpoint", declaration_es: "del documento" })).toBe("del documento");
  });

  it("names basins after their rivers, and falls back to the id capitalised", () => {
    expect(basinLabel("paute")).toBe("cuenca del Paute");
    expect(basinName("guayllabamba")).toBe("Guayllabamba");
    expect(basinName("upano")).toBe("Upano");
    expect(capitalise("servicio")).toBe("Servicio");
  });

  it("never prints a SMEC column name when it has a label", () => {
    expect(conceptLabel("generacion_hidraulica")).toBe("Hidroeléctrica");
    expect(conceptLabel("unknown_concept")).toBe("unknown_concept");
  });
});

describe("findingText", () => {
  it("says the finding that stays open in normal operation in Spanish, with its first case", () => {
    const text = findingText({
      check: "range:observations_daily",
      level: "warn",
      message:
        "27 percentage(s) sit outside 0..100 — a reservoir above its declared band or a plant above nominal capacity, not an error; first: mazar/nivel_pct_banda 2026-06-02 100.792453",
    });
    expect(text).toContain("27 porcentajes quedan fuera de 0–100 %");
    expect(text).toContain("Mazar, 2 de junio de 2026, 100,8 %");
  });

  it("points any other finding at status.json rather than pasting English into the page", () => {
    expect(findingText({ check: "shape:x", level: "fail", message: "something broke" })).toBe(
      "fallo de la comprobación «shape:x» (detalle en status.json)",
    );
  });
});
