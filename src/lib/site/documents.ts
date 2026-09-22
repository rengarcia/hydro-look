/**
 * What the site needs out of the documents under `public/api/`.
 *
 * These are narrow readers, not the full shape of what `forecast.js`/`check.ts` write. Both
 * documents are produced in this repository and carry more than the page renders, and declaring
 * only the fields the page touches means a change to the rest cannot break the build — while a
 * change to a field the page *does* render fails `tsc` rather than printing `undefined` into
 * the HTML for a week before anybody notices.
 */

export interface ForecastHorizon {
  horizon_days: number;
  target_date: string;
  p10: number;
  p50: number;
  p90: number;
  median_backtest_residual_m: number | null;
  ensemble: { p10: number; p90: number; n: number; years: number[] };
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
}

export type RiskTier = "holgado" | "vigilancia" | "ajustado" | "deficit";

export interface AdequacyHorizon {
  horizon_days: number;
  target_date: string;
  demand_gwh_day: number;
  hydro_gwh_day: number;
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
    editable_at: string;
  };
  current: { tier: RiskTier; worst_tier: RiskTier; worst_tier_horizon_days: number; worst_deficit_gwh_day: number };
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
}

export interface StatusFeed {
  feed: string;
  latest: string | null;
  limit_days: number;
  state: "current" | "stale" | "not_ingested";
}

export interface StatusDocument {
  generated_at: string;
  as_of: string;
  ok: boolean;
  status: string;
  feeds: StatusFeed[];
  tables: Record<string, { rows: number }>;
  findings: { check: string; level: string; message: string }[];
}
