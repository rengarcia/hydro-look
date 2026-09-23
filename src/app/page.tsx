/**
 * The site's home page. Rendered to static HTML at build time from the committed data.
 *
 * The order is the order of the questions: what is the country running on today, what does the
 * day's reading say, how full are the reservoirs, where is the one with real storage going, is
 * the water arriving, where did yesterday's electricity come from, will there be enough, and can
 * any of it be trusted. Every section that shows a modelled number shows the measurement of that
 * model beside it, because a forecast without its skill score is a number with no units.
 *
 * Every headline is built from the day's numbers by `lib/site/story.ts`, never written into the
 * page: a sentence that stops being true is a wrong number in large type.
 */

import type React from "react";
import { Contours, Footer, Masthead, NAV, REPO, SectionIntro } from "./components/Chrome.tsx";
import { InflowLegend, MazarCut, PercentileTrack, inflowWindow } from "./components/MazarParts.tsx";
import { FanChart } from "./components/FanChart.tsx";
import { Fleet } from "./components/Fleet.tsx";
import { InflowChart } from "./components/InflowChart.tsx";
import { MixChart, mixToken } from "./components/MixChart.tsx";
import { apiDocument, dataDate, latest, mix, series, window as windowOf } from "../lib/site/data.ts";
import type {
  AdequacyDocument,
  ForecastDocument,
  NarrativeDocument,
  StatusDocument,
} from "../lib/site/documents.ts";
import { conceptLabel, feedLabel, findingText, longDate, num, pct, shortDate, signed } from "../lib/site/format.ts";
import {
  SKILL_TIE,
  adequacyHeadline,
  countWord,
  direction,
  inflowHeadline,
  joinDays,
  marginClause,
  modelShort,
  monthName,
  monthSpan,
  skillTone,
  tierOf,
  weekday,
} from "../lib/site/story.ts";
import type { LatestDocument, ReservoirSnapshot } from "../lib/publish/latest.ts";

/** Days of history drawn behind the forecast, and of inflow and national mix on their charts. */
const FAN_HISTORY_DAYS = 180;
const MIX_DAYS = 180;

const THERMAL = [
  "generacion_turbinas_gas",
  "generacion_motores_bunker",
  "generacion_vapor_bunker",
  "generacion_turbinas_diesel",
];

export default function Page() {
  const now = latest();
  const forecast = apiDocument<ForecastDocument>("forecast.json");
  const adequacy = apiDocument<AdequacyDocument>("adequacy.json");
  const status = apiDocument<StatusDocument>("status.json");
  const narrative = apiDocument<NarrativeDocument>("narrative.json");
  const asOf = dataDate(now);
  const mazar = now?.reservoirs.find((r) => r.site === "mazar") ?? null;

  return (
    <div className="site">
      <Contours />
      <Masthead asOf={asOf} links={NAV} />
      <main className="stack-xl">
        <div>
          <Hero now={now} mazar={mazar} forecast={forecast} adequacy={adequacy} asOf={asOf} />
          <Today now={now} adequacy={adequacy} narrative={narrative} />
        </div>
        <Reading narrative={narrative} forecast={forecast} />
        <Reservoirs now={now} />
        <Mazar forecast={forecast} />
        <div className="shell split even">
          <Inflow mazar={mazar} />
          <National now={now} />
        </div>
        <Adequacy adequacy={adequacy} />
        <Data status={status} narrative={narrative !== null} />
        <Method forecast={forecast} adequacy={adequacy} />
      </main>
      <Footer />
    </div>
  );
}

/* --------------------------------------------------------------------- hero */

function Hero({
  now,
  mazar,
  forecast,
  adequacy,
  asOf,
}: {
  now: LatestDocument | null;
  mazar: ReservoirSnapshot | null;
  forecast: ForecastDocument | null;
  adequacy: AdequacyDocument | null;
  asOf: string | null;
}) {
  const national = now?.national ?? null;
  const share = national?.hydro_share_pct != null ? Math.round(national.hydro_share_pct) : null;
  const slope = mazar?.slopes_m_per_day.d7 ?? null;
  const dir = direction(slope);
  const percentile = mazar?.inflow?.climatology?.percentile_today ?? null;
  const worst = adequacy?.current.worst_tier ?? null;
  const worstTier = tierOf(worst);
  const clause =
    adequacy && worst
      ? marginClause(worst, adequacy.current.worst_tier_horizon_days, adequacy.horizons.at(-1)?.horizon_days ?? 90)
      : null;

  return (
    <section className="shell hero" aria-labelledby="hero-title">
      <div className="hero-copy rise">
        {asOf ? (
          <div className="eyebrow">
            Ecuador · {weekday(asOf)} {longDate(asOf)}
          </div>
        ) : null}
        <h1 id="hero-title">
          {share !== null ? (
            <>
              El agua encendió <em>{share} de cada 100</em> kWh del país.
            </>
          ) : (
            "El sistema hidroeléctrico del Ecuador, día a día."
          )}
        </h1>
        {mazar?.level ? (
          <p className="hero-lede">
            Mazar, el único embalse con reserva para semanas, está a {num(mazar.level.masl, 2)} m
            {dir === "flat" ? " y se mantiene estable" : ` y ${dir === "down" ? "baja" : "sube"} ${num(Math.abs(slope!), 2)} m al día`}.
            {percentile !== null ? ` El caudal que le entra está en el percentil ${num(percentile, 0)} de su historia.` : ""}
            {clause && worstTier ? (
              <>
                {" "}
                {clause.before} <strong className={`tone-${worstTier.tone}`}>{clause.word}</strong>.
              </>
            ) : null}
          </p>
        ) : null}
        <div className="actions">
          <a href="#mazar" className="btn btn-solid">
            Ver hacia dónde va Mazar
          </a>
          <a href="#suficiencia" className="btn btn-ghost">
            ¿Alcanza la energía?
          </a>
        </div>
      </div>
      <div className="rise rise-late">{mazar ? <MazarCut mazar={mazar} forecast={forecast} /> : null}</div>
    </section>
  );
}

/* -------------------------------------------------------------------- today */

interface Stat {
  label: string;
  chip: string;
  value: string;
  unit: string;
  note: string;
}

function Today({
  now,
  adequacy,
  narrative,
}: {
  now: LatestDocument | null;
  adequacy: AdequacyDocument | null;
  narrative: NarrativeDocument | null;
}) {
  const national = now?.national ?? null;
  const stats: Stat[] = [];
  if (national) {
    const gwh = (concept: string) => national.supply_gwh.find((p) => p.concept === concept)?.gwh ?? 0;
    const thermal = THERMAL.reduce((sum, c) => sum + gwh(c), 0);
    const regime = adequacy?.assumptions.import_regime;
    stats.push(
      {
        label: "Hidroeléctrica",
        chip: "var(--water)",
        value: num(national.hydro_share_pct, 1),
        unit: "%",
        note: `de la electricidad del ${shortDate(national.date)}: ${num(gwh("generacion_hidraulica"), 1)} GWh`,
      },
      {
        label: "Térmica",
        chip: "var(--t1)",
        value: num(national.thermal_share_pct, 1),
        unit: "%",
        note: `búnker, diésel y gas: ${num(thermal, 1)} GWh`,
      },
      {
        label: "Importación",
        chip: "var(--import)",
        value: num(national.import_share_pct, 1),
        unit: "%",
        note:
          regime?.state === "cutoff"
            ? `Colombia no está enviando: ${num(regime.trailing_gwh_day, 2)} GWh/día en ${regime.window_days} días`
            : `${num(national.total_import_gwh, 2)} GWh desde Colombia`,
      },
    );
  }
  const rain = narrative?.basis?.precipitation_16d ?? null;
  if (rain) {
    stats.push({
      label: `Lluvia, ${rain.days} días`,
      chip: "var(--water-2)",
      value: num(rain.forecast_total_mm, 1),
      unit: "mm",
      note:
        (rain.percentile_vs_climatology !== null ? `percentil ${num(rain.percentile_vs_climatology, 0)} · ` : "") +
        (rain.coordinate_status === "provisional" ? "un punto provisional del Paute" : "cuenca del Paute"),
    });
  }
  const enso = narrative?.basis?.enso ?? null;
  if (enso) {
    const phase = { el_nino: "El Niño", la_nina: "La Niña", neutral: "Neutral" }[enso.phase] ?? enso.phase;
    const earliest = enso.previous?.at(-1) ?? null;
    const trend =
      earliest === null
        ? ""
        : enso.oni > earliest.oni
          ? `, en ascenso desde ${num(earliest.oni, 2)} en ${monthName(earliest.month)}`
          : enso.oni < earliest.oni
            ? `, en descenso desde ${num(earliest.oni, 2)} en ${monthName(earliest.month)}`
            : `, igual que en ${monthName(earliest.month)}`;
    stats.push({
      label: `ENSO · ONI ${monthName(enso.month)}`,
      chip: enso.phase === "el_nino" ? "var(--tight)" : enso.phase === "la_nina" ? "var(--water)" : "var(--muted)",
      value: signed(enso.oni, 1).replace(/^\+/, ""),
      unit: "",
      note: `${phase}${trend}`,
    });
  }
  if (stats.length === 0) return null;

  return (
    <div className="shell">
      <div className="strip" style={{ "--n": stats.length } as React.CSSProperties}>
        {stats.map((stat) => (
          <div className="stat" key={stat.label}>
            <div className="stat-label">
              <span className="chip" style={{ background: stat.chip }} aria-hidden="true" />
              {stat.label}
            </div>
            <div className="stat-value num">
              {stat.value}
              {stat.unit ? <small>{stat.unit}</small> : null}
            </div>
            <div className="stat-note">{stat.note}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ reading */

const CONFIDENCE_ES: Record<NarrativeDocument["confidence"], string> = {
  low: "baja",
  medium: "media",
  high: "alta",
};

/** `2026-09-22T12:40:05Z` -> `22 sep 2026, 07:40 (hora de Ecuador)`. */
function narrativeStamp(timestamp: string): string {
  const instant = Date.parse(timestamp);
  if (!Number.isFinite(instant)) return timestamp;
  // Ecuador is UTC−5 all year; the arithmetic is the same one `util/dates.ts` does.
  const local = new Date(instant - 5 * 3_600_000).toISOString();
  return `${shortDate(local)} ${local.slice(0, 4)}, ${local.slice(11, 16)} (hora de Ecuador)`;
}

/**
 * Phase 6b. A paragraph a language model wrote from the numbers on this page and nothing else.
 *
 * The risk tier shown is the one the text was given, and it is the adequacy model's: the model
 * explains it and cannot choose it, so there is never a second tier on the page. When the text is
 * older than the forecast — the gateway rate-limited or the validator rejected today's — the
 * section says so rather than pairing yesterday's prose with today's numbers in silence.
 */
function Reading({ narrative, forecast }: { narrative: NarrativeDocument | null; forecast: ForecastDocument | null }) {
  if (narrative === null || !narrative.outlook_es) return null;
  const tier = tierOf(narrative.risk_tier);
  const stale = forecast !== null && narrative.origin_date < forecast.origin_date;
  // The design sets the reading as a pull quote, which holds a sentence and not a paragraph. The
  // first sentence is set large and the rest follows at reading size, so none of the text the
  // validator passed is cut.
  const [lead, rest] = splitLead(narrative.outlook_es);

  return (
    <section id="lectura" className="shell section" aria-labelledby="lectura-title">
      <div className="reading inverse">
        <div className="reading-main">
          <div className="reading-head">
            <h2 id="lectura-title" className="eyebrow">
              Lectura del día
            </h2>
            {tier ? (
              <span className="pill">
                <span className={`dot tone-${tier.tone}`} aria-hidden="true" />
                Nivel {tier.label.toLowerCase()}
              </span>
            ) : null}
          </div>
          <blockquote>
            <p>“{lead}{rest ? "" : "”"}</p>
            {rest ? <p className="reading-rest">{rest}”</p> : null}
          </blockquote>
          <p className="reading-fine">
            Texto redactado por un modelo de lenguaje (<code>{narrative.model}</code>) solo con los números de esta
            página; el pronóstico y el nivel de riesgo son de los modelos estadísticos, que el texto describe y no
            produce. Un validador rechaza cualquier cota o fecha que no esté en esos números. Confianza declarada:{" "}
            {CONFIDENCE_ES[narrative.confidence] ?? narrative.confidence} · generado el {narrativeStamp(narrative.generated_at)}.
            {stale ? ` Escrito sobre los datos del ${longDate(narrative.origin_date)}; el resto de la página ya muestra los del ${longDate(forecast!.origin_date)}.` : ""}{" "}
            <a href="/api/narrative.json">Lo que recibió el modelo</a>.
          </p>
        </div>
        {narrative.drivers.length > 0 ? (
          <ol className="drivers">
            {narrative.drivers.map((driver, i) => (
              <li key={i}>
                <span aria-hidden="true">{String(i + 1).padStart(2, "0")}</span>
                <span>{driver}</span>
              </li>
            ))}
          </ol>
        ) : null}
      </div>
    </section>
  );
}

/**
 * The first sentence of a paragraph, and the rest. A sentence ends at a full stop followed by a
 * space and a capital; `2.138,37` has no space after its point, so a number never ends one.
 */
function splitLead(text: string): [string, string] {
  const match = /[.!?]\s+(?=[A-ZÁÉÍÓÚÑ¿¡])/.exec(text);
  if (match === null || text.length < 220) return [text, ""];
  const cut = match.index + 1;
  return [text.slice(0, cut), text.slice(cut).trim()];
}

/* --------------------------------------------------------------- reservoirs */

function Reservoirs({ now }: { now: LatestDocument | null }) {
  if (now === null) return null;
  const mazar = now.reservoirs.find((r) => r.site === "mazar");
  const count = now.reservoirs.filter((r) => r.level !== null).length;
  const hatched = now.reservoirs.some((r) => r.level !== null && r.bands.length === 0);
  return (
    <section id="embalses" className="shell section" aria-labelledby="embalses-title">
      <div className="section-head">
        <SectionIntro index="01" eyebrow="Embalses" title={<span id="embalses-title">{`${count === 8 ? "Ocho" : count} embalses, una misma escala: metros de carga útil.`}</span>}>
            Cada columna va del mínimo declarado a la cresta de su banda y se llena hasta la cota de hoy. Mide metros,
            no agua almacenada: la superficie de Mazar más que se duplica entre los 2.110 y los 2.150 m.
            {hatched ? " Las columnas rayadas no tienen banda publicada en ninguna fuente; su escala es el rango registrado." : ""}
          </SectionIntro>
        <div className="legend-stack">
          <div>
            <span className="key-floor" aria-hidden="true" />
            otro mínimo declarado por CELEC
          </div>
          {hatched ? (
            <div>
              <span className="key-hatch" aria-hidden="true" />
              sin banda declarada
            </div>
          ) : null}
          <div>
            <span className="key-p" aria-hidden="true">
              p{Math.round(mazar?.inflow?.climatology?.percentile_today ?? 50)}
            </span>
            caudal de hoy frente a su historia
          </div>
        </div>
      </div>
      <Fleet reservoirs={now.reservoirs} />
    </section>
  );
}

/* -------------------------------------------------------------------- mazar */

const SCENARIO_ES: Record<string, { name: string; tone: string }> = {
  dry: { name: "Seco", tone: "var(--tight)" },
  median: { name: "Mediano", tone: "var(--water-2)" },
  wet: { name: "Húmedo", tone: "var(--water)" },
};

function SkillBar({ skill }: { skill: number }) {
  // Zero sits 14 px in; the bar runs right for skill and left for its absence, 1.4 px a point.
  const zero = 14;
  const width = Math.min(Math.abs(skill * 100) * 1.4, skill >= 0 ? 70 - zero : zero);
  const x = skill >= 0 ? zero : zero - width;
  return (
    <svg width="70" height="10" viewBox="0 0 70 10" aria-hidden="true">
      <rect x="0" y="4" width="70" height="2" fill="var(--sunk)" />
      <rect x={x.toFixed(1)} y="1" width={Math.max(width, 1.5).toFixed(1)} height="8" rx="2" fill="var(--tone, var(--muted))" />
      <line x1={zero} x2={zero} y1="0" y2="10" stroke="var(--ink-2)" />
    </svg>
  );
}

function Mazar({ forecast }: { forecast: ForecastDocument | null }) {
  if (forecast === null) return null;

  const history = windowOf(series().get("mazar", "cota_masl"), FAN_HISTORY_DAYS);
  const thresholds = forecast.thresholds.map((t) => ({
    level_masl: t.level_masl,
    label:
      t.status === "unverified"
        ? `${num(t.level_masl, 0)} m · marcador propio, sin fuente oficial`
        : `${num(t.level_masl, 0)} m · mínimo declarado (${/dashboard/.test(t.name) ? "tablero" : "reportes"})`,
    unverified: t.status === "unverified",
  }));
  // Since 2026-09-22 the 7-day row can come from M4 while the rest are M3; each row names its
  // model, and older documents that do not are all `model.id`.
  const modelOf = (h: { model?: string }) => h.model ?? forecast.model.id;
  const switched = forecast.forecast.filter((h) => modelOf(h) !== forecast.model.id);
  const fellBack = forecast.horizon_switch?.status === "fallback" ? forecast.horizon_switch : null;
  const scores = forecast.backtest.horizons;
  const ties = scores.filter((b) => Math.abs(b.skill_vs_persistence) < SKILL_TIE).map((b) => b.horizon_days);
  const coverage = scores.map((b) => b.coverage_p10_p90 * 100);
  const critical = forecast.days_to_threshold.thresholds.find((t) => t.status === "unverified") ?? forecast.days_to_threshold.thresholds[0];
  const declared = forecast.days_to_threshold.thresholds.filter((t) => t.status !== "unverified");
  const last = forecast.forecast.at(-1)!;
  const chart = {
    history,
    origin: forecast.origin_date,
    originLevel: forecast.current.level_masl,
    horizons: forecast.forecast,
    thresholds,
    label: `Cota de Mazar: ${FAN_HISTORY_DAYS} días observados y pronóstico a ${last.horizon_days} días con banda p10 a p90`,
    primaryModel: forecast.model.id,
  };

  return (
    <section id="mazar" className="shell section" aria-labelledby="mazar-title">
      <div className="section-head">
        <SectionIntro
          index="02"
          eyebrow={`Mazar · pronóstico a ${last.horizon_days} días`}
          title={<span id="mazar-title">Hacia dónde va el único embalse con semanas de reserva.</span>}
        >
          Un balance hídrico cerrado en torno al operador: la curva cota–superficie y los m³/s por MW se ajustan con
          las lecturas de este repositorio, y la descarga sale cada día simulado de una regla de operación contra la
          propia cota. Junto a cada horizonte, cuánto le gana a suponer que la cota no cambia.
        </SectionIntro>
        <a href="/embalses/mazar/" className="btn btn-ghost">
          Ficha completa de Mazar →
        </a>
      </div>

      <div className="panel">
        <div className="chart-head">
          <ul className="legend">
            <li>
              <span className="key-line" style={{ background: "var(--ink)" }} aria-hidden="true" />
              Cota observada
            </li>
            <li>
              <span className="key-line" style={{ background: "var(--water)" }} aria-hidden="true" />
              Pronóstico p50
            </li>
            <li>
              <span className="key-box" style={{ background: "var(--water)", opacity: 0.3 }} aria-hidden="true" />
              Banda p10–p90
            </li>
            {switched.length > 0 ? (
              <li>
                <span className="key-ring" aria-hidden="true" />
                {joinDays(switched.map((h) => h.horizon_days))} días: otro modelo ({modelShort(modelOf(switched[0]!))}, árboles potenciados)
              </li>
            ) : null}
            <li>
              <span className="key-dash" aria-hidden="true" />
              Mínimos
            </li>
          </ul>
          <span className="meta">m s. n. m.</span>
        </div>
        <div className="only-wide">
          <FanChart {...chart} />
        </div>
        <div className="only-compact">
          <FanChart {...chart} compact />
        </div>
      </div>

      <div className="split">
        <div className="panel tight">
          <div className="panel-head">
            <h3>Horizontes</h3>
            <span className="meta">p10 – p50 – p90 · acierto vs. persistencia</span>
          </div>
          {forecast.forecast.map((h) => {
            const score = scores.find((b) => b.horizon_days === h.horizon_days);
            const tone = skillTone(score?.skill_vs_persistence);
            return (
              <div className="horizon" key={h.horizon_days}>
                <span className="when">{h.horizon_days} días</span>
                <span className="date">{shortDate(h.target_date)}</span>
                <span className="range num">
                  {num(h.p10, 0)} – <strong>{num(h.p50, 2)}</strong> – {num(h.p90, 0)}
                </span>
                <span className={`skill tone-${tone}`}>
                  {score ? (
                    <>
                      <SkillBar skill={score.skill_vs_persistence} />
                      <span className="num">{signed(score.skill_vs_persistence * 100, 1)} %</span>
                    </>
                  ) : (
                    "—"
                  )}
                </span>
                <span className="model" title={modelOf(h)}>
                  {modelShort(modelOf(h))}
                </span>
              </div>
            );
          })}
          <p className="fine" style={{ marginTop: 14 }}>
            {forecast.model.backtest_origins} orígenes mensuales desde 2018.
            {ties.length > 0 ? ` A ${joinDays(ties)} días el modelo empata con la persistencia, y así se publica.` : ""}{" "}
            La banda p10–p90 cubre entre el {num(Math.min(...coverage), 0)} % y el {num(Math.max(...coverage), 0)} % de
            los casos, frente al 80 % nominal.
            {switched.length > 0
              ? ` La fila de ${joinDays(switched.map((h) => h.horizon_days))} días viene de ${modelOf(switched[0]!)}, que corrige el error del balance hídrico y es el único que le gana a la persistencia a una semana.`
              : ""}
            {fellBack
              ? ` Hoy los ${fellBack.horizon_days} días vuelven al balance hídrico: ${fellBack.candidate_model} no se publica cuando su validación no cubre los mismos orígenes.`
              : ""}
          </p>
        </div>

        {critical ? (
          <div className="scenarios">
            <div className="panel-head" style={{ marginBottom: 0 }}>
              <h3>Tres años reales de caudal, la misma regla</h3>
              <span className="meta">umbral {num(critical.level_masl, 0)} m</span>
            </div>
            {critical.scenarios.map((s) => {
              const kind = SCENARIO_ES[s.scenario] ?? { name: s.scenario, tone: "var(--muted)" };
              return (
                <div className="scenario lift" key={s.scenario}>
                  <div className="scenario-head">
                    <span className="scenario-name">
                      <span className="dot" style={{ background: kind.tone }} aria-hidden="true" />
                      {kind.name}
                    </span>
                    <span className="meta" style={{ fontSize: 12 }}>
                      como {s.analogYear} · {num(s.inflowMeanM3s, 1)} m³/s
                    </span>
                  </div>
                  <div className="scenario-verdict">{s.crossesOn ? `Cruza ${num(critical.level_masl, 0)} m` : "No cruza"}</div>
                  <div className="scenario-detail">
                    {s.crossesOn ? `el ${longDate(s.crossesOn)}, en ${num(s.days, 0)} días` : `en los próximos ${forecast.days_to_threshold.horizon_days} días`}
                    <br />
                    mínimo {num(s.minimumLevelMasl, 2)} m
                  </div>
                </div>
              );
            })}
            <p className="fine">
              De los {critical.across_all_analogue_years.analogue_years} años análogos,{" "}
              {critical.across_all_analogue_years.years_that_cross} cruzan los {num(critical.level_masl, 0)} m
              {declared.length > 0
                ? declared.every((t) => t.across_all_analogue_years.years_that_cross === 0)
                  ? `; ninguno llega a los ${num(Math.max(...declared.map((t) => t.level_masl)), 0)} m declarados.`
                  : `; ${Math.max(...declared.map((t) => t.across_all_analogue_years.years_that_cross))} llegan a un mínimo declarado.`
                : "."}{" "}
              {critical.status === "unverified" ? `${num(critical.level_masl, 0)} m es un marcador de este proyecto, no de CELEC.` : ""}
            </p>
          </div>
        ) : null}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ inflows */

function Inflow({ mazar }: { mazar: ReservoirSnapshot | null }) {
  const data = inflowWindow();
  if (data === null) return null;
  const inflow = mazar?.inflow ?? null;
  const climatology = inflow?.climatology ?? null;

  return (
    <section id="caudal" className="section" style={{ gap: 28 }} aria-labelledby="caudal-title">
      <SectionIntro index="03" eyebrow="Caudal" title={<span id="caudal-title">{inflowHeadline(climatology?.percentile_today)}</span>}>
        Caudal de entrada a Mazar del último año sobre la franja p10–p90 de los mismos días en todo el registro desde
        2010. La franja describe lo que este río ha hecho, no lo que vaya a hacer.
      </SectionIntro>
      <div className="panel tight">
        {inflow ? (
          <div className="figure-row">
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span className="big-figure num">
                {num(inflow.m3s, 1)}
                <small>m³/s</small>
              </span>
              <span style={{ fontSize: 13, color: "var(--ink-2)" }}>
                {shortDate(inflow.date)}
                {climatology ? ` · mediana histórica ${num(climatology.p50, 1)} m³/s` : ""}
              </span>
            </div>
            {climatology?.percentile_today != null ? (
              <PercentileTrack percentile={climatology.percentile_today} years={climatology.years} />
            ) : null}
          </div>
        ) : null}
        <div className="only-wide">
          <InflowChart readings={data.readings} ribbon={data.band} label="Caudal de entrada a Mazar del último año frente a su franja histórica p10 a p90" />
        </div>
        <div className="only-compact">
          <InflowChart compact readings={data.readings} ribbon={data.band} label="Caudal de entrada a Mazar del último año frente a su franja histórica p10 a p90" />
        </div>
        <InflowLegend />
        <p className="fine" style={{ marginTop: 12 }}>
          Los cortes en la línea son días que la fuente nunca publicó. Un cero no significa «el río se detuvo»: en los
          reportes de doce meses es cualquier valor por debajo de 0,5 m³/s.
        </p>
      </div>
    </section>
  );
}

/* ----------------------------------------------------------------- national */

function National({ now }: { now: LatestDocument | null }) {
  const days = mix(MIX_DAYS);
  const national = now?.national ?? null;
  if (days.length < 2 || national === null) return null;
  const supply = (national.total_generation_gwh ?? 0) + (national.total_import_gwh ?? 0);
  const parts = national.supply_gwh;

  return (
    <section id="balance" className="section" style={{ gap: 28 }} aria-labelledby="balance-title">
      <SectionIntro index="04" eyebrow="Balance nacional" title={<span id="balance-title">De dónde salió la electricidad.</span>}>
        El balance que CENACE cierra cada mañana para el día anterior, en GWh. Los porcentajes van sobre generación
        más importación: un kWh importado alumbra igual que uno generado.
      </SectionIntro>
      <div className="panel tight">
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", fontSize: 13 }}>
            <span style={{ color: "var(--ink-2)" }}>
              {shortDate(national.date)} {national.date.slice(0, 4)} · {num(supply, 1)} GWh de suministro
            </span>
            <span className="meta" style={{ fontSize: 12 }}>
              demanda de distribución {num(national.distribution_demand_gwh, 1)} GWh
            </span>
          </div>
          <div
            className="supply"
            role="img"
            aria-label={`Suministro del ${longDate(national.date)}: hidroeléctrica ${pct(national.hydro_share_pct, 1)}, térmica ${pct(national.thermal_share_pct, 1)}, importación ${pct(national.import_share_pct, 1)}.`}
          >
            {parts.map((p) => (
              <span
                key={p.concept}
                style={{ width: `${p.pct.toFixed(2)}%`, background: mixToken(p.concept) }}
                title={`${conceptLabel(p.concept)}: ${pct(p.pct, 1)}`}
              />
            ))}
          </div>
        </div>
        <div className="only-wide">
          <MixChart days={days} label={`Generación diaria del Ecuador por tipo e importación, últimos ${MIX_DAYS} días, en GWh`} />
        </div>
        <div className="only-compact">
          <MixChart compact days={days} label={`Generación diaria del Ecuador por tipo e importación, últimos ${MIX_DAYS} días, en GWh`} />
        </div>
        <div className="mix-table" style={{ marginTop: 14 }}>
          {parts.map((p) => (
            <div key={p.concept}>
              <span className="swatch" style={{ background: mixToken(p.concept) }} aria-hidden="true" />
              <span>{conceptLabel(p.concept)}</span>
              <span className="num gwh">{num(p.gwh, 2)}</span>
              <span className="num">{pct(p.pct, 1)}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- adequacy */

/** The day the import maximum was set, read from the assumptions' own prose when it names one. */
function importPeakDate(basis: string | undefined): string | null {
  const match = /import = [\d.]+ \([^()]*\((\d{4}-\d{2}-\d{2})\)/.exec(basis ?? "");
  return match ? match[1]! : null;
}

function Adequacy({ adequacy }: { adequacy: AdequacyDocument | null }) {
  if (adequacy === null) return null;
  const worst = tierOf(adequacy.current.worst_tier);
  const a = adequacy.assumptions;
  const regime = a.import_regime;
  const cutoff = regime?.state === "cutoff";
  const peak = importPeakDate(a.basis);
  const episodes = adequacy.crisis_check.episodes;
  const scale = Math.max(1, ...episodes.flatMap((e) => [Math.abs(e.measured_suppression_gwh_day), Math.abs(e.implied_deficit_gwh_day)]));
  const barWidth = (v: number) => `calc(${Math.max((Math.max(v, 0) / scale) * 50, 1.5).toFixed(1)}% * var(--bar-scale, 1))`;
  const tones = adequacy.horizons.map((h) => `var(--${tierOf(h.tier)?.tone ?? "muted"})`);
  const track =
    tones.length > 1
      ? `linear-gradient(90deg, ${tones.map((t, i) => `${t} ${Math.round((i / (tones.length - 1)) * 100)}%`).join(", ")})`
      : tones[0];

  return (
    <section id="suficiencia" className="shell section" aria-labelledby="suficiencia-title">
      <SectionIntro index="05" eyebrow="Suficiencia energética" title={<span id="suficiencia-title">{adequacyHeadline(adequacy.horizons)}</span>} wide>
        Una sola identidad: demanda no suprimida menos hidroeléctrica menos el techo térmico menos la importación. Lo
        que queda es el superávit; en negativo, el déficit esperado. La demanda excluye los días de racionamiento,
        porque durante un corte los contadores miden la demanda que se permitió, no la que había.
      </SectionIntro>

      <div className="split wide-left">
        <div className="panel">
          <div className="panel-head" style={{ marginBottom: 36 }}>
            <h3>Superávit esperado por horizonte</h3>
            {worst ? (
              <span className="pill">
                <span className={`dot tone-${worst.tone}`} aria-hidden="true" />
                Peor nivel: {worst.label.toLowerCase()} a {adequacy.current.worst_tier_horizon_days} días
              </span>
            ) : null}
          </div>
          <div className="timeline">
            <div className="timeline-track" style={{ background: track }} aria-hidden="true" />
            <ol>
              {adequacy.horizons.map((h) => {
                const tier = tierOf(h.tier);
                const surplus = -h.deficit_gwh_day;
                return (
                  <li className={`step tone-${tier?.tone ?? "muted"}`} key={h.horizon_days}>
                    <div className="step-when">{h.horizon_days} días</div>
                    <div className="step-dot" aria-hidden="true" />
                    <div className={surplus < 0 ? "step-value num short" : "step-value num"}>{signed(surplus, 1)}</div>
                    <div className="step-note">
                      GWh/día
                      <br />
                      margen {signed(h.margin_pct, 2)} %
                    </div>
                    <div className="step-tier">{tier?.label ?? h.tier}</div>
                  </li>
                );
              })}
            </ol>
          </div>
          <div className="assumptions">
            <div className="assumption">
              <span className="assumption-label">Térmica</span>
              <span className="assumption-value num">{num(a.thermal_gwh_day, 2)}</span>
              <span className="assumption-note">GWh/día · máx. demostrado</span>
            </div>
            <div className="assumption">
              <span className="assumption-label">Importación</span>
              <span className="assumption-value num">{num(cutoff ? regime!.central_import_gwh_day : a.import_gwh_day, 2)}</span>
              <span className="assumption-note">GWh/día · {cutoff ? "lo que llega" : "máx. demostrado"}</span>
            </div>
            <div className="assumption">
              <span className="assumption-label">Otros tipos</span>
              <span className="assumption-value num">{num(a.other_gwh_day, 2)}</span>
              <span className="assumption-note">GWh/día · mediana</span>
            </div>
            <div className="assumption">
              <span className="assumption-label">Quincena hídrica</span>
              <span className="assumption-value num">{num(adequacy.data.hydro_anomaly, 2)} ×</span>
              <span className="assumption-note">su climatología</span>
            </div>
          </div>
          <p className="fine" style={{ marginTop: 18 }}>
            Los techos son máximos demostrados en los últimos tres años, no declaraciones de disponibilidad: ninguna
            fuente que alcance este proyecto publica los mantenimientos programados. Se editan en{" "}
            <code>{a.editable_at}</code>.
          </p>
        </div>

        <div className="aside-stack">
          <div className="inverse fragile">
            <span className="eyebrow">El supuesto más frágil</span>
            <p className="fragile-claim">
              {cutoff
                ? `Colombia envió ${num(regime!.trailing_gwh_day, 2)} GWh/día en los últimos ${regime!.window_days} días.`
                : `El caso central cuenta con ${num(a.import_gwh_day, 2)} GWh/día desde Colombia.`}{" "}
              {peak ? `En ${monthName(peak)} de ${peak.slice(0, 4)} llegó a ${num(a.import_gwh_day, 2)}.` : ""}
            </p>
            <p className="fragile-fine">
              Un interconector no es firme cuando la sequía es compartida: entre el 1 de octubre y el 10 de noviembre
              de 2024, con el país racionando, llegaron {num(a.stressed_import_gwh_day, 2)} GWh/día.
              {cutoff ? " El caso central usa lo que está llegando, no el máximo." : ""}
            </p>
          </div>
          {episodes.length > 0 ? (
            <div className="inverse check">
              <div className="check-head">
                <strong>La comprobación</strong>
                <span>GWh/día</span>
              </div>
              <p className="check-lede">
                En cada racionamiento, la demanda suprimida que midieron los contadores frente al déficit que calcula
                el modelo. Si la identidad es correcta, deben tener el mismo tamaño.
              </p>
              {episodes.map((e) => (
                <div className="episode" key={e.start}>
                  <div>
                    {monthSpan(e.start, e.end)}
                    <small>{e.days} días</small>
                  </div>
                  <div className="episode-bars">
                    <div>
                      <span className="episode-bar" style={{ width: barWidth(e.measured_suppression_gwh_day), background: "var(--inv-accent)" }} />
                      {num(e.measured_suppression_gwh_day, 1)} observada
                    </div>
                    <div>
                      <span className="episode-bar" style={{ width: barWidth(e.implied_deficit_gwh_day), background: "var(--t3)" }} />
                      {signed(e.implied_deficit_gwh_day, 1)} calculada
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------- data */

const FRESHNESS: Record<string, { word: string; tone: string }> = {
  current: { word: "al día", tone: "good" },
  stale: { word: "detenida", tone: "deficit" },
  not_ingested: { word: "sin datos", tone: "watch" },
};

function Data({ status, narrative }: { status: StatusDocument | null; narrative: boolean }) {
  const downloads = [
    { path: "/api/latest.json", what: "Embalses y balance del día" },
    { path: "/api/forecast.json", what: "Pronóstico de Mazar y su validación" },
    { path: "/api/adequacy.json", what: "Suficiencia por horizonte" },
    ...(narrative ? [{ path: "/api/narrative.json", what: "La lectura del día y lo que recibió el modelo" }] : []),
    { path: "/api/status.json", what: "Frescura y comprobaciones" },
  ];
  const current = status?.feeds.filter((f) => f.state === "current").length ?? 0;
  const total = status?.feeds.length ?? 0;
  const overall = total === 0 ? "muted" : current === total ? "good" : status?.feeds.some((f) => f.state === "stale") ? "deficit" : "watch";

  return (
    <section id="datos" className="shell split even" aria-label="Datos">
      {status ? (
        <div className="panel">
          <div className="panel-head" style={{ alignItems: "center", marginBottom: 10 }}>
            <h2 className="panel-title">¿Se puede confiar hoy?</h2>
            <span className="pill">
              <span className={`dot tone-${overall}`} aria-hidden="true" />
              {current} de {total} al día
            </span>
          </div>
          <p className="panel-lede" style={{ marginBottom: 12 }}>
            Cada fuente, con la última fecha que publicó. El límite de cada una es su retraso de publicación más margen
            para una ejecución fallida: el ONI siempre tiene unos dos meses.
            {status.findings.length > 0
              ? ` ${status.findings.length === 1 ? "Un aviso abierto" : `${status.findings.length} avisos abiertos`}: ${status.findings.map(findingText).join(" · ")}.`
              : ""}
          </p>
          <ul className="feeds">
            {status.feeds.map((feed) => {
              const state = FRESHNESS[feed.state] ?? { word: feed.state, tone: "watch" };
              return (
                <li key={feed.feed} title={`Límite: ${feed.limit_days} días · ${state.word}`}>
                  <span>
                    <span className={`dot tone-${state.tone}`} aria-hidden="true" />
                    {feedLabel(feed.feed).replace(/\s*\([^)]*\)$/, "")}
                    <span className="visually-hidden">: {state.word}</span>
                  </span>
                  <span className="when">{feed.latest ? shortDate(feed.latest) : "—"}</span>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
      <div className="downloads">
        <h2 className="panel-title" style={{ marginBottom: 4 }}>
          Llévate los datos
        </h2>
        <p className="panel-lede" style={{ marginBottom: 6 }}>
          JSON abiertos, actualizados cada día, con la respuesta original archivada junto a cada número.
        </p>
        {downloads.map((d) => (
          <a key={d.path} href={d.path} className="download lift">
            <span>
              <span className="path">{d.path}</span>
              <span className="what">{d.what}</span>
            </span>
            <span className="go" aria-hidden="true">
              ↗
            </span>
          </a>
        ))}
        <a href={`${REPO}/tree/main/data/curated`} className="download lift">
          <span>
            <span className="path">data/curated/</span>
            <span className="what">Las tablas completas, en CSV por año, y las respuestas originales en data/raw/</span>
          </span>
          <span className="go" aria-hidden="true">
            ↗
          </span>
        </a>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------- method */

function Method({ forecast, adequacy }: { forecast: ForecastDocument | null; adequacy: AdequacyDocument | null }) {
  const sixty = forecast?.backtest.horizons.find((h) => h.horizon_days === 60);
  const ninety = forecast?.backtest.horizons.find((h) => h.horizon_days === 90);
  const tiers = adequacy?.tier_history;
  const firstA = adequacy?.horizons[0];
  const ninetyA = adequacy?.horizons.find((h) => h.horizon_days === 90);
  return (
    <section id="metodo" className="shell section" aria-labelledby="metodo-title">
      <SectionIntro index="06" eyebrow="Método y advertencias" title={<span id="metodo-title">Lo que conviene saber antes de usar estos números.</span>}>
        Cada una está documentada, con las mediciones que la establecieron, en el <a href={REPO}>repositorio</a>.
      </SectionIntro>
      <div className="caveats">
        {forecast && sixty && ninety ? (
          <p>
            <strong>El pronóstico de cota.</strong> Sobre {forecast.model.backtest_origins} orígenes mensuales, el
            balance hídrico es {pct(sixty.skill_vs_persistence * 100, 1)} mejor que la persistencia a 60 días y{" "}
            {pct(ninety.skill_vs_persistence * 100, 1)} a 90, e indistinguible de ella por debajo del mes. De los{" "}
            {countWord(forecast.crisis_check.episodes.length)} cruces de los {num(forecast.crisis_check.threshold_masl, 0)} m en 2024, la
            mediana no anticipó ninguno; dio {forecast.crisis_check.false_alarms_p50}{" "}
            {forecast.crisis_check.false_alarms_p50 === 1 ? "falsa alarma" : "falsas alarmas"}. Todo, negativos incluidos,
            en <a href={`${REPO}/blob/main/${forecast.backtest.report}`}>{forecast.backtest.report}</a>.
          </p>
        ) : null}
        {adequacy && tiers ? (
          <p>
            <strong>La suficiencia.</strong> El requerimiento le gana a suponer que el último mes se repite
            {firstA?.backtest.requirement_skill_vs_persistence != null
              ? ` por ${pct(firstA.backtest.requirement_skill_vs_persistence * 100, 1)} a 7 días`
              : ""}
            {ninetyA?.backtest.requirement_skill_vs_persistence != null
              ? ` y ${pct(ninetyA.backtest.requirement_skill_vs_persistence * 100, 1)} a 90`
              : ""}
            , y su banda p10–p90 cubre unos dos tercios de los casos, no cuatro quintos. Aplicados a{" "}
            {tiers.origins} meses del registro, los niveles marcaron {tiers.origins_flagged}; de los marcados,{" "}
            {pct((tiers.share_of_flagged_that_preceded_cuts ?? 0) * 100, 0)} precedieron cortes, y de los cortes se marcó{" "}
            {pct((tiers.share_of_cuts_that_were_flagged ?? 0) * 100, 0)}: no da falsas alarmas, pero se le escapan la mayoría
            de las crisis. Nada de esto modela la red. Detalle en{" "}
            <a href={`${REPO}/blob/main/data/reports/adequacy.md`}>data/reports/adequacy.md</a>.
          </p>
        ) : null}
      </div>
      <div className="notes">
        <article>
          <h3>
            <code>volutilalm</code> no es un volumen
          </h3>
          <p>
            El servicio lo publica como «% de volumen útil», pero es exactamente (cota − mín) / (máx − mín), verificado
            a diez decimales. Aquí se guarda como <code>nivel_pct_banda</code> y no debe leerse como agua almacenada.
          </p>
        </article>
        <article>
          <h3>
            <code>repDiaNivQIng</code> responde con los números de ayer
          </h3>
          <p>
            Si se le pide el día D, devuelve filas fechadas D con los valores de D−1, medido en 113 días consecutivos.
            Sus filas se guardan bajo el día que describen, no bajo el que las etiqueta.
          </p>
        </article>
        <article>
          <h3>El caudal del historiador es caudal de entrada</h3>
          <p>
            <code>mridCaud</code> coincide con <code>q_ingresado</code> del reporte en 4281 días con r = 1,0000; el
            caudal turbinado, el otro candidato, correlaciona a r = −0,06.
          </p>
        </article>
        <article>
          <h3>La misma lectura de dos servicios se guarda dos veces</h3>
          <p>
            Cuando dos servicios de CELEC publican el mismo día se conservan ambas filas con su fuente, para que los
            desacuerdos sigan siendo visibles. Los modelos resuelven una sola serie por un orden de fuentes declarado.
          </p>
        </article>
        <article>
          <h3>Los 2.115 m son un marcador de este proyecto</h3>
          <p>
            Ninguna fuente publica ese nivel como crítico. Se pronostica porque el plan lo pide y se etiqueta como no
            verificado en cada documento, para que nadie lo confunda con una declaración de CELEC.
          </p>
        </article>
      </div>
    </section>
  );
}
