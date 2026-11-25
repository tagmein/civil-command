import http from 'node:http'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
 buildTablesScope,
 defaultValueForType,
 normalizePrimitiveType,
 resolveImportValue,
 runLines,
} from './field.mjs'
import { httpKV } from './data.mjs'
import { loadLaneScript, loadLaneTables } from './storage.mjs'
import {
 buildRequestObject,
 createResponseHelper,
 detectLaneHandlers,
 executeLaneHttpRequest,
} from './lane-http.mjs'

const MAX_REQUEST_BODY_BYTES = 2 * 1024 * 1024

export function normalizeCivilMemoryBaseUrl(rawUrl) {
 const trimmed = String(rawUrl || '').trim()
 if (!trimmed) {
  return ''
 }
 const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`
 const url = new URL(withScheme)
 if (!url.searchParams.has('mode')) {
  url.searchParams.set('mode', 'disk')
 }
 return url.toString()
}

export function parseStoredInputs(raw) {
 if (raw === null || raw === undefined) {
  return []
 }
 const str = String(raw).trim()
 if (!str.startsWith('[')) {
  return []
 }
 try {
  const parsed = JSON.parse(str)
  if (!Array.isArray(parsed)) {
   return []
  }
  const out = []
  for (const item of parsed) {
   if (!item || typeof item !== 'object') {
    continue
   }
   const name = item.name === null || item.name === undefined ? '' : String(item.name)
   const type = normalizePrimitiveType(item.type)
   out.push({ name, type })
  }
  return out
 }
 catch {
  return []
 }
}

function readBodyBuffer(req, maxBytes = MAX_REQUEST_BODY_BYTES) {
 return new Promise((resolve, reject) => {
  const chunks = []
  let total = 0
  let settled = false
  req.on('data', chunk => {
   if (settled) {
    return
   }
   const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
   total += buf.length
   if (total > maxBytes) {
    settled = true
    const err = new Error('Request body too large')
    err.status = 413
    reject(err)
    return
   }
   chunks.push(buf)
  })
  req.on('end', () => {
   if (settled) {
    return
   }
   settled = true
   resolve(Buffer.concat(chunks).toString('utf8'))
  })
  req.on('error', err => {
   if (!settled) {
    settled = true
    reject(err)
   }
  })
 })
}

export function createLaneHttpServer(config = {}, opts = {}) {
 const laneId = String(config.laneId || '').trim()
 if (!laneId) {
  throw new Error('createLaneHttpServer requires config.laneId')
 }
 const cors = config.cors !== false
 const includeImports = Boolean(config.includeImports)
 const normalizedUrl = config.civilMemoryUrl
  ? normalizeCivilMemoryBaseUrl(config.civilMemoryUrl)
  : ''

 if (!opts.kv && !normalizedUrl) {
  throw new Error('createLaneHttpServer requires config.civilMemoryUrl or opts.kv')
 }

 const rootKv = opts.kv || httpKV({
  baseUrl: normalizedUrl,
  basePath: config.dataBasePath || null,
  switchable: false,
 })

 let currentTitle = String(config.title || '')
 let startupState = {}
 let startupResults = []
 let startupError = null
 let handlersInfo = { hasHandlers: false, methods: [], handlers: {} }
 let loadedAt = null

 async function evaluateLane(targetId, { req = null, stack = new Set(), requireExists = false } = {}) {
  const laneData = rootKv.namespace(targetId)
  const [loadedScript, storedInputs, tables, storedTitle] = await Promise.all([
   loadLaneScript(rootKv, laneData, targetId, null),
   laneData.get('inputs'),
   loadLaneTables(rootKv, laneData, targetId),
   laneData.get('title'),
  ])

  const hasData = Boolean(
   (loadedScript && loadedScript.initialized) ||
   (storedInputs !== null && storedInputs !== undefined && storedInputs !== '') ||
   (Array.isArray(tables) && tables.length > 0) ||
   (storedTitle !== null && storedTitle !== undefined && storedTitle !== '')
  )

  if (requireExists && !hasData) {
   return { exists: false, state: null, results: [], title: '' }
  }

  const lines = Array.isArray(loadedScript && loadedScript.records)
   ? loadedScript.records.map(r => (r && r.text !== undefined && r.text !== null ? String(r.text) : ''))
   : []
  const inputs = parseStoredInputs(storedInputs)
  const nextStack = new Set(stack)
  nextStack.add(targetId)

  const importLane = async (depId, ...propPath) => {
   if (!includeImports) {
    return undefined
   }
   const cleanDep = depId === null || depId === undefined ? '' : String(depId).trim()
   if (!cleanDep) {
    return undefined
   }
   if (cleanDep === targetId || nextStack.has(cleanDep)) {
    return resolveImportValue({ ok: false, state: null, error: 'Circular lane import detected' }, propPath)
   }
   const depRes = await evaluateLane(cleanDep, { req: null, stack: nextStack, requireExists: true })
   if (!depRes.exists) {
    return undefined
   }
   return resolveImportValue({ ok: true, state: depRes.state, error: null }, propPath)
  }

  const env = {
   console,
   data: laneData,
   Math,
   JSON,
   Date,
   importLane,
   respond: createResponseHelper(),
   ...(req ? { req } : {}),
  }

  for (const entry of inputs) {
   const trimmed = entry.name.trim()
   if (!trimmed) {
    continue
   }
   env[trimmed] = defaultValueForType(entry.type)
  }

  if (Array.isArray(tables) && tables.length > 0) {
   Object.assign(env, buildTablesScope(tables))
  }

  const outcome = await runLines(lines, {
   filename: targetId,
   initialState: env,
  })

  return {
   exists: hasData,
   state: outcome.state,
   results: outcome.results,
   title: storedTitle || '',
  }
 }

 async function reload() {
  try {
   const evaluated = await evaluateLane(laneId, { req: null, stack: new Set(), requireExists: false })
   startupState = evaluated.state || {}
   startupResults = Array.isArray(evaluated.results) ? evaluated.results : []
   if (evaluated.title) {
    currentTitle = evaluated.title
   }
   handlersInfo = detectLaneHandlers(startupState)
   const lineErr = startupResults.find(r => r && r.error)
   startupError = lineErr ? (lineErr.lineNumber ? `Line ${lineErr.lineNumber}: ${lineErr.error}` : lineErr.error) : null
   loadedAt = new Date().toISOString()
  }
  catch (err) {
   startupState = {}
   startupResults = []
   handlersInfo = { hasHandlers: false, methods: [], handlers: {} }
   startupError = err instanceof Error ? err.message : String(err)
   loadedAt = new Date().toISOString()
  }
  return getStatus()
 }

 function getStatus() {
  return {
   ok: !startupError,
   slug: config.slug || '',
   laneId,
   title: currentTitle || config.title || '',
   mode: handlersInfo.hasHandlers ? 'handler' : 'expression',
   handlers: handlersInfo.methods.slice(),
   loadedAt,
   error: startupError,
   civilMemoryUrl: normalizedUrl,
   dataBasePath: config.dataBasePath || null,
   includeImports,
  }
 }

 function sendJsonResponse(res, status, payload) {
  const headers = {
   'Content-Type': 'application/json; charset=utf-8',
   'Cache-Control': 'no-store',
  }
  if (cors) {
   headers['Access-Control-Allow-Origin'] = '*'
   headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS'
   headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, X-Requested-With'
  }
  res.writeHead(status, headers)
  res.end(JSON.stringify(payload))
 }

 const server = http.createServer(async (req, res) => {
  const reqMethod = String(req.method || 'GET').toUpperCase()
  const rawUrl = req.url || '/'
  const pathname = rawUrl.split('?')[0]

  if (pathname === '/_cc/health' && reqMethod === 'GET') {
   return sendJsonResponse(res, 200, getStatus())
  }

  if (pathname === '/_cc/reload' && reqMethod === 'POST') {
   const status = await reload()
   return sendJsonResponse(res, status.ok ? 200 : 500, status)
  }

  let rawBody = ''
  if (reqMethod !== 'GET' && reqMethod !== 'HEAD') {
   try {
    rawBody = await readBodyBuffer(req)
   }
   catch (err) {
    const code = err && err.status ? err.status : 400
    return sendJsonResponse(res, code, { error: err && err.message ? err.message : 'Invalid request body' })
   }
  }

  const forwardedPrefix = req.headers['x-forwarded-prefix']
  const effectiveBasePath = typeof forwardedPrefix === 'string' && forwardedPrefix.trim()
   ? forwardedPrefix.trim()
   : (config.basePath || '')

  const reqObj = buildRequestObject({
   method: reqMethod,
   url: rawUrl,
   basePath: effectiveBasePath,
   headers: req.headers,
   rawBody,
  })

  const runFreshLane = async freshReq => {
   const evaluated = await evaluateLane(laneId, {
    req: freshReq,
    stack: new Set(),
    requireExists: false,
   })
   return evaluated
  }

  const result = await executeLaneHttpRequest({
   req: reqObj,
   laneState: startupState,
   runFreshLane,
   cors,
  })

  res.writeHead(result.status, result.headers)
  res.end(result.bodyText)
 })

 return {
  server,
  reload,
  getStatus,
  listen(port = config.port || 4100, host = config.host || '127.0.0.1') {
   return new Promise((resolve, reject) => {
    const onError = err => {
     server.removeListener('listening', onListening)
     reject(err)
    }
    const onListening = () => {
     server.removeListener('error', onError)
     resolve(server.address())
    }
    server.once('error', onError)
    server.once('listening', onListening)
    server.listen(port, host)
   })
  },
  close() {
   return new Promise((resolve, reject) => {
    if (typeof server.closeAllConnections === 'function') {
     server.closeAllConnections()
    }
    server.close(err => (err ? reject(err) : resolve()))
   })
  },
 }
}

async function runCli() {
 const args = process.argv.slice(2)
 const cfgIdx = args.indexOf('--config')
 const cfgPath = cfgIdx !== -1 && args[cfgIdx + 1]
  ? path.resolve(args[cfgIdx + 1])
  : path.resolve('config.json')
 const raw = await fs.readFile(cfgPath, 'utf8')
 const config = JSON.parse(raw)
 const api = createLaneHttpServer(config)
 const status = await api.reload()
 if (!status.ok) {
  console.warn(`[civil-lane:${status.slug || status.laneId}] startup warning: ${status.error}`)
 }
 const host = config.host || '127.0.0.1'
 const port = Number(config.port) || 4100
 const addr = await api.listen(port, host)
 console.log(`[civil-lane:${status.slug || status.laneId}] listening on http://${addr.address}:${addr.port} (mode=${status.mode})`)

 const shutdown = () => {
  api.close().then(() => process.exit(0), () => process.exit(1))
 }
 process.on('SIGTERM', shutdown)
 process.on('SIGINT', shutdown)
}

const isEntrypoint = process.argv[1] &&
 path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))

if (isEntrypoint) {
 runCli().catch(err => {
  console.error(err && err.stack ? err.stack : err)
  process.exit(1)
 })
}
