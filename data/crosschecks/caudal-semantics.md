# What `mridCaud` means

Generated 2026-09-22T12:41:49Z from the committed tables; no network.

Mazar's flow mrid (30538) is the only one that can be checked: the ORDS reports publish both
candidate meanings for the same plant and the same days. The three plants that have no report
coverage — Coca Codo Sinclair, Agoyán and Manduriacu — inherit the answer through the dashboard
bundle, which declares their flow mrids exactly as it declares Mazar's.

## Verdict

mrid 30538 is **inflow**. It follows inflow, per-day report identically over 113 days, dated to the same day, while turbined flow is 50.66 m³/s out at its own best offset — and correlates at r=-0.0567, which is to say not at all.

Historian: 4282 days, 2015-01-01 .. 2026-09-21.

## Historian against each meaning the reports publish

| meaning | source | offset | days | mean abs diff (m³/s) | median | p95 | max | agree to 0.1% | mean ratio | r |
|---|---|---|---|---|---|---|---|---|---|---|
| inflow, 12-month report | ords:repDiaHid12m | -1 d | 4282 | 37.2547 | 17.611 | 143.9533 | 771.1239 | 0.23% | 1.177 | 0.6613 |
| inflow, 12-month report | ords:repDiaHid12m | +0 d | 4281 | 0.2491 | 0.2489 | 0.4736 | 0.5 | 16.84% | 1 | 1 |
| inflow, 12-month report | ords:repDiaHid12m | +1 d | 4280 | 37.2814 | 17.6046 | 145.5751 | 770.5998 | 0.14% | 1.1393 | 0.6612 |
| inflow, per-day report | ords:repDiaNivQIng | -1 d | 113 | 33.9946 | 18.7821 | 121.6673 | 279.8961 | 0.88% | 1.1302 | 0.4642 |
| inflow, per-day report | ords:repDiaNivQIng | +0 d | 113 | 0 | 0 | 0 | 0 | 100% | 1 | 1 |
| inflow, per-day report | ords:repDiaNivQIng | +1 d | 113 | 34.662 | 18.7968 | 121.6673 | 279.8961 | 0.88% | 1.1367 | 0.4579 |
| turbined flow | ords:repDiaPotQTurb | -1 d | 112 | 50.66 | 39.2725 | 157.6718 | 248.8672 | 0% | 1.3152 | -0.0567 |
| turbined flow | ords:repDiaPotQTurb | +0 d | 113 | 53.5195 | 46.3254 | 157.8753 | 220.9242 | 0% | 1.4042 | -0.0655 |
| turbined flow | ords:repDiaPotQTurb | +1 d | 113 | 57.2576 | 49.787 | 153.8508 | 231.3342 | 2.65% | 1.486 | -0.2146 |

The level pair, through the same two routes, is what agreement looks like when two series are
the same series:

| level (known identical) | ords:repDiaHid12m | +0 d | 31 | 0 | 0 | 0 | 0 | 100% | 1 | 1 |

## Does the series run into a ceiling?

Turbined flow stops at the machines and piles up against that limit; inflow does not. This needs
no design-flow figure — a series that spends a large share of its days within
1% of its own maximum is clipped, and one that touches its maximum once is not.
Mazar's two report series set the scale, since one is known inflow and the other known turbined
flow.

| series | mrid | days | p50 | p99 | max | days on ceiling |
|---|---|---|---|---|---|---|
| mazar/caudal_m3s (historian) | 30538 | 4282 | 61.32 | 438.46 | 867.12 | 0.02% |
| coca_codo_sinclair/caudal_m3s (historian) | 100037 | 3747 | 245 | 1025 | 1933 | 0.03% |
| agoyan/caudal_m3s (historian) | 140537 | 3717 | 105 | 490 | 1065 | 0.03% |
| manduriacu/caudal_m3s (historian) | 110537 | 3338 | 158.3 | 563.18 | 834 | 0.03% |
| mazar/caudal_m3s (inflow, 12-month report) | — | 4384 | 61 | 438 | 867 | 0.02% |
| mazar/caudal_m3s (inflow, per-day report) | — | 113 | 67.15 | 248.87 | 345.49 | 0.88% |
| mazar/q_turbinado_m3s (turbined flow) | — | 113 | 79.91 | 128.98 | 129.18 | 1.77% |

## Does the series track the plant's own generation?

Turbined flow and daily generation are the same quantity measured twice, at a head that barely
moves. Inflow is not: it arrives with the rain, and how much of it is generated is a decision.
This reading needs no second flow series, so unlike the direct comparison it reaches Coca Codo
Sinclair, Agoyán and Manduriacu — their generation comes from `{code}EnerDia`.

**This reading is weaker than it was designed to be, and the calibration row is what says so.**
Mazar's own turbined flow correlates with Mazar's own generation at r≈0.45, not the near-1 the
argument above predicts. The likely reason is visible in another test: `repDiaPotQTurb`'s
`potencia_mw` times 24 does not match daily energy at any offset (mean error ~1,000 MWh on a
~2,000 MWh day), so that endpoint looks like an instantaneous reading rather than a daily mean —
and an instant of flow cannot track a whole day of energy. Until that is settled, the top of
this scale is not anchored, and a plant scoring 0.5 cannot be called turbined on the strength of
it. Read the table only for what it still shows: the two Mazar inflow series and Coca Codo
Sinclair and Agoyán sit near zero, which is a reservoir decoupling inflow from a generation
decision. Manduriacu at 0.53 is the expected shape for run-of-river *inflow* too — its inflow
and its generation are the same water on the same day — so it is not evidence either way. The
ceiling reading above and the direct comparison carry the verdict; this one corroborates and
does not decide.

| series | mrid | days vs generation | r |
|---|---|---|---|
| mazar/caudal_m3s (historian) | 30538 | 3977 | 0.0004 |
| coca_codo_sinclair/caudal_m3s (historian) | 100037 | 3736 | -0.0744 |
| agoyan/caudal_m3s (historian) | 140537 | 3538 | 0.1189 |
| manduriacu/caudal_m3s (historian) | 110537 | 3338 | 0.5265 |
| mazar/caudal_m3s (inflow, 12-month report) | — | 3977 | 0.0004 |
| mazar/caudal_m3s (inflow, per-day report) | — | 113 | -0.1744 |
| mazar/q_turbinado_m3s (turbined flow) | — | 112 | 0.4476 |

