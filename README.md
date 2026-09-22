# hydro-look

An open pipeline for the state of Ecuador's hydro fleet: reservoir levels and inflows,
per-plant generation, and the national energy balance — collected daily from the public
CELEC and CENACE endpoints, versioned in this repository, and published as a static site.

Not an official source. Every number here is a copy of what CELEC or CENACE published,
with the response that produced it archived alongside it.

## Status

| Phase | State |
|---|---|
| 0 · Reconnaissance and fixtures | done — `scripts/recon/RECON_REPORT.md` |
| 1 · Full ingest (CELEC ORDS + CENACE SMEC + Información Operativa) | code complete; levels backfilled to 2014-09-20, CELEC Sur energy to 2015-11-01, hourly energy for Coca Codo Sinclair (2016-06-24→), Agoyán (2017-01-01→) and Manduriacu (2017-07-31→). What remains is the acceptance criterion *three consecutive green scheduled daily runs*: the schedule first fires 2026-09-22 12:15 UTC, so the earliest it can close is 2026-09-25 |
| 2 · CENACE history and reconciliation | SMEC backfilled 2016-05-01 → 2026-09-20 (3,780 days, 0.40% missing) and reconciled against the ORDS per-plant energy; the Información Operativa cross-check needs ≥ 20 snapshot days and has 1 |
| 3 · Additional reservoir levels | code complete 2026-09-22 — `ords-historian` pages the monthly aggregation with a Mazar control guard. No rows ingested yet: the daily run starts collecting the running month, the history needs one backfill dispatch |
| 4 · Covariates and quality | reference tables (`plants`, `thresholds`, `rationing_episodes`) and the `npm run check` gates done, `public/api/status.json` published; ONI 1950-01 → 2026-07 and recent ERA5 ingested. Outstanding: verified basin centroids and the ERA5 climatology backfill |
| 5–7 · Modelling, site, extensions | planned — see `PLAN.md` |

## Where the data comes from

| Source | What it gives | History |
|---|---|---|
| CELEC ORDS `repDiaHid12m` | daily level, inflow and declared band for Mazar, Amaluza, Minas San Francisco, Delsitanisagua — 365 days per request | 2015-09-20 |
| CELEC ORDS `repDiaEner12m` | daily energy per CELEC Sur plant, 182 days per request | 2020-09-20 |
| CELEC ORDS `repDia*` (one day each) | level/inflow, power, turbined flow, units online, spill, plant factor, day-ahead plan, SNI total | per day, 2016 → |
| CELEC ORDS `{code}EnerDia` | 24 hourly values per plant-day, for all seven dashboard plants | 2019-06 → |
| CENACE SMEC `ResultadoInforme1.do` | the closed day's national balance in kWh by generation type, imports, exports, distribution demand | 2016-05-01 → |
| CELEC ORDS `pointValuesMesH24` | daily level and inflow per mrid, a month per request — the only route to Coca Codo Sinclair, Agoyán and Manduriacu | not yet ingested |
| CENACE Información Operativa | live production, demand by distribution utility, last validated day | snapshot |

Two things worth knowing before using any of it:

- **`volutilalm` is not a volume.** The ORDS publishes it as "% de volumen útil", but it is
  exactly `(cota − min) / (max − min)`. It is stored here as `nivel_pct_banda` and must not be
  read as stored water.
- **The historian endpoints (`pointValues`, `pointValuesMesH24`) depend on when you ask.** Every
  Phase 0 run, made between 23:37 and 00:09 UTC, got the timestamp skeleton with no values; the
  probe of 2026-09-22 at 02:14 UTC got values for all eight target mrids, and `probe-ords.yml`
  keeps sampling three times a day to map any blank window. Because a blank answer and "no data"
  look identical, the loader checks Mazar — whose values the report endpoints already publish —
  before believing anything else in the run. The month's last local day used to come back null;
  that was the window's exclusive UTC end cutting a local day short, and the request now reaches
  a day past the boundary. The report endpoints above are the backbone; the historian is the
  route to Coca Codo Sinclair, Agoyán and Manduriacu levels.

## Running it

```sh
npm ci
npm test            # every parser against the recorded Phase 0 responses; no network
npm run typecheck
npm run lint

npm run ingest -- daily                    # yesterday from every source
npm run ingest -- daily --dry-run          # parse and validate, write nothing
npm run ingest -- backfill --source ords-levels --from 2014-09-20
npm run ingest -- backfill --source smec --from 2016-05-01 --max-requests 10000
npm run ingest -- latest                   # live tiles only
npm run ingest -- smec-earliest            # binary search for SMEC's oldest report
npm run ingest -- covariates               # recent ERA5, 16-day forecast, full ONI series
npm run ingest -- covariates --dry-run     # validate without writing, including with --out
npm run ingest -- covariates --from 1990-01-01 --max-requests 100  # resumable climatology

npm run ingest -- backfill --source ords-historian --from 2016-01-01   # a month per request

npm run check                              # shape, ranges, reference integrity; no clock, no network
npm run check -- --freshness               # also fail when a feed has stopped arriving
npm run check -- --out public/api/status.json
```

`npm run check` runs in CI on every push and again after every ingest. The split is deliberate:
shape and range checks are a function of the files alone, so they hold for as long as the commit
does, while freshness is a function of the clock and would turn every pull request red as the data
aged. A feed that has never produced a row is reported rather than failed, so a source that has
not had its first run yet does not block the gate.

The sources are unreachable from most sandboxes; ingestion runs in GitHub Actions
(`daily.yml`, `backfill.yml`). Every backfill is resumable — it skips days already in the
store — so a long history is filled by dispatching the same command until it reports no new
rows.

Weather and ENSO use their own `covariates.yml` workflow, scheduled daily at 17:00 UTC,
and the same staged apply/write queue as the existing ingestion. A manual dispatch with
`from` fills ERA5 history; without `from` it refreshes 30 recent available days and the
16-day forecast. ERA5 stops six days before today to allow for the publication delay.
Incomplete basin-days are retried on a subsequent history run. The shared request budget
includes NOAA; a very small budget may require another run to reach it.

`data/reference/basins.csv` currently lists only the provisional Paute point from reconnaissance.
It is a point sample, not basin-average precipitation. Verify catchment centroids and add the
other basins before treating this as fleet-wide weather coverage. Coordinates are preserved
in each weather row so changing the reference point cannot silently mix locations.

Forecast `issued_at` records our collection time, not the upstream model initialization time;
separate collections are retained for later backtests. ERA5 rows have an empty `issued_at`.
ONI's `month` is the centre of a three-month mean (January means December–February),
and the curated series contains NOAA's latest revisions. It is not point-in-time training data:
account for publication lag and revisions before using ONI in historical backtests.

## Layout

```
src/lib/parse/      one pure parser per endpoint: raw text in, typed rows out
src/lib/sources/    fetch + archive + parse for each upstream system
src/lib/store/      year-partitioned CSV upsert, gzipped NDJSON raw archive
src/lib/contracts/  zod table schemas; a drifted response writes nothing
src/lib/quality/    checks over what is on disk, which the row-by-row contracts cannot see
scripts/ingest.ts   the CLI
scripts/check.ts    the quality gates and the public status document
data/curated/       the tables, CSV, partitioned by year
data/raw/           every response as fetched, one gzipped bundle per source-month-endpoint
data/reference/     plants, thresholds, rationing episodes, basins, mrids, TLS pins
public/api/         status.json, the freshness and quality document the site reads
tests/fixtures/     the Phase 0 responses the parsers are tested against
```

`data/reference/` is committed input rather than output, and every row says how far it can be
trusted. `thresholds.csv` is derived from `operating_bands.csv` and `mrids.csv`, so it needs no
outside confirmation — and it keeps all three declarations rather than picking one, because they
disagree: Mazar's floor is 2098 by the dashboard chart title and 2100 by both report endpoints.
`plants.csv` and `rationing_episodes.csv` carry research from press, so every row of them is marked
`unverified` with an empty `verified_on` until someone checks it.

### Tables

| Table | Grain |
|---|---|
| `observations_daily` | date × site × variable × source — levels, inflows, energy, power, spill, plan |
| `national_balance_daily` | date × concept, SMEC's seven columns in kWh |
| `operativa_snapshots` | fetched_at × block × metric, including demand by utility |
| `operating_bands` | one row per distinct declared band, with the span it was observed over |
| `weather_daily` | date × basin × coordinates × kind × collection vintage; mm and °C, nulls preserved |
| `enso_monthly` | centre month × source, ONI anomaly in °C |

The same reading from two endpoints is kept as two rows with different `source` values rather
than silently preferring one, so disagreements between CELEC's own reports stay visible.

## TLS

No `rejectUnauthorized: false` anywhere by default. `generacioncsr.celec.gob.ec` has had a
valid certificate since 2026-09-17; `www.cenace.gob.ec` omits its intermediate, which is
committed under `data/reference/tls/` and appended to the trust store; `smec.cenace.gob.ec`
serves a self-signed certificate that expired in 2009 and only negotiates at `SECLEVEL=1`, so
it is pinned by SHA-256 fingerprint in `data/reference/tls_pins.json` and a mismatch aborts
the run.

## Language

Code, commits and developer docs in English; the published site is in Spanish.

## Licence

MIT (`LICENSE`) covers the code. Energy data comes from CELEC EP and CENACE.
Weather data is supplied by [Open-Meteo](https://open-meteo.com/) using
[ERA5](https://open-meteo.com/en/docs/historical-weather-api) and forecast models;
its data is licensed under [CC BY 4.0](https://open-meteo.com/en/terms), and the free API
is for non-commercial use. ONI comes from [NOAA PSL / CPC](https://psl.noaa.gov/data/correlation/oni.data).
