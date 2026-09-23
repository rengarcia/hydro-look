import { describe, expect, it } from "vitest";
import {
  bboxAround,
  bboxContains,
  bboxSizeKm,
  capabilitiesUrl,
  geometryContains,
  harvestServiceUrls,
  judgeArcgisItem,
  kmToLine,
  layerPriority,
  matchesLayerPattern,
  overpassBbox,
  parseCapabilities,
  parsePhases,
  PHASES,
  rankArcgisItems,
  rankCandidates,
  relevantService,
  structureKind,
  tieEvidence,
  tieStrength,
  traceChain,
  type SchemeIdentity,
  type WayGeom,
} from "../src/lib/probe/basins.ts";

/** The Wikidata point PLAN.md §2.4 records for Minas San Francisco (Q65196242). */
const MINAS = { lat: -3.3221588, lon: -79.6016026 };
const SCHEME: SchemeIdentity = {
  qid: "Q65196242",
  aliases: ["minas san francisco", "enerjubones", "la union"],
  operator: /celec|enerjubones/i,
};

describe("bounding boxes", () => {
  it("widens a single anchor symmetrically and orders it the way Overpass reads it", () => {
    const box = bboxAround([MINAS], 0.25);
    expect(box).toEqual({ south: -3.572, west: -79.852, north: -3.072, east: -79.352 });
    expect(overpassBbox(box)).toBe("-3.572,-79.852,-3.072,-79.352");
    // ~55 km each way at this latitude: wide enough for a headrace in any direction.
    const size = bboxSizeKm(box);
    expect(size.widthKm).toBeGreaterThan(54);
    expect(size.widthKm).toBeLessThan(57);
    expect(size.heightKm).toBeGreaterThan(54);
    expect(size.heightKm).toBeLessThan(57);
  });

  it("covers the dam side of the Jubones from the recorded point, and the powerhouse side too", () => {
    const box = bboxAround([MINAS], 0.25);
    expect(bboxContains(box, { lat: -3.17, lon: -79.47 })).toBe(true); // Pucará, Azuay
    expect(bboxContains(box, { lat: -3.33, lon: -79.75 })).toBe(true); // downstream, El Oro
    expect(bboxContains(box, { lat: -2.9, lon: -79.0 })).toBe(false); // Cuenca is not in it
  });

  it("takes the envelope of several points before padding, so a box over two claims covers both", () => {
    const box = bboxAround(
      [
        { lat: -4.0, lon: -79.0 },
        { lat: -4.05, lon: -78.9 },
      ],
      0.02,
    );
    expect(box).toEqual({ south: -4.07, west: -79.02, north: -3.98, east: -78.88 });
  });

  it("refuses an empty point list and a negative pad instead of drawing a box around nothing", () => {
    expect(() => bboxAround([], 0.1)).toThrow();
    expect(() => bboxAround([MINAS], -1)).toThrow();
  });
});

describe("distance to a line", () => {
  const line = [
    { lat: 0, lon: 0 },
    { lat: 0, lon: 0.1 },
  ];
  it("is zero on the line and the perpendicular distance beside it", () => {
    expect(kmToLine({ lat: 0, lon: 0.05 }, line)).toBe(0);
    // 0.01° of latitude is ~1.1 km.
    expect(kmToLine({ lat: 0.01, lon: 0.05 }, line)).toBeCloseTo(1.106, 2);
    // Past the end, it is the distance to the end, not to the infinite line.
    expect(kmToLine({ lat: 0, lon: 0.11 }, line)).toBeCloseTo(1.113, 2);
    expect(kmToLine({ lat: 0, lon: 0 }, [])).toBe(Infinity);
  });
});

describe("point in polygon", () => {
  const square = [
    [
      [-79, -3],
      [-78, -3],
      [-78, -2],
      [-79, -2],
      [-79, -3],
    ],
  ];
  const hole = [
    [-78.6, -2.6],
    [-78.4, -2.6],
    [-78.4, -2.4],
    [-78.6, -2.4],
    [-78.6, -2.6],
  ];

  it("reads GeoJSON lon/lat order and respects holes", () => {
    expect(geometryContains({ type: "Polygon", coordinates: square }, -78.5, -2.5)).toBe(true);
    expect(geometryContains({ type: "Polygon", coordinates: square }, -77.5, -2.5)).toBe(false);
    // Swapped axes put the point in the ocean: the test must not accept lat,lon by accident.
    expect(geometryContains({ type: "Polygon", coordinates: square }, -2.5, -78.5)).toBe(false);
    expect(geometryContains({ type: "Polygon", coordinates: [...square, hole] }, -78.5, -2.5)).toBe(false);
    expect(geometryContains({ type: "Polygon", coordinates: [...square, hole] }, -78.8, -2.8)).toBe(true);
  });

  it("finds the point in any part of a multipolygon or a collection", () => {
    const far = [
      [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 0],
      ],
    ];
    expect(geometryContains({ type: "MultiPolygon", coordinates: [far, square] }, -78.5, -2.5)).toBe(true);
    expect(
      geometryContains(
        {
          type: "GeometryCollection",
          geometries: [
            { type: "Polygon", coordinates: far },
            { type: "Polygon", coordinates: square },
          ],
        },
        -78.5,
        -2.5,
      ),
    ).toBe(true);
  });

  it("declines to rule on lines, points, missing geometry and coordinates that are not degrees", () => {
    expect(
      geometryContains(
        {
          type: "LineString",
          coordinates: [
            [-79, -3],
            [-78, -2],
          ],
        },
        -78.5,
        -2.5,
      ),
    ).toBeNull();
    expect(geometryContains(null, -78.5, -2.5)).toBeNull();
    // A server that ignored srsName and answered in UTM 17S.
    const utm = [
      [
        [700000, 9700000],
        [710000, 9700000],
        [710000, 9710000],
        [700000, 9700000],
      ],
    ];
    expect(geometryContains({ type: "Polygon", coordinates: utm }, -78.5, -2.5)).toBeNull();
  });
});

describe("what a mapped element is, and what ties it to a scheme", () => {
  it("classifies the intake end before the machines", () => {
    expect(structureKind({ waterway: "dam" })).toBe("dam");
    expect(structureKind({ man_made: "dam" })).toBe("dam");
    expect(structureKind({ waterway: "weir" })).toBe("weir");
    expect(structureKind({ man_made: "intake" })).toBe("intake");
    expect(structureKind({ name: "Bocatoma Jubones" })).toBe("intake");
    expect(structureKind({ name: "Santo Tomás" })).toBe("other");
    expect(structureKind({ natural: "water", water: "reservoir" })).toBe("reservoir");
    expect(structureKind({ landuse: "reservoir" })).toBe("reservoir");
    expect(structureKind({ power: "plant", "plant:source": "hydro" })).toBe("plant");
    expect(structureKind({ power: "generator", "generator:source": "hydro" })).toBe("generator");
    expect(structureKind({ man_made: "pipeline", usage: "penstock" })).toBe("conduit");
  });

  it("names every tie separately, by kind of evidence", () => {
    expect(tieEvidence({ wikidata: "Q65196242" }, SCHEME)).toEqual(["wikidata=Q65196242"]);
    expect(tieEvidence({ wikidata: "Q1;Q65196242" }, SCHEME)).toEqual(["wikidata=Q65196242"]);
    expect(tieEvidence({ alt_name: "Presa La Unión" }, SCHEME)).toEqual(['alt_name="Presa La Unión"']);
    expect(tieEvidence({ name: "Central Hidroeléctrica Minas-San Francisco" }, SCHEME)).toHaveLength(1);
    expect(tieEvidence({ operator: "CELEC EP Enerjubones" }, SCHEME)).toEqual(['operator="CELEC EP Enerjubones"']);
    expect(tieEvidence({ name: "Represa Chanlud", operator: "ETAPA", wikidata: "Q999" }, SCHEME)).toEqual([]);
  });

  it("ranks an identity over a name over an operator", () => {
    expect(tieStrength(["wikidata=Q65196242"])).toBe(3);
    expect(tieStrength(['name="Minas San Francisco"', 'operator="CELEC"'])).toBe(2);
    expect(tieStrength(['operator="CELEC"'])).toBe(1);
    expect(tieStrength([])).toBe(0);
  });
});

describe("candidate ranking", () => {
  const river = [
    [
      { lat: -3.3, lon: -79.7 },
      { lat: -3.3, lon: -79.4 },
    ],
  ];
  const at = (lat: number, lon: number) => ({ lat, lon });

  it("puts a tied element first, then dams before plants, then on-river before off-river, then nearest", () => {
    const ranked = rankCandidates(
      [
        { id: "node/1", tags: { power: "plant" }, ...at(-3.32, -79.6) },
        { id: "way/2", tags: { waterway: "dam" }, ...at(-3.4, -79.5) }, // ~11 km off the river
        { id: "way/3", tags: { waterway: "dam" }, ...at(-3.301, -79.45) }, // on it
        { id: "way/4", tags: { waterway: "dam", operator: "CELEC EP" }, ...at(-3.5, -79.4) },
        { id: "node/5", tags: { power: "plant", wikidata: "Q65196242" }, ...at(-3.33, -79.61) },
        { id: "way/6", tags: { waterway: "dam" }, ...at(-3.3, -79.55) }, // on it, nearer the anchor
      ],
      MINAS,
      SCHEME,
      river,
    );
    expect(ranked.map((c) => c.id)).toEqual(["node/5", "way/4", "way/6", "way/3", "way/2", "node/1"]);
    expect(ranked[0]!.ties).toEqual(["wikidata=Q65196242"]);
    expect(ranked.find((c) => c.id === "way/3")!.kmToRiver).toBeLessThan(0.5);
    expect(ranked.find((c) => c.id === "way/2")!.kmToRiver).toBeGreaterThan(5);
  });

  it("does not let a CELEC building outrank an unnamed dam, but does let a name", () => {
    const ranked = rankCandidates(
      [
        { id: "way/1", tags: { building: "yes", operator: "CELEC EP" }, lat: -3.32, lon: -79.6 },
        { id: "way/2", tags: { waterway: "dam" }, lat: -3.3, lon: -79.45 },
        { id: "node/3", tags: { power: "plant", name: "Central Minas San Francisco" }, lat: -3.33, lon: -79.61 },
      ],
      MINAS,
      SCHEME,
    );
    expect(ranked.map((c) => c.id)).toEqual(["node/3", "way/2", "way/1"]);
  });

  it("reports no river distance when the river did not come back, rather than an infinite one", () => {
    const [only] = rankCandidates([{ id: "way/1", tags: { waterway: "dam" }, lat: -3.3, lon: -79.5 }], MINAS, SCHEME);
    expect(only!.kmToRiver).toBeNull();
    expect(only!.kind).toBe("dam");
  });
});

describe("tracing a headrace", () => {
  const intake = { lat: -4.0, lon: -79.0, nodeId: 100 };
  const powerhouse = [
    { lat: -4.05, lon: -78.9 },
    { lat: -4.05, lon: -78.899 },
    { lat: -4.051, lon: -78.899 },
  ];
  const canal: WayGeom = {
    id: "way/10",
    tags: { waterway: "canal", usage: "headrace" },
    nodes: [100, 101, 102],
    geometry: [intake, { lat: -4.01, lon: -78.97 }, { lat: -4.02, lon: -78.95 }],
  };
  // Starts 30 m from the canal's end without sharing a node: a drawing habit, not a break.
  const tunnel: WayGeom = {
    id: "way/11",
    tags: { waterway: "pressurised", tunnel: "flooded" },
    nodes: [200, 201],
    geometry: [
      { lat: -4.0202, lon: -78.95 },
      { lat: -4.04, lon: -78.91 },
    ],
  };
  const penstock: WayGeom = {
    id: "way/12",
    tags: { man_made: "pipeline", usage: "penstock" },
    nodes: [201, 300],
    geometry: [
      { lat: -4.04, lon: -78.91 },
      { lat: -4.0499, lon: -78.9 },
    ],
  };
  const stray: WayGeom = {
    id: "way/99",
    tags: { waterway: "canal" },
    nodes: [900, 901],
    geometry: [
      { lat: -3.9, lon: -79.2 },
      { lat: -3.91, lon: -79.21 },
    ],
  };

  it("finds the chain from the intake node to the powerhouse through shared nodes and near ends", () => {
    const result = traceChain([stray, penstock, tunnel, canal], intake, powerhouse, 0.1);
    expect(result.path).toEqual(["way/10", "way/11", "way/12"]);
    expect(result.fromStart).toEqual(["way/10"]);
    expect(result.toTarget).toEqual(["way/12"]);
  });

  it("says which end is bare when the middle is unmapped", () => {
    const result = traceChain([canal, penstock], intake, powerhouse, 0.1);
    expect(result.path).toEqual([]);
    expect(result.fromStart).toEqual(["way/10"]);
    expect(result.toTarget).toEqual(["way/12"]);
  });

  it("finds nothing at all when nothing is mapped", () => {
    expect(traceChain([], intake, powerhouse)).toEqual({ path: [], fromStart: [], toTarget: [] });
  });
});

describe("capabilities documents", () => {
  const wms = `<?xml version="1.0" encoding="UTF-8"?>
<WMS_Capabilities version="1.3.0" xmlns="http://www.opengis.net/wms">
  <Service><Name>WMS</Name><Title>GeoServer Web Map Service</Title></Service>
  <Capability>
    <Layer>
      <Title>MAATE</Title>
      <Layer queryable="1">
        <Name>maate:unidades_hidrograficas_n5</Name>
        <Title><![CDATA[Unidades Hidrográficas Nivel 5 (Pfafstetter)]]></Title>
        <Abstract>SENAGUA 2014, escala 1:50.000</Abstract>
        <KeywordList><Keyword>agua</Keyword></KeywordList>
      </Layer>
      <Layer queryable="1">
        <Name>maate:cobertura_vegetal</Name>
        <Title>Cobertura vegetal &amp; uso de suelo</Title>
      </Layer>
      <Layer>
        <Name>maate:limites</Name>
        <Title>Límites</Title>
        <KeywordList><Keyword>cuencas</Keyword></KeywordList>
      </Layer>
    </Layer>
  </Capability>
</WMS_Capabilities>`;

  it("lists named WMS layers, skips unnamed groups, and matches on title, abstract or keywords", () => {
    const caps = parseCapabilities(wms);
    expect(caps.service).toBe("WMS");
    expect(caps.error).toBe("");
    expect(caps.layers.map((l) => l.name)).toEqual(["maate:unidades_hidrograficas_n5", "maate:cobertura_vegetal", "maate:limites"]);
    expect(caps.layers[0]!.title).toBe("Unidades Hidrográficas Nivel 5 (Pfafstetter)");
    expect(caps.layers[1]!.title).toBe("Cobertura vegetal & uso de suelo");
    expect(caps.layers.map((l) => l.matched)).toEqual([true, false, true]);
  });

  it("reads WFS feature types with namespace prefixes", () => {
    const wfs = `<wfs:WFS_Capabilities version="1.1.0" xmlns:wfs="http://www.opengis.net/wfs" xmlns:ows="http://www.opengis.net/ows">
      <wfs:FeatureTypeList>
        <wfs:FeatureType><wfs:Name>geonode:u95_el_coca</wfs:Name><wfs:Title>Cuenca del río Coca</wfs:Title>
          <ows:Keywords><ows:Keyword>hidrología</ows:Keyword></ows:Keywords></wfs:FeatureType>
        <wfs:FeatureType><wfs:Name>geonode:estaciones</wfs:Name><wfs:Title>Estaciones hidrometeorológicas</wfs:Title></wfs:FeatureType>
      </wfs:FeatureTypeList>
    </wfs:WFS_Capabilities>`;
    const caps = parseCapabilities(wfs);
    expect(caps.service).toBe("WFS");
    expect(caps.layers.map((l) => [l.name, l.matched])).toEqual([
      ["geonode:u95_el_coca", true],
      ["geonode:estaciones", false],
    ]);
    expect(caps.layers[0]!.keywords).toEqual(["hidrología"]);
  });

  it("reports an OGC exception and a page that is not capabilities at all", () => {
    const exception = parseCapabilities(
      `<ows:ExceptionReport><ows:Exception exceptionCode="InvalidParameterValue"><ows:ExceptionText>No service: ( wfs )</ows:ExceptionText></ows:Exception></ows:ExceptionReport>`,
    );
    expect(exception.error).toBe("No service: ( wfs )");
    expect(exception.layers).toEqual([]);
    expect(parseCapabilities("<html><body>Not Found</body></html>").error).toBe("not a WMS or WFS capabilities document");
  });

  it("matches the layer pattern through accents, underscores and the common misspelling", () => {
    expect(matchesLayerPattern("Unidades Hidrográficas")).toBe(true);
    expect(matchesLayerPattern("unidades_hidrograficas")).toBe(true);
    expect(matchesLayerPattern("UNIDAD HIDROGRAFICA N4")).toBe(true);
    expect(matchesLayerPattern("Fig_13__B_UnidadesHidrográficasN4Pfastetter")).toBe(true);
    expect(matchesLayerPattern("uh_nivel5_pfafstetter")).toBe(true);
    expect(matchesLayerPattern("Subcuencas")).toBe(true);
    expect(matchesLayerPattern("Cobertura vegetal", undefined, "Red hídrica")).toBe(false);
  });
});

describe("capabilities URLs", () => {
  it("rebuilds the query rather than appending to whatever a directory listed", () => {
    expect(capabilitiesUrl("http://mapainteractivo.ambiente.gob.ec/geoserver/ows", "WFS")).toBe(
      "http://mapainteractivo.ambiente.gob.ec/geoserver/ows?service=WFS&request=GetCapabilities&version=1.1.0",
    );
    expect(capabilitiesUrl("https://www.geoportaligm.gob.ec/geoserver/wms?service=wms&request=GetCapabilities&version=1.1.1", "WMS")).toBe(
      "https://www.geoportaligm.gob.ec/geoserver/wms?service=WMS&request=GetCapabilities&version=1.3.0",
    );
    // A WMS path is asked for its WFS sibling, which is where the geometry is.
    expect(capabilitiesUrl("https://www.geoportaligm.gob.ec/regional/wms", "WFS")).toBe(
      "https://www.geoportaligm.gob.ec/regional/wfs?service=WFS&request=GetCapabilities&version=1.1.0",
    );
    // Vendor parameters that select a workspace survive.
    expect(capabilitiesUrl("https://example.gob.ec/geoserver/ows?namespace=agua", "WFS")).toContain("namespace=agua");
  });

  it("asks ArcGIS REST services for their JSON instead", () => {
    expect(capabilitiesUrl("https://example.gob.ec/arcgis/rest/services/Agua/UH/MapServer", "WMS")).toBe(
      "https://example.gob.ec/arcgis/rest/services/Agua/UH/MapServer?f=json",
    );
  });
});

describe("harvesting directory pages", () => {
  const page = `<html><body>
    <h3>Ministerio del Ambiente, Agua y Transición Ecológica</h3>
    <p>Unidades hidrográficas: <a href="http://ide.ambiente.gob.ec/geoserver/wms?service=WMS&amp;request=GetCapabilities">WMS</a></p>
    <p>Mismo servicio: http://ide.ambiente.gob.ec/geoserver/wms</p>
    <h3>Ministerio de Turismo</h3>
    <p>Atractivos: <a href="https://geoatractivos.turismo.gob.ec:8443/geoserver/ows?service=WMS">WMS</a></p>
    <p><a href="/descargas/uh_nivel5_pfafstetter.zip">Unidades hidrográficas nivel 5 (shp)</a></p>
    <p><a href="https://geo.example.gob.ec/arcgis/rest/services/Hidro/MapServer">Mapa</a></p>
    <p><a href="https://geoservicios.inamhi.gob.ec/geoserver/gwc/service/tms/1.0.0/x">tiles</a>
       <a href="https://www.geoportaligm.gob.ec/geoserver/schemas/wms/1.3.0/capabilities_1_3_0.xsd">xsd</a>
       <a href="/contacto">contacto</a></p>
  </body></html>`;

  it("keeps services and archives, drops tiles, schemas and pages, and deduplicates one service listed twice", () => {
    const found = harvestServiceUrls(page, "https://sni.gob.ec/geoservicios-ecuador");
    expect(found.map((f) => [f.kind, f.url])).toEqual([
      ["ogc", "http://ide.ambiente.gob.ec/geoserver/wms?service=WMS&request=GetCapabilities"],
      ["ogc", "https://geoatractivos.turismo.gob.ec:8443/geoserver/ows?service=WMS"],
      ["download", "https://sni.gob.ec/descargas/uh_nivel5_pfafstetter.zip"],
      ["arcgis", "https://geo.example.gob.ec/arcgis/rest/services/Hidro/MapServer"],
    ]);
  });

  it("judges relevance by the text around a link, so the tourism ministry's WMS is not asked", () => {
    const found = harvestServiceUrls(page, "https://sni.gob.ec/geoservicios-ecuador");
    const relevant = found.filter(relevantService).map((f) => f.url);
    expect(relevant).toContain("http://ide.ambiente.gob.ec/geoserver/wms?service=WMS&request=GetCapabilities");
    expect(relevant).toContain("https://sni.gob.ec/descargas/uh_nivel5_pfafstetter.zip");
    expect(relevant).not.toContain("https://geoatractivos.turismo.gob.ec:8443/geoserver/ows?service=WMS");
  });
});

describe("ArcGIS Online, restricted to the agencies", () => {
  const items = [
    {
      title: "Fig 13_ B_UnidadesHidrográficasN4Pfastetter",
      type: "Feature Service",
      owner: "some_student",
      url: "https://services7.arcgis.com/x/FeatureServer",
      tags: ["tesis"],
    },
    {
      title: "Unidades Hidrográficas Nivel 5",
      type: "Feature Service",
      owner: "geo_maate",
      url: "https://services.arcgis.com/y/FeatureServer",
      tags: ["SENAGUA", "Pfafstetter"],
      accessInformation: "Secretaría del Agua",
    },
    { title: "Concesiones de agua", type: "Map Service", owner: "senagua_ec", url: "https://services.arcgis.com/z/MapServer", tags: [] },
    { title: "Unidades hidrográficas (PDF)", type: "PDF", owner: "geo_maate", url: null, tags: ["SENAGUA"] },
    { title: "Tourism", type: "Feature Service", owner: "turismo", url: "https://services.arcgis.com/t/FeatureServer", tags: [] },
  ];

  it("reads the agency from owner, tags and credits, never from the title", () => {
    expect(judgeArcgisItem(items[0]!)).toEqual({ agency: [], hydro: true });
    const official = judgeArcgisItem(items[1]!);
    expect(official.hydro).toBe(true);
    expect(official.agency.map((a) => a.split(":")[0])).toEqual(["owner", "tags", "credits"]);
    expect(judgeArcgisItem(items[2]!).agency).toEqual(["owner: senagua_ec"]);
  });

  it("opens services only, agency-tied first, and keeps an untied hydro layer below them", () => {
    expect(rankArcgisItems(items).map((i) => i.owner)).toEqual(["geo_maate", "senagua_ec", "some_student"]);
  });

  it("spends containment tests on Pfafstetter units first and finer levels before coarser", () => {
    const names = ["cuencas_hidrograficas", "UH_N4_Pfafstetter", "UH_N5_Pfafstetter", "unidades_hidrograficas"];
    const sorted = [...names].sort((a, b) => layerPriority(b) - layerPriority(a));
    expect(sorted).toEqual(["UH_N5_Pfafstetter", "UH_N4_Pfafstetter", "unidades_hidrograficas", "cuencas_hidrograficas"]);
  });
});

describe("--phases", () => {
  it("runs everything by default", () => {
    expect([...parsePhases(undefined)]).toEqual([...PHASES]);
    expect([...parsePhases("all")]).toEqual([...PHASES]);
    expect([...parsePhases("")]).toEqual([...PHASES]);
  });

  it("adds the Wikidata anchor to any phase that measures from it, and not to those that do not", () => {
    expect([...parsePhases("jubones,official")].sort()).toEqual(["jubones", "official", "wikidata"]);
    expect([...parsePhases("hydrosheds mirrors")].sort()).toEqual(["hydrosheds", "mirrors"]);
  });

  it("rejects an unknown phase instead of running nothing and calling it clean", () => {
    expect(() => parsePhases("jubones,minas")).toThrow(/unknown phase minas/);
  });
});
