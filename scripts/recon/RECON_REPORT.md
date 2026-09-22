# Phase 0 reconnaissance report

Generated 2026-09-22T18:45:35+00:00 (UTC) · 2026-09-22T13:45:35-05:00 (Ecuador) · started 2026-09-22T18:38:11+00:00 · 368 requests.

Raw responses: `tests/fixtures/` (gzipped when large). Structured findings: `tests/fixtures/recon/findings.json`. Full log: `tests/fixtures/recon/capture_log.json`.

Partial run of **xm**; every other section, and its log rows, are carried over from the run started 2026-09-22T00:05:25+00:00.

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
| robots:servapibi.xm.com.co | 404 | 0 |  | robots/servapibi.xm.com.co.txt |  |
| xm:lists:ListadoMetricas | 200 | 84852 | 0.29 | tests/fixtures/xm/lists_ListadoMetricas.json |  |
| xm:hourly:ExpoEner:Sistema:recent | 200 | 17225 | 0.31 | tests/fixtures/xm/ExpoEner_Sistema_recent.json |  |
| xm:hourly:ExpoEner:Sistema:2024-08 | 200 | 20632 | 0.35 | tests/fixtures/xm/ExpoEner_Sistema_2024-08.json |  |
| xm:hourly:ExpoEner:Sistema:2024-09 | 200 | 19859 | 0.28 | tests/fixtures/xm/ExpoEner_Sistema_2024-09.json |  |
| xm:hourly:ExpoEner:Sistema:2024-10 | 200 | 16627 | 0.26 | tests/fixtures/xm/ExpoEner_Sistema_2024-10.json |  |
| xm:hourly:ExpoEner:Sistema:2024-11 | 200 | 17780 | 0.27 | tests/fixtures/xm/ExpoEner_Sistema_2024-11.json |  |
| xm:hourly:ExpoEner:Sistema:2024-12 | 200 | 20499 | 0.29 | tests/fixtures/xm/ExpoEner_Sistema_2024-12.json |  |
| xm:hourly:ExpoEner:Sistema:2019-07 | 200 | 8274 | 0.26 | tests/fixtures/xm/ExpoEner_Sistema_2019-07.json |  |
| xm:hourly:ExpoEner:Enlace:recent | 200 | 15430 | 0.3 | tests/fixtures/xm/ExpoEner_Enlace_recent.json |  |
| xm:hourly:ExpoEner:Enlace:2024-08 | 200 | 22623 | 0.28 | tests/fixtures/xm/ExpoEner_Enlace_2024-08.json |  |
| xm:hourly:ExpoEner:Enlace:2024-09 | 200 | 31884 | 0.28 | tests/fixtures/xm/ExpoEner_Enlace_2024-09.json |  |
| xm:hourly:ExpoEner:Enlace:2024-10 | 200 | 15953 | 0.27 | tests/fixtures/xm/ExpoEner_Enlace_2024-10.json |  |
| xm:hourly:ExpoEner:Enlace:2024-11 | 200 | 16423 | 0.28 | tests/fixtures/xm/ExpoEner_Enlace_2024-11.json |  |
| xm:hourly:ExpoEner:Enlace:2024-12 | 200 | 23987 | 0.28 | tests/fixtures/xm/ExpoEner_Enlace_2024-12.json |  |
| xm:hourly:ExpoEner:Enlace:2019-07 | 200 | 7886 | 0.27 | tests/fixtures/xm/ExpoEner_Enlace_2019-07.json |  |
| xm:hourly:ImpoEner:Sistema:recent | 200 | 6021 | 0.27 | tests/fixtures/xm/ImpoEner_Sistema_recent.json |  |
| xm:hourly:ImpoEner:Sistema:2024-08 | 200 | 914 | 0.24 | tests/fixtures/xm/ImpoEner_Sistema_2024-08.json |  |
| xm:hourly:ImpoEner:Sistema:2024-09 | 200 | 607 | 0.26 | tests/fixtures/xm/ImpoEner_Sistema_2024-09.json |  |
| xm:hourly:ImpoEner:Sistema:2024-10 | 200 | 13494 | 0.26 | tests/fixtures/xm/ImpoEner_Sistema_2024-10.json |  |
| xm:hourly:ImpoEner:Sistema:2024-11 | 200 | 7333 | 0.25 | tests/fixtures/xm/ImpoEner_Sistema_2024-11.json |  |
| xm:hourly:ImpoEner:Sistema:2024-12 | 200 | 958 | 0.25 | tests/fixtures/xm/ImpoEner_Sistema_2024-12.json |  |
| xm:hourly:ImpoEner:Sistema:2019-07 | 200 | 18789 | 0.27 | tests/fixtures/xm/ImpoEner_Sistema_2019-07.json |  |
| xm:hourly:ImpoEner:Enlace:recent | 200 | 5834 | 0.29 | tests/fixtures/xm/ImpoEner_Enlace_recent.json |  |
| xm:hourly:ImpoEner:Enlace:2024-08 | 200 | 901 | 0.28 | tests/fixtures/xm/ImpoEner_Enlace_2024-08.json |  |
| xm:hourly:ImpoEner:Enlace:2024-09 | 200 | 570 | 0.26 | tests/fixtures/xm/ImpoEner_Enlace_2024-09.json |  |
| xm:hourly:ImpoEner:Enlace:2024-10 | 200 | 12859 | 0.26 | tests/fixtures/xm/ImpoEner_Enlace_2024-10.json |  |
| xm:hourly:ImpoEner:Enlace:2024-11 | 200 | 6962 | 0.25 | tests/fixtures/xm/ImpoEner_Enlace_2024-11.json |  |
| xm:hourly:ImpoEner:Enlace:2024-12 | 200 | 930 | 0.26 | tests/fixtures/xm/ImpoEner_Enlace_2024-12.json |  |
| xm:hourly:ImpoEner:Enlace:2019-07 | 200 | 16966 | 0.28 | tests/fixtures/xm/ImpoEner_Enlace_2019-07.json |  |
| xm:hourly:CompBolsaTIEEner:Sistema:recent | 200 | 16125 | 0.32 | tests/fixtures/xm/CompBolsaTIEEner_Sistema_recent.json |  |
| xm:hourly:CompBolsaTIEEner:Sistema:2024-08 | 200 | 20645 | 0.28 | tests/fixtures/xm/CompBolsaTIEEner_Sistema_2024-08.json |  |
| xm:hourly:CompBolsaTIEEner:Sistema:2024-09 | 200 | 19871 | 0.28 | tests/fixtures/xm/CompBolsaTIEEner_Sistema_2024-09.json |  |
| xm:hourly:CompBolsaTIEEner:Sistema:2024-10 | 200 | 16642 | 0.28 | tests/fixtures/xm/CompBolsaTIEEner_Sistema_2024-10.json |  |
| xm:hourly:CompBolsaTIEEner:Sistema:2024-11 | 200 | 17795 | 0.29 | tests/fixtures/xm/CompBolsaTIEEner_Sistema_2024-11.json |  |
| xm:hourly:CompBolsaTIEEner:Sistema:2024-12 | 200 | 20513 | 0.32 | tests/fixtures/xm/CompBolsaTIEEner_Sistema_2024-12.json |  |
| xm:hourly:CompBolsaTIEEner:Sistema:2019-07 | 200 | 8287 | 0.28 | tests/fixtures/xm/CompBolsaTIEEner_Sistema_2019-07.json |  |
| xm:hourly:VentBolsaTIEEner:Sistema:recent | 200 | 16124 | 0.3 | tests/fixtures/xm/VentBolsaTIEEner_Sistema_recent.json |  |
| xm:hourly:VentBolsaTIEEner:Sistema:2024-08 | 200 | 20644 | 0.27 | tests/fixtures/xm/VentBolsaTIEEner_Sistema_2024-08.json |  |
| xm:hourly:VentBolsaTIEEner:Sistema:2024-09 | 200 | 19870 | 0.27 | tests/fixtures/xm/VentBolsaTIEEner_Sistema_2024-09.json |  |
| xm:hourly:VentBolsaTIEEner:Sistema:2024-10 | 200 | 16641 | 0.27 | tests/fixtures/xm/VentBolsaTIEEner_Sistema_2024-10.json |  |
| xm:hourly:VentBolsaTIEEner:Sistema:2024-11 | 200 | 17794 | 0.27 | tests/fixtures/xm/VentBolsaTIEEner_Sistema_2024-11.json |  |
| xm:hourly:VentBolsaTIEEner:Sistema:2024-12 | 200 | 20512 | 0.26 | tests/fixtures/xm/VentBolsaTIEEner_Sistema_2024-12.json |  |
| xm:hourly:VentBolsaTIEEner:Sistema:2019-07 | 200 | 8286 | 0.25 | tests/fixtures/xm/VentBolsaTIEEner_Sistema_2019-07.json |  |
| xm:daily:PorcVoluUtilDiar:Sistema:recent | 200 | 2407 | 0.26 | tests/fixtures/xm/PorcVoluUtilDiar_Sistema_recent.json |  |
| xm:daily:PorcVoluUtilDiar:Sistema:2024-08 | 200 | 2482 | 0.25 | tests/fixtures/xm/PorcVoluUtilDiar_Sistema_2024-08.json |  |
| xm:daily:PorcVoluUtilDiar:Sistema:2024-09 | 200 | 2407 | 0.25 | tests/fixtures/xm/PorcVoluUtilDiar_Sistema_2024-09.json |  |
| xm:daily:PorcVoluUtilDiar:Sistema:2024-10 | 200 | 2482 | 0.27 | tests/fixtures/xm/PorcVoluUtilDiar_Sistema_2024-10.json |  |
| xm:daily:PorcVoluUtilDiar:Sistema:2024-11 | 200 | 2407 | 0.26 | tests/fixtures/xm/PorcVoluUtilDiar_Sistema_2024-11.json |  |
| xm:daily:PorcVoluUtilDiar:Sistema:2024-12 | 200 | 2482 | 0.27 | tests/fixtures/xm/PorcVoluUtilDiar_Sistema_2024-12.json |  |
| xm:daily:PorcVoluUtilDiar:Sistema:2019-07 | 200 | 2482 | 0.27 | tests/fixtures/xm/PorcVoluUtilDiar_Sistema_2019-07.json |  |
| xm:daily:VoluUtilDiarEner:Sistema:recent | 200 | 2713 | 0.28 | tests/fixtures/xm/VoluUtilDiarEner_Sistema_recent.json |  |
| xm:daily:VoluUtilDiarEner:Sistema:2024-08 | 200 | 2782 | 0.25 | tests/fixtures/xm/VoluUtilDiarEner_Sistema_2024-08.json |  |
| xm:daily:VoluUtilDiarEner:Sistema:2024-09 | 200 | 2683 | 0.26 | tests/fixtures/xm/VoluUtilDiarEner_Sistema_2024-09.json |  |
| xm:daily:VoluUtilDiarEner:Sistema:2024-10 | 200 | 2767 | 0.25 | tests/fixtures/xm/VoluUtilDiarEner_Sistema_2024-10.json |  |
| xm:daily:VoluUtilDiarEner:Sistema:2024-11 | 200 | 2705 | 0.25 | tests/fixtures/xm/VoluUtilDiarEner_Sistema_2024-11.json |  |
| xm:daily:VoluUtilDiarEner:Sistema:2024-12 | 200 | 2798 | 0.28 | tests/fixtures/xm/VoluUtilDiarEner_Sistema_2024-12.json |  |
| xm:daily:VoluUtilDiarEner:Sistema:2019-07 | 200 | 2798 | 0.27 | tests/fixtures/xm/VoluUtilDiarEner_Sistema_2019-07.json |  |
| xm:daily:CapaUtilDiarEner:Sistema:recent | 200 | 2708 | 0.28 | tests/fixtures/xm/CapaUtilDiarEner_Sistema_recent.json |  |
| xm:daily:CapaUtilDiarEner:Sistema:2024-08 | 200 | 2793 | 0.25 | tests/fixtures/xm/CapaUtilDiarEner_Sistema_2024-08.json |  |
| xm:daily:CapaUtilDiarEner:Sistema:2024-09 | 200 | 2708 | 0.26 | tests/fixtures/xm/CapaUtilDiarEner_Sistema_2024-09.json |  |
| xm:daily:CapaUtilDiarEner:Sistema:2024-10 | 200 | 2793 | 0.24 | tests/fixtures/xm/CapaUtilDiarEner_Sistema_2024-10.json |  |
| xm:daily:CapaUtilDiarEner:Sistema:2024-11 | 200 | 2708 | 0.24 | tests/fixtures/xm/CapaUtilDiarEner_Sistema_2024-11.json |  |
| xm:daily:CapaUtilDiarEner:Sistema:2024-12 | 200 | 2793 | 0.25 | tests/fixtures/xm/CapaUtilDiarEner_Sistema_2024-12.json |  |
| xm:daily:CapaUtilDiarEner:Sistema:2019-07 | 200 | 2793 | 0.24 | tests/fixtures/xm/CapaUtilDiarEner_Sistema_2019-07.json |  |
| xm:daily:AporEner:Sistema:recent | 200 | 2633 | 0.26 | tests/fixtures/xm/AporEner_Sistema_recent.json |  |
| xm:daily:AporEner:Sistema:2024-08 | 200 | 2715 | 0.24 | tests/fixtures/xm/AporEner_Sistema_2024-08.json |  |
| xm:daily:AporEner:Sistema:2024-09 | 200 | 2623 | 0.25 | tests/fixtures/xm/AporEner_Sistema_2024-09.json |  |
| xm:daily:AporEner:Sistema:2024-10 | 200 | 2716 | 0.25 | tests/fixtures/xm/AporEner_Sistema_2024-10.json |  |
| xm:daily:AporEner:Sistema:2024-11 | 200 | 2633 | 0.25 | tests/fixtures/xm/AporEner_Sistema_2024-11.json |  |
| xm:daily:AporEner:Sistema:2024-12 | 200 | 2716 | 0.25 | tests/fixtures/xm/AporEner_Sistema_2024-12.json |  |
| xm:daily:AporEner:Sistema:2019-07 | 200 | 2716 | 0.24 | tests/fixtures/xm/AporEner_Sistema_2019-07.json |  |
| xm:daily:AporEnerMediHist:Sistema:recent | 200 | 2657 | 0.26 | tests/fixtures/xm/AporEnerMediHist_Sistema_recent.json |  |
| xm:daily:AporEnerMediHist:Sistema:2024-08 | 200 | 2740 | 0.25 | tests/fixtures/xm/AporEnerMediHist_Sistema_2024-08.json |  |
| xm:daily:AporEnerMediHist:Sistema:2024-09 | 200 | 2657 | 0.25 | tests/fixtures/xm/AporEnerMediHist_Sistema_2024-09.json |  |
| xm:daily:AporEnerMediHist:Sistema:2024-10 | 200 | 2740 | 0.25 | tests/fixtures/xm/AporEnerMediHist_Sistema_2024-10.json |  |
| xm:daily:AporEnerMediHist:Sistema:2024-11 | 200 | 2657 | 0.25 | tests/fixtures/xm/AporEnerMediHist_Sistema_2024-11.json |  |
| xm:daily:AporEnerMediHist:Sistema:2024-12 | 200 | 2740 | 0.24 | tests/fixtures/xm/AporEnerMediHist_Sistema_2024-12.json |  |
| xm:daily:AporEnerMediHist:Sistema:2019-07 | 200 | 2740 | 0.25 | tests/fixtures/xm/AporEnerMediHist_Sistema_2019-07.json |  |
| xm:daily:PorcApor:Sistema:recent | 200 | 2385 | 0.27 | tests/fixtures/xm/PorcApor_Sistema_recent.json |  |
| xm:daily:PorcApor:Sistema:2024-08 | 200 | 2460 | 0.25 | tests/fixtures/xm/PorcApor_Sistema_2024-08.json |  |
| xm:daily:PorcApor:Sistema:2024-09 | 200 | 2385 | 0.25 | tests/fixtures/xm/PorcApor_Sistema_2024-09.json |  |
| xm:daily:PorcApor:Sistema:2024-10 | 200 | 2460 | 0.25 | tests/fixtures/xm/PorcApor_Sistema_2024-10.json |  |
| xm:daily:PorcApor:Sistema:2024-11 | 200 | 2385 | 0.25 | tests/fixtures/xm/PorcApor_Sistema_2024-11.json |  |
| xm:daily:PorcApor:Sistema:2024-12 | 200 | 2460 | 0.25 | tests/fixtures/xm/PorcApor_Sistema_2024-12.json |  |
| xm:daily:PorcApor:Sistema:2019-07 | 200 | 2460 | 0.25 | tests/fixtures/xm/PorcApor_Sistema_2019-07.json |  |
| xm:hourly:PrecBolsNaci:Sistema:recent | 200 | 16849 | 0.32 | tests/fixtures/xm/PrecBolsNaci_Sistema_recent.json |  |
| xm:hourly:PrecBolsNaci:Sistema:2024-08 | 200 | 18441 | 0.29 | tests/fixtures/xm/PrecBolsNaci_Sistema_2024-08.json |  |
| xm:hourly:PrecBolsNaci:Sistema:2024-09 | 200 | 17875 | 0.28 | tests/fixtures/xm/PrecBolsNaci_Sistema_2024-09.json |  |
| xm:hourly:PrecBolsNaci:Sistema:2024-10 | 200 | 19026 | 0.3 | tests/fixtures/xm/PrecBolsNaci_Sistema_2024-10.json |  |
| xm:hourly:PrecBolsNaci:Sistema:2024-11 | 200 | 18062 | 0.29 | tests/fixtures/xm/PrecBolsNaci_Sistema_2024-11.json |  |
| xm:hourly:PrecBolsNaci:Sistema:2024-12 | 200 | 18511 | 0.3 | tests/fixtures/xm/PrecBolsNaci_Sistema_2024-12.json |  |
| xm:hourly:PrecBolsNaci:Sistema:2019-07 | 200 | 18248 | 0.29 | tests/fixtures/xm/PrecBolsNaci_Sistema_2019-07.json |  |
| xm:daily:PrecEscaAct:Sistema:recent | 200 | 2339 | 0.27 | tests/fixtures/xm/PrecEscaAct_Sistema_recent.json |  |
| xm:daily:PrecEscaAct:Sistema:2024-08 | 200 | 2542 | 0.24 | tests/fixtures/xm/PrecEscaAct_Sistema_2024-08.json |  |
| xm:daily:PrecEscaAct:Sistema:2024-09 | 200 | 2465 | 0.25 | tests/fixtures/xm/PrecEscaAct_Sistema_2024-09.json |  |
| xm:daily:PrecEscaAct:Sistema:2024-10 | 200 | 2542 | 0.25 | tests/fixtures/xm/PrecEscaAct_Sistema_2024-10.json |  |
| xm:daily:PrecEscaAct:Sistema:2024-11 | 200 | 2465 | 0.25 | tests/fixtures/xm/PrecEscaAct_Sistema_2024-11.json |  |
| xm:daily:PrecEscaAct:Sistema:2024-12 | 200 | 2542 | 0.25 | tests/fixtures/xm/PrecEscaAct_Sistema_2024-12.json |  |
| xm:daily:PrecEscaAct:Sistema:2019-07 | 200 | 2542 | 0.25 | tests/fixtures/xm/PrecEscaAct_Sistema_2019-07.json |  |
| xm:daily:DemaSIN:Sistema:recent | 200 | 2548 | 0.27 | tests/fixtures/xm/DemaSIN_Sistema_recent.json |  |
| xm:daily:DemaSIN:Sistema:2024-08 | 200 | 2717 | 0.34 | tests/fixtures/xm/DemaSIN_Sistema_2024-08.json |  |
| xm:daily:DemaSIN:Sistema:2024-09 | 200 | 2634 | 0.35 | tests/fixtures/xm/DemaSIN_Sistema_2024-09.json |  |
| xm:daily:DemaSIN:Sistema:2024-10 | 200 | 2717 | 0.26 | tests/fixtures/xm/DemaSIN_Sistema_2024-10.json |  |
| xm:daily:DemaSIN:Sistema:2024-11 | 200 | 2634 | 0.28 | tests/fixtures/xm/DemaSIN_Sistema_2024-11.json |  |
| xm:daily:DemaSIN:Sistema:2024-12 | 200 | 2717 | 0.26 | tests/fixtures/xm/DemaSIN_Sistema_2024-12.json |  |
| xm:daily:DemaSIN:Sistema:2019-07 | 200 | 2717 | 0.27 | tests/fixtures/xm/DemaSIN_Sistema_2019-07.json |  |
| xm:hourly:ImpoMoneda:Enlace:recent | 200 | 6030 | 0.29 | tests/fixtures/xm/ImpoMoneda_Enlace_recent.json |  |
| xm:hourly:ImpoMoneda:Enlace:2024-10 | 200 | 13595 | 0.28 | tests/fixtures/xm/ImpoMoneda_Enlace_2024-10.json |  |
| xm:hourly:ExpoMoneda:Enlace:recent | 200 | 17132 | 0.31 | tests/fixtures/xm/ExpoMoneda_Enlace_recent.json |  |
| xm:hourly:ExpoMoneda:Enlace:2024-10 | 200 | 17616 | 0.26 | tests/fixtures/xm/ExpoMoneda_Enlace_2024-10.json |  |
| xm:hourly:CompBolsaTIEEner:Agente:recent | 200 | 14263 | 0.44 | tests/fixtures/xm/CompBolsaTIEEner_Agente_recent.json |  |
| xm:hourly:CompBolsaTIEEner:Agente:2024-10 | 200 | 14909 | 0.35 | tests/fixtures/xm/CompBolsaTIEEner_Agente_2024-10.json |  |
| xm:hourly:VentBolsaTIEEner:Agente:recent | 200 | 60876 | 0.48 | tests/fixtures/xm/VentBolsaTIEEner_Agente_recent.json |  |
| xm:hourly:VentBolsaTIEEner:Agente:2024-10 | 200 | 54533 | 0.32 | tests/fixtures/xm/VentBolsaTIEEner_Agente_2024-10.json |  |
| robots:www.simem.co | 404 | 0 |  | robots/www.simem.co.txt |  |
| simem:catalog | 200 | 201959 | 38.86 | tests/fixtures/xm/simem/catalog_e007fb.json |  |
| simem:detail:b9f2ec | 200 | 2369 | 20.94 | tests/fixtures/xm/simem/detail_b9f2ec.json |  |
| simem:b9f2ec:recent | 200 | 6914 | 3.28 | tests/fixtures/xm/simem/b9f2ec_recent.json |  |
| simem:b9f2ec:2024-10 | 200 | 12427 | 3.9 | tests/fixtures/xm/simem/b9f2ec_2024-10.json |  |
| simem:b9f2ec:2019-07 | 200 | 12646 | 3.62 | tests/fixtures/xm/simem/b9f2ec_2019-07.json |  |
| simem:detail:7f16cb | 200 | 2410 | 21.61 | tests/fixtures/xm/simem/detail_7f16cb.json |  |
| simem:7f16cb:recent | 200 | 13617 | 10.06 | tests/fixtures/xm/simem/7f16cb_recent.json |  |
| simem:7f16cb:2024-10 | 200 | 12684 | 4.86 | tests/fixtures/xm/simem/7f16cb_2024-10.json |  |
| simem:7f16cb:2019-07 | 200 | 12643 | 4.81 | tests/fixtures/xm/simem/7f16cb_2019-07.json |  |
| simem:detail:860c86 | 200 | 1011 | 0.71 | tests/fixtures/xm/simem/detail_860c86.json |  |
| simem:860c86:recent | 200 | 997 | 0.82 | tests/fixtures/xm/simem/860c86_recent.json |  |
| simem:860c86:2024-10 | 200 | 2919671 | 2.22 | capture-only (2919671 B raw, 2189864 B gz) |  |
| simem:860c86:2019-07 | 200 | 997 | 0.77 | tests/fixtures/xm/simem/860c86_2019-07.json |  |
| simem:detail:CDD16E | 200 | 2219 | 10.35 | tests/fixtures/xm/simem/detail_CDD16E.json |  |
| simem:CDD16E:recent | 200 | 758279 | 3.56 | tests/fixtures/xm/simem/CDD16E_recent.json.gz |  |
| simem:CDD16E:2024-10 | 200 | 7082724 | 4.22 | tests/fixtures/xm/simem/CDD16E_2024-10.json.gz |  |
| simem:CDD16E:2019-07 | 200 | 2215 | 3.19 | tests/fixtures/xm/simem/CDD16E_2019-07.json |  |
| simem:detail:C35A63 | 200 | 1918 | 21.88 | tests/fixtures/xm/simem/detail_C35A63.json |  |
| simem:C35A63:recent | 200 | 206777 | 6.18 | tests/fixtures/xm/simem/C35A63_recent.json |  |
| simem:C35A63:2024-10 | 200 | 2022617 | 5.59 | tests/fixtures/xm/simem/C35A63_2024-10.json.gz |  |
| simem:C35A63:2019-07 | 200 | 290585 | 5.51 | tests/fixtures/xm/simem/C35A63_2019-07.json |  |
| simem:detail:31E0AF | 200 | 1545 | 9.64 | tests/fixtures/xm/simem/detail_31E0AF.json |  |
| simem:31E0AF:recent | 200 | 4906 | 2.53 | tests/fixtures/xm/simem/31E0AF_recent.json |  |
| simem:31E0AF:2024-10 | 200 | 11026 | 2.87 | tests/fixtures/xm/simem/31E0AF_2024-10.json |  |
| simem:31E0AF:2019-07 | 200 | 1541 | 2.25 | tests/fixtures/xm/simem/31E0AF_2019-07.json |  |
| simem:detail:4A17B1 | 200 | 2300 | 3.78 | tests/fixtures/xm/simem/detail_4A17B1.json |  |
| simem:4A17B1:recent | 200 | 2296 | 1.25 | tests/fixtures/xm/simem/4A17B1_recent.json |  |
| simem:4A17B1:2024-10 | 200 | 28601 | 1.52 | tests/fixtures/xm/simem/4A17B1_2024-10.json |  |
| simem:4A17B1:2019-07 | 200 | 2296 | 1.48 | tests/fixtures/xm/simem/4A17B1_2019-07.json |  |
| simem:detail:842296 | 200 | 2242 | 4.16 | tests/fixtures/xm/simem/detail_842296.json |  |
| simem:842296:recent | 200 | 2238 | 1.83 | tests/fixtures/xm/simem/842296_recent.json |  |
| simem:842296:2024-10 | 200 | 75539 | 1.93 | tests/fixtures/xm/simem/842296_2024-10.json |  |
| simem:842296:2019-07 | 200 | 2238 | 2.06 | tests/fixtures/xm/simem/842296_2019-07.json |  |
| simem:detail:1088a6 | 200 | 2910 | 4.85 | tests/fixtures/xm/simem/detail_1088a6.json |  |
| simem:1088a6:recent | 200 | 109790023 | 11.79 | capture-only (109790023 B raw, 4503299 B gz) |  |
| simem:1088a6:2024 | 200 | 77872584 | 9.17 | capture-only (77872584 B raw, 3367037 B gz) |  |
| simem:detail:8d3ccd | 200 | 2401 | 5.85 | tests/fixtures/xm/simem/detail_8d3ccd.json |  |
| simem:8d3ccd:recent | 200 | 532871 | 2.38 | tests/fixtures/xm/simem/8d3ccd_recent.json.gz |  |
| simem:8d3ccd:2024-10 | 200 | 912338 | 2.74 | tests/fixtures/xm/simem/8d3ccd_2024-10.json.gz |  |
| simem:8d3ccd:2019-07 | 200 | 2397 | 1.96 | tests/fixtures/xm/simem/8d3ccd_2019-07.json |  |

## 2. robots.txt verdicts

| url | allowed | detail |
|---|---|---|
| https://servapibi.xm.com.co/lists | True | no robots.txt |
| https://servapibi.xm.com.co/hourly | True | no robots.txt |
| https://servapibi.xm.com.co/hourly | True | no robots.txt |
| https://servapibi.xm.com.co/hourly | True | no robots.txt |
| https://servapibi.xm.com.co/hourly | True | no robots.txt |
| https://servapibi.xm.com.co/hourly | True | no robots.txt |
| https://servapibi.xm.com.co/hourly | True | no robots.txt |
| https://servapibi.xm.com.co/hourly | True | no robots.txt |
| https://servapibi.xm.com.co/hourly | True | no robots.txt |
| https://servapibi.xm.com.co/hourly | True | no robots.txt |
| https://servapibi.xm.com.co/hourly | True | no robots.txt |
| https://servapibi.xm.com.co/hourly | True | no robots.txt |
| https://servapibi.xm.com.co/hourly | True | no robots.txt |
| https://servapibi.xm.com.co/hourly | True | no robots.txt |
| https://servapibi.xm.com.co/hourly | True | no robots.txt |
| https://servapibi.xm.com.co/hourly | True | no robots.txt |
| https://servapibi.xm.com.co/hourly | True | no robots.txt |
| https://servapibi.xm.com.co/hourly | True | no robots.txt |
| https://servapibi.xm.com.co/hourly | True | no robots.txt |
| https://servapibi.xm.com.co/hourly | True | no robots.txt |
| https://servapibi.xm.com.co/hourly | True | no robots.txt |
| https://servapibi.xm.com.co/hourly | True | no robots.txt |
| https://servapibi.xm.com.co/hourly | True | no robots.txt |
| https://servapibi.xm.com.co/hourly | True | no robots.txt |
| https://servapibi.xm.com.co/hourly | True | no robots.txt |
| https://servapibi.xm.com.co/hourly | True | no robots.txt |
| https://servapibi.xm.com.co/hourly | True | no robots.txt |
| https://servapibi.xm.com.co/hourly | True | no robots.txt |
| https://servapibi.xm.com.co/hourly | True | no robots.txt |
| https://servapibi.xm.com.co/hourly | True | no robots.txt |
| https://servapibi.xm.com.co/hourly | True | no robots.txt |
| https://servapibi.xm.com.co/hourly | True | no robots.txt |
| https://servapibi.xm.com.co/hourly | True | no robots.txt |
| https://servapibi.xm.com.co/hourly | True | no robots.txt |
| https://servapibi.xm.com.co/hourly | True | no robots.txt |
| https://servapibi.xm.com.co/hourly | True | no robots.txt |
| https://servapibi.xm.com.co/hourly | True | no robots.txt |
| https://servapibi.xm.com.co/hourly | True | no robots.txt |
| https://servapibi.xm.com.co/hourly | True | no robots.txt |
| https://servapibi.xm.com.co/hourly | True | no robots.txt |
| https://servapibi.xm.com.co/hourly | True | no robots.txt |
| https://servapibi.xm.com.co/hourly | True | no robots.txt |
| https://servapibi.xm.com.co/hourly | True | no robots.txt |
| https://servapibi.xm.com.co/daily | True | no robots.txt |
| https://servapibi.xm.com.co/daily | True | no robots.txt |
| https://servapibi.xm.com.co/daily | True | no robots.txt |
| https://servapibi.xm.com.co/daily | True | no robots.txt |
| https://servapibi.xm.com.co/daily | True | no robots.txt |
| https://servapibi.xm.com.co/daily | True | no robots.txt |
| https://servapibi.xm.com.co/daily | True | no robots.txt |
| https://servapibi.xm.com.co/daily | True | no robots.txt |
| https://servapibi.xm.com.co/daily | True | no robots.txt |
| https://servapibi.xm.com.co/daily | True | no robots.txt |
| https://servapibi.xm.com.co/daily | True | no robots.txt |
| https://servapibi.xm.com.co/daily | True | no robots.txt |
| https://servapibi.xm.com.co/daily | True | no robots.txt |
| https://servapibi.xm.com.co/daily | True | no robots.txt |
| https://servapibi.xm.com.co/daily | True | no robots.txt |
| https://servapibi.xm.com.co/daily | True | no robots.txt |
| https://servapibi.xm.com.co/daily | True | no robots.txt |
| https://servapibi.xm.com.co/daily | True | no robots.txt |
| https://servapibi.xm.com.co/daily | True | no robots.txt |
| https://servapibi.xm.com.co/daily | True | no robots.txt |
| https://servapibi.xm.com.co/daily | True | no robots.txt |
| https://servapibi.xm.com.co/daily | True | no robots.txt |
| https://servapibi.xm.com.co/daily | True | no robots.txt |
| https://servapibi.xm.com.co/daily | True | no robots.txt |
| https://servapibi.xm.com.co/daily | True | no robots.txt |
| https://servapibi.xm.com.co/daily | True | no robots.txt |
| https://servapibi.xm.com.co/daily | True | no robots.txt |
| https://servapibi.xm.com.co/daily | True | no robots.txt |
| https://servapibi.xm.com.co/daily | True | no robots.txt |
| https://servapibi.xm.com.co/daily | True | no robots.txt |
| https://servapibi.xm.com.co/daily | True | no robots.txt |
| https://servapibi.xm.com.co/daily | True | no robots.txt |
| https://servapibi.xm.com.co/daily | True | no robots.txt |
| https://servapibi.xm.com.co/daily | True | no robots.txt |
| https://servapibi.xm.com.co/daily | True | no robots.txt |
| https://servapibi.xm.com.co/daily | True | no robots.txt |
| https://servapibi.xm.com.co/daily | True | no robots.txt |
| https://servapibi.xm.com.co/daily | True | no robots.txt |
| https://servapibi.xm.com.co/daily | True | no robots.txt |
| https://servapibi.xm.com.co/daily | True | no robots.txt |
| https://servapibi.xm.com.co/daily | True | no robots.txt |
| https://servapibi.xm.com.co/daily | True | no robots.txt |
| https://servapibi.xm.com.co/hourly | True | no robots.txt |
| https://servapibi.xm.com.co/hourly | True | no robots.txt |
| https://servapibi.xm.com.co/hourly | True | no robots.txt |
| https://servapibi.xm.com.co/hourly | True | no robots.txt |
| https://servapibi.xm.com.co/hourly | True | no robots.txt |
| https://servapibi.xm.com.co/hourly | True | no robots.txt |
| https://servapibi.xm.com.co/hourly | True | no robots.txt |
| https://servapibi.xm.com.co/daily | True | no robots.txt |
| https://servapibi.xm.com.co/daily | True | no robots.txt |
| https://servapibi.xm.com.co/daily | True | no robots.txt |
| https://servapibi.xm.com.co/daily | True | no robots.txt |
| https://servapibi.xm.com.co/daily | True | no robots.txt |
| https://servapibi.xm.com.co/daily | True | no robots.txt |
| https://servapibi.xm.com.co/daily | True | no robots.txt |
| https://servapibi.xm.com.co/daily | True | no robots.txt |
| https://servapibi.xm.com.co/daily | True | no robots.txt |
| https://servapibi.xm.com.co/daily | True | no robots.txt |
| https://servapibi.xm.com.co/daily | True | no robots.txt |
| https://servapibi.xm.com.co/daily | True | no robots.txt |
| https://servapibi.xm.com.co/daily | True | no robots.txt |
| https://servapibi.xm.com.co/daily | True | no robots.txt |
| https://servapibi.xm.com.co/hourly | True | no robots.txt |
| https://servapibi.xm.com.co/hourly | True | no robots.txt |
| https://servapibi.xm.com.co/hourly | True | no robots.txt |
| https://servapibi.xm.com.co/hourly | True | no robots.txt |
| https://servapibi.xm.com.co/hourly | True | no robots.txt |
| https://servapibi.xm.com.co/hourly | True | no robots.txt |
| https://servapibi.xm.com.co/hourly | True | no robots.txt |
| https://servapibi.xm.com.co/hourly | True | no robots.txt |
| https://www.simem.co/backend-files/api/PublicData | True | no robots.txt |
| https://www.simem.co/backend-files/api/detalle-datos-publicos | True | no robots.txt |
| https://www.simem.co/backend-files/api/PublicData | True | no robots.txt |
| https://www.simem.co/backend-files/api/PublicData | True | no robots.txt |
| https://www.simem.co/backend-files/api/PublicData | True | no robots.txt |
| https://www.simem.co/backend-files/api/detalle-datos-publicos | True | no robots.txt |
| https://www.simem.co/backend-files/api/PublicData | True | no robots.txt |
| https://www.simem.co/backend-files/api/PublicData | True | no robots.txt |
| https://www.simem.co/backend-files/api/PublicData | True | no robots.txt |
| https://www.simem.co/backend-files/api/detalle-datos-publicos | True | no robots.txt |
| https://www.simem.co/backend-files/api/PublicData | True | no robots.txt |
| https://www.simem.co/backend-files/api/PublicData | True | no robots.txt |
| https://www.simem.co/backend-files/api/PublicData | True | no robots.txt |
| https://www.simem.co/backend-files/api/detalle-datos-publicos | True | no robots.txt |
| https://www.simem.co/backend-files/api/PublicData | True | no robots.txt |
| https://www.simem.co/backend-files/api/PublicData | True | no robots.txt |
| https://www.simem.co/backend-files/api/PublicData | True | no robots.txt |
| https://www.simem.co/backend-files/api/detalle-datos-publicos | True | no robots.txt |
| https://www.simem.co/backend-files/api/PublicData | True | no robots.txt |
| https://www.simem.co/backend-files/api/PublicData | True | no robots.txt |
| https://www.simem.co/backend-files/api/PublicData | True | no robots.txt |
| https://www.simem.co/backend-files/api/detalle-datos-publicos | True | no robots.txt |
| https://www.simem.co/backend-files/api/PublicData | True | no robots.txt |
| https://www.simem.co/backend-files/api/PublicData | True | no robots.txt |
| https://www.simem.co/backend-files/api/PublicData | True | no robots.txt |
| https://www.simem.co/backend-files/api/detalle-datos-publicos | True | no robots.txt |
| https://www.simem.co/backend-files/api/PublicData | True | no robots.txt |
| https://www.simem.co/backend-files/api/PublicData | True | no robots.txt |
| https://www.simem.co/backend-files/api/PublicData | True | no robots.txt |
| https://www.simem.co/backend-files/api/detalle-datos-publicos | True | no robots.txt |
| https://www.simem.co/backend-files/api/PublicData | True | no robots.txt |
| https://www.simem.co/backend-files/api/PublicData | True | no robots.txt |
| https://www.simem.co/backend-files/api/PublicData | True | no robots.txt |
| https://www.simem.co/backend-files/api/detalle-datos-publicos | True | no robots.txt |
| https://www.simem.co/backend-files/api/PublicData | True | no robots.txt |
| https://www.simem.co/backend-files/api/PublicData | True | no robots.txt |
| https://www.simem.co/backend-files/api/detalle-datos-publicos | True | no robots.txt |
| https://www.simem.co/backend-files/api/PublicData | True | no robots.txt |
| https://www.simem.co/backend-files/api/PublicData | True | no robots.txt |
| https://www.simem.co/backend-files/api/PublicData | True | no robots.txt |

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

## 10a. XM (Colombia): export availability to Ecuador

Contract (official client EquipoAnaliticaXM/API_XM, `pydataxm/pydataxm.py` + README): `POST https://servapibi.xm.com.co/{hourly,daily,monthly,lists}` with JSON `{MetricId, StartDate, EndDate (YYYY-MM-DD), Entity, Filter}`; inventory `POST /lists {"MetricId": "ListadoMetricas"}`; hourly/daily at most 30 days per call, requested here in calendar months as the client does. Raw answers in `tests/fixtures/xm/`.

Windows: recent 2026-08-23→2026-09-21, 2024-08 2024-08-01→2024-08-31, 2024-09 2024-09-01→2024-09-30, 2024-10 2024-10-01→2024-10-31, 2024-11 2024-11-01→2024-11-30, 2024-12 2024-12-01→2024-12-31, 2019-07 2019-07-01→2019-07-31

### Metric inventory (ListadoMetricas)

| path | status | bytes | content-type | error |
|---|---|---|---|---|
| lists | 200 | 84852 | application/json; charset=utf-8 |  |

Rows: **193**, metrics: 142, types: DailyEntities, HourlyEntities, ListsEntities, MonthlyEntities, entities: Agente, Area, CIIU, Combustible, Embalse, Enlace, MercadoComercializacion, Recurso, RecursoComb, Rio, Sistema, SubArea, Subarea

Candidates **not** in the live catalog: none (or no catalog) · extra exchange rows fetched: ImpoMoneda/Enlace, ExpoMoneda/Enlace, CompBolsaTIEEner/Agente, VentBolsaTIEEner/Agente

<details><summary>Catalog rows on exchanges, storage, inflows, scarcity</summary>

| MetricId | Entity | MaxDays | Type | unit | filter | name | description |
|---|---|---|---|---|---|---|---|
| ExpoMoneda | Sistema | 31 | HourlyEntities | COP | No aplica | Exportaciones Moneda por Sistema | Transferencias de Energia desde Colombia hacia otros paises |
| ImpoEner | Sistema | 31 | HourlyEntities | kWh | No aplica | Importaciones Energía por Sistema | Transferencias de Energia desde otros paises para abastecer la demanda nacional |
| ImpoEner | Enlace | 31 | HourlyEntities | kWh | No aplica | Importaciones Energía | Transferencias de Energia desde otros paises para abastecer la demanda nacional |
| ImpoMoneda | Enlace | 31 | HourlyEntities | COP | No aplica | Importaciones Moneda | Transferencias de Energia desde otros paises para abastecer la demanda nacional |
| ExpoEner | Enlace | 31 | HourlyEntities | kWh | No aplica | Exportaciones Energía | Transferencias de Energia desde Colombia hacia otros paises |
| ExpoMoneda | Enlace | 31 | HourlyEntities | COP | No aplica | Exportaciones Moneda | Transferencias de Energia desde Colombia hacia otros paises |
| ExpoEner | Sistema | 31 | HourlyEntities | kWh | No aplica | Exportaciones Energía por Sistema | Transferencias de Energia desde Colombia hacia otros paises |
| SnTIEMerito | Sistema | 31 | HourlyEntities | COP | No aplica | Saldo Neto TIE Merito por Sistema | Corresponde a los valores netos deficitarios o superavitarios resultantes del ajuste final de Transacciones Internacionales de Electricidad de acuerdo con lo de |
| SnTIEFueraMerito | Sistema | 31 | HourlyEntities | COP | No aplica | Saldo Neto TIE Fuera Merito por Sistema | Corresponde a los valores netos deficitarios o superavitarios resultantes del ajuste final de Transacciones Internacionales de Electricidad de acuerdo con lo de |
| CompBolsaTIEEner | Sistema | 31 | HourlyEntities | kWh | No aplica | Compras Bolsa TIE Energía por Sistema | Energía comprada en la Bolsa de Energía para atender la demanda TIE |
| CompBolsaIntEner | Sistema | 31 | HourlyEntities | kWh | No aplica | Compras Bolsa Internacional Energía por Sistema | Energía comprada en la Bolsa para atender la demanda internacional, es decir, las exportaciones a Venezuela. La interconexión con Venezuela se hace a través de  |
| VentBolsaTIEEner | Sistema | 31 | HourlyEntities | kWh | No aplica | Ventas Bolsa TIE Energía por Sistema | Energía comprada en la Bolsa de Energía para atender la demanda TIE |
| VentBolsaIntEner | Sistema | 31 | HourlyEntities | kWh | No aplica | Ventas Bolsa Internacional Energía por Sistema | Energía vendida en la Bolsa de Energía para atender la demanda internacional. |
| CompBolsaTIEEner | Agente | 31 | HourlyEntities | kWh | Codigo Agente | Compras Bolsa TIE Energía por Agente | Energía comprada en la Bolsa de Energía para atender la demanda TIE |
| CompBolsaIntEner | Agente | 31 | HourlyEntities | kWh | Codigo Agente | Compras Bolsa Internacional Energía por Agente | Energía comprada en la Bolsa para atender la demanda internacional, es decir, las exportaciones a Venezuela. La interconexión con Venezuela se hace a través de  |
| VentBolsaTIEEner | Agente | 31 | HourlyEntities | kWh | Codigo Agente | Ventas Bolsa TIE Energía por Agente | Energía comprada en la Bolsa de Energía para atender la demanda TIE |
| VentBolsaIntEner | Agente | 31 | HourlyEntities | kWh | Codigo Agente | Ventas Bolsa Internacional Energía por Agente | Energía vendida en la Bolsa de Energía para atender la demanda internacional. |
| CompBolsaTIEMoneda | Agente | 31 | HourlyEntities | COP | Codigo Agente | Compras Bolsa TIE Moneda por Agente | Energía comprada en la Bolsa de Energía para atender la demanda TIE |
| CompBolsaIntMoneda | Agente | 31 | HourlyEntities | COP | Codigo Agente | Compras Bolsa Internacional Moneda por Agente | Energía comprada en la Bolsa para atender la demanda internacional, es decir, las exportaciones a Venezuela. La interconexión con Venezuela se hace a través de  |
| VentBolsaTIEMoneda | Agente | 31 | HourlyEntities | COP | Codigo Agente | Ventas Bolsa TIE Moneda por Agente | Energía comprada en la Bolsa de Energía para atender la demanda TIE |
| VentBolsaIntMoneda | Agente | 31 | HourlyEntities | COP | Codigo Agente | Ventas Bolsa Internacional Moneda por Agente | Energía vendida en la Bolsa de Energía para atender la demanda internacional. |
| CompBolsaTIEMoneda | Sistema | 31 | HourlyEntities | COP | No aplica | Compras Bolsa TIE Moneda por Sistema | Energía comprada en la Bolsa de Energía para atender la demanda TIE |
| CompBolsaIntMoneda | Sistema | 31 | HourlyEntities | COP | No aplica | Compras Bolsa Internacional Moneda por Sistema | Energía comprada en la Bolsa para atender la demanda internacional, es decir, las exportaciones a Venezuela. La interconexión con Venezuela se hace a través de  |
| VentBolsaTIEMoneda | Sistema | 31 | HourlyEntities | COP | No aplica | Ventas Bolsa TIE Moneda por Sistema | Energía comprada en la Bolsa de Energía para atender la demanda TIE |
| VentBolsaIntMoneda | Sistema | 31 | HourlyEntities | COP | No aplica | Ventas Bolsa Internacional Moneda por Sistema | Energía vendida en la Bolsa de Energía para atender la demanda internacional. |
| ImportMonedaCOP | Sistema | 31 | HourlyEntities | COP | No aplica | Importaciones Moneda COP por Sistema | Transferencias de Energia desde otros paises para abastecer la demanda nacional |
| ExportMonedaUSD | Sistema | 31 | HourlyEntities | COP | No aplica | Exportaciones Moneda USD por Sistema | Transferencias de Energia desde Colombia hacia otros paises |
| ImportMonedaUSD | Sistema | 31 | HourlyEntities | COP | No aplica | Importaciones Moneda USD por Sistema | Transferencias de Energia desde otros paises para abastecer la demanda nacional |
| AporEner | Sistema | 31 | DailyEntities | kWh | No aplica | Aportes  Energía por Sistema | Caudales en energia de los rios que aportan agua a algun embalse del SIN |
| VoluUtilDiarEner | Sistema | 31 | DailyEntities | kWh | No aplica | Volumen Útil diario Energía por Sistema | Volumen almacenado por encima del Nivel Minimo Tecnico, reportado diariamente por los agentes. En % corresponde a la relacion entre el Volumen Util Diario y la  |
| PrecEscaAct | Sistema | 31 | DailyEntities | COP/kWh | No aplica | Precio Escasez Activación por Sistema | Precio de Escasez de Activación calculado de acuerdo con la Resolución CREG 140 del 2017 |
| PrecEsca | Sistema | 31 | DailyEntities | COP/kWh | No aplica | Precio Escasez por Sistema | Establecido por la CREG- y actualizado mensualmente con base en la variación de un índice de precios de combustibles, tiene una doble función. Por una parte ind |
| PrecEscaMarg | Sistema | 31 | DailyEntities | COP/kWh | No aplica | Precio Marginal Escasez por Sistema | Precio Marginal de Escasez calculado de acuerdo con la Resolución CREG 140 del 2017 |
| PrecEscaSup | Sistema | 31 | DailyEntities | COP/kWh | No aplica | Precio Escasez Superior | Precio de Escasez Superior |
| PrecEscaInf | Sistema | 31 | DailyEntities | COP/kWh | No aplica | Precio Escasez Inferior | Precio de Escasez Inferior |
| DemaSIN | Sistema | 31 | DailyEntities | kWh | No aplica | Demanda Energia SIN por Sistema | Demanda del SIN, la cual se calcula con base en la generacion neta de las plantas e incluye: hidraulicas, termicas, plantas menores, cogeneradores , solares, eo |
| AporEnerMediHist | Sistema | 31 | DailyEntities | kWh | No aplica | Aportes Media Histórica Energía por Sistema | Caudal medio mensual histórico en energia para los rios del SIN, obtenido como el promedio de los valores de cada mes para todos años con información disponible |
| CapaUtilDiarEner | Sistema | 31 | DailyEntities | kWh | No aplica | Capacidad Útil Energía por Sistema | Corresponde al Volumen Útil del Embalse, que se define como el volumen almacenado entre el nivel Mínimo Técnico y el Nivel Máximo Físico |
| VoluUtilDiarEner | Embalse | 31 | DailyEntities | kWh | Nombre Embalse | Volumen Útil diario Energía por Embalse | Volumen almacenado por encima del Nivel Minimo Tecnico, reportado diariamente por los agentes. En % corresponde a la relacion entre el Volumen Util Diario y la  |
| CapaUtilDiarEner | Embalse | 31 | DailyEntities | kWh | Nombre Embalse | Capacidad Útil Energía por Embalse | Corresponde al Volumen Útil del Embalse, que se define como el volumen almacenado entre el nivel Mínimo Técnico y el Nivel Máximo Físico |
| AporEner | Rio | 31 | DailyEntities | kWh | Nombre Río | Aportes  Energía por Rio | Caudales en energia de los rios que aportan agua a algun embalse del SIN |
| AporEnerMediHist | Rio | 31 | DailyEntities | kWh | Nombre Río | Aportes Media Histórica Energía por Rio | Caudal medio mensual histórico en energia para los rios del SIN, obtenido como el promedio de los valores de cada mes para todos años con información disponible |
| VoluUtilDiarMasa | Embalse | 31 | DailyEntities | m3 | Nombre Embalse | Volumen Útil diario por Embalse | Definida como el volumen almacenado en el embalse por encima del Nivel Mínimo Técnico, inició su declaración diaria por parte de los agentes hidráulicos del mer |
| AporCaudal | Rio | 31 | DailyEntities | m3/s | Nombre Río | Aportes Caudal por Rio | Valores de la hidrologia de los caudales de los rios del SIN, en metros cubicos por segundo |
| AporCaudalMediHist | Rio | 31 | DailyEntities | m3/s | Nombre Río | Aportes Media Histórica Caudal por Rio | Caudal medio mensual histórico para los rios del SIN, obtenido como el promedio de los valores de cada mes para todos años con información disponibles |
| CapaUtilDiarMasa | Embalse | 31 | DailyEntities | m3 | Nombre Embalse | Capacidad Útil Volumen por Embalse | Corresponde al Volumen Útil del Embalse, que se define como el volumen almacenado entre el nivel Mínimo Técnico y el Nivel Máximo Físico |
| CapaUtilDiarMasa | Sistema | 31 | DailyEntities | m3 | No aplica | Capacidad Útil Volumen por Sistema | Corresponde al Volumen Útil del Embalse, que se define como el volumen almacenado entre el nivel Mínimo Técnico y el Nivel Máximo Físico |
| PorcVoluUtilDiar | Sistema | 31 | DailyEntities | % | No aplica | Volumen Útil  diario % por Sistema | Porcentaje de llenado del area util de un embalse (Volumen almacenado por encima del Nivel Mínimo Técnico) |
| PorcVoluUtilDiar | Embalse | 31 | DailyEntities | % | Nombre Embalse | Volumen Útil  diario % por Embalse | Porcentaje de llenado del area util de un embalse (Volumen almacenado por encima del Nivel Mínimo Técnico) |
| PorcApor | Sistema | 31 | DailyEntities | % | No aplica | Aportes % por Sistema | Aportes naturales de los ríos que aportan agua a algún embalse del SIN, dividido por su media histórica calculado en porcentaje  |
| PorcApor | Rio | 31 | DailyEntities | % | Nombre Río | Aportes % por Rio | Aportes naturales de los ríos que aportan agua a algún embalse del SIN, dividido por su media histórica calculado en porcentaje  |
| PrecEscaPon | Sistema | 31 | DailyEntities | COP/kWh | No aplica | Precio Escasez Ponderado por Sistema | Precio Escasez Ponderado del Sistema calculado de acuerdo a la Resolución CREG 140 de 2017 |

</details>

### Requests

| metric/entity | endpoint | window | status | error | days | codes | blank/cells | daily mean | GWh/day | daily min | daily max |
|---|---|---|---|---|---|---|---|---|---|---|---|
| ExpoEner/Sistema | hourly | recent | 200 |  | 28 | 1 | 69/672 | 3736830.794 | 3.737 | 16039.65 | 8572400.15 |
| ExpoEner/Sistema | hourly | 2024-08 | 200 |  | 31 | 1 | 2/744 | 9125389.342 | 9.125 | 4208540.23 | 10887289.06 |
| ExpoEner/Sistema | hourly | 2024-09 | 200 |  | 30 | 1 | 9/720 | 8179415.549 | 8.179 | 18805.4 | 10637505.44 |
| ExpoEner/Sistema | hourly | 2024-10 | 200 |  | 31 | 1 | 231/744 | 178415.247 | 0.178 | 10643.37 | 4776137.13 |
| ExpoEner/Sistema | hourly | 2024-11 | 200 |  | 30 | 1 | 130/720 | 4682819.838 | 4.683 | 7632.12 | 10842570.09 |
| ExpoEner/Sistema | hourly | 2024-12 | 200 |  | 31 | 1 | 7/744 | 8277751.135 | 8.278 | 3591713.73 | 10453150.98 |
| ExpoEner/Sistema | hourly | 2019-07 | 200 |  | 18 | 1 | 295/432 | 243267.369 | 0.243 | 489.67999999999995 | 1435107.01 |
| ExpoEner/Enlace | hourly | recent | 200 |  | 28 | 1 | 69/672 | 3736830.794 | 3.737 | 16039.65 | 8572400.15 |
| ExpoEner/Enlace | hourly | 2024-08 | 200 |  | 39 | 2 | 29/936 |  |  |  |  |
| ExpoEner/Enlace | hourly | 2024-09 | 200 |  | 60 | 2 | 339/1440 |  |  |  |  |
| ExpoEner/Enlace | hourly | 2024-10 | 200 |  | 33 | 2 | 266/792 |  |  |  |  |
| ExpoEner/Enlace | hourly | 2024-11 | 200 |  | 31 | 2 | 146/744 |  |  |  |  |
| ExpoEner/Enlace | hourly | 2024-12 | 200 |  | 42 | 2 | 55/1008 |  |  |  |  |
| ExpoEner/Enlace | hourly | 2019-07 | 200 |  | 18 | 1 | 295/432 | 243267.369 | 0.243 | 489.67999999999995 | 1435107.01 |
| ImpoEner/Sistema | hourly | recent | 200 |  | 14 | 1 | 267/336 | 5902.201 | 0.006 | 121.32 | 19176.42 |
| ImpoEner/Sistema | hourly | 2024-08 | 200 |  | 2 | 1 | 46/48 | 734.975 | 0.001 | 553.2 | 916.75 |
| ImpoEner/Sistema | hourly | 2024-09 | 200 |  | 1 | 1 | 15/24 | 9394.18 | 0.009 | 9394.18 | 9394.18 |
| ImpoEner/Sistema | hourly | 2024-10 | 200 |  | 30 | 1 | 489/720 | 8455.594 | 0.008 | 1599.01 | 21657.29 |
| ImpoEner/Sistema | hourly | 2024-11 | 200 |  | 16 | 1 | 254/384 | 9220.662 | 0.009 | 1572.54 | 26487.84 |
| ImpoEner/Sistema | hourly | 2024-12 | 200 |  | 2 | 1 | 41/48 | 3084.38 | 0.003 | 810.2900000000001 | 5358.47 |
| ImpoEner/Sistema | hourly | 2019-07 | 200 |  | 31 | 1 | 137/744 | 3674306.649 | 3.674 | 250558.16999999998 | 7332588.37 |
| ImpoEner/Enlace | hourly | recent | 200 |  | 14 | 1 | 267/336 | 5902.201 | 0.006 | 121.32 | 19176.42 |
| ImpoEner/Enlace | hourly | 2024-08 | 200 |  | 2 | 1 | 46/48 | 734.975 | 0.001 | 553.2 | 916.75 |
| ImpoEner/Enlace | hourly | 2024-09 | 200 |  | 1 | 1 | 15/24 | 9394.18 | 0.009 | 9394.18 | 9394.18 |
| ImpoEner/Enlace | hourly | 2024-10 | 200 |  | 30 | 1 | 489/720 | 8455.594 | 0.008 | 1599.01 | 21657.29 |
| ImpoEner/Enlace | hourly | 2024-11 | 200 |  | 16 | 1 | 254/384 | 9220.662 | 0.009 | 1572.54 | 26487.84 |
| ImpoEner/Enlace | hourly | 2024-12 | 200 |  | 2 | 1 | 41/48 | 3084.38 | 0.003 | 810.2900000000001 | 5358.47 |
| ImpoEner/Enlace | hourly | 2019-07 | 200 |  | 31 | 1 | 137/744 | 3674306.649 | 3.674 | 250558.16999999998 | 7332588.37 |
| CompBolsaTIEEner/Sistema | hourly | recent | 200 |  | 26 | 1 | 59/624 | 4077154.504 | 4.077 | 16207.27 | 8698272.44 |
| CompBolsaTIEEner/Sistema | hourly | 2024-08 | 200 |  | 31 | 1 | 2/744 | 9266360.52 | 9.266 | 4254586.29 | 11071926.39 |
| CompBolsaTIEEner/Sistema | hourly | 2024-09 | 200 |  | 30 | 1 | 9/720 | 8312711.094 | 8.313 | 19080.55 | 10800855.65 |
| CompBolsaTIEEner/Sistema | hourly | 2024-10 | 200 |  | 31 | 1 | 231/744 | 180929.272 | 0.181 | 10789.21 | 4843834.03 |
| CompBolsaTIEEner/Sistema | hourly | 2024-11 | 200 |  | 30 | 1 | 130/720 | 4747191.835 | 4.747 | 7718.2300000000005 | 10988320.53 |
| CompBolsaTIEEner/Sistema | hourly | 2024-12 | 200 |  | 31 | 1 | 7/744 | 8392019.582 | 8.392 | 3636944.38 | 10604880.59 |
| CompBolsaTIEEner/Sistema | hourly | 2019-07 | 200 |  | 18 | 1 | 295/432 | 247542.062 | 0.248 | 498.15 | 1459754.22 |
| VentBolsaTIEEner/Sistema | hourly | recent | 200 |  | 26 | 1 | 59/624 | 4077154.504 | 4.077 | 16207.27 | 8698272.44 |
| VentBolsaTIEEner/Sistema | hourly | 2024-08 | 200 |  | 31 | 1 | 2/744 | 9266360.52 | 9.266 | 4254586.29 | 11071926.39 |
| VentBolsaTIEEner/Sistema | hourly | 2024-09 | 200 |  | 30 | 1 | 9/720 | 8312711.094 | 8.313 | 19080.55 | 10800855.65 |
| VentBolsaTIEEner/Sistema | hourly | 2024-10 | 200 |  | 31 | 1 | 231/744 | 180929.272 | 0.181 | 10789.21 | 4843834.03 |
| VentBolsaTIEEner/Sistema | hourly | 2024-11 | 200 |  | 30 | 1 | 130/720 | 4747191.835 | 4.747 | 7718.2300000000005 | 10988320.53 |
| VentBolsaTIEEner/Sistema | hourly | 2024-12 | 200 |  | 31 | 1 | 7/744 | 8392019.582 | 8.392 | 3636944.38 | 10604880.59 |
| VentBolsaTIEEner/Sistema | hourly | 2019-07 | 200 |  | 18 | 1 | 295/432 | 247542.062 | 0.248 | 498.15 | 1459754.22 |
| PorcVoluUtilDiar/Sistema | daily | recent | 200 |  | 30 | 1 | 0/30 | 0.79 |  | 0.77861 | 0.79924 |
| PorcVoluUtilDiar/Sistema | daily | 2024-08 | 200 |  | 31 | 1 | 0/31 | 0.573 |  | 0.54517 | 0.5901 |
| PorcVoluUtilDiar/Sistema | daily | 2024-09 | 200 |  | 30 | 1 | 0/30 | 0.516 |  | 0.49437 | 0.54532 |
| PorcVoluUtilDiar/Sistema | daily | 2024-10 | 200 |  | 31 | 1 | 0/31 | 0.531 |  | 0.50353 | 0.55293 |
| PorcVoluUtilDiar/Sistema | daily | 2024-11 | 200 |  | 30 | 1 | 0/30 | 0.626 |  | 0.55342 | 0.67145 |
| PorcVoluUtilDiar/Sistema | daily | 2024-12 | 200 |  | 31 | 1 | 0/31 | 0.664 |  | 0.65458 | 0.68023 |
| PorcVoluUtilDiar/Sistema | daily | 2019-07 | 200 |  | 31 | 1 | 0/31 | 0.729 |  | 0.71172 | 0.75355 |
| VoluUtilDiarEner/Sistema | daily | recent | 200 |  | 30 | 1 | 0/30 | 13815284323.333 | 13815.284 | 13612601600.0 | 13984222800.0 |
| VoluUtilDiarEner/Sistema | daily | 2024-08 | 200 |  | 31 | 1 | 0/31 | 9950324603.226 | 9950.325 | 9463121400.0 | 10243944900.0 |
| VoluUtilDiarEner/Sistema | daily | 2024-09 | 200 |  | 30 | 1 | 0/30 | 8954693873.333 | 8954.694 | 8581586500.0 | 9465802900.0 |
| VoluUtilDiarEner/Sistema | daily | 2024-10 | 200 |  | 31 | 1 | 0/31 | 9211870938.71 | 9211.871 | 8740533900.0 | 9598170500.0 |
| VoluUtilDiarEner/Sistema | daily | 2024-11 | 200 |  | 30 | 1 | 0/30 | 10757279703.333 | 10757.280 | 9606651500.0 | 11527779700.0 |
| VoluUtilDiarEner/Sistema | daily | 2024-12 | 200 |  | 31 | 1 | 0/31 | 11398401945.161 | 11398.402 | 11238017700.0 | 11678420700.0 |
| VoluUtilDiarEner/Sistema | daily | 2019-07 | 200 |  | 31 | 1 | 0/31 | 12356332764.516 | 12356.333 | 12077571200.0 | 12787405300.0 |
| CapaUtilDiarEner/Sistema | daily | recent | 200 |  | 30 | 1 | 0/30 | 17489195436.0 | 17489.195 | 17483245544.0 | 17496976064.0 |
| CapaUtilDiarEner/Sistema | daily | 2024-08 | 200 |  | 31 | 1 | 0/31 | 17358380225.645 | 17358.380 | 17358205165.0 | 17359561885.0 |
| CapaUtilDiarEner/Sistema | daily | 2024-09 | 200 |  | 30 | 1 | 0/30 | 17358505710.333 | 17358.506 | 17358205165.0 | 17358655983.0 |
| CapaUtilDiarEner/Sistema | daily | 2024-10 | 200 |  | 31 | 1 | 0/31 | 17358655983.0 | 17358.656 | 17358655983.0 | 17358655983.0 |
| CapaUtilDiarEner/Sistema | daily | 2024-11 | 200 |  | 30 | 1 | 0/30 | 17174316916.6 | 17174.317 | 17167219599.0 | 17358655983.0 |
| CapaUtilDiarEner/Sistema | daily | 2024-12 | 200 |  | 31 | 1 | 0/31 | 17168413107.0 | 17168.413 | 17168413107.0 | 17168413107.0 |
| CapaUtilDiarEner/Sistema | daily | 2019-07 | 200 |  | 31 | 1 | 0/31 | 16959038902.065 | 16959.039 | 16920877858.0 | 16969480496.0 |
| AporEner/Sistema | daily | recent | 200 |  | 30 | 1 | 0/30 | 157227485.014 | 157.227 | 107513869.64 | 297238058.48 |
| AporEner/Sistema | daily | 2024-08 | 200 |  | 31 | 1 | 0/31 | 145695722.581 | 145.696 | 94708600.0 | 217941800.0 |
| AporEner/Sistema | daily | 2024-09 | 200 |  | 30 | 1 | 0/30 | 123329803.333 | 123.330 | 88334200.0 | 224118100.0 |
| AporEner/Sistema | daily | 2024-10 | 200 |  | 31 | 1 | 0/31 | 154562809.677 | 154.563 | 108667400.0 | 251414500.0 |
| AporEner/Sistema | daily | 2024-11 | 200 |  | 30 | 1 | 0/30 | 246481416.667 | 246.481 | 143955000.0 | 365055400.0 |
| AporEner/Sistema | daily | 2024-12 | 200 |  | 31 | 1 | 0/31 | 146659245.161 | 146.659 | 109013100.0 | 209463300.0 |
| AporEner/Sistema | daily | 2019-07 | 200 |  | 31 | 1 | 0/31 | 210509287.097 | 210.509 | 136799400.0 | 368347300.0 |
| AporEnerMediHist/Sistema | daily | recent | 200 |  | 30 | 1 | 0/30 | 211987000.0 | 211.987 | 208780000.0 | 219470000.0 |
| AporEnerMediHist/Sistema | daily | 2024-08 | 200 |  | 31 | 1 | 0/31 | 223310000.0 | 223.310 | 223310000.0 | 223310000.0 |
| AporEnerMediHist/Sistema | daily | 2024-09 | 200 |  | 30 | 1 | 0/30 | 211820000.0 | 211.820 | 211820000.0 | 211820000.0 |
| AporEnerMediHist/Sistema | daily | 2024-10 | 200 |  | 31 | 1 | 0/31 | 250190000.0 | 250.190 | 250190000.0 | 250190000.0 |
| AporEnerMediHist/Sistema | daily | 2024-11 | 200 |  | 30 | 1 | 0/30 | 274140000.0 | 274.140 | 274140000.0 | 274140000.0 |
| AporEnerMediHist/Sistema | daily | 2024-12 | 200 |  | 31 | 1 | 0/31 | 200930000.0 | 200.930 | 200930000.0 | 200930000.0 |
| AporEnerMediHist/Sistema | daily | 2019-07 | 200 |  | 31 | 1 | 0/31 | 218130000.0 | 218.130 | 218130000.0 | 218130000.0 |
| PorcApor/Sistema | daily | recent | 200 |  | 30 | 1 | 0/30 | 0.74 |  | 0.51496 | 1.42369 |
| PorcApor/Sistema | daily | 2024-08 | 200 |  | 31 | 1 | 0/31 | 0.652 |  | 0.42411 | 0.97596 |
| PorcApor/Sistema | daily | 2024-09 | 200 |  | 30 | 1 | 0/30 | 0.582 |  | 0.41702 | 1.05806 |
| PorcApor/Sistema | daily | 2024-10 | 200 |  | 31 | 1 | 0/31 | 0.618 |  | 0.43434 | 1.00489 |
| PorcApor/Sistema | daily | 2024-11 | 200 |  | 30 | 1 | 0/30 | 0.899 |  | 0.52511 | 1.33164 |
| PorcApor/Sistema | daily | 2024-12 | 200 |  | 31 | 1 | 0/31 | 0.73 |  | 0.54254 | 1.04247 |
| PorcApor/Sistema | daily | 2019-07 | 200 |  | 31 | 1 | 0/31 | 0.965 |  | 0.62715 | 1.68866 |
| PrecBolsNaci/Sistema | hourly | recent | 200 |  | 28 | 1 | 0/672 | 18462.547 |  | 10584.4508 | 24696.72404 |
| PrecBolsNaci/Sistema | hourly | 2024-08 | 200 |  | 31 | 1 | 0/744 | 13618.026 |  | 9480.7358 | 18851.58256 |
| PrecBolsNaci/Sistema | hourly | 2024-09 | 200 |  | 30 | 1 | 0/720 | 20968.967 |  | 13836.95432 | 59971.29768 |
| PrecBolsNaci/Sistema | hourly | 2024-10 | 200 |  | 31 | 1 | 0/744 | 36699.256 |  | 24197.00532 | 58970.48656 |
| PrecBolsNaci/Sistema | hourly | 2024-11 | 200 |  | 30 | 1 | 0/720 | 25114.402 |  | 5430.4862 | 59021.7588 |
| PrecBolsNaci/Sistema | hourly | 2024-12 | 200 |  | 31 | 1 | 0/744 | 17784.1 |  | 3897.70296 | 26108.7354 |
| PrecBolsNaci/Sistema | hourly | 2019-07 | 200 |  | 31 | 1 | 0/744 | 2935.952 |  | 2531.83712 | 3619.5874400000002 |
| PrecEscaAct/Sistema | daily | recent | 200 |  | 28 | 1 | 0/28 | 1146.811 |  | 1092.7582 | 1172.41437 |
| PrecEscaAct/Sistema | daily | 2024-08 | 200 |  | 31 | 1 | 0/31 | 920.817 |  | 920.81738 | 920.81738 |
| PrecEscaAct/Sistema | daily | 2024-09 | 200 |  | 30 | 1 | 0/30 | 932.49 |  | 932.49018 | 932.49018 |
| PrecEscaAct/Sistema | daily | 2024-10 | 200 |  | 31 | 1 | 0/31 | 945.31 |  | 945.3104 | 945.3104 |
| PrecEscaAct/Sistema | daily | 2024-11 | 200 |  | 30 | 1 | 0/30 | 936.06 |  | 936.05983 | 936.05983 |
| PrecEscaAct/Sistema | daily | 2024-12 | 200 |  | 31 | 1 | 0/31 | 948.845 |  | 948.84506 | 948.84506 |
| PrecEscaAct/Sistema | daily | 2019-07 | 200 |  | 31 | 1 | 0/31 | 696.677 |  | 696.67692 | 696.67692 |
| DemaSIN/Sistema | daily | recent | 200 |  | 29 | 1 | 0/29 | 243149576.172 | 243.150 | 133890.0 | 266715196.42 |
| DemaSIN/Sistema | daily | 2024-08 | 200 |  | 31 | 1 | 0/31 | 224934931.975 | 224.935 | 198791978.03 | 239298823.03 |
| DemaSIN/Sistema | daily | 2024-09 | 200 |  | 30 | 1 | 0/30 | 228935812.597 | 228.936 | 196819545.88 | 242374687.84 |
| DemaSIN/Sistema | daily | 2024-10 | 200 |  | 31 | 1 | 0/31 | 226582229.498 | 226.582 | 201765623.0 | 241010236.12 |
| DemaSIN/Sistema | daily | 2024-11 | 200 |  | 30 | 1 | 0/30 | 220211948.009 | 220.212 | 193684982.64 | 234173195.42 |
| DemaSIN/Sistema | daily | 2024-12 | 200 |  | 31 | 1 | 0/31 | 223078680.228 | 223.079 | 187020782.6 | 239011667.83 |
| DemaSIN/Sistema | daily | 2019-07 | 200 |  | 31 | 1 | 0/31 | 198284421.572 | 198.284 | 175750068.97 | 208346126.09 |
| ImpoMoneda/Enlace | hourly | recent | 200 |  | 14 | 1 | 267/336 | 3995180.722 |  | 61811.4 | 12409605.549999999 |
| ImpoMoneda/Enlace | hourly | 2024-10 | 200 |  | 30 | 1 | 489/720 | 14384532.402 |  | 3322125.07 | 35727612.57 |
| ExpoMoneda/Enlace | hourly | recent | 200 |  | 28 | 1 | 69/672 | 5040720368.455 |  | 9500246.9 | 14191493797.83 |
| ExpoMoneda/Enlace | hourly | 2024-10 | 200 |  | 33 | 2 | 266/792 |  |  |  |  |
| CompBolsaTIEEner/Agente | hourly | recent | 200 |  | 26 | 1 | 59/624 | 4077154.504 | 4.077 | 16207.27 | 8698272.44 |
| CompBolsaTIEEner/Agente | hourly | 2024-10 | 200 |  | 31 | 1 | 231/744 | 180929.272 | 0.181 | 10789.21 | 4843834.03 |
| VentBolsaTIEEner/Agente | hourly | recent | 200 |  | 147 | 12 | 2715/3528 |  |  |  |  |
| VentBolsaTIEEner/Agente | hourly | 2024-10 | 200 |  | 138 | 11 | 2794/3312 |  |  |  |  |

### Per entity code (Enlace and other multi-code answers)

| metric/entity | window | code | days with values | blank cells | daily mean | GWh/day | min | max |
|---|---|---|---|---|---|---|---|---|
| ExpoEner/Enlace | 2024-08 | ECUADOR 230 | 31 | 2 | 9072606.56 | 9.073 | 4208540.23 | 10887289.06 |
| ExpoEner/Enlace | 2024-08 | ECUADOR 138 | 8 | 27 | 204533.28 | 0.205 | 173791.88999999998 | 229287.15 |
| ExpoEner/Enlace | 2024-09 | ECUADOR 138 | 30 | 330 | 123351.308 | 0.123 | 656.83 | 233159.07 |
| ExpoEner/Enlace | 2024-09 | ECUADOR 230 | 30 | 9 | 8056064.241 | 8.056 | 18148.57 | 10405623.040000001 |
| ExpoEner/Enlace | 2024-10 | ECUADOR 138 | 2 | 35 | 55518.385 | 0.056 | 1033.36 | 110003.41 |
| ExpoEner/Enlace | 2024-10 | ECUADOR 230 | 31 | 231 | 174833.416 | 0.175 | 10643.37 | 4666133.72 |
| ExpoEner/Enlace | 2024-11 | ECUADOR 230 | 30 | 130 | 4682817.372 | 4.683 | 7632.12 | 10842570.09 |
| ExpoEner/Enlace | 2024-11 | ECUADOR 138 | 1 | 16 | 73.99 | 0.000 | 73.99 | 73.99 |
| ExpoEner/Enlace | 2024-12 | ECUADOR 230 | 31 | 7 | 8211375.77 | 8.211 | 3349967.98 | 10453150.98 |
| ExpoEner/Enlace | 2024-12 | ECUADOR 138 | 11 | 48 | 187057.845 | 0.187 | 112511.56999999999 | 241745.75 |
| ExpoMoneda/Enlace | 2024-10 | ECUADOR 138 | 2 | 35 | 95977551.045 |  | 996685.43 | 190958416.66 |
| ExpoMoneda/Enlace | 2024-10 | ECUADOR 230 | 31 | 231 | 286007709.272 |  | 10880224.6 | 7690209969.559999 |
| VentBolsaTIEEner/Agente | recent | ENDG | 17 | 336 | 389669.655 | 0.390 | 1798.84 | 1896532.5899999999 |
| VentBolsaTIEEner/Agente | recent | EPMG | 26 | 360 | 1387545.802 | 1.388 | 5061.56 | 4282749.7700000005 |
| VentBolsaTIEEner/Agente | recent | ISGG | 26 | 406 | 1352591.276 | 1.353 | 370.19 | 4662605.22 |
| VentBolsaTIEEner/Agente | recent | TCIG | 5 | 107 | 476179.152 | 0.476 | 179968.33 | 1040177.76 |
| VentBolsaTIEEner/Agente | recent | EMUG | 11 | 237 | 207307.816 | 0.207 | 10409.66 | 489391.3 |
| VentBolsaTIEEner/Agente | recent | EPSG | 24 | 439 | 586458.172 | 0.586 | 748.09 | 1818389.02 |
| VentBolsaTIEEner/Agente | recent | TMFG | 14 | 308 | 251205.321 | 0.251 | 72.57 | 948627.78 |
| VentBolsaTIEEner/Agente | recent | PRIG | 2 | 43 | 112500.0 | 0.113 | 90000.0 | 135000.0 |
| VentBolsaTIEEner/Agente | recent | TBSG | 9 | 189 | 515741.738 | 0.516 | 340.96 | 987782.79 |
| VentBolsaTIEEner/Agente | recent | GECG | 11 | 244 | 92348.983 | 0.092 | 245.71 | 306345.25 |
| VentBolsaTIEEner/Agente | recent | SOCG | 1 | 23 | 1737.34 | 0.002 | 1737.34 | 1737.34 |
| VentBolsaTIEEner/Agente | recent | NTCG | 1 | 23 | 664.81 | 0.001 | 664.81 | 664.81 |
| VentBolsaTIEEner/Agente | 2024-10 | CHVG | 15 | 305 | 61150.029 | 0.061 | 1266.01 | 871159.6799999999 |
| VentBolsaTIEEner/Agente | 2024-10 | EPMG | 22 | 433 | 69955.71 | 0.070 | 234.48 | 1386357.22 |
| VentBolsaTIEEner/Agente | 2024-10 | EPSG | 22 | 475 | 9159.983 | 0.009 | 77.46 | 94385.25 |
| VentBolsaTIEEner/Agente | 2024-10 | ISGG | 29 | 528 | 93393.435 | 0.093 | 1071.1 | 2491931.88 |
| VentBolsaTIEEner/Agente | 2024-10 | ENDG | 25 | 493 | 7573.965 | 0.008 | 739.23 | 50408.340000000004 |
| VentBolsaTIEEner/Agente | 2024-10 | TMNG | 3 | 67 | 3865.893 | 0.004 | 1111.34 | 8091.9400000000005 |
| VentBolsaTIEEner/Agente | 2024-10 | TMVG | 7 | 160 | 1819.153 | 0.002 | 371.79 | 4606.67 |
| VentBolsaTIEEner/Agente | 2024-10 | TBSG | 6 | 131 | 2357.845 | 0.002 | 719.74 | 4911.68 |
| VentBolsaTIEEner/Agente | 2024-10 | TCBG | 3 | 69 | 1603.333 | 0.002 | 415.4 | 3218.18 |
| VentBolsaTIEEner/Agente | 2024-10 | TEMG | 4 | 88 | 1782.507 | 0.002 | 84.85 | 4615.19 |
| VentBolsaTIEEner/Agente | 2024-10 | TCIG | 2 | 45 | 1417.08 | 0.001 | 1410.66 | 1423.5 |

### What each candidate should answer

| metric/entity | in catalog | unit | MaxDays | question | name source |
|---|---|---|---|---|---|
| ExpoEner/Sistema | True | kWh | 31 | Colombia's total exports (kWh per hour). With the Venezuela link idle this is roughly Ecuador; 2024-10 should show the collapse to ~0.12 GWh/day seen from Ecuador | API_XM pydataxm/metricasAPI.json (2024-11-14) + README metric list |
| ExpoEner/Enlace | True | kWh | 31 | Exports per interconnection link: which codes are the Ecuador circuits, and the per-link hourly ceiling actually reached | ListadoMetricas dumps on GitHub (danielbenavides-git/tesis data/raw/XM/catalogo_metricas_xm.csv; GNUTADEO/Tuxilo data/XM/CatalogoSINERGOX.csv) |
| ImpoEner/Sistema | True | kWh | 31 | Colombia's imports, i.e. the reverse flow (Ecuador exporting to Colombia) | API_XM pydataxm/metricasAPI.json (2024-11-14) + README metric list |
| ImpoEner/Enlace | True | kWh | 31 | Imports per link | ListadoMetricas dumps on GitHub (danielbenavides-git/tesis data/raw/XM/catalogo_metricas_xm.csv; GNUTADEO/Tuxilo data/XM/CatalogoSINERGOX.csv) |
| CompBolsaTIEEner/Sistema | True | kWh | 31 | Energy bought in the Colombian pool to serve TIE (Ecuador) demand: the market-side view of exports | API_XM pydataxm/metricasAPI.json (2024-11-14) + README metric list |
| VentBolsaTIEEner/Sistema | True | kWh | 31 | Energy sold in the pool under TIE: the other side of the same trade | API_XM pydataxm/metricasAPI.json (2024-11-14) + README metric list |
| PorcVoluUtilDiar/Sistema | True | % | 31 | Aggregate Colombian useful storage, % (the state that drove the 2024 cutoff) | API_XM pydataxm/metricasAPI.json (2024-11-14) + README metric list |
| VoluUtilDiarEner/Sistema | True | kWh | 31 | Aggregate useful storage in energy terms (kWh) | API_XM pydataxm/metricasAPI.json (2024-11-14) + README metric list |
| CapaUtilDiarEner/Sistema | True | kWh | 31 | Aggregate useful capacity (kWh), the denominator of the % above | API_XM pydataxm/metricasAPI.json (2024-11-14) + README metric list |
| AporEner/Sistema | True | kWh | 31 | Daily inflows in energy terms (kWh) | API_XM pydataxm/metricasAPI.json (2024-11-14) + README metric list |
| AporEnerMediHist/Sistema | True | kWh | 31 | Historical mean inflows for the same days (kWh) | API_XM pydataxm/metricasAPI.json (2024-11-14) + README metric list |
| PorcApor/Sistema | True | % | 31 | Inflows as % of the historical mean: Colombia's drought signal | API_XM pydataxm/metricasAPI.json (2024-11-14) + README metric list |
| PrecBolsNaci/Sistema | True | COP/kWh | 31 | Colombian spot price (COP/kWh); TIE flows follow the price differential | API_XM pydataxm/metricasAPI.json (2024-11-14) + README metric list |
| PrecEscaAct/Sistema | True | COP/kWh | 31 | Scarcity activation price (COP/kWh); spot above it marks Colombia's own scarcity | API_XM pydataxm/metricasAPI.json (2024-11-14) + README metric list |
| DemaSIN/Sistema | True | kWh | 31 | Colombian national demand (kWh), to size the exportable surplus | API_XM pydataxm/metricasAPI.json (2024-11-14) + README metric list |
| ImpoMoneda/Enlace | True | COP | 31 | discovered in ListadoMetricas: Importaciones Moneda | live ListadoMetricas |
| ExpoMoneda/Enlace | True | COP | 31 | discovered in ListadoMetricas: Exportaciones Moneda | live ListadoMetricas |
| CompBolsaTIEEner/Agente | True | kWh | 31 | discovered in ListadoMetricas: Compras Bolsa TIE Energía por Agente | live ListadoMetricas |
| VentBolsaTIEEner/Agente | True | kWh | 31 | discovered in ListadoMetricas: Ventas Bolsa TIE Energía por Agente | live ListadoMetricas |

### SIMEM (simem.co)

Catalog `e007fb`: status 200, 381 datasets, 20 match exchange/Ecuador/storage terms.

<details><summary>Matching catalog records</summary>

- `{"idDataset": "8d3ccd", "nombreConjuntoDatos": "Proyección de embalse agregado de corto plazo", "fechaPublicacion": "2024-09-06T08:42:12.99", "fechaActualizacion": "2026-09-20T19:15:15.03", "inicioDato": "2024-08-26T00:00:00", "finDato": "2026-09-27T00:00:00", "fechaDescarga": "2025-02-21T15:30:24.49", "urlConexionAPI": "https://www.simem.coPublicData?startDate=2026-09-22&endDate=2026-09-22&datase`
- `{"idDataset": "4A17B1", "nombreConjuntoDatos": "Magnitud de generación de seguridad del país importador", "fechaPublicacion": "2023-09-28T20:27:03.407", "fechaActualizacion": "2026-09-22T04:35:29.083", "inicioDato": "2021-09-06T00:00:00", "finDato": "2026-09-06T00:00:00", "fechaDescarga": null, "urlConexionAPI": "https://www.simem.coPublicData?startDate=2026-09-22&endDate=2026-09-22&datasetId=4A17`
- `{"idDataset": "860c86", "nombreConjuntoDatos": "Estudio Interconexión Colombia Ecuador", "fechaPublicacion": "2023-09-30T22:56:28.613", "fechaActualizacion": "2026-08-10T18:47:03.05", "inicioDato": "2022-01-01T00:00:00", "finDato": "2025-01-01T00:00:00", "fechaDescarga": null, "urlConexionAPI": "https://www.simem.coPublicData?startDate=2026-09-22&endDate=2026-09-22&datasetId=860c86", "urlConjuntoD`
- `{"idDataset": "1E0AC7", "nombreConjuntoDatos": "Compras en bolsa TIE en moneda", "fechaPublicacion": "2024-11-07T10:33:56.017", "fechaActualizacion": "2026-09-22T04:38:36.69", "inicioDato": "2021-01-01T00:00:00", "finDato": "2026-09-17T00:00:00", "fechaDescarga": null, "urlConexionAPI": "https://www.simem.coPublicData?startDate=2026-09-22&endDate=2026-09-22&datasetId=1E0AC7", "urlConjuntoDatos": "`
- `{"idDataset": "7E5EA7", "nombreConjuntoDatos": "Ajuste Transacciones TIE", "fechaPublicacion": "2023-09-28T23:37:22.983", "fechaActualizacion": "2026-09-18T15:42:41.53", "inicioDato": "2022-01-01T00:00:00", "finDato": "2026-08-22T00:00:00", "fechaDescarga": "2024-10-17T17:41:55.523", "urlConexionAPI": "https://www.simem.coPublicData?startDate=2026-09-22&endDate=2026-09-22&datasetId=7E5EA7", "urlCo`
- `{"idDataset": "842296", "nombreConjuntoDatos": "Energía calculada para plantas hidráulicas por reconciliación positiva asociada a la exportación hacia Ecuador", "fechaPublicacion": "2023-09-28T20:27:03.407", "fechaActualizacion": "2026-09-22T04:38:12.767", "inicioDato": "2021-09-06T00:00:00", "finDato": "2026-09-06T00:00:00", "fechaDescarga": null, "urlConexionAPI": "https://www.simem.coPublicData`
- `{"idDataset": "6D6E23", "nombreConjuntoDatos": "Ventas en bolsa internacional en moneda", "fechaPublicacion": "2024-11-07T10:33:56.017", "fechaActualizacion": "2026-09-22T04:38:45.667", "inicioDato": "2021-01-01T00:00:00", "finDato": "2026-09-17T00:00:00", "fechaDescarga": null, "urlConexionAPI": "https://www.simem.coPublicData?startDate=2026-09-22&endDate=2026-09-22&datasetId=6D6E23", "urlConjunt`
- `{"idDataset": "E93F85", "nombreConjuntoDatos": "Magnitud energía en bolsa internacional a cargo", "fechaPublicacion": "2024-11-07T10:33:56.017", "fechaActualizacion": "2026-09-22T04:39:40.617", "inicioDato": "2021-01-01T00:00:00", "finDato": "2026-09-17T00:00:00", "fechaDescarga": null, "urlConexionAPI": "https://www.simem.coPublicData?startDate=2026-09-22&endDate=2026-09-22&datasetId=E93F85", "ur`
- `{"idDataset": "b9f2ec", "nombreConjuntoDatos": "Información de Transferencias Internacionales", "fechaPublicacion": "2023-10-05T17:03:50.45", "fechaActualizacion": "2026-09-22T08:30:32.09", "inicioDato": "2013-01-01T00:00:00", "finDato": "2026-09-21T00:00:00", "fechaDescarga": "2025-03-04T16:15:44.65", "urlConexionAPI": "https://www.simem.coPublicData?startDate=2026-09-22&endDate=2026-09-22&datase`
- `{"idDataset": "11364C", "nombreConjuntoDatos": "Magnitud ventas en bolsa internacional en energía", "fechaPublicacion": "2024-11-07T10:33:56.017", "fechaActualizacion": "2026-09-22T04:39:17.4", "inicioDato": "2021-01-01T00:00:00", "finDato": "2026-09-17T00:00:00", "fechaDescarga": null, "urlConexionAPI": "https://www.simem.coPublicData?startDate=2026-09-22&endDate=2026-09-22&datasetId=11364C", "ur`
- `{"idDataset": "7f16cb", "nombreConjuntoDatos": "Información de Transferencias Internacionales", "fechaPublicacion": "2023-10-05T16:01:29.07", "fechaActualizacion": "2026-09-22T08:28:28.8", "inicioDato": "2013-01-01T00:00:00", "finDato": "2026-09-21T00:00:00", "fechaDescarga": "2025-05-01T19:11:07.537", "urlConexionAPI": "https://www.simem.coPublicData?startDate=2026-09-22&endDate=2026-09-22&datase`
- `{"idDataset": "C35A63", "nombreConjuntoDatos": "Precio de oferta en el nodo frontera para exportación", "fechaPublicacion": "2023-09-28T22:45:20.783", "fechaActualizacion": "2026-09-22T04:41:19.073", "inicioDato": "2013-01-01T00:00:00", "finDato": "2026-09-19T00:00:00", "fechaDescarga": null, "urlConexionAPI": "https://www.simem.coPublicData?startDate=2026-09-22&endDate=2026-09-22&datasetId=C35A63`
- `{"idDataset": "6B9E0C", "nombreConjuntoDatos": "Generación ideal internacional Venezuela por recurso planta", "fechaPublicacion": "2023-09-28T20:27:03.407", "fechaActualizacion": "2026-09-22T04:37:59.79", "inicioDato": "2022-05-01T00:00:00", "finDato": "2026-09-19T00:00:00", "fechaDescarga": null, "urlConexionAPI": "https://www.simem.coPublicData?startDate=2026-09-22&endDate=2026-09-22&datasetId=6`
- `{"idDataset": "d4049a", "nombreConjuntoDatos": "Importaciones Netas Energético Largo Plazo", "fechaPublicacion": "2023-10-11T09:04:15.97", "fechaActualizacion": "2026-09-15T18:21:01.84", "inicioDato": "2022-01-01T00:00:00", "finDato": "2031-08-01T00:00:00", "fechaDescarga": "2025-04-17T18:46:48.843", "urlConexionAPI": "https://www.simem.coPublicData?startDate=2026-09-22&endDate=2026-09-22&datasetI`
- `{"idDataset": "A88E47", "nombreConjuntoDatos": "Ventas en bolsa TIE en moneda", "fechaPublicacion": "2024-11-07T10:33:56.017", "fechaActualizacion": "2026-09-22T04:38:14.023", "inicioDato": "2021-01-01T00:00:00", "finDato": "2026-09-17T00:00:00", "fechaDescarga": null, "urlConexionAPI": "https://www.simem.coPublicData?startDate=2026-09-22&endDate=2026-09-22&datasetId=A88E47", "urlConjuntoDatos": "`
- `{"idDataset": "70E9A6", "nombreConjuntoDatos": "Deltas incremento nacional e internacional", "fechaPublicacion": "2025-07-07T14:18:36.45", "fechaActualizacion": "2026-09-22T04:37:40.477", "inicioDato": "2021-01-01T00:00:00", "finDato": "2026-09-19T00:00:00", "fechaDescarga": null, "urlConexionAPI": "https://www.simem.coPublicData?startDate=2026-09-22&endDate=2026-09-22&datasetId=70E9A6", "urlConju`
- `{"idDataset": "4295B4", "nombreConjuntoDatos": "Compras en bolsa internacional en moneda", "fechaPublicacion": "2024-11-07T10:33:56.017", "fechaActualizacion": "2026-09-22T04:44:46.737", "inicioDato": "2021-01-01T00:00:00", "finDato": "2026-09-17T00:00:00", "fechaDescarga": null, "urlConexionAPI": "https://www.simem.coPublicData?startDate=2026-09-22&endDate=2026-09-22&datasetId=4295B4", "urlConjun`
- `{"idDataset": "1088a6", "nombreConjuntoDatos": "Importaciones Netas Energético Mediano Plazo", "fechaPublicacion": "2023-09-30T11:57:45.303", "fechaActualizacion": "2026-09-20T19:23:08.98", "inicioDato": "2022-01-03T00:00:00", "finDato": "2028-09-11T00:00:00", "fechaDescarga": "2025-02-18T11:47:51.75", "urlConexionAPI": "https://www.simem.coPublicData?startDate=2026-09-22&endDate=2026-09-22&datase`
- `{"idDataset": "31E0AF", "nombreConjuntoDatos": "Demanda comercial internacional", "fechaPublicacion": "2025-07-07T11:09:14.51", "fechaActualizacion": "2026-09-22T04:37:10.91", "inicioDato": "2021-01-01T00:00:00", "finDato": "2026-09-19T00:00:00", "fechaDescarga": null, "urlConexionAPI": "https://www.simem.coPublicData?startDate=2026-09-22&endDate=2026-09-22&datasetId=31E0AF", "urlConjuntoDatos": "`
- `{"idDataset": "CDD16E", "nombreConjuntoDatos": "Generación ideal internacional Ecuador por planta", "fechaPublicacion": "2023-09-28T20:27:03.407", "fechaActualizacion": "2026-09-22T04:36:12.577", "inicioDato": "2021-01-01T00:00:00", "finDato": "2026-09-19T00:00:00", "fechaDescarga": null, "urlConexionAPI": "https://www.simem.coPublicData?startDate=2026-09-22&endDate=2026-09-22&datasetId=CDD16E", "`

</details>

| dataset | name | granularity | window | status | records | lastUpdate | message | record keys |
|---|---|---|---|---|---|---|---|---|
| b9f2ec | Información de Transferencias Internacionales | Diaria | recent | 200 | 28 | 2026-09-22 08:30:32 |  | CodigoEnlace, EnergiaImportadaProgramadaRedespacho, EnergiaImportadaRealEstimada, Fecha, PaisInterCambioInternacional |
| b9f2ec | Información de Transferencias Internacionales | Diaria | 2024-10 | 200 | 62 | 2026-09-22 08:30:32 |  | CodigoEnlace, EnergiaImportadaProgramadaRedespacho, EnergiaImportadaRealEstimada, Fecha, PaisInterCambioInternacional |
| b9f2ec | Información de Transferencias Internacionales | Diaria | 2019-07 | 200 | 62 | 2026-09-22 08:30:32 |  | CodigoEnlace, EnergiaImportadaProgramadaRedespacho, EnergiaImportadaRealEstimada, Fecha, PaisInterCambioInternacional |
| 7f16cb | Información de Transferencias Internacionales | Diaria | recent | 200 | 68 | 2026-09-22 08:28:28 |  | CodigoEnlace, EnergiaExportadaProgramadaRedespachoDia, EnergiaExportadaRealEstimada, Fecha, PaisInterCambioInternacional |
| 7f16cb | Información de Transferencias Internacionales | Diaria | 2024-10 | 200 | 62 | 2026-09-22 08:28:28 |  | CodigoEnlace, EnergiaExportadaProgramadaRedespachoDia, EnergiaExportadaRealEstimada, Fecha, PaisInterCambioInternacional |
| 7f16cb | Información de Transferencias Internacionales | Diaria | 2019-07 | 200 | 62 | 2026-09-22 08:28:28 |  | CodigoEnlace, EnergiaExportadaProgramadaRedespachoDia, EnergiaExportadaRealEstimada, Fecha, PaisInterCambioInternacional |
| 860c86 | Estudio Interconexión Colombia Ecuador | NA | recent | 200 | 0 | 2026-08-10 18:47:03 |  |  |
| 860c86 | Estudio Interconexión Colombia Ecuador | NA | 2024-10 | 200 | 2918676 | 2026-08-10 18:47:03 |  |  |
| 860c86 | Estudio Interconexión Colombia Ecuador | NA | 2019-07 | 200 | 0 | 2026-08-10 18:47:03 |  |  |
| CDD16E | Generación ideal internacional Ecuador por planta | Horaria | recent | 200 | 4632 | 2026-09-22 04:36:12 |  | CodigoDuracion, CodigoPlanta, CodigoVariable, FechaHora, UnidadMedida, Valor, Version |
| CDD16E | Generación ideal internacional Ecuador por planta | Horaria | 2024-10 | 200 | 43368 | 2026-09-22 04:36:12 |  | CodigoDuracion, CodigoPlanta, CodigoVariable, FechaHora, UnidadMedida, Valor, Version |
| CDD16E | Generación ideal internacional Ecuador por planta | Horaria | 2019-07 | 200 | 0 | 2026-09-22 04:36:12 |  |  |
| C35A63 | Precio de oferta en el nodo frontera para exportación | Horaria | recent | 200 | 1056 | 2026-09-22 04:41:19 |  | CodigoDuracion, CodigoPlanta, CodigoSICAgente, CodigoVariable, FechaHora, UnidadMedida, Valor, Version |
| C35A63 | Precio de oferta en el nodo frontera para exportación | Horaria | 2024-10 | 200 | 10416 | 2026-09-22 04:41:19 |  | CodigoDuracion, CodigoPlanta, CodigoSICAgente, CodigoVariable, FechaHora, UnidadMedida, Valor, Version |
| C35A63 | Precio de oferta en el nodo frontera para exportación | Horaria | 2019-07 | 200 | 1488 | 2026-09-22 04:41:19 |  | CodigoDuracion, CodigoPlanta, CodigoSICAgente, CodigoVariable, FechaHora, UnidadMedida, Valor, Version |
| 31E0AF | Demanda comercial internacional | Diaria | recent | 200 | 22 | 2026-09-22 04:37:10 |  | CodigoDuracion, CodigoVariable, FechaInicio, UnidadMedida, Valor, Version |
| 31E0AF | Demanda comercial internacional | Diaria | 2024-10 | 200 | 62 | 2026-09-22 04:37:10 |  | CodigoDuracion, CodigoVariable, FechaInicio, UnidadMedida, Valor, Version |
| 31E0AF | Demanda comercial internacional | Diaria | 2019-07 | 200 | 0 | 2026-09-22 04:37:10 |  |  |
| 4A17B1 | Magnitud de generación de seguridad del país importador | Diaria | recent | 200 | 0 | 2026-09-22 04:35:29 |  |  |
| 4A17B1 | Magnitud de generación de seguridad del país importador | Diaria | 2024-10 | 200 | 144 | 2026-09-22 04:35:29 |  | CodigoDuracion, CodigoPlanta, CodigoVariable, FechaHora, UnidadMedida, Valor, Version |
| 4A17B1 | Magnitud de generación de seguridad del país importador | Diaria | 2019-07 | 200 | 0 | 2026-09-22 04:35:29 |  |  |
| 842296 | Energía calculada para plantas hidráulicas por reconciliación positiva asociada a la exportación hacia Ecuador | Horaria | recent | 200 | 0 | 2026-09-22 04:38:12 |  |  |
| 842296 | Energía calculada para plantas hidráulicas por reconciliación positiva asociada a la exportación hacia Ecuador | Horaria | 2024-10 | 200 | 432 | 2026-09-22 04:38:12 |  | CodigoDuracion, CodigoPlanta, CodigoVariable, FechaHora, UnidadMedida, Valor, Version |
| 842296 | Energía calculada para plantas hidráulicas por reconciliación positiva asociada a la exportación hacia Ecuador | Horaria | 2019-07 | 200 | 0 | 2026-09-22 04:38:12 |  |  |
| 1088a6 | Importaciones Netas Energético Mediano Plazo | Semanal | recent | 200 | 478031 | 2026-09-20 19:23:08 |  | AnioEstudio, Caso, CodigoAreaOperativa, Etapa, FechaFin, FechaInicio, FechaPublicacion, ImpNetas, NombreCaso, SemanaEstudio |
| 1088a6 | Importaciones Netas Energético Mediano Plazo | Semanal | 2024 | 200 | 336700 | 2026-09-20 19:23:08 |  | AnioEstudio, Caso, CodigoAreaOperativa, Etapa, FechaFin, FechaInicio, FechaPublicacion, ImpNetas, NombreCaso, SemanaEstudio |
| 8d3ccd | Proyección de embalse agregado de corto plazo | Diaria | recent | 200 | 1944 | 2026-09-20 19:15:15 |  | AnioEstudio, AreaOperativa, Caso, CodigoVariable, EsProyeccion, Etapa, FechaEjecucion, FechaHora, NombreCaso, SemanaEstudio, Valor |
| 8d3ccd | Proyección de embalse agregado de corto plazo | Diaria | 2024-10 | 200 | 3408 | 2026-09-20 19:15:15 |  | AnioEstudio, AreaOperativa, Caso, CodigoVariable, EsProyeccion, Etapa, FechaEjecucion, FechaHora, NombreCaso, SemanaEstudio, Valor |
| 8d3ccd | Proyección de embalse agregado de corto plazo | Diaria | 2019-07 | 200 | 0 | 2026-09-20 19:15:15 |  |  |

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
| robots:servapibi.xm.com.co | 404 |  |
| robots:www.simem.co | 404 |  |

## Section errors

None.
