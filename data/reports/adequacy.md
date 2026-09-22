# Energy adequacy — what the model is, and what it was measured at

Generated 2026-09-22T17:23:03Z from 3724 usable national-balance days, 2016-05-01 → 2026-09-21. Origin 2026-09-21.

This is section 7's target 3: expected deficit in GWh per day over the horizon, and the risk
tiers read off it. It is the number the site's adequacy tile shows, and the `risk_tier` the
narrative panel of Phase 6b is meant to be handed rather than allowed to choose.

## The identity

```
deficit(h) = unsuppressed demand(h) − hydro(h) − thermal − imports − other
```

Every term is either forecast with a backtest below it or an explicit input in
`data/reference/adequacy_assumptions.csv`. Three of the four are not the obvious quantity,
and in each case the obvious quantity is wrong:

- **Demand is served load, not `demanda_distribucion`.** The distribution utilities' metering
  misses transmission losses and every consumer buying outside them: across the record it is
  89–97% of what generators plus interconnections actually delivered, a gap of 3 to 11 GWh a
  day. That is larger than the entire Colombian interconnection, so asking whether supply
  covers `demanda_distribucion` is asking the wrong question by about one Colombia. The
  quantity used is `total_generacion + total_importacion − total_exportacion`.
- **Demand is unsuppressed, not measured.** Measured load fell from 78 GWh/day in September
  2024 to 55 in late October. A model fitted through that learns that Ecuador needs less
  electricity during a drought.
- **Hydro is normalised by the fitted demand trend, not by measured load.** Raw hydro GWh is
  not stationary — the fleet and the demand it serves have both grown — and a day-of-year
  climatology of it comes out 6 to 12 GWh/day low. Normalising by *measured* load fixes the
  trend and breaks the crisis: during rationing hydro and load fall together, the ratio holds
  up, and projecting it against unsuppressed demand claims 48 GWh of hydro for November 2024
  against the 34 that was generated. Normalising by the fitted unsuppressed trend — a smooth
  curve that knows nothing about the drought — removes the growth and leaves the drought in.

## Which days the model is allowed to see

3724 of 3781 balance days are usable (98.49%).

`parse/smec.ts` already rejects pages served before their metering arrived, by requiring
distribution demand to be at least 20% of generation. That gate is one-sided: it catches a
page whose *demand* has not landed and passes one whose *generation* has not. 2018-01-05 is
the proof — 4.19 GWh of national generation against 62.72 GWh of demand the same day, a 94%
collapse of exactly the shape this project exists to detect, sitting in the committed table
because 62.72/4.19 sails past a 0.2 floor.

The symmetric test is arithmetic rather than statistical. Served load is distribution demand
plus transmission losses plus unregulated demand, and the last two are positive, so a day
whose generation plus net imports falls below its own distribution demand is not a day — it
is a page caught mid-render. That is 55 days. The ratio's own distribution
backs the cut: its first percentile is 1.019 and the four years 2021–2024 never dip below
1.044.

The same ratio catches the opposite fault: 2 days above twice distribution demand (2025-07-17, 2025-07-18). On 2025-07-17 and -18 CENACE published
`generación de otros tipos` at 153.62 and 113.19 GWh against a fortnight's median of 2.2 —
flagged in its own `pct_dia` column at +6,284% — lifting national generation to 247 GWh on a
91 GWh day. The opening month of the record, which runs to 1.76, is deliberately left in: an
early metering scope is not the same claim as one concept contradicting its neighbours
seventy-fold.

An earlier attempt used reported transmission losses as the detector, on the reasoning that a
partial page shows them strongly negative. It was dropped: `total_perdidas_transporte` is
independently metered rather than a residual, and the November 2024 rationing days carry
losses at −11% of load while being entirely real.

## What is not in the model, and why

Section 7 specifies fleet hydro energy *from levels, inflows and plant limits*. That link is
not here because the data does not carry it. National hydro energy against the sum of this
repository's measured inflows:

| | Correlation with national hydro GWh/day |
|---|---:|
| Mazar inflow, same day | r = 0.18 |
| Mazar inflow, 30-day means | r = 0.36 |
| Mazar + Coca Codo + Agoyán, same day | r = 0.27 |
| Mazar + Coca Codo + Agoyán, 30-day means | r = 0.47 |

and the implied conversion drifts from 0.090 GWh per m³/s in 2016 to 0.165 in 2026 — an 83%
drift, which is fleet growth rather than hydrology. The measured basins are all Amazon slope;
Daule-Peripa, Pucará, San Francisco, Toachi-Pilatón and the private fleet are not measured
here at all, and the Pacific slope runs in the opposite phase, which is the reason the
interconnected system works. Wiring a 0.47 correlation into an adequacy number would be
inventing precision. This is a recorded negative, not a to-do.

## Backtest

Rolling monthly origins from 2018-07-01 to 2026-09-01, 99 of them, on the same three rules the level forecast uses: every model
sees only its own past, the band is calibrated from residuals at strictly earlier origins, and
the components are scored on the origins they all reached. Targets falling inside a rationing
episode are dropped rather than scored — on a day of rationing the realised load is the load
that was *allowed*, so a demand model that predicted it correctly would be a model of the
cuts.

### Unsuppressed demand

| Horizon | n | MAE GWh/day | Bias | Persistence MAE | Skill vs persistence |
|---|---:|---:|---:|---:|---:|
| 7 d | 85 | 1.81 | -0.02 | 1.65 | -9.2% |
| 14 d | 82 | 1.84 | -0.28 | 1.72 | -6.9% |
| 30 d | 75 | 2.08 | -0.49 | 1.80 | -15.4% |
| 60 d | 65 | 2.14 | -0.61 | 2.10 | -1.9% |
| 90 d | 55 | 2.31 | -0.62 | 2.20 | -5.0% |

Growth fitted at the live origin: 6.60% a year, over 1202 unsuppressed days, anchored on the last 14 of them at a factor of 1.0815.

**This rung does not beat the baseline, and the comparison is not the point.** Over a window
mean a trailing 28-day mean is a very strong predictor of load — load is that persistent at
the monthly scale — and the fitted model ties it or loses by a few per cent. What the
baseline cannot do is answer the question at all during an episode: a trailing mean of
measured load *is* the suppressed load, so used as "unsuppressed demand" it would have
reported that Ecuador wanted 55 GWh/day in late October 2024 and that there was therefore no
shortfall, at the precise moment there were fourteen hours a day of cuts. The crisis check
below is where this rung earns its place; the MAE table is here to show it costs nothing
outside an episode to keep it.

The anchor is what makes that true. Fitted without one — a four-year trend evaluated at a
date — the model lost to the trailing mean by 70% at seven days and 15% at ninety, because a
trend fitted over four years can sit two or three GWh from where demand actually is today.

### Hydro energy

| Horizon | n | MAE GWh/day | Bias | Persistence MAE | Skill vs persistence |
|---|---:|---:|---:|---:|---:|
| 7 d | 85 | 3.84 | +0.87 | 4.24 | 9.3% |
| 14 d | 82 | 3.87 | +0.42 | 4.30 | 9.9% |
| 30 d | 75 | 4.69 | -0.13 | 4.71 | 0.4% |
| 60 d | 65 | 5.56 | -0.48 | 5.75 | 3.3% |
| 90 d | 55 | 5.76 | -1.04 | 6.27 | 8.1% |

This is the weak term and the report says so rather than burying it. Against a trailing
28-day mean the model is 9.3% better at 7 days and 8.1% at 90, with a flat spot at 30 — which is to say that the
gain over assuming the last month repeats is real but small, and the adequacy number leans on
the demand model and the ceilings at least as much as on any skill in forecasting water. An
earlier iteration of this rung was scored with the *realised* load handed to it rather than
the forecast one and read 28% at 7 days and 24% at 90. That number was borrowed from knowing
the future demand; it is recorded here because the gap between it and the 9% above is exactly
the trap that component-wise evaluation sets.

Rungs that lost, scored on the same origins, the same window-mean target and the same
exclusion of suppressed days as the shipped one:

| Rung | 7 d | 30 d | 90 d | Bias at 90 d |
|---|---:|---:|---:|---:|
| Shipped (normalised by the demand trend) | +9% | +0% | +8% | −1.0 |
| Share of *measured* load, persisted | +1% | −2% | −3% | −0.7 |
| Analogue years scaled by a 3-year capability maximum | −117% | −97% | −65% | −9.3 |
| Analogue years matched on Mazar's level tercile | −108% | −90% | +4% | −6.0 |
| Day-of-year climatology of raw hydro GWh | −153% | −154% | −95% | −11.6 |
| Analogue years unscaled | −158% | −148% | −132% | −13.4 |

Skill is against a trailing 28-day mean; bias is GWh/day, negative meaning the rung
under-forecasts. The three analogue rungs decline origins where too few years carry a
complete path, so they are scored on fewer of them — 59, 59 and 21 of 85 at seven days — and
the level-matched rung's +4% at ninety days rests on three origins and should be read as
nothing at all.

What sinks every analogue rung is the same thing: a bias of 5 to 13 GWh/day, low, which is
fleet growth that a capability ratio does not keep up with. Matching analogue years on Mazar's
level — the one rung that would have tied this model to Phase 5's reservoir state, and the
reason it was tried — is among them.

### Net requirement (demand − hydro)

| Horizon | n | MAE GWh/day | Bias | Persistence MAE | Skill vs persistence |
|---|---:|---:|---:|---:|---:|
| 7 d | 85 | 3.07 | -0.88 | 3.50 | 12.4% |
| 14 d | 82 | 3.34 | -0.70 | 3.72 | 10.2% |
| 30 d | 75 | 3.79 | -0.35 | 4.06 | 6.5% |
| 60 d | 65 | 4.76 | -0.13 | 5.04 | 5.6% |
| 90 d | 55 | 4.88 | +0.41 | 5.51 | 11.4% |

This is the quantity the band is calibrated on, because it is the one the deficit is a fixed
shift of, and because it is observable on every unsuppressed day — unlike the deficit itself.
Coverage of the published p10–p90:

| Horizon | Origins with a band | Coverage |
|---|---:|---:|
| 7 d | 73 | 67% |
| 14 d | 70 | 66% |
| 30 d | 63 | 67% |
| 60 d | 53 | 62% |
| 90 d | 43 | 60% |

Against a nominal 80%, and falling with the horizon. The band is therefore too narrow, by
more than the level forecast's is — that one covers 72% to 80%. Two things are behind it and
only the first is fixable: residuals at a long horizon are calibrated from few origins
(43 at ninety days), and the residual distribution is
not stationary, because the fleet that produced the errors of 2019 is not the fleet of 2026.
Read the p10–p90 as roughly a two-thirds interval, not four-fifths, until there are more
origins behind it.

## The ceilings

| Quantity | GWh/day |
|---|---:|
| Thermal | 25.83 |
| Imports, normal | 10.78 |
| Imports, stressed | 0.12 |
| Other (solar, wind, biomass) | 1.13 |

Basis: thermal = 25.831 (largest thermal day in the 1081 usable balance days from 2023-09-21 to 2026-09-20; a demonstrated maximum, not an availability declaration — no source this project reaches publishes planned outages); import = 10.779 (largest import day in the same window (2024-08-15). About 449 MW sustained, consistent with the Colombian interconnection's usual limit); import_stressed = 0.122 (median daily import 2024-10-01 to 2024-11-10, while Ecuador rationed 14 h/day and Colombia was short of water at the same time. Not an outlier: imports ran below 1 GWh/day for 398 consecutive days from 2019-07-06); other = 1.132 (median of generación de otros tipos over the same window. Solar, wind and biomass are not dispatchable, so the median is used rather than the maximum)

The import ceiling is the single most dangerous number here, and it is dangerous in a way
that is already documented rather than hypothetical. Between 2024-10-01 and 2024-11-10, with
Ecuador rationing fourteen hours a day, imports from Colombia ran at 0.11 to 0.14 GWh/day
against the 10.7 they had reached that August — because Colombia was short of water at the
same time, which is what a shared drought does to a shared interconnection. Every horizon
therefore publishes a stressed deficit beside the central one, and a reader who believes the
interconnection is firm is invited to look at the stressed column before believing it.

## Crisis check

A deficit is a counterfactual: it is the energy that would have been short had nobody
rationed, and no meter records it. During an episode it has an observable shadow — the gap
between the demand the model says the country wanted and the load the meters recorded. If the
identity is right, that gap and the computed deficit should be about the same size.

| Episode | Days | Modelled demand | Measured load | Suppression | Hydro | Imports | Implied deficit | Deficit at demonstrated imports |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| 2023-10-27 → 2023-12-31 | 66 | 87.85 | 85.15 | 2.71 | 56.48 | 5.677 | -1.27 | -6.37 |
| 2024-04-15 → 2024-05-31 | 47 | 96.55 | 90.21 | 6.34 | 71.04 | 1.179 | -2.64 | -12.24 |
| 2024-09-23 → 2024-12-20 | 89 | 88.72 | 68.41 | 20.31 | 40.56 | 4.219 | 16.98 | 10.42 |

All figures GWh/day. **Suppression** and **implied deficit** are the two columns to compare:
they are computed from different sides of the identity and agreeing is the whole test.

## Tiers

Cuts on the deficit distribution rather than on its median alone, because the median is the
statistic that missed both 2024 crossings in the level forecast and there is no reason to
expect better here.

| Tier | Condition |
|---|---|
| `holgado` | the p90 case is still covered |
| `vigilancia` | the p90 is short, the central case is not |
| `ajustado` | the central case is short by less than 5 GWh/day |
| `deficit` | the central case is short by 5 GWh/day or more |

5 GWh/day is about 5% of 2026 demand and roughly an hour of national
consumption. The 2024 episode ran at a measured suppression four to five times that, so the
cut is not drawn where the crisis was; it is drawn where a shortfall stops being absorbable by
dispatch and starts being visible to consumers.

### What the tiers said, month by month

| Tier at a 30-day horizon | Origins | Rationing began or ran within 30 days |
|---|---:|---:|
| `holgado` | 96 | 6 |
| `vigilancia` | 0 | 0 |
| `ajustado` | 1 | 1 |
| `deficit` | 2 | 2 |

Over 99 monthly origins, 9 were followed by rationing inside thirty days and 3 were flagged `ajustado` or `deficit`. 3 of those 3 were followed by rationing —
so of the origins this model flagged, 100% preceded cuts, and of the origins that preceded cuts it flagged 33%. It does not cry wolf and it misses most
of the wolves, which is the shape you would expect from a model whose weakest term is the
one that decides how much water there is.

Read the table for what it is. Three episodes is not a sample you can fit a threshold to, and
no threshold here was fitted to them.

## Known limits

1. **Hydro beyond a month is barely better than persistence.** Stated above, and the reason
   the 60- and 90-day bands are as wide as they are.
2. **The hydro term assumes water scales with demand.** It is normalised by the demand trend,
   so a fleet that is water-limited rather than demand-limited will be over-stated, which
   biases the deficit *down* — the unsafe direction. The crisis check is the guard against
   this and the 2024 episode is where to look.
3. **Three episodes.** Every rationing label comes from press reporting in
   `rationing_episodes.csv`, marked `unverified`, with two of the three end dates approximate
   to the month. A different end date moves the suppression figures.
4. **Thermal availability is a demonstrated maximum, not an availability declaration.** No
   source this project reaches publishes planned outages, so a thermal fleet with half its
   units out for maintenance looks exactly like one that is available.
5. **Nothing here models the network.** A deficit in GWh/day says the energy is not there. It
   says nothing about whether it could be delivered where it was needed, which is a different
   failure and the one that caused the June 2024 blackout.

