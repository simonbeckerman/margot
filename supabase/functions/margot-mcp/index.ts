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
const MCP_ICON_DATA_URI =
  'data:image/png;base64,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'

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
    icons: [{ src: MCP_ICON_DATA_URI, mimeType: 'image/png', sizes: ['256x256'] }],
  })

  server.registerTool(
    'log_trip',
    {
      title: 'log_trip',
      description:
        'Add one trip. Dates YYYY-MM-DD. person overrides row subject: only when intentionally logging for the other spouse. Rejects duplicates (same person + depart_date + countries). Without confirm:true returns a preview for user approval; pass confirm:true to insert.',
      inputSchema: z.object({
        person: z.enum(['simon', 'chiara']).optional(),
        departure_country: z.string().min(1),
        arrival_country: z.string().min(1),
        depart_date: z.string(),
        arrive_date: z.string(),
        notes: z.string().optional(),
        confirm: z.boolean().optional(),
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
        const { data: dupes, error: dupErr } = await supabase
          .from('trips')
          .select('id')
          .eq('person', person)
          .eq('depart_date', row.depart_date)
          .eq('departure_country', row.departure_country)
          .eq('arrival_country', row.arrival_country)
          .limit(1)
        if (dupErr) throw dupErr
        if (dupes && dupes.length > 0) {
          throw new Error(
            `Duplicate: ${person} already has a trip on ${row.depart_date} from ${row.departure_country} to ${row.arrival_country} (id: ${dupes[0].id}). Not inserted.`,
          )
        }

        const { data: others, error: listErr } = await supabase
          .from('trips')
          .select('id, depart_date, arrive_date')
          .eq('person', person)
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
              `Date range overlaps another trip (id: ${o.id}). Check both rows for consistency.`,
            )
            break
          }
        }
        if (args.person && args.person !== currentUser) {
          warnings.push(`Logging for "${args.person}" while signed in as "${currentUser}".`)
        }

        if (!args.confirm) {
          return {
            content: [
              {
                type: 'text' as const,
                text: jsonLine({
                  preview: row,
                  warnings: warnings.length > 0 ? warnings : undefined,
                  next: 'Pass confirm:true to insert this trip.',
                }),
              },
            ],
          }
        }

        const { data, error } = await supabase
          .from('trips')
          .insert(row)
          .select()
          .single()
        if (error) throw error
        if (!data) throw new Error('Insert returned no row')

        return {
          content: [
            {
              type: 'text' as const,
              text: jsonLine(warnings.length > 0 ? { ...data, warnings } : data),
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
        'Count days in a country. range: uk_tax_year | calendar_year | custom. person defaults to authenticated user (override only when intentionally querying the spouse). Counts up to today (UTC); future days in days_projected_remaining; range_end capped at today.',
      inputSchema: z.object({
        person: z.enum(['simon', 'chiara']).optional(),
        country: z.string().min(1),
        range: rangeSchema,
      }),
    },
    async (args, extra) => {
      const supabase = serviceSupabase()
      const currentUser = personFromHandlerExtra(extra)
      const person = args.person ?? currentUser
      try {
        const { data, error } = await supabase
          .from('trips')
          .select(
            'id, person, departure_country, arrival_country, depart_date, arrive_date, created_at',
          )
          .eq('person', person)
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
          person,
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

  server.registerTool(
    'list_trips',
    {
      title: 'list_trips',
      description:
        'List logged trips. filter: all | past | future (default all). person defaults to authenticated user.',
      inputSchema: z.object({
        person: z.enum(['simon', 'chiara']).optional(),
        filter: z.enum(['all', 'past', 'future']).optional(),
      }),
    },
    async (args, extra) => {
      const supabase = serviceSupabase()
      const currentUser = personFromHandlerExtra(extra)
      try {
        const person = args.person ?? currentUser
        const today = new Date().toISOString().slice(0, 10)
        const filter = args.filter ?? 'all'

        let q = supabase
          .from('trips')
          .select('id, person, departure_country, arrival_country, depart_date, arrive_date, notes')
          .eq('person', person)

        if (filter === 'past') q = q.lt('arrive_date', today)
        else if (filter === 'future') q = q.gt('depart_date', today)

        q = q.order('depart_date', { ascending: true })

        const { data, error } = await q
        if (error) throw error

        const trips = data ?? []
        return {
          content: [
            { type: 'text' as const, text: jsonLine({ trips, count: trips.length }) },
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
    'delete_trip',
    {
      title: 'delete_trip',
      description:
        'Move a trip to the deleted archive (recoverable via restore_trip). Pass the trip id. person defaults to authenticated user; set only to delete a trip belonging to the other spouse. Without confirm:true returns a preview for user approval; pass confirm:true to delete.',
      inputSchema: z.object({
        id: z.string().uuid(),
        person: z.enum(['simon', 'chiara']).optional(),
        confirm: z.boolean().optional(),
      }),
    },
    async (args, extra) => {
      const supabase = serviceSupabase()
      const currentUser = personFromHandlerExtra(extra)
      try {
        const person = args.person ?? currentUser

        const { data: trip, error: fetchErr } = await supabase
          .from('trips')
          .select('*')
          .eq('id', args.id)
          .single()
        if (fetchErr || !trip) throw new Error(`Trip not found: ${args.id}`)
        if (trip.person !== person) {
          throw new Error(
            `Trip ${args.id} belongs to "${trip.person}", not "${person}". Pass person="${trip.person}" to delete it.`,
          )
        }

        const warnings: string[] = []
        if (args.person && args.person !== currentUser) {
          warnings.push(`Deleting "${trip.person}"'s trip while signed in as "${currentUser}".`)
        }

        if (!args.confirm) {
          return {
            content: [
              {
                type: 'text' as const,
                text: jsonLine({
                  preview: trip,
                  warnings: warnings.length > 0 ? warnings : undefined,
                  next: 'Pass confirm:true to move this trip to the deleted archive.',
                }),
              },
            ],
          }
        }

        const { error: insertErr } = await supabase.from('deleted_trips').insert({
          id: trip.id,
          person: trip.person,
          departure_country: trip.departure_country,
          arrival_country: trip.arrival_country,
          depart_date: trip.depart_date,
          arrive_date: trip.arrive_date,
          notes: trip.notes ?? null,
          created_at: trip.created_at ?? null,
          created_by: trip.created_by ?? null,
          deleted_by: currentUser,
        })
        if (insertErr) throw insertErr

        const { error: deleteErr } = await supabase.from('trips').delete().eq('id', args.id)
        if (deleteErr) throw deleteErr

        return {
          content: [
            {
              type: 'text' as const,
              text: jsonLine(
                warnings.length > 0
                  ? { deleted: trip, warnings }
                  : { deleted: trip },
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
    'edit_trip',
    {
      title: 'edit_trip',
      description:
        'Edit fields on an existing trip. Pass the trip id plus any fields to change (departure_country, arrival_country, depart_date, arrive_date, notes). person defaults to authenticated user. Without confirm:true returns a preview for user approval; pass confirm:true to save.',
      inputSchema: z.object({
        id: z.string().uuid(),
        person: z.enum(['simon', 'chiara']).optional(),
        departure_country: z.string().min(1).optional(),
        arrival_country: z.string().min(1).optional(),
        depart_date: z.string().optional(),
        arrive_date: z.string().optional(),
        notes: z.string().optional(),
        confirm: z.boolean().optional(),
      }),
    },
    async (args, extra) => {
      const supabase = serviceSupabase()
      const currentUser = personFromHandlerExtra(extra)
      try {
        const person = args.person ?? currentUser

        const { data: existing, error: fetchErr } = await supabase
          .from('trips')
          .select('*')
          .eq('id', args.id)
          .single()
        if (fetchErr || !existing) throw new Error(`Trip not found: ${args.id}`)
        if (existing.person !== person) {
          throw new Error(
            `Trip ${args.id} belongs to "${existing.person}", not "${person}". Pass person="${existing.person}" to edit it.`,
          )
        }

        const newDepart = args.depart_date ?? existing.depart_date
        const newArrive = args.arrive_date ?? existing.arrive_date
        if (args.depart_date && !isoDateOk(args.depart_date)) throw new Error('depart_date must be YYYY-MM-DD')
        if (args.arrive_date && !isoDateOk(args.arrive_date)) throw new Error('arrive_date must be YYYY-MM-DD')
        if (newDepart > newArrive) throw new Error('arrive_date must be on or after depart_date')

        const patch: Record<string, unknown> = {}
        if (args.departure_country != null) patch.departure_country = normalizeCountry(args.departure_country)
        if (args.arrival_country != null) patch.arrival_country = normalizeCountry(args.arrival_country)
        if (args.depart_date != null) patch.depart_date = args.depart_date
        if (args.arrive_date != null) patch.arrive_date = args.arrive_date
        if (args.notes != null) patch.notes = args.notes

        if (Object.keys(patch).length === 0) throw new Error('No fields to update were provided.')

        const { data: others, error: listErr } = await supabase
          .from('trips')
          .select('id, depart_date, arrive_date')
          .eq('person', person)
          .neq('id', args.id)
        if (listErr) throw listErr

        const warnings: string[] = []
        for (const o of others ?? []) {
          if (!o.depart_date || !o.arrive_date) continue
          if (
            tripRangesOverlap(
              { depart_date: newDepart, arrive_date: newArrive },
              { depart_date: o.depart_date, arrive_date: o.arrive_date },
            )
          ) {
            warnings.push(`Updated date range overlaps another trip (id: ${o.id}). Check both rows.`)
            break
          }
        }
        if (args.person && args.person !== currentUser) {
          warnings.push(`Editing "${existing.person}"'s trip while signed in as "${currentUser}".`)
        }

        // Build a human-readable diff of what will change
        const changes: Record<string, { from: unknown; to: unknown }> = {}
        for (const key of Object.keys(patch)) {
          changes[key] = { from: existing[key], to: patch[key] }
        }

        if (!args.confirm) {
          return {
            content: [
              {
                type: 'text' as const,
                text: jsonLine({
                  preview: { id: args.id, person, changes },
                  warnings: warnings.length > 0 ? warnings : undefined,
                  next: 'Pass confirm:true to save these changes.',
                }),
              },
            ],
          }
        }

        const { data: updated, error: updateErr } = await supabase
          .from('trips')
          .update(patch)
          .eq('id', args.id)
          .select()
          .single()
        if (updateErr) throw updateErr
        if (!updated) throw new Error('Update returned no row')

        return {
          content: [
            {
              type: 'text' as const,
              text: jsonLine(
                warnings.length > 0
                  ? { updated, was: existing, warnings }
                  : { updated, was: existing },
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
    'restore_trip',
    {
      title: 'restore_trip',
      description: 'Restore a previously deleted trip back to the active trips table. Pass the trip id from deleted_trips.',
      inputSchema: z.object({
        id: z.string().uuid(),
      }),
    },
    async (args, extra) => {
      const supabase = serviceSupabase()
      const currentUser = personFromHandlerExtra(extra)
      try {
        const { data: archived, error: fetchErr } = await supabase
          .from('deleted_trips')
          .select('*')
          .eq('id', args.id)
          .single()
        if (fetchErr || !archived) throw new Error(`No deleted trip found with id: ${args.id}`)

        const { data: conflict } = await supabase
          .from('trips')
          .select('id')
          .eq('id', args.id)
          .single()
        if (conflict) throw new Error(`A trip with id ${args.id} already exists in trips.`)

        const { error: insertErr } = await supabase.from('trips').insert({
          id: archived.id,
          person: archived.person,
          departure_country: archived.departure_country,
          arrival_country: archived.arrival_country,
          depart_date: archived.depart_date,
          arrive_date: archived.arrive_date,
          notes: archived.notes ?? null,
          created_at: archived.created_at ?? null,
          created_by: archived.created_by ?? currentUser,
        })
        if (insertErr) throw insertErr

        const { error: deleteErr } = await supabase.from('deleted_trips').delete().eq('id', args.id)
        if (deleteErr) throw deleteErr

        return {
          content: [
            {
              type: 'text' as const,
              text: jsonLine({ restored: archived, restored_by: currentUser }),
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
