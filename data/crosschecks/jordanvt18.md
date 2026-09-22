# Cross-check against jordanvt18/cotas-embalses-ecuador

Generated 2026-09-22T02:22:13Z. Their series reads the historian mrids; ours reads the daily report
endpoints. Both claim to be the same reservoir levels, so this is a check on our parsing,
our date convention and their scrape alike — a disagreement is recorded, not corrected.

## Best alignment per series

| site | our source | best offset | days compared | agree to 0.01 m | mean abs diff (m) | p95 | max |
|---|---|---|---|---|---|---|---|
| amaluza | ords:repDiaHid12m | +0 d | 1668 | 100.0% | 0 | 0 | 0.01 |
| mazar | ords:repDiaHid12m | +0 d | 1668 | 100.0% | 0.0001 | 0 | 0.01 |

`offset` is how far their date must move to line up with ours: a non-zero best offset over a
long overlap would mean the two routes date the same reading differently, which would matter
for every lag feature later.

Series with fewer than 30 overlapping days are listed below without a verdict. With
an overlap that short, the winning offset is decided by which dates each side happens to
have been backfilled to, not by the data:

| site | our source | days overlapping | note |
|---|---|---|---|
| amaluza | ords:repDiaNivQIng | 1 | not enough overlap to judge alignment |
| mazar | ords:repDiaNivQIng | 1 | not enough overlap to judge alignment |
| sopladora | ords:repDiaNivQIng | 1 | not enough overlap to judge alignment |

## All alignments tried

| site | our source | offset | days | mean abs diff (m) |
|---|---|---|---|---|
| amaluza | ords:repDiaHid12m | -1 d | 1667 | 0.6459 |
| amaluza | ords:repDiaHid12m | +0 d | 1668 | 0 |
| amaluza | ords:repDiaHid12m | +1 d | 1668 | 0.642 |
| amaluza | ords:repDiaNivQIng | -1 d | 1 | 0.003 |
| mazar | ords:repDiaHid12m | -1 d | 1667 | 0.4957 |
| mazar | ords:repDiaHid12m | +0 d | 1668 | 0.0001 |
| mazar | ords:repDiaHid12m | +1 d | 1668 | 0.4964 |
| mazar | ords:repDiaNivQIng | -1 d | 1 | 0 |
| sopladora | ords:repDiaNivQIng | -1 d | 1 | 0.0025 |

