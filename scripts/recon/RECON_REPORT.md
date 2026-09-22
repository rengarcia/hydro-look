# Phase 0 reconnaissance report

Generated 2026-09-22T00:10:43+00:00 (UTC) · 2026-09-21T19:10:43-05:00 (Ecuador) · started 2026-09-22T00:05:25+00:00 · 212 requests.

Raw responses: `tests/fixtures/` (gzipped when large). Structured findings: `tests/fixtures/recon/findings.json`. Full log: `tests/fixtures/recon/capture_log.json`.

## 1. Every request

| key | status | bytes | s | saved | error |
|---|---|---|---|---|---|
| robots:generacioncsr.celec.gob.ec:8443 | 404 | 0 |  | robots/generacioncsr.celec.gob.ec_8443.txt |  |
| ords:matrix:ours_legacy_adapter | 200 | 2093 | 0.76 | tests/fixtures/celec_ords/matrix_ours_legacy_adapter.json |  |
| ords:matrix:ours_verified | 200 | 2093 | 0.85 | tests/fixtures/celec_ords/matrix_ours_verified.json |  |
| ords:matrix:ours_accept_json | 200 | 2093 | 1.02 | tests/fixtures/celec_ords/matrix_ours_accept_json.json |  |
| ords:matrix:requests_default | 200 | 2093 | 0.7 | tests/fixtures/celec_ords/matrix_requests_default.json |  |
| ords:matrix:jordanvt18 | 200 | 2093 | 1.2 | tests/fixtures/celec_ords/matrix_jordanvt18.json |  |
| ords:matrix:browser_like | 200 | 2093 | 0.73 | tests/fixtures/celec_ords/matrix_browser_like.json |  |
| ords:matrix:local_midnight_window | 200 | 2093 | 0.2 | tests/fixtures/celec_ords/matrix_local_midnight_window.json |  |
| ords:mesh24:30031:2026-09 | 200 | 2093 | 0.19 | tests/fixtures/celec_ords/mesh24_30031_2026-09.json |  |
| ords:mesh24:30031:2026-08 | 200 | 2150 | 0.2 | tests/fixtures/celec_ords/mesh24_30031_2026-08.json |  |
| ords:mesh24:30538:2026-09 | 200 | 2093 | 0.18 | tests/fixtures/celec_ords/mesh24_30538_2026-09.json |  |
| ords:mesh24:30538:2026-08 | 200 | 2150 | 0.19 | tests/fixtures/celec_ords/mesh24_30538_2026-08.json |  |
| ords:mesh24:24019:2026-09 | 200 | 2093 | 0.2 | tests/fixtures/celec_ords/mesh24_24019_2026-09.json |  |
| ords:mesh24:24019:2026-08 | 200 | 2150 | 0.18 | tests/fixtures/celec_ords/mesh24_24019_2026-08.json |  |
| ords:mesh24:24811:2026-09 | 200 | 2093 | 0.18 | tests/fixtures/celec_ords/mesh24_24811_2026-09.json |  |
| ords:mesh24:24811:2026-08 | 200 | 2150 | 0.2 | tests/fixtures/celec_ords/mesh24_24811_2026-08.json |  |
| ords:mesh24:90919:2026-09 | 200 | 2093 | 0.19 | tests/fixtures/celec_ords/mesh24_90919_2026-09.json |  |
| ords:mesh24:90919:2026-08 | 200 | 2150 | 0.18 | tests/fixtures/celec_ords/mesh24_90919_2026-08.json |  |
| ords:mesh24:90537:2026-09 | 200 | 2093 | 0.18 | tests/fixtures/celec_ords/mesh24_90537_2026-09.json |  |
| ords:mesh24:90537:2026-08 | 200 | 2150 | 0.18 | tests/fixtures/celec_ords/mesh24_90537_2026-08.json |  |
| ords:hourly:30031:2026-09-20 | 200 | 1745 | 0.18 | tests/fixtures/celec_ords/pointvalues_30031_2026-09-20.json |  |
| ords:hourly:30538:2026-09-20 | 200 | 1745 | 0.18 | tests/fixtures/celec_ords/pointvalues_30538_2026-09-20.json |  |
| ords:earliest:30031:2015-01 | 200 | 2150 | 0.19 | tests/fixtures/celec_ords/mesh24_30031_2015-01.json |  |
| ords:earliest:30031:2016-01 | 200 | 2150 | 0.18 | tests/fixtures/celec_ords/mesh24_30031_2016-01.json |  |
| ords:earliest:30031:2017-01 | 200 | 2150 | 0.19 | tests/fixtures/celec_ords/mesh24_30031_2017-01.json |  |
| ords:earliest:30031:2018-01 | 200 | 2150 | 0.2 | tests/fixtures/celec_ords/mesh24_30031_2018-01.json |  |
| ords:earliest:30031:2019-01 | 200 | 2150 | 0.19 | tests/fixtures/celec_ords/mesh24_30031_2019-01.json |  |
| ords:earliest:30031:2020-01 | 200 | 2150 | 0.19 | tests/fixtures/celec_ords/mesh24_30031_2020-01.json |  |
| ords:earliest:30031:2021-01 | 200 | 2150 | 0.19 | tests/fixtures/celec_ords/mesh24_30031_2021-01.json |  |
| ords:earliest:30031:2022-01 | 200 | 2150 | 0.19 | tests/fixtures/celec_ords/mesh24_30031_2022-01.json |  |
| ords:earliest:30538:2022-01 | 200 | 2150 | 0.18 | tests/fixtures/celec_ords/mesh24_30538_2022-01.json |  |
| ords:earliest:24019:2022-01 | 200 | 2150 | 0.19 | tests/fixtures/celec_ords/mesh24_24019_2022-01.json |  |
| ords:earliest:24811:2022-01 | 200 | 2150 | 0.19 | tests/fixtures/celec_ords/mesh24_24811_2022-01.json |  |
| ords:earliest:90919:2022-01 | 200 | 2150 | 0.2 | tests/fixtures/celec_ords/mesh24_90919_2022-01.json |  |
| ords:earliest:90537:2022-01 | 200 | 2150 | 0.19 | tests/fixtures/celec_ords/mesh24_90537_2022-01.json |  |
| ords:ords_root | 200 | 21378 | 0.39 | tests/fixtures/celec_ords/ords_root.txt |  |
| ords:csr_root | 404 | 16178 | 0.26 | tests/fixtures/celec_ords/csr_root.txt |  |
| ords:metadata_catalog | 401 | 16422 | 0.14 | tests/fixtures/celec_ords/metadata_catalog.txt |  |
| ords:metadata_catalog_module | 401 | 16434 | 0.14 | tests/fixtures/celec_ords/metadata_catalog_module.txt |  |
| ords:module_root | 404 | 16172 | 0.22 | tests/fixtures/celec_ords/module_root.txt |  |
| ords:mesh24_no_params | 200 | 282 | 0.16 | tests/fixtures/celec_ords/mesh24_no_params.txt |  |
| ords:open_api | 200 | 18582 | 0.42 | tests/fixtures/celec_ords/open_api.txt |  |
| ords:openapi:sardomcsr | 200 | 18582 | 0.42 | tests/fixtures/celec_ords/openapi_sardomcsr.json |  |
| ords:openapi:sardommaz | 200 | 2144 | 0.18 | tests/fixtures/celec_ords/openapi_sardommaz.json |  |
| ords:openapi:sardommol | 200 | 2149 | 0.17 | tests/fixtures/celec_ords/openapi_sardommol.json |  |
| ords:openapi:sardomsop | 200 | 2164 | 0.18 | tests/fixtures/celec_ords/openapi_sardomsop.json |  |
| ords:openapi:sardommsf | 200 | 2154 | 0.17 | tests/fixtures/celec_ords/openapi_sardommsf.json |  |
| ords:openapi:sardomago | 200 | 2149 | 0.18 | tests/fixtures/celec_ords/openapi_sardomago.json |  |
| ords:openapi:sardomman | 200 | 2144 | 0.17 | tests/fixtures/celec_ords/openapi_sardomman.json |  |
| ords:openapi:sardomccs | 200 | 2139 | 0.18 | tests/fixtures/celec_ords/openapi_sardomccs.json |  |
| ords:rep:repDiaNivQIng | 200 | 713 | 0.17 | tests/fixtures/celec_ords/ords_rep_repDiaNivQIng.txt |  |
| ords:rep:repDiaPotQTurb | 200 | 760 | 0.18 | tests/fixtures/celec_ords/ords_rep_repDiaPotQTurb.txt |  |
| ords:rep:repDiaHid12m | 200 | 135847 | 0.49 | tests/fixtures/celec_ords/ords_rep_repDiaHid12m.txt |  |
| ords:rep:repDiaEner12m | 200 | 50582 | 0.45 | tests/fixtures/celec_ords/ords_rep_repDiaEner12m.txt |  |
| ords:rep:repDiaEnerAyerHoy | 200 | 798 | 0.21 | tests/fixtures/celec_ords/ords_rep_repDiaEnerAyerHoy.txt |  |
| ords:rep:repDiaRegAyer | 200 | 1006 | 0.51 | tests/fixtures/celec_ords/ords_rep_repDiaRegAyer.txt |  |
| ords:rep:csrEnerDia | 200 | 1821 | 0.18 | tests/fixtures/celec_ords/ords_rep_csrEnerDia.txt |  |
| ords:rep:csrEnerMes | 200 | 2180 | 0.2 | tests/fixtures/celec_ords/ords_rep_csrEnerMes.txt |  |
| ords:rep:csrEstUnidades | 200 | 1540 | 0.17 | tests/fixtures/celec_ords/ords_rep_csrEstUnidades.txt |  |
| ords:rep:csrProdLinea | 200 | 2147 | 14.43 | tests/fixtures/celec_ords/ords_rep_csrProdLinea.txt |  |
| ords:rep:csrProdLineaEnerAll | 200 | 832 | 8.55 | tests/fixtures/celec_ords/ords_rep_csrProdLineaEnerAll.txt |  |
| ords:rep:csrProdLineaEnerDay | 200 | 770 | 0.19 | tests/fixtures/celec_ords/ords_rep_csrProdLineaEnerDay.txt |  |
| ords:rep:csrProdLineaLast2h | 200 | 6423 | 0.2 | tests/fixtures/celec_ords/ords_rep_csrProdLineaLast2h.txt |  |
| ords:rep:csrCaudCuenMesAvg | 200 | 2426 | 2.06 | tests/fixtures/celec_ords/ords_rep_csrCaudCuenMesAvg.txt |  |
| ords:rep:repDiaVolAlm_post | 200 | 412 | 0.16 | tests/fixtures/celec_ords/ords_rep_repDiaVolAlm_post.txt |  |
| ords:ener:maz:dia | 200 | 1713 | 0.16 | tests/fixtures/celec_ords/ords_ener_maz_dia.txt |  |
| ords:ener:maz:mes | 200 | 2156 | 0.17 | tests/fixtures/celec_ords/ords_ener_maz_mes.txt |  |
| ords:ener:mol:dia | 200 | 1813 | 0.17 | tests/fixtures/celec_ords/ords_ener_mol_dia.txt |  |
| ords:ener:mol:mes | 200 | 2180 | 0.18 | tests/fixtures/celec_ords/ords_ener_mol_mes.txt |  |
| ords:ener:sop:dia | 200 | 1815 | 0.17 | tests/fixtures/celec_ords/ords_ener_sop_dia.txt |  |
| ords:ener:sop:mes | 200 | 2169 | 0.17 | tests/fixtures/celec_ords/ords_ener_sop_mes.txt |  |
| ords:ener:msf:dia | 200 | 1674 | 0.16 | tests/fixtures/celec_ords/ords_ener_msf_dia.txt |  |
| ords:ener:msf:mes | 200 | 2054 | 0.18 | tests/fixtures/celec_ords/ords_ener_msf_mes.txt |  |
| ords:ener:ago:dia | 200 | 2033 | 0.17 | tests/fixtures/celec_ords/ords_ener_ago_dia.txt |  |
| ords:ener:ago:mes | 200 | 2155 | 0.21 | tests/fixtures/celec_ords/ords_ener_ago_mes.txt |  |
| ords:ener:man:dia | 200 | 1812 | 0.17 | tests/fixtures/celec_ords/ords_ener_man_dia.txt |  |
| ords:ener:man:mes | 200 | 2021 | 0.24 | tests/fixtures/celec_ords/ords_ener_man_mes.txt |  |
| ords:ener:ccs:dia | 200 | 1885 | 0.17 | tests/fixtures/celec_ords/ords_ener_ccs_dia.txt |  |
| ords:ener:ccs:mes | 200 | 2060 | 0.2 | tests/fixtures/celec_ords/ords_ener_ccs_mes.txt |  |
| ords:mesh24:650919:2026-09 | 200 | 2093 | 0.2 | tests/fixtures/celec_ords/mesh24_650919_2026-09.json |  |
| ords:mesh24:650538:2026-09 | 200 | 2093 | 0.18 | tests/fixtures/celec_ords/mesh24_650538_2026-09.json |  |
| ords:mesh24:140031:2026-09 | 200 | 2093 | 0.19 | tests/fixtures/celec_ords/mesh24_140031_2026-09.json |  |
| ords:mesh24:140537:2026-09 | 200 | 2093 | 0.19 | tests/fixtures/celec_ords/mesh24_140537_2026-09.json |  |
| ords:mesh24:110031:2026-09 | 200 | 2093 | 0.19 | tests/fixtures/celec_ords/mesh24_110031_2026-09.json |  |
| ords:mesh24:110537:2026-09 | 200 | 2093 | 0.19 | tests/fixtures/celec_ords/mesh24_110537_2026-09.json |  |
| ords:mesh24:100540:2026-09 | 200 | 2093 | 0.2 | tests/fixtures/celec_ords/mesh24_100540_2026-09.json |  |
| ords:mesh24:100037:2026-09 | 200 | 2093 | 0.18 | tests/fixtures/celec_ords/mesh24_100037_2026-09.json |  |
| ords:mesh24:24812:2026-09 | 200 | 2093 | 0.19 | tests/fixtures/celec_ords/mesh24_24812_2026-09.json |  |
| ords:mesh24:30503:2026-09 | 200 | 2093 | 0.18 | tests/fixtures/celec_ords/mesh24_30503_2026-09.json |  |
| ords:hist:repDiaHid12m:2025 | 200 | 135584 | 0.62 | tests/fixtures/celec_ords/ords_hist_repDiaHid12m_2025.txt |  |
| ords:hist:repDiaHid12m:2024 | 200 | 135939 | 0.45 | tests/fixtures/celec_ords/ords_hist_repDiaHid12m_2024.txt |  |
| ords:hist:repDiaHid12m:2023 | 200 | 135717 | 0.42 | tests/fixtures/celec_ords/ords_hist_repDiaHid12m_2023.txt |  |
| ords:hist:repDiaHid12m:2022 | 200 | 135971 | 0.43 | tests/fixtures/celec_ords/ords_hist_repDiaHid12m_2022.txt |  |
| ords:hist:repDiaHid12m:2021 | 200 | 135881 | 0.39 | tests/fixtures/celec_ords/ords_hist_repDiaHid12m_2021.txt |  |
| ords:hist:repDiaHid12m:2020 | 200 | 136265 | 0.36 | tests/fixtures/celec_ords/ords_hist_repDiaHid12m_2020.txt |  |
| ords:hist:repDiaHid12m:2018 | 200 | 136609 | 0.34 | tests/fixtures/celec_ords/ords_hist_repDiaHid12m_2018.txt |  |
| ords:hist:repDiaHid12m:2016 | 200 | 137096 | 0.38 | tests/fixtures/celec_ords/ords_hist_repDiaHid12m_2016.txt |  |
| ords:hist:repDiaEner12m:2026-03 | 200 | 49613 | 0.44 | tests/fixtures/celec_ords/ords_hist_repDiaEner12m_2026-03.txt |  |
| ords:hist:repDiaEner12m:2025-03 | 200 | 47788 | 0.66 | tests/fixtures/celec_ords/ords_hist_repDiaEner12m_2025-03.txt |  |
| ords:hist:repDiaEner12m:2024-03 | 200 | 48262 | 0.56 | tests/fixtures/celec_ords/ords_hist_repDiaEner12m_2024-03.txt |  |
| ords:hist:repDiaEner12m:2023-03 | 200 | 48200 | 0.52 | tests/fixtures/celec_ords/ords_hist_repDiaEner12m_2023-03.txt |  |
| ords:hist:repDiaEner12m:2022-03 | 200 | 48487 | 0.61 | tests/fixtures/celec_ords/ords_hist_repDiaEner12m_2022-03.txt |  |
| ords:hist:repDiaEner12m:2021-03 | 200 | 48384 | 0.6 | tests/fixtures/celec_ords/ords_hist_repDiaEner12m_2021-03.txt |  |
| ords:hist:repDiaNivQIng:15-10-2024 | 200 | 707 | 0.17 | tests/fixtures/celec_ords/ords_hist_repDiaNivQIng_15-10-2024.txt |  |
| ords:hist:repDiaNivQIng:15-01-2022 | 200 | 709 | 0.17 | tests/fixtures/celec_ords/ords_hist_repDiaNivQIng_15-01-2022.txt |  |
| ords:hist:repDiaNivQIng:15-06-2019 | 200 | 711 | 0.73 | tests/fixtures/celec_ords/ords_hist_repDiaNivQIng_15-06-2019.txt |  |
| ords:hist:repDiaNivQIng:15-06-2016 | 200 | 599 | 0.18 | tests/fixtures/celec_ords/ords_hist_repDiaNivQIng_15-06-2016.txt |  |
| ords:hist:repDiaPotQTurb:15-10-2024 | 200 | 746 | 0.2 | tests/fixtures/celec_ords/ords_hist_repDiaPotQTurb_15-10-2024.txt |  |
| ords:hist:repDiaPotQTurb:15-01-2022 | 200 | 769 | 0.21 | tests/fixtures/celec_ords/ords_hist_repDiaPotQTurb_15-01-2022.txt |  |
| ords:hist:repDiaPotQTurb:15-06-2019 | 200 | 760 | 0.21 | tests/fixtures/celec_ords/ords_hist_repDiaPotQTurb_15-06-2019.txt |  |
| ords:hist:repDiaPotQTurb:15-06-2016 | 200 | 644 | 0.21 | tests/fixtures/celec_ords/ords_hist_repDiaPotQTurb_15-06-2016.txt |  |
| ords:hist:repDiaEnerAyerHoy:15-10-2024 | 200 | 784 | 0.2 | tests/fixtures/celec_ords/ords_hist_repDiaEnerAyerHoy_15-10-2024.txt |  |
| ords:hist:repDiaEnerAyerHoy:15-01-2022 | 200 | 795 | 0.2 | tests/fixtures/celec_ords/ords_hist_repDiaEnerAyerHoy_15-01-2022.txt |  |
| ords:hist:repDiaEnerAyerHoy:15-06-2019 | 200 | 786 | 0.19 | tests/fixtures/celec_ords/ords_hist_repDiaEnerAyerHoy_15-06-2019.txt |  |
| ords:hist:repDiaEnerAyerHoy:15-06-2016 | 200 | 765 | 0.25 | tests/fixtures/celec_ords/ords_hist_repDiaEnerAyerHoy_15-06-2016.txt |  |
| ords:hist:repDiaRegAyer:15-10-2024 | 200 | 1008 | 1.73 | tests/fixtures/celec_ords/ords_hist_repDiaRegAyer_15-10-2024.txt |  |
| ords:hist:repDiaRegAyer:15-01-2022 | 200 | 1000 | 0.35 | tests/fixtures/celec_ords/ords_hist_repDiaRegAyer_15-01-2022.txt |  |
| ords:hist:repDiaRegAyer:15-06-2019 | 200 | 1053 | 1.44 | tests/fixtures/celec_ords/ords_hist_repDiaRegAyer_15-06-2019.txt |  |
| ords:hist:repDiaRegAyer:15-06-2016 | 200 | 996 | 0.78 | tests/fixtures/celec_ords/ords_hist_repDiaRegAyer_15-06-2016.txt |  |
| ords:hist:mazEnerDia:15-10-2024 | 200 | 1659 | 0.18 | tests/fixtures/celec_ords/ords_hist_mazEnerDia_15-10-2024.txt |  |
| ords:hist:mazEnerDia:15-01-2022 | 200 | 1795 | 0.18 | tests/fixtures/celec_ords/ords_hist_mazEnerDia_15-01-2022.txt |  |
| ords:hist:mazEnerDia:15-06-2019 | 200 | 1804 | 0.18 | tests/fixtures/celec_ords/ords_hist_mazEnerDia_15-06-2019.txt |  |
| ords:hist:molEnerDia:15-10-2024 | 200 | 1737 | 0.18 | tests/fixtures/celec_ords/ords_hist_molEnerDia_15-10-2024.txt |  |
| ords:hist:molEnerDia:15-01-2022 | 200 | 1813 | 0.18 | tests/fixtures/celec_ords/ords_hist_molEnerDia_15-01-2022.txt |  |
| ords:hist:molEnerDia:15-06-2019 | 200 | 1815 | 0.18 | tests/fixtures/celec_ords/ords_hist_molEnerDia_15-06-2019.txt |  |
| ords:hist:sopEnerDia:15-10-2024 | 200 | 1739 | 0.18 | tests/fixtures/celec_ords/ords_hist_sopEnerDia_15-10-2024.txt |  |
| ords:hist:sopEnerDia:15-01-2022 | 200 | 1814 | 0.18 | tests/fixtures/celec_ords/ords_hist_sopEnerDia_15-01-2022.txt |  |
| ords:hist:sopEnerDia:15-06-2019 | 200 | 1817 | 0.18 | tests/fixtures/celec_ords/ords_hist_sopEnerDia_15-06-2019.txt |  |
| ords:hist:msfEnerDia:15-10-2024 | 200 | 1679 | 0.2 | tests/fixtures/celec_ords/ords_hist_msfEnerDia_15-10-2024.txt |  |
| ords:hist:msfEnerDia:15-01-2022 | 200 | 1663 | 0.18 | tests/fixtures/celec_ords/ords_hist_msfEnerDia_15-01-2022.txt |  |
| ords:hist:msfEnerDia:15-06-2019 | 200 | 1601 | 0.18 | tests/fixtures/celec_ords/ords_hist_msfEnerDia_15-06-2019.txt |  |
| ords:hist:agoEnerDia:15-10-2024 | 200 | 2024 | 0.19 | tests/fixtures/celec_ords/ords_hist_agoEnerDia_15-10-2024.txt |  |
| ords:hist:agoEnerDia:15-01-2022 | 200 | 1820 | 0.18 | tests/fixtures/celec_ords/ords_hist_agoEnerDia_15-01-2022.txt |  |
| ords:hist:agoEnerDia:15-06-2019 | 200 | 1819 | 0.18 | tests/fixtures/celec_ords/ords_hist_agoEnerDia_15-06-2019.txt |  |
| ords:hist:manEnerDia:15-10-2024 | 200 | 1727 | 0.19 | tests/fixtures/celec_ords/ords_hist_manEnerDia_15-10-2024.txt |  |
| ords:hist:manEnerDia:15-01-2022 | 200 | 1802 | 0.18 | tests/fixtures/celec_ords/ords_hist_manEnerDia_15-01-2022.txt |  |
| ords:hist:manEnerDia:15-06-2019 | 200 | 1817 | 0.21 | tests/fixtures/celec_ords/ords_hist_manEnerDia_15-06-2019.txt |  |
| ords:hist:ccsEnerDia:15-10-2024 | 200 | 1868 | 0.18 | tests/fixtures/celec_ords/ords_hist_ccsEnerDia_15-10-2024.txt |  |
| ords:hist:ccsEnerDia:15-01-2022 | 200 | 1866 | 0.19 | tests/fixtures/celec_ords/ords_hist_ccsEnerDia_15-01-2022.txt |  |
| ords:hist:ccsEnerDia:15-06-2019 | 200 | 1870 | 0.19 | tests/fixtures/celec_ords/ords_hist_ccsEnerDia_15-06-2019.txt |  |
| ords:hist:repDiaVolAlm:2024-10-15 | 200 | 413 | 0.18 | tests/fixtures/celec_ords/ords_hist_repDiaVolAlm_2024-10-15.txt |  |
| ords:hist:csrCaudCuenAniosAvg | 200 | 1937 | 2.28 | tests/fixtures/celec_ords/ords_hist_csrCaudCuenAniosAvg.txt |  |
| ords:hist:mesh24_recheck_30031 | 200 | 2093 | 0.2 | tests/fixtures/celec_ords/mesh24_recheck_30031.json |  |
| robots:generacioncsr.celec.gob.ec | 404 | 0 |  | robots/generacioncsr.celec.gob.ec.txt |  |
| web:celec_wide:index | 200 | 910 | 0.13 | tests/fixtures/celec_web/celec_wide_index.html |  |
| web:celec_wide:runtime-es2015.17457c14264390561f33.js | 200 | 1485 | 0.13 | tests/fixtures/celec_web/celec_wide/runtime-es2015.17457c14264390561f33.js |  |
| web:celec_wide:runtime-es5.17457c14264390561f33.js | 200 | 1485 | 0.13 | tests/fixtures/celec_web/celec_wide/runtime-es5.17457c14264390561f33.js |  |
| web:celec_wide:polyfills-es5.1460e12205482c371a4c.js | 200 | 132965 | 0.5 | tests/fixtures/celec_web/celec_wide/polyfills-es5.1460e12205482c371a4c.js |  |
| web:celec_wide:polyfills-es2015.c8d9fd53a40f4ff61e6e.js | 200 | 37670 | 0.13 | tests/fixtures/celec_web/celec_wide/polyfills-es2015.c8d9fd53a40f4ff61e6e.js |  |
| web:celec_wide:scripts.d5cb97c61d24c303c034.js | 200 | 341089 | 0.49 | tests/fixtures/celec_web/celec_wide/scripts.d5cb97c61d24c303c034.js.gz |  |
| web:celec_wide:main-es2015.bb8d1c1f9fb35745e7e5.js | 200 | 1042099 | 0.5 | tests/fixtures/celec_web/celec_wide/main-es2015.bb8d1c1f9fb35745e7e5.js.gz |  |
| web:celec_wide:main-es5.bb8d1c1f9fb35745e7e5.js | 200 | 1114294 | 0.38 | tests/fixtures/celec_web/celec_wide/main-es5.bb8d1c1f9fb35745e7e5.js.gz |  |
| web:celec_sur:index | 200 | 922 | 0.13 | tests/fixtures/celec_web/celec_sur_index.html |  |
| web:celec_sur:runtime-es2015.1eba213af0b233498d9d.js | 200 | 1485 | 0.13 | tests/fixtures/celec_web/celec_sur/runtime-es2015.1eba213af0b233498d9d.js |  |
| web:celec_sur:runtime-es5.1eba213af0b233498d9d.js | 200 | 1485 | 0.13 | tests/fixtures/celec_web/celec_sur/runtime-es5.1eba213af0b233498d9d.js |  |
| web:celec_sur:polyfills-es5.84963675a8c97dd2bc1e.js | 200 | 132965 | 0.13 | tests/fixtures/celec_web/celec_sur/polyfills-es5.84963675a8c97dd2bc1e.js |  |
| web:celec_sur:polyfills-es2015.e4277e903aed07751db3.js | 200 | 37670 | 0.13 | tests/fixtures/celec_web/celec_sur/polyfills-es2015.e4277e903aed07751db3.js |  |
| web:celec_sur:scripts.d5cb97c61d24c303c034.js | 200 | 341089 | 0.13 | tests/fixtures/celec_web/celec_sur/scripts.d5cb97c61d24c303c034.js.gz |  |
| web:celec_sur:main-es2015.3f8644f615fd6faf6b00.js | 200 | 990065 | 0.25 | tests/fixtures/celec_web/celec_sur/main-es2015.3f8644f615fd6faf6b00.js.gz |  |
| web:celec_sur:main-es5.3f8644f615fd6faf6b00.js | 200 | 1057250 | 0.14 | tests/fixtures/celec_web/celec_sur/main-es5.3f8644f615fd6faf6b00.js.gz |  |
| robots:smec.cenace.gob.ec | 404 | 0 |  | robots/smec.cenace.gob.ec.txt |  |
| smec:informe1:2026-09-21 | 200 | 8768 | 0.25 | tests/fixtures/cenace_smec/informe1_2026-09-21.html |  |
| smec:informe1:2026-09-20 | 200 | 39354 | 0.37 | tests/fixtures/cenace_smec/informe1_2026-09-20.html |  |
| smec:informe1:2026-09-19 | 200 | 39356 | 0.25 | tests/fixtures/cenace_smec/informe1_2026-09-19.html |  |
| smec:informe1:2024-10-15 | 200 | 39365 | 0.25 | tests/fixtures/cenace_smec/informe1_2024-10-15.html |  |
| smec:informe1:2023-11-05 | 200 | 39378 | 0.25 | tests/fixtures/cenace_smec/informe1_2023-11-05.html |  |
| smec:informe1:2022-01-15 | 200 | 39345 | 0.25 | tests/fixtures/cenace_smec/informe1_2022-01-15.html |  |
| smec:informe1:2021-06-15 | 200 | 39348 | 0.25 | tests/fixtures/cenace_smec/informe1_2021-06-15.html |  |
| smec:informe1:2019-01-15 | 200 | 41404 | 0.25 | tests/fixtures/cenace_smec/informe1_2019-01-15.html |  |
| smec:informe1:2017-01-15 | 200 | 41423 | 0.25 | tests/fixtures/cenace_smec/informe1_2017-01-15.html |  |
| smec:informe1:2016-06-01 | 200 | 41474 | 0.25 | tests/fixtures/cenace_smec/informe1_2016-06-01.html |  |
| smec:informe1:2016-05-31 | 200 | 41499 | 0.25 | tests/fixtures/cenace_smec/informe1_2016-05-31.html |  |
| smec:informe1:2016-05-30 | 200 | 41512 | 0.25 | tests/fixtures/cenace_smec/informe1_2016-05-30.html |  |
| smec:informe1:2016-05-01 | 200 | 39361 | 0.25 | tests/fixtures/cenace_smec/informe1_2016-05-01.html |  |
| smec:informe2 | 200 | 22854 | 0.24 | tests/fixtures/cenace_smec/informe2_2026-09-20.html |  |
| smec:informe3 | 200 | 420 | 0.12 | tests/fixtures/cenace_smec/informe3_2026-09-20.html |  |
| smec:informe4 | 400 | 1130 | 0.12 | tests/fixtures/cenace_smec/informe4_2026-09-20.html |  |
| smec:informe5 | 400 | 1130 | 0.76 | tests/fixtures/cenace_smec/informe5_2026-09-20.html |  |
| smec:informe6 | 400 | 1130 | 0.76 | tests/fixtures/cenace_smec/informe6_2026-09-20.html |  |
| smec:informe7 | 400 | 1130 | 0.83 | tests/fixtures/cenace_smec/informe7_2026-09-20.html |  |
| smec:informe8 | 400 | 1130 | 0.77 | tests/fixtures/cenace_smec/informe8_2026-09-20.html |  |
| smec:informe9 | 400 | 1130 | 0.76 | tests/fixtures/cenace_smec/informe9_2026-09-20.html |  |
| smec:informe10 | 400 | 1133 | 0.76 | tests/fixtures/cenace_smec/informe10_2026-09-20.html |  |
| smec:informe11 | 400 | 1133 | 0.47 | tests/fixtures/cenace_smec/informe11_2026-09-20.html |  |
| smec:informe12 | 400 | 1133 | 0.56 | tests/fixtures/cenace_smec/informe12_2026-09-20.html |  |
| smec:smec_root | 200 | 103 | 0.49 | tests/fixtures/cenace_smec/smec_root.html |  |
| smec:host_root | 200 | 103 | 0.37 | tests/fixtures/cenace_smec/host_root.html |  |
| smec:index_jsp | 200 | 103 | 0.12 | tests/fixtures/cenace_smec/index_jsp.html |  |
| smec:menu_do | 400 | 1091 | 0.12 | tests/fixtures/cenace_smec/menu_do.html |  |
| robots:www.cenace.gob.ec | 200 | 118 |  | robots/www.cenace.gob.ec.txt |  |
| operativa:page | 200 | 266582 | 0.37 | tests/fixtures/cenace_operativa/InformacionOperativa_2026-09-21T1910.html |  |
| open_meteo:archive | 200 | 1060 | 0.63 | tests/fixtures/open_meteo/archive.json |  |
| open_meteo:forecast | 200 | 584 | 0.62 | tests/fixtures/open_meteo/forecast.json |  |
| open_meteo:seasonal | 200 | 55753 | 0.77 | tests/fixtures/open_meteo/seasonal.json |  |
| robots:psl.noaa.gov | 404 | 0 |  | robots/psl.noaa.gov.txt |  |
| noaa:oni_psl | 200 | 7203 | 0.03 | tests/fixtures/noaa/oni_psl.txt |  |
| robots:www.cpc.ncep.noaa.gov | 404 | 0 |  | robots/www.cpc.ncep.noaa.gov.txt |  |
| noaa:oni_cpc | 200 | 23000 | 0.07 | tests/fixtures/noaa/oni_cpc.txt |  |
| robots:raw.githubusercontent.com | 404 | 0 |  | robots/raw.githubusercontent.com.txt |  |
| mirror:jordanvt18_estado | 200 | 1651 | 0.11 | tests/fixtures/mirrors/jordanvt18_estado.json |  |
| mirror:tefaceli_historico | 200 | 9867 | 0.11 | tests/fixtures/mirrors/tefaceli_historico.json |  |
| mirror:tefaceli_en_vivo | 200 | 81 | 0.08 | tests/fixtures/mirrors/tefaceli_en_vivo.json |  |
| robots:www.datosabiertos.gob.ec | 403 | 0 |  | robots/www.datosabiertos.gob.ec.txt |  |
| opendata:ckan_cenace | 403 | 239 | 0.13 | tests/fixtures/open_data/ckan_cenace.json |  |
| robots:datosabiertos.gob.ec | 403 | 0 |  | robots/datosabiertos.gob.ec.txt |  |
| opendata:ckan_cenace_nowww | 403 | 239 | 0.12 | tests/fixtures/open_data/ckan_cenace_nowww.json |  |
| opendata:ckan_bnee | 403 | 239 | 0.13 | tests/fixtures/open_data/ckan_bnee.json |  |
| opendata:cenace_dataset_page | 403 | 239 | 0.13 | tests/fixtures/open_data/cenace_dataset_page.html |  |
| robots:www.controlrecursosyenergia.gob.ec | error: SSLError | 0 |  | robots/www.controlrecursosyenergia.gob.ec.txt |  |
| opendata:arconel_bnee_1 |  | 0 | 0.87 |  | SSLError: HTTPSConnectionPool(host='www.controlrecursosyenergia.gob.ec', port=443): Max retries exceeded with url: /balance-nacional-de-energia-electrica/ (Caused by SSLError(SSLCertVerificationError(1, "[SSL: CERTIFICATE_VERIFY_FAILED] certificate verify failed: Hostname mismatch, certificate is no |
| robots:arconel.gob.ec | 200 | 164 |  | robots/arconel.gob.ec.txt |  |
| opendata:arconel_bnee_2 | 200 | 68185 | 2.09 | tests/fixtures/open_data/arconel_bnee_2.html |  |

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
| https://generacioncsr.celec.gob.ec:8443/ords/csr/open-api-catalog/sardomcsr/ | True | no robots.txt |
| https://generacioncsr.celec.gob.ec:8443/ords/csr/open-api-catalog/sardommaz/ | True | no robots.txt |
| https://generacioncsr.celec.gob.ec:8443/ords/csr/open-api-catalog/sardommol/ | True | no robots.txt |
| https://generacioncsr.celec.gob.ec:8443/ords/csr/open-api-catalog/sardomsop/ | True | no robots.txt |
| https://generacioncsr.celec.gob.ec:8443/ords/csr/open-api-catalog/sardommsf/ | True | no robots.txt |
| https://generacioncsr.celec.gob.ec:8443/ords/csr/open-api-catalog/sardomago/ | True | no robots.txt |
| https://generacioncsr.celec.gob.ec:8443/ords/csr/open-api-catalog/sardomman/ | True | no robots.txt |
| https://generacioncsr.celec.gob.ec:8443/ords/csr/open-api-catalog/sardomccs/ | True | no robots.txt |
| https://generacioncsr.celec.gob.ec:8443/ords/csr/sardomcsr/repDiaNivQIng | True | no robots.txt |
| https://generacioncsr.celec.gob.ec:8443/ords/csr/sardomcsr/repDiaPotQTurb | True | no robots.txt |
| https://generacioncsr.celec.gob.ec:8443/ords/csr/sardomcsr/repDiaHid12m | True | no robots.txt |
| https://generacioncsr.celec.gob.ec:8443/ords/csr/sardomcsr/repDiaEner12m | True | no robots.txt |
| https://generacioncsr.celec.gob.ec:8443/ords/csr/sardomcsr/repDiaEnerAyerHoy | True | no robots.txt |
| https://generacioncsr.celec.gob.ec:8443/ords/csr/sardomcsr/repDiaRegAyer | True | no robots.txt |
| https://generacioncsr.celec.gob.ec:8443/ords/csr/sardomcsr/csrEnerDia | True | no robots.txt |
| https://generacioncsr.celec.gob.ec:8443/ords/csr/sardomcsr/csrEnerMes | True | no robots.txt |
| https://generacioncsr.celec.gob.ec:8443/ords/csr/sardomcsr/csrEstUnidades | True | no robots.txt |
| https://generacioncsr.celec.gob.ec:8443/ords/csr/sardomcsr/csrProdLinea | True | no robots.txt |
| https://generacioncsr.celec.gob.ec:8443/ords/csr/sardomcsr/csrProdLineaEnerAll | True | no robots.txt |
| https://generacioncsr.celec.gob.ec:8443/ords/csr/sardomcsr/csrProdLineaEnerDay | True | no robots.txt |
| https://generacioncsr.celec.gob.ec:8443/ords/csr/sardomcsr/csrProdLineaLast2h | True | no robots.txt |
| https://generacioncsr.celec.gob.ec:8443/ords/csr/sardomcsr/csrCaudCuenMesAvg | True | no robots.txt |
| https://generacioncsr.celec.gob.ec:8443/ords/csr/sardomcsr/repDiaVolAlm | True | no robots.txt |
| https://generacioncsr.celec.gob.ec:8443/ords/csr/sardommaz/mazEnerDia | True | no robots.txt |
| https://generacioncsr.celec.gob.ec:8443/ords/csr/sardommaz/mazEnerMes | True | no robots.txt |
| https://generacioncsr.celec.gob.ec:8443/ords/csr/sardommol/molEnerDia | True | no robots.txt |
| https://generacioncsr.celec.gob.ec:8443/ords/csr/sardommol/molEnerMes | True | no robots.txt |
| https://generacioncsr.celec.gob.ec:8443/ords/csr/sardomsop/sopEnerDia | True | no robots.txt |
| https://generacioncsr.celec.gob.ec:8443/ords/csr/sardomsop/sopEnerMes | True | no robots.txt |
| https://generacioncsr.celec.gob.ec:8443/ords/csr/sardommsf/msfEnerDia | True | no robots.txt |
| https://generacioncsr.celec.gob.ec:8443/ords/csr/sardommsf/msfEnerMes | True | no robots.txt |
| https://generacioncsr.celec.gob.ec:8443/ords/csr/sardomago/agoEnerDia | True | no robots.txt |
| https://generacioncsr.celec.gob.ec:8443/ords/csr/sardomago/agoEnerMes | True | no robots.txt |
| https://generacioncsr.celec.gob.ec:8443/ords/csr/sardomman/manEnerDia | True | no robots.txt |
| https://generacioncsr.celec.gob.ec:8443/ords/csr/sardomman/manEnerMes | True | no robots.txt |
| https://generacioncsr.celec.gob.ec:8443/ords/csr/sardomccs/ccsEnerDia | True | no robots.txt |
| https://generacioncsr.celec.gob.ec:8443/ords/csr/sardomccs/ccsEnerMes | True | no robots.txt |
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
| https://generacioncsr.celec.gob.ec:8443/ords/csr/sardomcsr/repDiaHid12m | True | no robots.txt |
| https://generacioncsr.celec.gob.ec:8443/ords/csr/sardomcsr/repDiaHid12m | True | no robots.txt |
| https://generacioncsr.celec.gob.ec:8443/ords/csr/sardomcsr/repDiaHid12m | True | no robots.txt |
| https://generacioncsr.celec.gob.ec:8443/ords/csr/sardomcsr/repDiaHid12m | True | no robots.txt |
| https://generacioncsr.celec.gob.ec:8443/ords/csr/sardomcsr/repDiaHid12m | True | no robots.txt |
| https://generacioncsr.celec.gob.ec:8443/ords/csr/sardomcsr/repDiaHid12m | True | no robots.txt |
| https://generacioncsr.celec.gob.ec:8443/ords/csr/sardomcsr/repDiaHid12m | True | no robots.txt |
| https://generacioncsr.celec.gob.ec:8443/ords/csr/sardomcsr/repDiaHid12m | True | no robots.txt |
| https://generacioncsr.celec.gob.ec:8443/ords/csr/sardomcsr/repDiaEner12m | True | no robots.txt |
| https://generacioncsr.celec.gob.ec:8443/ords/csr/sardomcsr/repDiaEner12m | True | no robots.txt |
| https://generacioncsr.celec.gob.ec:8443/ords/csr/sardomcsr/repDiaEner12m | True | no robots.txt |
| https://generacioncsr.celec.gob.ec:8443/ords/csr/sardomcsr/repDiaEner12m | True | no robots.txt |
| https://generacioncsr.celec.gob.ec:8443/ords/csr/sardomcsr/repDiaEner12m | True | no robots.txt |
| https://generacioncsr.celec.gob.ec:8443/ords/csr/sardomcsr/repDiaEner12m | True | no robots.txt |
| https://generacioncsr.celec.gob.ec:8443/ords/csr/sardomcsr/repDiaNivQIng | True | no robots.txt |
| https://generacioncsr.celec.gob.ec:8443/ords/csr/sardomcsr/repDiaNivQIng | True | no robots.txt |
| https://generacioncsr.celec.gob.ec:8443/ords/csr/sardomcsr/repDiaNivQIng | True | no robots.txt |
| https://generacioncsr.celec.gob.ec:8443/ords/csr/sardomcsr/repDiaNivQIng | True | no robots.txt |
| https://generacioncsr.celec.gob.ec:8443/ords/csr/sardomcsr/repDiaPotQTurb | True | no robots.txt |
| https://generacioncsr.celec.gob.ec:8443/ords/csr/sardomcsr/repDiaPotQTurb | True | no robots.txt |
| https://generacioncsr.celec.gob.ec:8443/ords/csr/sardomcsr/repDiaPotQTurb | True | no robots.txt |
| https://generacioncsr.celec.gob.ec:8443/ords/csr/sardomcsr/repDiaPotQTurb | True | no robots.txt |
| https://generacioncsr.celec.gob.ec:8443/ords/csr/sardomcsr/repDiaEnerAyerHoy | True | no robots.txt |
| https://generacioncsr.celec.gob.ec:8443/ords/csr/sardomcsr/repDiaEnerAyerHoy | True | no robots.txt |
| https://generacioncsr.celec.gob.ec:8443/ords/csr/sardomcsr/repDiaEnerAyerHoy | True | no robots.txt |
| https://generacioncsr.celec.gob.ec:8443/ords/csr/sardomcsr/repDiaEnerAyerHoy | True | no robots.txt |
| https://generacioncsr.celec.gob.ec:8443/ords/csr/sardomcsr/repDiaRegAyer | True | no robots.txt |
| https://generacioncsr.celec.gob.ec:8443/ords/csr/sardomcsr/repDiaRegAyer | True | no robots.txt |
| https://generacioncsr.celec.gob.ec:8443/ords/csr/sardomcsr/repDiaRegAyer | True | no robots.txt |
| https://generacioncsr.celec.gob.ec:8443/ords/csr/sardomcsr/repDiaRegAyer | True | no robots.txt |
| https://generacioncsr.celec.gob.ec:8443/ords/csr/sardommaz/mazEnerDia | True | no robots.txt |
| https://generacioncsr.celec.gob.ec:8443/ords/csr/sardommaz/mazEnerDia | True | no robots.txt |
| https://generacioncsr.celec.gob.ec:8443/ords/csr/sardommaz/mazEnerDia | True | no robots.txt |
| https://generacioncsr.celec.gob.ec:8443/ords/csr/sardommol/molEnerDia | True | no robots.txt |
| https://generacioncsr.celec.gob.ec:8443/ords/csr/sardommol/molEnerDia | True | no robots.txt |
| https://generacioncsr.celec.gob.ec:8443/ords/csr/sardommol/molEnerDia | True | no robots.txt |
| https://generacioncsr.celec.gob.ec:8443/ords/csr/sardomsop/sopEnerDia | True | no robots.txt |
| https://generacioncsr.celec.gob.ec:8443/ords/csr/sardomsop/sopEnerDia | True | no robots.txt |
| https://generacioncsr.celec.gob.ec:8443/ords/csr/sardomsop/sopEnerDia | True | no robots.txt |
| https://generacioncsr.celec.gob.ec:8443/ords/csr/sardommsf/msfEnerDia | True | no robots.txt |
| https://generacioncsr.celec.gob.ec:8443/ords/csr/sardommsf/msfEnerDia | True | no robots.txt |
| https://generacioncsr.celec.gob.ec:8443/ords/csr/sardommsf/msfEnerDia | True | no robots.txt |
| https://generacioncsr.celec.gob.ec:8443/ords/csr/sardomago/agoEnerDia | True | no robots.txt |
| https://generacioncsr.celec.gob.ec:8443/ords/csr/sardomago/agoEnerDia | True | no robots.txt |
| https://generacioncsr.celec.gob.ec:8443/ords/csr/sardomago/agoEnerDia | True | no robots.txt |
| https://generacioncsr.celec.gob.ec:8443/ords/csr/sardomman/manEnerDia | True | no robots.txt |
| https://generacioncsr.celec.gob.ec:8443/ords/csr/sardomman/manEnerDia | True | no robots.txt |
| https://generacioncsr.celec.gob.ec:8443/ords/csr/sardomman/manEnerDia | True | no robots.txt |
| https://generacioncsr.celec.gob.ec:8443/ords/csr/sardomccs/ccsEnerDia | True | no robots.txt |
| https://generacioncsr.celec.gob.ec:8443/ords/csr/sardomccs/ccsEnerDia | True | no robots.txt |
| https://generacioncsr.celec.gob.ec:8443/ords/csr/sardomccs/ccsEnerDia | True | no robots.txt |
| https://generacioncsr.celec.gob.ec:8443/ords/csr/sardomcsr/repDiaVolAlm | True | no robots.txt |
| https://generacioncsr.celec.gob.ec:8443/ords/csr/sardomcsr/csrCaudCuenAniosAvg | True | no robots.txt |
| https://generacioncsr.celec.gob.ec:8443/ords/csr/sardomcsr/pointValuesMesH24 | True | no robots.txt |
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
| https://www.cenace.gob.ec/info-operativa/InformacionOperativa.htm | True | can_fetch(ua)=True can_fetch(*)=True |
| https://psl.noaa.gov/data/correlation/oni.data | True | no robots.txt |
| https://www.cpc.ncep.noaa.gov/data/indices/oni.ascii.txt | True | no robots.txt |
| https://raw.githubusercontent.com/jordanvt18/cotas-embalses-ecuador/main/docs/estado.json | True | no robots.txt |
| https://raw.githubusercontent.com/tefaceli/scraper-mazar/main/data/historico.json | True | no robots.txt |
| https://raw.githubusercontent.com/tefaceli/scraper-mazar/main/data/en_vivo.json | True | no robots.txt |
| https://www.datosabiertos.gob.ec/api/3/action/package_search?fq=organization:cenace&rows=100 | True | no robots.txt |
| https://datosabiertos.gob.ec/api/3/action/package_search?fq=organization:cenace&rows=100 | True | no robots.txt |
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

## 4a. ORDS request-style matrix

Month: 2026-09 · winner: **None**

| variant | status | items | non-null | min | max | error |
|---|---|---|---|---|---|---|
| ours_legacy_adapter | 200 | 30 | 0 |  |  |  |
| ours_verified | 200 | 30 | 0 |  |  |  |
| ours_accept_json | 200 | 30 | 0 |  |  |  |
| requests_default | 200 | 30 | 0 |  |  |  |
| jordanvt18 | 200 | 30 | 0 |  |  |  |
| browser_like | 200 | 30 | 0 |  |  |  |
| local_midnight_window | 200 | 30 | 0 |  |  |  |

## 4b. ORDS OpenAPI catalog per module

| module | method | path | params |
|---|---|---|---|
| sardomcsr | GET | /csrCaudCuenAnioAvg | fecha, fechaFin, fechaInicio |
| sardomcsr | GET | /csrCaudCuenAniosAvg | fechaFin, fechaInicio |
| sardomcsr | GET | /csrCaudCuenMesAvg | fecha, fechaFin, fechaInicio |
| sardomcsr | GET | /csrEnerAnio | fecha |
| sardomcsr | GET | /csrEnerAnios | fecha |
| sardomcsr | GET | /csrEnerDia | fecha |
| sardomcsr | GET | /csrEnerMes | fecha |
| sardomcsr | GET | /csrEstUnidades |  |
| sardomcsr | GET | /csrProdLinea |  |
| sardomcsr | GET | /csrProdLineaEnerAll |  |
| sardomcsr | GET | /csrProdLineaEnerDay |  |
| sardomcsr | GET | /csrProdLineaLast2h |  |
| sardomcsr | GET | /pointValues | fecha, fechaFin, fechaInicio, mrid |
| sardomcsr | GET | /pointValuesAnio | fecha, fechaFin, fechaInicio, mrid |
| sardomcsr | GET | /pointValuesAnioAvg | fecha, fechaFin, fechaInicio, mrid |
| sardomcsr | GET | /pointValuesAnioH24 | fecha, fechaFin, fechaInicio, mrid |
| sardomcsr | GET | /pointValuesAnios | fechaFin, fechaInicio, mrid |
| sardomcsr | GET | /pointValuesAniosAvg | fechaFin, fechaInicio, mrid |
| sardomcsr | GET | /pointValuesAniosH24 | fechaFin, fechaInicio, mrid |
| sardomcsr | GET | /pointValuesMes | fecha, fechaFin, fechaInicio, mrid |
| sardomcsr | GET | /pointValuesMesAvg | fecha, fechaFin, fechaInicio, mrid |
| sardomcsr | GET | /pointValuesMesH24 | fecha, fechaFin, fechaInicio, mrid |
| sardomcsr | GET | /repDiaEner12m | fecha |
| sardomcsr | GET | /repDiaEnerAyerHoy | fecha |
| sardomcsr | POST | /repDiaFactPlanta | v_loctimestamp, payload |
| sardomcsr | GET | /repDiaHid12m | fecha |
| sardomcsr | POST | /repDiaMttos | v_loctimestamp, v_reporte_mrid, payload |
| sardomcsr | GET | /repDiaNivQIng | fecha |
| sardomcsr | GET | /repDiaPotQTurb | fecha |
| sardomcsr | GET | /repDiaRegAyer | fecha |
| sardomcsr | POST | /repDiaVolAlm | v_loctimestamp |
| sardomcsr | POST | /repMesFactDisp | v_central, v_loctimestamp, payload |
| sardommaz | GET | /mazEnerAnio | fecha |
| sardommaz | GET | /mazEnerAnios | fecha |
| sardommaz | GET | /mazEnerDia | fecha |
| sardommaz | GET | /mazEnerMes | fecha |
| sardommol | GET | /molEnerAnio | fecha |
| sardommol | GET | /molEnerAnios | fecha |
| sardommol | GET | /molEnerDia | fecha |
| sardommol | GET | /molEnerMes | fecha |
| sardomsop | GET | /sopEnerAnio | fecha |
| sardomsop | GET | /sopEnerAnios | fecha |
| sardomsop | GET | /sopEnerDia | fecha |
| sardomsop | GET | /sopEnerMes | fecha |
| sardommsf | GET | /msfEnerAnio | fecha |
| sardommsf | GET | /msfEnerAnios | fecha |
| sardommsf | GET | /msfEnerDia | fecha |
| sardommsf | GET | /msfEnerMes | fecha |
| sardomago | GET | /agoEnerAnio | fecha |
| sardomago | GET | /agoEnerAnios | fecha |
| sardomago | GET | /agoEnerDia | fecha |
| sardomago | GET | /agoEnerMes | fecha |
| sardomman | GET | /manEnerAnio | fecha |
| sardomman | GET | /manEnerAnios | fecha |
| sardomman | GET | /manEnerDia | fecha |
| sardomman | GET | /manEnerMes | fecha |
| sardomccs | GET | /ccsEnerAnio | fecha |
| sardomccs | GET | /ccsEnerAnios | fecha |
| sardomccs | GET | /ccsEnerDia | fecha |
| sardomccs | GET | /ccsEnerMes | fecha |

## 4c. ORDS report and per-plant energy endpoints

| endpoint | status | items | item keys | sample / head |
|---|---|---|---|---|
| ords:rep:repDiaNivQIng | 200 | 4 | embalse, fecha, nivel, q_ingresado | [{"fecha": "2026-09-20T05:00:00Z", "embalse": "Minas San Francisco", "nivel": 790.31, "q_ingresado": 34.7126056}, {"fecha": "2026-09-20T05:00:00Z", "embalse": "Mazar", "nivel": 2139.1, "q_ingresado": 75.26382815}, {"fecha": "2026-09-20T05:00:00Z", "embalse": "Amaluza", "nivel": 1985.3032227, "q_ingr |
| ords:rep:repDiaPotQTurb | 200 | 4 | central, fecha, potencia, q_turbinado, unidlinea | [{"fecha": "2026-09-20T05:00:00Z", "central": "Minas San Francisco", "potencia": 202.28, "unidlinea": 3, "q_turbinado": 48.8}, {"fecha": "2026-09-20T05:00:00Z", "central": "Mazar", "potencia": 0, "unidlinea": null, "q_turbinado": 0}, {"fecha": "2026-09-20T05:00:00Z", "central": "Molino", "potencia": |
| ords:rep:repDiaHid12m | 200 | 365 | limdel, limmaz, limmol, limmsf, loctimestamp, min_del, min_maz, min_mol, min_msf, niveldel, nivelmaz, nivelmol, nivelmsf, q_ingresadodel, q_ingresadomaz, q_ingresadomol, q_ingresadomsf, qmax_del, qmax_maz, qmax_mol, qmax_msf | [{"loctimestamp": "2025-09-20T05:00:00Z", "nivelmsf": 787.14, "q_ingresadomsf": 25, "limmsf": 793, "min_msf": 750, "qmax_msf": 600, "nivelmaz": 2152.21, "q_ingresadomaz": 55, "limmaz": 2153, "min_maz": 2100, "qmax_maz": 800, "nivelmol": 1989.27, "q_ingresadomol": 81, "limmol": 1991, "min_mol": 1960, |
| ords:rep:repDiaEner12m | 200 | 184 | enerala, enerdel, enermaz, enermol, enermsf, enersop, loctimestamp, maxenerala, maxenerdel, maxenermaz, maxenermol, maxenermsf, maxenersop | [{"loctimestamp": "2026-03-20T05:00:00Z", "enermsf": 6155.95, "enermaz": 2895.226364, "enermol": 19471.644158, "enersop": 7519.966613, "enerdel": 2204.27, "enerala": 98.050068, "maxenermsf": 25000, "maxenermaz": 25000, "maxenermol": 25000, "maxenersop": 25000, "maxenerdel": 25000, "maxenerala": 500} |
| ords:rep:repDiaEnerAyerHoy | 200 | 5 | central, enerayer, enerplanhoy, fecha | [{"fecha": "2026-09-19T05:00:00Z", "central": "Minas", "enerayer": 3168.24, "enerplanhoy": 2538.91738}, {"fecha": "2026-09-19T05:00:00Z", "central": "Mazar", "enerayer": 1002.323421, "enerplanhoy": 1040}, {"fecha": "2026-09-19T05:00:00Z", "central": "Molino", "enerayer": 13393.9087829, "enerplanhoy" |
| ords:rep:repDiaRegAyer | 200 | 4 | descr, loctimestamp, mazar, minas, molino, sopladora | [{"loctimestamp": "2026-09-20T05:00:00Z", "descr": "Energía Anual Acum. (GWh)", "minas": 866, "mazar": 556, "molino": 4062, "sopladora": 2065}, {"loctimestamp": "2026-09-20T05:00:00Z", "descr": "Volumen Vertido (Hm3)", "minas": 0, "mazar": 0, "molino": 0, "sopladora": 0.187129253}, {"loctimestamp":  |
| ords:rep:csrEnerDia | 200 | 24 | loctimestamp, valueedit | [{"loctimestamp": "2026-09-21T05:00:00Z", "valueedit": 1237.088619}, {"loctimestamp": "2026-09-21T04:00:00Z", "valueedit": 1324.541552}, {"loctimestamp": "2026-09-21T03:00:00Z", "valueedit": 1284.262285}] |
| ords:rep:csrEnerMes | 200 | 30 | loctimestamp, valueedit | [{"loctimestamp": "2026-09-30T05:00:00Z", "valueedit": null}, {"loctimestamp": "2026-09-29T05:00:00Z", "valueedit": null}, {"loctimestamp": "2026-09-28T05:00:00Z", "valueedit": null}] |
| ords:rep:csrEstUnidades | 200 | 22 | central, unidad, valor | [{"central": "Molino", "unidad": "U01", "valor": "En línea"}, {"central": "Molino", "unidad": "U02", "valor": "En reposo"}, {"central": "Molino", "unidad": "U03", "valor": "En línea"}] |
| ords:rep:csrProdLinea | 200 | 25 | id, loctimestamp, valueedit | [{"id": 1, "loctimestamp": "2026-09-21T05:00:00Z", "valueedit": 2166.986801}, {"id": 2, "loctimestamp": "2021-02-04T03:00:00Z", "valueedit": 2142.89}, {"id": 3, "loctimestamp": "2021-01-25T23:00:00Z", "valueedit": 75.35705148}] |
| ords:rep:csrProdLineaEnerAll | 200 | 6 | id, loctimestamp, magnitud, valueedit | [{"id": 4, "loctimestamp": "2026-09-22T00:00:00Z", "valueedit": 11569335.45, "magnitud": "EnerMaz"}, {"id": 8, "loctimestamp": "2026-09-22T00:00:00Z", "valueedit": 191786982, "magnitud": "EnerMol"}, {"id": 12, "loctimestamp": "2026-09-22T00:00:00Z", "valueedit": 23906885.13, "magnitud": "EnerSop"}] |
| ords:rep:csrProdLineaEnerDay | 200 | 5 | id, loctimestamp, magnitud, valueedit | [{"id": 1, "loctimestamp": "2026-09-21T05:00:00Z", "valueedit": 2166.986801, "magnitud": "EnerMaz"}, {"id": 5, "loctimestamp": "2026-09-21T05:00:00Z", "valueedit": 13380.162209, "magnitud": "EnerMol"}, {"id": 9, "loctimestamp": "2026-09-21T05:00:00Z", "valueedit": 7168.505487, "magnitud": "EnerSop"} |
| ords:rep:csrProdLineaLast2h | 200 | 51 | hora, id, loctimestamp, magnitud, units, valueedit | [{"id": 1, "hora": 1, "loctimestamp": "2026-09-22T00:00:00Z", "valueedit": 158.380181, "magnitud": "Energía Diaria", "units": "MWh"}, {"id": 2, "hora": 1, "loctimestamp": "2026-09-21T23:00:00Z", "valueedit": 2138.66, "magnitud": "Nivel Embalse", "units": "m.s.n.m."}, {"id": 3, "hora": 1, "loctimesta |
| ords:rep:csrCaudCuenMesAvg | 200 | 30 | loctimestamp, valueedit | [{"loctimestamp": "2026-09-30T05:00:00Z", "valueedit": null}, {"loctimestamp": "2026-09-29T05:00:00Z", "valueedit": null}, {"loctimestamp": "2026-09-28T05:00:00Z", "valueedit": null}] |
| ords:rep:repDiaVolAlm_post | 200 | 3 | embalse, volact, volembmax, volembmin, volutilalm | [{"embalse": "Minas San Francisco", "volact": 788.74, "volembmax": 792.86, "volembmin": 783.33, "volutilalm": 56.76810073452256}, {"embalse": "Mazar", "volact": 2139.14, "volembmax": 2153, "volembmin": 2100, "volutilalm": 73.84905660377359}, {"embalse": "Amaluza", "volact": 1985.3769531, "volembmax" |
| ords:ener:maz:dia | 200 | 24 | loctimestamp, valueedit | [{"loctimestamp": "2026-09-21T05:00:00Z", "valueedit": 129.774765}, {"loctimestamp": "2026-09-21T04:00:00Z", "valueedit": 129.76292}, {"loctimestamp": "2026-09-21T03:00:00Z", "valueedit": 129.764687}] |
| ords:ener:maz:mes | 200 | 30 | loctimestamp, valueedit | [{"loctimestamp": "2026-09-30T05:00:00Z", "valueedit": null}, {"loctimestamp": "2026-09-29T05:00:00Z", "valueedit": null}, {"loctimestamp": "2026-09-28T05:00:00Z", "valueedit": null}] |
| ords:ener:mol:dia | 200 | 24 | loctimestamp, valueedit | [{"loctimestamp": "2026-09-21T05:00:00Z", "valueedit": 599.178889}, {"loctimestamp": "2026-09-21T04:00:00Z", "valueedit": 578.68916}, {"loctimestamp": "2026-09-21T03:00:00Z", "valueedit": 565.771011}] |
| ords:ener:mol:mes | 200 | 30 | loctimestamp, valueedit | [{"loctimestamp": "2026-09-30T05:00:00Z", "valueedit": null}, {"loctimestamp": "2026-09-29T05:00:00Z", "valueedit": null}, {"loctimestamp": "2026-09-28T05:00:00Z", "valueedit": null}] |
| ords:ener:sop:dia | 200 | 24 | loctimestamp, valueedit | [{"loctimestamp": "2026-09-21T05:00:00Z", "valueedit": 339.884965}, {"loctimestamp": "2026-09-21T04:00:00Z", "valueedit": 345.089472}, {"loctimestamp": "2026-09-21T03:00:00Z", "valueedit": 316.476587}] |
| ords:ener:sop:mes | 200 | 30 | loctimestamp, valueedit | [{"loctimestamp": "2026-09-30T05:00:00Z", "valueedit": null}, {"loctimestamp": "2026-09-29T05:00:00Z", "valueedit": null}, {"loctimestamp": "2026-09-28T05:00:00Z", "valueedit": null}] |
| ords:ener:msf:dia | 200 | 24 | loctimestamp, valueedit | [{"loctimestamp": "2026-09-21T05:00:00Z", "valueedit": 168.25}, {"loctimestamp": "2026-09-21T04:00:00Z", "valueedit": 271}, {"loctimestamp": "2026-09-21T03:00:00Z", "valueedit": 272.25}] |
| ords:ener:msf:mes | 200 | 30 | loctimestamp, valueedit | [{"loctimestamp": "2026-09-30T05:00:00Z", "valueedit": null}, {"loctimestamp": "2026-09-29T05:00:00Z", "valueedit": null}, {"loctimestamp": "2026-09-28T05:00:00Z", "valueedit": null}] |
| ords:ener:ago:dia | 200 | 24 | loctimestamp, valueedit | [{"loctimestamp": "2026-09-21T05:00:00Z", "valueedit": 82.2829317066}, {"loctimestamp": "2026-09-21T04:00:00Z", "valueedit": 101.4759268867}, {"loctimestamp": "2026-09-21T03:00:00Z", "valueedit": 143.6783201451}] |
| ords:ener:ago:mes | 200 | 25 | loctimestamp, valueedit | [{"loctimestamp": "2026-09-30T05:00:00Z", "valueedit": null}, {"loctimestamp": "2026-09-29T05:00:00Z", "valueedit": null}, {"loctimestamp": "2026-09-28T05:00:00Z", "valueedit": null}] |
| ords:ener:man:dia | 200 | 24 | loctimestamp, valueedit | [{"loctimestamp": "2026-09-21T05:00:00Z", "valueedit": 20.49}, {"loctimestamp": "2026-09-21T04:00:00Z", "valueedit": 20.49}, {"loctimestamp": "2026-09-21T03:00:00Z", "valueedit": 20.48}] |
| ords:ener:man:mes | 200 | 25 | loctimestamp, valueedit | [{"loctimestamp": "2026-09-30T05:00:00Z", "valueedit": null}, {"loctimestamp": "2026-09-29T05:00:00Z", "valueedit": null}, {"loctimestamp": "2026-09-28T05:00:00Z", "valueedit": null}] |
| ords:ener:ccs:dia | 200 | 24 | loctimestamp, valueedit | [{"loctimestamp": "2026-09-21T05:00:00Z", "valueedit": 950.912}, {"loctimestamp": "2026-09-21T04:00:00Z", "valueedit": 994.646}, {"loctimestamp": "2026-09-21T03:00:00Z", "valueedit": 1043.043}] |
| ords:ener:ccs:mes | 200 | 25 | loctimestamp, valueedit | [{"loctimestamp": "2026-09-30T05:00:00Z", "valueedit": null}, {"loctimestamp": "2026-09-29T05:00:00Z", "valueedit": null}, {"loctimestamp": "2026-09-28T05:00:00Z", "valueedit": null}] |

## 4d. New mrids from the CELEC-wide bundle (current month, MesH24)

| plant/var/mrid | status | items | non-null | min | max |
|---|---|---|---|---|---|
| Minas San Francisco/cota/650919 | 200 | 30 | 0 |  |  |
| Minas San Francisco/caudal/650538 | 200 | 30 | 0 |  |  |
| Agoyan/cota/140031 | 200 | 30 | 0 |  |  |
| Agoyan/caudal/140537 | 200 | 30 | 0 |  |  |
| Manduriacu/cota/110031 | 200 | 30 | 0 |  |  |
| Manduriacu/caudal/110537 | 200 | 30 | 0 |  |  |
| Coca Codo Sinclair/cota/100540 | 200 | 30 | 0 |  |  |
| Coca Codo Sinclair/caudal/100037 | 200 | 30 | 0 |  |  |
| Paute basin/caudal_cuenca/24812 | 200 | 30 | 0 |  |  |
| Mazar/unidades/30503 | 200 | 30 | 0 |  |  |

## 4e. ORDS history depth of report and energy endpoints

pointValuesMesH24 re-check at 2026-09-22T00:09:03+00:00: non-null = **0**

| endpoint / fecha | status | items | ts min | ts max | numeric cells | first item |
|---|---|---|---|---|---|---|
| ords:hist:repDiaHid12m:2025 | 200 | 365 | 2024-09-20T05:00:00Z | 2025-09-19T05:00:00Z | 7300 | {"loctimestamp": "2024-09-20T05:00:00Z", "nivelmsf": 786.92, "q_ingresadomsf": 11, "limmsf": 793, "min_msf": 750, "qmax_msf": 600, "nivelmaz": 2117.96, "q_ingresadomaz": 9, "limmaz": 2153, "min_maz": 2100, "qmax_maz": 80 |
| ords:hist:repDiaHid12m:2024 | 200 | 366 | 2023-09-20T05:00:00Z | 2024-09-19T05:00:00Z | 7320 | {"loctimestamp": "2023-09-20T05:00:00Z", "nivelmsf": 787.88, "q_ingresadomsf": 8, "limmsf": 793, "min_msf": 750, "qmax_msf": 600, "nivelmaz": 2147.4, "q_ingresadomaz": 25, "limmaz": 2153, "min_maz": 2100, "qmax_maz": 800 |
| ords:hist:repDiaHid12m:2023 | 200 | 365 | 2022-09-20T05:00:00Z | 2023-09-19T05:00:00Z | 7300 | {"loctimestamp": "2022-09-20T05:00:00Z", "nivelmsf": 787.95, "q_ingresadomsf": 12, "limmsf": 793, "min_msf": 750, "qmax_msf": 600, "nivelmaz": 2149.29, "q_ingresadomaz": 31, "limmaz": 2153, "min_maz": 2100, "qmax_maz": 8 |
| ords:hist:repDiaHid12m:2022 | 200 | 365 | 2021-09-20T05:00:00Z | 2022-09-19T05:00:00Z | 7300 | {"loctimestamp": "2021-09-20T05:00:00Z", "nivelmsf": 788.49, "q_ingresadomsf": 10, "limmsf": 793, "min_msf": 750, "qmax_msf": 600, "nivelmaz": 2148.26, "q_ingresadomaz": 33, "limmaz": 2153, "min_maz": 2100, "qmax_maz": 8 |
| ords:hist:repDiaHid12m:2021 | 200 | 365 | 2020-09-20T05:00:00Z | 2021-09-19T05:00:00Z | 7300 | {"loctimestamp": "2020-09-20T05:00:00Z", "nivelmsf": 791.12, "q_ingresadomsf": 31, "limmsf": 793, "min_msf": 750, "qmax_msf": 600, "nivelmaz": 2146.38, "q_ingresadomaz": 51, "limmaz": 2153, "min_maz": 2100, "qmax_maz": 8 |
| ords:hist:repDiaHid12m:2020 | 200 | 366 | 2019-09-20T05:00:00Z | 2020-09-19T05:00:00Z | 7320 | {"loctimestamp": "2019-09-20T05:00:00Z", "nivelmsf": 788.42, "q_ingresadomsf": 15, "limmsf": 793, "min_msf": 750, "qmax_msf": 600, "nivelmaz": 2151.78, "q_ingresadomaz": 56, "limmaz": 2153, "min_maz": 2100, "qmax_maz": 8 |
| ords:hist:repDiaHid12m:2018 | 200 | 365 | 2017-09-20T05:00:00Z | 2018-09-19T05:00:00Z | 3730 | {"loctimestamp": "2017-09-20T05:00:00Z", "nivelmsf": null, "q_ingresadomsf": null, "limmsf": null, "min_msf": null, "qmax_msf": null, "nivelmaz": 2151.24, "q_ingresadomaz": 30, "limmaz": 2153, "min_maz": 2100, "qmax_maz" |
| ords:hist:repDiaHid12m:2016 | 200 | 366 | 2015-09-20T05:00:00Z | 2016-09-19T05:00:00Z | 3660 | {"loctimestamp": "2015-09-20T05:00:00Z", "nivelmsf": null, "q_ingresadomsf": null, "limmsf": null, "min_msf": null, "qmax_msf": null, "nivelmaz": 2149.3, "q_ingresadomaz": 70, "limmaz": 2153, "min_maz": 2100, "qmax_maz": |
| ords:hist:repDiaEner12m:2026-03 | 200 | 181 | 2025-09-20T05:00:00Z | 2026-03-19T05:00:00Z | 2172 | {"loctimestamp": "2025-09-20T05:00:00Z", "enermsf": 1988.5, "enermaz": 2740.217886, "enermol": 17718.655962, "enersop": 9847.866126, "enerdel": 4126.38, "enerala": 141.602364, "maxenermsf": 25000, "maxenermaz": 25000, "m |
| ords:hist:repDiaEner12m:2025-03 | 200 | 181 | 2024-09-20T05:00:00Z | 2025-03-19T05:00:00Z | 1762 | {"loctimestamp": "2024-09-20T05:00:00Z", "enermsf": 265, "enermaz": 2380.811196, "enermol": 19961.580458, "enersop": 6341.590003, "enerdel": null, "enerala": null, "maxenermsf": 25000, "maxenermaz": 25000, "maxenermol":  |
| ords:hist:repDiaEner12m:2024-03 | 200 | 182 | 2023-09-20T05:00:00Z | 2024-03-19T05:00:00Z | 1456 | {"loctimestamp": "2023-09-20T05:00:00Z", "enermsf": 387.25, "enermaz": 1824.223745, "enermol": 12584.078573, "enersop": 6388.651049, "enerdel": null, "enerala": null, "maxenermsf": 25000, "maxenermaz": 25000, "maxenermol |
| ords:hist:repDiaEner12m:2023-03 | 200 | 181 | 2022-09-20T05:00:00Z | 2023-03-19T05:00:00Z | 1448 | {"loctimestamp": "2022-09-20T05:00:00Z", "enermsf": 859.39, "enermaz": 3160.548689, "enermol": 18371.423717, "enersop": 10022.117184, "enerdel": null, "enerala": null, "maxenermsf": 25000, "maxenermaz": 25000, "maxenermo |
| ords:hist:repDiaEner12m:2022-03 | 200 | 181 | 2021-09-20T05:00:00Z | 2022-03-19T05:00:00Z | 1448 | {"loctimestamp": "2021-09-20T05:00:00Z", "enermsf": 734.52, "enermaz": 2026.993425, "enermol": 12474.416132, "enersop": 6763.670643, "enerdel": null, "enerala": null, "maxenermsf": 25000, "maxenermaz": 25000, "maxenermol |
| ords:hist:repDiaEner12m:2021-03 | 200 | 181 | 2020-09-20T05:00:00Z | 2021-03-19T05:00:00Z | 1448 | {"loctimestamp": "2020-09-20T05:00:00Z", "enermsf": 2095.12, "enermaz": 1821.945103, "enermol": 10121.933625, "enersop": 5260.870777, "enerdel": null, "enerala": null, "maxenermsf": 25000, "maxenermaz": 25000, "maxenermo |
| ords:hist:repDiaNivQIng:15-10-2024 | 200 | 4 | 2024-10-15T05:00:00Z | 2024-10-15T05:00:00Z | 8 | {"fecha": "2024-10-15T05:00:00Z", "embalse": "Minas San Francisco", "nivel": 785.38, "q_ingresado": 12.6308611} |
| ords:hist:repDiaNivQIng:15-01-2022 | 200 | 4 | 2022-01-15T05:00:00Z | 2022-01-15T05:00:00Z | 8 | {"fecha": "2022-01-15T05:00:00Z", "embalse": "Minas San Francisco", "nivel": 790.14, "q_ingresado": 15.76845} |
| ords:hist:repDiaNivQIng:15-06-2019 | 200 | 4 | 2019-06-15T05:00:00Z | 2019-06-15T05:00:00Z | 8 | {"fecha": "2019-06-15T05:00:00Z", "embalse": "Minas San Francisco", "nivel": 786.49, "q_ingresado": 33.5885185} |
| ords:hist:repDiaNivQIng:15-06-2016 | 200 | 3 | 2016-06-15T05:00:00Z | 2016-06-15T05:00:00Z | 5 | {"fecha": "2016-06-15T05:00:00Z", "embalse": "Mazar", "nivel": 2153.81, "q_ingresado": 183.81728491} |
| ords:hist:repDiaPotQTurb:15-10-2024 | 200 | 4 | 2024-10-15T05:00:00Z | 2024-10-15T05:00:00Z | 9 | {"fecha": "2024-10-15T05:00:00Z", "central": "Minas San Francisco", "potencia": 101.55, "unidlinea": 3, "q_turbinado": 35.85} |
| ords:hist:repDiaPotQTurb:15-01-2022 | 200 | 4 | 2022-01-15T05:00:00Z | 2022-01-15T05:00:00Z | 9 | {"fecha": "2022-01-15T05:00:00Z", "central": "Minas San Francisco", "potencia": 0, "unidlinea": 3, "q_turbinado": 0} |
| ords:hist:repDiaPotQTurb:15-06-2019 | 200 | 4 | 2019-06-15T05:00:00Z | 2019-06-15T05:00:00Z | 9 | {"fecha": "2019-06-15T05:00:00Z", "central": "Minas San Francisco", "potencia": 0, "unidlinea": 3, "q_turbinado": 0} |
| ords:hist:repDiaPotQTurb:15-06-2016 | 200 | 3 | 2016-06-15T05:00:00Z | 2016-06-15T05:00:00Z | 5 | {"fecha": "2016-06-15T05:00:00Z", "central": "Mazar", "potencia": 169.1263199, "unidlinea": null, "q_turbinado": 118.18114} |
| ords:hist:repDiaEnerAyerHoy:15-10-2024 | 200 | 5 | 2024-10-14T05:00:00Z | 2024-10-14T05:00:00Z | 10 | {"fecha": "2024-10-14T05:00:00Z", "central": "Minas", "enerayer": 1599.74, "enerplanhoy": 500.8} |
| ords:hist:repDiaEnerAyerHoy:15-01-2022 | 200 | 5 | 2022-01-14T05:00:00Z | 2022-01-14T05:00:00Z | 10 | {"fecha": "2022-01-14T05:00:00Z", "central": "Minas", "enerayer": 483.45, "enerplanhoy": 1439.8} |
| ords:hist:repDiaEnerAyerHoy:15-06-2019 | 200 | 5 | 2019-06-14T05:00:00Z | 2019-06-14T05:00:00Z | 10 | {"fecha": "2019-06-14T05:00:00Z", "central": "Minas", "enerayer": 0, "enerplanhoy": 0} |
| ords:hist:repDiaEnerAyerHoy:15-06-2016 | 200 | 5 | 2016-06-14T05:00:00Z | 2016-06-15T05:00:00Z | 10 | {"fecha": "2016-06-15T05:00:00Z", "central": "Minas", "enerayer": 0, "enerplanhoy": 0} |
| ords:hist:repDiaRegAyer:15-10-2024 | 200 | 4 | 2024-10-15T05:00:00Z | 2024-10-15T05:00:00Z | 16 | {"loctimestamp": "2024-10-15T05:00:00Z", "descr": "Energía Anual Acum. (GWh)", "minas": 669, "mazar": 466, "molino": 3517, "sopladora": 1755} |
| ords:hist:repDiaRegAyer:15-01-2022 | 200 | 4 | 2022-01-15T05:00:00Z | 2022-01-15T05:00:00Z | 16 | {"loctimestamp": "2022-01-15T05:00:00Z", "descr": "Energía Anual Acum. (GWh)", "minas": 23, "mazar": 49, "molino": 249, "sopladora": 130} |
| ords:hist:repDiaRegAyer:15-06-2019 | 200 | 4 | 2019-06-15T05:00:00Z | 2019-06-15T05:00:00Z | 16 | {"loctimestamp": "2019-06-15T05:00:00Z", "descr": "Energía Anual Acum. (GWh)", "minas": 487, "mazar": 342, "molino": 2554, "sopladora": 1096} |
| ords:hist:repDiaRegAyer:15-06-2016 | 200 | 4 | 2016-06-15T05:00:00Z | 2016-06-15T05:00:00Z | 11 | {"loctimestamp": "2016-06-15T05:00:00Z", "descr": "Energía Anual Acum. (GWh)", "minas": null, "mazar": 386, "molino": 2840, "sopladora": 83} |
| ords:hist:mazEnerDia:15-10-2024 | 200 | 24 | 2024-10-15T06:00:00Z | 2024-10-16T05:00:00Z | 24 | {"loctimestamp": "2024-10-16T05:00:00Z", "valueedit": 0} |
| ords:hist:mazEnerDia:15-01-2022 | 200 | 24 | 2022-01-15T06:00:00Z | 2022-01-16T05:00:00Z | 24 | {"loctimestamp": "2022-01-16T05:00:00Z", "valueedit": 65.505113} |
| ords:hist:mazEnerDia:15-06-2019 | 200 | 24 | 2019-06-15T06:00:00Z | 2019-06-16T05:00:00Z | 24 | {"loctimestamp": "2019-06-16T05:00:00Z", "valueedit": 110.035673} |
| ords:hist:molEnerDia:15-10-2024 | 200 | 24 | 2024-10-15T06:00:00Z | 2024-10-16T05:00:00Z | 24 | {"loctimestamp": "2024-10-16T05:00:00Z", "valueedit": 261.434827} |
| ords:hist:molEnerDia:15-01-2022 | 200 | 24 | 2022-01-15T06:00:00Z | 2022-01-16T05:00:00Z | 24 | {"loctimestamp": "2022-01-16T05:00:00Z", "valueedit": 258.50343} |
| ords:hist:molEnerDia:15-06-2019 | 200 | 24 | 2019-06-15T06:00:00Z | 2019-06-16T05:00:00Z | 24 | {"loctimestamp": "2019-06-16T05:00:00Z", "valueedit": 509.090386} |
| ords:hist:sopEnerDia:15-10-2024 | 200 | 24 | 2024-10-15T06:00:00Z | 2024-10-16T05:00:00Z | 24 | {"loctimestamp": "2024-10-16T05:00:00Z", "valueedit": 154.749457} |
| ords:hist:sopEnerDia:15-01-2022 | 200 | 24 | 2022-01-15T06:00:00Z | 2022-01-16T05:00:00Z | 24 | {"loctimestamp": "2022-01-16T05:00:00Z", "valueedit": 135.498441} |
| ords:hist:sopEnerDia:15-06-2019 | 200 | 24 | 2019-06-15T06:00:00Z | 2019-06-16T05:00:00Z | 24 | {"loctimestamp": "2019-06-16T05:00:00Z", "valueedit": 294.081005} |
| ords:hist:msfEnerDia:15-10-2024 | 200 | 24 | 2024-10-15T06:00:00Z | 2024-10-16T05:00:00Z | 24 | {"loctimestamp": "2024-10-16T05:00:00Z", "valueedit": 21.62} |
| ords:hist:msfEnerDia:15-01-2022 | 200 | 24 | 2022-01-15T06:00:00Z | 2022-01-16T05:00:00Z | 24 | {"loctimestamp": "2022-01-16T05:00:00Z", "valueedit": 20.13} |
| ords:hist:msfEnerDia:15-06-2019 | 200 | 24 | 2019-06-15T06:00:00Z | 2019-06-16T05:00:00Z | 24 | {"loctimestamp": "2019-06-16T05:00:00Z", "valueedit": 0} |
| ords:hist:agoEnerDia:15-10-2024 | 200 | 24 | 2024-10-15T06:00:00Z | 2024-10-16T05:00:00Z | 24 | {"loctimestamp": "2024-10-16T05:00:00Z", "valueedit": 77.3830206283} |
| ords:hist:agoEnerDia:15-01-2022 | 200 | 24 | 2022-01-15T06:00:00Z | 2022-01-16T05:00:00Z | 24 | {"loctimestamp": "2022-01-16T05:00:00Z", "valueedit": 145.65} |
| ords:hist:agoEnerDia:15-06-2019 | 200 | 24 | 2019-06-15T06:00:00Z | 2019-06-16T05:00:00Z | 24 | {"loctimestamp": "2019-06-16T05:00:00Z", "valueedit": 95.59} |
| ords:hist:manEnerDia:15-10-2024 | 200 | 24 | 2024-10-15T06:00:00Z | 2024-10-16T05:00:00Z | 24 | {"loctimestamp": "2024-10-16T05:00:00Z", "valueedit": 0} |
| ords:hist:manEnerDia:15-01-2022 | 200 | 24 | 2022-01-15T06:00:00Z | 2022-01-16T05:00:00Z | 24 | {"loctimestamp": "2022-01-16T05:00:00Z", "valueedit": 64} |
| ords:hist:manEnerDia:15-06-2019 | 200 | 24 | 2019-06-15T06:00:00Z | 2019-06-16T05:00:00Z | 24 | {"loctimestamp": "2019-06-16T05:00:00Z", "valueedit": 45} |
| ords:hist:ccsEnerDia:15-10-2024 | 200 | 24 | 2024-10-15T06:00:00Z | 2024-10-16T05:00:00Z | 24 | {"loctimestamp": "2024-10-16T05:00:00Z", "valueedit": 621.154} |
| ords:hist:ccsEnerDia:15-01-2022 | 200 | 24 | 2022-01-15T06:00:00Z | 2022-01-16T05:00:00Z | 24 | {"loctimestamp": "2022-01-16T05:00:00Z", "valueedit": 869.861} |
| ords:hist:ccsEnerDia:15-06-2019 | 200 | 24 | 2019-06-15T06:00:00Z | 2019-06-16T05:00:00Z | 24 | {"loctimestamp": "2019-06-16T05:00:00Z", "valueedit": 686.38} |
| ords:hist:repDiaVolAlm:2024-10-15 | 200 | 3 |  |  | 12 | {"embalse": "Minas San Francisco", "volact": 785.77, "volembmax": 792.86, "volembmin": 783.33, "volutilalm": 25.60335781741868} |
| ords:hist:csrCaudCuenAniosAvg | 200 | 17 | 2010-01-01T05:00:00Z | 2026-01-01T05:00:00Z | 17 | {"loctimestamp": "2026-01-01T05:00:00Z", "valueedit": 112.74875851500789} |

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
| 2026-09-21 | 200 | 8768 | 9 | 1 | Informe de Balance Energético |
| 2026-09-20 | 200 | 39354 | 9 | 15 | Informe de Balance Energético |
| 2026-09-19 | 200 | 39356 | 9 | 15 | Informe de Balance Energético |
| 2024-10-15 | 200 | 39365 | 9 | 15 | Informe de Balance Energético |
| 2023-11-05 | 200 | 39378 | 9 | 15 | Informe de Balance Energético |
| 2022-01-15 | 200 | 39345 | 9 | 15 | Informe de Balance Energético |
| 2021-06-15 | 200 | 39348 | 9 | 15 | Informe de Balance Energético |
| 2019-01-15 | 200 | 41404 | 9 | 16 | Informe de Balance Energético |
| 2017-01-15 | 200 | 41423 | 9 | 16 | Informe de Balance Energético |
| 2016-06-01 | 200 | 41474 | 9 | 16 | Informe de Balance Energético |
| 2016-05-31 | 200 | 41499 | 9 | 16 | Informe de Balance Energético |
| 2016-05-30 | 200 | 41512 | 9 | 16 | Informe de Balance Energético |
| 2016-05-01 | 200 | 39361 | 9 | 15 | Informe de Balance Energético |

#### Rows on 2026-09-21

| label | value |
|---|---|
| Total Pérdidas Transporte | 0.000 |

<details><summary>All table rows (first 120)</summary>

| cells |
|---|
|  · Informe de Balance Energético Fecha: 2026/09/21 Tipo Día: Laboral Tipo Día Año Anterior: Domingo Tipo Generación Energía Activa en el Día (kWh) % Incremento Día Energía Activa en el Mes (kWh) % Incremento Mes Energía Activa en el Año (kWh) % Incremento Año Energía Activa Últimos 365 días (kWh) Pérdidas Transporte Total Pérdidas Transporte 0.000 0.000 0.000 0.000 0.000 0.000 0.000 ·  ·  ·  · Informe de Balance Energético Fecha: 2026/09/21 Tipo Día: Laboral Tipo Día Año Anterior: Domingo Tipo Generación Energía Activa en el Día (kWh) % Incremento Día Energía Activa en el Mes (kWh) % Incremento Mes Energía Activa en el Año (kWh) % Incremento Año Energía Activa Últimos 365 días (kWh) Pérdidas Transporte Total Pérdidas Transporte 0.000 0.000 0.000 0.000 0.000 0.000 0.000 · Informe de Balance Energético Fecha: 2026/09/21 Tipo Día: Laboral Tipo Día Año Anterior: Domingo Tipo Generación Energía Activa en el Día (kWh) % Incremento Día Energía Activa en el Mes (kWh) % Incremento Mes Energía Activa en el Año (kWh) % Incremento Año Energía Activa Últimos 365 días (kWh) Pérdidas Transporte Total Pérdidas Transporte 0.000 0.000 0.000 0.000 0.000 0.000 0.000 · Informe de Balance Energético Fecha: 2026/09/21 Tipo Día: Laboral Tipo Día Año Anterior: Domingo Tipo Generación Energía Activa en el Día (kWh) % Incremento Día Energía Activa en el Mes (kWh) % Incremento Mes Energía Activa en el Año (kWh) % Incremento Año Energía Activa Últimos 365 días (kWh) Pérdidas Transporte Total Pérdidas Transporte 0.000 0.000 0.000 0.000 0.000 0.000 0.000 | Informe de Balance Energético Fecha: 2026/09/21 Tipo Día: Laboral Tipo Día Año Anterior: Domingo Tipo Generación Energía Activa en el Día (kWh) % Incremento Día Energía Activa en el Mes (kWh) % Incremento Mes Energía Activa en el Año (kWh) % Incremento Año Energía Activa Últimos 365 días (kWh) Pérdidas Transporte Total Pérdidas Transporte 0.000 0.000 0.000 0.000 0.000 0.000 0.000 · Informe de Balance Energético Fecha: 2026/09/21 Tipo Día: Laboral Tipo Día Año Anterior: Domingo Tipo Generación Energía Activa en el Día (kWh) % Incremento Día Energía Activa en el Mes (kWh) % Incremento Mes Energía Activa en el Año (kWh) % Incremento Año Energía Activa Últimos 365 días (kWh) Pérdidas Transporte Total Pérdidas Transporte 0.000 0.000 0.000 0.000 0.000 0.000 0.000 · Informe de Balance Energético Fecha: 2026/09/21 Tipo Día: Laboral Tipo Día Año Anterior: Domingo Tipo Generación Energía Activa en el Día (kWh) % Incremento Día Energía Activa en el Mes (kWh) % Incremento Mes Energía Activa en el Año (kWh) % Incremento Año Energía Activa Últimos 365 días (kWh) Pérdidas Transporte Total Pérdidas Transporte 0.000 0.000 0.000 0.000 0.000 0.000 0.000 · Informe de Balance Energético · Fecha: 2026/09/21 Tipo Día: Laboral Tipo Día Año Anterior: Domingo Tipo Generación Energía Activa en el Día (kWh) % Incremento Día Energía Activa en el Mes (kWh) % Incremento Mes Energía Activa en el Año (kWh) % Incremento Año Energía Activa Últimos 365 días (kWh) Pérdidas Transporte Total Pérdidas Transporte 0.000 0.000 0.000 0.000 0.000 0.000 0.000 · Fecha: 2026/09/21 · Tipo Día: Laboral Tipo Día Año Anterior: Domingo · Tipo Generación | Informe de Balance Energético Fecha: 2026/09/21 Tipo Día: Laboral Tipo Día Año Anterior: Domingo Tipo Generación Energía Activa en el Día (kWh) % Incremento Día Energía Activa en el Mes (kWh) % Incremento Mes Energía Activa en el Año (kWh) % Incremento Año Energía Activa Últimos 365 días (kWh) Pérdidas Transporte Total Pérdidas Transporte 0.000 0.000 0.000 0.000 0.000 0.000 0.000 · Informe de Balance Energético Fecha: 2026/09/21 Tipo Día: Laboral Tipo Día Año Anterior: Domingo Tipo Generación Energía Activa en el Día (kWh) % Incremento Día Energía Activa en el Mes (kWh) % Incremento Mes Energía Activa en el Año (kWh) % Incremento Año Energía Activa Últimos 365 días (kWh) Pérdidas Transporte Total Pérdidas Transporte 0.000 0.000 0.000 0.000 0.000 0.000 0.000 · Informe de Balance Energético · Fecha: 2026/09/21 Tipo Día: Laboral Tipo Día Año Anterior: Domingo Tipo Generación Energía Activa en el Día (kWh) % Incremento Día Energía Activa en el Mes (kWh) % Incremento Mes Energía Activa en el Año (kWh) % Incremento Año Energía Activa Últimos 365 días (kWh) Pérdidas Transporte Total Pérdidas Transporte 0.000 0.000 0.000 0.000 0.000 0.000 0.000 · Fecha: 2026/09/21 · Tipo Día: Laboral Tipo Día Año Anterior: Domingo · Tipo Generación · Energía Activa en el Día (kWh) | Informe de Balance Energético Fecha: 2026/09/21 Tipo Día: Laboral Tipo Día Año Anterior: Domingo Tipo Generación Energía Activa en el Día (kWh) % Incremento Día Energía Activa en el Mes (kWh) % Incremento Mes Energía Activa en el Año (kWh) % Incremento Año Energía Activa Últimos 365 días (kWh) Pérdidas Transporte Total Pérdidas Transporte 0.000 0.000 0.000 0.000 0.000 0.000 0.000 · Informe de Balance Energético · Fecha: 2026/09/21 Tipo Día: Laboral Tipo Día Año Anterior: Domingo Tipo Generación Energía Activa en el Día (kWh) % Incremento Día Energía Activa en el Mes (kWh) % Incremento Mes Energía Activa en el Año (kWh) % Incremento Año Energía Activa Últimos 365 días (kWh) Pérdidas Transporte Total Pérdidas Transporte 0.000 0.000 0.000 0.000 0.000 0.000 0.000 · Fecha: 2026/09/21 · Tipo Día: Laboral Tipo Día Año Anterior: Domingo · Tipo Generación · Energía Activa en el Día (kWh) · % Incremento Día | Informe de Balance Energético | Fecha: 2026/09/21 Tipo Día: Laboral Tipo Día Año Anterior: Domingo Tipo Generación Energía Activa en el Día (kWh) % Incremento Día Energía Activa en el Mes (kWh) % Incremento Mes Energía Activa en el Año (kWh) % Incremento Año Energía Activa Últimos 365 días (kWh) Pérdidas Transporte Total Pérdidas Transporte 0.000 0.000 0.000 0.000 0.000 0.000 0.000 · Fecha: 2026/09/21 · Tipo Día: Laboral Tipo Día Año Anterior: Domingo · Tipo Generación · Energía Activa en el Día (kWh) · % Incremento Día · Energía Activa en el Mes (kWh) · % Incremento Mes | Fecha: 2026/09/21 | Tipo Día: Laboral Tipo Día Año Anterior: Domingo | Tipo Generación · Energía Activa en el Día (kWh) · % Incremento Día · Energía Activa en el Mes (kWh) · % Incremento Mes · Energía Activa en el Año (kWh) · % Incremento Año · Energía Activa Últimos 365 días (kWh) | Pérdidas Transporte | Total Pérdidas Transporte · 0.000 · 0.000 · 0.000 · 0.000 · 0.000 · 0.000 · 0.000 |  · Copyright © CENACE 2023 - S1 ·  · Copyright © CENACE 2023 - S1 · Copyright © CENACE 2023 - S1 ·  ·  |  · Copyright © CENACE 2023 - S1 · Copyright © CENACE 2023 - S1 ·  | Copyright © CENACE 2023 - S1 |

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

Captured at 2026-09-21T19:10-05:00 local · status 200 · 266582 B · Plotly.newPlot calls: 18 · title `Información Operativa - CENACE`

Lines mentioning MW/MWh:

- PRODUCCIÓN ENERGÉTICA (MWh)
- DETALLE DE PRODUCCIÓN (MWh)
- CURVA DE GENERACIÓN (MW)
- DEMANDA (MW)
- DEMANDAS SNI (MW)
- 138 MW
- 105 MW
- 662 MW
- 115 MW
- 303 MW
- 99 MW
- 78 MW
- 23 MW
- 443 MW
- 143 MW
- 128 MW
- 113 MW
- 1 177 MW
- 250 MW
- 167 MW
- 150 MW
- 228 MW
- 24 MW
- 668 MW
- DEMANDAS POR EMPRESAS (MW)
- PRODUCCIÓN ENERGÉTICA (MWh)
- DETALLE DE PRODUCCIÓN (MWh)
- CURVA DE GENERACIÓN (MW)
- PRODUCCIÓN ENERGÉTICA (MWh)
- DETALLE DE PRODUCCIÓN (MWh)
- CURVA DE GENERACIÓN (MW)
- CURVA DE GENERACIÓN (MW)

Lines with thousands-formatted numbers:


<details><summary>Visible text head</summary>

```
Información Operativa - CENACE
Operador Nacional de Electricidad - CENACE
PRODUCCIÓN TIEMPO REAL
DEMANDA TIEMPO REAL
INFORMACIÓN OPERATIVA DIARIA
ACUMULADA MENSUAL
ACUMULADA ANUAL
PRODUCCIÓN EN TIEMPO REAL
Lunes, 21 de septiembre de 2026
PRODUCCIÓN ENERGÉTICA (MWh)
PRODUCCIÓN TOTAL
86 915
EXPORTACIÓN
142
IMPORTACIÓN
129
HIDRÁULICA
65 849
TÉRMICA
20 106
R. NO CONVENCIONAL
727
DETALLE DE PRODUCCIÓN (MWh)
CURVA DE GENERACIÓN (MW)
DEMANDAS EMPRESAS ELÉCTRICAS DE DISTRIBUCIÓN
Lunes, 21 de septiembre de 2026
DEMANDA (MW)
DEMANDA TOTAL
5 014
ANTERIOR
4 924
DEMANDA CNEL
3 537
EMPRESAS ELÉCTRICAS
1 476
DEMANDAS SNI (MW)
EMELNORTE
138 MW
E.E. REGIONAL SUR
105 MW
E.E. QUITO
662 MW
CNEL LOS RÍOS
115 MW
CNEL EL ORO
303 MW
ELEPCO
99 MW
E.E. RIOBAMBA
78 MW
CNEL LOS BOLÍVAR
23 MW
CNEL MANABÍ
443 MW
E.E. AMBATO
143 MW
CNEL ESMERALDAS
128 MW
CNEL SANTA ELENA
113 MW
CNEL GUAYAQUIL
1 177 MW
CNEL MILAGRO
250 MW
CNEL SANTO DOMINGO
167 MW
CNEL SUCUMBÍOS
150 MW
E.E. CENTRO SUR
228 MW
E.E. AZOGUES
24 MW
CNEL GUAYAS LOS RÍOS
668 MW
DEMANDAS POR EMPRESAS (MW)
INFORMACIÓN OPERATIVA DIARIA
Sábado, 19 de septiembre de 2026
PRODUCCIÓN ENERGÉTICA (MWh)
PRODUCCIÓN TOTAL
104 277
EXPORTACIÓN
125
IMPORTACIÓN
158
HIDRÁULICA
80 537
TÉRMICA
21 151
R. NO CONVENCIONAL
2 432
DETALLE DE PRODUCCIÓN (MWh)
CURVA DE GENERACIÓN (MW)
INFORMACIÓN OPERATIVA MENSUAL
Septiembre de 2026 (hasta el día 19)
PRODUCCIÓN ENERGÉTICA (MWh)
PRODUCCIÓN TOTAL
2 045 109
EXPORTACIÓN
1 817
IMPORTACIÓN
40 702
HIDRÁULICA
1 583 200
TÉRMICA
377 922
R. NO CONVENCIONAL
43 286
DETALLE DE PRODUCCIÓN (MWh)
CURVA DE GENERACIÓN (MW)
Demanda máxima mensual: Miércoles, 02 de septiembre de 2026
INFORMACIÓN OPERATIVA ANUAL
2026 (hasta el día 19 de septiembre)
PRODUCCIÓN ENERGÉTICA (GWh)
PRODUCCIÓN TOTAL
26 943
EXPORTACIÓN
25
IMPORTACIÓN
276
HIDRÁULICA
20 866
TÉRMICA
5 494
R. NO CONVENCIONAL
307
DETALLE DE PRODUCCIÓN (GWh)
CURVA DE GENERACIÓN (MW)
Demanda máxima histórica: Miércoles, 15 de julio de 2026
Datos preliminares del SCADA, sujetos a revisión y validación.
```

</details>

## 8. Covariates

| source | status | bytes | keys / head |
|---|---|---|---|
| open_meteo:archive | 200 | 1060 | ["precipitation_sum", "temperature_2m_mean", "time"] |
| open_meteo:forecast | 200 | 584 | ["precipitation_sum", "time"] |
| open_meteo:seasonal | 200 | 55753 | ["precipitation_sum", "precipitation_sum_member01", "precipitation_sum_member02", "precipitation_sum_member03", "precipitation_sum_member04", "precipitation_sum_member05", "precipitation_sum_member06" |
| noaa:oni_psl | 200 | 7203 | " 1950         2026\n 1950  -1.53  -1.34  -1.16  -1.18  -1.07  -0.85  -0.54  -0.42  -0.39  -0.44  -0.60  -0.80\n 1951  -0.82  -0.54  -0.17   0.18   0.36   0.58   0.70   0.89   0.99   1.15   1.04   0.8 |
| noaa:oni_cpc | 200 | 23000 | " SEAS  YR   TOTAL   ANOM\n  DJF 1950  25.01  -1.32\n  JFM 1950  25.36  -1.20\n  FMA 1950  25.88  -1.12\n  MAM 1950  26.24  -1.08\n  AMJ 1950  26.35  -1.10\n  MJJ 1950  26.32  -0.90\n  JJA 1950  26.24 |

## 9. Open-data portals

### ckan_cenace — status 403 (239 B) 

### ckan_cenace_nowww — status 403 (239 B) 

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
| robots:psl.noaa.gov | 404 |  |
| robots:www.cpc.ncep.noaa.gov | 404 |  |
| robots:raw.githubusercontent.com | 404 |  |
| robots:www.datosabiertos.gob.ec | 403 |  |
| opendata:ckan_cenace | 403 |  |
| robots:datosabiertos.gob.ec | 403 |  |
| opendata:ckan_cenace_nowww | 403 |  |
| opendata:ckan_bnee | 403 |  |
| opendata:cenace_dataset_page | 403 |  |
| opendata:arconel_bnee_1 |  | SSLError: HTTPSConnectionPool(host='www.controlrecursosyenergia.gob.ec', port=443): Max retries exceeded with url: /balance-nacional-de-energia-electrica/ (Caused by SSLError(SSLCertVerificationError(1, "[SSL: CERTIFICATE_VERIFY_FAILED] certificate verify failed: Hostname mismatch, certificate is no |

## Section errors

None.
