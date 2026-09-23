# hydro-look — upgrade and enhancement plan

**Written 2026-09-23** against `main` at 0522907. This is the candidate list for Phase 7 of
`PLAN.md`: what is worth doing next, why, and in what order. Each item states the evidence it
rests on, so an item whose evidence has gone stale can be dropped without argument. Effort is
in coding sessions (S = under one session, M = one to two, L = three or more).

The state it starts from: 402 tests, lint and typecheck green; 29 test files; the site builds
and deploys; every feed in `status.json` is `current`; no open issues or pull requests. The
tables hold 89,122 observation rows, 58,114 balance rows, 13,472 weather rows and 37,156 XM
rows. The pack is 27 MiB after 155 commits over two days.

---

## Implementation status (2026-09-23)

Implemented on branch `claude/enhancements-file-impl-3aje18`. Tests 402 → 642, all green with
typecheck, type-aware lint, Prettier, shellcheck, `npm run check` and the static build.

| § | State | Notes |
|---|---|---|
| 1.1 ERA5 at centroids | **code done; dispatch outstanding** | `selectPrecipBasin` switches narrative (prompt `es-5+paute_mazar`) and M4 to `paute_mazar` once it has ERA5 from Jan 1990 with ≥ 95% of days and ≤ 30 days' lag; until then `paute`, with the reason published. The backfill itself needs `covariates.yml` dispatched with `from = 1990-01-01` and a raised `max_requests` |
| 1.2 Phase 1's clock | done | Crons at 12:47 and 16:53 UTC (covariates 17:23); `freshness.yml` reports a slot that never fired |
| 1.3 Narrative spend | done | `narrative` block in `status.json` |
| 1.4 Documentation drift | done | README status table, PLAN Phase 7 |
| 2.1 Raw archive | done | NDJSON day files; 17,441 files from 2,188 bundles, every `raw_ref` rewritten and checked. Per-run pack growth −4 to +13 KiB (was +60 to +116). Working tree 255 MB (was 24); old bundles stay in history |
| 2.2 Staged batches | done | Uploaded before apply in all three workflows; `apply --in` in the README |
| 2.3 Partial failure | done | Pin check per host inside each source; raw flushed first; quarantine; atomic writes; `--days 3` |
| 2.4 Alerting | done | One issue per failure mode, auto-closed; `stale-feed`; row floors; step summaries; retries with jitter, `Retry-After` and a deadline. Narrative "latency" is the step's wall clock |
| 2.5 Concurrency | done | Only the apply job holds `ingest` |
| 2.6 No-op commits | done | |
| 2.7 Security | done, one part partial | SHA pins, Dependabot, `--ignore-scripts`, no token in fetch jobs, `env` in `recon.yml`, `tls-expiry.yml`. The narrative call still runs in the apply job beside the push token |
| 2.8 Idle workflows | done | `probe-ords.yml` weekly; dead push triggers removed |
| 3 Data contract | done | `schema_version`, `data_date` (`as_of` kept as a deprecated alias for one version), codes + Spanish labels, licence, `previous`/deltas, `vercel.json`, bulk `.csv.gz` at build time and a nightly Parquet release, `/datos/`, the narrative's tier named. The site URL (`https://hydro-look.vercel.app`, `HYDRO_LOOK_SITE_URL`) needs confirming |
| 4.1 JavaScript claim | done (corrected) | |
| 4.2 Sharing | done | OG image via `next/og`, icon, robots, sitemap, Spanish 404, print, fonts self-hosted |
| 4.3 Accessibility | done | Print leaves chart tables folded |
| 4.4 More pages | done | `/embalses/[site]/`, `/dia/`, "desde ayer", `/embed/`, `/feed.xml` |
| 4.5 Rendering weight | mostly done | `page.tsx` split, helpers deduplicated, inline styles 45 → 13 (all data-driven). The forecast fan and the 12-year record are still drawn twice: one SVG is illegible at phone width |
| 5.1 Scorecard | done | Nothing scored yet: the first published horizon falls due 2026-09-27 |
| 5.2 Versioning | done | Adequacy v2; rules in `adequacy_rules.csv` and in the hash; 2115 m in `thresholds.csv` as unverified |
| 5.3 Other plants | done | Inflow ships at 7 d for Amaluza and Agoyán, 7 and 14 d for Minas San Francisco and Delsitanisagua; Coca Codo Sinclair, Manduriacu and the Amaluza level forecast are recorded negatives |
| 5.4 Rain | negative so far | Perfect-foresight rain at `paute` is worse at every horizon; reruns at the centroid once its backfill lands |
| 5.5 Imports | done | Sensitivity published; band recalibrated (coverage 67–81% against 60–67%); the XM export model and ONI are recorded negatives |
| 5.6 Narrative | done | Structured drivers, 120–220 words and 3–5 drivers enforced, payload 9.6k → 6.8k chars, `npm run narrative:eval` |
| 5.7 Cheaper runs | done | forecast 34.5 s → 18.6 s on the old workload; a shared ensemble across horizons was worse and is not used |
| 5.8 Hourly energy | contract and parser | No table committed |
| 6.1 Versions | done except TypeScript 7 | vitest 5, ESLint 10, zod 4, undici 8, Node 24 (`.nvmrc`). `typescript-eslint` does not yet accept TS 7 |
| 6.2 Tests and checks | done | Client, TLS, sources, status, site, render and report tests; coverage floors; shellcheck; `recommendedTypeChecked`; Prettier |

---

## 0. Ranked summary

The twelve items that matter most, in the order to do them. Sections 1–7 carry the detail.

| # | Item | Why now | Effort |
|---|---|---|---|
| 1 | ERA5 history at the seven verified catchment centroids (§1.1) | Every model and the narrative still read one provisional point; this unblocks §5 entirely | S (dispatches) |
| 2 | Stop the raw archive from growing quadratically (§2.1) | Each run rewrites whole gzip bundles git cannot delta; the pack will pass 1 GB within a year | M |
| 3 | Don't lose a staged batch (§2.2) | A failed push or fetch after a 270-minute backfill discards everything it collected | S |
| 4 | Per-source TLS check and partial-failure isolation (§2.3) | One host down aborts every source in the daily run | S |
| 5 | A live scorecard of published forecasts (§5.1) | Nothing reads `forecast_values` or `adequacy_values` back; the site cannot say how last month's forecast did | M |
| 6 | Bump the adequacy model version and make rule changes bump it (§5.2) | Two runs with different outputs share version "1"; a scorecard would be corrupted | S |
| 7 | A public data contract: schema version, licence, stable ids, CORS (§3) | Third parties are the stated audience of `public/api/`; today nothing tells them what they can rely on | M |
| 8 | Alerting that covers every workflow and every silent failure mode (§2.4) | Only scheduled `daily.yml` failures open an issue; a feed returning zero rows is caught days later | S |
| 9 | Correct the "no client JavaScript" claim, or make it true (§4.1) | The export ships 584 KB of JS and a 222 KB inline payload; the README, PLAN and code comments say otherwise | S or L |
| 10 | Share previews, favicon, robots, sitemap, 404 (§4.2) | A WhatsApp or X link shows no preview today | S |
| 11 | Real tables and chart data tables for accessibility (§4.3) | Header rows are `aria-hidden`; charts have no text alternative beyond a date range | M |
| 12 | Pages for the other seven reservoirs (§4.4) | The data is already in `latest.json`; `Fleet.tsx` has the hook | M |

---

## 1. Close what is open

### 1.1 ERA5 at the verified centroids — the one Phase 4 step left

`basins.csv` has held seven verified centroids since 2026-09-23, but `weather_daily` holds only
the provisional `paute` point: 13,472 rows, every one of them `basin = paute`. The daily
`covariates.yml` run will start sampling the new rows, but the 1990→ climatology that the
narrative's percentiles and M4's features need does not exist for them.

- Dispatch `covariates.yml` with `from = 1990-01-01` until it reports no new basin-days. Seven
  basins × 37 years at the current 100-request budget is several dispatches; raise the budget
  for these runs.
- Then move the narrative and M4 off `paute` onto `paute_mazar` (a `basin` id change in
  `features/weather.ts` and `narrative/payload.ts`), record the switch as a prompt version and
  a features-hash change, and keep the `paute` rows as history rather than deleting them.
- Acceptance: `status.json` reports a freshness row per basin; the narrative stops labelling
  rain as "un solo punto provisional".

### 1.2 Phase 1's clock

The acceptance criterion is three consecutive green *scheduled* daily runs. The record so far:
two scheduled runs on 2026-09-22, at 16:58 and 19:47 UTC, against slots at 12:15 and 16:30.
The first slot of the day has not yet fired on time. GitHub delays cron on busy minutes, and
:15 and :30 are busy minutes.

- Move the crons to odd minutes (for example `47 12` and `53 16`) and record the change.
- Add a scheduled `check --freshness` job (§2.4) so a slot that never fires is reported by
  something other than a person looking.

### 1.3 The narrative's seven-day count

Five snapshot rows exist; the first `ok` was 2026-09-23. Nothing to build — but §5.6 lists what
to do with the rows once there are enough of them, and `status.json` should carry gateway spend
to date so the cost is visible without opening a CSV.

### 1.4 Documentation drift

`README.md` says the narrative panel is "still absent" and lists XM under "planned"; both are
live. `PLAN.md` §6 Phase 6 says the same. Fix the status table and Phase 6 paragraph in the same
change as any item above.

---

## 2. Pipeline robustness and operations

### 2.1 Raw archive growth (the one structural problem)

`store/archive.ts` keeps one gzip-9 bundle per source-month-endpoint and rewrites the whole
bundle whenever a key is added. Git cannot delta-compress gzip output, so every run stores a
fresh full copy of every bundle it touched. Measured: gzip blobs are already 16.7 MB of the
27 MB pack (61%); the operativa bundle is 344 KB after eleven snapshots and grows by ~31 KB
twice a day, so one month of it alone costs about 31 KB × (60 × 61 / 2) ≈ 57 MB of pack. The
ORDS daily bundles have the same shape at a smaller size.

Options, in order of preference:

1. **Uncompressed NDJSON, one file per source-endpoint-day** (or per run for operativa).
   Each blob is written once and never rewritten; git's own zlib compresses it about as well
   as gzip did. Monthly directories keep the tree navigable. Cost: more files (a few thousand a
   year), which git handles fine.
2. Uncompressed NDJSON monthly bundles, appended. Git delta-compresses the append, so each run
   costs its increment rather than the whole bundle. Fewer files, but a rewrite of a middle
   record still costs a delta.
3. Keep the layout and move `data/raw/` to Git LFS or to release assets. Solves size, loses the
   "raw response next to the row" property that the README promises.

Migration: a one-off script that unpacks the existing bundles into the new layout, keeps
`raw_ref` values resolvable (a `raw_ref` today names bundle + key; the new form names a file),
and a test that reads both forms. Acceptance: pack growth per daily run under 100 KB, measured
by `git count-objects` before and after a week of runs.

### 2.2 Never lose a staged batch

A batch lives only in `$RUNNER_TEMP` while `apply-and-push.sh` runs. Five rejected pushes, or
one failed `git fetch` under `set -e`, and everything a 270-minute backfill collected is gone;
the artifact step uploads only the logs.

- Upload `$BATCH_DIR` as an artifact *before* the apply step, in all three workflows.
- Add an `apply --in <artifact>` path to the README so a lost batch can be replayed by hand.
- Effort S.

### 2.3 Partial-failure isolation in the daily run

- `verifyPins` in `scripts/ingest.ts` has no try/catch; a timeout or handshake failure on SMEC
  aborts the run before ORDS or operativa are asked. Check the pin per source inside that
  source's own error handling, and record the failure in `batch.errors`.
- `validateRows` throws for the whole table on one bad row, so `writeBatch` stops midway with
  curated rows written and `archive.flush()` never run; the push step then commits rows whose
  `raw_ref` points at bundles that do not exist. Flush raw first, then curated; quarantine the
  failing rows into `data/quarantine/<table>/<run>.csv` with the reason, and fail the check
  gate on a non-empty quarantine rather than on the write.
- Writes go straight to the target with `writeFileSync`; write to a temp file and rename.
- `--days` defaults to 1 and the self-repair covers only the 12-month reports; a missed
  per-day report (`repDiaNivQIng`, `repDiaPotQTurb`, `repDiaRegAyer`, `repDiaVolAlm`) needs a
  manual backfill. Default the daily run to `--days 3`.

### 2.4 Alerting and observability

- Failure issues open only for scheduled `daily.yml`. Add the same step to `covariates.yml` and
  `backfill.yml`, close the issue automatically when a later run of the same workflow is green,
  and give the model step (`continue-on-error`) its own issue path — today a model failure is
  only visible once freshness trips three days later.
- A scheduled job that runs `check --freshness` against `main` a few hours after each slot and
  opens or updates one `stale-feed` issue. This also catches a cron slot that never fired
  (§1.2).
- Minimum expected row counts per endpoint in `registry.ts`: a 200 that parses to zero rows is
  accepted silently today (`sources/celec-ords.ts`).
- Write a `$GITHUB_STEP_SUMMARY` per run with rows added and updated per source, requests
  made, and errors. `status.json`'s `requests` field is never the real count; use
  `HttpClient.count` and count retries too.
- SMEC 500s are in `allowStatus`, so they are neither retried nor recorded as errors. Retry
  them; record the final one.
- Retry policy: add jitter, honour `Retry-After` on 429, and give each request an overall
  deadline (today up to 4 × 90 s). Archive non-200 bodies too — `daily.yml`'s comment says
  they are archived and they are not.
- Spend and latency for the narrative gateway call in the summary, from
  `narrative_snapshots`.

### 2.5 The `ingest` concurrency group

GitHub keeps at most one *pending* run per group. While a backfill holds the group for up to
340 minutes, the 12:15 daily run is cancelled by the 16:30 one, which is cancelled by
covariates at 17:00. `backfill.yml` documents this as a footgun and asks people to avoid the
minutes around the slots; that will not hold once backfills are routine again (§1.1).

Fetching needs no serialisation — only the write does, and `apply-and-push.sh` already
handles a rejected push by reset-and-reapply. Move `concurrency` from the workflow to the apply
step (a separate job with the group, receiving the batch as an artifact from §2.2), or drop
the group and rely on reset-and-reapply with a higher retry count. Effort S once §2.2 exists.

### 2.6 No-op commits

Every run commits, because `generated_at` changes in `data/latest/status.json` and
`public/api/status.json` even when no row did. Compare the document without `generated_at`
before writing, and skip the commit when nothing else changed. This also makes "did the run
find anything" answerable from `git log`.

### 2.7 Security hygiene

- Pin third-party actions by SHA and add `.github/dependabot.yml` for `github-actions` and
  `npm` (grouped, weekly), so the pins stay current.
- `npm ci --ignore-scripts` in every job that holds `contents: write`; the project's own
  dependencies need no install scripts.
- `actions/checkout` with `persist-credentials: false` in the fetch job; give only the apply
  job a token. The daily job today holds the push token and `AI_GATEWAY_API_KEY` in the same
  job that runs `npm ci`.
- `recon.yml` interpolates `${{ github.ref_name }}` straight into shell; pass it through `env`
  like the other workflows.
- A weekly job that reads `tls_pins.json`'s `not_after` (ORDS expires 2027-04-03 and nothing
  reads that field) and the committed CENACE intermediate, and opens an issue 30 days before
  expiry or on an advisory pin change.

### 2.8 Dead and idle workflows

`probe-ords.yml` still runs three times a day to map a "blank window" that `PLAN.md` records as
resolved, and its output goes only to a step summary. Either persist a per-run row to a small
table and check it, or reduce it to weekly. `probe-ords.yml` and `recon.yml` also carry push
triggers on branches that no longer exist.

---

## 3. The public data contract

`public/api/*.json` is described as "the stable public URLs a third party can fetch". Nothing
yet says what is stable.

- **Versioning.** Add `schema_version` to every document (the `model.version` fields are model
  versions, not format versions). Publish JSON Schema files under `public/api/schema/` and
  validate every document against them in `publish.test.ts`, so a shape change is a failing test.
- **Consistency.** `latest.json` and `status.json` use `as_of`; forecast, adequacy and narrative
  use `origin_date`. In `latest.json`, `as_of` is 2026-09-22 while every reading is dated
  2026-09-21. Pick one name and define it (the day the readings describe).
- **Stable ids.** Feed ids in `status.json` are English sentences that the site trims with a
  regex; enum values mix English (`"declaration": "report endpoint"`) and Spanish
  (`"tier": "vigilancia"`). Use English slugs as codes and carry Spanish labels beside them.
- **Provenance.** A `license` and `attribution` block (MIT code; CELEC and CENACE data;
  Open-Meteo CC BY 4.0; NOAA) and absolute `see_also` URLs, including `narrative.json`.
- **Deltas.** A `previous` (or `delta_1d`) per reservoir and for `national`, so a consumer can
  show "since yesterday" without downloading the CSVs.
- **Headers.** Vercel sends no `Access-Control-Allow-Origin` on a static export, so a browser
  on another origin cannot fetch these files. Add `vercel.json` with `Access-Control-Allow-Origin: *`
  and a `Cache-Control` of a few minutes on `/api/*.json`.
- **Bulk exports.** Year-partitioned CSV is right for git and awkward for consumers. Have CI
  build one Parquet or DuckDB file per table (`.gitignore` already lists `*.duckdb`) and attach
  it to a nightly release, plus one concatenated `<table>.csv.gz` under `/api/`.
- **A documentation page** (`/datos/`) listing each file, its fields and units, the update
  times (`generated_at` is ~02:37 UTC and again after the afternoon run) and the stability
  promise, with schema.org `Dataset` JSON-LD so Google Dataset Search lists it.
- **Two tiers in one document.** `adequacy.json` carries `current.tier = vigilancia` and
  `worst_tier = ajustado`; the narrative is handed the worst one, so the page shows two tiers
  without saying which the text means. Name the field the text uses, and say so on the page.

---

## 4. The site

### 4.1 The JavaScript that is shipped

Measured on this build: `index.html` is 432 KB (114 KB gzipped) and references seven script
chunks totalling 584 KB; the page also inlines a 222 KB React Server Components payload
(`__next.__PAGE__.txt`) for hydration; `layout.tsx` mounts `@vercel/analytics`. The README,
`PLAN.md`, `Chrome.tsx`, `Plot.tsx` and `globals.css` all say the page ships no client
JavaScript. Two honest ways out:

- **Correct the claim (S).** Say the page needs no JavaScript to read, and that the runtime and
  the analytics beacon are the only scripts. Add `<noscript>`-free wording; nothing else changes.
- **Make it true (L).** There is not a single client component, so the pages could be rendered
  with `renderToStaticMarkup` from a build script into `out/`, with the CSS inlined or linked and
  the analytics beacon as one `<script>` tag. That halves the HTML, removes the RSC payload and
  the runtime, and keeps Vercel as a plain static host. Cost: leaving Next's routing, metadata
  API and dev server.

Pick one; the plan recommends the first now and the second only if §4.4 makes the pages many.

### 4.2 Sharing, discovery and the small pages

- Open Graph and Twitter card metadata with `metadataBase` and `canonical`, plus a daily image
  built at build time from the hero headline and the Mazar cut (SVG rendered to PNG with
  `@resvg/resvg-js` or `satori`; both run without network).
- `app/icon.svg` from the masthead `Mark`; `app/robots.ts`; `app/sitemap.ts`; a Spanish
  `not-found.tsx` (today the export serves Next's English 404 on a `lang="es"` site).
- `@media print` rules, and a `title.template` in the root metadata so child pages stop
  repeating the brand by hand.
- Self-host the three fonts under `public/fonts/` (the build has no network, which is why they
  are linked; a committed woff2 needs none). Removes a render-blocking third-party stylesheet
  and a request to Google on every visit.

### 4.3 Accessibility

- Tables drawn with `<div>`s, and the scenario header on the Mazar page is `aria-hidden`, so
  its rows read as loose text. Same for the floors, the forecast horizons and the national
  mix. Make them `<table>` with `<th scope>`.
- Every chart has a `<title>` and `<desc>`, but the desc is only a date range. Add a collapsed
  `<details>` with a table of the plotted values under each chart — no JavaScript needed.
- A skip link before the masthead; `:focus-visible` rules (there are none) checked in dark mode.
- Abbreviations (`p29`, `m/d`) explained in text or `<abbr>`, not only in a `title` tooltip;
  the year strip `<ol>` of empty items as `role="img"` with its label; `#datos` gets `.section`
  so it scrolls under the masthead like the others.

### 4.4 More pages from data that already exists

- **`/embalses/[site]/`** for the other seven reservoirs with `generateStaticParams`. Every one
  has level, bands, slopes and inflow climatology in `latest.json`; `Fleet.tsx`'s
  `DETAIL_PAGES` map is the hook. Mazar's forecast sections stay conditional on a forecast
  existing (§5.3 would later add them for others).
- **A daily permalink** (`/dia/2026-09-21/`) rendered from `narrative_snapshots`,
  `forecast_runs` and `adequacy_runs`, so a reading can be cited after the numbers move, and a
  page listing them. This is the human face of the scorecard in §5.1.
- **A "since yesterday" strip** on the home page, from §3's `previous` field.
- **Embeddable cards**: one static HTML per reservoir under `/embed/<site>/` with a fixed size,
  for news sites; and an Atom feed of the daily narrative.
- An English version is a deliberate decision (`PLAN.md` decision 3), not a gap. If it is ever
  wanted, `story.ts` and `format.ts` already isolate the sentences and the locale, which is the
  hard part.

### 4.5 Rendering weight and code health

- Every chart is rendered twice, wide and compact, and CSS hides one. A single `viewBox` SVG
  that scales, with breakpoint-specific label density, halves the chart markup; the 180-day
  mix and the 12-year record charts are the heavy ones.
- Split `src/app/page.tsx` (1,021 lines, ten sections) into `components/sections/*.tsx`; move
  the five hand-written method notes to a data file.
- Deduplicate between the two pages: the inflow panel, `SCENARIO_ES`, the critical-threshold
  lookup, the page frame (`Contours` + `Masthead` + `Footer` belong in the layout), the
  `shortDate(x) + year` pattern (six copies; one `dateWithYear` in `format.ts`),
  `narrativeStamp`'s UTC−5 logic (already in `util/dates.ts`), and `capitalise`.
- Move the 45 inline `style={{…}}` props into `globals.css`, whose dark-mode colours are also
  declared twice.

---

## 5. Models and the narrative

The reports already say where the models are weak; this section is about the next
experiment for each, with the data that now exists. Every item keeps the ladder's rule: it
ships only if it beats what is published on the same rolling-origin backtest.

### 5.1 A live scorecard

`forecast_values` and `adequacy_values` are written on every run and read by nothing. Add
`npm run score`: for every past run whose horizon has elapsed, join p10/p50/p90 to the
observed level (and the adequacy net requirement to the observed balance), and write
`data/reports/scorecard.md` plus a `scorecard` block in `forecast.json` and `adequacy.json`
(MAE, coverage and pinball loss to date, by horizon). The site shows "how the last N forecasts
did" beside the fan. Runs must be scored under the model version that made them (§5.2).

### 5.2 Model versioning discipline

`adequacy.ts` still says `MODEL_VERSION = "1"` although the import-regime rule changed the
published result; two runs for origin 2026-09-21 share the version and disagree (`holgado`
versus `vigilancia`/`ajustado`). Bump it now, and fold every rule parameter into
`features_hash` so a rule change cannot be silent again. Move the parameters that live in code
into `adequacy_assumptions.csv` or a sibling: the 1 GWh/day import cutoff, the 70% thermal
share and 14-day window, the 5 GWh/day tier cut, the 1,095-day ceiling window, and the 2,115 m
marker (as a `thresholds.csv` row marked unverified, which the page already says it is).

### 5.3 Forecasts beyond Mazar

Levels and inflows exist for six more plants: Amaluza (4,611 level days since 2014-09), Coca
Codo Sinclair (3,734, 2016-06), Agoyán (3,726, 2016-07), Manduriacu (3,339, 2017-08), Minas San
Francisco (3,129, 2018-10) and Delsitanisagua (2,822, 2018-12). Only Mazar is forecast, and the
site is hard-coded in `scripts/forecast.ts` and `scripts/backtest-m4.ts`.

- For the run-of-river and daily-storage plants, level is an operating decision and the
  useful target is **inflow** (and from it, energy): a 7- and 14-day inflow forecast from
  analogue years conditioned on the 16-day rain at their own centroid (§1.1), scored against
  persistence and climatology.
- Amaluza is a cascade: Mazar's simulated release plus the inter-dam inflow. It is the one
  other reservoir where a level forecast means something.
- Effort M per family; the backtest harness already takes a site.

### 5.4 Using the rain that is already ingested

The 16-day precipitation forecast is collected daily and read by no model; `features/weather.ts`
keeps only ERA5 rows. Under 30 days the shipped model has no skill (−0.1% at 7 days, 0.1% at
30). The recorded next step in `water-balance.ts` is to condition the analogue inflow years on
basin precipitation. With §1.1 done:

- Backtest with ERA5 as a perfect-foresight upper bound first: if a known 16-day rain total
  does not improve the 14-day level forecast, a forecast of it will not either, and the
  experiment stops there.
- If it does, replay with Open-Meteo's previous-runs archive for the real forecast skill, and
  start scoring the collections made since 2026-09-22.
- Schedule: `covariates.yml` runs at 17:00 UTC, after both daily runs, so the models and the
  narrative use yesterday's forecast collection. Move the forecast fetch ahead of the
  12:15 run (a separate, small job), or fetch it inside the daily run.

### 5.5 The adequacy model's fragile term

The tier at this origin depends almost entirely on the import assumption (central deficit
−1.8 to +0.8 GWh/day; the central case now holds 0.14 GWh/day for 90 days under the cutoff
rule). XM's side of the border — Colombian useful volume, inflow energy against its mean,
demand, spot and scarcity prices, 3,800 days of each — is ingested and unused by any model.

- **Publish sensitivity first (S):** the deficit and tier under each import ceiling
  (demonstrated, stressed, and the current regime), so a reader sees how much rests on it.
- **Then an export-availability model (M):** exports as a function of Colombian storage,
  inflow anomaly, spot versus scarcity price and Ecuadorian demand, fitted on the 3,772
  matched days; it replaces both fixed ceilings and the cutoff heuristic if it backtests
  better on the 2024 episode and the 2026-09 stop.
- Band coverage is 60–67% against a nominal 80% because calibration pools all past errors
  equally across a fleet that changed. Try a rolling calibration window and, separately,
  inflating width to hit nominal coverage; publish whichever is honest at every horizon.
- The inflow→hydro link is a recorded negative on the one Amazon-slope inflow. Retry it once
  per-plant inflows and per-centroid rain exist (§1.1, §5.3); Daule-Peripa stays unmeasured
  and that sentence stays on the page.
- ONI has only been tried as an analogue filter (worse). It has not been tried as a covariate
  for the hydro anomaly or for Colombian storage.

### 5.6 The narrative

- **Offline evaluation.** Replay the committed payloads across models and prompt versions and
  record validator pass rate, cost and word count; keep the table in `data/reports/narrative.md`.
  This is what would justify a cheaper model than `claude-opus-5.5` ($0.039 per call, twice a
  day) — or confirm that the cost is right.
- **Structured drivers**: `{factor, direction, payload_ref}` so each driver is checkable by
  code, not only by the number-and-date scan; enforce the 120–220 word target and 3–5 drivers
  that the prompt asks for and the schema does not.
- Trim the payload (about 5.7k of the 6.4k input tokens) before considering caching; at two
  calls a day, caching buys nothing.
- Show the tier the text was given (§3, last bullet).

### 5.7 Cheaper runs

`npm run forecast -- --dry-run` takes 24 s and `adequacy` 11 s. Each horizon rebuilds its
analogue paths and simulates from the origin separately, so the 90-day path is simulated
about 2.2 times over and the horizons do not share ensemble members (`ensemble_n` 16 at 14 d,
15 at 30 d). Simulate once to 90 days and read off each horizon; cache the release-rule fit as
the storage-curve fit already is. Worth doing before §5.3 multiplies the sites.

### 5.8 Hourly energy

`{code}EnerDia` returns 24 hourly values per plant-day and the parser sums them into
`produccion_mwh`; the hours are archived raw and never curated. An `energy_hourly` table would
allow a peak-hour (MW) view of adequacy, which the daily GWh identity cannot give. Low priority
until someone asks the peak question; the raw is already there to backfill from.

---

## 6. Tooling and dependencies

### 6.1 Versions

| Package | Installed | Latest | Risk |
|---|---|---|---|
| vitest | 4.1.11 | 5.0.1 | low |
| eslint / @eslint/js | 9.39.5 | 10.11.0 / 10.0.1 | low |
| undici | 7.29.1 | 8.11.0 | medium — `Agent` and `request` in `http/client.ts` and `http/tls.ts` |
| zod | 3.25.76 | 4.6.5 | medium — every contract in `contracts/tables.ts`; faster parsing is the prize |
| typescript | 5.9.3 | 7.0.2 | medium — check `tsx` and Next before moving |
| @types/node | 22.20.4 | 26.6.2 | match to the Node version, not to latest |

`npm audit --omit=dev` reports 0 vulnerabilities. Order: vitest and eslint together; then
zod 4 with the contract tests as the net; then undici 8 with a fake-server test for the client
(§6.2); TypeScript 7 last, after `next` and `tsx` say they support it. Node 22 is in maintenance;
move to Node 24 LTS with an `.nvmrc`, `engines`, and the workflows' `node-version` changed in
one commit. Dependabot (§2.7) keeps this table from being written again.

### 6.2 Tests and checks

- Modules with no test that imports them: `http/tls`, `sources/cenace`, `store/status`,
  `features/climatology`, `features/weather`, `models/adequacy-report`, `site/data`,
  `site/documents`, `site/format`. The `HttpClient` retry and pacing logic is exercised by
  nothing; a fake `undici` server that returns 429, 500 and a truncated body would cover it.
- A schema test for every `public/api` document (§3), and a render smoke test that builds
  the page from fixtures and asserts the headline sentences from `story.ts` appear.
- `@vitest/coverage-v8` with a threshold in CI, so the list above cannot grow unnoticed.
- `shellcheck` on `.github/scripts/*.sh` in `ci.yml`; the apply-and-push logic is the most
  consequential untested code in the repository.
- ESLint `recommendedTypeChecked` (today `recommended`): `no-floating-promises` and
  `no-misused-promises` matter in an async pipeline. `tsconfig.json` is already strict.
- A formatter (`prettier` with an `.editorconfig`) run in CI; today formatting is by hand.

---

## 7. Sequencing

Four blocks, each ending green and pushed, in the repository's usual way.

1. **Foundations (a week of runs).** §1.1 dispatches; §2.2 batch artifact; §2.3 per-source
   pin check and raw-first flush; §5.2 version bump and parameters in CSV; §1.4 docs; §2.7
   dependabot and SHA pins; §6.1 vitest and eslint upgrades.
2. **Store and alerts.** §2.1 archive layout migration; §2.4 alerting and step summary;
   §2.5 concurrency; §2.6 no-op commits; §6.2 client tests and shellcheck.
3. **The public face.** §3 data contract, headers, schema tests, `/datos/`; §4.2 previews and
   small pages; §4.3 accessibility; §4.1 the JavaScript claim; §4.5 dedupe and split.
4. **Models.** §5.1 scorecard and §4.4 daily permalinks together; §5.5 sensitivity then the
   export model; §5.4 rain experiment; §5.3 inflow forecasts for the other plants; §5.7
   before §5.3 makes it slow.

What is deliberately not on this list: a database (decision 6 stands; the store is 35 MB of
CSV and the problem in §2.1 is the raw archive, not the tables), an English site (decision 3),
and client-side interactivity on the charts (the pages are readable without it, and §4.3 gives
the numbers to everyone who cannot see them).
