import { describe, expect, it } from "vitest";
import { accumulate, routeFlow, type DemGrid } from "../src/lib/geo/catchment.ts";
import { channelLines, clipRing, downsample, dropSmallRings, roundLine } from "../src/lib/geo/basemap.ts";

function grid(rows: number[][]): DemGrid {
  return { width: rows[0]!.length, height: rows.length, west: 0, north: 0, dLon: 0.01, dLat: 0.01, elev: Float32Array.from(rows.flat()) };
}

/**
 * Two valleys, in columns 1 and 5, inside a high wall; the west one turns along row 4 and meets the
 * east one at (4, 5), and the joined river leaves through the one low border cell, (5, 6).
 */
const FORK = grid([
  [30, 30, 30, 30, 30, 30, 30],
  [30, 9, 30, 30, 30, 9, 30],
  [30, 8, 30, 30, 30, 8, 30],
  [30, 7, 30, 30, 30, 7, 30],
  [30, 6, 5, 4, 3, 2, 30],
  [30, 30, 30, 30, 30, 30, 1],
]);

describe("channelLines", () => {
  it("breaks lines at the confluence and ends each tributary on it", () => {
    const routing = routeFlow(FORK);
    const acc = accumulate(FORK, routing);
    const keep = new Uint8Array(FORK.width * FORK.height);
    const channel = [
      [1, 1],
      [2, 1],
      [3, 1],
      [4, 2],
      [4, 3],
      [4, 4],
      [4, 5],
      [5, 6],
      [1, 5],
      [2, 5],
      [3, 5],
    ] as const;
    for (const [r, c] of channel) keep[r * FORK.width + c] = 1;
    const lines = channelLines(FORK, routing, acc, keep, 0);
    expect(lines).toHaveLength(3);
    const r3 = (v: number) => Math.round(v * 1000) / 1000;
    const ends = lines.map((l) => l.coordinates.at(-1)!.map(r3));
    expect(ends.filter(([lon, lat]) => lon === 0.055 && lat === -0.045)).toHaveLength(2);
    const trunk = lines.find((l) => r3(l.coordinates[0]![0]!) === 0.055 && r3(l.coordinates[0]![1]!) === -0.045)!;
    expect(trunk.coordinates.map((p) => p.map(r3))).toEqual([
      [0.055, -0.045],
      [0.065, -0.055],
    ]);
    expect(trunk.areaKm2).toBeGreaterThan(Math.max(...lines.filter((l) => l !== trunk).map((l) => l.areaKm2)));
  });
});

describe("downsample", () => {
  it("averages blocks and skips no data", () => {
    const g = downsample(
      grid([
        [1, 3, NaN, NaN],
        [5, 7, NaN, 4],
      ]),
      2,
    );
    expect(g.width).toBe(2);
    expect(g.dLon).toBeCloseTo(0.02);
    expect([...g.elev]).toEqual([4, 4]);
    expect(() => downsample(g, 0)).toThrow();
  });
});

describe("clipRing", () => {
  const box = { west: 0, south: 0, east: 1, north: 1 };
  it("cuts a ring to the box and keeps it closed", () => {
    const clipped = clipRing(
      [
        [-1, -1],
        [2, -1],
        [2, 2],
        [-1, 2],
        [-1, -1],
      ],
      box,
    )!;
    expect(clipped.at(0)).toEqual(clipped.at(-1));
    expect(clipped.every(([x, y]) => x! >= 0 && x! <= 1 && y! >= 0 && y! <= 1)).toBe(true);
    expect(clipped).toHaveLength(5);
  });
  it("is null for a ring wholly outside", () => {
    expect(
      clipRing(
        [
          [2, 2],
          [3, 2],
          [3, 3],
          [2, 2],
        ],
        box,
      ),
    ).toBeNull();
  });
});

describe("dropSmallRings", () => {
  it("drops small islands and holes, keeps the rest", () => {
    const big = [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
      [0, 0],
    ];
    const hole = [
      [0.1, 0.1],
      [0.1, 0.11],
      [0.11, 0.11],
      [0.11, 0.1],
      [0.1, 0.1],
    ];
    const speck = [
      [5, 5],
      [5.01, 5],
      [5.01, 5.01],
      [5, 5],
    ];
    const out = dropSmallRings([[big, hole], [speck]], 10);
    expect(out).toEqual([[big]]);
  });
});

describe("roundLine", () => {
  it("rounds and removes the duplicates rounding makes", () => {
    expect(
      roundLine(
        [
          [0.00001, 0],
          [0.00002, 0],
          [1.23456, 2],
        ],
        3,
      ),
    ).toEqual([
      [0, 0],
      [1.235, 2],
    ]);
  });
});
