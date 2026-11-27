import { spawn } from 'node:child_process'
import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { httpKV, withKvTriggers } from './data.mjs'
import { verifyApiSessionToken } from './data-proxy.mjs'
import { hasJsonContentType, isAllowedLocalHost, isAllowedLocalOrigin } from './http-security.mjs'
import { normalizeCivilMemoryBaseUrl } from './lane-server.mjs'
import { createTerminalManager } from './pty-terminal.mjs'
import {
 getDefaultServerSecretStore,
 normalizeDomainName,
 normalizeServiceSlug,
 normalizeSubpath,
 writeLaneSyncBundleToKv,
} from './storage.mjs'

const MAX_JSON_BODY_BYTES = 8 * 1024 * 1024
const REPO_DIR = path.dirname(fileURLToPath(import.meta.url))
const SHELL_META_RE = /[\s\0`"$\\;|&<>(){}*?!~\r\n]/
const SAFE_USER_RE = /^[A-Za-z0-9._-]+$/
const SAFE_HOST_RE = /^[A-Za-z0-9.:[\]-]+$/
const SAFE_EMAIL_RE = /^[^\s@'"\\;<>`]+@[^\s@'"\\;<>`]+\.[^\s@'"\\;<>`]+$/
const SAFE_RUNTIME_MJS_RE = /^[A-Za-z0-9._-]+\.mjs$/

export const DEPLOY_RUNTIME_BASE_FILES = Object.freeze([
 'field.mjs',
 'data.mjs',
 'kv-config.mjs',
 'storage.mjs',
 'sandbox.mjs',
 'source-worker.mjs',
 'lane-http.mjs',
 'lane-server.mjs',
])

export function extractLocalMjsImports(sourceText) {
 const src = String(sourceText || '')
 const found = new Set()
 const patterns = [
  /(?:^|[\r\n;])\s*(?:import|export)\s+(?:\*\s*(?:as\s+[A-Za-z0-9_$]+\s+)?from\s+|[A-Za-z0-9_$]+(?:\s*,\s*\{[^{};]*\})?\s+from\s+|\{[^{};]*\}\s+from\s+)?['"]\.\/([A-Za-z0-9._-]+\.mjs)['"]/g,
  /\bimport\s*\(\s*['"]\.\/([A-Za-z0-9._-]+\.mjs)['"]\s*\)/g,
  /new\s+URL\s*\(\s*['"]\.\/([A-Za-z0-9._-]+\.mjs)['"]\s*,\s*import\.meta\.url\s*\)/g,
 ]
 for (const re of patterns) {
  let match
  while ((match = re.exec(src)) !== null) {
   if (SAFE_RUNTIME_MJS_RE.test(match[1])) {
    found.add(match[1])
   }
  }
 }
 if (src.includes("'source-worker.mjs'") || src.includes('"source-worker.mjs"')) {
  found.add('source-worker.mjs')
 }
 return Array.from(found)
}

export function resolveBundledRuntimeFileNames(runtimeFiles, { requiredBase = [], entryFiles = [] } = {}) {
 if (!runtimeFiles || typeof runtimeFiles !== 'object' || Array.isArray(runtimeFiles)) {
  throw new Error('runtimeFiles must be an object')
 }
 for (const name of requiredBase) {
  if (typeof runtimeFiles[name] !== 'string' || runtimeFiles[name].length === 0) {
   throw new Error(`Missing runtime file content for ${name}`)
  }
 }
 const queue = []
 const visited = new Set()
 for (const name of [...requiredBase, ...entryFiles]) {
  if (typeof runtimeFiles[name] === 'string' && runtimeFiles[name].length > 0 && !visited.has(name)) {
   visited.add(name)
   queue.push(name)
  }
 }
 while (queue.length > 0) {
  const file = queue.shift()
  const deps = extractLocalMjsImports(runtimeFiles[file])
  for (const dep of deps) {
   if (typeof runtimeFiles[dep] !== 'string' || runtimeFiles[dep].length === 0) {
    throw new Error(`Missing runtime file content for ${dep} (imported by ${file})`)
   }
   if (!visited.has(dep)) {
    visited.add(dep)
    queue.push(dep)
   }
  }
 }
 const available = Object.keys(runtimeFiles).filter(
  name => SAFE_RUNTIME_MJS_RE.test(name) && typeof runtimeFiles[name] === 'string' && runtimeFiles[name].length > 0
 )
 const availableSet = new Set(available)
 const ordered = []
 const added = new Set()
 for (const name of DEPLOY_RUNTIME_BASE_FILES) {
  if (availableSet.has(name) && !added.has(name)) {
   ordered.push(name)
   added.add(name)
  }
 }
 for (const name of available.slice().sort()) {
  if (!added.has(name)) {
   ordered.push(name)
   added.add(name)
  }
 }
 return ordered
}

export const defaultTerminalManager = createTerminalManager()

export function shellQuote(value) {
 const str = String(value === null || value === undefined ? '' : value)
 return `'${str.replace(/'/g, `'\\''`)}'`
}

function expandHomeForLocalPath(rawPath) {
 const trimmed = String(rawPath || '').trim()
 if (!trimmed) {
  return ''
 }
 if (trimmed === '~') {
  return os.homedir()
 }
 if (trimmed.startsWith('~/')) {
  return path.join(os.homedir(), trimmed.slice(2))
 }
 return trimmed
}

export function validateSshTarget(raw = {}) {
 const host = String(raw.host || '').trim()
 if (!host || host.startsWith('-') || SHELL_META_RE.test(host) || !SAFE_HOST_RE.test(host)) {
  throw new Error('Invalid SSH host')
 }
 const user = String(raw.user || 'root').trim()
 if (!user || user.startsWith('-') || SHELL_META_RE.test(user) || !SAFE_USER_RE.test(user)) {
  throw new Error('Invalid SSH username')
 }
 const rawPort = raw.sshPort === undefined || raw.sshPort === null || raw.sshPort === '' ? 22 : Number(raw.sshPort)
 if (!Number.isInteger(rawPort) || rawPort < 1 || rawPort > 65535) {
  throw new Error('Invalid SSH port')
 }
 const rawIdentity = String(raw.identityFile || '').trim()
 let identityFile = ''
 if (rawIdentity) {
  if (rawIdentity.startsWith('-') || /[\0\r\n]/.test(rawIdentity)) {
   throw new Error('Invalid SSH identity file path')
  }
  identityFile = expandHomeForLocalPath(rawIdentity)
 }
 return {
  host,
  user,
  sshPort: rawPort,
  identityFile,
 }
}

export function buildSshBaseArgs(target) {
 const clean = validateSshTarget(target)
 const args = ['-p', String(clean.sshPort)]
 if (clean.identityFile) {
  args.push('-i', clean.identityFile)
 }
 return args
}

function normalizeRemoteDirPath(rawPath, fallback = '/opt/civil-command') {
 const trimmed = String(rawPath || fallback).trim()
 if (!trimmed || /[\0\r\n]/.test(trimmed) || !trimmed.startsWith('/')) {
  throw new Error(`Invalid absolute remote path: ${rawPath}`)
 }
 return trimmed.replace(/\/+$/, '') || '/'
}

function encodeBase64(text) {
 return Buffer.from(String(text ?? ''), 'utf8').toString('base64')
}

export function generateCivilMemoryServerScript() {
 return String.raw`import fs from 'node:fs'
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises'
import http from 'node:http'
import { createRequire } from 'node:module'
import path, { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)
const loadErrors = []
const attemptedPaths = []

function extractFactory(mod, names, fallbackDefaultRegex = null) {
 if (!mod || (typeof mod !== 'object' && typeof mod !== 'function')) {
  return null
 }
 const candidates = [mod]
 if (mod.default && (typeof mod.default === 'object' || typeof mod.default === 'function')) {
  candidates.push(mod.default)
 }
 for (const obj of candidates) {
  for (const name of names) {
   if (typeof obj[name] === 'function') {
    return obj[name]
   }
  }
  if (obj.kv && typeof obj.kv === 'object') {
   for (const name of names) {
    if (typeof obj.kv[name] === 'function') {
     return obj.kv[name]
    }
   }
  }
 }
 if (fallbackDefaultRegex && typeof mod.default === 'function') {
  return mod.default
 }
 return null
}

async function tryLoadModule(relOrAbsPath) {
 const absPath = path.isAbsolute(relOrAbsPath) ? relOrAbsPath : path.resolve(__dirname, relOrAbsPath)
 if (!fs.existsSync(absPath)) {
  return null
 }
 attemptedPaths.push(relOrAbsPath)
 try {
  return await import(pathToFileURL(absPath).href)
 }
 catch (esmErr) {
  try {
   return require(absPath)
  }
  catch (cjsErr) {
   const msg = (cjsErr && cjsErr.message ? cjsErr.message : String(cjsErr)) || (esmErr && esmErr.message ? esmErr.message : String(esmErr))
   loadErrors.push(relOrAbsPath + ': ' + msg)
   return null
  }
 }
}

function readPkgMetadata() {
 const pkgPath = path.join(__dirname, 'package.json')
 if (!fs.existsSync(pkgPath)) {
  return { main: '', exports: null, candidates: [] }
 }
 try {
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'))
  const candidates = []
  if (typeof pkg.main === 'string') {
   candidates.push(pkg.main)
  }
  if (typeof pkg.module === 'string') {
   candidates.push(pkg.module)
  }
  const walkExports = node => {
   if (typeof node === 'string') {
    candidates.push(node)
   }
   else if (node && typeof node === 'object') {
    for (const val of Object.values(node)) {
     walkExports(val)
    }
   }
  }
  if (pkg.exports) {
   walkExports(pkg.exports)
  }
  return { main: pkg.main || '', exports: pkg.exports || null, candidates }
 }
 catch {
  return { main: '', exports: null, candidates: [] }
 }
}

function listBuildJsFiles(relRoot = 'dist') {
 const start = path.resolve(__dirname, relRoot)
 const out = []
 if (!fs.existsSync(start)) {
  return out
 }
 const skipSegRe = /(?:^|[/\\])(?:node_modules|\.git|test|tests|__tests__|spec|cli|bin|server)(?:[./\\]|$)/i
 const walk = dir => {
  let entries = []
  try {
   entries = fs.readdirSync(dir, { withFileTypes: true })
  }
  catch {
   return
  }
  entries.sort((a, b) => a.name.localeCompare(b.name))
  for (const ent of entries) {
   if (ent.name === 'node_modules' || ent.name === '.git') {
    continue
   }
   const full = path.join(dir, ent.name)
   const rel = path.relative(__dirname, full).replace(/\\/g, '/')
   if (ent.isDirectory()) {
    walk(full)
   }
   else if (/\.(mjs|js|cjs)$/i.test(ent.name) && !skipSegRe.test(rel)) {
    out.push(rel)
   }
  }
 }
 walk(start)
 return out
}

const pkgMeta = readPkgMetadata()
let diskKV = null
let volatileKV = null
let httpKV = null
let civilMemoryKV = null
let diskSourcePath = ''
let resolvedFactoryName = ''

const seenFiles = new Set()
async function inspectCandidate(relPath) {
 const norm = String(relPath || '').trim()
 if (!norm || seenFiles.has(norm)) {
  return
 }
 seenFiles.add(norm)
 const mod = await tryLoadModule(norm)
 if (!mod) {
  return
 }
 if (!diskKV) {
  const fn = extractFactory(mod, ['diskKV', 'createDiskKV', 'diskKv'], /[/\\]disk(?:kv)?\.(?:mjs|js|cjs)$/i.test(norm))
  if (fn) {
   diskKV = fn
   diskSourcePath = norm
   resolvedFactoryName = 'diskKV'
  }
 }
 if (!volatileKV) {
  const fn = extractFactory(mod, ['volatileKV', 'createVolatileKV', 'volatileKv'], /[/\\]volatile(?:kv)?\.(?:mjs|js|cjs)$/i.test(norm))
  if (fn) {
   volatileKV = fn
  }
 }
 if (!httpKV) {
  const fn = extractFactory(mod, ['httpKV', 'createHttpKV', 'httpKv'], /[/\\]http(?:kv)?\.(?:mjs|js|cjs)$/i.test(norm))
  if (fn) {
   httpKV = fn
  }
 }
 if (!civilMemoryKV) {
  const fn = extractFactory(mod, ['civilMemoryKV', 'createCivilMemoryKV', 'civilMemoryKv'], /civil.?memory/i.test(norm))
  if (fn) {
   civilMemoryKV = fn
   if (!resolvedFactoryName) {
    diskSourcePath = norm
    resolvedFactoryName = 'civilMemoryKV'
   }
  }
 }
}

const primaryCandidates = [
 './dist/kv/diskKV.js',
 './dist/kv/volatileKV.js',
 './dist/kv/httpKV.js',
 ...pkgMeta.candidates,
 './dist/index.js',
 './dist/index.mjs',
 './dist/index.cjs',
 './dist/src/index.js',
 './dist/src/index.mjs',
 './dist/src/index.cjs',
 './dist/kv/index.js',
 './dist/kv/index.mjs',
 './dist/kv/disk.js',
 './dist/kv/disk/index.js',
 './dist/kv/volatile.js',
 './dist/kv/volatile/index.js',
 './dist/diskKV.js',
 './dist/disk.js',
 './dist/volatileKV.js',
 './dist/volatile.js',
 './dist/civil-memory.js',
 './dist/civilMemoryKV.js',
 './dist/kv.js',
]

for (const cand of primaryCandidates) {
 if (diskKV && volatileKV && httpKV) {
  break
 }
 await inspectCandidate(cand)
}

if (!diskKV && !civilMemoryKV) {
 const distFiles = listBuildJsFiles('dist')
 const buildFiles = distFiles.length > 0 ? distFiles : listBuildJsFiles('build')
 const prioritized = []
 const secondary = []
 for (const rel of buildFiles) {
  let content = ''
  try {
   content = fs.readFileSync(path.resolve(__dirname, rel), 'utf8')
  }
  catch {}
  if (/\.listen\s*\(/.test(content)) {
   continue
  }
  if (/diskKV|civilMemoryKV|volatileKV/.test(content)) {
   prioritized.push(rel)
  }
  else {
   secondary.push(rel)
  }
 }
 for (const rel of [...prioritized, ...secondary]) {
  if ((diskKV && volatileKV) || (civilMemoryKV && volatileKV)) {
   break
  }
  await inspectCandidate(rel)
 }
}

if (!diskKV && !civilMemoryKV) {
 const diag = {
  packageMain: pkgMeta.main,
  packageExports: pkgMeta.exports,
  attemptedPaths,
  distFiles: listBuildJsFiles('dist'),
  loadErrors,
 }
 throw new Error('Could not load diskKV or civilMemoryKV from @tagmein/civil-memory: ' + JSON.stringify(diag))
}

function createMapVolatileFallback() {
 const store = new Map()
 return {
  async get(key) {
   return store.has(key) ? store.get(key) : null
  },
  async set(key, value) {
   store.set(key, String(value ?? ''))
  },
  async delete(key) {
   store.delete(key)
  },
 }
}

const HOST = process.env.HOST || '127.0.0.1'
const PORT = Number(process.env.PORT || 3333)
const DEFAULT_BASE_PATH = path.resolve(process.env.DEFAULT_BASE_PATH || '/opt/civil-command/data')

const DEFAULT_TRIGGER_RULES_DEF = [
 {
  id: 'lane-split-script',
  match: [
   'lanes#<laneId>/script',
   'lanes#<laneId>/script/**',
   'lanes#<laneId>/script-index',
   'lanes#<laneId>/script-index.chunks/**',
   'lanes#<laneId>/script-pages/**',
  ],
  target: 'triggers#lanes/<laneId>',
  encodeTarget: false,
 },
 {
  id: 'lane-split-tables',
  match: [
   'lanes#<laneId>/tables',
   'lanes#<laneId>/tables/**',
   'lanes#<laneId>/tables-index',
   'lanes#<laneId>/tables-index.chunks/**',
   'lanes#<laneId>/tables-pages/**',
  ],
  exclude: [
   'lanes#<laneId>/tables/*/updates',
   'lanes#<laneId>/tables/*/updates/**',
   'lanes#<laneId>/tables/*/updates.chunks/**',
   'lanes#<laneId>/tables/*/updates-*',
   'lanes#<laneId>/tables/*/updates-pages/**',
  ],
  target: 'triggers#lanes/<laneId>',
  encodeTarget: false,
 },
 {
  id: 'lane-legacy-meta',
  match: [
   '<laneId>.title',
   '<laneId>.title.chunks/**',
   '<laneId>.inputs',
   '<laneId>.inputs.chunks/**',
   '<laneId>.script',
   '<laneId>.script.chunks/**',
   '<laneId>.tables',
   '<laneId>.tables.chunks/**',
  ],
  target: 'triggers#lanes/<laneId>',
  encodeTarget: true,
 },
]

function encodeTriggerSegment(segment) {
 return encodeURIComponent(String(segment)).replace(/\./g, '%2E')
}

function compileTrigPattern(rawPattern) {
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
  regexStr += pat[i].replace(/[.*+?^$()|[\]\\{}]/g, '\\$&')
  i += 1
 }
 regexStr += '$'
 return { regex: new RegExp(regexStr), captureNames }
}

function loadTriggerConfig() {
 const flagRaw = String(process.env.CC_TRIGGERS === undefined ? 'true' : process.env.CC_TRIGGERS).trim().toLowerCase()
 if (flagRaw === '0' || flagRaw === 'false' || flagRaw === 'off' || flagRaw === 'no' || flagRaw === 'none') {
  return { enabled: false, rules: [] }
 }
 let rawRules = DEFAULT_TRIGGER_RULES_DEF
 const jsonEnv = process.env.CC_TRIGGERS_JSON ? String(process.env.CC_TRIGGERS_JSON).trim() : ''
 if (jsonEnv) {
  try {
   const parsed = JSON.parse(jsonEnv)
   if (Array.isArray(parsed)) {
    rawRules = parsed
   }
  }
  catch {}
 }
 else {
  const cfgPath = path.join(__dirname, 'triggers.json')
  if (fs.existsSync(cfgPath)) {
   try {
    const parsed = JSON.parse(fs.readFileSync(cfgPath, 'utf8'))
    if (Array.isArray(parsed)) {
     rawRules = parsed
    }
   }
   catch {}
  }
 }
 const compiled = []
 for (let i = 0; i < rawRules.length; i++) {
  const r = rawRules[i]
  if (!r || typeof r !== 'object') {
   continue
  }
  const target = typeof r.target === 'string' ? r.target.trim() : ''
  const rawMatch = Array.isArray(r.match) ? r.match : (typeof r.match === 'string' ? [r.match] : [])
  const matchers = rawMatch.map(m => String(m || '').trim()).filter(Boolean).map(compileTrigPattern)
  if (!target || matchers.length === 0) {
   continue
  }
  const rawExclude = Array.isArray(r.exclude) ? r.exclude : (typeof r.exclude === 'string' ? [r.exclude] : [])
  const excludes = rawExclude.map(e => String(e || '').trim()).filter(Boolean).map(compileTrigPattern)
  const targetExcl = compileTrigPattern(target.replace(/<[A-Za-z_][A-Za-z0-9_-]*>/g, '*')).regex
  compiled.push({
   id: typeof r.id === 'string' && r.id.trim() ? r.id.trim() : ('trigger-' + (i + 1)),
   matchers,
   excludes,
   target,
   targetExclusionRegex: targetExcl,
   encodeTarget: Boolean(r.encodeTarget),
  })
 }
 return { enabled: compiled.length > 0, rules: compiled }
}

const triggerConfig = loadTriggerConfig()
const TABLE_UPDATES_KEY_RE = /^lanes#[^/]+\/tables\/[^/]+\/updates(?:$|\/|\.|-)/
let triggerRevSeq = 0
const triggerWriteQueues = new Map()

function resolveTriggerTargets(key) {
 if (!triggerConfig.enabled || !key || typeof key !== 'string') {
  return []
 }
 if (key.startsWith('triggers#') || key.startsWith('stories#') || key.startsWith('__cc_probe_') || TABLE_UPDATES_KEY_RE.test(key)) {
  return []
 }
 for (const rule of triggerConfig.rules) {
  if (rule.targetExclusionRegex.test(key)) {
   return []
  }
 }
 const targets = []
 const seen = new Set()
 for (const rule of triggerConfig.rules) {
  if (rule.excludes.some(ex => ex.regex.test(key))) {
   continue
  }
  for (const matcher of rule.matchers) {
   const mRes = matcher.regex.exec(key)
   if (!mRes) {
    continue
   }
   const caps = {}
   for (let c = 0; c < matcher.captureNames.length; c++) {
    caps[matcher.captureNames[c]] = mRes[c + 1] || ''
   }
   const resolved = rule.target.replace(/<([A-Za-z_][A-Za-z0-9_-]*)>/g, (_f, capName) => {
    const v = Object.prototype.hasOwnProperty.call(caps, capName) ? caps[capName] : ''
    return rule.encodeTarget ? encodeTriggerSegment(v) : v
   })
   if (resolved && !seen.has(resolved)) {
    seen.add(resolved)
    targets.push(resolved)
   }
   break
  }
 }
 return targets
}

async function emitWriteTriggers(kv, mode, basePath, key, op) {
 const targets = resolveTriggerTargets(key)
 if (targets.length === 0) {
  return
 }
 const bucketKey = mode + '|' + (basePath || '')
 await Promise.all(targets.map(targetKey => {
  const qKey = bucketKey + '|' + targetKey
  const prev = triggerWriteQueues.get(qKey) || Promise.resolve()
  const next = prev.then(async () => {
   triggerRevSeq += 1
   const stamp = JSON.stringify({
    rev: String(Date.now()) + '-' + String(triggerRevSeq),
    updatedAt: new Date().toISOString(),
    key,
    op,
   })
   await kv.set(targetKey, stamp)
  }).catch(() => {})
  const tracked = next.finally(() => {
   if (triggerWriteQueues.get(qKey) === tracked) {
    triggerWriteQueues.delete(qKey)
   }
  })
  triggerWriteQueues.set(qKey, tracked)
  return next
 }))
}

const diskCache = new Map()
const volatileStore = volatileKV
 ? await Promise.resolve(volatileKV())
 : civilMemoryKV
  ? await Promise.resolve(civilMemoryKV({ mode: 'volatile' }))
  : createMapVolatileFallback()

async function getDiskKv(rawBasePath) {
 const resolved = rawBasePath && String(rawBasePath).trim()
  ? path.resolve(DEFAULT_BASE_PATH, String(rawBasePath).trim())
  : DEFAULT_BASE_PATH
 fs.mkdirSync(resolved, { recursive: true })
 let kv = diskCache.get(resolved)
 if (!kv) {
  if (diskKV) {
   try {
    kv = await Promise.resolve(diskKV({
     rootDir: resolved,
     basePath: resolved,
     fsPromises: { mkdir, readFile, unlink, writeFile },
     path: { join },
    }))
   }
   catch {
    kv = await Promise.resolve(diskKV(resolved))
   }
  }
  else {
   kv = await Promise.resolve(civilMemoryKV({
    mode: 'disk',
    modeOptions: { disk: { rootDir: resolved, basePath: resolved } },
   }))
  }
  diskCache.set(resolved, kv)
 }
 return kv
}

await getDiskKv(DEFAULT_BASE_PATH)

function setCorsHeaders(res) {
 res.setHeader('Access-Control-Allow-Origin', '*')
 res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
 res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
}

function readBody(req) {
 return new Promise((resolve, reject) => {
  const chunks = []
  req.on('data', chunk => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)))
  req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
  req.on('error', reject)
 })
}

const server = http.createServer(async (req, res) => {
 try {
  setCorsHeaders(res)
  const method = String(req.method || 'GET').toUpperCase()
  if (method === 'OPTIONS') {
   res.writeHead(204)
   res.end()
   return
  }
  const url = new URL(req.url || '/', 'http://localhost')
  if (url.pathname === '/health' && method === 'GET') {
   res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' })
   res.end(JSON.stringify({
    ok: true,
    service: 'civil-memory',
    factory: resolvedFactoryName,
    source: diskSourcePath,
    defaultBasePath: DEFAULT_BASE_PATH,
    triggersEnabled: triggerConfig.enabled,
    triggerRuleCount: triggerConfig.rules.length,
   }))
   return
  }
  const key = url.searchParams.get('key')
  if (!key) {
   res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' })
   res.end('Missing key query parameter')
   return
  }
  const mode = (url.searchParams.get('mode') || 'disk').toLowerCase()
  const basePath = url.searchParams.get('modeOptions.disk.basePath') || ''
  let kv
  if (mode === 'volatile') {
   kv = volatileStore
  }
  else if (mode === 'http') {
   const targetHttpUrl = url.searchParams.get('url')
   if (!httpKV || !targetHttpUrl) {
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' })
    res.end('Missing url parameter for http mode')
    return
   }
   kv = httpKV({ baseUrl: targetHttpUrl })
  }
  else if (mode === 'disk') {
   kv = await getDiskKv(basePath)
  }
  else {
   res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' })
   res.end('Unsupported civil-memory mode: ' + mode)
   return
  }

  if (method === 'GET') {
   let val = null
   try {
    val = await kv.get(key)
   }
   catch (err) {
    if (!err || err.code !== 'ENOENT') {
     throw err
    }
   }
   if (val === null || val === undefined) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
    res.end('Not found')
    return
   }
   res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' })
   res.end(Buffer.isBuffer(val) ? val : String(val))
   return
  }
  if (method === 'POST' || method === 'PUT') {
   const body = await readBody(req)
   await kv.set(key, body)
   if (mode !== 'http') {
    await emitWriteTriggers(kv, mode, basePath, key, 'set')
   }
   res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' })
   res.end('ok')
   return
  }
  if (method === 'DELETE') {
   const delFn = kv.delete || kv.del || kv.remove
   if (typeof delFn === 'function') {
    try {
     await delFn.call(kv, key)
    }
    catch (err) {
     if (!err || err.code !== 'ENOENT') {
      throw err
     }
    }
   }
   if (mode !== 'http') {
    await emitWriteTriggers(kv, mode, basePath, key, 'delete')
   }
   res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' })
   res.end('ok')
   return
  }
  res.writeHead(405, { 'Content-Type': 'text/plain; charset=utf-8' })
  res.end('Method not allowed')
 }
 catch (err) {
  res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' })
  res.end(err && err.message ? err.message : 'Internal error')
 }
})

server.listen(PORT, HOST, () => {
 console.log('civil-memory listening on http://' + HOST + ':' + PORT + ' (factory=' + resolvedFactoryName + ', source=' + diskSourcePath + ', defaultBasePath=' + DEFAULT_BASE_PATH + ')')
})
`
}

export function generateCivilMemorySystemdUnit({
 installDir = '/opt/civil-command/civil-memory',
 host = '127.0.0.1',
 port = 3333,
 defaultDataRoot = '/opt/civil-command/data',
} = {}) {
 const cleanInstall = normalizeRemoteDirPath(installDir, '/opt/civil-command/civil-memory')
 const cleanData = normalizeRemoteDirPath(defaultDataRoot, '/opt/civil-command/data')
 const cleanHost = String(host || '127.0.0.1').trim()
 const cleanPort = Number.isInteger(Number(port)) ? Number(port) : 3333
 return [
  '[Unit]',
  'Description=Civil Memory KV HTTP Server',
  'After=network.target',
  '',
  '[Service]',
  'Type=simple',
  `WorkingDirectory=${cleanInstall}`,
  `Environment=HOST=${cleanHost}`,
  `Environment=PORT=${cleanPort}`,
  `Environment=DEFAULT_BASE_PATH=${cleanData}`,
  `ExecStart=/usr/bin/env node ${cleanInstall}/cc-server.mjs`,
  'Restart=always',
  'RestartSec=2',
  '',
  '[Install]',
  'WantedBy=multi-user.target',
  '',
 ].join('\n')
}

export const SYSTEMD_SSRF_DENY_NETWORKS = Object.freeze([
 'localhost',
 'link-local',
 'multicast',
 '0.0.0.0/8',
 '10.0.0.0/8',
 '100.64.0.0/10',
 '100.100.100.200/32',
 '169.254.0.0/16',
 '169.254.169.254/32',
 '172.16.0.0/12',
 '192.168.0.0/16',
 '::/128',
 '::1/128',
 'fc00::/7',
 'fe80::/10',
 'fd00:ec2::254/128',
])

export function generateSystemdUnit({
 slug,
 title = '',
 installRoot = '/opt/civil-command',
 port = null,
 allowLoopback = false,
} = {}) {
 const cleanSlug = normalizeServiceSlug(slug)
 const cleanRoot = normalizeRemoteDirPath(installRoot, '/opt/civil-command')
 const serviceDir = `${cleanRoot}/${cleanSlug}`
 const descLabel = String(title || cleanSlug).replace(/[\r\n]+/g, ' ').trim()
 const numPort = Number(port)
 const cleanPort = Number.isInteger(numPort) && numPort >= 1 && numPort <= 65535 ? numPort : null
 const socketBindAllow = cleanPort ? `ipv4:tcp:${cleanPort}` : 'ipv4:tcp'
 return [
  '[Unit]',
  `Description=Civil Command Lane Service (${descLabel} - ${cleanSlug})`,
  'After=network.target',
  '',
  '[Service]',
  'Type=simple',
  `WorkingDirectory=${serviceDir}`,
  'Environment=NODE_ENV=production',
  'DynamicUser=yes',
  'NoNewPrivileges=yes',
  'ProtectSystem=strict',
  'ProtectHome=yes',
  'PrivateTmp=yes',
  'PrivateDevices=yes',
  'ProtectKernelTunables=yes',
  'ProtectKernelModules=yes',
  'ProtectKernelLogs=yes',
  'ProtectControlGroups=yes',
  'RestrictSUIDSGID=yes',
  'LockPersonality=yes',
  'CapabilityBoundingSet=',
  'AmbientCapabilities=',
  'RestrictAddressFamilies=AF_UNIX AF_INET AF_INET6',
  `SocketBindAllow=${socketBindAllow}`,
  'SocketBindDeny=any',
  ...(allowLoopback ? ['IPAddressAllow=127.0.0.1/32', 'IPAddressAllow=127.0.0.53/32'] : []),
  `IPAddressDeny=${SYSTEMD_SSRF_DENY_NETWORKS.join(' ')}`,
  `ExecStart=/usr/bin/env node ${serviceDir}/lane-server.mjs --config ${serviceDir}/config.json`,
  'Restart=always',
  'RestartSec=2',
  '',
  '[Install]',
  'WantedBy=multi-user.target',
  '',
 ].join('\n')
}

export function generateNginxSubpathConfig({ slug, port, subpath }) {
 const cleanSlug = normalizeServiceSlug(slug)
 const cleanPort = Number(port)
 const cleanSub = normalizeSubpath(subpath)
 if (!cleanSub || cleanSub === '/') {
  return generateNginxRootConfig({ slug: cleanSlug, port: cleanPort })
 }
 return [
  `# Civil Command lane service: ${cleanSlug}`,
  `location = ${cleanSub} {`,
  ` proxy_pass http://127.0.0.1:${cleanPort};`,
  ' proxy_http_version 1.1;',
  ' proxy_set_header Host $host;',
  ' proxy_set_header X-Real-IP $remote_addr;',
  ' proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;',
  ' proxy_set_header X-Forwarded-Proto $scheme;',
  ` proxy_set_header X-Forwarded-Prefix ${cleanSub};`,
  '}',
  `location ${cleanSub}/ {`,
  ` proxy_pass http://127.0.0.1:${cleanPort}/;`,
  ' proxy_http_version 1.1;',
  ' proxy_set_header Host $host;',
  ' proxy_set_header X-Real-IP $remote_addr;',
  ' proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;',
  ' proxy_set_header X-Forwarded-Proto $scheme;',
  ` proxy_set_header X-Forwarded-Prefix ${cleanSub};`,
  '}',
  '',
 ].join('\n')
}

export function generateNginxRootConfig({ slug, port }) {
 const cleanSlug = normalizeServiceSlug(slug)
 const cleanPort = Number(port)
 return [
  `# Civil Command lane service: ${cleanSlug}`,
  'location / {',
  ` proxy_pass http://127.0.0.1:${cleanPort};`,
  ' proxy_http_version 1.1;',
  ' proxy_set_header Host $host;',
  ' proxy_set_header X-Real-IP $remote_addr;',
  ' proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;',
  ' proxy_set_header X-Forwarded-Proto $scheme;',
  '}',
  '',
 ].join('\n')
}

export function generateNginxDomainVhost({ domain }) {
 const cleanDomain = normalizeDomainName(domain)
 if (!cleanDomain) {
  throw new Error('Invalid domain name for Nginx vhost')
 }
 return [
  `# Managed by Civil Command for ${cleanDomain}`,
  'server {',
  ' listen 80;',
  ' listen [::]:80;',
  ` server_name ${cleanDomain};`,
  '',
  ` include /etc/nginx/civil-command/${cleanDomain}.d/*.conf;`,
  '}',
  '',
 ].join('\n')
}

export function generateNginxSharedRootFallbackConfig({ domain }) {
 const cleanDomain = normalizeDomainName(domain)
 if (!cleanDomain) {
  throw new Error('Invalid domain name for Nginx shared root fallback')
 }
 const payload = JSON.stringify({
  ok: false,
  domain: cleanDomain,
  error: 'No service registered at root path',
 })
 return [
  `# Managed by Civil Command: shared domain root fallback for ${cleanDomain}`,
  '# Automatically removed if a root lane is deployed to this domain',
  'location / {',
  ' default_type application/json;',
  ` return 404 '${payload.replace(/'/g, "\\'")}';`,
  '}',
  '',
 ].join('\n')
}

function buildEnsureNginxHelper() {
 return [
  'if ! command -v nginx >/dev/null 2>&1; then',
  ' echo "Nginx not found on remote server; installing nginx..."',
  ' if command -v apt-get >/dev/null 2>&1; then',
  '  sudo apt-get update',
  '  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y nginx',
  ' elif command -v dnf >/dev/null 2>&1; then',
  '  sudo dnf install -y nginx',
  ' elif command -v yum >/dev/null 2>&1; then',
  '  sudo yum install -y nginx',
  ' else',
  '  echo "Could not auto-install nginx (unsupported package manager). Install nginx manually first." >&2',
  '  exit 1',
  ' fi',
  ' sudo systemctl enable --now nginx',
  'fi',
 ].join('\n')
}

function buildEnsureCertbotHelper() {
 return [
  'if ! command -v certbot >/dev/null 2>&1; then',
  ' echo "Certbot not found on remote server; installing certbot and python3-certbot-nginx..."',
  ' if command -v apt-get >/dev/null 2>&1; then',
  '  sudo apt-get update',
  '  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y certbot python3-certbot-nginx',
  ' elif command -v dnf >/dev/null 2>&1; then',
  '  sudo dnf install -y certbot python3-certbot-nginx',
  ' elif command -v yum >/dev/null 2>&1; then',
  '  sudo yum install -y certbot python3-certbot-nginx',
  ' else',
  '  echo "certbot is not installed on the remote server. Install certbot and python3-certbot-nginx manually first." >&2',
  '  exit 1',
  ' fi',
  'fi',
 ].join('\n')
}

function buildNginxAttachSnippetHelper(domain, includeLine, vhostContentB64) {
 return `${buildEnsureNginxHelper()}\n` + String.raw`
CC_DOMAIN=${shellQuote(domain)}
CC_INC_LINE=${shellQuote(includeLine)}
CC_VHOST_B64=${shellQuote(vhostContentB64)}
CC_INCLUDE_DIR="/etc/nginx/civil-command/${domain}.d"
sudo mkdir -p "$CC_INCLUDE_DIR"

if [ -d /etc/nginx/sites-available ] && [ -d /etc/nginx/sites-enabled ]; then
 CC_NGINX_LAYOUT="debian"
 CC_AVAIL="/etc/nginx/sites-available/civil-command-${domain}.conf"
 CC_ENABLED="/etc/nginx/sites-enabled/civil-command-${domain}.conf"
else
 CC_NGINX_LAYOUT="conf.d"
 CC_AVAIL="/etc/nginx/conf.d/civil-command-${domain}.conf"
 CC_ENABLED="$CC_AVAIL"
fi

CC_EXISTING_VHOST="$(python3 - "$CC_DOMAIN" /etc/nginx/sites-enabled /etc/nginx/conf.d <<'PYEOF'
import os, re, sys
domain = sys.argv[1]
scan_dirs = sys.argv[2:]
def strip_comments(text):
 return '\n'.join(line.split('#', 1)[0] for line in text.splitlines())
pattern = re.compile(r'(?:^|[;{\s])server_name\s+(?:[^;]*\s)?' + re.escape(domain) + r'(?:\s|;)')
for scan_dir in scan_dirs:
 if not os.path.isdir(scan_dir):
  continue
 for fn in sorted(os.listdir(scan_dir)):
  if fn.startswith('.') or '.cc-bak.' in fn:
   continue
  full = os.path.join(scan_dir, fn)
  if not os.path.isfile(full):
   continue
  try:
   txt = open(full, 'r', encoding='utf-8', errors='ignore').read()
  except Exception:
   continue
  if pattern.search(strip_comments(txt)):
   print(os.path.realpath(full))
   sys.exit(0)
PYEOF
)"

if [ -z "$CC_EXISTING_VHOST" ]; then
 echo "Initializing shared Nginx vhost for $CC_DOMAIN at $CC_AVAIL ($CC_NGINX_LAYOUT)..."
 sudo mkdir -p "$(dirname "$CC_AVAIL")"
 printf '%s' "$CC_VHOST_B64" | base64 -d | sudo tee "$CC_AVAIL" >/dev/null
 if [ "$CC_NGINX_LAYOUT" = "debian" ]; then
  sudo mkdir -p /etc/nginx/sites-enabled
  if [ ! -e "$CC_ENABLED" ]; then
   sudo ln -s "$CC_AVAIL" "$CC_ENABLED"
  fi
 fi
 CC_ACTIVE_VHOST="$CC_AVAIL"
 CC_CREATED_NEW_VHOST=1
 CC_IS_MANAGED_VHOST=1
else
 echo "Found existing Nginx vhost for $CC_DOMAIN: $CC_EXISTING_VHOST"
 CC_ACTIVE_VHOST="$CC_EXISTING_VHOST"
 CC_CREATED_NEW_VHOST=0
 if grep -Fq "# Managed by Civil Command for " "$CC_EXISTING_VHOST" || [ "$(basename "$CC_EXISTING_VHOST")" = "civil-command-${domain}.conf" ]; then
  CC_IS_MANAGED_VHOST=1
 else
  CC_IS_MANAGED_VHOST=0
 fi
 if ! grep -Fq "$CC_INC_LINE" "$CC_EXISTING_VHOST"; then
  CC_BAK="$CC_EXISTING_VHOST.cc-bak.$(date +%s)"
  sudo cp -a "$CC_EXISTING_VHOST" "$CC_BAK"
  echo "Injecting include into existing vhost (backup: $CC_BAK)..."
  sudo python3 - "$CC_EXISTING_VHOST" "$CC_DOMAIN" "$CC_INC_LINE" <<'PYEOF'
import re, sys
path, domain, inc_line = sys.argv[1], sys.argv[2], sys.argv[3]
src = open(path, 'r', encoding='utf-8').read()
if inc_line in src:
 sys.exit(0)
def strip_comments(text):
 return '\n'.join(line.split('#', 1)[0] for line in text.splitlines())
sn_re = re.compile(r'(?:^|[;{\s])server_name\s+(?:[^;]*\s)?' + re.escape(domain) + r'(?:\s|;)')
out = []
i = 0
n = len(src)
modified = False
while i < n:
 m = re.search(r'\bserver\s*\{', src[i:])
 if not m:
  out.append(src[i:])
  break
 start = i + m.start()
 brace_start = i + m.end() - 1
 out.append(src[i:brace_start])
 depth = 0
 j = brace_start
 in_str = None
 while j < n:
  ch = src[j]
  if in_str:
   if ch == '\\':
    j += 2
    continue
   if ch == in_str:
    in_str = None
  else:
   if ch in ('"', "'"):
    in_str = ch
   elif ch == '#':
    nl = src.find('\n', j)
    j = n if nl == -1 else nl + 1
    continue
   elif ch == '{':
    depth += 1
   elif ch == '}':
    depth -= 1
    if depth == 0:
     block = src[brace_start:j]
     if sn_re.search(strip_comments(block)) and inc_line not in block:
      block = block.rstrip() + '\n ' + inc_line + '\n'
      modified = True
     out.append(block + '}')
     j += 1
     break
  j += 1
 else:
  out.append(src[brace_start:])
  j = n
 i = j
if not modified:
 sys.stderr.write('Could not locate matching server block for ' + domain + '\n')
 sys.exit(1)
open(path, 'w', encoding='utf-8').write(''.join(out))
PYEOF
 fi
fi
`
}

export function generateInstallCivilMemoryScript({
 repoUrl = 'https://github.com/tagmein/civil-memory.git',
 installDir = '/opt/civil-command/civil-memory',
 host = '127.0.0.1',
 port = 3333,
 defaultDataRoot = '/opt/civil-command/data',
 exposeDomain = '',
 enableLetsEncrypt = false,
 letsEncryptEmail = '',
} = {}) {
 const cleanInstall = normalizeRemoteDirPath(installDir, '/opt/civil-command/civil-memory')
 const cleanData = normalizeRemoteDirPath(defaultDataRoot, '/opt/civil-command/data')
 const cleanPort = Number.isInteger(Number(port)) && Number(port) > 0 && Number(port) <= 65535
  ? Number(port)
  : 3333
 const cleanHost = String(host || '127.0.0.1').trim()
 const cleanDomain = exposeDomain ? normalizeDomainName(exposeDomain) : ''
 if (exposeDomain && !cleanDomain) {
  throw new Error('Invalid exposeDomain for civil-memory')
 }
 const cleanEmail = String(letsEncryptEmail || '').trim()
 if (cleanEmail && !SAFE_EMAIL_RE.test(cleanEmail)) {
  throw new Error('Invalid Let\'s Encrypt email address')
 }

 const serverScriptB64 = encodeBase64(generateCivilMemoryServerScript())
 const unitB64 = encodeBase64(generateCivilMemorySystemdUnit({
  installDir: cleanInstall,
  host: cleanHost,
  port: cleanPort,
  defaultDataRoot: cleanData,
 }))
 const parentRoot = path.posix.dirname(cleanInstall) || '/opt/civil-command'

 const lines = [
  '#!/usr/bin/env bash',
  'set -euo pipefail',
  `INSTALL_DIR=${shellQuote(cleanInstall)}`,
  `DATA_ROOT=${shellQuote(cleanData)}`,
  `PARENT_ROOT=${shellQuote(parentRoot)}`,
  `REPO_URL=${shellQuote(repoUrl)}`,
  `CM_PORT=${shellQuote(String(cleanPort))}`,
  'for cmd in node npm git curl; do',
  ' if ! command -v "$cmd" >/dev/null 2>&1; then',
  '  echo "Missing required tool on remote server: $cmd" >&2',
  '  exit 1',
  ' fi',
  'done',
  'echo "Preparing $PARENT_ROOT and $DATA_ROOT..."',
  'sudo mkdir -p "$PARENT_ROOT" "$DATA_ROOT"',
  'sudo chown -R "$(id -un):$(id -gn)" "$PARENT_ROOT" "$DATA_ROOT"',
  'if [ -d "$INSTALL_DIR/.git" ]; then',
  ' echo "Updating existing civil-memory repository..."',
  ' git -C "$INSTALL_DIR" pull --ff-only || echo "Note: git pull skipped; continuing with existing checkout"',
  'else',
  ' echo "Cloning civil-memory from $REPO_URL..."',
  ' git clone "$REPO_URL" "$INSTALL_DIR"',
  'fi',
  'cd "$INSTALL_DIR"',
  'echo "Installing civil-memory npm dependencies..."',
  'npm install',
  'if node -e "const p=require(\'./package.json\'); process.exit(p.scripts && p.scripts.build ? 0 : 1)"; then',
  ' echo "Building civil-memory..."',
  ' npm run build',
  'fi',
  `printf '%s' ${shellQuote(serverScriptB64)} | base64 -d > "$INSTALL_DIR/cc-server.mjs"`,
  `printf '%s' ${shellQuote(unitB64)} | base64 -d | sudo tee /etc/systemd/system/civil-memory.service >/dev/null`,
  'sudo systemctl daemon-reload',
  'sudo systemctl enable --now civil-memory.service',
  'sudo systemctl restart civil-memory.service',
  'echo "Waiting for civil-memory health check on 127.0.0.1:${CM_PORT}..."',
  'READY=0',
  'for i in $(seq 1 20); do',
  ' if curl -sf "http://127.0.0.1:${CM_PORT}/health" >/dev/null 2>&1; then',
  '  READY=1',
  '  break',
  ' fi',
  ' sleep 0.5',
  'done',
  'if [ "$READY" -ne 1 ]; then',
  ' echo "civil-memory failed health check. Recent logs:" >&2',
  ' sudo journalctl -u civil-memory.service -n 30 --no-pager >&2 || true',
  ' exit 1',
  'fi',
  'echo "Verifying civil-memory disk KV read/write..."',
  'CM_PROBE_KEY="__cc_install_check_$$"',
  'CM_PROBE_URL="http://127.0.0.1:${CM_PORT}/?mode=disk&key=${CM_PROBE_KEY}"',
  'if ! curl -sf -X POST -d "ok" "$CM_PROBE_URL" >/dev/null 2>&1 || [ "$(curl -sf "$CM_PROBE_URL" || true)" != "ok" ]; then',
  ' echo "civil-memory failed disk KV round-trip check. Recent logs:" >&2',
  ' sudo journalctl -u civil-memory.service -n 30 --no-pager >&2 || true',
  ' exit 1',
  'fi',
  'curl -sf -X DELETE "$CM_PROBE_URL" >/dev/null 2>&1 || true',
  'echo "civil-memory verified and ready on 127.0.0.1:${CM_PORT}"',
 ]

 let exposedUrl = ''
 if (cleanDomain) {
  const snippetB64 = encodeBase64(generateNginxRootConfig({ slug: 'civil-memory', port: cleanPort }))
  const vhostB64 = encodeBase64(generateNginxDomainVhost({ domain: cleanDomain }))
  const incLine = `include /etc/nginx/civil-command/${cleanDomain}.d/*.conf;`
  lines.push(buildNginxAttachSnippetHelper(cleanDomain, incLine, vhostB64))
  lines.push(`sudo rm -f "/etc/nginx/civil-command/${cleanDomain}.d/zz-shared-root.conf"`)
  lines.push(`printf '%s' ${shellQuote(snippetB64)} | base64 -d | sudo tee "/etc/nginx/civil-command/${cleanDomain}.d/civil-memory.conf" >/dev/null`)
  lines.push('if ! sudo nginx -t; then')
  lines.push(` sudo rm -f "/etc/nginx/civil-command/${cleanDomain}.d/civil-memory.conf"`)
  lines.push(' if [ "${CC_CREATED_NEW_VHOST:-0}" = "1" ]; then')
  lines.push('  sudo rm -f "$CC_ENABLED" "$CC_AVAIL"')
  lines.push(`  sudo rm -f "/etc/nginx/civil-command/${cleanDomain}.d/zz-shared-root.conf"`)
  lines.push(' elif [ -n "${CC_BAK:-}" ] && [ -f "$CC_BAK" ]; then')
  lines.push('  sudo cp -a "$CC_BAK" "$CC_EXISTING_VHOST"')
  lines.push(' fi')
  lines.push(' exit 1')
  lines.push('fi')
  lines.push('if sudo systemctl is-active --quiet nginx; then')
  lines.push(' sudo systemctl reload nginx')
  lines.push('else')
  lines.push(' sudo systemctl enable --now nginx')
  lines.push('fi')
  if (enableLetsEncrypt) {
   lines.push(buildEnsureCertbotHelper())
   const certArgs = ['sudo', 'certbot', '--nginx', '-d', cleanDomain, '--redirect', '--keep-until-expiring']
   if (cleanEmail) {
    certArgs.push('--email', cleanEmail, '--agree-tos', '--no-eff-email')
   }
   lines.push('if [ -f "/etc/letsencrypt/live/${CC_DOMAIN}/fullchain.pem" ] && [ -n "${CC_ACTIVE_VHOST:-}" ] && grep -Fq "ssl_certificate" "$CC_ACTIVE_VHOST"; then')
   lines.push(` echo "HTTPS certificate already active for ${cleanDomain}; inheriting existing TLS config."`)
   lines.push('else')
   lines.push(` ${certArgs.map(shellQuote).join(' ')}`)
   lines.push('fi')
  }
  exposedUrl = `${enableLetsEncrypt ? 'https' : 'http'}://${cleanDomain}`
 }

 const readyPayload = JSON.stringify({
  ok: true,
  url: `http://127.0.0.1:${cleanPort}`,
  defaultDataRoot: cleanData,
  exposedUrl,
 })
 lines.push(`echo ${shellQuote(`__CC_CIVIL_MEMORY_READY__ ${readyPayload}`)}`)
 return lines.join('\n') + '\n'
}

export function generateRemoteKvTestScript({ url, basePath = '' } = {}) {
 const cleanUrl = normalizeCivilMemoryBaseUrl(url)
 if (!cleanUrl) {
  throw new Error('civil-memory URL is required')
 }
 return [
  '#!/usr/bin/env bash',
  'set -euo pipefail',
  'TMPDIR="$(mktemp -d)"',
  'trap \'rm -rf "$TMPDIR"\' EXIT',
  'printf \'{"type":"module","private":true}\' > "$TMPDIR/package.json"',
  `export CC_KV_URL=${shellQuote(cleanUrl)}`,
  `export CC_KV_BASE=${shellQuote(basePath || '')}`,
  `node --input-type=module - <<'NODEEOF'`,
  `const url = new URL(process.env.CC_KV_URL)`,
  `if (process.env.CC_KV_BASE) url.searchParams.set('modeOptions.disk.basePath', process.env.CC_KV_BASE)`,
  `const key = '__cc_probe_' + Date.now() + '_' + Math.random().toString(16).slice(2)`,
  `url.searchParams.set('key', key)`,
  `const postResp = await fetch(url, { method: 'POST', body: 'ok' })`,
  `if (!postResp.ok) throw new Error('POST failed: HTTP ' + postResp.status + ' ' + await postResp.text())`,
  `const getResp = await fetch(url)`,
  `if (!getResp.ok) throw new Error('GET failed: HTTP ' + getResp.status + ' ' + await getResp.text())`,
  `const txt = await getResp.text()`,
  `await fetch(url, { method: 'DELETE' }).catch(() => {})`,
  `if (txt !== 'ok') throw new Error('Read-back mismatch: ' + JSON.stringify(txt))`,
  `console.log('__CC_KV_READY__ ' + JSON.stringify({ ok: true, url: process.env.CC_KV_URL, basePath: process.env.CC_KV_BASE || null }))`,
  'NODEEOF',
  '',
 ].join('\n')
}

export function generateRemoteKvSyncScript({
 url,
 basePath = '',
 bundle,
 runtimeFiles = {},
} = {}) {
 const cleanUrl = normalizeCivilMemoryBaseUrl(url)
 if (!cleanUrl) {
  throw new Error('civil-memory URL is required')
 }
 const bundledNames = resolveBundledRuntimeFileNames(runtimeFiles, {
  requiredBase: ['field.mjs', 'data.mjs', 'storage.mjs'],
  entryFiles: ['data.mjs', 'storage.mjs'],
 })
 const bundleJson = JSON.stringify(bundle || {})
 const lines = [
  '#!/usr/bin/env bash',
  'set -euo pipefail',
  'TMPDIR="$(mktemp -d)"',
  'trap \'rm -rf "$TMPDIR"\' EXIT',
  'printf \'{"type":"module","private":true}\\n\' > "$TMPDIR/package.json"',
 ]
 for (const name of bundledNames) {
  lines.push(`printf '%s' ${shellQuote(encodeBase64(runtimeFiles[name]))} | base64 -d > "$TMPDIR/${name}"`)
 }
 lines.push(
  `printf '%s' ${shellQuote(encodeBase64(bundleJson))} | base64 -d > "$TMPDIR/bundle.json"`,
  'cd "$TMPDIR"',
  `CC_KV_URL=${shellQuote(cleanUrl)} CC_KV_BASE=${shellQuote(basePath || '')} node --input-type=module - <<'NODEEOF'`,
  "import fs from 'node:fs/promises'",
  "import { httpKV } from './data.mjs'",
  "import { writeLaneSyncBundleToKv } from './storage.mjs'",
  "const bundle = JSON.parse(await fs.readFile('./bundle.json', 'utf8'))",
  "const kv = httpKV({ baseUrl: process.env.CC_KV_URL, basePath: process.env.CC_KV_BASE || null, switchable: false, triggers: true })",
  'const res = await writeLaneSyncBundleToKv(kv, bundle, null)',
  "try { const regRaw = await fs.readFile('/opt/civil-command/registry.json', 'utf8'); const reg = JSON.parse(regRaw); const syncedSet = new Set(res.laneIds || []); for (const entry of Object.values(reg || {})) { if (entry && entry.port && (syncedSet.has(entry.laneId) || ((entry.dataBasePath || '') === (process.env.CC_KV_BASE || '')))) { await fetch(`http://127.0.0.1:${entry.port}/_cc/reload`, { method: 'POST' }).catch(() => {}) } } } catch {}",
  "console.log('__CC_SYNC_OK__ ' + JSON.stringify(res))",
  'NODEEOF',
  '',
 )
 return lines.join('\n')
}

export function generateDeployScript({
 slug,
 laneId,
 title = '',
 port = 4100,
 routeMode = 'subpath',
 domain = '',
 subpath = '',
 enableLetsEncrypt = false,
 letsEncryptEmail = '',
 cors = true,
 civilMemoryUrl,
 dataBasePath = '',
 includeImports = false,
 installRoot = '/opt/civil-command',
 runtimeFiles = {},
 syncBundle = null,
} = {}) {
 const cleanSlug = normalizeServiceSlug(slug || laneId)
 const cleanRoot = normalizeRemoteDirPath(installRoot, '/opt/civil-command')
 const serviceDir = `${cleanRoot}/${cleanSlug}`
 const cleanPort = Number(port)
 if (!Number.isInteger(cleanPort) || cleanPort < 1 || cleanPort > 65535) {
  throw new Error('Invalid service port')
 }
 const cleanMode = routeMode === 'domain' ? 'domain' : 'subpath'
 const cleanDomain = domain ? normalizeDomainName(domain) : ''
 if (domain && !cleanDomain) {
  throw new Error('Invalid domain name')
 }
 const cleanSubpath = cleanMode === 'subpath' ? (normalizeSubpath(subpath || `/${cleanSlug}`) || `/${cleanSlug}`) : ''
 const cleanCmUrl = normalizeCivilMemoryBaseUrl(civilMemoryUrl)
 if (!cleanCmUrl) {
  throw new Error('civilMemoryUrl is required for deployment')
 }
 const cleanEmail = String(letsEncryptEmail || '').trim()
 if (cleanEmail && !SAFE_EMAIL_RE.test(cleanEmail)) {
  throw new Error('Invalid Let\'s Encrypt email address')
 }
 const bundledNames = resolveBundledRuntimeFileNames(runtimeFiles, {
  requiredBase: [
   'field.mjs',
   'data.mjs',
   'storage.mjs',
   'sandbox.mjs',
   'source-worker.mjs',
   'lane-http.mjs',
   'lane-server.mjs',
  ],
  entryFiles: ['lane-server.mjs', 'source-worker.mjs'],
 })

 const configJson = JSON.stringify({
  slug: cleanSlug,
  laneId: String(laneId || '').trim(),
  title: String(title || cleanSlug),
  host: '127.0.0.1',
  port: cleanPort,
  basePath: cleanMode === 'subpath' ? cleanSubpath : '',
  cors: cors !== false,
  civilMemoryUrl: cleanCmUrl,
  dataBasePath: dataBasePath || null,
  includeImports: Boolean(includeImports),
 }, null, 1)

 const unitContent = generateSystemdUnit({
  slug: cleanSlug,
  title: title || cleanSlug,
  installRoot: cleanRoot,
  port: cleanPort,
  allowLoopback: true,
 })

 const lines = [
  '#!/usr/bin/env bash',
  'set -euo pipefail',
  `INSTALL_ROOT=${shellQuote(cleanRoot)}`,
  `SERVICE_DIR=${shellQuote(serviceDir)}`,
  `SLUG=${shellQuote(cleanSlug)}`,
  `PORT=${shellQuote(String(cleanPort))}`,
  'if ! command -v node >/dev/null 2>&1; then',
  ' echo "Node.js is required on the remote server" >&2',
  ' exit 1',
  'fi',
  'echo "Preparing $SERVICE_DIR..."',
  'sudo mkdir -p "$INSTALL_ROOT" "$SERVICE_DIR"',
  'sudo chown -R "$(id -un):$(id -gn)" "$INSTALL_ROOT"',
  'sudo chmod 755 "$INSTALL_ROOT" "$SERVICE_DIR"',
 ]

 if (dataBasePath && String(dataBasePath).trim().startsWith('/') && /127\.0\.0\.1|localhost/i.test(cleanCmUrl)) {
  const cleanDataBase = normalizeRemoteDirPath(dataBasePath)
  lines.push(`sudo mkdir -p ${shellQuote(cleanDataBase)}`)
  lines.push(`sudo chown -R "$(id -un):$(id -gn)" ${shellQuote(cleanDataBase)}`)
 }

 lines.push(`printf '%s' '{"type":"module","private":true}\n' > "$SERVICE_DIR/package.json"`)
 for (const name of bundledNames) {
  lines.push(`printf '%s' ${shellQuote(encodeBase64(runtimeFiles[name]))} | base64 -d > "$SERVICE_DIR/${name}"`)
 }
 lines.push(`printf '%s' ${shellQuote(encodeBase64(configJson))} | base64 -d > "$SERVICE_DIR/config.json"`)
 lines.push('chmod 644 "$SERVICE_DIR"/*.mjs "$SERVICE_DIR/package.json" "$SERVICE_DIR/config.json"')

 if (syncBundle && Array.isArray(syncBundle.lanes) && syncBundle.lanes.length > 0) {
  lines.push('echo "Syncing lane bundle to connected civil-memory KV store..."')
  lines.push('SYNC_BUNDLE_TMP="$(mktemp "$SERVICE_DIR/.sync-bundle.XXXXXX.json")"')
  lines.push(`printf '%s' ${shellQuote(encodeBase64(JSON.stringify(syncBundle)))} | base64 -d > "$SYNC_BUNDLE_TMP"`)
  lines.push(`(cd "$SERVICE_DIR" && CC_SYNC_FILE="$SYNC_BUNDLE_TMP" CC_KV_URL=${shellQuote(cleanCmUrl)} CC_KV_BASE=${shellQuote(dataBasePath || '')} node --input-type=module - <<'NODEEOF'`)
  lines.push("import fs from 'node:fs/promises'")
  lines.push("import { httpKV } from './data.mjs'")
  lines.push("import { writeLaneSyncBundleToKv } from './storage.mjs'")
  lines.push("const bundle = JSON.parse(await fs.readFile(process.env.CC_SYNC_FILE, 'utf8'))")
  lines.push("const kv = httpKV({ baseUrl: process.env.CC_KV_URL, basePath: process.env.CC_KV_BASE || null, switchable: false, triggers: true })")
  lines.push('const res = await writeLaneSyncBundleToKv(kv, bundle, null)')
  lines.push("console.log('__CC_SYNC_OK__ ' + JSON.stringify(res))")
  lines.push('NODEEOF')
  lines.push(')')
  lines.push('rm -f "$SYNC_BUNDLE_TMP"')
 }

 lines.push('if [ -f "$INSTALL_ROOT/registry.json" ]; then')
 lines.push(` OLD_SLUGS="$(node - "$INSTALL_ROOT/registry.json" "$SLUG" "$PORT" ${shellQuote(String(laneId || '').trim())} <<'NODEEOF'`)
 lines.push("const fs = require('node:fs')")
 lines.push('const [regPath, curSlug, curPort, curLaneId] = process.argv.slice(2)')
 lines.push('try {')
 lines.push(" const reg = JSON.parse(fs.readFileSync(regPath, 'utf8'))")
 lines.push(' const out = []')
 lines.push(' for (const [k, v] of Object.entries(reg || {})) {')
 lines.push('  if (!v || k === curSlug) continue')
 lines.push('  if (String(v.port) === String(curPort) || (curLaneId && v.laneId === curLaneId && String(v.port) === String(curPort))) {')
 lines.push('   out.push(k)')
 lines.push('   delete reg[k]')
 lines.push('  }')
 lines.push(' }')
 lines.push(' if (out.length > 0) fs.writeFileSync(regPath, JSON.stringify(reg, null, 1))')
 lines.push(" console.log(out.join(' '))")
 lines.push('} catch {}')
 lines.push('NODEEOF')
 lines.push(')"')
 lines.push(' for OLD_S in $OLD_SLUGS; do')
 lines.push('  [ -n "$OLD_S" ] || continue')
 lines.push('  echo "Stopping superseded service civil-lane-${OLD_S}.service on port ${PORT}..."')
 lines.push('  sudo systemctl stop "civil-lane-${OLD_S}.service" >/dev/null 2>&1 || true')
 lines.push('  sudo systemctl disable "civil-lane-${OLD_S}.service" >/dev/null 2>&1 || true')
 lines.push('  sudo rm -f "/etc/systemd/system/civil-lane-${OLD_S}.service"')
 lines.push(' done')
 lines.push('fi')

 lines.push(`printf '%s' ${shellQuote(encodeBase64(unitContent))} | base64 -d | sudo tee "/etc/systemd/system/civil-lane-${cleanSlug}.service" >/dev/null`)
 lines.push('sudo systemctl daemon-reload')
 lines.push(`sudo systemctl reset-failed "civil-lane-${cleanSlug}.service" >/dev/null 2>&1 || true`)
 lines.push(`sudo systemctl enable "civil-lane-${cleanSlug}.service"`)
 lines.push(`sudo systemctl restart "civil-lane-${cleanSlug}.service"`)

 if (cleanDomain) {
  const snippetContent = cleanMode === 'domain'
   ? generateNginxRootConfig({ slug: cleanSlug, port: cleanPort })
   : generateNginxSubpathConfig({ slug: cleanSlug, port: cleanPort, subpath: cleanSubpath })
  const snippetFile = cleanMode === 'domain' ? `00-root-${cleanSlug}.conf` : `${cleanSlug}.conf`
  const vhostB64 = encodeBase64(generateNginxDomainVhost({ domain: cleanDomain }))
  const incLine = `include /etc/nginx/civil-command/${cleanDomain}.d/*.conf;`
  lines.push(buildNginxAttachSnippetHelper(cleanDomain, incLine, vhostB64))
  lines.push(`printf '%s' ${shellQuote(encodeBase64(snippetContent))} | base64 -d | sudo tee "/etc/nginx/civil-command/${cleanDomain}.d/${snippetFile}" >/dev/null`)
  if (cleanMode === 'domain') {
   lines.push(`sudo rm -f "/etc/nginx/civil-command/${cleanDomain}.d/zz-shared-root.conf"`)
  }
  else {
   const sharedRootB64 = encodeBase64(generateNginxSharedRootFallbackConfig({ domain: cleanDomain }))
   lines.push('if [ "${CC_IS_MANAGED_VHOST:-0}" = "1" ]; then')
   lines.push(' CC_HAS_ROOT_LOC=0')
   lines.push(` for CC_F in "/etc/nginx/civil-command/${cleanDomain}.d"/*.conf; do`)
   lines.push('  [ -e "$CC_F" ] || continue')
   lines.push('  [ "$(basename "$CC_F")" = "zz-shared-root.conf" ] && continue')
   lines.push('  if grep -Eq \'^[[:space:]]*location[[:space:]]+/[[:space:]]*\\{\' "$CC_F"; then')
   lines.push('   CC_HAS_ROOT_LOC=1')
   lines.push('   break')
   lines.push('  fi')
   lines.push(' done')
   lines.push(' if [ "$CC_HAS_ROOT_LOC" = "0" ]; then')
   lines.push(`  printf '%s' ${shellQuote(sharedRootB64)} | base64 -d | sudo tee "/etc/nginx/civil-command/${cleanDomain}.d/zz-shared-root.conf" >/dev/null`)
   lines.push(' fi')
   lines.push('fi')
  }
  lines.push('if ! sudo nginx -t; then')
  lines.push(` sudo rm -f "/etc/nginx/civil-command/${cleanDomain}.d/${snippetFile}"`)
  lines.push(' if [ "${CC_CREATED_NEW_VHOST:-0}" = "1" ]; then')
  lines.push('  sudo rm -f "$CC_ENABLED" "$CC_AVAIL"')
  lines.push(`  sudo rm -f "/etc/nginx/civil-command/${cleanDomain}.d/zz-shared-root.conf"`)
  lines.push(' elif [ -n "${CC_BAK:-}" ] && [ -f "$CC_BAK" ]; then')
  lines.push('  sudo cp -a "$CC_BAK" "$CC_EXISTING_VHOST"')
  lines.push(' fi')
  lines.push(' exit 1')
  lines.push('fi')
  lines.push('if sudo systemctl is-active --quiet nginx; then')
  lines.push(' sudo systemctl reload nginx')
  lines.push('else')
  lines.push(' sudo systemctl enable --now nginx')
  lines.push('fi')
  if (enableLetsEncrypt) {
   lines.push(buildEnsureCertbotHelper())
   const certArgs = ['sudo', 'certbot', '--nginx', '-d', cleanDomain, '--redirect', '--keep-until-expiring']
   if (cleanEmail) {
    certArgs.push('--email', cleanEmail, '--agree-tos', '--no-eff-email')
   }
   lines.push('if [ -f "/etc/letsencrypt/live/${CC_DOMAIN}/fullchain.pem" ] && [ -n "${CC_ACTIVE_VHOST:-}" ] && grep -Fq "ssl_certificate" "$CC_ACTIVE_VHOST"; then')
   lines.push(` echo "HTTPS certificate already active for ${cleanDomain}; inheriting existing TLS config."`)
   lines.push('else')
   lines.push(` ${certArgs.map(shellQuote).join(' ')}`)
   lines.push('fi')
  }
 }

 const publicUrl = cleanDomain
  ? `${enableLetsEncrypt ? 'https' : 'http'}://${cleanDomain}${cleanMode === 'subpath' && cleanSubpath !== '/' ? cleanSubpath : ''}`
  : `http://127.0.0.1:${cleanPort}`

 lines.push(`REG_ENTRY_B64=${shellQuote(encodeBase64(JSON.stringify({
  slug: cleanSlug,
  laneId: String(laneId || '').trim(),
  title: String(title || cleanSlug),
  port: cleanPort,
  routeMode: cleanMode,
  domain: cleanDomain,
  subpath: cleanSubpath,
  publicUrl,
  civilMemoryUrl: cleanCmUrl,
  dataBasePath: dataBasePath || null,
  updatedAt: new Date().toISOString(),
 })))}`)
 lines.push(`node - "$INSTALL_ROOT/registry.json" "$REG_ENTRY_B64" <<'NODEEOF'`)
 lines.push("const fs = require('node:fs')")
 lines.push('const [regPath, entryB64] = process.argv.slice(2)')
 lines.push("const entry = JSON.parse(Buffer.from(entryB64, 'base64').toString('utf8'))")
 lines.push('let reg = {}')
 lines.push("try { reg = JSON.parse(fs.readFileSync(regPath, 'utf8')) } catch { reg = {} }")
 lines.push('reg[entry.slug] = entry')
 lines.push('fs.writeFileSync(regPath, JSON.stringify(reg, null, 1))')
 lines.push('NODEEOF')

 lines.push('echo "Waiting for service health check on 127.0.0.1:${PORT}/_cc/health..."')
 lines.push('READY=0')
 lines.push('for i in $(seq 1 20); do')
 lines.push(' if curl -sf "http://127.0.0.1:${PORT}/_cc/health" >/dev/null 2>&1; then')
 lines.push('  READY=1')
 lines.push('  break')
 lines.push(' fi')
 lines.push(' sleep 0.4')
 lines.push('done')
 lines.push('if [ "$READY" -ne 1 ]; then')
 lines.push(' echo "Lane service failed health check. Recent logs:" >&2')
 lines.push(' sudo journalctl -u "civil-lane-${SLUG}.service" -n 30 --no-pager >&2 || true')
 lines.push(' exit 1')
 lines.push('fi')
 lines.push('if ! curl -sf -X POST "http://127.0.0.1:${PORT}/_cc/reload" >/dev/null; then')
 lines.push(' echo "Lane service failed reload verification. Recent logs:" >&2')
 lines.push(' sudo journalctl -u "civil-lane-${SLUG}.service" -n 30 --no-pager >&2 || true')
 lines.push(' exit 1')
 lines.push('fi')

 const okPayload = JSON.stringify({
  ok: true,
  slug: cleanSlug,
  laneId: String(laneId || '').trim(),
  port: cleanPort,
  publicUrl,
  deployedAt: new Date().toISOString(),
 })
 lines.push(`echo ${shellQuote(`__CC_DEPLOY_OK__ ${okPayload}`)}`)
 return lines.join('\n') + '\n'
}

export function generateFastResyncScript(options = {}) {
 const {
  slug,
  laneId,
  port = 4100,
  routeMode = 'subpath',
  domain = '',
  subpath = '',
  enableLetsEncrypt = false,
  civilMemoryUrl,
  dataBasePath = '',
  installRoot = '/opt/civil-command',
  runtimeFiles = {},
  syncBundle = null,
 } = options
 const cleanSlug = normalizeServiceSlug(slug || laneId)
 const cleanRoot = normalizeRemoteDirPath(installRoot, '/opt/civil-command')
 const serviceDir = `${cleanRoot}/${cleanSlug}`
 const cleanPort = Number(port) || 4100
 const cleanMode = routeMode === 'domain' ? 'domain' : 'subpath'
 const cleanDomain = domain ? normalizeDomainName(domain) : ''
 const cleanSubpath = cleanMode === 'subpath' ? (normalizeSubpath(subpath || `/${cleanSlug}`) || `/${cleanSlug}`) : ''
 const cleanCmUrl = normalizeCivilMemoryBaseUrl(civilMemoryUrl)
 const publicUrl = cleanDomain
  ? `${enableLetsEncrypt ? 'https' : 'http'}://${cleanDomain}${cleanMode === 'subpath' && cleanSubpath !== '/' ? cleanSubpath : ''}`
  : `http://127.0.0.1:${cleanPort}`

 const fullDeployScript = generateDeployScript(options)
 if (!syncBundle || !Array.isArray(syncBundle.lanes) || syncBundle.lanes.length === 0) {
  return fullDeployScript
 }

 const bundledNames = resolveBundledRuntimeFileNames(runtimeFiles, {
  requiredBase: [
   'field.mjs',
   'data.mjs',
   'storage.mjs',
   'sandbox.mjs',
   'source-worker.mjs',
   'lane-http.mjs',
   'lane-server.mjs',
  ],
  entryFiles: ['lane-server.mjs', 'source-worker.mjs'],
 })

 const fastLines = [
  '#!/usr/bin/env bash',
  'set -euo pipefail',
  `INSTALL_ROOT=${shellQuote(cleanRoot)}`,
  `SERVICE_DIR=${shellQuote(serviceDir)}`,
  `SLUG=${shellQuote(cleanSlug)}`,
  `PORT=${shellQuote(String(cleanPort))}`,
  'if [ -d "$SERVICE_DIR" ] && [ -f "$SERVICE_DIR/config.json" ] && sudo systemctl is-active --quiet "civil-lane-${SLUG}.service"; then',
  ' sudo chmod 755 "$INSTALL_ROOT" "$SERVICE_DIR" 2>/dev/null || true',
  ' CC_RUNTIME_UPDATED=0',
 ]
 for (const name of bundledNames) {
  fastLines.push(' CC_TMP_FILE="$(mktemp)"')
  fastLines.push(` printf '%s' ${shellQuote(encodeBase64(runtimeFiles[name]))} | base64 -d > "$CC_TMP_FILE"`)
  fastLines.push(' chmod 644 "$CC_TMP_FILE"')
  fastLines.push(` if [ ! -f "$SERVICE_DIR/${name}" ] || ! cmp -s "$CC_TMP_FILE" "$SERVICE_DIR/${name}"; then`)
  fastLines.push(`  mv "$CC_TMP_FILE" "$SERVICE_DIR/${name}"`)
  fastLines.push('  CC_RUNTIME_UPDATED=1')
  fastLines.push(' else')
  fastLines.push('  rm -f "$CC_TMP_FILE"')
  fastLines.push(' fi')
 }
 fastLines.push(' chmod 644 "$SERVICE_DIR"/*.mjs "$SERVICE_DIR/package.json" "$SERVICE_DIR/config.json" 2>/dev/null || true')
 fastLines.push(
  ' SYNC_BUNDLE_TMP="$(mktemp "$SERVICE_DIR/.sync-bundle.XXXXXX.json")"',
  ` printf '%s' ${shellQuote(encodeBase64(JSON.stringify(syncBundle)))} | base64 -d > "$SYNC_BUNDLE_TMP"`,
  ` (cd "$SERVICE_DIR" && CC_SYNC_FILE="$SYNC_BUNDLE_TMP" CC_KV_URL=${shellQuote(cleanCmUrl)} CC_KV_BASE=${shellQuote(dataBasePath || '')} node --input-type=module - <<'NODEEOF'`,
  "import fs from 'node:fs/promises'",
  "import { httpKV } from './data.mjs'",
  "import { writeLaneSyncBundleToKv } from './storage.mjs'",
  "const bundle = JSON.parse(await fs.readFile(process.env.CC_SYNC_FILE, 'utf8'))",
  "const kv = httpKV({ baseUrl: process.env.CC_KV_URL, basePath: process.env.CC_KV_BASE || null, switchable: false, triggers: true })",
  'const res = await writeLaneSyncBundleToKv(kv, bundle, null)',
  "console.log('__CC_SYNC_OK__ ' + JSON.stringify(res))",
  'NODEEOF',
  ' )',
  ' rm -f "$SYNC_BUNDLE_TMP"',
  ' if [ "$CC_RUNTIME_UPDATED" = "1" ]; then',
  '  sudo systemctl reset-failed "civil-lane-${SLUG}.service" >/dev/null 2>&1 || true',
  '  sudo systemctl restart "civil-lane-${SLUG}.service"',
  '  READY=0',
  '  for i in $(seq 1 20); do',
  '   if curl -sf "http://127.0.0.1:${PORT}/_cc/health" >/dev/null 2>&1; then',
  '    READY=1',
  '    break',
  '   fi',
  '   sleep 0.4',
  '  done',
  '  if [ "$READY" -eq 1 ] && curl -sf -X POST "http://127.0.0.1:${PORT}/_cc/reload" >/dev/null 2>&1; then',
  `   echo "__CC_DEPLOY_OK__ $(node -e 'console.log(JSON.stringify({ok:true,slug:process.argv[1],laneId:process.argv[2],port:Number(process.argv[3]),publicUrl:process.argv[4],deployedAt:new Date().toISOString(),mode:"restart"}))' "$SLUG" ${shellQuote(String(laneId || '').trim())} "$PORT" ${shellQuote(publicUrl)})"`,
  '   exit 0',
  '  fi',
  ' else',
  '  if curl -sf -X POST "http://127.0.0.1:${PORT}/_cc/reload" >/dev/null 2>&1; then',
  `   echo "__CC_DEPLOY_OK__ $(node -e 'console.log(JSON.stringify({ok:true,slug:process.argv[1],laneId:process.argv[2],port:Number(process.argv[3]),publicUrl:process.argv[4],deployedAt:new Date().toISOString(),mode:"reload"}))' "$SLUG" ${shellQuote(String(laneId || '').trim())} "$PORT" ${shellQuote(publicUrl)})"`,
  '   exit 0',
  '  fi',
  ' fi',
  'fi',
  fullDeployScript,
 )
 return fastLines.join('\n')
}

const activeResyncQueues = new Map()

function enqueueResync(key, fn) {
 const cleanKey = String(key || '__default__')
 const prev = activeResyncQueues.get(cleanKey) || Promise.resolve()
 const next = prev.then(fn, fn)
 const tracked = next.finally(() => {
  if (activeResyncQueues.get(cleanKey) === tracked) {
   activeResyncQueues.delete(cleanKey)
  }
 })
 activeResyncQueues.set(cleanKey, tracked)
 return next
}

export function executeRemoteSshScript(server, scriptText, options = {}) {
 const target = validateSshTarget(server || {})
 const timeoutMs = Number(options.timeoutMs) > 0 ? Number(options.timeoutMs) : 60000
 const spawnImpl = options.spawnImpl || spawn
 const sshArgs = [
  '-o', 'BatchMode=yes',
  '-o', 'ConnectTimeout=15',
  '-o', 'StrictHostKeyChecking=accept-new',
  ...buildSshBaseArgs(target),
  `${target.user}@${target.host}`,
  'bash -s',
 ]
 return new Promise((resolve, reject) => {
  let stdout = ''
  let stderr = ''
  let settled = false
  const child = spawnImpl('ssh', sshArgs, { stdio: ['pipe', 'pipe', 'pipe'] })
  const timer = setTimeout(() => {
   if (!settled) {
    settled = true
    try { child.kill('SIGKILL') } catch {}
    reject(new Error(`SSH resync timed out after ${timeoutMs}ms`))
   }
  }, timeoutMs)

  if (child.stdout) {
   child.stdout.on('data', chunk => {
    stdout += chunk.toString('utf8')
   })
  }
  if (child.stderr) {
   child.stderr.on('data', chunk => {
    stderr += chunk.toString('utf8')
   })
  }
  child.on('error', err => {
   if (!settled) {
    settled = true
    clearTimeout(timer)
    reject(err)
   }
  })
  child.on('close', code => {
   if (settled) {
    return
   }
   settled = true
   clearTimeout(timer)
   resolve({ code: code ?? 0, stdout, stderr })
  })
  if (child.stdin) {
   child.stdin.write(String(scriptText || ''))
   child.stdin.end()
  }
 })
}

function parseSentinelLine(outputText, sentinel) {
 const lines = String(outputText || '').split(/\r?\n/)
 for (let i = lines.length - 1; i >= 0; i--) {
  const line = lines[i].trim()
  const idx = line.indexOf(sentinel)
  if (idx !== -1) {
   const jsonPart = line.slice(idx + sentinel.length).trim()
   if (!jsonPart) {
    return {}
   }
   try {
    return JSON.parse(jsonPart)
   }
   catch {
    return {}
   }
  }
 }
 return null
}

export async function executeLaneResync({
 laneId = '',
 deployment = null,
 server = null,
 bundle = null,
 rootDir = REPO_DIR,
 kvFactory = null,
 fetchImpl = globalThis.fetch,
 sshRunner = null,
} = {}) {
 if (!bundle || !Array.isArray(bundle.lanes) || bundle.lanes.length === 0) {
  return { ok: false, error: 'Valid lane sync bundle is required' }
 }
 const dep = deployment && typeof deployment === 'object' ? deployment : {}
 const cleanLaneId = String(laneId || dep.laneId || bundle.mainLaneId || '').trim()
 const slug = normalizeServiceSlug(dep.slug || dep.title || cleanLaneId || 'lane-service')
 const queueKey = `${dep.serverId || ''}::${slug}::${cleanLaneId}`

 return enqueueResync(queueKey, async () => {
  const startMs = Date.now()
  const hasSshServer = Boolean(server && typeof server === 'object' && String(server.host || '').trim())
  const rawCmUrl = String(dep.civilMemoryUrl || (server && server.civilMemoryUrl) || 'http://127.0.0.1:3333').trim()
  let cleanCmUrl = ''
  try {
   cleanCmUrl = normalizeCivilMemoryBaseUrl(rawCmUrl)
  }
  catch {
   cleanCmUrl = ''
  }

  if (hasSshServer) {
   const runtimeFiles = await readRuntimeFiles(rootDir)
   const scriptText = generateFastResyncScript({
    slug,
    laneId: cleanLaneId,
    title: dep.title || slug,
    port: dep.port || 4100,
    routeMode: dep.routeMode || 'subpath',
    domain: dep.domain || (server && server.defaultDomain) || '',
    subpath: dep.subpath || `/${slug}`,
    enableLetsEncrypt: Boolean(dep.enableLetsEncrypt),
    letsEncryptEmail: dep.letsEncryptEmail || '',
    cors: dep.cors !== false,
    civilMemoryUrl: cleanCmUrl || 'http://127.0.0.1:3333/?mode=disk',
    dataBasePath: dep.dataBasePath || '',
    includeImports: Boolean(dep.includeImports),
    installRoot: (server && server.installRoot) || '/opt/civil-command',
    runtimeFiles,
    syncBundle: bundle,
   })
   const runSsh = sshRunner || executeRemoteSshScript
   const sshRes = await runSsh(server, scriptText)
   const deploySentinel = parseSentinelLine(sshRes.stdout, '__CC_DEPLOY_OK__')
   const syncSentinel = parseSentinelLine(sshRes.stdout, '__CC_SYNC_OK__')
   if (sshRes.code !== 0 && !deploySentinel) {
    const errMsg = (sshRes.stderr || sshRes.stdout || `SSH exited with code ${sshRes.code}`).trim().slice(-400)
    return {
     ok: false,
     slug,
     laneId: cleanLaneId,
     error: errMsg || `SSH deploy failed (exit ${sshRes.code})`,
     durationMs: Math.max(0, Date.now() - startMs),
    }
   }
   const nowIso = new Date().toISOString()
   const deployedAt = (deploySentinel && deploySentinel.deployedAt) || nowIso
   const publicUrl = (deploySentinel && deploySentinel.publicUrl) || dep.publicUrl || ''
   return {
    ok: true,
    slug,
    laneId: cleanLaneId,
    port: Number(dep.port) || 4100,
    publicUrl,
    deployedAt,
    syncedAt: (syncSentinel && syncSentinel.syncedAt) || deployedAt,
    laneIds: (syncSentinel && Array.isArray(syncSentinel.laneIds)) ? syncSentinel.laneIds : bundle.lanes.map(l => l.id),
    mode: (deploySentinel && deploySentinel.mode) || 'deploy',
    durationMs: Math.max(0, Date.now() - startMs),
   }
  }

  if (cleanCmUrl) {
   const basePath = dep.dataBasePath ? String(dep.dataBasePath).trim() : null
   const rawKv = kvFactory
    ? kvFactory({ baseUrl: cleanCmUrl, basePath })
    : httpKV({ baseUrl: cleanCmUrl, basePath, switchable: false })
   const kv = withKvTriggers(rawKv, true)
   const syncRes = await writeLaneSyncBundleToKv(kv, bundle, null)
   let reloaded = false
   if (dep.reloadUrl || dep.port) {
    const reloadTarget = dep.reloadUrl || `http://127.0.0.1:${Number(dep.port) || 4100}/_cc/reload`
    try {
     const rResp = await fetchImpl(reloadTarget, {
      method: 'POST',
      signal: AbortSignal.timeout(5000),
     })
     reloaded = Boolean(rResp && rResp.ok)
    }
    catch {
     reloaded = false
    }
   }
   const nowIso = syncRes.syncedAt || new Date().toISOString()
   return {
    ok: true,
    slug,
    laneId: cleanLaneId,
    port: Number(dep.port) || 4100,
    publicUrl: dep.publicUrl || '',
    deployedAt: nowIso,
    syncedAt: nowIso,
    laneIds: syncRes.laneIds || bundle.lanes.map(l => l.id),
    mode: reloaded ? 'reload' : 'kv-sync',
    durationMs: Math.max(0, Date.now() - startMs),
   }
  }

  const nowIso = new Date().toISOString()
  return {
   ok: true,
   slug,
   laneId: cleanLaneId,
   port: Number(dep.port) || 4100,
   publicUrl: dep.publicUrl || '',
   deployedAt: nowIso,
   syncedAt: nowIso,
   laneIds: bundle.lanes.map(l => l.id),
   mode: 'local',
   durationMs: Math.max(0, Date.now() - startMs),
  }
 })
}

export function generateUndeployScript({
 slug,
 domain = '',
 routeMode = 'subpath',
 installRoot = '/opt/civil-command',
} = {}) {
 const cleanSlug = normalizeServiceSlug(slug)
 const cleanRoot = normalizeRemoteDirPath(installRoot, '/opt/civil-command')
 const cleanDomain = domain ? normalizeDomainName(domain) : ''
 const snippetFile = routeMode === 'domain' ? `00-root-${cleanSlug}.conf` : `${cleanSlug}.conf`
 const lines = [
  '#!/usr/bin/env bash',
  'set -euo pipefail',
  `SLUG=${shellQuote(cleanSlug)}`,
  `INSTALL_ROOT=${shellQuote(cleanRoot)}`,
  `SERVICE_DIR=${shellQuote(`${cleanRoot}/${cleanSlug}`)}`,
  'sudo systemctl stop "civil-lane-${SLUG}.service" || true',
  'sudo systemctl disable "civil-lane-${SLUG}.service" || true',
  'sudo rm -f "/etc/systemd/system/civil-lane-${SLUG}.service"',
  'sudo systemctl daemon-reload',
 ]
 if (cleanDomain) {
  lines.push(`CC_NGINX_DIR=${shellQuote(`/etc/nginx/civil-command/${cleanDomain}.d`)}`)
  lines.push(`sudo rm -f ${shellQuote(`/etc/nginx/civil-command/${cleanDomain}.d/${snippetFile}`)} ${shellQuote(`/etc/nginx/civil-command/${cleanDomain}.d/${cleanSlug}.conf`)} ${shellQuote(`/etc/nginx/civil-command/${cleanDomain}.d/00-root-${cleanSlug}.conf`)}`)
  if (routeMode === 'domain') {
   const sharedRootB64 = encodeBase64(generateNginxSharedRootFallbackConfig({ domain: cleanDomain }))
   const managedDebian = `/etc/nginx/sites-enabled/civil-command-${cleanDomain}.conf`
   const managedConfD = `/etc/nginx/conf.d/civil-command-${cleanDomain}.conf`
   lines.push(`if [ -e ${shellQuote(managedDebian)} ] || [ -e ${shellQuote(managedConfD)} ]; then`)
   lines.push(' CC_HAS_SUBPATH_SNIPPET=0')
   lines.push(' CC_HAS_ROOT_LOC=0')
   lines.push(' if [ -d "$CC_NGINX_DIR" ]; then')
   lines.push('  for CC_F in "$CC_NGINX_DIR"/*.conf; do')
   lines.push('   [ -e "$CC_F" ] || continue')
   lines.push('   [ "$(basename "$CC_F")" = "zz-shared-root.conf" ] && continue')
   lines.push('   CC_HAS_SUBPATH_SNIPPET=1')
   lines.push('   if grep -Eq \'^[[:space:]]*location[[:space:]]+/[[:space:]]*\\{\' "$CC_F"; then')
   lines.push('    CC_HAS_ROOT_LOC=1')
   lines.push('   fi')
   lines.push('  done')
   lines.push(' fi')
   lines.push(' if [ "$CC_HAS_SUBPATH_SNIPPET" = "1" ] && [ "$CC_HAS_ROOT_LOC" = "0" ]; then')
   lines.push(`  printf '%s' ${shellQuote(sharedRootB64)} | base64 -d | sudo tee "$CC_NGINX_DIR/zz-shared-root.conf" >/dev/null`)
   lines.push(' fi')
   lines.push('fi')
  }
  lines.push('if command -v nginx >/dev/null 2>&1; then')
  lines.push(' sudo nginx -t')
  lines.push(' if sudo systemctl is-active --quiet nginx; then')
  lines.push('  sudo systemctl reload nginx')
  lines.push(' else')
  lines.push('  sudo systemctl enable --now nginx')
  lines.push(' fi')
  lines.push('fi')
 }
 lines.push('sudo rm -rf "$SERVICE_DIR"')
 lines.push('if [ -f "$INSTALL_ROOT/registry.json" ]; then')
 lines.push(' node - "$INSTALL_ROOT/registry.json" "$SLUG" <<\'NODEEOF\'')
 lines.push(" const fs = require('node:fs')")
 lines.push(' const [regPath, slug] = process.argv.slice(2)')
 lines.push(" try { const reg = JSON.parse(fs.readFileSync(regPath, 'utf8')); delete reg[slug]; fs.writeFileSync(regPath, JSON.stringify(reg, null, 1)) } catch {}")
 lines.push('NODEEOF')
 lines.push('fi')
 const payload = JSON.stringify({ ok: true, slug: cleanSlug, undeployedAt: new Date().toISOString() })
 lines.push(`echo ${shellQuote(`__CC_UNDEPLOY_OK__ ${payload}`)}`)
 return lines.join('\n') + '\n'
}

export function generateServiceActionScript({
 slug,
 action = 'status',
 port = 4100,
 installRoot = '/opt/civil-command',
 runtimeFiles = null,
} = {}) {
 const cleanSlug = normalizeServiceSlug(slug)
 const cleanAction = String(action || 'status').trim().toLowerCase()
 const allowed = ['start', 'stop', 'restart', 'status', 'logs', 'reload']
 if (!allowed.includes(cleanAction)) {
  throw new Error(`Unsupported service action: ${action}`)
 }
 const cleanPort = Number(port) || 4100
 const unit = `civil-lane-${cleanSlug}.service`
 const lines = ['#!/usr/bin/env bash', 'set -euo pipefail']
 const requiredRuntime = [
  'field.mjs',
  'data.mjs',
  'storage.mjs',
  'sandbox.mjs',
  'source-worker.mjs',
  'lane-http.mjs',
  'lane-server.mjs',
 ]
 const hasRuntimeFiles = Boolean(
  runtimeFiles &&
  typeof runtimeFiles === 'object' &&
  requiredRuntime.every(name => typeof runtimeFiles[name] === 'string' && runtimeFiles[name].length > 0)
 )
 if (hasRuntimeFiles && (cleanAction === 'logs' || cleanAction === 'restart' || cleanAction === 'start')) {
  const copyRuntime = resolveBundledRuntimeFileNames(runtimeFiles, {
   requiredBase: requiredRuntime,
   entryFiles: ['lane-server.mjs', 'source-worker.mjs'],
  })
  const cleanRoot = normalizeRemoteDirPath(installRoot, '/opt/civil-command')
  const serviceDir = `${cleanRoot}/${cleanSlug}`
  lines.push(`SERVICE_DIR=${shellQuote(serviceDir)}`)
  lines.push('if [ -d "$SERVICE_DIR" ]; then')
  lines.push(` sudo chmod 755 ${shellQuote(cleanRoot)} "$SERVICE_DIR" 2>/dev/null || true`)
  lines.push(' chmod 644 "$SERVICE_DIR/package.json" "$SERVICE_DIR/config.json" 2>/dev/null || true')
  lines.push(' CC_RUNTIME_UPDATED=0')
  for (const name of copyRuntime) {
   lines.push(' CC_TMP_FILE="$(mktemp)"')
   lines.push(` printf '%s' ${shellQuote(encodeBase64(runtimeFiles[name]))} | base64 -d > "$CC_TMP_FILE"`)
   lines.push(' chmod 644 "$CC_TMP_FILE"')
   lines.push(` if [ ! -f "$SERVICE_DIR/${name}" ] || ! cmp -s "$CC_TMP_FILE" "$SERVICE_DIR/${name}"; then`)
   lines.push(`  mv "$CC_TMP_FILE" "$SERVICE_DIR/${name}"`)
   lines.push('  CC_RUNTIME_UPDATED=1')
   lines.push(' else')
   lines.push('  rm -f "$CC_TMP_FILE"')
   lines.push(' fi')
  }
  if (cleanAction === 'logs') {
   lines.push(' if [ "$CC_RUNTIME_UPDATED" = "1" ]; then')
   lines.push(`  sudo systemctl reset-failed ${shellQuote(unit)} >/dev/null 2>&1 || true`)
   lines.push(`  sudo systemctl restart ${shellQuote(unit)}`)
   lines.push(' fi')
  }
  lines.push('fi')
 }
 if (cleanAction === 'logs') {
  lines.push(`sudo journalctl -u ${shellQuote(unit)} -n 80 --no-pager || true`)
  lines.push('echo "__CC_LOGS_FOLLOW__"')
  lines.push(`exec sudo journalctl -u ${shellQuote(unit)} -n 0 -f`)
 }
 else if (cleanAction === 'status') {
  lines.push(`sudo systemctl status ${shellQuote(unit)} --no-pager || true`)
  lines.push(`echo "--- /_cc/health ---"`)
  lines.push(`curl -sS ${shellQuote(`http://127.0.0.1:${cleanPort}/_cc/health`)} || true`)
  lines.push('echo ""')
 }
 else if (cleanAction === 'reload') {
  lines.push(`curl -sf -X POST ${shellQuote(`http://127.0.0.1:${cleanPort}/_cc/reload`)}`)
  lines.push('echo ""')
 }
 else {
  if (cleanAction === 'restart' || cleanAction === 'start') {
   lines.push(`sudo systemctl reset-failed ${shellQuote(unit)} >/dev/null 2>&1 || true`)
  }
  lines.push(`sudo systemctl ${cleanAction} ${shellQuote(unit)}`)
  lines.push(`sudo systemctl status ${shellQuote(unit)} --no-pager || true`)
 }
 return lines.join('\n') + '\n'
}

export function generateLocalControlMasterRunner({
 target,
 localScriptPath,
 sessionId,
} = {}) {
 const clean = validateSshTarget(target)
 const baseArgs = buildSshBaseArgs(clean)
 const shortId = String(sessionId || crypto.randomUUID()).replace(/[^a-zA-Z0-9]/g, '').slice(0, 12) || 'cc'
 const ctrlSock = `/tmp/cc-ssh-${shortId}`
 const remoteScript = `/tmp/cc-run-${shortId}.sh`
 const sshDest = `${clean.user}@${clean.host}`
 const sshBaseStr = baseArgs.map(shellQuote).join(' ')
 const scpBaseArgs = ['-P', String(clean.sshPort), ...(clean.identityFile ? ['-i', clean.identityFile] : [])]
 const scpBaseStr = scpBaseArgs.map(shellQuote).join(' ')

 return [
  '#!/usr/bin/env bash',
  'set -euo pipefail',
  `CTRL_SOCK=${shellQuote(ctrlSock)}`,
  `SSH_DEST=${shellQuote(sshDest)}`,
  `LOCAL_SCRIPT=${shellQuote(localScriptPath)}`,
  `REMOTE_SCRIPT=${shellQuote(remoteScript)}`,
  'cleanup() {',
  ' ssh -S "$CTRL_SOCK" -O exit "$SSH_DEST" >/dev/null 2>&1 || true',
  ' rm -f "$CTRL_SOCK" "$LOCAL_SCRIPT" >/dev/null 2>&1 || true',
  '}',
  'trap cleanup EXIT',
  'echo "Connecting to $SSH_DEST..."',
  `ssh -M -S "$CTRL_SOCK" -o ControlPersist=120 -fN ${sshBaseStr} "$SSH_DEST"`,
  `scp -o ControlPath="$CTRL_SOCK" ${scpBaseStr} "$LOCAL_SCRIPT" "$SSH_DEST:$REMOTE_SCRIPT"`,
  `ssh -tt -o ControlPath="$CTRL_SOCK" ${sshBaseStr} "$SSH_DEST" "bash ${shellQuote(remoteScript)}; rc=\\$?; rm -f ${shellQuote(remoteScript)}; exit \\$rc"`,
  '',
 ].join('\n')
}

export { hasJsonContentType, isAllowedLocalHost, isAllowedLocalOrigin }

function sendJson(res, status, payload, extraHeaders = null) {
 const body = JSON.stringify(payload)
 res.writeHead(status, {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
  ...(extraHeaders || {}),
 })
 res.end(body)
}

function readJsonBody(req) {
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
   if (total > MAX_JSON_BODY_BYTES) {
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
   const text = Buffer.concat(chunks).toString('utf8').trim()
   if (!text) {
    resolve({})
    return
   }
   try {
    const parsed = JSON.parse(text)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
     const err = new Error('Expected JSON object body')
     err.status = 400
     reject(err)
     return
    }
    resolve(parsed)
   }
   catch {
    const err = new Error('Invalid JSON body')
    err.status = 400
    reject(err)
   }
  })
  req.on('error', err => {
   if (!settled) {
    settled = true
    reject(err)
   }
  })
 })
}

export async function readRuntimeFiles(rootDir = REPO_DIR) {
 const files = {}
 const queue = [...DEPLOY_RUNTIME_BASE_FILES]
 const queued = new Set(queue)
 while (queue.length > 0) {
  const name = queue.shift()
  if (!SAFE_RUNTIME_MJS_RE.test(name)) {
   continue
  }
  const text = await fs.readFile(path.join(rootDir, name), 'utf8')
  files[name] = text
  for (const dep of extractLocalMjsImports(text)) {
   if (SAFE_RUNTIME_MJS_RE.test(dep) && !queued.has(dep)) {
    queued.add(dep)
    queue.push(dep)
   }
  }
 }
 const orderedNames = resolveBundledRuntimeFileNames(files, {
  requiredBase: [...DEPLOY_RUNTIME_BASE_FILES],
  entryFiles: ['lane-server.mjs', 'source-worker.mjs', 'data.mjs', 'storage.mjs'],
 })
 return Object.fromEntries(orderedNames.map(name => [name, files[name]]))
}

export async function handleDeployApiRequest(req, res, opts = {}) {
 if (!isAllowedLocalOrigin(req, opts)) {
  return sendJson(res, 403, { ok: false, error: 'Cross-origin deploy access denied' })
 }
 if (opts.requireAuth !== false) {
  const authRes = verifyApiSessionToken(req, {
   secretStore: opts.secretStore || getDefaultServerSecretStore(),
   allowQueryToken: false,
   allowLaneScoped: false,
  })
  if (!authRes.ok) {
   return sendJson(res, authRes.status, { ok: false, error: authRes.error }, authRes.headers)
  }
 }

 const url = new URL(req.url || '/', 'http://localhost')
 const pathname = url.pathname
 const method = (req.method || 'GET').toUpperCase()
 const terminalManager = opts.terminalManager || defaultTerminalManager
 const rootDir = opts.rootDir || REPO_DIR
 const fetchImpl = opts.fetchImpl || globalThis.fetch

 if (pathname === '/api/deploy/kv/test') {
  if (method !== 'POST') {
   return sendJson(res, 405, { ok: false, error: 'Method not allowed' })
  }
  if (!hasJsonContentType(req)) {
   return sendJson(res, 415, { ok: false, error: 'Content-Type must be application/json' })
  }
  let body
  try {
   body = await readJsonBody(req)
  }
  catch (err) {
   return sendJson(res, err && err.status ? err.status : 400, { ok: false, error: err.message || 'Invalid JSON body' })
  }

  let normalizedUrl
  try {
   normalizedUrl = normalizeCivilMemoryBaseUrl(body.url)
  }
  catch {
   return sendJson(res, 400, { ok: false, error: 'Invalid civil-memory URL' })
  }
  if (!normalizedUrl) {
   return sendJson(res, 400, { ok: false, error: 'civil-memory URL is required' })
  }

  const basePath = body.basePath ? String(body.basePath).trim() : null
  const startMs = Date.now()
  try {
   const targetUrl = new URL(normalizedUrl)
   if (basePath) {
    targetUrl.searchParams.set('modeOptions.disk.basePath', basePath)
   }
   const probeKey = `__cc_probe_${Date.now()}_${Math.random().toString(16).slice(2)}`
   targetUrl.searchParams.set('key', probeKey)

   const postResp = await fetchImpl(targetUrl.toString(), {
    method: 'POST',
    body: 'ok',
    signal: AbortSignal.timeout(10000),
   })
   if (!postResp.ok) {
    const errText = await postResp.text().catch(() => '')
    return sendJson(res, 502, {
     ok: false,
     error: `civil-memory POST failed (HTTP ${postResp.status}): ${errText || postResp.statusText}`,
    })
   }

   const getResp = await fetchImpl(targetUrl.toString(), {
    method: 'GET',
    signal: AbortSignal.timeout(10000),
   })
   const readBack = getResp.ok ? await getResp.text() : ''
   await fetchImpl(targetUrl.toString(), {
    method: 'DELETE',
    signal: AbortSignal.timeout(10000),
   }).catch(() => {})

   if (!getResp.ok || readBack !== 'ok') {
    return sendJson(res, 502, {
     ok: false,
     error: `civil-memory read-back verification failed (HTTP ${getResp.status})`,
    })
   }

   return sendJson(res, 200, {
    ok: true,
    url: normalizedUrl,
    basePath,
    latencyMs: Math.max(0, Date.now() - startMs),
   })
  }
  catch (err) {
   return sendJson(res, 502, {
    ok: false,
    error: err && err.message ? err.message : 'Failed to connect to civil-memory',
   })
  }
 }

 if (pathname === '/api/deploy/kv/sync') {
  if (method !== 'POST') {
   return sendJson(res, 405, { ok: false, error: 'Method not allowed' })
  }
  if (!hasJsonContentType(req)) {
   return sendJson(res, 415, { ok: false, error: 'Content-Type must be application/json' })
  }
  let body
  try {
   body = await readJsonBody(req)
  }
  catch (err) {
   return sendJson(res, err && err.status ? err.status : 400, { ok: false, error: err.message || 'Invalid JSON body' })
  }

  let normalizedUrl
  try {
   normalizedUrl = normalizeCivilMemoryBaseUrl(body.url)
  }
  catch {
   return sendJson(res, 400, { ok: false, error: 'Invalid civil-memory URL' })
  }
  if (!normalizedUrl) {
   return sendJson(res, 400, { ok: false, error: 'civil-memory URL is required' })
  }
  if (!body.bundle || !Array.isArray(body.bundle.lanes) || body.bundle.lanes.length === 0) {
   return sendJson(res, 400, { ok: false, error: 'Invalid lane sync bundle' })
  }

  const basePath = body.basePath ? String(body.basePath).trim() : null
  try {
   const rawKv = opts.kvFactory
    ? opts.kvFactory({ baseUrl: normalizedUrl, basePath })
    : httpKV({ baseUrl: normalizedUrl, basePath, switchable: false })
   const kv = withKvTriggers(rawKv, true)
   const result = await writeLaneSyncBundleToKv(kv, body.bundle, null)
   let reloaded = false
   if (typeof body.reloadUrl === 'string' && body.reloadUrl.trim()) {
    try {
     const reloadTarget = new URL(body.reloadUrl.trim())
     if (reloadTarget.protocol === 'http:' || reloadTarget.protocol === 'https:') {
      const rResp = await fetchImpl(reloadTarget.toString(), {
       method: 'POST',
       signal: AbortSignal.timeout(5000),
      })
      reloaded = Boolean(rResp && rResp.ok)
     }
    }
    catch {
     reloaded = false
    }
   }
   return sendJson(res, 200, { ...result, reloaded })
  }
  catch (err) {
   return sendJson(res, 502, {
    ok: false,
    error: err && err.message ? err.message : 'Failed to sync lane bundle to civil-memory',
   })
  }
 }

 if (pathname === '/api/deploy/resync') {
  if (method !== 'POST') {
   return sendJson(res, 405, { ok: false, error: 'Method not allowed' })
  }
  if (!hasJsonContentType(req)) {
   return sendJson(res, 415, { ok: false, error: 'Content-Type must be application/json' })
  }
  let body
  try {
   body = await readJsonBody(req)
  }
  catch (err) {
   return sendJson(res, err && err.status ? err.status : 400, { ok: false, error: err.message || 'Invalid JSON body' })
  }
  try {
   const result = await executeLaneResync({
    laneId: body.laneId,
    deployment: body.deployment,
    server: body.server,
    bundle: body.bundle,
    rootDir,
    kvFactory: opts.kvFactory || null,
    fetchImpl,
    sshRunner: opts.sshRunner || null,
   })
   return sendJson(res, result.ok ? 200 : 502, result)
  }
  catch (err) {
   return sendJson(res, 502, {
    ok: false,
    error: err && err.message ? err.message : 'Failed to resync deployed lane',
   })
  }
 }

 if (pathname === '/api/deploy/proxy') {
  if (method !== 'POST') {
   return sendJson(res, 405, { ok: false, error: 'Method not allowed' })
  }
  if (!hasJsonContentType(req)) {
   return sendJson(res, 415, { ok: false, error: 'Content-Type must be application/json' })
  }
  let body
  try {
   body = await readJsonBody(req)
  }
  catch (err) {
   return sendJson(res, err && err.status ? err.status : 400, { ok: false, error: err.message || 'Invalid JSON body' })
  }

  let targetUrl
  try {
   targetUrl = new URL(String(body.url || '').trim())
   if (targetUrl.protocol !== 'http:' && targetUrl.protocol !== 'https:') {
    throw new Error('Only http:// and https:// URLs are allowed')
   }
  }
  catch (err) {
   return sendJson(res, 400, { ok: false, error: err && err.message ? err.message : 'Invalid target URL' })
  }

  const targetMethod = String(body.method || 'GET').trim().toUpperCase() || 'GET'
  const reqHeaders = {}
  if (body.headers && typeof body.headers === 'object' && !Array.isArray(body.headers)) {
   for (const [k, v] of Object.entries(body.headers)) {
    if (k && v !== undefined && v !== null) {
     reqHeaders[String(k)] = String(v)
    }
   }
  }
  const hasBody = targetMethod !== 'GET' && targetMethod !== 'HEAD' && body.body !== undefined && body.body !== null && body.body !== ''
  const reqBody = hasBody
   ? (typeof body.body === 'string' ? body.body : JSON.stringify(body.body))
   : undefined

  const startMs = Date.now()
  try {
   const upstream = await fetchImpl(targetUrl.toString(), {
    method: targetMethod,
    headers: reqHeaders,
    body: reqBody,
    signal: AbortSignal.timeout(30000),
   })
   const bodyText = await upstream.text()
   const outHeaders = {}
   upstream.headers.forEach((v, k) => {
    outHeaders[k] = v
   })
   return sendJson(res, 200, {
    ok: true,
    status: upstream.status,
    statusText: upstream.statusText,
    headers: outHeaders,
    bodyText,
    durationMs: Math.max(0, Date.now() - startMs),
   })
  }
  catch (err) {
   return sendJson(res, 502, {
    ok: false,
    error: err && err.message ? err.message : 'Upstream request failed',
    durationMs: Math.max(0, Date.now() - startMs),
   })
  }
 }

 if (pathname === '/api/deploy/terminal/start') {
  if (method !== 'POST') {
   return sendJson(res, 405, { ok: false, error: 'Method not allowed' })
  }
  if (!hasJsonContentType(req)) {
   return sendJson(res, 415, { ok: false, error: 'Content-Type must be application/json' })
  }
  let body
  try {
   body = await readJsonBody(req)
  }
  catch (err) {
   return sendJson(res, err && err.status ? err.status : 400, { ok: false, error: err.message || 'Invalid JSON body' })
  }

  const action = String(body.action || 'shell').trim()
  const cols = Number(body.cols) || 100
  const rows = Number(body.rows) || 30
  let target
  try {
   target = validateSshTarget(body.server || {})
  }
  catch (err) {
   return sendJson(res, 400, { ok: false, error: err && err.message ? err.message : 'Invalid SSH target' })
  }

  if (action === 'shell') {
   const sshArgs = ['-tt', ...buildSshBaseArgs(target), `${target.user}@${target.host}`]
   const session = terminalManager.createSession({
    title: `SSH ${target.user}@${target.host}`,
    command: 'ssh',
    args: sshArgs,
    commandDisplay: `ssh ${sshArgs.join(' ')}`,
    cols,
    rows,
   })
   return sendJson(res, 200, {
    ok: true,
    sessionId: session.id,
    wsPath: `/api/deploy/terminal/ws?id=${encodeURIComponent(session.id)}`,
    title: session.title,
   })
  }

  let remoteScriptText
  let sessionTitle = `SSH ${target.user}@${target.host}`
  try {
   if (action === 'install-civil-memory') {
    const srv = body.server || {}
    sessionTitle = `Install civil-memory (${target.host})`
    remoteScriptText = generateInstallCivilMemoryScript({
     installDir: `${srv.installRoot || '/opt/civil-command'}/civil-memory`,
     port: srv.civilMemoryPort || 3333,
     defaultDataRoot: srv.civilMemoryDataRoot || '/opt/civil-command/data',
     exposeDomain: body.exposeDomain || '',
     enableLetsEncrypt: Boolean(body.enableLetsEncrypt),
     letsEncryptEmail: body.letsEncryptEmail || '',
    })
   }
   else if (action === 'test-kv') {
    sessionTitle = `Verify civil-memory (${target.host})`
    remoteScriptText = generateRemoteKvTestScript({
     url: body.url,
     basePath: body.basePath || '',
    })
   }
   else if (action === 'sync-lane') {
    const runtimeFiles = await readRuntimeFiles(rootDir)
    sessionTitle = `Sync Lane KV (${target.host})`
    remoteScriptText = generateRemoteKvSyncScript({
     url: body.url,
     basePath: body.basePath || '',
     bundle: body.bundle,
     runtimeFiles,
    })
   }
   else if (action === 'deploy-lane') {
    const runtimeFiles = await readRuntimeFiles(rootDir)
    const dep = body.deployment || {}
    const srv = body.server || {}
    sessionTitle = `Deploy ${dep.slug || dep.laneId || 'lane'} -> ${target.host}`
    remoteScriptText = generateDeployScript({
     slug: dep.slug,
     laneId: dep.laneId,
     title: dep.title,
     port: dep.port,
     routeMode: dep.routeMode,
     domain: dep.domain,
     subpath: dep.subpath,
     enableLetsEncrypt: Boolean(dep.enableLetsEncrypt),
     letsEncryptEmail: dep.letsEncryptEmail || '',
     cors: dep.cors !== false,
     civilMemoryUrl: dep.civilMemoryUrl,
     dataBasePath: dep.dataBasePath || '',
     includeImports: Boolean(dep.includeImports),
     installRoot: srv.installRoot || '/opt/civil-command',
     runtimeFiles,
     syncBundle: body.syncBundle || null,
    })
   }
   else if (action === 'service-action') {
    const dep = body.deployment || {}
    const srv = body.server || {}
    const svcAction = String(body.serviceAction || 'status')
    const svcActionLower = svcAction.trim().toLowerCase()
    const runtimeFiles = (svcActionLower === 'logs' || svcActionLower === 'restart' || svcActionLower === 'start')
     ? await readRuntimeFiles(rootDir)
     : null
    sessionTitle = `${svcAction} ${dep.slug || 'lane'} (${target.host})`
    remoteScriptText = generateServiceActionScript({
     slug: dep.slug,
     action: svcAction,
     port: dep.port,
     installRoot: srv.installRoot || '/opt/civil-command',
     runtimeFiles,
    })
   }
   else if (action === 'undeploy-lane') {
    const dep = body.deployment || {}
    const srv = body.server || {}
    sessionTitle = `Undeploy ${dep.slug || 'lane'} (${target.host})`
    remoteScriptText = generateUndeployScript({
     slug: dep.slug,
     domain: dep.domain,
     routeMode: dep.routeMode,
     installRoot: srv.installRoot || '/opt/civil-command',
    })
   }
   else {
    return sendJson(res, 400, { ok: false, error: `Unknown terminal action: ${action}` })
   }
  }
  catch (err) {
   return sendJson(res, 400, { ok: false, error: err && err.message ? err.message : 'Failed to build remote script' })
  }

  const tempId = crypto.randomUUID()
  const remoteScriptPath = path.join(os.tmpdir(), `cc-remote-${tempId}.sh`)
  const runnerScriptPath = path.join(os.tmpdir(), `cc-runner-${tempId}.sh`)
  await fs.writeFile(remoteScriptPath, remoteScriptText, { mode: 0o600 })
  const runnerText = generateLocalControlMasterRunner({
   target,
   localScriptPath: remoteScriptPath,
   sessionId: tempId,
  })
  await fs.writeFile(runnerScriptPath, runnerText, { mode: 0o700 })

  const session = terminalManager.createSession({
   title: sessionTitle,
   command: 'bash',
   args: [runnerScriptPath],
   commandDisplay: `${action} on ${target.user}@${target.host}:${target.sshPort}`,
   cols,
   rows,
   cleanup: async () => {
    await fs.unlink(remoteScriptPath).catch(() => {})
    await fs.unlink(runnerScriptPath).catch(() => {})
   },
  })

  return sendJson(res, 200, {
   ok: true,
   sessionId: session.id,
   wsPath: `/api/deploy/terminal/ws?id=${encodeURIComponent(session.id)}`,
   title: session.title,
  })
 }

 if (pathname === '/api/deploy/terminal/kill') {
  if (method !== 'POST') {
   return sendJson(res, 405, { ok: false, error: 'Method not allowed' })
  }
  if (!hasJsonContentType(req)) {
   return sendJson(res, 415, { ok: false, error: 'Content-Type must be application/json' })
  }
  let body
  try {
   body = await readJsonBody(req)
  }
  catch (err) {
   return sendJson(res, err && err.status ? err.status : 400, { ok: false, error: err.message || 'Invalid JSON body' })
  }
  const killed = terminalManager.killSession(body.sessionId)
  return sendJson(res, 200, { ok: killed })
 }

 return sendJson(res, 404, { ok: false, error: 'Not found' })
}

export function handleDeployUpgrade(req, socket, head, opts = {}) {
 if (!isAllowedLocalOrigin(req, opts)) {
  socket.write('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n')
  socket.destroy()
  return false
 }
 const url = new URL(req.url || '/', 'http://localhost')
 if (url.pathname !== '/api/deploy/terminal/ws') {
  socket.write('HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n')
  socket.destroy()
  return false
 }
 const sessionId = url.searchParams.get('id') || ''
 const terminalManager = opts.terminalManager || defaultTerminalManager
 return Boolean(terminalManager.attachWebSocket(sessionId, req, socket, head))
}
