# Inflow forecasts — the plants whose level is not the question

Generated 2026-11-17T03:16:52Z by `npm run forecast` from the committed tables; no network. For the run-of-river and daily-storage plants the level is an operating decision taken within the day, so the target is the water arriving: the mean inflow over the next 7 and 14 days, in m³/s. Origins every 7 days from 2018-01-01, once a plant has 730 days of inflow; each rung sees only data up to its origin.

- **persistence** holds the origin day's inflow.
- **climatology** is the median of the same calendar window's mean over every earlier year.
- **analogue** takes each earlier year's window mean scaled by today's 7-day flow over that year's (clamped to 0.33–3), and, where the plant's catchment centroid has adequate ERA5, first keeps the 50% of years whose 16 days of rain before the origin were nearest today's.
- **ensemble**, the published rung since 2026-09-25, is the mean of the analogue and climatology rungs — and of a short-range river forecast's anomaly where one is supplied. The two rungs err in different directions, and their average beat the analogue alone at every plant and both horizons (`data/reports/geoglows-experiment.md`). A river forecast was a member in amaluza 0%, coca_codo_sinclair 0%, agoyan 17%, manduriacu 23%, minas_san_francisco 23%, delsitanisagua 0% of the scored cases.

A plant's forecast is published at a horizon only where the ensemble's MAE beats *both* persistence and climatology over the same origins. Its band is the ensemble median widened by its own out-of-sample residual quantiles, as every forecast here is.

## Verdict

| plant | origins | horizon | ensemble MAE | analogue | persistence | climatology | ensemble coverage p10–p90 | published |
|---|---:|---:|---:|---:|---:|---:|---:|---|
| Amaluza | 462 | 7 d | 39.2 | 43.4 | 51.2 | 47.5 | 84% | **yes** |
| Amaluza | 462 | 14 d | 36.7 | 43.8 | 52.7 | 42.1 | 84% | **yes** |
| Coca Codo Sinclair | 350 | 7 d | 85.8 | 102.5 | 117.9 | 94.2 | 78% | **yes** |
| Coca Codo Sinclair | 350 | 14 d | 77.7 | 100.8 | 120.1 | 80.9 | 78% | **yes** |
| Agoyán | 363 | 7 d | 33.6 | 40.1 | 41.2 | 40.5 | 82% | **yes** |
| Agoyán | 363 | 14 d | 32.7 | 41.2 | 43.0 | 37.5 | 80% | **yes** |
| Manduriacu | 267 | 7 d | 42.8 | 50.1 | 44.1 | 58.1 | 83% | **yes** |
| Manduriacu | 267 | 14 d | 41.8 | 49.0 | 49.1 | 53.8 | 81% | **yes** |
| Minas San Francisco | 264 | 7 d | 23.5 | 27.1 | 28.2 | 29.6 | 79% | **yes** |
| Minas San Francisco | 264 | 14 d | 22.7 | 26.5 | 31.1 | 27.7 | 80% | **yes** |
| Delsitanisagua | 270 | 7 d | 13.3 | 15.1 | 16.7 | 15.9 | 77% | **yes** |
| Delsitanisagua | 270 | 14 d | 11.9 | 14.1 | 16.1 | 14.2 | 79% | **yes** |

Published: amaluza 7 d, amaluza 14 d, coca_codo_sinclair 7 d, coca_codo_sinclair 14 d, agoyan 7 d, agoyan 14 d, manduriacu 7 d, manduriacu 14 d, minas_san_francisco 7 d, minas_san_francisco 14 d, delsitanisagua 7 d, delsitanisagua 14 d. Recorded negatives: none. Where climatology wins at 14 days the rivers are forgetting today's flow within a fortnight, and the honest forecast is the calendar; where persistence wins the flow is regulated upstream enough that today's number is the best guess for next week. Neither is published as an inflow forecast, because neither is a forecast this repository made.

## GEOGLOWS' forecast as a member

At the plants where GEOGLOWS' forecast earned a place (Agoyán, Manduriacu, Minas San Francisco; `src/lib/features/geoglows.ts`), it is the ensemble's third member on every origin whose next day's issue is stored (from 2024-07-01) and whose horizon it reaches (ten days). On those cases the ensemble with and without it:

| plant | horizon | cases | MAE with | MAE without |
|---|---:|---:|---:|---:|
| agoyan | 7 d | 123 | 31.4 | 34.4 |
| manduriacu | 7 d | 117 | 35.9 | 41.5 |
| minas_san_francisco | 7 d | 123 | 23.8 | 25.0 |

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
| amaluza | 7 d | persistence | 462 | 51.2 | -3.5 | 80% (450) | 18.1 |
| amaluza | 7 d | climatology | 462 | 47.5 | -7.7 | 84% (450) | 15.8 |
| amaluza | 7 d | analogue | 462 | 43.4 | -3.1 | 84% (450) | 15.3 |
| amaluza | 7 d | ensemble | 462 | 39.2 | -5.4 | 84% (450) | 13.3 |
| amaluza | 14 d | persistence | 461 | 52.7 | -3.7 | 82% (449) | 18.5 |
| amaluza | 14 d | climatology | 461 | 42.1 | -9.1 | 83% (449) | 13.7 |
| amaluza | 14 d | analogue | 461 | 43.8 | -5.2 | 81% (449) | 15.6 |
| amaluza | 14 d | ensemble | 461 | 36.7 | -7.2 | 84% (449) | 12.3 |
| coca_codo_sinclair | 7 d | persistence | 350 | 117.9 | -7.1 | 82% (338) | 43.7 |
| coca_codo_sinclair | 7 d | climatology | 350 | 94.2 | 30.5 | 78% (338) | 30.1 |
| coca_codo_sinclair | 7 d | analogue | 350 | 102.5 | 0.1 | 82% (338) | 34.4 |
| coca_codo_sinclair | 7 d | ensemble | 350 | 85.8 | 15.3 | 78% (338) | 28.0 |
| coca_codo_sinclair | 14 d | persistence | 336 | 120.1 | -7.0 | 78% (324) | 44.0 |
| coca_codo_sinclair | 14 d | climatology | 336 | 80.9 | 23.1 | 76% (324) | 25.2 |
| coca_codo_sinclair | 14 d | analogue | 336 | 100.8 | -5.4 | 79% (324) | 34.4 |
| coca_codo_sinclair | 14 d | ensemble | 336 | 77.7 | 8.8 | 78% (324) | 25.5 |
| agoyan | 7 d | persistence | 363 | 41.2 | -1.3 | 83% (351) | 15.7 |
| agoyan | 7 d | climatology | 363 | 40.5 | 4.2 | 76% (351) | 13.7 |
| agoyan | 7 d | analogue | 363 | 40.1 | 0.6 | 82% (351) | 14.0 |
| agoyan | 7 d | ensemble | 363 | 33.6 | 4.3 | 82% (351) | 11.6 |
| agoyan | 14 d | persistence | 353 | 43.0 | -2.0 | 80% (341) | 16.4 |
| agoyan | 14 d | climatology | 353 | 37.5 | 0.9 | 74% (341) | 12.2 |
| agoyan | 14 d | analogue | 353 | 41.2 | -3.9 | 80% (341) | 14.7 |
| agoyan | 14 d | ensemble | 353 | 32.7 | -1.5 | 80% (341) | 11.3 |
| manduriacu | 7 d | persistence | 267 | 44.1 | -3.7 | 78% (255) | 16.4 |
| manduriacu | 7 d | climatology | 267 | 58.1 | 26.4 | 76% (255) | 19.9 |
| manduriacu | 7 d | analogue | 267 | 50.1 | 0.7 | 83% (255) | 17.2 |
| manduriacu | 7 d | ensemble | 267 | 42.8 | 17.6 | 83% (255) | 14.7 |
| manduriacu | 14 d | persistence | 246 | 49.1 | -3.3 | 76% (234) | 18.4 |
| manduriacu | 14 d | climatology | 246 | 53.8 | 22.5 | 76% (234) | 18.6 |
| manduriacu | 14 d | analogue | 246 | 49.0 | -0.9 | 85% (234) | 17.1 |
| manduriacu | 14 d | ensemble | 246 | 41.8 | 10.8 | 81% (234) | 14.3 |
| minas_san_francisco | 7 d | persistence | 264 | 28.2 | -4.3 | 80% (252) | 11.9 |
| minas_san_francisco | 7 d | climatology | 264 | 29.6 | 8.7 | 76% (252) | 11.2 |
| minas_san_francisco | 7 d | analogue | 264 | 27.1 | 0.2 | 81% (252) | 10.4 |
| minas_san_francisco | 7 d | ensemble | 264 | 23.5 | 6.7 | 79% (252) | 9.1 |
| minas_san_francisco | 14 d | persistence | 263 | 31.1 | -4.3 | 81% (251) | 13.0 |
| minas_san_francisco | 14 d | climatology | 263 | 27.7 | 6.8 | 75% (251) | 10.2 |
| minas_san_francisco | 14 d | analogue | 263 | 26.5 | -3.9 | 80% (251) | 10.4 |
| minas_san_francisco | 14 d | ensemble | 263 | 22.7 | 1.4 | 80% (251) | 8.5 |
| delsitanisagua | 7 d | persistence | 270 | 16.7 | 0.3 | 75% (258) | 6.5 |
| delsitanisagua | 7 d | climatology | 270 | 15.9 | -2.2 | 78% (258) | 5.3 |
| delsitanisagua | 7 d | analogue | 270 | 15.1 | 0.1 | 76% (258) | 5.7 |
| delsitanisagua | 7 d | ensemble | 270 | 13.3 | -1.0 | 77% (258) | 4.8 |
| delsitanisagua | 14 d | persistence | 269 | 16.1 | 0.3 | 74% (257) | 6.0 |
| delsitanisagua | 14 d | climatology | 269 | 14.2 | -2.7 | 78% (257) | 4.7 |
| delsitanisagua | 14 d | analogue | 269 | 14.1 | -0.2 | 78% (257) | 5.3 |
| delsitanisagua | 14 d | ensemble | 269 | 11.9 | -1.5 | 79% (257) | 4.3 |

## Amaluza's level: not forecast, and why

Amaluza is the one other reservoir where a level forecast could mean something, as the cascade below Mazar. The shipped water balance was run on it once (2026-09-23, 105 monthly origins, Amaluza's level and inflow with Molino's production as the release): it lost to persistence by 220% at 7 days (MAE 5.55 m against 1.73 m) and by 119% at 90 days (8.56 m against 3.90 m). Amaluza holds a few hours of Molino's turbine flow and is silted; its level moves with the day's dispatch, not with the season, and a rule curve fitted over years has nothing to hold on to. A real cascade model would route Mazar's simulated release and the inter-dam inflow through a daily dispatch rule for Molino, which this data does not constrain. What is published for Amaluza is its inflow, above, where the ensemble earns it.
