#  Beckerman Companion

Build an MCP server for personal travel-day tracking. This is the first feature of `beckerman-companion`, a two-person household tool for Simon Beckerman and his wife Chiara, who are relocating from the UK to Israel and need to track UK days carefully to avoid accidental UK tax residence under the Statutory Residence Test. Future features will include advisor-answer memory, decision tracking, and document grounding, but this build is strictly travel days.

## Stack

- Supabase for database and hosting (account exists, use the Supabase MCP to provision).
- Deploy the MCP server as a Supabase Edge Function. Do not use Vercel for this.
- TypeScript throughout.
- Use the official MCP SDK.

## Database

Create one Supabase project called `beckerman-companion` if it does not already exist. One table:

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

Add an index on (person, depart_date). Enable RLS but make both users able to read and write all rows. This is shared household data, not siloed.

## Auth

Two separate bearer tokens, one for Simon and one for Chiara. The MCP server reads the token on every call and derives `current_user` (either 'simon' or 'chiara') from it. Store the token-to-user mapping in Supabase as a simple table or as env vars, whichever is cleaner.

`log_trip` defaults the `person` field to `current_user` if not specified, but allows explicit override (so Simon can log a trip on Chiara's behalf if needed). Always set `created_by` to `current_user`.

## Tools

Expose exactly two MCP tools initially.

### 1. `log_trip`

Inputs:
- `person` (optional, defaults to current_user): 'simon' | 'chiara'
- `departure_country` (required)
- `arrival_country` (required)
- `depart_date` (required, ISO date)
- `arrive_date` (required, ISO date)
- `notes` (optional)

Validates that arrive_date >= depart_date. Inserts one row. Returns the created row.

### 2. `days_in_country`

Inputs:
- `person` (required): 'simon' | 'chiara'
- `country` (required): string
- `range` (required): one of
  - `{ type: 'uk_tax_year', year: 2026 }` (means 6 April 2026 to 5 April 2027)
  - `{ type: 'calendar_year', year: 2026 }`
  - `{ type: 'custom', start: '2026-01-01', end: '2026-12-31' }`

Returns:
- `days_present`: number
- `method`: 'uk_midnight' if country is 'United Kingdom', else 'inclusive_presence'
- `range_start`, `range_end`: the resolved date window
- `trips_considered`: array of trip ids used in the calculation

## Counting logic — this is the part that must be correct

The `trips` table stores transitions. To determine presence on a given date, walk trips in chronological order and maintain a "current country" state for each person. Seed the initial country as 'United Kingdom' for both Simon and Chiara (they are currently UK residents; this may become configurable later but hard-code for now).

For each date D in the requested range:
- Determine which country the person was in on date D by finding the most recent trip where arrive_date <= D. Before any trips, they are in the seed country.
- Apply the counting rule.

**UK midnight rule (for country = 'United Kingdom'):**

A day counts if the person was in the UK at midnight at the end of that day. Equivalently: they count the day if they were in the UK on date D AND they did not depart the UK on date D. If depart_date == D and departure_country == 'United Kingdom', that day does NOT count (they left before midnight). If arrive_date == D and arrival_country == 'United Kingdom', that day DOES count (they arrived and were there at midnight).

Do NOT implement the SRT deeming-day rule yet. Flag it as a TODO. It requires tracking "transit days" and "qualifying days" and depends on tie-count, which we are not computing yet.

**Inclusive presence rule (for all other countries):**

A day counts if the person was in that country at any point during the day. This means both the depart_date and arrive_date count as days present, if the person was in that country on either end.

Write unit tests for the counting function covering at minimum:
- Simple case: single trip out and back, counts correctly for both UK and non-UK.
- Edge case: arrive and depart same country on same day (shouldn't happen but handle gracefully).
- Boundary: trip spans the tax year boundary (6 April).
- Multiple trips in one year.
- Query range before any trips exist (should use seed country).

## Out of scope for this build

- No advisor_answers table, no decisions table. Just trips.
- No vector database, no embeddings.
- No web UI, no dashboard.
- No deeming-day logic.
- No Israel or Italy residency calculations beyond raw day counts.
- No email ingestion.

If you're tempted to add any of the above, stop and write it as a TODO comment instead.

## Deliverables

1. Supabase project provisioned with the `trips` table and RLS policies.
2. Edge function deployed with the MCP server exposing the two tools.
3. A `.mcp.json` snippet or equivalent showing exactly how Simon and Chiara each configure their Claude client to connect, including where to put their respective tokens.
4. A short README with: how to add a new trip manually, how to run the tests, how to redeploy, how to rotate tokens.
5. Tests passing.

## Governing documents

Two files live in `docs/`:
- `docs/israel_move_source_of_truth.md`: the factual basis for this project. Read it before starting.
- `docs/israel_move_year_one_priorities.md`: the principles governing this project. The relevant one for you: "Robustness over optimisation, reversibility preferred, avoid premature structures." Build the smallest thing that works.

## Style

- No em dashes in code comments or README.
- Comments are sparse and explain why, not what.
- Prefer clarity over cleverness in the counting function specifically. This is the part I will read most often.

Start by confirming the Supabase project name and which account to deploy to, then proceed.
