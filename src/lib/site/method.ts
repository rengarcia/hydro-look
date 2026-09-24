/**
 * The standing method notes: facts about the sources that hold whatever the day's numbers are.
 *
 * They are data rather than markup so a note can be added or corrected without reading a
 * component, and so the documentation page can list them beside the fields they qualify. Text in
 * backticks is set as code; nothing else is interpreted. Each note cites the measurement that
 * established it — the README carries the long form.
 */

export interface MethodNote {
  title: string;
  body: string;
}

export const METHOD_NOTES: readonly MethodNote[] = [
  {
    title: "El «% de volumen útil» de CELEC no es volumen",
    body:
      "CELEC publica un porcentaje llamado «volumen útil» (`volutilalm`), pero en realidad mide la altura del agua dentro " +
      "de su rango de operación: (nivel − mínimo) / (máximo − mínimo). No dice cuánta agua hay guardada. Aquí se guarda " +
      "como `nivel_pct_banda`.",
  },
  {
    title: "Un reporte de CELEC trae los datos del día anterior",
    body:
      "Si al reporte `repDiaNivQIng` se le piden los datos de un día, entrega los del día anterior con la fecha cambiada; " +
      "lo comprobamos en 113 días seguidos. Por eso cada dato se guarda con el día al que de verdad corresponde.",
  },
  {
    title: "El caudal es el agua que entra al embalse",
    body:
      "Comprobamos en 4.281 días que el caudal del servicio histórico de CELEC (`mridCaud`) es el agua que llega al " +
      "embalse, y no la que pasa por las turbinas.",
  },
  {
    title: "Si dos fuentes dan el mismo dato, se guardan las dos",
    body:
      "Cuando dos servicios de CELEC publican el mismo día, conservamos ambos, cada uno con su fuente, para que se vea si no " +
      "coinciden. Los modelos usan uno solo, según un orden de preferencia fijo.",
  },
  {
    title: "Los 2.115 m son una referencia de este sitio",
    body:
      "Ninguna fuente oficial dice que ese nivel sea crítico. Es una referencia que eligió este proyecto (Mazar bajó de " +
      "él durante la crisis de 2024), y se marca como no oficial en todas partes para que nadie la confunda con una cifra de CELEC.",
  },
];

/**
 * Why the verified centroid was not used, in Spanish, from the reasons `features/weather.ts`
 * writes in English. A reason this does not recognise is quoted as it is, as code.
 */
export function precipFallbackText(reason: string): string {
  const match = /^([a-z0-9_]+): (.*)$/.exec(reason);
  const basin = match ? match[1]! : null;
  const why = match ? match[2]! : reason;
  const rules: [RegExp, (m: RegExpExecArray) => string][] = [
    [/^no ERA5 rows$/, () => "todavía no tiene datos de lluvia"],
    [/^ERA5 starts (\d{4}-\d{2}-\d{2}), not by/, (m) => `sus datos de lluvia empiezan el ${m[1]}, no en enero de 1990`],
    [
      /^([\d.]+)% of days since (\d{4})-\d{2}-\d{2}, under ([\d.]+)%$/,
      (m) => `tiene el ${m[1]!.replace(".", ",")} % de los días desde ${m[2]}, por debajo del ${m[3]} % exigido`,
    ],
    [
      /^newest ERA5 day (\d{4}-\d{2}-\d{2}) is more than (\d+) days behind/,
      (m) => `su dato de lluvia más reciente, del ${m[1]}, tiene más de ${m[2]} días de atraso`,
    ],
  ];
  for (const [pattern, say] of rules) {
    const m = pattern.exec(why);
    if (m) return basin ? `\`${basin}\` ${say(m)}` : say(m);
  }
  return `\`${reason}\``;
}

/**
 * The notes that depend on what the day's documents say about their own method: which basin the
 * rain is read from (and why), and how the adequacy band is calibrated. Each is omitted when its
 * block is — a document written before the block existed has nothing to say about it.
 */
export function modelNotes(input: {
  precipitation_basin?: {
    basin: string;
    verified_centroid: boolean;
    era5_days: number;
    share_since_1990: number;
    fallback_reason: string | null;
  } | null;
  band_method?: { method: string; nominal_coverage: number; stretch_by_horizon: { horizon_days: number; stretch: number | null }[] } | null;
}): MethodNote[] {
  const notes: MethodNote[] = [];
  const p = input.precipitation_basin;
  if (p) {
    const coverage = `${p.era5_days.toLocaleString("es-EC")} días de datos, el ${(p.share_since_1990 * 100).toLocaleString("es-EC", { maximumFractionDigits: 1 })} % desde 1990`;
    notes.push({
      title: `Dónde se mide la lluvia: \`${p.basin}\``,
      body: p.verified_centroid
        ? `El pronóstico de Mazar usa la lluvia (del registro climático ERA5) en un punto en el centro de la cuenca que ` +
          `alimenta la presa (\`${p.basin}\`): ${coverage}. Es un solo punto, no un promedio de toda la cuenca.`
        : `El pronóstico de Mazar usa la lluvia (del registro climático ERA5) en \`${p.basin}\`, un punto provisional, y ` +
          `no en el centro de la cuenca que alimenta la presa: ` +
          `${p.fallback_reason ? precipFallbackText(p.fallback_reason) : "todavía no hay datos suficientes allí"}. ` +
          `Cambiará solo en cuanto ese punto tenga datos desde 1990; hoy hay ${coverage} en el punto provisional.`,
    });
  }
  const b = input.band_method;
  if (b) {
    const stretches = b.stretch_by_horizon.filter((s) => s.stretch !== null);
    const range =
      stretches.length > 0
        ? ` Hoy se ensancha entre ${Math.min(...stretches.map((s) => s.stretch!)).toLocaleString("es-EC")} y ` +
          `${Math.max(...stretches.map((s) => s.stretch!)).toLocaleString("es-EC")} veces, según el plazo.`
        : "";
    notes.push({
      title: "Cómo se calcula el rango de la cuenta de energía",
      body: /stretched/.test(b.method)
        ? `El rango probable de la energía que hace falta sale de cuánto se equivocó la cuenta en el pasado. Se ensancha lo ` +
          `justo para que, en las pruebas, hubiera acertado el ${Math.round(b.nominal_coverage * 100)} % de las veces.${range}`
        : `El rango probable de la energía que hace falta sale de cuánto se equivocó la cuenta en el pasado, sin ajustes; ` +
          `debería acertar el ${Math.round(b.nominal_coverage * 100)} % de las veces.`,
    });
  }
  return notes;
}

/** `a `b` c` ->`["a ", {code: "b"}, " c"]`: the only markup a note may carry. */
export function splitCode(text: string): (string | { code: string })[] {
  return text
    .split(/(`[^`]+`)/)
    .filter((part) => part !== "")
    .map((part) => (part.startsWith("`") ? { code: part.slice(1, -1) } : part));
}
