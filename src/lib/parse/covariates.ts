import { z } from "zod";
import { addDays } from "../util/dates.ts";

const date = z.string().date();
const temperature = z.number().finite().min(-90).max(60).nullable();
const weatherResponse = z.object({
  timezone: z.literal("America/Guayaquil"),
  utc_offset_seconds: z.literal(-18000),
  daily_units: z.object({
    time: z.literal("iso8601"),
    precipitation_sum: z.literal("mm"),
    temperature_2m_mean: z.literal("°C").optional(),
  }),
  daily: z.object({
    time: z.array(date).min(1),
    precipitation_sum: z.array(z.number().finite().nonnegative().nullable()),
    temperature_2m_mean: z.array(temperature).optional(),
  }),
});

/** Missing upstream values remain null; a dry day is explicitly zero. */
export function parseWeather(body: string, requireTemperature = true) {
  const { daily, daily_units: units } = weatherResponse.parse(JSON.parse(body));
  if (
    daily.precipitation_sum.length !== daily.time.length ||
    (daily.temperature_2m_mean && daily.temperature_2m_mean.length !== daily.time.length)
  ) {
    throw new Error("weather: daily arrays have different lengths");
  }
  if ((requireTemperature || daily.temperature_2m_mean) && (!daily.temperature_2m_mean || units.temperature_2m_mean !== "°C")) {
    throw new Error("weather: missing temperature values or units");
  }
  return daily.time.map((date, i) => {
    if (i > 0 && date !== addDays(daily.time[i - 1]!, 1)) {
      throw new Error("weather: dates must be consecutive and unique");
    }
    return {
      date,
      precip_mm: daily.precipitation_sum[i]!,
      temp_mean_c: daily.temperature_2m_mean?.[i] ?? null,
    };
  });
}

/** PSL labels the three-month ONI mean by its centre month (January = DJF). */
export function parseOni(body: string): { month: string; oni: number }[] {
  const lines = body
    .trim()
    .split(/\r?\n/)
    .map((line) => line.trim());
  const header = /^(\d{4})\s+(\d{4})$/.exec(lines[0] ?? "");
  if (!header) throw new Error("ONI: expected first/last year header");
  const first = Number(header[1]);
  const last = Number(header[2]);
  if (first < 1900 || last < first || last > 2200) throw new Error("ONI: invalid year range");
  const sentinel = Number(lines[last - first + 2]);
  if (!Number.isFinite(sentinel) || sentinel >= -10) throw new Error("ONI: missing sentinel");
  const rows: { month: string; oni: number }[] = [];
  for (let year = first; year <= last; year++) {
    const fields = lines[year - first + 1]?.split(/\s+/) ?? [];
    if (fields.length !== 13 || fields[0] !== String(year)) throw new Error(`ONI: malformed year ${year}`);
    for (let month = 1; month <= 12; month++) {
      const value = Number(fields[month]);
      if (value === sentinel) continue;
      if (!Number.isFinite(value) || Math.abs(value) > 5) throw new Error(`ONI: invalid value in ${year}-${month}`);
      rows.push({ month: `${year}-${String(month).padStart(2, "0")}`, oni: value });
    }
  }
  if (!rows.length) throw new Error("ONI: no observations");
  return rows;
}
