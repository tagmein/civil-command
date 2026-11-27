import http from 'node:http'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
 DEFAULT_FIELD_LIMITS,
 buildTablesScope,
 cloneScopeData,
 compileFieldScriptLines,
 createExecutionBudget,
 deepFreezeScopeData,
 defaultValueForType,
 isRemoteTable,
 normalizeFieldLimits,
 normalizePrimitiveType,
 resolveImportValue,
} from './field.mjs'
import {
 attenuateKv,
 httpKV,
 laneTriggerKey,
} from './data.mjs'
import {
 collectImportTargetsFromLine,
 computeLaneScriptHash,
 computeLaneSnapshotRevision,
 loadLaneScript,
 loadLaneTables,
} from './storage.mjs'
import {
 buildRequestObject,
 createResponseHelper,
 detectLaneHandlers,
 executeLaneHttpRequest,
 normalizeHttpResult,
 resolveRequestIp,
} from './lane-http.mjs'
import {
 createSafeExternalFetch,
 runLinesInWorker,
 simulateLaneRequestInWorker,
} from './sandbox.mjs'

const MAX_REQUEST_BODY_BYTES = 2 * 1024 * 1024

export const DEFAULT_SERVER_LIMITS = Object.freeze({
 ...DEFAULT_FIELD_LIMITS,
 maxExecutionMs: 30000,
 maxImportDepth: 32,
 maxImportedLanes: 256,
})

export const DEFAULT_AUTO_RELOAD_CONFIG = Object.freeze({
 enabled: true,
 intervalMs: 1500,
 debounceMs: 75,
 maxReloadsPerMinute: 120,
 watchKeys: Object.freeze([]),
})

export { resolveRequestIp }

function parseBooleanFlag(raw) {
 if (raw === undefined || raw === null || raw === '') {
  return undefined
 }
 if (typeof raw === 'boolean') {
  return raw
 }
 if (typeof raw === 'number') {
  return raw !== 0
 }
 const lower = String(raw).trim().toLowerCase()
 if (lower === '1' || lower === 'true' || lower === 'on' || lower === 'yes') {
  return true
 }
 if (lower === '0' || lower === 'false' || lower === 'off' || lower === 'no') {
  return false
 }
 return undefined
}

function parseNonNegInt(raw) {
 if (raw === undefined || raw === null || raw === '') {
  return undefined
 }
 if (raw === false || raw === 0 || raw === Infinity) {
  return 0
 }
 if (typeof raw === 'string') {
  const lower = raw.trim().toLowerCase()
  if (!lower) {
   return undefined
  }
  if (lower === 'false' || lower === 'off' || lower === '0' || lower === 'infinity' || lower === 'unlimited') {
   return 0
  }
 }
 const n = Number(raw)
 if (!Number.isFinite(n)) {
  return undefined
 }
 return n <= 0 ? 0 : Math.trunc(n)
}

export function normalizeServerLimits(
 raw = {},
 env = typeof process !== 'undefined' && process && process.env ? process.env : null
) {
 const src = raw && typeof raw === 'object' ? raw : {}
 const globalLimits = typeof globalThis !== 'undefined' && globalThis.CC_FIELD_LIMITS && typeof globalThis.CC_FIELD_LIMITS === 'object'
  ? globalThis.CC_FIELD_LIMITS
  : null
 const baseEnv = env && typeof env === 'object' ? env : null

 const preResolved = {}
 const envNames = {
  maxScriptBytes: 'CC_MAX_SCRIPT_BYTES',
  maxLineBytes: 'CC_MAX_LINE_BYTES',
  maxScriptLines: 'CC_MAX_SCRIPT_LINES',
  maxAstDepth: 'CC_MAX_AST_DEPTH',
  maxAstNodes: 'CC_MAX_AST_NODES',
  maxLoopIterations: 'CC_MAX_LOOP_ITERATIONS',
  maxCallDepth: 'CC_MAX_CALL_DEPTH',
  maxSteps: 'CC_MAX_STEPS',
  maxExecutionMs: 'CC_MAX_EXECUTION_MS',
  maxLoadDepth: 'CC_MAX_LOAD_DEPTH',
  maxTotalLoads: 'CC_MAX_TOTAL_LOADS',
 }
 for (const key of Object.keys(DEFAULT_FIELD_LIMITS)) {
  if (src[key] !== undefined) {
   preResolved[key] = src[key]
  }
  else if (globalLimits && globalLimits[key] !== undefined) {
   preResolved[key] = globalLimits[key]
  }
  else if (baseEnv && envNames[key] && baseEnv[envNames[key]] !== undefined) {
   preResolved[key] = baseEnv[envNames[key]]
  }
  else if (key === 'maxExecutionMs') {
   preResolved[key] = DEFAULT_SERVER_LIMITS.maxExecutionMs
  }
 }

 const fieldLimits = normalizeFieldLimits(preResolved, { useEnv: false })
 const importDepthCandidate = src.maxImportDepth !== undefined
  ? src.maxImportDepth
  : (baseEnv && baseEnv.CC_MAX_IMPORT_DEPTH !== undefined ? baseEnv.CC_MAX_IMPORT_DEPTH : DEFAULT_SERVER_LIMITS.maxImportDepth)
 const importedLanesCandidate = src.maxImportedLanes !== undefined
  ? src.maxImportedLanes
  : (baseEnv && baseEnv.CC_MAX_IMPORTED_LANES !== undefined ? baseEnv.CC_MAX_IMPORTED_LANES : DEFAULT_SERVER_LIMITS.maxImportedLanes)

 const maxImportDepth = parseNonNegInt(importDepthCandidate)
 const maxImportedLanes = parseNonNegInt(importedLanesCandidate)

 return Object.freeze({
  ...fieldLimits,
  maxImportDepth: maxImportDepth !== undefined ? maxImportDepth : DEFAULT_SERVER_LIMITS.maxImportDepth,
  maxImportedLanes: maxImportedLanes !== undefined ? maxImportedLanes : DEFAULT_SERVER_LIMITS.maxImportedLanes,
 })
}

export function normalizeAutoReloadConfig(
 raw = undefined,
 env = typeof process !== 'undefined' && process && process.env ? process.env : null
) {
 const baseEnv = env && typeof env === 'object' ? env : null
 let srcObj = {}
 let explicitEnabled
 if (typeof raw === 'boolean') {
  explicitEnabled = raw
 }
 else if (raw && typeof raw === 'object') {
  srcObj = raw
  if (raw.enabled !== undefined) {
   explicitEnabled = parseBooleanFlag(raw.enabled)
  }
 }

 const envEnabled = baseEnv ? parseBooleanFlag(baseEnv.CC_AUTO_RELOAD) : undefined
 const envInterval = baseEnv ? parseNonNegInt(baseEnv.CC_AUTO_RELOAD_MS) : undefined
 const rawInterval = parseNonNegInt(srcObj.intervalMs)
 const rawDebounce = parseNonNegInt(srcObj.debounceMs)
 const rawMaxPerMin = parseNonNegInt(srcObj.maxReloadsPerMinute)

 let intervalMs = rawInterval !== undefined
  ? rawInterval
  : (envInterval !== undefined ? envInterval : DEFAULT_AUTO_RELOAD_CONFIG.intervalMs)
 if (intervalMs > 0 && intervalMs < 20) {
  intervalMs = 20
 }

 let enabled
 if (explicitEnabled !== undefined) {
  enabled = explicitEnabled
 }
 else if (envEnabled !== undefined) {
  enabled = envEnabled
 }
 else {
  enabled = DEFAULT_AUTO_RELOAD_CONFIG.enabled
 }
 if (intervalMs === 0) {
  enabled = false
 }

 const debounceMs = rawDebounce !== undefined ? rawDebounce : DEFAULT_AUTO_RELOAD_CONFIG.debounceMs
 const maxReloadsPerMinute = rawMaxPerMin !== undefined ? rawMaxPerMin : DEFAULT_AUTO_RELOAD_CONFIG.maxReloadsPerMinute

 const rawWatchKeys = Array.isArray(srcObj.watchKeys) ? srcObj.watchKeys : []
 const watchKeys = []
 const seenKeys = new Set()
 for (const k of rawWatchKeys) {
  const clean = k === null || k === undefined ? '' : String(k).trim()
  if (clean && !seenKeys.has(clean)) {
   seenKeys.add(clean)
   watchKeys.push(clean)
  }
 }

 return Object.freeze({
  enabled: Boolean(enabled),
  intervalMs,
  debounceMs,
  maxReloadsPerMinute,
  watchKeys: Object.freeze(watchKeys),
 })
}

export function formatRequestLogLine({
 slug = '',
 laneId = '',
 method = 'GET',
 path = '/',
 status = 200,
 durationMs = 0,
 ip = '',
} = {}) {
 const label = String(slug || laneId || 'lane').trim() || 'lane'
 const cleanMethod = String(method || 'GET').trim().toUpperCase() || 'GET'
 const cleanPath = String(path || '/').trim() || '/'
 const cleanStatus = Number.isFinite(Number(status)) ? Math.trunc(Number(status)) : 200
 const cleanDuration = Math.max(0, Math.round(Number(durationMs) || 0))
 const cleanIp = String(ip || '').trim()
 const ipPart = cleanIp ? ` ip=${cleanIp}` : ''
 return `[civil-lane:${label}] ${cleanMethod} ${cleanPath} -> ${cleanStatus} (${cleanDuration}ms)${ipPart}`
}

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

function createSnapshotError(message) {
 const err = new Error(message)
 err.isDeterministicSnapshotError = true
 return err
}

function isDeterministicError(err) {
 return Boolean(
  err && (
   err.isDeterministicSnapshotError ||
   err.code === 'FIELD_LIMIT_EXCEEDED' ||
   err instanceof SyntaxError
  )
 )
}

function collectStaticImportTargets(lines) {
 const out = []
 const seen = new Set()
 for (const line of lines) {
  const deps = collectImportTargetsFromLine(line)
  for (const dep of deps) {
   const clean = dep ? String(dep).trim() : ''
   if (clean && !seen.has(clean)) {
    seen.add(clean)
    out.push(clean)
   }
  }
 }
 return out
}

export function createLaneHttpServer(config = {}, opts = {}) {
 const laneId = String(config.laneId || '').trim()
 if (!laneId) {
  throw new Error('createLaneHttpServer requires config.laneId')
 }
 const cors = config.cors !== false
 const includeImports = Boolean(config.includeImports)
 const logger = opts.logger || console
 const logRequests = opts.logRequests !== undefined
  ? Boolean(opts.logRequests)
  : config.logRequests !== false
 const normalizedUrl = config.civilMemoryUrl
  ? normalizeCivilMemoryBaseUrl(config.civilMemoryUrl)
  : ''

 if (!opts.kv && !normalizedUrl) {
  throw new Error('createLaneHttpServer requires config.civilMemoryUrl or opts.kv')
 }

 const limits = normalizeServerLimits(
  opts.limits !== undefined ? opts.limits : config.limits
 )
 const autoReloadConfig = normalizeAutoReloadConfig(
  opts.autoReload !== undefined ? opts.autoReload : config.autoReload
 )

 const rootKv = opts.kv || httpKV({
  baseUrl: normalizedUrl,
  basePath: config.dataBasePath || null,
  switchable: false,
 })
 const externalFetch = typeof opts.fetch === 'function'
  ? opts.fetch
  : createSafeExternalFetch()

 function buildEmptySnapshot(errorMsg = null, loadedAt = null) {
  return Object.freeze({
   mainUnit: null,
   importedUnits: new Map(),
   loadedLaneIds: Object.freeze([laneId]),
   title: String(config.title || ''),
   hasHandlers: false,
   methods: Object.freeze([]),
   startupError: errorMsg,
   scriptHash: '',
   revision: '',
   loadedAt,
  })
 }

 let currentTitle = String(config.title || '')
 let currentSnapshot = buildEmptySnapshot(null, null)
 let hasLoadedOnce = false
 let reloadGeneration = 0
 let lastTriggerState = null
 let activeReloadPromise = null
 let queuedReloadForce = null
 let queuedReloadPromise = null

 let closed = false
 let pollTimer = null
 let debounceTimer = null
 let debounceResolve = null
 let pollInFlight = false
 const recentAutoReloads = []
 let throttleWarnedUntilMs = 0

 function logRequest(entry) {
  const line = formatRequestLogLine({
   slug: config.slug,
   laneId,
   ...entry,
  })
  if (typeof opts.onRequestLog === 'function') {
   try {
    opts.onRequestLog({
     slug: config.slug || '',
     laneId,
     ...entry,
     line,
    })
   }
   catch {}
  }
  if (logRequests && logger && typeof logger.log === 'function') {
   logger.log(line)
  }
 }

 async function readTriggerState(laneIds = [laneId], preReadMap = null) {
  const keys = []
  const seen = new Set()
  for (const id of laneIds) {
   const k = laneTriggerKey(id)
   if (k && !seen.has(k)) {
    seen.add(k)
    keys.push(k)
   }
  }
  for (const wk of autoReloadConfig.watchKeys) {
   if (wk && !seen.has(wk)) {
    seen.add(wk)
    keys.push(wk)
   }
  }
  const valuesByKey = Object.create(null)
  const missingKeys = []
  for (const k of keys) {
   if (preReadMap && Object.hasOwn(preReadMap, k)) {
    valuesByKey[k] = preReadMap[k]
   }
   else {
    missingKeys.push(k)
   }
  }
  if (missingKeys.length > 0) {
   const fetched = await Promise.all(missingKeys.map(k => rootKv.get(k)))
   for (let i = 0; i < missingKeys.length; i++) {
    const raw = fetched[i]
    valuesByKey[missingKeys[i]] = raw === null || raw === undefined ? null : String(raw)
   }
  }
  let complete = keys.length > 0
  let hasAny = false
  const pairs = []
  for (const k of keys) {
   const val = valuesByKey[k]
   if (val === null || val === undefined || val === '') {
    complete = false
   }
   else {
    hasAny = true
   }
   pairs.push([k, val ?? null])
  }
  return {
   keys,
   valuesByKey,
   complete,
   hasAny,
   signature: JSON.stringify(pairs),
  }
 }

 async function loadLaneUnit(targetId, { requireExists = false, preReadTriggers = null } = {}) {
  const cleanId = String(targetId || '').trim()
  const trigKey = laneTriggerKey(cleanId)
  let preTriggerVal
  if (preReadTriggers && Object.hasOwn(preReadTriggers, trigKey)) {
   preTriggerVal = preReadTriggers[trigKey]
  }
  else {
   const rawTrig = await rootKv.get(trigKey)
   preTriggerVal = rawTrig === null || rawTrig === undefined ? null : String(rawTrig)
  }

  const laneData = rootKv.namespace(cleanId)
  const [loadedScript, storedInputs, tables, storedTitle] = await Promise.all([
   loadLaneScript(rootKv, laneData, cleanId, null),
   laneData.get('inputs'),
   loadLaneTables(rootKv, laneData, cleanId),
   laneData.get('title'),
  ])

  const hasData = Boolean(
   (loadedScript && loadedScript.initialized) ||
   (storedInputs !== null && storedInputs !== undefined && storedInputs !== '') ||
   (Array.isArray(tables) && tables.length > 0) ||
   (storedTitle !== null && storedTitle !== undefined && storedTitle !== '')
  )

  if (requireExists && !hasData) {
   return Object.freeze({
    id: cleanId,
    exists: false,
    title: '',
    lines: Object.freeze([]),
    compiledLines: null,
    inputs: Object.freeze([]),
    tables: Object.freeze([]),
    tablesScopeTemplate: Object.freeze({}),
    staticImportTargets: Object.freeze([]),
    scriptHash: '',
    unitRevision: '',
    compileError: null,
    preTriggerVal,
   })
  }

  const records = Array.isArray(loadedScript && loadedScript.records) ? loadedScript.records : []
  const lines = records.map(r => (r && r.text !== undefined && r.text !== null ? String(r.text) : ''))
  const inputs = parseStoredInputs(storedInputs).map(entry => Object.freeze({ ...entry }))
  const cleanTables = Array.isArray(tables) ? tables : []
  const titleStr = storedTitle === null || storedTitle === undefined ? '' : String(storedTitle)
  const scriptHash = computeLaneScriptHash(lines)
  const unitRevision = computeLaneSnapshotRevision({
   laneId: cleanId,
   title: titleStr,
   inputs,
   lines,
   tables: cleanTables,
  })
  const staticImportTargets = includeImports ? collectStaticImportTargets(lines) : []

  let compiledLines = null
  let compileError = null
  try {
   compiledLines = compileFieldScriptLines(lines, { filename: cleanId, limits })
  }
  catch (err) {
   if (isDeterministicError(err)) {
    compileError = err instanceof Error ? err.message : String(err)
   }
   else {
    throw err
   }
  }

  const tablesScopeTemplate = cleanTables.length > 0
   ? deepFreezeScopeData(buildTablesScope(cleanTables))
   : Object.freeze({})

  return Object.freeze({
   id: cleanId,
   exists: hasData,
   title: titleStr,
   lines: Object.freeze(lines),
   compiledLines,
   inputs: Object.freeze(inputs),
   tables: Object.freeze(cleanTables),
   tablesScopeTemplate,
   staticImportTargets: Object.freeze(staticImportTargets),
   scriptHash,
   unitRevision,
   compileError,
   preTriggerVal,
  })
 }

 function computeBudgetLimits(executionBudget) {
  if (!executionBudget) {
   return { unitLimits: limits, timeoutMs: limits.maxExecutionMs }
  }
  let remainingSteps = limits.maxSteps
  if (executionBudget.maxSteps > 0) {
   if (executionBudget.steps >= executionBudget.maxSteps) {
    const err = new RangeError(`Maximum FieldScript execution steps (${executionBudget.maxSteps}) exceeded`)
    err.code = 'FIELD_LIMIT_EXCEEDED'
    executionBudget.exhausted = true
    executionBudget.exhaustedKind = 'maxSteps'
    executionBudget.exhaustedError = err
    throw err
   }
   remainingSteps = Math.max(1, executionBudget.maxSteps - executionBudget.steps)
  }
  let remainingMs = limits.maxExecutionMs
  if (executionBudget.deadlineMs > 0) {
   const left = executionBudget.deadlineMs - Date.now()
   if (left <= 0) {
    const err = new RangeError(`FieldScript execution timed out after ${executionBudget.maxExecutionMs}ms`)
    err.code = 'FIELD_LIMIT_EXCEEDED'
    executionBudget.exhausted = true
    executionBudget.exhaustedKind = 'maxExecutionMs'
    executionBudget.exhaustedError = err
    throw err
   }
   remainingMs = Math.max(1, left)
  }
  return {
   unitLimits: {
    ...limits,
    maxSteps: remainingSteps,
    maxExecutionMs: remainingMs,
   },
   timeoutMs: remainingMs,
  }
 }

 function applyWorkerBudget(executionBudget, workerBudget) {
  if (!executionBudget || !workerBudget || typeof workerBudget !== 'object') {
   return
  }
  if (Number.isFinite(Number(workerBudget.steps)) && Number(workerBudget.steps) > 0) {
   executionBudget.steps += Math.trunc(Number(workerBudget.steps))
  }
  if (workerBudget.exhausted) {
   executionBudget.exhausted = true
   executionBudget.exhaustedKind = workerBudget.exhaustedKind || 'limit'
   if (!executionBudget.exhaustedError) {
    const err = new RangeError(workerBudget.error || 'Execution limit exceeded')
    err.code = 'FIELD_LIMIT_EXCEEDED'
    executionBudget.exhaustedError = err
   }
  }
 }

 function createImportLaneResolver(unit, {
  importedUnits,
  dynamicUnits = null,
  executionBudget,
  evalCache = new Map(),
  activeStack = new Set(),
  preReadTriggers = null,
  onTransientError = null,
 } = {}) {
  const nextStack = new Set(activeStack)
  nextStack.add(unit.id)

  return async (depId, ...propPath) => {
   if (!includeImports) {
    return undefined
   }
   const cleanDep = depId === null || depId === undefined ? '' : String(depId).trim()
   if (!cleanDep) {
    return undefined
   }
   if (cleanDep === unit.id || nextStack.has(cleanDep)) {
    return resolveImportValue({ ok: false, state: null, error: 'Circular lane import detected' }, propPath)
   }
   if (limits.maxImportDepth > 0 && nextStack.size >= limits.maxImportDepth) {
    throw createSnapshotError(`Maximum lane import depth (${limits.maxImportDepth}) exceeded`)
   }

   if (!evalCache.has(cleanDep)) {
    let depUnit = importedUnits.get(cleanDep) || (dynamicUnits && dynamicUnits !== importedUnits ? dynamicUnits.get(cleanDep) : null)
    if (!depUnit) {
     const distinctCount = importedUnits.size + (dynamicUnits && dynamicUnits !== importedUnits ? dynamicUnits.size : 0)
     if (limits.maxImportedLanes > 0 && distinctCount >= limits.maxImportedLanes) {
      throw createSnapshotError(`Maximum imported lanes (${limits.maxImportedLanes}) exceeded`)
     }
     try {
      depUnit = await loadLaneUnit(cleanDep, { requireExists: true, preReadTriggers })
     }
     catch (err) {
      if (typeof onTransientError === 'function' && !isDeterministicError(err)) {
       onTransientError(err)
      }
      throw err
     }
     if (dynamicUnits) {
      dynamicUnits.set(cleanDep, depUnit)
     }
    }
    if (!depUnit || !depUnit.exists) {
     evalCache.set(cleanDep, { exists: false, state: null })
    }
    else {
     const depOutcome = await evaluateUnit(depUnit, {
      importedUnits,
      dynamicUnits,
      req: null,
      executionBudget,
      evalCache,
      activeStack: nextStack,
      preReadTriggers,
      onTransientError,
     })
     evalCache.set(cleanDep, { exists: true, state: depOutcome.state })
    }
   }

   const cached = evalCache.get(cleanDep)
   if (!cached || !cached.exists) {
    return undefined
   }
   const resolved = resolveImportValue({ ok: true, state: cached.state, error: null }, propPath)
   return cloneScopeData(resolved)
  }
 }

 async function evaluateUnit(unit, {
  importedUnits,
  dynamicUnits = null,
  req = null,
  executionBudget,
  evalCache = new Map(),
  activeStack = new Set(),
  preReadTriggers = null,
  onTransientError = null,
 } = {}) {
  if (!unit) {
   return { exists: false, state: {}, results: [] }
  }
  if (unit.compileError) {
   return {
    exists: unit.exists,
    state: {},
    results: [{ index: 0, lineNumber: 1, error: unit.compileError, isEmpty: false, isComment: false }],
   }
  }

  const importLane = createImportLaneResolver(unit, {
   importedUnits,
   dynamicUnits,
   executionBudget,
   evalCache,
   activeStack,
   preReadTriggers,
   onTransientError,
  })

  const env = {
   console: logger,
   data: attenuateKv(rootKv.namespace(unit.id)),
   fetch: externalFetch,
   importLane,
   ...(req ? { req } : {}),
  }

  for (const entry of unit.inputs) {
   const trimmed = entry.name.trim()
   if (!trimmed) {
    continue
   }
   env[trimmed] = defaultValueForType(entry.type)
  }

  if (unit.tablesScopeTemplate && Object.keys(unit.tablesScopeTemplate).length > 0) {
   Object.assign(env, cloneScopeData(unit.tablesScopeTemplate))
  }

  const { unitLimits, timeoutMs } = computeBudgetLimits(executionBudget)
  const outcome = await runLinesInWorker(unit.lines, {
   filename: unit.id,
   initialState: env,
   includePreviews: false,
   limits: unitLimits,
   timeoutMs,
   fetch: externalFetch,
  })
  applyWorkerBudget(executionBudget, outcome.budget)

  return {
   exists: unit.exists,
   state: outcome.state,
   results: outcome.results,
  }
 }

 async function preloadStaticImports(unit, importedUnits, activeStack, preReadTriggers) {
  if (!includeImports || !unit || !Array.isArray(unit.staticImportTargets) || unit.staticImportTargets.length === 0) {
   return
  }
  for (const depId of unit.staticImportTargets) {
   if (!depId || depId === unit.id || activeStack.has(depId)) {
    continue
   }
   if (limits.maxImportDepth > 0 && activeStack.size >= limits.maxImportDepth) {
    throw createSnapshotError(`Maximum lane import depth (${limits.maxImportDepth}) exceeded`)
   }
   let depUnit = importedUnits.get(depId)
   if (!depUnit) {
    if (limits.maxImportedLanes > 0 && importedUnits.size >= limits.maxImportedLanes) {
     throw createSnapshotError(`Maximum imported lanes (${limits.maxImportedLanes}) exceeded`)
    }
    depUnit = await loadLaneUnit(depId, { requireExists: true, preReadTriggers })
    importedUnits.set(depId, depUnit)
   }
   if (depUnit.exists) {
    const nextStack = new Set(activeStack)
    nextStack.add(depId)
    await preloadStaticImports(depUnit, importedUnits, nextStack, preReadTriggers)
   }
  }
 }

 async function buildSnapshot(preReadTriggers = null) {
  const mainUnit = await loadLaneUnit(laneId, { requireExists: false, preReadTriggers })
  const importedUnits = new Map()
  const triggerValues = { ...(preReadTriggers || {}) }
  triggerValues[laneTriggerKey(laneId)] = mainUnit.preTriggerVal

  let preloadError = null
  if (includeImports) {
   try {
    await preloadStaticImports(mainUnit, importedUnits, new Set([laneId]), triggerValues)
   }
   catch (err) {
    if (isDeterministicError(err)) {
     preloadError = err instanceof Error ? err.message : String(err)
    }
    else {
     throw err
    }
   }
  }

  let hasHandlers = false
  let methods = []
  let startupError = mainUnit.compileError || preloadError || null

  if (!startupError) {
   const validationBudget = createExecutionBudget(limits)
   let transientImportError = null
   try {
    const evaluated = await evaluateUnit(mainUnit, {
     importedUnits,
     dynamicUnits: importedUnits,
     req: null,
     executionBudget: validationBudget,
     evalCache: new Map(),
     activeStack: new Set(),
     preReadTriggers: triggerValues,
     onTransientError: err => {
      if (!transientImportError) {
       transientImportError = err
      }
     },
    })
    if (transientImportError) {
     throw transientImportError
    }
    const info = detectLaneHandlers(evaluated.state)
    hasHandlers = Boolean(info.hasHandlers)
    methods = info.methods.slice()
    const lineErr = Array.isArray(evaluated.results) ? evaluated.results.find(r => r && r.error) : null
    if (lineErr) {
     startupError = lineErr.lineNumber ? `Line ${lineErr.lineNumber}: ${lineErr.error}` : lineErr.error
    }
   }
   catch (err) {
    if (isDeterministicError(err)) {
     startupError = err instanceof Error ? err.message : String(err)
    }
    else {
     throw err
    }
   }
  }

  const loadedLaneIds = [laneId]
  const importDigests = {}
  const sortedImportedIds = Array.from(importedUnits.keys()).sort()
  for (const depId of sortedImportedIds) {
   loadedLaneIds.push(depId)
   const depUnit = importedUnits.get(depId)
   importDigests[depId] = depUnit && depUnit.exists ? depUnit.unitRevision : 'missing'
   triggerValues[laneTriggerKey(depId)] = depUnit ? depUnit.preTriggerVal : null
  }

  const remoteOwnerIds = new Set()
  const collectRemoteOwners = tblList => {
   for (const tbl of Array.isArray(tblList) ? tblList : []) {
    if (isRemoteTable(tbl) && tbl.remote.laneId !== laneId) {
     remoteOwnerIds.add(tbl.remote.laneId)
    }
   }
  }
  collectRemoteOwners(mainUnit.tables)
  for (const depUnit of importedUnits.values()) {
   collectRemoteOwners(depUnit && depUnit.tables)
  }
  for (const ownerId of Array.from(remoteOwnerIds).sort()) {
   if (!loadedLaneIds.includes(ownerId)) {
    loadedLaneIds.push(ownerId)
   }
   const trigKey = laneTriggerKey(ownerId)
   if (!Object.hasOwn(triggerValues, trigKey)) {
    const rawTrig = await rootKv.get(trigKey)
    triggerValues[trigKey] = rawTrig === null || rawTrig === undefined ? null : String(rawTrig)
   }
  }

  const revision = computeLaneSnapshotRevision({
   laneId,
   title: mainUnit.title || String(config.title || ''),
   inputs: mainUnit.inputs,
   lines: mainUnit.lines,
   tables: mainUnit.tables,
   imports: importDigests,
  })

  const snap = Object.freeze({
   mainUnit,
   importedUnits,
   loadedLaneIds: Object.freeze(loadedLaneIds),
   title: mainUnit.title || '',
   hasHandlers,
   methods: Object.freeze(methods),
   startupError,
   scriptHash: mainUnit.scriptHash,
   revision,
   loadedAt: new Date().toISOString(),
  })

  return { snap, triggerValues }
 }

 async function executeSnapshotHttpRequest(snap, reqObj, executionBudget) {
  const respondHelper = createResponseHelper()
  const reqMethod = String(reqObj && reqObj.method ? reqObj.method : 'GET').toUpperCase()
  if (!snap || !snap.mainUnit) {
   return normalizeHttpResult(
    respondHelper(500, { error: snap && snap.startupError ? snap.startupError : 'Lane snapshot not loaded' }),
    { cors, method: reqMethod }
   )
  }
  if (snap.mainUnit.compileError) {
   return normalizeHttpResult(
    respondHelper(500, { error: snap.mainUnit.compileError, lineNumber: 1 }),
    { cors, method: reqMethod }
   )
  }
  try {
   const { unitLimits, timeoutMs } = computeBudgetLimits(executionBudget)
   const importLaneFn = createImportLaneResolver(snap.mainUnit, {
    importedUnits: snap.importedUnits,
    dynamicUnits: new Map(),
    executionBudget,
    evalCache: new Map(),
    activeStack: new Set(),
   })
   const simRes = await simulateLaneRequestInWorker({
    laneId: snap.mainUnit.id,
    lines: snap.mainUnit.lines,
    inputs: snap.mainUnit.inputs,
    tablesScope: snap.mainUnit.tablesScopeTemplate,
    limits: unitLimits,
    timeoutMs,
    laneData: rootKv.namespace(snap.mainUnit.id),
    importLaneFn,
    console: logger,
    fetch: externalFetch,
    req: reqObj,
    cors,
   })
   applyWorkerBudget(executionBudget, simRes && simRes.budget)
   return simRes
  }
  catch (err) {
   const msg = err instanceof Error ? err.message : String(err)
   return normalizeHttpResult(
    respondHelper(500, { error: msg }),
    { cors, method: reqMethod }
   )
  }
 }

 async function performReload({ force = false } = {}) {
  const watchIds = hasLoadedOnce && currentSnapshot
   ? currentSnapshot.loadedLaneIds
   : [laneId]
  try {
   const preTrigger = await readTriggerState(watchIds)
   if (
    !force &&
    hasLoadedOnce &&
    preTrigger.complete &&
    lastTriggerState &&
    lastTriggerState.complete &&
    preTrigger.signature === lastTriggerState.signature
   ) {
    return {
     ...getStatus(),
     reloaded: false,
     noop: true,
    }
   }

   const { snap, triggerValues } = await buildSnapshot(preTrigger.valuesByKey)
   const finalTrigger = await readTriggerState(snap.loadedLaneIds, triggerValues)

   reloadGeneration += 1
   currentSnapshot = snap
   if (snap.title) {
    currentTitle = snap.title
   }
   hasLoadedOnce = true
   lastTriggerState = finalTrigger

   return {
    ...getStatus(),
    reloaded: true,
    noop: false,
   }
  }
  catch (err) {
   const msg = err instanceof Error ? err.message : String(err)
   if (!hasLoadedOnce) {
    currentSnapshot = buildEmptySnapshot(msg, new Date().toISOString())
   }
   return {
    ...getStatus(),
    ok: false,
    error: msg,
    reloaded: false,
    noop: false,
   }
  }
 }

 function reload(options = {}) {
  const force = Boolean(options && options.force)
  if (!activeReloadPromise) {
   activeReloadPromise = (async () => {
    try {
     return await performReload({ force })
    }
    finally {
     activeReloadPromise = null
    }
   })()
   return activeReloadPromise
  }

  queuedReloadForce = queuedReloadForce === null ? force : (queuedReloadForce || force)
  if (!queuedReloadPromise) {
   queuedReloadPromise = activeReloadPromise.then(async () => {
    const nextForce = Boolean(queuedReloadForce)
    queuedReloadForce = null
    queuedReloadPromise = null
    return reload({ force: nextForce })
   })
  }
  return queuedReloadPromise
 }

 function getStatus() {
  return {
   ok: !currentSnapshot.startupError,
   slug: config.slug || '',
   laneId,
   title: currentTitle || config.title || '',
   mode: currentSnapshot.hasHandlers ? 'handler' : 'expression',
   handlers: currentSnapshot.methods.slice(),
   loadedAt: currentSnapshot.loadedAt,
   error: currentSnapshot.startupError,
   civilMemoryUrl: normalizedUrl,
   dataBasePath: config.dataBasePath || null,
   includeImports,
   revision: currentSnapshot.revision,
   scriptHash: currentSnapshot.scriptHash,
   reloadGeneration,
   loadedLaneIds: currentSnapshot.loadedLaneIds.slice(),
   autoReload: {
    enabled: autoReloadConfig.enabled,
    intervalMs: autoReloadConfig.intervalMs,
    debounceMs: autoReloadConfig.debounceMs,
    maxReloadsPerMinute: autoReloadConfig.maxReloadsPerMinute,
   },
   limits,
  }
 }

 function buildResponseHeaders(baseHeaders = {}, revision = currentSnapshot.revision) {
  const headers = { ...baseHeaders }
  if (revision) {
   headers['X-Civil-Lane-Rev'] = revision
   if (cors && !Object.keys(headers).some(k => k.toLowerCase() === 'access-control-expose-headers')) {
    headers['Access-Control-Expose-Headers'] = 'X-Civil-Lane-Rev'
   }
  }
  return headers
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
  res.writeHead(status, buildResponseHeaders(headers))
  res.end(JSON.stringify(payload))
 }

 async function waitForDebounce(ms) {
  if (!ms || ms <= 0 || closed) {
   return
  }
  await new Promise(resolve => {
   debounceResolve = resolve
   debounceTimer = setTimeout(() => {
    debounceTimer = null
    debounceResolve = null
    resolve()
   }, ms)
   if (typeof debounceTimer.unref === 'function') {
    debounceTimer.unref()
   }
  })
 }

 async function runAutoReloadPollTick() {
  if (closed || pollInFlight || activeReloadPromise || !hasLoadedOnce) {
   return
  }
  pollInFlight = true
  try {
   const cur = await readTriggerState(currentSnapshot.loadedLaneIds)
   if (closed || !cur.hasAny) {
    return
   }
   if (lastTriggerState && cur.signature === lastTriggerState.signature) {
    return
   }
   if (autoReloadConfig.maxReloadsPerMinute > 0) {
    const nowMs = Date.now()
    while (recentAutoReloads.length > 0 && nowMs - recentAutoReloads[0] >= 60000) {
     recentAutoReloads.shift()
    }
    if (recentAutoReloads.length >= autoReloadConfig.maxReloadsPerMinute) {
     if (nowMs >= throttleWarnedUntilMs && logger && typeof logger.warn === 'function') {
      throttleWarnedUntilMs = nowMs + 60000
      logger.warn(`[civil-lane:${config.slug || laneId}] auto-reload throttled after ${recentAutoReloads.length} reloads in 60s`)
     }
     return
    }
    recentAutoReloads.push(nowMs)
   }
   if (autoReloadConfig.debounceMs > 0) {
    await waitForDebounce(autoReloadConfig.debounceMs)
    if (closed) {
     return
    }
   }
   await reload({ force: false })
  }
  catch {
   // Transient poll error; keep serving existing snapshot and retry next interval
  }
  finally {
   pollInFlight = false
  }
 }

 function startAutoReloadPoller() {
  stopAutoReloadPoller()
  if (closed || !autoReloadConfig.enabled || autoReloadConfig.intervalMs <= 0) {
   return
  }
  pollTimer = setInterval(() => {
   runAutoReloadPollTick()
  }, autoReloadConfig.intervalMs)
  if (typeof pollTimer.unref === 'function') {
   pollTimer.unref()
  }
 }

 function stopAutoReloadPoller() {
  if (pollTimer) {
   clearInterval(pollTimer)
   pollTimer = null
  }
  if (debounceTimer) {
   clearTimeout(debounceTimer)
   debounceTimer = null
  }
  if (debounceResolve) {
   const fn = debounceResolve
   debounceResolve = null
   fn()
  }
 }

 const server = http.createServer(async (req, res) => {
  const startMs = Date.now()
  const reqMethod = String(req.method || 'GET').toUpperCase()
  const rawUrl = req.url || '/'
  const pathname = rawUrl.split('?')[0]
  const clientIp = resolveRequestIp({
   headers: req.headers,
   remoteAddress: req.socket && req.socket.remoteAddress,
  })

  if (pathname === '/_cc/health' && reqMethod === 'GET') {
   sendJsonResponse(res, 200, getStatus())
   logRequest({
    method: reqMethod,
    path: rawUrl,
    status: 200,
    durationMs: Date.now() - startMs,
    ip: clientIp,
   })
   return
  }

  if (pathname === '/_cc/reload' && reqMethod === 'POST') {
   let force = false
   try {
    const parsedUrl = new URL(rawUrl, 'http://localhost')
    const rawForce = parsedUrl.searchParams.get('force')
    force = rawForce === '1' || rawForce === 'true'
   }
   catch {}
   const status = await reload({ force })
   const code = status.ok ? 200 : 500
   sendJsonResponse(res, code, status)
   logRequest({
    method: reqMethod,
    path: rawUrl,
    status: code,
    durationMs: Date.now() - startMs,
    ip: clientIp,
   })
   return
  }

  let rawBody = ''
  if (reqMethod !== 'GET' && reqMethod !== 'HEAD') {
   try {
    rawBody = await readBodyBuffer(req)
   }
   catch (err) {
    const code = err && err.status ? err.status : 400
    sendJsonResponse(res, code, { error: err && err.message ? err.message : 'Invalid request body' })
    logRequest({
     method: reqMethod,
     path: rawUrl,
     status: code,
     durationMs: Date.now() - startMs,
     ip: clientIp,
    })
    return
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
   ip: clientIp,
   remoteAddress: req.socket && req.socket.remoteAddress,
  })

  if (!hasLoadedOnce) {
   await reload()
  }

  const snap = currentSnapshot
  const executionBudget = createExecutionBudget(limits)
  let result

  if (snap.hasHandlers) {
   const methodMatchesHandler =
    snap.methods.includes(reqMethod) ||
    (reqMethod === 'HEAD' && snap.methods.includes('GET')) ||
    snap.methods.includes('ALL')

   if (!methodMatchesHandler) {
    const stubState = {}
    for (const m of snap.methods) {
     stubState[m.toLowerCase()] = () => {}
    }
    result = await executeLaneHttpRequest({
     req: reqObj,
     laneState: stubState,
     cors,
    })
   }
   else {
    result = await executeSnapshotHttpRequest(snap, reqObj, executionBudget)
   }
  }
  else if (reqMethod === 'OPTIONS' || (reqMethod !== 'GET' && reqMethod !== 'HEAD')) {
   result = await executeLaneHttpRequest({
    req: reqObj,
    laneState: {},
    cors,
   })
  }
  else {
   result = await executeSnapshotHttpRequest(snap, reqObj, executionBudget)
  }

  res.writeHead(result.status, buildResponseHeaders(result.headers, snap.revision))
  res.end(result.bodyText)

  const loggedPath = reqObj.queryString ? `${reqObj.path}?${reqObj.queryString}` : reqObj.path
  logRequest({
   method: reqMethod,
   path: loggedPath,
   status: result.status,
   durationMs: Date.now() - startMs,
   ip: clientIp,
  })
 })

 return {
  server,
  reload,
  getStatus,
  listen(port = config.port || 4100, host = config.host || '127.0.0.1') {
   closed = false
   return new Promise((resolve, reject) => {
    const onError = err => {
     server.removeListener('listening', onListening)
     reject(err)
    }
    const onListening = () => {
     server.removeListener('error', onError)
     startAutoReloadPoller()
     resolve(server.address())
    }
    server.once('error', onError)
    server.once('listening', onListening)
    server.listen(port, host)
   })
  },
  close() {
   closed = true
   stopAutoReloadPoller()
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
