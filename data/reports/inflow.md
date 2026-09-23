# Inflow forecasts — the plants whose level is not the question

Generated 2026-09-23T19:53:27Z by `npm run forecast` from the committed tables; no network. For the run-of-river and daily-storage plants the level is an operating decision taken within the day, so the target is the water arriving: the mean inflow over the next 7 and 14 days, in m³/s. Origins every 7 days from 2018-01-01, once a plant has 730 days of inflow; each rung sees only data up to its origin.

- **persistence** holds the origin day's inflow.
- **climatology** is the median of the same calendar window's mean over every earlier year.
- **analogue** takes each earlier year's window mean scaled by today's 7-day flow over that year's (clamped to 0.33–3), and, where the plant's catchment centroid has adequate ERA5, first keeps the 50% of years whose 16 days of rain before the origin were nearest today's.

A plant's forecast is published at a horizon only where the analogue rung's MAE beats *both* persistence and climatology over the same origins. Its band is the analogue median widened by its own out-of-sample residual quantiles, as every forecast here is.

## Verdict

| plant | origins | horizon | analogue MAE | persistence | climatology | analogue coverage p10–p90 | published |
|---|---:|---:|---:|---:|---:|---:|---|
| Amaluza | 455 | 7 d | 42.8 | 51.2 | 47.9 | 84% | **yes** |
| Amaluza | 455 | 14 d | 42.8 | 52.7 | 42.4 | 83% | no — analogue MAE 42.8 m3/s does not beat climatology (42.4) |
| Coca Codo Sinclair | 343 | 7 d | 99.3 | 119.5 | 95.6 | 82% | no — analogue MAE 99.3 m3/s does not beat climatology (95.6) |
| Coca Codo Sinclair | 343 | 14 d | 95.3 | 121.6 | 82.2 | 79% | no — analogue MAE 95.3 m3/s does not beat climatology (82.2) |
| Agoyán | 356 | 7 d | 40.5 | 41.9 | 40.9 | 81% | **yes** |
| Agoyán | 356 | 14 d | 40.0 | 43.7 | 37.9 | 81% | no — analogue MAE 40.0 m3/s does not beat climatology (37.9) |
| Manduriacu | 260 | 7 d | 49.3 | 44.0 | 57.0 | 83% | no — analogue MAE 49.3 m3/s does not beat persistence (44.0) |
| Manduriacu | 260 | 14 d | 49.9 | 48.8 | 52.9 | 81% | no — analogue MAE 49.9 m3/s does not beat persistence (48.8) |
| Minas San Francisco | 256 | 7 d | 25.1 | 28.7 | 30.2 | 80% | **yes** |
| Minas San Francisco | 256 | 14 d | 24.2 | 31.6 | 28.3 | 79% | **yes** |
| Delsitanisagua | 262 | 7 d | 14.9 | 17.1 | 16.2 | 73% | **yes** |
| Delsitanisagua | 262 | 14 d | 13.5 | 16.4 | 14.4 | 77% | **yes** |

Published: amaluza 7 d, agoyan 7 d, minas_san_francisco 7 d, minas_san_francisco 14 d, delsitanisagua 7 d, delsitanisagua 14 d. Recorded negatives: amaluza 14 d, coca_codo_sinclair 7 d, coca_codo_sinclair 14 d, agoyan 14 d, manduriacu 7 d, manduriacu 14 d. Where climatology wins at 14 days the rivers are forgetting today's flow within a fortnight, and the honest forecast is the calendar; where persistence wins the flow is regulated upstream enough that today's number is the best guess for next week. Neither is published as an inflow forecast, because neither is a forecast this repository made.

## Rain conditioning

- Amaluza: `paute_mazar` — not conditioned (paute_mazar: no ERA5 rows).
- Coca Codo Sinclair: `coca_ccs` — not conditioned (coca_ccs: no ERA5 rows).
- Agoyán: `pastaza_agoyan` — not conditioned (pastaza_agoyan: no ERA5 rows).
- Manduriacu: `guayllabamba_manduriacu` — not conditioned (guayllabamba_manduriacu: no ERA5 rows).
- Minas San Francisco: `jubones_msf` — not conditioned (jubones_msf: no ERA5 rows).
- Delsitanisagua: `zamora_delsitanisagua` — not conditioned (zamora_delsitanisagua: no ERA5 rows).

The conditioner is the rain that had already fallen, read with ERA5's five-day latency, because that is what a forecaster has and what can be backtested. Conditioning on the 16-day *forecast* would need Open-Meteo's previous-runs archive, which is not ingested; §5.4's perfect-foresight experiment on Mazar says whether it is worth ingesting.

## Every rung, every plant

| plant | horizon | rung | n | MAE m³/s | bias | coverage p10–p90 (n) | pinball |
|---|---:|---|---:|---:|---:|---:|---:|
| amaluza | 7 d | persistence | 455 | 51.2 | -3.6 | 80% (443) | 18.2 |
| amaluza | 7 d | climatology | 455 | 47.9 | -7.7 | 83% (443) | 15.9 |
| amaluza | 7 d | analogue | 455 | 42.8 | -0.2 | 84% (443) | 15.1 |
| amaluza | 14 d | persistence | 454 | 52.7 | -3.6 | 82% (442) | 18.5 |
| amaluza | 14 d | climatology | 454 | 42.4 | -9.3 | 83% (442) | 13.8 |
| amaluza | 14 d | analogue | 454 | 42.8 | -2.5 | 83% (442) | 15.3 |
| coca_codo_sinclair | 7 d | persistence | 343 | 119.5 | -7.5 | 81% (331) | 44.2 |
| coca_codo_sinclair | 7 d | climatology | 343 | 95.6 | 31.1 | 78% (331) | 30.4 |
| coca_codo_sinclair | 7 d | analogue | 343 | 99.3 | 3.5 | 82% (331) | 32.8 |
| coca_codo_sinclair | 14 d | persistence | 329 | 121.6 | -7.0 | 78% (317) | 44.5 |
| coca_codo_sinclair | 14 d | climatology | 329 | 82.2 | 23.6 | 76% (317) | 25.5 |
| coca_codo_sinclair | 14 d | analogue | 329 | 95.3 | -3.3 | 79% (317) | 32.3 |
| agoyan | 7 d | persistence | 356 | 41.9 | -1.3 | 83% (344) | 15.9 |
| agoyan | 7 d | climatology | 356 | 40.9 | 4.6 | 75% (344) | 13.9 |
| agoyan | 7 d | analogue | 356 | 40.5 | 1.2 | 81% (344) | 14.3 |
| agoyan | 14 d | persistence | 346 | 43.7 | -2.0 | 80% (334) | 16.6 |
| agoyan | 14 d | climatology | 346 | 37.9 | 1.3 | 74% (334) | 12.3 |
| agoyan | 14 d | analogue | 346 | 40.0 | -2.5 | 81% (334) | 14.5 |
| manduriacu | 7 d | persistence | 260 | 44.0 | -4.3 | 78% (248) | 16.4 |
| manduriacu | 7 d | climatology | 260 | 57.0 | 24.5 | 76% (248) | 19.8 |
| manduriacu | 7 d | analogue | 260 | 49.3 | -1.3 | 83% (248) | 16.8 |
| manduriacu | 14 d | persistence | 239 | 48.8 | -4.3 | 77% (227) | 18.5 |
| manduriacu | 14 d | climatology | 239 | 52.9 | 20.6 | 77% (227) | 18.5 |
| manduriacu | 14 d | analogue | 239 | 49.9 | -3.4 | 81% (227) | 17.4 |
| minas_san_francisco | 7 d | persistence | 256 | 28.7 | -4.5 | 79% (244) | 12.2 |
| minas_san_francisco | 7 d | climatology | 256 | 30.2 | 8.7 | 75% (244) | 11.4 |
| minas_san_francisco | 7 d | analogue | 256 | 25.1 | 3.7 | 80% (244) | 9.7 |
| minas_san_francisco | 14 d | persistence | 255 | 31.6 | -4.5 | 81% (243) | 13.2 |
| minas_san_francisco | 14 d | climatology | 255 | 28.3 | 6.8 | 74% (243) | 10.4 |
| minas_san_francisco | 14 d | analogue | 255 | 24.2 | -0.4 | 79% (243) | 9.4 |
| delsitanisagua | 7 d | persistence | 262 | 17.1 | 0.5 | 75% (250) | 6.6 |
| delsitanisagua | 7 d | climatology | 262 | 16.2 | -2.1 | 77% (250) | 5.4 |
| delsitanisagua | 7 d | analogue | 262 | 14.9 | 0.6 | 73% (250) | 5.6 |
| delsitanisagua | 14 d | persistence | 261 | 16.4 | 0.5 | 74% (249) | 6.1 |
| delsitanisagua | 14 d | climatology | 261 | 14.4 | -2.7 | 77% (249) | 4.8 |
| delsitanisagua | 14 d | analogue | 261 | 13.5 | -0.1 | 77% (249) | 5.0 |

## Amaluza's level: not forecast, and why

Amaluza is the one other reservoir where a level forecast could mean something, as the cascade below Mazar. The shipped water balance was run on it once (2026-09-23, 105 monthly origins, Amaluza's level and inflow with Molino's production as the release): it lost to persistence by 220% at 7 days (MAE 5.55 m against 1.73 m) and by 119% at 90 days (8.56 m against 3.90 m). Amaluza holds a few hours of Molino's turbine flow and is silted; its level moves with the day's dispatch, not with the season, and a rule curve fitted over years has nothing to hold on to. A real cascade model would route Mazar's simulated release and the inter-dam inflow through a daily dispatch rule for Molino, which this data does not constrain. What is published for Amaluza is its inflow, above, where the analogue earns it.
