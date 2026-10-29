# Backtest — mazar level forecast

Generated 2026-10-29T06:33:46Z from the committed tables; no network. Origins are the first of each month, each one refitting every model on the data before it. 106 origins scored per horizon, 94 of them with a calibrated band (the first twelve are the calibration's warm-up).

Level history: 4422 days, 2014-09-20 → 2026-10-28.

## Verdict

**M3-water-balance ships.** At 90 days it is 33.9% better than persistence; at 7 days it is 6.7%, a gain small enough that a week out the band, not the median, is the forecast.

It is not the only rung that beats persistence — M1-climatological-drift, M2-seasonal-anomaly-decay do too at the long horizons — but it is chosen because it is at least as good as all of them at *every* horizon, and because its state is interpretable: a storage curve, a release rule and a set of named analogue years, each of which can be inspected and argued with.

**7 days would publish M4-gbm-direct, but this run falls back to M3-water-balance:** in the M4 snapshot M4-gbm-direct no longer beats M3-water-balance at 7 d under the ladder rule. Every horizon of `forecast.json` is M3-water-balance until the M4 backtest covers the ladder again, and the document says so in `horizon_switch`.

**M4 (gradient-boosted quantile trees) was run on the same backtest** (`npm run backtest:m4`, 106 origins). It beats M3-water-balance only in places — M4-gbm-direct at 14 d, M4-gbm-direct-m3 at 14 d, M4-gbm-m3-residual at 7 d — and nowhere across all horizons, so M3 still ships.

## Mean absolute error, metres

| model | h=7 | h=14 | h=30 | h=60 | h=90 |
|---|---|---|---|---|---|
| M0-persistence | 2.292 | 3.609 | 5.955 | 9.707 | 11.274 |
| M1-climatological-drift | 2.343 | 3.814 | 6.267 | 9.682 | 11.237 |
| M2-seasonal-anomaly-decay | 2.524 | 4.132 | 6.286 | 7.541 | 7.641 |
| M3-water-balance | 2.140 | 3.479 | 5.075 | 7.038 | 7.456 |
| M4-gbm-direct | 1.931 | 3.290 | 5.504 | 8.075 | 8.522 |
| M4-gbm-direct-m3 | 2.001 | 3.308 | 5.609 | 8.051 | 8.677 |
| M4-gbm-m3-residual | 2.085 | 3.497 | 5.540 | 8.093 | 8.396 |

The M4 rows come from `npm run backtest:m4` (run 2026-10-13T02:49:59Z), which refits them at the same 106 origins through the same harness; they are rendered from its committed snapshot because refitting about 4,700 boosted models does not belong in the daily run. See [M4](#m4--gradient-boosted-quantile-trees) below.

## Skill against persistence (1 − MAE/MAE₀)

| model | h=7 | h=14 | h=30 | h=60 | h=90 |
|---|---|---|---|---|---|
| M0-persistence | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% |
| M1-climatological-drift | -2.2% | -5.7% | -5.2% | 0.3% | 0.3% |
| M2-seasonal-anomaly-decay | -10.1% | -14.5% | -5.6% | 22.3% | 32.2% |
| M3-water-balance | 6.7% | 3.6% | 14.8% | 27.5% | 33.9% |
| M4-gbm-direct | 15.8% | 7.9% | 7.6% | 16.8% | 24.4% |
| M4-gbm-direct-m3 | 12.7% | 7.4% | 5.8% | 17.1% | 23.0% |
| M4-gbm-m3-residual | 9.0% | 2.1% | 7.0% | 16.6% | 25.5% |

Section 7 expected climatological drift to improve on persistence. It does not, at any horizon: a reservoir level is the running total of an operating decision, and last week's decision is a better guide to next week's than the average of six Septembers is. That is recorded here as a measurement, not repaired by tuning.

## Coverage of the published p10–p90 band

| model | h=7 | h=14 | h=30 | h=60 | h=90 |
|---|---|---|---|---|---|
| M0-persistence | 77.7% | 76.6% | 69.9% | 73.9% | 72.5% |
| M1-climatological-drift | 79.8% | 75.5% | 76.3% | 71.7% | 74.7% |
| M2-seasonal-anomaly-decay | 68.1% | 73.4% | 72.0% | 71.7% | 71.4% |
| M3-water-balance | 79.8% | 78.7% | 73.1% | 78.3% | 74.7% |
| M4-gbm-direct | 78.7% | 80.6% | 75.3% | 70.7% | 64.8% |
| M4-gbm-direct-m3 | 78.7% | 80.6% | 76.3% | 71.7% | 68.1% |
| M4-gbm-m3-residual | 79.8% | 76.3% | 67.7% | 77.2% | 69.2% |

Against the model's own ensemble, uncalibrated:

| model | h=7 | h=14 | h=30 | h=60 | h=90 |
|---|---|---|---|---|---|
| M0-persistence | — | — | — | — | — |
| M1-climatological-drift | 68.9% | 63.2% | 54.3% | 63.5% | 52.4% |
| M2-seasonal-anomaly-decay | — | — | — | — | — |
| M3-water-balance | 65.1% | 65.1% | 56.2% | 54.8% | 51.5% |
| M4-gbm-direct | 63.2% | 64.8% | 43.8% | 42.3% | 38.8% |
| M4-gbm-direct-m3 | 66.0% | 61.0% | 43.8% | 45.2% | 36.9% |
| M4-gbm-m3-residual | 67.9% | 57.1% | 43.8% | 47.1% | 35.9% |

The gap between the two tables is the reason the published band is not the ensemble. An ensemble over analogue inflow years knows only what the weather might do; it does not know that the rule curve is an average of several operating regimes, or that the operator can change their mind. Widening by the model's own out-of-sample residuals is what brings coverage back to what it claims.

## Pinball loss, metres (mean over the three published quantiles)

| model | h=7 | h=14 | h=30 | h=60 | h=90 |
|---|---|---|---|---|---|
| M0-persistence | 0.844 | 1.344 | 2.127 | 3.309 | 3.910 |
| M1-climatological-drift | 0.850 | 1.377 | 2.101 | 3.290 | 3.728 |
| M2-seasonal-anomaly-decay | 0.968 | 1.537 | 2.194 | 2.771 | 2.698 |
| M3-water-balance | 0.786 | 1.243 | 1.724 | 2.357 | 2.648 |
| M4-gbm-direct | 0.728 | 1.224 | 1.893 | 2.760 | 2.916 |
| M4-gbm-direct-m3 | 0.736 | 1.187 | 1.903 | 2.743 | 3.025 |
| M4-gbm-m3-residual | 0.759 | 1.258 | 1.860 | 2.725 | 2.897 |

## Bias, metres (mean actual − forecast; positive means the model forecasts too low)

| model | h=7 | h=14 | h=30 | h=60 | h=90 |
|---|---|---|---|---|---|
| M0-persistence | 0.006 | -0.228 | -0.007 | -0.021 | 0.188 |
| M1-climatological-drift | 0.166 | 0.246 | 0.070 | 0.447 | 0.163 |
| M2-seasonal-anomaly-decay | -0.290 | -0.843 | -1.539 | -3.076 | -3.192 |
| M3-water-balance | 0.266 | -0.332 | -1.305 | -2.815 | -3.168 |
| M4-gbm-direct | -0.025 | -0.520 | -1.330 | -2.488 | -1.672 |
| M4-gbm-direct-m3 | -0.080 | -0.694 | -1.518 | -2.833 | -2.021 |
| M4-gbm-m3-residual | -0.084 | -0.683 | -1.318 | -3.057 | -3.156 |

## M4 — gradient-boosted quantile trees

Section 7's last rung, deferred in Phase 5 because no gradient-boosting library exists in a TypeScript-only stack (decision 6). `src/lib/models/gbm.ts` is a dependency-free one: histogram splits, depth-limited trees, shrinkage, row subsampling, and the pinball loss with each leaf re-estimated as the quantile of its residuals; seeded, so a rerun reproduces every tree. One model per horizon and per quantile (p10, p50, p90), refitted from scratch at each of the 106 origins on training days whose outcome had been observed by the origin — about 4,700 fits in all. Settings, fixed before the full run and not tuned against it: 200 trees, learning rate 0.05, depth 3, at least 20 rows a leaf, 80% of rows a tree, 32 bins, one training day in 2.

Features, every one read at or before the training day: level and its 1–60-day changes and its departure from its own trailing year; inflow and its 3–90-day means; production and its 7- and 30-day means; day of year as sine and cosine; ONI as a forecaster could have read it (two months stale, the same `availableAt` the ENSO variant uses) and its three-month change; and **ERA5 precipitation at the Paute's single provisional sampling point** (-2.6, -78.6), summed over 7, 30 and 90 days ending five days before the day, because ERA5 is published about five days late. That last group is one reanalysis grid cell chosen in Phase 0, not a basin average, and today's reanalysis rather than the preliminary values a 2018 forecaster would have read.

Three designs, because whether M3 should be a feature, a target or neither is a measurement: `M4-gbm-direct` predicts the h-day level change from the features alone; `M4-gbm-direct-m3` predicts the same change with M3's forecast (its predicted change, its ensemble width and the operator's stance) among the features; `M4-gbm-m3-residual` predicts M3's error and adds it back, so trees that learn nothing leave M3 as it was. M3 at a training day is M3 as it would have been made that day — the fit from the first of the month, the stance over the thirty days before, earlier years' inflow — and at every scored origin it reproduces the shipped M3's median exactly.

### Mean absolute error, metres, on the same origins

| model | h=7 | h=14 | h=30 | h=60 | h=90 |
|---|---|---|---|---|---|
| M0-persistence | 2.292 | 3.573 | 5.955 | 9.707 | 11.274 |
| M3-water-balance | 2.140 | 3.500 | 5.075 | 7.038 | 7.456 |
| M4-gbm-direct | 1.931 | 3.290 | 5.504 | 8.075 | 8.522 |
| M4-gbm-direct-m3 | 2.001 | 3.308 | 5.609 | 8.051 | 8.677 |
| M4-gbm-m3-residual | 2.085 | 3.497 | 5.540 | 8.093 | 8.396 |

Skill against persistence, and against M3 (1 − MAE/MAE_M3):

| model | h=7 | h=14 | h=30 | h=60 | h=90 |
|---|---|---|---|---|---|
| M3-water-balance | 6.7% / 0.0% | 2.0% / 0.0% | 14.8% / 0.0% | 27.5% / 0.0% | 33.9% / 0.0% |
| M4-gbm-direct | 15.8% / 9.8% | 7.9% / 6.0% | 7.6% / -8.4% | 16.8% / -14.7% | 24.4% / -14.3% |
| M4-gbm-direct-m3 | 12.7% / 6.5% | 7.4% / 5.5% | 5.8% / -10.5% | 17.1% / -14.4% | 23.0% / -16.4% |
| M4-gbm-m3-residual | 9.0% / 2.5% | 2.1% / 0.1% | 7.0% / -9.2% | 16.6% / -15.0% | 25.5% / -12.6% |

### Paired against M3-water-balance: mean of |error| − |error of M3|, metres, with a 90% interval

Negative means M4 was closer. The interval is a circular block bootstrap over origins in blocks of six, because monthly origins with horizons out to ninety days overlap and are not independent; the percentage is the share of origins at which M4 was the closer of the two.

| model | h=7 | h=14 | h=30 | h=60 | h=90 |
|---|---|---|---|---|---|
| M4-gbm-direct | −0.21 [−0.47, +0.06], 52.8% | −0.21 [−0.61, +0.21], 49.5% | +0.43 [−0.18, +1.05], 45.7% | +1.04 [+0.22, +1.92], 40.4% | +1.07 [−0.06, +2.29], 43.7% |
| M4-gbm-direct-m3 | −0.14 [−0.41, +0.14], 49.1% | −0.19 [−0.64, +0.24], 49.5% | +0.53 [−0.05, +1.12], 46.7% | +1.01 [+0.19, +1.88], 45.2% | +1.22 [−0.01, +2.63], 45.6% |
| M4-gbm-m3-residual | −0.05 [−0.25, +0.15], 55.7% | −0.00 [−0.32, +0.33], 48.6% | +0.46 [−0.04, +0.97], 48.6% | +1.05 [+0.27, +1.93], 42.3% | +0.94 [−0.00, +1.95], 33.0% |

### The band

Coverage of the p10–p90 band as the harness publishes every rung's — the median widened by its own out-of-sample residuals — and then of M4's own quantile regressions before any widening (for M3, its analogue ensemble):

| model | h=7 | h=14 | h=30 | h=60 | h=90 |
|---|---|---|---|---|---|
| M3-water-balance | 79.8% | 78.5% | 73.1% | 78.3% | 74.7% |
| M4-gbm-direct | 78.7% | 80.6% | 75.3% | 70.7% | 64.8% |
| M4-gbm-direct-m3 | 78.7% | 80.6% | 76.3% | 71.7% | 68.1% |
| M4-gbm-m3-residual | 79.8% | 76.3% | 67.7% | 77.2% | 69.2% |

| model | h=7 | h=14 | h=30 | h=60 | h=90 |
|---|---|---|---|---|---|
| M3-water-balance | 66.0% | 63.4% | 57.0% | 57.6% | 52.7% |
| M4-gbm-direct | 61.7% | 63.4% | 45.2% | 42.4% | 38.5% |
| M4-gbm-direct-m3 | 66.0% | 61.3% | 45.2% | 45.7% | 37.4% |
| M4-gbm-m3-residual | 68.1% | 58.1% | 44.1% | 51.1% | 36.3% |

Pinball loss, metres, calibrated band and then own quantiles, on the same banded origins:

| model | h=7 | h=14 | h=30 | h=60 | h=90 |
|---|---|---|---|---|---|
| M3-water-balance | 0.786 | 1.250 | 1.724 | 2.357 | 2.648 |
| M4-gbm-direct | 0.728 | 1.224 | 1.893 | 2.760 | 2.916 |
| M4-gbm-direct-m3 | 0.736 | 1.187 | 1.903 | 2.743 | 3.025 |
| M4-gbm-m3-residual | 0.759 | 1.258 | 1.860 | 2.725 | 2.897 |

| model | h=7 | h=14 | h=30 | h=60 | h=90 |
|---|---|---|---|---|---|
| M3-water-balance | 0.747 | 1.147 | 1.716 | 2.447 | 2.654 |
| M4-gbm-direct | 0.673 | 1.166 | 1.977 | 2.869 | 3.062 |
| M4-gbm-direct-m3 | 0.685 | 1.138 | 1.976 | 2.802 | 3.171 |
| M4-gbm-m3-residual | 0.696 | 1.179 | 1.865 | 2.850 | 3.072 |

### Decision

The ladder's rule: a horizon is won when the MAE is below M3-water-balance's *and* the published band's coverage is no further from its nominal 80% than M3's. † marks a win whose paired interval lies wholly below zero.

| model | h=7 | h=14 | h=30 | h=60 | h=90 |
|---|---|---|---|---|---|
| M4-gbm-direct | loses (band) | wins | loses (MAE) | loses (MAE) | loses (MAE) |
| M4-gbm-direct-m3 | loses (band) | wins | loses (MAE) | loses (MAE) | loses (MAE) |
| M4-gbm-m3-residual | wins | loses (band) | loses (MAE) | loses (MAE) | loses (MAE) |

**M4 wins only in places** (M4-gbm-direct at 14 d, M4-gbm-direct-m3 at 14 d, M4-gbm-m3-residual at 7 d) and no variant wins everywhere. `forecast.json` would publish M4-gbm-direct at 7 days, but this run fell back to M3: in the M4 snapshot M4-gbm-direct no longer beats M3-water-balance at 7 d under the ladder rule.

### The crisis check at M4's resolution

M4 forecasts five horizons, not a daily path, so its call on 2115 m is the first horizon at which the quantile is at or below it — a crossing within 90 days or none. M3 is read the same way here (its median and its ensemble's p10 on the same grid), so the two are compared at one resolution; the day-by-day, 365-day version in the crisis section below is M3's own. The same strict rule applies: a call counts only if sustained to the crossing, and lands no more than a week after it.

| level first at or below | model | P50 called it from | P50 lead | P10 called it from | P10 lead |
|---|---|---|---|---|---|
| 2024-04-11 | M3-water-balance | **never** | — | **never** | — |
| 2024-04-11 | M4-gbm-direct | **never** | — | 2024-04-01 | 10 d |
| 2024-04-11 | M4-gbm-direct-m3 | **never** | — | 2024-04-01 | 10 d |
| 2024-04-11 | M4-gbm-m3-residual | **never** | — | 2024-04-01 | 10 d |
| 2024-10-08 | M3-water-balance | **never** | — | 2024-10-01 | 7 d |
| 2024-10-08 | M4-gbm-direct | **never** | — | **never** | — |
| 2024-10-08 | M4-gbm-direct-m3 | **never** | — | 2024-10-01 | 7 d |
| 2024-10-08 | M4-gbm-m3-residual | **never** | — | 2024-10-01 | 7 d |

Run-up to 2024-04-11, where each model's P50 / P10 put the crossing (— : not within 90 days):

| origin | M3-water-balance | M4-gbm-direct | M4-gbm-direct-m3 | M4-gbm-m3-residual |
|---|---|---|---|---|
| 2023-11-01 | 2023-11-08 / 2023-11-08 | 2023-11-08 / 2023-11-08 | — / 2023-11-08 | 2023-11-08 / 2023-11-08 |
| 2023-12-01 | — / — | — / — | — / — | — / — |
| 2024-01-01 | — / — | — / — | — / — | — / — |
| 2024-02-01 | — / 2024-03-02 | — / — | — / — | — / — |
| 2024-03-01 | — / — | — / — | — / — | — / — |
| 2024-04-01 | — / — | — / 2024-04-08 | — / 2024-04-08 | — / 2024-04-08 |

Run-up to 2024-10-08, where each model's P50 / P10 put the crossing (— : not within 90 days):

| origin | M3-water-balance | M4-gbm-direct | M4-gbm-direct-m3 | M4-gbm-m3-residual |
|---|---|---|---|---|
| 2024-05-01 | — / — | — / — | — / — | — / — |
| 2024-06-01 | — / — | — / — | — / — | — / — |
| 2024-07-01 | — / — | — / — | — / — | — / — |
| 2024-08-01 | — / — | — / — | — / — | — / — |
| 2024-09-01 | — / — | — / — | — / — | — / — |
| 2024-10-01 | — / 2024-10-08 | — / 2024-10-31 | — / 2024-10-15 | — / 2024-10-08 |

False alarms (P50 named a crossing within thirty days that did not come within sixty days of it), over 106 origins: M3-water-balance 1, M4-gbm-direct 1, M4-gbm-direct-m3 0, M4-gbm-m3-residual 1.

### What the run says

**Where it wins: one week out, and since 2026-10-13 not clearly.** Against the M3 of 2026-09-24 every design beat M3 at seven days by 0.26–0.36 m with the paired interval below zero — the first short-range skill on this ladder — because a week out the level is mostly what the operator is doing this week, and the last few days' level change and production say that more directly than a rule curve averaged over years. Much of that edge was M3 starting every analogue year from that year's river instead of today's. With M3's years started from today's river (2026-10-13), M3 itself is 6.7% better than persistence at seven days, the direct design's lead shrinks to 0.21 m with an interval that crosses zero, and its band (78.7%) is no longer nearer 80% than M3's (79.8%). The residual design meets the rule at seven days by 0.05 m, and the two direct designs at fourteen days by 0.2 m, all with intervals across zero: wins by the letter of the rule, not measurements.

**Where it loses: past a month, clearly.** At sixty days every design is worse than M3 by about a metre, with the paired interval above zero, and at ninety by 0.9–1.2 m with the interval just reaching zero — a measured negative in the same sense as M1's. Two months out the level is decided by inflow that has not fallen yet and by how the operator responds to the level on the way; the water balance has both built in, and the trees have to learn them from at most a decade of overlapping windows that contains only a handful of drawdowns. Their own quantiles are badly overconfident there (36–51% inside a nominal 80% at 60–90 days); widening by residuals brings that to 65–77%, still short of M3's 75–78%.

**M3 as a feature or as the target does not rescue the long horizons.** Predicting M3's residual was the design most likely to keep M3's long-range skill, since trees that learn nothing leave M3 untouched. It does not: the corrections learned on earlier years move the 60- and 90-day median the wrong way often enough to cost about a metre. Giving the trees M3's forecast as a feature is no better. At seven days the design that never sees M3 is the most accurate of the three, so the short-range gain comes from the recent-state features, not from M3.

**Crisis check.** On this five-horizon grid no design's P50 called either 2024 crossing, and neither did M3's (on its own daily path, M3's P50 has called October seven days out since its years start from today's river). The P10 of all three designs called April 2024 ten days out, from an origin at 2116.7 m — a crossing no quantile of M3 called — but `M4-gbm-direct` then missed October, which M3's dry tail and the two M3-informed designs called seven days out. A ten-day call from 1.7 m above the line is short-range extrapolation, not early warning.

**What `forecast.json` does with it (adopted 2026-09-22, design changed 2026-10-03, fallen back 2026-10-13).** It switches by horizon, not wholesale, when the snapshot earns it: one M4 design's median at seven days and M3 at 14–90 days, for the three named scenarios and for the days-to-threshold distribution, which need a daily simulated path M4 does not produce. From 2026-09-22 the design was `M4-gbm-m3-residual`, which won on the provisional rain point; on the verified centroid it no longer did, seven days fell back to M3 from 2026-09-24, and on 2026-10-03 the owner moved the seven-day point to `M4-gbm-direct`. Its live record was poor — from the 2026-10-03 and -04 origins its median put Mazar above where it started, and the reservoir finished 4.7 and 6.9 m below it — and against the M3 of 2026-10-13 it no longer meets the ladder's rule, so seven days publishes M3 and `horizon_switch` says why. The switch is still wired: the daily run fits the named design at the live origin for seven days only, with the settings and features this snapshot was scored with, and bands it with the residual quantiles recorded here. A run never switches to another design by itself; moving seven days to `M4-gbm-m3-residual`, which meets the rule there by 0.05 m, would be the owner's call, and is not recommended on a margin that size.

Runtime: 421 s, single-threaded, for the whole run on the machine that produced this snapshot, which is why it is its own command and not part of the CI dry-run or the daily forecast. To refresh it: `npm run backtest:m4`, then `npm run forecast` to render it here.

## Does conditioning the analogue years on ENSO phase help?

No. Scored over the 59 origins where both variants could forecast — the matched variant declines the rest, because narrowing an analogue pool of barely a dozen members by ENSO phase often leaves too few to form an ensemble at all:

| model | h=7 | h=14 | h=30 | h=60 | h=90 |
|---|---|---|---|---|---|
| M3-water-balance | 2.155 | 3.430 | 5.647 | 7.447 | 8.023 |
| M3-water-balance-enso | 2.276 | 3.652 | 6.408 | 8.374 | 8.652 |

The phase used is the one a forecaster could actually have read at each origin: ONI is a three-month mean centred on its label, so the newest value available on any day is about two months old, and the backtest never looks through that lag. Basin precipitation is the other conditioner, and its upper bound is the next section.

## Does knowing the next 16 days of rain help? (§5.4, perfect foresight)

The upper bound first. At each origin the analogue pool is narrowed to the half of the years whose ERA5 rain over the 16 days after the same calendar day was nearest the rain that *actually fell* after the origin, at `paute_mazar` (the verified catchment centroid). No forecaster has that; it is the most a rain forecast could ever be worth to this model. Same origins as the ladder:

| model | h=7 | h=14 | h=30 | h=60 | h=90 |
|---|---|---|---|---|---|
| M0-persistence | 2.292 (0.0%) | 3.609 (0.0%) | 5.955 (0.0%) | 9.779 (0.0%) | 11.265 (0.0%) |
| M3-water-balance | 2.140 (6.7%) | 3.479 (3.6%) | 5.075 (14.8%) | 6.859 (29.9%) | 7.456 (33.8%) |
| M3-water-balance-rain-pf | 2.123 (7.4%) | 3.425 (5.1%) | 5.393 (9.4%) | 7.140 (27.0%) | 7.424 (34.1%) |

MAE in metres, skill against persistence in brackets. Coverage of the calibrated p10–p90 band:

| model | h=7 | h=14 | h=30 | h=60 | h=90 |
|---|---|---|---|---|---|
| M3-water-balance | 79.8% | 78.7% | 73.1% | 74.4% | 71.3% |
| M3-water-balance-rain-pf | 79.8% | 81.9% | 76.3% | 72.2% | 73.6% |

**Perfect foresight helps at 14 days** (3.425 m against 3.479 m). The next step is to replay Open-Meteo's previous-runs archive for the real forecast's skill before anything is published; nothing is wired until then.

Scheduling note for when it does help: `covariates.yml` collects the forecast at 17:00 UTC, after both daily runs, so a model would read yesterday's vintage. The forecast fetch would have to move ahead of the 12:15 run, or into it.

## Should every horizon share one ensemble? (§5.7)

Each analogue year is simulated once and read at every horizon it reaches, which is what the shipped model does and changed no published number. Sharing members outright means reading every horizon off only the years whose inflow record reaches ninety days, so a 7-day fan and a 90-day fan are the same years. Same origins:

| model | h=7 | h=14 | h=30 | h=60 | h=90 |
|---|---|---|---|---|---|
| M3-water-balance | 2.140 | 3.479 | 5.075 | 7.038 | 7.456 |
| M3-water-balance-shared-members | 2.121 | 3.510 | 5.162 | 7.058 | 7.456 |

MAE in metres. Coverage of the calibrated band:

| model | h=7 | h=14 | h=30 | h=60 | h=90 |
|---|---|---|---|---|---|
| M3-water-balance | 79.8% | 78.7% | 73.1% | 78.3% | 74.7% |
| M3-water-balance-shared-members | 79.8% | 78.7% | 76.3% | 77.2% | 74.7% |

**Negative: not better at 14, 30, 60, 90 d**, and the ladder's rule asks for every horizon. The shipped model keeps every year a horizon can use; dropping the years whose record stops short of ninety days takes members from the short horizons, and whatever it gains elsewhere is not enough to pay for that everywhere.

## Does starting each analogue year from today's river help? (adopted 2026-10-13)

Replayed as it was, an analogue year brings its own starting flow as well as its weather. On 2026-10-11, with the Paute at about 25 m³/s for a week and Mazar falling more than a metre a day, the median member brought 70–80 m³/s over the next fortnight, because most Octobers began wetter, and M3 forecast a refill in the middle of a drawdown. The years that began as dry — 2010, 2018, 2023, 2024 — brought 23–26. The shipped model multiplies each member by today's trailing 7-day inflow over that year's, clamped to 0.33–3 (the inflow forecast's window and clamp), and lets the multiplier fade with a 15-day half-life. Same origins:

| model | h=7 | h=14 | h=30 | h=60 | h=90 |
|---|---|---|---|---|---|
| M3-water-balance-replayed | 2.296 | 3.585 | 5.912 | 7.331 | 7.358 |
| M3-water-balance | 2.140 | 3.479 | 5.075 | 7.038 | 7.456 |
| M3-water-balance-half-life-10 | 2.149 | 3.484 | 5.367 | 7.089 | 7.406 |
| M3-water-balance-half-life-20 | 2.148 | 3.508 | 4.951 | 7.055 | 7.447 |
| M3-water-balance-half-life-30 | 2.161 | 3.567 | 4.891 | 7.101 | 7.524 |

MAE in metres. Bias (actual − forecast; negative means the forecast was too high):

| model | h=7 | h=14 | h=30 | h=60 | h=90 |
|---|---|---|---|---|---|
| M3-water-balance-replayed | -0.32 | -1.22 | -2.56 | -3.63 | -3.64 |
| M3-water-balance | 0.27 | -0.33 | -1.31 | -2.81 | -3.17 |
| M3-water-balance-half-life-10 | 0.26 | -0.52 | -1.71 | -3.27 | -3.37 |
| M3-water-balance-half-life-20 | 0.26 | -0.21 | -1.07 | -2.48 | -2.98 |
| M3-water-balance-half-life-30 | 0.26 | -0.08 | -0.64 | -2.02 | -2.70 |

Coverage of the calibrated band:

| model | h=7 | h=14 | h=30 | h=60 | h=90 |
|---|---|---|---|---|---|
| M3-water-balance-replayed | 73.4% | 77.7% | 80.6% | 73.9% | 72.5% |
| M3-water-balance | 79.8% | 78.7% | 73.1% | 78.3% | 74.7% |
| M3-water-balance-half-life-10 | 79.8% | 74.5% | 76.3% | 77.2% | 73.6% |
| M3-water-balance-half-life-20 | 81.9% | 78.7% | 74.2% | 77.2% | 73.6% |
| M3-water-balance-half-life-30 | 81.9% | 78.7% | 74.2% | 80.4% | 74.7% |

Paired, M3-water-balance against M3-water-balance-replayed: mean of |error| − |error of the replayed years|, metres, with a 90% block-bootstrap interval and the share of origins where the shipped model was closer:

| | h=7 | h=14 | h=30 | h=60 | h=90 |
|---|---|---|---|---|---|
| M3-water-balance | −0.16 [−0.45, +0.12], 57.5% | −0.11 [−0.56, +0.31], 47.2% | −0.84 [−1.47, −0.26], 59.0% | −0.29 [−0.81, +0.23], 56.7% | +0.10 [−0.21, +0.41], 61.2% |

The crisis check against 2115 m, on the daily 365-day simulation, for both:

| model | lead time to each crossing | false alarms at P50 |
|---|---|---|
| M3-water-balance-replayed | 2024-04-11: P50 never, P10 never; 2024-10-08: P50 never, P10 7 d | 1 of 106 |
| M3-water-balance | 2024-04-11: P50 never, P10 never; 2024-10-08: P50 7 d, P10 7 d | 1 of 106 |

**Adopted, and it does not meet the ladder's rule outright: band further from 80% (73.1% against 80.6%) at 30 d; higher MAE (paired +0.10 m, [−0.21, +0.41]) at 90 d.** Read the paired row before the MAE row: the adoption (2026-10-13) rested on a thirty-day gain whose interval lay below zero against a ninety-day loss whose interval straddled it, a band a few origins in about ninety short of the replayed years' at thirty days, the fourteen- and thirty-day optimism halved, and a P50 that called the October 2024 crossing where the replayed years' never did. Setting `DEFAULT_WATER_BALANCE.inflowState` to null restores the replayed years everywhere, M4's M3 features included.

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


False alarms: across 106 origins, the P50 named a crossing within thirty days that did not happen on 1 of them. A lead time means nothing without this number — a model that predicts a crossing every month has perfect lead time and no information.

## What the model fitted, at the last origin

| quantity | value | where it comes from |
|---|---|---|
| area-elevation exponent | 2.50 | fitted |
| area-elevation datum | 2036.7 m | fitted |
| fit residual | 0.693 m/day over 2034 days | fitted |
| turbined flow per MW | 0.668 m³/s | fitted jointly with the curve |
| storage, lowest declared minimum → crest | 229.4 hm³ | integral of the fitted curve |
| release rule points | 19 | median implied release over 4333 days |
| operator's current stance | 10.4 m³/s vs the rule | trailing 30 days |
| crest used as the spill cap | 2155.83 m | highest level in the record |

The 410 hm³ in `plants.csv` is marked `unverified` and came from press; the storage above is the integral of a curve fitted to this repository's own readings, and the two disagree by about a factor of two. That gap cannot be closed by preferring the bigger number: the area curve and the turbine's flow-per-MW are fitted *together*, and doubling the area drives the flow-per-MW down through zero — a turbine that consumes no water. The balance closes at one scale. The check that does pass is `repDiaPotQTurb`'s 113 days of turbined flow, whose maximum is about 129 m³/s, against the fitted 114 m³/s at Mazar's rated 170 MW.

The bias table above shows this model forecasting high at the long horizons, so correcting the median by its own trailing residual was tried. It is *worse* at every horizon — the bias is not a stable offset but a handful of origins during the 2024 drawdown, and a running median chases them after the fact. The median is therefore published uncorrected, with the residual beside it in `forecast.json` as `median_backtest_residual_m` so a reader can apply their own judgement.

## The fitted release rule

| level, masl | median implied release, m³/s |
|---|---|
| 2110.0 | 10.5 |
| 2112.5 | 15.1 |
| 2115.0 | 29.8 |
| 2117.5 | 28.0 |
| 2120.0 | 35.4 |
| 2122.5 | 38.1 |
| 2125.0 | 35.8 |
| 2127.5 | 48.5 |
| 2130.0 | 55.5 |
| 2132.5 | 62.1 |
| 2135.0 | 69.8 |
| 2137.5 | 53.8 |
| 2140.0 | 53.5 |
| 2142.5 | 54.0 |
| 2145.0 | 57.9 |
| 2147.5 | 59.9 |
| 2150.0 | 60.7 |
| 2152.5 | 85.3 |
| 2155.0 | 222.7 |

This curve is why the water balance works at all. Run open-loop — release held at whatever it recently was, as section 7 originally specified — the same model loses to persistence at every horizon, because a simulated reservoir that never reacts either fills until it spills or empties until it is dry. Reading the release back off the level on every simulated day is the whole difference.

