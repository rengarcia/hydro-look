import { describe, expect, it } from "vitest";
import { parseSmecInforme1 } from "../src/lib/parse/smec.ts";
import { parseInformacionOperativa, spanishDayToIso } from "../src/lib/parse/operativa.ts";
import { fixture } from "./helpers.ts";

const smec = (name: string) => fixture("cenace_smec", name);
const dayKwh = (report: ReturnType<typeof parseSmecInforme1>, concepto: string) =>
  report.rows.find((r) => r.concepto === concepto)?.dia_kwh;

describe("SMEC daily balance", () => {
  it("reads a current report's seven columns", () => {
    const report = parseSmecInforme1(smec("informe1_2026-09-20.html"), "2026-09-20");
    expect(report.date).toBe("2026-09-20");
    expect(report.tipo_dia).toBe("Domingo");
    expect(report.tipo_dia_anio_anterior).toBe("Sábado");
    expect(report.complete).toBe(true);
    expect(dayKwh(report, "generacion_hidraulica")).toBe(76808654.928);
    expect(dayKwh(report, "total_generacion")).toBe(100054335.711);
    const hydro = report.rows.find((r) => r.concepto === "generacion_hidraulica")!;
    expect(hydro.mes_kwh).toBe(1723223339.176);
    expect(hydro.ultimos365_kwh).toBe(30353295622.277);
  });

  it("reads the 2016 layout, which has Motores Diesel and Nafta but no Perú rows", () => {
    const report = parseSmecInforme1(smec("informe1_2016-05-01.html"), "2016-05-01");
    expect(report.complete).toBe(true);
    expect(dayKwh(report, "generacion_turbinas_nafta")).toBe(0);
    expect(dayKwh(report, "generacion_motores_diesel")).toBe(0);
    expect(report.rows.some((r) => r.concepto === "importacion_peru")).toBe(false);
  });

  it("reads the 2019 layout, which has the Perú rows", () => {
    const report = parseSmecInforme1(smec("informe1_2019-01-15.html"), "2019-01-15");
    expect(dayKwh(report, "importacion_peru")).toBe(0);
    expect(dayKwh(report, "generacion_hidraulica")).toBe(61575985.757);
  });

  it("reads the October 2024 drought day", () => {
    const report = parseSmecInforme1(smec("informe1_2024-10-15.html"), "2024-10-15");
    expect(dayKwh(report, "generacion_hidraulica")).toBe(41491824.655);
    // Half of a normal day's hydro: the rationing period is in the history, not smoothed away.
    expect(dayKwh(report, "generacion_hidraulica")!).toBeLessThan(dayKwh(parseSmecInforme1(smec("informe1_2026-09-20.html"), "2026-09-20"), "generacion_hidraulica")! / 1.5);
  });

  it("marks the running day incomplete so it is never written as a real day", () => {
    const report = parseSmecInforme1(smec("informe1_2026-09-21.html"), "2026-09-21");
    expect(report.complete).toBe(false);
    expect(report.notes.join(" ")).toMatch(/incomplete/);
  });

  it("notes a report that answers for a different date", () => {
    const report = parseSmecInforme1(smec("informe1_2026-09-20.html"), "2026-09-19");
    expect(report.notes.join(" ")).toMatch(/asked for 2026-09-19, report says 2026-09-20/);
  });

  it("refuses an unknown generation row rather than dropping it", () => {
    const doctored = smec("informe1_2026-09-20.html").replace("Generación Turbinas a Gas", "Generación Nuclear");
    expect(() => parseSmecInforme1(doctored, "2026-09-20")).toThrow(/unknown row label/);
  });
});

describe("Información Operativa", () => {
  const snapshot = parseInformacionOperativa(fixture("cenace_operativa", "InformacionOperativa_2026-09-21T1910.html"));
  const metric = (block: string, name: string) => snapshot.metrics.find((m) => m.block === block && m.metric === name);

  it("separates the running day from the last closed day", () => {
    expect(metric("tiempo_real", "produccion_total")).toMatchObject({ value: 86915, period_date: "2026-09-21", unit: "MWh" });
    expect(metric("diaria", "produccion_total")).toMatchObject({ value: 104277, period_date: "2026-09-19", unit: "MWh" });
  });

  it("keeps the annual block in GWh, as the page labels it", () => {
    expect(metric("anual", "produccion_total")).toMatchObject({ value: 26943, unit: "GWh" });
    expect(metric("mensual", "produccion_total")).toMatchObject({ value: 2045109, unit: "MWh" });
  });

  it("reads demand by distribution utility", () => {
    const utilities = snapshot.metrics.filter((m) => m.block === "demanda_empresas");
    expect(utilities).toHaveLength(19);
    expect(utilities.find((u) => u.metric === "cnel_guayaquil")?.value).toBe(1177);
    expect(metric("demanda", "demanda_total")?.value).toBe(5014);
  });

  it("keeps CENACE's own caveat with the data", () => {
    expect(snapshot.disclaimer).toMatch(/Datos preliminares del SCADA/);
    expect(snapshot.peak_historic_label).toBe("Miércoles, 15 de julio de 2026");
  });

  it("dates the day blocks and leaves the month and year blocks undated", () => {
    expect(spanishDayToIso("Sábado, 19 de septiembre de 2026")).toBe("2026-09-19");
    // "hasta el día 19" is a cut-off, not the period: a month-to-date block covers many days.
    expect(spanishDayToIso("Septiembre de 2026 (hasta el día 19)")).toBeNull();
    expect(spanishDayToIso("2026 (hasta el día 19 de septiembre)")).toBeNull();
    expect(metric("anual", "produccion_total")?.period_date).toBeNull();
  });
});

describe("cross-source reconciliation on 2026-09-19", () => {
  it("keeps the three national totals within a few percent of each other", () => {
    // ORDS says the SNI produced 104,862 MWh, Informacion Operativa 104,277 MWh (SCADA,
    // preliminary) and SMEC 107,967 MWh (commercial metering). They are different
    // measurements of the same day, so this guards against a unit error, not a data fix.
    const smecTotal = parseSmecInforme1(smec("informe1_2026-09-19.html"), "2026-09-19").rows.find(
      (r) => r.concepto === "total_generacion",
    )!.dia_kwh!;
    const operativaTotal = 104277 * 1000;
    const ordsTotal = 104862.229584 * 1000;
    const spread = (Math.max(smecTotal, operativaTotal, ordsTotal) - Math.min(smecTotal, operativaTotal, ordsTotal)) / smecTotal;
    expect(spread).toBeLessThan(0.05);
    expect(spread).toBeGreaterThan(0.01);
  });
});
