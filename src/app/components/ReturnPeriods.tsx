/**
 * Today's inflow against the floods the river is known for: GEOGLOWS' return periods, which
 * INAMHI's river viewer shows, beside the same statistic fitted on CELEC's own record. Both are
 * shown because they disagree at most dams, and the panel says by how much rather than choosing.
 */

import { Table } from "./DataTable.tsx";
import type { ReservoirSnapshot } from "../../lib/publish/latest.ts";
import { longDate, num } from "../../lib/site/format.ts";
import { returnPeriodAgreement, returnPeriodReachedWords } from "../../lib/site/story.ts";

/** The panel in its own full-width section, or nothing when neither source has numbers for this reservoir. */
export function ReturnPeriodsSection({ reservoir }: { reservoir: ReservoirSnapshot }) {
  const inflow = reservoir.inflow;
  const geoglows = inflow?.return_periods.geoglows ?? null;
  const measured = inflow?.return_periods.measured ?? null;
  if (!inflow || (geoglows === null && measured === null)) return null;
  const periods = (geoglows?.daily ?? measured?.values ?? []).map((v) => v.years);
  const at = (table: { years: number; m3s: number }[] | undefined, years: number) => table?.find((v) => v.years === years)?.m3s ?? null;

  return (
    <section className="shell" aria-label="Crecidas y periodos de retorno">
      <div className="panel">
        <h3 className="panel-title">Crecidas: cada cuántos años llega tanta agua</h3>
        <p className="panel-lede">
          La «crecida de 10 años» es el caudal que el río alcanza, en promedio, una vez cada diez años. El INAMHI las muestra en su visor de
          ríos con el modelo GEOGLOWS; aquí están junto a las que salen de los datos que publica CELEC.
        </p>
        <p>
          Hoy llegan {num(inflow.m3s, 1)} m³/s:{" "}
          {geoglows ? `según GEOGLOWS, ${returnPeriodReachedWords(geoglows.reached_years, geoglows.daily[0]!.m3s)}` : ""}
          {geoglows && measured ? "; " : ""}
          {measured ? `según el registro de CELEC, ${returnPeriodReachedWords(measured.reached_years, measured.values[0]!.m3s)}` : ""}.
        </p>
        <Table
          className="floors-table"
          caption={`Caudal de cada periodo de retorno en ${reservoir.label}, en m³/s`}
          captionHidden
          columns={[
            { label: "Una vez cada", numeric: true },
            ...(geoglows ? [{ label: "GEOGLOWS (INAMHI)", numeric: true }] : []),
            ...(measured ? [{ label: "Registro de CELEC", numeric: true }] : []),
          ]}
          rows={periods.map((years) => [
            `${years} años`,
            ...(geoglows ? [num(at(geoglows.daily, years), 0)] : []),
            ...(measured ? [num(at(measured.values, years), 0)] : []),
          ])}
        />
        <p className="fine spaced">
          {geoglows && measured ? `${returnPeriodAgreement(geoglows.daily[0]!.m3s, measured.values[0]!.m3s)} ` : ""}
          {geoglows
            ? `GEOGLOWS simula el río desde 1940; son sus valores diarios, en su río ${geoglows.river_id}, cuya cuenca es un ` +
              `${num(Math.abs(geoglows.area_diff_pct), 1)} % ${geoglows.area_diff_pct < 0 ? "más pequeña" : "más grande"} que la que delimitamos. `
            : "Este embalse todavía no tiene asignado un río de GEOGLOWS: se asigna comparando la cuenca que delimitamos con la del modelo. "}
          {measured
            ? `El registro de CELEC tiene ${measured.years} años completos (${measured.first_year}–${measured.last_year}); su mayor caudal fue ` +
              `${num(measured.record_m3s, 0)} m³/s el ${longDate(measured.record_date)}. Con tan pocos años, las crecidas de 50 y 100 años son una extrapolación. `
            : "El registro de CELEC todavía no tiene cinco años completos, que es lo mínimo para calcularlas. "}
          {geoglows ? "Los datos de GEOGLOWS tienen licencia CC BY-NC-SA 4.0." : ""}
        </p>
      </div>
    </section>
  );
}
