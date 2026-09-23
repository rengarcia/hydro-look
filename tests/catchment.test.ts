import { describe, expect, it } from "vitest";
import {
  accumulate,
  catchmentMask,
  catchmentStats,
  cellAreaKm2,
  geometryAreaKm2,
  outline,
  overlap,
  rasterize,
  ringAreaKm2,
  routeFlow,
  snapToChannel,
  snapToLine,
  type DemGrid,
} from "../src/lib/geo/catchment.ts";

/** A grid from rows of heights, 0.01° cells, north-west corner at (0, 0). `NaN` for no data. */
function grid(rows: number[][]): DemGrid {
  const height = rows.length;
  const width = rows[0]!.length;
  return { width, height, west: 0, north: 0, dLon: 0.01, dLat: 0.01, elev: Float32Array.from(rows.flat()) };
}

/**
 * Two valleys split by a ridge in column 3, each draining south to the grid's bottom edge. The
 * west valley's floor is column 1 and has a pit at row 2 (height 3 inside a 5-high channel); the
 * east valley's floor is column 5.
 */
const TWO_VALLEYS = grid([
  [9, 8, 9, 20, 9, 8, 9],
  [9, 7, 9, 20, 9, 7, 9],
  [9, 3, 9, 20, 9, 6, 9],
  [9, 5, 9, 20, 9, 5, 9],
  [9, 4, 9, 20, 9, 4, 9],
  [9, 2, 9, 20, 9, 3, 9],
  [9, 1, 9, 20, 9, 2, 9],
]);
const at = (g: DemGrid, r: number, c: number) => r * g.width + c;

describe("routing", () => {
  it("settles every data cell once, each after the cell it drains into", () => {
    const routing = routeFlow(TWO_VALLEYS);
    expect(routing.count).toBe(49);
    const position = new Map<number, number>();
    for (let k = 0; k < routing.count; k++) position.set(routing.order[k]!, k);
    expect(position.size).toBe(49);
    for (let i = 0; i < 49; i++) {
      const r = routing.receiver[i]!;
      if (r >= 0) expect(position.get(r)!).toBeLessThan(position.get(i)!);
    }
  });

  it("drains a pit through its spill point instead of stopping in it", () => {
    const g = TWO_VALLEYS;
    const routing = routeFlow(g);
    // The pit at (2,1) is lower than the channel below it, so it only drains once filled to 5.
    // Row 0 is the grid's border and so an outlet of its own; the channel below it is not.
    const mask = catchmentMask(g, routing, at(g, 5, 1));
    for (let r = 1; r <= 4; r++) expect(mask[at(g, r, 1)]).toBe(1);
    expect(mask[at(g, 0, 1)]).toBe(0);
    // The ridge cells in column 3 drain to one side or the other; the east valley's floor never joins.
    for (let r = 0; r < 7; r++) expect(mask[at(g, r, 5)]).toBe(0);
  });

  it("drains a valley side across the slope, not down it at 45°", () => {
    // A valley along column 10 falling south, its sides seven times steeper than its floor. A
    // lowest-neighbour rule sends the far hillside diagonally south past the pour point; steepest
    // descent sends it across to the river, so the pour point above the mouth collects every
    // interior cell upstream of it.
    const g = grid(Array.from({ length: 21 }, (_, r) => Array.from({ length: 21 }, (_, c) => 100 + 30 * Math.abs(c - 10) + 4 * (20 - r))));
    const mask = catchmentMask(g, routeFlow(g), at(g, 19, 10));
    // Rows 1–19, columns 1–19: everything but the border, which is outlets.
    expect(mask.reduce((s, v) => s + v, 0)).toBe(19 * 19);
  });

  it("treats no data as sea: a cell next to it is an outlet", () => {
    const g = grid([
      [5, 5, 5],
      [5, 4, NaN],
      [5, 5, 5],
    ]);
    const routing = routeFlow(g);
    expect(routing.receiver[at(g, 1, 2)]).toBe(-2);
    expect(routing.receiver[at(g, 1, 1)]).toBe(-1);
    expect(routing.count).toBe(8);
  });

  it("drains a flat — a reservoir surface — towards where it spills", () => {
    // A lake at 10 filling columns 1–4, spilling only at its east end through (2,5) at 9 to the
    // border at 8. Every other way out is over 30.
    const g = grid([
      [30, 30, 30, 30, 30, 30, 30],
      [30, 10, 10, 10, 10, 30, 30],
      [30, 10, 10, 10, 10, 9, 8],
      [30, 10, 10, 10, 10, 30, 30],
      [30, 30, 30, 30, 30, 30, 30],
    ]);
    const routing = routeFlow(g);
    const mask = catchmentMask(g, routing, at(g, 2, 5));
    for (let r = 1; r <= 3; r++) for (let c = 1; c <= 4; c++) expect(mask[at(g, r, c)]).toBe(1);
    expect(mask[at(g, 0, 0)]).toBe(0);
  });
});

describe("accumulation, snapping and the catchment's figures", () => {
  it("adds up to the whole valley at its mouth, and snaps a nearby point onto the channel", () => {
    const g = TWO_VALLEYS;
    const routing = routeFlow(g);
    const acc = accumulate(g, routing);
    // Upstream area at a cell is exactly the area of the catchment read off at that cell.
    const pour = at(g, 5, 1);
    const stats = catchmentStats(g, catchmentMask(g, routing, pour));
    expect(acc[pour]!).toBeCloseTo(stats.areaKm2, 9);
    expect(stats.cells).toBeGreaterThanOrEqual(5);
    // A point in (5,2), beside the channel, snaps to the channel cell (5,1) within 1.2 km.
    const snapped = snapToChannel(g, acc, -0.055, 0.025, 1.2)!;
    expect(snapped.index).toBe(at(g, 5, 1));
    expect(snapped.movedKm).toBeGreaterThan(1);
    expect(snapped.movedKm).toBeLessThan(1.2);
  });

  it("snaps to a dam's crest without reaching the confluence below it", () => {
    // A main valley down column 5, and a tributary entering from the east at row 7. A dam across
    // the main valley at row 5 must not collect the tributary, which a radius from its centre
    // wide enough to reach row 7 would.
    const g = grid(
      Array.from({ length: 12 }, (_, r) =>
        Array.from({ length: 11 }, (_, c) => {
          const main = 100 + 20 * Math.abs(c - 5) + 3 * (11 - r);
          const trib = c > 5 ? 100 + 20 * Math.abs(r - 7) + 3 * (c - 5) + 3 * (11 - 7) : Infinity;
          return Math.min(main, trib);
        }),
      ),
    );
    const routing = routeFlow(g);
    const acc = accumulate(g, routing);
    const crest = [{ lat: -0.055, lon: 0.035 }, { lat: -0.055, lon: 0.075 }];
    const onCrest = snapToLine(g, acc, crest, 0.3)!;
    expect(onCrest.index).toBe(at(g, 5, 5));
    const wide = snapToChannel(g, acc, -0.055, 0.055, 2.5)!;
    expect(wide.accKm2).toBeGreaterThan(onCrest.accKm2);
  });

  it("reports area, centroid, bbox and whether the grid cut the catchment off", () => {
    const g = TWO_VALLEYS;
    const routing = routeFlow(g);
    const mask = catchmentMask(g, routing, at(g, 5, 1));
    const stats = catchmentStats(g, mask);
    // It reaches row 1, next to the northern border, so a real run would widen the grid there.
    expect(stats.touches.north).toBe(true);
    expect(stats.bbox.north).toBeCloseTo(-0.01, 9);
    expect(stats.representative.isCentroid || mask[at(g, Math.floor(-stats.representative.lat / 0.01), Math.floor(stats.representative.lon / 0.01))] === 1).toBe(true);
    // One cell of 0.01° at the equator is 1.1119² km² to four figures.
    expect(cellAreaKm2(g, 0)).toBeCloseTo(1.2364, 3);
    expect(stats.areaKm2).toBeCloseTo(stats.cells * cellAreaKm2(g, 0), 2);
  });
});

describe("polygons", () => {
  const square = { type: "Polygon", coordinates: [[[0.02, -0.05], [0.05, -0.05], [0.05, -0.02], [0.02, -0.02], [0.02, -0.05]]] };

  it("measures a counter-clockwise ring as positive, and a polygon's area on the sphere", () => {
    expect(ringAreaKm2(square.coordinates[0]!)).toBeGreaterThan(0);
    // 0.03° × 0.03° at the equator: 3.3358² km².
    expect(geometryAreaKm2(square)).toBeCloseTo(11.128, 1);
  });

  it("rasterises by cell centre and outlines the mask back to the same shape", () => {
    const g = grid(Array.from({ length: 7 }, () => Array<number>(7).fill(1)));
    const mask = rasterize(g, square);
    // Centres at 0.025, 0.035, 0.045 fall inside [0.02, 0.05] each way: a 3 × 3 block.
    expect(mask.reduce((s, v) => s + v, 0)).toBe(9);
    expect(mask[at(g, 2, 2)]).toBe(1);
    expect(mask[at(g, 1, 2)]).toBe(0);
    const back = outline(g, mask, 0.0001);
    expect(back.type).toBe("Polygon");
    expect(geometryAreaKm2(back)).toBeCloseTo(geometryAreaKm2(square), 3);
    expect(overlap(g, mask, rasterize(g, back)).iou).toBe(1);
  });

  it("keeps a hole a hole, and two separate blobs two polygons", () => {
    const g = grid(Array.from({ length: 7 }, () => Array<number>(7).fill(1)));
    const ring = new Uint8Array(49);
    for (let r = 1; r <= 5; r++) for (let c = 1; c <= 5; c++) ring[at(g, r, c)] = r === 3 && c === 3 ? 0 : 1;
    const withHole = outline(g, ring, 0.0001);
    expect(withHole.type).toBe("Polygon");
    expect((withHole.coordinates as unknown[]).length).toBe(2);
    expect(geometryAreaKm2(withHole) / cellAreaKm2(g, 3)).toBeCloseTo(24, 0);

    const two = new Uint8Array(49);
    two[at(g, 1, 1)] = 1;
    two[at(g, 5, 5)] = 1;
    expect(outline(g, two, 0.0001).type).toBe("MultiPolygon");
  });

  it("scores overlap both ways, so a superset and a subset read differently", () => {
    const g = grid(Array.from({ length: 4 }, () => Array<number>(4).fill(1)));
    const all = new Uint8Array(16).fill(1);
    const half = new Uint8Array(16);
    for (let i = 0; i < 8; i++) half[i] = 1;
    const o = overlap(g, half, all);
    expect(o.aInB).toBe(1);
    expect(o.bInA).toBeCloseTo(0.5, 2);
    expect(o.iou).toBeCloseTo(0.5, 2);
  });
});
