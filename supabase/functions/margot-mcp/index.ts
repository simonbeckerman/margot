import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

import { McpServer } from 'npm:@modelcontextprotocol/sdk@1.25.3/server/mcp.js'
import { WebStandardStreamableHTTPServerTransport } from 'npm:@modelcontextprotocol/sdk@1.25.3/server/webStandardStreamableHttp.js'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { Hono } from 'npm:hono@^4.9.7'
import { z } from 'npm:zod@^4.1.13'

import { resolveUserFromRequest } from '../_shared/auth.ts'
import { mcpPrmUrl } from '../_shared/mcpOauth.ts'
import { registerOAuthRoutes } from './oauth.ts'
import {
  countDaysInCountry,
  type Person,
  type RangeInput,
  type TripRow,
} from '../_shared/counting.ts'
import { normalizeCountry } from '../_shared/country.ts'
import { tripRangesOverlap } from '../_shared/tripOverlap.ts'

const rangeSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('uk_tax_year'), year: z.number().int() }),
  z.object({ type: z.literal('calendar_year'), year: z.number().int() }),
  z.object({
    type: z.literal('custom'),
    start: z.string(),
    end: z.string(),
  }),
])

function isoDateOk(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s)
}

/** One-line JSON for MCP: fewer tokens back to the client. */
function jsonLine(value: unknown): string {
  return JSON.stringify(value)
}

const MCP_OAUTH_SCOPE = 'companion'

/**
 * The MCP `Protocol` dispatches request handlers with `Promise.resolve().then(…)`,
 * so `AsyncLocalStorage` does not reliably propagate to `tools/call` in Deno Edge.
 * The stream transport support passing per-request `authInfo` into `onmessage` / tool
 * `extra` (see @modelcontextprotocol/sdk `AuthInfo.extra` and `HandleRequestOptions`).
 */
type ToolRequestExtra = {
  authInfo?: { extra?: { householdUser?: Person } }
}

function personFromHandlerExtra(extra: unknown): Person {
  const p = (extra as ToolRequestExtra | undefined)?.authInfo?.extra?.householdUser
  if (p === 'simon' || p === 'chiara') return p
  throw new Error('Internal: tool missing authInfo.extra.householdUser')
}

let _serviceSupabase: ReturnType<typeof createClient> | null = null
function serviceSupabase(): ReturnType<typeof createClient> {
  if (_serviceSupabase) return _serviceSupabase
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  if (!supabaseUrl || !serviceKey) {
    throw new Error('Missing Supabase service environment')
  }
  _serviceSupabase = createClient(supabaseUrl, serviceKey)
  return _serviceSupabase
}

function buildMcpServer(): McpServer {
  const server = new McpServer({
    name: 'margot',
    version: '0.1.0',
  })

  server.registerTool(
    'log_trip',
    {
      title: 'log_trip',
      description:
        'Add one trip. Dates YYYY-MM-DD. person overrides row subject: only when intentionally logging for the other spouse.',
      inputSchema: z.object({
        person: z.enum(['simon', 'chiara']).optional(),
        departure_country: z.string().min(1),
        arrival_country: z.string().min(1),
        depart_date: z.string(),
        arrive_date: z.string(),
        notes: z.string().optional(),
      }),
    },
    async (args, extra) => {
      const supabase = serviceSupabase()
      const currentUser = personFromHandlerExtra(extra)
      try {
        if (!isoDateOk(args.depart_date) || !isoDateOk(args.arrive_date)) {
          throw new Error('depart_date and arrive_date must be YYYY-MM-DD')
        }
        if (args.depart_date > args.arrive_date) {
          throw new Error('arrive_date must be on or after depart_date')
        }
        const person = args.person ?? currentUser
        const row = {
          person,
          departure_country: normalizeCountry(args.departure_country),
          arrival_country: normalizeCountry(args.arrival_country),
          depart_date: args.depart_date,
          arrive_date: args.arrive_date,
          notes: args.notes ?? null,
          created_by: currentUser,
        }
        const { data, error } = await supabase
          .from('trips')
          .insert(row)
          .select()
          .single()
        if (error) throw error
        if (!data) throw new Error('Insert returned no row')

        const { data: others, error: listErr } = await supabase
          .from('trips')
          .select('id, depart_date, arrive_date')
          .eq('person', person)
          .neq('id', data.id)
        if (listErr) throw listErr

        const warnings: string[] = []
        for (const o of others ?? []) {
          if (!o.depart_date || !o.arrive_date) continue
          if (
            tripRangesOverlap(
              { depart_date: row.depart_date, arrive_date: row.arrive_date },
              { depart_date: o.depart_date, arrive_date: o.arrive_date },
            )
          ) {
            warnings.push(
              `This trip's date range overlaps another trip (id: ${o.id}). Check both rows for consistency.`,
            )
            break
          }
        }
        if (args.person && args.person !== currentUser) {
          warnings.push(
            `You logged for "${args.person}" while signed in as "${currentUser}" (see created_by in the row).`,
          )
        }

        return {
          content: [
            {
              type: 'text' as const,
              text: jsonLine(
                warnings.length > 0 ? { ...data, warnings } : data,
              ),
            },
          ],
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        return {
          content: [{ type: 'text' as const, text: jsonLine({ error: msg }) }],
          isError: true,
        }
      }
    },
  )

  server.registerTool(
    'days_in_country',
    {
      title: 'days_in_country',
      description:
        'Count days in a country. range: uk_tax_year | calendar_year | custom. Counts up to today (server UTC); future days appear as days_projected_remaining and range_end is capped at today.',
      inputSchema: z.object({
        person: z.enum(['simon', 'chiara']),
        country: z.string().min(1),
        range: rangeSchema,
      }),
    },
    async (args) => {
      // days_in_country: person comes from tool args; auth still validated at HTTP layer.
      const supabase = serviceSupabase()
      try {
        const { data, error } = await supabase
          .from('trips')
          .select(
            'id, person, departure_country, arrival_country, depart_date, arrive_date, created_at',
          )
          .eq('person', args.person)
          .order('arrive_date', { ascending: true })
          .order('depart_date', { ascending: true })
          .order('id', { ascending: true })
        if (error) throw error
        for (const r of data ?? []) {
          if (
            r.id == null ||
            r.person == null ||
            r.departure_country == null ||
            r.arrival_country == null ||
            r.depart_date == null ||
            r.arrive_date == null
          ) {
            throw new Error(
              'A trip row in the database is missing required fields. Fix or delete that row, then retry.',
            )
          }
        }
        const trips: TripRow[] = (data ?? []).map((r) => ({
          id: r.id as string,
          person: r.person as Person,
          departure_country: r.departure_country as string,
          arrival_country: r.arrival_country as string,
          depart_date: r.depart_date as string,
          arrive_date: r.arrive_date as string,
          created_at: (r as { created_at?: string | null }).created_at ?? undefined,
        }))
        // Server-side UTC today: keeps days_in_country honest about future days
        // (see docs/SPEC.md "Counting logic"; no timezone work, accepted near-midnight fuzziness).
        const today = new Date().toISOString().slice(0, 10)
        const result = countDaysInCountry(
          args.person,
          args.country,
          args.range as RangeInput,
          trips,
          undefined,
          today,
        )
        // Omit trip id list: large on busy years, not needed in Claude context.
        const { trips_considered: _ids, ...compact } = result
        return {
          content: [
            { type: 'text' as const, text: jsonLine(compact) },
          ],
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        return {
          content: [{ type: 'text' as const, text: jsonLine({ error: msg }) }],
          isError: true,
        }
      }
    },
  )

  return server
}

const mcpServer = buildMcpServer()
const mcpTransport = new WebStandardStreamableHTTPServerTransport()
let mcpConnectOnce: Promise<void> | null = null
function ensureMcpTransportConnected(): Promise<void> {
  if (!mcpConnectOnce) {
    mcpConnectOnce = mcpServer.connect(mcpTransport)
  }
  return mcpConnectOnce
}

/**
 * @modelcontextprotocol/sdk Streamable HTTP requires POST Accept to name both
 * `application/json` and `text/event-stream`. Some clients (e.g. hosted Claude) omit
 * one of them, which makes the transport return 406 and appear as a generic
 * "authorization" failure. Ensure both are present without dropping other accepted types.
 */
function mcpRequestForStreamableHttp(req: Request, url: string): Request {
  const headers = new Headers(req.headers)
  if (req.method === 'POST') {
    const a = headers.get('Accept') ?? ''
    if (!a.includes('application/json') || !a.includes('text/event-stream')) {
      const merged = a
        ? `${a}, application/json, text/event-stream`
        : 'application/json, text/event-stream'
      headers.set('Accept', merged)
    }
  } else if (req.method === 'GET') {
    const a = headers.get('Accept') ?? ''
    if (!a.includes('text/event-stream')) {
      headers.set('Accept', a ? `${a}, text/event-stream` : 'text/event-stream')
    }
  }
  const hasBody = !['GET', 'HEAD'].includes(req.method) && req.body != null
  return new Request(url, {
    method: req.method,
    headers,
    body: hasBody ? req.body : undefined,
    ...(hasBody ? { duplex: 'half' as const } : {}),
  })
}

const app = new Hono().basePath('/margot-mcp')
registerOAuthRoutes(app)

app.all('*', async (c) => {
  const path = new URL(c.req.url).pathname
  const user = await resolveUserFromRequest(c.req.raw)
  if (!user) {
    const auth = c.req.header('Authorization')
    // No secrets: only whether a bearer or JWT shape was present (Supabase log diagnosis).
    console.error(
      JSON.stringify({
        mcp: 'unauthorized',
        method: c.req.method,
        path,
        hasAuthorization: !!auth,
        bearerCharLength: auth?.startsWith('Bearer ') ? auth.slice(7).trim().length : 0,
        looksLikeJwt: auth ? auth.slice(7).trim().split('.').length === 3 : false,
      }),
    )
    // Claude “custom connector” requires WWW-Authenticate + resource_metadata
    // (MCP protected-resource metadata; not static_bearer in the Advanced fields).
    const prm = mcpPrmUrl()
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: {
        'Content-Type': 'application/json',
        'WWW-Authenticate': `Bearer error="invalid_token", resource_metadata="${prm}"`,
      },
    })
  }

  if (!Deno.env.get('SUPABASE_URL') || !Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')) {
    return c.json({ error: 'Missing Supabase environment' }, 500)
  }

  try {
    await ensureMcpTransportConnected()
  } catch (e) {
    console.error(e)
    return c.json({ error: 'MCP server failed to start' }, 500)
  }

  // Drop query token from the URL so the token is not echoed in downstream logs.
  const u = new URL(c.req.url)
  u.searchParams.delete('companion_token')
  u.searchParams.delete('token')
  const forward = mcpRequestForStreamableHttp(c.req.raw.clone(), u.toString())
  const authHeader = c.req.raw.headers.get('Authorization') ?? ''
  const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : ''
  try {
    const res = await mcpTransport.handleRequest(forward, {
      authInfo: {
        token: bearer || 'companion',
        clientId: 'mcp',
        scopes: [MCP_OAUTH_SCOPE],
        extra: { householdUser: user },
      },
    })
    console.error(
      JSON.stringify({
        mcp: 'ok',
        method: c.req.method,
        path,
        user,
        responseStatus: res.status,
        responseContentType: res.headers.get('content-type') ?? '',
      }),
    )
    return res
  } catch (e) {
    console.error(
      JSON.stringify({
        mcp: 'handleRequest_error',
        method: c.req.method,
        path,
        user,
        err: e instanceof Error ? e.message : String(e),
      }),
    )
    throw e
  }
})

Deno.serve(app.fetch)
