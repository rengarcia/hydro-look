/**
 * `lib/site/geometry.ts` over the committed `data/reference/reservoir_geometry.csv`: every row
 * says something a gauge can use, the fitted curve outranks the design one where both exist, and
 * the notes say what the straight gauges cannot draw.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseCsv } from "../src/lib/store/csv.ts";
import { designCurve, geometryFrom, GEOMETRY_FILE } from "../src/lib/site/geometry.ts";
import { storedHm3, volumeShare, type AreaCurve } from "../src/lib/site/shape.ts";
import { hm3Text, noteOf } from "../src/app/components/Fleet.tsx";
import { SITES } from "../src/lib/registry.ts";

const ROWS = parseCsv(readFileSync(join(process.cwd(), "data", "reference", GEOMETRY_FILE), "utf8"));
const MAZAR_FIT: AreaCurve = { coefficient: 48.305449, exponent: 2.5, datum_m: 2036.66 };

describe("the reference table", () => {
  it("names only known sites, once each, with a source", () => {
    const sites = ROWS.map((r) => r["site"]!);
    expect(new Set(sites).size).toBe(sites.length);
    for (const row of ROWS) {
      expect(Object.keys(SITES)).toContain(row["site"]);
      expect(row["source"]).toMatch(/^https:\/\//);
      expect(row["evidence"]!.length).toBeGreaterThan(20);
    }
  });

  it("yields a curve from every design row, through the figures it cites", () => {
    for (const row of ROWS.filter((r) => r["kind"]!.startsWith("design_"))) {
      const curve = designCurve(row);
      expect(curve, row["site"]).not.toBeNull();
      expect(storedHm3(curve!, Number(row["riverbed_masl"]), Number(row["upper_masl"]))).toBeCloseTo(Number(row["upper_hm3"]), 6);
    }
  });

  it("gives every pond a volume and every chamber both thresholds", () => {
    const geometry = geometryFrom(ROWS);
    for (const row of ROWS) {
      const site = geometry[row["site"]!]!;
      if (row["kind"] === "pond") expect(site.pondHm3).toBeGreaterThan(0);
      if (row["kind"] === "chamber") expect(site.spillMasl!).toBeGreaterThan(site.tripMasl!);
    }
  });
});

describe("which curve draws", () => {
  it("prefers Mazar's fit for the shape and keeps the design curve for the volume's other end", () => {
    const mazar = geometryFrom(ROWS, { mazar: MAZAR_FIT })["mazar"]!;
    expect(mazar.curve).toBe(MAZAR_FIT);
    expect(mazar.curveSource).toBe("fit");
    expect(mazar.volumeCurves).toHaveLength(2);
    const full = mazar.volumeCurves.map((c) => storedHm3(c, 2100, 2153));
    expect(full[0]).toBeCloseTo(206.5, 0);
    expect(full[1]).toBeGreaterThan(290);
    expect(hm3Text(full)).toBe("206–302 hm³");
  });

  it("falls back to the design curve without a fit", () => {
    expect(geometryFrom(ROWS)["mazar"]!.curveSource).toBe("design");
  });

  it("hides Amaluza's hm³, which silt has made wrong, but keeps its shape", () => {
    const amaluza = geometryFrom(ROWS)["amaluza"]!;
    expect(amaluza.curve).not.toBeNull();
    expect(amaluza.volumeCurves).toEqual([]);
  });

  it("puts the share of water near the share of metres where the band is a thin slice of a deep valley", () => {
    // Manduriacu's normal band, 489.4–492.5 m, sits 35 m above the riverbed.
    const curve = geometryFrom(ROWS)["manduriacu"]!.curve!;
    expect(volumeShare(curve, 489.4, 492.5, 490.95)).toBeGreaterThan(47);
    expect(volumeShare(curve, 489.4, 492.5, 490.95)).toBeLessThan(50);
  });
});

describe("what the gauge says", () => {
  const geometry = geometryFrom(ROWS);

  it("says a pond's size in hours of flow where the flow is known", () => {
    expect(noteOf(geometry["coca_codo_sinclair"], 1219.9)).toBe(
      "embalse pequeño (≈0,8 hm³, una hora de caudal de diseño): mide altura, no agua",
    );
    expect(noteOf(geometry["delsitanisagua"], 1487)).toBe("embalse pequeño (≈0,6 hm³): mide altura, no agua");
  });

  it("names a chamber's thresholds", () => {
    expect(noteOf(geometry["sopladora"], 1315.6)).toContain("1.312 m");
    expect(noteOf(geometry["sopladora"], 1315.6)).toContain("1.315,5 m");
  });

  it("flags a drawdown below the design minimum, and only then", () => {
    expect(noteOf(geometry["agoyan"], 1640)).toBe("bajo su mínimo de diseño (1.645,0 m): vaciado o purga");
    expect(noteOf(geometry["agoyan"], 1646)).toBeNull();
    expect(noteOf(undefined, 1)).toBeNull();
  });

  it("writes one volume, a range, or nothing", () => {
    expect(hm3Text([])).toBeNull();
    expect(hm3Text([9.94])).toBe("≈9,9 hm³");
    expect(hm3Text([66.8, 117.2])).toBe("67–117 hm³");
    expect(hm3Text([66.8, 67.1])).toBe("≈67 hm³");
  });
});
