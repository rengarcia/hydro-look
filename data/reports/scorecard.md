# Scorecard — how the published forecasts did

Generated 2026-10-31T17:26:24Z by `npm run score` from the committed tables; no network. The backtest reports (`backtest.md`, `adequacy.md`) say how each method scores at monthly origins it never published from; this says how the numbers the site actually published did once their horizons passed.

Rows are grouped by the model that published them and the version of the run that made them, so a method change starts a new line rather than blending into the old one. Where an origin was published more than once (a rerun on revised data), only the last run generated is scored.

## Mazar level (forecast_values)

Observed through 2026-10-30. 42 runs considered (7 superseded by a later run for the same origin and version); 74 rows scored, 136 pending, 0 excluded.

| model | version | horizon | n | MAE (m) | bias | coverage p10–p90 (n) | pinball | origins |
|---|---|---:|---:|---:|---:|---:|---:|---|
| M3-water-balance | 1 | 7 d | 1 | 1.600 | -1.600 | 100% (1) | 0.488 | 2026-09-21 → 2026-09-21 |
| M3-water-balance | 1 | 14 d | 1 | 1.015 | 1.015 | 100% (1) | 0.541 | 2026-09-21 → 2026-09-21 |
| M3-water-balance | 1 | 30 d | 1 | 11.610 | -11.610 | 100% (1) | 2.519 | 2026-09-21 → 2026-09-21 |
| M3-water-balance | 2 | 7 d | 10 | 2.885 | 2.885 | 30% (10) | 0.975 | 2026-09-23 → 2026-10-02 |
| M3-water-balance | 2 | 14 d | 12 | 1.116 | 0.642 | 100% (12) | 0.557 | 2026-09-21 → 2026-10-02 |
| M3-water-balance | 2 | 30 d | 10 | 6.826 | -6.826 | 100% (10) | 1.722 | 2026-09-21 → 2026-09-30 |
| M4-gbm-m3-residual | 2 | 7 d | 2 | 1.325 | -1.325 | 100% (2) | 0.425 | 2026-09-21 → 2026-09-22 |
| M3-water-balance | 3 | 14 d | 10 | 5.360 | -5.360 | 90% (10) | 1.271 | 2026-10-02 → 2026-10-11 |
| M4-gbm-direct | 3 | 7 d | 10 | 2.789 | -2.580 | 60% (10) | 0.952 | 2026-10-02 → 2026-10-11 |
| M3-water-balance | 4 | 7 d | 12 | 3.672 | 2.475 | 33% (12) | 1.110 | 2026-10-12 → 2026-10-23 |
| M3-water-balance | 4 | 14 d | 5 | 2.652 | 2.412 | 60% (5) | 0.984 | 2026-10-12 → 2026-10-16 |

A handful of rows is an anecdote, not a score: read `n` before reading the MAE, and the backtest before either.

## National net requirement (adequacy_values)

Observed through 2026-10-30. 42 runs considered (1 superseded by a later run for the same origin and version); 0 rows scored, 135 pending, 75 excluded.

A rationing episode has been open since 2026-09-22 (`rationing_episodes.csv`, no end date). Measured load on those days is suppressed load, so no row whose window reaches past that day can be scored until the episode is given an end date; until then the rows are counted as excluded, not dropped.

No published row has reached its target date with an observation yet. The table fills in as they do.
