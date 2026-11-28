function encodeSegment(segment) {
 return encodeURIComponent(String(segment)).replace(/\./g, '%2E')
}

export const TRIGGER_INTERNAL_PREFIX = 'triggers#'
export const LANE_TRIGGER_KEY_PREFIX = 'triggers#lanes/'

export function laneTriggerKey(laneId) {
 const clean = laneId === null || laneId === undefined ? '' : String(laneId).trim()
 return `${LANE_TRIGGER_KEY_PREFIX}${encodeSegment(clean)}`
}

const TABLE_UPDATES_KEY_RE = /^lanes#[^/]+\/tables\/[^/]+\/(?:updates|views)(?:$|\/|\.|-)/

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
   'lanes#<laneId>/tables/*/views',
   'lanes#<laneId>/tables/*/views/**',
   'lanes#<laneId>/tables/*/views.chunks/**',
   'lanes#<laneId>/tables/*/views-*',
   'lanes#<laneId>/tables/*/views-pages/**',
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
    return rawClient.sessionDirsDisabled ? null : (rawClient.basePath ?? null)
   },
   get sessionDirsDisabled() {
    return Boolean(rawClient.sessionDirsDisabled)
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

export const SESSION_TOKEN_HEADER = 'X-Civil-Session-Token'
export const TOKEN_BOOTSTRAP_HEADER = 'x-civil-token-bootstrap'

function assertAttenuatedSegment(raw, label) {
 const str = raw === null || raw === undefined ? '' : String(raw)
 if (!str || str.includes('#') || str.includes('\0')) {
  throw new Error(`Invalid ${label} in attenuated KV client`)
 }
 return str
}

export function attenuateKv(kv) {
 if (!kv || typeof kv !== 'object' || typeof kv.get !== 'function') {
  return null
 }
 const privateKv = kv
 const wrapper = Object.create(null)
 wrapper.get = key => {
  const cleanKey = assertAttenuatedSegment(key, 'KV key')
  return privateKv.get(cleanKey)
 }
 wrapper.set = (key, value) => {
  const cleanKey = assertAttenuatedSegment(key, 'KV key')
  if (typeof privateKv.set !== 'function') {
   throw new Error('Attenuated KV client is read-only')
  }
  return privateKv.set(cleanKey, value === null || value === undefined ? '' : String(value))
 }
 wrapper.delete = key => {
  const cleanKey = assertAttenuatedSegment(key, 'KV key')
  if (typeof privateKv.delete === 'function') {
   return privateKv.delete(cleanKey)
  }
  if (typeof privateKv.set === 'function') {
   return privateKv.set(cleanKey, '')
  }
  return Promise.resolve()
 }
 wrapper.namespace = name => {
  const cleanName = assertAttenuatedSegment(name, 'KV namespace')
  const child = typeof privateKv.namespace === 'function'
   ? privateKv.namespace(cleanName)
   : {
    get: k => privateKv.get(`${cleanName}.${assertAttenuatedSegment(k, 'KV key')}`),
    set: (k, v) => privateKv.set(`${cleanName}.${assertAttenuatedSegment(k, 'KV key')}`, v),
    delete: k => (typeof privateKv.delete === 'function'
     ? privateKv.delete(`${cleanName}.${assertAttenuatedSegment(k, 'KV key')}`)
     : privateKv.set(`${cleanName}.${assertAttenuatedSegment(k, 'KV key')}`, '')),
   }
  return attenuateKv(child)
 }
 return Object.freeze(wrapper)
}

export const SESSION_DIRS_DISABLED_ENV_VAR = 'CC_DISABLE_SESSION_DIRS'
export const SESSION_DIRS_DISABLED_GLOBAL = 'CC_DISABLE_SESSION_DIRS'

export function normalizeSessionDirsDisabled(raw) {
 if (raw === undefined || raw === null) {
  return null
 }
 if (typeof raw === 'boolean') {
  return raw
 }
 if (typeof raw === 'number') {
  return Number.isFinite(raw) ? raw !== 0 : null
 }
 if (typeof raw === 'string') {
  const lower = raw.trim().toLowerCase()
  if (!lower) {
   return null
  }
  if (lower === '1' || lower === 'true' || lower === 'yes' || lower === 'on') {
   return true
  }
  if (lower === '0' || lower === 'false' || lower === 'no' || lower === 'off') {
   return false
  }
 }
 return null
}

export function isSessionDirsDisabled(kv = null, options = {}) {
 if (options && typeof options.disableSessionDirs === 'boolean') {
  return options.disableSessionDirs
 }
 if (kv && typeof kv === 'object') {
  if (typeof kv.sessionDirsDisabled === 'boolean') {
   return kv.sessionDirsDisabled
  }
  if (kv.root && typeof kv.root.sessionDirsDisabled === 'boolean') {
   return kv.root.sessionDirsDisabled
  }
 }
 const globalVal = typeof globalThis !== 'undefined' ? globalThis[SESSION_DIRS_DISABLED_GLOBAL] : undefined
 const normGlobal = normalizeSessionDirsDisabled(globalVal)
 if (normGlobal !== null) {
  return normGlobal
 }
 if (!options || options.useEnv !== false) {
  const envVal = typeof process !== 'undefined' && process && process.env
   ? process.env[SESSION_DIRS_DISABLED_ENV_VAR]
   : undefined
  const normEnv = normalizeSessionDirsDisabled(envVal)
  if (normEnv !== null) {
   return normEnv
  }
 }
 return false
}

export function stripDiskModeQueryParams(rawUrl) {
 const url = new URL(rawUrl)
 for (const key of Array.from(url.searchParams.keys())) {
  if (key === 'mode' || key === 'modeOptions' || key.startsWith('modeOptions.')) {
   url.searchParams.delete(key)
  }
 }
 return url.toString()
}

export function buildDataUrl(baseUrl, basePath = null, options = {}) {
 if (options && options.disableSessionDirs) {
  return stripDiskModeQueryParams(baseUrl)
 }
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

function resolveApiOrigin(baseUrl) {
 try {
  const parsed = new URL(baseUrl)
  if (parsed.pathname === '/api/data' || parsed.pathname.startsWith('/api/data/')) {
   return parsed.origin
  }
 }
 catch {
  // Ignore invalid URL
 }
 return null
}

function tokenSlotForPath(dir) {
 const norm = normalizeDataDir(dir)
 return norm === null ? '__default__' : norm
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
 sessionToken = '',
 proxyCapabilities = false,
 proactiveToken = false,
 disableSessionDirs = undefined,
 _compiledTriggers = null,
 _triggerQueues = null,
 _clientsByPath = null,
 _tokenStore = null,
}) {
 const clientsByPath = _clientsByPath || new Map()
 const requestHeaders = headers && typeof headers === 'object' ? headers : null
 const compiledTriggers = _compiledTriggers || normalizeTriggerRules(triggers, { defaultEnabled: false })
 const triggerQueues = _triggerQueues || (compiledTriggers.length > 0 ? new Map() : null)
 const apiOrigin = resolveApiOrigin(baseUrl)
 const isProxyBacked = Boolean(proxyCapabilities && apiOrigin)
 const explicitDisableDirs = normalizeSessionDirsDisabled(disableSessionDirs)
 const tokenStore = _tokenStore || {
  bySessionAndPath: new Map(),
  byPath: new Map(),
  inFlightBootstrap: new Map(),
  activeSessionId: '',
  fallbackToken: typeof sessionToken === 'string' ? sessionToken.trim() : '',
  vaultUnavailable: false,
  sessionDirsDisabled: explicitDisableDirs !== null
   ? explicitDisableDirs
   : (normalizeSessionDirsDisabled(typeof globalThis !== 'undefined' ? globalThis[SESSION_DIRS_DISABLED_GLOBAL] : undefined) ??
    normalizeSessionDirsDisabled(typeof process !== 'undefined' && process && process.env ? process.env[SESSION_DIRS_DISABLED_ENV_VAR] : undefined)),
  sessionDirsDisabledPinned: explicitDisableDirs !== null,
 }
 if (explicitDisableDirs !== null) {
  tokenStore.sessionDirsDisabled = explicitDisableDirs
  tokenStore.sessionDirsDisabledPinned = true
 }
 const getSessionDirsDisabled = () => Boolean(tokenStore.sessionDirsDisabled)
 const cleanBasePath = getSessionDirsDisabled() ? null : normalizeDataDir(basePath)
 const effectiveDir = () => (getSessionDirsDisabled() ? null : cleanBasePath)

 const setSessionToken = (token, opts = null) => {
  const cleanTok = token === null || token === undefined ? '' : String(token).trim()
  const hasOpts = opts && typeof opts === 'object'
  const sid = hasOpts && opts.sessionId !== undefined && opts.sessionId !== null
   ? String(opts.sessionId).trim()
   : ''
  const hasDir = hasOpts && opts.basePath !== undefined
  const slot = hasDir ? tokenSlotForPath(getSessionDirsDisabled() ? null : opts.basePath) : null
  if (sid) {
   tokenStore.activeSessionId = sid
   const targetSlot = slot || tokenSlotForPath(effectiveDir())
   if (cleanTok) {
    tokenStore.bySessionAndPath.set(`${sid}::${targetSlot}`, cleanTok)
   }
   else {
    tokenStore.bySessionAndPath.delete(`${sid}::${targetSlot}`)
   }
  }
  if (slot !== null) {
   if (cleanTok) {
    tokenStore.byPath.set(slot, cleanTok)
   }
   else {
    tokenStore.byPath.delete(slot)
   }
  }
  else {
   tokenStore.fallbackToken = cleanTok
  }
  return cleanTok
 }

 const setActiveSession = (sessionId, dir = undefined) => {
  const sid = sessionId === null || sessionId === undefined ? '' : String(sessionId).trim()
  tokenStore.activeSessionId = sid
  if (sid && dir !== undefined) {
   const slot = tokenSlotForPath(getSessionDirsDisabled() ? null : dir)
   const cached = tokenStore.bySessionAndPath.get(`${sid}::${slot}`)
   if (cached) {
    tokenStore.byPath.set(slot, cached)
   }
  }
 }

 const getSessionToken = (dir = undefined) => {
  const resolvedDir = getSessionDirsDisabled() ? null : (dir === undefined ? cleanBasePath : dir)
  const slot = tokenSlotForPath(resolvedDir)
  if (tokenStore.activeSessionId) {
   const bySess = tokenStore.bySessionAndPath.get(`${tokenStore.activeSessionId}::${slot}`)
   if (bySess) {
    return bySess
   }
   if (slot === '__default__') {
    for (const [k, tok] of tokenStore.bySessionAndPath.entries()) {
     if (k.startsWith(`${tokenStore.activeSessionId}::`) && tok) {
      return tok
     }
    }
   }
  }
  const byDir = tokenStore.byPath.get(slot)
  if (byDir) {
   return byDir
  }
  if (slot === '__default__') {
   for (const tok of tokenStore.byPath.values()) {
    if (tok) {
     return tok
    }
   }
  }
  return tokenStore.fallbackToken || ''
 }

 const withHeaders = (init, dir = undefined) => {
  const tok = getSessionToken(dir)
  if (!requestHeaders && !tok) {
   return init
  }
  const merged = {
   ...(requestHeaders || {}),
   ...((init && init.headers) || {}),
  }
  if (tok && !Object.hasOwn(merged, SESSION_TOKEN_HEADER) && !Object.hasOwn(merged, SESSION_TOKEN_HEADER.toLowerCase())) {
   merged[SESSION_TOKEN_HEADER] = tok
  }
  return { ...(init || {}), headers: merged }
 }

 const fetchVaultApi = async (subpath, opts = {}) => {
  if (!apiOrigin) {
   throw new Error('Vault API requires an /api/data HTTP origin')
  }
  const method = opts && opts.method ? String(opts.method).toUpperCase() : 'POST'
  const targetDir = getSessionDirsDisabled()
   ? null
   : (opts && opts.basePath !== undefined ? normalizeDataDir(opts.basePath) : cleanBasePath)
  const sid = opts && opts.sessionId ? String(opts.sessionId).trim() : tokenStore.activeSessionId
  const cleanSub = String(subpath || '').replace(/^\/+/, '')
  const url = new URL(`${apiOrigin}/api/vault/${cleanSub}`)
  if (opts && opts.query && typeof opts.query === 'object') {
   for (const [k, v] of Object.entries(opts.query)) {
    if (v !== undefined && v !== null && v !== '') {
     url.searchParams.set(k, String(v))
    }
   }
  }
  const reqInit = { method }
  if (method !== 'GET' && method !== 'HEAD') {
   reqInit.headers = { 'Content-Type': 'application/json' }
   const rawBody = opts && opts.body !== undefined ? opts.body : {}
   const finalBody = getSessionDirsDisabled() && rawBody && typeof rawBody === 'object' && !Array.isArray(rawBody) && Object.hasOwn(rawBody, 'basePath')
    ? { ...rawBody, basePath: null }
    : rawBody
   reqInit.body = JSON.stringify(finalBody)
  }
  const resp = await fetch(url.toString(), withHeaders(reqInit, targetDir))
  let parsed = null
  try {
   parsed = await resp.json()
  }
  catch {
   parsed = null
  }
  if (parsed && typeof parsed === 'object' && typeof parsed.sessionDirsDisabled === 'boolean' && !tokenStore.sessionDirsDisabledPinned) {
   tokenStore.sessionDirsDisabled = parsed.sessionDirsDisabled
  }
  if (parsed && typeof parsed === 'object' && typeof parsed.token === 'string' && parsed.token.trim()) {
   setSessionToken(parsed.token, {
    sessionId: parsed.sessionId || sid || undefined,
    basePath: getSessionDirsDisabled() ? null : (parsed.basePath !== undefined ? parsed.basePath : targetDir),
   })
  }
  return {
   ok: Boolean(resp.ok && (!parsed || parsed.ok !== false)),
   status: resp.status,
   data: parsed,
  }
 }

 const bootstrapPathToken = dir => {
  const effectiveTarget = getSessionDirsDisabled() ? null : dir
  const slot = tokenSlotForPath(effectiveTarget)
  if (tokenStore.inFlightBootstrap.has(slot)) {
   return tokenStore.inFlightBootstrap.get(slot)
  }
  const p = fetchVaultApi('session', {
   method: 'POST',
   basePath: effectiveTarget,
   body: {
    sessionId: tokenStore.activeSessionId || undefined,
    basePath: effectiveTarget,
   },
  })
   .then(res => {
    if (res && res.status === 404) {
     tokenStore.vaultUnavailable = true
    }
    return res && res.data && typeof res.data.token === 'string' ? res.data.token : ''
   })
   .catch(() => '')
   .finally(() => {
    tokenStore.inFlightBootstrap.delete(slot)
   })
  tokenStore.inFlightBootstrap.set(slot, p)
  return p
 }

 const performKvFetch = async (finalUrl, init) => {
  const curDir = effectiveDir()
  if (isProxyBacked && proactiveToken && !tokenStore.vaultUnavailable && !getSessionToken(curDir)) {
   await bootstrapPathToken(curDir)
  }
  const reqDir = effectiveDir()
  const reqUrl = getSessionDirsDisabled() ? stripDiskModeQueryParams(finalUrl) : finalUrl
  const resp = await fetch(reqUrl, withHeaders(init, reqDir))
  if (
   resp &&
   resp.status === 401 &&
   apiOrigin &&
   resp.headers &&
   typeof resp.headers.get === 'function' &&
   resp.headers.get(TOKEN_BOOTSTRAP_HEADER)
  ) {
   setSessionToken('', {
    sessionId: tokenStore.activeSessionId || undefined,
    basePath: effectiveDir(),
   })
   const minted = await bootstrapPathToken(effectiveDir())
   if (minted) {
    const retryDir = effectiveDir()
    const retryUrl = getSessionDirsDisabled() ? stripDiskModeQueryParams(finalUrl) : finalUrl
    return fetch(retryUrl, withHeaders(init, retryDir))
   }
  }
  return resp
 }

 const normalizeExternalFetchHeaders = rawHeaders => {
  if (!rawHeaders || typeof rawHeaders !== 'object') {
   return undefined
  }
  const out = {}
  if (typeof rawHeaders.forEach === 'function') {
   rawHeaders.forEach((v, k) => {
    if (k && v !== undefined && v !== null) {
     out[String(k)] = String(v)
    }
   })
  }
  else {
   for (const [k, v] of Object.entries(rawHeaders)) {
    if (k && v !== undefined && v !== null) {
     out[String(k)] = String(v)
    }
   }
  }
  return Object.keys(out).length > 0 ? out : undefined
 }

 const externalFetch = async (rawUrl, init = {}) => {
  if (!isProxyBacked) {
   return fetch(rawUrl, init)
  }
  if (!tokenStore.vaultUnavailable && !getSessionToken(effectiveDir())) {
   await bootstrapPathToken(effectiveDir())
  }
  const activeDir = effectiveDir()
  const opts = init && typeof init === 'object' ? init : {}
  const method = opts.method !== undefined && opts.method !== null
   ? String(opts.method).trim().toUpperCase() || 'GET'
   : 'GET'
  const headers = normalizeExternalFetchHeaders(opts.headers)
  const payload = {
   url: String(rawUrl ?? ''),
   method,
   basePath: activeDir,
  }
  if (headers) {
   payload.headers = headers
  }
  if (method !== 'GET' && method !== 'HEAD' && opts.body !== undefined && opts.body !== null) {
   payload.body = typeof opts.body === 'string' ? opts.body : String(opts.body)
  }
  let res = await fetchVaultApi('fetch', {
   method: 'POST',
   basePath: activeDir,
   body: payload,
  })
  if (res && res.status === 401 && !tokenStore.vaultUnavailable) {
   setSessionToken('', {
    sessionId: tokenStore.activeSessionId || undefined,
    basePath: effectiveDir(),
   })
   const minted = await bootstrapPathToken(effectiveDir())
   if (minted) {
    res = await fetchVaultApi('fetch', {
     method: 'POST',
     basePath: effectiveDir(),
     body: { ...payload, basePath: effectiveDir() },
    })
   }
  }
  if (!res || !res.ok || !res.data || !res.data.response) {
   const errMsg = res && res.data && res.data.error ? res.data.error : `HTTP ${(res && res.status) || 502}: External fetch failed`
   throw new Error(errMsg)
  }
  const r = res.data.response
  const respHeaders = typeof Headers === 'function' ? new Headers(r.headers || {}) : (r.headers || {})
  return {
   ok: Boolean(r.ok),
   status: Number.isInteger(r.status) ? r.status : (r.ok ? 200 : 502),
   statusText: typeof r.statusText === 'string' ? r.statusText : '',
   url: typeof r.url === 'string' ? r.url : payload.url,
   headers: respHeaders,
   async text() {
    return String(r.bodyText ?? '')
   },
   async json() {
    return JSON.parse(String(r.bodyText ?? ''))
   },
  }
 }

 const getOrCreateRootClient = targetPath => {
  const norm = getSessionDirsDisabled() ? null : normalizeDataDir(targetPath)
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
    proxyCapabilities,
    proactiveToken,
    disableSessionDirs: explicitDisableDirs !== null ? explicitDisableDirs : undefined,
    _compiledTriggers: compiledTriggers,
    _triggerQueues: triggerQueues,
    _clientsByPath: clientsByPath,
    _tokenStore: tokenStore,
   })
  }
  const created = httpKV({
   baseUrl,
   namespace: '',
   basePath: norm,
   defaultRoot: def,
   switchable: false,
   headers: requestHeaders,
   proxyCapabilities,
   proactiveToken,
   disableSessionDirs: explicitDisableDirs !== null ? explicitDisableDirs : undefined,
   _compiledTriggers: compiledTriggers,
   _triggerQueues: triggerQueues,
   _clientsByPath: clientsByPath,
   _tokenStore: tokenStore,
  })
  return created
 }

 if (switchable) {
  const defaultClient = getOrCreateRootClient(null)
  let activeClient = getOrCreateRootClient(cleanBasePath)
  return {
   apiOrigin,
   isProxyBacked,
   get sessionDirsDisabled() {
    return getSessionDirsDisabled()
   },
   get prefix() {
    return activeClient.prefix
   },
   get basePath() {
    return getSessionDirsDisabled() ? null : activeClient.basePath
   },
   get root() {
    return activeClient
   },
   defaultRoot: defaultClient,
   getActiveClient() {
    return getSessionDirsDisabled() ? defaultClient : activeClient
   },
   setSessionToken,
   getSessionToken: dir => getSessionToken(dir === undefined ? activeClient.basePath : dir),
   setActiveSession,
   fetchVaultApi: (subpath, opts = {}) => fetchVaultApi(subpath, {
    basePath: effectiveDir(),
    ...(opts || {}),
   }),
   externalFetch: (rawUrl, init) => activeClient.externalFetch(rawUrl, init),
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

 const effectiveBaseUrl = buildDataUrl(baseUrl, cleanBasePath, {
  disableSessionDirs: getSessionDirsDisabled(),
 })
 const isHash = namespace.includes('#')
 const qualify = key => {
  if (isHash) {
   return namespace.endsWith('#') ? `${namespace}${key}` : `${namespace}/${key}`
  }
  return namespace ? `${namespace}.${key}` : key
 }

 const client = {
  apiOrigin,
  isProxyBacked,
  get sessionDirsDisabled() {
   return getSessionDirsDisabled()
  },
  prefix: namespace,
  get basePath() {
   return getSessionDirsDisabled() ? null : cleanBasePath
  },
  root: root || null,
  defaultRoot: defaultRoot || null,

  getActiveClient() {
   return client
  },

  setSessionToken,
  getSessionToken,
  setActiveSession,
  fetchVaultApi,
  externalFetch,

  withBasePath(nextPath) {
   return getOrCreateRootClient(nextPath)
  },

  namespace(name) {
   const nextNamespace = isHash ? qualify(encodeSegment(name)) : qualify(name)
   return httpKV({
    baseUrl,
    namespace: nextNamespace,
    root: client.root,
    basePath: effectiveDir(),
    defaultRoot: client.defaultRoot,
    headers: requestHeaders,
    proxyCapabilities,
    proactiveToken,
    disableSessionDirs: explicitDisableDirs !== null ? explicitDisableDirs : undefined,
    _compiledTriggers: compiledTriggers,
    _triggerQueues: triggerQueues,
    _clientsByPath: clientsByPath,
    _tokenStore: tokenStore,
   })
  },

  hashNamespace(name) {
   return httpKV({
    baseUrl,
    namespace: `${encodeSegment(name)}#`,
    root: client.root,
    basePath: effectiveDir(),
    defaultRoot: client.defaultRoot,
    headers: requestHeaders,
    proxyCapabilities,
    proactiveToken,
    disableSessionDirs: explicitDisableDirs !== null ? explicitDisableDirs : undefined,
    _compiledTriggers: compiledTriggers,
    _triggerQueues: triggerQueues,
    _clientsByPath: clientsByPath,
    _tokenStore: tokenStore,
   })
  },

  async get(key) {
   const url = new URL(
    getSessionDirsDisabled()
     ? stripDiskModeQueryParams(effectiveBaseUrl)
     : effectiveBaseUrl
   )
   url.searchParams.set('key', qualify(key))
   const finalUrl = url.toString()
   const resp = await performKvFetch(finalUrl)

   // treat not found as null
   if (resp.status === 404) {
    return null
   }

   if (!resp.ok) {
    const responseText = await resp.text()
    const errUrl = getSessionDirsDisabled() ? stripDiskModeQueryParams(finalUrl) : finalUrl
    throw new Error(
     `GET ${errUrl}: HTTP ${resp.status}: ${resp.statusText}: ${responseText}`
    )
   }

   return resp.text()
  },

  async set(key, value, opts = null) {
   const fullKey = qualify(key)
   const url = new URL(
    getSessionDirsDisabled()
     ? stripDiskModeQueryParams(effectiveBaseUrl)
     : effectiveBaseUrl
   )
   url.searchParams.set('key', fullKey)
   const finalUrl = url.toString()
   const method = 'POST'
   const resp = await performKvFetch(finalUrl, {
    method,
    headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
    body: value === null || value === undefined ? '' : String(value),
   })

   if (!resp.ok) {
    const responseText = await resp.text()
    const errUrl = getSessionDirsDisabled() ? stripDiskModeQueryParams(finalUrl) : finalUrl
    throw new Error(
     `${method} ${errUrl}: HTTP ${resp.status}: ${resp.statusText}: ${responseText}`
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
   const url = new URL(
    getSessionDirsDisabled()
     ? stripDiskModeQueryParams(effectiveBaseUrl)
     : effectiveBaseUrl
   )
   url.searchParams.set('key', fullKey)
   const finalUrl = url.toString()
   const method = 'DELETE'
   const resp = await performKvFetch(finalUrl, { method })

   // treat not found as idempotent delete
   if (resp.status === 404) {
    return
   }

   if (!resp.ok) {
    const responseText = await resp.text()
    const errUrl = getSessionDirsDisabled() ? stripDiskModeQueryParams(finalUrl) : finalUrl
    throw new Error(
     `${method} ${errUrl}: HTTP ${resp.status}: ${resp.statusText}: ${responseText}`
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

export const data = httpKV({ baseUrl, switchable: true, proxyCapabilities: true, proactiveToken: true })

async function fetchWithSessionToken(targetUrl, init = {}) {
 const withTok = tok => {
  const mergedHeaders = { ...((init && init.headers) || {}) }
  if (tok && !Object.hasOwn(mergedHeaders, SESSION_TOKEN_HEADER) && !Object.hasOwn(mergedHeaders, SESSION_TOKEN_HEADER.toLowerCase())) {
   mergedHeaders[SESSION_TOKEN_HEADER] = tok
  }
  return { ...(init || {}), headers: mergedHeaders }
 }
 let curTok = typeof data.getSessionToken === 'function' ? data.getSessionToken() : ''
 if (!curTok && data.isProxyBacked && typeof data.fetchVaultApi === 'function') {
  const boot = await data.fetchVaultApi('session', { method: 'POST', body: {} }).catch(() => null)
  curTok = boot && boot.data && typeof boot.data.token === 'string' ? boot.data.token.trim() : ''
 }
 let resp = await fetch(targetUrl, withTok(curTok))
 if (
  resp &&
  resp.status === 401 &&
  resp.headers &&
  typeof resp.headers.get === 'function' &&
  resp.headers.get(TOKEN_BOOTSTRAP_HEADER) &&
  typeof data.fetchVaultApi === 'function'
 ) {
  const boot = await data.fetchVaultApi('session', { method: 'POST', body: {} }).catch(() => null)
  const minted = boot && boot.data && typeof boot.data.token === 'string' ? boot.data.token.trim() : ''
  if (minted) {
   resp = await fetch(targetUrl, withTok(minted))
  }
 }
 return resp
}

export async function fetchFsRoots() {
 const resp = await fetchWithSessionToken(`${origin}/api/fs/roots`)
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
 const resp = await fetchWithSessionToken(url.toString())
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
 const resp = await fetchWithSessionToken(`${origin}/api/fs/mkdir`, {
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
 const resp = await fetchWithSessionToken(`${origin}${endpointPath}`, {
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
 let es = null
 let closed = false
 const openStream = tok => {
  if (closed) {
   return
  }
  const url = new URL(`${origin}/api/agent/events`)
  if (tok) {
   url.searchParams.set('token', tok)
  }
  try {
   es = new EventSourceCtor(url.toString())
  }
  catch {
   return
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
 }

 const curTok = typeof data.getSessionToken === 'function' ? data.getSessionToken() : ''
 if (curTok) {
  openStream(curTok)
 }
 else if (typeof data.fetchVaultApi === 'function') {
  data.fetchVaultApi('session', { method: 'POST', body: {} })
   .then(res => {
    const minted = res && res.data && typeof res.data.token === 'string' ? res.data.token.trim() : ''
    if (minted && !closed) {
     openStream(minted)
    }
   })
   .catch(() => {})
 }

 return () => {
  closed = true
  if (es) {
   try {
    es.close()
   }
   catch {}
  }
 }
}

