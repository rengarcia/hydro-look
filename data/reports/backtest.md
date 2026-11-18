# Backtest — mazar level forecast

Generated 2026-11-18T08:02:13Z from the committed tables; no network. Origins are every Monday (weekly since 2026-11-17; the first of each month before that), each one refitting every model on the data before it. 463 origins scored per horizon, 411 of them with a calibrated band (the first 52 are the calibration's warm-up).

Level history: 4442 days, 2014-09-20 → 2026-11-17.

## Verdict

**M3-water-balance ships.** At 90 days it is 33.8% better than persistence; at 7 days it is -3.5%, which is to say indistinguishable from doing nothing, and the forecast document says so rather than implying a precision the measurement does not support.

It is not the only rung that beats persistence — M1-climatological-drift, M2-seasonal-anomaly-decay do too at the long horizons — but it is chosen because none of them is as good across the horizons (M1-climatological-drift is closer at 7 d, and further off everywhere else), and because its state is interpretable: a storage curve, a release rule and a set of named analogue years, each of which can be inspected and argued with.

**14 and 30 days publish M4-blend-m3-direct; every other horizon publishes M3-water-balance.** The ladder's rule ships a rung where it beats the one before it — a lower MAE and a band no worse calibrated — and the M4 backtest below shows M4-blend-m3-direct doing that there: at 14 days, MAE 3.08 m against 3.37 m, 8.0% better than persistence, band coverage 80.0% against 80.2%, paired difference −0.29 m with a 90% interval of [−0.40, −0.19]; at 30 days, MAE 5.14 m against 5.39 m, 11.7% better than persistence, band coverage 75.9% against 74.7%, paired difference −0.25 m with a 90% interval of [−0.46, −0.04]. It is a candidate at 7 days too, and does not publish there: in the M4 snapshot M4-blend-m3-direct does not beat M3-water-balance at 7 d under the ladder rule (its MAE is lower, 1.82 m against 2.08 m, but its band covers 77.8% against 79.8%, further from the nominal 80%). So `forecast.json` publishes its median at 14 and 30 days, banded by its own out-of-sample residuals from that same run, and names the model on the row; the other horizons, the three named scenarios and days-to-threshold stay M3-water-balance, which alone simulates a daily path. If the M4 snapshot stops covering the ladder's origins, the daily run falls back to M3-water-balance everywhere and says so.

**M4 (gradient-boosted quantile trees) was run on the same backtest** (`npm run backtest:m4`, 462 origins). It beats M3-water-balance only in places — M4-gbm-direct at 30 d, M4-gbm-m3-residual at 14 d, M4-gbm-m3-residual at 30 d, M4-blend-m3-direct at 14 d, M4-blend-m3-direct at 30 d — and nowhere across all horizons, so M3 ships everywhere except 14 and 30 days, where M4-blend-m3-direct does (above).

## Mean absolute error, metres

| model | h=7 | h=14 | h=30 | h=60 | h=90 |
|---|---|---|---|---|---|
| M0-persistence | 2.013 | 3.350 | 5.819 | 9.257 | 11.294 |
| M1-climatological-drift | 2.066 | 3.438 | 5.977 | 9.637 | 11.171 |
| M2-seasonal-anomaly-decay | 2.397 | 3.929 | 6.283 | 7.641 | 7.609 |
| M3-water-balance | 2.084 | 3.376 | 5.390 | 7.193 | 7.473 |
| M4-gbm-direct | 1.780 | 3.215 | 5.366 | 8.002 | 8.884 |
| M4-gbm-direct-m3 | 1.776 | 3.265 | 5.402 | 7.963 | 9.062 |
| M4-gbm-m3-residual | 1.811 | 3.307 | 5.324 | 7.865 | 8.498 |
| M4-blend-m3-direct | 1.824 | 3.080 | 5.136 | 7.356 | 7.974 |

The M4 rows come from `npm run backtest:m4` (run 2026-11-17T03:47:38Z), which refits them at the first 462 of these origins (the newest 1 are not in its rows yet; it is rerun once it is more than 35 days behind) through the same harness; they are rendered from its committed snapshot because refitting about 20,800 boosted models does not belong in the daily run. See [M4](#m4--gradient-boosted-quantile-trees) below.

## Skill against persistence (1 − MAE/MAE₀)

| model | h=7 | h=14 | h=30 | h=60 | h=90 |
|---|---|---|---|---|---|
| M0-persistence | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% |
| M1-climatological-drift | -2.6% | -2.6% | -2.7% | -4.1% | 1.1% |
| M2-seasonal-anomaly-decay | -19.1% | -17.3% | -8.0% | 17.5% | 32.6% |
| M3-water-balance | -3.5% | -0.8% | 7.4% | 22.3% | 33.8% |
| M4-gbm-direct | 11.4% | 4.0% | 7.8% | 13.6% | 21.3% |
| M4-gbm-direct-m3 | 11.6% | 2.5% | 7.2% | 14.0% | 19.8% |
| M4-gbm-m3-residual | 9.8% | 1.2% | 8.5% | 15.0% | 24.8% |
| M4-blend-m3-direct | 9.2% | 8.0% | 11.7% | 20.5% | 29.4% |

Section 7 expected climatological drift to improve on persistence. It does not, at any horizon: a reservoir level is the running total of an operating decision, and last week's decision is a better guide to next week's than the average of six Septembers is. That is recorded here as a measurement, not repaired by tuning.

## Coverage of the published p10–p90 band

| model | h=7 | h=14 | h=30 | h=60 | h=90 |
|---|---|---|---|---|---|
| M0-persistence | 76.4% | 77.6% | 72.7% | 73.0% | 70.9% |
| M1-climatological-drift | 77.6% | 78.0% | 76.2% | 73.4% | 73.7% |
| M2-seasonal-anomaly-decay | 75.2% | 76.1% | 72.2% | 72.0% | 73.4% |
| M3-water-balance | 79.6% | 80.2% | 74.7% | 76.2% | 70.9% |
| M4-gbm-direct | 77.1% | 80.4% | 76.9% | 73.4% | 70.9% |
| M4-gbm-direct-m3 | 76.8% | 79.7% | 77.4% | 74.7% | 70.4% |
| M4-gbm-m3-residual | 79.5% | 80.0% | 78.9% | 73.0% | 63.4% |
| M4-blend-m3-direct | 77.8% | 80.0% | 75.9% | 76.4% | 70.9% |

Against the model's own ensemble, uncalibrated:

| model | h=7 | h=14 | h=30 | h=60 | h=90 |
|---|---|---|---|---|---|
| M0-persistence | — | — | — | — | — |
| M1-climatological-drift | 70.0% | 67.1% | 62.5% | 61.8% | 58.8% |
| M2-seasonal-anomaly-decay | — | — | — | — | — |
| M3-water-balance | 64.6% | 63.4% | 58.0% | 51.0% | 51.2% |
| M4-gbm-direct | 69.7% | 62.9% | 51.4% | 42.4% | 40.4% |
| M4-gbm-direct-m3 | 66.7% | 64.0% | 53.8% | 42.4% | 38.8% |
| M4-gbm-m3-residual | 68.2% | 63.8% | 55.3% | 42.2% | 35.5% |
| M4-blend-m3-direct | 69.3% | 66.2% | 57.3% | 48.6% | 46.1% |

The gap between the two tables is the reason the published band is not the ensemble. An ensemble over analogue inflow years knows only what the weather might do; it does not know that the rule curve is an average of several operating regimes, or that the operator can change their mind. Widening by the model's own out-of-sample residuals is what brings coverage back to what it claims.

## Pinball loss, metres (mean over the three published quantiles)

| model | h=7 | h=14 | h=30 | h=60 | h=90 |
|---|---|---|---|---|---|
| M0-persistence | 0.716 | 1.197 | 2.082 | 3.227 | 3.904 |
| M1-climatological-drift | 0.720 | 1.202 | 2.076 | 3.260 | 3.737 |
| M2-seasonal-anomaly-decay | 0.831 | 1.392 | 2.206 | 2.735 | 2.715 |
| M3-water-balance | 0.717 | 1.176 | 1.862 | 2.456 | 2.619 |
| M4-gbm-direct | 0.630 | 1.129 | 1.861 | 2.661 | 3.092 |
| M4-gbm-direct-m3 | 0.625 | 1.131 | 1.874 | 2.667 | 3.183 |
| M4-gbm-m3-residual | 0.633 | 1.150 | 1.860 | 2.660 | 2.942 |
| M4-blend-m3-direct | 0.644 | 1.095 | 1.782 | 2.466 | 2.756 |

## Bias, metres (mean actual − forecast; positive means the model forecasts too low)

| model | h=7 | h=14 | h=30 | h=60 | h=90 |
|---|---|---|---|---|---|
| M0-persistence | -0.046 | -0.079 | -0.289 | -0.404 | 0.023 |
| M1-climatological-drift | 0.246 | 0.319 | 0.145 | 0.122 | 0.052 |
| M2-seasonal-anomaly-decay | -0.356 | -0.849 | -1.897 | -3.380 | -3.122 |
| M3-water-balance | 0.160 | -0.068 | -1.538 | -3.228 | -3.274 |
| M4-gbm-direct | 0.055 | -0.278 | -1.330 | -2.228 | -1.169 |
| M4-gbm-direct-m3 | 0.055 | -0.377 | -1.476 | -2.408 | -1.356 |
| M4-gbm-m3-residual | -0.010 | -0.391 | -1.353 | -3.048 | -2.545 |
| M4-blend-m3-direct | 0.112 | -0.167 | -1.434 | -2.728 | -2.222 |

## M4 — gradient-boosted quantile trees

Section 7's last rung, deferred in Phase 5 because no gradient-boosting library exists in a TypeScript-only stack (decision 6). `src/lib/models/gbm.ts` is a dependency-free one: histogram splits, depth-limited trees, shrinkage, row subsampling, and the pinball loss with each leaf re-estimated as the quantile of its residuals; seeded, so a rerun reproduces every tree. One model per horizon and per quantile (p10, p50, p90), refitted from scratch at each of the 462 origins on training days whose outcome had been observed by the origin — about 20,800 fits in all. Settings, fixed before the full run and not tuned against it: 200 trees, learning rate 0.05, depth 3, at least 20 rows a leaf, 80% of rows a tree, 32 bins, one training day in 2.

Features, every one read at or before the training day: level and its 1–60-day changes and its departure from its own trailing year; inflow and its 3–90-day means; production and its 7- and 30-day means; day of year as sine and cosine; ONI as a forecaster could have read it (two months stale, the same `availableAt` the ENSO variant uses) and its three-month change; and **ERA5 precipitation at the Paute's single provisional sampling point** (-2.6, -78.6), summed over 7, 30 and 90 days ending five days before the day, because ERA5 is published about five days late. That last group is one reanalysis grid cell chosen in Phase 0, not a basin average, and today's reanalysis rather than the preliminary values a 2018 forecaster would have read.

Three designs, because whether M3 should be a feature, a target or neither is a measurement: `M4-gbm-direct` predicts the h-day level change from the features alone; `M4-gbm-direct-m3` predicts the same change with M3's forecast (its predicted change, its ensemble width and the operator's stance) among the features; `M4-gbm-m3-residual` predicts M3's error and adds it back, so trees that learn nothing leave M3 as it was. M3 at a training day is M3 as it would have been made that day — the fit from the first of the month, the stance over the thirty days before, earlier years' inflow — and at every scored origin that is the first of a month it reproduces the shipped M3's median exactly.

A fourth row is not fitted at all: `M4-blend-m3-direct` is the mean of the shipped M3's median and `M4-gbm-direct`'s, half each, at every origin both reached, banded like every other rung by its own out-of-sample residuals. The per-horizon switch picks a winner; where two forecasts' errors are only partly shared, the mean of the two can beat the better of them, and it cannot flip from one model to the other between one day's run and the next. The weight is a half because a half needs no fitting.

### Mean absolute error, metres, on the same origins

| model | h=7 | h=14 | h=30 | h=60 | h=90 |
|---|---|---|---|---|---|
| M0-persistence | 2.009 | 3.347 | 5.819 | 9.257 | 11.294 |
| M3-water-balance | 2.080 | 3.371 | 5.390 | 7.193 | 7.473 |
| M4-gbm-direct | 1.780 | 3.215 | 5.366 | 8.002 | 8.884 |
| M4-gbm-direct-m3 | 1.776 | 3.265 | 5.402 | 7.963 | 9.062 |
| M4-gbm-m3-residual | 1.811 | 3.307 | 5.324 | 7.865 | 8.498 |
| M4-blend-m3-direct | 1.824 | 3.080 | 5.136 | 7.356 | 7.974 |

Skill against persistence, and against M3 (1 − MAE/MAE_M3):

| model | h=7 | h=14 | h=30 | h=60 | h=90 |
|---|---|---|---|---|---|
| M3-water-balance | -3.5% / 0.0% | -0.7% / 0.0% | 7.4% / 0.0% | 22.3% / 0.0% | 33.8% / 0.0% |
| M4-gbm-direct | 11.4% / 14.4% | 4.0% / 4.6% | 7.8% / 0.4% | 13.6% / -11.3% | 21.3% / -18.9% |
| M4-gbm-direct-m3 | 11.6% / 14.6% | 2.5% / 3.2% | 7.2% / -0.2% | 14.0% / -10.7% | 19.8% / -21.3% |
| M4-gbm-m3-residual | 9.8% / 12.9% | 1.2% / 1.9% | 8.5% / 1.2% | 15.0% / -9.4% | 24.8% / -13.7% |
| M4-blend-m3-direct | 9.2% / 12.3% | 8.0% / 8.6% | 11.7% / 4.7% | 20.5% / -2.3% | 29.4% / -6.7% |

### Paired against M3-water-balance: mean of |error| − |error of M3|, metres, with a 90% interval

Negative means M4 was closer. The interval is a circular block bootstrap over origins in blocks of 26, because weekly origins with horizons out to ninety days overlap and are not independent; the percentage is the share of origins at which M4 was the closer of the two.

| model | h=7 | h=14 | h=30 | h=60 | h=90 |
|---|---|---|---|---|---|
| M4-gbm-direct | −0.30 [−0.43, −0.18], 59.7% | −0.16 [−0.34, +0.03], 53.4% | −0.02 [−0.39, +0.38], 50.8% | +0.81 [+0.23, +1.45], 45.1% | +1.41 [+0.26, +2.76], 41.9% |
| M4-gbm-direct-m3 | −0.30 [−0.44, −0.19], 58.2% | −0.11 [−0.29, +0.09], 53.4% | +0.01 [−0.35, +0.39], 48.8% | +0.77 [+0.18, +1.41], 45.7% | +1.59 [+0.30, +3.12], 43.9% |
| M4-gbm-m3-residual | −0.27 [−0.36, −0.18], 58.0% | −0.06 [−0.21, +0.07], 54.7% | −0.07 [−0.30, +0.17], 50.5% | +0.67 [+0.18, +1.21], 40.7% | +1.02 [+0.10, +2.03], 41.0% |
| M4-blend-m3-direct | −0.26 [−0.35, −0.18], 64.1% | −0.29 [−0.40, −0.19], 59.0% | −0.25 [−0.46, −0.04], 56.0% | +0.16 [−0.15, +0.50], 49.2% | +0.50 [−0.09, +1.21], 46.6% |

### The band

Coverage of the p10–p90 band as the harness publishes every rung's — the median widened by its own out-of-sample residuals — and then of M4's own quantile regressions before any widening (for M3, its analogue ensemble):

| model | h=7 | h=14 | h=30 | h=60 | h=90 |
|---|---|---|---|---|---|
| M3-water-balance | 79.8% | 80.2% | 74.7% | 76.2% | 70.9% |
| M4-gbm-direct | 77.1% | 80.4% | 76.9% | 73.4% | 70.9% |
| M4-gbm-direct-m3 | 76.8% | 79.7% | 77.4% | 74.7% | 70.4% |
| M4-gbm-m3-residual | 79.5% | 80.0% | 78.9% | 73.0% | 63.4% |
| M4-blend-m3-direct | 77.8% | 80.0% | 75.9% | 76.4% | 70.9% |

| model | h=7 | h=14 | h=30 | h=60 | h=90 |
|---|---|---|---|---|---|
| M3-water-balance | 65.9% | 64.8% | 58.7% | 53.1% | 51.4% |
| M4-gbm-direct | 69.8% | 64.1% | 53.1% | 44.2% | 40.1% |
| M4-gbm-direct-m3 | 67.1% | 64.1% | 55.5% | 43.7% | 38.6% |
| M4-gbm-m3-residual | 68.5% | 64.5% | 57.0% | 44.4% | 34.6% |
| M4-blend-m3-direct | 69.5% | 67.0% | 57.5% | 50.4% | 46.4% |

Pinball loss, metres, calibrated band and then own quantiles, on the same banded origins:

| model | h=7 | h=14 | h=30 | h=60 | h=90 |
|---|---|---|---|---|---|
| M3-water-balance | 0.716 | 1.176 | 1.862 | 2.456 | 2.619 |
| M4-gbm-direct | 0.630 | 1.129 | 1.861 | 2.661 | 3.092 |
| M4-gbm-direct-m3 | 0.625 | 1.131 | 1.874 | 2.667 | 3.183 |
| M4-gbm-m3-residual | 0.633 | 1.150 | 1.860 | 2.660 | 2.942 |
| M4-blend-m3-direct | 0.644 | 1.095 | 1.782 | 2.466 | 2.756 |

| model | h=7 | h=14 | h=30 | h=60 | h=90 |
|---|---|---|---|---|---|
| M3-water-balance | 0.699 | 1.104 | 1.796 | 2.519 | 2.678 |
| M4-gbm-direct | 0.594 | 1.065 | 1.913 | 2.882 | 3.174 |
| M4-gbm-direct-m3 | 0.596 | 1.078 | 1.884 | 2.838 | 3.216 |
| M4-gbm-m3-residual | 0.609 | 1.080 | 1.832 | 2.841 | 3.134 |
| M4-blend-m3-direct | 0.607 | 1.023 | 1.769 | 2.568 | 2.825 |

### Decision

The ladder's rule: a horizon is won when the MAE is below M3-water-balance's *and* the published band's coverage is no further from its nominal 80% than M3's. † marks a win whose paired interval lies wholly below zero.

| model | h=7 | h=14 | h=30 | h=60 | h=90 |
|---|---|---|---|---|---|
| M4-gbm-direct | loses (band) | loses (band) | wins | loses (MAE) | loses (MAE) |
| M4-gbm-direct-m3 | loses (band) | loses (band) | loses (MAE) | loses (MAE) | loses (MAE) |
| M4-gbm-m3-residual | loses (band) | wins | wins | loses (MAE) | loses (MAE) |
| M4-blend-m3-direct | loses (band) | wins † | wins † | loses (MAE) | loses (MAE) |

**M4 wins only in places** (M4-gbm-direct at 30 d, M4-gbm-m3-residual at 14 d, M4-gbm-m3-residual at 30 d, M4-blend-m3-direct at 14 d †, M4-blend-m3-direct at 30 d †) and no design wins everywhere, so `forecast.json` switches by horizon rather than wholesale: **14 and 30 days publish M4-blend-m3-direct**, and every other horizon, the scenarios and days-to-threshold publish M3.

### The crisis check at M4's resolution

M4 forecasts five horizons, not a daily path, so its call on 2115 m is the first horizon at which the quantile is at or below it — a crossing within 90 days or none. M3 is read the same way here (its median and its ensemble's p10 on the same grid), so the two are compared at one resolution; the day-by-day, 365-day version in the crisis section below is M3's own. The same strict rule applies: a call counts only if sustained to the crossing, and lands no more than a week after it.

| level first at or below | model | P50 called it from | P50 lead | P10 called it from | P10 lead |
|---|---|---|---|---|---|
| 2024-04-11 | M3-water-balance | **never** | — | 2024-04-08 | 3 d |
| 2024-04-11 | M4-gbm-direct | **never** | — | 2024-04-01 | 10 d |
| 2024-04-11 | M4-gbm-direct-m3 | **never** | — | 2024-04-01 | 10 d |
| 2024-04-11 | M4-gbm-m3-residual | **never** | — | 2024-04-01 | 10 d |
| 2024-04-11 | M4-blend-m3-direct | **never** | — | 2024-04-01 | 10 d |
| 2024-10-08 | M3-water-balance | 2024-09-16 | 22 d | 2024-09-09 | 29 d |
| 2024-10-08 | M4-gbm-direct | 2024-10-07 | 1 d | 2024-09-16 | 22 d |
| 2024-10-08 | M4-gbm-direct-m3 | 2024-10-07 | 1 d | 2024-09-16 | 22 d |
| 2024-10-08 | M4-gbm-m3-residual | 2024-09-16 | 22 d | 2024-09-16 | 22 d |
| 2024-10-08 | M4-blend-m3-direct | 2024-10-07 | 1 d | 2024-09-16 | 22 d |

Run-up to 2024-04-11, where each model's P50 / P10 put the crossing (— : not within 90 days):

| origin | M3-water-balance | M4-gbm-direct | M4-gbm-direct-m3 | M4-gbm-m3-residual | M4-blend-m3-direct |
|---|---|---|---|---|---|
| 2024-03-04 | — / — | — / — | — / — | — / — | — / — |
| 2024-03-11 | — / — | — / — | — / — | — / — | — / — |
| 2024-03-18 | — / — | — / — | — / — | — / — | — / — |
| 2024-03-25 | — / — | — / — | — / — | — / — | — / — |
| 2024-04-01 | — / — | — / 2024-04-08 | — / 2024-04-08 | — / 2024-04-08 | — / 2024-04-08 |
| 2024-04-08 | — / 2024-04-15 | — / 2024-04-15 | — / 2024-04-15 | — / 2024-04-15 | — / 2024-04-15 |

Run-up to 2024-10-08, where each model's P50 / P10 put the crossing (— : not within 90 days):

| origin | M3-water-balance | M4-gbm-direct | M4-gbm-direct-m3 | M4-gbm-m3-residual | M4-blend-m3-direct |
|---|---|---|---|---|---|
| 2024-09-02 | — / — | — / — | — / — | — / — | — / — |
| 2024-09-09 | — / 2024-10-09 | — / — | — / — | — / — | — / — |
| 2024-09-16 | 2024-09-30 / 2024-09-23 | — / 2024-09-30 | — / 2024-09-30 | 2024-09-30 / 2024-09-23 | 2024-09-30 / 2024-09-23 |
| 2024-09-23 | 2024-09-30 / 2024-09-30 | — / 2024-09-30 | — / 2024-09-30 | 2024-09-30 / 2024-09-30 | 2024-09-30 / 2024-09-30 |
| 2024-09-30 | 2024-10-07 / 2024-10-07 | — / 2024-10-14 | — / 2024-10-14 | 2024-10-14 / 2024-10-07 | — / 2024-10-07 |
| 2024-10-07 | 2024-10-14 / 2024-10-14 | 2024-10-14 / 2024-10-14 | 2024-10-14 / 2024-10-14 | 2024-10-14 / 2024-10-14 | 2024-10-14 / 2024-10-14 |

False alarms (P50 named a crossing within thirty days that did not come within sixty days of it), over 462 origins: M3-water-balance 4, M4-gbm-direct 1, M4-gbm-direct-m3 1, M4-gbm-m3-residual 1, M4-blend-m3-direct 2.

### What the run says

**One week out the trees are clearly closer, and the rule still says no.** On 462 weekly origins M3 is 3.5% *worse* than persistence at seven days (2.08 m against 2.01 m); the 6% edge it showed on first-of-month origins does not survive the denser sample. Every boosted design is closer than M3 there — 1.78 to 1.82 m, a paired gain of 0.26–0.30 m with the interval wholly below zero, 9–12% better than persistence — because a week out the level is mostly what the operator is doing this week, and the last few days' level change and production say that more directly than a rule curve averaged over years. Their bands are also the sharper ones (pinball loss 0.63–0.64 m against M3's 0.72 m, about a metre narrower). But the rule's second clause asks for coverage no further from 80% than M3's, M3's happens to sit at 79.8%, and the designs' sit at 76.8–79.5%: every one of them loses seven days on the band, by between a third of a point and three points of coverage on about 410 banded origins. That is the rule as written, applied as written; whether a band that scores better and covers two points less should lose is a question about the rule, and it is the owner's.

**The blend is the first rung to beat M3 beyond a week by more than noise.** `M4-blend-m3-direct` is half M3's median and half `M4-gbm-direct`'s. At fourteen days it is 0.29 m closer than M3 (3.08 m against 3.37 m; interval [−0.40, −0.19]) with a band at 80.0%, and at thirty days 0.25 m closer (5.14 m against 5.39 m; [−0.46, −0.04]) with a band at 75.9% against M3's 74.7%. At both it also beats the fitted design it is half of. The two models are wrong in different ways — the trees extrapolate the last fortnight, the water balance pulls back toward the rule curve — and where they disagree the outcome is more often between them than beyond either. No fitted design does this on its own: `M4-gbm-direct`'s fourteen-day gain is 0.16 m with an interval that reaches zero, and at thirty days all three are within a few centimetres of M3.

**Past a month the water balance still wins, and the blend only softens the loss.** At sixty days every fitted design is worse than M3 by 0.7–0.8 m and at ninety by 1.0–1.6 m, with the paired interval above zero — a measured negative in the same sense as M1's. Two months out the level is decided by inflow that has not fallen yet and by how the operator responds to the level on the way; the water balance has both built in, and the trees have to learn them from a decade of overlapping windows that contains only a handful of drawdowns. Their own quantiles are badly overconfident there (35–44% inside a nominal 80%). The blend gives back half of that loss (+0.16 m at sixty days, +0.50 m at ninety, both intervals across zero), which is not a reason to publish it there.

**M3 as a feature or as the target is not what helps; averaging with M3 is.** Predicting M3's residual was the design most likely to keep M3's long-range skill, since trees that learn nothing leave M3 untouched. It does not, and giving the trees M3's forecast as a feature is no better: the three fitted designs are within ten centimetres of each other at every horizon to thirty days. What M3 knows reaches the forecast when it is averaged in after the fact, not when it is offered to the trees to use or ignore.

**Crisis check.** On this five-horizon grid, read weekly, no model's P50 called the April 2024 crossing; every boosted P10 called it ten days out, from 1.7 m above the line, and M3's ensemble P10 three days out. That is short-range extrapolation, not early warning. October 2024 was called by M3's P50 twenty-two days out and by its P10 twenty-nine; `M4-gbm-m3-residual` matched the P50, while the direct designs and the blend held their P50 above the line until the day before and called it on the P10 at twenty-two days. M3 pays for its earlier calls with four false alarms in 462 origins against one for each fitted design and two for the blend. Crossings are M3's to call, on its daily path, and the blend is not published as a crossing forecast.

**What `forecast.json` does with it (first adopted 2026-09-22; this design and these horizons, 2026-11-17).** It switches by horizon, not wholesale: the blend's median at each of seven, fourteen and thirty days where the snapshot says it meets the ladder's rule — fourteen and thirty today, not seven — and M3 at every other horizon, for the three named scenarios and for the days-to-threshold distribution, which need a daily simulated path nothing boosted produces. Earlier designs published at seven days only: `M4-gbm-m3-residual` from 2026-09-22 (it won on the provisional rain point), `M4-gbm-direct` from 2026-10-03 (the owner's choice on the verified centroid; from the 2026-10-03 and -04 origins its median put Mazar above where it started and the reservoir finished 4.7 and 6.9 m below it), and M3 again from 2026-10-13. The daily run makes the blend at the live origin exactly as this snapshot scored it — the direct design fitted with these settings and features, averaged with that day's M3 — and bands it with the residual quantiles recorded here. A run never switches to another design by itself, and a horizon stops publishing the blend the first run after a rerun stops showing the win.

Runtime: 438 s of wall clock, one process per fitted design, for the whole run on the machine that produced this snapshot, which is why it is its own command and not part of the CI dry-run or the daily forecast. To refresh it: `npm run backtest:m4`, then `npm run forecast` to render it here.

## Does conditioning the analogue years on ENSO phase help?

No. Scored over the 258 origins where both variants could forecast — the matched variant declines the rest, because narrowing an analogue pool of barely a dozen members by ENSO phase often leaves too few to form an ensemble at all:

| model | h=7 | h=14 | h=30 | h=60 | h=90 |
|---|---|---|---|---|---|
| M3-water-balance | 2.105 | 3.441 | 5.639 | 7.562 | 8.136 |
| M3-water-balance-enso | 2.179 | 3.771 | 6.051 | 8.166 | 8.679 |

The phase used is the one a forecaster could actually have read at each origin: ONI is a three-month mean centred on its label, so the newest value available on any day is about two months old, and the backtest never looks through that lag. Basin precipitation is the other conditioner, and its upper bound is the next section.

## The same ladder on first-of-month origins (how it was scored until 2026-11-17)

Every table above is scored on 463 weekly origins. Until 2026-11-17 the ladder was scored on the first of each month — 107 origins today — and every number published before that date came from that set. Mean absolute error on it, metres:

| model | h=7 | h=14 | h=30 | h=60 | h=90 |
|---|---|---|---|---|---|
| M0-persistence | 2.284 | 3.597 | 5.959 | 9.829 | 11.446 |
| M1-climatological-drift | 2.342 | 3.789 | 6.263 | 9.760 | 11.346 |
| M2-seasonal-anomaly-decay | 2.519 | 4.125 | 6.363 | 7.694 | 7.809 |
| M3-water-balance | 2.141 | 3.478 | 5.028 | 7.142 | 7.609 |

Skill against persistence on it:

| model | h=7 | h=14 | h=30 | h=60 | h=90 |
|---|---|---|---|---|---|
| M0-persistence | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% |
| M1-climatological-drift | -2.6% | -5.4% | -5.1% | 0.7% | 0.9% |
| M2-seasonal-anomaly-decay | -10.3% | -14.7% | -6.8% | 21.7% | 31.8% |
| M3-water-balance | 6.2% | 3.3% | 15.6% | 27.3% | 33.5% |

M3-water-balance paired against persistence on each set: mean of |error| − |error of persistence|, metres (negative means the model was closer), with a 90% block-bootstrap interval over about half a year of origins a block, and the share of origins where the model was the closer of the two:

| origins | h=7 | h=14 | h=30 | h=60 | h=90 |
|---|---|---|---|---|---|
| weekly (463) | +0.07 [−0.08, +0.22], 46.0% | +0.03 [−0.26, +0.27], 47.2% | −0.43 [−1.00, +0.12], 56.9% | −2.06 [−3.18, −0.98], 62.2% | −3.82 [−5.47, −2.14], 65.2% |
| first of the month (107) | −0.14 [−0.44, +0.16], 56.1% | −0.12 [−0.61, +0.35], 57.0% | −0.93 [−1.65, −0.25], 58.5% | −2.69 [−3.97, −1.37], 62.9% | −3.84 [−5.66, −2.06], 67.3% |

**Why the ladder moved.** At 7 days M3-water-balance scores 6.2% against persistence on the first-of-month origins and -3.5% on the weekly ones. The first of the month is one day in thirty, and a hundred of them is too few to tell two rungs apart under a month — which is where every close call on this ladder has been. The weekly set is about four times the origins, though not four times the information, since neighbouring weeks share most of a sixty- or ninety-day outcome; the block bootstrap is what keeps the intervals honest about that. The paired rows are the comparison to read: where both intervals lie below zero, the model's skill does not depend on which days it is tested on; where only the first-of-month one does, it did. The published band is cut from the weekly set's residuals from model version 5 on, and the crisis check below is still asked a month at a time.

## Does knowing the next 16 days of rain help? (§5.4, perfect foresight)

The upper bound first. At each origin the analogue pool is narrowed to the half of the years whose ERA5 rain over the 16 days after the same calendar day was nearest the rain that *actually fell* after the origin, at `paute_mazar` (the verified catchment centroid). No forecaster has that; it is the most a rain forecast could ever be worth to this model. Same origins as the ladder:

| model | h=7 | h=14 | h=30 | h=60 | h=90 |
|---|---|---|---|---|---|
| M0-persistence | 2.018 (0.0%) | 3.343 (0.0%) | 5.837 (0.0%) | 9.261 (0.0%) | 11.288 (0.0%) |
| M3-water-balance | 2.091 (-3.6%) | 3.372 (-0.9%) | 5.282 (9.5%) | 7.090 (23.4%) | 7.607 (32.6%) |
| M3-water-balance-rain-pf | 2.107 (-4.5%) | 3.359 (-0.5%) | 5.269 (9.7%) | 7.196 (22.3%) | 7.576 (32.9%) |

MAE in metres, skill against persistence in brackets. Coverage of the calibrated p10–p90 band:

| model | h=7 | h=14 | h=30 | h=60 | h=90 |
|---|---|---|---|---|---|
| M3-water-balance | 79.5% | 80.1% | 73.2% | 73.4% | 68.3% |
| M3-water-balance-rain-pf | 79.2% | 79.4% | 75.4% | 73.1% | 71.8% |

**Perfect foresight helps at 14 days** (3.359 m against 3.372 m). The next step is to replay Open-Meteo's previous-runs archive for the real forecast's skill before anything is published; nothing is wired until then.

Scheduling note for when it does help: `covariates.yml` collects the forecast at 17:00 UTC, after both daily runs, so a model would read yesterday's vintage. The forecast fetch would have to move ahead of the 12:15 run, or into it.

## Should every horizon share one ensemble? (§5.7)

Each analogue year is simulated once and read at every horizon it reaches, which is what the shipped model does and changed no published number. Sharing members outright means reading every horizon off only the years whose inflow record reaches ninety days, so a 7-day fan and a 90-day fan are the same years. Same origins:

| model | h=7 | h=14 | h=30 | h=60 | h=90 |
|---|---|---|---|---|---|
| M3-water-balance | 2.084 | 3.376 | 5.390 | 7.193 | 7.473 |
| M3-water-balance-shared-members | 2.098 | 3.407 | 5.417 | 7.200 | 7.473 |

MAE in metres. Coverage of the calibrated band:

| model | h=7 | h=14 | h=30 | h=60 | h=90 |
|---|---|---|---|---|---|
| M3-water-balance | 79.6% | 80.2% | 74.7% | 76.2% | 70.9% |
| M3-water-balance-shared-members | 78.6% | 80.7% | 75.4% | 75.9% | 70.9% |

**Negative: not better at 7, 14, 30, 60, 90 d**, and the ladder's rule asks for every horizon. The shipped model keeps every year a horizon can use; dropping the years whose record stops short of ninety days takes members from the short horizons, and whatever it gains elsewhere is not enough to pay for that everywhere.

## Does starting each analogue year from today's river help? (adopted 2026-10-13)

Replayed as it was, an analogue year brings its own starting flow as well as its weather. On 2026-10-11, with the Paute at about 25 m³/s for a week and Mazar falling more than a metre a day, the median member brought 70–80 m³/s over the next fortnight, because most Octobers began wetter, and M3 forecast a refill in the middle of a drawdown. The years that began as dry — 2010, 2018, 2023, 2024 — brought 23–26. The shipped model multiplies each member by today's trailing 7-day inflow over that year's, clamped to 0.33–3 (the inflow forecast's window and clamp), and lets the multiplier fade with a 15-day half-life. Same origins:

| model | h=7 | h=14 | h=30 | h=60 | h=90 |
|---|---|---|---|---|---|
| M3-water-balance-replayed | 2.319 | 3.515 | 5.728 | 7.228 | 7.447 |
| M3-water-balance | 2.084 | 3.376 | 5.390 | 7.193 | 7.473 |
| M3-water-balance-half-life-10 | 2.067 | 3.313 | 5.412 | 7.181 | 7.470 |
| M3-water-balance-half-life-20 | 2.102 | 3.420 | 5.352 | 7.169 | 7.410 |
| M3-water-balance-half-life-30 | 2.125 | 3.460 | 5.331 | 7.187 | 7.407 |

MAE in metres. Bias (actual − forecast; negative means the forecast was too high):

| model | h=7 | h=14 | h=30 | h=60 | h=90 |
|---|---|---|---|---|---|
| M3-water-balance-replayed | -0.39 | -1.00 | -2.68 | -3.73 | -3.59 |
| M3-water-balance | 0.16 | -0.07 | -1.54 | -3.23 | -3.27 |
| M3-water-balance-half-life-10 | 0.13 | -0.19 | -1.79 | -3.45 | -3.39 |
| M3-water-balance-half-life-20 | 0.18 | 0.01 | -1.29 | -3.02 | -3.12 |
| M3-water-balance-half-life-30 | 0.19 | 0.10 | -0.95 | -2.61 | -2.87 |

Coverage of the calibrated band:

| model | h=7 | h=14 | h=30 | h=60 | h=90 |
|---|---|---|---|---|---|
| M3-water-balance-replayed | 79.1% | 78.3% | 78.4% | 72.2% | 68.9% |
| M3-water-balance | 79.6% | 80.2% | 74.7% | 76.2% | 70.9% |
| M3-water-balance-half-life-10 | 79.3% | 80.2% | 77.1% | 75.4% | 69.9% |
| M3-water-balance-half-life-20 | 79.3% | 80.7% | 75.4% | 77.2% | 70.7% |
| M3-water-balance-half-life-30 | 79.3% | 80.2% | 74.0% | 76.7% | 72.2% |

Paired, M3-water-balance against M3-water-balance-replayed: mean of |error| − |error of the replayed years|, metres, with a 90% block-bootstrap interval and the share of origins where the shipped model was closer:

| | h=7 | h=14 | h=30 | h=60 | h=90 |
|---|---|---|---|---|---|
| M3-water-balance | −0.23 [−0.46, −0.03], 55.5% | −0.14 [−0.44, +0.14], 54.1% | −0.34 [−0.85, +0.15], 55.8% | −0.04 [−0.37, +0.30], 56.9% | +0.03 [−0.15, +0.20], 53.4% |

The crisis check against 2115 m, on the daily 365-day simulation, for both:

| model | lead time to each crossing | false alarms at P50 |
|---|---|---|
| M3-water-balance-replayed | 2024-04-11: P50 never, P10 never; 2024-10-08: P50 never, P10 7 d | 1 of 107 |
| M3-water-balance | 2024-04-11: P50 never, P10 never; 2024-10-08: P50 7 d, P10 7 d | 1 of 107 |

**Adopted, and it does not meet the ladder's rule outright: band further from 80% (74.7% against 78.4%) at 30 d; higher MAE (paired +0.03 m, [−0.15, +0.20]) at 90 d.** Read the paired row before the MAE row: the adoption (2026-10-13) rested on a thirty-day gain whose interval lay below zero against a ninety-day loss whose interval straddled it, a band a few origins in about ninety short of the replayed years' at thirty days, the fourteen- and thirty-day optimism halved, and a P50 that called the October 2024 crossing where the replayed years' never did. Setting `DEFAULT_WATER_BALANCE.inflowState` to null restores the replayed years everywhere, M4's M3 features included.

Also tried on 2026-10-13, and recorded as a negative rather than kept: a release rule that adds each season's median departure from the level-only rule (±30, ±45 or ±60 days of the calendar). Mazar's operation is seasonal, but the level already says most of it: the seasonal rule tied at every horizon to thirty days and made the long-horizon bias worse (−4.4 m at ninety days against −3.6).

## The crisis check

Section 7 asks for the lead time at which the P50 first predicted a crossing of 2115 m (celec sur via press). Answered strictly: a call counts only if it is *sustained* — the earliest origin from which this and every later origin also predicted the crossing on or before the day it happened. One origin that says yes and is then contradicted by the next three did not forecast anything, and crediting it would flatter the model.

| level first at or below | P50 called it from | P50 lead | P10 called it from | P10 lead |
|---|---|---|---|---|
| 2024-04-11 | **never** | — | **never** | — |
| 2024-10-08 | 2024-10-01 | 7 d | 2024-10-01 | 7 d |

**The P50 called 1 of 2 episodes in advance; the P10 called 1.** The statistic section 7 chose is the weaker one for this question, and the run-up tables below show why: a crossing is a dry-tail event, and the median of the analogue ensemble is by construction not the dry tail.

### Run-up to 2024-04-11

| origin | level | analogue years crossing | P10 crossing | P50 crossing |
|---|---|---|---|---|
| 2023-11-01 | 2115.6 m | 11/12 | 2023-11-02 | 2023-11-03 |
| 2023-12-01 | 2124.3 m | 0/12 | none within a year | none within a year |
| 2024-01-01 | 2143.3 m | 0/12 | none within a year | none within a year |
| 2024-02-01 | 2135.6 m | 6/12 | 2024-02-18 | none within a year |
| 2024-03-01 | 2127.5 m | 0/12 | none within a year | none within a year |
| 2024-04-01 | 2116.7 m | 0/12 | none within a year | none within a year |

### Run-up to 2024-10-08

| origin | level | analogue years crossing | P10 crossing | P50 crossing |
|---|---|---|---|---|
| 2024-05-01 | 2119.1 m | 0/12 | none within a year | none within a year |
| 2024-06-01 | 2140.5 m | 0/12 | none within a year | none within a year |
| 2024-07-01 | 2150.6 m | 0/12 | none within a year | none within a year |
| 2024-08-01 | 2152.0 m | 0/12 | none within a year | none within a year |
| 2024-09-01 | 2138.8 m | 4/12 | 2024-11-29 | none within a year |
| 2024-10-01 | 2119.0 m | 8/12 | 2024-10-05 | 2024-10-14 |

Clean misses at every quantile: 2024-04-11. In the run-up to those, not one analogue year reached the level — the inflow ensemble is made of years that happened, and the year being forecast was drier than all of them at that moment. Nothing in this model can know that in advance, and no amount of widening the band fixes it; an analogue method cannot draw a year it has never seen.


False alarms: across 107 origins, the P50 named a crossing within thirty days that did not happen on 1 of them. A lead time means nothing without this number — a model that predicts a crossing every month has perfect lead time and no information.

## What the model fitted, at the last origin

| quantity | value | where it comes from |
|---|---|---|
| area-elevation exponent | 2.50 | fitted |
| area-elevation datum | 2036.7 m | fitted |
| fit residual | 0.695 m/day over 2054 days | fitted |
| turbined flow per MW | 0.668 m³/s | fitted jointly with the curve |
| storage, lowest declared minimum → crest | 228.5 hm³ | integral of the fitted curve |
| release rule points | 19 | median implied release over 4353 days |
| operator's current stance | 1.0 m³/s vs the rule | trailing 30 days |
| crest used as the spill cap | 2155.83 m | highest level in the record |

The 410 hm³ in `plants.csv` is marked `unverified` and came from press; the storage above is the integral of a curve fitted to this repository's own readings, and the two disagree by about a factor of two. That gap cannot be closed by preferring the bigger number: the area curve and the turbine's flow-per-MW are fitted *together*, and doubling the area drives the flow-per-MW down through zero — a turbine that consumes no water. The balance closes at one scale. The check that does pass is `repDiaPotQTurb`'s 113 days of turbined flow, whose maximum is about 129 m³/s, against the fitted 114 m³/s at Mazar's rated 170 MW.

The bias table above shows this model forecasting high at the long horizons, so correcting the median by its own trailing residual was tried. It is *worse* at every horizon — the bias is not a stable offset but a handful of origins during the 2024 drawdown, and a running median chases them after the fact. The median is therefore published uncorrected, with the residual beside it in `forecast.json` as `median_backtest_residual_m` so a reader can apply their own judgement.

## The fitted release rule

| level, masl | median implied release, m³/s |
|---|---|
| 2110.0 | 10.5 |
| 2112.5 | 15.1 |
| 2115.0 | 29.9 |
| 2117.5 | 28.1 |
| 2120.0 | 35.4 |
| 2122.5 | 38.1 |
| 2125.0 | 36.1 |
| 2127.5 | 47.9 |
| 2130.0 | 55.4 |
| 2132.5 | 62.0 |
| 2135.0 | 69.7 |
| 2137.5 | 53.8 |
| 2140.0 | 53.4 |
| 2142.5 | 53.9 |
| 2145.0 | 57.8 |
| 2147.5 | 59.8 |
| 2150.0 | 60.7 |
| 2152.5 | 85.2 |
| 2155.0 | 222.7 |

This curve is why the water balance works at all. Run open-loop — release held at whatever it recently was, as section 7 originally specified — the same model loses to persistence at every horizon, because a simulated reservoir that never reacts either fills until it spills or empties until it is dry. Reading the release back off the level on every simulated day is the whole difference.

