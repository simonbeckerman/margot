import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

import { McpServer } from 'npm:@modelcontextprotocol/sdk@1.25.3/server/mcp.js'
import { WebStandardStreamableHTTPServerTransport } from 'npm:@modelcontextprotocol/sdk@1.25.3/server/webStandardStreamableHttp.js'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { Hono } from 'npm:hono@^4.9.7'
import { z } from 'npm:zod@^4.1.13'

import { userFromBearer } from '../_shared/auth.ts'
import {
  countDaysInCountry,
  type Person,
  type RangeInput,
  type TripRow,
} from '../_shared/counting.ts'
import { normalizeCountry } from '../_shared/country.ts'

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

function createMcpServer(
  currentUser: Person,
  supabase: ReturnType<typeof createClient>,
): McpServer {
  const server = new McpServer({
    name: 'beckerman-companion',
    version: '0.1.0',
  })

  server.registerTool(
    'log_trip',
    {
      title: 'Log trip',
      description:
        'Record a country transition. person defaults to the caller; created_by is always the caller.',
      inputSchema: z.object({
        person: z.enum(['simon', 'chiara']).optional(),
        departure_country: z.string().min(1),
        arrival_country: z.string().min(1),
        depart_date: z.string(),
        arrive_date: z.string(),
        notes: z.string().optional(),
      }),
    },
    async (args) => {
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
        return {
          content: [
            { type: 'text' as const, text: JSON.stringify(data, null, 2) },
          ],
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ error: msg }) }],
          isError: true,
        }
      }
    },
  )

  server.registerTool(
    'days_in_country',
    {
      title: 'Days in country',
      description:
        'Count days in a country for a person over a range (UK midnight rule vs inclusive presence).',
      inputSchema: z.object({
        person: z.enum(['simon', 'chiara']),
        country: z.string().min(1),
        range: rangeSchema,
      }),
    },
    async (args) => {
      try {
        const { data, error } = await supabase
          .from('trips')
          .select(
            'id, person, departure_country, arrival_country, depart_date, arrive_date',
          )
          .eq('person', args.person)
          .order('arrive_date', { ascending: true })
          .order('depart_date', { ascending: true })
          .order('id', { ascending: true })
        if (error) throw error
        const trips: TripRow[] = (data ?? []).map((r) => ({
          id: r.id as string,
          person: r.person as Person,
          departure_country: r.departure_country as string,
          arrival_country: r.arrival_country as string,
          depart_date: r.depart_date as string,
          arrive_date: r.arrive_date as string,
        }))
        const result = countDaysInCountry(
          args.person,
          args.country,
          args.range as RangeInput,
          trips,
        )
        return {
          content: [
            { type: 'text' as const, text: JSON.stringify(result, null, 2) },
          ],
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ error: msg }) }],
          isError: true,
        }
      }
    },
  )

  return server
}

const app = new Hono().basePath('/beckerman-mcp')

app.all('*', async (c) => {
  const user = userFromBearer(c.req.header('Authorization'))
  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceKey) {
    return c.json({ error: 'Missing Supabase environment' }, 500)
  }

  const supabase = createClient(supabaseUrl, serviceKey)
  const server = createMcpServer(user, supabase)
  const transport = new WebStandardStreamableHTTPServerTransport()
  await server.connect(transport)
  return transport.handleRequest(c.req.raw)
})

Deno.serve(app.fetch)
