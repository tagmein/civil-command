import test from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import fsSync from 'node:fs'
import fs from 'node:fs/promises'
import path from 'node:path'
import vm from 'node:vm'
import {
 DATA_RUNTIME_ENV,
 OUTPUT_PROTOCOL,
 OUTPUT_RPC_METHODS,
 PRIMITIVE_TYPES,
 SECRET_MASK,
 SOURCE_WORKER_PROTOCOL,
 agentCreateLane,
 agentEvalLane,
 agentMutateLaneInput,
 buildNodePermissionExecArgs,
 buildSandboxedOutputSrcdoc,
 createIdleTracker,
 createLaneHttpServer,
 createMaskedSecretValue,
 createNewSession,
 createSafeExternalFetch,
 createSandboxedOutputHost,
 createSourceWorkerRunner,
 createTransport,
 decodeWireState,
 decodeWireValue,
 defaultValueForType,
 describeValue,
 detectLaneHandlers,
 dirModalSource,
 disposeIdleSourceWorkers,
 encodeKeySegment,
 encodeWireState,
 encodeWireValue,
 exportDeployModalSource,
 exportModalSource,
 field,
 formatImportLine,
 hasImportCycle,
 isBlockedIpAddress,
 isMaskedSecretValue,
 laneServerSource,
 laneServersModalSource,
 laneStorySource,
 laneTerminalModalSource,
 lineInfoModalSource,
 normalizePrimitiveType,
 packageModalSource,
 parse,
 parseImportLine,
 queryLaneStories,
 resolveImportValue,
 resolveScopeColumns,
 runLinesInWorker,
 saveLaneScript,
 sessionModalSource,
 setLaneSecret,
 simulateLaneRequestInWorker,
 validateOutputFrameMessage,
 validateOutputRpcRequest,
 validateSourceFetchUrl,
 validateSourceWorkerRpcRequest,
} from './field.fixtures.mjs'

test('index.html removes globalThis.main and wires sandboxed iframe + Web Worker runners; sw.js precaches isolation modules', async () => {
 const indexHtml = await fs.readFile(new URL('./index.html', import.meta.url), 'utf8')
 const swSource = await fs.readFile(new URL('./sw.js', import.meta.url), 'utf8')

 assert.ok(!indexHtml.includes('globalThis.main'), 'index.html must not expose globalThis.main')
 assert.ok(!indexHtml.includes('window.main'), 'index.html must not expose window.main')
 assert.ok(indexHtml.includes('const main = field({'), 'index.html should keep main scoped to module closure')
 assert.ok(indexHtml.includes("from '/sandbox.mjs'"), 'index.html should import isolation helpers from /sandbox.mjs')
 assert.ok(indexHtml.includes('createSandboxedOutputHost'), 'index.html should pass createSandboxedOutputHost')
 assert.ok(indexHtml.includes('createSourceWorkerRunner'), 'index.html should pass createSourceWorkerRunner')
 assert.ok(indexHtml.includes('runLines: runLinesInWorker'), 'index.html should route runLines through runLinesInWorker')
 assert.ok(
  indexHtml.includes('simulateLaneRequest: simulateLaneRequestInWorker'),
  'index.html should route simulateLaneRequest through simulateLaneRequestInWorker'
 )

 assert.ok(swSource.includes("'/sandbox.mjs'"), 'sw.js should precache /sandbox.mjs')
 assert.ok(swSource.includes("'/source-worker.mjs'"), 'sw.js should precache /source-worker.mjs')

 // Verify every named ESM import in index.html resolves to an actual export on its target module
 const scriptMatch = /<script type="module">([\s\S]*?)<\/script>/.exec(indexHtml)
 assert.ok(scriptMatch, 'index.html should contain an inline <script type="module">')
 const scriptBody = scriptMatch[1]
 const importRegex = /import\s*\{([^}]+)\}\s*from\s*'(\/[^']+\.mjs)'/g
 let impMatch
 let checkedImportCount = 0
 while ((impMatch = importRegex.exec(scriptBody)) !== null) {
  const names = impMatch[1]
   .split(',')
   .map(s => s.trim())
   .filter(Boolean)
   .map(s => s.split(/\s+as\s+/)[0].trim())
  const modPath = `.${impMatch[2]}`
  const modNs = await import(new URL(modPath, import.meta.url))
  for (const exportName of names) {
   assert.ok(
    exportName in modNs,
    `index.html imports "${exportName}" from ${impMatch[2]}, which must exist`
   )
   checkedImportCount += 1
  }
 }
 assert.ok(checkedImportCount > 100, 'Should verify all index.html module imports')

 // Verify generated srcdoc inline script from real field.mjs compiles cleanly with zero syntax errors
 const rawFieldMjs = await fs.readFile(new URL('./field.mjs', import.meta.url), 'utf8')
 const inlineField = rawFieldMjs.replace(/^export\s+(const|function|async\s+function)\s+/gm, '$1 ')
 const fullSrcdoc = buildSandboxedOutputSrcdoc({ frameId: 'syntax-check', fieldModuleSource: inlineField })
 const srcdocJsMatch = /<script type="module">([\s\S]*?)<\/script>/.exec(fullSrcdoc)
 assert.ok(srcdocJsMatch)
 assert.doesNotThrow(() => new vm.Script(srcdocJsMatch[1], { filename: 'srcdoc-check.js' }))
})

test('validateOutputRpcRequest & validateOutputFrameMessage enforce strict allowlist, schema types, and prototype-pollution guards', () => {
 const frameId = 'cc-frame-test-1'

 // Every documented extraEnv helper validates cleanly with well-typed args
 assert.equal(
  validateOutputRpcRequest({
   protocol: OUTPUT_PROTOCOL,
   frameId,
   type: 'rpc-request',
   requestId: 1,
   method: 'syncTable',
   args: ['chips', [{ title: 'BTC', value: '100000' }], 'title'],
  }).ok,
  true
 )
 assert.equal(
  validateOutputRpcRequest({
   protocol: OUTPUT_PROTOCOL,
   frameId,
   type: 'rpc-request',
   requestId: 2,
   method: 'readTable',
   args: ['chips'],
  }).ok,
  true
 )
 assert.equal(
  validateOutputRpcRequest({
   protocol: OUTPUT_PROTOCOL,
   frameId,
   type: 'rpc-request',
   requestId: 3,
   method: 'setSelfLine',
   args: [1, '; to x 42', false],
  }).ok,
  true
 )
 for (const zeroArgMethod of ['getSelfLines', 'getSelfMeta', 'getClockTimezone', 'getClockHourFormat', 'getClockShowSeconds']) {
  assert.equal(
   validateOutputRpcRequest({
    protocol: OUTPUT_PROTOCOL,
    frameId,
    type: 'rpc-request',
    requestId: 4,
    method: zeroArgMethod,
    args: [],
   }).ok,
   true,
   `${zeroArgMethod} should accept 0 args`
  )
  assert.equal(
   validateOutputRpcRequest({
    protocol: OUTPUT_PROTOCOL,
    frameId,
    type: 'rpc-request',
    requestId: 5,
    method: zeroArgMethod,
    args: ['unexpected'],
   }).ok,
   false,
   `${zeroArgMethod} should reject extra args`
  )
 }
 assert.equal(
  validateOutputRpcRequest({
   protocol: OUTPUT_PROTOCOL,
   frameId,
   type: 'rpc-request',
   requestId: 6,
   method: 'setSelfFeatures',
   args: [{ httpServer: true, runEvery30Minutes: false }],
  }).ok,
  true
 )
 assert.equal(
  validateOutputRpcRequest({
   protocol: OUTPUT_PROTOCOL,
   frameId,
   type: 'rpc-request',
   requestId: 7,
   method: 'openLaneTab',
   args: ['Data', 'accounts'],
  }).ok,
  true
 )
 assert.equal(
  validateOutputRpcRequest({
   protocol: OUTPUT_PROTOCOL,
   frameId,
   type: 'rpc-request',
   requestId: 8,
   method: 'setClockTimezone',
   args: ['America/New_York'],
  }).ok,
  true
 )
 assert.equal(
  validateOutputRpcRequest({
   protocol: OUTPUT_PROTOCOL,
   frameId,
   type: 'rpc-request',
   requestId: 9,
   method: 'setClockHourFormat',
   args: ['24h'],
  }).ok,
  true
 )
 assert.equal(
  validateOutputRpcRequest({
   protocol: OUTPUT_PROTOCOL,
   frameId,
   type: 'rpc-request',
   requestId: 10,
   method: 'setClockShowSeconds',
   args: [false],
  }).ok,
  true
 )

 // Reject unknown / dangerous methods (including Object.prototype method names)
 for (const badMethod of ['eval', 'load', 'toString', 'constructor', '__proto__', 'deleteLane', 'setLaneSecret', 'openPackage']) {
  assert.equal(
   validateOutputRpcRequest({
    protocol: OUTPUT_PROTOCOL,
    frameId,
    type: 'rpc-request',
    requestId: 11,
    method: badMethod,
    args: [],
   }).ok,
   false,
   `Should reject method: ${badMethod}`
  )
 }

 // Reject prototype-pollution keys inside records and features
 const pollutedRecord = JSON.parse('{"title":"ok","__proto__":{"polluted":true}}')
 assert.equal(
  validateOutputRpcRequest({
   protocol: OUTPUT_PROTOCOL,
   frameId,
   type: 'rpc-request',
   requestId: 12,
   method: 'syncTable',
   args: ['chips', [pollutedRecord]],
  }).ok,
  false
 )
 const constructorRecord = { title: 'ok', constructor: 'bad' }
 assert.equal(
  validateOutputRpcRequest({
   protocol: OUTPUT_PROTOCOL,
   frameId,
   type: 'rpc-request',
   requestId: 13,
   method: 'syncTable',
   args: ['chips', [constructorRecord]],
  }).ok,
  false
 )

 // Reject invalid domain values
 assert.equal(
  validateOutputRpcRequest({
   protocol: OUTPUT_PROTOCOL,
   frameId,
   type: 'rpc-request',
   requestId: 14,
   method: 'openLaneTab',
   args: ['admin'],
  }).ok,
  false
 )
 assert.equal(
  validateOutputRpcRequest({
   protocol: OUTPUT_PROTOCOL,
   frameId,
   type: 'rpc-request',
   requestId: 15,
   method: 'setClockTimezone',
   args: ['Invalid/Not_A_Zone'],
  }).ok,
  false
 )
 assert.equal(
  validateOutputRpcRequest({
   protocol: OUTPUT_PROTOCOL,
   frameId,
   type: 'rpc-request',
   requestId: 16,
   method: 'setSelfFeatures',
   args: [{ unknownFeature: true }],
  }).ok,
  false
 )
 assert.equal(
  validateOutputRpcRequest({
   protocol: OUTPUT_PROTOCOL,
   frameId,
   type: 'rpc-request',
   requestId: 17,
   method: 'setClockShowSeconds',
   args: ['yes'],
  }).ok,
  false
 )

 // Frame envelope & resize bounds validation
 assert.equal(validateOutputFrameMessage({ protocol: OUTPUT_PROTOCOL, frameId: 'wrong', type: 'ready' }, frameId).ok, false)
 const clampedResize = validateOutputFrameMessage({ protocol: OUTPUT_PROTOCOL, frameId, type: 'resize', height: 999999 }, frameId)
 assert.equal(clampedResize.ok, true)
 assert.equal(clampedResize.height, 50000)
 assert.equal(validateOutputFrameMessage({ protocol: OUTPUT_PROTOCOL, frameId, type: 'resize', height: -10 }, frameId).ok, false)

 // Verify srcdoc safely escapes </script sequences
 const srcdoc = buildSandboxedOutputSrcdoc({
  frameId,
  fieldModuleSource: "const dangerous = '</script><script>window.pwned=1</script>'",
 })
 assert.ok(!srcdoc.includes('</script><script>'), 'srcdoc must escape embedded </script sequences')
 assert.equal(OUTPUT_RPC_METHODS.length, 13)
})

test('Browser Lane Output <iframe sandbox="allow-scripts"> blocks parent DOM, localStorage, cookies, /api/*, load, and spoofed RPC origins', async () => {
 const hostListeners = {}
 const hostWindow = {
  secretMainToken: 'TOP_SECRET_HOST_VALUE',
  localStorage: { getItem: () => 'HOST_STORAGE_SECRET' },
  addEventListener(type, fn) {
   hostListeners[type] ||= []
   hostListeners[type].push(fn)
  },
  removeEventListener(type, fn) {
   hostListeners[type] = (hostListeners[type] || []).filter(h => h !== fn)
  },
 }
 const hostDocument = {
  cookie: 'session=secret',
  createElement(tag) {
   return {
    tag,
    style: {},
    attributes: {},
    children: [],
    setAttribute(k, v) { this.attributes[k] = v },
    remove() {},
   }
  },
 }
 const viewportEl = {
  children: [],
  appendChild(c) { this.children.push(c) },
  replaceChildren() { this.children = [] },
 }

 let rpcSyncCalls = 0
 const host = createSandboxedOutputHost({
  document: hostDocument,
  window: hostWindow,
  viewportEl,
  handlers: {
   syncTable: async (tbl, rows) => {
    rpcSyncCalls += 1
    return { ok: true, count: rows.length, added: rows.length, updated: 0 }
   },
   getSelfMeta: async () => ({ id: 'lane-sec', title: 'Sec Lane' }),
  },
 })

 try {
  const t = createTransport()
  const f = field({}, { transport: t })
  await f.run(parse([
   // 1. Probe opaque origin and attempt forbidden accesses (parent.document, localStorage, cookie, /api/data, load)
   `; send (
    ; to report ; object
    ; set $window.origin report.origin
    ; set [ ; try ( $window.localStorage ) : 'blocked-localStorage' ] report.ls
    ; set [ ; try ( $document.cookie ) : 'blocked-cookie' ] report.cookie
    ; set [ ; try ( $window.parent.document ) : 'blocked-parent-doc' ] report.parentDoc
    ; set [ ; try ( $window.parent.main ) : 'blocked-parent-main' ] report.parentMain
    ; set [ ; try ( !window.fetch '/api/data?key=secret' ) : 'blocked-relative-api' ] report.relApi
    ; set [ ; try ( !window.fetch 'http://localhost:8080/api/data?key=secret' ) : 'blocked-abs-api' ] report.absApi
    ; set [ ; try ( ; load /src/main.fs ) : 'blocked-load' ] report.loadAttempt
    ; to meta !getSelfMeta
    ; set $meta.id report.metaId
    ; to badRpc [ ; try (
     !window.Promise (
      ; to { resolve } $argv
      ; to reqId 9999
      !window.addEventListener message (
       ; to { ev } $argv
       ; condition { propertyIs 9999 ev.data.requestId } : !$resolve $ev.data
      )
      !window.parent.postMessage [ object
       { protocol '${OUTPUT_PROTOCOL}' }
       { frameId '${'wrong-or-injected'}' }
      ] '*'
     )
    ) : null ]
    ; to out !document.createElement pre
    ; set [ !JSON.stringify $report ] out.textContent
    $out
   )`,
  ].join('\n')))

  const outcome = await host.render(t.packets())
  assert.equal(outcome.results.length, 1)
  assert.equal(outcome.results[0].error, null)
  assert.equal(host.iframe.tag, 'iframe')
  assert.equal(host.iframe.attributes.sandbox, 'allow-scripts')
  assert.ok(!host.iframe.attributes.sandbox.includes('allow-same-origin'))

  const report = JSON.parse(host.debugOutputEl.children[0].textContent)
  assert.equal(report.origin, 'null')
  assert.equal(report.ls, 'blocked-localStorage')
  assert.equal(report.cookie, 'blocked-cookie')
  assert.equal(report.parentDoc, 'blocked-parent-doc')
  assert.equal(report.parentMain, 'blocked-parent-main')
  assert.equal(report.relApi, 'blocked-relative-api')
  assert.equal(report.absApi, 'blocked-abs-api')
  assert.equal(report.loadAttempt, 'blocked-load')
  assert.equal(report.metaId, 'lane-sec')

  // Spoofed message from a non-null origin or wrong source on hostWindow is ignored
  for (const listener of hostListeners.message || []) {
   await listener({
    origin: 'http://localhost:8080',
    source: host.iframe.contentWindow,
    data: {
     protocol: OUTPUT_PROTOCOL,
     frameId: host.frameId,
     type: 'rpc-request',
     requestId: 77,
     method: 'syncTable',
     args: ['chips', [{ title: 'Spoofed' }]],
    },
   })
   await listener({
    origin: 'null',
    source: {},
    data: {
     protocol: OUTPUT_PROTOCOL,
     frameId: host.frameId,
     type: 'rpc-request',
     requestId: 78,
     method: 'syncTable',
     args: ['chips', [{ title: 'WrongSource' }]],
    },
   })
  }
  assert.equal(rpcSyncCalls, 0, 'Spoofed origin and wrong source messages must never execute host RPC handlers')
 }
 finally {
  host.dispose()
 }
})

test('Source Worker isolation: no DOM/storage/ambient globals, scoped KV, external-only fetch, hard worker.terminate() on CPU & async hangs, and full UI recovery', async () => {
 // 1. Validate fetch URL and Worker RPC schema guards directly
 assert.equal(validateSourceFetchUrl('/api/data', 'http://localhost:8080').ok, false)
 assert.equal(validateSourceFetchUrl('http://localhost:8080/api/fs/roots', 'http://localhost:8080').ok, false)
 assert.equal(validateSourceFetchUrl('http://localhost:8080/index.html', 'http://localhost:8080').ok, false)
 assert.equal(validateSourceFetchUrl('http://127.0.0.1:3333/api/data', '').ok, false)
 assert.equal(validateSourceFetchUrl('ftp://example.com/file', 'http://localhost:8080').ok, false)
 assert.equal(validateSourceFetchUrl('https://api.github.com/repos/tagmein/civil-command', 'http://localhost:8080').ok, true)

 assert.equal(
  validateSourceWorkerRpcRequest({
   protocol: SOURCE_WORKER_PROTOCOL,
   type: 'rpc-request',
   runId: 1,
   requestId: 1,
   method: 'eval',
   params: {},
  }).ok,
  false
 )

 // 2. Verify Worker global scrubbing, KV root isolation, and external fetch credentials omission
 const kvMap = new Map([['lane-1.greeting', 'hi']])
 const rootLeak = { touched: false }
 const scopedKv = {
  root: {
   async get() {
    rootLeak.touched = true
    return 'ROOT_SECRET'
   },
  },
  withBasePath() {
   rootLeak.touched = true
   return this.root
  },
  namespace(sub) {
   return {
    async get(k) { return kvMap.get(`lane-1.${sub}.${k}`) ?? null },
    async set(k, v) { kvMap.set(`lane-1.${sub}.${k}`, v) },
   }
  },
  async get(k) { return kvMap.get(`lane-1.${k}`) ?? null },
  async set(k, v) { kvMap.set(`lane-1.${k}`, v) },
 }

 let capturedFetchOpts = null
 const envOutcome = await runLinesInWorker([
  '; to probe ; object',
  '; set $document probe.doc',
  '; set $window probe.win',
  '; set $localStorage probe.ls',
  '; set $indexedDB probe.idb',
  '; set $postMessage probe.pm',
  '; set $Worker probe.workerCtor',
  '; set $process probe.proc',
  '; set $data.root probe.dataRoot',
  '; set $data.withBasePath probe.dataWithBasePath',
  "; set [ ; try ( ; load /src/main.fs ) : 'load-blocked' ] probe.loadRes",
  "; set [ ; try ( !fetch '/api/fs/roots' ) : 'rel-fetch-blocked' ] probe.relFetch",
  "; set [ ; try ( !fetch 'http://localhost:8080/api/agent/sessions' ) : 'origin-fetch-blocked' ] probe.originFetch",
  '; set [ !data.get greeting ] probe.kvVal',
  "; to extRes !fetch 'https://api.example.test/ping' [ object { headers [ object { X-Test '1' } ] } ]",
  '; set [ !extRes.text ] probe.extBody',
  '$probe',
 ], {
  hostOrigin: 'http://localhost:8080',
  initialState: {
   data: scopedKv,
   fetch: async (_url, opts) => {
    capturedFetchOpts = opts
    return { ok: true, status: 200, text: async () => 'pong' }
   },
  },
 })

 const probe = envOutcome.results[envOutcome.results.length - 1].value
 assert.equal(probe.doc, undefined)
 assert.equal(probe.win, undefined)
 assert.equal(probe.ls, undefined)
 assert.equal(probe.idb, undefined)
 assert.equal(probe.pm, undefined)
 assert.equal(probe.workerCtor, undefined)
 assert.equal(probe.proc, undefined)
 assert.equal(probe.dataRoot, undefined)
 assert.equal(probe.dataWithBasePath, undefined)
 assert.equal(probe.loadRes, 'load-blocked')
 assert.equal(probe.relFetch, 'rel-fetch-blocked')
 assert.equal(probe.originFetch, 'origin-fetch-blocked')
 assert.equal(probe.kvVal, 'hi')
 assert.equal(probe.extBody, 'pong')
 assert.equal(capturedFetchOpts.credentials, 'omit')
 assert.equal(rootLeak.touched, false)

 // 3. Hard worker.terminate() on synchronous infinite loop AND recovery on next run
 const runner = createSourceWorkerRunner({ timeoutMs: 50 })
 try {
  const cpuHang = await runner.run(
   [
    '; to beforeHang 123',
    '; while { true } ( ; to spin 1 )',
    '; to afterHang 456',
   ],
   { limits: { maxLoopIterations: 0, maxSteps: 0 } }
  )
  assert.equal(cpuHang.timedOut, true)
  assert.equal(cpuHang.terminated, true)
  assert.equal(runner.terminatedCount, 1)
  assert.equal(cpuHang.results[0].value, 123)
  assert.match(cpuHang.results[1].error, /timed out after 50ms \(worker terminated\)/)
  assert.equal(cpuHang.results.length, 2)

  // Async hang also hard-terminates cleanly
  const asyncHang = await runner.run(
   ['; to hang !fetch \'https://slow.example.test/never\''],
   {
    initialState: {
     fetch: () => new Promise(() => {}),
    },
   }
  )
  assert.equal(asyncHang.timedOut, true)
  assert.equal(asyncHang.terminated, true)
  assert.equal(runner.terminatedCount, 2)
  assert.match(asyncHang.results[0].error, /timed out after 50ms \(worker terminated\)/)

  // Subsequent run on the same runner spawns a fresh Worker and succeeds immediately
  const recovered = await runner.run(['; add 19 23'])
  assert.equal(recovered.timedOut, false)
  assert.equal(recovered.terminated, false)
  assert.equal(recovered.results[0].value, 42)
 }
 finally {
  runner.dispose()
 }

 // 4. Browser globalThis.Worker lifecycle + real WebIDL MessageEvent (Object.hasOwn(ev, 'data') === false)
 const sampleEvent = new MessageEvent('message', { data: { hello: 1 } })
 assert.equal(Object.hasOwn(sampleEvent, 'data'), false, 'Real WebIDL MessageEvent has data on prototype, not own property')

 const origBrowserWorker = globalThis.Worker
 let createdBrowserWorkers = 0
 let terminatedBrowserWorkers = 0
 class MockBrowserWorker {
  constructor() {
   createdBrowserWorkers += 1
   this.listeners = new Map()
  }
  addEventListener(type, fn) {
   if (!this.listeners.has(type)) this.listeners.set(type, new Set())
   this.listeners.get(type).add(fn)
  }
  removeEventListener(type, fn) {
   this.listeners.get(type)?.delete(fn)
  }
  postMessage(msg) {
   if (msg.type === 'run' && msg.lines[0] === '; to hang true') {
    return
   }
   queueMicrotask(() => {
    const ev = new MessageEvent('message', {
     data: {
      protocol: SOURCE_WORKER_PROTOCOL,
      type: 'run-complete',
      runId: msg.runId,
      results: [{ index: 0, lineNumber: 1, source: msg.lines[0], value: 99, preview: '99', error: null, isEmpty: false, isComment: false }],
      state: encodeWireState({ out: 99 }),
      sent: [],
     },
    })
    for (const fn of this.listeners.get('message') || []) {
     fn(ev)
    }
   })
  }
  terminate() {
   terminatedBrowserWorkers += 1
  }
 }

 globalThis.Worker = MockBrowserWorker
 try {
  const bRunner = createSourceWorkerRunner({ laneId: 'browser-lane', timeoutMs: 30 })
  const r1 = await bRunner.run(['; to out 99'])
  const r2 = await bRunner.run(['; to out 99'])
  assert.equal(r1.results[0].value, 99)
  assert.equal(r2.results[0].value, 99)
  assert.equal(createdBrowserWorkers, 1, 'Dedicated browser worker is reused across sequential runs of the same lane')
  assert.equal(terminatedBrowserWorkers, 0)

  const rHang = await bRunner.run(['; to hang true'])
  assert.equal(rHang.timedOut, true)
  assert.equal(terminatedBrowserWorkers, 1, 'Timed-out browser worker must be hard-terminated via worker.terminate()')

  const r3 = await bRunner.run(['; to out 99'])
  assert.equal(r3.results[0].value, 99)
  assert.equal(createdBrowserWorkers, 2, 'Fresh dedicated browser worker spawns after timeout termination')

  bRunner.dispose()
  assert.equal(terminatedBrowserWorkers, 2, 'Disposing lane notebook terminates its dedicated browser worker')
 }
 finally {
  globalThis.Worker = origBrowserWorker
 }

 // 5. Execute source-worker.mjs browser branch inside a prototype-backed DedicatedWorkerGlobalScope with real WebIDL MessageEvents
 const rawWorkerSource = await fs.readFile(new URL('./source-worker.mjs', import.meta.url), 'utf8')
 const strippedWorkerBody = rawWorkerSource.replace(/import\s*\{[\s\S]*?\}\s*from\s*'[^']+'\n?/g, '')
 const fieldMod = await import('./field.mjs')
 const laneHttpMod = await import('./lane-http.mjs')
 const sandboxMod = await import('./sandbox.mjs')

 const workerOutbox = []
 const workerEventListeners = new Map()
 const workerScopeProto = {
  postMessage(payload) {
   workerOutbox.push(payload)
  },
  addEventListener(type, fn) {
   if (!workerEventListeners.has(type)) workerEventListeners.set(type, new Set())
   workerEventListeners.get(type).add(fn)
  },
  fetch() {
   throw new Error('Raw prototype fetch must be scrubbed')
  },
  importScripts() {
   throw new Error('importScripts must be scrubbed')
  },
  close() {},
  get caches() { return { leaked: true } },
  get indexedDB() { return { leaked: true } },
  get self() { return this },
  get origin() { return 'http://localhost:8080' },
 }
 const browserWorkerGlobal = Object.create(workerScopeProto)
 browserWorkerGlobal.BroadcastChannel = function BroadcastChannel() {}
 browserWorkerGlobal.WebSocket = function WebSocket() {}
 browserWorkerGlobal.XMLHttpRequest = function XMLHttpRequest() {}
 browserWorkerGlobal.EventTarget = globalThis.EventTarget
 browserWorkerGlobal.MessageEvent = globalThis.MessageEvent

 const workerVmCtx = vm.createContext(browserWorkerGlobal)
 browserWorkerGlobal.globalThis = vm.runInContext('globalThis', workerVmCtx)
 Object.setPrototypeOf(browserWorkerGlobal.globalThis, workerScopeProto)

 const bootFn = vm.runInContext(
  `(async (__deps) => {\nconst { cloneScopeData, compileFieldScriptLines, createExecutionBudget, defaultValueForType, field, formatValue, normalizePrimitiveType, redactSecretText, redactSecretValue, runCompiledLines, serializeTransportPacket, buildRequestObject, createResponseHelper, executeLaneHttpRequest, normalizeHttpResult, SOURCE_WORKER_PROTOCOL, decodeWireValue, encodeWireState, encodeWireValue } = __deps;\n${strippedWorkerBody}\n})`,
  workerVmCtx,
  { filename: 'browser-source-worker-sim.js' }
 )
 await bootFn({ ...fieldMod, ...laneHttpMod, ...sandboxMod })

 // Prototype and global capabilities are scrubbed, yet bound postMessage + MessageEvent listener work cleanly
 assert.equal(browserWorkerGlobal.globalThis.postMessage, undefined)
 assert.equal(browserWorkerGlobal.globalThis.fetch, undefined)
 assert.equal(browserWorkerGlobal.globalThis.WebSocket, undefined)
 assert.equal(browserWorkerGlobal.globalThis.indexedDB, undefined)
 assert.equal(workerScopeProto.postMessage, undefined)
 assert.equal(workerScopeProto.fetch, undefined)

 const runEv = new MessageEvent('message', {
  data: {
   protocol: SOURCE_WORKER_PROTOCOL,
   type: 'run',
   runId: 77,
   filename: 'webidl-lane',
   lines: ['; add 40 2'],
   includePreviews: true,
  },
 })
 for (const fn of workerEventListeners.get('message') || []) {
  fn(runEv)
 }
 await new Promise(r => setTimeout(r, 25))
 const completeMsg = workerOutbox.find(m => m && m.type === 'run-complete' && m.runId === 77)
 assert.ok(completeMsg, 'Browser Worker branch must process WebIDL MessageEvent and emit run-complete')
 assert.equal(decodeWireValue(completeMsg.results[0].value), 42)
})

test('Cross-realm wire graph codec, cross-lane will imports, simulateLaneRequestInWorker, and full lane-notebook timeout recovery', async () => {
 // 1. Cyclic objects, shared DAG nodes, masked secrets, will ASTs, Maps, Sets, TypedArrays, and __proto__ safety
 const cyclic = { label: 'root' }
 cyclic.self = cyclic
 const sharedLeaf = { tag: 'shared' }
 const secretVal = createMaskedSecretValue('apiToken', true)
 const willFn = Object.assign(function sampleWill() {}, {
  ast: [['@', 'comment', 'Computes greeting'], ['@', 'add', 'Hi ', ['@', 'get', 'argv', '0']]],
 })
 const complex = {
  cyclic,
  a: sharedLeaf,
  b: sharedLeaf,
  secretVal,
  willFn,
  map: new Map([['k', 7]]),
  set: new Set(['x', 'y']),
  bytes: new Uint8Array([1, 2, 3]),
  negZero: -0,
  nanVal: NaN,
  big: 9007199254740993n,
 }
 Object.defineProperty(complex, '__proto__', {
  value: { injected: true },
  enumerable: true,
  configurable: true,
  writable: true,
 })

 const decoded = decodeWireValue(encodeWireValue(complex))
 assert.equal(decoded.cyclic.self, decoded.cyclic)
 assert.equal(decoded.a, decoded.b)
 assert.equal(isMaskedSecretValue(decoded.secretVal), true)
 assert.equal(describeValue(decoded.secretVal).summary, SECRET_MASK)
 assert.equal(typeof decoded.willFn, 'function')
 assert.equal(describeValue(decoded.willFn).type, 'will')
 assert.equal(describeValue(decoded.willFn).detail, 'will — Computes greeting')
 assert.throws(() => decoded.willFn('Nate'), /cannot be invoked directly on the host thread/)
 assert.equal(decoded.map.get('k'), 7)
 assert.equal(decoded.set.has('y'), true)
 assert.deepEqual(Array.from(decoded.bytes), [1, 2, 3])
 assert.ok(Object.is(decoded.negZero, -0))
 assert.ok(Number.isNaN(decoded.nanVal))
 assert.equal(decoded.big, 9007199254740993n)
 assert.equal(({}).injected, undefined, 'Decoding wire objects must never pollute Object.prototype')

 // 2. Cross-lane import of a `will` function executes safely inside the importing lane's Worker
 const exportedState = decodeWireState(encodeWireState({
  doubleIt: Object.assign(function () {}, {
   ast: [['@', 'to', ['n'], ['@', 'get', 'argv']], ['@', 'multiply', ['@', 'get', 'n'], 2]],
  }),
 }))
 assert.equal(detectLaneHandlers({ get: exportedState.doubleIt }).hasHandlers, true)

 const callerOut = await runLinesInWorker(
  ['; to fn !importLane helper doubleIt', '!fn 21'],
  {
   initialState: {
    importLane: async (_id, prop) => exportedState[prop],
   },
  }
 )
 assert.equal(callerOut.results[1].value, 42)

 // 3. simulateLaneRequestInWorker isolates HTTP handler execution and hard-terminates hung handlers
 const okSim = await simulateLaneRequestInWorker({
  laneId: 'sim-api',
  lines: [
   '; to post (\n ; to { req } $argv\n ; object { docIsUndef [ propertyIs undefined document ] } { echo $req.body.msg }\n)',
  ],
  req: {
   method: 'POST',
   path: '/echo',
   headers: { 'content-type': 'application/json' },
   rawBody: JSON.stringify({ msg: 'isolated' }),
  },
 })
 assert.equal(okSim.status, 200)
 assert.deepEqual(JSON.parse(okSim.bodyText), { docIsUndef: true, echo: 'isolated' })

 const hungSim = await simulateLaneRequestInWorker({
  laneId: 'sim-hang',
  lines: ['; to get ( ; while { true } ( ; to x 1 ) )'],
  req: { method: 'GET', path: '/' },
  timeoutMs: 50,
 })
 assert.equal(hungSim.status, 504)
 assert.equal(hungSim.timedOut, true)
 assert.equal(hungSim.terminated, true)

 // 4. Full UI notebook integration: hung Source line times out in Worker, marks error preview, releases idle tracker, and recovers on edit
 const mainSource = await fs.readFile(new URL('./src/main.fs', import.meta.url), 'utf8')
 const laneSource = await fs.readFile(new URL('./src/lane-control.fs', import.meta.url), 'utf8')
 const notebookSource = await fs.readFile(new URL('./src/lane-notebook.fs', import.meta.url), 'utf8')
 const inputsSource = await fs.readFile(new URL('./src/lane-inputs.fs', import.meta.url), 'utf8')
 const scopeSource = await fs.readFile(new URL('./src/lane-scope.fs', import.meta.url), 'utf8')
 const dataSource = await fs.readFile(new URL('./src/lane-data.fs', import.meta.url), 'utf8')
 const confirmModalSource = await fs.readFile(new URL('./src/confirm-modal.fs', import.meta.url), 'utf8')
 const rowPickerModalSource = await fs.readFile(new URL('./src/lane-row-picker-modal.fs', import.meta.url), 'utf8')
 const outputSource = await fs.readFile(new URL('./src/lane-output.fs', import.meta.url), 'utf8')
 const modalSource = await fs.readFile(new URL('./src/lane-modal.fs', import.meta.url), 'utf8')
 const configModalSource = await fs.readFile(new URL('./src/lane-config-modal.fs', import.meta.url), 'utf8')
 const importModalSource = await fs.readFile(new URL('./src/lane-import-modal.fs', import.meta.url), 'utf8')
 const railsSource = await fs.readFile(new URL('./src/lane-rails.fs', import.meta.url), 'utf8')

 function createMockElement(tag) {
  return {
   tag,
   nodeType: 1,
   style: {},
   attributes: {},
   children: [],
   listeners: {},
   textContent: '',
   value: '',
   className: '',
   hidden: false,
   disabled: false,
   setAttribute(k, v) { this.attributes[k] = v },
   removeAttribute(k) { delete this.attributes[k] },
   appendChild(c) { this.children.push(c); return c },
   insertBefore(c, r) {
    const i = this.children.indexOf(r)
    if (i === -1) this.children.push(c)
    else this.children.splice(i, 0, c)
    return c
   },
   replaceChildren(...nodes) { this.children = [...nodes] },
   addEventListener(e, h) { this.listeners[e] = h },
   removeEventListener(e, h) { if (this.listeners[e] === h) delete this.listeners[e] },
   focus() {},
   remove() {},
  }
 }

 const kv = new Map()
 function makeKv(prefix = '') {
  const q = k => (prefix ? `${prefix}.${k}` : k)
  return {
   namespace: n => makeKv(q(n)),
   async get(k) { return kv.has(q(k)) ? kv.get(q(k)) : null },
   async set(k, v) { kv.set(q(k), v) },
   async delete(k) { kv.delete(q(k)) },
  }
 }

 function makeWebStorage() {
  const m = new Map()
  return {
   getItem(k) { return m.has(k) ? m.get(k) : null },
   setItem(k, v) { m.set(k, String(v)) },
   removeItem(k) { m.delete(k) },
  }
 }

 let uuid = 0
 const mockWindow = {
  Array,
  Boolean,
  Date,
  JSON,
  Math,
  Number,
  Object,
  Reflect,
  decodeURIComponent,
  crypto: { randomUUID: () => `iso-uuid-${++uuid}` },
  history: { pushState(_s, _t, url) { mockWindow.location.pathname = url } },
  location: { pathname: '/', origin: 'http://localhost:8080', search: '', hash: '' },
  localStorage: makeWebStorage(),
  sessionStorage: makeWebStorage(),
  fetch: () => new Promise(() => {}),
  addEventListener() {},
  removeEventListener() {},
 }
 const mockDocument = {
  body: createMockElement('body'),
  documentElement: createMockElement('html'),
  defaultView: mockWindow,
  createElement: createMockElement,
 }

 const origFetch = globalThis.fetch
 globalThis.fetch = async url => {
  const map = {
   '/src/lane-control.fs': laneSource,
   '/src/lane-notebook.fs': notebookSource,
   '/src/lane-inputs.fs': inputsSource,
   '/src/lane-scope.fs': scopeSource,
   '/src/lane-data.fs': dataSource,
   '/src/confirm-modal.fs': confirmModalSource,
   '/src/lane-row-picker-modal.fs': rowPickerModalSource,
   '/src/lane-output.fs': outputSource,
   '/src/lane-modal.fs': modalSource,
   '/src/lane-config-modal.fs': configModalSource,
   '/src/lane-import-modal.fs': importModalSource,
   '/src/lane-rails.fs': railsSource,
   '/src/lane-line-info-modal.fs': lineInfoModalSource,
   '/src/lane-export-modal.fs': exportModalSource,
   '/src/lane-export-deploy-modal.fs': exportDeployModalSource,
   '/src/lane-server.fs': laneServerSource,
   '/src/lane-story.fs': laneStorySource,
   '/src/lane-servers-modal.fs': laneServersModalSource,
   '/src/lane-terminal-modal.fs': laneTerminalModalSource,
   '/src/lane-session-modal.fs': sessionModalSource,
   '/src/lane-package-modal.fs': packageModalSource,
   '/src/lane-dir-modal.fs': dirModalSource,
  }
  if (Object.hasOwn(map, url)) {
   return { ok: true, text: async () => map[url] }
  }
  throw new Error(`Unexpected fetch: ${url}`)
 }

 try {
  const f = field({
   ...DATA_RUNTIME_ENV,
   console: { log() {} },
   createIdleTracker,
   createSandboxedOutputHost,
   createSourceWorkerRunner: opts => createSourceWorkerRunner({ ...opts, timeoutMs: 60 }),
   data: makeKv(),
   defaultValueForType,
   document: mockDocument,
   formatImportLine,
   hasImportCycle,
   normalizePrimitiveType,
   parseImportLine,
   primitiveTypes: PRIMITIVE_TYPES,
   resolveImportValue,
   resolveScopeColumns,
   runLines: runLinesInWorker,
   window: mockWindow,
  })
  await f.run(parse(mainSource, '/src/main.fs'))
  const lc = f.state['lane-control']
  const firstSessionId = lc['session-id']
  assert.ok(firstSessionId)
  assert.equal(lc['session-status-pending'], false, 'Startup must settle session-status-pending to false')
  assert.equal(await lc['is-session-navigation-blocked'](), false)

  await f.state.tableHeadRowAddButton.listeners.click()

  const lane = f.state.lanes[0]
  const nb = lane.notebook

  // Hang on external fetch -> Worker hard-terminates after 60ms, shows error preview, and notebook returns to idle
  nb.rows[0]['input-el'].value = "; to never !fetch 'https://slow.example.test/hang'"
  await nb.rows[0]['input-el'].listeners.input()
  await nb['when-idle']()
  assert.equal(nb['is-running'](), false)
  assert.match(nb.rows[0]['preview-el'].textContent, /timed out after 60ms \(worker terminated\)/)
  assert.match(nb.rows[0]['preview-el'].className, /lane-line-preview--error/)

  // Fix line -> evaluates cleanly in a fresh Worker with sandboxed Lane Output
  nb.rows[0]['input-el'].value = "; send ( ; to d !document.createElement div , ; set 'Session 1 Output' d.textContent , $d )"
  await nb.rows[0]['input-el'].listeners.input()
  await nb['when-idle']()
  assert.equal(nb.rows[0]['error'], undefined)
  assert.equal(nb['output-view']['iframe-el'].attributes.sandbox, 'allow-scripts')

  // Save session 1 draft, create session 2, add lane in session 2, save, and switch back & forth
  await lc['confirm-session-data-dir'](null)
  await lc['save-session-draft']()
  assert.equal(lc['session-status-pending'], false)
  assert.equal(await lc['is-session-navigation-blocked'](), false)

  const secondSess = await lc['new-session']('Session Two', null, true)
  const secondSessionId = secondSess.sessionId
  assert.notEqual(secondSessionId, firstSessionId)
  assert.equal(lc['session-status-pending'], false)
  assert.equal(await lc['is-session-navigation-blocked'](), false)
  assert.equal(f.state.lanes.length, 0)

  await f.state.tableHeadRowAddButton.listeners.click()
  const lane2 = f.state.lanes[0]
  lane2.notebook.rows[0]['input-el'].value = '; add 100 23'
  await lane2.notebook.rows[0]['input-el'].listeners.input()
  assert.equal(lane2.notebook.rows[0]['preview-el'].textContent, '123')
  await lc['save-session-draft']()
  assert.equal(await lc['is-session-navigation-blocked'](), false)

  // Switch back to Session 1 -> mounts Session 1 lane, runs Worker + sandboxed iframe, and settles cleanly
  await lc['switch-session'](firstSessionId)
  assert.equal(lc['session-id'], firstSessionId)
  assert.equal(lc['session-status-pending'], false)
  assert.equal(await lc['is-session-navigation-blocked'](), false)
  assert.equal(f.state.lanes.length, 1)
  assert.equal(f.state.lanes[0].id, lane.id)

  // Switch forward to Session 2 -> mounts Session 2 lane and settles cleanly
  await lc['switch-session'](secondSessionId)
  assert.equal(lc['session-id'], secondSessionId)
  assert.equal(lc['session-status-pending'], false)
  assert.equal(await lc['is-session-navigation-blocked'](), false)
  assert.equal(f.state.lanes.length, 1)
  assert.equal(f.state.lanes[0].id, lane2.id)
  assert.equal(f.state.lanes[0].notebook.rows[0]['preview-el'].textContent, '123')

  // Closing the lane disposes both the Worker runner and the sandboxed output host
  await lc.close(lane2.id)
  await lc['save-session-draft']()
 }
 finally {
  globalThis.fetch = origFetch
 }
})

test('Backend Node --permission subprocess & SSRF network boundary (isBlockedIpAddress, validateSourceFetchUrl, createSafeExternalFetch)', async () => {
 const repoDir = fsSync.realpathSync(process.cwd())
 const fieldPath = path.join(repoDir, 'field.mjs')
 const execArgs = buildNodePermissionExecArgs([fieldPath, fieldPath], { maxOldSpaceMb: 96 })

 assert.ok(
  execArgs.includes('--permission') || execArgs.includes('--experimental-permission'),
  'Subprocess execArgs must enable Node --permission'
 )
 assert.ok(execArgs.includes('--disallow-code-generation-from-strings'))
 assert.ok(execArgs.includes('--max-old-space-size=96'))
 assert.deepEqual(
  execArgs.filter(a => a.startsWith('--allow-')),
  [`--allow-fs-read=${fieldPath}`],
  'Subprocess must grant zero write, network, child_process, worker, addon, or broad directory read permissions'
 )

 // Verify OS/C++ Node permission enforcement inside a real spawned child process
 process.env.CC_PARENT_SECRET_TOKEN = 'DO_NOT_INHERIT_ME'
 try {
  const probeReport = await new Promise((resolve, reject) => {
   const childCode = [
    'import fs from "node:fs"',
    'import cp from "node:child_process"',
    'import wt from "node:worker_threads"',
    'const out = { envKeys: Object.keys(process.env) }',
    'try { fs.readFileSync("./start") } catch (e) { out.fsReadStart = e.code }',
    'try { fs.writeFileSync("/tmp/cc-perm-probe", "x") } catch (e) { out.fsWriteTmp = e.code }',
    'try { cp.spawnSync("id") } catch (e) { out.childProc = e.code }',
    'try { new wt.Worker("1+1", { eval: true }) } catch (e) { out.workerThread = e.code }',
    'try { eval("1+1") } catch (e) { out.evalErr = e.name }',
    'try { new Function("return 1")() } catch (e) { out.fnCtorErr = e.name }',
    'try { await fetch("http://127.0.0.1:80") } catch (e) { out.netFetch = e.cause?.code || e.code || e.name }',
    'process.send(out)',
    'process.disconnect()',
   ].join('; ')
   const child = spawn(process.execPath, [...execArgs, '--input-type=module', '-e', childCode], {
    cwd: repoDir,
    env: {},
    stdio: ['ignore', 'ignore', 'pipe', 'ipc'],
   })
   child.once('error', reject)
   child.once('message', msg => resolve(msg))
  })
  assert.deepEqual(probeReport.envKeys, [])
  assert.equal(probeReport.fsReadStart, 'ERR_ACCESS_DENIED')
  assert.equal(probeReport.fsWriteTmp, 'ERR_ACCESS_DENIED')
  assert.equal(probeReport.childProc, 'ERR_ACCESS_DENIED')
  assert.equal(probeReport.workerThread, 'ERR_ACCESS_DENIED')
  assert.equal(probeReport.evalErr, 'EvalError')
  assert.equal(probeReport.fnCtorErr, 'EvalError')
  assert.equal(probeReport.netFetch, 'ERR_ACCESS_DENIED')
 }
 finally {
  delete process.env.CC_PARENT_SECRET_TOKEN
 }

 // Exhaustive IPv4, IPv6, metadata, RFC1918, CGNAT, NAT64, 6to4, and IPv4-mapped IPv6 checks
 for (const blockedIp of [
  '0.0.0.0',
  '127.0.0.1',
  '127.0.0.53',
  '127.255.255.254',
  '10.0.0.1',
  '100.64.0.1',
  '100.100.100.200',
  '169.254.169.254',
  '169.254.170.2',
  '172.16.0.1',
  '172.31.255.254',
  '192.168.1.1',
  '224.0.0.1',
  '255.255.255.255',
  '::',
  '::1',
  '0:0:0:0:0:0:0:1',
  '::ffff:127.0.0.1',
  '::ffff:169.254.169.254',
  '::ffff:7f00:1',
  '64:ff9b::a9fe:a9fe',
  '64:ff9b::7f00:1',
  '2002:7f00:0001::1',
  'fc00::1',
  'fd00:ec2::254',
  'fe80::1',
  'fe80::1%eth0',
  'ff02::1',
 ]) {
  assert.equal(isBlockedIpAddress(blockedIp), true, `Expected IP to be blocked: ${blockedIp}`)
 }
 for (const publicIp of ['1.1.1.1', '8.8.8.8', '93.184.216.34', '2606:4700:4700::1111']) {
  assert.equal(isBlockedIpAddress(publicIp), false, `Expected public IP to be allowed: ${publicIp}`)
 }

 // URL-level SSRF checks including hex/octal/decimal IPv4, metadata hostnames, and credentials
 for (const blockedUrl of [
  'http://localhost:8080/api/fs/roots',
  'http://sub.localhost/secret',
  'http://127.0.0.1:3333/?mode=disk&key=x',
  'http://0x7f000001:3333/',
  'http://2130706433/',
  'http://0177.0.0.1/',
  'http://127.1/',
  'http://0.0.0.0:8080/',
  'http://169.254.169.254/latest/meta-data/',
  'http://100.100.100.200/latest/meta-data/',
  'http://[fd00:ec2::254]/latest/user-data',
  'http://[::1]:8080/',
  'http://[::ffff:127.0.0.1]:3333/',
  'http://metadata.google.internal/computeMetadata/v1/',
  'http://instance-data/latest/meta-data/',
  'http://service.internal/admin',
  'https://user:pass@example.com/data',
 ]) {
  assert.equal(validateSourceFetchUrl(blockedUrl).ok, false, `Expected URL to be blocked: ${blockedUrl}`)
 }

 // DNS-rebinding & multi-record resolution guards in createSafeExternalFetch
 const rebindFetch = createSafeExternalFetch({
  dnsLookup: async host => {
   if (host === 'rebind-loopback.example.test') {
    return [{ address: '127.0.0.1', family: 4 }]
   }
   if (host === 'rebind-imds.example.test') {
    return [{ address: '169.254.169.254', family: 4 }]
   }
   if (host === 'mixed-records.example.test') {
    return [
     { address: '93.184.216.34', family: 4 },
     { address: '10.0.0.9', family: 4 },
    ]
   }
   if (host === 'ipv6-imds.example.test') {
    return [{ address: 'fd00:ec2::254', family: 6 }]
   }
   throw new Error(`Unexpected host: ${host}`)
  },
 })

 await assert.rejects(() => rebindFetch('https://rebind-loopback.example.test/pwn'), /Blocked SSRF fetch target/)
 await assert.rejects(() => rebindFetch('https://rebind-imds.example.test/latest/meta-data/'), /Blocked SSRF fetch target/)
 await assert.rejects(() => rebindFetch('https://mixed-records.example.test/api'), /Blocked SSRF fetch target/)
 await assert.rejects(() => rebindFetch('https://ipv6-imds.example.test/latest'), /Blocked SSRF fetch target/)

 // Verify pinned-IP lookup callback & HTTP 302 open-redirect SSRF protection
 const socketRequests = []
 const redirectFetch = createSafeExternalFetch({
  dnsLookup: async host => {
   if (host === 'public.example.test') {
    return [{ address: '93.184.216.34', family: 4 }]
   }
   if (host === 'internal-hop.example.test') {
    return [{ address: '127.0.0.1', family: 4 }]
   }
   throw new Error(`Unexpected DNS lookup: ${host}`)
  },
  httpsRequest(reqOpts, onRes) {
   socketRequests.push(reqOpts)
   let pinnedResult = null
   reqOpts.lookup(reqOpts.hostname, { all: true }, (_err, res) => { pinnedResult = res })
   assert.deepEqual(pinnedResult, [{ address: '93.184.216.34', family: 4 }], 'Socket lookup must be pinned to validated public IP')
   queueMicrotask(() => {
    const loc = reqOpts.path === '/to-imds'
     ? 'http://169.254.169.254/latest/meta-data/iam/'
     : 'https://internal-hop.example.test/admin'
    onRes({
     statusCode: 302,
     statusMessage: 'Found',
     headers: { location: loc },
     resume() {},
     on() {},
    })
   })
   return {
    setTimeout() {},
    on() {},
    write() {},
    end() {},
    destroy() {},
   }
  },
  httpRequest() {
   throw new Error('SSRF redirect target must never reach httpRequest')
  },
 })

 await assert.rejects(() => redirectFetch('https://public.example.test/to-imds'), /Blocked SSRF fetch target/)
 await assert.rejects(() => redirectFetch('https://public.example.test/to-rebind'), /Blocked SSRF fetch target/)
 assert.equal(socketRequests.length, 2, 'Only the initial public hop should open a request; both SSRF redirect hops must be blocked pre-connect')
})

test('Server-side isolation in lane-server.mjs & agentEvalLane: host isolate immunity, codegen escape block, SSRF block, secret hygiene, and CPU hang SIGKILL recovery', async () => {
 globalThis.__CC_HOST_CANARY_SECRET = 'TOP_SECRET_HOST_ISOLATE_CANARY'
 process.env.CC_HOST_ENV_CANARY = 'TOP_SECRET_HOST_ENV_CANARY'

 const mem = new Map()
 const makeKv = (ns = '') => {
  const isHash = ns.includes('#')
  const qual = k => (isHash ? (ns.endsWith('#') ? `${ns}${k}` : `${ns}/${k}`) : (ns ? `${ns}.${k}` : k))
  return {
   namespace: name => makeKv(isHash ? qual(encodeKeySegment(name)) : qual(name)),
   hashNamespace: name => makeKv(`${encodeKeySegment(name)}#`),
   withBasePath: () => rootKv,
   async get(k) { const q = qual(k); return mem.has(q) ? mem.get(q) : null },
   async set(k, v) { mem.set(qual(k), String(v)) },
   async delete(k) { mem.delete(qual(k)) },
  }
 }
 const rootKv = makeKv()
 rootKv.defaultRoot = rootKv

 let laneSrv = null
 try {
  // 1. lane-server.mjs: verify untrusted HTTP handler runs in --permission subprocess, cannot touch host globals/env/FS/codegen/SSRF, and SIGKILLs infinite CPU loops without starving /_cc/health
  const srvLaneId = 'sec-srv-lane'
  await saveLaneScript(rootKv, rootKv.namespace(srvLaneId), srvLaneId, [
   `; to get (
    ; to { req } $argv
    [ match
     { [ propertyIs '/hang' req.path ] (
      ; while { true } ( ; to spin 1 )
     ) }
     { true (
      ; to fnEscape [ ; try ( !Array.constructor 'return process' ) : 'codegen-blocked' ]
      ; to localSsrf [ ; try ( !fetch 'http://127.0.0.1:3333/?key=secret' ) : 'loopback-ssrf-blocked' ]
      ; to metaSsrf [ ; try ( !fetch 'http://169.254.169.254/latest/meta-data/' ) : 'imds-ssrf-blocked' ]
      [ object
       { hostCanary $__CC_HOST_CANARY_SECRET }
       { proc $process }
       { buf $Buffer }
       { fnEscape $fnEscape }
       { localSsrf $localSsrf }
       { metaSsrf $metaSsrf }
      ]
     ) }
    ]
   )`,
  ], null)

  laneSrv = createLaneHttpServer({
   slug: 'sec-srv-lane',
   laneId: srvLaneId,
   logRequests: false,
   autoReload: false,
   limits: {
    maxLoopIterations: 0,
    maxSteps: 0,
    maxExecutionMs: 80,
   },
  }, { kv: rootKv })

  await laneSrv.reload()
  const addr = await laneSrv.listen(0, '127.0.0.1')
  const base = `http://127.0.0.1:${addr.port}`

  const secCheck = await fetch(`${base}/probe`).then(r => r.json())
  assert.equal(secCheck.hostCanary, undefined)
  assert.equal(secCheck.proc, undefined)
  assert.equal(secCheck.buf, undefined)
  assert.equal(secCheck.fnEscape, 'codegen-blocked')
  assert.equal(secCheck.localSsrf, 'loopback-ssrf-blocked')
  assert.equal(secCheck.metaSsrf, 'imds-ssrf-blocked')

  // Trigger 100% CPU synchronous infinite loop in /hang while concurrently polling /_cc/health on the host server
  const hangPromise = fetch(`${base}/hang`)
  await new Promise(r => setTimeout(r, 15))
  const healthStart = Date.now()
  const liveHealth = await fetch(`${base}/_cc/health`).then(r => r.json())
  const healthElapsed = Date.now() - healthStart
  assert.equal(liveHealth.ok, true, 'Host /_cc/health must remain responsive while child subprocess spins on CPU')
  assert.ok(healthElapsed < 200)

  const hangResp = await hangPromise
  assert.equal(hangResp.status, 504)
  const hangBody = await hangResp.json()
  assert.match(hangBody.error, /timed out/i)

  // Immediate recovery on next request using a fresh subprocess
  const afterHang = await fetch(`${base}/probe`)
  assert.equal(afterHang.status, 200)

  // 2. agentEvalLane: isolated subprocess evaluation, secret redaction + worker teardown, SSRF block, httpSimulation isolation, and timeout recovery
  await createNewSession(rootKv, null, { name: 'Sec Eval Session', laneIds: [], dataDir: null, dataDirConfirmed: true })
  const secretPlain = 'sk_live_SUPER_SECRET_VALUE_98765'
  const created = await agentCreateLane(rootKv, {
   title: 'Untrusted Agent Lane',
   lines: [
    '; to canary $__CC_HOST_CANARY_SECRET',
    '; to codegen [ ; try ( !Array.constructor \'return 1\' ) : \'blocked-eval\' ]',
    '; to ssrf [ ; try ( !fetch \'http://169.254.169.254/latest/meta-data/\' ) : \'blocked-imds\' ]',
    '; to leakedHeader [ ; add \'Bearer \' $apiSecret ]',
    '!console.log \'Using token:\' $apiSecret',
    '; to post ( ; to { req } $argv , ; object { echoed $req.body.v } { secretLen $apiSecret.length } )',
   ],
  })
  assert.equal(created.ok, true)

  const secSetRes = await agentMutateLaneInput(rootKv, {
   laneId: created.laneId,
   action: 'set-input',
   name: 'apiSecret',
   type: 'secret',
   value: secretPlain,
  })
  assert.equal(secSetRes.ok, true)

  const evalRes = await agentEvalLane(rootKv, {
   laneId: created.laneId,
   httpRequest: {
    method: 'POST',
    path: '/test',
    headers: { 'content-type': 'application/json' },
    body: { v: 77 },
   },
  })
  assert.equal(evalRes.ok, true)
  assert.equal(evalRes.errorCount, 0)

  const scopeMap = Object.fromEntries(evalRes.scope.map(e => [e.key, e]))
  assert.equal(scopeMap.canary.value, undefined)
  assert.equal(scopeMap.codegen.value, 'blocked-eval')
  assert.equal(scopeMap.ssrf.value, 'blocked-imds')
  assert.ok(!JSON.stringify(evalRes).includes(secretPlain), 'Plaintext secret must never appear anywhere in agentEvalLane output')
  assert.ok(scopeMap.leakedHeader.value.includes(SECRET_MASK))
  assert.ok(evalRes.logs[0].message.includes(SECRET_MASK))

  // Story snapshot recorded by agentEvalLane must also redact plaintext secrets
  const stories = await queryLaneStories(rootKv, rootKv.namespace(created.laneId), created.laneId, { limit: 5 })
  assert.equal(stories.entries.length, 1)
  assert.ok(!JSON.stringify(stories).includes(secretPlain), 'Plaintext secret must never be persisted to Story records')

  assert.ok(evalRes.httpSimulation)
  assert.equal(evalRes.httpSimulation.status, 200)
  assert.deepEqual(JSON.parse(evalRes.httpSimulation.bodyText), { echoed: 77, secretLen: secretPlain.length })

  // Hung inline lines override in agentEvalLane is hard-killed via SIGKILL on timeout and recovers cleanly
  const hungEval = await agentEvalLane(rootKv, {
   laneId: created.laneId,
   lines: ['; while { true } ( ; to spin 1 )'],
   limits: { maxLoopIterations: 0, maxSteps: 0 },
   timeoutMs: 60,
  })
  assert.equal(hungEval.ok, true)
  assert.equal(hungEval.errorCount, 1)
  assert.match(hungEval.lines[0].error, /timed out after 60ms \(worker terminated\)/)

  const recoveredEval = await agentEvalLane(rootKv, {
   laneId: created.laneId,
   lines: ['; add 20 22'],
  })
  assert.equal(recoveredEval.errorCount, 0)
  assert.equal(recoveredEval.lines[0].preview, '42')
 }
 finally {
  delete globalThis.__CC_HOST_CANARY_SECRET
  delete process.env.CC_HOST_ENV_CANARY
  if (laneSrv) {
   await laneSrv.close()
  }
  disposeIdleSourceWorkers()
 }
})
