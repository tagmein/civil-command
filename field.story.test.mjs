import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import {
 DATA_RUNTIME_ENV,
 DEFAULT_STORY_PAGE_SIZE,
 MAX_KV_VALUE_BYTES,
 PRIMITIVE_TYPES,
 STORY_NAMESPACE,
 agentEvalLane,
 appendLaneStory,
 classifyStoryHeading,
 createIdleTracker,
 defaultValueForType,
 dirModalSource,
 encodeKeySegment,
 exportDeployModalSource,
 exportModalSource,
 field,
 formatImportLine,
 getKvChunkBytes,
 hasImportCycle,
 laneServerSource,
 laneServersModalSource,
 laneStorySource,
 laneTerminalModalSource,
 lineInfoModalSource,
 loadLaneStoryBuckets,
 loadLaneStoryDetail,
 normalizePrimitiveType,
 packageModalSource,
 parse,
 parseImportLine,
 parseStoryRunIdTimestamp,
 queryLaneStories,
 resolveImportValue,
 resolveScopeColumns,
 runLines,
 runTransportedScripts,
 sessionModalSource,
 setKvChunkBytes,
} from './field.fixtures.mjs'

test('story.mjs: 4-tier hierarchical civil-memory indices, configured-size disk files, heading classification, date ranges & bucket queries', async () => {
 const nowMs = Date.parse('2026-11-26T17:09:19.000Z')
 const tz = 'America/New_York'

 // 1. Heading classification in America/New_York (EST = UTC-5 in Nov)
 assert.equal(classifyStoryHeading(Date.parse('2026-11-26T17:09:19.000Z'), { now: nowMs, timeZone: tz }).label, 'Today')
 assert.equal(classifyStoryHeading(Date.parse('2026-11-26T05:30:00.000Z'), { now: nowMs, timeZone: tz }).label, 'Today')
 assert.equal(classifyStoryHeading(Date.parse('2026-11-26T04:30:00.000Z'), { now: nowMs, timeZone: tz }).label, 'Yesterday')
 assert.equal(classifyStoryHeading(Date.parse('2026-11-25T15:00:00.000Z'), { now: nowMs, timeZone: tz }).label, 'Yesterday')
 assert.equal(classifyStoryHeading(Date.parse('2026-11-03T18:00:00.000Z'), { now: nowMs, timeZone: tz }).label, 'November 3rd')
 assert.equal(classifyStoryHeading(Date.parse('2026-10-12T18:00:00.000Z'), { now: nowMs, timeZone: tz }).label, 'October 12th')
 assert.equal(classifyStoryHeading(Date.parse('2026-02-01T18:00:00.000Z'), { now: nowMs, timeZone: tz }).label, 'February 1st')
 assert.equal(classifyStoryHeading(Date.parse('2026-05-22T18:00:00.000Z'), { now: nowMs, timeZone: tz }).label, 'May 22nd')
 const lastYearH = classifyStoryHeading(Date.parse('2025-07-14T12:00:00.000Z'), { now: nowMs, timeZone: tz })
 assert.equal(lastYearH.kind, 'last-year')
 assert.equal(lastYearH.label, 'Last year')
 const arch2024 = classifyStoryHeading(Date.parse('2024-08-20T12:00:00.000Z'), { now: nowMs, timeZone: tz })
 assert.equal(arch2024.kind, 'archives')
 assert.equal(arch2024.label, 'Archives')
 assert.equal(arch2024.year, 2024)
 const arch2023 = classifyStoryHeading(Date.parse('2023-03-05T12:00:00.000Z'), { now: nowMs, timeZone: tz })
 assert.equal(arch2023.kind, 'archives')
 assert.equal(arch2023.label, 'Archives')
 assert.equal(arch2023.year, 2023)

 // 2. Real diskKV layout under os.tmpdir() enforcing the configured chunk bytes per file
 const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cc-story-disk-'))
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

 // Story snapshots cap individual values, so exercise chunking with a small
 // writer limit and restore the normal default afterwards.
 const originalChunkBytes = getKvChunkBytes()
 setKvChunkBytes(2048)
 try {
  const diskKv = createDiskKV(tempDir)
  const laneId = 'lane.story.1'
  const laneData = diskKv.namespace(laneId)

  // Compact inline runs across Today, Yesterday, Nov 3rd, Oct 12th, Last year, Archives (2024 & 2023)
  const compactTimestamps = [
   { ts: Date.parse('2026-11-26T16:30:00.000Z'), label: 'today-1' },
   { ts: Date.parse('2026-11-26T14:00:00.000Z'), label: 'today-2' },
   { ts: Date.parse('2026-11-25T16:00:00.000Z'), label: 'yesterday-1' },
   { ts: Date.parse('2026-11-03T18:00:00.000Z'), label: 'nov3-1' },
   { ts: Date.parse('2026-10-12T18:00:00.000Z'), label: 'oct12-1' },
   { ts: Date.parse('2025-07-14T12:00:00.000Z'), label: 'y2025-1' },
   { ts: Date.parse('2024-08-20T12:00:00.000Z'), label: 'y2024-1' },
   { ts: Date.parse('2023-03-05T12:00:00.000Z'), label: 'y2023-1' },
  ]
  const appendedIds = []
  for (const item of compactTimestamps) {
   const rec = await appendLaneStory(diskKv, laneData, laneId, {
    ts: item.ts,
    trigger: 'manual',
    outcome: {
     results: [{ index: 0, lineNumber: 1, source: `; to tag '${item.label}'`, preview: JSON.stringify(item.label), value: item.label }],
     sent: [],
     state: { tag: item.label },
    },
    lineRecords: [{ id: 'ln-1', text: `; to tag '${item.label}'` }],
   })
   assert.ok(rec.inl, `Compact run ${item.label} should be stored inline`)
   assert.equal(parseStoryRunIdTimestamp(rec.id), item.ts)
   appendedIds.push(rec)
  }

  // Large multi-kilobyte run in Today (30 lines + large import/export JSON payloads) -> forces split io/out + chunking
  const bigLines = Array.from({ length: 30 }, (_, i) => ({
   index: i,
   lineNumber: i + 1,
   source: `; to v_${i} '${'payload_'.repeat(15)}${i}'`,
   preview: JSON.stringify(`${'payload_'.repeat(15)}${i}`),
   value: `${'payload_'.repeat(15)}${i}`,
  }))
  const largeRun = await appendLaneStory(diskKv, laneData, laneId, {
   ts: Date.parse('2026-11-26T17:00:00.000Z'),
   trigger: 'cron',
   capturedInputs: {
    inputs: [{ name: 'envMode', type: 'string', secret: false, secretSet: false, preview: '"prod"', json: '"prod"' }],
    secretValues: [],
   },
   imports: [{
    alias: 'catalog',
    laneId: 'upstream-lane',
    laneTitle: 'Upstream',
    path: ['items'],
    ok: true,
    value: Array.from({ length: 40 }, (_, i) => ({ id: i, title: `Item_${i}_${'z'.repeat(30)}` })),
   }],
   exports: [{
    kind: 'line',
    contentExpr: '; add "; to big " $payload',
    content: `; to big ${'E'.repeat(1800)}`,
    targets: [{ laneId: 'downstream-lane', laneTitle: 'Downstream', lineId: 'dl-1', lineNumber: 1, changed: true, ok: true }],
    changedCount: 1,
    ok: true,
   }],
   outcome: {
    results: bigLines,
    sent: [],
    state: { done: true },
   },
   lineRecords: bigLines.map((l, i) => ({ id: `big-ln-${i + 1}`, text: l.source })),
  })
  assert.equal(largeRun.inl, undefined, 'Large multi-KB run must omit inline detail from card')
  assert.equal(largeRun.hasDetail, true)
  assert.equal(largeRun.lnCnt, 30)

  // Verify every single file on disk under tempDir
  const diskFiles = []
  async function walk(dir) {
   const entries = await fs.readdir(dir, { withFileTypes: true })
   for (const ent of entries) {
    const full = path.join(dir, ent.name)
    if (ent.isDirectory()) {
     await walk(full)
    }
    else {
     const raw = await fs.readFile(full, 'utf8')
     diskFiles.push({ rel: path.relative(tempDir, full), bytes: Buffer.byteLength(raw, 'utf8'), raw })
    }
   }
  }
  await walk(tempDir)

  assert.ok(diskFiles.length > 15)
  const expectedNs = encodeURIComponent(STORY_NAMESPACE)
  const expectedLaneSeg = encodeURIComponent(encodeKeySegment(laneId))
  for (const f of diskFiles) {
   assert.ok(
    f.rel.startsWith(`${expectedNs}/${expectedLaneSeg}/`),
    `Unexpected disk path outside stories/<laneId>/: ${f.rel}`
   )
   assert.ok(
    f.bytes <= MAX_KV_VALUE_BYTES,
    `File ${f.rel} exceeded ${MAX_KV_VALUE_BYTES} bytes (${f.bytes})`
   )
  }
  assert.ok(diskFiles.some(f => f.rel.endsWith('/idx/root')))
  assert.ok(diskFiles.some(f => f.rel.includes('/idx/y/')))
  assert.ok(diskFiles.some(f => f.rel.includes('/idx/m/')))
  assert.ok(diskFiles.some(f => f.rel.includes('/idx/d/')))
  assert.ok(diskFiles.some(f => f.rel.includes('/r/')))
  assert.ok(diskFiles.some(f => f.rel.endsWith('/io') || f.rel.includes('/io.chunks/')))
  assert.ok(diskFiles.some(f => f.rel.endsWith('/out') || f.rel.includes('/out.chunks/')))
  assert.ok(diskFiles.some(f => f.rel.includes('.chunks/')))

  // Verify loadLaneStoryBuckets order & counts
  const bucketRes = await loadLaneStoryBuckets(diskKv, laneData, laneId, { now: nowMs, timeZone: tz })
  assert.equal(bucketRes.total, 9)
  assert.deepEqual(
   bucketRes.buckets.map(b => ({ label: b.label, kind: b.kind, count: b.count })),
   [
    { label: 'Today', kind: 'today', count: 3 },
    { label: 'Yesterday', kind: 'yesterday', count: 1 },
    { label: 'November 3rd', kind: 'day', count: 1 },
    { label: 'October 12th', kind: 'day', count: 1 },
    { label: 'Last year', kind: 'last-year', count: 1 },
    { label: 'Archives', kind: 'archives', count: 2 },
   ]
  )
  const archBucket = bucketRes.buckets.find(b => b.kind === 'archives')
  assert.deepEqual(
   archBucket.subBuckets.map(sb => ({ label: sb.label, year: sb.year, count: sb.count })),
   [
    { label: '2024', year: 2024, count: 1 },
    { label: '2023', year: 2023, count: 1 },
   ]
  )

  // Verify cursor pagination (limit: 3) walks all 9 entries in strict newest-first order
  const collected = []
  let cursor = null
  let pages = 0
  while (true) {
   const page = await queryLaneStories(diskKv, laneData, laneId, {
    limit: 3,
    beforeTs: cursor?.beforeTs ?? null,
    beforeId: cursor?.beforeId ?? null,
   })
   pages += 1
   collected.push(...page.entries)
   if (!page.hasMore) {
    assert.equal(page.nextCursor, null)
    break
   }
   assert.ok(page.nextCursor)
   cursor = page.nextCursor
  }
  assert.equal(pages, 3)
  assert.equal(collected.length, 9)
  for (let i = 1; i < collected.length; i++) {
   assert.ok(collected[i - 1].ts >= collected[i].ts)
  }
  assert.equal(collected[0].id, largeRun.id)

  // Verify arbitrary [startTs, endTs] range queries
  const novOnly = await queryLaneStories(diskKv, laneData, laneId, {
   startTs: Date.parse('2026-11-01T00:00:00.000Z'),
   endTs: Date.parse('2026-11-30T23:59:59.999Z'),
  })
  assert.equal(novOnly.entries.length, 5)
  assert.ok(novOnly.entries.every(e => e.day.startsWith('2026-11-')))

  const only2024 = await queryLaneStories(diskKv, laneData, laneId, {
   startTs: Date.parse('2024-01-01T00:00:00.000Z'),
   endTs: Date.parse('2024-12-31T23:59:59.999Z'),
  })
  assert.equal(only2024.entries.length, 1)
  assert.equal(only2024.entries[0].day, '2024-08-20')

  // Verify loadLaneStoryDetail on both inline and split runs
  const inlineCard = collected.find(e => e.id === appendedIds[0].id)
  const inlineDetail = await loadLaneStoryDetail(diskKv, laneData, laneId, inlineCard)
  assert.equal(inlineDetail.lines.length, 1)
  assert.equal(inlineDetail.finalValue.preview, '"today-1"')

  const splitCard = collected.find(e => e.id === largeRun.id)
  assert.equal(splitCard.inl, undefined)
  const splitDetail = await loadLaneStoryDetail(diskKv, laneData, laneId, splitCard)
  assert.equal(splitDetail.inputs.length, 1)
  assert.equal(splitDetail.inputs[0].name, 'envMode')
  assert.equal(splitDetail.imports.length, 1)
  assert.equal(splitDetail.imports[0].alias, 'catalog')
  assert.equal(splitDetail.exports.length, 1)
  assert.equal(splitDetail.lines.length, 30)
  assert.ok(splitDetail.exports[0].content.includes('E'.repeat(50)))
 }
 finally {
  setKvChunkBytes(originalChunkBytes)
  await fs.rm(tempDir, { recursive: true, force: true })
 }
})

test('Story tab UI placement, Story-only visibility, input/final/import/export/output snapshots, secret redaction & background 30m cron runs', async () => {
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
   innerHTML: '',
   value: '',
   placeholder: '',
   title: '',
   className: '',
   hidden: false,
   disabled: false,
   checked: false,
   scrollHeight: 0,
   scrollTop: 0,
   clientHeight: 0,
   setAttribute(k, v) { this.attributes[k] = String(v) },
   getAttribute(k) { return this.attributes[k] ?? null },
   removeAttribute(k) { delete this.attributes[k] },
   appendChild(c) {
    if (c && typeof c === 'object') {
     c.parentNode = this
     this.children.push(c)
    }
    return c
   },
   insertBefore(c, ref) {
    if (c && typeof c === 'object') c.parentNode = this
    const idx = this.children.indexOf(ref)
    if (idx === -1) this.children.push(c)
    else this.children.splice(idx, 0, c)
    return c
   },
   replaceChildren(...nodes) {
    this.children = []
    for (const n of nodes) this.appendChild(n)
   },
   addEventListener(ev, handler) { this.listeners[ev] = handler },
   focus() { this.focused = true },
   select() {},
   remove() { this.removed = true },
  }
 }

 function collectText(node) {
  if (!node || typeof node !== 'object') return ''
  let out = node.textContent ? String(node.textContent) : ''
  if (Array.isArray(node.children)) {
   for (const ch of node.children) {
    out += collectText(ch)
   }
  }
  return out
 }

 const kvStore = new Map()
 function makeKv(prefix = '', rootRef = null) {
  const q = k => (prefix ? `${prefix}/${k}` : k)
  const client = {
   get root() { return rootRef || client },
   get defaultRoot() { return rootRef || client },
   withBasePath() { return client.root },
   namespace(name) { return makeKv(q(name), client.root) },
   hashNamespace(name) { return makeKv(q(name), client.root) },
   async get(k) { return kvStore.has(q(k)) ? kvStore.get(q(k)) : null },
   async set(k, v) { kvStore.set(q(k), String(v)) },
   async delete(k) { kvStore.delete(q(k)) },
  }
  return client
 }
 const rootKv = makeKv()

 let uuid = 0
 const localStore = new Map()
 const sessionStore = new Map()
 const mockWindow = {
  Array,
  Boolean,
  Date,
  Intl,
  JSON,
  Math,
  Number,
  Object,
  Reflect,
  String,
  decodeURIComponent,
  encodeURIComponent,
  crypto: { randomUUID: () => `story-ui-uuid-${++uuid}` },
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

 const secretToken = 'sk-ultra-secret-token-777'
 try {
  const f = field({
   ...DATA_RUNTIME_ENV,
   console: { log() {} },
   createIdleTracker,
   crypto: mockWindow.crypto,
   data: rootKv,
   defaultValueForType,
   document: mockDocument,
   formatImportLine,
   hasImportCycle,
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
  await lc['confirm-session-data-dir']('.civil-story-ui-test')

  // Create Upstream, Downstream, and Worker lanes
  const upstream = await lc.add()
  await lc.rename(upstream.id, 'Upstream')
  upstream.notebook.rows[0]['input-el'].value = '; to rate 42'
  await upstream.notebook.rows[0]['input-el'].listeners.input()

  const downstream = await lc.add()
  await lc.rename(downstream.id, 'Downstream')
  downstream.notebook.rows[0]['input-el'].value = "; to msg 'init'"
  await downstream.notebook.rows[0]['input-el'].listeners.input()

  const worker = await lc.add()
  await lc.rename(worker.id, 'Worker')
  const nb = worker.notebook

  // Verify Story tab button is tabs-el.children[0] right before Source, default active tab is source
  assert.equal(nb['tabs-el'].children[0], nb.tabs.story)
  assert.equal(nb['tabs-el'].children[1], nb.tabs.source)
  assert.equal(nb.tabs.story.textContent, 'Story')
  assert.equal(nb['active-tab'], 'source')
  assert.equal(nb['story-panel'].hidden, true)

  // Configure inputs on Worker: `base` (number) and `apiKey` (secret)
  await nb.tabs.input.listeners.click()
  const inputsView = nb['inputs-view']
  await inputsView['add-btn'].listeners.click()
  inputsView.rows[0]['name-el'].value = 'base'
  await inputsView.rows[0]['name-el'].listeners.input()
  inputsView.rows[0]['type-el'].value = 'number'
  await inputsView.rows[0]['type-el'].listeners.change()

  await inputsView['add-btn'].listeners.click()
  inputsView.rows[1]['name-el'].value = 'apiKey'
  await inputsView.rows[1]['name-el'].listeners.input()
  inputsView.rows[1]['type-el'].value = 'secret'
  await inputsView.rows[1]['type-el'].listeners.change()
  inputsView.rows[1]['secret-input-el'].value = secretToken
  await inputsView.rows[1]['commit-secret']()

  // Switch back to Source, add + Import of `rate` from Upstream, Source lines, send packet, and + Export to Downstream L1
  await nb.tabs.source.listeners.click()
  await nb['insert-import'](0, { alias: 'rate', laneId: upstream.id, path: ['rate'] })
  nb.rows[1]['input-el'].value = '; to keyLen $apiKey.length'
  await nb.rows[1]['input-el'].listeners.input()
  await nb['add-line']("; to combined ; object { total [ ; add $base $rate ] } { keyLen $keyLen } { masked $apiKey }")
  await nb['add-line']("; send ( ; to el !document.createElement div , ; set 'Widget Ready' el.textContent , $el )")

  // Add + Export to Downstream line 1
  await nb['add-export-btn'].listeners.click()
  const expModal = lc['export-modal']
  await expModal['select-lane'](downstream.id)
  await expModal['line-els'][0]['toggle-btn'].listeners.click()
  expModal['expr-input'].value = '; add \'; to msg "\' ; add [ ; add $base $rate ] \'"\''
  await expModal.form.listeners.submit({ preventDefault() {} })
  await new Promise(r => setTimeout(r, 20))

  assert.equal(downstream.notebook.lines[0], '; to msg "42"')

  // Enable server feature so Server tab is also tested for Story-only visibility
  await nb['set-features']({ httpServer: true, runEvery30Minutes: false })
  for (const tabName of ['source', 'input', 'scope', 'data', 'view', 'server']) {
   await nb.tabs[tabName].listeners.click()
   assert.equal(nb['story-panel'].hidden, true, `Story panel must be hidden on ${tabName} tab`)
  }
  assert.equal(nb['output-view'].suppressed, false)
  assert.equal(nb['output-view'].element.hidden, false)

  // Switch to Story tab -> Story panel visible, inline output suppressed & hidden
  await nb.tabs.story.listeners.click()
  assert.equal(nb['active-tab'], 'story')
  assert.equal(nb['story-panel'].hidden, false)
  assert.equal(nb['output-view'].suppressed, true)
  assert.equal(nb['output-view'].element.hidden, true)

  const sv = nb['story-view']
  assert.ok(sv['entry-els'].length >= 1)

  // Expand latest entry card and verify all 5 sections + secret redaction
  const latestCard = sv['entry-els'][0]
  const latestHeader = latestCard.children[0]
  const latestDetail = latestCard.children[1]
  assert.equal(latestDetail.hidden, true)
  await latestHeader.listeners.click()
  assert.equal(latestDetail.hidden, false)

  const detailText = collectText(latestDetail)
  assert.match(detailText, /Inputs/)
  assert.match(detailText, /base \(number\) = 0/)
  assert.match(detailText, /apiKey \(secret\) = ••••••••/)
  assert.match(detailText, /Imported from lanes/)
  assert.match(detailText, /rate ←/)
  assert.match(detailText, /Upstream/)
  assert.match(detailText, /42/)
  assert.match(detailText, /Exported to lanes/)
  assert.match(detailText, /Downstream/)
  assert.match(detailText, /Final Value/)
  assert.match(detailText, /Source Run Output/)
  assert.match(detailText, /Sent to View \(1\)/)
  assert.match(detailText, /L1/)
  assert.match(detailText, /; send \(/)

  // Secret plaintext must NEVER appear anywhere in KV or Story DOM text
  const allStoryText = collectText(sv.element)
  assert.equal(allStoryText.includes(secretToken), false)
  for (const [, v] of kvStore.entries()) {
   assert.equal(String(v).includes(secretToken), false)
  }

  // Enable runEvery30Minutes on Worker while keeping Worker on Story tab, then run cron
  const prevCount = sv.entries.length
  await lc.configure(worker.id)
  lc['config-modal']['cron-30m-check'].checked = true
  await lc['config-modal'].form.listeners.submit({ preventDefault() {} })
  assert.equal(worker.features.runEvery30Minutes, true)
  assert.equal(nb['active-tab'], 'story')

  // Update Upstream rate so cron evaluation applies a fresh export to Downstream
  upstream.notebook.rows[0]['input-el'].value = '; to rate 100'
  await upstream.notebook.rows[0]['input-el'].listeners.input()

  const cronRes = await lc['run-lane-cron'](worker.id)
  assert.equal(cronRes.ok, true)
  assert.equal(downstream.notebook.lines[0], '; to msg "100"')

  // Live Story tab updated with a new 'Cron' entry!
  assert.equal(sv.entries.length, prevCount + 1)
  assert.equal(sv.entries[0].trig, 'cron')
  assert.match(collectText(sv['entry-els'][0]), /Cron/)

  // agentEvalLane also records an 'agent' Story entry
  const beforeAgentCount = sv.entries.length
  const agentRes = await agentEvalLane(rootKv, { laneId: worker.id })
  assert.equal(agentRes.ok, true)
  await sv.reload()
  assert.equal(sv.entries.length, beforeAgentCount + 1)
  assert.equal(sv.entries[0].trig, 'agent')
  assert.match(collectText(sv['entry-els'][0]), /Agent/)
 }
 finally {
  globalThis.fetch = origFetch
 }
})

test('Story infinite scroller, cross-page heading deduplication & Jump to... bucket/date-range navigation', async () => {
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
   innerHTML: '',
   value: '',
   placeholder: '',
   title: '',
   className: '',
   hidden: false,
   disabled: false,
   checked: false,
   scrollHeight: 0,
   scrollTop: 0,
   clientHeight: 0,
   setAttribute(k, v) { this.attributes[k] = String(v) },
   getAttribute(k) { return this.attributes[k] ?? null },
   removeAttribute(k) { delete this.attributes[k] },
   appendChild(c) {
    if (c && typeof c === 'object') {
     c.parentNode = this
     this.children.push(c)
    }
    return c
   },
   insertBefore(c, ref) {
    if (c && typeof c === 'object') c.parentNode = this
    const idx = this.children.indexOf(ref)
    if (idx === -1) this.children.push(c)
    else this.children.splice(idx, 0, c)
    return c
   },
   replaceChildren(...nodes) {
    this.children = []
    for (const n of nodes) this.appendChild(n)
   },
   addEventListener(ev, handler) { this.listeners[ev] = handler },
   focus() { this.focused = true },
   select() {},
   remove() { this.removed = true },
  }
 }

 const kvStore = new Map()
 function makeKv(prefix = '', rootRef = null) {
  const q = k => (prefix ? `${prefix}/${k}` : k)
  const client = {
   get root() { return rootRef || client },
   get defaultRoot() { return rootRef || client },
   withBasePath() { return client.root },
   namespace(name) { return makeKv(q(name), client.root) },
   hashNamespace(name) { return makeKv(q(name), client.root) },
   async get(k) { return kvStore.has(q(k)) ? kvStore.get(q(k)) : null },
   async set(k, v) { kvStore.set(q(k), String(v)) },
   async delete(k) { kvStore.delete(q(k)) },
  }
  return client
 }
 const rootKv = makeKv()

 let uuid = 0
 const localStore = new Map()
 const sessionStore = new Map()
 const mockWindow = {
  Array,
  Boolean,
  Date,
  Intl,
  JSON,
  Math,
  Number,
  Object,
  Reflect,
  String,
  decodeURIComponent,
  encodeURIComponent,
  crypto: { randomUUID: () => `timeline-uuid-${++uuid}` },
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
   data: rootKv,
   defaultValueForType,
   document: mockDocument,
   formatImportLine,
   hasImportCycle,
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
  await lc['confirm-session-data-dir']('.civil-story-timeline-test')
  lc['clock-timezone'] = 'UTC'

  const timeline = await lc.add()
  await lc.rename(timeline.id, 'Timeline')

  const fixedNow = Date.parse('2026-11-26T17:09:19.000Z')
  const sv = timeline.notebook['story-view']
  sv['now-fn'] = () => fixedNow

  // Seed 32 runs: Today (3), Yesterday (4), November 3rd (8), Last year (10 in 2025), Archives (7 in 2024 & 2023)
  const seedTimestamps = [
   // Today (3)
   Date.parse('2026-11-26T16:30:00.000Z'),
   Date.parse('2026-11-26T14:00:00.000Z'),
   Date.parse('2026-11-26T10:00:00.000Z'),
   // Yesterday (4)
   Date.parse('2026-11-25T20:00:00.000Z'),
   Date.parse('2026-11-25T16:00:00.000Z'),
   Date.parse('2026-11-25T12:00:00.000Z'),
   Date.parse('2026-11-25T08:00:00.000Z'),
   // November 3rd (8)
   ...Array.from({ length: 8 }, (_, i) => Date.parse('2026-11-03T18:00:00.000Z') - i * 600000),
   // Last year (10 in mid-2025 so local-TZ date inputs 2025-01-01..2025-12-31 match cleanly)
   ...Array.from({ length: 10 }, (_, i) => Date.parse('2025-08-15T12:00:00.000Z') - i * 86400000),
   // Archives (4 in 2024 + 3 in 2023 = 7)
   ...Array.from({ length: 4 }, (_, i) => Date.parse('2024-09-10T12:00:00.000Z') - i * 86400000),
   ...Array.from({ length: 3 }, (_, i) => Date.parse('2023-06-05T12:00:00.000Z') - i * 86400000),
  ]
  assert.equal(seedTimestamps.length, 32)

  for (let i = 0; i < seedTimestamps.length; i++) {
   await appendLaneStory(rootKv, timeline.data, timeline.id, {
    ts: seedTimestamps[i],
    trigger: 'manual',
    outcome: {
     results: [{ index: 0, lineNumber: 1, source: `; to step ${i + 1}`, preview: String(i + 1), value: i + 1 }],
     sent: [],
     state: { step: i + 1 },
    },
    lineRecords: [{ id: 's-1', text: `; to step ${i + 1}` }],
   })
  }
  sv['needs-refresh'] = true

  // Switch Timeline to Story tab -> initial page loads DEFAULT_STORY_PAGE_SIZE (20)
  await timeline.notebook.tabs.story.listeners.click()
  assert.equal(sv.entries.length, DEFAULT_STORY_PAGE_SIZE)
  assert.equal(sv['has-more'], true)
  assert.equal(sv['footer-el'].hidden, false)

  const page1Headings = sv['entries-el'].children
   .filter(el => el.className === 'lane-story-heading')
   .map(el => el.textContent)
  assert.deepEqual(page1Headings, ['Today', 'Yesterday', 'November 3rd', 'Last year'])

  // Simulate scrolling near bottom -> loads page 2 (remaining 12 -> 32 total) without duplicating Last year heading
  sv['scroller-el'].scrollHeight = 1200
  sv['scroller-el'].clientHeight = 500
  sv['scroller-el'].scrollTop = 620
  await sv['scroller-el'].listeners.scroll()

  assert.equal(sv.entries.length, 32)
  assert.equal(sv['has-more'], false)
  assert.equal(sv['footer-el'].hidden, true)

  const allHeadings = sv['entries-el'].children
   .filter(el => el.className === 'lane-story-heading')
   .map(el => el.textContent)
  assert.deepEqual(allHeadings, ['Today', 'Yesterday', 'November 3rd', 'Last year', 'Archives'])
  assert.equal(allHeadings.filter(h => h === 'Last year').length, 1)

  // Open Jump to... popover -> verify bucket buttons and counts
  await sv['jump-btn'].listeners.click()
  assert.equal(sv['jump-panel'].hidden, false)
  const bucketLabelsAndCounts = sv['bucket-els'].map(btn => ({
   label: btn.children[0].textContent,
   count: btn.children[1].textContent,
  }))
  assert.deepEqual(bucketLabelsAndCounts, [
   { label: 'Today', count: '3' },
   { label: 'Yesterday', count: '4' },
   { label: 'November 3rd', count: '8' },
   { label: 'Last year', count: '10' },
   { label: 'Archives', count: '7' },
   { label: '2024', count: '4' },
   { label: '2023', count: '3' },
  ])

  // Click November 3rd bucket -> closes jump panel, shows latest-btn, starts directly at November 3rd (and includes older below)
  const nov3Btn = sv['bucket-els'].find(b => b.children[0].textContent === 'November 3rd')
  await nov3Btn.listeners.click()
  assert.equal(sv['jump-panel'].hidden, true)
  assert.equal(sv['latest-btn'].hidden, false)
  assert.match(sv['status-el'].textContent, /November 3rd/)
  const jumpedNovHeadings = sv['entries-el'].children
   .filter(el => el.className === 'lane-story-heading')
   .map(el => el.textContent)
  assert.equal(jumpedNovHeadings[0], 'November 3rd')
  assert.ok(jumpedNovHeadings.includes('Last year'))

  // Jump to Archives
  await sv['jump-btn'].listeners.click()
  const archBtn = sv['bucket-els'].find(b => b.children[0].textContent === 'Archives')
  await archBtn.listeners.click()
  assert.match(sv['status-el'].textContent, /Archives/)
  const jumpedArchHeadings = sv['entries-el'].children
   .filter(el => el.className === 'lane-story-heading')
   .map(el => el.textContent)
  assert.deepEqual(jumpedArchHeadings, ['Archives'])
  assert.equal(sv.entries.length, 7)

  // Date range filter: 2025-01-01 .. 2025-12-31
  await sv['jump-btn'].listeners.click()
  sv['range-from-input'].value = '2025-01-01'
  sv['range-to-input'].value = '2025-12-31'
  await sv['range-go-btn'].listeners.click()
  assert.equal(sv['jump-panel'].hidden, true)
  assert.equal(sv['latest-btn'].hidden, false)
  assert.match(sv['status-el'].textContent, /Range: 2025-01-01 – 2025-12-31/)
  assert.equal(sv.entries.length, 10)
  assert.deepEqual(
   sv['entries-el'].children.filter(el => el.className === 'lane-story-heading').map(el => el.textContent),
   ['Last year']
  )

  // Click ↑ Latest -> resets to Today
  await sv['latest-btn'].listeners.click()
  assert.equal(sv['latest-btn'].hidden, true)
  const resetHeadings = sv['entries-el'].children
   .filter(el => el.className === 'lane-story-heading')
   .map(el => el.textContent)
  assert.equal(resetHeadings[0], 'Today')
  assert.equal(sv.entries.length, DEFAULT_STORY_PAGE_SIZE)
 }
 finally {
  globalThis.fetch = origFetch
 }
})
