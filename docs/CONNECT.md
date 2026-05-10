# Connect GitHub, Supabase, and clients

Do these steps on your Mac in order. Some steps open a browser (you complete login there).

## 1. GitHub

```bash
gh auth login
```

Finish the browser or device flow. Then create the remote and push (skip if `origin` already exists and has commits):

```bash
cd /path/to/margot
gh repo create margot --public --source=. --remote=origin --push
```

## 2. Supabase account and project

Log the CLI in (browser):

```bash
supabase login
```

Create a project named **margot** in the [Supabase Dashboard](https://supabase.com/dashboard) if you do not have one yet. Copy the **project ref** (short id in the project URL).

Link this repo to the project (include the **database password** you chose when creating the project so the CLI can use the **IPv4 pooler** on networks without IPv6):

```bash
cd /path/to/margot
supabase link --project-ref YOUR_PROJECT_REF -p 'YOUR_DATABASE_PASSWORD'
```

If you already ran `supabase link` without `-p` and `supabase db push` fails with an **IPv6** error, run `supabase link` again with `-p` as above, then `supabase db push`.

You can also create a new project from the CLI (optional):

```bash
supabase projects create margot --org-id YOUR_ORG_ID --db-password 'YOUR_DATABASE_PASSWORD' --region eu-west-2
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

Generate a third secret for **signing OAuth access tokens** (Claude custom connector flow):

```bash
openssl rand -base64 32
```

Set all three on the linked project (remote):

```bash
supabase secrets set \
  COMPANION_TOKEN_SIMON='paste-first-secret' \
  COMPANION_TOKEN_CHIARA='paste-second-secret' \
  MCP_OAUTH_JWT_SECRET='paste-third-secret'
```

For **Claude Connect in the browser**, set the consent page URL (served via GitHub Pages from this public repo):

```bash
supabase secrets set MCP_OAUTH_CONSENT_PAGE_URL='https://simonbeckerman.github.io/margot/docs/oauth-consent.html'
```

Enable GitHub Pages in the repo first: **Settings → Pages → Source: Deploy from a branch → main / (root)**. The URL above should load within a minute. If 404, check that Pages is enabled and the deploy finished.

For **local** `supabase functions serve`, export the same variables in your shell or use an env file your CLI version supports (`supabase functions serve --help`).

## 5. Deploy the MCP Edge Function

```bash
supabase functions deploy margot-mcp
```

Production MCP base URL (replace `YOUR_PROJECT_REF`):

```text
https://YOUR_PROJECT_REF.supabase.co/functions/v1/margot-mcp
```

Local (after `supabase start`):

```text
http://127.0.0.1:54321/functions/v1/margot-mcp
```

Serve locally without JWT verification at the gateway:

```bash
supabase functions serve margot-mcp --no-verify-jwt
```

## 6. Cursor and Supabase MCP (for building, not for Claude)

In **Cursor Settings → Tools & MCP**, add the hosted Supabase MCP (`https://mcp.supabase.com/mcp`) so assistants can use Supabase tools while you work. See [docs/PROJECT.md](PROJECT.md).

## 7. Claude — “Add custom connector” screen

Anthropic’s docs are explicit: [**user-pasted static bearer tokens (`static_bearer`) are not yet supported**](https://claude.com/docs/connectors/building/authentication) for remote MCP in the way people often expect. The optional **OAuth Client ID** / **OAuth Client Secret** fields in **Advanced settings** are for a **confidential OAuth client** registered with an **authorization server** (see the same page: *“Supply [the Client Secret] only if your authorization server requires confidential-client authentication”*). They are **not** where you paste the household `COMPANION_TOKEN_*` value.

This repo implements the **standard MCP OAuth path** Claude uses: unauthenticated MCP requests get **401** with a `WWW-Authenticate` header pointing at [protected-resource metadata](https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization), then the **Connect** browser flow (PKCE + client metadata), then MCP calls with an **OAuth access token**. The one-time browser page on this deployment asks for the **same** per-person **access code** you already store in Supabase (`COMPANION_TOKEN_SIMON` or `COMPANION_TOKEN_CHIARA`).

**Setup (after §4 secrets and §5 deploy):**

1. **Add custom connector**
   - **Name:** e.g. `Margot`
   - **URL:** `https://YOUR_PROJECT_REF.supabase.co/functions/v1/margot-mcp` (must end with `margot-mcp`, not truncated)
2. **Advanced settings:** leave **OAuth Client ID** and **OAuth Client Secret** **empty** (our server advertises PKCE with public client; see [lazy authentication](https://claude.com/docs/connectors/building/lazy-authentication)).
3. **Browser sign-in page:** On the default `*.supabase.co` URL, Supabase rewrites responses so a sign-in form will not render (see [limits](https://supabase.com/docs/guides/functions/limits)). `MCP_OAUTH_CONSENT_PAGE_URL` (set in **§4**) tells the function to redirect to the GitHub Pages consent page instead. The `/oauth/authorize` step redirects there with the same query string; you enter the access code; the page POSTs back to your function.
4. Save, then open the connector and click **Connect**. When the browser asks, sign in with **your** household access code (Simon’s or Chiara’s token — the long secret, not the Supabase dashboard password).

**Other clients (Cursor, scripts):** keep using a static companion token: [mcp-claude.sample.json](mcp-claude.sample.json), [mcp.json.sample](mcp.json.sample), or `Authorization: Bearer` / `?companion_token=` as before.

## 8. Verify in this repo

```bash
npm test
```

## Troubleshooting

- **Connect shows raw HTML source in the browser:** Expected on the default `*.supabase.co` URL ([platform limit](https://supabase.com/docs/guides/functions/limits)). Confirm `MCP_OAUTH_CONSENT_PAGE_URL` is set (§4) and the function is redeployed.
- **401 from the function:** missing or wrong OAuth access token (Claude) or companion token (scripts), or `COMPANION_TOKEN_*` / `MCP_OAUTH_JWT_SECRET` not set on the project you deployed to.
- **Claude never opens Connect / metadata errors:** confirm `MCP_OAUTH_JWT_SECRET` is set, redeploy the function, and that the connector URL is exactly `.../functions/v1/margot-mcp`.
- **`supabase link` fails:** run `supabase login` again; confirm project ref.
- **Migrations:** `supabase db push` requires a linked project; fix any migration errors before deploying the function.
