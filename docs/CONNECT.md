# Connect GitHub, Supabase, and clients

Do these steps on your Mac in order. Some steps open a browser (you complete login there).

## 1. GitHub

```bash
gh auth login
```

Finish the browser or device flow. Then create the remote and push (skip if `origin` already exists and has commits):

```bash
cd /path/to/beckerman-companion
gh repo create beckerman-companion --private --source=. --remote=origin --push
```

## 2. Supabase account and project

Log the CLI in (browser):

```bash
supabase login
```

Create a project named **beckerman-companion** in the [Supabase Dashboard](https://supabase.com/dashboard) if you do not have one yet. Copy the **project ref** (short id in the project URL).

Link this repo to the project:

```bash
cd /path/to/beckerman-companion
supabase link --project-ref YOUR_PROJECT_REF
```

## 3. Database migrations

Apply the `trips` table and RLS to the remote database:

```bash
supabase db push
```

For local Docker-based development instead:

```bash
supabase start
# optional: supabase db reset
```

## 4. Household bearer tokens (Edge Function)

Generate two secrets and store them in a password manager:

```bash
openssl rand -base64 32
openssl rand -base64 32
```

Set them on the linked project (remote):

```bash
supabase secrets set COMPANION_TOKEN_SIMON='paste-first-secret' COMPANION_TOKEN_CHIARA='paste-second-secret'
```

For **local** `supabase functions serve`, export the same variables in your shell or use an env file your CLI version supports (`supabase functions serve --help`).

## 5. Deploy the MCP Edge Function

```bash
supabase functions deploy beckerman-mcp
```

Production MCP base URL (replace `YOUR_PROJECT_REF`):

```text
https://YOUR_PROJECT_REF.supabase.co/functions/v1/beckerman-mcp
```

Local (after `supabase start`):

```text
http://127.0.0.1:54321/functions/v1/beckerman-mcp
```

Serve locally without JWT verification at the gateway:

```bash
supabase functions serve beckerman-mcp --no-verify-jwt
```

## 6. Cursor and Supabase MCP (for building, not for Claude)

In **Cursor Settings → Tools & MCP**, add the hosted Supabase MCP (`https://mcp.supabase.com/mcp`) so assistants can use Supabase tools while you work. See [docs/PROJECT.md](PROJECT.md).

## 7. Claude (household MCP)

Use the sample in [mcp-claude.sample.json](mcp-claude.sample.json): set your project ref and put **Simon** or **Chiara** token in `Authorization`. Exact file location depends on the Claude app (Desktop vs web); follow Anthropic’s current MCP connector docs.

## 8. Verify in this repo

```bash
npm test
```

## Troubleshooting

- **401 from the function:** bearer token missing, wrong, or secrets not set on the project you deployed to.
- **`supabase link` fails:** run `supabase login` again; confirm project ref.
- **Migrations:** `supabase db push` requires a linked project; fix any migration errors before deploying the function.
