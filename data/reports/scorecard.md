# Scorecard — how the published forecasts did

Generated 2026-11-25T03:51:46Z by `npm run score` from the committed tables; no network. The backtest reports (`backtest.md`, `adequacy.md`) say how each method scores at past origins it never published from; this says how the numbers the site actually published did once their horizons passed.

Rows are grouped by the model that published them and the version of the run that made them, so a method change starts a new line rather than blending into the old one. Where an origin was published more than once (a rerun on revised data), only the last run generated is scored.

## Mazar level (forecast_values)

Observed through 2026-11-23. 57 runs considered (10 superseded by a later run for the same origin and version); 139 rows scored, 146 pending, 0 excluded.

| model | version | horizon | n | MAE (m) | persistence MAE | skill | bias | coverage p10–p90 (n) | pinball | origins |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---|
| M3-water-balance | 1 | 7 d | 1 | 1.600 | 4.770 | 66% | -1.600 | 100% (1) | 0.488 | 2026-09-21 → 2026-09-21 |
| M3-water-balance | 1 | 14 d | 1 | 1.015 | 6.405 | 84% | 1.015 | 100% (1) | 0.541 | 2026-09-21 → 2026-09-21 |
| M3-water-balance | 1 | 30 d | 1 | 11.610 | 16.700 | 30% | -11.610 | 100% (1) | 2.519 | 2026-09-21 → 2026-09-21 |
| M3-water-balance | 1 | 60 d | 1 | 7.453 | 18.283 | 59% | -7.453 | 100% (1) | 2.021 | 2026-09-21 → 2026-09-21 |
| M3-water-balance | 2 | 7 d | 10 | 2.885 | 2.909 | 1% | 2.885 | 30% (10) | 0.975 | 2026-09-23 → 2026-10-02 |
| M3-water-balance | 2 | 14 d | 12 | 1.116 | 7.357 | 85% | 0.642 | 100% (12) | 0.557 | 2026-09-21 → 2026-10-02 |
| M3-water-balance | 2 | 30 d | 12 | 5.905 | 10.910 | 46% | -5.905 | 100% (12) | 1.568 | 2026-09-21 → 2026-10-02 |
| M3-water-balance | 2 | 60 d | 4 | 7.066 | 17.786 | 60% | -7.066 | 100% (4) | 1.957 | 2026-09-21 → 2026-09-24 |
| M4-gbm-m3-residual | 2 | 7 d | 2 | 1.325 | 4.820 | 73% | -1.325 | 100% (2) | 0.425 | 2026-09-21 → 2026-09-22 |
| M3-water-balance | 3 | 14 d | 10 | 5.360 | 6.831 | 22% | -5.360 | 90% (10) | 1.271 | 2026-10-02 → 2026-10-11 |
| M3-water-balance | 3 | 30 d | 10 | 1.822 | 2.761 | 34% | 1.777 | 100% (10) | 0.885 | 2026-10-02 → 2026-10-11 |
| M4-gbm-direct | 3 | 7 d | 10 | 2.789 | 4.762 | 41% | -2.580 | 60% (10) | 0.952 | 2026-10-02 → 2026-10-11 |
| M3-water-balance | 4 | 7 d | 26 | 3.816 | 2.263 | -69% | 2.653 | 35% (26) | 1.219 | 2026-10-12 → 2026-11-15 |
| M3-water-balance | 4 | 14 d | 25 | 6.675 | 3.513 | -90% | 4.012 | 36% (25) | 2.441 | 2026-10-12 → 2026-11-05 |
| M3-water-balance | 4 | 30 d | 13 | 5.090 | 1.526 | -234% | 5.090 | 69% (13) | 1.581 | 2026-10-12 → 2026-10-24 |
| M3-water-balance | 5 | 7 d | 1 | 2.250 | 3.940 | 43% | -2.250 | 100% (1) | 0.596 | 2026-11-16 → 2026-11-16 |

Persistence MAE is the error of holding the origin day's level, over the same rows; skill is 1 − MAE / persistence MAE, so a negative skill means the published number was further from what happened than no forecast at all.

A handful of rows is an anecdote, not a score: read `n` before reading the MAE, and the backtest before either.

## National net requirement (adequacy_values)

Observed through 2026-11-23. 56 runs considered (2 superseded by a later run for the same origin and version); 0 rows scored, 142 pending, 138 excluded.

A rationing episode has been open since 2026-09-22 (`rationing_episodes.csv`, no end date). Measured load on those days is suppressed load, so no row whose window reaches past that day can be scored until the episode is given an end date; until then the rows are counted as excluded, not dropped.

No published row has reached its target date with an observation yet. The table fills in as they do.
