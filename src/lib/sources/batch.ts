/** What one ingestion run accumulates before anything is written. */

import type { EnsoRow, NationalBalanceRow, ObservationRow, OperativaRow, WeatherRow } from "../contracts/tables.ts";
import type { BandReading } from "../parse/types.ts";

export interface IngestBatch {
  observations: ObservationRow[];
  bands: BandReading[];
  national: NationalBalanceRow[];
  operativa: OperativaRow[];
  weather: WeatherRow[];
  enso: EnsoRow[];
  notes: string[];
  errors: string[];
}

export function emptyBatch(): IngestBatch {
  return { observations: [], bands: [], national: [], operativa: [], weather: [], enso: [], notes: [], errors: [] };
}
