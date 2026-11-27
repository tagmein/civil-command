import test from 'node:test'
import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import http from 'node:http'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'
import {
 DATA_RUNTIME_ENV,
 DEFAULT_AUTO_RELOAD_CONFIG,
 DEFAULT_PACKAGE_ID,
 DEFAULT_SERVER_LIMITS,
 LANE_TRIGGER_KEY_PREFIX,
 MAX_KV_VALUE_BYTES,
 NEW_LOG_HIGHLIGHT_FADE_MS,
 NEW_LOG_HIGHLIGHT_HOLD_MS,
 NEW_LOG_HIGHLIGHT_TOTAL_MS,
 PRIMITIVE_TYPES,
 TRIGGER_INTERNAL_PREFIX,
 agentListDeployments,
 allocateNextPort,
 buildPublicEndpointUrl,
 buildRequestObject,
 buildSshBaseArgs,
 collectLaneSyncBundle,
 computeLaneScriptHash,
 computeLaneSnapshotRevision,
 computeNewLogHighlightAlpha,
 computeWebSocketAccept,
 createIdleTracker,
 createLaneHttpServer,
 createResponseHelper,
 createTerminalBuffer,
 createTerminalManager,
 createTriggerStamp,
 defaultValueForType,
 deleteDeployServer,
 deleteLaneDeployment,
 deployedScriptKey,
 deploymentKey,
 dirModalSource,
 encodeKeyEventToVt,
 encodeKeySegment,
 encodeWsFrame,
 exportDeployModalSource,
 exportModalSource,
 extractSentinelEvents,
 field,
 formatImportLine,
 formatNewLogHighlightBg,
 formatRequestLogLine,
 generateCivilMemoryServerScript,
 generateDeployScript,
 generateInstallCivilMemoryScript,
 generateLocalControlMasterRunner,
 generateNginxDomainVhost,
 generateNginxRootConfig,
 generateNginxSharedRootFallbackConfig,
 generateNginxSubpathConfig,
 generateRemoteKvSyncScript,
 generateRemoteKvTestScript,
 generateServiceActionScript,
 generateSystemdUnit,
 generateUndeployScript,
 handleDeployApiRequest,
 hasImportCycle,
 httpKV,
 isAllowedLocalOrigin,
 isTriggerExcludedKey,
 laneServerSource,
 laneServersModalSource,
 laneStorySource,
 laneTerminalModalSource,
 laneTriggerKey,
 lineInfoModalSource,
 loadDeployServers,
 loadDeployments,
 loadLaneDeployment,
 loadLaneDeployments,
 loadLaneTables,
 mountTerminalView,
 normalizeAutoReloadConfig,
 normalizeCivilMemoryBaseUrl,
 normalizeClockHourFormat,
 normalizeClockShowSeconds,
 normalizeColumnConstraint,
 normalizeColumnWidth,
 normalizeDataColumnType,
 normalizeDomainName,
 normalizeHttpResult,
 normalizePrimitiveType,
 normalizeServerLimits,
 normalizeServiceSlug,
 normalizeSubpath,
 normalizeTriggerRules,
 packageModalSource,
 parse,
 parseImportLine,
 parseTriggerStamp,
 parseWsFrames,
 proxyDeployRequest,
 registerLaneInPackage,
 resolveImportValue,
 resolveMatchingTriggerTargets,
 resolveRequestIp,
 resolveScopeColumns,
 runLines,
 runTransportedScripts,
 saveDeployServer,
 saveLaneDeployment,
 saveLaneScript,
 saveLaneTables,
 sessionModalSource,
 shellQuote,
 simulateLaneRequest,
 tableRowKey,
 utf8ByteLength,
 validateSshTarget,
 withKvTriggers,
 writeLaneSyncBundleToKv,
} from './field.fixtures.mjs'

test('lane-http.mjs: request parsing, handler detection, hybrid expression fallback, respond envelope vs plain JSON, and mock simulator', async () => {
 const req = buildRequestObject({
  method: 'post',
  url: '/api/calc/users/Alice%20Smith?tag=a&tag=b&page=2',
  basePath: '/api/calc',
  headers: { 'Content-Type': 'application/json', 'X-Test': '1' },
  rawBody: '{"x":10}',
 })
 assert.equal(req.method, 'POST')
 assert.equal(req.originalPath, '/api/calc/users/Alice%20Smith')
 assert.equal(req.pathname, '/users/Alice%20Smith')
 assert.equal(req.path, '/users/Alice%20Smith')
 assert.deepEqual(req.segments, ['users', 'Alice Smith'])
 assert.deepEqual(req.query, { tag: ['a', 'b'], page: '2' })
 assert.equal(req.headers['x-test'], '1')
 assert.deepEqual(req.body, { x: 10 })
 assert.equal(typeof req.respond, 'function')

 // Normal plain object with a `status` key MUST NOT be mistaken for an HTTP response envelope
 const plainObj = normalizeHttpResult({ status: 'ok', count: 3 }, { cors: true, method: 'GET' })
 assert.equal(plainObj.status, 200)
 assert.deepEqual(JSON.parse(plainObj.bodyText), { status: 'ok', count: 3 })
 assert.equal(plainObj.headers['Access-Control-Allow-Origin'], '*')

 // Explicit respond helper sets status and custom headers
 const helper = createResponseHelper()
 const customRes = normalizeHttpResult(helper(201, { created: true }, { 'X-Custom': 'yes' }), { cors: true, method: 'POST' })
 assert.equal(customRes.status, 201)
 assert.equal(customRes.headers['X-Custom'], 'yes')
 assert.deepEqual(JSON.parse(customRes.bodyText), { created: true })

 // Mock simulator: handler lane with console logging, 405 + Allow, and OPTIONS preflight
 const handlerLines = [
  '; to get (\n ; to { r } $argv\n !console.log \'GET\' $r.path\n ; object { route $r.path } { q $r.query.q }\n)',
  '; to post (\n ; to { r } $argv\n !respond 201 [ object { received $r.body } ] [ object { X-Mode post } ]\n)',
 ]
 const getSim = await simulateLaneRequest({
  lines: handlerLines,
  req: { method: 'GET', path: '/items/7?q=abc' },
  forceFresh: true,
 })
 assert.equal(getSim.status, 200)
 assert.equal(getSim.mode, 'handler')
 assert.equal(getSim.handlerName, 'get')
 assert.deepEqual(getSim.detectedHandlers, ['GET', 'POST'])
 assert.deepEqual(JSON.parse(getSim.bodyText), { route: '/items/7', q: 'abc' })
 assert.equal(getSim.logs.some(l => l.message.includes('GET /items/7')), true)

 const postSim = await simulateLaneRequest({
  lines: handlerLines,
  req: { method: 'POST', path: '/items', rawBody: '{"n":5}' },
  forceFresh: true,
 })
 assert.equal(postSim.status, 201)
 assert.equal(postSim.headers['X-Mode'], 'post')
 assert.deepEqual(JSON.parse(postSim.bodyText), { received: { n: 5 } })

 const delSim = await simulateLaneRequest({
  lines: handlerLines,
  req: { method: 'DELETE', path: '/items/7' },
 })
 assert.equal(delSim.status, 405)
 assert.match(delSim.headers.Allow, /GET/)
 assert.match(delSim.headers.Allow, /POST/)

 const optSim = await simulateLaneRequest({
  lines: handlerLines,
  req: { method: 'OPTIONS', path: '/items' },
 })
 assert.equal(optSim.status, 204)

 // Mock simulator: hybrid expression-only lane returns last value as JSON (e.g. a number)
 const exprLines = [
  '-- pure calculation lane',
  '; to base 20',
  '; add $base 22',
 ]
 const exprGet = await simulateLaneRequest({
  lines: exprLines,
  req: { method: 'GET', path: '/' },
 })
 assert.equal(exprGet.status, 200)
 assert.equal(exprGet.mode, 'expression')
 assert.equal(JSON.parse(exprGet.bodyText), 42)

 const exprPost = await simulateLaneRequest({
  lines: exprLines,
  req: { method: 'POST', path: '/' },
 })
 assert.equal(exprPost.status, 405)
})

test('storage.mjs: server CRUD, deployment CRUD, allocateNextPort, collectLaneSyncBundle, and writeLaneSyncBundleToKv', async () => {
 assert.equal(normalizeServiceSlug('My Cool API!!'), 'my-cool-api')
 assert.equal(normalizeDomainName('API.Example.COM.'), 'api.example.com')
 assert.equal(normalizeDomainName('bad domain!'), '')
 assert.equal(normalizeSubpath('v1/calc/'), '/v1/calc')
 assert.equal(normalizeSubpath('/../etc'), '')
 assert.equal(buildPublicEndpointUrl({ routeMode: 'subpath', domain: 'api.example.com', subpath: '/calc', https: true }), 'https://api.example.com/calc')
 assert.equal(buildPublicEndpointUrl({ routeMode: 'domain', domain: 'calc.example.com', https: false }), 'http://calc.example.com')

 const mem = new Map()
 const makeStoreKv = (ns = '') => {
  const isHash = ns.includes('#')
  const qual = k => (isHash ? (ns.endsWith('#') ? `${ns}${k}` : `${ns}/${k}`) : (ns ? `${ns}.${k}` : k))
  const c = {
   namespace: name => makeStoreKv(isHash ? qual(encodeKeySegment(name)) : qual(name)),
   hashNamespace: name => makeStoreKv(`${encodeKeySegment(name)}#`),
   async get(k) { const q = qual(k); return mem.has(q) ? mem.get(q) : null },
   async set(k, v) { const s = String(v); assert.ok(utf8ByteLength(s) <= MAX_KV_VALUE_BYTES); mem.set(qual(k), s) },
   async delete(k) { mem.delete(qual(k)) },
  }
  return c
 }
 const srcKv = makeStoreKv()

 const srv1 = await saveDeployServer(srcKv, {
  name: 'Prod Box',
  host: 'prod.example.com',
  user: 'deploy',
  sshPort: 2222,
  defaultDomain: 'api.example.com',
  civilMemoryMode: 'local',
  civilMemoryPort: 3333,
 })
 const srv2 = await saveDeployServer(srcKv, {
  name: 'Staging Box',
  host: 'staging.example.com',
  civilMemoryMode: 'external',
  civilMemoryUrl: 'https://kv.staging.example.com',
 })
 const servers = await loadDeployServers(srcKv)
 assert.equal(servers.length, 2)
 assert.equal(servers[0].host, 'prod.example.com')
 await deleteDeployServer(srcKv, srv2.id)
 assert.equal((await loadDeployServers(srcKv)).length, 1)

 const d1 = await saveLaneDeployment(srcKv, {
  laneId: 'lane-a',
  title: 'Lane A',
  serverId: srv1.id,
  slug: 'lane-a',
  port: 4100,
  routeMode: 'subpath',
  domain: 'api.example.com',
  subpath: '/lane-a',
  civilMemoryUrl: 'http://127.0.0.1:3333',
  dataBasePath: '/opt/civil-command/lane-a/data',
  kvReady: true,
 })
 assert.equal((await loadLaneDeployment(srcKv, 'lane-a')).port, 4100)
 assert.equal(allocateNextPort(await loadDeployments(srcKv), srv1.id, 4100), 4101)

 // Seed two lanes where main-lane imports helper-lane, plus a Data table and Input defaults
 const helperId = 'helper-lane-1'
 const mainId = 'main-lane-1'
 await srcKv.namespace(helperId).set('title', 'Helper')
 await saveLaneScript(srcKv, srcKv.namespace(helperId), helperId, ['; to factor 10'], null)
 await srcKv.namespace(mainId).set('title', 'Main API')
 await srcKv.namespace(mainId).set('inputs', JSON.stringify([{ name: 'offset', type: 'number' }]))
 await saveLaneScript(srcKv, srcKv.namespace(mainId), mainId, [
  `; to dep !importLane ${helperId} factor`,
  '; add $dep 32',
 ], null)
 await saveLaneTables(srcKv, srcKv.namespace(mainId), mainId, [{
  id: 'tbl-1',
  name: 'items',
  columns: [{ id: 'col-1', name: 'name', type: 'text', multiple: false }],
  rows: [{ id: 'row-1', values: { 'col-1': 'alpha' } }],
 }])

 const bundleNoImports = await collectLaneSyncBundle(srcKv, mainId, { includeImports: false })
 assert.deepEqual(bundleNoImports.lanes.map(l => l.id), [mainId])

 const bundleWithImports = await collectLaneSyncBundle(srcKv, mainId, { includeImports: true })
 assert.deepEqual(bundleWithImports.lanes.map(l => l.id), [mainId, helperId])

 const dstMem = new Map()
 const makeDstKv = (ns = '') => {
  const isHash = ns.includes('#')
  const qual = k => (isHash ? (ns.endsWith('#') ? `${ns}${k}` : `${ns}/${k}`) : (ns ? `${ns}.${k}` : k))
  return {
   namespace: name => makeDstKv(isHash ? qual(encodeKeySegment(name)) : qual(name)),
   hashNamespace: name => makeDstKv(`${encodeKeySegment(name)}#`),
   async get(k) { const q = qual(k); return dstMem.has(q) ? dstMem.get(q) : null },
   async set(k, v) { dstMem.set(qual(k), String(v)) },
   async delete(k) { dstMem.delete(qual(k)) },
  }
 }
 const dstKv = makeDstKv()
 const syncRes = await writeLaneSyncBundleToKv(dstKv, bundleWithImports, null)
 assert.equal(syncRes.ok, true)
 assert.equal(syncRes.laneCount, 2)
 assert.equal(await dstKv.namespace(mainId).get('title'), 'Main API')
 assert.equal((await loadLaneTables(dstKv, dstKv.namespace(mainId), mainId))[0].rows[0].values['col-1'], 'alpha')
 await deleteLaneDeployment(srcKv, d1.laneId)
 assert.equal(await loadLaneDeployment(srcKv, 'lane-a'), null)
})

test('lane-server.mjs: end-to-end HTTP microservice backed by loopback civil-memory with handlers, expression return, Data tables, KV, and optional imports', async () => {
 const kvByBase = new Map()
 const getBucket = base => {
  const k = base || '__default__'
  let m = kvByBase.get(k)
  if (!m) {
   m = new Map()
   kvByBase.set(k, m)
  }
  return m
 }

 const cmServer = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', 'http://127.0.0.1')
  if (url.pathname === '/health' && req.method === 'GET') {
   res.writeHead(200, { 'Content-Type': 'application/json' })
   res.end(JSON.stringify({ ok: true }))
   return
  }
  const key = url.searchParams.get('key')
  const basePath = url.searchParams.get('modeOptions.disk.basePath') || ''
  const bucket = getBucket(basePath)
  if (req.method === 'GET') {
   if (!bucket.has(key)) {
    res.writeHead(404)
    res.end('Not found')
    return
   }
   res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' })
   res.end(bucket.get(key))
   return
  }
  if (req.method === 'POST') {
   const chunks = []
   for await (const ch of req) { chunks.push(ch) }
   bucket.set(key, Buffer.concat(chunks).toString('utf8'))
   res.writeHead(200)
   res.end('ok')
   return
  }
  if (req.method === 'DELETE') {
   bucket.delete(key)
   res.writeHead(200)
   res.end('ok')
   return
  }
  res.writeHead(405)
  res.end('Method not allowed')
 })
 await new Promise(resolve => cmServer.listen(0, '127.0.0.1', resolve))
 const cmPort = cmServer.address().port
 const cmUrl = `http://127.0.0.1:${cmPort}`
 const basePath = '/opt/civil-command/calc-api/data'
 const remoteKv = httpKV({ baseUrl: normalizeCivilMemoryBaseUrl(cmUrl), basePath, switchable: false })

 const depId = 'dep-lane-e2e'
 const apiId = 'api-lane-e2e'
 const exprId = 'expr-lane-e2e'

 try {
  // Seed helper lane + API handler lane + pure expression lane into civil-memory under basePath
  await writeLaneSyncBundleToKv(remoteKv, {
   mainLaneId: apiId,
   includeImports: true,
   lanes: [
    {
     id: apiId,
     title: 'API Lane',
     inputsRaw: JSON.stringify([{ name: 'bonus', type: 'number' }]),
     records: [
      { id: 'l1', text: `; to dep !importLane ${depId} val`, updatedAt: null },
      {
       id: 'l2',
       text: '; to get (\n ; to { req } $argv\n ; to hits [ !data.get hits ]\n ; to next ; add [ match { $hits : !JSON.parse $hits } { true : 0 } ] 1\n !data.set hits [ ; add \'\' $next ]\n ; object { path $req.path } { role $req.query.role } { dep $dep } { bonus $bonus } { hits $next } { firstItem $items.0.label }\n)',
       updatedAt: null,
      },
      {
       id: 'l3',
       text: '; to post (\n ; to { req } $argv\n !respond 201 [ object { echoed $req.body } ] [ object { X-Lane api } ]\n)',
       updatedAt: null,
      },
     ],
     tables: [{
      id: 't1',
      name: 'items',
      columns: [{ id: 'c1', name: 'label', type: 'text', multiple: false }],
      rows: [{ id: 'r1', values: { c1: 'widget' } }],
     }],
    },
    {
     id: depId,
     title: 'Dep Lane',
     inputsRaw: null,
     records: [{ id: 'd1', text: '; to val 99', updatedAt: null }],
     tables: [],
    },
    {
     id: exprId,
     title: 'Expr Lane',
     inputsRaw: null,
     records: [
      { id: 'e1', text: '; to x 20', updatedAt: null },
      { id: 'e2', text: '; add $x 22', updatedAt: null },
     ],
     tables: [],
    },
   ],
  })

  // 1. Start API server with includeImports=false -> importLane returns undefined without breaking
  const loggedLines = []
  const loggedEvents = []
  const apiNoImp = createLaneHttpServer({
   slug: 'api-no-imp',
   laneId: apiId,
   civilMemoryUrl: cmUrl,
   dataBasePath: basePath,
   includeImports: false,
   basePath: '/api',
  }, {
   logger: {
    log: line => loggedLines.push(line),
    info: () => {},
    warn: () => {},
    error: () => {},
   },
   onRequestLog: entry => loggedEvents.push(entry),
  })
  await apiNoImp.reload()
  const addr1 = await apiNoImp.listen(0, '127.0.0.1')

  try {
   const healthRes = await fetch(`http://127.0.0.1:${addr1.port}/_cc/health`).then(r => r.json())
   assert.equal(healthRes.ok, true)
   assert.equal(healthRes.mode, 'handler')
   assert.deepEqual(healthRes.handlers, ['GET', 'POST'])

   const g1 = await fetch(`http://127.0.0.1:${addr1.port}/api/users/7?role=admin`, {
    headers: { 'X-Forwarded-For': '203.0.113.42, 10.0.0.1' },
   })
   assert.equal(g1.status, 200)
   const g1Body = await g1.json()
   assert.equal(g1Body.path, '/users/7')
   assert.equal(g1Body.role, 'admin')
   assert.equal(g1Body.dep, undefined)
   assert.equal(g1Body.bonus, 0)
   assert.equal(g1Body.hits, 1)
   assert.equal(g1Body.firstItem, 'widget')

   const p1 = await fetch(`http://127.0.0.1:${addr1.port}/api/items`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Real-IP': '198.51.100.77' },
    body: JSON.stringify({ name: 'bolt' }),
   })
   assert.equal(p1.status, 201)
   assert.equal(p1.headers.get('x-lane'), 'api')
   assert.deepEqual(await p1.json(), { echoed: { name: 'bolt' } })

   const d1 = await fetch(`http://127.0.0.1:${addr1.port}/api/items`, { method: 'DELETE' })
   assert.equal(d1.status, 405)

   // Verify KV state persisted on disk bucket for that exact basePath
   assert.equal(getBucket(basePath).get(`${apiId}.hits`), '1')

   // Verify realtime request logs include slug, method, path, status, duration, and source IP
   assert.equal(loggedLines.length, 4)
   assert.match(loggedLines[0], /^\[civil-lane:api-no-imp\] GET \/_cc\/health -> 200 \(\d+ms\) ip=127\.0\.0\.1$/)
   assert.match(loggedLines[1], /^\[civil-lane:api-no-imp\] GET \/users\/7\?role=admin -> 200 \(\d+ms\) ip=203\.0\.113\.42$/)
   assert.match(loggedLines[2], /^\[civil-lane:api-no-imp\] POST \/items -> 201 \(\d+ms\) ip=198\.51\.100\.77$/)
   assert.match(loggedLines[3], /^\[civil-lane:api-no-imp\] DELETE \/items -> 405 \(\d+ms\) ip=127\.0\.0\.1$/)
   assert.equal(loggedEvents[1].ip, '203.0.113.42')
   assert.equal(loggedEvents[1].method, 'GET')
   assert.equal(loggedEvents[1].path, '/users/7?role=admin')
   assert.equal(loggedEvents[1].status, 200)
   assert.equal(resolveRequestIp({ headers: { 'cf-connecting-ip': '192.0.2.9' }, remoteAddress: '::ffff:127.0.0.1' }), '192.0.2.9')
   assert.equal(resolveRequestIp({ remoteAddress: '::ffff:127.0.0.1' }), '127.0.0.1')
   assert.equal(
    formatRequestLogLine({ slug: 'beacon', method: 'GET', path: '/balance', status: 200, durationMs: 3, ip: '203.0.113.5' }),
    '[civil-lane:beacon] GET /balance -> 200 (3ms) ip=203.0.113.5'
   )
  }
  finally {
   await apiNoImp.close()
  }

  // 2. Start with includeImports=true -> importLane resolves dep=99; test /_cc/reload
  const apiWithImp = createLaneHttpServer({
   slug: 'api-with-imp',
   laneId: apiId,
   civilMemoryUrl: cmUrl,
   dataBasePath: basePath,
   includeImports: true,
  })
  await apiWithImp.reload()
  const addr2 = await apiWithImp.listen(0, '127.0.0.1')
  try {
   const g2 = await fetch(`http://127.0.0.1:${addr2.port}/status`).then(r => r.json())
   assert.equal(g2.dep, 99)
   assert.equal(g2.hits, 2)

   // Mutate dep lane in KV and call /_cc/reload
   await saveLaneScript(remoteKv, remoteKv.namespace(depId), depId, ['; to val 123'], null)
   const reloadRes = await fetch(`http://127.0.0.1:${addr2.port}/_cc/reload`, { method: 'POST' }).then(r => r.json())
   assert.equal(reloadRes.ok, true)
   const g3 = await fetch(`http://127.0.0.1:${addr2.port}/status`).then(r => r.json())
   assert.equal(g3.dep, 123)
  }
  finally {
   await apiWithImp.close()
  }

  // 3. Pure expression lane -> GET / returns 42 as JSON
  const exprServer = createLaneHttpServer({
   slug: 'expr-calc',
   laneId: exprId,
   civilMemoryUrl: cmUrl,
   dataBasePath: basePath,
   includeImports: false,
  })
  await exprServer.reload()
  const addr3 = await exprServer.listen(0, '127.0.0.1')
  try {
   const h = await fetch(`http://127.0.0.1:${addr3.port}/_cc/health`).then(r => r.json())
   assert.equal(h.mode, 'expression')
   const valResp = await fetch(`http://127.0.0.1:${addr3.port}/`)
   assert.equal(valResp.status, 200)
   assert.match(valResp.headers.get('content-type'), /application\/json/)
   assert.equal(await valResp.json(), 42)
   const postResp = await fetch(`http://127.0.0.1:${addr3.port}/`, { method: 'POST' })
   assert.equal(postResp.status, 405)
  }
  finally {
   await exprServer.close()
  }
 }
 finally {
  if (typeof cmServer.closeAllConnections === 'function') {
   cmServer.closeAllConnections()
  }
  await new Promise(resolve => cmServer.close(resolve))
 }
})

test('pty-terminal.mjs: WebSocket RFC 6455 framing and live Python PTY session over loopback WebSocket', async () => {
 assert.equal(computeWebSocketAccept('dGhlIHNhbXBsZSBub25jZQ=='), 's3pPLMBiTxaQ9kYGzzhZRbK+xOo=')
 const frame = encodeWsFrame(0x1, 'hello ws')
 const parsed = parseWsFrames(frame)
 assert.equal(parsed.frames.length, 1)
 assert.equal(parsed.frames[0].opcode, 0x1)
 assert.equal(parsed.frames[0].payload.toString('utf8'), 'hello ws')
 assert.equal(parsed.remainder.length, 0)

 // Masked client frame helper
 function encodeMaskedTextFrame(text) {
  const payload = Buffer.from(text, 'utf8')
  const mask = crypto.randomBytes(4)
  const len = payload.length
  const header = len < 126
   ? Buffer.from([0x81, 0x80 | len])
   : Buffer.from([0x81, 0x80 | 126, (len >> 8) & 0xff, len & 0xff])
  const masked = Buffer.allocUnsafe(len)
  for (let i = 0; i < len; i++) {
   masked[i] = payload[i] ^ mask[i & 3]
  }
  return Buffer.concat([header, mask, masked])
 }

 const termMgr = createTerminalManager()
 const server = http.createServer((_req, res) => {
  res.writeHead(404)
  res.end()
 })
 server.on('upgrade', (req, socket, head) => {
  const u = new URL(req.url || '/', 'http://127.0.0.1')
  termMgr.attachWebSocket(u.searchParams.get('id'), req, socket, head)
 })
 await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
 const port = server.address().port

 // Spawn an interactive Python readline prompt inside a real PTY
 const pyCode = 'import sys; sys.stdout.write("PROMPT:"); sys.stdout.flush(); line = sys.stdin.readline().strip(); print("GOT:" + line)'
 const session = termMgr.createSession({
  title: 'PTY Test',
  command: 'python3',
  args: ['-u', '-c', pyCode],
  cols: 80,
  rows: 24,
 })

 try {
  const messages = await new Promise((resolve, reject) => {
   const client = net.connect(port, '127.0.0.1')
   const key = crypto.randomBytes(16).toString('base64')
   const expectedAccept = computeWebSocketAccept(key)
   const received = []
   let handshakeDone = false
   let buf = Buffer.alloc(0)
   let sentInput = false

   const timer = setTimeout(() => {
    client.destroy()
    reject(new Error(`PTY WebSocket test timed out. Received: ${JSON.stringify(received)}`))
   }, 8000)

   client.on('error', err => {
    clearTimeout(timer)
    reject(err)
   })

   client.on('connect', () => {
    client.write(
     `GET /api/deploy/terminal/ws?id=${encodeURIComponent(session.id)} HTTP/1.1\r\n` +
     `Host: 127.0.0.1:${port}\r\n` +
     'Upgrade: websocket\r\n' +
     'Connection: Upgrade\r\n' +
     `Sec-WebSocket-Key: ${key}\r\n` +
     'Sec-WebSocket-Version: 13\r\n\r\n'
    )
   })

   client.on('data', chunk => {
    buf = Buffer.concat([buf, chunk])
    if (!handshakeDone) {
     const endIdx = buf.indexOf('\r\n\r\n')
     if (endIdx === -1) {
      return
     }
     const hdr = buf.subarray(0, endIdx).toString('utf8')
     assert.match(hdr, /101 Switching Protocols/)
     assert.ok(hdr.includes(expectedAccept))
     handshakeDone = true
     buf = buf.subarray(endIdx + 4)
    }
    if (buf.length > 0) {
     const res = parseWsFrames(buf)
     buf = res.remainder
     for (const fr of res.frames) {
      if (fr.opcode === 0x1) {
       const msg = JSON.parse(fr.payload.toString('utf8'))
       received.push(msg)
       if (!sentInput && msg.type === 'output' && msg.data.includes('PROMPT:')) {
        sentInput = true
        client.write(encodeMaskedTextFrame(JSON.stringify({ type: 'resize', cols: 110, rows: 32 })))
        client.write(encodeMaskedTextFrame(JSON.stringify({ type: 'input', data: 'secret123\r' })))
       }
       if (msg.type === 'status' && msg.status === 'exited') {
        clearTimeout(timer)
        client.end()
        resolve(received)
       }
      }
     }
    }
   })
  })

  assert.equal(messages[0].type, 'init')
  const combinedOut = messages.filter(m => m.type === 'output').map(m => m.data).join('')
  assert.match(combinedOut, /PROMPT:/)
  assert.match(combinedOut, /GOT:secret123/)
  const exitMsg = messages.find(m => m.type === 'status' && m.status === 'exited')
  assert.equal(exitMsg.exitCode, 0)
 }
 finally {
  termMgr.killAll()
  if (typeof server.closeAllConnections === 'function') {
   server.closeAllConnections()
  }
  await new Promise(resolve => server.close(resolve))
 }
})

test('deploy-api.mjs: validation, bash -n checked script generation, Nginx/systemd templates, and HTTP routes', async () => {
 assert.equal(shellQuote("a'b"), "'a'\\''b'")
 assert.throws(() => validateSshTarget({ host: '-oProxyCommand=evil', user: 'root' }))
 assert.throws(() => validateSshTarget({ host: 'example.com;rm -rf /', user: 'root' }))
 assert.throws(() => validateSshTarget({ host: 'example.com', user: 'root id' }))
 assert.throws(() => validateSshTarget({ host: 'example.com', user: 'root', sshPort: 70000 }))
 assert.deepEqual(buildSshBaseArgs({ host: 'example.com', user: 'deploy', sshPort: 2222, identityFile: '/tmp/key' }), ['-p', '2222', '-i', '/tmp/key'])

 const unit = generateSystemdUnit({ slug: 'calc-api', title: 'Calc API' })
 assert.match(unit, /WorkingDirectory=\/opt\/civil-command\/calc-api/)
 assert.match(unit, /ExecStart=.*\/opt\/civil-command\/calc-api\/lane-server\.mjs --config \/opt\/civil-command\/calc-api\/config\.json/)
 assert.match(unit, /^DynamicUser=yes$/m)
 assert.match(unit, /^NoNewPrivileges=yes$/m)
 assert.match(unit, /^ProtectSystem=strict$/m)
 assert.match(unit, /^ProtectHome=yes$/m)
 assert.match(unit, /^PrivateTmp=yes$/m)
 assert.match(unit, /^PrivateDevices=yes$/m)
 assert.match(unit, /^ProtectKernelTunables=yes$/m)
 assert.match(unit, /^ProtectKernelModules=yes$/m)
 assert.match(unit, /^ProtectControlGroups=yes$/m)
 assert.match(unit, /^RestrictSUIDSGID=yes$/m)
 assert.match(unit, /^CapabilityBoundingSet=$/m)
 assert.match(unit, /^RestrictAddressFamilies=AF_UNIX AF_INET AF_INET6$/m)
 assert.match(unit, /^SocketBindAllow=ipv4:tcp$/m)
 assert.match(unit, /^SocketBindDeny=any$/m)
 assert.match(unit, /^IPAddressDeny=.*localhost.*link-local.*169\.254\.169\.254\/32.*fd00:ec2::254\/128/m)
 assert.doesNotMatch(unit, /^IPAddressAllow=/m)

 const portBoundUnit = generateSystemdUnit({ slug: 'calc-api', title: 'Calc API', port: 4100, allowLoopback: true })
 assert.match(portBoundUnit, /^SocketBindAllow=ipv4:tcp:4100$/m)
 assert.match(portBoundUnit, /^IPAddressAllow=127\.0\.0\.1\/32$/m)
 assert.match(portBoundUnit, /^IPAddressDeny=.*localhost.*link-local.*169\.254\.169\.254\/32/m)

 const subNginx = generateNginxSubpathConfig({ slug: 'calc-api', port: 4100, subpath: '/calc' })
 assert.match(subNginx, /location = \/calc \{/)
 assert.match(subNginx, /proxy_pass http:\/\/127\.0\.0\.1:4100;/)
 assert.match(subNginx, /proxy_pass http:\/\/127\.0\.0\.1:4100\/;/)
 assert.match(subNginx, /X-Forwarded-Prefix \/calc;/)

 const rootNginx = generateNginxRootConfig({ slug: 'calc-api', port: 4100 })
 assert.match(rootNginx, /proxy_pass http:\/\/127\.0\.0\.1:4100;/)

 const vhost = generateNginxDomainVhost({ domain: 'api.example.com' })
 assert.match(vhost, /server_name api\.example\.com;/)
 assert.match(vhost, /include \/etc\/nginx\/civil-command\/api\.example\.com\.d\/\*\.conf;/)

 const sharedFallback = generateNginxSharedRootFallbackConfig({ domain: 'data.nateferrero.com' })
 assert.match(sharedFallback, /location \/ \{/)
 assert.match(sharedFallback, /default_type application\/json;/)
 assert.match(sharedFallback, /return 404 '/)
 assert.match(sharedFallback, /data\.nateferrero\.com/)

 const runtimeFiles = {
  'field.mjs': 'export const ok = 1',
  'data.mjs': 'export const ok = 2',
  'storage.mjs': 'export const ok = 3',
  'sandbox.mjs': 'export const ok = 6',
  'source-worker.mjs': 'export const ok = 7',
  'lane-http.mjs': 'export const ok = 4',
  'lane-server.mjs': 'export const ok = 5',
 }

 const cmInstallScript = generateInstallCivilMemoryScript({
  port: 3333,
  exposeDomain: 'kv.example.com',
  enableLetsEncrypt: true,
  letsEncryptEmail: 'admin@example.com',
 })
 assert.match(cmInstallScript, /https:\/\/github\.com\/tagmein\/civil-memory\.git/)
 assert.match(cmInstallScript, /__CC_CIVIL_MEMORY_READY__/)

 const deployScript = generateDeployScript({
  slug: 'calc-api',
  laneId: 'lane-1',
  title: 'Calc API',
  port: 4100,
  routeMode: 'subpath',
  domain: 'api.example.com',
  subpath: '/calc',
  enableLetsEncrypt: true,
  letsEncryptEmail: 'ops@example.com',
  civilMemoryUrl: 'http://127.0.0.1:3333',
  dataBasePath: '/opt/civil-command/calc-api/data',
  includeImports: false,
  runtimeFiles,
  syncBundle: { mainLaneId: 'lane-1', includeImports: false, lanes: [{ id: 'lane-1', title: 'Calc', records: [], tables: [] }] },
 })
 assert.match(deployScript, /apt-get install -y nginx/)
 assert.match(deployScript, /dnf install -y nginx/)
 assert.match(deployScript, /yum install -y nginx/)
 assert.match(deployScript, /sites-available/)
 assert.match(deployScript, /conf\.d/)
 assert.match(deployScript, /Initializing shared Nginx vhost/)
 assert.match(deployScript, /sudo mkdir -p "\$\(dirname "\$CC_AVAIL"\)"/)
 assert.match(deployScript, /zz-shared-root\.conf/)
 assert.match(deployScript, /CC_IS_MANAGED_VHOST/)
 assert.match(deployScript, /CC_CREATED_NEW_VHOST/)
 assert.match(deployScript, /systemctl is-active --quiet nginx/)
 assert.match(deployScript, /apt-get install -y certbot python3-certbot-nginx/)
 assert.match(deployScript, /ssl_certificate/)
 assert.match(deployScript, /cc-bak/)
 assert.match(deployScript, /certbot/)
 assert.match(deployScript, /sandbox\.mjs/)
 assert.match(deployScript, /source-worker\.mjs/)
 assert.match(deployScript, /chmod 644/)
 assert.match(deployScript, /__CC_DEPLOY_OK__/)

 const deployRootScript = generateDeployScript({
  slug: 'root-api',
  laneId: 'lane-2',
  title: 'Root API',
  port: 4101,
  routeMode: 'domain',
  domain: 'api.example.com',
  enableLetsEncrypt: false,
  civilMemoryUrl: 'http://127.0.0.1:3333',
  runtimeFiles,
 })
 assert.match(deployRootScript, /rm -f "\/etc\/nginx\/civil-command\/api\.example\.com\.d\/zz-shared-root\.conf"/)
 assert.match(deployRootScript, /00-root-root-api\.conf/)

 const undeployScript = generateUndeployScript({ slug: 'calc-api', domain: 'api.example.com', routeMode: 'subpath' })
 assert.match(undeployScript, /__CC_UNDEPLOY_OK__/)
 const undeployRootScript = generateUndeployScript({ slug: 'root-api', domain: 'api.example.com', routeMode: 'domain' })
 assert.match(undeployRootScript, /zz-shared-root\.conf/)
 assert.match(undeployRootScript, /systemctl is-active --quiet nginx/)

 const testKvScript = generateRemoteKvTestScript({ url: 'http://127.0.0.1:3333', basePath: '/opt/civil-command/data' })
 const syncKvScript = generateRemoteKvSyncScript({ url: 'http://127.0.0.1:3333', basePath: '/opt/civil-command/data', bundle: { lanes: [] }, runtimeFiles })
 const svcScript = generateServiceActionScript({ slug: 'calc-api', action: 'restart', port: 4100 })
 const svcLogsWithRuntimeScript = generateServiceActionScript({
  slug: 'calc-api',
  action: 'logs',
  port: 4100,
  runtimeFiles,
 })
 assert.match(svcLogsWithRuntimeScript, /CC_RUNTIME_UPDATED/)
 assert.match(svcLogsWithRuntimeScript, /journalctl -u 'civil-lane-calc-api\.service' -n 80 --no-pager/)
 assert.match(svcLogsWithRuntimeScript, /__CC_LOGS_FOLLOW__/)
 assert.match(svcLogsWithRuntimeScript, /exec sudo journalctl -u 'civil-lane-calc-api\.service' -n 0 -f/)
 const runnerScript = generateLocalControlMasterRunner({ target: { host: 'example.com', user: 'deploy', sshPort: 22 }, localScriptPath: '/tmp/x.sh', sessionId: 'abc12345' })
 assert.match(runnerScript, /"\$SSH_DEST" "bash/)

 // Validate every generated bash script with `bash -n`
 for (const [label, scriptText] of [
  ['cmInstall', cmInstallScript],
  ['deploySubpath', deployScript],
  ['deployDomain', deployRootScript],
  ['undeploySubpath', undeployScript],
  ['undeployDomain', undeployRootScript],
  ['testKv', testKvScript],
  ['syncKv', syncKvScript],
  ['svc', svcScript],
  ['svcLogsWithRuntime', svcLogsWithRuntimeScript],
  ['runner', runnerScript],
 ]) {
  const chk = spawnSync('bash', ['-n'], { input: scriptText, encoding: 'utf8' })
  assert.equal(chk.status, 0, `${label} script failed bash -n: ${chk.stderr}`)
 }

 // Verify generated Python Nginx vhost scanner handles boundaries, comments, and skips dotfiles/backups
 const pyMatch = deployScript.match(/<<'PYEOF'\n([\s\S]*?)\nPYEOF/)
 assert.ok(pyMatch, 'Expected Python vhost scanner in deploy script')
 const scannerDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cc-ngx-scan-'))
 try {
  await fs.writeFile(path.join(scannerDir, '.hidden.conf'), 'server { server_name data.nateferrero.com; }')
  await fs.writeFile(path.join(scannerDir, 'other.conf.cc-bak.123'), 'server { server_name data.nateferrero.com; }')
  await fs.writeFile(path.join(scannerDir, '01-commented.conf'), '# server_name data.nateferrero.com;\nserver { server_name sub.data.nateferrero.com; }\n')
  const missScan = spawnSync('python3', ['-', 'data.nateferrero.com', scannerDir], { input: pyMatch[1], encoding: 'utf8' })
  assert.equal(missScan.status, 0)
  assert.equal(missScan.stdout.trim(), '')

  const matchFile = path.join(scannerDir, '02-shared.conf')
  await fs.writeFile(matchFile, 'server {\n server_name a.com data.nateferrero.com;\n}\n')
  const hitScan = spawnSync('python3', ['-', 'data.nateferrero.com', scannerDir], { input: pyMatch[1], encoding: 'utf8' })
  assert.equal(hitScan.status, 0)
  assert.equal(hitScan.stdout.trim(), await fs.realpath(matchFile))
 }
 finally {
  await fs.rm(scannerDir, { recursive: true, force: true })
 }

 // HTTP API tests for /api/deploy/kv/test, /api/deploy/kv/sync, /api/deploy/proxy, and cross-origin 403
 const kvStore = new Map()
 const cmMock = http.createServer(async (req, res) => {
  const u = new URL(req.url || '/', 'http://127.0.0.1')
  const key = u.searchParams.get('key')
  const base = u.searchParams.get('modeOptions.disk.basePath') || ''
  const q = `${base}::${key}`
  if (req.method === 'GET') {
   if (!kvStore.has(q)) { res.writeHead(404); res.end(); return }
   res.writeHead(200)
   res.end(kvStore.get(q))
   return
  }
  if (req.method === 'POST') {
   const chunks = []
   for await (const c of req) { chunks.push(c) }
   kvStore.set(q, Buffer.concat(chunks).toString('utf8'))
   res.writeHead(200)
   res.end('ok')
   return
  }
  if (req.method === 'DELETE') {
   kvStore.delete(q)
   res.writeHead(200)
   res.end('ok')
   return
  }
  res.writeHead(404)
  res.end()
 })
 const echoMock = http.createServer(async (req, res) => {
  const chunks = []
  for await (const c of req) { chunks.push(c) }
  res.writeHead(200, { 'Content-Type': 'application/json', 'X-Echo': '1' })
  res.end(JSON.stringify({ method: req.method, path: req.url, body: Buffer.concat(chunks).toString('utf8') }))
 })
 await Promise.all([
  new Promise(r => cmMock.listen(0, '127.0.0.1', r)),
  new Promise(r => echoMock.listen(0, '127.0.0.1', r)),
 ])
 const apiServer = http.createServer((req, res) => {
  handleDeployApiRequest(req, res)
 })
 await new Promise(r => apiServer.listen(0, '127.0.0.1', r))
 const apiPort = apiServer.address().port
 const cmBase = `http://127.0.0.1:${cmMock.address().port}`
 const echoBase = `http://127.0.0.1:${echoMock.address().port}`

 try {
  assert.equal(isAllowedLocalOrigin({ headers: { origin: 'https://evil.example', host: 'localhost:8080' } }), false)
  assert.equal(isAllowedLocalOrigin({ headers: { origin: 'http://localhost:8080', host: 'localhost:8080' } }), true)

  const evilRes = await fetch(`http://127.0.0.1:${apiPort}/api/deploy/kv/test`, {
   method: 'POST',
   headers: { 'Content-Type': 'application/json', Origin: 'https://evil.example' },
   body: JSON.stringify({ url: cmBase }),
  })
  assert.equal(evilRes.status, 403)

  const kvTestOk = await fetch(`http://127.0.0.1:${apiPort}/api/deploy/kv/test`, {
   method: 'POST',
   headers: { 'Content-Type': 'application/json' },
   body: JSON.stringify({ url: cmBase, basePath: '/opt/test/data' }),
  }).then(r => r.json())
  assert.equal(kvTestOk.ok, true)

  const kvSyncOk = await fetch(`http://127.0.0.1:${apiPort}/api/deploy/kv/sync`, {
   method: 'POST',
   headers: { 'Content-Type': 'application/json' },
   body: JSON.stringify({
    url: cmBase,
    basePath: '/opt/test/data',
    bundle: { mainLaneId: 'lane-z', includeImports: false, lanes: [{ id: 'lane-z', title: 'Z', inputsRaw: null, records: [{ id: 'z1', text: '42', updatedAt: null }], tables: [] }] },
   }),
  }).then(r => r.json())
  assert.equal(kvSyncOk.ok, true)
  assert.equal(kvStore.get('/opt/test/data::lane-z.title'), 'Z')

  const proxyRes = await fetch(`http://127.0.0.1:${apiPort}/api/deploy/proxy`, {
   method: 'POST',
   headers: { 'Content-Type': 'application/json' },
   body: JSON.stringify({ url: `${echoBase}/hello?a=1`, method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"v":7}' }),
  }).then(r => r.json())
  assert.equal(proxyRes.ok, true)
  assert.equal(proxyRes.status, 200)
  assert.equal(proxyRes.headers['x-echo'], '1')
  assert.deepEqual(JSON.parse(proxyRes.bodyText), { method: 'POST', path: '/hello?a=1', body: '{"v":7}' })
 }
 finally {
  if (typeof apiServer.closeAllConnections === 'function') { apiServer.closeAllConnections() }
  if (typeof cmMock.closeAllConnections === 'function') { cmMock.closeAllConnections() }
  if (typeof echoMock.closeAllConnections === 'function') { echoMock.closeAllConnections() }
  await Promise.all([
   new Promise(r => apiServer.close(r)),
   new Promise(r => cmMock.close(r)),
   new Promise(r => echoMock.close(r)),
  ])
 }
})

test('deploy-api.mjs cc-server.mjs: runs cleanly on @tagmein/civil-memory@0.1.5 CommonJS layout and civilMemoryKV ESM layout', async () => {
 async function getFreePort() {
  return new Promise((resolve, reject) => {
   const srv = net.createServer()
   srv.unref()
   srv.on('error', reject)
   srv.listen(0, '127.0.0.1', () => {
    const { port } = srv.address()
    srv.close(() => resolve(port))
   })
  })
 }

 async function startAndWaitHealth(workDir, defaultBasePath, port) {
  let logs = ''
  const child = spawn(process.execPath, [path.join(workDir, 'cc-server.mjs')], {
   cwd: workDir,
   env: {
    ...process.env,
    HOST: '127.0.0.1',
    PORT: String(port),
    DEFAULT_BASE_PATH: defaultBasePath,
   },
   stdio: ['ignore', 'pipe', 'pipe'],
  })
  child.stdout.on('data', d => { logs += d.toString('utf8') })
  child.stderr.on('data', d => { logs += d.toString('utf8') })

  let exited = null
  const exitPromise = new Promise(resolve => {
   child.once('exit', (code, signal) => {
    exited = { code, signal }
    resolve(exited)
   })
  })

  const deadline = Date.now() + 8000
  while (Date.now() < deadline) {
   if (exited) {
    throw new Error(`cc-server.mjs exited early (${JSON.stringify(exited)}): ${logs}`)
   }
   try {
    const resp = await fetch(`http://127.0.0.1:${port}/health`)
    if (resp.ok) {
     return { child, exitPromise, health: await resp.json(), getLogs: () => logs }
    }
   }
   catch {
    // still starting
   }
   await new Promise(r => setTimeout(r, 30))
  }
  child.kill('SIGKILL')
  await exitPromise
  throw new Error(`Timed out waiting for cc-server.mjs /health: ${logs}`)
 }

 // Layout A: exact @tagmein/civil-memory@0.1.5 CommonJS build (dist/kv/diskKV.js requiring fsPromises + path, NO dist/index.js)
 const tmpA = await fs.mkdtemp(path.join(os.tmpdir(), 'cc-cm-a-'))
 try {
  const defaultDataA = path.join(tmpA, 'default-data')
  const customBaseA = path.join(tmpA, 'lane-a-data')
  await fs.mkdir(path.join(tmpA, 'dist', 'kv'), { recursive: true })
  await fs.writeFile(path.join(tmpA, 'package.json'), JSON.stringify({
   name: '@tagmein/civil-memory',
   version: '0.1.5',
   main: 'dist/index.js',
  }))
  await fs.writeFile(path.join(tmpA, 'dist', 'kv', 'diskKV.js'), [
   'exports.diskKV = function diskKV({ rootDir, fsPromises, path }) {',
   ' if (!rootDir || !fsPromises || typeof fsPromises.readFile !== "function" || typeof fsPromises.writeFile !== "function" || !path || typeof path.join !== "function") {',
   '  throw new Error("diskKV requires rootDir, fsPromises, and path")',
   ' }',
   ' async function resolveKey(fullKey) {',
   '  const parts = fullKey.includes("#") ? fullKey.split("#") : ["main", fullKey]',
   '  const ns = parts.shift() || "main"',
   '  const k = parts.join("#") || "index"',
   '  const segs = [encodeURIComponent(ns.split("/").map(encodeURIComponent).join("/")), ...k.split("/").map(encodeURIComponent)]',
   '  const leaf = segs.pop()',
   '  if (segs.length > 0) await fsPromises.mkdir(path.join(rootDir, ...segs), { recursive: true })',
   '  return path.join(rootDir, ...segs, leaf)',
   ' }',
   ' return {',
   '  async get(k) { try { return (await fsPromises.readFile(await resolveKey(k))).toString("utf8") } catch { return null } },',
   '  async set(k, v) { await fsPromises.writeFile(await resolveKey(k), String(v), "utf8") },',
   '  async delete(k) { try { await fsPromises.unlink(await resolveKey(k)) } catch {} },',
   ' }',
   '}',
  ].join('\n'))
  await fs.writeFile(path.join(tmpA, 'dist', 'kv', 'volatileKV.js'), [
   'exports.volatileKV = function volatileKV() {',
   ' const map = new Map()',
   ' return {',
   '  async get(k) { return map.has(k) ? map.get(k) : undefined },',
   '  async set(k, v) { map.set(k, v) },',
   '  async delete(k) { map.delete(k) },',
   ' }',
   '}',
  ].join('\n'))
  await fs.writeFile(path.join(tmpA, 'cc-server.mjs'), generateCivilMemoryServerScript())

  const portA = await getFreePort()
  const srvA = await startAndWaitHealth(tmpA, defaultDataA, portA)
  try {
   assert.equal(srvA.health.ok, true)
   assert.equal(srvA.health.factory, 'diskKV')

   const keyUrl = `http://127.0.0.1:${portA}/?mode=disk&modeOptions.disk.basePath=${encodeURIComponent(customBaseA)}&key=${encodeURIComponent('lanes#abc/script/l1')}`
   const postRes = await fetch(keyUrl, { method: 'POST', body: '; to val 42' })
   assert.equal(postRes.status, 200)
   const getRes = await fetch(keyUrl)
   assert.equal(getRes.status, 200)
   assert.equal(await getRes.text(), '; to val 42')

   // Verify file lives inside customBaseA and not defaultDataA
   const customEntries = await fs.readdir(customBaseA)
   assert.ok(customEntries.length > 0)

   const delRes = await fetch(keyUrl, { method: 'DELETE' })
   assert.equal(delRes.status, 200)
   const missingRes = await fetch(keyUrl)
   assert.equal(missingRes.status, 404)

   const bareUrl = `http://127.0.0.1:${portA}/?mode=disk&key=lane-1.title`
   await fetch(bareUrl, { method: 'POST', body: 'Hello Lane' })
   assert.equal(await fetch(bareUrl).then(r => r.text()), 'Hello Lane')

   const volUrl = `http://127.0.0.1:${portA}/?mode=volatile&key=temp-1`
   assert.equal((await fetch(volUrl)).status, 404)
   await fetch(volUrl, { method: 'POST', body: 'ephemeral' })
   assert.equal(await fetch(volUrl).then(r => r.text()), 'ephemeral')
  }
  finally {
   srvA.child.kill('SIGTERM')
   await srvA.exitPromise
  }
 }
 finally {
  await fs.rm(tmpA, { recursive: true, force: true })
 }

 // Layout B: ESM "type": "module" with civilMemoryKV factory in dist/civilMemoryKV.js (no dist/index.js or top-level diskKV)
 const tmpB = await fs.mkdtemp(path.join(os.tmpdir(), 'cc-cm-b-'))
 try {
  const defaultDataB = path.join(tmpB, 'default-data')
  await fs.mkdir(path.join(tmpB, 'dist'), { recursive: true })
  await fs.writeFile(path.join(tmpB, 'package.json'), JSON.stringify({
   name: 'custom-civil-memory-esm',
   type: 'module',
  }))
  await fs.writeFile(path.join(tmpB, 'dist', 'civilMemoryKV.js'), [
   'import fs from "node:fs"',
   'import path from "node:path"',
   'const vol = new Map()',
   'export function civilMemoryKV(opts = {}) {',
   ' if (opts.mode === "volatile") {',
   '  return {',
   '   async get(k) { return vol.has(k) ? vol.get(k) : null },',
   '   async set(k, v) { vol.set(k, v) },',
   '   async delete(k) { vol.delete(k) },',
   '  }',
   ' }',
   ' const root = (opts.modeOptions && opts.modeOptions.disk && (opts.modeOptions.disk.basePath || opts.modeOptions.disk.rootDir)) || "."',
   ' fs.mkdirSync(root, { recursive: true })',
   ' const fp = k => path.join(root, encodeURIComponent(k))',
   ' return {',
   '  async get(k) { return fs.existsSync(fp(k)) ? fs.readFileSync(fp(k), "utf8") : null },',
   '  async set(k, v) { fs.writeFileSync(fp(k), String(v), "utf8") },',
   '  async delete(k) { try { fs.unlinkSync(fp(k)) } catch {} },',
   ' }',
   '}',
  ].join('\n'))
  await fs.writeFile(path.join(tmpB, 'cc-server.mjs'), generateCivilMemoryServerScript())

  const portB = await getFreePort()
  const srvB = await startAndWaitHealth(tmpB, defaultDataB, portB)
  try {
   assert.equal(srvB.health.ok, true)
   assert.equal(srvB.health.factory, 'civilMemoryKV')
   const subDir = path.join(tmpB, 'bucket-b')
   const u = `http://127.0.0.1:${portB}/?mode=disk&modeOptions.disk.basePath=${encodeURIComponent(subDir)}&key=k1`
   await fetch(u, { method: 'POST', body: 'esm-ok' })
   assert.equal(await fetch(u).then(r => r.text()), 'esm-ok')
   const vu = `http://127.0.0.1:${portB}/?mode=volatile&key=vk`
   await fetch(vu, { method: 'POST', body: 'vol-esm' })
   assert.equal(await fetch(vu).then(r => r.text()), 'vol-esm')
  }
  finally {
   srvB.child.kill('SIGTERM')
   await srvB.exitPromise
  }
 }
 finally {
  await fs.rm(tmpB, { recursive: true, force: true })
 }
})

test('terminal-ui.mjs: ANSI/VT buffer parsing, key encoding, sentinel extraction, and mountTerminalView', () => {
 const buf = createTerminalBuffer({ cols: 40, rows: 10 })
 buf.write('\x1b[32mHello\x1b[0m World\r\nprogress 10%\rprogress 100%\r\nfoo\b\bbar')
 assert.equal(buf.plainText(), 'Hello World\nprogress 100%\nfbar')

 // Split ANSI sequence across chunks + erase line
 buf.clear()
 buf.write('line1\x1b[31m red')
 buf.write('\x1b[0m\r\x1b[2Kreplaced')
 assert.equal(buf.plainText(), 'replaced')

 // SGR span classes
 buf.clear()
 buf.write('\x1b[1;36mCyanBold\x1b[0m')
 const spans = buf.getRenderLines()[0]
 assert.equal(spans[0].text, 'CyanBold')
 assert.equal(spans[0].style.fg, 'cyan')
 assert.equal(spans[0].style.bold, true)

 // Key encoding
 assert.equal(encodeKeyEventToVt({ key: 'Enter' }), '\r')
 assert.equal(encodeKeyEventToVt({ key: 'Backspace' }), '\x7f')
 assert.equal(encodeKeyEventToVt({ key: 'ArrowUp' }), '\x1b[A')
 assert.equal(encodeKeyEventToVt({ key: 'c', ctrlKey: true }), '\x03')
 assert.equal(encodeKeyEventToVt({ key: 'C', ctrlKey: true, shiftKey: true }), '')
 assert.equal(encodeKeyEventToVt({ key: 'a' }), 'a')

 // Sentinel extraction (including ANSI wrapping)
 const events = extractSentinelEvents(
  'normal line\r\n' +
  '\x1b[32m__CC_KV_READY__ {"ok":true,"url":"http://127.0.0.1:3333"}\x1b[0m\r\n' +
  '__CC_DEPLOY_OK__ {"ok":true,"slug":"calc","port":4100,"publicUrl":"https://api.example.com/calc"}\r\n'
 )
 assert.equal(events.length, 2)
 assert.equal(events[0].type, '__CC_KV_READY__')
 assert.equal(events[0].data.ok, true)
 assert.equal(events[1].type, '__CC_DEPLOY_OK__')
 assert.equal(events[1].data.port, 4100)

 // PTY line-wrapped sentinel extraction
 const wrappedOutput =
  'Syncing lane bundle to connected civil-memory KV store...\r\n' +
  '__CC_SYNC_OK__ {"ok":true,"laneCount":1,"laneIds":["aa4db0be-3c5e-49fe-8147-640fd654e1a8\r\n' +
  '"],"syncedAt":"2026-11-25T18:30:45.982Z"}\r\n' +
  'Waiting for service health check on 127.0.0.1:4100/_cc/health...\r\n' +
  '__CC_DEPLOY_OK__ {"ok":true,"slug":"beacon","laneId":"aa4db0be-3c5e-49fe-8147-640fd654e1\r\n' +
  'a8","port":4100,"publicUrl":"https://data.nateferrero.com/beacon","deployedAt":"2026-11-\r\n' +
  '25T18:30:42.889Z"}\r\n' +
  'Shared connection to data.nateferrero.com closed.\r\n'
 const wrappedEvents = extractSentinelEvents(wrappedOutput)
 assert.equal(wrappedEvents.length, 2)
 assert.equal(wrappedEvents[0].type, '__CC_SYNC_OK__')
 assert.deepEqual(wrappedEvents[0].data.laneIds, ['aa4db0be-3c5e-49fe-8147-640fd654e1a8'])
 assert.equal(wrappedEvents[1].type, '__CC_DEPLOY_OK__')
 assert.equal(wrappedEvents[1].data.laneId, 'aa4db0be-3c5e-49fe-8147-640fd654e1a8')
 assert.equal(wrappedEvents[1].data.deployedAt, '2026-11-25T18:30:42.889Z')

 // Chunked WebSocket streaming across PTY wrap boundaries emits each sentinel once
 const makeMockEl = () => ({
  style: {},
  attributes: {},
  children: [],
  listeners: {},
  textContent: '',
  tabIndex: 0,
  setAttribute(k, v) { this.attributes[k] = v },
  appendChild(c) { this.children.push(c); return c },
  replaceChildren() { this.children = [] },
  addEventListener(t, fn) { (this.listeners[t] ||= []).push(fn) },
 })
 const mockDoc = { createElement: makeMockEl }
 class StreamWs {
  constructor() { this.readyState = 1; this.listeners = {} }
  addEventListener(t, fn) { (this.listeners[t] ||= []).push(fn) }
  send() {}
  close() {}
  emit(t, payload) { for (const fn of this.listeners[t] || []) { fn(payload) } }
 }
 let streamWs = null
 const TrackedWs = class extends StreamWs { constructor() { super(); streamWs = this } }
 const streamedSentinels = []
 const term = mountTerminalView(makeMockEl(), {
  wsUrl: '/api/deploy/terminal/ws?id=test',
  document: mockDoc,
  window: { location: { protocol: 'http:', host: 'localhost:8080' } },
  WebSocketCtor: TrackedWs,
  onSentinel: evt => streamedSentinels.push(evt),
 })
 streamWs.emit('open', {})
 const chunks = [
  '__CC_SYNC_OK__ {"ok":true,"laneCount":1,"laneIds":["aa4db0be-3c5e-49fe-8147-640fd654e1a8\r\n',
  '"],"syncedAt":"2026-11-25T18:30:45.982Z"}\r\n__CC_DEPLOY_OK__ {"ok":true,"slug":"beacon","laneId":"aa4db0be-3c5e-49fe-8147-640fd654e1\r',
  '\na8","port":4100,"publicUrl":"https://data.nateferrero.com/beacon","deployedAt":"2026-11-\r\n',
  '25T18:30:42.889Z"}',
 ]
 for (const chunk of chunks) {
  streamWs.emit('message', { data: JSON.stringify({ type: 'output', data: chunk }) })
 }
 streamWs.emit('message', { data: JSON.stringify({ type: 'status', status: 'exited', exitCode: 0 }) })
 term.disconnect()
 assert.equal(streamedSentinels.length, 2)
 assert.equal(streamedSentinels[0].type, '__CC_SYNC_OK__')
 assert.equal(streamedSentinels[1].type, '__CC_DEPLOY_OK__')
 assert.equal(streamedSentinels[1].data.laneId, 'aa4db0be-3c5e-49fe-8147-640fd654e1a8')
 assert.equal(streamedSentinels[1].data.deployedAt, '2026-11-25T18:30:42.889Z')

 // New server logs highlight after __CC_LOGS_FOLLOW__ marker: holds 30s, fades linearly over 30s, and clears at 60s
 assert.equal(NEW_LOG_HIGHLIGHT_HOLD_MS, 30000)
 assert.equal(NEW_LOG_HIGHLIGHT_FADE_MS, 30000)
 assert.equal(NEW_LOG_HIGHLIGHT_TOTAL_MS, 60000)
 assert.equal(computeNewLogHighlightAlpha(0), 0.16)
 assert.equal(computeNewLogHighlightAlpha(30000), 0.16)
 assert.equal(computeNewLogHighlightAlpha(45000), 0.08)
 assert.equal(computeNewLogHighlightAlpha(60000), 0)
 assert.equal(formatNewLogHighlightBg(30000), 'rgba(255, 255, 255, 0.16)')
 assert.equal(formatNewLogHighlightBg(45000), 'rgba(255, 255, 255, 0.08)')
 assert.equal(formatNewLogHighlightBg(60000), '')

 let fakeNow = 1000
 let pendingFadeCb = null
 let pendingFadeDelay = null
 const logHost = makeMockEl()
 logHost.scrollHeight = 400
 const logTerm = mountTerminalView(logHost, {
  document: mockDoc,
  window: {
   location: { protocol: 'http:', host: 'localhost:8080' },
   setTimeout: (fn, ms) => {
    pendingFadeDelay = ms
    pendingFadeCb = () => {
     pendingFadeCb = null
     pendingFadeDelay = null
     fn()
    }
    return 1
   },
   clearTimeout: () => { pendingFadeCb = null; pendingFadeDelay = null },
  },
  now: () => fakeNow,
 })
 logTerm.element.scrollHeight = 400
 logTerm.feedOutput('initial log line 1\r\ninitial log line 2\r\n__CC_LOG')
 logTerm.feedOutput('S_FOLLOW__\r\nnew incoming log 1\r\n')
 assert.equal(logTerm.getPlainText(), 'initial log line 1\ninitial log line 2\nnew incoming log 1\n')
 assert.equal(logTerm.element.children[0].className, 'cc-term-line')
 assert.equal(logTerm.element.children[1].className, 'cc-term-line')
 assert.equal(logTerm.element.children[2].className, 'cc-term-line cc-term-line--new')
 assert.equal(logTerm.element.children[2].style.backgroundColor, 'rgba(255, 255, 255, 0.16)')
 assert.equal(logTerm.element.children[2].style.animationDelay, '-0.000s')
 assert.equal(pendingFadeDelay, 60000)

 // At +30s: still full lighter background highlight; second new log arrives at t=31000
 fakeNow = 31000
 logTerm.feedOutput('new incoming log 2\r\n')
 assert.equal(logTerm.element.children[2].className, 'cc-term-line cc-term-line--new')
 assert.equal(logTerm.element.children[2].style.backgroundColor, 'rgba(255, 255, 255, 0.16)')
 assert.equal(logTerm.element.children[2].style.animationDelay, '-30.000s')
 assert.equal(logTerm.element.children[3].className, 'cc-term-line cc-term-line--new')
 assert.equal(logTerm.element.children[3].style.backgroundColor, 'rgba(255, 255, 255, 0.16)')
 assert.equal(logTerm.element.children[3].style.animationDelay, '-0.000s')
 assert.equal(pendingFadeDelay, 30000)

 // At +45s from first new log (+15s into its 30s fade, +15s hold on second new log):
 fakeNow = 46000
 logTerm.renderNow()
 assert.equal(logTerm.element.children[2].className, 'cc-term-line cc-term-line--new')
 assert.equal(logTerm.element.children[2].style.backgroundColor, 'rgba(255, 255, 255, 0.08)')
 assert.equal(logTerm.element.children[2].style.animationDelay, '-45.000s')
 assert.equal(logTerm.element.children[3].className, 'cc-term-line cc-term-line--new')
 assert.equal(logTerm.element.children[3].style.backgroundColor, 'rgba(255, 255, 255, 0.16)')
 assert.equal(pendingFadeDelay, 15000)

 // At +60s from first new log: scheduled cleanup timer updates DOM in-place without replacing nodes or hijacking scrollTop
 const savedFirstNewLineEl = logTerm.element.children[2]
 const savedSecondNewLineEl = logTerm.element.children[3]
 logTerm.element.scrollTop = 12
 fakeNow = 61000
 assert.equal(typeof pendingFadeCb, 'function')
 pendingFadeCb()
 assert.equal(logTerm.element.children[2], savedFirstNewLineEl)
 assert.equal(logTerm.element.children[3], savedSecondNewLineEl)
 assert.equal(logTerm.element.scrollTop, 12)
 assert.equal(logTerm.element.children[2].className, 'cc-term-line')
 assert.equal(logTerm.element.children[2].style.backgroundColor, undefined)
 assert.equal(logTerm.element.children[3].className, 'cc-term-line cc-term-line--new')
 assert.equal(logTerm.element.children[3].style.backgroundColor, 'rgba(255, 255, 255, 0.16)')
 assert.equal(pendingFadeDelay, 30000)

 fakeNow = 76000
 logTerm.renderNow()
 assert.equal(logTerm.element.children[3].className, 'cc-term-line cc-term-line--new')
 assert.equal(logTerm.element.children[3].style.backgroundColor, 'rgba(255, 255, 255, 0.08)')

 fakeNow = 91000
 assert.equal(typeof pendingFadeCb, 'function')
 pendingFadeCb()
 assert.equal(logTerm.element.children[3].className, 'cc-term-line')
 assert.equal(logTerm.element.children[3].style.backgroundColor, undefined)
 assert.equal(pendingFadeCb, null)

 // Clear empties buffer while preserving live new-log highlighting for subsequent incoming logs
 logTerm.clear()
 assert.equal(logTerm.getPlainText(), '')
 logTerm.feedOutput('after clear log\r\n')
 assert.equal(logTerm.getPlainText(), 'after clear log\n')
 assert.equal(logTerm.element.children[0].className, 'cc-term-line cc-term-line--new')
 logTerm.disconnect()
})

test('UI integration: Configure Lane HTTP Server feature, Server tab mock tester, mandatory civil-memory gate, Servers modal, and SSH terminal modal', async () => {
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
  const styleProps = {}
  return {
   tag,
   nodeType: 1,
   style: {
    setProperty(name, value) { styleProps[name] = value; this[name] = value },
    removeProperty(name) { delete styleProps[name]; delete this[name] },
    getPropertyValue(name) { return styleProps[name] || '' },
   },
   attributes: {},
   children: [],
   parentNode: null,
   listeners: {},
   textContent: '',
   innerHTML: '',
   value: '',
   checked: false,
   className: '',
   title: '',
   hidden: false,
   disabled: false,
   removed: false,
   focused: false,
   setAttribute(name, value) { this.attributes[name] = value },
   contains(target) {
    if (target === this) { return true }
    return this.children.some(child => typeof child.contains === 'function' && child.contains(target))
   },
   appendChild(child) {
    if (child.parentNode) {
     const prevIdx = child.parentNode.children.indexOf(child)
     if (prevIdx !== -1) { child.parentNode.children.splice(prevIdx, 1) }
    }
    child.parentNode = this
    child.removed = false
    this.children.push(child)
    return child
   },
   insertBefore(child, ref) {
    if (child.parentNode) {
     const prevIdx = child.parentNode.children.indexOf(child)
     if (prevIdx !== -1) { child.parentNode.children.splice(prevIdx, 1) }
    }
    child.parentNode = this
    child.removed = false
    const idx = this.children.indexOf(ref)
    if (idx === -1) { this.children.push(child) }
    else { this.children.splice(idx, 0, child) }
    return child
   },
   addEventListener(event, handler) { this.listeners[event] = handler },
   focus() { this.focused = true },
   select() {},
   remove() {
    this.removed = true
    if (this.parentNode) {
     const idx = this.parentNode.children.indexOf(this)
     if (idx !== -1) { this.parentNode.children.splice(idx, 1) }
     this.parentNode = null
    }
   },
  }
 }

 const store = new Map()
 const makeKv = (ns = '') => {
  const isHash = ns.includes('#')
  const qual = k => (isHash ? (ns.endsWith('#') ? `${ns}${k}` : `${ns}/${k}`) : (ns ? `${ns}.${k}` : k))
  const c = {
   prefix: ns,
   basePath: null,
   root: null,
   defaultRoot: null,
   getActiveClient() { return c },
   withBasePath() { return c },
   setBasePath() { return c },
   namespace: name => makeKv(isHash ? qual(encodeKeySegment(name)) : qual(name)),
   hashNamespace: name => makeKv(`${encodeKeySegment(name)}#`),
   async get(k) { const q = qual(k); return store.has(q) ? store.get(q) : null },
   async set(k, v) {
    const q = qual(k)
    for (const existing of store.keys()) {
     if (existing.startsWith(`${q}/`) || q.startsWith(`${existing}/`)) {
      throw new Error(`diskKV file/dir collision between "${existing}" and "${q}"`)
     }
    }
    store.set(q, String(v))
   },
   async delete(k) { store.delete(qual(k)) },
  }
  c.root = c
  c.defaultRoot = c
  return c
 }
 const kv = makeKv()
 assert.equal(deployedScriptKey('lane-a').startsWith(`${deploymentKey('lane-a')}/`), false)

 const makeStorage = () => {
  const m = new Map()
  return {
   getItem(k) { return m.has(k) ? m.get(k) : null },
   setItem(k, v) { m.set(k, String(v)) },
   removeItem(k) { m.delete(k) },
  }
 }
 let uuid = 0
 let lastWs = null
 class MockWebSocket {
  constructor(url) {
   this.url = url
   this.readyState = 1
   this.sent = []
   this.listeners = {}
   lastWs = this
  }
  addEventListener(type, fn) {
   this.listeners[type] = this.listeners[type] || []
   this.listeners[type].push(fn)
  }
  send(data) { this.sent.push(JSON.parse(data)) }
  close() {
   this.readyState = 3
   for (const fn of this.listeners.close || []) { fn({}) }
  }
  emitOpen() {
   for (const fn of this.listeners.open || []) { fn({}) }
  }
  emitMessage(obj) {
   const ev = { data: JSON.stringify(obj) }
   for (const fn of this.listeners.message || []) { fn(ev) }
  }
 }

 const mockWindow = {
  Array,
  Boolean,
  Date,
  JSON,
  Math,
  Number,
  Object,
  Reflect,
  WebSocket: MockWebSocket,
  decodeURIComponent,
  localStorage: makeStorage(),
  sessionStorage: makeStorage(),
  crypto: { randomUUID: () => `srv-uuid-${++uuid}` },
  navigator: { clipboard: { writeText: async txt => { copiedTermLogs.push(txt) } } },
  history: { pushState(_s, _t, url) { mockWindow.location.pathname = url } },
  location: { pathname: '/', host: 'localhost:8080', protocol: 'http:' },
  addEventListener() {},
  removeEventListener() {},
 }
 const mockDocument = { body: createMockElement('body'), defaultView: mockWindow, createElement: createMockElement }

 const syncedPayloads = []
 const termPayloads = []
 const copiedTermLogs = []

 const origFetch = globalThis.fetch
 globalThis.fetch = async url => {
  if (url === '/src/lane-control.fs') { return { text: async () => laneSource } }
  if (url === '/src/lane-notebook.fs') { return { text: async () => notebookSource } }
  if (url === '/src/lane-inputs.fs') { return { text: async () => inputsSource } }
  if (url === '/src/lane-scope.fs') { return { text: async () => scopeSource } }
  if (url === '/src/lane-data.fs') { return { text: async () => dataSource } }
  if (url === '/src/confirm-modal.fs') { return { text: async () => confirmModalSource } }
  if (url === '/src/lane-row-picker-modal.fs') { return { text: async () => rowPickerModalSource } }
  if (url === '/src/lane-output.fs') { return { text: async () => outputSource } }
  if (url === '/src/lane-modal.fs') { return { text: async () => modalSource } }
  if (url === '/src/lane-config-modal.fs') { return { text: async () => configModalSource } }
  if (url === '/src/lane-import-modal.fs') { return { text: async () => importModalSource } }
  if (url === '/src/lane-rails.fs') { return { text: async () => railsSource } }
  if (url === '/src/lane-line-info-modal.fs') { return { text: async () => lineInfoModalSource } }
  if (url === '/src/lane-export-modal.fs') { return { text: async () => exportModalSource } }
  if (url === '/src/lane-export-deploy-modal.fs') { return { text: async () => exportDeployModalSource } }
  if (url === '/src/lane-server.fs') { return { text: async () => laneServerSource } }
  if (url === '/src/lane-story.fs') { return { text: async () => laneStorySource } }
  if (url === '/src/lane-servers-modal.fs') { return { text: async () => laneServersModalSource } }
  if (url === '/src/lane-terminal-modal.fs') { return { text: async () => laneTerminalModalSource } }
  if (url === '/src/lane-session-modal.fs') { return { text: async () => sessionModalSource } }
  if (url === '/src/lane-package-modal.fs') { return { text: async () => packageModalSource } }
  if (url === '/src/lane-dir-modal.fs') { return { text: async () => dirModalSource } }
  throw new Error(`Unexpected fetch: ${url}`)
 }

 try {
  const f = field({
   ...DATA_RUNTIME_ENV,
   console: { log() {} },
   createFsDir: async () => ({ ok: true }),
   createIdleTracker,
   data: kv,
   defaultValueForType,
   document: mockDocument,
   fetchFsList: async () => ({ ok: true, path: '/', directories: [], breadcrumbs: [] }),
   fetchFsRoots: async () => ({ home: '/', platform: 'linux', sep: '/', roots: [] }),
   formatImportLine,
   hasImportCycle,
   normalizePrimitiveType,
   parseImportLine,
   primitiveTypes: PRIMITIVE_TYPES,
   resolveImportValue,
   resolveScopeColumns,
   runLines,
   runTransportedScripts,
   testRemoteCivilMemory: async ({ url, basePath }) => ({ ok: true, url, basePath, latencyMs: 3 }),
   syncLaneToRemoteCivilMemory: async payload => {
    syncedPayloads.push(payload)
    return { ok: true, laneCount: payload.bundle.lanes.length, laneIds: payload.bundle.lanes.map(l => l.id), syncedAt: '2026-11-25T12:00:00Z' }
   },
   startDeployTerminalSession: async payload => {
    termPayloads.push(payload)
    return { ok: true, sessionId: 'term-sess-1', wsPath: '/api/deploy/terminal/ws?id=term-sess-1', title: `Deploy ${payload.deployment ? payload.deployment.slug : ''}` }
   },
   killDeployTerminalSession: async () => ({ ok: true }),
  })
  await f.run(parse(mainSource, '/src/main.fs'))
  const laneControl = f.state['lane-control']
  const dirModal = laneControl['dir-modal']
  await dirModal['default-btn'].listeners.click()

  // 1. Add a lane and an imported helper lane; verify Server tab is hidden by default
  const helper = await laneControl.add()
  await laneControl.rename(helper.id, 'Helper')
  helper.notebook.rows[0]['input-el'].value = '; to secret 77'
  await helper.notebook.rows[0]['input-el'].listeners.input()

  const apiLane = await laneControl.add()
  await laneControl.rename(apiLane.id, 'Calc API')
  assert.equal(apiLane.notebook.tabs.server.hidden, true)

  // 2. Open Configure Lane modal -> enable Features > HTTP Server -> Server tab appears & persists
  await laneControl.configure(apiLane.id)
  const cfgModal = laneControl['config-modal']
  assert.equal(cfgModal['http-server-check'].checked, false)
  cfgModal['http-server-check'].checked = true
  await cfgModal.form.listeners.submit({ preventDefault() {} })
  assert.equal(apiLane.notebook.tabs.server.hidden, false)
  assert.equal(apiLane.features.httpServer, true)
  assert.deepEqual(JSON.parse(await apiLane.data.get('features')), { httpServer: true, runEvery30Minutes: false })

  // 3. Test Mock Request Tester on an expression-only lane (returns 42)
  await apiLane.notebook['insert-line'](0, `; to dep !importLane ${helper.id} secret`)
  await apiLane.notebook['insert-line'](1, '; to x 10')
  apiLane.notebook.rows[2]['input-el'].value = '; add $x 32'
  await apiLane.notebook.rows[2]['input-el'].listeners.input()
  await apiLane.notebook.tabs.server.listeners.click()
  assert.equal(apiLane.notebook['active-tab'], 'server')

  const sv = apiLane.notebook['server-view']
  assert.equal(sv['handlers-badge'].textContent, 'Expression mode (GET / → JSON)')
  await sv['send-btn'].listeners.click()
  assert.equal(sv['resp-status'].textContent, '200')
  assert.equal(JSON.parse(sv['resp-pre'].textContent), 42)

  // 4. Test Mock Request Tester on a handler lane (; to get ( ... ))
  apiLane.notebook.rows[1]['input-el'].value = ''
  await apiLane.notebook.rows[1]['input-el'].listeners.input()
  apiLane.notebook.rows[2]['input-el'].value = '; to get (\n ; to { r } $argv\n ; object { path $r.path } { q $r.query.q }\n)'
  await apiLane.notebook.rows[2]['input-el'].listeners.input()
  assert.equal(sv['handlers-badge'].textContent, 'Handlers: GET')
  sv['path-input'].value = '/ping?q=pong'
  await sv['send-btn'].listeners.click()
  assert.equal(sv['resp-status'].textContent, '200')
  assert.deepEqual(JSON.parse(sv['resp-pre'].textContent), { path: '/ping', q: 'pong' })

  // 5. Open Top-Rail Servers modal -> add an external civil-memory SSH server
  await laneControl.rails['servers-btn'].listeners.click()
  const srvModal = laneControl['servers-modal']
  assert.equal(srvModal['is-open'], true)
  srvModal.fields.name.value = 'External KV Server'
  srvModal.fields.host.value = 'api.example.com'
  srvModal.fields.user.value = 'deploy'
  srvModal.fields.defaultDomain.value = 'api.example.com'
  srvModal.fields.civilMemoryMode.value = 'external'
  srvModal.fields.civilMemoryUrl.value = 'https://kv.example.com'
  await srvModal['srv-form'].listeners.submit({ preventDefault() {} })
  assert.equal(srvModal.servers.length, 1)
  const savedSrv = srvModal.servers[0]
  await srvModal.close()

  // Select server in lane's Server tab -> Sync & Deploy remain BLOCKED until Verify KV passes
  sv['srv-select'].value = savedSrv.id
  await sv['srv-select'].listeners.change()
  assert.equal(sv['kv-url-input'].value, 'https://kv.example.com')
  assert.equal(sv['domain-input'].value, 'api.example.com')
  assert.equal(sv['sync-kv-btn'].disabled, true)
  assert.equal(sv['deploy-btn'].disabled, true)

  // Verify KV -> unlocks Sync & Deploy
  await sv['verify-kv-btn'].listeners.click()
  assert.equal(sv['kv-badge'].textContent, 'KV Ready ✓')
  assert.equal(sv['sync-kv-btn'].disabled, false)
  assert.equal(sv['deploy-btn'].disabled, false)

  // Sync without includeImports -> only main lane synced; with includeImports -> helper included
  await sv['sync-kv-btn'].listeners.click()
  assert.equal(syncedPayloads.length, 1)
  assert.deepEqual(syncedPayloads[0].bundle.lanes.map(l => l.id), [apiLane.id])

  sv['imports-check'].checked = true
  await sv['sync-kv-btn'].listeners.click()
  assert.equal(syncedPayloads.length, 2)
  assert.deepEqual(syncedPayloads[1].bundle.lanes.map(l => l.id), [apiLane.id, helper.id])

  // Deploy -> opens terminal-modal, connects WebSocket, handles __CC_DEPLOY_OK__ sentinel
  await sv['deploy-btn'].listeners.click()
  assert.equal(termPayloads.length, 1)
  assert.equal(termPayloads[0].action, 'deploy-lane')
  assert.equal(laneControl['terminal-modal']['is-open'], true)
  assert.equal(laneControl['terminal-modal']['copy-btn'].textContent, 'Copy Log')
  assert.equal(laneControl['terminal-modal']['clear-btn'].textContent, 'Clear')
  lastWs.emitOpen()
  lastWs.emitMessage({ type: 'init', status: 'running', title: 'Deploy calc-api' })
  lastWs.emitMessage({ type: 'output', data: '__CC_DEPLOY_OK__ {"ok":true,"slug":"calc-api","port":4100,"publicUrl":"https://api.example.com/calc-api","deployedAt":"2026-11-25T12:05:00Z"}\r\n' })
  lastWs.emitMessage({ type: 'status', status: 'exited', exitCode: 0 })
  await new Promise(r => setTimeout(r, 20))
  assert.match(laneControl['terminal-modal'].term.getPlainText(), /__CC_DEPLOY_OK__/)
  await laneControl['terminal-modal']['copy-btn'].listeners.click()
  assert.equal(laneControl['terminal-modal']['copy-btn'].textContent, 'Copied!')
  assert.equal(copiedTermLogs.length, 1)
  assert.match(copiedTermLogs[0], /__CC_DEPLOY_OK__/)
  await laneControl['terminal-modal']['clear-btn'].listeners.click()
  assert.equal(laneControl['terminal-modal'].term.getPlainText(), '')
  assert.equal(laneControl['terminal-modal']['copy-btn'].textContent, 'Copy Log')
  assert.equal(sv['deploy-err'].textContent, '')
  assert.match(sv['deploy-status'].textContent, /https:\/\/api\.example\.com\/calc-api/)
  await laneControl['terminal-modal'].close(true)

  // 6. Verify new Deployments section between HTTP Request Tester and Remote Deployment,
  // Deployment dropdown disabled in Mock (Local) & enabled in Live (Deployed),
  // creating a second deployment below, Test button issuing GET / in HTTP Request Tester with Pass/Fail in cell,
  // and removing a deployment via row × button with confirmation modal
  assert.deepEqual(
   sv.element.children,
   [sv['tester-card'], sv['deployments-card'], sv['deploy-card']],
  )
  assert.equal(sv['tester-mode'], 'mock')
  assert.equal(sv['deployment-select'].disabled, true)
  assert.equal(sv.deployments.length, 1)
  assert.equal(sv['deployment-rows'].length, 1)
  assert.equal(sv['deployments-count-badge'].textContent, '1')
  assert.equal(sv['deployment-rows'][0]['slug-td'].textContent, 'lane-2')
  assert.equal(sv['deployment-rows'][0]['url-td'].textContent, 'https://api.example.com/calc-api')

  // Switching to Live (Deployed) enables the Deployment dropdown; switching back to Mock (Local) disables it
  await sv['live-mode-btn'].listeners.click()
  assert.equal(sv['tester-mode'], 'live')
  assert.equal(sv['deployment-select'].disabled, false)
  await sv['mock-mode-btn'].listeners.click()
  assert.equal(sv['tester-mode'], 'mock')
  assert.equal(sv['deployment-select'].disabled, true)

  // Create a second known deployment in Remote Deployment below (different slug & subpath)
  sv['slug-input'].value = 'calc-api-staging'
  await sv['slug-input'].listeners.input()
  sv['subpath-input'].value = '/calc-api-staging'
  await sv['subpath-input'].listeners.input()
  await sv['save-cfg-btn'].listeners.click()

  assert.equal(sv.deployments.length, 2)
  assert.equal(sv['deployment-rows'].length, 2)
  assert.equal(sv['deployment-option-els'].length, 2)
  assert.equal(sv['deployments-count-badge'].textContent, '2')
  const dep1 = sv.deployments[0]
  const dep2 = sv.deployments[1]
  assert.equal(dep1.slug, 'lane-2')
  assert.equal(dep2.slug, 'calc-api-staging')

  // Mock proxyDeployRequest to test both deployments via the row Test button and HTTP Request Tester
  const proxyCalls = []
  f.state.proxyDeployRequest = async req => {
   proxyCalls.push(req)
   if (req.url === 'https://api.example.com/calc-api/') {
    return {
     ok: true,
     status: 200,
     statusText: 'OK',
     headers: { 'content-type': 'application/json', 'x-dep': 'prod' },
     bodyText: JSON.stringify({ status: 'healthy', env: 'prod' }),
     durationMs: 12,
    }
   }
   return {
    ok: true,
    status: 502,
    statusText: 'Bad Gateway',
    headers: { 'content-type': 'application/json' },
    bodyText: JSON.stringify({ error: 'upstream down' }),
    durationMs: 25,
   }
  }

  // Click Test on Row 0 (calc-api): switches tester to Live (Deployed), selects dep1, sets GET /,
  // shows full response details in HTTP Request Tester, and displays Pass in the row cell
  sv['method-select'].value = 'POST'
  sv['path-input'].value = '/custom'
  await sv['deployment-rows'][0]['test-btn'].listeners.click()

  assert.equal(sv['tester-mode'], 'live')
  assert.equal(sv['deployment-select'].disabled, false)
  assert.equal(sv['deployment-select'].value, dep1.id)
  assert.equal(sv['method-select'].value, 'GET')
  assert.equal(sv['path-input'].value, '/')
  assert.equal(proxyCalls.length, 1)
  assert.equal(proxyCalls[0].url, 'https://api.example.com/calc-api/')
  assert.equal(proxyCalls[0].method, 'GET')
  assert.equal(sv['resp-box'].hidden, false)
  assert.equal(sv['resp-status'].textContent, '200')
  assert.deepEqual(JSON.parse(sv['resp-pre'].textContent), { status: 'healthy', env: 'prod' })
  assert.equal(JSON.parse(sv['resp-details-box'].textContent).headers['x-dep'], 'prod')
  assert.equal(sv['deployment-rows'][0]['test-status-el'].hidden, false)
  assert.equal(sv['deployment-rows'][0]['test-status-el'].textContent, 'Pass')
  assert.equal(sv['deployment-rows'][0]['test-status-el'].attributes['data-test-result'], 'pass')

  // Click Test on Row 1 (calc-api-staging): selects dep2, runs GET / in HTTP Request Tester,
  // shows 502 details in HTTP Request Tester, and displays Fail in Row 1's cell while preserving Row 0's Pass
  await sv['deployment-rows'][1]['test-btn'].listeners.click()
  assert.equal(sv['deployment-select'].value, dep2.id)
  assert.equal(proxyCalls.length, 2)
  assert.equal(proxyCalls[1].url, 'http://api.example.com/calc-api-staging/')
  assert.equal(sv['resp-status'].textContent, '502')
  assert.deepEqual(JSON.parse(sv['resp-pre'].textContent), { error: 'upstream down' })
  assert.equal(sv['deployment-rows'][1]['test-status-el'].hidden, false)
  assert.equal(sv['deployment-rows'][1]['test-status-el'].textContent, 'Fail')
  assert.equal(sv['deployment-rows'][1]['test-status-el'].attributes['data-test-result'], 'fail')
  assert.equal(sv['deployment-rows'][0]['test-status-el'].textContent, 'Pass')

  // Remove Row 1 via × button -> opens confirmation modal; Cancel keeps both, Confirm removes Row 1
  const removeBtn = sv['deployment-rows'][1]['remove-btn']
  assert.equal(removeBtn.className, 'lane-data-row-remove')
  assert.equal(removeBtn.textContent, '×')
  await removeBtn.listeners.click()
  const confirmModal = laneControl['confirm-modal']
  assert.equal(confirmModal['is-open'], true)
  assert.equal(confirmModal['title-el'].textContent, 'Remove Deployment')
  assert.match(confirmModal['message-el'].textContent, /calc-api-staging/)

  // Cancel keeps both deployments
  await confirmModal['cancel-btn'].listeners.click()
  assert.equal(confirmModal['is-open'], false)
  assert.equal(sv.deployments.length, 2)
  assert.equal(sv['deployment-rows'].length, 2)

  // Open again and Confirm -> removes calc-api-staging from KV, table, and Deployment dropdown
  await sv['deployment-rows'][1]['remove-btn'].listeners.click()
  assert.equal(confirmModal['is-open'], true)
  await confirmModal['confirm-btn'].listeners.click()
  assert.equal(confirmModal['is-open'], false)
  assert.equal(sv.deployments.length, 1)
  assert.equal(sv['deployment-rows'].length, 1)
  assert.equal(sv['deployment-option-els'].length, 1)
  assert.equal(sv['deployment-select'].value, dep1.id)
  assert.equal(sv['deployment-rows'][0]['test-status-el'].textContent, 'Pass')
  assert.equal((await loadLaneDeployments(kv, apiLane.id)).length, 1)

  // 7. Disabling HTTP Server while Server tab is active falls back cleanly to Source and hides Server tab
  await laneControl.configure(apiLane.id)
  cfgModal['http-server-check'].checked = false
  await cfgModal.form.listeners.submit({ preventDefault() {} })
  assert.equal(apiLane.notebook.tabs.server.hidden, true)
  assert.equal(apiLane.notebook['active-tab'], 'source')
 }
 finally {
  globalThis.fetch = origFetch
 }
})

test('Inventory -> Public Wishlist live table-triggered sync & deploy, access checks, Updates section above table, and read-only HTTP server endpoints', async () => {
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
  const el = {
   tag,
   style: { setProperty() {}, removeProperty() {} },
   children: [],
   attributes: {},
   listeners: {},
   parentNode: null,
   className: '',
   textContent: '',
   innerHTML: '',
   value: '',
   type: '',
   placeholder: '',
   title: '',
   disabled: false,
   hidden: false,
   checked: false,
   appendChild(child) {
    if (child.parentNode && child.parentNode !== this) {
     const prevIdx = child.parentNode.children.indexOf(child)
     if (prevIdx !== -1) child.parentNode.children.splice(prevIdx, 1)
    }
    const existingIdx = this.children.indexOf(child)
    if (existingIdx !== -1) this.children.splice(existingIdx, 1)
    child.parentNode = this
    this.children.push(child)
    return child
   },
   insertBefore(child, ref) {
    if (!ref) return this.appendChild(child)
    if (child.parentNode && child.parentNode !== this) {
     const prevIdx = child.parentNode.children.indexOf(child)
     if (prevIdx !== -1) child.parentNode.children.splice(prevIdx, 1)
    }
    const existingIdx = this.children.indexOf(child)
    if (existingIdx !== -1) this.children.splice(existingIdx, 1)
    child.parentNode = this
    const idx = this.children.indexOf(ref)
    if (idx === -1) this.children.push(child)
    else this.children.splice(idx, 0, child)
    return child
   },
   remove() {
    if (this.parentNode) {
     const idx = this.parentNode.children.indexOf(this)
     if (idx !== -1) this.parentNode.children.splice(idx, 1)
     this.parentNode = null
    }
   },
   setAttribute(k, v) { this.attributes[k] = String(v) },
   getAttribute(k) { return Object.hasOwn(this.attributes, k) ? this.attributes[k] : null },
   removeAttribute(k) { delete this.attributes[k] },
   addEventListener(ev, fn) { this.listeners[ev] = fn },
   removeEventListener(ev) { delete this.listeners[ev] },
   contains(target) {
    if (target === this) return true
    return this.children.some(c => c && typeof c.contains === 'function' && c.contains(target))
   },
   focus() {},
   select() {},
  }
  return el
 }

 const kv = new Map()
 function createMockKV(prefix = '') {
  const qualify = key => (prefix ? `${prefix}.${key}` : key)
  const client = {
   prefix,
   root: null,
   namespace(name) {
    const sub = createMockKV(qualify(name))
    sub.root = client.root
    return sub
   },
   async get(key) { return kv.has(qualify(key)) ? kv.get(qualify(key)) : null },
   async set(key, value) { kv.set(qualify(key), String(value)) },
   async delete(key) { kv.delete(qualify(key)) },
  }
  client.root = client
  return client
 }

 const rootKv = createMockKV()
 const invId = 'inv-lane-1'
 const pubId = 'pub-wishlist-1'
 const lockedId = 'locked-lane-1'

 await registerLaneInPackage(rootKv, invId, 'Inventory', DEFAULT_PACKAGE_ID)
 await registerLaneInPackage(rootKv, pubId, 'Public Wishlist', DEFAULT_PACKAGE_ID)
 await registerLaneInPackage(rootKv, lockedId, 'Secret Lane', 'pkg-locked-vault')

 await rootKv.namespace(invId).set('title', 'Inventory')
 await rootKv.namespace(pubId).set('title', 'Public Wishlist')
 await rootKv.namespace(pubId).set('features', JSON.stringify({ httpServer: true }))

 // Configure Public Wishlist tables: categories & wishlist
 await saveLaneTables(rootKv, rootKv.namespace(pubId), pubId, [
  {
   id: 'tbl-pub-cats',
   name: 'categories',
   columns: [
    { id: 'c-code', name: 'code', type: 'text', multiple: false, required: true },
    { id: 'c-name', name: 'name', type: 'text', multiple: false, required: true },
   ],
   rows: [],
  },
  {
   id: 'tbl-pub-wish',
   name: 'wishlist',
   columns: [
    { id: 'w-id', name: 'id', type: 'integer', multiple: false, required: true },
    { id: 'w-name', name: 'name', type: 'text', multiple: false, required: true },
    { id: 'w-cat', name: 'category', type: 'row', multiple: false, required: true, refTableId: 'tbl-pub-cats', refColumnId: 'c-code', refDisplayColumnId: 'c-name' },
    { id: 'w-cat-name', name: 'categoryName', type: 'text', multiple: false },
   ],
   rows: [],
  },
 ])

 // Configure Inventory tables: categories & wishlist (with 1 public item and 2 private items)
 await saveLaneTables(rootKv, rootKv.namespace(invId), invId, [
  {
   id: 'tbl-inv-cats',
   name: 'categories',
   columns: [
    { id: 'ic-name', name: 'name', type: 'text', multiple: false },
    { id: 'ic-code', name: 'code', type: 'text', multiple: false },
   ],
   rows: [
    { id: 'rc-1', values: { 'ic-name': 'Paper / Stationery', 'ic-code': 'stationery' } },
    { id: 'rc-2', values: { 'ic-name': 'Electronics Adapters', 'ic-code': 'electronics_adapters' } },
    { id: 'rc-3', values: { 'ic-name': 'Art Supplies', 'ic-code': 'art_supplies' } },
   ],
  },
  {
   id: 'tbl-inv-wish',
   name: 'wishlist',
   columns: [
    { id: 'iw-name', name: 'name', type: 'text', multiple: false, required: true },
    { id: 'iw-cat', name: 'category', type: 'row', multiple: false, required: true, refTableId: 'tbl-inv-cats', refColumnId: 'ic-code', refDisplayColumnId: 'ic-name' },
    { id: 'iw-pub', name: 'public', type: 'boolean', multiple: false, required: true },
   ],
   rows: [
    { id: 'rw-1', values: { 'iw-name': 'black dot stickers to cover leds', 'iw-cat': 'stationery', 'iw-pub': true } },
    { id: 'rw-2', values: { 'iw-name': 'USB-C to USB-A adapters', 'iw-cat': 'electronics_adapters', 'iw-pub': false } },
    { id: 'rw-3', values: { 'iw-name': "painter's easel", 'iw-cat': 'art_supplies', 'iw-pub': false } },
   ],
  },
 ])

 // Save server & deployment config for Public Wishlist
 await saveDeployServer(rootKv, {
  id: 'srv-test-1',
  name: 'Beacon SFO3',
  host: 'data.nateferrero.com',
  user: 'root',
  sshPort: 22,
  civilMemoryMode: 'local',
  civilMemoryUrl: 'http://127.0.0.1:3333',
 })
 await saveLaneDeployment(rootKv, {
  laneId: pubId,
  title: 'Public Wishlist',
  serverId: 'srv-test-1',
  slug: 'public-wishlist',
  port: 4101,
  routeMode: 'subpath',
  domain: 'data.nateferrero.com',
  subpath: '/public-wishlist',
  enableLetsEncrypt: true,
  publicUrl: 'https://data.nateferrero.com/public-wishlist',
  civilMemoryUrl: 'http://127.0.0.1:3333',
  dataBasePath: '/var/civil-command/public-wishlist/data',
  includeImports: false,
  kvReady: true,
 })

 // Save Inventory script that filters public items, syncs Public Wishlist tables, and deploys Public Wishlist
 const invLines = [
  `; to publicWishlistLaneId ${pubId}`,
  '; to categoryNameByCode ; object',
  '; to publicCategories {}',
  "; each $categories ( ; to { cat } $argv, ; to code [ match { $cat.code : !cat.code.trim } { true : '' } ], ; to name [ match { $cat.name : !cat.name.trim } { true : $code } ], ; condition { propertyIsGreaterThan 0 code.length } ( ; to categoryNameByCode $code $name, !publicCategories.push [ object { code $code } { name $name } ] ) )",
  '; to publicWishlistItems {}',
  "; each $wishlist ( ; to { item } $argv, ; to isPublic [ propertyIs true item.public ], ; to rawName [ match { [ propertyIs null item.name ] : '' } { [ propertyIs undefined item.name ] : '' } { true : ; add '' $item.name } ], ; to cleanName !rawName.trim, ; condition { and { propertyIs true isPublic } { propertyIsGreaterThan 0 cleanName.length } } ( ; to nextId ; add $publicWishlistItems.length 1, ; to catCode [ match { $item.category : !item.category.trim } { true : '' } ], ; to catName [ match { [ get categoryNameByCode $catCode ] : [ get categoryNameByCode $catCode ] } { true : $catCode } ], !publicWishlistItems.push [ object { id $nextId } { name $cleanName } { category $catCode } { categoryName $catName } ] ) )",
  '; to syncCategoriesResult !syncLaneTable $publicWishlistLaneId categories $publicCategories code',
  '; to syncWishlistResult !syncLaneTable $publicWishlistLaneId wishlist $publicWishlistItems id',
  '; to hasDataChange [ match { [ propertyIs true syncWishlistResult.changed ] : true } { [ propertyIs true syncCategoriesResult.changed ] : true } { true : false } ]',
  '; to wishlistDeployResult !deployLane $publicWishlistLaneId [ object { table wishlist } { recordCount $publicWishlistItems.length } { changed $hasDataChange } ]',
 ]
 await saveLaneScript(rootKv, rootKv.namespace(invId), invId, invLines, null)

 // Save Public Wishlist read-only HTTP server script
 const pubLines = [
  '; to categoryByCode ; object',
  '; to rawCategories [ match { [ !Array.isArray $categories ] : $categories } { true : {} } ]',
  "; each $rawCategories ( ; to { c } $argv, ; to code [ match { $c.code : !c.code.trim } { true : '' } ], ; to name [ match { $c.name : !c.name.trim } { true : $code } ], ; condition { propertyIsGreaterThan 0 code.length } : ; to categoryByCode $code $name )",
  '; to publicItems {}',
  '; to categoryCounts ; object',
  '; to rawWishlist [ match { [ !Array.isArray $wishlist ] : $wishlist } { true : {} } ]',
  "; each $rawWishlist ( ; to { row idx } $argv, ; to isDenied [ propertyIs false row.public ], ; to rawName [ match { [ propertyIs null row.name ] : '' } { [ propertyIs undefined row.name ] : '' } { true : ; add '' $row.name } ], ; to cleanName !rawName.trim, ; condition { and { propertyIs false isDenied } { propertyIsGreaterThan 0 cleanName.length } } ( ; to itemId [ match { [ propertyIsGreaterThan 0 row.id ] : $row.id } { true : ; add $idx 1 } ], ; to catCode [ match { $row.category : !row.category.trim } { true : '' } ], ; to mappedCatName [ get categoryByCode $catCode ], ; to catName [ match { $row.categoryName : $row.categoryName } { $mappedCatName : $mappedCatName } { true : $catCode } ], !publicItems.push [ object { id $itemId } { name $cleanName } { category $catCode } { categoryName $catName } ], ; to prevCount [ match { [ get categoryCounts $catCode ] : [ get categoryCounts $catCode ] } { true : 0 } ], ; to categoryCounts $catCode [ ; add $prevCount 1 ] ) )",
  '; to publicCategories {}',
  "; each $rawCategories ( ; to { c } $argv, ; to code [ match { $c.code : !c.code.trim } { true : '' } ], ; to name [ match { $c.name : !c.name.trim } { true : $code } ], ; condition { propertyIsGreaterThan 0 code.length } ( ; to cnt [ match { [ get categoryCounts $code ] : [ get categoryCounts $code ] } { true : 0 } ], !publicCategories.push [ object { code $code } { name $name } { value $code } { label $name } { count $cnt } ] ) )",
  '; to sanitizePublicItem ( ; to { it } $argv, ; object { id $it.id } { name $it.name } { category $it.category } { categoryName $it.categoryName } )',
  "; to checkReadAccess ( ; to { req } $argv, ; to m [ match { $req.method : $req.method } { true : GET } ], ; to p [ match { $req.path : $req.path } { true : '/' } ], [ match { [ !p.includes '..' ] : !req.respond 403 [ object { ok false } { error 'Access denied: invalid path' } ] } { [ propertyIs GET m ] : null } { [ propertyIs HEAD m ] : null } { [ propertyIs OPTIONS m ] : null } { true : !req.respond 405 [ object { ok false } { error 'Access denied: Public Wishlist is read-only' } ] } ] )",
  "; to parsePositiveInt ( ; to { raw fallback maxVal } $argv, ; to n [ match { [ propertyIs null raw ] : $fallback } { [ propertyIs undefined raw ] : $fallback } { [ propertyIs '' raw ] : $fallback } { true : !$Number $raw } ], ; to clean [ match { [ !Number.isFinite $n ] : !Math.trunc $n } { true : $fallback } ], ; to clampedMin [ match { [ propertyIsLessThan 1 clean ] : $fallback } { true : $clean } ], [ match { [ and { [ propertyIsGreaterThan 0 maxVal ] } { [ propertyIsGreaterThan $maxVal clampedMin ] } ] : $maxVal } { true : $clampedMin } ] )",
  "; to filterPublicItems ( ; to { query } $argv, ; to rawQ [ match { $query.q : ; add '' $query.q } { $query.search : ; add '' $query.search } { $query.name : ; add '' $query.name } { true : '' } ], ; to cleanQ !rawQ.trim, ; to qLower !cleanQ.toLowerCase, ; to rawCat [ match { $query.category : ; add '' $query.category } { true : '' } ], ; to cleanCat !rawCat.trim, ; to catLower !cleanCat.toLowerCase, ; to matched {}, ; each $publicItems ( ; to { it } $argv, ; to nameLower !it.name.toLowerCase, ; to codeLower !it.category.toLowerCase, ; to catNameLower !it.categoryName.toLowerCase, ; to nameOk [ match { [ propertyIs '' qLower ] : true } { [ !nameLower.includes $qLower ] : true } { true : false } ], ; to catOk [ match { [ propertyIs '' catLower ] : true } { [ propertyIs $catLower codeLower ] : true } { [ propertyIs $catLower catNameLower ] : true } { [ !catNameLower.includes $catLower ] : true } { true : false } ], ; condition { and { propertyIs true nameOk } { propertyIs true catOk } } : !matched.push [ !sanitizePublicItem $it ] ), ; object { items $matched } { q $cleanQ } { category $cleanCat } )",
  "; to paginatePublicItems ( ; to { filtered query } $argv, ; to page !parsePositiveInt $query.page 1 10000, ; to rawLimit [ match { $query.limit : $query.limit } { $query.pageSize : $query.pageSize } { $query.per_page : $query.per_page } { true : 10 } ], ; to limit !parsePositiveInt $rawLimit 10 100, ; to total $filtered.items.length, ; to rawPages !Math.ceil [ ; divide $total $limit ], ; to totalPages [ match { [ propertyIsGreaterThan 0 rawPages ] : $rawPages } { true : 1 } ], ; to startIdx ; multiply [ ; subtract $page 1 ] $limit, ; to endIdx ; add $startIdx $limit, ; to pageItems !filtered.items.slice $startIdx $endIdx, ; object { ok true } { items $pageItems } { total $total } { page $page } { pageSize $limit } { limit $limit } { totalPages $totalPages } { hasNextPage [ propertyIsLessThan $totalPages page ] } { hasPrevPage [ propertyIsGreaterThan 1 page ] } { filters [ object { q $filtered.q } { category $filtered.category } ] } )",
  "; to findPublicItemById ( ; to { rawId } $argv, ; to targetStr [ match { [ propertyIs null rawId ] : '' } { [ propertyIs undefined rawId ] : '' } { true : ; add '' $rawId } ], ; to cleanTarget !targetStr.trim, ; to found ; object { item null }, ; condition { propertyIsGreaterThan 0 cleanTarget.length } ( ; each $publicItems ( ; to { it } $argv, ; condition { propertyIs null found.item } ( ; to idStr ; add '' $it.id, ; condition { propertyIs $cleanTarget idStr } : ; set [ !sanitizePublicItem $it ] found.item ) ) ), $found.item )",
  "; to handleGetSingleItem ( ; to { req rawId } $argv, ; to cleanId [ match { $rawId : ; add '' $rawId } { true : '' } ], ; to trimmedId !cleanId.trim, [ match { [ propertyIs '' trimmedId ] : !req.respond 400 [ object { ok false } { error 'Item ID is required' } ] } { true ( ; to found !findPublicItemById $trimmedId, [ match { $found : ; object { ok true } { item $found } } { true : !req.respond 404 [ object { ok false } { error 'Wishlist item not found' } { id $trimmedId } ] } ] ) } ] )",
  "; to get ( ; to { req } $argv, ; to denied !checkReadAccess $req, [ match { $denied : $denied } { true ( ; to seg0 [ match { $req.segments.0 : $req.segments.0 } { true : '' } ], ; to seg1 [ match { $req.segments.1 : $req.segments.1 } { true : '' } ], ; to segLen $req.segments.length, [ match { [ and { [ propertyIs categories seg0 ] } { [ propertyIs 1 segLen ] } ] : ; object { ok true } { categories $publicCategories } { total $publicCategories.length } } { [ and { [ propertyIs items seg0 ] } { [ propertyIs search seg1 ] } { [ propertyIs 2 segLen ] } ] : !paginatePublicItems [ !filterPublicItems $req.query ] $req.query } { [ and { [ propertyIs items seg0 ] } { [ propertyIs 2 segLen ] } ] : !handleGetSingleItem $req $seg1 } { [ and { [ propertyIs wishlist seg0 ] } { [ propertyIs 2 segLen ] } ] : !handleGetSingleItem $req $seg1 } { [ and { [ propertyIs item seg0 ] } { [ propertyIs 2 segLen ] } ] : !handleGetSingleItem $req $seg1 } { [ and { [ propertyIs item seg0 ] } { [ propertyIs 1 segLen ] } ] : !handleGetSingleItem $req $req.query.id } { [ and { [ propertyIs search seg0 ] } { [ propertyIs 1 segLen ] } ] : !paginatePublicItems [ !filterPublicItems $req.query ] $req.query } { [ and { [ propertyIs items seg0 ] } { [ propertyIs 1 segLen ] } ] : !paginatePublicItems [ !filterPublicItems $req.query ] $req.query } { [ and { [ propertyIs wishlist seg0 ] } { [ propertyIs 1 segLen ] } ] : !paginatePublicItems [ !filterPublicItems $req.query ] $req.query } { [ propertyIs / req.path ] ( ; to paged !paginatePublicItems [ !filterPublicItems $req.query ] $req.query, ; to out ; object { ok true } { service 'Public Wishlist' } { readOnly true }, ; assign $out $paged [ object { categories $publicCategories } { endpoints [ object { items '/items' } { search '/search?q=&category=' } { categories '/categories' } { item '/items/:id' } ] } ], $out ) } { true : !req.respond 404 [ object { ok false } { error 'Not found' } { path $req.path } ] } ] ) } ] )",
  "; to denyWrite ( ; to { req } $argv, !req.respond 405 [ object { ok false } { error 'Method not allowed: Public Wishlist is read-only' } { method $req.method } ] )",
  '; to post $denyWrite',
  '; to put $denyWrite',
  '; to patch $denyWrite',
  '; to delete $denyWrite',
 ]
 await saveLaneScript(rootKv, rootKv.namespace(pubId), pubId, pubLines, null)

 let resyncCalls = []
 const mockResyncDeployedLane = async payload => {
  resyncCalls.push(payload)
  return {
   ok: true,
   slug: 'public-wishlist',
   laneId: payload.laneId,
   port: 4101,
   publicUrl: 'https://data.nateferrero.com/public-wishlist',
   deployedAt: '2026-11-26T14:00:00.000Z',
   syncedAt: '2026-11-26T14:00:00.000Z',
  }
 }

 let uuidSeq = 0
 const mockWindow = {
  Array,
  Boolean,
  Date: () => '2026-11-26T14:00:00.000Z',
  JSON,
  Math,
  Number,
  Object,
  Reflect,
  decodeURIComponent,
  crypto: { randomUUID: () => `uuid-${++uuidSeq}` },
  history: { pushState(_s, _t, url) { mockWindow.location.pathname = url } },
  location: { pathname: `/${invId};data|wishlist/${pubId};data|wishlist` },
  addEventListener() {},
  removeEventListener() {},
 }
 const mockDocument = { body: createMockElement('body'), defaultView: mockWindow, createElement: createMockElement }
 const origFetch = globalThis.fetch
 globalThis.fetch = async url => {
  if (url === '/src/lane-control.fs') return { text: async () => laneSource }
  if (url === '/src/lane-notebook.fs') return { text: async () => notebookSource }
  if (url === '/src/lane-inputs.fs') return { text: async () => inputsSource }
  if (url === '/src/lane-scope.fs') return { text: async () => scopeSource }
  if (url === '/src/lane-data.fs') return { text: async () => dataSource }
  if (url === '/src/confirm-modal.fs') return { text: async () => confirmModalSource }
  if (url === '/src/lane-row-picker-modal.fs') return { text: async () => rowPickerModalSource }
  if (url === '/src/lane-output.fs') return { text: async () => outputSource }
  if (url === '/src/lane-modal.fs') return { text: async () => modalSource }
  if (url === '/src/lane-config-modal.fs') return { text: async () => configModalSource }
  if (url === '/src/lane-import-modal.fs') return { text: async () => importModalSource }
  if (url === '/src/lane-rails.fs') return { text: async () => railsSource }
  if (url === '/src/lane-line-info-modal.fs') return { text: async () => lineInfoModalSource }
  if (url === '/src/lane-export-modal.fs') return { text: async () => exportModalSource }
  if (url === '/src/lane-export-deploy-modal.fs') return { text: async () => exportDeployModalSource }
  if (url === '/src/lane-server.fs') return { text: async () => laneServerSource }
  if (url === '/src/lane-story.fs') return { text: async () => laneStorySource }
  if (url === '/src/lane-servers-modal.fs') return { text: async () => laneServersModalSource }
  if (url === '/src/lane-terminal-modal.fs') return { text: async () => laneTerminalModalSource }
  if (url === '/src/lane-session-modal.fs') return { text: async () => sessionModalSource }
  if (url === '/src/lane-package-modal.fs') return { text: async () => packageModalSource }
  if (url === '/src/lane-dir-modal.fs') return { text: async () => dirModalSource }
  throw new Error(`Unexpected fetch: ${url}`)
 }

 try {
  const f = field({
   ...DATA_RUNTIME_ENV,
   console: { log() {} },
   createIdleTracker,
   data: rootKv,
   defaultValueForType,
   document: mockDocument,
   formatImportLine,
   hasImportCycle,
   normalizePrimitiveType,
   parseImportLine,
   primitiveTypes: PRIMITIVE_TYPES,
   resolveImportValue,
   resolveScopeColumns,
   resyncDeployedLane: mockResyncDeployedLane,
   runLines,
   runTransportedScripts,
   window: mockWindow,
  })
  await f.run(parse(mainSource, '/src/main.fs'))

  const laneControl = f.state['lane-control']
  const invLane = laneControl['by-id'][invId]
  const pubLane = laneControl['by-id'][pubId]
  const invDv = invLane.notebook['data-view']
  const pubDv = pubLane.notebook['data-view']

  // Verify Updates section is mounted directly above rows-section inside active-el
  const activeChildren = invDv['active-el'].children
  const updatesIdx = activeChildren.indexOf(invDv['updates-section'])
  const rowsIdx = activeChildren.indexOf(invDv['rows-section'])
  assert.ok(updatesIdx !== -1 && rowsIdx !== -1 && updatesIdx < rowsIdx, 'Updates section must be mounted directly above rows-section')
  assert.equal(invDv['updates-title'].textContent, 'Updates')

  // Verify package access check blocks syncLaneTable and deployLane to a locked package lane
  const lockedSyncRes = await laneControl['sync-lane-table'](invId, lockedId, 'wishlist', [{ id: 1, name: 'x' }], 'id')
  assert.equal(lockedSyncRes.ok, false)
  assert.match(lockedSyncRes.error, /Access denied/)
  const lockedDeployRes = await laneControl['deploy-lane'](invId, lockedId, { table: 'wishlist' }, null)
  assert.equal(lockedDeployRes.ok, false)
  assert.match(lockedDeployRes.error, /Access denied/)

  // Now toggle row 2 ("USB-C to USB-A adapters") in Inventory.wishlist to public = true while on the Data tab!
  const row2Checkbox = invDv['grid-rows'][1].cells[2]['input-el']
  assert.equal(row2Checkbox.checked, false)
  row2Checkbox.checked = true
  await row2Checkbox.listeners.change()

  // Inventory script ran automatically on Data tab record change, synced 2 public items to Public Wishlist, and deployed!
  assert.equal(resyncCalls.length, 1)
  assert.equal(pubDv.tables[1].rows.length, 2)
  assert.equal(invDv['updates-section'].hidden, false)
  assert.equal(invDv['updates-count-badge'].textContent, '1')
  assert.equal(invDv['updates-status-badge'].textContent, 'Live · Up to date')
  assert.equal(invDv['update-rows'].length, 1)
  assert.equal(invDv['update-rows'][0]['badge-el'].textContent, 'Deployed ✓')
  assert.equal(invDv['update-rows'][0]['lane-btn'].textContent, 'Public Wishlist ↗')
  assert.match(invDv['update-rows'][0]['summary-el'].textContent, /Synced 2 public items & deployed to Beacon SFO3/)
  assert.equal(invDv['update-rows'][0]['url-el'].href, 'https://data.nateferrero.com/public-wishlist')

  // Verify Public Wishlist HTTP server endpoints against the 2 synced public items (and 0 private items)
  const currentPubTables = await loadLaneTables(rootKv, rootKv.namespace(pubId), pubId)
  const listResp = await simulateLaneRequest({
   lines: pubLines,
   tables: currentPubTables,
   laneId: pubId,
   req: { method: 'GET', url: '/items?page=1&limit=1' },
  })
  assert.equal(listResp.status, 200)
  const listJson = JSON.parse(listResp.bodyText)
  assert.equal(listJson.ok, true)
  assert.equal(listJson.total, 2)
  assert.equal(listJson.page, 1)
  assert.equal(listJson.limit, 1)
  assert.equal(listJson.totalPages, 2)
  assert.equal(listJson.hasNextPage, true)
  assert.equal(listJson.items.length, 1)
  assert.equal(listJson.items[0].name, 'black dot stickers to cover leds')

  // Search by name or category
  const searchResp = await simulateLaneRequest({
   lines: pubLines,
   tables: currentPubTables,
   laneId: pubId,
   req: { method: 'GET', url: '/search?q=usb-c&category=electronics_adapters' },
  })
  assert.equal(searchResp.status, 200)
  const searchJson = JSON.parse(searchResp.bodyText)
  assert.equal(searchJson.total, 1)
  assert.equal(searchJson.items[0].id, 2)
  assert.equal(searchJson.items[0].name, 'USB-C to USB-A adapters')

  // List categories for UI selection
  const catsResp = await simulateLaneRequest({
   lines: pubLines,
   tables: currentPubTables,
   laneId: pubId,
   req: { method: 'GET', url: '/categories' },
  })
  assert.equal(catsResp.status, 200)
  const catsJson = JSON.parse(catsResp.bodyText)
  assert.equal(catsJson.total, 3)
  assert.equal(catsJson.categories.find(c => c.code === 'stationery').count, 1)
  assert.equal(catsJson.categories.find(c => c.code === 'electronics_adapters').count, 1)
  assert.equal(catsJson.categories.find(c => c.code === 'art_supplies').count, 0)

  // Get single item + 404 on non-existent item + 405 on POST write attempt
  const item2Resp = await simulateLaneRequest({
   lines: pubLines,
   tables: currentPubTables,
   laneId: pubId,
   req: { method: 'GET', url: '/items/2' },
  })
  assert.equal(item2Resp.status, 200)
  assert.equal(JSON.parse(item2Resp.bodyText).item.name, 'USB-C to USB-A adapters')

  const missingResp = await simulateLaneRequest({
   lines: pubLines,
   tables: currentPubTables,
   laneId: pubId,
   req: { method: 'GET', url: '/items/3' },
  })
  assert.equal(missingResp.status, 404)

  const postResp = await simulateLaneRequest({
   lines: pubLines,
   tables: currentPubTables,
   laneId: pubId,
   req: { method: 'POST', url: '/items', body: { name: 'hack' } },
  })
  assert.equal(postResp.status, 405)

  // Now uncheck public on row 2 -> automatically removes row 2 from Public Wishlist, deletes stale row key from KV, and redeploys!
  const removedRowId = pubDv.tables[1].rows[1].id
  assert.equal(kv.has(tableRowKey(pubId, 'tbl-pub-wish', removedRowId)), true)
  row2Checkbox.checked = false
  await row2Checkbox.listeners.change()

  assert.equal(resyncCalls.length, 2)
  assert.equal(pubDv.tables[1].rows.length, 1)
  assert.equal(kv.has(tableRowKey(pubId, 'tbl-pub-wish', removedRowId)), false, 'Removed non-public row key must be deleted from Public Wishlist KV storage')
  assert.equal(invDv['updates-count-badge'].textContent, '2')
  assert.match(invDv['update-rows'][0]['summary-el'].textContent, /Synced 1 public item & deployed to Beacon SFO3/)
 }
 finally {
  globalThis.fetch = origFetch
 }
})

test('lane-server.mjs: concurrent request isolation across objects, Data tables, and imports with 0 per-request KV script/table reads', async () => {
 const store = new Map()
 const getCounts = new Map()
 function makeMemKv(prefix = '') {
  return {
   async get(key) {
    const full = prefix ? `${prefix}:${key}` : key
    getCounts.set(full, (getCounts.get(full) || 0) + 1)
    return store.has(full) ? store.get(full) : null
   },
   async set(key, value) {
    const full = prefix ? `${prefix}:${key}` : key
    store.set(full, String(value ?? ''))
   },
   async delete(key) {
    const full = prefix ? `${prefix}:${key}` : key
    store.delete(full)
   },
   namespace(ns) {
    return makeMemKv(prefix ? `${prefix}:${ns}` : ns)
   },
  }
 }
 const kv = makeMemKv()
 const mainId = 'iso-main'
 const depId = 'iso-dep'

 // Two-party async external barrier so Request A and Request B overlap in flight across isolated subprocesses
 let barrierWaiters = []
 const barrierUrl = 'https://barrier.example.test/barrier'
 const barrierFetch = async url => {
  assert.equal(url, barrierUrl)
  await new Promise(resolve => {
   barrierWaiters.push(resolve)
   if (barrierWaiters.length === 2) {
    const ready = barrierWaiters
    barrierWaiters = []
    for (const r of ready) {
     r()
    }
   }
  })
  return { ok: true, status: 200, text: async () => 'go' }
 }

 await writeLaneSyncBundleToKv(kv, {
  mainLaneId: mainId,
  includeImports: true,
  lanes: [
   {
    id: depId,
    title: 'Dep Cfg',
    inputsRaw: null,
    records: [
     { id: 'd1', text: '; to cfg [ object { owner \'default\' } { nested [ object { count 1 } ] } ]', updatedAt: null },
    ],
    tables: [],
   },
   {
    id: mainId,
    title: 'Isolation API',
    inputsRaw: null,
    records: [
     { id: 'm1', text: '; to sharedObj [ object { user \'init\' } { tags [ list ] } ]', updatedAt: null },
     { id: 'm2', text: `; to depCfg !importLane ${depId} cfg`, updatedAt: null },
     {
      id: 'm3',
      text: `; to post (\n ; to { req } $argv\n ; to who $req.body.user\n ; set $who sharedObj.user\n !sharedObj.tags.push $who\n ; set $who depCfg.owner\n ; set [ add $depCfg.nested.count $req.body.delta ] depCfg.nested.count\n !items.push [ object { label $who } ]\n ; to bResp !fetch '${barrierUrl}'\n !bResp.text\n ; object { seenUser $sharedObj.user } { tagsLen $sharedObj.tags.length } { depOwner $depCfg.owner } { depCount $depCfg.nested.count } { itemCount $items.length } { lastItem $items.1.label }\n)`,
      updatedAt: null,
     },
     {
      id: 'm4',
      text: '; to get (\n ; object { user $sharedObj.user } { depOwner $depCfg.owner } { depCount $depCfg.nested.count } { itemCount $items.length }\n)',
      updatedAt: null,
     },
    ],
    tables: [{
     id: 't1',
     name: 'items',
     columns: [{ id: 'c1', name: 'label', type: 'text', multiple: false }],
     rows: [{ id: 'r1', values: { c1: 'base' } }],
    }],
   },
  ],
 })

 const srv = createLaneHttpServer({
  slug: 'iso-api',
  laneId: mainId,
  includeImports: true,
  logRequests: false,
  autoReload: false,
 }, { kv, fetch: barrierFetch })

 try {
  const initStatus = await srv.reload()
  assert.equal(initStatus.ok, true)
  assert.equal(initStatus.reloadGeneration, 1)
  assert.ok(typeof initStatus.revision === 'string' && initStatus.revision.length === 16)
  assert.ok(typeof initStatus.scriptHash === 'string' && initStatus.scriptHash.length === 16)
  assert.deepEqual(initStatus.loadedLaneIds, [mainId, depId])

  const addr = await srv.listen(0, '127.0.0.1')
  getCounts.clear()

  const [respAlice, respBob] = await Promise.all([
   fetch(`http://127.0.0.1:${addr.port}/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user: 'alice', delta: 10 }),
   }),
   fetch(`http://127.0.0.1:${addr.port}/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user: 'bob', delta: 20 }),
   }),
  ])

  assert.equal(respAlice.status, 200)
  assert.equal(respBob.status, 200)
  assert.equal(respAlice.headers.get('x-civil-lane-rev'), initStatus.revision)
  assert.match(respAlice.headers.get('access-control-expose-headers') || '', /X-Civil-Lane-Rev/)

  const aliceBody = await respAlice.json()
  const bobBody = await respBob.json()
  assert.deepEqual(aliceBody, {
   seenUser: 'alice',
   tagsLen: 1,
   depOwner: 'alice',
   depCount: 11,
   itemCount: 2,
   lastItem: 'alice',
  })
  assert.deepEqual(bobBody, {
   seenUser: 'bob',
   tagsLen: 1,
   depOwner: 'bob',
   depCount: 21,
   itemCount: 2,
   lastItem: 'bob',
  })

  // Clean follow-up GET sees unmodified frozen baseline
  const cleanGet = await fetch(`http://127.0.0.1:${addr.port}/`).then(r => r.json())
  assert.deepEqual(cleanGet, {
   user: 'init',
   depOwner: 'default',
   depCount: 1,
   itemCount: 1,
  })

  // OPTIONS & 405 fast paths + overall zero script/table reads across requests
  const optResp = await fetch(`http://127.0.0.1:${addr.port}/`, { method: 'OPTIONS' })
  assert.equal(optResp.status, 204)
  assert.equal(optResp.headers.get('x-civil-lane-rev'), initStatus.revision)
  const delResp = await fetch(`http://127.0.0.1:${addr.port}/`, { method: 'DELETE' })
  assert.equal(delResp.status, 405)

  assert.equal(getCounts.size, 0, `Expected 0 KV reads across request evaluations, saw: ${Array.from(getCounts.keys()).join(', ')}`)
 }
 finally {
  await srv.close()
 }
})

test('lane-server.mjs: generation-queued reload() barrier & KV outage preserves last-known-good snapshot', async () => {
 const store = new Map()
 let pauseFirstScriptRead = false
 let pauseStartedResolve = null
 let pauseStarted = new Promise(resolve => { pauseStartedResolve = resolve })
 let resumeFirstRead = null
 let kvOutage = false

 function makeMemKv(prefix = '') {
  return {
   async get(key) {
    if (kvOutage) {
     throw new Error('ECONNREFUSED simulated KV outage')
    }
    const full = prefix ? `${prefix}:${key}` : key
    if (pauseFirstScriptRead && !prefix && key === 'lanes#barrier-lane/script-index') {
     pauseFirstScriptRead = false
     pauseStartedResolve()
     await new Promise(resolve => { resumeFirstRead = resolve })
    }
    return store.has(full) ? store.get(full) : null
   },
   async set(key, value) {
    const full = prefix ? `${prefix}:${key}` : key
    store.set(full, String(value ?? ''))
   },
   async delete(key) {
    const full = prefix ? `${prefix}:${key}` : key
    store.delete(full)
   },
   namespace(ns) {
    return makeMemKv(prefix ? `${prefix}:${ns}` : ns)
   },
  }
 }

 const kv = makeMemKv()
 const laneId = 'barrier-lane'
 await saveLaneScript(kv, kv.namespace(laneId), laneId, ['; to ver 1', '$ver'], null)

 const srv = createLaneHttpServer({
  slug: 'barrier-test',
  laneId,
  logRequests: false,
  autoReload: false,
 }, { kv })

 try {
  await srv.reload()
  const addr = await srv.listen(0, '127.0.0.1')
  assert.equal(await fetch(`http://127.0.0.1:${addr.port}/`).then(r => r.json()), 1)

  // Pause reload #1 mid-flight, update KV to ver=2, then issue concurrent reload #2
  pauseFirstScriptRead = true
  const pReload1 = srv.reload()
  await pauseStarted
  await saveLaneScript(kv, kv.namespace(laneId), laneId, ['; to ver 2', '$ver'], null)
  const pReload2 = srv.reload()
  resumeFirstRead()

  const [r1, r2] = await Promise.all([pReload1, pReload2])
  assert.equal(r1.ok, true)
  assert.equal(r2.ok, true)
  assert.ok(r2.reloadGeneration > r1.reloadGeneration)
  assert.equal(r2.scriptHash, computeLaneScriptHash(['; to ver 2', '$ver']))
  assert.equal(await fetch(`http://127.0.0.1:${addr.port}/`).then(r => r.json()), 2)

  // KV outage during POST /_cc/reload returns 500 but leaves last-known-good snapshot serving 200
  kvOutage = true
  const failReload = await fetch(`http://127.0.0.1:${addr.port}/_cc/reload`, { method: 'POST' })
  assert.equal(failReload.status, 500)
  const failBody = await failReload.json()
  assert.equal(failBody.ok, false)
  assert.equal(failBody.reloaded, false)
  assert.match(failBody.error, /ECONNREFUSED/)
  assert.equal(await fetch(`http://127.0.0.1:${addr.port}/`).then(r => r.json()), 2)

  // Recover KV and mutate to ver=3
  kvOutage = false
  await saveLaneScript(kv, kv.namespace(laneId), laneId, ['; to ver 3', '$ver'], null)
  const recoverReload = await fetch(`http://127.0.0.1:${addr.port}/_cc/reload`, { method: 'POST' })
  assert.equal(recoverReload.status, 200)
  const recBody = await recoverReload.json()
  assert.equal(recBody.ok, true)
  assert.equal(recBody.reloaded, true)
  assert.equal(await fetch(`http://127.0.0.1:${addr.port}/`).then(r => r.json()), 3)
 }
 finally {
  await srv.close()
 }
})

test('KV write triggers, cc-server.mjs triggers, deduplicated /_cc/reload, auto-reload poller, and loop immunity', async () => {
 // 1. Pure trigger matching & loop exclusions
 assert.deepEqual(resolveMatchingTriggerTargets('lanes#lane-1/script/l1'), ['triggers#lanes/lane-1'])
 assert.deepEqual(resolveMatchingTriggerTargets('lanes#lane-1/tables/t1/rows/r1'), ['triggers#lanes/lane-1'])
 assert.deepEqual(resolveMatchingTriggerTargets('lanes#lane-1/tables/t1/updates'), [])
 assert.deepEqual(resolveMatchingTriggerTargets('lanes#lane-1/tables/t1/updates-index'), [])
 assert.deepEqual(resolveMatchingTriggerTargets('stories#lane-1/r/2026-01-01/run-1'), [])
 assert.deepEqual(resolveMatchingTriggerTargets('triggers#lanes/lane-1'), [])
 assert.deepEqual(resolveMatchingTriggerTargets('lane-1.hits'), [])
 assert.deepEqual(resolveMatchingTriggerTargets('lane-1.title'), ['triggers#lanes/lane-1'])
 assert.deepEqual(resolveMatchingTriggerTargets('lane.v1.title'), ['triggers#lanes/lane%2Ev1'])
 assert.equal(isTriggerExcludedKey('triggers#lanes/lane-1'), true)
 assert.equal(isTriggerExcludedKey('stories#lane-1/idx/root'), true)
 assert.equal(isTriggerExcludedKey('lanes#lane-1/tables/t1/updates/u1'), true)
 assert.equal(laneTriggerKey('lane.v1'), 'triggers#lanes/lane%2Ev1')
 assert.equal(normalizeAutoReloadConfig({ enabled: true, intervalMs: 5 }).intervalMs, 20)
 assert.equal(normalizeAutoReloadConfig(false, {}).enabled, false)
 assert.equal(normalizeServerLimits({}, { CC_MAX_IMPORT_DEPTH: '12', CC_MAX_EXECUTION_MS: '5000' }).maxImportDepth, 12)
 assert.equal(normalizeServerLimits({}, { CC_MAX_IMPORT_DEPTH: '12', CC_MAX_EXECUTION_MS: '5000' }).maxExecutionMs, 5000)
 assert.ok(DEFAULT_AUTO_RELOAD_CONFIG.intervalMs >= 1000)
 assert.ok(DEFAULT_SERVER_LIMITS.maxImportDepth >= 16)

 // Custom trigger rules test via withKvTriggers
 const customMap = new Map()
 const customRaw = {
  async get(k) { return customMap.has(k) ? customMap.get(k) : null },
  async set(k, v) { customMap.set(k, String(v)) },
  async delete(k) { customMap.delete(k) },
  namespace(ns) {
   return {
    async get(k) { return customRaw.get(`${ns}:${k}`) },
    async set(k, v) { return customRaw.set(`${ns}:${k}`, v) },
    async delete(k) { return customRaw.delete(`${ns}:${k}`) },
   }
  },
 }
 const trigKv = withKvTriggers(customRaw, [{ match: 'items/<itemId>/body', target: 'triggers#items/<itemId>' }])
 await trigKv.set('items/box-7/body', 'hello')
 const stamp = parseTriggerStamp(customMap.get('triggers#items/box-7'))
 assert.equal(stamp.key, 'items/box-7/body')
 assert.equal(stamp.op, 'set')

 // 2. Live cc-server.mjs + auto-reload + /_cc/reload noop & force + loop immunity
 const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cc-cm-trig-'))
 let cmChild = null
 let cmExit = null
 let laneSrv = null
 try {
  const defaultData = path.join(tmpDir, 'data')
  await fs.mkdir(path.join(tmpDir, 'dist', 'kv'), { recursive: true })
  await fs.writeFile(path.join(tmpDir, 'package.json'), JSON.stringify({ name: '@tagmein/civil-memory', version: '0.1.5' }))
  await fs.writeFile(path.join(tmpDir, 'dist', 'kv', 'diskKV.js'), [
   'exports.diskKV = function diskKV({ rootDir, fsPromises, path }) {',
   ' async function resolveKey(fullKey) {',
   '  const parts = fullKey.includes("#") ? fullKey.split("#") : ["main", fullKey]',
   '  const ns = parts.shift() || "main"',
   '  const k = parts.join("#") || "index"',
   '  const segs = [encodeURIComponent(ns.split("/").map(encodeURIComponent).join("/")), ...k.split("/").map(encodeURIComponent)]',
   '  const leaf = segs.pop()',
   '  if (segs.length > 0) await fsPromises.mkdir(path.join(rootDir, ...segs), { recursive: true })',
   '  return path.join(rootDir, ...segs, leaf)',
   ' }',
   ' return {',
   '  async get(k) { try { return (await fsPromises.readFile(await resolveKey(k))).toString("utf8") } catch { return null } },',
   '  async set(k, v) { await fsPromises.writeFile(await resolveKey(k), String(v), "utf8") },',
   '  async delete(k) { try { await fsPromises.unlink(await resolveKey(k)) } catch {} },',
   ' }',
   '}',
  ].join('\n'))
  await fs.writeFile(path.join(tmpDir, 'cc-server.mjs'), generateCivilMemoryServerScript())

  const cmPort = await new Promise((resolve, reject) => {
   const s = net.createServer()
   s.unref()
   s.on('error', reject)
   s.listen(0, '127.0.0.1', () => {
    const { port } = s.address()
    s.close(() => resolve(port))
   })
  })
  let logs = ''
  cmChild = spawn(process.execPath, [path.join(tmpDir, 'cc-server.mjs')], {
   cwd: tmpDir,
   env: { ...process.env, HOST: '127.0.0.1', PORT: String(cmPort), DEFAULT_BASE_PATH: defaultData },
   stdio: ['ignore', 'pipe', 'pipe'],
  })
  cmChild.stdout.on('data', d => { logs += d.toString('utf8') })
  cmChild.stderr.on('data', d => { logs += d.toString('utf8') })
  cmExit = new Promise(resolve => cmChild.once('exit', resolve))

  let health = null
  const deadline = Date.now() + 8000
  while (Date.now() < deadline) {
   try {
    const r = await fetch(`http://127.0.0.1:${cmPort}/health`)
    if (r.ok) {
     health = await r.json()
     break
    }
   }
   catch {}
   await new Promise(r => setTimeout(r, 30))
  }
  assert.ok(health, `cc-server failed to start: ${logs}`)
  assert.equal(health.triggersEnabled, true)

  const cmUrl = `http://127.0.0.1:${cmPort}/?mode=disk`
  // Bare httpKV (NO client-side triggers) relies on cc-server.mjs server-side triggers
  const kvClient = httpKV({ baseUrl: cmUrl, switchable: false })
  const laneId = 'auto-lane'
  await writeLaneSyncBundleToKv(kvClient, {
   mainLaneId: laneId,
   includeImports: false,
   lanes: [{
    id: laneId,
    title: 'Auto Lane',
    inputsRaw: null,
    records: [{
     id: 'l1',
     text: '; to get (\n ; to prev [ !data.get hits ]\n ; to n ; add [ match { $prev : !JSON.parse $prev } { true : 0 } ] 1\n !data.set hits [ ; add \'\' $n ]\n ; object { ver 1 } { hits $n }\n)',
     updatedAt: null,
    }],
    tables: [],
   }],
  })

  const stamp1 = parseTriggerStamp(await kvClient.get(laneTriggerKey(laneId)))
  assert.ok(stamp1 && typeof stamp1.rev === 'string' && stamp1.rev.length > 0, 'cc-server.mjs should write trigger stamp automatically')

  laneSrv = createLaneHttpServer({
   slug: 'auto-lane',
   laneId,
   civilMemoryUrl: cmUrl,
   logRequests: false,
   autoReload: { enabled: true, intervalMs: 35, debounceMs: 10, maxReloadsPerMinute: 60 },
  })
  await laneSrv.reload()
  const laneAddr = await laneSrv.listen(0, '127.0.0.1')
  const base = `http://127.0.0.1:${laneAddr.port}`

  const g1 = await fetch(`${base}/`).then(r => r.json())
  assert.deepEqual(g1, { ver: 1, hits: 1 })
  // Handler !data.set hits wrote auto-lane.hits — must NOT touch trigger stamp or cause auto-reload
  const stampAfterHit = parseTriggerStamp(await kvClient.get(laneTriggerKey(laneId)))
  assert.equal(stampAfterHit.rev, stamp1.rev)
  await fetch(`${base}/`).then(r => r.json())
  await new Promise(r => setTimeout(r, 120))
  assert.equal((await fetch(`${base}/_cc/health`).then(r => r.json())).reloadGeneration, 1)

  // Update lane script out-of-band WITHOUT calling /_cc/reload
  await saveLaneScript(kvClient, kvClient.namespace(laneId), laneId, [
   '; to get (\n ; object { ver 2 } { hits [ !data.get hits ] }\n)',
  ], null)

  let h2 = null
  const pollDeadline = Date.now() + 3000
  while (Date.now() < pollDeadline) {
   const curHealth = await fetch(`${base}/_cc/health`).then(r => r.json())
   if (curHealth.reloadGeneration >= 2) {
    h2 = curHealth
    break
   }
   await new Promise(r => setTimeout(r, 25))
  }
  assert.ok(h2 && h2.reloadGeneration === 2, 'Auto-reload poller should reload automatically on trigger stamp change')
  const g2 = await fetch(`${base}/`).then(r => r.json())
  assert.equal(g2.ver, 2)

  // Subsequent POST /_cc/reload is deduplicated as noop: true
  const noopResp = await fetch(`${base}/_cc/reload`, { method: 'POST' }).then(r => r.json())
  assert.equal(noopResp.ok, true)
  assert.equal(noopResp.reloaded, false)
  assert.equal(noopResp.noop, true)
  assert.equal(noopResp.reloadGeneration, 2)

  // POST /_cc/reload?force=1 forces reload even with matching trigger stamp
  const forceResp = await fetch(`${base}/_cc/reload?force=1`, { method: 'POST' }).then(r => r.json())
  assert.equal(forceResp.ok, true)
  assert.equal(forceResp.reloaded, true)
  assert.equal(forceResp.noop, false)
  assert.equal(forceResp.reloadGeneration, 3)

  // Broken deterministic script loads ONCE (generation 4) and does NOT loop-reload
  await saveLaneScript(kvClient, kvClient.namespace(laneId), laneId, ['!nonExistentStartupFn 123'], null)
  let h4 = null
  const errDeadline = Date.now() + 3000
  while (Date.now() < errDeadline) {
   const curHealth = await fetch(`${base}/_cc/health`).then(r => r.json())
   if (curHealth.reloadGeneration >= 4) {
    h4 = curHealth
    break
   }
   await new Promise(r => setTimeout(r, 25))
  }
  assert.ok(h4 && h4.reloadGeneration === 4)
  assert.equal(h4.ok, false)
  assert.match(h4.error, /is not a function/)
  await new Promise(r => setTimeout(r, 150))
  const h4Later = await fetch(`${base}/_cc/health`).then(r => r.json())
  assert.equal(h4Later.reloadGeneration, 4, 'Deterministic script error must NOT trigger infinite auto-reload loop')
 }
 finally {
  if (laneSrv) {
   await laneSrv.close()
  }
  if (cmChild) {
   cmChild.kill('SIGTERM')
   await cmExit
  }
  await fs.rm(tmpDir, { recursive: true, force: true })
 }
})

test('agentListDeployments --ping liveCodeMatches & /api/deploy/kv/sync reloadUrl integration', async () => {
 const store = new Map()
 function makeMemKv(prefix = '') {
  return {
   async get(key) {
    const full = prefix ? `${prefix}:${key}` : key
    return store.has(full) ? store.get(full) : null
   },
   async set(key, value) {
    const full = prefix ? `${prefix}:${key}` : key
    store.set(full, String(value ?? ''))
   },
   async delete(key) {
    const full = prefix ? `${prefix}:${key}` : key
    store.delete(full)
   },
   namespace(ns) {
    return makeMemKv(prefix ? `${prefix}:${ns}` : ns)
   },
  }
 }
 const rootKv = makeMemKv()
 const laneId = 'dep-match-lane'
 await saveLaneScript(rootKv, rootKv.namespace(laneId), laneId, ['; to x 42', '$x'], null)

 const srv = createLaneHttpServer({
  slug: 'dep-match-lane',
  laneId,
  logRequests: false,
  autoReload: false,
 }, { kv: rootKv })
 const reloadCalls = []
 const syncMockCm = http.createServer((_req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' })
  res.end('ok')
 })
 const reloadSpy = http.createServer((req, res) => {
  reloadCalls.push({ method: req.method, url: req.url })
  res.writeHead(200, { 'Content-Type': 'application/json' })
  res.end('{"ok":true}')
 })
 const apiServer = http.createServer((req, res) => {
  handleDeployApiRequest(req, res, { rootDir: process.cwd() })
 })

 try {
  await srv.reload()
  const addr = await srv.listen(0, '127.0.0.1')
  await Promise.all([
   new Promise(r => syncMockCm.listen(0, '127.0.0.1', r)),
   new Promise(r => reloadSpy.listen(0, '127.0.0.1', r)),
   new Promise(r => apiServer.listen(0, '127.0.0.1', r)),
  ])
  const cmPort = syncMockCm.address().port
  const spyPort = reloadSpy.address().port
  const apiPort = apiServer.address().port

  await saveLaneDeployment(rootKv, {
   laneId,
   slug: 'dep-match-lane',
   port: addr.port,
   publicUrl: `http://127.0.0.1:${addr.port}`,
   lastDeployedAt: new Date().toISOString(),
  })

  const listed1 = await agentListDeployments(rootKv, { ping: true })
  assert.equal(listed1.ok, true)
  assert.equal(listed1.deployments.length, 1)
  const d1 = listed1.deployments[0]
  assert.equal(d1.expectedScriptHash, computeLaneScriptHash(['; to x 42', '$x']))
  assert.equal(d1.liveScriptHash, d1.expectedScriptHash)
  assert.equal(d1.liveCodeMatches, true)
  assert.ok(typeof d1.liveRevision === 'string' && d1.liveRevision.length === 16)

  // Mutate local KV script without calling /_cc/reload -> liveCodeMatches flips false!
  await saveLaneScript(rootKv, rootKv.namespace(laneId), laneId, ['; to x 99', '$x'], null)
  const listed2 = await agentListDeployments(rootKv, { ping: true })
  const d2 = listed2.deployments[0]
  assert.equal(d2.expectedScriptHash, computeLaneScriptHash(['; to x 99', '$x']))
  assert.equal(d2.liveScriptHash, d1.liveScriptHash)
  assert.equal(d2.liveCodeMatches, false)

  // Verify /api/deploy/kv/sync forwards reloadUrl
  const syncResp = await fetch(`http://127.0.0.1:${apiPort}/api/deploy/kv/sync`, {
   method: 'POST',
   headers: { 'Content-Type': 'application/json' },
   body: JSON.stringify({
    url: `http://127.0.0.1:${cmPort}`,
    reloadUrl: `http://127.0.0.1:${spyPort}/_cc/reload`,
    bundle: { mainLaneId: 'x', includeImports: false, lanes: [{ id: 'x', title: 'X', records: [{ id: 'r1', text: '1' }], tables: [] }] },
   }),
  }).then(r => r.json())
  assert.equal(syncResp.ok, true)
  assert.equal(syncResp.reloaded, true)
  assert.equal(reloadCalls.length, 1)
  assert.deepEqual(reloadCalls[0], { method: 'POST', url: '/_cc/reload' })
 }
 finally {
  await srv.close()
  for (const s of [syncMockCm, reloadSpy, apiServer]) {
   if (typeof s.closeAllConnections === 'function') { s.closeAllConnections() }
  }
  await Promise.all([
   new Promise(r => syncMockCm.close(r)),
   new Promise(r => reloadSpy.close(r)),
   new Promise(r => apiServer.close(r)),
  ])
 }
})
