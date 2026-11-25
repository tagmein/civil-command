import {
 buildTablesScope,
 defaultValueForType,
 normalizePrimitiveType,
 runLines,
} from './field.mjs'

export const HTTP_HANDLER_METHODS = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options', 'all']
export const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']
export const RESPONSE_TAG = '__ccHttpResponse'

export function createResponseHelper() {
 return function respond(status = 200, body = null, headers = {}) {
  const numStatus = Number(status)
  const cleanStatus = Number.isFinite(numStatus) && numStatus >= 100 && numStatus <= 599
   ? Math.trunc(numStatus)
   : 200
  const cleanHeaders = {}
  if (headers && typeof headers === 'object' && !Array.isArray(headers)) {
   for (const [k, v] of Object.entries(headers)) {
    if (k && v !== undefined && v !== null) {
     cleanHeaders[String(k)] = String(v)
    }
   }
  }
  return {
   [RESPONSE_TAG]: true,
   status: cleanStatus,
   body: body === undefined ? null : body,
   headers: cleanHeaders,
  }
 }
}

export function isHttpResponseEnvelope(value) {
 return Boolean(
  value &&
  typeof value === 'object' &&
  Object.hasOwn(value, RESPONSE_TAG) &&
  value[RESPONSE_TAG] === true
 )
}

function safeDecodeSegment(segment) {
 try {
  return decodeURIComponent(segment)
 }
 catch {
  return segment
 }
}

function normalizeSlashPath(raw) {
 if (raw === null || raw === undefined) {
  return '/'
 }
 const str = String(raw).trim()
 if (!str) {
  return '/'
 }
 const withLeading = str.startsWith('/') ? str : `/${str}`
 const collapsed = withLeading.replace(/\/+/g, '/')
 if (collapsed.length > 1 && collapsed.endsWith('/')) {
  return collapsed.slice(0, -1)
 }
 return collapsed
}

function stripBasePathPrefix(pathname, basePath) {
 const normPath = normalizeSlashPath(pathname)
 const cleanBase = typeof basePath === 'string' ? basePath.trim() : ''
 if (!cleanBase || cleanBase === '/') {
  return normPath
 }
 const normBase = normalizeSlashPath(cleanBase)
 if (normPath === normBase) {
  return '/'
 }
 if (normPath.startsWith(`${normBase}/`)) {
  const rest = normPath.slice(normBase.length)
  return rest.startsWith('/') ? rest : `/${rest}`
 }
 return normPath
}

function parseQueryString(qs) {
 const out = {}
 if (!qs) {
  return out
 }
 const raw = qs.startsWith('?') ? qs.slice(1) : qs
 if (!raw) {
  return out
 }
 const params = new URLSearchParams(raw)
 for (const key of params.keys()) {
  const values = params.getAll(key)
  out[key] = values.length > 1 ? values : values[0]
 }
 return out
}

function normalizeHeaders(rawHeaders) {
 const out = {}
 if (!rawHeaders || typeof rawHeaders !== 'object' || Array.isArray(rawHeaders)) {
  return out
 }
 for (const [k, v] of Object.entries(rawHeaders)) {
  if (!k || v === undefined || v === null) {
   continue
  }
  out[String(k).toLowerCase()] = Array.isArray(v) ? v.join(', ') : String(v)
 }
 return out
}

function parseBodyPayload(rawBody, body, headers) {
 const contentType = String(headers['content-type'] || '').toLowerCase()
 if (body !== undefined && rawBody === undefined) {
  const text = typeof body === 'string' ? body : JSON.stringify(body)
  return { body, rawBody: text === undefined ? '' : text }
 }
 const rawText = rawBody === undefined || rawBody === null ? '' : String(rawBody)
 if (body !== undefined) {
  return { body, rawBody: rawText }
 }
 if (!rawText.length) {
  return { body: undefined, rawBody: '' }
 }
 if (contentType.includes('application/x-www-form-urlencoded')) {
  return { body: parseQueryString(rawText), rawBody: rawText }
 }
 const shouldTryJson =
  contentType.includes('application/json') ||
  contentType.includes('+json') ||
  !contentType
 if (shouldTryJson) {
  try {
   return { body: JSON.parse(rawText), rawBody: rawText }
  }
  catch {
   return { body: rawText, rawBody: rawText }
  }
 }
 return { body: rawText, rawBody: rawText }
}

export function buildRequestObject(options = {}) {
 const method = String(options.method || 'GET').trim().toUpperCase() || 'GET'
 const rawTarget = options.url !== undefined && options.url !== null
  ? String(options.url)
  : options.path !== undefined && options.path !== null
   ? String(options.path)
   : '/'
 let parsedPath = '/'
 let parsedQueryStr = ''
 try {
  const dummyOrigin = 'http://localhost'
  const u = new URL(rawTarget.startsWith('http://') || rawTarget.startsWith('https://')
   ? rawTarget
   : `${dummyOrigin}${rawTarget.startsWith('/') ? rawTarget : `/${rawTarget}`}`)
  parsedPath = u.pathname || '/'
  parsedQueryStr = u.search ? u.search.slice(1) : ''
 }
 catch {
  const qIdx = rawTarget.indexOf('?')
  parsedPath = qIdx === -1 ? rawTarget : rawTarget.slice(0, qIdx)
  parsedQueryStr = qIdx === -1 ? '' : rawTarget.slice(qIdx + 1)
 }

 const originalPath = normalizeSlashPath(parsedPath)
 const pathname = stripBasePathPrefix(originalPath, options.basePath)
 const segments = pathname === '/'
  ? []
  : pathname.split('/').filter(Boolean).map(safeDecodeSegment)
 const query = {
  ...parseQueryString(parsedQueryStr),
  ...(options.query && typeof options.query === 'object' && !Array.isArray(options.query)
   ? options.query
   : {}),
 }
 const headers = normalizeHeaders(options.headers)
 const { body, rawBody } = parseBodyPayload(options.rawBody, options.body, headers)
 const params = options.params && typeof options.params === 'object' && !Array.isArray(options.params)
  ? { ...options.params }
  : {}

 return {
  method,
  path: pathname,
  pathname,
  originalPath,
  basePath: options.basePath ? normalizeSlashPath(options.basePath) : '',
  segments,
  query,
  queryString: parsedQueryStr,
  headers,
  body,
  rawBody,
  params,
  respond: createResponseHelper(),
 }
}

export function detectLaneHandlers(state) {
 const handlers = {}
 const methods = []
 if (state && typeof state === 'object') {
  for (const key of HTTP_HANDLER_METHODS) {
   if (Object.hasOwn(state, key) && typeof state[key] === 'function') {
    handlers[key] = state[key]
    methods.push(key.toUpperCase())
   }
  }
 }
 return {
  hasHandlers: methods.length > 0,
  methods,
  handlers,
 }
}

export function extractLastLaneValue(results) {
 const list = Array.isArray(results) ? results : []
 let found = false
 let lastValue = null
 for (const res of list) {
  if (!res) {
   continue
  }
  if (res.error) {
   return {
    ok: false,
    error: res.error,
    lineNumber: res.lineNumber ?? null,
    value: undefined,
   }
  }
  if (res.isEmpty || res.isComment) {
   continue
  }
  found = true
  lastValue = res.value
 }
 return {
  ok: true,
  error: null,
  lineNumber: null,
  value: found ? lastValue : null,
 }
}

function findHeaderIgnoreCase(headers, targetLower) {
 for (const [k, v] of Object.entries(headers)) {
  if (k.toLowerCase() === targetLower) {
   return { key: k, value: v }
  }
 }
 return null
}

function applyCorsHeaders(headers) {
 if (!findHeaderIgnoreCase(headers, 'access-control-allow-origin')) {
  headers['Access-Control-Allow-Origin'] = '*'
 }
 if (!findHeaderIgnoreCase(headers, 'access-control-allow-methods')) {
  headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS'
 }
 if (!findHeaderIgnoreCase(headers, 'access-control-allow-headers')) {
  headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, X-Requested-With'
 }
}

export function normalizeHttpResult(value, options = {}) {
 const cors = options.cors !== false
 const method = String(options.method || 'GET').toUpperCase()
 const isEnvelope = isHttpResponseEnvelope(value)
 const status = isEnvelope ? value.status : 200
 const bodyValue = isEnvelope
  ? (value.body === undefined ? null : value.body)
  : (value === undefined ? null : value)
 const headers = {}
 if (isEnvelope && value.headers && typeof value.headers === 'object') {
  for (const [k, v] of Object.entries(value.headers)) {
   if (k && v !== undefined && v !== null) {
    headers[k] = String(v)
   }
  }
 }
 if (cors) {
  applyCorsHeaders(headers)
 }

 const existingCt = findHeaderIgnoreCase(headers, 'content-type')
 const ctLower = existingCt ? String(existingCt.value).toLowerCase() : ''
 const explicitNonJson = Boolean(existingCt && !ctLower.includes('json'))

 let isJson = !explicitNonJson
 let bodyText = ''
 if (status === 204 || status === 304 || method === 'HEAD') {
  bodyText = ''
  if (!existingCt && status !== 204 && status !== 304) {
   headers['Content-Type'] = 'application/json; charset=utf-8'
  }
 }
 else if (explicitNonJson && typeof bodyValue === 'string') {
  bodyText = bodyValue
 }
 else {
  if (!existingCt) {
   headers['Content-Type'] = 'application/json; charset=utf-8'
  }
  isJson = true
  try {
   const serialized = JSON.stringify(bodyValue)
   bodyText = serialized === undefined ? 'null' : serialized
  }
  catch (err) {
   isJson = true
   headers['Content-Type'] = 'application/json; charset=utf-8'
   const msg = err && err.message ? err.message : 'Response value is not JSON serializable'
   return {
    status: 500,
    headers,
    bodyText: JSON.stringify({ error: msg }),
    bodyValue: { error: msg },
    isJson: true,
   }
  }
 }

 return {
  status,
  headers,
  bodyText,
  bodyValue,
  isJson,
 }
}

function buildAllowHeader(methods, cors) {
 const set = new Set()
 if (methods.includes('ALL')) {
  for (const m of HTTP_METHODS) {
   set.add(m)
  }
 }
 else {
  for (const m of methods) {
   set.add(m)
  }
  if (set.has('GET')) {
   set.add('HEAD')
  }
  if (cors) {
   set.add('OPTIONS')
  }
 }
 return Array.from(set).join(', ')
}

export async function executeLaneHttpRequest({ req, laneState, runFreshLane, cors = true } = {}) {
 const requestObj = req && typeof req === 'object' ? req : buildRequestObject({})
 const method = String(requestObj.method || 'GET').toUpperCase()
 const methodLower = method.toLowerCase()
 const info = detectLaneHandlers(laneState)

 if (info.hasHandlers) {
  const direct = info.handlers[methodLower]
  const headFallback = methodLower === 'head' ? info.handlers.get : null
  const handler = direct || headFallback || info.handlers.all || null
  const handlerName = direct
   ? methodLower
   : headFallback
    ? 'get'
    : info.handlers.all
     ? 'all'
     : null

  if (!handler) {
   if (method === 'OPTIONS' && cors !== false) {
    const res = normalizeHttpResult(
     { [RESPONSE_TAG]: true, status: 204, body: null, headers: {} },
     { cors, method }
    )
    return {
     ...res,
     mode: 'cors-preflight',
     handlerName: null,
     detectedHandlers: info.methods,
    }
   }
   const allow = buildAllowHeader(info.methods, cors !== false)
   const res = normalizeHttpResult(
    {
     [RESPONSE_TAG]: true,
     status: 405,
     body: { error: `Method ${method} not allowed` },
     headers: { Allow: allow },
    },
    { cors, method }
   )
   return {
    ...res,
    mode: 'handler',
    handlerName: null,
    detectedHandlers: info.methods,
   }
  }

  try {
   const result = await handler(requestObj)
   const res = normalizeHttpResult(result, { cors, method })
   return {
    ...res,
    mode: 'handler',
    handlerName,
    detectedHandlers: info.methods,
   }
  }
  catch (err) {
   const msg = err instanceof Error ? err.message : String(err)
   const res = normalizeHttpResult(
    {
     [RESPONSE_TAG]: true,
     status: 500,
     body: { error: msg },
     headers: {},
    },
    { cors, method }
   )
   return {
    ...res,
    mode: 'handler',
    handlerName,
    detectedHandlers: info.methods,
   }
  }
 }

 if (method === 'OPTIONS' && cors !== false) {
  const res = normalizeHttpResult(
   { [RESPONSE_TAG]: true, status: 204, body: null, headers: {} },
   { cors, method }
  )
  return {
   ...res,
   mode: 'cors-preflight',
   handlerName: null,
   detectedHandlers: [],
  }
 }

 if (method !== 'GET' && method !== 'HEAD') {
  const allow = cors !== false ? 'GET, HEAD, OPTIONS' : 'GET, HEAD'
  const res = normalizeHttpResult(
   {
    [RESPONSE_TAG]: true,
    status: 405,
    body: { error: `Method ${method} not allowed (lane evaluates a GET return value)` },
    headers: { Allow: allow },
   },
   { cors, method }
  )
  return {
   ...res,
   mode: 'expression',
   handlerName: null,
   detectedHandlers: [],
  }
 }

 try {
  const outcome = await runFreshLane(requestObj)
  const extracted = extractLastLaneValue(outcome && outcome.results ? outcome.results : [])
  if (!extracted.ok) {
   const errBody = { error: extracted.error }
   if (extracted.lineNumber !== null && extracted.lineNumber !== undefined) {
    errBody.lineNumber = extracted.lineNumber
   }
   const res = normalizeHttpResult(
    { [RESPONSE_TAG]: true, status: 500, body: errBody, headers: {} },
    { cors, method }
   )
   return {
    ...res,
    mode: 'expression',
    handlerName: null,
    detectedHandlers: [],
   }
  }
  const res = normalizeHttpResult(extracted.value, { cors, method })
  return {
   ...res,
   mode: 'expression',
   handlerName: null,
   detectedHandlers: [],
  }
 }
 catch (err) {
  const msg = err instanceof Error ? err.message : String(err)
  const res = normalizeHttpResult(
   { [RESPONSE_TAG]: true, status: 500, body: { error: msg }, headers: {} },
   { cors, method }
  )
  return {
   ...res,
   mode: 'expression',
   handlerName: null,
   detectedHandlers: [],
  }
 }
}

function formatLogArgs(args) {
 return args.map(arg => {
  if (typeof arg === 'string') {
   return arg
  }
  try {
   const json = JSON.stringify(arg)
   return json === undefined ? String(arg) : json
  }
  catch {
   return String(arg)
  }
 }).join(' ')
}

function createCapturingConsole(logs, delegate = globalThis.console) {
 const record = (level, args) => {
  logs.push({ level, message: formatLogArgs(args) })
  if (delegate && typeof delegate[level] === 'function') {
   try {
    delegate[level](...args)
   }
   catch {
    // ignore console delegate failures
   }
  }
 }
 return {
  log: (...args) => record('log', args),
  info: (...args) => record('info', args),
  warn: (...args) => record('warn', args),
  error: (...args) => record('error', args),
 }
}

export async function simulateLaneRequest({
 lines = [],
 inputs = [],
 tables = [],
 laneId = 'lane',
 laneData = null,
 importLaneFn = null,
 req = {},
 cachedState = null,
 cors = true,
 forceFresh = false,
} = {}) {
 const logs = []
 const startMs = Date.now()
 const capturedConsole = createCapturingConsole(logs)
 const requestObj = buildRequestObject(req)
 const cleanLines = Array.isArray(lines) ? lines : []

 const buildInitialState = reqForRun => {
  const env = {
   console: capturedConsole,
   data: laneData,
   Math,
   JSON,
   Date,
   importLane: typeof importLaneFn === 'function' ? importLaneFn : () => undefined,
   respond: createResponseHelper(),
   ...(reqForRun ? { req: reqForRun } : {}),
  }
  if (Array.isArray(inputs)) {
   for (const entry of inputs) {
    if (!entry || typeof entry.name !== 'string') {
     continue
    }
    const trimmed = entry.name.trim()
    if (!trimmed) {
     continue
    }
    env[trimmed] = defaultValueForType(normalizePrimitiveType(entry.type))
   }
  }
  if (Array.isArray(tables) && tables.length > 0) {
   Object.assign(env, buildTablesScope(tables))
  }
  return env
 }

 let startupOutcome = null
 let laneState = cachedState && !forceFresh && detectLaneHandlers(cachedState).hasHandlers
  ? cachedState
  : null

 if (!laneState) {
  startupOutcome = await runLines(cleanLines, {
   filename: laneId || 'lane',
   initialState: buildInitialState(requestObj),
  })
  laneState = startupOutcome.state
 }

 const runFreshLane = async freshReq => {
  if (startupOutcome) {
   return startupOutcome
  }
  return runLines(cleanLines, {
   filename: laneId || 'lane',
   initialState: buildInitialState(freshReq),
  })
 }

 const httpResult = await executeLaneHttpRequest({
  req: requestObj,
  laneState,
  runFreshLane,
  cors,
 })

 const durationMs = Math.max(0, Date.now() - startMs)
 return {
  ...httpResult,
  durationMs,
  logs,
 }
}
