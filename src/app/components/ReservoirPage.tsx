/**
 * The parts of a reservoir's own page: the hero with its tiles, the whole record, and the floors
 * CELEC declares. Mazar's page and the template the other seven share are built from these, so
 * a reservoir's page differs from Mazar's only where Mazar has more to say — the forecast.
 */

import { Kicker } from "./Chrome.tsx";
import { RecordChart } from "./RecordChart.tsx";
import { ReservoirCutFor } from "./ReservoirParts.tsx";
import { Table } from "./DataTable.tsx";
import { MetresPerDay } from "./Fleet.tsx";
import { CatchmentMap, Locator, WhereFacts, catchmentFor } from "./Maps.tsx";
import { PAUTE_SITES, PauteCascade } from "./PauteCascade.tsx";
import { HistogramChart, HistogramLegend } from "./Histogram.tsx";
import { percentBelow } from "../../lib/chart/histogram.ts";
import { latest, series, window as windowOf } from "../../lib/site/data.ts";
import { SITES, isSiteId } from "../../lib/registry.ts";
import { median } from "../../lib/util/stats.ts";
import type { ForecastDocument } from "../../lib/site/documents.ts";
import { basinLabel, capitalise, dateWithYear, declarationLabel, longDate, num, pct, shortDate, signed } from "../../lib/site/format.ts";
import { countWord, inflowWords, isOperational, monthYear, wholeYears } from "../../lib/site/story.ts";
import type { ReservoirSnapshot } from "../../lib/publish/latest.ts";

export function ReservoirHero({
  reservoir,
  forecast,
  lede,
}: {
  reservoir: ReservoirSnapshot;
  forecast: ForecastDocument | null;
  /** The sentence that says what this reservoir is for, before the record's length. */
  lede: string;
}) {
  const level = reservoir.level;
  const inflow = reservoir.inflow;
  const primary = reservoir.bands[0] ?? null;
  if (level === null) return null;
  const years = wholeYears(level.first_reading, level.date);
  const span = level.observed_max_masl - level.observed_min_masl;

  return (
    <section className="shell detail-hero" aria-labelledby="reservoir-title">
      <div className="hero-copy rise">
        <div className="eyebrow">Embalse · {basinLabel(reservoir.basin)}</div>
        <h1 id="reservoir-title">{reservoir.label}</h1>
        <p className="hero-lede">
          {lede}{" "}
          {years >= 1 ? `${countWord(years, true)} ${years === 1 ? "año" : "años"} de datos diarios de nivel` : "Datos diarios de nivel"}{" "}
          desde el {longDate(level.first_reading)}
          {inflow ? `, y del agua que le llega desde el ${longDate(inflow.first_reading)}` : ""}.
        </p>
        <div className="tiles">
          <div className="tile">
            <span className="tile-label">Nivel hoy</span>
            <span className="tile-value num">{num(level.masl, 2)}</span>
            <span className="tile-note">metros sobre el nivel del mar · {shortDate(level.date)}</span>
          </div>
          {primary ? (
            <div className="tile">
              <span className="tile-label">De su rango de operación</span>
              <span className="tile-value num">{num(primary.band_pct, 1)}</span>
              <span className="tile-note">
                % · {num(primary.min_masl, 0)}–{num(primary.max_masl, 0)} m
              </span>
            </div>
          ) : (
            <div className="tile">
              <span className="tile-label">Del rango registrado</span>
              <span className="tile-value num">{num(span > 0 ? ((level.masl - level.observed_min_masl) / span) * 100 : null, 1)}</span>
              <span className="tile-note">
                % · {num(level.observed_min_masl, 0)}–{num(level.observed_max_masl, 0)} m, sin rango oficial
              </span>
            </div>
          )}
          <div className="tile">
            <span className="tile-label">Sube o baja, por día</span>
            <span className="tile-value num">{signed(reservoir.slopes_m_per_day.d7, 2)}</span>
            <span className="tile-note">
              <MetresPerDay />, última semana · último mes: {signed(reservoir.slopes_m_per_day.d30, 2)}
            </span>
          </div>
          {inflow ? (
            <div className="tile">
              <span className="tile-label">Agua que llega</span>
              <span className="tile-value num">{num(inflow.m3s, 1)}</span>
              <span className="tile-note">
                m³/s
                {inflowWords(inflow.climatology?.percentile_today) ? ` · ${inflowWords(inflow.climatology?.percentile_today)}` : ""}
              </span>
            </div>
          ) : null}
        </div>
      </div>
      <div className="rise rise-late">
        <ReservoirCutFor reservoir={reservoir} forecast={forecast} />
      </div>
    </section>
  );
}

export function RecordSection({ reservoir, forecast }: { reservoir: ReservoirSnapshot; forecast: ForecastDocument | null }) {
  const readings = [...series().get(reservoir.site, "cota_masl")].map(([date, value]) => ({ date, value }));
  if (readings.length < 14 || reservoir.level === null) return null;
  const primary = reservoir.bands[0] ?? null;
  const minimum = readings.reduce((a, b) => (b.value < a.value ? b : a));
  const years = wholeYears(readings[0]!.date, readings.at(-1)!.date);
  const own = forecast && forecast.site === reservoir.site ? forecast : null;
  const unverified = own?.thresholds.find((t) => t.status === "unverified") ?? null;
  const rules = [
    ...(unverified
      ? [{ level_masl: unverified.level_masl, label: `${num(unverified.level_masl, 0)} m · referencia de este sitio`, unverified: true }]
      : []),
    ...(primary
      ? [
          {
            level_masl: primary.min_masl,
            label: `${num(primary.min_masl, 0)} m · ${isOperational(primary.declaration) ? "mínimo de operación" : "mínimo oficial"}`,
            unverified: false,
          },
        ]
      : []),
  ];

  return (
    <section className="shell section section-tight" aria-labelledby="registro-title">
      <div className="section-intro narrow">
        <Kicker index="A">Toda su historia</Kicker>
        <h2 id="registro-title" className="section-title">
          {years >= 2 ? `${countWord(years, true)} años de subidas y bajadas.` : "Su registro, hasta hoy."}
        </h2>
        <p className="section-lede">
          El nivel de cada semana desde {readings[0]!.date.slice(0, 4)}.
          {primary ? ` La franja es su rango de operación, de ${num(primary.min_masl, 0)} a ${num(primary.max_masl, 0)} m.` : ""} Su punto
          más bajo fue el {longDate(minimum.date)}: {num(minimum.value, 2)} m
          {primary ? `, a ${num(minimum.value - primary.min_masl, 2)} m del mínimo` : ""}.
        </p>
      </div>
      <div className="panel">
        <RecordChart
          readings={readings}
          band={primary ? { min: primary.min_masl, max: primary.max_masl } : null}
          rules={rules}
          label={`Cota semanal de ${reservoir.label} desde el ${longDate(readings[0]!.date)} hasta el ${longDate(readings.at(-1)!.date)}`}
        />
      </div>
    </section>
  );
}

export function FloorsPanel({ reservoir }: { reservoir: ReservoirSnapshot }) {
  const bands = reservoir.bands;
  const name = reservoir.label;
  if (bands.length === 0) {
    const level = reservoir.level;
    return (
      <div className="panel">
        <h3 className="panel-title">Sin rango oficial</h3>
        <p className="panel-lede">
          No encontramos ninguna fuente pública con el nivel mínimo y máximo de operación de {name}. Por eso su columna en la portada va
          rayada y usa el rango que hemos registrado
          {level ? `, de ${num(level.observed_min_masl, 2)} a ${num(level.observed_max_masl, 2)} m` : ""}: describe lo que se ha visto, no
          lo que el embalse puede hacer.
        </p>
      </div>
    );
  }
  const operational = bands.find((b) => isOperational(b.declaration)) ?? null;
  const floors = [...new Set(bands.filter((b) => b !== operational).map((b) => b.min_masl))].sort((a, b) => a - b);
  const who = (floor: number) => {
    const declarations = bands.filter((b) => b.min_masl === floor).map((b) => declarationLabel(b));
    const counts = new Map<string, number>();
    for (const d of declarations) counts.set(d, (counts.get(d) ?? 0) + 1);
    return [...counts.entries()]
      .map(([label, n]) => (n === 1 ? `el ${label}` : `${n === 2 ? "ambos" : `los ${n}`} ${label.replace(/^(\S+)/, "$1s")}`))
      .join(" y ");
  };
  const title = operational
    ? `El mínimo de operación es ${num(operational.min_masl, 0)} m`
    : floors.length === 1
      ? "Un nivel mínimo oficial"
      : floors.length === 2
        ? "Dos niveles mínimos, los dos de CELEC"
        : `${countWord(floors.length, true)} niveles mínimos, todos de CELEC`;

  return (
    <div className="panel">
      <h3 className="panel-title">{title}</h3>
      <p className="panel-lede">
        {operational ? (
          <>
            CELEC Sur opera {name} hasta {num(operational.min_masl, 0)} m: por debajo, saca de servicio las turbinas por el riesgo de que
            entren sedimentos. Así lo ha dicho a la prensa y así operó en 2024.
            {floors.length > 0
              ? ` Su ficha técnica y sus reportes dan ${floors.map((f) => `${num(f, 0)} m según ${who(f)}`).join(" y ")}: son mínimos de diseño, que este sitio muestra pero no usa para medir el embalse.`
              : ""}
          </>
        ) : floors.length > 1 ? (
          <>
            CELEC da más de un mínimo para {name}: {floors.map((f) => `${num(f, 0)} m según ${who(f)}`).join(" y ")}. Este sitio no elige
            entre ellos: muestra {floors.length === 2 ? "los dos" : "todos"}.
          </>
        ) : (
          <>
            El mínimo de {name} es {num(floors[0], 0)} m según {who(floors[0]!)}.
          </>
        )}
      </p>
      <Table
        className="floors-table"
        caption={`Rangos de operación publicados para ${name}`}
        captionHidden
        columns={[{ label: "Rango", numeric: true }, { label: "Publicado en" }, { label: "Visto", wideOnly: true }]}
        rows={bands.map((b) => [
          `${num(b.min_masl, 0)} – ${num(b.max_masl, 0)} m`,
          <span key="who">
            {capitalise(declarationLabel(b))}
            <br />
            <span className="source">{b.source}</span>
          </span>,
          b.observed_from === b.observed_to ? dateWithYear(b.observed_to) : `${monthYear(b.observed_from)} → ${monthYear(b.observed_to)}`,
        ])}
      />
      <p className="fine spaced">
        Hoy el agua está al {pct(bands[0]!.band_pct, 1)} del rango de {num(bands[0]!.min_masl, 0)} a {num(bands[0]!.max_masl, 0)} m. Ese
        porcentaje mide altura, no cuánta agua hay guardada.
      </p>
    </div>
  );
}

/** The reservoir on the map: the area that drains into its dam, the rivers in it and the dams around it. */
export function WhereSection({ reservoir }: { reservoir: ReservoirSnapshot }) {
  if (catchmentFor(reservoir.site) === null) return null;
  return (
    <section className="shell split wide-left map-split" aria-labelledby="donde-title">
      <div className="panel map-panel">
        <CatchmentMap site={reservoir.site} label={reservoir.label} />
      </div>
      <div className="panel">
        <div className="where-head">
          <h3 id="donde-title" className="panel-title">
            Dónde está
          </h3>
          <Locator site={reservoir.site} />
        </div>
        <p className="panel-lede">
          La mancha es su cuenca: toda la lluvia que cae dentro llega, por los ríos dibujados, a la presa. Los tonos marcan cada 1.000 m de
          altura; las líneas punteadas, las cuencas de las presas vecinas.
        </p>
        <WhereFacts site={reservoir.site} label={reservoir.label} />
      </div>
    </section>
  );
}

/** For Mazar, Amaluza and Sopladora: the three on one river, in profile. */
export function CascadeSection({ reservoir }: { reservoir: ReservoirSnapshot }) {
  if (!PAUTE_SITES.has(reservoir.site)) return null;
  return (
    <section className="shell" aria-label="La cascada del Paute">
      <PauteCascade reservoirs={latest()?.reservoirs ?? []} site={reservoir.site} />
    </section>
  );
}

/** Fewer days than this and a histogram is a handful of bars that say nothing about the river. */
const HISTOGRAM_MIN_DAYS = 60;

/** The days the outline over the bars covers. */
const RECENT_DAYS = 365;

/**
 * The plant whose energy belongs with this reservoir: the reservoir itself where it is also a
 * plant, and the plant it feeds where it is not — Amaluza's water is turbined at Molino.
 */
export function generationSiteOf(site: string): string | null {
  if (!isSiteId(site)) return null;
  const entry = SITES[site];
  if (entry.kind === "reservoir_and_plant") return site;
  return "plant" in entry ? entry.plant : null;
}

interface Distribution {
  record: number[];
  recent: number[] | null;
  today: { date: string; value: number };
  first: string;
}

/** A daily series as a histogram's inputs, scaled by `factor`, or null when it is too short. */
function distributionOf(site: string, variable: string, factor = 1): Distribution | null {
  const daily = series().get(site, variable);
  if (daily.size < HISTOGRAM_MIN_DAYS) return null;
  const record = [...daily.values()].map((v) => v * factor);
  const recentPoints = windowOf(daily, RECENT_DAYS);
  const recent = recentPoints.length < daily.size && recentPoints.length >= 30 ? recentPoints.map((p) => p.value * factor) : null;
  const newest = recentPoints.at(-1)!;
  return { record, recent, today: { date: newest.date, value: newest.value * factor }, first: [...daily.keys()][0]! };
}

/**
 * How the reservoir's days are spread: the water that arrives and the energy its plant makes,
 * each against its whole record, with the last year over it and today ruled across.
 */
export function DistributionSection({ reservoir }: { reservoir: ReservoirSnapshot }) {
  const inflow = distributionOf(reservoir.site, "caudal_m3s");
  const plant = generationSiteOf(reservoir.site);
  const energy = plant ? distributionOf(plant, "produccion_mwh", 1 / 1000) : null;
  if (inflow === null && energy === null) return null;
  const plantLabel = plant && plant !== reservoir.site && isSiteId(plant) ? SITES[plant].label : null;

  return (
    <section className="shell section section-tight" aria-labelledby="reparto-title">
      <div className="section-intro narrow">
        <Kicker index="B">Cómo se reparten sus días</Kicker>
        <h2 id="reparto-title" className="section-title">
          Cuánta agua llega y cuánta energía sale, día por día.
        </h2>
        <p className="section-lede">
          Cada barra es la parte de los días registrados en que el valor cayó en ese rango: las altas son lo habitual, las de los extremos,
          lo raro. La línea encima es el último año, y la raya, el dato más reciente.
        </p>
      </div>
      <div className={inflow && energy ? "split even" : undefined}>
        {inflow ? (
          <div className="panel tight">
            <h3 className="panel-title">El agua que llega</h3>
            <p className="panel-lede">{distributionWords(inflow, "m³/s", 1, "llegaron", "llegan")}</p>
            <HistogramLegend recent={inflow.recent !== null} />
            <HistogramChart
              record={inflow.record}
              recent={inflow.recent}
              today={inflow.today.value}
              unit="m³/s"
              label={`Reparto del agua que llega a ${reservoir.label} cada día, desde el ${longDate(inflow.first)}`}
              subject={`Agua que llega a ${reservoir.label}`}
            />
          </div>
        ) : null}
        {energy ? (
          <div className="panel tight">
            <h3 className="panel-title">{plantLabel ? `La energía de ${plantLabel}` : "La energía que genera"}</h3>
            <p className="panel-lede">
              {plantLabel ? `El agua de ${reservoir.label} se turbina en la central ${plantLabel}. ` : ""}
              {distributionWords(energy, "GWh", 2, "generó", "genera")}
              {zeroDaysWords(energy.record)}
            </p>
            <HistogramLegend recent={energy.recent !== null} />
            <HistogramChart
              record={energy.record}
              recent={energy.recent}
              today={energy.today.value}
              unit="GWh"
              label={`Reparto de la energía que genera ${plantLabel ?? reservoir.label} cada día, desde el ${longDate(energy.first)}`}
              subject={`Energía diaria de ${plantLabel ?? reservoir.label}`}
            />
          </div>
        ) : null}
      </div>
    </section>
  );
}

/** "El 24 de octubre de 2026 llegaron 27,9 m³/s: más que en el 14 % de los días desde el 10 de febrero de 2010. En la mitad de los días llegan menos de 60,5 m³/s." */
function distributionWords(d: Distribution, unit: string, digits: number, past: string, present: string): string {
  const below = percentBelow(d.record, d.today.value);
  const half = median(d.record);
  return (
    `El ${longDate(d.today.date)} ${past} ${num(d.today.value, digits)} ${unit}` +
    (below !== null ? `: más que en el ${num(below, 0)} % de los días desde el ${longDate(d.first)}.` : ".") +
    (half !== null ? ` En la mitad de los días ${present} menos de ${num(half, digits)} ${unit}.` : "")
  );
}

/** Days the plant made nothing, said once, because they are the first bar and otherwise look like a dry river. */
function zeroDaysWords(record: number[]): string {
  const zeros = record.filter((v) => v === 0).length;
  if (zeros === 0) return "";
  return ` En ${zeros === 1 ? "un día" : `${num(zeros, 0)} días`} (${pct((zeros / record.length) * 100, 1)}) no generó nada: ${zeros === 1 ? "está" : "están"} en la primera barra.`;
}
