# Inflow forecasts — the plants whose level is not the question

Generated 2026-09-25T05:49:54Z by `npm run forecast` from the committed tables; no network. For the run-of-river and daily-storage plants the level is an operating decision taken within the day, so the target is the water arriving: the mean inflow over the next 7 and 14 days, in m³/s. Origins every 7 days from 2018-01-01, once a plant has 730 days of inflow; each rung sees only data up to its origin.

- **persistence** holds the origin day's inflow.
- **climatology** is the median of the same calendar window's mean over every earlier year.
- **analogue** takes each earlier year's window mean scaled by today's 7-day flow over that year's (clamped to 0.33–3), and, where the plant's catchment centroid has adequate ERA5, first keeps the 50% of years whose 16 days of rain before the origin were nearest today's.
- **ensemble**, the published rung since 2026-09-25, is the mean of the analogue and climatology rungs — and of a short-range river forecast's anomaly where one is supplied. The two rungs err in different directions, and their average beat the analogue alone at every plant and both horizons (`data/reports/geoglows-experiment.md`). No river forecast is a member yet.

A plant's forecast is published at a horizon only where the ensemble's MAE beats *both* persistence and climatology over the same origins. Its band is the ensemble median widened by its own out-of-sample residual quantiles, as every forecast here is.

## Verdict

| plant | origins | horizon | ensemble MAE | analogue | persistence | climatology | ensemble coverage p10–p90 | published |
|---|---:|---:|---:|---:|---:|---:|---:|---|
| Amaluza | 455 | 7 d | 39.5 | 43.9 | 51.2 | 47.9 | 84% | **yes** |
| Amaluza | 455 | 14 d | 37.1 | 44.1 | 52.7 | 42.4 | 83% | **yes** |
| Coca Codo Sinclair | 343 | 7 d | 87.1 | 104.1 | 119.5 | 95.6 | 78% | **yes** |
| Coca Codo Sinclair | 343 | 14 d | 78.9 | 102.0 | 121.6 | 82.2 | 77% | **yes** |
| Agoyán | 356 | 7 d | 35.1 | 40.7 | 41.9 | 40.9 | 80% | **yes** |
| Agoyán | 356 | 14 d | 33.2 | 41.8 | 43.7 | 37.9 | 79% | **yes** |
| Manduriacu | 260 | 7 d | 44.9 | 50.8 | 44.0 | 57.0 | 80% | no — ensemble MAE 44.9 m3/s does not beat persistence (44.0) |
| Manduriacu | 260 | 14 d | 41.4 | 49.6 | 48.8 | 52.9 | 81% | **yes** |
| Minas San Francisco | 256 | 7 d | 24.5 | 27.6 | 28.7 | 30.2 | 77% | **yes** |
| Minas San Francisco | 256 | 14 d | 23.2 | 27.1 | 31.6 | 28.3 | 79% | **yes** |
| Delsitanisagua | 262 | 7 d | 13.5 | 15.4 | 17.1 | 16.2 | 76% | **yes** |
| Delsitanisagua | 262 | 14 d | 12.1 | 14.4 | 16.4 | 14.4 | 78% | **yes** |

Published: amaluza 7 d, amaluza 14 d, coca_codo_sinclair 7 d, coca_codo_sinclair 14 d, agoyan 7 d, agoyan 14 d, manduriacu 14 d, minas_san_francisco 7 d, minas_san_francisco 14 d, delsitanisagua 7 d, delsitanisagua 14 d. Recorded negatives: manduriacu 7 d. Where climatology wins at 14 days the rivers are forgetting today's flow within a fortnight, and the honest forecast is the calendar; where persistence wins the flow is regulated upstream enough that today's number is the best guess for next week. Neither is published as an inflow forecast, because neither is a forecast this repository made.

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
| amaluza | 7 d | persistence | 455 | 51.2 | -3.6 | 80% (443) | 18.2 |
| amaluza | 7 d | climatology | 455 | 47.9 | -7.7 | 83% (443) | 15.9 |
| amaluza | 7 d | analogue | 455 | 43.9 | -3.0 | 84% (443) | 15.4 |
| amaluza | 7 d | ensemble | 455 | 39.5 | -5.4 | 84% (443) | 13.4 |
| amaluza | 14 d | persistence | 454 | 52.7 | -3.6 | 82% (442) | 18.5 |
| amaluza | 14 d | climatology | 454 | 42.4 | -9.3 | 83% (442) | 13.8 |
| amaluza | 14 d | analogue | 454 | 44.1 | -5.0 | 81% (442) | 15.7 |
| amaluza | 14 d | ensemble | 454 | 37.1 | -7.1 | 83% (442) | 12.4 |
| coca_codo_sinclair | 7 d | persistence | 343 | 119.5 | -7.5 | 81% (331) | 44.2 |
| coca_codo_sinclair | 7 d | climatology | 343 | 95.6 | 31.1 | 78% (331) | 30.4 |
| coca_codo_sinclair | 7 d | analogue | 343 | 104.1 | -0.1 | 82% (331) | 34.9 |
| coca_codo_sinclair | 7 d | ensemble | 343 | 87.1 | 15.5 | 78% (331) | 28.3 |
| coca_codo_sinclair | 14 d | persistence | 329 | 121.6 | -7.0 | 78% (317) | 44.5 |
| coca_codo_sinclair | 14 d | climatology | 329 | 82.2 | 23.6 | 76% (317) | 25.5 |
| coca_codo_sinclair | 14 d | analogue | 329 | 102.0 | -5.7 | 78% (317) | 34.8 |
| coca_codo_sinclair | 14 d | ensemble | 329 | 78.9 | 9.0 | 77% (317) | 25.8 |
| agoyan | 7 d | persistence | 356 | 41.9 | -1.3 | 83% (344) | 15.9 |
| agoyan | 7 d | climatology | 356 | 40.9 | 4.6 | 75% (344) | 13.9 |
| agoyan | 7 d | analogue | 356 | 40.7 | 0.6 | 82% (344) | 14.2 |
| agoyan | 7 d | ensemble | 356 | 35.1 | 2.6 | 80% (344) | 12.0 |
| agoyan | 14 d | persistence | 346 | 43.7 | -2.0 | 80% (334) | 16.6 |
| agoyan | 14 d | climatology | 346 | 37.9 | 1.3 | 74% (334) | 12.3 |
| agoyan | 14 d | analogue | 346 | 41.8 | -4.0 | 80% (334) | 14.9 |
| agoyan | 14 d | ensemble | 346 | 33.2 | -1.4 | 79% (334) | 11.4 |
| manduriacu | 7 d | persistence | 260 | 44.0 | -4.3 | 78% (248) | 16.4 |
| manduriacu | 7 d | climatology | 260 | 57.0 | 24.5 | 76% (248) | 19.8 |
| manduriacu | 7 d | analogue | 260 | 50.8 | 0.2 | 83% (248) | 17.5 |
| manduriacu | 7 d | ensemble | 260 | 44.9 | 12.3 | 80% (248) | 15.5 |
| manduriacu | 14 d | persistence | 239 | 48.8 | -4.3 | 77% (227) | 18.5 |
| manduriacu | 14 d | climatology | 239 | 52.9 | 20.6 | 77% (227) | 18.5 |
| manduriacu | 14 d | analogue | 239 | 49.6 | -1.6 | 84% (227) | 17.4 |
| manduriacu | 14 d | ensemble | 239 | 41.4 | 9.5 | 81% (227) | 14.3 |
| minas_san_francisco | 7 d | persistence | 256 | 28.7 | -4.5 | 79% (244) | 12.2 |
| minas_san_francisco | 7 d | climatology | 256 | 30.2 | 8.7 | 75% (244) | 11.4 |
| minas_san_francisco | 7 d | analogue | 256 | 27.6 | 0.2 | 80% (244) | 10.6 |
| minas_san_francisco | 7 d | ensemble | 256 | 24.5 | 4.4 | 77% (244) | 9.4 |
| minas_san_francisco | 14 d | persistence | 255 | 31.6 | -4.5 | 81% (243) | 13.2 |
| minas_san_francisco | 14 d | climatology | 255 | 28.3 | 6.8 | 74% (243) | 10.4 |
| minas_san_francisco | 14 d | analogue | 255 | 27.1 | -4.2 | 80% (243) | 10.7 |
| minas_san_francisco | 14 d | ensemble | 255 | 23.2 | 1.3 | 79% (243) | 8.6 |
| delsitanisagua | 7 d | persistence | 262 | 17.1 | 0.5 | 75% (250) | 6.6 |
| delsitanisagua | 7 d | climatology | 262 | 16.2 | -2.1 | 77% (250) | 5.4 |
| delsitanisagua | 7 d | analogue | 262 | 15.4 | 0.3 | 75% (250) | 5.8 |
| delsitanisagua | 7 d | ensemble | 262 | 13.5 | -0.9 | 76% (250) | 4.9 |
| delsitanisagua | 14 d | persistence | 261 | 16.4 | 0.5 | 74% (249) | 6.1 |
| delsitanisagua | 14 d | climatology | 261 | 14.4 | -2.7 | 77% (249) | 4.8 |
| delsitanisagua | 14 d | analogue | 261 | 14.4 | -0.1 | 77% (249) | 5.4 |
| delsitanisagua | 14 d | ensemble | 261 | 12.1 | -1.4 | 78% (249) | 4.4 |

## Amaluza's level: not forecast, and why

Amaluza is the one other reservoir where a level forecast could mean something, as the cascade below Mazar. The shipped water balance was run on it once (2026-09-23, 105 monthly origins, Amaluza's level and inflow with Molino's production as the release): it lost to persistence by 220% at 7 days (MAE 5.55 m against 1.73 m) and by 119% at 90 days (8.56 m against 3.90 m). Amaluza holds a few hours of Molino's turbine flow and is silted; its level moves with the day's dispatch, not with the season, and a rule curve fitted over years has nothing to hold on to. A real cascade model would route Mazar's simulated release and the inter-dam inflow through a daily dispatch rule for Molino, which this data does not constrain. What is published for Amaluza is its inflow, above, where the ensemble earns it.
