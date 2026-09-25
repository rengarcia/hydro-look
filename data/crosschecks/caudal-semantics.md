# What `mridCaud` means

Generated 2026-09-25T03:21:49Z from the committed tables; no network.

Mazar's flow mrid (30538) is the only one that can be checked: the ORDS reports publish both
candidate meanings for the same plant and the same days. The three plants that have no report
coverage — Coca Codo Sinclair, Agoyán and Manduriacu — inherit the answer through the dashboard
bundle, which declares their flow mrids exactly as it declares Mazar's.

## Verdict

mrid 30538 is **inflow**. It follows inflow, per-day report identically over 116 days, dated to the same day, while turbined flow is 53.9924 m³/s out at its own best offset — and correlates at r=-0.0795, which is to say not at all.

Historian: 6064 days, 2010-02-10 .. 2026-09-23.

## Historian against each meaning the reports publish

| meaning | source | offset | days | mean abs diff (m³/s) | median | p95 | max | agree to 0.1% | mean ratio | r |
|---|---|---|---|---|---|---|---|---|---|---|
| inflow, 12-month report | ords:repDiaHid12m | -1 d | 4386 | 36.8808 | 17.2859 | 143.5911 | 771.1239 | 0.23% | 1.1754 | 0.6622 |
| inflow, 12-month report | ords:repDiaHid12m | +0 d | 4387 | 0.2495 | 0.2494 | 0.4739 | 0.5 | 16.64% | 1 | 1 |
| inflow, 12-month report | ords:repDiaHid12m | +1 d | 4387 | 36.8848 | 17.2972 | 144.136 | 770.5998 | 0.14% | 1.1383 | 0.6622 |
| inflow, per-day report | ords:repDiaNivQIng | -1 d | 115 | 33.5609 | 16.4006 | 121.6673 | 279.8961 | 0.87% | 1.1324 | 0.4701 |
| inflow, per-day report | ords:repDiaNivQIng | +0 d | 116 | 0 | 0 | 0 | 0 | 100% | 1 | 1 |
| inflow, per-day report | ords:repDiaNivQIng | +1 d | 116 | 33.969 | 18.7821 | 121.6673 | 279.8961 | 0.86% | 1.1313 | 0.4676 |
| turbined flow | ords:repDiaPotQTurb | -1 d | 115 | 53.9924 | 46.6069 | 157.8753 | 220.9242 | 0% | 1.3842 | -0.0795 |
| turbined flow | ords:repDiaPotQTurb | +0 d | 116 | 58.0033 | 51.1848 | 153.8508 | 231.3342 | 2.59% | 1.4531 | -0.2341 |
| turbined flow | ords:repDiaPotQTurb | +1 d | 116 | 57.9432 | 48.46 | 152.9068 | 345.4929 | 0% | 1.3211 | -0.3326 |

The level pair, through the same two routes, is what agreement looks like when two series are
the same series:

| level (known identical) | ords:repDiaHid12m | +0 d | 54 | 0 | 0 | 0 | 0 | 100% | 1 | 1 |

## Does the series run into a ceiling?

Turbined flow stops at the machines and piles up against that limit; inflow does not. This needs
no design-flow figure — a series that spends a large share of its days within
1% of its own maximum is clipped, and one that touches its maximum once is not.
Mazar's two report series set the scale, since one is known inflow and the other known turbined
flow.

| series | mrid | days | p50 | p99 | max | days on ceiling |
|---|---|---|---|---|---|---|
| mazar/caudal_m3s (historian) | 30538 | 6064 | 60.8 | 434.97 | 867.12 | 0.02% |
| coca_codo_sinclair/caudal_m3s (historian) | 100037 | 3721 | 246 | 1025 | 1933 | 0.03% |
| agoyan/caudal_m3s (historian) | 140537 | 3718 | 105 | 490 | 1065 | 0.03% |
| manduriacu/caudal_m3s (historian) | 110537 | 3309 | 159.02 | 563.18 | 834 | 0.03% |
| mazar/caudal_m3s (inflow, 12-month report) | — | 4387 | 60 | 438 | 867 | 0.02% |
| mazar/caudal_m3s (inflow, per-day report) | — | 116 | 65.6 | 248.87 | 345.49 | 0.86% |
| mazar/q_turbinado_m3s (turbined flow) | — | 116 | 85.26 | 129 | 129.18 | 3.45% |

## Does the series track the plant's own generation?

Turbined flow and daily generation are the same quantity measured twice, at a head that barely
moves. Inflow is not: it arrives with the rain, and how much of it is generated is a decision.
This reading needs no second flow series, so unlike the direct comparison it reaches Coca Codo
Sinclair, Agoyán and Manduriacu — their generation comes from `{code}EnerDia`.

**This reading is weaker than it was designed to be, and the calibration row is what says so.**
Mazar's own turbined flow correlates with Mazar's own generation at r≈0.59, not the near-1 the
argument above predicts. The reason is known: `repDiaPotQTurb` is a snapshot at the midnight in
its stamp, not a daily mean (`potencia_mw` times 24 misses daily energy by ~1,000 MWh on a
~2,000 MWh day, and `{code}EnerDia`'s hours put it between the last hour of one day and the
first of the next; see `DATA_DATE_OFFSET_DAYS`), and an instant of flow cannot track a whole
day of energy. So the top of this scale is not anchored, and a plant scoring 0.5 cannot be
called turbined on the strength of it. Read the table only for what it still shows: the two
Mazar inflow series and Coca Codo Sinclair and Agoyán sit near zero, which is a reservoir
decoupling inflow from a generation decision. Manduriacu at 0.53 is the expected shape for
run-of-river *inflow* too — its inflow and its generation are the same water on the same day —
so it is not evidence either way. The ceiling reading above and the direct comparison carry the
verdict; this one corroborates and does not decide.

| series | mrid | days vs generation | r |
|---|---|---|---|
| mazar/caudal_m3s (historian) | 30538 | 3980 | -0.0001 |
| coca_codo_sinclair/caudal_m3s (historian) | 100037 | 3713 | -0.0811 |
| agoyan/caudal_m3s (historian) | 140537 | 3541 | 0.1191 |
| manduriacu/caudal_m3s (historian) | 110537 | 3309 | 0.5317 |
| mazar/caudal_m3s (inflow, 12-month report) | — | 3980 | 0 |
| mazar/caudal_m3s (inflow, per-day report) | — | 116 | -0.1844 |
| mazar/q_turbinado_m3s (turbined flow) | — | 116 | 0.5884 |

