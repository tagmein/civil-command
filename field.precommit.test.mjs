import test from 'node:test'
import assert from 'node:assert/strict'
import fsSync from 'node:fs'
import fs from 'node:fs/promises'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import {
 createFsDir,
 fetchFsList,
 fetchFsRoots,
} from './data.mjs'
import {
 LANE_CRON_INTERVAL_MS,
 MIN_LANE_MODAL_HEIGHT,
 MIN_LANE_MODAL_WIDTH,
} from './field.mjs'
import {
 DATA_RUNTIME_ENV,
 DEFAULT_LANE_TRIGGER_RULES,
 DEFAULT_PACKAGE_ID,
 PRIMITIVE_TYPES,
 SECRET_MASK,
 SESSION_TOKEN_HEADER,
 TOKEN_BOOTSTRAP_HEADER,
 addLaneTable,
 addTableRow,
 clearTargetLaneLineSetBy,
 collectLaneSyncBundle,
 computeLaneScrollTop,
 createAgentEventHub,
 createDataProxyHandler,
 createIdleTracker,
 createLaneHttpServer,
 createSandboxedOutputHost,
 createServerSecretStore,
 createSourceWorkerRunner,
 createTriggerStamp,
 defaultValueForType,
 disposeIdleSourceWorkers,
 field,
 formatAgentContext,
 formatAgentPrompt,
 formatImportLine,
 handleAgentApiRequest,
 handleDeployApiRequest,
 handleFsApiRequest,
 hasImportCycle,
 httpKV,
 inspectSessionForAgent,
 isAllowedLocalHost,
 loadLaneStoryDetail,
 normalizeDataDir,
 normalizeLineSetBy,
 normalizePrimitiveType,
 normalizeTriggerRules,
 parse,
 parseImportLine,
 queryLaneStories,
 resolveImportValue,
 resolveMatchingTriggerTargets,
 resolveScopeColumns,
 runLinesInWorker,
 saveLaneScript,
 setLaneSecret,
 simulateLaneRequestInWorker,
 withKvTriggers,
} from './field.fixtures.mjs'

const REPO_DIR = process.cwd()
const FORBIDDEN_ABS_PATH_RE = new RegExp(['/ho' + 'me/', 'fi' + 'le:///'].join('|'))

const STATIC_MIME_TYPES = {
 '.html': 'text/html; charset=utf-8',
 '.js': 'text/javascript; charset=utf-8',
 '.mjs': 'text/javascript; charset=utf-8',
 '.css': 'text/css; charset=utf-8',
 '.json': 'application/json; charset=utf-8',
 '.webmanifest': 'application/manifest+json; charset=utf-8',
 '.fs': 'text/plain; charset=utf-8',
 '.svg': 'image/svg+xml',
 '.png': 'image/png',
 '.jpg': 'image/jpeg',
 '.ico': 'image/x-icon',
 '.wasm': 'application/wasm',
}

function createVirtualCivilMemoryReplica({
 enforceTextPlainPost = true,
 triggers = DEFAULT_LANE_TRIGGER_RULES,
} = {}) {
 const buckets = new Map()
 const requests = []
 const compiledTriggers = normalizeTriggerRules(triggers, { defaultEnabled: true, useEnv: false })
 let triggerSeq = 0

 function bucketKey(mode, basePath) {
  if (mode === 'volatile') {
   return '__volatile__'
  }
  const clean = normalizeDataDir(basePath)
  return clean === null ? '__default__' : clean
 }

 function getBucket(mode, basePath) {
  const bk = bucketKey(mode, basePath)
  if (!buckets.has(bk)) {
   buckets.set(bk, new Map())
  }
  return buckets.get(bk)
 }

 function fireReplicaTriggers(bucket, key, op) {
  if (compiledTriggers.length === 0) {
   return
  }
  const targets = resolveMatchingTriggerTargets(key, compiledTriggers)
  for (const targetKey of targets) {
   triggerSeq += 1
   bucket.set(targetKey, createTriggerStamp({
    key,
    op,
    nowMs: Date.now() + triggerSeq,
   }))
  }
 }

 function createKvClient(initialBasePath = null, namespace = '', rootRef = null, defaultRootRef = null) {
  const cleanDir = normalizeDataDir(initialBasePath)
  const isHash = namespace.includes('#')
  const qualify = key => {
   if (isHash) {
    return namespace.endsWith('#') ? `${namespace}${key}` : `${namespace}/${key}`
   }
   return namespace ? `${namespace}.${key}` : String(key)
  }
  const encodeSeg = seg => encodeURIComponent(String(seg)).replace(/\./g, '%2E')
  const baseKv = {
   prefix: namespace,
   basePath: cleanDir,
   root: rootRef || null,
   defaultRoot: defaultRootRef || null,
   withBasePath(nextPath) {
    return createKvClient(nextPath, '', null, baseKv.defaultRoot || baseKv)
   },
   setBasePath(nextPath) {
    return createKvClient(nextPath, '', null, baseKv.defaultRoot || baseKv)
   },
   namespace(name) {
    const nextNs = isHash ? qualify(encodeSeg(name)) : qualify(name)
    return createKvClient(cleanDir, nextNs, baseKv.root || baseKv, baseKv.defaultRoot || baseKv)
   },
   hashNamespace(name) {
    return createKvClient(cleanDir, `${encodeSeg(name)}#`, baseKv.root || baseKv, baseKv.defaultRoot || baseKv)
   },
   async get(key) {
    const bucket = getBucket('disk', cleanDir)
    const fullKey = qualify(key)
    return bucket.has(fullKey) ? bucket.get(fullKey) : null
   },
   async set(key, value) {
    const bucket = getBucket('disk', cleanDir)
    bucket.set(qualify(key), value === null || value === undefined ? '' : String(value))
   },
   async delete(key) {
    const bucket = getBucket('disk', cleanDir)
    bucket.delete(qualify(key))
   },
  }
  if (!baseKv.root) {
   baseKv.root = baseKv
  }
  if (!baseKv.defaultRoot) {
   baseKv.defaultRoot = cleanDir === null ? baseKv : createKvClient(null)
  }
  return withKvTriggers(baseKv, { triggers: compiledTriggers })
 }

 const server = http.createServer((req, res) => {
  const reqUrl = new URL(req.url || '/', 'http://127.0.0.1')
  const method = String(req.method || 'GET').toUpperCase()
  const chunks = []
  req.on('data', chunk => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)))
  req.on('end', () => {
   const rawBody = Buffer.concat(chunks).toString('utf8')
   if (reqUrl.pathname === '/health' && method === 'GET') {
    requests.push({ method, pathname: '/health', statusCode: 200 })
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' })
    res.end(JSON.stringify({
     ok: true,
     service: 'civil-memory',
     mode: 'virtual-replica',
     triggersEnabled: compiledTriggers.length > 0,
     triggerRuleCount: compiledTriggers.length,
    }))
    return
   }

   const key = reqUrl.searchParams.get('key')
   const mode = (reqUrl.searchParams.get('mode') || 'disk').toLowerCase()
   const basePath = reqUrl.searchParams.get('modeOptions.disk.basePath') || ''
   if (!key) {
    requests.push({ method, pathname: reqUrl.pathname, key: '', mode, basePath, statusCode: 400 })
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' })
    res.end('Missing key query parameter')
    return
   }
   if (mode !== 'disk' && mode !== 'volatile') {
    requests.push({ method, pathname: reqUrl.pathname, key, mode, basePath, statusCode: 400 })
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' })
    res.end(`Unsupported mode: ${mode}`)
    return
   }

   const bucket = getBucket(mode, basePath)
   if (method === 'GET' || method === 'HEAD') {
    if (!bucket.has(key)) {
     requests.push({ method, key, mode, basePath, statusCode: 404 })
     res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
     res.end(method === 'HEAD' ? '' : 'Not found')
     return
    }
    requests.push({ method, key, mode, basePath, statusCode: 200 })
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' })
    res.end(method === 'HEAD' ? '' : bucket.get(key))
    return
   }

   if (method === 'POST' || method === 'PUT') {
    const ct = String(req.headers['content-type'] || '').toLowerCase()
    if (enforceTextPlainPost && !ct.startsWith('text/plain')) {
     requests.push({ method, key, mode, basePath, statusCode: 500, contentType: ct })
     res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' })
     res.end('Expected text/plain Content-Type for virtual civil-memory write')
     return
    }
    bucket.set(key, rawBody)
    fireReplicaTriggers(bucket, key, 'set')
    requests.push({ method, key, mode, basePath, statusCode: 200, bytes: Buffer.byteLength(rawBody, 'utf8') })
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' })
    res.end('ok')
    return
   }

   if (method === 'DELETE') {
    bucket.delete(key)
    fireReplicaTriggers(bucket, key, 'delete')
    requests.push({ method, key, mode, basePath, statusCode: 200 })
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' })
    res.end('ok')
    return
   }

   requests.push({ method, key, mode, basePath, statusCode: 405 })
   res.writeHead(405, { 'Content-Type': 'text/plain; charset=utf-8' })
   res.end('Method not allowed')
  })
 })

 let origin = ''
 return {
  buckets,
  requests,
  get origin() {
   return origin
  },
  createKvClient,
  hasRawValueSubstring(needle) {
   const target = String(needle || '')
   if (!target) {
    return false
   }
   for (const bucket of buckets.values()) {
    for (const val of bucket.values()) {
     if (typeof val === 'string' && val.includes(target)) {
      return true
     }
    }
   }
   return false
  },
  async listen() {
   await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
   const addr = server.address()
   origin = `http://127.0.0.1:${addr.port}`
   return origin
  },
  async close() {
   if (typeof server.closeAllConnections === 'function') {
    server.closeAllConnections()
   }
   await new Promise(resolve => server.close(resolve))
  },
 }
}

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
  scrollHeight: 40,
  offsetHeight: 40,
  clientHeight: 40,
  scrollLeft: 0,
  scrollTop: 0,
  parentNode: null,
  ownerDocument: ownerDoc,
  setAttribute(name, value) {
   const k = String(name)
   const v = String(value)
   this.attributes[k] = v
   if (k === 'id') {
    this.id = v
   }
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
   if (!child || typeof child !== 'object') {
    return child
   }
   child.parentNode = this
   const idx = this.children.indexOf(ref)
   if (idx === -1) {
    this.children.push(child)
   }
   else {
    this.children.splice(idx, 0, child)
   }
   return child
  },
  replaceChildren(...nodes) {
   this.children = []
   for (const node of nodes) {
    this.appendChild(node)
   }
  },
  remove() {
   if (this.parentNode && Array.isArray(this.parentNode.children)) {
    const idx = this.parentNode.children.indexOf(this)
    if (idx !== -1) {
     this.parentNode.children.splice(idx, 1)
    }
   }
   this.parentNode = null
  },
  contains(target) {
   let cur = target
   while (cur) {
    if (cur === this) {
     return true
    }
    cur = cur.parentNode
   }
   return false
  },
  addEventListener(type, fn) {
   this.listeners[String(type)] = fn
  },
  removeEventListener(type, fn) {
   const k = String(type)
   if (this.listeners[k] === fn) {
    delete this.listeners[k]
   }
  },
  getBoundingClientRect() {
   return { left: 0, top: 0, right: 320, bottom: 240, width: 320, height: 240 }
  },
  scrollIntoView() {},
  focus() {},
  select() {},
  click() {
   if (typeof this.listeners.click === 'function') {
    return this.listeners.click({ target: this, currentTarget: this, preventDefault() {}, stopPropagation() {} })
   }
   return undefined
  },
 }
 return el
}

async function createAppIntegrationHarness() {
 const virtualCm = createVirtualCivilMemoryReplica()
 const cmOrigin = await virtualCm.listen()
 const secretStore = createServerSecretStore({ useEnv: false })
 const eventHub = createAgentEventHub()
 const proxy = createDataProxyHandler({
  backendBaseUrl: `${cmOrigin}/?mode=disk`,
  secretStore,
  setAsDefaultStore: false,
 })
 const httpLog = []
 const indexHtmlPath = path.join(REPO_DIR, 'index.html')

 const appServer = http.createServer((req, res) => {
  const reqPathname = (req.url || '/').split('?')[0]
  const origWriteHead = res.writeHead.bind(res)
  res.writeHead = (statusCode, ...rest) => {
   httpLog.push({
    method: String(req.method || 'GET').toUpperCase(),
    url: req.url || '/',
    pathname: reqPathname,
    statusCode,
   })
   return origWriteHead(statusCode, ...rest)
  }

  if (!isAllowedLocalHost(req, { requireHost: true })) {
   if (reqPathname === '/api' || reqPathname.startsWith('/api/')) {
    res.writeHead(403, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' })
    res.end(JSON.stringify({ ok: false, error: 'Forbidden Host header' }))
   }
   else {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' })
    res.end('Forbidden')
   }
   return
  }

  if (reqPathname === '/api/fs' || reqPathname.startsWith('/api/fs/')) {
   return handleFsApiRequest(req, res, {
    secretStore,
    homeDir: os.tmpdir(),
    mountPoints: [],
   })
  }
  if (reqPathname === '/api/deploy' || reqPathname.startsWith('/api/deploy/')) {
   return handleDeployApiRequest(req, res, { secretStore })
  }
  if (reqPathname === '/api/mcp' || reqPathname === '/api/agent' || reqPathname.startsWith('/api/agent/')) {
   return handleAgentApiRequest(req, res, {
    secretStore,
    createAuthorizedRootKv: proxy.createAuthorizedRootKv,
    eventHub,
   })
  }
  if (reqPathname === '/api/vault' || reqPathname.startsWith('/api/vault/')) {
   return proxy.handleVaultApiRequest(req, res)
  }
  if (reqPathname === '/api/data' || reqPathname.startsWith('/api/data/')) {
   return proxy.handleDataProxyRequest(req, res)
  }

  const cleanRel = reqPathname === '/' ? '/index.html' : reqPathname
  const filePath = path.resolve(REPO_DIR, '.' + cleanRel)
  if (
   (!filePath.startsWith(REPO_DIR + path.sep) && filePath !== REPO_DIR) ||
   cleanRel.split('/').some(seg => seg.startsWith('.') && seg !== '.')
  ) {
   res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' })
   res.end('Forbidden')
   return
  }

  const serveTarget = fsSync.existsSync(filePath) && fsSync.statSync(filePath).isFile()
   ? filePath
   : indexHtmlPath
  const ext = path.extname(serveTarget).toLowerCase()
  const headers = { 'Content-Type': STATIC_MIME_TYPES[ext] || 'application/octet-stream' }
  if (path.basename(serveTarget) === 'sw.js') {
   headers['Cache-Control'] = 'no-cache'
  }
  fsSync.readFile(serveTarget, (err, buf) => {
   if (err) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
    res.end('Not found')
    return
   }
   res.writeHead(200, headers)
   res.end(buf)
  })
 })

 await new Promise(resolve => appServer.listen(0, '127.0.0.1', resolve))
 const appPort = appServer.address().port
 const appOrigin = `http://127.0.0.1:${appPort}`
 const dataUrl = `${appOrigin}/api/data?mode=disk`

 const openTabs = []

 function unexpectedHttpErrors() {
  return httpLog.filter(entry =>
   entry.statusCode === 400 ||
   entry.statusCode === 401 ||
   entry.statusCode === 403 ||
   entry.statusCode === 405 ||
   entry.statusCode === 415 ||
   entry.statusCode >= 500
  )
 }

 async function bootBrowserTab({
  pathname = '/',
  localStorage = createMemoryStorage(),
  sessionStorage = createMemoryStorage(),
 } = {}) {
  const tabData = httpKV({
   baseUrl: dataUrl,
   switchable: true,
   proxyCapabilities: true,
   proactiveToken: true,
  })
  const origFetch = globalThis.fetch
  const windowListeners = new Map()
  const consoleErrors = []
  const consoleWarnings = []
  const consoleLogs = []
  let uuidSeq = 0

  const mockLocation = {
   origin: appOrigin,
   href: `${appOrigin}${pathname}`,
   pathname,
   search: '',
   hash: '',
  }

  const mockWindow = {
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
    randomUUID: () => `precommit-${++uuidSeq}-${Math.random().toString(16).slice(2, 8)}`,
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
    if (!windowListeners.has(type)) {
     windowListeners.set(type, new Set())
    }
    windowListeners.get(type).add(fn)
   },
   removeEventListener(type, fn) {
    const set = windowListeners.get(type)
    if (set) {
     set.delete(fn)
    }
   },
  }

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

  const mockConsole = {
   log: (...args) => consoleLogs.push(args),
   warn: (...args) => consoleWarnings.push(args),
   error: (...args) => consoleErrors.push(args),
  }

  globalThis.fetch = (input, init) => {
   if (typeof input === 'string' && input.startsWith('/')) {
    return origFetch(`${appOrigin}${input}`, init)
   }
   return origFetch(input, init)
  }

  let closed = false
  let main = null
  const closeTab = async () => {
   if (closed) {
    return
   }
   closed = true
   try {
    const lanesList = main && main.state && Array.isArray(main.state.lanes) ? main.state.lanes : []
    for (const lane of lanesList) {
     if (lane && lane.notebook && typeof lane.notebook.dispose === 'function') {
      lane.notebook.dispose()
     }
    }
   }
   catch {}
   globalThis.fetch = origFetch
  }
  openTabs.push(closeTab)

  main = field({
   ...DATA_RUNTIME_ENV,
   LANE_CRON_INTERVAL_MS,
   PRIMITIVE_TYPES,
   clearTargetLaneLineSetBy,
   computeLaneScrollTop,
   console: mockConsole,
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

  const mainResp = await origFetch(`${appOrigin}/src/main.fs`)
  assert.equal(mainResp.status, 200)
  const mainSource = await mainResp.text()
  await main.run(parse(mainSource, '/src/main.fs'))
  const lc = main.state['lane-control']
  return {
   main,
   lc,
   lanes: main.state.lanes,
   tabData,
   mockWindow,
   mockDocument,
   mockLocation,
   localStorage,
   sessionStorage,
   consoleErrors,
   consoleWarnings,
   consoleLogs,
   closeTab,
  }
 }

 return {
  virtualCm,
  cmOrigin,
  secretStore,
  eventHub,
  proxy,
  appServer,
  appOrigin,
  dataUrl,
  httpLog,
  unexpectedHttpErrors,
  bootBrowserTab,
  async close() {
   for (const fn of openTabs) {
    await fn()
   }
   await disposeIdleSourceWorkers()
   if (typeof appServer.closeAllConnections === 'function') {
    appServer.closeAllConnections()
   }
   await new Promise(resolve => appServer.close(resolve))
   await virtualCm.close()
  },
 }
}

test('Pre-commit 1/6: App shell, sw.js precache manifest, index.html module bindings, FieldScript syntax, and path hygiene', async () => {
 const harness = await createAppIntegrationHarness()
 try {
  const [indexHtml, swSource, startSource, ccSource] = await Promise.all([
   fs.readFile(path.join(REPO_DIR, 'index.html'), 'utf8'),
   fs.readFile(path.join(REPO_DIR, 'sw.js'), 'utf8'),
   fs.readFile(path.join(REPO_DIR, 'start'), 'utf8'),
   fs.readFile(path.join(REPO_DIR, 'cc'), 'utf8'),
  ])

  // Every sw.js APP_SHELL asset serves 200 (and sw.js sends Cache-Control: no-cache)
  const shellMatch = /const APP_SHELL = \[([\s\S]*?)\]/.exec(swSource)
  assert.ok(shellMatch, 'sw.js should declare APP_SHELL')
  const shellAssets = Array.from(shellMatch[1].matchAll(/'([^']+)'/g), m => m[1])
  assert.ok(shellAssets.includes('/index.html'))
  assert.ok(shellAssets.includes('/src/main.fs'))
  for (const asset of shellAssets) {
   const res = await fetch(`${harness.appOrigin}${asset}`)
   assert.equal(res.status, 200, `Expected 200 for precache asset ${asset}`)
  }
  const swResp = await fetch(`${harness.appOrigin}/sw.js`)
  assert.equal(swResp.status, 200)
  assert.equal(swResp.headers.get('cache-control'), 'no-cache')

  // Every ESM import inside index.html resolves cleanly on its target module
  const scriptMatch = /<script type="module">([\s\S]*?)<\/script>/.exec(indexHtml)
  assert.ok(scriptMatch, 'index.html should include module bootstrap script')
  const importRegex = /import\s*\{([^}]+)\}\s*from\s*'(\/[^']+\.mjs)'/g
  const importedLocals = new Set(['console', 'document', 'window'])
  let impMatch
  let importBindingsChecked = 0
  while ((impMatch = importRegex.exec(scriptMatch[1])) !== null) {
   const specifiers = impMatch[1]
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
   const modNs = await import(new URL(`.${impMatch[2]}`, import.meta.url))
   for (const spec of specifiers) {
    const parts = spec.split(/\s+as\s+/)
    const exportName = parts[0].trim()
    const localName = (parts[1] || parts[0]).trim()
    assert.ok(Object.hasOwn(modNs, exportName), `Missing export ${exportName} on ${impMatch[2]}`)
    importedLocals.add(localName)
    importBindingsChecked += 1
   }
  }
  assert.ok(importBindingsChecked >= 150)

  // Every property in index.html's field({ ... }) initializer must be imported/declared and present in bootBrowserTab
  const fieldInitMatch = /const main = field\(\{([\s\S]*?)\}\)/.exec(scriptMatch[1])
  assert.ok(fieldInitMatch, 'index.html should initialize const main = field({ ... })')
  const fieldProps = fieldInitMatch[1]
   .split('\n')
   .map(line => line.trim().replace(/,$/, ''))
   .filter(Boolean)
  assert.ok(fieldProps.length >= 150)
  const bootTab = await harness.bootBrowserTab({ pathname: '/' })
  for (const entry of fieldProps) {
   const colonIdx = entry.indexOf(':')
   const propName = (colonIdx === -1 ? entry : entry.slice(0, colonIdx)).trim()
   const valueIdent = (colonIdx === -1 ? entry : entry.slice(colonIdx + 1)).trim()
   assert.ok(importedLocals.has(valueIdent), `Undeclared binding ${valueIdent} in index.html field({ ${entry} })`)
   assert.notEqual(
    bootTab.main.state[propName],
    undefined,
    `Missing field({ ${propName} }) in pre-commit bootBrowserTab harness`
   )
  }

  // Every src/*.fs module parses cleanly and contains zero machine-specific absolute paths
  const srcFiles = (await fs.readdir(path.join(REPO_DIR, 'src')))
   .filter(name => name.endsWith('.fs'))
   .sort()
  assert.ok(srcFiles.includes('main.fs'))
  for (const fname of srcFiles) {
   const text = await fs.readFile(path.join(REPO_DIR, 'src', fname), 'utf8')
   parse(text, `src/${fname}`)
   assert.equal(FORBIDDEN_ABS_PATH_RE.test(text), false, `Absolute path found in src/${fname}`)
  }

  // Every top-level *.mjs file and key app entrypoints contain zero machine-specific absolute paths
  const rootMjsFiles = (await fs.readdir(REPO_DIR))
   .filter(name => name.endsWith('.mjs'))
   .sort()
  for (const fname of rootMjsFiles) {
   const mjsText = await fs.readFile(path.join(REPO_DIR, fname), 'utf8')
   assert.equal(FORBIDDEN_ABS_PATH_RE.test(mjsText), false, `Absolute path found in ${fname}`)
  }

  for (const [label, content] of [
   ['index.html', indexHtml],
   ['sw.js', swSource],
   ['start', startSource],
   ['cc', ccSource],
  ]) {
   assert.equal(FORBIDDEN_ABS_PATH_RE.test(content), false, `Absolute path found in ${label}`)
  }
 }
 finally {
  await harness.close()
 }
})

test('Pre-commit 2/6: Fresh main page boot, default session creation, + Lane, Source Worker evaluation, and sandboxed View output', async () => {
 const harness = await createAppIntegrationHarness()
 try {
  const tab = await harness.bootBrowserTab({ pathname: '/' })
  assert.ok(tab.lc['session-id'], 'Fresh boot must initialize a session ID')
  assert.equal(tab.lc['session-status-pending'], false)
  assert.deepEqual(tab.consoleErrors, [])
  assert.deepEqual(tab.consoleWarnings, [])
  assert.deepEqual(harness.unexpectedHttpErrors(), [])

  await tab.main.state.tableHeadRowAddButton.listeners.click()
  assert.equal(tab.lanes.length, 1)
  const lane = tab.lanes[0]
  const nb = lane.notebook

  nb.rows[0]['input-el'].value = "; to summary 'ACCOUNTS 20 | PREPAID $847.15 | BALANCE $1576.87'"
  await nb.rows[0]['input-el'].listeners.input()
  await nb['insert-line'](1, "; send ( ; to el !document.createElement div , ; set $summary el.textContent , $el )")
  await nb['when-idle']()

  await nb.tabs.view.listeners.click()
  await nb['when-idle']()

  assert.equal(nb['active-tab'], 'view')
  assert.equal(nb['source-panel'].hidden, true)
  assert.equal(nb['output-view'].element.hidden, false)
  const iframe = nb['output-view']['iframe-el']
  assert.equal(iframe.attributes.sandbox, 'allow-scripts')
  assert.ok(!iframe.attributes.sandbox.includes('allow-same-origin'))
  assert.ok(iframe.srcdoc.includes('<meta http-equiv="Content-Security-Policy"'))
  assert.ok(iframe.srcdoc.includes("connect-src 'none'"))
  assert.equal(
   nb['output-view']['inline-host'].debugOutputEl.children[0].textContent,
   'ACCOUNTS 20 | PREPAID $847.15 | BALANCE $1576.87'
  )
  assert.deepEqual(tab.consoleErrors, [])
  assert.deepEqual(tab.consoleWarnings, [])
  assert.deepEqual(harness.unexpectedHttpErrors(), [])
 }
 finally {
  await harness.close()
 }
})

test('Pre-commit 3/6: Custom dataDir session persistence, cold reload on /<lane>;view, deploy#* registry access, and multi-session switching', async () => {
 const harness = await createAppIntegrationHarness()
 const sharedLocalStorage = createMemoryStorage()
 try {
  const tab1 = await harness.bootBrowserTab({ pathname: '/', localStorage: sharedLocalStorage })
  const westId = tab1.lc['session-id']
  await tab1.lc['confirm-session-data-dir']('/virtual/west')
  await tab1.lc['rename-session'](westId, 'West')

  await tab1.main.state.tableHeadRowAddButton.listeners.click()
  const ledger = tab1.lanes[0]
  await tab1.lc.rename(ledger.id, 'Ledger')

  const accountsTable = {
   id: 'tbl-accounts',
   name: 'accounts',
   columns: [{ id: 'col-bal', name: 'balance', type: 'fixed', decimals: 2, multiple: false, width: null }],
   rows: [],
  }
  await addLaneTable(tab1.tabData, ledger.data, ledger.id, accountsTable, [accountsTable.id])
  await addTableRow(tab1.tabData, ledger.data, ledger.id, accountsTable.id, { id: 'r1', values: { 'col-bal': 100000 } }, ['r1'])
  await addTableRow(tab1.tabData, ledger.data, ledger.id, accountsTable.id, { id: 'r2', values: { 'col-bal': 57687 } }, ['r1', 'r2'])

  await saveLaneScript(tab1.tabData, ledger.data, ledger.id, [
   { id: 'ln-1', text: '; to acc ; object { total 0 }' },
   { id: 'ln-2', text: '; each $accounts ( ; to { r } $argv , ; set [ ; add $acc.total $r.balance ] acc.total )' },
   { id: 'ln-3', text: '; to formatted ; divide $acc.total 100' },
   { id: 'ln-4', text: "; send ( ; to d !document.createElement div , ; set [ ; add 'BALANCE $' $formatted ] d.textContent , $d )" },
  ])
  await ledger.notebook.tabs.view.listeners.click()
  await ledger.notebook['when-idle']()
  await tab1.lc['save-session-draft']()
  const savedUrl = `/${ledger.id};view`
  await tab1.closeTab()

  // Cold reload on /<ledgerId>;view with a fresh token store (mints claims.dir = '/virtual/west')
  harness.httpLog.length = 0
  const tab2 = await harness.bootBrowserTab({ pathname: savedUrl, localStorage: sharedLocalStorage })
  assert.deepEqual(harness.unexpectedHttpErrors(), [])
  assert.deepEqual(tab2.consoleErrors, [])
  assert.deepEqual(tab2.consoleWarnings, [])

  assert.equal(tab2.lanes.length, 1)
  const coldLedger = tab2.lanes[0]
  await coldLedger.notebook['when-idle']()
  assert.equal(coldLedger.id, ledger.id)
  assert.equal(coldLedger.notebook['active-tab'], 'view')
  assert.equal(coldLedger.notebook['output-view'].element.hidden, false)
  assert.match(coldLedger.notebook['output-view']['inline-host'].debugOutputEl.children[0].textContent, /1576\.87/)

  // Verify global deploy#* registry reads occurred and all succeeded (zero 403s)
  const deployReads = harness.httpLog.filter(e => e.url.includes('deploy%23'))
  assert.ok(deployReads.length > 0, 'Expected deploy#* registry requests during mount')
  assert.ok(deployReads.every(e => e.statusCode === 200 || e.statusCode === 404))

  // Create second session East and switch back to West
  const eastRes = await tab2.lc['new-session']('East', '/virtual/east', true)
  assert.ok(eastRes && eastRes.sessionId)
  assert.notEqual(eastRes.sessionId, westId)
  await tab2.main.state.tableHeadRowAddButton.listeners.click()
  await tab2.lc['save-session-draft']()

  await tab2.lc['switch-session'](westId)
  assert.equal(tab2.lc['session-id'], westId)
  assert.equal(tab2.lanes.length, 1)
  assert.equal(tab2.lanes[0].id, ledger.id)
  assert.deepEqual(harness.unexpectedHttpErrors(), [])
  assert.deepEqual(tab2.consoleErrors, [])
 }
 finally {
  await harness.close()
 }
})

test('Pre-commit 4/6: Cross-lane import, vault secret encryption/resolution, and redacted Story history', async () => {
 const harness = await createAppIntegrationHarness()
 try {
  const tab = await harness.bootBrowserTab({ pathname: '/' })
  await tab.main.state.tableHeadRowAddButton.listeners.click()
  const rates = tab.lanes[0]
  await tab.lc.rename(rates.id, 'Rates')
  rates.notebook.rows[0]['input-el'].value = '; to rate 3'
  await rates.notebook.rows[0]['input-el'].listeners.input()
  await rates.notebook['when-idle']()

  await tab.main.state.tableHeadRowAddButton.listeners.click()
  const summary = tab.lanes[1]
  await tab.lc.rename(summary.id, 'Summary')

  const secRes = await setLaneSecret(tab.tabData, summary.data, summary.id, 'token', 'sk-precommit-secret-val')
  assert.equal(secRes.ok, true)
  const inputRecs = [{ name: 'token', type: 'secret', secretId: secRes.secretId, secretSet: true }]
  await summary.data.set('inputs', JSON.stringify(inputRecs))

  const impLine = formatImportLine({ alias: 'r', laneId: rates.id, path: ['rate'] })
  await saveLaneScript(tab.tabData, summary.data, summary.id, [
   { id: 's-1', text: impLine },
   { id: 's-2', text: '; to out ; multiply $r 14' },
   { id: 's-3', text: "; send ( ; to el !document.createElement div , ; set [ ; add 'Computed ' $out ] el.textContent , $el )" },
  ])
  await tab.lc.reload(summary.id)
  const reloadedSummary = tab.lc['by-id'][summary.id]
  await reloadedSummary.notebook['when-idle']()

  assert.equal(reloadedSummary.notebook.state.out, 42)
  assert.equal(
   reloadedSummary.notebook['output-view']['inline-host'].debugOutputEl.children[0].textContent,
   'Computed 42'
  )

  // Raw secret and master key must never appear anywhere in virtual civil-memory buckets
  assert.equal(harness.virtualCm.hasRawValueSubstring('sk-precommit-secret-val'), false)
  assert.equal(harness.virtualCm.hasRawValueSubstring('masterKey'), false)

  // Story snapshot recorded cleanly with secret redacted (recordLaneStoryFromRun completes right after idle settle)
  let stories = { entries: [] }
  for (let i = 0; i < 40; i++) {
   stories = await queryLaneStories(reloadedSummary.data, reloadedSummary.data, summary.id, { limit: 5 })
   if (stories.entries.length > 0) {
    break
   }
   await new Promise(resolve => setTimeout(resolve, 10))
  }
  assert.ok(stories.entries.length >= 1)
  const latestCard = stories.entries[0]
  const detail = await loadLaneStoryDetail(reloadedSummary.data, reloadedSummary.data, summary.id, latestCard)
  assert.equal(detail.inputs[0].name, 'token')
  assert.equal(detail.inputs[0].preview, SECRET_MASK)
  assert.equal(detail.imports[0].preview, '3')
  assert.equal(detail.lines[1].preview, '42')
  assert.deepEqual(harness.unexpectedHttpErrors(), [])
 }
 finally {
  await harness.close()
 }
})

test('Pre-commit 5/6: Agent REST & MCP API round-trip, live SSE event emission, and CSRF/auth rejection', async () => {
 const harness = await createAppIntegrationHarness()
 try {
  const tab = await harness.bootBrowserTab({ pathname: '/' })
  await tab.main.state.tableHeadRowAddButton.listeners.click()
  const targetLane = tab.lanes[0]
  await tab.lc.rename(targetLane.id, 'WorkerLane')
  targetLane.notebook.rows[0]['input-el'].value = '; to init 1'
  await targetLane.notebook.rows[0]['input-el'].listeners.input()
  await targetLane.notebook['when-idle']()
  await tab.lc['confirm-session-data-dir'](null)
  await tab.lc['save-session-draft']()

  const bootRes = await fetch(`${harness.appOrigin}/api/vault/session`, {
   method: 'POST',
   headers: { 'Content-Type': 'application/json' },
   body: JSON.stringify({ sessionId: tab.lc['session-id'] }),
  }).then(r => r.json())
  assert.equal(bootRes.ok, true)
  const tok = bootRes.token

  const emitted = []
  const unsub = harness.eventHub.subscribe(ev => emitted.push(ev))
  try {
   const sessionsRpc = await fetch(`${harness.appOrigin}/api/mcp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', [SESSION_TOKEN_HEADER]: tok },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'cc_list_sessions', arguments: {} } }),
   }).then(r => r.json())
   assert.equal(sessionsRpc.result.isError, false)

   const getLaneRpc = await fetch(`${harness.appOrigin}/api/mcp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', [SESSION_TOKEN_HEADER]: tok },
    body: JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'cc_get_lane', arguments: { laneId: targetLane.id } } }),
   }).then(r => r.json())
   assert.equal(getLaneRpc.result.isError, false, JSON.stringify(getLaneRpc.result))

   const updateRpc = await fetch(`${harness.appOrigin}/api/mcp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', [SESSION_TOKEN_HEADER]: tok },
    body: JSON.stringify({
     jsonrpc: '2.0',
     id: 3,
     method: 'tools/call',
     params: { name: 'cc_update_script', arguments: { laneId: targetLane.id, action: 'set-line', lineNumber: 1, text: '; multiply 6 7' } },
    }),
   }).then(r => r.json())
   assert.equal(updateRpc.result.isError, false)
   assert.ok(emitted.some(ev => ev.type === 'lane-updated' && ev.laneId === targetLane.id))

   const evalRpc = await fetch(`${harness.appOrigin}/api/mcp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', [SESSION_TOKEN_HEADER]: tok },
    body: JSON.stringify({ jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'cc_eval_lane', arguments: { laneId: targetLane.id } } }),
   }).then(r => r.json())
   assert.equal(evalRpc.result.isError, false, JSON.stringify(evalRpc.result))
   assert.equal(evalRpc.result.structuredContent.lines[0].preview, '42')
  }
  finally {
   unsub()
  }

  // CSRF / auth hardening checks
  const unauthRes = await fetch(`${harness.appOrigin}/api/agent/sessions`)
  assert.equal(unauthRes.status, 401)
  assert.equal(unauthRes.headers.get(TOKEN_BOOTSTRAP_HEADER), '/api/vault/session')

  const nullOriginRes = await fetch(`${harness.appOrigin}/api/agent/lane/script`, {
   method: 'POST',
   headers: { Origin: 'null', 'Content-Type': 'application/json', [SESSION_TOKEN_HEADER]: tok },
   body: JSON.stringify({ laneId: targetLane.id, action: 'set-line', lineNumber: 1, text: '; add 1 1' }),
  })
  assert.equal(nullOriginRes.status, 403)

  const textPlainRes = await fetch(`${harness.appOrigin}/api/agent/lane/script`, {
   method: 'POST',
   headers: { 'Content-Type': 'text/plain', [SESSION_TOKEN_HEADER]: tok },
   body: '{}',
  })
  assert.equal(textPlainRes.status, 415)

  const getEvalRes = await fetch(`${harness.appOrigin}/api/agent/lane/eval?lane=${encodeURIComponent(targetLane.id)}`, {
   headers: { [SESSION_TOKEN_HEADER]: tok },
  })
  assert.equal(getEvalRes.status, 405)
 }
 finally {
  await harness.close()
 }
})

test('Pre-commit 6/6: Deployed lane bundle sync to virtual civil-memory replica and live lane-server.mjs HTTP execution + reload', async () => {
 const harness = await createAppIntegrationHarness()
 const remoteVirtualCm = createVirtualCivilMemoryReplica()
 const remoteOrigin = await remoteVirtualCm.listen()
 let deployedServer = null
 try {
  const tab = await harness.bootBrowserTab({ pathname: '/' })
  await tab.main.state.tableHeadRowAddButton.listeners.click()
  const ratesLane = tab.lanes[0]
  await tab.lc.rename(ratesLane.id, 'Rates')
  await saveLaneScript(tab.tabData, ratesLane.data, ratesLane.id, [
   { id: 'r-1', text: '; to rate 3' },
  ])

  await tab.main.state.tableHeadRowAddButton.listeners.click()
  const apiLane = tab.lanes[1]
  await tab.lc.rename(apiLane.id, 'QuoteApi')
  await apiLane.data.set('features', JSON.stringify({ httpServer: true }))
  await saveLaneScript(tab.tabData, apiLane.data, apiLane.id, [
   { id: 'a-1', text: formatImportLine({ alias: 'r', laneId: ratesLane.id, path: ['rate'] }) },
   { id: 'a-2', text: '; to get ( ; to { req } $argv , !respond 200 [ object { ok true } { route $req.pathname } { computed [ ; multiply $r 10 ] } ] )' },
  ])

  const bundle1 = await collectLaneSyncBundle(tab.tabData, apiLane.id, { includeImports: true })
  const sessTok = tab.tabData.getSessionToken()
  const syncRes1 = await fetch(`${harness.appOrigin}/api/deploy/kv/sync`, {
   method: 'POST',
   headers: { 'Content-Type': 'application/json', [SESSION_TOKEN_HEADER]: sessTok },
   body: JSON.stringify({
    url: remoteOrigin,
    basePath: '/virtual/prod',
    bundle: bundle1,
   }),
  }).then(r => r.json())
  assert.equal(syncRes1.ok, true)

  deployedServer = createLaneHttpServer({
   laneId: apiLane.id,
   civilMemoryUrl: remoteOrigin,
   dataBasePath: '/virtual/prod',
   includeImports: true,
   port: 0,
   logger: () => {},
  })
  const depAddr = await deployedServer.listen()
  await deployedServer.reload()
  const deployedOrigin = `http://127.0.0.1:${depAddr.port}`

  const health = await fetch(`${deployedOrigin}/_cc/health`).then(r => r.json())
  assert.equal(health.ok, true)
  assert.ok(health.loadedLaneIds.includes(apiLane.id))
  assert.ok(health.loadedLaneIds.includes(ratesLane.id))

  const quote1 = await fetch(`${deployedOrigin}/quote`).then(r => r.json())
  assert.deepEqual(quote1, { ok: true, route: '/quote', computed: 30 })

  // Mutate imported Rates lane, re-sync with reloadUrl, and verify live HTTP output updates immediately
  await saveLaneScript(tab.tabData, ratesLane.data, ratesLane.id, [
   { id: 'r-1', text: '; to rate 7' },
  ])
  const bundle2 = await collectLaneSyncBundle(tab.tabData, apiLane.id, { includeImports: true })
  const syncRes2 = await fetch(`${harness.appOrigin}/api/deploy/kv/sync`, {
   method: 'POST',
   headers: { 'Content-Type': 'application/json', [SESSION_TOKEN_HEADER]: sessTok },
   body: JSON.stringify({
    url: remoteOrigin,
    basePath: '/virtual/prod',
    bundle: bundle2,
    reloadUrl: `${deployedOrigin}/_cc/reload`,
   }),
  }).then(r => r.json())
  assert.equal(syncRes2.ok, true)

  const quote2 = await fetch(`${deployedOrigin}/quote`).then(r => r.json())
  assert.deepEqual(quote2, { ok: true, route: '/quote', computed: 70 })
 }
 finally {
  if (deployedServer) {
   await deployedServer.close()
  }
  await remoteVirtualCm.close()
  await harness.close()
 }
})
