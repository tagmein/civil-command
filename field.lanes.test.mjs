import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import http from 'node:http'
import path from 'node:path'
import {
 DATA_RUNTIME_ENV,
 DEFAULT_LANE_TAB,
 LANE_SOURCE_DRAFTS_STORAGE_PREFIX,
 LANE_TABS,
 MIN_LANE_WIDTH,
 PRIMITIVE_TYPES,
 agentCreateLane,
 agentGetLane,
 agentMutateLaneScript,
 clearAllLaneSourceDrafts,
 clearTargetLaneLineSetBy,
 collectLaneSyncBundle,
 computeLaneModalTopOffset,
 computeLaneScrollLeft,
 computeLaneScrollTop,
 createIdleTracker,
 createSourceWorkerRunner,
 defaultValueForType,
 deleteLaneDeployment,
 deployedScriptKey,
 deploymentKey,
 diffLaneScripts,
 dirModalSource,
 encodeKeySegment,
 exportDeployModalSource,
 exportModalSource,
 field,
 formatExportLine,
 formatHashOptions,
 formatImportLine,
 formatLanePath,
 formatLaneRouteSegment,
 formatLaneRoutes,
 getLaneDeployStatus,
 handleMcpJsonRpc,
 hasImportCycle,
 isParseableFieldScriptLine,
 laneServerSource,
 laneServersModalSource,
 laneSourceDraftsStorageKey,
 laneStorySource,
 laneTerminalModalSource,
 lineInfoModalSource,
 listLaneSourceDrafts,
 listScopeEntries,
 loadDeployedLaneScript,
 loadLaneScript,
 loadLaneSourceDrafts,
 normalizeLanePath,
 normalizeLaneTab,
 normalizeLaneWidth,
 normalizePrimitiveType,
 packageModalSource,
 parse,
 parseExportLine,
 parseHashOptions,
 parseImportLine,
 parseLanePath,
 parseLaneRouteSegment,
 parseLaneRoutes,
 resolveImportValue,
 resolveLaneRenderedWidth,
 resolveScopeColumns,
 resolveScopePath,
 runLines,
 runTransportedScripts,
 saveDeployServer,
 saveDeployedLaneScript,
 saveLaneDeployment,
 saveLaneScript,
 saveLaneSourceDraft,
 saveScriptLine,
 saveScriptLinesAndIndex,
 scriptLineKey,
 sessionModalSource,
 setTargetLaneLine,
 writeLaneSyncBundleToKv,
} from './field.fixtures.mjs'

test('lane-control.fs mounts, opens concurrently, adds, and syncs lanes', async () => {
 const source = await fs.readFile(new URL('./src/lane-control.fs', import.meta.url), 'utf8')
 const notebookSource = await fs.readFile(new URL('./src/lane-notebook.fs', import.meta.url), 'utf8')
 const inputsSource = await fs.readFile(new URL('./src/lane-inputs.fs', import.meta.url), 'utf8')
 const scopeSource = await fs.readFile(new URL('./src/lane-scope.fs', import.meta.url), 'utf8')
 const dataSource = await fs.readFile(new URL('./src/lane-data.fs', import.meta.url), 'utf8')
 const confirmModalSource = await fs.readFile(new URL('./src/confirm-modal.fs', import.meta.url), 'utf8')
 const rowPickerModalSource = await fs.readFile(new URL('./src/lane-row-picker-modal.fs', import.meta.url), 'utf8')
 const outputSource = await fs.readFile(new URL('./src/lane-output.fs', import.meta.url), 'utf8')
 const configModalSource = await fs.readFile(new URL('./src/lane-config-modal.fs', import.meta.url), 'utf8')
 const importModalSource = await fs.readFile(new URL('./src/lane-import-modal.fs', import.meta.url), 'utf8')
 const modalSource = await fs.readFile(new URL('./src/lane-modal.fs', import.meta.url), 'utf8')
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
   removed: false,
   setAttribute(name, value) {
    this.attributes[name] = value
   },
   appendChild(child) {
    this.children.push(child)
    return child
   },
   insertBefore(child, ref) {
    const idx = this.children.indexOf(ref)
    if (idx === -1) { this.children.push(child) }
    else { this.children.splice(idx, 0, child) }
    return child
   },
   addEventListener(event, handler) {
    this.listeners[event] = handler
   },
   focus() {},
   remove() {
    this.removed = true
   },
  }
 }

 const kvStore = new Map()
 function createMockKV(prefix = '') {
  const qualify = key => (prefix ? `${prefix}.${key}` : key)
  return {
   prefix,
   namespace(name) {
    return createMockKV(qualify(name))
   },
   async get(key) {
    const k = qualify(key)
    await Promise.resolve()
    return kvStore.has(k) ? kvStore.get(k) : null
   },
   async set(key, value) {
    kvStore.set(qualify(key), value)
   },
  }
 }

 const pushedUrls = []
 const listeners = {}
 let uuidCounter = 0

 const mockLocation = { pathname: '/' }
 const mockHistory = {
  pushState(_state, _title, url) {
   pushedUrls.push(url)
   mockLocation.pathname = url
  },
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
  addEventListener(event, handler) {
   listeners[event] = handler
  },
 }
 const mockDocument = {
  createElement: createMockElement,
 }
 const mockCrypto = {
  randomUUID() {
   uuidCounter += 1
   return `uuid-${uuidCounter}`
  },
 }
 const mockConsole = { log() {} }
 const mockData = createMockKV()

 const origFetch = globalThis.fetch
 globalThis.fetch = async url => {
  if (url === '/src/lane-notebook.fs') {
   return { text: async () => notebookSource }
  }
  if (url === '/src/lane-inputs.fs') {
   return { text: async () => inputsSource }
  }
  if (url === '/src/lane-scope.fs') {
   return { text: async () => scopeSource }
  }
  if (url === '/src/lane-data.fs') {
   return { text: async () => dataSource }
  }
  if (url === '/src/confirm-modal.fs') {
   return { text: async () => confirmModalSource }
  }
  if (url === '/src/lane-row-picker-modal.fs') {
   return { text: async () => rowPickerModalSource }
  }
  if (url === '/src/lane-output.fs') {
   return { text: async () => outputSource }
  }
  if (url === '/src/lane-config-modal.fs') {
   return { text: async () => configModalSource }
  }
  if (url === '/src/lane-import-modal.fs') {
   return { text: async () => importModalSource }
  }
  if (url === '/src/lane-modal.fs') {
   return { text: async () => modalSource }
  }
  if (url === '/src/lane-rails.fs') {
   return { text: async () => railsSource }
  }
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
   console: mockConsole,
   createIdleTracker,
   crypto: mockCrypto,
   data: mockData,
   defaultValueForType,
   document: mockDocument,
   formatImportLine,
   hasImportCycle,
   history: mockHistory,
   location: mockLocation,
   normalizePrimitiveType,
   parseImportLine,
   ...DATA_RUNTIME_ENV,
   primitiveTypes: PRIMITIVE_TYPES,
   resolveImportValue,
   resolveScopeColumns,
   runLines,
   runTransportedScripts,
   window: mockWindow,
  })

  const laneControl = await f.run(parse(source, '/src/lane-control.fs'))

  laneControl['create-lane'] = async () => createMockElement('th')

  // Test mount directly
  const directData = mockData.namespace('direct-id')
  const mountedLane = await laneControl.mount('direct-id', 'Direct Title', directData)
  assert.equal(mountedLane.id, 'direct-id')
  assert.equal(mountedLane.title, 'Direct Title')
  assert.equal(mountedLane.data, directData)
  assert.equal(mountedLane.number, 1)
  assert.equal(mountedLane.element.attributes['data-lane-id'], 'direct-id')
  const headerTop = mountedLane.element.children[0]
  assert.equal(headerTop.children[0], mountedLane['config-btn'])
  assert.equal(mountedLane['config-btn'].className, 'lane-control-btn lane-config-btn')
  assert.match(mountedLane['config-btn'].innerHTML, /<svg\b[^>]*class="lane-config-icon"/)
  const metaEl = headerTop.children[1]
  assert.equal(metaEl.children[0].textContent, 'Direct Title')
  assert.equal(metaEl.children[1].textContent, 'direct-id')
  assert.equal(headerTop.children[2], mountedLane['copy-info-btn'])
  assert.equal(mountedLane['copy-info-btn'].className, 'lane-copy-btn')
  assert.match(mountedLane['copy-info-btn'].innerHTML, /<svg\b[^>]*class="lane-copy-icon"/)
  assert.equal(headerTop.children[3], mountedLane['min-left-btn'])
  assert.equal(mountedLane['min-left-btn'].className, 'lane-min-btn lane-min-btn--left')
  assert.equal(headerTop.children[4], mountedLane['min-right-btn'])
  assert.equal(mountedLane['min-right-btn'].className, 'lane-min-btn lane-min-btn--right')
  assert.equal(headerTop.children[5], mountedLane['reload-btn'])
  assert.equal(mountedLane['reload-btn'].className, 'lane-reload-btn')
  assert.equal(headerTop.children[6], mountedLane['fullscreen-btn'])
  assert.equal(mountedLane['fullscreen-btn'].className, 'lane-fullscreen-btn')
  assert.equal(mountedLane['fullscreen-btn'].title, 'Fullscreen lane')
  assert.match(mountedLane['fullscreen-btn'].innerHTML, /<svg\b[^>]*class="lane-fullscreen-icon lane-fullscreen-icon--enter"/)
  assert.equal(headerTop.children[7], mountedLane['close-btn'])
  assert.equal(laneControl['by-id']['direct-id'], mountedLane)

  // Test concurrent open calls with stored titles (verifies per-call isolation)
  await mockData.namespace('stored-a').set('title', 'Saved A')
  await mockData.namespace('stored-b').set('title', 'Saved B')
  const [laneA, laneB] = await Promise.all([
   laneControl.open('stored-a'),
   laneControl.open('stored-b'),
  ])
  assert.equal(laneA.id, 'stored-a')
  assert.equal(laneA.title, 'Saved A')
  assert.equal(laneB.id, 'stored-b')
  assert.equal(laneB.title, 'Saved B')
  assert.equal(laneControl.lanes.length, 3)

  // Test add
  const addedLane = await laneControl.add()
  assert.equal(addedLane.id, 'uuid-1')
  assert.equal(addedLane.title, 'Lane 4')
  assert.equal(await mockData.namespace('uuid-1').get('title'), 'Lane 4')
  assert.equal(pushedUrls.at(-1), '/direct-id/stored-a/stored-b/uuid-1')

  // Test sync from URL
  mockLocation.pathname = '/stored-a/fresh-id'
  await laneControl.sync()
  assert.deepEqual(laneControl['lane-ids'], ['stored-a', 'fresh-id'])
  assert.equal(laneControl['by-id']['stored-a'].title, 'Saved A')
  assert.equal(laneControl['by-id']['fresh-id'].title, 'Lane 2')
  assert.equal(await mockData.namespace('fresh-id').get('title'), 'Lane 2')
 }
 finally {
  globalThis.fetch = origFetch
 }
})

test('main.fs bootstraps app with persistent lane notebooks that edit, add, remove, and re-run on reload', async () => {
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
   focused: false,
   removed: false,
   setAttribute(name, value) {
    this.attributes[name] = value
   },
   appendChild(child) {
    this.children.push(child)
    return child
   },
   insertBefore(child, ref) {
    const idx = this.children.indexOf(ref)
    if (idx === -1) { this.children.push(child) }
    else { this.children.splice(idx, 0, child) }
    return child
   },
   addEventListener(event, handler) {
    this.listeners[event] = handler
   },
   focus() {
    this.focused = true
   },
   remove() {
    this.removed = true
   },
  }
 }

 const kv = new Map()
 function createMockKV(prefix = '') {
  const qualify = key => (prefix ? `${prefix}.${key}` : key)
  return {
   namespace(name) { return createMockKV(qualify(name)) },
   async get(key) { return kv.has(qualify(key)) ? kv.get(qualify(key)) : null },
   async set(key, value) { kv.set(qualify(key), value) },
  }
 }

 let uuid = 0
 const windowListeners = {}
 const dispatchWindowEvent = async (event, ev) => {
  for (const handler of windowListeners[event] || []) {
   await handler(ev)
  }
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
  crypto: { randomUUID: () => `m-uuid-${++uuid}` },
  history: { pushState(_s, _t, url) { mockWindow.location.pathname = url } },
  location: { pathname: '/' },
  addEventListener(event, handler) {
   windowListeners[event] ||= []
   windowListeners[event].push(handler)
  },
 }
 const body = createMockElement('body')
 const mockDocument = {
  body,
  defaultView: mockWindow,
  createElement: createMockElement,
 }

 const origFetch = globalThis.fetch
 globalThis.fetch = async url => {
  if (url === '/src/lane-control.fs') {
   return { text: async () => laneSource }
  }
  if (url === '/src/lane-notebook.fs') {
   return { text: async () => notebookSource }
  }
  if (url === '/src/lane-inputs.fs') {
   return { text: async () => inputsSource }
  }
  if (url === '/src/lane-scope.fs') {
   return { text: async () => scopeSource }
  }
  if (url === '/src/lane-data.fs') {
   return { text: async () => dataSource }
  }
  if (url === '/src/confirm-modal.fs') {
   return { text: async () => confirmModalSource }
  }
  if (url === '/src/lane-row-picker-modal.fs') {
   return { text: async () => rowPickerModalSource }
  }
  if (url === '/src/lane-output.fs') {
   return { text: async () => outputSource }
  }
  if (url === '/src/lane-modal.fs') {
   return { text: async () => modalSource }
  }
  if (url === '/src/lane-config-modal.fs') {
   return { text: async () => configModalSource }
  }
  if (url === '/src/lane-import-modal.fs') {
   return { text: async () => importModalSource }
  }
  if (url === '/src/lane-rails.fs') {
   return { text: async () => railsSource }
  }
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
   console: { log() {} },
   createIdleTracker,
   data: createMockKV(),
   defaultValueForType,
   document: mockDocument,
   formatImportLine,
   hasImportCycle,
   normalizePrimitiveType,
   parseImportLine,
   ...DATA_RUNTIME_ENV,
   primitiveTypes: PRIMITIVE_TYPES,
   resolveImportValue,
   resolveScopeColumns,
   runLines,
   runTransportedScripts,
  })
  await f.run(parse(mainSource, '/src/main.fs'))

  // lane-control module scope did not leak `scope` into main.fs state
  assert.equal('scope' in f.state, false)
  assert.equal(f.state.lanes, f.state['lane-control'].lanes)

  // Clicking "+ Lane" adds a lane with a notebook starting at 1 blank line
  await f.state.tableHeadRowAddButton.listeners.click()
  assert.equal(f.state.lanes.length, 1)
  const lane = f.state.lanes[0]
  assert.equal(lane.id, 'm-uuid-1')
  assert.equal(lane.title, 'Lane 1')
  assert.equal(mockWindow.location.pathname, '/m-uuid-1')

  const nb = lane.notebook
  assert.equal(nb.rows.length, 1)
  assert.equal(nb.rows[0]['num-el'].textContent, 1)

  // Type "{ hello world }" into line 1 -> previews ["hello","world"]
  nb.rows[0]['input-el'].value = '{ hello world }'
  await nb.rows[0]['input-el'].listeners.input()
  assert.equal(nb.rows[0]['preview-el'].textContent, '["hello","world"]')

  // Click "+" button to add line 2 -> type "; to input 5"
  await nb['add-btn'].listeners.click()
  assert.equal(nb.rows.length, 2)
  assert.equal(nb.rows[1]['num-el'].textContent, 2)
  assert.equal(nb.rows[1]['input-el'].focused, true)
  nb.rows[1]['input-el'].value = '; to input 5'
  await nb.rows[1]['input-el'].listeners.input()
  assert.equal(nb.rows[1]['preview-el'].textContent, '5')

  // Press Enter on line 2 to insert line 3 -> type "; to output ; add 3 $input"
  let prevented = false
  await nb.rows[1]['input-el'].listeners.keydown({
   key: 'Enter',
   preventDefault() { prevented = true },
  })
  assert.equal(prevented, true)
  assert.equal(nb.rows.length, 3)
  assert.equal(nb.rows[2]['num-el'].textContent, 3)
  nb.rows[2]['input-el'].value = '; to output ; add 3 $input'
  await nb.rows[2]['input-el'].listeners.input()
  assert.equal(nb.rows[2]['preview-el'].textContent, '8')

  // Click "+" to add line 4 -> type "$output"
  await nb['add-btn'].listeners.click()
  nb.rows[3]['input-el'].value = '$output'
  await nb.rows[3]['input-el'].listeners.input()
  assert.equal(nb.rows[3]['preview-el'].textContent, '8')

  // Remove line 1 ("{ hello world }") -> remaining 3 lines renumber to 1, 2, 3 and stay evaluated
  await nb.rows[0]['remove-btn'].listeners.click()
  assert.equal(nb.rows.length, 3)
  assert.deepEqual(nb.rows.map(r => r['num-el'].textContent), [1, 2, 3])
  assert.deepEqual(nb.rows.map(r => r['preview-el'].textContent), ['5', '8', '8'])
  assert.ok(!kv.get('m-uuid-1.script'))
  assert.ok(kv.has('lanes#m-uuid-1/script-index'))
  const persistedScript = await loadLaneScript(f.state.data, lane.data, 'm-uuid-1', mockWindow)
  assert.deepEqual(
   persistedScript.records.map(r => r.text),
   ['; to input 5', '; to output ; add 3 $input', '$output']
  )
  assert.equal(persistedScript.records.length, 3)
  for (const rec of persistedScript.records) {
   assert.ok(kv.has(scriptLineKey('m-uuid-1', rec.id)))
  }

  // Add a second lane, then close Lane 1 via its top-right × button
  await f.state.tableHeadRowAddButton.listeners.click()
  assert.equal(f.state.lanes.length, 2)
  assert.equal(mockWindow.location.pathname, '/m-uuid-1/m-uuid-2')

  await lane['close-btn'].listeners.click()
  assert.equal(lane.element.removed, true)
  assert.equal(lane.body.removed, true)
  assert.equal(f.state.lanes.length, 1)
  assert.equal(f.state.lanes[0].id, 'm-uuid-2')
  assert.equal(mockWindow.location.pathname, '/m-uuid-2')
  assert.equal('m-uuid-1' in f.state['lane-control']['by-id'], false)

  // Click "Open" button -> opens full-screen modal listing both known lanes
  await f.state.tableHeadRowOpenButton.listeners.click()
  const modal = f.state['lane-modal']
  assert.equal(modal['is-open'], true)
  assert.equal(modal['search-input'].focused, true)
  assert.equal(modal['count-el'].textContent, '2 lanes')
  assert.equal(modal.items.length, 2)
  assert.equal(modal.items[0].entry.id, 'm-uuid-1')
  assert.equal(modal.items[0]['is-open'], false)
  assert.equal(modal.items[1].entry.id, 'm-uuid-2')
  assert.equal(modal.items[1]['is-open'], true)

  // Filter modal by "Lane 1"
  modal['search-input'].value = 'lane 1'
  await modal['search-input'].listeners.input()
  assert.equal(modal['count-el'].textContent, '1 of 2 lanes')
  assert.equal(modal.items.length, 1)
  assert.equal(modal.items[0].entry.id, 'm-uuid-1')

  // Re-open closed Lane 1 from modal -> restores script, re-runs previews, updates URL, closes modal
  await modal.items[0]['open-btn'].listeners.click()
  assert.equal(modal['is-open'], false)
  assert.equal(modal.backdrop.removed, true)
  assert.equal(f.state.lanes.length, 2)
  assert.equal(mockWindow.location.pathname, '/m-uuid-2/m-uuid-1')
  const reopened = f.state['lane-control']['by-id']['m-uuid-1']
  assert.deepEqual(reopened.notebook.lines, ['; to input 5', '; to output ; add 3 $input', '$output'])
  assert.deepEqual(reopened.notebook.rows.map(r => r['preview-el'].textContent), ['5', '8', '8'])

  // Re-open modal and close Lane 2 from inside the modal, then dismiss modal with Escape
  await f.state.tableHeadRowOpenButton.listeners.click()
  const lane2Item = modal.items.find(item => item.entry.id === 'm-uuid-2')
  assert.equal(lane2Item['is-open'], true)
  await lane2Item['close-btn'].listeners.click()
  assert.equal(f.state.lanes.length, 1)
  assert.equal(mockWindow.location.pathname, '/m-uuid-1')
  assert.equal(modal.items.find(item => item.entry.id === 'm-uuid-2')['is-open'], false)

  await dispatchWindowEvent('keydown', { key: 'Escape' })
  assert.equal(modal['is-open'], false)

  // Click gear icon on Lane 1 -> opens Configure Lane modal, Cancel leaves title unchanged
  const configModal = f.state['lane-control']['config-modal']
  await reopened['config-btn'].listeners.click()
  assert.equal(configModal['is-open'], true)
  assert.equal(configModal['title-input'].value, 'Lane 1')
  assert.equal(configModal['title-input'].focused, true)
  assert.equal(configModal['id-el'].textContent, 'm-uuid-1')
  configModal['title-input'].value = 'Discarded Title'
  await configModal['cancel-btn'].listeners.click()
  assert.equal(configModal['is-open'], false)
  assert.equal(reopened.title, 'Lane 1')
  assert.equal(reopened['title-el'].textContent, 'Lane 1')

  // Re-open Configure Lane modal and Save changes -> updates header, KV, and Open Lane catalog
  await reopened['config-btn'].listeners.click()
  configModal['title-input'].value = '  Mission Control  '
  let submitPrevented = false
  await configModal.form.listeners.submit({
   preventDefault() { submitPrevented = true },
  })
  assert.equal(submitPrevented, true)
  assert.equal(configModal['is-open'], false)
  assert.equal(reopened.title, 'Mission Control')
  assert.equal(reopened['title-el'].textContent, 'Mission Control')
  assert.equal(kv.get('m-uuid-1.title'), 'Mission Control')

  // Open Lane modal reflects renamed title, and Escape dismisses Configure Lane modal
  await f.state.tableHeadRowOpenButton.listeners.click()
  assert.equal(modal.items.find(item => item.entry.id === 'm-uuid-1').entry.title, 'Mission Control')
  await dispatchWindowEvent('keydown', { key: 'Escape' })
  assert.equal(modal['is-open'], false)

  await reopened['config-btn'].listeners.click()
  assert.equal(configModal['is-open'], true)
  await dispatchWindowEvent('keydown', { key: 'Escape' })
  assert.equal(configModal['is-open'], false)

  // Simulate full reload from URL -> persisted renamed title & script restore automatically on lane load
  const fReload = field({
   console: { log() {} },
   createIdleTracker,
   data: createMockKV(),
   defaultValueForType,
   document: {
    body: createMockElement('body'),
    defaultView: mockWindow,
    createElement: createMockElement,
   },
   formatImportLine,
   hasImportCycle,
   normalizePrimitiveType,
   parseImportLine,
   ...DATA_RUNTIME_ENV,
   primitiveTypes: PRIMITIVE_TYPES,
   resolveImportValue,
   resolveScopeColumns,
   runLines,
   runTransportedScripts,
  })
  await fReload.run(parse(mainSource, '/src/main.fs'))
  assert.equal(fReload.state.lanes.length, 1)
  assert.equal(fReload.state.lanes[0].title, 'Mission Control')
  const reloadedNb = fReload.state.lanes[0].notebook
  assert.deepEqual(reloadedNb.lines, ['; to input 5', '; to output ; add 3 $input', '$output'])
  assert.deepEqual(reloadedNb.rows.map(r => r['num-el'].textContent), [1, 2, 3])
  assert.deepEqual(reloadedNb.rows.map(r => r['preview-el'].textContent), ['5', '8', '8'])
 }
 finally {
  globalThis.fetch = origFetch
 }
})

test('lane-notebook.fs handles multi-line paste synchronously and inserts needed rows', async () => {
 const notebookSource = await fs.readFile(new URL('./src/lane-notebook.fs', import.meta.url), 'utf8')
 const inputsSource = await fs.readFile(new URL('./src/lane-inputs.fs', import.meta.url), 'utf8')
 const scopeSource = await fs.readFile(new URL('./src/lane-scope.fs', import.meta.url), 'utf8')
 const dataSource = await fs.readFile(new URL('./src/lane-data.fs', import.meta.url), 'utf8')
 const confirmModalSource = await fs.readFile(new URL('./src/confirm-modal.fs', import.meta.url), 'utf8')
 const rowPickerModalSource = await fs.readFile(new URL('./src/lane-row-picker-modal.fs', import.meta.url), 'utf8')
 const outputSource = await fs.readFile(new URL('./src/lane-output.fs', import.meta.url), 'utf8')

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
   focused: false,
   removed: false,
   selectionStart: null,
   selectionEnd: null,
   setAttribute(name, value) {
    this.attributes[name] = value
   },
   appendChild(child) {
    this.children.push(child)
    return child
   },
   insertBefore(child, ref) {
    const idx = this.children.indexOf(ref)
    if (idx === -1) { this.children.push(child) }
    else { this.children.splice(idx, 0, child) }
    return child
   },
   addEventListener(event, handler) {
    this.listeners[event] = handler
   },
   focus() {
    this.focused = true
   },
   setSelectionRange(start, end) {
    this.selectionStart = start
    this.selectionEnd = end
   },
   remove() {
    this.removed = true
   },
  }
 }

 const kv = new Map()
 const laneData = {
  async get(key) { return kv.has(key) ? kv.get(key) : null },
  async set(key, value) { kv.set(key, value) },
 }
 const mockWindow = { Array, Date, JSON, Math }
 const mockDocument = { createElement: createMockElement }

 const origFetch = globalThis.fetch
 globalThis.fetch = async url => {
  if (url === '/src/lane-inputs.fs') {
   return { text: async () => inputsSource }
  }
  if (url === '/src/lane-scope.fs') {
   return { text: async () => scopeSource }
  }
  if (url === '/src/lane-data.fs') {
   return { text: async () => dataSource }
  }
  if (url === '/src/confirm-modal.fs') {
   return { text: async () => confirmModalSource }
  }
  if (url === '/src/lane-row-picker-modal.fs') {
   return { text: async () => rowPickerModalSource }
  }
  if (url === '/src/lane-output.fs') {
   return { text: async () => outputSource }
  }
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
   console: { log() {} },
   createIdleTracker,
   defaultValueForType,
   document: mockDocument,
   formatImportLine,
   normalizePrimitiveType,
   parseImportLine,
   ...DATA_RUNTIME_ENV,
   primitiveTypes: PRIMITIVE_TYPES,
   resolveImportValue,
   resolveScopeColumns,
   runLines,
   runTransportedScripts,
   window: mockWindow,
  })
  const notebookMod = await f.run(parse(notebookSource, '/src/lane-notebook.fs'))
  const container = createMockElement('td')
  const lane = { id: 'paste-lane', data: laneData }
  const nb = await notebookMod.mount(lane, container)

 // Simulate real browser paste dispatch: clipboardData locks & preventDefault must run synchronously
 function firePaste(inputEl, text) {
  let active = true
  let prevented = false
  const ev = {
   clipboardData: {
    getData(type) {
     assert.equal(type, 'text/plain')
     return active ? text : ''
    },
   },
   preventDefault() {
    assert.equal(active, true, 'preventDefault must be called synchronously during paste dispatch')
    prevented = true
   },
  }
  const result = inputEl.listeners.paste(ev)
  active = false
  return { prevented, done: Promise.resolve(result) }
 }

 // 1. Single-line paste does not intercept native input behavior
 const single = firePaste(nb.rows[0]['input-el'], '; to single 1')
 assert.equal(single.prevented, false)
 await single.done

 // 2. Paste 4 lines into line 1 -> line 1 gets first line + 3 additional lines inserted after
 const snippet = [
  '; to input 5',
  '; to output ; add 3 $input',
  '!Math.max 2 $output',
  '; object { input $input } { output $output }',
 ].join('\n')
 const multi = firePaste(nb.rows[0]['input-el'], snippet)
 assert.equal(multi.prevented, true)
 await multi.done

 assert.deepEqual(nb.lines, [
  '; to input 5',
  '; to output ; add 3 $input',
  '!Math.max 2 $output',
  '; object { input $input } { output $output }',
 ])
 assert.deepEqual(nb.rows.map(r => r['num-el'].textContent), [1, 2, 3, 4])
 assert.deepEqual(nb.rows.map(r => r['input-el'].value), nb.lines)
 assert.deepEqual(nb.rows.map(r => r['preview-el'].textContent), [
  '5',
  '8',
  '8',
  '{"input":5,"output":8}',
 ])
 assert.equal(nb.rows[3]['input-el'].focused, true)
 assert.equal(nb.rows[3]['input-el'].selectionStart, nb.lines[3].length)
 assert.equal(nb.rows[3]['input-el'].selectionEnd, nb.lines[3].length)
 assert.ok(!kv.has('script'))
 assert.ok(!kv.has('paste-lane.script'))
 assert.ok(kv.has('lanes#paste-lane/script-index'))
 const persistedPaste = await loadLaneScript(null, laneData, 'paste-lane', mockWindow)
 assert.deepEqual(persistedPaste.records.map(r => r.text), nb.lines)
 assert.equal(persistedPaste.records.length, 4)
 for (const rec of persistedPaste.records) {
  assert.ok(kv.has(scriptLineKey('paste-lane', rec.id)))
 }

 // 3. Paste CRLF with trailing newline in the middle of an existing line & between rows
 const row1Input = nb.rows[1]['input-el']
 row1Input.value = 'AB'
 row1Input.selectionStart = 1
 row1Input.selectionEnd = 1
 const mid = firePaste(row1Input, 'first\r\nsecond\r\nthird\r\n')
 assert.equal(mid.prevented, true)
 await mid.done

 assert.deepEqual(nb.lines, [
  '; to input 5',
  'Afirst',
  'second',
  'thirdB',
  '!Math.max 2 $output',
  '; object { input $input } { output $output }',
 ])
 assert.deepEqual(nb.rows.map(r => r['num-el'].textContent), [1, 2, 3, 4, 5, 6])
 assert.deepEqual(nb['lines-el'].children, nb.rows.map(r => r.el))
 assert.equal(nb.rows[3]['input-el'].focused, true)
  assert.equal(nb.rows[3]['input-el'].selectionStart, 'third'.length)
  assert.equal(nb.rows[3]['input-el'].selectionEnd, 'third'.length)
 }
 finally {
  globalThis.fetch = origFetch
 }
})

test('lane-notebook.fs tabs: Source (default), Input (primitive args, no Source run), and Scope (runs Source & multi-column browser)', async () => {
 const notebookSource = await fs.readFile(new URL('./src/lane-notebook.fs', import.meta.url), 'utf8')
 const inputsSource = await fs.readFile(new URL('./src/lane-inputs.fs', import.meta.url), 'utf8')
 const scopeSource = await fs.readFile(new URL('./src/lane-scope.fs', import.meta.url), 'utf8')
 const dataSource = await fs.readFile(new URL('./src/lane-data.fs', import.meta.url), 'utf8')
 const confirmModalSource = await fs.readFile(new URL('./src/confirm-modal.fs', import.meta.url), 'utf8')
 const rowPickerModalSource = await fs.readFile(new URL('./src/lane-row-picker-modal.fs', import.meta.url), 'utf8')
 const outputSource = await fs.readFile(new URL('./src/lane-output.fs', import.meta.url), 'utf8')

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
   hidden: false,
   focused: false,
   removed: false,
   scrollWidth: 0,
   scrollLeft: 0,
   setAttribute(name, value) {
    this.attributes[name] = value
   },
   appendChild(child) {
    this.children.push(child)
    return child
   },
   insertBefore(child, ref) {
    const idx = this.children.indexOf(ref)
    if (idx === -1) { this.children.push(child) }
    else { this.children.splice(idx, 0, child) }
    return child
   },
   addEventListener(event, handler) {
    this.listeners[event] = handler
   },
   focus() {
    this.focused = true
   },
   remove() {
    this.removed = true
   },
  }
 }

 const kv = new Map()
 const laneData = {
  async get(key) { return kv.has(key) ? kv.get(key) : null },
  async set(key, value) { kv.set(key, value) },
 }
 const mockWindow = { Array, Date, JSON, Math }
 const mockDocument = { createElement: createMockElement }

 let runCount = 0
 const countedRunLines = async (lines, opts) => {
  runCount += 1
  return runLines(lines, opts)
 }

 const origFetch = globalThis.fetch
 globalThis.fetch = async url => {
  if (url === '/src/lane-inputs.fs') {
   return { text: async () => inputsSource }
  }
  if (url === '/src/lane-scope.fs') {
   return { text: async () => scopeSource }
  }
  if (url === '/src/lane-data.fs') {
   return { text: async () => dataSource }
  }
  if (url === '/src/confirm-modal.fs') {
   return { text: async () => confirmModalSource }
  }
  if (url === '/src/lane-row-picker-modal.fs') {
   return { text: async () => rowPickerModalSource }
  }
  if (url === '/src/lane-output.fs') {
   return { text: async () => outputSource }
  }
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
   console: { log() {} },
   createIdleTracker,
   defaultValueForType,
   document: mockDocument,
   formatImportLine,
   normalizePrimitiveType,
   parseImportLine,
   ...DATA_RUNTIME_ENV,
   primitiveTypes: PRIMITIVE_TYPES,
   resolveImportValue,
   resolveScopeColumns,
   createSourceWorkerRunner: opts => createSourceWorkerRunner({ ...opts, onRun: () => { runCount += 1 } }),
   runLines: countedRunLines,
   runTransportedScripts,
   window: mockWindow,
  })
  const notebookMod = await f.run(parse(notebookSource, '/src/lane-notebook.fs'))
  const container = createMockElement('td')
  const lane = { id: 'tab-lane', data: laneData }
  const nb = await notebookMod.mount(lane, container)

  // Tabs are mounted directly above lane contents with Source active by default
  assert.equal(nb.element.children[0], nb['tabs-el'])
  assert.equal(nb.element.children[1], nb['source-panel'])
  assert.equal(nb.element.children[2], nb['input-panel'])
  assert.equal(nb.element.children[3], nb['scope-panel'])
  assert.equal(nb['active-tab'], 'source')
  assert.equal(nb['source-panel'].hidden, false)
  assert.equal(nb['input-panel'].hidden, true)
  assert.equal(nb['scope-panel'].hidden, true)
  assert.equal(runCount, 1)

  // Enter Source lines that reference assumed inputs `count` (number) and `label` (string)
  nb.rows[0]['input-el'].value = '; to total ; add $count 10'
  await nb.rows[0]['input-el'].listeners.input()
  await nb['add-btn'].listeners.click()
  nb.rows[1]['input-el'].value = '; to info ; object { label $label } { total $total } { nested ; object { ok $enabled } }'
  await nb.rows[1]['input-el'].listeners.input()
  const runsBeforeInputTab = runCount

  // Switch to Input tab -> Source MUST NOT run
  await nb.tabs.input.listeners.click()
  assert.equal(nb['active-tab'], 'input')
  assert.equal(nb['source-panel'].hidden, true)
  assert.equal(nb['input-panel'].hidden, false)
  assert.equal(nb['scope-panel'].hidden, true)
  assert.equal(runCount, runsBeforeInputTab)

  // Add and edit assumed primitive inputs while on Input tab -> persists to KV, Source MUST NOT run
  const inputsView = nb['inputs-view']
  assert.equal(inputsView['empty-el'].hidden, false)
  await inputsView['add-btn'].listeners.click()
  assert.equal(inputsView.rows.length, 1)
  assert.equal(inputsView['empty-el'].hidden, true)
  assert.deepEqual(
   inputsView.rows[0]['type-el'].children.map(opt => opt.value),
   ['string', 'number', 'boolean', 'null', 'undefined', 'secret']
  )
  inputsView.rows[0]['name-el'].value = 'count'
  await inputsView.rows[0]['name-el'].listeners.input()
  inputsView.rows[0]['type-el'].value = 'number'
  await inputsView.rows[0]['type-el'].listeners.change()

  await inputsView['add-btn'].listeners.click()
  inputsView.rows[1]['name-el'].value = 'label'
  await inputsView.rows[1]['name-el'].listeners.input()
  inputsView.rows[1]['type-el'].value = 'string'
  await inputsView.rows[1]['type-el'].listeners.change()

  await inputsView['add-btn'].listeners.click()
  inputsView.rows[2]['name-el'].value = 'enabled'
  await inputsView.rows[2]['name-el'].listeners.input()
  inputsView.rows[2]['type-el'].value = 'boolean'
  await inputsView.rows[2]['type-el'].listeners.change()

  // Even direct nb.run() while on Input must not execute Source
  await nb.run()
  assert.equal(runCount, runsBeforeInputTab)
  assert.deepEqual(JSON.parse(kv.get('inputs')), [
   { name: 'count', type: 'number' },
   { name: 'label', type: 'string' },
   { name: 'enabled', type: 'boolean' },
  ])

  // Switch directly from Input -> Scope: Source MUST run with seeded primitive inputs and populate Scope browser
  await nb.tabs.scope.listeners.click()
  assert.equal(nb['active-tab'], 'scope')
  assert.equal(nb['source-panel'].hidden, true)
  assert.equal(nb['input-panel'].hidden, true)
  assert.equal(nb['scope-panel'].hidden, false)
  assert.equal(runCount, runsBeforeInputTab + 1)

  // Calling nb.run() while on Scope also runs Source
  await nb.run()
  assert.equal(runCount, runsBeforeInputTab + 2)

  // Verify Scope browser multi-column navigation: root -> info (object) -> nested (object) -> ok (boolean value)
  const scopeView = nb['scope-view']
  assert.equal(scopeView.columns.length, 1)
  const infoItem = scopeView.columns[0].items.find(i => i.key === 'info')
  assert.ok(infoItem)
  await infoItem.el.listeners.click()
  assert.equal(scopeView.columns.length, 2)
  assert.equal(scopeView.columns[1].kind, 'entries')
  assert.deepEqual(scopeView.columns[1].items.map(i => i.key), ['label', 'nested', 'total'])

  // Click primitive property `total` -> reveals column 3 with value 10 (0 + 10)
  const totalItem = scopeView.columns[1].items.find(i => i.key === 'total')
  await totalItem.el.listeners.click()
  assert.equal(scopeView.columns.length, 3)
  assert.equal(scopeView.columns[2].kind, 'value')
  assert.equal(scopeView.columns[2]['type-el'].textContent, 'number')
  assert.equal(scopeView.columns[2]['value-el'].textContent, '10')
  assert.equal(scopeView.columns[2]['path-el'].textContent, '$info.total')

  // Click nested object `nested` in column 2 -> replaces column 3 with `nested`'s properties
  const nestedItem = scopeView.columns[1].items.find(i => i.key === 'nested')
  await nestedItem.el.listeners.click()
  assert.equal(scopeView.columns.length, 3)
  assert.equal(scopeView.columns[2].kind, 'entries')
  const okItem = scopeView.columns[2].items.find(i => i.key === 'ok')
  await okItem.el.listeners.click()
  assert.equal(scopeView.columns.length, 4)
  assert.equal(scopeView.columns[3].kind, 'value')
  assert.equal(scopeView.columns[3]['type-el'].textContent, 'boolean')
  assert.equal(scopeView.columns[3]['value-el'].textContent, 'false')
  assert.equal(scopeView.columns[3]['path-el'].textContent, '$info.nested.ok')

  // Click root breadcrumb `scope` -> collapses back to column 0
  await scopeView['crumb-els'][0].listeners.click()
  assert.equal(scopeView.columns.length, 1)

  // Verify declared input `count` is visible in root Scope and evaluates to default 0
  const countItem = scopeView.columns[0].items.find(i => i.key === 'count')
  await countItem.el.listeners.click()
  assert.equal(scopeView.columns.length, 2)
  assert.equal(scopeView.columns[1].kind, 'value')
  assert.equal(scopeView.columns[1]['value-el'].textContent, '0')

  // Reload lane -> persisted inputs and script restore and evaluate cleanly
  const containerReload = createMockElement('td')
  const nbReload = await notebookMod.mount({ id: 'tab-lane', data: laneData }, containerReload)
  assert.deepEqual(nbReload.inputs, [
   { name: 'count', type: 'number' },
   { name: 'label', type: 'string' },
   { name: 'enabled', type: 'boolean' },
  ])
  assert.equal(nbReload.rows[0]['preview-el'].textContent, '10')
  assert.equal(nbReload.rows[1]['preview-el'].textContent, '{"label":"","total":10,"nested":{"ok":false}}')
 }
 finally {
  globalThis.fetch = origFetch
 }
})

test('parseImportLine, formatImportLine, resolveScopePath, createIdleTracker, and hasImportCycle', async () => {
 const spec1 = { alias: 'output', laneId: 'acbb854a-6592-4ecc-8633-2984a0cb87e9', path: ['output'] }
 const line1 = formatImportLine(spec1)
 assert.equal(line1, '; to output !importLane acbb854a-6592-4ecc-8633-2984a0cb87e9 output')
 assert.deepEqual(parseImportLine(line1), spec1)

 const specNested = { alias: 'customName', laneId: 'lane-1', path: ['items', '0', 'a.b', "it's ok"] }
 assert.deepEqual(parseImportLine(formatImportLine(specNested)), specNested)

 const specBlank = { alias: '', laneId: '', path: [] }
 const lineBlank = formatImportLine(specBlank)
 assert.equal(lineBlank, "!importLane ''")
 assert.deepEqual(parseImportLine(lineBlank), specBlank)

 // Regular lines do not parse as import lines
 assert.equal(parseImportLine('; to x 5'), null)
 assert.equal(parseImportLine('; to x !Math.max 1 2'), null)
 assert.equal(parseImportLine(''), null)

 // resolveScopePath respects get semantics including argv and explicit undefined
 const sampleState = { a: { b: 42 }, undef: undefined }
 assert.deepEqual(resolveScopePath(sampleState, ['a', 'b']), { found: true, value: 42, error: null })
 assert.deepEqual(resolveScopePath(sampleState, ['undef']), { found: true, value: undefined, error: null })
 assert.deepEqual(resolveScopePath(sampleState, ['argv']), { found: true, value: [], error: null })
 assert.equal(resolveScopePath(sampleState, ['missing']).found, false)
 assert.equal(resolveScopePath(sampleState, ['a', 'missing']).found, false)

 // createIdleTracker resolves whenIdle only after all overlapping runs finish
 const tracker = createIdleTracker()
 assert.equal(tracker.isRunning(), false)
 assert.equal(tracker.hasRun(), false)
 const end1 = tracker.begin()
 const end2 = tracker.begin()
 let idleResolved = false
 const waiter = tracker.whenIdle().then(() => { idleResolved = true })
 end1(false)
 await Promise.resolve()
 assert.equal(idleResolved, false)
 assert.equal(tracker.isRunning(), true)
 end2(true)
 await waiter
 assert.equal(idleResolved, true)
 assert.equal(tracker.isRunning(), false)
 assert.equal(tracker.hasRun(), true)

 // hasImportCycle detects direct, self, and transitive cycles
 assert.equal(hasImportCycle({}, 'a', 'a'), true)
 assert.equal(hasImportCycle({ b: ['a'] }, 'a', 'b'), true)
 assert.equal(hasImportCycle({ b: ['c'], c: ['a'] }, 'a', 'b'), true)
 assert.equal(hasImportCycle({ b: ['c'] }, 'a', 'b'), false)
})

test('cross-lane import line shows picker instead of raw input, awaits idle lane, supports rename/same-name, updates reactively, and detects cycles', async () => {
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
   hidden: false,
   disabled: false,
   focused: false,
   removed: false,
   scrollWidth: 0,
   scrollLeft: 0,
   setAttribute(name, value) {
    this.attributes[name] = value
   },
   appendChild(child) {
    this.children.push(child)
    return child
   },
   insertBefore(child, ref) {
    const idx = this.children.indexOf(ref)
    if (idx === -1) { this.children.push(child) }
    else { this.children.splice(idx, 0, child) }
    return child
   },
   addEventListener(event, handler) {
    this.listeners[event] = handler
   },
   focus() {
    this.focused = true
   },
   remove() {
    this.removed = true
   },
  }
 }

 const kv = new Map()
 let deferredGet = null
 function createMockKV(prefix = '') {
  const qualify = key => (prefix ? `${prefix}.${key}` : key)
  return {
   namespace(name) { return createMockKV(qualify(name)) },
   async get(key) {
    const k = qualify(key)
    if (deferredGet && k === deferredGet.key) {
     return deferredGet.promise
    }
    return kv.has(k) ? kv.get(k) : null
   },
   async set(key, value) { kv.set(qualify(key), value) },
  }
 }

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
  crypto: { randomUUID: () => `imp-uuid-${++uuid}` },
  history: { pushState(_s, _t, url) { mockWindow.location.pathname = url } },
  location: { pathname: '/' },
  addEventListener(event, handler) {
   windowListeners[event] ||= []
   windowListeners[event].push(handler)
  },
 }
 const mockDocument = {
  body: createMockElement('body'),
  defaultView: mockWindow,
  createElement: createMockElement,
 }

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
   console: { log() {} },
   createIdleTracker,
   data: createMockKV(),
   defaultValueForType,
   document: mockDocument,
   formatImportLine,
   hasImportCycle,
   normalizePrimitiveType,
   parseImportLine,
   ...DATA_RUNTIME_ENV,
   primitiveTypes: PRIMITIVE_TYPES,
   resolveImportValue,
   resolveScopeColumns,
   runLines,
   runTransportedScripts,
  })
  await f.run(parse(mainSource, '/src/main.fs'))

  // Create Lane 1 ("Object Test") with values in scope
  await f.state.tableHeadRowAddButton.listeners.click()
  const lane1 = f.state.lanes[0]
  await f.state['lane-control'].rename(lane1.id, 'Object Test')
  const nb1 = lane1.notebook
  nb1.rows[0]['input-el'].value = '; to input 5'
  await nb1.rows[0]['input-el'].listeners.input()
  await nb1['add-btn'].listeners.click()
  nb1.rows[1]['input-el'].value = '; to output ; add 3 $input'
  await nb1.rows[1]['input-el'].listeners.input()
  await nb1['add-btn'].listeners.click()
  nb1.rows[2]['input-el'].value = '; to summary ; object { input $input } { output $output }'
  await nb1.rows[2]['input-el'].listeners.input()

  // Create Lane 2 and click "+ Import" -> inserts an import line (picker control, no raw line input) and opens picker
  await f.state.tableHeadRowAddButton.listeners.click()
  const lane2 = f.state.lanes[1]
  const nb2 = lane2.notebook

  await nb2['add-import-btn'].listeners.click()
  const importRow = nb2.rows[1]
  assert.equal(importRow.kind, 'import')
  assert.equal(importRow['input-el'], undefined)
  assert.ok(importRow['control-el'])
  assert.ok(importRow['alias-el'])
  assert.ok(importRow['pick-btn'])

  // Import picker modal opened with Lane 1 auto-selected (self excluded) and ready for whole-lane import
  const importModal = f.state['lane-control']['import-modal']
  assert.equal(importModal['is-open'], true)
  assert.equal(importModal['lane-items'].length, 1)
  assert.equal(importModal['lane-items'][0].id, lane1.id)
  assert.equal(importModal['selected-lane-id'], lane1.id)
  assert.equal(importModal['confirm-btn'].disabled, false)
  assert.equal(importModal['alias-input'].value, 'object-test')
  assert.equal(importModal['summary-el'].textContent, 'Object Test · (whole lane)')

  // Click `output` in Lane 1's Scope browser inside the picker -> auto-fills same name `output`
  const pickerScope = importModal['scope-view']
  const outputItem = pickerScope.columns[0].items.find(i => i.key === 'output')
  assert.ok(outputItem)
  await outputItem.el.listeners.click()
  assert.equal(importModal['alias-input'].value, 'output')
  assert.equal(importModal['confirm-btn'].disabled, false)
  assert.equal(importModal['summary-el'].textContent, 'Object Test · $output')

  // Confirm import (same name)
  await importModal.form.listeners.submit({ preventDefault() {} })
  assert.equal(importModal['is-open'], false)
  assert.equal(importRow['alias-el'].value, 'output')
  assert.equal(importRow['pick-btn'].textContent, 'Object Test · $output')
  assert.equal(importRow['preview-el'].textContent, '8')
  assert.equal(nb2.lines[1], `; to output !importLane ${lane1.id} output`)

  // Use imported `$output` on line 3 of Lane 2
  await nb2['add-btn'].listeners.click()
  nb2.rows[2]['input-el'].value = '; to doubled ; multiply $output 2'
  await nb2.rows[2]['input-el'].listeners.input()
  assert.equal(nb2.rows[2]['preview-el'].textContent, '16')

  // Rename imported variable inline to a different name (`baseVal`)
  importRow['alias-el'].value = 'baseVal'
  await importRow['alias-el'].listeners.input()
  assert.equal(nb2.lines[1], `; to baseVal !importLane ${lane1.id} output`)
  assert.equal(nb2.state.baseVal, 8)
  nb2.rows[2]['input-el'].value = '; to doubled ; multiply $baseVal 2'
  await nb2.rows[2]['input-el'].listeners.input()
  assert.equal(nb2.rows[2]['preview-el'].textContent, '16')

  // Reactive update: editing Lane 1 automatically re-runs Lane 2 once Lane 1 is idle
  nb1.rows[0]['input-el'].value = '; to input 10'
  await nb1.rows[0]['input-el'].listeners.input()
  assert.equal(nb1.state.output, 13)
  assert.equal(importRow['preview-el'].textContent, '13')
  assert.equal(nb2.rows[2]['preview-el'].textContent, '26')

  // Renaming Lane 1 updates the picker button label on Lane 2
  await f.state['lane-control'].rename(lane1.id, 'Source Math')
  assert.equal(importRow['pick-btn'].textContent, 'Source Math · $output')

  // Must-have-completed-running: if Lane 1 is mid-run (async), Lane 2 waits until Lane 1 is idle
  let resolveSlow
  deferredGet = {
   key: `${lane1.id}.slowKey`,
   promise: new Promise(resolve => { resolveSlow = resolve }),
  }
  await nb1['add-btn'].listeners.click()
  nb1.rows[3]['input-el'].value = '; to output !data.get slowKey'
  const slowLane1Run = nb1.rows[3]['input-el'].listeners.input()
  assert.equal(nb1['is-running'](), true)

  // Start Lane 2 run while Lane 1 is still running -> must wait until Lane 1 completes
  let lane2Done = false
  const lane2RunPromise = nb2.run().then(() => { lane2Done = true })
  await Promise.resolve()
  await Promise.resolve()
  assert.equal(lane2Done, false)

  // Now complete Lane 1's async step -> Lane 1 finishes & Lane 2 receives the final idle value
  resolveSlow('99')
  await slowLane1Run
  await lane2RunPromise
  deferredGet = null
  assert.equal(nb1['is-running'](), false)
  assert.equal(nb2.state.baseVal, '99')

  // Restore numeric output on Lane 1 and verify nested object property pick + reload persistence
  await nb1.rows[3]['remove-btn'].listeners.click()
  assert.equal(nb2.state.baseVal, 13)

  await importRow['pick-btn'].listeners.click()
  assert.equal(importModal['is-open'], true)
  const summaryItem = importModal['scope-view'].columns[0].items.find(i => i.key === 'summary')
  await summaryItem.el.listeners.click()
  const nestedInputItem = importModal['scope-view'].columns[1].items.find(i => i.key === 'input')
  await nestedInputItem.el.listeners.click()
  importModal['alias-input'].value = 'importedInput'
  await importModal['alias-input'].listeners.input()
  await importModal.form.listeners.submit({ preventDefault() {} })
  assert.equal(importRow['pick-btn'].textContent, 'Source Math · $summary.input')
  assert.equal(importRow['preview-el'].textContent, '10')
  assert.equal(nb2.state.importedInput, 10)

  // Cycle detection: if Lane 1 tries to import back from Lane 2, it reports an error instead of hanging
  await nb1['insert-import'](nb1.lines.length, { alias: 'loop', laneId: lane2.id, path: ['importedInput'] })
  const loopRow = nb1.rows[nb1.rows.length - 1]
  // No deadlock; check reload restores Lane 2's import line as a picker row (not a raw input)
  await loopRow['remove-btn'].listeners.click()

  const fReload = field({
   console: { log() {} },
   createIdleTracker,
   data: createMockKV(),
   defaultValueForType,
   document: {
    body: createMockElement('body'),
    defaultView: mockWindow,
    createElement: createMockElement,
   },
   formatImportLine,
   hasImportCycle,
   normalizePrimitiveType,
   parseImportLine,
   ...DATA_RUNTIME_ENV,
   primitiveTypes: PRIMITIVE_TYPES,
   resolveImportValue,
   resolveScopeColumns,
   runLines,
   runTransportedScripts,
  })
  await fReload.run(parse(mainSource, '/src/main.fs'))
  const reloadedLane2 = fReload.state.lanes[1]
  const reloadedImportRow = reloadedLane2.notebook.rows[1]
  assert.equal(reloadedImportRow.kind, 'import')
  assert.equal(reloadedImportRow['input-el'], undefined)
  assert.equal(reloadedImportRow['alias-el'].value, 'importedInput')
  assert.equal(reloadedImportRow['pick-btn'].textContent, 'Source Math · $summary.input')
  assert.equal(reloadedImportRow['preview-el'].textContent, '10')
 }
 finally {
  deferredGet = null
  globalThis.fetch = origFetch
 }
})

test('Lane Output mini-browser below each lane collects sent scripts, enforces no server document, handles live events, reload, errors, and persistence', async () => {
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
   focused: false,
   removed: false,
   scrollWidth: 0,
   scrollLeft: 0,
   setAttribute(name, value) {
    this.attributes[name] = value
   },
   appendChild(child) {
    this.children.push(child)
    return child
   },
   insertBefore(child, ref) {
    const idx = this.children.indexOf(ref)
    if (idx === -1) { this.children.push(child) }
    else { this.children.splice(idx, 0, child) }
    return child
   },
   addEventListener(event, handler) {
    this.listeners[event] = handler
   },
   focus() {
    this.focused = true
   },
   remove() {
    this.removed = true
   },
  }
 }

 const kv = new Map()
 function createMockKV(prefix = '') {
  const qualify = key => (prefix ? `${prefix}.${key}` : key)
  return {
   namespace(name) { return createMockKV(qualify(name)) },
   async get(key) { return kv.has(qualify(key)) ? kv.get(qualify(key)) : null },
   async set(key, value) { kv.set(qualify(key), value) },
  }
 }

 let uuid = 0
 const mockWindow = {
  Array,
  Boolean,
  Date,
  JSON,
  Math,
  Object,
  Reflect,
  decodeURIComponent,
  crypto: { randomUUID: () => `out-uuid-${++uuid}` },
  history: { pushState(_s, _t, url) { mockWindow.location.pathname = url } },
  location: { pathname: '/' },
  addEventListener() {},
 }
 const mockDocument = {
  body: createMockElement('body'),
  defaultView: mockWindow,
  createElement: createMockElement,
 }

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
   console: { log() {} },
   createIdleTracker,
   data: createMockKV(),
   defaultValueForType,
   document: mockDocument,
   formatImportLine,
   hasImportCycle,
   normalizePrimitiveType,
   parseImportLine,
   ...DATA_RUNTIME_ENV,
   primitiveTypes: PRIMITIVE_TYPES,
   resolveImportValue,
   resolveScopeColumns,
   runLines,
   runTransportedScripts,
  })
  await f.run(parse(mainSource, '/src/main.fs'))

  // Add Lane 1
  await f.state.tableHeadRowAddButton.listeners.click()
  const lane1 = f.state.lanes[0]
  const nb1 = lane1.notebook
  const out1 = nb1['output-view']

  // Mini-browser is mounted directly below the notebook inside lane.body and starts hidden
  assert.equal(lane1.body.children[0], nb1.element)
  assert.equal(lane1.body.children[1], out1.element)
  assert.equal(out1.element.hidden, true)
  assert.equal(out1['viewport-el'].children.length, 0)

  // Direct `document` access fails in the server lane
  nb1.rows[0]['input-el'].value = '!document.createElement h1'
  await nb1.rows[0]['input-el'].listeners.input()
  assert.match(nb1.rows[0]['preview-el'].textContent, /"document" not found/)
  assert.equal(out1.element.hidden, true)

  // Enter the user's send block -> Lane Output mini-browser appears below the lane with the <h1> inside <iframe sandbox="allow-scripts">
  nb1.rows[0]['input-el'].value = "; send ( [ to title [ invoke { h1 } document createElement ] ] [set 'Hello from FieldScript' title textContent] [ get title ] ) -- if last item returned from script is an element it is appended to Lane Output below the lane"
  await nb1.rows[0]['input-el'].listeners.input()
  assert.equal(nb1.rows[0]['preview-el'].textContent, '[sent #1 · 3 stmts]')
  assert.equal(out1.element.hidden, false)
  assert.equal(out1['count-el'].textContent, '1 script')
  assert.equal(out1['errors-el'].hidden, true)
  assert.equal(out1['viewport-el'].children.length, 1)
  assert.equal(out1['viewport-el'].children[0], out1['iframe-el'])
  assert.equal(out1['iframe-el'].tag, 'iframe')
  assert.equal(out1['iframe-el'].attributes.sandbox, 'allow-scripts')
  assert.ok(!out1['iframe-el'].attributes.sandbox.includes('allow-same-origin'))
  assert.equal(out1['inline-host'].debugOutputEl.children.length, 1)
  assert.equal(out1['inline-host'].debugOutputEl.children[0].tag, 'h1')
  assert.equal(out1['inline-host'].debugOutputEl.children[0].textContent, 'Hello from FieldScript')

  // Add a server value and an interactive button sent to the mini-browser
  await nb1['add-btn'].listeners.click()
  nb1.rows[1]['input-el'].value = "; to serverLabel 'Launch'"
  await nb1.rows[1]['input-el'].listeners.input()
  await nb1['add-btn'].listeners.click()
  nb1.rows[2]['input-el'].value = "; send ( ; to btn !document.createElement button, ; set $serverLabel btn.textContent, !btn.addEventListener click ( ; set 'Launched!' btn.textContent ), $btn )"
  await nb1.rows[2]['input-el'].listeners.input()

  assert.equal(out1['count-el'].textContent, '2 scripts')
  assert.equal(out1['inline-host'].debugOutputEl.children.length, 2)
  assert.equal(out1['inline-host'].debugOutputEl.children[1].tag, 'button')
  assert.equal(out1['inline-host'].debugOutputEl.children[1].textContent, 'Launch')

  // Clicking the rendered button runs FieldScript in sandboxed browser context
  await out1['inline-host'].debugOutputEl.children[1].listeners.click()
  assert.equal(out1['inline-host'].debugOutputEl.children[1].textContent, 'Launched!')

  // Mock browser title displays the lane title, and popout button sits to the right of reload
  assert.equal(out1['address-el'].textContent, 'Lane 1')
  assert.equal(out1['bar-el'].children[3], out1['reload-btn'])
  assert.equal(out1['bar-el'].children[4], out1['popout-btn'])
  assert.equal(out1['floating-el'].hidden, true)
  assert.equal(out1['attach-btn'].textContent, 'Attach output window')

  // Clicking the mini-browser Reload button resets & re-runs sent scripts cleanly
  await out1['reload-btn'].listeners.click()
  assert.equal(out1['inline-host'].debugOutputEl.children.length, 2)
  assert.equal(out1['inline-host'].debugOutputEl.children[1].textContent, 'Launch')

  // Pop out the lane output into a floating window
  let openedPopup = null
  mockWindow.open = () => {
   const popupDoc = {
    title: '',
    head: createMockElement('head'),
    body: createMockElement('body'),
    createElement: createMockElement,
   }
   openedPopup = {
    closed: false,
    document: popupDoc,
    listeners: {},
    addEventListener(type, fn) {
     this.listeners[type] = fn
    },
    removeEventListener(type, fn) {
     if (this.listeners[type] === fn) {
      delete this.listeners[type]
     }
    },
    focus() {},
    close() {
     this.closed = true
    },
   }
   popupDoc.defaultView = openedPopup
   return openedPopup
  }
  await out1['popout-btn'].listeners.click()
  assert.ok(openedPopup)
  assert.equal(out1['is-floating'], true)
  assert.equal(openedPopup.document.title, 'Lane 1')
  assert.equal(out1['floating-el'].hidden, false)
  assert.equal(out1['viewport-el'].hidden, true)
  assert.equal(out1['popout-btn'].hidden, true)
  assert.equal(out1['popup-popin-btn'].className, 'lane-output-floating-popin')
  assert.equal(out1['popup-iframe-el'].tag, 'iframe')
  assert.equal(out1['popup-iframe-el'].attributes.sandbox, 'allow-scripts')
  assert.equal(out1['popup-host'].debugOutputEl.children.length, 2)
  assert.equal(out1['popup-host'].debugOutputEl.children[1].textContent, 'Launch')

  // Live refresh while floating updates the floating window
  nb1.rows[1]['input-el'].value = "; to serverLabel 'Launch Floating'"
  await nb1.rows[1]['input-el'].listeners.input()
  assert.equal(out1['popup-host'].debugOutputEl.children[1].textContent, 'Launch Floating')

  // Clicking Attach output window recalls the floating window home into the lane
  await out1['attach-btn'].listeners.click()
  assert.equal(openedPopup.closed, true)
  assert.equal(out1['is-floating'], false)
  assert.equal(out1['floating-el'].hidden, true)
  assert.equal(out1['viewport-el'].hidden, false)
  assert.equal(out1['popout-btn'].hidden, false)
  assert.equal(out1['inline-host'].debugOutputEl.children.length, 2)
  assert.equal(out1['inline-host'].debugOutputEl.children[1].textContent, 'Launch Floating')

  // Pop out again and use the top-right pop-in button inside the floating window
  await out1['popout-btn'].listeners.click()
  assert.equal(out1['is-floating'], true)
  await out1['popup-popin-btn'].listeners.click()
  assert.equal(out1['is-floating'], false)
  assert.equal(out1['floating-el'].hidden, true)
  assert.equal(out1['viewport-el'].hidden, false)

  // Reset serverLabel back to 'Launch' for downstream assertions
  nb1.rows[1]['input-el'].value = "; to serverLabel 'Launch'"
  await nb1.rows[1]['input-el'].listeners.input()

  // Browser runtime error displays inside Lane Output errors panel without dropping valid elements
  await nb1['add-btn'].listeners.click()
  nb1.rows[3]['input-el'].value = '; send ( !document.doesNotExist )'
  await nb1.rows[3]['input-el'].listeners.input()
  assert.equal(out1['count-el'].textContent, '3 scripts')
  assert.equal(out1['inline-host'].debugOutputEl.children.length, 2)
  assert.equal(out1['errors-el'].hidden, false)
  assert.equal(out1['error-els'].length, 1)
  assert.match(out1['error-els'][0].textContent, /Line 4:/)

  // Remove the error line -> error panel hides again
  await nb1.rows[3]['remove-btn'].listeners.click()
  assert.equal(out1['errors-el'].hidden, true)
  assert.equal(out1['count-el'].textContent, '2 scripts')

  // Add Lane 2 importing `serverLabel` from Lane 1 (which calls `send`) -> works cleanly & renders in Lane 2's own mini-browser
  await f.state.tableHeadRowAddButton.listeners.click()
  const lane2 = f.state.lanes[1]
  const nb2 = lane2.notebook
  const out2 = nb2['output-view']
  assert.equal(out2.element.hidden, true)
  await nb2['insert-import'](0, { alias: 'lbl', laneId: lane1.id, path: ['serverLabel'] })
  nb2.rows[1]['input-el'].value = "; send ( ; to p !document.createElement p, ; to text ; add 'Imported: ' $lbl, ; set $text p.textContent, $p )"
  await nb2.rows[1]['input-el'].listeners.input()
  assert.equal(out2.element.hidden, false)
  assert.equal(out2['inline-host'].debugOutputEl.children.length, 1)
  assert.equal(out2['inline-host'].debugOutputEl.children[0].textContent, 'Imported: Launch')

  // Reload entire app -> persisted sent scripts restore & auto-render Lane Output below both lanes
  const fReload = field({
   console: { log() {} },
   createIdleTracker,
   data: createMockKV(),
   defaultValueForType,
   document: {
    body: createMockElement('body'),
    defaultView: mockWindow,
    createElement: createMockElement,
   },
   formatImportLine,
   hasImportCycle,
   normalizePrimitiveType,
   parseImportLine,
   ...DATA_RUNTIME_ENV,
   primitiveTypes: PRIMITIVE_TYPES,
   resolveImportValue,
   resolveScopeColumns,
   runLines,
   runTransportedScripts,
  })
  await fReload.run(parse(mainSource, '/src/main.fs'))
  const reloadedOut1 = fReload.state.lanes[0].notebook['output-view']
  assert.equal(reloadedOut1.element.hidden, false)
  assert.equal(reloadedOut1['inline-host'].debugOutputEl.children.length, 2)
  assert.equal(reloadedOut1['inline-host'].debugOutputEl.children[0].tag, 'h1')
  assert.equal(reloadedOut1['inline-host'].debugOutputEl.children[0].textContent, 'Hello from FieldScript')

  // Removing all `send` lines hides Lane Output again
  const reloadedNb1 = fReload.state.lanes[0].notebook
  await reloadedNb1.rows[2]['remove-btn'].listeners.click()
  await reloadedNb1.rows[0]['remove-btn'].listeners.click()
  assert.equal(reloadedOut1.element.hidden, true)
  assert.equal(reloadedOut1['viewport-el'].children.length, 0)
  assert.equal(reloadedOut1['iframe-el'], null)
 }
 finally {
  globalThis.fetch = origFetch
 }
})

test('whole-lane import without picking a scope value powers a reactive Profile Viewer lane', async () => {
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

 // Unit check: resolveImportValue with empty path extracts clean lane scope exports without runtime globals
 const wholeExports = resolveImportValue(
  {
   ok: true,
   state: {
    console: { log() {} },
    data: { get() {} },
    Math,
    JSON,
    Date,
    importLane() {},
    firstName: 'Nate',
    lastName: 'Ferrero',
    balance: 234.55,
   },
   error: null,
  },
  []
 )
 assert.deepEqual(wholeExports, { firstName: 'Nate', lastName: 'Ferrero', balance: 234.55 })

 // formatImportLine / parseImportLine round-trip whole-lane imports (empty path)
 const wholeSpec = { alias: 'profile', laneId: 'c84ce788-c3a1-4b13-a308-c265a7a7b28b', path: [] }
 const wholeLine = formatImportLine(wholeSpec)
 assert.equal(wholeLine, '; to profile !importLane c84ce788-c3a1-4b13-a308-c265a7a7b28b')
 assert.deepEqual(parseImportLine(wholeLine), wholeSpec)

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
   focused: false,
   removed: false,
   scrollWidth: 0,
   scrollLeft: 0,
   setAttribute(name, value) {
    this.attributes[name] = value
   },
   appendChild(child) {
    this.children.push(child)
    return child
   },
   insertBefore(child, ref) {
    const idx = this.children.indexOf(ref)
    if (idx === -1) { this.children.push(child) }
    else { this.children.splice(idx, 0, child) }
    return child
   },
   addEventListener(event, handler) {
    this.listeners[event] = handler
   },
   focus() {
    this.focused = true
   },
   remove() {
    this.removed = true
   },
  }
 }

 const kv = new Map()
 function createMockKV(prefix = '') {
  const qualify = key => (prefix ? `${prefix}.${key}` : key)
  return {
   namespace(name) { return createMockKV(qualify(name)) },
   async get(key) { return kv.has(qualify(key)) ? kv.get(qualify(key)) : null },
   async set(key, value) { kv.set(qualify(key), value) },
  }
 }

 let uuid = 0
 const mockWindow = {
  Array,
  Boolean,
  Date,
  JSON,
  Math,
  Object,
  Reflect,
  decodeURIComponent,
  crypto: { randomUUID: () => `pv-uuid-${++uuid}` },
  history: { pushState(_s, _t, url) { mockWindow.location.pathname = url } },
  location: { pathname: '/' },
  addEventListener() {},
 }
 const mockDocument = {
  body: createMockElement('body'),
  defaultView: mockWindow,
  createElement: createMockElement,
 }

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
   console: { log() {} },
   createIdleTracker,
   data: createMockKV(),
   defaultValueForType,
   document: mockDocument,
   formatImportLine,
   hasImportCycle,
   normalizePrimitiveType,
   parseImportLine,
   ...DATA_RUNTIME_ENV,
   primitiveTypes: PRIMITIVE_TYPES,
   resolveImportValue,
   resolveScopeColumns,
   runLines,
   runTransportedScripts,
  })
  await f.run(parse(mainSource, '/src/main.fs'))

  // 1. Ledger lane
  await f.state.tableHeadRowAddButton.listeners.click()
  const ledger = f.state.lanes[0]
  await f.state['lane-control'].rename(ledger.id, 'Ledger')
  ledger.notebook.rows[0]['input-el'].value = '; to balance 234.55'
  await ledger.notebook.rows[0]['input-el'].listeners.input()

  // 2. Profile lane (imports balance from Ledger)
  await f.state.tableHeadRowAddButton.listeners.click()
  const profile = f.state.lanes[1]
  await f.state['lane-control'].rename(profile.id, 'Profile')
  const pNb = profile.notebook
  pNb.rows[0]['input-el'].value = "; to firstName 'Nate'"
  await pNb.rows[0]['input-el'].listeners.input()
  await pNb['add-btn'].listeners.click()
  pNb.rows[1]['input-el'].value = "; to lastName 'Ferrero'"
  await pNb.rows[1]['input-el'].listeners.input()
  await pNb['add-btn'].listeners.click()
  pNb.rows[2]['input-el'].value = "; to name ; add $firstName ; add ' ' $lastName"
  await pNb.rows[2]['input-el'].listeners.input()
  await pNb['add-btn'].listeners.click()
  pNb.rows[3]['input-el'].value = "; to template 'Hello, '"
  await pNb.rows[3]['input-el'].listeners.input()
  await pNb['add-btn'].listeners.click()
  pNb.rows[4]['input-el'].value = '; to greet ; add $template $name'
  await pNb.rows[4]['input-el'].listeners.input()
  await pNb['insert-import'](5, { alias: 'balance', laneId: ledger.id, path: ['balance'] })

  // 3. Profile Viewer lane -> uses `+ Import` modal to import Profile as a whole lane WITHOUT picking a scope value
  await f.state.tableHeadRowAddButton.listeners.click()
  const viewer = f.state.lanes[2]
  await f.state['lane-control'].rename(viewer.id, 'Profile Viewer')
  const vNb = viewer.notebook
  await vNb['add-import-btn'].listeners.click()
  const importModal = f.state['lane-control']['import-modal']
  assert.equal(importModal['is-open'], true)

  // Click Profile lane button in modal and confirm IMMEDIATELY without clicking any scope property
  const profileBtn = importModal['lane-items'].find(item => item.id === profile.id)
  assert.ok(profileBtn)
  await profileBtn.el.listeners.click()
  assert.equal(importModal['confirm-btn'].disabled, false)
  assert.equal(importModal['alias-input'].value, 'profile')
  assert.equal(importModal['summary-el'].textContent, 'Profile · (whole lane)')

  // Confirming a property then clicking "Whole lane" resets cleanly back to whole-lane mode
  const nameItem = importModal['scope-view'].columns[0].items.find(i => i.key === 'name')
  await nameItem.el.listeners.click()
  assert.equal(importModal['summary-el'].textContent, 'Profile · $name')
  assert.equal(importModal['alias-input'].value, 'name')
  await importModal['whole-lane-btn'].listeners.click()
  assert.equal(importModal['summary-el'].textContent, 'Profile · (whole lane)')
  assert.equal(importModal['alias-input'].value, 'profile')

  await importModal.form.listeners.submit({ preventDefault() {} })
  assert.equal(importModal['is-open'], false)
  const importRow = vNb.rows[1]
  assert.equal(importRow['alias-el'].value, 'profile')
  assert.equal(importRow['pick-btn'].textContent, 'Profile · (lane)')
  assert.equal(vNb.lines[1], `; to profile !importLane ${profile.id}`)
  assert.deepEqual(vNb.state.profile, {
   firstName: 'Nate',
   lastName: 'Ferrero',
   name: 'Nate Ferrero',
   template: 'Hello, ',
   greet: 'Hello, Nate Ferrero',
   balance: 234.55,
  })

  // Render Profile card in Lane Output using code transport
  await vNb.rows[0]['remove-btn'].listeners.click()
  await vNb['add-btn'].listeners.click()
  vNb.rows[1]['input-el'].value = "; to formattedBalance [ match { $profile.balance.toFixed : ; add '$' !profile.balance.toFixed 2 } { true : '$0.00' } ]"
  await vNb.rows[1]['input-el'].listeners.input()
  await vNb['add-btn'].listeners.click()
  vNb.rows[2]['input-el'].value = "; to initials ; add [ match { $profile.firstName.slice : !profile.firstName.slice 0 1 } { true : '' } ] [ match { $profile.lastName.slice : !profile.lastName.slice 0 1 } { true : '' } ]"
  await vNb.rows[2]['input-el'].listeners.input()
  await vNb['add-btn'].listeners.click()
  vNb.rows[3]['input-el'].value = "; send ( ; to card !document.createElement div, ; to title !document.createElement h2, ; set $profile.name title.textContent, ; to sub !document.createElement p, ; set $profile.greet sub.textContent, ; to bal !document.createElement span, ; set $formattedBalance bal.textContent, ; to av !document.createElement span, ; set $initials av.textContent, !card.appendChild $av, !card.appendChild $title, !card.appendChild $sub, !card.appendChild $bal, $card )"
  await vNb.rows[3]['input-el'].listeners.input()

  const outView = vNb['output-view']
  assert.equal(outView.element.hidden, false)
  assert.equal(outView['errors-el'].hidden, true)
  assert.equal(outView['iframe-el'].attributes.sandbox, 'allow-scripts')
  const card = outView['inline-host'].debugOutputEl.children[0]
  assert.equal(card.children[0].textContent, 'NF')
  assert.equal(card.children[1].textContent, 'Nate Ferrero')
  assert.equal(card.children[2].textContent, 'Hello, Nate Ferrero')
  assert.equal(card.children[3].textContent, '$234.55')

  // Reactive cascade: editing Ledger balance automatically updates Profile -> Profile Viewer -> Lane Output!
  ledger.notebook.rows[0]['input-el'].value = '; to balance 500'
  await ledger.notebook.rows[0]['input-el'].listeners.input()
  const updatedCard = outView['inline-host'].debugOutputEl.children[0]
  assert.equal(updatedCard.children[3].textContent, '$500.00')
 }
 finally {
  globalThis.fetch = origFetch
 }
})

test('Lane tab route helpers parse and format ;tab segments including encoded %3B and home Source', () => {
 assert.deepEqual(LANE_TABS, ['story', 'source', 'input', 'scope', 'data', 'view', 'server'])
 assert.equal(DEFAULT_LANE_TAB, 'source')
 assert.equal(normalizeLaneTab('story'), 'story')
 assert.equal(normalizeLaneTab('STORY'), 'story')
 assert.equal(normalizeLaneTab('data'), 'data')
 assert.equal(normalizeLaneTab('VIEW'), 'view')
 assert.equal(normalizeLaneTab('SERVER'), 'server')
 assert.equal(normalizeLaneTab('unknown'), 'source')
 assert.equal(normalizeLaneTab(undefined), 'source')

 const id = 'e9f68d51-60f9-4f2a-af09-31a2cdbf0b36'
 assert.equal(formatLaneRouteSegment(id, 'source'), id)
 assert.equal(formatLaneRouteSegment(id, 'story'), `${id};story`)
 assert.equal(formatLaneRouteSegment(id, 'data'), `${id};data`)
 assert.equal(formatLaneRouteSegment(id, 'view'), `${id};view`)
 assert.equal(formatLaneRouteSegment(id, 'server'), `${id};server`)
 assert.equal(formatLaneRouteSegment(id, 'input'), `${id};input`)
 assert.equal(formatLaneRouteSegment(id, 'scope'), `${id};scope`)
 assert.equal(formatLaneRouteSegment('lane;1', 'data'), 'lane%3B1;data')
 assert.equal(formatLaneRouteSegment('lane;1', 'source'), 'lane%3B1')

 assert.deepEqual(parseLaneRouteSegment(id), { id, tab: 'source' })
 assert.deepEqual(parseLaneRouteSegment(`${id};story`), { id, tab: 'story' })
 assert.deepEqual(parseLaneRouteSegment(`${id};data`), { id, tab: 'data' })
 assert.deepEqual(parseLaneRouteSegment(`${id};view`), { id, tab: 'view' })
 assert.deepEqual(parseLaneRouteSegment(`${id};server`), { id, tab: 'server' })
 assert.deepEqual(parseLaneRouteSegment(`${id};source`), { id, tab: 'source' })
 assert.deepEqual(parseLaneRouteSegment(`${id};DATA`), { id, tab: 'data' })
 assert.deepEqual(parseLaneRouteSegment(`${id};bogus`), { id, tab: 'source' })
 assert.deepEqual(parseLaneRouteSegment(`${id}%3Bdata`), { id, tab: 'data' })
 assert.deepEqual(parseLaneRouteSegment(`${id}%3bview`), { id, tab: 'view' })
 assert.deepEqual(parseLaneRouteSegment('lane%3B1;data'), { id: 'lane;1', tab: 'data' })
 assert.deepEqual(parseLaneRouteSegment('lane%3B1'), { id: 'lane;1', tab: 'source' })

 assert.deepEqual(
  parseLaneRoutes(`/${id};data/other-lane;view/third-lane`),
  [
   { id, tab: 'data' },
   { id: 'other-lane', tab: 'view' },
   { id: 'third-lane', tab: 'source' },
  ]
 )
 assert.equal(
  formatLaneRoutes([
   { id, notebook: { 'active-tab': 'data' } },
   { id: 'other-lane', notebook: { 'active-tab': 'view' } },
   { id: 'third-lane', notebook: { 'active-tab': 'source' } },
  ]),
  `/${id};data/other-lane;view/third-lane`
 )
 assert.equal(formatLaneRoutes([]), '/')
})

test('Lane tab routing syncs URL on tab click, supports direct URL and popstate, and View hides Source to show only output browser', async () => {
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
   scrollWidth: 0,
   scrollLeft: 0,
   setAttribute(name, value) {
    this.attributes[name] = value
   },
   appendChild(child) {
    this.children.push(child)
    return child
   },
   insertBefore(child, ref) {
    const idx = this.children.indexOf(ref)
    if (idx === -1) { this.children.push(child) }
    else { this.children.splice(idx, 0, child) }
    return child
   },
   addEventListener(event, handler) {
    this.listeners[event] = handler
   },
   focus() {
    this.focused = true
   },
   select() {},
   remove() {
    this.removed = true
   },
  }
 }

 const kv = new Map()
 function createMockKV(prefix = '') {
  const qualify = key => (prefix ? `${prefix}.${key}` : key)
  return {
   namespace(name) { return createMockKV(qualify(name)) },
   async get(key) { return kv.has(qualify(key)) ? kv.get(qualify(key)) : null },
   async set(key, value) { kv.set(qualify(key), value) },
  }
 }

 const laneId = 'e9f68d51-60f9-4f2a-af09-31a2cdbf0b36'
 const secondId = 'b1c2d3e4-1111-2222-3333-444455556666'
 const uuids = [laneId, secondId]
 let uuidIdx = 0
 const pushedUrls = []
 const windowListeners = {}
 const dispatchWindowEvent = async (event, ev) => {
  for (const handler of windowListeners[event] || []) {
   await handler(ev)
  }
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
  crypto: { randomUUID: () => uuids[uuidIdx++] },
  history: {
   pushState(_s, _t, url) {
    pushedUrls.push(url)
    mockWindow.location.pathname = url
   },
  },
  location: { pathname: '/' },
  addEventListener(event, handler) {
   windowListeners[event] ||= []
   windowListeners[event].push(handler)
  },
 }

 let runCount = 0
 const countedRunLines = async (lines, opts) => {
  runCount += 1
  return runLines(lines, opts)
 }

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
  const makeRuntime = () => field({
   ...DATA_RUNTIME_ENV,
   console: { log() {} },
   createIdleTracker,
   data: createMockKV(),
   defaultValueForType,
   document: {
    body: createMockElement('body'),
    defaultView: mockWindow,
    createElement: createMockElement,
   },
   formatImportLine,
   hasImportCycle,
   normalizePrimitiveType,
   parseImportLine,
   primitiveTypes: PRIMITIVE_TYPES,
   resolveImportValue,
   resolveScopeColumns,
   createSourceWorkerRunner: opts => createSourceWorkerRunner({ ...opts, onRun: () => { runCount += 1 } }),
   runLines: countedRunLines,
   runTransportedScripts,
  })

  const f = makeRuntime()
  await f.run(parse(mainSource, '/src/main.fs'))

  // Add lane -> home tab is Source, URL is /<id>
  await f.state.tableHeadRowAddButton.listeners.click()
  const lane1 = f.state.lanes[0]
  const nb1 = lane1.notebook
  const out1 = nb1['output-view']
  assert.equal(mockWindow.location.pathname, `/${laneId}`)
  assert.equal(nb1['active-tab'], 'source')
  assert.equal(nb1.tabs.view.textContent, 'View')
  assert.equal(out1.element.hidden, true)

  // Click Data tab -> URL becomes /<id>;data
  await nb1.tabs.data.listeners.click()
  assert.equal(nb1['active-tab'], 'data')
  assert.equal(mockWindow.location.pathname, `/${laneId};data`)
  const pushCountAfterData = pushedUrls.length
  // Clicking already-active Data tab does not push duplicate history entry
  await nb1.tabs.data.listeners.click()
  assert.equal(pushedUrls.length, pushCountAfterData)

  // Click Input -> /<id>;input, Scope -> /<id>;scope, Source (home) -> /<id>
  await nb1.tabs.input.listeners.click()
  assert.equal(mockWindow.location.pathname, `/${laneId};input`)
  await nb1.tabs.scope.listeners.click()
  assert.equal(mockWindow.location.pathname, `/${laneId};scope`)
  await nb1.tabs.source.listeners.click()
  assert.equal(mockWindow.location.pathname, `/${laneId}`)

  // Click View with no send packets -> hides Source/Input/Scope/Data and shows output browser with empty state
  await nb1.tabs.view.listeners.click()
  assert.equal(nb1['active-tab'], 'view')
  assert.equal(mockWindow.location.pathname, `/${laneId};view`)
  assert.equal(nb1['source-panel'].hidden, true)
  assert.equal(nb1['input-panel'].hidden, true)
  assert.equal(nb1['scope-panel'].hidden, true)
  assert.equal(nb1['data-panel'].hidden, true)
  assert.equal(out1.element.hidden, false)
  assert.equal(out1['empty-el'].hidden, false)
  assert.equal(out1['viewport-el'].hidden, true)
  assert.match(out1.element.className, /lane-output--view/)

  // Switch back to Source -> output browser hides again (0 packets), add a send script
  await nb1.tabs.source.listeners.click()
  assert.equal(mockWindow.location.pathname, `/${laneId}`)
  assert.equal(out1.element.hidden, true)
  nb1.rows[0]['input-el'].value = "; send ( ; to h !document.createElement h2, ; set 'Hello View' h.textContent, $h )"
  await nb1.rows[0]['input-el'].listeners.input()
  assert.equal(out1.element.hidden, false)
  assert.equal(out1['inline-host'].debugOutputEl.children[0].textContent, 'Hello View')

  // Switch to View -> hides Source and shows ONLY the output browser with rendered DOM
  await nb1.tabs.view.listeners.click()
  assert.equal(mockWindow.location.pathname, `/${laneId};view`)
  assert.equal(nb1['source-panel'].hidden, true)
  assert.equal(nb1['input-panel'].hidden, true)
  assert.equal(nb1['scope-panel'].hidden, true)
  assert.equal(nb1['data-panel'].hidden, true)
  assert.equal(out1.element.hidden, false)
  assert.equal(out1['empty-el'].hidden, true)
  assert.equal(out1['viewport-el'].hidden, false)
  assert.equal(out1['inline-host'].debugOutputEl.children[0].textContent, 'Hello View')

  // Add second lane -> URL preserves Lane 1's ;view and adds Lane 2 on home Source
  await f.state.tableHeadRowAddButton.listeners.click()
  assert.equal(mockWindow.location.pathname, `/${laneId};view/${secondId}`)
  await f.state.lanes[1].notebook.tabs.data.listeners.click()
  assert.equal(mockWindow.location.pathname, `/${laneId};view/${secondId};data`)

  // Reload directly on /<laneId>;view/<secondId>;data ->
  // Lane 1 mounts on View (runs Source & renders output browser, Source hidden)
  // Lane 2 mounts on Data (does NOT run Source)
  const runsBeforeReload = runCount
  const fReload = makeRuntime()
  await fReload.run(parse(mainSource, '/src/main.fs'))
  assert.equal(runCount, runsBeforeReload + 1)
  const rl1 = fReload.state.lanes[0]
  const rl2 = fReload.state.lanes[1]
  assert.equal(rl1.id, laneId)
  assert.equal(rl1.notebook['active-tab'], 'view')
  assert.equal(rl1.notebook['source-panel'].hidden, true)
  assert.equal(rl1.notebook['output-view'].element.hidden, false)
  assert.equal(rl1.notebook['output-view']['inline-host'].debugOutputEl.children[0].textContent, 'Hello View')
  assert.equal(rl2.id, secondId)
  assert.equal(rl2.notebook['active-tab'], 'data')
  assert.equal(rl2.notebook['data-panel'].hidden, false)
  assert.equal(rl2.notebook['source-panel'].hidden, true)

  // Navigating via popstate (e.g. encoded %3Bdata -> home Source) syncs active tabs cleanly
  mockWindow.location.pathname = `/${laneId}%3Bdata/${secondId}`
  await dispatchWindowEvent('popstate', {})
  assert.equal(fReload.state.lanes[0].notebook['active-tab'], 'data')
  assert.equal(fReload.state.lanes[0].notebook['data-panel'].hidden, false)
  assert.equal(fReload.state.lanes[1].notebook['active-tab'], 'source')
  assert.equal(fReload.state.lanes[1].notebook['source-panel'].hidden, false)
 }
 finally {
  globalThis.fetch = origFetch
 }
})

test('Lane header reload button reloads entire lane from server KV while keeping selected tab and column order', async () => {
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
   setAttribute(name, value) { this.attributes[name] = value },
   appendChild(child) { this.children.push(child); return child },
   insertBefore(child, ref) {
    const idx = this.children.indexOf(ref)
    if (idx === -1) { this.children.push(child) }
    else { this.children.splice(idx, 0, child) }
    return child
   },
   replaceChildren(...nodes) { this.children = nodes },
   addEventListener(event, handler) { this.listeners[event] = handler },
   focus() {},
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
  }
 }

 let uuid = 0
 const mockWindow = {
  Array,
  Boolean,
  Date,
  JSON,
  Math,
  Object,
  Reflect,
  decodeURIComponent,
  crypto: { randomUUID: () => `rel-uuid-${++uuid}` },
  history: { pushState(_s, _t, url) { mockWindow.location.pathname = url } },
  location: { pathname: '/' },
  addEventListener() {},
 }

 let runCount = 0
 const countedRunLines = async (lines, opts) => {
  runCount += 1
  return runLines(lines, opts)
 }

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
   document: {
    body: createMockElement('body'),
    defaultView: mockWindow,
    createElement: createMockElement,
   },
   formatImportLine,
   hasImportCycle,
   normalizePrimitiveType,
   parseImportLine,
   primitiveTypes: PRIMITIVE_TYPES,
   resolveImportValue,
   resolveScopeColumns,
   createSourceWorkerRunner: opts => createSourceWorkerRunner({ ...opts, onRun: () => { runCount += 1 } }),
   runLines: countedRunLines,
   runTransportedScripts,
  })

  await f.run(parse(mainSource, '/src/main.fs'))
  await f.state.tableHeadRowAddButton.listeners.click()
  await f.state.tableHeadRowAddButton.listeners.click()
  const lane1 = f.state.lanes[0]
  const lane2 = f.state.lanes[1]

  // Verify copy, minimize, reload, fullscreen, and close buttons on the right of header
  const headerTop = lane1.element.children[0]
  assert.equal(headerTop.children[2], lane1['copy-info-btn'])
  assert.equal(headerTop.children[3], lane1['min-left-btn'])
  assert.equal(headerTop.children[4], lane1['min-right-btn'])
  assert.equal(headerTop.children[5], lane1['reload-btn'])
  assert.equal(headerTop.children[6], lane1['fullscreen-btn'])
  assert.equal(headerTop.children[7], lane1['close-btn'])

  // Switch lane1 to Data tab, then simulate server-side KV updates to title & tables
  await lane1.notebook.tabs.data.listeners.click()
  assert.equal(mockWindow.location.pathname, `/${lane1.id};data/${lane2.id}`)
  kv.set(`${lane1.id}.title`, 'Server Ledger')
  kv.set(`${lane1.id}.tables`, JSON.stringify([
   {
    id: 'tbl-srv',
    name: 'accounts',
    columns: [{ id: 'c1', name: 'balance', type: 'fixed', multiple: false, decimals: 2 }],
    rows: [{ id: 'r1', values: { c1: 9999 } }],
   },
  ]))

  const runsBeforeDataReload = runCount
  await lane1['reload-btn'].listeners.click()
  // Keeps position (index 0), keeps Data tab & URL, picks up fresh title & tables, skips Source run
  assert.equal(f.state.lanes[0], lane1)
  assert.equal(f.state.lanes[1], lane2)
  assert.equal(lane1.title, 'Server Ledger')
  assert.equal(lane1['title-el'].textContent, 'Server Ledger')
  assert.equal(lane1.notebook['active-tab'], 'data')
  assert.equal(lane1.notebook['data-panel'].hidden, false)
  assert.equal(lane1.notebook['source-panel'].hidden, true)
  assert.equal(lane1.notebook['data-view'].tables[0].name, 'accounts')
  assert.equal(lane1.notebook['data-view']['grid-rows'][0].cells[0]['input-el'].value, '99.99')
  assert.equal(runCount, runsBeforeDataReload)
  assert.equal(mockWindow.location.pathname, `/${lane1.id};data/${lane2.id}`)

  // Switch lane1 to View tab, then simulate server-side script update -> reload keeps View and renders fresh DOM
  await lane1.notebook.tabs.view.listeners.click()
  assert.equal(mockWindow.location.pathname, `/${lane1.id};view/${lane2.id}`)
  kv.set(`${lane1.id}.script`, JSON.stringify([
   "; send ( ; to p !document.createElement p, ; set 'Updated from Server' p.textContent, $p )",
  ]))
  await lane1['reload-btn'].listeners.click()
  assert.equal(lane1.notebook['active-tab'], 'view')
  assert.equal(lane1.notebook['source-panel'].hidden, true)
  assert.equal(lane1.notebook['output-view'].element.hidden, false)
  assert.equal(lane1.notebook['output-view']['inline-host'].debugOutputEl.children[0].textContent, 'Updated from Server')
  assert.equal(mockWindow.location.pathname, `/${lane1.id};view/${lane2.id}`)

  // Switch lane1 to Source tab, update script on server -> reload keeps Source and evaluates fresh lines
  await lane1.notebook.tabs.source.listeners.click()
  kv.set(`${lane1.id}.script`, JSON.stringify(['; add 40 2']))
  await lane1['reload-btn'].listeners.click()
  assert.equal(lane1.notebook['active-tab'], 'source')
  assert.equal(lane1.notebook['source-panel'].hidden, false)
  assert.equal(lane1.notebook.rows[0]['preview-el'].textContent, '42')
 }
 finally {
  globalThis.fetch = origFetch
 }
})

test('parseHashOptions and formatHashOptions parse and serialize compound hash options', () => {
 assert.deepEqual(parseHashOptions('#scroll.left=123'), { scroll: { left: 123 } })
 assert.deepEqual(parseHashOptions('scroll.left=123&scroll.top=45&view.zoom=1.5&flag=true&empty=false&none=null&label=hello%20world'), {
  scroll: { left: 123, top: 45 },
  view: { zoom: 1.5 },
  flag: true,
  empty: false,
  none: null,
  label: 'hello world',
 })
 assert.deepEqual(parseHashOptions('#bareFlag'), { bareFlag: true })
 assert.deepEqual(parseHashOptions(''), {})
 assert.deepEqual(parseHashOptions('#'), {})
 assert.deepEqual(parseHashOptions(null), {})
 // Prototype-pollution keys are ignored
 assert.deepEqual(parseHashOptions('#__proto__.polluted=1&constructor.x=2&scroll.left=50'), { scroll: { left: 50 } })
 assert.equal({}.polluted, undefined)

 assert.equal(formatHashOptions({ scroll: { left: 123 } }), '#scroll.left=123')
 assert.equal(formatHashOptions({ scroll: { left: 123, top: 45 }, view: { zoom: 1.5 } }), '#scroll.left=123&scroll.top=45&view.zoom=1.5')
 assert.equal(formatHashOptions({ scroll: { left: undefined }, view: {} }), '')
 assert.equal(formatHashOptions({}), '')
})

test('main.fs persists horizontal scroll in location.hash via replaceState and restores on refresh', async () => {
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
  const listeners = {}
  const attributes = {}
  const element = {
   tagName: tag.toUpperCase(),
   style: {},
   className: '',
   textContent: '',
   value: '',
   checked: false,
   hidden: false,
   children: [],
   parentNode: null,
   listeners,
   attributes,
   classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
   setAttribute(name, val) { attributes[name] = String(val) },
   removeAttribute(name) { delete attributes[name] },
   appendChild(child) {
    if (child.parentNode) {
     const idx = child.parentNode.children.indexOf(child)
     if (idx !== -1) child.parentNode.children.splice(idx, 1)
    }
    child.parentNode = element
    element.children.push(child)
    return child
   },
   replaceChildren(...nodes) {
    element.children = []
    for (const node of nodes) {
     node.parentNode = element
     element.children.push(node)
    }
   },
   remove() {
    if (!element.parentNode) return
    const idx = element.parentNode.children.indexOf(element)
    if (idx !== -1) element.parentNode.children.splice(idx, 1)
    element.parentNode = null
   },
   addEventListener(event, handler) {
    listeners[event] ||= []
    listeners[event].push(handler)
   },
   focus() {},
   select() {},
  }
  return element
 }

 const kv = new Map()
 const mockKV = {
  async get(key) {
   const raw = kv.get(`root:${key}`)
   return raw === undefined ? null : JSON.parse(raw)
  },
  async set(key, value) {
   kv.set(`root:${key}`, JSON.stringify(value))
  },
  namespace(prefix) {
   return {
    async get(key) {
     const raw = kv.get(`${prefix}:${key}`)
     return raw === undefined ? null : JSON.parse(raw)
    },
    async set(key, value) {
     kv.set(`${prefix}:${key}`, JSON.stringify(value))
    },
   }
  },
 }

 let uuidCounter = 0
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

 function makeMockBrowser(initialPathname = '/', initialHash = '') {
  const windowListeners = {}
  const pushedUrls = []
  const replacedUrls = []
  const scrollToCalls = []
  const timers = []
  let nextTimerId = 1
  const location = { pathname: initialPathname, search: '', hash: initialHash }
  function applyUrl(url) {
   const hashIdx = url.indexOf('#')
   if (hashIdx === -1) {
    location.pathname = url
    location.hash = ''
   }
   else {
    location.pathname = url.slice(0, hashIdx) || '/'
    location.hash = url.slice(hashIdx)
   }
  }
  const documentElement = { scrollLeft: 0 }
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
   innerWidth: 1000,
   scrollX: 0,
   scrollY: 0,
   crypto: { randomUUID: () => `scroll-uuid-${++uuidCounter}` },
   history: {
    pushState(_s, _t, url) {
     pushedUrls.push(url)
     applyUrl(url)
    },
    replaceState(_s, _t, url) {
     replacedUrls.push(url)
     applyUrl(url)
    },
   },
   location,
   scrollTo(x, y) {
    scrollToCalls.push([x, y])
    mockWindow.scrollX = x
    mockWindow.scrollY = y
   },
   setTimeout(fn, delay) {
    const id = nextTimerId++
    timers.push({ id, fn, delay, cleared: false })
    return id
   },
   clearTimeout(id) {
    const t = timers.find(item => item.id === id)
    if (t) t.cleared = true
   },
   addEventListener(event, handler) {
    windowListeners[event] ||= []
    windowListeners[event].push(handler)
   },
  }
  return {
   mockWindow,
   documentElement,
   windowListeners,
   pushedUrls,
   replacedUrls,
   scrollToCalls,
   timers,
   async dispatch(event) {
    for (const h of windowListeners[event] || []) {
     await h()
    }
   },
   async flushTimers(delay) {
    for (const t of [...timers]) {
     if (!t.cleared && (delay === undefined || t.delay === delay)) {
      t.cleared = true
      await t.fn()
     }
    }
   },
  }
 }

 try {
  const b1 = makeMockBrowser('/', '#view.zoom=2')
  const f1 = field({
   ...DATA_RUNTIME_ENV,
   console: { log() {} },
   createIdleTracker,
   data: mockKV,
   defaultValueForType,
   document: {
    body: createMockElement('body'),
    documentElement: b1.documentElement,
    defaultView: b1.mockWindow,
    createElement: createMockElement,
   },
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
  await f1.run(parse(mainSource, '/src/main.fs'))
  await f1.state.tableHeadRowAddButton.listeners.click[0]()
  assert.equal(b1.mockWindow.location.pathname, '/scroll-uuid-1')
  assert.equal(b1.mockWindow.location.hash, '#view.zoom=2')

  // Scrolling horizontally updates hash via replaceState (not pushState) and preserves existing options
  b1.mockWindow.scrollX = 123
  await b1.dispatch('scroll')
  await b1.flushTimers(100)
  assert.equal(b1.mockWindow.location.hash, '#view.zoom=2&scroll.left=123')
  assert.deepEqual(b1.replacedUrls, ['/scroll-uuid-1#view.zoom=2&scroll.left=123'])
  assert.deepEqual(b1.pushedUrls, ['/scroll-uuid-1#view.zoom=2'])

  // Switching tabs via update-url preserves the scroll hash
  await f1.state.lanes[0].notebook['set-tab']('data')
  assert.equal(b1.mockWindow.location.pathname, '/scroll-uuid-1;data')
  assert.equal(b1.mockWindow.location.hash, '#view.zoom=2&scroll.left=123')

  // Scrolling back to 0 removes scroll.left from hash while keeping other options
  b1.mockWindow.scrollX = 0
  await b1.dispatch('scroll')
  await b1.flushTimers(100)
  assert.equal(b1.mockWindow.location.hash, '#view.zoom=2')

  // Refreshing with #scroll.left=123 extends body.style.minWidth and scrolls immediately, then releases after 10s
  const b2 = makeMockBrowser('/scroll-uuid-1;data', '#scroll.left=123')
  const b2Body = createMockElement('body')
  const f2 = field({
   ...DATA_RUNTIME_ENV,
   console: { log() {} },
   createIdleTracker,
   data: mockKV,
   defaultValueForType,
   document: {
    body: b2Body,
    documentElement: b2.documentElement,
    defaultView: b2.mockWindow,
    createElement: createMockElement,
   },
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
  await f2.run(parse(mainSource, '/src/main.fs'))
  assert.equal(f2.state.lanes.length, 1)
  assert.equal(b2Body.style.minWidth, '1123px')
  assert.deepEqual(b2.scrollToCalls, [[123, 0]])
  assert.equal(b2.mockWindow.scrollX, 123)
  assert.equal(b2.documentElement.scrollLeft, 123)

  // After 10s, minWidth is released and if content is narrower (scrollX clamped to 40), hash updates to #scroll.left=40
  b2.mockWindow.scrollX = 40
  await b2.flushTimers(10000)
  assert.equal(b2Body.style.minWidth, '')
  assert.equal(b2.mockWindow.location.hash, '#scroll.left=40')
 }
 finally {
  globalThis.fetch = origFetch
 }
})

test('PWA manifest, Civil icon assets, index.html metadata, server MIME types, and service worker', async () => {
 const rootUrl = new URL('./', import.meta.url)

 // 1. Validate manifest.webmanifest structure and icon files on disk
 const manifestRaw = await fs.readFile(new URL('./manifest.webmanifest', rootUrl), 'utf8')
 const manifest = JSON.parse(manifestRaw)
 assert.equal(manifest.id, '/')
 assert.equal(manifest.name, 'Civil Command')
 assert.equal(manifest.short_name, 'Civil Command')
 assert.equal(manifest.start_url, '/')
 assert.equal(manifest.scope, '/')
 assert.equal(manifest.display, 'standalone')
 assert.equal(manifest.background_color, '#000000')
 assert.equal(manifest.theme_color, '#000000')
 assert.ok(Array.isArray(manifest.icons) && manifest.icons.length >= 4)

 const seenIconKeys = new Set()
 for (const icon of manifest.icons) {
  assert.ok(icon.src.startsWith('/'), `icon src should be root-relative: ${icon.src}`)
  const fileBuf = await fs.readFile(new URL(`.${icon.src}`, rootUrl))
  assert.ok(fileBuf.length > 0)
  if (icon.type === 'image/png') {
   // Verify PNG signature and IHDR width/height match declared sizes
   assert.deepEqual([...fileBuf.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10])
   const width = fileBuf.readUInt32BE(16)
   const height = fileBuf.readUInt32BE(20)
   assert.equal(`${width}x${height}`, icon.sizes, `PNG dimensions mismatch for ${icon.src}`)
  }
  else if (icon.type === 'image/svg+xml') {
   const svgText = fileBuf.toString('utf8')
   assert.ok(svgText.includes('<svg') && svgText.includes('viewBox="0 0 16 16"'))
  }
  seenIconKeys.add(`${icon.sizes}:${icon.purpose}`)
 }
 assert.ok(seenIconKeys.has('192x192:any'))
 assert.ok(seenIconKeys.has('512x512:any'))
 assert.ok(seenIconKeys.has('192x192:maskable'))
 assert.ok(seenIconKeys.has('512x512:maskable'))

 // Check favicon.ico and apple-touch-icon.png exist and have valid headers
 const icoBuf = await fs.readFile(new URL('./favicon.ico', rootUrl))
 assert.equal(icoBuf.readUInt16LE(0), 0)
 assert.equal(icoBuf.readUInt16LE(2), 1)
 const appleBuf = await fs.readFile(new URL('./icons/apple-touch-icon.png', rootUrl))
 assert.equal(appleBuf.readUInt32BE(16), 180)
 assert.equal(appleBuf.readUInt32BE(20), 180)

 // 2. Validate index.html PWA tags and SW registration
 const html = await fs.readFile(new URL('./index.html', rootUrl), 'utf8')
 assert.ok(html.includes('<title>Civil Command</title>'))
 assert.ok(html.includes('<meta name="theme-color" content="#000000">'))
 assert.ok(html.includes('<link rel="manifest" href="/manifest.webmanifest">'))
 assert.ok(html.includes('<link rel="icon" href="/favicon.ico"'))
 assert.ok(html.includes('<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png"'))
 assert.ok(html.includes("navigator.serviceWorker.register('/sw.js'"))

 // 3. Validate start server MIME types and sw.js no-cache header
 const startSource = await fs.readFile(new URL('./start', rootUrl), 'utf8')
 assert.ok(startSource.includes("'.webmanifest': 'application/manifest+json; charset=utf-8'"))
 assert.ok(startSource.includes("'.ico': 'image/x-icon'"))
 assert.ok(startSource.includes("'Cache-Control'] = 'no-cache'"))

 // 4. Validate sw.js precache entries, lifecycle, /api/data bypass, and offline fallback
 const swSource = await fs.readFile(new URL('./sw.js', rootUrl), 'utf8')
 const swListeners = {}
 const cacheStorage = new Map([['civil-command-v0', new Map()]])
 let skipWaitingCalled = false
 let clientsClaimCalled = false

 const makeCacheHandle = name => {
  if (!cacheStorage.has(name)) cacheStorage.set(name, new Map())
  const store = cacheStorage.get(name)
  return {
   async addAll(urls) {
    for (const u of urls) {
     if (u !== '/') {
      const stat = await fs.stat(new URL(`.${u}`, rootUrl))
      assert.ok(stat.isFile(), `APP_SHELL asset missing: ${u}`)
     }
     store.set(u, { ok: true, type: 'basic', url: u, body: `cached:${u}`, clone() { return { ...this } } })
    }
   },
   async put(req, res) {
    const key = typeof req === 'string' ? req : new URL(req.url).pathname
    store.set(key, res)
   },
   async match(req) {
    const key = typeof req === 'string' ? req : new URL(req.url).pathname
    return store.get(key)
   },
  }
 }

 const mockCaches = {
  async open(name) { return makeCacheHandle(name) },
  async keys() { return [...cacheStorage.keys()] },
  async delete(name) { return cacheStorage.delete(name) },
  async match(req) {
   const key = typeof req === 'string' ? req : new URL(req.url).pathname
   for (const store of cacheStorage.values()) {
    if (store.has(key)) return store.get(key)
   }
   return undefined
  },
 }

 let swFetchImpl = async () => { throw new Error('offline') }
 const mockSelf = {
  location: { origin: 'http://localhost:8080' },
  addEventListener(type, fn) { swListeners[type] = fn },
  skipWaiting() { skipWaitingCalled = true; return Promise.resolve() },
  clients: { claim() { clientsClaimCalled = true; return Promise.resolve() } },
 }

 const evalSw = new Function('self', 'caches', 'fetch', 'URL', swSource)
 evalSw(mockSelf, mockCaches, (...args) => swFetchImpl(...args), URL)

 // Install precaches all APP_SHELL files (including every src/*.fs file) and calls skipWaiting
 const waitPromises = []
 swListeners.install({ waitUntil: p => waitPromises.push(p) })
 await Promise.all(waitPromises)
 assert.equal(skipWaitingCalled, true)
 const srcFiles = (await fs.readdir(new URL('./src', rootUrl))).filter(f => f.endsWith('.fs'))
 const activeCache = cacheStorage.get('civil-command-v12')
 assert.ok(activeCache.has('/kv-config.mjs'), 'sw.js APP_SHELL should precache /kv-config.mjs')
 assert.ok(activeCache.has('/sandbox.mjs'), 'sw.js APP_SHELL should precache /sandbox.mjs')
 assert.ok(activeCache.has('/source-worker.mjs'), 'sw.js APP_SHELL should precache /source-worker.mjs')
 for (const f of srcFiles) {
  assert.ok(activeCache.has(`/src/${f}`), `sw.js APP_SHELL should precache /src/${f}`)
 }

 // Activate removes old civil-command-* cache and claims clients
 const activatePromises = []
 swListeners.activate({ waitUntil: p => activatePromises.push(p) })
 await Promise.all(activatePromises)
 assert.equal(clientsClaimCalled, true)
 assert.equal(cacheStorage.has('civil-command-v0'), false)
 assert.equal(cacheStorage.has('civil-command-v12'), true)

 // Fetch bypasses /api/data and non-GET requests
 let apiIntercepted = false
 swListeners.fetch({
  request: { method: 'GET', url: 'http://localhost:8080/api/data?mode=disk&key=lanes', mode: 'cors' },
  respondWith() { apiIntercepted = true },
 })
 assert.equal(apiIntercepted, false)

 let postIntercepted = false
 swListeners.fetch({
  request: { method: 'POST', url: 'http://localhost:8080/src/main.fs', mode: 'cors' },
  respondWith() { postIntercepted = true },
 })
 assert.equal(postIntercepted, false)

 // Offline navigation on deep lane URL falls back to cached /index.html
 let navPromise = null
 swListeners.fetch({
  request: { method: 'GET', url: 'http://localhost:8080/lane-1;data', mode: 'navigate' },
  respondWith(p) { navPromise = p },
 })
 const offlineNavRes = await navPromise
 assert.equal(offlineNavRes.body, 'cached:/index.html')

 // Online static asset fetch updates cache and returns live response
 swFetchImpl = async req => ({
  ok: true,
  type: 'basic',
  body: `live:${new URL(req.url).pathname}`,
  clone() { return { ...this } },
 })
 let assetPromise = null
 swListeners.fetch({
  request: { method: 'GET', url: 'http://localhost:8080/field.mjs', mode: 'cors' },
  respondWith(p) { assetPromise = p },
 })
 const liveAssetRes = await assetPromise
 assert.equal(liveAssetRes.body, 'live:/field.mjs')

 // Subsequent offline static asset fetch returns updated cached copy
 swFetchImpl = async () => { throw new Error('offline') }
 let offlineAssetPromise = null
 swListeners.fetch({
  request: { method: 'GET', url: 'http://localhost:8080/field.mjs', mode: 'cors' },
  respondWith(p) { offlineAssetPromise = p },
 })
 const cachedAssetRes = await offlineAssetPromise
 assert.equal(cachedAssetRes.body, 'live:/field.mjs')
})

test('Lane Source individual line editor supports multiline single-line storage, textarea conversion, and reload persistence', async () => {
 const indexHtml = await fs.readFile(new URL('./index.html', import.meta.url), 'utf8')
 const notebookSource = await fs.readFile(new URL('./src/lane-notebook.fs', import.meta.url), 'utf8')
 const inputsSource = await fs.readFile(new URL('./src/lane-inputs.fs', import.meta.url), 'utf8')
 const scopeSource = await fs.readFile(new URL('./src/lane-scope.fs', import.meta.url), 'utf8')
 const dataSource = await fs.readFile(new URL('./src/lane-data.fs', import.meta.url), 'utf8')
 const confirmModalSource = await fs.readFile(new URL('./src/confirm-modal.fs', import.meta.url), 'utf8')
 const rowPickerModalSource = await fs.readFile(new URL('./src/lane-row-picker-modal.fs', import.meta.url), 'utf8')
 const outputSource = await fs.readFile(new URL('./src/lane-output.fs', import.meta.url), 'utf8')

 // Verify key CSS rules in index.html
 assert.match(indexHtml, /\.lane-line-num--editable\s*\{[^}]*cursor:\s*pointer;/s)
 assert.match(indexHtml, /\.lane-line-num--editable:hover[^{]*\{[^}]*background:/s)
 assert.match(indexHtml, /\.lane-line-editor\s*\{[^}]*grid-column:\s*2\s*\/\s*4;[^}]*resize:\s*vertical;/s)
 assert.match(indexHtml, /\.lane-line--multiline\s+\.lane-line-preview\s*\{[^}]*align-self:\s*stretch;[^}]*min-height:\s*100%;/s)

 function createMockElement(tag) {
  const el = {
   tag,
   style: {},
   attributes: {},
   children: [],
   parentNode: null,
   listeners: {},
   textContent: '',
   value: '',
   className: '',
   title: '',
   disabled: false,
   rows: 1,
   focused: false,
   removed: false,
   selectionStart: null,
   selectionEnd: null,
   get scrollHeight() {
    if (this.tag !== 'textarea') { return 0 }
    const lineCount = Math.max(1, String(this.value ?? '').split('\n').length)
    return lineCount * 18 + 8
   },
   get offsetHeight() {
    return this.tag === 'textarea' ? this.scrollHeight + 2 : 24
   },
   get clientHeight() {
    return this.tag === 'textarea' ? this.scrollHeight : 22
   },
   setAttribute(name, value) {
    this.attributes[name] = value
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
   addEventListener(event, handler) {
    this.listeners[event] = handler
   },
   focus() {
    this.focused = true
   },
   setSelectionRange(start, end) {
    this.selectionStart = start
    this.selectionEnd = end
   },
   remove() {
    this.removed = true
    if (this.parentNode) {
     const idx = this.parentNode.children.indexOf(this)
     if (idx !== -1) { this.parentNode.children.splice(idx, 1) }
     this.parentNode = null
    }
   },
  }
  return el
 }

 const kv = new Map()
 const laneData = {
  async get(key) { return kv.has(key) ? kv.get(key) : null },
  async set(key, value) { kv.set(key, value) },
 }
 const mockWindow = { Array, Date, JSON, Math }
 const mockDocument = { createElement: createMockElement }

 const origFetch = globalThis.fetch
 globalThis.fetch = async url => {
  if (url === '/src/lane-inputs.fs') { return { text: async () => inputsSource } }
  if (url === '/src/lane-scope.fs') { return { text: async () => scopeSource } }
  if (url === '/src/lane-data.fs') { return { text: async () => dataSource } }
  if (url === '/src/confirm-modal.fs') { return { text: async () => confirmModalSource } }
  if (url === '/src/lane-row-picker-modal.fs') { return { text: async () => rowPickerModalSource } }
  if (url === '/src/lane-output.fs') { return { text: async () => outputSource } }
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

 async function mountNotebook() {
  const f = field({
   console: { log() {} },
   createIdleTracker,
   defaultValueForType,
   document: mockDocument,
   formatImportLine,
   normalizePrimitiveType,
   parseImportLine,
   ...DATA_RUNTIME_ENV,
   primitiveTypes: PRIMITIVE_TYPES,
   resolveImportValue,
   resolveScopeColumns,
   runLines,
   runTransportedScripts,
   window: mockWindow,
  })
  const notebookMod = await f.run(parse(notebookSource, '/src/lane-notebook.fs'))
  const container = createMockElement('td')
  const lane = { id: 'multiline-lane', data: laneData }
  return notebookMod.mount(lane, container)
 }

 try {
  const nb = await mountNotebook()
  const row0 = nb.rows[0]

  // Initially single-line <input> with clickable line number button
  assert.equal(row0['num-el'].tag, 'button')
  assert.equal(row0['num-el'].className, 'lane-line-num lane-line-num--editable')
  assert.equal(row0['input-el'].tag, 'input')
  assert.equal(row0['input-el'].disabled, false)
  assert.equal(row0['is-multiline'], false)
  assert.equal(row0['is-editing'], false)
  assert.equal(row0['editor-el'], null)

  // Click line number -> enters Edit individual line mode
  const oldInput = row0['input-el']
  await row0['num-el'].listeners.click()
  assert.equal(nb['editing-row'], row0)
  assert.equal(row0['is-editing'], true)
  assert.equal(row0['input-el'].disabled, true)
  assert.equal(row0['num-el'].className, 'lane-line-num lane-line-num--editable lane-line-num--active')
  assert.equal(row0.el.className, 'lane-line lane-line--editing')
  const editor = row0['editor-el']
  assert.ok(editor)
  assert.equal(editor.tag, 'textarea')
  assert.equal(editor.className, 'lane-line-editor')
  assert.equal(editor.focused, true)
  assert.equal(row0.el.children.at(-1), editor)
  assert.equal(editor.style.height, '28px')

  // Paste multiline FieldScript function into individual line editor -> stored in a single Source line
  const multilineScript = [
   '; to greet (',
   ' ; to { name } $argv',
   " ; add 'Hi ' $name",
   ')',
  ].join('\n')
  editor.value = multilineScript
  await editor.listeners.input()

  assert.equal(nb.lines.length, 1)
  assert.equal(nb.lines[0], multilineScript)
  assert.ok(!kv.has('script'))
  assert.ok(!kv.has('multiline-lane.script'))
  assert.ok(kv.has('lanes#multiline-lane/script-index'))
  const persistedMulti = await loadLaneScript(null, laneData, 'multiline-lane', mockWindow)
  assert.deepEqual(persistedMulti.records.map(r => r.text), [multilineScript])
  assert.ok(kv.has(scriptLineKey('multiline-lane', persistedMulti.records[0].id)))
  assert.equal(oldInput.removed, true)
  assert.equal(row0['is-multiline'], true)
  assert.equal(row0['input-el'].tag, 'textarea')
  assert.equal(row0['input-el'].className, 'lane-line-input lane-line-input--multiline')
  assert.equal(row0['input-el'].value, multilineScript)
  assert.equal(row0['input-el'].disabled, true)
  assert.equal(row0['input-el'].rows, 4)
  assert.equal(row0['input-el'].style.height, '82px')
  assert.equal(editor.rows, 4)
  assert.equal(editor.style.height, '82px')
  assert.equal(row0.el.className, 'lane-line lane-line--multiline lane-line--editing')
  assert.deepEqual(row0.el.children, [
   row0['num-el'],
   row0['input-el'],
   row0['preview-el'],
   row0['remove-btn'],
   row0['info-btn'],
   editor,
  ])
  assert.equal(row0['preview-el'].textContent, '[function]')
  assert.equal(typeof nb.state.greet, 'function')

  // Manually resizing editor taller is preserved when typing/deleting (autofit only expands, never shrinks)
  editor.style.height = '240px'
  editor.value = '; to a 1\n; to b 2'
  await editor.listeners.input()
  assert.equal(editor.style.height, '240px')
  assert.equal(editor.rows, 4)

  // Adding enough lines to exceed 240px expands the editor, and deleting lines afterwards does not shrink it
  editor.value = Array.from({ length: 16 }, (_, i) => `-- line ${i + 1}`).join('\n')
  await editor.listeners.input()
  assert.equal(editor.style.height, '298px')
  editor.value = multilineScript
  await editor.listeners.input()
  assert.equal(editor.style.height, '298px')

  // Click line number again -> exits Edit individual line mode; input re-enabled & stays <textarea>
  await row0['num-el'].listeners.click()
  assert.equal(nb['editing-row'], null)
  assert.equal(row0['is-editing'], false)
  assert.equal(row0['editor-el'], null)
  assert.equal(editor.removed, true)
  assert.equal(row0['input-el'].disabled, false)
  assert.equal(row0['input-el'].focused, true)
  assert.equal(row0['input-el'].tag, 'textarea')
  assert.equal(row0.el.className, 'lane-line lane-line--multiline')
  assert.equal(row0['num-el'].className, 'lane-line-num lane-line-num--editable')

  // Manually resizing inline multiline textarea taller is also preserved on input (expand-only)
  row0['input-el'].style.height = '320px'
  row0['input-el'].value = multilineScript
  await row0['input-el'].listeners.input()
  assert.equal(row0['input-el'].style.height, '320px')

  // Add second single-line row calling greet -> evaluates against multiline line 1
  await nb['add-line']('!greet Ada')
  assert.equal(nb.rows.length, 2)
  assert.equal(nb.rows[1]['input-el'].tag, 'input')
  assert.equal(nb.rows[1]['preview-el'].textContent, '"Hi Ada"')

  // Clicking line 2 opens line 2 editor; clicking line 1 switches editor from line 2 to line 1; Escape closes
  const row1 = nb.rows[1]
  await row1['num-el'].listeners.click()
  assert.equal(nb['editing-row'], row1)
  assert.equal(row1['input-el'].disabled, true)
  assert.equal(row0['input-el'].disabled, false)

  await row0['num-el'].listeners.click()
  assert.equal(nb['editing-row'], row0)
  assert.equal(row1['input-el'].disabled, false)
  assert.equal(row1['editor-el'], null)
  assert.equal(row0['input-el'].disabled, true)
  assert.equal(row0['editor-el'].value, multilineScript)

  let escPrevented = false
  await row0['editor-el'].listeners.keydown({
   key: 'Escape',
   preventDefault() { escPrevented = true },
  })
  assert.equal(escPrevented, true)
  assert.equal(nb['editing-row'], null)
  assert.equal(row0['input-el'].disabled, false)

  // Reload notebook from persisted KV -> line 1 renders immediately as <textarea>, line 2 as <input>
  const reloaded = await mountNotebook()
  assert.deepEqual(reloaded.lines, [multilineScript, '!greet Ada'])
  assert.equal(reloaded.rows[0]['is-multiline'], true)
  assert.equal(reloaded.rows[0]['input-el'].tag, 'textarea')
  assert.equal(reloaded.rows[0]['input-el'].value, multilineScript)
  assert.equal(reloaded.rows[0]['input-el'].rows, 4)
  assert.equal(reloaded.rows[0]['input-el'].style.height, '82px')
  assert.equal(reloaded.rows[0].el.className, 'lane-line lane-line--multiline')
  assert.equal(reloaded.rows[0]['preview-el'].textContent, '[function]')
  assert.equal(reloaded.rows[1]['is-multiline'], false)
  assert.equal(reloaded.rows[1]['input-el'].tag, 'input')
  assert.equal(reloaded.rows[1]['preview-el'].textContent, '"Hi Ada"')

  // Directly removing newlines from inline multiline <textarea> converts it back to <input>
  const inlineTa = reloaded.rows[0]['input-el']
  inlineTa.value = '; to single 42'
  inlineTa.selectionStart = 14
  inlineTa.selectionEnd = 14
  await inlineTa.listeners.input()
  assert.equal(inlineTa.removed, true)
  assert.equal(reloaded.rows[0]['is-multiline'], false)
  assert.equal(reloaded.rows[0]['input-el'].tag, 'input')
  assert.equal(reloaded.rows[0]['input-el'].value, '; to single 42')
  assert.equal(reloaded.rows[0]['input-el'].focused, true)
  assert.equal(reloaded.rows[0]['input-el'].selectionStart, 14)
  assert.equal(reloaded.rows[0]['input-el'].selectionEnd, 14)
  assert.equal(reloaded.rows[0].el.className, 'lane-line')
  assert.equal(reloaded.rows[0]['preview-el'].textContent, '42')

  // Removing a row while it is in Edit individual line mode clears editing-row cleanly
  await reloaded.rows[1]['num-el'].listeners.click()
  assert.equal(reloaded['editing-row'], reloaded.rows[1])
  await reloaded.rows[1]['remove-btn'].listeners.click()
  assert.equal(reloaded['editing-row'], null)
  assert.equal(reloaded.rows.length, 1)
 }
 finally {
  globalThis.fetch = origFetch
 }
})

test('Lane resizing: Width setting in gear modal, 100px min render clamp, no max width, horizontal scroll CSS, ew-resize boundary drag, and persistence', async () => {
 // 1. Unit checks for lane width helpers
 assert.equal(MIN_LANE_WIDTH, 100)
 assert.equal(normalizeLaneWidth(null), null)
 assert.equal(normalizeLaneWidth(undefined), null)
 assert.equal(normalizeLaneWidth(''), null)
 assert.equal(normalizeLaneWidth('   '), null)
 assert.equal(normalizeLaneWidth('abc'), null)
 assert.equal(normalizeLaneWidth(-20), null)
 assert.equal(normalizeLaneWidth('0'), 0)
 assert.equal(normalizeLaneWidth('50'), 50)
 assert.equal(normalizeLaneWidth('50px'), 50)
 assert.equal(normalizeLaneWidth('420.4px'), 420)
 assert.equal(normalizeLaneWidth('3500'), 3500)
 assert.equal(normalizeLaneWidth(10000), 10000)

 assert.equal(resolveLaneRenderedWidth(null), null)
 assert.equal(resolveLaneRenderedWidth(''), null)
 assert.equal(resolveLaneRenderedWidth(0), 100)
 assert.equal(resolveLaneRenderedWidth(50), 100)
 assert.equal(resolveLaneRenderedWidth('80px'), 100)
 assert.equal(resolveLaneRenderedWidth(100), 100)
 assert.equal(resolveLaneRenderedWidth(420), 420)
 assert.equal(resolveLaneRenderedWidth(3500), 3500)
 assert.equal(resolveLaneRenderedWidth(10000), 10000)

 // 2. Verify CSS rules in index.html
 const indexHtml = await fs.readFile(new URL('./index.html', import.meta.url), 'utf8')
 assert.match(indexHtml, /\.lane-resizer\s*\{[^}]*cursor:\s*ew-resize;/s)
 assert.match(indexHtml, /\.lane-header--sized\s*\{[^}]*min-width:\s*100px;/s)
 assert.match(indexHtml, /\.lane-body--sized\s*\{[^}]*min-width:\s*100px;/s)
 assert.match(indexHtml, /\.lane-body--sized\s*>\s*\.lane-notebook,\s*\.lane-body--sized\s*>\s*\.lane-output\s*\{[^}]*overflow-x:\s*auto;/s)
 assert.match(indexHtml, /\.lane-body--sized\s+\.lane-scope-columns,\s*\.lane-body--sized\s+\.lane-data-grid-wrap,\s*\.lane-body--sized\s+\.lane-story-scroller\s*\{[^}]*max-width:\s*100%;[^}]*width:\s*100%;/s)

 // 3. Full integration test with main.fs, lane-control.fs, and lane-config-modal.fs
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
  const props = {}
  const style = {
   setProperty(name, value) { props[name] = value; style[name] = value },
   removeProperty(name) { delete props[name]; delete style[name] },
   getPropertyValue(name) { return props[name] || '' },
  }
  return {
   tag,
   style,
   attributes: {},
   children: [],
   listeners: {},
   textContent: '',
   value: '',
   className: '',
   title: '',
   focused: false,
   removed: false,
   setAttribute(name, value) { this.attributes[name] = value },
   appendChild(child) {
    this.children.push(child)
    return child
   },
   insertBefore(child, ref) {
    const idx = this.children.indexOf(ref)
    if (idx === -1) { this.children.push(child) }
    else { this.children.splice(idx, 0, child) }
    return child
   },
   replaceChildren(...nodes) { this.children = nodes },
   addEventListener(event, handler) {
    this.listeners[event] ||= []
    this.listeners[event].push(handler)
   },
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
  }
 }

 let uuid = 0
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

 function createRuntime(initialPathname = '/') {
  const windowListeners = {}
  const location = { pathname: initialPathname, search: '', hash: '' }
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
   crypto: { randomUUID: () => `rw-uuid-${++uuid}` },
   history: {
    pushState(_s, _t, url) { location.pathname = url },
    replaceState(_s, _t, url) { location.pathname = url },
   },
   location,
   addEventListener(event, handler) {
    windowListeners[event] ||= []
    windowListeners[event].push(handler)
   },
   removeEventListener(event, handler) {
    const list = windowListeners[event]
    if (!list) { return }
    const idx = list.indexOf(handler)
    if (idx !== -1) { list.splice(idx, 1) }
   },
  }
  const body = createMockElement('body')
  const f = field({
   ...DATA_RUNTIME_ENV,
   console: { log() {} },
   createIdleTracker,
   data: createMockKV(),
   defaultValueForType,
   document: { body, defaultView: mockWindow, createElement: createMockElement },
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
  return {
   f,
   body,
   location,
   windowListeners,
   async dispatchWindow(event, ev) {
    for (const h of (windowListeners[event] || []).slice()) {
     await h(ev)
    }
   },
  }
 }

 try {
  const r1 = createRuntime('/')
  await r1.f.run(parse(mainSource, '/src/main.fs'))

  // Add two lanes side by side
  await r1.f.state.tableHeadRowAddButton.listeners.click[0]()
  await r1.f.state.tableHeadRowAddButton.listeners.click[0]()
  const lane1 = r1.f.state.lanes[0]
  const lane2 = r1.f.state.lanes[1]
  const configModal = r1.f.state['lane-control']['config-modal']

  assert.equal(lane1.width, null)
  assert.equal(lane1['rendered-width'], null)
  assert.equal(lane1['header-resizer'].className, 'lane-resizer')
  assert.equal(lane1['body-resizer'].className, 'lane-resizer')
  assert.equal(lane1.body.children[2], lane1['body-resizer'])

  // Open gear modal for Lane 1 -> set Width = "50" (narrower than 100px) alongside Title
  await lane1['config-btn'].listeners.click[0]()
  assert.equal(configModal['is-open'], true)
  assert.equal(configModal['width-input'].value, '')
  configModal['title-input'].value = 'Narrow Lane'
  configModal['width-input'].value = '50'
  await configModal.form.listeners.submit[0]({ preventDefault() {} })

  // Stored Width setting is 50, rendered width is clamped to 100px
  assert.equal(lane1.title, 'Narrow Lane')
  assert.equal(lane1.width, 50)
  assert.equal(lane1['rendered-width'], 100)
  assert.equal(kv.get(`${lane1.id}.width`), '50')
  assert.equal(lane1.element.className, 'lane-header lane-header--sized')
  assert.equal(lane1.element.style.width, '100px')
  assert.equal(lane1.element.style.minWidth, '100px')
  assert.equal(lane1.element.style.getPropertyValue('--lane-width'), '100px')
  assert.equal(lane1.body.className, 'lane-body lane-body--sized')
  assert.equal(lane1.body.style.width, '100px')
  assert.equal(lane1.body.style.getPropertyValue('--lane-width'), '100px')

  // Re-opening gear modal shows the preserved stored setting "50"
  await lane1['config-btn'].listeners.click[0]()
  assert.equal(configModal['width-input'].value, '50')

  // Set very large width "2800px" -> no maximum width
  configModal['width-input'].value = '2800px'
  await configModal.form.listeners.submit[0]({ preventDefault() {} })
  assert.equal(lane1.width, 2800)
  assert.equal(lane1['rendered-width'], 2800)
  assert.equal(lane1.element.style.width, '2800px')
  assert.equal(lane1.body.style.width, '2800px')
  assert.equal(kv.get(`${lane1.id}.width`), '2800')

  // Drag border between Lane 1 and Lane 2 (Lane 1's right boundary) -> resizes Lane 1 (the lane on the left)
  lane1.element.getBoundingClientRect = () => ({ width: 400 })
  await lane1['body-resizer'].listeners.mousedown[0]({
   clientX: 400,
   preventDefault() {},
   stopPropagation() {},
  })
  assert.equal(lane1['header-resizer'].className, 'lane-resizer lane-resizer--active')
  assert.equal(lane1['body-resizer'].className, 'lane-resizer lane-resizer--active')
  assert.equal(r1.body.style.cursor, 'ew-resize')

  // Drag far left -> clamps to 100px minimum
  await r1.dispatchWindow('mousemove', { clientX: 50 })
  assert.equal(lane1.width, 100)
  assert.equal(lane1['rendered-width'], 100)
  assert.equal(lane1.element.style.width, '100px')
  assert.equal(lane2.width, null)

  // Drag far right (+2600px from start 400 -> 3000px) -> no maximum width
  await r1.dispatchWindow('mousemove', { clientX: 3000 })
  assert.equal(lane1.width, 3000)
  assert.equal(lane1['rendered-width'], 3000)
  assert.equal(lane1.element.style.width, '3000px')
  assert.equal(lane1.body.style.width, '3000px')
  assert.equal(lane2.width, null)

  await r1.dispatchWindow('mouseup', {})
  assert.equal(lane1['header-resizer'].className, 'lane-resizer')
  assert.equal(lane1['body-resizer'].className, 'lane-resizer')
  assert.equal(r1.body.style.cursor, '')
  assert.equal(kv.get(`${lane1.id}.width`), '3000')
  assert.equal((r1.windowListeners.mousemove || []).length, 0)
  assert.equal((r1.windowListeners.mouseup || []).length, 0)

  // Double-click resizer resets Lane 1 width back to auto
  await lane1['header-resizer'].listeners.dblclick[0]()
  assert.equal(lane1.width, null)
  assert.equal(lane1['rendered-width'], null)
  assert.equal(lane1.element.className, 'lane-header')
  assert.equal(lane1.body.className, 'lane-body')
  assert.equal(lane1.element.style.width, '')
  assert.equal(kv.get(`${lane1.id}.width`), '')

  // Set Lane 1 to narrower-than-100px (60) and Lane 2 to 620, test lane reload & full reload persistence
  await r1.f.state['lane-control']['set-width'](lane1.id, 60)
  await r1.f.state['lane-control']['set-width'](lane2.id, 620)
  await lane1['reload-btn'].listeners.click[0]()
  assert.equal(lane1.width, 60)
  assert.equal(lane1['rendered-width'], 100)
  assert.equal(lane1.element.style.width, '100px')
  assert.equal(lane1.body.children.at(-1), lane1['body-resizer'])

  // Simulate full reload from URL -> both stored widths restore (60 clamped to 100px, 620 at 620px)
  const r2 = createRuntime(r1.location.pathname)
  await r2.f.run(parse(mainSource, '/src/main.fs'))
  const rl1 = r2.f.state.lanes[0]
  const rl2 = r2.f.state.lanes[1]
  assert.equal(rl1.width, 60)
  assert.equal(rl1['rendered-width'], 100)
  assert.equal(rl1.element.style.width, '100px')
  assert.equal(rl1.body.style.width, '100px')
  assert.equal(rl2.width, 620)
  assert.equal(rl2['rendered-width'], 620)
  assert.equal(rl2.element.style.width, '620px')
  assert.equal(rl2.body.style.width, '620px')

  // Clearing Width in the gear modal resets back to auto
  const modal2 = r2.f.state['lane-control']['config-modal']
  await rl2['config-btn'].listeners.click[0]()
  assert.equal(modal2['width-input'].value, '620')
  modal2['width-input'].value = ''
  await modal2.form.listeners.submit[0]({ preventDefault() {} })
  assert.equal(rl2.width, null)
  assert.equal(rl2['rendered-width'], null)
  assert.equal(rl2.element.className, 'lane-header')
  assert.equal(rl2.body.className, 'lane-body')
  assert.equal(kv.get(`${rl2.id}.width`), '')
 }
 finally {
  globalThis.fetch = origFetch
 }
})

test('Lane remembered path helpers: parseLanePath, formatLanePath, and normalizeLanePath', () => {
 assert.deepEqual(parseLanePath('source'), { tab: 'source', subroute: '' })
 assert.deepEqual(parseLanePath('INPUT'), { tab: 'input', subroute: '' })
 assert.deepEqual(parseLanePath(' /scope/ '), { tab: 'scope', subroute: '' })
 assert.deepEqual(parseLanePath('view'), { tab: 'view', subroute: '' })
 assert.deepEqual(parseLanePath('data'), { tab: 'data', subroute: '' })
 assert.deepEqual(parseLanePath('data/orders'), { tab: 'data', subroute: 'orders' })
 assert.deepEqual(parseLanePath('data|orders'), { tab: 'data', subroute: 'orders' })
 assert.deepEqual(parseLanePath('/DATA/my table/'), { tab: 'data', subroute: 'my table' })
 assert.deepEqual(parseLanePath('source/ignored'), { tab: 'source', subroute: '' })
 assert.equal(parseLanePath(''), null)
 assert.equal(parseLanePath('   '), null)
 assert.equal(parseLanePath('/'), null)
 assert.equal(parseLanePath(null), null)
 assert.equal(parseLanePath(undefined), null)
 assert.equal(parseLanePath('unknown'), null)

 assert.equal(formatLanePath('source'), 'source')
 assert.equal(formatLanePath('data'), 'data')
 assert.equal(formatLanePath('data', 'orders'), 'data/orders')
 assert.equal(formatLanePath({ tab: 'data', subroute: 'my table' }), 'data/my table')
 assert.equal(formatLanePath('view', 'orders'), 'view')
 assert.equal(formatLanePath('invalid'), '')

 assert.equal(normalizeLanePath('data|orders'), 'data/orders')
 assert.equal(normalizeLanePath('/DATA/Orders/'), 'data/Orders')
 assert.equal(normalizeLanePath('  VIEW  '), 'view')
 assert.equal(normalizeLanePath(''), null)
 assert.equal(normalizeLanePath('bogus'), null)
})

test('Lanes remember last navigated path across close/reopen, show Path and Width Reset buttons in Configure Lane modal, and reset to defaults', async () => {
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
   focus(opts) {
    this.focused = true
    this.lastFocusOptions = opts
   },
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

 const kv = new Map()
 function createMockKV(prefix = '') {
  const qualify = key => (prefix ? `${prefix}.${key}` : key)
  return {
   namespace(name) { return createMockKV(qualify(name)) },
   async get(key) { return kv.has(qualify(key)) ? kv.get(qualify(key)) : null },
   async set(key, value) { kv.set(qualify(key), value) },
  }
 }

 let uuid = 0
 let runCount = 0
 const countedRunLines = async (lines, opts) => {
  runCount += 1
  return runLines(lines, opts)
 }

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

 function createRuntime(initialPathname = '/') {
  const winListeners = {}
  const mockBody = createMockElement('body')
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
   crypto: { randomUUID: () => `path-uuid-${++uuid}` },
   history: { pushState(_s, _t, url) { mockWindow.location.pathname = url } },
   location: { pathname: initialPathname, search: '', hash: '' },
   addEventListener(event, handler) {
    winListeners[event] ||= []
    winListeners[event].push(handler)
   },
   removeEventListener() {},
  }
  const f = field({
   ...DATA_RUNTIME_ENV,
   console: { log() {} },
   createIdleTracker,
   data: createMockKV(),
   defaultValueForType,
   document: {
    body: mockBody,
    defaultView: mockWindow,
    createElement: createMockElement,
   },
   formatImportLine,
   hasImportCycle,
   normalizePrimitiveType,
   parseImportLine,
   primitiveTypes: PRIMITIVE_TYPES,
   resolveImportValue,
   resolveScopeColumns,
   createSourceWorkerRunner: opts => createSourceWorkerRunner({ ...opts, onRun: () => { runCount += 1 } }),
   runLines: countedRunLines,
   runTransportedScripts,
  })
  const dispatchWindow = async (event, ev) => {
   for (const handler of winListeners[event] || []) { await handler(ev) }
  }
  return { f, mockWindow, mockBody, dispatchWindow }
 }

 try {
  const { f, mockWindow, dispatchWindow } = createRuntime('/')
  await f.run(parse(mainSource, '/src/main.fs'))
  const laneControl = f.state['lane-control']
  const configModal = laneControl['config-modal']
  const openModal = laneControl['lane-modal']
  const confirmModal = laneControl['confirm-modal']

  // Fresh lane has no remembered path (defaults to natural source view) and disabled Reset buttons in Configure Lane
  await f.state.tableHeadRowAddButton.listeners.click()
  const lane1 = f.state.lanes[0]
  assert.strictEqual(lane1.path, null)
  assert.equal(kv.get(`${lane1.id}.path`), undefined)

  await lane1['config-btn'].listeners.click()
  assert.equal(configModal['is-open'], true)
  assert.equal(configModal['width-input'].value, '')
  assert.equal(configModal['width-reset-btn'].disabled, true)
  assert.equal(configModal['path-input'].value, '')
  assert.equal(configModal['path-reset-btn'].disabled, true)
  await configModal['cancel-btn'].listeners.click()

  // Navigating tabs updates remembered path in state and KV
  await lane1.notebook.tabs.input.listeners.click()
  assert.equal(lane1.path, 'input')
  assert.equal(kv.get(`${lane1.id}.path`), 'input')

  await lane1.notebook.tabs.scope.listeners.click()
  assert.equal(lane1.path, 'scope')
  assert.equal(kv.get(`${lane1.id}.path`), 'scope')

  await lane1.notebook.tabs.view.listeners.click()
  assert.equal(lane1.path, 'view')
  assert.equal(kv.get(`${lane1.id}.path`), 'view')

  // Navigating to Data and adding/selecting/renaming/deleting tables persists data/<tablename>
  await lane1.notebook.tabs.data.listeners.click()
  assert.equal(lane1.path, 'data')
  assert.equal(kv.get(`${lane1.id}.path`), 'data')

  const dv1 = lane1.notebook['data-view']
  const tblUsers = await dv1['add-table']('users')
  assert.equal(lane1.path, 'data/users')
  assert.equal(kv.get(`${lane1.id}.path`), 'data/users')

  const tblOrders = await dv1['add-table']('orders')
  assert.equal(lane1.path, 'data/orders')
  assert.equal(kv.get(`${lane1.id}.path`), 'data/orders')

  // Select users and rename it -> remembered path tracks active table name
  await dv1['select-table'](tblUsers.id)
  assert.equal(lane1.path, 'data/users')
  await dv1['open-edit-table-modal']()
  dv1['edit-table-modal']['name-input'].value = 'customers'
  await dv1['edit-table-modal']['save-btn'].listeners.click({})
  assert.equal(lane1.path, 'data/customers')
  assert.equal(kv.get(`${lane1.id}.path`), 'data/customers')

  // Delete customers -> falls back to remaining table orders and updates remembered path
  await dv1['delete-table-btn'].listeners.click()
  confirmModal['agree-checkbox'].checked = true
  await confirmModal['agree-checkbox'].listeners.change()
  await confirmModal['confirm-btn'].listeners.click()
  assert.equal(lane1.path, 'data/orders')
  assert.equal(kv.get(`${lane1.id}.path`), 'data/orders')

  // Close lane1 -> KV path remains 'data/orders' -> reopen via Open Lane modal restores data|orders without running Source
  await laneControl.close(lane1.id)
  assert.equal(f.state.lanes.length, 0)
  assert.equal(kv.get(`${lane1.id}.path`), 'data/orders')

  const runsBeforeModalOpen = runCount
  await f.state.tableHeadRowOpenButton.listeners.click()
  await openModal.items.find(it => it.entry.id === lane1.id)['open-btn'].listeners.click()
  assert.equal(f.state.lanes.length, 1)
  const reopened1 = f.state.lanes[0]
  assert.equal(runCount, runsBeforeModalOpen)
  assert.equal(reopened1.path, 'data/orders')
  assert.equal(reopened1.notebook['active-tab'], 'data')
  assert.equal(reopened1.notebook['data-view']['get-active-table']().id, tblOrders.id)
  assert.equal(mockWindow.location.pathname, `/${lane1.id};data|orders`)

  // Reopening via Data lane column open-to-right (open-after) and Preferences (open-preferences-lane) also restores remembered path
  await f.state.tableHeadRowAddButton.listeners.click()
  const hostLane = f.state.lanes[1]
  await hostLane.notebook.tabs.data.listeners.click()
  const hostDv = hostLane.notebook['data-view']
  await hostDv['add-table']('links')
  await hostDv['add-column']('target', 'lane', false)
  await hostDv['add-row']()
  await hostDv['grid-rows'][0].cells[0]['trigger-el'].listeners.click()
  await openModal.items.find(it => it.entry.id === lane1.id)['select-btn'].listeners.click()

  await laneControl.close(lane1.id)
  await hostDv['grid-rows'][0].cells[0]['open-el'].listeners.click()
  assert.deepEqual(f.state.lanes.map(l => l.id), [hostLane.id, lane1.id])
  const afterReopened = f.state.lanes[1]
  assert.equal(afterReopened.notebook['active-tab'], 'data')
  assert.equal(afterReopened.notebook['data-view']['get-active-table']().name, 'orders')
  assert.equal(afterReopened.path, 'data/orders')
  assert.equal(mockWindow.location.pathname, `/${hostLane.id};data|links/${lane1.id};data|orders`)

  // Preferences lane closed on 'scope' restores 'scope' via open-preferences-lane
  await laneControl['set-preferences-lane'](lane1.id)
  await afterReopened.notebook.tabs.scope.listeners.click()
  assert.equal(afterReopened.path, 'scope')
  await laneControl.close(lane1.id)
  await laneControl['open-preferences-lane']()
  const prefReopened = laneControl['by-id'][lane1.id]
  assert.equal(prefReopened.notebook['active-tab'], 'scope')
  assert.equal(prefReopened.path, 'scope')

  // Explicit URL / popstate route still overrides remembered path (e.g. /<id> explicitly routes to source)
  mockWindow.location.pathname = `/${lane1.id}`
  await dispatchWindow('popstate', {})
  assert.equal(laneControl['by-id'][lane1.id].notebook['active-tab'], 'source')

  // Configure Lane modal displays remembered Path & Width, enables Reset buttons, and allows editing Path directly
  await laneControl['set-width'](lane1.id, 420)
  await laneControl['by-id'][lane1.id].notebook.tabs.data.listeners.click()
  const activeLane1 = laneControl['by-id'][lane1.id]
  assert.equal(activeLane1.path, 'data/orders')

  await activeLane1['config-btn'].listeners.click()
  assert.equal(configModal['width-input'].value, '420')
  assert.equal(configModal['width-reset-btn'].disabled, false)
  assert.equal(configModal['path-input'].value, 'data/orders')
  assert.equal(configModal['path-reset-btn'].disabled, false)

  // Edit Path directly to 'view' -> switches lane to View and persists 'view'
  configModal['path-input'].value = 'view'
  await configModal['path-input'].listeners.input()
  await configModal.form.listeners.submit({ preventDefault() {} })
  assert.equal(activeLane1.path, 'view')
  assert.equal(kv.get(`${lane1.id}.path`), 'view')
  assert.equal(activeLane1.notebook['active-tab'], 'view')
  assert.equal(mockWindow.location.pathname, `/${lane1.id};view`)

  // Invalid Path input in Configure Lane preserves existing remembered path
  await activeLane1['config-btn'].listeners.click()
  configModal['path-input'].value = 'not-a-tab'
  await configModal['path-input'].listeners.input()
  await configModal.form.listeners.submit({ preventDefault() {} })
  assert.equal(activeLane1.path, 'view')
  assert.equal(activeLane1.notebook['active-tab'], 'view')

  // Clicking Reset clears input & disables button; Cancel discards those resets
  await activeLane1['config-btn'].listeners.click()
  await configModal['width-reset-btn'].listeners.click()
  await configModal['path-reset-btn'].listeners.click()
  assert.equal(configModal['width-input'].value, '')
  assert.equal(configModal['width-reset-btn'].disabled, true)
  assert.equal(configModal['path-input'].value, '')
  assert.equal(configModal['path-reset-btn'].disabled, true)
  await configModal['cancel-btn'].listeners.click()
  assert.equal(activeLane1.width, 420)
  assert.equal(activeLane1.path, 'view')

  // Clicking Reset on both Width and Path then Save changes resets width to auto and path to natural default (source)
  await activeLane1['config-btn'].listeners.click()
  await configModal['width-reset-btn'].listeners.click()
  await configModal['path-reset-btn'].listeners.click()
  await configModal.form.listeners.submit({ preventDefault() {} })
  assert.strictEqual(activeLane1.width, null)
  assert.equal(kv.get(`${lane1.id}.width`), '')
  assert.equal(activeLane1.element.className, 'lane-header')
  assert.strictEqual(activeLane1.path, null)
  assert.equal(kv.get(`${lane1.id}.path`), '')
  assert.equal(activeLane1.notebook['active-tab'], 'source')
  assert.equal(mockWindow.location.pathname, `/${lane1.id}`)

  // Reopening after reset lands naturally on source and keeps Reset buttons disabled
  await laneControl.close(lane1.id)
  await laneControl.open(lane1.id)
  const resetReopened = laneControl['by-id'][lane1.id]
  assert.strictEqual(resetReopened.path, null)
  assert.equal(resetReopened.notebook['active-tab'], 'source')
  await resetReopened['config-btn'].listeners.click()
  assert.equal(configModal['width-input'].value, '')
  assert.equal(configModal['width-reset-btn'].disabled, true)
  assert.equal(configModal['path-input'].value, '')
  assert.equal(configModal['path-reset-btn'].disabled, true)
  await configModal['cancel-btn'].listeners.click()

  // Reloading runtime from KV retains remembered path across sessions too
  await resetReopened.notebook.tabs.data.listeners.click()
  assert.equal(kv.get(`${lane1.id}.path`), 'data/orders')
  const r2 = createRuntime('/')
  await r2.f.run(parse(mainSource, '/src/main.fs'))
  await r2.f.state['lane-control'].open(lane1.id)
  const freshLane1 = r2.f.state['lane-control']['by-id'][lane1.id]
  assert.equal(freshLane1.path, 'data/orders')
  assert.equal(freshLane1.notebook['active-tab'], 'data')
  assert.equal(freshLane1.notebook['data-view']['get-active-table']().name, 'orders')
 }
 finally {
  globalThis.fetch = origFetch
 }
})

test('computeLaneScrollLeft calculates horizontal scroll target with side-rail and right breathing-room margins', () => {
 // Lane extends past right edge -> scrolls so lane right sits 96px inside viewport right edge (1120 - (1000 - 96) = 216)
 assert.equal(computeLaneScrollLeft(0, 1000, 700, 1120), 216)
 // Lane already completely inside [48, viewport - 96] -> no scroll needed
 assert.equal(computeLaneScrollLeft(0, 1000, 48, 904), null)
 assert.equal(computeLaneScrollLeft(200, 1000, 100, 500), null)
 // Lane extends past left edge -> scrolls so lane left sits 48px inside viewport left edge ((200 - 100) - 48 = 52)
 assert.equal(computeLaneScrollLeft(200, 1000, -100, 300), 52)
 // Wide lane (> usableWidth 456, but <= viewport - 64 = 536) -> centered between 32px side rails (pad = 50)
 assert.equal(computeLaneScrollLeft(0, 600, 200, 700), 150)
 // Ultra-wide lane (> viewport - 64) -> aligns left edge at 48px
 assert.equal(computeLaneScrollLeft(0, 600, 200, 900), 152)
 // Invalid or degenerate inputs return null
 assert.equal(computeLaneScrollLeft(0, 0, 100, 400), null)
 assert.equal(computeLaneScrollLeft(0, 1000, 400, 400), null)
 assert.equal(computeLaneScrollLeft(0, 1000, NaN, 400), null)

 // computeLaneScrollTop centers lines that are off-screen vertically while ignoring lines already comfortably visible
 assert.equal(computeLaneScrollTop(0, 800, 200, 230), null)
 assert.equal(computeLaneScrollTop(0, 800, 1400, 1430), 1023)
 assert.equal(computeLaneScrollTop(1200, 800, -1050, -1020), 0)
 assert.equal(computeLaneScrollTop(500, 800, -300, -270), 0)
 assert.equal(computeLaneScrollTop(0, 0, 100, 130), null)
 assert.equal(computeLaneScrollTop(0, 800, NaN, 130), null)
})

test('computeLaneModalTopOffset floats lane modals to the current viewport/anchor vertical region without horizontal changes', () => {
 // Unscrolled short lane with click near top of viewport -> 0 offset
 assert.equal(computeLaneModalTopOffset({
  hostTop: 24,
  hostHeight: 420,
  basePanelTop: 34,
  panelHeight: 180,
  viewportTop: 24,
  viewportBottom: 884,
  anchorClientY: 80,
 }), 0)

 // Unscrolled lane with lower click gently floats panel toward click (120 - 63 = 57 -> 57 - 34 = 23)
 assert.equal(computeLaneModalTopOffset({
  hostTop: 24,
  hostHeight: 420,
  basePanelTop: 34,
  panelHeight: 180,
  viewportTop: 24,
  viewportBottom: 884,
  anchorClientY: 120,
 }), 23)

 // Scrolled-down tall lane (hostTop < 0): floats down near anchorClientY (460 - 63 = 397 -> 397 - (-610) = 1007)
 assert.equal(computeLaneModalTopOffset({
  hostTop: -620,
  hostHeight: 2000,
  basePanelTop: -610,
  panelHeight: 180,
  viewportTop: 24,
  viewportBottom: 884,
  anchorClientY: 460,
 }), 1007)

 // Pointer near very bottom of viewport clamps inside viewportBottom - panelHeight (884 - 180 = 704 -> 704 - (-610) = 1314)
 assert.equal(computeLaneModalTopOffset({
  hostTop: -620,
  hostHeight: 2000,
  basePanelTop: -610,
  panelHeight: 180,
  viewportTop: 24,
  viewportBottom: 884,
  anchorClientY: 870,
 }), 1314)

 // Fallback without pointer anchor still brings modal cleanly into viewport top + comfortable slack (24 + 64 = 88 -> 88 - (-610) = 698)
 assert.equal(computeLaneModalTopOffset({
  hostTop: -620,
  hostHeight: 2000,
  basePanelTop: -610,
  panelHeight: 180,
  viewportTop: 24,
  viewportBottom: 884,
 }), 698)

 // Tall modal fits inside viewport bottom (884 - 620 = 264 -> 264 - (-610) = 874)
 assert.equal(computeLaneModalTopOffset({
  hostTop: -620,
  hostHeight: 2000,
  basePanelTop: -610,
  panelHeight: 620,
  viewportTop: 24,
  viewportBottom: 884,
  anchorClientY: 850,
 }), 874)

 // Host ending above viewport bottom clamps panel inside host bottom pad (400 - 10 - 250 = 140 -> 140 - (-190) = 330)
 assert.equal(computeLaneModalTopOffset({
  hostTop: -200,
  hostHeight: 600,
  basePanelTop: -190,
  panelHeight: 250,
  viewportTop: 24,
  viewportBottom: 884,
  anchorClientY: 700,
 }), 330)

 // Partially scrolled-off shorter lane leaves >= 96px visible at bottom -> 0 when not taller than needed
 assert.equal(computeLaneModalTopOffset({
  hostTop: -200,
  hostHeight: 280,
  basePanelTop: -190,
  panelHeight: 180,
  viewportTop: 24,
  viewportBottom: 884,
  anchorClientY: 60,
 }), 174)

 // Invalid inputs safely return 0
 assert.equal(computeLaneModalTopOffset(null), 0)
 assert.equal(computeLaneModalTopOffset({ hostTop: 0, hostHeight: 0, basePanelTop: 0, panelHeight: 100, viewportTop: 0, viewportBottom: 800 }), 0)
 assert.equal(computeLaneModalTopOffset({ hostTop: NaN, hostHeight: 500, basePanelTop: 0, panelHeight: 100, viewportTop: 0, viewportBottom: 800 }), 0)
})

test('Lane scroll landing clears right margin across add/open/restore without clobbering sync/reload, and Data lane CSS enforces non-overlapping 240px/25% bounds', async () => {
 const indexHtml = await fs.readFile(new URL('./index.html', import.meta.url), 'utf8')
 // Verify root scroll-padding and Data lane split button non-overlap & 240px / 25% flex rules
 assert.match(indexHtml, /:root\s*\{[^}]*scroll-padding-inline:\s*48px 96px;/s)
 assert.match(indexHtml, /\.lane-header\s*\{[^}]*scroll-margin-inline:\s*48px 96px;/s)
 assert.match(indexHtml, /\.lane-body\s*\{[^}]*scroll-margin-inline:\s*48px 96px;/s)
 assert.match(indexHtml, /\.lane-data-lane-control\s*\{[^}]*gap:\s*4px;[^}]*overflow:\s*hidden;/s)
 assert.match(indexHtml, /\.lane-data-lane-id-btn\s*\{[^}]*flex:\s*0 1 auto;[^}]*max-width:\s*min\(240px,\s*calc\(75% - 4px\)\);[^}]*min-width:\s*0;[^}]*overflow:\s*hidden;/s)
 assert.match(indexHtml, /\.lane-data-lane-id\s*\{[^}]*flex:\s*0 1 auto;[^}]*min-width:\s*0;[^}]*overflow:\s*hidden;[^}]*text-overflow:\s*ellipsis;/s)
 assert.match(indexHtml, /\.lane-data-lane-open-btn\s*\{[^}]*flex:\s*1 1 25%;[^}]*min-width:\s*25%;[^}]*overflow:\s*hidden;/s)
 assert.doesNotMatch(indexHtml, /\.lane-data-td--sized \.lane-data-lane-open-btn/)
 assert.match(indexHtml, /\.lane-modal-action--locate\s*\{[^}]*background:\s*#38d39f22;[^}]*border-color:\s*#38d39f55;[^}]*color:\s*#7df3c8;/s)
 assert.match(indexHtml, /\.lane-modal-action--locate:hover:not\(:disabled\),\s*\.lane-modal-action--locate:focus:not\(:disabled\)\s*\{[^}]*background:\s*#38d39f38;[^}]*border-color:\s*#38d39f88;[^}]*color:\s*#b4fde4;/s)
 assert.match(indexHtml, /\.lane-header--highlighted,\s*\.lane-body--highlighted\s*\{[^}]*animation:\s*lane-highlight-pulse 2\.2s ease-out;/s)
 assert.match(indexHtml, /\.lane-header--highlighted\s*\{[^}]*animation-name:\s*lane-header-highlight-pulse;[^}]*box-shadow:\s*inset 0 1px 0 0 #38d39f66,\s*inset 1px 0 0 0 #38d39f66,\s*inset -1px 0 0 0 #38d39f66;/s)
 assert.match(indexHtml, /\.lane-body--highlighted\s*\{[^}]*animation-name:\s*lane-body-highlight-pulse;[^}]*box-shadow:\s*inset 0 -1px 0 0 #38d39f66,\s*inset 1px 0 0 0 #38d39f66,\s*inset -1px 0 0 0 #38d39f66;/s)

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

 const laneBounds = new Map()
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
   removeAttribute(name) { delete this.attributes[name] },
   getBoundingClientRect() {
    const id = this.attributes['data-lane-id']
    const entry = id && laneBounds.get(id)
    if (!entry) { return { left: 0, right: 0, width: 0, top: 0, height: 0 } }
    const rect = this.tag === 'td' && entry.body ? entry.body : entry.header
    return rect || { left: 0, right: 0, width: 0, top: 0, height: 0 }
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
   focus(opts) {
    this.focused = true
    this.lastFocusOptions = opts
   },
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

 const kv = new Map()
 function createMockKV(prefix = '') {
  const qualify = key => (prefix ? `${prefix}.${key}` : key)
  return {
   namespace(name) { return createMockKV(qualify(name)) },
   async get(key) { return kv.has(qualify(key)) ? kv.get(qualify(key)) : null },
   async set(key, value) { kv.set(qualify(key), value) },
  }
 }

 let uuid = 0
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

 function createRuntime(initialPathname = '/', initialHash = '') {
  const scrollToCalls = []
  const rafQueue = []
  const cancelledRafs = []
  const timeouts = new Map()
  let nextRafId = 1
  let nextTimeoutId = 1
  const mockBody = createMockElement('body')
  const documentElement = { clientWidth: 1000, scrollLeft: 0, scrollTop: 0 }
  const mockWindow = {
   Array,
   Boolean,
   Date,
   JSON,
   Math,
   Number,
   Object,
   Reflect,
   innerWidth: 1000,
   scrollX: 0,
   scrollY: 0,
   decodeURIComponent,
   setTimeout(fn, ms) {
    const id = nextTimeoutId++
    timeouts.set(id, { fn, ms })
    return id
   },
   clearTimeout(id) {
    timeouts.delete(id)
   },
   crypto: { randomUUID: () => `scroll-land-uuid-${++uuid}` },
   history: {
    pushState(_s, _t, url) { mockWindow.location.pathname = url },
    replaceState(_s, _t, url) { mockWindow.location.pathname = url },
   },
   location: { pathname: initialPathname, search: '', hash: initialHash },
   scrollTo(arg1, arg2) {
    if (arg1 && typeof arg1 === 'object') {
     scrollToCalls.push(arg1)
     if (typeof arg1.left === 'number') {
      mockWindow.scrollX = arg1.left
      documentElement.scrollLeft = arg1.left
     }
    }
    else {
     scrollToCalls.push({ left: arg1, top: arg2 })
     mockWindow.scrollX = arg1
     documentElement.scrollLeft = arg1
    }
   },
   requestAnimationFrame(fn) {
    const id = nextRafId++
    rafQueue.push({ id, fn, cancelled: false })
    return id
   },
   cancelAnimationFrame(id) {
    cancelledRafs.push(id)
    const entry = rafQueue.find(r => r.id === id)
    if (entry) { entry.cancelled = true }
   },
   addEventListener() {},
   removeEventListener() {},
  }
  const f = field({
   ...DATA_RUNTIME_ENV,
   console: { log() {} },
   createIdleTracker,
   data: createMockKV(),
   defaultValueForType,
   document: {
    body: mockBody,
    documentElement,
    defaultView: mockWindow,
    createElement: createMockElement,
   },
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
  const flushRaf = async () => {
   while (rafQueue.length > 0) {
    const item = rafQueue.shift()
    if (!item.cancelled) { await item.fn() }
   }
  }
  return { f, mockWindow, documentElement, scrollToCalls, cancelledRafs, timeouts, flushRaf }
 }

 try {
  const { f, mockWindow, scrollToCalls, cancelledRafs, timeouts, flushRaf } = createRuntime('/')
  await f.run(parse(mainSource, '/src/main.fs'))
  const laneControl = f.state['lane-control']
  const openModal = laneControl['lane-modal']
  const rails = laneControl.rails

  // Helper: positions a lane in viewport relative to current scrollX
  const setWorldBounds = (id, worldLeft, headerWidth, bodyWidth = headerWidth) => {
   const cur = mockWindow.scrollX
   laneBounds.set(id, {
    header: { left: worldLeft - cur, right: worldLeft - cur + headerWidth, width: headerWidth },
    body: { left: worldLeft - cur, right: worldLeft - cur + bodyWidth, width: bodyWidth },
   })
  }

  // 1. Adding a lane (+ Lane) scrolls it into view with 96px right clearance using union of header & body widths
  setWorldBounds('scroll-land-uuid-1', 700, 320, 420)
  await f.state.tableHeadRowAddButton.listeners.click()
  const lane1 = f.state.lanes[0]
  await flushRaf()
  // body right is 700 + 420 = 1120 -> 1120 - (1000 - 96) = 216
  assert.deepEqual(scrollToCalls.at(-1), { left: 216, top: 0, behavior: 'smooth' })
  assert.equal(mockWindow.scrollX, 216)

  // 2. Adding two lanes back-to-back coalesces rAF frames via cancelAnimationFrame
  setWorldBounds('scroll-land-uuid-2', 1150, 350)
  setWorldBounds('scroll-land-uuid-3', 1520, 380)
  await f.state.tableHeadRowAddButton.listeners.click()
  const lane2 = f.state.lanes[1]
  await f.state.tableHeadRowAddButton.listeners.click()
  const lane3 = f.state.lanes[2]
  assert.equal(cancelledRafs.length, 1)
  await flushRaf()
  // Lane 3 right = 1520 + 380 = 1900 -> 1900 - 904 = 996
  assert.deepEqual(scrollToCalls.at(-1), { left: 996, top: 0, behavior: 'smooth' })
  assert.equal(mockWindow.scrollX, 996)

  // 3. Reloading lane1 does NOT scroll away from current scrollX
  const callsBeforeReload = scrollToCalls.length
  await lane1['reload-btn'].listeners.click()
  await flushRaf()
  assert.equal(scrollToCalls.length, callsBeforeReload)

  // 4. Closing lane1 and reopening via Open Lane modal scrolls back left so lane1 clears left 48px margin
  await laneControl.close(lane1.id)
  setWorldBounds(lane1.id, 100, 420)
  await f.state.tableHeadRowOpenButton.listeners.click()
  await openModal.items.find(it => it.entry.id === lane1.id)['open-btn'].listeners.click()
  await flushRaf()
  // lane1 absLeft = 100, visibleLeft = 48 -> target = 100 - 48 = 52
  assert.deepEqual(scrollToCalls.at(-1), { left: 52, top: 0, behavior: 'smooth' })
  assert.equal(mockWindow.scrollX, 52)

  // 5. Restoring a minimized lane from the side rail via its floating restore arrow button scrolls it smoothly into view with right margin
  await laneControl.minimize(lane3.id, 'right')
  setWorldBounds(lane3.id, 1520, 380)
  await rails['right-items'][0]['icon-el'].listeners.click()
  assert.equal(lane3['is-minimized'], true)
  assert.equal(rails['is-preview-pinned'], true)
  await rails['restore-btn'].listeners.click()
  await flushRaf()
  assert.equal(lane3['is-minimized'], false)
  // absRight = 1900 -> 1900 - 904 = 996
  assert.deepEqual(scrollToCalls.at(-1), { left: 996, top: 0, behavior: 'smooth' })

  // 6. Data lane column open-to-right (open-after) scrolls opened lane into view with right margin
  await lane1.notebook.tabs.data.listeners.click()
  const dv1 = lane1.notebook['data-view']
  await dv1['add-table']('nav')
  await dv1['add-column']('target', 'lane', false)
  await dv1['add-row']()
  await dv1['grid-rows'][0].cells[0]['trigger-el'].listeners.click()
  await openModal.items.find(it => it.entry.id === lane2.id)['select-btn'].listeners.click()
  await laneControl.close(lane2.id)
  mockWindow.scrollX = 0
  setWorldBounds(lane2.id, 780, 400)
  await dv1['grid-rows'][0].cells[0]['open-el'].listeners.click()
  await flushRaf()
  // 780 + 400 = 1180 -> 1180 - 904 = 276
  assert.deepEqual(scrollToCalls.at(-1), { left: 276, top: 0, behavior: 'smooth' })

  // 7. Creating & opening Preferences lane from top-rail menu scrolls into view with right margin
  mockWindow.scrollX = 0
  await rails['preferences-create-btn'].listeners.click()
  const prefLane = f.state.lanes.at(-1)
  setWorldBounds(prefLane.id, 1000, 360)
  await flushRaf()
  // 1000 + 360 = 1360 -> 1360 - 904 = 456
  assert.deepEqual(scrollToCalls.at(-1), { left: 456, top: 0, behavior: 'smooth' })

  await laneControl.close(prefLane.id)
  mockWindow.scrollX = 0
  setWorldBounds(prefLane.id, 1100, 360)
  await rails['preferences-open-btn'].listeners.click()
  await flushRaf()
  // 1100 + 360 = 1460 -> 1460 - 904 = 556
  assert.deepEqual(scrollToCalls.at(-1), { left: 556, top: 0, behavior: 'smooth' })

  // 8. Open Lane modal Locate button: green Locate button to the right of Close reveals main-area lanes (scroll + highlight) and sidebar lanes (float + pin)
  await f.state.tableHeadRowOpenButton.listeners.click()
  assert.equal(openModal['is-open'], true)
  const lane1ModalItem = openModal.items.find(it => it.entry.id === lane1.id)
  assert.equal(lane1ModalItem['is-open'], true)
  assert.ok(lane1ModalItem['close-btn'])
  assert.ok(lane1ModalItem['locate-btn'])
  assert.equal(lane1ModalItem['locate-btn'].className, 'lane-modal-action lane-modal-action--locate')
  assert.equal(lane1ModalItem['locate-btn'].textContent, 'Locate')
  const actionChildren = lane1ModalItem.el.children[1].children
  const closeIdx = actionChildren.indexOf(lane1ModalItem['close-btn'])
  const locateIdx = actionChildren.indexOf(lane1ModalItem['locate-btn'])
  assert.equal(locateIdx, closeIdx + 1)

  // Clicking Locate on main-area lane1 closes modal, scrolls to lane1, and highlights lane1 for 2.2s
  const activeLane1 = laneControl['by-id'][lane1.id]
  mockWindow.scrollX = 600
  setWorldBounds(lane1.id, 100, 420)
  await lane1ModalItem['locate-btn'].listeners.click()
  await flushRaf()
  assert.equal(openModal['is-open'], false)
  assert.deepEqual(scrollToCalls.at(-1), { left: 52, top: 0, behavior: 'smooth' })
  assert.equal(activeLane1['is-highlighted'], true)
  assert.equal(activeLane1.element.className, 'lane-header lane-header--highlighted')
  assert.equal(activeLane1.body.className, 'lane-body lane-body--highlighted')
  assert.equal(activeLane1.element.attributes['data-highlighted'], 'true')
  assert.equal(activeLane1.body.attributes['data-highlighted'], 'true')
  assert.ok(activeLane1['highlight-timer'])
  const hlTimer = timeouts.get(activeLane1['highlight-timer'])
  assert.equal(hlTimer.ms, 2200)
  await hlTimer.fn()
  assert.equal(activeLane1['is-highlighted'], false)
  assert.equal(activeLane1.element.className, 'lane-header')
  assert.equal(activeLane1.body.className, 'lane-body')
  assert.equal(activeLane1.element.attributes['data-highlighted'], undefined)
  assert.equal(activeLane1.body.attributes['data-highlighted'], undefined)

  // Minimize lane3 to right sidebar, open Open Lane modal, and click Locate on lane3 -> floats open and pins open
  await laneControl.minimize(lane3.id, 'right')
  assert.equal(lane3['is-minimized'], true)
  assert.equal(rails['is-preview-pinned'], false)
  assert.equal(rails['pinned-lane'], null)
  await f.state.tableHeadRowOpenButton.listeners.click()
  const lane3ModalItem = openModal.items.find(it => it.entry.id === lane3.id)
  assert.equal(lane3ModalItem['is-open'], true)
  assert.ok(lane3ModalItem['locate-btn'])
  await lane3ModalItem['locate-btn'].listeners.click()
  assert.equal(openModal['is-open'], false)
  assert.equal(lane3['is-minimized'], true)
  assert.equal(rails['is-preview-pinned'], true)
  assert.equal(rails['pinned-lane'], lane3)
  assert.equal(rails['preview-el'].hidden, false)
  assert.match(rails['preview-el'].className, /side-rail-preview--pinned/)

  // 9. Startup sync with #scroll.left=333 preserves hash scroll without scroll-lane-into-view overriding it
  const rHash = createRuntime(`/${lane1.id}`, '#scroll.left=333')
  await rHash.f.run(parse(mainSource, '/src/main.fs'))
  await rHash.flushRaf()
  assert.equal(rHash.mockWindow.scrollX, 333)
  assert.deepEqual(rHash.scrollToCalls, [{ left: 333, top: 0 }])
 }
 finally {
  globalThis.fetch = origFetch
 }
})

test('formatExportLine and parseExportLine round-trip multi-target, single-target, alias, and autoblock expressions', () => {
 const cases = [
  { targets: [], contentExpr: '' },
  { targets: [{ laneId: 'lane-1', lineId: 'ln-1' }], contentExpr: "; add '!console log  ' $message" },
  {
   targets: [
    { laneId: 'lane-1', lineId: 'ln-1' },
    { laneId: 'lane-2', lineId: 'ln-2' },
   ],
   contentExpr: '!fn 1 2',
  },
  { targets: [{ laneId: 'lane-1', lineId: 'ln-1' }], contentExpr: '$message' },
  { targets: [{ laneId: 'lane-1', lineId: 'ln-1' }], contentExpr: "'hello world'" },
 ]
 for (const spec of cases) {
  const formatted = formatExportLine(spec)
  const parsed = parseExportLine(formatted)
  assert.ok(parsed, `Expected parseExportLine to parse: ${formatted}`)
  assert.deepEqual(parsed.targets, spec.targets)
  assert.equal(parsed.contentExpr, spec.contentExpr)
 }

 const withAlias = formatExportLine({
  alias: 'res',
  targets: [{ laneId: 'lane-1', lineId: 'ln-1' }],
  contentExpr: "; add 'x=' $x",
 })
 const parsedAlias = parseExportLine(withAlias)
 assert.equal(parsedAlias.alias, 'res')
 assert.deepEqual(parsedAlias.targets, [{ laneId: 'lane-1', lineId: 'ln-1' }])
 assert.equal(parsedAlias.contentExpr, "; add 'x=' $x")

 const singleShorthand = parseExportLine("!setLaneLine laneA lnA [ ; add 'y=' $y ]")
 assert.equal(singleShorthand.fnName, 'setLaneLine')
 assert.deepEqual(singleShorthand.targets, [{ laneId: 'laneA', lineId: 'lnA' }])
 assert.equal(singleShorthand.contentExpr, "; add 'y=' $y")

 assert.equal(parseExportLine('; to x 42'), null)
 assert.equal(parseExportLine('!importLane lane-1 foo'), null)
})

test('storage.mjs: deployed script caching, diffLaneScripts, getLaneDeployStatus, and setTargetLaneLine', async () => {
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

 const initialRecs = [
  { id: 'ln-1', text: '; to message "init"', updatedAt: '2026-11-25T10:00:00.000Z' },
  { id: 'ln-2', text: '$message', updatedAt: '2026-11-25T10:00:00.000Z' },
 ]
 await saveLaneScript(kv, kv.namespace('lane-a'), 'lane-a', initialRecs, null, '2026-11-25T10:00:00.000Z')

 // Undeployed lane status
 const undeployed = await getLaneDeployStatus(kv, kv, 'lane-a')
 assert.equal(undeployed.deployed, false)
 assert.equal(undeployed.status, 'not-deployed')
 assert.equal(undeployed.hasChanges, false)

 // Idempotent setTargetLaneLine does not rewrite or mark changed
 const noOp = await setTargetLaneLine(kv, 'lane-a', 'ln-1', '; to message "init"', null)
 assert.equal(noOp.ok, true)
 assert.equal(noOp.changed, false)
 assert.equal(noOp.updatedAt, '2026-11-25T10:00:00.000Z')

 // Deployed record without cached baseline -> unverified-baseline
 await saveLaneDeployment(kv, {
  laneId: 'lane-a',
  title: 'Lane A',
  serverId: 'srv-1',
  slug: 'lane-a',
  port: 4100,
  routeMode: 'subpath',
  domain: 'api.example.com',
  subpath: '/lane-a',
  civilMemoryUrl: 'http://127.0.0.1:3333',
  lastDeployedAt: '2026-11-25T10:05:00.000Z',
 })
 const noBaseline = await getLaneDeployStatus(kv, kv, 'lane-a')
 assert.equal(noBaseline.status, 'unverified-baseline')
 assert.equal(noBaseline.hasChanges, true)

 // Save baseline -> up-to-date
 await saveDeployedLaneScript(kv, 'lane-a', initialRecs, '2026-11-25T10:05:00.000Z')
 const loadedSnap = await loadDeployedLaneScript(kv, 'lane-a')
 assert.equal(loadedSnap.records.length, 2)
 const clean = await getLaneDeployStatus(kv, kv, 'lane-a')
 assert.equal(clean.status, 'up-to-date')
 assert.equal(clean.hasChanges, false)
 assert.equal(clean.diff.changedLines.length, 0)

 // Modify line -> needs-deploy with diff
 const changedRes = await setTargetLaneLine(kv, 'lane-a', 'ln-1', "!console log 'hello world'", null, {
  laneId: 'lane-src',
  lineId: 'ln-src-2',
 })
 assert.equal(changedRes.ok, true)
 assert.equal(changedRes.changed, true)
 assert.deepEqual(changedRes.setBy, { laneId: 'lane-src', lineId: 'ln-src-2' })

 // Local Civil Command script records persist setBy
 const loadedLocal = await loadLaneScript(kv, kv.namespace('lane-a'), 'lane-a', null)
 assert.deepEqual(loadedLocal.records[0].setBy, { laneId: 'lane-src', lineId: 'ln-src-2' })

 // clearTargetLaneLineSetBy clears setBy in Civil Command without changing line text
 const clearedRes = await clearTargetLaneLineSetBy(kv, 'lane-a', 'ln-1', 'lane-src', 'ln-src-2', null)
 assert.equal(clearedRes.ok, true)
 assert.equal(clearedRes.changed, false)
 assert.equal(clearedRes.setByChanged, true)
 assert.equal(clearedRes.setBy, null)
 const loadedAfterClear = await loadLaneScript(kv, kv.namespace('lane-a'), 'lane-a', null)
 assert.equal(loadedAfterClear.records[0].setBy, undefined)
 assert.equal(loadedAfterClear.records[0].text, "!console log 'hello world'")

 // Re-apply setBy and verify deployments (collectLaneSyncBundle, writeLaneSyncBundleToKv, saveDeployedLaneScript) never track setBy
 const reSetRes = await setTargetLaneLine(kv, 'lane-a', 'ln-1', "!console log 'hello world'", null, {
  laneId: 'lane-src',
  lineId: 'ln-src-2',
 })
 assert.equal(reSetRes.ok, true)
 assert.equal(reSetRes.changed, false)
 assert.equal(reSetRes.setByChanged, true)
 assert.deepEqual(reSetRes.setBy, { laneId: 'lane-src', lineId: 'ln-src-2' })
 const bundle = await collectLaneSyncBundle(kv, 'lane-a')
 assert.equal(bundle.lanes.length, 1)
 assert.equal(bundle.lanes[0].records[0].setBy, undefined)
 await writeLaneSyncBundleToKv(kv, bundle, null)
 const remoteLoaded = await loadLaneScript(kv, kv.namespace('lane-a'), 'lane-a', null)
 assert.equal(remoteLoaded.records[0].setBy, undefined)
 const savedDepSnap = await saveDeployedLaneScript(kv, 'lane-a', loadedLocal.records, '2026-11-25T10:06:00.000Z')
 assert.equal(savedDepSnap.records[0].setBy, undefined)
 const loadedDepSnap = await loadDeployedLaneScript(kv, 'lane-a')
 assert.equal(loadedDepSnap.records[0].setBy, undefined)
 // Restore original baseline for diff check below
 await saveDeployedLaneScript(kv, 'lane-a', initialRecs, '2026-11-25T10:05:00.000Z')

 const dirty = await getLaneDeployStatus(kv, kv, 'lane-a')
 assert.equal(dirty.status, 'needs-deploy')
 assert.equal(dirty.hasChanges, true)
 assert.equal(dirty.diff.changedLines.length, 1)
 assert.equal(dirty.diff.changedLines[0].type, 'modified')
 assert.equal(dirty.diff.changedLines[0].lineNumber, 1)
 assert.equal(dirty.diff.changedLines[0].before, '; to message "init"')
 assert.equal(dirty.diff.changedLines[0].after, "!console log 'hello world'")

 // Missing line returns ok:false
 const missing = await setTargetLaneLine(kv, 'lane-a', 'ln-missing', 'x', null)
 assert.equal(missing.ok, false)

 // Delete deployment cleans up cached deployed script
 await deleteLaneDeployment(kv, 'lane-a')
 assert.equal(await loadDeployedLaneScript(kv, 'lane-a'), null)
})

test('Export to Lane: scope APIs, multi-target overwrite, live deploy status pills, and Deploy Changes modal', async () => {
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
   focus(opts) {
    this.focused = true
    this.lastFocusOptions = opts
   },
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
  crypto: { randomUUID: () => `exp-uuid-${++uuid}` },
  history: { pushState(_s, _t, url) { mockWindow.location.pathname = url } },
  location: { pathname: '/', protocol: 'http:', host: 'localhost:8080' },
  addEventListener() {},
  removeEventListener() {},
 }
 const mockDocument = { body: createMockElement('body'), defaultView: mockWindow, createElement: createMockElement }
 const termPayloads = []

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
   syncLaneToRemoteCivilMemory: async payload => ({ ok: true, laneCount: payload.bundle.lanes.length, laneIds: payload.bundle.lanes.map(l => l.id), syncedAt: '2026-11-25T13:00:00Z' }),
   startDeployTerminalSession: async payload => {
    termPayloads.push(payload)
    return { ok: true, sessionId: `term-exp-${termPayloads.length}`, wsPath: `/api/deploy/terminal/ws?id=term-exp-${termPayloads.length}`, title: `Deploy ${payload.deployment ? payload.deployment.slug : ''}` }
   },
   killDeployTerminalSession: async () => ({ ok: true }),
  })
  await f.run(parse(mainSource, '/src/main.fs'))
  const laneControl = f.state['lane-control']
  await laneControl['dir-modal']['default-btn'].listeners.click()

  // Create Target A (deployed) and Target B (not deployed)
  const targetA = await laneControl.add()
  await laneControl.rename(targetA.id, 'Target A')
  targetA.notebook.rows[0]['input-el'].value = "!console log  initial"
  await targetA.notebook.rows[0]['input-el'].listeners.input()

  const targetB = await laneControl.add()
  await laneControl.rename(targetB.id, 'Target B')
  targetB.notebook.rows[0]['input-el'].value = "!console log  initial"
  await targetB.notebook.rows[0]['input-el'].listeners.input()

  // Configure SSH server and deploy Target A
  await saveDeployServer(kv, {
   id: 'srv-exp-1',
   name: 'Prod Server',
   host: 'api.example.com',
   user: 'root',
   defaultDomain: 'api.example.com',
   civilMemoryMode: 'external',
   civilMemoryUrl: 'https://kv.example.com',
   civilMemoryVerified: true,
  })
  await laneControl.configure(targetA.id)
  laneControl['config-modal']['http-server-check'].checked = true
  await laneControl['config-modal'].form.listeners.submit({ preventDefault() {} })
  await targetA.notebook.tabs.server.listeners.click()
  const svA = targetA.notebook['server-view']
  await svA['refresh-servers']()
  svA['srv-select'].value = 'srv-exp-1'
  await svA['srv-select'].listeners.change()
  await svA['verify-kv-btn'].listeners.click()
  await svA['deploy-btn'].listeners.click()
  lastWs.emitOpen()
  lastWs.emitMessage({ type: 'init', status: 'running' })
  lastWs.emitMessage({ type: 'output', data: `__CC_DEPLOY_OK__ {"ok":true,"slug":"target-a","port":4100,"publicUrl":"https://api.example.com/target-a","deployedAt":"2026-11-25T13:05:00Z"}\r\n` })
  lastWs.emitMessage({ type: 'status', status: 'exited', exitCode: 0 })
  await new Promise(r => setTimeout(r, 20))
  await laneControl['terminal-modal'].close(true)

  // Verify Target A baseline was cached on deploy
  const snapA = await loadDeployedLaneScript(kv, targetA.id)
  assert.ok(snapA)
  assert.equal(snapA.records[0].text, '!console log  initial')

  // Create Source lane and verify exportLaneLine / setLaneLine appear in Scope
  const sourceLane = await laneControl.add()
  await laneControl.rename(sourceLane.id, 'Source')
  sourceLane.notebook.rows[0]['input-el'].value = "; to message 'hello world'"
  await sourceLane.notebook.rows[0]['input-el'].listeners.input()

  const rootScopeKeys = listScopeEntries(sourceLane.notebook.state, { isRoot: true }).map(e => e.key)
  assert.ok(rootScopeKeys.includes('exportLaneLine'))
  assert.ok(rootScopeKeys.includes('setLaneLine'))

  // Click + Export to add an Export-to-Lane row and select both Target A L1 and Target B L1
  await sourceLane.notebook['add-export-btn'].listeners.click()
  const expModal = laneControl['export-modal']
  assert.equal(expModal['is-open'], true)
  await expModal['select-lane'](targetA.id)
  await expModal['line-els'][0]['toggle-btn'].listeners.click()
  await expModal['select-lane'](targetB.id)
  await expModal['line-els'][0]['toggle-btn'].listeners.click()
  expModal['expr-input'].value = "; add '!console log  ' $message"
  await expModal.form.listeners.submit({ preventDefault() {} })
  await new Promise(r => setTimeout(r, 20))

  const expRow = sourceLane.notebook.rows[1]
  assert.equal(expRow.kind, 'export')
  assert.equal(targetA.notebook.lines[0], '!console log  hello world')
  assert.equal(targetB.notebook.lines[0], '!console log  hello world')

  // Target lines in Civil Command display "Set by Source · L2" and link back to the exporter lane and line
  const targetARow0 = targetA.notebook.rows[0]
  const targetBRow0 = targetB.notebook.rows[0]
  assert.deepEqual(targetARow0['set-by'], { laneId: sourceLane.id, lineId: expRow.record.id })
  assert.deepEqual(targetBRow0['set-by'], { laneId: sourceLane.id, lineId: expRow.record.id })
  assert.equal(targetARow0['set-by-el'].hidden, false)
  assert.equal(targetBRow0['set-by-el'].hidden, false)
  assert.equal(targetARow0['set-by-btn'].textContent, '← Set by Source · L2 ↗')
  assert.equal(targetBRow0['set-by-btn'].textContent, '← Set by Source · L2 ↗')
  assert.ok(targetARow0.el.className.includes('lane-line--set-by'))
  assert.equal(targetARow0.el.attributes['data-set-by-lane'], sourceLane.id)
  assert.equal(targetARow0.el.attributes['data-set-by-line'], expRow.record.id)

  // Clicking "Set by" on Target A L1 when Source lane is minimized restores Source lane, highlights L2, and scrolls horizontally & vertically into view
  const scrollCalls = []
  mockWindow.innerWidth = 1000
  mockWindow.innerHeight = 800
  mockWindow.scrollX = 0
  mockWindow.scrollY = 0
  mockWindow.scrollTo = opts => {
   scrollCalls.push(opts)
   if (typeof opts.left === 'number') { mockWindow.scrollX = opts.left }
   if (typeof opts.top === 'number') { mockWindow.scrollY = opts.top }
  }
  sourceLane.element.getBoundingClientRect = () => ({ left: 750, right: 1150, width: 400, top: 20, bottom: 60, height: 40 })
  expRow.el.getBoundingClientRect = () => ({ left: 760, right: 1140, width: 380, top: 1400, bottom: 1430, height: 30 })
  await laneControl.minimize(sourceLane.id, 'left')
  assert.equal(sourceLane['is-minimized'], true)
  assert.equal(expRow['is-highlighted'], false)
  scrollCalls.length = 0
  await targetARow0['set-by-btn'].listeners.click()
  assert.equal(sourceLane['is-minimized'], false)
  assert.equal(expRow['is-highlighted'], true)
  assert.ok(expRow.el.className.includes('lane-line--highlighted'))
  assert.equal(expRow.el.attributes['data-highlighted'], 'true')
  assert.ok(scrollCalls.length >= 1)
  assert.deepEqual(scrollCalls.at(-1), { left: 246, top: 1023, behavior: 'smooth' })

  // Inverse navigation: from Export line on Source lane, navigate to Target A L1 (via nav-btn) and Target B L1 (via status pill), scrolling vertically even when horizontally in view
  assert.equal(expRow['nav-btn'].hidden, false)
  targetA.element.getBoundingClientRect = () => ({ left: 100, right: 500, width: 400, top: 20, bottom: 60, height: 40 })
  targetARow0.el.getBoundingClientRect = () => ({ left: 110, right: 490, width: 380, top: 1600, bottom: 1630, height: 30 })
  mockWindow.scrollX = 100
  mockWindow.scrollY = 0
  await laneControl.minimize(targetA.id, 'left')
  assert.equal(targetA['is-minimized'], true)
  scrollCalls.length = 0
  await expRow['nav-btn'].listeners.click()
  assert.equal(targetA['is-minimized'], false)
  assert.equal(targetARow0['is-highlighted'], true)
  assert.ok(targetARow0.el.className.includes('lane-line--highlighted'))
  assert.equal(targetARow0.el.attributes['data-highlighted'], 'true')
  assert.deepEqual(scrollCalls.at(-1), { left: 100, top: 1223, behavior: 'smooth' })

  await laneControl.minimize(targetB.id, 'right')
  assert.equal(targetB['is-minimized'], true)
  await expRow['pills-el'].children[1].listeners.click()
  assert.equal(targetB['is-minimized'], false)
  assert.equal(targetBRow0['is-highlighted'], true)
  assert.ok(targetBRow0.el.className.includes('lane-line--highlighted'))
  assert.equal(targetBRow0.el.attributes['data-highlighted'], 'true')

  // Line Info modal on Target A L1 also displays Set By and navigates on click
  await targetARow0['info-btn'].listeners.click()
  const infoModal = laneControl['line-info-modal']
  assert.equal(infoModal['is-open'], true)
  assert.equal(infoModal['set-by-label-el'].hidden, false)
  assert.equal(infoModal['set-by-btn'].textContent, 'Source · L2 ↗')
  await laneControl.minimize(sourceLane.id, 'right')
  assert.equal(sourceLane['is-minimized'], true)
  await infoModal['set-by-btn'].listeners.click()
  assert.equal(infoModal['is-open'], false)
  assert.equal(sourceLane['is-minimized'], false)
  assert.equal(expRow['is-highlighted'], true)

  // Renaming Source lane updates Set-by labels on Target A and Target B live
  await laneControl.rename(sourceLane.id, 'Source Exporter')
  assert.equal(targetARow0['set-by-btn'].textContent, '← Set by Source Exporter · L2 ↗')
  assert.equal(targetBRow0['set-by-btn'].textContent, '← Set by Source Exporter · L2 ↗')
  await laneControl.rename(sourceLane.id, 'Source')
  assert.equal(targetARow0['set-by-btn'].textContent, '← Set by Source · L2 ↗')

  // Export row deploy bar displays pills and Deploy button because Target A changed since last deploy
  assert.equal(expRow['deploy-bar-el'].hidden, false)
  assert.equal(expRow['deploy-btn'].hidden, false)
  const pillTexts = expRow['pills-el'].children.map(el => el.textContent)
  assert.deepEqual(pillTexts, ['Target A: Changes pending', 'Target B: Not deployed'])

  // Update prior line -> live updates both targets again
  sourceLane.notebook.rows[0]['input-el'].value = "; to message 'updated world'"
  await sourceLane.notebook.rows[0]['input-el'].listeners.input()
  await new Promise(r => setTimeout(r, 20))
  assert.equal(targetA.notebook.lines[0], '!console log  updated world')
  assert.equal(targetB.notebook.lines[0], '!console log  updated world')

  // Click Deploy button on Export row -> opens Deploy Changes modal with diff preview
  await expRow['deploy-btn'].listeners.click()
  const depModal = laneControl['export-deploy-modal']
  assert.equal(depModal['is-open'], true)
  assert.equal(depModal.items.length, 2)
  assert.equal(depModal.items[0].checkbox.checked, true)
  assert.equal(depModal.items[0].checkbox.disabled, false)
  assert.equal(depModal.items[1].checkbox.checked, false)
  assert.equal(depModal.items[1].checkbox.disabled, true)
  const diffTexts = depModal.items[0]['diff-el'].children.map(el => el.textContent)
  assert.ok(diffTexts.some(t => t.includes('- L1: !console log  initial')))
  assert.ok(diffTexts.some(t => t.includes('+ L1: !console log  updated world')))

  // Click Deploy Selected -> streams inline terminal, updates baseline, and clears Deploy button
  const deployRunPromise = depModal['deploy-btn'].listeners.click()
  await new Promise(r => setTimeout(r, 15))
  lastWs.emitOpen()
  lastWs.emitMessage({ type: 'init', status: 'running' })
  lastWs.emitMessage({ type: 'output', data: `__CC_DEPLOY_OK__ {"ok":true,"slug":"target-a","port":4100,"publicUrl":"https://api.example.com/target-a","deployedAt":"2026-11-25T13:10:00Z"}\r\n` })
  lastWs.emitMessage({ type: 'status', status: 'exited', exitCode: 0 })
  await deployRunPromise
  await new Promise(r => setTimeout(r, 20))

  assert.equal(depModal.items[0]['badge-el'].textContent, 'Deployed ✓')
  const updatedPills = expRow['pills-el'].children.map(el => el.textContent)
  assert.deepEqual(updatedPills, ['Target A: Up to date', 'Target B: Not deployed'])
  assert.equal(expRow['deploy-btn'].hidden, true)
  await depModal.close()

  // Removing Target B from the Export row clears Set-by on Target B while preserving Target A
  await expRow['pick-btn'].listeners.click()
  await expModal['select-lane'](targetB.id)
  await expModal['line-els'][0]['toggle-btn'].listeners.click()
  await expModal.form.listeners.submit({ preventDefault() {} })
  await new Promise(r => setTimeout(r, 20))
  assert.equal(targetBRow0['set-by'], null)
  assert.equal(targetBRow0['set-by-el'].hidden, true)
  assert.deepEqual(targetARow0['set-by'], { laneId: sourceLane.id, lineId: expRow.record.id })
  assert.equal(targetARow0['set-by-el'].hidden, false)
 }
 finally {
  globalThis.fetch = origFetch
 }
})

test('Lane-scoped modals: block only their lane, expand normal & pinned/floating lane frames to minimum modal size with horizontal/vertical scroll, and keep other lanes usable', async () => {
 const indexHtml = await fs.readFile(new URL('./index.html', import.meta.url), 'utf8')
 assert.match(indexHtml, /\.lane-modal-backdrop--lane,\s*\.lane-modal-backdrop\[data-lane-modal="true"\]\s*\{[^}]*overflow:\s*auto;[^}]*position:\s*absolute;/s)
 assert.match(indexHtml, /\.lane-modal-backdrop--lane\s*>\s*\.lane-modal,\s*\.lane-modal-backdrop\[data-lane-modal="true"\]\s*>\s*\.lane-modal\s*\{[^}]*overflow:\s*auto;/s)
 assert.match(indexHtml, /\.side-rail-preview\[data-modal-open="true"\]\s*\{[^}]*min-height:\s*min\(420px,\s*calc\(100dvh - 32px\)\);[^}]*min-width:\s*min\(480px,\s*calc\(100vw - 80px\)\);[^}]*overflow:\s*auto;/s)

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
 const railsSource = await fs.readFile(new URL('./src/lane-rails.fs', import.meta.url), 'utf8')
 const lineInfoModalSource = await fs.readFile(new URL('./src/lane-line-info-modal.fs', import.meta.url), 'utf8')
 const sessionModalSource = await fs.readFile(new URL('./src/lane-session-modal.fs', import.meta.url), 'utf8')
 const packageModalSource = await fs.readFile(new URL('./src/lane-package-modal.fs', import.meta.url), 'utf8')
 const dirModalSource = await fs.readFile(new URL('./src/lane-dir-modal.fs', import.meta.url), 'utf8')
 const laneServerSource = await fs.readFile(new URL('./src/lane-server.fs', import.meta.url), 'utf8')
 const laneTerminalModalSource = await fs.readFile(new URL('./src/lane-terminal-modal.fs', import.meta.url), 'utf8')
 const laneServersModalSource = await fs.readFile(new URL('./src/lane-servers-modal.fs', import.meta.url), 'utf8')

 function createMockElement(tag) {
  const el = {
   tag,
   nodeType: 1,
   style: {
    props: {},
    setProperty(k, v) { this.props[k] = v },
    getPropertyValue(k) { return this.props[k] || '' },
    removeProperty(k) { delete this.props[k] },
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
   focused: false,
   removed: false,
   rect: { top: 24, left: 0, width: 320, height: 240 },
   getBoundingClientRect() { return this.rect },
   setAttribute(name, value) { this.attributes[name] = value },
   getAttribute(name) { return this.attributes[name] ?? null },
   removeAttribute(name) { delete this.attributes[name] },
   contains(target) {
    if (target === this) return true
    return this.children.some(c => c === target || (c && typeof c.contains === 'function' && c.contains(target)))
   },
   appendChild(child) {
    if (child && child.parentNode && child.parentNode.children) {
     const idx = child.parentNode.children.indexOf(child)
     if (idx !== -1) child.parentNode.children.splice(idx, 1)
    }
    this.children.push(child)
    if (child && typeof child === 'object') {
     child.parentNode = this
     child.removed = false
    }
    return child
   },
   insertBefore(child, ref) {
    if (child && child.parentNode && child.parentNode.children) {
     const oldIdx = child.parentNode.children.indexOf(child)
     if (oldIdx !== -1) child.parentNode.children.splice(oldIdx, 1)
    }
    const idx = this.children.indexOf(ref)
    if (idx === -1) this.children.push(child)
    else this.children.splice(idx, 0, child)
    if (child && typeof child === 'object') {
     child.parentNode = this
     child.removed = false
    }
    return child
   },
   replaceChildren(...nodes) {
    for (const c of this.children) {
     if (c && typeof c === 'object') c.parentNode = null
    }
    this.children = []
    for (const n of nodes) this.appendChild(n)
   },
   addEventListener(event, handler) { this.listeners[event] = handler },
   focus(opts) {
    this.focused = true
    this.lastFocusOptions = opts
   },
   select() {},
   remove() {
    this.removed = true
    if (this.parentNode && this.parentNode.children) {
     const idx = this.parentNode.children.indexOf(this)
     if (idx !== -1) this.parentNode.children.splice(idx, 1)
    }
    this.parentNode = null
   },
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
  innerHeight: 900,
  innerWidth: 1440,
  location: { pathname: '/', search: '', hash: '' },
  history: {
   pushState(_s, _t, url) {
    if (typeof url === 'string') mockWindow.location.pathname = url.split('?')[0].split('#')[0] || '/'
   },
   replaceState(_s, _t, url) {
    if (typeof url === 'string') mockWindow.location.pathname = url.split('?')[0].split('#')[0] || '/'
   },
  },
  crypto: { randomUUID: () => `modal-lane-${++uuid}` },
  addEventListener(event, handler) {
   if (!windowListeners[event]) windowListeners[event] = []
   windowListeners[event].push(handler)
  },
  removeEventListener() {},
 }

 const origFetch = globalThis.fetch
 globalThis.fetch = async url => {
  if (url === '/src/main.fs') return { text: async () => mainSource }
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
  if (url === '/src/lane-rails.fs') return { text: async () => railsSource }
  if (url === '/src/lane-line-info-modal.fs') return { text: async () => lineInfoModalSource }
  if (url === '/src/lane-session-modal.fs') return { text: async () => sessionModalSource }
  if (url === '/src/lane-package-modal.fs') return { text: async () => packageModalSource }
  if (url === '/src/lane-dir-modal.fs') return { text: async () => dirModalSource }
  if (url === '/src/lane-server.fs') return { text: async () => laneServerSource }
  if (url === '/src/lane-story.fs') return { text: async () => laneStorySource }
  if (url === '/src/lane-terminal-modal.fs') return { text: async () => laneTerminalModalSource }
  if (url === '/src/lane-servers-modal.fs') return { text: async () => laneServersModalSource }
  throw new Error(`Unexpected fetch: ${url}`)
 }

 try {
  const mockBody = createMockElement('body')
  const docEl = Object.assign(createMockElement('html'), {
   scrollTop: 0,
   scrollLeft: 0,
   clientHeight: 900,
   clientWidth: 1440,
  })
  const f = field({
   ...DATA_RUNTIME_ENV,
   console: { log() {} },
   createIdleTracker,
   data: createMockKV(),
   defaultValueForType,
   document: {
    body: mockBody,
    documentElement: docEl,
    defaultView: mockWindow,
    createElement: createMockElement,
    addEventListener() {},
   },
   formatExportLine,
   formatImportLine,
   hasImportCycle,
   normalizePrimitiveType,
   parseExportLine,
   parseImportLine,
   primitiveTypes: PRIMITIVE_TYPES,
   resolveImportValue,
   resolveScopeColumns,
   runLines,
   runTransportedScripts,
   window: mockWindow,
  })

  await f.run(parse(mainSource, '/src/main.fs'))
  const laneControl = f.state['lane-control']
  const rails = laneControl.rails
  const rowPicker = laneControl['row-picker-modal']
  const confirmModal = laneControl['confirm-modal']
  const configModal = laneControl['config-modal']
  const importModal = laneControl['import-modal']
  const exportModal = laneControl['export-modal']
  const lineInfoModal = laneControl['line-info-modal']

  // Create two lanes: Lane 1 (narrow 140px width) and Lane 2 (wide 640px width)
  await f.state.tableHeadRowAddButton.listeners.click()
  await f.state.tableHeadRowAddButton.listeners.click()
  const [lane1, lane2] = f.state.lanes
  await laneControl.rename(lane1.id, 'Orders Lane')
  await laneControl.rename(lane2.id, 'Scratchpad Lane')
  await laneControl['set-width'](lane1.id, 140)
  await laneControl['set-width'](lane2.id, 640)
  assert.equal(lane1.width, 140)
  assert.equal(lane1['rendered-width'], 140)
  assert.equal(lane1.element.style.width, '140px')
  assert.equal(lane1.body.style.width, '140px')

  // Setup a linked row table in Lane 1 Data tab
  await lane1.notebook.tabs.data.listeners.click()
  const dv1 = lane1.notebook['data-view']
  await dv1['add-table']('items')
  const itemCol = await dv1['add-column']('code', 'text', false)
  const itemRow = await dv1['add-row']()
  dv1['grid-rows'][0].cells[0]['input-el'].value = 'ITEM-1'
  await dv1['grid-rows'][0].cells[0]['input-el'].listeners.input()

  await dv1['add-table']('cart')
  const refCol = await dv1['add-column']('item', 'row', false)
  dv1['schema-rows'][0]['ref-table-el'].value = dv1.tables[0].id
  await dv1['schema-rows'][0]['ref-table-el'].listeners.change()
  dv1['schema-rows'][0]['ref-col-el'].value = itemCol.id
  await dv1['schema-rows'][0]['ref-col-el'].listeners.change()
  await dv1['add-row']()

  // 1. Open Select Row modal in Lane 1 (restored frame):
  // - Mounts inside lane1.body (NOT document.body)
  // - Expands narrow 140px lane1 to 480px min modal width & 420px min height while preserving lane1.width = 140
  // - Lane 2 remains completely unblocked and usable while Lane 1's modal is open
  await dv1['grid-rows'][0].cells[0]['trigger-el'].listeners.click()
  assert.equal(rowPicker['is-open'], true)
  assert.ok(lane1.body.children.includes(rowPicker.backdrop))
  assert.ok(!mockBody.children.includes(rowPicker.backdrop))
  assert.equal(rowPicker.backdrop.attributes['data-lane-modal'], 'true')
  assert.equal(rowPicker.backdrop.attributes['data-lane-id'], lane1.id)
  assert.match(rowPicker.backdrop.className, /lane-modal-backdrop--lane/)
  assert.equal(lane1['has-open-modal'], true)
  assert.equal(lane1.width, 140)
  assert.equal(lane1['rendered-width'], 140)
  assert.equal(lane1['effective-width'], 480)
  assert.equal(lane1.element.style.width, '480px')
  assert.equal(lane1.body.style.width, '480px')
  assert.equal(lane1.body.style.minWidth, '480px')
  assert.equal(lane1.body.style.minHeight, '420px')
  assert.equal(lane1.body.attributes['data-modal-open'], 'true')

  // While Lane 1's Select Row modal is open, interact with Lane 2 normally (run code & open Configure Lane modal on Lane 2!)
  lane2.notebook.rows[0]['input-el'].value = '; multiply 7 6'
  await lane2.notebook.rows[0]['input-el'].listeners.input()
  assert.equal(lane2.notebook.rows[0]['preview-el'].textContent, '42')

  await lane2['config-btn'].listeners.click()
  assert.equal(configModal['is-open'], true)
  assert.ok(lane2.body.children.includes(configModal.backdrop))
  assert.ok(!mockBody.children.includes(configModal.backdrop))
  // Lane 2 is already 640px (>= 480px), so it keeps its 640px width without shrinking
  assert.equal(lane2['effective-width'], 640)
  assert.equal(lane2.element.style.width, '640px')
  assert.equal(lane2.body.style.width, '640px')
  await configModal.close()
  assert.equal(configModal['is-open'], false)
  assert.equal(lane2['has-open-modal'], false)

  // Pick row in Lane 1's Select Row modal -> closes modal and restores Lane 1 back to 140px width
  await rowPicker['option-items'][0].el.listeners.click()
  assert.equal(rowPicker['is-open'], false)
  assert.equal(lane1['has-open-modal'], false)
  assert.equal(lane1['effective-width'], 140)
  assert.equal(lane1.element.style.width, '140px')
  assert.equal(lane1.body.style.width, '140px')
  assert.equal(lane1.body.style.minHeight, '')
  assert.equal(lane1.body.attributes['data-modal-open'], undefined)

  // 2. Test Line Info, Import, Export, and Confirm modals in Lane 1 also mount inside lane1.body
  await lane1.notebook.tabs.source.listeners.click()
  await lane1.notebook.rows[0]['info-btn'].listeners.click()
  assert.equal(lineInfoModal['is-open'], true)
  assert.ok(lane1.body.children.includes(lineInfoModal.backdrop))
  assert.equal(lane1.body.style.width, '480px')
  await lineInfoModal.close()
  assert.equal(lane1.body.style.width, '140px')

  await lane1.notebook['add-import-btn'].listeners.click()
  assert.equal(importModal['is-open'], true)
  assert.ok(lane1.body.children.includes(importModal.backdrop))
  assert.equal(lane1.body.style.width, '480px')
  await importModal.close()
  assert.equal(lane1.body.style.width, '140px')

  await lane1.notebook['add-export-btn'].listeners.click()
  assert.equal(exportModal['is-open'], true)
  assert.ok(lane1.body.children.includes(exportModal.backdrop))
  assert.equal(lane1.body.style.width, '480px')
  await exportModal.close()
  assert.equal(lane1.body.style.width, '140px')

  // 3. Minimize Lane 1 to left rail and pin its floating frame open
  await lane1.notebook.tabs.data.listeners.click()
  await lane1['min-left-btn'].listeners.click()
  assert.equal(lane1['is-minimized'], true)
  const lane1RailIcon = rails['left-items'][0]['icon-el']
  await lane1RailIcon.listeners.click({ stopPropagation() {} })
  assert.equal(rails['is-preview-pinned'], true)
  assert.equal(rails['pinned-lane'], lane1)
  assert.equal(rails['preview-header'].style.width, '140px')
  assert.equal(rails['preview-body'].style.width, '140px')

  // Open Select Row modal inside the pinned floating frame:
  // - Modal backdrop mounts inside rails['preview-body'] (inside floating lane area)
  // - Floating frame expands from 140px to 480px min-width and 420px min-height
  // - Background minimized table cell stays unexpanded (width: '')
  await dv1['grid-rows'][0].cells[0]['trigger-el'].listeners.click()
  assert.equal(rowPicker['is-open'], true)
  assert.ok(rails['preview-body'].children.includes(rowPicker.backdrop))
  assert.ok(!lane1.body.children.includes(rowPicker.backdrop))
  assert.ok(!mockBody.children.includes(rowPicker.backdrop))
  assert.equal(rails['preview-el'].attributes['data-modal-open'], 'true')
  assert.equal(rails['preview-el'].style.minWidth, '480px')
  assert.equal(rails['preview-el'].style.minHeight, '420px')
  assert.equal(rails['preview-header'].style.width, '480px')
  assert.equal(rails['preview-body'].style.width, '480px')
  assert.equal(rails['preview-body'].style.minWidth, '480px')
  assert.equal(rails['preview-body'].style.minHeight, '420px')
  assert.equal(lane1.body.style.width, '')

  // Close Select Row modal inside the pinned frame -> floating frame returns to 140px
  await rowPicker.close()
  assert.equal(rowPicker['is-open'], false)
  assert.equal(rails['preview-el'].attributes['data-modal-open'], undefined)
  assert.equal(rails['preview-el'].style.minWidth, '')
  assert.equal(rails['preview-el'].style.minHeight, '')
  assert.equal(rails['preview-header'].style.width, '140px')
  assert.equal(rails['preview-body'].style.width, '140px')

  // Open Confirm modal (Delete row) inside the pinned frame, then click the floating Restore button while modal is open:
  // - Lane restores into the main table with the modal still open inside lane1.body and expanded to 480px!
  await dv1['grid-rows'][0]['remove-btn'].listeners.click()
  assert.equal(confirmModal['is-open'], true)
  assert.ok(rails['preview-body'].children.includes(confirmModal.backdrop))
  assert.equal(rails['preview-body'].style.width, '480px')

  await rails['restore-btn'].listeners.click({ stopPropagation() {} })
  assert.equal(lane1['is-minimized'], false)
  assert.equal(confirmModal['is-open'], true)
  assert.ok(lane1.body.children.includes(confirmModal.backdrop))
  assert.equal(lane1.body.style.width, '480px')
  assert.equal(lane1.body.style.minHeight, '420px')

  // Cancel confirm modal -> Lane 1 returns to its configured 140px width
  await confirmModal['cancel-btn'].listeners.click()
  assert.equal(confirmModal['is-open'], false)
  assert.equal(lane1.body.style.width, '140px')
  assert.equal(lane1.body.style.minHeight, '')

  // 4. Removing an array item down at row #8 floats Confirm modal vertically to the user's current position without scrolling to top or altering horizontal scroll
  await dv1['add-col-btn'].listeners.click()
  dv1['schema-rows'][1]['name-el'].value = 'phone'
  await dv1['schema-rows'][1]['name-el'].listeners.input()
  await dv1['schema-rows'][1]['multi-btn'].listeners.click()
  while (dv1['grid-rows'].length < 8) {
   await dv1['add-row']()
  }
  const phoneCell8 = dv1['grid-rows'][7].cells[1]
  await phoneCell8['add-btn'].listeners.click()
  await phoneCell8['add-btn'].listeners.click()
  assert.equal(phoneCell8.items.length, 2)

  // Simulate scrolled viewport at row #8 (horizontal scroll 180px must stay untouched; vertical scroll 740px must not reset to top)
  docEl.scrollTop = 740
  docEl.scrollLeft = 180
  lane1.body.rect = { top: -620, bottom: 1380, left: 0, width: 640, height: 2000 }
  confirmModal.panel.rect = { top: -610, bottom: -430, left: 12, width: 420, height: 180 }
  for (const h of windowListeners.pointerdown || []) {
   await h({ type: 'pointerdown', clientY: 460 })
  }

  await phoneCell8.items[0]['remove-btn'].listeners.click()
  assert.equal(confirmModal['is-open'], true)
  assert.equal(confirmModal['message-el'].textContent, 'Remove item #1 ("") from "phone" in row #8?')
  assert.equal(confirmModal.panel.style.marginTop, '1007px')
  assert.equal(confirmModal['top-offset'], 1007)
  assert.equal(confirmModal['cancel-btn'].lastFocusOptions?.preventScroll, true)
  assert.equal(docEl.scrollTop, 740)
  assert.equal(docEl.scrollLeft, 180)

  await confirmModal['confirm-btn'].listeners.click()
  assert.equal(confirmModal['is-open'], false)
  assert.equal(confirmModal.panel.style.marginTop, '')
  assert.equal(dv1['grid-rows'][7].cells[1].items.length, 1)
  assert.equal(docEl.scrollTop, 740)
  assert.equal(docEl.scrollLeft, 180)
 }
 finally {
  globalThis.fetch = origFetch
 }
})

test('storage.mjs & agent-api.mjs: guarantee all saved Lane Source lines are parseable and persist rejected drafts in localStorage', async () => {
 const indexHtml = await fs.readFile(new URL('./index.html', import.meta.url), 'utf8')
 assert.match(indexHtml, /\.lane-line--draft-rejected\b/)
 assert.match(indexHtml, /\.lane-line-draft\s*\{/)
 assert.match(indexHtml, /\.lane-line-draft-btn--restore\s*\{/)

 const store = new Map()
 const makeKv = (ns = '', basePath = null) => {
  const isHash = ns.includes('#')
  const qual = k => (isHash ? (ns.endsWith('#') ? `${ns}${k}` : `${ns}/${k}`) : (ns ? `${ns}.${k}` : k))
  const c = {
   prefix: ns,
   basePath,
   root: null,
   defaultRoot: null,
   getActiveClient() { return c },
   withBasePath(dir) { return makeKv(dir ? `dir:${dir}` : '', dir || null) },
   setBasePath() { return c },
   namespace: name => makeKv(isHash ? qual(encodeKeySegment(name)) : qual(name), basePath),
   hashNamespace: name => makeKv(`${encodeKeySegment(name)}#`, basePath),
   async get(k) { const q = qual(k); return store.has(q) ? store.get(q) : null },
   async set(k, v) { store.set(qual(k), String(v)) },
   async delete(k) { store.delete(qual(k)) },
  }
  c.root = c
  c.defaultRoot = c
  return c
 }
 const kv = makeKv()
 const laneData = kv.namespace('lane-guard')

 const localMap = new Map()
 const mockWin = {
  localStorage: {
   getItem: k => (localMap.has(k) ? localMap.get(k) : null),
   setItem: (k, v) => localMap.set(k, String(v)),
   removeItem: k => localMap.delete(k),
  },
 }

 // 1. saveLaneScript, saveScriptLine, and saveScriptLinesAndIndex reject unparseable code before writing KV
 await assert.rejects(
  () => saveLaneScript(kv, laneData, 'lane-guard', ['; to ok 1', '; to broken ('], mockWin),
  SyntaxError
 )
 assert.equal((await loadLaneScript(kv, laneData, 'lane-guard', mockWin)).initialized, false)

 const savedValid = await saveLaneScript(
  kv,
  laneData,
  'lane-guard',
  [{ id: 'ln-1', text: '; to count 5', updatedAt: '2026-11-26T10:00:00.000Z' }],
  mockWin,
  null
 )
 assert.equal(savedValid.length, 1)

 const badRec = { id: 'ln-1', text: "; console.log 'bad'", updatedAt: '2026-11-26T10:00:00.000Z' }
 await assert.rejects(
  () => saveScriptLine(kv, laneData, 'lane-guard', badRec, ['ln-1'], false),
  SyntaxError
 )
 assert.equal(badRec.updatedAt, '2026-11-26T10:00:00.000Z')
 assert.deepEqual((await loadLaneScript(kv, laneData, 'lane-guard', mockWin)).records.map(r => r.text), ['; to count 5'])

 await assert.rejects(
  () => saveScriptLinesAndIndex(kv, laneData, 'lane-guard', [{ id: 'ln-2', text: '[ add 1' }], ['ln-1', 'ln-2'], []),
  SyntaxError
 )
 assert.deepEqual((await loadLaneScript(kv, laneData, 'lane-guard', mockWin)).records.map(r => r.text), ['; to count 5'])

 // 2. setTargetLaneLine rejects syntax errors, preserves KV, stores draft in localStorage when win is passed, and clears draft on valid update
 const rejTarget = await setTargetLaneLine(kv, 'lane-guard', 'ln-1', '; to count (', mockWin, {
  laneId: 'lane-exporter',
  lineId: 'ln-exp-1',
 })
 assert.equal(rejTarget.ok, false)
 assert.equal(rejTarget.syntaxError, true)
 assert.equal(rejTarget.changed, false)
 assert.ok(rejTarget.draft)
 assert.equal(rejTarget.draft.text, '; to count (')
 assert.equal(rejTarget.draft.savedText, '; to count 5')
 assert.deepEqual((await loadLaneScript(kv, laneData, 'lane-guard', mockWin)).records.map(r => r.text), ['; to count 5'])

 const draftsKey = laneSourceDraftsStorageKey('lane-guard', kv)
 assert.equal(draftsKey, `${LANE_SOURCE_DRAFTS_STORAGE_PREFIX}:lane-guard`)
 assert.ok(localMap.has(draftsKey))
 assert.equal(loadLaneSourceDrafts(kv, mockWin, 'lane-guard')['ln-1'].text, '; to count (')
 assert.equal(listLaneSourceDrafts(kv, mockWin, 'lane-guard').length, 1)

 const okTarget = await setTargetLaneLine(kv, 'lane-guard', 'ln-1', '; to count 99', mockWin)
 assert.equal(okTarget.ok, true)
 assert.equal(okTarget.changed, true)
 assert.equal(localMap.has(draftsKey), false)
 assert.deepEqual(loadLaneSourceDrafts(kv, mockWin, 'lane-guard'), {})

 // Custom dataDir scopes localStorage draft keys independently
 const scopedKv = kv.withBasePath('/tmp/ws-alpha')
 saveLaneSourceDraft(scopedKv, mockWin, 'lane-guard', { lineId: 'ln-1', text: '; bad', savedText: '' })
 assert.equal(laneSourceDraftsStorageKey('lane-guard', scopedKv), `${LANE_SOURCE_DRAFTS_STORAGE_PREFIX}:/tmp/ws-alpha:lane-guard`)
 assert.equal(listLaneSourceDrafts(scopedKv, mockWin, 'lane-guard').length, 1)
 assert.equal(listLaneSourceDrafts(kv, mockWin, 'lane-guard').length, 0)
 clearAllLaneSourceDrafts(scopedKv, mockWin, 'lane-guard')
 assert.equal(listLaneSourceDrafts(scopedKv, mockWin, 'lane-guard').length, 0)

 // 3. agentCreateLane, agentMutateLaneScript, and MCP reject unparseable FieldScript without mutating KV
 const badCreate = await agentCreateLane(kv, {
  id: 'agent-bad-lane',
  title: 'Broken Agent Lane',
  lines: ['; to ok 1', "; to broken 'unterminated"],
 })
 assert.equal(badCreate.ok, false)
 assert.equal(badCreate.syntaxError, true)
 assert.equal(await kv.namespace('agent-bad-lane').get('title'), null)

 const goodCreate = await agentCreateLane(kv, {
  id: 'agent-good-lane',
  title: 'Valid Agent Lane',
  lines: ['; to score 10', '$score'],
 })
 assert.equal(goodCreate.ok, true)

 for (const badMutation of [
  { laneId: 'agent-good-lane', action: 'set-line', lineNumber: 1, text: '; to score (' },
  { laneId: 'agent-good-lane', action: 'append-line', text: '; notACommand 1' },
  { laneId: 'agent-good-lane', action: 'insert-line', lineNumber: 1, text: '[ add 1' },
  { laneId: 'agent-good-lane', action: 'replace-script', lines: ['; to score 20', '; to incomplete'] },
 ]) {
  const mutRes = await agentMutateLaneScript(kv, badMutation)
  assert.equal(mutRes.ok, false)
  assert.equal(mutRes.syntaxError, true)
 }

 const mcpBad = await handleMcpJsonRpc(kv, {
  jsonrpc: '2.0',
  id: 77,
  method: 'tools/call',
  params: {
   name: 'cc_update_script',
   arguments: {
    laneId: 'agent-good-lane',
    action: 'set-line',
    lineNumber: 1,
    text: '; brokenCmd 123',
   },
  },
 })
 assert.equal(mcpBad.result.isError, true)
 assert.equal(mcpBad.result.structuredContent.syntaxError, true)

 const afterLane = await agentGetLane(kv, { laneId: 'agent-good-lane' })
 assert.deepEqual(afterLane.lane.lines, ['; to score 10', '$score'])
})

test('Lane Source UI: rejects unparseable edits from saving, stores drafts in localStorage, shows rejected draft on reload, and supports Edit draft & Discard', async () => {
 const notebookSource = await fs.readFile(new URL('./src/lane-notebook.fs', import.meta.url), 'utf8')
 const laneSource = await fs.readFile(new URL('./src/lane-control.fs', import.meta.url), 'utf8')
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
   style: { setProperty() {}, removeProperty() {}, getPropertyValue() { return '' } },
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
   focused: false,
   removed: false,
   selectionStart: null,
   selectionEnd: null,
   setAttribute(name, value) { this.attributes[name] = value },
   removeAttribute(name) { delete this.attributes[name] },
   appendChild(child) {
    if (child && typeof child === 'object') {
     if (child.parentNode && Array.isArray(child.parentNode.children)) {
      const idx = child.parentNode.children.indexOf(child)
      if (idx !== -1) child.parentNode.children.splice(idx, 1)
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
   setSelectionRange(s, e) { this.selectionStart = s; this.selectionEnd = e },
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

 const localMap = new Map()
 const localStore = {
  getItem: k => (localMap.has(k) ? localMap.get(k) : null),
  setItem: (k, v) => localMap.set(k, String(v)),
  removeItem: k => localMap.delete(k),
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
  String,
  decodeURIComponent,
  localStorage: localStore,
  crypto: { randomUUID: () => `draft-uuid-${++uuid}` },
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

 async function mountLaneNotebook(laneId) {
  const logs = []
  const f = field({
   ...DATA_RUNTIME_ENV,
   console: { log: (...a) => logs.push(a.join(' ')) },
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
  const notebookMod = await f.run(parse(notebookSource, '/src/lane-notebook.fs'))
  const container = createMockElement('td')
  const lane = { id: laneId, data: rootKv.namespace(laneId) }
  const nb = await notebookMod.mount(lane, container)
  return { nb, logs }
 }

 try {
  // 1. Brand-new uninitialized lane: typing unparseable code does NOT write KV, stores draft in localStorage, and restores banner on reload
  const { nb: freshNb } = await mountLaneNotebook('fresh-draft-lane')
  freshNb.rows[0]['input-el'].value = "; to greeting 'unclosed"
  await freshNb.rows[0]['input-el'].listeners.input()

  assert.equal((await loadLaneScript(rootKv, rootKv.namespace('fresh-draft-lane'), 'fresh-draft-lane', mockWindow)).initialized, false)
  assert.equal(freshNb.rows[0]['draft-active'], true)
  assert.equal(freshNb.rows[0]['draft-el'].hidden, false)
  assert.match(freshNb.rows[0].el.className, /lane-line--draft-rejected/)
  assert.equal(listLaneSourceDrafts(rootKv, mockWindow, 'fresh-draft-lane').length, 1)

  const { nb: freshReloaded } = await mountLaneNotebook('fresh-draft-lane')
  assert.equal(freshReloaded.lines[0], '')
  assert.equal(freshReloaded.rows[0]['draft-active'], false)
  assert.equal(freshReloaded.rows[0]['draft-el'].hidden, false)
  assert.equal(freshReloaded.rows[0]['draft-code'].textContent, "; to greeting 'unclosed")
  assert.equal(freshReloaded.rows[0]['draft-restore-btn'].hidden, false)
  await freshReloaded.rows[0]['draft-discard-btn'].listeners.click()
  assert.equal(freshReloaded.rows[0].draft, null)
  assert.equal(listLaneSourceDrafts(rootKv, mockWindow, 'fresh-draft-lane').length, 0)

  // 2. Saved lane: valid line persists; subsequent syntax error stays in localStorage draft without overwriting KV
  const { nb } = await mountLaneNotebook('calc-draft-lane')
  const row0 = nb.rows[0]
  row0['input-el'].value = '; to base 10'
  await row0['input-el'].listeners.input()
  assert.equal(row0['preview-el'].textContent, '10')
  assert.equal(row0.draft, null)
  assert.deepEqual(
   (await loadLaneScript(rootKv, rootKv.namespace('calc-draft-lane'), 'calc-draft-lane', mockWindow)).records.map(r => r.text),
   ['; to base 10']
  )

  // Type unclosed '(' -> rejected from KV, live preview shows error, Discard draft reverts to '; to base 10'
  row0['input-el'].value = '; to base ('
  await row0['input-el'].listeners.input()
  assert.match(row0['preview-el'].textContent, /Unclosed block '\('/)
  assert.equal(row0.record.text, '; to base 10')
  assert.equal(row0['draft-active'], true)
  assert.equal(row0['draft-el'].hidden, false)
  assert.deepEqual(
   (await loadLaneScript(rootKv, rootKv.namespace('calc-draft-lane'), 'calc-draft-lane', mockWindow)).records.map(r => r.text),
   ['; to base 10']
  )

  await row0['draft-discard-btn'].listeners.click()
  assert.equal(row0['input-el'].value, '; to base 10')
  assert.equal(row0['preview-el'].textContent, '10')
  assert.equal(row0.draft, null)
  assert.equal(listLaneSourceDrafts(rootKv, mockWindow, 'calc-draft-lane').length, 0)

  // Type invalid command '; console.log ...' via individual line editor and leave unfixed across reload
  await row0['num-el'].listeners.click()
  row0['editor-el'].value = "; console.log 'wrong sigil'"
  await row0['editor-el'].listeners.input()
  assert.equal(row0['draft-active'], true)
  assert.equal(row0.record.text, '; to base 10')
  assert.deepEqual(
   (await loadLaneScript(rootKv, rootKv.namespace('calc-draft-lane'), 'calc-draft-lane', mockWindow)).records.map(r => r.text),
   ['; to base 10']
  )

  // Reload lane later -> saved '; to base 10' runs cleanly while rejected draft banner is shown with Edit draft & Discard
  const { nb: reloadedNb, logs: reloadedLogs } = await mountLaneNotebook('calc-draft-lane')
  const rRow0 = reloadedNb.rows[0]
  assert.equal(rRow0['input-el'].value, '; to base 10')
  assert.equal(rRow0['preview-el'].textContent, '10')
  assert.equal(rRow0['draft-active'], false)
  assert.equal(rRow0['draft-el'].hidden, false)
  assert.equal(rRow0['draft-code'].textContent, "; console.log 'wrong sigil'")
  assert.match(rRow0['draft-err'].textContent, /is not a valid FieldScript command/)
  assert.equal(rRow0['draft-restore-btn'].hidden, false)

  // Click 'Edit draft' -> loads rejected draft into line input so user can fix it; fixing saves to KV and clears draft
  await rRow0['draft-restore-btn'].listeners.click()
  assert.equal(rRow0['input-el'].value, "; console.log 'wrong sigil'")
  assert.equal(rRow0['draft-active'], true)
  assert.match(rRow0['preview-el'].textContent, /is not a valid FieldScript command/)

  rRow0['input-el'].value = "!console.log 'fixed sigil'"
  await rRow0['input-el'].listeners.input()
  assert.equal(rRow0.draft, null)
  assert.equal(rRow0['draft-el'].parentNode, null)
  assert.deepEqual(reloadedLogs.at(-1), 'fixed sigil')
  assert.equal(listLaneSourceDrafts(rootKv, mockWindow, 'calc-draft-lane').length, 0)
  assert.deepEqual(
   (await loadLaneScript(rootKv, rootKv.namespace('calc-draft-lane'), 'calc-draft-lane', mockWindow)).records.map(r => r.text),
   ["!console.log 'fixed sigil'"]
  )

  // 3. Multi-line paste with an unparseable middle line saves valid lines to KV (blank safe slot for broken line) and stores draft
  rRow0['input-el'].selectionStart = 0
  rRow0['input-el'].selectionEnd = rRow0['input-el'].value.length
  const pasteEv = {
   clipboardData: { getData: () => '; to a 2\n; to broken (\n; add $a 3' },
   preventDefault() {},
  }
  await rRow0['input-el'].listeners.paste(pasteEv)
  assert.equal(reloadedNb.rows.length, 3)
  const storedAfterPaste = await loadLaneScript(rootKv, rootKv.namespace('calc-draft-lane'), 'calc-draft-lane', mockWindow)
  assert.deepEqual(storedAfterPaste.records.map(r => r.text), ['; to a 2', '', '; add $a 3'])
  for (const rec of storedAfterPaste.records) {
   assert.equal(isParseableFieldScriptLine(rec.text), true)
  }
  assert.equal(reloadedNb.rows[1].draft.text, '; to broken (')
  assert.equal(listLaneSourceDrafts(rootKv, mockWindow, 'calc-draft-lane').length, 1)

  // Removing the broken row clears its draft from localStorage
  await reloadedNb.rows[1]['remove-btn'].listeners.click()
  assert.equal(listLaneSourceDrafts(rootKv, mockWindow, 'calc-draft-lane').length, 0)

  // 4. Export modal blocks confirming an unparseable expression with inline error status
  const expF = field({
   ...DATA_RUNTIME_ENV,
   data: rootKv,
   document: mockDocument,
   window: mockWindow,
  })
  const exportModalMod = await expF.run(parse(exportModalSource, '/src/lane-export-modal.fs'))
  let confirmedSpec = null
  const expModal = await exportModalMod.create({
   lanes: [],
   'by-id': {},
   'list-known': async () => [],
  })
  await expModal.open({
   'current-lane-id': 'calc-draft-lane',
   targets: [{ laneId: 'target-lane', lineId: 'ln-t1' }],
   'content-expr': "; add 'unclosed",
   'on-confirm': spec => { confirmedSpec = spec },
  })
  await expModal.confirm()
  assert.equal(expModal['is-open'], true)
  assert.equal(confirmedSpec, null)
  assert.equal(expModal['status-el'].hidden, false)
  assert.match(expModal['status-el'].textContent, /Syntax error/)

  expModal['expr-input'].value = "; add 'ok:' $a"
  await expModal.confirm()
  assert.equal(expModal['is-open'], false)
  assert.equal(confirmedSpec.contentExpr, "; add 'ok:' $a")
 }
 finally {
  globalThis.fetch = origFetch
 }
})

test('Export to Lane enforces atomic package-lock staging, sequential Open/Unlock Package modal, cancel/retry, and SSE export-unlock-required', async () => {
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
   innerHTML: '',
   value: '',
   checked: false,
   className: '',
   title: '',
   hidden: false,
   disabled: false,
   readOnly: false,
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
   focus(opts) {
    this.focused = true
    this.lastFocusOptions = opts
   },
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
 const accessedKeys = []
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
   async get(k) {
    const q = qual(k)
    accessedKeys.push({ op: 'get', key: q })
    return store.has(q) ? store.get(q) : null
   },
   async set(k, v) {
    const q = qual(k)
    accessedKeys.push({ op: 'set', key: q })
    store.set(q, String(v))
   },
   async delete(k) {
    const q = qual(k)
    accessedKeys.push({ op: 'delete', key: q })
    store.delete(q)
   },
  }
  c.root = c
  c.defaultRoot = c
  return c
 }
 const kv = makeKv()

 const makeStorage = () => {
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
  localStorage: makeStorage(),
  sessionStorage: makeStorage(),
  crypto: { randomUUID: () => `exp-lock-uuid-${++uuid}` },
  history: { pushState(_s, _t, url) { mockWindow.location.pathname = url } },
  location: { pathname: '/', protocol: 'http:', host: 'localhost:8080' },
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
  })
  await f.run(parse(mainSource, '/src/main.fs'))
  const laneControl = f.state['lane-control']
  await laneControl['dir-modal']['default-btn'].listeners.click()

  // 1. Seed Open target (Default), Closed non-passphrase package target, Vault passphrase package target, and Source lane
  const targetOpen = await laneControl.add()
  await laneControl.rename(targetOpen.id, 'Target Open')
  targetOpen.notebook.rows[0]['input-el'].value = "; to v 'init'"
  await targetOpen.notebook.rows[0]['input-el'].listeners.input()

  const pkgConfirmRes = await laneControl['create-package']('PkgConfirm', '')
  assert.equal(pkgConfirmRes.ok, true)
  const targetClosed = await laneControl.add()
  await laneControl.rename(targetClosed.id, 'Target Closed')
  targetClosed.notebook.rows[0]['input-el'].value = "; to v 'init'"
  await targetClosed.notebook.rows[0]['input-el'].listeners.input()

  const pkgVaultRes = await laneControl['create-package']('PkgVault', 'vault-pw')
  assert.equal(pkgVaultRes.ok, true)
  const targetVault = await laneControl.add()
  await laneControl.rename(targetVault.id, 'Target Vault')
  targetVault.notebook.rows[0]['input-el'].value = "; to v 'init'"
  await targetVault.notebook.rows[0]['input-el'].listeners.input()

  await laneControl['set-active-package']('default')
  const sourceLane = await laneControl.add()
  await laneControl.rename(sourceLane.id, 'Source')
  sourceLane.notebook.rows[0]['input-el'].value = '; to ready true'
  await sourceLane.notebook.rows[0]['input-el'].listeners.input()

  // 2. Wire multi-target Export-to-Lane row targeting Target Open, Target Closed, and Target Vault
  await sourceLane.notebook['add-export-btn'].listeners.click()
  const expModal = laneControl['export-modal']
  assert.equal(expModal['is-open'], true)
  await expModal['select-lane'](targetOpen.id)
  await expModal['line-els'][0]['toggle-btn'].listeners.click()
  await expModal['select-lane'](targetClosed.id)
  await expModal['line-els'][0]['toggle-btn'].listeners.click()
  await expModal['select-lane'](targetVault.id)
  await expModal['line-els'][0]['toggle-btn'].listeners.click()
  expModal['expr-input'].value = '\'; to v "exported"\''
  await expModal.form.listeners.submit({ preventDefault() {} })
  await new Promise(r => setTimeout(r, 20))

  const expRow = sourceLane.notebook.rows[1]
  assert.equal(expRow.kind, 'export')
  const vaultLineId = targetVault.notebook['line-records'][0].id

  // Reset all 3 targets back to init, then close both PkgConfirm and PkgVault
  for (const tgt of [targetOpen, targetClosed, targetVault]) {
   tgt.notebook.rows[0]['input-el'].value = "; to v 'init'"
   await tgt.notebook.rows[0]['input-el'].listeners.input()
  }
  await laneControl['close-package'](pkgConfirmRes.pkg.id)
  await laneControl['close-package'](pkgVaultRes.pkg.id)

  const mountedClosed = laneControl['by-id'][targetClosed.id]
  const mountedVault = laneControl['by-id'][targetVault.id]
  assert.equal(mountedClosed['is-locked'], true)
  assert.equal(mountedVault['is-locked'], true)

  // Verify export-modal filters out locked mounted lanes
  await expRow['pick-btn'].listeners.click()
  assert.equal(expModal['is-open'], true)
  const selectableIds = expModal['lane-items'].map(it => it.id)
  assert.ok(selectableIds.includes(targetOpen.id))
  assert.ok(!selectableIds.includes(targetClosed.id))
  assert.ok(!selectableIds.includes(targetVault.id))
  await expModal.close()

  // 3. Run Source while both packages are closed -> zero KV reads/writes on locked lane scripts/deploy, atomic hold on Target Open
  accessedKeys.length = 0
  await sourceLane.notebook.run()

  const lockedClosedSeg = `lanes#${encodeKeySegment(targetClosed.id)}/`
  const lockedVaultSeg = `lanes#${encodeKeySegment(targetVault.id)}/`
  const touchedLocked = accessedKeys.filter(a => (
   a.key.startsWith(`${lockedClosedSeg}script`)
   || a.key.startsWith(`${lockedVaultSeg}script`)
   || a.key.startsWith(`deploy#${encodeKeySegment(targetClosed.id)}`)
   || a.key.startsWith(`deploy#${encodeKeySegment(targetVault.id)}`)
  ))
  assert.deepEqual(touchedLocked, [])

  const openAfterHold = await loadLaneScript(kv, kv.namespace(targetOpen.id), targetOpen.id)
  assert.equal(openAfterHold.records[0].text, "; to v 'init'")

  assert.equal(expRow['deploy-bar-el'].hidden, false)
  assert.equal(expRow['unlock-btn'].hidden, false)
  assert.equal(expRow['unlock-btn'].textContent, 'Unlock Packages (2)')
  assert.equal(expRow['pending-unlock'], true)
  assert.deepEqual(
   expRow['pills-el'].children.map(p => p.textContent),
   [
    'Target Open: Staged (unlock packages first)',
    `${targetClosed.id}: Package "PkgConfirm" not open`,
    `${targetVault.id}: Package "PkgVault" locked`,
   ]
  )
  assert.ok(expRow['pills-el'].children[0].className.includes('lane-export-status-pill--warn'))
  assert.ok(expRow['pills-el'].children[1].className.includes('lane-export-status-pill--locked'))
  assert.ok(expRow['pills-el'].children[2].className.includes('lane-export-status-pill--locked'))

  // 4. Click Unlock Packages (2) -> Step 1/2 (Open confirm), submit -> Step 2/2 (Passphrase), Cancel -> still held
  const pkgModal = laneControl['package-modal']
  await expRow['unlock-btn'].listeners.click()
  assert.equal(pkgModal['is-open'], true)
  assert.equal(pkgModal['heading-el'].textContent, 'Open Package for Export (1 of 2)')
  assert.equal(pkgModal['unlock-pass-field'].hidden, true)
  assert.equal(pkgModal['unlock-id-input'].readOnly, true)
  assert.equal(pkgModal['unlock-submit-btn'].textContent, 'Open package')
  assert.equal(pkgModal['unlock-notice-el'].hidden, false)

  await pkgModal['unlock-form'].listeners.submit({ preventDefault() {} })
  assert.equal(pkgModal['is-open'], true)
  assert.equal(pkgModal['heading-el'].textContent, 'Unlock Package for Export (2 of 2)')
  assert.equal(pkgModal['unlock-pass-field'].hidden, false)
  assert.equal(pkgModal['unlock-submit-btn'].textContent, 'Unlock package')

  // Cancel Step 2 -> PkgVault stays closed and Target Open remains held atomically
  await pkgModal['unlock-cancel-btn'].listeners.click()
  assert.equal(pkgModal['is-open'], false)
  assert.equal((await loadLaneScript(kv, kv.namespace(targetOpen.id), targetOpen.id)).records[0].text, "; to v 'init'")

  await sourceLane.notebook.run()
  assert.equal(expRow['unlock-btn'].hidden, false)
  assert.equal(expRow['unlock-btn'].textContent, 'Unlock Package')

  // 5. Click Unlock Package -> test wrong passphrase retry, then correct passphrase -> auto-applies all 3 targets
  await expRow['unlock-btn'].listeners.click()
  assert.equal(pkgModal['is-open'], true)
  assert.equal(pkgModal['heading-el'].textContent, 'Unlock Package for Export')

  pkgModal['unlock-pass-input'].value = 'bad-pw'
  await pkgModal['unlock-form'].listeners.submit({ preventDefault() {} })
  assert.equal(pkgModal['is-open'], true)
  assert.equal(pkgModal['error-el'].hidden, false)

  pkgModal['unlock-pass-input'].value = 'vault-pw'
  await pkgModal['unlock-form'].listeners.submit({ preventDefault() {} })
  await new Promise(r => setTimeout(r, 30))

  assert.equal(pkgModal['is-open'], false)
  assert.equal(expRow['unlock-btn'].hidden, true)
  assert.equal(expRow['pending-unlock'], false)
  for (const tgtId of [targetOpen.id, targetClosed.id, targetVault.id]) {
   const saved = await loadLaneScript(kv, kv.namespace(tgtId), tgtId)
   assert.equal(saved.records[0].text, '; to v "exported"')
   assert.deepEqual(saved.records[0].setBy, { laneId: sourceLane.id, lineId: expRow.record.id })
  }

  // 6. SSE export-unlock-required opens package-modal and applies pendingExports after unlock
  await laneControl.close(sourceLane.id)
  targetVault.notebook.rows[0]['input-el'].value = "; to v 'init'"
  await targetVault.notebook.rows[0]['input-el'].listeners.input()
  await laneControl['close-package'](pkgVaultRes.pkg.id)
  assert.equal((await loadLaneScript(kv, kv.namespace(targetVault.id), targetVault.id)).records[0].text, "; to v 'init'")

  await laneControl['handle-agent-event']({
   type: 'export-unlock-required',
   sessionId: laneControl['session-id'],
   laneId: 'agent-ext-src',
   laneTitle: 'External CLI Lane',
   lockedPackages: [{
    packageId: pkgVaultRes.pkg.id,
    packageName: 'PkgVault',
    hasPassphrase: true,
    laneIds: [targetVault.id],
   }],
   pendingExports: [{
    sourceLaneId: 'agent-ext-src',
    lineId: 'ext-line-1',
    targets: [{ laneId: targetVault.id, lineId: vaultLineId }],
    content: '; to v "from-sse"',
   }],
  })
  assert.equal(pkgModal['is-open'], true)
  assert.equal(pkgModal['heading-el'].textContent, 'Unlock Package for Export')
  pkgModal['unlock-pass-input'].value = 'vault-pw'
  await pkgModal['unlock-form'].listeners.submit({ preventDefault() {} })
  await new Promise(r => setTimeout(r, 30))

  assert.equal(pkgModal['is-open'], false)
  const afterSse = await loadLaneScript(kv, kv.namespace(targetVault.id), targetVault.id)
  assert.equal(afterSse.records[0].text, '; to v "from-sse"')
  assert.deepEqual(afterSse.records[0].setBy, { laneId: 'agent-ext-src', lineId: 'ext-line-1' })
  assert.equal(laneControl['by-id'][targetVault.id].notebook.lines[0], '; to v "from-sse"')
 }
 finally {
  globalThis.fetch = origFetch
 }
})

test('lane-notebook and tab views show in-flight loading states before script, inputs, and initial run settle', async () => {
 const notebookSource = await fs.readFile(new URL('./src/lane-notebook.fs', import.meta.url), 'utf8')
 const inputsSource = await fs.readFile(new URL('./src/lane-inputs.fs', import.meta.url), 'utf8')
 const scopeSource = await fs.readFile(new URL('./src/lane-scope.fs', import.meta.url), 'utf8')
 const dataSource = await fs.readFile(new URL('./src/lane-data.fs', import.meta.url), 'utf8')
 const confirmModalSource = await fs.readFile(new URL('./src/confirm-modal.fs', import.meta.url), 'utf8')
 const rowPickerModalSource = await fs.readFile(new URL('./src/lane-row-picker-modal.fs', import.meta.url), 'utf8')
 const outputSource = await fs.readFile(new URL('./src/lane-output.fs', import.meta.url), 'utf8')
 const importModalSource = await fs.readFile(new URL('./src/lane-import-modal.fs', import.meta.url), 'utf8')
 const exportModalSource = await fs.readFile(new URL('./src/lane-export-modal.fs', import.meta.url), 'utf8')
 const exportDeployModalSource = await fs.readFile(new URL('./src/lane-export-deploy-modal.fs', import.meta.url), 'utf8')
 const laneServerSourceMod = await fs.readFile(new URL('./src/lane-server.fs', import.meta.url), 'utf8')
 const laneStorySourceMod = await fs.readFile(new URL('./src/lane-story.fs', import.meta.url), 'utf8')
 const lineInfoModalSourceMod = await fs.readFile(new URL('./src/lane-line-info-modal.fs', import.meta.url), 'utf8')

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
   focused: false,
   removed: false,
   scrollWidth: 0,
   scrollLeft: 0,
   scrollHeight: 0,
   scrollTop: 0,
   clientHeight: 0,
   setAttribute(name, value) { this.attributes[name] = String(value) },
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
    if (child && typeof child === 'object') child.parentNode = this
    const idx = this.children.indexOf(ref)
    if (idx === -1) this.children.push(child)
    else this.children.splice(idx, 0, child)
    return child
   },
   replaceChildren(...nodes) {
    this.children = []
    for (const node of nodes) this.appendChild(node)
   },
   addEventListener(event, handler) { this.listeners[event] = handler },
   focus(opts) {
    this.focused = true
    this.lastFocusOptions = opts
   },
   select() {},
   remove() {
    this.removed = true
    if (this.parentNode && Array.isArray(this.parentNode.children)) {
     const idx = this.parentNode.children.indexOf(this)
     if (idx !== -1) this.parentNode.children.splice(idx, 1)
    }
   },
   contains(target) {
    if (target === this) return true
    for (const child of this.children) {
     if (child && typeof child.contains === 'function' && child.contains(target)) return true
    }
    return false
   },
  }
 }

 let releaseInputs = null
 const inputsGate = new Promise(resolve => { releaseInputs = resolve })
 let releaseScript = null
 const scriptGate = new Promise(resolve => { releaseScript = resolve })
 let releaseRun = null
 const runGate = new Promise(resolve => { releaseRun = resolve })

 const kvStore = new Map()
 function makeKv(prefix = '', rootRef = null) {
  const qualify = key => (prefix ? `${prefix}/${key}` : key)
  const client = {
   get root() { return rootRef || client },
   namespace(name) { return makeKv(qualify(name), client.root) },
   async get(key) {
    if (prefix === 'lane-nb-loading' && key === 'inputs') await inputsGate
    if (prefix === 'lane-nb-loading' && key === 'script') await scriptGate
    return kvStore.has(qualify(key)) ? kvStore.get(qualify(key)) : null
   },
   async set(key, value) { kvStore.set(qualify(key), String(value)) },
   async delete(key) { kvStore.delete(qualify(key)) },
  }
  return client
 }
 const rootKv = makeKv()

 const makeMemStorage = () => {
  const m = new Map()
  return {
   getItem(k) { return m.has(k) ? m.get(k) : null },
   setItem(k, v) { m.set(k, String(v)) },
   removeItem(k) { m.delete(k) },
  }
 }
 const localStore = makeMemStorage()
 const sessionStore = makeMemStorage()
 let uuid = 0

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
  localStorage: localStore,
  sessionStorage: sessionStore,
  crypto: { randomUUID: () => `nb-loading-uuid-${++uuid}` },
  location: { pathname: '/', search: '', hash: '', origin: 'http://localhost:8080' },
  addEventListener() {},
  removeEventListener() {},
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
   '/src/lane-notebook.fs': notebookSource,
   '/src/lane-inputs.fs': inputsSource,
   '/src/lane-scope.fs': scopeSource,
   '/src/lane-data.fs': dataSource,
   '/src/confirm-modal.fs': confirmModalSource,
   '/src/lane-row-picker-modal.fs': rowPickerModalSource,
   '/src/lane-output.fs': outputSource,
   '/src/lane-import-modal.fs': importModalSource,
   '/src/lane-export-modal.fs': exportModalSource,
   '/src/lane-export-deploy-modal.fs': exportDeployModalSource,
   '/src/lane-server.fs': laneServerSourceMod,
   '/src/lane-story.fs': laneStorySourceMod,
   '/src/lane-line-info-modal.fs': lineInfoModalSourceMod,
  }
  if (map[url]) return { text: async () => map[url] }
  throw new Error(`Unexpected fetch: ${url}`)
 }

 try {
  const deferredRunLines = async (lines, opts) => {
   await runGate
   return runLines(lines, opts)
  }
  const f = field({
   ...DATA_RUNTIME_ENV,
   console: { log() {}, error() {}, warn() {} },
   createIdleTracker,
   createSourceWorkerRunner: null,
   data: rootKv,
   defaultValueForType,
   document: mockDocument,
   formatExportLine,
   formatImportLine,
   hasImportCycle,
   normalizePrimitiveType,
   parseExportLine,
   parseImportLine,
   primitiveTypes: PRIMITIVE_TYPES,
   resolveImportValue,
   resolveScopeColumns,
   runLines: deferredRunLines,
   runTransportedScripts,
   window: mockWindow,
  })
  const notebookMod = await f.run(parse(notebookSource, '/src/lane-notebook.fs'))
  const containerEl = createMockElement('div')
  const lane = {
   id: 'lane-nb-loading',
   title: 'Notebook Loading Lane',
   subroute: '',
   data: rootKv.namespace('lane-nb-loading'),
  }
  const mockLaneControl = {
   'open-package-ids': [],
   preferences: { interface: { scrollbarColor: '#383838' } },
   'insert-lane-body-node'(_laneArg, targetContainer, el) {
    targetContainer.appendChild(el)
   },
   'sync-export-links'() {},
  }

  // Stage 1: inputs KV read is paused -> Source, Input, and Scope panels show explicit loading indicators
  const nb = await notebookMod.mount(lane, containerEl, mockLaneControl, 'source', true)
  lane.notebook = nb
  await new Promise(resolve => setTimeout(resolve, 15))

  assert.equal(nb['is-loading-script'], true)
  assert.equal(nb['source-loading-el'].hidden, false)
  assert.equal(nb['source-loading-el'].textContent, 'Loading source…')
  assert.equal(nb['add-btn'].disabled, true)
  assert.equal(nb['add-import-btn'].disabled, true)
  assert.equal(nb['add-export-btn'].disabled, true)

  const inputsRootEl = nb['input-panel'].children[0]
  assert.equal(inputsRootEl.className, 'lane-inputs')
  assert.equal(inputsRootEl.children[1].className, 'cc-loading')
  assert.equal(inputsRootEl.children[1].textContent, 'Loading inputs…')
  assert.equal(inputsRootEl.children[1].hidden, false)
  assert.equal(inputsRootEl.children[2].hidden, true)
  assert.equal(inputsRootEl.children[3].disabled, true)
  assert.equal(nb['scope-panel'].children[0].textContent, 'Loading scope…')
  assert.equal(nb['scope-panel'].children[0].hidden, false)

  // Stage 2: Release inputs load while script KV read stays paused -> Inputs settles; Source, Scope & View stay loading
  releaseInputs()
  await new Promise(resolve => setTimeout(resolve, 15))

  assert.equal(nb['inputs-view']['is-loading'], false)
  assert.equal(nb['inputs-view']['loading-el'].hidden, true)
  assert.equal(nb['inputs-view']['empty-el'].hidden, false)
  assert.equal(nb['inputs-view']['empty-el'].textContent, 'No inputs declared.')
  assert.equal(nb['inputs-view']['add-btn'].disabled, false)

  assert.equal(nb['is-loading-script'], true)
  assert.equal(nb['source-loading-el'].hidden, false)
  assert.equal(nb['scope-view']['is-loading'], true)
  assert.equal(nb['scope-view']['loading-el'].hidden, false)
  assert.equal(nb['scope-view']['loading-el'].textContent, 'Loading scope…')

  const switchViewP = nb['set-tab']('view', true)
  await new Promise(resolve => setTimeout(resolve, 10))
  assert.equal(nb['output-view']['always-visible'], true)
  assert.equal(nb['output-view']['is-loading'], true)
  assert.equal(nb['output-view']['loading-el'].hidden, false)
  assert.equal(nb['output-view']['loading-el'].textContent, 'Running lane…')
  assert.equal(nb['output-view']['empty-el'].hidden, true)

  // Stage 3: Release script load while initial run stays paused -> Source settles; Scope & Output remain loading
  releaseScript()
  await new Promise(resolve => setTimeout(resolve, 15))

  assert.equal(nb['is-loading-script'], false)
  assert.equal(nb['source-loading-el'].hidden, true)
  assert.equal(nb['add-btn'].disabled, false)
  assert.equal(nb['add-import-btn'].disabled, false)
  assert.equal(nb['add-export-btn'].disabled, false)

  assert.equal(nb['scope-view']['is-loading'], true)
  assert.equal(nb['scope-view']['loading-el'].hidden, false)
  assert.equal(nb['output-view']['is-loading'], true)
  assert.equal(nb['output-view']['loading-el'].hidden, false)
  assert.equal(nb['output-view']['empty-el'].hidden, true)

  // Stage 4: Release initial run -> Scope & Output settle cleanly
  releaseRun()
  await switchViewP
  if (nb['load-task'] && typeof nb['load-task'].wait === 'function') {
   await nb['load-task'].wait()
  }
  await nb['when-idle']()

  assert.equal(nb['scope-view']['is-loading'], false)
  assert.equal(nb['scope-view']['loading-el'].hidden, true)
  assert.equal(nb['output-view']['is-loading'], false)
  assert.equal(nb['output-view']['loading-el'].hidden, true)
  assert.equal(nb['output-view']['empty-el'].hidden, false)
 }
 finally {
  releaseInputs()
  releaseScript()
  releaseRun()
  globalThis.fetch = origFetch
 }
})
