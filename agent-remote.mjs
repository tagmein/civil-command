// Shared remote-host option resolution for ./cc and the stdio MCP server.
// Keep this module browser-safe (no node: imports) so it can also be exercised
// from the app's own JavaScript context.

export const DEFAULT_REMOTE_DATA_URL = 'http://localhost:8080/api/data?mode=disk'

function pickString(...values) {
 for (const value of values) {
  if (typeof value === 'string') {
   return value
  }
 }
 return undefined
}

function pickNonEmptyString(...values) {
 for (const value of values) {
  if (typeof value === 'string' && value.trim()) {
   return value.trim()
  }
 }
 return undefined
}

function withScheme(rawUrl) {
 const value = String(rawUrl || '').trim()
 if (!value) {
  return ''
 }
 return /^[a-z][a-z0-9+.-]*:\/\//i.test(value) ? value : `https://${value}`
}

function decodeUrlPart(value) {
 try {
  return decodeURIComponent(value)
 }
 catch {
  return value
 }
}

export function stripUrlCredentials(rawUrl) {
 const parsed = new URL(withScheme(rawUrl))
 const username = parsed.username ? decodeUrlPart(parsed.username) : ''
 const password = parsed.password ? decodeUrlPart(parsed.password) : ''
 if (username || password) {
  parsed.username = ''
  parsed.password = ''
 }
 return {
  url: parsed.toString(),
  username,
  password,
 }
}

export function basicAuthorizationHeader(username, password) {
 const pair = `${username || ''}:${password || ''}`
 if (typeof Buffer !== 'undefined' && Buffer && typeof Buffer.from === 'function') {
  return `Basic ${Buffer.from(pair, 'utf8').toString('base64')}`
 }
 const bytes = unescape(encodeURIComponent(pair))
 return `Basic ${btoa(bytes)}`
}

function parseHeaderFlags(rawHeaders) {
 const list = Array.isArray(rawHeaders) ? rawHeaders : (rawHeaders === undefined ? [] : [rawHeaders])
 const headers = {}
 for (const raw of list) {
  if (typeof raw !== 'string') {
   continue
  }
  const separator = raw.indexOf(':')
  if (separator <= 0) {
   throw new Error(`Invalid --header value (expected "Name: value"): ${raw}`)
  }
  const name = raw.slice(0, separator).trim()
  const value = raw.slice(separator + 1).trim()
  if (!name) {
   throw new Error(`Invalid --header value (empty header name): ${raw}`)
  }
  headers[name] = value
 }
 return headers
}

// Resolves --url / --host, credentials and custom headers into a KV base URL
// plus a header bundle that is forwarded to every fetch made by httpKV.
export function resolveAgentRemoteOptions(flags = {}, env = {}, options = {}) {
 const flagUrl = pickNonEmptyString(flags.url, flags['data-url'])
 const flagHost = pickNonEmptyString(flags.host, flags.origin)
 const envUrl = pickNonEmptyString(env.CC_DATA_URL)
 const envHost = pickNonEmptyString(env.CC_HOST)
 const defaultDataUrl = pickNonEmptyString(options.defaultDataUrl) || DEFAULT_REMOTE_DATA_URL

 let baseUrl = defaultDataUrl
 let embedded = { username: '', password: '' }

 try {
  if (flagUrl || envUrl) {
   embedded = stripUrlCredentials(flagUrl || envUrl)
   baseUrl = embedded.url
  }
  else if (flagHost || envHost) {
   embedded = stripUrlCredentials(flagHost || envHost)
   const target = new URL(embedded.url)
   baseUrl = `${target.origin}/api/data?mode=disk`
  }
 }
 catch (err) {
  throw new Error(`Invalid remote URL: ${err && err.message ? err.message : String(err)}`)
 }

 const headers = parseHeaderFlags(flags.header)

 const explicitUser = pickString(flags.user, flags.username, flags['auth-user'], env.CC_USER, env.CC_USERNAME)
 const explicitPassword = pickString(flags.password, env.CC_PASSWORD)
 const token = pickNonEmptyString(flags.token, flags.bearer, env.CC_TOKEN)

 if (explicitUser !== undefined || explicitPassword !== undefined) {
  if (!explicitUser || explicitPassword === undefined) {
   throw new Error('Both --user and --password are required for HTTP Basic authentication')
  }
  headers.Authorization = basicAuthorizationHeader(explicitUser, explicitPassword)
 }
 else if (embedded.username || embedded.password) {
  headers.Authorization = basicAuthorizationHeader(embedded.username, embedded.password)
 }

 if (token) {
  headers.Authorization = `Bearer ${token}`
 }

 return {
  baseUrl,
  headers,
  serverOrigin: new URL(baseUrl).origin,
  usesBasicAuth: /^Basic /.test(headers.Authorization || ''),
  usesBearerAuth: /^Bearer /.test(headers.Authorization || ''),
 }
}
