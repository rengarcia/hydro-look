# Phase 0 reconnaissance report

Generated 2026-09-21T23:39:51+00:00 (UTC) · 2026-09-21T18:39:51-05:00 (Ecuador) · started 2026-09-21T23:37:29+00:00 · 99 requests.

Raw responses: `tests/fixtures/` (gzipped when large). Structured findings: `tests/fixtures/recon/findings.json`. Full log: `tests/fixtures/recon/capture_log.json`.

## 1. Every request

| key | status | bytes | s | saved | error |
|---|---|---|---|---|---|
| robots:generacioncsr.celec.gob.ec:8443 | 404 | 0 |  | robots/generacioncsr.celec.gob.ec_8443.txt |  |
| ords:mesh24:30031:2026-09 | 200 | 2093 | 0.2 | tests/fixtures/celec_ords/mesh24_30031_2026-09.json |  |
| ords:mesh24:30031:2026-08 | 200 | 2150 | 0.22 | tests/fixtures/celec_ords/mesh24_30031_2026-08.json |  |
| ords:mesh24:30538:2026-09 | 200 | 2093 | 0.2 | tests/fixtures/celec_ords/mesh24_30538_2026-09.json |  |
| ords:mesh24:30538:2026-08 | 200 | 2150 | 0.2 | tests/fixtures/celec_ords/mesh24_30538_2026-08.json |  |
| ords:mesh24:24019:2026-09 | 200 | 2093 | 0.21 | tests/fixtures/celec_ords/mesh24_24019_2026-09.json |  |
| ords:mesh24:24019:2026-08 | 200 | 2150 | 0.2 | tests/fixtures/celec_ords/mesh24_24019_2026-08.json |  |
| ords:mesh24:24811:2026-09 | 200 | 2093 | 0.2 | tests/fixtures/celec_ords/mesh24_24811_2026-09.json |  |
| ords:mesh24:24811:2026-08 | 200 | 2150 | 0.21 | tests/fixtures/celec_ords/mesh24_24811_2026-08.json |  |
| ords:mesh24:90919:2026-09 | 200 | 2093 | 0.21 | tests/fixtures/celec_ords/mesh24_90919_2026-09.json |  |
| ords:mesh24:90919:2026-08 | 200 | 2150 | 0.2 | tests/fixtures/celec_ords/mesh24_90919_2026-08.json |  |
| ords:mesh24:90537:2026-09 | 200 | 2093 | 0.21 | tests/fixtures/celec_ords/mesh24_90537_2026-09.json |  |
| ords:mesh24:90537:2026-08 | 200 | 2150 | 0.21 | tests/fixtures/celec_ords/mesh24_90537_2026-08.json |  |
| ords:hourly:30031:2026-09-20 | 200 | 1745 | 0.2 | tests/fixtures/celec_ords/pointvalues_30031_2026-09-20.json |  |
| ords:hourly:30538:2026-09-20 | 200 | 1745 | 0.2 | tests/fixtures/celec_ords/pointvalues_30538_2026-09-20.json |  |
| ords:earliest:30031:2015-01 | 200 | 2150 | 0.2 | tests/fixtures/celec_ords/mesh24_30031_2015-01.json |  |
| ords:earliest:30031:2016-01 | 200 | 2150 | 0.2 | tests/fixtures/celec_ords/mesh24_30031_2016-01.json |  |
| ords:earliest:30031:2017-01 | 200 | 2150 | 0.21 | tests/fixtures/celec_ords/mesh24_30031_2017-01.json |  |
| ords:earliest:30031:2018-01 | 200 | 2150 | 0.21 | tests/fixtures/celec_ords/mesh24_30031_2018-01.json |  |
| ords:earliest:30031:2019-01 | 200 | 2150 | 0.2 | tests/fixtures/celec_ords/mesh24_30031_2019-01.json |  |
| ords:earliest:30031:2020-01 | 200 | 2150 | 0.19 | tests/fixtures/celec_ords/mesh24_30031_2020-01.json |  |
| ords:earliest:30031:2021-01 | 200 | 2150 | 0.2 | tests/fixtures/celec_ords/mesh24_30031_2021-01.json |  |
| ords:earliest:30031:2022-01 | 200 | 2150 | 0.2 | tests/fixtures/celec_ords/mesh24_30031_2022-01.json |  |
| ords:earliest:30538:2022-01 | 200 | 2150 | 0.21 | tests/fixtures/celec_ords/mesh24_30538_2022-01.json |  |
| ords:earliest:24019:2022-01 | 200 | 2150 | 0.2 | tests/fixtures/celec_ords/mesh24_24019_2022-01.json |  |
| ords:earliest:24811:2022-01 | 200 | 2150 | 0.21 | tests/fixtures/celec_ords/mesh24_24811_2022-01.json |  |
| ords:earliest:90919:2022-01 | 200 | 2150 | 0.19 | tests/fixtures/celec_ords/mesh24_90919_2022-01.json |  |
| ords:earliest:90537:2022-01 | 200 | 2150 | 0.2 | tests/fixtures/celec_ords/mesh24_90537_2022-01.json |  |
| ords:ords_root | 200 | 21384 | 2.99 | tests/fixtures/celec_ords/ords_root.txt |  |
| ords:csr_root | 404 | 16178 | 0.34 | tests/fixtures/celec_ords/csr_root.txt |  |
| ords:metadata_catalog | 401 | 16416 | 0.21 | tests/fixtures/celec_ords/metadata_catalog.txt |  |
| ords:metadata_catalog_module | 401 | 16434 | 0.17 | tests/fixtures/celec_ords/metadata_catalog_module.txt |  |
| ords:module_root | 404 | 16178 | 0.24 | tests/fixtures/celec_ords/module_root.txt |  |
| ords:mesh24_no_params | 200 | 282 | 0.21 | tests/fixtures/celec_ords/mesh24_no_params.txt |  |
| ords:open_api | 200 | 18582 | 3.08 | tests/fixtures/celec_ords/open_api.txt |  |
| robots:generacioncsr.celec.gob.ec | 404 | 0 |  | robots/generacioncsr.celec.gob.ec.txt |  |
| web:celec_wide:index | 200 | 910 | 0.14 | tests/fixtures/celec_web/celec_wide_index.html |  |
| web:celec_wide:runtime-es2015.17457c14264390561f33.js | 200 | 1485 | 0.13 | tests/fixtures/celec_web/celec_wide/runtime-es2015.17457c14264390561f33.js |  |
| web:celec_wide:runtime-es5.17457c14264390561f33.js | 200 | 1485 | 0.14 | tests/fixtures/celec_web/celec_wide/runtime-es5.17457c14264390561f33.js |  |
| web:celec_wide:polyfills-es5.1460e12205482c371a4c.js | 200 | 132965 | 0.53 | tests/fixtures/celec_web/celec_wide/polyfills-es5.1460e12205482c371a4c.js |  |
| web:celec_wide:polyfills-es2015.c8d9fd53a40f4ff61e6e.js | 200 | 37670 | 0.13 | tests/fixtures/celec_web/celec_wide/polyfills-es2015.c8d9fd53a40f4ff61e6e.js |  |
| web:celec_wide:scripts.d5cb97c61d24c303c034.js | 200 | 341089 | 0.4 | tests/fixtures/celec_web/celec_wide/scripts.d5cb97c61d24c303c034.js.gz |  |
| web:celec_wide:main-es2015.bb8d1c1f9fb35745e7e5.js | 200 | 1042099 | 0.54 | tests/fixtures/celec_web/celec_wide/main-es2015.bb8d1c1f9fb35745e7e5.js.gz |  |
| web:celec_wide:main-es5.bb8d1c1f9fb35745e7e5.js | 200 | 1114294 | 0.4 | tests/fixtures/celec_web/celec_wide/main-es5.bb8d1c1f9fb35745e7e5.js.gz |  |
| web:celec_sur:index | 200 | 922 | 0.13 | tests/fixtures/celec_web/celec_sur_index.html |  |
| web:celec_sur:runtime-es2015.1eba213af0b233498d9d.js | 200 | 1485 | 0.13 | tests/fixtures/celec_web/celec_sur/runtime-es2015.1eba213af0b233498d9d.js |  |
| web:celec_sur:runtime-es5.1eba213af0b233498d9d.js | 200 | 1485 | 0.14 | tests/fixtures/celec_web/celec_sur/runtime-es5.1eba213af0b233498d9d.js |  |
| web:celec_sur:polyfills-es5.84963675a8c97dd2bc1e.js | 200 | 132965 | 0.15 | tests/fixtures/celec_web/celec_sur/polyfills-es5.84963675a8c97dd2bc1e.js |  |
| web:celec_sur:polyfills-es2015.e4277e903aed07751db3.js | 200 | 37670 | 0.13 | tests/fixtures/celec_web/celec_sur/polyfills-es2015.e4277e903aed07751db3.js |  |
| web:celec_sur:scripts.d5cb97c61d24c303c034.js | 200 | 341089 | 0.14 | tests/fixtures/celec_web/celec_sur/scripts.d5cb97c61d24c303c034.js.gz |  |
| web:celec_sur:main-es2015.3f8644f615fd6faf6b00.js | 200 | 990065 | 0.14 | tests/fixtures/celec_web/celec_sur/main-es2015.3f8644f615fd6faf6b00.js.gz |  |
| web:celec_sur:main-es5.3f8644f615fd6faf6b00.js | 200 | 1057250 | 0.15 | tests/fixtures/celec_web/celec_sur/main-es5.3f8644f615fd6faf6b00.js.gz |  |
| robots:smec.cenace.gob.ec | 404 | 0 |  | robots/smec.cenace.gob.ec.txt |  |
| smec:informe1:2026-09-20 | 200 | 39354 | 0.64 | tests/fixtures/cenace_smec/informe1_2026-09-20.html |  |
| smec:informe1:2026-09-19 | 200 | 39356 | 0.27 | tests/fixtures/cenace_smec/informe1_2026-09-19.html |  |
| smec:informe1:2024-10-15 | 200 | 39365 | 0.26 | tests/fixtures/cenace_smec/informe1_2024-10-15.html |  |
| smec:informe1:2023-11-05 | 200 | 39378 | 0.26 | tests/fixtures/cenace_smec/informe1_2023-11-05.html |  |
| smec:informe1:2022-01-15 | 200 | 39345 | 0.26 | tests/fixtures/cenace_smec/informe1_2022-01-15.html |  |
| smec:informe1:2021-06-15 | 200 | 39348 | 0.26 | tests/fixtures/cenace_smec/informe1_2021-06-15.html |  |
| smec:informe1:2019-01-15 | 200 | 41404 | 0.26 | tests/fixtures/cenace_smec/informe1_2019-01-15.html |  |
| smec:informe2 | 200 | 22854 | 0.25 | tests/fixtures/cenace_smec/informe2_2026-09-20.html |  |
| smec:informe3 | 200 | 420 | 0.13 | tests/fixtures/cenace_smec/informe3_2026-09-20.html |  |
| smec:informe4 | 400 | 1130 | 0.13 | tests/fixtures/cenace_smec/informe4_2026-09-20.html |  |
| smec:informe5 | 400 | 1130 | 0.65 | tests/fixtures/cenace_smec/informe5_2026-09-20.html |  |
| smec:informe6 | 400 | 1130 | 0.8 | tests/fixtures/cenace_smec/informe6_2026-09-20.html |  |
| smec:informe7 | 400 | 1130 | 0.64 | tests/fixtures/cenace_smec/informe7_2026-09-20.html |  |
| smec:informe8 | 400 | 1130 | 0.51 | tests/fixtures/cenace_smec/informe8_2026-09-20.html |  |
| smec:informe9 | 400 | 1130 | 0.52 | tests/fixtures/cenace_smec/informe9_2026-09-20.html |  |
| smec:informe10 | 400 | 1133 | 0.82 | tests/fixtures/cenace_smec/informe10_2026-09-20.html |  |
| smec:informe11 | 400 | 1133 | 0.84 | tests/fixtures/cenace_smec/informe11_2026-09-20.html |  |
| smec:informe12 | 400 | 1133 | 0.51 | tests/fixtures/cenace_smec/informe12_2026-09-20.html |  |
| smec:smec_root | 200 | 103 | 0.63 | tests/fixtures/cenace_smec/smec_root.html |  |
| smec:host_root | 200 | 103 | 0.38 | tests/fixtures/cenace_smec/host_root.html |  |
| smec:index_jsp | 200 | 103 | 0.13 | tests/fixtures/cenace_smec/index_jsp.html |  |
| smec:menu_do | 400 | 1091 | 0.13 | tests/fixtures/cenace_smec/menu_do.html |  |
| robots:www.cenace.gob.ec | error: SSLError | 0 |  | robots/www.cenace.gob.ec.txt |  |
| operativa:page |  | 0 | 0.41 |  | SSLError: HTTPSConnectionPool(host='www.cenace.gob.ec', port=443): Max retries exceeded with url: /info-operativa/InformacionOperativa.htm (Caused by SSLError(SSLCertVerificationError(1, '[SSL: CERTIFICATE_VERIFY_FAILED] certificate verify failed: unable to get local issuer certificate (_ssl.c:1010) |
| robots:archive-api.open-meteo.com | 200 | 25 |  | robots/archive-api.open-meteo.com.txt |  |
| open_meteo:archive |  | 0 |  |  | skipped: disallowed by robots.txt |
| robots:api.open-meteo.com | 200 | 25 |  | robots/api.open-meteo.com.txt |  |
| open_meteo:forecast |  | 0 |  |  | skipped: disallowed by robots.txt |
| robots:seasonal-api.open-meteo.com | 200 | 25 |  | robots/seasonal-api.open-meteo.com.txt |  |
| open_meteo:seasonal |  | 0 |  |  | skipped: disallowed by robots.txt |
| robots:psl.noaa.gov | 404 | 0 |  | robots/psl.noaa.gov.txt |  |
| noaa:oni_psl | 200 | 7203 | 0.03 | tests/fixtures/noaa/oni_psl.txt |  |
| robots:www.cpc.ncep.noaa.gov | 404 | 0 |  | robots/www.cpc.ncep.noaa.gov.txt |  |
| noaa:oni_cpc | 200 | 23000 | 0.07 | tests/fixtures/noaa/oni_cpc.txt |  |
| robots:raw.githubusercontent.com | 404 | 0 |  | robots/raw.githubusercontent.com.txt |  |
| mirror:jordanvt18_estado | 200 | 1651 | 0.1 | tests/fixtures/mirrors/jordanvt18_estado.json |  |
| mirror:tefaceli_historico | 200 | 9867 | 0.09 | tests/fixtures/mirrors/tefaceli_historico.json |  |
| mirror:tefaceli_en_vivo | 200 | 81 | 0.12 | tests/fixtures/mirrors/tefaceli_en_vivo.json |  |
| robots:www.datosabiertos.gob.ec | 403 | 0 |  | robots/www.datosabiertos.gob.ec.txt |  |
| opendata:ckan_cenace | 403 | 239 | 0.13 | tests/fixtures/open_data/ckan_cenace.json |  |
| opendata:ckan_bnee | 403 | 239 | 0.13 | tests/fixtures/open_data/ckan_bnee.json |  |
| opendata:cenace_dataset_page | 403 | 239 | 0.13 | tests/fixtures/open_data/cenace_dataset_page.html |  |
| robots:www.controlrecursosyenergia.gob.ec | error: SSLError | 0 |  | robots/www.controlrecursosyenergia.gob.ec.txt |  |
| opendata:arconel_bnee_1 |  | 0 | 0.44 |  | SSLError: HTTPSConnectionPool(host='www.controlrecursosyenergia.gob.ec', port=443): Max retries exceeded with url: /balance-nacional-de-energia-electrica/ (Caused by SSLError(SSLCertVerificationError(1, "[SSL: CERTIFICATE_VERIFY_FAILED] certificate verify failed: Hostname mismatch, certificate is no |
| robots:arconel.gob.ec | 200 | 164 |  | robots/arconel.gob.ec.txt |  |
| opendata:arconel_bnee_2 | 200 | 68185 | 1.88 | tests/fixtures/open_data/arconel_bnee_2.html |  |

## 2. robots.txt verdicts

| url | allowed | detail |
|---|---|---|
| https://generacioncsr.celec.gob.ec:8443/ords/csr/sardomcsr/pointValuesMesH24 | True | no robots.txt |
| https://generacioncsr.celec.gob.ec:8443/ords/csr/sardomcsr/pointValuesMesH24 | True | no robots.txt |
| https://generacioncsr.celec.gob.ec:8443/ords/csr/sardomcsr/pointValuesMesH24 | True | no robots.txt |
| https://generacioncsr.celec.gob.ec:8443/ords/csr/sardomcsr/pointValuesMesH24 | True | no robots.txt |
| https://generacioncsr.celec.gob.ec:8443/ords/csr/sardomcsr/pointValuesMesH24 | True | no robots.txt |
| https://generacioncsr.celec.gob.ec:8443/ords/csr/sardomcsr/pointValuesMesH24 | True | no robots.txt |
| https://generacioncsr.celec.gob.ec:8443/ords/csr/sardomcsr/pointValuesMesH24 | True | no robots.txt |
| https://generacioncsr.celec.gob.ec:8443/ords/csr/sardomcsr/pointValuesMesH24 | True | no robots.txt |
| https://generacioncsr.celec.gob.ec:8443/ords/csr/sardomcsr/pointValuesMesH24 | True | no robots.txt |
| https://generacioncsr.celec.gob.ec:8443/ords/csr/sardomcsr/pointValuesMesH24 | True | no robots.txt |
| https://generacioncsr.celec.gob.ec:8443/ords/csr/sardomcsr/pointValuesMesH24 | True | no robots.txt |
| https://generacioncsr.celec.gob.ec:8443/ords/csr/sardomcsr/pointValuesMesH24 | True | no robots.txt |
| https://generacioncsr.celec.gob.ec:8443/ords/csr/sardomcsr/pointValues | True | no robots.txt |
| https://generacioncsr.celec.gob.ec:8443/ords/csr/sardomcsr/pointValues | True | no robots.txt |
| https://generacioncsr.celec.gob.ec:8443/ords/csr/sardomcsr/pointValuesMesH24 | True | no robots.txt |
| https://generacioncsr.celec.gob.ec:8443/ords/csr/sardomcsr/pointValuesMesH24 | True | no robots.txt |
| https://generacioncsr.celec.gob.ec:8443/ords/csr/sardomcsr/pointValuesMesH24 | True | no robots.txt |
| https://generacioncsr.celec.gob.ec:8443/ords/csr/sardomcsr/pointValuesMesH24 | True | no robots.txt |
| https://generacioncsr.celec.gob.ec:8443/ords/csr/sardomcsr/pointValuesMesH24 | True | no robots.txt |
| https://generacioncsr.celec.gob.ec:8443/ords/csr/sardomcsr/pointValuesMesH24 | True | no robots.txt |
| https://generacioncsr.celec.gob.ec:8443/ords/csr/sardomcsr/pointValuesMesH24 | True | no robots.txt |
| https://generacioncsr.celec.gob.ec:8443/ords/csr/sardomcsr/pointValuesMesH24 | True | no robots.txt |
| https://generacioncsr.celec.gob.ec:8443/ords/csr/sardomcsr/pointValuesMesH24 | True | no robots.txt |
| https://generacioncsr.celec.gob.ec:8443/ords/csr/sardomcsr/pointValuesMesH24 | True | no robots.txt |
| https://generacioncsr.celec.gob.ec:8443/ords/csr/sardomcsr/pointValuesMesH24 | True | no robots.txt |
| https://generacioncsr.celec.gob.ec:8443/ords/csr/sardomcsr/pointValuesMesH24 | True | no robots.txt |
| https://generacioncsr.celec.gob.ec:8443/ords/csr/sardomcsr/pointValuesMesH24 | True | no robots.txt |
| https://generacioncsr.celec.gob.ec:8443/ords/ | True | no robots.txt |
| https://generacioncsr.celec.gob.ec:8443/ords/csr/ | True | no robots.txt |
| https://generacioncsr.celec.gob.ec:8443/ords/csr/metadata-catalog/ | True | no robots.txt |
| https://generacioncsr.celec.gob.ec:8443/ords/csr/metadata-catalog/sardomcsr/ | True | no robots.txt |
| https://generacioncsr.celec.gob.ec:8443/ords/csr/sardomcsr/ | True | no robots.txt |
| https://generacioncsr.celec.gob.ec:8443/ords/csr/sardomcsr/pointValuesMesH24 | True | no robots.txt |
| https://generacioncsr.celec.gob.ec:8443/ords/csr/open-api-catalog/sardomcsr/ | True | no robots.txt |
| https://generacioncsr.celec.gob.ec/graficasproduccionCELEC/ | True | no robots.txt |
| https://generacioncsr.celec.gob.ec/graficasproduccionCELEC/runtime-es2015.17457c14264390561f33.js | True | no robots.txt |
| https://generacioncsr.celec.gob.ec/graficasproduccionCELEC/runtime-es5.17457c14264390561f33.js | True | no robots.txt |
| https://generacioncsr.celec.gob.ec/graficasproduccionCELEC/polyfills-es5.1460e12205482c371a4c.js | True | no robots.txt |
| https://generacioncsr.celec.gob.ec/graficasproduccionCELEC/polyfills-es2015.c8d9fd53a40f4ff61e6e.js | True | no robots.txt |
| https://generacioncsr.celec.gob.ec/graficasproduccionCELEC/scripts.d5cb97c61d24c303c034.js | True | no robots.txt |
| https://generacioncsr.celec.gob.ec/graficasproduccionCELEC/main-es2015.bb8d1c1f9fb35745e7e5.js | True | no robots.txt |
| https://generacioncsr.celec.gob.ec/graficasproduccionCELEC/main-es5.bb8d1c1f9fb35745e7e5.js | True | no robots.txt |
| https://generacioncsr.celec.gob.ec/graficasproduccion/ | True | no robots.txt |
| https://generacioncsr.celec.gob.ec/graficasproduccion/runtime-es2015.1eba213af0b233498d9d.js | True | no robots.txt |
| https://generacioncsr.celec.gob.ec/graficasproduccion/runtime-es5.1eba213af0b233498d9d.js | True | no robots.txt |
| https://generacioncsr.celec.gob.ec/graficasproduccion/polyfills-es5.84963675a8c97dd2bc1e.js | True | no robots.txt |
| https://generacioncsr.celec.gob.ec/graficasproduccion/polyfills-es2015.e4277e903aed07751db3.js | True | no robots.txt |
| https://generacioncsr.celec.gob.ec/graficasproduccion/scripts.d5cb97c61d24c303c034.js | True | no robots.txt |
| https://generacioncsr.celec.gob.ec/graficasproduccion/main-es2015.3f8644f615fd6faf6b00.js | True | no robots.txt |
| https://generacioncsr.celec.gob.ec/graficasproduccion/main-es5.3f8644f615fd6faf6b00.js | True | no robots.txt |
| https://smec.cenace.gob.ec/SMEC/ResultadoInforme1.do | True | no robots.txt |
| https://smec.cenace.gob.ec/SMEC/ResultadoInforme1.do | True | no robots.txt |
| https://smec.cenace.gob.ec/SMEC/ResultadoInforme1.do | True | no robots.txt |
| https://smec.cenace.gob.ec/SMEC/ResultadoInforme1.do | True | no robots.txt |
| https://smec.cenace.gob.ec/SMEC/ResultadoInforme1.do | True | no robots.txt |
| https://smec.cenace.gob.ec/SMEC/ResultadoInforme1.do | True | no robots.txt |
| https://smec.cenace.gob.ec/SMEC/ResultadoInforme1.do | True | no robots.txt |
| https://smec.cenace.gob.ec/SMEC/ResultadoInforme2.do | True | no robots.txt |
| https://smec.cenace.gob.ec/SMEC/ResultadoInforme3.do | True | no robots.txt |
| https://smec.cenace.gob.ec/SMEC/ResultadoInforme4.do | True | no robots.txt |
| https://smec.cenace.gob.ec/SMEC/ResultadoInforme5.do | True | no robots.txt |
| https://smec.cenace.gob.ec/SMEC/ResultadoInforme6.do | True | no robots.txt |
| https://smec.cenace.gob.ec/SMEC/ResultadoInforme7.do | True | no robots.txt |
| https://smec.cenace.gob.ec/SMEC/ResultadoInforme8.do | True | no robots.txt |
| https://smec.cenace.gob.ec/SMEC/ResultadoInforme9.do | True | no robots.txt |
| https://smec.cenace.gob.ec/SMEC/ResultadoInforme10.do | True | no robots.txt |
| https://smec.cenace.gob.ec/SMEC/ResultadoInforme11.do | True | no robots.txt |
| https://smec.cenace.gob.ec/SMEC/ResultadoInforme12.do | True | no robots.txt |
| https://smec.cenace.gob.ec/SMEC/ | True | no robots.txt |
| https://smec.cenace.gob.ec/ | True | no robots.txt |
| https://smec.cenace.gob.ec/SMEC/index.jsp | True | no robots.txt |
| https://smec.cenace.gob.ec/SMEC/Menu.do | True | no robots.txt |
| https://www.cenace.gob.ec/info-operativa/InformacionOperativa.htm | True | no robots.txt |
| https://archive-api.open-meteo.com/v1/archive?latitude=-2.6&longitude=-78.6&start_date=2024-01-01&end_date=2024-01-31&daily=precipitation_sum,temperature_2m_mean&timezone=America%2FGuayaquil | False | can_fetch(ua)=False can_fetch(*)=False |
| https://api.open-meteo.com/v1/forecast?latitude=-2.6&longitude=-78.6&daily=precipitation_sum&forecast_days=16&timezone=America%2FGuayaquil | False | can_fetch(ua)=False can_fetch(*)=False |
| https://seasonal-api.open-meteo.com/v1/seasonal?latitude=-2.6&longitude=-78.6&daily=precipitation_sum&forecast_days=183&timezone=America%2FGuayaquil | False | can_fetch(ua)=False can_fetch(*)=False |
| https://psl.noaa.gov/data/correlation/oni.data | True | no robots.txt |
| https://www.cpc.ncep.noaa.gov/data/indices/oni.ascii.txt | True | no robots.txt |
| https://raw.githubusercontent.com/jordanvt18/cotas-embalses-ecuador/main/docs/estado.json | True | no robots.txt |
| https://raw.githubusercontent.com/tefaceli/scraper-mazar/main/data/historico.json | True | no robots.txt |
| https://raw.githubusercontent.com/tefaceli/scraper-mazar/main/data/en_vivo.json | True | no robots.txt |
| https://www.datosabiertos.gob.ec/api/3/action/package_search?fq=organization:cenace&rows=100 | True | no robots.txt |
| https://www.datosabiertos.gob.ec/api/3/action/package_search?q=balance%20nacional%20energia%20electrica&rows=20 | True | no robots.txt |
| https://www.datosabiertos.gob.ec/dataset/http-portalsimem-cenace-corp | True | no robots.txt |
| https://www.controlrecursosyenergia.gob.ec/balance-nacional-de-energia-electrica/ | True | no robots.txt |
| https://arconel.gob.ec/balance-nacional-de-energia-electrica/ | True | can_fetch(ua)=True can_fetch(*)=True |

## 3. TLS

| host | sha256 | tls | cipher | system CA verifies | x509 / error |
|---|---|---|---|---|---|
| generacioncsr.celec.gob.ec:8443 | 8a3c3b97aed3a406b64ebb905b7638dfad5fb77b83e2438da348d376ce2c03bb | TLSv1.2 | ECDHE-RSA-AES256-GCM-SHA384 | True | subject=C = EC, ST = Pichincha, O = Corporacion Electrica del Ecuador Celec EP, CN = *.celec.gob.ec issuer=C = GB, O = Sectigo Limited, CN = Sectigo Public Server Authentication CA OV R36 notBefore=Sep 17 00:00:00 2026 GMT notAfter=Apr  3 23:59:59 2027 GMT |
| generacioncsr.celec.gob.ec:443 | 8a3c3b97aed3a406b64ebb905b7638dfad5fb77b83e2438da348d376ce2c03bb | TLSv1.2 | DHE-RSA-AES256-GCM-SHA384 | True | subject=C = EC, ST = Pichincha, O = Corporacion Electrica del Ecuador Celec EP, CN = *.celec.gob.ec issuer=C = GB, O = Sectigo Limited, CN = Sectigo Public Server Authentication CA OV R36 notBefore=Sep 17 00:00:00 2026 GMT notAfter=Apr  3 23:59:59 2027 GMT |
| smec.cenace.gob.ec:443 | 3ac3888f3f80a593857607bcb50e000847fb5c6bfa0b36ff32bba0e1ea21761d | TLSv1.2 | ECDHE-RSA-AES256-GCM-SHA384 | False | subject=C = EC, ST = Pichincha, L = Quito, O = Cenace, OU = Informatica, CN = Marco Bautista, emailAddress = mbautista@cenace.org.ec issuer=C = EC, ST = Pichincha, L = Quito, O = Cenace, OU = Informatica, CN = Marco Bautista, emailAddress = mbautista@cenace.org.ec notBefore=Jun 24 20:20:41 2008 GMT notAfter=Jun 24 20:20:41 2009 GMT |
| www.cenace.gob.ec:443 | 524c72c1b6ae5e3299e8cb4c15ee387da8544fbd2438d48ce59b69dc13c56956 | TLSv1.2 | ECDHE-RSA-AES256-GCM-SHA384 | False | subject=CN = *.cenace.gob.ec issuer=C = GB, O = Sectigo Limited, CN = Sectigo Public Server Authentication CA DV R36 notBefore=Nov 12 00:00:00 2025 GMT notAfter=Nov 12 23:59:59 2026 GMT |

## 4. CELEC ORDS

Earliest January with non-null values for mrid 30031: **None**

### 4.1 Known mrids, current and previous month (MesH24)

| plant/var/mrid/month | items | nulls | min | max | first ts | last ts | item keys |
|---|---|---|---|---|---|---|---|
| Mazar/cota_masl/30031/2026-09 | 30 | 30 |  |  | 2026-09-30T05:00:00Z | 2026-09-01T05:00:00Z | loctimestamp,valueedit |
| Mazar/cota_masl/30031/2026-08 | 31 | 31 |  |  | 2026-08-31T05:00:00Z | 2026-08-01T05:00:00Z | loctimestamp,valueedit |
| Mazar/caudal_m3s/30538/2026-09 | 30 | 30 |  |  | 2026-09-30T05:00:00Z | 2026-09-01T05:00:00Z | loctimestamp,valueedit |
| Mazar/caudal_m3s/30538/2026-08 | 31 | 31 |  |  | 2026-08-31T05:00:00Z | 2026-08-01T05:00:00Z | loctimestamp,valueedit |
| Amaluza/cota_masl/24019/2026-09 | 30 | 30 |  |  | 2026-09-30T05:00:00Z | 2026-09-01T05:00:00Z | loctimestamp,valueedit |
| Amaluza/cota_masl/24019/2026-08 | 31 | 31 |  |  | 2026-08-31T05:00:00Z | 2026-08-01T05:00:00Z | loctimestamp,valueedit |
| Amaluza/caudal_m3s/24811/2026-09 | 30 | 30 |  |  | 2026-09-30T05:00:00Z | 2026-09-01T05:00:00Z | loctimestamp,valueedit |
| Amaluza/caudal_m3s/24811/2026-08 | 31 | 31 |  |  | 2026-08-31T05:00:00Z | 2026-08-01T05:00:00Z | loctimestamp,valueedit |
| Sopladora/cota_masl/90919/2026-09 | 30 | 30 |  |  | 2026-09-30T05:00:00Z | 2026-09-01T05:00:00Z | loctimestamp,valueedit |
| Sopladora/cota_masl/90919/2026-08 | 31 | 31 |  |  | 2026-08-31T05:00:00Z | 2026-08-01T05:00:00Z | loctimestamp,valueedit |
| Sopladora/caudal_m3s/90537/2026-09 | 30 | 30 |  |  | 2026-09-30T05:00:00Z | 2026-09-01T05:00:00Z | loctimestamp,valueedit |
| Sopladora/caudal_m3s/90537/2026-08 | 31 | 31 |  |  | 2026-08-31T05:00:00Z | 2026-08-01T05:00:00Z | loctimestamp,valueedit |

### 4.2 Hourly endpoint (pointValues), yesterday

| mrid/day | items | nulls | min | max | first ts | last ts |
|---|---|---|---|---|---|---|
| 30031/2026-09-20 | 24 | 24 |  |  | 2026-09-21T05:00:00Z | 2026-09-20T06:00:00Z |
| 30538/2026-09-20 | 24 | 24 |  |  | 2026-09-21T05:00:00Z | 2026-09-20T06:00:00Z |

### 4.3 Earliest-year probes (January of each year)

| mrid/month | items | nulls | min | max |
|---|---|---|---|---|
| 30031/2015-01 | 31 | 31 |  |  |
| 30031/2016-01 | 31 | 31 |  |  |
| 30031/2017-01 | 31 | 31 |  |  |
| 30031/2018-01 | 31 | 31 |  |  |
| 30031/2019-01 | 31 | 31 |  |  |
| 30031/2020-01 | 31 | 31 |  |  |
| 30031/2021-01 | 31 | 31 |  |  |
| 30031/2022-01 | 31 | 31 |  |  |
| 30538/2022-01 | 31 | 31 |  |  |
| 24019/2022-01 | 31 | 31 |  |  |
| 24811/2022-01 | 31 | 31 |  |  |
| 90919/2022-01 | 31 | 31 |  |  |
| 90537/2022-01 | 31 | 31 |  |  |

### 4.4 Catalog / metadata probes

| probe | status | content-type | head |
|---|---|---|---|
| ords_root | 200 | text/html;charset=UTF-8 | <!doctype html> <html class="no-js page-1 app-4550" lang="en"> <head> <meta http-equiv="x-ua-compatible" content="IE=edge" /> <meta charset="UTF-8" /> <title>Application Express - Sign In</title> <link rel="shortcut icon" href="/i/apex_ui/img/favicons/favicon.ico"> <link rel="icon" sizes="16x16" hre |
| csr_root | 404 | text/html | <!DOCTYPE html> <html> <style type="text/css" media="screen"> footer,header{display:block;} html{font-family:sans-serif;-ms-text-size-adjust:100%;-webkit-text-size-adjust:100%;} body{margin:0;} h1{font-size:2em;margin:0.67em 0;} pre{font-family:monospace, serif;font-size:1em;} pre{white-space:pre-wr |
| metadata_catalog | 401 | text/html | <!DOCTYPE html> <html> <style type="text/css" media="screen"> footer,header{display:block;} html{font-family:sans-serif;-ms-text-size-adjust:100%;-webkit-text-size-adjust:100%;} body{margin:0;} h1{font-size:2em;margin:0.67em 0;} pre{font-family:monospace, serif;font-size:1em;} pre{white-space:pre-wr |
| metadata_catalog_module | 401 | text/html | <!DOCTYPE html> <html> <style type="text/css" media="screen"> footer,header{display:block;} html{font-family:sans-serif;-ms-text-size-adjust:100%;-webkit-text-size-adjust:100%;} body{margin:0;} h1{font-size:2em;margin:0.67em 0;} pre{font-family:monospace, serif;font-size:1em;} pre{white-space:pre-wr |
| module_root | 404 | text/html | <!DOCTYPE html> <html> <style type="text/css" media="screen"> footer,header{display:block;} html{font-family:sans-serif;-ms-text-size-adjust:100%;-webkit-text-size-adjust:100%;} body{margin:0;} h1{font-size:2em;margin:0.67em 0;} pre{font-family:monospace, serif;font-size:1em;} pre{white-space:pre-wr |
| mesh24_no_params | 200 | application/json | {"items":[],"hasMore":false,"limit":0,"offset":0,"count":0,"links":[{"rel":"self","href":"https://generacioncsr.celec.gob.ec:8443/ords/csr/sardomcsr/pointValuesMesH24"},{"rel":"describedby","href":"https://generacioncsr.celec.gob.ec:8443/ords/csr/metadata-catalog/sardomcsr/item"}]} |
| open_api | 200 |  | {"swagger":"2.0","info":{"title":"ORDS generated API for celecsur","version":"1.0.0"},"host":"generacioncsr.celec.gob.ec:8443","basePath":"/ords/csr/sardomcsr","schemes":["https"],"produces":["application/json"],"paths":{"/csrCaudCuenAnioAvg":{"get":{"description":"Retrieve records from celecsur","p |

## 5. CELEC dashboards (Angular bundles)

### celec_wide — `GrÃ¡ficas de ProducciÃ³n CELEC` (index status 200, ok)

| script | status | bytes | mrid hits | mrid-adjacent numbers | ords urls | assets json | plant term counts |
|---|---|---|---|---|---|---|---|
| runtime-es2015.17457c14264390561f33.js | 200 | 1485 | 0 |  |  |  | {} |
| runtime-es5.17457c14264390561f33.js | 200 | 1485 | 0 |  |  |  | {} |
| polyfills-es5.1460e12205482c371a4c.js | 200 | 132965 | 0 |  |  |  | {} |
| polyfills-es2015.c8d9fd53a40f4ff61e6e.js | 200 | 37670 | 0 |  |  |  | {} |
| scripts.d5cb97c61d24c303c034.js | 200 | 341089 | 0 |  |  |  | {} |
| main-es2015.bb8d1c1f9fb35745e7e5.js | 200 | 1042099 | 87 | 8443,24019,24811,24812,30031,30503,30538,44822,90503,90537,90919,100037,100503,100540,110031,110503,110537,140031,140503,140537,650503,650538,650919 | /ords/csr/sardomago/agoEnerAnio /ords/csr/sardomago/agoEnerAnios /ords/csr/sardomago/agoEnerDia /ords/csr/sardomago/agoEnerMes /ords/csr/sardomccs/ccsEnerAnio /ords/csr/sardomccs/ccsEnerAnios /ords/csr/sardomccs/ccsEnerDia /ords/csr/sardomccs/ccsEnerMes /ords/csr/sardomcsr/csrCaudCuenAnioAvg /ords/csr/sardomcsr/csrCaudCuenAniosAvg /ords/csr/sardomcsr/csrCaudCuenMesAvg /ords/csr/sardomcsr/csrEnerAnio /ords/csr/sardomcsr/csrEnerAnios /ords/csr/sardomcsr/csrEnerDia /ords/csr/sardomcsr/csrEnerMes /ords/csr/sardomcsr/pointValues /ords/csr/sardomcsr/pointValuesAnioAvg /ords/csr/sardomcsr/pointValuesAnioH24 /ords/csr/sardomcsr/pointValuesAniosAvg /ords/csr/sardomcsr/pointValuesAniosH24 /ords/csr/sardomcsr/pointValuesMesAvg /ords/csr/sardomcsr/pointValuesMesH24 /ords/csr/sardomman/manEnerAnio /ords/csr/sardomman/manEnerAnios /ords/csr/sardomman/manEnerDia /ords/csr/sardomman/manEnerMes /ords/csr/sardommaz/mazEnerAnio /ords/csr/sardommaz/mazEnerAnios /ords/csr/sardommaz/mazEnerDia /ords/csr/sardommaz/mazEnerMes /ords/csr/sardommol/molEnerAnio /ords/csr/sardommol/molEnerAnios /ords/csr/sardommol/molEnerDia /ords/csr/sardommol/molEnerMes /ords/csr/sardommsf/msfEnerAnio /ords/csr/sardommsf/msfEnerAnios /ords/csr/sardommsf/msfEnerDia /ords/csr/sardommsf/msfEnerMes /ords/csr/sardomsop/sopEnerAnio /ords/csr/sardomsop/sopEnerAnios /ords/csr/sardomsop/sopEnerDia /ords/csr/sardomsop/sopEnerMes |  | {"mazar": 7, "amaluza": 2, "molino": 4, "paute": 4, "sopladora": 6, "minas": 6, "san francisco": 4, "agoy": 6, "manduriacu": 4, "coca codo": 4, "sinclair": 4, "cota": 196, "caudal": 140, "produc": 34, "energ": 121} |
| main-es5.bb8d1c1f9fb35745e7e5.js | 200 | 1114294 | 87 | 24019,24811,24812,30031,30503,30538,44822,90503,90537,90919,100037,100503,100540,110031,110503,110537,140031,140503,140537,650503,650538,650919 | /ords/csr/sardomago/agoEnerAnio /ords/csr/sardomago/agoEnerAnios /ords/csr/sardomago/agoEnerDia /ords/csr/sardomago/agoEnerMes /ords/csr/sardomccs/ccsEnerAnio /ords/csr/sardomccs/ccsEnerAnios /ords/csr/sardomccs/ccsEnerDia /ords/csr/sardomccs/ccsEnerMes /ords/csr/sardomcsr/csrCaudCuenAnioAvg /ords/csr/sardomcsr/csrCaudCuenAniosAvg /ords/csr/sardomcsr/csrCaudCuenMesAvg /ords/csr/sardomcsr/csrEnerAnio /ords/csr/sardomcsr/csrEnerAnios /ords/csr/sardomcsr/csrEnerDia /ords/csr/sardomcsr/csrEnerMes /ords/csr/sardomcsr/pointValues /ords/csr/sardomcsr/pointValuesAnioAvg /ords/csr/sardomcsr/pointValuesAnioH24 /ords/csr/sardomcsr/pointValuesAniosAvg /ords/csr/sardomcsr/pointValuesAniosH24 /ords/csr/sardomcsr/pointValuesMesAvg /ords/csr/sardomcsr/pointValuesMesH24 /ords/csr/sardomman/manEnerAnio /ords/csr/sardomman/manEnerAnios /ords/csr/sardomman/manEnerDia /ords/csr/sardomman/manEnerMes /ords/csr/sardommaz/mazEnerAnio /ords/csr/sardommaz/mazEnerAnios /ords/csr/sardommaz/mazEnerDia /ords/csr/sardommaz/mazEnerMes /ords/csr/sardommol/molEnerAnio /ords/csr/sardommol/molEnerAnios /ords/csr/sardommol/molEnerDia /ords/csr/sardommol/molEnerMes /ords/csr/sardommsf/msfEnerAnio /ords/csr/sardommsf/msfEnerAnios /ords/csr/sardommsf/msfEnerDia /ords/csr/sardommsf/msfEnerMes /ords/csr/sardomsop/sopEnerAnio /ords/csr/sardomsop/sopEnerAnios /ords/csr/sardomsop/sopEnerDia /ords/csr/sardomsop/sopEnerMes |  | {"mazar": 7, "amaluza": 2, "molino": 4, "paute": 4, "sopladora": 6, "minas": 6, "san francisco": 4, "agoy": 6, "manduriacu": 4, "coca codo": 4, "sinclair": 4, "cota": 196, "caudal": 140, "produc": 34, "energ": 121} |

- mrid-adjacent numbers (all bundles): `8443, 24019, 24811, 24812, 30031, 30503, 30538, 44822, 90503, 90537, 90919, 100037, 100503, 100540, 110031, 110503, 110537, 140031, 140503, 140537, 650503, 650538, 650919`
- ORDS URLs found: `/ords/csr/sardomago/agoEnerAnio /ords/csr/sardomago/agoEnerAnios /ords/csr/sardomago/agoEnerDia /ords/csr/sardomago/agoEnerMes /ords/csr/sardomccs/ccsEnerAnio /ords/csr/sardomccs/ccsEnerAnios /ords/csr/sardomccs/ccsEnerDia /ords/csr/sardomccs/ccsEnerMes /ords/csr/sardomcsr/csrCaudCuenAnioAvg /ords/csr/sardomcsr/csrCaudCuenAniosAvg /ords/csr/sardomcsr/csrCaudCuenMesAvg /ords/csr/sardomcsr/csrEnerAnio /ords/csr/sardomcsr/csrEnerAnios /ords/csr/sardomcsr/csrEnerDia /ords/csr/sardomcsr/csrEnerMes /ords/csr/sardomcsr/pointValues /ords/csr/sardomcsr/pointValuesAnioAvg /ords/csr/sardomcsr/pointValuesAnioH24 /ords/csr/sardomcsr/pointValuesAniosAvg /ords/csr/sardomcsr/pointValuesAniosH24 /ords/csr/sardomcsr/pointValuesMesAvg /ords/csr/sardomcsr/pointValuesMesH24 /ords/csr/sardomman/manEnerAnio /ords/csr/sardomman/manEnerAnios /ords/csr/sardomman/manEnerDia /ords/csr/sardomman/manEnerMes /ords/csr/sardommaz/mazEnerAnio /ords/csr/sardommaz/mazEnerAnios /ords/csr/sardommaz/mazEnerDia /ords/csr/sardommaz/mazEnerMes /ords/csr/sardommol/molEnerAnio /ords/csr/sardommol/molEnerAnios /ords/csr/sardommol/molEnerDia /ords/csr/sardommol/molEnerMes /ords/csr/sardommsf/msfEnerAnio /ords/csr/sardommsf/msfEnerAnios /ords/csr/sardommsf/msfEnerDia /ords/csr/sardommsf/msfEnerMes /ords/csr/sardomsop/sopEnerAnio /ords/csr/sardomsop/sopEnerAnios /ords/csr/sardomsop/sopEnerDia /ords/csr/sardomsop/sopEnerMes`
- celec/cenace URLs found: `—`
- assets JSON referenced: `—`
- windows around `mrid`: 174, around `csv`: 58 (see `tests/fixtures/celec_web/celec_wide_scan.json`)


### celec_sur — `GrÃ¡ficas de ProducciÃ³n CELEC SUR` (index status 200, ok)

| script | status | bytes | mrid hits | mrid-adjacent numbers | ords urls | assets json | plant term counts |
|---|---|---|---|---|---|---|---|
| runtime-es2015.1eba213af0b233498d9d.js | 200 | 1485 | 0 |  |  |  | {} |
| runtime-es5.1eba213af0b233498d9d.js | 200 | 1485 | 0 |  |  |  | {} |
| polyfills-es5.84963675a8c97dd2bc1e.js | 200 | 132965 | 0 |  |  |  | {} |
| polyfills-es2015.e4277e903aed07751db3.js | 200 | 37670 | 0 |  |  |  | {} |
| scripts.d5cb97c61d24c303c034.js | 200 | 341089 | 0 |  |  |  | {} |
| main-es2015.3f8644f615fd6faf6b00.js | 200 | 990065 | 51 | 8443,24019,24811,24812,30031,30503,30538,44822,90503,90537,90919,650503,650538,650919 | /ords/csr/sardomcsr/csrCaudCuenAnioAvg /ords/csr/sardomcsr/csrCaudCuenAniosAvg /ords/csr/sardomcsr/csrCaudCuenMesAvg /ords/csr/sardomcsr/csrEnerAnio /ords/csr/sardomcsr/csrEnerAnios /ords/csr/sardomcsr/csrEnerDia /ords/csr/sardomcsr/csrEnerMes /ords/csr/sardomcsr/pointValues /ords/csr/sardomcsr/pointValuesAnioAvg /ords/csr/sardomcsr/pointValuesAnioH24 /ords/csr/sardomcsr/pointValuesAniosAvg /ords/csr/sardomcsr/pointValuesAniosH24 /ords/csr/sardomcsr/pointValuesMesAvg /ords/csr/sardomcsr/pointValuesMesH24 /ords/csr/sardommaz/mazEnerAnio /ords/csr/sardommaz/mazEnerAnios /ords/csr/sardommaz/mazEnerDia /ords/csr/sardommaz/mazEnerMes /ords/csr/sardommol/molEnerAnio /ords/csr/sardommol/molEnerAnios /ords/csr/sardommol/molEnerDia /ords/csr/sardommol/molEnerMes /ords/csr/sardommsf/msfEnerAnio /ords/csr/sardommsf/msfEnerAnios /ords/csr/sardommsf/msfEnerDia /ords/csr/sardommsf/msfEnerMes /ords/csr/sardomsop/sopEnerAnio /ords/csr/sardomsop/sopEnerAnios /ords/csr/sardomsop/sopEnerDia /ords/csr/sardomsop/sopEnerMes |  | {"mazar": 7, "amaluza": 2, "molino": 4, "paute": 4, "sopladora": 6, "minas": 6, "san francisco": 4, "cota": 112, "caudal": 86, "produc": 25, "energ": 76} |
| main-es5.3f8644f615fd6faf6b00.js | 200 | 1057250 | 51 | 24019,24811,24812,30031,30503,30538,44822,90503,90537,90919,650503,650538,650919 | /ords/csr/sardomcsr/csrCaudCuenAnioAvg /ords/csr/sardomcsr/csrCaudCuenAniosAvg /ords/csr/sardomcsr/csrCaudCuenMesAvg /ords/csr/sardomcsr/csrEnerAnio /ords/csr/sardomcsr/csrEnerAnios /ords/csr/sardomcsr/csrEnerDia /ords/csr/sardomcsr/csrEnerMes /ords/csr/sardomcsr/pointValues /ords/csr/sardomcsr/pointValuesAnioAvg /ords/csr/sardomcsr/pointValuesAnioH24 /ords/csr/sardomcsr/pointValuesAniosAvg /ords/csr/sardomcsr/pointValuesAniosH24 /ords/csr/sardomcsr/pointValuesMesAvg /ords/csr/sardomcsr/pointValuesMesH24 /ords/csr/sardommaz/mazEnerAnio /ords/csr/sardommaz/mazEnerAnios /ords/csr/sardommaz/mazEnerDia /ords/csr/sardommaz/mazEnerMes /ords/csr/sardommol/molEnerAnio /ords/csr/sardommol/molEnerAnios /ords/csr/sardommol/molEnerDia /ords/csr/sardommol/molEnerMes /ords/csr/sardommsf/msfEnerAnio /ords/csr/sardommsf/msfEnerAnios /ords/csr/sardommsf/msfEnerDia /ords/csr/sardommsf/msfEnerMes /ords/csr/sardomsop/sopEnerAnio /ords/csr/sardomsop/sopEnerAnios /ords/csr/sardomsop/sopEnerDia /ords/csr/sardomsop/sopEnerMes |  | {"mazar": 7, "amaluza": 2, "molino": 4, "paute": 4, "sopladora": 6, "minas": 6, "san francisco": 4, "cota": 112, "caudal": 86, "produc": 25, "energ": 76} |

- mrid-adjacent numbers (all bundles): `8443, 24019, 24811, 24812, 30031, 30503, 30538, 44822, 90503, 90537, 90919, 650503, 650538, 650919`
- ORDS URLs found: `/ords/csr/sardomcsr/csrCaudCuenAnioAvg /ords/csr/sardomcsr/csrCaudCuenAniosAvg /ords/csr/sardomcsr/csrCaudCuenMesAvg /ords/csr/sardomcsr/csrEnerAnio /ords/csr/sardomcsr/csrEnerAnios /ords/csr/sardomcsr/csrEnerDia /ords/csr/sardomcsr/csrEnerMes /ords/csr/sardomcsr/pointValues /ords/csr/sardomcsr/pointValuesAnioAvg /ords/csr/sardomcsr/pointValuesAnioH24 /ords/csr/sardomcsr/pointValuesAniosAvg /ords/csr/sardomcsr/pointValuesAniosH24 /ords/csr/sardomcsr/pointValuesMesAvg /ords/csr/sardomcsr/pointValuesMesH24 /ords/csr/sardommaz/mazEnerAnio /ords/csr/sardommaz/mazEnerAnios /ords/csr/sardommaz/mazEnerDia /ords/csr/sardommaz/mazEnerMes /ords/csr/sardommol/molEnerAnio /ords/csr/sardommol/molEnerAnios /ords/csr/sardommol/molEnerDia /ords/csr/sardommol/molEnerMes /ords/csr/sardommsf/msfEnerAnio /ords/csr/sardommsf/msfEnerAnios /ords/csr/sardommsf/msfEnerDia /ords/csr/sardommsf/msfEnerMes /ords/csr/sardomsop/sopEnerAnio /ords/csr/sardomsop/sopEnerAnios /ords/csr/sardomsop/sopEnerDia /ords/csr/sardomsop/sopEnerMes`
- celec/cenace URLs found: `—`
- assets JSON referenced: `—`
- windows around `mrid`: 102, around `csv`: 58 (see `tests/fixtures/celec_web/celec_sur_scan.json`)


## 6. CENACE SMEC daily balance

### 6.1 ResultadoInforme1.do by date

| date | status | bytes | tables | labelled rows | title |
|---|---|---|---|---|---|
| 2026-09-20 | 200 | 39354 | 9 | 15 | Informe de Balance Energético |
| 2026-09-19 | 200 | 39356 | 9 | 15 | Informe de Balance Energético |
| 2024-10-15 | 200 | 39365 | 9 | 15 | Informe de Balance Energético |
| 2023-11-05 | 200 | 39378 | 9 | 15 | Informe de Balance Energético |
| 2022-01-15 | 200 | 39345 | 9 | 15 | Informe de Balance Energético |
| 2021-06-15 | 200 | 39348 | 9 | 15 | Informe de Balance Energético |
| 2019-01-15 | 200 | 41404 | 9 | 16 | Informe de Balance Energético |

#### Rows on 2026-09-20

| label | value |
|---|---|
| Generación Hidráulica | 76,808,654.928 |
| Generación Vapor Bunker | 5,116,538.015 |
| Generación Turbinas a Gas | 2,711,965.127 |
| Generación Turbinas a Diesel | 4,437,143.344 |
| Generación Motores Bunker | 9,173,931.161 |
| Generación de Otros Tipos | 1,806,103.136 |
| Total Generación | 100,054,335.711 |
| Importación de Colombia | 167,558.871 |
| Importación de Perú | 0.000 |
| Total Importación | 167,558.871 |
| Exportación a Colombia | 146,334.157 |
| Exportación a Perú | 0.000 |
| Total Exportación | 146,334.157 |
| Demanda Distribución | 88,689,170.903 |
| Total Pérdidas Transporte | 406,355.225 |

<details><summary>All table rows (first 120)</summary>

| cells |
|---|
|  · Informe de Balance Energético Fecha: 2026/09/20 Tipo Día: Domingo Tipo Día Año Anterior: Sábado Tipo Generación Energía Activa en el Día (kWh) % Incremento Día Energía Activa en el Mes (kWh) % Incremento Mes Energía Activa en el Año (kWh) % Incremento Año Energía Activa Últimos 365 días (kWh) Balance Generación Generación Hidráulica 76,808,654.928 -9.221 1,723,223,339.176 4.665 22,273,039,036.957 0.346 30,353,295,622.277 Generación Vapor Bunker 5,116,538.015 -2.523 98,373,659.232 5.486 1,537,261,844.526 0.334 1,940,554,814.351 Generación Turbinas a Gas 2,711,965.127 6.849 50,899,840.042 5.628 466,119,456.602 0.585 586,905,947.612 Generación Turbinas a Diesel 4,437,143.344 0.023 86,672,578.058 5.396 865,837,786.091 0.515 1,028,358,155.075 Generación Motores Bunker 9,173,931.161 -0.111 181,238,003.451 5.332 1,767,584,949.373 0.522 2,336,205,887.123 Generación de Otros Tipos 1,806,103.136 -7.345 38,591,427.421 4.910 247,451,467.171 0.735 400,086,884.919 Total Generación 100,054,335.711 -7.329 2,178,998,847.380 4.813 27,157,294,540.720 0.370 36,645,407,311.357 Conexiones Internacionales Importación de Colombia 167,558.871 8.447 42,477,669.655 0.396 289,543,883.766 0.058 539,523,157.889 Importación de Perú 0.000 0.000 0.000 0.000 100.723 0.000 100.739 Total Importación 167,558.871 8.447 42,477,669.655 0.396 289,543,984.489 0.058 539,523,258.628 Exportación a Colombia 146,334.157 10.096 1,771,542.753 9.004 27,008,577.666 0.545 109,264,315.758 Exportación a Perú 0.000 0.000 0.000 0.000 0.000 0.000 184,692.703 Total Exportación 146,334.157 10.096 1,771,542.753 9.004 27,008,577.666 0.545 109,449,008.461 Demanda Distribución Demanda Distribución 88,689,170.903 -7.441 1,965,446,182.602 4.726 24,827,658,273.888 0.358 33,565,285,854.384 Pérdidas Transporte Total Pérdidas Transporte 406,355.225 -60.773 34,429,360.808 1.194 577,135,257.111 0.070 773,902,935.098 ·  ·  ·  · Informe de Balance Energético Fecha: 2026/09/20 Tipo Día: Domingo Tipo Día Año Anterior: Sábado Tipo Generación Energía Activa en el Día (kWh) % Incremento Día Energía Activa en el Mes (kWh) % Incremento Mes Energía Activa en el Año (kWh) % Incremento Año Energía Activa Últimos 365 días (kWh) Balance Generación Generación Hidráulica 76,808,654.928 -9.221 1,723,223,339.176 4.665 22,273,039,036.957 0.346 30,353,295,622.277 Generación Vapor Bunker 5,116,538.015 -2.523 98,373,659.232 5.486 1,537,261,844.526 0.334 1,940,554,814.351 Generación Turbinas a Gas 2,711,965.127 6.849 50,899,840.042 5.628 466,119,456.602 0.585 586,905,947.612 Generación Turbinas a Diesel 4,437,143.344 0.023 86,672,578.058 5.396 865,837,786.091 0.515 1,028,358,155.075 Generación Motores Bunker 9,173,931.161 -0.111 181,238,003.451 5.332 1,767,584,949.373 0.522 2,336,205,887.123 Generación de Otros Tipos 1,806,103.136 -7.345 38,591,427.421 4.910 247,451,467.171 0.735 400,086,884.919 Total Generación 100,054,335.711 -7.329 2,178,998,847.380 4.813 27,157,294,540.720 0.370 36,645,407,311.357 Conexiones Internacionales Importación de Colombia 167,558.871 8.447 42,477,669.655 0.396 289,543,883.766 0.058 539,523,157.889 Importación de Perú 0.000 0.000 0.000 0.000 100.723 0.000 100.739 Total Importación 167,558.871 8.447 42,477,669.655 0.396 289,543,984.489 0.058 539,523,258.628 Exportación a Colombia 146,334.157 10.096 1,771,542.753 9.004 27,008,577.666 0.545 109,264,315.758 Exportación a Perú 0.000 0.000 0.000 0.000 0.000 0.000 184,692.703 Total Exportación 146,334.157 10.096 1,771,542.753 9.004 27,008,577.666 0.545 109,449,008.461 Demanda Distribución Demanda Distribución 88,689,170.903 -7.441 1,965,446,182.602 4.726 24,827,658,273.888 0.358 33,565,285,854.384 Pérdidas Transporte Total Pérdidas Transporte 406,355.225 -60.773 34,429,360.808 1.194 577,135,257.111 0.070 773,902,935.098 · Informe de Balance Energético Fecha: 2026/09/20 Tipo Día: Domingo Tipo Día Año Anterior: Sábado Tipo Generación Energía Activa en el Día (kWh) % Incremento Día Energía Activa en el Mes (kWh) % Incremento Mes Energía Activa en el Año (kWh) % Incremento Año Energía Activa Últimos 365 días (kWh) Balance Generación Generación Hidráulica 76,808,654.928 -9.221 1,723,223,339.176 4.665 22,273,039,036.957 0.346 30,353,295,622.277 Generación Vapor Bunker 5,116,538.015 -2.523 98,373,659.232 5.486 1,537,261,844.526 0.334 1,940,554,814.351 Generación Turbinas a Gas 2,711,965.127 6.849 50,899,840.042 5.628 466,119,456.602 0.585 586,905,947.612 Generación Turbinas a Diesel 4,437,143.344 0.023 86,672,578.058 5.396 865,837,786.091 0.515 1,028,358,155.075 Generación Motores Bunker 9,173,931.161 -0.111 181,238,003.451 5.332 1,767,584,949.373 0.522 2,336,205,887.123 Generación de Otros Tipos 1,806,103.136 -7.345 38,591,427.421 4.910 247,451,467.171 0.735 400,086,884.919 Total Generación 100,054,335.711 -7.329 2,178,998,847.380 4.813 27,157,294,540.720 0.370 36,645,407,311.357 Conexiones Internacionales Importación de Colombia 167,558.871 8.447 42,477,669.655 0.396 289,543,883.766 0.058 539,523,157.889 Importación de Perú 0.000 0.000 0.000 0.000 100.723 0.000 100.739 Total Importación 167,558.871 8.447 42,477,669.655 0.396 289,543,984.489 0.058 539,523,258.628 Exportación a Colombia 146,334.157 10.096 1,771,542.753 9.004 27,008,577.666 0.545 109,264,315.758 Exportación a Perú 0.000 0.000 0.000 0.000 0.000 0.000 184,692.703 Total Exportación 146,334.157 10.096 1,771,542.753 9.004 27,008,577.666 0.545 109,449,008.461 Demanda Distribución Demanda Distribución 88,689,170.903 -7.441 1,965,446,182.602 4.726 24,827,658,273.888 0.358 33,565,285,854.384 Pérdidas Transporte Total Pérdidas Transporte 406,355.225 -60.773 34,429,360.808 1.194 577,135,257.111 0.070 773,902,935.098 · Informe de Balance Energético Fecha: 2026/09/20 Tipo Día: Domingo Tipo Día Año Anterior: Sábado Tipo Generación Energía Activa en el Día (kWh) % Incremento Día Energía Activa en el Mes (kWh) % Incremento Mes Energía Activa en el Año (kWh) % Incremento Año Energía Activa Últimos 365 días (kWh) Balance Generación Generación Hidráulica 76,808,654.928 -9.221 1,723,223,339.176 4.665 22,273,039,036.957 0.346 30,353,295,622.277 Generación Vapor Bunker 5,116,538.015 -2.523 98,373,659.232 5.486 1,537,261,844.526 0.334 1,940,554,814.351 Generación Turbinas a Gas 2,711,965.127 6.849 50,899,840.042 5.628 466,119,456.602 0.585 586,905,947.612 Generación Turbinas a Diesel 4,437,143.344 0.023 86,672,578.058 5.396 865,837,786.091 0.515 1,028,358,155.075 Generación Motores Bunker 9,173,931.161 -0.111 181,238,003.451 5.332 1,767,584,949.373 0.522 2,336,205,887.123 Generación de Otros Tipos 1,806,103.136 -7.345 38,591,427.421 4.910 247,451,467.171 0.735 400,086,884.919 Total Generación 100,054,335.711 -7.329 2,178,998,847.380 4.813 27,157,294,540.720 0.370 36,645,407,311.357 Conexiones Internacionales Importación de Colombia 167,558.871 8.447 42,477,669.655 0.396 289,543,883.766 0.058 539,523,157.889 Importación de Perú 0.000 0.000 0.000 0.000 100.723 0.000 100.739 Total Importación 167,558.871 8.447 42,477,669.655 0.396 289,543,984.489 0.058 539,523,258.628 Exportación a Colombia 146,334.157 10.096 1,771,542.753 9.004 27,008,577.666 0.545 109,264,315.758 Exportación a Perú 0.000 0.000 0.000 0.000 0.000 0.000 184,692.703 Total Exportación 146,334.157 10.096 1,771,542.753 9.004 27,008,577.666 0.545 109,449,008.461 Demanda Distribución Demanda Distribución 88,689,170.903 -7.441 1,965,446,182.602 4.726 24,827,658,273.888 0.358 33,565,285,854.384 Pérdidas Transporte Total Pérdidas Transporte 406,355.225 -60.773 34,429,360.808 1.194 577,135,257.111 0.070 773,902,935.098 | Informe de Balance Energético Fecha: 2026/09/20 Tipo Día: Domingo Tipo Día Año Anterior: Sábado Tipo Generación Energía Activa en el Día (kWh) % Incremento Día Energía Activa en el Mes (kWh) % Incremento Mes Energía Activa en el Año (kWh) % Incremento Año Energía Activa Últimos 365 días (kWh) Balance Generación Generación Hidráulica 76,808,654.928 -9.221 1,723,223,339.176 4.665 22,273,039,036.957 0.346 30,353,295,622.277 Generación Vapor Bunker 5,116,538.015 -2.523 98,373,659.232 5.486 1,537,261,844.526 0.334 1,940,554,814.351 Generación Turbinas a Gas 2,711,965.127 6.849 50,899,840.042 5.628 466,119,456.602 0.585 586,905,947.612 Generación Turbinas a Diesel 4,437,143.344 0.023 86,672,578.058 5.396 865,837,786.091 0.515 1,028,358,155.075 Generación Motores Bunker 9,173,931.161 -0.111 181,238,003.451 5.332 1,767,584,949.373 0.522 2,336,205,887.123 Generación de Otros Tipos 1,806,103.136 -7.345 38,591,427.421 4.910 247,451,467.171 0.735 400,086,884.919 Total Generación 100,054,335.711 -7.329 2,178,998,847.380 4.813 27,157,294,540.720 0.370 36,645,407,311.357 Conexiones Internacionales Importación de Colombia 167,558.871 8.447 42,477,669.655 0.396 289,543,883.766 0.058 539,523,157.889 Importación de Perú 0.000 0.000 0.000 0.000 100.723 0.000 100.739 Total Importación 167,558.871 8.447 42,477,669.655 0.396 289,543,984.489 0.058 539,523,258.628 Exportación a Colombia 146,334.157 10.096 1,771,542.753 9.004 27,008,577.666 0.545 109,264,315.758 Exportación a Perú 0.000 0.000 0.000 0.000 0.000 0.000 184,692.703 Total Exportación 146,334.157 10.096 1,771,542.753 9.004 27,008,577.666 0.545 109,449,008.461 Demanda Distribución Demanda Distribución 88,689,170.903 -7.441 1,965,446,182.602 4.726 24,827,658,273.888 0.358 33,565,285,854.384 Pérdidas Transporte Total Pérdidas Transporte 406,355.225 -60.773 34,429,360.808 1.194 577,135,257.111 0.070 773,902,935.098 · Informe de Balance Energético Fecha: 2026/09/20 Tipo Día: Domingo Tipo Día Año Anterior: Sábado Tipo Generación Energía Activa en el Día (kWh) % Incremento Día Energía Activa en el Mes (kWh) % Incremento Mes Energía Activa en el Año (kWh) % Incremento Año Energía Activa Últimos 365 días (kWh) Balance Generación Generación Hidráulica 76,808,654.928 -9.221 1,723,223,339.176 4.665 22,273,039,036.957 0.346 30,353,295,622.277 Generación Vapor Bunker 5,116,538.015 -2.523 98,373,659.232 5.486 1,537,261,844.526 0.334 1,940,554,814.351 Generación Turbinas a Gas 2,711,965.127 6.849 50,899,840.042 5.628 466,119,456.602 0.585 586,905,947.612 Generación Turbinas a Diesel 4,437,143.344 0.023 86,672,578.058 5.396 865,837,786.091 0.515 1,028,358,155.075 Generación Motores Bunker 9,173,931.161 -0.111 181,238,003.451 5.332 1,767,584,949.373 0.522 2,336,205,887.123 Generación de Otros Tipos 1,806,103.136 -7.345 38,591,427.421 4.910 247,451,467.171 0.735 400,086,884.919 Total Generación 100,054,335.711 -7.329 2,178,998,847.380 4.813 27,157,294,540.720 0.370 36,645,407,311.357 Conexiones Internacionales Importación de Colombia 167,558.871 8.447 42,477,669.655 0.396 289,543,883.766 0.058 539,523,157.889 Importación de Perú 0.000 0.000 0.000 0.000 100.723 0.000 100.739 Total Importación 167,558.871 8.447 42,477,669.655 0.396 289,543,984.489 0.058 539,523,258.628 Exportación a Colombia 146,334.157 10.096 1,771,542.753 9.004 27,008,577.666 0.545 109,264,315.758 Exportación a Perú 0.000 0.000 0.000 0.000 0.000 0.000 184,692.703 Total Exportación 146,334.157 10.096 1,771,542.753 9.004 27,008,577.666 0.545 109,449,008.461 Demanda Distribución Demanda Distribución 88,689,170.903 -7.441 1,965,446,182.602 4.726 24,827,658,273.888 0.358 33,565,285,854.384 Pérdidas Transporte Total Pérdidas Transporte 406,355.225 -60.773 34,429,360.808 1.194 577,135,257.111 0.070 773,902,935.098 · Informe de Balance Energético Fecha: 2026/09/20 Tipo Día: Domingo Tipo Día Año Anterior: Sábado Tipo Generación Energía Activa en el Día (kWh) % Incremento Día Energía Activa en el Mes (kWh) % Incremento Mes Energía Activa en el Año (kWh) % Incremento Año Energía Activa Últimos 365 días (kWh) Balance Generación Generación Hidráulica 76,808,654.928 -9.221 1,723,223,339.176 4.665 22,273,039,036.957 0.346 30,353,295,622.277 Generación Vapor Bunker 5,116,538.015 -2.523 98,373,659.232 5.486 1,537,261,844.526 0.334 1,940,554,814.351 Generación Turbinas a Gas 2,711,965.127 6.849 50,899,840.042 5.628 466,119,456.602 0.585 586,905,947.612 Generación Turbinas a Diesel 4,437,143.344 0.023 86,672,578.058 5.396 865,837,786.091 0.515 1,028,358,155.075 Generación Motores Bunker 9,173,931.161 -0.111 181,238,003.451 5.332 1,767,584,949.373 0.522 2,336,205,887.123 Generación de Otros Tipos 1,806,103.136 -7.345 38,591,427.421 4.910 247,451,467.171 0.735 400,086,884.919 Total Generación 100,054,335.711 -7.329 2,178,998,847.380 4.813 27,157,294,540.720 0.370 36,645,407,311.357 Conexiones Internacionales Importación de Colombia 167,558.871 8.447 42,477,669.655 0.396 289,543,883.766 0.058 539,523,157.889 Importación de Perú 0.000 0.000 0.000 0.000 100.723 0.000 100.739 Total Importación 167,558.871 8.447 42,477,669.655 0.396 289,543,984.489 0.058 539,523,258.628 Exportación a Colombia 146,334.157 10.096 1,771,542.753 9.004 27,008,577.666 0.545 109,264,315.758 Exportación a Perú 0.000 0.000 0.000 0.000 0.000 0.000 184,692.703 Total Exportación 146,334.157 10.096 1,771,542.753 9.004 27,008,577.666 0.545 109,449,008.461 Demanda Distribución Demanda Distribución 88,689,170.903 -7.441 1,965,446,182.602 4.726 24,827,658,273.888 0.358 33,565,285,854.384 Pérdidas Transporte Total Pérdidas Transporte 406,355.225 -60.773 34,429,360.808 1.194 577,135,257.111 0.070 773,902,935.098 · Informe de Balance Energético · Fecha: 2026/09/20 Tipo Día: Domingo Tipo Día Año Anterior: Sábado Tipo Generación Energía Activa en el Día (kWh) % Incremento Día Energía Activa en el Mes (kWh) % Incremento Mes Energía Activa en el Año (kWh) % Incremento Año Energía Activa Últimos 365 días (kWh) Balance Generación Generación Hidráulica 76,808,654.928 -9.221 1,723,223,339.176 4.665 22,273,039,036.957 0.346 30,353,295,622.277 Generación Vapor Bunker 5,116,538.015 -2.523 98,373,659.232 5.486 1,537,261,844.526 0.334 1,940,554,814.351 Generación Turbinas a Gas 2,711,965.127 6.849 50,899,840.042 5.628 466,119,456.602 0.585 586,905,947.612 Generación Turbinas a Diesel 4,437,143.344 0.023 86,672,578.058 5.396 865,837,786.091 0.515 1,028,358,155.075 Generación Motores Bunker 9,173,931.161 -0.111 181,238,003.451 5.332 1,767,584,949.373 0.522 2,336,205,887.123 Generación de Otros Tipos 1,806,103.136 -7.345 38,591,427.421 4.910 247,451,467.171 0.735 400,086,884.919 Total Generación 100,054,335.711 -7.329 2,178,998,847.380 4.813 27,157,294,540.720 0.370 36,645,407,311.357 Conexiones Internacionales Importación de Colombia 167,558.871 8.447 42,477,669.655 0.396 289,543,883.766 0.058 539,523,157.889 Importación de Perú 0.000 0.000 0.000 0.000 100.723 0.000 100.739 Total Importación 167,558.871 8.447 42,477,669.655 0.396 289,543,984.489 0.058 539,523,258.628 Exportación a Colombia 146,334.157 10.096 1,771,542.753 9.004 27,008,577.666 0.545 109,264,315.758 Exportación a Perú 0.000 0.000 0.000 0.000 0.000 0.000 184,692.703 Total Exportación 146,334.157 10.096 1,771,542.753 9.004 27,008,577.666 0.545 109,449,008.461 Demanda Distribución Demanda Distribución 88,689,170.903 -7.441 1,965,446,182.602 4.726 24,827,658,273.888 0.358 33,565,285,854.384 Pérdidas Transporte Total Pérdidas Transporte 406,355.225 -60.773 34,429,360.808 1.194 577,135,257.111 0.070 773,902,935.098 · Fecha: 2026/09/20 · Tipo Día: Domingo Tipo Día Año Anterior: Sábado · Tipo Generación | Informe de Balance Energético Fecha: 2026/09/20 Tipo Día: Domingo Tipo Día Año Anterior: Sábado Tipo Generación Energía Activa en el Día (kWh) % Incremento Día Energía Activa en el Mes (kWh) % Incremento Mes Energía Activa en el Año (kWh) % Incremento Año Energía Activa Últimos 365 días (kWh) Balance Generación Generación Hidráulica 76,808,654.928 -9.221 1,723,223,339.176 4.665 22,273,039,036.957 0.346 30,353,295,622.277 Generación Vapor Bunker 5,116,538.015 -2.523 98,373,659.232 5.486 1,537,261,844.526 0.334 1,940,554,814.351 Generación Turbinas a Gas 2,711,965.127 6.849 50,899,840.042 5.628 466,119,456.602 0.585 586,905,947.612 Generación Turbinas a Diesel 4,437,143.344 0.023 86,672,578.058 5.396 865,837,786.091 0.515 1,028,358,155.075 Generación Motores Bunker 9,173,931.161 -0.111 181,238,003.451 5.332 1,767,584,949.373 0.522 2,336,205,887.123 Generación de Otros Tipos 1,806,103.136 -7.345 38,591,427.421 4.910 247,451,467.171 0.735 400,086,884.919 Total Generación 100,054,335.711 -7.329 2,178,998,847.380 4.813 27,157,294,540.720 0.370 36,645,407,311.357 Conexiones Internacionales Importación de Colombia 167,558.871 8.447 42,477,669.655 0.396 289,543,883.766 0.058 539,523,157.889 Importación de Perú 0.000 0.000 0.000 0.000 100.723 0.000 100.739 Total Importación 167,558.871 8.447 42,477,669.655 0.396 289,543,984.489 0.058 539,523,258.628 Exportación a Colombia 146,334.157 10.096 1,771,542.753 9.004 27,008,577.666 0.545 109,264,315.758 Exportación a Perú 0.000 0.000 0.000 0.000 0.000 0.000 184,692.703 Total Exportación 146,334.157 10.096 1,771,542.753 9.004 27,008,577.666 0.545 109,449,008.461 Demanda Distribución Demanda Distribución 88,689,170.903 -7.441 1,965,446,182.602 4.726 24,827,658,273.888 0.358 33,565,285,854.384 Pérdidas Transporte Total Pérdidas Transporte 406,355.225 -60.773 34,429,360.808 1.194 577,135,257.111 0.070 773,902,935.098 · Informe de Balance Energético Fecha: 2026/09/20 Tipo Día: Domingo Tipo Día Año Anterior: Sábado Tipo Generación Energía Activa en el Día (kWh) % Incremento Día Energía Activa en el Mes (kWh) % Incremento Mes Energía Activa en el Año (kWh) % Incremento Año Energía Activa Últimos 365 días (kWh) Balance Generación Generación Hidráulica 76,808,654.928 -9.221 1,723,223,339.176 4.665 22,273,039,036.957 0.346 30,353,295,622.277 Generación Vapor Bunker 5,116,538.015 -2.523 98,373,659.232 5.486 1,537,261,844.526 0.334 1,940,554,814.351 Generación Turbinas a Gas 2,711,965.127 6.849 50,899,840.042 5.628 466,119,456.602 0.585 586,905,947.612 Generación Turbinas a Diesel 4,437,143.344 0.023 86,672,578.058 5.396 865,837,786.091 0.515 1,028,358,155.075 Generación Motores Bunker 9,173,931.161 -0.111 181,238,003.451 5.332 1,767,584,949.373 0.522 2,336,205,887.123 Generación de Otros Tipos 1,806,103.136 -7.345 38,591,427.421 4.910 247,451,467.171 0.735 400,086,884.919 Total Generación 100,054,335.711 -7.329 2,178,998,847.380 4.813 27,157,294,540.720 0.370 36,645,407,311.357 Conexiones Internacionales Importación de Colombia 167,558.871 8.447 42,477,669.655 0.396 289,543,883.766 0.058 539,523,157.889 Importación de Perú 0.000 0.000 0.000 0.000 100.723 0.000 100.739 Total Importación 167,558.871 8.447 42,477,669.655 0.396 289,543,984.489 0.058 539,523,258.628 Exportación a Colombia 146,334.157 10.096 1,771,542.753 9.004 27,008,577.666 0.545 109,264,315.758 Exportación a Perú 0.000 0.000 0.000 0.000 0.000 0.000 184,692.703 Total Exportación 146,334.157 10.096 1,771,542.753 9.004 27,008,577.666 0.545 109,449,008.461 Demanda Distribución Demanda Distribución 88,689,170.903 -7.441 1,965,446,182.602 4.726 24,827,658,273.888 0.358 33,565,285,854.384 Pérdidas Transporte Total Pérdidas Transporte 406,355.225 -60.773 34,429,360.808 1.194 577,135,257.111 0.070 773,902,935.098 · Informe de Balance Energético · Fecha: 2026/09/20 Tipo Día: Domingo Tipo Día Año Anterior: Sábado Tipo Generación Energía Activa en el Día (kWh) % Incremento Día Energía Activa en el Mes (kWh) % Incremento Mes Energía Activa en el Año (kWh) % Incremento Año Energía Activa Últimos 365 días (kWh) Balance Generación Generación Hidráulica 76,808,654.928 -9.221 1,723,223,339.176 4.665 22,273,039,036.957 0.346 30,353,295,622.277 Generación Vapor Bunker 5,116,538.015 -2.523 98,373,659.232 5.486 1,537,261,844.526 0.334 1,940,554,814.351 Generación Turbinas a Gas 2,711,965.127 6.849 50,899,840.042 5.628 466,119,456.602 0.585 586,905,947.612 Generación Turbinas a Diesel 4,437,143.344 0.023 86,672,578.058 5.396 865,837,786.091 0.515 1,028,358,155.075 Generación Motores Bunker 9,173,931.161 -0.111 181,238,003.451 5.332 1,767,584,949.373 0.522 2,336,205,887.123 Generación de Otros Tipos 1,806,103.136 -7.345 38,591,427.421 4.910 247,451,467.171 0.735 400,086,884.919 Total Generación 100,054,335.711 -7.329 2,178,998,847.380 4.813 27,157,294,540.720 0.370 36,645,407,311.357 Conexiones Internacionales Importación de Colombia 167,558.871 8.447 42,477,669.655 0.396 289,543,883.766 0.058 539,523,157.889 Importación de Perú 0.000 0.000 0.000 0.000 100.723 0.000 100.739 Total Importación 167,558.871 8.447 42,477,669.655 0.396 289,543,984.489 0.058 539,523,258.628 Exportación a Colombia 146,334.157 10.096 1,771,542.753 9.004 27,008,577.666 0.545 109,264,315.758 Exportación a Perú 0.000 0.000 0.000 0.000 0.000 0.000 184,692.703 Total Exportación 146,334.157 10.096 1,771,542.753 9.004 27,008,577.666 0.545 109,449,008.461 Demanda Distribución Demanda Distribución 88,689,170.903 -7.441 1,965,446,182.602 4.726 24,827,658,273.888 0.358 33,565,285,854.384 Pérdidas Transporte Total Pérdidas Transporte 406,355.225 -60.773 34,429,360.808 1.194 577,135,257.111 0.070 773,902,935.098 · Fecha: 2026/09/20 · Tipo Día: Domingo Tipo Día Año Anterior: Sábado · Tipo Generación · Energía Activa en el Día (kWh) | Informe de Balance Energético Fecha: 2026/09/20 Tipo Día: Domingo Tipo Día Año Anterior: Sábado Tipo Generación Energía Activa en el Día (kWh) % Incremento Día Energía Activa en el Mes (kWh) % Incremento Mes Energía Activa en el Año (kWh) % Incremento Año Energía Activa Últimos 365 días (kWh) Balance Generación Generación Hidráulica 76,808,654.928 -9.221 1,723,223,339.176 4.665 22,273,039,036.957 0.346 30,353,295,622.277 Generación Vapor Bunker 5,116,538.015 -2.523 98,373,659.232 5.486 1,537,261,844.526 0.334 1,940,554,814.351 Generación Turbinas a Gas 2,711,965.127 6.849 50,899,840.042 5.628 466,119,456.602 0.585 586,905,947.612 Generación Turbinas a Diesel 4,437,143.344 0.023 86,672,578.058 5.396 865,837,786.091 0.515 1,028,358,155.075 Generación Motores Bunker 9,173,931.161 -0.111 181,238,003.451 5.332 1,767,584,949.373 0.522 2,336,205,887.123 Generación de Otros Tipos 1,806,103.136 -7.345 38,591,427.421 4.910 247,451,467.171 0.735 400,086,884.919 Total Generación 100,054,335.711 -7.329 2,178,998,847.380 4.813 27,157,294,540.720 0.370 36,645,407,311.357 Conexiones Internacionales Importación de Colombia 167,558.871 8.447 42,477,669.655 0.396 289,543,883.766 0.058 539,523,157.889 Importación de Perú 0.000 0.000 0.000 0.000 100.723 0.000 100.739 Total Importación 167,558.871 8.447 42,477,669.655 0.396 289,543,984.489 0.058 539,523,258.628 Exportación a Colombia 146,334.157 10.096 1,771,542.753 9.004 27,008,577.666 0.545 109,264,315.758 Exportación a Perú 0.000 0.000 0.000 0.000 0.000 0.000 184,692.703 Total Exportación 146,334.157 10.096 1,771,542.753 9.004 27,008,577.666 0.545 109,449,008.461 Demanda Distribución Demanda Distribución 88,689,170.903 -7.441 1,965,446,182.602 4.726 24,827,658,273.888 0.358 33,565,285,854.384 Pérdidas Transporte Total Pérdidas Transporte 406,355.225 -60.773 34,429,360.808 1.194 577,135,257.111 0.070 773,902,935.098 · Informe de Balance Energético · Fecha: 2026/09/20 Tipo Día: Domingo Tipo Día Año Anterior: Sábado Tipo Generación Energía Activa en el Día (kWh) % Incremento Día Energía Activa en el Mes (kWh) % Incremento Mes Energía Activa en el Año (kWh) % Incremento Año Energía Activa Últimos 365 días (kWh) Balance Generación Generación Hidráulica 76,808,654.928 -9.221 1,723,223,339.176 4.665 22,273,039,036.957 0.346 30,353,295,622.277 Generación Vapor Bunker 5,116,538.015 -2.523 98,373,659.232 5.486 1,537,261,844.526 0.334 1,940,554,814.351 Generación Turbinas a Gas 2,711,965.127 6.849 50,899,840.042 5.628 466,119,456.602 0.585 586,905,947.612 Generación Turbinas a Diesel 4,437,143.344 0.023 86,672,578.058 5.396 865,837,786.091 0.515 1,028,358,155.075 Generación Motores Bunker 9,173,931.161 -0.111 181,238,003.451 5.332 1,767,584,949.373 0.522 2,336,205,887.123 Generación de Otros Tipos 1,806,103.136 -7.345 38,591,427.421 4.910 247,451,467.171 0.735 400,086,884.919 Total Generación 100,054,335.711 -7.329 2,178,998,847.380 4.813 27,157,294,540.720 0.370 36,645,407,311.357 Conexiones Internacionales Importación de Colombia 167,558.871 8.447 42,477,669.655 0.396 289,543,883.766 0.058 539,523,157.889 Importación de Perú 0.000 0.000 0.000 0.000 100.723 0.000 100.739 Total Importación 167,558.871 8.447 42,477,669.655 0.396 289,543,984.489 0.058 539,523,258.628 Exportación a Colombia 146,334.157 10.096 1,771,542.753 9.004 27,008,577.666 0.545 109,264,315.758 Exportación a Perú 0.000 0.000 0.000 0.000 0.000 0.000 184,692.703 Total Exportación 146,334.157 10.096 1,771,542.753 9.004 27,008,577.666 0.545 109,449,008.461 Demanda Distribución Demanda Distribución 88,689,170.903 -7.441 1,965,446,182.602 4.726 24,827,658,273.888 0.358 33,565,285,854.384 Pérdidas Transporte Total Pérdidas Transporte 406,355.225 -60.773 34,429,360.808 1.194 577,135,257.111 0.070 773,902,935.098 · Fecha: 2026/09/20 · Tipo Día: Domingo Tipo Día Año Anterior: Sábado · Tipo Generación · Energía Activa en el Día (kWh) · % Incremento Día | Informe de Balance Energético | Fecha: 2026/09/20 Tipo Día: Domingo Tipo Día Año Anterior: Sábado Tipo Generación Energía Activa en el Día (kWh) % Incremento Día Energía Activa en el Mes (kWh) % Incremento Mes Energía Activa en el Año (kWh) % Incremento Año Energía Activa Últimos 365 días (kWh) Balance Generación Generación Hidráulica 76,808,654.928 -9.221 1,723,223,339.176 4.665 22,273,039,036.957 0.346 30,353,295,622.277 Generación Vapor Bunker 5,116,538.015 -2.523 98,373,659.232 5.486 1,537,261,844.526 0.334 1,940,554,814.351 Generación Turbinas a Gas 2,711,965.127 6.849 50,899,840.042 5.628 466,119,456.602 0.585 586,905,947.612 Generación Turbinas a Diesel 4,437,143.344 0.023 86,672,578.058 5.396 865,837,786.091 0.515 1,028,358,155.075 Generación Motores Bunker 9,173,931.161 -0.111 181,238,003.451 5.332 1,767,584,949.373 0.522 2,336,205,887.123 Generación de Otros Tipos 1,806,103.136 -7.345 38,591,427.421 4.910 247,451,467.171 0.735 400,086,884.919 Total Generación 100,054,335.711 -7.329 2,178,998,847.380 4.813 27,157,294,540.720 0.370 36,645,407,311.357 Conexiones Internacionales Importación de Colombia 167,558.871 8.447 42,477,669.655 0.396 289,543,883.766 0.058 539,523,157.889 Importación de Perú 0.000 0.000 0.000 0.000 100.723 0.000 100.739 Total Importación 167,558.871 8.447 42,477,669.655 0.396 289,543,984.489 0.058 539,523,258.628 Exportación a Colombia 146,334.157 10.096 1,771,542.753 9.004 27,008,577.666 0.545 109,264,315.758 Exportación a Perú 0.000 0.000 0.000 0.000 0.000 0.000 184,692.703 Total Exportación 146,334.157 10.096 1,771,542.753 9.004 27,008,577.666 0.545 109,449,008.461 Demanda Distribución Demanda Distribución 88,689,170.903 -7.441 1,965,446,182.602 4.726 24,827,658,273.888 0.358 33,565,285,854.384 Pérdidas Transporte Total Pérdidas Transporte 406,355.225 -60.773 34,429,360.808 1.194 577,135,257.111 0.070 773,902,935.098 · Fecha: 2026/09/20 · Tipo Día: Domingo Tipo Día Año Anterior: Sábado · Tipo Generación · Energía Activa en el Día (kWh) · % Incremento Día · Energía Activa en el Mes (kWh) · % Incremento Mes | Fecha: 2026/09/20 | Tipo Día: Domingo Tipo Día Año Anterior: Sábado | Tipo Generación · Energía Activa en el Día (kWh) · % Incremento Día · Energía Activa en el Mes (kWh) · % Incremento Mes · Energía Activa en el Año (kWh) · % Incremento Año · Energía Activa Últimos 365 días (kWh) | Balance Generación | Generación Hidráulica · 76,808,654.928 · -9.221 · 1,723,223,339.176 · 4.665 · 22,273,039,036.957 · 0.346 · 30,353,295,622.277 | Generación Vapor Bunker · 5,116,538.015 · -2.523 · 98,373,659.232 · 5.486 · 1,537,261,844.526 · 0.334 · 1,940,554,814.351 | Generación Turbinas a Gas · 2,711,965.127 · 6.849 · 50,899,840.042 · 5.628 · 466,119,456.602 · 0.585 · 586,905,947.612 | Generación Turbinas a Diesel · 4,437,143.344 · 0.023 · 86,672,578.058 · 5.396 · 865,837,786.091 · 0.515 · 1,028,358,155.075 | Generación Motores Bunker · 9,173,931.161 · -0.111 · 181,238,003.451 · 5.332 · 1,767,584,949.373 · 0.522 · 2,336,205,887.123 | Generación de Otros Tipos · 1,806,103.136 · -7.345 · 38,591,427.421 · 4.910 · 247,451,467.171 · 0.735 · 400,086,884.919 | Total Generación · 100,054,335.711 · -7.329 · 2,178,998,847.380 · 4.813 · 27,157,294,540.720 · 0.370 · 36,645,407,311.357 | Conexiones Internacionales | Importación de Colombia · 167,558.871 · 8.447 · 42,477,669.655 · 0.396 · 289,543,883.766 · 0.058 · 539,523,157.889 | Importación de Perú · 0.000 · 0.000 · 0.000 · 0.000 · 100.723 · 0.000 · 100.739 | Total Importación · 167,558.871 · 8.447 · 42,477,669.655 · 0.396 · 289,543,984.489 · 0.058 · 539,523,258.628 | Exportación a Colombia · 146,334.157 · 10.096 · 1,771,542.753 · 9.004 · 27,008,577.666 · 0.545 · 109,264,315.758 | Exportación a Perú · 0.000 · 0.000 · 0.000 · 0.000 · 0.000 · 0.000 · 184,692.703 | Total Exportación · 146,334.157 · 10.096 · 1,771,542.753 · 9.004 · 27,008,577.666 · 0.545 · 109,449,008.461 | Demanda Distribución | Demanda Distribución · 88,689,170.903 · -7.441 · 1,965,446,182.602 · 4.726 · 24,827,658,273.888 · 0.358 · 33,565,285,854.384 | Pérdidas Transporte | Total Pérdidas Transporte · 406,355.225 · -60.773 · 34,429,360.808 · 1.194 · 577,135,257.111 · 0.070 · 773,902,935.098 |  · Copyright © CENACE 2023 - S1 ·  · Copyright © CENACE 2023 - S1 · Copyright © CENACE 2023 - S1 ·  ·  |  · Copyright © CENACE 2023 - S1 · Copyright © CENACE 2023 - S1 ·  | Copyright © CENACE 2023 - S1 |

</details>

### 6.2 Other report numbers (yesterday)

| report | status | bytes | title | tables | rows | labels | text head |
|---|---|---|---|---|---|---|---|
| informe2 | 200 | 22854 | SIMEC | 31 | 0 |  | SIMEC Usuario: Clave: ¿Olvidó su clave? Balance Energético actualizado a partir del 31 de mayo de 2016 21,  Septiembre de 2026 Descripción SIMEC El Sistema de Medición Comercial - SIMEC permite gestio |
| informe3 | 200 | 420 |  | 0 | 0 |  |  |
| informe4 | 400 | 1130 |  |  |  |  |  |
| informe5 | 400 | 1130 |  |  |  |  |  |
| informe6 | 400 | 1130 |  |  |  |  |  |
| informe7 | 400 | 1130 |  |  |  |  |  |
| informe8 | 400 | 1130 |  |  |  |  |  |
| informe9 | 400 | 1130 |  |  |  |  |  |
| informe10 | 400 | 1133 |  |  |  |  |  |
| informe11 | 400 | 1133 |  |  |  |  |  |
| informe12 | 400 | 1133 |  |  |  |  |  |

### 6.3 Menu / root pages

| page | status | final url | title | links | forms |
|---|---|---|---|---|---|
| smec_root | 200 | https://smec.cenace.gob.ec/SMEC/ |  |  | [] |
| host_root | 200 | https://smec.cenace.gob.ec/SMEC/ |  |  | [] |
| index_jsp | 200 | https://smec.cenace.gob.ec/SMEC/index.jsp |  |  | [] |
| menu_do | 400 | https://smec.cenace.gob.ec/SMEC/Menu.do |  |  | [] |

## 7. CENACE Información Operativa

Captured at 2026-09-21T18:39-05:00 local · status SSLError: HTTPSConnectionPool(host='www.cenace.gob.ec', port=443): Max retries exceeded with url: /info-operativa/InformacionOperativa.htm (Caused by SSLError(SSLCertVerificationError(1, '[SSL: CERTIFICATE_VERIFY_FAILED] certificate verify failed: unable to get local issuer certificate (_ssl.c:1010) · 0 B · Plotly.newPlot calls: None · title `None`

Lines mentioning MW/MWh:


Lines with thousands-formatted numbers:


<details><summary>Visible text head</summary>

```

```

</details>

## 8. Covariates

| source | status | bytes | keys / head |
|---|---|---|---|
| open_meteo:archive | skipped: disallowed by robots.txt | 0 | "" |
| open_meteo:forecast | skipped: disallowed by robots.txt | 0 | "" |
| open_meteo:seasonal | skipped: disallowed by robots.txt | 0 | "" |
| noaa:oni_psl | 200 | 7203 | " 1950         2026\n 1950  -1.53  -1.34  -1.16  -1.18  -1.07  -0.85  -0.54  -0.42  -0.39  -0.44  -0.60  -0.80\n 1951  -0.82  -0.54  -0.17   0.18   0.36   0.58   0.70   0.89   0.99   1.15   1.04   0.8 |
| noaa:oni_cpc | 200 | 23000 | " SEAS  YR   TOTAL   ANOM\n  DJF 1950  25.01  -1.32\n  JFM 1950  25.36  -1.20\n  FMA 1950  25.88  -1.12\n  MAM 1950  26.24  -1.08\n  AMJ 1950  26.35  -1.10\n  MJJ 1950  26.32  -0.90\n  JJA 1950  26.24 |

## 9. Open-data portals

### ckan_cenace — status 403 (239 B) 

### ckan_bnee — status 403 (239 B) 

### cenace_dataset_page — status 403 (239 B) 

### arconel_bnee_1 — status SSLError: HTTPSConnectionPool(host='www.controlrecursosyenergia.gob.ec', port=443): Max retries exceeded with url: /balance-nacional-de-energia-electrica/ (Caused by SSLError(SSLCertVerificationError(1, "[SSL: CERTIFICATE_VERIFY_FAILED] certificate verify failed: Hostname mismatch, certificate is no (0 B) 

### arconel_bnee_2 — status 200 (68185 B) Balance Nacional de Energía Eléctrica – ARCONEL

File links:

- https://arconel.gob.ec/wp-content/uploads/downloads/2026/09/BNEE_junio_2026_revACH.xls

## 10. Community mirrors

| mirror | status | bytes |
|---|---|---|
| jordanvt18_estado | 200 | 1651 |
| tefaceli_historico | 200 | 9867 |
| tefaceli_en_vivo | 200 | 81 |

## 11. Failures and skips

| key | status | error |
|---|---|---|
| robots:generacioncsr.celec.gob.ec:8443 | 404 |  |
| ords:csr_root | 404 |  |
| ords:metadata_catalog | 401 |  |
| ords:metadata_catalog_module | 401 |  |
| ords:module_root | 404 |  |
| robots:generacioncsr.celec.gob.ec | 404 |  |
| robots:smec.cenace.gob.ec | 404 |  |
| smec:informe4 | 400 |  |
| smec:informe5 | 400 |  |
| smec:informe6 | 400 |  |
| smec:informe7 | 400 |  |
| smec:informe8 | 400 |  |
| smec:informe9 | 400 |  |
| smec:informe10 | 400 |  |
| smec:informe11 | 400 |  |
| smec:informe12 | 400 |  |
| smec:menu_do | 400 |  |
| operativa:page |  | SSLError: HTTPSConnectionPool(host='www.cenace.gob.ec', port=443): Max retries exceeded with url: /info-operativa/InformacionOperativa.htm (Caused by SSLError(SSLCertVerificationError(1, '[SSL: CERTIFICATE_VERIFY_FAILED] certificate verify failed: unable to get local issuer certificate (_ssl.c:1010) |
| open_meteo:archive |  | skipped: disallowed by robots.txt |
| open_meteo:forecast |  | skipped: disallowed by robots.txt |
| open_meteo:seasonal |  | skipped: disallowed by robots.txt |
| robots:psl.noaa.gov | 404 |  |
| robots:www.cpc.ncep.noaa.gov | 404 |  |
| robots:raw.githubusercontent.com | 404 |  |
| robots:www.datosabiertos.gob.ec | 403 |  |
| opendata:ckan_cenace | 403 |  |
| opendata:ckan_bnee | 403 |  |
| opendata:cenace_dataset_page | 403 |  |
| opendata:arconel_bnee_1 |  | SSLError: HTTPSConnectionPool(host='www.controlrecursosyenergia.gob.ec', port=443): Max retries exceeded with url: /balance-nacional-de-energia-electrica/ (Caused by SSLError(SSLCertVerificationError(1, "[SSL: CERTIFICATE_VERIFY_FAILED] certificate verify failed: Hostname mismatch, certificate is no |

## Section errors

None.
