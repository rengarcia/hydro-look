/**
 * The site. One page, rendered to static HTML at build time from the committed data.
 *
 * The order is the order of the questions: how full are the reservoirs, where is the one with
 * real storage going, is the water arriving, what is the country running on, and can any of it
 * be trusted today. Every section that shows a modelled number shows the measurement of that
 * model beside it, because a forecast without its skill score is a number with no units.
 */

import { ReservoirCard } from "./components/ReservoirCard.tsx";
import { FanChart } from "./components/FanChart.tsx";
import { InflowChart } from "./components/InflowChart.tsx";
import { MixChart, MIX_SERIES } from "./components/MixChart.tsx";
import { apiDocument, latest, mix, ribbon, series, window as windowOf } from "../lib/site/data.ts";
import type { ForecastDocument, StatusDocument } from "../lib/site/documents.ts";
import { conceptLabel, feedLabel, longDate, num, pct } from "../lib/site/format.ts";
import { eachDay } from "../lib/util/dates.ts";

const REPO = "https://github.com/rengarcia/hydro-look";

/** Days of history drawn behind the forecast, and of inflow and national mix on their charts. */
const FAN_HISTORY_DAYS = 180;
const INFLOW_DAYS = 365;
const MIX_DAYS = 180;

export default function Page() {
  const now = latest();
  const forecast = apiDocument<ForecastDocument>("forecast.json");
  const status = apiDocument<StatusDocument>("status.json");

  return (
    <main>
      <header className="masthead">
        <div className="wrap">
          <h1>El sistema hidroeléctrico del Ecuador, día a día</h1>
          <p>
            Cotas de embalses, caudales, generación por central y balance nacional, recogidos a diario de los
            servicios públicos de CELEC y CENACE, versionados en un repositorio y publicados aquí.
          </p>
          <p className="notice">
            <strong>No es una fuente oficial.</strong> Cada número es una copia de lo que publicaron CELEC o CENACE,
            con la respuesta que lo produjo archivada junto a él. Este sitio no representa la posición de ninguna
            institución.{" "}
            {now ? <>Datos al {longDate(now.as_of)}.</> : null}
          </p>
        </div>
      </header>

      <div className="wrap">
        <Reservoirs now={now} />
        <Mazar forecast={forecast} />
        <Inflow />
        <National now={now} />
        <Freshness status={status} />
        <Downloads />
        <Method />
      </div>

      <footer>
        <div className="wrap">
          <p>
            Código bajo licencia MIT. Los datos de energía provienen de CELEC EP y CENACE; los meteorológicos de{" "}
            <a href="https://open-meteo.com/">Open-Meteo</a> (ERA5, CC BY 4.0) y el índice ONI de{" "}
            <a href="https://psl.noaa.gov/data/correlation/oni.data">NOAA PSL / CPC</a>.{" "}
            <a href={REPO}>Código y datos</a>.
          </p>
        </div>
      </footer>
    </main>
  );
}

/* ---------------------------------------------------------------- reservoirs */

function Reservoirs({ now }: { now: ReturnType<typeof latest> }) {
  if (now === null) return null;
  return (
    <section id="embalses">
      <h2>Embalses</h2>
      <p className="lede">
        La cota de hoy dentro de la banda de operación que CELEC declara para cada embalse. La barra mide metros de
        carga útil, no agua almacenada: la superficie de Mazar más que se duplica entre los 2110 y los 2150 m, así
        que media banda no es media reserva.
      </p>
      <div className="cards">
        {now.reservoirs.map((reservoir) => (
          <ReservoirCard key={reservoir.site} reservoir={reservoir} />
        ))}
      </div>
      <p className="note">
        Donde CELEC declara más de un mínimo se dibujan todos, con una marca roja bajo la barra. El de Mazar es 2098 m
        según el título del gráfico del tablero y 2100 m según ambos servicios de reportes: las dos cifras son de
        CELEC y este sitio no elige entre ellas. Coca Codo Sinclair, Agoyán y Manduriacu no tienen banda declarada en
        ninguna fuente; su escala es el rango registrado en este repositorio.
      </p>
    </section>
  );
}

/* -------------------------------------------------------------------- mazar */

function Mazar({ forecast }: { forecast: ForecastDocument | null }) {
  if (forecast === null) return null;

  const history = windowOf(series().get("mazar", "cota_masl"), FAN_HISTORY_DAYS);
  const thresholds = forecast.thresholds.map((t) => ({
    level_masl: t.level_masl,
    label: `${num(t.level_masl, 0)} m${t.status === "unverified" ? " (marcador propio)" : ""}`,
    unverified: t.status === "unverified",
  }));

  const ninety = forecast.backtest.horizons.find((h) => h.horizon_days === 90);
  const sixty = forecast.backtest.horizons.find((h) => h.horizon_days === 60);
  const critical = forecast.days_to_threshold.thresholds.find((t) => t.status === "unverified");

  return (
    <section id="mazar">
      <h2>Mazar: hacia dónde va</h2>
      <p className="lede">
        Mazar es el único embalse de la flota con almacenamiento de varias semanas, así que es el que se pronostica.
        El modelo es un balance de agua cerrado en torno al operador: la curva cota–superficie y los m³/s por MW de
        la turbina se ajustan con las lecturas de este repositorio, y la descarga se lee cada día simulado de una
        regla de operación contra la propia cota.
      </p>

      <div className="chart">
        <ul className="legend">
          <li>
            <span className="swatch line" style={{ background: "var(--ink)" }} /> Cota observada
          </li>
          <li>
            <span className="swatch line" style={{ background: "var(--series-1)" }} /> Pronóstico p50
          </li>
          <li>
            <span className="swatch" style={{ background: "var(--series-1)", opacity: 0.35 }} /> Banda p10–p90
          </li>
          <li>
            <span className="swatch line" style={{ background: "var(--critical)" }} /> Mínimos declarados
          </li>
        </ul>
        <FanChart
          history={history}
          origin={forecast.origin_date}
          originLevel={forecast.current.level_masl}
          horizons={forecast.forecast}
          thresholds={thresholds}
          label={`Cota de Mazar: ${FAN_HISTORY_DAYS} días observados y pronóstico a 90 días`}
        />
      </div>

      <div className="scroll" style={{ marginTop: 20 }}>
        <table>
          <caption>
            Pronóstico emitido el {longDate(forecast.origin_date)} desde una cota de {num(forecast.current.level_masl, 2)} m.
            «Acierto frente a persistencia» compara el error del modelo con el de suponer que la cota no cambia:
            0 % es empatar, negativo es perder.
          </caption>
          <thead>
            <tr>
              <th>Horizonte</th>
              <th>Fecha</th>
              <th className="num">p10</th>
              <th className="num">p50</th>
              <th className="num">p90</th>
              <th className="num">Acierto vs. persistencia</th>
              <th className="num">Cobertura p10–p90</th>
            </tr>
          </thead>
          <tbody>
            {forecast.forecast.map((h) => {
              const score = forecast.backtest.horizons.find((b) => b.horizon_days === h.horizon_days);
              return (
                <tr key={h.horizon_days}>
                  <th scope="row">{h.horizon_days} días</th>
                  <td>{longDate(h.target_date)}</td>
                  <td className="num">{num(h.p10, 2)}</td>
                  <td className="num">{num(h.p50, 2)}</td>
                  <td className="num">{num(h.p90, 2)}</td>
                  <td className="num">{score ? pct(score.skill_vs_persistence * 100, 1) : "—"}</td>
                  <td className="num">{score ? pct(score.coverage_p10_p90 * 100, 0) : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="note">
        Lo que el respaldo mide, dicho sin adornos: sobre {forecast.model.backtest_origins} orígenes mensuales desde
        2018-01 el modelo es{" "}
        {sixty ? <strong>{pct(sixty.skill_vs_persistence * 100, 1)} mejor que la persistencia a 60 días</strong> : null}
        {ninety ? <> y {pct(ninety.skill_vs_persistence * 100, 1)} a 90</> : null}, y <strong>indistinguible de ella por
        debajo del mes</strong>. Para menos de treinta días, suponer que la cota no cambia es tan bueno como esto. La
        banda p10–p90 cubre entre el 72 % y el 80 % de los casos según el horizonte, por debajo del 80 % nominal.
      </p>

      {critical ? <Crossings threshold={critical} note={forecast.days_to_threshold.note} /> : null}

      <p className="note">
        La comprobación de crisis es la menos halagüeña: de los dos episodios en que Mazar bajó de los 2115 m en 2024,
        la mediana del modelo no anticipó ninguno. La cola seca del conjunto sí situó el cruce de octubre con{" "}
        {forecast.crisis_check.episodes.find((e) => e.p10_lead_time_days !== null)?.p10_lead_time_days ?? "—"} días de
        anticipación frente a los 7 reales, con {forecast.crisis_check.false_alarms_p50} falsa alarma en{" "}
        {forecast.crisis_check.origins_considered} orígenes. Los números completos están en{" "}
        <a href={`${REPO}/blob/main/${forecast.backtest.report}`}>{forecast.backtest.report}</a>.
      </p>
    </section>
  );
}

function Crossings({ threshold, note }: { threshold: NonNullable<ForecastDocument["days_to_threshold"]["thresholds"][number]>; note: string }) {
  const all = threshold.across_all_analogue_years;
  return (
    <div className="scroll" style={{ marginTop: 20 }}>
      <table>
        <caption>
          Días hasta cruzar los {num(threshold.level_masl, 0)} m. {note} Este umbral no lo publica ninguna fuente:
          es el marcador propio de este proyecto (PLAN.md §7), no una declaración de CELEC. De los{" "}
          {all.analogue_years} años análogos, {all.years_that_cross} llegan a cruzarlo dentro del año.
        </caption>
        <thead>
          <tr>
            <th>Escenario</th>
            <th className="num">Año análogo</th>
            <th className="num">Caudal medio</th>
            <th>Cruce</th>
            <th className="num">Días</th>
            <th className="num">Cota mínima</th>
          </tr>
        </thead>
        <tbody>
          {threshold.scenarios.map((scenario) => (
            <tr key={scenario.scenario}>
              <th scope="row">{{ dry: "Seco", median: "Mediano", wet: "Húmedo" }[scenario.scenario] ?? scenario.scenario}</th>
              <td className="num">{scenario.analogYear}</td>
              <td className="num">{num(scenario.inflowMeanM3s, 1)} m³/s</td>
              <td>{scenario.crossesOn ? longDate(scenario.crossesOn) : "no cruza"}</td>
              <td className="num">{scenario.days === null ? "—" : num(scenario.days, 0)}</td>
              <td className="num">{num(scenario.minimumLevelMasl, 2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ------------------------------------------------------------------ inflows */

function Inflow() {
  const inflow = series().get("mazar", "caudal_m3s");
  const readings = windowOf(inflow, INFLOW_DAYS);
  if (readings.length < 2) return null;

  const first = readings[0]!.date;
  const last = readings.at(-1)!.date;
  const band = ribbon(inflow, eachDay(first, last));

  return (
    <section id="caudales">
      <h2>Caudal frente a su propia historia</h2>
      <p className="lede">
        El caudal de entrada a Mazar del último año, sobre la franja que va del percentil 10 al 90 de los mismos días
        del año en todo el registro disponible desde 2010. La franja describe lo que este río ha hecho, no lo que
        vaya a hacer.
      </p>
      <div className="chart">
        <ul className="legend">
          <li>
            <span className="swatch line" style={{ background: "var(--series-1)" }} /> Caudal diario
          </li>
          <li>
            <span className="swatch line" style={{ background: "var(--muted)" }} /> Mediana histórica
          </li>
          <li>
            <span className="swatch" style={{ background: "var(--axis)", opacity: 0.6 }} /> Franja p10–p90
          </li>
        </ul>
        <InflowChart readings={readings} ribbon={band} label="Caudal de entrada a Mazar frente a su climatología" />
      </div>
      <p className="note">
        Un cero no significa lo mismo en las dos rutas y en ninguna significa «el río se detuvo». Los reportes de doce
        meses publican m³/s enteros, así que su 0 es cualquier valor por debajo de 0,5; el historiador publica
        decimales, así que su 0,00 es el servicio callando y se descarta. Los cortes en la línea son días que la
        fuente nunca publicó.
      </p>
    </section>
  );
}

/* ----------------------------------------------------------------- national */

function National({ now }: { now: ReturnType<typeof latest> }) {
  const days = mix(MIX_DAYS);
  const national = now?.national ?? null;
  if (days.length < 2 || national === null) return null;

  return (
    <section id="balance">
      <h2>De dónde sale la electricidad</h2>
      <p className="lede">
        El balance diario que CENACE cierra cada mañana para el día anterior, en GWh. Los porcentajes se toman sobre
        generación más importación, no sobre generación sola: un kWh importado alumbra igual que uno generado.
      </p>

      <div className="chart">
        <ul className="legend">
          {MIX_SERIES.map((s) => (
            <li key={s.concept}>
              <span className="swatch" style={{ background: s.token }} /> {conceptLabel(s.concept)}
            </li>
          ))}
        </ul>
        <MixChart days={days} label={`Generación diaria por tipo e importación, últimos ${MIX_DAYS} días`} />
      </div>

      <div className="scroll" style={{ marginTop: 20 }}>
        <table>
          <caption>
            Día cerrado más reciente: {longDate(national.date)}. Demanda de distribución{" "}
            {num(national.distribution_demand_gwh, 2)} GWh; exportación {num(national.total_export_gwh, 2)} GWh.
          </caption>
          <thead>
            <tr>
              <th>Fuente</th>
              <th className="num">GWh</th>
              <th className="num">% del suministro</th>
            </tr>
          </thead>
          <tbody>
            {national.supply_gwh.map((part) => (
              <tr key={part.concept}>
                <th scope="row">{conceptLabel(part.concept)}</th>
                <td className="num">{num(part.gwh, 2)}</td>
                <td className="num">{pct(part.pct, 2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="note">
        Ese día el agua cubrió {pct(national.hydro_share_pct, 1)} del suministro, la quema{" "}
        {pct(national.thermal_share_pct, 1)} y la importación {pct(national.import_share_pct, 1)}. Es una
        descripción de lo ocurrido, no una previsión de suficiencia: el cálculo de déficit esperado en GWh/día y los
        niveles de riesgo que plantea el §7 del plan todavía no están construidos, y este sitio no los insinúa con
        un semáforo que no respalda ningún modelo.
      </p>
    </section>
  );
}

/* ---------------------------------------------------------------- freshness */

const FRESHNESS_WORDS: Record<string, { word: string; dot: string }> = {
  current: { word: "al día", dot: "good" },
  stale: { word: "detenida", dot: "critical" },
  not_ingested: { word: "sin datos", dot: "warning" },
};

function Freshness({ status }: { status: StatusDocument | null }) {
  if (status === null) return null;
  return (
    <section id="frescura">
      <h2>Frescura de los datos</h2>
      <p className="lede">
        Cada fuente tiene su propio retraso de publicación. El límite es ese retraso más margen para una ejecución
        fallida, no un objetivo: el ONI, por ejemplo, etiqueta cada valor con el mes central de una media de tres, así
        que el más reciente disponible siempre tiene unos dos meses.
      </p>
      <div className="scroll">
        <table>
          <caption>
            Generado el {longDate(status.generated_at.slice(0, 10))} a partir de {num(status.tables["observations_daily"]?.rows ?? 0, 0)}{" "}
            observaciones y {num(status.tables["national_balance_daily"]?.rows ?? 0, 0)} filas de balance nacional.
          </caption>
          <thead>
            <tr>
              <th>Fuente</th>
              <th>Último dato</th>
              <th className="num">Límite</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {status.feeds.map((feed) => {
              const state = FRESHNESS_WORDS[feed.state] ?? { word: feed.state, dot: "warning" };
              return (
                <tr key={feed.feed}>
                  <th scope="row">{feedLabel(feed.feed)}</th>
                  <td>{feed.latest ? longDate(feed.latest) : "—"}</td>
                  <td className="num">{feed.limit_days} días</td>
                  <td>
                    <span className="pill">
                      <span className={`dot ${state.dot}`} aria-hidden="true" />
                      {state.word}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {status.findings.length > 0 ? (
        <p className="note">
          Observaciones abiertas del control de calidad: {status.findings.map((f) => f.message).join(" · ")}
        </p>
      ) : null}
    </section>
  );
}

/* ---------------------------------------------------------------- downloads */

function Downloads() {
  return (
    <section id="descargas">
      <h2>Descargas</h2>
      <p className="lede">
        Los tres documentos JSON son pequeños y estables; las tablas completas están en CSV particionado por año, y
        cada respuesta original queda archivada comprimida junto a la fila que produjo.
      </p>
      <ul className="links">
        <li>
          <a href="/api/latest.json">latest.json</a> — <code>cota, banda, caudal y mezcla del día</code>
        </li>
        <li>
          <a href="/api/forecast.json">forecast.json</a> — <code>pronóstico de Mazar con su respaldo</code>
        </li>
        <li>
          <a href="/api/status.json">status.json</a> — <code>frescura por fuente y control de calidad</code>
        </li>
        <li>
          <a href={`${REPO}/tree/main/data/curated`}>data/curated/</a> — <code>tablas en CSV por año</code>
        </li>
        <li>
          <a href={`${REPO}/tree/main/data/raw`}>data/raw/</a> — <code>respuestas originales, NDJSON comprimido</code>
        </li>
        <li>
          <a href={`${REPO}/blob/main/data/reports/backtest.md`}>backtest.md</a> —{" "}
          <code>el respaldo del modelo, incluidos los negativos</code>
        </li>
      </ul>
    </section>
  );
}

/* ------------------------------------------------------------------- method */

function Method() {
  return (
    <section id="metodo">
      <h2>Método y advertencias</h2>
      <p className="lede">
        Cinco cosas que conviene saber antes de usar cualquiera de estos números. Están documentadas con las
        mediciones que las establecieron en el <a href={REPO}>repositorio</a>.
      </p>
      <div className="stack">
        <article className="card">
          <h3><code>volutilalm</code> no es un volumen</h3>
          <p className="sub">
            El servicio lo publica como «% de volumen útil», pero es exactamente (cota − mín) / (máx − mín),
            verificado a diez decimales en los tres embalses que cubre. Aquí se guarda como{" "}
            <code>nivel_pct_banda</code> y no debe leerse como agua almacenada.
          </p>
        </article>
        <article className="card">
          <h3><code>repDiaNivQIng</code> responde con los números de ayer</h3>
          <p className="sub">
            Pedido para el día D devuelve filas fechadas D cuyos valores son los de D−1, medido en 113 días
            consecutivos y en capturas de 2016, 2019, 2022, 2024 y 2026. Sus filas se guardan bajo el día que
            describen, no bajo el día que las etiqueta.
          </p>
        </article>
        <article className="card">
          <h3>El caudal del historiador es caudal de entrada</h3>
          <p className="sub">
            <code>mridCaud</code> coincide con <code>q_ingresado</code> del reporte en 4281 días con r = 1,0000; el
            reporte es exactamente <code>round(historiador)</code> en cada uno de ellos. El caudal turbinado, la otra
            candidata, correlaciona a r = −0,06.
          </p>
        </article>
        <article className="card">
          <h3>La misma lectura de dos servicios se guarda dos veces</h3>
          <p className="sub">
            Cuando dos servicios de CELEC publican el mismo día, se conservan ambas filas con su fuente en lugar de
            preferir una en silencio, para que los desacuerdos entre reportes sigan siendo visibles. Los modelos
            resuelven una sola serie por un orden de fuentes declarado, que decide cobertura y no verdad.
          </p>
        </article>
        <article className="card">
          <h3>Los 2115 m son un marcador de este proyecto</h3>
          <p className="sub">
            Ninguna fuente publica ese nivel como crítico. Se pronostica porque el plan lo pide y se etiqueta como no
            verificado en cada documento, para que nadie aguas abajo lo confunda con una declaración de CELEC.
          </p>
        </article>
      </div>
    </section>
  );
}
