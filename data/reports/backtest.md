# Backtest — mazar level forecast

Generated 2026-09-25T20:11:35Z from the committed tables; no network. Origins are the first of each month, each one refitting every model on the data before it. 105 origins scored per horizon, 93 of them with a calibrated band (the first twelve are the calibration's warm-up).

Level history: 4388 days, 2014-09-20 → 2026-09-24.

## Verdict

**M3-water-balance ships.** At 90 days it is 34.8% better than persistence; at 7 days it is -0.1%, which is to say indistinguishable from doing nothing, and the forecast document says so rather than implying a precision the measurement does not support.

It is not the only rung that beats persistence — M2-seasonal-anomaly-decay does too at the long horizons — but it is chosen because it is at least as good as all of them at *every* horizon, and because its state is interpretable: a storage curve, a release rule and a set of named analogue years, each of which can be inspected and argued with.

**7 days would publish M4-gbm-m3-residual, but this run falls back to M3-water-balance:** in the M4 snapshot M4-gbm-m3-residual no longer beats M3-water-balance at 7 d under the ladder rule Every horizon of `forecast.json` is M3-water-balance until the M4 backtest covers the ladder again, and the document says so in `horizon_switch`.

**M4 (gradient-boosted quantile trees) was run on the same backtest** (`npm run backtest:m4`, 105 origins). It beats M3-water-balance only in places — M4-gbm-direct at 7 d, M4-gbm-direct at 14 d, M4-gbm-direct-m3 at 7 d, M4-gbm-direct-m3 at 14 d, M4-gbm-m3-residual at 14 d — and nowhere across all horizons, so M3 still ships.

## Mean absolute error, metres

| model | h=7 | h=14 | h=30 | h=60 | h=90 |
|---|---|---|---|---|---|
| M0-persistence | 2.291 | 3.573 | 5.857 | 9.601 | 11.208 |
| M1-climatological-drift | 2.345 | 3.780 | 6.213 | 9.626 | 11.220 |
| M2-seasonal-anomaly-decay | 2.519 | 4.077 | 6.193 | 7.454 | 7.560 |
| M3-water-balance | 2.292 | 3.616 | 5.851 | 7.253 | 7.305 |
| M4-gbm-direct | 1.937 | 3.290 | 5.410 | 8.028 | 8.545 |
| M4-gbm-direct-m3 | 2.018 | 3.433 | 5.551 | 7.977 | 8.709 |
| M4-gbm-m3-residual | 2.027 | 3.358 | 5.835 | 8.056 | 8.346 |

The M4 rows come from `npm run backtest:m4` (run 2026-09-24T15:36:08Z), which refits them at the same 105 origins through the same harness; they are rendered from its committed snapshot because refitting about 4,700 boosted models does not belong in the daily run. See [M4](#m4--gradient-boosted-quantile-trees) below.

## Skill against persistence (1 − MAE/MAE₀)

| model | h=7 | h=14 | h=30 | h=60 | h=90 |
|---|---|---|---|---|---|
| M0-persistence | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% |
| M1-climatological-drift | -2.4% | -5.8% | -6.1% | -0.3% | -0.1% |
| M2-seasonal-anomaly-decay | -10.0% | -14.1% | -5.8% | 22.4% | 32.5% |
| M3-water-balance | -0.1% | -1.2% | 0.1% | 24.5% | 34.8% |
| M4-gbm-direct | 15.5% | 7.9% | 7.6% | 16.4% | 23.8% |
| M4-gbm-direct-m3 | 11.9% | 3.9% | 5.2% | 16.9% | 22.3% |
| M4-gbm-m3-residual | 11.5% | 6.0% | 0.4% | 16.1% | 25.5% |

Section 7 expected climatological drift to improve on persistence. It does not, at any horizon: a reservoir level is the running total of an operating decision, and last week's decision is a better guide to next week's than the average of six Septembers is. That is recorded here as a measurement, not repaired by tuning.

## Coverage of the published p10–p90 band

| model | h=7 | h=14 | h=30 | h=60 | h=90 |
|---|---|---|---|---|---|
| M0-persistence | 77.4% | 77.4% | 70.7% | 74.7% | 72.2% |
| M1-climatological-drift | 79.6% | 76.3% | 77.2% | 72.5% | 74.4% |
| M2-seasonal-anomaly-decay | 67.7% | 74.2% | 72.8% | 71.4% | 71.1% |
| M3-water-balance | 74.2% | 77.4% | 80.4% | 73.6% | 72.2% |
| M4-gbm-direct | 78.5% | 80.6% | 76.1% | 70.3% | 64.4% |
| M4-gbm-direct-m3 | 76.3% | 77.4% | 71.7% | 71.4% | 66.7% |
| M4-gbm-m3-residual | 73.1% | 77.4% | 79.3% | 73.6% | 62.2% |

Against the model's own ensemble, uncalibrated:

| model | h=7 | h=14 | h=30 | h=60 | h=90 |
|---|---|---|---|---|---|
| M0-persistence | — | — | — | — | — |
| M1-climatological-drift | 68.6% | 63.8% | 53.8% | 64.1% | 52.9% |
| M2-seasonal-anomaly-decay | — | — | — | — | — |
| M3-water-balance | 61.0% | 60.0% | 51.0% | 53.4% | 52.9% |
| M4-gbm-direct | 62.9% | 64.8% | 44.2% | 42.7% | 39.2% |
| M4-gbm-direct-m3 | 65.7% | 62.9% | 43.3% | 41.7% | 40.2% |
| M4-gbm-m3-residual | 64.8% | 61.9% | 46.2% | 41.7% | 35.3% |

The gap between the two tables is the reason the published band is not the ensemble. An ensemble over analogue inflow years knows only what the weather might do; it does not know that the rule curve is an average of several operating regimes, or that the operator can change their mind. Widening by the model's own out-of-sample residuals is what brings coverage back to what it claims.

## Pinball loss, metres (mean over the three published quantiles)

| model | h=7 | h=14 | h=30 | h=60 | h=90 |
|---|---|---|---|---|---|
| M0-persistence | 0.846 | 1.337 | 2.090 | 3.278 | 3.905 |
| M1-climatological-drift | 0.853 | 1.369 | 2.092 | 3.280 | 3.732 |
| M2-seasonal-anomaly-decay | 0.970 | 1.522 | 2.171 | 2.763 | 2.689 |
| M3-water-balance | 0.850 | 1.293 | 1.873 | 2.434 | 2.572 |
| M4-gbm-direct | 0.732 | 1.224 | 1.865 | 2.757 | 2.926 |
| M4-gbm-direct-m3 | 0.741 | 1.258 | 1.890 | 2.729 | 3.068 |
| M4-gbm-m3-residual | 0.775 | 1.266 | 2.015 | 2.710 | 2.975 |

## Bias, metres (mean actual − forecast; positive means the model forecasts too low)

| model | h=7 | h=14 | h=30 | h=60 | h=90 |
|---|---|---|---|---|---|
| M0-persistence | 0.029 | -0.160 | 0.148 | 0.179 | 0.367 |
| M1-climatological-drift | 0.187 | 0.318 | 0.186 | 0.601 | 0.291 |
| M2-seasonal-anomaly-decay | -0.264 | -0.756 | -1.402 | -2.945 | -3.068 |
| M3-water-balance | -0.351 | -1.229 | -2.471 | -3.512 | -3.545 |
| M4-gbm-direct | -0.038 | -0.520 | -1.196 | -2.387 | -1.628 |
| M4-gbm-direct-m3 | -0.081 | -0.563 | -1.269 | -2.611 | -1.751 |
| M4-gbm-m3-residual | -0.203 | -0.493 | -1.528 | -3.369 | -3.107 |

## M4 — gradient-boosted quantile trees

Section 7's last rung, deferred in Phase 5 because no gradient-boosting library exists in a TypeScript-only stack (decision 6). `src/lib/models/gbm.ts` is a dependency-free one: histogram splits, depth-limited trees, shrinkage, row subsampling, and the pinball loss with each leaf re-estimated as the quantile of its residuals; seeded, so a rerun reproduces every tree. One model per horizon and per quantile (p10, p50, p90), refitted from scratch at each of the 105 origins on training days whose outcome had been observed by the origin — about 4,700 fits in all. Settings, fixed before the full run and not tuned against it: 200 trees, learning rate 0.05, depth 3, at least 20 rows a leaf, 80% of rows a tree, 32 bins, one training day in 2.

Features, every one read at or before the training day: level and its 1–60-day changes and its departure from its own trailing year; inflow and its 3–90-day means; production and its 7- and 30-day means; day of year as sine and cosine; ONI as a forecaster could have read it (two months stale, the same `availableAt` the ENSO variant uses) and its three-month change; and **ERA5 precipitation at the Paute's single provisional sampling point** (-2.6, -78.6), summed over 7, 30 and 90 days ending five days before the day, because ERA5 is published about five days late. That last group is one reanalysis grid cell chosen in Phase 0, not a basin average, and today's reanalysis rather than the preliminary values a 2018 forecaster would have read.

Three designs, because whether M3 should be a feature, a target or neither is a measurement: `M4-gbm-direct` predicts the h-day level change from the features alone; `M4-gbm-direct-m3` predicts the same change with M3's forecast (its predicted change, its ensemble width and the operator's stance) among the features; `M4-gbm-m3-residual` predicts M3's error and adds it back, so trees that learn nothing leave M3 as it was. M3 at a training day is M3 as it would have been made that day — the fit from the first of the month, the stance over the thirty days before, earlier years' inflow — and at every scored origin it reproduces the shipped M3's median exactly.

### Mean absolute error, metres, on the same origins

| model | h=7 | h=14 | h=30 | h=60 | h=90 |
|---|---|---|---|---|---|
| M0-persistence | 2.291 | 3.573 | 5.857 | 9.601 | 11.208 |
| M3-water-balance | 2.292 | 3.616 | 5.851 | 7.253 | 7.305 |
| M4-gbm-direct | 1.937 | 3.290 | 5.410 | 8.028 | 8.545 |
| M4-gbm-direct-m3 | 2.018 | 3.433 | 5.551 | 7.977 | 8.709 |
| M4-gbm-m3-residual | 2.027 | 3.358 | 5.835 | 8.056 | 8.346 |

Skill against persistence, and against M3 (1 − MAE/MAE_M3):

| model | h=7 | h=14 | h=30 | h=60 | h=90 |
|---|---|---|---|---|---|
| M3-water-balance | -0.1% / 0.0% | -1.2% / 0.0% | 0.1% / 0.0% | 24.5% / 0.0% | 34.8% / 0.0% |
| M4-gbm-direct | 15.5% / 15.5% | 7.9% / 9.0% | 7.6% / 7.5% | 16.4% / -10.7% | 23.8% / -17.0% |
| M4-gbm-direct-m3 | 11.9% / 12.0% | 3.9% / 5.1% | 5.2% / 5.1% | 16.9% / -10.0% | 22.3% / -19.2% |
| M4-gbm-m3-residual | 11.5% / 11.6% | 6.0% / 7.1% | 0.4% / 0.3% | 16.1% / -11.1% | 25.5% / -14.3% |

### Paired against M3-water-balance: mean of |error| − |error of M3|, metres, with a 90% interval

Negative means M4 was closer. The interval is a circular block bootstrap over origins in blocks of six, because monthly origins with horizons out to ninety days overlap and are not independent; the percentage is the share of origins at which M4 was the closer of the two.

| model | h=7 | h=14 | h=30 | h=60 | h=90 |
|---|---|---|---|---|---|
| M4-gbm-direct | −0.36 [−0.62, −0.10], 66.7% | −0.33 [−0.83, +0.18], 52.4% | −0.44 [−1.11, +0.22], 56.7% | +0.78 [+0.12, +1.46], 43.7% | +1.24 [+0.17, +2.52], 43.1% |
| M4-gbm-direct-m3 | −0.27 [−0.54, −0.01], 62.9% | −0.18 [−0.70, +0.33], 53.3% | −0.30 [−0.89, +0.32], 53.8% | +0.72 [+0.06, +1.45], 39.8% | +1.40 [+0.20, +2.84], 44.1% |
| M4-gbm-m3-residual | −0.27 [−0.47, −0.07], 60.0% | −0.26 [−0.78, +0.26], 56.2% | −0.02 [−0.62, +0.65], 60.6% | +0.80 [+0.09, +1.51], 45.6% | +1.04 [+0.05, +2.12], 38.2% |

### The band

Coverage of the p10–p90 band as the harness publishes every rung's — the median widened by its own out-of-sample residuals — and then of M4's own quantile regressions before any widening (for M3, its analogue ensemble):

| model | h=7 | h=14 | h=30 | h=60 | h=90 |
|---|---|---|---|---|---|
| M3-water-balance | 74.2% | 77.4% | 80.4% | 73.6% | 72.2% |
| M4-gbm-direct | 78.5% | 80.6% | 76.1% | 70.3% | 64.4% |
| M4-gbm-direct-m3 | 76.3% | 77.4% | 71.7% | 71.4% | 66.7% |
| M4-gbm-m3-residual | 73.1% | 77.4% | 79.3% | 73.6% | 62.2% |

| model | h=7 | h=14 | h=30 | h=60 | h=90 |
|---|---|---|---|---|---|
| M3-water-balance | 60.2% | 59.1% | 52.2% | 56.0% | 52.2% |
| M4-gbm-direct | 61.3% | 63.4% | 45.7% | 42.9% | 38.9% |
| M4-gbm-direct-m3 | 65.6% | 61.3% | 45.7% | 41.8% | 41.1% |
| M4-gbm-m3-residual | 63.4% | 61.3% | 46.7% | 44.0% | 35.6% |

Pinball loss, metres, calibrated band and then own quantiles, on the same banded origins:

| model | h=7 | h=14 | h=30 | h=60 | h=90 |
|---|---|---|---|---|---|
| M3-water-balance | 0.850 | 1.293 | 1.873 | 2.434 | 2.572 |
| M4-gbm-direct | 0.732 | 1.224 | 1.865 | 2.757 | 2.926 |
| M4-gbm-direct-m3 | 0.741 | 1.258 | 1.890 | 2.729 | 3.068 |
| M4-gbm-m3-residual | 0.775 | 1.266 | 2.015 | 2.710 | 2.975 |

| model | h=7 | h=14 | h=30 | h=60 | h=90 |
|---|---|---|---|---|---|
| M3-water-balance | 0.808 | 1.224 | 1.883 | 2.481 | 2.624 |
| M4-gbm-direct | 0.675 | 1.166 | 1.930 | 2.833 | 3.061 |
| M4-gbm-direct-m3 | 0.694 | 1.148 | 1.965 | 2.775 | 3.127 |
| M4-gbm-m3-residual | 0.709 | 1.142 | 1.950 | 2.938 | 3.119 |

### Decision

The ladder's rule: a horizon is won when the MAE is below M3-water-balance's *and* the published band's coverage is no further from its nominal 80% than M3's. † marks a win whose paired interval lies wholly below zero.

| model | h=7 | h=14 | h=30 | h=60 | h=90 |
|---|---|---|---|---|---|
| M4-gbm-direct | wins † | wins | loses (band) | loses (MAE) | loses (MAE) |
| M4-gbm-direct-m3 | wins † | wins | loses (band) | loses (MAE) | loses (MAE) |
| M4-gbm-m3-residual | loses (band) | wins | loses (band) | loses (MAE) | loses (MAE) |

**M4 wins only in places** (M4-gbm-direct at 7 d †, M4-gbm-direct at 14 d, M4-gbm-direct-m3 at 7 d †, M4-gbm-direct-m3 at 14 d, M4-gbm-m3-residual at 14 d) and no variant wins everywhere. `forecast.json` would publish M4-gbm-m3-residual at 7 days, but this run fell back to M3: in the M4 snapshot M4-gbm-m3-residual no longer beats M3-water-balance at 7 d under the ladder rule

### The crisis check at M4's resolution

M4 forecasts five horizons, not a daily path, so its call on 2115 m is the first horizon at which the quantile is at or below it — a crossing within 90 days or none. M3 is read the same way here (its median and its ensemble's p10 on the same grid), so the two are compared at one resolution; the day-by-day, 365-day version in the crisis section below is M3's own. The same strict rule applies: a call counts only if sustained to the crossing, and lands no more than a week after it.

| level first at or below | model | P50 called it from | P50 lead | P10 called it from | P10 lead |
|---|---|---|---|---|---|
| 2024-04-11 | M3-water-balance | **never** | — | **never** | — |
| 2024-04-11 | M4-gbm-direct | **never** | — | 2024-04-01 | 10 d |
| 2024-04-11 | M4-gbm-direct-m3 | **never** | — | 2024-04-01 | 10 d |
| 2024-04-11 | M4-gbm-m3-residual | **never** | — | **never** | — |
| 2024-10-08 | M3-water-balance | **never** | — | 2024-10-01 | 7 d |
| 2024-10-08 | M4-gbm-direct | **never** | — | **never** | — |
| 2024-10-08 | M4-gbm-direct-m3 | **never** | — | 2024-10-01 | 7 d |
| 2024-10-08 | M4-gbm-m3-residual | 2024-10-01 | 7 d | 2024-10-01 | 7 d |

Run-up to 2024-04-11, where each model's P50 / P10 put the crossing (— : not within 90 days):

| origin | M3-water-balance | M4-gbm-direct | M4-gbm-direct-m3 | M4-gbm-m3-residual |
|---|---|---|---|---|
| 2023-11-01 | — / 2023-11-08 | 2023-11-08 / 2023-11-08 | 2023-11-08 / 2023-11-08 | 2023-11-08 / 2023-11-08 |
| 2023-12-01 | — / — | — / — | — / — | — / — |
| 2024-01-01 | — / — | — / — | — / — | — / — |
| 2024-02-01 | — / — | — / — | — / — | — / — |
| 2024-03-01 | — / — | — / — | — / — | — / — |
| 2024-04-01 | — / — | — / 2024-04-08 | — / 2024-04-08 | — / — |

Run-up to 2024-10-08, where each model's P50 / P10 put the crossing (— : not within 90 days):

| origin | M3-water-balance | M4-gbm-direct | M4-gbm-direct-m3 | M4-gbm-m3-residual |
|---|---|---|---|---|
| 2024-05-01 | — / — | — / — | — / — | — / — |
| 2024-06-01 | — / — | — / — | — / — | — / — |
| 2024-07-01 | — / — | — / — | — / — | — / — |
| 2024-08-01 | — / — | — / — | — / — | — / — |
| 2024-09-01 | — / — | — / — | — / — | — / — |
| 2024-10-01 | — / 2024-10-08 | — / 2024-10-31 | — / 2024-10-15 | 2024-10-15 / 2024-10-08 |

False alarms (P50 named a crossing within thirty days that did not come within sixty days of it), over 105 origins: M3-water-balance 0, M4-gbm-direct 1, M4-gbm-direct-m3 1, M4-gbm-m3-residual 1.

### What the run says

**Where it wins: one week out.** Every design beats M3 at seven days, by 0.24–0.27 m (MAE 2.02–2.05 m against 2.29 m), which is 11–12% better than persistence at the one horizon where M3 and every earlier rung only tied with it — the first short-range skill anything on this ladder has shown. For the direct and residual designs the paired interval lies below zero. A week out, the level is mostly what the operator is doing this week, and the last few days' level change and production say that more directly than a rule curve averaged over years. At fourteen days the MAE is still lower (by 0.15–0.29 m) but the interval straddles zero; at thirty the direct design's 0.37 m gain comes with a band that covers 76% against M3's 80%, and the other two are within 0.12 m of M3.

**Where it loses: past a month, clearly.** At sixty and ninety days every design is worse than M3 by 0.8–1.6 m, with the paired interval above zero — a measured negative in the same sense as M1's. Two months out the level is decided by inflow that has not fallen yet and by how the operator responds to the level on the way; the water balance has both built in, and the trees have to learn them from at most a decade of overlapping windows that contains only a handful of drawdowns. Their own quantiles are badly overconfident there (36–46% inside a nominal 80% at 60–90 days); widening by residuals brings that to 66–68%, still short of M3's 72–74%.

**M3 as a feature or as the target does not rescue the long horizons.** Predicting M3's residual was the design most likely to keep M3's long-range skill, since trees that learn nothing leave M3 untouched. It does not: the corrections learned on earlier years move the 60- and 90-day median the wrong way often enough to cost about a metre. Giving the trees M3's forecast as a feature is no better. At seven days all three designs are within 0.03 m of each other, so the short-range gain comes from the recent-state features, not from M3.

**Crisis check.** No design's P50 called either 2024 crossing, and neither did M3's. The P10 of the two direct designs called April 2024 ten days out, from an origin at 2116.7 m — a crossing no quantile of M3 called, because no analogue year was that dry — but `M4-gbm-direct` then missed October, which M3's dry tail and the two M3-informed designs called seven days out. A ten-day call from 1.7 m above the line is short-range extrapolation, not early warning. Every design also raised one false alarm (the P50 from 2023-11-01, at 2115.6 m, put a crossing a week out that did not come until April).

**What `forecast.json` does with it (adopted 2026-09-22).** It switches by horizon, not wholesale: `M4-gbm-m3-residual`'s median is published at seven days — the horizon where the gain is clear and the band no worse, from the design that stays anchored on M3 when the trees have nothing to add — and M3 at 14–90 days, for the three named scenarios and for the days-to-threshold distribution, which need a daily simulated path M4 does not produce. The daily run fits that one design at the live origin for seven days only (three boosted fits, with the settings and features this snapshot was scored with — the switch is refused if they differ), and bands it with the residual quantiles this snapshot recorded for it at seven days, the same rule that bands M3. The 7-day entry names its model, its band's source and the backtest it rests on, and carries what M3 would have published beside it. When the ladder gains an origin this snapshot lacks, or a rerun no longer shows the win, seven days falls back to M3 and `forecast.json` says so.

Runtime: 313 s, single-threaded, for the whole run on the machine that produced this snapshot, which is why it is its own command and not part of the CI dry-run or the daily forecast. To refresh it: `npm run backtest:m4`, then `npm run forecast` to render it here.

## Does conditioning the analogue years on ENSO phase help?

No. Scored over the 60 origins where both variants could forecast — the matched variant declines the rest, because narrowing an analogue pool of barely a dozen members by ENSO phase often leaves too few to form an ensemble at all:

| model | h=7 | h=14 | h=30 | h=60 | h=90 |
|---|---|---|---|---|---|
| M3-water-balance | 2.389 | 3.469 | 6.446 | 7.832 | 8.065 |
| M3-water-balance-enso | 2.562 | 3.916 | 7.406 | 8.107 | 8.656 |

The phase used is the one a forecaster could actually have read at each origin: ONI is a three-month mean centred on its label, so the newest value available on any day is about two months old, and the backtest never looks through that lag. Basin precipitation is the other conditioner, and its upper bound is the next section.

## Does knowing the next 16 days of rain help? (§5.4, perfect foresight)

The upper bound first. At each origin the analogue pool is narrowed to the half of the years whose ERA5 rain over the 16 days after the same calendar day was nearest the rain that *actually fell* after the origin, at `paute_mazar` (the verified catchment centroid). No forecaster has that; it is the most a rain forecast could ever be worth to this model. Same origins as the ladder:

| model | h=7 | h=14 | h=30 | h=60 | h=90 |
|---|---|---|---|---|---|
| M0-persistence | 2.291 (0.0%) | 3.573 (0.0%) | 5.857 (0.0%) | 9.672 (0.0%) | 11.196 (0.0%) |
| M3-water-balance | 2.292 (-0.1%) | 3.616 (-1.2%) | 5.851 (0.1%) | 7.181 (25.8%) | 7.382 (34.1%) |
| M3-water-balance-rain-pf | 2.306 (-0.6%) | 3.933 (-10.1%) | 6.023 (-2.8%) | 7.407 (23.4%) | 7.236 (35.4%) |

MAE in metres, skill against persistence in brackets. Coverage of the calibrated p10–p90 band:

| model | h=7 | h=14 | h=30 | h=60 | h=90 |
|---|---|---|---|---|---|
| M3-water-balance | 74.2% | 77.4% | 80.4% | 70.8% | 68.6% |
| M3-water-balance-rain-pf | 77.4% | 78.5% | 78.3% | 78.7% | 74.4% |

**Negative: even perfect foresight of the rain does not improve the 14-day level** (3.933 m against 3.616 m; worse at 7, 14, 30, 60 d). Narrowing a pool of about fifteen years to the half with the nearest rain costs more in ensemble size than one point's rain buys in information, so the experiment stops here and the 16-day forecast stays unwired. It reruns every day, so the answer on the verified centroid will appear here the first run after its ERA5 backfill.

Scheduling note for when it does help: `covariates.yml` collects the forecast at 17:00 UTC, after both daily runs, so a model would read yesterday's vintage. The forecast fetch would have to move ahead of the 12:15 run, or into it.

## Should every horizon share one ensemble? (§5.7)

Each analogue year is simulated once and read at every horizon it reaches, which is what the shipped model does and changed no published number. Sharing members outright means reading every horizon off only the years whose inflow record reaches ninety days, so a 7-day fan and a 90-day fan are the same years. Same origins:

| model | h=7 | h=14 | h=30 | h=60 | h=90 |
|---|---|---|---|---|---|
| M3-water-balance | 2.292 | 3.616 | 5.851 | 7.253 | 7.305 |
| M3-water-balance-shared-members | 2.309 | 3.614 | 5.943 | 7.235 | 7.305 |

MAE in metres. Coverage of the calibrated band:

| model | h=7 | h=14 | h=30 | h=60 | h=90 |
|---|---|---|---|---|---|
| M3-water-balance | 74.2% | 77.4% | 80.4% | 73.6% | 72.2% |
| M3-water-balance-shared-members | 75.3% | 77.4% | 79.3% | 73.6% | 72.2% |

**Negative: not better at 7, 30, 90 d**, and the ladder's rule asks for every horizon. The shipped model keeps every year a horizon can use; dropping the years whose record stops short of ninety days takes members from the short horizons, and whatever it gains elsewhere is not enough to pay for that everywhere.

## The crisis check

Section 7 asks for the lead time at which the P50 first predicted a crossing of 2115 m (PLAN.md section 7; no upstream source publishes it). Answered strictly: a call counts only if it is *sustained* — the earliest origin from which this and every later origin also predicted the crossing on or before the day it happened. One origin that says yes and is then contradicted by the next three did not forecast anything, and crediting it would flatter the model.

| level first at or below | P50 called it from | P50 lead | P10 called it from | P10 lead |
|---|---|---|---|---|
| 2024-04-11 | **never** | — | **never** | — |
| 2024-10-08 | **never** | — | 2024-10-01 | 7 d |

**The P50 called 0 of 2 episodes in advance; the P10 called 1.** The statistic section 7 chose is the weaker one for this question, and the run-up tables below show why: a crossing is a dry-tail event, and the median of the analogue ensemble is by construction not the dry tail.

### Run-up to 2024-04-11

| origin | level | analogue years crossing | P10 crossing | P50 crossing |
|---|---|---|---|---|
| 2023-11-01 | 2115.6 m | 8/12 | 2023-11-03 | 2023-11-07 |
| 2023-12-01 | 2124.3 m | 0/12 | none within a year | none within a year |
| 2024-01-01 | 2143.3 m | 0/12 | none within a year | none within a year |
| 2024-02-01 | 2135.6 m | 1/12 | none within a year | none within a year |
| 2024-03-01 | 2127.5 m | 0/12 | none within a year | none within a year |
| 2024-04-01 | 2116.7 m | 0/12 | none within a year | none within a year |

### Run-up to 2024-10-08

| origin | level | analogue years crossing | P10 crossing | P50 crossing |
|---|---|---|---|---|
| 2024-05-01 | 2119.1 m | 0/12 | none within a year | none within a year |
| 2024-06-01 | 2140.5 m | 0/12 | none within a year | none within a year |
| 2024-07-01 | 2150.6 m | 0/12 | none within a year | none within a year |
| 2024-08-01 | 2152.0 m | 0/12 | none within a year | none within a year |
| 2024-09-01 | 2138.8 m | 3/12 | 2024-12-26 | none within a year |
| 2024-10-01 | 2119.0 m | 7/12 | 2024-10-10 | 2024-11-29 |

Clean misses at every quantile: 2024-04-11. In the run-up to those, not one analogue year reached the level — the inflow ensemble is made of years that happened, and the year being forecast was drier than all of them at that moment. Nothing in this model can know that in advance, and no amount of widening the band fixes it; an analogue method cannot draw a year it has never seen.

Where the P10 called an episode the P50 missed (2024-10-08), the information was in the forecast all along and reading only the median threw it away. `forecast.json` therefore publishes the whole censored distribution — how many analogue years cross, and at which quantiles — and not only the three named scenarios.

False alarms: across 105 origins, the P50 named a crossing within thirty days that did not happen on 1 of them. A lead time means nothing without this number — a model that predicts a crossing every month has perfect lead time and no information.

## What the model fitted, at the last origin

| quantity | value | where it comes from |
|---|---|---|
| area-elevation exponent | 2.50 | fitted |
| area-elevation datum | 2036.7 m | fitted |
| fit residual | 0.689 m/day over 2000 days | fitted |
| turbined flow per MW | 0.671 m³/s | fitted jointly with the curve |
| storage, lowest declared minimum → crest | 230.7 hm³ | integral of the fitted curve |
| release rule points | 19 | median implied release over 4301 days |
| operator's current stance | 29.6 m³/s vs the rule | trailing 30 days |
| crest used as the spill cap | 2155.83 m | highest level in the record |

The 410 hm³ in `plants.csv` is marked `unverified` and came from press; the storage above is the integral of a curve fitted to this repository's own readings, and the two disagree by about a factor of two. That gap cannot be closed by preferring the bigger number: the area curve and the turbine's flow-per-MW are fitted *together*, and doubling the area drives the flow-per-MW down through zero — a turbine that consumes no water. The balance closes at one scale. The check that does pass is `repDiaPotQTurb`'s 113 days of turbined flow, whose maximum is about 129 m³/s, against the fitted 114 m³/s at Mazar's rated 170 MW.

The bias table above shows this model forecasting high at the long horizons, so correcting the median by its own trailing residual was tried. It is *worse* at every horizon — the bias is not a stable offset but a handful of origins during the 2024 drawdown, and a running median chases them after the fact. The median is therefore published uncorrected, with the residual beside it in `forecast.json` as `median_backtest_residual_m` so a reader can apply their own judgement.

## The fitted release rule

| level, masl | median implied release, m³/s |
|---|---|
| 2110.0 | 10.5 |
| 2112.5 | 15.1 |
| 2115.0 | 29.8 |
| 2117.5 | 27.9 |
| 2120.0 | 36.2 |
| 2122.5 | 35.0 |
| 2125.0 | 35.7 |
| 2127.5 | 47.1 |
| 2130.0 | 55.7 |
| 2132.5 | 61.9 |
| 2135.0 | 69.4 |
| 2137.5 | 53.4 |
| 2140.0 | 53.6 |
| 2142.5 | 54.2 |
| 2145.0 | 58.0 |
| 2147.5 | 60.0 |
| 2150.0 | 60.8 |
| 2152.5 | 85.3 |
| 2155.0 | 223.2 |

This curve is why the water balance works at all. Run open-loop — release held at whatever it recently was, as section 7 originally specified — the same model loses to persistence at every horizon, because a simulated reservoir that never reacts either fills until it spills or empties until it is dry. Reading the release back off the level on every simulated day is the whole difference.

