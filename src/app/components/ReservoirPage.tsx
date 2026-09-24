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
import { series } from "../../lib/site/data.ts";
import type { ForecastDocument } from "../../lib/site/documents.ts";
import { basinLabel, capitalise, dateWithYear, declarationLabel, longDate, num, pct, shortDate, signed } from "../../lib/site/format.ts";
import { countWord, inflowWords, monthYear, wholeYears } from "../../lib/site/story.ts";
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
    ...(primary ? [{ level_masl: primary.min_masl, label: `${num(primary.min_masl, 0)} m · mínimo oficial`, unverified: false }] : []),
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
  const floors = [...new Set(bands.map((b) => b.min_masl))].sort((a, b) => a - b);
  const who = (floor: number) => {
    const declarations = bands.filter((b) => b.min_masl === floor).map((b) => declarationLabel(b));
    const counts = new Map<string, number>();
    for (const d of declarations) counts.set(d, (counts.get(d) ?? 0) + 1);
    return [...counts.entries()]
      .map(([label, n]) => (n === 1 ? `el ${label}` : `${n === 2 ? "ambos" : `los ${n}`} ${label.replace(/^(\S+)/, "$1s")}`))
      .join(" y ");
  };
  const title =
    floors.length === 1
      ? "Un nivel mínimo oficial"
      : floors.length === 2
        ? "Dos niveles mínimos, los dos de CELEC"
        : `${countWord(floors.length, true)} niveles mínimos, todos de CELEC`;

  return (
    <div className="panel">
      <h3 className="panel-title">{title}</h3>
      <p className="panel-lede">
        {floors.length > 1 ? (
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
