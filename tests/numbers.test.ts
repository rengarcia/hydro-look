import { describe, expect, it } from "vitest";
import { asNumber, parseEsNumber, round6 } from "../src/lib/util/numbers.ts";

describe("number parsing", () => {
  it("reads SMEC's comma thousands and CENACE's thin spaces", () => {
    expect(parseEsNumber("76,808,654.928")).toBe(76808654.928);
    expect(parseEsNumber("104 277")).toBe(104277);
    expect(parseEsNumber("1 177")).toBe(1177);
    expect(parseEsNumber("-60.773")).toBe(-60.773);
    expect(parseEsNumber("0.000")).toBe(0);
  });

  it("returns null rather than NaN for non-numbers", () => {
    expect(parseEsNumber("")).toBeNull();
    expect(parseEsNumber("Total Generación")).toBeNull();
    expect(parseEsNumber("-")).toBeNull();
  });

  it("rounds the ORDS's 40-digit values to something a CSV can hold", () => {
    // As it arrives: JSON.parse has already truncated the 40 digits to a double.
    const asParsed = (JSON.parse('{"v":73.84905660377358490566037735849056603774}') as { v: number }).v;
    expect(round6(asParsed)).toBe(73.849057);
    expect(asNumber(null)).toBeNull();
    expect(asNumber(2139.1)).toBe(2139.1);
  });
});
