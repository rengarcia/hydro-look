# Narrative — offline evaluation

Generated 2026-09-23T05:52:30Z by `npm run narrative:eval` from the committed snapshots and payloads; no network. Replaying through the gateway is `npm run narrative:eval -- --replay --models <slug,slug>` with a key.

Every committed answer is revalidated against its own payload under **today's** validator, which since prompt es-5 also enforces 120–220 words, 3–5 drivers and, for structured drivers, that each driver's payload number exists, sits in the block its factor names and lies on the side of its reference the direction claims. 'OK then' is what the pipeline decided at the time; 'passes now' is the same text under the rules a new answer faces.

| Source | Model | Prompt | Attempts | Answered | OK then | Passes now (checked) | Mean words | Mean input tokens | Mean cost USD | Total USD |
|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| recorded | `anthropic/claude-opus-5` | es-1 | 1 | 0 | 0 | 0 (0) | — | — | — | 0.0000 |
| recorded | `xiaomi/mimo-v2.6-flash` | es-1 | 1 | 0 | 0 | 0 (0) | — | 4746 | — | 0.0000 |
| recorded | `xiaomi/mimo-v2.6-flash` | es-2 | 1 | 0 | 0 | 0 (0) | — | 4817 | — | 0.0000 |
| recorded | `xiaomi/mimo-v2.6-flash` | es-3 | 1 | 1 | 0 | 0 (1) | 178 | 4935 | 0.0009 | 0.0009 |
| recorded | `anthropic/claude-opus-5` | es-3 | 1 | 1 | 1 | 0 (1) | 189 | 6609 | 0.0559 | 0.0559 |
| recorded | `anthropic/claude-opus-5.5` | es-4 | 1 | 1 | 1 | 1 (1) | 194 | 6433 | 0.0393 | 0.0393 |

## Why each answer fails today's rules

- `2026-09-21-narrative-es-3-40c07781-022513` (xiaomi/mimo-v2.6-flash, es-3): outlook_es: number 21
- `2026-09-21-narrative-es-3-40c07781-023319` (anthropic/claude-opus-5, es-3): drivers: 6, outside 3–5

## The payload, before and after the trim

| Payload | Version | Hash | Characters | ≈ tokens |
|---|---:|---|---:|---:|
| committed narrative.json basis | 1 | `40c07781513c` | 9554 | 2389 |
| built today from the committed tables | 2 | `2c52888a7e55` | 6799 | 1700 |

The instructions add about 872 tokens. At two calls a day, caching the fixed part would save cents a month and add a moving part; it is not done. Tokens here are estimated at four characters each; the gateway's own count is what the snapshot rows record.

What would justify a cheaper model: a replay row with the same pass rate over these payloads at a lower mean cost. The one cheaper model tried so far (`xiaomi/mimo-v2.6-flash`, free tier) is in the table: it answered and was rejected every time.
