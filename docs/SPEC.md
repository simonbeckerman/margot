# Margot: product and technical specification

Personal travel-day tracking via an MCP server. First feature of `margot`: a two-person household tool for Simon Beckerman and Chiara, relocating from the UK to Israel, tracking UK days to reduce risk of accidental UK tax residence under the Statutory Residence Test. Later: advisor-answer memory, decision tracking, document grounding. **This phase is only travel days.**

## Stack

- Supabase for database and hosting.
- Deploy the MCP server as a Supabase Edge Function. Do not use Vercel for this.
- TypeScript throughout.
- Use the official MCP SDK.

Provisioning and tooling (CLI, MCP in Cursor, GitHub) are in [PROJECT.md](PROJECT.md).

## Database

One Supabase project; preferred name **`margot`** if it does not already exist. Two tables:

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

deleted_trips       -- archive; rows moved here by delete_trip, back by restore_trip
  id                uuid primary key  -- same id as the original trips row
  person            text not null check (person in ('simon', 'chiara'))
  departure_country text not null
  arrival_country   text not null
  depart_date       date not null
  arrive_date       date not null
  notes             text
  created_at        timestamptz       -- preserved from original row
  created_by        text
  deleted_by        text not null check (deleted_by in ('simon', 'chiara'))
  deleted_at        timestamptz not null default now()
```

Add an index on `trips(person, depart_date)`. Enable RLS on both tables; both users can read and write all rows (shared household data, not siloed).

## Auth

Two bearer tokens, one for Simon and one for Chiara. The MCP server reads the token on every call and sets `current_user` to `simon` or `chiara`. Store the mapping in Supabase (table or env vars), whichever stays simpler to operate.

`log_trip` defaults `person` to `current_user` if omitted, but allows override (for example Simon logs for Chiara). Always set `created_by` to `current_user`.

## MCP tools

Six tools. `log_trip`, `edit_trip`, and `delete_trip` are write operations; they all support a `confirm` flag (see below). `days_in_country`, `list_trips`, and `restore_trip` are read or recovery operations with no confirm step.

### Confirm pattern (write tools)

Without `confirm: true`, write tools run all validation, normalize countries, and return a **preview** of what would happen (including any warnings). Pass `confirm: true` to execute. This gives the user one chance to review before anything changes.

### 1. `log_trip`

Inputs:

- `person` (optional, default `current_user`): `simon` | `chiara`
- `departure_country` (required)
- `arrival_country` (required)
- `depart_date` (required, ISO date)
- `arrive_date` (required, ISO date)
- `notes` (optional)
- `confirm` (optional, default `false`)

Validate `arrive_date >= depart_date`. Reject exact duplicates (same person + depart_date + countries). Without `confirm`, return preview. With `confirm`, insert and return the created row.

### 2. `days_in_country`

Inputs:

- `person` (optional, default `current_user`): `simon` | `chiara`
- `country` (required): string
- `range` (required), one of:
  - `{ type: ‘uk_tax_year’, year: 2026 }` → 6 April 2026 to 5 April 2027
  - `{ type: ‘calendar_year’, year: 2026 }`
  - `{ type: ‘custom’, start: ‘2026-01-01’, end: ‘2026-12-31’ }`

Returns:

- `days_present`: number, days actually counted (today and earlier only).
- `method`: `uk_midnight` if country is `United Kingdom`, else `inclusive_presence`.
- `range_start`: requested start.
- `range_end`: **effective** end actually used for counting, i.e. `min(requested_end, today)` (server-side UTC). When the whole window is in the future, this collapses to `range_start` so the displayed range is never inverted.
- `days_projected_remaining`: count of days in the requested range that fall **after** today and were therefore not counted. Zero when the requested window ends today or earlier. Lets the assistant report "you have used X UK days, with Y days still to come in this period" without the tool ever projecting future presence as if it had happened.
- `trips_considered`: trip ids that fed the count (present in the shared counting module; **omitted in MCP tool responses** so the assistant’s context stays small).

### 3. `list_trips`

Inputs:

- `person` (optional, default `current_user`): `simon` | `chiara`
- `filter` (optional, default `all`): `all` | `past` | `future`

Returns all matching trips ordered by `depart_date`.

### 4. `edit_trip`

Inputs:

- `id` (required): trip UUID
- `person` (optional, default `current_user`): `simon` | `chiara`
- `departure_country`, `arrival_country`, `depart_date`, `arrive_date`, `notes` (all optional - pass only fields to change)
- `confirm` (optional, default `false`)

Validates that the trip belongs to `person`. Without `confirm`, returns a `changes` diff (`{ field: { from, to } }`) plus any overlap warnings. With `confirm`, applies the patch and returns `{ updated, was }`.

### 5. `delete_trip`

Inputs:

- `id` (required): trip UUID
- `person` (optional, default `current_user`): `simon` | `chiara`
- `confirm` (optional, default `false`)

Validates that the trip belongs to `person`. Without `confirm`, returns the trip to be deleted. With `confirm`, moves the row to `deleted_trips` (with `deleted_by` and `deleted_at`). Recoverable via `restore_trip`.

### 6. `restore_trip`

Inputs:

- `id` (required): UUID of a row in `deleted_trips`

Moves the row back to `trips`, preserving the original `id` and `created_at`. Errors if the id is not in `deleted_trips` or already exists in `trips`.

## Counting logic

The `trips` table stores **transitions**. For each person, walk trips in chronological order and track **current country**. **Seed** initial country: `United Kingdom` for both (hard-code for now; may become configurable later).

For each date `D` in the requested range:

- Country on `D`: from the most recent trip with `arrive_date <= D`. Before any trips, use the seed country.
- Apply the counting rule for the requested country.

### UK midnight rule (`country === 'United Kingdom'`)

Count `D` if, **after** applying all depart and arrive **events** on that calendar day in the order the trips were stored (`created_at` ascending, then `id`, and within a same leg always depart then arrive), the person’s last location on that day is the United Kingdom. If a day has no move rows, the previous transition-based location still applies. Same-day return (for example out to Paris and back to London) therefore counts for the UK if the day’s last event is an arrival in the United Kingdom.

**Do not** implement the SRT deeming-day rule in this phase. Leave a **TODO**: it needs transit days, qualifying days, and tie-count, which are out of scope.

### Inclusive presence rule (all other countries)

Count `D` if the person was in that country **at any time** that calendar day. Both `depart_date` and `arrive_date` count when they fall on days in that country.

### Future-day clipping

`days_in_country` only counts days up to and including **today** (server-side UTC). Days after today in the requested range are reported in `days_projected_remaining` instead. Without this, a query like "UK days in calendar year 2026" run in April would project the seed country forward and report ~360 UK days, which is dangerous near the 45-day cap. No timezone gymnastics: the one-day fuzziness near UTC midnight is acceptable at this scale.

### Tests

Unit-test the counting function at least for:

- Simple round trip; correct counts for UK and non-UK.
- Edge: arrive and depart same country same day (should be rare; handle safely).
- Boundary: trip crosses UK tax year (6 April).
- Several trips in one year.
- Range before any trips (seed country).

Country naming and normalization: [PROJECT.md](PROJECT.md) (country strings).

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
3. Claude MCP config: [mcp-claude.sample.json](mcp-claude.sample.json) or [mcp.json.sample](../mcp.json.sample) at repo root (same JSON; copy per person with the right bearer token).
4. Root `README.md`: how to add a trip manually, run tests, redeploy, rotate tokens (expand as implementation lands).
5. Tests passing.

## Governing documents

When present in `docs/`:

- `israel_move_source_of_truth.md`: factual basis. Read before large product changes.
- `israel_move_year_one_priorities.md`: principles. Example: robustness over optimisation, reversibility, avoid premature structures. Prefer the smallest working design.

## Implementation style

- No em dashes in code comments, [README.md](../README.md), or other markdown under `docs/`. Use a colon, hyphen, or sentence break instead.
- Comments are sparse; explain why, not what.
- Counting logic should favour clarity over cleverness; it will be read often.
