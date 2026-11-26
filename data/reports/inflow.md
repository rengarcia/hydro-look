# Inflow forecasts — the plants whose level is not the question

Generated 2026-11-26T22:01:28Z by `npm run forecast` from the committed tables; no network. For the run-of-river and daily-storage plants the level is an operating decision taken within the day, so the target is the water arriving: the mean inflow over the next 7 and 14 days, in m³/s. Origins every 7 days from 2018-01-01, once a plant has 730 days of inflow; each rung sees only data up to its origin.

- **persistence** holds the origin day's inflow.
- **climatology** is the median of the same calendar window's mean over every earlier year.
- **analogue** takes each earlier year's window mean scaled by today's 7-day flow over that year's (clamped to 0.33–3), and, where the plant's catchment centroid has adequate ERA5, first keeps the 50% of years whose 16 days of rain before the origin were nearest today's.
- **ensemble**, the published rung since 2026-09-25, is the mean of the analogue and climatology rungs — and of a short-range river forecast's anomaly where one is supplied. The two rungs err in different directions, and their average beat the analogue alone at every plant and both horizons (`data/reports/geoglows-experiment.md`). A river forecast was a member in amaluza 0%, coca_codo_sinclair 0%, agoyan 17%, manduriacu 23%, minas_san_francisco 23%, delsitanisagua 0% of the scored cases.

A plant's forecast is published at a horizon only where the ensemble's MAE beats *both* persistence and climatology over the same origins. Its band is the ensemble median widened by its own out-of-sample residual quantiles, as every forecast here is.

## Verdict

| plant | origins | horizon | ensemble MAE | analogue | persistence | climatology | ensemble coverage p10–p90 | published |
|---|---:|---:|---:|---:|---:|---:|---:|---|
| Amaluza | 464 | 7 d | 39.1 | 43.4 | 51.2 | 47.4 | 84% | **yes** |
| Amaluza | 464 | 14 d | 36.7 | 43.8 | 52.7 | 41.9 | 84% | **yes** |
| Coca Codo Sinclair | 352 | 7 d | 85.5 | 102.2 | 117.2 | 93.9 | 78% | **yes** |
| Coca Codo Sinclair | 352 | 14 d | 77.5 | 100.5 | 119.7 | 80.5 | 78% | **yes** |
| Agoyán | 365 | 7 d | 33.5 | 40.0 | 41.1 | 40.3 | 82% | **yes** |
| Agoyán | 365 | 14 d | 32.6 | 41.0 | 42.8 | 37.3 | 80% | **yes** |
| Manduriacu | 269 | 7 d | 42.9 | 50.2 | 44.2 | 58.4 | 83% | **yes** |
| Manduriacu | 269 | 14 d | 41.7 | 48.8 | 48.9 | 54.2 | 81% | **yes** |
| Minas San Francisco | 265 | 7 d | 23.4 | 27.0 | 28.1 | 29.5 | 79% | **yes** |
| Minas San Francisco | 265 | 14 d | 22.7 | 26.5 | 31.0 | 27.6 | 80% | **yes** |
| Delsitanisagua | 271 | 7 d | 13.2 | 15.1 | 16.7 | 15.8 | 77% | **yes** |
| Delsitanisagua | 271 | 14 d | 11.9 | 14.1 | 16.1 | 14.1 | 79% | **yes** |

Published: amaluza 7 d, amaluza 14 d, coca_codo_sinclair 7 d, coca_codo_sinclair 14 d, agoyan 7 d, agoyan 14 d, manduriacu 7 d, manduriacu 14 d, minas_san_francisco 7 d, minas_san_francisco 14 d, delsitanisagua 7 d, delsitanisagua 14 d. Recorded negatives: none. Where climatology wins at 14 days the rivers are forgetting today's flow within a fortnight, and the honest forecast is the calendar; where persistence wins the flow is regulated upstream enough that today's number is the best guess for next week. Neither is published as an inflow forecast, because neither is a forecast this repository made.

## GEOGLOWS' forecast as a member

At the plants where GEOGLOWS' forecast earned a place (Agoyán, Manduriacu, Minas San Francisco; `src/lib/features/geoglows.ts`), it is the ensemble's third member on every origin whose next day's issue is stored (from 2024-07-01) and whose horizon it reaches (ten days). On those cases the ensemble with and without it:

| plant | horizon | cases | MAE with | MAE without |
|---|---:|---:|---:|---:|
| agoyan | 7 d | 125 | 31.0 | 34.0 |
| manduriacu | 7 d | 119 | 36.3 | 41.7 |
| minas_san_francisco | 7 d | 124 | 23.7 | 24.8 |

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
| amaluza | 7 d | persistence | 464 | 51.2 | -3.7 | 80% (452) | 18.1 |
| amaluza | 7 d | climatology | 464 | 47.4 | -7.6 | 84% (452) | 15.7 |
| amaluza | 7 d | analogue | 464 | 43.4 | -3.0 | 84% (452) | 15.3 |
| amaluza | 7 d | ensemble | 464 | 39.1 | -5.3 | 84% (452) | 13.2 |
| amaluza | 14 d | persistence | 463 | 52.7 | -3.6 | 82% (451) | 18.4 |
| amaluza | 14 d | climatology | 463 | 41.9 | -9.1 | 83% (451) | 13.6 |
| amaluza | 14 d | analogue | 463 | 43.8 | -5.1 | 81% (451) | 15.6 |
| amaluza | 14 d | ensemble | 463 | 36.7 | -7.1 | 84% (451) | 12.3 |
| coca_codo_sinclair | 7 d | persistence | 352 | 117.2 | -7.0 | 82% (340) | 43.5 |
| coca_codo_sinclair | 7 d | climatology | 352 | 93.9 | 30.2 | 78% (340) | 30.0 |
| coca_codo_sinclair | 7 d | analogue | 352 | 102.2 | -0.1 | 82% (340) | 34.3 |
| coca_codo_sinclair | 7 d | ensemble | 352 | 85.5 | 15.0 | 78% (340) | 27.9 |
| coca_codo_sinclair | 14 d | persistence | 338 | 119.7 | -7.2 | 79% (326) | 43.8 |
| coca_codo_sinclair | 14 d | climatology | 338 | 80.5 | 22.8 | 76% (326) | 25.1 |
| coca_codo_sinclair | 14 d | analogue | 338 | 100.5 | -5.7 | 79% (326) | 34.3 |
| coca_codo_sinclair | 14 d | ensemble | 338 | 77.5 | 8.6 | 78% (326) | 25.4 |
| agoyan | 7 d | persistence | 365 | 41.1 | -1.2 | 83% (353) | 15.7 |
| agoyan | 7 d | climatology | 365 | 40.3 | 4.1 | 76% (353) | 13.7 |
| agoyan | 7 d | analogue | 365 | 40.0 | 0.6 | 82% (353) | 14.0 |
| agoyan | 7 d | ensemble | 365 | 33.5 | 4.3 | 82% (353) | 11.5 |
| agoyan | 14 d | persistence | 355 | 42.8 | -2.0 | 80% (343) | 16.3 |
| agoyan | 14 d | climatology | 355 | 37.3 | 0.9 | 74% (343) | 12.2 |
| agoyan | 14 d | analogue | 355 | 41.0 | -3.8 | 80% (343) | 14.7 |
| agoyan | 14 d | ensemble | 355 | 32.6 | -1.4 | 80% (343) | 11.3 |
| manduriacu | 7 d | persistence | 269 | 44.2 | -3.3 | 77% (257) | 16.4 |
| manduriacu | 7 d | climatology | 269 | 58.4 | 26.9 | 76% (257) | 19.9 |
| manduriacu | 7 d | analogue | 269 | 50.2 | 0.8 | 83% (257) | 17.2 |
| manduriacu | 7 d | ensemble | 269 | 42.9 | 17.9 | 83% (257) | 14.7 |
| manduriacu | 14 d | persistence | 248 | 48.9 | -3.2 | 76% (236) | 18.4 |
| manduriacu | 14 d | climatology | 248 | 54.2 | 23.0 | 77% (236) | 18.7 |
| manduriacu | 14 d | analogue | 248 | 48.8 | -1.1 | 85% (236) | 17.1 |
| manduriacu | 14 d | ensemble | 248 | 41.7 | 11.0 | 81% (236) | 14.2 |
| minas_san_francisco | 7 d | persistence | 265 | 28.1 | -4.3 | 80% (253) | 11.9 |
| minas_san_francisco | 7 d | climatology | 265 | 29.5 | 8.6 | 76% (253) | 11.2 |
| minas_san_francisco | 7 d | analogue | 265 | 27.0 | 0.2 | 81% (253) | 10.4 |
| minas_san_francisco | 7 d | ensemble | 265 | 23.4 | 6.7 | 79% (253) | 9.1 |
| minas_san_francisco | 14 d | persistence | 264 | 31.0 | -4.3 | 81% (252) | 12.9 |
| minas_san_francisco | 14 d | climatology | 264 | 27.6 | 6.7 | 75% (252) | 10.2 |
| minas_san_francisco | 14 d | analogue | 264 | 26.5 | -4.0 | 81% (252) | 10.4 |
| minas_san_francisco | 14 d | ensemble | 264 | 22.7 | 1.4 | 80% (252) | 8.5 |
| delsitanisagua | 7 d | persistence | 271 | 16.7 | 0.3 | 75% (259) | 6.5 |
| delsitanisagua | 7 d | climatology | 271 | 15.8 | -2.2 | 78% (259) | 5.3 |
| delsitanisagua | 7 d | analogue | 271 | 15.1 | 0.1 | 76% (259) | 5.7 |
| delsitanisagua | 7 d | ensemble | 271 | 13.2 | -1.0 | 77% (259) | 4.8 |
| delsitanisagua | 14 d | persistence | 270 | 16.1 | 0.3 | 74% (258) | 6.0 |
| delsitanisagua | 14 d | climatology | 270 | 14.1 | -2.8 | 78% (258) | 4.7 |
| delsitanisagua | 14 d | analogue | 270 | 14.1 | -0.2 | 78% (258) | 5.2 |
| delsitanisagua | 14 d | ensemble | 270 | 11.9 | -1.5 | 79% (258) | 4.3 |

## Amaluza's level: not forecast, and why

Amaluza is the one other reservoir where a level forecast could mean something, as the cascade below Mazar. The shipped water balance was run on it once (2026-09-23, 105 monthly origins, Amaluza's level and inflow with Molino's production as the release): it lost to persistence by 220% at 7 days (MAE 5.55 m against 1.73 m) and by 119% at 90 days (8.56 m against 3.90 m). Amaluza holds a few hours of Molino's turbine flow and is silted; its level moves with the day's dispatch, not with the season, and a rule curve fitted over years has nothing to hold on to. A real cascade model would route Mazar's simulated release and the inter-dam inflow through a daily dispatch rule for Molino, which this data does not constrain. What is published for Amaluza is its inflow, above, where the ensemble earns it.
