# Margot: agent context

Household tool for **Simon and Chiara**. Current scope is travel-day tracking for UK Statutory Residence Test day counts only. The owner is **not** a developer.

## Read first

- [README.md](README.md): operations index for humans.
- [docs/SPEC.md](docs/SPEC.md): schema, MCP tools, counting logic, deliverables.
- [docs/PROJECT.md](docs/PROJECT.md): setup, CLI vs MCP, tokens, GitHub workflow.
- [docs/CONNECT.md](docs/CONNECT.md): GitHub, Supabase, deploy, Claude connector.
- [docs/test-results.md](docs/test-results.md): one-line "what we did" / "expected result" for every check.
- When present: `docs/israel_move_source_of_truth.md` and `docs/israel_move_year_one_priorities.md` before any large change.

The same rules also live in [.cursor/rules/margot.mdc](.cursor/rules/margot.mdc) for Cursor users. If you edit one, edit both, or prune the other.

## Purpose (why this exists)

To prevent bad outcomes during a UK to Israel move: accidental UK tax residence, lost advisor context, decisions made twice because the first answer was forgotten. It stores facts, does arithmetic, and remembers things. **It is not an advisor and never generates tax advice.** When evaluating any change, ask whether it serves this purpose for two specific users, Simon and Chiara. If it does not, push back.

## Audience

The owner is a product manager, not a software expert. Use **plain language**, **short steps**, and avoid jargon unless it helps. If a technical term is needed, add a one-line plain explanation. Favour what they can do next over theory.

## Push back before building

Default to challenging requests before implementing them. If a request would add complexity beyond what two users need, say so before building. If a task implies adding a new tool, table, column, or dependency not specified in the request, ask first. If a request seems to violate the year-one priorities (robustness over optimisation, reversibility, avoid premature structures), name the conflict and wait for confirmation. **Agreement is not the default.** The user is paying attention to this project precisely because they want push-back.

## Simplicity discipline

Margot is small and must stay small. Resist code bloat, unused abstractions, defensive code for impossible cases, and complexity creep over time.

- Before reporting a task done: review what was added. Any abstraction not directly required by the task is justified in one line or removed.
- In the closing message: give a two-line diff summary of files touched and what changed in principle. No detail dump.
- On request ("fai un audit", "audit Margot"): sweep the repo for dead code, unused functions, abstractions that do not earn their keep, error handling for impossible cases. Report a list; do not act on it without confirmation.
- On request ("semplifica", "is this overcomplicated"): go back to the most recent change and trim. Do not defend complexity that does not have a real need today.

## Decision principle

Choose what is **best for the product and long-term maintenance**: correct behavior, clear operations, a normal professional workflow. That includes integrations (GitHub, Supabase, MCP, CLIs).

Do not replace the best approach with a weaker shortcut just because an agent cannot finish every step alone (browser login, OAuth, pasting a token). Say clearly what must happen on the user's side, then keep the plan aligned with best practice.

## Writing principle

What cannot be said in few words cannot be said in many. Prefer a short, clear line over a long one. If an idea is still muddy after a short pass, make it short again before you add more.

## Technical constraints

- Supabase for database and hosting. MCP server deploys as a Supabase Edge Function. **Not Vercel.**
- TypeScript throughout. Use the official MCP SDK.
- Out of scope unless explicitly requested: advisor memory, vectors, web UI, deeming-day logic, email ingestion. Use TODO comments instead of building.
- **Internal tool for two people.** Avoid SaaS-grade infrastructure: caching, rate limiting, audit logs, retry layers, debug logging, fancy error taxonomies, granular permissions. If a feature would be table stakes for a commercial product, it is almost certainly wrong for Margot.

## MCP and Claude (context size)

The Edge `margot-mcp` tool stays **tight** for the assistant: short tool `title` and `description` strings, **one-line** JSON in tool result text, no large optional fields in responses (the trip id list is dropped on `days_in_country`; the shared module still computes it for tests). Every token in tool metadata is paid on every turn that lists tools to the model.

## Testing

- Local checks first (Vitest on the counting module), then a light live check (`npm run smoke`), then full path that matches real use (`npm run e2e`). See [docs/test-results.md](docs/test-results.md).
- If a test writes to the real database, **remove those rows afterwards** (or use clearly marked test data in the far future plus a final delete, like the e2e script). The main store should not keep leftover test travel lines.

## Git workflow

When the user asks to **commit**, **push**, or **commit and push** (or similar), run `git` in this repo yourself: stage sensible paths, commit with a clear message, and push to `origin` when they asked for push. Do not hand the user a list of git commands unless a push fails (missing `origin`, auth). If auth failed once, tell them the one-time fix, then keep using this workflow afterward.

## Style

- **No em dashes** in code comments, [README.md](README.md), or markdown under `docs/`. Use a colon, hyphen, or sentence break instead.
- Sparse comments. Explain *why*, not *what*.
- Counting logic for `days_in_country` must stay clear and well tested. Favour clarity over cleverness; it will be read often.
