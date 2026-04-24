/**
 * End-to-end test: unit tests, rotate companion tokens, real MCP calls, delete test rows.
 * Run: node scripts/e2e-full.mjs
 * Requires: supabase CLI on PATH, logged in, project linked, network.
 * After run: new Simon and Chiara tokens are printed; update password manager and Claude.
 */

import { execFileSync, spawnSync } from 'node:child_process'
import { randomInt } from 'node:crypto'
import process from 'node:process'

const projectRef = process.env.SUPABASE_PROJECT_REF || 'yszlwawwlfjrytwcbqpu'
const mcpUrl = process.env.MCP_URL ||
  `https://${projectRef}.supabase.co/functions/v1/beckerman-mcp`

const supabaseBin = process.env.SUPABASE_BIN || 'supabase'

function runNpmTest() {
  const r = spawnSync('npm', ['test'], { stdio: 'inherit', cwd: process.cwd() })
  if (r.status !== 0) process.exit(r.status ?? 1)
}

function setSecrets(simon, chiara) {
  execFileSync(
    supabaseBin,
    [
      'secrets',
      'set',
      `COMPANION_TOKEN_SIMON=${simon}`,
      `COMPANION_TOKEN_CHIARA=${chiara}`,
      '--project-ref',
      projectRef,
    ],
    { stdio: 'inherit' },
  )
}

async function mcpCall(token, name, args) {
  const id = randomInt(1, 1e9)
  const res = await fetch(mcpUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id,
      method: 'tools/call',
      params: { name, arguments: args },
    }),
  })
  const text = await res.text()
  if (res.status !== 200) {
    throw new Error(`MCP ${res.status}: ${text.slice(0, 500)}`)
  }
  const dataLine = text.split('\n').find((l) => l.startsWith('data: '))
  if (!dataLine) throw new Error(`No data line: ${text.slice(0, 400)}`)
  return JSON.parse(dataLine.slice(6))
}

function parseToolJson(payload) {
  const raw = payload?.result?.content?.[0]?.text
  if (!raw) return { rawPayload: payload }
  try {
    return JSON.parse(raw)
  } catch {
    return { parseError: true, raw }
  }
}

function dbQueryLinked(sql) {
  return execFileSync(supabaseBin, ['db', 'query', '--linked', sql], {
    encoding: 'utf8',
  })
}

function parseQueryRows(jsonText) {
  const start = jsonText.indexOf('{')
  if (start === -1) return null
  let depth = 0
  for (let i = start; i < jsonText.length; i++) {
    const c = jsonText[i]
    if (c === '{') depth++
    if (c === '}') {
      depth--
      if (depth === 0) {
        try {
          return JSON.parse(jsonText.slice(start, i + 1))
        } catch {
          return null
        }
      }
    }
  }
  return null
}

async function main() {
  console.log('== 1) Unit tests ==\n')
  runNpmTest()

  const simon = execFileSync('openssl', ['rand', '-base64', '32'], {
    encoding: 'utf8',
  }).trim()
  const chiara = execFileSync('openssl', ['rand', '-base64', '32'], {
    encoding: 'utf8',
  }).trim()

  console.log('\n== 2) Rotate Edge secrets (companion tokens) ==\n')
  setSecrets(simon, chiara)

  const note = 'e2e-agent automated test'

  console.log('\n== 3) MCP: Simon logs UK to France (2030) ==\n')
  const a = parseToolJson(
    await mcpCall(simon, 'log_trip', {
      departure_country: 'United Kingdom',
      arrival_country: 'France',
      depart_date: '2030-06-10',
      arrive_date: '2030-06-11',
      notes: note,
    }),
  )
  if (a.error) throw new Error(a.error)
  console.log('Inserted trip id', a.id)

  console.log('\n== 4) MCP: Simon logs for Chiara (return trip) ==\n')
  const b = parseToolJson(
    await mcpCall(simon, 'log_trip', {
      person: 'chiara',
      departure_country: 'France',
      arrival_country: 'United Kingdom',
      depart_date: '2030-08-20',
      arrive_date: '2030-08-21',
      notes: note,
    }),
  )
  if (b.error) throw new Error(b.error)
  console.log('Inserted trip id', b.id, 'created_by', b.created_by)

  console.log("\n== 5) MCP: days_in_country UK (custom 2030) Simon ==\n")
  const uk = parseToolJson(
    await mcpCall(simon, 'days_in_country', {
      person: 'simon',
      country: 'United Kingdom',
      range: { type: 'custom', start: '2030-01-01', end: '2030-12-31' },
    }),
  )
  if (uk.error) throw new Error(uk.error)
  console.log(JSON.stringify(uk, null, 2).slice(0, 1200))

  console.log("\n== 6) MCP: days_in_country France Chiara (2030) ==\n")
  const fr = parseToolJson(
    await mcpCall(chiara, 'days_in_country', {
      person: 'chiara',
      country: 'France',
      range: { type: 'calendar_year', year: 2030 },
    }),
  )
  if (fr.error) throw new Error(fr.error)
  console.log(JSON.stringify(fr, null, 2).slice(0, 1200))

  console.log('\n== 7) Delete all e2e test rows (SQL) ==\n')
  const delSql =
    "delete from public.trips where notes is not null and notes ilike 'e2e%';"
  console.log(dbQueryLinked(delSql).slice(0, 500))

  console.log('\n== 8) Verify no e2e rows left ==\n')
  const leftOut = dbQueryLinked(
    "select count(*)::int as n from public.trips where notes is not null and notes ilike 'e2e%';",
  )
  console.log(leftOut.slice(0, 500))
  const parsed = parseQueryRows(leftOut)
  const n = parsed?.rows?.[0]?.n
  if (n === 0) {
    console.log('OK: 0 e2e rows remain.')
  } else {
    console.warn('Unexpected e2e count:', n, parsed)
  }

  console.log(
    '\n--- SAVE THESE (replace old Simon and Chiara tokens in vault and Claude) ---\n',
  )
  console.log('COMPANION_TOKEN_SIMON=' + simon)
  console.log('COMPANION_TOKEN_CHIARA=' + chiara)
  console.log('\nMCP URL: ' + mcpUrl + '\n')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
