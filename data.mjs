function encodeSegment(segment) {
 return encodeURIComponent(String(segment)).replace(/\./g, '%2E')
}

export const TRIGGER_INTERNAL_PREFIX = 'triggers#'
export const LANE_TRIGGER_KEY_PREFIX = 'triggers#lanes/'

export function laneTriggerKey(laneId) {
 const clean = laneId === null || laneId === undefined ? '' : String(laneId).trim()
 return `${LANE_TRIGGER_KEY_PREFIX}${encodeSegment(clean)}`
}

const TABLE_UPDATES_KEY_RE = /^lanes#[^/]+\/tables\/[^/]+\/updates(?:$|\/|\.|-)/

export function isTriggerExcludedKey(key) {
 if (typeof key !== 'string' || key.length === 0) {
  return true
 }
 if (key.startsWith(TRIGGER_INTERNAL_PREFIX) || key.startsWith('stories#')) {
  return true
 }
 return TABLE_UPDATES_KEY_RE.test(key)
}

export const DEFAULT_LANE_TRIGGER_RULES = Object.freeze([
 Object.freeze({
  id: 'lane-split-script',
  match: Object.freeze([
   'lanes#<laneId>/script',
   'lanes#<laneId>/script/**',
   'lanes#<laneId>/script-index',
   'lanes#<laneId>/script-index.chunks/**',
   'lanes#<laneId>/script-pages/**',
  ]),
  target: 'triggers#lanes/<laneId>',
  encodeTarget: false,
 }),
 Object.freeze({
  id: 'lane-split-tables',
  match: Object.freeze([
   'lanes#<laneId>/tables',
   'lanes#<laneId>/tables/**',
   'lanes#<laneId>/tables-index',
   'lanes#<laneId>/tables-index.chunks/**',
   'lanes#<laneId>/tables-pages/**',
  ]),
  exclude: Object.freeze([
   'lanes#<laneId>/tables/*/updates',
   'lanes#<laneId>/tables/*/updates/**',
   'lanes#<laneId>/tables/*/updates.chunks/**',
   'lanes#<laneId>/tables/*/updates-*',
   'lanes#<laneId>/tables/*/updates-pages/**',
  ]),
  target: 'triggers#lanes/<laneId>',
  encodeTarget: false,
 }),
 Object.freeze({
  id: 'lane-legacy-meta',
  match: Object.freeze([
   '<laneId>.title',
   '<laneId>.title.chunks/**',
   '<laneId>.inputs',
   '<laneId>.inputs.chunks/**',
   '<laneId>.script',
   '<laneId>.script.chunks/**',
   '<laneId>.tables',
   '<laneId>.tables.chunks/**',
  ]),
  target: 'triggers#lanes/<laneId>',
  encodeTarget: true,
 }),
])

function compileTriggerPattern(rawPattern) {
 const pat = String(rawPattern || '')
 let regexStr = '^'
 const captureNames = []
 for (let i = 0; i < pat.length; ) {
  if (pat[i] === '*' && pat[i + 1] === '*') {
   regexStr += '(?:.*)'
   i += 2
   continue
  }
  if (pat[i] === '*') {
   regexStr += '(?:[^#/]*)'
   i += 1
   continue
  }
  if (pat[i] === '<') {
   const endIdx = pat.indexOf('>', i + 1)
   if (endIdx !== -1) {
    const capName = pat.slice(i + 1, endIdx).trim()
    if (/^[A-Za-z_][A-Za-z0-9_-]*$/.test(capName)) {
     regexStr += '([^#/]+?)'
     captureNames.push(capName)
     i = endIdx + 1
     continue
    }
   }
  }
  regexStr += pat[i].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  i += 1
 }
 regexStr += '$'
 return {
  pattern: pat,
  regex: new RegExp(regexStr),
  captureNames,
 }
}

function compileTargetExclusionRegex(targetTemplate) {
 const wildcarded = String(targetTemplate || '').replace(/<[A-Za-z_][A-Za-z0-9_-]*>/g, '*')
 return compileTriggerPattern(wildcarded).regex
}

function compileSingleTriggerRule(rawRule, index = 0) {
 if (!rawRule || typeof rawRule !== 'object') {
  return null
 }
 const target = typeof rawRule.target === 'string' ? rawRule.target.trim() : ''
 const rawMatches = Array.isArray(rawRule.match) ? rawRule.match : (typeof rawRule.match === 'string' ? [rawRule.match] : [])
 const matchers = rawMatches
  .map(m => String(m || '').trim())
  .filter(Boolean)
  .map(compileTriggerPattern)
 if (!target || matchers.length === 0) {
  return null
 }
 const rawExcludes = Array.isArray(rawRule.exclude) ? rawRule.exclude : (typeof rawRule.exclude === 'string' ? [rawRule.exclude] : [])
 const excludes = rawExcludes
  .map(e => String(e || '').trim())
  .filter(Boolean)
  .map(compileTriggerPattern)
 return Object.freeze({
  id: typeof rawRule.id === 'string' && rawRule.id.trim() ? rawRule.id.trim() : `trigger-${index + 1}`,
  matchers: Object.freeze(matchers),
  excludes: Object.freeze(excludes),
  target,
  targetExclusionRegex: compileTargetExclusionRegex(target),
  encodeTarget: Boolean(rawRule.encodeTarget),
 })
}

export function normalizeTriggerRules(raw, options = {}) {
 const defaultEnabled = Boolean(options && options.defaultEnabled)
 const useEnv = !options || options.useEnv !== false
 let source = raw
 if (source === undefined) {
  const globalVal = typeof globalThis !== 'undefined' ? globalThis.CC_KV_TRIGGERS : undefined
  const envVal = useEnv && typeof process !== 'undefined' && process && process.env
   ? (process.env.CC_TRIGGERS_JSON || process.env.CC_KV_TRIGGERS)
   : undefined
  source = globalVal !== undefined ? globalVal : envVal
 }
 if (source === undefined || source === null || source === '') {
  source = defaultEnabled ? DEFAULT_LANE_TRIGGER_RULES : []
 }
 if (typeof source === 'string') {
  const trimmed = source.trim()
  const lower = trimmed.toLowerCase()
  if (lower === 'false' || lower === '0' || lower === 'off' || lower === 'none') {
   return Object.freeze([])
  }
  if (lower === 'true' || lower === '1' || lower === 'default') {
   source = DEFAULT_LANE_TRIGGER_RULES
  }
  else if (trimmed.startsWith('[')) {
   try {
    source = JSON.parse(trimmed)
   }
   catch {
    return Object.freeze([])
   }
  }
  else {
   return Object.freeze([])
  }
 }
 if (source === false || source === 0) {
  return Object.freeze([])
 }
 if (source === true || source === 1) {
  source = DEFAULT_LANE_TRIGGER_RULES
 }
 if (!Array.isArray(source)) {
  return Object.freeze([])
 }
 const compiled = []
 for (let i = 0; i < source.length; i++) {
  const rule = compileSingleTriggerRule(source[i], i)
  if (rule) {
   compiled.push(rule)
  }
 }
 return Object.freeze(compiled)
}

export function resolveMatchingTriggerTargets(key, rules = DEFAULT_LANE_TRIGGER_RULES) {
 if (isTriggerExcludedKey(key)) {
  return []
 }
 const compiledRules = Array.isArray(rules) && rules.length > 0 && rules[0] && rules[0].matchers
  ? rules
  : normalizeTriggerRules(rules, { defaultEnabled: true, useEnv: false })
 if (compiledRules.length === 0) {
  return []
 }
 for (let i = 0; i < compiledRules.length; i++) {
  if (compiledRules[i].targetExclusionRegex.test(key)) {
   return []
  }
 }
 const targets = []
 const seen = new Set()
 for (let i = 0; i < compiledRules.length; i++) {
  const rule = compiledRules[i]
  if (rule.excludes.some(ex => ex.regex.test(key))) {
   continue
  }
  for (let m = 0; m < rule.matchers.length; m++) {
   const matcher = rule.matchers[m]
   const matchRes = matcher.regex.exec(key)
   if (!matchRes) {
    continue
   }
   const captures = {}
   for (let c = 0; c < matcher.captureNames.length; c++) {
    captures[matcher.captureNames[c]] = matchRes[c + 1] || ''
   }
   const resolvedTarget = rule.target.replace(/<([A-Za-z_][A-Za-z0-9_-]*)>/g, (_full, capName) => {
    const val = Object.hasOwn(captures, capName) ? captures[capName] : ''
    return rule.encodeTarget ? encodeSegment(val) : val
   })
   if (resolvedTarget && !seen.has(resolvedTarget)) {
    seen.add(resolvedTarget)
    targets.push(resolvedTarget)
   }
   break
  }
 }
 return targets
}

let fallbackTriggerSeq = 0
export function createTriggerStamp({ key = '', op = 'set', nowMs = Date.now() } = {}) {
 const ms = Number.isFinite(Number(nowMs)) ? Math.trunc(Number(nowMs)) : Date.now()
 let randHex = ''
 const c = typeof globalThis !== 'undefined' ? globalThis.crypto : null
 if (c && typeof c.randomUUID === 'function') {
  randHex = c.randomUUID().replace(/-/g, '').slice(0, 8)
 }
 else {
  fallbackTriggerSeq += 1
  randHex = `${fallbackTriggerSeq.toString(36)}${Math.random().toString(16).slice(2, 6)}`
 }
 return JSON.stringify({
  rev: `${ms}-${randHex}`,
  updatedAt: new Date(ms).toISOString(),
  key: String(key || ''),
  op: String(op || 'set'),
 })
}

export function parseTriggerStamp(raw) {
 if (typeof raw !== 'string') {
  return null
 }
 const trimmed = raw.trim()
 if (!trimmed.startsWith('{')) {
  return null
 }
 try {
  const parsed = JSON.parse(trimmed)
  if (!parsed || typeof parsed !== 'object') {
   return null
  }
  const rawRev = parsed.rev
  const revStr = typeof rawRev === 'string'
   ? rawRev.trim()
   : (typeof rawRev === 'number' && Number.isFinite(rawRev) ? String(rawRev) : '')
  if (!revStr) {
   return null
  }
  return {
   rev: revStr,
   updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : '',
   key: typeof parsed.key === 'string' ? parsed.key : '',
   op: typeof parsed.op === 'string' ? parsed.op : 'set',
  }
 }
 catch {
  return null
 }
}

function enqueueTriggerWrite(queues, targetKey, fn) {
 if (!queues) {
  return fn()
 }
 const prev = queues.get(targetKey) || Promise.resolve()
 const next = prev.catch(() => {}).then(fn)
 queues.set(targetKey, next)
 const cleanup = () => {
  if (queues.get(targetKey) === next) {
   queues.delete(targetKey)
  }
 }
 next.then(cleanup, cleanup)
 return next
}

async function dispatchTriggerWrites(qualifiedKey, op, rules, writeTargetFn, triggerQueues) {
 if (!Array.isArray(rules) || rules.length === 0 || !qualifiedKey) {
  return
 }
 const targets = resolveMatchingTriggerTargets(qualifiedKey, rules)
 if (targets.length === 0) {
  return
 }
 const stamp = createTriggerStamp({ key: qualifiedKey, op })
 await Promise.all(
  targets.map(targetKey => enqueueTriggerWrite(triggerQueues, targetKey, () => writeTargetFn(targetKey, stamp)))
 )
}

export function withKvTriggers(kv, triggers = true) {
 if (!kv || typeof kv.get !== 'function' || typeof kv.set !== 'function') {
  return kv
 }
 const rules = normalizeTriggerRules(triggers, { defaultEnabled: true })
 if (rules.length === 0) {
  return kv
 }
 const triggerQueues = new Map()
 const wrapClient = (rawClient, rootWrapperRef = null, prefixOverride = null) => {
  if (!rawClient || typeof rawClient.get !== 'function') {
   return rawClient
  }
  const curPrefix = prefixOverride !== null
   ? String(prefixOverride)
   : (typeof rawClient.prefix === 'string' ? rawClient.prefix : '')
  const isHash = curPrefix.includes('#')
  const qualify = key => {
   if (isHash) {
    return curPrefix.endsWith('#') ? `${curPrefix}${key}` : `${curPrefix}/${key}`
   }
   return curPrefix ? `${curPrefix}.${key}` : String(key)
  }

  let wrapper
  const resolveRootWriter = () => {
   if (rootWrapperRef) {
    return rootWrapperRef
   }
   if (rawClient.root && rawClient.root !== rawClient) {
    return wrapClient(rawClient.root, null, '')
   }
   return wrapper
  }

  wrapper = {
   get prefix() {
    return curPrefix
   },
   get basePath() {
    return rawClient.basePath ?? null
   },
   get root() {
    return resolveRootWriter()
   },
   get defaultRoot() {
    return rawClient.defaultRoot ? wrapClient(rawClient.defaultRoot, null, '') : null
   },
   getActiveClient() {
    const active = typeof rawClient.getActiveClient === 'function' ? rawClient.getActiveClient() : rawClient
    return active === rawClient ? wrapper : wrapClient(active, null, '')
   },
   withBasePath(nextPath) {
    if (typeof rawClient.withBasePath === 'function') {
     return wrapClient(rawClient.withBasePath(nextPath), null, '')
    }
    return wrapper
   },
   setBasePath(nextPath) {
    if (typeof rawClient.setBasePath === 'function') {
     return wrapClient(rawClient.setBasePath(nextPath), null, '')
    }
    return wrapper
   },
   namespace(name) {
    const nextPrefix = isHash ? qualify(encodeSegment(name)) : qualify(name)
    return wrapClient(rawClient.namespace(name), resolveRootWriter(), nextPrefix)
   },
   hashNamespace(name) {
    const nextPrefix = `${encodeSegment(name)}#`
    const nextRaw = typeof rawClient.hashNamespace === 'function'
     ? rawClient.hashNamespace(name)
     : rawClient.namespace(`${encodeSegment(name)}#`)
    return wrapClient(nextRaw, resolveRootWriter(), nextPrefix)
   },
   get(key) {
    return rawClient.get(key)
   },
   async set(key, value, opts = null) {
    await rawClient.set(key, value, opts)
    if (opts && opts.skipTriggers) {
     return
    }
    const rootRaw = rawClient.root || rawClient
    await dispatchTriggerWrites(
     qualify(key),
     'set',
     rules,
     (targetKey, stamp) => rootRaw.set(targetKey, stamp, { skipTriggers: true }),
     triggerQueues
    )
   },
   async delete(key, opts = null) {
    if (typeof rawClient.delete === 'function') {
     await rawClient.delete(key, opts)
    }
    if (opts && opts.skipTriggers) {
     return
    }
    const rootRaw = rawClient.root || rawClient
    await dispatchTriggerWrites(
     qualify(key),
     'delete',
     rules,
     (targetKey, stamp) => rootRaw.set(targetKey, stamp, { skipTriggers: true }),
     triggerQueues
    )
   },
  }
  return wrapper
 }
 return wrapClient(kv, null, null)
}

export function normalizeDataDir(raw) {
 if (raw === null || raw === undefined) {
  return null
 }
 const trimmed = String(raw).trim()
 if (!trimmed) {
  return null
 }
 if (trimmed === '/') {
  return '/'
 }
 if (/^[A-Za-z]:[\\/]?$/.test(trimmed)) {
  return `${trimmed[0]}:\\`
 }
 const stripped = trimmed.replace(/[\\/]+$/, '')
 return stripped || '/'
}

export function formatDataDirLabel(dataDir, dataDirConfirmed = true) {
 const clean = normalizeDataDir(dataDir)
 if (clean !== null) {
  return clean
 }
 return dataDirConfirmed ? 'Default' : 'Default (unconfirmed)'
}

export function buildDataUrl(baseUrl, basePath = null) {
 const url = new URL(baseUrl)
 const clean = normalizeDataDir(basePath)
 if (clean !== null) {
  url.searchParams.set('modeOptions.disk.basePath', clean)
 }
 else {
  url.searchParams.delete('modeOptions.disk.basePath')
 }
 return url.toString()
}

export function httpKV({
 baseUrl,
 namespace = '',
 root = null,
 basePath = null,
 defaultRoot = null,
 switchable = false,
 headers = null,
 triggers = undefined,
 _compiledTriggers = null,
 _triggerQueues = null,
 _clientsByPath = null,
}) {
 const clientsByPath = _clientsByPath || new Map()
 const cleanBasePath = normalizeDataDir(basePath)
 const requestHeaders = headers && typeof headers === 'object' ? headers : null
 const compiledTriggers = _compiledTriggers || normalizeTriggerRules(triggers, { defaultEnabled: false })
 const triggerQueues = _triggerQueues || (compiledTriggers.length > 0 ? new Map() : null)
 const withHeaders = init => {
  if (!requestHeaders) {
   return init
  }
  return { ...(init || {}), headers: { ...requestHeaders, ...((init && init.headers) || {}) } }
 }

 const getOrCreateRootClient = targetPath => {
  const norm = normalizeDataDir(targetPath)
  const key = norm === null ? '__default__' : norm
  if (clientsByPath.has(key)) {
   return clientsByPath.get(key)
  }
  let def = defaultRoot || clientsByPath.get('__default__') || null
  if (!def && norm !== null) {
   def = httpKV({
    baseUrl,
    namespace: '',
    basePath: null,
    switchable: false,
    headers: requestHeaders,
    _compiledTriggers: compiledTriggers,
    _triggerQueues: triggerQueues,
    _clientsByPath: clientsByPath,
   })
  }
  const created = httpKV({
   baseUrl,
   namespace: '',
   basePath: norm,
   defaultRoot: def,
   switchable: false,
   headers: requestHeaders,
   _compiledTriggers: compiledTriggers,
   _triggerQueues: triggerQueues,
   _clientsByPath: clientsByPath,
  })
  return created
 }

 if (switchable) {
  const defaultClient = getOrCreateRootClient(null)
  let activeClient = getOrCreateRootClient(cleanBasePath)
  return {
   get prefix() {
    return activeClient.prefix
   },
   get basePath() {
    return activeClient.basePath
   },
   get root() {
    return activeClient
   },
   defaultRoot: defaultClient,
   getActiveClient() {
    return activeClient
   },
   withBasePath(nextPath) {
    return getOrCreateRootClient(nextPath)
   },
   setBasePath(nextPath) {
    activeClient = getOrCreateRootClient(nextPath)
    return activeClient
   },
   namespace(name) {
    return activeClient.namespace(name)
   },
   hashNamespace(name) {
    return activeClient.hashNamespace(name)
   },
   get(key) {
    return activeClient.get(key)
   },
   set(key, value, opts) {
    return activeClient.set(key, value, opts)
   },
   delete(key, opts) {
    return activeClient.delete(key, opts)
   },
  }
 }

 const effectiveBaseUrl = buildDataUrl(baseUrl, cleanBasePath)
 const isHash = namespace.includes('#')
 const qualify = key => {
  if (isHash) {
   return namespace.endsWith('#') ? `${namespace}${key}` : `${namespace}/${key}`
  }
  return namespace ? `${namespace}.${key}` : key
 }

 const client = {
  prefix: namespace,
  basePath: cleanBasePath,
  root: root || null,
  defaultRoot: defaultRoot || null,

  getActiveClient() {
   return client
  },

  withBasePath(nextPath) {
   return getOrCreateRootClient(nextPath)
  },

  namespace(name) {
   const nextNamespace = isHash ? qualify(encodeSegment(name)) : qualify(name)
   return httpKV({
    baseUrl,
    namespace: nextNamespace,
    root: client.root,
    basePath: cleanBasePath,
    defaultRoot: client.defaultRoot,
    headers: requestHeaders,
    _compiledTriggers: compiledTriggers,
    _triggerQueues: triggerQueues,
    _clientsByPath: clientsByPath,
   })
  },

  hashNamespace(name) {
   return httpKV({
    baseUrl,
    namespace: `${encodeSegment(name)}#`,
    root: client.root,
    basePath: cleanBasePath,
    defaultRoot: client.defaultRoot,
    headers: requestHeaders,
    _compiledTriggers: compiledTriggers,
    _triggerQueues: triggerQueues,
    _clientsByPath: clientsByPath,
   })
  },

  async get(key) {
   const url = new URL(effectiveBaseUrl)
   url.searchParams.set('key', qualify(key))
   const finalUrl = url.toString()
   const resp = await fetch(finalUrl, withHeaders())

   // treat not found as null
   if (resp.status === 404) {
    return null
   }

   if (!resp.ok) {
    const responseText = await resp.text()
    throw new Error(
     `GET ${finalUrl}: HTTP ${resp.status}: ${resp.statusText}: ${responseText}`
    )
   }

   return resp.text()
  },

  async set(key, value, opts = null) {
   const fullKey = qualify(key)
   const url = new URL(effectiveBaseUrl)
   url.searchParams.set('key', fullKey)
   const finalUrl = url.toString()
   const method = 'POST'
   const resp = await fetch(finalUrl, withHeaders({
    method,
    body: value,
   }))

   if (!resp.ok) {
    const responseText = await resp.text()
    throw new Error(
     `${method} ${finalUrl}: HTTP ${resp.status}: ${resp.statusText}: ${responseText}`
    )
   }

   if (compiledTriggers.length > 0 && !(opts && opts.skipTriggers)) {
    const rootWriter = client.root || client
    await dispatchTriggerWrites(
     fullKey,
     'set',
     compiledTriggers,
     (targetKey, stamp) => rootWriter.set(targetKey, stamp, { skipTriggers: true }),
     triggerQueues
    )
   }
  },

  async delete(key, opts = null) {
   const fullKey = qualify(key)
   const url = new URL(effectiveBaseUrl)
   url.searchParams.set('key', fullKey)
   const finalUrl = url.toString()
   const method = 'DELETE'
   const resp = await fetch(finalUrl, withHeaders({ method }))

   // treat not found as idempotent delete
   if (resp.status === 404) {
    return
   }

   if (!resp.ok) {
    const responseText = await resp.text()
    throw new Error(
     `${method} ${finalUrl}: HTTP ${resp.status}: ${resp.statusText}: ${responseText}`
    )
   }

   if (compiledTriggers.length > 0 && !(opts && opts.skipTriggers)) {
    const rootWriter = client.root || client
    await dispatchTriggerWrites(
     fullKey,
     'delete',
     compiledTriggers,
     (targetKey, stamp) => rootWriter.set(targetKey, stamp, { skipTriggers: true }),
     triggerQueues
    )
   }
  },
 }

 if (!client.root) {
  client.root = client
 }
 if (!namespace && !root) {
  const cacheKey = cleanBasePath === null ? '__default__' : cleanBasePath
  if (!clientsByPath.has(cacheKey)) {
   clientsByPath.set(cacheKey, client)
  }
  if (!client.defaultRoot) {
   client.defaultRoot = cleanBasePath === null ? client : getOrCreateRootClient(null)
  }
 }
 else if (!client.defaultRoot && client.root && client.root.defaultRoot) {
  client.defaultRoot = client.root.defaultRoot
 }
 return client
}

const origin = typeof location !== 'undefined' && location && location.origin
 ? location.origin
 : 'http://localhost:8080'
const baseUrl = `${origin}/api/data?mode=disk`

export const data = httpKV({ baseUrl, switchable: true })

export async function fetchFsRoots() {
 const resp = await fetch(`${origin}/api/fs/roots`)
 let parsed = null
 try {
  parsed = await resp.json()
 }
 catch {
  parsed = null
 }
 if (!resp.ok) {
  const msg = parsed && parsed.error ? parsed.error : `HTTP ${resp.status}: ${resp.statusText}`
  throw new Error(msg)
 }
 return parsed || { home: '', platform: '', sep: '/', roots: [] }
}

export async function fetchFsList(dirPath = '') {
 const url = new URL(`${origin}/api/fs/list`)
 if (dirPath !== null && dirPath !== undefined && String(dirPath).trim() !== '') {
  url.searchParams.set('path', String(dirPath))
 }
 const resp = await fetch(url.toString())
 let parsed = null
 try {
  parsed = await resp.json()
 }
 catch {
  parsed = null
 }
 if (!parsed || typeof parsed !== 'object') {
  return {
   ok: resp.ok,
   status: resp.status,
   error: `HTTP ${resp.status}: ${resp.statusText}`,
   path: String(dirPath || ''),
   parent: null,
   writable: false,
   breadcrumbs: [],
   directories: [],
  }
 }
 return {
  ...parsed,
  ok: parsed.ok !== undefined ? Boolean(parsed.ok) : resp.ok,
  status: parsed.status || resp.status,
 }
}

export async function createFsDir(parentDir, name) {
 const resp = await fetch(`${origin}/api/fs/mkdir`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ parent: parentDir, name }),
 })
 let parsed = null
 try {
  parsed = await resp.json()
 }
 catch {
  parsed = null
 }
 if (!parsed || typeof parsed !== 'object') {
  return {
   ok: resp.ok,
   status: resp.status,
   error: `HTTP ${resp.status}: ${resp.statusText}`,
  }
 }
 return {
  ...parsed,
  ok: parsed.ok !== undefined ? Boolean(parsed.ok) : resp.ok,
  status: parsed.status || resp.status,
 }
}

async function postDeployJson(endpointPath, payload = {}) {
 const resp = await fetch(`${origin}${endpointPath}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload),
 })
 let parsed = null
 try {
  parsed = await resp.json()
 }
 catch {
  parsed = null
 }
 if (!parsed || typeof parsed !== 'object') {
  return {
   ok: resp.ok,
   status: resp.status,
   error: `HTTP ${resp.status}: ${resp.statusText}`,
  }
 }
 return {
  ...parsed,
  ok: parsed.ok !== undefined ? Boolean(parsed.ok) : resp.ok,
  status: parsed.status || resp.status,
 }
}

export async function testRemoteCivilMemory({ url, basePath = '' } = {}) {
 return postDeployJson('/api/deploy/kv/test', { url, basePath })
}

export async function syncLaneToRemoteCivilMemory({ url, basePath = '', bundle, reloadUrl = '' } = {}) {
 return postDeployJson('/api/deploy/kv/sync', { url, basePath, bundle, reloadUrl })
}

const clientResyncQueues = new Map()

function enqueueClientResync(key, fn) {
 const cleanKey = String(key || '__default__')
 const prev = clientResyncQueues.get(cleanKey) || Promise.resolve()
 const next = prev.then(fn, fn)
 const tracked = next.finally(() => {
  if (clientResyncQueues.get(cleanKey) === tracked) {
   clientResyncQueues.delete(cleanKey)
  }
 })
 clientResyncQueues.set(cleanKey, tracked)
 return next
}

export async function resyncDeployedLane(payload = {}) {
 const dep = payload && payload.deployment && typeof payload.deployment === 'object' ? payload.deployment : null
 const queueKey = String((dep && (dep.id || dep.slug || dep.laneId)) || payload.laneId || '__default__')
 return enqueueClientResync(queueKey, async () => {
  const direct = await postDeployJson('/api/deploy/resync', payload)
  if (direct && (direct.ok || direct.status !== 404)) {
   return direct
  }
  const srv = payload && payload.server && typeof payload.server === 'object' ? payload.server : null
  const bundle = payload && payload.bundle && typeof payload.bundle === 'object' ? payload.bundle : null
  if (!srv || !srv.host || !dep || !bundle) {
   if (dep && dep.civilMemoryUrl && bundle) {
    const reloadUrl = dep.reloadUrl || (dep.publicUrl ? `${String(dep.publicUrl).replace(/\/+$/, '')}/_cc/reload` : '')
    return syncLaneToRemoteCivilMemory({
     url: dep.civilMemoryUrl,
     basePath: dep.dataBasePath || '',
     bundle,
     reloadUrl,
    })
   }
   return direct
  }
  const started = await startDeployTerminalSession({
   action: 'deploy-lane',
   server: srv,
   deployment: dep,
   syncBundle: bundle,
   subtitle: `${srv.user || 'root'}@${srv.host} · ${dep.slug || dep.laneId || ''}`,
  })
  if (!started || !started.ok || !started.wsPath) {
   return started || direct
  }
  const WsCtor = globalThis.WebSocket
  if (typeof WsCtor !== 'function') {
   return { ok: true, deployedAt: new Date().toISOString(), publicUrl: dep.publicUrl || '' }
  }
  const wsBase = origin.replace(/^http/i, 'ws')
  const wsUrl = started.wsPath.startsWith('ws://') || started.wsPath.startsWith('wss://')
   ? started.wsPath
   : `${wsBase}${started.wsPath.startsWith('/') ? '' : '/'}${started.wsPath}`
  return new Promise(resolve => {
   let outputText = ''
   let deployData = null
   let settled = false
   const ws = new WsCtor(wsUrl)
   const finish = result => {
    if (settled) {
     return
    }
    settled = true
    try { ws.close() } catch {}
    resolve(result)
   }
   const scanOutput = () => {
    const lines = outputText.split(/\r?\n/)
    for (let i = lines.length - 1; i >= 0; i--) {
     const line = lines[i]
     const idx = line.indexOf('__CC_DEPLOY_OK__')
     if (idx !== -1) {
      const rawJson = line.slice(idx + '__CC_DEPLOY_OK__'.length).trim()
      try {
       deployData = JSON.parse(rawJson)
      }
      catch {
       deployData = { ok: true }
      }
      break
     }
    }
   }
   const onMsg = ev => {
    const raw = ev && ev.data !== undefined ? ev.data : ev
    let msg
    try { msg = typeof raw === 'string' ? JSON.parse(raw) : raw } catch { return }
    if (!msg || typeof msg !== 'object') {
     return
    }
    if (msg.type === 'output' && typeof msg.data === 'string') {
     outputText += msg.data
     scanOutput()
    }
    else if (msg.type === 'status' && msg.status === 'exited') {
     scanOutput()
     const nowIso = new Date().toISOString()
     if (deployData || msg.exitCode === 0) {
      finish({
       ok: true,
       slug: (deployData && deployData.slug) || dep.slug || '',
       laneId: (deployData && deployData.laneId) || dep.laneId || payload.laneId || '',
       port: (deployData && deployData.port) || dep.port || 4100,
       publicUrl: (deployData && deployData.publicUrl) || dep.publicUrl || '',
       deployedAt: (deployData && deployData.deployedAt) || nowIso,
       syncedAt: (deployData && deployData.deployedAt) || nowIso,
      })
     }
     else {
      finish({
       ok: false,
       error: `Remote deploy exited with code ${msg.exitCode}`,
      })
     }
    }
   }
   if (typeof ws.addEventListener === 'function') {
    ws.addEventListener('message', onMsg)
    ws.addEventListener('error', () => finish({ ok: false, error: 'WebSocket deploy connection failed' }))
    ws.addEventListener('close', () => {
     scanOutput()
     const nowIso = new Date().toISOString()
     if (deployData) {
      finish({
       ok: true,
       slug: deployData.slug || dep.slug || '',
       laneId: deployData.laneId || dep.laneId || payload.laneId || '',
       port: deployData.port || dep.port || 4100,
       publicUrl: deployData.publicUrl || dep.publicUrl || '',
       deployedAt: deployData.deployedAt || nowIso,
       syncedAt: deployData.deployedAt || nowIso,
      })
     }
     else {
      finish({ ok: false, error: 'Deploy session closed before completion' })
     }
    })
   }
   else {
    ws.onmessage = onMsg
    ws.onerror = () => finish({ ok: false, error: 'WebSocket deploy connection failed' })
    ws.onclose = () => finish({ ok: Boolean(deployData), deployedAt: new Date().toISOString(), publicUrl: dep.publicUrl || '' })
   }
  })
 })
}

export async function proxyDeployRequest({ url, method = 'GET', headers = {}, body = '' } = {}) {
 return postDeployJson('/api/deploy/proxy', { url, method, headers, body })
}

export async function startDeployTerminalSession(payload = {}) {
 return postDeployJson('/api/deploy/terminal/start', payload)
}

export async function killDeployTerminalSession(sessionId) {
 return postDeployJson('/api/deploy/terminal/kill', { sessionId })
}

export function subscribeAgentEvents(onEvent, win = globalThis) {
 if (typeof onEvent !== 'function') {
  return () => {}
 }
 const EventSourceCtor = (win && win.EventSource) || globalThis.EventSource
 if (typeof EventSourceCtor !== 'function') {
  return () => {}
 }
 let es
 try {
  es = new EventSourceCtor(`${origin}/api/agent/events`)
 }
 catch {
  return () => {}
 }
 es.onmessage = ev => {
  if (!ev || !ev.data) {
   return
  }
  try {
   const parsed = JSON.parse(ev.data)
   if (parsed && typeof parsed === 'object') {
    onEvent(parsed)
   }
  }
  catch {
   // ignore malformed event
  }
 }
 return () => {
  try {
   es.close()
  }
  catch {}
 }
}

