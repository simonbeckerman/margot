# Beckerman Companion — product and technical specification

Personal travel-day tracking via an MCP server. First feature of `beckerman-companion`: a two-person household tool for Simon Beckerman and Chiara, relocating from the UK to Israel, tracking UK days to reduce risk of accidental UK tax residence under the Statutory Residence Test. Later: advisor-answer memory, decision tracking, document grounding. **This phase is only travel days.**

## Stack

- Supabase for database and hosting.
- Deploy the MCP server as a Supabase Edge Function. Do not use Vercel for this.
- TypeScript throughout.
- Use the official MCP SDK.

Provisioning and tooling (CLI, MCP in Cursor, GitHub) are described in `docs/PROJECT.md`.

## Database

One Supabase project; preferred name **`beckerman-companion`** if it does not already exist. One table:

```sql
trips
  id                uuid primary key default gen_random_uuid()
  person            text not null check (person in ('simon', 'chiara'))
  departure_country text not null     -- ISO country name, e.g. 'United Kingdom'
  arrival_country   text not null
  depart_date       date not null     -- date they left departure_country
  arrive_date       date not null     -- date they arrived in arrival_country
  notes             text
  created_at        timestamptz not null default now()
  created_by        text not null check (created_by in ('simon', 'chiara'))
```

Add an index on `(person, depart_date)`. Enable RLS; both users can read and write all rows (shared household data, not siloed).

## Auth

Two bearer tokens, one for Simon and one for Chiara. The MCP server reads the token on every call and sets `current_user` to `simon` or `chiara`. Store the mapping in Supabase (table or env vars), whichever stays simpler to operate.

`log_trip` defaults `person` to `current_user` if omitted, but allows override (e.g. Simon logs for Chiara). Always set `created_by` to `current_user`.

## MCP tools

Exactly two tools initially.

### 1. `log_trip`

Inputs:

- `person` (optional, default `current_user`): `simon` | `chiara`
- `departure_country` (required)
- `arrival_country` (required)
- `depart_date` (required, ISO date)
- `arrive_date` (required, ISO date)
- `notes` (optional)

Validate `arrive_date >= depart_date`. Insert one row. Return the created row.

### 2. `days_in_country`

Inputs:

- `person` (required): `simon` | `chiara`
- `country` (required): string
- `range` (required), one of:
  - `{ type: 'uk_tax_year', year: 2026 }` → 6 April 2026 to 5 April 2027
  - `{ type: 'calendar_year', year: 2026 }`
  - `{ type: 'custom', start: '2026-01-01', end: '2026-12-31' }`

Returns:

- `days_present`: number
- `method`: `uk_midnight` if country is `United Kingdom`, else `inclusive_presence`
- `range_start`, `range_end`: resolved window
- `trips_considered`: trip ids used in the calculation

## Counting logic

The `trips` table stores **transitions**. For each person, walk trips in chronological order and track **current country**. **Seed** initial country: `United Kingdom` for both (hard-code for now; may become configurable later).

For each date `D` in the requested range:

- Country on `D`: from the most recent trip with `arrive_date <= D`. Before any trips, use the seed country.
- Apply the counting rule for the requested country.

### UK midnight rule (`country === 'United Kingdom'`)

Count the day if the person was in the UK at **midnight at the end** of that day. Equivalent formulation: count `D` if they were in the UK on `D` **and** they did **not** depart the UK on `D`. If `depart_date === D` and `departure_country === 'United Kingdom'`, the day does **not** count. If `arrive_date === D` and `arrival_country === 'United Kingdom'`, the day **does** count.

**Do not** implement the SRT deeming-day rule in this phase. Leave a **TODO**: it needs transit days, qualifying days, and tie-count, which are out of scope.

### Inclusive presence rule (all other countries)

Count `D` if the person was in that country **at any time** that calendar day. Both `depart_date` and `arrive_date` count when they fall on days in that country.

### Tests

Unit-test the counting function at least for:

- Simple round trip; correct counts for UK and non-UK.
- Edge: arrive and depart same country same day (should be rare; handle safely).
- Boundary: trip crosses UK tax year (6 April).
- Several trips in one year.
- Range before any trips (seed country).

Country naming and normalization for implementation: see `docs/PROJECT.md` (country strings).

## Out of scope (this build)

- No `advisor_answers` or `decisions` tables. Trips only.
- No vector DB or embeddings.
- No web UI or dashboard.
- No deeming-day logic.
- No Israel or Italy residency rules beyond raw day counts.
- No email ingestion.

If tempted to add any of the above, use a TODO comment instead.

## Deliverables

1. Supabase project with `trips` table and RLS as specified.
2. Edge Function deployed hosting the MCP server with the two tools.
3. `.mcp.json` snippet (or equivalent) for Simon and Chiara: Claude connector URL and where each bearer token goes.
4. Root `README.md`: how to add a trip manually, run tests, redeploy, rotate tokens (expand as implementation lands).
5. Tests passing.

## Governing documents

When present in `docs/`:

- `israel_move_source_of_truth.md`: factual basis. Read before large product changes.
- `israel_move_year_one_priorities.md`: principles. Example: robustness over optimisation, reversibility, avoid premature structures. Prefer the smallest working design.

## Implementation style

- No em dashes in code comments or `README.md`.
- Comments are sparse; explain why, not what.
- Counting logic should favour clarity over cleverness; it will be read often.
