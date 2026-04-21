// auth.ts — Google OAuth 2.0 implicit flow for GTM API access.
// Uses the implicit flow (response_type=token) because this is a client-side app with no backend.
// The access token is returned in the URL hash fragment and never sent to any server.

const OAUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth'

const SCOPES = [
  'https://www.googleapis.com/auth/tagmanager.edit.containers',
  'https://www.googleapis.com/auth/tagmanager.readonly',
]

export function buildOAuthUrl(clientId: string, redirectUri: string): string {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'token',
    scope: SCOPES.join(' '),
    include_granted_scopes: 'true',
  })
  return `${OAUTH_ENDPOINT}?${params.toString()}`
}

export function parseTokenFromHash(hash: string): string | null {
  if (!hash || hash.length < 2) return null
  const params = new URLSearchParams(hash.substring(1))
  return params.get('access_token')
}
