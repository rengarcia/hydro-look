/** What one ingestion run accumulates before anything is written. */

import type { NationalBalanceRow, ObservationRow, OperativaRow } from "../contracts/tables.ts";
import type { BandReading } from "../parse/types.ts";

export interface IngestBatch {
  observations: ObservationRow[];
  bands: BandReading[];
  national: NationalBalanceRow[];
  operativa: OperativaRow[];
  notes: string[];
  errors: string[];
}

export function emptyBatch(): IngestBatch {
  return { observations: [], bands: [], national: [], operativa: [], notes: [], errors: [] };
}
