# Margot: project handbook

Long-lived operations and setup. Product and technical detail is in [SPEC.md](SPEC.md).

**End-to-end connection (GitHub, Supabase, deploy, Claude):** [CONNECT.md](CONNECT.md).

## CLI vs MCP (what to install)

**CLI** is a **command-line program** you run in Terminal (for example `supabase login`, `supabase db push`). It is how you link this repo to a Supabase project, run migrations, deploy Edge Functions, and manage deployment secrets.

**MCP** is **Model Context Protocol**: a way for **Cursor** (or another client) to connect to a remote MCP server so assistant tools can use a service. Supabase provides a hosted MCP URL in **Cursor Settings → Tools & MCP**. That helps while building. It does **not** replace the CLI for migrations and deploys.

**Best practice here:** install and use **both**. If you must pick one to ship the product first, install the **Supabase CLI**, then add **Supabase MCP** in Cursor.

## Quick start (do once)

On your Mac:

1. **GitHub:** `gh auth login`, then from this repo: `gh repo create margot --public --source=. --remote=origin --push` (change name or use `--public` if you want).
2. **Supabase CLI:** `supabase login`.
3. **Supabase MCP in Cursor:** **Settings → Tools & MCP → Add MCP server** → type **HTTP** → URL `https://mcp.supabase.com/mcp` → complete login when prompted. Details: [Supabase MCP](https://supabase.com/docs/guides/getting-started/mcp).
4. **Household API tokens** (once the Edge Function exists): two long random secrets in a password manager; set as function secrets and in each Claude connector. See [API tokens](#api-tokens-simon-and-chiara) below.
5. **Country names:** full English names in the database (for example `United Kingdom`); code may normalize UK short forms. See [Country strings](#country-strings).

## Installing GitHub and Supabase CLIs

If `gh` or `supabase` are missing, install with Homebrew:

```bash
brew install gh
brew install supabase/tap/supabase
```

Check versions with `gh --version` and `supabase --version`. First-time GitHub use: `gh auth login` (browser or device flow). Supabase: `supabase login` opens a browser.

## Supabase MCP in Cursor (detail)

1. **Cursor Settings → Tools & MCP → Add MCP server** (labels may vary by version).
2. Server type **HTTP**, URL `https://mcp.supabase.com/mcp`.
3. Sign in to Supabase and choose the **organization** that should own the project.

Optional: restrict to one project with query parameters from the [Supabase MCP](https://supabase.com/docs/guides/getting-started/mcp) docs (for example `?project_ref=YOUR_REF`).

Example config shape for clients that use an `mcpServers` map (field names depend on your Cursor version; prefer the Settings UI when unsure):

```json
{
  "mcpServers": {
    "supabase": {
      "type": "http",
      "url": "https://mcp.supabase.com/mcp"
    }
  }
}
```

## Access to Supabase from this repo

This repository does **not** contain Supabase credentials. Someone can work with your Supabase project only if:

- **Hosted Supabase MCP** is enabled in Cursor with your account, or
- **Project URL and keys** (for example service role or anon, as appropriate) exist in local env files or CI secrets for CLI and deploys.

Signing in to Supabase in a browser is always done in your own session. After MCP is connected, Cursor can expose Supabase MCP tools to assistants according to your client settings.

## API tokens (Simon and Chiara)

These are **not** Supabase dashboard passwords. They are **household API tokens** the Edge Function checks on MCP requests so the server knows whether the caller is Simon or Chiara.

1. Generate two long random secrets (32+ bytes), one per person. On macOS:

   ```bash
   openssl rand -base64 32
   ```

   Run twice; store values in a password manager. Do not commit them.

2. In Supabase, set **Edge Function secrets** (Dashboard → Project Settings → Edge Functions, or CLI), for example:

   - `COMPANION_TOKEN_SIMON` → first secret
   - `COMPANION_TOKEN_CHIARA` → second secret
   - `MCP_OAUTH_JWT_SECRET` → third secret (Claude OAuth token signing; see [CONNECT.md](CONNECT.md))

3. **Claude (Add custom connector):** uses MCP OAuth access tokens after the in-browser **Connect** flow; the login page accepts the same per-person **companion** secrets stored in `COMPANION_TOKEN_*`. **Cursor / API scripts** can still send `Authorization: Bearer <companion token>`, **Basic** (secret = token), or `?companion_token=`. See [CONNECT.md §7](CONNECT.md#7-claude--add-custom-connector-screen) and [claude.com/docs/connectors/building/authentication](https://claude.com/docs/connectors/building/authentication).

**Rotation:** create a new secret, update the Edge Function secret and each client (Claude connector), deploy if required, then stop using the old secret.

## Country strings

- **Storage:** full English country names in the database (example: `United Kingdom`), as in [SPEC.md](SPEC.md).
- **Input normalization:** accept common UK aliases and normalize to `United Kingdom`: `UK`, `U.K.`, `GB`, `Great Britain` (case-insensitive, trimmed). Other countries: trim; optional later map such as `USA` / `US` → `United States`.
- **`days_in_country`:** after normalization, compare using the same canonical string as in trip rows and presence logic.

## MCP transport, Claude, and Custom GPT

**MCP** is how Claude (or Cursor) talks to a server that exposes tools. A **remote** household connector uses MCP over **HTTP** (exact transport depends on client and SDK). A Supabase Edge Function is a reasonable host for that endpoint.

**Claude:** the custom connector URL is the function base URL; **do not** put the household token in **OAuth Client Secret** (that field is for confidential OAuth clients only). Use **Connect** in the UI and enter the access code on this project’s sign-in page; [docs/CONNECT.md](CONNECT.md) §7. File-based / Cursor config can still use `Authorization: Bearer` with the companion token.

**Custom GPT:** OpenAI Custom GPTs do **not** use MCP. They usually call **HTTPS REST** endpoints (Actions / OpenAPI). Keep **core logic** (day counting, database access) in shared TypeScript modules, and add a thin REST layer beside MCP later if you want the same rules in a GPT without duplicating logic.

## GitHub repository

**With `gh` (after `gh auth login`):** from the repo root:

```bash
cd /Users/simon/GitHub/margot
gh repo create margot --public --source=. --remote=origin --push
```

Adjust visibility or name as needed. If `origin` already exists, use `git remote add origin ...` and `git push -u origin main`.

**Without `gh`:** create an empty repository on GitHub (no README), then:

```bash
cd /Users/simon/GitHub/margot
git remote add origin https://github.com/YOUR_USER/margot.git
git push -u origin main
```

## Governing documents

Add when available:

- `docs/israel_move_source_of_truth.md`
- `docs/israel_move_year_one_priorities.md`

They are referenced from [SPEC.md](SPEC.md), [README.md](../README.md), and `.cursorrc`.
