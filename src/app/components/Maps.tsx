/**
 * Where the dams are: the fleet on one map of Ecuador, and each reservoir in its own catchment.
 *
 * The fleet map redraws Sterl et al. (2026, *Nature Water* 4, 571–585, Fig. 1) from this
 * repository's own layers: mainland Ecuador, the Andes as bands of height, the rivers, and every
 * plant of more than 100 MW — a diamond where the reservoir holds more than five days of the
 * river's average flow, a circle where it holds less, with area proportional to capacity. The
 * plants this site follows are filled and link to their pages; the others are drawn hollow, for
 * where they are, and say so.
 *
 * The catchment map zooms the same layers to the area that drains into one dam, the polygon
 * `npm run catchments` delineated, with every river that drains at least 60 km². Both are inline
 * SVG with no script, like every chart on the site, and both carry their points in a table.
 */

import type { ReactNode } from "react";
import { Table } from "./DataTable.tsx";
import { mapData, type MapData } from "../../lib/site/data.ts";
import { num } from "../../lib/site/format.ts";
import {
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
  type Box,
  type Projection,
} from "../../lib/site/map.ts";
import type { Catchment, PlantPlace } from "../../lib/site/places.ts";

/** The fleet map's frame: mainland Ecuador, as in the paper's Fig. 1. */
const ECUADOR: Box = { west: -81.15, south: -5.1, east: -75.15, north: 1.55 };
const FLEET_WIDTH = 600;
/** Rivers on the national map: the ones that drain at least this much. */
const NATIONAL_RIVER_KM2 = 1500;
const DETAIL_RIVER_KM2 = 60;

/** Which catchment a reservoir's page draws: Sopladora has none of its own, it runs on what leaves Molino. */
const CATCHMENT_OF: Record<string, string> = { sopladora: "amaluza" };

const SLOPE_ES = { amazon: "amazónica", pacific: "del Pacífico" } as const;

/** Where each plant's label sits on the fleet map, by hand: ten labels on a 600-pixel map do not place themselves. */
const FLEET_LABELS: Record<string, { dx: number; dy: number; anchor: "start" | "end"; text?: string }> = {
  coca_codo_sinclair: { dx: 16, dy: 4, anchor: "start" },
  manduriacu: { dx: -8, dy: 0, anchor: "end" },
  toachi_pilaton: { dx: -8, dy: 6, anchor: "end" },
  marcel_laniado: { dx: 9, dy: 4, anchor: "start" },
  agoyan: { dx: -8, dy: 4, anchor: "end" },
  san_francisco: { dx: 9, dy: 4, anchor: "start" },
  sopladora: { dx: 11, dy: 4, anchor: "start", text: "Complejo Paute" },
  minas_san_francisco: { dx: 8, dy: -4, anchor: "start" },
  delsitanisagua: { dx: 9, dy: 2, anchor: "start" },
};

/** On the zoomed maps, which side of its marker a plant's label goes; the default is the side with room. */
const DETAIL_LABELS: Record<string, "left" | "right" | "above" | "below"> = {
  mazar: "left",
  amaluza: "above",
  sopladora: "below",
  agoyan: "left",
  delsitanisagua: "left",
  delsitanisagua_powerhouse: "right",
};

const CITY_LABELS: Record<string, { dx: number; dy: number; anchor: "start" | "end" }> = {
  Quito: { dx: 7, dy: -5, anchor: "start" },
  Guayaquil: { dx: -7, dy: 4, anchor: "end" },
  Cuenca: { dx: -7, dy: 10, anchor: "end" },
};

const r1 = (v: number) => Math.round(v * 10) / 10;

/** Plant markers: the page a filled one links to, or null for one this site does not follow. */
function pageOf(plant: PlantPlace, followed: ReadonlySet<string>): string | null {
  const site = plant.siteId ?? (plant.key === "molino" ? "amaluza" : null);
  return site && followed.has(site) ? `/embalses/${site}/` : null;
}

function Marker({
  plant,
  p,
  scale,
  href,
  label,
  filled = href !== null,
}: {
  plant: PlantPlace;
  p: Projection;
  scale: number;
  href: string | null;
  label: string;
  filled?: boolean;
}) {
  const x = r1(p.x(plant.lon));
  const y = r1(p.y(plant.lat));
  const r = markerRadius(plant.capacityMw, scale);
  const shape =
    plant.storage === ">5" ? (
      <path d={`M${x},${r1(y - r * 1.25)}L${r1(x + r * 1.25)},${y}L${x},${r1(y + r * 1.25)}L${r1(x - r * 1.25)},${y}Z`} />
    ) : (
      <circle cx={x} cy={y} r={r1(r)} />
    );
  const mark = (
    <g className={filled ? "map-plant" : "map-plant map-plant-other"}>
      <title>{label}</title>
      {shape}
    </g>
  );
  return href ? <a href={href}>{mark}</a> : mark;
}

function plantTitle(plant: PlantPlace, followed: boolean): string {
  const parts = [
    plant.name,
    `río ${plant.river}`,
    plant.capacityMw ? `${num(plant.capacityMw, 0)} MW` : null,
    plant.inService ? `desde ${plant.inService}` : null,
    plant.storage === ">5" ? "embalse de más de 5 días" : plant.storage === "<5" ? "menos de 5 días de embalse" : null,
    followed ? null : "este sitio no recoge su nivel",
  ];
  return parts.filter(Boolean).join(" · ");
}

/** Countries, relief and the given rivers, under whatever the map draws on top. */
function BaseLayers({
  data,
  p,
  riverMinKm2,
  riverScale,
}: {
  data: MapData;
  p: Projection;
  riverMinKm2: number;
  riverScale: [number, number];
}) {
  const basemap = data.basemap!;
  const view: Box = p.box;
  return (
    <>
      <rect x={0} y={0} width={p.width} height={p.height} className="map-sea" />
      {basemap.countries
        .filter((c) => overlaps(c.box, view))
        .map((c) => (
          <path
            key={c.code}
            d={polygonPath(c.geometry, p, 0.8)}
            fillRule="evenodd"
            className={c.code === "ECU" ? "map-land" : "map-land map-land-other"}
          />
        ))}
      {basemap.relief.map((band) => (
        <path key={band.minM} d={polygonPath(band.geometry, p, 0.8)} fillRule="evenodd" className="map-relief" />
      ))}
      <g className="map-rivers">
        {basemap.rivers
          .filter((r) => r.areaKm2 >= riverMinKm2 && overlaps(r.box, view))
          .map((r, i) => (
            <path
              key={i}
              d={linePath(r.coordinates, p, false, 0.8)}
              strokeWidth={r1(riverWidth(r.areaKm2, riverMinKm2, riverScale[0], riverScale[1]))}
            />
          ))}
      </g>
      {basemap.countries
        .filter((c) => c.code === "ECU")
        .map((c) => (
          <path key="border" d={polygonPath(c.geometry, p, 0.8)} className="map-border" />
        ))}
    </>
  );
}

function Cities({ data, p, labels }: { data: MapData; p: Projection; labels: boolean }) {
  return (
    <g className="map-cities">
      {data
        .basemap!.cities.filter((c) => contains(p.box, c.lon, c.lat))
        .map((c) => {
          const x = r1(p.x(c.lon));
          const y = r1(p.y(c.lat));
          const at = CITY_LABELS[c.name] ?? { dx: 7, dy: 4, anchor: "start" as const };
          return (
            <g key={c.name}>
              <rect x={x - 3} y={y - 3} width={6} height={6} />
              {labels ? (
                <text x={x + at.dx} y={y + at.dy} textAnchor={at.anchor}>
                  {c.name}
                </text>
              ) : null}
            </g>
          );
        })}
    </g>
  );
}

/* ------------------------------------------------------------------ fleet */

export function FleetMap({ followed, data = mapData() }: { followed: ReadonlySet<string>; data?: MapData }) {
  if (data.basemap === null || data.plants.length === 0) return null;
  const p = project(ECUADOR, FLEET_WIDTH);
  const scale = 0.36;
  const plants = [...data.plants].filter((pl) => pl.capacityMw !== null).sort((a, b) => (b.capacityMw ?? 0) - (a.capacityMw ?? 0));
  const catchments = data.catchments;
  const following = plants.filter((pl) => pageOf(pl, followed) !== null);
  const label = `Mapa del Ecuador continental con ${plants.length} centrales hidroeléctricas, ${following.length} de ellas con embalse que sigue este sitio, sobre los Andes y los ríos principales`;

  return (
    <figure className="map-figure">
      <svg className="map" viewBox={`0 0 ${p.width} ${p.height}`} role="img" aria-label={label}>
        <title>{label}</title>
        <BaseLayers data={data} p={p} riverMinKm2={NATIONAL_RIVER_KM2} riverScale={[0.7, 1.1]} />
        <g className="map-catchments">
          {catchments.map((c) => (
            <path key={c.site} d={polygonPath(c.geometry, p, 0.8)} fillRule="evenodd">
              <title>{`Cuenca sobre ${data.plants.find((pl) => (pl.siteId ?? pl.key) === c.site)?.name ?? c.site}: ${num(c.areaKm2, 0)} km²`}</title>
            </path>
          ))}
        </g>
        <Cities data={data} p={p} labels />
        <g className="map-labels map-region" aria-hidden="true">
          <text x={r1(p.x(-80.95))} y={r1(p.y(1.2))}>
            Océano Pacífico
          </text>
          <text x={r1(p.x(-77.6))} y={r1(p.y(1.3))}>
            Colombia
          </text>
          <text x={r1(p.x(-76.4))} y={r1(p.y(-4.2))}>
            Perú
          </text>
        </g>
        {plants.map((pl) => (
          <Marker
            key={pl.key}
            plant={pl}
            p={p}
            scale={scale}
            href={pageOf(pl, followed)}
            label={plantTitle(pl, pageOf(pl, followed) !== null)}
          />
        ))}
        <g className="map-labels" aria-hidden="true">
          {plants.map((pl) => {
            const at = FLEET_LABELS[pl.key];
            if (!at) return null;
            const r = markerRadius(pl.capacityMw, scale);
            const x = r1(p.x(pl.lon) + (at.anchor === "start" ? Math.max(at.dx, r + 4) : Math.min(at.dx, -r - 4)));
            return (
              <text
                key={pl.key}
                x={x}
                y={r1(p.y(pl.lat) + at.dy)}
                textAnchor={at.anchor}
                className={pageOf(pl, followed) ? undefined : "map-label-other"}
              >
                {at.text ?? pl.name.replace(/ \(.*\)$/, "")}
              </text>
            );
          })}
        </g>
      </svg>
    </figure>
  );
}

export function FleetMapLegend() {
  return (
    <div className="legend-stack map-legend">
      <div>
        <span className="key-relief" aria-hidden="true" />
        Andes: cada tono, 1.000 m más (de 1.000 a más de 4.000 m)
      </div>
      <div>
        <span className="key-river" aria-hidden="true" />
        ríos que drenan más de {num(NATIONAL_RIVER_KM2, 0)} km²
      </div>
      <div>
        <span className="key-catchment" aria-hidden="true" />
        cuenca sobre cada presa
      </div>
      <div>
        <span className="key-diamond" aria-hidden="true" />
        embalse de más de 5 días del caudal medio del río
      </div>
      <div>
        <span className="key-circle" aria-hidden="true" />
        menos de 5 días; el área es proporcional a la potencia
      </div>
      <div>
        <span className="key-circle key-hollow" aria-hidden="true" />
        central que este sitio no sigue
      </div>
    </div>
  );
}

/** The plants of the fleet map, as a table: what the map shows, in numbers. */
export function PlantsTable({ followed, data = mapData() }: { followed: ReadonlySet<string>; data?: MapData }) {
  const plants = data.plants.filter((pl) => pl.capacityMw !== null);
  if (plants.length === 0) return null;
  return (
    <details className="chart-data">
      <summary>Ver las centrales del mapa</summary>
      <div className="table-scroll">
        <Table
          caption="Centrales hidroeléctricas del mapa"
          columns={[
            { label: "Central" },
            { label: "Río" },
            { label: "MW", numeric: true },
            { label: "Desde", numeric: true },
            { label: "Embalse", wideOnly: true },
            { label: "Posición", wideOnly: true },
          ]}
          rows={plants.map((pl) => {
            const href = pageOf(pl, followed);
            return [
              href ? <a href={href}>{pl.name}</a> : pl.name,
              `${pl.river} (vertiente ${SLOPE_ES[pl.slope]})`,
              num(pl.capacityMw, 0),
              pl.inService ?? "—",
              pl.storage === ">5" ? "más de 5 días" : pl.storage === "<5" ? "menos de 5 días" : "—",
              `${latLonEs(pl.lat, pl.lon)} (${pl.feature === "dam" ? "presa" : "casa de máquinas"})`,
            ];
          })}
        />
      </div>
      <p className="fine">
        Potencia, año de entrada en operación y clase de embalse según Sterl et al. (2026), <i>Nature Water</i> 4, 571–585, figura 1;
        Manduriacu, de 65 MW, queda bajo su umbral de 100 MW. Las posiciones son las presas de OpenStreetMap y Wikidata con que se
        delinearon las cuencas, y su fuente está en <code>data/reference/plant_locations.csv</code>.
      </p>
    </details>
  );
}

/* -------------------------------------------------------------- catchment */

export function catchmentFor(site: string, data: MapData = mapData()): Catchment | null {
  const target = CATCHMENT_OF[site] ?? site;
  return data.catchments.find((c) => c.site === target) ?? null;
}

/** Where the reservoir's dam is, inside the area that drains into it. */
export function CatchmentMap({ site, label, data = mapData() }: { site: string; label: string; data?: MapData }) {
  const catchment = catchmentFor(site, data);
  if (data.basemap === null || catchment === null) return null;
  const box = fitBox(catchment.box, 1.25, 0.08);
  const p = project(box, 640);
  const scale = 0.32;
  // Molino is drawn at the Amaluza dam that feeds it; on a zoomed map the two would be one marker under two labels.
  const plants = data.plants.filter((pl) => contains(box, pl.lon, pl.lat) && pl.key !== "molino");
  const others = data.catchments.filter((c) => c.site !== catchment.site && overlaps(c.box, box));
  const bar = scaleBarKm(p, 120);
  const barPx = r1(bar * p.pxPerKm);
  const title = `Mapa de la cuenca que drena hacia ${label}: ${num(catchment.areaKm2, 0)} km², con sus ríos, el relieve y las presas`;
  const own = new Set([site, CATCHMENT_OF[site]].filter(Boolean));

  return (
    <svg className="map" viewBox={`0 0 ${p.width} ${p.height}`} role="img" aria-label={title}>
      <title>{title}</title>
      <BaseLayers data={data} p={p} riverMinKm2={DETAIL_RIVER_KM2} riverScale={[0.6, 1.2]} />
      <g className="map-catchments map-catchments-other">
        {others.map((c) => (
          <path key={c.site} d={polygonPath(c.geometry, p, 0.8)} fillRule="evenodd" />
        ))}
      </g>
      <path d={polygonPath(catchment.geometry, p, 0.8)} fillRule="evenodd" className="map-catchment-own" />
      <Cities data={data} p={p} labels />
      {plants.map((pl) => (
        <Marker
          key={pl.key}
          plant={pl}
          p={p}
          scale={scale}
          href={null}
          filled={pl.siteId !== null}
          label={plantTitle(pl, pl.siteId !== null)}
        />
      ))}
      <g className="map-labels" aria-hidden="true">
        {plants.map((pl) => {
          const r = markerRadius(pl.capacityMw, scale) * (pl.storage === ">5" ? 1.25 : 1);
          const x = p.x(pl.lon);
          const y = p.y(pl.lat);
          const at = DETAIL_LABELS[pl.key] ?? (x > p.width - 140 ? "left" : "right");
          const placed =
            at === "left"
              ? { x: x - r - 5, y: y + 4, anchor: "end" as const }
              : at === "above"
                ? { x, y: y - r - 6, anchor: "middle" as const }
                : at === "below"
                  ? { x, y: y + r + 14, anchor: "middle" as const }
                  : { x: x + r + 5, y: y + 4, anchor: "start" as const };
          return (
            <text
              key={pl.key}
              x={r1(placed.x)}
              y={r1(placed.y)}
              textAnchor={placed.anchor}
              className={own.has(pl.siteId ?? "") ? "map-label-own" : pl.siteId === null ? "map-label-other" : undefined}
            >
              {pl.key === "amaluza"
                ? "Amaluza y Molino"
                : pl.key === "delsitanisagua_powerhouse"
                  ? "casa de máquinas"
                  : pl.name.replace(/ \(.*\)$/, "")}
            </text>
          );
        })}
      </g>
      <g className="map-scale" aria-hidden="true">
        <line x1={p.width - 16 - barPx} x2={p.width - 16} y1={p.height - 18} y2={p.height - 18} />
        <line x1={p.width - 16 - barPx} x2={p.width - 16 - barPx} y1={p.height - 22} y2={p.height - 14} />
        <line x1={p.width - 16} x2={p.width - 16} y1={p.height - 22} y2={p.height - 14} />
        <text x={p.width - 16 - barPx / 2} y={p.height - 26} textAnchor="middle">
          {bar} km
        </text>
      </g>
    </svg>
  );
}

/** A thumbnail of Ecuador with the catchment map's frame on it. */
export function Locator({ site, data = mapData() }: { site: string; data?: MapData }) {
  const catchment = catchmentFor(site, data);
  if (data.basemap === null || catchment === null) return null;
  const p = project(ECUADOR, 150);
  const frame = fitBox(catchment.box, 1.25, 0.08);
  const ecuador = data.basemap.countries.find((c) => c.code === "ECU");
  if (!ecuador) return null;
  return (
    <svg className="map map-locator" viewBox={`0 0 ${p.width} ${p.height}`} aria-hidden="true">
      <path d={polygonPath(ecuador.geometry, p, 1)} fillRule="evenodd" className="map-land map-locator-land" />
      <rect
        x={r1(p.x(frame.west))}
        y={r1(p.y(frame.north))}
        width={r1(p.x(frame.east) - p.x(frame.west))}
        height={r1(p.y(frame.south) - p.y(frame.north))}
        className="map-locator-frame"
      />
    </svg>
  );
}

/** Where a coordinate came from, said in Spanish; the full citation is in `plant_locations.csv`. */
function sourceEs(source: string): string {
  if (source.startsWith("OSM")) return "de OpenStreetMap";
  if (source.startsWith("Wikidata")) return "de Wikidata";
  if (source.startsWith("INAMHI")) return "del visor de hidroeléctricas del INAMHI";
  if (source.startsWith("Global Energy Monitor")) return "de Global Energy Monitor";
  return "de las fuentes citadas en data/reference/plant_locations.csv";
}

/** The facts beside the catchment map, in words. */
export function WhereFacts({ site, label, data = mapData() }: { site: string; label: string; data?: MapData }): ReactNode {
  const catchment = catchmentFor(site, data);
  const plant = data.plants.find((pl) => pl.siteId === site) ?? null;
  if (catchment === null || plant === null) return null;
  const borrowed = CATCHMENT_OF[site] !== undefined;
  const osm = `https://www.openstreetmap.org/?mlat=${plant.lat.toFixed(5)}&mlon=${plant.lon.toFixed(5)}#map=14/${plant.lat.toFixed(5)}/${plant.lon.toFixed(5)}`;
  const powerhouse = site === "delsitanisagua" ? data.plants.find((pl) => pl.key === "delsitanisagua_powerhouse") : null;
  const iou = catchment.inamhiIou;
  return (
    <>
      <Table
        className="where-table"
        caption={`Dónde está ${label}`}
        captionHidden
        columns={[{ label: "Dato" }, { label: "Valor" }]}
        rows={[
          [
            plant.feature === "dam" ? "Presa" : "Central",
            <a key="osm" href={osm}>
              {latLonEs(plant.lat, plant.lon)}
            </a>,
          ],
          ...(powerhouse ? [["Casa de máquinas", latLonEs(powerhouse.lat, powerhouse.lon)]] : []),
          ["Río", `${plant.river}, vertiente ${SLOPE_ES[plant.slope]}`],
          [borrowed ? "Cuenca, hasta Amaluza" : "Cuenca sobre la presa", `${num(catchment.areaKm2, 0)} km²`],
          ...(catchment.meanElevM !== null ? [["Altura media de la cuenca", `${num(catchment.meanElevM, 0)} m`]] : []),
          ...(plant.capacityMw !== null
            ? [["Potencia", `${num(plant.capacityMw, 0)} MW${plant.inService ? `, desde ${plant.inService}` : ""}`]]
            : []),
        ]}
      />
      <p className="fine spaced">
        {borrowed
          ? `Sopladora no tiene cuenca propia: turbina el agua que sale de Molino, que es la del Paute hasta la presa de Amaluza, con Mazar dentro. `
          : ""}
        La cuenca es el área que drena hacia la presa, trazada aquí sobre el modelo de elevación Copernicus GLO-90.
        {iou !== null ? ` Coincide en un ${num(iou * 100, 0)} % con el polígono que publica el INAMHI para esta central.` : ""} La posición
        de la {plant.feature === "dam" ? "presa" : "central"} viene {sourceEs(plant.source)}.
      </p>
    </>
  );
}
