import type { Hono } from 'npm:hono@^4.9.7'
import { userFromCompanionToken } from '../_shared/auth.ts'
import {
  authorizationServerMetadata,
  buildAuthorizeFormPage,
  mcpBaseUrlFromEnv,
  protectedResourceMetadata,
  signAccessToken,
  signAuthCode,
  signRefreshToken,
  userFromCimd,
  matchRedirect,
  verifyAuthCode,
  verifyPkceS256,
  verifyRefreshToken,
} from '../_shared/mcpOauth.ts'

const SCOPE = 'companion'

/**
 * Structured log for the OAuth dance. Mirrors `mcp:` lines in index.ts so Supabase
 * function logs can be read with one filter. Never logs tokens, access codes,
 * authorization codes, PKCE verifiers, or refresh tokens.
 */
function logOauth(step: string, extra: Record<string, unknown> = {}) {
  console.error(JSON.stringify({ oauth: step, ...extra }))
}

function hostOf(u: string): string {
  try {
    return new URL(u).host
  } catch {
    return ''
  }
}

function errRedirect(redirectUri: string, state: string | null, err: string, desc: string) {
  const u = new URL(redirectUri)
  u.searchParams.set('error', err)
  u.searchParams.set('error_description', desc)
  if (state) u.searchParams.set('state', state)
  return Response.redirect(u.toString(), 302)
}

export function registerOAuthRoutes(app: Hono) {
  if (!mcpBaseUrlFromEnv()) {
    console.error('SUPABASE_URL missing; OAuth metadata URLs are wrong')
  }

  app.get('/.well-known/oauth-protected-resource/margot-mcp', (c) => {
    logOauth('prm', { ua: c.req.header('user-agent') ?? '' })
    return c.json(protectedResourceMetadata())
  })
  // MCP 2025-11-25 + RFC8414: path-appended OIDC for issuers with path (third try).
  app.get('/.well-known/openid-configuration', (c) => {
    logOauth('oidc_config', { ua: c.req.header('user-agent') ?? '' })
    return c.json(authorizationServerMetadata())
  })
  app.get('/.well-known/oauth-authorization-server', (c) => {
    logOauth('as_metadata', { ua: c.req.header('user-agent') ?? '' })
    return c.json(authorizationServerMetadata())
  })

  app.get('/oauth/authorize', async (c) => {
    if (!Deno.env.get('MCP_OAUTH_JWT_SECRET')) {
      logOauth('authorize_get_fail', { reason: 'jwt_secret_missing' })
      return c.text('Server not configured: set MCP_OAUTH_JWT_SECRET in Supabase Edge secrets.', 503)
    }
    const { searchParams } = new URL(c.req.url)
    const responseType = searchParams.get('response_type') ?? ''
    const clientId = searchParams.get('client_id') ?? ''
    const redirectUri = searchParams.get('redirect_uri') ?? ''
    const state = searchParams.get('state') ?? ''
    const codeChallenge = searchParams.get('code_challenge') ?? ''
    const codeChallengeMethod = searchParams.get('code_challenge_method') ?? ''
    const resource = searchParams.get('resource') ?? ''
    const scope = searchParams.get('scope') ?? SCOPE

    logOauth('authorize_get', {
      clientIdHost: hostOf(clientId),
      redirectUriHost: hostOf(redirectUri),
      hasState: !!state,
      hasCodeChallenge: !!codeChallenge,
      codeChallengeMethod,
      responseType,
      resourceOk: resource === mcpBaseUrlFromEnv(),
      scope,
    })

    if (responseType !== 'code') {
      logOauth('authorize_get_fail', { reason: 'response_type_not_code', responseType })
      if (redirectUri) {
        return errRedirect(redirectUri, state || null, 'unsupported_grant_type', 'response_type must be code')
      }
      return c.text('response_type must be code', 400)
    }
    if (!clientId) {
      logOauth('authorize_get_fail', { reason: 'client_id_missing' })
      return c.text('client_id is required', 400)
    }
    if (!redirectUri) {
      logOauth('authorize_get_fail', { reason: 'redirect_uri_missing' })
      return c.text('redirect_uri is required', 400)
    }
    if (!codeChallenge || !codeChallengeMethod) {
      logOauth('authorize_get_fail', { reason: 'pkce_missing' })
      return errRedirect(redirectUri, state || null, 'invalid_request', 'PKCE code_challenge is required')
    }
    if (codeChallengeMethod !== 'S256') {
      logOauth('authorize_get_fail', { reason: 'pkce_method_not_s256', codeChallengeMethod })
      return errRedirect(redirectUri, state || null, 'invalid_request', 'Only S256 PKCE is supported')
    }
    if (!resource || resource !== mcpBaseUrlFromEnv()) {
      logOauth('authorize_get_fail', { reason: 'resource_mismatch', resourceHost: hostOf(resource) })
      return errRedirect(redirectUri, state || null, 'invalid_request', 'resource must match the MCP base URL')
    }

    const cimd = await userFromCimd(clientId)
    if ('error' in cimd) {
      logOauth('authorize_get_fail', { reason: 'cimd_error', err: cimd.error, clientIdHost: hostOf(clientId) })
      return c.text(cimd.error, 400)
    }
    if (!matchRedirect(cimd.doc.redirect_uris ?? [], redirectUri)) {
      logOauth('authorize_get_fail', {
        reason: 'redirect_not_allowed',
        redirectUriHost: hostOf(redirectUri),
        allowedHosts: (cimd.doc.redirect_uris ?? []).map(hostOf),
      })
      return c.text('redirect_uri is not allowed for this client_id', 400)
    }

    // Default *.supabase.co rewrites any GET that looks like HTML to text/plain, so
    // browsers show source, not a form. The reliable fix: host docs/oauth-consent.html
    // (e.g. GitHub Pages) and set MCP_OAUTH_CONSENT_PAGE_URL to that page’s HTTPS URL.
    const externalConsent = (Deno.env.get('MCP_OAUTH_CONSENT_PAGE_URL') ?? '').trim()
    if (externalConsent) {
      const dest = new URL(externalConsent)
      for (const [k, v] of searchParams) {
        dest.searchParams.set(k, v)
      }
      logOauth('authorize_get_redirect_consent', { consentHost: hostOf(externalConsent) })
      return Response.redirect(dest.toString(), 302)
    }

    const page = buildAuthorizeFormPage({
      clientId,
      redirectUri,
      state,
      codeChallenge,
      codeChallengeMethod,
      resource,
      scope: scope || SCOPE,
    })
    logOauth('authorize_get_form_rendered')
    // Custom domains: HTML works per Supabase limits; default host rewrites text/html to plain.
    const body = new TextEncoder().encode(page)
    return new Response(body, {
      status: 200,
      headers: {
        'Content-Type': 'application/xhtml+xml; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    })
  })

  app.post('/oauth/authorize', async (c) => {
    if (!Deno.env.get('MCP_OAUTH_JWT_SECRET')) {
      logOauth('authorize_post_fail', { reason: 'jwt_secret_missing' })
      return c.text('Server not configured: set MCP_OAUTH_JWT_SECRET.', 503)
    }
    const form = await c.req.parseBody()
    const get = (k: string) => (typeof form[k] === 'string' ? form[k] as string : '')

    const clientId = get('client_id')
    const redirectUri = get('redirect_uri')
    const state = get('state')
    const codeChallenge = get('code_challenge')
    const codeChallengeMethod = get('code_challenge_method')
    const resource = get('resource')
    const tokenRaw = get('companion_token').trim()

    logOauth('authorize_post', {
      clientIdHost: hostOf(clientId),
      redirectUriHost: hostOf(redirectUri),
      hasCodeChallenge: !!codeChallenge,
      codeChallengeMethod,
      resourceOk: resource === mcpBaseUrlFromEnv(),
      accessCodePresent: tokenRaw.length > 0,
    })

    if (!clientId || !redirectUri) {
      logOauth('authorize_post_fail', { reason: 'form_missing_client_or_redirect' })
      return c.text('invalid form', 400)
    }
    if (codeChallengeMethod !== 'S256' || !codeChallenge) {
      logOauth('authorize_post_fail', { reason: 'pkce_missing_or_wrong_method', codeChallengeMethod })
      return errRedirect(redirectUri, state || null, 'invalid_request', 'PKCE parameters missing')
    }
    if (!resource || resource !== mcpBaseUrlFromEnv()) {
      logOauth('authorize_post_fail', { reason: 'resource_mismatch', resourceHost: hostOf(resource) })
      return errRedirect(redirectUri, state || null, 'invalid_request', 'bad resource')
    }

    const cimd = await userFromCimd(clientId)
    if ('error' in cimd) {
      logOauth('authorize_post_fail', { reason: 'cimd_error', err: cimd.error })
      return c.text(cimd.error, 400)
    }
    if (!matchRedirect(cimd.doc.redirect_uris ?? [], redirectUri)) {
      logOauth('authorize_post_fail', {
        reason: 'redirect_not_allowed',
        redirectUriHost: hostOf(redirectUri),
        allowedHosts: (cimd.doc.redirect_uris ?? []).map(hostOf),
      })
      return c.text('redirect_uri is not allowed', 400)
    }

    const user = userFromCompanionToken(tokenRaw)
    if (!user) {
      logOauth('authorize_post_fail', { reason: 'bad_access_code' })
      return errRedirect(redirectUri, state || null, 'access_denied', 'Invalid access code')
    }

    try {
      const code = await signAuthCode({
        user,
        code_challenge: codeChallenge,
        code_challenge_method: codeChallengeMethod,
        client_id: clientId,
        redirect_uri: redirectUri,
        resource,
      })
      const u = new URL(redirectUri)
      u.searchParams.set('code', code)
      if (state) u.searchParams.set('state', state)
      logOauth('authorize_post_code_issued', { user, redirectUriHost: hostOf(redirectUri) })
      return c.redirect(u.toString(), 302)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      logOauth('authorize_post_fail', { reason: 'sign_auth_code_error', err: msg })
      return c.text('Could not create authorization code', 500)
    }
  })

  app.post('/oauth/token', async (c) => {
    if (!Deno.env.get('MCP_OAUTH_JWT_SECRET')) {
      logOauth('token_fail', { reason: 'jwt_secret_missing' })
      return c.json({ error: 'server_error', error_description: 'MCP_OAUTH_JWT_SECRET not set' }, 503)
    }
    let body: URLSearchParams
    const ct = c.req.header('content-type') ?? ''
    if (ct.includes('application/x-www-form-urlencoded')) {
      body = new URLSearchParams(await c.req.text())
    } else {
      try {
        const j = (await c.req.json()) as Record<string, string>
        body = new URLSearchParams(j)
      } catch {
        logOauth('token_fail', { reason: 'body_parse_error', contentType: ct })
        return c.json({ error: 'invalid_request' }, 400)
      }
    }
    const grant = body.get('grant_type') ?? ''
    logOauth('token', { grant, contentType: ct })
    if (grant === 'authorization_code') {
      const code = body.get('code') ?? ''
      const redirectUri = body.get('redirect_uri') ?? ''
      const clientId = body.get('client_id') ?? ''
      const codeVerifier = body.get('code_verifier') ?? ''
      const resource = body.get('resource') ?? ''
      if (!code || !redirectUri || !clientId || !codeVerifier) {
        logOauth('token_fail', {
          grant,
          reason: 'missing_required',
          hasCode: !!code,
          hasRedirectUri: !!redirectUri,
          hasClientId: !!clientId,
          hasCodeVerifier: !!codeVerifier,
        })
        return c.json({ error: 'invalid_request' }, 400)
      }
      // RFC 8707: clients may omit `resource` on the token request; only reject when
      // present and wrong (Claude was failing here with empty `resource`).
      if (resource && resource !== mcpBaseUrlFromEnv()) {
        logOauth('token_fail', { grant, reason: 'resource_mismatch', resourceHost: hostOf(resource) })
        return c.json({ error: 'invalid_request', error_description: 'resource mismatch' }, 400)
      }
      try {
        const p = await verifyAuthCode(code)
        if (p.client_id !== clientId || p.redirect_uri !== redirectUri) {
          logOauth('token_fail', {
            grant,
            reason: 'auth_code_binding_mismatch',
            clientIdMatch: p.client_id === clientId,
            redirectMatch: p.redirect_uri === redirectUri,
          })
          return c.json({ error: 'invalid_grant' }, 400)
        }
        const ok = await verifyPkceS256(codeVerifier, p.code_challenge)
        if (!ok) {
          logOauth('token_fail', { grant, reason: 'pkce_fail', user: p.user })
          return c.json({ error: 'invalid_grant', error_description: 'PKCE failed' }, 400)
        }
        const [access, refresh] = await Promise.all([
          signAccessToken(p.user),
          signRefreshToken(p.user),
        ])
        logOauth('token_ok', { grant, user: p.user })
        return c.json({
          access_token: access,
          token_type: 'Bearer',
          expires_in: 3600,
          refresh_token: refresh,
          scope: SCOPE,
        })
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        logOauth('token_fail', { grant, reason: 'verify_or_sign_error', err: msg })
        return c.json({ error: 'invalid_grant' }, 400)
      }
    }
    if (grant === 'refresh_token') {
      const rt = body.get('refresh_token') ?? ''
      const resource = body.get('resource') ?? ''
      if (!rt) {
        logOauth('token_fail', { grant, reason: 'refresh_token_missing' })
        return c.json({ error: 'invalid_request' }, 400)
      }
      if (resource && resource !== mcpBaseUrlFromEnv()) {
        logOauth('token_fail', { grant, reason: 'resource_mismatch', resourceHost: hostOf(resource) })
        return c.json({ error: 'invalid_request' }, 400)
      }
      try {
        const user = await verifyRefreshToken(rt)
        const [access, refresh] = await Promise.all([
          signAccessToken(user),
          signRefreshToken(user),
        ])
        logOauth('token_ok', { grant, user })
        return c.json({
          access_token: access,
          token_type: 'Bearer',
          expires_in: 3600,
          refresh_token: refresh,
          scope: SCOPE,
        })
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        logOauth('token_fail', { grant, reason: 'verify_or_sign_error', err: msg })
        return c.json({ error: 'invalid_grant' }, 400)
      }
    }
    logOauth('token_fail', { grant, reason: 'unsupported_grant_type' })
    return c.json({ error: 'unsupported_grant_type' }, 400)
  })
}
