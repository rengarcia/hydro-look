/**
 * What the site needs out of the documents under `public/api/`.
 *
 * These are narrow readers, not the full shape of what `forecast.js`/`check.ts` write. Both
 * documents are produced in this repository and carry more than the page renders, and declaring
 * only the fields the page touches means a change to the rest cannot break the build — while a
 * change to a field the page *does* render fails `tsc` rather than printing `undefined` into
 * the HTML for a week before anybody notices.
 */

import type { NarrativePayload } from "../narrative/payload.ts";

/**
 * The fields the pages render, by document, as paths into the published JSON. The interfaces
 * below say it to `tsc`; this says it to the schema test, which checks that every one of these
 * is a field the published JSON Schema *requires*. A schema change that makes one optional — a
 * promise to third parties loosened — would otherwise leave the site reading a field nobody
 * guarantees any more.
 */
export const SITE_READS = {
  latest: [
    "data_date",
    "reservoirs[].site",
    "reservoirs[].label",
    "reservoirs[].basin",
    "reservoirs[].level.masl",
    "reservoirs[].level.date",
    "reservoirs[].level.first_reading",
    "reservoirs[].level.observed_min_masl",
    "reservoirs[].level.observed_max_masl",
    "reservoirs[].level.previous",
    "reservoirs[].level.delta_1d_m",
    "reservoirs[].bands[].min_masl",
    "reservoirs[].bands[].max_masl",
    "reservoirs[].bands[].declaration",
    "reservoirs[].bands[].declaration_es",
    "reservoirs[].bands[].band_pct",
    "reservoirs[].slopes_m_per_day.d7",
    "reservoirs[].slopes_m_per_day.d30",
    "reservoirs[].inflow.m3s",
    "reservoirs[].inflow.date",
    "reservoirs[].inflow.climatology",
    "reservoirs[].inflow.delta_1d_m3s",
    "national.date",
    "national.supply_gwh",
    "national.hydro_share_pct",
    "national.thermal_share_pct",
    "national.import_share_pct",
    "national.total_generation_gwh",
    "national.delta_1d",
  ],
  status: [
    "generated_at",
    "feeds[].id",
    "feeds[].label_es",
    "feeds[].latest",
    "feeds[].limit_days",
    "feeds[].state",
    "findings[].message",
    "tables",
  ],
  forecast: [
    "origin_date",
    "site",
    "model.id",
    "model.backtest_origins",
    "current.level_masl",
    "thresholds[].name",
    "thresholds[].level_masl",
    "thresholds[].status",
    "forecast[].horizon_days",
    "forecast[].target_date",
    "forecast[].p10",
    "forecast[].p50",
    "forecast[].p90",
    "days_to_threshold.horizon_days",
    "days_to_threshold.thresholds[].level_masl",
    "days_to_threshold.thresholds[].status",
    "days_to_threshold.thresholds[].scenarios[].crossesOn",
    "backtest.report",
    "backtest.horizons[].skill_vs_persistence",
    "backtest.horizons[].coverage_p10_p90",
    "crisis_check.threshold_masl",
    "crisis_check.false_alarms_p50",
    "crisis_check.episodes[].crossed_on",
  ],
  adequacy: [
    "origin_date",
    "current.tier",
    "current.worst_tier",
    "current.worst_tier_horizon_days",
    "current.narrative_tier_field",
    "horizons[].horizon_days",
    "horizons[].deficit_gwh_day",
    "horizons[].margin_pct",
    "horizons[].tier",
    "assumptions.thermal_gwh_day",
    "assumptions.import_gwh_day",
    "assumptions.stressed_import_gwh_day",
    "assumptions.editable_at",
    "data.hydro_anomaly",
    "tier_history.origins",
    "tier_history.origins_flagged",
    "crisis_check.episodes[].measured_suppression_gwh_day",
    "crisis_check.episodes[].implied_deficit_gwh_day",
  ],
  narrative: ["generated_at", "model", "origin_date", "risk_tier", "outlook_es", "drivers", "confidence", "basis"],
} as const;

export interface ForecastHorizon {
  horizon_days: number;
  target_date: string;
  p10: number;
  p50: number;
  p90: number;
  median_backtest_residual_m: number | null;
  ensemble: { p10: number; p90: number; n: number; years: number[] };
  /**
   * The model whose median this row publishes. Since 2026-09-22 the 7-day row can come from
   * M4 while the rest are M3; absent in documents written before then, which were all
   * `model.id`.
   */
  model?: string;
  band_source?: string;
}

export interface ForecastThreshold {
  name: string;
  level_masl: number;
  source: string;
  status: string;
  note: string;
  metres_above: number | null;
}

export interface CrossingScenario {
  scenario: string;
  analogYear: number;
  inflowMeanM3s: number;
  crossesOn: string | null;
  days: number | null;
  minimumLevelMasl: number;
}

export interface CrossingThreshold {
  threshold: string;
  level_masl: number;
  status: string;
  across_all_analogue_years: {
    analogue_years: number;
    years_that_cross: number;
    p10_days: number | null;
    p50_days: number | null;
    p90_days: number | null;
  };
  scenarios: CrossingScenario[];
}

export interface BacktestHorizon {
  horizon_days: number;
  /** Whose backtest this row is: the model published at this horizon. Absent before 2026-09-22. */
  model?: string;
  n: number;
  mae_m: number;
  skill_vs_persistence: number;
  coverage_p10_p90: number;
}

export interface ForecastDocument {
  generated_at: string;
  run_id: string;
  origin_date: string;
  site: string;
  disclaimer: string;
  model: { id: string; label: string; version: string; backtest_origins: number };
  /** Whether the 7-day row publishes M4 this run, and why not when it does not. */
  horizon_switch?: { horizon_days: number; candidate_model: string; published_model: string; status: string; reason: string } | null;
  current: {
    level_masl: number;
    observed_on: string;
    storage_above_lowest_threshold_hm3: number | null;
    surface_area_km2: number;
    release_stance_m3s: number;
  };
  thresholds: ForecastThreshold[];
  forecast: ForecastHorizon[];
  days_to_threshold: { horizon_days: number; note: string; thresholds: CrossingThreshold[] };
  backtest: { report: string; horizons: BacktestHorizon[] };
  crisis_check: {
    threshold_masl: number;
    origins_considered: number;
    false_alarms_p50: number;
    episodes: { crossed_on: string; p50_lead_time_days: number | null; p10_lead_time_days: number | null }[];
  };
  /** Which basin's rain the run read. Absent before 2026-09-23. */
  precipitation_basin?: PrecipitationBasin;
  /** Inflow forecasts at the other plants. Absent before 2026-09-23, and when none ran. */
  inflow_forecasts?: InflowForecasts;
  /** How the published level forecasts did. Absent before 2026-09-23. */
  scorecard?: ScorecardBlock;
}

export type RiskTier = "holgado" | "vigilancia" | "ajustado" | "deficit";

export interface AdequacyHorizon {
  horizon_days: number;
  target_date: string;
  demand_gwh_day: number;
  hydro_gwh_day: number;
  hydro_p10: number | null;
  hydro_p90: number | null;
  requirement_gwh_day: number;
  deficit_gwh_day: number;
  deficit_p10: number | null;
  deficit_p90: number | null;
  stressed_deficit_gwh_day: number;
  margin_pct: number;
  tier: RiskTier;
  backtest: {
    requirement_mae_gwh_day: number | null;
    requirement_skill_vs_persistence: number | null;
    requirement_coverage_p10_p90: number | null;
    hydro_skill_vs_persistence: number | null;
    n: number;
  };
}

export interface AdequacyEpisode {
  start: string;
  end: string;
  days: number;
  modelled_demand_gwh_day: number;
  measured_load_gwh_day: number;
  measured_suppression_gwh_day: number;
  measured_hydro_gwh_day: number;
  measured_import_gwh_day: number;
  implied_deficit_gwh_day: number;
}

export interface AdequacyDocument {
  generated_at: string;
  run_id: string;
  origin_date: string;
  model: { id: string; label: string; backtest_origins: number };
  data: { usable_days: number; rejected_days: number; hydro_anomaly: number; demand_growth_pct_per_year: number };
  assumptions: {
    thermal_gwh_day: number;
    import_gwh_day: number;
    stressed_import_gwh_day: number;
    other_gwh_day: number;
    /** Prose naming where each ceiling came from, including the day the import maximum was set. */
    basis?: string;
    /**
     * Whether imports are arriving. When they are cut off the central case uses what is arriving
     * rather than the demonstrated maximum. Absent in documents written before the field existed.
     */
    import_regime?: {
      state: string;
      central_import_gwh_day: number;
      trailing_gwh_day: number;
      trailing_thermal_gwh_day: number;
      window_days: number;
      note: string;
    };
    editable_at: string;
  };
  current: {
    tier: RiskTier;
    worst_tier: RiskTier;
    worst_tier_horizon_days: number;
    worst_deficit_gwh_day: number;
    /** Which of the two tiers the narrative is written about. Stamped by `publish/contract.ts`. */
    narrative_tier_field?: "worst_tier" | "tier";
  };
  horizons: AdequacyHorizon[];
  tier_history: {
    horizon_days: number;
    origins: number;
    origins_followed_by_rationing: number;
    origins_flagged: number;
    share_of_flagged_that_preceded_cuts: number | null;
    share_of_cuts_that_were_flagged: number | null;
  };
  crisis_check: { episodes: AdequacyEpisode[] };
  /** The tier definitions in Spanish, as the document states them. */
  tiers?: { definition: Record<string, string> };
  /** How the p10–p90 band is calibrated. Absent before 2026-09-23. */
  band_method?: BandMethod;
  /** The tier under each import assumption. Absent before 2026-09-23. */
  import_sensitivity?: ImportSensitivity;
  /** How the published net requirement did. Absent before 2026-09-23. */
  scorecard?: ScorecardBlock;
  /** The deficit with Coca Codo Sinclair out of service (PLAN §8a gap 5). Absent before 2026-09-24. */
  plant_outage?: PlantOutage;
}

export interface StatusFeed {
  /** The feed's stable code, `ords_levels`. */
  id: string;
  /** What the page calls it. */
  label_es: string;
  /** Deprecated: the English label the log uses. */
  feed: string;
  latest: string | null;
  limit_days: number;
  state: "current" | "stale" | "not_ingested";
}

export interface StatusDocument {
  generated_at: string;
  data_date: string | null;
  as_of: string;
  ok: boolean;
  status: string;
  feeds: StatusFeed[];
  tables: Record<string, { rows: number }>;
  findings: { check: string; level: string; message: string }[];
}

/**
 * `narrative.json`, as far as the panel reads it. `basis` is the payload the text was written
 * from, and the panel renders from it rather than from today's `latest.json`: when a later run
 * is skipped or rejected the page keeps the older text, and the numbers beside it have to be the
 * ones it was written about, not the ones that have arrived since.
 *
 * The type is imported, not restated, and only as a type: the site must never pull the AI SDK
 * or the payload builder's file reads into the bundle.
 */
export interface NarrativeDocument {
  generated_at: string;
  model: string;
  prompt_version: string;
  origin_date: string;
  risk_tier: string | null;
  /** The adequacy field the tier was copied from, `adequacy.current.worst_tier`. */
  risk_tier_source?: string;
  outlook_es: string;
  drivers: string[];
  confidence: "low" | "medium" | "high";
  disclaimer: string;
  basis: NarrativePayload;
}

/* ------------------------------------------------------------------ additive blocks */

/*
 * The blocks below were added to `forecast.json` and `adequacy.json` after schema version 1 was
 * published, and a document written before them has none of them. Every one is optional here and
 * in the schemas, and every component that reads one renders nothing — or says it has nothing —
 * when it is absent. They are not in `SITE_READS` for the same reason: nothing guarantees them.
 */

/** How one model, version and horizon scored once published rows reached their dates (§5.1). */
export interface ScorecardHorizon {
  model_id: string;
  model_version: string;
  horizon_days: number;
  n: number;
  mae: number | null;
  bias: number | null;
  n_band: number;
  coverage_p10_p90: number | null;
  pinball_mean: number | null;
  first_origin: string | null;
  last_origin: string | null;
}

/** One published row against what was then observed. */
export interface ScorecardRow {
  run_id: string;
  model_id: string;
  model_version: string;
  origin_date: string;
  horizon_days: number;
  target_date: string;
  p10: number | null;
  p50: number;
  p90: number | null;
  observed: number | null;
  error: number | null;
  in_band: boolean | null;
}

/** The `scorecard` block of `forecast.json` (level, m) and `adequacy.json` (net requirement, GWh/day). */
export interface ScorecardBlock {
  generated_at: string;
  observed_through: string | null;
  target: string;
  units: string;
  runs_considered: number;
  runs_superseded: number;
  rows_scored: number;
  rows_pending: number;
  rows_excluded: number;
  method: string;
  by_horizon: ScorecardHorizon[];
  recent: ScorecardRow[];
}

/** Which basin's ERA5 rain the Mazar run read, and why when it is not the verified centroid. */
export interface PrecipitationBasin {
  basin: string;
  verified_centroid: boolean;
  era5_days: number;
  share_since_1990: number;
  fallback_reason: string | null;
}

export interface InflowBacktest {
  n: number;
  mae_m3s: number | null;
  persistence_mae_m3s: number | null;
  climatology_mae_m3s: number | null;
  coverage_p10_p90: number | null;
}

/** One horizon of a plant's inflow forecast: published with its quantiles, or not and why. */
export interface InflowHorizon {
  horizon_days: number;
  published: boolean;
  reason: string;
  backtest: InflowBacktest;
  target_date?: string;
  p10?: number;
  p50?: number;
  p90?: number;
  ensemble_years?: number;
  /** Whether GEOGLOWS' river forecast was one of the ensemble's members today. */
  with_river_forecast?: boolean;
}

export interface InflowPlant {
  site: string;
  origin_date: string;
  variable: string;
  target: string;
  precip_basin: string | null;
  rain_conditioned: boolean;
  horizons: InflowHorizon[];
}

/** `forecast.json`'s `inflow_forecasts`: the mean inflow at the other plants (§5.3). */
export interface InflowForecasts {
  report: string;
  note: string;
  plants: InflowPlant[];
}

export type ImportCase = "demonstrated" | "stressed" | "current_regime";

/** `adequacy.json`'s `import_sensitivity`: the tier under each import assumption (§5.5). */
export interface ImportSensitivity {
  note: string;
  central_case: ImportCase;
  cases: {
    case: ImportCase;
    import_gwh_day: number;
    worst_tier: RiskTier;
    worst_tier_horizon_days: number;
    horizons: { horizon_days: number; deficit_gwh_day: number; deficit_p90: number | null; tier: RiskTier }[];
  }[];
}

/** `adequacy.json`'s `plant_outage`: the deficit and tier with one plant out of service. */
export interface PlantOutage {
  note: string;
  site: string;
  available: boolean;
  reason?: string | null;
  share_of_hydro?: number;
  plant_gwh_day?: number;
  share_days?: number;
  horizons?: {
    horizon_days: number;
    lost_gwh_day: number;
    hydro_gwh_day: number;
    deficit_gwh_day: number;
    deficit_p90: number | null;
    tier: RiskTier;
  }[];
}

/** How the adequacy band is calibrated. */
export interface BandMethod {
  method: string;
  quantiles: number[];
  nominal_coverage: number;
  stretch_by_horizon: { horizon_days: number; stretch: number | null }[];
}
