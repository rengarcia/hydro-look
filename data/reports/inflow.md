# Inflow forecasts — the plants whose level is not the question

Generated 2026-09-30T21:04:33Z by `npm run forecast` from the committed tables; no network. For the run-of-river and daily-storage plants the level is an operating decision taken within the day, so the target is the water arriving: the mean inflow over the next 7 and 14 days, in m³/s. Origins every 7 days from 2018-01-01, once a plant has 730 days of inflow; each rung sees only data up to its origin.

- **persistence** holds the origin day's inflow.
- **climatology** is the median of the same calendar window's mean over every earlier year.
- **analogue** takes each earlier year's window mean scaled by today's 7-day flow over that year's (clamped to 0.33–3), and, where the plant's catchment centroid has adequate ERA5, first keeps the 50% of years whose 16 days of rain before the origin were nearest today's.
- **ensemble**, the published rung since 2026-09-25, is the mean of the analogue and climatology rungs — and of a short-range river forecast's anomaly where one is supplied. The two rungs err in different directions, and their average beat the analogue alone at every plant and both horizons (`data/reports/geoglows-experiment.md`). A river forecast was a member in amaluza 0%, coca_codo_sinclair 0%, agoyan 17%, manduriacu 22%, minas_san_francisco 23%, delsitanisagua 0% of the scored cases.

A plant's forecast is published at a horizon only where the ensemble's MAE beats *both* persistence and climatology over the same origins. Its band is the ensemble median widened by its own out-of-sample residual quantiles, as every forecast here is.

## Verdict

| plant | origins | horizon | ensemble MAE | analogue | persistence | climatology | ensemble coverage p10–p90 | published |
|---|---:|---:|---:|---:|---:|---:|---:|---|
| Amaluza | 456 | 7 d | 39.5 | 43.8 | 51.1 | 47.9 | 84% | **yes** |
| Amaluza | 456 | 14 d | 37.0 | 44.1 | 52.7 | 42.4 | 84% | **yes** |
| Coca Codo Sinclair | 344 | 7 d | 86.8 | 103.8 | 119.2 | 95.4 | 78% | **yes** |
| Coca Codo Sinclair | 344 | 14 d | 78.7 | 101.8 | 121.8 | 81.9 | 77% | **yes** |
| Agoyán | 357 | 7 d | 34.0 | 40.6 | 41.8 | 40.8 | 82% | **yes** |
| Agoyán | 357 | 14 d | 33.1 | 41.7 | 43.6 | 37.8 | 79% | **yes** |
| Manduriacu | 261 | 7 d | 42.3 | 50.8 | 43.9 | 56.9 | 83% | **yes** |
| Manduriacu | 261 | 14 d | 41.3 | 49.5 | 48.7 | 52.7 | 81% | **yes** |
| Minas San Francisco | 257 | 7 d | 24.0 | 27.5 | 28.7 | 30.2 | 78% | **yes** |
| Minas San Francisco | 257 | 14 d | 23.1 | 27.0 | 31.5 | 28.2 | 80% | **yes** |
| Delsitanisagua | 263 | 7 d | 13.5 | 15.4 | 17.1 | 16.1 | 76% | **yes** |
| Delsitanisagua | 263 | 14 d | 12.1 | 14.4 | 16.3 | 14.4 | 78% | **yes** |

Published: amaluza 7 d, amaluza 14 d, coca_codo_sinclair 7 d, coca_codo_sinclair 14 d, agoyan 7 d, agoyan 14 d, manduriacu 7 d, manduriacu 14 d, minas_san_francisco 7 d, minas_san_francisco 14 d, delsitanisagua 7 d, delsitanisagua 14 d. Recorded negatives: none. Where climatology wins at 14 days the rivers are forgetting today's flow within a fortnight, and the honest forecast is the calendar; where persistence wins the flow is regulated upstream enough that today's number is the best guess for next week. Neither is published as an inflow forecast, because neither is a forecast this repository made.

## GEOGLOWS' forecast as a member

At the plants where GEOGLOWS' forecast earned a place (Agoyán, Manduriacu, Minas San Francisco; `src/lib/features/geoglows.ts`), it is the ensemble's third member on every origin whose next day's issue is stored (from 2024-07-01) and whose horizon it reaches (ten days). On those cases the ensemble with and without it:

| plant | horizon | cases | MAE with | MAE without |
|---|---:|---:|---:|---:|
| agoyan | 7 d | 117 | 32.4 | 35.4 |
| manduriacu | 7 d | 111 | 34.4 | 40.3 |
| minas_san_francisco | 7 d | 116 | 24.9 | 26.0 |

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
| amaluza | 7 d | persistence | 456 | 51.1 | -3.6 | 80% (444) | 18.1 |
| amaluza | 7 d | climatology | 456 | 47.9 | -7.6 | 83% (444) | 15.9 |
| amaluza | 7 d | analogue | 456 | 43.8 | -3.0 | 84% (444) | 15.4 |
| amaluza | 7 d | ensemble | 456 | 39.5 | -5.3 | 84% (444) | 13.4 |
| amaluza | 14 d | persistence | 455 | 52.7 | -3.6 | 82% (443) | 18.5 |
| amaluza | 14 d | climatology | 455 | 42.4 | -9.2 | 83% (443) | 13.7 |
| amaluza | 14 d | analogue | 455 | 44.1 | -5.0 | 81% (443) | 15.7 |
| amaluza | 14 d | ensemble | 455 | 37.0 | -7.1 | 84% (443) | 12.4 |
| coca_codo_sinclair | 7 d | persistence | 344 | 119.2 | -7.4 | 81% (332) | 44.1 |
| coca_codo_sinclair | 7 d | climatology | 344 | 95.4 | 31.1 | 78% (332) | 30.4 |
| coca_codo_sinclair | 7 d | analogue | 344 | 103.8 | -0.1 | 82% (332) | 34.8 |
| coca_codo_sinclair | 7 d | ensemble | 344 | 86.8 | 15.5 | 78% (332) | 28.2 |
| coca_codo_sinclair | 14 d | persistence | 330 | 121.8 | -7.6 | 78% (318) | 44.5 |
| coca_codo_sinclair | 14 d | climatology | 330 | 81.9 | 23.6 | 76% (318) | 25.5 |
| coca_codo_sinclair | 14 d | analogue | 330 | 101.8 | -5.8 | 78% (318) | 34.7 |
| coca_codo_sinclair | 14 d | ensemble | 330 | 78.7 | 8.9 | 77% (318) | 25.7 |
| agoyan | 7 d | persistence | 357 | 41.8 | -1.3 | 83% (345) | 15.9 |
| agoyan | 7 d | climatology | 357 | 40.8 | 4.6 | 75% (345) | 13.8 |
| agoyan | 7 d | analogue | 357 | 40.6 | 0.5 | 82% (345) | 14.2 |
| agoyan | 7 d | ensemble | 357 | 34.0 | 4.5 | 82% (345) | 11.7 |
| agoyan | 14 d | persistence | 347 | 43.6 | -2.1 | 80% (335) | 16.6 |
| agoyan | 14 d | climatology | 347 | 37.8 | 1.3 | 74% (335) | 12.3 |
| agoyan | 14 d | analogue | 347 | 41.7 | -4.0 | 80% (335) | 14.9 |
| agoyan | 14 d | ensemble | 347 | 33.1 | -1.3 | 79% (335) | 11.4 |
| manduriacu | 7 d | persistence | 261 | 43.9 | -4.2 | 78% (249) | 16.4 |
| manduriacu | 7 d | climatology | 261 | 56.9 | 24.4 | 76% (249) | 19.7 |
| manduriacu | 7 d | analogue | 261 | 50.8 | 0.4 | 83% (249) | 17.5 |
| manduriacu | 7 d | ensemble | 261 | 42.3 | 16.5 | 83% (249) | 14.6 |
| manduriacu | 14 d | persistence | 240 | 48.7 | -4.2 | 77% (228) | 18.5 |
| manduriacu | 14 d | climatology | 240 | 52.7 | 20.5 | 77% (228) | 18.4 |
| manduriacu | 14 d | analogue | 240 | 49.5 | -1.5 | 84% (228) | 17.3 |
| manduriacu | 14 d | ensemble | 240 | 41.3 | 9.5 | 81% (228) | 14.2 |
| minas_san_francisco | 7 d | persistence | 257 | 28.7 | -4.4 | 79% (245) | 12.2 |
| minas_san_francisco | 7 d | climatology | 257 | 30.2 | 8.7 | 76% (245) | 11.4 |
| minas_san_francisco | 7 d | analogue | 257 | 27.5 | 0.2 | 80% (245) | 10.6 |
| minas_san_francisco | 7 d | ensemble | 257 | 24.0 | 6.8 | 78% (245) | 9.3 |
| minas_san_francisco | 14 d | persistence | 256 | 31.5 | -4.5 | 81% (244) | 13.2 |
| minas_san_francisco | 14 d | climatology | 256 | 28.2 | 6.8 | 75% (244) | 10.4 |
| minas_san_francisco | 14 d | analogue | 256 | 27.0 | -4.2 | 80% (244) | 10.6 |
| minas_san_francisco | 14 d | ensemble | 256 | 23.1 | 1.3 | 80% (244) | 8.6 |
| delsitanisagua | 7 d | persistence | 263 | 17.1 | 0.4 | 75% (251) | 6.6 |
| delsitanisagua | 7 d | climatology | 263 | 16.1 | -2.1 | 77% (251) | 5.4 |
| delsitanisagua | 7 d | analogue | 263 | 15.4 | 0.2 | 75% (251) | 5.8 |
| delsitanisagua | 7 d | ensemble | 263 | 13.5 | -0.9 | 76% (251) | 4.9 |
| delsitanisagua | 14 d | persistence | 262 | 16.3 | 0.5 | 74% (250) | 6.1 |
| delsitanisagua | 14 d | climatology | 262 | 14.4 | -2.7 | 77% (250) | 4.7 |
| delsitanisagua | 14 d | analogue | 262 | 14.4 | -0.1 | 77% (250) | 5.3 |
| delsitanisagua | 14 d | ensemble | 262 | 12.1 | -1.4 | 78% (250) | 4.4 |

## Amaluza's level: not forecast, and why

Amaluza is the one other reservoir where a level forecast could mean something, as the cascade below Mazar. The shipped water balance was run on it once (2026-09-23, 105 monthly origins, Amaluza's level and inflow with Molino's production as the release): it lost to persistence by 220% at 7 days (MAE 5.55 m against 1.73 m) and by 119% at 90 days (8.56 m against 3.90 m). Amaluza holds a few hours of Molino's turbine flow and is silted; its level moves with the day's dispatch, not with the season, and a rule curve fitted over years has nothing to hold on to. A real cascade model would route Mazar's simulated release and the inter-dam inflow through a daily dispatch rule for Molino, which this data does not constrain. What is published for Amaluza is its inflow, above, where the ensemble earns it.
