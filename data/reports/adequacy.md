# Energy adequacy — what the model is, and what it was measured at

Generated 2026-09-26T19:29:40Z from 3728 usable national-balance days, 2016-05-01 → 2026-09-25. Origin 2026-09-25.

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

3728 of 3785 balance days are usable (98.49%).

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
| 7 d | 87 | 1.78 | +0.02 | 1.68 | -6.0% |
| 14 d | 84 | 1.81 | -0.24 | 1.74 | -3.9% |
| 30 d | 77 | 2.05 | -0.45 | 1.88 | -9.2% |
| 60 d | 67 | 2.10 | -0.56 | 2.19 | 4.3% |
| 90 d | 57 | 2.29 | -0.55 | 2.34 | 1.9% |

Growth fitted at the live origin: 6.57% a year, over 1244 unsuppressed days, anchored on the last 14 of them at a factor of 1.0780.

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
| 7 d | 87 | 3.79 | +0.82 | 4.26 | 11.1% |
| 14 d | 84 | 3.86 | +0.40 | 4.31 | 10.6% |
| 30 d | 77 | 4.60 | -0.15 | 4.76 | 3.5% |
| 60 d | 67 | 5.43 | -0.42 | 5.77 | 5.9% |
| 90 d | 57 | 5.75 | -0.80 | 6.36 | 9.7% |

This is the weak term and the report says so rather than burying it. Against a trailing
28-day mean the model is 11.1% better at 7 days and 9.7% at 90, with a flat spot at 30 — which is to say that the
gain over assuming the last month repeats is real but small, and the adequacy number leans on
the demand model and the ceilings at least as much as on any skill in forecasting water. An
earlier iteration of this rung was scored with the *realised* load handed to it rather than
the forecast one and read 28% at 7 days and 24% at 90. That number was borrowed from knowing
the future demand; it is recorded here because the gap between it and the 9% above is exactly
the trap that component-wise evaluation sets.

This term at seven days is also §7's target 4, national hydro generation a week out, so it
carries a band of its own, calibrated the same way as the requirement's: residual quantiles
from strictly earlier origins, clamped to contain their centre. Coverage of that p10–p90:

| Horizon | Origins with a band | Coverage |
|---|---:|---:|
| 7 d | 75 | 76% |
| 14 d | 72 | 79% |
| 30 d | 65 | 75% |
| 60 d | 55 | 76% |
| 90 d | 45 | 69% |

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
| 7 d | 87 | 3.06 | -0.80 | 3.57 | 14.4% |
| 14 d | 84 | 3.36 | -0.65 | 3.77 | 10.9% |
| 30 d | 77 | 3.74 | -0.31 | 4.11 | 9.1% |
| 60 d | 67 | 4.62 | -0.14 | 5.05 | 8.4% |
| 90 d | 57 | 4.86 | +0.24 | 5.41 | 10.2% |

This is the quantity the band is calibrated on, because it is the one the deficit is a fixed
shift of, and because it is observable on every unsuppressed day — unlike the deficit itself.
Coverage of the published p10–p90:

| Horizon | Origins with a band | Coverage |
|---|---:|---:|
| 7 d | 75 | 80% |
| 14 d | 72 | 82% |
| 30 d | 65 | 78% |
| 60 d | 55 | 76% |
| 90 d | 45 | 69% |

Against a nominal 80%. Version 1 took the 10th and 90th percentile of every earlier residual
and covered 60–67%, falling with the horizon, because the residual distribution is not
stationary — the fleet that produced the errors of 2019 is not the fleet of 2026. Since version
2 those quantiles are stretched, per horizon, by the smallest factor at which the bands already
issued at earlier origins would have covered 80%; at the live origin the stretch is ×1.50 at 7 d, ×1.50 at 14 d, ×1.60 at 30 d, ×1.35 at 60 d, ×1.35 at 90 d.
The longest horizon is calibrated from the fewest origins (45 at ninety days) and
is the one to read with care. Every method tried is compared under §5.5 below.

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

### When the central case stops assuming the interconnection

At this origin the interconnection is treated as **cut**: imports averaged 0.14 GWh/day over the last 14 usable days while thermal ran at 22.07, so the central case assumes 0.14 GWh/day of imports.

The rule: 14 days of imports below 1 GWh/day *while* thermal runs at 70% or more of its ceiling means the imports are not arriving rather than
not wanted, and the central case then uses what is arriving, held for the horizon. Low imports
alone would not do: they preceded 68 of the 99 monthly origins since 2018, mostly in wet months
when Ecuador had no use for them. With the thermal condition the rule picks out four — 2024-05,
2024-11 inside the Colombian cutoff, 2026-04 and 2026-05 — and the same four at any share from
60% to 75%. It leaves the tier record above untouched: no new false alarm, no new call.

The rule was added on 2026-09-22, when imports had been stopped since 2026-09-07. Colombia's own
figures (XM) say that stop was not Colombian scarcity — storage at 79% and a spot price well under
the scarcity threshold — so the cause is something this data cannot see: a line out, a contract,
a dispatch decision. Holding the cut for ninety days is the honest default rather than a
forecast: the 2019 stretch lasted 398 days and the 2024 one about seven weeks.

### How much of the tier is the import assumption

The central deficit under each import assumption a reader might hold, with the tier it gives at each horizon.
Published in `adequacy.json` as `import_sensitivity`; the central case above is one of these rows.

| Imports | GWh/day | 7 d | 14 d | 30 d | 60 d | 90 d | Worst tier |
|---|---:|---|---|---|---|---|---|
| demonstrated ceiling | 10.78 | -11.26 `holgado` | -10.83 `holgado` | -9.57 `vigilancia` | -9.20 `holgado` | -9.87 `holgado` | `vigilancia` (30 d) |
| stressed (2024) | 0.12 | -0.60 `vigilancia` | -0.17 `vigilancia` | +1.09 `ajustado` | +1.45 `ajustado` | +0.79 `ajustado` | `ajustado` (30 d) |
| current regime (trailing) | 0.14 | -0.62 `vigilancia` | -0.19 `vigilancia` | +1.07 `ajustado` | +1.44 `ajustado` | +0.77 `ajustado` | `ajustado` (30 d) |

Deficit in GWh/day, positive meaning short. The spread between the rows is the part of the tier that rests on
Colombia rather than on water.

## Crisis check

A deficit is a counterfactual: it is the energy that would have been short had nobody
rationed, and no meter records it. During an episode it has an observable shadow — the gap
between the demand the model says the country wanted and the load the meters recorded. If the
identity is right, that gap and the computed deficit should be about the same size.

| Episode | Days | Modelled demand | Measured load | Suppression | Hydro | Imports | Implied deficit | Deficit at demonstrated imports |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| 2023-10-27 → 2023-12-17 | 52 | 87.95 | 85.31 | 2.64 | 54.00 | 6.654 | 0.34 | -3.79 |
| 2024-04-15 → 2024-04-30 | 16 | 97.96 | 83.96 | 14.00 | 63.30 | 0.401 | 7.29 | -3.09 |
| 2024-09-23 → 2024-12-19 | 88 | 88.70 | 68.16 | 20.53 | 40.39 | 4.150 | 17.19 | 10.56 |
| 2026-09-22 → 2026-09-25 | 4 | 113.91 | 107.69 | 6.22 | 83.61 | 0.130 | 3.21 | -7.44 |

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
| `holgado` | 88 | 2 |
| `vigilancia` | 8 | 4 |
| `ajustado` | 0 | 0 |
| `deficit` | 3 | 3 |

Over 99 monthly origins, 9 were followed by rationing inside thirty days and 3 were flagged `ajustado` or `deficit`. 3 of those 3 were followed by rationing —
so of the origins this model flagged, 100% preceded cuts, and of the origins that preceded cuts it flagged 33%. It does not cry wolf and it misses most
of the wolves, which is the shape you would expect from a model whose weakest term is the
one that decides how much water there is.

Read the table for what it is. Three episodes is not a sample you can fit a threshold to, and
no threshold here was fitted to them.

## Band calibration: which method is honest at every horizon (§5.5)

Version 1 pooled every earlier origin's residual and covered 60–67% against a nominal 80%. Scored on the same origins, the variants below change only how residuals become a band; the medians, and so the MAE tables above, are untouched. A variant qualifies only if it is nearer 80% than version 1 at *every* horizon, for the requirement and for hydro. The adaptive stretch picks its factor at each origin from the bands already issued before it, so it is not tuned on the origins it is scored on; a fixed stretch read off this table would be.

| Method | Component | 7 d | 14 d | 30 d | 60 d | 90 d | Nearer 80% everywhere | Worst distance from 80% |
|---|---|---:|---:|---:|---:|---:|---|---:|
| pooled p10–p90 (version 1) | requirement | 67% | 65% | 68% | 64% | 60% | no | 22 |
| pooled p10–p90 (version 1) | hydro | 72% | 69% | 60% | 65% | 58% | no | 22 |
| last 24 origins | requirement | 65% | 69% | 71% | 75% | 69% | no | 20 |
| last 24 origins | hydro | 71% | 71% | 68% | 69% | 60% | no | 20 |
| last 36 origins | requirement | 67% | 68% | 68% | 69% | 64% | no | 22 |
| last 36 origins | hydro | 73% | 72% | 62% | 71% | 58% | no | 22 |
| pooled p5–p95 | requirement | 83% | 81% | 82% | 80% | 73% | yes | 18 |
| pooled p5–p95 | hydro | 85% | 83% | 77% | 76% | 62% | yes | 18 |
| pooled, adaptive stretch **(shipped)** | requirement | 80% | 82% | 78% | 76% | 69% | yes | 11 |
| pooled, adaptive stretch **(shipped)** | hydro | 76% | 79% | 75% | 76% | 69% | yes | 11 |
| last 36 origins, adaptive stretch | requirement | 83% | 81% | 77% | 76% | 69% | yes | 11 |
| last 36 origins, adaptive stretch | hydro | 77% | 82% | 78% | 76% | 69% | yes | 11 |

Among the methods nearer 80% everywhere, the one shipped is the one whose worst horizon is nearest 80%, the simpler on a tie.

**Shipped: pooled, adaptive stretch** — worst horizon 11 points from 80%. It is the published band from model version 2. The longest horizon rests on the fewest origins, and the stretch can only learn from bands already issued, so that is the horizon to read with care.

Recorded negatives (not nearer 80% than version 1 at every horizon): last 24 origins; last 36 origins. Nearer 80% everywhere but not shipped: pooled p5–p95 (worst 18 points); last 36 origins, adaptive stretch (worst 11 points).

## ONI as a covariate for the hydro term (§5.5)

ONI had only been tried as an analogue filter, where it was worse. Here it is a covariate: a line from the ONI readable at the origin (two months stale) to the hydro error, fitted on earlier origins only and added to the forecast.

| Horizon | Origins | Hydro MAE, shipped | With ONI |
|---|---:|---:|---:|
| 7 d | 75 | 3.93 | 4.15 |
| 14 d | 72 | 4.08 | 4.29 |
| 30 d | 65 | 4.89 | 4.81 |
| 60 d | 54 | 5.84 | 6.28 |
| 90 d | 44 | 6.48 | 7.24 |

**Negative: not better at every horizon.** ENSO's grip on the national hydro anomaly, read two months stale, is too loose to beat the fitted anomaly and its decay; it stays out. The same covariate was offered to the export-availability model below, for Colombian storage.

## An export-availability model from XM's side of the border (§5.5)

Imports from Colombia as a least-squares function of `colombia_useful_storage_fraction`, `colombia_inflow_energy_over_historical_mean`, `log_spot_over_scarcity_price`, `ecuador_load_gwh_day` (trailing seven-day means at the origin), refitted at every origin on the days whose outcome was already observed, clamped to the demonstrated ceiling. It would replace both fixed ceilings and the cutoff heuristic only if it forecast the import that actually arrived better than the shipped rule over daily origins in *both* windows — 2024 Colombian cut (2024-09-01 → 2024-11-30) and 2026-09 stop (2026-09-01 → 2026-09-30) — at every horizon. Those are the windows in which Ecuador wanted every GWh it could get, so what arrived is what was offered.

| Model | Window | Horizon | Origins | Rule MAE GWh/day | Model MAE |
|---|---|---:|---:|---:|---:|
| export model | 2024 Colombian cut | 7 d | 91 | 3.32 | 3.92 |
| export model | 2024 Colombian cut | 14 d | 91 | 4.06 | 3.73 |
| export model | 2024 Colombian cut | 30 d | 91 | 5.75 | 3.42 |
| export model | 2026-09 stop | 7 d | 18 | 9.39 | 3.72 |
| export model | 2026-09 stop | 14 d | 11 | 10.07 | 4.22 |
| export model + ONI | 2024 Colombian cut | 7 d | 91 | 3.32 | 3.95 |
| export model + ONI | 2024 Colombian cut | 14 d | 91 | 4.06 | 3.75 |
| export model + ONI | 2024 Colombian cut | 30 d | 91 | 5.75 | 3.44 |
| export model + ONI | 2026-09 stop | 7 d | 18 | 9.39 | 3.56 |
| export model + ONI | 2026-09 stop | 14 d | 11 | 10.07 | 4.12 |

**Negative.** The model (without ONI) is better in 2024 Colombian cut at 14 d, 2024 Colombian cut at 30 d, 2026-09 stop at 7 d, 2026-09 stop at 14 d and worse in 2024 Colombian cut at 7 d; with ONI, worse in 2024 Colombian cut at 7 d. Where it wins it is because the rule keeps assuming the demonstrated ceiling until a full regime window of near-zero imports has passed; where it loses, the rule's trailing read of what is arriving is the better nowcast. Neither wins everywhere, so the ceilings and the cutoff rule stay, and the sensitivity table is what a reader should use to weigh the import assumption.

## Known limits

1. **Hydro beyond a month is barely better than persistence.** Stated above, and the reason
   the 60- and 90-day bands are as wide as they are.
2. **The hydro term assumes water scales with demand.** It is normalised by the demand trend,
   so a fleet that is water-limited rather than demand-limited will be over-stated, which
   biases the deficit *down* — the unsafe direction. The crisis check is the guard against
   this and the 2024 episode is where to look.
3. **Three episodes.** Every rationing label in `rationing_episodes.csv` comes from ministry
   and press reporting, checked against SMEC demand on 2026-09-24; the 2023 end date is known
   to within a few days. A different end date moves the suppression figures.
4. **Thermal availability is a demonstrated maximum, not an availability declaration.** No
   source this project reaches publishes planned outages, so a thermal fleet with half its
   units out for maintenance looks exactly like one that is available.
5. **Nothing here models the network.** A deficit in GWh/day says the energy is not there. It
   says nothing about whether it could be delivered where it was needed, which is a different
   failure and the one that caused the June 2024 blackout.

