import { verifyAccessToken } from './mcpOauth.ts'

/** Map companion token string to household user (docs/SPEC.md). */

export type HouseholdUser = 'simon' | 'chiara'

function looksLikeAccessJwt(s: string): boolean {
  const p = s.trim().split('.')
  return p.length === 3 && p.every((x) => x.length > 0)
}

export function userFromCompanionToken(token: string): HouseholdUser | null {
  const t = token.trim()
  if (!t) return null

  const simon = Deno.env.get('COMPANION_TOKEN_SIMON')
  const chiara = Deno.env.get('COMPANION_TOKEN_CHIARA')
  if (!simon || !chiara) {
    console.error('Missing COMPANION_TOKEN_SIMON or COMPANION_TOKEN_CHIARA')
    return null
  }
  if (t === simon) return 'simon'
  if (t === chiara) return 'chiara'
  return null
}

export function userFromBearer(
  authorization: string | undefined,
): HouseholdUser | null {
  if (!authorization?.startsWith('Bearer ')) return null
  return userFromCompanionToken(authorization.slice('Bearer '.length))
}

/**
 * Resolves the household user: OAuth access token (Claude) or legacy companion
 * token (Bearer / Basic / query). See claude.com/docs/connectors/building/authentication
 */
export async function resolveUserFromRequest(
  req: Request,
): Promise<HouseholdUser | null> {
  const auth = req.headers.get('Authorization')
  if (auth?.startsWith('Bearer ')) {
    const raw = auth.slice(7).trim()
    if (looksLikeAccessJwt(raw) && Deno.env.get('MCP_OAUTH_JWT_SECRET')) {
      try {
        return await verifyAccessToken(raw)
      } catch {
        // fall through to companion
      }
    }
    return userFromCompanionToken(raw)
  }
  if (auth?.startsWith('Basic ')) {
    try {
      const decoded = atob(auth.slice(6).trim())
      const colon = decoded.indexOf(':')
      const id = colon >= 0 ? decoded.slice(0, colon).trim() : ''
      const secret = colon >= 0 ? decoded.slice(colon + 1).trim() : decoded.trim()
      const token = secret || id
      return userFromCompanionToken(token)
    } catch {
      return null
    }
  }
  const url = new URL(req.url)
  const q =
    url.searchParams.get('companion_token') ?? url.searchParams.get('token')
  if (q) return userFromCompanionToken(q)
  return null
}
