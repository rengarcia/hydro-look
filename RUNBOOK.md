# hydro-look — runbook

What a person has to do when the pipeline asks for one. PLAN §8a gap 6: the workflows already
open an issue per failure mode and close it on the next green run; this file says who reads them,
how fast, and what each one needs.

## Owner and notification route

- **Owner:** the repository owner, [@rengarcia](https://github.com/rengarcia). Nobody else is
  notified today; add a second person here and to the repository's watchers before relying on
  the site in a crisis.
- **Route:** GitHub issues opened by `.github/scripts/issues.cjs`, one per label, commented on
  while the failure lasts. They reach the owner only if the repository is watched with
  **Issues** enabled (Watch → Custom → Issues) and GitHub's email or mobile notifications are
  on. Check that setting once; nothing in the repository can.
- **Anything broken?** One filter: open issues with any of the labels below.
- **Response time.** A red daily run costs a day of freshness, and every run re-reads three days
  (`--days 3`), so a failure fixed within 48 hours loses no data. Aim to look within a day;
  from October to March — the dry season on the Amazon slope, when the adequacy tier matters —
  the same day.

## Labels

| Label | Opened by | What it means | What to do |
|---|---|---|---|
| `ingest-failure` | `daily.yml`, scheduled runs only | A source failed to fetch or parse, or the apply step failed. Other sources were still written. | Open the run. If one source is down (5xx, timeout), wait for the next slot; the three-day re-read repairs it. If a parser rejected a changed page, fix the parser against the raw response in the run's `ingest-batch-*` artifact, then replay the batch (README, "Replaying a batch"). |
| `model-failure` | `daily.yml` | The forecast or adequacy step failed after a good ingest; yesterday's documents are still published. | Read `forecast.log` in the run's `apply-log-*` artifact, reproduce with `npm run forecast -- --dry-run` or `npm run adequacy -- --dry-run`, fix, push. |
| `covariates-failure` | `covariates.yml` | Weather, ENSO or XM failed. The daily ingest is unaffected. | Same as `ingest-failure`. Open-Meteo and XM rate-limit; a second failure in a row is a real one. |
| `backfill-failure` | `backfill.yml` | A dispatched backfill failed. | Whoever dispatched it reads the run; backfills resume, so re-dispatch after the fix. |
| `stale-feed` | `freshness.yml` (15:41 and 19:49 UTC) | A feed stopped arriving, or a daily slot never fired. | If a slot never fired (GitHub's scheduler has dropped one and delayed another by five hours, PLAN Phase 1), dispatch `daily.yml` by hand, **not in the minutes around 12:47 or 16:53 UTC**. If a feed is stale, open `public/api/status.json` to see which one, then treat it as the failure of the workflow that fetches it: `ingest-failure` for ORDS and CENACE, `covariates-failure` for ERA5, ONI and XM, `model-failure` for the forecasts. Each apply fails only on its own feeds going stale, so this issue is the one place a stale feed is reported whoever fetches it. |
| `tls-expiry` | `tls-expiry.yml` (Mondays) | A certificate expires within 30 days, or a pinned fingerprint changed. | A changed SMEC pin fails every SMEC request. Check the new certificate by hand (`openssl s_client -connect smec.cenace.gob.ec:443 -cipher 'DEFAULT@SECLEVEL=1'`), and only if it is plausibly CENACE's, update `data/reference/tls_pins.json` with the date. Never switch verification off. |

## Things that open no issue

| Condition | Where it shows | What to do |
|---|---|---|
| Quarantined rows | `npm run check` fails while any file exists under `data/quarantine/` | Fix the parser, re-apply the batch, delete the file (README, "Partial failure"). |
| Narrative `skipped`, `rejected` or `failed` | the row in `data/curated/narrative_snapshots/`; the site keeps the previous text and shows its date | `skipped` is a 429 and clears itself. Repeated `rejected` means the validator refused the model's text: read the raw answer in the row. `failed` with an authentication or credit error means the AI Gateway key or credits: top up or rotate `AI_GATEWAY_API_KEY` in the repository's Actions secrets. The ingest never fails because of the narrative. |
| Gateway spend | `cost_usd` in `narrative_snapshots` | One answered call per origin date, however many daily slots run (a new prompt version or model earns one more). More than one `ok`/`rejected` row per `origin_date` means the once-a-day check has stopped working. |
| M4 blend not published | `forecast.json` → `horizon_switch.status = "fallback"` (no candidate horizon publishes it), or a `fallback` entry under `horizon_switch.horizons` (that horizon does not) | "No longer covers the ladder" refreshes itself: the snapshot may trail the weekly ladder by 35 days, then the daily run reruns `npm run backtest:m4` (about ten minutes, three processes). **Any other reason is for a person**: read it, rerun `npm run backtest:m4`, and decide whether the blend still earns that horizon. Seven days falling back on the band clause while 14 and 30 days publish is the state as of 2026-11-17, not a fault. |
| Published forecast worse than no forecast | `data/reports/scorecard.md` → a negative `skill` on a row with more than a handful of cases | Not a fault of the pipeline. It means the published numbers were further from what happened than holding the level; read the backtest's weekly table for that horizon before changing anything, and say so on the page if it persists. |
| Adequacy tier rises | `adequacy.json` → `current.worst_tier`; the site's headline | Not a fault. Before anyone quotes it, check the import regime (`assumptions.import_regime`) and whether a rationing episode has started that `data/reference/rationing_episodes.csv` does not yet carry. |
| Rationing announced | the news | Add a row to `rationing_episodes.csv` with its sources the same day. Until it is there, the demand model counts suppressed load as real demand (PLAN D10). |

## Rules for dispatching by hand

- `daily.yml`, `backfill.yml` and `covariates.yml` share the `ingest` concurrency group for their
  apply step. GitHub keeps one *pending* run per group, so a third run cancels the one waiting.
  Do not dispatch in the minutes around the scheduled slots: 12:47 and 16:53 UTC (`daily.yml`),
  17:23 UTC (`covariates.yml`).
- Dispatch from `main`. The generated tables are written by main's scheduled runs, so a run from
  a branch conflicts with them.
- A dispatch with `dry_run` writes nothing and is always safe.
