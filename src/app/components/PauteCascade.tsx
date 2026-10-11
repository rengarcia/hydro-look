/**
 * The Paute cascade in profile, on the pages of its three sites: Mazar's lake, Amaluza's below it,
 * Molino's tunnel and the chamber Sopladora draws from, each at its real height and filled to
 * today's level. After Sterl et al. (2026, *Nature Water* 4, 571–585, Fig. 3a), which is where
 * the days of storage come from; the levels, bands and riverbeds are this repository's
 * (`latest.json`, `reservoir_geometry.csv`). The geometry is `lib/site/cascade.ts`.
 */

import { referenceTable } from "../../lib/site/data.ts";
import { num, shortDate } from "../../lib/site/format.ts";
import { GEOMETRY_FILE } from "../../lib/site/geometry.ts";
import { lakeWater, STORAGE_DAYS, type ProfilePoint } from "../../lib/site/cascade.ts";
import type { ReservoirSnapshot } from "../../lib/publish/latest.ts";

export const PAUTE_SITES = new Set(["mazar", "amaluza", "sopladora"]);

const W = 640;
const H = 450;
const TOP = 78;
const BOTTOM = 420;
const LEFT = 72;
const DOMAIN: [number, number] = [1250, 2200];
const y = (m: number) => Math.round((BOTTOM - ((m - DOMAIN[0]) / (DOMAIN[1] - DOMAIN[0])) * (BOTTOM - TOP)) * 10) / 10;
const path = (pts: ProfilePoint[], close = true) =>
  pts.length === 0 ? "" : `M${pts.map((p) => `${p.x},${y(p.m)}`).join("L")}${close ? "Z" : ""}`;

interface Lake {
  site: "mazar" | "amaluza";
  label: string;
  upstream: ProfilePoint;
  dam: ProfilePoint;
  name: string;
}

export function PauteCascade({ reservoirs, site }: { reservoirs: ReservoirSnapshot[]; site: string }) {
  if (!PAUTE_SITES.has(site)) return null;
  const geometry = new Map(referenceTable(GEOMETRY_FILE).map((r) => [r["site"], r]));
  const bed = (s: string) => Number(geometry.get(s)?.["riverbed_masl"]);
  const hm3 = (s: string) => Number(geometry.get(s)?.["upper_hm3"]);
  const of = (s: string) => reservoirs.find((r) => r.site === s) ?? null;
  const mazarBed = bed("mazar");
  const amaluzaBed = bed("amaluza");
  if (!Number.isFinite(mazarBed) || !Number.isFinite(amaluzaBed)) return null;

  const lakes: Lake[] = [
    { site: "mazar", label: "Mazar", upstream: { x: LEFT + 8, m: 2175 }, dam: { x: 270, m: mazarBed }, name: "Mazar · 170 MW" },
    { site: "amaluza", label: "Amaluza", upstream: { x: 288, m: mazarBed }, dam: { x: 450, m: amaluzaBed }, name: "Amaluza" },
  ];
  const chamber = of("sopladora");
  const chamberBand = chamber?.bands[0] ?? null;
  const date = of("mazar")?.level?.date ?? chamber?.level?.date ?? null;
  const ticks = [1300, 1500, 1700, 1900, 2100];
  const title =
    "Perfil del complejo Paute: el embalse de Mazar, el de Amaluza debajo y la cámara de la que toma agua Sopladora, " +
    "a su altura real y llenos hasta el nivel de hoy";

  return (
    <div className="panel">
      <h3 className="panel-title">La cascada del Paute</h3>
      <p className="panel-lede">
        Tres centrales en un mismo río. Lo que suelta Mazar llega al embalse de Amaluza; de ahí un túnel lleva el agua a las turbinas de
        Molino, y lo que sale de Molino pasa por una cámara directo a Sopladora. Las alturas están a escala y el agua llega al nivel de hoy;
        las distancias no: el lago de Mazar mide unos 30 km.
      </p>
      <svg className="chart cascade" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={title}>
        <title>{title}</title>
        <g className="axis" aria-hidden="true" fontFamily="var(--mono)" fontSize={11} fill="var(--muted)">
          {ticks.map((t) => (
            <g key={t}>
              <line x1={LEFT} x2={W - 8} y1={y(t)} y2={y(t)} stroke="var(--line)" />
              <text x={LEFT - 8} y={y(t)} dy="0.35em" textAnchor="end">
                {num(t, 0)}
              </text>
            </g>
          ))}
          <text x={4} y={y(1300) + 22}>
            m s. n. m.
          </text>
        </g>

        {/* The riverbed: down Mazar's lake, from Mazar's toe down Amaluza's, and on below Amaluza. */}
        <path
          className="cascade-bed"
          d={path(
            [
              lakes[0]!.upstream,
              lakes[0]!.dam,
              { x: lakes[1]!.upstream.x, m: mazarBed },
              lakes[1]!.dam,
              { x: lakes[1]!.dam.x + 18, m: amaluzaBed },
              { x: W - 8, m: 1440 },
            ],
            false,
          )}
        />

        {lakes.map((lake) => {
          const r = of(lake.site);
          const level = r?.level?.masl ?? null;
          const band = r?.bands[0] ?? null;
          const crest = (band?.max_masl ?? lake.dam.m + 100) + 12;
          const days = STORAGE_DAYS[lake.site];
          const volume = hm3(lake.site);
          const water = level !== null ? lakeWater(lake.upstream, lake.dam, level) : [];
          const middle = (lake.upstream.x + lake.dam.x) / 2;
          const note = [
            Number.isFinite(volume) && lake.site === "mazar" ? `${num(volume, 0)} hm³` : null,
            days ? `~${days} días de caudal medio` : null,
          ].filter(Boolean);
          return (
            <g key={lake.site}>
              <path className="cascade-water" d={path(water)} />
              {band
                ? [band.max_masl, band.min_masl].map((m, i) => (
                    <line key={i} className="cascade-band" x1={middle - 40} x2={lake.dam.x} y1={y(m)} y2={y(m)} />
                  ))
                : null}
              <path
                className="cascade-dam"
                d={`M${lake.dam.x},${y(lake.dam.m)}L${lake.dam.x},${y(crest)}L${lake.dam.x + 6},${y(crest)}L${lake.dam.x + 18},${y(lake.dam.m)}Z`}
              />
              <text className="cascade-name" x={middle} y={y(crest) - 50} textAnchor="middle">
                {lake.name}
              </text>
              <text className="cascade-note" x={middle} y={y(crest) - 34} textAnchor="middle">
                {note.join(" · ")}
              </text>
              {band ? (
                <text className="cascade-note" x={middle} y={y(crest) - 20} textAnchor="middle">
                  rango {num(band.min_masl, 0)}–{num(band.max_masl, 0)} m
                </text>
              ) : null}
              {level !== null ? (
                <text className="cascade-level" x={lake.dam.x - 6} y={y(level) + 14} textAnchor="end">
                  hoy {num(level, 2)}
                </text>
              ) : null}
            </g>
          );
        })}

        {/* Molino's tunnel from Amaluza's intake to the chamber, and the chamber Sopladora draws from. */}
        <path className="cascade-tunnel" d={`M${lakes[1]!.dam.x - 4},${y(1935)}L${520},${y(1330)}L${548},${y(1315)}`} />
        <text className="cascade-note" x={474} y={y(1640)} textAnchor="end">
          Molino, 1.100 MW
        </text>
        <rect className="cascade-chamber" x={548} y={y(1325)} width={30} height={y(1305) - y(1325)} />
        {chamber?.level ? (
          <rect className="cascade-water" x={548} y={y(chamber.level.masl)} width={30} height={y(1305) - y(chamber.level.masl)} />
        ) : null}
        <path className="cascade-tunnel" d={`M${578},${y(1312)}L${612},${y(1262)}`} markerEnd="url(#cascade-arrow)" />
        <defs>
          <marker id="cascade-arrow" viewBox="0 0 8 8" refX="6" refY="4" markerWidth="7" markerHeight="7" orient="auto">
            <path d="M0,0L8,4L0,8Z" className="cascade-arrowhead" />
          </marker>
        </defs>
        <text className="cascade-name" x={563} y={y(1325) - 36} textAnchor="middle">
          Sopladora
        </text>
        <text className="cascade-note" x={563} y={y(1325) - 21} textAnchor="middle">
          cámara{chamberBand ? `, ${num(chamberBand.min_masl, 0)}–${num(chamberBand.max_masl, 0)} m` : ""}
        </text>
        {chamber?.level ? (
          <text className="cascade-level" x={544} y={y(1305) + 14} textAnchor="end">
            hoy {num(chamber.level.masl, 2)}
          </text>
        ) : null}
        <text className="cascade-note" x={W - 8} y={y(1262) + 18} textAnchor="end">
          a las turbinas, 487 MW
        </text>
      </svg>
      <p className="fine spaced">
        Niveles{date ? ` del ${shortDate(date)}` : ""}, con el rango de operación que publica CELEC. Mazar, con {num(hm3("mazar"), 0)} hm³,
        guarda unos {STORAGE_DAYS["mazar"]} días del caudal medio del río; Amaluza, unos {STORAGE_DAYS["amaluza"]}, según Sterl et al.
        (2026), <i>Nature Water</i> 4, 571–585, figura 3a. El volumen de Amaluza no se muestra porque los sedimentos se han llevado parte de
        él desde 1983. Molino tiene 1.100 MW y Sopladora 487. Lecho del río: alturas de diseño de cada presa.
      </p>
    </div>
  );
}
