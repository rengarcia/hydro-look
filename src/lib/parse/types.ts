/** Row shapes the parsers emit. Provenance columns are added by the ingest layer. */

import type { IsoDate } from "../util/dates.ts";
import type { SiteId, VariableId } from "../registry.ts";

export interface Observation {
  date: IsoDate;
  site: SiteId;
  variable: VariableId;
  value: number;
  /** Endpoint that produced the value, e.g. `ords:repDiaHid12m`. */
  source: string;
  /** Historian point id, for values read through pointValues; empty for the report endpoints. */
  mrid: string;
}

/** A declared operating band as seen on a given day; the store folds these into ranges. */
export interface BandReading {
  date: IsoDate;
  site: SiteId;
  cota_min: number | null;
  cota_max: number | null;
  qmax_m3s: number | null;
  source: string;
}

export interface ParseResult {
  observations: Observation[];
  bands?: BandReading[];
  /** Human-readable notes worth surfacing in the run log (e.g. a partial day). */
  notes?: string[];
}
