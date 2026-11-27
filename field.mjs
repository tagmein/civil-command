const RUN_IN_SCOPE = Symbol('runInScope')
const LEXICAL_SCOPE = Symbol('lexicalScope')
const FIELD_ERROR_TAGGED = Symbol('fieldErrorTagged')
const FIELD_LIMIT_EXCEEDED = Symbol('fieldLimitExceeded')
const AST_LOC = new WeakMap()
const utf8Encoder = new TextEncoder()

const SHA256_K = new Uint32Array([
 0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
 0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
])

export function sha256Bytes(input) {
 const bytes = input instanceof Uint8Array ? input : utf8Encoder.encode(String(input ?? ''))
 const rotr = (x, n) => (x >>> n) | (x << (32 - n))
 const len = bytes.length
 const bitLen = len * 8
 const padLen = ((len + 9 + 63) & ~63)
 const buf = new Uint8Array(padLen)
 buf.set(bytes)
 buf[len] = 0x80
 const dv = new DataView(buf.buffer)
 dv.setUint32(padLen - 8, Math.floor(bitLen / 0x100000000), false)
 dv.setUint32(padLen - 4, bitLen >>> 0, false)

 const h = new Uint32Array([
  0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
  0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
 ])
 const w = new Uint32Array(64)

 for (let offset = 0; offset < padLen; offset += 64) {
  for (let i = 0; i < 16; i++) {
   w[i] = dv.getUint32(offset + i * 4, false)
  }
  for (let i = 16; i < 64; i++) {
   const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3)
   const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10)
   w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0
  }
  let [a, b, c, d, e, f, g, hh] = h
  for (let i = 0; i < 64; i++) {
   const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)
   const ch = (e & f) ^ (~e & g)
   const temp1 = (hh + S1 + ch + SHA256_K[i] + w[i]) >>> 0
   const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)
   const maj = (a & b) ^ (a & c) ^ (b & c)
   const temp2 = (S0 + maj) >>> 0
   hh = g
   g = f
   f = e
   e = (d + temp1) >>> 0
   d = c
   c = b
   b = a
   a = (temp1 + temp2) >>> 0
  }
  h[0] = (h[0] + a) >>> 0
  h[1] = (h[1] + b) >>> 0
  h[2] = (h[2] + c) >>> 0
  h[3] = (h[3] + d) >>> 0
  h[4] = (h[4] + e) >>> 0
  h[5] = (h[5] + f) >>> 0
  h[6] = (h[6] + g) >>> 0
  h[7] = (h[7] + hh) >>> 0
 }
 const out = new Uint8Array(32)
 const outDv = new DataView(out.buffer)
 for (let i = 0; i < 8; i++) {
  outDv.setUint32(i * 4, h[i], false)
 }
 return out
}

export function sha256Hex(input) {
 const digest = sha256Bytes(input)
 let out = ''
 for (let i = 0; i < digest.length; i++) {
  out += digest[i].toString(16).padStart(2, '0')
 }
 return out
}

export const DEFAULT_FIELD_LIMITS = Object.freeze({
 maxScriptBytes: 16 * 1024 * 1024,
 maxLineBytes: 1 * 1024 * 1024,
 maxScriptLines: 100000,
 maxAstDepth: 256,
 maxAstNodes: 1000000,
 maxLoopIterations: 1000000,
 maxCallDepth: 512,
 maxSteps: 10000000,
 maxExecutionMs: 0,
 maxLoadDepth: 64,
 maxTotalLoads: 512,
})

export const FIELD_LIMIT_ENV_VARS = Object.freeze({
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
})

function hasPositiveLimit(val) {
 return typeof val === 'number' && Number.isFinite(val) && val > 0
}

function parseFieldLimitCandidate(raw) {
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

export function normalizeFieldLimits(raw = {}, options = {}) {
 const src = raw && typeof raw === 'object' ? raw : {}
 const useEnv = !options || options.useEnv !== false
 const globalLimits = typeof globalThis !== 'undefined' && globalThis.CC_FIELD_LIMITS && typeof globalThis.CC_FIELD_LIMITS === 'object'
  ? globalThis.CC_FIELD_LIMITS
  : null
 const envObj = useEnv && typeof process !== 'undefined' && process && process.env ? process.env : null
 const out = {}
 for (const key of Object.keys(DEFAULT_FIELD_LIMITS)) {
  const envName = FIELD_LIMIT_ENV_VARS[key]
  const parsedExplicit = parseFieldLimitCandidate(src[key])
  const parsedGlobal = globalLimits ? parseFieldLimitCandidate(globalLimits[key]) : undefined
  const parsedEnv = envObj && envName ? parseFieldLimitCandidate(envObj[envName]) : undefined
  if (parsedExplicit !== undefined) {
   out[key] = parsedExplicit
  }
  else if (parsedGlobal !== undefined) {
   out[key] = parsedGlobal
  }
  else if (parsedEnv !== undefined) {
   out[key] = parsedEnv
  }
  else {
   out[key] = DEFAULT_FIELD_LIMITS[key]
  }
 }
 return Object.freeze(out)
}

export function createExecutionBudget(limits = DEFAULT_FIELD_LIMITS, nowMs = Date.now()) {
 const norm = limits && typeof limits === 'object' ? normalizeFieldLimits(limits) : DEFAULT_FIELD_LIMITS
 const maxSteps = hasPositiveLimit(norm.maxSteps) ? norm.maxSteps : 0
 const maxExecutionMs = hasPositiveLimit(norm.maxExecutionMs) ? norm.maxExecutionMs : 0
 return {
  steps: 0,
  maxSteps,
  maxExecutionMs,
  deadlineMs: maxExecutionMs > 0 ? nowMs + maxExecutionMs : 0,
  exhausted: false,
  exhaustedKind: null,
  exhaustedError: null,
 }
}

function makeLimitExceededError(message, kind = 'limit', loc = null) {
 const suffix = formatLoc(loc)
 const err = new RangeError(`${message}${suffix}`)
 err[FIELD_LIMIT_EXCEEDED] = kind
 if (loc) {
  err.fieldLocation = loc
  err[FIELD_ERROR_TAGGED] = true
 }
 return err
}

function tickExecutionBudget(budget, forceClock = false) {
 if (!budget) {
  return
 }
 if (budget.exhausted && budget.exhaustedError) {
  throw budget.exhaustedError
 }
 budget.steps += 1
 if (budget.maxSteps > 0 && budget.steps > budget.maxSteps) {
  const err = makeLimitExceededError(`Maximum FieldScript execution steps (${budget.maxSteps}) exceeded`, 'maxSteps')
  budget.exhausted = true
  budget.exhaustedKind = 'maxSteps'
  budget.exhaustedError = err
  throw err
 }
 if (budget.deadlineMs > 0 && (forceClock || (budget.steps & 1023) === 0)) {
  if (Date.now() > budget.deadlineMs) {
   const err = makeLimitExceededError(`FieldScript execution timed out after ${budget.maxExecutionMs}ms`, 'maxExecutionMs')
   budget.exhausted = true
   budget.exhaustedKind = 'maxExecutionMs'
   budget.exhaustedError = err
   throw err
  }
 }
}

function utf8ByteLengthField(text) {
 return utf8Encoder.encode(String(text)).length
}

function exceedsUtf8Limit(text, limitBytes) {
 if (!hasPositiveLimit(limitBytes)) {
  return false
 }
 const len = text.length
 if (len > limitBytes) {
  return true
 }
 if (len * 3 <= limitBytes) {
  return false
 }
 return utf8ByteLengthField(text) > limitBytes
}

function deepFreezeAst(node, seen = new WeakSet()) {
 if (!node || typeof node !== 'object' || seen.has(node)) {
  return node
 }
 seen.add(node)
 if (Array.isArray(node)) {
  for (let i = 0; i < node.length; i++) {
   deepFreezeAst(node[i], seen)
  }
  return Object.freeze(node)
 }
 if (isPlainObject(node)) {
  for (const key of Object.keys(node)) {
   deepFreezeAst(node[key], seen)
  }
  return Object.freeze(node)
 }
 return node
}

export function deepFreezeScopeData(value, seen = new WeakSet()) {
 if (value === null || value === undefined || typeof value !== 'object') {
  return value
 }
 if (seen.has(value) || isMaskedSecretValue(value) || isDomElement(value)) {
  return value
 }
 seen.add(value)
 if (Array.isArray(value)) {
  for (let i = 0; i < value.length; i++) {
   deepFreezeScopeData(value[i], seen)
  }
  return Object.freeze(value)
 }
 if (isPlainObject(value)) {
  for (const key of Object.keys(value)) {
   deepFreezeScopeData(value[key], seen)
  }
  return Object.freeze(value)
 }
 return value
}

export function cloneScopeData(value, seen = new WeakMap()) {
 if (value === null || value === undefined || typeof value !== 'object') {
  return value
 }
 if (isMaskedSecretValue(value) || isDomElement(value)) {
  return value
 }
 if (seen.has(value)) {
  return seen.get(value)
 }
 if (value instanceof Date) {
  return new Date(value.getTime())
 }
 if (Array.isArray(value)) {
  const copy = new Array(value.length)
  seen.set(value, copy)
  for (let i = 0; i < value.length; i++) {
   copy[i] = cloneScopeData(value[i], seen)
  }
  return copy
 }
 if (value instanceof Map) {
  const copy = new Map()
  seen.set(value, copy)
  for (const [k, v] of value.entries()) {
   copy.set(cloneScopeData(k, seen), cloneScopeData(v, seen))
  }
  return copy
 }
 if (value instanceof Set) {
  const copy = new Set()
  seen.set(value, copy)
  for (const v of value.values()) {
   copy.add(cloneScopeData(v, seen))
  }
  return copy
 }
 if (ArrayBuffer.isView(value)) {
  if (value instanceof DataView) {
   return new DataView(value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength))
  }
  return typeof value.slice === 'function' ? value.slice() : value
 }
 if (isPlainObject(value)) {
  const copy = {}
  seen.set(value, copy)
  for (const key of Object.keys(value)) {
   copy[key] = cloneScopeData(value[key], seen)
  }
  return copy
 }
 return value
}

function splitRootPath(a, rest) {
 if (typeof a === 'string' && a.includes('.')) {
  const parts = a.split('.')
  return [parts[0], ...parts.slice(1), ...rest]
 }
 return [a, ...rest]
}

function isCommentNode(node) {
 return Array.isArray(node) && node[0] === '@' && node[1] === 'comment'
}

export const FORBIDDEN_PROPERTY_KEYS = Object.freeze([
 '__proto__',
 'constructor',
 'prototype',
 '__defineGetter__',
 '__defineSetter__',
 '__lookupGetter__',
 '__lookupSetter__',
])

const FORBIDDEN_PROPERTY_KEY_SET = new Set(FORBIDDEN_PROPERTY_KEYS)
const FORBIDDEN_FUNCTION_KEY_SET = new Set(['arguments', 'caller', 'callee'])
const SCOPE_FRAMES = new WeakSet()

const SAFE_ARRAY_METHODS = new Set([
 'at',
 'concat',
 'entries',
 'every',
 'fill',
 'filter',
 'find',
 'findIndex',
 'findLast',
 'findLastIndex',
 'flat',
 'flatMap',
 'forEach',
 'includes',
 'indexOf',
 'join',
 'keys',
 'lastIndexOf',
 'map',
 'pop',
 'push',
 'reduce',
 'reduceRight',
 'reverse',
 'shift',
 'slice',
 'some',
 'sort',
 'splice',
 'toReversed',
 'toSorted',
 'toSpliced',
 'unshift',
 'values',
 'with',
])

const SAFE_STRING_METHODS = new Set([
 'at',
 'charAt',
 'charCodeAt',
 'codePointAt',
 'concat',
 'endsWith',
 'includes',
 'indexOf',
 'isWellFormed',
 'lastIndexOf',
 'localeCompare',
 'match',
 'matchAll',
 'normalize',
 'padEnd',
 'padStart',
 'repeat',
 'replace',
 'replaceAll',
 'search',
 'slice',
 'split',
 'startsWith',
 'substr',
 'substring',
 'toLocaleLowerCase',
 'toLocaleUpperCase',
 'toLowerCase',
 'toUpperCase',
 'toWellFormed',
 'trim',
 'trimEnd',
 'trimLeft',
 'trimRight',
 'trimStart',
])

const SAFE_NUMBER_METHODS = new Set([
 'toExponential',
 'toFixed',
 'toLocaleString',
 'toPrecision',
 'toString',
])

const SAFE_BOOLEAN_METHODS = new Set([
 'toString',
])

const SAFE_DATE_METHODS = new Set([
 'getDate',
 'getDay',
 'getFullYear',
 'getHours',
 'getMilliseconds',
 'getMinutes',
 'getMonth',
 'getSeconds',
 'getTime',
 'getTimezoneOffset',
 'getUTCDate',
 'getUTCDay',
 'getUTCFullYear',
 'getUTCHours',
 'getUTCMilliseconds',
 'getUTCMinutes',
 'getUTCMonth',
 'getUTCSeconds',
 'setDate',
 'setFullYear',
 'setHours',
 'setMilliseconds',
 'setMinutes',
 'setMonth',
 'setSeconds',
 'setTime',
 'setUTCDate',
 'setUTCFullYear',
 'setUTCHours',
 'setUTCMilliseconds',
 'setUTCMinutes',
 'setUTCMonth',
 'setUTCSeconds',
 'toDateString',
 'toISOString',
 'toJSON',
 'toLocaleDateString',
 'toLocaleString',
 'toLocaleTimeString',
 'toString',
 'toTimeString',
 'toUTCString',
 'valueOf',
])

const SAFE_REGEXP_MEMBERS = new Set([
 'dotAll',
 'exec',
 'flags',
 'global',
 'hasIndices',
 'ignoreCase',
 'multiline',
 'source',
 'sticky',
 'test',
 'unicode',
 'unicodeSets',
])

const SAFE_MAP_MEMBERS = new Set([
 'clear',
 'delete',
 'entries',
 'forEach',
 'get',
 'has',
 'keys',
 'set',
 'size',
 'values',
])

const SAFE_SET_MEMBERS = new Set([
 'add',
 'clear',
 'delete',
 'entries',
 'forEach',
 'has',
 'keys',
 'size',
 'values',
])

const SAFE_PROMISE_METHODS = new Set([
 'catch',
 'finally',
 'then',
])

const SAFE_ERROR_MEMBERS = new Set([
 'cause',
 'message',
 'name',
])

const SAFE_BINARY_MEMBERS = new Set([
 'at',
 'buffer',
 'byteLength',
 'byteOffset',
 'entries',
 'every',
 'fill',
 'filter',
 'find',
 'findIndex',
 'forEach',
 'getFloat32',
 'getFloat64',
 'getInt8',
 'getInt16',
 'getInt32',
 'getUint8',
 'getUint16',
 'getUint32',
 'includes',
 'indexOf',
 'join',
 'keys',
 'lastIndexOf',
 'length',
 'map',
 'reduce',
 'reduceRight',
 'reverse',
 'set',
 'setFloat32',
 'setFloat64',
 'setInt8',
 'setInt16',
 'setInt32',
 'setUint8',
 'setUint16',
 'setUint32',
 'slice',
 'some',
 'sort',
 'subarray',
 'values',
])

function isObjectPrototype(proto) {
 if (!proto || typeof proto !== 'object' || SCOPE_FRAMES.has(proto)) {
  return false
 }
 if (proto === Object.prototype) {
  return true
 }
 return (
  Object.getPrototypeOf(proto) === null &&
  Object.hasOwn(proto, 'hasOwnProperty') &&
  Object.hasOwn(proto, 'isPrototypeOf')
 )
}

function isFunctionPrototype(proto) {
 if (typeof proto !== 'function') {
  return false
 }
 if (proto === Function.prototype) {
  return true
 }
 return (
  Object.hasOwn(proto, 'call') &&
  Object.hasOwn(proto, 'apply') &&
  Object.hasOwn(proto, 'bind')
 )
}

function isIntrinsicPrototypeObject(target) {
 return (
  isObjectPrototype(target) ||
  isFunctionPrototype(target) ||
  target === Array.prototype ||
  target === String.prototype ||
  target === Number.prototype ||
  target === Boolean.prototype ||
  target === Date.prototype ||
  target === RegExp.prototype ||
  target === Map.prototype ||
  target === Set.prototype ||
  target === Promise.prototype ||
  target === Error.prototype
 )
}

function isForbiddenPropertyKey(key) {
 return typeof key === 'string' && FORBIDDEN_PROPERTY_KEY_SET.has(key)
}

function assertSafePropertyKey(key, context) {
 if (typeof key === 'symbol') {
  return
 }
 const normalized = (typeof key === 'string' || typeof key === 'number' || typeof key === 'boolean' || typeof key === 'bigint')
  ? String(key)
  : null
 if (normalized !== null && FORBIDDEN_PROPERTY_KEY_SET.has(normalized)) {
  throw new TypeError(`${context}: access to forbidden property ${JSON.stringify(normalized)} is not allowed`)
 }
}

function createNullProtoState(initialState) {
 const root = Object.create(null)
 SCOPE_FRAMES.add(root)
 if (!initialState || typeof initialState !== 'object') {
  return root
 }
 for (const key of Reflect.ownKeys(initialState)) {
  if (typeof key === 'string' && FORBIDDEN_PROPERTY_KEY_SET.has(key)) {
   continue
  }
  const desc = Object.getOwnPropertyDescriptor(initialState, key)
  if (desc) {
   Object.defineProperty(root, key, desc)
  }
 }
 return root
}

function severObjectPrototype(obj) {
 if (!obj || typeof obj !== 'object') {
  return createNullProtoState(null)
 }
 let cur = obj
 const visited = new Set()
 while (cur && !visited.has(cur)) {
  visited.add(cur)
  SCOPE_FRAMES.add(cur)
  for (const key of FORBIDDEN_PROPERTY_KEYS) {
   if (Object.hasOwn(cur, key)) {
    try {
     delete cur[key]
    }
    catch {
     // Ignore non-configurable own keys
    }
   }
  }
  const proto = Object.getPrototypeOf(cur)
  if (proto === null) {
   return obj
  }
  if (isObjectPrototype(proto)) {
   if (!Object.isExtensible(cur)) {
    return createNullProtoState(obj)
   }
   Object.setPrototypeOf(cur, null)
   return obj
  }
  cur = proto
 }
 return obj
}

function createChildScopeState(parentState) {
 const child = Object.create(parentState)
 SCOPE_FRAMES.add(child)
 return child
}

function hasScopeBinding(stateObj, key) {
 if (!stateObj || typeof stateObj !== 'object' || isForbiddenPropertyKey(key)) {
  return false
 }
 let cur = stateObj
 while (cur && !isObjectPrototype(cur) && !isFunctionPrototype(cur)) {
  if (Object.hasOwn(cur, key)) {
   return true
  }
  cur = Object.getPrototypeOf(cur)
 }
 return false
}

function hasAllowedProperty(receiver, rawKey) {
 if (receiver === null || receiver === undefined) {
  return false
 }
 if (typeof rawKey === 'symbol') {
  return false
 }
 const prop = String(rawKey)
 if (FORBIDDEN_PROPERTY_KEY_SET.has(prop)) {
  return false
 }
 if (typeof receiver === 'string') {
  if (prop === 'length' || SAFE_STRING_METHODS.has(prop)) {
   return true
  }
  return /^(0|[1-9]\d*)$/.test(prop) && Number(prop) < receiver.length
 }
 if (typeof receiver === 'number') {
  return SAFE_NUMBER_METHODS.has(prop)
 }
 if (typeof receiver === 'boolean') {
  return SAFE_BOOLEAN_METHODS.has(prop)
 }
 if (typeof receiver === 'bigint') {
  return prop === 'toString'
 }
 if (typeof receiver === 'symbol') {
  return prop === 'toString' || prop === 'description'
 }
 if (typeof receiver === 'function') {
  if (FORBIDDEN_FUNCTION_KEY_SET.has(prop)) {
   return false
  }
  return Object.hasOwn(receiver, prop)
 }
 if (typeof receiver !== 'object') {
  return false
 }
 if (Array.isArray(receiver)) {
  return Object.hasOwn(receiver, prop) || SAFE_ARRAY_METHODS.has(prop)
 }
 if (ArrayBuffer.isView(receiver) || receiver instanceof ArrayBuffer) {
  return Object.hasOwn(receiver, prop) || SAFE_BINARY_MEMBERS.has(prop)
 }
 if (receiver instanceof Date) {
  return Object.hasOwn(receiver, prop) || SAFE_DATE_METHODS.has(prop)
 }
 if (receiver instanceof RegExp) {
  return Object.hasOwn(receiver, prop) || SAFE_REGEXP_MEMBERS.has(prop)
 }
 if (receiver instanceof Map) {
  return Object.hasOwn(receiver, prop) || SAFE_MAP_MEMBERS.has(prop)
 }
 if (receiver instanceof Set) {
  return Object.hasOwn(receiver, prop) || SAFE_SET_MEMBERS.has(prop)
 }
 if (receiver instanceof Promise) {
  return Object.hasOwn(receiver, prop) || SAFE_PROMISE_METHODS.has(prop)
 }
 if (receiver instanceof Error) {
  return Object.hasOwn(receiver, prop) || SAFE_ERROR_MEMBERS.has(prop)
 }
 if (receiver instanceof String) {
  return Object.hasOwn(receiver, prop) || SAFE_STRING_METHODS.has(prop)
 }
 if (receiver instanceof Number) {
  return Object.hasOwn(receiver, prop) || SAFE_NUMBER_METHODS.has(prop)
 }
 if (receiver instanceof Boolean) {
  return Object.hasOwn(receiver, prop) || SAFE_BOOLEAN_METHODS.has(prop)
 }
 if (Object.hasOwn(receiver, prop)) {
  return true
 }
 let proto = Object.getPrototypeOf(receiver)
 while (proto !== null) {
  if (isObjectPrototype(proto) || isFunctionPrototype(proto)) {
   return false
  }
  if (Object.hasOwn(proto, prop)) {
   return true
  }
  proto = Object.getPrototypeOf(proto)
 }
 return false
}

export function isThenable(value) {
 if (value === null || (typeof value !== 'object' && typeof value !== 'function')) {
  return false
 }
 if (value instanceof Promise) {
  return typeof value.then === 'function'
 }
 if (Object.hasOwn(value, 'then')) {
  return typeof value.then === 'function'
 }
 if (typeof value === 'function') {
  return false
 }
 let proto = Object.getPrototypeOf(value)
 while (proto !== null) {
  if (isObjectPrototype(proto) || isFunctionPrototype(proto)) {
   return false
  }
  if (Object.hasOwn(proto, 'then')) {
   return typeof value.then === 'function'
  }
  proto = Object.getPrototypeOf(proto)
 }
 return false
}

function shieldNonThenable(obj) {
 if (obj && typeof obj === 'object' && !Object.hasOwn(obj, 'then')) {
  Object.defineProperty(obj, 'then', {
   value: undefined,
   enumerable: false,
   writable: true,
   configurable: true,
  })
 }
 return obj
}

function then(value, onFulfilled) {
 return isThenable(value) ? value.then(onFulfilled) : onFulfilled(value)
}

function wrapErrorCatch(result, node) {
 return isThenable(result)
  ? result.catch(err => { throw wrapRuntimeError(err, node) })
  : result
}

function formatLoc(loc) {
 if (!loc) {
  return ''
 }
 const where = loc.filename
  ? `${loc.filename}:${loc.line}:${loc.col}`
  : `line ${loc.line} at column ${loc.col}`
 return loc.sourceLine !== undefined && loc.sourceLine.length > 0
  ? ` (${where}: ${loc.sourceLine.trim()})`
  : ` (${where})`
}

function wrapRuntimeError(err, node) {
 if (err && typeof err === 'object' && err[FIELD_ERROR_TAGGED]) {
  return err
 }
 const loc = node && typeof node === 'object' ? AST_LOC.get(node) : undefined
 if (!loc) {
  return err
 }
 const suffix = formatLoc(loc)
 if (err instanceof Error) {
  err.message = `${err.message}${suffix}`
  err.fieldLocation = loc
  err[FIELD_ERROR_TAGGED] = true
  return err
 }
 const wrapped = new Error(`${err}${suffix}`)
 wrapped.fieldLocation = loc
 wrapped[FIELD_ERROR_TAGGED] = true
 return wrapped
}

export const TRANSPORT_PACKET_TYPE = 'field-transport/script'
const TRANSPORT_TAG = '__fieldTransport'
const TRANSPORT_UNSERIALIZABLE = Symbol('transportUnserializable')
const TRANSPORT_EXCLUDED_BINDINGS = new Set([
 'Array',
 'argv',
 'console',
 'data',
 'Date',
 'deployLane',
 'document',
 'exportLaneLine',
 'fetch',
 'importLane',
 'JSON',
 'Math',
 'Number',
 'output',
 'respond',
 'resyncLane',
 'setLaneLine',
 'syncLaneTable',
 'syncTable',
 'tableChange',
 'window',
])

function encodeTransportValue(value, seen = new Set(), strict = true) {
 if (value === undefined) {
  return { [TRANSPORT_TAG]: 'undefined' }
 }
 if (value === null || typeof value === 'boolean' || typeof value === 'string') {
  return value
 }
 if (typeof value === 'number') {
  if (Number.isNaN(value)) {
   return { [TRANSPORT_TAG]: 'number', value: 'NaN' }
  }
  if (value === Infinity) {
   return { [TRANSPORT_TAG]: 'number', value: 'Infinity' }
  }
  if (value === -Infinity) {
   return { [TRANSPORT_TAG]: 'number', value: '-Infinity' }
  }
  if (Object.is(value, -0)) {
   return { [TRANSPORT_TAG]: 'number', value: '-0' }
  }
  return value
 }
 if (typeof value === 'function' || typeof value === 'symbol' || typeof value === 'bigint') {
  if (strict) {
   throw new TypeError(`Cannot transport ${typeof value} value across code transport`)
  }
  return TRANSPORT_UNSERIALIZABLE
 }
 if (value instanceof Date) {
  const iso = Number.isNaN(value.getTime()) ? 'Invalid Date' : value.toISOString()
  return { [TRANSPORT_TAG]: 'date', value: iso }
 }
 if (seen.has(value)) {
  if (strict) {
   throw new TypeError('Cannot transport circular value across code transport')
  }
  return TRANSPORT_UNSERIALIZABLE
 }
 if (Array.isArray(value)) {
  seen.add(value)
  const out = []
  for (let i = 0; i < value.length; i++) {
   const encoded = encodeTransportValue(value[i], seen, strict)
   if (encoded === TRANSPORT_UNSERIALIZABLE) {
    seen.delete(value)
    return TRANSPORT_UNSERIALIZABLE
   }
   out.push(encoded)
  }
  seen.delete(value)
  return out
 }
 const proto = Object.getPrototypeOf(value)
 if (proto !== null && proto !== Object.prototype) {
  if (strict) {
   throw new TypeError('Cannot transport non-plain object across code transport')
  }
  return TRANSPORT_UNSERIALIZABLE
 }
 seen.add(value)
 const entries = Object.entries(value)
 const hasReservedTag = Object.hasOwn(value, TRANSPORT_TAG)
 const out = {}
 for (const [k, v] of entries) {
  const encoded = encodeTransportValue(v, seen, strict)
  if (encoded === TRANSPORT_UNSERIALIZABLE) {
   seen.delete(value)
   return TRANSPORT_UNSERIALIZABLE
  }
  out[k] = encoded
 }
 seen.delete(value)
 if (hasReservedTag) {
  return { [TRANSPORT_TAG]: 'object', entries: Object.entries(out) }
 }
 return out
}

function decodeTransportValue(value) {
 if (value === null || typeof value !== 'object') {
  return value
 }
 if (Array.isArray(value)) {
  return value.map(decodeTransportValue)
 }
 if (Object.hasOwn(value, TRANSPORT_TAG)) {
  const tag = value[TRANSPORT_TAG]
  if (tag === 'undefined') {
   return undefined
  }
  if (tag === 'number') {
   if (value.value === 'NaN') { return NaN }
   if (value.value === 'Infinity') { return Infinity }
   if (value.value === '-Infinity') { return -Infinity }
   if (value.value === '-0') { return -0 }
   return Number(value.value)
  }
  if (tag === 'date') {
   return value.value === 'Invalid Date' ? new Date(NaN) : new Date(value.value)
  }
  if (tag === 'object' && Array.isArray(value.entries)) {
   const decodedEntries = {}
   for (const pair of value.entries) {
    if (!Array.isArray(pair) || pair.length < 2) {
     continue
    }
    const k = String(pair[0])
    if (FORBIDDEN_PROPERTY_KEY_SET.has(k)) {
     continue
    }
    Object.defineProperty(decodedEntries, k, {
     value: decodeTransportValue(pair[1]),
     enumerable: true,
     writable: true,
     configurable: true,
    })
   }
   return decodedEntries
  }
 }
 const out = {}
 for (const [k, v] of Object.entries(value)) {
  if (FORBIDDEN_PROPERTY_KEY_SET.has(k)) {
   continue
  }
  Object.defineProperty(out, k, {
   value: decodeTransportValue(v),
   enumerable: true,
   writable: true,
   configurable: true,
  })
 }
 return out
}

function snapshotSerializableState(state) {
 const bindings = {}
 if (!state || typeof state !== 'object') {
  return bindings
 }
 const seenKeys = new Set()
 let cur = state
 while (cur && cur !== Object.prototype) {
  for (const key of Object.keys(cur)) {
   if (seenKeys.has(key) || TRANSPORT_EXCLUDED_BINDINGS.has(key)) {
    continue
   }
   seenKeys.add(key)
   try {
    const val = state[key]
    const encoded = encodeTransportValue(val, new Set(), false)
    if (encoded !== TRANSPORT_UNSERIALIZABLE) {
     bindings[key] = decodeTransportValue(encoded)
    }
   }
   catch {
    // skip throwing getters
   }
  }
  cur = Object.getPrototypeOf(cur)
 }
 return bindings
}

export function serializeTransportPacket(packet) {
 if (!packet || typeof packet !== 'object' || !Array.isArray(packet.ast)) {
  throw new TypeError('serializeTransportPacket expects a transport packet with an AST array')
 }
 const encoded = encodeTransportValue(
  {
   type: TRANSPORT_PACKET_TYPE,
   index: packet.index ?? 0,
   lineNumber: packet.lineNumber ?? null,
   ast: packet.ast,
   args: Array.isArray(packet.args) ? packet.args : [],
   bindings: packet.bindings && typeof packet.bindings === 'object' ? packet.bindings : {},
  },
  new Set(),
  true
 )
 return JSON.stringify(encoded)
}

export function deserializeTransportPacket(wire) {
 const parsed = typeof wire === 'string' ? JSON.parse(wire) : wire
 const decoded = decodeTransportValue(parsed)
 if (!decoded || typeof decoded !== 'object' || decoded.type !== TRANSPORT_PACKET_TYPE || !Array.isArray(decoded.ast)) {
  throw new TypeError('Invalid FieldScript code transport packet')
 }
 return {
  type: TRANSPORT_PACKET_TYPE,
  index: decoded.index ?? 0,
  lineNumber: decoded.lineNumber ?? null,
  ast: decoded.ast,
  args: Array.isArray(decoded.args) ? decoded.args : [],
  bindings: decoded.bindings && typeof decoded.bindings === 'object' ? decoded.bindings : {},
 }
}

export function isTransportPacket(value) {
 return Boolean(
  value &&
  typeof value === 'object' &&
  value.type === TRANSPORT_PACKET_TYPE &&
  Array.isArray(value.ast)
 )
}

export function isDomElement(value) {
 if (!value || typeof value !== 'object') {
  return false
 }
 if (typeof Element === 'function' && value instanceof Element) {
  return true
 }
 if (typeof DocumentFragment === 'function' && value instanceof DocumentFragment) {
  return true
 }
 if (value.nodeType === 1 || value.nodeType === 11) {
  return true
 }
 if (
  typeof value.tag === 'string' &&
  typeof value.appendChild === 'function' &&
  typeof value.setAttribute === 'function'
 ) {
  return true
 }
 return false
}

export function createTransport() {
 const queue = []
 let currentLineNumber = null
 return {
  setLineNumber(lineNumber) {
   currentLineNumber = lineNumber
  },
  send(block, args = [], meta = {}) {
   let ast
   let baseArgs = []
   let baseBindings = {}
   if (typeof block === 'function' && Array.isArray(block.ast)) {
    ast = block.ast
   }
   else if (isTransportPacket(block)) {
    ast = block.ast
    baseArgs = Array.isArray(block.args) ? block.args : []
    baseBindings = block.bindings && typeof block.bindings === 'object' ? block.bindings : {}
   }
   else {
    throw new TypeError('send expects a deferred ( ... ) block')
   }
   const resolvedArgs = args.length > 0 ? args : baseArgs
   const stateBindings = meta.state ? snapshotSerializableState(meta.state) : {}
   const bindings = { ...baseBindings, ...stateBindings }
   const index = queue.length
   const lineNumber = meta.lineNumber ?? currentLineNumber
   const wire = serializeTransportPacket({
    type: TRANSPORT_PACKET_TYPE,
    index,
    lineNumber,
    ast,
    args: resolvedArgs,
    bindings,
   })
   const packet = deserializeTransportPacket(wire)
   packet.wire = wire
   queue.push(packet)
   return packet
  },
  packets() {
   return queue.slice()
  },
  wires() {
   return queue.map(item => item.wire)
  },
  clear() {
   queue.length = 0
  },
 }
}

export function field(initialState={}, options={}) {
 const transport = options.transport || createTransport()
 const limits = normalizeFieldLimits(options.limits, options)
 const hasExplicitBudget = Boolean(options && options.executionBudget)
 const hasExplicitRunLimits = Boolean(
  options &&
  options.limits &&
  (Object.hasOwn(options.limits, 'maxSteps') || Object.hasOwn(options.limits, 'maxExecutionMs'))
 )
 const executionBudget = hasExplicitBudget
  ? options.executionBudget
  : (options.enforceRunBudget || hasExplicitRunLimits)
   ? createExecutionBudget(limits)
   : null
 const disallowLoad = Boolean(options && options.disallowLoad)
 const runtimeState = {
  callDepth: Number.isInteger(options.initialCallDepth) ? options.initialCallDepth : 0,
  totalLoads: 0,
 }

 function createScope(state, argv = [], scopeMeta = {}) {
  const frameDepth = Number.isInteger(scopeMeta.depth) ? scopeMeta.depth : 0
  const loadStack = Array.isArray(scopeMeta.loadStack) ? scopeMeta.loadStack : []

  function runAtDepth(depth, fn) {
   const prev = runtimeState.callDepth
   runtimeState.callDepth = depth
   try {
    return fn()
   }
   finally {
    runtimeState.callDepth = prev
   }
  }

  function scopeThen(value, onFulfilled, onRejected) {
   if (!isThenable(value)) {
    return onFulfilled(value)
   }
   const savedDepth = frameDepth
   return value.then(
    v => runAtDepth(savedDepth, () => {
     tickExecutionBudget(executionBudget, true)
     return onFulfilled(v)
    }),
    onRejected
     ? err => runAtDepth(savedDepth, () => {
      tickExecutionBudget(executionBudget, true)
      return onRejected(err)
     })
     : undefined
   )
  }

  function get(a, ...p) {
   const [root, ...path] = splitRootPath(a, p)
   assertSafePropertyKey(root, 'get')
   let v = root === 'argv'
    ? argv
    : ((typeof root === 'string' || typeof root === 'number') && hasScopeBinding(state, String(root))
     ? state[root]
     : undefined)
   for (const s of path) {
    assertSafePropertyKey(s, 'get')
    if (v != null) {
     v = hasAllowedProperty(v, s) ? v[s] : undefined
    }
   }
   return v
  }
  function propertyIs(x, a, ...p) {
   return get(a, ...p) === x
  }
  function propertyIsLessThan(x, a, ...p) {
   return get(a, ...p) < x
  }
  function propertyIsGreaterThan(x, a, ...p) {
   return get(a, ...p) > x
  }
  function propertyIsLessThanOrEqual(x, a, ...p) {
   return get(a, ...p) <= x
  }
  function propertyIsGreaterThanOrEqual(x, a, ...p) {
   return get(a, ...p) >= x
  }
  function series(...b) {
   return b.map(
    line =>
     line[0] === '@'
      ? me[line[1]](...line.slice(2))
      : line
   )
  }
  function assignBinding(target, key, value) {
   if (target === null || target === undefined || (typeof target !== 'object' && typeof target !== 'function')) {
    throw new TypeError(`Cannot set property on non-object target: ${target}`)
   }
   if (isIntrinsicPrototypeObject(target)) {
    throw new TypeError('Cannot mutate intrinsic prototype object')
   }
   if (!Array.isArray(key)) {
    assertSafePropertyKey(key, 'set')
    target[key] = value
    return
   }
   const list = Array.isArray(value)
    ? value
    : value != null && typeof value[Symbol.iterator] === 'function'
     ? Array.from(value)
     : null
   if (list === null) {
    throw new TypeError(`Cannot destructure non-iterable value: ${value}`)
   }
   for (let i = 0; i < key.length; i++) {
    const k = key[i]
    if (k === null || k === undefined) {
     continue
    }
    if (typeof k === 'string' && k.startsWith('...') && k.length > 3) {
     if (i !== key.length - 1) {
      throw new Error('Rest element must be last in destructuring pattern')
     }
     const restKey = k.slice(3)
     assertSafePropertyKey(restKey, 'set')
     target[restKey] = list.slice(i)
     return
    }
    assignBinding(target, k, list[i])
   }
  }
  function assign(target, ...sources) {
   const obj = typeof target === 'string' ? get(target) : target
   if (!obj || typeof obj !== 'object') {
    throw new TypeError(`assign target is not an object: ${JSON.stringify(target)}`)
   }
   if (isIntrinsicPrototypeObject(obj)) {
    throw new TypeError('Cannot mutate intrinsic prototype object')
   }
   for (const source of sources) {
    if (source === null || source === undefined) {
     continue
    }
    if (Array.isArray(source)) {
     if (source.length !== 2) {
      throw new TypeError(`assign expects { key value } pairs or objects, got: ${JSON.stringify(source)}`)
     }
     const propKey = String(source[0])
     assertSafePropertyKey(propKey, 'assign')
     obj[propKey] = source[1]
    }
    else if (typeof source === 'object') {
     for (const propKey of Object.keys(source)) {
      assertSafePropertyKey(propKey, 'assign')
      if (Object.hasOwn(source, propKey)) {
       obj[propKey] = source[propKey]
      }
     }
    }
    else {
     throw new TypeError(`assign expects { key value } pairs or objects, got: ${JSON.stringify(source)}`)
    }
   }
   return obj
  }
  function to(a, ...c) {
   const b = c.pop()
   return set(b, a, ...c)
  }
  function set(b, a, ...c) {
   const [root, ...path] = splitRootPath(a, c)
   if (path.length === 0) {
    assignBinding(state, root, b)
    return b
   }
   assertSafePropertyKey(root, 'set')
   let v = (typeof root === 'string' || typeof root === 'number') && hasScopeBinding(state, String(root))
    ? state[root]
    : undefined
   const f = path.pop()
   for (const d of path) {
    assertSafePropertyKey(d, 'set')
    if (v === null || v === undefined) {
     throw new TypeError(`Cannot read properties of ${v} (reading ${JSON.stringify(String(d))})`)
    }
    v = hasAllowedProperty(v, d) ? v[d] : undefined
   }
   assignBinding(v, f, b)
   return b
  }
  function invoke(b, a, ...c) {
   const [root, ...path] = splitRootPath(a, c)
   if (path.length === 0) {
    if (typeof root !== 'function') {
     assertSafePropertyKey(root, 'invoke')
    }
    const fn = typeof root === 'function'
     ? root
     : ((typeof root === 'string' || typeof root === 'number') && hasScopeBinding(state, String(root))
      ? state[root]
      : undefined)
    if (typeof fn !== 'function') {
     throw new Error(`invoke: ${JSON.stringify(root)} is not a function`)
    }
    return fn(...b)
   }
   let v
   if (typeof root === 'string') {
    assertSafePropertyKey(root, 'invoke')
    v = root === 'argv' ? argv : (hasScopeBinding(state, root) ? state[root] : undefined)
   }
   else {
    v = root
   }
   if (v == null) {
    throw new Error(`invokeProperty: ${JSON.stringify(root)} not found`)
   }
   const f = path.pop()
   for (const d of path) {
    assertSafePropertyKey(d, 'invoke')
    v = hasAllowedProperty(v, d) ? v[d] : undefined
    if (v == null) {
     throw new Error(`invokeProperty: ${JSON.stringify(d)} not found in ${[root, ...path].join('.')}`)
    }
   }
   assertSafePropertyKey(f, 'invoke')
   if (!hasAllowedProperty(v, f) || typeof v[f] !== 'function') {
    throw new TypeError(`invokeProperty: ${JSON.stringify(String(f))} is not an allowed method`)
   }
   return Reflect.apply(v[f], v, b)
  }
  function tap(a, ...c) {
   return invoke([], a, ...c)
  }
  function and(...blocks) {
   let v = true
   for (const block of blocks) {
    if (Array.isArray(block)) {
     const [ b, ...a ] = block
     v &= (typeof b === 'string' && typeof me[b] === 'function') ? Boolean(me[b](...a)) : Boolean(b)
    }
    else {
     v &= Boolean(block)
    }
   }
   return v
  }
  function comment() {
   // no-op
  }
  function invokeBranch(body) {
   if (typeof body === 'function') {
    return body[LEXICAL_SCOPE] === me ? body[RUN_IN_SCOPE](me) : body()
   }
   return body
  }
  function condition([b, ...a], t) {
   if (me[b](...a)) {
    return invokeBranch(t)
   }
  }
  function assertLoopIteration(iterations) {
   if (hasPositiveLimit(limits.maxLoopIterations) && iterations > limits.maxLoopIterations) {
    throw makeLimitExceededError(`Maximum FieldScript loop iterations (${limits.maxLoopIterations}) exceeded`, 'maxLoopIterations')
   }
   tickExecutionBudget(executionBudget)
  }
  function match(...pairs) {
   const step = i => {
    while (i < pairs.length) {
     const pair = pairs[i]
     if (!Array.isArray(pair) || pair.length !== 2) {
      throw new TypeError(`match expects { condition ( will ) } pairs, got: ${JSON.stringify(pair)}`)
     }
     const [cond, body] = pair
     const matched = Array.isArray(cond) && typeof cond[0] === 'string' && typeof me[cond[0]] === 'function'
      ? me[cond[0]](...cond.slice(1))
      : cond
     if (isThenable(matched)) {
      return scopeThen(matched, m => (m ? invokeBranch(body) : step(i + 1)))
     }
     if (matched) {
      return invokeBranch(body)
     }
     i++
    }
    return undefined
   }
   return step(0)
  }
  function each(iterable, fn) {
   if (iterable == null || typeof iterable[Symbol.iterator] !== 'function') {
    throw new TypeError(`each expects an iterable, got: ${iterable}`)
   }
   if (typeof fn !== 'function') {
    throw new TypeError(`each expects a function, got: ${fn}`)
   }
   const iter = iterable[Symbol.iterator]()
   let index = 0
   let iterations = 0
   let last
   const step = () => {
    while (true) {
     const next = iter.next()
     if (next.done) {
      return last
     }
     iterations += 1
     assertLoopIteration(iterations)
     const res = fn(next.value, index++)
     if (isThenable(res)) {
      return scopeThen(res, v => {
       last = v
       return step()
      })
     }
     last = res
    }
   }
   return step()
  }
  function whileLoop(cond, body) {
   let last
   let iterations = 0
   const loop = () => {
    while (true) {
     const c = Array.isArray(cond) && typeof cond[0] === 'string' && typeof me[cond[0]] === 'function'
      ? me[cond[0]](...cond.slice(1))
      : typeof cond === 'function'
       ? invokeBranch(cond)
       : cond
     if (isThenable(c)) {
      return scopeThen(c, ok => {
       if (!ok) { return last }
       iterations += 1
       assertLoopIteration(iterations)
       return scopeThen(invokeBranch(body), v => {
        last = v
        return loop()
       })
      })
     }
     if (!c) {
      return last
     }
     iterations += 1
     assertLoopIteration(iterations)
     const res = invokeBranch(body)
     if (isThenable(res)) {
      return scopeThen(res, v => {
       last = v
       return loop()
      })
     }
     last = res
    }
   }
   return loop()
  }

  function tryBlock(body, onError) {
   try {
    const res = invokeBranch(body)
    if (isThenable(res)) {
     return scopeThen(res, v => v, err => {
      if (err && err[FIELD_LIMIT_EXCEEDED] && executionBudget && executionBudget.exhausted) {
       throw err
      }
      return typeof onError === 'function' ? onError(err) : onError
     })
    }
    return res
   }
   catch (err) {
    if (err && err[FIELD_LIMIT_EXCEEDED] && executionBudget && executionBudget.exhausted) {
     throw err
    }
    return typeof onError === 'function' ? onError(err) : onError
   }
  }

  function willInvoke(a, ...b) {
   return function (...d) {
    return me.get(...b)(...a, ...d)
   }
  }

  function willSeries(...b) {
   return function func(...a) {
    const nextDepth = runtimeState.callDepth + 1
    if (hasPositiveLimit(limits.maxCallDepth) && nextDepth > limits.maxCallDepth) {
     throw makeLimitExceededError(`Maximum FieldScript call stack depth (${limits.maxCallDepth}) exceeded`, 'maxCallDepth')
    }
    const child = createScope(createChildScopeState(state), a, { depth: nextDepth, loadStack })
    return runAtDepth(nextDepth, () => {
     for (const [c, ...d] of b) {
      child[c](...d)
     }
    })
   }
  }

  function add(a, b) { return a + b }
  function subtract(a, b) { return a - b }
  function multiply(a, b) { return a * b }
  function divide(a, b) { return a / b }
  function ternary(a, b, c) { return a ? b : c }
  function modulus(a, b) { return a % b }

  function seriesAll(source, fn, shieldAsyncResult = false) {
   const out = []
   let wentAsync = false
   const step = i => {
    while (i < source.length) {
     const res = fn(source[i])
     if (isThenable(res)) {
      wentAsync = true
      return scopeThen(res, v => {
       out.push(v)
       return step(i + 1)
      })
     }
     out.push(res)
     i++
    }
    return wentAsync && shieldAsyncResult ? shieldNonThenable(out) : out
   }
   return step(0)
  }

  function evalCondition(condAst) {
   if (
    Array.isArray(condAst) &&
    condAst[0] !== '@' &&
    typeof condAst[0] === 'string' &&
    typeof me[condAst[0]] === 'function'
   ) {
    return scopeThen(seriesAll(condAst.slice(1), compile, true), args => me[condAst[0]](...args))
   }
   if (Array.isArray(condAst) && condAst[0] === '@' && condAst[1] === 'will') {
    return scopeThen(compile(condAst), fn => invokeBranch(fn))
   }
   return compile(condAst)
  }

  function evalMatch(armAsts) {
   const step = i => {
    while (i < armAsts.length) {
     const armAst = armAsts[i]
     if (Array.isArray(armAst) && armAst[0] !== '@' && armAst.length === 2) {
      const [condAst, bodyAst] = armAst
      const matched = evalCondition(condAst)
      if (isThenable(matched)) {
       return scopeThen(matched, m =>
        m ? scopeThen(compile(bodyAst), invokeBranch) : step(i + 1)
       )
      }
      if (matched) {
       return scopeThen(compile(bodyAst), invokeBranch)
      }
     }
     else {
      const handlePair = pair => {
       if (!Array.isArray(pair) || pair.length !== 2) {
        throw new TypeError(`match expects { condition ( will ) } pairs, got: ${JSON.stringify(pair)}`)
       }
       const [cond, body] = pair
       const matched = Array.isArray(cond) && typeof cond[0] === 'string' && typeof me[cond[0]] === 'function'
        ? me[cond[0]](...cond.slice(1))
        : cond
       return scopeThen(matched, m => (m ? invokeBranch(body) : step(i + 1)))
      }
      const pair = compile(armAst)
      return isThenable(pair) ? scopeThen(pair, handlePair) : handlePair(pair)
     }
     i++
    }
    return undefined
   }
   return step(0)
  }

  function evalWhile(condAst, bodyAst) {
   const isWillBody = Array.isArray(bodyAst) && bodyAst[0] === '@' && bodyAst[1] === 'will'
   const runWithBody = compiledBody => {
    let last
    let iterations = 0
    const loop = () => {
     while (true) {
      const cond = evalCondition(condAst)
      if (isThenable(cond)) {
       return scopeThen(cond, c => {
        if (!c) { return last }
        iterations += 1
        assertLoopIteration(iterations)
        const bodyRes = isWillBody ? invokeBranch(compiledBody) : scopeThen(compile(bodyAst), invokeBranch)
        return scopeThen(bodyRes, v => {
         last = v
         return loop()
        })
       })
      }
      if (!cond) {
       return last
      }
      iterations += 1
      assertLoopIteration(iterations)
      const bodyRes = isWillBody ? invokeBranch(compiledBody) : scopeThen(compile(bodyAst), invokeBranch)
      if (isThenable(bodyRes)) {
       return scopeThen(bodyRes, v => {
        last = v
        return loop()
       })
      }
      last = bodyRes
     }
    }
    return loop()
   }
   return isWillBody ? scopeThen(compile(bodyAst), runWithBody) : runWithBody(null)
  }

  function evalBlock(stmts) {
   let last
   const step = i => {
    while (i < stmts.length) {
     const stmt = stmts[i]
     const value = compile(stmt)
     if (isThenable(value)) {
      return scopeThen(value, v => {
       if (!isCommentNode(stmt)) {
        last = v
       }
       return step(i + 1)
      })
     }
     if (!isCommentNode(stmt)) {
      last = value
     }
     i++
    }
    return last
   }
   return runAtDepth(frameDepth, () => step(0))
  }

  function compile(x) {
   switch (true) {
    case x && Array.isArray(x):
     if (x[0] === '@') {
      if (x[1] === '@') {
       return x.slice(1)
      }
      try {
       tickExecutionBudget(executionBudget)
       if (!Object.hasOwn(me, x[1]) || typeof me[x[1]] !== 'function') {
        throw new Error(`${JSON.stringify(x[1])} is not a valid FieldScript command`)
       }
       if (x[1] === 'will') {
        return me[x[1]]([ '@', ...x.slice(2) ])
       }
       if (x[1] === 'match') {
        return wrapErrorCatch(evalMatch(x.slice(2)), x)
       }
       if (x[1] === 'while') {
        return wrapErrorCatch(evalWhile(x[2], x[3]), x)
       }
       const res = scopeThen(
        seriesAll(x.slice(2), compile, true),
        args => me[x[1]](...args)
       )
       return wrapErrorCatch(res, x)
      }
      catch (err) {
       throw wrapRuntimeError(err, x)
      }
     }
     return seriesAll(x, compile)
    case typeof x === 'object' && x:
     return scopeThen(
      seriesAll(
       Object.entries(x),
       ([k, v]) => scopeThen(compile(v), val => [k, val])
      ),
      entries => Object.fromEntries(entries)
     )
    default:
     return x
   }
  }

  function template(x, vars) {
   switch (true) {
    case x && Array.isArray(x): {
     if (x[0] === '@') {
      if (x[1] === '@') {
       return x.slice(1)
      }
      if (x.length === 1) {
       return undefined
      }
      if (typeof x[1] !== 'string') {
       throw new Error('expecting string after @')
      }
      if (x[1].substr(0, 9) === 'template#') {
       return vars[x[1].substr(9)]
      }
     }
     let changed = false
     const mapped = new Array(x.length)
     for (let i = 0; i < x.length; i++) {
      const next = template(x[i], vars)
      if (next !== x[i]) {
       changed = true
      }
      mapped[i] = next
     }
     if (!changed) {
      return x
     }
     const loc = AST_LOC.get(x)
     if (loc) {
      AST_LOC.set(mapped, loc)
     }
     return mapped
    }
    case typeof x === 'object' && x:
     return Object.fromEntries(
      Object.entries(x).map(
       ([k, v]) => [k, template(v, vars)]
      )
     )
    default:
     return x
   }
  }

  async function run(program, vars) {
   const templated = me.template(program, vars)
   return runAtDepth(frameDepth, () => {
    if (Array.isArray(templated) && templated[0] !== '@') {
     return evalBlock(templated)
    }
    return me.compile(templated)
   })
  }

  async function load(scriptPath, vars = {}) {
   if (disallowLoad) {
    throw new Error('FieldScript load is disabled in sandboxed lane execution')
   }
   const normPath = scriptPath === null || scriptPath === undefined ? '' : String(scriptPath).trim()
   if (loadStack.includes(normPath)) {
    throw new Error(`Cyclic FieldScript load detected: ${[...loadStack, normPath].join(' -> ')}`)
   }
   const nextLoadStack = [...loadStack, normPath]
   if (hasPositiveLimit(limits.maxLoadDepth) && nextLoadStack.length > limits.maxLoadDepth) {
    throw makeLimitExceededError(`Maximum FieldScript load depth (${limits.maxLoadDepth}) exceeded`, 'maxLoadDepth')
   }
   runtimeState.totalLoads += 1
   if (hasPositiveLimit(limits.maxTotalLoads) && runtimeState.totalLoads > limits.maxTotalLoads) {
    throw makeLimitExceededError(`Maximum FieldScript total loads (${limits.maxTotalLoads}) exceeded`, 'maxTotalLoads')
   }
   const scriptText = await (
    await fetch(scriptPath)
   ).text()
   const program = parse(scriptText, scriptPath, 0, { limits })
   const nextDepth = frameDepth + 1
   if (hasPositiveLimit(limits.maxCallDepth) && nextDepth > limits.maxCallDepth) {
    throw makeLimitExceededError(`Maximum FieldScript call stack depth (${limits.maxCallDepth}) exceeded`, 'maxCallDepth')
   }
   const child = createScope(createChildScopeState(state), [], { depth: nextDepth, loadStack: nextLoadStack })
   return child.run(program, vars)
  }

  function object(...entries) {
   const result = {}
   for (const entry of entries) {
    if (typeof entry === 'string') {
     assertSafePropertyKey(entry, 'object')
     result[entry] = get(entry)
    }
    else if (Array.isArray(entry) && entry.length === 2) {
     const key = String(entry[0])
     assertSafePropertyKey(key, 'object')
     result[key] = entry[1]
    }
    else {
     throw new TypeError('object expects { key value } pairs or shorthand keys')
    }
   }
   return result
  }

  function send(block, ...args) {
   return transport.send(block, args, { state })
  }

  function will(...blocks) {
   const stmts = blocks.length === 1 && blocks[0][0] === '@'
    ? blocks[0].slice(1)
    : blocks
   function fn(...a) {
    const nextDepth = runtimeState.callDepth + 1
    if (hasPositiveLimit(limits.maxCallDepth) && nextDepth > limits.maxCallDepth) {
     throw makeLimitExceededError(`Maximum FieldScript call stack depth (${limits.maxCallDepth}) exceeded`, 'maxCallDepth')
    }
    tickExecutionBudget(executionBudget)
    const child = createScope(createChildScopeState(state), a, { depth: nextDepth, loadStack })
    return runAtDepth(nextDepth, () => child.evalBlock(stmts))
   }
   fn.ast = stmts
   fn[LEXICAL_SCOPE] = me
   fn[RUN_IN_SCOPE] = scope => scope.evalBlock(stmts)
   return fn
  }

  const me = {
   add,
   subtract,
   multiply,
   divide,
   ternary,
   modulus,
   and,
   assign,
   comment,
   condition,
   each,
   get,
   invoke,
   load,
   match,
   object,
   propertyIs,
   propertyIsLessThan,
   propertyIsGreaterThan,
   propertyIsLessThanOrEqual,
   propertyIsGreaterThanOrEqual,
   send,
   series,
   set,
   state,
   tap,
   to,
   transport,
   'try': tryBlock,
   'while': whileLoop,
   will,
   willInvoke,
   willSeries,
   compile,
   evalBlock,
   template,
   run
  }
  return me
 }

 const rootState = options.preservePrototype
  ? severObjectPrototype(initialState)
  : createNullProtoState(initialState)
 const rootArgv = Array.isArray(options.argv) ? options.argv : []
 return createScope(rootState, rootArgv, { depth: 0, loadStack: [] })
}

export const VALID_FIELD_COMMANDS = Object.freeze([
 'add',
 'subtract',
 'multiply',
 'divide',
 'ternary',
 'modulus',
 'and',
 'assign',
 'comment',
 'condition',
 'each',
 'get',
 'invoke',
 'load',
 'match',
 'object',
 'propertyIs',
 'propertyIsLessThan',
 'propertyIsGreaterThan',
 'propertyIsLessThanOrEqual',
 'propertyIsGreaterThanOrEqual',
 'send',
 'series',
 'set',
 'tap',
 'to',
 'try',
 'while',
 'will',
 'willInvoke',
 'willSeries',
 'compile',
 'evalBlock',
 'template',
 'run',
])

const VALID_FIELD_COMMAND_SET = new Set(VALID_FIELD_COMMANDS)

const COMMAND_MIN_ARGS = Object.freeze({
 get: 1,
 to: 2,
 set: 2,
 invoke: 2,
 tap: 1,
 assign: 1,
 condition: 2,
 each: 2,
 while: 2,
 try: 1,
 ternary: 3,
 add: 2,
 subtract: 2,
 multiply: 2,
 divide: 2,
 modulus: 2,
 send: 1,
 load: 1,
 propertyIs: 2,
 propertyIsLessThan: 2,
 propertyIsGreaterThan: 2,
 propertyIsLessThanOrEqual: 2,
 propertyIsGreaterThanOrEqual: 2,
})

function makeSyntaxError(message, loc) {
 const suffix = formatLoc(loc)
 const err = new SyntaxError(`${message}${suffix}`)
 if (loc) {
  err.fieldLocation = loc
  err[FIELD_ERROR_TAGGED] = true
 }
 return err
}

function isPatternRestToken(val) {
 if (typeof val !== 'string' || val.length < 3 || val[0] !== '@' || !val.endsWith('+')) {
  return false
 }
 const digits = val.slice(1, -1)
 const n = parseInt(digits, 10)
 return Number.isInteger(n) && n >= 0 && String(n) === digits
}

function validateDestructuringPattern(pattern, loc) {
 if (!Array.isArray(pattern) || pattern[0] === '@') {
  return
 }
 for (let i = 0; i < pattern.length; i++) {
  const slot = pattern[i]
  if (slot === null || slot === undefined) {
   continue
  }
  if (typeof slot === 'string' && slot.startsWith('...')) {
   if (slot.length <= 3) {
    throw makeSyntaxError('Rest element requires a binding name in destructuring pattern', loc)
   }
   if (i !== pattern.length - 1) {
    throw makeSyntaxError('Rest element must be last in destructuring pattern', loc)
   }
   continue
  }
  if (Array.isArray(slot)) {
   if (slot[0] === '@') {
    throw makeSyntaxError('Destructuring pattern cannot contain command expressions', AST_LOC.get(slot) || loc)
   }
   validateDestructuringPattern(slot, AST_LOC.get(slot) || loc)
  }
 }
}

export function validateFieldScriptAst(node, options = {}) {
 const allowPatternPlaceholders = Boolean(options && options.allowPatternPlaceholders)
 const limits = options && options._limits ? options._limits : normalizeFieldLimits(options && options.limits, options)
 const counter = (options && options._nodeCounter) || { count: 0 }

 function walkAst(cur, depth) {
  counter.count += 1
  if (hasPositiveLimit(limits.maxAstNodes) && counter.count > limits.maxAstNodes) {
   const loc = Array.isArray(cur) ? AST_LOC.get(cur) : undefined
   throw makeLimitExceededError(`FieldScript AST node count exceeds maximum (${limits.maxAstNodes})`, 'maxAstNodes', loc)
  }
  if (!Array.isArray(cur)) {
   return cur
  }
  const loc = AST_LOC.get(cur)
  if (hasPositiveLimit(limits.maxAstDepth) && depth > limits.maxAstDepth) {
   throw makeLimitExceededError(`FieldScript AST depth exceeds maximum (${limits.maxAstDepth})`, 'maxAstDepth', loc)
  }
  if (cur[0] === '@') {
   if (cur.length < 2) {
    throw makeSyntaxError('Empty command block', loc)
   }
   const cmd = cur[1]
   if (cmd === '@') {
    return cur
   }
   if (typeof cmd !== 'string') {
    throw makeSyntaxError(`${JSON.stringify(cmd)} is not a valid FieldScript command`, loc)
   }
   if (!cmd.startsWith('template#') && !VALID_FIELD_COMMAND_SET.has(cmd)) {
    throw makeSyntaxError(`${JSON.stringify(cmd)} is not a valid FieldScript command`, loc)
   }
   const minArgs = COMMAND_MIN_ARGS[cmd]
   if (minArgs !== undefined) {
    const argCount = cur.length - 2
    const hasPatternRest = allowPatternPlaceholders && cur.slice(2).some(isPatternRestToken)
    if (!hasPatternRest && argCount < minArgs) {
     const noun = minArgs === 1 ? 'argument' : 'arguments'
     throw makeSyntaxError(`"${cmd}" requires at least ${minArgs} ${noun}`, loc)
    }
   }
   if (cmd === 'to' && cur.length >= 4) {
    const targetSlot = cur[cur.length - 2]
    if (Array.isArray(targetSlot) && targetSlot[0] !== '@') {
     validateDestructuringPattern(targetSlot, AST_LOC.get(targetSlot) || loc)
    }
   }
   else if (cmd === 'set' && cur.length >= 4) {
    const targetSlot = cur[cur.length - 1]
    if (Array.isArray(targetSlot) && targetSlot[0] !== '@') {
     validateDestructuringPattern(targetSlot, AST_LOC.get(targetSlot) || loc)
    }
   }
   for (let i = 2; i < cur.length; i++) {
    walkAst(cur[i], depth + 1)
   }
   return cur
  }
  for (let i = 0; i < cur.length; i++) {
   walkAst(cur[i], depth + 1)
  }
  return cur
 }

 return walkAst(node, 0)
}

export function parse(text, filename, startRow = 0, options = {}) {
 const limits = options && options._limits ? options._limits : normalizeFieldLimits(options && options.limits, options)
 if (exceedsUtf8Limit(text, limits.maxScriptBytes)) {
  const loc = filename ? { filename, line: startRow + 1, col: 1 } : { line: startRow + 1, col: 1 }
  throw makeLimitExceededError(`FieldScript size exceeds maximum (${limits.maxScriptBytes} bytes)`, 'maxScriptBytes', loc)
 }
 const parseCounter = (options && options._parseCounter) || { count: 0 }
 const output = []
 const root = { block: output }
 const stack = [ root ]
 const length = text.length
 const sourceLines = text.split('\n')
 let scope = root
 let pendingWord = ''
 let pendingWordStartRow = startRow
 let pendingWordStartCol = 0
 let inString = false
 let inEscape = false
 let stringStartLoc = null
 let inPatternDefinition = false
 let pattern = undefined
 let patternScope = undefined
 let collectedPatternIndex = undefined
 let patternLineRow = startRow
 let patternLineCol = 0
 function makeLoc(lineIndex, colIndex) {
  return {
   filename,
   line: lineIndex + 1,
   col: colIndex + 1,
   sourceLine: (sourceLines[lineIndex - startRow] || '').replace(/\r$/, ''),
  }
 }
 function countParseNode(loc, delta = 1) {
  parseCounter.count += delta
  if (hasPositiveLimit(limits.maxAstNodes) && parseCounter.count > limits.maxAstNodes) {
   throw makeLimitExceededError(`FieldScript AST node count exceeds maximum (${limits.maxAstNodes})`, 'maxAstNodes', loc)
  }
 }
 function pushParserScope(nextScope, loc) {
  if (hasPositiveLimit(limits.maxAstDepth) && stack.length > limits.maxAstDepth) {
   throw makeLimitExceededError(`FieldScript AST depth exceeds maximum (${limits.maxAstDepth})`, 'maxAstDepth', loc)
  }
  countParseNode(loc)
  stack.push(nextScope)
  scope = nextScope
 }
 function flushAutoBlock() {
  if (!scope.autoBlock) { throw new SyntaxError('no autoBlock') }
  scope.autoBlock = false
  if (scope.isInvoke) {
   if (scope.block.length === 0) {
    throw makeSyntaxError('Empty invoke block (!)', scope.loc)
   }
   const [ target, ...args ] = scope.block
   const path = typeof target === 'string' ? target.split('.') : [ target ]
   scope.block.splice(0, scope.block.length, '@', 'invoke', args, ...path)
  }
  else if (scope.block[0] === 'list') {
   scope.block.shift()
  }
  else {
   if (scope.isDeferred) {
    if (scope.block.length === 0) {
     throw makeSyntaxError('Empty deferred block (:)', scope.loc)
    }
    scope.block.unshift('will')
   }
   else if (scope.block.length === 0) {
    throw makeSyntaxError('Empty command block (;)', scope.loc)
   }
   scope.block.unshift('@')
  }
  if (scope.loc) {
   AST_LOC.set(scope.block, scope.loc)
  }
  stack.pop()
  scope = stack[stack.length - 1]
 }
 function flushPendingWord(isString = false) {
  if (isString || pendingWord.length > 0) {
   let pendingValue = pendingWord
   const wordLoc = makeLoc(pendingWordStartRow, pendingWordStartCol)
   if (!isString) {
    if (pendingValue.length > 1 && pendingValue[0] === '$') {
     pendingValue = [ '@', 'get', ...pendingValue.slice(1).split('.') ]
     AST_LOC.set(pendingValue, wordLoc)
     countParseNode(wordLoc, pendingValue.length)
    }
    else if (pendingValue === 'false') {
     pendingValue = false
    }
    else if (pendingValue === 'true') {
     pendingValue = true
    }
    else if (pendingValue === 'null') {
     pendingValue = null
    }
    else if (pendingValue === 'undefined') {
     pendingValue = undefined
    }
    else if (pendingValue === '=') {
     inPatternDefinition = true
     pattern = undefined
     patternScope = scope
     collectedPatternIndex = scope.block.length
     pendingWord = ''
     return
    }
    else {
     const num = Number(pendingValue)
     if (Number.isFinite(num) && String(num) === pendingValue) {
      pendingValue = num
     }
    }
   }
   countParseNode(wordLoc)
   if (pattern) {
    if (sinceLastNewline.length === 0) {
     patternLineRow = pendingWordStartRow
     patternLineCol = pendingWordStartCol
    }
    sinceLastNewline.push(pendingValue)
   }
   else {
    scope.block.push(pendingValue)
   }
   pendingWord = ''
  }
 }

 function resolvePattern(x, vars, overrideLoc) {
  switch (true) {
   case x && Array.isArray(x): {
    countParseNode(overrideLoc)
    const resolved = x.reduce(
     (init, y) => init.concat(resolvePattern(y, vars, overrideLoc)), []
    )
    const loc = overrideLoc || AST_LOC.get(x)
    if (loc) {
     AST_LOC.set(resolved, loc)
    }
    return [ resolved ]
   }
   case typeof x === 'object' && x:
    countParseNode(overrideLoc)
    return [
     Object.fromEntries(
      Object.entries(x).map(
       ([k, v]) => [k, resolvePattern(v, vars, overrideLoc)]
      )
     )
    ]
   case typeof x === 'string' && x.length > 1 && x[0] === '@':
    const candidateString = x.slice(1)
    if (candidateString.endsWith('+')) {
     const candidateStringForRest = candidateString.substr(0, candidateString.length - 1)
     const candidateIntForRest = parseInt(candidateStringForRest, 10)
     if (candidateIntForRest.toString(10) === candidateStringForRest) {
      const sliced = vars.slice(candidateIntForRest)
      countParseNode(overrideLoc, Math.max(1, sliced.length))
      return sliced
     }
    }
    else {
     const candidateInt = parseInt(candidateString, 10)
     if (candidateInt.toString(10) === candidateString) {
      countParseNode(overrideLoc)
      return [ vars[candidateInt] ]
     }
    }
   case typeof x === 'string' && x.includes('.') && x.includes('@'):
    countParseNode(overrideLoc)
    return [
     x.split('.').map(seg => {
      if (seg.length > 1 && seg[0] === '@') {
       const idx = parseInt(seg.slice(1), 10)
       if (idx.toString(10) === seg.slice(1)) {
        return vars[idx]
       }
      }
      return seg
     }).join('.')
    ]
   default:
    countParseNode(overrideLoc)
    return [ x ]
  }
 }

 function flushPatternLine(pattern, line) {
  const lineLoc = makeLoc(patternLineRow, patternLineCol)
  const resolvedPattern = resolvePattern(pattern, [line, ...line], lineLoc)
  scope.block.push(...resolvedPattern)
 }

 let sinceLastNewline = []
 let row = startRow
 let col = -1
 for (let i = 0 ; i < length ; i++) {
  col++
  function info() {
   const where = filename
    ? `${filename}:${row + 1}:${col + 1}`
    : `on line ${row + 1} at column ${col + 1}`
   return ` ${where}: ${text.substr(i - col, col)}`
  }
  const chr = text[i]
  if (inString) {
   if (chr === '\n') {
    row++
    col = -1
   }
   if (inEscape) {
    pendingWord +=
     chr === 'n' ? '\n' :
     chr === 'r' ? '\r' :
     chr === 't' ? '\t' :
     chr
    inEscape = false
    continue
   }
   switch (chr) {
    case '\\':
     inEscape = true
     break
    case "'":
     inString = false
     stringStartLoc = null
     flushPendingWord(true)
     break
    default:
     pendingWord += chr
   }
   continue
  }
  if (
   chr === '-' &&
   pendingWord.length === 0 &&
   text[i + 1] === '-' &&
   (i + 2 === length || text[i + 2] === ' ' || text[i + 2] === '\t' || text[i + 2] === '\n' || text[i + 2] === '\r')
  ) {
   const commentLoc = makeLoc(row, col)
   let start = i + 2
   if (text[start] === ' ') { start++ }
   let end = start
   while (end < length && text[end] !== '\n') { end++ }
   const commentText = text.slice(start, end).replace(/\r$/, '')
   if (pattern && sinceLastNewline.length > 0) {
    const line = sinceLastNewline
    sinceLastNewline = []
    flushPatternLine(pattern, line)
   }
   while (scope.autoBlock) { flushAutoBlock() }
   if (inPatternDefinition && scope === patternScope) {
    inPatternDefinition = false
    pattern = scope.block.splice(collectedPatternIndex)
    if (pattern.length === 0) {
     pattern = undefined
    }
    else {
     validateFieldScriptAst(pattern, { allowPatternPlaceholders: true, _limits: limits })
    }
   }
   countParseNode(commentLoc)
   const commentNode = [ '@', 'comment', commentText ]
   AST_LOC.set(commentNode, commentLoc)
   scope.block.push(commentNode)
   i = end
   if (end < length && text[end] === '\n') {
    row++
    col = -1
   }
   continue
  }
  switch (chr) {
   case "'":
    inString = true
    pendingWordStartRow = row
    pendingWordStartCol = col
    stringStartLoc = makeLoc(row, col)
    break
   case ';':
   case ':':
   case '!': {
    const isDeferred = chr === ':'
    const isInvoke = chr === '!'
    const blockLoc = makeLoc(row, col)
    flushPendingWord()
    const block = []
    scope.block.push(block)
    const autoScope = { block, autoBlock: true, isDeferred, isInvoke, loc: blockLoc }
    pushParserScope(autoScope, blockLoc)
    break
   }
   case '\n':
   case ',':
    if (chr === '\n') {
     row++
     col = -1
    }
    flushPendingWord()
    const line = sinceLastNewline
    sinceLastNewline = []
    while (scope.autoBlock) { flushAutoBlock() }
    if (inPatternDefinition) {
     if (scope === patternScope) {
      inPatternDefinition = false
      pattern = scope.block.splice(collectedPatternIndex)
      if (pattern.length === 0) {
       pattern = undefined
      }
      else {
       validateFieldScriptAst(pattern, { allowPatternPlaceholders: true, _limits: limits })
      }
     }
    }
    else if (pattern) {
     flushPatternLine(pattern, line)
    }
    break
   case ' ':
   case '\t':
   case '\r':
    flushPendingWord()
    break
   case '{':
   case '[':
   case '(': {
    const blockLoc = makeLoc(row, col)
    flushPendingWord()
    const isDeferred = chr === '('
    const isList = chr === '{'
    const inner = isDeferred ? [ 'will' ] : isList ? [ 'list' ] : []
    scope.block.push(inner)
    const branch = { block: inner, isDeferred, isList, loc: blockLoc }
    pushParserScope(branch, blockLoc)
    break
   }
   case '}':
   case ']':
   case ')': {
    const closeLoc = makeLoc(row, col)
    if (stack.length < 2) {
     const err = new SyntaxError(`no block is open, you are at output${info()}`)
     err.fieldLocation = closeLoc
     throw err
    }
    flushPendingWord()
    while (scope.autoBlock) { flushAutoBlock() }
    if (stack.length < 2) {
     const err = new SyntaxError(`no block is open, you are at output${info()}`)
     err.fieldLocation = closeLoc
     throw err
    }

    const expectedList = chr === '}'
    if (scope.isList ? !expectedList : expectedList) {
     const err = new SyntaxError(`Block end mismatch: got ${chr}, expected ${
      scope.isList ? '{}' : scope.isDeferred ? ')' : ']'
     }${info()}`)
     err.fieldLocation = closeLoc
     throw err
    }
    const expectedDeferred = chr === ')'
    if (scope.isDeferred ? !expectedDeferred : expectedDeferred) {
     const err = new SyntaxError(`Block end mismatch: got ${chr}, expected ${scope.isDeferred ? ')' : ']'}${info()}`)
     err.fieldLocation = closeLoc
     throw err
    }

    if (scope.block[0] === 'list') {
     scope.block.shift()
    }
    else if (
     !scope.isList &&
     !scope.isDeferred &&
     scope.block.length === 0
    ) {
     throw makeSyntaxError('Empty command block ([])', scope.loc)
    }
    else if (
     !scope.isList &&
     !scope.isDeferred &&
     scope.block.length === 1 &&
     Array.isArray(scope.block[0]) &&
     scope.block[0][0] === '@'
    ) {
     const innerLoc = AST_LOC.get(scope.block[0])
     scope.block.splice(0, 1, ...scope.block[0])
     if (innerLoc) {
      AST_LOC.set(scope.block, innerLoc)
     }
    }
    else {
     scope.block.unshift('@')
     if (scope.loc) {
      AST_LOC.set(scope.block, scope.loc)
     }
    }

    stack.pop()
    scope = stack[stack.length - 1]
    break
   }
   default:
    if (pendingWord.length === 0) {
     pendingWordStartRow = row
     pendingWordStartCol = col
    }
    pendingWord += chr
    break
  }
 }
 if (inString) {
  throw makeSyntaxError("Unterminated string literal (')", stringStartLoc)
 }
 flushPendingWord()
 while (scope.autoBlock) { flushAutoBlock() }
 if (stack.length > 1) {
  const openCh = scope.isList ? '{' : scope.isDeferred ? '(' : '['
  const closeCh = scope.isList ? '}' : scope.isDeferred ? ')' : ']'
  throw makeSyntaxError(`Unclosed block '${openCh}', expected '${closeCh}'`, scope.loc)
 }
 if (inPatternDefinition) {
  const unusedPattern = patternScope.block.splice(collectedPatternIndex)
  if (unusedPattern.length > 0) {
   validateFieldScriptAst(unusedPattern, { allowPatternPlaceholders: true, _limits: limits })
  }
 }
 else if (pattern && sinceLastNewline.length > 0) {
  flushPatternLine(pattern, sinceLastNewline)
 }
 validateFieldScriptAst(output, {
  _limits: limits,
  _nodeCounter: options && options._validateCounter ? options._validateCounter : undefined,
 })
 return output
}

export function validateFieldScriptLine(source, options = {}) {
 const text = source === null || source === undefined ? '' : String(source)
 const limits = options && options._limits ? options._limits : normalizeFieldLimits(options && options.limits, options)
 const filename = options && typeof options.filename === 'string' && options.filename.length > 0
  ? options.filename
  : undefined
 const rawIndex = options && Number.isInteger(options.lineIndex) && options.lineIndex >= 0
  ? options.lineIndex
  : 0
 if (exceedsUtf8Limit(text, limits.maxLineBytes)) {
  const loc = { filename, line: rawIndex + 1, col: 1, sourceLine: text }
  const err = makeLimitExceededError(`FieldScript line exceeds maximum (${limits.maxLineBytes} bytes)`, 'maxLineBytes', loc)
  return { ok: false, ast: null, error: err.message, location: loc }
 }
 if (text.trim().length === 0) {
  return { ok: true, ast: [], error: null, location: null }
 }
 try {
  const ast = parse(`${text}\n`, filename, rawIndex, { _limits: limits })
  return { ok: true, ast, error: null, location: null }
 }
 catch (err) {
  const message = err instanceof Error ? err.message : String(err)
  const location = err && typeof err === 'object' && err.fieldLocation ? err.fieldLocation : null
  return { ok: false, ast: null, error: message, location }
 }
}

export function isParseableFieldScriptLine(source, options = {}) {
 return validateFieldScriptLine(source, options).ok
}

export function validateFieldScriptLines(linesOrRecords, options = {}) {
 const list = Array.from(linesOrRecords || [])
 const limits = normalizeFieldLimits(options && options.limits, options)
 const filename = options && typeof options.filename === 'string' && options.filename.length > 0
  ? options.filename
  : undefined
 if (hasPositiveLimit(limits.maxScriptLines) && list.length > limits.maxScriptLines) {
  const err = makeLimitExceededError(`FieldScript line count exceeds maximum (${limits.maxScriptLines} lines)`, 'maxScriptLines')
  return {
   ok: false,
   error: err.message,
   errors: [{
    index: limits.maxScriptLines,
    lineNumber: limits.maxScriptLines + 1,
    lineId: '',
    source: '',
    error: err.message,
    location: null,
   }],
  }
 }
 const errors = []
 let totalBytes = 0
 for (let i = 0; i < list.length; i++) {
  const item = list[i]
  const isObj = item !== null && typeof item === 'object'
  const text = isObj
   ? (item.text === null || item.text === undefined ? '' : String(item.text))
   : (item === null || item === undefined ? '' : String(item))
  const lineId = isObj && typeof item.id === 'string' ? item.id : ''
  if (hasPositiveLimit(limits.maxScriptBytes)) {
   totalBytes += utf8ByteLengthField(text) + (i > 0 ? 1 : 0)
   if (totalBytes > limits.maxScriptBytes) {
    const loc = { filename, line: i + 1, col: 1, sourceLine: text }
    const msg = makeLimitExceededError(`FieldScript total size exceeds maximum (${limits.maxScriptBytes} bytes)`, 'maxScriptBytes', loc).message
    errors.push({
     index: i,
     lineNumber: i + 1,
     lineId,
     source: text,
     error: msg,
     location: loc,
    })
    break
   }
  }
  const res = validateFieldScriptLine(text, { filename, lineIndex: i, _limits: limits })
  if (!res.ok) {
   errors.push({
    index: i,
    lineNumber: i + 1,
    lineId,
    source: text,
    error: res.error,
    location: res.location,
   })
  }
 }
 if (errors.length === 0) {
  return { ok: true, error: null, errors: [] }
 }
 const first = errors[0]
 return {
  ok: false,
  error: `Invalid FieldScript on line ${first.lineNumber}: ${first.error}`,
  errors,
 }
}

export const PRIMITIVE_TYPES = ['string', 'number', 'boolean', 'null', 'undefined', 'secret']

export const SECRET_MASK = '••••••••'

export function createMaskedSecretValue(name = '', secretSet = true) {
 const obj = {}
 Object.defineProperties(obj, {
  __ccSecret: { value: true, enumerable: false },
  name: { value: String(name || ''), enumerable: false },
  secretSet: { value: Boolean(secretSet), enumerable: false },
  toJSON: {
   value() {
    return secretSet ? SECRET_MASK : '(unset secret)'
   },
   enumerable: false,
  },
  toString: {
   value() {
    return secretSet ? SECRET_MASK : '(unset secret)'
   },
   enumerable: false,
  },
 })
 return Object.freeze(obj)
}

export function isMaskedSecretValue(value) {
 return Boolean(value && typeof value === 'object' && value.__ccSecret === true)
}

export function normalizeSecretValues(secretValues) {
 if (!Array.isArray(secretValues)) {
  return []
 }
 const unique = new Set()
 for (const item of secretValues) {
  if (typeof item === 'string' && item.length > 0) {
   unique.add(item)
   const trimmed = item.trim()
   if (trimmed.length > 0) {
    unique.add(trimmed)
   }
  }
 }
 return [...unique].sort((a, b) => b.length - a.length)
}

export function redactSecretText(text, secretValues) {
 if (typeof text !== 'string' || text.length === 0) {
  return text
 }
 const list = normalizeSecretValues(secretValues)
 if (list.length === 0) {
  return text
 }
 let out = text
 for (const secret of list) {
  if (out.includes(secret)) {
   out = out.split(secret).join(SECRET_MASK)
  }
  const jsonEscaped = JSON.stringify(secret).slice(1, -1)
  if (jsonEscaped && jsonEscaped !== secret && out.includes(jsonEscaped)) {
   out = out.split(jsonEscaped).join(SECRET_MASK)
  }
 }
 return out
}

export function redactSecretValue(value, secretValues, seen = new WeakMap()) {
 const list = normalizeSecretValues(secretValues)
 if (list.length === 0 || value === null || value === undefined) {
  return value
 }
 if (typeof value === 'string') {
  return redactSecretText(value, list)
 }
 if (typeof value !== 'object' || isMaskedSecretValue(value) || isDomElement(value)) {
  return value
 }
 if (seen.has(value)) {
  return seen.get(value)
 }
 if (Array.isArray(value)) {
  const clone = []
  seen.set(value, clone)
  for (let i = 0; i < value.length; i++) {
   clone.push(redactSecretValue(value[i], list, seen))
  }
  return clone
 }
 if (isPlainObject(value)) {
  const clone = {}
  seen.set(value, clone)
  for (const key of Object.keys(value)) {
   clone[key] = redactSecretValue(value[key], list, seen)
  }
  return clone
 }
 return value
}

export const LANE_TABS = ['story', 'source', 'input', 'scope', 'data', 'view', 'server']
export const DEFAULT_LANE_TAB = 'source'

export const LANE_FEATURES = ['httpServer', 'runEvery30Minutes']
export const LANE_CRON_INTERVAL_MS = 30 * 60 * 1000

export function normalizeLaneFeatures(raw) {
 if (typeof raw === 'string') {
  return parseLaneFeatures(raw)
 }
 if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
  return { httpServer: false, runEvery30Minutes: false }
 }
 return {
  httpServer: Boolean(raw.httpServer),
  runEvery30Minutes: Boolean(raw.runEvery30Minutes || raw.cron30m || raw.runEvery30m),
 }
}

export function parseLaneFeatures(raw) {
 if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
  return normalizeLaneFeatures(raw)
 }
 if (typeof raw !== 'string') {
  return { httpServer: false, runEvery30Minutes: false }
 }
 const trimmed = raw.trim()
 if (!trimmed) {
  return { httpServer: false, runEvery30Minutes: false }
 }
 try {
  const parsed = JSON.parse(trimmed)
  return normalizeLaneFeatures(parsed)
 }
 catch {
  return { httpServer: false, runEvery30Minutes: false }
 }
}

export function normalizeLaneTab(tab) {
 if (typeof tab === 'string') {
  const lower = tab.trim().toLowerCase()
  if (LANE_TABS.includes(lower)) {
   return lower
  }
 }
 return DEFAULT_LANE_TAB
}

export function parseLanePath(rawPath) {
 if (typeof rawPath !== 'string') {
  return null
 }
 const trimmed = rawPath.trim().replace(/^\/+|\/+$/g, '')
 if (trimmed.length === 0) {
  return null
 }
 let sepIdx = -1
 for (let i = 0; i < trimmed.length; i++) {
  const ch = trimmed[i]
  if (ch === '/' || ch === '|') {
   sepIdx = i
   break
  }
 }
 if (sepIdx === -1) {
  const tab = trimmed.toLowerCase()
  return LANE_TABS.includes(tab) ? { tab, subroute: '' } : null
 }
 const tab = trimmed.slice(0, sepIdx).trim().toLowerCase()
 if (!LANE_TABS.includes(tab)) {
  return null
 }
 const rest = trimmed.slice(sepIdx + 1)
 const subroute = tab === 'data' && rest.length > 0 ? rest : ''
 return { tab, subroute }
}

export function formatLanePath(tab, subroute = '') {
 let rawTab = tab
 let rawSub = subroute
 if (tab && typeof tab === 'object') {
  rawTab = tab.tab
  rawSub = tab.subroute
 }
 if (typeof rawTab !== 'string') {
  return ''
 }
 const normalizedTab = rawTab.trim().toLowerCase()
 if (!LANE_TABS.includes(normalizedTab)) {
  return ''
 }
 if (normalizedTab === 'data') {
  const sub = typeof rawSub === 'string' ? rawSub : ''
  return sub.length > 0 ? `data/${sub}` : 'data'
 }
 return normalizedTab
}

export function normalizeLanePath(rawPath) {
 const parsed = parseLanePath(rawPath)
 return parsed ? formatLanePath(parsed.tab, parsed.subroute) : null
}

function safeDecodeURIComponent(value) {
 try {
  return decodeURIComponent(value)
 }
 catch {
  return value
 }
}

function parseTabAndSubroute(rawTab) {
 const raw = String(rawTab ?? '')
 const pipeIdx = raw.indexOf('|')
 if (pipeIdx !== -1) {
  const tab = normalizeLaneTab(safeDecodeURIComponent(raw.slice(0, pipeIdx)))
  const subroute = safeDecodeURIComponent(raw.slice(pipeIdx + 1))
  return { tab, subroute: tab === 'data' && subroute.length > 0 ? subroute : '' }
 }
 const encodedPipe = /^(.*)%7[cC](.*)$/.exec(raw)
 if (encodedPipe) {
  const tab = normalizeLaneTab(safeDecodeURIComponent(encodedPipe[1]))
  const subroute = safeDecodeURIComponent(encodedPipe[2])
  return { tab, subroute: tab === 'data' && subroute.length > 0 ? subroute : '' }
 }
 return { tab: normalizeLaneTab(safeDecodeURIComponent(raw)), subroute: '' }
}

export function parseLaneRouteSegment(segment) {
 if (typeof segment !== 'string' || segment.length === 0) {
  return null
 }
 const semiIdx = segment.lastIndexOf(';')
 if (semiIdx !== -1) {
  const rawId = segment.slice(0, semiIdx)
  const rawTab = segment.slice(semiIdx + 1)
  const id = safeDecodeURIComponent(rawId)
  if (id.length === 0) {
   return null
  }
  const { tab, subroute } = parseTabAndSubroute(rawTab)
  return subroute ? { id, tab, subroute } : { id, tab }
 }
 const encodedMatch = /^(.*)%3[bB]([^%]*)$/.exec(segment)
 if (encodedMatch) {
  const { tab, subroute } = parseTabAndSubroute(encodedMatch[2])
  const candidateTab = encodedMatch[2].split('|')[0].trim().toLowerCase()
  if (LANE_TABS.includes(candidateTab)) {
   const id = safeDecodeURIComponent(encodedMatch[1])
   if (id.length > 0) {
    return subroute ? { id, tab, subroute } : { id, tab }
   }
  }
 }
 const id = safeDecodeURIComponent(segment)
 if (id.length === 0) {
  return null
 }
 return {
  id,
  tab: DEFAULT_LANE_TAB,
 }
}

export function parseLaneRoutes(pathname) {
 if (typeof pathname !== 'string' || pathname.length === 0) {
  return []
 }
 const clean = pathname.split('?')[0].split('#')[0]
 const segments = clean.split('/').filter(Boolean)
 const routes = []
 for (const seg of segments) {
  const parsed = parseLaneRouteSegment(seg)
  if (parsed) {
   routes.push(parsed)
  }
 }
 return routes
}

export function formatLaneRouteSegment(id, tab = DEFAULT_LANE_TAB, subroute = '') {
 const encodedId = encodeURIComponent(String(id ?? ''))
 const normalizedTab = normalizeLaneTab(tab)
 if (normalizedTab === DEFAULT_LANE_TAB) {
  return encodedId
 }
 if (normalizedTab === 'data' && typeof subroute === 'string' && subroute.length > 0) {
  return `${encodedId};data|${encodeURIComponent(subroute)}`
 }
 return `${encodedId};${normalizedTab}`
}

function getLaneDataSubroute(item) {
 const dv = item.notebook && item.notebook['data-view']
 if (dv && Array.isArray(dv.tables) && dv['active-table-id']) {
  const active = dv.tables.find(tbl => tbl && tbl.id === dv['active-table-id'])
  if (active && typeof active.name === 'string' && active.name.length > 0) {
   return active.name
  }
 }
 return typeof item.subroute === 'string' ? item.subroute : ''
}

export function formatLaneRoutes(lanes) {
 if (!Array.isArray(lanes) || lanes.length === 0) {
  return '/'
 }
 const segments = []
 for (const item of lanes) {
  if (typeof item === 'string') {
   if (item.length > 0) {
    segments.push(formatLaneRouteSegment(item, DEFAULT_LANE_TAB))
   }
   continue
  }
  if (!item || typeof item !== 'object' || !item.id) {
   continue
  }
  const tab = item.notebook && typeof item.notebook['active-tab'] === 'string'
   ? item.notebook['active-tab']
   : item.tab
  const subroute = normalizeLaneTab(tab) === 'data' ? getLaneDataSubroute(item) : ''
  segments.push(formatLaneRouteSegment(item.id, tab, subroute))
 }
 return `/${segments.join('/')}`
}

const UNSAFE_HASH_KEYS = new Set(['__proto__', 'constructor', 'prototype'])

function isPlainObject(value) {
 if (value === null || typeof value !== 'object' || Array.isArray(value)) {
  return false
 }
 const proto = Object.getPrototypeOf(value)
 return proto === Object.prototype || proto === null
}

function parseHashOptionValue(rawValue) {
 const decoded = safeDecodeURIComponent(rawValue)
 if (/^-?\d+(?:\.\d+)?$/.test(decoded)) {
  const num = Number(decoded)
  if (Number.isFinite(num)) {
   return num
  }
 }
 if (decoded === 'true') {
  return true
 }
 if (decoded === 'false') {
  return false
 }
 if (decoded === 'null') {
  return null
 }
 return decoded
}

export function parseHashOptions(hash) {
 const result = {}
 if (typeof hash !== 'string') {
  return result
 }
 const trimmed = hash.trim()
 const raw = trimmed.startsWith('#') ? trimmed.slice(1) : trimmed
 if (raw.length === 0) {
  return result
 }
 for (const part of raw.split('&')) {
  if (part.length === 0) {
   continue
  }
  const eqIdx = part.indexOf('=')
  const rawKey = eqIdx === -1 ? part : part.slice(0, eqIdx)
  const key = safeDecodeURIComponent(rawKey)
  if (key.length === 0) {
   continue
  }
  const segments = key.split('.').filter(Boolean)
  if (segments.length === 0 || segments.some(seg => UNSAFE_HASH_KEYS.has(seg))) {
   continue
  }
  const value = eqIdx === -1 ? true : parseHashOptionValue(part.slice(eqIdx + 1))
  let cursor = result
  for (let i = 0; i < segments.length - 1; i++) {
   const seg = segments[i]
   if (!isPlainObject(cursor[seg])) {
    cursor[seg] = {}
   }
   cursor = cursor[seg]
  }
  cursor[segments[segments.length - 1]] = value
 }
 return result
}

function collectHashOptionPairs(obj, prefix, pairs) {
 for (const key of Object.keys(obj)) {
  if (UNSAFE_HASH_KEYS.has(key)) {
   continue
  }
  const value = obj[key]
  if (value === undefined) {
   continue
  }
  const path = prefix.length > 0 ? `${prefix}.${encodeURIComponent(key)}` : encodeURIComponent(key)
  if (isPlainObject(value)) {
   collectHashOptionPairs(value, path, pairs)
  }
  else {
   pairs.push(`${path}=${encodeURIComponent(String(value))}`)
  }
 }
}

export function formatHashOptions(options) {
 if (!isPlainObject(options)) {
  return ''
 }
 const pairs = []
 collectHashOptionPairs(options, '', pairs)
 return pairs.length > 0 ? `#${pairs.join('&')}` : ''
}

export function normalizePrimitiveType(type) {
 return PRIMITIVE_TYPES.includes(type) ? type : 'string'
}

export function defaultValueForType(type) {
 switch (type) {
  case 'number':
   return 0
  case 'boolean':
   return false
  case 'null':
   return null
  case 'undefined':
   return undefined
  case 'string':
  default:
   return ''
 }
}

export const DATA_COLUMN_TYPES = [
 'integer',
 'decimal',
 'fixed',
 'text',
 'boolean',
 'date',
 'datetime',
 'url',
 'email',
 'json',
 'row',
 'lane',
]

export const DATA_CONSTRAINT_TYPES = [
 'workflow',
]

export const TABLE_IMPORT_MODES = Object.freeze(['read-only', 'read-write'])

export function normalizeTableImportMode(raw) {
 const trimmed = typeof raw === 'string' ? raw.trim().toLowerCase() : ''
 if (trimmed === 'read-write' || trimmed === 'readwrite' || trimmed === 'rw') {
  return 'read-write'
 }
 return 'read-only'
}

export function normalizeTableRemoteSpec(raw, { includeRuntimeStatus = false } = {}) {
 if (!raw || typeof raw !== 'object') {
  return null
 }
 const laneId = raw.laneId === null || raw.laneId === undefined ? '' : String(raw.laneId).trim()
 const tableId = raw.tableId === null || raw.tableId === undefined ? '' : String(raw.tableId).trim()
 if (!laneId || !tableId) {
  return null
 }
 const tableName = raw.tableName === null || raw.tableName === undefined ? '' : String(raw.tableName)
 const mode = normalizeTableImportMode(raw.mode)
 const out = {
  laneId,
  tableId,
  tableName,
  mode,
 }
 if (raw.customName === true) {
  out.customName = true
 }
 if (includeRuntimeStatus) {
  if (typeof raw.missing === 'boolean') {
   out.missing = raw.missing
  }
  if (typeof raw.accessDenied === 'boolean') {
   out.accessDenied = raw.accessDenied
  }
 }
 return out
}

export function isRemoteTable(table) {
 return Boolean(
  table &&
  typeof table === 'object' &&
  table.remote &&
  typeof table.remote === 'object' &&
  typeof table.remote.laneId === 'string' &&
  table.remote.laneId.trim().length > 0 &&
  typeof table.remote.tableId === 'string' &&
  table.remote.tableId.trim().length > 0
 )
}

export function isReadOnlyRemoteTable(table) {
 return Boolean(
  isRemoteTable(table) &&
  (table.remote.mode !== 'read-write' || table.remote.missing === true || table.remote.accessDenied === true)
 )
}

export const DEFAULT_FIXED_DECIMALS = 2
export const DEFAULT_ROW_PICKER_PAGE_SIZE = 25
export const MIN_LANE_WIDTH = 100
export const MIN_LANE_MODAL_WIDTH = 480
export const MIN_LANE_MODAL_HEIGHT = 420

export function normalizeLaneWidth(width) {
 if (width === null || width === undefined) {
  return null
 }
 if (typeof width === 'number') {
  if (!Number.isFinite(width) || width < 0) {
   return null
  }
  return Math.round(width)
 }
 const trimmed = String(width).trim()
 if (trimmed.length === 0) {
  return null
 }
 const stripped = trimmed.replace(/px$/i, '').trim()
 if (stripped.length === 0) {
  return null
 }
 const num = Number(stripped)
 if (!Number.isFinite(num) || num < 0) {
  return null
 }
 return Math.round(num)
}

export function resolveLaneRenderedWidth(width) {
 const normalized = normalizeLaneWidth(width)
 if (normalized === null) {
  return null
 }
 return Math.max(MIN_LANE_WIDTH, normalized)
}

export const LANE_MINIMIZE_SIDES = ['left', 'right']

export function normalizeLaneMinimizeSide(side) {
 if (typeof side === 'string') {
  const lower = side.trim().toLowerCase()
  if (lower === 'left' || lower === 'right') {
   return lower
  }
 }
 return null
}

export function getLaneInitial(title, fallback = '') {
 const raw = typeof title === 'string' ? title.trim() : ''
 const source = raw.length > 0 ? raw : (typeof fallback === 'string' ? fallback.trim() : '')
 if (source.length === 0) {
  return '?'
 }
 const chars = Array.from(source)
 return chars[0].toUpperCase()
}

export const LANE_SCROLL_LEFT_MARGIN = 48
export const LANE_SCROLL_RIGHT_MARGIN = 96
export const LANE_SCROLL_TOP_MARGIN = 48
export const LANE_SCROLL_BOTTOM_MARGIN = 64

export function computeLaneScrollLeft(
 currentScrollLeft,
 viewportWidth,
 laneLeft,
 laneRight,
 leftMargin = LANE_SCROLL_LEFT_MARGIN,
 rightMargin = LANE_SCROLL_RIGHT_MARGIN
) {
 if (
  !Number.isFinite(viewportWidth) ||
  viewportWidth <= 0 ||
  !Number.isFinite(laneLeft) ||
  !Number.isFinite(laneRight) ||
  laneRight <= laneLeft
 ) {
  return null
 }
 const cur = Number.isFinite(currentScrollLeft) ? currentScrollLeft : 0
 const laneWidth = laneRight - laneLeft
 const absLeft = cur + laneLeft
 const absRight = cur + laneRight
 const visibleLeft = Math.max(0, Number.isFinite(leftMargin) ? leftMargin : LANE_SCROLL_LEFT_MARGIN)
 const visibleRight = viewportWidth - Math.max(0, Number.isFinite(rightMargin) ? rightMargin : LANE_SCROLL_RIGHT_MARGIN)
 const usableWidth = visibleRight - visibleLeft
 let target = null
 if (usableWidth > 0 && laneWidth <= usableWidth) {
  if (laneLeft >= visibleLeft && laneRight <= visibleRight) {
   return null
  }
  target = laneRight > visibleRight
   ? Math.max(0, Math.round(absRight - visibleRight))
   : Math.max(0, Math.round(absLeft - visibleLeft))
 }
 else if (laneWidth <= viewportWidth - 64) {
  const pad = Math.floor((viewportWidth - laneWidth) / 2)
  target = Math.max(0, Math.round(absLeft - pad))
 }
 else {
  target = Math.max(0, Math.round(absLeft - visibleLeft))
 }
 return target === Math.round(cur) ? null : target
}

export function computeLaneScrollTop(
 currentScrollTop,
 viewportHeight,
 targetTop,
 targetBottom,
 topMargin = LANE_SCROLL_TOP_MARGIN,
 bottomMargin = LANE_SCROLL_BOTTOM_MARGIN
) {
 if (
  !Number.isFinite(viewportHeight) ||
  viewportHeight <= 0 ||
  !Number.isFinite(targetTop) ||
  !Number.isFinite(targetBottom) ||
  targetBottom < targetTop
 ) {
  return null
 }
 const cur = Number.isFinite(currentScrollTop) ? currentScrollTop : 0
 const targetHeight = Math.max(0, targetBottom - targetTop)
 const absTop = cur + targetTop
 const visibleTop = Math.max(0, Number.isFinite(topMargin) ? topMargin : LANE_SCROLL_TOP_MARGIN)
 const visibleBottom = viewportHeight - Math.max(0, Number.isFinite(bottomMargin) ? bottomMargin : LANE_SCROLL_BOTTOM_MARGIN)
 if (visibleBottom > visibleTop && targetTop >= visibleTop && targetBottom <= visibleBottom) {
  return null
 }
 const usableHeight = Math.max(0, visibleBottom - visibleTop)
 let target
 if (usableHeight > 0 && targetHeight <= usableHeight) {
  const centerOffset = visibleTop + Math.floor((usableHeight - targetHeight) / 2)
  target = Math.max(0, Math.round(absTop - centerOffset))
 }
 else {
  target = Math.max(0, Math.round(absTop - visibleTop))
 }
 return target === Math.round(cur) ? null : target
}

export const DEFAULT_SCROLLBAR_COLOR = '#383838'

const SCROLLBAR_COLOR_KEYWORDS = new Set(['auto', 'inherit', 'initial', 'unset', 'revert', 'revert-layer'])

function splitTopLevelCssTokens(str) {
 const tokens = []
 let depth = 0
 let quote = ''
 let start = -1
 for (let i = 0; i < str.length; i++) {
  const ch = str[i]
  if (quote) {
   if (ch === '\\' && i + 1 < str.length) {
    i += 1
    continue
   }
   if (ch === quote) {
    quote = ''
   }
   continue
  }
  if (ch === '"' || ch === "'") {
   if (start === -1) {
    start = i
   }
   quote = ch
   continue
  }
  if (ch === '(') {
   if (start === -1) {
    start = i
   }
   depth += 1
   continue
  }
  if (ch === ')') {
   if (depth > 0) {
    depth -= 1
   }
   continue
  }
  if (depth === 0 && /\s/.test(ch)) {
   if (start !== -1) {
    tokens.push(str.slice(start, i))
    start = -1
   }
   continue
  }
  if (start === -1) {
   start = i
  }
 }
 if (start !== -1) {
  tokens.push(str.slice(start))
 }
 return tokens
}

export function resolveScrollbarColor(rawColor, fallbackColor = DEFAULT_SCROLLBAR_COLOR) {
 const fallback = typeof fallbackColor === 'string' && fallbackColor.trim().length > 0
  ? fallbackColor.trim()
  : DEFAULT_SCROLLBAR_COLOR
 const raw = rawColor === null || rawColor === undefined ? '' : String(rawColor).trim()
 const color = raw.length > 0 ? raw : fallback
 const lower = color.toLowerCase()
 if (SCROLLBAR_COLOR_KEYWORDS.has(lower)) {
  return { color, css: lower, thumb: '', track: '' }
 }
 const tokens = splitTopLevelCssTokens(color)
 if (tokens.length === 1) {
  return { color, css: `${tokens[0]} transparent`, thumb: tokens[0], track: 'transparent' }
 }
 if (tokens.length >= 2) {
  return { color, css: color, thumb: tokens[0], track: tokens.slice(1).join(' ') }
 }
 return { color: fallback, css: `${fallback} transparent`, thumb: fallback, track: 'transparent' }
}

function objectAstHasKey(node, keyName) {
 if (!Array.isArray(node) || node[0] !== '@' || node[1] !== 'object') {
  return false
 }
 for (let i = 2; i < node.length; i++) {
  const pair = node[i]
  if (pair === keyName || (Array.isArray(pair) && pair[0] === keyName)) {
   return true
  }
 }
 return false
}

function inspectInterfaceAstNode(node, info) {
 if (!Array.isArray(node) || isCommentNode(node)) {
  return
 }
 if (node[0] === '@') {
  const cmd = node[1]
  if (cmd === 'to' && node.length >= 4) {
   const targets = node.slice(2, -1)
   const valNode = node[node.length - 1]
   if (typeof targets[0] === 'string') {
    const segs = [ ...targets[0].split('.'), ...targets.slice(1).filter(s => typeof s === 'string') ]
    if (segs[0] === 'interface') {
     info.touchesInterface = true
     if (segs.length === 1) {
      info.definesInterface = true
      if (objectAstHasKey(valNode, 'scrollbarColor')) {
       info.hasScrollbarColor = true
      }
     }
     else if (segs[1] === 'scrollbarColor') {
      info.hasScrollbarColor = true
     }
    }
   }
  }
  else if (cmd === 'set' && node.length >= 4) {
   const valNode = node[2]
   const targets = node.slice(3)
   if (typeof targets[0] === 'string') {
    const segs = [ ...targets[0].split('.'), ...targets.slice(1).filter(s => typeof s === 'string') ]
    if (segs[0] === 'interface') {
     info.touchesInterface = true
     if (segs.length === 1) {
      info.definesInterface = true
      if (objectAstHasKey(valNode, 'scrollbarColor')) {
       info.hasScrollbarColor = true
      }
     }
     else if (segs[1] === 'scrollbarColor') {
      info.hasScrollbarColor = true
     }
    }
   }
  }
  else if (cmd === 'assign' && node.length >= 3) {
   const target = node[2]
   const isInterfaceTarget = target === 'interface' || (
    Array.isArray(target) &&
    target.length === 3 &&
    target[0] === '@' &&
    target[1] === 'get' &&
    target[2] === 'interface'
   )
   if (isInterfaceTarget) {
    info.touchesInterface = true
    for (let i = 3; i < node.length; i++) {
     const pair = node[i]
     if (Array.isArray(pair) && pair[0] === 'scrollbarColor') {
      info.hasScrollbarColor = true
     }
    }
   }
  }
 }
 for (let i = 0; i < node.length; i++) {
  if (Array.isArray(node[i])) {
   inspectInterfaceAstNode(node[i], info)
  }
 }
}

let seedFallbackLineSeq = 0
function makeSeedLineId(createId) {
 if (typeof createId === 'function') {
  const generated = createId()
  if (typeof generated === 'string' && generated.length > 0) {
   return generated
  }
 }
 const c = globalThis.crypto
 if (c && typeof c.randomUUID === 'function') {
  return `ln-${c.randomUUID()}`
 }
 seedFallbackLineSeq += 1
 return `ln-seed-${Date.now()}-${seedFallbackLineSeq}`
}

export function seedPreferencesScrollbarRecords(records, defaultScrollbarColor = DEFAULT_SCROLLBAR_COLOR, createId = null) {
 const rawList = Array.isArray(records) ? records : []
 const normalized = rawList.map(item => {
  if (item && typeof item === 'object') {
   return {
    ...item,
    id: typeof item.id === 'string' && item.id.length > 0 ? item.id : makeSeedLineId(createId),
    text: item.text === null || item.text === undefined ? '' : String(item.text),
    updatedAt: typeof item.updatedAt === 'string' && item.updatedAt.length > 0 ? item.updatedAt : null,
   }
  }
  return {
   id: makeSeedLineId(createId),
   text: item === null || item === undefined ? '' : String(item),
   updatedAt: null,
  }
 })

 let hasScrollbarColor = false
 let definesInterface = false
 let firstInterfaceIdx = -1
 let lastInterfaceIdx = -1
 let lastNonEmptyIdx = -1

 for (let i = 0; i < normalized.length; i++) {
  const text = normalized[i].text
  if (text.trim().length > 0) {
   lastNonEmptyIdx = i
  }
  if (/\binterface\.scrollbarColor\b/.test(text)) {
   hasScrollbarColor = true
  }
  const lineInfo = {
   hasScrollbarColor: false,
   definesInterface: false,
   touchesInterface: false,
  }
  try {
   const ast = parse(`${text}\n`)
   inspectInterfaceAstNode(ast, lineInfo)
  }
  catch {
   // ignore syntax errors in user script lines
  }
  if (lineInfo.hasScrollbarColor) {
   hasScrollbarColor = true
  }
  if (lineInfo.definesInterface) {
   definesInterface = true
  }
  if (lineInfo.definesInterface || lineInfo.touchesInterface) {
   if (firstInterfaceIdx === -1) {
    firstInterfaceIdx = i
   }
   lastInterfaceIdx = i
  }
 }

 if (hasScrollbarColor) {
  return {
   seeded: false,
   records: normalized,
   lines: normalized.map(r => r.text),
  }
 }

 const color = typeof defaultScrollbarColor === 'string' && defaultScrollbarColor.trim().length > 0
  ? defaultScrollbarColor.trim()
  : DEFAULT_SCROLLBAR_COLOR
 const ifaceLine = '; to interface ; object'
 const sbLine = `; to interface.scrollbarColor ${color}`

 if (lastNonEmptyIdx === -1) {
  const firstId = normalized.length > 0 ? normalized[0].id : makeSeedLineId(createId)
  const nextRecords = [
   { id: firstId, text: ifaceLine, updatedAt: null },
   { id: makeSeedLineId(createId), text: sbLine, updatedAt: null },
  ]
  return {
   seeded: true,
   records: nextRecords,
   lines: nextRecords.map(r => r.text),
  }
 }

 const nextRecords = normalized.slice()
 if (definesInterface) {
  nextRecords.splice(lastInterfaceIdx + 1, 0, {
   id: makeSeedLineId(createId),
   text: sbLine,
   updatedAt: null,
  })
 }
 else if (firstInterfaceIdx !== -1) {
  nextRecords.splice(firstInterfaceIdx, 0, {
   id: makeSeedLineId(createId),
   text: ifaceLine,
   updatedAt: null,
  })
  nextRecords.splice(lastInterfaceIdx + 2, 0, {
   id: makeSeedLineId(createId),
   text: sbLine,
   updatedAt: null,
  })
 }
 else {
  nextRecords.splice(
   lastNonEmptyIdx + 1,
   0,
   { id: makeSeedLineId(createId), text: ifaceLine, updatedAt: null },
   { id: makeSeedLineId(createId), text: sbLine, updatedAt: null }
  )
 }

 return {
  seeded: true,
  records: nextRecords,
  lines: nextRecords.map(r => r.text),
 }
}

export function seedPreferencesScrollbarSource(lines, defaultScrollbarColor = DEFAULT_SCROLLBAR_COLOR) {
 const list = Array.isArray(lines) ? lines : []
 const outcome = seedPreferencesScrollbarRecords(list, defaultScrollbarColor)
 return {
  seeded: outcome.seeded,
  lines: outcome.lines,
 }
}

export const MIN_COLUMN_WIDTH = 48
export const MAX_COLUMN_WIDTH = 1200
const MAX_FIXED_DECIMALS = 12
const MAX_SAFE_BIGINT = BigInt(Number.MAX_SAFE_INTEGER)
const MIN_SAFE_BIGINT = BigInt(Number.MIN_SAFE_INTEGER)

export function normalizeColumnWidth(width) {
 if (width === null || width === undefined || width === '') {
  return null
 }
 const num = typeof width === 'number' ? width : Number(String(width).replace(/px$/i, '').trim())
 if (!Number.isFinite(num) || num <= 0) {
  return null
 }
 return Math.min(MAX_COLUMN_WIDTH, Math.max(MIN_COLUMN_WIDTH, Math.round(num)))
}

export function normalizeFixedDecimals(decimals) {
 if (decimals === null || decimals === undefined || decimals === '') {
  return DEFAULT_FIXED_DECIMALS
 }
 if (typeof decimals === 'number') {
  if (!Number.isFinite(decimals)) {
   return DEFAULT_FIXED_DECIMALS
  }
  const n = Math.trunc(decimals)
  return Math.min(MAX_FIXED_DECIMALS, Math.max(0, n))
 }
 const trimmed = String(decimals).trim()
 if (!/^\d+$/.test(trimmed)) {
  return DEFAULT_FIXED_DECIMALS
 }
 const n = Number(trimmed)
 if (!Number.isFinite(n)) {
  return DEFAULT_FIXED_DECIMALS
 }
 return Math.min(MAX_FIXED_DECIMALS, Math.max(0, n))
}

function parseTypeString(raw) {
 const str = typeof raw === 'string' ? raw.trim() : ''
 const isArr = str.endsWith('[]')
 const body = isArr ? str.slice(0, -2) : str
 const fixedMatch = /^fixed\((\d+)\)$/.exec(body)
 if (fixedMatch) {
  return {
   type: 'fixed',
   multiple: isArr,
   decimals: normalizeFixedDecimals(fixedMatch[1]),
   hasDecimals: true,
  }
 }
 return {
  type: DATA_COLUMN_TYPES.includes(body) ? body : 'text',
  multiple: isArr,
  decimals: undefined,
  hasDecimals: false,
 }
}

function numberToPlainDecimalString(num) {
 const str = String(num)
 if (!/[eE]/.test(str)) {
  return str
 }
 const neg = str.startsWith('-')
 const unsigned = neg ? str.slice(1) : str
 const [coeff, expStr] = unsigned.split(/[eE]/)
 const exp = Number(expStr)
 const [intPart, fracPart = ''] = coeff.split('.')
 const digits = intPart + fracPart
 const pointPos = intPart.length + exp
 let out
 if (pointPos <= 0) {
  out = `0.${'0'.repeat(-pointPos)}${digits}`
 }
 else if (pointPos >= digits.length) {
  out = digits + '0'.repeat(pointPos - digits.length)
 }
 else {
  out = `${digits.slice(0, pointPos)}.${digits.slice(pointPos)}`
 }
 return neg ? `-${out}` : out
}

function scaleDecimalStringToFixed(rawStr, decimals, { allowRounding = false } = {}) {
 const dec = normalizeFixedDecimals(decimals)
 const trimmed = String(rawStr).trim()
 if (trimmed === '') {
  return { ok: true, value: null, error: null }
 }
 if (dec === 0 && !allowRounding) {
  if (!/^[+-]?\d+$/.test(trimmed)) {
   return { ok: false, value: null, error: 'Must be a whole number (0 decimal places)' }
  }
  const big = BigInt(trimmed)
  if (big > MAX_SAFE_BIGINT || big < MIN_SAFE_BIGINT) {
   return { ok: false, value: null, error: 'Value out of safe range' }
  }
  const num = Number(big)
  return { ok: true, value: num === 0 ? 0 : num, error: null }
 }
 const match = /^([+-]?)(?:(\d+)(?:\.(\d*))?|\.(\d+))$/.exec(trimmed)
 if (!match) {
  const unit = dec === 1 ? 'place' : 'places'
  return {
   ok: false,
   value: null,
   error: dec === 0 ? 'Must be a whole number (0 decimal places)' : `Must be a fixed-point number (up to ${dec} decimal ${unit})`,
  }
 }
 const neg = match[1] === '-'
 const intPart = match[2] ?? '0'
 const fracPart = match[3] ?? match[4] ?? ''
 if (!allowRounding && fracPart.length > dec) {
  const unit = dec === 1 ? 'place' : 'places'
  return { ok: false, value: null, error: `At most ${dec} decimal ${unit} allowed` }
 }
 let keptFrac
 let roundUp = false
 if (fracPart.length > dec) {
  keptFrac = fracPart.slice(0, dec)
  roundUp = Number(fracPart[dec]) >= 5
 }
 else {
  keptFrac = fracPart.padEnd(dec, '0')
 }
 const combined = `${intPart}${keptFrac}`.replace(/^0+(?=\d)/, '') || '0'
 let big = BigInt(combined)
 if (roundUp) {
  big += 1n
 }
 const signedBig = neg ? -big : big
 if (signedBig > MAX_SAFE_BIGINT || signedBig < MIN_SAFE_BIGINT) {
  return { ok: false, value: null, error: 'Value out of safe range' }
 }
 const value = Number(signedBig)
 return { ok: true, value: value === 0 ? 0 : value, error: null }
}

function formatFixedInteger(value, decimals) {
 if (value === null || value === undefined) {
  return ''
 }
 const num = typeof value === 'number' ? value : Number(value)
 if (!Number.isFinite(num)) {
  return ''
 }
 const intVal = Math.trunc(num)
 const dec = normalizeFixedDecimals(decimals)
 if (dec === 0) {
  return String(intVal === 0 ? 0 : intVal)
 }
 const neg = intVal < 0
 const digits = String(Math.abs(intVal)).padStart(dec + 1, '0')
 const splitAt = digits.length - dec
 const formatted = `${digits.slice(0, splitAt)}.${digits.slice(splitAt)}`
 return neg ? `-${formatted}` : formatted
}

function rescaleFixedInteger(value, fromDecimals, toDecimals) {
 if (value === null || value === undefined || value === '') {
  return null
 }
 const num = typeof value === 'number' ? value : Number(value)
 if (!Number.isFinite(num)) {
  return null
 }
 const intVal = Math.trunc(num)
 const fromDec = normalizeFixedDecimals(fromDecimals)
 const toDec = normalizeFixedDecimals(toDecimals)
 if (fromDec === toDec) {
  return Number.isSafeInteger(intVal) ? (intVal === 0 ? 0 : intVal) : null
 }
 const formatted = formatFixedInteger(intVal, fromDec)
 const scaled = scaleDecimalStringToFixed(formatted, toDec, { allowRounding: true })
 return scaled.ok ? scaled.value : null
}

export function normalizeDataColumnType(type) {
 if (typeof type === 'string') {
  return parseTypeString(type).type
 }
 if (type && typeof type === 'object' && typeof type.type === 'string') {
  return parseTypeString(type.type).type
 }
 return 'text'
}

export function normalizeColumnConstraint(constraint) {
 if (!constraint || typeof constraint !== 'object') {
  return null
 }
 const type = typeof constraint.type === 'string' ? constraint.type.trim().toLowerCase() : ''
 if (!DATA_CONSTRAINT_TYPES.includes(type)) {
  return null
 }
 return {
  type,
  tableId: typeof constraint.tableId === 'string' ? constraint.tableId : '',
  fromColumnId: typeof constraint.fromColumnId === 'string' ? constraint.fromColumnId : '',
  toColumnId: typeof constraint.toColumnId === 'string' ? constraint.toColumnId : '',
 }
}

export function findWorkflowDefaultColumns(table) {
 const cols = table && Array.isArray(table.columns) ? table.columns : []
 let exactFrom = ''
 let ciFrom = ''
 let exactTo = ''
 let ciTo = ''
 for (const col of cols) {
  if (!col || typeof col !== 'object' || typeof col.id !== 'string' || col.id.length === 0) {
   continue
  }
  const trimmed = typeof col.name === 'string' ? col.name.trim() : ''
  const lower = trimmed.toLowerCase()
  if (!exactFrom && trimmed === 'from') {
   exactFrom = col.id
  }
  else if (!ciFrom && lower === 'from') {
   ciFrom = col.id
  }
  if (!exactTo && trimmed === 'to') {
   exactTo = col.id
  }
  else if (!ciTo && lower === 'to') {
   ciTo = col.id
  }
 }
 return {
  fromColumnId: exactFrom || ciFrom,
  toColumnId: exactTo || ciTo,
 }
}

export function parseColumnType(spec, multiple, decimals) {
 if (spec && typeof spec === 'object') {
  const parsed = parseTypeString(typeof spec.type === 'string' ? spec.type : 'text')
  const resolvedMultiple = multiple !== undefined ? Boolean(multiple) : Boolean(spec.multiple || parsed.multiple)
  if (parsed.type === 'fixed') {
   const resolvedDecimals = decimals !== undefined
    ? normalizeFixedDecimals(decimals)
    : spec.decimals !== undefined
     ? normalizeFixedDecimals(spec.decimals)
     : parsed.hasDecimals
      ? parsed.decimals
      : DEFAULT_FIXED_DECIMALS
   return {
    type: 'fixed',
    multiple: resolvedMultiple,
    decimals: resolvedDecimals,
   }
  }
  if (parsed.type === 'row') {
   const rowSpec = {
    type: 'row',
    multiple: resolvedMultiple,
    refTableId: typeof spec.refTableId === 'string' ? spec.refTableId : '',
    refColumnId: typeof spec.refColumnId === 'string' ? spec.refColumnId : '',
    refDisplayColumnId: typeof spec.refDisplayColumnId === 'string' ? spec.refDisplayColumnId : '',
   }
   if (typeof spec.refFilterColumnId === 'string' && spec.refFilterColumnId.length > 0) {
    rowSpec.refFilterColumnId = spec.refFilterColumnId
   }
   if (typeof spec.filterByColumnId === 'string' && spec.filterByColumnId.length > 0) {
    rowSpec.filterByColumnId = spec.filterByColumnId
   }
   return rowSpec
  }
  if (parsed.type === 'text') {
   const constraint = normalizeColumnConstraint(spec.constraint)
   if (constraint) {
    return {
     type: 'text',
     multiple: resolvedMultiple,
     constraint,
    }
   }
  }
  return {
   type: parsed.type,
   multiple: resolvedMultiple,
  }
 }
 const parsed = parseTypeString(spec)
 const resolvedMultiple = Boolean(multiple || parsed.multiple)
 if (parsed.type === 'fixed') {
  const resolvedDecimals = decimals !== undefined
   ? normalizeFixedDecimals(decimals)
   : parsed.hasDecimals
    ? parsed.decimals
    : DEFAULT_FIXED_DECIMALS
  return {
   type: 'fixed',
   multiple: resolvedMultiple,
   decimals: resolvedDecimals,
  }
 }
 if (parsed.type === 'row') {
  return {
   type: 'row',
   multiple: resolvedMultiple,
   refTableId: '',
   refColumnId: '',
   refDisplayColumnId: '',
  }
 }
 return {
  type: parsed.type,
  multiple: resolvedMultiple,
 }
}

export function dataValuesEqual(a, b) {
 if (a === b) {
  return true
 }
 if (typeof a === 'number' && typeof b === 'number' && Number.isNaN(a) && Number.isNaN(b)) {
  return true
 }
 if (a === null || b === null || a === undefined || b === undefined) {
  return false
 }
 if (typeof a === 'object' && typeof b === 'object') {
  try {
   return JSON.stringify(a) === JSON.stringify(b)
  }
  catch {
   return false
  }
 }
 return false
}

function resolveOwnerTableForCol(tables, col, ownerTableHint = null) {
 if (ownerTableHint && typeof ownerTableHint === 'object' && Array.isArray(ownerTableHint.columns)) {
  return ownerTableHint
 }
 if (!Array.isArray(tables)) {
  return null
 }
 if (typeof ownerTableHint === 'string' && ownerTableHint.length > 0) {
  const byId = tables.find(t => t && t.id === ownerTableHint)
  if (byId) {
   return byId
  }
 }
 const colId = col && typeof col.id === 'string' ? col.id : ''
 if (colId) {
  const byColId = tables.find(t => t && Array.isArray(t.columns) && t.columns.some(c => c && c.id === colId))
  if (byColId) {
   return byColId
  }
 }
 const filterByColumnId = col && typeof col.filterByColumnId === 'string' ? col.filterByColumnId : ''
 if (filterByColumnId) {
  const byFilterCol = tables.find(t => t && Array.isArray(t.columns) && t.columns.some(c => c && c.id === filterByColumnId))
  if (byFilterCol) {
   return byFilterCol
  }
 }
 return null
}

function findReferencedTable(tables, refTableId, ownerTableHint = null) {
 if (!Array.isArray(tables) || !refTableId) {
  return null
 }
 const ownerTable = ownerTableHint && typeof ownerTableHint === 'object' ? ownerTableHint : null
 if (ownerTable && isRemoteTable(ownerTable)) {
  const sameOwner = tables.find(t => isRemoteTable(t) && t.remote.laneId === ownerTable.remote.laneId && t.remote.tableId === refTableId)
  if (sameOwner) {
   return sameOwner
  }
  return null
 }
 const exact = tables.find(t => t && t.id === refTableId)
 if (exact) {
  return exact
 }
 return tables.find(t => isRemoteTable(t) && t.remote.tableId === refTableId) || null
}

export function resolveRowValueSpec(tables, col, visited = new Set(), ownerTableHint = null) {
 if (!Array.isArray(tables) || !col || typeof col !== 'object') {
  return null
 }
 const refTableId = typeof col.refTableId === 'string' ? col.refTableId : ''
 const refColumnId = typeof col.refColumnId === 'string' ? col.refColumnId : ''
 if (!refTableId || !refColumnId) {
  return null
 }
 const visitKey = `${refTableId}:${refColumnId}`
 if (visited.has(visitKey)) {
  return null
 }
 const ownerTable = resolveOwnerTableForCol(tables, col, ownerTableHint)
 const table = findReferencedTable(tables, refTableId, ownerTable)
 if (!table || !Array.isArray(table.columns)) {
  return null
 }
 const linkCol = table.columns.find(c => c && c.id === refColumnId)
 if (!linkCol) {
  return null
 }
 const parsed = parseColumnType(linkCol, false)
 if (parsed.type === 'row') {
  const nextVisited = new Set(visited)
  nextVisited.add(visitKey)
  return resolveRowValueSpec(tables, linkCol, nextVisited, table)
 }
 return parsed
}

function isFilterValueEmpty(value) {
 if (value === null || value === undefined) {
  return true
 }
 if (typeof value === 'string' && value.trim() === '') {
  return true
 }
 if (Array.isArray(value)) {
  return value.length === 0 || value.every(item => isFilterValueEmpty(item))
 }
 return false
}

function singleFilterValuesMatch(a, b, colA = null, colB = null, tables = null) {
 if (isFilterValueEmpty(a) || isFilterValueEmpty(b)) {
  return false
 }
 if (dataValuesEqual(a, b)) {
  return true
 }
 if (
  Array.isArray(tables) &&
  colA &&
  colB &&
  colA.type === 'row' &&
  colB.type === 'row' &&
  typeof colA.refTableId === 'string' &&
  colA.refTableId.length > 0 &&
  typeof colB.refTableId === 'string' &&
  colB.refTableId.length > 0 &&
  typeof colA.refColumnId === 'string' &&
  typeof colB.refColumnId === 'string' &&
  colA.refColumnId.length > 0 &&
  colB.refColumnId.length > 0 &&
  colA.refColumnId !== colB.refColumnId
 ) {
  const ownerA = resolveOwnerTableForCol(tables, colA)
  const ownerB = resolveOwnerTableForCol(tables, colB)
  const sharedTable = findReferencedTable(tables, colA.refTableId, ownerA)
  const sharedTableB = findReferencedTable(tables, colB.refTableId, ownerB)
  const sharedRows = sharedTable && sharedTable === sharedTableB && Array.isArray(sharedTable.rows) ? sharedTable.rows : []
  for (let i = 0; i < sharedRows.length; i++) {
   const sRow = sharedRows[i]
   if (
    sRow &&
    sRow.values &&
    dataValuesEqual(sRow.values[colA.refColumnId], a) &&
    dataValuesEqual(sRow.values[colB.refColumnId], b)
   ) {
    return true
   }
  }
 }
 if (typeof a !== typeof b && (typeof a === 'string' || typeof b === 'string')) {
  return String(a).trim() === String(b).trim()
 }
 return false
}

export function rowFilterValuesMatch(targetVal, ownerVal, refFilterCol = null, filterByCol = null, tables = null) {
 if (isFilterValueEmpty(targetVal) || isFilterValueEmpty(ownerVal)) {
  return false
 }
 const targetArr = Array.isArray(targetVal) ? targetVal : [targetVal]
 const ownerArr = Array.isArray(ownerVal) ? ownerVal : [ownerVal]
 for (let i = 0; i < targetArr.length; i++) {
  for (let j = 0; j < ownerArr.length; j++) {
   if (singleFilterValuesMatch(targetArr[i], ownerArr[j], refFilterCol, filterByCol, tables)) {
    return true
   }
  }
 }
 return false
}

export function resolveRowTarget(tables, col, ownerTableHint = null) {
 const refTableId = col && typeof col.refTableId === 'string' ? col.refTableId : ''
 const refColumnId = col && typeof col.refColumnId === 'string' ? col.refColumnId : ''
 const refDisplayColumnId = col && typeof col.refDisplayColumnId === 'string' ? col.refDisplayColumnId : ''
 const refFilterColumnId = col && typeof col.refFilterColumnId === 'string' ? col.refFilterColumnId : ''
 const filterByColumnId = col && typeof col.filterByColumnId === 'string' ? col.filterByColumnId : ''
 const configured = Boolean(refTableId && refColumnId)
 const ownerTable = resolveOwnerTableForCol(tables, col, ownerTableHint)
 const table = findReferencedTable(tables, refTableId, ownerTable)
 const cols = table && Array.isArray(table.columns) ? table.columns : []
 const linkCol = refColumnId ? cols.find(c => c && c.id === refColumnId) || null : null
 const rawDisplayCol = refDisplayColumnId ? cols.find(c => c && c.id === refDisplayColumnId) || null : null
 const displayCol = rawDisplayCol && linkCol && rawDisplayCol.id !== linkCol.id ? rawDisplayCol : null
 const valueSpec = linkCol ? resolveRowValueSpec(tables, { refTableId, refColumnId }, new Set(), ownerTable) : null
 const displaySpec = displayCol
  ? (displayCol.type === 'row'
   ? (resolveRowValueSpec(tables, displayCol, new Set(), table) || parseColumnType(displayCol, false))
   : parseColumnType(displayCol, false))
  : null
 const refFilterCol = refFilterColumnId ? cols.find(c => c && c.id === refFilterColumnId) || null : null
 const ownerCols = ownerTable && Array.isArray(ownerTable.columns) ? ownerTable.columns : []
 const colId = col && typeof col.id === 'string' ? col.id : ''
 const rawFilterByCol = filterByColumnId ? ownerCols.find(c => c && c.id === filterByColumnId) || null : null
 const filterByCol = rawFilterByCol && (!colId || rawFilterByCol.id !== colId) ? rawFilterByCol : null
 const filterActive = Boolean(refFilterColumnId || filterByColumnId)
 const filterConfigured = Boolean(refFilterColumnId && filterByColumnId)
 const filterValid = Boolean(filterConfigured && refFilterCol && filterByCol)
 const filterOperator = refFilterCol && refFilterCol.multiple ? 'contains' : 'is'
 const tableName = table ? (String(table.name || '').trim() || table.id) : ''
 const ownerTableName = ownerTable ? (String(ownerTable.name || '').trim() || ownerTable.id) : ''
 const refFilterColName = refFilterCol ? (String(refFilterCol.name || '').trim() || refFilterCol.id) : ''
 const filterByColName = filterByCol ? (String(filterByCol.name || '').trim() || filterByCol.id) : ''
 return {
  configured,
  valid: Boolean(table && linkCol && valueSpec),
  refTableId,
  refColumnId,
  refDisplayColumnId,
  refFilterColumnId,
  filterByColumnId,
  table,
  linkCol,
  displayCol,
  valueSpec,
  displaySpec,
  filterActive,
  filterConfigured,
  filterValid,
  filterOperator,
  refFilterCol,
  filterByCol,
  ownerTable,
  tableName,
  ownerTableName,
  refFilterColName,
  filterByColName,
 }
}

export function formatColumnType(type, multiple, decimals, tables = null) {
 const parsed = parseColumnType(type, multiple, decimals)
 let base
 if (parsed.type === 'fixed') {
  base = `fixed(${parsed.decimals})`
 }
 else if (parsed.type === 'row') {
  const ownerTable = Array.isArray(tables) && type && typeof type === 'object' ? resolveOwnerTableForCol(tables, type) : null
  const target = Array.isArray(tables) ? resolveRowTarget(tables, parsed, ownerTable) : null
  if (target && target.table && target.linkCol) {
   const tLabel = typeof target.table.name === 'string' && target.table.name.trim().length > 0
    ? target.table.name.trim()
    : target.table.id
   const cLabel = typeof target.linkCol.name === 'string' && target.linkCol.name.trim().length > 0
    ? target.linkCol.name.trim()
    : target.linkCol.id
   base = `row(${tLabel}.${cLabel})`
  }
  else {
   base = 'row'
  }
 }
 else if (parsed.type === 'text' && parsed.constraint && parsed.constraint.type === 'workflow') {
  base = 'text(workflow)'
 }
 else {
  base = parsed.type
 }
 return parsed.multiple ? `${base}[]` : base
}

export function defaultDataValue(type, multiple, decimals) {
 const parsed = parseColumnType(type, multiple, decimals)
 if (parsed.multiple) {
  return []
 }
 switch (parsed.type) {
  case 'integer':
  case 'decimal':
  case 'fixed':
   return 0
  case 'boolean':
   return false
  case 'json':
  case 'row':
  case 'lane':
   return null
  case 'date':
  case 'datetime':
  case 'url':
  case 'email':
  case 'text':
  default:
   return ''
 }
}

export function parseCellValue(raw, type, decimals, tables = null, displayOpts = null) {
 const parsed = parseColumnType(type, false, decimals)
 const base = parsed.type
 const effDisplayOpts = displayOpts || (decimals && typeof decimals === 'object' && !Array.isArray(decimals) ? decimals : null)
 switch (base) {
  case 'integer': {
   if (raw === null || raw === undefined) {
    return { ok: true, value: null, error: null }
   }
   if (typeof raw === 'number') {
    return Number.isSafeInteger(raw)
     ? { ok: true, value: raw, error: null }
     : { ok: false, value: null, error: 'Must be a whole integer' }
   }
   const trimmed = String(raw).trim()
   if (trimmed === '') {
    return { ok: true, value: null, error: null }
   }
   if (!/^[+-]?\d+$/.test(trimmed)) {
    return { ok: false, value: null, error: 'Must be a whole integer' }
   }
   const num = Number(trimmed)
   if (!Number.isSafeInteger(num)) {
    return { ok: false, value: null, error: 'Integer out of safe range' }
   }
   return { ok: true, value: num, error: null }
  }
  case 'decimal': {
   if (raw === null || raw === undefined) {
    return { ok: true, value: null, error: null }
   }
   if (typeof raw === 'number') {
    return Number.isFinite(raw)
     ? { ok: true, value: raw, error: null }
     : { ok: false, value: null, error: 'Must be a decimal number' }
   }
   const trimmed = String(raw).trim()
   if (trimmed === '') {
    return { ok: true, value: null, error: null }
   }
   const num = Number(trimmed)
   if (!Number.isFinite(num)) {
    return { ok: false, value: null, error: 'Must be a decimal number' }
   }
   return { ok: true, value: num, error: null }
  }
  case 'fixed': {
   if (raw === null || raw === undefined) {
    return { ok: true, value: null, error: null }
   }
   if (typeof raw === 'number') {
    if (!Number.isFinite(raw)) {
     return { ok: false, value: null, error: 'Must be a fixed-point number' }
    }
    return scaleDecimalStringToFixed(numberToPlainDecimalString(raw), parsed.decimals, { allowRounding: false })
   }
   return scaleDecimalStringToFixed(String(raw), parsed.decimals, { allowRounding: false })
  }
  case 'boolean': {
   if (typeof raw === 'boolean') {
    return { ok: true, value: raw, error: null }
   }
   if (typeof raw === 'string') {
    const lower = raw.trim().toLowerCase()
    if (lower === 'true' || lower === '1') {
     return { ok: true, value: true, error: null }
    }
    if (lower === 'false' || lower === '0' || lower === '') {
     return { ok: true, value: false, error: null }
    }
    return { ok: false, value: false, error: 'Must be true or false' }
   }
   return { ok: true, value: Boolean(raw), error: null }
  }
  case 'date': {
   const trimmed = raw === null || raw === undefined ? '' : String(raw).trim()
   if (trimmed === '') {
    return { ok: true, value: '', error: null }
   }
   if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return { ok: false, value: trimmed, error: 'Expected YYYY-MM-DD date' }
   }
   const [y, m, d] = trimmed.split('-').map(Number)
   const dt = new Date(Date.UTC(y, m - 1, d))
   if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) {
    return { ok: false, value: trimmed, error: 'Invalid calendar date' }
   }
   return { ok: true, value: trimmed, error: null }
  }
  case 'datetime': {
   if (effDisplayOpts && typeof effDisplayOpts === 'object' && (effDisplayOpts.timeZone || effDisplayOpts.hourFormat || effDisplayOpts.intl)) {
    return parseDatetimeInTimeZone(raw, effDisplayOpts)
   }
   const trimmed = raw === null || raw === undefined ? '' : String(raw).trim()
   if (trimmed === '') {
    return { ok: true, value: '', error: null }
   }
   if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})?$/.test(trimmed) || Number.isNaN(Date.parse(trimmed))) {
    return { ok: false, value: trimmed, error: 'Expected ISO date-time (YYYY-MM-DDTHH:mm)' }
   }
   return { ok: true, value: trimmed, error: null }
  }
  case 'url': {
   const trimmed = raw === null || raw === undefined ? '' : String(raw).trim()
   if (trimmed === '') {
    return { ok: true, value: '', error: null }
   }
   try {
    new URL(trimmed)
    return { ok: true, value: trimmed, error: null }
   }
   catch {
    return { ok: false, value: trimmed, error: 'Must be a valid URL (e.g. https://...)' }
   }
  }
  case 'email': {
   const trimmed = raw === null || raw === undefined ? '' : String(raw).trim()
   if (trimmed === '') {
    return { ok: true, value: '', error: null }
   }
   if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    return { ok: false, value: trimmed, error: 'Must be a valid email address' }
   }
   return { ok: true, value: trimmed, error: null }
  }
  case 'json': {
   if (raw === null || raw === undefined) {
    return { ok: true, value: null, error: null }
   }
   if (typeof raw !== 'string') {
    return { ok: true, value: raw, error: null }
   }
   const trimmed = raw.trim()
   if (trimmed === '') {
    return { ok: true, value: null, error: null }
   }
   try {
    return { ok: true, value: JSON.parse(trimmed), error: null }
   }
   catch {
    return { ok: false, value: null, error: 'Must be valid JSON' }
   }
  }
  case 'row': {
   if (raw === null || raw === undefined || (typeof raw === 'string' && raw.trim() === '')) {
    return { ok: true, value: null, error: null }
   }
   const ownerTable = tables && type && typeof type === 'object' ? resolveOwnerTableForCol(tables, type) : null
   const valueSpec = tables ? resolveRowValueSpec(tables, parsed, new Set(), ownerTable) : null
   if (valueSpec) {
    return parseCellValue(raw, valueSpec, undefined, tables, displayOpts)
   }
   return { ok: true, value: raw, error: null }
  }
  case 'lane': {
   if (raw === null || raw === undefined) {
    return { ok: true, value: null, error: null }
   }
   if (typeof raw !== 'string') {
    return { ok: false, value: null, error: 'Must be a lane ID string' }
   }
   const trimmed = raw.trim()
   return { ok: true, value: trimmed === '' ? null : trimmed, error: null }
  }
  case 'text':
  default:
   return { ok: true, value: raw === null || raw === undefined ? '' : String(raw), error: null }
 }
}

export function formatCellInputValue(value, type, decimals, tables = null, displayOpts = null) {
 const parsed = parseColumnType(type, false, decimals)
 const base = parsed.type
 const effDisplayOpts = displayOpts || (decimals && typeof decimals === 'object' && !Array.isArray(decimals) ? decimals : null)
 if (base === 'boolean') {
  return Boolean(value)
 }
 if (value === null || value === undefined) {
  return ''
 }
 if (base === 'fixed') {
  return formatFixedInteger(value, parsed.decimals)
 }
 if (base === 'row') {
  const ownerTable = tables && type && typeof type === 'object' ? resolveOwnerTableForCol(tables, type) : null
  const valueSpec = tables ? resolveRowValueSpec(tables, parsed, new Set(), ownerTable) : null
  if (valueSpec) {
   return formatCellInputValue(value, valueSpec, undefined, tables, displayOpts)
  }
  return String(value)
 }
 if (base === 'json') {
  try {
   return JSON.stringify(value)
  }
  catch {
   return String(value)
  }
 }
 if (base === 'datetime') {
  const str = String(value)
  if (str.trim() === '') {
   return ''
  }
  if (effDisplayOpts && typeof effDisplayOpts === 'object' && (effDisplayOpts.timeZone || effDisplayOpts.hourFormat || effDisplayOpts.showTimeZone !== undefined || effDisplayOpts.intl)) {
   const formatted = formatTimestampWithZone(value, effDisplayOpts)
   return formatted.known ? formatted.display : str
  }
  if (typeof value === 'string' && value.length > 19 && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)) {
   return value.slice(0, 19)
  }
  return str
 }
 return String(value)
}

export function isDataCellValueEmpty(value, col) {
 const parsed = parseColumnType(col)
 if (parsed.multiple) {
  if (!Array.isArray(value) || value.length === 0) {
   return true
  }
  const singleSpec = { ...parsed, multiple: false }
  return value.every(item => isDataCellValueEmpty(item, singleSpec))
 }
 if (value === null || value === undefined) {
  return true
 }
 switch (parsed.type) {
  case 'text':
   return String(value) === ''
  case 'date':
  case 'datetime':
  case 'url':
  case 'email':
  case 'row':
  case 'lane':
   return String(value).trim() === ''
  case 'integer':
  case 'decimal':
  case 'fixed':
   return typeof value === 'number' ? !Number.isFinite(value) : String(value).trim() === ''
  case 'json':
   return typeof value === 'string' && value.trim() === ''
  case 'boolean':
   return false
  default:
   return String(value) === ''
 }
}

function formatRowCellText(value, spec, displayOpts = null) {
 if (value === null || value === undefined) {
  return ''
 }
 const parsed = parseColumnType(spec, false)
 if (parsed.type === 'boolean') {
  return value ? 'true' : 'false'
 }
 return String(formatCellInputValue(value, parsed, undefined, null, displayOpts))
}

function coerceSingleDataValue(value, targetSpec, fromSpec = null, tables = null, ownerHint = null, fromOwnerHint = null) {
 const parsed = typeof targetSpec === 'object' && targetSpec !== null ? targetSpec : parseColumnType(targetSpec, false)
 const effectiveFromSpec = fromSpec && fromSpec.type === 'row' && tables
  ? resolveRowValueSpec(tables, fromSpec, new Set(), fromOwnerHint)
  : fromSpec
 const base = parsed.type
 if (base === 'row') {
  if (value === null || value === undefined || (typeof value === 'string' && value.trim() === '')) {
   return null
  }
  const resolvedTarget = tables ? resolveRowValueSpec(tables, parsed, new Set(), ownerHint) : null
  if (resolvedTarget) {
   return coerceSingleDataValue(value, resolvedTarget, effectiveFromSpec, tables, ownerHint, fromOwnerHint)
  }
  return cloneDataValue(value)
 }
 if (base === 'fixed') {
  if (value === null || value === undefined || value === '') {
   return null
  }
  if (effectiveFromSpec && effectiveFromSpec.type === 'fixed') {
   return rescaleFixedInteger(value, effectiveFromSpec.decimals, parsed.decimals)
  }
  if (typeof value === 'boolean') {
   return value ? Number(10n ** BigInt(parsed.decimals)) : 0
  }
  if (typeof value === 'number') {
   if (!Number.isFinite(value)) {
    return null
   }
   if (!effectiveFromSpec && Number.isSafeInteger(value)) {
    return value === 0 ? 0 : value
   }
   const scaled = scaleDecimalStringToFixed(numberToPlainDecimalString(value), parsed.decimals, { allowRounding: true })
   return scaled.ok ? scaled.value : null
  }
  const scaled = scaleDecimalStringToFixed(String(value), parsed.decimals, { allowRounding: true })
  return scaled.ok ? scaled.value : null
 }
 let inputVal = value
 if (effectiveFromSpec && effectiveFromSpec.type === 'fixed' && value !== null && value !== undefined && value !== '') {
  if (base === 'boolean') {
   const num = Number(value)
   return Number.isFinite(num) ? num !== 0 : Boolean(value)
  }
  const formatted = formatFixedInteger(value, effectiveFromSpec.decimals)
  if (base === 'json') {
   return formatted === '' ? null : Number(formatted)
  }
  inputVal = formatted
 }
 switch (base) {
  case 'integer': {
   if (inputVal === null || inputVal === undefined || inputVal === '') {
    return null
   }
   if (typeof inputVal === 'boolean') {
    return inputVal ? 1 : 0
   }
   const num = Number(inputVal)
   return Number.isFinite(num) ? Math.trunc(num) : null
  }
  case 'decimal': {
   if (inputVal === null || inputVal === undefined || inputVal === '') {
    return null
   }
   if (typeof inputVal === 'boolean') {
    return inputVal ? 1 : 0
   }
   const num = Number(inputVal)
   return Number.isFinite(num) ? num : null
  }
  case 'boolean': {
   if (typeof inputVal === 'boolean') {
    return inputVal
   }
   if (typeof inputVal === 'string') {
    const lower = inputVal.trim().toLowerCase()
    return lower === 'true' || lower === '1'
   }
   return Boolean(inputVal)
  }
  case 'json': {
   if (inputVal === undefined) {
    return null
   }
   if (typeof inputVal === 'string') {
    const trimmed = inputVal.trim()
    if (trimmed === '') {
     return null
    }
    try {
     return JSON.parse(trimmed)
    }
    catch {
     return inputVal
    }
   }
   return inputVal
  }
  case 'lane': {
   if (inputVal === null || inputVal === undefined || typeof inputVal === 'object') {
    return null
   }
   const trimmed = String(inputVal).trim()
   return trimmed === '' ? null : trimmed
  }
  case 'date':
  case 'datetime':
  case 'url':
  case 'email':
  case 'text':
  default: {
   if (inputVal === null || inputVal === undefined) {
    return ''
   }
   if (typeof inputVal === 'number' && Number.isFinite(inputVal)) {
    if (base === 'datetime') {
     return new Date(inputVal).toISOString()
    }
    if (base === 'date') {
     return new Date(inputVal).toISOString().slice(0, 10)
    }
   }
   if (typeof inputVal === 'string' && /^\d{10,15}$/.test(inputVal.trim())) {
    const ms = Number(inputVal.trim())
    if (Number.isFinite(ms)) {
     if (base === 'datetime') {
      return new Date(ms).toISOString()
     }
     if (base === 'date') {
      return new Date(ms).toISOString().slice(0, 10)
     }
    }
   }
   if (typeof inputVal === 'object') {
    try {
     return JSON.stringify(inputVal)
    }
    catch {
     return String(inputVal)
    }
   }
   return String(inputVal)
  }
 }
}

export function coerceDataValue(value, type, multiple, fromType = null, tables = null) {
 const parsed = parseColumnType(type, multiple)
 const fromParsed = fromType ? parseColumnType(fromType) : null
 const ownerHint = tables && type && typeof type === 'object' ? resolveOwnerTableForCol(tables, type) : null
 const fromOwnerHint = tables && fromType && typeof fromType === 'object' ? resolveOwnerTableForCol(tables, fromType) : null
 if (parsed.multiple) {
  if (Array.isArray(value)) {
   return value.map(item => coerceSingleDataValue(item, parsed, fromParsed, tables, ownerHint, fromOwnerHint))
  }
  if (value === null || value === undefined || value === '') {
   return []
  }
  return [coerceSingleDataValue(value, parsed, fromParsed, tables, ownerHint, fromOwnerHint)]
 }
 if (Array.isArray(value)) {
  return value.length > 0 ? coerceSingleDataValue(value[0], parsed, fromParsed, tables, ownerHint, fromOwnerHint) : defaultDataValue(parsed, false)
 }
 return coerceSingleDataValue(value, parsed, fromParsed, tables, ownerHint, fromOwnerHint)
}

export function checkColumnChangeImpact(table, colId, nextType, nextMultiple, nextDecimals, tables = null) {
 if (!table || !Array.isArray(table.columns) || !Array.isArray(table.rows) || table.rows.length === 0) {
  return { destructive: false, affectedRows: 0, reason: '' }
 }
 const col = table.columns.find(c => c && c.id === colId)
 if (!col) {
  return { destructive: false, affectedRows: 0, reason: '' }
 }
 const prevParsed = parseColumnType(col)
 const parsed = parseColumnType(nextType, nextMultiple, nextDecimals)
 const sameRowTarget = prevParsed.type !== 'row' || (
  prevParsed.refTableId === parsed.refTableId &&
  prevParsed.refColumnId === parsed.refColumnId
 )
 const sameType = prevParsed.type === parsed.type &&
  (parsed.type !== 'fixed' || prevParsed.decimals === parsed.decimals) &&
  sameRowTarget
 if (sameType && prevParsed.multiple === parsed.multiple) {
  return { destructive: false, affectedRows: 0, reason: '' }
 }
 if (prevParsed.multiple && !parsed.multiple) {
  let multiLoss = 0
  for (const row of table.rows) {
   const cur = row && row.values ? row.values[colId] : undefined
   if (Array.isArray(cur) && cur.length > 1) {
    multiLoss += 1
   }
  }
  if (multiLoss > 0) {
   const unit = multiLoss === 1 ? 'row has' : 'rows have'
   return {
    destructive: true,
    affectedRows: multiLoss,
    reason: `${multiLoss} ${unit} multiple values that will be truncated to the first item.`,
   }
  }
 }
 const unresolvedRowTarget = parsed.type === 'row' && !resolveRowValueSpec(tables, parsed)
 if (!sameType && !unresolvedRowTarget) {
  let changed = 0
  for (const row of table.rows) {
   const cur = row && row.values ? row.values[colId] : undefined
   if (cur === null || cur === undefined || cur === '' || (Array.isArray(cur) && cur.length === 0)) {
    continue
   }
   const nextVal = coerceDataValue(cur, parsed, parsed.multiple, prevParsed, tables)
   if (JSON.stringify(cur) !== JSON.stringify(nextVal)) {
    changed += 1
   }
  }
  if (changed > 0) {
   const reason = changed === 1
    ? '1 row has an existing value that will be converted and may lose data.'
    : `${changed} rows have existing values that will be converted and may lose data.`
   return {
    destructive: true,
    affectedRows: changed,
    reason,
   }
  }
 }
 return { destructive: false, affectedRows: 0, reason: '' }
}

function cloneDataValue(value) {
 if (value === null || value === undefined || typeof value !== 'object') {
  return value
 }
 try {
  return JSON.parse(JSON.stringify(value))
 }
 catch {
  return value
 }
}

export function parseStoredTables(stored) {
 if (stored === null || stored === undefined) {
  return []
 }
 let raw = stored
 if (typeof stored === 'string') {
  if (!stored.trim().startsWith('[')) {
   return []
  }
  try {
   raw = JSON.parse(stored)
  }
  catch {
   return []
  }
 }
 if (!Array.isArray(raw)) {
  return []
 }
 const out = []
 const rawRowsPerTable = []
 for (let t = 0; t < raw.length; t++) {
  const item = raw[t]
  if (!item || typeof item !== 'object') {
   continue
  }
  const tableId = typeof item.id === 'string' && item.id.length > 0 ? item.id : `tbl-${t + 1}`
  const tableName = item.name === null || item.name === undefined ? '' : String(item.name)
  const columns = []
  const rawCols = Array.isArray(item.columns) ? item.columns : []
  for (let c = 0; c < rawCols.length; c++) {
   const col = rawCols[c]
   if (!col || typeof col !== 'object') {
    continue
   }
   const colId = typeof col.id === 'string' && col.id.length > 0 ? col.id : `col-${t + 1}-${c + 1}`
   const colName = col.name === null || col.name === undefined ? '' : String(col.name)
   const parsedType = parseColumnType(col)
   const normalizedCol = {
    id: colId,
    name: colName,
    type: parsedType.type,
    multiple: parsedType.multiple,
   }
   if (parsedType.type === 'fixed') {
    normalizedCol.decimals = parsedType.decimals
   }
   else if (parsedType.type === 'row') {
    normalizedCol.refTableId = parsedType.refTableId
    normalizedCol.refColumnId = parsedType.refColumnId
    normalizedCol.refDisplayColumnId = parsedType.refDisplayColumnId
    if (parsedType.refFilterColumnId) {
     normalizedCol.refFilterColumnId = parsedType.refFilterColumnId
    }
    if (parsedType.filterByColumnId) {
     normalizedCol.filterByColumnId = parsedType.filterByColumnId
    }
   }
   else if (parsedType.type === 'text' && parsedType.constraint) {
    normalizedCol.constraint = parsedType.constraint
   }
   const width = normalizeColumnWidth(col.width)
   if (width !== null) {
    normalizedCol.width = width
   }
   if (col.required === true) {
    normalizedCol.required = true
   }
   columns.push(normalizedCol)
  }
  const tableObj = { id: tableId, name: tableName, columns, rows: [] }
  const remote = normalizeTableRemoteSpec(item.remote)
  if (remote) {
   tableObj.remote = remote
  }
  out.push(tableObj)
  rawRowsPerTable.push(Array.isArray(item.rows) ? item.rows : [])
 }
 for (let t = 0; t < out.length; t++) {
  const table = out[t]
  const rawRows = rawRowsPerTable[t]
  for (let r = 0; r < rawRows.length; r++) {
   const row = rawRows[r]
   if (!row || typeof row !== 'object') {
    continue
   }
   const rowId = typeof row.id === 'string' && row.id.length > 0 ? row.id : `row-${t + 1}-${r + 1}`
   const rawValues = row.values && typeof row.values === 'object' ? row.values : {}
   const values = {}
   for (const col of table.columns) {
    if (Object.hasOwn(rawValues, col.id)) {
     values[col.id] = coerceDataValue(rawValues[col.id], col, col.multiple, null, out)
    }
    else {
     values[col.id] = defaultDataValue(col, col.multiple)
    }
   }
   table.rows.push({ id: rowId, values })
  }
 }
 return out
}

function extractRowFilterContext(target, context = null) {
 if (!context || typeof context !== 'object') {
  return { hasContext: false, expectedValue: undefined }
 }
 if (Object.hasOwn(context, 'filterValue')) {
  return { hasContext: true, expectedValue: context.filterValue }
 }
 const filterByColId = target && target.filterByCol ? target.filterByCol.id : (target && target.filterByColumnId ? target.filterByColumnId : '')
 if (!filterByColId) {
  return { hasContext: false, expectedValue: undefined }
 }
 if (context.values && typeof context.values === 'object') {
  return {
   hasContext: true,
   expectedValue: Object.hasOwn(context.values, filterByColId) ? context.values[filterByColId] : null,
  }
 }
 if (context.row && typeof context.row === 'object' && context.row.values && typeof context.row.values === 'object') {
  return {
   hasContext: true,
   expectedValue: Object.hasOwn(context.row.values, filterByColId) ? context.row.values[filterByColId] : null,
  }
 }
 if (!Object.hasOwn(context, 'offset') && !Object.hasOwn(context, 'limit') && !Object.hasOwn(context, 'id') && !Object.hasOwn(context, 'columns')) {
  return {
   hasContext: true,
   expectedValue: Object.hasOwn(context, filterByColId) ? context[filterByColId] : null,
  }
 }
 return { hasContext: false, expectedValue: undefined }
}

function formatFilterCompareValue(val, col, tables, displayOpts = null) {
 if (isFilterValueEmpty(val)) {
  return '(empty)'
 }
 if (Array.isArray(val)) {
  return val.map(v => formatFilterCompareValue(v, col, tables, displayOpts)).join(', ')
 }
 const spec = col
  ? (col.type === 'row'
   ? (resolveRowValueSpec(tables, col) || parseColumnType(col, false))
   : parseColumnType(col, false))
  : { type: 'text', multiple: false }
 return formatRowCellText(val, spec, displayOpts)
}

export function lookupRowDisplay(tables, col, value, rowContext = null, ownerTableHint = null, displayOpts = null) {
 const resolvedOwnerHint = ownerTableHint || (rowContext && typeof rowContext === 'object' ? rowContext.ownerTable : null)
 const target = resolveRowTarget(tables, col, resolvedOwnerHint)
 const tableName = target.table ? (String(target.table.name || '').trim() || target.table.id) : ''
 const linkColName = target.linkCol ? (String(target.linkCol.name || '').trim() || target.linkCol.id) : ''
 const displayColName = target.displayCol ? (String(target.displayCol.name || '').trim() || target.displayCol.id) : ''
 const isEmpty = value === null || value === undefined || (typeof value === 'string' && value.trim() === '')
 if (isEmpty) {
  return {
   configured: target.configured,
   valid: target.valid,
   isEmpty: true,
   found: false,
   filterActive: target.filterActive,
   filterConfigured: target.filterConfigured,
   filterValid: target.filterValid,
   filterMatched: true,
   isValueValid: true,
   filterError: null,
   error: null,
   hasSeparateDisplay: Boolean(target.displayCol),
   value: null,
   valueText: '',
   displayText: '',
   label: '',
   tableName,
   linkColName,
   displayColName,
   refFilterColName: target.refFilterColName,
   filterByColName: target.filterByColName,
  }
 }
 const valueText = target.valueSpec ? formatRowCellText(value, target.valueSpec, displayOpts) : String(value)
 if (!target.valid) {
  return {
   configured: target.configured,
   valid: false,
   isEmpty: false,
   found: false,
   filterActive: target.filterActive,
   filterConfigured: target.filterConfigured,
   filterValid: target.filterValid,
   filterMatched: true,
   isValueValid: false,
   filterError: null,
   error: null,
   hasSeparateDisplay: false,
   value,
   valueText,
   displayText: '',
   label: valueText,
   tableName,
   linkColName,
   displayColName,
   refFilterColName: target.refFilterColName,
   filterByColName: target.filterByColName,
  }
 }
 const filterCtx = extractRowFilterContext(target, rowContext)
 const shouldCheckFilter = Boolean(target.refFilterCol && (target.filterValid || Object.hasOwn(rowContext || {}, 'filterValue')) && filterCtx.hasContext)
 let matchedRow = null
 let filterMatchedRow = null
 const rows = Array.isArray(target.table.rows) ? target.table.rows : []
 for (let i = 0; i < rows.length; i++) {
  const row = rows[i]
  if (!row || !row.values) {
   continue
  }
  if (dataValuesEqual(row.values[target.linkCol.id], value)) {
   if (!matchedRow) {
    matchedRow = row
   }
   if (shouldCheckFilter) {
    const candidateFilterVal = row.values[target.refFilterCol.id]
    if (rowFilterValuesMatch(candidateFilterVal, filterCtx.expectedValue, target.refFilterCol, target.filterByCol, tables)) {
     filterMatchedRow = row
     break
    }
   }
   else {
    break
   }
  }
 }
 if (filterMatchedRow) {
  matchedRow = filterMatchedRow
 }
 const found = Boolean(matchedRow)
 let filterMatched = true
 let filterError = null
 if (shouldCheckFilter) {
  if (filterMatchedRow) {
   filterMatched = true
  }
  else {
   filterMatched = false
   const lhsLabel = `${tableName}.${target.refFilterColName}`
   const rhsLabel = target.ownerTableName
    ? `${target.ownerTableName}.${target.filterByColName || 'filter'}`
    : (target.filterByColName || 'filter')
   const expectedText = formatFilterCompareValue(filterCtx.expectedValue, target.filterByCol, tables, displayOpts)
   if (matchedRow) {
    const actualVal = matchedRow.values[target.refFilterCol.id]
    const actualText = formatFilterCompareValue(actualVal, target.refFilterCol, tables, displayOpts)
    filterError = isFilterValueEmpty(filterCtx.expectedValue)
     ? `Filter mismatch: ${lhsLabel} is "${actualText}", but ${rhsLabel} is empty`
     : `Filter mismatch: ${lhsLabel} is "${actualText}", expected "${expectedText}" (${rhsLabel})`
   }
   else {
    filterError = `Filter mismatch: "${valueText}" does not match ${lhsLabel} = ${rhsLabel} (${expectedText})`
   }
  }
 }
 const hasSeparateDisplay = Boolean(target.displayCol)
 let displayText = ''
 if (found && target.displayCol && target.displaySpec && Object.hasOwn(matchedRow.values, target.displayCol.id)) {
  displayText = formatRowCellText(matchedRow.values[target.displayCol.id], target.displaySpec, displayOpts)
 }
 const label = hasSeparateDisplay && displayText.length > 0 ? `${displayText} (${valueText})` : valueText
 return {
  configured: target.configured,
  valid: true,
  isEmpty: false,
  found,
  filterActive: target.filterActive,
  filterConfigured: target.filterConfigured,
  filterValid: target.filterValid,
  filterMatched,
  isValueValid: Boolean(found && filterMatched),
  filterError,
  error: filterError,
  hasSeparateDisplay,
  value,
  valueText,
  displayText,
  label,
  tableName,
  linkColName,
  displayColName,
  refFilterColName: target.refFilterColName,
  filterByColName: target.filterByColName,
 }
}

export async function fetchRowOptionsPage(tables, col, options = {}) {
 await Promise.resolve()
 const rawOffset = Number(options && options.offset)
 const rawLimit = Number(options && options.limit)
 const offset = Number.isFinite(rawOffset) && rawOffset >= 0 ? Math.trunc(rawOffset) : 0
 const limit = Number.isFinite(rawLimit) && rawLimit >= 1 ? Math.trunc(rawLimit) : DEFAULT_ROW_PICKER_PAGE_SIZE
 const target = resolveRowTarget(tables, col, options && options.ownerTable)
 if (!target || !target.valid) {
  return {
   ok: false,
   error: 'Linked table or column not found',
   items: [],
   offset: 0,
   limit,
   nextOffset: 0,
   hasMore: false,
   total: 0,
  }
 }
 const rows = Array.isArray(target.table.rows) ? target.table.rows : []
 const filterCtx = extractRowFilterContext(target, options)
 const shouldFilter = Boolean(target.refFilterCol && (target.filterValid || Object.hasOwn(options || {}, 'filterValue')) && filterCtx.hasContext)
 let sourceEntries
 if (shouldFilter) {
  sourceEntries = []
  for (let i = 0; i < rows.length; i++) {
   const row = rows[i]
   if (!row || !row.values || !Object.hasOwn(row.values, target.linkCol.id)) {
    continue
   }
   const rawVal = row.values[target.linkCol.id]
   if (rawVal === null || rawVal === undefined || (typeof rawVal === 'string' && rawVal.trim() === '')) {
    continue
   }
   const filterVal = row.values[target.refFilterCol.id]
   if (!rowFilterValuesMatch(filterVal, filterCtx.expectedValue, target.refFilterCol, target.filterByCol, tables)) {
    continue
   }
   sourceEntries.push({ row, rowIndex: i })
  }
 }
 else {
  sourceEntries = rows.map((row, idx) => ({ row, rowIndex: idx }))
 }
 const total = sourceEntries.length
 const start = Math.min(offset, total)
 const end = Math.min(total, start + limit)
 const displayOpts = options && options.displayOpts && typeof options.displayOpts === 'object' ? options.displayOpts : null
 const items = []
 for (let i = start; i < end; i++) {
  const { row, rowIndex } = sourceEntries[i]
  if (!row || !row.values || !Object.hasOwn(row.values, target.linkCol.id)) {
   continue
  }
  const rawVal = row.values[target.linkCol.id]
  if (rawVal === null || rawVal === undefined || (typeof rawVal === 'string' && rawVal.trim() === '')) {
   continue
  }
  const valueText = formatRowCellText(rawVal, target.valueSpec, displayOpts)
  let displayText = ''
  if (target.displayCol && target.displaySpec && Object.hasOwn(row.values, target.displayCol.id)) {
   displayText = formatRowCellText(row.values[target.displayCol.id], target.displaySpec, displayOpts)
  }
  const hasSeparateDisplay = Boolean(target.displayCol && displayText.length > 0)
  const label = hasSeparateDisplay ? `${displayText} (${valueText})` : valueText
  items.push({
   rowId: row.id,
   rowIndex,
   value: cloneDataValue(rawVal),
   valueText,
   displayText,
   hasSeparateDisplay,
   label,
   searchText: `${displayText} ${valueText}`.trim().toLowerCase(),
  })
 }
 return {
  ok: true,
  error: null,
  items,
  offset: start,
  limit,
  nextOffset: end,
  hasMore: end < total,
  total,
 }
}

export function filterRowOptions(items, query = '') {
 const list = Array.isArray(items) ? items : []
 const q = String(query ?? '').trim().toLowerCase()
 if (q.length === 0) {
  return list.slice()
 }
 return list.filter(item => item && typeof item.searchText === 'string' && item.searchText.includes(q))
}

function formatWorkflowCellText(value, col, tables) {
 if (value === null || value === undefined) {
  return ''
 }
 const parsed = parseColumnType(col, false)
 if (parsed.type === 'boolean') {
  return value ? 'true' : 'false'
 }
 return String(formatCellInputValue(value, parsed, undefined, tables))
}

export function resolveWorkflowTarget(tables, col) {
 const isText = Boolean(col && typeof col === 'object' && normalizeDataColumnType(col) === 'text')
 const constraint = isText ? normalizeColumnConstraint(col.constraint) : null
 if (!constraint || constraint.type !== 'workflow') {
  return {
   active: false,
   configured: false,
   valid: false,
   type: '',
   tableId: '',
   fromColumnId: '',
   toColumnId: '',
   table: null,
   fromCol: null,
   toCol: null,
   tableName: '',
   fromColName: '',
   toColName: '',
   fromValues: [],
   toValues: [],
   transitionCount: 0,
   transitions: {},
  }
 }
 const { tableId, fromColumnId, toColumnId } = constraint
 const configured = Boolean(tableId && fromColumnId && toColumnId)
 const ownerTable = resolveOwnerTableForCol(tables, col)
 const table = findReferencedTable(tables, tableId, ownerTable)
 const cols = table && Array.isArray(table.columns) ? table.columns : []
 const fromCol = fromColumnId ? cols.find(c => c && c.id === fromColumnId) || null : null
 const toCol = toColumnId ? cols.find(c => c && c.id === toColumnId) || null : null
 const valid = Boolean(table && fromCol && toCol)
 const tableName = table ? (String(table.name || '').trim() || table.id) : ''
 const fromColName = fromCol ? (String(fromCol.name || '').trim() || fromCol.id) : ''
 const toColName = toCol ? (String(toCol.name || '').trim() || toCol.id) : ''
 const fromValues = []
 const fromSet = new Set()
 const toValues = []
 const toSet = new Set()
 const transitions = {}
 let transitionCount = 0
 if (valid) {
  const rows = Array.isArray(table.rows) ? table.rows : []
  for (let i = 0; i < rows.length; i++) {
   const row = rows[i]
   if (!row || !row.values || typeof row.values !== 'object') {
    continue
   }
   const rawFrom = Object.hasOwn(row.values, fromCol.id) ? row.values[fromCol.id] : ''
   const rawTo = Object.hasOwn(row.values, toCol.id) ? row.values[toCol.id] : ''
   const fromText = formatWorkflowCellText(rawFrom, fromCol, tables)
   const toText = formatWorkflowCellText(rawTo, toCol, tables)
   if (fromText === '' && toText === '') {
    continue
   }
   if (fromText !== '' && !fromSet.has(fromText)) {
    fromSet.add(fromText)
    fromValues.push(fromText)
   }
   if (!Object.hasOwn(transitions, fromText)) {
    transitions[fromText] = []
   }
   if (toText !== '') {
    if (!transitions[fromText].includes(toText)) {
     transitions[fromText].push(toText)
     transitionCount += 1
    }
    if (!toSet.has(toText)) {
     toSet.add(toText)
     toValues.push(toText)
    }
   }
  }
 }
 return {
  active: true,
  configured,
  valid,
  type: constraint.type,
  tableId,
  fromColumnId,
  toColumnId,
  table,
  fromCol,
  toCol,
  tableName,
  fromColName,
  toColName,
  fromValues,
  toValues,
  transitionCount,
  transitions,
 }
}

export function getWorkflowCellState(tables, col, value) {
 const target = resolveWorkflowTarget(tables, col)
 const currentValue = value === null || value === undefined ? '' : String(value)
 if (!target.active) {
  return {
   active: false,
   configured: false,
   valid: false,
   isValueValid: true,
   currentValue,
   error: null,
   hint: '',
   options: [],
  }
 }
 if (!target.valid) {
  const error = target.configured
   ? 'Workflow table or columns not found'
   : 'Configure workflow table, From, and To columns in Schema'
  return {
   active: true,
   configured: target.configured,
   valid: false,
   isValueValid: true,
   currentValue,
   error,
   hint: error,
   options: [
    {
     value: currentValue,
     label: currentValue === '' ? 'Configure workflow…' : currentValue,
     isCurrent: true,
     isInvalid: false,
    },
   ],
  }
 }
 const hasOutgoingEntry = Object.hasOwn(target.transitions, currentValue)
 const isTerminalState = !hasOutgoingEntry && currentValue !== '' && target.toValues.includes(currentValue)
 const isValueValid = hasOutgoingEntry || isTerminalState
 if (isValueValid) {
  const nextList = hasOutgoingEntry ? target.transitions[currentValue] : []
  const options = [
   {
    value: currentValue,
    label: currentValue === '' ? '(empty)' : currentValue,
    isCurrent: true,
    isInvalid: false,
   },
  ]
  for (let i = 0; i < nextList.length; i++) {
   const nextVal = nextList[i]
   if (nextVal !== currentValue) {
    options.push({
     value: nextVal,
     label: nextVal,
     isCurrent: false,
     isInvalid: false,
    })
   }
  }
  const nextOptions = options.slice(1).map(o => o.value)
  const hint = nextOptions.length > 0
   ? `Next: ${nextOptions.join(', ')}`
   : 'Terminal workflow state (no outgoing transitions)'
  return {
   active: true,
   configured: true,
   valid: true,
   isValueValid: true,
   currentValue,
   error: null,
   hint,
   options,
  }
 }
 const error = target.fromValues.length === 0
  ? (currentValue === ''
   ? 'Invalid workflow value (empty) — add workflow rows in the mapped table'
   : `Invalid workflow value "${currentValue}" — add workflow rows in the mapped table`)
  : (currentValue === ''
   ? 'Invalid workflow value (empty) — select a valid starting state'
   : `Invalid workflow value "${currentValue}" — select a valid starting state`)
 const options = [
  {
   value: currentValue,
   label: currentValue === '' ? '(empty — invalid)' : `${currentValue} (invalid)`,
   isCurrent: true,
   isInvalid: true,
  },
 ]
 for (let i = 0; i < target.fromValues.length; i++) {
  const startVal = target.fromValues[i]
  if (startVal !== currentValue) {
   options.push({
    value: startVal,
    label: startVal,
    isCurrent: false,
    isInvalid: false,
   })
  }
 }
 return {
  active: true,
  configured: true,
  valid: true,
  isValueValid: false,
  currentValue,
  error,
  hint: error,
  options,
 }
}

export function buildTablesScope(tables) {
 const out = {}
 if (!Array.isArray(tables)) {
  return out
 }
 for (const table of tables) {
  if (!table || typeof table !== 'object') {
   continue
  }
  const tableName = typeof table.name === 'string' ? table.name.trim() : ''
  if (tableName.length === 0) {
   continue
  }
  const cols = Array.isArray(table.columns) ? table.columns : []
  const rows = Array.isArray(table.rows) ? table.rows : []
  out[tableName] = rows.map(row => {
   const record = {}
   const values = row && row.values && typeof row.values === 'object' ? row.values : {}
   for (const col of cols) {
    const colName = col && typeof col.name === 'string' ? col.name.trim() : ''
    if (colName.length === 0) {
     continue
    }
    const val = Object.hasOwn(values, col.id) ? values[col.id] : defaultDataValue(col, col.multiple)
    record[colName] = cloneDataValue(val)
   }
   return record
  })
 }
 return out
}

let syncFallbackRowSeq = 0
function makeSyncedRowId() {
 const c = globalThis.crypto
 if (c && typeof c.randomUUID === 'function') {
  return `row-${c.randomUUID()}`
 }
 syncFallbackRowSeq += 1
 return `row-${Date.now()}-${syncFallbackRowSeq}`
}

export function resolveInboundSubtables(tables, targetTable) {
 if (!Array.isArray(tables) || !targetTable || typeof targetTable !== 'object' || !targetTable.id) {
  return []
 }
 const targetId = String(targetTable.id)
 const targetCols = Array.isArray(targetTable.columns) ? targetTable.columns : []
 const out = []
 for (let t = 0; t < tables.length; t++) {
  const srcTable = tables[t]
  if (!srcTable || typeof srcTable !== 'object' || !srcTable.id || String(srcTable.id) === targetId) {
   continue
  }
  const srcCols = Array.isArray(srcTable.columns) ? srcTable.columns : []
  const linkMappings = []
  for (let c = 0; c < srcCols.length; c++) {
   const col = srcCols[c]
   if (!col || typeof col !== 'object' || col.type !== 'row') {
    continue
   }
   const resolvedRef = findReferencedTable(tables, String(col.refTableId || ''), srcTable)
   if (resolvedRef !== targetTable) {
    continue
   }
   const refColId = typeof col.refColumnId === 'string' ? col.refColumnId : ''
   if (!refColId) {
    continue
   }
   const targetCol = targetCols.find(tc => tc && tc.id === refColId) || null
   if (!targetCol) {
    continue
   }
   linkMappings.push({
    sourceColumn: col,
    sourceColumnId: col.id,
    sourceColumnName: typeof col.name === 'string' && col.name.trim() ? col.name.trim() : col.id,
    targetColumn: targetCol,
    targetColumnId: targetCol.id,
    targetColumnName: typeof targetCol.name === 'string' && targetCol.name.trim() ? targetCol.name.trim() : targetCol.id,
   })
  }
  if (linkMappings.length > 0) {
   const rawName = typeof srcTable.name === 'string' ? srcTable.name.trim() : ''
   const linkColumnIds = linkMappings.map(m => m.sourceColumnId)
   const linkColumnIdSet = new Set(linkColumnIds)
   const displayColumns = srcCols.filter(col => col && typeof col === 'object' && !linkColumnIdSet.has(col.id))
   out.push({
    table: srcTable,
    tableId: String(srcTable.id),
    tableIndex: t,
    tableName: rawName || `Table ${t + 1}`,
    links: linkMappings,
    linkColumnIds,
    displayColumns,
   })
  }
 }
 return out
}

export function getInboundSubtableRowsForParent(subtableSpec, parentRow, tables = null) {
 if (!subtableSpec || !subtableSpec.table || !parentRow || !parentRow.values) {
  return []
 }
 const srcTable = subtableSpec.table
 const srcRows = Array.isArray(srcTable.rows) ? srcTable.rows : []
 const links = Array.isArray(subtableSpec.links) ? subtableSpec.links : []
 if (srcRows.length === 0 || links.length === 0) {
  return []
 }
 const matched = []
 for (let r = 0; r < srcRows.length; r++) {
  const sRow = srcRows[r]
  if (!sRow || !sRow.values) {
   continue
  }
  let isMatch = false
  for (let l = 0; l < links.length; l++) {
   const link = links[l]
   const parentVal = parentRow.values[link.targetColumnId]
   const childVal = sRow.values[link.sourceColumnId]
   if (rowFilterValuesMatch(childVal, parentVal, link.sourceColumn, link.targetColumn, tables)) {
    isMatch = true
    break
   }
  }
  if (isMatch) {
   matched.push({
    row: sRow,
    rowIndex: r,
    rowNumber: r + 1,
   })
  }
 }
 return matched
}

export function syncTableRowsInMemory(tables, tableNameOrId, rawRecords, keyColumn = '') {
 const list = Array.isArray(tables) ? tables : []
 const query = String(tableNameOrId || '').trim()
 if (!query) {
  return { ok: false, error: 'Table name or ID is required', count: 0, added: 0, updated: 0, table: null }
 }
 const lowerQuery = query.toLowerCase()
 const table = list.find(t => t && (t.id === query || String(t.name || '').trim().toLowerCase() === lowerQuery)) || null
 if (!table) {
  return { ok: false, error: `Table "${query}" not found`, count: 0, added: 0, updated: 0, table: null }
 }
 if (isReadOnlyRemoteTable(table)) {
  return {
   ok: false,
   changed: false,
   readOnly: true,
   error: `Table "${table.name || query}" is imported as read-only`,
   count: Array.isArray(table.rows) ? table.rows.length : 0,
   added: 0,
   updated: 0,
   removed: 0,
   table,
  }
 }
 const cols = Array.isArray(table.columns) ? table.columns : []
 const existingRows = Array.isArray(table.rows) ? table.rows : []
 const records = Array.isArray(rawRecords) ? rawRecords.filter(r => r && typeof r === 'object') : []

 let keyCol = null
 const cleanKeyCol = String(keyColumn || '').trim()
 if (cleanKeyCol) {
  const lowerKey = cleanKeyCol.toLowerCase()
  keyCol = cols.find(c => c && (c.id === cleanKeyCol || String(c.name || '').trim().toLowerCase() === lowerKey)) || null
 }
 if (!keyCol) {
  const candidateKeys = ['_id', 'id', 'login', 'full_name', 'code', 'name']
  for (const cand of candidateKeys) {
   keyCol = cols.find(c => c && String(c.name || '').trim().toLowerCase() === cand) || null
   if (keyCol) {
    break
   }
  }
 }

 const existingById = new Map()
 for (const row of existingRows) {
  if (row && typeof row.id === 'string' && row.id.trim() !== '') {
   existingById.set(row.id.trim(), row)
  }
 }

 const existingByKey = new Map()
 if (keyCol) {
  for (const row of existingRows) {
   if (!row || !row.values || typeof row.values !== 'object') {
    continue
   }
   const rawKey = row.values[keyCol.id]
   if (rawKey !== null && rawKey !== undefined && String(rawKey).trim() !== '') {
    const normKey = String(rawKey).trim().toLowerCase()
    if (!existingByKey.has(normKey)) {
     existingByKey.set(normKey, row)
    }
   }
  }
 }

 const usedRowIds = new Set()
 const nextRows = []
 let added = 0
 let updated = 0

 const readRecordColValue = (rec, col) => {
  if (Object.hasOwn(rec, col.name)) {
   return { found: true, value: rec[col.name] }
  }
  if (Object.hasOwn(rec, col.id)) {
   return { found: true, value: rec[col.id] }
  }
  const lowerName = String(col.name || '').trim().toLowerCase()
  for (const k of Object.keys(rec)) {
   if (k.trim().toLowerCase() === lowerName) {
    return { found: true, value: rec[k] }
   }
  }
  return { found: false, value: undefined }
 }

 const coerceSyncedValue = (rawVal, col) => {
  const parsedType = parseColumnType(col)
  if (typeof rawVal === 'string' && (parsedType.type === 'fixed' || parsedType.type === 'integer' || parsedType.type === 'decimal' || parsedType.type === 'boolean')) {
   const parsed = parseCellValue(rawVal, parsedType, list)
   if (parsed.ok) {
    return parsed.value
   }
  }
  return coerceDataValue(rawVal, parsedType, parsedType.multiple, null, list)
 }

 for (const rec of records) {
  let matchedRow = null
  const explicitRowId = typeof rec._rowId === 'string' ? rec._rowId.trim() : ''
  if (explicitRowId && existingById.has(explicitRowId) && !usedRowIds.has(explicitRowId)) {
   matchedRow = existingById.get(explicitRowId)
   usedRowIds.add(matchedRow.id)
  }
  if (!matchedRow && keyCol) {
   const keyLookup = readRecordColValue(rec, keyCol)
   if (keyLookup.found && keyLookup.value !== null && keyLookup.value !== undefined) {
    const normKey = String(keyLookup.value).trim().toLowerCase()
    if (normKey && existingByKey.has(normKey)) {
     const candidate = existingByKey.get(normKey)
     if (candidate && !usedRowIds.has(candidate.id)) {
      matchedRow = candidate
      usedRowIds.add(candidate.id)
     }
    }
   }
  }

  const nextValues = matchedRow && matchedRow.values ? { ...matchedRow.values } : {}
  for (const col of cols) {
   const lookup = readRecordColValue(rec, col)
   if (lookup.found) {
    nextValues[col.id] = coerceSyncedValue(lookup.value, col)
   }
   else if (!matchedRow || !Object.hasOwn(nextValues, col.id)) {
    nextValues[col.id] = defaultDataValue(col, col.multiple)
   }
  }

  const rowId = matchedRow ? matchedRow.id : makeSyncedRowId()
  nextRows.push({ id: rowId, values: nextValues })
  if (matchedRow) {
   updated += 1
  }
  else {
   added += 1
  }
 }

 const removed = Math.max(0, existingRows.length - usedRowIds.size)
 let changed = existingRows.length !== nextRows.length || added > 0 || removed > 0
 if (!changed) {
  for (let i = 0; i < nextRows.length; i++) {
   const prevRow = existingRows[i]
   const nextRow = nextRows[i]
   if (!prevRow || !nextRow || prevRow.id !== nextRow.id) {
    changed = true
    break
   }
   const prevVals = prevRow.values && typeof prevRow.values === 'object' ? prevRow.values : {}
   const nextVals = nextRow.values && typeof nextRow.values === 'object' ? nextRow.values : {}
   for (const col of cols) {
    if (!dataValuesEqual(prevVals[col.id], nextVals[col.id], col, col.multiple)) {
     changed = true
     break
    }
   }
   if (changed) {
    break
   }
  }
 }

 if (!Array.isArray(table.rows)) {
  table.rows = []
 }
 table.rows.splice(0, table.rows.length, ...nextRows)

 return {
  ok: true,
  table,
  tableId: table.id,
  tableName: table.name,
  count: nextRows.length,
  added,
  updated,
  removed,
  changed,
 }
}

export function isExpandableValue(value) {
 if (isMaskedSecretValue(value)) {
  return false
 }
 return value !== null && (typeof value === 'object' || typeof value === 'function')
}

function safePrettyJson(value) {
 try {
  const json = JSON.stringify(value, null, 2)
  return json === undefined ? formatValue(value) : json
 }
 catch {
  return formatValue(value)
 }
}

function truncateText(text, maxLen = 36) {
 return text.length > maxLen ? `${text.slice(0, maxLen - 1)}…` : text
}

export function describeValue(value) {
 if (isMaskedSecretValue(value)) {
  const detail = value.secretSet ? `${SECRET_MASK} (secret — cannot reveal)` : '(unset secret)'
  return {
   type: 'secret',
   summary: value.secretSet ? SECRET_MASK : '(unset secret)',
   detail,
   expandable: false,
  }
 }
 if (value === null) {
  return { type: 'null', summary: 'null', detail: 'null', expandable: false }
 }
 if (value === undefined) {
  return { type: 'undefined', summary: 'undefined', detail: 'undefined', expandable: false }
 }
 const t = typeof value
 if (t === 'boolean') {
  const text = String(value)
  return { type: 'boolean', summary: text, detail: text, expandable: false }
 }
 if (t === 'number') {
  const text = Object.is(value, -0) ? '-0' : Number.isNaN(value) ? 'NaN' : String(value)
  return { type: 'number', summary: text, detail: text, expandable: false }
 }
 if (t === 'bigint') {
  const text = `${value}n`
  return { type: 'bigint', summary: text, detail: text, expandable: false }
 }
 if (t === 'symbol') {
  const text = String(value)
  return { type: 'symbol', summary: truncateText(text), detail: text, expandable: false }
 }
 if (t === 'string') {
  const full = JSON.stringify(value)
  return { type: 'string', summary: truncateText(full), detail: full, expandable: false }
 }
 if (t === 'function') {
  if (Array.isArray(value.ast)) {
   const firstNode = value.ast[0]
   const doc = isCommentNode(firstNode) ? String(firstNode[2] ?? '').trim() : ''
   const detail = doc.length > 0 ? `will — ${doc}` : 'will'
   return { type: 'will', summary: 'will', detail, expandable: true }
  }
  const label = value.name ? `fn ${value.name}` : 'fn'
  return { type: 'function', summary: label, detail: label, expandable: true }
 }
 if (Array.isArray(value)) {
  return {
   type: 'list',
   summary: `list{${value.length}}`,
   detail: safePrettyJson(value),
   expandable: true,
  }
 }
 if (value instanceof Date) {
  const text = Number.isNaN(value.getTime()) ? 'invalid date' : value.toISOString()
  return { type: 'date', summary: text, detail: text, expandable: true }
 }
 if (value instanceof RegExp) {
  const text = String(value)
  return { type: 'regexp', summary: text, detail: text, expandable: true }
 }
 if (value instanceof Map) {
  const text = `map{${value.size}}`
  return { type: 'map', summary: text, detail: text, expandable: true }
 }
 if (value instanceof Set) {
  const text = `set{${value.size}}`
  return { type: 'set', summary: text, detail: text, expandable: true }
 }
 if (value instanceof Promise) {
  return { type: 'promise', summary: 'promise', detail: 'promise', expandable: true }
 }
 if (value instanceof Error) {
  const name = value.name || 'Error'
  const detail = value.message ? `${name}: ${value.message}` : name
  return { type: 'error', summary: 'error', detail, expandable: true }
 }
 if (ArrayBuffer.isView(value)) {
  const ctorName = value.constructor && typeof value.constructor.name === 'string' && value.constructor.name.length > 0
   ? value.constructor.name
   : 'bytes'
  return {
   type: 'bytes',
   summary: `bytes{${value.byteLength}}`,
   detail: `${ctorName}{${value.byteLength}}`,
   expandable: true,
  }
 }
 const ctorName = value.constructor && typeof value.constructor.name === 'string' && value.constructor.name.length > 0
  ? value.constructor.name
  : 'Object'
 return {
  type: 'object',
  summary: ctorName === 'Object' ? 'object' : ctorName,
  detail: safePrettyJson(value),
  expandable: true,
 }
}

function compareKeys(a, b, numericFirst = false) {
 if (numericFirst) {
  const aIdx = /^(0|[1-9]\d*)$/.test(a) ? Number(a) : null
  const bIdx = /^(0|[1-9]\d*)$/.test(b) ? Number(b) : null
  if (aIdx !== null && bIdx !== null) {
   return aIdx - bIdx
  }
  if (aIdx !== null) {
   return -1
  }
  if (bIdx !== null) {
   return 1
  }
 }
 const lowerCmp = a.toLowerCase().localeCompare(b.toLowerCase())
 return lowerCmp !== 0 ? lowerCmp : a.localeCompare(b)
}

function makeEntry(key, target, { inherited = false, enumerable = true, overrideValue, hasOverride = false } = {}) {
 try {
  const value = hasOverride ? overrideValue : target[key]
  const desc = describeValue(value)
  return {
   key,
   value,
   error: null,
   type: desc.type,
   summary: desc.summary,
   detail: desc.detail,
   expandable: desc.expandable,
   inherited,
   enumerable,
  }
 }
 catch (err) {
  const message = err instanceof Error ? err.message : String(err)
  return {
   key,
   value: undefined,
   error: message,
   type: 'error',
   summary: 'error',
   detail: message,
   expandable: false,
   inherited,
   enumerable,
  }
 }
}

export function listScopeEntries(target, options = {}) {
 const { isRoot = false, argv = [] } = options
 if (!isExpandableValue(target)) {
  return []
 }

 if (isRoot) {
  const seen = new Set([...FORBIDDEN_PROPERTY_KEYS, 'argv'])
  const keys = []
  let cur = target
  while (cur && !isObjectPrototype(cur) && !isFunctionPrototype(cur)) {
   for (const key of Object.getOwnPropertyNames(cur)) {
    if (!seen.has(key)) {
     seen.add(key)
     keys.push(key)
    }
   }
   cur = Object.getPrototypeOf(cur)
  }
  keys.push('argv')
  keys.sort((a, b) => compareKeys(a, b, false))
  return keys.map(key =>
   key === 'argv'
    ? makeEntry(key, target, { inherited: false, enumerable: true, overrideValue: argv, hasOverride: true })
    : makeEntry(key, target, { inherited: false, enumerable: true })
  )
 }

 const isArr = Array.isArray(target)
 const seen = new Set(FORBIDDEN_PROPERTY_KEYS)
 if (typeof target === 'function') {
  seen.add('caller')
  seen.add('callee')
  seen.add('arguments')
 }

 const ownEnumKeys = []
 const ownNonEnumKeys = []
 for (const key of Object.getOwnPropertyNames(target)) {
  if (seen.has(key)) {
   continue
  }
  seen.add(key)
  const desc = Object.getOwnPropertyDescriptor(target, key)
  if (desc && desc.enumerable) {
   ownEnumKeys.push(key)
  }
  else {
   ownNonEnumKeys.push(key)
  }
 }
 ownEnumKeys.sort((a, b) => compareKeys(a, b, isArr))
 ownNonEnumKeys.sort((a, b) => compareKeys(a, b, false))

 const inheritedKeys = []
 let proto = Object.getPrototypeOf(target)
 while (proto && proto !== Object.prototype && proto !== Function.prototype) {
  for (const key of Object.getOwnPropertyNames(proto)) {
   if (seen.has(key)) {
    continue
   }
   seen.add(key)
   inheritedKeys.push(key)
  }
  proto = Object.getPrototypeOf(proto)
 }
 inheritedKeys.sort((a, b) => compareKeys(a, b, false))

 return [
  ...ownEnumKeys.map(key => makeEntry(key, target, { inherited: false, enumerable: true })),
  ...ownNonEnumKeys.map(key => makeEntry(key, target, { inherited: false, enumerable: false })),
  ...inheritedKeys.map(key => makeEntry(key, target, { inherited: true, enumerable: false })),
 ]
}

export function filterScopeEntries(entries, query = '', options = {}) {
 const list = Array.isArray(entries) ? entries : []
 const q = String(query ?? '').trim().toLowerCase()
 const includeInherited = options.includeInherited !== false
 const selectedKey = options.selectedKey ?? null
 const keepSelected = options.keepSelected === true

 return list.filter(entry => {
  if (!includeInherited && entry.inherited && !(selectedKey !== null && entry.key === selectedKey)) {
   return false
  }
  if (q.length === 0) {
   return true
  }
  if (keepSelected && selectedKey !== null && entry.key === selectedKey) {
   return true
  }
  return String(entry.key ?? '').toLowerCase().includes(q)
 })
}

export function resolveScopeColumns(state, selectedPath = [], options = {}) {
 const rootState = state && typeof state === 'object' ? state : {}
 const pathList = Array.isArray(selectedPath) ? selectedPath : []
 const includeInherited = options.includeInherited !== false
 const filterQuery = String(options.filter ?? '').trim()
 const rootEntries = listScopeEntries(rootState, { isRoot: true, argv: options.argv ?? [] })
 const validPath = []
 const columns = [
  {
   kind: 'entries',
   title: 'scope',
   path: [],
   selectedKey: null,
   valueType: 'scope',
   valueSummary: `${rootEntries.length}`,
   valueDetail: '',
   entries: rootEntries,
   totalCount: rootEntries.length,
   unfilteredCount: rootEntries.length,
   matchCount: rootEntries.length,
   inheritedCount: rootEntries.filter(e => e.inherited).length,
   filtered: false,
  },
 ]

 let currentEntries = rootEntries
 for (let i = 0; i < pathList.length; i++) {
  const seg = String(pathList[i])
  const match = currentEntries.find(entry => entry.key === seg)
  if (!match) {
   break
  }
  columns[columns.length - 1].selectedKey = seg
  validPath.push(seg)
  const nextPath = validPath.slice()
  if (match.expandable && !match.error) {
   const childEntries = listScopeEntries(match.value, { isRoot: false })
   columns.push({
    kind: 'entries',
    title: seg,
    path: nextPath,
    selectedKey: null,
    valueType: match.type,
    valueSummary: match.summary,
    valueDetail: match.detail,
    entries: childEntries,
    totalCount: childEntries.length,
    unfilteredCount: childEntries.length,
    matchCount: childEntries.length,
    inheritedCount: childEntries.filter(e => e.inherited).length,
    filtered: false,
   })
   currentEntries = childEntries
  }
  else {
   columns.push({
    kind: 'value',
    title: seg,
    path: nextPath,
    selectedKey: null,
    value: match.value,
    valueType: match.type,
    valueSummary: match.summary,
    valueDetail: match.detail,
    error: match.error,
   })
   break
  }
 }

 let deepestEntriesIdx = 0
 for (let i = 0; i < columns.length; i++) {
  const col = columns[i]
  if (col.kind !== 'entries') {
   continue
  }
  deepestEntriesIdx = i
  if (!includeInherited && i > 0) {
   col.entries = filterScopeEntries(col.entries, '', {
    includeInherited: false,
    selectedKey: col.selectedKey,
   })
   col.unfilteredCount = col.entries.length
   col.matchCount = col.entries.length
  }
 }

 const requestedIdx = typeof options.filterColumnIndex === 'number' ? options.filterColumnIndex : null
 const filterColumnIndex =
  requestedIdx !== null &&
  requestedIdx >= 0 &&
  requestedIdx < columns.length &&
  columns[requestedIdx].kind === 'entries'
   ? requestedIdx
   : deepestEntriesIdx

 if (filterQuery.length > 0 && filterColumnIndex >= 0 && columns[filterColumnIndex].kind === 'entries') {
  const col = columns[filterColumnIndex]
  col.unfilteredCount = col.entries.length
  col.entries = filterScopeEntries(col.entries, filterQuery, {
   includeInherited: true,
   keepSelected: false,
  })
  col.matchCount = col.entries.length
  col.filtered = true
 }

 return {
  path: validPath,
  columns,
  filterColumnIndex,
 }
}

const RESERVED_BARE_WORDS = new Set(['true', 'false', 'null', 'undefined'])

function quoteFieldToken(value) {
 const str = String(value ?? '')
 if (
  str.length > 0 &&
  /^[A-Za-z0-9_][A-Za-z0-9_-]*$/.test(str) &&
  !str.includes('--') &&
  !RESERVED_BARE_WORDS.has(str)
 ) {
  const num = Number(str)
  if (!(Number.isFinite(num) && String(num) === str)) {
   return str
  }
 }
 const escaped = str
  .replace(/\\/g, '\\\\')
  .replace(/'/g, "\\'")
  .replace(/\n/g, '\\n')
  .replace(/\r/g, '\\r')
  .replace(/\t/g, '\\t')
 return `'${escaped}'`
}

export function formatImportLine(spec = {}) {
 const alias = String(spec.alias ?? '').trim()
 const laneId = String(spec.laneId ?? '').trim()
 const path = Array.isArray(spec.path) ? spec.path.map(seg => String(seg)) : []
 const args = [quoteFieldToken(laneId), ...path.map(quoteFieldToken)].join(' ')
 if (alias.length > 0) {
  return `; to ${quoteFieldToken(alias)} !importLane ${args}`
 }
 return `!importLane ${args}`
}

function isImportInvokeNode(node) {
 return (
  Array.isArray(node) &&
  node.length === 4 &&
  node[0] === '@' &&
  node[1] === 'invoke' &&
  Array.isArray(node[2]) &&
  node[3] === 'importLane' &&
  node[2].every(arg => typeof arg === 'string' || typeof arg === 'number')
 )
}

export function parseImportLine(source) {
 const text = String(source ?? '')
 if (text.trim().length === 0) {
  return null
 }
 try {
  const ast = parse(`${text}\n`)
  const stmts = ast.filter(node => !isCommentNode(node))
  if (stmts.length !== 1) {
   return null
  }
  const stmt = stmts[0]
  if (
   Array.isArray(stmt) &&
   stmt.length === 4 &&
   stmt[0] === '@' &&
   stmt[1] === 'to' &&
   typeof stmt[2] === 'string' &&
   isImportInvokeNode(stmt[3])
  ) {
   const args = stmt[3][2]
   return {
    alias: stmt[2],
    laneId: args.length > 0 ? String(args[0]) : '',
    path: args.slice(1).map(seg => String(seg)),
   }
  }
  if (isImportInvokeNode(stmt)) {
   const args = stmt[2]
   return {
    alias: '',
    laneId: args.length > 0 ? String(args[0]) : '',
    path: args.slice(1).map(seg => String(seg)),
   }
  }
  return null
 }
 catch {
  return null
 }
}

const EXPORT_LINE_FN_NAMES = new Set(['exportLaneLine', 'setLaneLine'])

function normalizeExportTarget(target) {
 if (!target) {
  return null
 }
 if (Array.isArray(target)) {
  if (target.length < 2) {
   return null
  }
  const laneId = String(target[0] ?? '').trim()
  const lineId = String(target[1] ?? '').trim()
  if (!laneId || !lineId) {
   return null
  }
  return { laneId, lineId }
 }
 if (typeof target === 'object') {
  const laneId = String(target.laneId ?? '').trim()
  const lineId = String(target.lineId ?? '').trim()
  if (!laneId || !lineId) {
   return null
  }
  return { laneId, lineId }
 }
 return null
}

export function formatExportLine(spec = {}) {
 const alias = String(spec.alias ?? '').trim()
 const fnName = spec.fnName === 'setLaneLine' ? 'setLaneLine' : 'exportLaneLine'
 const rawTargets = Array.isArray(spec.targets) ? spec.targets : []
 const targets = []
 for (const item of rawTargets) {
  const norm = normalizeExportTarget(item)
  if (norm) {
   targets.push(norm)
  }
 }
 const targetsStr = targets.length > 0
  ? `{ ${targets.map(t => `{ ${quoteFieldToken(t.laneId)} ${quoteFieldToken(t.lineId)} }`).join(' ')} }`
  : '{}'
 const rawExpr = String(spec.contentExpr ?? '').trim()
 let exprStr
 if (rawExpr.length === 0) {
  exprStr = "''"
 }
 else if (rawExpr.startsWith(';') || rawExpr.startsWith('!') || rawExpr.startsWith(':')) {
  exprStr = `[ ${rawExpr} ]`
 }
 else {
  exprStr = rawExpr
 }
 if (alias.length > 0) {
  return `; to ${quoteFieldToken(alias)} !${fnName} ${targetsStr} ${exprStr}`
 }
 return `!${fnName} ${targetsStr} ${exprStr}`
}

function isExportInvokeNode(node) {
 if (
  !Array.isArray(node) ||
  node.length !== 4 ||
  node[0] !== '@' ||
  node[1] !== 'invoke' ||
  !Array.isArray(node[2]) ||
  !EXPORT_LINE_FN_NAMES.has(node[3])
 ) {
  return false
 }
 const args = node[2]
 if (args.length === 2 && Array.isArray(args[0])) {
  return args[0].every(pair =>
   Array.isArray(pair) &&
   pair.length === 2 &&
   (typeof pair[0] === 'string' || typeof pair[0] === 'number') &&
   (typeof pair[1] === 'string' || typeof pair[1] === 'number')
  )
 }
 if (args.length === 3) {
  return (
   (typeof args[0] === 'string' || typeof args[0] === 'number') &&
   (typeof args[1] === 'string' || typeof args[1] === 'number')
  )
 }
 return false
}

function skipWsAndComments(src, start) {
 let i = start
 while (i < src.length) {
  const ch = src[i]
  if (ch === ' ' || ch === '\t' || ch === '\r' || ch === '\n' || ch === ',') {
   i += 1
   continue
  }
  if (
   ch === '-' &&
   src[i + 1] === '-' &&
   (i + 2 === src.length || src[i + 2] === ' ' || src[i + 2] === '\t' || src[i + 2] === '\n' || src[i + 2] === '\r')
  ) {
   i += 2
   while (i < src.length && src[i] !== '\n') {
    i += 1
   }
   continue
  }
  break
 }
 return i
}

function skipFieldTerm(src, startPos) {
 const start = skipWsAndComments(src, startPos)
 if (start >= src.length) {
  return { start, end: start }
 }
 const first = src[start]
 if (first === "'") {
  let i = start + 1
  while (i < src.length) {
   if (src[i] === '\\') {
    i += 2
    continue
   }
   if (src[i] === "'") {
    return { start, end: i + 1 }
   }
   i += 1
  }
  return { start, end: src.length }
 }
 if (first === '{' || first === '[' || first === '(') {
  const stack = [first === '{' ? '}' : first === '[' ? ']' : ')']
  let i = start + 1
  while (i < src.length && stack.length > 0) {
   const ch = src[i]
   if (ch === "'") {
    i += 1
    while (i < src.length) {
     if (src[i] === '\\') {
      i += 2
      continue
     }
     if (src[i] === "'") {
      break
     }
     i += 1
    }
    i += 1
    continue
   }
   if (
    ch === '-' &&
    src[i + 1] === '-' &&
    (i + 2 === src.length || src[i + 2] === ' ' || src[i + 2] === '\t' || src[i + 2] === '\n' || src[i + 2] === '\r')
   ) {
    while (i < src.length && src[i] !== '\n') {
     i += 1
    }
    continue
   }
   if (ch === '{') { stack.push('}') }
   else if (ch === '[') { stack.push(']') }
   else if (ch === '(') { stack.push(')') }
   else if (ch === stack[stack.length - 1]) {
    stack.pop()
    if (stack.length === 0) {
     return { start, end: i + 1 }
    }
   }
   i += 1
  }
  return { start, end: src.length }
 }
 let i = start
 while (i < src.length) {
  const ch = src[i]
  if (
   ch === ' ' || ch === '\t' || ch === '\r' || ch === '\n' || ch === ',' ||
   ch === '{' || ch === '}' || ch === '[' || ch === ']' || ch === '(' || ch === ')' ||
   ch === ';' || ch === ':' || ch === '!' || ch === "'"
  ) {
   break
  }
  i += 1
 }
 return { start, end: i }
}

function unwrapExportContentExpr(raw) {
 const trimmed = String(raw ?? '').trim()
 if (trimmed === "''") {
  return ''
 }
 if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
  const scanned = skipFieldTerm(trimmed, 0)
  if (scanned.start === 0 && scanned.end === trimmed.length) {
   const inner = trimmed.slice(1, -1).trim()
   if (inner.startsWith(';') || inner.startsWith('!') || inner.startsWith(':')) {
    return inner
   }
  }
 }
 return trimmed
}

function extractExportExprFromSource(source, hasAlias, isSingleTarget) {
 let pos = skipWsAndComments(source, 0)
 if (hasAlias) {
  if (source[pos] === ';') {
   pos += 1
  }
  pos = skipFieldTerm(source, pos).end // to
  pos = skipFieldTerm(source, pos).end // alias
  pos = skipWsAndComments(source, pos)
 }
 if (source[pos] === '!') {
  pos += 1
 }
 pos = skipFieldTerm(source, pos).end // exportLaneLine | setLaneLine
 if (isSingleTarget) {
  pos = skipFieldTerm(source, pos).end // laneId
  pos = skipFieldTerm(source, pos).end // lineId
 }
 else {
  pos = skipFieldTerm(source, pos).end // targets list
 }
 pos = skipWsAndComments(source, pos)
 if (pos >= source.length) {
  return ''
 }
 const ch = source[pos]
 if (ch === ';' || ch === ':' || ch === '!') {
  let end = source.length
  for (let i = pos; i < source.length; i++) {
   if (source[i] === "'") {
    const strTerm = skipFieldTerm(source, i)
    i = strTerm.end - 1
    continue
   }
   if (
    source[i] === '-' &&
    source[i + 1] === '-' &&
    (i + 2 === source.length || source[i + 2] === ' ' || source[i + 2] === '\t' || source[i + 2] === '\n' || source[i + 2] === '\r')
   ) {
    end = i
    break
   }
   if (source[i] === '\n' || source[i] === ',') {
    end = i
    break
   }
  }
  return unwrapExportContentExpr(source.slice(pos, end))
 }
 const term = skipFieldTerm(source, pos)
 return unwrapExportContentExpr(source.slice(term.start, term.end))
}

export function parseExportLine(source) {
 const text = String(source ?? '')
 if (text.trim().length === 0) {
  return null
 }
 try {
  const ast = parse(`${text}\n`)
  const stmts = ast.filter(node => !isCommentNode(node))
  if (stmts.length !== 1) {
   return null
  }
  const stmt = stmts[0]
  let alias = ''
  let invokeNode = null
  if (
   Array.isArray(stmt) &&
   stmt.length === 4 &&
   stmt[0] === '@' &&
   stmt[1] === 'to' &&
   typeof stmt[2] === 'string' &&
   isExportInvokeNode(stmt[3])
  ) {
   alias = stmt[2]
   invokeNode = stmt[3]
  }
  else if (isExportInvokeNode(stmt)) {
   invokeNode = stmt
  }
  else {
   return null
  }
  const fnName = invokeNode[3]
  const args = invokeNode[2]
  const isSingleTarget = args.length === 3
  const targets = isSingleTarget
   ? [normalizeExportTarget([args[0], args[1]])].filter(Boolean)
   : args[0].map(normalizeExportTarget).filter(Boolean)
  const contentExpr = extractExportExprFromSource(text, alias.length > 0, isSingleTarget)
  return {
   alias,
   fnName,
   targets,
   contentExpr,
  }
 }
 catch {
  return null
 }
}

export function resolveScopePath(state, path = [], options = {}) {
 const segments = Array.isArray(path) ? path.map(seg => String(seg)) : []
 if (segments.length === 0) {
  return { found: false, value: undefined, error: 'No property selected to import' }
 }
 const root = segments[0]
 let cur
 try {
  assertSafePropertyKey(root, 'resolveScopePath')
  if (root === 'argv') {
   cur = options.argv ?? []
  }
  else if (hasScopeBinding(state, root)) {
   cur = state[root]
  }
  else {
   return { found: false, value: undefined, error: `Property "$${root}" not found in target lane` }
  }
  for (let i = 1; i < segments.length; i++) {
   const seg = segments[i]
   assertSafePropertyKey(seg, 'resolveScopePath')
   if (cur === null || cur === undefined) {
    return {
     found: false,
     value: undefined,
     error: `Property "$${segments.join('.')}" not found in target lane`,
    }
   }
   if (!hasAllowedProperty(cur, seg)) {
    return {
     found: false,
     value: undefined,
     error: `Property "$${segments.join('.')}" not found in target lane`,
    }
   }
   cur = cur[seg]
  }
  return { found: true, value: cur, error: null }
 }
 catch (err) {
  const message = err instanceof Error ? err.message : String(err)
  return { found: false, value: undefined, error: message }
 }
}

const LANE_EXPORT_EXCLUDED_KEYS = new Set([
 'Array',
 'argv',
 'console',
 'data',
 'Date',
 'deployLane',
 'document',
 'exportLaneLine',
 'fetch',
 'importLane',
 'JSON',
 'Math',
 'Number',
 'req',
 'respond',
 'resyncLane',
 'setLaneLine',
 'syncLaneTable',
 'syncTable',
 'tableChange',
 'window',
])

export function extractLaneExports(state) {
 const out = {}
 if (!state || typeof state !== 'object') {
  return out
 }
 const seen = new Set()
 let cur = state
 while (cur && cur !== Object.prototype) {
  for (const key of Object.keys(cur)) {
   if (seen.has(key) || LANE_EXPORT_EXCLUDED_KEYS.has(key)) {
    continue
   }
   seen.add(key)
   out[key] = state[key]
  }
  cur = Object.getPrototypeOf(cur)
 }
 return out
}

export function resolveImportValue(stateResult, path = []) {
 if (!stateResult || !stateResult.ok) {
  throw new Error(stateResult && stateResult.error ? stateResult.error : 'Target lane is not available')
 }
 const segments = Array.isArray(path) ? path.map(seg => String(seg)) : []
 if (segments.length === 0) {
  return extractLaneExports(stateResult.state)
 }
 const resolved = resolveScopePath(stateResult.state, segments)
 if (!resolved.found) {
  throw new Error(resolved.error || 'Imported property not found')
 }
 return resolved.value
}

export function createIdleTracker() {
 let activeCount = 0
 let completed = false
 let waiters = []
 return {
  get running() {
   return activeCount > 0
  },
  get hasCompleted() {
   return completed
  },
  isRunning() {
   return activeCount > 0
  },
  hasRun() {
   return completed
  },
  begin() {
   activeCount += 1
   let ended = false
   return (didComplete = true) => {
    if (ended) {
     return
    }
    ended = true
    activeCount = Math.max(0, activeCount - 1)
    if (didComplete) {
     completed = true
    }
    if (activeCount === 0 && waiters.length > 0) {
     const pending = waiters
     waiters = []
     for (const resolve of pending) {
      resolve()
     }
    }
   }
  },
  whenIdle() {
   if (activeCount === 0) {
    return Promise.resolve()
   }
   return new Promise(resolve => {
    waiters.push(resolve)
   })
  },
  spawn(fn) {
   if (typeof fn !== 'function') {
    return {
     done: true,
     wait() { return Promise.resolve(undefined) },
    }
   }
   const finish = this.begin()
   let settled = false
   let promise
   try {
    promise = Promise.resolve(fn(finish))
   }
   catch (err) {
    promise = Promise.reject(err)
   }
   promise = promise.finally(() => {
    settled = true
    finish(false)
   })
   promise.catch(() => {})
   return {
    get done() { return settled },
    wait() { return promise },
   }
  },
 }
}

export function hasImportCycle(activeTargets, fromId, targetId) {
 if (!fromId || !targetId) {
  return false
 }
 if (fromId === targetId) {
  return true
 }
 const visited = new Set([fromId])
 const stack = [targetId]
 while (stack.length > 0) {
  const cur = stack.pop()
  if (cur === fromId) {
   return true
  }
  if (visited.has(cur)) {
   continue
  }
  visited.add(cur)
  const next = activeTargets && activeTargets[cur]
  if (Array.isArray(next)) {
   for (const id of next) {
    stack.push(id)
   }
  }
  else if (typeof next === 'string' && next.length > 0) {
   stack.push(next)
  }
 }
 return false
}

export function formatValue(value) {
 if (isMaskedSecretValue(value)) {
  return JSON.stringify(value.secretSet ? SECRET_MASK : '(unset secret)')
 }
 if (value === undefined) {
  return 'undefined'
 }
 if (typeof value === 'number' && Number.isNaN(value)) {
  return 'NaN'
 }
 if (typeof value === 'function') {
  return '[function]'
 }
 if (isTransportPacket(value)) {
  const num = (value.index ?? 0) + 1
  const count = value.ast.filter(node => !isCommentNode(node)).length
  const unit = count === 1 ? 'stmt' : 'stmts'
  return `[sent #${num} · ${count} ${unit}]`
 }
 try {
  const json = JSON.stringify(value)
  return json === undefined ? String(value) : json
 }
 catch {
  return String(value)
 }
}

export async function runTransportedScripts(packets, options = {}) {
 const {
  document: doc,
  window: win = doc && doc.defaultView ? doc.defaultView : undefined,
  console: cons = globalThis.console,
  output = null,
  extraEnv = {},
  isCancelled = null,
 } = options
 const browserGlobals = {
  ...extraEnv,
  console: cons,
  document: doc,
  window: win,
  Math: win && win.Math ? win.Math : Math,
  JSON: win && win.JSON ? win.JSON : JSON,
  Date: win && win.Date ? win.Date : Date,
  Intl: win && win.Intl ? win.Intl : globalThis.Intl,
  output,
 }
 const browserState = createNullProtoState(browserGlobals)
 const browserGlobalKeys = new Set(Object.keys(browserState))
 const results = []
 const list = Array.isArray(packets) ? packets : []

 for (let i = 0; i < list.length; i++) {
  if (typeof isCancelled === 'function' && isCancelled()) {
   break
  }
  const raw = list[i]
  let decoded = null
  try {
   decoded = typeof raw === 'string'
    ? deserializeTransportPacket(raw)
    : raw && typeof raw.wire === 'string'
     ? deserializeTransportPacket(raw.wire)
     : deserializeTransportPacket(serializeTransportPacket(raw))
   const bindingKeys = new Set(Object.keys(decoded.bindings || {}))
   const scriptState = createChildScopeState(browserState)
   for (const [k, v] of Object.entries(decoded.bindings || {})) {
    if (!browserGlobalKeys.has(k) && !FORBIDDEN_PROPERTY_KEY_SET.has(k)) {
     scriptState[k] = v
    }
   }
   const runner = field(scriptState, {
    preservePrototype: true,
    argv: decoded.args || [],
    disallowLoad: options.disallowLoad !== false,
   })
   const rawValue = runner.evalBlock(decoded.ast || [])
   const value = isThenable(rawValue) ? await rawValue : rawValue
   if (typeof isCancelled === 'function' && isCancelled()) {
    break
   }
   for (const k of Object.keys(runner.state)) {
    if (!browserGlobalKeys.has(k) && !bindingKeys.has(k) && !FORBIDDEN_PROPERTY_KEY_SET.has(k)) {
     browserState[k] = runner.state[k]
    }
   }
   let appended = false
   if (output && typeof output.appendChild === 'function' && isDomElement(value)) {
    output.appendChild(value)
    appended = true
   }
   results.push({
    index: decoded.index ?? i,
    lineNumber: decoded.lineNumber ?? null,
    value,
    preview: formatValue(value),
    appended,
    error: null,
   })
  }
  catch (err) {
   const message = err && typeof err === 'object' && typeof err.message === 'string' ? err.message : String(err)
   results.push({
    index: decoded && decoded.index != null
     ? decoded.index
     : (raw && typeof raw === 'object' && raw.index != null ? raw.index : i),
    lineNumber: decoded && decoded.lineNumber != null
     ? decoded.lineNumber
     : (raw && typeof raw === 'object' && raw.lineNumber != null ? raw.lineNumber : null),
    value: undefined,
    preview: message,
    appended: false,
    error: message,
   })
  }
 }

 return shieldNonThenable({ results, state: browserState })
}

export function compileFieldScriptLines(linesOrRecords, options = {}) {
 const list = Array.from(linesOrRecords || [])
 const filename = options && typeof options.filename === 'string' && options.filename.length > 0
  ? options.filename
  : 'lane'
 const limits = options && options._limits ? options._limits : normalizeFieldLimits(options && options.limits, options)
 if (hasPositiveLimit(limits.maxScriptLines) && list.length > limits.maxScriptLines) {
  throw makeLimitExceededError(`FieldScript line count exceeds maximum (${limits.maxScriptLines} lines)`, 'maxScriptLines')
 }

 const compiled = []
 const parseCounter = { count: 0 }
 const validateCounter = { count: 0 }
 let totalBytes = 0

 for (let i = 0; i < list.length; i++) {
  const item = list[i]
  const isObj = item !== null && typeof item === 'object'
  const source = isObj
   ? (item.text === null || item.text === undefined ? '' : String(item.text))
   : (item === null || item === undefined ? '' : String(item))
  const lineId = isObj && typeof item.id === 'string' ? item.id : ''
  const lineNumber = i + 1

  if (exceedsUtf8Limit(source, limits.maxLineBytes)) {
   throw makeLimitExceededError(
    `FieldScript line exceeds maximum (${limits.maxLineBytes} bytes)`,
    'maxLineBytes',
    { filename, line: lineNumber, col: 1, sourceLine: source }
   )
  }
  if (hasPositiveLimit(limits.maxScriptBytes)) {
   totalBytes += utf8ByteLengthField(source) + (i > 0 ? 1 : 0)
   if (totalBytes > limits.maxScriptBytes) {
    throw makeLimitExceededError(
     `FieldScript total size exceeds maximum (${limits.maxScriptBytes} bytes)`,
     'maxScriptBytes',
     { filename, line: lineNumber, col: 1, sourceLine: source }
    )
   }
  }

  if (source.trim().length === 0) {
   compiled.push(Object.freeze({
    index: i,
    lineNumber,
    lineId,
    source,
    ast: null,
    stmts: null,
    isEmpty: true,
    isComment: false,
    parseError: null,
   }))
   continue
  }

  try {
   const ast = parse(`${source}\n`, filename, i, {
    _limits: limits,
    _parseCounter: parseCounter,
    _validateCounter: validateCounter,
   })
   if (ast.length === 0) {
    compiled.push(Object.freeze({
     index: i,
     lineNumber,
     lineId,
     source,
     ast: deepFreezeAst(ast),
     stmts: Object.freeze([]),
     isEmpty: true,
     isComment: false,
     parseError: null,
    }))
    continue
   }
   const stmts = ast.filter(node => !isCommentNode(node))
   deepFreezeAst(ast)
   Object.freeze(stmts)
   compiled.push(Object.freeze({
    index: i,
    lineNumber,
    lineId,
    source,
    ast,
    stmts,
    isEmpty: false,
    isComment: stmts.length === 0,
    parseError: null,
   }))
  }
  catch (err) {
   if (err && err[FIELD_LIMIT_EXCEEDED]) {
    throw err
   }
   const message = err instanceof Error ? err.message : String(err)
   compiled.push(Object.freeze({
    index: i,
    lineNumber,
    lineId,
    source,
    ast: null,
    stmts: null,
    isEmpty: false,
    isComment: false,
    parseError: message,
   }))
  }
 }

 return Object.freeze(compiled)
}

export async function runCompiledLines(compiledLines, options = {}) {
 const {
  initialState = {},
  transport = createTransport(),
  lineContext = null,
  lineRecords = null,
  includePreviews = true,
 } = options
 const list = Array.isArray(compiledLines) ? compiledLines : []
 const limits = normalizeFieldLimits(options && options.limits, options)
 const executionBudget = options && options.executionBudget
  ? options.executionBudget
  : createExecutionBudget(limits)

 const rawSecretNames = Array.isArray(options.secretNames)
  ? options.secretNames
  : (Array.isArray(initialState.__secretNames) ? initialState.__secretNames : [])
 const rawSecretValues = Array.isArray(options.secretValues)
  ? options.secretValues
  : (Array.isArray(initialState.__secretValues) ? initialState.__secretValues : [])
 const rawSecretSetNames = Array.isArray(options.secretSetNames)
  ? options.secretSetNames
  : (Array.isArray(initialState.__secretSetNames) ? initialState.__secretSetNames : [])
 const secretNames = rawSecretNames.map(n => String(n || '').trim()).filter(Boolean)
 const secretSetNames = new Set(rawSecretSetNames.map(n => String(n || '').trim()).filter(Boolean))
 const collectedSecretValues = [...rawSecretValues]
 for (const name of secretNames) {
  const v = initialState[name]
  if (typeof v === 'string' && v.length > 0) {
   collectedSecretValues.push(v)
   secretSetNames.add(name)
  }
 }
 const secretValues = normalizeSecretValues(collectedSecretValues)
 const cleanInitialState = initialState && typeof initialState === 'object' ? initialState : {}
 delete cleanInitialState.__secretNames
 delete cleanInitialState.__secretValues
 delete cleanInitialState.__secretSetNames

 const runner = field(cleanInitialState, {
  transport,
  preservePrototype: true,
  limits,
  executionBudget,
  disallowLoad: Boolean(options && options.disallowLoad),
 })
 const onLineStart = options && typeof options.onLineStart === 'function' ? options.onLineStart : null
 const onLineComplete = options && typeof options.onLineComplete === 'function' ? options.onLineComplete : null
 const results = []

 for (let i = 0; i < list.length; i++) {
  const entry = list[i] || {}
  const source = entry.source === undefined || entry.source === null ? '' : String(entry.source)
  const lineNumber = Number.isInteger(entry.lineNumber) ? entry.lineNumber : i + 1
  const lineRecord = Array.isArray(lineRecords) ? lineRecords[i] : null
  const lineId = lineRecord && typeof lineRecord.id === 'string'
   ? lineRecord.id
   : (typeof entry.lineId === 'string' ? entry.lineId : '')
  if (lineContext && typeof lineContext === 'object') {
   lineContext.index = i
   lineContext.lineNumber = lineNumber
   lineContext.lineId = lineId
  }
  if (onLineStart) {
   onLineStart({ index: i, lineNumber, lineId, source })
  }
  if (typeof transport.setLineNumber === 'function') {
   transport.setLineNumber(lineNumber)
  }
  if (entry.parseError) {
   const message = secretValues.length > 0 ? redactSecretText(entry.parseError, secretValues) : entry.parseError
   const resObj = {
    index: i,
    lineNumber,
    source,
    value: undefined,
    preview: message,
    error: message,
    isEmpty: false,
    isComment: false,
   }
   results.push(resObj)
   if (onLineComplete) {
    onLineComplete(resObj)
   }
   continue
  }
  if (entry.isEmpty) {
   const resObj = {
    index: i,
    lineNumber,
    source,
    value: undefined,
    preview: '',
    error: null,
    isEmpty: true,
    isComment: false,
   }
   results.push(resObj)
   if (onLineComplete) {
    onLineComplete(resObj)
   }
   continue
  }
  if (entry.isComment) {
   const resObj = {
    index: i,
    lineNumber,
    source,
    value: undefined,
    preview: '',
    error: null,
    isEmpty: false,
    isComment: true,
   }
   results.push(resObj)
   if (onLineComplete) {
    onLineComplete(resObj)
   }
   continue
  }
  const stmts = Array.isArray(entry.stmts) ? entry.stmts : []
  try {
   let value
   if (stmts.length === 1) {
    const raw = runner.compile(stmts[0])
    value = isThenable(raw) ? await raw : raw
   }
   else {
    value = []
    for (const stmt of stmts) {
     const raw = runner.compile(stmt)
     value.push(isThenable(raw) ? await raw : raw)
    }
   }
   const safeValue = secretValues.length > 0 ? redactSecretValue(value, secretValues) : value
   let preview = ''
   if (includePreviews) {
    const rawPreview = formatValue(safeValue)
    preview = secretValues.length > 0 ? redactSecretText(rawPreview, secretValues) : rawPreview
   }
   const resObj = {
    index: i,
    lineNumber,
    source,
    value: safeValue,
    preview,
    error: null,
    isEmpty: false,
    isComment: false,
   }
   results.push(resObj)
   if (onLineComplete) {
    onLineComplete(resObj)
   }
  }
  catch (err) {
   const rawMessage = err instanceof Error ? err.message : String(err)
   const message = secretValues.length > 0 ? redactSecretText(rawMessage, secretValues) : rawMessage
   const resObj = {
    index: i,
    lineNumber,
    source,
    value: undefined,
    preview: message,
    error: message,
    isEmpty: false,
    isComment: false,
   }
   results.push(resObj)
   if (onLineComplete) {
    onLineComplete(resObj)
   }
   if (executionBudget && executionBudget.exhausted) {
    break
   }
  }
 }
 if (lineContext && typeof lineContext === 'object') {
  lineContext.index = null
  lineContext.lineNumber = null
  lineContext.lineId = ''
 }
 if (typeof transport.setLineNumber === 'function') {
  transport.setLineNumber(null)
 }
 if (secretValues.length > 0) {
  const seen = new WeakMap()
  for (const key of Object.keys(runner.state)) {
   runner.state[key] = redactSecretValue(runner.state[key], secretValues, seen)
  }
 }
 for (const name of secretNames) {
  runner.state[name] = createMaskedSecretValue(name, secretSetNames.has(name))
 }
 const sent = typeof transport.packets === 'function' ? transport.packets() : []
 if (secretValues.length > 0 && Array.isArray(sent)) {
  const seen = new WeakMap()
  for (const pkt of sent) {
   if (pkt && typeof pkt === 'object') {
    if (Array.isArray(pkt.args)) {
     pkt.args = redactSecretValue(pkt.args, secretValues, seen)
    }
    if (pkt.bindings && typeof pkt.bindings === 'object') {
     pkt.bindings = redactSecretValue(pkt.bindings, secretValues, seen)
    }
   }
  }
 }
 return shieldNonThenable({ results, state: runner.state, sent, executionBudget })
}

export async function runLines(lines, options = {}) {
 const compiled = compileFieldScriptLines(lines, {
  filename: options && options.filename ? options.filename : 'lane',
  limits: options && options.limits,
 })
 return runCompiledLines(compiled, options)
}

export function isValidTimeZone(tz, intlObj = globalThis.Intl) {
 if (typeof tz !== 'string') {
  return false
 }
 const trimmed = tz.trim()
 if (!trimmed) {
  return false
 }
 if (!intlObj || typeof intlObj.DateTimeFormat !== 'function') {
  return trimmed === 'UTC' || trimmed.includes('/')
 }
 try {
  new intlObj.DateTimeFormat('en-US', { timeZone: trimmed })
  return true
 }
 catch {
  return false
 }
}

export function getBrowserTimeZone(intlObj = globalThis.Intl) {
 if (intlObj && typeof intlObj.DateTimeFormat === 'function') {
  try {
   const resolved = new intlObj.DateTimeFormat().resolvedOptions()
   const tz = resolved && typeof resolved.timeZone === 'string' ? resolved.timeZone.trim() : ''
   if (tz && isValidTimeZone(tz, intlObj)) {
    return tz
   }
  }
  catch {
   // Fall back to UTC below
  }
 }
 return 'UTC'
}

export function listKnownBrowserTimeZones(intlObj = globalThis.Intl) {
 const seen = new Set()
 const out = []
 const pushTz = candidate => {
  if (typeof candidate !== 'string') {
   return
  }
  const clean = candidate.trim()
  if (!clean || seen.has(clean)) {
   return
  }
  if (isValidTimeZone(clean, intlObj)) {
   seen.add(clean)
   out.push(clean)
  }
 }
 pushTz('UTC')
 pushTz(getBrowserTimeZone(intlObj))
 if (intlObj && typeof intlObj.supportedValuesOf === 'function') {
  try {
   const supported = intlObj.supportedValuesOf('timeZone')
   if (Array.isArray(supported)) {
    for (const tz of supported) {
     pushTz(tz)
    }
   }
  }
  catch {
   // Ignore unsupported key errors
  }
 }
 const rest = out.filter(tz => tz !== 'UTC').sort((a, b) => a.localeCompare(b))
 return ['UTC', ...rest]
}

export function extractTimezoneNames(rawTimezones, intlObj = globalThis.Intl) {
 const out = []
 const seen = new Set()
 const pushCandidate = val => {
  if (typeof val !== 'string') {
   return
  }
  const clean = val.trim()
  if (!clean || seen.has(clean)) {
   return
  }
  if (!isValidTimeZone(clean, intlObj)) {
   return
  }
  seen.add(clean)
  out.push(clean)
 }

 if (!rawTimezones) {
  return out
 }

 if (Array.isArray(rawTimezones)) {
  for (const entry of rawTimezones) {
   if (typeof entry === 'string') {
    pushCandidate(entry)
   }
   else if (entry && typeof entry === 'object') {
    if (typeof entry.name === 'string') {
     pushCandidate(entry.name)
    }
    else if (typeof entry.timezone === 'string') {
     pushCandidate(entry.timezone)
    }
    else if (typeof entry.timeZone === 'string') {
     pushCandidate(entry.timeZone)
    }
    else if (typeof entry.value === 'string') {
     pushCandidate(entry.value)
    }
   }
  }
  return out
 }

 if (typeof rawTimezones === 'object' && Array.isArray(rawTimezones.rows)) {
  const cols = Array.isArray(rawTimezones.columns) ? rawTimezones.columns : []
  const nameCol = cols.find(c => c && typeof c.name === 'string' && c.name.trim().toLowerCase() === 'name')
   || cols.find(c => c && typeof c.name === 'string' && c.name.trim().toLowerCase() === 'timezone')
   || cols.find(c => c && (!c.type || c.type === 'text'))
  if (nameCol && nameCol.id) {
   for (const row of rawTimezones.rows) {
    const rawVal = row && row.values ? row.values[nameCol.id] : undefined
    if (typeof rawVal === 'string') {
     pushCandidate(rawVal)
    }
   }
  }
 }
 return out
}

export function normalizeClockHourFormat(raw, intlObj = globalThis.Intl) {
 if (raw === 24 || raw === false) {
  return '24h'
 }
 if (raw === 12 || raw === true) {
  return '12h'
 }
 if (typeof raw === 'string') {
  const clean = raw.trim().toLowerCase()
  if (clean === '24' || clean === '24h' || clean === '24-hour' || clean === 'h23' || clean === 'h24') {
   return '24h'
  }
  if (clean === '12' || clean === '12h' || clean === '12-hour' || clean === 'h12') {
   return '12h'
  }
 }
 if (intlObj && typeof intlObj.DateTimeFormat === 'function') {
  try {
   const ro = new intlObj.DateTimeFormat(undefined, { hour: 'numeric' }).resolvedOptions()
   if (ro && ro.hour12 === false) {
    return '24h'
   }
  }
  catch {
   // Default to 12h below
  }
 }
 return '12h'
}

export function normalizeClockShowSeconds(raw) {
 if (raw === false || raw === 0) {
  return false
 }
 if (typeof raw === 'string') {
  const clean = raw.trim().toLowerCase()
  if (clean === 'false' || clean === '0' || clean === 'no' || clean === 'off') {
   return false
  }
 }
 return true
}

function formatTimeZoneOffsetAndShort(timeZone, dateObj, intlObj = globalThis.Intl, formatOpts = {}) {
 const hourFormat = normalizeClockHourFormat(formatOpts.hourFormat, intlObj)
 const is12 = hourFormat === '12h'
 const showSeconds = normalizeClockShowSeconds(formatOpts.showSeconds)
 let offset = timeZone === 'UTC' ? 'UTC+00:00' : ''
 let shortZone = timeZone === 'UTC' ? 'UTC' : ''
 let previewTime = ''
 if (!intlObj || typeof intlObj.DateTimeFormat !== 'function') {
  const fallbackSlice = showSeconds ? dateObj.toISOString().slice(11, 19) : dateObj.toISOString().slice(11, 16)
  return { offset: offset || 'UTC', shortZone: shortZone || timeZone, previewTime: fallbackSlice }
 }
 try {
  const offParts = new intlObj.DateTimeFormat('en-US', {
   timeZone,
   timeZoneName: 'shortOffset',
   hour: '2-digit',
   minute: '2-digit',
  }).formatToParts(dateObj)
  const tzPart = offParts.find(p => p.type === 'timeZoneName')
  if (tzPart && tzPart.value) {
   const rawOff = tzPart.value.replace(/^GMT/, 'UTC')
   offset = (rawOff === 'UTC' || rawOff === 'UTC+0' || rawOff === 'UTC-0') ? 'UTC+00:00' : rawOff
  }
 }
 catch {
  // Fallback if shortOffset is unsupported
 }
 try {
  const shortParts = new intlObj.DateTimeFormat(undefined, {
   timeZone,
   hour: '2-digit',
   minute: '2-digit',
   timeZoneName: 'short',
  }).formatToParts(dateObj)
  const snPart = shortParts.find(p => p.type === 'timeZoneName')
  if (snPart && snPart.value) {
   shortZone = snPart.value
  }
  const previewSpec = {
   timeZone,
   hour: '2-digit',
   minute: '2-digit',
   hour12: is12,
   hourCycle: is12 ? 'h12' : 'h23',
  }
  if (showSeconds) {
   previewSpec.second = '2-digit'
  }
  previewTime = new intlObj.DateTimeFormat(undefined, previewSpec).format(dateObj)
 }
 catch {
  previewTime = showSeconds ? dateObj.toISOString().slice(11, 19) : dateObj.toISOString().slice(11, 16)
 }
 return {
  offset: offset || 'UTC',
  shortZone: shortZone || timeZone,
  previewTime,
 }
}

export function buildTopRailTimezoneOptions(rawTimezones, options = {}) {
 const intlObj = options.intl || globalThis.Intl
 const browserTz = options.browserTimeZone && isValidTimeZone(options.browserTimeZone, intlObj)
  ? options.browserTimeZone.trim()
  : getBrowserTimeZone(intlObj)
 const rawNow = options.now !== undefined ? options.now : Date.now()
 const dt = rawNow instanceof Date ? rawNow : new Date(rawNow)
 const safeDate = Number.isNaN(dt.getTime()) ? new Date() : dt
 const configured = extractTimezoneNames(rawTimezones, intlObj)
 const formatOpts = {
  hourFormat: options.hourFormat,
  showSeconds: options.showSeconds !== undefined ? options.showSeconds : false,
 }

 const browserMeta = formatTimeZoneOffsetAndShort(browserTz, safeDate, intlObj, formatOpts)
 const utcMeta = formatTimeZoneOffsetAndShort('UTC', safeDate, intlObj, formatOpts)

 const result = [
  {
   id: 'browser',
   value: 'browser',
   timeZone: browserTz,
   label: `Browser (${browserTz})`,
   shortLabel: browserMeta.shortZone,
   offset: browserMeta.offset,
   previewTime: browserMeta.previewTime,
   isBrowser: true,
   isUtc: false,
   isConfigured: false,
  },
  {
   id: 'UTC',
   value: 'UTC',
   timeZone: 'UTC',
   label: 'UTC',
   shortLabel: 'UTC',
   offset: utcMeta.offset,
   previewTime: utcMeta.previewTime,
   isBrowser: false,
   isUtc: true,
   isConfigured: configured.includes('UTC'),
  },
 ]

 if (configured.length === 0) {
  return result
 }

 for (const tz of configured) {
  if (tz === 'UTC') {
   continue
  }
  const meta = formatTimeZoneOffsetAndShort(tz, safeDate, intlObj, formatOpts)
  result.push({
   id: tz,
   value: tz,
   timeZone: tz,
   label: tz,
   shortLabel: meta.shortZone,
   offset: meta.offset,
   previewTime: meta.previewTime,
   isBrowser: false,
   isUtc: false,
   isConfigured: true,
  })
 }

 return result
}

export function resolveActiveClockTimezone(selectedValue, optionsList, intlObj = globalThis.Intl) {
 const list = Array.isArray(optionsList) && optionsList.length > 0
  ? optionsList
  : buildTopRailTimezoneOptions([], { intl: intlObj })
 const clean = typeof selectedValue === 'string' ? selectedValue.trim() : ''
 if (!clean || clean.toLowerCase() === 'browser') {
  return list[0]
 }
 const exact = list.find(opt => opt && opt.value === clean)
 if (exact) {
  return exact
 }
 const lower = clean.toLowerCase()
 const ci = list.find(opt => opt && typeof opt.value === 'string' && opt.value.toLowerCase() === lower)
 if (ci) {
  return ci
 }
 return list[0]
}

export function filterTimezoneOptions(optionsList, query = '') {
 const list = Array.isArray(optionsList) ? optionsList : []
 const rawQuery = typeof query === 'string' ? query.trim().toLowerCase() : ''
 if (!rawQuery) {
  return [...list]
 }
 const tokens = rawQuery.replace(/_/g, ' ').split(/\s+/).filter(Boolean)
 if (tokens.length === 0) {
  return [...list]
 }
 return list.filter(opt => {
  if (!opt || typeof opt !== 'object') {
   return false
  }
  const hay = [
   opt.label || '',
   opt.timeZone || '',
   opt.value || '',
   opt.shortLabel || '',
   opt.offset || '',
  ]
   .join(' ')
   .toLowerCase()
   .replace(/_/g, ' ')
  return tokens.every(tok => hay.includes(tok))
 })
}

export function formatTopRailClock(nowInput = Date.now(), activeOptionOrTz = 'UTC', intlOrOpts = globalThis.Intl, maybeOpts = {}) {
 const isIntlArg = !intlOrOpts || typeof intlOrOpts.DateTimeFormat === 'function'
 const intlObj = isIntlArg ? (intlOrOpts || globalThis.Intl) : (intlOrOpts.intl || globalThis.Intl)
 const opts = isIntlArg ? (maybeOpts || {}) : intlOrOpts
 const hourFormat = normalizeClockHourFormat(opts.hourFormat, intlObj)
 const is12 = hourFormat === '12h'
 const showSeconds = normalizeClockShowSeconds(opts.showSeconds)

 const dt = nowInput instanceof Date ? nowInput : new Date(nowInput)
 const safeDate = Number.isNaN(dt.getTime()) ? new Date() : dt
 const isObj = activeOptionOrTz && typeof activeOptionOrTz === 'object'
 const rawTz = isObj
  ? (activeOptionOrTz.timeZone || activeOptionOrTz.value || 'UTC')
  : (typeof activeOptionOrTz === 'string' && activeOptionOrTz.trim() ? activeOptionOrTz.trim() : 'UTC')
 const timeZone = isValidTimeZone(rawTz, intlObj) ? rawTz : getBrowserTimeZone(intlObj)
 const label = isObj && activeOptionOrTz.label ? activeOptionOrTz.label : timeZone
 const meta = formatTimeZoneOffsetAndShort(timeZone, safeDate, intlObj, { hourFormat, showSeconds })

 let chipText = ''
 let fullText = ''
 const fallbackTime = showSeconds ? safeDate.toISOString().slice(11, 19) : safeDate.toISOString().slice(11, 16)
 if (intlObj && typeof intlObj.DateTimeFormat === 'function') {
  try {
   const chipSpec = {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: is12,
    hourCycle: is12 ? 'h12' : 'h23',
    timeZoneName: 'short',
   }
   if (showSeconds) {
    chipSpec.second = '2-digit'
   }
   chipText = new intlObj.DateTimeFormat(undefined, chipSpec).format(safeDate)
  }
  catch {
   chipText = `${fallbackTime} ${meta.shortZone}`
  }
  try {
   const fullSpec = {
    timeZone,
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: is12,
    hourCycle: is12 ? 'h12' : 'h23',
    timeZoneName: 'short',
   }
   if (showSeconds) {
    fullSpec.second = '2-digit'
   }
   fullText = new intlObj.DateTimeFormat(undefined, fullSpec).format(safeDate)
  }
  catch {
   fullText = chipText
  }
 }
 else {
  chipText = `${fallbackTime} ${meta.shortZone}`
  fullText = `${safeDate.toISOString().slice(0, 10)} ${chipText}`
 }

 return {
  chipText,
  fullText,
  timeZone,
  label,
  shortZone: meta.shortZone,
  offset: meta.offset,
  hourFormat,
  showSeconds,
  iso: safeDate.toISOString(),
 }
}

export const TOP_RAIL_DEFAULT_PREFIX_IDS = Object.freeze([
 'fullscreen',
 'search',
 'session',
 'packages',
 'servers',
 'preferences',
])

export const TOP_RAIL_CLOCK_ID = 'clock'

export const TOP_RAIL_BUILTIN_IDS = Object.freeze([
 ...TOP_RAIL_DEFAULT_PREFIX_IDS,
 TOP_RAIL_CLOCK_ID,
])

export function resolveTopRailElementId(item, index = 0, usedIds = null) {
 let raw = ''
 if (item && typeof item === 'object' && typeof item.appendChild !== 'function') {
  raw = item.railId ?? item.id ?? item.title ?? (item.row && item.row.title) ?? item.label ?? item.text ?? item.url ?? ''
 }
 else if (typeof item === 'string') {
  raw = item
 }
 const clean = String(raw ?? '').trim()
 let baseId
 if (!clean) {
  baseId = `chip:${index}`
 }
 else if (clean.startsWith('chip:')) {
  const rest = clean.slice(5).trim()
  baseId = rest ? `chip:${rest}` : `chip:${index}`
 }
 else {
  baseId = `chip:${clean}`
 }
 if (usedIds && typeof usedIds.has === 'function' && typeof usedIds.add === 'function') {
  let candidate = baseId
  let suffix = 2
  while (usedIds.has(candidate)) {
   candidate = `${baseId}#${suffix}`
   suffix += 1
  }
  usedIds.add(candidate)
  return candidate
 }
 return baseId
}

export function normalizeTopRailOrder(rawOrder) {
 if (!Array.isArray(rawOrder)) {
  return []
 }
 const out = []
 const seen = new Set()
 for (let i = 0; i < rawOrder.length; i++) {
  const s = rawOrder[i] === null || rawOrder[i] === undefined ? '' : String(rawOrder[i]).trim()
  if (s && !seen.has(s)) {
   seen.add(s)
   out.push(s)
  }
 }
 return out
}

export function normalizeTopRailHidden(rawHidden) {
 if (!rawHidden) {
  return []
 }
 const list = Array.isArray(rawHidden)
  ? rawHidden
  : (rawHidden instanceof Set
   ? [...rawHidden]
   : (typeof rawHidden === 'object'
    ? Object.keys(rawHidden).filter(k => Boolean(rawHidden[k]))
    : []))
 const out = []
 const seen = new Set()
 for (let i = 0; i < list.length; i++) {
  const s = list[i] === null || list[i] === undefined ? '' : String(list[i]).trim()
  if (s && !seen.has(s)) {
   seen.add(s)
   out.push(s)
  }
 }
 return out
}

export function resolveTopRailLayout(options = {}) {
 const rawElements = Array.isArray(options && options.elements) ? options.elements : []
 const normOrder = normalizeTopRailOrder(options && options.order)
 const normHidden = normalizeTopRailHidden(options && options.hidden)
 const usedChipIds = new Set()
 const elementEntries = rawElements.map((item, index) => ({
  id: resolveTopRailElementId(item, index, usedChipIds),
  item,
  index,
  hidden: false,
 }))
 const elementIds = elementEntries.map(e => e.id)
 const defaultIds = [...TOP_RAIL_DEFAULT_PREFIX_IDS, ...elementIds, TOP_RAIL_CLOCK_ID]
 const validSet = new Set(defaultIds)

 let orderedIds
 if (normOrder.length === 0) {
  orderedIds = defaultIds
 }
 else {
  orderedIds = normOrder.filter(id => validSet.has(id))
  const placed = new Set(orderedIds)
  for (let i = 0; i < TOP_RAIL_DEFAULT_PREFIX_IDS.length; i++) {
   const pid = TOP_RAIL_DEFAULT_PREFIX_IDS[i]
   if (!placed.has(pid)) {
    orderedIds.push(pid)
    placed.add(pid)
   }
  }
  for (let i = 0; i < elementIds.length; i++) {
   const cid = elementIds[i]
   if (!placed.has(cid)) {
    let lastChipPos = -1
    for (let j = orderedIds.length - 1; j >= 0; j--) {
     if (orderedIds[j].startsWith('chip:')) {
      lastChipPos = j
      break
     }
    }
    if (lastChipPos >= 0) {
     orderedIds.splice(lastChipPos + 1, 0, cid)
    }
    else {
     const clockPos = orderedIds.indexOf(TOP_RAIL_CLOCK_ID)
     if (clockPos >= 0) {
      orderedIds.splice(clockPos, 0, cid)
     }
     else {
      orderedIds.push(cid)
     }
    }
    placed.add(cid)
   }
  }
  if (!placed.has(TOP_RAIL_CLOCK_ID)) {
   orderedIds.push(TOP_RAIL_CLOCK_ID)
   placed.add(TOP_RAIL_CLOCK_ID)
  }
 }

 const hiddenSet = new Set(normHidden)
 for (let i = 0; i < elementEntries.length; i++) {
  const entry = elementEntries[i]
  if (entry.item && typeof entry.item === 'object' && entry.item.hidden === true) {
   hiddenSet.add(entry.id)
  }
  entry.hidden = hiddenSet.has(entry.id)
 }

 return {
  orderedIds,
  hiddenIds: [...hiddenSet],
  elementEntries,
 }
}

const DATETIME_MONTH_INDEX = {
 jan: 1,
 january: 1,
 feb: 2,
 february: 2,
 mar: 3,
 march: 3,
 apr: 4,
 april: 4,
 may: 5,
 jun: 6,
 june: 6,
 jul: 7,
 july: 7,
 aug: 8,
 august: 8,
 sep: 9,
 sept: 9,
 september: 9,
 oct: 10,
 october: 10,
 nov: 11,
 november: 11,
 dec: 12,
 december: 12,
}

export function zonedWallClockToUtcMs(parts, timeZone = 'UTC', intlObj = globalThis.Intl) {
 if (!parts || typeof parts !== 'object') {
  return NaN
 }
 const year = Number(parts.year)
 const month = Number(parts.month)
 const day = Number(parts.day)
 const hour = parts.hour !== undefined ? Number(parts.hour) : 0
 const minute = parts.minute !== undefined ? Number(parts.minute) : 0
 const second = parts.second !== undefined ? Number(parts.second) : 0
 const millisecond = parts.millisecond !== undefined ? Number(parts.millisecond) : 0
 if (
  !Number.isInteger(year) ||
  !Number.isInteger(month) ||
  !Number.isInteger(day) ||
  !Number.isInteger(hour) ||
  !Number.isInteger(minute) ||
  !Number.isInteger(second) ||
  !Number.isInteger(millisecond)
 ) {
  return NaN
 }
 const targetAsUtc = Date.UTC(year, month - 1, day, hour, minute, second, millisecond)
 const check = new Date(targetAsUtc)
 if (
  check.getUTCFullYear() !== year ||
  check.getUTCMonth() !== month - 1 ||
  check.getUTCDate() !== day ||
  check.getUTCHours() !== hour ||
  check.getUTCMinutes() !== minute ||
  check.getUTCSeconds() !== second
 ) {
  return NaN
 }
 const safeIntl = intlObj && typeof intlObj.DateTimeFormat === 'function' ? intlObj : globalThis.Intl
 const cleanTz = typeof timeZone === 'string' ? timeZone.trim() : ''
 if (!cleanTz || cleanTz === 'UTC' || !safeIntl || typeof safeIntl.DateTimeFormat !== 'function') {
  return targetAsUtc
 }
 try {
  const dtf = new safeIntl.DateTimeFormat('en-US', {
   timeZone: cleanTz,
   year: 'numeric',
   month: '2-digit',
   day: '2-digit',
   hour: '2-digit',
   minute: '2-digit',
   second: '2-digit',
   hour12: false,
   hourCycle: 'h23',
  })
  const offsetAt = ms => {
   const fmtParts = dtf.formatToParts(new Date(ms))
   const map = {}
   for (const p of fmtParts) {
    map[p.type] = p.value
   }
   const h = Number(map.hour)
   const zonedAsUtc = Date.UTC(
    Number(map.year),
    Number(map.month) - 1,
    Number(map.day),
    h === 24 ? 0 : h,
    Number(map.minute),
    Number(map.second),
    millisecond
   )
   return zonedAsUtc - ms
  }
  const guess1 = targetAsUtc - offsetAt(targetAsUtc)
  return targetAsUtc - offsetAt(guess1)
 }
 catch {
  return targetAsUtc
 }
}

function resolveDateInstance(rawInput) {
 if (rawInput instanceof Date) {
  return Number.isNaN(rawInput.getTime()) ? null : rawInput
 }
 let isoInput = rawInput
 if (typeof isoInput === 'number' && Number.isFinite(isoInput) && isoInput > 0) {
  isoInput = new Date(isoInput).toISOString()
 }
 else if (typeof isoInput === 'string' && /^\d+$/.test(isoInput.trim())) {
  const num = Number(isoInput.trim())
  if (Number.isFinite(num) && num > 0) {
   isoInput = new Date(num).toISOString()
  }
 }
 if (typeof isoInput !== 'string' || isoInput.trim().length === 0) {
  return null
 }
 const dt = new Date(isoInput)
 return Number.isNaN(dt.getTime()) ? null : dt
}

function resolveDisplayTimeZone(rawTimeZone, intlObj) {
 const safeIntl = intlObj && typeof intlObj.DateTimeFormat === 'function' ? intlObj : globalThis.Intl
 const clean = typeof rawTimeZone === 'string' ? rawTimeZone.trim() : ''
 if (clean && clean.toLowerCase() !== 'browser' && isValidTimeZone(clean, safeIntl)) {
  return clean
 }
 return getBrowserTimeZone(safeIntl)
}

export function formatTimestampWithZone(isoOrMs, options = {}) {
 const opts = options && typeof options === 'object' ? options : {}
 const dt = resolveDateInstance(isoOrMs)
 if (!dt) {
  return { known: false, display: 'Unknown', iso: '', timeZone: '', hourFormat: '12h' }
 }
 const intlObj = opts.intl && typeof opts.intl.DateTimeFormat === 'function' ? opts.intl : globalThis.Intl
 const hasHourFormat = opts.hourFormat !== undefined && opts.hourFormat !== null && String(opts.hourFormat).trim() !== ''
 const hasHour12 = typeof opts.hour12 === 'boolean'
 const hourFormat = normalizeClockHourFormat(
  hasHourFormat ? opts.hourFormat : (hasHour12 ? opts.hour12 : undefined),
  intlObj
 )
 const is12 = hourFormat === '12h'
 const timeZone = resolveDisplayTimeZone(opts.timeZone, intlObj)
 const showTimeZone = opts.showTimeZone !== false
 const locale = typeof opts.locale === 'string' && opts.locale.trim().length > 0 ? opts.locale.trim() : undefined
 const formatSpec = {
  timeZone,
  year: 'numeric',
  month: 'short',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: is12,
  hourCycle: is12 ? 'h12' : 'h23',
 }
 if (showTimeZone) {
  formatSpec.timeZoneName = 'short'
 }
 let display
 try {
  if (intlObj && typeof intlObj.DateTimeFormat === 'function') {
   display = new intlObj.DateTimeFormat(locale, formatSpec).format(dt).replace(/[\u202f\u00a0]/g, ' ')
  }
  else {
   display = dt.toLocaleString(locale, formatSpec).replace(/[\u202f\u00a0]/g, ' ')
  }
 }
 catch {
  display = dt.toISOString()
 }
 return { known: true, display, iso: dt.toISOString(), timeZone, hourFormat }
}

export function resolveClockDisplayOptions(rawTimezone = 'browser', configuredTimezones = null, rawHourFormat = undefined, intlObj = globalThis.Intl) {
 const safeIntl = intlObj && typeof intlObj.DateTimeFormat === 'function' ? intlObj : globalThis.Intl
 const hourFormat = normalizeClockHourFormat(rawHourFormat, safeIntl)
 if (Array.isArray(configuredTimezones)) {
  const tzOptions = buildTopRailTimezoneOptions(configuredTimezones, {
   intl: safeIntl,
   hourFormat,
   showSeconds: true,
  })
  const activeOpt = resolveActiveClockTimezone(rawTimezone, tzOptions, safeIntl)
  return {
   timeZone: activeOpt.timeZone,
   shortZone: activeOpt.shortLabel,
   offset: activeOpt.offset,
   label: activeOpt.label,
   selectedValue: activeOpt.value,
   hourFormat,
   showTimeZone: true,
   intl: safeIntl,
  }
 }
 const cleanRaw = typeof rawTimezone === 'string' ? rawTimezone.trim() : ''
 const isBrowser = !cleanRaw || cleanRaw.toLowerCase() === 'browser'
 const timeZone = !isBrowser && isValidTimeZone(cleanRaw, safeIntl)
  ? cleanRaw
  : getBrowserTimeZone(safeIntl)
 const meta = formatTimeZoneOffsetAndShort(timeZone, new Date(), safeIntl, { hourFormat, showSeconds: true })
 return {
  timeZone,
  shortZone: timeZone === 'UTC' ? 'UTC' : meta.shortZone,
  offset: meta.offset,
  label: isBrowser ? `Browser (${timeZone})` : timeZone,
  selectedValue: isBrowser ? 'browser' : timeZone,
  hourFormat,
  showTimeZone: true,
  intl: safeIntl,
 }
}

export function formatDatetimePlaceholder(displayOpts = {}) {
 const opts = displayOpts && typeof displayOpts === 'object' ? displayOpts : {}
 const safeIntl = opts.intl && typeof opts.intl.DateTimeFormat === 'function' ? opts.intl : globalThis.Intl
 const hourFormat = normalizeClockHourFormat(opts.hourFormat, safeIntl)
 let shortZone = typeof opts.shortZone === 'string' ? opts.shortZone.trim() : ''
 if (!shortZone && typeof opts.timeZone === 'string' && opts.timeZone.trim()) {
  const tz = resolveDisplayTimeZone(opts.timeZone, safeIntl)
  const meta = formatTimeZoneOffsetAndShort(tz, new Date(), safeIntl, { hourFormat, showSeconds: false })
  shortZone = tz === 'UTC' ? 'UTC' : (meta.shortZone || '')
 }
 const zoneSuffix = shortZone ? ` ${shortZone}` : ''
 return hourFormat === '24h'
  ? `YYYY-MM-DD HH:mm${zoneSuffix}`
  : `YYYY-MM-DD hh:mm AM${zoneSuffix}`
}

export function formatDatetimeLocalInTimeZone(value, timeZone = 'UTC', intlObj = globalThis.Intl) {
 const dt = resolveDateInstance(value)
 if (!dt) {
  return ''
 }
 const safeIntl = intlObj && typeof intlObj.DateTimeFormat === 'function' ? intlObj : globalThis.Intl
 const tz = resolveDisplayTimeZone(timeZone, safeIntl)
 if (safeIntl && typeof safeIntl.DateTimeFormat === 'function') {
  try {
   const parts = new safeIntl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    hourCycle: 'h23',
   }).formatToParts(dt)
   const map = {}
   for (const p of parts) {
    map[p.type] = p.value
   }
   const hh = map.hour === '24' ? '00' : map.hour
   return `${map.year}-${map.month}-${map.day}T${hh}:${map.minute}:${map.second}`
  }
  catch {
   // Fall back to UTC slice below
  }
 }
 return dt.toISOString().slice(0, 19)
}

function resolveParsedHour24(rawHour, meridiem) {
 const h = Number(rawHour)
 if (!Number.isInteger(h)) {
  return NaN
 }
 if (!meridiem) {
  return h >= 0 && h <= 23 ? h : NaN
 }
 if (h < 1 || h > 12) {
  return NaN
 }
 const upper = meridiem.toUpperCase()
 if (upper === 'AM') {
  return h === 12 ? 0 : h
 }
 if (upper === 'PM') {
  return h === 12 ? 12 : h + 12
 }
 return NaN
}

const KNOWN_TZ_ABBR_OFFSETS_MIN = {
 EST: -300,
 EDT: -240,
 CDT: -300,
 MST: -420,
 MDT: -360,
 PST: -480,
 PDT: -420,
 AKST: -540,
 AKDT: -480,
 HST: -600,
 JST: 540,
 KST: 540,
 CET: 60,
 CEST: 120,
 EET: 120,
 EEST: 180,
}

function applyParsedZoneOrOffset(parts, rawZone, defaultTimeZone, intlObj) {
 const cleanZone = typeof rawZone === 'string' ? rawZone.trim() : ''
 if (/^(?:Z|UTC|GMT)$/i.test(cleanZone)) {
  return zonedWallClockToUtcMs(parts, 'UTC', intlObj)
 }
 const offMatch = cleanZone.match(/^(?:GMT|UTC)?([+-])(\d{1,2})(?::?(\d{2}))?$/i)
 if (offMatch) {
  const sign = offMatch[1] === '-' ? -1 : 1
  const oh = Number(offMatch[2])
  const om = offMatch[3] ? Number(offMatch[3]) : 0
  if (oh > 23 || om > 59) {
   return NaN
  }
  const baseUtc = zonedWallClockToUtcMs(parts, 'UTC', intlObj)
  if (Number.isNaN(baseUtc)) {
   return NaN
  }
  return baseUtc - sign * ((oh * 60 + om) * 60000)
 }
 const defaultMs = zonedWallClockToUtcMs(parts, defaultTimeZone, intlObj)
 if (!cleanZone) {
  return defaultMs
 }
 const upperZone = cleanZone.toUpperCase()
 if (Number.isFinite(defaultMs)) {
  const meta = formatTimeZoneOffsetAndShort(defaultTimeZone, new Date(defaultMs), intlObj)
  if (meta.shortZone && meta.shortZone.toUpperCase() === upperZone) {
   return defaultMs
  }
 }
 if (Object.hasOwn(KNOWN_TZ_ABBR_OFFSETS_MIN, upperZone)) {
  const baseUtc = zonedWallClockToUtcMs(parts, 'UTC', intlObj)
  return Number.isNaN(baseUtc) ? NaN : baseUtc - KNOWN_TZ_ABBR_OFFSETS_MIN[upperZone] * 60000
 }
 return defaultMs
}

export function parseDatetimeInTimeZone(raw, options = {}) {
 if (raw instanceof Date) {
  return Number.isNaN(raw.getTime())
   ? { ok: false, value: '', error: 'Expected date & time (e.g. YYYY-MM-DD HH:mm)' }
   : { ok: true, value: raw.toISOString(), error: null }
 }
 const trimmed = raw === null || raw === undefined ? '' : String(raw).replace(/[\u202f\u00a0]/g, ' ').trim()
 if (trimmed === '') {
  return { ok: true, value: '', error: null }
 }
 const opts = typeof options === 'string' ? { timeZone: options } : (options && typeof options === 'object' ? options : {})
 const safeIntl = opts.intl && typeof opts.intl.DateTimeFormat === 'function' ? opts.intl : globalThis.Intl
 const defaultTz = resolveDisplayTimeZone(opts.timeZone, safeIntl)

 const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})[T\s]+(\d{1,2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3})\d*)?)?(?:\s*(AM|PM))?(?:\s*(Z|[+-]\d{2}:?\d{2}|(?:GMT|UTC)(?:[+-]\d{1,2}(?::?\d{2})?)?|[A-Za-z]{2,6}))?$/i)
 if (isoMatch) {
  const hour = resolveParsedHour24(isoMatch[4], isoMatch[8])
  if (!Number.isNaN(hour)) {
   const ms = applyParsedZoneOrOffset({
    year: Number(isoMatch[1]),
    month: Number(isoMatch[2]),
    day: Number(isoMatch[3]),
    hour,
    minute: Number(isoMatch[5]),
    second: isoMatch[6] ? Number(isoMatch[6]) : 0,
    millisecond: isoMatch[7] ? Number(isoMatch[7].padEnd(3, '0')) : 0,
   }, isoMatch[9], defaultTz, safeIntl)
   if (!Number.isNaN(ms)) {
    return { ok: true, value: new Date(ms).toISOString(), error: null }
   }
  }
  return { ok: false, value: trimmed, error: 'Expected date & time (e.g. YYYY-MM-DD HH:mm)' }
 }

 const monFirst = trimmed.match(/^([A-Za-z]+)\.?\s+(\d{1,2}),?\s+(\d{4})(?:,\s*|\s+at\s+|\s+)(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\s*(AM|PM))?(?:\s*((?:GMT|UTC)(?:[+-]\d{1,2}(?::?\d{2})?)?|[A-Za-z]{2,6}|[+-]\d{2}:?\d{2}))?$/i)
 if (monFirst) {
  const month = DATETIME_MONTH_INDEX[monFirst[1].toLowerCase()]
  const hour = resolveParsedHour24(monFirst[4], monFirst[7])
  if (month && !Number.isNaN(hour)) {
   const ms = applyParsedZoneOrOffset({
    year: Number(monFirst[3]),
    month,
    day: Number(monFirst[2]),
    hour,
    minute: Number(monFirst[5]),
    second: monFirst[6] ? Number(monFirst[6]) : 0,
    millisecond: 0,
   }, monFirst[8], defaultTz, safeIntl)
   if (!Number.isNaN(ms)) {
    return { ok: true, value: new Date(ms).toISOString(), error: null }
   }
  }
  return { ok: false, value: trimmed, error: 'Expected date & time (e.g. YYYY-MM-DD HH:mm)' }
 }

 const dayFirst = trimmed.match(/^(\d{1,2})\s+([A-Za-z]+)\.?,?\s+(\d{4})(?:,\s*|\s+at\s+|\s+)(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\s*(AM|PM))?(?:\s*((?:GMT|UTC)(?:[+-]\d{1,2}(?::?\d{2})?)?|[A-Za-z]{2,6}|[+-]\d{2}:?\d{2}))?$/i)
 if (dayFirst) {
  const month = DATETIME_MONTH_INDEX[dayFirst[2].toLowerCase()]
  const hour = resolveParsedHour24(dayFirst[4], dayFirst[7])
  if (month && !Number.isNaN(hour)) {
   const ms = applyParsedZoneOrOffset({
    year: Number(dayFirst[3]),
    month,
    day: Number(dayFirst[1]),
    hour,
    minute: Number(dayFirst[5]),
    second: dayFirst[6] ? Number(dayFirst[6]) : 0,
    millisecond: 0,
   }, dayFirst[8], defaultTz, safeIntl)
   if (!Number.isNaN(ms)) {
    return { ok: true, value: new Date(ms).toISOString(), error: null }
   }
  }
  return { ok: false, value: trimmed, error: 'Expected date & time (e.g. YYYY-MM-DD HH:mm)' }
 }

 return { ok: false, value: trimmed, error: 'Expected date & time (e.g. YYYY-MM-DD HH:mm)' }
}
