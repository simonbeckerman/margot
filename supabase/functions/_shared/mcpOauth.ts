/**
 * OAuth metadata + authorization endpoints for Claude custom connectors.
 * Cites: https://claude.com/docs/connectors/building/lazy-authentication
 * and MCP auth (OIDC path-appending for path-based issuers).
 *
 * HS256 JWTs use Web Crypto only (no `jose` npm) for Edge runtime compatibility.
 */
import type { HouseholdUser } from './auth.ts'

const PRM_NAME = 'beckerman-mcp'
const SCOPE = 'companion'
const CHALLENGE_METHOD = 'S256'

function requireJwtSecret(): Uint8Array {
  const s = Deno.env.get('MCP_OAUTH_JWT_SECRET')
  if (!s || s.length < 16) {
    throw new Error('MCP_OAUTH_JWT_SECRET is missing or too short')
  }
  return new TextEncoder().encode(s)
}

let _hmacKey: CryptoKey | null = null
async function getHmacCryptoKey(): Promise<CryptoKey> {
  if (!_hmacKey) {
    _hmacKey = await crypto.subtle.importKey(
      'raw',
      requireJwtSecret(),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign', 'verify'],
    )
  }
  return _hmacKey
}

function base64UrlToBytes(s: string): Uint8Array {
  const pad = 4 - (s.length % 4)
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + (pad < 4 ? '='.repeat(pad) : '')
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

function bytesToBase64Url(buf: ArrayBuffer | Uint8Array): string {
  const b = buf instanceof Uint8Array ? buf : new Uint8Array(buf)
  let s = btoa(String.fromCharCode(...b))
  return s.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function b64urlJson(obj: unknown): string {
  return bytesToBase64Url(new TextEncoder().encode(JSON.stringify(obj)))
}

/** Sign compact HS256 JWT. */
export async function signJwtHs256(
  payload: Record<string, unknown>,
): Promise<string> {
  const header = { alg: 'HS256', typ: 'JWT' }
  const h = b64urlJson(header)
  const p = b64urlJson(payload)
  const data = `${h}.${p}`
  const key = await getHmacCryptoKey()
  const sig = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(data),
  )
  return `${data}.${bytesToBase64Url(sig)}`
}

export async function verifyJwtHs256(
  token: string,
  opts: {
    requireIssuer?: string
    requireAudience?: string
  } = {},
): Promise<Record<string, unknown>> {
  const parts = token.trim().split('.')
  if (parts.length !== 3) throw new Error('invalid jwt')
  const [h64, p64, s64] = parts
  if (!h64 || !p64 || !s64) throw new Error('invalid jwt')
  const data = `${h64}.${p64}`
  const key = await getHmacCryptoKey()
  const ok = await crypto.subtle.verify(
    'HMAC',
    key,
    base64UrlToBytes(s64),
    new TextEncoder().encode(data),
  )
  if (!ok) throw new Error('invalid signature')
  const payload = JSON.parse(
    new TextDecoder().decode(base64UrlToBytes(p64)),
  ) as Record<string, unknown>
  const now = Math.floor(Date.now() / 1000)
  if (typeof payload.exp === 'number' && payload.exp < now) {
    throw new Error('token expired')
  }
  if (opts.requireIssuer !== undefined && payload.iss !== opts.requireIssuer) {
    throw new Error('invalid issuer')
  }
  if (
    opts.requireAudience !== undefined && payload.aud !== opts.requireAudience
  ) {
    throw new Error('invalid audience')
  }
  return payload
}

/** Public base URL of this Edge Function (no trailing slash). */
export function mcpBaseUrlFromEnv(): string {
  const u = Deno.env.get('SUPABASE_URL')
  if (!u) return ''
  const host = new URL(u).host
  return `https://${host}/functions/v1/beckerman-mcp`
}

export function mcpPrmUrl(): string {
  return `${mcpBaseUrlFromEnv()}/.well-known/oauth-protected-resource/${PRM_NAME}`
}

export function protectedResourceMetadata() {
  const base = mcpBaseUrlFromEnv()
  return {
    resource: base,
    authorization_servers: [base],
    scopes_supported: [SCOPE],
    bearer_methods_supported: ['header'],
  }
}

/** OAuth / OIDC server metadata (served at path-appending `.well-known/openid-configuration` on the issuer). */
export function authorizationServerMetadata() {
  const b = mcpBaseUrlFromEnv()
  return {
    issuer: b,
    authorization_endpoint: `${b}/oauth/authorize`,
    token_endpoint: `${b}/oauth/token`,
    scopes_supported: [SCOPE],
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    code_challenge_methods_supported: [CHALLENGE_METHOD],
    token_endpoint_auth_methods_supported: ['none'],
    client_id_metadata_document_supported: true,
  }
}

function base64UrlFromBytes(buf: ArrayBuffer): string {
  return bytesToBase64Url(new Uint8Array(buf))
}

/**
 * Constant-time byte compare. `crypto.subtle` in Deno Edge / WHATWG Web Crypto
 * does not expose `timingSafeEqual` (that lives on Node's `crypto` module),
 * so we do the XOR-OR loop ourselves. The inputs are already ASCII base64url
 * bytes of equal length in the caller.
 */
function constantTimeEqualBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) {
    diff |= a[i] ^ b[i]
  }
  return diff === 0
}

export async function verifyPkceS256(verifier: string, challenge: string) {
  const hash = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(verifier),
  )
  const expect = base64UrlFromBytes(hash)
  if (expect.length !== challenge.length) return false
  const a = new TextEncoder().encode(expect)
  const b2 = new TextEncoder().encode(challenge)
  return constantTimeEqualBytes(a, b2)
}

type AuthCodePayload = {
  user: HouseholdUser
  code_challenge: string
  code_challenge_method: string
  client_id: string
  redirect_uri: string
  resource: string
  mcp_typ: 'mcp_code'
  iss: string
  iat: number
  exp: number
}

export async function signAuthCode(
  fields: Omit<AuthCodePayload, 'mcp_typ' | 'iss' | 'iat' | 'exp'>,
) {
  const now = Math.floor(Date.now() / 1000)
  const iss = mcpBaseUrlFromEnv()
  const payload: AuthCodePayload = {
    ...fields,
    mcp_typ: 'mcp_code',
    iss,
    iat: now,
    exp: now + 5 * 60,
  }
  return await signJwtHs256(payload)
}

export async function verifyAuthCode(jwt: string) {
  const p = (await verifyJwtHs256(jwt, {
    requireIssuer: mcpBaseUrlFromEnv(),
  })) as unknown as AuthCodePayload
  if (p.mcp_typ !== 'mcp_code' || !p.user) throw new Error('Invalid auth code')
  return p
}

export async function signAccessToken(user: HouseholdUser) {
  const b = mcpBaseUrlFromEnv()
  const now = Math.floor(Date.now() / 1000)
  return await signJwtHs256({
    sub: user,
    mcp_typ: 'mcp_at',
    iss: b,
    aud: b,
    iat: now,
    exp: now + 3600,
  })
}

export async function signRefreshToken(user: HouseholdUser) {
  const b = mcpBaseUrlFromEnv()
  const now = Math.floor(Date.now() / 1000)
  return await signJwtHs256({
    sub: user,
    mcp_typ: 'mcp_rt',
    iss: b,
    aud: b,
    iat: now,
    exp: now + 30 * 24 * 3600,
  })
}

export async function verifyAccessToken(token: string): Promise<HouseholdUser> {
  const b = mcpBaseUrlFromEnv()
  const payload = (await verifyJwtHs256(token, {
    requireIssuer: b,
    requireAudience: b,
  })) as { mcp_typ?: string; sub?: string }
  if (payload.mcp_typ !== 'mcp_at') {
    throw new Error('not an access token')
  }
  const sub = payload.sub
  if (sub === 'simon' || sub === 'chiara') return sub
  throw new Error('invalid sub')
}

export async function verifyRefreshToken(
  token: string,
): Promise<HouseholdUser> {
  const b = mcpBaseUrlFromEnv()
  const payload = (await verifyJwtHs256(token, {
    requireIssuer: b,
    requireAudience: b,
  })) as { mcp_typ?: string; sub?: string }
  if (payload.mcp_typ !== 'mcp_rt') {
    throw new Error('not a refresh token')
  }
  const sub = payload.sub
  if (sub === 'simon' || sub === 'chiara') return sub
  throw new Error('invalid sub')
}

export async function userFromCimd(clientId: string) {
  let u: URL
  try {
    u = new URL(clientId)
  } catch {
    return { error: 'client_id is not a valid URL' as const }
  }
  if (u.protocol !== 'https:') {
    return { error: 'client_id must be an https URL' as const }
  }
  const r = await fetch(clientId, { redirect: 'follow' })
  if (!r.ok) {
    return { error: `Client metadata fetch failed: HTTP ${r.status}` as const }
  }
  const doc = (await r.json()) as {
    client_id?: string
    redirect_uris?: string[]
  }
  if (doc.client_id !== clientId) {
    return { error: 'client_id metadata self-reference mismatch' as const }
  }
  if (!Array.isArray(doc.redirect_uris) || doc.redirect_uris.length < 1) {
    return { error: 'client metadata missing redirect_uris' as const }
  }
  return { doc }
}

export function matchRedirect(allowed: string[], redirectUri: string) {
  return allowed.includes(redirectUri)
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function buildAuthorizeFormPage(opts: {
  clientId: string
  redirectUri: string
  state: string
  codeChallenge: string
  codeChallengeMethod: string
  resource: string
  scope: string
}): string {
  const f = (s: string) => escapeHtml(s)
  // XHTML5 (served as application/xhtml+xml) so Supabase’s default host does not rewrite GET HTML to text/plain.
  // action="" posts to the same URL the user loaded (correct scheme, host, and path in all deployments).
  return `<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" lang="en"><head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Beckerman Companion</title>
</head><body>
<h1>Beckerman Companion</h1>
<p>Enter your household access code (from your private note &mdash; same as stored in Supabase for you).</p>
<form method="post" action="">
  <input type="hidden" name="client_id" value="${f(opts.clientId)}" />
  <input type="hidden" name="redirect_uri" value="${f(opts.redirectUri)}" />
  <input type="hidden" name="state" value="${f(opts.state)}" />
  <input type="hidden" name="code_challenge" value="${f(opts.codeChallenge)}" />
  <input type="hidden" name="code_challenge_method" value="${f(opts.codeChallengeMethod)}" />
  <input type="hidden" name="resource" value="${f(opts.resource)}" />
  <input type="hidden" name="scope" value="${f(opts.scope)}" />
  <label for="c">Access code</label>
  <input id="c" name="companion_token" type="password" required="required" autocomplete="off" size="50" style="max-width:100%;" />
  <p><button type="submit">Continue</button></p>
  </form>
</body></html>`
}
