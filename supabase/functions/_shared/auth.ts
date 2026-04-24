/** Map Authorization bearer to household user (docs/SPEC.md). */

export type HouseholdUser = 'simon' | 'chiara'

export function userFromBearer(
  authorization: string | undefined,
): HouseholdUser | null {
  if (!authorization?.startsWith('Bearer ')) return null
  const token = authorization.slice('Bearer '.length).trim()
  if (!token) return null

  const simon = Deno.env.get('COMPANION_TOKEN_SIMON')
  const chiara = Deno.env.get('COMPANION_TOKEN_CHIARA')
  if (!simon || !chiara) {
    console.error('Missing COMPANION_TOKEN_SIMON or COMPANION_TOKEN_CHIARA')
    return null
  }
  if (token === simon) return 'simon'
  if (token === chiara) return 'chiara'
  return null
}
