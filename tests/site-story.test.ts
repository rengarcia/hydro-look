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
  changeWord,
  criticalThreshold,
  heroHeadline,
  narrativeTierNote,
  scenarioOf,
  splitLead,
  dayScoreNote,
  importDependence,
  inflowVerdict,
  scorecardSummary,
} from "../src/lib/site/story.ts";
import { firstPendingTarget } from "../src/lib/site/days.ts";
import { modelNotes, precipFallbackText } from "../src/lib/site/method.ts";

describe("heroHeadline", () => {
  it("rounds the hydro share to whole kWh out of a hundred and says it in one sentence", () => {
    const h = heroHeadline(78.81);
    expect(h.text).toBe("El agua encendió 79 de cada 100 kWh del país.");
    expect(h.emphasis).toBe("79 de cada 100");
  });

  it("falls back to the site's own line when there is no closed day", () => {
    expect(heroHeadline(null).share).toBeNull();
    expect(heroHeadline(undefined).text).toBe("El sistema hidroeléctrico del Ecuador, día a día.");
  });
});

describe("changeWord", () => {
  it("says a change with its sign and unit, at the precision it is published", () => {
    expect(changeWord(-0.77, 2, "m")).toBe("−0,77 m");
    expect(changeWord(8.907, 1, "GWh")).toBe("+8,9 GWh");
  });

  it("says a change that rounds to nothing as no change, not as a signed zero", () => {
    expect(changeWord(0.004, 2, "m")).toBe("sin cambio");
    expect(changeWord(-0.004, 2, "m")).toBe("sin cambio");
  });

  it("has nothing to say without a yesterday", () => {
    expect(changeWord(null, 2, "m")).toBeNull();
  });
});

describe("splitLead", () => {
  const long =
    "La cota de Mazar desciende y su caudal de entrada está por debajo de lo habitual, en el percentil 29 de su historia para esta época del año, con 2.138,37 m, después de una semana en la que bajó a razón de veintiún centímetros por día. " +
    "El pronóstico a 90 días la lleva a 2.126,47 m.";

  it("splits after the first sentence, never at a number's thousands point", () => {
    const [lead, rest] = splitLead(long);
    expect(lead.endsWith("por día.")).toBe(true);
    expect(rest).toBe("El pronóstico a 90 días la lleva a 2.126,47 m.");
  });

  it("leaves a short paragraph whole", () => {
    expect(splitLead("Una frase. Otra.")).toEqual(["Una frase. Otra.", ""]);
  });
});

describe("narrativeTierNote", () => {
  const adequacy = { origin_date: "2026-09-21", current: { worst_tier_horizon_days: 60 }, horizons: [{ horizon_days: 7 }] };

  it("names the worst tier and its horizon, which is what the text is given", () => {
    expect(narrativeTierNote({ origin_date: "2026-09-21" }, adequacy)).toBe("el peor momento de los próximos meses: dentro de 60 días");
  });

  it("says the first horizon when the document names that field instead", () => {
    const first = { ...adequacy, current: { ...adequacy.current, narrative_tier_field: "tier" } };
    expect(narrativeTierNote({ origin_date: "2026-09-21" }, first)).toBe("dentro de 7 días");
  });

  it("says nothing when the text is about another day than the adequacy run", () => {
    expect(narrativeTierNote({ origin_date: "2026-09-20" }, adequacy)).toBeNull();
    expect(narrativeTierNote({ origin_date: "2026-09-21" }, null)).toBeNull();
  });
});

describe("criticalThreshold and scenarios", () => {
  it("reads the scenarios against this project's unverified marker first", () => {
    const thresholds = [
      { status: "published", level_masl: 2100 },
      { status: "unverified", level_masl: 2115 },
    ];
    expect(criticalThreshold(thresholds)?.level_masl).toBe(2115);
    expect(criticalThreshold([thresholds[0]!])?.level_masl).toBe(2100);
    expect(criticalThreshold([])).toBeUndefined();
  });

  it("names the analogue years in Spanish and keeps an unknown one as it came", () => {
    expect(scenarioOf("dry")).toEqual({ name: "Año seco", tone: "tight" });
    expect(scenarioOf("other").name).toBe("other");
  });
});

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
    expect(marginClause("ajustado", 60, 90)).toEqual({
      before: "En 60 días la electricidad del país queda justa: nivel",
      word: "ajustado",
    });
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

describe("scorecardSummary", () => {
  const pending = { rows_scored: 0, rows_pending: 10, rows_excluded: 0, runs_considered: 2, observed_through: "2026-09-21" };

  it("says honestly that nothing has reached its date yet, and when the first will", () => {
    const s = scorecardSummary(pending, "2026-09-28");
    expect(s.headline).toBe(
      "Aún no ha llegado la fecha de ningún pronóstico publicado; el primero se comprueba el 28 de septiembre de 2026.",
    );
    expect(s.detail).toContain("10 pronósticos de 2 publicaciones siguen esperando su fecha");
    expect(s.detail).toContain("pruebas con datos de años anteriores");
  });

  it("drops the due date rather than inventing one", () => {
    expect(scorecardSummary(pending, null).headline).toBe("Aún no ha llegado la fecha de ningún pronóstico publicado.");
  });

  it("has nothing to score before the first run", () => {
    expect(scorecardSummary({ ...pending, rows_pending: 0, runs_considered: 0 }, null).headline).toBe(
      "Todavía no hay pronósticos publicados que comprobar.",
    );
  });

  it("counts scored rows against the last observed day, with what is still waiting", () => {
    const s = scorecardSummary({ ...pending, rows_scored: 3, rows_pending: 7, rows_excluded: 1 }, "2026-10-05");
    expect(s.headline).toBe("3 pronósticos publicados ya comprobados con los datos reales hasta el 21 de septiembre de 2026.");
    expect(s.detail).toBe(
      "7 pronósticos más esperan su fecha; el próximo se comprueba el 5 de octubre de 2026. " +
        "1 pronóstico no se puede comprobar: llegó su fecha y no hubo dato publicado.",
    );
  });
});

describe("dayScoreNote", () => {
  const horizons = [
    { horizon_days: 7, target_date: "2026-09-28" },
    { horizon_days: 14, target_date: "2026-10-05" },
  ];

  it("names the first horizon to fall due when none has", () => {
    expect(dayScoreNote(horizons, "2026-09-21")).toBe(
      "Todavía no llega la fecha de ninguno de sus plazos; el primero, a 7 días, se comprueba el 28 de septiembre de 2026.",
    );
  });

  it("counts the horizons already past and names the next", () => {
    expect(dayScoreNote(horizons, "2026-09-30")).toBe(
      "Ya llegó la fecha de uno de sus 2 plazos; el siguiente, a 14 días, se comprueba el 5 de octubre de 2026.",
    );
  });

  it("says when every horizon has passed, and nothing for an empty run", () => {
    expect(dayScoreNote(horizons, "2026-10-05")).toContain("Ya llegó la fecha de todos sus plazos");
    expect(dayScoreNote([], "2026-10-05")).toBeNull();
  });
});

describe("firstPendingTarget", () => {
  const runs = [
    { run_id: "a1", origin_date: "2026-09-20", model_version: "1", generated_at: "2026-09-20T12:00:00Z" },
    // Superseded by a2 for the same origin and version: its rows are never scored or pending.
    { run_id: "a0", origin_date: "2026-09-21", model_version: "1", generated_at: "2026-09-21T12:00:00Z" },
    { run_id: "a2", origin_date: "2026-09-21", model_version: "1", generated_at: "2026-09-22T12:00:00Z" },
  ];
  const values = [
    { run_id: "a0", target_date: "2026-09-22" },
    { run_id: "a1", target_date: "2026-09-27" },
    { run_id: "a2", target_date: "2026-09-28" },
    { run_id: "a2", target_date: "2026-10-05" },
  ];

  it("is the earliest target after the last observation, among the runs the scorecard keeps", () => {
    expect(firstPendingTarget(runs, values, "2026-09-21")).toBe("2026-09-27");
    expect(firstPendingTarget(runs, values, "2026-09-27")).toBe("2026-09-28");
  });

  it("treats every row as pending with no observation, and returns null when none is", () => {
    expect(firstPendingTarget(runs, values, null)).toBe("2026-09-27");
    expect(firstPendingTarget(runs, values, "2026-12-31")).toBeNull();
  });
});

describe("inflowVerdict", () => {
  const backtest = (mae: number, persistence: number, climatology: number) => ({
    n: 400,
    mae_m3s: mae,
    persistence_mae_m3s: persistence,
    climatology_mae_m3s: climatology,
  });

  it("says what a published horizon beats", () => {
    expect(inflowVerdict({ published: true, reason: "", backtest: backtest(42.83, 51.19, 47.94) })).toBe(
      "Se publica: acierta más que suponer que el caudal no cambia (51,2 m³/s) y que usar el promedio de la época (47,9 m³/s).",
    );
  });

  it("names what an unpublished horizon lost to, from the numbers rather than the English reason", () => {
    expect(inflowVerdict({ published: false, reason: "x", backtest: backtest(42.77, 52.73, 42.42) })).toBe(
      "No se publica: no acierta más que usar el promedio de la época (42,4 m³/s).",
    );
    expect(inflowVerdict({ published: false, reason: "x", backtest: backtest(49.25, 43.97, 57.04) })).toBe(
      "No se publica: no acierta más que suponer que el caudal no cambia (44,0 m³/s).",
    );
    expect(inflowVerdict({ published: false, reason: "x", backtest: backtest(60, 50, 55) })).toBe(
      "No se publica: no acierta más que suponer que el caudal no cambia (50,0 m³/s) ni que usar el promedio de la época (55,0 m³/s).",
    );
  });

  it("falls back to the document's reason when the numbers do not explain it", () => {
    expect(inflowVerdict({ published: false, reason: "no forecast at the live origin", backtest: backtest(10, 20, 30) })).toBe(
      "No se publica (no forecast at the live origin).",
    );
  });
});

describe("importDependence", () => {
  it("says the tier rests on the import assumption when the cases disagree", () => {
    const text = importDependence({
      cases: [
        { case: "demonstrated", import_gwh_day: 10.779, worst_tier: "vigilancia", worst_tier_horizon_days: 30 },
        { case: "stressed", import_gwh_day: 0.122, worst_tier: "ajustado", worst_tier_horizon_days: 60 },
        { case: "current_regime", import_gwh_day: 0.142, worst_tier: "ajustado", worst_tier_horizon_days: 60 },
      ],
    });
    expect(text).toBe(
      "Con «el máximo visto» (10,78 GWh/día) el peor nivel sería vigilancia; con «como en 2024» (0,12 GWh/día), " +
        "ajustado dentro de 60 días. El resultado depende de cuánta energía llegue desde Colombia.",
    );
  });

  it("says it does not when they agree", () => {
    const text = importDependence({
      cases: [
        { case: "demonstrated", import_gwh_day: 10, worst_tier: "holgado", worst_tier_horizon_days: 7 },
        { case: "stressed", import_gwh_day: 0.1, worst_tier: "holgado", worst_tier_horizon_days: 7 },
      ],
    });
    expect(text).toBe("Con cualquiera de los dos supuestos el peor nivel es holgado: lo que llegue de Colombia no cambia el resultado.");
  });
});

describe("the method notes the documents carry", () => {
  it("say which basin the rain is read from, and why not the verified centroid", () => {
    const [note] = modelNotes({
      precipitation_basin: {
        basin: "paute",
        verified_centroid: false,
        era5_days: 13407,
        share_since_1990: 1,
        fallback_reason: "paute_mazar: no ERA5 rows",
      },
    });
    expect(note!.title).toBe("Dónde se mide la lluvia: `paute`");
    expect(note!.body).toContain("punto provisional");
    expect(note!.body).toContain("`paute_mazar` todavía no tiene datos de lluvia");
    expect(note!.body).toContain("13.407 días de datos");
  });

  it("describe the adequacy band's calibration with its stretch range", () => {
    const [note] = modelNotes({
      band_method: {
        method: "residual quantiles from every earlier origin, stretched per horizon by the smallest factor",
        nominal_coverage: 0.8,
        stretch_by_horizon: [
          { horizon_days: 7, stretch: 1.6 },
          { horizon_days: 90, stretch: 1.4 },
        ],
      },
    });
    expect(note!.body).toContain("acertado el 80 % de las veces");
    expect(note!.body).toContain("entre 1,4 y 1,6 veces");
  });

  it("are absent when the document predates the blocks", () => {
    expect(modelNotes({})).toEqual([]);
  });

  it("translate each fallback reason the weather module writes, and quote any other", () => {
    expect(precipFallbackText("paute_mazar: 42.5% of days since 1990-01-01, under 95%")).toBe(
      "`paute_mazar` tiene el 42,5 % de los días desde 1990, por debajo del 95 % exigido",
    );
    expect(precipFallbackText("paute_mazar: ERA5 starts 2001-01-01, not by 1990-01-31")).toContain("empiezan el 2001-01-01");
    expect(precipFallbackText("something new")).toBe("`something new`");
  });
});
