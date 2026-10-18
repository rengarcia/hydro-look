# Inflow forecasts — the plants whose level is not the question

Generated 2026-10-18T19:01:20Z by `npm run forecast` from the committed tables; no network. For the run-of-river and daily-storage plants the level is an operating decision taken within the day, so the target is the water arriving: the mean inflow over the next 7 and 14 days, in m³/s. Origins every 7 days from 2018-01-01, once a plant has 730 days of inflow; each rung sees only data up to its origin.

- **persistence** holds the origin day's inflow.
- **climatology** is the median of the same calendar window's mean over every earlier year.
- **analogue** takes each earlier year's window mean scaled by today's 7-day flow over that year's (clamped to 0.33–3), and, where the plant's catchment centroid has adequate ERA5, first keeps the 50% of years whose 16 days of rain before the origin were nearest today's.
- **ensemble**, the published rung since 2026-09-25, is the mean of the analogue and climatology rungs — and of a short-range river forecast's anomaly where one is supplied. The two rungs err in different directions, and their average beat the analogue alone at every plant and both horizons (`data/reports/geoglows-experiment.md`). A river forecast was a member in amaluza 0%, coca_codo_sinclair 0%, agoyan 17%, manduriacu 22%, minas_san_francisco 23%, delsitanisagua 0% of the scored cases.

A plant's forecast is published at a horizon only where the ensemble's MAE beats *both* persistence and climatology over the same origins. Its band is the ensemble median widened by its own out-of-sample residual quantiles, as every forecast here is.

## Verdict

| plant | origins | horizon | ensemble MAE | analogue | persistence | climatology | ensemble coverage p10–p90 | published |
|---|---:|---:|---:|---:|---:|---:|---:|---|
| Amaluza | 458 | 7 d | 39.4 | 43.7 | 51.1 | 47.8 | 84% | **yes** |
| Amaluza | 458 | 14 d | 36.9 | 44.0 | 52.6 | 42.3 | 84% | **yes** |
| Coca Codo Sinclair | 346 | 7 d | 86.5 | 103.4 | 118.6 | 94.9 | 78% | **yes** |
| Coca Codo Sinclair | 346 | 14 d | 78.3 | 101.3 | 121.2 | 81.5 | 78% | **yes** |
| Agoyán | 359 | 7 d | 33.8 | 40.4 | 41.6 | 40.7 | 82% | **yes** |
| Agoyán | 359 | 14 d | 32.9 | 41.5 | 43.4 | 37.6 | 80% | **yes** |
| Manduriacu | 263 | 7 d | 42.3 | 50.6 | 44.0 | 56.9 | 83% | **yes** |
| Manduriacu | 263 | 14 d | 41.3 | 49.5 | 48.7 | 52.6 | 81% | **yes** |
| Minas San Francisco | 260 | 7 d | 23.7 | 27.3 | 28.4 | 29.8 | 78% | **yes** |
| Minas San Francisco | 260 | 14 d | 22.9 | 26.8 | 31.2 | 27.9 | 80% | **yes** |
| Delsitanisagua | 266 | 7 d | 13.4 | 15.3 | 16.9 | 16.0 | 77% | **yes** |
| Delsitanisagua | 266 | 14 d | 12.0 | 14.3 | 16.3 | 14.3 | 78% | **yes** |

Published: amaluza 7 d, amaluza 14 d, coca_codo_sinclair 7 d, coca_codo_sinclair 14 d, agoyan 7 d, agoyan 14 d, manduriacu 7 d, manduriacu 14 d, minas_san_francisco 7 d, minas_san_francisco 14 d, delsitanisagua 7 d, delsitanisagua 14 d. Recorded negatives: none. Where climatology wins at 14 days the rivers are forgetting today's flow within a fortnight, and the honest forecast is the calendar; where persistence wins the flow is regulated upstream enough that today's number is the best guess for next week. Neither is published as an inflow forecast, because neither is a forecast this repository made.

## GEOGLOWS' forecast as a member

At the plants where GEOGLOWS' forecast earned a place (Agoyán, Manduriacu, Minas San Francisco; `src/lib/features/geoglows.ts`), it is the ensemble's third member on every origin whose next day's issue is stored (from 2024-07-01) and whose horizon it reaches (ten days). On those cases the ensemble with and without it:

| plant | horizon | cases | MAE with | MAE without |
|---|---:|---:|---:|---:|
| agoyan | 7 d | 119 | 32.0 | 34.9 |
| manduriacu | 7 d | 113 | 34.5 | 40.4 |
| minas_san_francisco | 7 d | 119 | 24.3 | 25.4 |

## Rain conditioning

- Amaluza: `paute_mazar` — adequate ERA5; the analogue pool is conditioned on antecedent rain.
- Coca Codo Sinclair: `coca_ccs` — adequate ERA5; the analogue pool is conditioned on antecedent rain.
- Agoyán: `pastaza_agoyan` — adequate ERA5; the analogue pool is conditioned on antecedent rain.
- Manduriacu: `guayllabamba_manduriacu` — adequate ERA5; the analogue pool is conditioned on antecedent rain.
- Minas San Francisco: `jubones_msf` — adequate ERA5; the analogue pool is conditioned on antecedent rain.
- Delsitanisagua: `zamora_delsitanisagua` — adequate ERA5; the analogue pool is conditioned on antecedent rain.

The conditioner is the rain that had already fallen, read with ERA5's five-day latency, because that is what a forecaster has and what can be backtested. Conditioning on the 16-day *forecast* would need Open-Meteo's previous-runs archive, which is not ingested; §5.4's perfect-foresight experiment on Mazar says whether it is worth ingesting.

## Every rung, every plant

| plant | horizon | rung | n | MAE m³/s | bias | coverage p10–p90 (n) | pinball |
|---|---:|---|---:|---:|---:|---:|---:|
| amaluza | 7 d | persistence | 458 | 51.1 | -3.6 | 80% (446) | 18.1 |
| amaluza | 7 d | climatology | 458 | 47.8 | -7.5 | 83% (446) | 15.9 |
| amaluza | 7 d | analogue | 458 | 43.7 | -3.0 | 84% (446) | 15.4 |
| amaluza | 7 d | ensemble | 458 | 39.4 | -5.3 | 84% (446) | 13.3 |
| amaluza | 14 d | persistence | 457 | 52.6 | -3.7 | 82% (445) | 18.5 |
| amaluza | 14 d | climatology | 457 | 42.3 | -9.1 | 83% (445) | 13.7 |
| amaluza | 14 d | analogue | 457 | 44.0 | -5.1 | 81% (445) | 15.7 |
| amaluza | 14 d | ensemble | 457 | 36.9 | -7.1 | 84% (445) | 12.4 |
| coca_codo_sinclair | 7 d | persistence | 346 | 118.6 | -7.3 | 81% (334) | 44.0 |
| coca_codo_sinclair | 7 d | climatology | 346 | 94.9 | 30.9 | 78% (334) | 30.3 |
| coca_codo_sinclair | 7 d | analogue | 346 | 103.4 | -0.1 | 82% (334) | 34.7 |
| coca_codo_sinclair | 7 d | ensemble | 346 | 86.5 | 15.4 | 78% (334) | 28.2 |
| coca_codo_sinclair | 14 d | persistence | 332 | 121.2 | -7.4 | 78% (320) | 44.3 |
| coca_codo_sinclair | 14 d | climatology | 332 | 81.5 | 23.5 | 76% (320) | 25.4 |
| coca_codo_sinclair | 14 d | analogue | 332 | 101.3 | -5.6 | 78% (320) | 34.6 |
| coca_codo_sinclair | 14 d | ensemble | 332 | 78.3 | 8.9 | 78% (320) | 25.6 |
| agoyan | 7 d | persistence | 359 | 41.6 | -1.3 | 83% (347) | 15.8 |
| agoyan | 7 d | climatology | 359 | 40.7 | 4.4 | 76% (347) | 13.8 |
| agoyan | 7 d | analogue | 359 | 40.4 | 0.5 | 82% (347) | 14.1 |
| agoyan | 7 d | ensemble | 359 | 33.8 | 4.4 | 82% (347) | 11.6 |
| agoyan | 14 d | persistence | 349 | 43.4 | -2.1 | 80% (337) | 16.5 |
| agoyan | 14 d | climatology | 349 | 37.6 | 1.2 | 74% (337) | 12.3 |
| agoyan | 14 d | analogue | 349 | 41.5 | -3.9 | 80% (337) | 14.8 |
| agoyan | 14 d | ensemble | 349 | 32.9 | -1.4 | 80% (337) | 11.4 |
| manduriacu | 7 d | persistence | 263 | 44.0 | -3.7 | 78% (251) | 16.4 |
| manduriacu | 7 d | climatology | 263 | 56.9 | 24.7 | 76% (251) | 19.7 |
| manduriacu | 7 d | analogue | 263 | 50.6 | 0.6 | 83% (251) | 17.4 |
| manduriacu | 7 d | ensemble | 263 | 42.3 | 16.7 | 83% (251) | 14.6 |
| manduriacu | 14 d | persistence | 242 | 48.7 | -3.7 | 77% (230) | 18.4 |
| manduriacu | 14 d | climatology | 242 | 52.6 | 20.7 | 77% (230) | 18.4 |
| manduriacu | 14 d | analogue | 242 | 49.5 | -1.1 | 84% (230) | 17.3 |
| manduriacu | 14 d | ensemble | 242 | 41.3 | 9.8 | 81% (230) | 14.2 |
| minas_san_francisco | 7 d | persistence | 260 | 28.4 | -4.4 | 79% (248) | 12.0 |
| minas_san_francisco | 7 d | climatology | 260 | 29.8 | 8.6 | 76% (248) | 11.3 |
| minas_san_francisco | 7 d | analogue | 260 | 27.3 | 0.2 | 81% (248) | 10.5 |
| minas_san_francisco | 7 d | ensemble | 260 | 23.7 | 6.7 | 78% (248) | 9.2 |
| minas_san_francisco | 14 d | persistence | 259 | 31.2 | -4.4 | 81% (247) | 13.1 |
| minas_san_francisco | 14 d | climatology | 259 | 27.9 | 6.7 | 75% (247) | 10.3 |
| minas_san_francisco | 14 d | analogue | 259 | 26.8 | -4.2 | 80% (247) | 10.5 |
| minas_san_francisco | 14 d | ensemble | 259 | 22.9 | 1.3 | 80% (247) | 8.5 |
| delsitanisagua | 7 d | persistence | 266 | 16.9 | 0.4 | 75% (254) | 6.6 |
| delsitanisagua | 7 d | climatology | 266 | 16.0 | -2.1 | 77% (254) | 5.4 |
| delsitanisagua | 7 d | analogue | 266 | 15.3 | 0.2 | 75% (254) | 5.8 |
| delsitanisagua | 7 d | ensemble | 266 | 13.4 | -1.0 | 77% (254) | 4.9 |
| delsitanisagua | 14 d | persistence | 265 | 16.3 | 0.3 | 74% (253) | 6.1 |
| delsitanisagua | 14 d | climatology | 265 | 14.3 | -2.7 | 77% (253) | 4.7 |
| delsitanisagua | 14 d | analogue | 265 | 14.3 | -0.2 | 77% (253) | 5.3 |
| delsitanisagua | 14 d | ensemble | 265 | 12.0 | -1.5 | 78% (253) | 4.3 |

## Amaluza's level: not forecast, and why

Amaluza is the one other reservoir where a level forecast could mean something, as the cascade below Mazar. The shipped water balance was run on it once (2026-09-23, 105 monthly origins, Amaluza's level and inflow with Molino's production as the release): it lost to persistence by 220% at 7 days (MAE 5.55 m against 1.73 m) and by 119% at 90 days (8.56 m against 3.90 m). Amaluza holds a few hours of Molino's turbine flow and is silted; its level moves with the day's dispatch, not with the season, and a rule curve fitted over years has nothing to hold on to. A real cascade model would route Mazar's simulated release and the inter-dam inflow through a daily dispatch rule for Molino, which this data does not constrain. What is published for Amaluza is its inflow, above, where the ensemble earns it.
