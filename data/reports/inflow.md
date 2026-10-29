# Inflow forecasts — the plants whose level is not the question

Generated 2026-10-29T21:29:26Z by `npm run forecast` from the committed tables; no network. For the run-of-river and daily-storage plants the level is an operating decision taken within the day, so the target is the water arriving: the mean inflow over the next 7 and 14 days, in m³/s. Origins every 7 days from 2018-01-01, once a plant has 730 days of inflow; each rung sees only data up to its origin.

- **persistence** holds the origin day's inflow.
- **climatology** is the median of the same calendar window's mean over every earlier year.
- **analogue** takes each earlier year's window mean scaled by today's 7-day flow over that year's (clamped to 0.33–3), and, where the plant's catchment centroid has adequate ERA5, first keeps the 50% of years whose 16 days of rain before the origin were nearest today's.
- **ensemble**, the published rung since 2026-09-25, is the mean of the analogue and climatology rungs — and of a short-range river forecast's anomaly where one is supplied. The two rungs err in different directions, and their average beat the analogue alone at every plant and both horizons (`data/reports/geoglows-experiment.md`). A river forecast was a member in amaluza 0%, coca_codo_sinclair 0%, agoyan 17%, manduriacu 23%, minas_san_francisco 23%, delsitanisagua 0% of the scored cases.

A plant's forecast is published at a horizon only where the ensemble's MAE beats *both* persistence and climatology over the same origins. Its band is the ensemble median widened by its own out-of-sample residual quantiles, as every forecast here is.

## Verdict

| plant | origins | horizon | ensemble MAE | analogue | persistence | climatology | ensemble coverage p10–p90 | published |
|---|---:|---:|---:|---:|---:|---:|---:|---|
| Amaluza | 460 | 7 d | 39.2 | 43.5 | 51.2 | 47.6 | 84% | **yes** |
| Amaluza | 460 | 14 d | 36.8 | 43.9 | 52.6 | 42.1 | 84% | **yes** |
| Coca Codo Sinclair | 348 | 7 d | 86.2 | 103.0 | 118.3 | 94.6 | 78% | **yes** |
| Coca Codo Sinclair | 348 | 14 d | 78.0 | 101.1 | 120.6 | 81.2 | 78% | **yes** |
| Agoyán | 361 | 7 d | 33.8 | 40.2 | 41.4 | 40.6 | 82% | **yes** |
| Agoyán | 361 | 14 d | 32.8 | 41.3 | 43.2 | 37.6 | 80% | **yes** |
| Manduriacu | 265 | 7 d | 42.5 | 50.5 | 44.1 | 57.4 | 83% | **yes** |
| Manduriacu | 265 | 14 d | 41.4 | 49.1 | 48.7 | 53.0 | 81% | **yes** |
| Minas San Francisco | 261 | 7 d | 23.6 | 27.2 | 28.3 | 29.7 | 78% | **yes** |
| Minas San Francisco | 261 | 14 d | 22.8 | 26.7 | 31.1 | 27.9 | 80% | **yes** |
| Delsitanisagua | 267 | 7 d | 13.4 | 15.3 | 16.9 | 16.0 | 77% | **yes** |
| Delsitanisagua | 267 | 14 d | 12.0 | 14.3 | 16.3 | 14.3 | 78% | **yes** |

Published: amaluza 7 d, amaluza 14 d, coca_codo_sinclair 7 d, coca_codo_sinclair 14 d, agoyan 7 d, agoyan 14 d, manduriacu 7 d, manduriacu 14 d, minas_san_francisco 7 d, minas_san_francisco 14 d, delsitanisagua 7 d, delsitanisagua 14 d. Recorded negatives: none. Where climatology wins at 14 days the rivers are forgetting today's flow within a fortnight, and the honest forecast is the calendar; where persistence wins the flow is regulated upstream enough that today's number is the best guess for next week. Neither is published as an inflow forecast, because neither is a forecast this repository made.

## GEOGLOWS' forecast as a member

At the plants where GEOGLOWS' forecast earned a place (Agoyán, Manduriacu, Minas San Francisco; `src/lib/features/geoglows.ts`), it is the ensemble's third member on every origin whose next day's issue is stored (from 2024-07-01) and whose horizon it reaches (ten days). On those cases the ensemble with and without it:

| plant | horizon | cases | MAE with | MAE without |
|---|---:|---:|---:|---:|
| agoyan | 7 d | 121 | 31.8 | 34.8 |
| manduriacu | 7 d | 115 | 35.1 | 40.9 |
| minas_san_francisco | 7 d | 120 | 24.1 | 25.2 |

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
| amaluza | 7 d | persistence | 460 | 51.2 | -3.5 | 80% (448) | 18.1 |
| amaluza | 7 d | climatology | 460 | 47.6 | -7.5 | 83% (448) | 15.8 |
| amaluza | 7 d | analogue | 460 | 43.5 | -3.1 | 84% (448) | 15.3 |
| amaluza | 7 d | ensemble | 460 | 39.2 | -5.3 | 84% (448) | 13.3 |
| amaluza | 14 d | persistence | 459 | 52.6 | -3.4 | 82% (447) | 18.5 |
| amaluza | 14 d | climatology | 459 | 42.1 | -9.0 | 83% (447) | 13.7 |
| amaluza | 14 d | analogue | 459 | 43.9 | -5.2 | 81% (447) | 15.6 |
| amaluza | 14 d | ensemble | 459 | 36.8 | -7.1 | 84% (447) | 12.3 |
| coca_codo_sinclair | 7 d | persistence | 348 | 118.3 | -7.0 | 82% (336) | 43.8 |
| coca_codo_sinclair | 7 d | climatology | 348 | 94.6 | 30.5 | 78% (336) | 30.2 |
| coca_codo_sinclair | 7 d | analogue | 348 | 103.0 | 0.1 | 82% (336) | 34.6 |
| coca_codo_sinclair | 7 d | ensemble | 348 | 86.2 | 15.3 | 78% (336) | 28.1 |
| coca_codo_sinclair | 14 d | persistence | 334 | 120.6 | -7.4 | 78% (322) | 44.1 |
| coca_codo_sinclair | 14 d | climatology | 334 | 81.2 | 23.1 | 76% (322) | 25.3 |
| coca_codo_sinclair | 14 d | analogue | 334 | 101.1 | -5.5 | 79% (322) | 34.5 |
| coca_codo_sinclair | 14 d | ensemble | 334 | 78.0 | 8.8 | 78% (322) | 25.6 |
| agoyan | 7 d | persistence | 361 | 41.4 | -1.3 | 83% (349) | 15.8 |
| agoyan | 7 d | climatology | 361 | 40.6 | 4.2 | 76% (349) | 13.8 |
| agoyan | 7 d | analogue | 361 | 40.2 | 0.5 | 82% (349) | 14.1 |
| agoyan | 7 d | ensemble | 361 | 33.8 | 4.3 | 82% (349) | 11.6 |
| agoyan | 14 d | persistence | 351 | 43.2 | -2.1 | 80% (339) | 16.4 |
| agoyan | 14 d | climatology | 351 | 37.6 | 1.0 | 74% (339) | 12.2 |
| agoyan | 14 d | analogue | 351 | 41.3 | -3.9 | 80% (339) | 14.8 |
| agoyan | 14 d | ensemble | 351 | 32.8 | -1.5 | 80% (339) | 11.3 |
| manduriacu | 7 d | persistence | 265 | 44.1 | -3.5 | 77% (253) | 16.4 |
| manduriacu | 7 d | climatology | 265 | 57.4 | 25.4 | 76% (253) | 19.8 |
| manduriacu | 7 d | analogue | 265 | 50.5 | 0.7 | 83% (253) | 17.3 |
| manduriacu | 7 d | ensemble | 265 | 42.5 | 17.1 | 83% (253) | 14.6 |
| manduriacu | 14 d | persistence | 244 | 48.7 | -3.3 | 77% (232) | 18.4 |
| manduriacu | 14 d | climatology | 244 | 53.0 | 21.4 | 77% (232) | 18.4 |
| manduriacu | 14 d | analogue | 244 | 49.1 | -1.0 | 84% (232) | 17.2 |
| manduriacu | 14 d | ensemble | 244 | 41.4 | 10.2 | 81% (232) | 14.2 |
| minas_san_francisco | 7 d | persistence | 261 | 28.3 | -4.3 | 80% (249) | 12.0 |
| minas_san_francisco | 7 d | climatology | 261 | 29.7 | 8.5 | 76% (249) | 11.3 |
| minas_san_francisco | 7 d | analogue | 261 | 27.2 | 0.2 | 81% (249) | 10.5 |
| minas_san_francisco | 7 d | ensemble | 261 | 23.6 | 6.7 | 78% (249) | 9.2 |
| minas_san_francisco | 14 d | persistence | 260 | 31.1 | -4.4 | 81% (248) | 13.0 |
| minas_san_francisco | 14 d | climatology | 260 | 27.9 | 6.6 | 75% (248) | 10.3 |
| minas_san_francisco | 14 d | analogue | 260 | 26.7 | -4.2 | 80% (248) | 10.5 |
| minas_san_francisco | 14 d | ensemble | 260 | 22.8 | 1.2 | 80% (248) | 8.5 |
| delsitanisagua | 7 d | persistence | 267 | 16.9 | 0.4 | 75% (255) | 6.6 |
| delsitanisagua | 7 d | climatology | 267 | 16.0 | -2.2 | 77% (255) | 5.4 |
| delsitanisagua | 7 d | analogue | 267 | 15.3 | 0.1 | 75% (255) | 5.8 |
| delsitanisagua | 7 d | ensemble | 267 | 13.4 | -1.0 | 77% (255) | 4.9 |
| delsitanisagua | 14 d | persistence | 266 | 16.3 | 0.3 | 74% (254) | 6.1 |
| delsitanisagua | 14 d | climatology | 266 | 14.3 | -2.7 | 78% (254) | 4.7 |
| delsitanisagua | 14 d | analogue | 266 | 14.3 | -0.2 | 78% (254) | 5.3 |
| delsitanisagua | 14 d | ensemble | 266 | 12.0 | -1.5 | 78% (254) | 4.3 |

## Amaluza's level: not forecast, and why

Amaluza is the one other reservoir where a level forecast could mean something, as the cascade below Mazar. The shipped water balance was run on it once (2026-09-23, 105 monthly origins, Amaluza's level and inflow with Molino's production as the release): it lost to persistence by 220% at 7 days (MAE 5.55 m against 1.73 m) and by 119% at 90 days (8.56 m against 3.90 m). Amaluza holds a few hours of Molino's turbine flow and is silted; its level moves with the day's dispatch, not with the season, and a rule curve fitted over years has nothing to hold on to. A real cascade model would route Mazar's simulated release and the inter-dam inflow through a daily dispatch rule for Molino, which this data does not constrain. What is published for Amaluza is its inflow, above, where the ensemble earns it.
