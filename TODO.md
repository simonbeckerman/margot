# Margot: TODO

Lightweight backlog of feature ideas and known issues. Not a spec. Items here are candidates, not commitments. Apply the year-one priorities doc and the "push back before building" rule before acting on any of them.

## Features


### days_in_country: default person to authenticated user

Currently `days_in_country` requires `person` as an input, with no default. This means Claude has to ask "Simon or Chiara?" even when the user's bearer token already identifies them. `log_trip` already defaults to the authenticated user. Apply the same pattern to `days_in_country`. Allow override so Simon can still query Chiara's days and vice versa.

### make the GitHub OAuth token page prettier

Improve the visual design of the GitHub-hosted OAuth consent page (`oauth-consent.html`) where the household access code is entered. Keep behavior the same, focus on layout and styling so it feels cleaner and easier to use.

## Issues

## Pending external

### Custom connector icon

The MCP server returns a custom icon (placeholder PNG, data URI) per the MCP protocol icon spec. Claude's UI does not currently render custom connector icons. Plumbing is in place; when Claude's UI catches up, the icon will appear automatically. Replace the placeholder with a real icon design at any time by updating `MCP_ICON_DATA_URI` in `supabase/functions/margot-mcp/index.ts` and redeploying.
