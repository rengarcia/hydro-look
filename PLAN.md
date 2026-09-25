# hydro-look — Plan v2

**Status:** Phases 0, 2, 3, 4, 5, 6 and 6c are done. Phase 1 is code-complete and waits only on its clock — three consecutive days with a green *scheduled* daily run; 2026-09-22 and 2026-09-23 are green, so a green scheduled run on 2026-09-24 closes it. Phase 4 closed 2026-09-24 when ERA5 history reached all seven verified catchment centroids (13,410 days each from 1990-01-01, covariates run 36009328405); the Mazar models then move onto `paute_mazar` by themselves, and on that basin the shipped M4 design no longer wins at seven days (Phase 4, "What is still open"). Phase 6b is live: the AI Gateway is configured and the first `ok` narrative was written 2026-09-23 (run 35810691729), so its seven-day acceptance count has started. The site is deployed on Vercel, and Colombia's side of the interconnection is ingested from XM (Phase 7). The `ENHANCEMENTS.md` list was implemented on 2026-09-23 (Phase 7); what remains of it is the ERA5 dispatches. Gaps neither plan covered are listed in §8a (added 2026-09-24). **Updated:** 2026-09-24. Supersedes the initial plan and the
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

**Catchment geometry — probed four times on 2026-09-22 (runs 35727122874, 35730548955,
35731329897 and 35732611773), and HydroSHEDS is closed to this project for a reason that is now
diagnosed rather than guessed.** §3 asks for a centroid and an area per catchment, and neither
can be looked up: both are properties of a catchment boundary, which is a property of a dam
location and a flow network. The plan for it was HydroSHEDS' HydroBASINS, whose `NEXT_DOWN`
topology turns "the catchment above this dam" into "the sub-basins that drain into it" and whose
`SUB_AREA` gives the area with no geometry work.

A 403 is not one fact but three, with different fixes: the host refuses the address, or it
refuses the client, or the path is gone. All three were tested and only one survives.
`data.hydrosheds.org/` **403s at the root**; `hybas_sa_lev01-12_v1c.zip` 403s to this project's
User-Agent and **403s to a browser's**; and so does the identical URL lifted from HydroSHEDS' own
product page, which itself answers **200 with 47,522 bytes and 31 archive links, every one of
them pointing back at `data.hydrosheds.org`**. The paths are current and the host refuses this
address — the failure `datosabiertos.gob.ec` already has in §2.5. **No different request from a
GitHub runner gets past it**, which retires "try it another way" as a line of work. The page also
corrected the naming: one zip per continent carrying all twelve levels, `hybas_sa_lev01-12_v1c.zip`,
not one file per level, so the four per-level URLs the first probe asked for never existed. That
cost nothing only because the host refuses everything, and would have been four wrong 404s the
day that changes.

Because the block is on the *address*, the one untried route is a different address. The
development sandbox refuses these hosts by an egress allowlist rather than by their choice — its
proxy says so in as many words — so **adding `data.hydrosheds.org` to this environment's network
egress settings would test whether HydroSHEDS refuses this address too, or only GitHub's**. That
is one setting and one request, and it is the cheapest remaining shot at the dataset the plan was
built around.

**No mirror of it exists on the two hosts that would ordinarily carry one.** Zenodo answers 200
to quoted searches for `"HydroBASINS"` (50 records), `"HydroATLAS"` (22), `"Global Dam Watch"`
(18) and `"GRanD"` (25,168), and **not one returned record names any of them in its title**;
figshare's search API returns **zero articles** for the same terms. A negative result is worth as
much as a positive one here, because it redirects the work: the task is not "find the mirror", it
is "find a different dataset".

**ArcGIS Online is reachable, anonymous, and holds Ecuador's own answer to the same question** —
the country delineates `unidades hidrográficas` by the Pfafstetter method, whose codes encode
upstream topology in their digits, which is what `NEXT_DOWN` was wanted for. One hit is that:

| service | layer | geometry | fields |
|---|---|---|---|
| `Fig_13__B_UnidadesHidrográficasN4Pfastetter` (`services7.arcgis.com/NWWHhu45fOJtCgG3`) | 0 | polygon | `FID`, `NIVEL_4`, `NIVEL_3`, `Shape__Area`, `Shape__Length` |
| `04Subcuencas_Globil` (WWF) | `Subcuencas_Mira_Mataje1` | polygon | `NMGCUENID3`, `Area`, `Area_ha`, `Cuenca`, … |
| `Subcuencas_Mira_Mataje_RSC` (WWF) | `Subcuencas_RC_Mira_Mataje` | polygon | `Area_ha`, `Area_km2`, `Name`, `A_ICA`, `A_IRH`, … |
| `MM_Subcuencas` (WWF) | `Subcuencas` | polygon | `NMGCUENID3`, `Area`, `Area_ha`, `Cuenca`, … |

Two things to be clear-eyed about before treating any of that as a source. The three WWF layers
cover the **Mira–Mataje** border basin only, so they are a check on method, not a source for the
fleet. And the Pfafstetter layer is `Fig 13_` of somebody's study, published from a personal
ArcGIS account: it is **a lead to a dataset, not a citable source**, and level 4 is coarse — whether
an N4 unit resolves the catchment above a particular dam is untested. The work it points at is to
find the official publication of the same units, from SENAGUA or MAATE, and verify this against
it. That is now the first task of the basins work, not a detail of it.

**The pour points are in much better shape, and five of the seven now have the two independent
sources this repository requires before it writes `verified` anywhere.** Wikidata's SPARQL
endpoint answers with 23 Ecuadorian dams and plants carrying coordinates and **all seven match**;
the second opinion is OpenStreetMap, asked one small bounding box per dam (run 35734086216, and
Marcel Laniado from run 35730548955):

| site | basin | Wikidata | OpenStreetMap | km apart | verdict |
|---|---|---|---|---|---|
| manduriacu | guayllabamba | Q65196233, 0.21480556, −78.91233333 | `way/562129245` Central Hidroeléctrica Manduriacu | **0.02** | agreed |
| coca_codo_sinclair | coca | Q19277520, −0.1979037, −77.6849914 | `way/310742588` Coca Codo Sinclair | **0.11** | agreed |
| marcel_laniado | daule | Q19381026, −0.927, −79.75 | `way/550243261` Represa Daule-Peripa | **0.46** | agreed |
| agoyan | pastaza | Q5760779, −1.39852778, −78.37755556 | `node/4976262596` Central Hidroagoyan | **0.56** | agreed |
| mazar | paute | Q1751861, −2.5953091, −78.6218378 | `node/5741662743` Central hidroeléctrica Mazar | **0.69** | agreed |
| delsitanisagua | zamora | Q65196191, −4.04588889, −78.98377778 | `node/2489320895` Delsitanisagua | **8.18** | **disagree** |
| minas_san_francisco | jubones | Q65196242, −3.3221588, −79.6016026 | — | — | no answer yet |

**Delsitanisagua is the interesting row, and it is exactly what this comparison exists to catch.**
Both sources name the plant and they place it **8.18 km apart** — far more than a mapping
imprecision and more than a sub-basin. The likely explanation is that they are naming different
structures: Delsitanisagua is run-of-river on the Zamora, and on such a scheme the intake and the
powerhouse sit at opposite ends of a headrace of exactly this order. That distinction is not a
detail here, because **a catchment is defined at the intake and not at the machines**: taking the
powerhouse would hand this basin several kilometres of river it does not drain. Neither point may
be used until which is which is established, and averaging them would produce a place that is
neither.

Marcel Laniado is now matched because the probe compares alias lists with accents and punctuation
folded away instead of the first word of a query string; its QID, **Q19381026**, was not in this
plan before. `minas_san_francisco` has never had an answer from Overpass in four runs — every
instance refused it — so its column is blank for want of a reply, not for want of a dam.

Nine further Ecuadorian entries came back that no site claimed, and they are recorded here because
they are where the next alias or the next plant comes from: Sopladora (Q23887004), Molino
(Q65196245), San Francisco (Q65196252), Represa de Paute (Q453432), Abanico (Q23886977), Pucará
(Q65196249), Quijos (Q65196199), Alluriquín (Q65196189), Sarapullo (Q65196256).

One limit to keep in view when reading the blanks: the OSM box is drawn **around the Wikidata
point**, which makes this a confirmation test rather than an independent search. It can confirm
agreement and it can report a disagreement like Delsitanisagua's, but it cannot find a dam that
OSM places somewhere else entirely — only the country-wide query can, and that is the one that
still answers 504. Both hosts disallow crawlers in `robots.txt` (`Disallow: /sparql`,
`Disallow: /api/`) and both publish API terms instead, which is the same situation as Open-Meteo
above and is handled the same way.

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

SIMEM (credentials), Electricity Maps (no Ecuador parser), INAMHI (no API for its station network —
but see §2.8 for the model its forecast portal runs on), web.archive.org Save Page Now
(401 anonymous), the ORDS metadata catalog (401) and module root (404).

### 2.8 Streamflow return periods: INAMHI–GEOGLOWS — verified 2026-09-25

INAMHI publishes its hydrological forecasts through the **INAMHI–GEOGLOWS portal**
(`inamhi.geoglows.org`, co-developed with Fundación EcoCiencia). Its Hydroviewer
(`/apps/hydroviewer-ecuador/`) colours every river by the **return period** its forecast
reaches: the flow reached on average once in 2, 5, 10, 25, 50 or 100 years. The portal is a
Tethys app with no documented API, and the development sandbox cannot open it (egress 403), so
the numbers are read at their source: the **GEOGLOWS River Forecast System v2**, whose
retrospective simulation (ERA5, 1940 → present, on TDX-Hydro rivers) is fitted per river with a
Gumbel type I distribution by the method of moments. GEOGLOWS publishes them in the public
`geoglows-v2` bucket, which the sandbox *can* reach:

- `retrospective/return-periods.zarr` — Zarr v2, `[return_period, river_id]`, 6,838,900 rivers,
  arrays `gumbel_daily` (fit on daily means), `gumbel_hourly` (fit on hourly flow; identical to
  `gumbel`, the one the Hydroviewer uses) and `max_simulated`. Chunks are Blosc (LZ4 for
  `river_id`, Zstd for values, byte-shuffled). Revision 4 of 2026-06-10. **Licence CC BY-NC-SA
  4.0** — attribution, non-commercial, share-alike — unlike every other source here, and carried
  into `attribution` in the public contract and onto the page.
- `tables/package-metadata-table.parquet` (river id, VPU, a point per river) and
  `tables/v2-model-table.parquet` (downstream id, upstream and downstream drainage area in m²,
  length). Ecuador's dams fall in VPUs 605 (Amazon slope) and 614 (Pacific).

Whether the portal shows exactly these values, or INAMHI's own (bias-corrected against its
stations, as its "Historical validation tool" suggests is possible), cannot be read from here.
`npm run geoglows` asks the portal once per run and archives the page when it answers, so a
runner settles it (§6 Phase 7).

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

Checked 2026-09-24. The dates now in `rationing_episodes.csv` differ from this seed: 2023 ends
2023-12-17, April 2024 ends 2024-04-30, the long episode ends 2024-12-19. Three rows were added:
the 2026-05/06 maintenance weekends and the AV1 industry curtailment from 2026-09-22.

**`basins.csv`** — centroid lat/lon and area for the catchments feeding Mazar (upper Paute), Coca
(CCS), Pastaza (Agoyán/Pisayambo), Jubones, Guayllabamba, Daule; used for Open-Meteo queries.
Delivered 2026-09-23 for all seven dams, Zamora (Delsitanisagua) included, from a DEM delineation
checked against INAMHI — see §6 Phase 4. Areas are in each row's notes and in
`data/reports/catchments.md`; the outlines are `catchments.geojson`.

**`mrids.csv`** — plant, variable, mrid, unit, sample value, validated_on, evidence (chart title or
bundle line). Grows in Phase 3.

**`geoglows_return_periods.csv`** — one row per dam: the GEOGLOWS v2 river matched to its
catchment (river id, VPU, both delineations' areas and their difference), the daily-fit and
hourly-fit return-period flows at 2–100 years, the largest simulated flow, and the store's
revision and licence. Written by `npm run geoglows` (§6 Phase 7), not by hand.

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

- **Language/tooling (decided 2026-09-22, see §9):** TypeScript on Node 24 (moved from 22 on 2026-09-23; `.nvmrc`), one package for both
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
  publish/      latest.ts (the current-state document the site's tiles read)
  chart/        scale.ts (scales, ticks, SVG path geometry; pure, unit-tested)
  site/         data.ts (what the page reads at build time)  format.ts (Spanish)  documents.ts
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

**First count, taken 2026-09-22 18:30 UTC: one of three.** The 12:15 slot never fired at all —
not late, absent, with nothing queued. The 16:30 slot fired at 16:58, twenty-eight minutes late,
and succeeded ([run 35757592009](https://github.com/rengarcia/hydro-look/actions/runs/35757592009)).
So the scheduler has now been measured dropping a slot outright as well as delaying one by five
hours, and the criterion counts green scheduled runs on consecutive days, not consecutive slots:
two slots a day is what lets a dropped one not break the streak. The earliest it can close is
therefore 2026-09-24.

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

**The true first date of the historian series is settled: 2010-02-10** (2026-09-22, run
35736531676). The previous walk of mrid 30538 was bounded at 2015-01 by its own `--from` and so
proved only that the series went deeper. Walking it from 2005-01 let the stopping rule decide
instead of the bound: it returned values in every month down to 2010-01 and then twelve consecutive
empty months, halting at 2009-01.

The date the *readings* begin is six weeks later than the date the series does, and that gap is a
finding rather than a rounding of one. Everything the historian publishes for Mazar before
2010-02-10 is a zero: January 2010 has nine rows and all nine are zeros, then 2010-02-01 to -09 are
nine more, and the first number that is a measurement is 73.2 m³/s on 2010-02-10. A historian
switched on ahead of the gauge it records is the obvious reading, and it is why a walk cannot be
stopped on "did a value come back" alone. Mazar's inflow now holds **6,062 days, 2010-02-10 →
2026-09-21** — 1,780 more than the 4,282 it had this morning, and reaching **fifty-five months below
`repDiaHid12m`'s floor of 2014-09-20**. The other historian series were walked in the same run and
stopped where their plants begin, so the fleet's histories are now bounded by the data rather than
by a dispatch parameter.

**That depth cost something to use, and the cost was already being paid.** The years the walk
reached are not clean, and neither were the years already committed:

- **A spike that is not a flood.** Mazar's historian publishes 23,221.10 m³/s on 2013-11-27, between
  neighbours of 34.31 and 0.00, against a maximum of 867 in the same series and 1,933 anywhere in
  this repository's 21,000 inflow readings. That is a third of the Amazon at its mouth on a river
  averaging 60. The two zeros immediately after it are what a failed gauge looks like from outside.
- **82 zeros, 60 of which were already here.** 28 for Coca Codo Sinclair, 31 for Manduriacu and 1
  for Agoyán were committed in Phase 3 and never flagged; 22 more arrived with Mazar's new years.
  The historian publishes decimals, and in it a 0.00 sits below every one of those series' own
  non-zero floors: 84.00 m³/s for Coca Codo Sinclair against a 1st percentile of 97, 35.00 for
  Agoyán, 10.40 for Manduriacu. They cluster the way a fault does and hydrology does not — the
  eighteen consecutive publishing days before Mazar's first real reading, and two immediately after
  the spike. A model handed one reads it as the river having stopped, the same false collapse §6's
  Phase 2 already rejects on the SMEC side.
- **And the rule nearly went one day too far.** Rejecting every zero inflow would have deleted
  2024-11-08, where `repDiaHid12m` published 0 for Mazar at the worst of the rationing drought. The
  reports publish whole m³/s and the historian published **0.142** for that same day, so the
  report's zero is `round(0.142)` — the truest reading in the series, not a missing one. The rule is
  therefore asked only of the route whose precision gives it meaning, and the test that asserts a
  reported zero is kept now carries that day as its case.

83 rows are removed from `observations_daily` (82 historian zeros and the spike); both parsers and
`npm run check` now reject all three shapes, and every raw response stays archived so anything that
later acquires a meaning can be reprocessed. `INFLOW_CEILING_M3S` in `src/lib/parse/ords.ts` is
10,000 — fivefold clear of the largest reading ever seen here.

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
fetched. Walking it produced **4,282 days, 2015-01-01 → 2026-09-21** — a floor since pushed back to
2010-01-01 and 6,085 days by the walk recorded in Phase 1, which does not disturb the comparison
below because `repDiaHid12m` reaches only 2014-09-20 either way — and the answer is not close:

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

**Phase 4 · Covariates, reference tables, quality gates — done 2026-09-24** (reference tables and gates 2026-09-22; catchments 2026-09-23; ERA5 at the new centroids 2026-09-24)
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

**What the 2026-09-22 probes established about closing that**, in full in §2.4: HydroSHEDS refuses
the runner's *address*, not its User-Agent and not a stale path — the root, a browser User-Agent and
the URL taken from HydroSHEDS' own live product page are all 403 — so no different request from
Actions reaches it, and neither Zenodo nor figshare carries a mirror. What is reachable is ArcGIS
Online, where Ecuador's Pfafstetter `unidades hidrográficas` are served as anonymous, queryable
polygons; the hit found is a figure from a personal account rather than an agency publication, so
it is a lead to a dataset rather than a citable source.

**That lead is now closed, negatively** (2026-09-22, run 35737236907). Asking each of the four
candidate layers which of its polygons contains each of the seven pour points — a point-in-polygon
query, which a feature layer answers without serving the dataset — returned **`no polygon contains
this point` for all twenty-eight pairs**. Three of the four map Mira-Mataje in the far north and
were expected to say so; the fourth, the `Fig 13_ B_UnidadesHidrográficasN4Pfastetter` layer that
looked like the national answer, says it too. It is a figure from one paper covering one study
area, not Ecuador's Pfafstetter units, and no amount of re-asking it will produce a catchment. The
search for a boundary set with upstream topology starts again from SENAGUA or MAATE directly.

**Delsitanisagua's 8.18 km disagreement was never real.** It was this probe choosing the wrong
element, and the correction is worth more than the finding it replaces. OSM maps at least two
Delsitanisagua structures; the matcher took whichever the server listed first and got
node/2489320895, a `waterway=dam` carrying no QID, 8.18 km from Wikidata and some 500 m above it.
Ranking name matches by QID instead (run 35739164652) finds **way/690695824, "Central
Hidroeléctrica Delsitanisagua", `wikidata=Q65196191`, `power=plant`, 180 MW** — the same QID the
SPARQL query returned — **0.1 km from the Wikidata point and 22 m below it**. The two sources never
disagreed about anything: they name one entity and place it in the same spot.

**But agreeing about the powerhouse is not the same as knowing the pour point.** What both sources
confirm is where the *machines* are, and a catchment is defined at the intake. node/2489320895 is
still the best candidate for that intake — it is tagged `waterway=dam`, it is upstream, and it sits
about 500 m higher, which on a run-of-river scheme is the right shape — but it carries no QID, no
operator and a name that is also a locality in that valley, so nothing yet ties it to this scheme
rather than to something else called Delsitanisagua. It is a lead to confirm, not a coordinate to
use, and `basins.csv` gets neither point until it is confirmed. (The earlier reading in this
section, that the 526 m gap proved intake-versus-powerhouse, was sound reasoning resting on a
premise the fixed matcher removed. The two elevations it compared belong to two structures that
were never the two sources' rival claims.)

**Three pour points are now confirmed by identity rather than by proximity, and one improved a lot.**
The QID ranking does not only prevent errors, it finds better elements. Mazar now matches
**way/311803060, "Presa Mazar", `wikidata=Q1751861`, `waterway=dam`, at 0.04 km and 0 m** — the dam
itself, where before it matched a `power=plant` node 0.69 km away. Agoyán matches node/8432673468
by QID at **0.37 km and −9 m**. Coca Codo Sinclair's way/310742588 carries `wikidata=Q19277520` and
`waterway=dam` and agrees to **0.11 km and 1 m**. Those three are dams or plants identified by the
same QID two ways, at the same place, at the same height: the pour points this repository may mark
`verified`.

**The distance bound earned its keep immediately.** Overpass did not answer for Marcel Laniado this
run, and Nominatim offered "Embalse Daule Peripa" — 16.36 km away and carrying `wikidata=Q23886712`,
a *different* QID from the Q19381026 the SPARQL query returned. It is the reservoir, not the dam.
The bound rejected it and said why, where the previous run would have seated it in the table.

**Minas San Francisco has now failed six runs**, and for the first time the failure is informative:
Nominatim answered both aliases (10 and 9 results) with no name match at all, so this is no longer
only three busy Overpass servers. Either the dam is unnamed in OSM or it is mapped under a name
nobody here has guessed, and the next attempt should search the Jubones by geometry rather than by
string.

**The first official lead, 2026-09-22 (run 35769756096).** The probe gained three phases —
Minas San Francisco by geometry, a conduit trace from the Delsitanisagua intake lead, and a sweep
of Ecuador's own geoservers for hydrographic units — and the third found what the ArcGIS route
could not: **INAMHI's GeoServer (`geoservicios.inamhi.gob.ec`) serves `geonode:hidroelectricasshape`,
titled "Cuencas Hidroeléctricas"**, beside `geonode:cuencas_inamhi` and `geonode:cuencas_maate`.
Asked which polygon holds each pour point, the hydro-catchment layer puts Mazar in **Paute_Molino**
and Marcel Laniado in **Marcel_Laniado_4326**; the other five sit near a polygon but outside it.
The two national layers place all seven in the expected basin (Paute, Napo, Pastaza, Jubones,
Esmeraldas, Santiago, Daule), and an ArcGIS layer credited to the environment ministry gives each
a level-5 Pfafstetter code (Mazar 49982, Coca Codo Sinclair 49788, Agoyán 49967, Minas San
Francisco 13943, Manduriacu 15241, Delsitanisagua 49989, Marcel Laniado 14293 — whose name field
says 14283, a disagreement printed rather than resolved). INAMHI is the national hydrometeorology
institute, so this is an agency publication rather than a paper's figure, and it is the first
boundary set in this section that is. It is still not delineation: Paute_Molino is the catchment
at Molino, downstream of Mazar, so it is a superset of Mazar's; and a polygon that holds a pour
point says nothing about which polygon is *upstream* of it.

Everything else the sweep asked refused or did not exist: SNI and IEDG answer 403, the SENAGUA and
MAATE geoportal hosts do not resolve, the `ide.ambiente.gob.ec` and MAG GeoServer paths are 404, IGM's services list no
hydrographic layer, INAMHI's GeoNode catalogue search returns its whole list regardless of the
query, and ArcGIS Online user searches for the agencies need a login.

**Minas San Francisco is now identified by QID** — way/928750864, "Central Hidroeléctrica Minas
San Francisco", `wikidata=Q65196242`, `operator=CELEC Sur`, 270 MW, 1.39 km from the Wikidata
point — so the powerhouse is settled the way the other three were. The intake is not: the only
element tagged as a dam on the Jubones in a 55 km box is way/690695821, on the river (34 m from
it), 13.3 km from the powerhouse and 315 m above it — the shape a La Unión dam feeding a tunnel
would have — carrying no name, operator or QID. It is Minas San Francisco's version of the
Delsitanisagua lead: the right shape, nothing tying it to the scheme. **The Delsitanisagua conduit
trace itself was not answered** (Overpass 504, then two timeouts) and needs re-asking.

So the order of work is now: fetch `hidroelectricasshape` whole — its attribute table and each
polygon's area and outlet — to learn which schemes it covers and whether Paute_Molino has a
Mazar-sized sibling; re-ask the Delsitanisagua trace; then delineate from the INAMHI polygons where
they reach and from the Pfafstetter codes' upstream rule where they do not, and only then rewrite
`basins.csv`. Nothing about
the covariate loader changes — it already takes one row per
basin and archives what it fetches. What is missing is the table it reads, and
`scripts/probe-basins.ts` is what re-asks these questions once there is a new candidate to ask
about.

**Two cautions about the probe itself, both found by the run that produced the answers above.** A
free-text search answers with whatever carries the string: Nominatim returned an "Agoyan" 131 km
away at 2,876 m, and the probe seated it in the coordinates table beside the real site's 1,638 m as
though the pair were comparable. And the name matcher took whichever element the server listed
first, so Manduriacu — which OSM maps as a plant, a dam and an untagged reservoir outline under two
spellings of one name — reported 0.02 km on one run and 1.19 km on the next from identical data.
Both are fixed: a Nominatim hit is accepted only within the thirteen kilometres the bounding boxes
already use, and name matches are ranked by QID agreement before distance. Any figure in this
section taken from a run before that fix should be read with those two failure modes in mind.

One setting would reopen the route the plan was built around, and it is not in this repository: the
block is on the address, and the development sandbox is a different address that refuses these
hosts only by its own egress allowlist. Adding `data.hydrosheds.org` to this environment's network
egress settings tests whether HydroSHEDS refuses everyone or only GitHub.

**Closed 2026-09-23: the catchments, from a DEM, checked against INAMHI.** The search for a
boundary set with upstream topology ended by not needing one. `npm run catchments`
(`scripts/catchments.ts`, `src/lib/geo/catchment.ts`) derives the flow network itself: Copernicus
GLO-90 (3″, ~90 m) from the public `copernicus-dem-90m` bucket, which runners reach; priority-flood
depression filling with steepest-descent D8; each pour point snapped onto the channel under the
dam's mapped crest (or within 0.5 km of a point, 2 km for Daule-Peripa's rounded one); the
mosaic widened a degree on any side a catchment reaches. It runs as the `catchments` job of
`probe-basins.yml` and commits `data/reference/catchments.geojson`, `data/reports/catchments.md`
and INAMHI's raw answer. Final run: 35817970669.

Fetching `hidroelectricasshape` whole answered the question the order of work above put first:
it is **twelve per-scheme polygons from the ENANDES project, one of them drawn at Mazar itself**,
not only at Molino. Earlier probes saw only `Paute_Molino` because a point-in-polygon test
returns one polygon and four of the seven dams sat just outside theirs. So every catchment has an
independent delineation to be checked against:

| basin row | pour point | DEM km² | INAMHI polygon | INAMHI km² | IoU |
|---|---|---|---|---|---|
| `paute_mazar` | Presa Mazar, way/311803060 (QID) | 4,418 | Mazar | 4,041 | 91% |
| `coca_ccs` | dam way/310742588 (QID) | 3,727 | Coca-Codo4326 | 3,726 | 100% |
| `pastaza_agoyan` | node/8432673468 (QID) | 8,242 | Hidroagoyan | 8,233 | 100% |
| `guayllabamba_manduriacu` | Wikidata point | 6,969 | manduriacudisolv | 6,959 | 99% |
| `daule_marcel_laniado` | Wikidata point, snapped 1.9 km | 4,197 | Marcel_Laniado_4326 | 4,165 | 99% |
| `jubones_msf` | intake dam way/690695821 | 3,345 | Minas_San_fancisco | 3,347 | 99% |
| `zamora_delsitanisagua` | intake dam way/726604479 | 1,137 | Delsinta (at the powerhouse) | 1,387 | 82% |

- **Both intake leads are settled.** For Minas San Francisco, INAMHI drew its polygon at the
  unnamed dam §2.4 found on the Jubones: two independent delineations from that point agree at
  99%. For Delsitanisagua, the re-asked conduit trace (probe run 35816537011) found
  **way/726604479, "Delsitanisagua hidroelectrica", `waterway=dam`, `operator=CELEC`**, 20 m from
  the node/2489320895 lead and 480 m above the powerhouse, with an underground CELEC water
  pipeline (way/690695823) at the powerhouse end. INAMHI drew Delsinta at the powerhouse, and
  the DEM catchment there matches it at 99%; the row uses the intake, because that is the water
  the plant takes.
- **Mazar is the one disagreement, and it is recorded, not resolved.** INAMHI's polygon lies
  wholly inside the DEM's; the extra ~380 km² is a north-bank lobe whose outlet is beside the
  dam. A 166 km² branch joins the main channel 0.19 km above the crest cell, which is closer than the
  DEM can place a junction relative to a dam; the other ~210 km² of the difference enters further up. Whether that lobe drains into the reservoir or below the dam is a
  question for a better map than either source. Snapping to the crest rather than a radius was
  tried and changed nothing.
- **Two defects the first runs found in code written for this.** Priority-flood's own choice of
  receiver is the lowest neighbour, which on a slope favours the diagonals and sent a test
  valley's far hillside past its pour point (1,847 km² of an analytic 2,957); every cell is now
  re-pointed at its steepest neighbour by drop over distance. And a snap radius can reach below a
  dam, so a dam mapped as a way is snapped to its crest.

**What "verified" means in these rows.** `coordinate_status` describes the sampling point, and
each of the seven is the DEM catchment's centroid, which lies inside INAMHI's polygon for the same
scheme, with INAMHI's own centroid inside ours, and in the same 0.25° ERA5 cell as INAMHI's
centroid (0.1–0.2 km apart for five, 3.6 km for Mazar, 4.2 km for Delsitanisagua). So neither
open question above changes which rain is sampled. Areas and pour points, with their evidence,
are in each row's notes and in the report.

**What is still open.**
- ~~**ERA5 history at the seven new points.**~~ **Done 2026-09-24** (covariates run
  36009328405, dispatched on `main` at 13:57 UTC with `from: 1990-01-01`, 320 requests): all
  eight basin rows now hold 13,410 ERA5 days, 1990-01-01 → 2026-09-18.
- **What that did to the Mazar models, measured the same day.** `selectPrecipBasin` moves the
  narrative and M4 onto `paute_mazar` on the first run that sees the history. M4's snapshot was
  scored on `paute`, so the forecast falls back to M3 at seven days and — because the reason
  matches `model-and-push.sh`'s rule — the daily job reruns `backtest:m4` by itself. Run here
  first, on the new basin: M3-residual, the shipped design, still has the lower MAE at seven
  days (2.03 against M3's 2.29 m, paired interval below zero) but its p10–p90 now covers 73.1%
  of outcomes against M3's 74.2%, so under the ladder rule (lower MAE *and* a band no worse
  calibrated) **it no longer wins, and the next forecast publishes M3 at seven days.** The
  direct design wins at both 7 and 14 days on the new basin (MAE 1.94 and 3.29 m, coverage 78.5%
  and 80.6%, the 7-day interval below zero). Changing the shipped design is a decision for the
  owner (`RUNBOOK.md`, "M4 fallback"), not something a run should do on its own. §5.4's rain
  experiment, rerun at the centroid, is still negative (14-day MAE 3.93 m against 3.62).
- **A centroid is still one point.** Area-weighted ERA5 cells over each outline in
  `catchments.geojson` would be the true basin mean; it waits on a backtest showing it matters.
  Seasonal ensembles remain deferred.
- The HydroSHEDS egress test below is no longer needed for this.


Original phase scope:
Open-Meteo ERA5 daily precipitation per basin from 2022 (and 1990→ for climatology), 16-day
forecast daily, ONI monthly; `plants.csv`, `thresholds.csv`, `rationing_episodes.csv`,
`basins.csv` verified; freshness and range checks in CI; `api/status.json`.

**Phase 5 · Modelling v1 — done 2026-09-22**
Delivered: `src/lib/features/{series,hydrology,enso}.ts`, `src/lib/models/{baselines,water-balance,backtest,forecast,report}.ts`,
`scripts/forecast.ts` (`npm run forecast`), the `forecast_runs` / `forecast_values` tables,
`public/api/forecast.json`, `data/reports/backtest.md`, and 126 new tests. The forecast runs in
CI on every push (`--dry-run`, ~20 s, no network) and after each daily ingest, on the day that
has just landed rather than yesterday's.

**§7's method ladder was run as written, and it does not say what §7 expected.** 105 monthly
origins from 2018-01, every model refitted from scratch at each one, all scored on the origins
they all reached. MAE in metres, and skill against persistence:

| | h=7 | h=14 | h=30 | h=60 | h=90 |
|---|---|---|---|---|---|
| M0 persistence | 2.29 | 3.57 | 5.86 | 9.60 | 11.21 |
| M1 climatological drift | 2.35 (−2.4%) | 3.78 (−5.8%) | 6.21 (−6.1%) | 9.63 (−0.3%) | 11.22 (−0.1%) |
| M2 seasonal anomaly decay | 2.52 (−10.0%) | 4.08 (−14.1%) | 6.19 (−5.8%) | 7.45 (+22.4%) | 7.56 (+32.5%) |
| M3 water balance | 2.29 (−0.1%) | 3.62 (−1.2%) | 5.85 (+0.1%) | 7.25 (**+24.5%**) | 7.30 (**+34.8%**) |

- **M1 loses at every horizon**, which is the ladder's first real finding. §7 assumed day-of-year
  drift would improve on persistence; it does not, because a reservoir level is the running total
  of an operating decision and last week's decision predicts next week's better than the average
  of six Septembers does. Not kept.
- **M2 is kept in the report, not shipped.** It beats persistence at 60 and 90 days but loses to
  M3 at all five horizons.
- **M3 as §7 specified it is the *worst* rung on the ladder** — turbined flow from generation,
  release otherwise held where it recently was. Open-loop it scores −25% at a week and −69% at
  ninety days, because a simulated reservoir that never reacts either fills until it spills or
  empties until it is dry. The fix is to model the operator: the implied release climbs from
  about 12 m³/s near 2110 to about 106 m³/s near the crest, so release is fitted as a rule curve
  against level and read back on every simulated day. That single change is the whole difference
  between the worst rung and the only one worth shipping.

**The reservoir's physics were recovered from this repository's own data, because nobody
publishes them.** `A(level) = a·(level − datum)^b` and the turbine's m³/s-per-MW are fitted
together off the daily balance, weighted so the residual is in metres rather than cubic metres.
`datum` and `b` are not separately identified — across datums 1906→2096 and exponents 0.5→6 the
fit residual moves by 0.001 m — but the *curve* is: area 2.2 km² at 2110 rising to 6.6 km² at
2150, and 208 hm³ between 2100 and 2153. Two independent checks. `repDiaPotQTurb`'s 113 days of
turbined flow max out near 129 m³/s against the fitted 114 m³/s at 170 MW, which agrees. The
unverified 410 hm³ in `plants.csv` does not, and cannot be adopted: `a` and `k` are fitted
jointly, so doubling the area drives the flow-per-MW through zero — a turbine consuming no
water. The balance closes at one scale.

**The published band is not the ensemble, and the gap is the point.** The analogue-inflow
ensemble covers only 51–61% of outcomes inside its own p10–p90 against a nominal 80%, because it
knows what the weather might do and nothing about the rule curve being an average of several
operating regimes. Widening by the model's own out-of-sample residuals at each horizon brings
coverage to 72–80%. Calibration is expanding-window: each origin's band uses only origins
strictly before it, and the first twelve carry no band at all rather than borrowing one from
the future.

**The crisis check is the deliverable's least flattering number and is published as it stands.**
Mazar fell to or below the plan's 2115 in two 2024 spells, from 2024-04-11 and from 2024-10-08.
On the P50 §7 asks about, **the model called neither in advance.** April is a clean miss at every
quantile — not one analogue year reached the level, because April is reliably wet in the Paute
and April 2024 was not, and an analogue method cannot draw a year it has never seen. October is
different and more useful: seven days out, the *dry tail* of the ensemble put the crossing 8.5
days away against an actual 7, while the median put it 52 days late. The information was in the
forecast and reading only the P50 discarded it, so `forecast.json` publishes the whole censored
crossing distribution — how many analogue years cross and at which quantiles — alongside the
three named scenarios. False alarms are reported too (1 in 105 origins at the P50); a lead time
without that number is meaningless.

**Three things were measured and rejected rather than argued about.** Conditioning the analogue
years on ENSO phase (using the phase a forecaster could actually have read, two months stale) is
worse at every horizon and can only forecast at 60 of 105 origins, because narrowing a pool of
a dozen members starves it. Correcting the median by its own trailing residual is worse at every
horizon — the bias is a handful of 2024 origins, not a stable offset. And the quiet-day area
estimate, which looked like a clean direct measurement, is high by about 1.7× because Mazar
releases substantially even when generating little: it regulates for Molino downstream.

**Two defects the tests found, both in code written this phase.** `trimReleases` computed its
cut from value-based quantiles of the same sample, so at a hundred readings the p1/p99 bounds
were satisfied by the very outliers they were meant to remove; it now trims by rank. And
`analogPaths` built an analogue date as `${year}-${monthDay}` without checking it exists —
`Date.parse("2021-02-29T00:00:00Z")` does not fail, it silently returns 1 March — so a
29 February origin would have compared against the wrong day once every four years.
`isCalendarDate` now guards it.

**M4 was run after all (2026-09-22), and it earns seven days only.** There is no
gradient-boosting library in a TypeScript-only stack, so one was written: `src/lib/models/gbm.ts`,
dependency-free — histogram splits, depth-3 trees, shrinkage, subsampling, pinball loss, seeded.
Three designs were scored on the same 105 origins, harness, band calibration and crisis check as
M0–M3: the level change directly, directly with M3's forecast as a feature, and M3's residual.
Every feature is read as a forecaster could have had it — ONI two months stale, ERA5 at the one
provisional Paute point lagged five days, M3 recomputed as it would have been made on each
training day (identical to the shipped M3 at all 105 origins).

| MAE, m (skill vs M0) | h=7 | h=14 | h=30 | h=60 | h=90 |
|---|---|---|---|---|---|
| M3 water balance | 2.29 (−0.1%) | 3.62 (−1.2%) | 5.85 (+0.1%) | 7.25 (+24.5%) | 7.30 (+34.8%) |
| M4 direct | 2.02 (+11.9%) | 3.32 (+7.0%) | 5.49 (+6.3%) | 8.16 (+15.0%) | 8.75 (+21.9%) |
| M4 M3-residual | 2.03 (+11.2%) | 3.46 (+3.1%) | 5.81 (+0.8%) | 8.28 (+13.8%) | 8.34 (+25.6%) |

At seven days every design beats M3 — the first rung on this ladder to beat persistence at a
week — and for two of them the paired 90% interval on the error difference lies wholly below
zero. At 14 and 30 days the gains are within noise or come with a worse band; at 60 and 90 every
design is 0.8–1.6 m worse than M3, with an interval wholly above zero, and its own quantiles cover
only 36–50%. On the crisis check no median called either 2024 crossing; the direct designs' p10
called April ten days out from 1.7 m above the line, which M3 missed at every quantile, and one of
them then missed October; each design raised one false alarm (2023-11-01). Under the ladder's
rule M4 is kept for seven days only.

**Adopted the same day, at seven days only.** `forecast.json` publishes `M4-gbm-m3-residual`'s
median at 7 days and M3 at 14–90 days, for the three named scenarios and for days-to-threshold,
which need the daily simulated path only M3 produces. The daily run fits that one design at the
live origin — three boosted fits, ~5 s — with exactly the settings and features the snapshot was
scored with, and refuses to publish if they differ. The band is the median widened by the model's
own residual quantiles at 7 days over the 105 origins (q10 −3.45 m, q90 +2.68 m), clamped to
contain the median as M3's is. The entry names its model, its band's source and the backtest it
rests on (MAE 2.03 vs 2.29 m, paired interval [−0.45, −0.07]) and carries M3's figure beside it;
`horizon_switch` says whether the switch was made and why; `forecast_values` gained a `model_id`
column; the model version is 2; the fan chart marks the 7-day point as another model's. When the
ladder gains an origin the snapshot lacks, seven days falls back to M3 — and the daily modelling
step, seeing that as the only reason, reruns `npm run backtest:m4` (~6.5 min, once a month) and
forecasts again. Any other fallback reason is left for a person to read. The CI dry-run went from
22.5 s to 27.3 s. Target 1 (probabilistic Mazar cota) and target 2 (days to threshold)
ship here; target 3 shipped in Phase 6c, and target 4 — national hydro generation a week out —
ships as that model's hydro term at seven days, which since 2026-09-22 carries a calibrated
p10–p90 of its own (`hydro_p10`/`hydro_p90` in `adequacy.json`). It beats a trailing 28-day mean
by 9% at seven days and its band covers 71% of outcomes against a nominal 80%, the same
shortfall as the requirement band. The backtest window is 2018-01 onward as §7 specifies, which is wider than the
2023-09→2024-12 this phase entry originally asked for. **2115 is this project's own number**:
`thresholds.csv` carries 2098 from the dashboard chart title and 2100 from both report
endpoints, and no upstream source publishes 2115 at all. It is forecast against because §7 asks
for it and labelled `unverified` everywhere it appears.

**Phase 6 · Site and JSON API — built and deployed 2026-09-22**
Delivered as specified apart from one tile, and the exception is the point of the entry.

`public/api/latest.json` is the third public document, beside `status.json` and `forecast.json`:
per reservoir the level, every declared band with the position inside it, the 7/14/30-day slopes
and the inflow against its own day-of-year climatology; plus the latest closed day's supply mix.
Ten kilobytes, a pure function of the committed tables, regenerated by `apply-and-push.sh` in the
same loop that writes the status document — so a run that lands rows can never leave the page
describing yesterday.

The site is a Next.js static export (`output: "export"`), server-rendered at build time from
`data/curated` and `public/api`, and it **needs no JavaScript to read**: every number, chart and
table is in the HTML. The only scripts it ships are Next's runtime and the Vercel Analytics
beacon. Charts are inline SVG whose geometry comes from pure functions in `src/lib/chart` with their own tests, because a wrong
stacked band looks entirely plausible on screen. The bulk series the charts need are read
straight from the CSVs rather than committed as a second copy: a 150 kB JSON rewritten daily
would add ~55 MB a year to the history to say what `data/curated` already says.

Four decisions came out of drawing it, and each is a case where the data disagrees with itself:

- **Mazar's gauge spans 2098–2153 while its percentage names 2100–2153.** Scaled to the
  best-evidenced band, the dashboard's floor falls off the end of its own axis, and the one
  reservoir whose disagreement this plan keeps citing would be the one showing a single floor.
  The bar measures metres on the axis its end labels give; the percentage names the declaration
  it was computed against. Two statements, neither promoted.
- **Colliding threshold labels move, they do not drop.** 2100 and 2098 are ten pixels apart on
  the fan chart; the lower label now sits under its own rule.
- **The x axis is days, not readings.** Spacing readings evenly closes every hole in the record
  silently. The inflow line and the mix area break where the source never published.
- **`bandsFor` orders declarations by how long each was observed**, which is a claim about
  evidence and not about correctness: `repDiaHid12m` restated its band on 4,384 days, the chart
  title says its own once.

**The adequacy tile was the one thing §6 asked for and Phase 6 did not build, and it is built
now — see Phase 6c below.** What the balance section shows remains the observed split of the
closed day's supply, labelled as description rather than forecast; the forecast is the section
after it, and it carries its own skill scores and its own negatives.

The site is deployed: a Vercel project was connected to this repository on 2026-09-22, outside
the sandbox, which cannot reach Vercel. `npm run build` produces `out/`, which any static host
serves, so nothing about the deployment target is load-bearing.

**Phase 6c · Energy adequacy — §7 target 3 — done 2026-09-22**
The identity is one line and every term in it is either forecast with a backtest below it or an
explicit input in `data/reference/adequacy_assumptions.csv`:

```
deficit(h) = unsuppressed demand(h) − hydro(h) − thermal − imports − other
```

`npm run adequacy` writes `public/api/adequacy.json` and `data/reports/adequacy.md`, commits
`adequacy_runs` and `adequacy_values`, and the site's tile reads the first. `latest.json` copies
the tier rather than recomputing it, so the page's headline and the document can never disagree.
The risk tier is now available as the *input* Phase 6b's decision 8 requires the narrative model
to be handed rather than allowed to choose.

Four things in it are decisions, and three are cases where the obvious quantity is wrong:

- **Demand is served load, not `demanda_distribucion`.** The distribution utilities' metering is
  89–97% of what generators plus interconnections delivered, the gap being transmission losses
  and consumers buying outside them — 3 to 11 GWh a day, more than the whole Colombian
  interconnection. Asking whether supply covers `demanda_distribucion` is asking the wrong
  question by about one Colombia.
- **Demand is unsuppressed.** Fitted on days outside the episodes in `rationing_episodes.csv`
  plus a fortnight's recovery tail, and anchored to the last fourteen of them. Without the
  anchor a four-year trend sits two or three GWh from where demand is today and loses to a
  trailing mean by 70%; with it, the two are level.
- **Hydro is normalised by the fitted demand trend, not by measured load.** Normalising by
  measured load fixes the growth and breaks the crisis — during rationing hydro and load fall
  together, so the ratio holds up and projecting it against unsuppressed demand would have
  claimed 48 GWh of hydro for November 2024 against the 34 that was generated. The fitted trend
  knows nothing about the drought, so it removes the growth and leaves the drought in.
- **§7's inflow link is a recorded negative.** The section specifies fleet hydro energy "from
  levels, inflows and plant limits". National hydro energy against the sum of this repository's
  measured inflows is r = 0.27 daily and r = 0.47 on 30-day means, and the implied conversion
  drifts from 0.090 GWh per m³/s in 2016 to 0.165 in 2026. The measured basins are all Amazon
  slope; Daule-Peripa, Pucará, San Francisco, Toachi-Pilatón and the private fleet are not
  measured here, and the Pacific slope runs in the opposite phase. Five hydro rungs built on
  analogue inflow years or on raw climatology all lost to a trailing 28-day mean, by 65% to
  158%, every one of them biased 5 to 13 GWh/day low on fleet growth. Including the rung that
  matched analogue years on Mazar's level — the one that would have tied this to Phase 5.

**The data-quality finding that came out of building it.** `parse/smec.ts` rejects a page served
before its metering arrived by requiring distribution demand to be ≥ 20% of generation, and that
gate is one-sided: it catches a page whose *demand* has not landed and passes one whose
*generation* has not. 2018-01-05 carries 4.19 GWh of national generation against 62.72 GWh of
demand — a 94% collapse of exactly the shape this project exists to detect — and sails through,
because 62.72/4.19 is 15. The symmetric test is arithmetic: served load is distribution demand
plus losses plus unregulated demand, both positive, so a day whose generation plus net imports
falls below its own distribution demand is a page caught mid-render. 55 days, about 1.5% of the
record — the denominator grows every morning, so the live count lives in the regenerated
`data/reports/adequacy.md` rather than here. The same
ratio catches the opposite fault at the top — 2025-07-17 and -18, where CENACE published
`generación de otros tipos` at 153.62 and 113.19 GWh against a fortnight's median of 2.2, flagged
in its own `pct_dia` column at +6,284%. Both are now counted by `checkNationalBalance` and
excluded by `features/balance.ts`; neither row is deleted.

**What it was measured at.** 99 monthly origins from 2018-07. The net requirement (demand minus
hydro), which is the quantity the band is calibrated on and the one the deficit is a fixed shift
of, beats a trailing 28-day mean by 12.4% at 7 days, 6.5% at 30 and 11.4% at 90. The hydro term
alone is 9% at 7 days and level at 30 — the weak term, and the report says so. Band coverage is
60–67% against a nominal 80%, so the p10–p90 is documented as roughly a two-thirds interval.

**The check that makes it worth publishing.** A deficit is a counterfactual and no meter records
it, but during an episode it has an observable shadow: the gap between the demand the model says
the country wanted and the load the meters recorded. Over the 89 days of the 2024-09-23 →
2024-12-20 episode that gap is 20.3 GWh/day and the computed deficit is 17.0 — two numbers from
different sides of the identity, agreeing within 3.3. The two short 2023 and April-2024 episodes
do *not* agree: the model sees no deficit where there were cuts, and both of those episodes have
end dates recorded to the month, from press reporting, in a table marked `unverified`.

**Revised 2026-09-24, after the episode table was checked (§8a, gap 4).** The seed's April 2024
end, 2024-05-31, was a month late: cuts stopped after 2024-04-30, and the extra May days had been
counted as suppressed. With the checked dates the April episode shows 14.0 GWh/day of measured
suppression and an implied deficit of **7.3 GWh/day** instead of −2.6, so the model now sees a
deficit where there were cuts. 2023 moves from −1.3 to +0.3 (short cuts of 2–4 h a day), and the
long 2024 episode is essentially unchanged (17.2 against 20.5 measured). The demand fit gains 45
days and every backtest skill score improves slightly (net requirement at 7 days: 12.4% → 14.4%).
The tier record is unchanged (3 of 99 flagged, all three before cuts). The 30-day tier on
2026-09-22 moves from vigilancia to ajustado, at a margin of −0.08% against +0.12% before, so it
is a borderline case, not a new finding.

Applied to every monthly origin at a 30-day horizon, the tiers flag 3 of 99 and all three precede
cuts; 6 of the 9 origins that precede cuts go unflagged. It does not cry wolf and it misses most
of the wolves, which is the shape to expect when the weakest term is the one deciding how much
water there is. Three episodes is not a sample a threshold can be fitted to, and none was.

**Imports are the fragile assumption, and not hypothetically.** Between 2024-10-01 and
2024-11-10, with Ecuador rationing 14 h/day, imports from Colombia ran at 0.12 GWh/day against
the 10.78 they had reached that August, because Colombia was short of water at the same time.
Imports were also below 1 GWh/day for 398 consecutive days from 2019-07-06. Every horizon
therefore publishes a stressed deficit beside the central one.

**Phase 6b · AI narrative panel via Vercel AI Gateway — built 2026-09-22, live 2026-09-23; seven-day count running**
`npm run narrative` builds a deterministic payload (≈9 kB of canonical JSON, sha256-hashed) only
from what the repository already publishes: per reservoir the level, bands and slopes from
`latest.json`, days to each floor at the 7- and 30-day slopes (a division, labelled as one), the
same calendar day in every earlier year, and the 16-day Paute rain forecast against ERA5 for the
same window — from the one provisional point, labelled so; Mazar's p10/p50/p90 and crossings from
`forecast.json` with 2115 carried as `unverified`; the adequacy tier as an input; ONI at the lag a
forecaster could have read it. `claude-opus-5.5` through the gateway returns `{outlook_es, drivers,
confidence}`, and a validator rejects any output naming a number or date not in the payload, or
not naming the tier. A 429 is retried once then recorded `skipped`; every attempt appends a
`narrative_snapshots` row with tokens and `cost_usd`; an unchanged hash and prompt version is a
no-op. The daily job runs it last with `continue-on-error`, calling the gateway once and
retrying only the cheap apply. The page shows the text beside the numbers it was written from.
The key was added to the Actions secrets on 2026-09-23. The first live call
([run 35808200400](https://github.com/rengarcia/hydro-look/actions/runs/35808200400)) authenticated
but was refused: `anthropic/claude-opus-5` is not available to a free-tier gateway account. The
free tier's `xiaomi/mimo-v2.6-flash` was tried three times the same night and never published:
the first answer failed the schema, the second ran out of output tokens with JSON field names in
its prose, and the third — readable Spanish at $0.0009 — misspelled a month twice ("octiembre"),
which the validator caught only because it stopped reading "21 de octiembre" as a date. Those runs
added the raw-answer capture, the field-name check and prompt `es-3`. Gateway credits were then
added; `claude-opus-5` wrote the first `ok` narrative (run 35810691729), and the model is now
`claude-opus-5.5`. A change of model earns a new call on unchanged data, as a new prompt does. The acceptance criterion — seven consecutive daily narratives — starts counting at the
first `ok` snapshot.

Original phase text, for reference:
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

**Colombia's side of the interconnection, via XM — ingested 2026-09-22.** Recon (run
35768453442, `RECON_REPORT.md` §10a) confirmed the contract of XM's official client — POST
`/hourly` and `/daily` on `servapibi.xm.com.co`, at most a calendar month per request, a
`ListadoMetricas` inventory, a plain-text 400 for an unknown metric — and found the two circuits,
**ECUADOR 230 and ECUADOR 138**. `ingest xm` writes `xm_exchange_daily` (both directions per link
per day) and `xm_system_daily` (Colombian storage, capacity, inflows against their historical
mean, demand, spot and scarcity prices), from its own step in `covariates.yml`.

- **A blank exchange hour is flow the other way, not a missing reading.** XM publishes one net
  direction per hour: no hour is ever published both ways, on ECUADOR 230 the two directions
  together cover the day, and zeros are never written. So a link-day is stored when either
  direction published, and an hour published both ways is refused rather than summed.
- **It agrees with SMEC at offset zero and at no other** (r > 0.999 on net flow, 2024-08→12; a
  test). SMEC reads 0.991× on high-flow days, consistent with line losses; on low-flow days both
  of SMEC's gross directions exceed XM's by ~100 MWh while the nets match, so the comparison is
  net against net.
- **It reproduces the 2024 cutoff** — 9.07 → 0.175 GWh/day on the 230 kV circuit, August →
  October — **and it is happening again.** Imports ran 7.5–8.5 GWh/day through late August 2026,
  fell to 3.5 on 2026-09-06 and have been 0.12–0.17 GWh/day every day since 2026-09-07 (SMEC and
  XM agree). The adequacy model's central case still assumes the demonstrated 10.78; its stressed
  case, 0.12, was simply what was happening. **Decided 2026-09-22: the central case now stops
  assuming the interconnection when imports stop while thermal works hard** — a fortnight below
  1 GWh/day with thermal at 70% or more of its ceiling. Low imports alone would not do: they
  preceded 68 of 99 monthly origins since 2018, mostly wet months when Ecuador had no use for
  them. With the thermal condition the rule picks out 4 (2024-05, 2024-11, 2026-04, 2026-05), the
  same 4 at any share from 60% to 75%, and leaves the tier record untouched. XM says this stop is
  not Colombian scarcity (storage 79%, spot under the scarcity threshold), so the cause is outside
  this data. Live, the 7-day tier moves from **holgado to vigilancia** (margin 1.7%) and 60–90 days
  reach **ajustado** (central deficit 0.5–0.8 GWh/day), holding the cut for the horizon.
  `adequacy.json` carries the regime and its reason under `assumptions.import_regime`.
- Publication lags measured on the capture: storage and inflows 1 day, demand 2, exchanges and
  prices 3, TIE settlement 5. Colombian storage fell to 49% of useful volume in September 2024
  with inflows at 58% of their mean: the state that explains a cutoff before the border shows it.

**The history is in, back to SMEC's first day, and it agrees with SMEC across all of it.** The
backfill (covariates run 35770747799) asked every month from 2016-05-01: XM answered all of them,
and eight of the nine system series are complete from that first day (3,794–3,796 days each). The
scarcity activation price begins 2017-12-01, which is when CREG Resolution 140 of 2017 created it —
a start date, not a gap. Over the full overlap, net flow on the two Ecuador circuits agrees with
SMEC's net Colombian imports on **3,772 days at r = 0.99996, mean absolute difference 13 MWh/day,
no day off by more than 1 GWh**; a one-day shift drops r to 0.92. Two sides of one border, metered
by two operators in two countries, agree on the numbers and the dates for a decade.

**That run also found a defect of ours.** It lost twenty months of Ecuador exchange rows, 2016-12
to 2018-11: the both-directions check ran on every link in XM's answer, and the Venezuela link,
CUATRICENTENARIO 1, does publish hours both ways in those years. It is neither stored nor what the
rule is about; the check is now confined to the Ecuador circuits, March 2017's real answer is a
regression test, and replaying all 125 archived months parses every one. Covariates run
35775149361 refetched the twenty months, and ECUADOR 230 now has a row for 3,788 of the 3,794
days to 2026-09-19. The six without one (2024-04-20→22 and 25→27) are real zeros: XM never writes
a zero, and CENACE shows nothing crossing either way those days, the week Colombia suspended
exports. A `--from` run will re-ask that month each time, which costs eleven requests and nothing
else.

**Streamflow return periods from INAMHI–GEOGLOWS — planned and built 2026-09-25.** Asked for
by the owner: use the return periods INAMHI publishes through `inamhi.geoglows.org` (§2.8). They
answer a question the site had no way to ask — *how big is this flow for this river?* — which
the climatology band cannot, because a band says what is usual for the date, not how rare a
flood is.

*The plan, as built:*

1. **Read the model's numbers at their source.** The portal has no API and the sandbox cannot
   open it; the store behind it is public. `npm run geoglows` (`scripts/geoglows.ts`) reads the
   two GEOGLOWS tables by Parquet range request (only the columns needed, via `hyparquet`) and
   the Zarr store chunk by chunk; `src/lib/geo/blosc.ts` decodes Blosc-LZ4/Zstd without a
   native dependency and refuses what it does not implement (bit-shuffle, delta).
2. **Match each dam to its river by drainage area, against the delineation this repository
   already checked.** The pour points and catchment areas are `data/reports/catchments.json`'s
   (Phase 4). GEOGLOWS' flow is at a segment's outlet, so the segment chosen is the one whose
   downstream drainage area is closest to the catchment, among those whose reach can hold the
   pour point (its point within half its length + 2 km), and only within ±10%. Nearest-segment
   would be wrong: at Coca Codo Sinclair the nearest segment is above the Salado confluence and
   drains 26% less than the dam does. All seven delineated dams match within ±1.4%, two
   independent 90 m delineations (TDX-Hydro and Copernicus GLO-90) agreeing.
3. **Put the same statistic from CELEC's record beside it,** rather than read observed inflow
   against the model's thresholds unexamined: annual maxima of the daily inflow over calendar
   years with ≥ 330 readings, the same method-of-moments Gumbel, fitted only with ≥ 5 years.
   The daily-fit GEOGLOWS values are the ones compared, because CELEC's inflow is a daily mean;
   the hourly ones (the Hydroviewer's) are kept alongside.
4. **Publish both, choose neither.** `latest.json` carries `inflow.return_periods` per reservoir
   (`geoglows` and `measured`, each with the longest return period today's inflow reaches), its
   schema documents it, and each reservoir page has a panel with both columns and a sentence on
   how far apart they are.
5. **Re-run on a revision, not daily.** The store is revised about once a year; the
   `geoglows` phase of `probe-basins.yml` re-runs it from a runner and commits the outputs.

*What it found* (`data/reports/return-periods.md`). The model and the record agree at the two
dams with the longest or largest records: **Mazar** 2-year flood 615 m³/s against
583 measured (1.06×; 15 years), **Coca Codo Sinclair** 1,225 against 1,274 (0.96×; 9 years).
They do not agree elsewhere: **Agoyán** 1.26×, **Minas San Francisco** 1.67×, **Manduriacu**
2.33×, **Delsitanisagua** 0.71×. So at four dams the model's thresholds, applied to CELEC's
inflow, would misstate how rare a flood is, and the page says which way. Two of those gaps
may be on the measured side rather than the model's: Manduriacu's annual maxima are 640–834 m³/s
in all eight years — flat, like a ceiling — and Agoyán's are round numbers (750, 750, 1,000).
Whether the historian's inflow saturates at high flow is not established.

*Open:*

- **The portal itself.** A runner's request to `inamhi.geoglows.org` settles whether INAMHI shows
  GEOGLOWS' values unchanged (compare the archived page's endpoints with §2.8) or its own; if
  its own, the loader reads them and they replace, not join, the `geoglows` column.
- **Amaluza and Sopladora** have inflow but no delineated pour point, so no river; Amaluza's
  record already gives a measured fit (11 years). Both need a `catchments.ts` entry first.
- **Forecast flow against the thresholds** — what the Hydroviewer actually colours — needs
  GEOGLOWS' forecast service (`geoglows.ecmwf.int`), which the sandbox cannot reach either. It
  is the natural next step, and it would first need a backtest against CELEC inflow like §5.3's.
- **Manduriacu's and Agoyán's high-flow readings**, above.

**Candidate list, 2026-09-23:** `ENHANCEMENTS.md` ranks what to do next across the pipeline,
the public data contract, the site and the models, with the measurement each item rests on
(pack growth per run, shipped JavaScript, unused tables, unscored forecasts). It is the working
list for this phase; the paragraph below is the older one and is kept for the record.

**`ENHANCEMENTS.md` implemented, 2026-09-23.** Everything on the list that can be done from the
repository is done; its head now carries a per-item status. In brief:

- **Store and pipeline.** The raw archive is plain NDJSON, one file per source-endpoint-day
  (`<source>/<YYYY>/<MM>/<endpoint>.<date>.ndjson`), written once; 2,188 gzip bundles became
  17,441 files, every `raw_ref` was rewritten and resolves, and `npm run check` fails one that
  does not. Pack growth per daily run, replayed on the real 2026-09-23 commits: −4 to +13 KiB
  against +60 to +116 KiB before. The cost is a working tree of 255 MB rather than 24. A batch is
  uploaded as an artifact before anything applies it; a failed pin, a timeout or a bad row now
  costs its own source or its own rows (quarantined under `data/quarantine/`), not the run; only
  the apply job holds the `ingest` group and the push token; a run that found nothing commits
  nothing. Crons moved to odd minutes (12:47, 16:53, 17:23 UTC), and `freshness.yml` reports a
  slot that never fired.
- **Public contract.** Every `public/api` document carries `schema_version`, `data_date`,
  licence, attribution and absolute `see_also`, and is validated against a JSON Schema in
  `public/api/schema/`; feed ids and tiers have English codes beside the Spanish labels; CORS is
  open on `/api/`. `/datos/` documents it.
- **Site.** Pages for all eight reservoirs, daily permalinks under `/dia/`, embeddable cards, an
  Atom feed, share images, real tables and a data table under every chart. The "no client
  JavaScript" claim was corrected rather than made true.
- **Models.** A live scorecard (`npm run score`) that reads published runs back; adequacy
  version 2 with its rules in `adequacy_rules.csv` and in the hash; the import sensitivity
  published; a calibrated band (coverage 67–81% against 60–67% before); inflow forecasts for
  Amaluza, Agoyán, Minas San Francisco and Delsitanisagua where they beat persistence and
  climatology. Recorded negatives: ERA5 rain with perfect foresight at the provisional point,
  ONI as a hydro covariate, the XM export-availability model (better on the 2026-09 stop, worse
  on 2024 at 7 days), a shared ensemble across horizons, and a level forecast for Amaluza.
- **Tooling.** Node 24, vitest 5, ESLint 10 with type-aware rules, zod 4, undici 8, coverage
  floors, Prettier and shellcheck in CI, Dependabot and SHA-pinned actions.

What the repository cannot do for itself: ~~the ERA5 backfill at the seven centroids~~ (done
2026-09-24, see Phase 4); whether M4's seven-day point moves to the direct design now that the
residual design no longer wins on `paute_mazar` (Phase 4, "What is still open"). TypeScript 7 waits on `typescript-eslint`, which does not yet accept it.

Still listed: ML v2 if it beats v1 in backtests; ARCONEL BNEE monthly loader; CENACE Datos Abiertos per-plant
validation; Colombia export availability via XM's open API — which Phase 6c has now made the
highest-value item on this list, because the import ceiling is the adequacy model's most fragile
term and XM publishes the other side of it; public-records request template to CENACE/CELEC for
the pre-2022 daily series; optional web.archive.org with keys.

---

## 7. Modelling plan

**Targets, in order**

1. `cota(Mazar, t+h)` for h ∈ {7, 14, 30, 60, 90} days, probabilistic. Later: Pisayambo, Minas San
   Francisco, Daule-Peripa if their levels become available.
2. Days until Mazar crosses 2115 (critical) and 2098 (min) under P10/P50/P90 inflow scenarios.
3. Energy adequacy: expected fleet hydro energy (from levels, inflows and plant limits) + available
   thermal + import capacity − unsuppressed demand → expected deficit GWh/day over the horizon; risk
   tiers derived from it. Thermal availability and import limits are explicit, editable inputs.
   **Done 2026-09-22 (Phase 6c), with one departure recorded rather than quietly made:** the hydro
   term is not built from levels and inflows, because the link is not in the data — national hydro
   energy correlates with this repository's measured inflows at r = 0.47 on 30-day means and the
   implied GWh per m³/s drifts 83% across the record, the measured basins all being Amazon slope
   while Daule-Peripa and the Pacific fleet are not measured at all. Five rungs built that way lost
   to a trailing 28-day mean. What ships instead is hydro normalised by the fitted unsuppressed
   demand trend, with a seasonal climatology and a mean-reverting anomaly. See
   `data/reports/adequacy.md`.
4. Nice-to-have: 7-day national hydro generation.
   **Shipped 2026-09-22** as the adequacy model's hydro term at seven days, with its own
   calibrated band; see Phase 5's closing paragraph and `data/reports/adequacy.md`.

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

**Run on 2026-09-22 (Phase 5); the ladder above is kept as written, and what follows is what it
measured.** M1 loses to M0 at every horizon — day-of-year drift is *worse* than doing nothing,
because a reservoir level is an operating decision rather than a seasonal signal. M2 beats M0 at
60 and 90 days but loses to M3 everywhere. M3 as specified here — release held where it recently
was — is the worst rung on the ladder (−69% at 90 days); it only works once release is fitted as
a **rule curve against level** and read back on every simulated day, which is the one substantive
departure from this section. M4 was later run on a boosted-tree learner written for
this repository: it beats M3 at seven days and loses at sixty and ninety (Phase 5 has the table),
so it is proposed for the 7-day median only and M3 still ships everywhere. The P50 crisis metric
this section specifies turned out to be the wrong statistic for the question — it called neither
2024 crossing, while the ensemble's dry tail called October seven days out — so the forecast
publishes the full censored crossing distribution rather than the median alone. Full numbers,
including the false-alarm rate a lead time is meaningless without, are in `data/reports/backtest.md`.

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
| Physical loss of a plant (Coca Codo Sinclair intake erosion, sediment) | Not prevented, but costed: `adequacy.json`'s `plant_outage` block and the site's "Una sola central" card give the deficit and tier with Coca Codo Sinclair out (§8a, gap 5). |

### 8a. Gaps found on review (2026-09-24)

Neither this plan nor the initial one covers the items below. Each names the evidence it rests on in
this repository, so an item can be closed or dropped on the same terms. Ordered by how much they
limit the risk indicator.

1. **Thermal availability is an assumption, not a measurement.** The adequacy identity's
   second-largest supply term is one number in `adequacy_assumptions.csv`: 25.83 GWh/day, the
   largest thermal day in three years, whose own basis says "no source this project reaches
   publishes planned outages". Thermal outages and maintenance were part of the 2024 crisis, and
   a demonstrated maximum says nothing about which units are down next month. No phase searches
   for a source. **To do:** look for CENACE's operation-planning publications (weekly and monthly
   programmes, maintenance schedules) and ARCONEL's effective-capacity table; if none is
   reachable, record that as a negative here, as §2.4 does for HydroSHEDS.
   *Leads, 2026-09-24 (web search only; nothing fetched):* CENACE coordinates maintenance through
   its two-year operation plan (*Plan Bianual de Operación*) and publishes an annual report
   (`Informe-Anual-CENACE-2024`, PDF on `www.cenace.gob.ec`), and in April 2024 an updated
   operation plan described the system as "degradada" — so planned outages exist on paper. No
   machine-readable schedule turned up. Next step: a probe from Actions that lists CENACE's
   `wp-content/uploads/downloads/` for operation-plan PDFs.

2. **The largest reservoirs are unobserved.** Daule-Peripa (Marcel Laniado, ≈5,400 hm³ —
   more than ten times Mazar's figure in `plants.csv`) and Pisayambo (Pucará, ≈100 hm³) have no
   entry in `mrids.csv`, and the Pacific slope is not measured at all. That is the stated reason
   the adequacy hydro term could not be built from inflows (§7, target 3: r = 0.47 on 30-day
   means). Target 1 defers them "if their levels become available", but no phase looks.
   **To do:** a source search for Hidronación (Daule-Peripa) and Hidroagoyán (Pisayambo) level
   reports, and for any CELEC business unit beyond CELEC Sur that exposes an ORDS or a report
   endpoint.
   *Leads, 2026-09-24:* Pisayambo's operating band is 3,541–3,565 masl (CELEC Hidroagoyán's
   Pucará page), and CENACE treats Mazar and Pisayambo as the two strategic reservoirs, with the
   level reported to it daily. Daule-Peripa's level appears only in press and in the Guayas
   provincial risk committee's statements (77–78.55 masl against an 85 masl normal maximum in
   2026); CELEC Hidronación publishes PDF operation reports, not a series. No public API found
   for either.

3. **The fleet is a static table.** `plants.csv` has no commissioning or retirement dates, and
   all twelve capacities are `unverified`. Meanwhile the adequacy report attributes a 5–13
   GWh/day low bias in five rejected hydro rungs to fleet growth, and the thermal ceiling has to
   skip 2016 because that fleet has since been retired. **To do:** a dated capacity table
   (`fleet_capacity.csv`: plant, technology, MW, from, to, source) covering hydro, thermal,
   non-conventional and emergency units, with the §3 capacities checked against ARCONEL's
   effective-power table at the same time.
   *Leads, 2026-09-24:* ARCONEL's annual statistics (`Estadistica2025.pdf`, March 2026) and its
   BNEE workbooks carry effective power per plant, and `arconel.gob.ec` answers GitHub runners
   (§2.5). Extracting the table needs a run from Actions; the sandbox cannot reach it.

4. **The validation labels are unverified.** *Done 2026-09-24:* every row now has sources, and
   three were added (see the Phase 6c revision and the note under §3's seed table). The dates
   were confirmed from search-engine listings of the articles, because the sandbox cannot open
   these hosts, and then checked against SMEC demand. The original text follows. Every row of `rationing_episodes.csv` is
   `unverified` with an empty `source_url`, and two end dates are known only to the month. Those
   rows decide which days count as unsuppressed demand (D10) and are the entire basis of the
   adequacy check in Phase 6c (3 of 99 origins flagged, 6 of 9 missed; the two short episodes'
   disagreement is attributed to exactly these dates). The table also has nothing after
   2025-01-01, while imports have been near zero since 2026-09-07 (Phase 7). **To do:** confirm
   each row against an official source (ministry or CENACE communiqués, the official gazette),
   fill `source_url` and `verified_on`, and add any 2025–2026 cuts. Small effort, large effect.

5. **Physical risks to the plants are outside the risk table.** *Scenario done 2026-09-24:*
   `src/lib/models/outage.ts` removes Coca Codo Sinclair's share of national hydro over the
   trailing 28 days (27.0% on 2026-09-22, 22.9 GWh/day) from the hydro forecast, keeps imports and
   thermal as in the central case, and publishes the result as `plant_outage` in `adequacy.json`
   and as a card on the site. At the 2026-09-22 origin it is a deficit of 21–23 GWh/day at every
   horizon (tier `deficit`), the size of the 2024 episode's measured suppression. The optional
   events table is not built. The original text follows. §8 covers the pipeline, not the
   supply. Coca Codo Sinclair produces about half of national hydro, and the regressive erosion of
   the Coca river since the 2020 collapse of the San Rafael falls has been advancing towards its
   intake; sediment also affects its compensation reservoir and Amaluza (siltation appears in §7
   only as a modelling pitfall). A forced outage there would be the next crisis, and nothing the
   indicator reads would anticipate it. **To do:** at minimum, a scenario in `adequacy.json` with
   Coca Codo Sinclair out, published beside the stressed-import case; optionally, a tracked
   reference table of reported erosion and sediment events.

6. **No one is named to act when the pipeline needs a person.** *Done 2026-09-24:* `RUNBOOK.md`
   names the owner and the notification route, and gives one entry per issue label and per
   condition that opens no issue (quarantine, narrative failures and spend, M4 fallback, a new
   rationing episode). Adding a second person is left to the owner. The original text follows. Failures open GitHub issues
   (Phase 7), and some outcomes are left "for a person to read" (an M4 fallback for any reason
   other than a new backtest origin), but the plan does not say who watches the issues, how fast,
   or what to do when gateway credits run out or a TLS pin changes. **To do:** a short runbook
   (`RUNBOOK.md`): owner, notification route, and one entry per issue label with the action it
   needs.

Smaller:

- **Demand has no holiday or temperature term.** The unsuppressed-demand fit in
  `models/adequacy.ts` is trend + weekday + day-of-year season. Ecuador's national holidays
  (Carnaval, Semana Santa, bridge days) move load, and SMEC's `tipo_dia` column may already mark
  them. Worth one backtest; the season window may already absorb the fixed-date ones.
  *Tried 2026-09-24, negative.* SMEC's `tipo_dia` marks 252 days `Festivo` (the observed
  holidays, bridge days included), so no calendar is needed to try it. Leaving them out of the
  demand fit and its anchor improves the demand term at every horizon (MAE 1.78 → 1.71 GWh/day
  at 7 days, 2.29 → 2.12 at 90) and the hydro term slightly, but the net requirement — the
  quantity the deficit and its band rest on — gets worse at 7, 30, 60 and 90 days (3.06 → 3.20
  at 7). Not adopted. A forward holiday factor would need the future calendar, which SMEC's
  column cannot give.
- **"Git is the database" has no size budget.** `data/` is 292 MB in the working tree after
  three days of history plus backfills (the raw archive is 17k+ plain NDJSON files). Per-run pack
  growth is small (Phase 7), but the plan sets no limit, no retention rule for the raw archive,
  and no trigger for moving it out (release assets, a separate data repository).
- **Skill is measured only against persistence.** No forecast is compared with an official
  projection (CENACE, the ministry). Where such projections are published, scoring against them
  is the comparison readers will make anyway.

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
