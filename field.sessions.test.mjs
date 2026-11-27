import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import { EventEmitter } from 'node:events'
import { spawn } from 'node:child_process'
import {
 DATA_RUNTIME_ENV,
 DEFAULT_KV_CHUNK_BYTES,
 DEFAULT_PACKAGE_ID,
 KV_CHUNK_BYTES_ENV_VAR,
 KV_CHUNK_BYTES_GLOBAL,
 MAX_KV_VALUE_BYTES,
 MCP_TOOLS,
 PRIMITIVE_TYPES,
 SECRET_MASK,
 SESSION_STORAGE_KEY,
 SESSION_TOKEN_HEADER,
 STORY_NAMESPACE,
 addLaneTable,
 addTableRow,
 agentEvalLane,
 agentGetLane,
 agentMutateLaneScript,
 agentMutateLaneTable,
 bindSecretStoreToKv,
 buildBreadcrumbs,
 buildDataUrl,
 checkExportTargetsAccess,
 closePackageInSession,
 createAgentEventHub,
 createCapabilityToken,
 createDataProxyHandler,
 createDirectory,
 createFileBackedServerSecretStore,
 createIdleTracker,
 createNewSession,
 createPackage,
 createServerSecretStore,
 defaultValueForType,
 deletePagedIds,
 dirModalSource,
 encodeKeySegment,
 exportDeployModalSource,
 exportModalSource,
 field,
 formatAgentContext,
 formatAgentPrompt,
 formatDataDirLabel,
 formatImportLine,
 getKvChunkBytes,
 handleAgentApiRequest,
 handleFsApiRequest,
 handleMcpJsonRpc,
 hasImportCycle,
 httpKV,
 initSessionState,
 inspectSessionForAgent,
 isAllowedLocalHost,
 isAllowedLocalOrigin,
 kvDeleteChunked,
 kvGetChunked,
 kvSetChunked,
 lanePackageKey,
 laneServerSource,
 laneServersModalSource,
 laneStorySource,
 laneTerminalModalSource,
 lineInfoModalSource,
 listAvailableSessions,
 listDirectories,
 listDisks,
 loadLaneScript,
 loadLaneSecretRecord,
 loadLaneTables,
 normalizeDataDir,
 normalizeExportTargetsAndValue,
 normalizeKvChunkBytes,
 normalizePrimitiveType,
 normalizeSessionLinkIds,
 openPackageInSession,
 packageLaneKey,
 packageModalSource,
 parse,
 parseImportLine,
 parseProcMounts,
 readPagedIds,
 registerLaneInPackage,
 renameSession,
 resolveImportValue,
 resolveKvChunkBytes,
 resolveScopeColumns,
 resolveSessionLinks,
 runLines,
 runTransportedScripts,
 saveLaneScript,
 scriptLineKey,
 sessionMetaKey,
 sessionModalSource,
 setKvChunkBytes,
 setLaneSecret,
 setSessionDataDir,
 setSessionLinks,
 spawnPty,
 splitUtf8Chunks,
 switchBrowserSession,
 tableRowKey,
 tableSchemaKey,
 unescapeMountPath,
 unlockPackagesForExport,
 utf8ByteLength,
 writePagedIds,
} from './field.fixtures.mjs'

test('kv-config: 16 KiB default, env/startup/global overrides, and validation', async () => {
 assert.equal(DEFAULT_KV_CHUNK_BYTES, 16384)
 assert.equal(KV_CHUNK_BYTES_ENV_VAR, 'CC_KV_CHUNK_BYTES')
 assert.equal(KV_CHUNK_BYTES_GLOBAL, 'CC_KV_CHUNK_BYTES')
 assert.equal(normalizeKvChunkBytes('32768'), 32768)
 assert.equal(normalizeKvChunkBytes(' 4096 '), 4096)
 assert.equal(normalizeKvChunkBytes('0'), null)
 assert.equal(normalizeKvChunkBytes('not-a-number'), null)
 assert.equal(resolveKvChunkBytes({ envValue: null, globalValue: null }), DEFAULT_KV_CHUNK_BYTES)
 assert.equal(resolveKvChunkBytes({ envValue: '2048', globalValue: null }), 2048)
 assert.equal(resolveKvChunkBytes({ envValue: '2048', globalValue: '4096' }), 4096)

 const originalEnv = process.env[KV_CHUNK_BYTES_ENV_VAR]
 const hasGlobal = Object.hasOwn(globalThis, KV_CHUNK_BYTES_GLOBAL)
 const originalGlobal = globalThis[KV_CHUNK_BYTES_GLOBAL]
 try {
  if (hasGlobal) delete globalThis[KV_CHUNK_BYTES_GLOBAL]
  process.env[KV_CHUNK_BYTES_ENV_VAR] = '20480'
  const fromEnv = await import(`./kv-config.mjs?env=${Date.now()}`)
  assert.equal(fromEnv.MAX_KV_VALUE_BYTES, 20480)
  globalThis[KV_CHUNK_BYTES_GLOBAL] = '12288'
  const fromGlobal = await import(`./kv-config.mjs?global=${Date.now() + 1}`)
  assert.equal(fromGlobal.MAX_KV_VALUE_BYTES, 12288)
 }
 finally {
  if (originalEnv === undefined) delete process.env[KV_CHUNK_BYTES_ENV_VAR]
  else process.env[KV_CHUNK_BYTES_ENV_VAR] = originalEnv
  if (hasGlobal) globalThis[KV_CHUNK_BYTES_GLOBAL] = originalGlobal
  else delete globalThis[KV_CHUNK_BYTES_GLOBAL]
 }

 const previous = getKvChunkBytes()
 try {
  assert.equal(setKvChunkBytes(8192), 8192)
  assert.equal(getKvChunkBytes(), 8192)
  assert.equal(MAX_KV_VALUE_BYTES, 8192)
  const chunks = splitUtf8Chunks('x'.repeat(9000))
  assert.equal(chunks.length, 2)
  assert.equal(utf8ByteLength(chunks[0]), 8192)
  assert.throws(() => setKvChunkBytes('bad'), RangeError)
  assert.equal(getKvChunkBytes(), 8192)
 }
 finally {
  setKvChunkBytes(previous)
 }
})

test('data.mjs httpKV hashNamespace and real diskKV directory layout enforce configured chunk bytes per file without collisions', async () => {
 // 1. httpKV URL key construction & idempotent 404 delete
 const requests = []
 const origFetch = globalThis.fetch
 globalThis.fetch = async (url, init = {}) => {
  requests.push({ url: String(url), method: init.method || 'GET', body: init.body })
  const key = new URL(url).searchParams.get('key')
  if (init.method === 'DELETE' && key === 'missing-del') {
   return { ok: false, status: 404, statusText: 'Not Found', text: async () => '' }
  }
  return { ok: true, status: 200, statusText: 'OK', text: async () => 'ok' }
 }
 try {
  const root = httpKV({ baseUrl: 'http://localhost:8080/api/data?mode=disk' })
  assert.equal(root.root, root)
  const legacySub = root.namespace('lane-1')
  assert.equal(legacySub.root, root)
  await legacySub.get('title')
  const hashed = root.hashNamespace('lanes').namespace('lane.1').namespace('tables').namespace('t.2').get('schema')
  await hashed
  await root.delete('missing-del')
  await root.hashNamespace('sessions').namespace('s1').delete('meta')
  assert.equal(new URL(requests[0].url).searchParams.get('key'), 'lane-1.title')
  assert.equal(new URL(requests[1].url).searchParams.get('key'), 'lanes#lane%2E1/tables/t%2E2/schema')
  assert.equal(requests[2].method, 'DELETE')
  assert.equal(new URL(requests[3].url).searchParams.get('key'), 'sessions#s1/meta')
  assert.equal(requests[3].method, 'DELETE')
 }
 finally {
  globalThis.fetch = origFetch
 }

 // 2. Real temp-dir diskKV mimicking civil-memory's diskKV on-disk folder/file mapping
 const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cc-diskkv-'))
 function createDiskKV(baseDir) {
  const encodeSeg = seg => encodeURIComponent(String(seg))
  const keyToFile = rawKey => {
   const hashParts = String(rawKey).split('#')
   if (hashParts.length > 2) {
    throw new Error(`Invalid multiple # in key: ${rawKey}`)
   }
   const ns = hashParts.length === 2 ? hashParts[0] : 'main'
   const rel = hashParts.length === 2 ? hashParts[1] : rawKey
   const segments = rel.split('/').filter(s => s.length > 0)
   if (segments.length === 0) {
    throw new Error(`Empty key path for: ${rawKey}`)
   }
   for (const seg of segments) {
    const enc = encodeSeg(seg)
    if (enc === '.' || enc === '..') {
     throw new Error(`Unsafe segment in key: ${rawKey}`)
    }
   }
   return path.join(baseDir, encodeSeg(ns), ...segments.map(encodeSeg))
  }
  const makeClient = (namespace = '', rootRef = null) => {
   const isHash = namespace.includes('#')
   const qualify = k => (isHash ? (namespace.endsWith('#') ? `${namespace}${k}` : `${namespace}/${k}`) : (namespace ? `${namespace}.${k}` : k))
   const client = {
    prefix: namespace,
    root: rootRef || null,
    namespace(name) {
     const nextNs = isHash ? qualify(encodeKeySegment(name)) : qualify(name)
     return makeClient(nextNs, client.root)
    },
    hashNamespace(name) {
     return makeClient(`${encodeKeySegment(name)}#`, client.root)
    },
    async get(key) {
     const fp = keyToFile(qualify(key))
     try {
      return await fs.readFile(fp, 'utf8')
     }
     catch (err) {
      if (err && err.code === 'ENOENT') return null
      throw err
     }
    },
    async set(key, value) {
     const fp = keyToFile(qualify(key))
     await fs.mkdir(path.dirname(fp), { recursive: true })
     await fs.writeFile(fp, String(value), 'utf8')
    },
    async delete(key) {
     const fp = keyToFile(qualify(key))
     await fs.rm(fp, { force: true })
    },
   }
   if (!client.root) client.root = client
   return client
  }
  return makeClient()
 }

 try {
  const disk = createDiskKV(tempDir)
  const memWindow = {}
  const sess = await initSessionState(disk, memWindow)
  const createdPkg = await createPackage(disk, sess.sessionId, { name: 'Alpha', passphrase: 'pass' }, memWindow)
  const laneId = 'lane.disk.1'
  const laneData = disk.namespace(laneId)
  await laneData.set('title', 'Disk Layout Test')
  await registerLaneInPackage(disk, laneId, 'Disk Layout Test', createdPkg.pkg.id)

  // Seed exempt .inputs key (large values explicitly allowed only for .inputs)
  const bigInputs = Array.from({ length: 40 }, (_, i) => ({ name: `inp_${i}`, type: 'string', value: 'v'.repeat(30) }))
  await laneData.set('inputs', JSON.stringify(bigInputs))

  // Add 2 tables with wide columns and a multi-byte row payload larger than one chunk
  const t1 = {
   id: 't1',
   name: 'items',
   columns: Array.from({ length: 12 }, (_, i) => ({ id: `c${i}`, name: `column_long_name_${i}`, type: 'text', multiple: false, width: null })),
   rows: [],
  }
  const t2 = {
   id: 't2',
   name: 'notes',
   columns: [{ id: 'nc0', name: 'body', type: 'text', multiple: false, width: null }],
   rows: [],
  }
  await addLaneTable(disk, laneData, laneId, t1, ['t1'])
  await addLaneTable(disk, laneData, laneId, t2, ['t1', 't2'])

  const bigEmojiValue = '🚀'.repeat(Math.ceil(MAX_KV_VALUE_BYTES * 2 / 4))
  const bigEmojiRow = { id: 'r_big', values: { c0: bigEmojiValue, c1: 'a'.repeat(MAX_KV_VALUE_BYTES) } }
  t1.rows.push(bigEmojiRow)
  await addTableRow(disk, laneData, laneId, 't1', bigEmojiRow, ['r_big'])

  // Save script lines including a chunked line
  await saveLaneScript(disk, laneData, laneId, [
   '; to a 1',
   `-- ${'x'.repeat(MAX_KV_VALUE_BYTES * 2)}`,
   '; to b ; add $a 2',
  ], memWindow)

  // Walk every file on disk under tempDir
  const allFiles = []
  async function walk(dir) {
   const entries = await fs.readdir(dir, { withFileTypes: true })
   for (const ent of entries) {
    const full = path.join(dir, ent.name)
    if (ent.isDirectory()) {
     await walk(full)
    }
    else {
     allFiles.push(path.relative(tempDir, full))
    }
   }
  }
  await walk(tempDir)

  const diskLaneDir = `lanes/${encodeURIComponent(encodeKeySegment(laneId))}`
  assert.ok(allFiles.some(f => f.startsWith(`${diskLaneDir}/tables/t1/schema`)))
  assert.ok(allFiles.some(f => f.startsWith(`${diskLaneDir}/tables/t1/rows/r_big.chunks/`)))
  assert.ok(allFiles.some(f => f.startsWith(`${diskLaneDir}/tables/t2/schema`)))
  assert.ok(allFiles.some(f => f === `${diskLaneDir}/script-index`))
  assert.ok(allFiles.some(f => f === 'packages/default/meta'))
  assert.ok(allFiles.some(f => f === `packages/${encodeURIComponent(createdPkg.pkg.id)}/meta`))
  assert.ok(allFiles.some(f => f === `sessions/${encodeURIComponent(sess.sessionId)}/meta`))

  for (const relPath of allFiles) {
   if (relPath.endsWith(`${laneId}.inputs`) || relPath === `main/${laneId}.inputs`) {
    continue
   }
   const raw = await fs.readFile(path.join(tempDir, relPath), 'utf8')
   assert.ok(
    Buffer.byteLength(raw, 'utf8') <= MAX_KV_VALUE_BYTES,
    `File ${relPath} exceeded ${MAX_KV_VALUE_BYTES} bytes (${Buffer.byteLength(raw, 'utf8')} bytes)`
   )
  }

  // Reload from diskKV to verify integrity
  const loadedTables = await loadLaneTables(disk, laneData, laneId)
  assert.equal(loadedTables.length, 2)
  assert.equal(loadedTables[0].rows[0].values.c0, bigEmojiValue)
  const loadedScript = await loadLaneScript(disk, laneData, laneId, memWindow)
  assert.equal(loadedScript.records.length, 3)
  assert.equal(loadedScript.records[1].text, `-- ${'x'.repeat(MAX_KV_VALUE_BYTES * 2)}`)
 }
 finally {
  await fs.rm(tempDir, { recursive: true, force: true })
 }
})

test('storage.mjs chunking, multi-byte UTF-8 splitting, and paged ID indexes stay within configured chunk bytes', async () => {
 const emojiText = '🧪'.repeat(Math.ceil(MAX_KV_VALUE_BYTES * 2 / 4)) + 'hello' + 'あ'.repeat(Math.ceil(MAX_KV_VALUE_BYTES / 3))
 const chunks = splitUtf8Chunks(emojiText, MAX_KV_VALUE_BYTES)
 assert.ok(chunks.length > 2)
 for (const ch of chunks) {
  assert.ok(utf8ByteLength(ch) <= MAX_KV_VALUE_BYTES)
  assert.equal(/[\uD800-\uDFFF]/.test(ch.slice(0, 1)) && !/^[\uD800-\uDBFF][\uDC00-\uDFFF]/.test(ch.slice(0, 2)), false)
 }
 assert.equal(chunks.join(''), emojiText)

 const store = new Map()
 const writes = []
 const kv = {
  async get(k) { return store.has(k) ? store.get(k) : null },
  async set(k, v) { writes.push(k); store.set(k, v) },
  async delete(k) { store.delete(k) },
 }

 // Chunk roundtrip + stale chunk cleanup on shrink + delete
 const bigPayload = JSON.stringify({ data: emojiText })
 await kvSetChunked(kv, 'k1', bigPayload)
 assert.ok(store.has('k1.chunks/0'))
 assert.ok(store.has('k1.chunks/1'))
 for (const [, val] of store.entries()) {
  assert.ok(utf8ByteLength(val) <= MAX_KV_VALUE_BYTES)
 }
 assert.equal(await kvGetChunked(kv, 'k1'), bigPayload)

 // Shrink to a single small value deletes old chunk keys
 await kvSetChunked(kv, 'k1', 'small-value')
 assert.equal(store.get('k1'), 'small-value')
 assert.equal(store.has('k1.chunks/0'), false)
 assert.equal(store.has('k1.chunks/1'), false)
 assert.equal(await kvGetChunked(kv, 'k1'), 'small-value')

 await kvSetChunked(kv, 'k1', bigPayload)
 await kvDeleteChunked(kv, 'k1')
 assert.equal(store.has('k1'), false)
 assert.equal(store.has('k1.chunks/0'), false)
 assert.equal(await kvGetChunked(kv, 'k1'), null)

 // Paged ID indexes (100 long IDs -> multiple pages, incremental write skip, shrink & delete cleanup)
 const ids = Array.from({ length: 100 }, (_, i) => `long-item-identifier-segment-${String(i).padStart(4, '0')}-${'x'.repeat(Math.ceil(MAX_KV_VALUE_BYTES / 8))}`)
 await writePagedIds(kv, 'items', ids)
 const pageKeysBefore = Array.from(store.keys()).filter(k => k.startsWith('items-pages/'))
 assert.ok(pageKeysBefore.length >= 3)
 for (const [k, val] of store.entries()) {
  if (k.startsWith('items')) {
   assert.ok(utf8ByteLength(val) <= MAX_KV_VALUE_BYTES, `${k} exceeded ${MAX_KV_VALUE_BYTES} bytes`)
  }
 }
 const readBack = await readPagedIds(kv, 'items')
 assert.equal(readBack.exists, true)
 assert.deepEqual(readBack.ids, ids)

 // Modify only the last item -> unchanged earlier pages must NOT be rewritten
 writes.length = 0
 const modifiedIds = ids.slice()
 modifiedIds[99] = 'long-item-identifier-segment-updated-99'
 await writePagedIds(kv, 'items', modifiedIds)
 assert.equal(writes.includes('items-pages/0'), false)
 assert.equal(writes.includes('items-pages/1'), false)
 assert.ok(writes.includes(`items-pages/${pageKeysBefore.length - 1}`))

 // Shrink to 2 IDs -> deletes trailing pages
 await writePagedIds(kv, 'items', ['id-a', 'id-b'])
 assert.equal(store.has('items-pages/1'), false)
 assert.deepEqual((await readPagedIds(kv, 'items')).ids, ['id-a', 'id-b'])

 await deletePagedIds(kv, 'items')
 assert.equal((await readPagedIds(kv, 'items')).exists, false)
 assert.equal(store.has('items-pages/0'), false)
})

test('Tables split storage: instant legacy migration, single-row & single-schema writes, deletions, and evaluate-stored-lane', async () => {
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
   checked: false,
   className: '',
   title: '',
   hidden: false,
   disabled: false,
   focused: false,
   removed: false,
   setAttribute(name, value) { this.attributes[name] = value },
   appendChild(child) { this.children.push(child); return child },
   insertBefore(child, ref) {
    const idx = this.children.indexOf(ref)
    if (idx === -1) this.children.push(child)
    else this.children.splice(idx, 0, child)
    return child
   },
   addEventListener(event, handler) { this.listeners[event] = handler },
   focus() { this.focused = true },
   select() {},
   remove() { this.removed = true },
  }
 }

 const kv = new Map()
 const writtenKeys = []
 const deletedKeys = []
 function createMockKV(prefix = '') {
  const qualify = key => (prefix ? `${prefix}.${key}` : key)
  return {
   namespace(name) { return createMockKV(qualify(name)) },
   async get(key) { return kv.has(qualify(key)) ? kv.get(qualify(key)) : null },
   async set(key, value) { const k = qualify(key); writtenKeys.push(k); kv.set(k, value) },
   async delete(key) { const k = qualify(key); deletedKeys.push(k); kv.delete(k) },
  }
 }

 // Seed legacy .tables + legacy .script for leg-lane-1
 kv.set('lanes', JSON.stringify({ 'leg-lane-1': { id: 'leg-lane-1', title: 'Legacy Tables Lane' } }))
 kv.set('leg-lane-1.title', 'Legacy Tables Lane')
 kv.set('leg-lane-1.tables', JSON.stringify([
  {
   id: 't-users',
   name: 'users',
   columns: [{ id: 'cu', name: 'name', type: 'text', multiple: false, width: null }],
   rows: [
    { id: 'u1', values: { cu: 'Alice' } },
    { id: 'u2', values: { cu: 'Bob' } },
   ],
  },
  {
   id: 't-orders',
   name: 'orders',
   columns: [
    { id: 'co-item', name: 'item', type: 'text', multiple: false, width: null },
    { id: 'co-qty', name: 'qty', type: 'integer', multiple: false, width: null },
   ],
   rows: [
    { id: 'o1', values: { 'co-item': 'Widget', 'co-qty': 4 } },
    { id: 'o2', values: { 'co-item': 'Gadget', 'co-qty': 7 } },
   ],
  },
 ]))
 kv.set('leg-lane-1.script', JSON.stringify(['$users']))

 const mockWindow = {
  Array,
  Boolean,
  Date,
  JSON,
  Math,
  Object,
  Reflect,
  decodeURIComponent,
  crypto: { randomUUID: () => 'unused-lane-uuid' },
  history: { pushState(_s, _t, url) { mockWindow.location.pathname = url } },
  location: { pathname: '/leg-lane-1;data' },
  addEventListener() {},
  removeEventListener() {},
 }
 const mockDocument = { body: createMockElement('body'), defaultView: mockWindow, createElement: createMockElement }
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
   createIdleTracker,
   data: createMockKV(),
   defaultValueForType,
   document: mockDocument,
   formatImportLine,
   hasImportCycle,
   normalizePrimitiveType,
   parseImportLine,
   primitiveTypes: PRIMITIVE_TYPES,
   resolveImportValue,
   resolveScopeColumns,
   runLines,
   runTransportedScripts,
  })
  await f.run(parse(mainSource, '/src/main.fs'))

  // Legacy .tables migrated immediately & deleted
  assert.equal(kv.has('leg-lane-1.tables'), false)
  assert.ok(deletedKeys.includes('leg-lane-1.tables'))
  assert.ok(kv.has('lanes#leg-lane-1/tables-index'))
  assert.ok(kv.has(tableSchemaKey('leg-lane-1', 't-users')))
  assert.ok(kv.has(tableSchemaKey('leg-lane-1', 't-orders')))
  assert.ok(kv.has(tableRowKey('leg-lane-1', 't-users', 'u1')))
  assert.ok(kv.has(tableRowKey('leg-lane-1', 't-orders', 'o1')))

  // Verify no two tables share the same KV value
  assert.doesNotMatch(kv.get(tableSchemaKey('leg-lane-1', 't-users')), /orders/)
  assert.doesNotMatch(kv.get(tableSchemaKey('leg-lane-1', 't-orders')), /users/)

  const lane = f.state.lanes[0]
  const dv = lane.notebook['data-view']
  const confirmModal = dv['confirm-modal']
  // Select `orders` table tab
  await dv['table-tabs'][1].el.listeners.click()
  assert.equal(dv['active-table-id'], 't-orders')

  // Edit 1 cell in orders row o1 -> ONLY that 1 row key is written!
  writtenKeys.length = 0
  dv['grid-rows'][0].cells[0]['input-el'].value = 'UpdatedWidget'
  await dv['grid-rows'][0].cells[0]['input-el'].listeners.input()
  assert.deepEqual(writtenKeys, [tableRowKey('leg-lane-1', 't-orders', 'o1')])

  // Rename column in orders -> ONLY orders schema key is written (never users)
  writtenKeys.length = 0
  dv['schema-rows'][0]['name-el'].value = 'product'
  await dv['schema-rows'][0]['name-el'].listeners.input()
  assert.deepEqual(writtenKeys, [tableSchemaKey('leg-lane-1', 't-orders')])

  // Delete row o2, then clear rows, then delete orders table
  await dv['grid-rows'][1]['remove-btn'].listeners.click()
  await confirmModal['confirm-btn'].listeners.click()
  assert.equal(kv.has(tableRowKey('leg-lane-1', 't-orders', 'o2')), false)
  assert.equal(kv.has(tableRowKey('leg-lane-1', 't-orders', 'o1')), true)

  await dv['clear-rows-btn'].listeners.click()
  confirmModal['agree-checkbox'].checked = true
  await confirmModal['agree-checkbox'].listeners.change()
  await confirmModal['confirm-btn'].listeners.click()
  assert.equal(kv.has(tableRowKey('leg-lane-1', 't-orders', 'o1')), false)

  await dv['delete-table-btn'].listeners.click()
  confirmModal['agree-checkbox'].checked = true
  await confirmModal['agree-checkbox'].listeners.change()
  await confirmModal['confirm-btn'].listeners.click()
  assert.equal(kv.has(tableSchemaKey('leg-lane-1', 't-orders')), false)
  assert.equal(dv.tables.length, 1)
  assert.equal(dv.tables[0].id, 't-users')

  // evaluate-stored-lane reads remaining split table when lane is closed
  const laneControl = f.state['lane-control']
  await laneControl.close('leg-lane-1')
  const storedRes = await laneControl['get-lane-final-state']('leg-lane-1')
  assert.equal(storedRes.ok, true)
  assert.deepEqual(storedRes.state.users, [{ name: 'Alice' }, { name: 'Bob' }])
 }
 finally {
  globalThis.fetch = origFetch
 }
})

test('Per-line scripts: instant legacy migration, Unknown/ISO timestamps, hover info modal, single-line writes, and intact .inputs', async () => {
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
   style: {},
   attributes: {},
   children: [],
   listeners: {},
   textContent: '',
   value: '',
   className: '',
   title: '',
   hidden: false,
   disabled: false,
   focused: false,
   removed: false,
   setAttribute(name, value) { this.attributes[name] = value },
   appendChild(child) { this.children.push(child); return child },
   insertBefore(child, ref) {
    const idx = this.children.indexOf(ref)
    if (idx === -1) this.children.push(child)
    else this.children.splice(idx, 0, child)
    return child
   },
   addEventListener(event, handler) { this.listeners[event] = handler },
   focus() { this.focused = true },
   select() {},
   remove() { this.removed = true },
  }
 }

 const kv = new Map()
 const writtenKeys = []
 const deletedKeys = []
 function createMockKV(prefix = '') {
  const qualify = key => (prefix ? `${prefix}.${key}` : key)
  return {
   namespace(name) { return createMockKV(qualify(name)) },
   async get(key) { return kv.has(qualify(key)) ? kv.get(qualify(key)) : null },
   async set(key, value) { const k = qualify(key); writtenKeys.push(k); kv.set(k, value) },
   async delete(key) { const k = qualify(key); deletedKeys.push(k); kv.delete(k) },
  }
 }

 const inputsPayload = JSON.stringify([{ name: 'seed', type: 'number' }])
 kv.set('leg-script-1.title', 'Legacy Script')
 kv.set('leg-script-1.inputs', inputsPayload)
 kv.set('leg-script-1.script', JSON.stringify(['; to x 10', '; to y ; add $x $seed', '$y']))

 const mockWindow = {
  Array,
  Boolean,
  Date,
  JSON,
  Math,
  Object,
  Reflect,
  decodeURIComponent,
  crypto: { randomUUID: () => 'unused-script-uuid' },
  history: { pushState(_s, _t, url) { mockWindow.location.pathname = url } },
  location: { pathname: '/leg-script-1' },
  addEventListener() {},
  removeEventListener() {},
 }
 const mockDocument = { body: createMockElement('body'), defaultView: mockWindow, createElement: createMockElement }
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
   createIdleTracker,
   data: createMockKV(),
   defaultValueForType,
   document: mockDocument,
   formatImportLine,
   hasImportCycle,
   normalizePrimitiveType,
   parseImportLine,
   primitiveTypes: PRIMITIVE_TYPES,
   resolveImportValue,
   resolveScopeColumns,
   runLines,
   runTransportedScripts,
  })
  await f.run(parse(mainSource, '/src/main.fs'))

  // Legacy .script deleted, .inputs kept intact in 1 key
  assert.equal(kv.has('leg-script-1.script'), false)
  assert.ok(deletedKeys.includes('leg-script-1.script'))
  assert.equal(kv.get('leg-script-1.inputs'), inputsPayload)

  const nb = f.state.lanes[0].notebook
  assert.deepEqual(nb.lines, ['; to x 10', '; to y ; add $x $seed', '$y'])
  assert.equal(nb.state.seed, 0)
  assert.equal(nb.state.y, 10)
  assert.equal(nb['line-records'].length, 3)
  assert.equal(nb['line-records'][0].updatedAt, null)

  // Hover info button on migrated line shows "Unknown"
  const infoModal = nb['info-modal']
  const rec0 = nb['line-records'][0]
  await nb.rows[0]['info-btn'].listeners.click()
  assert.equal(infoModal['is-open'], true)
  assert.equal(infoModal['line-val-el'].textContent, '#1')
  assert.equal(infoModal['id-val-el'].textContent, rec0.id)
  assert.equal(infoModal['mod-val-el'].textContent, 'Unknown')
  assert.equal(infoModal['iso-val-el'].hidden, true)
  await infoModal['ok-btn'].listeners.click()
  assert.equal(infoModal['is-open'], false)

  // Editing line 2 writes ONLY line 2's key & sets ISO modification timestamp
  writtenKeys.length = 0
  const rec1 = nb['line-records'][1]
  nb.rows[1]['input-el'].value = '; to y ; add $x 90'
  await nb.rows[1]['input-el'].listeners.input()
  const writtenScriptKeys = writtenKeys.filter(k => !k.startsWith(`${STORY_NAMESPACE}#`))
  assert.deepEqual(writtenScriptKeys, [scriptLineKey('leg-script-1', rec1.id)])
  assert.ok(writtenKeys.some(k => k.startsWith(`${STORY_NAMESPACE}#leg-script-1/`)))
  assert.ok(typeof rec1.updatedAt === 'string' && rec1.updatedAt.includes('T'))
  assert.equal(nb.state.y, 100)

  await nb.rows[1]['info-btn'].listeners.click()
  assert.equal(infoModal['is-open'], true)
  assert.notEqual(infoModal['mod-val-el'].textContent, 'Unknown')
  assert.equal(infoModal['iso-val-el'].hidden, false)
  assert.equal(infoModal['iso-val-el'].textContent, rec1.updatedAt)
  await infoModal['ok-btn'].listeners.click()

  // Insert & remove line updates index and deletes removed line key
  await nb['add-btn'].listeners.click()
  const insertedRec = nb['line-records'][3]
  assert.ok(kv.has(scriptLineKey('leg-script-1', insertedRec.id)))
  await nb.rows[3]['remove-btn'].listeners.click()
  assert.equal(kv.has(scriptLineKey('leg-script-1', insertedRec.id)), false)
  assert.ok(deletedKeys.includes(scriptLineKey('leg-script-1', insertedRec.id)))
 }
 finally {
  globalThis.fetch = origFetch
 }
})

test('Two-level Sessions (localStorage + sessionStorage) and Packages access control, unlock flow, top-rail UI, and Open Lane filtering', async () => {
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
   style: {},
   attributes: {},
   children: [],
   listeners: {},
   textContent: '',
   value: '',
   className: '',
   title: '',
   hidden: false,
   disabled: false,
   focused: false,
   removed: false,
   setAttribute(name, value) { this.attributes[name] = value },
   appendChild(child) { this.children.push(child); return child },
   insertBefore(child, ref) {
    const idx = this.children.indexOf(ref)
    if (idx === -1) this.children.push(child)
    else this.children.splice(idx, 0, child)
    return child
   },
   addEventListener(event, handler) { this.listeners[event] = handler },
   focus() { this.focused = true },
   select() {},
   remove() { this.removed = true },
  }
 }

 const kv = new Map()
 function createMockKV(prefix = '') {
  const qualify = key => (prefix ? `${prefix}.${key}` : key)
  return {
   namespace(name) { return createMockKV(qualify(name)) },
   async get(key) { return kv.has(qualify(key)) ? kv.get(qualify(key)) : null },
   async set(key, value) { kv.set(qualify(key), value) },
   async delete(key) { kv.delete(qualify(key)) },
  }
 }

 const makeMemStorage = () => {
  const m = new Map()
  return {
   getItem(k) { return m.has(k) ? m.get(k) : null },
   setItem(k, v) { m.set(k, String(v)) },
   removeItem(k) { m.delete(k) },
  }
 }

 // Seed legacy global `lanes` catalog to verify instant migration to Default package
 kv.set('lanes', JSON.stringify({ 'legacy-1': { id: 'legacy-1', title: 'Legacy Alpha' } }))
 kv.set('legacy-1.title', 'Legacy Alpha')
 kv.set('legacy-1.script', JSON.stringify(['; to baseSecret 42']))

 let uuid = 0
 const localStore = makeMemStorage()
 const sessionStore = makeMemStorage()
 const mockWindow = {
  Array,
  Boolean,
  Date,
  JSON,
  Math,
  Object,
  Reflect,
  decodeURIComponent,
  localStorage: localStore,
  sessionStorage: sessionStore,
  crypto: { randomUUID: () => `sp-uuid-${++uuid}` },
  history: { pushState(_s, _t, url) { mockWindow.location.pathname = url } },
  location: { pathname: '/' },
  addEventListener() {},
  removeEventListener() {},
 }
 const mockDocument = { body: createMockElement('body'), defaultView: mockWindow, createElement: createMockElement }
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
   createIdleTracker,
   data: createMockKV(),
   defaultValueForType,
   document: mockDocument,
   formatImportLine,
   hasImportCycle,
   normalizePrimitiveType,
   parseImportLine,
   primitiveTypes: PRIMITIVE_TYPES,
   resolveImportValue,
   resolveScopeColumns,
   runLines,
   runTransportedScripts,
  })
  await f.run(parse(mainSource, '/src/main.fs'))
  const laneControl = f.state['lane-control']
  const rails = laneControl.rails
  const openModal = laneControl['lane-modal']
  const configModal = laneControl['config-modal']
  const sessionModal = laneControl['session-modal']
  const packageModal = laneControl['package-modal']

  // 1. Legacy catalog migrated to Default package & deleted; two-level browser/tab session initialized
  assert.equal(kv.has('lanes'), false)
  assert.equal(kv.get(lanePackageKey('legacy-1')), DEFAULT_PACKAGE_ID)
  assert.ok(kv.has(packageLaneKey(DEFAULT_PACKAGE_ID, 'legacy-1')))
  const browserSessId = localStore.getItem(SESSION_STORAGE_KEY)
  assert.ok(browserSessId)
  assert.equal(sessionStore.getItem(SESSION_STORAGE_KEY), browserSessId)
  assert.equal(laneControl['session-overridden'], false)

  // 2. Top-rail session dropdown mutually exclusive with preferences dropdown
  await rails['session-btn'].listeners.click({ stopPropagation() {} })
  assert.equal(rails['is-session-open'], true)
  assert.equal(rails['session-menu'].hidden, false)
  await rails['preferences-btn'].listeners.click({ stopPropagation() {} })
  assert.equal(rails['is-session-open'], false)
  assert.equal(rails['is-preferences-open'], true)

  // 3. Create unprotected "Work" package and passphrase-protected "Vault" package
  const workPkg = await laneControl['create-package']('Work', '')
  assert.equal(laneControl['active-package-id'], workPkg.pkg.id)
  await f.state.tableHeadRowAddButton.listeners.click()
  const laneWork = f.state.lanes[0]
  assert.equal(laneWork['package-id'], workPkg.pkg.id)

  // Move laneWork to Default and back via Configure Lane modal
  await laneWork['config-btn'].listeners.click()
  configModal['pkg-select'].value = DEFAULT_PACKAGE_ID
  await configModal.form.listeners.submit({ preventDefault() {} })
  assert.equal(laneWork['package-id'], DEFAULT_PACKAGE_ID)
  await laneWork['config-btn'].listeners.click()
  configModal['pkg-select'].value = workPkg.pkg.id
  await configModal.form.listeners.submit({ preventDefault() {} })
  assert.equal(laneWork['package-id'], workPkg.pkg.id)

  const vaultPkg = await laneControl['create-package']('Vault', 's3cr3t-pass')
  assert.equal(laneControl['active-package-id'], vaultPkg.pkg.id)
  await f.state.tableHeadRowAddButton.listeners.click()
  const laneVault = f.state.lanes[1]
  assert.equal(laneVault['package-id'], vaultPkg.pkg.id)
  laneVault.notebook.rows[0]['input-el'].value = '; to vaultVal 777'
  await laneVault.notebook.rows[0]['input-el'].listeners.input()

  // 4. Open Lane modal package pill filter (verifying $modal.package-filter)
  await f.state.tableHeadRowOpenButton.listeners.click()
  assert.equal(openModal.items.length, 3)
  const workPill = openModal['pkg-pills'].find(p => p.id === workPkg.pkg.id)
  assert.ok(workPill)
  await workPill.el.listeners.click()
  assert.equal(openModal['package-filter'], workPkg.pkg.id)
  assert.equal(openModal.items.length, 1)
  assert.equal(openModal.items[0].entry.id, laneWork.id)
  await openModal['close-btn'].listeners.click()

  // Save browser session version so returning to it restores Work & Vault lanes via URL redirect
  await laneControl['save-session-draft']()
  assert.equal(laneControl['session-dirty'], false)

  // 5. Create new tab-only session -> sessionStorage overrides, localStorage stays intact, URL redirects to empty session
  await laneControl['new-tab-session']('Tab Workspace')
  const tabSessId = sessionStore.getItem(SESSION_STORAGE_KEY)
  assert.notEqual(tabSessId, browserSessId)
  assert.equal(localStore.getItem(SESSION_STORAGE_KEY), browserSessId)
  assert.equal(laneControl['session-overridden'], true)
  assert.equal(mockWindow.location.pathname, '/')
  assert.equal(laneControl.lanes.length, 0)

  // Advanced section in Session modal exposes Tab vs. Browser return/promote controls
  await sessionModal['open-switch-session']()
  assert.equal(sessionModal['adv-body'].hidden, true)
  await sessionModal['adv-toggle'].listeners.click()
  assert.equal(sessionModal['adv-body'].hidden, false)
  assert.equal(sessionModal['override-actions'].hidden, false)
  await sessionModal.close()

  // Only Default lane is visible in catalog
  const visibleInTab = await laneControl['list-known']()
  assert.deepEqual(visibleInTab.map(e => e.id), ['legacy-1'])

  // Cross-lane import / evaluate blocked for unopened Vault lane
  const blockedEval = await laneControl['get-lane-final-state'](laneVault.id, 'legacy-1')
  assert.equal(blockedEval.ok, false)
  assert.match(blockedEval.error, /Access denied/)

  // Direct URL navigation to unopened Work & Vault lanes mounts Locked Lane cards without leaking contents
  mockWindow.location.pathname = `/${laneWork.id}/${laneVault.id}`
  await laneControl.sync()
  const mountedVault = laneControl['by-id'][laneVault.id]
  assert.equal(mountedVault['is-locked'], true)
  assert.equal(mountedVault.title, 'Locked Lane')
  assert.equal(mountedVault.element.className, 'lane-header lane-header--locked')
  assert.equal(mountedVault.body.className, 'lane-body lane-body--locked')

  // Wrong passphrase fails unlock & leaves lane locked
  await mountedVault['unlock-btn'].listeners.click()
  assert.equal(packageModal['is-open'], true)
  assert.equal(packageModal.mode, 'unlock')
  assert.equal(packageModal['unlock-id-input'].value, vaultPkg.pkg.id)
  packageModal['unlock-pass-input'].value = 'wrong-pass'
  await packageModal['unlock-form'].listeners.submit({ preventDefault() {} })
  assert.equal(packageModal['is-open'], true)
  assert.equal(packageModal['error-el'].hidden, false)
  assert.equal(laneControl['by-id'][laneVault.id]['is-locked'], true)

  // Correct passphrase unlocks & reloads laneVault automatically
  packageModal['unlock-pass-input'].value = 's3cr3t-pass'
  await packageModal['unlock-form'].listeners.submit({ preventDefault() {} })
  assert.equal(packageModal['is-open'], false)
  const unlockedVault = laneControl['by-id'][laneVault.id]
  assert.equal(unlockedVault['is-locked'], false)
  assert.equal(unlockedVault.notebook.state.vaultVal, 777)

  // Closing Vault package immediately re-locks open laneVault
  await laneControl['close-package'](vaultPkg.pkg.id)
  assert.equal(laneControl['by-id'][laneVault.id]['is-locked'], true)

  // Return to browser session restores original browser session, redirects URL to its saved lanes, and restores Work/Vault access
  await laneControl['return-to-browser-session']()
  assert.equal(sessionStore.getItem(SESSION_STORAGE_KEY), browserSessId)
  assert.equal(laneControl['session-overridden'], false)
  assert.equal(mockWindow.location.pathname, `/${laneWork.id}/${laneVault.id}`)
  assert.equal(laneControl['by-id'][laneVault.id]['is-locked'], false)

  // New tab + rename + promote to browser session updates localStorage
  await laneControl['new-tab-session']('Custom Tab')
  const promotedId = sessionStore.getItem(SESSION_STORAGE_KEY)
  await laneControl['rename-session']('Renamed Promoted')
  assert.equal(laneControl['session-meta'].name, 'Renamed Promoted')
  await laneControl['promote-tab-session']()
  assert.equal(localStore.getItem(SESSION_STORAGE_KEY), promotedId)
  assert.equal(laneControl['session-overridden'], false)
 }
 finally {
  globalThis.fetch = origFetch
 }
})

test('Session & Package UI rework: split top-rail menus, workspace summary, draft Save/Fork/Abandon, URL switching, Package Page, and Session History Page', async () => {
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
   style: {},
   attributes: {},
   children: [],
   listeners: {},
   textContent: '',
   value: '',
   className: '',
   title: '',
   hidden: false,
   disabled: false,
   focused: false,
   removed: false,
   setAttribute(name, value) { this.attributes[name] = value },
   appendChild(child) { this.children.push(child); return child },
   insertBefore(child, ref) {
    const idx = this.children.indexOf(ref)
    if (idx === -1) this.children.push(child)
    else this.children.splice(idx, 0, child)
    return child
   },
   addEventListener(event, handler) { this.listeners[event] = handler },
   focus() { this.focused = true },
   select() {},
   remove() { this.removed = true },
  }
 }

 const kv = new Map()
 function createMockKV(prefix = '') {
  const qualify = key => (prefix ? `${prefix}.${key}` : key)
  return {
   namespace(name) { return createMockKV(qualify(name)) },
   async get(key) { return kv.has(qualify(key)) ? kv.get(qualify(key)) : null },
   async set(key, value) { kv.set(qualify(key), value) },
   async delete(key) { kv.delete(qualify(key)) },
  }
 }

 const makeMemStorage = () => {
  const m = new Map()
  return {
   getItem(k) { return m.has(k) ? m.get(k) : null },
   setItem(k, v) { m.set(k, String(v)) },
   removeItem(k) { m.delete(k) },
  }
 }

 let uuid = 0
 const localStore = makeMemStorage()
 const sessionStore = makeMemStorage()
 const mockWindow = {
  Array,
  Boolean,
  Date,
  JSON,
  Math,
  Object,
  Reflect,
  decodeURIComponent,
  localStorage: localStore,
  sessionStorage: sessionStore,
  crypto: { randomUUID: () => `rework-uuid-${++uuid}` },
  history: { pushState(_s, _t, url) { mockWindow.location.pathname = url } },
  location: { pathname: '/' },
  addEventListener() {},
  removeEventListener() {},
 }
 const mockDocument = { body: createMockElement('body'), defaultView: mockWindow, createElement: createMockElement }
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
   createIdleTracker,
   data: createMockKV(),
   defaultValueForType,
   document: mockDocument,
   formatImportLine,
   hasImportCycle,
   normalizePrimitiveType,
   parseImportLine,
   primitiveTypes: PRIMITIVE_TYPES,
   resolveImportValue,
   resolveScopeColumns,
   runLines,
   runTransportedScripts,
  })
  await f.run(parse(mainSource, '/src/main.fs'))
  const laneControl = f.state['lane-control']
  const rails = laneControl.rails
  const sessionModal = laneControl['session-modal']
  const packageModal = laneControl['package-modal']
  const summary = laneControl['workspace-summary']

  // 1. Workspace summary mounts below + Lane / Open and starts clean at v1
  assert.ok(summary)
  assert.equal(f.state.tableBodyRowSpacer.children.includes(summary.panel), true)
  assert.equal(laneControl['session-dirty'], false)
  assert.equal(summary['draft-box'].hidden, true)
  assert.equal(summary['sess-ver'].textContent, 'v1')
  assert.equal(summary['pkg-items'].length, 1)
  assert.equal(summary['pkg-items'][0].pkg.id, DEFAULT_PACKAGE_ID)

  // 2. Top-rail Sessions & Packages menus are separate and mutually exclusive
  await rails['session-btn'].listeners.click({ stopPropagation() {} })
  assert.equal(rails['is-session-open'], true)
  assert.equal(rails['is-packages-open'], false)
  await rails['packages-btn'].listeners.click({ stopPropagation() {} })
  assert.equal(rails['is-session-open'], false)
  assert.equal(rails['is-packages-open'], true)
  assert.equal(rails['pkg-items'].length, 1)
  await rails['close-packages-menu']()

  // 3. Structural change (add lane + create package) marks draft dirty; tab switch does NOT
  const baseSessId = laneControl['session-id']
  await laneControl['rename-session']('Main Workspace')
  const pkgAlpha = await laneControl['create-package']('Alpha', '')
  const laneA = await laneControl.add()
  assert.equal(laneControl['session-dirty'], true)
  assert.equal(summary['draft-box'].hidden, false)
  assert.equal(summary['sess-ver'].textContent, 'v1*')
  assert.match(rails['session-btn'].className, /top-rail-icon--dirty/)

  // Save draft -> commits v2 and clears dirty
  await summary['draft-save-btn'].listeners.click()
  assert.equal(laneControl['session-dirty'], false)
  assert.equal(summary['draft-box'].hidden, true)
  assert.equal(summary['sess-ver'].textContent, 'v2')

  // Switching lane tab (Source -> Data) and selecting tables marks session dirty so any lane path change can be Saved/Forked/Abandoned
  await laneA.notebook['set-tab']('data')
  assert.equal(laneControl['session-dirty'], true)
  const dvA = laneA.notebook['data-view']
  await dvA['add-table-btn'].listeners.click()
  dvA['table-name-input'].value = 'Users'
  await dvA['table-name-input'].listeners.input()
  await dvA['add-table-btn'].listeners.click()
  dvA['table-name-input'].value = 'Orders'
  await dvA['table-name-input'].listeners.input()
  assert.equal(mockWindow.location.pathname, `/${laneA.id};data|Orders`)

  // Select Users table and Save Main Workspace as v3 (session-specific lane path: /laneA;data|Users)
  await dvA['table-tabs'][0].el.listeners.click()
  assert.equal(mockWindow.location.pathname, `/${laneA.id};data|Users`)
  await summary['draft-save-btn'].listeners.click()
  assert.equal(laneControl['session-dirty'], false)
  assert.equal(summary['sess-ver'].textContent, 'v3')

  // 4. Switch to Orders table & add a second lane, then Abandon -> reverts URL, lanes, AND selected table back to Users
  await dvA['table-tabs'][1].el.listeners.click()
  assert.equal(laneControl['session-dirty'], true)
  const laneB = await laneControl.add()
  assert.equal(mockWindow.location.pathname, `/${laneA.id};data|Orders/${laneB.id}`)
  await summary['draft-abandon-btn'].listeners.click()
  assert.equal(laneControl['session-dirty'], false)
  assert.equal(mockWindow.location.pathname, `/${laneA.id};data|Users`)
  assert.deepEqual(laneControl['lane-ids'], [laneA.id])
  assert.equal(laneControl['by-id'][laneA.id].notebook['data-view']['get-active-table']().name, 'Users')

  // 5. Switch to Orders table + add a lane and Fork -> new session has Orders + laneC, while Main Workspace stays on Users
  await laneControl['by-id'][laneA.id].notebook['data-view']['table-tabs'][1].el.listeners.click()
  assert.equal(laneControl['session-dirty'], true)
  const laneC = await laneControl.add()
  await summary['draft-fork-btn'].listeners.click()
  const forkSessId = laneControl['session-id']
  assert.notEqual(forkSessId, baseSessId)
  assert.equal(laneControl['session-dirty'], false)
  assert.deepEqual(laneControl['lane-ids'], [laneA.id, laneC.id])
  assert.equal(mockWindow.location.pathname, `/${laneA.id};data|Orders/${laneC.id}`)
  assert.equal(laneControl['by-id'][laneA.id].notebook['data-view']['get-active-table']().name, 'Orders')

  // 6. Full-screen Package Page (in dedicated package-modal) lists BOTH Main Workspace and the Forked session as having Alpha open
  //    and keeps Create / Open-by-ID forms hidden until their pill buttons are clicked (and returns to Packages on Cancel)
  const indexHtml = await fs.readFile(new URL('./index.html', import.meta.url), 'utf8')
  assert.match(indexHtml, /\[hidden\]\s*\{\s*display:\s*none\s*!important;/)
  assert.match(indexHtml, /\.lane-config-form\[hidden\]\s*\{\s*display:\s*none;/)

  await summary['pkg-items'].find(item => item.pkg.id === pkgAlpha.pkg.id)['name-btn'].listeners.click()
  assert.equal(packageModal['is-open'], true)
  assert.equal(sessionModal['is-open'], false)
  assert.equal(packageModal.mode, 'packages')
  assert.equal(packageModal['create-form'].hidden, true)
  assert.equal(packageModal['unlock-form'].hidden, true)
  assert.equal(packageModal['packages-page'].hidden, false)
  assert.equal(packageModal['selected-pkg-id'], pkgAlpha.pkg.id)
  const pkgSessionIds = packageModal['pkg-session-items'].map(it => it.session.id)
  assert.ok(pkgSessionIds.includes(baseSessId))
  assert.ok(pkgSessionIds.includes(forkSessId))
  assert.ok(packageModal['pkg-lane-items'].some(it => it.lane.id === laneA.id))

  // Clicking "+ Create package" pill switches to create form, and Cancel returns to Packages page
  const createPill = packageModal['pkg-pill-els'].find(el => el.textContent === '+ Create package')
  assert.ok(createPill)
  await createPill.listeners.click()
  assert.equal(packageModal.mode, 'create')
  assert.equal(packageModal['create-form'].hidden, false)
  assert.equal(packageModal['unlock-form'].hidden, true)
  assert.equal(packageModal['packages-page'].hidden, true)
  await packageModal['create-cancel-btn'].listeners.click()
  assert.equal(packageModal['is-open'], true)
  assert.equal(packageModal.mode, 'packages')
  assert.equal(packageModal['create-form'].hidden, true)
  assert.equal(packageModal['packages-page'].hidden, false)
  await packageModal.close()

  // 7. Full-screen Session History Page (in dedicated session-modal) hides session-body, logs both sessions, and switches URL back to Main Workspace on click
  await summary['quick-history-btn'].listeners.click()
  assert.equal(sessionModal['is-open'], true)
  assert.equal(packageModal['is-open'], false)
  assert.equal(sessionModal['session-body'].hidden, true)
  assert.equal(sessionModal['history-page'].hidden, false)
  assert.equal(sessionModal.mode, 'history')
  assert.ok(sessionModal['hist-items'].length >= 2)
  assert.equal(sessionModal['hist-items'][0].entry.sessionId, forkSessId)
  assert.equal(sessionModal['hist-items'][0].entry.endedAt, null)
  const prevEntry = sessionModal['hist-items'].find(it => it.entry.sessionId === baseSessId)
  assert.ok(prevEntry)
  assert.ok(prevEntry.entry.endedAt)

  // Switch back to Main Workspace -> URL redirects to /[laneA.id];data|Users and restores Users table!
  await laneControl['switch-session'](baseSessId)
  assert.equal(laneControl['session-id'], baseSessId)
  assert.equal(mockWindow.location.pathname, `/${laneA.id};data|Users`)
  assert.deepEqual(laneControl['lane-ids'], [laneA.id])
  assert.equal(laneControl['by-id'][laneA.id].notebook['data-view']['get-active-table']().name, 'Users')

  // Switch back to Forked session -> URL redirects to /[laneA.id];data|Orders/[laneC.id] and restores Orders table!
  await laneControl['switch-session'](forkSessId)
  assert.equal(laneControl['session-id'], forkSessId)
  assert.equal(mockWindow.location.pathname, `/${laneA.id};data|Orders/${laneC.id}`)
  assert.equal(laneControl['by-id'][laneA.id].notebook['data-view']['get-active-table']().name, 'Orders')
 }
 finally {
  globalThis.fetch = origFetch
 }
})

test('fs-api.mjs: parseProcMounts, listDisks, listDirectories (including hidden & symlinks), createDirectory, and HTTP /api/fs/* routes', async () => {
 assert.equal(unescapeMountPath('/mnt/My\\040Drive\\011Two'), '/mnt/My Drive\tTwo')

 const mountsText = [
  'proc /proc proc rw,nosuid 0 0',
  'sysfs /sys sysfs rw 0 0',
  'tmpfs /run tmpfs rw 0 0',
  'overlay /var/lib/docker/overlay2/abc overlay rw 0 0',
  '/dev/nvme0n1p2 / ext4 rw,relatime 0 0',
  '/dev/nvme0n1p1 /boot/efi vfat rw 0 0',
  '/dev/sdb1 /mnt/External\\040Disk exfat rw 0 0',
  'nas.local:/export/media /media/user/NAS nfs4 rw 0 0',
 ].join('\n')
 const parsedMounts = parseProcMounts(mountsText)
 assert.deepEqual(parsedMounts, [
  { device: '/dev/nvme0n1p2', mount: '/', fsType: 'ext4' },
  { device: '/dev/sdb1', mount: '/mnt/External Disk', fsType: 'exfat' },
  { device: 'nas.local:/export/media', mount: '/media/user/NAS', fsType: 'nfs4' },
 ])

 const posixCrumbs = buildBreadcrumbs('/var/data/work', 'linux')
 assert.deepEqual(posixCrumbs, [
  { name: '/', path: '/' },
  { name: 'var', path: '/var' },
  { name: 'data', path: '/var/data' },
  { name: 'work', path: '/var/data/work' },
 ])
 const winCrumbs = buildBreadcrumbs('D:\\Projects\\Civil', 'win32')
 assert.deepEqual(winCrumbs, [
  { name: 'D:\\', path: 'D:\\' },
  { name: 'Projects', path: 'D:\\Projects' },
  { name: 'Civil', path: 'D:\\Projects\\Civil' },
 ])

 const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'cc-fs-api-'))
 try {
  const homeDir = path.join(tempRoot, 'home')
  const mountParent = path.join(tempRoot, 'mounts')
  const extDisk = path.join(mountParent, 'SSD_One')
  const alphaDir = path.join(homeDir, 'Alpha')
  const betaDir = path.join(homeDir, 'beta')
  const dotTmi = path.join(homeDir, '.tmi')
  const plainFile = path.join(homeDir, 'notes.txt')
  const linkToExt = path.join(homeDir, 'ext-link')
  const linkToFile = path.join(homeDir, 'file-link')

  await fs.mkdir(alphaDir, { recursive: true })
  await fs.mkdir(betaDir, { recursive: true })
  await fs.mkdir(dotTmi, { recursive: true })
  await fs.mkdir(extDisk, { recursive: true })
  await fs.writeFile(plainFile, 'hello', 'utf8')
  await fs.symlink(extDisk, linkToExt)
  await fs.symlink(plainFile, linkToFile)

  const disksRes = await listDisks({
   platform: 'linux',
   homedir: homeDir,
   mountsText: '/dev/nvme0n1p2 / ext4 rw 0 0\n',
   extraMountParents: [mountParent],
  })
  assert.equal(disksRes.home, path.resolve(homeDir))
  assert.ok(disksRes.roots.some(r => r.kind === 'home' && r.path === path.resolve(homeDir)))
  assert.ok(disksRes.roots.some(r => r.kind === 'root' && r.path === '/'))
  assert.ok(disksRes.roots.some(r => r.kind === 'disk' && r.path === path.resolve(extDisk) && r.name === 'SSD_One'))

  // Empty path defaults to home; ~ expands to home; hidden dotfolders + directory symlinks included, files excluded
  const listedHome = await listDirectories('~', { platform: 'linux', homedir: homeDir })
  assert.equal(listedHome.ok, true)
  assert.equal(listedHome.status, 200)
  assert.equal(listedHome.path, path.resolve(homeDir))
  assert.equal(listedHome.writable, true)
  assert.deepEqual(
   listedHome.directories.map(d => ({ name: d.name, hidden: d.hidden, symlink: d.symlink })),
   [
    { name: 'Alpha', hidden: false, symlink: false },
    { name: 'beta', hidden: false, symlink: false },
    { name: 'ext-link', hidden: false, symlink: true },
    { name: '.tmi', hidden: true, symlink: false },
   ]
  )

  const listedSub = await listDirectories('~/.tmi', { platform: 'linux', homedir: homeDir })
  assert.equal(listedSub.ok, true)
  assert.equal(listedSub.path, path.resolve(dotTmi))
  assert.equal(listedSub.parent, path.resolve(homeDir))

  const missingRes = await listDirectories(path.join(homeDir, 'does-not-exist'), { platform: 'linux', homedir: homeDir })
  assert.equal(missingRes.ok, false)
  assert.equal(missingRes.status, 404)

  const fileRes = await listDirectories(plainFile, { platform: 'linux', homedir: homeDir })
  assert.equal(fileRes.ok, false)
  assert.equal(fileRes.status, 400)

  const createdRes = await createDirectory(homeDir, 'NewWorkspace', { platform: 'linux', homedir: homeDir })
  assert.equal(createdRes.ok, true)
  assert.equal(createdRes.status, 201)
  assert.equal(createdRes.path, path.join(path.resolve(homeDir), 'NewWorkspace'))

  const dupRes = await createDirectory(homeDir, 'NewWorkspace', { platform: 'linux', homedir: homeDir })
  assert.equal(dupRes.ok, false)
  assert.equal(dupRes.status, 409)

  const badNameRes = await createDirectory(homeDir, '../escape', { platform: 'linux', homedir: homeDir })
  assert.equal(badNameRes.ok, false)
  assert.equal(badNameRes.status, 400)

  // HTTP handler round-trip for /api/fs/roots, /api/fs/list, /api/fs/mkdir, 404, 405
  const fsSecretStore = createServerSecretStore({ useEnv: false })
  const fsSessionToken = createCapabilityToken({ sessionId: null, basePath: null, allowUnlocked: true }, fsSecretStore)
  async function invokeFsApi(method, urlPath, jsonBody = null) {
   const req = new EventEmitter()
   req.method = method
   req.url = urlPath
   req.headers = {
    [SESSION_TOKEN_HEADER.toLowerCase()]: fsSessionToken,
    ...(jsonBody !== null ? { 'content-type': 'application/json' } : {}),
   }
   let statusCode = 0
   let headers = {}
   let rawBody = ''
   const res = {
    writeHead(code, hdrs) {
     statusCode = code
     headers = hdrs || {}
    },
    end(chunk) {
     rawBody += chunk ? String(chunk) : ''
    },
   }
   const promise = handleFsApiRequest(req, res, {
    platform: 'linux',
    homedir: homeDir,
    mountsText: '/dev/nvme0n1p2 / ext4 rw 0 0\n',
    extraMountParents: [mountParent],
    secretStore: fsSecretStore,
   })
   if (jsonBody !== null) {
    queueMicrotask(() => {
     req.emit('data', Buffer.from(JSON.stringify(jsonBody), 'utf8'))
     req.emit('end')
    })
   }
   else {
    queueMicrotask(() => req.emit('end'))
   }
   await promise
   return { status: statusCode, headers, body: JSON.parse(rawBody) }
  }

  const httpRoots = await invokeFsApi('GET', '/api/fs/roots')
  assert.equal(httpRoots.status, 200)
  assert.equal(httpRoots.headers['Cache-Control'], 'no-store')
  assert.ok(httpRoots.body.roots.some(r => r.path === path.resolve(extDisk)))

  const httpList = await invokeFsApi('GET', `/api/fs/list?path=${encodeURIComponent(homeDir)}`)
  assert.equal(httpList.status, 200)
  assert.ok(httpList.body.directories.some(d => d.name === 'NewWorkspace'))
  assert.ok(httpList.body.directories.some(d => d.name === '.tmi' && d.hidden))

  const httpMkdir = await invokeFsApi('POST', '/api/fs/mkdir', { parent: dotTmi, name: 'civil-data' })
  assert.equal(httpMkdir.status, 201)
  assert.equal(httpMkdir.body.ok, true)
  assert.equal(httpMkdir.body.path, path.join(path.resolve(dotTmi), 'civil-data'))

  const httpNotFound = await invokeFsApi('GET', '/api/fs/unknown')
  assert.equal(httpNotFound.status, 404)

  const httpMethodErr = await invokeFsApi('POST', '/api/fs/roots', {})
  assert.equal(httpMethodErr.status, 405)
 }
 finally {
  await fs.rm(tempRoot, { recursive: true, force: true })
 }
})

test('data.mjs & storage.mjs: modeOptions.disk.basePath URL building, switchable httpKV routing, pinned namespaces, and isolated caches', async () => {
 assert.equal(normalizeDataDir(null), null)
 assert.equal(normalizeDataDir('   '), null)
 assert.equal(normalizeDataDir('/'), '/')
 assert.equal(normalizeDataDir('/tmp/custom/'), '/tmp/custom')
 assert.equal(normalizeDataDir('D:\\data\\'), 'D:\\data')
 assert.equal(normalizeDataDir('D:\\'), 'D:\\')

 assert.equal(formatDataDirLabel(null, false), 'Default (unconfirmed)')
 assert.equal(formatDataDirLabel(null, true), 'Default')
 assert.equal(formatDataDirLabel('/tmp/custom/.tmi/', true), '/tmp/custom/.tmi')

 const base = 'http://localhost:8080/api/data?mode=disk'
 assert.equal(buildDataUrl(base, null), 'http://localhost:8080/api/data?mode=disk')
 assert.equal(
  buildDataUrl(base, '/tmp/user/.tmi/'),
  'http://localhost:8080/api/data?mode=disk&modeOptions.disk.basePath=%2Ftmp%2Fuser%2F.tmi'
 )

 const requests = []
 const backingByDir = new Map()
 const origFetch = globalThis.fetch
 globalThis.fetch = async (url, init = {}) => {
  const parsed = new URL(url)
  const basePath = parsed.searchParams.get('modeOptions.disk.basePath') || '__default__'
  const key = parsed.searchParams.get('key')
  const method = (init.method || 'GET').toUpperCase()
  requests.push({ method, basePath, key, url })
  let store = backingByDir.get(basePath)
  if (!store) {
   store = new Map()
   backingByDir.set(basePath, store)
  }
  if (method === 'GET') {
   if (!store.has(key)) {
    return { status: 404, ok: false, statusText: 'Not Found', text: async () => '' }
   }
   return { status: 200, ok: true, statusText: 'OK', text: async () => store.get(key) }
  }
  if (method === 'POST') {
   store.set(key, String(init.body || ''))
   return { status: 200, ok: true, statusText: 'OK', text: async () => '' }
  }
  if (method === 'DELETE') {
   store.delete(key)
   return { status: 200, ok: true, statusText: 'OK', text: async () => '' }
  }
  throw new Error(`Unexpected method ${method}`)
 }

 try {
  const router = httpKV({ baseUrl: base, switchable: true })
  assert.equal(router.basePath, null)
  assert.equal(router.defaultRoot.basePath, null)
  assert.strictEqual(router.withBasePath('/tmp/dir-a'), router.withBasePath('/tmp/dir-a/'))
  assert.strictEqual(router.withBasePath(null), router.defaultRoot)

  // Write via defaultRoot & active router (Default), then switch to dir-a and capture lane-scoped client
  await router.set('ping', 'default-val')
  assert.equal(requests.at(-1).basePath, '__default__')

  router.setBasePath('/tmp/dir-a')
  assert.equal(router.basePath, '/tmp/dir-a')
  assert.equal(router.defaultRoot.basePath, null)
  const laneInDirA = router.namespace('lane-shared')

  // Write identical key under dir-a and dir-b; verify WeakMap caches & pinned namespace stay isolated
  await saveLaneScript(router, laneInDirA, 'lane-shared', ['-- from dir A'], {})
  router.setBasePath('/tmp/dir-b')
  const laneInDirB = router.namespace('lane-shared')
  await saveLaneScript(router, laneInDirB, 'lane-shared', ['-- from dir B'], {})

  // Even while router points to dir-b, laneInDirA still reads/writes dir-a and defaultRoot stays Default
  assert.equal(await router.defaultRoot.get('ping'), 'default-val')
  const loadedA = await loadLaneScript(null, laneInDirA, 'lane-shared', {})
  const loadedB = await loadLaneScript(router, laneInDirB, 'lane-shared', {})
  assert.deepEqual(loadedA.records.map(r => r.text), ['-- from dir A'])
  assert.deepEqual(loadedB.records.map(r => r.text), ['-- from dir B'])
  assert.equal(backingByDir.get('__default__').has('lanes#lane-shared/script-index'), false)
  assert.equal(backingByDir.get('/tmp/dir-a').has('lanes#lane-shared/script-index'), true)
  assert.equal(backingByDir.get('/tmp/dir-b').has('lanes#lane-shared/script-index'), true)
 }
 finally {
  globalThis.fetch = origFetch
 }
})

test('Per-session permanent data directories: mandatory confirm, computer directory picker, isolated storage, cancel on switch, and full UI visibility', async () => {
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

 const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'cc-session-dirs-'))
 const homeDir = path.join(tempRoot, 'home')
 const dotTmiDir = path.join(homeDir, '.tmi')
 const mountParent = path.join(tempRoot, 'disks')
 const externalDisk = path.join(mountParent, 'ProjectDrive')
 await fs.mkdir(dotTmiDir, { recursive: true })
 await fs.mkdir(externalDisk, { recursive: true })

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

 const dirStores = new Map()
 const clientsByPath = new Map()
 function createRoutedKV() {
  const makeClient = (basePath = null, defaultRootRef = null) => {
   const norm = normalizeDataDir(basePath)
   const cacheKey = norm === null ? '__default__' : norm
   if (clientsByPath.has(cacheKey)) {
    return clientsByPath.get(cacheKey)
   }
   let store = dirStores.get(cacheKey)
   if (!store) {
    store = new Map()
    dirStores.set(cacheKey, store)
   }
   const makeNs = (namespace = '', rootRef = null) => {
    const isHash = namespace.includes('#')
    const qualify = k => (isHash ? (namespace.endsWith('#') ? `${namespace}${k}` : `${namespace}/${k}`) : (namespace ? `${namespace}.${k}` : k))
    const client = {
     prefix: namespace,
     basePath: norm,
     root: rootRef || null,
     defaultRoot: defaultRootRef || null,
     getActiveClient() { return client },
     withBasePath(nextPath) { return getClient(nextPath) },
     namespace(name) {
      const nextNs = isHash ? qualify(encodeKeySegment(name)) : qualify(name)
      return makeNs(nextNs, client.root)
     },
     hashNamespace(name) {
      return makeNs(`${encodeKeySegment(name)}#`, client.root)
     },
     async get(key) { const q = qualify(key); return store.has(q) ? store.get(q) : null },
     async set(key, value) { store.set(qualify(key), String(value)) },
     async delete(key) { store.delete(qualify(key)) },
    }
    if (!client.root) { client.root = client }
    if (!client.defaultRoot) { client.defaultRoot = norm === null ? client : getClient(null) }
    return client
   }
   const rootClient = makeNs('', null)
   clientsByPath.set(cacheKey, rootClient)
   return rootClient
  }
  const getClient = targetPath => {
   const norm = normalizeDataDir(targetPath)
   const def = norm === null ? null : makeClient(null, null)
   return makeClient(norm, def)
  }
  const defaultClient = getClient(null)
  let activeClient = defaultClient
  return {
   get prefix() { return activeClient.prefix },
   get basePath() { return activeClient.basePath },
   get root() { return activeClient },
   defaultRoot: defaultClient,
   getActiveClient() { return activeClient },
   withBasePath(nextPath) { return getClient(nextPath) },
   setBasePath(nextPath) { activeClient = getClient(nextPath); return activeClient },
   namespace(name) { return activeClient.namespace(name) },
   hashNamespace(name) { return activeClient.hashNamespace(name) },
   get(key) { return activeClient.get(key) },
   set(key, value) { return activeClient.set(key, value) },
   delete(key) { return activeClient.delete(key) },
  }
 }

 const routedKV = createRoutedKV()
 // Seed an unconfirmed legacy session in Default registry KV
 const legacySessId = 'legacy-unconfirmed-sess'
 await routedKV.defaultRoot.set(sessionMetaKey(legacySessId), JSON.stringify({
  id: legacySessId,
  name: 'Legacy Workspace',
  activePackageId: DEFAULT_PACKAGE_ID,
  laneIds: [],
  pathname: '/',
  version: 1,
  forkedFrom: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
 }))

 const makeStore = () => {
  const map = new Map()
  return {
   getItem(k) { return map.has(k) ? map.get(k) : null },
   setItem(k, v) { map.set(k, String(v)) },
   removeItem(k) { map.delete(k) },
  }
 }
 const localStore = makeStore()
 const sessionStore = makeStore()
 let uuid = 0
 const windowListeners = {}
 const mockWindow = {
  Array,
  Boolean,
  Date,
  JSON,
  Math,
  Object,
  Reflect,
  decodeURIComponent,
  localStorage: localStore,
  sessionStorage: sessionStore,
  crypto: { randomUUID: () => `dir-uuid-${++uuid}` },
  history: { pushState(_s, _t, url) { mockWindow.location.pathname = url } },
  location: { pathname: '/' },
  addEventListener(event, handler) {
   windowListeners[event] ||= []
   windowListeners[event].push(handler)
  },
  removeEventListener() {},
 }
 const dispatchWindowEvent = async (event, ev) => {
  for (const handler of windowListeners[event] || []) {
   await handler(ev)
  }
 }
 const mockDocument = { body: createMockElement('body'), defaultView: mockWindow, createElement: createMockElement }
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
   createFsDir: (parentDir, name) => createDirectory(parentDir, name, { platform: 'linux', homedir: homeDir }),
   createIdleTracker,
   data: routedKV,
   defaultValueForType,
   document: mockDocument,
   fetchFsList: dirPath => listDirectories(dirPath, { platform: 'linux', homedir: homeDir }),
   fetchFsRoots: () => listDisks({
    platform: 'linux',
    homedir: homeDir,
    mountsText: '/dev/nvme0n1p2 / ext4 rw 0 0\n',
    extraMountParents: [mountParent],
   }),
   formatImportLine,
   hasImportCycle,
   normalizePrimitiveType,
   parseImportLine,
   primitiveTypes: PRIMITIVE_TYPES,
   resolveImportValue,
   resolveScopeColumns,
   runLines,
   runTransportedScripts,
  })
  await f.run(parse(mainSource, '/src/main.fs'))
  const laneControl = f.state['lane-control']
  const rails = laneControl.rails
  const dirModal = laneControl['dir-modal']
  const sessionModal = laneControl['session-modal']
  const packageModal = laneControl['package-modal']
  const summary = laneControl['workspace-summary']

  // 1. On initial boot with unconfirmed session, dir-modal opens in mandatory confirm mode (no cancel/close)
  const defaultSessId = laneControl['session-id']
  assert.equal(dirModal['is-open'], true)
  assert.equal(dirModal.mode, 'confirm')
  assert.equal(dirModal['cancel-btn'].hidden, true)
  assert.equal(dirModal['close-btn'].hidden, true)
  assert.equal(laneControl['session-data-dir'], null)
  assert.equal(laneControl['session-data-dir-confirmed'], false)
  assert.equal(summary['sess-dir-btn'].textContent, 'Default (unconfirmed)')
  assert.match(summary['sess-dir-btn'].className, /workspace-session-dir--unconfirmed/)
  assert.equal(rails['session-dir-el'].textContent, 'Default (unconfirmed)')

  // Escape and backdrop click do not dismiss mandatory confirm
  await dispatchWindowEvent('keydown', { key: 'Escape' })
  await dirModal.backdrop.listeners.click({ target: dirModal.backdrop })
  assert.equal(dirModal['is-open'], true)

  // Confirm Default -> locks Default, closes modal, updates all session UI panes
  await dirModal['default-btn'].listeners.click()
  assert.equal(dirModal['is-open'], false)
  assert.equal(laneControl['session-data-dir'], null)
  assert.equal(laneControl['session-data-dir-confirmed'], true)
  assert.equal(summary['sess-dir-btn'].textContent, 'Default')
  assert.doesNotMatch(summary['sess-dir-btn'].className, /workspace-session-dir--unconfirmed/)
  assert.equal(rails['session-dir-el'].textContent, 'Default')

  // Create a lane + custom preferences lane in Default so we verify cross-directory isolation
  await laneControl['rename-session']('Default Home')
  const defaultLane = await laneControl.add()
  await laneControl.rename(defaultLane.id, 'Default Lane')
  const defaultPrefLane = await laneControl['create-preferences-lane']()
  defaultPrefLane.notebook.rows[1]['input-el'].value = '; to interface.backgroundColor #112233'
  await defaultPrefLane.notebook.rows[1]['input-el'].listeners.input()
  await laneControl['apply-preferences']()
  assert.equal(mockDocument.body.style.backgroundColor, '#112233')
  await laneControl['save-session-draft']()

  // 2. Click "+ New session" from top-rail menu -> opens computer directory picker in create mode
  await rails['session-new-btn'].listeners.click()
  assert.equal(dirModal['is-open'], true)
  assert.equal(dirModal.mode, 'create')
  assert.equal(dirModal['cancel-btn'].hidden, false)
  assert.equal(dirModal['close-btn'].hidden, false)
  assert.ok(dirModal['root-items'].some(it => it.root.path === path.resolve(externalDisk)))

  // Toggle Show hidden in home directory to verify .tmi dotfolder appears
  assert.equal(dirModal['dir-items'].some(it => it.dir.name === '.tmi'), false)
  await dirModal['hidden-btn'].listeners.click()
  assert.equal(dirModal['dir-items'].some(it => it.dir.name === '.tmi'), true)

  // Click externalDisk in sidebar, create a new subfolder via + New Folder, enter session name, and Create Here
  const diskBtn = dirModal['root-items'].find(it => it.root.path === path.resolve(externalDisk)).el
  await diskBtn.listeners.click()
  assert.equal(dirModal['current-path'], path.resolve(externalDisk))
  await dirModal['new-folder-btn'].listeners.click()
  dirModal['new-folder-input'].value = 'my-workspace'
  await dirModal['new-folder-row'].listeners.submit({ preventDefault() {} })
  const customWorkspaceDir = path.join(path.resolve(externalDisk), 'my-workspace')
  assert.equal(dirModal['current-path'], customWorkspaceDir)

  dirModal['name-input'].value = 'Project Disk'
  await dirModal['select-btn'].listeners.click()
  assert.equal(dirModal['is-open'], false)

  const projectSessId = laneControl['session-id']
  assert.notEqual(projectSessId, defaultSessId)
  assert.equal(laneControl['session-meta'].name, 'Project Disk')
  assert.equal(laneControl['session-data-dir'], customWorkspaceDir)
  assert.equal(laneControl['session-data-dir-confirmed'], true)
  assert.equal(routedKV.basePath, customWorkspaceDir)
  assert.equal(mockDocument.body.style.backgroundColor, '#202020')
  assert.equal(laneControl.lanes.length, 0)

  // Add a lane in Project Disk -> writes strictly to customWorkspaceDir store, never __default__
  const customPkg = await laneControl['create-package']('CustomPkg', '')
  const customLane = await laneControl.add()
  await laneControl.rename(customLane.id, 'Disk Lane')
  await laneControl['save-session-draft']()
  assert.ok(dirStores.get(customWorkspaceDir).has(`${customLane.id}.title`))
  assert.equal(dirStores.get('__default__').has(`${customLane.id}.title`), false)
  assert.equal(dirStores.get(customWorkspaceDir).has(`${defaultLane.id}.title`), false)

  // 3. Verify chosen directory is displayed in all session info panes, switchers, history, and package page
  assert.equal(summary['sess-dir-btn'].textContent, customWorkspaceDir)
  await rails['sync-session-menu']()
  assert.equal(rails['session-dir-el'].textContent, customWorkspaceDir)
  const recentDefaultInMenu = rails['session-recent-items'].find(it => it.rec.id === defaultSessId)
  assert.ok(recentDefaultInMenu)
  assert.equal(recentDefaultInMenu['dir-el'].textContent, 'Default')

  await sessionModal['open-switch-session']()
  assert.equal(sessionModal['active-dir-box'].textContent, `Data Directory (permanent): ${customWorkspaceDir}`)
  assert.equal(sessionModal['active-dir-btn'].hidden, true)
  const recentDefaultRow = sessionModal['recent-items'].find(it => it.rec.id === defaultSessId)
  assert.ok(recentDefaultRow)
  assert.ok(recentDefaultRow.el.children[0].children.some(el => el.className === 'lane-session-item-dir' && el.textContent === 'Dir: Default'))
  await sessionModal.close()

  await sessionModal['open-history']()
  const projHist = sessionModal['hist-items'].find(it => it.entry.sessionId === projectSessId)
  assert.ok(projHist)
  assert.ok(projHist.el.children[0].children.some(el => el.className === 'lane-history-dir' && el.textContent === `Dir: ${customWorkspaceDir}`))
  sessionModal['hist-search'].value = 'my-workspace'
  await sessionModal['hist-search'].listeners.input()
  assert.equal(sessionModal['hist-items'].length, 1)
  assert.equal(sessionModal['hist-items'][0].entry.sessionId, projectSessId)
  await sessionModal.close()

  await packageModal['open-packages'](customPkg.pkg.id)
  const pkgSessItem = packageModal['pkg-session-items'].find(it => it.session.id === projectSessId)
  assert.ok(pkgSessItem)
  assert.ok(pkgSessItem.el.children[0].children.some(el => el.textContent.includes(customWorkspaceDir)))
  await packageModal.close()

  // 4. Switching back to confirmed Default session swaps basePath, lanes, and preferences without prompting
  await laneControl['switch-session'](defaultSessId)
  assert.equal(dirModal['is-open'], false)
  assert.equal(routedKV.basePath, null)
  assert.equal(mockDocument.body.style.backgroundColor, '#112233')
  assert.ok(laneControl['by-id'][defaultLane.id])
  assert.equal(laneControl['by-id'][customLane.id], undefined)

  // Switch back to Project Disk
  await laneControl['switch-session'](projectSessId)
  assert.equal(dirModal['is-open'], false)
  assert.equal(routedKV.basePath, customWorkspaceDir)
  assert.equal(mockDocument.body.style.backgroundColor, '#202020')
  assert.ok(laneControl['by-id'][customLane.id])

  // 5. Switch to unconfirmed legacy session -> prompts with Cancel button; Cancel returns to Project Disk
  await laneControl['switch-session'](legacySessId)
  assert.equal(dirModal['is-open'], true)
  assert.equal(dirModal.mode, 'confirm')
  assert.equal(dirModal['previous-session-id'], projectSessId)
  assert.equal(dirModal['cancel-btn'].hidden, false)
  await dirModal['cancel-btn'].listeners.click()
  assert.equal(dirModal['is-open'], false)
  assert.equal(laneControl['session-id'], projectSessId)
  assert.equal(routedKV.basePath, customWorkspaceDir)

  // Switch to legacy session again and permanently bind it to ~/.tmi via path bar
  await laneControl['switch-session'](legacySessId)
  assert.equal(dirModal['is-open'], true)
  dirModal['path-input'].value = '~/.tmi'
  await dirModal.pathbar.listeners.submit({ preventDefault() {} })
  assert.equal(dirModal['current-path'], path.resolve(dotTmiDir))
  await dirModal['select-btn'].listeners.click()
  assert.equal(dirModal['is-open'], false)
  assert.equal(laneControl['session-id'], legacySessId)
  assert.equal(laneControl['session-data-dir'], path.resolve(dotTmiDir))
  assert.equal(laneControl['session-data-dir-confirmed'], true)
  assert.equal(routedKV.basePath, path.resolve(dotTmiDir))

  // 6. Permanence check: attempting to alter a confirmed session's directory fails
  const rebindAttempt = await setSessionDataDir(routedKV, mockWindow, projectSessId, { dataDir: path.resolve(dotTmiDir) })
  assert.equal(rebindAttempt.ok, false)
  assert.match(rebindAttempt.error, /permanently set/)
 }
 finally {
  globalThis.fetch = origFetch
  await fs.rm(tempRoot, { recursive: true, force: true })
 }
})

test('storage.mjs: normalizeSessionLinkIds, setSessionLinks, resolveSessionLinks, and listAvailableSessions', async () => {
 assert.deepEqual(
  normalizeSessionLinkIds(['  s-b ', 's-a', 's-b', '', null, undefined, 's-self', 's-c'], 's-self'),
  ['s-b', 's-a', 's-c'],
 )

 const store = new Map()
 const kv = {
  async get(key) { return store.has(key) ? store.get(key) : null },
  async set(key, value) { store.set(key, value) },
  async delete(key) { store.delete(key) },
 }
 const makeStorage = () => {
  const m = new Map()
  return {
   getItem(k) { return m.has(k) ? m.get(k) : null },
   setItem(k, v) { m.set(k, String(v)) },
   removeItem(k) { m.delete(k) },
  }
 }
 const win = { localStorage: makeStorage(), sessionStorage: makeStorage() }

 const sA = await initSessionState(kv, win)
 await renameSession(kv, win, sA.sessionId, 'Session A')
 const sB = await createNewSession(kv, win, { name: 'Session B', dataDir: null, dataDirConfirmed: true })
 const sC = await createNewSession(kv, win, { name: 'Session C', dataDir: null, dataDirConfirmed: true })
 const sD = await createNewSession(kv, win, { name: 'Session D', dataDir: null, dataDirConfirmed: true })

 // Link Session B with multiple Previous (A, C) and multiple Next (C, D) plus self/duplicates
 const res = await setSessionLinks(kv, win, sB.sessionId, {
  previousSessionIds: [sA.sessionId, sB.sessionId, sC.sessionId, sA.sessionId],
  nextSessionIds: [sD.sessionId, sC.sessionId],
 })
 assert.equal(res.ok, true)
 assert.deepEqual(res.previousSessionIds, [sA.sessionId, sC.sessionId])
 assert.deepEqual(res.nextSessionIds, [sD.sessionId, sC.sessionId])

 // Reloading Session B restores links
 const reloadedB = await switchBrowserSession(kv, win, sB.sessionId)
 assert.deepEqual(reloadedB.previousSessionIds, [sA.sessionId, sC.sessionId])
 assert.deepEqual(reloadedB.nextSessionIds, [sD.sessionId, sC.sessionId])

 // Resolving links returns live names and availability
 const resolvedPrev = await resolveSessionLinks(kv, win, reloadedB.previousSessionIds, sB.sessionId)
 assert.equal(resolvedPrev.length, 2)
 assert.equal(resolvedPrev[0].name, 'Session A')
 assert.equal(resolvedPrev[0].available, true)
 assert.equal(resolvedPrev[1].name, 'Session C')
 assert.equal(resolvedPrev[1].available, true)

 // Deleting Session C makes it unavailable while keeping A and D available
 await kvDeleteChunked(kv, sessionMetaKey(sC.sessionId))
 const resolvedAfterDelete = await resolveSessionLinks(kv, win, reloadedB.previousSessionIds, sB.sessionId)
 assert.equal(resolvedAfterDelete[0].available, true)
 assert.equal(resolvedAfterDelete[1].id, sC.sessionId)
 assert.equal(resolvedAfterDelete[1].available, false)

 // listAvailableSessions excludes self and deleted sessions
 const avail = await listAvailableSessions(kv, win, sB.sessionId)
 const availIds = avail.map(item => item.id)
 assert.ok(availIds.includes(sA.sessionId))
 assert.ok(availIds.includes(sD.sessionId))
 assert.ok(!availIds.includes(sB.sessionId))
 assert.ok(!availIds.includes(sC.sessionId))
})

test('Session Previous/Next navigation: Session settings multi-destination config, availability checks, and centered side-rail arrow tabs (hover + mobile tap)', async () => {
 const html = await fs.readFile(new URL('./index.html', import.meta.url), 'utf8')
 assert.ok(html.includes('.side-rail-nav {'))
 assert.ok(html.includes('top: 50%;'))
 assert.ok(html.includes('transform: translateY(-50%);'))
 assert.ok(html.includes('.side-rail-nav--left'))
 assert.ok(html.includes('.side-rail-nav--right'))
 assert.ok(html.includes('.side-rail-nav-tab'))
 assert.ok(html.includes('.side-rail-nav-menu'))

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
   style: {},
   attributes: {},
   children: [],
   listeners: {},
   textContent: '',
   value: '',
   className: '',
   title: '',
   hidden: false,
   disabled: false,
   focused: false,
   removed: false,
   setAttribute(name, value) { this.attributes[name] = value },
   appendChild(child) { this.children.push(child); return child },
   insertBefore(child, ref) {
    const idx = this.children.indexOf(ref)
    if (idx === -1) this.children.push(child)
    else this.children.splice(idx, 0, child)
    return child
   },
   contains(target) {
    if (target === this) return true
    for (const c of this.children) {
     if (c && typeof c.contains === 'function' && c.contains(target)) return true
    }
    return false
   },
   addEventListener(event, handler) { this.listeners[event] = handler },
   focus() { this.focused = true },
   select() {},
   remove() { this.removed = true },
  }
  return el
 }

 const kv = new Map()
 function createMockKV(prefix = '') {
  const qualify = key => (prefix ? `${prefix}.${key}` : key)
  return {
   namespace(name) { return createMockKV(qualify(name)) },
   async get(key) { return kv.has(qualify(key)) ? kv.get(qualify(key)) : null },
   async set(key, value) { kv.set(qualify(key), value) },
   async delete(key) { kv.delete(qualify(key)) },
  }
 }

 const makeMemStorage = () => {
  const m = new Map()
  return {
   getItem(k) { return m.has(k) ? m.get(k) : null },
   setItem(k, v) { m.set(k, String(v)) },
   removeItem(k) { m.delete(k) },
  }
 }

 const docListeners = {}
 const winListeners = {}
 const body = createMockElement('body')
 const mockLocation = { pathname: '/', search: '', hash: '' }
 const mockHistory = {
  pushState(_s, _t, url) { mockLocation.pathname = String(url).split('?')[0].split('#')[0] },
  replaceState(_s, _t, url) { mockLocation.pathname = String(url).split('?')[0].split('#')[0] },
 }
 const mockWindow = {
  Array,
  Boolean,
  Date,
  JSON,
  Math,
  Object,
  Reflect,
  decodeURIComponent,
  localStorage: makeMemStorage(),
  sessionStorage: makeMemStorage(),
  crypto: { randomUUID: () => 'nav-uuid-1' },
  location: mockLocation,
  history: mockHistory,
  addEventListener(event, handler) {
   if (!winListeners[event]) winListeners[event] = []
   winListeners[event].push(handler)
  },
  removeEventListener() {},
 }
 const mockDocument = {
  body,
  defaultView: mockWindow,
  documentElement: createMockElement('html'),
  createElement: createMockElement,
  addEventListener(event, handler) {
   if (!docListeners[event]) docListeners[event] = []
   docListeners[event].push(handler)
  },
 }
 const dataKv = createMockKV()
 const origFetch = globalThis.fetch
 globalThis.fetch = async url => {
  const map = {
   '/src/main.fs': mainSource,
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
   '/src/lane-export-modal.fs': exportModalSource,
   '/src/lane-export-deploy-modal.fs': exportDeployModalSource,
   '/src/lane-session-modal.fs': sessionModalSource,
   '/src/lane-package-modal.fs': packageModalSource,
   '/src/lane-dir-modal.fs': dirModalSource,
   '/src/lane-line-info-modal.fs': lineInfoModalSource,
   '/src/lane-server.fs': laneServerSource,
   '/src/lane-story.fs': laneStorySource,
   '/src/lane-servers-modal.fs': laneServersModalSource,
   '/src/lane-terminal-modal.fs': laneTerminalModalSource,
   '/src/lane-rails.fs': railsSource,
  }
  if (map[url]) return { text: async () => map[url] }
  throw new Error(`Unexpected fetch: ${url}`)
 }

 try {
  const f = field({
   ...DATA_RUNTIME_ENV,
   console: { log() {} },
   createIdleTracker,
   crypto: mockWindow.crypto,
   data: dataKv,
   defaultValueForType,
   document: mockDocument,
   formatImportLine,
   hasImportCycle,
   normalizePrimitiveType,
   parseImportLine,
   primitiveTypes: PRIMITIVE_TYPES,
   resolveImportValue,
   resolveScopeColumns,
   runLines,
   runTransportedScripts,
  })
  await f.run(parse(mainSource, '/src/main.fs'))
  const lc = f.state['lane-control']
  const rails = lc.rails
  const sm = lc['session-modal']

  // Arrow tabs are mounted inside left-rail and right-rail and hidden initially (no links yet)
  assert.ok(rails['left-rail'].children.includes(rails['prev-nav']))
  assert.ok(rails['right-rail'].children.includes(rails['next-nav']))
  assert.equal(rails['prev-nav'].hidden, true)
  assert.equal(rails['next-nav'].hidden, true)

  // Confirm initial Session A and create Sessions B, C, D
  const idA = lc['session-id']
  await lc['confirm-session-data-dir'](null)
  await lc['rename-session']('Alpha')
  const sessB = await lc['new-session']('Beta', null, true)
  const idB = sessB.sessionId
  const sessC = await lc['new-session']('Gamma', null, true)
  const idC = sessC.sessionId
  const sessD = await lc['new-session']('Delta', null, true)
  const idD = sessD.sessionId

  // Switch to Beta and open Session settings modal
  await lc['switch-session'](idB)
  await sm['open-switch-session']()
  assert.equal(sm['is-open'], true)

  // Add multiple Previous sessions (Alpha and Gamma) and multiple Next sessions (Gamma and Delta) via Session settings UI
  sm['prev-select'].value = idA
  await sm['prev-add-btn'].listeners.click()
  sm['prev-select'].value = idC
  await sm['prev-add-btn'].listeners.click()
  sm['next-select'].value = idC
  await sm['next-add-btn'].listeners.click()
  sm['next-select'].value = idD
  await sm['next-add-btn'].listeners.click()

  assert.equal(sm['prev-link-items'].length, 2)
  assert.equal(sm['next-link-items'].length, 2)
  assert.deepEqual(lc['previous-session-ids'], [idA, idC])
  assert.deepEqual(lc['next-session-ids'], [idC, idD])

  // Both side-rail arrow tabs are now visible with count badges "2"
  assert.equal(rails['prev-nav'].hidden, false)
  assert.equal(rails['next-nav'].hidden, false)
  assert.equal(rails['prev-nav-count'].hidden, false)
  assert.equal(rails['prev-nav-count'].textContent, '2')
  assert.equal(rails['next-nav-count'].hidden, false)
  assert.equal(rails['next-nav-count'].textContent, '2')
  assert.equal(rails['prev-nav-menu'].hidden, true)
  assert.equal(rails['next-nav-menu'].hidden, true)

  // Close settings modal
  await sm.close()

  // Desktop hover flow on Right rail (Next): mouseenter expands menu, 1 click switches to Delta
  await rails['next-nav'].listeners.mouseenter()
  assert.equal(rails['is-next-nav-open'], true)
  assert.equal(rails['next-nav-menu'].hidden, false)
  assert.equal(rails['next-nav-items'].length, 2)
  assert.equal(rails['next-nav-items'][0].session.name, 'Gamma')
  assert.equal(rails['next-nav-items'][1].session.name, 'Delta')

  // Mouseleave collapses menu
  await rails['next-nav'].listeners.mouseleave()
  assert.equal(rails['is-next-nav-open'], false)
  assert.equal(rails['next-nav-menu'].hidden, true)

  // Hover again and 1-click Delta -> switches session to Delta and closes menu
  await rails['next-nav'].listeners.mouseenter()
  await rails['next-nav-items'][1].btn.listeners.click()
  assert.equal(lc['session-id'], idD)
  assert.equal(rails['is-next-nav-open'], false)
  // Delta has no configured links yet, so both arrow tabs hide automatically
  assert.equal(rails['prev-nav'].hidden, true)
  assert.equal(rails['next-nav'].hidden, true)

  // Link Beta as Previous from Delta so we can navigate back
  await lc['add-previous-session'](idB)
  assert.equal(rails['prev-nav'].hidden, false)
  assert.equal(rails['prev-nav-count'].hidden, true) // single item hides count badge
  assert.equal(rails['next-nav'].hidden, true)

  // Mobile 2-tap flow (no hover): Tap 1 on arrow tab expands menu, Tap 2 picks Beta
  await rails['prev-nav-tab'].listeners.click({ stopPropagation() {} })
  assert.equal(rails['is-prev-nav-open'], true)
  assert.equal(rails['prev-nav-menu'].hidden, false)
  assert.equal(rails['prev-nav-items'].length, 1)
  assert.equal(rails['prev-nav-items'][0].session.name, 'Beta')
  await rails['prev-nav-items'][0].btn.listeners.click()
  assert.equal(lc['session-id'], idB)
  assert.equal(rails['is-prev-nav-open'], false)

  // Mobile emulated mouseenter + click on arrow tab must stay open (not immediately collapse)
  await rails['prev-nav'].listeners.mouseenter()
  await rails['prev-nav-tab'].listeners.click({ stopPropagation() {} })
  assert.equal(rails['is-prev-nav-open'], true)
  assert.equal(rails['prev-nav-menu'].hidden, false)
  // Pressing Escape closes the flyout
  for (const h of winListeners.keydown || []) await h({ key: 'Escape' })
  assert.equal(rails['is-prev-nav-open'], false)
  assert.equal(rails['prev-nav-menu'].hidden, true)

  // Clean state: no unsaved version -> draft blocks are hidden and jump links are enabled
  assert.equal(lc['session-dirty'], false)
  assert.equal(rails['prev-nav-draft'].hidden, true)
  assert.equal(rails['next-nav-draft'].hidden, true)
  assert.equal(rails['prev-nav-draft'].className, 'workspace-session-draft')
  assert.equal(rails['prev-nav-draft-label'].className, 'workspace-session-draft-label')
  assert.equal(rails['prev-nav-draft-label'].textContent, 'Unsaved version')
  assert.equal(rails['next-nav-draft'].className, 'workspace-session-draft')
  assert.equal(rails['next-nav-draft-label'].textContent, 'Unsaved version')
  assert.ok(rails['prev-nav-items'].every(it => it.btn.disabled === false))
  assert.ok(rails['next-nav-items'].every(it => it.btn.disabled === false))
  let unloadPrevented = false
  const cleanUnloadEv = { preventDefault() { unloadPrevented = true }, returnValue: undefined }
  for (const h of winListeners.beforeunload || []) await h(cleanUnloadEv)
  assert.equal(unloadPrevented, false)
  assert.equal(cleanUnloadEv.returnValue, undefined)

  // Make an unsaved change in Beta -> marks session dirty, shows exact same Unsaved version block above jump links, and disables jump links
  const dirtyLane = await lc.add()
  assert.equal(lc['session-dirty'], true)
  assert.equal(rails['prev-nav-draft'].hidden, false)
  assert.equal(rails['next-nav-draft'].hidden, false)
  assert.ok(rails['prev-nav-menu'].children.indexOf(rails['prev-nav-draft']) < rails['prev-nav-menu'].children.indexOf(rails['prev-nav-list']))
  assert.ok(rails['next-nav-menu'].children.indexOf(rails['next-nav-draft']) < rails['next-nav-menu'].children.indexOf(rails['next-nav-list']))
  assert.ok(rails['prev-nav-items'].every(it => it.btn.disabled === true))
  assert.ok(rails['next-nav-items'].every(it => it.btn.disabled === true))

  // beforeunload blocks leaving while session has an unsaved version
  const dirtyUnloadEv = { preventDefault() { unloadPrevented = true }, returnValue: undefined }
  for (const h of winListeners.beforeunload || []) await h(dirtyUnloadEv)
  assert.equal(unloadPrevented, true)
  assert.match(dirtyUnloadEv.returnValue, /unsaved version/i)

  // Clicking a disabled side-rail jump link while dirty does NOT switch sessions or close the flyout
  await rails['next-nav'].listeners.mouseenter()
  assert.equal(rails['is-next-nav-open'], true)
  await rails['next-nav-items'][1].btn.listeners.click()
  assert.equal(lc['session-id'], idB)
  assert.equal(rails['is-next-nav-open'], true)

  // Top-rail Sessions menu, Sessions modal, History page, and Packages page also show Unsaved version and disable session jump links while dirty
  await rails['open-session-menu']()
  assert.equal(rails['session-draft-row'].hidden, false)
  assert.equal(rails['session-draft-row'].className, 'workspace-session-draft')
  assert.equal(rails['session-draft-label'].textContent, 'Unsaved version')
  assert.equal(rails['session-new-btn'].disabled, true)
  assert.ok(rails['session-recent-items'].every(it => it.btn.disabled === true))
  await rails['session-recent-items'][0].btn.listeners.click()
  assert.equal(lc['session-id'], idB)
  await rails['close-session-menu']()

  await sm['open-switch-session']()
  assert.equal(sm['draft-field'].hidden, false)
  assert.ok(sm['prev-link-items'].every(it => it['go-btn'].disabled === true))
  assert.ok(sm['next-link-items'].every(it => it['go-btn'].disabled === true))
  assert.equal(sm['switch-go-btn'].disabled, true)
  assert.equal(sm['new-sess-btn'].disabled, true)
  assert.ok(sm['recent-items'].filter(it => it['switch-btn']).every(it => it['switch-btn'].disabled === true))
  await sm['prev-link-items'][0]['go-btn'].listeners.click()
  assert.equal(lc['session-id'], idB)

  await sm['open-history']()
  assert.equal(sm['hist-draft-field'].hidden, false)
  assert.equal(sm['hist-new-btn'].disabled, true)
  assert.ok(sm['hist-items'].filter(it => it['switch-btn']).every(it => it['switch-btn'].disabled === true))
  await sm.close()

  // Resolve unsaved version via Abandon directly inside the Next flyout menu -> hides draft block, keeps flyout open, and re-enables jump links
  await rails['next-nav'].listeners.mouseenter()
  assert.equal(rails['is-next-nav-open'], true)
  assert.equal(rails['next-nav-draft'].hidden, false)
  assert.equal(rails['next-nav-items'][1].btn.disabled, true)
  await rails['next-nav-abandon-btn'].listeners.click({ stopPropagation() {} })
  assert.equal(lc['session-dirty'], false)
  assert.equal(rails['next-nav-draft'].hidden, true)
  assert.equal(rails['is-next-nav-open'], true)
  assert.ok(rails['next-nav-items'].every(it => it.btn.disabled === false))

  // Make another change and resolve via Save inside the Previous flyout menu -> enables jump links and allows switching to Delta then back to Beta
  await lc.open(dirtyLane.id)
  assert.equal(lc['session-dirty'], true)
  await rails['prev-nav'].listeners.mouseenter()
  assert.equal(rails['prev-nav-draft'].hidden, false)
  assert.equal(rails['prev-nav-items'][0].btn.disabled, true)
  await rails['prev-nav-save-btn'].listeners.click({ stopPropagation() {} })
  assert.equal(lc['session-dirty'], false)
  assert.equal(rails['prev-nav-draft'].hidden, true)
  assert.equal(rails['prev-nav-items'][0].btn.disabled, false)
  await lc.close(dirtyLane.id)
  await rails['prev-nav-save-btn'].listeners.click({ stopPropagation() {} })
  assert.equal(lc['session-dirty'], false)
  await rails['close-prev-nav']()

  // Availability check: delete Gamma from KV -> Beta's Previous & Next tabs drop Gamma automatically
  await kvDeleteChunked(dataKv, sessionMetaKey(idC))
  await lc['refresh-session-links']()
  assert.equal(rails['prev-nav-items'].length, 1)
  assert.equal(rails['prev-nav-items'][0].session.id, idA)
  assert.equal(rails['next-nav-items'].length, 1)
  assert.equal(rails['next-nav-items'][0].session.id, idD)

  // In Session settings, Gamma is shown as unavailable (disabled go-btn) and can be removed
  await sm['open-switch-session']()
  assert.equal(sm['prev-link-items'].length, 2)
  assert.equal(sm['prev-link-items'][0]['go-btn'].disabled, false)
  assert.equal(sm['prev-link-items'][1]['go-btn'].disabled, true)
  await sm['prev-link-items'][1]['remove-btn'].listeners.click()
  assert.deepEqual(lc['previous-session-ids'], [idA])

  // Deleting Alpha too hides the left arrow tab completely while right arrow tab (Delta) remains visible
  await kvDeleteChunked(dataKv, sessionMetaKey(idA))
  await lc['refresh-session-links']()
  assert.equal(rails['prev-nav'].hidden, true)
  assert.equal(rails['next-nav'].hidden, false)
  await sm.close()
 }
 finally {
  globalThis.fetch = origFetch
 }
})

test('Agent context helpers (formatAgentContext, inspectSessionForAgent) and UI Copy Info buttons in workspace summary, Configure Lane, Session modal, and top rail', async () => {
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
 const exportModalSource = await fs.readFile(new URL('./src/lane-export-modal.fs', import.meta.url), 'utf8')
 const exportDeployModalSource = await fs.readFile(new URL('./src/lane-export-deploy-modal.fs', import.meta.url), 'utf8')
 const laneServerSource = await fs.readFile(new URL('./src/lane-server.fs', import.meta.url), 'utf8')
 const laneServersModalSource = await fs.readFile(new URL('./src/lane-servers-modal.fs', import.meta.url), 'utf8')
 const laneTerminalModalSource = await fs.readFile(new URL('./src/lane-terminal-modal.fs', import.meta.url), 'utf8')
 const railsSource = await fs.readFile(new URL('./src/lane-rails.fs', import.meta.url), 'utf8')
 const lineInfoModalSource = await fs.readFile(new URL('./src/lane-line-info-modal.fs', import.meta.url), 'utf8')
 const sessionModalSource = await fs.readFile(new URL('./src/lane-session-modal.fs', import.meta.url), 'utf8')
 const packageModalSource = await fs.readFile(new URL('./src/lane-package-modal.fs', import.meta.url), 'utf8')
 const dirModalSource = await fs.readFile(new URL('./src/lane-dir-modal.fs', import.meta.url), 'utf8')

 function createMockElement(tag) {
  return {
   tag,
   nodeType: 1,
   style: {},
   attributes: {},
   children: [],
   listeners: {},
   textContent: '',
   innerHTML: '',
   value: '',
   className: '',
   hidden: false,
   disabled: false,
   checked: false,
   setAttribute(k, v) { this.attributes[k] = v },
   appendChild(c) { this.children.push(c); return c },
   insertBefore(c, ref) {
    const i = this.children.indexOf(ref)
    if (i === -1) this.children.push(c)
    else this.children.splice(i, 0, c)
    return c
   },
   addEventListener(e, h) { this.listeners[e] = h },
   focus() {},
   select() {},
   remove() {},
  }
 }

 const stores = new Map()
 function getStore(dirKey) {
  if (!stores.has(dirKey)) stores.set(dirKey, new Map())
  return stores.get(dirKey)
 }
 function makeKv(dirKey, prefix = '', rootRef = null, defaultRootRef = null) {
  const store = getStore(dirKey)
  const q = k => (prefix ? `${prefix}/${k}` : k)
  const kv = {
   get basePath() { return dirKey === '__default__' ? null : dirKey },
   get root() { return rootRef || kv },
   get defaultRoot() { return defaultRootRef || rootRef || kv },
   withBasePath(bp) {
    const clean = normalizeDataDir(bp)
    const k = clean === null ? '__default__' : clean
    return makeKv(k, '', null, kv.defaultRoot)
   },
   namespace(name) { return makeKv(dirKey, q(name), kv.root, kv.defaultRoot) },
   hashNamespace(name) { return makeKv(dirKey, q(name), kv.root, kv.defaultRoot) },
   async get(k) { return store.has(q(k)) ? store.get(q(k)) : null },
   async set(k, v) { store.set(q(k), String(v)) },
   async delete(k) { store.delete(q(k)) },
  }
  return kv
 }
 const defaultRootKv = makeKv('__default__')
 let activeRootKv = defaultRootKv
 const switchableKv = {
  get basePath() { return activeRootKv.basePath },
  get root() { return activeRootKv },
  get defaultRoot() { return defaultRootKv },
  withBasePath(bp) { return defaultRootKv.withBasePath(bp) },
  setBasePath(bp) { activeRootKv = defaultRootKv.withBasePath(bp); return activeRootKv },
  namespace(name) { return activeRootKv.namespace(name) },
  hashNamespace(name) { return activeRootKv.hashNamespace(name) },
  get(k) { return activeRootKv.get(k) },
  set(k, v) { return activeRootKv.set(k, v) },
  delete(k) { return activeRootKv.delete(k) },
 }

 const localStore = new Map()
 const sessionStore = new Map()
 const clipboardWrites = []
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
  String,
  decodeURIComponent,
  encodeURIComponent,
  crypto: { randomUUID: () => `agent-uuid-${++uuid}` },
  localStorage: {
   getItem: k => (localStore.has(k) ? localStore.get(k) : null),
   setItem: (k, v) => localStore.set(k, String(v)),
   removeItem: k => localStore.delete(k),
  },
  sessionStorage: {
   getItem: k => (sessionStore.has(k) ? sessionStore.get(k) : null),
   setItem: (k, v) => sessionStore.set(k, String(v)),
   removeItem: k => sessionStore.delete(k),
  },
  navigator: {
   clipboard: {
    async writeText(txt) { clipboardWrites.push(String(txt)) },
   },
  },
  history: {
   pushState(_s, _t, url) { mockWindow.location.pathname = String(url).split('#')[0] || '/' },
   replaceState(_s, _t, url) { mockWindow.location.pathname = String(url).split('#')[0] || '/' },
  },
  location: { pathname: '/', search: '', hash: '' },
  addEventListener() {},
 }
 const mockDocument = {
  body: createMockElement('body'),
  documentElement: createMockElement('html'),
  defaultView: mockWindow,
  createElement: createMockElement,
  addEventListener() {},
 }

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
  if (url === '/src/lane-export-modal.fs') return { text: async () => exportModalSource }
  if (url === '/src/lane-export-deploy-modal.fs') return { text: async () => exportDeployModalSource }
  if (url === '/src/lane-server.fs') return { text: async () => laneServerSource }
  if (url === '/src/lane-story.fs') return { text: async () => laneStorySource }
  if (url === '/src/lane-servers-modal.fs') return { text: async () => laneServersModalSource }
  if (url === '/src/lane-terminal-modal.fs') return { text: async () => laneTerminalModalSource }
  if (url === '/src/lane-rails.fs') return { text: async () => railsSource }
  if (url === '/src/lane-line-info-modal.fs') return { text: async () => lineInfoModalSource }
  if (url === '/src/lane-session-modal.fs') return { text: async () => sessionModalSource }
  if (url === '/src/lane-package-modal.fs') return { text: async () => packageModalSource }
  if (url === '/src/lane-dir-modal.fs') return { text: async () => dirModalSource }
  if (typeof url === 'string' && url.startsWith('http://127.0.0.1:')) return origFetch(url)
  throw new Error(`Unexpected fetch: ${url}`)
 }

 try {
  const f = field({
   ...DATA_RUNTIME_ENV,
   console: { log() {} },
   createIdleTracker,
   data: switchableKv,
   defaultValueForType,
   document: mockDocument,
   formatAgentContext,
   formatAgentPrompt,
   formatImportLine,
   hasImportCycle,
   inspectSessionForAgent,
   location: mockWindow.location,
   normalizePrimitiveType,
   parseImportLine,
   primitiveTypes: PRIMITIVE_TYPES,
   resolveImportValue,
   resolveScopeColumns,
   runLines,
   runTransportedScripts,
   window: mockWindow,
  })

  await f.run(parse(mainSource, '/src/main.fs'))
  const lc = f.state['lane-control']
  await lc['confirm-session-data-dir']('.civil-agent-test')
  await lc['rename-session']('Agent Workspace')

  const lane = await lc.open('inbox-lane-1')
  await lc.rename('inbox-lane-1', 'Inbox')
  lane.notebook.lines = ['; to task "Review PR"']
  lane.notebook['line-records'] = [{ id: 'ln-1', text: '; to task "Review PR"', updatedAt: '2026-11-25T22:10:40.885Z' }]
  await saveLaneScript(switchableKv, lane.data, 'inbox-lane-1', lane.notebook['line-records'], mockWindow, null)
  await lc['save-session-draft']()

  // 1. Workspace summary card "Copy Info" button copies Session-level prompt template
  const summary = lc['workspace-summary']
  assert.ok(summary['quick-copy-btn'])
  await summary['quick-copy-btn'].listeners.click()
  assert.equal(clipboardWrites.length, 1)
  const expectedSessionContext = await lc['format-agent-context']()
  assert.equal(
   clipboardWrites[0],
   `Read @AGENTS.md and use \`./cc\` to inspect my workspace:\n\n${expectedSessionContext}\n\nTask: `,
  )
  assert.match(clipboardWrites[0], /Civil Command Agent Context/)
  assert.match(clipboardWrites[0], /Session: Agent Workspace/)
  assert.match(clipboardWrites[0], /Data Directory \(basePath\): \.civil-agent-test/)
  assert.match(clipboardWrites[0], /Open Lanes \(1\): Inbox \(inbox-lane-1\)/)
  assert.match(clipboardWrites[0], /Route: \/inbox-lane-1/)

  // 2. Configure Lane modal "Copy Info" button copies Lane-level prompt template
  await lc['config-modal'].open(lane)
  assert.equal(lc['config-modal']['copy-agent-btn'].textContent, 'Copy Info')
  await lc['config-modal']['copy-agent-btn'].listeners.click()
  assert.equal(lc['config-modal']['copy-agent-btn'].textContent, 'Copied')
  assert.equal(clipboardWrites.length, 2)
  assert.match(clipboardWrites[1], /^Read @AGENTS\.md and use `\.\/cc` to inspect my workspace:\n\nCivil Command Agent Context/)
  assert.match(clipboardWrites[1], /Session: Agent Workspace/)
  assert.match(clipboardWrites[1], /Data Directory \(basePath\): \.civil-agent-test/)
  assert.match(clipboardWrites[1], /Lane: Inbox \(inbox-lane-1\)/)
  assert.match(clipboardWrites[1], /Lane Package: default/)
  assert.match(clipboardWrites[1], /\n\nTask: $/)
  await lc['config-modal'].close()

  // 2b. Lane header icon-only copy button (left of minimize buttons) copies the exact same Lane-level prompt template
  assert.equal(lane['header-top'].children[2], lane['copy-info-btn'])
  assert.equal(lane['header-top'].children[3], lane['min-left-btn'])
  assert.equal(lane['copy-info-btn'].className, 'lane-copy-btn')
  assert.equal(lane['copy-info-btn'].textContent, '')
  assert.match(lane['copy-info-btn'].innerHTML, /<svg\b[^>]*class="lane-copy-icon"/)
  await lane['copy-info-btn'].listeners.click()
  assert.equal(clipboardWrites.length, 3)
  const expectedLaneContext = await lc['format-agent-context'](lane)
  assert.equal(
   clipboardWrites[2],
   `Read @AGENTS.md and use \`./cc\` to inspect my workspace:\n\n${expectedLaneContext}\n\nTask: `,
  )
  assert.equal(clipboardWrites[1], clipboardWrites[2])
  assert.equal(lane['copy-info-btn'].className, 'lane-copy-btn lane-copy-btn--copied')

  // 2c. Line Info modal "Copy Info" button has same label as Configure Lane and copies Line-level prompt template
  await lc['line-info-modal'].open({
   lane,
   'lane-id': lane.id,
   'line-number': 1,
   'line-id': 'ln-1',
   'line-text': '; to task "Review PR"',
   'updated-at': '2026-11-25T22:10:40.885Z',
   'set-by': { laneId: 'source-lane-1', lineId: 'exp-2' },
   'set-by-label': 'L2',
  })
  assert.equal(lc['line-info-modal']['copy-agent-btn'].textContent, 'Copy Info')
  assert.equal(lc['line-info-modal']['copy-agent-btn'].className, 'lane-modal-action lane-config-reset-btn')
  await lc['line-info-modal']['copy-agent-btn'].listeners.click()
  assert.equal(lc['line-info-modal']['copy-agent-btn'].textContent, 'Copied')
  assert.equal(clipboardWrites.length, 4)
  assert.match(clipboardWrites[3], /^Read @AGENTS\.md and use `\.\/cc` to inspect my workspace:\n\nCivil Command Agent Context/)
  assert.match(clipboardWrites[3], /Session: Agent Workspace/)
  assert.match(clipboardWrites[3], /Data Directory \(basePath\): \.civil-agent-test/)
  assert.match(clipboardWrites[3], /Lane: Inbox \(inbox-lane-1\)/)
  assert.match(clipboardWrites[3], /Lane Package: default/)
  assert.match(clipboardWrites[3], /Line: #1 \(ln-1\)/)
  assert.match(clipboardWrites[3], /Line ID: ln-1/)
  assert.match(clipboardWrites[3], /Line Source: ; to task "Review PR"/)
  assert.match(clipboardWrites[3], /Line Modified: .*2026-11-25T22:10:40\.885Z/)
  assert.match(clipboardWrites[3], /Line Set By: source-lane-1 · L2/)
  assert.match(clipboardWrites[3], /Route: \/inbox-lane-1/)
  assert.match(clipboardWrites[3], /\n\nTask: $/)
  await lc['line-info-modal'].close()

  // 3. Session modal "Copy Info" button and top-rail "Copy session info for agent" menu item copy the same Session-level template
  await lc['session-modal']['open-switch-session']()
  await lc['session-modal']['copy-agent-btn'].listeners.click()
  assert.equal(clipboardWrites.length, 5)
  assert.equal(clipboardWrites[4], clipboardWrites[0])
  await lc['session-modal'].close()

  await lc.rails['session-copy-btn'].listeners.click()
  assert.equal(clipboardWrites.length, 6)
  assert.equal(clipboardWrites[5], clipboardWrites[0])

  // 4. inspectSessionForAgent discovers the session from defaultRoot registry, routes to its dataDir, and loads the lane
  const inspected = await inspectSessionForAgent(defaultRootKv, { laneId: 'inbox-lane-1' })
  assert.equal(inspected.activeSession.name, 'Agent Workspace')
  assert.equal(inspected.dataDir, '.civil-agent-test')
  assert.equal(inspected.lane.id, 'inbox-lane-1')
  assert.equal(inspected.lane.title, 'Inbox')
  assert.deepEqual(inspected.lane.lines, ['; to task "Review PR"'])

  // 5. agent-api.mjs operations: resolve by title ("Inbox"), mutate script, create/mutate table, eval lane, and live reload via handle-agent-event
  const eventHub = createAgentEventHub()
  const receivedEvents = []
  eventHub.subscribe(ev => {
   receivedEvents.push(ev)
  })

  const byTitle = await agentGetLane(defaultRootKv, { laneId: 'Inbox' })
  assert.equal(byTitle.ok, true)
  assert.equal(byTitle.lane.id, 'inbox-lane-1')

  // Append a script line and update line 1 via agentMutateLaneScript
  const setLineRes = await agentMutateLaneScript(defaultRootKv, {
   laneId: 'Inbox',
   action: 'set-line',
   lineNumber: 1,
   text: '; to amount 4250',
   eventHub,
  })
  assert.equal(setLineRes.ok, true)
  assert.equal(setLineRes.changed, true)

  const appendRes = await agentMutateLaneScript(defaultRootKv, {
   laneId: 'Inbox',
   action: 'append-line',
   text: '; to doubled [ multiply $amount 2 ]',
   eventHub,
  })
  assert.equal(appendRes.ok, true)
  assert.equal(appendRes.lineNumber, 2)

  // Live SSE event handler reloads the mounted lane in the browser automatically!
  await lc['handle-agent-event'](receivedEvents[receivedEvents.length - 1])
  assert.deepEqual(lane.notebook.lines, ['; to amount 4250', '; to doubled [ multiply $amount 2 ]'])

  // Create a Data table with a fixed(2) column and add a row by column name ("19.95" -> scaled integer 1995)
  const createTblRes = await agentMutateLaneTable(defaultRootKv, {
   laneId: 'Inbox',
   action: 'create-table',
   tableName: 'items',
   columns: [
    { name: 'label', type: 'text', required: true },
    { name: 'price', type: 'fixed', decimals: 2 },
   ],
   eventHub,
  })
  assert.equal(createTblRes.ok, true)

  const addRowRes = await agentMutateLaneTable(defaultRootKv, {
   laneId: 'Inbox',
   action: 'add-row',
   table: 'items',
   values: { label: 'Widget', price: '19.95' },
   eventHub,
  })
  assert.equal(addRowRes.ok, true)
  assert.equal(addRowRes.table.namedRows.length, 1)
  assert.equal(addRowRes.table.namedRows[0].label, 'Widget')
  assert.equal(addRowRes.table.namedRows[0].price, 1995)

  // Headless evaluation via agentEvalLane sees both script lines and Data table scope
  const evalRes = await agentEvalLane(defaultRootKv, { laneId: 'Inbox' })
  assert.equal(evalRes.ok, true)
  assert.equal(evalRes.errorCount, 0)
  const doubledEntry = evalRes.scope.find(e => e.key === 'doubled')
  assert.equal(doubledEntry.value, 8500)
  const itemsEntry = evalRes.scope.find(e => e.key === 'items')
  assert.equal(itemsEntry.value.length, 1)
  assert.equal(itemsEntry.value[0].price, 1995)

  // 6. MCP JSON-RPC 2.0 protocol (initialize, tools/list, tools/call, resources/list, resources/read)
  const initRpc = await handleMcpJsonRpc(defaultRootKv, {
   jsonrpc: '2.0',
   id: 1,
   method: 'initialize',
   params: { protocolVersion: '2024-11-05' },
  })
  assert.equal(initRpc.result.serverInfo.name, 'civil-command')

  const toolsRpc = await handleMcpJsonRpc(defaultRootKv, {
   jsonrpc: '2.0',
   id: 2,
   method: 'tools/list',
  })
  assert.equal(toolsRpc.result.tools.length, MCP_TOOLS.length)

  const callEvalRpc = await handleMcpJsonRpc(defaultRootKv, {
   jsonrpc: '2.0',
   id: 3,
   method: 'tools/call',
   params: {
    name: 'cc_eval_lane',
    arguments: { laneId: 'Inbox' },
   },
  })
  assert.equal(callEvalRpc.result.isError, false)
  assert.equal(callEvalRpc.result.structuredContent.laneId, 'inbox-lane-1')

  const resListRpc = await handleMcpJsonRpc(defaultRootKv, {
   jsonrpc: '2.0',
   id: 4,
   method: 'resources/list',
  })
  assert.ok(resListRpc.result.resources.some(r => r.uri === 'civil://sessions'))

  // 7. HTTP handler /api/agent/* and /api/mcp over loopback server
  const http = await import('node:http')
  const agentSecretStore = createServerSecretStore({ useEnv: false })
  const agentToken = createCapabilityToken({ sessionId: null, basePath: null, allowUnlocked: true }, agentSecretStore)
  const srv = http.createServer((req, res) =>
   handleAgentApiRequest(req, res, { rootKv: defaultRootKv, eventHub, secretStore: agentSecretStore })
  )
  await new Promise(resolve => srv.listen(0, '127.0.0.1', resolve))
  const port = srv.address().port
  try {
   const sessHttp = await origFetch(`http://127.0.0.1:${port}/api/agent/sessions`, {
    headers: { [SESSION_TOKEN_HEADER]: agentToken },
   }).then(r => r.json())
   assert.equal(sessHttp.ok, true)
   assert.equal(sessHttp.activeSession.name, 'Agent Workspace')

   const laneHttp = await origFetch(`http://127.0.0.1:${port}/api/agent/lane?lane=Inbox`, {
    headers: { [SESSION_TOKEN_HEADER]: agentToken },
   }).then(r => r.json())
   assert.equal(laneHttp.ok, true)
   assert.equal(laneHttp.lane.id, 'inbox-lane-1')

   const mcpHttp = await origFetch(`http://127.0.0.1:${port}/api/mcp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', [SESSION_TOKEN_HEADER]: agentToken },
    body: JSON.stringify({
     jsonrpc: '2.0',
     id: 99,
     method: 'tools/call',
     params: { name: 'cc_list_sessions', arguments: {} },
    }),
   }).then(r => r.json())
   assert.equal(mcpHttp.id, 99)
   assert.equal(mcpHttp.result.structuredContent.ok, true)
  }
  finally {
   await new Promise(resolve => srv.close(resolve))
  }
 }
 finally {
  globalThis.fetch = origFetch
 }
})

test('Secret inputs (set once, cannot reveal, AES-256-GCM encrypted on disk, runtime decryption & preview/scope redaction) and syncTable in GitHub lane', async () => {
 const notebookSource = await fs.readFile(new URL('./src/lane-notebook.fs', import.meta.url), 'utf8')
 const inputsSource = await fs.readFile(new URL('./src/lane-inputs.fs', import.meta.url), 'utf8')
 const scopeSource = await fs.readFile(new URL('./src/lane-scope.fs', import.meta.url), 'utf8')
 const dataSource = await fs.readFile(new URL('./src/lane-data.fs', import.meta.url), 'utf8')
 const confirmModalSource = await fs.readFile(new URL('./src/confirm-modal.fs', import.meta.url), 'utf8')
 const rowPickerModalSource = await fs.readFile(new URL('./src/lane-row-picker-modal.fs', import.meta.url), 'utf8')
 const outputSource = await fs.readFile(new URL('./src/lane-output.fs', import.meta.url), 'utf8')
 const lineInfoModalSource = await fs.readFile(new URL('./src/lane-line-info-modal.fs', import.meta.url), 'utf8')
 const exportModalSource = await fs.readFile(new URL('./src/lane-export-modal.fs', import.meta.url), 'utf8')
 const exportDeployModalSource = await fs.readFile(new URL('./src/lane-export-deploy-modal.fs', import.meta.url), 'utf8')
 const laneServerSource = await fs.readFile(new URL('./src/lane-server.fs', import.meta.url), 'utf8')

 function createMockElement(tag) {
  return {
   tag,
   nodeType: 1,
   style: {},
   attributes: {},
   children: [],
   listeners: {},
   textContent: '',
   innerHTML: '',
   value: '',
   className: '',
   hidden: false,
   disabled: false,
   checked: false,
   setAttribute(name, val) { this.attributes[name] = String(val) },
   getAttribute(name) { return this.attributes[name] ?? null },
   removeAttribute(name) { delete this.attributes[name] },
   appendChild(child) {
    if (child && typeof child === 'object') {
     child.parentNode = this
     this.children.push(child)
    }
    return child
   },
   insertBefore(child, ref) {
    const idx = this.children.indexOf(ref)
    if (idx === -1) this.children.push(child)
    else this.children.splice(idx, 0, child)
    return child
   },
   remove() { this.removed = true },
   addEventListener(event, handler) { this.listeners[event] = handler },
   focus() { this.focused = true },
   select() { this.selected = true },
  }
 }

 const kv = new Map()
 function createMockKV(prefix = '') {
  const qualify = key => (prefix ? `${prefix}.${key}` : key)
  return {
   namespace(name) { return createMockKV(qualify(name)) },
   async get(key) { return kv.has(qualify(key)) ? kv.get(qualify(key)) : null },
   async set(key, value) { kv.set(qualify(key), String(value)) },
   async delete(key) { kv.delete(qualify(key)) },
  }
 }

 const rootKv = createMockKV()
 const laneId = 'gh-lane-test'
 const laneData = rootKv.namespace(laneId)
 const rawPat = 'ghp_SecretTokenValue9876543210'
 const seenAuthHeaders = []

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
  String,
  decodeURIComponent,
  crypto: { randomUUID: () => `sec-uuid-${++uuid}` },
  fetch: async (url, opts) => {
   const auth = opts && opts.headers && opts.headers.Authorization ? opts.headers.Authorization : ''
   seenAuthHeaders.push({ url, auth })
   if (String(url).includes('/orgs')) {
    return {
     ok: true,
     status: 200,
     async json() {
      return [{ login: 'tagmein', name: 'TagMeIn', id: 48486366, description: 'Civil Command org', html_url: 'https://github.com/tagmein' }]
     },
    }
   }
   return {
    ok: true,
    status: 200,
    async json() {
     return [{
      full_name: 'tagmein/civil-command',
      name: 'civil-command',
      owner: { login: 'tagmein', type: 'Organization' },
      private: false,
      language: 'JavaScript',
      default_branch: 'main',
      description: 'FieldScript workspace',
      html_url: 'https://github.com/tagmein/civil-command',
     }]
    },
   }
  },
 }
 const mockDocument = {
  body: createMockElement('body'),
  defaultView: mockWindow,
  createElement: createMockElement,
 }

 const origFetch = globalThis.fetch
 globalThis.fetch = async (url, opts) => {
  if (url === '/src/lane-notebook.fs') return { text: async () => notebookSource }
  if (url === '/src/lane-inputs.fs') return { text: async () => inputsSource }
  if (url === '/src/lane-scope.fs') return { text: async () => scopeSource }
  if (url === '/src/lane-data.fs') return { text: async () => dataSource }
  if (url === '/src/confirm-modal.fs') return { text: async () => confirmModalSource }
  if (url === '/src/lane-row-picker-modal.fs') return { text: async () => rowPickerModalSource }
  if (url === '/src/lane-output.fs') return { text: async () => outputSource }
  if (url === '/src/lane-line-info-modal.fs') return { text: async () => lineInfoModalSource }
  if (url === '/src/lane-export-modal.fs') return { text: async () => exportModalSource }
  if (url === '/src/lane-export-deploy-modal.fs') return { text: async () => exportDeployModalSource }
  if (url === '/src/lane-server.fs') return { text: async () => laneServerSource }
  if (url === '/src/lane-story.fs') return { text: async () => laneStorySource }
  return mockWindow.fetch(url, opts)
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
   normalizePrimitiveType,
   parseImportLine,
   primitiveTypes: PRIMITIVE_TYPES,
   resolveImportValue,
   resolveScopeColumns,
   runLines,
   runTransportedScripts,
   window: mockWindow,
  })
  const notebookMod = await f.run(parse(notebookSource, '/src/lane-notebook.fs'))
  const container = createMockElement('td')
  const lane = { id: laneId, data: laneData, tab: 'source', subroute: '' }
  const nb = await notebookMod.mount(lane, container)

  // 1. Add organizations and repositories tables in Data tab
  const dataView = nb['data-view']
  await dataView['add-table']('organizations')
  await dataView['add-column']('login', 'text', false, undefined, true)
  await dataView['add-column']('name', 'text', false)
  await dataView['add-column']('id', 'integer', false)
  await dataView['add-column']('url', 'url', false)

  await dataView['add-table']('repositories')
  await dataView['add-column']('full_name', 'text', false, undefined, true)
  await dataView['add-column']('name', 'text', false, undefined, true)
  await dataView['add-column']('owner', 'text', false)
  await dataView['add-column']('language', 'text', false)

  // 2. Switch to Input tab, add `token` of type `secret`, and set it once
  await nb.tabs.input.listeners.click()
  const inputsView = nb['inputs-view']
  await inputsView['add-btn'].listeners.click()
  const secretRow = inputsView.rows[0]
  secretRow['name-el'].value = 'token'
  await secretRow['name-el'].listeners.input()

  // Before selecting `secret`, secret-box is hidden
  assert.equal(secretRow['secret-box'].hidden, true)
  secretRow['type-el'].value = 'secret'
  await secretRow['type-el'].listeners.change()
  assert.equal(secretRow['secret-box'].hidden, false)
  assert.equal(secretRow['secret-input-el'].hidden, false)
  assert.equal(secretRow['secret-set-btn'].hidden, false)
  assert.equal(secretRow['secret-locked-el'].hidden, true)
  assert.equal(secretRow['type-el'].disabled, false)

  // Enter secret PAT and click Set
  secretRow['secret-input-el'].value = rawPat
  await secretRow['secret-set-btn'].listeners.click()

  // Password input is immediately cleared & hidden; locked indicator shown; type select disabled
  assert.equal(secretRow['secret-input-el'].value, '')
  assert.equal(secretRow['secret-input-el'].hidden, true)
  assert.equal(secretRow['secret-set-btn'].hidden, true)
  assert.equal(secretRow['secret-locked-el'].hidden, false)
  assert.match(secretRow['secret-locked-el'].textContent, /Set — cannot reveal/)
  assert.equal(secretRow['type-el'].disabled, true)
  assert.equal(secretRow.entry.secretSet, true)
  assert.ok(secretRow.entry.secretId.startsWith('sec-'))

  // Verify on-disk storage: .inputs has NO plaintext, and secret record is AES-256-GCM encrypted
  const storedInputsRaw = await laneData.get('inputs')
  assert.ok(!storedInputsRaw.includes(rawPat))
  const secretRecord = await loadLaneSecretRecord(rootKv, laneData, laneId, secretRow.entry.secretId)
  assert.ok(secretRecord)
  assert.equal(secretRecord.alg, 'AES-256-GCM')
  assert.ok(secretRecord.iv.length >= 24)
  assert.ok(secretRecord.salt.length >= 32)
  assert.ok(secretRecord.ciphertext.length > 0)
  assert.ok(!JSON.stringify(secretRecord).includes(rawPat))
  for (const [, v] of kv.entries()) {
   assert.ok(!String(v).includes(rawPat), 'Plaintext secret must never appear in any KV key on disk')
  }

  // Attempting to overwrite an already-set secret is rejected (set-once enforcement)
  const overwriteAttempt = await setLaneSecret(rootKv, laneData, laneId, 'token', 'ghp_AnotherToken', secretRow.entry.secretId)
  assert.equal(overwriteAttempt.ok, false)
  assert.equal(overwriteAttempt.alreadySet, true)

  // 3. Write Source script that uses $token in Authorization header and syncs organizations & repositories
  await nb.tabs.source.listeners.click()
  nb.rows[0]['input-el'].value = "; to authHeader ; add 'Bearer ' $token"
  await nb.rows[0]['input-el'].listeners.input()
  await nb['add-btn'].listeners.click()
  nb.rows[1]['input-el'].value = "; to orgsRes !fetch 'https://api.github.com/user/orgs' [ object { headers [ object { Authorization $authHeader } ] } ]"
  await nb.rows[1]['input-el'].listeners.input()
  await nb['add-btn'].listeners.click()
  nb.rows[2]['input-el'].value = '; to orgs !orgsRes.json'
  await nb.rows[2]['input-el'].listeners.input()
  await nb['add-btn'].listeners.click()
  nb.rows[3]['input-el'].value = '!syncTable organizations $orgs login'
  await nb.rows[3]['input-el'].listeners.input()

  // Verify fetch received the real decrypted token at runtime
  assert.ok(seenAuthHeaders.some(h => h.auth === `Bearer ${rawPat}`))

  // Verify line 1 preview redacted the secret token to •••••••• (cannot reveal via Source preview)
  assert.equal(nb.rows[0]['preview-el'].textContent, `"Bearer ${SECRET_MASK}"`)
  assert.ok(!nb.rows[0]['preview-el'].textContent.includes(rawPat))

  // Verify Scope browser masks `token` as type `secret` and redacts `authHeader`
  await nb.tabs.scope.listeners.click()
  const scopeView = nb['scope-view']
  const tokenScopeItem = scopeView.columns[0].items.find(i => i.key === 'token')
  assert.ok(tokenScopeItem)
  await tokenScopeItem.el.listeners.click()
  assert.equal(scopeView.columns[1].kind, 'value')
  assert.equal(scopeView.columns[1]['type-el'].textContent, 'secret')
  assert.match(scopeView.columns[1]['value-el'].textContent, /secret — cannot reveal/)
  assert.ok(!scopeView.columns[1]['value-el'].textContent.includes(rawPat))

  const authScopeItem = scopeView.columns[0].items.find(i => i.key === 'authHeader')
  await authScopeItem.el.listeners.click()
  assert.equal(scopeView.columns[1]['value-el'].textContent, `"Bearer ${SECRET_MASK}"`)

  // Verify organizations table was synced and persisted
  assert.equal(dataView.tables[0].rows.length, 1)
  const reloadedTables = await loadLaneTables(rootKv, laneData, laneId)
  assert.equal(reloadedTables[0].rows.length, 1)

  // Removing the secret input deletes the encrypted secret from disk
  const secIdToDelete = secretRow.entry.secretId
  await secretRow['remove-btn'].listeners.click()
  assert.equal(await loadLaneSecretRecord(rootKv, laneData, laneId, secIdToDelete), null)
 }
 finally {
  globalThis.fetch = origFetch
 }
})

test('Intermediate pending session status (Loading… / Saving…) prevents Unsaved version flash during lane & session operations', async () => {
 const indexHtml = await fs.readFile(new URL('./index.html', import.meta.url), 'utf8')
 assert.match(indexHtml, /\.top-rail-icon--pending\s*\{/)
 assert.match(indexHtml, /\.workspace-session-draft--pending\s*\{/)
 assert.match(indexHtml, /\.workspace-session-draft--pending\s+\.workspace-session-draft-label\s*\{/)
 assert.match(indexHtml, /\.workspace-session-draft-actions\[hidden\]\s*\{/)

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
 const lineInfoModalSource = await fs.readFile(new URL('./src/lane-line-info-modal.fs', import.meta.url), 'utf8')
 const exportModalSource = await fs.readFile(new URL('./src/lane-export-modal.fs', import.meta.url), 'utf8')
 const exportDeployModalSource = await fs.readFile(new URL('./src/lane-export-deploy-modal.fs', import.meta.url), 'utf8')
 const laneServerSource = await fs.readFile(new URL('./src/lane-server.fs', import.meta.url), 'utf8')
 const laneServersModalSource = await fs.readFile(new URL('./src/lane-servers-modal.fs', import.meta.url), 'utf8')
 const laneTerminalModalSource = await fs.readFile(new URL('./src/lane-terminal-modal.fs', import.meta.url), 'utf8')
 const sessionModalSource = await fs.readFile(new URL('./src/lane-session-modal.fs', import.meta.url), 'utf8')
 const packageModalSource = await fs.readFile(new URL('./src/lane-package-modal.fs', import.meta.url), 'utf8')
 const dirModalSource = await fs.readFile(new URL('./src/lane-dir-modal.fs', import.meta.url), 'utf8')

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
   className: '',
   title: '',
   hidden: false,
   disabled: false,
   removed: false,
   focused: false,
   getBoundingClientRect() { return { left: 200, width: 12, top: 2, height: 12 } },
   contains(target) {
    if (target === this) return true
    return this.children.some(child => typeof child.contains === 'function' && child.contains(target))
   },
   setAttribute(name, value) { this.attributes[name] = value },
   removeAttribute(name) { delete this.attributes[name] },
   appendChild(child) {
    if (child && typeof child === 'object') {
     if (child.parentNode && Array.isArray(child.parentNode.children)) {
      const prevIdx = child.parentNode.children.indexOf(child)
      if (prevIdx !== -1) child.parentNode.children.splice(prevIdx, 1)
     }
     child.parentNode = this
     child.removed = false
     this.children.push(child)
    }
    return child
   },
   insertBefore(child, ref) {
    if (child && typeof child === 'object') {
     if (child.parentNode && Array.isArray(child.parentNode.children)) {
      const prevIdx = child.parentNode.children.indexOf(child)
      if (prevIdx !== -1) child.parentNode.children.splice(prevIdx, 1)
     }
     child.parentNode = this
     child.removed = false
     const idx = this.children.indexOf(ref)
     if (idx === -1) this.children.push(child)
     else this.children.splice(idx, 0, child)
    }
    return child
   },
   replaceChildren(...nodes) {
    this.children = []
    for (const n of nodes) this.appendChild(n)
   },
   addEventListener(event, handler) { this.listeners[event] = handler },
   focus() { this.focused = true },
   select() {},
   remove() {
    this.removed = true
    if (this.parentNode && Array.isArray(this.parentNode.children)) {
     const idx = this.parentNode.children.indexOf(this)
     if (idx !== -1) this.parentNode.children.splice(idx, 1)
     this.parentNode = null
    }
   },
  }
 }

 const kv = new Map()
 let pauseGet = null
 let pauseSet = null
 function createMockKV(prefix = '') {
  const qualify = key => (prefix ? `${prefix}.${key}` : key)
  return {
   namespace(name) { return createMockKV(qualify(name)) },
   async get(key) {
    if (pauseGet) {
     const p = pauseGet(qualify(key))
     if (p) await p
    }
    return kv.has(qualify(key)) ? kv.get(qualify(key)) : null
   },
   async set(key, value) {
    if (pauseSet) {
     const p = pauseSet(qualify(key))
     if (p) await p
    }
    kv.set(qualify(key), String(value))
   },
   async delete(key) { kv.delete(qualify(key)) },
  }
 }
 const rootKv = createMockKV()

 const makeMemStorage = () => {
  const m = new Map()
  return {
   getItem(k) { return m.has(k) ? m.get(k) : null },
   setItem(k, v) { m.set(k, String(v)) },
   removeItem(k) { m.delete(k) },
  }
 }

 let uuid = 0
 const localStore = makeMemStorage()
 const sessionStore = makeMemStorage()
 const winListeners = {}
 const mockWindow = {
  Array,
  Boolean,
  Date,
  JSON,
  Math,
  Number,
  Object,
  Reflect,
  String,
  decodeURIComponent,
  localStorage: localStore,
  sessionStorage: sessionStore,
  crypto: { randomUUID: () => `pend-uuid-${++uuid}` },
  history: { pushState(_s, _t, url) { mockWindow.location.pathname = url } },
  location: { pathname: '/', search: '', hash: '' },
  addEventListener(event, handler) {
   winListeners[event] ||= []
   winListeners[event].push(handler)
  },
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
   console: { log() {}, error() {}, warn() {} },
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
   runLines,
   runTransportedScripts,
   window: mockWindow,
  })
  await f.run(parse(mainSource, '/src/main.fs'))

  const lc = f.state['lane-control']
  const rails = lc.rails
  const summary = lc['workspace-summary']
  const sessModal = lc['session-modal']
  const pkgModal = lc['package-modal']

  // Confirm initial session dataDir so dir-modal doesn't stay open
  await lc['confirm-session-data-dir']('')

  // Create a second session (Beta) and link it as Previous on Alpha so side-rail nav is visible
  const alphaId = lc['session-id']
  const betaSess = await lc['new-session']('Beta', '', true)
  const betaId = betaSess.sessionId
  await lc['switch-session'](alphaId)
  await lc['set-session-links']([betaId], [])

  assert.equal(lc['session-status-pending'], false)
  assert.equal(lc['session-dirty'], false)
  assert.equal(summary['draft-box'].hidden, true)

  // Create a saved lane in Alpha and close it so we can open it with a paused KV read
  const laneA = await lc.add()
  await lc.rename(laneA.id, 'Alpha Lane')
  await lc['save-session-draft']()
  await lc.close(laneA.id)
  await lc['save-session-draft']()
  assert.equal(lc['session-dirty'], false)

  // 1. Pause mid-way through opening a lane: must show 'Loading…' (not 'Unsaved version'), hide draft action buttons, and block navigation
  let releaseOpen = null
  pauseGet = key => {
   if (key === `${laneA.id}.title`) {
    pauseGet = null
    return new Promise(resolve => { releaseOpen = resolve })
   }
   return null
  }

  const openPromise = lc.open(laneA.id)
  await new Promise(r => setTimeout(r, 15))

  assert.equal(lc['session-status-pending'], true)
  assert.equal(lc['session-status-label'], 'Loading…')
  assert.equal(lc['is-session-navigation-blocked'](), true)
  assert.equal(summary['draft-box'].hidden, false)
  assert.equal(summary['draft-box'].className, 'workspace-session-draft workspace-session-draft--pending')
  assert.equal(summary['draft-lbl'].textContent, 'Loading…')
  assert.equal(summary['draft-acts'].hidden, true)
  assert.match(rails['session-btn'].className, /top-rail-icon--pending/)
  assert.doesNotMatch(rails['session-btn'].className, /top-rail-icon--dirty/)
  assert.equal(rails['session-draft-row'].hidden, false)
  assert.equal(rails['session-draft-label'].textContent, 'Loading…')
  assert.equal(rails['session-draft-actions'].hidden, true)
  assert.equal(rails['prev-nav-draft'].hidden, false)
  assert.equal(rails['prev-nav-draft-label'].textContent, 'Loading…')
  assert.equal(rails['prev-nav-draft-actions'].hidden, true)
  assert.equal(rails['prev-nav-items'][0].btn.disabled, true)

  // beforeunload blocks with pending message rather than unsaved version message
  const pendingUnloadEv = { preventDefault() {}, returnValue: undefined }
  await lc['handle-before-unload'](pendingUnloadEv)
  assert.match(pendingUnloadEv.returnValue, /loading or saving/i)

  // prompt-new-session does not open modal while pending
  await lc['prompt-new-session'](false)
  assert.equal(sessModal['is-open'], false)

  // Open session modal and package modal while pending -> both display 'Loading…' and block switching
  await sessModal['open-switch-session']()
  assert.equal(sessModal['draft-field'].hidden, false)
  assert.equal(sessModal['draft-text'].textContent, 'Loading…')
  assert.equal(sessModal['draft-btns'].hidden, true)
  assert.equal(sessModal['new-sess-btn'].disabled, true)
  await sessModal.close()

  await pkgModal['open-packages']()
  assert.equal(pkgModal['pkg-sessions-draft'].hidden, false)
  assert.equal(pkgModal['pkg-draft-text'].textContent, 'Loading…')
  assert.equal(pkgModal['pkg-draft-btns'].hidden, true)
  await pkgModal.close()

  releaseOpen()
  await openPromise
  await lc['update-url']()

  // Settled: lane is now open without having saved -> accurately shows 'Unsaved version'
  assert.equal(lc['session-status-pending'], false)
  assert.equal(lc['session-dirty'], true)
  assert.equal(summary['draft-box'].hidden, false)
  assert.equal(summary['draft-box'].className, 'workspace-session-draft')
  assert.equal(summary['draft-lbl'].textContent, 'Unsaved version')
  assert.equal(summary['draft-acts'].hidden, false)
  assert.match(rails['session-btn'].className, /top-rail-icon--dirty/)
  assert.doesNotMatch(rails['session-btn'].className, /top-rail-icon--pending/)

  // 2. Pause mid-way through save-session-draft: must show 'Saving…' (not 'Unsaved version') and then settle to clean
  let releaseSave = null
  pauseSet = key => {
   if (key.includes('sessions#')) {
    pauseSet = null
    return new Promise(resolve => { releaseSave = resolve })
   }
   return null
  }
  const savePromise = lc['save-session-draft']()
  await new Promise(r => setTimeout(r, 15))

  assert.equal(lc['session-status-pending'], true)
  assert.equal(lc['session-status-label'], 'Saving…')
  assert.equal(summary['draft-box'].hidden, false)
  assert.equal(summary['draft-lbl'].textContent, 'Saving…')
  assert.equal(summary['draft-acts'].hidden, true)
  assert.match(rails['session-btn'].className, /top-rail-icon--pending/)
  assert.doesNotMatch(rails['session-btn'].className, /top-rail-icon--dirty/)

  releaseSave()
  await savePromise
  assert.equal(lc['session-status-pending'], false)
  assert.equal(lc['session-dirty'], false)
  assert.equal(summary['draft-box'].hidden, true)

  // 3. Switching to Beta session must NEVER flash 'Unsaved version' at any point during the transition
  const seenDraftTextsDuringSwitch = []
  const origSyncSummary = lc['sync-workspace-summary']
  lc['sync-workspace-summary'] = async () => {
   const res = await origSyncSummary()
   if (!summary['draft-box'].hidden) {
    seenDraftTextsDuringSwitch.push(summary['draft-lbl'].textContent)
   }
   return res
  }

  await lc['switch-session'](betaId)
  assert.equal(lc['session-status-pending'], false)
  assert.equal(lc['session-dirty'], false)
  assert.equal(summary['draft-box'].hidden, true)
  assert.ok(!seenDraftTextsDuringSwitch.includes('Unsaved version'), `Flashed Unsaved version during switch: ${JSON.stringify(seenDraftTextsDuringSwitch)}`)
 }
 finally {
  globalThis.fetch = origFetch
 }
})

function createSwitchableBackendKvForAgentTests() {
 const storesByDir = new Map()
 const accesses = []
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
    accesses.push({ op: 'get', basePath, key: full })
    return store.has(full) ? store.get(full) : null
   },
   async set(key, value) {
    const full = qualify(key)
    accesses.push({ op: 'set', basePath, key: full })
    store.set(full, String(value))
   },
   async delete(key) {
    const full = qualify(key)
    accesses.push({ op: 'delete', basePath, key: full })
    store.delete(full)
   },
  }
  if (!client.root) client.root = client
  if (!client.defaultRoot) client.defaultRoot = basePath === null ? client : defaultClient
  return client
 }
 const defaultClient = makeClient('', null, null, null)
 return Object.assign(defaultClient, { storesByDir, accesses })
}

function runCliSubprocess(args, { stdinText = '', env = {} } = {}) {
 return new Promise((resolve, reject) => {
  const cliPath = new URL('./cc', import.meta.url).pathname
  const child = spawn(process.execPath, [cliPath, ...args], {
   env: { ...process.env, ...env },
   stdio: ['pipe', 'pipe', 'pipe'],
  })
  const outChunks = []
  const errChunks = []
  child.stdout.on('data', c => outChunks.push(c))
  child.stderr.on('data', c => errChunks.push(c))
  child.on('error', reject)
  child.on('close', code => {
   resolve({
    code,
    stdout: Buffer.concat(outChunks).toString('utf8'),
    stderr: Buffer.concat(errChunks).toString('utf8'),
   })
  })
  if (stdinText) {
   child.stdin.write(stdinText)
  }
  child.stdin.end()
 })
}

test('exportLaneLine enforces atomic package-lock gating, HTTP 403 / MCP isError, unlockPackagesForExport, and table trigger propagation', async () => {
 const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cc-export-lock-api-'))
 const vaultFile = path.join(tmpDir, 'secrets', 'vault-secrets.json')
 const backendKv = createSwitchableBackendKvForAgentTests()
 const secretStore = createFileBackedServerSecretStore({ filePath: vaultFile, useEnv: false })
 const proxy = createDataProxyHandler({ backendKv, secretStore, setAsDefaultStore: false })
 const eventHub = createAgentEventHub()
 const emittedEvents = []
 const unsub = eventHub.subscribe(ev => emittedEvents.push(ev))

 const server = http.createServer((req, res) => {
  if (!isAllowedLocalHost(req, { requireHost: true })) {
   res.writeHead(403)
   res.end('Forbidden')
   return
  }
  const pathname = (req.url || '/').split('?')[0]
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
  res.writeHead(404)
  res.end('Not found')
 })

 try {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const port = server.address().port
  const origin = `http://127.0.0.1:${port}`
  const dataUrl = `${origin}/api/data?mode=disk`

  const client = httpKV({ baseUrl: dataUrl, switchable: true, proxyCapabilities: true })
  const win = {}
  const sess = await initSessionState(client, win)
  const dirPath = path.join(tmpDir, 'workspace')
  await fs.mkdir(dirPath, { recursive: true })
  const dirRes = await setSessionDataDir(client, win, sess.sessionId, { dataDir: dirPath })
  assert.equal(dirRes.ok, true)
  const workClient = client.setBasePath(dirPath)

  const pkgConfirmRes = await createPackage(workClient, sess.sessionId, { name: 'ConfirmOnly', passphrase: '' }, win)
  assert.equal(pkgConfirmRes.ok, true)
  const pkgConfirmId = pkgConfirmRes.pkg.id

  const pkgVaultRes = await createPackage(workClient, sess.sessionId, { name: 'VaultBox', passphrase: 'vault-secret-99' }, win)
  assert.equal(pkgVaultRes.ok, true)
  const pkgVaultId = pkgVaultRes.pkg.id

  const openTargetId = 'lane-exp-open'
  const closedTargetId = 'lane-exp-closed'
  const vaultTargetId = 'lane-exp-vault'
  const sourceId = 'lane-exp-source'

  await registerLaneInPackage(workClient, openTargetId, 'Open Target', DEFAULT_PACKAGE_ID)
  await workClient.namespace(openTargetId).set('title', 'Open Target')
  await saveLaneScript(workClient, workClient.namespace(openTargetId), openTargetId, [
   { id: 'ln-open-1', text: '; to x "init"' },
  ])

  await registerLaneInPackage(workClient, closedTargetId, 'Closed Target', pkgConfirmId)
  await workClient.namespace(closedTargetId).set('title', 'Closed Target')
  await saveLaneScript(workClient, workClient.namespace(closedTargetId), closedTargetId, [
   { id: 'ln-closed-1', text: '; to x "init"' },
  ])

  await registerLaneInPackage(workClient, vaultTargetId, 'Vault Target', pkgVaultId)
  await workClient.namespace(vaultTargetId).set('title', 'Vault Target')
  await saveLaneScript(workClient, workClient.namespace(vaultTargetId), vaultTargetId, [
   { id: 'ln-vault-1', text: '; to x "init"' },
  ])

  await registerLaneInPackage(workClient, sourceId, 'Source Lane', DEFAULT_PACKAGE_ID)
  await workClient.namespace(sourceId).set('title', 'Source Lane')
  await addLaneTable(workClient, workClient.namespace(sourceId), sourceId, {
   id: 'tbl-trigger',
   name: 'items',
   columns: [{ id: 'col-k', name: 'k', type: 'text' }],
   rows: [],
  }, ['tbl-trigger'])
  await saveLaneScript(workClient, workClient.namespace(sourceId), sourceId, [
   {
    id: 'ln-src-1',
    text: `!exportLaneLine { [ ; object { laneId '${openTargetId}' } { lineId 'ln-open-1' } ] [ ; object { laneId '${closedTargetId}' } { lineId 'ln-closed-1' } ] [ ; object { laneId '${vaultTargetId}' } { lineId 'ln-vault-1' } ] } '; to x "updated-multi"'`,
   },
   {
    id: 'ln-src-2',
    text: `!setLaneLine '${vaultTargetId}' 'ln-vault-1' '; to x "updated-3arg"'`,
   },
  ])

  // Verify helper normalization directly
  const normMulti = normalizeExportTargetsAndValue(
   [{ laneId: openTargetId, lineId: 'ln-open-1' }, { laneId: closedTargetId, lineNumber: 1 }],
   '; to v 1'
  )
  assert.equal(normMulti.targets.length, 2)
  assert.equal(normMulti.text, '; to v 1')
  const norm3Arg = normalizeExportTargetsAndValue(vaultTargetId, 1, '; to v 2')
  assert.deepEqual(norm3Arg, { targets: [{ laneId: vaultTargetId, lineId: '1' }], text: '; to v 2' })

  // Close both packages so ConfirmOnly (no passphrase) and VaultBox (passphrase) require user unlock
  await closePackageInSession(workClient, sess.sessionId, pkgConfirmId, win)
  await closePackageInSession(workClient, sess.sessionId, pkgVaultId, win)

  const preAccess = await checkExportTargetsAccess(
   workClient,
   [DEFAULT_PACKAGE_ID],
   [
    { laneId: openTargetId, lineId: 'ln-open-1' },
    { laneId: closedTargetId, lineId: 'ln-closed-1' },
    { laneId: vaultTargetId, lineId: 'ln-vault-1' },
   ],
   sourceId
  )
  assert.equal(preAccess.allowed, false)
  assert.equal(preAccess.requiresPackageUnlock, true)
  assert.deepEqual(preAccess.lockedPackages.map(p => [p.packageId, p.hasPassphrase]), [
   [pkgConfirmId, false],
   [pkgVaultId, true],
  ])

  // Track raw backend reads/writes during locked export eval
  const accessStart = backendKv.accesses.length

  // 1. Read-only agentEvalLane succeeds without modifying targets
  const readOnlyOut = await agentEvalLane(workClient, {
   sessionId: sess.sessionId,
   dataDir: dirPath,
   laneId: sourceId,
   applyExports: false,
  })
  assert.equal(readOnlyOut.ok, true)
  assert.equal(Boolean(readOnlyOut.requiresPackageUnlock), false)
  assert.equal(readOnlyOut.errorCount, 0, JSON.stringify(readOnlyOut.lines))
  assert.equal(JSON.parse(readOnlyOut.lines[0].preview).requiresPackageUnlock, true)
  assert.equal(JSON.parse(readOnlyOut.lines[1].preview).requiresPackageUnlock, true)

  // 2. applyExports: true via agentEvalLane holds ALL exports atomically (including Open Target!)
  const lockedEval = await agentEvalLane(workClient, {
   sessionId: sess.sessionId,
   dataDir: dirPath,
   laneId: sourceId,
   applyExports: true,
   eventHub,
  })
  const evalAccessEnd = backendKv.accesses.length
  assert.equal(lockedEval.ok, false)
  assert.equal(lockedEval.accessDenied, true)
  assert.equal(lockedEval.requiresPackageUnlock, true)
  assert.equal(lockedEval.changedExportLaneIds.length, 0)
  assert.equal(lockedEval.lockedPackages.length, 2)
  assert.equal(lockedEval.pendingExports.length, 2)

  // Assert Open Target in Default package was NOT modified (atomic per-export-call staging)
  const rawWorkKv = backendKv.withBasePath(dirPath)
  const openAfterHold = await loadLaneScript(rawWorkKv, rawWorkKv.namespace(openTargetId), openTargetId)
  assert.equal(openAfterHold.records[0].text, '; to x "init"')
  const closedAfterHold = await loadLaneScript(rawWorkKv, rawWorkKv.namespace(closedTargetId), closedTargetId)
  assert.equal(closedAfterHold.records[0].text, '; to x "init"')
  const vaultAfterHold = await loadLaneScript(rawWorkKv, rawWorkKv.namespace(vaultTargetId), vaultTargetId)
  assert.equal(vaultAfterHold.records[0].text, '; to x "init"')

  // Assert zero reads or writes touched closedTarget / vaultTarget script keys during evals while locked
  const lockedTouchedKeys = backendKv.accesses.slice(accessStart, evalAccessEnd).filter(
   a => a.key.includes(`lanes#${closedTargetId}/script`) || a.key.includes(`lanes#${vaultTargetId}/script`)
  )
  assert.deepEqual(lockedTouchedKeys, [])

  // Assert SSE event was emitted
  assert.ok(emittedEvents.some(ev => ev.type === 'export-unlock-required' && ev.lockedPackages.length === 2))

  // 3. Explicit empty openPackageIds = [] must enforce locks (even on Default package targets)
  const emptyAccessCheck = await checkExportTargetsAccess(
   workClient,
   [],
   [{ laneId: openTargetId, lineId: 'ln-open-1' }],
   sourceId
  )
  assert.equal(emptyAccessCheck.allowed, false)
  assert.ok(emptyAccessCheck.lockedPackages.some(p => p.packageId === DEFAULT_PACKAGE_ID))
  const emptyPkgEval = await agentEvalLane(workClient, {
   sessionId: sess.sessionId,
   dataDir: dirPath,
   laneId: sourceId,
   applyExports: true,
   openPackageIds: [],
  })
  assert.equal(emptyPkgEval.ok, false)
  assert.equal(emptyPkgEval.requiresPackageUnlock, true, JSON.stringify(emptyPkgEval))

  // 4. HTTP POST /api/agent/lane/eval returns 403 + structured lockedPackages
  const httpEvalResp = await fetch(`${origin}/api/agent/lane/eval`, {
   method: 'POST',
   headers: {
    'Content-Type': 'application/json',
    [SESSION_TOKEN_HEADER]: client.getSessionToken(),
   },
   body: JSON.stringify({
    sessionId: sess.sessionId,
    dataDir: dirPath,
    laneId: sourceId,
    applyExports: true,
   }),
  })
  assert.equal(httpEvalResp.status, 403)
  const httpEvalJson = await httpEvalResp.json()
  assert.equal(httpEvalJson.ok, false)
  assert.equal(httpEvalJson.accessDenied, true)
  assert.equal(httpEvalJson.requiresPackageUnlock, true)
  assert.equal(httpEvalJson.lockedPackages.length, 2)

  // 5. MCP cc_eval_lane returns isError: true + structuredContent
  const mcpResp = await fetch(`${origin}/api/mcp`, {
   method: 'POST',
   headers: {
    'Content-Type': 'application/json',
    [SESSION_TOKEN_HEADER]: client.getSessionToken(),
   },
   body: JSON.stringify({
    jsonrpc: '2.0',
    id: 77,
    method: 'tools/call',
    params: {
     name: 'cc_eval_lane',
     arguments: {
      sessionId: sess.sessionId,
      dataDir: dirPath,
      laneId: sourceId,
      applyExports: true,
     },
    },
   }),
  })
  assert.equal(mcpResp.status, 200)
  const mcpJson = await mcpResp.json()
  assert.equal(mcpJson.result.isError, true)
  assert.equal(mcpJson.result.structuredContent.requiresPackageUnlock, true)
  assert.equal(mcpJson.result.structuredContent.lockedPackages.length, 2)

  // 6. agentMutateLaneTable surfaces triggeredEval.requiresPackageUnlock and still holds exports
  const tableAddRes = await agentMutateLaneTable(workClient, {
   sessionId: sess.sessionId,
   dataDir: dirPath,
   laneId: sourceId,
   tableName: 'items',
   action: 'add-row',
   values: { k: 'row-1' },
  })
  assert.equal(tableAddRes.ok, true, JSON.stringify(tableAddRes))
  assert.equal(tableAddRes.triggeredEval.requiresPackageUnlock, true)
  assert.equal((await loadLaneScript(rawWorkKv, rawWorkKv.namespace(openTargetId), openTargetId)).records[0].text, '; to x "init"')

  const tableDelRes = await agentMutateLaneTable(workClient, {
   sessionId: sess.sessionId,
   dataDir: dirPath,
   laneId: sourceId,
   tableName: 'items',
   action: 'delete-row',
   rowId: tableAddRes.row.id,
  })
  assert.equal(tableDelRes.ok, true)
  assert.equal(tableDelRes.triggeredEval.requiresPackageUnlock, true)

  const tableClearRes = await agentMutateLaneTable(workClient, {
   sessionId: sess.sessionId,
   dataDir: dirPath,
   laneId: sourceId,
   tableName: 'items',
   action: 'clear-rows',
  })
  assert.equal(tableClearRes.ok, true)
  assert.equal(tableClearRes.triggeredEval.requiresPackageUnlock, true)

  // 7. unlockPackagesForExport: mid-queue cancel leaves VaultBox closed and exports held
  const cancelRes = await unlockPackagesForExport(workClient, {
   sessionId: sess.sessionId,
   lockedPackages: lockedEval.lockedPackages,
   promptConfirmOpen: async () => true,
   promptPassphrase: async () => '',
  })
  assert.equal(cancelRes.ok, false)
  assert.equal(cancelRes.cancelled, true)
  assert.deepEqual(cancelRes.openedPackageIds, [pkgConfirmId])

  // Even with ConfirmOnly open, VaultBox is still closed -> Open Target STILL held during re-eval!
  const partialHoldEval = await agentEvalLane(workClient, {
   sessionId: sess.sessionId,
   dataDir: dirPath,
   laneId: sourceId,
   applyExports: true,
  })
  assert.equal(partialHoldEval.ok, false)
  assert.equal(partialHoldEval.requiresPackageUnlock, true)
  assert.deepEqual(partialHoldEval.lockedPackages.map(p => p.packageId), [pkgVaultId])
  assert.equal((await loadLaneScript(rawWorkKv, rawWorkKv.namespace(closedTargetId), closedTargetId)).records[0].text, '; to x "init"')
  assert.equal((await loadLaneScript(rawWorkKv, rawWorkKv.namespace(openTargetId), openTargetId)).records[0].text, '; to x "init"')

  // Wrong passphrase exhausts maxPassphraseAttempts
  let wrongCount = 0
  const maxFailRes = await unlockPackagesForExport(workClient, {
   sessionId: sess.sessionId,
   lockedPackages: partialHoldEval.lockedPackages,
   maxPassphraseAttempts: 2,
   promptPassphrase: async () => {
    wrongCount += 1
    return 'wrong-pass'
   },
  })
  assert.equal(maxFailRes.ok, false)
  assert.equal(wrongCount, 2)

  // Wrong once then right passphrase succeeds, allowing applyExports run to write all targets
  const passSequence = ['wrong-first', 'vault-secret-99']
  const openedNotifs = []
  const unlockOk = await unlockPackagesForExport(workClient, {
   sessionId: sess.sessionId,
   lockedPackages: partialHoldEval.lockedPackages,
   maxPassphraseAttempts: 3,
   promptPassphrase: async () => passSequence.shift() || '',
   onPackageOpened: async pkg => { openedNotifs.push(pkg.packageId) },
  })
  assert.equal(unlockOk.ok, true)
  assert.deepEqual(unlockOk.openedPackageIds, [pkgVaultId])
  assert.deepEqual(openedNotifs, [pkgVaultId])

  const appliedEval = await agentEvalLane(workClient, {
   sessionId: sess.sessionId,
   dataDir: dirPath,
   laneId: sourceId,
   applyExports: true,
  })
  assert.equal(appliedEval.ok, true)
  assert.equal(Boolean(appliedEval.requiresPackageUnlock), false)

  const openAfterApply = await loadLaneScript(rawWorkKv, rawWorkKv.namespace(openTargetId), openTargetId)
  const closedAfterApply = await loadLaneScript(rawWorkKv, rawWorkKv.namespace(closedTargetId), closedTargetId)
  const vaultAfterApply = await loadLaneScript(rawWorkKv, rawWorkKv.namespace(vaultTargetId), vaultTargetId)
  assert.equal(openAfterApply.records[0].text, '; to x "updated-multi"')
  assert.equal(closedAfterApply.records[0].text, '; to x "updated-multi"')
  assert.equal(vaultAfterApply.records[0].text, '; to x "updated-3arg"')
  assert.equal(closedAfterApply.records[0].setBy.laneId, sourceId)
  assert.equal(vaultAfterApply.records[0].setBy.laneId, sourceId)
 }
 finally {
  unsub()
  if (typeof server.closeAllConnections === 'function') server.closeAllConnections()
  await new Promise(resolve => server.close(resolve))
  await fs.rm(tmpDir, { recursive: true, force: true })
 }
})

test('./cc CLI eval --apply-exports --no-prompt and ./cc open-package enforce export locks via loopback proxy server', async () => {
 const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cc-cli-export-lock-'))
 const vaultFile = path.join(tmpDir, 'secrets', 'vault-secrets.json')
 const backendKv = createSwitchableBackendKvForAgentTests()
 const secretStore = createFileBackedServerSecretStore({ filePath: vaultFile, useEnv: false })
 const proxy = createDataProxyHandler({ backendKv, secretStore, setAsDefaultStore: false })
 const eventHub = createAgentEventHub()
 const emittedEvents = []
 const unsub = eventHub.subscribe(ev => emittedEvents.push(ev))

 const server = http.createServer((req, res) => {
  if (!isAllowedLocalHost(req, { requireHost: true })) {
   res.writeHead(403)
   res.end('Forbidden')
   return
  }
  const pathname = (req.url || '/').split('?')[0]
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
  res.writeHead(404)
  res.end('Not found')
 })

 try {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const port = server.address().port
  const origin = `http://127.0.0.1:${port}`
  const client = httpKV({ baseUrl: `${origin}/api/data?mode=disk`, switchable: true, proxyCapabilities: true })
  const win = {}
  const sess = await initSessionState(client, win)
  const dirPath = path.join(tmpDir, 'workspace')
  await fs.mkdir(dirPath, { recursive: true })
  const dirRes = await setSessionDataDir(client, win, sess.sessionId, { dataDir: dirPath })
  assert.equal(dirRes.ok, true)
  const workClient = client.setBasePath(dirPath)

  const pkgConfirmRes = await createPackage(workClient, sess.sessionId, { name: 'CliConfirm', passphrase: '' }, win)
  const pkgVaultRes = await createPackage(workClient, sess.sessionId, { name: 'CliVault', passphrase: 'cli-pass-42' }, win)

  await registerLaneInPackage(workClient, 'cli-open-tgt', 'CliOpen', DEFAULT_PACKAGE_ID)
  await saveLaneScript(workClient, workClient.namespace('cli-open-tgt'), 'cli-open-tgt', [{ id: 'o1', text: '; to v 0' }])

  await registerLaneInPackage(workClient, 'cli-confirm-tgt', 'CliConfirmTgt', pkgConfirmRes.pkg.id)
  await saveLaneScript(workClient, workClient.namespace('cli-confirm-tgt'), 'cli-confirm-tgt', [{ id: 'c1', text: '; to v 0' }])

  await registerLaneInPackage(workClient, 'cli-vault-tgt', 'CliVaultTgt', pkgVaultRes.pkg.id)
  await saveLaneScript(workClient, workClient.namespace('cli-vault-tgt'), 'cli-vault-tgt', [{ id: 'v1', text: '; to v 0' }])

  await registerLaneInPackage(workClient, 'cli-src', 'CliSource', DEFAULT_PACKAGE_ID)
  await saveLaneScript(workClient, workClient.namespace('cli-src'), 'cli-src', [
   { id: 's1', text: "!exportLaneLine { [ ; object { laneId 'cli-open-tgt' } { lineId 'o1' } ] [ ; object { laneId 'cli-confirm-tgt' } { lineId 'c1' } ] } '; to v 11'" },
   { id: 's2', text: "!setLaneLine 'cli-vault-tgt' 'v1' '; to v 22'" },
  ])

  await closePackageInSession(workClient, sess.sessionId, pkgConfirmRes.pkg.id, win)
  await closePackageInSession(workClient, sess.sessionId, pkgVaultRes.pkg.id, win)

  // 1. ./cc eval --apply-exports --no-prompt exits 1, emits export-unlock-required, and holds all writes
  const lockedCli = await runCliSubprocess([
   'eval', 'cli-src',
   '--session', sess.sessionId,
   '--dir', dirPath,
   '--apply-exports',
   '--no-prompt',
   '--host', origin,
  ])
  assert.equal(lockedCli.code, 1, `stderr: ${lockedCli.stderr}\nstdout: ${lockedCli.stdout}`)
  const lockedJson = JSON.parse(lockedCli.stdout)
  assert.equal(lockedJson.ok, false)
  assert.equal(lockedJson.requiresPackageUnlock, true)
  assert.equal(lockedJson.lockedPackages.length, 2, `lockedJson=${JSON.stringify(lockedJson)}`)
  assert.ok(emittedEvents.some(ev => ev.type === 'export-unlock-required' && ev.laneId === 'cli-src'))

  const rawWorkKv = backendKv.withBasePath(dirPath)
  assert.equal((await loadLaneScript(rawWorkKv, rawWorkKv.namespace('cli-open-tgt'), 'cli-open-tgt')).records[0].text, '; to v 0')

  // 2. Wrong passphrase fails ./cc open-package cleanly
  const wrongVaultCli = await runCliSubprocess([
   'open-package', pkgVaultRes.pkg.id,
   '--passphrase', 'wrong-pw',
   '--session', sess.sessionId,
   '--dir', dirPath,
   '--host', origin,
  ])
  assert.equal(wrongVaultCli.code, 1)
  assert.equal(JSON.parse(wrongVaultCli.stdout).ok, false)

  // 3. ./cc open-package unlocks non-passphrase package across processes and emits package-opened
  const openConfirmCli = await runCliSubprocess([
   'open-package', pkgConfirmRes.pkg.id,
   '--session', sess.sessionId,
   '--dir', dirPath,
   '--host', origin,
  ])
  assert.equal(openConfirmCli.code, 0, openConfirmCli.stderr || openConfirmCli.stdout)
  assert.equal(JSON.parse(openConfirmCli.stdout).ok, true)
  assert.ok(emittedEvents.some(ev => ev.type === 'package-opened' && ev.packageId === pkgConfirmRes.pkg.id))

  // Subsequent --no-prompt eval sees CliConfirm open (s1 writes) while CliVault stays locked (capability-isolated)
  const partialCli = await runCliSubprocess([
   'eval', 'cli-src',
   '--session', sess.sessionId,
   '--dir', dirPath,
   '--apply-exports',
   '--no-prompt',
   '--host', origin,
  ])
  assert.equal(partialCli.code, 1)
  const partialJson = JSON.parse(partialCli.stdout)
  assert.equal(partialJson.requiresPackageUnlock, true)
  assert.deepEqual(partialJson.lockedPackages.map(p => p.packageId), [pkgVaultRes.pkg.id])
  assert.equal((await loadLaneScript(rawWorkKv, rawWorkKv.namespace('cli-vault-tgt'), 'cli-vault-tgt')).records[0].text, '; to v 0')

  // ./cc open-package unlocks passphrase package too and emits package-opened
  const openVaultCli = await runCliSubprocess([
   'open-package', pkgVaultRes.pkg.id,
   '--passphrase', 'cli-pass-42',
   '--session', sess.sessionId,
   '--dir', dirPath,
   '--host', origin,
  ])
  assert.equal(openVaultCli.code, 0, openVaultCli.stderr || openVaultCli.stdout)
  assert.equal(JSON.parse(openVaultCli.stdout).ok, true)
  assert.ok(emittedEvents.some(ev => ev.type === 'package-opened' && ev.packageId === pkgVaultRes.pkg.id))

  // Reset targets via raw backend KV & close both packages before testing single-process interactive PTY unlock + retry
  await saveLaneScript(rawWorkKv, rawWorkKv.namespace('cli-open-tgt'), 'cli-open-tgt', [{ id: 'o1', text: '; to v 0' }])
  await saveLaneScript(rawWorkKv, rawWorkKv.namespace('cli-confirm-tgt'), 'cli-confirm-tgt', [{ id: 'c1', text: '; to v 0' }])
  await saveLaneScript(rawWorkKv, rawWorkKv.namespace('cli-vault-tgt'), 'cli-vault-tgt', [{ id: 'v1', text: '; to v 0' }])
  await closePackageInSession(workClient, sess.sessionId, pkgConfirmRes.pkg.id, win)
  await closePackageInSession(workClient, sess.sessionId, pkgVaultRes.pkg.id, win)

  // 4. Interactive TTY ./cc eval --apply-exports prompts to confirm & enter passphrase (muted), retries, and writes all targets
  const cliPath = new URL('./cc', import.meta.url).pathname
  const pty = spawnPty({
   command: process.execPath,
   args: [cliPath, 'eval', 'cli-src', '--session', sess.sessionId, '--dir', dirPath, '--apply-exports', '--host', origin],
  })
  let ptyBuf = ''
  let sentConfirm = false
  let sentPass = false
  pty.onData(chunk => {
   ptyBuf += chunk
   if (!sentConfirm && ptyBuf.includes('[y/N]:')) {
    sentConfirm = true
    pty.write('y\n')
   }
   if (sentConfirm && !sentPass && ptyBuf.includes('Enter passphrase to unlock package')) {
    sentPass = true
    pty.write('cli-pass-42\n')
   }
  })
  const ptyExitCode = await new Promise(resolve => {
   pty.onExit(resolve)
  })
  assert.equal(ptyExitCode, 0, ptyBuf)
  assert.equal(sentConfirm, true)
  assert.equal(sentPass, true)
  assert.ok(!ptyBuf.includes('cli-pass-42'), 'Muted secret prompt must not echo passphrase')
  assert.equal((await loadLaneScript(rawWorkKv, rawWorkKv.namespace('cli-open-tgt'), 'cli-open-tgt')).records[0].text, '; to v 11', ptyBuf)
  assert.equal((await loadLaneScript(rawWorkKv, rawWorkKv.namespace('cli-confirm-tgt'), 'cli-confirm-tgt')).records[0].text, '; to v 11', ptyBuf)
  assert.equal((await loadLaneScript(rawWorkKv, rawWorkKv.namespace('cli-vault-tgt'), 'cli-vault-tgt')).records[0].text, '; to v 22', ptyBuf)
 }
 finally {
  unsub()
  if (typeof server.closeAllConnections === 'function') server.closeAllConnections()
  await new Promise(resolve => server.close(resolve))
  await fs.rm(tmpDir, { recursive: true, force: true })
 }
})
