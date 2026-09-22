# hydro-look — Plan v2 (pre-coding)

**Status:** planning, no code yet. **Date:** 2026-09-21. Supersedes the initial plan and the
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
| `repDiaHid12m?fecha=` | daily, 365 rows ending the day before `fecha` | level, inflow (`q_ingresado`), operating limit, min, max flow for Mazar, Molino/Amaluza, Minas San Francisco, Delsitanisagua | one request per year, paging back with `fecha` (depth being probed in run 3) |
| `repDiaEner12m?fecha=` | daily, 184 rows | daily energy (MWh) for Minas SF, Mazar, Molino, Sopladora, Delsitanisagua, Alazán | one request per 6 months |
| `repDiaNivQIng?fecha=` | one day | level and inflow for Minas SF, Mazar, Amaluza, Sopladora intake chamber | per day |
| `repDiaPotQTurb?fecha=` | one day | power, units online, turbined flow per plant (Minas SF, Mazar, Molino, Sopladora) | per day |
| `repDiaEnerAyerHoy?fecha=` | one day | yesterday's energy and today's planned energy per plant **and for the SNI** (national total, 104,862 MWh on 2026-09-19) | per day |
| `repDiaRegAyer?fecha=` | one day | annual accumulated GWh, spilled volume (hm³), spilled energy, plant factor per plant | per day |
| `repDiaVolAlm` (POST `{"v_loctimestamp": …}`) | one instant | level, band, **% useful volume stored** for Minas SF, Mazar, Amaluza | per day |
| `csrEstUnidades` | now | unit status per plant (22 units) | no |
| `csrProdLineaLast2h` | now | live values: daily energy so far, reservoir level, inflow per plant, Paute basin flow | no |
| `sardom{maz,mol,sop,msf,ago,man,ccs}/{code}EnerDia?fecha=` | hourly, 24 rows for the local day | energy per hour (MWh) for each of the seven plants, Coca Codo Sinclair included | per plant-day (7 × ~1,700 requests for 2022→, or fewer if `EnerMes` comes back) |
| `csrEnerDia?fecha=` | hourly | CELEC Sur total (= Mazar + Molino + Sopladora + Minas SF) | per day |

Values seen on 2026-09-20: Mazar 2,139.1 masl with 75 m³/s inflow and 73.8% useful volume; Minas SF 790.3 masl
and 56.8%; per-plant daily energy Mazar 1,462 MWh, Molino 10,507, Sopladora 6,013, Minas SF 2,672, Agoyán 2,961,
Manduriacu 451, Coca Codo Sinclair 25,087 (64% of that day's national hydro of 76.8 GWh in SMEC).

**Verified but returning `null` values in both runs (open issue, see §8):** `pointValues`, `pointValuesMesH24`
and every `*Mes*`/`*Anio*` aggregation, including `{code}EnerMes` and `csrCaudCuenMesAvg`. Seven request styles
(our headers, requests defaults, the two community scrapers' headers, browser-like headers, local-midnight
windows, with and without the legacy TLS adapter) all got the timestamp skeleton with `valueedit: null`, for
2026-09 as well as for January 2015–2022. The community scrapers got values from the same endpoints at 18:08 and
23:10 UTC that day; our runs were at 23:37 and 23:56 UTC. Working hypothesis: an evening window in which the
historian's aggregated/edited values are unavailable. Run 3 and a later re-run will settle it. The mrid map is
nevertheless complete (`data/reference/mrids.csv`): the CELEC-wide bundle declares `mridCota`, `mridCaud`
and `mridUnid` for all seven plants plus the Paute basin flow (24812). These mrids are the only route to
**levels and inflows of Coca Codo Sinclair, Agoyán and Manduriacu**; the report endpoints cover the other four
reservoirs plus Delsitanisagua.

Semantics: `csrProdLineaLast2h` lists "Q Mazar" next to "Nivel Embalse" with the same value the caudal mrid
30538 returns, and `repDiaNivQIng` calls the daily figure `q_ingresado` (inflow). Treat the caudal mrids as
inflow, confirm with a month of overlap in Phase 3.

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

Storage: `data/raw/<source>/YYYY/MM/<id>.json.gz|html.gz` (archive), `data/curated/*.csv`
(git-diffable, small) plus a DuckDB file built on the fly for analysis (not committed).

---

## 5. Architecture

- **Language/tooling:** Python 3.12, `uv` + `pyproject.toml`, `ruff`, `pytest`. Libraries:
  `httpx` (with a custom SSL context per host), `beautifulsoup4`+`lxml`, `pandas`, `pyarrow`,
  `duckdb`, `pandera` for table contracts, `statsmodels`/`lightgbm` for models, `typer` for the CLI.
- **Layout**

```
hydro_look/
  sources/      celec_ords.py  cenace_smec.py  cenace_operativa.py  open_meteo.py  noaa_oni.py  mirrors.py
  ingest/       cli.py (daily | backfill --from | latest)   archive.py (raw store)
  quality/      contracts.py (pandera)  checks.py (ranges, freshness, unit reconciliation)
  features/     calendar.py  hydrology.py (water balance, cota↔volume)
  models/       baselines.py  water_balance.py  gbm_quantile.py  backtest.py
  publish/      site.py  api.py (docs/api/*.json)
data/  raw/  curated/  reference/
docs/  (GitHub Pages: index.html, api/latest.json, api/forecast.json, datos/*.csv)
scripts/recon/  (Phase-0 discovery scripts, run locally)
tests/  fixtures/<source>/*.json|html  (recorded responses)
.github/workflows/  daily.yml  backfill.yml  ci.yml
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

---

## 6. Phased roadmap

Each phase ends with a pushed, green state. Effort is in coding sessions (S) plus your time.

**Phase 0 · Reconnaissance and fixtures — done in GitHub Actions on 2026-09-21 (runs 1–2), run 3 pending**
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

**Phase 1 · Skeleton + CELEC report endpoints + backfill (2 S)**
Package, CLI, raw archive, `reservoir_daily` contract, ORDS client, and loaders for `repDiaHid12m` (levels
and inflows, four reservoirs, paged back a year per request), `repDiaEner12m`, `repDiaNivQIng`,
`repDiaVolAlm`, `repDiaRegAyer`, `repDiaEnerAyerHoy` (SNI daily total) and `{code}EnerDia` for the seven
plants; `daily.yml` and `ci.yml`. The `pointValues` client is written too but only for the three plants the
reports do not cover, and it must tolerate all-null responses.
Acceptance: levels and inflows for Mazar, Amaluza, Minas SF and Delsitanisagua from the earliest date the
reports serve; daily energy for all seven plants from 2022-01-01; cross-check against jordanvt18's
2022→2026 Mazar/Amaluza/Sopladora levels with differences listed; daily workflow green three days in a row.

**Phase 2 · CENACE SMEC ingestion + backfill (1–2 S)**
Parser for the 15/16 rows × 7 columns, contract, binary search for the earliest available date, backfill
from there (≈3,800 requests at 1/s from 2016, in dispatch runs), reconciliation tests (SMEC hydro vs the sum
of the seven plants' `EnerDia`; SMEC totals vs the Información Operativa validated-day block; kWh/24/1000 vs
tefaceli's MW). Información Operativa parser for the header key/value list with the closed-day flag.
Acceptance: `national_balance_daily` complete from the earliest date with < 1% missing days; SMEC vs
Información Operativa closed-day totals agree within 2% on ≥ 20 days.

**Phase 3 · Coca Codo Sinclair, Agoyán, Manduriacu levels and inflows (1 S, blocked on the null issue)**
Their mrids are known (`data/reference/mrids.csv`); once `pointValuesMesH24` returns values in a run,
backfill them and confirm the caudal semantics with a month of overlap between mrid 30538 and
`q_ingresado` for Mazar. If the aggregation endpoints stay null, fall back to hourly `pointValues` sampled
once a day at a time of day that works, and record the working window.
Acceptance: daily level and inflow for the three plants; a documented semantics note per variable.

**Phase 4 · Covariates, reference tables, quality gates (1 S)**
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

**Evaluation:** rolling-origin backtests with monthly origins from 2023-06; metrics MAE and pinball
loss per horizon, coverage of the p10–p90 band, and a crisis-specific check: lead time at which the
model's P50 first predicted a critical crossing before 2024-10. Report skill relative to M0.

**Known pitfalls:** suppressed demand during rationing (D10); levels above the declared max (the
band is operational, not physical); Amaluza siltation (volume curve drifts); caudal semantics (D5);
regime differences between Amazon- and Pacific-slope basins.

---

## 8. Risks and mitigations

| Risk | Mitigation |
|---|---|
| `pointValues*` and monthly aggregations return null in the evening runs (open) | Primary ingestion moved to the report and hourly-energy endpoints, which returned data; re-probe at other times of day (run 3 and a scheduled re-run); only three plants' levels depend on it. |
| `datosabiertos.gob.ec` blocks GitHub runners (403) | Validation-only source; fetch from your machine if wanted. |
| ORDS or SMEC changes or gets locked (the ORDS has no auth today) | Raw archive + independent sources per table; the community mirrors as a fallback; open an issue automatically on schema drift. |
| CELEC-wide mrids not discoverable from the bundle | DevTools capture (your original plan) is the fallback; Phase 1–2 do not depend on them. |
| Sandbox cannot reach sources | All network-dependent discovery in Phase 0 on your machine; parsers developed against fixtures; Actions does the real runs. |
| Scraping etiquette / robots | Identified UA, ≤1 req/s, robots.txt checked in Phase 0, one request per day per report in steady state. |
| Few crisis episodes → overconfident models | Baselines first, probabilistic outputs, explicit scenario inputs, backtest report published with the forecast. |
| Unit errors between sources | Reconciliation tests: SMEC vs InformacionOperativa closed day, SMEC hydro vs sum of plant production mrids, ORDS vs mirrors. |
| Self-signed TLS | Fingerprint pinning; mismatch fails the run. |

---

## 9. Decisions (recorded 2026-09-21)

| # | Question | Decision |
|---|---|---|
| 1 | Goal and target hierarchy (§0, §7) | Confirmed as written. |
| 2 | Where Phase 0 runs | GitHub Actions, `workflow_dispatch` (`.github/workflows/recon.yml`). Runners have open internet and both reference scrapers already run there daily. Fixtures and the report are committed back to the branch by the workflow. Can also be run locally with `python scripts/recon/capture.py`. |
| 3 | Site language | Spanish. |
| 4 | History provenance | Backfill everything from the ORDS; community mirrors are used for cross-checks only. |
| 5 | Transparency request to CENACE/CELEC for pre-2022 series | Deferred; stays optional in Phase 7. |

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
