import test from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import http from 'node:http'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
 DATA_RUNTIME_ENV,
 DEFAULT_PACKAGE_ID,
 PRIMITIVE_TYPES,
 SESSION_TOKEN_HEADER,
 agentGetSession,
 agentListSessions,
 buildDataUrl,
 clearTargetLaneLineSetBy,
 computeLaneScrollTop,
 createIdleTracker,
 createSandboxedOutputHost,
 createSourceWorkerRunner,
 defaultValueForType,
 field,
 formatAgentContext,
 formatAgentPrompt,
 formatImportLine,
 hasImportCycle,
 httpKV,
 initSessionState,
 inspectSessionForAgent,
 isSessionDirsDisabled,
 normalizeLineSetBy,
 normalizePrimitiveType,
 normalizeSessionDirsDisabled,
 parse,
 parseImportLine,
 resolveImportValue,
 resolveScopeColumns,
 runLinesInWorker,
 setSessionDataDir,
 simulateLaneRequestInWorker,
 stripDiskModeQueryParams,
} from './field.fixtures.mjs'
import {
 LANE_CRON_INTERVAL_MS,
 MIN_LANE_MODAL_HEIGHT,
 MIN_LANE_MODAL_WIDTH,
} from './field.mjs'
import {
 createFsDir,
 fetchFsList,
 fetchFsRoots,
} from './data.mjs'

const repoRoot = path.dirname(fileURLToPath(import.meta.url))
const startPath = path.join(repoRoot, 'start')

async function freePort() {
 const listener = net.createServer()
 listener.listen(0, '127.0.0.1')
 await new Promise(resolve => listener.once('listening', resolve))
 const port = listener.address().port
 await new Promise(resolve => listener.close(resolve))
 return port
}

function childEnvironment(dir, overrides = {}) {
 const env = { ...process.env, HOME: dir }
 for (const key of [
  'HOST', 'CC_HOST', 'PORT', 'CC_PORT', 'CC_ALLOWED_HOSTS',
  'CC_DATA_BACKEND_URL', 'CC_DISABLE_SESSION_DIRS',
  'CC_KEEP_ALIVE_TIMEOUT_MS', 'CC_HEADERS_TIMEOUT_MS',
  'CC_LISTEN_BACKLOG',
 ]) {
  delete env[key]
 }
 return { ...env, ...overrides }
}

function startServer(dir, env) {
 return new Promise((resolve, reject) => {
  const child = spawn(process.execPath, [startPath], {
   cwd: dir,
   env,
   stdio: ['ignore', 'pipe', 'pipe'],
  })
  let stdout = ''
  let stderr = ''
  let settled = false
  const finish = (err, value) => {
   if (settled) return
   settled = true
   clearTimeout(timer)
   if (err) reject(err)
   else resolve(value)
  }
  const timer = setTimeout(() => {
   finish(new Error(`start did not become ready; stdout=${stdout} stderr=${stderr}`))
  }, 15000)
  child.stdout.on('data', chunk => {
   stdout += chunk.toString()
   const match = /Serving on http:\/\/([^\s:]+):(\d+)/.exec(stdout)
   if (match) {
    finish(null, { child, host: match[1], port: Number(match[2]) })
   }
  })
  child.stderr.on('data', chunk => {
   stderr += chunk.toString()
  })
  child.on('exit', code => {
   finish(new Error(`start exited with ${code}; stdout=${stdout} stderr=${stderr}`))
  })
 })
}

function getStatus(port, hostHeader, origin) {
 return new Promise((resolve, reject) => {
  const headers = { Host: hostHeader }
  if (origin) headers.Origin = origin
  const req = http.request({
   hostname: '127.0.0.1',
   port,
   path: '/api/agent/sessions',
   method: 'GET',
   headers,
  }, res => {
   res.resume()
   res.on('end', () => resolve(res.statusCode))
  })
  req.on('error', reject)
  req.end()
 })
}

test('.env.local configures listen address, public origin, and socket timeouts', async t => {
 const dir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'cc-env-local-'))
 const port = await freePort()
 await fs.promises.writeFile(path.join(dir, '.env.local'), [
  '# production overrides moved out of source',
  'HOST=127.0.0.1',
  `PORT=${port}`,
  'CC_ALLOWED_HOSTS=public.example.com',
  'CC_DATA_BACKEND_URL=http://127.0.0.1:3333/?mode=disk',
  'CC_KEEP_ALIVE_TIMEOUT_MS=130000',
  'CC_HEADERS_TIMEOUT_MS=135000',
  'CC_LISTEN_BACKLOG=2048',
 ].join('\n') + '\n')
 const server = await startServer(dir, childEnvironment(dir))
 t.after(() => {
  server.child.kill('SIGTERM')
 })
 assert.equal(server.host, '127.0.0.1')
 assert.equal(server.port, port)

 // Localhost remains allowed by default.
 assert.notEqual(await getStatus(port, `127.0.0.1:${port}`), 403)
 // The public host and its matching Origin come from .env.local.
 assert.notEqual(await getStatus(port, 'public.example.com', 'https://public.example.com'), 403)
 // An unrelated host is still rejected by the shared security boundary.
 assert.equal(await getStatus(port, 'evil.example.com', 'https://evil.example.com'), 403)
})

test('explicit process environment takes precedence over .env.local', async t => {
 const dir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'cc-env-local-'))
 const filePort = await freePort()
 const envPort = await freePort()
 await fs.promises.writeFile(path.join(dir, '.env.local'), [
  'HOST=127.0.0.1',
  `PORT=${filePort}`,
 ].join('\n') + '\n')
 const server = await startServer(dir, childEnvironment(dir, { PORT: String(envPort) }))
 t.after(() => {
  server.child.kill('SIGTERM')
 })
 assert.equal(server.host, '127.0.0.1')
 assert.equal(server.port, envPort)
})

function createMemoryStorage(initialEntries = null) {
 const map = new Map(initialEntries || [])
 return {
  getItem(k) {
   return map.has(k) ? map.get(k) : null
  },
  setItem(k, v) {
   map.set(k, String(v))
  },
  removeItem(k) {
   map.delete(k)
  },
 }
}

function createMockElement(tag, ownerDoc = null) {
 const el = {
  tagName: String(tag || 'div').toUpperCase(),
  tag: String(tag || 'div').toLowerCase(),
  nodeType: 1,
  style: {
   setProperty(k, v) { this[k] = String(v) },
   removeProperty(k) { delete this[k] },
  },
  attributes: {},
  dataset: {},
  children: [],
  listeners: {},
  textContent: '',
  innerHTML: '',
  value: '',
  checked: false,
  className: '',
  id: '',
  title: '',
  hidden: false,
  disabled: false,
  parentNode: null,
  ownerDocument: ownerDoc,
  setAttribute(name, value) {
   const k = String(name)
   const v = String(value)
   this.attributes[k] = v
   if (k === 'id') this.id = v
  },
  getAttribute(name) {
   const k = String(name)
   return Object.hasOwn(this.attributes, k) ? this.attributes[k] : null
  },
  removeAttribute(name) {
   delete this.attributes[String(name)]
  },
  appendChild(child) {
   if (child && typeof child === 'object') {
    child.parentNode = this
    this.children.push(child)
   }
   return child
  },
  insertBefore(child, ref) {
   if (!child || typeof child !== 'object') return child
   child.parentNode = this
   const idx = this.children.indexOf(ref)
   if (idx === -1) this.children.push(child)
   else this.children.splice(idx, 0, child)
   return child
  },
  replaceChildren(...nodes) {
   this.children = []
   for (const node of nodes) this.appendChild(node)
  },
  remove() {
   if (this.parentNode && Array.isArray(this.parentNode.children)) {
    const idx = this.parentNode.children.indexOf(this)
    if (idx !== -1) this.parentNode.children.splice(idx, 1)
   }
   this.parentNode = null
  },
  contains(target) {
   let cur = target
   while (cur) {
    if (cur === this) return true
    cur = cur.parentNode
   }
   return false
  },
  addEventListener(type, fn) {
   this.listeners[String(type)] = fn
  },
  removeEventListener(type, fn) {
   if (this.listeners[String(type)] === fn) delete this.listeners[String(type)]
  },
  focus() {},
 }
 return el
}

function createMockWindow(appOrigin = 'http://127.0.0.1:8080') {
 const localStorage = createMemoryStorage()
 const sessionStorage = createMemoryStorage()
 const windowListeners = new Map()
 const mockLocation = {
  origin: appOrigin,
  href: `${appOrigin}/`,
  pathname: '/',
  search: '',
  hash: '',
 }
 let uuidSeq = 0
 return {
  Array,
  Boolean,
  Date,
  Intl,
  JSON,
  Math,
  Number,
  Object,
  Promise,
  Reflect,
  decodeURIComponent,
  encodeURIComponent,
  innerWidth: 1280,
  innerHeight: 800,
  scrollX: 0,
  scrollY: 0,
  location: mockLocation,
  localStorage,
  sessionStorage,
  navigator: {},
  crypto: {
   randomUUID: () => `env-${++uuidSeq}-${Math.random().toString(16).slice(2, 8)}`,
  },
  history: {
   pushState(_state, _title, url) {
    const next = new URL(String(url || '/'), appOrigin)
    mockLocation.pathname = next.pathname
    mockLocation.search = next.search
    mockLocation.hash = next.hash
    mockLocation.href = next.toString()
   },
   replaceState(_state, _title, url) {
    const next = new URL(String(url || '/'), appOrigin)
    mockLocation.pathname = next.pathname
    mockLocation.search = next.search
    mockLocation.hash = next.hash
    mockLocation.href = next.toString()
   },
  },
  scrollTo() {},
  setTimeout,
  clearTimeout,
  setInterval: () => 0,
  clearInterval: () => {},
  requestAnimationFrame: () => 0,
  cancelAnimationFrame: () => {},
  addEventListener(type, fn) {
   if (!windowListeners.has(type)) windowListeners.set(type, new Set())
   windowListeners.get(type).add(fn)
  },
  removeEventListener(type, fn) {
   const set = windowListeners.get(type)
   if (set) set.delete(fn)
  },
 }
}

test('single-directory helpers normalize CC_DISABLE_SESSION_DIRS and strip disk-mode query parameters', () => {
 assert.equal(normalizeSessionDirsDisabled(undefined), null)
 assert.equal(normalizeSessionDirsDisabled(''), null)
 assert.equal(normalizeSessionDirsDisabled('1'), true)
 assert.equal(normalizeSessionDirsDisabled('TRUE'), true)
 assert.equal(normalizeSessionDirsDisabled('yes'), true)
 assert.equal(normalizeSessionDirsDisabled('on'), true)
 assert.equal(normalizeSessionDirsDisabled('0'), false)
 assert.equal(normalizeSessionDirsDisabled('false'), false)
 assert.equal(normalizeSessionDirsDisabled('off'), false)
 assert.equal(normalizeSessionDirsDisabled('invalid'), null)

 assert.equal(
  stripDiskModeQueryParams('https://io.example.com/api/data?mode=disk&modeOptions.disk.basePath=%2Ftmp%2Fx&key=session'),
  'https://io.example.com/api/data?key=session'
 )
 assert.equal(
  buildDataUrl('http://localhost:3333/?mode=disk', '/tmp/custom', { disableSessionDirs: true }),
  'http://localhost:3333/'
 )
 assert.equal(
  buildDataUrl('http://localhost:3333/?mode=disk', '/tmp/custom', { disableSessionDirs: false }),
  'http://localhost:3333/?mode=disk&modeOptions.disk.basePath=%2Ftmp%2Fcustom'
 )

 assert.equal(isSessionDirsDisabled({ sessionDirsDisabled: true }), true)
 assert.equal(isSessionDirsDisabled({ root: { sessionDirsDisabled: true } }), true)
 assert.equal(isSessionDirsDisabled(null, { disableSessionDirs: true }), true)
 assert.equal(isSessionDirsDisabled({ sessionDirsDisabled: true }, { disableSessionDirs: false }), false)
})

test('CC_DISABLE_SESSION_DIRS=1 in .env.local enforces single-directory civil-memory (?key= only) and hides directory UI', async t => {
 const dir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'cc-env-single-dir-'))
 const port = await freePort()

 // Strict single-directory civil-memory mock: rejects any query param other than key
 const kvStore = new Map()
 const cmRequests = []
 const cmServer = http.createServer((req, res) => {
  const reqUrl = new URL(req.url || '/', 'http://127.0.0.1')
  const paramKeys = Array.from(reqUrl.searchParams.keys())
  if (paramKeys.some(k => k !== 'key') || !reqUrl.searchParams.has('key')) {
   cmRequests.push({ method: req.method, search: reqUrl.search, paramKeys, statusCode: 400 })
   res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' })
   res.end('Bad Request: The only supported query parameter is key')
   return
  }
  const key = reqUrl.searchParams.get('key') || ''
  if (req.method === 'GET' || req.method === 'HEAD') {
   if (!kvStore.has(key)) {
    cmRequests.push({ method: req.method, search: reqUrl.search, paramKeys, statusCode: 404 })
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
    res.end('Not found')
    return
   }
   const val = kvStore.get(key)
   cmRequests.push({ method: req.method, search: reqUrl.search, paramKeys, statusCode: 200 })
   res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' })
   res.end(req.method === 'HEAD' ? '' : val)
   return
  }
  if (req.method === 'POST') {
   const chunks = []
   req.on('data', c => chunks.push(c))
   req.on('end', () => {
    const body = Buffer.concat(chunks).toString('utf8')
    kvStore.set(key, body)
    cmRequests.push({ method: req.method, search: reqUrl.search, paramKeys, statusCode: 200 })
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' })
    res.end('ok')
   })
   return
  }
  if (req.method === 'DELETE') {
   kvStore.delete(key)
   cmRequests.push({ method: req.method, search: reqUrl.search, paramKeys, statusCode: 200 })
   res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' })
   res.end('ok')
   return
  }
  res.writeHead(405)
  res.end('Method not allowed')
 })
 await new Promise(resolve => cmServer.listen(0, '127.0.0.1', resolve))
 const cmPort = cmServer.address().port
 t.after(async () => {
  if (typeof cmServer.closeAllConnections === 'function') cmServer.closeAllConnections()
  await new Promise(resolve => cmServer.close(resolve))
 })

 // Even if CC_DATA_BACKEND_URL carries ?mode=disk, CC_DISABLE_SESSION_DIRS=1 strips it upstream.
 await fs.promises.writeFile(path.join(dir, '.env.local'), [
  'HOST=127.0.0.1',
  `PORT=${port}`,
  'CC_DISABLE_SESSION_DIRS=1',
  `CC_DATA_BACKEND_URL=http://127.0.0.1:${cmPort}/?mode=disk`,
 ].join('\n') + '\n')

 const server = await startServer(dir, childEnvironment(dir))
 t.after(() => {
  server.child.kill('SIGTERM')
 })

 const appOrigin = `http://127.0.0.1:${port}`
 const dataUrl = `${appOrigin}/api/data?mode=disk`
 const client = httpKV({
  baseUrl: dataUrl,
  switchable: true,
  proxyCapabilities: true,
  proactiveToken: true,
 })

 // 1. Initial client.get('session') (exactly like /src/main.fs) bootstraps and strips ?mode=disk without 400
 assert.equal(await client.get('session'), null)
 assert.equal(client.sessionDirsDisabled, true)
 const token = client.getSessionToken()
 assert.ok(token)

 // 2. Explicit basePath on /api/data and /api/fs/* are blocked with 403
 const basePathResp = await fetch(`${dataUrl}&modeOptions.disk.basePath=%2Ftmp%2Fother&key=session`, {
  headers: {
   Origin: appOrigin,
   [SESSION_TOKEN_HEADER]: token,
  },
 })
 assert.equal(basePathResp.status, 403)

 const fsResp = await fetch(`${appOrigin}/api/fs/roots`, {
  headers: {
   Origin: appOrigin,
   [SESSION_TOKEN_HEADER]: token,
  },
 })
 assert.equal(fsResp.status, 403)

 // 3. Session state is auto-confirmed with null dataDir and setSessionDataDir is rejected
 const headWin = createMockWindow(appOrigin)
 const sessState = await initSessionState(client, headWin)
 assert.equal(sessState.dataDir, null)
 assert.equal(sessState.dataDirConfirmed, true)
 const dirAttempt = await setSessionDataDir(client, headWin, sessState.sessionId, { dataDir: '/tmp/blocked' })
 assert.equal(dirAttempt.ok, false)

 const inspected = await inspectSessionForAgent(client, { sessionId: sessState.sessionId })
 assert.equal(inspected.dataDir, null)
 assert.equal(inspected.activeSession.dataDirConfirmed, true)
 const listed = await agentListSessions(client)
 assert.equal(listed.sessionDirsDisabled, true)
 const gotSession = await agentGetSession(client, { sessionId: sessState.sessionId })
 assert.equal(gotSession.sessionDirsDisabled, true)
 assert.equal(gotSession.agentContext.includes('Data Directory'), false)
 const ctx = formatAgentContext({
  sessionId: sessState.sessionId,
  sessionName: inspected.activeSession.name,
  dataDir: null,
  dataDirConfirmed: true,
  sessionDirsDisabled: true,
 })
 assert.equal(ctx.includes('Data Directory'), false)

 // 4. Boot main.fs / lane-control.fs UI against live server and verify dir-modal never opens & UI is hidden
 const tabData = httpKV({
  baseUrl: dataUrl,
  switchable: true,
  proxyCapabilities: true,
  proactiveToken: true,
 })
 const mockWindow = createMockWindow(appOrigin)
 const mockDocument = {
  defaultView: mockWindow,
  documentElement: createMockElement('html'),
  body: createMockElement('body'),
  createElement(tag) {
   return createMockElement(tag, mockDocument)
  },
 }
 mockDocument.documentElement.ownerDocument = mockDocument
 mockDocument.body.ownerDocument = mockDocument

 const origFetch = globalThis.fetch
 globalThis.fetch = async (input, init) => {
  const urlStr = typeof input === 'string' ? input : (input && input.url ? input.url : '')
  if (urlStr.startsWith('/src/')) {
   const filePath = path.join(repoRoot, urlStr.slice(1))
   const text = await fs.promises.readFile(filePath, 'utf8')
   return new Response(text, { status: 200, headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
  }
  if (urlStr.startsWith('/')) {
   return origFetch(`${appOrigin}${urlStr}`, init)
  }
  return origFetch(input, init)
 }
 t.after(() => {
  globalThis.fetch = origFetch
 })

 const mainRuntime = field({
  ...DATA_RUNTIME_ENV,
  LANE_CRON_INTERVAL_MS,
  PRIMITIVE_TYPES,
  clearTargetLaneLineSetBy,
  computeLaneScrollTop,
  console: { log() {}, warn() {}, error() {} },
  createFsDir,
  createIdleTracker,
  createSandboxedOutputHost,
  createSourceWorkerRunner,
  data: tabData,
  defaultValueForType,
  document: mockDocument,
  fetchFsList,
  fetchFsRoots,
  formatAgentContext,
  formatAgentPrompt,
  formatImportLine,
  hasImportCycle,
  inspectSessionForAgent,
  isSessionDirsDisabled,
  minLaneModalHeight: MIN_LANE_MODAL_HEIGHT,
  minLaneModalWidth: MIN_LANE_MODAL_WIDTH,
  normalizeLineSetBy,
  normalizePrimitiveType,
  parseImportLine,
  primitiveTypes: PRIMITIVE_TYPES,
  resolveImportValue,
  resolveScopeColumns,
  runLines: runLinesInWorker,
  simulateLaneRequest: simulateLaneRequestInWorker,
  subscribeAgentEvents: () => () => {},
  window: mockWindow,
 })
 const mainSource = await fs.promises.readFile(path.join(repoRoot, 'src', 'main.fs'), 'utf8')
 await mainRuntime.run(parse(mainSource, '/src/main.fs'))

 const lc = mainRuntime.state['lane-control']
 const dirModal = lc['dir-modal']
 const sessionModal = lc['session-modal']
 const rails = lc.rails
 const summary = lc['workspace-summary']

 assert.equal(dirModal['is-open'], false)
 assert.equal(lc['session-dirs-disabled'], true)
 assert.equal(lc['session-data-dir'], null)
 assert.equal(lc['session-data-dir-confirmed'], true)
 assert.equal(summary['sess-dir-btn'].hidden, true)
 assert.equal(rails['session-dir-el'].hidden, true)

 // Open session switcher modal: active-dir-row and active-dir-btn must stay hidden
 await sessionModal['open-switch-session']()
 assert.equal(sessionModal['active-dir-row'].hidden, true)
 assert.equal(sessionModal['active-dir-btn'].hidden, true)
 await sessionModal.close()

 // Creating a new session bypasses dir-modal completely
 const firstSessionId = lc['session-id']
 await lc['prompt-new-session'](false)
 assert.equal(dirModal['is-open'], false)
 assert.notEqual(lc['session-id'], firstSessionId)
 assert.equal(lc['session-data-dir'], null)
 assert.equal(lc['session-data-dir-confirmed'], true)

 // Every upstream civil-memory request throughout the entire test used ONLY ?key= and zero 400s occurred
 assert.ok(cmRequests.length > 0)
 for (const reqLog of cmRequests) {
  assert.deepEqual(reqLog.paramKeys, ['key'], `Expected only ?key= query param, got ${reqLog.search}`)
  assert.notEqual(reqLog.statusCode, 400, `Unexpected 400 from civil-memory on ${reqLog.method} ${reqLog.search}`)
 }
})
