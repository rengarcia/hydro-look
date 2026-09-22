/**
 * XM (Colombia's market operator), servapibi API: the other side of the Ecuador–Colombia
 * interconnection, and the Colombian system state that decides whether it flows.
 *
 * Two findings from the recon run (35768453442, fixtures in tests/fixtures/xm/) shape this file:
 *
 * - **A blank exchange hour is flow in the other direction, not a missing reading.** XM
 *   publishes one net direction per hour and per link: on every link-day that appears in both
 *   `ExpoEner` and `ImpoEner`, no hour is published in both, and on ECUADOR 230 the two
 *   together cover the day. Zeros are never written. A link-day absent from both series is
 *   unpublished; a link-day present in either is complete, with its blank hours read as no flow
 *   that way. Summing only the published hours is therefore the day's total — the SMEC
 *   cross-check agrees at r = 0.9999 on net flow — and it is not the "partial sum of an
 *   incomplete day" it would be for, say, a price.
 * - **Daily and hourly answers are shaped differently.** Hourly entities wrap their values in
 *   `Values` with a `code` and `Hour01`..`Hour24`; daily entities carry a bare `Value`.
 *   `PorcVoluUtilDiar` and `PorcApor` are fractions (0.50353 is 50.4%), not percentages.
 */

import { z } from "zod";

/** The two Ecuador circuits as XM names them. ECUADOR 138 has only ever flowed export-wise. */
export const XM_LINKS = ["ECUADOR 230", "ECUADOR 138"] as const;
export type XmLink = (typeof XM_LINKS)[number];

/**
 * The Colombian system series kept beside the flows: what explains a cutoff before it shows
 * up at the border. `hourly` series are reduced to a daily mean, and only for a full day.
 */
export const XM_SYSTEM_METRICS = {
  PorcVoluUtilDiar: { endpoint: "daily", unit: "fraction" },
  VoluUtilDiarEner: { endpoint: "daily", unit: "kWh" },
  CapaUtilDiarEner: { endpoint: "daily", unit: "kWh" },
  AporEner: { endpoint: "daily", unit: "kWh" },
  AporEnerMediHist: { endpoint: "daily", unit: "kWh" },
  PorcApor: { endpoint: "daily", unit: "fraction" },
  DemaSIN: { endpoint: "daily", unit: "kWh" },
  PrecEscaAct: { endpoint: "daily", unit: "COP/kWh" },
  PrecBolsNaci: { endpoint: "hourly", unit: "COP/kWh" },
} as const;
export type XmSystemMetric = keyof typeof XM_SYSTEM_METRICS;
export type XmUnit = (typeof XM_SYSTEM_METRICS)[XmSystemMetric]["unit"];

const date = z.string().date();
const hourKeys = Array.from({ length: 24 }, (_, i) => `Hour${String(i + 1).padStart(2, "0")}`);

const hourlyResponse = z.object({
  Items: z.array(
    z.object({
      Date: date,
      HourlyEntities: z.array(
        z.object({
          Id: z.string(),
          Values: z.object({ code: z.string() }).catchall(z.string()),
        }),
      ),
    }),
  ),
});

const dailyResponse = z.object({
  Items: z.array(
    z.object({
      Date: date,
      DailyEntities: z.array(z.object({ Id: z.string(), Value: z.string() })),
    }),
  ),
});

/** `""` is an hour XM did not publish; anything else must be a number. */
function reading(raw: string | undefined, where: string): number | null {
  if (raw === undefined || raw === "") return null;
  const value = Number(raw);
  if (!Number.isFinite(value)) throw new Error(`xm: ${where} is not a number: ${JSON.stringify(raw)}`);
  return value;
}

export interface XmHourlyDay {
  date: string;
  code: string;
  hours: (number | null)[];
}

/** One entry per date and entity code; a code repeated on one date is drift and refused. */
export function parseXmHourly(body: string): XmHourlyDay[] {
  const { Items } = hourlyResponse.parse(JSON.parse(body));
  const seen = new Set<string>();
  const out: XmHourlyDay[] = [];
  for (const item of Items) {
    for (const entity of item.HourlyEntities) {
      const code = entity.Values.code;
      const key = `${item.Date}|${code}`;
      if (seen.has(key)) throw new Error(`xm: ${key} appears twice in one answer`);
      seen.add(key);
      out.push({
        date: item.Date,
        code,
        hours: hourKeys.map((hour) => reading(entity.Values[hour], `${key} ${hour}`)),
      });
    }
  }
  return out.sort((a, b) => (a.date === b.date ? a.code.localeCompare(b.code) : a.date < b.date ? -1 : 1));
}

/** Daily `Sistema` values. A date answered twice, or an entity other than Sistema, is drift. */
export function parseXmDaily(body: string): { date: string; value: number }[] {
  const { Items } = dailyResponse.parse(JSON.parse(body));
  const out = new Map<string, number>();
  for (const item of Items) {
    for (const entity of item.DailyEntities) {
      if (entity.Id !== "Sistema") throw new Error(`xm: unexpected daily entity ${entity.Id} on ${item.Date}`);
      if (out.has(item.Date)) throw new Error(`xm: ${item.Date} appears twice in one answer`);
      const value = reading(entity.Value, `${item.Date} Value`);
      if (value !== null) out.set(item.Date, value);
    }
  }
  return [...out].sort(([a], [b]) => (a < b ? -1 : 1)).map(([d, value]) => ({ date: d, value }));
}

export interface XmExchangeDay {
  date: string;
  link: XmLink;
  /** Colombia → Ecuador. */
  export_kwh: number;
  /** Ecuador → Colombia. */
  import_kwh: number;
  export_hours: number;
  import_hours: number;
}

/**
 * Joins one window's export and import answers into one row per link-day. Both answers must
 * be for the same window: a day present in one and absent from the other is a day of one-way
 * flow, which is only true if the other answer was actually received.
 */
export function combineExchange(
  exports: readonly XmHourlyDay[],
  imports: readonly XmHourlyDay[],
  notes: string[] = [],
): XmExchangeDay[] {
  const rows = new Map<string, XmExchangeDay>();
  const known = new Set<string>(XM_LINKS);
  const add = (day: XmHourlyDay, direction: "export" | "import") => {
    if (!known.has(day.code)) {
      notes.push(`xm: link ${day.code} on ${day.date} is not an Ecuador circuit; not stored`);
      return;
    }
    const key = `${day.date}|${day.code}`;
    const row = rows.get(key) ?? {
      date: day.date,
      link: day.code as XmLink,
      export_kwh: 0,
      import_kwh: 0,
      export_hours: 0,
      import_hours: 0,
    };
    const published = day.hours.filter((h): h is number => h !== null);
    if (published.some((h) => h < 0)) throw new Error(`xm: negative ${direction} on ${key}`);
    row[`${direction}_kwh`] += published.reduce((a, b) => a + b, 0);
    row[`${direction}_hours`] += published.length;
    rows.set(key, row);
  };
  for (const day of exports) add(day, "export");
  for (const day of imports) add(day, "import");

  // The one-direction-per-hour reading is what makes the sums totals. Check it on every day
  // rather than trusting the recon: an hour published both ways would mean the rule is wrong.
  // Only on the Ecuador circuits: the Venezuela link (CUATRICENTENARIO 1) does publish both
  // ways within an hour in 2016–2018, and it is neither stored nor what the rule is about —
  // checking it rejected twenty months of Ecuador data in the first backfill.
  const hoursByKey = new Map<string, { export?: (number | null)[]; import?: (number | null)[] }>();
  for (const day of exports) {
    if (known.has(day.code)) hoursByKey.set(`${day.date}|${day.code}`, { export: day.hours });
  }
  for (const day of imports) {
    if (!known.has(day.code)) continue;
    const key = `${day.date}|${day.code}`;
    hoursByKey.set(key, { ...hoursByKey.get(key), import: day.hours });
  }
  for (const [key, both] of hoursByKey) {
    if (!both.export || !both.import) continue;
    const overlap = both.export.filter((h, i) => h !== null && both.import![i] !== null).length;
    if (overlap > 0) throw new Error(`xm: ${key} publishes ${overlap} hour(s) in both directions`);
  }
  return [...rows.values()].sort((a, b) => (a.date === b.date ? a.link.localeCompare(b.link) : a.date < b.date ? -1 : 1));
}

/** Daily mean of an hourly series, only for days with all 24 hours published. */
export function dailyMeanOfFullDays(days: readonly XmHourlyDay[], notes: string[] = []): { date: string; value: number }[] {
  const out: { date: string; value: number }[] = [];
  for (const day of days) {
    const published = day.hours.filter((h): h is number => h !== null);
    if (published.length !== 24) {
      notes.push(`xm: ${day.code} ${day.date} has ${published.length}/24 hours; no daily mean stored`);
      continue;
    }
    out.push({ date: day.date, value: published.reduce((a, b) => a + b, 0) / 24 });
  }
  return out;
}
