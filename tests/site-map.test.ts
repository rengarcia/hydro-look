import { describe, expect, it } from "vitest";
import {
  boxOf,
  contains,
  fitBox,
  latLonEs,
  linePath,
  markerRadius,
  overlaps,
  polygonPath,
  project,
  riverWidth,
  scaleBarKm,
} from "../src/lib/site/map.ts";
import { basemapFrom, catchmentsFrom, plantPlaces } from "../src/lib/site/places.ts";
import { lakeWater } from "../src/lib/site/cascade.ts";

describe("project", () => {
  it("puts the box's corners on the frame and keeps its shape at the equator", () => {
    const p = project({ west: 0, south: -1, east: 4, north: 1 }, 200);
    expect(p.height).toBe(100);
    expect(p.x(0)).toBe(0);
    expect(p.x(4)).toBeCloseTo(200);
    expect(p.y(1)).toBe(0);
    expect(p.y(-1)).toBeCloseTo(100);
    expect(p.pxPerKm).toBeCloseTo(50 / 111.195, 4);
  });

  it("narrows longitude by the cosine of the middle latitude", () => {
    // At 60° a degree of longitude is half a degree of latitude, so a 2° × 2° box is twice as tall as wide.
    const p = project({ west: 0, south: 59, east: 2, north: 61 }, 100);
    expect(p.height).toBe(200);
  });
});

describe("fitBox", () => {
  it("pads, then widens a tall box to the asked shape around the same centre", () => {
    const b = fitBox({ west: -1, south: -2, east: 1, north: 2 }, 1, 0.1);
    expect(b.north - b.south).toBeCloseTo(4.8);
    expect(b.east - b.west).toBeCloseTo(4.8);
    expect((b.east + b.west) / 2).toBeCloseTo(0);
  });
});

describe("boxes", () => {
  it("bounds points and tests overlap and containment", () => {
    const b = boxOf([
      [1, 2],
      [3, -1],
    ])!;
    expect(b).toEqual({ west: 1, east: 3, south: -1, north: 2 });
    expect(boxOf([])).toBeNull();
    expect(overlaps(b, { west: 3, east: 4, south: 0, north: 1 })).toBe(true);
    expect(overlaps(b, { west: 3.1, east: 4, south: 0, north: 1 })).toBe(false);
    expect(contains(b, 2, 0)).toBe(true);
    expect(contains(b, 0, 0)).toBe(false);
  });
});

describe("paths", () => {
  const p = project({ west: 0, south: 0, east: 1, north: 1 }, 10);
  it("draws relative steps between rounded points, dropping the ones that round onto the last", () => {
    expect(
      linePath(
        [
          [0, 1],
          [0.001, 1],
          [1, 0],
          [0.05, 0.5],
        ],
        p,
      ),
    ).toBe("M0,0l10,10l-9.5-5");
  });
  it("skips points closer than minPx except the last", () => {
    const line = [
      [0, 0],
      [0.02, 0],
      [0.5, 0],
      [0.51, 0],
    ];
    expect(linePath(line, p, false, 1)).toBe("M0,10l5,0l.1,0");
  });
  const square = [
    [0, 0],
    [1, 0],
    [1, 1],
    [0, 0],
  ];
  it("closes every ring of a multipolygon into one path", () => {
    expect(polygonPath({ type: "MultiPolygon", coordinates: [[square], [square]] }, p)).toBe(
      "M0,10l10,0l0-10l-10,10ZM0,10l10,0l0-10l-10,10Z",
    );
    expect(polygonPath({ type: "Point", coordinates: [0, 0] }, p)).toBe("");
  });
  it("leaves out polygons outside the view and rings under minPx", () => {
    const far = square.map(([x, y]) => [x! + 5, y! + 5]);
    const tiny = square.map(([x, y]) => [x! * 0.01, y! * 0.01]);
    expect(polygonPath({ type: "MultiPolygon", coordinates: [[far]] }, p)).toBe("");
    expect(polygonPath({ type: "MultiPolygon", coordinates: [[tiny]] }, p, 1)).toBe("");
  });
});

describe("marks", () => {
  it("sizes a marker by area, with a floor", () => {
    expect(markerRadius(1500, 0.36) / markerRadius(170, 0.36)).toBeCloseTo(Math.sqrt(1500 / 170));
    expect(markerRadius(null, 0.36)).toBe(3);
    expect(markerRadius(4, 0.36)).toBe(3);
  });
  it("widens a river by the decade of its area", () => {
    expect(riverWidth(60, 60, 0.6, 1.2)).toBeCloseTo(0.6);
    expect(riverWidth(6000, 60, 0.6, 1.2)).toBeCloseTo(3.0);
    expect(riverWidth(10, 60, 0.6, 1.2)).toBeCloseTo(0.6);
  });
  it("picks a round scale bar that fits", () => {
    const p = project({ west: 0, south: -0.5, east: 1, north: 0.5 }, 111.195);
    expect(scaleBarKm(p, 60)).toBe(50);
    expect(scaleBarKm(p, 0.5)).toBe(1);
  });
  it("writes a position the Spanish way", () => {
    expect(latLonEs(-2.5951527, -78.6222096)).toBe("2,595° S · 78,622° O");
    expect(latLonEs(0.2148, -78.9123)).toBe("0,215° N · 78,912° O");
  });
});

describe("places", () => {
  it("reads plant rows and refuses one with no position", () => {
    const [mazar] = plantPlaces([
      {
        key: "mazar",
        site_id: "mazar",
        name: "Mazar",
        feature: "dam",
        river: "Paute",
        slope: "amazon",
        capacity_mw: "170",
        in_service: "2011",
        storage_days_class: ">5",
        paper_label: "i",
        lat: "-2.59",
        lon: "-78.62",
      },
    ]);
    expect(mazar).toMatchObject({ siteId: "mazar", capacityMw: 170, storage: ">5", slope: "amazon", lat: -2.59 });
    expect(() => plantPlaces([{ key: "x", feature: "dam", lat: "", lon: "1" }])).toThrow(/no position/);
    expect(() => plantPlaces([{ key: "x", feature: "weir", lat: "1", lon: "1" }])).toThrow(/weir/);
  });

  const square = [
    [0, 0],
    [1, 0],
    [1, 1],
    [0, 0],
  ];
  it("keeps only pour-point catchments", () => {
    const out = catchmentsFrom({
      features: [
        {
          properties: { site: "a", basin: "b", pour_point: true, area_km2: 10, pour_lat: 0, pour_lon: 1 },
          geometry: { type: "Polygon", coordinates: [square] },
        },
        { properties: { site: "a", pour_point: false }, geometry: { type: "Polygon", coordinates: [square] } },
      ],
    });
    expect(out).toHaveLength(1);
    expect(out[0]!.box).toEqual({ west: 0, east: 1, south: 0, north: 1 });
    expect(catchmentsFrom(null)).toEqual([]);
  });

  it("sorts the basemap's layers for drawing", () => {
    const b = basemapFrom({
      features: [
        {
          properties: { kind: "river", area_km2: 5000 },
          geometry: {
            type: "LineString",
            coordinates: [
              [0, 0],
              [1, 1],
            ],
          },
        },
        {
          properties: { kind: "river", area_km2: 100 },
          geometry: {
            type: "LineString",
            coordinates: [
              [0, 0],
              [1, 1],
            ],
          },
        },
        { properties: { kind: "relief", min_m: 4000 }, geometry: { type: "Polygon", coordinates: [square] } },
        { properties: { kind: "relief", min_m: 1000 }, geometry: { type: "Polygon", coordinates: [square] } },
        { properties: { kind: "city", name: "Quito", capital: true }, geometry: { type: "Point", coordinates: [-78.5, -0.2] } },
      ],
    })!;
    expect(b.rivers.map((r) => r.areaKm2)).toEqual([100, 5000]);
    expect(b.relief.map((r) => r.minM)).toEqual([1000, 4000]);
    expect(b.cities[0]).toEqual({ name: "Quito", capital: true, lat: -0.2, lon: -78.5 });
  });
});

describe("lakeWater", () => {
  const upstream = { x: 0, m: 200 };
  const dam = { x: 100, m: 0 };
  it("is a wedge from the dam back to where the riverbed meets the water", () => {
    expect(lakeWater(upstream, dam, 50)).toEqual([{ x: 75, m: 50 }, { x: 100, m: 50 }, dam]);
  });
  it("is empty at or below the riverbed at the dam", () => {
    expect(lakeWater(upstream, dam, 0)).toEqual([]);
  });
  it("is capped at the upstream end when the water is higher than it", () => {
    expect(lakeWater(upstream, dam, 250)).toEqual([{ x: 0, m: 250 }, { x: 100, m: 250 }, dam, upstream]);
  });
});
