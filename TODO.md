# Margot: TODO

Lightweight backlog of feature ideas and known issues. Not a spec. Items here are candidates, not commitments. Apply the year-one priorities doc and the "push back before building" rule before acting on any of them.

## Features

### edit_trip and delete_trip MCP tools

Today fixing or removing a trip means going to the Supabase dashboard. Worth adding `edit_trip` (change dates, countries, notes on an existing id) and `delete_trip` (remove by id) when this becomes a regular need. Delete is the riskier of the two: an agent hallucinating an id could remove a real trip. Consider requiring the user to confirm the row first (e.g. quote the depart_date back) before executing.

### make the GitHub OAuth token page prettier

Improve the visual design of the GitHub-hosted OAuth consent page (`oauth-consent.html`) where the household access code is entered. Keep behavior the same, focus on layout and styling so it feels cleaner and easier to use.

## Issues

## Pending external

### Custom connector icon

The MCP server returns a custom icon (placeholder PNG, data URI) per the MCP protocol icon spec. Claude's UI does not currently render custom connector icons. Plumbing is in place; when Claude's UI catches up, the icon will appear automatically. Replace the placeholder with a real icon design at any time by updating `MCP_ICON_DATA_URI` in `supabase/functions/margot-mcp/index.ts` and redeploying.
