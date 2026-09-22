import { describe, expect, it } from "vitest";
import {
  parseCaudCuenAniosAvg,
  parseEnerDia,
  parseEstUnidades,
  parsePointValues,
  parseProdLineaLast2h,
  parseRepDiaEner12m,
  parseRepDiaEnerAyerHoy,
  parseRepDiaHid12m,
  parseRepDiaNivQIng,
  parseRepDiaPotQTurb,
  parseRepDiaRegAyer,
  parseRepDiaVolAlm,
} from "../src/lib/parse/ords.ts";
import type { Observation } from "../src/lib/parse/types.ts";
import { fixture } from "./helpers.ts";

const ords = (name: string) => fixture("celec_ords", name);
const find = (rows: Observation[], date: string, site: string, variable: string) =>
  rows.find((r) => r.date === date && r.site === site && r.variable === variable);

describe("repDiaHid12m", () => {
  const result = parseRepDiaHid12m(ords("ords_rep_repDiaHid12m.txt"));

  it("returns a year of levels and inflows for four reservoirs", () => {
    expect(result.observations).toHaveLength(365 * 4 * 2);
    expect(find(result.observations, "2025-09-20", "mazar", "cota_masl")?.value).toBe(2152.21);
    expect(find(result.observations, "2025-09-20", "mazar", "caudal_m3s")?.value).toBe(55);
  });

  it("maps the `mol` columns to the Amaluza reservoir, not the Molino plant", () => {
    expect(find(result.observations, "2025-09-20", "amaluza", "cota_masl")?.value).toBe(1989.27);
    expect(result.observations.some((r) => r.site === "molino")).toBe(false);
  });

  it("separates the declared band from the readings", () => {
    const band = result.bands?.find((b) => b.date === "2025-09-20" && b.site === "mazar");
    expect(band).toMatchObject({ cota_min: 2100, cota_max: 2153, qmax_m3s: 800 });
    expect(result.observations.some((r) => r.variable.startsWith("lim"))).toBe(false);
  });

  it("skips the nulls of years before a plant existed", () => {
    const early = parseRepDiaHid12m(ords("ords_hist_repDiaHid12m_2016.txt"));
    expect(early.observations.some((r) => r.site === "minas_san_francisco")).toBe(false);
    expect(find(early.observations, "2015-09-20", "mazar", "cota_masl")?.value).toBe(2149.3);
  });
});

describe("repDiaEner12m", () => {
  it("reads daily energy per CELEC Sur plant and drops the chart's axis limits", () => {
    const result = parseRepDiaEner12m(ords("ords_rep_repDiaEner12m.txt"));
    expect(find(result.observations, "2026-03-20", "mazar", "produccion_mwh")?.value).toBe(2895.226364);
    expect(find(result.observations, "2026-03-20", "molino", "produccion_mwh")?.value).toBe(19471.644158);
    expect(result.observations.every((r) => r.value < 100_000)).toBe(true);
  });

  it("omits plants that were not yet reporting", () => {
    const result = parseRepDiaEner12m(ords("ords_hist_repDiaEner12m_2021-03.txt"));
    expect(find(result.observations, "2020-09-20", "delsitanisagua", "produccion_mwh")).toBeUndefined();
    expect(find(result.observations, "2020-09-20", "minas_san_francisco", "produccion_mwh")?.value).toBe(2095.12);
  });
});

describe("the one-day reports", () => {
  it("reads levels and inflows, including the Sopladora intake chamber", () => {
    const result = parseRepDiaNivQIng(ords("ords_rep_repDiaNivQIng.txt"));
    // The response stamps every item 2026-09-20; the rows land on 2026-09-19, because that is
    // the day the numbers describe. See DATA_DATE_OFFSET_DAYS.
    expect(find(result.observations, "2026-09-19", "mazar", "cota_masl")?.value).toBe(2139.1);
    expect(find(result.observations, "2026-09-19", "sopladora", "cota_masl")?.value).toBe(1315.440064);
    expect(find(result.observations, "2026-09-20", "mazar", "cota_masl")).toBeUndefined();
  });

  /**
   * The evidence for that shift, from the fixtures rather than from a claim in a comment. Each
   * of these `repDiaNivQIng` captures is stamped with its own date; the value it carries is the
   * one `repDiaHid12m` publishes for the day before, and the inflows settle it because they
   * move far too much day to day to match by luck. The pairs below are read off the committed
   * repDiaHid12m history (`data/curated/observations_daily/`), rounded as that report rounds.
   */
  it.each([
    ["ords_hist_repDiaNivQIng_15-06-2016.txt", "2016-06-14", "mazar", 183.817285, 184],
    ["ords_hist_repDiaNivQIng_15-06-2019.txt", "2019-06-14", "mazar", 167.382279, 167],
    ["ords_hist_repDiaNivQIng_15-01-2022.txt", "2022-01-14", "amaluza", 115.7, 116],
    ["ords_hist_repDiaNivQIng_15-10-2024.txt", "2024-10-14", "amaluza", 23.395722, 23],
    ["ords_rep_repDiaNivQIng.txt", "2026-09-19", "mazar", 75.263828, 75],
  ])("dates %s to %s, where the 12-month report puts the same inflow", (fixture, date, site, value, rounded) => {
    const result = parseRepDiaNivQIng(ords(fixture as string));
    const row = find(result.observations, date as string, site as string, "caudal_m3s");
    expect(row?.value).toBe(value);
    expect(Math.round(row!.value)).toBe(rounded);
  });

  it("reads power, turbined flow and units online", () => {
    const result = parseRepDiaPotQTurb(ords("ords_rep_repDiaPotQTurb.txt"));
    expect(find(result.observations, "2026-09-20", "minas_san_francisco", "potencia_mw")?.value).toBe(202.28);
    expect(find(result.observations, "2026-09-20", "minas_san_francisco", "unidades_linea")?.value).toBe(3);
  });

  it("dates produced energy from the row and the plan from the requested day", () => {
    const result = parseRepDiaEnerAyerHoy(ords("ords_rep_repDiaEnerAyerHoy.txt"), "2026-09-20");
    expect(find(result.observations, "2026-09-19", "sni", "produccion_mwh")?.value).toBe(104862.229584);
    expect(find(result.observations, "2026-09-20", "mazar", "energia_plan_mwh")?.value).toBe(1040);
  });

  it("notes a response that mixes dates instead of guessing", () => {
    const result = parseRepDiaEnerAyerHoy(ords("ords_hist_repDiaEnerAyerHoy_15-06-2016.txt"), "2016-06-15");
    expect(result.notes?.[0]).toMatch(/mixes the dates 2016-06-14, 2016-06-15/);
  });

  it("reads the annual registry rows", () => {
    const result = parseRepDiaRegAyer(ords("ords_rep_repDiaRegAyer.txt"));
    expect(find(result.observations, "2026-09-20", "molino", "energia_anual_acum_gwh")?.value).toBe(4062);
    expect(find(result.observations, "2026-09-20", "sopladora", "volumen_vertido_hm3")?.value).toBe(0.187129);
  });
});

describe("repDiaVolAlm", () => {
  const result = parseRepDiaVolAlm(ords("ords_rep_repDiaVolAlm_post.txt"), "2026-09-20");

  it("stores volutilalm as a band position, not a volume", () => {
    expect(find(result.observations, "2026-09-20", "mazar", "nivel_pct_banda")?.value).toBe(73.849057);
    expect(result.observations.some((r) => r.variable.includes("volumen_util"))).toBe(false);
  });

  it("confirms the band-linear identity holds, so nothing is flagged", () => {
    // (2139.14 - 2100) / (2153 - 2100) = 73.849 %
    expect(result.notes).toEqual([]);
  });

  it("flags a row where the identity stops holding", () => {
    const doctored = ords("ords_rep_repDiaVolAlm_post.txt").replace("73.84905660377358490566037735849056603774", "61.5");
    const flagged = parseRepDiaVolAlm(doctored, "2026-09-20");
    expect(flagged.notes?.[0]).toMatch(/no longer band-linear/);
  });
});

describe("per-plant hourly energy", () => {
  it("sums 24 hours into one daily total", () => {
    const result = parseEnerDia(ords("ords_hist_ccsEnerDia_15-10-2024.txt"), "coca_codo_sinclair", "ccs", "2024-10-15");
    expect(result.observations).toHaveLength(1);
    expect(result.observations[0]).toMatchObject({ date: "2024-10-15", variable: "produccion_mwh" });
    expect(result.observations[0]!.value).toBeCloseTo(15118.691, 3);
  });

  it("writes nothing for a partial day", () => {
    const partial = JSON.stringify({
      items: [{ loctimestamp: "2024-10-15T06:00:00Z", valueedit: 100 }, { loctimestamp: "2024-10-15T07:00:00Z", valueedit: null }],
    });
    const result = parseEnerDia(partial, "mazar", "maz", "2024-10-15");
    expect(result.observations).toEqual([]);
    expect(result.notes?.join(" ")).toMatch(/only 1\/24 hours/);
  });
});

describe("the historian and live endpoints", () => {
  it("treats an all-null pointValues response as a note, not a failure", () => {
    const result = parsePointValues(ords("pointvalues_30538_2026-09-20.json"), "mazar", "caudal_m3s", 30538);
    expect(result.observations).toEqual([]);
    expect(result.notes?.[0]).toMatch(/all 24 points are null/);
  });

  it("drops an inflow the report publishes as negative, and says so", () => {
    // Copied verbatim from the archived response of 2019-09-20
    // (celec_ords/2019/09/repDiaHid12m.ndjson.gz#repDiaHid12m:2019-09-20), which is what the
    // ORDS really sends on the two days before Minas San Francisco's level series begins.
    const body = JSON.stringify({
      items: [
        {
          loctimestamp: "2018-10-01T05:00:00Z",
          nivelmsf: null, q_ingresadomsf: -4999995, limmsf: 793, min_msf: 750, qmax_msf: 600,
          nivelmaz: 2144.64, q_ingresadomaz: 24, limmaz: 2153, min_maz: 2100, qmax_maz: 800,
        },
      ],
    });
    const result = parseRepDiaHid12m(body);

    expect(find(result.observations, "2018-10-01", "minas_san_francisco", "caudal_m3s")).toBeUndefined();
    expect(result.notes?.join(" ")).toMatch(/minas_san_francisco 2018-10-01: inflow -4999995 is negative/);
    // The rest of the row is untouched: one bad field does not cost the day.
    expect(find(result.observations, "2018-10-01", "mazar", "caudal_m3s")?.value).toBe(24);
    expect(find(result.observations, "2018-10-01", "mazar", "cota_masl")?.value).toBe(2144.64);
  });

  // This one nearly went the other way. The historian's zeros are sentinels, so the obvious move
  // was to reject every zero inflow — and on the reports that would have deleted the most
  // informative day in the series. They publish whole m3/s, so a reported 0 is `round(x)` for any
  // x below 0.5: on 2024-11-08, at the worst of the rationing drought, `repDiaHid12m` gave Mazar 0
  // and the historian gave 0.142 for the same day. The rule belongs to the route that publishes
  // decimals, and the test for it is below.
  it("keeps a zero inflow from the reports, which round whole m3/s", () => {
    const body = JSON.stringify({
      items: [{ loctimestamp: "2024-11-08T05:00:00Z", nivelmaz: 2100, q_ingresadomaz: 0, limmaz: 2153, min_maz: 2100, qmax_maz: 800 }],
    });
    const result = parseRepDiaHid12m(body);
    expect(find(result.observations, "2024-11-08", "mazar", "caudal_m3s")?.value).toBe(0);
    expect(result.notes).toEqual([]);
  });

  it("drops an inflow in five figures, which no Ecuadorian intake sees", () => {
    // Verbatim from the historian response for 2013-11 that the 2005 walk reached
    // (celec_ords/2013/11/pointValuesMesH24.ndjson.gz): 23,221.10 m3/s between neighbours of
    // 34.31 and 0.00, against a maximum of 867 in the same series.
    const body = JSON.stringify({
      items: [
        { loctimestamp: "2013-11-26T05:00:00Z", valueedit: 34.31 },
        { loctimestamp: "2013-11-27T05:00:00Z", valueedit: 23221.1 },
      ],
    });
    const result = parsePointValues(body, "mazar", "caudal_m3s", 30538);

    expect(find(result.observations, "2013-11-27", "mazar", "caudal_m3s")).toBeUndefined();
    expect(result.notes?.join(" ")).toMatch(/inflow 23221.1 exceeds 10000 m3\/s/);
    // The day before it stands: the rule rejects the fault, not the neighbourhood.
    expect(find(result.observations, "2013-11-26", "mazar", "caudal_m3s")?.value).toBe(34.31);
  });

  it("drops a historian zero, which is a sentinel on a route that publishes decimals", () => {
    // Verbatim shape of 2010-02, where nine consecutive days came back 0.00 in a series whose
    // smallest real reading anywhere is 0.142.
    const body = JSON.stringify({
      items: [
        { loctimestamp: "2010-02-01T05:00:00Z", valueedit: 0 },
        { loctimestamp: "2010-02-02T05:00:00Z", valueedit: 41.2 },
      ],
    });
    const asInflow = parsePointValues(body, "mazar", "caudal_m3s", 30538);
    expect(find(asInflow.observations, "2010-02-01", "mazar", "caudal_m3s")).toBeUndefined();
    expect(asInflow.notes?.join(" ")).toMatch(/is zero on a route that publishes decimals/);
    expect(find(asInflow.observations, "2010-02-02", "mazar", "caudal_m3s")?.value).toBe(41.2);

    // A cota of zero is just as wrong, but it is wrong in a way this rule has not measured, and
    // the range gate already bounds levels against a declared band. Silently borrowing the inflow
    // threshold for it would be a guess wearing a rule's clothes.
    const asLevel = parsePointValues(body, "mazar", "cota_masl", 30031);
    expect(find(asLevel.observations, "2010-02-01", "mazar", "cota_masl")?.value).toBe(0);
  });

  it("reads the yearly basin flow, including the 2024 drought", () => {
    const result = parseCaudCuenAniosAvg(ords("ords_hist_csrCaudCuenAniosAvg.txt"));
    expect(find(result.observations, "2024-01-01", "paute_cuenca", "caudal_cuenca_m3s")?.value).toBeCloseTo(74.57, 2);
    expect(find(result.observations, "2025-01-01", "paute_cuenca", "caudal_cuenca_m3s")?.value).toBeCloseTo(163.58, 2);
  });

  it("names each live block from its flow row", () => {
    const live = parseProdLineaLast2h(ords("ords_rep_csrProdLineaLast2h.txt"));
    const mazarLevel = live.find((r) => r.site === "mazar" && r.magnitude === "Nivel Embalse" && r.hour === 1);
    expect(mazarLevel?.value).toBe(2138.66);
    expect(live.some((r) => r.site === "paute_cuenca")).toBe(true);
  });

  it("reads unit status", () => {
    const units = parseEstUnidades(ords("ords_rep_csrEstUnidades.txt"));
    expect(units).toHaveLength(22);
    expect(units[0]).toEqual({ site: "molino", unit: "U01", status: "En línea" });
  });
});

describe("schema drift", () => {
  it("refuses a renamed plant instead of dropping it", () => {
    const renamed = JSON.stringify({ items: [{ fecha: "2026-09-20T05:00:00Z", embalse: "Mazar II", nivel: 1, q_ingresado: 1 }] });
    expect(() => parseRepDiaNivQIng(renamed)).toThrow(/unknown site label/);
  });

  it("refuses a response that lost a field", () => {
    const trimmed = JSON.stringify({ items: [{ loctimestamp: "2026-09-20T05:00:00Z", nivelmaz: 2139 }] });
    expect(() => parseRepDiaHid12m(trimmed)).toThrow(/lost the fields/);
  });

  it("refuses a response that is not JSON at all", () => {
    expect(() => parseRepDiaHid12m("<html>login</html>")).toThrow(/not JSON/);
  });
});
