import {
 DEFAULT_FIELD_LIMITS,
 DEFAULT_SCROLLBAR_COLOR,
 LANE_TABS,
 buildTablesScope,
 createMaskedSecretValue,
 deserializeTransportPacket,
 field,
 formatValue,
 isDomElement,
 isMaskedSecretValue,
 isValidTimeZone,
 normalizeFieldLimits,
 redactSecretText,
 resolveScrollbarColor,
 runTransportedScripts,
 serializeTransportPacket,
} from './field.mjs'

export const OUTPUT_PROTOCOL = 'cc-lane-output-v1'
export const SOURCE_WORKER_PROTOCOL = 'cc-source-worker-v1'
export const DEFAULT_SOURCE_WORKER_TIMEOUT_MS = 30000

export const OUTPUT_RPC_METHODS = Object.freeze([
 'syncTable',
 'readTable',
 'setSelfLine',
 'getSelfLines',
 'getSelfMeta',
 'setSelfFeatures',
 'openLaneTab',
 'getClockTimezone',
 'setClockTimezone',
 'getClockHourFormat',
 'setClockHourFormat',
 'getClockShowSeconds',
 'setClockShowSeconds',
])

export const SOURCE_WORKER_RPC_METHODS = Object.freeze([
 'console',
 'data.get',
 'data.set',
 'data.delete',
 'syncTable',
 'importLane',
 'exportLaneLine',
 'syncLaneTable',
 'deployLane',
 'fetch',
])

const OUTPUT_RPC_METHOD_SET = new Set(OUTPUT_RPC_METHODS)
const SOURCE_WORKER_RPC_METHOD_SET = new Set(SOURCE_WORKER_RPC_METHODS)
const ALLOWED_LANE_TAB_SET = new Set(LANE_TABS)
const ALLOWED_FEATURE_KEYS = new Set(['httpServer', 'runEvery30Minutes', 'cron30m', 'runEvery30m'])
const FORBIDDEN_OBJECT_KEYS = new Set(['__proto__', 'constructor', 'prototype'])
const ALLOWED_CONSOLE_LEVELS = new Set(['log', 'info', 'warn', 'error'])

const MAX_SHORT_IDENTIFIER_CHARS = 1024
const MAX_LINE_TEXT_CHARS = DEFAULT_FIELD_LIMITS.maxLineBytes
const MAX_RPC_RECORDS = 50000
const MAX_JSON_DEPTH = 32
const MAX_IFRAME_HEIGHT_PX = 50000
const MIN_IFRAME_HEIGHT_PX = 36

const isNodeRuntime = Boolean(
 typeof process !== 'undefined' &&
 process &&
 process.versions &&
 process.versions.node
)

let randomFallbackCounter = 0
function createNonce(prefix = 'cc') {
 const c = globalThis.crypto
 if (c && typeof c.randomUUID === 'function') {
  return `${prefix}-${c.randomUUID()}`
 }
 randomFallbackCounter += 1
 return `${prefix}-${Date.now().toString(36)}-${randomFallbackCounter.toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

function isPlainRecord(value) {
 if (value === null || typeof value !== 'object' || Array.isArray(value)) {
  return false
 }
 const proto = Object.getPrototypeOf(value)
 if (proto === Object.prototype || proto === null) {
  return true
 }
 return Object.prototype.toString.call(value) === '[object Object]' && Object.getPrototypeOf(proto) === null
}

function hasForbiddenOwnKeys(obj) {
 const names = Object.getOwnPropertyNames(obj)
 for (let i = 0; i < names.length; i++) {
  if (FORBIDDEN_OBJECT_KEYS.has(names[i])) {
   return true
  }
 }
 return false
}

function validateSafeJsonValue(value, depth = 0) {
 if (depth > MAX_JSON_DEPTH) {
  return { ok: false, error: 'Payload exceeds maximum nesting depth' }
 }
 if (value === null || value === undefined) {
  return { ok: true }
 }
 const t = typeof value
 if (t === 'boolean') {
  return { ok: true }
 }
 if (t === 'number') {
  return Number.isFinite(value)
   ? { ok: true }
   : { ok: false, error: 'Non-finite number in RPC payload' }
 }
 if (t === 'string') {
  return value.length <= MAX_LINE_TEXT_CHARS
   ? { ok: true }
   : { ok: false, error: 'String exceeds maximum allowed RPC size' }
 }
 if (Array.isArray(value)) {
  if (value.length > MAX_RPC_RECORDS) {
   return { ok: false, error: 'Array exceeds maximum allowed RPC length' }
  }
  for (let i = 0; i < value.length; i++) {
   const check = validateSafeJsonValue(value[i], depth + 1)
   if (!check.ok) {
    return check
   }
  }
  return { ok: true }
 }
 if (isPlainRecord(value)) {
  if (hasForbiddenOwnKeys(value)) {
   return { ok: false, error: 'Forbidden prototype key in RPC object' }
  }
  const keys = Object.keys(value)
  if (keys.length > 1024) {
   return { ok: false, error: 'Object has too many keys in RPC payload' }
  }
  for (let i = 0; i < keys.length; i++) {
   const k = keys[i]
   if (k.length > MAX_SHORT_IDENTIFIER_CHARS) {
    return { ok: false, error: 'Object key exceeds maximum length' }
   }
   const check = validateSafeJsonValue(value[k], depth + 1)
   if (!check.ok) {
    return check
   }
  }
  return { ok: true }
 }
 return { ok: false, error: `Unsupported value type in RPC payload: ${t}` }
}

function cloneSafeJson(value) {
 if (value === undefined) {
  return undefined
 }
 if (value === null || typeof value === 'boolean' || typeof value === 'number' || typeof value === 'string') {
  return value
 }
 if (Array.isArray(value)) {
  return value.map(cloneSafeJson)
 }
 if (isPlainRecord(value)) {
  const out = {}
  for (const key of Object.keys(value)) {
   if (!FORBIDDEN_OBJECT_KEYS.has(key)) {
    const cloned = cloneSafeJson(value[key])
    if (cloned !== undefined) {
     Object.defineProperty(out, key, {
      value: cloned,
      enumerable: true,
      writable: true,
      configurable: true,
     })
    }
   }
  }
  return out
 }
 return undefined
}

function validateRecordList(records) {
 if (!Array.isArray(records)) {
  return { ok: false, error: 'records must be an array of plain objects' }
 }
 if (records.length > MAX_RPC_RECORDS) {
  return { ok: false, error: `records exceeds maximum count (${MAX_RPC_RECORDS})` }
 }
 for (let i = 0; i < records.length; i++) {
  const item = records[i]
  if (!isPlainRecord(item) || hasForbiddenOwnKeys(item)) {
   return { ok: false, error: `records[${i}] must be a plain object without prototype keys` }
  }
  const check = validateSafeJsonValue(item, 1)
  if (!check.ok) {
   return check
  }
 }
 return { ok: true }
}

export function validateOutputRpcRequest(raw) {
 if (!isPlainRecord(raw) || hasForbiddenOwnKeys(raw)) {
  return { ok: false, error: 'RPC message must be a plain object' }
 }
 if (raw.protocol !== OUTPUT_PROTOCOL) {
  return { ok: false, error: 'Invalid output RPC protocol' }
 }
 if (raw.type !== 'rpc-request') {
  return { ok: false, error: 'Invalid output RPC message type' }
 }
 if (typeof raw.frameId !== 'string' || raw.frameId.length === 0 || raw.frameId.length > 128) {
  return { ok: false, error: 'Invalid output RPC frameId' }
 }
 if (!Number.isInteger(raw.requestId) || raw.requestId <= 0) {
  return { ok: false, error: 'Invalid output RPC requestId' }
 }
 if (typeof raw.method !== 'string' || !OUTPUT_RPC_METHOD_SET.has(raw.method)) {
  return { ok: false, error: `Disallowed output RPC method: ${String(raw.method)}` }
 }
 if (!Array.isArray(raw.args)) {
  return { ok: false, error: 'RPC args must be an array' }
 }

 const { method, args } = raw

 switch (method) {
  case 'syncTable': {
   if (args.length < 2 || args.length > 3) {
    return { ok: false, error: 'syncTable expects (tableNameOrId, records, keyColumn?)' }
   }
   if (typeof args[0] !== 'string' || args[0].trim().length === 0 || args[0].length > MAX_SHORT_IDENTIFIER_CHARS) {
    return { ok: false, error: 'syncTable tableNameOrId must be a non-empty string' }
   }
   const recCheck = validateRecordList(args[1])
   if (!recCheck.ok) {
    return recCheck
   }
   if (args.length === 3 && args[2] !== undefined && args[2] !== null) {
    if (typeof args[2] !== 'string' || args[2].length > MAX_SHORT_IDENTIFIER_CHARS) {
     return { ok: false, error: 'syncTable keyColumn must be a string when provided' }
    }
   }
   return {
    ok: true,
    requestId: raw.requestId,
    frameId: raw.frameId,
    method,
    args: [args[0], cloneSafeJson(args[1]), args[2] ?? undefined],
   }
  }

  case 'readTable': {
   if (args.length !== 1 || typeof args[0] !== 'string' || args[0].trim().length === 0 || args[0].length > MAX_SHORT_IDENTIFIER_CHARS) {
    return { ok: false, error: 'readTable expects a single non-empty tableNameOrId string' }
   }
   return { ok: true, requestId: raw.requestId, frameId: raw.frameId, method, args: [args[0]] }
  }

  case 'setSelfLine': {
   if (args.length < 2 || args.length > 3) {
    return { ok: false, error: 'setSelfLine expects (target, nextText, insertIfMissing?)' }
   }
   const target = args[0]
   const validTarget = (typeof target === 'string' && target.length > 0 && target.length <= MAX_LINE_TEXT_CHARS) ||
    (Number.isInteger(target) && target > 0)
   if (!validTarget) {
    return { ok: false, error: 'setSelfLine target must be a non-empty string or positive line number' }
   }
   if (typeof args[1] !== 'string' || args[1].length > MAX_LINE_TEXT_CHARS) {
    return { ok: false, error: 'setSelfLine nextText must be a string within line size limits' }
   }
   if (args.length === 3 && args[2] !== undefined && typeof args[2] !== 'boolean') {
    return { ok: false, error: 'setSelfLine insertIfMissing must be a boolean when provided' }
   }
   return {
    ok: true,
    requestId: raw.requestId,
    frameId: raw.frameId,
    method,
    args: [target, args[1], Boolean(args[2])],
   }
  }

  case 'getSelfLines':
  case 'getSelfMeta':
  case 'getClockTimezone':
  case 'getClockHourFormat':
  case 'getClockShowSeconds': {
   if (args.length !== 0) {
    return { ok: false, error: `${method} takes 0 arguments` }
   }
   return { ok: true, requestId: raw.requestId, frameId: raw.frameId, method, args: [] }
  }

  case 'setSelfFeatures': {
   if (args.length !== 1 || !isPlainRecord(args[0]) || hasForbiddenOwnKeys(args[0])) {
    return { ok: false, error: 'setSelfFeatures expects a single plain features object' }
   }
   const keys = Object.keys(args[0])
   const cleanFeatures = {}
   for (let i = 0; i < keys.length; i++) {
    const k = keys[i]
    if (!ALLOWED_FEATURE_KEYS.has(k)) {
     return { ok: false, error: `Unsupported lane feature key: ${k}` }
    }
    if (typeof args[0][k] !== 'boolean') {
     return { ok: false, error: `Feature flag ${k} must be a boolean` }
    }
    cleanFeatures[k] = args[0][k]
   }
   return { ok: true, requestId: raw.requestId, frameId: raw.frameId, method, args: [cleanFeatures] }
  }

  case 'openLaneTab': {
   if (args.length < 1 || args.length > 2) {
    return { ok: false, error: 'openLaneTab expects (tab, subroute?)' }
   }
   if (typeof args[0] !== 'string') {
    return { ok: false, error: 'openLaneTab tab must be a string' }
   }
   const normalizedTab = args[0].trim().toLowerCase()
   if (!ALLOWED_LANE_TAB_SET.has(normalizedTab)) {
    return { ok: false, error: `Invalid lane tab: ${args[0]}` }
   }
   let cleanSub = ''
   if (args.length === 2 && args[1] !== undefined && args[1] !== null) {
    if (typeof args[1] !== 'string' || args[1].length > MAX_SHORT_IDENTIFIER_CHARS) {
     return { ok: false, error: 'openLaneTab subroute must be a string' }
    }
    cleanSub = args[1]
   }
   return { ok: true, requestId: raw.requestId, frameId: raw.frameId, method, args: [normalizedTab, cleanSub] }
  }

  case 'setClockTimezone': {
   if (args.length !== 1 || typeof args[0] !== 'string' || args[0].trim().length === 0 || args[0].length > 256) {
    return { ok: false, error: 'setClockTimezone expects a non-empty timezone string' }
   }
   const trimmed = args[0].trim()
   if (trimmed.toLowerCase() !== 'browser' && trimmed !== 'UTC' && !isValidTimeZone(trimmed)) {
    return { ok: false, error: `Invalid IANA timezone: ${trimmed}` }
   }
   return { ok: true, requestId: raw.requestId, frameId: raw.frameId, method, args: [trimmed] }
  }

  case 'setClockHourFormat': {
   if (args.length !== 1) {
    return { ok: false, error: 'setClockHourFormat expects 1 argument' }
   }
   const fmt = args[0]
   const validFmt = fmt === '12h' || fmt === '24h' || fmt === '12' || fmt === '24' ||
    fmt === 12 || fmt === 24 || typeof fmt === 'boolean'
   if (!validFmt) {
    return { ok: false, error: 'setClockHourFormat expects "12h" or "24h"' }
   }
   return { ok: true, requestId: raw.requestId, frameId: raw.frameId, method, args: [fmt] }
  }

  case 'setClockShowSeconds': {
   if (args.length !== 1 || typeof args[0] !== 'boolean') {
    return { ok: false, error: 'setClockShowSeconds expects a boolean' }
   }
   return { ok: true, requestId: raw.requestId, frameId: raw.frameId, method, args: [args[0]] }
  }

  default:
   return { ok: false, error: `Disallowed output RPC method: ${method}` }
 }
}

export function validateOutputFrameMessage(raw, expectedFrameId) {
 if (!isPlainRecord(raw) || hasForbiddenOwnKeys(raw)) {
  return { ok: false, error: 'Frame message must be a plain object' }
 }
 if (raw.protocol !== OUTPUT_PROTOCOL) {
  return { ok: false, error: 'Invalid frame protocol' }
 }
 if (typeof expectedFrameId === 'string' && expectedFrameId.length > 0 && raw.frameId !== expectedFrameId) {
  return { ok: false, error: 'Mismatched frameId' }
 }
 if (typeof raw.type !== 'string') {
  return { ok: false, error: 'Missing frame message type' }
 }
 if (raw.type === 'rpc-request') {
  return validateOutputRpcRequest(raw)
 }
 if (raw.type === 'ready') {
  return { ok: true, type: 'ready', frameId: raw.frameId }
 }
 if (raw.type === 'resize') {
  if (typeof raw.height !== 'number' || !Number.isFinite(raw.height) || raw.height < 0) {
   return { ok: false, error: 'Invalid resize height' }
  }
  const clamped = Math.min(MAX_IFRAME_HEIGHT_PX, Math.max(MIN_IFRAME_HEIGHT_PX, Math.ceil(raw.height)))
  return { ok: true, type: 'resize', frameId: raw.frameId, height: clamped }
 }
 if (raw.type === 'runtime-error') {
  const msg = typeof raw.message === 'string' ? raw.message.slice(0, 8192) : 'Runtime error'
  const lineNumber = Number.isInteger(raw.lineNumber) && raw.lineNumber > 0 ? raw.lineNumber : null
  return { ok: true, type: 'runtime-error', frameId: raw.frameId, message: msg, lineNumber }
 }
 if (raw.type === 'run-complete') {
  if (!Number.isInteger(raw.renderId) || raw.renderId < 0 || !Array.isArray(raw.results)) {
   return { ok: false, error: 'Invalid run-complete message' }
  }
  const cleanResults = []
  for (let i = 0; i < raw.results.length && i < 10000; i++) {
   const r = raw.results[i]
   if (!isPlainRecord(r) || hasForbiddenOwnKeys(r)) {
    return { ok: false, error: 'Invalid result entry in run-complete' }
   }
   cleanResults.push({
    index: Number.isInteger(r.index) ? r.index : i,
    lineNumber: Number.isInteger(r.lineNumber) ? r.lineNumber : null,
    preview: typeof r.preview === 'string' ? r.preview.slice(0, 16384) : '',
    appended: Boolean(r.appended),
    error: typeof r.error === 'string' && r.error.length > 0 ? r.error.slice(0, 16384) : null,
   })
  }
  return { ok: true, type: 'run-complete', frameId: raw.frameId, renderId: raw.renderId, results: cleanResults }
 }
 return { ok: false, error: `Unknown frame message type: ${raw.type}` }
}

function normalizeLineContext(raw) {
 if (!isPlainRecord(raw) || hasForbiddenOwnKeys(raw)) {
  return { index: null, lineNumber: null, lineId: '' }
 }
 return {
  index: Number.isInteger(raw.index) && raw.index >= 0 ? raw.index : null,
  lineNumber: Number.isInteger(raw.lineNumber) && raw.lineNumber > 0 ? raw.lineNumber : null,
  lineId: typeof raw.lineId === 'string' && raw.lineId.length <= 256 ? raw.lineId : '',
 }
}

export function validateSourceFetchUrl(rawUrl, hostOrigin = '') {
 if (typeof rawUrl !== 'string' || rawUrl.trim().length === 0 || rawUrl.length > 8192) {
  return { ok: false, error: 'fetch URL must be a non-empty http:// or https:// URL' }
 }
 const trimmed = rawUrl.trim()
 if (!/^https?:\/\//i.test(trimmed)) {
  return { ok: false, error: 'Source fetch requires an absolute http:// or https:// URL (relative URLs are blocked)' }
 }
 let parsed
 try {
  parsed = new URL(trimmed)
 }
 catch {
  return { ok: false, error: `Invalid fetch URL: ${trimmed}` }
 }
 if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
  return { ok: false, error: `Unsupported fetch protocol: ${parsed.protocol}` }
 }
 const cleanHostOrigin = typeof hostOrigin === 'string' ? hostOrigin.trim() : ''
 if (cleanHostOrigin && cleanHostOrigin !== 'null') {
  try {
   const hostUrl = new URL(cleanHostOrigin)
   if (parsed.origin === hostUrl.origin) {
    return { ok: false, error: 'Source fetch cannot target the Civil Command host origin' }
   }
  }
  catch {
   // Ignore malformed hostOrigin
  }
 }
 if (parsed.pathname === '/api' || parsed.pathname.startsWith('/api/')) {
  const isLoopback = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1' || parsed.hostname === '[::1]'
  if (isLoopback && (parsed.port === '8080' || parsed.port === '3333')) {
   return { ok: false, error: 'Source fetch cannot access internal Civil Command /api/* endpoints' }
  }
 }
 return { ok: true, url: parsed.toString() }
}

export function validateSourceWorkerRpcRequest(raw, options = {}) {
 if (!isPlainRecord(raw) || hasForbiddenOwnKeys(raw)) {
  return { ok: false, error: 'Worker RPC message must be a plain object' }
 }
 if (raw.protocol !== SOURCE_WORKER_PROTOCOL || raw.type !== 'rpc-request') {
  return { ok: false, error: 'Invalid worker RPC envelope' }
 }
 if (!Number.isInteger(raw.runId) || raw.runId <= 0) {
  return { ok: false, error: 'Invalid worker RPC runId' }
 }
 if (!Number.isInteger(raw.requestId) || raw.requestId <= 0) {
  return { ok: false, error: 'Invalid worker RPC requestId' }
 }
 if (typeof raw.method !== 'string' || !SOURCE_WORKER_RPC_METHOD_SET.has(raw.method)) {
  return { ok: false, error: `Disallowed worker RPC method: ${String(raw.method)}` }
 }

 const lineContext = normalizeLineContext(raw.lineContext)
 const params = isPlainRecord(raw.params) && !hasForbiddenOwnKeys(raw.params) ? raw.params : null
 if (!params) {
  return { ok: false, error: 'Worker RPC params must be a plain object' }
 }

 switch (raw.method) {
  case 'console': {
   const level = typeof params.level === 'string' && ALLOWED_CONSOLE_LEVELS.has(params.level) ? params.level : 'log'
   const args = Array.isArray(params.args)
    ? params.args.slice(0, 32).map(a => String(a ?? '').slice(0, 16384))
    : []
   return { ok: true, runId: raw.runId, requestId: raw.requestId, method: raw.method, params: { level, args }, lineContext }
  }

  case 'data.get':
  case 'data.delete': {
   if (typeof params.key !== 'string' || params.key.length === 0 || params.key.length > MAX_SHORT_IDENTIFIER_CHARS) {
    return { ok: false, error: `${raw.method} requires a non-empty key string` }
   }
   const prefix = typeof params.prefix === 'string' && params.prefix.length <= MAX_SHORT_IDENTIFIER_CHARS ? params.prefix : ''
   return {
    ok: true,
    runId: raw.runId,
    requestId: raw.requestId,
    method: raw.method,
    params: { prefix, key: params.key },
    lineContext,
   }
  }

  case 'data.set': {
   if (typeof params.key !== 'string' || params.key.length === 0 || params.key.length > MAX_SHORT_IDENTIFIER_CHARS) {
    return { ok: false, error: 'data.set requires a non-empty key string' }
   }
   const value = params.value === null || params.value === undefined ? '' : String(params.value)
   if (value.length > DEFAULT_FIELD_LIMITS.maxScriptBytes) {
    return { ok: false, error: 'data.set value exceeds maximum size' }
   }
   const prefix = typeof params.prefix === 'string' && params.prefix.length <= MAX_SHORT_IDENTIFIER_CHARS ? params.prefix : ''
   return {
    ok: true,
    runId: raw.runId,
    requestId: raw.requestId,
    method: raw.method,
    params: { prefix, key: params.key, value },
    lineContext,
   }
  }

  case 'syncTable': {
   if (typeof params.tblQuery !== 'string' || params.tblQuery.trim().length === 0 || params.tblQuery.length > MAX_SHORT_IDENTIFIER_CHARS) {
    return { ok: false, error: 'syncTable requires a non-empty table name or ID' }
   }
   const recCheck = validateRecordList(params.records)
   if (!recCheck.ok) {
    return recCheck
   }
   const keyCol = params.keyCol === undefined || params.keyCol === null
    ? undefined
    : (typeof params.keyCol === 'string' && params.keyCol.length <= MAX_SHORT_IDENTIFIER_CHARS ? params.keyCol : null)
   if (keyCol === null) {
    return { ok: false, error: 'syncTable keyCol must be a string when provided' }
   }
   return {
    ok: true,
    runId: raw.runId,
    requestId: raw.requestId,
    method: raw.method,
    params: { tblQuery: params.tblQuery, records: cloneSafeJson(params.records), keyCol },
    lineContext,
   }
  }

  case 'importLane': {
   if (typeof params.targetId !== 'string' || params.targetId.length > MAX_SHORT_IDENTIFIER_CHARS) {
    return { ok: false, error: 'importLane targetId must be a string' }
   }
   if (!Array.isArray(params.path) || params.path.length > 64) {
    return { ok: false, error: 'importLane path must be an array' }
   }
   const cleanPath = []
   for (let i = 0; i < params.path.length; i++) {
    const seg = params.path[i]
    if (typeof seg !== 'string' && typeof seg !== 'number') {
     return { ok: false, error: 'importLane path segments must be strings or numbers' }
    }
    cleanPath.push(String(seg))
   }
   return {
    ok: true,
    runId: raw.runId,
    requestId: raw.requestId,
    method: raw.method,
    params: { targetId: params.targetId, path: cleanPath },
    lineContext,
   }
  }

  case 'exportLaneLine': {
   const c1 = validateSafeJsonValue(params.firstArg)
   const c2 = validateSafeJsonValue(params.secondArg)
   const c3 = validateSafeJsonValue(params.thirdArg)
   if (!c1.ok || !c2.ok || !c3.ok) {
    return { ok: false, error: 'Invalid arguments for exportLaneLine' }
   }
   return {
    ok: true,
    runId: raw.runId,
    requestId: raw.requestId,
    method: raw.method,
    params: {
     firstArg: cloneSafeJson(params.firstArg),
     secondArg: cloneSafeJson(params.secondArg),
     thirdArg: cloneSafeJson(params.thirdArg),
    },
    lineContext,
   }
  }

  case 'syncLaneTable': {
   if (typeof params.targetId !== 'string' || params.targetId.length > MAX_SHORT_IDENTIFIER_CHARS) {
    return { ok: false, error: 'syncLaneTable targetId must be a string' }
   }
   if (typeof params.tblQuery !== 'string' || params.tblQuery.length > MAX_SHORT_IDENTIFIER_CHARS) {
    return { ok: false, error: 'syncLaneTable tblQuery must be a string' }
   }
   const recCheck = validateRecordList(params.records)
   if (!recCheck.ok) {
    return recCheck
   }
   const keyCol = params.keyCol === undefined || params.keyCol === null
    ? undefined
    : (typeof params.keyCol === 'string' && params.keyCol.length <= MAX_SHORT_IDENTIFIER_CHARS ? params.keyCol : null)
   if (keyCol === null) {
    return { ok: false, error: 'syncLaneTable keyCol must be a string when provided' }
   }
   return {
    ok: true,
    runId: raw.runId,
    requestId: raw.requestId,
    method: raw.method,
    params: {
     targetId: params.targetId,
     tblQuery: params.tblQuery,
     records: cloneSafeJson(params.records),
     keyCol,
    },
    lineContext,
   }
  }

  case 'deployLane': {
   if (typeof params.targetId !== 'string' || params.targetId.length > MAX_SHORT_IDENTIFIER_CHARS) {
    return { ok: false, error: 'deployLane targetId must be a string' }
   }
   let deployOpts = undefined
   if (params.deployOpts !== undefined && params.deployOpts !== null) {
    const optCheck = validateSafeJsonValue(params.deployOpts)
    if (!optCheck.ok || !isPlainRecord(params.deployOpts)) {
     return { ok: false, error: 'deployLane options must be a plain JSON object' }
    }
    deployOpts = cloneSafeJson(params.deployOpts)
   }
   return {
    ok: true,
    runId: raw.runId,
    requestId: raw.requestId,
    method: raw.method,
    params: { targetId: params.targetId, deployOpts },
    lineContext,
   }
  }

  case 'fetch': {
   const urlCheck = validateSourceFetchUrl(params.url, options.hostOrigin)
   if (!urlCheck.ok) {
    return urlCheck
   }
   let cleanInit = undefined
   if (params.init !== undefined && params.init !== null) {
    if (!isPlainRecord(params.init) || hasForbiddenOwnKeys(params.init)) {
     return { ok: false, error: 'fetch options must be a plain object' }
    }
    cleanInit = {}
    if (params.init.method !== undefined) {
     if (typeof params.init.method !== 'string' || params.init.method.length > 32) {
      return { ok: false, error: 'fetch method must be a string' }
     }
     cleanInit.method = params.init.method
    }
    if (params.init.headers !== undefined && params.init.headers !== null) {
     if (!isPlainRecord(params.init.headers) || hasForbiddenOwnKeys(params.init.headers)) {
      return { ok: false, error: 'fetch headers must be a plain object' }
     }
     const cleanHeaders = {}
     for (const [hk, hv] of Object.entries(params.init.headers)) {
      if (hk.length > 256 || typeof hv !== 'string' && typeof hv !== 'number' && typeof hv !== 'boolean') {
       return { ok: false, error: `Invalid fetch header: ${hk}` }
      }
      cleanHeaders[hk] = String(hv)
     }
     cleanInit.headers = cleanHeaders
    }
    if (params.init.body !== undefined && params.init.body !== null) {
     if (typeof params.init.body !== 'string' || params.init.body.length > 4 * 1024 * 1024) {
      return { ok: false, error: 'fetch body must be a string (<= 4 MiB)' }
     }
     cleanInit.body = params.init.body
    }
   }
   return {
    ok: true,
    runId: raw.runId,
    requestId: raw.requestId,
    method: raw.method,
    params: { url: urlCheck.url, init: cleanInit },
    lineContext,
   }
  }

  default:
   return { ok: false, error: `Disallowed worker RPC method: ${raw.method}` }
 }
}

// ============================================================================
// Cross-Realm Wire Graph Codec (handles cycles, will ASTs, masked secrets, etc.)
// ============================================================================

const TYPED_ARRAY_CTORS = {
 Uint8Array,
 Int8Array,
 Uint8ClampedArray,
 Int16Array,
 Uint16Array,
 Int32Array,
 Uint32Array,
 Float32Array,
 Float64Array,
}

export function encodeWireValue(rootValue) {
 const nodes = []
 const seen = new Map()

 function encodeAny(val) {
  if (val === null || typeof val === 'boolean' || typeof val === 'string') {
   return val
  }
  if (val === undefined) {
   return { $t: 'undef' }
  }
  if (typeof val === 'number') {
   if (Number.isNaN(val)) {
    return { $t: 'nan' }
   }
   if (!Number.isFinite(val)) {
    return { $t: 'inf', s: val > 0 ? 1 : -1 }
   }
   if (Object.is(val, -0)) {
    return { $t: 'neg0' }
   }
   return val
  }
  if (typeof val === 'bigint') {
   return { $t: 'bigint', v: String(val) }
  }
  if (typeof val === 'symbol') {
   return { $t: 'symbol', v: val.description ?? '' }
  }
  if (typeof val !== 'object' && typeof val !== 'function') {
   return String(val)
  }

  if (seen.has(val)) {
   return { $r: seen.get(val) }
  }
  const id = nodes.length
  seen.set(val, id)
  nodes.push(null)

  if (isMaskedSecretValue(val)) {
   nodes[id] = {
    k: 'secret',
    name: typeof val.name === 'string' ? val.name : '',
    secretSet: Boolean(val.secretSet),
   }
   return { $r: id }
  }

  if (typeof val === 'function') {
   const props = []
   for (const key of Object.keys(val)) {
    if (key !== 'ast' && !FORBIDDEN_OBJECT_KEYS.has(key)) {
     try {
      props.push([key, encodeAny(val[key])])
     }
     catch {
      // Ignore throwing function property getters
     }
    }
   }
   if (Array.isArray(val.ast)) {
    nodes[id] = {
     k: 'will',
     name: typeof val.name === 'string' ? val.name : '',
     ast: cloneSafeJson(val.ast) || [],
     props,
    }
   }
   else {
    nodes[id] = {
     k: 'fn',
     name: typeof val.name === 'string' ? val.name : '',
     props,
    }
   }
   return { $r: id }
  }

  if (isDomElement(val)) {
   const tag = typeof val.tagName === 'string'
    ? val.tagName.toLowerCase()
    : (typeof val.tag === 'string' ? val.tag.toLowerCase() : 'element')
   nodes[id] = { k: 'dom', tag }
   return { $r: id }
  }

  if (Array.isArray(val)) {
   const items = new Array(val.length)
   for (let i = 0; i < val.length; i++) {
    items[i] = encodeAny(val[i])
   }
   nodes[id] = { k: 'arr', items }
   return { $r: id }
  }

  if (val instanceof Date) {
   nodes[id] = { k: 'date', ms: val.getTime() }
   return { $r: id }
  }

  if (val instanceof RegExp) {
   nodes[id] = { k: 'regexp', source: val.source, flags: val.flags }
   return { $r: id }
  }

  if (val instanceof Map) {
   const entries = []
   for (const [mk, mv] of val.entries()) {
    entries.push([encodeAny(mk), encodeAny(mv)])
   }
   nodes[id] = { k: 'map', entries }
   return { $r: id }
  }

  if (val instanceof Set) {
   const values = []
   for (const sv of val.values()) {
    values.push(encodeAny(sv))
   }
   nodes[id] = { k: 'set', values }
   return { $r: id }
  }

  if (val instanceof Error) {
   nodes[id] = {
    k: 'error',
    name: val.name || 'Error',
    message: val.message || '',
    fieldLocation: isPlainRecord(val.fieldLocation) ? cloneSafeJson(val.fieldLocation) : null,
   }
   return { $r: id }
  }

  if (ArrayBuffer.isView(val)) {
   const ctor = val.constructor && typeof val.constructor.name === 'string' ? val.constructor.name : 'Uint8Array'
   const bytes = Array.from(new Uint8Array(val.buffer, val.byteOffset, val.byteLength))
   nodes[id] = { k: 'bytes', ctor, bytes }
   return { $r: id }
  }

  if (val instanceof Promise || typeof val.then === 'function') {
   nodes[id] = { k: 'promise' }
   return { $r: id }
  }

  const entries = []
  const propNames = Object.getOwnPropertyNames(val)
  for (let i = 0; i < propNames.length; i++) {
   const key = propNames[i]
   if (key === '__proto__') {
    continue
   }
   const desc = Object.getOwnPropertyDescriptor(val, key)
   const isEnum = Boolean(desc && desc.enumerable)
   try {
    entries.push([key, encodeAny(val[key]), isEnum])
   }
   catch {
    // Skip throwing getters
   }
  }
  nodes[id] = { k: 'obj', entries }
  return { $r: id }
 }

 const root = encodeAny(rootValue)
 return { __ccGraph: 1, root, nodes }
}

export function decodeWireValue(wire, options = {}) {
 if (!wire || typeof wire !== 'object' || wire.__ccGraph !== 1 || !Array.isArray(wire.nodes)) {
  return wire
 }
 const compileWill = typeof options.compileWill === 'function' ? options.compileWill : null
 const nodes = wire.nodes
 const decoded = new Array(nodes.length)
 const initialized = new Array(nodes.length).fill(false)

 function decodeNode(id) {
  if (initialized[id]) {
   return decoded[id]
  }
  const spec = nodes[id]
  if (!spec || typeof spec !== 'object') {
   initialized[id] = true
   decoded[id] = null
   return null
  }

  switch (spec.k) {
   case 'secret': {
    const val = createMaskedSecretValue(spec.name || '', Boolean(spec.secretSet))
    decoded[id] = val
    initialized[id] = true
    return val
   }

   case 'will': {
    const ast = Array.isArray(spec.ast) ? cloneSafeJson(spec.ast) : []
    let fn
    if (compileWill) {
     fn = compileWill(ast)
    }
    else {
     fn = function sandboxedWillStub() {
      throw new Error('Sandboxed lane will function cannot be invoked directly on the host thread')
     }
     fn.ast = ast
     fn.__ccSandboxedStub = true
    }
    decoded[id] = fn
    initialized[id] = true
    if (Array.isArray(spec.props)) {
     for (const [pk, pv] of spec.props) {
      if (typeof pk === 'string' && !FORBIDDEN_OBJECT_KEYS.has(pk) && pk !== 'ast') {
       Object.defineProperty(fn, pk, {
        value: decodeAny(pv),
        enumerable: true,
        writable: true,
        configurable: true,
       })
      }
     }
    }
    return fn
   }

   case 'fn': {
    const fn = function sandboxedFunctionStub() {
     throw new Error('Sandboxed lane function cannot be invoked directly on the host thread')
    }
    fn.__ccSandboxedStub = true
    if (typeof spec.name === 'string' && spec.name.length > 0) {
     Object.defineProperty(fn, 'name', { value: spec.name, configurable: true })
    }
    decoded[id] = fn
    initialized[id] = true
    if (Array.isArray(spec.props)) {
     for (const [pk, pv] of spec.props) {
      if (typeof pk === 'string' && !FORBIDDEN_OBJECT_KEYS.has(pk)) {
       Object.defineProperty(fn, pk, {
        value: decodeAny(pv),
        enumerable: true,
        writable: true,
        configurable: true,
       })
      }
     }
    }
    return fn
   }

   case 'dom': {
    const out = { nodeType: 1, tag: String(spec.tag || 'element') }
    decoded[id] = out
    initialized[id] = true
    return out
   }

   case 'arr': {
    const arr = []
    decoded[id] = arr
    initialized[id] = true
    const items = Array.isArray(spec.items) ? spec.items : []
    for (let i = 0; i < items.length; i++) {
     arr.push(decodeAny(items[i]))
    }
    return arr
   }

   case 'date': {
    const d = new Date(Number(spec.ms))
    decoded[id] = d
    initialized[id] = true
    return d
   }

   case 'regexp': {
    let re
    try {
     re = new RegExp(String(spec.source ?? ''), String(spec.flags ?? ''))
    }
    catch {
     re = /(?:)/
    }
    decoded[id] = re
    initialized[id] = true
    return re
   }

   case 'map': {
    const m = new Map()
    decoded[id] = m
    initialized[id] = true
    if (Array.isArray(spec.entries)) {
     for (const [mk, mv] of spec.entries) {
      m.set(decodeAny(mk), decodeAny(mv))
     }
    }
    return m
   }

   case 'set': {
    const s = new Set()
    decoded[id] = s
    initialized[id] = true
    if (Array.isArray(spec.values)) {
     for (const sv of spec.values) {
      s.add(decodeAny(sv))
     }
    }
    return s
   }

   case 'error': {
    const err = new Error(String(spec.message ?? ''))
    err.name = String(spec.name || 'Error')
    if (isPlainRecord(spec.fieldLocation)) {
     err.fieldLocation = cloneSafeJson(spec.fieldLocation)
    }
    decoded[id] = err
    initialized[id] = true
    return err
   }

   case 'bytes': {
    const u8 = new Uint8Array(Array.isArray(spec.bytes) ? spec.bytes : [])
    const Ctor = TYPED_ARRAY_CTORS[spec.ctor] || Uint8Array
    let view
    try {
     view = Ctor === Uint8Array
      ? u8
      : new Ctor(u8.buffer, u8.byteOffset, Math.floor(u8.byteLength / Ctor.BYTES_PER_ELEMENT))
    }
    catch {
     view = u8
    }
    decoded[id] = view
    initialized[id] = true
    return view
   }

   case 'promise': {
    const p = Promise.resolve(undefined)
    decoded[id] = p
    initialized[id] = true
    return p
   }

   case 'obj':
   default: {
    const obj = {}
    decoded[id] = obj
    initialized[id] = true
    if (Array.isArray(spec.entries)) {
     for (const entry of spec.entries) {
      if (!Array.isArray(entry) || typeof entry[0] !== 'string') {
       continue
      }
      const [key, valSpec, isEnum] = entry
      if (key === '__proto__') {
       continue
      }
      Object.defineProperty(obj, key, {
       value: decodeAny(valSpec),
       enumerable: isEnum !== false,
       writable: true,
       configurable: true,
      })
     }
    }
    return obj
   }
  }
 }

 function decodeAny(val) {
  if (val === null || typeof val === 'boolean' || typeof val === 'number' || typeof val === 'string') {
   return val
  }
  if (!val || typeof val !== 'object') {
   return val
  }
  if (Object.hasOwn(val, '$r') && Number.isInteger(val.$r) && val.$r >= 0 && val.$r < nodes.length) {
   return decodeNode(val.$r)
  }
  if (Object.hasOwn(val, '$t')) {
   switch (val.$t) {
    case 'undef': return undefined
    case 'nan': return NaN
    case 'inf': return val.s < 0 ? -Infinity : Infinity
    case 'neg0': return -0
    case 'bigint': return BigInt(val.v)
    case 'symbol': return Symbol(val.v || '')
    default: return undefined
   }
  }
  return val
 }

 return decodeAny(wire.root)
}

export function encodeWireState(state, excludedKeys = new Set()) {
 const plain = {}
 if (state && typeof state === 'object') {
  let cur = state
  const seen = new Set()
  while (cur && cur !== Object.prototype) {
   for (const key of Object.getOwnPropertyNames(cur)) {
    if (key === '__proto__' || seen.has(key) || excludedKeys.has(key)) {
     continue
    }
    seen.add(key)
    try {
     Object.defineProperty(plain, key, {
      value: state[key],
      enumerable: true,
      writable: true,
      configurable: true,
     })
    }
    catch {
     // Skip throwing getters
    }
   }
   cur = Object.getPrototypeOf(cur)
  }
 }
 return encodeWireValue(plain)
}

export function decodeWireState(encodedState, baseEnv = {}, options = {}) {
 const merged = {}
 if (baseEnv && typeof baseEnv === 'object') {
  for (const key of Object.keys(baseEnv)) {
   if (!key.startsWith('__secret') && key !== '__proto__') {
    Object.defineProperty(merged, key, {
     value: baseEnv[key],
     enumerable: true,
     writable: true,
     configurable: true,
    })
   }
  }
 }
 const decoded = decodeWireValue(encodedState, options)
 if (decoded && typeof decoded === 'object') {
  for (const key of Object.getOwnPropertyNames(decoded)) {
   if (key === '__proto__') {
    continue
   }
   const desc = Object.getOwnPropertyDescriptor(decoded, key)
   Object.defineProperty(merged, key, {
    value: decoded[key],
    enumerable: desc ? Boolean(desc.enumerable) : true,
    writable: true,
    configurable: true,
   })
  }
 }
 return merged
}

// ============================================================================
// Dedicated Source Worker Runner (Browser Web Worker + Node worker_threads)
// ============================================================================

let nodeWorkerThreadsPromise = null
const MAX_IDLE_NODE_WORKERS = 2
const idleNodeWorkers = []

async function getNodeWorkerClass() {
 if (!nodeWorkerThreadsPromise) {
  const spec = 'node:worker_threads'
  nodeWorkerThreadsPromise = import(spec).then(m => m.Worker)
 }
 return nodeWorkerThreadsPromise
}

async function createPlatformWorker(workerUrl) {
 if (typeof globalThis.Worker === 'function') {
  const resolvedUrl = workerUrl || '/source-worker.mjs'
  const w = new globalThis.Worker(resolvedUrl, { type: 'module' })
  return {
   isBrowserWorker: true,
   postMessage(msg) {
    w.postMessage(msg)
   },
   subscribe(onMessage, onError) {
    const msgHandler = ev => onMessage(ev && typeof ev === 'object' && 'data' in ev ? ev.data : ev)
    const errHandler = ev => onError(ev && ev.message ? new Error(ev.message) : new Error('Source Worker error'))
    w.addEventListener('message', msgHandler)
    w.addEventListener('error', errHandler)
    w.addEventListener('messageerror', errHandler)
    return () => {
     w.removeEventListener('message', msgHandler)
     w.removeEventListener('error', errHandler)
     w.removeEventListener('messageerror', errHandler)
    }
   },
   terminate() {
    w.terminate()
   },
  }
 }

 if (isNodeRuntime) {
  if (idleNodeWorkers.length > 0) {
   return idleNodeWorkers.pop()
  }
  const NodeWorker = await getNodeWorkerClass()
  const scriptUrl = new URL('./source-worker.mjs', import.meta.url)
  const w = new NodeWorker(scriptUrl, { execArgv: [] })
  if (typeof w.unref === 'function') {
   w.unref()
  }
  const wrapper = {
   isBrowserWorker: false,
   terminated: false,
   postMessage(msg) {
    w.postMessage(msg)
   },
   subscribe(onMessage, onError) {
    const msgHandler = data => onMessage(data)
    const errHandler = err => onError(err instanceof Error ? err : new Error(String(err)))
    const exitHandler = code => {
     if (!wrapper.terminated && code !== 0) {
      onError(new Error(`Source Worker exited with code ${code}`))
     }
    }
    w.on('message', msgHandler)
    w.on('error', errHandler)
    w.on('exit', exitHandler)
    if (typeof w.unref === 'function') {
     w.unref()
    }
    return () => {
     w.off('message', msgHandler)
     w.off('error', errHandler)
     w.off('exit', exitHandler)
     if (typeof w.unref === 'function') {
      w.unref()
     }
    }
   },
   terminate() {
    wrapper.terminated = true
    w.terminate()
   },
  }
  return wrapper
 }

 throw new Error('Web Worker runtime is not available')
}

function releaseCleanNodeWorker(workerHandle) {
 if (!workerHandle || workerHandle.isBrowserWorker || workerHandle.terminated) {
  return
 }
 if (idleNodeWorkers.length < MAX_IDLE_NODE_WORKERS) {
  idleNodeWorkers.push(workerHandle)
 }
 else {
  workerHandle.terminate()
 }
}

function resolveWorkerTimeoutMs(runOpts = {}, runnerOpts = {}) {
 const candidates = [
  runOpts && runOpts.timeoutMs,
  runOpts && runOpts.limits && runOpts.limits.maxExecutionMs,
  runnerOpts && runnerOpts.timeoutMs,
  typeof globalThis !== 'undefined' && globalThis.CC_SOURCE_WORKER_TIMEOUT_MS,
  typeof globalThis !== 'undefined' && globalThis.CC_FIELD_LIMITS && globalThis.CC_FIELD_LIMITS.maxExecutionMs,
 ]
 for (const candidate of candidates) {
  if (candidate !== undefined && candidate !== null && candidate !== '') {
   const n = Number(candidate)
   if (Number.isFinite(n) && n > 0) {
    return Math.trunc(n)
   }
  }
 }
 return DEFAULT_SOURCE_WORKER_TIMEOUT_MS
}

const HOST_ENV_BUILTIN_KEYS = new Set([
 'Array',
 'Date',
 'JSON',
 'Math',
 'Number',
 'console',
 'data',
 'deployLane',
 'exportLaneLine',
 'fetch',
 'importLane',
 'respond',
 'resyncLane',
 'setLaneLine',
 'syncLaneTable',
 'syncTable',
 'tableChange',
 '__secretNames',
 '__secretSetNames',
 '__secretValues',
])

function extractInitialWorkerPayload(initialState = {}) {
 const inputsEnv = {}
 const tablesScope = {}
 const src = initialState && typeof initialState === 'object' ? initialState : {}
 const secretNames = Array.isArray(src.__secretNames) ? src.__secretNames.map(s => String(s || '').trim()).filter(Boolean) : []
 const secretSetNames = Array.isArray(src.__secretSetNames) ? src.__secretSetNames.map(s => String(s || '').trim()).filter(Boolean) : []
 const secretValues = Array.isArray(src.__secretValues) ? src.__secretValues.filter(v => typeof v === 'string' && v.length > 0) : []

 for (const key of Object.keys(src)) {
  if (HOST_ENV_BUILTIN_KEYS.has(key)) {
   continue
  }
  const val = src[key]
  if (typeof val === 'function') {
   continue
  }
  if (Array.isArray(val)) {
   tablesScope[key] = cloneSafeJson(val) ?? []
  }
  else {
   inputsEnv[key] = cloneSafeJson(val)
  }
 }

 const tableChange = isPlainRecord(src.tableChange) ? cloneSafeJson(src.tableChange) : null
 return {
  inputsEnv,
  tablesScope,
  tableChange,
  secretMeta: {
   secretNames,
   secretSetNames,
   secretValues,
  },
 }
}

function sanitizeSyncTableResult(res) {
 if (!res || typeof res !== 'object') {
  return { ok: false, count: 0, added: 0, updated: 0, removed: 0, changed: false }
 }
 return {
  ok: Boolean(res.ok),
  changed: Boolean(res.changed),
  count: Number.isFinite(Number(res.count)) ? Number(res.count) : 0,
  added: Number.isFinite(Number(res.added)) ? Number(res.added) : 0,
  updated: Number.isFinite(Number(res.updated)) ? Number(res.updated) : 0,
  removed: Number.isFinite(Number(res.removed)) ? Number(res.removed) : 0,
  changedCount: Number.isFinite(Number(res.changedCount)) ? Number(res.changedCount) : 0,
  laneId: typeof res.laneId === 'string' ? res.laneId : undefined,
  table: res.table && typeof res.table === 'object'
   ? { id: String(res.table.id || ''), name: String(res.table.name || '') }
   : undefined,
  error: res.error ? String(res.error) : undefined,
 }
}

function resolveScopedLaneKv(laneData, prefix = '') {
 if (!laneData || typeof laneData.get !== 'function') {
  return null
 }
 const cleanPrefix = typeof prefix === 'string' ? prefix.trim() : ''
 if (!cleanPrefix) {
  return laneData
 }
 if (typeof laneData.namespace === 'function') {
  return laneData.namespace(cleanPrefix)
 }
 return null
}

function resolveHostOrigin() {
 if (typeof globalThis.location === 'object' && globalThis.location && typeof globalThis.location.origin === 'string') {
  return globalThis.location.origin
 }
 return ''
}

async function dispatchSourceWorkerRpc(validated, context) {
 const { initialState, lineContext, hostFetch, hostOrigin } = context
 if (lineContext && typeof lineContext === 'object' && validated.lineContext) {
  lineContext.index = validated.lineContext.index
  lineContext.lineNumber = validated.lineContext.lineNumber
  lineContext.lineId = validated.lineContext.lineId
 }

 const { method, params } = validated

 switch (method) {
  case 'console': {
   const cons = initialState && initialState.console ? initialState.console : null
   const fn = cons && typeof cons[params.level] === 'function'
    ? cons[params.level]
    : (cons && typeof cons.log === 'function' ? cons.log : null)
   if (fn) {
    fn.apply(cons, params.args)
   }
   return null
  }

  case 'data.get': {
   const kv = resolveScopedLaneKv(initialState && initialState.data, params.prefix)
   if (!kv || typeof kv.get !== 'function') {
    return null
   }
   const val = await kv.get(params.key)
   return val === undefined || val === null ? null : String(val)
  }

  case 'data.set': {
   const kv = resolveScopedLaneKv(initialState && initialState.data, params.prefix)
   if (!kv || typeof kv.set !== 'function') {
    throw new Error('Lane KV storage is not available')
   }
   await kv.set(params.key, params.value)
   return true
  }

  case 'data.delete': {
   const kv = resolveScopedLaneKv(initialState && initialState.data, params.prefix)
   if (!kv || typeof kv.delete !== 'function') {
    return true
   }
   await kv.delete(params.key)
   return true
  }

  case 'syncTable': {
   const fn = initialState && typeof initialState.syncTable === 'function' ? initialState.syncTable : null
   if (!fn) {
    return {
     result: { ok: false, count: 0, added: 0, updated: 0 },
     tablesScope: {},
    }
   }
   const rawRes = await fn(params.tblQuery, params.records, params.keyCol)
   const updatedScope = {}
   if (initialState && typeof initialState === 'object') {
    for (const key of Object.keys(initialState)) {
     if (!HOST_ENV_BUILTIN_KEYS.has(key) && Array.isArray(initialState[key])) {
      updatedScope[key] = cloneSafeJson(initialState[key]) ?? []
     }
    }
   }
   return {
    result: sanitizeSyncTableResult(rawRes),
    tablesScope: updatedScope,
   }
  }

  case 'importLane': {
   const fn = initialState && typeof initialState.importLane === 'function' ? initialState.importLane : null
   if (!fn) {
    return encodeWireValue(undefined)
   }
   const val = await fn(params.targetId, ...params.path)
   return encodeWireValue(val)
  }

  case 'exportLaneLine': {
   const fn = initialState && (
    typeof initialState.exportLaneLine === 'function'
     ? initialState.exportLaneLine
     : (typeof initialState.setLaneLine === 'function' ? initialState.setLaneLine : null)
   )
   if (!fn) {
    return {
     ok: false,
     targets: [],
     laneStatuses: [],
     changedCount: 0,
     needsDeployCount: 0,
     error: 'exportLaneLine is not available',
    }
   }
   const res = await fn(params.firstArg, params.secondArg, params.thirdArg)
   return cloneSafeJson(res) ?? { ok: false, error: 'Invalid exportLaneLine response' }
  }

  case 'syncLaneTable': {
   const fn = initialState && typeof initialState.syncLaneTable === 'function' ? initialState.syncLaneTable : null
   if (!fn) {
    return { ok: false, changed: false, count: 0, error: 'syncLaneTable is not available' }
   }
   const res = await fn(params.targetId, params.tblQuery, params.records, params.keyCol)
   return sanitizeSyncTableResult(res)
  }

  case 'deployLane': {
   const fn = initialState && (
    typeof initialState.deployLane === 'function'
     ? initialState.deployLane
     : (typeof initialState.resyncLane === 'function' ? initialState.resyncLane : null)
   )
   if (!fn) {
    return { ok: false, status: 'error', error: 'deployLane is not available' }
   }
   const res = await fn(params.targetId, params.deployOpts)
   return cloneSafeJson(res) ?? { ok: false, status: 'error' }
  }

  case 'fetch': {
   const urlCheck = validateSourceFetchUrl(params.url, hostOrigin)
   if (!urlCheck.ok) {
    throw new Error(urlCheck.error)
   }
   const fetchImpl = typeof hostFetch === 'function'
    ? hostFetch
    : (initialState && typeof initialState.fetch === 'function'
     ? initialState.fetch
     : (typeof globalThis.fetch === 'function' ? globalThis.fetch.bind(globalThis) : null))
   if (!fetchImpl) {
    throw new Error('fetch is not available')
   }
   const safeInit = {
    ...(params.init || {}),
    credentials: 'omit',
   }
   const resp = await fetchImpl(urlCheck.url, safeInit)
   if (!resp || typeof resp !== 'object') {
    return null
   }
   let bodyText = ''
   if (typeof resp.text === 'function') {
    bodyText = String((await resp.text()) ?? '')
   }
   else if (typeof resp.json === 'function') {
    bodyText = JSON.stringify(await resp.json())
   }
   const headers = {}
   if (resp.headers && typeof resp.headers.forEach === 'function') {
    resp.headers.forEach((v, k) => {
     headers[String(k).toLowerCase()] = String(v)
    })
   }
   else if (isPlainRecord(resp.headers)) {
    for (const [hk, hv] of Object.entries(resp.headers)) {
     headers[String(hk).toLowerCase()] = String(hv)
    }
   }
   return {
    ok: resp.ok !== false,
    status: Number.isInteger(resp.status) ? resp.status : (resp.ok === false ? 500 : 200),
    statusText: typeof resp.statusText === 'string' ? resp.statusText : '',
    url: typeof resp.url === 'string' ? resp.url : urlCheck.url,
    headers,
    bodyText,
   }
  }

  default:
   throw new Error(`Unsupported RPC method: ${method}`)
 }
}

export function createSourceWorkerRunner(runnerOptions = {}) {
 let dedicatedWorker = null
 let workerBusy = false
 let disposed = false
 let runSeq = 0
 let activeTerminate = null
 let terminatedCount = 0

 async function acquireWorker() {
  if (typeof globalThis.Worker === 'function') {
   if (dedicatedWorker && !workerBusy) {
    workerBusy = true
    return { handle: dedicatedWorker, isPrimary: true }
   }
   const fresh = await createPlatformWorker(runnerOptions.workerUrl)
   if (!dedicatedWorker) {
    dedicatedWorker = fresh
    workerBusy = true
    return { handle: fresh, isPrimary: true }
   }
   return { handle: fresh, isPrimary: false }
  }
  const nodeHandle = await createPlatformWorker(runnerOptions.workerUrl)
  return { handle: nodeHandle, isPrimary: false }
 }

 function releaseWorker(leased, hardKill = false) {
  if (!leased || !leased.handle) {
   return
  }
  if (hardKill || disposed) {
   terminatedCount += hardKill ? 1 : 0
   if (leased.handle === dedicatedWorker) {
    dedicatedWorker = null
    workerBusy = false
   }
   leased.handle.terminate()
   return
  }
  if (leased.handle.isBrowserWorker) {
   if (leased.isPrimary && leased.handle === dedicatedWorker) {
    workerBusy = false
   }
   else {
    leased.handle.terminate()
   }
  }
  else {
   releaseCleanNodeWorker(leased.handle)
  }
 }

 async function run(lines, runOptions = {}) {
  if (typeof runnerOptions.onRun === 'function') {
   runnerOptions.onRun(lines, runOptions)
  }
  const cleanLines = Array.from(lines || []).map(l => (l === null || l === undefined ? '' : String(l)))
  const initialState = runOptions && runOptions.initialState && typeof runOptions.initialState === 'object'
   ? runOptions.initialState
   : {}
  const lineContext = runOptions && runOptions.lineContext && typeof runOptions.lineContext === 'object'
   ? runOptions.lineContext
   : null
  const lineRecords = Array.isArray(runOptions && runOptions.lineRecords)
   ? runOptions.lineRecords.map(r => ({
    id: r && typeof r.id === 'string' ? r.id : '',
    text: r && r.text !== undefined && r.text !== null ? String(r.text) : '',
   }))
   : null
  const filename = runOptions && typeof runOptions.filename === 'string' && runOptions.filename.length > 0
   ? runOptions.filename
   : (typeof runnerOptions.laneId === 'string' && runnerOptions.laneId ? runnerOptions.laneId : 'lane')
  const timeoutMs = resolveWorkerTimeoutMs(runOptions, runnerOptions)
  const limits = normalizeFieldLimits(runOptions && runOptions.limits, runOptions)
  const payload = extractInitialWorkerPayload(initialState)
  const secretValues = payload.secretMeta.secretValues
  const hostOrigin = runnerOptions.hostOrigin ?? resolveHostOrigin()

  const leased = await acquireWorker()
  const runId = ++runSeq
  const streamedResults = []
  let activeLineIndex = 0

  return new Promise(resolve => {
   let settled = false
   let unsubscribe = () => {}
   let timer = null

   const buildFailureOutcome = (errMessage, flags = {}) => {
    const safeMsg = secretValues.length > 0 ? redactSecretText(errMessage, secretValues) : errMessage
    const failIdx = Math.min(
     Math.max(0, activeLineIndex),
     Math.max(0, cleanLines.length - 1)
    )
    const finalResults = streamedResults.slice()
    if (cleanLines.length > 0 && finalResults.length <= failIdx) {
     finalResults.push({
      index: failIdx,
      lineNumber: failIdx + 1,
      source: cleanLines[failIdx] ?? '',
      value: undefined,
      preview: safeMsg,
      error: safeMsg,
      isEmpty: false,
      isComment: false,
     })
    }
    const maskedState = decodeWireState(null, initialState)
    for (const name of payload.secretMeta.secretNames) {
     maskedState[name] = createMaskedSecretValue(name, payload.secretMeta.secretSetNames.includes(name))
    }
    return {
     results: finalResults,
     state: maskedState,
     sent: [],
     timedOut: Boolean(flags.timedOut),
     terminated: Boolean(flags.terminated),
    }
   }

   const finishRun = (outcome, hardKill = false) => {
    if (settled) {
     return
    }
    settled = true
    if (activeTerminate === terminateNow) {
     activeTerminate = null
    }
    if (timer !== null) {
     clearTimeout(timer)
     timer = null
    }
    if (lineContext) {
     lineContext.index = null
     lineContext.lineNumber = null
     lineContext.lineId = ''
    }
    unsubscribe()
    releaseWorker(leased, hardKill)
    resolve(outcome)
   }

   const terminateNow = (reason = 'Source execution terminated') => {
    finishRun(buildFailureOutcome(reason, { timedOut: false, terminated: true }), true)
   }
   activeTerminate = terminateNow

   if (timeoutMs > 0) {
    timer = setTimeout(() => {
     finishRun(
      buildFailureOutcome(`FieldScript execution timed out after ${timeoutMs}ms (worker terminated)`, {
       timedOut: true,
       terminated: true,
      }),
      true
     )
    }, timeoutMs)
   }

   unsubscribe = leased.handle.subscribe(
    rawMsg => {
     if (settled || !isPlainRecord(rawMsg) || rawMsg.protocol !== SOURCE_WORKER_PROTOCOL || rawMsg.runId !== runId) {
      return
     }

     if (rawMsg.type === 'line-start') {
      if (Number.isInteger(rawMsg.index) && rawMsg.index >= 0) {
       activeLineIndex = rawMsg.index
      }
      return
     }

     if (rawMsg.type === 'line-complete') {
      if (isPlainRecord(rawMsg.result) && Number.isInteger(rawMsg.index)) {
       const r = rawMsg.result
       streamedResults[rawMsg.index] = {
        index: rawMsg.index,
        lineNumber: Number.isInteger(r.lineNumber) ? r.lineNumber : rawMsg.index + 1,
        source: typeof r.source === 'string' ? r.source : (cleanLines[rawMsg.index] ?? ''),
        value: decodeWireValue(r.value),
        preview: typeof r.preview === 'string' ? r.preview : '',
        error: typeof r.error === 'string' && r.error.length > 0 ? r.error : null,
        isEmpty: Boolean(r.isEmpty),
        isComment: Boolean(r.isComment),
       }
       activeLineIndex = rawMsg.index + 1
      }
      return
     }

     if (rawMsg.type === 'rpc-request') {
      const validated = validateSourceWorkerRpcRequest(rawMsg, { hostOrigin })
      if (!validated.ok) {
       leased.handle.postMessage({
        protocol: SOURCE_WORKER_PROTOCOL,
        type: 'rpc-response',
        runId,
        requestId: rawMsg.requestId,
        ok: false,
        error: validated.error,
       })
       return
      }
      Promise.resolve()
       .then(() => dispatchSourceWorkerRpc(validated, {
        initialState,
        lineContext,
        hostOrigin,
        hostFetch: runnerOptions.fetch,
       }))
       .then(result => {
        if (!settled) {
         leased.handle.postMessage({
          protocol: SOURCE_WORKER_PROTOCOL,
          type: 'rpc-response',
          runId,
          requestId: validated.requestId,
          ok: true,
          result,
         })
        }
       })
       .catch(err => {
        if (!settled) {
         leased.handle.postMessage({
          protocol: SOURCE_WORKER_PROTOCOL,
          type: 'rpc-response',
          runId,
          requestId: validated.requestId,
          ok: false,
          error: err instanceof Error ? err.message : String(err),
         })
        }
       })
      return
     }

     if (rawMsg.type === 'run-complete') {
      const rawResults = Array.isArray(rawMsg.results) ? rawMsg.results : []
      const decodedResults = rawResults.map((r, idx) => ({
       index: Number.isInteger(r.index) ? r.index : idx,
       lineNumber: Number.isInteger(r.lineNumber) ? r.lineNumber : idx + 1,
       source: typeof r.source === 'string' ? r.source : (cleanLines[idx] ?? ''),
       value: decodeWireValue(r.value),
       preview: typeof r.preview === 'string' ? r.preview : '',
       error: typeof r.error === 'string' && r.error.length > 0 ? r.error : null,
       isEmpty: Boolean(r.isEmpty),
       isComment: Boolean(r.isComment),
      }))
      const decodedState = decodeWireState(rawMsg.state, initialState)
      const sent = Array.isArray(rawMsg.sent)
       ? rawMsg.sent.map(pkt => {
        const wire = pkt && typeof pkt.wire === 'string' ? pkt.wire : serializeTransportPacket(pkt)
        const parsed = deserializeTransportPacket(wire)
        parsed.wire = wire
        return parsed
       })
       : []
      finishRun({
       results: decodedResults,
       state: decodedState,
       sent,
       timedOut: false,
       terminated: false,
      }, false)
      return
     }

     if (rawMsg.type === 'run-error') {
      const errMsg = typeof rawMsg.error === 'string' ? rawMsg.error : 'Source Worker execution error'
      finishRun(buildFailureOutcome(errMsg, { timedOut: false, terminated: false }), false)
     }
    },
    err => {
     finishRun(buildFailureOutcome(err.message || 'Source Worker crashed', { timedOut: false, terminated: true }), true)
    }
   )

   leased.handle.postMessage({
    protocol: SOURCE_WORKER_PROTOCOL,
    type: 'run',
    runId,
    filename,
    lines: cleanLines,
    lineRecords,
    includePreviews: runOptions.includePreviews !== false,
    limits,
    inputsEnv: payload.inputsEnv,
    tablesScope: payload.tablesScope,
    tableChange: payload.tableChange,
    secretMeta: payload.secretMeta,
   })
  })
 }

 function terminate(reason = 'Source runner terminated') {
  if (activeTerminate) {
   activeTerminate(reason)
  }
  else if (dedicatedWorker) {
   terminatedCount += 1
   dedicatedWorker.terminate()
   dedicatedWorker = null
   workerBusy = false
  }
 }

 function dispose() {
  disposed = true
  terminate('Lane disposed')
 }

 return {
  run,
  terminate,
  dispose,
  get terminatedCount() {
   return terminatedCount
  },
 }
}

export async function runLinesInWorker(lines, options = {}) {
 const runner = createSourceWorkerRunner({
  laneId: options && options.filename ? options.filename : 'lane',
  timeoutMs: options && options.timeoutMs,
  workerUrl: options && options.workerUrl,
  hostOrigin: options && options.hostOrigin,
  fetch: options && options.fetch,
 })
 try {
  return await runner.run(lines, options)
 }
 finally {
  runner.dispose()
 }
}

export async function simulateLaneRequestInWorker(simOptions = {}) {
 const {
  lines = [],
  inputs = [],
  tables = [],
  laneId = 'lane',
  laneData = null,
  importLaneFn = null,
  req = {},
  cors = true,
  timeoutMs,
  workerUrl,
  hostOrigin: explicitOrigin,
 } = simOptions

 const cleanLines = Array.from(lines || []).map(l => (l === null || l === undefined ? '' : String(l)))
 const tablesScope = Array.isArray(tables) && tables.length > 0 ? buildTablesScope(tables) : {}
 const cleanInputs = Array.isArray(inputs)
  ? inputs
   .filter(entry => entry && typeof entry.name === 'string' && entry.name.trim().length > 0)
   .map(entry => ({ name: entry.name.trim(), type: String(entry.type || 'string') }))
  : []
 const resolvedTimeout = resolveWorkerTimeoutMs({ timeoutMs }, {})
 const hostOrigin = explicitOrigin ?? resolveHostOrigin()
 const leased = await createPlatformWorker(workerUrl)
 const runId = Math.max(1, Math.trunc(Math.random() * 1000000000))
 const initialState = {
  data: laneData,
  importLane: typeof importLaneFn === 'function' ? importLaneFn : () => undefined,
 }

 return new Promise(resolve => {
  let settled = false
  let unsubscribe = () => {}
  let timer = null

  const finish = (resp, hardKill = false) => {
   if (settled) {
    return
   }
   settled = true
   if (timer !== null) {
    clearTimeout(timer)
    timer = null
   }
   unsubscribe()
   if (hardKill || leased.isBrowserWorker) {
    leased.terminate()
   }
   else {
    releaseCleanNodeWorker(leased)
   }
   resolve(resp)
  }

  if (resolvedTimeout > 0) {
   timer = setTimeout(() => {
    finish({
     ok: false,
     status: 504,
     headers: { 'content-type': 'application/json; charset=utf-8' },
     bodyText: JSON.stringify({ error: `Request timed out after ${resolvedTimeout}ms (worker terminated)` }),
     mode: 'timeout',
     durationMs: resolvedTimeout,
     logs: [],
     timedOut: true,
     terminated: true,
    }, true)
   }, resolvedTimeout)
  }

  unsubscribe = leased.subscribe(
   rawMsg => {
    if (settled || !isPlainRecord(rawMsg) || rawMsg.protocol !== SOURCE_WORKER_PROTOCOL || rawMsg.runId !== runId) {
     return
    }
    if (rawMsg.type === 'rpc-request') {
     const validated = validateSourceWorkerRpcRequest(rawMsg, { hostOrigin })
     if (!validated.ok) {
      leased.postMessage({
       protocol: SOURCE_WORKER_PROTOCOL,
       type: 'rpc-response',
       runId,
       requestId: rawMsg.requestId,
       ok: false,
       error: validated.error,
      })
      return
     }
     Promise.resolve()
      .then(() => dispatchSourceWorkerRpc(validated, { initialState, lineContext: null, hostOrigin }))
      .then(result => {
       if (!settled) {
        leased.postMessage({
         protocol: SOURCE_WORKER_PROTOCOL,
         type: 'rpc-response',
         runId,
         requestId: validated.requestId,
         ok: true,
         result,
        })
       }
      })
      .catch(err => {
       if (!settled) {
        leased.postMessage({
         protocol: SOURCE_WORKER_PROTOCOL,
         type: 'rpc-response',
         runId,
         requestId: validated.requestId,
         ok: false,
         error: err instanceof Error ? err.message : String(err),
        })
       }
      })
     return
    }
    if (rawMsg.type === 'simulate-complete') {
     finish(rawMsg.response, false)
     return
    }
    if (rawMsg.type === 'run-error') {
     finish({
      ok: false,
      status: 500,
      headers: { 'content-type': 'application/json; charset=utf-8' },
      bodyText: JSON.stringify({ error: String(rawMsg.error || 'Simulation error') }),
      mode: 'error',
      durationMs: 0,
      logs: [],
     }, false)
    }
   },
   err => {
    finish({
     ok: false,
     status: 500,
     headers: { 'content-type': 'application/json; charset=utf-8' },
     bodyText: JSON.stringify({ error: err.message || 'Worker crashed' }),
     mode: 'error',
     durationMs: 0,
     logs: [],
    }, true)
   }
  )

  leased.postMessage({
   protocol: SOURCE_WORKER_PROTOCOL,
   type: 'simulate-http',
   runId,
   laneId: String(laneId || 'lane'),
   lines: cleanLines,
   inputs: cleanInputs,
   tablesScope: cloneSafeJson(tablesScope) ?? {},
   req: cloneSafeJson(req) ?? {},
   cors: Boolean(cors),
  })
 })
}

// ============================================================================
// Sandboxed Lane Output (<iframe sandbox="allow-scripts"> + postMessage RPC)
// ============================================================================

let cachedInlineFieldSourcePromise = null

async function loadInlineFieldModuleSource() {
 if (!cachedInlineFieldSourcePromise) {
  cachedInlineFieldSourcePromise = (async () => {
   let rawSource
   if (isNodeRuntime && typeof HTMLIFrameElement === 'undefined') {
    const fsSpec = 'node:fs/promises'
    const fsMod = await import(fsSpec)
    rawSource = await fsMod.readFile(new URL('./field.mjs', import.meta.url), 'utf8')
   }
   else {
    const resp = await fetch('/field.mjs')
    if (!resp.ok) {
     throw new Error(`Failed to load /field.mjs for sandboxed output (${resp.status})`)
    }
    rawSource = await resp.text()
   }
   return rawSource.replace(/^export\s+(const|function|async\s+function)\s+/gm, '$1 ')
  })().catch(err => {
   cachedInlineFieldSourcePromise = null
   throw err
  })
 }
 return cachedInlineFieldSourcePromise
}

function escapeInlineScript(jsText) {
 return String(jsText).replace(/<\/script/gi, '<\\/script')
}

function buildIframeClientBootstrapSource(frameId) {
 const rpcMethodsJson = JSON.stringify(OUTPUT_RPC_METHODS)
 const protocolJson = JSON.stringify(OUTPUT_PROTOCOL)
 const frameIdJson = JSON.stringify(frameId)
 return `
(() => {
 const PROTOCOL = ${protocolJson}
 const FRAME_ID = ${frameIdJson}
 const RPC_METHODS = ${rpcMethodsJson}
 const parentTarget = window.parent
 const postToHost = payload => {
  parentTarget.postMessage({ protocol: PROTOCOL, frameId: FRAME_ID, ...payload }, '*')
 }

 const outputEl = document.getElementById('output')
 let nextReqId = 0
 let activeRenderId = 0
 const pendingRpc = new Map()

 const reportHeight = () => {
  if (!outputEl) {
   return
  }
  const rect = typeof outputEl.getBoundingClientRect === 'function'
   ? outputEl.getBoundingClientRect()
   : { height: 0 }
  const h = Math.max(outputEl.scrollHeight || 0, Math.ceil(rect.height || 0), 36)
  postToHost({ type: 'resize', height: h })
 }

 if (typeof ResizeObserver === 'function' && outputEl) {
  const ro = new ResizeObserver(() => reportHeight())
  ro.observe(outputEl)
 }
 if (typeof MutationObserver === 'function' && outputEl) {
  const mo = new MutationObserver(() => reportHeight())
  mo.observe(outputEl, { childList: true, subtree: true, characterData: true, attributes: true })
 }

 const callRpc = (method, args) => new Promise((resolve, reject) => {
  const requestId = ++nextReqId
  pendingRpc.set(requestId, { resolve, reject })
  postToHost({
   type: 'rpc-request',
   requestId,
   method,
   args,
  })
 })

 const extraEnv = {}
 for (let i = 0; i < RPC_METHODS.length; i++) {
  const method = RPC_METHODS[i]
  extraEnv[method] = (...args) => callRpc(method, args)
 }

 const applyScrollbarTheme = theme => {
  if (!theme || typeof theme !== 'object' || !document.documentElement || !document.documentElement.style) {
   return
  }
  const st = document.documentElement.style
  if (typeof theme.css === 'string' && theme.css) {
   st.scrollbarColor = theme.css
   if (typeof st.setProperty === 'function') {
    st.setProperty('--scrollbar-color', theme.css)
   }
  }
  if (typeof st.setProperty === 'function') {
   if (typeof theme.thumb === 'string' && theme.thumb) {
    st.setProperty('--scrollbar-thumb-color', theme.thumb)
    st.setProperty('--scrollbar-track-color', typeof theme.track === 'string' ? theme.track : 'transparent')
   }
  }
 }

 window.addEventListener('error', ev => {
  const msg = ev && ev.error && ev.error.message
   ? ev.error.message
   : (ev && ev.message ? ev.message : 'Uncaught error in Lane Output')
  postToHost({ type: 'runtime-error', message: String(msg), lineNumber: null })
 })

 window.addEventListener('unhandledrejection', ev => {
  const reason = ev ? ev.reason : null
  const msg = reason && reason.message ? reason.message : String(reason || 'Unhandled promise rejection in Lane Output')
  postToHost({ type: 'runtime-error', message: msg, lineNumber: null })
 })

 window.addEventListener('message', async ev => {
  const msg = ev && ev.data
  if (!msg || typeof msg !== 'object' || msg.protocol !== PROTOCOL || msg.frameId !== FRAME_ID) {
   return
  }
  if (msg.type === 'set-theme') {
   applyScrollbarTheme(msg.scrollbar)
   return
  }
  if (msg.type === 'rpc-response') {
   const entry = pendingRpc.get(msg.requestId)
   if (!entry) {
    return
   }
   pendingRpc.delete(msg.requestId)
   if (msg.ok) {
    entry.resolve(msg.result)
   }
   else {
    entry.reject(new Error(msg.error || 'RPC error'))
   }
   return
  }
  if (msg.type === 'run') {
   const renderId = Number.isInteger(msg.renderId) ? msg.renderId : 0
   activeRenderId = renderId
   applyScrollbarTheme(msg.scrollbar)
   if (outputEl) {
    outputEl.replaceChildren()
   }
   const packets = Array.isArray(msg.packets) ? msg.packets : []
   const outcome = await runTransportedScripts(packets, {
    document,
    window,
    console,
    output: outputEl,
    extraEnv,
    disallowLoad: true,
    isCancelled: () => activeRenderId !== renderId,
   })
   if (activeRenderId !== renderId) {
    return
   }
   const summaryResults = outcome.results.map(r => ({
    index: r.index,
    lineNumber: r.lineNumber,
    preview: r.preview,
    appended: r.appended,
    error: r.error,
   }))
   reportHeight()
   postToHost({
    type: 'run-complete',
    renderId,
    results: summaryResults,
   })
  }
 })

 postToHost({ type: 'ready' })
})()
`
}

export function buildSandboxedOutputSrcdoc({ frameId, fieldModuleSource, scrollbar = null } = {}) {
 const sb = scrollbar && typeof scrollbar === 'object' && scrollbar.css
  ? scrollbar
  : resolveScrollbarColor(DEFAULT_SCROLLBAR_COLOR)
 const safeCss = String(sb.css || '#383838 transparent').replace(/[<>;"']/g, '')
 const safeThumb = String(sb.thumb || '#383838').replace(/[<>;"']/g, '')
 const safeTrack = String(sb.track || 'transparent').replace(/[<>;"']/g, '')
 const inlineJs = escapeInlineScript(`${fieldModuleSource}\n${buildIframeClientBootstrapSource(frameId)}`)

 return [
  '<!doctype html>',
  '<html lang="en">',
  '<head>',
  '<meta charset="utf-8">',
  '<style>',
  `:root { --scrollbar-color: ${safeCss}; --scrollbar-thumb-color: ${safeThumb}; --scrollbar-track-color: ${safeTrack}; color-scheme: dark; scrollbar-color: var(--scrollbar-color); }`,
  '@supports not (scrollbar-color: #383838 transparent) {',
  ' ::-webkit-scrollbar { height: 10px; width: 10px; }',
  ' ::-webkit-scrollbar-track { background: var(--scrollbar-track-color, transparent); }',
  ' ::-webkit-scrollbar-thumb { background-color: var(--scrollbar-thumb-color, #383838); border-radius: 5px; }',
  '}',
  'html, body { background: #0e0e0e; box-sizing: border-box; color: #f4f4f4; font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; font-size: 14px; line-height: 1.45; margin: 0; padding: 0; }',
  '[hidden] { display: none !important; }',
  '::selection { background: #ffffff80; color: black; }',
  '#output { box-sizing: border-box; min-height: 2.5em; padding: 0.85em 1em; }',
  '#output > :first-child { margin-top: 0; }',
  '#output > :last-child { margin-bottom: 0; }',
  '</style>',
  '</head>',
  '<body>',
  '<div id="output"></div>',
  `<script type="module">${inlineJs}</script>`,
  '</body>',
  '</html>',
 ].join('\n')
}

let nodeVmPromise = null
let nodeMsgChannelPromise = null

async function getNodeSandboxDeps() {
 if (!nodeVmPromise) {
  const vmSpec = 'node:vm'
  const wtSpec = 'node:worker_threads'
  nodeVmPromise = import(vmSpec)
  nodeMsgChannelPromise = import(wtSpec).then(m => m.MessageChannel)
 }
 const [vmMod, MessageChannelCtor] = await Promise.all([nodeVmPromise, nodeMsgChannelPromise])
 return { vm: vmMod, MessageChannelCtor }
}

function createIsolatedMockSandboxDocument(sandboxWindow) {
 function createNode(tag) {
  return {
   tag: String(tag).toLowerCase(),
   tagName: String(tag).toUpperCase(),
   nodeType: 1,
   style: {
    setProperty(k, v) { this[k] = v },
    removeProperty(k) { delete this[k] },
   },
   attributes: {},
   dataset: {},
   children: [],
   listeners: {},
   textContent: '',
   innerHTML: '',
   value: '',
   className: '',
   id: '',
   hidden: false,
   disabled: false,
   checked: false,
   focused: false,
   removed: false,
   scrollHeight: 40,
   setAttribute(name, value) {
    this.attributes[String(name)] = String(value)
    if (name === 'id') {
     this.id = String(value)
    }
   },
   getAttribute(name) {
    return Object.hasOwn(this.attributes, name) ? this.attributes[name] : null
   },
   removeAttribute(name) {
    delete this.attributes[name]
   },
   appendChild(child) {
    if (child && typeof child === 'object') {
     child.parentNode = this
     this.children.push(child)
    }
    return child
   },
   insertBefore(child, ref) {
    if (child && typeof child === 'object') {
     child.parentNode = this
    }
    const idx = this.children.indexOf(ref)
    if (idx === -1) {
     this.children.push(child)
    }
    else {
     this.children.splice(idx, 0, child)
    }
    return child
   },
   replaceChildren(...nextChildren) {
    this.children = []
    for (const ch of nextChildren) {
     this.appendChild(ch)
    }
   },
   addEventListener(event, handler) {
    this.listeners[event] = handler
   },
   removeEventListener(event, handler) {
    if (this.listeners[event] === handler) {
     delete this.listeners[event]
    }
   },
   getBoundingClientRect() {
    return { width: 320, height: Math.max(36, this.children.length * 24) }
   },
   focus() {
    this.focused = true
   },
   remove() {
    this.removed = true
    if (this.parentNode && Array.isArray(this.parentNode.children)) {
     const idx = this.parentNode.children.indexOf(this)
     if (idx >= 0) {
      this.parentNode.children.splice(idx, 1)
     }
    }
    this.parentNode = null
   },
  }
 }

 const documentElement = createNode('html')
 const head = createNode('head')
 const body = createNode('body')
 const outputEl = createNode('div')
 outputEl.setAttribute('id', 'output')
 body.appendChild(outputEl)
 documentElement.appendChild(head)
 documentElement.appendChild(body)

 const doc = {
  documentElement,
  head,
  body,
  defaultView: sandboxWindow,
  get cookie() {
   const err = new Error('Failed to read the "cookie" property from "Document": The document is sandboxed and lacks the "allow-same-origin" flag.')
   err.name = 'SecurityError'
   throw err
  },
  set cookie(_v) {
   const err = new Error('Failed to set the "cookie" property on "Document": The document is sandboxed and lacks the "allow-same-origin" flag.')
   err.name = 'SecurityError'
   throw err
  },
  createElement(tag) {
   return createNode(tag)
  },
  createDocumentFragment() {
   const frag = createNode('#document-fragment')
   frag.nodeType = 11
   return frag
  },
  createTextNode(text) {
   return { nodeType: 3, textContent: String(text ?? '') }
  },
  getElementById(id) {
   return id === 'output' ? outputEl : null
  },
 }

 return { doc, outputEl }
}

let cachedVmFieldScript = null

async function mountMockVmIframeRealm({ iframeEl, frameId, fieldModuleSource, onFromFrameMessage, sandboxConsole }) {
 const { vm, MessageChannelCtor } = await getNodeSandboxDeps()
 if (!cachedVmFieldScript) {
  cachedVmFieldScript = new vm.Script(fieldModuleSource, { filename: 'sandbox-field-runtime.js' })
 }
 const { port1: hostPort, port2: framePort } = new MessageChannelCtor()
 if (typeof hostPort.unref === 'function') {
  hostPort.unref()
 }
 if (typeof framePort.unref === 'function') {
  framePort.unref()
 }

 const frameListeners = new Map()
 const makeSecurityError = prop => {
  const err = new Error(`SecurityError: Sandbox access to "${prop}" is denied on opaque null origin`)
  err.name = 'SecurityError'
  return err
 }

 const parentWindowProxy = Object.freeze({
  postMessage(payload, _targetOrigin) {
   framePort.postMessage(payload)
  },
  get document() {
   throw makeSecurityError('parent.document')
  },
  get localStorage() {
   throw makeSecurityError('parent.localStorage')
  },
  get main() {
   throw makeSecurityError('parent.main')
  },
 })

 const sandboxWindow = {
  origin: 'null',
  isSecureContext: false,
  parent: parentWindowProxy,
  top: parentWindowProxy,
  opener: null,
  location: Object.freeze({ origin: 'null', href: 'about:srcdoc', pathname: 'srcdoc' }),
  get localStorage() {
   throw makeSecurityError('localStorage')
  },
  get sessionStorage() {
   throw makeSecurityError('sessionStorage')
  },
  get indexedDB() {
   throw makeSecurityError('indexedDB')
  },
  get caches() {
   throw makeSecurityError('caches')
  },
  async fetch(url) {
   const s = String(url ?? '').trim()
   if (!/^https?:\/\//i.test(s)) {
    throw new TypeError(`Failed to parse URL from ${s} in opaque-origin sandboxed frame`)
   }
   const parsed = new URL(s)
   if (parsed.pathname === '/api' || parsed.pathname.startsWith('/api/')) {
    throw new TypeError('Failed to fetch: CORS blocked from null origin')
   }
   throw new TypeError('Network access disabled in mock sandboxed frame')
  },
  addEventListener(type, fn) {
   if (!frameListeners.has(type)) {
    frameListeners.set(type, new Set())
   }
   frameListeners.get(type).add(fn)
  },
  removeEventListener(type, fn) {
   const set = frameListeners.get(type)
   if (set) {
    set.delete(fn)
   }
  },
  postMessage(payload) {
   const set = frameListeners.get('message')
   if (set) {
    for (const fn of set) {
     fn({ data: payload, origin: 'null', source: null })
    }
   }
  },
  setTimeout,
  clearTimeout,
 }

 const { doc: sandboxDocument, outputEl } = createIsolatedMockSandboxDocument(sandboxWindow)
 sandboxWindow.document = sandboxDocument

 const contentWindowProxy = Object.freeze({
  postMessage(payload, _targetOrigin) {
   hostPort.postMessage(payload)
  },
 })
 iframeEl.contentWindow = contentWindowProxy
 iframeEl.contentDocument = null

 hostPort.on('message', data => {
  onFromFrameMessage({
   data,
   origin: 'null',
   source: contentWindowProxy,
  })
 })

 framePort.on('message', data => {
  const set = frameListeners.get('message')
  if (set) {
   for (const fn of set) {
    fn({ data, origin: 'null', source: parentWindowProxy })
   }
  }
 })

 if (typeof hostPort.unref === 'function') {
  hostPort.unref()
 }
 if (typeof framePort.unref === 'function') {
  framePort.unref()
 }

 const vmContext = vm.createContext({
  window: sandboxWindow,
  self: sandboxWindow,
  document: sandboxDocument,
  console: sandboxConsole || { log() {}, info() {}, warn() {}, error() {} },
  Intl: globalThis.Intl,
  TextEncoder,
  TextDecoder,
  URL,
  setTimeout,
  clearTimeout,
  queueMicrotask,
 })
 sandboxWindow.Array = vm.runInContext('Array', vmContext)
 sandboxWindow.Object = vm.runInContext('Object', vmContext)
 sandboxWindow.Number = vm.runInContext('Number', vmContext)
 sandboxWindow.String = vm.runInContext('String', vmContext)
 sandboxWindow.Boolean = vm.runInContext('Boolean', vmContext)
 sandboxWindow.Math = vm.runInContext('Math', vmContext)
 sandboxWindow.JSON = vm.runInContext('JSON', vmContext)
 sandboxWindow.Date = vm.runInContext('Date', vmContext)
 sandboxWindow.Error = vm.runInContext('Error', vmContext)
 sandboxWindow.TypeError = vm.runInContext('TypeError', vmContext)
 sandboxWindow.Promise = vm.runInContext('Promise', vmContext)

 cachedVmFieldScript.runInContext(vmContext)
 vm.runInContext(buildIframeClientBootstrapSource(frameId), vmContext, {
  filename: `sandbox-frame-${frameId}.js`,
 })

 return {
  outputEl,
  sandboxWindow,
  sandboxDocument,
  contentWindowProxy,
  dispose() {
   hostPort.close()
   framePort.close()
   frameListeners.clear()
  },
 }
}

function isNativeBrowserIframe(el, hostWin) {
 if (!el || typeof el !== 'object') {
  return false
 }
 if (typeof HTMLIFrameElement === 'function' && el instanceof HTMLIFrameElement) {
  return true
 }
 if (hostWin && typeof hostWin.HTMLIFrameElement === 'function' && el instanceof hostWin.HTMLIFrameElement) {
  return true
 }
 const ownerWin = el.ownerDocument && el.ownerDocument.defaultView
 if (ownerWin && typeof ownerWin.HTMLIFrameElement === 'function' && el instanceof ownerWin.HTMLIFrameElement) {
  return true
 }
 return false
}

export function createSandboxedOutputHost(options = {}) {
 const {
  document: hostDoc,
  window: hostWin,
  viewportEl,
  title = 'Lane Output',
  console: cons = globalThis.console,
  getHandlers = null,
  onRuntimeError = null,
  getScrollbar = null,
  timeoutMs: rawRenderTimeoutMs,
 } = options
 const renderTimeoutMs = Number.isFinite(Number(rawRenderTimeoutMs)) && Number(rawRenderTimeoutMs) > 0
  ? Math.trunc(Number(rawRenderTimeoutMs))
  : DEFAULT_SOURCE_WORKER_TIMEOUT_MS

 let currentIframe = null
 let currentFrameId = ''
 let currentMockRealm = null
 let unsubscribeHostMsg = null
 let currentPackets = []
 let activeRenderId = 0
 let pendingRunResolve = null
 let pendingRunTimer = null
 let disposed = false

 function resolveCurrentScrollbar() {
  if (typeof getScrollbar === 'function') {
   const raw = getScrollbar()
   if (raw && typeof raw === 'object' && raw.css) {
    return raw
   }
   if (typeof raw === 'string' && raw.trim()) {
    return resolveScrollbarColor(raw)
   }
  }
  return resolveScrollbarColor(DEFAULT_SCROLLBAR_COLOR)
 }

 function clearPendingRunTimer() {
  if (pendingRunTimer !== null) {
   clearTimeout(pendingRunTimer)
   pendingRunTimer = null
  }
 }

 function teardownFrame() {
  clearPendingRunTimer()
  if (pendingRunResolve) {
   const resolvePrev = pendingRunResolve
   pendingRunResolve = null
   resolvePrev({ results: [], cancelled: true })
  }
  if (unsubscribeHostMsg) {
   unsubscribeHostMsg()
   unsubscribeHostMsg = null
  }
  if (currentMockRealm) {
   currentMockRealm.dispose()
   currentMockRealm = null
  }
  if (currentIframe) {
   if (typeof currentIframe.remove === 'function') {
    currentIframe.remove()
   }
   currentIframe = null
  }
  if (viewportEl) {
   if (typeof viewportEl.replaceChildren === 'function') {
    viewportEl.replaceChildren()
   }
   else if (Array.isArray(viewportEl.children)) {
    viewportEl.children.length = 0
   }
  }
  currentFrameId = ''
 }

 function postToActiveFrame(message) {
  if (!currentIframe || !currentIframe.contentWindow || !currentFrameId) {
   return
  }
  currentIframe.contentWindow.postMessage({
   protocol: OUTPUT_PROTOCOL,
   frameId: currentFrameId,
   ...message,
  }, '*')
 }

 async function handleFrameEvent(ev) {
  if (disposed || !currentIframe || !currentFrameId) {
   return
  }
  if (!ev || ev.origin !== 'null') {
   return
  }
  if (ev.source !== currentIframe.contentWindow) {
   return
  }
  const validated = validateOutputFrameMessage(ev.data, currentFrameId)
  if (!validated.ok) {
   if (ev.data && isPlainRecord(ev.data) && ev.data.type === 'rpc-request' && Number.isInteger(ev.data.requestId)) {
    postToActiveFrame({
     type: 'rpc-response',
     requestId: ev.data.requestId,
     ok: false,
     error: validated.error,
    })
   }
   return
  }

  if (validated.type === 'ready') {
   postToActiveFrame({
    type: 'run',
    renderId: activeRenderId,
    packets: currentPackets,
    scrollbar: resolveCurrentScrollbar(),
   })
   return
  }

  if (validated.type === 'resize') {
   if (currentIframe && currentIframe.style) {
    currentIframe.style.height = `${validated.height}px`
   }
   return
  }

  if (validated.type === 'runtime-error') {
   if (typeof onRuntimeError === 'function') {
    onRuntimeError({ message: validated.message, lineNumber: validated.lineNumber })
   }
   return
  }

  if (validated.type === 'run-complete') {
   if (validated.renderId === activeRenderId && pendingRunResolve) {
    clearPendingRunTimer()
    const resolveDone = pendingRunResolve
    pendingRunResolve = null
    resolveDone({ results: validated.results, cancelled: false })
   }
   return
  }

  if (validated.method) {
   const handlers = typeof getHandlers === 'function' ? getHandlers() : (options.handlers || {})
   const fn = handlers && Object.hasOwn(handlers, validated.method) ? handlers[validated.method] : null
   if (typeof fn !== 'function') {
    postToActiveFrame({
     type: 'rpc-response',
     requestId: validated.requestId,
     ok: false,
     error: `Handler unavailable: ${validated.method}`,
    })
    return
   }
   try {
    const rawRes = await fn(...validated.args)
    const sanitized = validated.method === 'syncTable'
     ? sanitizeSyncTableResult(rawRes)
     : cloneSafeJson(rawRes)
    postToActiveFrame({
     type: 'rpc-response',
     requestId: validated.requestId,
     ok: true,
     result: sanitized,
    })
   }
   catch (err) {
    postToActiveFrame({
     type: 'rpc-response',
     requestId: validated.requestId,
     ok: false,
     error: err instanceof Error ? err.message : String(err),
    })
   }
  }
 }

 async function render(packets, renderOptions = {}) {
  if (disposed) {
   return { results: [] }
  }
  const list = Array.isArray(packets) ? packets : []
  const wirePackets = list.map(pkt => {
   if (typeof pkt === 'string') {
    return pkt
   }
   if (pkt && typeof pkt.wire === 'string') {
    return pkt.wire
   }
   return serializeTransportPacket(pkt)
  })
  currentPackets = wirePackets
  activeRenderId += 1
  const thisRenderId = activeRenderId

  teardownFrame()

  if (wirePackets.length === 0 || !hostDoc || !viewportEl) {
   return { results: [] }
  }

  const frameId = createNonce('cc-frame')
  currentFrameId = frameId
  const fieldModuleSource = await loadInlineFieldModuleSource()
  if (disposed || thisRenderId !== activeRenderId) {
   return { results: [] }
  }

  const iframe = hostDoc.createElement('iframe')
  iframe.className = 'lane-output-frame'
  iframe.setAttribute('sandbox', 'allow-scripts')
  iframe.setAttribute('referrerpolicy', 'no-referrer')
  iframe.setAttribute('title', String(renderOptions.title || title || 'Lane Output'))
  const scrollbar = resolveCurrentScrollbar()
  const srcdoc = buildSandboxedOutputSrcdoc({
   frameId,
   fieldModuleSource,
   scrollbar,
  })
  iframe.srcdoc = srcdoc
  currentIframe = iframe

  const runPromise = new Promise(resolve => {
   pendingRunResolve = resolve
  })
  if (renderTimeoutMs > 0) {
   pendingRunTimer = setTimeout(() => {
    pendingRunTimer = null
    if (thisRenderId === activeRenderId && pendingRunResolve) {
     const resolveTimeout = pendingRunResolve
     pendingRunResolve = null
     resolveTimeout({
      results: [{
       index: 0,
       lineNumber: null,
       preview: '',
       appended: false,
       error: `Sandboxed output frame timed out after ${renderTimeoutMs}ms`,
      }],
      cancelled: false,
     })
    }
   }, renderTimeoutMs)
  }

  if (isNativeBrowserIframe(iframe, hostWin) && hostWin && typeof hostWin.addEventListener === 'function') {
   const listener = ev => {
    handleFrameEvent(ev)
   }
   hostWin.addEventListener('message', listener)
   unsubscribeHostMsg = () => {
    hostWin.removeEventListener('message', listener)
   }
   viewportEl.appendChild(iframe)
  }
  else {
   if (hostWin && typeof hostWin.addEventListener === 'function') {
    const winListener = ev => {
     handleFrameEvent(ev)
    }
    hostWin.addEventListener('message', winListener)
    unsubscribeHostMsg = () => {
     if (typeof hostWin.removeEventListener === 'function') {
      hostWin.removeEventListener('message', winListener)
     }
    }
   }
   viewportEl.appendChild(iframe)
   currentMockRealm = await mountMockVmIframeRealm({
    iframeEl: iframe,
    frameId,
    fieldModuleSource,
    onFromFrameMessage: ev => {
     handleFrameEvent(ev)
    },
    sandboxConsole: cons,
   })
  }

  return runPromise
 }

 function syncTheme(scrollbarOverride = null) {
  const sb = scrollbarOverride
   ? (typeof scrollbarOverride === 'string' ? resolveScrollbarColor(scrollbarOverride) : scrollbarOverride)
   : resolveCurrentScrollbar()
  postToActiveFrame({ type: 'set-theme', scrollbar: sb })
 }

 function setTitle(nextTitle) {
  if (currentIframe && typeof currentIframe.setAttribute === 'function') {
   currentIframe.setAttribute('title', String(nextTitle || 'Lane Output'))
  }
 }

 function clear() {
  currentPackets = []
  activeRenderId += 1
  teardownFrame()
 }

 function dispose() {
  disposed = true
  clear()
 }

 return {
  render,
  clear,
  dispose,
  syncTheme,
  setTitle,
  get iframe() {
   return currentIframe
  },
  get frameId() {
   return currentFrameId
  },
  get debugOutputEl() {
   return currentMockRealm ? currentMockRealm.outputEl : null
  },
  get debugWindow() {
   return currentMockRealm ? currentMockRealm.sandboxWindow : null
  },
  get debugDocument() {
   return currentMockRealm ? currentMockRealm.sandboxDocument : null
  },
 }
}
