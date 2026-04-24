# Beckerman Companion — project handbook

This file is the long-lived record of how this repo is meant to work. The implementation spec lives in `start.md` at the repo root.

## Quick start (do once)

The AI cannot sign into your accounts for you. On your Mac:

1. **GitHub:** Run `gh auth login` in Terminal, then from this repo run `gh repo create beckerman-companion --private --source=. --remote=origin --push` (change name or use `--public` if you want).
2. **Supabase CLI:** Run `supabase login` in Terminal.
3. **Supabase in Cursor:** Cursor **Settings → Tools & MCP → Add MCP server** → type **HTTP** → URL `https://mcp.supabase.com/mcp` → finish login when asked. [Supabase MCP docs](https://supabase.com/docs/guides/getting-started/mcp).
4. **Household API tokens (when the Edge Function exists):** Two long random secrets (not your Supabase password), in a password manager; set as function secrets and in each Claude connector. See the **API tokens** section below.
5. **Country names:** Store full English names (e.g. `United Kingdom`); code may normalize UK short forms.

## Local CLIs (this machine)

These were installed with Homebrew for repo work and automation:

- **GitHub CLI:** `gh` (`brew install gh`). Check: `gh --version`. First-time use: run `gh auth login` and complete the browser/device flow (interactive; cannot be finished for you by an agent).
- **Supabase CLI:** `supabase` (`brew install supabase/tap/supabase`). Check: `supabase --version`. Link a project after `supabase login` (opens browser).

**Supabase MCP (Cursor)** is separate from the CLI: it is an HTTP connection inside **Cursor Settings → Tools & MCP**, not a Homebrew package. Add server type **HTTP** and URL `https://mcp.supabase.com/mcp`, then sign in when Cursor prompts. Official guide: [Model context protocol (MCP)](https://supabase.com/docs/guides/getting-started/mcp).

Example fragment for clients that use a JSON `mcpServers` map (field names depend on your Cursor version; use the Settings UI if unsure):

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

## Do I (the AI) have access to your Supabase?

**Not by default.** Nothing in this folder grants access to your Supabase account. Access happens only if:

- You add the **hosted Supabase MCP** in Cursor and sign in with your Supabase account (recommended for provisioning and SQL from chat), or
- You put **project URL and service role / anon keys** in local env files or CI secrets for CLI and deploys.

I cannot log into Supabase as you. I can edit this repo, run local commands, and use MCP tools **you** have enabled in Cursor.

## Supabase MCP — install it yourself (one-time)

Supabase hosts an MCP endpoint; you connect Cursor to it and complete browser login.

1. Open **Cursor Settings → Tools & MCP → Add MCP Server** (wording may vary slightly by version).
2. Add an HTTP MCP server with URL: `https://mcp.supabase.com/mcp`
3. When prompted, sign in to Supabase and pick the **organization** that should own the project.

Optional: scope to one project by appending query params documented in [Supabase MCP](https://supabase.com/docs/guides/getting-started/mcp) (for example `?project_ref=YOUR_REF`).

**I cannot click through that login for you.** After it is connected, agents in Cursor can use Supabase MCP tools if your client exposes them.

## API tokens (Simon vs Chiara) — recommended approach

These are **not** your Supabase keys. They are **household API tokens** the Edge Function checks on every MCP request so we know whether the caller is Simon or Chiara.

**Recommendation:**

1. Generate two long random secrets (32+ bytes), one per person. Example on macOS:

   ```bash
   openssl rand -base64 32
   ```

   Run it twice; store the outputs in a password manager. Do not commit them.

2. In Supabase, set **Edge Function secrets** (Dashboard → Project Settings → Edge Functions, or CLI secrets), for example:

   - `COMPANION_TOKEN_SIMON` → first secret
   - `COMPANION_TOKEN_CHIARA` → second secret

3. The function maps incoming `Authorization: Bearer <token>` to `simon` or `chiara`. Same URL for both of you; different bearer token per person.

**Rotation:** generate a new secret, update the Edge Function secret, update each client config (Claude connector), deploy if needed, then retire the old secret.

## Country strings — convention for this project

- **Storage:** Use **full English country names** in the database (example: `United Kingdom`), matching `start.md`.
- **Input normalization:** Accept common aliases for the UK and normalize to `United Kingdom` before queries and inserts: `UK`, `U.K.`, `GB`, `Great Britain` (case-insensitive, trimmed). Other countries: trim; optional future map for `USA` / `US` → `United States` if you want consistency.
- **Matching in `days_in_country`:** After normalization, compare with the same canonical string used for presence logic and trip rows.

## MCP “transport” and Claude vs Custom GPT

**MCP** is a protocol: how Claude (or Cursor) talks to a server that exposes tools. For a **remote** connector, the server must speak MCP over **HTTP** (often Streamable HTTP / SSE, depending on client and SDK version). A Supabase Edge Function is a good place to host that HTTP endpoint.

**Claude:** You add a custom MCP / connector pointing at your deployed function URL, with the bearer token for Simon or Chiara.

**Custom GPT:** OpenAI’s Custom GPTs do **not** run MCP. They typically call **plain HTTPS REST** endpoints you define (Actions / OpenAPI). **Plan:** keep the **core logic** (day counting, DB access) in shared TypeScript modules, and add a thin REST layer alongside the MCP layer later so the same rules power a GPT without duplicating business logic.

## GitHub repository

**With `gh` (after `gh auth login`):** from the repo root:

```bash
cd /Users/simon/GitHub/beckerman-companion
gh repo create beckerman-companion --private --source=. --remote=origin --push
```

Adjust visibility (`--public`) or name as you like. If the remote already exists, use `git remote add origin ...` and `git push -u origin main` instead.

**Without `gh`:** on GitHub use **New repository** (no README), then:

```bash
cd /Users/simon/GitHub/beckerman-companion
git remote add origin https://github.com/YOUR_USER/beckerman-companion.git
git push -u origin main
```

## Governing documents

When you add them, place:

- `docs/israel_move_source_of_truth.md`
- `docs/israel_move_year_one_priorities.md`

They are referenced from `start.md` and `.cursorrc`.
