import {
 compileFieldScriptLines,
 defaultValueForType,
 field,
 formatValue,
 normalizePrimitiveType,
 redactSecretText,
 runCompiledLines,
 serializeTransportPacket,
} from './field.mjs'
import {
 buildRequestObject,
 createResponseHelper,
 executeLaneHttpRequest,
} from './lane-http.mjs'
import {
 SOURCE_WORKER_PROTOCOL,
 decodeWireValue,
 encodeWireState,
 encodeWireValue,
} from './sandbox.mjs'

const isNodeRuntime = Boolean(
 typeof process !== 'undefined' &&
 process &&
 process.versions &&
 process.versions.node
)

const WORKER_BUILTIN_STATE_KEYS = new Set([
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
])

const SCRUBBED_GLOBAL_NAMES = [
 'BroadcastChannel',
 'CacheStorage',
 'EventSource',
 'Navigator',
 'ServiceWorkerContainer',
 'SharedWorker',
 'WebSocket',
 'Worker',
 'XMLHttpRequest',
 'caches',
 'close',
 'cookieStore',
 'document',
 'fetch',
 'frames',
 'importScripts',
 'indexedDB',
 'localStorage',
 'location',
 'navigator',
 'opener',
 'origin',
 'parent',
 'postMessage',
 'process',
 'self',
 'sessionStorage',
 'top',
 'window',
]

const SCRUBBED_PROTO_NAMES = [
 'caches',
 'close',
 'cookieStore',
 'fetch',
 'importScripts',
 'indexedDB',
 'location',
 'navigator',
 'onerror',
 'onmessage',
 'onmessageerror',
 'origin',
 'postMessage',
 'self',
]

function scrubWorkerGlobals() {
 let proto = Object.getPrototypeOf(globalThis)
 const eventTargetProto = typeof EventTarget === 'function' ? EventTarget.prototype : null
 while (proto && proto !== Object.prototype && proto !== eventTargetProto) {
  for (let i = 0; i < SCRUBBED_PROTO_NAMES.length; i++) {
   try {
    delete proto[SCRUBBED_PROTO_NAMES[i]]
   }
   catch {
    // Ignore non-configurable prototype properties
   }
  }
  proto = Object.getPrototypeOf(proto)
 }

 for (let i = 0; i < SCRUBBED_GLOBAL_NAMES.length; i++) {
  const key = SCRUBBED_GLOBAL_NAMES[i]
  try {
   delete globalThis[key]
  }
  catch {
   // Ignore non-configurable globals and fall through to defineProperty
  }
  if (key in globalThis) {
   try {
    Object.defineProperty(globalThis, key, {
     value: undefined,
     writable: false,
     configurable: false,
     enumerable: false,
    })
   }
   catch {
    try {
     globalThis[key] = undefined
    }
    catch {
     // Ignore frozen host bindings
    }
   }
  }
 }
}

async function initWorkerTransport() {
 if (!isNodeRuntime && typeof globalThis.postMessage === 'function' && typeof globalThis.addEventListener === 'function') {
  const post = globalThis.postMessage.bind(globalThis)
  const handlers = new Set()
  globalThis.addEventListener('message', ev => {
   const payload = ev && typeof ev === 'object' && 'data' in ev ? ev.data : ev
   for (const fn of handlers) {
    fn(payload)
   }
  })
  scrubWorkerGlobals()
  return {
   post(msg) {
    post(msg)
   },
   onMessage(fn) {
    handlers.add(fn)
   },
  }
 }

 const wtSpec = 'node:worker_threads'
 const { parentPort } = await import(wtSpec)
 if (!parentPort) {
  throw new Error('source-worker.mjs must run inside a Worker')
 }
 const post = parentPort.postMessage.bind(parentPort)
 const handlers = new Set()
 parentPort.on('message', payload => {
  for (const fn of handlers) {
   fn(payload)
  }
 })
 scrubWorkerGlobals()
 return {
  post(msg) {
   post(msg)
  },
  onMessage(fn) {
   handlers.add(fn)
  },
 }
}

const transport = await initWorkerTransport()
let nextRequestId = 0
const pendingRpc = new Map()

function callHostRpc(runId, method, params, lineContext) {
 return new Promise((resolve, reject) => {
  const requestId = ++nextRequestId
  pendingRpc.set(requestId, { runId, resolve, reject })
  transport.post({
   protocol: SOURCE_WORKER_PROTOCOL,
   type: 'rpc-request',
   runId,
   requestId,
   method,
   params,
   lineContext: lineContext
    ? {
     index: lineContext.index,
     lineNumber: lineContext.lineNumber,
     lineId: lineContext.lineId,
    }
    : { index: null, lineNumber: null, lineId: '' },
  })
 })
}

function createWorkerDataProxy(runId, lineContext, prefix = '') {
 const joinPrefix = sub => {
  const cleanSub = String(sub ?? '').trim()
  if (!cleanSub) {
   return prefix
  }
  return prefix ? `${prefix}.${cleanSub}` : cleanSub
 }
 return Object.freeze({
  get(key) {
   return callHostRpc(runId, 'data.get', { prefix, key: String(key ?? '') }, lineContext)
  },
  set(key, value) {
   return callHostRpc(runId, 'data.set', {
    prefix,
    key: String(key ?? ''),
    value: value === null || value === undefined ? '' : String(value),
   }, lineContext)
  },
  delete(key) {
   return callHostRpc(runId, 'data.delete', { prefix, key: String(key ?? '') }, lineContext)
  },
  namespace(...parts) {
   const sub = parts.map(p => String(p ?? '').trim()).filter(Boolean).join('.')
   return createWorkerDataProxy(runId, lineContext, joinPrefix(sub))
  },
 })
}

function createWorkerFetchProxy(runId, lineContext) {
 return async (url, init) => {
  const cleanHeaders = {}
  if (init && typeof init === 'object' && init.headers && typeof init.headers === 'object') {
   for (const [k, v] of Object.entries(init.headers)) {
    if (v !== undefined && v !== null) {
     cleanHeaders[String(k)] = String(v)
    }
   }
  }
  const cleanInit = init && typeof init === 'object'
   ? {
    ...(init.method !== undefined ? { method: String(init.method) } : {}),
    ...(Object.keys(cleanHeaders).length > 0 ? { headers: cleanHeaders } : {}),
    ...(init.body !== undefined && init.body !== null ? { body: String(init.body) } : {}),
   }
   : undefined
  const resp = await callHostRpc(runId, 'fetch', {
   url: String(url ?? ''),
   init: cleanInit,
  }, lineContext)
  if (!resp || typeof resp !== 'object') {
   return null
  }
  const bodyText = typeof resp.bodyText === 'string' ? resp.bodyText : ''
  const headersMap = resp.headers && typeof resp.headers === 'object' ? { ...resp.headers } : {}
  return {
   ok: Boolean(resp.ok),
   status: Number.isInteger(resp.status) ? resp.status : 200,
   statusText: typeof resp.statusText === 'string' ? resp.statusText : '',
   url: typeof resp.url === 'string' ? resp.url : String(url ?? ''),
   headers: {
    ...headersMap,
    get(name) {
     const key = String(name ?? '').toLowerCase()
     return Object.hasOwn(headersMap, key) ? headersMap[key] : null
    },
   },
   async text() {
    return bodyText
   },
   async json() {
    return JSON.parse(bodyText)
   },
  }
 }
}

function createWorkerConsoleProxy(runId, lineContext, secretValues = [], localLogs = null) {
 const emit = (level, rawArgs) => {
  const formatted = rawArgs.map(arg => {
   const text = typeof arg === 'string' ? arg : formatValue(arg)
   return secretValues.length > 0 ? redactSecretText(text, secretValues) : text
  })
  if (Array.isArray(localLogs)) {
   localLogs.push({ level, message: formatted.join(' '), ts: Date.now() })
  }
  callHostRpc(runId, 'console', { level, args: formatted }, lineContext).catch(() => {})
 }
 return Object.freeze({
  log: (...args) => emit('log', args),
  info: (...args) => emit('info', args),
  warn: (...args) => emit('warn', args),
  error: (...args) => emit('error', args),
 })
}

async function handleRunMessage(msg) {
 const {
  runId,
  filename = 'lane',
  lines = [],
  lineRecords = null,
  includePreviews = true,
  limits = null,
  inputsEnv = {},
  tablesScope = {},
  tableChange = null,
  secretMeta = {},
 } = msg

 const secretNames = Array.isArray(secretMeta.secretNames) ? secretMeta.secretNames : []
 const secretSetNames = Array.isArray(secretMeta.secretSetNames) ? secretMeta.secretSetNames : []
 const secretValues = Array.isArray(secretMeta.secretValues) ? secretMeta.secretValues : []
 const lineContext = { index: null, lineNumber: null, lineId: '' }

 const exportFn = (firstArg, secondArg, thirdArg) =>
  callHostRpc(runId, 'exportLaneLine', { firstArg, secondArg, thirdArg }, lineContext)

 const deployFn = (targetId, deployOpts) =>
  callHostRpc(runId, 'deployLane', { targetId: String(targetId ?? ''), deployOpts }, lineContext)

 let helperWillScope = null

 const workerEnv = {
  console: createWorkerConsoleProxy(runId, lineContext, secretValues),
  data: createWorkerDataProxy(runId, lineContext),
  Math,
  Number,
  JSON,
  Date,
  Array,
  fetch: createWorkerFetchProxy(runId, lineContext),
  async syncTable(tblQuery, records, keyCol) {
   const resp = await callHostRpc(runId, 'syncTable', {
    tblQuery: String(tblQuery ?? ''),
    records: Array.isArray(records) ? records : [],
    keyCol: keyCol === undefined || keyCol === null ? undefined : String(keyCol),
   }, lineContext)
   if (resp && resp.tablesScope && typeof resp.tablesScope === 'object') {
    Object.assign(workerEnv, resp.tablesScope)
   }
   return resp && resp.result ? resp.result : { ok: false, count: 0, added: 0, updated: 0 }
  },
  async importLane(targetId, ...path) {
   const cleanTarget = targetId === undefined || targetId === null ? '' : String(targetId)
   if (!cleanTarget) {
    return undefined
   }
   const encoded = await callHostRpc(runId, 'importLane', {
    targetId: cleanTarget,
    path: path.map(p => String(p ?? '')),
   }, lineContext)
   if (!helperWillScope) {
    helperWillScope = field({ Math, Number, JSON, Date, Array }, { disallowLoad: true, limits })
   }
   return decodeWireValue(encoded, {
    compileWill: ast => helperWillScope.will(['@', ...ast]),
   })
  },
  exportLaneLine: exportFn,
  setLaneLine: exportFn,
  syncLaneTable(targetId, tblQuery, records, keyCol) {
   return callHostRpc(runId, 'syncLaneTable', {
    targetId: String(targetId ?? ''),
    tblQuery: String(tblQuery ?? ''),
    records: Array.isArray(records) ? records : [],
    keyCol: keyCol === undefined || keyCol === null ? undefined : String(keyCol),
   }, lineContext)
  },
  deployLane: deployFn,
  resyncLane: deployFn,
  tableChange: tableChange && typeof tableChange === 'object' ? tableChange : null,
  respond: createResponseHelper(),
 }

 if (inputsEnv && typeof inputsEnv === 'object') {
  for (const [k, v] of Object.entries(inputsEnv)) {
   if (k !== '__proto__') {
    workerEnv[k] = v
   }
  }
 }
 if (tablesScope && typeof tablesScope === 'object') {
  for (const [k, v] of Object.entries(tablesScope)) {
   if (k !== '__proto__') {
    workerEnv[k] = v
   }
  }
 }
 if (secretNames.length > 0) {
  workerEnv.__secretNames = secretNames
  workerEnv.__secretSetNames = secretSetNames
  workerEnv.__secretValues = secretValues
 }

 const compiled = compileFieldScriptLines(lines, { filename, limits })
 const outcome = await runCompiledLines(compiled, {
  initialState: workerEnv,
  lineContext,
  lineRecords,
  includePreviews,
  limits,
  disallowLoad: true,
  onLineStart: info => {
   transport.post({
    protocol: SOURCE_WORKER_PROTOCOL,
    type: 'line-start',
    runId,
    index: info.index,
    lineNumber: info.lineNumber,
    lineId: info.lineId,
   })
  },
  onLineComplete: res => {
   transport.post({
    protocol: SOURCE_WORKER_PROTOCOL,
    type: 'line-complete',
    runId,
    index: res.index,
    result: {
     index: res.index,
     lineNumber: res.lineNumber,
     source: res.source,
     value: encodeWireValue(res.value),
     preview: res.preview,
     error: res.error,
     isEmpty: res.isEmpty,
     isComment: res.isComment,
    },
   })
  },
 })

 const encodedResults = outcome.results.map(res => ({
  index: res.index,
  lineNumber: res.lineNumber,
  source: res.source,
  value: encodeWireValue(res.value),
  preview: res.preview,
  error: res.error,
  isEmpty: res.isEmpty,
  isComment: res.isComment,
 }))
 const encodedState = encodeWireState(outcome.state, WORKER_BUILTIN_STATE_KEYS)
 const encodedSent = Array.isArray(outcome.sent)
  ? outcome.sent.map(pkt => ({
   wire: pkt && typeof pkt.wire === 'string' ? pkt.wire : serializeTransportPacket(pkt),
  }))
  : []

 transport.post({
  protocol: SOURCE_WORKER_PROTOCOL,
  type: 'run-complete',
  runId,
  results: encodedResults,
  state: encodedState,
  sent: encodedSent,
 })
}

async function handleSimulateHttpMessage(msg) {
 const {
  runId,
  laneId = 'lane',
  lines = [],
  inputs = [],
  tablesScope = {},
  req = {},
  cors = true,
 } = msg

 const logs = []
 const startMs = Date.now()
 const requestObj = buildRequestObject(req)
 const lineContext = { index: null, lineNumber: null, lineId: '' }
 let helperWillScope = null

 const buildSimState = reqForRun => {
  const env = {
   console: createWorkerConsoleProxy(runId, lineContext, [], logs),
   data: createWorkerDataProxy(runId, lineContext),
   Math,
   Number,
   JSON,
   Date,
   Array,
   fetch: createWorkerFetchProxy(runId, lineContext),
   async importLane(targetId, ...path) {
    const cleanTarget = targetId === undefined || targetId === null ? '' : String(targetId)
    if (!cleanTarget) {
     return undefined
    }
    const encoded = await callHostRpc(runId, 'importLane', {
     targetId: cleanTarget,
     path: path.map(p => String(p ?? '')),
    }, lineContext)
    if (!helperWillScope) {
     helperWillScope = field({ Math, Number, JSON, Date, Array }, { disallowLoad: true })
    }
    return decodeWireValue(encoded, {
     compileWill: ast => helperWillScope.will(['@', ...ast]),
    })
   },
   respond: createResponseHelper(),
   ...(reqForRun ? { req: reqForRun } : {}),
  }
  if (Array.isArray(inputs)) {
   for (const entry of inputs) {
    if (entry && typeof entry.name === 'string' && entry.name.trim()) {
     env[entry.name.trim()] = defaultValueForType(normalizePrimitiveType(entry.type))
    }
   }
  }
  if (tablesScope && typeof tablesScope === 'object') {
   Object.assign(env, tablesScope)
  }
  return env
 }

 const compiled = compileFieldScriptLines(lines, { filename: laneId || 'lane' })
 const startupOutcome = await runCompiledLines(compiled, {
  initialState: buildSimState(requestObj),
  disallowLoad: true,
 })

 const runFreshLane = async freshReq => {
  if (freshReq === requestObj) {
   return startupOutcome
  }
  return runCompiledLines(compiled, {
   initialState: buildSimState(freshReq),
   disallowLoad: true,
  })
 }

 const httpResult = await executeLaneHttpRequest({
  req: requestObj,
  laneState: startupOutcome.state,
  runFreshLane,
  cors,
 })

 const durationMs = Math.max(0, Date.now() - startMs)
 transport.post({
  protocol: SOURCE_WORKER_PROTOCOL,
  type: 'simulate-complete',
  runId,
  response: {
   ...httpResult,
   durationMs,
   logs,
  },
 })
}

transport.onMessage(raw => {
 if (!raw || typeof raw !== 'object' || raw.protocol !== SOURCE_WORKER_PROTOCOL) {
  return
 }
 if (raw.type === 'rpc-response') {
  const pending = pendingRpc.get(raw.requestId)
  if (!pending) {
   return
  }
  pendingRpc.delete(raw.requestId)
  if (raw.ok) {
   pending.resolve(raw.result)
  }
  else {
   pending.reject(new Error(raw.error || 'Host RPC error'))
  }
  return
 }
 if (raw.type === 'run') {
  handleRunMessage(raw).catch(err => {
   transport.post({
    protocol: SOURCE_WORKER_PROTOCOL,
    type: 'run-error',
    runId: raw.runId,
    error: err instanceof Error ? err.message : String(err),
   })
  })
  return
 }
 if (raw.type === 'simulate-http') {
  handleSimulateHttpMessage(raw).catch(err => {
   transport.post({
    protocol: SOURCE_WORKER_PROTOCOL,
    type: 'run-error',
    runId: raw.runId,
    error: err instanceof Error ? err.message : String(err),
   })
  })
 }
})
