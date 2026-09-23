/**
 * Mazar's own page: the one reservoir in the fleet with weeks of storage, and so the one this
 * project forecasts.
 *
 * The home page answers where Mazar is going; this one answers how far the answer can be
 * trusted. It carries the whole record the forecast is fitted on, the analogue years behind the
 * days-to-threshold numbers, the two times in 2024 the model was tested against a real crossing,
 * and the two floors CELEC publishes for it — side by side, because this site does not choose
 * between them.
 */

import type { Metadata } from "next";
import type React from "react";
import { Contours, Footer, Kicker, Masthead, NAV } from "../../components/Chrome.tsx";
import { InflowChart } from "../../components/InflowChart.tsx";
import { InflowLegend, MazarCut, inflowWindow } from "../../components/MazarParts.tsx";
import { RecordChart } from "../../components/RecordChart.tsx";
import { apiDocument, dataDate, latest, series } from "../../../lib/site/data.ts";
import type { CrossingThreshold, ForecastDocument } from "../../../lib/site/documents.ts";
import { declarationLabel, longDate, num, pct, shortDate, signed } from "../../../lib/site/format.ts";
import { countWord, monthYear, wholeYears } from "../../../lib/site/story.ts";
import type { ReservoirSnapshot } from "../../../lib/publish/latest.ts";

export const metadata: Metadata = {
  title: "Mazar — hydro-look",
  description:
    "Cota, pronóstico a 90 días, años análogos y los dos mínimos declarados de Mazar, el embalse con más " +
    "almacenamiento del Ecuador. No es una fuente oficial.",
};

export default function MazarPage() {
  const now = latest();
  const forecast = apiDocument<ForecastDocument>("forecast.json");
  const mazar = now?.reservoirs.find((r) => r.site === "mazar") ?? null;
  const asOf = dataDate(now);

  return (
    <div className="site">
      <Contours height={700} />
      <Masthead
        asOf={asOf}
        links={NAV}
        crumbs={
          <nav className="crumbs" aria-label="Ruta">
            <a href="/">Inicio</a>
            <span aria-hidden="true">/</span>
            <a href="/#embalses">Embalses</a>
            <span aria-hidden="true">/</span>
            <span aria-current="page">Mazar</span>
          </nav>
        }
      />
      <main className="stack-lg">
        {mazar ? <Hero mazar={mazar} forecast={forecast} /> : null}
        {mazar ? <Record mazar={mazar} forecast={forecast} /> : null}
        {forecast ? (
          <section className="shell split even" aria-label="Umbrales y validación">
            <Crossing forecast={forecast} />
            <Foresight forecast={forecast} />
          </section>
        ) : null}
        {mazar ? (
          <section className="shell split lean-left" aria-label="Caudal y mínimos declarados">
            <Inflow mazar={mazar} />
            <Floors mazar={mazar} />
          </section>
        ) : null}
        <div className="shell footer-bar" style={{ paddingBlock: 0 }}>
          <a href="/" className="btn btn-ghost">
            ← Volver al inicio
          </a>
        </div>
      </main>
      <Footer />
    </div>
  );
}

/* --------------------------------------------------------------------- hero */

function Hero({ mazar, forecast }: { mazar: ReservoirSnapshot; forecast: ForecastDocument | null }) {
  const level = mazar.level;
  const inflow = mazar.inflow;
  const primary = mazar.bands[0] ?? null;
  if (level === null) return null;
  const years = wholeYears(level.first_reading, level.date);

  return (
    <section className="shell detail-hero" aria-labelledby="mazar-title">
      <div className="hero-copy rise" style={{ gap: 26 }}>
        <div className="eyebrow">Embalse · cuenca del Paute</div>
        <h1 id="mazar-title">{mazar.label}</h1>
        <p className="hero-lede">
          El único embalse de la flota con almacenamiento de varias semanas, y por eso el que se pronostica.{" "}
          {countWord(years, true)} años de cota diaria desde el {longDate(level.first_reading)}
          {inflow ? ` y caudal desde el ${longDate(inflow.first_reading)}` : ""}.
        </p>
        <div className="tiles">
          <div className="tile">
            <span className="tile-label">Cota hoy</span>
            <span className="tile-value num">{num(level.masl, 2)}</span>
            <span className="tile-note">m s. n. m. · {shortDate(level.date)}</span>
          </div>
          {primary ? (
            <div className="tile">
              <span className="tile-label">De la banda</span>
              <span className="tile-value num">{num(primary.band_pct, 1)}</span>
              <span className="tile-note">
                % · {num(primary.min_masl, 0)}–{num(primary.max_masl, 0)} m
              </span>
            </div>
          ) : null}
          <div className="tile">
            <span className="tile-label">Tendencia 7 d</span>
            <span className="tile-value num">{signed(mazar.slopes_m_per_day.d7, 2)}</span>
            <span className="tile-note">m/día · 30 d: {signed(mazar.slopes_m_per_day.d30, 2)}</span>
          </div>
          {inflow ? (
            <div className="tile">
              <span className="tile-label">Caudal</span>
              <span className="tile-value num">{num(inflow.m3s, 1)}</span>
              <span className="tile-note">
                m³/s
                {inflow.climatology?.percentile_today != null ? ` · percentil ${num(inflow.climatology.percentile_today, 0)}` : ""}
              </span>
            </div>
          ) : null}
        </div>
      </div>
      <div className="rise rise-late">
        <MazarCut mazar={mazar} forecast={forecast} />
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------- record */

function Record({ mazar, forecast }: { mazar: ReservoirSnapshot; forecast: ForecastDocument | null }) {
  const readings = [...series().get("mazar", "cota_masl")].map(([date, value]) => ({ date, value }));
  if (readings.length < 14 || mazar.level === null) return null;
  const primary = mazar.bands[0] ?? null;
  const minimum = readings.reduce((a, b) => (b.value < a.value ? b : a));
  const years = wholeYears(readings[0]!.date, readings.at(-1)!.date);
  const unverified = forecast?.thresholds.find((t) => t.status === "unverified") ?? null;
  const rules = [
    ...(unverified ? [{ level_masl: unverified.level_masl, label: `${num(unverified.level_masl, 0)} m · marcador propio`, unverified: true }] : []),
    ...(primary ? [{ level_masl: primary.min_masl, label: `${num(primary.min_masl, 0)} m · mínimo declarado`, unverified: false }] : []),
  ];

  const chart = {
    readings,
    band: primary ? { min: primary.min_masl, max: primary.max_masl } : null,
    rules,
    label: `Cota semanal de Mazar desde el ${longDate(readings[0]!.date)} hasta el ${longDate(readings.at(-1)!.date)}`,
  };

  return (
    <section className="shell section" style={{ gap: 28 }} aria-labelledby="registro-title">
      <div className="section-intro" style={{ maxWidth: 760 }}>
        <Kicker index="A">El registro completo</Kicker>
        <h2 id="registro-title" className="section-title">
          {countWord(years, true)} años de subidas y bajadas.
        </h2>
        <p className="section-lede">
          Cota semanal desde {readings[0]!.date.slice(0, 4)}.
          {primary ? ` La franja es la banda declarada, ${num(primary.min_masl, 0)}–${num(primary.max_masl, 0)} m.` : ""} El{" "}
          {longDate(minimum.date)} Mazar tocó el mínimo del registro, {num(minimum.value, 2)} m
          {primary ? `, a ${num(minimum.value - primary.min_masl, 2)} m del piso` : ""}.
        </p>
      </div>
      <div className="panel">
        <div className="only-wide">
          <RecordChart {...chart} />
        </div>
        <div className="only-compact">
          <RecordChart {...chart} compact />
        </div>
      </div>
    </section>
  );
}

/* ----------------------------------------------------------------- crossing */

const SCENARIO_ES: Record<string, string> = { dry: "Seco", median: "Mediano", wet: "Húmedo" };

function Crossing({ forecast }: { forecast: ForecastDocument }) {
  const threshold: CrossingThreshold | undefined =
    forecast.days_to_threshold.thresholds.find((t) => t.status === "unverified") ?? forecast.days_to_threshold.thresholds[0];
  if (!threshold) return null;
  const all = threshold.across_all_analogue_years;
  const level = num(threshold.level_masl, 0);

  return (
    <div className="panel">
      <h3 className="panel-title" style={{ marginBottom: 6 }}>
        ¿Cuándo cruzaría los {level} m?
      </h3>
      <p className="panel-lede" style={{ marginBottom: 18 }}>
        Cada año análogo es un año real de caudal —de los registrados para esta época del año— pasado por la misma
        regla de descarga.
        {threshold.status === "unverified" ? ` ${level} m es un marcador de este proyecto (PLAN.md §7), no de CELEC.` : ""}
      </p>
      <ol
        className="years"
        style={{ "--count": all.analogue_years } as React.CSSProperties}
        aria-label={`${all.years_that_cross} de ${all.analogue_years} años análogos cruzan los ${level} m`}
      >
        {Array.from({ length: all.analogue_years }, (_, i) => (
          <li key={i} className={i < all.years_that_cross ? "crosses" : undefined} />
        ))}
      </ol>
      <div className="years-caption">
        <span>
          <strong>
            {all.years_that_cross} de {all.analogue_years}
          </strong>{" "}
          años análogos cruzan
        </span>
        {all.p10_days !== null ? <span>en el 10 % más seco, en {all.p10_days} días</span> : null}
      </div>
      <div className="grid-table head scenarios-table" aria-hidden="true">
        <span>Escenario</span>
        <span>Año</span>
        <span>Caudal medio</span>
        <span>Resultado</span>
      </div>
      {threshold.scenarios.map((s) => (
        <div className="grid-table scenarios-table" key={s.scenario}>
          <span style={{ fontWeight: 600 }}>{SCENARIO_ES[s.scenario] ?? s.scenario}</span>
          <span className="mono num">{s.analogYear}</span>
          <span className="mono num">{num(s.inflowMeanM3s, 2)} m³/s</span>
          <span>
            {s.crossesOn
              ? `cruza el ${shortDate(s.crossesOn)} ${s.crossesOn.slice(0, 4)} · ${num(s.days, 0)} días`
              : `no cruza · mínimo ${num(s.minimumLevelMasl, 2)} m`}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ---------------------------------------------------------------- foresight */

function Foresight({ forecast }: { forecast: ForecastDocument }) {
  const check = forecast.crisis_check;
  const years = [...new Set(check.episodes.map((e) => e.crossed_on.slice(0, 4)))];
  return (
    <div className="panel">
      <h3 className="panel-title" style={{ marginBottom: 6 }}>
        ¿Lo habría visto venir?
      </h3>
      <p className="panel-lede" style={{ marginBottom: 20 }}>
        Aplicado a las {countWord(check.episodes.length)} veces que Mazar bajó de {num(check.threshold_masl, 0)} m
        {years.length === 1 ? ` en ${years[0]}` : ""}, desde {check.origins_considered} orígenes mensuales.
      </p>
      <div className="foresight">
        {check.episodes.map((e) => {
          const verdict =
            e.p50_lead_time_days !== null
              ? { text: `La mediana lo anticipó ${e.p50_lead_time_days} días antes.`, pill: `${e.p50_lead_time_days} días antes`, tone: "good" }
              : e.p10_lead_time_days !== null
                ? {
                    text: `La cola seca (p10) lo marcó ${e.p10_lead_time_days} días antes; la mediana, no.`,
                    pill: `${e.p10_lead_time_days} días antes`,
                    tone: "watch",
                  }
                : { text: "Ni la mediana ni el caso seco lo anticiparon.", pill: "No anticipado", tone: "deficit" };
          return (
            <div key={e.crossed_on}>
              <div>
                <strong>{longDate(e.crossed_on)}</strong>
                <p>{verdict.text}</p>
              </div>
              <span className="pill">
                <span className={`dot tone-${verdict.tone}`} aria-hidden="true" />
                {verdict.pill}
              </span>
            </div>
          );
        })}
        <div>
          <div>
            <strong>Falsas alarmas</strong>
            <p>Veces que la mediana anunció un cruce que no ocurrió.</p>
          </div>
          <span className="count num">
            {check.false_alarms_p50} <small>de {check.origins_considered}</small>
          </span>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------- inflow */

function Inflow({ mazar }: { mazar: ReservoirSnapshot }) {
  const data = inflowWindow();
  const climatology = mazar.inflow?.climatology ?? null;
  if (data === null) return null;
  return (
    <div className="panel">
      <div className="figure-row">
        <div>
          <h3 className="panel-title" style={{ marginBottom: 4 }}>
            Caudal frente a su historia
          </h3>
          {climatology ? (
            <p className="panel-lede">
              p10 {num(climatology.p10, 1)} · p50 {num(climatology.p50, 1)} · p90 {num(climatology.p90, 1)} m³/s en esta
              época del año, {climatology.years} años.
            </p>
          ) : null}
        </div>
        {climatology?.percentile_today != null ? (
          <span className="big-figure num" style={{ fontSize: 46, lineHeight: 1 }}>
            p{Math.round(climatology.percentile_today)}
          </span>
        ) : null}
      </div>
      <div className="only-wide">
        <InflowChart
          readings={data.readings}
          ribbon={data.band}
          width={640}
          height={280}
          label="Caudal de entrada a Mazar del último año frente a su franja histórica p10 a p90"
        />
      </div>
      <div className="only-compact">
        <InflowChart compact readings={data.readings} ribbon={data.band} label="Caudal de entrada a Mazar del último año frente a su franja histórica p10 a p90" />
      </div>
      <InflowLegend />
    </div>
  );
}

/* ------------------------------------------------------------------- floors */

function Floors({ mazar }: { mazar: ReservoirSnapshot }) {
  const bands = mazar.bands;
  if (bands.length === 0) return null;
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
    floors.length === 1 ? "Un piso declarado" : floors.length === 2 ? "Dos pisos, los dos de CELEC" : `${countWord(floors.length, true)} pisos, todos de CELEC`;

  return (
    <div className="panel">
      <h3 className="panel-title" style={{ marginBottom: 6 }}>
        {title}
      </h3>
      <p className="panel-lede" style={{ marginBottom: 16 }}>
        {floors.length > 1 ? (
          <>
            El mínimo de Mazar es {floors.map((f) => `${num(f, 0)} m según ${who(f)}`).join(" y ")}. Este sitio no elige
            entre ellos: dibuja {floors.length === 2 ? "los dos" : "todos"}.
          </>
        ) : (
          <>
            El mínimo de Mazar es {num(floors[0]!, 0)} m según {who(floors[0]!)}.
          </>
        )}
      </p>
      {bands.map((b) => (
        <div className="grid-table floors-table" key={`${b.source}-${b.min_masl}`}>
          <span className="mono num">
            {num(b.min_masl, 0)} – {num(b.max_masl, 0)} m
          </span>
          <span>
            {capitalise(declarationLabel(b))}
            <br />
            <span className="source">{b.source}</span>
          </span>
          <span className="span">
            {b.observed_from === b.observed_to
              ? `${shortDate(b.observed_to)} ${b.observed_to.slice(0, 4)}`
              : `${monthYear(b.observed_from)} → ${monthYear(b.observed_to)}`}
          </span>
        </div>
      ))}
      <p className="fine" style={{ marginTop: 14 }}>
        Hoy la cota está en el {pct(bands[0]!.band_pct, 1)} de la banda {num(bands[0]!.min_masl, 0)}–{num(bands[0]!.max_masl, 0)} m.
        La banda mide metros de carga útil, no agua almacenada.
      </p>
    </div>
  );
}

function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
