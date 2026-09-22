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
import type {
  AdequacyDocument,
  ForecastDocument,
  NarrativeDocument,
  RiskTier,
  StatusDocument,
} from "../lib/site/documents.ts";
import { conceptLabel, feedLabel, longDate, num, pct, signed } from "../lib/site/format.ts";
import { eachDay } from "../lib/util/dates.ts";

const REPO = "https://github.com/rengarcia/hydro-look";

/** Days of history drawn behind the forecast, and of inflow and national mix on their charts. */
const FAN_HISTORY_DAYS = 180;
const INFLOW_DAYS = 365;
const MIX_DAYS = 180;

export default function Page() {
  const now = latest();
  const forecast = apiDocument<ForecastDocument>("forecast.json");
  const adequacy = apiDocument<AdequacyDocument>("adequacy.json");
  const status = apiDocument<StatusDocument>("status.json");
  const narrative = apiDocument<NarrativeDocument>("narrative.json");

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
        <Adequacy adequacy={adequacy} />
        <Narrative narrative={narrative} forecast={forecast} />
        <Freshness status={status} />
        <Downloads narrative={narrative !== null} />
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
  // Since 2026-09-22 the 7-day row can come from M4 while the rest are M3; each row names its
  // model, and older documents that do not are all `model.id`.
  const modelOf = (h: { model?: string }) => h.model ?? forecast.model.id;
  const switched = forecast.forecast.filter((h) => modelOf(h) !== forecast.model.id);
  const switchedScore = switched[0]
    ? forecast.backtest.horizons.find((b) => b.horizon_days === switched[0]!.horizon_days)
    : undefined;
  const fellBack = forecast.horizon_switch?.status === "fallback" ? forecast.horizon_switch : null;

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
          {switched.length > 0 ? (
            <li>
              <span className="swatch" style={{ border: "2px solid var(--series-1)", borderRadius: "50%" }} />{" "}
              {switched.map((h) => h.horizon_days).join(", ")} días: otro modelo ({modelOf(switched[0]!)})
            </li>
          ) : null}
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
          primaryModel={forecast.model.id}
        />
      </div>

      <div className="scroll" style={{ marginTop: 20 }}>
        <table>
          <caption>
            Pronóstico emitido el {longDate(forecast.origin_date)} desde una cota de {num(forecast.current.level_masl, 2)} m.
            «Acierto frente a persistencia» compara el error del modelo con el de suponer que la cota no cambia:
            0 % es empatar, negativo es perder.
            {switched.length > 0 ? (
              <>
                {" "}
                La fila de {switched.map((h) => h.horizon_days).join(", ")} días viene de otro modelo,{" "}
                <code>{modelOf(switched[0]!)}</code> (árboles de gradiente que corrigen el error del balance de agua), porque
                en el respaldo es el único que le gana a la persistencia a una semana; su banda sale de sus propios errores
                fuera de muestra. El resto de horizontes, los escenarios y los días hasta el umbral son del balance de agua.
              </>
            ) : null}
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
                  <th scope="row">
                    {h.horizon_days} días{modelOf(h) !== forecast.model.id ? " ·" : ""}
                  </th>
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
        debajo del mes</strong>. Para menos de treinta días, suponer que la cota no cambia es tan bueno como esto
        {switchedScore ? (
          <>
            , salvo a {switchedScore.horizon_days} días, donde se publica el otro modelo:{" "}
            {pct(switchedScore.skill_vs_persistence * 100, 1)} mejor que la persistencia en el mismo respaldo
          </>
        ) : null}
        . La banda p10–p90 cubre entre el 72 % y el 80 % de los casos según el horizonte, por debajo del 80 % nominal.
        {fellBack ? (
          <>
            {" "}
            Hoy los {fellBack.horizon_days} días vuelven al balance de agua: <code>{fellBack.candidate_model}</code> no se
            publica cuando su respaldo no cubre los mismos orígenes que el del balance de agua (el motivo está en{" "}
            <code>horizon_switch</code> de forecast.json).
          </>
        ) : null}
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
        descripción de lo ocurrido, no una previsión: lo que viene después es la previsión, y lleva su propio
        respaldo al lado.
      </p>
    </section>
  );
}

/* ---------------------------------------------------------------- adequacy */

const TIER_STYLE: Record<RiskTier, { label: string; dot: string; gloss: string }> = {
  holgado: {
    label: "Holgado",
    dot: "good",
    gloss: "incluso el caso p90 queda cubierto",
  },
  vigilancia: {
    label: "Vigilancia",
    dot: "warning",
    gloss: "el caso p90 queda corto; el central, no",
  },
  ajustado: {
    label: "Ajustado",
    dot: "serious",
    gloss: "el caso central queda corto en menos de 5 GWh/día",
  },
  deficit: {
    label: "Déficit",
    dot: "critical",
    gloss: "el caso central queda corto en 5 GWh/día o más",
  },
};

function Adequacy({ adequacy }: { adequacy: AdequacyDocument | null }) {
  if (adequacy === null) return null;
  const tier = TIER_STYLE[adequacy.current.worst_tier] ?? TIER_STYLE.vigilancia;
  const first = adequacy.horizons[0];
  const episode = adequacy.crisis_check.episodes.find((e) => e.measured_suppression_gwh_day > 10);
  const ninety = adequacy.horizons.find((h) => h.horizon_days === 90);

  return (
    <section id="suficiencia">
      <h2>¿Alcanza la energía?</h2>
      <p className="lede">
        Una sola identidad: demanda no suprimida menos hidroeléctrica menos el techo térmico menos la importación.
        Lo que queda es el superávit; si es negativo, es el déficit esperado en GWh/día. La demanda se ajusta
        excluyendo los días de racionamiento, porque durante un corte lo que miden los contadores es la demanda que
        se permitió, no la que había.
      </p>

      <div className="cards">
        <article className="card">
          <h3>
            Peor nivel hasta los {adequacy.horizons.at(-1)?.horizon_days ?? 90} días
            <span className="basin">{adequacy.origin_date}</span>
          </h3>
          <p className="figure">
            <span className="pill" style={{ fontSize: "inherit" }}>
              <span className={`dot ${tier.dot}`} aria-hidden="true" />
              {tier.label}
            </span>
          </p>
          <p className="sub">
            {tier.gloss}; el peor cae a los {adequacy.current.worst_tier_horizon_days} días.
          </p>
          <dl className="pairs">
            <dt>Margen a 7 días</dt>
            <dd>{first ? pct(first.margin_pct, 1) : "—"}</dd>
            <dt>Margen a 90 días</dt>
            <dd>{ninety ? pct(ninety.margin_pct, 1) : "—"}</dd>
            <dt>Quincena hídrica</dt>
            <dd>{num(adequacy.data.hydro_anomaly, 2)} × su climatología</dd>
          </dl>
        </article>

        <article className="card">
          <h3>
            Techos supuestos<span className="basin">GWh/día</span>
          </h3>
          <dl className="pairs">
            <dt>Térmica</dt>
            <dd>{num(adequacy.assumptions.thermal_gwh_day, 2)}</dd>
            <dt>Importación</dt>
            <dd>{num(adequacy.assumptions.import_gwh_day, 2)}</dd>
            <dt>Importación en crisis</dt>
            <dd>{num(adequacy.assumptions.stressed_import_gwh_day, 2)}</dd>
            <dt>Otros tipos</dt>
            <dd>{num(adequacy.assumptions.other_gwh_day, 2)}</dd>
          </dl>
          <p className="sub" style={{ marginTop: 12 }}>
            Son máximos demostrados en los últimos tres años, no declaraciones de disponibilidad: ninguna fuente
            que alcance este proyecto publica los mantenimientos programados. Se editan en{" "}
            <code>{adequacy.assumptions.editable_at}</code>.
          </p>
        </article>
      </div>

      <div className="scroll" style={{ marginTop: 20 }}>
        <table>
          <caption>
            Todo en GWh/día. «Requerimiento» es demanda menos hidroeléctrica: lo que tienen que cubrir la térmica,
            la importación y el resto. «Superávit» es lo que sobra después de cubrirlo; en negativo sería déficit.
            La columna «con importación en crisis» repite la cuenta con la importación que hubo realmente entre el
            1 de octubre y el 10 de noviembre de 2024.
          </caption>
          <thead>
            <tr>
              <th>Horizonte</th>
              <th className="num">Demanda</th>
              <th className="num">Hidroeléctrica</th>
              <th className="num">Requerimiento</th>
              <th className="num">Superávit</th>
              <th className="num">Con importación en crisis</th>
              <th>Nivel</th>
            </tr>
          </thead>
          <tbody>
            {adequacy.horizons.map((h) => (
              <tr key={h.horizon_days}>
                <th scope="row">{h.horizon_days} días</th>
                <td className="num">{num(h.demand_gwh_day, 1)}</td>
                <td className="num">{num(h.hydro_gwh_day, 1)}</td>
                <td className="num">{num(h.requirement_gwh_day, 1)}</td>
                <td className="num">{signed(-h.deficit_gwh_day, 1)}</td>
                <td className="num">{signed(-h.stressed_deficit_gwh_day, 1)}</td>
                <td>
                  <span className="pill">
                    <span className={`dot ${TIER_STYLE[h.tier]?.dot ?? "warning"}`} aria-hidden="true" />
                    {TIER_STYLE[h.tier]?.label ?? h.tier}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="note">
        La importación es el supuesto más frágil de la tabla, y no en abstracto. Entre el 1 de octubre y el 10 de
        noviembre de 2024, con el país racionando catorce horas al día, la importación desde Colombia corrió a{" "}
        {num(adequacy.assumptions.stressed_import_gwh_day, 2)} GWh/día frente a los{" "}
        {num(adequacy.assumptions.import_gwh_day, 2)} que había alcanzado ese agosto, porque Colombia estaba seca al
        mismo tiempo. Un interconector no es firme cuando la sequía es compartida.
      </p>

      {episode ? (
        <>
          <div className="scroll" style={{ marginTop: 20 }}>
            <table>
              <caption>
                La comprobación. Un déficit es un contrafactual y no se puede medir, pero durante un racionamiento
                deja una sombra observable: la diferencia entre la demanda que el modelo dice que hubo y la que
                registraron los contadores. Si la identidad es correcta, esa diferencia y el déficit calculado
                deben tener el mismo tamaño.
              </caption>
              <thead>
                <tr>
                  <th>Episodio</th>
                  <th className="num">Días</th>
                  <th className="num">Demanda modelada</th>
                  <th className="num">Carga medida</th>
                  <th className="num">Supresión observada</th>
                  <th className="num">Déficit calculado</th>
                </tr>
              </thead>
              <tbody>
                {adequacy.crisis_check.episodes.map((e) => (
                  <tr key={e.start}>
                    <th scope="row">
                      {longDate(e.start)} → {longDate(e.end)}
                    </th>
                    <td className="num">{e.days}</td>
                    <td className="num">{num(e.modelled_demand_gwh_day, 1)}</td>
                    <td className="num">{num(e.measured_load_gwh_day, 1)}</td>
                    <td className="num">{num(e.measured_suppression_gwh_day, 1)}</td>
                    <td className="num">{num(e.implied_deficit_gwh_day, 1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="note">
            En el episodio largo de 2024 las dos últimas columnas —{" "}
            {num(episode.measured_suppression_gwh_day, 1)} y {num(episode.implied_deficit_gwh_day, 1)} GWh/día —
            se calculan desde lados distintos de la identidad y coinciden dentro de{" "}
            {num(Math.abs(episode.measured_suppression_gwh_day - episode.implied_deficit_gwh_day), 1)} GWh/día. En
            los dos episodios cortos no coinciden: el modelo no ve déficit donde sí hubo cortes. Las fechas de esos
            dos episodios están registradas al mes, no al día, y son de prensa, no de una fuente oficial.
          </p>
        </>
      ) : null}

      <p className="note">
        Lo que el respaldo mide: sobre {adequacy.model.backtest_origins} orígenes mensuales, el requerimiento le
        gana a suponer que el último mes se repite{" "}
        {first?.backtest.requirement_skill_vs_persistence !== null && first !== undefined ? (
          <>
            por {pct(first.backtest.requirement_skill_vs_persistence! * 100, 1)} a 7 días
            {ninety?.backtest.requirement_skill_vs_persistence !== null && ninety !== undefined ? (
              <> y {pct(ninety.backtest.requirement_skill_vs_persistence! * 100, 1)} a 90</>
            ) : null}
          </>
        ) : null}
        , y su banda p10–p90 cubre entre el 60 % y el 67 % de los casos frente al 80 % nominal, así que conviene
        leerla como dos tercios y no como cuatro quintos. El término hidroeléctrico es el débil: a 30 días no le
        gana a suponer que el último mes se repite. Los números completos, negativos incluidos, están en{" "}
        <a href={`${REPO}/blob/main/data/reports/adequacy.md`}>data/reports/adequacy.md</a>.
      </p>

      <p className="note">
        Y lo que dijeron estos niveles cuando se aplicaron a cada mes del registro: sobre{" "}
        {adequacy.tier_history.origins} orígenes mensuales, {adequacy.tier_history.origins_followed_by_rationing}{" "}
        fueron seguidos de racionamiento dentro de treinta días y {adequacy.tier_history.origins_flagged} se marcaron
        «ajustado» o «déficit». De los marcados,{" "}
        {pct((adequacy.tier_history.share_of_flagged_that_preceded_cuts ?? 0) * 100, 0)} precedieron cortes; de los
        que precedieron cortes, se marcó{" "}
        {pct((adequacy.tier_history.share_of_cuts_that_were_flagged ?? 0) * 100, 0)}. No grita lobo y se le escapan
        casi todos los lobos, que es la forma que cabe esperar de un modelo cuyo término más débil es el que decide
        cuánta agua hay. Tres episodios no son una muestra con la que ajustar un umbral, y ninguno de estos se
        ajustó a ellos.
      </p>

      <p className="note">
        Nada de esto modela la red. Un déficit en GWh/día dice que la energía no está; no dice si podría entregarse
        donde hacía falta, que es otro fallo y el que causó el apagón de junio de 2024.
      </p>
    </section>
  );
}

/* ---------------------------------------------------------------- narrative */

const CONFIDENCE_ES: Record<NarrativeDocument["confidence"], string> = {
  low: "baja",
  medium: "media",
  high: "alta",
};

/** `2026-09-22T12:40:05Z` -> `22 de septiembre de 2026, 07:40 (hora de Ecuador)`. */
function narrativeStamp(timestamp: string): string {
  const instant = Date.parse(timestamp);
  if (!Number.isFinite(instant)) return timestamp;
  // Ecuador is UTC−5 all year; the arithmetic is the same one `util/dates.ts` does.
  const local = new Date(instant - 5 * 3_600_000).toISOString();
  return `${longDate(local.slice(0, 10))}, ${local.slice(11, 16)} (hora de Ecuador)`;
}

/**
 * Phase 6b. A paragraph a language model wrote, and — beside it, in the same ink — the numbers
 * it was handed, so the reader can check one against the other without leaving the section.
 *
 * The numbers come from the narrative's own `basis`, not from today's documents. On a day the
 * gateway rate-limits or the validator rejects the text, the page keeps the previous narrative,
 * and pairing old prose with new numbers would make a correct paragraph look wrong. When the
 * basis is older than the forecast above, the section says so.
 *
 * The risk tier shown is the one the text was given, and it is the adequacy model's: the model
 * explains it and cannot choose it, so there is never a second tier on the page.
 */
function Narrative({ narrative, forecast }: { narrative: NarrativeDocument | null; forecast: ForecastDocument | null }) {
  if (narrative === null || !narrative.outlook_es) return null;
  const basis = narrative.basis;
  const mazar = basis?.reservoirs?.find((r) => r.site === (basis.mazar_forecast?.site ?? "mazar")) ?? null;
  const floors = mazar?.floors ?? [];
  const primaryBand = mazar?.bands?.[0] ?? null;
  const horizons = basis?.mazar_forecast?.horizons ?? [];
  const rain = basis?.precipitation_16d ?? null;
  const enso = basis?.enso ?? null;
  const tier = narrative.risk_tier ? TIER_STYLE[narrative.risk_tier as RiskTier] : undefined;
  const stale = forecast !== null && narrative.origin_date < forecast.origin_date;

  return (
    <section id="lectura">
      <h2>Lectura del día</h2>
      <p className="lede">
        Un resumen en prosa de los números de esta página, redactado por un modelo de lenguaje a partir de los datos
        que se muestran a su derecha y de nada más. Un validador rechaza cualquier texto que cite una cota o una fecha
        que no esté en esos datos; si el de hoy fue rechazado, se mantiene el anterior.
      </p>

      <div className="cards">
        <article className="card">
          <h3>
            Resumen<span className="basin">texto generado por un modelo</span>
          </h3>
          <p style={{ margin: "8px 0 0" }}>{narrative.outlook_es}</p>
          {narrative.drivers.length > 0 ? (
            <ul className="sub" style={{ margin: "12px 0 0", paddingLeft: 18 }}>
              {narrative.drivers.map((driver, i) => (
                <li key={i}>{driver}</li>
              ))}
            </ul>
          ) : null}
          <dl className="pairs">
            <dt>Confianza declarada</dt>
            <dd>{CONFIDENCE_ES[narrative.confidence] ?? narrative.confidence}</dd>
            <dt>Generado</dt>
            <dd>{narrativeStamp(narrative.generated_at)}</dd>
            <dt>Datos del</dt>
            <dd>{longDate(narrative.origin_date)}</dd>
            <dt>Modelo</dt>
            <dd>
              <code>{narrative.model}</code> · instrucciones <code>{narrative.prompt_version}</code>
            </dd>
          </dl>
        </article>

        <article className="card">
          <h3>
            Los números que leyó<span className="basin">{mazar?.label ?? "Mazar"}</span>
          </h3>
          <dl className="pairs">
            {mazar ? (
              <>
                <dt>Cota</dt>
                <dd>{num(mazar.level_masl, 2)} m</dd>
                {primaryBand ? (
                  <>
                    <dt>Banda {num(primaryBand.floor_masl, 0)}–{num(primaryBand.ceiling_masl, 0)}</dt>
                    <dd>{pct(primaryBand.band_pct)}</dd>
                  </>
                ) : null}
                <dt>Pendiente 7 / 14 / 30 d</dt>
                <dd>
                  {signed(mazar.slopes_m_per_day.d7, 2)} / {signed(mazar.slopes_m_per_day.d14, 2)} /{" "}
                  {signed(mazar.slopes_m_per_day.d30, 2)} m/día
                </dd>
                {floors.map((floor) => (
                  <FloorPair key={floor.floor_masl} floor={floor} />
                ))}
              </>
            ) : null}
            {horizons.map((h) => (
              <HorizonPair key={h.horizon_days} horizon={h} />
            ))}
            {tier ? (
              <>
                <dt>Suficiencia</dt>
                <dd>
                  <span className="pill">
                    <span className={`dot ${tier.dot}`} aria-hidden="true" />
                    {tier.label}
                  </span>
                </dd>
              </>
            ) : null}
            {rain ? (
              <>
                <dt>Lluvia prevista, {rain.days} días</dt>
                <dd>
                  {num(rain.forecast_total_mm, 1)} mm frente a una mediana de {num(rain.climatology_p50_mm, 1)} mm
                  {rain.coordinate_status === "provisional" ? " (punto provisional)" : ""}
                </dd>
              </>
            ) : null}
            {enso ? (
              <>
                <dt>ONI {enso.month}</dt>
                <dd>
                  {signed(enso.oni, 2)} · {{ el_nino: "El Niño", la_nina: "La Niña", neutral: "neutral" }[enso.phase]}
                </dd>
              </>
            ) : null}
          </dl>
          <p className="sub" style={{ marginTop: 12 }}>
            El abanico y la tabla completa están en <a href="#mazar">la sección de Mazar</a>; el nivel de suficiencia, en{" "}
            <a href="#suficiencia">la sección anterior</a>. El documento entero, con todo lo que recibió el modelo, es{" "}
            <a href="/api/narrative.json">narrative.json</a>.
          </p>
        </article>
      </div>

      <p className="note">
        <strong>El texto lo generó un modelo de lenguaje; el pronóstico es el estadístico.</strong> Las cifras de la
        cota futura son las de la sección de Mazar (el balance de agua y, donde la tabla lo indica, el modelo que corrige
        su error a 7 días), con su respaldo medido, y el nivel de
        riesgo lo calcula el modelo de suficiencia: el modelo de lenguaje los describe, no los produce.
        {stale ? (
          <>
            {" "}
            Este texto se escribió sobre los datos del {longDate(narrative.origin_date)}; las secciones de arriba ya
            muestran los del {longDate(forecast!.origin_date)}.
          </>
        ) : null}
      </p>
    </section>
  );
}

function FloorPair({ floor }: { floor: NarrativeDocument["basis"]["reservoirs"][number]["floors"][number] }) {
  const pace = floor.days_at_slope_30d ?? floor.days_at_slope_7d;
  return (
    <>
      <dt>
        Sobre {num(floor.floor_masl, 0)} m{floor.status === "unverified" ? " (marcador propio)" : ""}
      </dt>
      <dd>
        {num(floor.metres_above, 2)} m
        {pace !== null ? <> · {num(pace, 0)} días al ritmo de {floor.days_at_slope_30d !== null ? "30" : "7"} días</> : null}
      </dd>
    </>
  );
}

function HorizonPair({ horizon }: { horizon: NonNullable<NarrativeDocument["basis"]["mazar_forecast"]>["horizons"][number] }) {
  return (
    <>
      <dt>p50 a {horizon.horizon_days} días</dt>
      <dd>
        {num(horizon.p50, 2)} m ({num(horizon.p10, 2)}–{num(horizon.p90, 2)})
      </dd>
    </>
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

function Downloads({ narrative }: { narrative: boolean }) {
  return (
    <section id="descargas">
      <h2>Descargas</h2>
      <p className="lede">
        Los documentos JSON son pequeños y estables; las tablas completas están en CSV particionado por año,
        y cada respuesta original queda archivada comprimida junto a la fila que produjo.
      </p>
      <ul className="links">
        <li>
          <a href="/api/latest.json">latest.json</a> — <code>cota, banda, caudal y mezcla del día</code>
        </li>
        <li>
          <a href="/api/forecast.json">forecast.json</a> — <code>pronóstico de Mazar con su respaldo</code>
        </li>
        <li>
          <a href="/api/adequacy.json">adequacy.json</a> —{" "}
          <code>déficit esperado en GWh/día y nivel de riesgo</code>
        </li>
        <li>
          <a href="/api/status.json">status.json</a> — <code>frescura por fuente y control de calidad</code>
        </li>
        {narrative ? (
          <li>
            <a href="/api/narrative.json">narrative.json</a> —{" "}
            <code>el resumen generado por un modelo, con los datos que recibió</code>
          </li>
        ) : null}
        <li>
          <a href={`${REPO}/tree/main/data/curated`}>data/curated/</a> — <code>tablas en CSV por año</code>
        </li>
        <li>
          <a href={`${REPO}/tree/main/data/raw`}>data/raw/</a> — <code>respuestas originales, NDJSON comprimido</code>
        </li>
        <li>
          <a href={`${REPO}/blob/main/data/reports/backtest.md`}>backtest.md</a> —{" "}
          <code>el respaldo del pronóstico de cota, incluidos los negativos</code>
        </li>
        <li>
          <a href={`${REPO}/blob/main/data/reports/adequacy.md`}>adequacy.md</a> —{" "}
          <code>el respaldo del cálculo de suficiencia</code>
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
