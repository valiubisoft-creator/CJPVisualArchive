# Taxonomy — how we categorize clips (v2)

A **faceted** controlled-vocabulary taxonomy: orthogonal axes rather than one flat tag list, so we get clean cross-tabs (Action×Actors, Issue×Geo, …) and stable, countable categories. Backbone from **ACLED** (event/actor/geo), multi-select spirit from **Mnemonic/Syrian Archive**, ethics/handling layer from **WITNESS**.

- **Machine source of truth:** [`src/lib/data/vocab.json`](../src/lib/data/vocab.json) — the enums. `validate.mjs` checks every facet value against it; `tag-suggest.mjs` constrains the LLM to it.
- **Why faceted beats flat:** a flat list conflates *what happened / who / why / where / how filmed* into one namespace (synonymy, polysemy) and can't be cross-tabbed. Facets keep each axis independent, low-cardinality, and countable.

## The 8 facets

| # | Facet | Card. | Source | Notes |
|---|---|---|---|---|
| F1 | **Action / event** | 1 primary | ACLED sub-event | peaceful_protest → protest_with_intervention → excessive_force is an **escalation ladder** (a repression index over time/region) |
| F2 | **Actors present** | multi | ACLED interaction codes | **role/type only — never a named individual** (DPDPA + WITNESS) |
| F3 | **Issue / theme** | multi | CJP manifesto | CJP-specific (below) |
| F4 | **Setting** | 1 primary | ACLED location | street / square (Jantar Mantar) / outside-Sansad / campus / stage / … |
| F5 | **Media format** + **content warnings** | multi | Mnemonic content-type | livestream/edited/raw/… + graphic/injury/death/minors |
| F6 | **Provenance / verification** | structured | WITNESS chain-of-custody | `source_type` + `verification_status` (from v1) + geo/date confidence |
| F7 | **Geo & time** | structured | ACLED columns | `event_date`, admin1/2, lat/lon, `geo_precision` (in the record's `geo` object) |
| F8 | **Sensitivity / handling** | multi flags | WITNESS security | gate **access & handling**, never used as a search filter |

## F3 — CJP issues (from the movement's own manifesto, 15 Jul 2026)

These replace generic protest vocab (labor/farmers/citizenship/caste — a *different* movement). Each issue is a **`demand`** (what the movement protests *for*) except one **`reactive`** grievance (done *to* the movement) — kept distinct because it reads differently in analysis:

- `exam_education_integrity` — trigger: leaked NEET paper → mass retake *(demand)*
- `youth_unemployment` — core self-branding, "Voice of the Lazy & Unemployed" *(demand)*
- `judicial_accountability` — CJI-remark origin; post-retirement Rajya Sabha seats *(demand)*
- `electoral_integrity` — vote-deletion / Election Commission *(demand)*
- `gender_representation` — 50% women reservation in Parliament & Cabinet *(demand)*
- `media_ownership` — Ambani/Adani-owned media licenses *(demand)*
- `anti_defection_reform` — 20-year bar for party-switchers *(demand)*
- `police_conduct_civil_liberties` — emerged during the 20 Jul crackdown *(**reactive** — done to the movement, not an original demand)*
- `other_specify`

## Ethics rules (enforced in tagging)

- **No auto-publish** — every tag is a *proposal* until a human accepts it.
- **No categorizing by identifiable individual** — actors are role/type only.
- **No sensitive-attribute inference** — the model never derives religion/caste/ethnicity/etc.; themes describe the *cause*, not a person.
- **Over-flag** graphic content & identity-protection.
- **Hindi/English code-mixing** is first-class (dharna, roko, lathi-charge, Chalo Sansad) — not "other".

## Tagging workflow (LLM first pass → human confirms)

`tag-suggest.mjs` asks Claude for facet **proposals** (enum-constrained, each with confidence + a quoted evidence span; `insufficient_evidence` instead of guessing; explicit `sensitive_attribute_inference: none_performed`). A human then Accept/Edit/Rejects each — with **forced** review for confidence < 0.7, all of F8, and content warnings — and an audit log (model/prompt version, proposed vs final, reviewer, timestamp) records every decision. Only accepted tags land in `events.json` (validated against `vocab.json`).
