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
| 1 · Full ingest (CELEC ORDS + CENACE SMEC + Información Operativa) | code complete; levels backfilled to 2014-09-20, Mazar's historian inflow to 2010-02-10 (6,062 days — its true first reading, found by a walk that stopped on twelve empty months rather than on a `--from`), CELEC Sur energy to 2015-11-01, hourly energy for Coca Codo Sinclair (2016-06-24→), Agoyán (2017-01-01→) and Manduriacu (2017-07-31→). What remains is the acceptance criterion *three consecutive green scheduled daily runs*. The crons moved to odd minutes on 2026-09-23 (12:47 and 16:53 UTC), because GitHub delays busy ones, and `freshness.yml` now reports a slot that never fires. Before the move the count had not started: the 2026-09-22 12:15 UTC slot had still not fired at 13:07, with nothing queued, although `daily.yml` had been on `main` since 01:26. GitHub's scheduler is the reason, and this repository's only scheduled run to date started 5 h 22 min after its slot, so the close date follows the first firing that actually happens rather than the calendar |
| 2 · CENACE history and reconciliation | SMEC backfilled 2016-05-01 → 2026-09-20 (3,780 days, 0.40% missing) and reconciled against the ORDS per-plant energy. The fifteen missing days were re-asked on 2026-09-22 and none recovered, so 0.40% is this source's floor. Outstanding: the Información Operativa cross-check needs ≥ 20 snapshot days and has 1 |
| 3 · Additional reservoir levels | **done 2026-09-22** — 21,541 historian rows: daily level and inflow for Coca Codo Sinclair (2016-03-07→), Agoyán (2016-07-05→) and Manduriacu (2017-08-01→). The Mazar control month matches `repDiaHid12m` on all 31 days to 0.0000 m, and the caudal semantics are now settled on 4,281 days rather than assumed: `mridCaud` is inflow, not turbined flow (`data/crosschecks/caudal-semantics.md`) |
| 4 · Covariates and quality | reference tables (`plants`, `thresholds`, `rationing_episodes`) and the `npm run check` gates done, `public/api/status.json` published; ONI 1950-01 → 2026-07 ingested, and ERA5 1990-01-01 → present at all eight basin rows (backfilled at the seven verified centroids 2026-09-24). **Catchments delineated 2026-09-23:** `npm run catchments` routes flow over the Copernicus GLO-90 DEM above each of the seven dams and checks every catchment against INAMHI's per-scheme polygons (`geonode:hidroelectricasshape`) — six agree at 99–100% IoU, and Mazar at 91%, where INAMHI leaves out a north-bank lobe beside the dam. `basins.csv` now carries a verified centroid per catchment (`data/reports/catchments.md`). **Done 2026-09-24.** See `PLAN.md` §2.4 |
| 5 · Modelling v1 | **done 2026-09-22** — `public/api/forecast.json` carries p10/p50/p90 Mazar level at 7/14/30/60/90 days and days-to-threshold under three named analogue years, with the whole censored crossing distribution beside them. The shipped model is a water balance closed around the operator: the reservoir's area-elevation curve and its turbine's m³/s-per-MW are fitted from this repository's own readings, and release is a rule curve read back off the level every simulated day. Over 105 monthly origins from 2018-01 it is **24.5% better than persistence at 60 days and 34.8% at 90**, and indistinguishable from it under a month, which the document says rather than hides. §7's climatological-drift rung loses at every horizon and the open-loop water balance §7 specified loses by 69% at 90 days; both are kept in `data/reports/backtest.md` as recorded negatives. The crisis check is the unflattering one: of Mazar's two 2024 spells below 2115, the P50 called neither in advance, though the ensemble's dry tail put the October crossing 8.5 days out against an actual 7 |
| 6 · Site and JSON API | **built and deployed 2026-09-22** — `public/api/latest.json` joins `status.json`, `forecast.json` and `adequacy.json`, and the Spanish page is a Next.js static export rendered from `data/curated` at build time: reservoir gauges against their declared bands, Mazar's forecast fan over six months of recorded cota, a year of inflow against its own climatology, six months of the national mix, the adequacy tile, feed freshness, downloads and the method notes. It needs no JavaScript to read — the only scripts are the Next runtime and the analytics beacon — and every chart is inline SVG from tested pure functions. The **adequacy tile** is now built and backed by a model (Phase 6c). The **6b narrative panel** is live (first `ok` narrative 2026-09-23). Since 2026-09-23 there is a page per reservoir (`/embalses/<site>/`), a daily permalink (`/dia/<date>/`), embeddable cards, an Atom feed, a documented public contract with JSON Schemas (`/datos/`, `public/api/schema/`), and a scorecard that reads the published forecasts back. The site is deployed on Vercel, connected to this repository |
| 6c · Energy adequacy (§7 target 3) | **done 2026-09-22** — `public/api/adequacy.json` publishes expected deficit in GWh/day at 7/14/30/60/90 days and a four-level risk tier, from one identity: unsuppressed demand − hydro − thermal − imports − other. Demand is *served load*, not `demanda_distribucion` (which misses 3–11 GWh/day of losses and unregulated consumers — more than the whole Colombian interconnection), and it is fitted excluding the rationing episodes, because measured load during a cut is the load that was allowed. Over 99 monthly origins the net requirement beats a trailing 28-day mean by 12.4% at 7 days and 11.4% at 90; band coverage is 60–67% against a nominal 80% and is published as such. §7's inflow→hydro link is a **recorded negative**: r = 0.47 on 30-day means, GWh per m³/s drifting 83% across the record, and five rungs built on it all losing to persistence. The check that makes it publishable is the 2024 episode, where measured suppression (20.3 GWh/day) and computed deficit (17.0) come from different sides of the identity and agree within 3.3; the two short episodes do not agree, and the page says so. Applied to every month of the record, the tiers flagged 3 of 99 origins and all 3 preceded cuts, while 6 of the 9 origins that preceded cuts went unflagged — it does not cry wolf and it misses most of the wolves. Building it also found that the SMEC completeness gate is one-sided — see `data/reports/adequacy.md` |
| 7 · Extensions | XM's side of the Colombian interconnection is ingested (`xm_exchange_daily`, `xm_system_daily`, 2016-05-01 →); an export-availability model over it was built and backtested and is a recorded negative (`data/reports/adequacy.md`). The candidate list in `ENHANCEMENTS.md` was **implemented 2026-09-23** — raw archive as write-once NDJSON day files, per-source failure isolation and alerting, the public data contract, the site's new pages and accessibility, the scorecard, adequacy v2 with its import sensitivity, inflow forecasts for four plants, and the tooling upgrades; its head says item by item what is done. The ERA5 backfill at the seven centroids ran 2026-09-24; what is left is the owner's call on M4's seven-day design (`PLAN.md` Phase 4). **Streamflow return periods from INAMHI–GEOGLOWS, 2026-09-25:** `npm run geoglows` matches each dam to its GEOGLOWS v2 river (all eight, Amaluza included, within ±1.4% of the delineated catchment) and publishes the 2- to 100-year flood flows INAMHI's Hydroviewer draws — reproduced from the model and checked against the portal within 0.1 m³/s — beside the same fit on CELEC's record, in `latest.json` and on each reservoir page. GEOGLOWS' forecast and INAMHI's corrected hydropower forecasts were both backtested against CELEC's inflow and neither beats persistence on its own, so neither is published as it stands; used inside this repository's inflow forecast instead, the analogue + climatology ensemble they were tested against became the published rung (6 → 11 of 12 plant-horizons), and GEOGLOWS' forecast joined it as a third member at Agoyán, Manduriacu and Minas San Francisco (all 12 now publish; `data/reports/geoglows-experiment.md`) (`data/reports/return-periods.md`, `geoglows-forecast.md`, `inamhi-hydropower.md`; `PLAN.md` §2.8 and Phase 7) |

## Where the data comes from

| Source | What it gives | History |
|---|---|---|
| CELEC ORDS `repDiaHid12m` | daily level, inflow and declared band for Mazar, Amaluza, Minas San Francisco, Delsitanisagua — 365 days per request | 2014-09-20 |
| CELEC ORDS `repDiaEner12m` | daily energy per CELEC Sur plant, 182 days per request | 2020-09-20 |
| CELEC ORDS `repDia*` (one day each) | level/inflow, power, turbined flow, units online, spill, plant factor, day-ahead plan, SNI total | per day, 2016 → |
| CELEC ORDS `{code}EnerDia` | 24 hourly values per plant-day, for all seven dashboard plants | 2019-06 → |
| CENACE SMEC `ResultadoInforme1.do` | the closed day's national balance in kWh by generation type, imports, exports, distribution demand | 2016-05-01 → |
| CELEC ORDS `pointValuesMesH24` | daily level and inflow per mrid, a month per request — the only route to Coca Codo Sinclair, Agoyán and Manduriacu, and the deepest route of all for Mazar | 2010-02-10 → (Mazar inflow); 2016-03-07 → for the three |
| CENACE Información Operativa | live production, demand by distribution utility, last validated day | snapshot |
| INAMHI–GEOGLOWS return periods (`inamhi.geoglows.org`) | 2- to 100-year flood flows at the river each dam stands on, as INAMHI's Hydroviewer draws them: a Gumbel fit on GEOGLOWS v2's daily simulation from 1980, computed here from the public `geoglows-v2` bucket by `npm run geoglows` and checked against the portal's own charts (all eight rivers within 0.1 m³/s). **CC BY-NC-SA 4.0** | reference, store revision 2026-06-10 |
| GEOGLOWS v2 river forecast (`geoglows-v2-forecasts`) | Each 00 UTC issue's high-resolution member, as daily means at leads 1–10, for the rivers of Agoyán, Manduriacu and Minas San Francisco: the third member of the inflow forecast at those plants (`data/curated/geoglows_forecasts`, `npm run geoglows:daily`). Reported in `status.json` as `geoglows_forecast` | daily, from 2024-07-01 |

Six things worth knowing before using any of it:

- **`repDiaNivQIng` answers with the previous day's numbers.** Asked for date D it returns rows
  stamped D whose level and inflow are D−1's, identical to what `repDiaHid12m` publishes for D−1 —
  measured on 113 consecutive days and on captures from 2016, 2019, 2022, 2024 and 2026. Rows from
  it are therefore stored under the day they describe, not the day they are stamped.
  `repDiaPotQTurb` is shifted the same way: it publishes Molino's turbined flow, digit for digit,
  as `repDiaNivQIng`'s Sopladora inflow for the same requested date (116 of 116 days, and every
  capture), and both are midnight snapshots rather than daily figures. The other per-day reports
  are measured and not shifted; `DATA_DATE_OFFSET_DAYS` in `src/lib/registry.ts` has the evidence
  for each.
- **The historian's flow mrids are inflow, and carry more precision than the reports.**
  `mridCaud` (30538 for Mazar) is `q_ingresado`, agreeing with `repDiaHid12m` on 4,281 days at
  r = 1.0000; the only difference is that the report rounds to whole m³/s and the historian does
  not, so the report is exactly `round(historian)` on every one of those days. Turbined flow, the
  other candidate, correlates at r = −0.06.
- **A zero inflow means opposite things on the two routes, and neither is "the river stopped".**
  The historian publishes decimals, so its 0.00 is the service saying nothing — 82 of them sit below
  every one of those series' own non-zero floors (84.00 m³/s for Coca Codo Sinclair, 35.00 Agoyán,
  10.40 Manduriacu) and cluster like a fault, including the eighteen publishing days before Mazar's
  first real reading. Those are dropped. The 12-month reports publish whole m³/s, so *their* 0 is
  `round(x)` for any x below 0.5: on 2024-11-08, at the worst of the rationing drought,
  `repDiaHid12m` published 0 for Mazar and the historian published 0.142 for the same day. Those are
  kept. An inflow above 10,000 m³/s is dropped on both routes — the historian published 23,221.10
  for Mazar on 2013-11-27, between neighbours of 34.31 and 0.00.
- **The SMEC completeness gate is one-sided, and 57 balance days are not days.** `parse/smec.ts`
  rejects a page served before its metering arrived by requiring distribution demand to be at least
  20% of generation, which catches a page whose *demand* has not landed and passes one whose
  *generation* has not: 2018-01-05 carries 4.19 GWh of national generation against 62.72 GWh of
  demand and sails through, because 62.72/4.19 is 15. Served load is distribution demand plus
  transmission losses plus unregulated demand, both positive, so a day whose generation plus net
  imports falls below its own distribution demand is a page caught mid-render — 55 days, about
  1.5% of the record; the live count is in `data/reports/adequacy.md`, which regenerates daily. The
  same ratio catches the opposite fault: on 2025-07-17 and -18 CENACE published `generación de
  otros tipos` at 153.62 and 113.19 GWh against a fortnight's median of 2.2, flagged in its own
  `pct_dia` column at +6,284%, lifting national generation to 247 GWh on a 91 GWh day. All 57 are
  counted by `npm run check` and excluded by `src/lib/features/balance.ts`; none is deleted.
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
  a day past the boundary — the control month now returns 31 of 31 days where the narrow window
  returned 30. The report endpoints above are the backbone; the historian is the route to
  Coca Codo Sinclair, Agoyán and Manduriacu levels, and where the two routes overlap they agree
  exactly: Mazar's level for 2026-08 is identical on all 31 days, to 0.0000 m.

## Running it

When something breaks, or an issue opens, start with `RUNBOOK.md`.

```sh
npm ci
npm test            # every parser against the recorded Phase 0 responses; no network
npm run typecheck
npm run lint

npm run ingest -- daily                    # the last three days from every source (--days)
npm run ingest -- daily --dry-run          # parse and validate, write nothing
npm run ingest -- daily --out /tmp/batch   # fetch and stage only, as CI does; touches no data
npm run ingest -- apply --in /tmp/batch    # merge a staged batch into data/ (idempotent)
npm run ingest -- backfill --source ords-levels --from 2014-09-20
npm run ingest -- backfill --source smec --from 2016-05-01 --max-requests 10000
npm run ingest -- latest                   # live tiles only
npm run ingest -- smec-earliest            # binary search for SMEC's oldest report
npm run ingest -- covariates               # recent ERA5, 16-day forecast, full ONI series
npm run ingest -- covariates --dry-run     # validate without writing, including with --out
npm run ingest -- covariates --from 1990-01-01 --max-requests 100  # resumable climatology

npm run ingest -- backfill --source ords-historian --from 2016-01-01   # a month per request

npm run forecast                           # backtest the ladder, then write forecast.json and the report
npm run forecast -- --dry-run              # compute and print; touch no file
npm run forecast -- --no-variant           # skip the ENSO comparison (about a third of the runtime)

npm run adequacy                           # backtest, then write adequacy.json and the report
npm run adequacy -- --dry-run              # compute and print; touch no file
npm run adequacy -- --ceilings             # print the demonstrated thermal and import ceilings and stop

npm run check                              # shape, ranges, reference integrity, raw_refs, quarantine
npm run check -- --freshness               # also fail when a feed has stopped arriving
npm run check -- --out public/api/status.json
npx tsx scripts/tls-expiry.ts --live       # certificate expiry and pin drift, as tls-expiry.yml runs it

npm run geoglows                           # INAMHI's return periods at each dam's river, beside CELEC's own fit
npm run geoglows:forecast -- --step 3      # backtest GEOGLOWS' archived forecasts against CELEC inflow
npm run inamhi:hydropower -- --earliest    # backtest INAMHI's hydropower forecasts (runner only: the host refuses the sandbox)
npm run geoglows:experiment                # try both forecasts as members of the inflow forecast
npm run geoglows:daily                     # fetch GEOGLOWS' forecast for the inflow ensemble (the daily model step runs it)
npm run publish:api                        # write public/api/latest.json from the committed tables
npm run publish:api -- --dry-run           # build it and print a summary; touch no file
npm run publish:api -- --restamp           # also rewrite the contract block on the other documents

npm run export:bulk                        # one <table>.csv.gz per curated table, into public/api/bulk/
npm run dev                                # the site, against whatever is in data/ right now
npm run build                              # export:bulk, then the static export, into out/
```

The site is a build-time render of files already in this repository: `next build` reads
`data/curated` and `public/api`, writes `out/`, and the page needs no JavaScript to read: every
number, chart and data table is in the HTML, and the only scripts it ships are Next's runtime and
the Vercel Analytics beacon. There is no request path and no server, which is decision 6 made
literal — Vercel holds no credentials, runs no ingestion and queries nothing. A number changes on
the site when a number changes in this repository, and not otherwise. `out/` is servable by
anything static, so `npx serve out` is a faithful preview (without `vercel.json`'s headers).

The pages:

| Path | What it answers |
|---|---|
| `/` | the day's questions in order — the mix, what changed since yesterday, the day's reading, the eight reservoirs on one scale, Mazar's forecast with its skill beside each horizon, inflow, the national balance, adequacy, feed freshness and the method notes |
| `/embalses/mazar/` | Mazar's full record, its analogue years, the 2024 crisis check and its two declared floors |
| `/embalses/<site>/` | the other seven reservoirs from one template (`generateStaticParams` over `latest.json`): level, bands or their absence, slopes, the whole record and a year of inflow against its climatology |
| `/dia/` and `/dia/<fecha>/` | what was published about each day, rebuilt from `forecast_runs`, `adequacy_runs` and `narrative_snapshots`, with the observed level beside each forecast whose date has passed |
| `/datos/` | the public data: each document's fields and units (read from the JSON Schemas), update times (read from `daily.yml`), the bulk tables and the stability promise, with schema.org `Dataset` markup |
| `/embed/<site>/` | a fixed 400 × 260 card per reservoir for an `<iframe>`, without the site's chrome |
| `/feed.xml` | the daily reading as Atom, one entry per day the validator passed |

Every page has Open Graph and Twitter metadata with a canonical URL; the preview image is drawn at
build time from the day's headline and Mazar's band by `next/og`, with no network. `robots.txt`,
`sitemap.xml`, `icon.svg` (the masthead's mark) and a Spanish 404 come from `src/app/`. The three
typefaces ("Páramo": Instrument Serif, Geist and Geist Mono over a teal-and-terracotta palette,
light and dark from the reader's system setting) are self-hosted from `public/fonts/`, the Latin
subset of each with its SIL Open Font License beside it. The site's absolute URLs come from
`HYDRO_LOOK_SITE_URL`, default `https://hydro-look.vercel.app`.

Every headline on the page is a rule over the day's numbers in `src/lib/site/story.ts`, so a
sentence cannot outlive the number it describes. Each section of the home page is a component
under `src/app/components/sections/`; every colour is a class in `globals.css`, not an inline
style. Tables are real `<table>`s with header cells, and every chart carries its plotted values in
a collapsed `<details>` table beneath it. The inflow, mix and cross-section drawings are one
scalable SVG each whose labels CSS resizes for a phone; the forecast fan and the twelve-year
record change shape on a phone and are still drawn twice. Printing the page gives the numbers on
white with each link's address beside it.

### The public API

`public/api/*.json` are the stable public URLs a third party can fetch — with CORS open and a
five-minute cache, set in `vercel.json` — and since schema version 1 each says what can be relied
on (`src/lib/publish/contract.ts`):

- **`schema_version`** is the format version. It changes only when a field is removed, renamed or
  retyped; an added field does not change it. Each document has a JSON Schema under
  `public/api/schema/`, and `tests/publish.test.ts` validates every committed document against its
  schema, with a small in-repo validator that refuses keywords it does not enforce.
- **`data_date`** has one meaning everywhere: the Ecuadorian day the readings describe. In the
  model documents it equals `origin_date`. `as_of` (the day the job ran) stays in `latest.json` and
  `status.json` as a deprecated alias until schema version 2, and each document lists its
  deprecations in a `deprecated` block.
- **Codes are English slugs with Spanish labels beside them**: feeds carry `id` and `label_es`,
  band declarations `report_endpoint` / `dashboard_chart_title` with `declaration_es`, adequacy tiers
  `tier_code` (`comfortable`, `watch`, `tight`, `deficit`) and `tier_label_es` beside the model's
  own Spanish word. `adequacy.json`'s `current.narrative_tier_field` names the tier the daily
  narrative is written about (the worst), and the page says so.
- **`license`, `attribution` and absolute `see_also`** close every document.
- **`previous` and `delta_1d`** in `latest.json` give each reservoir's level and inflow the day
  before, and the national balance's, so "since yesterday" needs no CSV.
- **`inflow.return_periods`** in `latest.json` places each reservoir's inflow against two sets of
  2- to 100-year flood flows kept side by side: `geoglows.inamhi` (what INAMHI's Hydroviewer draws
  for the GEOGLOWS v2 river matched to the dam's catchment; the store's own 1940 fits ride along as
  `daily` and `hourly`) and `measured` (the same Gumbel fit on CELEC's daily record, from five
  complete years). They agree at Mazar (1.03×) and Coca Codo Sinclair (0.97×) and differ by 12–139%
  at the other five dams; `geoglows.simulated_vs_measured` says how closely the model follows the
  measured river at all. Sopladora has neither: its inflow is Molino's turbine discharge.
  `data/reports/return-periods.md` has the comparison, and PLAN.md §2.8 and Phase 7 the method.
- **Bulk**: `/api/bulk/<table>.csv.gz`, one concatenated file per curated table with an
  `index.json`, built by `npm run export:bulk` before every build and not committed.
  `release-bulk.yml` also attaches them, and a Parquet copy of each, to a rolling `bulk-latest`
  release once a day.

The scripts owned by the models write their documents through the same stamp (`publicJson` in
`forecast.ts` and `adequacy.ts`, `withContract` in `narrative.ts` and `check.ts`), and
`npm run publish:api -- --restamp` rewrites the stamp on whatever is already published.

`npm run check` runs in CI on every push and again after every ingest. The split is deliberate:
shape and range checks are a function of the files alone, so they hold for as long as the commit
does, while freshness is a function of the clock and would turn every pull request red as the data
aged. A feed that has never produced a row is reported rather than failed, so a source that has
not had its first run yet does not block the gate.

The sources are unreachable from most sandboxes; ingestion runs in GitHub Actions
(`daily.yml` at 12:47 and 16:53 UTC, `backfill.yml` by dispatch). Every backfill is resumable —
it skips days already in the store — so a long history is filled by dispatching the same command
until it reports no new rows. The schedules sit on odd minutes because GitHub delays scheduled
runs on busy ones; the first two runs for the old 12:15 and 16:30 slots started hours late.

Each ingest workflow runs as three jobs. `fetch` asks the sources and stages a batch (rows as
JSON, raw responses as they will be archived) with no write token and no secret, and uploads it
as an artifact. `apply` downloads it and runs `.github/scripts/apply-and-push.sh`, which resets
to the branch tip, applies, regenerates `status.json` and `latest.json`, commits and pushes —
retrying from a fresh tip if another run pushed first — and it is the only job in the `ingest`
concurrency group, so a backfill's hours of fetching never queue anyone. A run that found nothing
commits nothing: when only `generated_at` stamps changed, the attempt is discarded. `report`
opens one issue per failure mode (`ingest-failure`, `model-failure`, `covariates-failure`,
`backfill-failure`) and closes it when the same workflow next goes green. Every run writes a step
summary: rows added and updated per source, requests sent per host (retries included), errors,
and for the narrative the call's cost, latency and the spend to date, which `status.json` also
carries. `freshness.yml` checks `main` a few hours after each daily slot and keeps one
`stale-feed` issue for a feed that has stopped or a slot that never fired; `tls-expiry.yml`
checks weekly for a certificate within 30 days of expiry or a pinned host whose certificate
changed.

**Replaying a batch.** A batch that failed to land is not lost: download the run's
`ingest-batch-<run id>` artifact (`backfill-batch-…`, `covariates-batch-…` and `xm-batch-…` for
the other workflows) and apply it by hand on an up-to-date checkout:

```sh
gh run download <run id> -n ingest-batch-<run id> -D /tmp/batch
npm run ingest -- apply --in /tmp/batch     # upsert rows and raw responses into data/
npm run check -- --freshness --out public/api/status.json
npm run publish:api
git add data public && git commit -m "Replay batch from run <run id>"
```

`apply` is an upsert, so replaying onto newer data is safe, and replaying twice changes nothing.
A batch staged before the raw archive moved to day files applies too: its bundles are refiled
and its rows' `raw_ref`s rewritten on the way in.

**Partial failure.** Each source's errors stay its own: a pinned host whose certificate check
fails, a 5xx that outlives its retries, or a 200 that parses to fewer rows than the endpoint's
floor in `registry.ts` is recorded on the batch and fails the run at the end, while every other
source is still asked and written. Retries back off with jitter, honour a 429's `Retry-After`,
and stop at one deadline per request. Rows that fail their contract are written to
`data/quarantine/<table>/<run>.csv` with the reason instead of stopping the write, and
`npm run check` fails while any quarantine file exists: fix the parser, re-apply the batch, and
delete the file. Raw responses are written before the tables, and every file through a temp file
and a rename, so an interrupted run cannot leave a row pointing at a response that was never
archived — `npm run check` verifies that every `raw_ref` resolves.

Weather and ENSO use their own `covariates.yml` workflow, scheduled daily at 17:23 UTC,
and the same staged apply/write queue as the existing ingestion. A manual dispatch with
`from` fills ERA5 history; without `from` it refreshes 30 recent available days and the
16-day forecast. ERA5 stops six days before today to allow for the publication delay.
Incomplete basin-days are retried on a subsequent history run. The shared request budget
includes NOAA; a very small budget may require another run to reach it.

`data/reference/basins.csv` lists a verified centroid for the catchment above each of the seven
dams (`paute_mazar`, `coca_ccs`, `pastaza_agoyan`, `guayllabamba_manduriacu`, `daule_marcel_laniado`,
`jubones_msf`, `zamora_delsitanisagua`), delineated by `npm run catchments` and checked against
INAMHI, plus the provisional Phase 0 `paute` point, kept because M4 and the narrative were fitted
on it. Each is a point sample at the centroid, not basin-average precipitation. Coordinates are
preserved in each weather row, but the readers select by basin id, so a row's point should not
be moved in place: add a new basin id instead.

Forecast `issued_at` records our collection time, not the upstream model initialization time;
separate collections are retained for later backtests. ERA5 rows have an empty `issued_at`.
ONI's `month` is the centre of a three-month mean (January means December–February),
and the curated series contains NOAA's latest revisions. It is not point-in-time training data:
account for publication lag and revisions before using ONI in historical backtests.

## Layout

```
src/lib/parse/      one pure parser per endpoint: raw text in, typed rows out
src/lib/sources/    fetch + archive + parse for each upstream system
src/lib/store/      year-partitioned CSV upsert, the NDJSON raw archive, status and run summaries
src/lib/contracts/  zod table schemas; a drifted response writes nothing
src/lib/quality/    checks over what is on disk, which the row-by-row contracts cannot see
src/lib/features/   series assembly, the fitted reservoir curve, the national balance with its
                    unusable days taken out, ONI read at its true lag
src/lib/models/     the M0–M3 ladder, the rolling-origin backtest, the forecast, the adequacy
                    model, and the report each one writes
src/lib/publish/    the current-state document the site's tiles read, the public data contract
                    every document is stamped with, its schema validator and the bulk export
src/lib/chart/      scales, ticks and SVG path geometry; pure and unit-tested
src/lib/site/       what the page reads at build time, and Spanish formatting
src/app/            the Next.js App Router page and its server-rendered SVG charts
scripts/ingest.ts   the CLI
scripts/check.ts    the quality gates and the public status document
scripts/forecast.ts the backtest and the published forecast
scripts/adequacy.ts the adequacy backtest, adequacy.json and its report
data/curated/       the tables, CSV, partitioned by year
data/raw/           every response as fetched, NDJSON, one file per source-endpoint-day
data/quarantine/    rows an ingest could not store, with the reason; empty unless something broke
data/reference/     plants, thresholds, rationing episodes, adequacy assumptions, basins,
                    mrids, TLS pins
data/reports/       backtest.md and adequacy.md, regenerated with their models
public/api/         latest.json, status.json, forecast.json, adequacy.json and narrative.json —
                    the documents the site reads and the stable public URLs a third party can
                    fetch — and schema/, their JSON Schemas
public/fonts/       the three self-hosted typefaces and their licences
tests/fixtures/     the Phase 0 responses the parsers are tested against
```

`data/raw/` keeps every response verbatim, so a parser fix is a reprocessing job rather than a
re-scrape. Files are plain NDJSON, one record per request, under monthly directories:
`<source>/<YYYY>/<MM>/<endpoint>.<day>.ndjson`, where the day is the one the data belongs to (a
backfill of 2018 files under 2018/), or the fetch day for live endpoints; the Información
Operativa snapshot, taken twice a day, gets a file per run
(`InformacionOperativa.2026-09-22T143642Z.ndjson`). A row's `raw_ref` is `<file>#<request key>`
(two of them, space-separated, on XM exchange rows). Until 2026-09-23 the archive was one gzip
bundle per source-month-endpoint, rewritten whole on every run; git cannot delta gzip output, so
each run stored a new full copy of every bundle it touched. Uncompressed files written once let
git's own compression and deltas do the work: replayed in both layouts, the six daily runs of
2026-09-23 grew the pack by under 15 KiB each in the new one against 60–116 KiB in the old, and
a shallow clone of the tip packs to 18.6 MB against 19.6 MB. The price is the checkout: 255 MB on disk against
24 MB. `scripts/migrate-raw.ts` did the move; refs in the old `….ndjson.gz#key` form still
resolve, to the day file that holds the record.

`data/reference/` is committed input rather than output, and every row says how far it can be
trusted. `thresholds.csv` is derived from `operating_bands.csv` and `mrids.csv`, so it needs no
outside confirmation — and it keeps all three declarations rather than picking one, because they
disagree: Mazar's floor is 2098 by the dashboard chart title and 2100 by both report endpoints.
`plants.csv` carries research from press, so every row of it is marked `unverified` with an empty
`verified_on` until someone checks it. `rationing_episodes.csv` was checked on 2026-09-24: each row
names its sources and says how the dates were confirmed, including against SMEC demand. `adequacy_assumptions.csv` is
different again: it is the one file here meant to be *argued with*. The four ceilings the deficit
is computed against default to what the fleet has demonstrated in the committed record, and
editing a row changes the published deficit on the next run — which is what §7 means by thermal
availability and import limits being explicit, editable inputs.

### Tables

| Table | Grain |
|---|---|
| `observations_daily` | date × site × variable × source — levels, inflows, energy, power, spill, plan |
| `national_balance_daily` | date × concept, SMEC's seven columns in kWh |
| `operativa_snapshots` | fetched_at × block × metric, including demand by utility |
| `operating_bands` | one row per distinct declared band, with the span it was observed over |
| `weather_daily` | date × basin × coordinates × kind × collection vintage; mm and °C, nulls preserved |
| `enso_monthly` | centre month × source, ONI anomaly in °C |
| `forecast_runs` | one row per forecast, with the fitted curve and rule behind it |
| `forecast_values` | run × horizon — p10/p50/p90, and the raw ensemble bounds beside them |
| `adequacy_runs` | one row per adequacy run, carrying the ceilings it stood on |
| `adequacy_values` | run × horizon — demand, hydro, net requirement with its band, deficit, margin and tier |

The same reading from two endpoints is kept as two rows with different `source` values rather
than silently preferring one, so disagreements between CELEC's own reports stay visible. The
models need one number per day, so `src/lib/features/series.ts` resolves them by a declared
source order — which decides coverage rather than truth, since the levels cross-check found the
report endpoints and the historian carrying the same series on 100% of 1,668 overlapping days.

`forecast_runs` records enough of each fit — the area-elevation coefficients, the flow-per-MW,
the release stance, the crest — to reproduce a forecast after the history behind it has grown
another year. `forecast_values` keeps the model's raw ensemble bounds next to the published
band because they are not the same thing: the ensemble spans what the analogue inflow years do,
and the published band is that widened by the model's own out-of-sample error.

`adequacy_runs` records the ceilings as columns rather than pointing at
`adequacy_assumptions.csv`, for the same reason: the file is editable, so a run that only
referenced it would have its past silently rewritten by a later edit.

## TLS

No `rejectUnauthorized: false` anywhere by default. `generacioncsr.celec.gob.ec` has had a
valid certificate since 2026-09-17; `www.cenace.gob.ec` omits its intermediate, which is
committed under `data/reference/tls/` and appended to the trust store; `smec.cenace.gob.ec`
serves a self-signed certificate that expired in 2009 and only negotiates at `SECLEVEL=1`, so
it is pinned by SHA-256 fingerprint in `data/reference/tls_pins.json` and a mismatch fails
every SMEC request (the other sources carry on).

## Language

Code, commits and developer docs in English; the published site is in Spanish.

## Licence

MIT (`LICENSE`) covers the code. Energy data comes from CELEC EP and CENACE.
Weather data is supplied by [Open-Meteo](https://open-meteo.com/) using
[ERA5](https://open-meteo.com/en/docs/historical-weather-api) and forecast models;
its data is licensed under [CC BY 4.0](https://open-meteo.com/en/terms), and the free API
is for non-commercial use. ONI comes from [NOAA PSL / CPC](https://psl.noaa.gov/data/correlation/oni.data).
