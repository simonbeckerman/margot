# Beckerman → “Margot” rename: discovery inventory (read-only)

**Status (Phase 1, April 2026):** The product name in the repository is now **Margot** for titles and the local npm package, and the live Supabase project display name in docs is **`margot`**. The tables below are a **historical** snapshot and were accurate when this document was first written. Do not treat them as a current `grep` of the tree.

**Status (Phase 2, April 2026):** The main GitHub repository is **`simonbeckerman/margot`** (formerly `beckerman-companion`). `origin` should be `https://github.com/simonbeckerman/margot.git`. Historical rows in the tables below may still mention the old repo name.

**Purpose:** Full inventory of where the current product and technical names appear, before scoping a rename. No changes were made in the repo to produce this document.

**Scope strings:** `Beckerman Companion`, `beckerman-companion`, `beckerman-mcp`, `beckerman-companion-oauth`, and `Beckerman` where it refers to the product (not `simonbeckerman` as GitHub username, email, or similar). **Person name** `Simon Beckerman` in the spec is noted but excluded as a product string.

**CLI snapshot:** Commands were run from the development clone on 26 Apr 2026. Production Supabase and GitHub were queried read-only.

---

## A. In-repo documentation (README.md, all `docs/*.md`, any `.md` files anywhere)

### `README.md`

| Line | Exact string (as in file) | Note | Cosmetic vs break |
| ---- | ------------------------- | ---- | ------------------ |
| 1 | `# Beckerman Companion` | Document title (H1) | Cosmetic (human-facing copy) |
| 9 | `https://github.com/simonbeckerman/beckerman-companion` | GitHub repo URL in canonical values table; path segment `beckerman-companion` is the repository name (GitHub user `simonbeckerman` is not a product name) | Breaks if repo renames: links and clone path; not live runtime by itself |
| 10 | `` `beckerman-companion` `` | Supabase project display name in table | **Live:** name used in Supabase (see D); also doc copy |
| 12 (1st) | `` `beckerman-mcp` `` | Label for production Edge function in table | **Live** if you rename the deployed function (see D) |
| 12 (2nd) | `https://yszlwawwlfjrytwcbqpu.supabase.co/functions/v1/beckerman-mcp` | Full production function URL in table | **Live:** this URL must match the deployed function path |
| 13 | `https://simonbeckerman.github.io/beckerman-companion-oauth/oauth-consent.html` | OAuth consent page (GitHub Pages) | **Live:** must match public Pages site and secret `MCP_OAUTH_CONSENT_PAGE_URL` (see D, E) |
| 52 | `` `beckerman-mcp` `` | Instruction to use deployed function | **Live** (same as deployed slug/URL) |
| 87 | `supabase functions deploy beckerman-mcp` | Deploy command; name matches function folder / slug | **Live:** wrong name fails deploy to intended function |
| 102 | `supabase functions deploy beckerman-mcp` | Part of rotation instructions | **Live** (same) |
| 109 | `.../functions/v1/beckerman-mcp` | `curl` example (placeholder `PROJECT_REF`) | **Live** (path is real contract for clients) |
| 112 | `` `beckerman-mcp` `` | Comment after curl | **Live** (documentation of slug) |
| 117 | `https://<ref>.supabase.co/functions/v1/beckerman-mcp` | Note about saving Edge URL; template | **Live** (path) |
| 127 | `` `supabase/functions/beckerman-mcp` `` | Path in git to function sources | In-repo path; break if folder renamed without other updates |
| 127 | `supabase functions deploy beckerman-mcp` | redeploy command | **Live** (slug) |
| 129 | `supabase functions deploy beckerman-mcp` | token rotation, redeploy | **Live** (slug) |

### `docs/SPEC.md`

| Line | Exact string | Note | Cosmetic vs break |
| ---- | ------------ | ---- | ------------------ |
| 1 | `# Beckerman Companion: product and technical specification` | Spec title | Cosmetic |
| 3 | `beckerman-companion` | In backticks, first feature / project id | **Live** insofar as it documents actual project and package naming |
| 3 | `Simon Beckerman` | **Person name** in narrative (“household for Simon Beckerman and Chiara”), not the product name “Beckerman Companion” | Excluded from product rename by rule (surname in legitimate use); no deployed identifier |

### `docs/PROJECT.md`

| Line | Exact string | Note | Cosmetic vs break |
| ---- | ------------ | ---- | ------------------ |
| 1 | `# Beckerman Companion: project handbook` | Title | Cosmetic |
| 19 | `gh repo create beckerman-companion` | `gh` example | Breaks as instructions if GitHub repo name changes |
| 107 | `cd /Users/simon/GitHub/beckerman-companion` | Example path to repo | Cosmetic path (developer machine) |
| 108 | `gh repo create beckerman-companion` | duplicate pattern | same as 19 |
| 116–117 | `beckerman-companion` | `cd` and `git remote` examples | In-repo: clone path and remote repo name in examples |

### `docs/CONNECT.md`

| Line | Exact string | Note | Cosmetic vs break |
| ---- | ------------ | ---- | ------------------ |
| 14 | `cd /path/to/beckerman-companion` | Placeholder path | Cosmetic |
| 15 | `gh repo create beckerman-companion` | `gh` | Repo name in operations |
| 26 | `beckerman-companion` | Suggested **Supabase Dashboard** project name (bold) | **Live** (see D) |
| 31 | `cd /path/to/beckerman-companion` | Placeholder | Cosmetic |
| 40 | `supabase projects create beckerman-companion` | CLI project name | **Live** (new project name; existing project already `beckerman-companion`) |
| 82 | `simonbeckerman/beckerman-companion-oauth` | Markdown link text and public OAuth repo | **Live** (GitHub repo for Pages) |
| 82 | `https://github.com/simonbeckerman/beckerman-companion-oauth` | GitHub URL | **Live** (clone/Pages) |
| 85 | `MCP_OAUTH_CONSENT_PAGE_URL='https://simonbeckerman.github.io/beckerman-companion-oauth/oauth-consent.html'` | Example secret value | **Live:** must match actual Pages URL and `supabase secrets` |
| 95 | `supabase functions deploy beckerman-mcp` | Deploy | **Live** (slug) |
| 101 | `https://YOUR_PROJECT_REF.supabase.co/functions/v1/beckerman-mcp` | Template connector URL | **Live** (path) |
| 107 | `http://127.0.0.1:54321/functions/v1/beckerman-mcp` | Local functions URL | **Live** in local dev (path) |
| 113 | `supabase functions serve beckerman-mcp` | Local serve | **Live** (folder/slug) |
| 129 | `` `Beckerman Companion` `` | Example custom connector “Name” in UI | Cosmetic in Claude |
| 130 | `.../functions/v1/beckerman-mcp` | Connector URL, note “must end with `beckerman-mcp`” | **Live** (Claude and OAuth use this path) |
| 132 | `simonbeckerman/beckerman-companion-oauth` and `...beckerman-companion-oauth/...` | OAuth / Pages (repo + URL) | **Live** |
| 147 | `.../functions/v1/beckerman-mcp` | Debug note for exact connector URL | **Live** |

### `docs/test-results.md`

- No line contains `Beckerman Companion`, `beckerman-companion`, `beckerman-mcp`, or `beckerman-companion-oauth`, nor standalone product “Beckerman” in the title sense.

**A — Summary:** All markdown is narrative and operational except where it encodes the **Supabase project name**, **Edge function slug/path**, **GitHub repo names**, and **GitHub Pages consent URL**; those doc strings must stay consistent with D/E or instructions and clients break.

---

## B. In-repo code and config (TypeScript, JSON, `package.json`, Supabase config, Edge Function source, scripts, `.cursor/rules/*`, other non-`.md`)

| Path | Line | Exact string (representative) | Note | Cosmetic vs break |
| ---- | ---- | ----------------------------- | ---- | ------------------ |
| `package.json` | 2 | `"name": "beckerman-companion"` | npm package name (root) | Mostly cosmetic; any tooling that keys off name would need updating |
| `package-lock.json` | 2 | `"name": "beckerman-companion"` | Lockfile top-level | Cosmetic (stays in sync with `package.json`) |
| `package-lock.json` | 7 | `"name": "beckerman-companion"` | `packages[""].name` | same |
| `supabase/config.toml` | 5 | `project_id = "beckerman-companion"` | Local Supabase project id in CLI | Local/config; not the same as cloud project ref. Changing renames local profile if you re-init; cosmetic for cloud |
| `supabase/config.toml` | 364 | `[functions.beckerman-mcp]` | Function-specific section | **Local dev:** must match function folder name for CLI `serve` / settings |
| `supabase/functions/beckerman-mcp/index.ts` | 72 | `name: 'beckerman-companion'` | `McpServer` server `name` in SDK | Affects protocol metadata; clients may display/cache — treat as **behavioral** if renamed |
| `supabase/functions/beckerman-mcp/index.ts` | 288 | `const app = new Hono().basePath('/beckerman-mcp')` | All HTTP routes including MCP live under this path | **Live:** public URL path segment |
| `supabase/functions/beckerman-mcp/oauth.ts` | 50 | `/.well-known/oauth-protected-resource/beckerman-mcp` | PRM document route; must match `mcpOauth` `PRM_NAME` | **Live:** `resource_metadata` in `WWW-Authenticate` points here |
| `supabase/functions/_shared/mcpOauth.ts` | 10 | `const PRM_NAME = 'beckerman-mcp'` | Protected-resource metadata name segment | **Live:** with `mcpPrmUrl()` and OAuth discovery |
| `supabase/functions/_shared/mcpOauth.ts` | 115 | `` `.../functions/v1/beckerman-mcp` `` | `mcpBaseUrlFromEnv()`: hardcoded function slug in URL | **Live:** `issuer`, `resource`, and OAuth `resource` must match what clients use |
| `supabase/functions/_shared/mcpOauth.ts` | 119 | `` `${...}/.well-known/oauth-protected-resource/${PRM_NAME}` `` | (construction; effective path uses `beckerman-mcp`) | **Live** |
| `supabase/functions/_shared/mcpOauth.ts` | 326, 328 | `Beckerman Companion` in HTML template strings | In-app OAuth form when `MCP_OAUTH_CONSENT_PAGE_URL` is unset and HTML is served (e.g. custom domain) | Cosmetic on that code path; today primary consent is **external** HTML (`docs/oauth-consent.html`) |
| `scripts/e2e-full.mjs` | 12–14 | default `yszlaww...` and `` `.../beckerman-mcp` `` | Default `MCP_URL` / project ref; composes `https://${projectRef}.supabase.co/functions/v1/beckerman-mcp` | **Live** e2e against real endpoint path |
| `scripts/smoke-mcp.mjs` | 12 | `.../v1/beckerman-mcp` | Default smoke URL | **Live** (same) |
| `.cursorrc` | 1 | `# Beckerman Companion: Cursor project context` | Comment / title | Cosmetic |
| `.cursor/rules/beckerman-companion.mdc` | 2 | `description: Beckerman Companion...` | Front matter | Cosmetic for Cursor |
| `.cursor/rules/beckerman-companion.mdc` | 10 | `# Beckerman Companion` | Heading in rules | Cosmetic |
| `.cursor/rules/beckerman-companion.mdc` | 29 | `` `beckerman-mcp` `` | Mentions Edge tool name in MCP token guidance | Cosmetic (but names live slug) |
| `docs/oauth-consent.html` | 6 | `Beckerman Companion — sign in` | Page `<title>` | **User-facing** on GitHub Pages copy |
| `docs/oauth-consent.html` | 17 | `Beckerman Companion` in `<h1>` | **User-facing** (must sync with E) |
| (path) | — | `supabase/functions/beckerman-mcp/` | Directory name: matches deployed function name when deployed from this path | **Live:** `supabase functions deploy` uses folder name; rename = redeploy + URL change |
| (path) | — | `.cursor/rules/beckerman-companion.mdc` | Filename | Cosmetic for Cursor |

Sample JSON for Cursor/Claude (`docs/mcp-claude.sample.json`, `mcp.json.sample`) is listed in **F**.

**B — Summary:** Renaming is not cosmetic where it touches the **URL path** (`/functions/v1/beckerman-mcp`, `/.well-known/.../beckerman-mcp`), **`mcpBaseUrlFromEnv` / OAuth resource**, **Hono `basePath`**, or **deploy/CLI function identity**; all of that would break or require coordinated redeploy and client/secret updates. Package and local `project_id` are lower risk but still part of a rename sweep.

---

## C. Git and GitHub references (remote URLs, repo name, OAuth consent repo name)

| Source | Line / context | Exact string | Note | Cosmetic vs break |
| ------ | -------------- | ------------ | ---- | ------------------ |
| `.git/config` | `remote "origin"`, `url` | `https://github.com/simonbeckerman/beckerman-companion.git` | Current `origin` | **Remote:** `beckerman-companion` is the GitHub repo name; rename repo → update every clone |
| `gh repo view simonbeckerman/beckerman-companion` (read-only) | JSON `name` | `beckerman-companion` | Confirms GitHub repository name (2026-04-26) | **Live** GitHub name |
| Same | `url` | `https://github.com/simonbeckerman/beckerman-companion` | Canonical GitHub web URL | **Live** |
| `gh repo view simonbeckerman/beckerman-companion-oauth` (read-only) | `name` | `beckerman-companion-oauth` | Public OAuth / Pages repository | **Live**; Pages URL is derived (see E) |
| In-repo (e.g. `docs/CONNECT.md`) | — | `simonbeckerman/beckerman-companion-oauth`, `https://github.com/.../beckerman-companion-oauth` | Cross-links to public OAuth repo | **Live** when GitHub renames the repo |
| In-repo | — | `beckerman-companion` as **Git** remote path in examples | e.g. `https://github.com/YOUR_USER/beckerman-companion.git` | Instructional; breaks as docs if you rename the app repo |

**C — Summary:** `origin` and both GitHub repo **names** are live identifiers; changing them requires new remotes, updated docs, and any CI or `gh` automation that still uses the old names.

---

## D. Infrastructure references (Supabase CLI, deployed state)

| Check | Result | What it proves |
| ----- | ------ | -------------- |
| `supabase functions list` (with linked project) | `NAME` and `SLUG` **beckerman-mcp**, `STATUS` **ACTIVE**, `VERSION` **28**, `UPDATED_AT` **2026-04-25 10:21:36** | Production Edge function **slug** is `beckerman-mcp` (must match `.../functions/v1/beckerman-mcp`). |
| `supabase projects list` | Row **LINKED** ●: `REFERENCE ID` **yszlwawwlfjrytwcbqpu**, `NAME` **beckerman-companion** | Supabase project **display name** in the org list is `beckerman-companion` (ref matches README). |
| `supabase status` (local) | **Failed:** `Cannot connect to the Docker daemon` | **No** read of local stack in this run; not used to infer production names. |
| `supabase secrets list --project-ref yszlwawwlfjrytwcbqpu` | Names include: `MCP_OAUTH_CONSENT_PAGE_URL`, `MCP_OAUTH_JWT_SECRET`, `COMPANION_TOKEN_*`, etc. (values are digests only) | The **name** of the consent-URL secret is not product-specific; the **value** of `MCP_OAUTH_CONSENT_PAGE_URL` (not shown) must match the public consent URL. |

**D — Summary:** Production **locks** the strings **`beckerman-mcp`** (function) and **`beckerman-companion`** (project name in dashboard/CLI), plus a secret for the **consent page URL**; changing user-facing or connector URLs without updating the function, `resource`/`issuer` logic, and that secret would **break** Connect and bearer discovery.

---

## E. External dependencies (OAuth consent on GitHub Pages, repo, URLs, and coupling to the Edge function)

| Item | Value | Note |
| ---- | ----- | ---- |
| Public **repo** (from `gh repo view`, 2026-04-26) | **Name:** `beckerman-companion-oauth` — **URL:** `https://github.com/simonbeckerman/beckerman-companion-oauth` | Description on GitHub: *"Public GitHub Pages site for Beckerman Companion MCP OAuth consent"* (product phrase is **in GitHub metadata**, not only in the app repo). |
| Inferred **GitHub Pages** URL (standard user Pages pattern) | `https://simonbeckerman.github.io/beckerman-companion-oauth/` | Path segment is the **repository name** for user-site Pages. |
| **Consent page** in app docs/secret | `https://simonbeckerman.github.io/beckerman-companion-oauth/oauth-consent.html` | Same as README / CONNECT. |
| **Where the app “points”** | `README`, `docs/CONNECT.md`; and Supabase secret **`MCP_OAUTH_CONSENT_PAGE_URL`** (see D) | Edge handler redirects the browser to this **HTTPS** URL with OAuth query parameters. |
| **Does the consent page hardcode the function URL?** | **No** | `docs/oauth-consent.html` reads `resource` from the query string and sets `f.action` to `resource` + `'/oauth/authorize'`. The **MCP / Edge base URL** is not embedded in the static HTML. |

**E — Summary:** The external site is named and hosted under **`beckerman-companion-oauth`**; the repo’s **GitHub description** still says **Beckerman Companion**. A rename to “Margot” would touch **that repo, Pages path, and the `MCP_OAUTH_CONSENT_PAGE_URL` secret**; the static page does not embed the function hostname, but **OAuth** still depends on a consistent **`resource` and issuer** URL in the app.

---

## F. User-facing client configurations (`mcp.json` examples, copy-paste for Claude or Cursor)

| Path | Line | Exact string | Note | Cosmetic vs break |
| ---- | ---- | ------------ | ---- | ------------------ |
| `mcp.json.sample` | 3 | `"beckerman-companion"` | `mcpServers` key: label in Cursor / client UI | **Cosmetic** label only; changing does not by itself break transport |
| `mcp.json.sample` | 5 | `https://yszlwawwlfjrytwcbqpu.supabase.co/functions/v1/beckerman-mcp` | **URL** in sample | **Live:** must match deployed `beckerman-mcp` endpoint; wrong path → connection failure |
| `docs/mcp-claude.sample.json` | 3 | `"beckerman-companion"` | Same as above | same |
| `docs/mcp-claude.sample.json` | 5 | same full URL as `mcp.json.sample` | same | **Live** (same) |

`README` / `docs/CONNECT.md` / `docs/PROJECT.md` also describe the **Claude “Add custom connector”** URL and name (`Beckerman Companion` as example name); those are in **A**.

**F — Summary:** Pasted JSON must be updated on **any machine** that still has the old **URL path**; the server **key** name (`"beckerman-companion"`) is optional branding but often left for clarity.

---

## G. Other

| Item | Note |
| ---- | ---- |
| **Local directory / clone path** | Workspace path is `.../beckerman-companion` (host filesystem). Not in the repo, but shows up in paths and shells. |
| **GitHub user `simonbeckerman` in URLs** | Many URLs include the username. Not treated as a product “Beckerman” reference, but path segments `beckerman-companion` / `beckerman-companion-oauth` still are. |
| **`docs/israel_move_*.md`** | Referenced from README as future files; not present in the tree yet. |
| **Supabase migrations / unit tests** | No `beckerman-*` or “Beckerman” strings in `*.sql` or `tests/*.ts` (grep at discovery time). |
| **`.github` workflows** | None in this repo. |
| **`.env.example`** | No target name strings (`.env` not read for this inventory). |
| **MCP in Cursor (hosted Supabase MCP URL)** | `https://mcp.supabase.com/mcp` in docs — no `beckerman-*` in that URL. |
| **Secret names** | `COMPANION_TOKEN_*` do not include the old product name. |

**G — Summary:** Nothing in **G** blocks a rename on its own; it records out-of-repo paths, excluded username segments, and gaps (future docs).

---

*This file is a one-off shareable briefing. Delete or archive it when the rename project is done.*
