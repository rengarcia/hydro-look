# Inflow forecasts — the plants whose level is not the question

Generated 2026-10-10T02:45:23Z by `npm run forecast` from the committed tables; no network. For the run-of-river and daily-storage plants the level is an operating decision taken within the day, so the target is the water arriving: the mean inflow over the next 7 and 14 days, in m³/s. Origins every 7 days from 2018-01-01, once a plant has 730 days of inflow; each rung sees only data up to its origin.

- **persistence** holds the origin day's inflow.
- **climatology** is the median of the same calendar window's mean over every earlier year.
- **analogue** takes each earlier year's window mean scaled by today's 7-day flow over that year's (clamped to 0.33–3), and, where the plant's catchment centroid has adequate ERA5, first keeps the 50% of years whose 16 days of rain before the origin were nearest today's.
- **ensemble**, the published rung since 2026-09-25, is the mean of the analogue and climatology rungs — and of a short-range river forecast's anomaly where one is supplied. The two rungs err in different directions, and their average beat the analogue alone at every plant and both horizons (`data/reports/geoglows-experiment.md`). A river forecast was a member in amaluza 0%, coca_codo_sinclair 0%, agoyan 17%, manduriacu 22%, minas_san_francisco 23%, delsitanisagua 0% of the scored cases.

A plant's forecast is published at a horizon only where the ensemble's MAE beats *both* persistence and climatology over the same origins. Its band is the ensemble median widened by its own out-of-sample residual quantiles, as every forecast here is.

## Verdict

| plant | origins | horizon | ensemble MAE | analogue | persistence | climatology | ensemble coverage p10–p90 | published |
|---|---:|---:|---:|---:|---:|---:|---:|---|
| Amaluza | 457 | 7 d | 39.4 | 43.7 | 51.1 | 47.8 | 84% | **yes** |
| Amaluza | 457 | 14 d | 36.9 | 44.0 | 52.6 | 42.4 | 84% | **yes** |
| Coca Codo Sinclair | 345 | 7 d | 86.7 | 103.6 | 119.0 | 95.2 | 78% | **yes** |
| Coca Codo Sinclair | 345 | 14 d | 78.6 | 101.6 | 121.5 | 81.7 | 77% | **yes** |
| Agoyán | 358 | 7 d | 33.9 | 40.5 | 41.7 | 40.7 | 82% | **yes** |
| Agoyán | 358 | 14 d | 33.0 | 41.6 | 43.5 | 37.7 | 79% | **yes** |
| Manduriacu | 262 | 7 d | 42.3 | 50.8 | 43.9 | 56.8 | 83% | **yes** |
| Manduriacu | 262 | 14 d | 41.3 | 49.4 | 48.7 | 52.6 | 81% | **yes** |
| Minas San Francisco | 259 | 7 d | 23.8 | 27.4 | 28.5 | 29.9 | 78% | **yes** |
| Minas San Francisco | 259 | 14 d | 23.0 | 26.9 | 31.3 | 28.0 | 80% | **yes** |
| Delsitanisagua | 264 | 7 d | 13.5 | 15.4 | 17.1 | 16.1 | 77% | **yes** |
| Delsitanisagua | 264 | 14 d | 12.1 | 14.4 | 16.4 | 14.3 | 78% | **yes** |

Published: amaluza 7 d, amaluza 14 d, coca_codo_sinclair 7 d, coca_codo_sinclair 14 d, agoyan 7 d, agoyan 14 d, manduriacu 7 d, manduriacu 14 d, minas_san_francisco 7 d, minas_san_francisco 14 d, delsitanisagua 7 d, delsitanisagua 14 d. Recorded negatives: none. Where climatology wins at 14 days the rivers are forgetting today's flow within a fortnight, and the honest forecast is the calendar; where persistence wins the flow is regulated upstream enough that today's number is the best guess for next week. Neither is published as an inflow forecast, because neither is a forecast this repository made.

## GEOGLOWS' forecast as a member

At the plants where GEOGLOWS' forecast earned a place (Agoyán, Manduriacu, Minas San Francisco; `src/lib/features/geoglows.ts`), it is the ensemble's third member on every origin whose next day's issue is stored (from 2024-07-01) and whose horizon it reaches (ten days). On those cases the ensemble with and without it:

| plant | horizon | cases | MAE with | MAE without |
|---|---:|---:|---:|---:|
| agoyan | 7 d | 118 | 32.2 | 35.2 |
| manduriacu | 7 d | 112 | 34.4 | 40.3 |
| minas_san_francisco | 7 d | 118 | 24.5 | 25.6 |

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
| amaluza | 7 d | persistence | 457 | 51.1 | -3.7 | 80% (445) | 18.1 |
| amaluza | 7 d | climatology | 457 | 47.8 | -7.6 | 83% (445) | 15.9 |
| amaluza | 7 d | analogue | 457 | 43.7 | -3.0 | 84% (445) | 15.4 |
| amaluza | 7 d | ensemble | 457 | 39.4 | -5.3 | 84% (445) | 13.4 |
| amaluza | 14 d | persistence | 456 | 52.6 | -3.6 | 82% (444) | 18.5 |
| amaluza | 14 d | climatology | 456 | 42.4 | -9.1 | 83% (444) | 13.7 |
| amaluza | 14 d | analogue | 456 | 44.0 | -5.0 | 81% (444) | 15.7 |
| amaluza | 14 d | ensemble | 456 | 36.9 | -7.1 | 84% (444) | 12.4 |
| coca_codo_sinclair | 7 d | persistence | 345 | 119.0 | -7.3 | 81% (333) | 44.1 |
| coca_codo_sinclair | 7 d | climatology | 345 | 95.2 | 31.0 | 78% (333) | 30.3 |
| coca_codo_sinclair | 7 d | analogue | 345 | 103.6 | 0.0 | 82% (333) | 34.7 |
| coca_codo_sinclair | 7 d | ensemble | 345 | 86.7 | 15.5 | 78% (333) | 28.2 |
| coca_codo_sinclair | 14 d | persistence | 331 | 121.5 | -7.5 | 78% (319) | 44.4 |
| coca_codo_sinclair | 14 d | climatology | 331 | 81.7 | 23.5 | 76% (319) | 25.4 |
| coca_codo_sinclair | 14 d | analogue | 331 | 101.6 | -5.7 | 78% (319) | 34.7 |
| coca_codo_sinclair | 14 d | ensemble | 331 | 78.6 | 8.9 | 77% (319) | 25.7 |
| agoyan | 7 d | persistence | 358 | 41.7 | -1.3 | 83% (346) | 15.9 |
| agoyan | 7 d | climatology | 358 | 40.7 | 4.5 | 75% (346) | 13.8 |
| agoyan | 7 d | analogue | 358 | 40.5 | 0.6 | 82% (346) | 14.1 |
| agoyan | 7 d | ensemble | 358 | 33.9 | 4.4 | 82% (346) | 11.6 |
| agoyan | 14 d | persistence | 348 | 43.5 | -2.1 | 80% (336) | 16.6 |
| agoyan | 14 d | climatology | 348 | 37.7 | 1.2 | 74% (336) | 12.3 |
| agoyan | 14 d | analogue | 348 | 41.6 | -4.0 | 80% (336) | 14.9 |
| agoyan | 14 d | ensemble | 348 | 33.0 | -1.4 | 79% (336) | 11.4 |
| manduriacu | 7 d | persistence | 262 | 43.9 | -4.0 | 78% (250) | 16.4 |
| manduriacu | 7 d | climatology | 262 | 56.8 | 24.5 | 76% (250) | 19.7 |
| manduriacu | 7 d | analogue | 262 | 50.8 | 0.5 | 83% (250) | 17.4 |
| manduriacu | 7 d | ensemble | 262 | 42.3 | 16.6 | 83% (250) | 14.6 |
| manduriacu | 14 d | persistence | 241 | 48.7 | -4.0 | 77% (229) | 18.4 |
| manduriacu | 14 d | climatology | 241 | 52.6 | 20.6 | 77% (229) | 18.4 |
| manduriacu | 14 d | analogue | 241 | 49.4 | -1.3 | 84% (229) | 17.3 |
| manduriacu | 14 d | ensemble | 241 | 41.3 | 9.6 | 81% (229) | 14.2 |
| minas_san_francisco | 7 d | persistence | 259 | 28.5 | -4.4 | 79% (247) | 12.1 |
| minas_san_francisco | 7 d | climatology | 259 | 29.9 | 8.6 | 76% (247) | 11.3 |
| minas_san_francisco | 7 d | analogue | 259 | 27.4 | 0.2 | 81% (247) | 10.5 |
| minas_san_francisco | 7 d | ensemble | 259 | 23.8 | 6.8 | 78% (247) | 9.2 |
| minas_san_francisco | 14 d | persistence | 258 | 31.3 | -4.4 | 81% (246) | 13.1 |
| minas_san_francisco | 14 d | climatology | 258 | 28.0 | 6.7 | 75% (246) | 10.3 |
| minas_san_francisco | 14 d | analogue | 258 | 26.9 | -4.2 | 80% (246) | 10.6 |
| minas_san_francisco | 14 d | ensemble | 258 | 23.0 | 1.3 | 80% (246) | 8.6 |
| delsitanisagua | 7 d | persistence | 264 | 17.1 | 0.4 | 75% (252) | 6.6 |
| delsitanisagua | 7 d | climatology | 264 | 16.1 | -2.1 | 77% (252) | 5.4 |
| delsitanisagua | 7 d | analogue | 264 | 15.4 | 0.2 | 75% (252) | 5.8 |
| delsitanisagua | 7 d | ensemble | 264 | 13.5 | -1.0 | 77% (252) | 4.9 |
| delsitanisagua | 14 d | persistence | 263 | 16.4 | 0.4 | 74% (251) | 6.1 |
| delsitanisagua | 14 d | climatology | 263 | 14.3 | -2.7 | 77% (251) | 4.7 |
| delsitanisagua | 14 d | analogue | 263 | 14.4 | -0.2 | 77% (251) | 5.3 |
| delsitanisagua | 14 d | ensemble | 263 | 12.1 | -1.4 | 78% (251) | 4.3 |

## Amaluza's level: not forecast, and why

Amaluza is the one other reservoir where a level forecast could mean something, as the cascade below Mazar. The shipped water balance was run on it once (2026-09-23, 105 monthly origins, Amaluza's level and inflow with Molino's production as the release): it lost to persistence by 220% at 7 days (MAE 5.55 m against 1.73 m) and by 119% at 90 days (8.56 m against 3.90 m). Amaluza holds a few hours of Molino's turbine flow and is silted; its level moves with the day's dispatch, not with the season, and a rule curve fitted over years has nothing to hold on to. A real cascade model would route Mazar's simulated release and the inter-dam inflow through a daily dispatch rule for Molino, which this data does not constrain. What is published for Amaluza is its inflow, above, where the ensemble earns it.
