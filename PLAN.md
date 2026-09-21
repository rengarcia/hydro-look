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

## 2. Source inventory

### 2.1 Verified (from code running daily in production elsewhere)

**S1 · CELEC SUR ORDS (reservoir levels, flows, production)**

```
base:    https://generacioncsr.celec.gob.ec:8443/ords/csr/sardomcsr
hourly:  {base}/pointValues          ?mrid=&fechaInicio=&fechaFin=&fecha=
daily:   {base}/pointValuesMesH24    ?mrid=&fechaInicio=&fechaFin=&fecha=
```

| Parameter | Format | Note |
|---|---|---|
| `mrid` | int | SCADA measurement point |
| `fechaInicio`, `fechaFin` | `YYYY-MM-DDTHH:MM:SS.000Z` | ISO-8601 UTC with milliseconds (JS `Date.toJSON()`) |
| `fecha` | `dd/MM/yyyy HH:mm:ss` | reference date, required |

Response: `{"items":[{"loctimestamp":"2026-09-21T23:00:00Z","valueedit":2138.66, ...}]}`, newest first,
`valueedit` may be `null`. `MesH24` returns one value per day at `05:00Z` = 00:00 America/Guayaquil.
Data exists from 2022-01 (jordanvt18 backfilled from there). Port 8443 serves a self-signed
certificate. Both scrapers pause 0.5 s between calls; the service has tolerated daily use for months.

Known mrids (validated against operating ranges by jordanvt18, Aug 2026):

| Plant / reservoir | cota (masl) | caudal (m³/s) | Declared band (masl) |
|---|---|---|---|
| Mazar | 30031 | 30538 | min 2098 · critical 2115 · max 2153 |
| Amaluza (Molino / Paute) | 24019 | 24811 | min 1975 · max 1991 |
| Sopladora | 90919 | 90537 | min 1312 · max 1318 |

Data-quality facts already known from the 2022→2026 series: Mazar spent 392 days above the declared
max (so 2153 is an operating reference, not a physical cap) and 66 days below critical in 2024;
Amaluza 7 days below min; no nulls or non-positive values.

**S2 · CENACE SMEC daily energy balance (national mix, closed day)**

```
https://smec.cenace.gob.ec/SMEC/ResultadoInforme1.do?fecha=YYYY/MM/DD
```

HTML table; rows are `td.bordegris[align=left]` labels followed by a value cell, column
"Energía Activa en el Día (kWh)". Rows confirmed by tefaceli: Generación Hidráulica, Generación
Vapor Bunker, Generación Turbinas a Gas, Generación Turbinas a Diesel, Generación Motores Bunker,
Generación de Otros Tipos, Importación de Colombia. Report for day D is available by ~11:15 local on
D+1 (empirically calibrated: not ready at 05:00). TLS: self-signed and weak ciphers → custom adapter.
Likely more rows exist (exports, Peru, demand, losses); inventory in Phase 0.

**S3 · CENACE Información Operativa (intraday snapshot)**

`https://www.cenace.gob.ec/info-operativa/InformacionOperativa.htm` — static HTML with embedded
Plotly charts and a text header (daily totals by type, imports/exports, demand MW by distributor,
month-to-date, year-to-date, monthly peak day). Values for the current day accumulate during the
day. Use: (a) capture the header once after 00:30 local for the closed day as a cross-check of S2,
(b) optional intraday snapshots for a "right now" tile. Your earlier fetch was refused by robots
rules; Phase 0 reads `robots.txt` and we comply.

**S4 · Community mirrors (validation only)**

- `https://raw.githubusercontent.com/jordanvt18/cotas-embalses-ecuador/main/docs/datos/cotas_historico.csv`
  and `.../docs/estado.json` — reachable even from the sandbox.
- `https://raw.githubusercontent.com/tefaceli/scraper-mazar/main/data/historico.json`.

### 2.2 To verify in Phase 0

| Id | Source | What we need to learn |
|---|---|---|
| S5 | CELEC-wide dashboard `generacioncsr.celec.gob.ec/graficasproduccionCELEC/` | mrids for cota / caudal / producción of Mazar, Amaluza, Sopladora, Minas San Francisco, Agoyán, Manduriacu, Coca Codo Sinclair; whether Pisayambo (Pucará) or Daule-Peripa appear; what "Descargar CSV" calls. |
| S6 | ORDS metadata catalog `.../ords/csr/metadata-catalog/` and module root `.../ords/csr/sardomcsr/` | Whether a handler lists measurement points with names (would replace bundle grepping). |
| S7 | SMEC other reports `ResultadoInforme{2..N}.do` and the SMEC menu | Demand, exports, hydrology or reservoir reports. |
| S8 | CENACE Datos Abiertos "Producción de Energía Eléctrica del Parque Generador" (quarterly CSV/XLSX, last update seen 2025-05) | Per-plant net generation history for validation; whether it is still updated. |
| S9 | ARCONEL BNEE (monthly, published the 20th of month n+2) | Monthly demand, effective thermal capacity; file format. |
| S10 | CENACE annual reports (1999→ generation by type; "Paute Integral" daily variables) | One-off extraction for long baselines. |
| S11 | Open-Meteo archive/forecast/seasonal, NOAA ONI | Reachable from Actions (assumed yes). |
| S12 | `robots.txt` on cenace.gob.ec, smec.cenace.gob.ec, celec.gob.ec | Compliance. |

### 2.3 Ruled out

SIMEM (credentials only for market participants). Electricity Maps (no Ecuador parser). INAMHI (no
API; monthly PDFs and annual books; data by email request). web.archive.org Save Page Now (401
anonymous; optional later with free S3 keys).

---

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

**`thresholds.csv`** — declared operating bands per reservoir (table in S1), with the source URL
and the date read, so a change of rules is a commit.

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
- **TLS:** fingerprint pinning for `generacioncsr.celec.gob.ec:8443`; `SECLEVEL=1` adapter with
  pinning for `smec.cenace.gob.ec`; normal verification everywhere else. Fingerprints stored in
  `data/reference/tls_pins.json` with the date captured; a mismatch fails loudly and opens an issue.
- **Failure handling:** each source ingests independently (`continue-on-error` per step); a failed
  or schema-drifted parse writes nothing, keeps the raw archive, and the workflow opens/updates a
  GitHub issue. Freshness per table is published in `api/status.json`.
- **Testing:** every parser has fixture-based tests (recorded in Phase 0); contracts run on every
  ingest; a `--dry-run` mode prints what would be written.

---

## 6. Phased roadmap

Each phase ends with a pushed, green state. Effort is in coding sessions (S) plus your time.

**Phase 0 · Reconnaissance and fixtures (your machine, ~1 h; then 1 S)**
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

**Phase 1 · Skeleton + CELEC SUR ingestion + backfill (2 S)**
Package, CLI, raw archive, `reservoir_daily` contract, ORDS client with pinning, daily and backfill
modes for the six known mrids from 2022-01-01, `daily.yml` and `ci.yml`.
Acceptance: full 2022→today series for Mazar/Amaluza/Sopladora cota and caudal; cross-check against
jordanvt18 reports zero mismatches > 0.01 m on overlapping dates (differences listed if any); daily
workflow green three days in a row.

**Phase 2 · CENACE SMEC ingestion + backfill (1–2 S)**
Parser for every row inventoried in Phase 0, contract, backfill 2022-01-01→today (≈1,700 requests
at 1/s, one dispatch run), unit reconciliation test (kWh/24/1000 ≈ tefaceli MW for Aug–Sep 2026).
InformacionOperativa header parser as a secondary source with the closed-day flag.
Acceptance: `national_balance_daily` complete from 2022 with < 1% missing days; S2 vs S3 closed-day
totals agree within 2% on ≥ 20 days.

**Phase 3 · CELEC-wide plants (1–2 S, depends on Phase 0 mrids)**
Validate each candidate mrid (range check against the plant's declared band, correlation with S2
hydro total for production mrids), add to `mrids.csv`, backfill, extend contracts. Confirm the
caudal semantics (inflow vs turbined) by checking the water balance sign on Mazar: with inflow,
Δcota should correlate positively with caudal minus turbined flow implied by production.
Acceptance: seven plants × {cota, caudal, producción} daily since the earliest month the ORDS
serves; a documented semantics note per variable.

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

## Appendix A · Phase-0 capture checklist (exact targets)

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
