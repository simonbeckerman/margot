# Beckerman Companion

Household tool for Simon and Chiara: **travel-day tracking** for UK Statutory Residence Test day counts, backed by Supabase and exposed to Claude (and similar clients) via **MCP**. This repository holds the specification, handbook, and (as we build it) the Edge Function and tests.

## Documentation

Detail lives in `docs/`; this file stays a short index and operations checklist.

| Document | Purpose |
| ---------- | ------- |
| [docs/SPEC.md](docs/SPEC.md) | Product and technical specification: schema, tools, counting rules, deliverables |
| [docs/PROJECT.md](docs/PROJECT.md) | Setup: GitHub, Supabase CLI and MCP, tokens, country strings, Git remote |
| [docs/israel_move_source_of_truth.md](docs/israel_move_source_of_truth.md) | Factual basis (add when available) |
| [docs/israel_move_year_one_priorities.md](docs/israel_move_year_one_priorities.md) | Principles (add when available) |

Cursor agent rules live in `.cursor/rules/`.

## Operations

Sections below will be filled in as the implementation in `docs/SPEC.md` is completed.

### Add a trip manually

Use SQL against the `trips` table (see `docs/SPEC.md` for columns) or the `log_trip` MCP tool once deployed. Example `INSERT` will be added here after migrations exist.

### Run tests

Document the test command here once the package and runner are in the repo (for example `npm test`).

### Redeploy the MCP Edge Function

Document `supabase functions deploy` (or your chosen command) here once the function name and project link are fixed.

### Rotate household API tokens

See **API tokens** in [docs/PROJECT.md](docs/PROJECT.md): generate new secrets, update Supabase Edge Function secrets, update each Claude connector, then retire old tokens.
