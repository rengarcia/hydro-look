# hydro-look — narrative and Paute cascade improvement plan

**Written 2026-10-15** against `main` at 5fcd449b, from a review of the 2026-10-14 narrative
(prompt `es-9+paute_mazar`) and of the Paute cascade in `data/curated`. Like `ENHANCEMENTS.md`,
each item states the evidence it rests on, so an item whose evidence goes stale can be dropped
without argument. Effort is in coding sessions (S = under one session, M = one to two, L = three
or more).

The state it starts from: 42 snapshot rows (37 `ok`, 4 `rejected`, 1 `failed`); every `ok`
answer since `es-6` passes the validator, so the problems below are ones the validator does not
see. Two kinds of problem:

- **The prose:** the answer passes every check and still misleads, mostly because of three
  sentences the prompt gives it.
- **The content:** the payload already contains the most decision-relevant fact (how often and
  how soon Mazar crosses 2,115 m), but the prompt never asks for it. It also contains nothing
  about the cascade that crossing 2,115 m shuts down.

---

## Implementation status (2026-10-15)

Phase A (items 1–5) is implemented on branch `claude/funny-planck-c22bp0`. Tests 795, all green,
with typecheck, lint, Prettier, coverage, `npm run check` and `npm run narrative -- --dry-run`.

| § | State | Notes |
|---|---|---|
| 1.1 Prompt errors | done | `es-10`: no "principal embalse del país"; the rain clause is about the forecast ("según el pronóstico para un solo punto…"); quote the longest skilled horizon and say nothing about a shorter one |
| 1.2 Cause and filler | done | "por eso" removed from the connectors; causal connectors only where the payload states a cause; a measure starts with its own date; no tier definition beside the margin; El Niño inside the weather sentences |
| 1.3 Targets | done, with one correction | 150–190 words, sentences 12–25 (one may reach 30). The figure cap is **8, not 7**: a hand-written answer for 2026-10-14 needed eight once the crossing sentence was in |
| 1.4 Headline | done | Starts from the day's change; no description of Mazar in it |
| 2.1 Crossings | done (prompt) | Required when `years_that_cross ≥ analogue_years / 2` for 2115 m; the soft check that it appeared is §3.2 |
| 3.1 Hard checks | done | `unskilledQuotes`, `unskilledRef`, `bannedPhrases` in `validate.ts`, with tests, including the published 2026-10-14 document as a fixture: its es-9 answer is now refused for the banned phrase and nothing else, and the hand-written es-10 answer passes at 187 words |
| 3.3 Replay | **not run** | Needs the AI Gateway key, which this environment does not have. Run `npm run narrative:eval -- --replay --models anthropic/claude-opus-5.5` before merging, or watch the first scheduled answers: a rejected day keeps the previous narrative on the site |
| 1.4–3.1 side effect | expected | `narrative:eval`'s "passes now" column will show earlier answers failing on the banned phrase, and the 2026-09-21 answers on unskilled levels. The validator tests now read a fixture copy with skill raised, and the canned answers no longer quote levels at horizons without skill |

---

## 0. Ranked summary

| # | Item | Why now | Effort |
|---|---|---|---|
| 1 | Remove the three errors the prompt writes into the text (§1.1) | They are in every answer, and one of them is a false fact in the headline | S |
| 2 | Say how often and how soon Mazar crosses 2,115 m (§2.1) | The numbers are in the payload already; the text quotes only the reassuring P50 | S |
| 3 | No cause-and-effect the payload does not state (§1.2) | "Por eso" ties the industrial cuts to this site's model | S |
| 4 | A target the model can meet (§1.3) | 4 of 33 answers since `es-6` met the 180-word target; the six-figure cap is below the seven facts the shape requires | S |
| 5 | Reject a forecast level quoted at a horizon without skill (§3.1) | Today only the prompt prevents it; it is a deterministic check | S |
| 6 | Prose metrics in `narrative:eval`, replay before every prompt bump (§3.2, §3.3) | `es-9` traded short sentences for 33–38-word ones, and nothing measured it | M |
| 7 | A `cascade` block in the payload (§2.2) | Crossing 2,115 m cost Molino and Sopladora about 15–20 GWh/day in 2024, and the text never says so | M |
| 8 | Stop calling Amaluza's inflow "above normal" (§2.3) | It is Mazar's release passing through, not rain | S |
| 9 | Name the scenarios by the weeks that matter (§4.1) | "Wet" crosses first (16 days) and "dry" last (76) | S |
| 10 | Decide which Amaluza floor is operational (§4.3) | The payload reports Amaluza 2.11 m *below* a floor CELEC publishes in only one place | S |
| 11 | Cascade energy figures on the reservoir pages (§4.2) | The panel shows storage in days of flow; the stake is in GWh | M |

Items 1–5 are one prompt bump (`es-10`) and one validator change, and can ship together.
Items 7 and 8 are `PAYLOAD_VERSION` 4 with `es-11`.

---

## 1. The prompt (`es-10`)

### 1.1 Three errors the prompt puts in the text

| Prompt line | What it makes the model write | Evidence | Change |
|---|---|---|---|
| `prompt.ts:165` "Mazar, the country's main reservoir" | "Mazar, el principal embalse del país" in 32 of 33 answers since `es-6` | Daule-Peripa stores 5,400 hm³ against Mazar's 410 (`data/reference/plants.csv`) | "Mazar, el embalse que regula el complejo Paute", used once and not necessarily in the headline |
| `prompt.ts:60` "…más lluvia de lo normal, en un solo punto del centro de la cuenca" | "se pronostica más lluvia de lo habitual en un solo punto del centro de la cuenca", which reads as rain falling on one spot | `es-8` answers, written under the provisional wording, said "medida en un solo punto" | "…según el pronóstico para un solo punto del centro de la cuenca" |
| `prompt.ts:123` "más allá de N días, el pronóstico no acierta…" | 2026-10-14: quotes the 30-day level, then "aunque a 14 días el pronóstico no acierta…" | Skill on 2026-10-14 is 0.067 / 0.021 / 0.148 at 7 / 14 / 30 days, so it does not decay with distance. The rule assumes it does | Quote the qualifying horizons and stay silent on the others. A caveat may name only a horizon *after* the last one quoted |

### 1.2 Cause and effect, and filler

- `prompt.ts:81` lists "por eso" among the connectors to use. On 2026-10-14 that produced "faltaría
  cerca del 5,5 %… Por eso, desde el 22 de septiembre de 2026, las grandes industrias se
  desconectan…". This states that the cuts follow from the site's indicator. The measure is a
  government decision, and the 5.5 % comes from this project's model.
  **Change:** drop "por eso" from the list, and add a rule: a measure in force is introduced with
  its own date ("Desde el 22 de septiembre de 2026, …"), never as a consequence of another
  sentence.
- "…y eso significa bastante energía" is the tier definition (`deficit = faltaría bastante
  energía`) appended after the margin already gave the size. **Change:** when `margin_pct` is
  quoted, it *is* the explanation, and the definition word is not added.
- The ending: "Además, El Niño sigue activo…" ends on the dangling fact the prompt forbids. **Change:**
  El Niño goes inside the weather sentences, which close the paragraph on a complete thought.

### 1.3 A target the model can meet

| Measure | Prompt asks | Delivered since `es-6` (33 `ok` answers) |
|---|---|---|
| Words | 130–180, "never more than 200" | 176–215; 4 of 33 at 180 or fewer; 2026-10-14 is 201 |
| Figures (dates excluded) | at most 6 | 5–12; `es-9`: 6, 7, 8 |
| Sentence length | 10–25 words | `es-7` ≤ 23; `es-9` up to 33–38 |

The shape in "Shape of outlook_es" requires at least seven figures: level, distance, minimum,
forecast level, slope, gap, and the gap's horizon. A six-figure cap cannot be met, so the model
ignores it. **Change:** ask for 150–190 words; at most 8 figures (seven, plus the crossing count
from §2.1), with plazos ("a 14 días") counted as dates; sentences of 12–25 words, with at most one
longer. Keep the validator's
120–220 band as it is, and measure the soft targets in §3.2 instead of rejecting on them.

### 1.4 The headline

All 33 headlines since `es-6` open with the same four words. The rule "A headline that could run
unchanged every day is not one" is honoured in the clause after the epithet. **Change:** the
headline starts from the change ("Mazar bajó 0,8 m por día esta semana…"), and the epithet, if
used at all, moves to the body.

---

## 2. What the text should say

### 2.1 The crossing distribution (prompt only; the data is in payload v3)

`mazar_forecast.crossings[0]` on 2026-10-14: 10 of 15 analogue years cross 2,115 m, with a median
of 30 days and a p10 of 13. The 30-day p10 level is 2,105 m. The text quoted only the 30-day P50,
2,117.15 m, which reads as "stays above the minimum".

**Change:** when `years_that_cross / analogue_years ≥ 0.5`, the Mazar part must give that count
and the median ("en 10 de cada 15 años parecidos al actual, Mazar baja del mínimo de operación, la
mitad de ellos en unos 30 días"). Below 0.5, it may. Both numbers are payload figures, so the
existing figure check covers the sentence. A soft check in §3.2 reports whether it appeared.

### 2.2 A `cascade` block (`PAYLOAD_VERSION` 4)

Today the payload has Amaluza's level, slope, nearest floor and inflow percentile, and Sopladora's
chamber level. It has nothing that says why Mazar's floor matters beyond its own 170 MW. Proposed
block, every number computed in code and tested:

| Field | 2026-10-14 (from the review; to be recomputed in code) | Source |
|---|---|---|
| `amaluza.level_rank_in_record` | 2nd lowest of 4,408 days (1,971.89 m on 2026-10-13; lowest 1,971.65 m on 2024-04-15, the day before Mazar left service) | `observations_daily` |
| `mazar_release_7d_m3s` vs `mazar_inflow_7d_m3s` | ~57 vs 26 | Mazar `produccion_mwh` × `turbine_m3s_per_mw` from `forecast.json` |
| `downstream_gwh_7d` vs its climatology | Molino + Sopladora, 7-day mean | `produccion_mwh` |
| `cascade_gwh_per_hm3` | ~2.8 (Mazar ~1.2, Molino ~5.7, Sopladora ~3.25 MW per m³/s) | ratio of sums over the 137 days with `q_turbinado_m3s` |
| `storage_above_operational_min_gwh` | 62.4 hm³ × 2.8 ≈ 175 GWh | `forecast.json` `storage_above_lowest_threshold_hm3` |
| `reference_episode` | 2024-10/11, Mazar 2,111–2,116 m: Molino 15–18 → 1.3–8.5 GWh/day, Sopladora 8–9 → 0.7–4.4 | a fixed reference row, like `rationing_episodes.csv` |

Prompt (`es-11`): one sentence in the Mazar part on what the operational minimum means for the
complex, from `reference_episode`, and a new driver factor `cascade` (`drivers.ts`
`FACTOR_ROOTS`). The token cost is about 300 more input tokens, under a cent a day at the current
$0.06.

Caveat to carry into the code: `q_turbinado_m3s` is a midnight snapshot (README, "`repDiaNivQIng`
answers with the previous day's numbers"), so the per-plant factors come from ratios of sums over
many days, not from daily values.

### 2.3 Amaluza's inflow percentile

Amaluza's inflow is mostly Mazar's release. Over 4,001 days, each m³/s Mazar releases appears at
Amaluza at 1.03 m³/s. On the 257 days Mazar did not generate, Amaluza's inflow had a median of
43 m³/s. On 2026-10-14 the payload gives Amaluza's inflow at the 69th percentile while Mazar's own
is at the 10th. A reader, or the model, takes that as rain.

**Change:** remove `percentile_today` from Amaluza's block, or replace it with the local inflow
(Amaluza inflow − Mazar release, 7-day means). In the last week that is ~44 m³/s against an
October median of ~47, which is itself worth knowing: the drought is concentrated above Mazar.

---

## 3. Validator and evaluation

### 3.1 New hard checks (deterministic, low rejection risk)

- **Skill-gated levels.** Reject an outlook that quotes a `mazar_forecast.horizons[*].p50` (or
  p10 / p90) whose `skill_vs_persistence` is below 0.05. The validator note admits it cannot tell
  "a true number attached to the wrong thing". This narrows that gap for the one case the prompt
  already forbids.
- **Banned phrases.** A short list in `validate.ts` (`principal embalse del país`), so a phrase
  removed from the prompt cannot come back from the model's habits.

Both come with fixtures in `tests/narrative.test.ts` taken from real snapshot rows.

### 3.2 Soft metrics (`npm run narrative:eval` and `status.json`)

Per answer: words, figures, longest sentence and count over 25, whether the headline's first
five words match the previous day's, the share of sentences starting with the same word, whether
the last sentence is ENSO-only, and whether the crossing count (§2.1) appears. These are reported
but do not reject. A metric is promoted to a hard rule only after a 14-day replay shows ≥ 95 % of
answers already pass it, so a stricter rule never costs a day's narrative unannounced.

### 3.3 Replay before every prompt bump

`npm run narrative:eval -- --replay` over the last 14 committed payloads, with the old and new
prompts side by side, recorded in `data/reports/narrative.md`. It costs about $1.70 for 28 calls.
**Acceptance for `es-10`:** 14 of 14 pass the validator; median words 150–190; median figures
≤ 8; no sentence over 30 words; no banned phrase; the crossing count present on every day it is
required.

---

## 4. Models and site

### 4.1 Scenario names

`inflowScenarios` (`water-balance.ts:552`) ranks analogue years by inflow over the whole 365-day
window. On 2026-10-14, "wet" (2010) crosses 2,115 m in 16 days and "dry" (2022) in 76, because
2010's first weeks were dry and its rain came later. The scenarios feed `days_to_threshold`, the
payload's `crossing_scenarios`, and the page.
**Change:** rank by inflow over the first 60 days (the crossing-relevant window), keep the
365-day run, and state the window in `days_to_threshold.note`. The P50 and the backtest do not
use these scenarios (the crisis check reads the full distribution), so no backtest number moves.

### 4.2 Cascade panel

`PauteCascade.tsx` shows Mazar's 410 hm³ and "~39 días de caudal medio". Add the energy reading
(GWh per hm³ through the cascade, and storage above 2,115 m in GWh) from the same functions as
§2.2, and Amaluza's place in its record. The aim is one sentence a reader can carry: "lo que queda
en Mazar sobre su mínimo vale unos 175 GWh en las tres centrales".

### 4.3 Amaluza's floor

CELEC publishes three floors for Amaluza: 1,960 m (`repDiaHid12m`), 1,970 m (`repDiaVolAlm`) and
1,975 m (dashboard chart title only, observed one day). `floorsFor` takes the nearest, so the
payload reports Amaluza at −2.11 m and 0 days to the floor, which reads as a breach. Mazar's 2,115 m
was resolved with press evidence in `thresholds.csv`; Amaluza needs the same row, or the
payload should prefer the report-endpoint floor until one is found.

---

## 5. Order of work

| Phase | Items | Ships as | Acceptance |
|---|---|---|---|
| A | §1.1–1.4, §2.1, §3.1 | `es-10`, validator change | §3.3 replay criteria; one week of `ok` daily answers |
| B | §3.2, §3.3 tooling | `narrative:eval` columns | metrics in `data/reports/narrative.md` for every answer since `es-6` |
| C | §2.2, §2.3, §4.3 | `PAYLOAD_VERSION` 4, `es-11` | payload tests from fixtures; a 14-day replay meeting the `es-10` criteria, plus the cascade sentence present |
| D | §4.1, §4.2 | forecast note, site | `forecast.json` schema unchanged, or bumped with the contract; the page builds with no JavaScript |

## 6. What this plan does not do

- It does not let the model compute anything. Every new number is computed in code and checked by
  the existing figure scan.
- It does not tighten a hard rule without a replay (§3.2), because a rejected answer means the
  site shows yesterday's text.
- It does not have the text predict power cuts. The cascade sentence describes 2024 as a recorded
  episode, the way `measures_in_force` describes today.
