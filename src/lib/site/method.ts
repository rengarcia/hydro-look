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
    title: "`volutilalm` no es un volumen",
    body:
      "El servicio lo publica como «% de volumen útil», pero es exactamente (cota − mín) / (máx − mín), verificado " +
      "a diez decimales. Aquí se guarda como `nivel_pct_banda` y no debe leerse como agua almacenada.",
  },
  {
    title: "`repDiaNivQIng` responde con los números de ayer",
    body:
      "Si se le pide el día D, devuelve filas fechadas D con los valores de D−1, medido en 113 días consecutivos. " +
      "Sus filas se guardan bajo el día que describen, no bajo el que las etiqueta.",
  },
  {
    title: "El caudal del historiador es caudal de entrada",
    body:
      "`mridCaud` coincide con `q_ingresado` del reporte en 4281 días con r = 1,0000; el caudal turbinado, el otro " +
      "candidato, correlaciona a r = −0,06.",
  },
  {
    title: "La misma lectura de dos servicios se guarda dos veces",
    body:
      "Cuando dos servicios de CELEC publican el mismo día se conservan ambas filas con su fuente, para que los " +
      "desacuerdos sigan siendo visibles. Los modelos resuelven una sola serie por un orden de fuentes declarado.",
  },
  {
    title: "Los 2.115 m son un marcador de este proyecto",
    body:
      "Ninguna fuente publica ese nivel como crítico. Se pronostica porque el plan lo pide y se etiqueta como no " +
      "verificado en cada documento, para que nadie lo confunda con una declaración de CELEC.",
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
    [/^no ERA5 rows$/, () => "todavía no tiene filas de ERA5"],
    [/^ERA5 starts (\d{4}-\d{2}-\d{2}), not by/, (m) => `su ERA5 empieza el ${m[1]}, no en enero de 1990`],
    [
      /^([\d.]+)% of days since (\d{4})-\d{2}-\d{2}, under ([\d.]+)%$/,
      (m) => `tiene el ${m[1]!.replace(".", ",")} % de los días desde ${m[2]}, por debajo del ${m[3]} % exigido`,
    ],
    [
      /^newest ERA5 day (\d{4}-\d{2}-\d{2}) is more than (\d+) days behind/,
      (m) => `su día de ERA5 más reciente, el ${m[1]}, va más de ${m[2]} días por detrás`,
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
    const coverage = `${p.era5_days.toLocaleString("es-EC")} días de ERA5, el ${(p.share_since_1990 * 100).toLocaleString("es-EC", { maximumFractionDigits: 1 })} % desde 1990`;
    notes.push({
      title: `La lluvia se lee en \`${p.basin}\``,
      body: p.verified_centroid
        ? `El pronóstico de Mazar lee la lluvia ERA5 del centroide verificado de la cuenca sobre la presa (\`${p.basin}\`): ${coverage}.`
        : `El pronóstico de Mazar lee la lluvia ERA5 de \`${p.basin}\`, un punto provisional, no del centroide verificado de la ` +
          `cuenca sobre la presa: ${p.fallback_reason ? precipFallbackText(p.fallback_reason) : "no tiene cobertura suficiente"}. ` +
          `El cambio es automático en cuanto el centroide tenga historia desde 1990; hoy son ${coverage} en el punto provisional.`,
    });
  }
  const b = input.band_method;
  if (b) {
    const stretches = b.stretch_by_horizon.filter((s) => s.stretch !== null);
    const range =
      stretches.length > 0
        ? ` Hoy el ensanche va de ${Math.min(...stretches.map((s) => s.stretch!)).toLocaleString("es-EC")} a ` +
          `${Math.max(...stretches.map((s) => s.stretch!)).toLocaleString("es-EC")} veces según el horizonte.`
        : "";
    notes.push({
      title: "Cómo se calibra la banda de suficiencia",
      body: /stretched/.test(b.method)
        ? `La banda p10–p90 del requerimiento sale de los errores de todos los orígenes anteriores, ensanchada en cada ` +
          `horizonte por el menor factor con el que las bandas ya emitidas habrían cubierto el ` +
          `${Math.round(b.nominal_coverage * 100)} % nominal.${range}`
        : `La banda p10–p90 del requerimiento sale de los errores de los orígenes anteriores, sin ensanchar; su cobertura ` +
          `nominal es del ${Math.round(b.nominal_coverage * 100)} %.`,
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
