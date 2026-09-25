/**
 * GEOGLOWS return periods: the Blosc decoding the store needs, the Gumbel arithmetic, the rule that
 * picks a dam's river, and what `latest.json` makes of them.
 *
 * The Blosc frames under `tests/fixtures/blosc/` were written by numcodecs 0.16 — the library that
 * wrote GEOGLOWS' store — from arrays rebuilt here, so a decode is checked against its input rather
 * than against itself.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  blockExtent,
  blocksFor,
  bloscDecompress,
  bloscHeader,
  bloscIndex,
  bloscIndexBytes,
  decodeBlocks,
  lz4DecodeBlock,
  unshuffle,
} from "../src/lib/geo/blosc.ts";
import {
  annualMaxima,
  gumbelFactor,
  gumbelReturnPeriods,
  matchRiver,
  returnPeriodReached,
  type RiverSegment,
} from "../src/lib/geo/geoglows.ts";
import { returnPeriodsFor } from "../src/lib/publish/latest.ts";
import { returnPeriodAgreement, returnPeriodReachedWords } from "../src/lib/site/story.ts";
import type { DailySeries } from "../src/lib/features/series.ts";
import { baseOf, bundleRefs, endpointsIn, isHtml, keywordHits, resolveRef } from "../src/lib/probe/portal.ts";
import { FIXTURES } from "./helpers.ts";

const frame = (name: string) => new Uint8Array(readFileSync(join(FIXTURES, "blosc", name)));
const view = <T>(bytes: Uint8Array, Ctor: new (b: ArrayBuffer) => T): T =>
  new Ctor(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer);

describe("bloscDecompress", () => {
  it("decodes LZ4 with byte shuffle, split streams and a short last block, as the store's river_id chunks are", () => {
    const bytes = frame("lz4-shuffle-i4.blosc");
    const h = bloscHeader(bytes);
    expect([h.codec, h.typesize, h.nbytes, h.blocksize]).toEqual(["lz4", 4, 1_200_000, 524_288]);
    const values = view(bloscDecompress(bytes), Int32Array);
    expect(values.length).toBe(300_000);
    // Built as floor(i / 10) * 3 + 7.
    for (const i of [0, 9, 10, 131_071, 131_072, 262_143, 262_144, 299_999]) expect(values[i]).toBe(Math.floor(i / 10) * 3 + 7);
  });

  it("decodes Zstd with byte shuffle across several blocks, as the store's value chunks are", () => {
    const bytes = frame("zstd-shuffle-f8.blosc");
    expect(bloscHeader(bytes).codec).toBe("zstd");
    const values = view(bloscDecompress(bytes), Float64Array);
    expect(values.length).toBe(1000);
    for (const i of [0, 255, 256, 999]) expect(values[i]).toBe(Math.sin(i / 10) * 1000 + i);
  });

  it("copies a frame Blosc stored uncompressed", () => {
    const values = view(bloscDecompress(frame("lz4-memcpy-i8.blosc")), BigInt64Array);
    expect([...values].map(Number)).toEqual([2, 5, 10, 25, 50, 100]);
  });

  it("takes a stream whose size equals its block as stored bytes, not as LZ4", () => {
    // One 8-byte block, not split, not shuffled, stored as is: header, one offset, one size, the bytes.
    const payload = [1, 2, 3, 4, 5, 6, 7, 8];
    const bytes = new Uint8Array(16 + 4 + 4 + 8);
    const dv = new DataView(bytes.buffer);
    bytes.set([2, 1, 0x10 | (1 << 5), 1]);
    dv.setUint32(4, 8, true);
    dv.setUint32(8, 8, true);
    dv.setUint32(12, bytes.length, true);
    dv.setInt32(16, 20, true);
    dv.setInt32(20, 8, true);
    bytes.set(payload, 24);
    expect([...bloscDecompress(bytes)]).toEqual(payload);
  });

  it("decodes bit-shuffle, as GEOGLOWS' forecast chunks are written", () => {
    const bytes = frame("lz4-bitshuffle-f8.blosc");
    expect(bloscHeader(bytes).flags & 0x04).toBe(0x04);
    const values = view(bloscDecompress(bytes), Float64Array);
    for (const i of [0, 1, 255, 999]) expect(values[i]).toBe(Math.sin(i / 10) * 1000 + i);
  });

  it("refuses delta coding rather than returning bytes it cannot undo", () => {
    const bytes = frame("zstd-shuffle-f8.blosc").slice();
    bytes[2] = bytes[2]! | 0x08;
    expect(() => bloscDecompress(bytes)).toThrow(/delta/);
  });

  it("reads a range of blocks on its own, each from its own extent, as range requests would fetch them", () => {
    const bytes = frame("zstd-shuffle-f8.blosc");
    const index = bloscIndex(bytes.subarray(0, bloscIndexBytes(bloscHeader(bytes))));
    // Blocks are written as they finish, not in order: this frame holds block 2 before block 1.
    expect(index.starts[2]).toBeLessThan(index.starts[1]!);
    // Doubles 300..600 are bytes 2400..4800: blocks 1 and 2 of 2048 bytes.
    const { first, last } = blocksFor(index, 2400, 4800);
    expect([first, last]).toEqual([1, 2]);
    const decoded = view(
      decodeBlocks(index, first, last, (i) => {
        const { from, to } = blockExtent(index, i);
        return bytes.slice(from, to);
      }),
      Float64Array,
    );
    const offset = (2400 - first * 2048) / 8;
    for (const i of [300, 450, 599]) expect(decoded[offset + i - 300]).toBe(Math.sin(i / 10) * 1000 + i);
  });

  it("refuses a truncated frame", () => {
    expect(() => bloscDecompress(frame("zstd-shuffle-f8.blosc").subarray(0, 100))).toThrow(/compressed bytes/);
  });
});

describe("lz4DecodeBlock and unshuffle", () => {
  it("expands an overlapping match, which is how LZ4 writes a run", () => {
    // Literal "ab", then a match of 6 at offset 2: "abababab".
    expect(new TextDecoder().decode(lz4DecodeBlock(Uint8Array.from([0x22, 0x61, 0x62, 0x02, 0x00]), 8))).toBe("abababab");
  });

  it("puts each element's bytes back together and leaves a ragged tail alone", () => {
    expect([...unshuffle(Uint8Array.from([1, 3, 2, 4, 9]), 2)]).toEqual([1, 2, 3, 4, 9]);
  });
});

describe("the Gumbel fit", () => {
  it("is GEOGLOWS' formula", () => {
    // Theirs: -ln(-ln(1 - 1/T)) * 0.7797 * std + mean - 0.45 * std.
    const maxima = [410, 560, 700, 380, 920, 610, 480];
    const mean = maxima.reduce((a, b) => a + b) / maxima.length;
    const sd = Math.sqrt(maxima.reduce((a, b) => a + (b - mean) ** 2, 0) / (maxima.length - 1));
    for (const { years, m3s } of gumbelReturnPeriods(maxima)) {
      const theirs = -Math.log(-Math.log(1 - 1 / years)) * 0.7797 * sd + mean - 0.45 * sd;
      expect(m3s / theirs).toBeCloseTo(1, 3);
    }
  });

  it("puts the 2-year flood just below the mean, as a right-skewed distribution does", () => {
    expect(gumbelFactor(2)).toBeCloseTo(-0.1643, 4);
    const [two] = gumbelReturnPeriods([100, 200]);
    expect(two!.m3s).toBeCloseTo(150 - 0.1643 * Math.SQRT2 * 50, 2);
  });

  it("refuses a sample it cannot fit and a period of one year", () => {
    expect(() => gumbelReturnPeriods([100])).toThrow();
    expect(() => gumbelFactor(1)).toThrow();
  });
});

function daily(from: string, days: number, value: (i: number) => number): DailySeries {
  const out: DailySeries = new Map();
  const start = Date.parse(`${from}T00:00:00Z`);
  for (let i = 0; i < days; i++) out.set(new Date(start + i * 86_400_000).toISOString().slice(0, 10), value(i));
  return out;
}

describe("annualMaxima", () => {
  it("keeps only years read on at least 330 days, so a year missing its wet months is not a low maximum", () => {
    const series = daily("2020-01-01", 366 + 365 + 100, (i) => (i === 40 ? 900 : i === 500 ? 700 : 50));
    const maxima = annualMaxima(series);
    expect(maxima.map((m) => [m.year, m.m3s, m.date])).toEqual([
      [2020, 900, "2020-02-10"],
      [2021, 700, "2021-05-15"],
    ]);
  });
});

describe("returnPeriodReached", () => {
  const table = [2, 5, 10].map((years) => ({ years, m3s: years * 100 }));
  it("is the longest period whose flow is reached, and null below the first", () => {
    expect(returnPeriodReached(150, table)).toBeNull();
    expect(returnPeriodReached(200, table)).toBe(2);
    expect(returnPeriodReached(999, table)).toBe(5);
    expect(returnPeriodReached(1000, table)).toBe(10);
  });
});

describe("matchRiver", () => {
  const segment = (riverId: number, lat: number, lengthKm: number, downstreamKm2: number): RiverSegment => ({
    riverId,
    downstreamId: 0,
    vpu: 605,
    lat,
    lon: 0,
    upstreamKm2: downstreamKm2 - 5,
    downstreamKm2,
    lengthKm,
  });
  const pour = { lat: 0, lon: 0, areaKm2: 1000 };

  it("picks the river by drainage area among those whose reach can hold the dam, not the nearest one", () => {
    // Coca Codo Sinclair's case: the nearest segment is above a confluence the dam is below.
    const nearest = segment(1, 0.001, 2, 740);
    const right = segment(2, 0.04, 8, 990);
    const tooFar = segment(3, 0.05, 1, 1000);
    const match = matchRiver(pour, [nearest, right, tooFar]);
    expect(match.chosen?.segment.riverId).toBe(2);
    expect(match.chosen?.areaDiffPct).toBe(-1);
    expect(match.candidates.map((c) => c.segment.riverId)).toEqual([2, 1]);
  });

  it("matches nothing when every river in reach disagrees with the catchment by more than 10%", () => {
    const match = matchRiver(pour, [segment(1, 0.001, 2, 740)]);
    expect(match.chosen).toBeNull();
    expect(match.candidates).toHaveLength(1);
  });
});

describe("returnPeriodsFor", () => {
  const row = {
    site: "mazar",
    river_id: "620988388",
    area_diff_pct: "-1.34",
    store_revision_date: "2026-06-10",
    ...Object.fromEntries(
      [2, 5, 10, 25, 50, 100].flatMap((y) => [
        [`q${y}_m3s`, String(y * 100)],
        [`q${y}_hourly_m3s`, String(y * 110)],
      ]),
    ),
  };

  it("places today's inflow against GEOGLOWS and against the site's own record, separately", () => {
    // Six complete years, maxima 300..800.
    const inflow = daily("2018-01-01", 6 * 365 + 1, (i) => (i % 365 === 100 ? 300 + Math.floor(i / 365) * 100 : 40));
    const rp = returnPeriodsFor(inflow, 520, row);
    expect(rp.geoglows).toMatchObject({ river_id: 620988388, area_diff_pct: -1.34, reached_years: 5 });
    expect(rp.geoglows?.hourly[0]).toEqual({ years: 2, m3s: 220 });
    expect(rp.measured).toMatchObject({ years: 6, first_year: 2018, last_year: 2023, record_m3s: 800 });
    expect(rp.measured?.reached_years).toBe(2);
  });

  it("fits nothing on fewer than five complete years, and has no GEOGLOWS side without a row", () => {
    const rp = returnPeriodsFor(
      daily("2022-01-01", 4 * 365, () => 10),
      10,
      undefined,
    );
    expect(rp).toEqual({ geoglows: null, measured: null });
  });
});

describe("the page's words", () => {
  it("says the sources agree within 15% and says which way they disagree beyond it", () => {
    expect(returnPeriodAgreement(615, 583)).toMatch(/casi coinciden/);
    expect(returnPeriodAgreement(1583, 679)).toMatch(/2,3 veces.*más grandes/);
    expect(returnPeriodAgreement(184, 261)).toMatch(/30 % menos.*más pequeñas/);
  });

  it("places today's flow below the 2-year flood or at the longest one it reaches", () => {
    expect(returnPeriodReachedWords(null, 615)).toBe("por debajo de la crecida de 2 años (615 m³/s)");
    expect(returnPeriodReachedWords(10, 615)).toBe("alcanza la crecida de 10 años");
  });
});

describe("the portal walk", () => {
  const page =
    '<html><head><base href="/"><script src="main-AB12.js" type="module"></script><link rel="modulepreload" href="chunk-CD34.js"></head></html>';

  it("resolves bundles against <base href>, not beside the page", () => {
    const base = baseOf(page, "https://inamhi.geoglows.org/apps/hydroviewer-ecuador/");
    expect(bundleRefs(page).map((r) => resolveRef(r, base))).toEqual([
      "https://inamhi.geoglows.org/chunk-CD34.js",
      "https://inamhi.geoglows.org/main-AB12.js",
    ]);
  });

  it("finds lazy chunks named inside a bundle", () => {
    expect(bundleRefs('x=()=>import("./chunk-EF56.js").then(m=>m.R)')).toEqual(["./chunk-EF56.js"]);
  });

  it("keeps hosts and API-looking paths with their context, and drops assets", () => {
    const js = 'a.get("https://api.example.org/v1/x");b="/apps/hydroviewer-ecuador/get-return-periods/";c="/assets/logo.png";d="/a/b"';
    expect(endpointsIn(js, "main.js").map((e) => e.literal)).toEqual([
      "https://api.example.org/v1/x",
      "/apps/hydroviewer-ecuador/get-return-periods/",
    ]);
  });

  it("recognises the app's HTML shell answering a bundle request", () => {
    expect(isHtml("<!doctype html>\n<html>")).toBe(true);
    expect(isHtml("var a=1")).toBe(false);
  });
});

describe("paths built on the app's configured roots", () => {
  it('reads `${xs.urlAPI}/x` and `xs.urlAPI+"/x"` as endpoints', () => {
    const js = 'fetch(`${xs.urlAPI}/hydroviewer/get-return-periods?comid=${t}`);g(xs.urlGeoserver+"/wfs?x=1")';
    expect(endpointsIn(js, "main.js").map((e) => e.literal)).toEqual([
      "${urlAPI}/hydroviewer/get-return-periods?comid=${t}",
      "${urlGeoserver}/wfs?x=1",
    ]);
  });

  it("finds keywords with their context", () => {
    expect(keywordHits("a return_period b return_period", "m.js", ["return_period"], 1)).toHaveLength(1);
  });
});
