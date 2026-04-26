# Margot

Household tool for Simon and Chiara: **travel-day tracking** for UK Statutory Residence Test day counts, backed by Supabase and exposed to Claude (and similar clients) via **MCP**.

## Canonical values

| Item | Value |
| ---- | ----- |
| Repository | https://github.com/simonbeckerman/beckerman-companion |
| Supabase project | `margot` (ref `yszlwawwlfjrytwcbqpu`) |
| Supabase dashboard | https://supabase.com/dashboard/project/yszlwawwlfjrytwcbqpu |
| Edge function (production) | `beckerman-mcp` at https://yszlwawwlfjrytwcbqpu.supabase.co/functions/v1/beckerman-mcp |
| OAuth consent page (GitHub Pages) | https://simonbeckerman.github.io/beckerman-companion-oauth/oauth-consent.html |

## Documentation

Detail lives in `docs/`; this file is the short index and day-to-day checklist.

| Document | Purpose |
| ---------- | ------- |
| [docs/CONNECT.md](docs/CONNECT.md) | **Start here:** GitHub, Supabase link, secrets, deploy, Claude custom connector (OAuth Connect + access code) |
| [docs/test-results.md](docs/test-results.md) | Test results: each check in one line, expected outcome in the next |
| [docs/SPEC.md](docs/SPEC.md) | Product and technical specification |
| [docs/PROJECT.md](docs/PROJECT.md) | CLI vs MCP, tokens, country strings, handbook |
| [docs/mcp-claude.sample.json](docs/mcp-claude.sample.json) | Example Claude MCP config (URL + bearer token) |
| [mcp.json.sample](mcp.json.sample) | Same shape for a project-level `mcp.json` (copy, rename, fill URL and token per person) |
| [docs/israel_move_source_of_truth.md](docs/israel_move_source_of_truth.md) | Factual basis (add when available) |
| [docs/israel_move_year_one_priorities.md](docs/israel_move_year_one_priorities.md) | Principles (add when available) |

MCP **tool** replies are compact: one-line JSON, and `days_in_country` **omits** the trip-id list so Claude uses fewer tokens. That list is still produced in the shared counting code for local tests.

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

**Full E2E** (unit tests, rotates both companion tokens, live `log_trip` + `days_in_country`, then deletes all rows with notes like `e2e%`):

```bash
npm run e2e
```

The script prints **new** `COMPANION_TOKEN_SIMON` and `COMPANION_TOKEN_CHIARA`. Save them; your previous tokens stop working after the run.

### Redeploy the MCP Edge Function

```bash
supabase functions deploy beckerman-mcp
```

### Rotate household API tokens

1. Generate new secrets (`openssl rand -base64 32`).
2. `supabase secrets set COMPANION_TOKEN_SIMON='...' COMPANION_TOKEN_CHIARA='...' MCP_OAUTH_JWT_SECRET='...'` (include the OAuth secret from your first-time setup; rotate `MCP_OAUTH_JWT_SECRET` only if you mean to invalidate Claude sessions)
3. Update each Claude MCP config with the new bearer for that person.
4. Redeploy if your setup requires it; retire old secrets.

Details: [docs/PROJECT.md](docs/PROJECT.md) (API tokens).

### OAuth (Claude) token lifetimes and `MCP_OAUTH_JWT_SECRET`

- **Access tokens** issued by `/oauth/token` are **short-lived (1 hour)**; **refresh tokens** are **30 days** (replaced on each refresh in the current implementation). `MCP_OAUTH_JWT_SECRET` is read only from **Supabase Edge secrets** (or local env for `functions serve`); it is **not** committed to the repo.
- **If `MCP_OAUTH_JWT_SECRET` leaks or you rotate it:** set a new value with `supabase secrets set MCP_OAUTH_JWT_SECRET='...'`, run `supabase functions deploy beckerman-mcp`, then have each user **Connect** again in Claude (and refresh any other clients that relied on the old secret’s tokens).

### Verify the Claude-oriented OAuth build is what’s deployed

After deploy, an unauthenticated POST should return **401** and include a **`www-authenticate`** header whose value mentions **`resource_metadata`** (MCP discovery). Example:

```bash
curl -sS -D - -o /dev/null -X POST "https://<PROJECT_REF>.supabase.co/functions/v1/beckerman-mcp" \
  -H "Content-Type: application/json" -d '{}'
# Expect: HTTP/2 401 and a www-authenticate header containing resource_metadata=...
# If that header is absent, redeploy `beckerman-mcp` (or confirm the latest code is live).
```

## Backup, recovery, and where the secrets live (two-person, low ceremony)

**Write this down once** (password note or a private note, not the repo): Supabase **project ref**, dashboard URL, and Edge function URL: `https://<ref>.supabase.co/functions/v1/beckerman-mcp`. The ref also appears in [docs/CONNECT.md](docs/CONNECT.md) and in `scripts/e2e-full.mjs` as a default. Edge secrets include `COMPANION_TOKEN_SIMON`, `COMPANION_TOKEN_CHIARA`, and `MCP_OAUTH_JWT_SECRET` (values are not shown again in the UI after you set them, so your password manager is the long-term copy).

**Backup `trips` manually (repeat when you like):** In the Supabase **Dashboard** → **Table editor** → `public.trips` → export as CSV, or in **SQL** run a `select` and download the result. If you use the **linked** CLI, you can point stdout to a file, for example:

```bash
supabase db query --linked "select coalesce(json_agg(t), '[]') from (select * from public.trips order by person, depart_date, id) t" 2>&1 | tee trips-backup.json
```

Check the output: your CLI may wrap JSON. Prefer the CSV from the table editor if that is easier.

**If the Edge Function is deleted or broken:** The code is in git (`supabase/functions/beckerman-mcp` and `supabase/functions/_shared`). [docs/CONNECT.md](docs/CONNECT.md) has link, `db push`, and `supabase functions deploy beckerman-mcp` again, then set secrets. Under ten minutes is realistic if the machine already has the CLI and login.

**Token rotation (exact):** Generate new companion secrets, `supabase secrets set` with new `COMPANION_TOKEN_SIMON` / `COMPANION_TOKEN_CHIARA` (keep or rotate `MCP_OAUTH_JWT_SECRET` per [docs/CONNECT.md](docs/CONNECT.md)), update Cursor/`mcp.json` bearers if you use them, use **Connect** again in Claude’s custom connector if companion tokens changed, save in the password manager, `supabase functions deploy beckerman-mcp` if required, then restart the client.

## Known limitations

1. **OAuth consent page hosted on GitHub Pages.** The browser sign-in page that runs during Claude’s "Add custom connector" flow lives on GitHub Pages because this repo is private and [Pages is not available for private repos on the free plan](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits). If the GitHub repo’s visibility changes, or the GitHub Pages site goes down, the OAuth flow for hosted Claude (web/mobile) breaks. Static bearer auth via `mcp.json` (Cursor, Claude Desktop) is unaffected. Long-term fix: a [Supabase custom domain](https://supabase.com/docs/reference/cli/supabase-domains) so consent and MCP serve from one origin.

2. **`trips_considered` not returned in MCP responses.** The counting function computes it, but the MCP handler strips it before responding, to keep responses compact. To debug "why is the count what it is", either run the counting function directly (`vitest`, an ad-hoc script) or query Supabase directly.

3. **HMRC SRT deeming-day rule not implemented.** The day-count function does not implement the deeming-day rule (which makes some "transit" days count as UK days once you have ≥ 3 UK ties and exceed 30 qualifying days). At present we operate on the assumption of 2 UK ties, where deeming days do not apply. Revisit if Herzog/Pirola advise we have 3 ties for 2026-27.
