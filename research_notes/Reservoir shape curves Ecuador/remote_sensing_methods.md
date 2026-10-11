# Remote-sensing methods for area–elevation–volume (AEV) curves of small Andean canyon reservoirs (Ecuador)

Research date: 2026-10-11. Note on method: WebFetch and most publisher and STAC hosts (hess.copernicus.org, pmc, wiley, planetarycomputer.microsoft.com, earth-search.aws.element84.com, element84.com) could not be reached from this sandbox: DNS failure or proxy 403. Paper findings below therefore come from search-result abstracts and snippets, not full texts. The bucket endpoints were probed directly with curl, and items marked "probed 2026-10-11" were confirmed live from this sandbox.

Reference numbers computed from the user's Mazar water-balance curve A = 48.3 (h − 2036.66)^2.5 m² (my arithmetic, not a source):
| h (m) | A (km²) | dA/dh (m²/m) |
|---|---|---|
| 2098 | 1.42 | 58 000 |
| 2100 | 1.54 | 61 000 |
| 2120 | 3.06 | 92 000 |
| 2140 | 5.24 | 127 000 |
| 2153 | 7.05 | 152 000 |
- V(2100→2153) = 206.5 hm³, which matches the user's ~206 hm³.
- V(2036.66→2153) is about 234 hm³. Compare the publicly quoted gross capacity of 410 hm³ (see Q5).
- Applying a curve with an unaligned vertical datum shifts the live volume (2100–2153) by: 1 m → 2.7 %, 2 m → 5.4 %, 5 m → 13.9 %, 10 m → 28.9 %.

---

## Q1. Method 1: pre-impoundment DEM contour integration (SRTM/NASADEM, Copernicus GLO-30, AW3D30, FABDEM). Accuracy in steep, vegetated Andean valleys, and datum alignment

### Takeaway
- Integrating the area enclosed by DEM contours below full supply level is the standard way to get an AEV curve when bathymetry is missing. It works only if the DEM predates impoundment, or if the part below water is extrapolated.
- Its accuracy is limited by DEM vertical error. Global DEMs have about 5–9 m RMSE/MAE in steep, forested terrain. Forest canopy biases C-band and X-band DSMs upward, which FABDEM partly removes.
- For small dams in rugged terrain, published SRTM-derived volume errors run from under 20 % to over 150 %.
- The vertical datum must be aligned empirically, by matching satellite shorelines at gauged levels to DEM contours. Each 1 m of misalignment costs Mazar about 2.7 % of live volume.

### Cited Findings
- **SRTM-derived volume–elevation curves for small dams.** Ten small dams were tested against GPS surveys. SRTM 1″ was adequate where terrain is smooth: errors stayed under 20 % when the terrain ruggedness index standard deviation (TRI SD) was below 0.1, but exceeded 150 % when TRI SD was above 0.1. Per-site errors ranged from 0 % to 177 %, and absolute volume MAE ran from 6 906 to 788 841 m³. Terrain roughness drives the error. — [Sci. Rep. 2025, "Assessing SRTM one Arc second DEM accuracy for small dam volume-elevation curves using terrain metrics"](https://www.nature.com/articles/s41598-025-30483-7) (also [PMC12749584](https://pmc.ncbi.nlm.nih.gov/articles/PMC12749584))
- **DEM vertical accuracy against ICESat-2 in steep terrain (China).** RMSE was 6.73 m for Copernicus, 6.59 m for NASADEM and 6.63 m for AW3D30. Accuracy correlates with slope, and land cover matters more than slope. Forest on steep mountains was the weak point for all three DEMs, with NASADEM somewhat better over forest. — [Int. J. Digital Earth 2022, "Global DEMs vary from one to another…"](https://www.tandfonline.com/doi/full/10.1080/17538947.2022.2094002)
- **Qinghai-Tibet Plateau.** Mean absolute error averaged 5.14 m for ALOS (AW3D30), 7.02 m for NASADEM and 8.79 m for Copernicus across slope classes. — [Int. J. Digital Earth 2023](https://www.tandfonline.com/doi/full/10.1080/17538947.2023.2297843)
- **Producer specifications.** Vertical RMSE is about 1.68 m for Copernicus, 5.5 m for NASADEM and 4.4 m for AW3D30. These are not site-specific figures. — cited within [Int. J. Digital Earth 2022](https://www.tandfonline.com/doi/full/10.1080/17538947.2022.2094002)
- **FABDEM (forest- and building-removed Copernicus DEM).**
  - In forest, it reduces mean absolute vertical error from 5.15 m to 2.88 m.
  - Where canopy cover exceeds 50 %, median error is 0.45 m for FABDEM against 12.95 m for GLO-30.
  - In a steep, densely forested catchment checked against UAV lidar, it had 24 % lower RMSE and 135 % lower bias than Copernicus-30.
  - Sources: [EGU22-8994](https://meetingorganizer.copernicus.org/EGU22/EGU22-8994.html); [sciforum 13368](https://sciforum.net/paper/view/13368)
- **FABDEM ranks first in other comparisons.** It ranked first against airborne lidar in flood-prone environments ([Natural Hazards Research Australia report](https://www.naturalhazards.com.au/sites/default/files/2024-02/Vertical%20accuracy%20assessment%20of%20freely%20available%20global%20DEMs%20%20FABDEM%20%20Copernicus%20DEM%20%20NASADEM%20%20AW3D30%20and%20SRTM%20%20in%20flood-prone%20environments%20(1)_0.pdf)). It also had the highest accuracy against ICESat-2 (RMSE 2.06 m), ahead of AW3D30, NASADEM and SRTM ([J. Geovisualization & Spatial Analysis 2025](https://link.springer.com/article/10.1007/s41651-025-00245-0)). No study tested the Ecuadorian Andes specifically.
- **Copernicus DEM editing.** The DEM is derived from the edited WorldDEM, and the edits include flattening water bodies and making rivers flow consistently.
  - EDM (Edit Data Mask) flags pixels that were infilled, interpolated or smoothed.
  - WBM (Water Body Mask) flags water pixels edited as Ocean, Lake or River. Reservoirs have no separate class.
  - The acquisition window is December 2010 to January 2015.
  - Sources: [Copernicus DEM Product Handbook v5.0](https://dataspace.copernicus.eu/sites/default/files/media/files/2024-06/geo1988-copernicusdem-spe-002_producthandbook_i5.0.pdf); [GEE catalog COPERNICUS/DEM/GLO30](https://developers.google.com/earth-engine/datasets/catalog/COPERNICUS_DEM_GLO30)
- **Copernicus DEM on AWS includes the auxiliary layers.** Each GLO-30 tile folder holds AUXFILES/…_EDM.tif, …_FLM.tif (fill mask), …_HEM.tif (height error mask) and …_WBM.tif. Example: `https://copernicus-dem-30m.s3.amazonaws.com/Copernicus_DSM_COG_10_S03_00_W079_00_DEM/AUXFILES/Copernicus_DSM_COG_10_S03_00_W079_00_WBM.tif`. — [S3 listing, probed 2026-10-11](https://copernicus-dem-30m.s3.amazonaws.com/?list-type=2&prefix=Copernicus_DSM_COG_10_S03_00_W079_00_DEM/)
- **Reservoir partly full in the DEM.** In the Jordan/Yarmouk study, SRTM-based elevation–area relationships were biased when much of the reservoir was water-covered during the SRTM pass. In one reservoir, 80 % of the maximum area was water at acquisition and this was a likely error source. The method applies a statistical correction of the DEM per reservoir to stand in for bathymetry. — [Avisse et al. 2017, HESS 21:6445](https://hess.copernicus.org/articles/21/6445/2017/)
- **DEM error dominates DEM-based elevation–area relationships.** A HESS discussion attributes elevation–area errors mainly to low DEM vertical precision and cites SRTM-C errors of up to about 15 m (90 % of data). — [HESS discussion hess-2021-360 AR1](https://hess.copernicus.org/preprints/hess-2021-360/hess-2021-360-AR1.pdf)
- **Ecuadorian vertical datum.** It is anchored at the La Libertad tide gauge (levelling since 1948, maintained by IGM). Its offset to the International Height Reference System (IHRS) is about 29 ± 3 cm with the GO_CONS_GCF_2_DIR_R5 gravity-field model and about 43 ± 3 cm with EIGEN6C4. National levelling uses the mean-tide system, while GNSS uses tide-free. — [Carrión et al., SIRGAS 2015 bulletin](https://www.sirgas.org/fileadmin/docs/Boletines/Bol20/29_Carrion_et_al_2015_Datum_vertical_ecuatoriano.pdf); [Establishment of the 2010 Vertical Datum for Ecuador, Int. Hydrographic Review](https://journals.lib.unb.ca/index.php/ihr/article/view/22824)

### Inferences
- **Choosing the DEM for each reservoir by impoundment date:**
  - **Mazar (2010), Manduriacu (2015), CCS compensation (2016), Sopladora (2016), Delsitanisagua (2018), MSF (2019):** SRTM/NASADEM (Feb 2000) is pre-impoundment for all six. GLO-30 (2010–2015) is pre-impoundment for Manduriacu (partly, depending on tile date), CCS, Delsi and MSF, but post-impoundment for Mazar. The GLO-30 tile-level source dates should be checked with the SRC/ACM KML in the PREVIEW/AUXFILES folder.
  - **Amaluza (1983) and Agoyán (1987):** both were already water-covered in every global DEM, so the DEM shows a flattened surface there. Only the part above the water at acquisition can be contour-integrated. Below that, the curve must be extrapolated (Avisse 2017 / Li 2020-style slope extrapolation) or taken from design or bathymetric data.
- **How canopy bias affects volume.** A forested valley floor and slopes that read too high make each contour at a given level enclose less area, so volume is underestimated. Pasture and forest are common on the Paute/Mazar and Zamora valley sides. Because the bias is largest where the vegetated band is wide compared with the water surface, it matters more for small and narrow reservoirs. FABDEM, a GLO-30 derivative, is preferred for the four post-2015 reservoirs. For Mazar, NASADEM is the pre-impoundment option; no "FABDEM-equivalent" exists for SRTM in the sources found.
- **Canyon artifacts.** Radar shadow and layover in deep canyons produce voids (SRTM, filled in NASADEM) or interpolated cells (flagged in the GLO-30 EDM/FLM layers). These cluster exactly on the canyon floor, which holds the lowest storage, so their effect on live storage between operating levels is smaller than on total storage.
- **Datum alignment (recommended).**
  - CELEC levels are presumably on the IGM La Libertad datum.
  - Copernicus DEM uses EGM2008 heights; SRTM/NASADEM use EGM96. Geoid model differences in the Andes can reach metres; this is my expectation, not a sourced value.
  - Do not trust the nominal datum. Estimate an offset Δ per reservoir and DEM: classify water in several cloud-free Sentinel-2 scenes, then pick the Δ for which the DEM contour at (h_gauge + Δ) best matches each shoreline (maximise intersection over union, or minimise the A_DEM(h+Δ) − A_S2(h) residual).
  - For post-impoundment DEMs (GLO-30 over Mazar), the elevation of the WBM-flattened lake surface gives a second estimate of Δ if the acquisition date and gauge level are known. Flattened elevations are editor-set, so treat this check as weak.
  - The arithmetic above shows why alignment matters: 1 m costs about 2.7 % of Mazar live volume, and 5 m costs about 14 %.

### Gaps
- No ICESat-2 or lidar validation of GLO-30, NASADEM, AW3D30 or FABDEM specifically in the Ecuadorian Andes was found.
- No published EGM96 or EGM2008 offset relative to the La Libertad datum was retrievable (full texts were not accessible).
- It is unverified whether FABDEM covers GLO-30 void-filled canyon cells adequately. FABDEM licensing (CC BY-NC-SA) and hosting (University of Bristol data.bris, blocked from here) should be checked before use in the pipeline.
- No NASADEM-based "bare-earth" correction comparable to FABDEM was confirmed.

---

## Q2. Method 2: satellite surface area paired with gauged levels (Sentinel-2, Landsat, Sentinel-1, JRC GSW), fitting A(h) and integrating

### Takeaway
- Pairing area with level is the main approach in the literature: Gao et al. 2012 (MODIS area + altimetry), Busker et al. 2019 (JRC GSW + DAHITI altimetry, 137 lakes) and Li et al. 2020 / GRBD.
- With gauged daily levels instead of altimetry, level error is close to zero, so the error budget is dominated by area-classification error. Mixed-pixel shoreline error and terrain-shadow false positives matter most for narrow canyons.
- The method works only for the part of the operating range that was observed. It is weak where banks are so steep that area barely changes with level.
- Published storage accuracy is about 3–16 % NRMSE for medium and large reservoirs. The literature has very little on reservoirs under 1 km².

### Cited Findings
- **Gao, Birkett & Lettenmaier 2012** (WRR 48, W09504): 34 reservoirs; MODIS 16-day 250 m area plus altimeter levels give elevation–area relationships. At five large US reservoirs, storage NRMSE was 3–15 %, and mean absolute error across reservoirs was about 4 % of capacity. — [USGS mirror of the paper](https://edcftp.cr.usgs.gov/project/Intl/Iraq/Reservoir%20Monitoring%20Literature/WRR1.pdf); [MODIS abstract page](https://modis.gsfc.nasa.gov/sci_team/pubs/abstract_new.php?id=07218)
- **Busker et al. 2019** (HESS 23:669–690): 137 lakes and reservoirs, 1984–2015. JRC GSW (30 m, Landsat 5/7/8) areas are regressed against DAHITI altimetry levels to derive hypsometry (dh/dA), then integrated to volume change. — [HESS 23:669](https://hess.copernicus.org/articles/23/669/2019/)
- **Li, Gao, Zhao & Tseng 2020** (RSE 244:111831): a high-resolution bathymetry dataset for global reservoirs. It combines ICESat, G-REALM and Hydroweb altimetry with Landsat-based water datasets to build area–elevation relationships, then extrapolates to complete the bathymetry (the GRBD dataset, 347 reservoirs, about 50 % of global storage). — citation via [arXiv 2605.16323 reference list](https://arxiv.org/pdf/2605.16323); method summary via [HESS 2026 30:2741](https://hess.copernicus.org/articles/30/2741/2026/) and [Gao group page](https://hgao.engr.tamu.edu/research/)
- **Avisse et al. 2017** (HESS 21:6445):
  - Landsat water classification, statistical DEM correction, and 3-D reconstruction to fill cloud gaps and Landsat 7 scan-line gaps.
  - Six Jordanian validation reservoirs: R² 0.69–0.84, NRMSE 10–16 %.
  - Uses no in-situ data.
  - Source: [HESS 21:6445](https://hess.copernicus.org/articles/21/6445/2017/)
- **Landsat 7 area bias.** Uncorrected Landsat 7 MNDWI–Jenks areas averaged −11.34 % and DSWE areas −9.17 % against a second-order area–elevation polynomial. That is a systematic underestimate. — [Reservoir capacity estimation from Landsat 7 imagery using spatially parameterized bias correction model (ResearchGate)](https://www.researchgate.net/publication/393572924_Reservoir_capacity_estimation_from_Landsat_7_imagery_using_spatially_parameterized_bias_correction_model)
- **Small reservoirs are underestimated.** Sentinel-1/2 NDWI with Otsu thresholding identified 3 224 of 6 370 in-situ small reservoirs. Performance was better above 3 ha, and small areas were underestimated. — [Remote Sensing, June 2025 (DOAJ)](https://doaj.org/article/3e8ba48190a8455f910b385e4dacef89)
- **MNDWI + Otsu on Sentinel-2** gave areas statistically indistinguishable from bathymetric-survey areas (95 % level) at 14 small Tanzanian reservoirs. — [UDSM repository](https://libraryrepository.udsm.ac.tz/items/55a087e3-b544-4578-b6a9-d1989cd9ca20)
- **Small-reservoir research is scarce.** A review found only 11 % of studies address reservoirs under 1 km². — summarised in search results from [HESS 21:6445 / related review](https://hess.copernicus.org/articles/21/6445/2017/hess-21-6445-2017.pdf) (attribution of this review statistic could not be verified in full text)
- **Terrain effects on water mapping.**
  - Topographic shadow causes commission errors (false water) in optical indices, and a single index threshold is fragile.
  - In mountains, a DEM alone often cannot remove shadow false positives because of DEM resolution.
  - Sources: [Water 13:945 (2021), "Evaluating the Performance of Sentinel-1A and Sentinel-2 in Small Waterbody Mapping over Urban and Mountainous Regions"](https://doi.org/10.3390/W13070945); [arXiv 2301.06567](https://arxiv.org/pdf/2301.06567)
- **SAR in hilly terrain.** Sentinel-1 hill shadow, roughness and vegetation cause false alarms. A HAND mask with a 10 m threshold worked best among five masks. — [SPIE 11856 (2021), Improving water bodies detection from Sentinel-1 in South Africa](https://pure.uj.ac.za/en/publications/improving-water-bodies-detection-from-sentinel-1-in-south-africa-/)
- **OPERA DSWx-S1 handling.** The product applies layover/shadow and HAND masks and flags those areas rather than classifying them. — [NASA Earthdata GIS service for DSWx-S1](https://gis.earthdata.nasa.gov/gis05/rest/services/DISASTERS_202408_FLOOD_BANGLADESH/2423_opera_dswx_s1/ImageServer)
- **JRC Monthly Water History v1.4.** Monthly maps 1984–2021 from Landsat, available in Earth Engine as `JRC/GSW1_4/MonthlyHistory` (requires a GEE account). — [GEE catalog](https://developers.google.com/earth-engine/datasets/catalog/JRC_GSW1_3_MonthlyHistory)
- **JRC GSW on public GCS (no login).**
  - The bucket `global-surface-water/downloads2021/` contains change, extent, occurrence, recurrence, seasonality, transitions, `yearly/yearlyClassification2021/`, `monthly2021/` (2021_01–2021_12 only) and `monthlyRecurrence2021/`.
  - The full 1984–2021 monthly history is not in this bucket.
  - Occurrence tiles are named, for example, `occurrence_80W_0Nv1_4_2021.tif`.
  - There is also a `Reservoirs/` prefix (Extents, Extents2, RMWE); its content was not inspected.
  - Sources: [GCS JSON listing, probed 2026-10-11](https://storage.googleapis.com/storage/v1/b/global-surface-water/o?delimiter=/&prefix=downloads2021/); [example tile](https://storage.googleapis.com/global-surface-water/downloads2021/occurrence/occurrence_80W_0Nv1_4_2021.tif)

### Inferences
- **Using GSW occurrence as a hypsometry proxy (no login).** A pixel's occurrence percentage, ranked against the level-duration curve from the gauged daily series, maps each pixel to a "flooding level". This is the GRDL- and Li-style idea of turning occurrence into contours. It gives A(h) without picking dates. For Mazar (2010) and Manduriacu (2015), occurrence spans 1984–2021, so the record mixes pre- and post-dam periods and must be restricted. Agoyán and Amaluza are covered from about 1984–87. The post-2018 reservoirs have only about 3 years of record in GSW v1.4 (ends 2021).
- **How much each pixel size can resolve.** Assume the shoreline error is about ±0.5 pixel along the perimeter (my assumption, consistent with the 9–11 % Landsat bias above).
  - For a canyon reservoir 200 m wide and 5 km long (1 km², perimeter about 10 km), that is about ±0.05 km² (±5 %) with Sentinel-2 at 10 m, and about ±0.15 km² (±15 %) with Landsat at 30 m.
  - Narrow arms under about 30 m wide (3 Sentinel-2 pixels) or about 90 m wide (Landsat) are dominated by mixed pixels.
  - CCS compensation (~0.1 km²) and the Sopladora pond are below what Landsat can resolve, and marginal even for Sentinel-2.
- **Whether area actually responds to level.** The signal is dA/dh × Δh, compared with the area error.
  - Mazar: 60 000–150 000 m²/m. A 10 m drawdown changes area by about 0.6–1.5 km², which is far above the Sentinel-2 error, so it is strongly constrained.
  - Canyon reservoirs with near-vertical walls: dA/dh may be about 5 000–20 000 m²/m (my guess, unsourced). A 2 m level change then shifts area by only one or two Sentinel-2 pixel-widths along the shore. The fitted A(h) exponent and offset become poorly constrained, which is the user's "steep banks" concern.
  - In that case, fit only a constant or linear A(h) over the observed range, or switch to DEM slopes.
- **Fitting the curve.**
  - Fit A = a(h − h0)^b by nonlinear least squares, weighting by the area uncertainty of each scene.
  - Integrate analytically: V(h1, h2) = a/(b + 1)[(h2 − h0)^(b+1) − (h1 − h0)^(b+1)].
  - Report V only for the gauged and observed h range. Extrapolating below the minimum observed level is model-driven.
  - Bootstrap over scenes to get a confidence interval on V.
- **Clouds and shadow on the Andes–Amazon slope.** These favour:
  1. A Sentinel-2 L2A SCL cloud/shadow mask plus manual or automated scene QA. Accept only scenes where the reservoir polygon buffer is more than about 95 % clear.
  2. A HAND or DEM-derived "max possible extent" mask (the full-supply-level contour plus a buffer) to suppress shadow commissions.
  3. Sentinel-1 RTC only on open, wide reaches. In canyons, layover and shadow will likely mask much of the shoreline.

### Gaps
- No study was found that quantifies Sentinel-2 or Sentinel-1 water-mapping error for narrow Andean canyon reservoirs, or cloud-free Sentinel-2 scene frequency over Paute, Pastaza or Zamora.
- I could not retrieve "Zhang et al." (likely Zhang, Gao & Naz 2014, WRR, South Asia) or any explicit "level–area hypsometry from Sentinel-2 + gauge" paper with numerical results. The Golestan/Iran Sentinel-2 study ([mmws.uma.ac.ir](https://mmws.uma.ac.ir/article_4801.html?lang=en)) built area–elevation curves and checked them against hydrographic surveys, but its error figures were not visible.
- It was not confirmed whether the Planetary Computer `jrc-gsw` collection includes monthly history or only the summary layers.

---

## Q3. Combining DEM and satellite area, validating on Mazar, and reporting uncertainty

### Takeaway
- Use a hybrid approach. Satellite-area–gauge pairs over the observed range anchor and datum-align the curve. The DEM, preferably pre-impoundment and canopy-corrected, provides shape outside the observed range and below the water present at DEM acquisition.
- Validate against Mazar's water-balance curve. This tests both the shape (exponent b) and the live volume of 206 hm³ between 2100 and 2153.
- Published hybrid or automated methods achieve about 10–22 % NRMSE. Gauge-anchored fits on large, well-imaged reservoirs can reach roughly 3–5 %.

### Cited Findings
- **Avisse 2017 hybrid** (DEM corrected per reservoir + Landsat + gap reconstruction): NRMSE 10–16 %. — [HESS 21:6445](https://hess.copernicus.org/articles/21/6445/2017/)
- **GRDL** (Hao et al. 2024, WRR, doi 10.1029/2023WR035781; deep-learning bathymetry reconstruction): median NRMSE 20.6 % for area–storage and 22.1 % for area–level curves against altimetry and lidar references. A separate search could not surface method details. — [WRR 2024](https://agupubs.onlinelibrary.wiley.com/doi/full/10.1029/2023WR035781)
- **Yigzaw et al. 2018** (WRR 54:10372): geometric-shape fits to GRanD reservoirs, calibrated to known total storage and area. About 66 % of reservoirs fall within 5 % total-storage error and 99 % within 50 %. It covers 6 824 reservoirs and is available on Zenodo. — [PNNL summary](https://www.pnnl.gov/publications/new-global-storage-area-depth-data-set-modeling-reservoirs-land-surface-and-earth); [Zenodo 1322884](https://zenodo.org/records/1322884)
- **Global bathymetry and area–elevation datasets for cross-checks:**
  - 3D-LAKES (510 530 lakes; ICESat-2 + Landsat; L2 products are interpolated or extrapolated and may contain errors) — [Zenodo 13107867](https://zenodo.org/records/13107867)
  - GLOBathy (1.4 M HydroLAKES waterbodies; Scientific Data 2022) — [UCAR](https://ckanprod.data-commons.k8s.ucar.edu/dataset/620ae076-14ac-4da2-bcd1-9e29fe581218)
  - Global Waterbody Calculator Python package (draws on HydroLAKES, GLOBathy and GLRDAV) — [PyPI](https://pypi.org/project/globalwaterbodycalculator/)
  - GloLakes (27 000 lakes; notes that absolute storage needs bathymetry or a DEM) — [ESSD 16:201](https://essd.copernicus.org/articles/16/201/2024/)
- **Mazar public data.** Maximum operating level 2153 m and minimum 2098 m (operations reported to around 2110–2114 m). Nominal capacity is 410 hm³. — [El Comercio](https://www.elcomercio.com/actualidad/negocios/asi-esta-embalse-mazar-frente-anos-anteriores/); [Primicias](https://primicias.ec/economia/embalse-mazar-amaluza-sistema-electrico-ecuador-88885); [El Diario](https://www.eldiario.ec/sin-categoria/el-embalse-mazar-vuelve-a-presentar-reduccion-en-su-cota-22102024/)

### Inferences
- **Recommended validation protocol on Mazar:**
  1. Build A_DEM(z) from NASADEM (2000, pre-dam) by summing pixel areas with z ≤ level inside a polygon covering the reservoir basin up to the dam axis. Use true geodesic pixel area: at 2.6° S a 1″ pixel is about 30.9 × 30.8 m.
  2. Build A_S2(h) from 30 or more clear Sentinel-2 scenes from 2017 to 2026, paired with the daily gauge level.
  3. Solve for the datum offset Δ by minimising Σ[A_DEM(h + Δ) − A_S2(h)]².
  4. Compare three curves against the water-balance curve: (a) the DEM-only curve, (b) the Sentinel-2-only power-law fit, and (c) the hybrid. For the hybrid, use the Sentinel-2 fit within the observed range, and the DEM shape scaled to match it at the edges outside that range.
  5. Report these metrics: % error in V(2100→2153) against 206.5 hm³, the fitted exponent b against 2.5, and A(2153) against 7.05 km².
- **Capacity discrepancy.** The water-balance curve gives only about 234 hm³ down to its zero-area level (2036.66 m), versus 410 hm³ nominal gross capacity. Possible explanations:
  - the nominal figure counts storage to the riverbed or crest;
  - the power law underestimates the lower canyon, so h0 is a fitted parameter rather than the true riverbed;
  - sedimentation since 2010.
  A pre-impoundment NASADEM curve can arbitrate the lower part. This is worth stating in the validation.
- **Volume uncertainty to report:** σ_V² ≈ σ_fit² (bootstrap over scenes) + (A·σ_Δ)² (datum) + a DEM-bias term. The DEM-bias term should be tested by repeating with GLO-30, FABDEM, AW3D30 and NASADEM where pre-impoundment. Report this as a spread or envelope.

### Gaps
- No published independent bathymetric or design AEV table was found for Mazar or the other CELEC reservoirs. A search on Mazar reservoir area returned none.
- GRDL, GRBD and 3D-LAKES membership of the eight Ecuadorian reservoirs was not checked. Their files and hosts were unreachable from this sandbox.

---

## Q4. Open, no-login data access routes (endpoints and collection IDs)

### Takeaway
- The Copernicus DEM (30 m and 90 m, with EDM/WBM/HEM masks), the Sentinel-2 L2A COG buckets and the JRC GSW GCS bucket all have direct HTTP access, confirmed from this sandbox.
- The Planetary Computer STAC (NASADEM, ALOS DEM, Sentinel-1 RTC, `jrc-gsw`) needs an anonymous SAS token.
- OpenTopography (API key), USGS EarthExplorer/M2M and NASA Earthdata (OPERA DSWx, HLS) need registration.

### Cited Findings
- **Copernicus DEM GLO-30 COGs (anonymous HTTPS).** URL pattern: `https://copernicus-dem-30m.s3.amazonaws.com/Copernicus_DSM_COG_10_{S03}_00_{W079}_00_DEM/Copernicus_DSM_COG_10_S03_00_W079_00_DEM.tif`, with AUXFILES EDM/FLM/HEM/WBM. GLO-90 is at `https://copernicus-dem-90m.s3.amazonaws.com/Copernicus_DSM_COG_30_…` (HTTP 200). — [S3 listing, probed 2026-10-11](https://copernicus-dem-30m.s3.amazonaws.com/?list-type=2&prefix=Copernicus_DSM_COG_10_S03_00_W079_00_DEM/)
- **Sentinel-2 L2A COGs (anonymous S3/HTTPS).** Bucket `sentinel-cogs` (us-west-2), path `sentinel-s2-l2a-cogs/{utm}/{lat band}/{square}/{yyyy}/{m}/S2{A|B}_{tile}_{yyyymmdd}_{n}_L2A/`. Example listing: tile 17MQS, January 2024. The bucket `e84-earth-search-sentinel-data` (used by Collection-1 items) also answered 200. — [sentinel-cogs listing, probed 2026-10-11](https://sentinel-cogs.s3.us-west-2.amazonaws.com/?list-type=2&prefix=sentinel-s2-l2a-cogs/17/M/QS/2024/1/&delimiter=/)
- **Earth Search** is a free STAC API over the AWS Registry of Open Data. — [Element 84 Earth Search](https://element84.com/earth-search/) (page not reachable; snippet only)
- **Planetary Computer collection IDs** `sentinel-1-rtc` and `jrc-gsw` are confirmed via ArcGIS Pro's list of supported Planetary Computer collections. The `items` endpoint path is `https://planetarycomputer.microsoft.com/api/stac/v1/collections/sentinel-1-rtc/items/`. — [ArcGIS Pro supported STAC collections](https://pro.arcgis.com/en/pro-app/help/data/imagery/supported-stac-collections.htm); [Terrain AI S1 RTC page](https://tai-odc.terrainai.com/products/sentinel_1_rtc)
- **JRC GSW tiles (no login).** Base `https://storage.googleapis.com/global-surface-water/downloads2021/{occurrence|change|seasonality|recurrence|transitions|extent}/…v1_4_2021.tif`. Yearly classification and 2021 monthly tiles are under `yearly/` and `monthly2021/`. The full 1984–2021 monthly history needs Earth Engine (`JRC/GSW1_4/MonthlyHistory`). — [GCS listing, probed 2026-10-11](https://storage.googleapis.com/storage/v1/b/global-surface-water/o?delimiter=/&prefix=downloads2021/); [GEE catalog](https://developers.google.com/earth-engine/datasets/catalog/JRC_GSW1_3_MonthlyHistory)

### Inferences (from prior knowledge, NOT verified in this session because the STAC hosts were unreachable; verify before coding)
- **Earth Search v1** (`https://earth-search.aws.element84.com/v1`) collections:
  - `sentinel-2-l2a` (legacy; assets point to `sentinel-cogs`)
  - `sentinel-2-c1-l2a` (Collection-1 reprocessing; preferred going forward)
  - `cop-dem-glo-30` and `cop-dem-glo-90`
  - `landsat-c2-l2` and `sentinel-1-grd` (backed by requester-pays buckets, so not truly anonymous)
  - `naip`
- **Planetary Computer** (`https://planetarycomputer.microsoft.com/api/stac/v1`) collections: `nasadem`, `cop-dem-glo-30`, `cop-dem-glo-90`, `alos-dem` (AW3D30), `sentinel-2-l2a`, `sentinel-1-rtc`, `sentinel-1-grd`, `landsat-c2-l2`, `jrc-gsw`. Assets in Azure Blob need a SAS token from the anonymous endpoint `https://planetarycomputer.microsoft.com/api/sas/v1/token/{collection}`, appended as a query string. Tokens expire, roughly within an hour. Azure blob hosts were blocked by this sandbox's proxy, so this could not be confirmed.
- **TypeScript/Node pipeline:**
  - STAC search: POST `/search` with `{collections, bbox, datetime, query: {"eo:cloud_cover": {"lt": 60}}}`. A per-reservoir cloud test using SCL is still needed.
  - Reading imagery: geotiff.js `fromUrl` with HTTP range requests works for all COGs above.
  - Bands for Sentinel-2 MNDWI: B03 (10 m) and B11 (20 m). NDWI with B03/B08 keeps 10 m resolution, which matters for narrow reservoirs.

### Gaps
- Exact current collection lists for Earth Search and the Planetary Computer, the requester-pays status of each, and whether the Planetary Computer `jrc-gsw` includes monthly history were not verifiable from this sandbox.
- FABDEM hosting and licence were not verified (data.bris.ac.uk was blocked).
- OpenTopography or USGS API-key requirements were not re-checked for 2026.

---

## Q5. Which method suits each reservoir class, the expected volume error, and the main pitfalls (sedimentation, datum, steep banks, water already in the DEM)

### Takeaway
- **Large Mazar-type reservoirs (5–7 km², about 53 m range):** area-gauge pairing with a NASADEM or pre-dam DEM hybrid is credible, at roughly ±5–10 % of live volume once datum-aligned.
- **Medium reservoirs (about 1–7 km², 2015–2019 dams):** a pre-impoundment GLO-30/FABDEM contour curve, aligned to Sentinel-2 shorelines, is the best option at about ±10–25 %.
- **Old reservoirs (Amaluza, Agoyán):** they are already water-filled in all DEMs, and heavily sedimented reservoirs have changed shape. Only the above-water band is constrained, and extrapolation errors can exceed ±30 %.
- **Tiny ponds (CCS compensation reservoir, Sopladora):** they are below reliable remote-sensing resolution. Use design or engineering curves, or local survey; remote sensing can only sanity-check the full-pool area.

### Cited Findings
- SRTM curve error under 20 % in smooth terrain and over 150 % in rugged terrain for small dams — [Sci. Rep. 2025](https://www.nature.com/articles/s41598-025-30483-7)
- Hybrid Landsat–DEM storage NRMSE 10–16 % — [Avisse 2017](https://hess.copernicus.org/articles/21/6445/2017/)
- Area–altimetry storage NRMSE 3–15 %, and MAE about 4 % of capacity for large reservoirs — [Gao 2012](https://edcftp.cr.usgs.gov/project/Intl/Iraq/Reservoir%20Monitoring%20Literature/WRR1.pdf)
- Global deep-learning reconstruction median NRMSE about 21–22 % — [GRDL, WRR 2024](https://agupubs.onlinelibrary.wiley.com/doi/full/10.1029/2023WR035781)
- SRTM water present at acquisition biases DEM-based relationships — [Avisse 2017](https://hess.copernicus.org/articles/21/6445/2017/)
- Copernicus DEM water bodies are flattened (WBM/EDM) — [Product Handbook](https://dataspace.copernicus.eu/sites/default/files/media/files/2024-06/geo1988-copernicusdem-spe-002_producthandbook_i5.0.pdf)
- Small water bodies (under about 3 ha) are underestimated by Sentinel-1/2 classification — [Remote Sensing 2025](https://doaj.org/article/3e8ba48190a8455f910b385e4dacef89)
- Landsat 7 areas are biased low by about 9–11 % — [ResearchGate 2025](https://www.researchgate.net/publication/393572924_Reservoir_capacity_estimation_from_Landsat_7_imagery_using_spatially_parameterized_bias_correction_model)

### Inferences (a decision matrix synthesised from the findings above. Error ranges are judgements anchored on the cited NRMSE values, not measured for these sites.)

| Reservoir | DEM state | Recommended method | Expected live-volume error |
|---|---|---|---|
| **Mazar** (≈1.4–7 km², 2098–2153 m) | NASADEM pre-dam; GLO-30 post-dam (flattened) | Sentinel-2 (2017–) + Landsat/GSW (2010–) area vs gauge, power law; NASADEM contour curve for shape below the observed minimum and as an independent check; align Δ | ±5–10 % if Δ is solved; ±15–30 % if the DEM is used unaligned |
| **Minas San Francisco** (2019), **Delsitanisagua** (2018) | NASADEM and GLO-30 both pre-dam | FABDEM/GLO-30 contour integration, Δ-aligned to Sentinel-2 shorelines; Sentinel-2 area pairs as a check | ±10–25 % (canopy and canyon-floor artifacts dominate) |
| **Manduriacu** (2015) | NASADEM pre-dam; GLO-30 likely pre-dam (verify the tile date) | As above, choosing FABDEM vs NASADEM by date; Manduriacu is a long, narrow run-of-river-like pool, so the area method is weak | ±15–25 % |
| **Amaluza** (1983) | Water already present in SRTM, NASADEM and GLO-30 | DEM banks above the 2000/2011–15 water line + Sentinel-2/Landsat areas at lower levels; extrapolate below by side-slope continuation (Avisse/Li-style); prefer CELEC design or bathymetry if any exists | ±20–40 %, sedimentation-dependent |
| **Agoyán** (1987, small, Pastaza) | Water present in all DEMs | Narrow and probably heavily sedimented, so remote sensing can give only the full-pool area and the upper-band slope; treat RS as a check on design data | over ±30 %, or not credible |
| **CCS compensation reservoir** (2016, ~0.1 km²) | GLO-30 may predate it, but likely during construction | Below Landsat resolution and marginal for Sentinel-2 (about 1 000 pixels at full pool, few changing per metre); prefer engineering curves; GLO-30 is an order-of-magnitude check only | not credible from RS (over ±30 %) |
| **Sopladora** pond (levels from 2026 only) | — | Too little level history and too small an area; use design data | not credible from RS |

- **Sedimentation.** A pre-impoundment DEM gives the original curve. Satellite area-gauge pairs give the current curve, but only within the observed range, and they barely sense dead-storage infill. Differences between the two in the lower live range indicate sedimentation.
  - Amaluza has received sediment for over 40 years, and Mazar was built partly to protect Amaluza from sediment. That context is unsourced in this session.
  - Agoyán (Pastaza, with Tungurahua volcanic sediment) is likely strongly affected; this is unsourced.
  - Report curves as time-stamped: "valid for period X".
- **Datum offsets.** Never apply DEM heights directly to CELEC levels. Each 1 m of misalignment shifts Mazar live volume by about 2.7 %; for smaller reservoirs with steeper exponents the relative effect is similar or larger. Solve Δ per reservoir and per DEM from shoreline matching.
- **Steep banks.** Where dA/dh × (operating range) is less than about 3–5 times the shoreline area error, the area-gauge fit cannot constrain the exponent b. Fix the shape from the DEM and fit only scale and Δ.
- **Water already in the DEM.** Mask WBM/EDM-flattened pixels (GLO-30) and SRTM/NASADEM flat water pixels. Treat the DEM curve as valid only above the acquisition-date level, and recover that level from the gauge record if it is within the data period. Amaluza (since 2014) and Agoyán (since 2016) have no gauge data from February 2000 or 2011–15, so the flattened elevation must be inferred.

### Gaps
- No Ecuador-specific sedimentation surveys or design AEV tables for these reservoirs were found in this search.
- No source quantified Sentinel-2 cloud-free revisit over these basins.
- I could not verify the surface areas the user quotes (e.g., CCS compensation ~0.1 km², Agoyán) against independent sources.
