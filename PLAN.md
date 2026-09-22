# hydro-look — Plan v2

**Status:** ingestion implemented; historical backfill running; Phase 4 covariate ingestion merged, first run queued; the `pointValues` null issue is resolved and Phase 3 is unblocked (probe of 2026-09-22 02:14 UTC). **Updated:** 2026-09-22. Supersedes the initial plan and the
follow-up research note ("CELEC dashboard covers 7 plants", "CENACE header has usable numbers").

This version was built after reading the two community scrapers that already run daily against
the same sources (`jordanvt18/cotas-embalses-ecuador`, `tefaceli/scraper-mazar`). Their code
fixes the exact API contracts, and their published data gives us ready-made validation sets.

---

## 0. Goal and working assumptions

**Goal (assumed from the research thread, edit if wrong):** an open, automated pipeline that

1. collects the state of Ecuador's hydro fleet (reservoir levels, inflows, per-plant output) and
   the national supply/demand balance every day;
2. keeps a validated daily history back to 2022-01-01;
3. produces a rolling forecast of reservoir trajectories and an energy-adequacy / rationing-risk
   indicator, published as a static site plus machine-readable JSON.

| # | Assumption | Consequence |
|---|---|---|
| A1 | The prediction target is reservoir levels (Mazar first) at 7–90 day horizons, and from that a deficit / rationing-risk indicator. Not hourly dispatch. | Daily resolution; water-balance model before any ML. |
| A2 | Public data only, no credentials. | SIMEM is out. |
| A3 | Runs on GitHub Actions, publishes on GitHub Pages, data versioned in git (same pattern as both reference projects). | No servers, no database service. |
| A4 | The Claude Code sandbox cannot reach any `*.gob.ec`, `github.io`, Open-Meteo or NOAA host (verified this session: proxy returns 403 on CONNECT). Only GitHub is reachable. | Endpoint discovery and fixture capture happen on your machine or in Actions; coding sessions develop against recorded fixtures. |
| A5 | Site and docs in Spanish, code and commit messages in English. | Decided 2026-09-21. |

---

## 1. What changes versus the initial plan

| Δ | Change | Why (evidence) |
|---|---|---|
| D1 | **Add a third CENACE source: the SMEC daily energy balance** (`smec.cenace.gob.ec/SMEC/ResultadoInforme1.do?fecha=YYYY/MM/DD`). It is date-parameterised, reports the *closed* day in kWh by generation type and imports, and is therefore **backfillable**. It becomes the primary national-mix source. | `tefaceli/scraper-mazar` scrapes it daily since 2026-08-01; its numbers (hydro ≈ 3,534 MW avg, thermal ≈ 856 MW avg over 51 days) reconcile with national demand. |
| D2 | **Demote the InformacionOperativa header to intraday/secondary.** Its "día" figures are cumulative running totals, not closed-day totals. The 85,532 MWh quoted for 2026-09-14 is almost certainly a partial-day snapshot. The Plotly pies use inconsistent units across the day/month/year tabs; never use them for absolutes. | jordanvt18's captures of the same page: 31,023 MWh at 07:52 local vs 56,117 MWh at 13:08 local on the same day. |
| D3 | **Automate `mrid` discovery** from the CELEC-wide Angular bundle and the ORDS metadata catalog; DevTools capture stays as fallback. | jordanvt18 found the ORDS by inspecting the bundle; Angular apps embed config arrays. |
| D4 | **Use the two community datasets as validation sets, not as our history.** jordanvt18: 1,668 daily rows per reservoir, 2022-01-01 → 2026-09-20, for Mazar/Amaluza/Sopladora. tefaceli: 51 days of SMEC-derived MW. We backfill from the ORDS ourselves for provenance and cross-check against them. | Neither repo carries a data licence; our own backfill keeps the chain of custody clean. |
| D5 | **Verify the semantics of every "caudal" mrid** (inflow vs turbined vs spilled) before modelling. | Mazar mrid 30538 reads 32–59 m³/s in Aug–Sep 2026; consistent with inflow, but unconfirmed. |
| D6 | **Add exogenous drivers:** Open-Meteo (ERA5 archive, 16-day forecast, seasonal) at basin centroids, NOAA ONI for ENSO, and a two-regime seasonal prior (Amazon slope: wet Apr–Sep, dry Oct–Mar; Pacific slope: wet Jan–May). | A level forecast without precipitation is persistence with extra steps. |
| D7 | **Add a labelled rationing-episode table** (2023-10, 2024-04, 2024-09→12) as reference data for backtests. | The point of the forecast is to see the next 2024 coming. |
| D8 | **Model hierarchy:** persistence/climatology baselines → water-balance simulation with inflow scenarios → gradient-boosted quantile model only if it beats the baselines on rolling-origin backtests. | Small data (≈1,700 days), few crisis episodes; ML first would overfit. |
| D9 | **TLS hygiene:** pin the self-signed certificate fingerprint of `generacioncsr.celec.gob.ec:8443` instead of `verify=False`; SMEC needs an adapter with `SECLEVEL=1` (weak ciphers). | Both reference scrapers disable verification; pinning is strictly better and no harder. |
| D10 | **Handle suppressed demand.** During rationing, served demand < true demand; adequacy models must use an unsuppressed-demand estimate for 2023-10/11 and 2024-04, 2024-09→12. | Otherwise the model learns that crises "reduce demand". |
| D11 | **Archive raw responses** (gzipped JSON/HTML) alongside tidy tables so any parser bug can be fixed by reprocessing. | jordanvt18 keeps only tidy CSV and relies on web.archive.org, which returns 401 anonymously since 2024. |

---

## 2. Source inventory (updated with Phase 0 results, runs of 2026-09-21)

Phase 0 ran twice from GitHub Actions (`scripts/recon/RECON_REPORT.md`, fixtures under `tests/fixtures/`).
Everything below marked **verified** was fetched and parsed in those runs.

### 2.1 CELEC ORDS — the same service, but the useful endpoints are not the ones the dashboards use

Base `https://generacioncsr.celec.gob.ec:8443/ords/csr/`. No authentication. Valid Sectigo certificate since
2026-09-17 (normal TLS verification works; pinning is no longer required, keep the fingerprint as a fallback
check). An OpenAPI catalog is public at `open-api-catalog/<module>/` for eight modules:
`sardomcsr` (CELEC Sur) and one energy module per plant (`sardommaz`, `sardommol`, `sardomsop`, `sardommsf`,
`sardomago`, `sardomman`, `sardomccs`). All parameters go as query strings; `fecha` is `dd/MM/yyyy HH:mm:ss`.

**Verified, returning data (primary sources from now on):**

| Endpoint (module `sardomcsr` unless noted) | Grain | What it returns | Backfill |
|---|---|---|---|
| `repDiaHid12m?fecha=` | daily, 365 rows ending the day before `fecha` | level, inflow (`q_ingresado`), operating limit, min, max flow for Mazar, Molino/Amaluza, Minas San Francisco, Delsitanisagua | **verified back to 2015-09-20** (run 3): Mazar and Amaluza complete with zero nulls over 3,288 days sampled; Minas SF and Delsitanisagua from 2019-09-20. One request per year → the whole history in ~12 requests |
| `repDiaEner12m?fecha=` | daily, ~182 rows ending the day before `fecha` | daily energy (MWh) for Minas SF, Mazar, Molino, Sopladora (from 2020-09-20), Delsitanisagua and Alazán (from 2025-01-01) | one request per 6 months, ~13 requests for 2020→ |
| `repDiaNivQIng?fecha=` | one day | level and inflow for Minas SF, Mazar, Amaluza, Sopladora intake chamber — **answers with the previous day's values**, see below | per day |
| `repDiaPotQTurb?fecha=` | one day | power, units online, turbined flow per plant (Minas SF, Mazar, Molino, Sopladora) | per day |
| `repDiaEnerAyerHoy?fecha=` | one day | yesterday's energy and today's planned energy per plant **and for the SNI** (national total, 104,862 MWh on 2026-09-19) | per day |
| `repDiaRegAyer?fecha=` | one day | annual accumulated GWh, spilled volume (hm³), spilled energy, plant factor per plant | per day |
| `repDiaVolAlm` (POST `{"v_loctimestamp": …}`) | one day | level and declared band for Minas SF, Mazar, Amaluza, plus `volutilalm` — which is **not a volume**: it is exactly `(cota − volembmin) / (volembmax − volembmin)`, verified to 10 decimals on all three reservoirs on 2026-09-20. Ingest it as `nivel_pct_banda` and never read it as storage. | **verified for 2024-10-15**, so one request per day |
| `csrEstUnidades` | now | unit status per plant (22 units) | no |
| `csrProdLineaLast2h` | now | live values: daily energy so far, reservoir level, inflow per plant, Paute basin flow | no |
| `sardom{maz,mol,sop,msf,ago,man,ccs}/{code}EnerDia?fecha=` | hourly, 24 rows for the local day | energy per hour (MWh) for each of the seven plants, Coca Codo Sinclair included; **verified for 2019-06-15, 2022-01-15 and 2024-10-15 on all seven** | per plant-day. Needed mainly for Coca Codo Sinclair, Agoyán and Manduriacu (the other four come from `repDiaEner12m`): 3 plants × ~2,650 days from mid-2019 ≈ 8,000 requests ≈ 2.5 h at 1/s, in chunked dispatch runs; fewer if `EnerMes` returns values in a later run |
| `csrCaudCuenAniosAvg?fechaInicio=&fechaFin=` | yearly | Paute basin mean flow per year, **2010→2026** (2024: 74.6 m³/s, the drought; 2025: 163.6) | one request |
| `csrEnerDia?fecha=` | hourly | CELEC Sur total (= Mazar + Molino + Sopladora + Minas SF) | per day |

Values seen on 2026-09-20: Mazar 2,139.1 masl with 75 m³/s inflow and 73.8% useful volume; Minas SF 790.3 masl
and 56.8%; per-plant daily energy Mazar 1,462 MWh, Molino 10,507, Sopladora 6,013, Minas SF 2,672, Agoyán 2,961,
Manduriacu 451, Coca Codo Sinclair 25,087 (64% of that day's national hydro of 76.8 GWh in SMEC).

**Resolved 2026-09-22 — the historian endpoints do return values.** `scripts/probe-ords.ts`, run from Actions
at 02:14 UTC (21:14 local, [run 35678724137](https://github.com/rengarcia/hydro-look/actions/runs/35678724137)),
got values from all 11 probes: `pointValuesMesH24` for the current month on all eight target mrids (20 of 30 days
non-null, i.e. every closed day), August for the Mazar control (30 of 31, the 31st null: the window's end date is
exclusive in local time, so page months with overlap), and hourly `pointValues` for 2026-09-20 on Mazar and Coca
Codo Sinclair (24 of 24). The Mazar control agrees with `repDiaHid12m` to the rounding the report applies (cota
2139.14 and 2147.03 identical; caudal 37.62 and 38.22 vs the report's 38), so mrid 30538 is the same quantity the
report calls `q_ingresado`. First values for the three uncovered plants, 2026-09-20: Coca Codo Sinclair 1220.5 masl,
220 m³/s; Agoyán 1645.77 masl, 80 m³/s; Manduriacu 492.2 masl, 67.3 m³/s. The Phase 0 nulls were therefore a
time-of-day or transient effect; `probe-ords.yml` keeps sampling at 06:05, 13:05 and 19:05 UTC to map any blank
window before Phase 3 picks its ingest hour. Original finding, kept for the record:

**Verified but returning `null` values in both runs (open issue, see §8):** `pointValues`, `pointValuesMesH24`
and every `*Mes*`/`*Anio*` aggregation, including `{code}EnerMes` and `csrCaudCuenMesAvg`. Seven request styles
(our headers, requests defaults, the two community scrapers' headers, browser-like headers, local-midnight
windows, with and without the legacy TLS adapter) all got the timestamp skeleton with `valueedit: null`, for
2026-09 as well as for January 2015–2022. The community scrapers got values from the same endpoints at 18:08 and
23:10 UTC that day; our runs were at 23:37, 23:56 and 00:09 UTC (run 3, still null). Working hypothesis: an
evening window in which the historian's aggregated/edited values are unavailable. A scheduled re-run after the
community scrapers' 05:15 UTC job will settle it. The mrid map is
nevertheless complete (`data/reference/mrids.csv`): the CELEC-wide bundle declares `mridCota`, `mridCaud`
and `mridUnid` for all seven plants plus the Paute basin flow (24812). These mrids are the only route to
**levels and inflows of Coca Codo Sinclair, Agoyán and Manduriacu**; the report endpoints cover the other four
reservoirs plus Delsitanisagua.

Semantics: `csrProdLineaLast2h` lists "Q Mazar" next to "Nivel Embalse" with the same value the caudal mrid
30538 returns, and `repDiaNivQIng` calls the daily figure `q_ingresado` (inflow). **Confirmed 2026-09-22 on
4,281 days rather than the month this asked for** — the historian's mrid 30538 is `repDiaHid12m`'s
`q_ingresado` to the digit the report rounds to, and nothing like the turbined flow published beside it. The
measurement, including what it says about the three plants with no second source, is under Phase 3 in §6.

One caveat on `repDiaNivQIng`, found by the same comparison and detailed in §6 Phase 3: asked for date D it
answers with values belonging to **D−1**, stamped D. Its rows are stored under the day they describe; the
other per-day reports are not shifted, and `DATA_DATE_OFFSET_DAYS` carries the list.

### 2.2 CENACE SMEC daily energy balance — verified, complete, deep history

`https://smec.cenace.gob.ec/SMEC/ResultadoInforme1.do?fecha=YYYY/MM/DD`, HTML, 15 rows (16 before 2019, with
"Turbinas a Nafta"): Hidráulica, Vapor Bunker, Turbinas a Gas, Turbinas a Diesel, Motores Bunker, Otros Tipos,
Total Generación, Importación Colombia, Importación Perú, Total Importación, Exportación Colombia, Exportación
Perú, Total Exportación, **Demanda Distribución**, Total Pérdidas Transporte. Seven columns per row: day kWh,
% vs the same weekday a year earlier, month-to-date kWh and %, year-to-date kWh and %, last-365-days kWh. The
header carries the weekday ("Tipo Día"). Every probed date from **2016-05-01** to yesterday returned a full
report; the earliest date is still to be found by binary search in Phase 2. The report for the current day is
published incomplete (1 row at 19:00 local) and complete on D+1 (tefaceli's calibration: ready by 11:15 local).
TLS: self-signed certificate expired in 2009, weak ciphers → `SECLEVEL=1` adapter plus fingerprint pinning
(`3ac3888f…`, in `tests/fixtures/tls/fingerprints.json`). robots.txt: none. Other report numbers (2–12) are the
SIMEC login page or errors; the SMEC root redirects to a login. `Total Pérdidas Transporte` can be negative
(2024-10-15), so it is a balance residual, not a measurement.

### 2.3 CENACE Información Operativa — verified, secondary

`https://www.cenace.gob.ec/info-operativa/InformacionOperativa.htm` (266 KB, 18 Plotly charts). The server omits
its intermediate certificate; the fix is to append the Sectigo intermediate published in the leaf's AIA field to
the trust bundle (done generically in `capture.py`). The visible text is a clean key/value list: real-time
production for today (cumulative: 84,258 MWh at 18:59 local on a day that closed near 105 GWh), current demand
by utility (19 companies, MW), then **"INFORMACIÓN OPERATIVA DIARIA"** for the last validated day (two days
back on a Monday evening: Saturday 2026-09-19, total 104,277 MWh, hydro 80,537, thermal 21,151, non-conventional
2,432, export 125, import 158), month-to-date (MWh) and year-to-date (GWh) blocks, and the dates of the monthly
and historical peak demand. Thousands are separated by thin spaces. Footer: "Datos preliminares del SCADA,
sujetos a revisión y validación." Use: daily cross-check of SMEC, demand by utility, real-time tile.

### 2.4 Covariates — verified

Open-Meteo archive (ERA5, daily precipitation and temperature), 16-day forecast, and the seasonal API with
ensemble members (`precipitation_sum_member01…`) all answered for a Paute-basin point. Their `robots.txt`
disallows crawlers; API use is governed by their terms (free non-commercial, attribution), so the scraper
treats those hosts as exempt and documents it. NOAA ONI is available from PSL (`oni.data`) and CPC
(`oni.ascii.txt`), 1950→.

**Catchment geometry — probed 2026-09-22 (run 35727122874), and the obvious route is closed.**
§3 asks for a centroid and an area per catchment, and neither can be looked up: both are
properties of a catchment boundary, which is a property of a dam location and a flow network.
The plan for it was HydroSHEDS' HydroBASINS, whose `NEXT_DOWN` topology turns "the catchment
above this dam" into "the sub-basins that drain into it" and whose `SUB_AREA` gives the area
with no geometry work. `data.hydrosheds.org/file/hydrobasins/standard/hybas_sa_lev{06,08,10,12}_v1c.zip`
**answers 403 with a 5,767-byte HTML page** for every level, to a plain GET and a ranged one
alike, so that route needs either a different host or a registration step that a workflow cannot
do unattended. Finding another source for the boundaries is now the first task of the basins
work, not a detail of it.

The pour points themselves are in better shape. **Wikidata's SPARQL endpoint answered** with 23
Ecuadorian dams and plants carrying coordinates, six of the seven matched by label:

| site | basin | Wikidata | coordinates |
|---|---|---|---|
| mazar | paute | Q1751861 | −2.5953091, −78.6218378 |
| coca_codo_sinclair | coca | Q19277520 | −0.1979037, −77.6849914 |
| agoyan | pastaza | Q5760779 | −1.39852778, −78.37755556 |
| minas_san_francisco | jubones | Q65196242 | −3.3221588, −79.6016026 |
| manduriacu | guayllabamba | Q65196233 | 0.21480556, −78.91233333 |
| delsitanisagua | zamora | Q65196191 | −4.04588889, −78.98377778 |

Marcel Laniado (Daule-Peripa) matched nothing, because the probe searches on the first word of
its query string and the label is not "Daule-Peripa". These are **one source, so they are not yet
verified coordinates**: the second opinion was to be OpenStreetMap, and Overpass answered **504**
to the Ecuador-wide query. A lighter query, or one of the other Overpass instances, is the next
attempt. Both hosts disallow crawlers in `robots.txt` (`Disallow: /sparql`, `Disallow: /api/`)
and both publish API terms instead, which is the same situation as Open-Meteo above and is
handled the same way.

### 2.5 Open-data portals

- `datosabiertos.gob.ec` returns **403** to GitHub runners for every path, including the CKAN API, with or
  without `www`. Needs a run from your machine or is dropped; it is only a validation source.
- ARCONEL `arconel.gob.ec/balance-nacional-de-energia-electrica/` works and links the latest BNEE workbook
  (`BNEE_junio_2026_revACH.xls`); the monthly archive is not linked from that page and must be discovered.
- `controlrecursosyenergia.gob.ec` serves a certificate for another hostname; skip.

### 2.6 Community mirrors — verified, validation only

`raw.githubusercontent.com` serves jordanvt18's `estado.json` and CSVs and tefaceli's `historico.json` /
`en_vivo.json`, reachable even from the sandbox.

### 2.7 Ruled out

SIMEM (credentials), Electricity Maps (no Ecuador parser), INAMHI (no API), web.archive.org Save Page Now
(401 anonymous), the ORDS metadata catalog (401) and module root (404).

## 3. Reference data to encode (`data/reference/`)

**`plants.csv`** — capacities are from public CELEC pages and press; mark each row `verified_on` once
checked against ARCONEL's effective-power table.

| Plant | Operator | MW (approx.) | Regulation | River / slope | In CELEC-wide dashboard |
|---|---|---|---|---|---|
| Mazar | CELEC Sur | 170 | Mazar reservoir, ≈410 hm³ (the cascade's only multi-week storage) | Paute / Amazon | yes |
| Molino (Paute, Amaluza) | CELEC Sur | 1,100 | Amaluza, daily, heavily silted | Paute / Amazon | yes |
| Sopladora | CELEC Sur | 487 | small compensation pond | Paute / Amazon | yes |
| Minas San Francisco | CELEC Enerjubones | 275 | small reservoir (~788 masl reading in press) | Jubones / Pacific | yes |
| Agoyán | CELEC Hidroagoyán | 156 | small daily reservoir (~1,650 masl) | Pastaza / Amazon | yes |
| Manduriacu | CELEC Coca Codo Sinclair | 65 | small (~492 masl) | Guayllabamba / Pacific | yes |
| Coca Codo Sinclair | CELEC Coca Codo Sinclair | 1,500 | 0.8 hm³ compensation → run-of-river | Coca / Amazon | yes |
| Pucará (Pisayambo) | CELEC Hidroagoyán | 73 | Pisayambo, ≈100 hm³ | Pastaza / Amazon | no (per press) |
| San Francisco | CELEC Hidroagoyán | 230 | fed by Agoyán tailrace | Pastaza / Amazon | verify |
| Marcel Laniado (Daule-Peripa) | CELEC Hidronación | 213 | ≈5,400 hm³ multi-year | Daule / Pacific | verify |
| Delsitanisagua | CELEC Gensur | 180 | small | Zamora / Amazon | verify |
| Toachi-Pilatón, Baba, private plants | various | ~300+ | — | Pacific | no |

The seven dashboard plants total ≈3,750 MW, roughly three quarters of Ecuador's hydro capacity;
CCS alone was 46–48% of hydro output this year (press, citing CELEC).

**`thresholds.csv`** — declared operating bands per reservoir with the source and the date read, so a change
of rules is a commit. Phase 0 found three overlapping declarations: the dashboard chart titles (Mazar
2098–2153, Amaluza 1975–1991, Sopladora 1312–1318, Minas SF 783.33–792.86), `repDiaVolAlm` (Mazar min 2100,
Amaluza min 1970, Minas SF 783.33–792.86) and `repDiaHid12m` (`lim`/`min`: Mazar 2100–2153, Molino 1960–1991,
Minas SF 750–793, Delsitanisagua 1469–1491, plus `qmax` per plant). Record all three with their source.

**`rationing_episodes.csv`** — one row per episode, with start, end, scope, max hours/day, and a
press URL per row. Seed (dates to confirm against the linked articles in Phase 0):

| Start | End | Scope | Note |
|---|---|---|---|
| 2023-10-27 | 2023-12 (verify) | national, 3–4 h/day, later longer | first drought cuts |
| 2024-04-15 | 2024-05 (verify) | national, up to 8–13 h/day | April 2024 |
| 2024-06-19 | 2024-06-19 | national blackout | transmission failure, not hydro |
| 2024-09-18 | 2024-09-19 | national scheduled outage | maintenance |
| 2024-09-23 | 2024-12-20 | national, up to 14 h/day in Oct–Nov | "worst drought in 61 years" |
| 2025-01-01 | — | industry restrictions lifted | none since (verify) |

**`basins.csv`** — centroid lat/lon and area for the catchments feeding Mazar (upper Paute), Coca
(CCS), Pastaza (Agoyán/Pisayambo), Jubones, Guayllabamba, Daule; used for Open-Meteo queries.

**`mrids.csv`** — plant, variable, mrid, unit, sample value, validated_on, evidence (chart title or
bundle line). Grows in Phase 3.

---

## 4. Data model

All dates are local (`America/Guayaquil`, UTC−5, no DST); every row carries `fetched_at` (UTC) and a
`raw_ref` to the archived response. Units live in column names.

| Table | Grain | Columns (core) |
|---|---|---|
| `reservoir_daily` | plant × variable × date | `date, plant, variable{cota_masl, caudal_m3s, produccion_mwh}, value, mrid, source, fetched_at, raw_ref` |
| `reservoir_latest` | plant × variable | last non-null hourly point from `pointValues` (for the "now" tile) |
| `national_balance_daily` | date | `hydro_kwh, thermal_steam_kwh, thermal_gas_kwh, thermal_diesel_kwh, thermal_engines_kwh, other_kwh, import_colombia_kwh, …rows found in Phase 0, source=smec` |
| `operativa_snapshot` | fetched_at | header fields of S3 as published (cumulative), `is_closed_day` flag |
| `weather_daily` | basin × date × kind | `precip_mm, temp_mean_c, kind{era5, forecast}, issued_at` |
| `enso_monthly` | month | `oni` |
| `forecast_runs`, `forecast_values` | run × target × horizon | quantiles p10/p50/p90, model id, features hash |
| `narrative_snapshots` | ingest run | `run_id, generated_at, forecast_run_id, features_hash, risk_tier (copied from the adequacy calc, not model-chosen), outlook_es, drivers[], confidence, model_id, prompt_version, input_tokens, output_tokens, cost_usd (from `providerMetadata.gateway.cost`), status{ok, skipped, failed}` — see Phase 6b |

Storage: git is the database. Raw responses are archived as one gzipped NDJSON bundle per
source-month (`data/raw/<source>/YYYY/MM/<endpoint>.ndjson.gz`, one record per request, deduped by
key) so a parser bug is fixed by reprocessing; curated tables are CSV partitioned by year
(`data/curated/<table>/<YYYY>.csv`) so a daily commit rewrites only the current year's file
instead of a multi-megabyte blob. The site reads those files at build time; no database.

---

## 5. Architecture

- **Language/tooling (decided 2026-09-22, see §9):** TypeScript on Node 22, one package for both
  the ingestion scripts and the site. `tsx` to run the CLI, `vitest` for fixture tests, `tsc
  --noEmit` plus `eslint` in CI. Libraries: `undici` (per-host TLS agents), `cheerio` for the CENACE
  HTML, `zod` for table contracts. The frontend is Next.js (App Router) on Vercel, reading the
  committed data files; there is no database and no server-side ingestion.
- **Layout**

```
src/lib/
  http/         client.ts (rate limit, retries)  tls.ts (scoped agents, fingerprint pins)
  sources/      celec-ords.ts  cenace-smec.ts  cenace-operativa.ts  open-meteo.ts  noaa-oni.ts  mirrors.ts
  parse/        one pure parser per endpoint, input = raw text, output = typed rows
  store/        curated.ts (year-partitioned CSV upsert)  archive.ts (gzipped NDJSON per source-month)
  contracts/    tables.ts (zod schemas; a failed parse writes nothing)
  features/     hydrology.ts (water balance, cota↔volume)   calendar.ts
  models/       baselines.ts  water-balance.ts  backtest.ts
  narrative/    payload.ts (stats → compact JSON)  prompt.ts  generate.ts (AI Gateway call, zod schema)
src/app/        Next.js App Router pages, server components reading data/curated + public/api
scripts/        ingest.ts (daily | backfill --from --source | latest | --dry-run)
                recon/capture.py (Phase-0 discovery, kept as-is)
data/  raw/  curated/  reference/
public/api/     latest.json  forecast.json  narrative.json  status.json  (served by Vercel, stable public URLs)
tests/  fixtures/<source>/*  (recorded Phase-0 responses)  *.test.ts
.github/workflows/  daily.yml  backfill.yml  ci.yml  recon.yml
```

- **Scheduling (UTC crons, Ecuador = UTC−5):** ORDS daily close at 12:15 UTC (07:15 local, after
  the 05:00Z midnight point exists); SMEC at 16:30 UTC (11:30 local, after the report is published);
  optional intraday `latest` at 11:10 and 23:10 UTC; weather/ENSO with the morning run; site rebuild
  after each successful ingest. `backfill.yml` is `workflow_dispatch` with `--from` and `--source`.
- **Politeness:** identified User-Agent with a contact URL, ≤1 request/s, retries with backoff on
  5xx only, one request per (mrid, month) for backfill, robots.txt respected.
- **TLS:** normal verification for the ORDS (valid Sectigo certificate since 2026-09-17; keep its fingerprint
  as a secondary check); `SECLEVEL=1` adapter with fingerprint pinning for `smec.cenace.gob.ec`; certifi plus the
  AIA-published intermediate for `www.cenace.gob.ec`. Fingerprints live in `data/reference/tls_pins.json` with
  the date captured; a mismatch fails loudly and opens an issue.
- **Failure handling:** each source ingests independently (`continue-on-error` per step); a failed
  or schema-drifted parse writes nothing, keeps the raw archive, and the workflow opens/updates a
  GitHub issue. Freshness per table is published in `api/status.json`.
- **Testing:** every parser has fixture-based tests (recorded in Phase 0); contracts run on every
  ingest; a `--dry-run` mode prints what would be written.
- **AI narrative (Phase 6b):** one call per successful ingest run, made from the Actions job through
  the **Vercel AI Gateway** with the AI SDK (`generateObject`, model chosen by a string in config).
  The gateway key is an Actions secret; Vercel still holds no credentials and the site never calls a
  model at request time. The output is a committed `narrative.json` next to `forecast.json`. The
  sandbox cannot reach the gateway (A4), so the module is developed against a recorded response
  fixture and a `--no-narrative` flag skips the call.

---

## 6. Phased roadmap

Each phase ends with a pushed, green state. Effort is in coding sessions (S) plus your time.

**Phase 0 · Reconnaissance and fixtures — done in GitHub Actions on 2026-09-21 (runs 1–3)**
Because the sandbox is blocked, you run `scripts/recon/capture.py` (written first, network-free
tested) which saves raw responses into `tests/fixtures/` and a `recon_report.md`:
1. ORDS: `pointValuesMesH24` for the six known mrids for the current month and for 2022-01;
   `pointValues` for one day; the ORDS metadata catalog and module root.
2. CELEC-wide: `graficasproduccionCELEC/index.html`, every `*.js` it references, a grep of
   `mrid`, plant names, and 4–6 digit ids near them; what "Descargar CSV" calls (network tab if not
   in the bundle).
3. SMEC: `ResultadoInforme1.do` for yesterday, for 2022-01-15, for 2024-10-15; probe
   `ResultadoInforme2..10.do`; list every row label found.
4. InformacionOperativa: full HTML twice (morning and after 00:30 local) to confirm the cumulative
   behaviour and capture the header layout; `robots.txt` of all three hosts.
5. TLS certificate fingerprints of both self-signed hosts.
6. Open-Meteo and NOAA ONI sample responses.
Acceptance: fixtures committed; `mrids.csv` has candidates for all seven plants with sample values;
`recon_report.md` answers every "verify" in §2.2 and §3.

**Phase 1 · Skeleton + CELEC report endpoints + backfill — code complete 2026-09-22, backfill running**
Built in TypeScript (decision 6), and widened to the full ingest (decision 7), so it also carries what
§6 originally deferred to Phase 2: the SMEC parser and the Información Operativa parser ship with it.
Delivered: `src/lib/parse/*` (one pure parser per endpoint, 59 tests against the Phase 0 fixtures),
`src/lib/sources/*`, the rate-limited client with per-host TLS policy, the gzipped-NDJSON raw archive,
the year-partitioned CSV store with zod contracts, and `scripts/ingest.ts`
(`daily | backfill | apply | latest | smec-earliest`), wired into `ci.yml`, `daily.yml` and `backfill.yml`.
Two things the first Actions runs settled:

- **Levels reach 2014-09-20, a year deeper than Phase 0 found.** `repDiaHid12m` paged back one further
  year than the 2015-09-20 the reconnaissance established; 29,110 level and inflow rows are committed.
- **Generated files cannot be merged by rebase.** The first daily run collided with the levels backfill
  in an add/add conflict on every CSV. A run now stages its output and a second step re-applies it onto
  the branch tip (`--out` / `apply --in`), which is safe because applying is an upsert.
- **The levels cross-check passes exactly** (`npm run crosscheck`, report in `data/crosschecks/`).
  Against jordanvt18's 1,668-day historian-derived series, our `repDiaHid12m` backfill agrees on
  **100% of days to the mirror's published precision of 0.01 m** for both Mazar (mean absolute
  difference 0.0001 m) and Amaluza (0 m), at offset 0. A one-day shift in either direction costs
  0.5–0.65 m of mean error, so the local-midnight date convention in §4 is confirmed, not assumed:
  two independent routes into the same historian, parsed by two people, agree on the numbers *and*
  the dates. This closes the D4/§6 acceptance criterion for levels. `repDiaNivQIng` has only been
  ingested for one day so far and the mirror stops at 2026-09-20, so it has no usable overlap yet;
  the report lists it explicitly as "not enough overlap to judge" rather than letting a one-day
  comparison masquerade as a date-convention finding.

That backfill ([run 35675850138](https://github.com/rengarcia/hydro-look/actions/runs/35675850138/job/106582137605))
is long finished and reconciled; §6's Phase 2 and Phase 3 entries record what it and its successors
found. **What is left of Phase 1 is one acceptance criterion and a clock: three consecutive green
*scheduled* daily runs.** The schedule's first firing was due 2026-09-22 12:15 UTC and **had still
not appeared at 13:07**, with nothing queued. That is not a registration problem — `daily.yml` has
been on `main` since 2026-09-22 01:26 UTC and in its final form since 01:34, so the schedule had
over ten hours to register before the slot. It is GitHub's scheduler, and this repository now has
a measurement of it rather than an expectation: **the only scheduled run in its life, `probe-ords`
at the 06:05 slot on 2026-09-22, started at 11:27 — five hours and twenty-two minutes late.** One
observation is not a rate, but it is the only one there is, and it says the criterion cannot be
read off a calendar. The earliest it can close is the third calendar day after the first run that
actually fires, not after the first that was due.

That delay has a second edge worth naming, because it reaches the same hazard as the backfill rule
below without anyone dispatching anything. A firing delayed by more than about four and a quarter
hours arrives after the *next* slot is due, so both scheduled runs are in the `ingest` group at
once. Two runs there are safe while one of them is running — the second simply waits. What is not
safe is either of them sitting **pending**: GitHub keeps one pending run per group, so whichever
is waiting when a third enters is cancelled, and a cancelled run does not count toward this
criterion. The mitigation already exists and needs no change — each run re-reads a trailing year,
so a lost run repairs itself — but a lost run still costs a day of the three.

**Do not dispatch a backfill in the minutes around 12:15 or 16:30 UTC.** `backfill.yml` and
`daily.yml` share the `ingest` concurrency group, and `cancel-in-progress: false` does not mean
nothing is cancelled: GitHub keeps one pending run per group, so queueing a second run while one is
already waiting cancels the one that was waiting. Run 8 was lost that way on 2026-09-22. The run it
could take instead is the scheduled daily ingest — the very thing this criterion is counting — and
a cancelled run does not count. The rule is repeated in a comment at the top of `backfill.yml`,
where someone about to dispatch will actually read it.

Also still open from this phase's acceptance, and cheap: **the true first date of the historian
series**. The 2026-09-22 walk of mrid 30538 was bounded at 2015-01 by its `--from` and returned
values in every month down to it, with no run of empty months to stop it — so Mazar's inflow exists
in the historian before 2015-01, and `repDiaHid12m` reaches only 2014-09-20. One dispatch with an
earlier `--from` settles how far back the historian actually goes.

Original phase text, for reference:
Package, CLI, raw archive, `reservoir_daily` contract, ORDS client, and loaders for `repDiaHid12m` (levels
and inflows, four reservoirs, paged back a year per request), `repDiaEner12m`, `repDiaNivQIng`,
`repDiaVolAlm`, `repDiaRegAyer`, `repDiaEnerAyerHoy` (SNI daily total) and `{code}EnerDia` for the seven
plants; `daily.yml` and `ci.yml`. The `pointValues` client is written too but only for the three plants the
reports do not cover, and it must tolerate all-null responses.
Acceptance: levels and inflows for Mazar and Amaluza from 2015-09-20 and for Minas SF and Delsitanisagua
from 2019-09-20 (find the true first date by paging until the rows are all null); daily energy for the four
CELEC Sur plants from 2020-09-20 and for the other three from 2019-06 via `EnerDia`; cross-check against
jordanvt18's 2022→2026 Mazar/Amaluza/Sopladora levels with differences listed; daily workflow green three
days in a row.

**Phase 2 · CENACE SMEC ingestion + backfill — backfill complete 2026-09-22 (run 35675850138)**
`national_balance_daily` now holds **3,780 days, 2016-05-01 → 2026-09-20**, in 11 year files. Coverage is
**0.40% missing** — 15 days of the 3,795-day span, against an acceptance bar of < 1%. Seven are days the
backfill never obtained (2019-03-21, 2019-03-28, 2020-04-07, 2020-04-08, 2020-06-20, 2020-06-27,
2020-11-28); the other eight are the partially-metered pages rejected below. **That retry has now been run
(2026-09-22, run 35726456802) and none of the fifteen recovered**: four days are still missing rows
outright, one still reports zero generación, and the eight still show distribution demand at
0.85–4.66% of generación — including days from 2019 and 2020, re-asked six years after the fact. A
day SMEC published incomplete stays incomplete, so 0.40% is this source's floor rather than an open
work item, and the parser note no longer promises that waiting fixes it.

Reconciling that against the ORDS per-plant energy produced three findings, in descending order of how much
they matter:

- **Eight days were partially-published pages, and they are now rejected.** On 2020-06-18, -21, -23, -24,
  -25, -29, 2020-12-07 and 2026-03-18, SMEC served a page whose rows were all present but held only the
  metering that had arrived: total generación equal to hydro alone and a fraction of a normal day, with
  distribution demand near zero. They passed the row-presence check and sat in the history as **phantom 90%
  generation collapses** — precisely the signal this project exists to detect. The parser now also requires
  distribution demand to be at least 20% of total generación. Across 3,788 days that ratio is 89.4% at the
  median and 69.3% at the 1st percentile; those eight sit between 0.85% and 4.66% and the next lowest real
  day is 34.8%, so the threshold separates them with a sevenfold margin and rejects nothing else. Their 81
  rows are removed from the table here; the raw responses stay archived.
- **59 days (1.6%) report distribution demand exceeding generación + importación − exportación**, which is
  physically impossible. Concentrated in 2016 (34 of 245 days, 13.9%) but present through 2026 (11 of 263).
  These are *flagged, not dropped*: unlike the eight above they are internally plausible published numbers
  with an unclear failure mode, and deleting 1.6% of the history — 14% of 2016 — on a guess would be worse
  than carrying a documented caveat. Any model should exclude them.
- **Two days report generación far above any real day**: 2025-07-17 (247,391 MWh) and 2025-07-18 (203,988)
  against a median of 76,622 and a genuine maximum near 115,771. Also flagged rather than dropped.

The **CELEC plants we carry account for a median 43.9% of SMEC national hydro** (mean 44.9%, by year 40–46%),
over 2,107 comparable days. That is the expected shape with Coca Codo Sinclair still missing: CCS alone is
reported at 46–48% of national hydro, so the two together come to ~90% and the remainder belongs to other
operators. Once the CCS backfill lands this ratio becomes a real unit check rather than a plausibility one.

Original phase text, for reference:
Parser for the 15/16 rows × 7 columns, contract, binary search for the earliest available date, backfill
from there (≈3,800 requests at 1/s from 2016, in dispatch runs), reconciliation tests (SMEC hydro vs the sum
of the seven plants' `EnerDia`; SMEC totals vs the Información Operativa validated-day block; kWh/24/1000 vs
tefaceli's MW). Información Operativa parser for the header key/value list with the closed-day flag.
Acceptance: `national_balance_daily` complete from the earliest date with < 1% missing days; SMEC vs
Información Operativa closed-day totals agree within 2% on ≥ 20 days.

**Phase 3 · Coca Codo Sinclair, Agoyán, Manduriacu levels and inflows — done 2026-09-22 (run 35705227443)**
`observations_daily` now holds **21,632 historian rows**, daily level and inflow for all three plants:

| plant | cota (mrid) | caudal (mrid) | from |
|---|---|---|---|
| Coca Codo Sinclair | 3,734 days (100540) | 3,747 days (100037) | 2016-03-07 |
| Agoyán | 3,726 days (140031) | 3,717 days (140537) | 2016-07-05 |
| Manduriacu | 3,339 days (110031) | 3,338 days (110537) | 2017-08-01 |

Three things the run proved rather than assumed, all against the live service:

- **The mrid route and the report route are the same series, to the digit.** The Mazar control
  month (2026-08, mrid 30031) is **identical to `repDiaHid12m` on all 31 days, maximum absolute
  difference 0.0000 m**. Shifting it a day in either direction costs 0.30 m of mean error, so the
  local-midnight convention of §4 is confirmed here the same way the jordanvt18 cross-check
  confirmed it for the report endpoints: two independent routes, agreeing on the numbers *and*
  the dates.
- **The exclusive-window fix held.** The control month returned **31 of 31 days including
  2026-08-31**, where the narrow window the probe still uses returned 30 of 31. That was the
  hypothesis behind reaching a day past the boundary, and it is now measured.
- **The blank window is narrower than Phase 0 suggested.** The run fetched from 08:31 UTC
  (03:31 local) and the control answered immediately, so the guard never fired. Values are
  therefore available at 02:14 and at 03:31 local-evening/early-morning alike; the three
  Phase 0 runs between 23:37 and 00:09 UTC remain the only window seen blank.

**The caudal semantics, settled 2026-09-22** (runs 35726093961 and 35726708470,
`npm run crosscheck:caudal`, report in `data/crosschecks/`). §2.1 asked for a month of overlap
between mrid 30538 and Mazar's `q_ingresado`. There was none, and the reason was ours: the walk
used the control list as a gate and then walked only the targets, so 30538 was declared and never
fetched. Walking it produced **4,282 days, 2015-01-01 → 2026-09-21**, and the answer is not close:

- **`mridCaud` is inflow.** Against `repDiaHid12m` the historian matches on **4,281 days at
  offset 0, mean absolute difference 0.2491 m³/s, r = 1.0000**, and that residual is not error —
  the report publishes whole m³/s and the historian publishes decimals, so on **all 4,281 days
  the report is exactly `round(historian)`**, never once off by more than half. Against
  `repDiaPotQTurb`'s turbined flow the same series is 50–57 m³/s out at every offset and
  **correlates at r = −0.06**. A one-day shift of the winning comparison costs 37 m³/s, so the
  dating is measured here too, not assumed.
- **The three uncovered plants are not left on inheritance alone.** Turbined flow is bounded by
  the machines and inflow is not, and that shows without any design-flow figure: Mazar's turbined
  series has p99 128.98 against a maximum of 129.18 and spends 1.77% of its days within 1% of it,
  while Coca Codo Sinclair, Agoyán and Manduriacu run p99 1025/490/563 against maxima of
  1933/1065/834 and sit on their ceiling 0.03% of days — the long right tail of something that
  arrives with the rain. CCS's median alone, 245 m³/s, is above the design flow its press figures
  claim.
- **A third reading was tried and came back too weak to use, which is worth recording.** Turbined
  flow should track the plant's own generation almost exactly; Mazar's turbined series manages
  r ≈ 0.45. `repDiaPotQTurb`'s `potencia_mw × 24` also fails to match daily energy at any offset,
  by ~1,000 MWh on a ~2,000 MWh day, so that endpoint looks like an **instantaneous reading rather
  than a daily mean**. Until that is established the generation reading has no anchored top end,
  and the report says so rather than quietly leaning on it.

**And the same comparison found a defect of ours.** Lining the historian up against
`repDiaNivQIng` showed a perfect match one day off. `repDiaNivQIng?fecha=D` answers with
`"fecha":"D T05:00:00Z"` and **values belonging to D−1** — measured on 113 consecutive days of
2026 across three reservoirs, and on the Phase 0 fixtures for 2016, 2019, 2022, 2024 and 2026, so
it is a decade-long property of the endpoint. `repDiaHid12m`'s dating is the confirmed one (1,668
days against jordanvt18, 4,281 against our own historian), so the parser now stores those rows
under the day they describe, the 904 already-stored rows were moved, and the raw responses keep
their own `fecha` in the archive. The family does not share the habit: `repDiaVolAlm` and
`repDiaEnerAyerHoy` are dated correctly on 112 of 112 days, and `repDiaPotQTurb` and
`repDiaRegAyer` publish nothing a second source covers, so they are untested and assumed correct.
`DATA_DATE_OFFSET_DAYS` in `src/lib/registry.ts` is where that list lives.

Acceptance: daily level and inflow for the three plants; a documented semantics note per variable.
Both met.

**Phase 4 · Covariates, reference tables, quality gates — reference tables and gates done 2026-09-22; covariate history outstanding**
Implemented earlier: `ingest covariates`, Open-Meteo ERA5 (explicit model selection; six-day
publication buffer), 16-day forecasts, NOAA PSL ONI, schema/range validation, raw archives,
year-partitioned CSV and the scheduled/manual `covariates.yml` workflow. Historical weather is
resumable by complete basin-day, fetched in yearly windows; forecast collections retain separate
timestamps and raw responses.

Added 2026-09-22 — the reference tables and the gates:

- **`plants.csv`, `thresholds.csv`, `rationing_episodes.csv`.** `thresholds.csv` is *derived*
  from files already in this repository (`operating_bands.csv` and `mrids.csv`), so it needs no
  outside confirmation, and it records all three declarations rather than reconciling them: Mazar's
  floor is 2098 by the chart title and 2100 by both report endpoints, Amaluza's is 1975, 1970 or
  1960 depending on who is asked. `plants.csv` and `rationing_episodes.csv` carry the §3 research,
  which came from press, and every row of it says so — `capacity_status: unverified`, `verified_on`
  empty, `status: unverified`, `source_url` empty. Two rationing rows are marked
  `hydro_related: no`: the 2024-06-19 transmission failure and the 2024-09-18/19 maintenance
  outage look exactly like rationing in the demand series and would poison a drought model.
- **`npm run check`**, in CI on every push and after every ingest. The split is deliberate:
  shape, range and reference checks are a function of the files alone and belong in CI, while
  freshness is a function of the clock and would turn every pull request red as the data aged.
  A feed that has never produced a row is reported, not failed, so the historian does not fail
  the gate before its first run.
- **`public/api/status.json`**, written after each ingest by the same command, always including
  freshness because a viewer cannot pass a flag.

**The gate found a real defect on its first run, in data that had been committed for a day.** On
2018-10-01 and 2018-10-10 — the two days before Minas San Francisco's level series begins, with
`nivelmsf` null on both — the ORDS publishes `q_ingresadomsf` as **-4,999,995** and **-3,999,996**,
against single digits either side and nothing else negative in 14,619 inflow readings. Inflow has
no negative branch, so whatever those numbers mean upstream they are not m³/s. Both parsers that
read `q_ingresado` now drop a negative value with a note, the two rows are removed from the table,
and the raw responses stay archived so they can be reprocessed if their meaning is ever
established. The freshness limits caught a second thing worth recording: ONI looked 83 days stale
under a 45-day limit, but its label is the *centre* of a three-month mean, so the newest available
value is always about two months back. The limit was wrong, not the feed; it is now 110 days.

The **ERA5 climatology backfill ran on 2026-09-22** (run 35705234042): `weather_daily` now holds
**13,408 ERA5 days, 1990-01-01 → 2026-09-16**, plus the rolling 16-day forecast.

Still pending, and the reason the line above is narrower than it looks: that climatology covers the
**one provisional Paute sampling point**, because `basins.csv` still holds only that. It is not a
verified catchment centroid and it is not basin-average precipitation, so 36 years of it is 36 years
of one point. The other basins, and verified areas and coordinates for all of them, remain
outstanding — `basins.csv` drives one Open-Meteo request per row, so a placeholder row is not
harmless. Seasonal ensembles remain deferred. ONI is a centred three-month average and
the latest revised series; backtests must not assume its value was available at the beginning of its
labelled month.

**What the 2026-09-22 probe (run 35727122874) established about closing that**, in full in §2.4:
six of the seven pour points are available from Wikidata with QIDs, from one source rather than the
two this repository asks for, because Overpass answered 504; and the catchment boundaries have no
route at all yet, because HydroSHEDS answers 403 to every HydroBASINS download. So the order of work
is now: find a reachable source of sub-basin boundaries with upstream topology, get the second
opinion on the coordinates, then delineate, and only then rewrite `basins.csv`. Nothing about the
covariate loader changes — it already takes one row per basin and archives what it fetches. What is
missing is the table it reads, and `scripts/probe-basins.ts` is what re-asks these questions once
there is a new candidate to ask about.


Original phase scope:
Open-Meteo ERA5 daily precipitation per basin from 2022 (and 1990→ for climatology), 16-day
forecast daily, ONI monthly; `plants.csv`, `thresholds.csv`, `rationing_episodes.csv`,
`basins.csv` verified; freshness and range checks in CI; `api/status.json`.

**Phase 5 · Modelling v1 (2–3 S)**
See §7. Deliverable: `forecast.json` with p10/p50/p90 Mazar cota at 7/14/30/60/90 days, a
days-to-critical estimate under three inflow scenarios, and a backtest report (2023-09→2024-12).

**Phase 6 · Site and JSON API (1–2 S)**
Static page: reservoir gauges vs bands, inflow vs climatology band, national mix stacked area,
forecast fan charts, adequacy tile, data freshness, download links, method notes, disclaimer
("not an official source"). Spanish first.

**Phase 6b · AI narrative panel via Vercel AI Gateway (1 S, after Phase 5 and 6)**
Implements decision 8. The model interprets; it never forecasts.
1. `narrative/payload.ts` builds a small deterministic payload from data already computed in code:
   current cota and distance to the 2153 / 2115 / 2098 bands per reservoir, 7/14/30-day slopes
   (m/day), days-to-threshold at the current slope, the same calendar window in each prior year
   (analog years, from the 2014→ history), the Phase 5 p10/p50/p90 at 7/14/30 days, the adequacy
   `risk_tier` from §7, the 16-day basin precipitation forecast total vs climatology, and the current
   ONI phase. Roughly 1–2 k tokens; the raw daily series is not sent.
2. `narrative/generate.ts` calls the gateway with `generateObject` and a zod schema
   `{ outlook_es: string, drivers: string[], confidence: 'low'|'medium'|'high' }`. The risk tier is an
   *input* the model must explain, not an output it may choose, so the site never shows two competing
   risk signals. Prompt text is versioned (`prompt_version`) and the payload hashed, so a rerun on the
   same data is a no-op.
3. The daily workflow runs it as the last step after a green ingest and forecast, `continue-on-error`,
   writes `public/api/narrative.json` and appends a `narrative_snapshots` row with tokens and
   `cost_usd` read from `providerMetadata.gateway.cost`. On a 429 (free-tier per-model rate limit)
   retry once after a short wait, then mark the row `skipped`; the site keeps the previous narrative
   and shows its `generated_at`.
4. Site: the panel renders the narrative beside the computed numbers it was written from (bands,
   slopes, days-to-threshold, fan chart) so the basis is always visible, with the disclaimer that the
   text is model-generated and the forecast is the statistical one from §7.
Gateway facts to plan around (verify on the Vercel docs at build time): a monthly free credit per team
(USD 5 at the time of writing, requires a payment method on file), a subset of the catalog on the
free tier with lower per-model rate limits, list-price token billing with zero markup drawn from
prepaid credits, and switching provider or model is a string change. At one call per day the free
credit covers this many times over; the `cost_usd` column is there to prove it.
Acceptance: `narrative.json` regenerated daily for seven consecutive runs; a fixture test asserting
the payload builder against a known day; the schema rejects any output that names a level or date
not present in the payload; monthly gateway spend visible from the snapshots table.

**Phase 7 · Hardening and extensions (ongoing)**
ML v2 if it beats v1 in backtests; ARCONEL BNEE monthly loader; CENACE Datos Abiertos per-plant
validation; Colombia export availability via XM's open API; public-records request template to
CENACE/CELEC for the pre-2022 daily series; optional web.archive.org with keys.

---

## 7. Modelling plan

**Targets, in order**

1. `cota(Mazar, t+h)` for h ∈ {7, 14, 30, 60, 90} days, probabilistic. Later: Pisayambo, Minas San
   Francisco, Daule-Peripa if their levels become available.
2. Days until Mazar crosses 2115 (critical) and 2098 (min) under P10/P50/P90 inflow scenarios.
3. Energy adequacy: expected fleet hydro energy (from levels, inflows and plant limits) + available
   thermal + import capacity − unsuppressed demand → expected deficit GWh/day over the horizon; risk
   tiers derived from it. Thermal availability and import limits are explicit, editable inputs.
4. Nice-to-have: 7-day national hydro generation.

**Method ladder** (each step must beat the previous on the same backtest to be kept)

- M0 persistence; M1 climatological drift (day-of-year median Δcota from 2022→); M2 seasonal ETS/ARIMA.
- M3 water balance: `V(t+1) = V(t) + 86,400·(Q_in − Q_turb − Q_spill)`; `Q_turb` from production via
  a fitted m³/s-per-MW; cota↔volume curve fitted from the data itself (regress ΔV on net flow) or
  digitised from CELEC documents; inflow scenarios by historical analog conditioned on month, ONI
  phase and the 16-day precipitation forecast.
- M4 LightGBM quantile regression on lags of cota, caudal, production, basin precipitation (ERA5 and
  forecast), ONI, day-of-year, with rolling-origin CV.

**Evaluation:** rolling-origin backtests with monthly origins from 2018-01 (the Mazar series now starts in
September 2015 and contains the 2016, 2018, 2020, 2022, 2023 and 2024 lows); metrics MAE and pinball
loss per horizon, coverage of the p10–p90 band, and a crisis-specific check: lead time at which the
model's P50 first predicted a critical crossing before 2024-10. Report skill relative to M0.

**Known pitfalls:** suppressed demand during rationing (D10); levels above the declared max (the
band is operational, not physical); Amaluza siltation (volume curve drifts); caudal semantics (D5);
regime differences between Amazon- and Pacific-slope basins.

---

## 8. Risks and mitigations

| Risk | Mitigation |
|---|---|
| `pointValues*` and monthly aggregations return null in the evening runs (resolved 2026-09-22: values returned at 02:14 UTC, §2.1) | Primary ingestion stays on the report and hourly-energy endpoints; the mrid route serves the three uncovered plants (Phase 3). `probe-ords.yml` samples three times a day to map any blank window; the Phase 3 loader must treat an all-null month as "retry later", never as "no data". |
| `datosabiertos.gob.ec` blocks GitHub runners (403) | Validation-only source; fetch from your machine if wanted. |
| ORDS or SMEC changes or gets locked (the ORDS has no auth today) | Raw archive + independent sources per table; the community mirrors as a fallback; open an issue automatically on schema drift. |
| CELEC-wide mrids not discoverable from the bundle | DevTools capture (your original plan) is the fallback; Phase 1–2 do not depend on them. |
| Sandbox cannot reach sources | All network-dependent discovery in Phase 0 on your machine; parsers developed against fixtures; Actions does the real runs. |
| Scraping etiquette / robots | Identified UA, ≤1 req/s, robots.txt checked in Phase 0, one request per day per report in steady state. |
| Few crisis episodes → overconfident models | Baselines first, probabilistic outputs, explicit scenario inputs, backtest report published with the forecast. |
| Unit errors between sources | Reconciliation tests: SMEC vs InformacionOperativa closed day, SMEC hydro vs sum of plant production mrids, ORDS vs mirrors. |
| Self-signed TLS | Fingerprint pinning; mismatch fails the run. |
| AI narrative contradicts the numbers or invents a forecast | Model receives only computed stats and the §7 forecast, risk tier is an input, schema-validated output, numbers rendered next to the text, previous snapshot kept on failure (Phase 6b). |
| Gateway rate limit / credit exhaustion | One call per ingest run, payload hash makes reruns free, `continue-on-error` so the ingest never fails because of the narrative, spend logged per call. |

---

## 9. Decisions (recorded 2026-09-21)

| # | Question | Decision |
|---|---|---|
| 1 | Goal and target hierarchy (§0, §7) | Confirmed as written. |
| 2 | Where Phase 0 runs | GitHub Actions, `workflow_dispatch` (`.github/workflows/recon.yml`). Runners have open internet and both reference scrapers already run there daily. Fixtures and the report are committed back to the branch by the workflow. Can also be run locally with `python scripts/recon/capture.py`. |
| 3 | Site language | Spanish. |
| 4 | History provenance | Backfill everything from the ORDS; community mirrors are used for cross-checks only. |
| 5 | Transparency request to CENACE/CELEC for pre-2022 series | Deferred; stays optional in Phase 7. |
| 6 | Stack (revisited 2026-09-22 against a Next.js/Vercel/Postgres proposal) | **TypeScript ingestion in GitHub Actions, git as the store, Next.js on Vercel as a pure frontend.** No database: the data is daily-grain (~70k rows across every table), year-partitioned CSV keeps commits small, and a DB would be a second place for the numbers to drift. Secrets stay in Actions; Vercel gets no credentials. |
| 7 | Ingestion scope for the first build | **Full ingest**, not the three-reservoir MVP subset: every verified ORDS report endpoint, per-plant hourly energy for all seven plants, SMEC back to its earliest date, and the Información Operativa snapshot. |
| 8 | AI narrative panel (from the same proposal; scoped 2026-09-22 as Phase 6b) | Accepted, via the **Vercel AI Gateway** with the AI SDK, called from the Actions ingest job (not from Vercel, not at page load). The model never extrapolates the series: slopes, days-to-threshold, analog years and the §7 forecast are computed in code and the adequacy risk tier is passed in; the model only writes the narrative over that payload. One call per ingestion run, output committed as `narrative.json`, cost logged per call in `narrative_snapshots`. |
| 9 | `pointValues*` / mrid route | Demoted to a fallback for Coca Codo Sinclair, Agoyán and Manduriacu only (Phase 3). The report endpoints carry every other reservoir and go back to 2015-09-20; the mrid route returned all-null in all three Phase-0 runs. |

## Appendix A · Phase-0 capture checklist (exact targets; executed by `scripts/recon/capture.py`, results in `scripts/recon/RECON_REPORT.md`)

```
# ORDS (self-signed on 8443)
https://generacioncsr.celec.gob.ec:8443/ords/csr/sardomcsr/pointValuesMesH24?mrid=30031&fechaInicio=2026-09-01T00:00:00.000Z&fechaFin=2026-10-01T00:00:00.000Z&fecha=01/09/2026%2000:00:00
https://generacioncsr.celec.gob.ec:8443/ords/csr/sardomcsr/pointValues?mrid=30538&fechaInicio=2026-09-20T06:00:00.000Z&fechaFin=2026-09-21T05:00:00.000Z&fecha=20/09/2026%2001:00:00
https://generacioncsr.celec.gob.ec:8443/ords/csr/metadata-catalog/
https://generacioncsr.celec.gob.ec:8443/ords/csr/sardomcsr/
# CELEC-wide dashboard
https://generacioncsr.celec.gob.ec/graficasproduccionCELEC/index.html   (+ every referenced *.js)
https://generacioncsr.celec.gob.ec/graficasproduccion/                  (+ *.js, for the CSV button)
# CENACE
https://smec.cenace.gob.ec/SMEC/ResultadoInforme1.do?fecha=2026/09/20
https://smec.cenace.gob.ec/SMEC/ResultadoInforme1.do?fecha=2022/01/15
https://smec.cenace.gob.ec/SMEC/ResultadoInforme1.do?fecha=2024/10/15
https://smec.cenace.gob.ec/SMEC/ResultadoInforme{2..10}.do?fecha=2026/09/20
https://www.cenace.gob.ec/info-operativa/InformacionOperativa.htm       (twice: mid-day and after 00:30)
https://www.cenace.gob.ec/robots.txt  https://smec.cenace.gob.ec/robots.txt  https://www.celec.gob.ec/robots.txt
# Covariates
https://archive-api.open-meteo.com/v1/archive?latitude=-2.6&longitude=-78.6&start_date=2024-01-01&end_date=2024-01-31&daily=precipitation_sum&timezone=America%2FGuayaquil
https://api.open-meteo.com/v1/forecast?latitude=-2.6&longitude=-78.6&daily=precipitation_sum&forecast_days=16&timezone=America%2FGuayaquil
https://psl.noaa.gov/data/correlation/oni.data
# TLS fingerprints
openssl s_client -connect generacioncsr.celec.gob.ec:8443 </dev/null 2>/dev/null | openssl x509 -fingerprint -sha256 -noout
openssl s_client -connect smec.cenace.gob.ec:443 -cipher 'DEFAULT@SECLEVEL=1' </dev/null 2>/dev/null | openssl x509 -fingerprint -sha256 -noout
```

## Appendix B · Sources consulted for this plan

- jordanvt18/cotas-embalses-ecuador — `src/constantes.py`, `src/scraper.py`, `src/generacion.py`,
  `notebooks/02_comprension_datos.ipynb`, `data/raw/cotas_historico.csv` (1,668 days × 3).
- tefaceli/scraper-mazar — `scripts/actualizar_cota.py`, `scripts/scraper_cenace.py`, README
  (SMEC timing calibration), `data/historico.json` (2026-08-01 → 2026-09-20).
- Ecuador open-data portal listing for CENACE (quarterly net generation by plant); ARCONEL BNEE
  publication rule (20th of month n+2); press chronology of the 2023 and 2024 rationing episodes.
- Vercel AI Gateway docs (model strings in the AI SDK, free monthly credit and free-tier limits,
  zero-markup billing, `providerMetadata.gateway.cost`) and Vercel cron limits on Hobby (once per day),
  which is why scheduling stays in GitHub Actions.
