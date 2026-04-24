# Beckerman Companion

Household tool for Simon and Chiara: **travel-day tracking** for UK Statutory Residence Test day counts, backed by Supabase and exposed to Claude (and similar clients) via **MCP**.

## Documentation

Detail lives in `docs/`; this file is the short index and day-to-day checklist.

| Document | Purpose |
| ---------- | ------- |
| [docs/CONNECT.md](docs/CONNECT.md) | **Start here:** GitHub, Supabase link, secrets, deploy, Claude MCP |
| [docs/SPEC.md](docs/SPEC.md) | Product and technical specification |
| [docs/PROJECT.md](docs/PROJECT.md) | CLI vs MCP, tokens, country strings, handbook |
| [docs/mcp-claude.sample.json](docs/mcp-claude.sample.json) | Example Claude MCP config (URL + bearer token) |
| [docs/israel_move_source_of_truth.md](docs/israel_move_source_of_truth.md) | Factual basis (add when available) |
| [docs/israel_move_year_one_priorities.md](docs/israel_move_year_one_priorities.md) | Principles (add when available) |

Cursor agent rules: `.cursor/rules/`.

## Operations

### First-time connection

Follow **[docs/CONNECT.md](docs/CONNECT.md)** end to end. You will run `gh auth login`, `supabase login`, `supabase link`, `supabase db push`, `supabase secrets set`, and `supabase functions deploy` (browser steps required for GitHub and Supabase).

### Add a trip manually

**SQL** (Supabase SQL editor or `psql`), after migrations:

```sql
insert into public.trips (
  person, departure_country, arrival_country, depart_date, arrive_date, created_by
) values (
  'simon', 'United Kingdom', 'France', '2026-06-01', '2026-06-02', 'simon'
);
```

Or use the **`log_trip`** MCP tool against the deployed `beckerman-mcp` function with a valid bearer token.

### Run tests

```bash
npm install
npm test
```

**Smoke test** (unit tests + 401 on the live function; optional `log_trip` with a token):

```bash
npm run smoke
```

To also call the deployed MCP with **`log_trip`** (inserts a year-2030 test trip tagged for deletion), set your token once in the same shell, then run smoke:

```bash
export COMPANION_TOKEN_SIMON='paste-from-password-manager'
npm run smoke
```

Remove test rows: `delete from public.trips where notes like '%smoke test%';` in the Supabase SQL editor.

### Redeploy the MCP Edge Function

```bash
supabase functions deploy beckerman-mcp
```

### Rotate household API tokens

1. Generate new secrets (`openssl rand -base64 32`).
2. `supabase secrets set COMPANION_TOKEN_SIMON='...' COMPANION_TOKEN_CHIARA='...'`
3. Update each Claude MCP config with the new bearer for that person.
4. Redeploy if your setup requires it; retire old secrets.

Details: [docs/PROJECT.md](docs/PROJECT.md) (API tokens).
