/**
 * Smoke test: unit tests (via npm) + optional live MCP call.
 *
 * Live call (optional):
 *   export COMPANION_TOKEN_SIMON='your-token'
 *   npm run smoke
 *
 * Deletes: remove test rows with notes containing "smoke test" in SQL editor if you used live call.
 */

const defaultUrl =
  'https://yszlwawwlfjrytwcbqpu.supabase.co/functions/v1/margot-mcp'

const mcpUrl = process.env.MCP_URL || defaultUrl

async function expect401WithoutToken() {
  const r = await fetch(mcpUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
    },
    body: '{}',
  })
  const ok = r.status === 401
  const www = r.headers.get('www-authenticate') ?? ''
  const hasPrm = www.toLowerCase().includes('resource_metadata')
  console.log(
    `POST without Authorization: HTTP ${r.status} ${ok ? '(ok)' : '(expected 401)'} www-authenticate resource_metadata=${hasPrm ? 'yes' : 'no'}`,
  )
  if (!ok || !hasPrm) process.exitCode = 1
}

function parseSseJson(text) {
  const lines = text.split('\n')
  for (const line of lines) {
    if (line.startsWith('data:')) {
      const json = line.slice(5).trim()
      try {
        return JSON.parse(json)
      } catch {
        return null
      }
    }
  }
  try {
    return JSON.parse(text)
  } catch {
    return { raw: text }
  }
}

async function callLogTripSmoke() {
  const token = process.env.COMPANION_TOKEN_SIMON
  if (!token) {
    console.log(
      '\nSkip live MCP: set COMPANION_TOKEN_SIMON to run log_trip smoke (see scripts/smoke-mcp.mjs header).',
    )
    return
  }

  const body = {
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/call',
    params: {
      name: 'log_trip',
      arguments: {
        departure_country: 'United Kingdom',
        arrival_country: 'France',
        depart_date: '2030-06-01',
        arrive_date: '2030-06-02',
        notes: 'smoke test (safe to delete in SQL)',
      },
    },
  }

  const r = await fetch(mcpUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  })

  const text = await r.text()
  console.log(`\nLive log_trip: HTTP ${r.status}`)

  if (r.status !== 200) {
    console.log(text.slice(0, 800))
    process.exitCode = 1
    return
  }

  const parsed = parseSseJson(text)
  console.log(JSON.stringify(parsed, null, 2).slice(0, 2500))

  const err =
    parsed?.result?.content?.[0]?.text &&
    JSON.parse(parsed.result.content[0].text).error
  if (err) {
    console.error('Tool returned error:', err)
    process.exitCode = 1
  } else {
    console.log(
      '\nOK. To remove test rows: delete from public.trips where notes like \'%smoke test%\';',
    )
  }
}

async function main() {
  console.log('MCP URL:', mcpUrl)
  await expect401WithoutToken()
  await callLogTripSmoke()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
