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

/** `a `b` c` -> `["a ", {code: "b"}, " c"]`: the only markup a note may carry. */
export function splitCode(text: string): (string | { code: string })[] {
  return text.split(/(`[^`]+`)/).filter((part) => part !== "").map((part) => (part.startsWith("`") ? { code: part.slice(1, -1) } : part));
}
