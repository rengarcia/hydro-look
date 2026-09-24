/**
 * The share preview: the day's headline and Mazar's level as a gauge, drawn at build time.
 *
 * `next/og` renders the JSX below to a PNG with satori and resvg, both bundled with Next, and in
 * a static export it does so once, during `next build`, with no network: the typefaces are read
 * from `src/lib/site/fonts/` (the WOFF files of the faces the site serves, which satori can read
 * and WOFF2 it cannot). The image is therefore as current as the build, which is rebuilt every
 * time the data changes — a link shared today previews today's numbers.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { latest } from "../lib/site/data.ts";
import { dateWithYear, num, pct } from "../lib/site/format.ts";
import { direction, heroHeadline } from "../lib/site/story.ts";

export const dynamic = "force-static";
export const alt = "hydro-look: cuánta de la electricidad del Ecuador salió del agua ayer, y el nivel de Mazar.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const FONTS = join(process.cwd(), "src", "lib", "site", "fonts");

const INK = "#10201e";
const INK_2 = "#3f4d4a";
const BG = "#f2efe7";
const WATER = "#0a6a70";
const SUNK = "#e8e4d9";
const DEFICIT = "#a8231c";

function words(text: string, color: string): { text: string; color: string }[] {
  return text
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => ({ text: word, color }));
}

export default function OpenGraphImage() {
  const now = latest();
  const headline = heroHeadline(now?.national?.hydro_share_pct);
  const mazar = now?.reservoirs.find((r) => r.site === "mazar") ?? null;
  const level = mazar?.level ?? null;
  const band = mazar?.bands[0] ?? null;
  const fill = band?.band_pct ?? null;
  const dir = direction(mazar?.slopes_m_per_day.d7);
  const date = now?.data_date ?? null;

  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", background: BG, color: INK, padding: "64px 72px", fontFamily: "Geist" }}>
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", width: 760 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 30, fontFamily: "Instrument Serif" }}>
          <span>hydro</span>
          <span style={{ color: WATER, marginLeft: -12, marginRight: -12 }}>·</span>
          <span>look</span>
          {date ? (
            <span style={{ marginLeft: 24, fontFamily: "Geist Mono", fontSize: 20, color: INK_2 }}>
              Ecuador · datos al {dateWithYear(date)}
            </span>
          ) : null}
        </div>
        {/* One element per word: satori wraps flex items, not the text inside one. */}
        <div
          style={{ display: "flex", flexWrap: "wrap", fontFamily: "Instrument Serif", fontSize: 84, lineHeight: 1.02, letterSpacing: -2 }}
        >
          {[
            ...words(headline.share !== null ? headline.before : headline.text, INK),
            ...words(headline.emphasis, WATER),
            ...words(headline.after, INK),
          ].map((w, i) => (
            <span key={i} style={{ color: w.color, marginRight: 20 }}>
              {w.text}
            </span>
          ))}
        </div>
        <div style={{ display: "flex", fontSize: 26, color: INK_2 }}>
          {level
            ? `Mazar, el embalse que guarda agua para semanas: ${num(level.masl, 2)} m${dir === "down" ? ", bajando" : dir === "up" ? ", subiendo" : ", estable"}.`
            : "Embalses, ríos y electricidad del Ecuador, día a día."}
        </div>
      </div>
      {level && fill !== null ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginLeft: "auto", width: 230 }}>
          <div style={{ display: "flex", fontFamily: "Geist Mono", fontSize: 20, color: INK_2 }}>{num(band!.max_masl, 0)} m</div>
          <div
            style={{
              display: "flex",
              position: "relative",
              width: 150,
              height: 360,
              marginTop: 8,
              marginBottom: 8,
              borderRadius: 22,
              background: SUNK,
              overflow: "hidden",
              border: `2px solid ${INK}`,
            }}
          >
            <div
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                bottom: 0,
                height: `${Math.min(100, Math.max(0, fill))}%`,
                background: WATER,
              }}
            />
            <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 4, background: DEFICIT }} />
          </div>
          <div style={{ display: "flex", fontFamily: "Geist Mono", fontSize: 20, color: DEFICIT }}>{num(band!.min_masl, 0)} m mín.</div>
          <div style={{ display: "flex", marginTop: 14, fontFamily: "Instrument Serif", fontSize: 44 }}>{pct(fill, 1)}</div>
          <div style={{ display: "flex", fontSize: 18, color: INK_2 }}>de su rango, no de agua</div>
        </div>
      ) : null}
    </div>,
    {
      ...size,
      fonts: [
        {
          name: "Instrument Serif",
          data: readFileSync(join(FONTS, "instrument-serif-latin-400-normal.woff")),
          weight: 400,
          style: "normal",
        },
        { name: "Geist", data: readFileSync(join(FONTS, "geist-sans-latin-400-normal.woff")), weight: 400, style: "normal" },
        { name: "Geist", data: readFileSync(join(FONTS, "geist-sans-latin-500-normal.woff")), weight: 500, style: "normal" },
        { name: "Geist Mono", data: readFileSync(join(FONTS, "geist-mono-latin-400-normal.woff")), weight: 400, style: "normal" },
      ],
    },
  );
}
