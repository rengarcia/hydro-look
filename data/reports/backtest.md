# Backtest — mazar level forecast

Generated 2026-09-22T19:48:59Z from the committed tables; no network. Origins are the first of each month, each one refitting every model on the data before it. 105 origins scored per horizon, 93 of them with a calibrated band (the first twelve are the calibration's warm-up).

Level history: 4385 days, 2014-09-20 → 2026-09-21.

## Verdict

**M3-water-balance ships.** At 90 days it is 34.8% better than persistence; at 7 days it is -0.1%, which is to say indistinguishable from doing nothing, and the forecast document says so rather than implying a precision the measurement does not support.

It is not the only rung that beats persistence — M2-seasonal-anomaly-decay does too at the long horizons — but it is chosen because it is at least as good as all of them at *every* horizon, and because its state is interpretable: a storage curve, a release rule and a set of named analogue years, each of which can be inspected and argued with.

## Mean absolute error, metres

| model | h=7 | h=14 | h=30 | h=60 | h=90 |
|---|---|---|---|---|---|
| M0-persistence | 2.291 | 3.573 | 5.857 | 9.601 | 11.208 |
| M1-climatological-drift | 2.345 | 3.780 | 6.213 | 9.626 | 11.220 |
| M2-seasonal-anomaly-decay | 2.519 | 4.077 | 6.193 | 7.454 | 7.560 |
| M3-water-balance | 2.292 | 3.616 | 5.851 | 7.253 | 7.305 |

## Skill against persistence (1 − MAE/MAE₀)

| model | h=7 | h=14 | h=30 | h=60 | h=90 |
|---|---|---|---|---|---|
| M0-persistence | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% |
| M1-climatological-drift | -2.4% | -5.8% | -6.1% | -0.3% | -0.1% |
| M2-seasonal-anomaly-decay | -10.0% | -14.1% | -5.8% | 22.4% | 32.5% |
| M3-water-balance | -0.1% | -1.2% | 0.1% | 24.5% | 34.8% |

Section 7 expected climatological drift to improve on persistence. It does not, at any horizon: a reservoir level is the running total of an operating decision, and last week's decision is a better guide to next week's than the average of six Septembers is. That is recorded here as a measurement, not repaired by tuning.

## Coverage of the published p10–p90 band

| model | h=7 | h=14 | h=30 | h=60 | h=90 |
|---|---|---|---|---|---|
| M0-persistence | 77.4% | 77.4% | 70.7% | 74.7% | 72.2% |
| M1-climatological-drift | 79.6% | 76.3% | 77.2% | 72.5% | 74.4% |
| M2-seasonal-anomaly-decay | 67.7% | 74.2% | 72.8% | 71.4% | 71.1% |
| M3-water-balance | 74.2% | 77.4% | 80.4% | 73.6% | 72.2% |

Against the model's own ensemble, uncalibrated:

| model | h=7 | h=14 | h=30 | h=60 | h=90 |
|---|---|---|---|---|---|
| M0-persistence | — | — | — | — | — |
| M1-climatological-drift | 68.6% | 63.8% | 53.8% | 64.1% | 52.9% |
| M2-seasonal-anomaly-decay | — | — | — | — | — |
| M3-water-balance | 61.0% | 60.0% | 51.0% | 53.4% | 52.9% |

The gap between the two tables is the reason the published band is not the ensemble. An ensemble over analogue inflow years knows only what the weather might do; it does not know that the rule curve is an average of several operating regimes, or that the operator can change their mind. Widening by the model's own out-of-sample residuals is what brings coverage back to what it claims.

## Pinball loss, metres (mean over the three published quantiles)

| model | h=7 | h=14 | h=30 | h=60 | h=90 |
|---|---|---|---|---|---|
| M0-persistence | 0.846 | 1.337 | 2.090 | 3.278 | 3.905 |
| M1-climatological-drift | 0.853 | 1.369 | 2.092 | 3.280 | 3.732 |
| M2-seasonal-anomaly-decay | 0.970 | 1.522 | 2.171 | 2.763 | 2.689 |
| M3-water-balance | 0.850 | 1.293 | 1.873 | 2.434 | 2.572 |

## Bias, metres (mean actual − forecast; positive means the model forecasts too low)

| model | h=7 | h=14 | h=30 | h=60 | h=90 |
|---|---|---|---|---|---|
| M0-persistence | 0.029 | -0.160 | 0.148 | 0.179 | 0.367 |
| M1-climatological-drift | 0.187 | 0.318 | 0.186 | 0.601 | 0.291 |
| M2-seasonal-anomaly-decay | -0.264 | -0.756 | -1.402 | -2.945 | -3.068 |
| M3-water-balance | -0.351 | -1.229 | -2.471 | -3.512 | -3.545 |

## Does conditioning the analogue years on ENSO phase help?

No. Scored over the 60 origins where both variants could forecast — the matched variant declines the rest, because narrowing an analogue pool of barely a dozen members by ENSO phase often leaves too few to form an ensemble at all:

| model | h=7 | h=14 | h=30 | h=60 | h=90 |
|---|---|---|---|---|---|
| M3-water-balance | 2.389 | 3.469 | 6.446 | 7.832 | 8.065 |
| M3-water-balance-enso | 2.562 | 3.916 | 7.406 | 8.107 | 8.656 |

The phase used is the one a forecaster could actually have read at each origin: ONI is a three-month mean centred on its label, so the newest value available on any day is about two months old, and the backtest never looks through that lag. The conditioner worth having is basin precipitation, and it waits on a verified `basins.csv`.

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
| fit residual | 0.689 m/day over 1997 days | fitted |
| turbined flow per MW | 0.671 m³/s | fitted jointly with the curve |
| storage, lowest declared minimum → crest | 230.8 hm³ | integral of the fitted curve |
| release rule points | 19 | median implied release over 4298 days |
| operator's current stance | 19.4 m³/s vs the rule | trailing 30 days |
| crest used as the spill cap | 2155.83 m | highest level in the record |

The 410 hm³ in `plants.csv` is marked `unverified` and came from press; the storage above is the integral of a curve fitted to this repository's own readings, and the two disagree by about a factor of two. That gap cannot be closed by preferring the bigger number: the area curve and the turbine's flow-per-MW are fitted *together*, and doubling the area drives the flow-per-MW down through zero — a turbine that consumes no water. The balance closes at one scale. The check that does pass is `repDiaPotQTurb`'s 113 days of turbined flow, whose maximum is about 129 m³/s, against the fitted 114 m³/s at Mazar's rated 170 MW.

The bias table above shows this model forecasting high at the long horizons, so correcting the median by its own trailing residual was tried. It is *worse* at every horizon — the bias is not a stable offset but a handful of origins during the 2024 drawdown, and a running median chases them after the fact. The median is therefore published uncorrected, with the residual beside it in `forecast.json` as `median_backtest_residual_m` so a reader can apply their own judgement.

## The fitted release rule

| level, masl | median implied release, m³/s |
|---|---|
| 2110.0 | 10.5 |
| 2112.5 | 15.1 |
| 2115.0 | 29.8 |
| 2117.5 | 27.8 |
| 2120.0 | 36.2 |
| 2122.5 | 35.0 |
| 2125.0 | 35.7 |
| 2127.5 | 47.1 |
| 2130.0 | 55.7 |
| 2132.5 | 61.9 |
| 2135.0 | 69.4 |
| 2137.5 | 53.2 |
| 2140.0 | 53.6 |
| 2142.5 | 54.2 |
| 2145.0 | 58.0 |
| 2147.5 | 60.0 |
| 2150.0 | 60.8 |
| 2152.5 | 85.3 |
| 2155.0 | 223.2 |

This curve is why the water balance works at all. Run open-loop — release held at whatever it recently was, as section 7 originally specified — the same model loses to persistence at every horizon, because a simulated reservoir that never reacts either fills until it spills or empties until it is dry. Reading the release back off the level on every simulated day is the whole difference.

