import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import {
 CELL_FLAGS,
 DATA_COLUMN_TYPES,
 DATA_CONSTRAINT_TYPES,
 DATA_RUNTIME_ENV,
 DEFAULT_FIXED_DECIMALS,
 DEFAULT_PACKAGE_ID,
 DEFAULT_TABLE_VIEW_ID,
 PRIMITIVE_TYPES,
 TABLE_IMPORT_MODES,
 WORKFLOW_COLUMN_TYPES,
 addLaneTable,
 agentCreateLane,
 agentGetLane,
 agentMutateLaneTable,
 buildTablesScope,
 buildUniqueTableViewName,
 checkColumnChangeImpact,
 coerceDataValue,
 collectLaneSyncBundle,
 columnSupportsWorkflow,
 computeLaneSnapshotRevision,
 createAgentEventHub,
 createDefaultColumnConstraint,
 createIdleTracker,
 createNewSession,
 createSourceWorkerRunner,
 dataValuesEqual,
 defaultDataValue,
 defaultValueForType,
 describeAllColumnConstraints,
 describeColumnConstraint,
 dirModalSource,
 evaluateTableFilter,
 exportDeployModalSource,
 exportModalSource,
 fetchRowOptionsPage,
 field,
 filterRowOptions,
 filterTableRows,
 findWorkflowDefaultColumns,
 formatCellInputValue,
 formatColumnType,
 formatImportLine,
 formatLaneRouteSegment,
 formatLaneRoutes,
 formatRowDisplayTemplate,
 formatTableFilterBubbleLabel,
 formatTableFilterInputValues,
 getColumnWorkflowConstraint,
 getFilterOperatorsForColumn,
 getInboundSubtableRowsForParent,
 getRowCellFlag,
 getSupportedColumnConstraints,
 getWorkflowCellState,
 hasImportCycle,
 isDataCellValueEmpty,
 isReadOnlyRemoteTable,
 isRemoteTable,
 isTriggerExcludedKey,
 laneServerSource,
 laneServersModalSource,
 laneStorySource,
 laneTerminalModalSource,
 lineInfoModalSource,
 loadLaneTables,
 loadTableViews,
 lookupRowDisplay,
 normalizeColumnConstraint,
 normalizeColumnConstraints,
 normalizeColumnWidth,
 normalizeDataColumnType,
 normalizeDataDir,
 normalizeFixedDecimals,
 normalizeCellFlag,
 normalizePrimitiveType,
 normalizeRowFlags,
 normalizeTableFilter,
 normalizeTableImportMode,
 normalizeTableRemoteSpec,
 normalizeTableViewsRecord,
 packageModalSource,
 parse,
 parseCellValue,
 parseColumnType,
 parseDisplayTemplate,
 parseFixedDecimalsInput,
 parseImportLine,
 parseLaneRouteSegment,
 parseLaneRoutes,
 parseNumericCellInput,
 parseStoredTables,
 parseTableFilterInput,
 parseWorkflowOptionValue,
 registerLaneInPackage,
 resolveImportValue,
 resolveInboundSubtables,
 resolveMatchingTriggerTargets,
 resolveRowTarget,
 resolveRowValueSpec,
 resolveScopeColumns,
 resolveTableViewDisplayName,
 resolveWorkflowTarget,
 rowFilterValuesMatch,
 runLines,
 runTransportedScripts,
 sanitizeTableViewsForColumns,
 saveImportedTableLink,
 saveLaneTables,
 saveTableViews,
 serializeTableRow,
 sessionModalSource,
 setRowCellFlag,
 syncTableRowsInMemory,
 tableViewFiltersEqual,
 tableViewsKey,
 validateColumnConstraints,
} from './field.fixtures.mjs'

test('DATA_COLUMN_TYPES, cell parsing/coercion, change impact detection, stored table parsing, and scope export', () => {
 assert.deepEqual(DATA_COLUMN_TYPES, [
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
 ])
 assert.equal(DEFAULT_FIXED_DECIMALS, 2)
 assert.equal(normalizeFixedDecimals(undefined), 2)
 assert.equal(normalizeFixedDecimals(''), 2)
 assert.equal(normalizeFixedDecimals(0), 0)
 assert.equal(normalizeFixedDecimals('4'), 4)
 assert.equal(normalizeFixedDecimals(99), 12)
 assert.equal(normalizeFixedDecimals(-3), 0)
 assert.equal(normalizeFixedDecimals('abc'), 2)

 assert.equal(normalizeColumnWidth(undefined), null)
 assert.equal(normalizeColumnWidth(''), null)
 assert.equal(normalizeColumnWidth(0), null)
 assert.equal(normalizeColumnWidth(-10), null)
 assert.equal(normalizeColumnWidth(20), 48)
 assert.equal(normalizeColumnWidth(240), 240)
 assert.equal(normalizeColumnWidth('185px'), 185)
 assert.equal(normalizeColumnWidth(5000), 1200)

 assert.equal(normalizeDataColumnType('integer'), 'integer')
 assert.equal(normalizeDataColumnType('decimal[]'), 'decimal')
 assert.equal(normalizeDataColumnType('fixed'), 'fixed')
 assert.equal(normalizeDataColumnType('fixed(4)'), 'fixed')
 assert.equal(normalizeDataColumnType('fixed(3)[]'), 'fixed')
 assert.equal(normalizeDataColumnType('unknown'), 'text')

 assert.deepEqual(parseColumnType('integer[]'), { type: 'integer', multiple: true })
 assert.deepEqual(parseColumnType('decimal', true), { type: 'decimal', multiple: true })
 assert.deepEqual(parseColumnType({ type: 'boolean', multiple: true }), { type: 'boolean', multiple: true })
 assert.deepEqual(parseColumnType('fixed'), { type: 'fixed', multiple: false, decimals: 2 })
 assert.deepEqual(parseColumnType('fixed[]'), { type: 'fixed', multiple: true, decimals: 2 })
 assert.deepEqual(parseColumnType('fixed(4)'), { type: 'fixed', multiple: false, decimals: 4 })
 assert.deepEqual(parseColumnType('fixed(3)[]'), { type: 'fixed', multiple: true, decimals: 3 })
 assert.deepEqual(parseColumnType({ type: 'fixed', multiple: true, decimals: 4 }), { type: 'fixed', multiple: true, decimals: 4 })
 assert.equal(formatColumnType('integer', false), 'integer')
 assert.equal(formatColumnType('integer', true), 'integer[]')
 assert.equal(formatColumnType('decimal[]'), 'decimal[]')
 assert.equal(formatColumnType('fixed', false), 'fixed(2)')
 assert.equal(formatColumnType('fixed', true), 'fixed(2)[]')
 assert.equal(formatColumnType('fixed', false, 4), 'fixed(4)')
 assert.equal(formatColumnType({ type: 'fixed', multiple: true, decimals: 3 }), 'fixed(3)[]')

 assert.strictEqual(defaultDataValue('integer', false), 0)
 assert.strictEqual(defaultDataValue('decimal', false), 0)
 assert.strictEqual(defaultDataValue('fixed', false), 0)
 assert.strictEqual(defaultDataValue('text', false), '')
 assert.strictEqual(defaultDataValue('boolean', false), false)
 assert.strictEqual(defaultDataValue('date', false), '')
 assert.strictEqual(defaultDataValue('json', false), null)
 assert.deepEqual(defaultDataValue('integer', true), [])
 assert.deepEqual(defaultDataValue('decimal[]'), [])
 assert.deepEqual(defaultDataValue('fixed[]'), [])

 // Cell validation for core and proposed types
 assert.deepEqual(parseCellValue('42', 'integer'), { ok: true, value: 42, error: null })
 assert.deepEqual(parseCellValue('-7', 'integer'), { ok: true, value: -7, error: null })
 assert.deepEqual(parseCellValue('', 'integer'), { ok: true, value: null, error: null })
 assert.equal(parseCellValue('3.14', 'integer').ok, false)
 assert.equal(parseCellValue('abc', 'integer').ok, false)

 assert.deepEqual(parseCellValue('234.55', 'decimal'), { ok: true, value: 234.55, error: null })
 assert.deepEqual(parseCellValue('', 'decimal'), { ok: true, value: null, error: null })
 assert.equal(parseCellValue('nope', 'decimal').ok, false)

 // Fixed-point parsing (edit as xxx.xx -> store as scaled integer xxxxx)
 assert.deepEqual(parseCellValue('123.45', 'fixed'), { ok: true, value: 12345, error: null })
 assert.deepEqual(parseCellValue('19.99', 'fixed'), { ok: true, value: 1999, error: null })
 assert.deepEqual(parseCellValue('5', 'fixed'), { ok: true, value: 500, error: null })
 assert.deepEqual(parseCellValue('5.5', 'fixed'), { ok: true, value: 550, error: null })
 assert.deepEqual(parseCellValue('123.', 'fixed'), { ok: true, value: 12300, error: null })
 assert.deepEqual(parseCellValue('.5', 'fixed'), { ok: true, value: 50, error: null })
 assert.deepEqual(parseCellValue('.05', 'fixed'), { ok: true, value: 5, error: null })
 assert.deepEqual(parseCellValue('-12.34', 'fixed'), { ok: true, value: -1234, error: null })
 assert.deepEqual(parseCellValue('-0.05', 'fixed'), { ok: true, value: -5, error: null })
 assert.strictEqual(Object.is(parseCellValue('-0.00', 'fixed').value, 0), true)
 assert.deepEqual(parseCellValue('', 'fixed'), { ok: true, value: null, error: null })
 assert.equal(parseCellValue('123.456', 'fixed').ok, false)
 assert.equal(parseCellValue('abc', 'fixed').ok, false)
 assert.equal(parseCellValue('9999999999999999.99', 'fixed').ok, false)
 // Custom decimal places on fixed
 assert.deepEqual(parseCellValue('12.345', 'fixed', 3), { ok: true, value: 12345, error: null })
 assert.deepEqual(parseCellValue('12.345', 'fixed(3)'), { ok: true, value: 12345, error: null })
 assert.deepEqual(parseCellValue('42', 'fixed(0)'), { ok: true, value: 42, error: null })
 assert.equal(parseCellValue('42.5', 'fixed(0)').ok, false)

 assert.deepEqual(parseCellValue(true, 'boolean'), { ok: true, value: true, error: null })
 assert.deepEqual(parseCellValue('false', 'boolean'), { ok: true, value: false, error: null })
 assert.equal(parseCellValue('maybe', 'boolean').ok, false)

 assert.deepEqual(parseCellValue('2026-11-23', 'date'), { ok: true, value: '2026-11-23', error: null })
 assert.equal(parseCellValue('2026-02-31', 'date').ok, false)
 assert.deepEqual(parseCellValue('2026-11-23T14:30', 'datetime'), { ok: true, value: '2026-11-23T14:30', error: null })
 assert.equal(parseCellValue('not-a-dt', 'datetime').ok, false)

 assert.deepEqual(parseCellValue('https://example.com/a', 'url'), { ok: true, value: 'https://example.com/a', error: null })
 assert.equal(parseCellValue('not a url', 'url').ok, false)
 assert.deepEqual(parseCellValue('ada@example.com', 'email'), { ok: true, value: 'ada@example.com', error: null })
 assert.equal(parseCellValue('invalid-email', 'email').ok, false)

 assert.deepEqual(parseCellValue('{"a":[1,2]}', 'json'), { ok: true, value: { a: [1, 2] }, error: null })
 assert.equal(parseCellValue('{bad', 'json').ok, false)

 assert.equal(formatCellInputValue(42, 'integer'), '42')
 assert.equal(formatCellInputValue(null, 'integer'), '')
 assert.equal(formatCellInputValue(12345, 'fixed'), '123.45')
 assert.equal(formatCellInputValue(500, 'fixed'), '5.00')
 assert.equal(formatCellInputValue(5, 'fixed'), '0.05')
 assert.equal(formatCellInputValue(0, 'fixed'), '0.00')
 assert.equal(formatCellInputValue(-5, 'fixed'), '-0.05')
 assert.equal(formatCellInputValue(-12345, 'fixed'), '-123.45')
 assert.equal(formatCellInputValue(null, 'fixed'), '')
 assert.equal(formatCellInputValue(12345, 'fixed', 3), '12.345')
 assert.equal(formatCellInputValue(12345, 'fixed(0)'), '12345')
 assert.equal(formatCellInputValue(true, 'boolean'), true)
 assert.equal(formatCellInputValue({ k: 1 }, 'json'), '{"k":1}')

 // Coercion and destructive impact detection
 assert.deepEqual(coerceDataValue(5, 'integer', true), [5])
 assert.equal(coerceDataValue([10, 20], 'integer', false), 10)
 assert.equal(coerceDataValue(3.9, 'integer', false), 3)
 assert.deepEqual(coerceDataValue(['1.5', '2.5'], 'decimal', true), [1.5, 2.5])
 // Fixed coercion: stored integers stay scaled on reload, while cross-type conversions scale/unscale accurately
 assert.equal(coerceDataValue(12345, 'fixed', false), 12345)
 assert.deepEqual(coerceDataValue([12345, 50], 'fixed', true), [12345, 50])
 assert.equal(coerceDataValue(123.45, 'fixed', false, 'decimal'), 12345)
 assert.equal(coerceDataValue(123.456, 'fixed', false, 'decimal'), 12346)
 assert.equal(coerceDataValue(123, 'fixed', false, 'integer'), 12300)
 assert.equal(coerceDataValue('19.99', 'fixed', false, 'text'), 1999)
 assert.equal(coerceDataValue(12345, 'fixed(3)', false, 'fixed(2)'), 123450)
 assert.equal(coerceDataValue(12345, 'fixed(1)', false, 'fixed(2)'), 1235)
 assert.equal(coerceDataValue(-12345, 'fixed(1)', false, 'fixed(2)'), -1235)
 assert.equal(coerceDataValue(12345, 'decimal', false, 'fixed(2)'), 123.45)
 assert.equal(coerceDataValue(12345, 'integer', false, 'fixed(2)'), 123)
 assert.equal(coerceDataValue(12345, 'text', false, 'fixed(2)'), '123.45')
 assert.equal(coerceDataValue(0, 'boolean', false, 'fixed(2)'), false)
 assert.equal(coerceDataValue(5, 'boolean', false, 'fixed(2)'), true)

 const sampleTable = {
  id: 'tbl-1',
  name: 'metrics',
  columns: [
   { id: 'c1', name: 'tags', type: 'text', multiple: true },
   { id: 'c2', name: 'label', type: 'text', multiple: false },
   { id: 'c3', name: 'price', type: 'fixed', multiple: false, decimals: 2 },
  ],
  rows: [
   { id: 'r1', values: { c1: ['alpha', 'beta'], c2: 'hello', c3: 12345 } },
  ],
 }
 // Turning multiple OFF with >1 item is destructive
 assert.equal(checkColumnChangeImpact(sampleTable, 'c1', 'text', false).destructive, true)
 // Turning multiple ON (single -> []) with same type is non-destructive
 assert.equal(checkColumnChangeImpact(sampleTable, 'c2', 'text', true).destructive, false)
 // Converting text "hello" -> integer is destructive
 assert.equal(checkColumnChangeImpact(sampleTable, 'c2', 'integer', false).destructive, true)
 // Changing fixed(2) -> fixed(2)[] is non-destructive, while changing decimals or type prompts
 assert.equal(checkColumnChangeImpact(sampleTable, 'c3', 'fixed', true, 2).destructive, false)
 assert.equal(checkColumnChangeImpact(sampleTable, 'c3', 'fixed', false, 3).destructive, true)
 assert.equal(checkColumnChangeImpact(sampleTable, 'c3', 'decimal', false).destructive, true)

 // Stored parsing & scope building
 const parsed = parseStoredTables(JSON.stringify([
  {
   id: 't1',
   name: 'ledger',
   columns: [
    { id: 'c1', name: 'item', type: 'text', multiple: false, width: 220 },
    { id: 'c2', name: 'amounts', type: 'decimal[]' },
    { id: 'c3', name: 'cents', type: 'fixed', multiple: false, decimals: 2 },
    { id: 'c4', name: 'rates', type: 'fixed(3)[]' },
   ],
   rows: [
    { id: 'r1', values: { c1: 'Coffee', c2: ['4.5', '1.25'], c3: 12345, c4: [1250, 75] } },
   ],
  },
 ]))
 assert.equal(parsed.length, 1)
 assert.equal(parsed[0].columns[0].width, 220)
 assert.equal(Object.hasOwn(parsed[0].columns[1], 'width'), false)
 assert.equal(parsed[0].columns[1].type, 'decimal')
 assert.equal(parsed[0].columns[1].multiple, true)
 assert.deepEqual(parsed[0].columns[2], { id: 'c3', name: 'cents', type: 'fixed', multiple: false, decimals: 2 })
 assert.deepEqual(parsed[0].columns[3], { id: 'c4', name: 'rates', type: 'fixed', multiple: true, decimals: 3 })
 // Reloading stored fixed integers preserves exact scaled integers without double-scaling
 assert.deepEqual(parsed[0].rows[0].values, { c1: 'Coffee', c2: [4.5, 1.25], c3: 12345, c4: [1250, 75] })

 const scoped = buildTablesScope(parsed)
 assert.deepEqual(scoped, { ledger: [{ item: 'Coffee', amounts: [4.5, 1.25], cents: 12345, rates: [1250, 75] }] })
 // Mutating exported scope copy does not corrupt stored table rows
 scoped.ledger[0].amounts.push(99)
 assert.deepEqual(parsed[0].rows[0].values.c2, [4.5, 1.25])
})

test('Data tab supports tables, typed & multiple columns, editable rows, destructive confirmations, persistence, and Source/Scope integration', async () => {
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
  crypto: { randomUUID: () => `data-uuid-${++uuid}` },
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
   document: mockDocument,
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

  // Add a lane and verify Data tab is present
  await f.state.tableHeadRowAddButton.listeners.click()
  const lane = f.state.lanes[0]
  const nb = lane.notebook
  const dataView = nb['data-view']
  const confirmModal = dataView['confirm-modal']
  assert.equal(confirmModal, f.state['lane-control']['confirm-modal'])
  assert.equal(nb.tabs.data.textContent, 'Data')
  assert.equal(nb['data-panel'].hidden, true)

  // Switch to Data tab -> Source MUST NOT run
  const runsBeforeData = runCount
  await nb.tabs.data.listeners.click()
  assert.equal(nb['active-tab'], 'data')
  assert.equal(nb['data-panel'].hidden, false)
  assert.equal(nb['source-panel'].hidden, true)
  assert.equal(runCount, runsBeforeData)
  await nb.run()
  assert.equal(runCount, runsBeforeData)

  // Create first table "expenses"
  assert.equal(dataView['empty-el'].hidden, false)
  await dataView['add-table-btn'].listeners.click()
  assert.equal(dataView.tables.length, 1)
  assert.equal(dataView['empty-el'].hidden, true)
  assert.equal(dataView['active-el'].hidden, false)
  assert.equal(dataView['add-row-btn'].disabled, true)

  await dataView['table-menu-btn'].listeners.click({})
  await dataView['edit-table-btn'].listeners.click({})
  dataView['edit-table-modal']['name-input'].value = 'expenses'
  await dataView['edit-table-modal']['save-btn'].listeners.click({})
  assert.equal(dataView['table-tabs'][0]['label-el'].textContent, 'expenses')
  assert.equal(dataView['view-name-el'].textContent, 'expenses')

  // Define typed columns: label (text), qty (integer), price (decimal), paid (boolean), scores (integer[]), due (date)
  await dataView['add-col-btn'].listeners.click()
  dataView['schema-rows'][0]['name-el'].value = 'label'
  await dataView['schema-rows'][0]['name-el'].listeners.input()

  await dataView['add-col-btn'].listeners.click()
  dataView['schema-rows'][1]['name-el'].value = 'qty'
  await dataView['schema-rows'][1]['name-el'].listeners.input()
  dataView['schema-rows'][1]['type-el'].value = 'integer'
  await dataView['schema-rows'][1]['type-el'].listeners.change()

  await dataView['add-col-btn'].listeners.click()
  dataView['schema-rows'][2]['name-el'].value = 'price'
  await dataView['schema-rows'][2]['name-el'].listeners.input()
  dataView['schema-rows'][2]['type-el'].value = 'decimal'
  await dataView['schema-rows'][2]['type-el'].listeners.change()

  await dataView['add-col-btn'].listeners.click()
  dataView['schema-rows'][3]['name-el'].value = 'paid'
  await dataView['schema-rows'][3]['name-el'].listeners.input()
  dataView['schema-rows'][3]['type-el'].value = 'boolean'
  await dataView['schema-rows'][3]['type-el'].listeners.change()

  await dataView['add-col-btn'].listeners.click()
  dataView['schema-rows'][4]['name-el'].value = 'scores'
  await dataView['schema-rows'][4]['name-el'].listeners.input()
  dataView['schema-rows'][4]['type-el'].value = 'integer'
  await dataView['schema-rows'][4]['type-el'].listeners.change()
  await dataView['schema-rows'][4]['multi-btn'].listeners.click()

  await dataView['add-col-btn'].listeners.click()
  dataView['schema-rows'][5]['name-el'].value = 'due'
  await dataView['schema-rows'][5]['name-el'].listeners.input()
  dataView['schema-rows'][5]['type-el'].value = 'date'
  await dataView['schema-rows'][5]['type-el'].listeners.change()

  // Verify grid headers show column names & types (including integer[])
  assert.deepEqual(
   dataView['grid-head-cells'].slice(1, -1).map(h => `${h['name-el'].textContent}:${h['type-el'].textContent}`),
   ['label:text', 'qty:integer', 'price:decimal', 'paid:boolean', 'scores:integer[]', 'due:date']
  )
  assert.equal(dataView['add-row-btn'].disabled, false)

  // Add Row 1 and edit typed cells
  await dataView['add-row-btn'].listeners.click()
  assert.equal(dataView['grid-rows'].length, 1)
  const r1 = dataView['grid-rows'][0]
  r1.cells[0]['input-el'].value = 'Coffee'
  await r1.cells[0]['input-el'].listeners.input()

  // Invalid integer input shows invalid class and does NOT clobber stored integer
  r1.cells[1]['input-el'].value = '2.5'
  await r1.cells[1]['input-el'].listeners.input()
  assert.match(r1.cells[1]['input-el'].className, /lane-data-cell-input--invalid/)
  assert.equal(dataView.tables[0].rows[0].values[dataView.tables[0].columns[1].id], 0)

  r1.cells[1]['input-el'].value = '3'
  await r1.cells[1]['input-el'].listeners.input()
  assert.doesNotMatch(r1.cells[1]['input-el'].className, /lane-data-cell-input--invalid/)

  r1.cells[2]['input-el'].value = '4.5'
  await r1.cells[2]['input-el'].listeners.input()

  r1.cells[3]['input-el'].checked = true
  await r1.cells[3]['input-el'].listeners.change()

  // Multiple integer[] cell: add 3 items (10, 20, 30)
  await r1.cells[4]['add-btn'].listeners.click()
  r1.cells[4].items[0]['input-el'].value = '10'
  await r1.cells[4].items[0]['input-el'].listeners.input()
  await r1.cells[4]['add-btn'].listeners.click()
  r1.cells[4].items[1]['input-el'].value = '20'
  await r1.cells[4].items[1]['input-el'].listeners.input()
  await r1.cells[4]['add-btn'].listeners.click()
  r1.cells[4].items[2]['input-el'].value = '30'
  await r1.cells[4].items[2]['input-el'].listeners.input()

  r1.cells[5]['input-el'].value = '2026-11-30'
  await r1.cells[5]['input-el'].listeners.change()

  // Add Row 2
  await dataView['add-row-btn'].listeners.click()
  assert.equal(dataView['grid-rows'].length, 2)
  assert.equal(dataView['table-tabs'][0]['count-el'].textContent, 2)
  dataView['grid-rows'][1].cells[0]['input-el'].value = 'Books'
  await dataView['grid-rows'][1].cells[0]['input-el'].listeners.input()

  // 1. Destructive confirmation: remove item from integer[] cell (Cancel then Confirm)
  const scoresColId = dataView.tables[0].columns[4].id
  await dataView['grid-rows'][0].cells[4].items[1]['remove-btn'].listeners.click()
  assert.equal(confirmModal['is-open'], true)
  assert.match(confirmModal['message-el'].textContent, /Remove item #2/)
  await confirmModal['cancel-btn'].listeners.click()
  assert.equal(confirmModal['is-open'], false)
  assert.deepEqual(dataView.tables[0].rows[0].values[scoresColId], [10, 20, 30])

  await dataView['grid-rows'][0].cells[4].items[1]['remove-btn'].listeners.click()
  assert.equal(confirmModal['is-open'], true)
  await confirmModal['confirm-btn'].listeners.click()
  assert.deepEqual(dataView.tables[0].rows[0].values[scoresColId], [10, 30])

  // 2. Destructive confirmation: toggling integer[] -> integer with 2 items prompts and Cancel preserves []
  await dataView['schema-rows'][4]['multi-btn'].listeners.click()
  assert.equal(confirmModal['is-open'], true)
  assert.match(confirmModal['message-el'].textContent, /integer\[\] to integer/)
  await dispatchWindowEvent('keydown', { key: 'Escape' })
  assert.equal(confirmModal['is-open'], false)
  assert.equal(dataView.tables[0].columns[4].multiple, true)
  assert.deepEqual(dataView.tables[0].rows[0].values[scoresColId], [10, 30])

  // 3. Destructive confirmation: lossy type change text -> integer prompts and Cancel reverts select
  dataView['schema-rows'][0]['type-el'].value = 'integer'
  await dataView['schema-rows'][0]['type-el'].listeners.change()
  assert.equal(confirmModal['is-open'], true)
  await confirmModal['cancel-btn'].listeners.click()
  assert.equal(dataView.tables[0].columns[0].type, 'text')
  assert.equal(dataView['schema-rows'][0]['type-el'].value, 'text')
  assert.equal(dataView.tables[0].rows[0].values[dataView.tables[0].columns[0].id], 'Coffee')

  // 4. Destructive confirmation: schema column deletion (Cancel then Confirm)
  const dueColId = dataView.tables[0].columns[5].id
  await dataView['schema-rows'][5]['remove-btn'].listeners.click()
  assert.equal(confirmModal['is-open'], true)
  assert.match(confirmModal['message-el'].textContent, /Delete column "due" \(date\)/)
  assert.match(confirmModal['message-el'].textContent, /2 rows/)
  await confirmModal['cancel-btn'].listeners.click()
  assert.equal(dataView.tables[0].columns.length, 6)
  assert.equal(dataView.tables[0].rows[0].values[dueColId], '2026-11-30')

  await dataView['schema-rows'][5]['remove-btn'].listeners.click()
  await confirmModal['confirm-btn'].listeners.click()
  assert.equal(dataView.tables[0].columns.length, 5)
  assert.equal(Object.hasOwn(dataView.tables[0].rows[0].values, dueColId), false)

  // 5. Destructive confirmation: delete row (Cancel then Confirm)
  await dataView['grid-rows'][1]['remove-btn'].listeners.click()
  assert.equal(confirmModal['is-open'], true)
  assert.match(confirmModal['message-el'].textContent, /Delete row #2/)
  await confirmModal['cancel-btn'].listeners.click()
  assert.equal(dataView.tables[0].rows.length, 2)

  await dataView['grid-rows'][1]['remove-btn'].listeners.click()
  await confirmModal['confirm-btn'].listeners.click()
  assert.equal(dataView.tables[0].rows.length, 1)
  assert.equal(dataView['table-tabs'][0]['count-el'].textContent, 1)

  // 6. Create a second table, test Clear rows & Delete table confirmations
  await dataView['add-table-btn'].listeners.click()
  assert.equal(dataView.tables.length, 2)
  await dataView['add-col-btn'].listeners.click()
  dataView['schema-rows'][0]['name-el'].value = 'note'
  await dataView['schema-rows'][0]['name-el'].listeners.input()
  await dataView['add-row-btn'].listeners.click()
  assert.equal(dataView.tables[1].rows.length, 1)

  // Edit table, Clear rows and Delete table live inside the "..." (⋯) table actions dropdown menu
  assert.equal(dataView['table-menu-btn'].textContent, '⋯')
  assert.equal(dataView['table-menu'].hidden, true)
  assert.equal(dataView['table-menu-open'], false)
  assert.deepEqual(dataView['header-actions-el'].children, [
   dataView['schema-toggle-btn'],
   dataView['table-menu-wrap'],
  ])
  assert.deepEqual(dataView['table-menu'].children, [
   dataView['edit-table-btn'],
   dataView['clear-rows-btn'],
   dataView['delete-table-btn'],
  ])

  // Open "..." menu and back out easily by clicking "..." again
  await dataView['table-menu-btn'].listeners.click({})
  assert.equal(dataView['table-menu-open'], true)
  assert.equal(dataView['table-menu'].hidden, false)
  await dataView['table-menu-btn'].listeners.click({})
  assert.equal(dataView['table-menu-open'], false)
  assert.equal(dataView['table-menu'].hidden, true)

  // Open "..." menu and click Clear rows -> menu closes and confirmation modal opens with disabled red button until checkbox is checked (singular: 1 row, 1 column)
  await dataView['table-menu-btn'].listeners.click({})
  assert.equal(dataView['table-menu-open'], true)
  await dataView['clear-rows-btn'].listeners.click()
  assert.equal(dataView['table-menu-open'], false)
  assert.equal(dataView['table-menu'].hidden, true)
  assert.equal(confirmModal['is-open'], true)
  assert.equal(confirmModal['title-el'].textContent, 'Clear Rows')
  assert.equal(confirmModal['require-agreement'], true)
  assert.equal(confirmModal['agree-row'].hidden, false)
  assert.equal(confirmModal['agree-checkbox'].checked, false)
  assert.equal(confirmModal['confirm-btn'].disabled, true)
  assert.equal(confirmModal['message-el'].textContent, 'Delete 1 row from "table_2"? This action cannot be undone. The table column will be kept.')
  assert.equal(confirmModal['agree-text-el'].textContent, 'I understand and agree to permanently delete 1 row from "table_2".')

  // Clicking confirm-btn without checking the checkbox cannot bypass confirmation
  await confirmModal['confirm-btn'].listeners.click()
  assert.equal(confirmModal['is-open'], true)
  assert.equal(dataView.tables[1].rows.length, 1)

  // Checking the checkbox enables the red Clear rows button; unchecking disables it again; Cancel backs out cleanly
  confirmModal['agree-checkbox'].checked = true
  await confirmModal['agree-checkbox'].listeners.change()
  assert.equal(confirmModal['confirm-btn'].disabled, false)
  confirmModal['agree-checkbox'].checked = false
  await confirmModal['agree-checkbox'].listeners.change()
  assert.equal(confirmModal['confirm-btn'].disabled, true)
  confirmModal['agree-checkbox'].checked = true
  await confirmModal['agree-checkbox'].listeners.change()
  assert.equal(confirmModal['confirm-btn'].disabled, false)
  await confirmModal['cancel-btn'].listeners.click()
  assert.equal(confirmModal['is-open'], false)
  assert.equal(dataView.tables[1].rows.length, 1)

  // Add a second row to verify plural phrasing ("all 2 rows") -> checkbox resets to unchecked and confirm button starts disabled -> check and confirm
  await dataView['add-row-btn'].listeners.click()
  assert.equal(dataView.tables[1].rows.length, 2)
  await dataView['table-menu-btn'].listeners.click({})
  await dataView['clear-rows-btn'].listeners.click()
  assert.equal(confirmModal['message-el'].textContent, 'Delete all 2 rows from "table_2"? This action cannot be undone. The table column will be kept.')
  assert.equal(confirmModal['agree-text-el'].textContent, 'I understand and agree to permanently delete all 2 rows from "table_2".')
  assert.equal(confirmModal['agree-checkbox'].checked, false)
  assert.equal(confirmModal['confirm-btn'].disabled, true)
  confirmModal['agree-checkbox'].checked = true
  await confirmModal['agree-checkbox'].listeners.change()
  assert.equal(confirmModal['confirm-btn'].disabled, false)
  await confirmModal['confirm-btn'].listeners.click()
  assert.equal(dataView.tables[1].rows.length, 0)
  assert.equal(dataView.tables[1].columns.length, 1)
  assert.equal(dataView['clear-rows-btn'].disabled, true)

  // Switching to table with rows collapses schema by default; switching to empty table opens it
  await dataView['table-tabs'][0].el.listeners.click()
  assert.equal(dataView['schema-open'], false)
  assert.equal(dataView['schema-section'].hidden, true)
  await dataView['table-tabs'][1].el.listeners.click()
  assert.equal(dataView['schema-open'], true)
  assert.equal(dataView['schema-section'].hidden, false)

  // Open "..." menu and click Delete table -> requires checkbox agreement before Delete table button is enabled
  await dataView['table-menu-btn'].listeners.click({})
  await dataView['delete-table-btn'].listeners.click()
  assert.equal(dataView['table-menu-open'], false)
  assert.equal(confirmModal['is-open'], true)
  assert.equal(confirmModal['require-agreement'], true)
  assert.equal(confirmModal['agree-row'].hidden, false)
  assert.equal(confirmModal['agree-checkbox'].checked, false)
  assert.equal(confirmModal['confirm-btn'].disabled, true)
  assert.equal(confirmModal['message-el'].textContent, 'Delete table "table_2"? This will permanently remove its 1 column and 0 rows. This action cannot be undone.')
  assert.equal(confirmModal['agree-text-el'].textContent, 'I understand and agree to permanently delete table "table_2" (1 column, 0 rows).')

  // Cannot confirm Delete table without checking the agreement checkbox
  await confirmModal['confirm-btn'].listeners.click()
  assert.equal(confirmModal['is-open'], true)
  assert.equal(dataView.tables.length, 2)

  // Easy to cancel via Cancel button, close × button, or backdrop click
  await confirmModal['cancel-btn'].listeners.click()
  assert.equal(confirmModal['is-open'], false)
  assert.equal(dataView.tables.length, 2)

  await dataView['table-menu-btn'].listeners.click({})
  await dataView['delete-table-btn'].listeners.click()
  confirmModal['agree-checkbox'].checked = true
  await confirmModal['agree-checkbox'].listeners.change()
  assert.equal(confirmModal['confirm-btn'].disabled, false)
  await confirmModal['close-btn'].listeners.click()
  assert.equal(confirmModal['is-open'], false)
  assert.equal(dataView.tables.length, 2)

  await dataView['table-menu-btn'].listeners.click({})
  await dataView['delete-table-btn'].listeners.click()
  assert.equal(confirmModal['agree-checkbox'].checked, false)
  assert.equal(confirmModal['confirm-btn'].disabled, true)
  confirmModal['agree-checkbox'].checked = true
  await confirmModal['agree-checkbox'].listeners.change()
  assert.equal(confirmModal['confirm-btn'].disabled, false)
  await confirmModal['confirm-btn'].listeners.click()
  assert.equal(dataView.tables.length, 1)
  assert.equal(dataView['active-table-id'], dataView.tables[0].id)
  assert.equal(dataView['schema-open'], false)
  assert.equal(dataView['schema-section'].hidden, true)

  // Switch back to Source -> Source runs with `expenses` table seeded directly in scope!
  await nb.tabs.source.listeners.click()
  assert.equal(runCount, runsBeforeData + 1)
  nb.rows[0]['input-el'].value = '; to lineTotal ; multiply $expenses.0.qty $expenses.0.price'
  await nb.rows[0]['input-el'].listeners.input()
  assert.equal(nb.rows[0]['preview-el'].textContent, '13.5')
  assert.deepEqual(nb.state.expenses, [
   { label: 'Coffee', qty: 3, price: 4.5, paid: true, scores: [10, 30] },
  ])

  // Switch to Scope -> expenses is browsable in Scope columns
  await nb.tabs.scope.listeners.click()
  const expItem = nb['scope-view'].columns[0].items.find(i => i.key === 'expenses')
  assert.ok(expItem)

  // Reload app -> persisted table schema (including integer[]) and typed row values restore cleanly
  const fReload = field({
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
   runLines,
   runTransportedScripts,
  })
  await fReload.run(parse(mainSource, '/src/main.fs'))
  const reloadedLane = fReload.state.lanes[0]
  const reloadedData = reloadedLane.notebook['data-view']
  assert.equal(reloadedData.tables.length, 1)
  assert.equal(reloadedData.tables[0].name, 'expenses')
  // Table with existing rows starts with schema collapsed by default, and can be toggled open
  assert.equal(reloadedData['schema-open'], false)
  assert.equal(reloadedData['schema-section'].hidden, true)
  await reloadedData['schema-toggle-btn'].listeners.click()
  assert.equal(reloadedData['schema-open'], true)
  assert.equal(reloadedData['schema-section'].hidden, false)
  assert.deepEqual(
   reloadedData.tables[0].columns.map(c => formatColumnType(c.type, c.multiple)),
   ['text', 'integer', 'decimal', 'boolean', 'integer[]']
  )
  assert.deepEqual(reloadedLane.notebook.state.expenses, [
   { label: 'Coffee', qty: 3, price: 4.5, paid: true, scores: [10, 30] },
  ])
  assert.equal(reloadedLane.notebook.rows[0]['preview-el'].textContent, '13.5')
 }
 finally {
  globalThis.fetch = origFetch
 }
})

test('Data tab Fixed column edits as xxx.xx, stores scaled integer xxxxx, configures decimal places, converts types, and persists cleanly', async () => {
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
  crypto: { randomUUID: () => `fixed-uuid-${++uuid}` },
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
   runLines,
   runTransportedScripts,
  })

  const f = makeRuntime()
  await f.run(parse(mainSource, '/src/main.fs'))
  await f.state.tableHeadRowAddButton.listeners.click()
  const lane = f.state.lanes[0]
  const nb = lane.notebook
  const dataView = nb['data-view']
  const confirmModal = dataView['confirm-modal']

  await nb.tabs.data.listeners.click()
  await dataView['add-table-btn'].listeners.click()
  await dataView['open-edit-table-modal']()
  dataView['edit-table-modal']['name-input'].value = 'invoices'
  await dataView['edit-table-modal']['save-btn'].listeners.click({})

  // Column 0: amount (fixed, defaults to 2 decimal places)
  await dataView['add-col-btn'].listeners.click()
  assert.equal(dataView['schema-rows'][0]['decimals-wrap'].hidden, true)
  dataView['schema-rows'][0]['name-el'].value = 'amount'
  await dataView['schema-rows'][0]['name-el'].listeners.input()
  dataView['schema-rows'][0]['type-el'].value = 'fixed'
  await dataView['schema-rows'][0]['type-el'].listeners.change()

  assert.equal(dataView.tables[0].columns[0].type, 'fixed')
  assert.equal(dataView.tables[0].columns[0].decimals, 2)
  assert.equal(dataView['schema-rows'][0]['decimals-wrap'].hidden, false)
  assert.equal(dataView['schema-rows'][0]['decimals-el'].value, '2')

  // Column 1: splits (fixed(2)[])
  await dataView['add-col-btn'].listeners.click()
  dataView['schema-rows'][1]['name-el'].value = 'splits'
  await dataView['schema-rows'][1]['name-el'].listeners.input()
  dataView['schema-rows'][1]['type-el'].value = 'fixed'
  await dataView['schema-rows'][1]['type-el'].listeners.change()
  await dataView['schema-rows'][1]['multi-btn'].listeners.click()

  // Column 2: rate (decimal -> later converted to fixed)
  await dataView['add-col-btn'].listeners.click()
  dataView['schema-rows'][2]['name-el'].value = 'rate'
  await dataView['schema-rows'][2]['name-el'].listeners.input()
  dataView['schema-rows'][2]['type-el'].value = 'decimal'
  await dataView['schema-rows'][2]['type-el'].listeners.change()

  assert.deepEqual(
   dataView['grid-head-cells'].slice(1, -1).map(h => `${h['name-el'].textContent}:${h['type-el'].textContent}`),
   ['amount:fixed(2)', 'splits:fixed(2)[]', 'rate:decimal']
  )

  // Add row 1: default stored value 0 displays as '0.00'
  await dataView['add-row-btn'].listeners.click()
  const amountColId = dataView.tables[0].columns[0].id
  const splitsColId = dataView.tables[0].columns[1].id
  const rateColId = dataView.tables[0].columns[2].id
  const amountInput = dataView['grid-rows'][0].cells[0]['input-el']
  assert.equal(amountInput.type, 'text')
  assert.equal(amountInput.attributes.inputmode, 'decimal')
  assert.equal(amountInput.placeholder, '0.00')
  assert.equal(amountInput.value, '0.00')
  assert.strictEqual(dataView.tables[0].rows[0].values[amountColId], 0)

  // Edit as '123.45' -> stored as 12345
  amountInput.value = '123.45'
  await amountInput.listeners.input()
  assert.doesNotMatch(amountInput.className, /lane-data-cell-input--invalid/)
  assert.strictEqual(dataView.tables[0].rows[0].values[amountColId], 12345)

  // Excess decimal places ('123.456') is rejected and preserves 12345
  amountInput.value = '123.456'
  await amountInput.listeners.input()
  assert.match(amountInput.className, /lane-data-cell-input--invalid/)
  assert.strictEqual(dataView.tables[0].rows[0].values[amountColId], 12345)

  // Edit as '5' -> stored as 500, and blur formats input to '5.00'
  amountInput.value = '5'
  await amountInput.listeners.input()
  assert.strictEqual(dataView.tables[0].rows[0].values[amountColId], 500)
  await amountInput.listeners.blur()
  assert.equal(amountInput.value, '5.00')

  // Set back to '123.45' -> stored as 12345
  amountInput.value = '123.45'
  await amountInput.listeners.input()
  assert.strictEqual(dataView.tables[0].rows[0].values[amountColId], 12345)

  // Edit fixed[] multiple cell: add '12.34' and '0.05' -> stored as [1234, 5]
  const splitsCell = dataView['grid-rows'][0].cells[1]
  await splitsCell['add-btn'].listeners.click()
  assert.equal(splitsCell.items[0]['input-el'].value, '0.00')
  splitsCell.items[0]['input-el'].value = '12.34'
  await splitsCell.items[0]['input-el'].listeners.input()
  await splitsCell['add-btn'].listeners.click()
  splitsCell.items[1]['input-el'].value = '0.05'
  await splitsCell.items[1]['input-el'].listeners.input()
  assert.deepEqual(dataView.tables[0].rows[0].values[splitsColId], [1234, 5])

  // Confirming multi-item removal displays formatted fixed value ("12.34"), not raw integer
  await splitsCell.items[0]['remove-btn'].listeners.click()
  assert.equal(confirmModal['is-open'], true)
  assert.match(confirmModal['message-el'].textContent, /"12\.34"/)
  await confirmModal['cancel-btn'].listeners.click()
  assert.deepEqual(dataView.tables[0].rows[0].values[splitsColId], [1234, 5])

  // Edit decimal rate = 4.5, then convert decimal -> fixed(2) -> stores 450 & displays '4.50'
  dataView['grid-rows'][0].cells[2]['input-el'].value = '4.5'
  await dataView['grid-rows'][0].cells[2]['input-el'].listeners.input()
  assert.strictEqual(dataView.tables[0].rows[0].values[rateColId], 4.5)
  dataView['schema-rows'][2]['type-el'].value = 'fixed'
  await dataView['schema-rows'][2]['type-el'].listeners.change()
  assert.equal(confirmModal['is-open'], true)
  assert.match(confirmModal['message-el'].textContent, /decimal to fixed\(2\)/)
  await confirmModal['confirm-btn'].listeners.click()
  assert.strictEqual(dataView.tables[0].rows[0].values[rateColId], 450)
  assert.equal(dataView['grid-rows'][0].cells[2]['input-el'].value, '4.50')

  // Change decimals on amount from 2 -> 3: Cancel reverts to 2 & keeps 12345; Confirm rescales to 123450 & shows '123.450'
  dataView['schema-rows'][0]['decimals-el'].value = '3'
  await dataView['schema-rows'][0]['decimals-el'].listeners.change()
  assert.equal(confirmModal['is-open'], true)
  assert.match(confirmModal['message-el'].textContent, /fixed\(2\) to fixed\(3\)/)
  await confirmModal['cancel-btn'].listeners.click()
  assert.equal(dataView.tables[0].columns[0].decimals, 2)
  assert.equal(dataView['schema-rows'][0]['decimals-el'].value, '2')
  assert.strictEqual(dataView.tables[0].rows[0].values[amountColId], 12345)

  dataView['schema-rows'][0]['decimals-el'].value = '3'
  await dataView['schema-rows'][0]['decimals-el'].listeners.change()
  assert.equal(confirmModal['is-open'], true)
  await confirmModal['confirm-btn'].listeners.click()
  assert.equal(dataView.tables[0].columns[0].decimals, 3)
  assert.strictEqual(dataView.tables[0].rows[0].values[amountColId], 123450)
  assert.equal(dataView['grid-rows'][0].cells[0]['input-el'].value, '123.450')
  assert.equal(dataView['grid-head-cells'][1]['type-el'].textContent, 'fixed(3)')

  // Source tab reads stored scaled integers directly from scope
  await nb.tabs.source.listeners.click()
  nb.rows[0]['input-el'].value = '; add $invoices.0.amount $invoices.0.rate'
  await nb.rows[0]['input-el'].listeners.input()
  assert.equal(nb.rows[0]['preview-el'].textContent, '123900')
  assert.deepEqual(nb.state.invoices, [
   { amount: 123450, splits: [1234, 5], rate: 450 },
  ])

  // Reload app -> persisted fixed columns & stored integers restore without double-scaling
  const fReload = makeRuntime()
  await fReload.run(parse(mainSource, '/src/main.fs'))
  const reloadedData = fReload.state.lanes[0].notebook['data-view']
  assert.deepEqual(
   reloadedData.tables[0].columns.map(c => formatColumnType(c)),
   ['fixed(3)', 'fixed(2)[]', 'fixed(2)']
  )
  assert.deepEqual(fReload.state.lanes[0].notebook.state.invoices, [
   { amount: 123450, splits: [1234, 5], rate: 450 },
  ])
  assert.equal(reloadedData['grid-rows'][0].cells[0]['input-el'].value, '123.450')
  assert.equal(reloadedData['grid-rows'][0].cells[1].items[0]['input-el'].value, '12.34')
  assert.equal(reloadedData['grid-rows'][0].cells[1].items[1]['input-el'].value, '0.05')
  assert.equal(reloadedData['grid-rows'][0].cells[2]['input-el'].value, '4.50')
 }
 finally {
  globalThis.fetch = origFetch
 }
})

test('Data tables right-align only integer and fixed cells, resize columns horizontally, and persist widths across reloads', async () => {
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
   offsetWidth: 140,
   getBoundingClientRect() {
    return { width: this.offsetWidth }
   },
   setAttribute(name, value) { this.attributes[name] = value },
   appendChild(child) { this.children.push(child); return child },
   insertBefore(child, ref) {
    const idx = this.children.indexOf(ref)
    if (idx === -1) { this.children.push(child) }
    else { this.children.splice(idx, 0, child) }
    return child
   },
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
 const windowListeners = {}
 const dispatchWindowEvent = async (event, ev) => {
  for (const handler of (windowListeners[event] || []).slice()) {
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
  crypto: { randomUUID: () => `resize-uuid-${++uuid}` },
  history: { pushState(_s, _t, url) { mockWindow.location.pathname = url } },
  location: { pathname: '/' },
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
   runLines,
   runTransportedScripts,
  })

  const f = makeRuntime()
  await f.run(parse(mainSource, '/src/main.fs'))
  await f.state.tableHeadRowAddButton.listeners.click()
  const nb = f.state.lanes[0].notebook
  const dataView = nb['data-view']
  await nb.tabs.data.listeners.click()
  await dataView['add-table-btn'].listeners.click()

  // Columns: [0] label (text), [1] qty (integer), [2] ratio (decimal), [3] balance (fixed), [4] active (boolean)
  await dataView['add-col-btn'].listeners.click()
  dataView['schema-rows'][0]['name-el'].value = 'label'
  await dataView['schema-rows'][0]['name-el'].listeners.input()

  await dataView['add-col-btn'].listeners.click()
  dataView['schema-rows'][1]['name-el'].value = 'qty'
  await dataView['schema-rows'][1]['name-el'].listeners.input()
  dataView['schema-rows'][1]['type-el'].value = 'integer'
  await dataView['schema-rows'][1]['type-el'].listeners.change()

  await dataView['add-col-btn'].listeners.click()
  dataView['schema-rows'][2]['name-el'].value = 'ratio'
  await dataView['schema-rows'][2]['name-el'].listeners.input()
  dataView['schema-rows'][2]['type-el'].value = 'decimal'
  await dataView['schema-rows'][2]['type-el'].listeners.change()

  await dataView['add-col-btn'].listeners.click()
  dataView['schema-rows'][3]['name-el'].value = 'balance'
  await dataView['schema-rows'][3]['name-el'].listeners.input()
  dataView['schema-rows'][3]['type-el'].value = 'fixed'
  await dataView['schema-rows'][3]['type-el'].listeners.change()

  await dataView['add-col-btn'].listeners.click()
  dataView['schema-rows'][4]['name-el'].value = 'active'
  await dataView['schema-rows'][4]['name-el'].listeners.input()
  dataView['schema-rows'][4]['type-el'].value = 'boolean'
  await dataView['schema-rows'][4]['type-el'].listeners.change()

  await dataView['add-row-btn'].listeners.click()
  const row0 = dataView['grid-rows'][0]

  // Only integer ([1]) and fixed ([3]) cells are right-aligned; text ([0]), decimal ([2]), boolean ([4]) are NOT
  assert.doesNotMatch(row0.cells[0]['input-el'].className, /lane-data-cell-input--right/)
  assert.doesNotMatch(row0.cells[0].td.className, /lane-data-td--right/)
  assert.match(row0.cells[1]['input-el'].className, /lane-data-cell-input--right/)
  assert.match(row0.cells[1].td.className, /lane-data-td--right/)
  assert.doesNotMatch(row0.cells[2]['input-el'].className, /lane-data-cell-input--right/)
  assert.doesNotMatch(row0.cells[2].td.className, /lane-data-td--right/)
  assert.match(row0.cells[3]['input-el'].className, /lane-data-cell-input--right/)
  assert.match(row0.cells[3].td.className, /lane-data-td--right/)
  assert.doesNotMatch(row0.cells[4].td.className, /lane-data-td--right/)

  // Resize column 0 (`label`) by dragging +90px (140 -> 230) and column 3 (`balance`) by -40px (140 -> 100)
  const labelHead = dataView['grid-head-cells'][1]
  const labelType = dataView['grid-type-cells'][1]
  await labelHead['resizer-el'].listeners.mousedown({ clientX: 100, preventDefault() {}, stopPropagation() {} })
  await dispatchWindowEvent('mousemove', { clientX: 190 })
  await dispatchWindowEvent('mouseup', {})
  assert.equal(dataView.tables[0].columns[0].width, 230)
  assert.equal(labelHead.el.style.width, '230px')
  assert.equal(labelType.el.style.width, '230px')
  assert.equal(row0.cells[0].td.style.width, '230px')
  assert.match(labelHead.el.className, /lane-data-th--sized/)
  assert.match(labelType.el.className, /lane-data-th--sized/)
  assert.match(row0.cells[0].td.className, /lane-data-td--sized/)

  const balHead = dataView['grid-head-cells'][4]
  const balType = dataView['grid-type-cells'][4]
  await balHead['resizer-el'].listeners.mousedown({ clientX: 300, preventDefault() {}, stopPropagation() {} })
  await dispatchWindowEvent('mousemove', { clientX: 260 })
  await dispatchWindowEvent('mouseup', {})
  assert.equal(dataView.tables[0].columns[3].width, 100)
  assert.equal(balHead.el.style.width, '100px')
  assert.equal(balType.el.style.width, '100px')
  assert.equal(row0.cells[3].td.style.width, '100px')
  // Preserves right-align class when sized!
  assert.match(row0.cells[3].td.className, /lane-data-td--right/)
  assert.match(row0.cells[3].td.className, /lane-data-td--sized/)

  // Reload app -> persisted widths survive in schema and are applied to th, type th & td immediately
  const fReload = makeRuntime()
  await fReload.run(parse(mainSource, '/src/main.fs'))
  const reloadedData = fReload.state.lanes[0].notebook['data-view']
  assert.equal(reloadedData.tables[0].columns[0].width, 230)
  assert.equal(reloadedData.tables[0].columns[3].width, 100)
  assert.equal(reloadedData['grid-head-cells'][1].el.style.width, '230px')
  assert.equal(reloadedData['grid-type-cells'][1].el.style.width, '230px')
  assert.equal(reloadedData['grid-rows'][0].cells[0].td.style.width, '230px')
  assert.equal(reloadedData['grid-head-cells'][4].el.style.width, '100px')
  assert.equal(reloadedData['grid-type-cells'][4].el.style.width, '100px')
  assert.equal(reloadedData['grid-rows'][0].cells[3].td.style.width, '100px')

  // Double-clicking resizer resets column width back to auto and persists
  await reloadedData['grid-head-cells'][1]['resizer-el'].listeners.dblclick()
  assert.equal(Object.hasOwn(reloadedData.tables[0].columns[0], 'width'), false)
  assert.equal(reloadedData['grid-head-cells'][1].el.style.width, '')
  assert.equal(reloadedData['grid-type-cells'][1].el.style.width, '')
  assert.equal(reloadedData['grid-rows'][0].cells[0].td.style.width, '')
 }
 finally {
  globalThis.fetch = origFetch
 }
})

test('row Data type helpers: target/literal resolution, coercion, 2-pass stored parsing, display join, and async paginated search', async () => {
 assert.deepEqual(parseColumnType('row'), {
  type: 'row',
  multiple: false,
  refTableId: '',
  refColumnId: '',
  refDisplayColumnId: '',
 })
 assert.deepEqual(parseColumnType('row[]'), {
  type: 'row',
  multiple: true,
  refTableId: '',
  refColumnId: '',
  refDisplayColumnId: '',
 })
 assert.deepEqual(
  parseColumnType({ type: 'row', multiple: true, refTableId: 't-users', refColumnId: 'c-id', refDisplayColumnId: 'c-name' }),
  { type: 'row', multiple: true, refTableId: 't-users', refColumnId: 'c-id', refDisplayColumnId: 'c-name' }
 )
 assert.strictEqual(defaultDataValue('row', false), null)
 assert.deepEqual(defaultDataValue('row', true), [])
 assert.equal(formatColumnType('row', false), 'row')
 assert.equal(formatColumnType('row', true), 'row[]')

 const tables = [
  {
   id: 't-orders',
   name: 'orders',
   columns: [
    { id: 'o-cust', name: 'customer', type: 'row', multiple: false, refTableId: 't-cust', refColumnId: 'c-id', refDisplayColumnId: 'c-name' },
    { id: 'o-price-link', name: 'tier_price', type: 'row', multiple: false, refTableId: 't-cust', refColumnId: 'c-credit', refDisplayColumnId: 'c-name' },
    { id: 'o-chain', name: 'chain_ref', type: 'row', multiple: false, refTableId: 't-orders', refColumnId: 'o-price-link', refDisplayColumnId: '' },
    { id: 'o-self-cycle', name: 'cycle_a', type: 'row', multiple: false, refTableId: 't-orders', refColumnId: 'o-mut-cycle', refDisplayColumnId: '' },
    { id: 'o-mut-cycle', name: 'cycle_b', type: 'row', multiple: false, refTableId: 't-orders', refColumnId: 'o-self-cycle', refDisplayColumnId: '' },
   ],
   rows: [
    { id: 'r1', values: { 'o-cust': 2, 'o-price-link': 1550, 'o-chain': 1550, 'o-self-cycle': null, 'o-mut-cycle': null } },
   ],
  },
  {
   id: 't-cust',
   name: 'customers',
   columns: [
    { id: 'c-id', name: 'id', type: 'integer', multiple: false },
    { id: 'c-name', name: 'name', type: 'text', multiple: false },
    { id: 'c-credit', name: 'credit', type: 'fixed', multiple: false, decimals: 2 },
    { id: 'c-active', name: 'active', type: 'boolean', multiple: false },
   ],
   rows: [
    { id: 'cu1', values: { 'c-id': 1, 'c-name': 'Alice', 'c-credit': 500, 'c-active': true } },
    { id: 'cu2', values: { 'c-id': 2, 'c-name': 'Bob', 'c-credit': 1550, 'c-active': false } },
    { id: 'cu3', values: { 'c-id': 3, 'c-name': 'Carla', 'c-credit': 2500, 'c-active': true } },
    { id: 'cu4', values: { 'c-id': null, 'c-name': 'Ignored', 'c-credit': 0, 'c-active': false } },
   ],
  },
 ]

 assert.equal(formatColumnType(tables[0].columns[0], undefined, undefined, tables), 'row(customers.id)')
 assert.equal(formatColumnType({ ...tables[0].columns[0], multiple: true }, undefined, undefined, tables), 'row(customers.id)[]')

 const target = resolveRowTarget(tables, tables[0].columns[0])
 assert.equal(target.configured, true)
 assert.equal(target.valid, true)
 assert.deepEqual(target.valueSpec, { type: 'integer', multiple: false })
 assert.deepEqual(target.displaySpec, { type: 'text', multiple: false })
 assert.equal(target.displayCol.id, 'c-name')

 // Same display column as link column collapses displayCol to null
 const sameDisplayTarget = resolveRowTarget(tables, { type: 'row', refTableId: 't-cust', refColumnId: 'c-id', refDisplayColumnId: 'c-id' })
 assert.equal(sameDisplayTarget.displayCol, null)

 // Chained row -> row -> fixed(2) resolves literal type, while cycles return null safely
 assert.deepEqual(resolveRowValueSpec(tables, tables[0].columns[2]), { type: 'fixed', multiple: false, decimals: 2 })
 assert.equal(resolveRowValueSpec(tables, tables[0].columns[3]), null)
 assert.equal(resolveRowTarget(tables, tables[0].columns[3]).valid, false)

 // Cell parsing & formatting delegates to linked literal column type
 assert.equal(formatCellInputValue(1550, tables[0].columns[1], undefined, tables), '15.50')
 assert.deepEqual(parseCellValue('19.99', tables[0].columns[1], undefined, tables), { ok: true, value: 1999, error: null })
 assert.equal(parseCellValue('bad', tables[0].columns[0], undefined, tables).ok, false)

 // Coercion from row(fixed(2)) -> decimal unscales accurately, and display-only change is non-destructive
 assert.equal(coerceDataValue(1550, 'decimal', false, tables[0].columns[1], tables), 15.5)
 assert.equal(
  checkColumnChangeImpact(
   tables[0],
   'o-cust',
   { type: 'row', multiple: false, refTableId: 't-cust', refColumnId: 'c-id', refDisplayColumnId: 'c-id' },
   false,
   undefined,
   tables
  ).destructive,
  false
 )
 assert.equal(
  checkColumnChangeImpact(
   tables[0],
   'o-cust',
   { type: 'row', multiple: false, refTableId: 't-cust', refColumnId: 'c-name', refDisplayColumnId: '' },
   false,
   undefined,
   tables
  ).destructive,
  true
 )
 // Changing text column -> unconfigured row preserves values until link column is chosen
 const unconfiguredTargetImpact = checkColumnChangeImpact(
  { id: 'tx', name: 'tx', columns: [{ id: 'k', name: 'k', type: 'text', multiple: false }], rows: [{ id: 'r', values: { k: 'hello' } }] },
  'k',
  { type: 'row', multiple: false, refTableId: '', refColumnId: '', refDisplayColumnId: '' },
  false,
  undefined,
  tables
 )
 assert.equal(unconfiguredTargetImpact.destructive, false)

 // 2-pass parseStoredTables resolves forward table references without double-scaling fixed(2)
 const storedReparsed = parseStoredTables(JSON.stringify(tables))
 assert.strictEqual(storedReparsed[0].rows[0].values['o-cust'], 2)
 assert.strictEqual(storedReparsed[0].rows[0].values['o-price-link'], 1550)
 assert.deepEqual(buildTablesScope(storedReparsed).orders, [
  { customer: 2, tier_price: 1550, chain_ref: 1550, cycle_a: null, cycle_b: null },
 ])

 // lookupRowDisplay joins display column + id when separate, hides duplicate id when same, handles booleans
 const dispJoined = lookupRowDisplay(tables, tables[0].columns[0], 2)
 assert.equal(dispJoined.found, true)
 assert.equal(dispJoined.hasSeparateDisplay, true)
 assert.equal(dispJoined.displayText, 'Bob')
 assert.equal(dispJoined.valueText, '2')
 assert.equal(dispJoined.label, 'Bob (2)')

 const dispBool = lookupRowDisplay(tables, { type: 'row', refTableId: 't-cust', refColumnId: 'c-active', refDisplayColumnId: 'c-name' }, false)
 assert.equal(dispBool.valueText, 'false')
 assert.equal(dispBool.displayText, 'Bob')

 const dispMissing = lookupRowDisplay(tables, tables[0].columns[0], 999)
 assert.equal(dispMissing.found, false)
 assert.equal(dispMissing.valueText, '999')

 // fetchRowOptionsPage loads asynchronously page-by-page & skips null link rows
 const page1 = await fetchRowOptionsPage(tables, tables[0].columns[0], { offset: 0, limit: 2 })
 assert.equal(page1.ok, true)
 assert.equal(page1.total, 4)
 assert.equal(page1.nextOffset, 2)
 assert.equal(page1.hasMore, true)
 assert.deepEqual(page1.items.map(i => ({ v: i.value, d: i.displayText, l: i.label })), [
  { v: 1, d: 'Alice', l: 'Alice (1)' },
  { v: 2, d: 'Bob', l: 'Bob (2)' },
 ])
 const page2 = await fetchRowOptionsPage(tables, tables[0].columns[0], { offset: 2, limit: 2 })
 assert.equal(page2.hasMore, false)
 assert.deepEqual(page2.items.map(i => i.value), [3]) // cu4 has null c-id so skipped

 assert.deepEqual(filterRowOptions([...page1.items, ...page2.items], 'car').map(i => i.value), [3])
 assert.deepEqual(filterRowOptions([...page1.items, ...page2.items], '2').map(i => i.value), [2])
 assert.equal((await fetchRowOptionsPage(tables, { type: 'row', refTableId: 'nope', refColumnId: 'c-id' })).ok, false)
 assert.equal(dataValuesEqual({ a: [1] }, { a: [1] }), true)
 assert.equal(dataValuesEqual(1, '1'), false)
})

test('Row display templates: strict "; add ..." micro-syntax, nested row Displays, empty/unknown tokens, cycles, grid labels, picker labels/search, and persistence', async () => {
 // Only a single, flat `; add ...` expression is accepted; no commands, blocks, or property paths
 const valid = parseDisplayTemplate("; add $family ' ' $version")
 assert.equal(valid.ok, true)
 assert.deepEqual(valid.variables, ['family', 'version'])
 assert.equal(parseDisplayTemplate('').ok, true)
 assert.equal(parseDisplayTemplate('').text, '')
 assert.equal(parseDisplayTemplate('; add').ok, false)
 assert.equal(parseDisplayTemplate('; sub 1 2').ok, false)
 assert.equal(parseDisplayTemplate('; add $family.name').ok, false)
 assert.equal(parseDisplayTemplate('; add $__proto__').ok, false)
 assert.equal(parseDisplayTemplate('; add [ add 1 2 ] 3').ok, false)
 assert.equal(parseDisplayTemplate('; add 1 ; sub 2 3').ok, false)
 assert.equal(parseDisplayTemplate(`; add ${'x'.repeat(600)}`).ok, false)
 assert.equal(parseColumnType({ type: 'row', refTableId: 'os', refColumnId: 'id', refDisplayTemplate: '; sub 1 2' }).refDisplayTemplate, undefined)

 const tables = [
  {
   id: 'computers',
   name: 'computers',
   columns: [
    {
     id: 'c-os',
     name: 'operating_system',
     type: 'row',
     refTableId: 'os',
     refColumnId: 'os-id',
     refDisplayColumnId: 'os-version',
     refDisplayTemplate: "; add $family ' ' $version",
    },
   ],
   rows: [
    { id: 'pc1', values: { 'c-os': '0' } },
    { id: 'pc2', values: { 'c-os': '1' } },
   ],
  },
  {
   id: 'os',
   name: 'operating_systems',
   columns: [
    { id: 'os-id', name: 'id', type: 'text' },
    { id: 'os-family', name: 'family', type: 'row', refTableId: 'families', refColumnId: 'fam-code', refDisplayColumnId: 'fam-name' },
    { id: 'os-version', name: 'version', type: 'text' },
   ],
   rows: [
    { id: 'os0', values: { 'os-id': '0', 'os-family': 'fedora', 'os-version': '45' } },
    { id: 'os1', values: { 'os-id': '1', 'os-family': 'android', 'os-version': '17' } },
   ],
  },
  {
   id: 'families',
   name: 'families',
   columns: [
    { id: 'fam-code', name: 'code', type: 'text' },
    { id: 'fam-name', name: 'name', type: 'text' },
   ],
   rows: [
    { id: 'f1', values: { 'fam-code': 'fedora', 'fam-name': 'Fedora' } },
    { id: 'f2', values: { 'fam-code': 'android', 'fam-name': 'Google Android' } },
   ],
  },
 ]

 // Nested row tokens resolve through that column's own Display setting, never the raw link value
 const osCol = tables[1].columns[0]
 assert.deepEqual(formatRowDisplayTemplate(tables, tables[1], tables[1].rows[0], "; add $family ' ' $version"), {
  ok: true,
  text: 'Fedora 45',
  unresolved: [],
  error: null,
 })
 assert.equal(formatRowDisplayTemplate(tables, tables[1], tables[1].rows[1], "; add $family ' ' $version").text, 'Google Android 17')
 assert.equal(formatRowDisplayTemplate(tables, tables[1], tables[1].rows[0], "; add $family ' ' $version ' LTS'").text, 'Fedora 45 LTS')
 assert.equal(formatRowDisplayTemplate(tables, tables[1], tables[1].rows[0], "; add $missing $version").text, '45')
 assert.equal(formatRowDisplayTemplate(tables, tables[1], tables[1].rows[1], "; add $missing ''").text, '')
 assert.equal(formatRowDisplayTemplate(tables, tables[1], tables[1].rows[1], '; sub 1 2').ok, false)

 // A row[] token renders every linked row through the same template, joined with ", "
 assert.equal(formatRowDisplayTemplate(tables, tables[1], { values: { 'os-family': ['fedora', 'android'] } }, "; add $family ''").text, 'Fedora, Google Android')

 // Templates with cycles terminate instead of recursing forever
 const cycleTables = [
  { id: 'a', name: 'a', columns: [
   { id: 'a-id', name: 'id', type: 'text' },
   { id: 'a-next', name: 'next', type: 'row', refTableId: 'b', refColumnId: 'b-id', refDisplayColumnId: 'b-name', refDisplayTemplate: "; add $next '!'" },
  ], rows: [{ id: 'ar', values: { 'a-id': '1', 'a-next': '1' } }] },
  { id: 'b', name: 'b', columns: [
   { id: 'b-id', name: 'id', type: 'text' },
   { id: 'b-next', name: 'next', type: 'row', refTableId: 'a', refColumnId: 'a-id', refDisplayColumnId: 'a-name', refDisplayTemplate: "; add $next '?'" },
  ], rows: [{ id: 'br', values: { 'b-id': '1', 'b-next': '1' } }] },
 ]
 assert.equal(formatRowDisplayTemplate(cycleTables, cycleTables[0], cycleTables[0].rows[0], "; add $next ''").text.length > 0, true)

 // Grid and picker show only the template output (no appended id), while picker search still finds it
 const grid = lookupRowDisplay(tables, tables[0].columns[0], '0')
 assert.equal(grid.displayTemplateMode, true)
 assert.equal(grid.displayTemplateError, null)
 assert.equal(grid.displayText, 'Fedora 45')
 assert.equal(grid.label, 'Fedora 45')
 assert.equal(grid.valueText, '0')
 const page = await fetchRowOptionsPage(tables, tables[0].columns[0], {})
 assert.deepEqual(page.items.map(i => i.label), ['Fedora 45', 'Google Android 17'])
 assert.deepEqual(filterRowOptions(page.items, 'fedora').map(i => i.value), ['0'])
 assert.deepEqual(filterRowOptions(page.items, 'android').map(i => i.value), ['1'])

 // parseStoredTables and parseColumnType preserve valid templates but strip invalid ones
 const stored = parseStoredTables(JSON.stringify(tables))
 assert.equal(stored[0].columns[0].refDisplayTemplate, "; add $family ' ' $version")
 const reparsed = parseStoredTables(JSON.stringify(stored))
 assert.equal(reparsed[0].columns[0].refDisplayTemplate, "; add $family ' ' $version")
 assert.equal(parseColumnType(stored[0].columns[0]).refDisplayTemplate, "; add $family ' ' $version")
 assert.equal(osCol.refDisplayTemplate, undefined)
})

test('Data tab row type: stacked schema config, joined table display, and on-demand async paginated & searchable picker', async () => {
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
   scrollTop: 0,
   scrollHeight: 0,
   clientHeight: 0,
   setAttribute(name, value) { this.attributes[name] = value },
   appendChild(child) { this.children.push(child); return child },
   insertBefore(child, ref) {
    const idx = this.children.indexOf(ref)
    if (idx === -1) { this.children.push(child) }
    else { this.children.splice(idx, 0, child) }
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
  crypto: { randomUUID: () => `row-uuid-${++uuid}` },
  history: { pushState(_s, _t, url) { mockWindow.location.pathname = url } },
  location: { pathname: '/' },
  addEventListener(event, handler) {
   windowListeners[event] ||= []
   windowListeners[event].push(handler)
  },
 }

 const fetchCalls = []
 const trackedFetchRowOptionsPage = async (tables, col, opts = {}) => {
  fetchCalls.push({ offset: opts.offset ?? 0, limit: opts.limit ?? 3 })
  return fetchRowOptionsPage(tables, col, opts)
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
   defaultRowPickerPageSize: 3,
   fetchRowOptionsPage: trackedFetchRowOptionsPage,
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
   runLines,
   runTransportedScripts,
  })

  const f = makeRuntime()
  await f.run(parse(mainSource, '/src/main.fs'))
  await f.state.tableHeadRowAddButton.listeners.click()
  const lane = f.state.lanes[0]
  const nb = lane.notebook
  const dataView = nb['data-view']
  const rowPicker = dataView['row-picker']
  const confirmModal = dataView['confirm-modal']
  assert.equal(rowPicker, f.state['lane-control']['row-picker-modal'])

  await nb.tabs.data.listeners.click()

  // Table 1: `customers` with 7 rows across 3 pages (pageSize = 3)
  await dataView['add-table-btn'].listeners.click()
  await dataView['open-edit-table-modal']()
  dataView['edit-table-modal']['name-input'].value = 'customers'
  await dataView['edit-table-modal']['save-btn'].listeners.click({})
  const custTableId = dataView.tables[0].id

  await dataView['add-col-btn'].listeners.click()
  dataView['schema-rows'][0]['name-el'].value = 'id'
  await dataView['schema-rows'][0]['name-el'].listeners.input()
  dataView['schema-rows'][0]['type-el'].value = 'integer'
  await dataView['schema-rows'][0]['type-el'].listeners.change()
  const custIdColId = dataView.tables[0].columns[0].id

  await dataView['add-col-btn'].listeners.click()
  dataView['schema-rows'][1]['name-el'].value = 'name'
  await dataView['schema-rows'][1]['name-el'].listeners.input()
  const custNameColId = dataView.tables[0].columns[1].id

  const seedCustomers = [
   [101, 'Acme Alpha'],
   [102, 'Acme Beta'],
   [103, 'Acme Gamma'],
   [104, 'Beacon Delta'],
   [105, 'Cobalt Epsilon'],
   [106, 'Delta Zeta'],
   [107, 'Echo Grace'],
  ]
  for (let i = 0; i < seedCustomers.length; i++) {
   await dataView['add-row-btn'].listeners.click()
   const gr = dataView['grid-rows'][i]
   gr.cells[0]['input-el'].value = String(seedCustomers[i][0])
   await gr.cells[0]['input-el'].listeners.input()
   gr.cells[1]['input-el'].value = seedCustomers[i][1]
   await gr.cells[1]['input-el'].listeners.input()
  }

  // Table 2: `orders` with `customer` (row) and `watchers` (row[])
  await dataView['add-table-btn'].listeners.click()
  await dataView['open-edit-table-modal']()
  dataView['edit-table-modal']['name-input'].value = 'orders'
  await dataView['edit-table-modal']['save-btn'].listeners.click({})

  await dataView['add-col-btn'].listeners.click()
  dataView['schema-rows'][0]['name-el'].value = 'customer'
  await dataView['schema-rows'][0]['name-el'].listeners.input()
  assert.equal(dataView['schema-rows'][0]['row-config-wrap'].hidden, true)

  // Select "row" type -> vertically stacked config appears with table, column, and display dropdowns
  dataView['schema-rows'][0]['type-el'].value = 'row'
  await dataView['schema-rows'][0]['type-el'].listeners.change()
  let srow0 = dataView['schema-rows'][0]
  assert.equal(srow0['row-config-wrap'].hidden, false)
  assert.equal(srow0['ref-col-el'].disabled, true)
  assert.equal(srow0['ref-display-el'].disabled, true)
  assert.match(srow0['ref-table-el'].className, /lane-data-row-select--required/)

  // Pick table `customers` -> column & display dropdowns populate and enable
  srow0['ref-table-el'].value = custTableId
  await srow0['ref-table-el'].listeners.change()
  srow0 = dataView['schema-rows'][0]
  assert.equal(srow0['ref-col-el'].disabled, false)
  assert.equal(srow0['ref-display-el'].disabled, false)
  assert.match(srow0['ref-col-el'].className, /lane-data-row-select--required/)

  // Pick link column `id` (sets real literal type integer) and optional display column `name`
  srow0['ref-col-el'].value = custIdColId
  await srow0['ref-col-el'].listeners.change()
  srow0 = dataView['schema-rows'][0]
  assert.equal(srow0['row-hint-el'].textContent, 'Stores integer')
  assert.equal(dataView['grid-head-cells'][1]['type-el'].textContent, 'row(customers.id)')

  srow0['ref-display-el'].value = custNameColId
  await srow0['ref-display-el'].listeners.change()
  srow0 = dataView['schema-rows'][0]
  assert.equal(srow0['row-hint-el'].textContent, 'Stores integer · displays name')

  // Also add `watchers` (row[]) column referencing customers.id displaying name
  await dataView['add-col-btn'].listeners.click()
  dataView['schema-rows'][1]['name-el'].value = 'watchers'
  await dataView['schema-rows'][1]['name-el'].listeners.input()
  dataView['schema-rows'][1]['type-el'].value = 'row'
  await dataView['schema-rows'][1]['type-el'].listeners.change()
  dataView['schema-rows'][1]['ref-table-el'].value = custTableId
  await dataView['schema-rows'][1]['ref-table-el'].listeners.change()
  dataView['schema-rows'][1]['ref-col-el'].value = custIdColId
  await dataView['schema-rows'][1]['ref-col-el'].listeners.change()
  dataView['schema-rows'][1]['ref-display-el'].value = custNameColId
  await dataView['schema-rows'][1]['ref-display-el'].listeners.change()
  await dataView['schema-rows'][1]['multi-btn'].listeners.click()
  assert.equal(dataView['grid-head-cells'][2]['type-el'].textContent, 'row(customers.id)[]')

  // Add Row 1 in `orders` -> ZERO option pages preloaded!
  await dataView['add-row-btn'].listeners.click()
  assert.equal(fetchCalls.length, 0)
  const orderRow0 = dataView['grid-rows'][0]
  const custCell0 = orderRow0.cells[0]
  const customerColId = dataView.tables[1].columns[0].id
  const watchersColId = dataView.tables[1].columns[1].id
  assert.strictEqual(dataView.tables[1].rows[0].values[customerColId], null)
  assert.equal(custCell0['display-el'].textContent, 'Select customer…')
  assert.equal(custCell0['id-el'].hidden, true)

  // Click cell to edit -> opens Row Picker and asynchronously loads ONLY page 1 (3 items)
  await custCell0['trigger-el'].listeners.click()
  assert.equal(rowPicker['is-open'], true)
  assert.deepEqual(fetchCalls, [{ offset: 0, limit: 3 }])
  assert.equal(rowPicker['option-items'].length, 3)
  assert.equal(rowPicker['more-btn'].hidden, false)
  assert.equal(rowPicker['option-items'][0].item.displayText, 'Acme Alpha')
  assert.equal(rowPicker['option-items'][0].item.valueText, '101')

  // Search matching >= pageSize (3) cached items ('Acme') -> NO extra pages fetched!
  rowPicker['search-input'].value = 'Acme'
  await rowPicker['search-input'].listeners.input()
  assert.equal(fetchCalls.length, 1)
  assert.equal(rowPicker['option-items'].length, 3)

  // Search for a record on page 3 ('Grace') -> scans pages 2 and 3 on demand
  rowPicker['search-input'].value = 'Grace'
  await rowPicker['search-input'].listeners.input()
  assert.deepEqual(fetchCalls, [
   { offset: 0, limit: 3 },
   { offset: 3, limit: 3 },
   { offset: 6, limit: 3 },
  ])
  assert.equal(rowPicker['option-items'].length, 1)
  assert.equal(rowPicker['option-items'][0].item.value, 107)
  assert.equal(rowPicker['option-items'][0].item.displayText, 'Echo Grace')

  // Pick 'Echo Grace' (107) -> stores literal integer 107 and renders joined display + id in cell
  await rowPicker['option-items'][0].el.listeners.click()
  assert.equal(rowPicker['is-open'], false)
  assert.strictEqual(dataView.tables[1].rows[0].values[customerColId], 107)
  assert.equal(custCell0['display-el'].textContent, 'Echo Grace')
  assert.equal(custCell0['id-el'].textContent, '107')
  assert.equal(custCell0['id-el'].hidden, false)

  // Open picker again -> loads page 1 only, Load more loads page 2, Clear resets value to null
  fetchCalls.length = 0
  await custCell0['trigger-el'].listeners.click()
  assert.deepEqual(fetchCalls, [{ offset: 0, limit: 3 }])
  assert.equal(rowPicker['clear-btn'].hidden, false)
  await rowPicker['more-btn'].listeners.click()
  assert.deepEqual(fetchCalls, [{ offset: 0, limit: 3 }, { offset: 3, limit: 3 }])
  assert.equal(rowPicker['option-items'].length, 6)
  await rowPicker['clear-btn'].listeners.click()
  assert.equal(rowPicker['is-open'], false)
  assert.strictEqual(dataView.tables[1].rows[0].values[customerColId], null)
  assert.equal(custCell0['display-el'].textContent, 'Select customer…')

  // Pick 'Acme Beta' (102) via initial page 1 (zero extra page loads)
  fetchCalls.length = 0
  await custCell0['trigger-el'].listeners.click()
  assert.deepEqual(fetchCalls, [{ offset: 0, limit: 3 }])
  await rowPicker['option-items'][1].el.listeners.click()
  assert.strictEqual(dataView.tables[1].rows[0].values[customerColId], 102)
  assert.equal(custCell0['display-el'].textContent, 'Acme Beta')
  assert.equal(custCell0['id-el'].textContent, '102')

  // Top of row picker list has a blank row with "+ Add" that expands into a full new row option and only saves on Save
  await custCell0['trigger-el'].listeners.click()
  assert.equal(rowPicker['is-open'], true)
  assert.equal(rowPicker['can-add'], true)
  assert.equal(rowPicker['add-expanded'], false)
  assert.equal(rowPicker['add-trigger-btn'].hidden, false)
  assert.equal(rowPicker['add-form-el'].hidden, true)
  assert.equal(rowPicker['list-el'].children[0], rowPicker['add-trigger-btn'])
  assert.equal(rowPicker['list-el'].children[1], rowPicker['add-form-el'])
  assert.equal(rowPicker['add-btn'].textContent, '+ Add')

  // Click "+ Add" blank row -> expands into full new row form for `customers` (columns: id, name)
  await rowPicker['add-trigger-btn'].listeners.click()
  assert.equal(rowPicker['add-expanded'], true)
  assert.equal(rowPicker['add-trigger-btn'].hidden, true)
  assert.equal(rowPicker['add-form-el'].hidden, false)
  assert.equal(rowPicker['add-fields'].length, 2)
  assert.equal(rowPicker['add-fields'][0].name, 'id')
  assert.equal(rowPicker['add-fields'][1].name, 'name')

  // Typing into expanded fields does NOT save to customers table before Save is pressed
  rowPicker['add-fields'][0]['input-el'].value = '108'
  await rowPicker['add-fields'][0]['input-el'].listeners.input()
  rowPicker['add-fields'][1]['input-el'].value = 'Unsaved Draft'
  await rowPicker['add-fields'][1]['input-el'].listeners.input()
  assert.equal(dataView.tables[0].rows.length, 7)

  // Clicking Cancel inside expanded new row collapses it back to blank "+ Add" row without saving
  await rowPicker['add-cancel-btn'].listeners.click()
  assert.equal(rowPicker['add-expanded'], false)
  assert.equal(rowPicker['add-trigger-btn'].hidden, false)
  assert.equal(rowPicker['add-form-el'].hidden, true)
  assert.equal(dataView.tables[0].rows.length, 7)

  // Expand again; clicking Save while required link column `id` is empty blocks save and shows error
  await rowPicker['add-btn'].listeners.click()
  assert.equal(rowPicker['add-expanded'], true)
  await rowPicker['add-save-btn'].listeners.click()
  assert.equal(rowPicker['is-open'], true)
  assert.equal(rowPicker['add-error-el'].hidden, false)
  assert.match(rowPicker['add-error-el'].textContent, /id is required/)
  assert.equal(dataView.tables[0].rows.length, 7)

  // Fill in id = 108 and name = 'Horizon Eta', then click Save -> saves new row, selects 108, and closes modal
  rowPicker['add-fields'][0]['input-el'].value = '108'
  await rowPicker['add-fields'][0]['input-el'].listeners.input()
  rowPicker['add-fields'][1]['input-el'].value = 'Horizon Eta'
  await rowPicker['add-fields'][1]['input-el'].listeners.input()
  await rowPicker['add-save-btn'].listeners.click()
  assert.equal(rowPicker['is-open'], false)
  assert.equal(dataView.tables[0].rows.length, 8)
  assert.equal(dataView.tables[0].rows[7].values[custIdColId], 108)
  assert.equal(dataView.tables[0].rows[7].values[custNameColId], 'Horizon Eta')
  assert.equal(dataView['table-tabs'][0]['count-el'].textContent, 8)
  assert.strictEqual(dataView.tables[1].rows[0].values[customerColId], 108)
  assert.equal(custCell0['display-el'].textContent, 'Horizon Eta')
  assert.equal(custCell0['id-el'].textContent, '108')

  // Switch back to Acme Beta (102) for subsequent assertions
  await custCell0['trigger-el'].listeners.click()
  await rowPicker['option-items'][1].el.listeners.click()
  assert.strictEqual(dataView.tables[1].rows[0].values[customerColId], 102)
  assert.equal(custCell0['display-el'].textContent, 'Acme Beta')
  assert.equal(custCell0['id-el'].textContent, '102')

  // Edit watchers (row[]): clicking + opens multiselect row picker; toggle 101 and 106, verify Cancel discards, then Apply commits
  const watchersCell0 = orderRow0.cells[1]
  await watchersCell0['add-btn'].listeners.click()
  assert.equal(rowPicker['is-open'], true)
  assert.equal(rowPicker.multiple, true)
  assert.equal(rowPicker['apply-btn'].hidden, false)
  await rowPicker['option-items'][0].el.listeners.click() // 101 Acme Alpha
  assert.equal(rowPicker['is-open'], true)
  assert.deepEqual(rowPicker['selected-values'], [101])
  await rowPicker['cancel-btn'].listeners.click()
  assert.equal(rowPicker['is-open'], false)
  assert.deepEqual(dataView.tables[1].rows[0].values[watchersColId], [])

  await watchersCell0['add-btn'].listeners.click()
  await rowPicker['option-items'][0].el.listeners.click() // 101 Acme Alpha
  rowPicker['search-input'].value = 'Zeta'
  await rowPicker['search-input'].listeners.input()
  await rowPicker['option-items'][0].el.listeners.click() // 106 Delta Zeta
  assert.deepEqual(rowPicker['selected-values'], [101, 106])
  assert.equal(rowPicker['selected-chips'].length, 2)
  await rowPicker['apply-btn'].listeners.click()
  assert.equal(rowPicker['is-open'], false)
  assert.deepEqual(dataView.tables[1].rows[0].values[watchersColId], [101, 106])
  assert.equal(watchersCell0.items[1]['display-el'].textContent, 'Delta Zeta')
  assert.equal(watchersCell0.items[1]['id-el'].textContent, '106')

  // Display column equal to link column hides separate ID badge; restoring `name` brings it back
  dataView['schema-rows'][0]['ref-display-el'].value = custIdColId
  await dataView['schema-rows'][0]['ref-display-el'].listeners.change()
  assert.equal(dataView['grid-rows'][0].cells[0]['display-el'].textContent, '102')
  assert.equal(dataView['grid-rows'][0].cells[0]['id-el'].hidden, true)
  dataView['schema-rows'][0]['ref-display-el'].value = custNameColId
  await dataView['schema-rows'][0]['ref-display-el'].listeners.change()
  assert.equal(dataView['grid-rows'][0].cells[0]['display-el'].textContent, 'Acme Beta')
  assert.equal(dataView['grid-rows'][0].cells[0]['id-el'].textContent, '102')
  assert.equal(dataView['grid-rows'][0].cells[0]['id-el'].hidden, false)

  // Destructive conversion confirmation: row(customers.id) -> boolean prompts; Cancel reverts
  dataView['schema-rows'][0]['type-el'].value = 'boolean'
  await dataView['schema-rows'][0]['type-el'].listeners.change()
  assert.equal(confirmModal['is-open'], true)
  await confirmModal['cancel-btn'].listeners.click()
  assert.equal(dataView.tables[1].columns[0].type, 'row')
  assert.strictEqual(dataView.tables[1].rows[0].values[customerColId], 102)

  // Source & Scope see literal stored values from row and row[] columns
  await nb.tabs.source.listeners.click()
  nb.rows[0]['input-el'].value = '; add $orders.0.customer 8'
  await nb.rows[0]['input-el'].listeners.input()
  assert.equal(nb.rows[0]['preview-el'].textContent, '110')
  assert.deepEqual(nb.state.orders, [{ customer: 102, watchers: [101, 106] }])

  // Reload app -> zero preloaded pages, literal values & joined table rendering restore intact
  fetchCalls.length = 0
  const fReload = makeRuntime()
  await fReload.run(parse(mainSource, '/src/main.fs'))
  const reloadedData = fReload.state.lanes[0].notebook['data-view']
  await reloadedData['select-table'](reloadedData.tables[1].id)
  assert.equal(fetchCalls.length, 0)
  assert.equal(reloadedData['grid-rows'][0].cells[0]['display-el'].textContent, 'Acme Beta')
  assert.equal(reloadedData['grid-rows'][0].cells[0]['id-el'].textContent, '102')
  assert.equal(reloadedData['grid-rows'][0].cells[0]['id-el'].hidden, false)
  assert.equal(reloadedData['grid-rows'][0].cells[1].items[0]['display-el'].textContent, 'Acme Alpha')
  assert.equal(reloadedData['grid-rows'][0].cells[1].items[1]['display-el'].textContent, 'Delta Zeta')
  assert.deepEqual(fReload.state.lanes[0].notebook.state.orders, [{ customer: 102, watchers: [101, 106] }])

  // Escape closes row picker cleanly
  await reloadedData['grid-rows'][0].cells[0]['trigger-el'].listeners.click()
  assert.equal(reloadedData['row-picker']['is-open'], true)
  await dispatchWindowEvent('keydown', { key: 'Escape' })
  assert.equal(reloadedData['row-picker']['is-open'], false)
 }
 finally {
  globalThis.fetch = origFetch
 }
})

test('data|tablename sub-routing parses, formats, selects known tables, falls back to first table, and restores on reload', async () => {
 assert.deepEqual(parseLaneRouteSegment('lane-1;data|orders'), { id: 'lane-1', tab: 'data', subroute: 'orders' })
 assert.deepEqual(parseLaneRouteSegment('lane-1;data|my%20table'), { id: 'lane-1', tab: 'data', subroute: 'my table' })
 assert.deepEqual(parseLaneRouteSegment('lane-1;data%7Corders'), { id: 'lane-1', tab: 'data', subroute: 'orders' })
 assert.deepEqual(parseLaneRouteSegment('lane-1;data|'), { id: 'lane-1', tab: 'data' })
 assert.deepEqual(parseLaneRouteSegment('lane-1;source|orders'), { id: 'lane-1', tab: 'source' })
 assert.equal(formatLaneRouteSegment('lane-1', 'data', 'orders'), 'lane-1;data|orders')
 assert.equal(formatLaneRouteSegment('lane-1', 'data', 'my table'), 'lane-1;data|my%20table')
 assert.equal(formatLaneRouteSegment('lane-1', 'source', 'orders'), 'lane-1')
 assert.deepEqual(
  parseLaneRoutes('/lane-1;data|orders/lane-2;view'),
  [
   { id: 'lane-1', tab: 'data', subroute: 'orders' },
   { id: 'lane-2', tab: 'view' },
  ]
 )
 assert.equal(
  formatLaneRoutes([
   { id: 'lane-1', tab: 'data', subroute: 'orders' },
   { id: 'lane-2', tab: 'view' },
  ]),
  '/lane-1;data|orders/lane-2;view'
 )

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

 function makeRuntime(initialPathname = '/') {
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
   crypto: { randomUUID: () => `data-route-uuid-${++uuidCounter}` },
   history: {
    pushState(_s, _t, url) { location.pathname = url },
    replaceState(_s, _t, url) { location.pathname = url },
   },
   location,
   addEventListener(event, handler) {
    windowListeners[event] ||= []
    windowListeners[event].push(handler)
   },
  }
  const f = field({
   ...DATA_RUNTIME_ENV,
   console: { log() {} },
   createIdleTracker,
   data: mockKV,
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
   runLines,
   runTransportedScripts,
  })
  return {
   f,
   location,
   async dispatch(event) {
    for (const h of windowListeners[event] || []) {
     await h()
    }
   },
  }
 }

 try {
  const r1 = makeRuntime('/')
  await r1.f.run(parse(mainSource, '/src/main.fs'))
  await r1.f.state.tableHeadRowAddButton.listeners.click[0]()
  const lane = r1.f.state.lanes[0]
  const dv = lane.notebook['data-view']

  // Switch to Data tab and create two tables: users and orders
  await lane.notebook['set-tab']('data')
  assert.equal(r1.location.pathname, `/${lane.id};data`)
  await dv['add-table']('users')
  assert.equal(r1.location.pathname, `/${lane.id};data|users`)
  await dv['add-table']('orders')
  assert.equal(r1.location.pathname, `/${lane.id};data|orders`)

  // Selecting users updates the URL subroute
  await dv['select-table'](dv.tables[0].id)
  assert.equal(r1.location.pathname, `/${lane.id};data|users`)

  // Selecting orders updates the URL subroute
  await dv['select-table'](dv.tables[1].id)
  assert.equal(r1.location.pathname, `/${lane.id};data|orders`)

  // Reloading on /<id>;data|orders restores the second table (orders)
  const r2 = makeRuntime(`/${lane.id};data|orders`)
  await r2.f.run(parse(mainSource, '/src/main.fs'))
  const dv2 = r2.f.state.lanes[0].notebook['data-view']
  assert.equal(dv2['get-active-table']().name, 'orders')
  assert.equal(dv2['view-name-el'].textContent, 'orders')

  // Popstate to /<id>;data|users switches to users
  r2.location.pathname = `/${lane.id};data|users`
  await r2.dispatch('popstate')
  assert.equal(r2.f.state.lanes[0].notebook['data-view']['get-active-table']().name, 'users')

  // Reloading with an unknown table name falls back to the first table (users)
  const r3 = makeRuntime(`/${lane.id};data|nonexistent`)
  await r3.f.run(parse(mainSource, '/src/main.fs'))
  const dv3 = r3.f.state.lanes[0].notebook['data-view']
  assert.equal(dv3['get-active-table']().name, 'users')
 }
 finally {
  globalThis.fetch = origFetch
 }
})

test('workflow constraint helpers: normalization, default from/to detection, transition graph, cell states, and stored persistence', () => {
 assert.deepEqual(DATA_CONSTRAINT_TYPES, [
  'workflow',
  'min',
  'max',
  'range',
  'step',
  'date_range',
  'min_length',
  'max_length',
  'pattern',
  'one_of',
  'boolean_value',
  'https_only',
  'domain',
  'json_type',
  'required_keys',
  'unique',
 ])
 assert.equal(normalizeColumnConstraint(null), null)
 assert.equal(normalizeColumnConstraint({ type: 'unknown' }), null)
 assert.deepEqual(
  normalizeColumnConstraint({ type: 'workflow', tableId: 't-wf', fromColumnId: 'c-f', toColumnId: 'c-t' }),
  { type: 'workflow', tableId: 't-wf', fromColumnId: 'c-f', toColumnId: 'c-t' }
 )

 // findWorkflowDefaultColumns prefers exact `from`/`to`, falls back to case-insensitive
 assert.deepEqual(
  findWorkflowDefaultColumns({
   columns: [
    { id: 'c1', name: 'From' },
    { id: 'c2', name: 'from' },
    { id: 'c3', name: 'To' },
   ],
  }),
  { fromColumnId: 'c2', toColumnId: 'c3' }
 )
 assert.deepEqual(
  findWorkflowDefaultColumns({ columns: [{ id: 'c1', name: 'title' }] }),
  { fromColumnId: '', toColumnId: '' }
 )

 // parseColumnType & formatColumnType keep workflow constraint on text, integer, and boolean columns, and strip on unsupported types
 const wfSpec = {
  type: 'text',
  multiple: false,
  constraint: { type: 'workflow', tableId: 't-wf', fromColumnId: 'c-from', toColumnId: 'c-to' },
 }
 assert.deepEqual(parseColumnType(wfSpec), { ...wfSpec, constraints: [wfSpec.constraint] })
 assert.deepEqual(parseColumnType({ type: 'integer', multiple: false, constraint: wfSpec.constraint }), {
  type: 'integer',
  multiple: false,
  constraint: wfSpec.constraint,
  constraints: [wfSpec.constraint],
 })
 assert.deepEqual(parseColumnType({ type: 'boolean', multiple: false, constraint: wfSpec.constraint }), {
  type: 'boolean',
  multiple: false,
  constraint: wfSpec.constraint,
  constraints: [wfSpec.constraint],
 })
 assert.deepEqual(parseColumnType({ type: 'date', multiple: false, constraint: wfSpec.constraint }), {
  type: 'date',
  multiple: false,
 })
 assert.equal(formatColumnType(wfSpec), 'text(workflow)')
 assert.equal(formatColumnType({ ...wfSpec, type: 'integer' }), 'integer(workflow)')
 assert.equal(formatColumnType({ ...wfSpec, type: 'boolean' }), 'boolean(workflow)')
 assert.equal(formatColumnType({ ...wfSpec, multiple: true }), 'text(workflow)[]')

 const tables = [
  {
   id: 't-tasks',
   name: 'tasks',
   columns: [
    { id: 'c-title', name: 'title', type: 'text', multiple: false },
    {
     id: 'c-status',
     name: 'status',
     type: 'text',
     multiple: false,
     constraint: { type: 'workflow', tableId: 't-wf', fromColumnId: 'c-from', toColumnId: 'c-to' },
    },
   ],
   rows: [
    { id: 'r1', values: { 'c-title': 'Ship feature', 'c-status': 'Draft' } },
    { id: 'r2', values: { 'c-title': 'Old item', 'c-status': 'Legacy' } },
   ],
  },
  {
   id: 't-wf',
   name: 'workflow',
   columns: [
    { id: 'c-from', name: 'from', type: 'text', multiple: false },
    { id: 'c-to', name: 'to', type: 'text', multiple: false },
   ],
   rows: [
    { id: 'w1', values: { 'c-from': 'Draft', 'c-to': 'Review' } },
    { id: 'w2', values: { 'c-from': 'Review', 'c-to': 'Approved' } },
    { id: 'w3', values: { 'c-from': 'Review', 'c-to': 'Draft' } },
    { id: 'w4', values: { 'c-from': 'Review', 'c-to': 'Approved' } }, // duplicate
    { id: 'w5', values: { 'c-from': '', 'c-to': '' } }, // blank row ignored
   ],
  },
 ]

 const target = resolveWorkflowTarget(tables, tables[0].columns[1])
 assert.equal(target.active, true)
 assert.equal(target.configured, true)
 assert.equal(target.valid, true)
 assert.equal(target.tableName, 'workflow')
 assert.equal(target.fromColName, 'from')
 assert.equal(target.toColName, 'to')
 assert.deepEqual(target.fromValues, ['Draft', 'Review'])
 assert.deepEqual(target.toValues, ['Review', 'Approved', 'Draft'])
 assert.equal(target.transitionCount, 3)
 assert.deepEqual(target.transitions, {
  Draft: ['Review'],
  Review: ['Approved', 'Draft'],
 })

 // Valid state in `from`: shows current + outgoing `to` options only
 const stDraft = getWorkflowCellState(tables, tables[0].columns[1], 'Draft')
 assert.equal(stDraft.valid, true)
 assert.equal(stDraft.isValueValid, true)
 assert.equal(stDraft.error, null)
 assert.deepEqual(stDraft.options.map(o => o.value), ['Draft', 'Review'])

 const stReview = getWorkflowCellState(tables, tables[0].columns[1], 'Review')
 assert.equal(stReview.isValueValid, true)
 assert.deepEqual(stReview.options.map(o => o.value), ['Review', 'Approved', 'Draft'])

 // Valid terminal state (in `to` only): remains valid with no outgoing transitions
 const stApproved = getWorkflowCellState(tables, tables[0].columns[1], 'Approved')
 assert.equal(stApproved.isValueValid, true)
 assert.equal(stApproved.error, null)
 assert.deepEqual(stApproved.options.map(o => o.value), ['Approved'])

 // Invalid value: preserves current value, marks error, offers all `from` starting points
 const stLegacy = getWorkflowCellState(tables, tables[0].columns[1], 'Legacy')
 assert.equal(stLegacy.valid, true)
 assert.equal(stLegacy.isValueValid, false)
 assert.equal(stLegacy.currentValue, 'Legacy')
 assert.ok(stLegacy.error)
 assert.deepEqual(stLegacy.options.map(o => ({ v: o.value, inv: o.isInvalid })), [
  { v: 'Legacy', inv: true },
  { v: 'Draft', inv: false },
  { v: 'Review', inv: false },
 ])

 // Empty invalid value: offers all `from` starting points
 const stEmpty = getWorkflowCellState(tables, tables[0].columns[1], '')
 assert.equal(stEmpty.isValueValid, false)
 assert.equal(stEmpty.options[0].value, '')
 assert.equal(stEmpty.options[0].isInvalid, true)
 assert.deepEqual(stEmpty.options.slice(1).map(o => o.value), ['Draft', 'Review'])

 // Unconfigured workflow constraint reports valid=false cleanly
 const stUnconf = getWorkflowCellState(
  tables,
  { id: 'c-u', name: 'u', type: 'text', multiple: false, constraint: { type: 'workflow', tableId: '', fromColumnId: '', toColumnId: '' } },
  'Draft'
 )
 assert.equal(stUnconf.active, true)
 assert.equal(stUnconf.configured, false)
 assert.equal(stUnconf.valid, false)

 // Stored table parsing preserves workflow constraints on text columns and strips on non-text
 const reparsed = parseStoredTables(JSON.stringify(tables))
 assert.deepEqual(reparsed[0].columns[1].constraint, tables[0].columns[1].constraint)
 assert.equal(Object.hasOwn(reparsed[0].columns[0], 'constraint'), false)
 assert.deepEqual(buildTablesScope(reparsed).tasks, [
  { title: 'Ship feature', status: 'Draft' },
  { title: 'Old item', status: 'Legacy' },
 ])
})

test('Data tab workflow constraint: + constraint on text only, auto from/to, transition dropdowns, red error states, alignment, and persistence', async () => {
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
   selected: false,
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

 let uuid = 0
 function createRuntime(pathname = '/') {
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
   crypto: { randomUUID: () => `wf-uuid-${++uuid}` },
   history: {
    pushState(_s, _t, url) { mockWindow.location.pathname = url },
    replaceState(_s, _t, url) { mockWindow.location.pathname = url },
   },
   location: { pathname, hash: '' },
   addEventListener() {},
   removeEventListener() {},
  }
  const mockDocument = {
   body: createMockElement('body'),
   documentElement: createMockElement('html'),
   defaultView: mockWindow,
   createElement: createMockElement,
  }
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
  return { f, mockWindow }
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
  const { f, mockWindow } = createRuntime()
  await f.run(parse(mainSource, '/src/main.fs'))
  await f.state.tableHeadRowAddButton.listeners.click()
  const lane = f.state.lanes[0]
  await lane.notebook.tabs.data.listeners.click()
  const dataView = lane.notebook['data-view']

  // 1. Create workflow table with `from` and `to` text columns and 2 transition rows
  const wfTable = await dataView['add-table']('workflow')
  const wfFromCol = await dataView['add-column']('from', 'text', false)
  const wfToCol = await dataView['add-column']('to', 'text', false)
  await dataView['add-row']()
  dataView['grid-rows'][0].cells[0]['input-el'].value = 'todo'
  await dataView['grid-rows'][0].cells[0]['input-el'].listeners.input()
  dataView['grid-rows'][0].cells[1]['input-el'].value = 'doing'
  await dataView['grid-rows'][0].cells[1]['input-el'].listeners.input()
  await dataView['add-row']()
  dataView['grid-rows'][1].cells[0]['input-el'].value = 'doing'
  await dataView['grid-rows'][1].cells[0]['input-el'].listeners.input()
  dataView['grid-rows'][1].cells[1]['input-el'].value = 'done'
  await dataView['grid-rows'][1].cells[1]['input-el'].listeners.input()

  // 2. Create projects table with text `title`, text `status`, and integer `priority`
  const projTable = await dataView['add-table']('projects')
  await dataView['add-column']('title', 'text', false)
  const statusCol = await dataView['add-column']('status', 'text', false)
  await dataView['add-column']('priority', 'integer', false)

  // Add 3 rows: valid ('todo'), invalid ('legacy'), and empty ('')
  await dataView['add-row']()
  dataView['grid-rows'][0].cells[0]['input-el'].value = 'Alpha'
  await dataView['grid-rows'][0].cells[0]['input-el'].listeners.input()
  dataView['grid-rows'][0].cells[1]['input-el'].value = 'todo'
  await dataView['grid-rows'][0].cells[1]['input-el'].listeners.input()

  await dataView['add-row']()
  dataView['grid-rows'][1].cells[0]['input-el'].value = 'Beta'
  await dataView['grid-rows'][1].cells[0]['input-el'].listeners.input()
  dataView['grid-rows'][1].cells[1]['input-el'].value = 'legacy'
  await dataView['grid-rows'][1].cells[1]['input-el'].listeners.input()

  await dataView['add-row']()
  dataView['grid-rows'][2].cells[0]['input-el'].value = 'Gamma'
  await dataView['grid-rows'][2].cells[0]['input-el'].listeners.input()

  // Verify `+ constraint` dropdown exposes supported constraints per column type, and Constraint section starts hidden
  const titleSrow = dataView['schema-rows'][0]
  const statusSrow = dataView['schema-rows'][1]
  const prioritySrow = dataView['schema-rows'][2]
  assert.equal(titleSrow['constraint-add-el'].hidden, false)
  assert.equal(titleSrow['constraint-add-el'].children[0].textContent, '+ constraint')
  assert.equal(titleSrow['constraint-add-el'].children[1].value, 'workflow')
  assert.equal(titleSrow['constraint-add-el'].children[1].textContent, 'Workflow')
  assert.equal(titleSrow['constraint-config-wrap'].hidden, true)
  assert.equal(statusSrow['constraint-add-el'].hidden, false)
  assert.equal(statusSrow['constraint-config-wrap'].hidden, true)
  assert.equal(prioritySrow['constraint-add-el'].hidden, false)
  assert.deepEqual(
   prioritySrow['constraint-add-el'].children.slice(1).map(o => o.value),
   ['workflow', 'min', 'max', 'range', 'step', 'unique']
  )
  assert.equal(prioritySrow['constraint-config-wrap'].hidden, true)

  // 3. Add Workflow constraint to `status` via `+ constraint` dropdown
  statusSrow['constraint-add-el'].value = 'workflow'
  await statusSrow['constraint-add-el'].listeners.change()

  const statusSrowOpen = dataView['schema-rows'][1]
  assert.equal(statusSrowOpen['constraint-add-el'].hidden, false)
  assert.deepEqual(
   statusSrowOpen['constraint-add-el'].children.slice(1).map(o => o.value),
   ['min_length', 'max_length', 'pattern', 'one_of', 'unique']
  )
  assert.equal(statusSrowOpen['constraint-config-wrap'].hidden, false)
  assert.equal(statusSrowOpen['constraint-type-el'].value, 'workflow')
  assert.deepEqual(
   statusSrowOpen['constraint-type-el'].children.map(o => ({ v: o.value, t: o.textContent })),
   [
    { v: 'workflow', t: 'Workflow' },
    { v: 'min_length', t: 'Min Length' },
    { v: 'max_length', t: 'Max Length' },
    { v: 'pattern', t: 'Pattern' },
    { v: 'one_of', t: 'One Of' },
    { v: 'unique', t: 'Unique' },
   ]
  )
  assert.deepEqual(
   statusSrowOpen['constraint-table-el'].children.map(o => o.value),
   ['', wfTable.id, projTable.id]
  )
  assert.equal(statusSrowOpen['constraint-from-el'].disabled, true)
  assert.equal(statusSrowOpen['constraint-to-el'].disabled, true)

  // Select `workflow` table -> `from` and `to` autoselect automatically
  statusSrowOpen['constraint-table-el'].value = wfTable.id
  await statusSrowOpen['constraint-table-el'].listeners.change()

  const statusSrowMapped = dataView['schema-rows'][1]
  assert.equal(statusSrowMapped['constraint-table-el'].value, wfTable.id)
  assert.equal(statusSrowMapped['constraint-from-el'].disabled, false)
  assert.equal(statusSrowMapped['constraint-to-el'].disabled, false)
  assert.equal(statusSrowMapped['constraint-from-el'].value, wfFromCol.id)
  assert.equal(statusSrowMapped['constraint-to-el'].value, wfToCol.id)
  assert.match(statusSrowMapped['constraint-hint-el'].textContent, /workflow \(from → to\) · 2 transitions/)

  // Switching to a table without `from`/`to` resets column selects; switching back autoselects again
  statusSrowMapped['constraint-table-el'].value = projTable.id
  await statusSrowMapped['constraint-table-el'].listeners.change()
  assert.equal(dataView['schema-rows'][1]['constraint-from-el'].value, '')
  assert.equal(dataView['schema-rows'][1]['constraint-to-el'].value, '')
  dataView['schema-rows'][1]['constraint-table-el'].value = wfTable.id
  await dataView['schema-rows'][1]['constraint-table-el'].listeners.change()
  assert.equal(dataView['schema-rows'][1]['constraint-from-el'].value, wfFromCol.id)
  assert.equal(dataView['schema-rows'][1]['constraint-to-el'].value, wfToCol.id)

  // 4. Verify grid cells for `status` are dropdowns (<select>) with workflow transitions & red errors
  assert.equal(dataView['grid-head-cells'][2]['type-el'].textContent, 'text(workflow)')

  const cell0 = dataView['grid-rows'][0].cells[1]
  assert.equal(cell0['select-el'].tag, 'select')
  assert.equal(cell0['select-el'].value, 'todo')
  assert.equal(cell0['select-el'].className, 'lane-data-cell-select')
  assert.equal(cell0['select-el'].attributes['aria-invalid'], 'false')
  assert.deepEqual(cell0['option-els'].map(o => o.value), ['todo', 'doing'])

  // Transition Row 1: todo -> doing -> done
  cell0['select-el'].value = 'doing'
  await cell0['select-el'].listeners.change()
  assert.equal(projTable.rows[0].values[statusCol.id], 'doing')
  assert.equal(cell0['select-el'].className, 'lane-data-cell-select')
  assert.deepEqual(cell0['option-els'].map(o => o.value), ['doing', 'done'])

  cell0['select-el'].value = 'done'
  await cell0['select-el'].listeners.change()
  assert.equal(projTable.rows[0].values[statusCol.id], 'done')
  assert.equal(cell0['select-el'].className, 'lane-data-cell-select')
  assert.equal(cell0['select-el'].attributes['aria-invalid'], 'false')
  assert.deepEqual(cell0['option-els'].map(o => o.value), ['done'])

  // Row 2 ('legacy') is invalid -> highlighted red, value NOT mutated, shows all `from` options as starting points
  const cell1 = dataView['grid-rows'][1].cells[1]
  assert.equal(projTable.rows[1].values[statusCol.id], 'legacy')
  assert.equal(cell1['select-el'].value, 'legacy')
  assert.match(cell1['select-el'].className, /lane-data-cell-select--invalid/)
  assert.equal(cell1['select-el'].attributes['aria-invalid'], 'true')
  assert.equal(cell1['option-els'][0].attributes['data-invalid'], 'true')
  assert.deepEqual(cell1['option-els'].map(o => o.value), ['legacy', 'todo', 'doing'])

  // Row 3 ('') is invalid -> highlighted red, offers all `from` starting points; choosing 'todo' clears red immediately
  const cell2 = dataView['grid-rows'][2].cells[1]
  assert.equal(projTable.rows[2].values[statusCol.id], '')
  assert.match(cell2['select-el'].className, /lane-data-cell-select--invalid/)
  assert.equal(cell2['select-el'].attributes['aria-invalid'], 'true')
  assert.deepEqual(cell2['option-els'].map(o => o.value), ['', 'todo', 'doing'])
  cell2['select-el'].value = 'todo'
  await cell2['select-el'].listeners.change()
  assert.equal(projTable.rows[2].values[statusCol.id], 'todo')
  assert.equal(cell2['select-el'].className, 'lane-data-cell-select')
  assert.equal(cell2['select-el'].attributes['aria-invalid'], 'false')
  assert.deepEqual(cell2['option-els'].map(o => o.value), ['todo', 'doing'])

  // 5. Align workflow by adding `legacy -> done` to workflow table -> Row 2 red clears automatically on return
  await dataView['select-table'](wfTable.id)
  await dataView['add-row']()
  dataView['grid-rows'][2].cells[0]['input-el'].value = 'legacy'
  await dataView['grid-rows'][2].cells[0]['input-el'].listeners.input()
  dataView['grid-rows'][2].cells[1]['input-el'].value = 'done'
  await dataView['grid-rows'][2].cells[1]['input-el'].listeners.input()

  await dataView['select-table'](projTable.id)
  const alignedCell1 = dataView['grid-rows'][1].cells[1]
  assert.equal(alignedCell1['select-el'].value, 'legacy')
  assert.equal(alignedCell1['select-el'].className, 'lane-data-cell-select')
  assert.equal(alignedCell1['select-el'].attributes['aria-invalid'], 'false')
  assert.deepEqual(alignedCell1['option-els'].map(o => o.value), ['legacy', 'done'])

  // 6. Reload entire app -> persisted workflow constraint and dropdowns restore cleanly
  const reloaded = createRuntime(mockWindow.location.pathname)
  await reloaded.f.run(parse(mainSource, '/src/main.fs'))
  const rDataView = reloaded.f.state.lanes[0].notebook['data-view']
  const rProj = rDataView.tables.find(t => t.name === 'projects')
  assert.deepEqual(rProj.columns[1].constraint, {
   type: 'workflow',
   tableId: wfTable.id,
   fromColumnId: wfFromCol.id,
   toColumnId: wfToCol.id,
  })
  assert.equal(rDataView['grid-rows'][1].cells[1]['select-el'].tag, 'select')
  assert.deepEqual(rDataView['grid-rows'][1].cells[1]['option-els'].map(o => o.value), ['legacy', 'done'])

  // 7. Removing constraint restores `+ constraint` and free text input without changing row values
  await rDataView['schema-toggle-btn'].listeners.click()
  await rDataView['schema-rows'][1]['constraint-remove-btn'].listeners.click()
  assert.equal(Object.hasOwn(rProj.columns[1], 'constraint'), false)
  assert.equal(rDataView['schema-rows'][1]['constraint-add-el'].hidden, false)
  assert.equal(rDataView['schema-rows'][1]['constraint-config-wrap'].hidden, true)
  assert.equal(rDataView['grid-rows'][1].cells[1]['input-el'].tag, 'input')
  assert.equal(rDataView['grid-rows'][1].cells[1]['input-el'].value, 'legacy')
 }
 finally {
  globalThis.fetch = origFetch
 }
})

test('lane Data type helpers: parsing, defaults, validation, coercion, change impact, stored tables, and scope export', () => {
 assert.equal(normalizeDataColumnType('lane'), 'lane')
 assert.equal(normalizeDataColumnType('lane[]'), 'lane')
 assert.deepEqual(parseColumnType('lane'), { type: 'lane', multiple: false })
 assert.deepEqual(parseColumnType('lane[]'), { type: 'lane', multiple: true })
 assert.deepEqual(parseColumnType({ type: 'lane', multiple: true }), { type: 'lane', multiple: true })
 assert.equal(formatColumnType('lane', false), 'lane')
 assert.equal(formatColumnType('lane', true), 'lane[]')

 assert.strictEqual(defaultDataValue('lane', false), null)
 assert.deepEqual(defaultDataValue('lane', true), [])

 assert.deepEqual(parseCellValue(null, 'lane'), { ok: true, value: null, error: null })
 assert.deepEqual(parseCellValue(undefined, 'lane'), { ok: true, value: null, error: null })
 assert.deepEqual(parseCellValue('   ', 'lane'), { ok: true, value: null, error: null })
 assert.deepEqual(parseCellValue('  lane-123  ', 'lane'), { ok: true, value: 'lane-123', error: null })
 assert.equal(parseCellValue(42, 'lane').ok, false)
 assert.equal(parseCellValue({ id: 'lane-123' }, 'lane').ok, false)

 assert.equal(formatCellInputValue(null, 'lane'), '')
 assert.equal(formatCellInputValue('lane-123', 'lane'), 'lane-123')

 assert.strictEqual(coerceDataValue('', 'lane', false), null)
 assert.strictEqual(coerceDataValue('  lane-abc  ', 'lane', false), 'lane-abc')
 assert.strictEqual(coerceDataValue(null, 'lane', false), null)
 assert.strictEqual(coerceDataValue({ bad: true }, 'lane', false), null)
 assert.deepEqual(coerceDataValue('', 'lane', true), [])
 assert.deepEqual(coerceDataValue([' lane-1 ', '', null], 'lane', true), ['lane-1', null, null])
 assert.strictEqual(coerceDataValue(['lane-1', 'lane-2'], 'lane', false), 'lane-1')
 assert.strictEqual(coerceDataValue('lane-1', 'text', false, 'lane'), 'lane-1')
 assert.strictEqual(coerceDataValue(null, 'text', false, 'lane'), '')

 const sampleTbl = {
  id: 'tbl-lanes',
  name: 'routes',
  columns: [
   { id: 'c-lane', name: 'target_lane', type: 'lane', multiple: false },
   { id: 'c-multi', name: 'backup_lanes', type: 'lane', multiple: true },
  ],
  rows: [
   { id: 'r1', values: { 'c-lane': 'lane-a', 'c-multi': ['lane-b', 'lane-c'] } },
  ],
 }
 assert.equal(checkColumnChangeImpact(sampleTbl, 'c-lane', 'lane', false).destructive, false)
 assert.equal(checkColumnChangeImpact(sampleTbl, 'c-lane', 'lane', true).destructive, false)
 assert.equal(checkColumnChangeImpact(sampleTbl, 'c-multi', 'lane', false).destructive, true)
 assert.equal(checkColumnChangeImpact(sampleTbl, 'c-lane', 'integer', false).destructive, true)

 const stored = JSON.stringify([
  {
   id: 'tbl-lanes',
   name: 'routes',
   columns: [
    { id: 'c-lane', name: 'target_lane', type: 'lane', multiple: false },
    { id: 'c-multi', name: 'backup_lanes', type: 'lane', multiple: true },
   ],
   rows: [
    { id: 'r1', values: { 'c-lane': '  lane-a  ', 'c-multi': ['lane-b', ''] } },
    { id: 'r2', values: {} },
   ],
  },
 ])
 const parsed = parseStoredTables(stored)
 assert.equal(parsed[0].columns[0].type, 'lane')
 assert.equal(parsed[0].columns[1].type, 'lane')
 assert.equal(parsed[0].columns[1].multiple, true)
 assert.strictEqual(parsed[0].rows[0].values['c-lane'], 'lane-a')
 assert.deepEqual(parsed[0].rows[0].values['c-multi'], ['lane-b', null])
 assert.strictEqual(parsed[0].rows[1].values['c-lane'], null)
 assert.deepEqual(parsed[0].rows[1].values['c-multi'], [])

 assert.deepEqual(buildTablesScope(parsed), {
  routes: [
   { target_lane: 'lane-a', backup_lanes: ['lane-b', null] },
   { target_lane: null, backup_lanes: [] },
  ],
 })
})

test('Data tab lane type: custom-named lane column, Open-Lane-style picker, live rename, clear, lane[], reload, and Open Lane mode preservation', async () => {
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
   crypto: { randomUUID: () => `lane-type-uuid-${++uuid}` },
   history: { pushState(_s, _t, url) { mockWindow.location.pathname = url } },
   location: { pathname: initialPathname, search: '', hash: '' },
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
  const mockBody = createMockElement('body')
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
   runLines,
   runTransportedScripts,
  })
  return { f, mockWindow, mockBody, dispatchWindowEvent }
 }

 try {
  const { f, mockWindow, mockBody, dispatchWindowEvent } = createRuntime('/')
  await f.run(parse(mainSource, '/src/main.fs'))
  const laneControl = f.state['lane-control']
  const modal = f.state['lane-modal']

  // Create 3 lanes: Board, Worker A (closed later), Worker B
  await f.state.tableHeadRowAddButton.listeners.click()
  await f.state.tableHeadRowAddButton.listeners.click()
  await f.state.tableHeadRowAddButton.listeners.click()
  const [boardLane, workerALane, workerBLane] = f.state.lanes
  await laneControl.rename(boardLane.id, 'Board')
  await laneControl.rename(workerALane.id, 'Worker A')
  await laneControl.rename(workerBLane.id, 'Worker B')

  // Switch Board lane to Data tab, create table "assignments" with custom-named lane & lane[] columns
  await boardLane.notebook['set-tab']('data')
  const dv = boardLane.notebook['data-view']
  await dv['add-table']('assignments')
  const colLane = await dv['add-column']('target_lane', 'lane', false)
  const colMulti = await dv['add-column']('backup_lanes', 'lane', true)
  assert.equal(colLane.type, 'lane')
  assert.equal(colMulti.type, 'lane')

  // Verify schema dropdown includes 'lane' and lane cells are NOT right-aligned
  const schemaTypeOpts = dv['schema-rows'][0]['type-el'].children.map(o => o.value)
  assert.ok(schemaTypeOpts.includes('lane'))
  assert.equal(dv['grid-head-cells'][1]['type-el'].textContent, 'lane')
  assert.equal(dv['grid-head-cells'][1]['type-el'].title, 'Stores a selected lane ID')
  assert.equal(dv['grid-head-cells'][2]['type-el'].textContent, 'lane[]')

  // Add a row -> empty lane trigger says "Select lane…" and open button is hidden
  const row1 = await dv['add-row']()
  assert.strictEqual(row1.values[colLane.id], null)
  assert.deepEqual(row1.values[colMulti.id], [])
  const cell1 = dv['grid-rows'][0].cells[0]
  assert.doesNotMatch(cell1.td.className, /lane-data-td--right/)
  assert.equal(cell1['placeholder-el'].textContent, 'Select lane…')
  assert.equal(cell1['placeholder-el'].hidden, false)
  assert.equal(cell1['id-el'].hidden, true)
  assert.equal(cell1['open-el'].hidden, true)
  assert.equal(cell1['trigger-el'].className, 'lane-data-row-trigger lane-data-row-trigger--empty lane-data-lane-id-btn')

  // Close Worker A so we verify both closed and open lanes appear in the picker
  await laneControl.close(workerALane.id)

  // Click cell trigger -> opens lane-scoped lane-modal in picker mode inside boardLane.body
  await cell1['trigger-el'].listeners.click()
  assert.equal(modal['is-open'], true)
  assert.equal(modal.mode, 'pick')
  assert.equal(modal['heading-el'].textContent, 'Select target_lane')
  assert.equal(modal['clear-btn'].hidden, true)
  assert.equal(modal['search-input'].focused, true)
  assert.equal(modal['count-el'].textContent, '3 lanes')
  assert.ok(boardLane.body.children.includes(modal.backdrop))
  assert.ok(!mockBody.children.includes(modal.backdrop))

  // Verify Open badge appears for open lanes and Select button appears on rows
  const workerAItem = modal.items.find(it => it.entry.id === workerALane.id)
  const workerBItem = modal.items.find(it => it.entry.id === workerBLane.id)
  assert.equal(workerAItem['is-open'], false)
  assert.equal(workerBItem['is-open'], true)
  assert.ok(workerAItem['select-btn'])
  assert.ok(workerBItem['select-btn'])

  // Filter lanes by title or ID inside the picker
  modal['search-input'].value = 'worker a'
  await modal['search-input'].listeners.input()
  assert.equal(modal['count-el'].textContent, '1 of 3 lanes')
  assert.equal(modal.items.length, 1)
  assert.equal(modal.items[0].entry.id, workerALane.id)

  // Filter by lane ID fragment too
  modal['search-input'].value = workerBLane.id
  await modal['search-input'].listeners.input()
  assert.equal(modal.items.length, 1)
  assert.equal(modal.items[0].entry.id, workerBLane.id)

  // Select Worker B -> closes modal, stores lane ID, splits selected state into ID chooser + Open button with up-right arrow
  await modal.items[0]['select-btn'].listeners.click()
  assert.equal(modal['is-open'], false)
  assert.equal(modal.backdrop.removed, true)
  assert.strictEqual(row1.values[colLane.id], workerBLane.id)
  assert.equal(cell1['placeholder-el'].hidden, true)
  assert.equal(cell1['id-el'].textContent, workerBLane.id)
  assert.equal(cell1['id-el'].hidden, false)
  assert.equal(cell1['trigger-el'].className, 'lane-data-row-trigger lane-data-row-trigger--filled lane-data-lane-id-btn')
  assert.equal(cell1['open-el'].hidden, false)
  assert.equal(cell1['display-el'].textContent, 'Worker B')
  assert.equal(cell1['open-el'].children[0], cell1['display-el'])
  assert.match(cell1['open-el'].children[1].innerHTML, /<svg\b[^>]*class="lane-data-lane-open-icon"[^>]*>.*M3\.5 8\.5L8\.5 3\.5M4\.5 3\.5H8\.5V7\.5/)

  // Verify Source/Scope receives the stored lane ID string under the custom column name
  boardLane.notebook.rows[0]['input-el'].value = '; to chosen [ get assignments.0.target_lane ]'
  await boardLane.notebook.rows[0]['input-el'].listeners.input()
  await boardLane.notebook['set-tab']('source')
  assert.equal(boardLane.notebook.state.chosen, workerBLane.id)
  assert.equal(boardLane.notebook.rows[0]['preview-el'].textContent, JSON.stringify(workerBLane.id))

  // Switch back to Data tab and test live rename updates the open-button label while keeping ID chooser
  await boardLane.notebook['set-tab']('data')
  await laneControl.rename(workerBLane.id, 'Builder Prime')
  assert.equal(dv['grid-rows'][0].cells[0]['display-el'].textContent, 'Builder Prime')
  assert.equal(dv['grid-rows'][0].cells[0]['id-el'].textContent, workerBLane.id)

  // Re-open picker via ID area -> selected lane is highlighted with Selected badge + row Clear + toolbar Clear
  await dv['grid-rows'][0].cells[0]['trigger-el'].listeners.click()
  assert.equal(modal['is-open'], true)
  assert.equal(modal['clear-btn'].hidden, false)
  const selectedItem = modal.items.find(it => it.entry.id === workerBLane.id)
  assert.equal(selectedItem['is-selected'], true)
  assert.equal(selectedItem.el.className, 'lane-modal-item lane-modal-item--selected')
  assert.ok(selectedItem['clear-btn'])

  // Dismissing with Escape cancels without changing selected value
  await dispatchWindowEvent('keydown', { key: 'Escape' })
  assert.equal(modal['is-open'], false)
  assert.strictEqual(row1.values[colLane.id], workerBLane.id)

  // Re-open picker and dismiss by clicking backdrop -> also cancels without change
  await dv['grid-rows'][0].cells[0]['trigger-el'].listeners.click()
  assert.equal(modal['is-open'], true)
  await modal.backdrop.listeners.click({ target: modal.backdrop })
  assert.equal(modal['is-open'], false)
  assert.strictEqual(row1.values[colLane.id], workerBLane.id)

  // Re-open picker and switch selection to closed Worker A, then test Open-to-right insertion between Board and Builder Prime
  await dv['grid-rows'][0].cells[0]['trigger-el'].listeners.click()
  await modal.items.find(it => it.entry.id === workerALane.id)['select-btn'].listeners.click()
  assert.strictEqual(row1.values[colLane.id], workerALane.id)
  assert.equal(dv['grid-rows'][0].cells[0]['id-el'].textContent, workerALane.id)
  assert.equal(dv['grid-rows'][0].cells[0]['display-el'].textContent, 'Worker A')
  assert.deepEqual(f.state.lanes.map(l => l.id), [boardLane.id, workerBLane.id])

  // Click open button on Worker A -> opens Worker A immediately to the right of Board (between Board and Builder Prime)
  await dv['grid-rows'][0].cells[0]['open-el'].listeners.click()
  assert.deepEqual(f.state.lanes.map(l => l.id), [boardLane.id, workerALane.id, workerBLane.id])
  assert.deepEqual(laneControl['lane-ids'], [boardLane.id, workerALane.id, workerBLane.id])
  assert.equal(f.state.tableHeadRow.children[1], boardLane.element)
  assert.equal(f.state.tableHeadRow.children[2], laneControl['by-id'][workerALane.id].element)
  assert.equal(f.state.tableHeadRow.children[3], workerBLane.element)
  assert.equal(f.state.tableBodyRow.children[1], boardLane.body)
  assert.equal(f.state.tableBodyRow.children[2], laneControl['by-id'][workerALane.id].body)
  assert.equal(f.state.tableBodyRow.children[3], workerBLane.body)
  assert.equal(mockWindow.location.pathname, `/${boardLane.id};data|assignments/${workerALane.id}/${workerBLane.id}`)

  // Clear selection via toolbar Clear button -> hides open button again
  await dv['grid-rows'][0].cells[0]['trigger-el'].listeners.click()
  await modal['clear-btn'].listeners.click()
  assert.equal(modal['is-open'], false)
  assert.strictEqual(row1.values[colLane.id], null)
  assert.equal(dv['grid-rows'][0].cells[0]['placeholder-el'].textContent, 'Select lane…')
  assert.equal(dv['grid-rows'][0].cells[0]['placeholder-el'].hidden, false)
  assert.equal(dv['grid-rows'][0].cells[0]['id-el'].hidden, true)
  assert.equal(dv['grid-rows'][0].cells[0]['open-el'].hidden, true)

  // Re-select closed Worker A after closing it so reload persistence can verify closed lane title resolution
  await laneControl.close(workerALane.id)
  await dv['grid-rows'][0].cells[0]['trigger-el'].listeners.click()
  await modal.items.find(it => it.entry.id === workerALane.id)['select-btn'].listeners.click()

  // Test multiple lane[] column: + opens multiselect picker, Cancel reverts, Apply saves [Board, Builder Prime], verify split controls + open-to-right
  const multiCell = dv['grid-rows'][0].cells[1]
  await multiCell['add-btn'].listeners.click()
  assert.equal(modal['is-open'], true)
  assert.equal(modal.multiple, true)
  assert.equal(modal.footer.hidden, false)
  await modal.items.find(it => it.entry.id === boardLane.id)['add-btn'].listeners.click()
  assert.equal(modal['is-open'], true)
  await modal['cancel-btn'].listeners.click()
  assert.equal(modal['is-open'], false)
  assert.deepEqual(row1.values[colMulti.id], [])
  assert.equal(multiCell.items.length, 0)

  await multiCell['add-btn'].listeners.click()
  await modal.items.find(it => it.entry.id === boardLane.id)['add-btn'].listeners.click()
  await modal.items.find(it => it.entry.id === workerBLane.id)['add-btn'].listeners.click()
  assert.deepEqual(modal['selected-ids'], [boardLane.id, workerBLane.id])
  assert.equal(modal['selected-chips'].length, 2)
  await modal['apply-btn'].listeners.click()
  assert.equal(modal['is-open'], false)
  assert.equal(multiCell.items.length, 2)
  assert.deepEqual(row1.values[colMulti.id], [boardLane.id, workerBLane.id])
  assert.equal(multiCell.items[0]['id-el'].textContent, boardLane.id)
  assert.equal(multiCell.items[0]['display-el'].textContent, 'Board')
  assert.equal(multiCell.items[0]['open-el'].hidden, false)
  assert.equal(multiCell.items[1]['id-el'].textContent, workerBLane.id)
  assert.equal(multiCell.items[1]['display-el'].textContent, 'Builder Prime')
  assert.equal(multiCell.items[1]['open-el'].hidden, false)

  // Open Worker A in-between, minimize Builder Prime, then click Builder Prime's open button in lane[] -> restores & moves Builder Prime right next to Board
  await dv['grid-rows'][0].cells[0]['open-el'].listeners.click()
  assert.deepEqual(f.state.lanes.map(l => l.id), [boardLane.id, workerALane.id, workerBLane.id])
  await laneControl.minimize(workerBLane.id, 'left')
  assert.equal(workerBLane['is-minimized'], true)
  await multiCell.items[1]['open-el'].listeners.click()
  assert.equal(workerBLane['is-minimized'], false)
  assert.deepEqual(f.state.lanes.map(l => l.id), [boardLane.id, workerBLane.id, workerALane.id])
  assert.equal(f.state.tableHeadRow.children[2], workerBLane.element)
  assert.equal(f.state.tableHeadRow.children[3], laneControl['by-id'][workerALane.id].element)
  assert.equal(f.state.tableBodyRow.children[2], workerBLane.body)
  assert.equal(f.state.tableBodyRow.children[3], laneControl['by-id'][workerALane.id].body)

  // Remove first item from lane[] -> confirm dialog includes "Board (<id>)"
  await multiCell.items[0]['remove-btn'].listeners.click()
  const confirmModal = laneControl['confirm-modal']
  assert.equal(confirmModal['is-open'], true)
  assert.ok(confirmModal['message-el'].textContent.includes(`Board (${boardLane.id})`))
  await confirmModal['confirm-btn'].listeners.click()
  assert.deepEqual(row1.values[colMulti.id], [workerBLane.id])

  // Verify top "Open" button still opens lane-modal in standard Open Lane mode
  await f.state.tableHeadRowOpenButton.listeners.click()
  assert.equal(modal['is-open'], true)
  assert.equal(modal.mode, 'open')
  assert.equal(modal['heading-el'].textContent, 'Open Lane')
  assert.equal(modal['clear-btn'].hidden, true)
  const openModeWorkerA = modal.items.find(it => it.entry.id === workerALane.id)
  const openModeWorkerB = modal.items.find(it => it.entry.id === workerBLane.id)
  assert.ok(openModeWorkerA['close-btn'])
  assert.ok(openModeWorkerB['close-btn'])
  await modal['close-btn'].listeners.click()
  assert.equal(modal['is-open'], false)

  // Close Worker A and Builder Prime so both stored lane IDs point to closed lanes on reload
  await laneControl.close(workerALane.id)
  await laneControl.close(workerBLane.id)

  // Simulate full reload from URL -> restores stored lane IDs, split controls, and closed lane titles from catalog
  const reloaded = createRuntime(mockWindow.location.pathname)
  await reloaded.f.run(parse(mainSource, '/src/main.fs'))
  assert.equal(reloaded.f.state.lanes.length, 1)
  const rBoard = reloaded.f.state.lanes[0]
  const rDv = rBoard.notebook['data-view']
  const rRow1 = rDv['grid-rows'][0]
  assert.strictEqual(rRow1.row.values[colLane.id], workerALane.id)
  assert.equal(rRow1.cells[0]['placeholder-el'].hidden, true)
  assert.equal(rRow1.cells[0]['id-el'].textContent, workerALane.id)
  assert.equal(rRow1.cells[0]['id-el'].hidden, false)
  assert.equal(rRow1.cells[0]['open-el'].hidden, false)
  assert.equal(rRow1.cells[0]['display-el'].textContent, 'Worker A')
  assert.equal(rRow1.cells[0]['trigger-el'].className, 'lane-data-row-trigger lane-data-row-trigger--filled lane-data-lane-id-btn')
  assert.deepEqual(rRow1.row.values[colMulti.id], [workerBLane.id])
  assert.equal(rRow1.cells[1].items[0]['display-el'].textContent, 'Builder Prime')
  assert.equal(rRow1.cells[1].items[0]['id-el'].textContent, workerBLane.id)
  assert.equal(rRow1.cells[1].items[0]['open-el'].hidden, false)
 }
 finally {
  globalThis.fetch = origFetch
 }
})

test('Data tab: dimmed unset date, Required schema column with red highlight on empty cells, and blank row lookup with "Select <column>…" placeholder', async () => {
 // 1. Unit tests for isDataCellValueEmpty, blank row lookup, and required column persistence
 assert.equal(isDataCellValueEmpty('', 'text'), true)
 assert.equal(isDataCellValueEmpty(' ', 'text'), false)
 assert.equal(isDataCellValueEmpty('hello', 'text'), false)
 assert.equal(isDataCellValueEmpty('', 'date'), true)
 assert.equal(isDataCellValueEmpty('2026-03-30', 'date'), false)
 assert.equal(isDataCellValueEmpty(null, 'integer'), true)
 assert.equal(isDataCellValueEmpty(0, 'integer'), false)
 assert.equal(isDataCellValueEmpty(null, 'row'), true)
 assert.equal(isDataCellValueEmpty('', 'row'), true)
 assert.equal(isDataCellValueEmpty('   ', 'row'), true)
 assert.equal(isDataCellValueEmpty('US', 'row'), false)
 assert.equal(isDataCellValueEmpty([], { type: 'text', multiple: true }), true)
 assert.equal(isDataCellValueEmpty([''], { type: 'text', multiple: true }), true)
 assert.equal(isDataCellValueEmpty(['tag'], { type: 'text', multiple: true }), false)

 const sampleTables = [
  {
   id: 't-countries',
   name: 'countries',
   columns: [
    { id: 'c-code', name: 'code', type: 'text', multiple: false, required: true },
    { id: 'c-label', name: 'label', type: 'text', multiple: false },
   ],
   rows: [
    { id: 'r-us', values: { 'c-code': 'US', 'c-label': 'United States' } },
    { id: 'r-blank', values: { 'c-code': '', 'c-label': '' } },
   ],
  },
  {
   id: 't-addresses',
   name: 'addresses',
   columns: [
    {
     id: 'c-country',
     name: 'country',
     type: 'row',
     multiple: false,
     required: true,
     refTableId: 't-countries',
     refColumnId: 'c-code',
     refDisplayColumnId: 'c-label',
    },
   ],
   rows: [],
  },
 ]

 // lookupRowDisplay never looks up rows by a blank identifier ('', '   ', null, undefined)
 const blankLookup = lookupRowDisplay(sampleTables, sampleTables[1].columns[0], '')
 assert.equal(blankLookup.isEmpty, true)
 assert.equal(blankLookup.found, false)
 assert.equal(blankLookup.value, null)
 assert.equal(blankLookup.label, '')

 const wsLookup = lookupRowDisplay(sampleTables, sampleTables[1].columns[0], '   ')
 assert.equal(wsLookup.isEmpty, true)
 assert.equal(wsLookup.found, false)

 // fetchRowOptionsPage skips rows in the target table whose link column value is blank ('')
 const countryPage = await fetchRowOptionsPage(sampleTables, sampleTables[1].columns[0], { offset: 0, limit: 10 })
 assert.equal(countryPage.ok, true)
 assert.deepEqual(countryPage.items.map(i => i.value), ['US'])

 // Coercing empty string '' to row returns null (not '')
 assert.strictEqual(coerceDataValue('', sampleTables[1].columns[0], false, { type: 'text', multiple: false }, sampleTables), null)

 // parseStoredTables preserves required: true
 const reparsed = parseStoredTables(JSON.stringify(sampleTables))
 assert.equal(reparsed[0].columns[0].required, true)
 assert.equal(Object.hasOwn(reparsed[0].columns[1], 'required'), false)
 assert.equal(reparsed[1].columns[0].required, true)

 // 2. Integration test in Data tab UI
 const dataSource = await fs.readFile(new URL('./src/lane-data.fs', import.meta.url), 'utf8')
 const confirmModalSource = await fs.readFile(new URL('./src/confirm-modal.fs', import.meta.url), 'utf8')
 const rowPickerModalSource = await fs.readFile(new URL('./src/lane-row-picker-modal.fs', import.meta.url), 'utf8')

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

 let uuid = 0
 const mockWindow = {
  Array,
  Boolean,
  Date,
  JSON,
  Math,
  Object,
  Reflect,
  crypto: { randomUUID: () => `req-uuid-${++uuid}` },
  addEventListener() {},
  removeEventListener() {},
 }

 const origFetch = globalThis.fetch
 globalThis.fetch = async url => {
  if (url === '/src/lane-data.fs') { return { text: async () => dataSource } }
  if (url === '/src/confirm-modal.fs') { return { text: async () => confirmModalSource } }
  if (url === '/src/lane-row-picker-modal.fs') { return { text: async () => rowPickerModalSource } }
  throw new Error(`Unexpected fetch: ${url}`)
 }

 try {
  const rootKv = createMockKV()
  const f = field({
   ...DATA_RUNTIME_ENV,
   console: { log() {} },
   data: rootKv,
   document: {
    body: createMockElement('body'),
    defaultView: mockWindow,
    createElement: createMockElement,
   },
   window: mockWindow,
  })

  const dataMod = await f.load('/src/lane-data.fs')
  const container = createMockElement('div')
  const lane = { id: 'lane-req', tab: 'data', subroute: '', data: rootKv.namespace('lane-req') }
  const dataView = await dataMod.mount(lane, container, {})

  // Verify Schema table header has "Required" column to the right of "Multiple"
  const schemaTable = dataView['schema-section'].children[0]
  const schemaTheadRow = schemaTable.children[0].children[0]
  const headerLabels = schemaTheadRow.children.map(th => th.textContent)
  assert.deepEqual(headerLabels, ['Name', 'Type', 'Multiple', 'Required', ''])

  // Create `countries` table with `code` (text) and `name` (text)
  await dataView['add-table-btn'].listeners.click()
  await dataView['open-edit-table-modal']()
  dataView['edit-table-modal']['name-input'].value = 'countries'
  await dataView['edit-table-modal']['save-btn'].listeners.click({})
  const countriesTblId = dataView.tables[0].id

  await dataView['add-col-btn'].listeners.click()
  dataView['schema-rows'][0]['name-el'].value = 'code'
  await dataView['schema-rows'][0]['name-el'].listeners.input()
  const codeColId = dataView.tables[0].columns[0].id

  await dataView['add-col-btn'].listeners.click()
  dataView['schema-rows'][1]['name-el'].value = 'name'
  await dataView['schema-rows'][1]['name-el'].listeners.input()
  const nameColId = dataView.tables[0].columns[1].id

  await dataView['add-row-btn'].listeners.click()
  dataView['grid-rows'][0].cells[0]['input-el'].value = 'CA'
  await dataView['grid-rows'][0].cells[0]['input-el'].listeners.input()
  dataView['grid-rows'][0].cells[1]['input-el'].value = 'Canada'
  await dataView['grid-rows'][0].cells[1]['input-el'].listeners.input()

  // Also add an empty row in countries (blank identifier '')
  await dataView['add-row-btn'].listeners.click()

  // Create `shipments` table with `title` (text), `ship_date` (date), and `country` (starts as text, then changed to row)
  await dataView['add-table-btn'].listeners.click()
  await dataView['open-edit-table-modal']()
  dataView['edit-table-modal']['name-input'].value = 'shipments'
  await dataView['edit-table-modal']['save-btn'].listeners.click({})

  // Column 0: title (text)
  await dataView['add-col-btn'].listeners.click()
  dataView['schema-rows'][0]['name-el'].value = 'title'
  await dataView['schema-rows'][0]['name-el'].listeners.input()

  // Column 1: ship_date (date)
  await dataView['add-col-btn'].listeners.click()
  dataView['schema-rows'][1]['name-el'].value = 'ship_date'
  await dataView['schema-rows'][1]['name-el'].listeners.input()
  dataView['schema-rows'][1]['type-el'].value = 'date'
  await dataView['schema-rows'][1]['type-el'].listeners.change()

  // Column 2: country (starts as text, add an empty row first to reproduce changing empty text -> row lookup)
  await dataView['add-col-btn'].listeners.click()
  dataView['schema-rows'][2]['name-el'].value = 'country'
  await dataView['schema-rows'][2]['name-el'].listeners.input()

  // Add an empty row in `shipments`
  await dataView['add-row-btn'].listeners.click()
  let row0 = dataView['grid-rows'][0]

  // Unset date input has dimmed class `lane-data-cell-input--date-empty`, but is not invalid when not required
  assert.match(row0.cells[1]['input-el'].className, /lane-data-cell-input--date-empty/)
  assert.doesNotMatch(row0.cells[1]['input-el'].className, /lane-data-cell-input--invalid/)

  // Setting a date removes `lane-data-cell-input--date-empty`; clearing it restores dimmed class
  row0.cells[1]['input-el'].value = '2026-04-01'
  await row0.cells[1]['input-el'].listeners.input()
  assert.doesNotMatch(row0.cells[1]['input-el'].className, /lane-data-cell-input--date-empty/)
  row0.cells[1]['input-el'].value = ''
  await row0.cells[1]['input-el'].listeners.input()
  assert.match(row0.cells[1]['input-el'].className, /lane-data-cell-input--date-empty/)

  // Now change `country` column from text (where row0 value was '') to `row` linking countries.code displaying name
  dataView['schema-rows'][2]['type-el'].value = 'row'
  await dataView['schema-rows'][2]['type-el'].listeners.change()
  dataView['schema-rows'][2]['ref-table-el'].value = countriesTblId
  await dataView['schema-rows'][2]['ref-table-el'].listeners.change()
  dataView['schema-rows'][2]['ref-col-el'].value = codeColId
  await dataView['schema-rows'][2]['ref-col-el'].listeners.change()
  dataView['schema-rows'][2]['ref-display-el'].value = nameColId
  await dataView['schema-rows'][2]['ref-display-el'].listeners.change()

  row0 = dataView['grid-rows'][0]
  const countryCell = row0.cells[2]
  // Must NOT show "(not found)" on empty row! Instead shows "Select country…" with hidden id badge
  assert.equal(countryCell['display-el'].textContent, 'Select country…')
  assert.equal(countryCell['id-el'].textContent, '')
  assert.equal(countryCell['id-el'].hidden, true)
  assert.doesNotMatch(countryCell['trigger-el'].className, /lane-data-row-trigger--missing/)

  // Renaming the column in Schema updates the blank row placeholder live
  dataView['schema-rows'][2]['name-el'].value = 'destination'
  await dataView['schema-rows'][2]['name-el'].listeners.input()
  assert.equal(countryCell['display-el'].textContent, 'Select destination…')
  dataView['schema-rows'][2]['name-el'].value = 'country'
  await dataView['schema-rows'][2]['name-el'].listeners.input()
  assert.equal(countryCell['display-el'].textContent, 'Select country…')

  // Mark `title` (text), `ship_date` (date), and `country` (row) as Required in Schema
  assert.equal(dataView['schema-rows'][0]['req-btn'].attributes['aria-pressed'], 'false')
  await dataView['schema-rows'][0]['req-btn'].listeners.click()
  assert.equal(dataView['schema-rows'][0]['req-btn'].attributes['aria-pressed'], 'true')
  assert.equal(dataView.tables[1].columns[0].required, true)

  await dataView['schema-rows'][1]['req-btn'].listeners.click()
  assert.equal(dataView.tables[1].columns[1].required, true)

  await dataView['schema-rows'][2]['req-btn'].listeners.click()
  assert.equal(dataView.tables[1].columns[2].required, true)

  // All 3 empty cells in row0 are now highlighted red!
  row0 = dataView['grid-rows'][0]
  assert.match(row0.cells[0].td.className, /lane-data-td--required-empty/)
  assert.match(row0.cells[0]['input-el'].className, /lane-data-cell-input--invalid/)
  assert.match(row0.cells[0]['input-el'].className, /lane-data-cell-input--required-empty/)

  assert.match(row0.cells[1].td.className, /lane-data-td--required-empty/)
  assert.match(row0.cells[1]['input-el'].className, /lane-data-cell-input--invalid/)
  assert.match(row0.cells[1]['input-el'].className, /lane-data-cell-input--date-empty/)

  assert.match(row0.cells[2].td.className, /lane-data-td--required-empty/)
  assert.match(row0.cells[2]['trigger-el'].className, /lane-data-row-trigger--required-empty/)

  // Entering text in `title` clears its red highlight; clearing it back to '' marks it red again
  row0.cells[0]['input-el'].value = 'Box 1'
  await row0.cells[0]['input-el'].listeners.input()
  assert.doesNotMatch(row0.cells[0].td.className, /lane-data-td--required-empty/)
  assert.doesNotMatch(row0.cells[0]['input-el'].className, /lane-data-cell-input--invalid/)

  row0.cells[0]['input-el'].value = ''
  await row0.cells[0]['input-el'].listeners.input()
  assert.match(row0.cells[0].td.className, /lane-data-td--required-empty/)
  assert.match(row0.cells[0]['input-el'].className, /lane-data-cell-input--invalid/)

  // Picking a country in `country` clears its red highlight
  await row0.cells[2]['trigger-el'].listeners.click()
  assert.equal(dataView['row-picker']['option-items'].length, 1) // empty row in countries was skipped!
  await dataView['row-picker']['option-items'][0].el.listeners.click()
  assert.equal(row0.cells[2]['display-el'].textContent, 'Canada')
  assert.equal(row0.cells[2]['id-el'].textContent, 'CA')
  assert.doesNotMatch(row0.cells[2].td.className, /lane-data-td--required-empty/)
  assert.doesNotMatch(row0.cells[2]['trigger-el'].className, /lane-data-row-trigger--required-empty/)

  // Reloading tables from KV preserves `required: true` on columns
  const reloadedTables = await loadLaneTables(rootKv, lane.data, lane.id)
  assert.equal(reloadedTables[1].columns[0].required, true)
  assert.equal(reloadedTables[1].columns[1].required, true)
  assert.equal(reloadedTables[1].columns[2].required, true)
 }
 finally {
  globalThis.fetch = origFetch
 }
})

test('Data tab row Filter: "Filter where <state.country> is <person.country>" schema dropdowns, filtered row picker options, out-of-country error state, live row reactivity, and persistence', async () => {
 // 1. Unit checks for parseColumnType, resolveRowTarget, rowFilterValuesMatch, lookupRowDisplay, and fetchRowOptionsPage
 const filteredSpec = parseColumnType({
  type: 'row',
  multiple: false,
  refTableId: 't-states',
  refColumnId: 's-name',
  refDisplayColumnId: '',
  refFilterColumnId: 's-country',
  filterByColumnId: 'p-country',
 })
 assert.deepEqual(filteredSpec, {
  type: 'row',
  multiple: false,
  refTableId: 't-states',
  refColumnId: 's-name',
  refDisplayColumnId: '',
  refFilterColumnId: 's-country',
  filterByColumnId: 'p-country',
 })

 const unitTables = [
  {
   id: 't-people',
   name: 'people',
   columns: [
    { id: 'p-name', name: 'name', type: 'text', multiple: false },
    { id: 'p-country', name: 'country', type: 'row', multiple: false, refTableId: 't-countries', refColumnId: 'c-name', refDisplayColumnId: '' },
    {
     id: 'p-state',
     name: 'state',
     type: 'row',
     multiple: false,
     refTableId: 't-states',
     refColumnId: 's-name',
     refDisplayColumnId: '',
     refFilterColumnId: 's-country',
     filterByColumnId: 'p-country',
    },
   ],
   rows: [
    { id: 'pr-1', values: { 'p-name': 'Alice', 'p-country': 'USA', 'p-state': 'California' } },
    { id: 'pr-2', values: { 'p-name': 'Bob', 'p-country': 'Canada', 'p-state': 'California' } },
    { id: 'pr-3', values: { 'p-name': 'Cara', 'p-country': null, 'p-state': 'Ontario' } },
   ],
  },
  {
   id: 't-countries',
   name: 'countries',
   columns: [
    { id: 'c-name', name: 'name', type: 'text', multiple: false },
   ],
   rows: [
    { id: 'cr-1', values: { 'c-name': 'USA' } },
    { id: 'cr-2', values: { 'c-name': 'Canada' } },
   ],
  },
  {
   id: 't-states',
   name: 'states',
   columns: [
    { id: 's-name', name: 'name', type: 'text', multiple: false },
    { id: 's-country', name: 'country', type: 'row', multiple: false, refTableId: 't-countries', refColumnId: 'c-name', refDisplayColumnId: '' },
   ],
   rows: [
    { id: 'sr-1', values: { 's-name': 'California', 's-country': 'USA' } },
    { id: 'sr-2', values: { 's-name': 'Texas', 's-country': 'USA' } },
    { id: 'sr-3', values: { 's-name': 'Ontario', 's-country': 'Canada' } },
    { id: 'sr-4', values: { 's-name': 'Quebec', 's-country': 'Canada' } },
   ],
  },
 ]

 const target = resolveRowTarget(unitTables, unitTables[0].columns[2])
 assert.equal(target.valid, true)
 assert.equal(target.filterActive, true)
 assert.equal(target.filterConfigured, true)
 assert.equal(target.filterValid, true)
 assert.equal(target.filterOperator, 'is')
 assert.equal(target.tableName, 'states')
 assert.equal(target.ownerTableName, 'people')
 assert.equal(target.refFilterColName, 'country')
 assert.equal(target.filterByColName, 'country')

 const multiTargetTables = [
  {
   id: 't-commands',
   name: 'commands',
   columns: [
    { id: 'c-sys', name: 'system', type: 'row', multiple: false, refTableId: 't-systems', refColumnId: 'sys-code' },
    {
     id: 'c-desk',
     name: 'desktop',
     type: 'row',
     multiple: false,
     refTableId: 't-desktops',
     refColumnId: 'd-code',
     refDisplayColumnId: 'd-name',
     refFilterColumnId: 'd-systems',
     filterByColumnId: 'c-sys',
    },
   ],
   rows: [],
  },
  {
   id: 't-systems',
   name: 'systems',
   columns: [{ id: 'sys-code', name: 'code', type: 'text', multiple: false }],
   rows: [],
  },
  {
   id: 't-desktops',
   name: 'desktops',
   columns: [
    { id: 'd-code', name: 'code', type: 'text', multiple: false },
    { id: 'd-name', name: 'name', type: 'text', multiple: false },
    { id: 'd-systems', name: 'systems', type: 'row', multiple: true, refTableId: 't-systems', refColumnId: 'sys-code' },
   ],
   rows: [],
  },
 ]
 const multiTarget = resolveRowTarget(multiTargetTables, multiTargetTables[0].columns[1])
 assert.equal(multiTarget.filterValid, true)
 assert.equal(multiTarget.filterOperator, 'contains')

 assert.equal(rowFilterValuesMatch('USA', 'USA'), true)
 assert.equal(rowFilterValuesMatch('USA', 'Canada'), false)
 assert.equal(rowFilterValuesMatch('USA', null), false)
 assert.equal(rowFilterValuesMatch(null, null), false)

 const aliceLookup = lookupRowDisplay(unitTables, unitTables[0].columns[2], 'California', unitTables[0].rows[0])
 assert.equal(aliceLookup.found, true)
 assert.equal(aliceLookup.filterMatched, true)
 assert.equal(aliceLookup.isValueValid, true)
 assert.equal(aliceLookup.filterError, null)

 const bobLookup = lookupRowDisplay(unitTables, unitTables[0].columns[2], 'California', unitTables[0].rows[1])
 assert.equal(bobLookup.found, true)
 assert.equal(bobLookup.filterMatched, false)
 assert.equal(bobLookup.isValueValid, false)
 assert.match(bobLookup.filterError, /Filter mismatch: states\.country is "USA", expected "Canada" \(people\.country\)/)

 const caraLookup = lookupRowDisplay(unitTables, unitTables[0].columns[2], 'Ontario', unitTables[0].rows[2])
 assert.equal(caraLookup.found, true)
 assert.equal(caraLookup.filterMatched, false)
 assert.equal(caraLookup.isValueValid, false)
 assert.match(caraLookup.filterError, /Filter mismatch: states\.country is "Canada", but people\.country is empty/)

 const usaOptions = await fetchRowOptionsPage(unitTables, unitTables[0].columns[2], { row: unitTables[0].rows[0] })
 assert.equal(usaOptions.ok, true)
 assert.equal(usaOptions.total, 2)
 assert.deepEqual(usaOptions.items.map(i => i.value), ['California', 'Texas'])

 const canadaOptions = await fetchRowOptionsPage(unitTables, unitTables[0].columns[2], { row: unitTables[0].rows[1] })
 assert.equal(canadaOptions.ok, true)
 assert.equal(canadaOptions.total, 2)
 assert.deepEqual(canadaOptions.items.map(i => i.value), ['Ontario', 'Quebec'])

 const emptyCountryOptions = await fetchRowOptionsPage(unitTables, unitTables[0].columns[2], { row: unitTables[0].rows[2] })
 assert.equal(emptyCountryOptions.ok, true)
 assert.equal(emptyCountryOptions.total, 0)
 assert.deepEqual(emptyCountryOptions.items, [])

 // 2. End-to-end UI test in lane-data.fs
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
   scrollTop: 0,
   scrollHeight: 0,
   clientHeight: 0,
   setAttribute(name, value) { this.attributes[name] = value },
   appendChild(child) { this.children.push(child); return child },
   insertBefore(child, ref) {
    const idx = this.children.indexOf(ref)
    if (idx === -1) { this.children.push(child) }
    else { this.children.splice(idx, 0, child) }
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
  crypto: { randomUUID: () => `filter-uuid-${++uuid}` },
  history: { pushState(_s, _t, url) { mockWindow.location.pathname = url } },
  location: { pathname: '/' },
  addEventListener() {},
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
   runLines,
   runTransportedScripts,
  })

  const f = makeRuntime()
  await f.run(parse(mainSource, '/src/main.fs'))
  await f.state.tableHeadRowAddButton.listeners.click()
  const lane = f.state.lanes[0]
  const nb = lane.notebook
  const dataView = nb['data-view']
  const rowPicker = dataView['row-picker']
  await nb.tabs.data.listeners.click()

  // Table 1 = people (columns: name, country, state)
  await dataView['add-table-btn'].listeners.click()
  await dataView['open-edit-table-modal']()
  dataView['edit-table-modal']['name-input'].value = 'people'
  await dataView['edit-table-modal']['save-btn'].listeners.click({})
  const peopleTableId = dataView.tables[0].id

  // Table 2 = countries (columns: name)
  await dataView['add-table-btn'].listeners.click()
  await dataView['open-edit-table-modal']()
  dataView['edit-table-modal']['name-input'].value = 'countries'
  await dataView['edit-table-modal']['save-btn'].listeners.click({})
  const countriesTableId = dataView.tables[1].id

  await dataView['add-col-btn'].listeners.click()
  dataView['schema-rows'][0]['name-el'].value = 'name'
  await dataView['schema-rows'][0]['name-el'].listeners.input()
  const countriesNameColId = dataView.tables[1].columns[0].id

  for (const countryName of ['USA', 'Canada']) {
   await dataView['add-row-btn'].listeners.click()
   const gr = dataView['grid-rows'][dataView['grid-rows'].length - 1]
   gr.cells[0]['input-el'].value = countryName
   await gr.cells[0]['input-el'].listeners.input()
  }

  // Table 3 = states (columns: name, country -> row(countries.name))
  await dataView['add-table-btn'].listeners.click()
  await dataView['open-edit-table-modal']()
  dataView['edit-table-modal']['name-input'].value = 'states'
  await dataView['edit-table-modal']['save-btn'].listeners.click({})
  const statesTableId = dataView.tables[2].id

  await dataView['add-col-btn'].listeners.click()
  dataView['schema-rows'][0]['name-el'].value = 'name'
  await dataView['schema-rows'][0]['name-el'].listeners.input()
  const statesNameColId = dataView.tables[2].columns[0].id

  await dataView['add-col-btn'].listeners.click()
  dataView['schema-rows'][1]['name-el'].value = 'country'
  await dataView['schema-rows'][1]['name-el'].listeners.input()
  dataView['schema-rows'][1]['type-el'].value = 'row'
  await dataView['schema-rows'][1]['type-el'].listeners.change()
  dataView['schema-rows'][1]['ref-table-el'].value = countriesTableId
  await dataView['schema-rows'][1]['ref-table-el'].listeners.change()
  dataView['schema-rows'][1]['ref-col-el'].value = countriesNameColId
  await dataView['schema-rows'][1]['ref-col-el'].listeners.change()
  const statesCountryColId = dataView.tables[2].columns[1].id

  const seedStates = [
   ['California', 'USA'],
   ['Texas', 'USA'],
   ['Ontario', 'Canada'],
   ['Quebec', 'Canada'],
  ]
  for (let i = 0; i < seedStates.length; i++) {
   await dataView['add-row-btn'].listeners.click()
   const gr = dataView['grid-rows'][i]
   gr.cells[0]['input-el'].value = seedStates[i][0]
   await gr.cells[0]['input-el'].listeners.input()
   await gr.cells[1]['trigger-el'].listeners.click()
   const opt = rowPicker['option-items'].find(o => o.item.value === seedStates[i][1])
   await opt.el.listeners.click()
  }

  // Switch back to Table 1 = people and configure columns: name, country, state
  await dataView['select-table'](peopleTableId)

  await dataView['add-col-btn'].listeners.click()
  dataView['schema-rows'][0]['name-el'].value = 'name'
  await dataView['schema-rows'][0]['name-el'].listeners.input()
  const peopleNameColId = dataView.tables[0].columns[0].id

  await dataView['add-col-btn'].listeners.click()
  dataView['schema-rows'][1]['name-el'].value = 'country'
  await dataView['schema-rows'][1]['name-el'].listeners.input()
  dataView['schema-rows'][1]['type-el'].value = 'row'
  await dataView['schema-rows'][1]['type-el'].listeners.change()
  dataView['schema-rows'][1]['ref-table-el'].value = countriesTableId
  await dataView['schema-rows'][1]['ref-table-el'].listeners.change()
  dataView['schema-rows'][1]['ref-col-el'].value = countriesNameColId
  await dataView['schema-rows'][1]['ref-col-el'].listeners.change()
  const peopleCountryColId = dataView.tables[0].columns[1].id

  await dataView['add-col-btn'].listeners.click()
  dataView['schema-rows'][2]['name-el'].value = 'state'
  await dataView['schema-rows'][2]['name-el'].listeners.input()
  dataView['schema-rows'][2]['type-el'].value = 'row'
  await dataView['schema-rows'][2]['type-el'].listeners.change()
  const peopleStateColId = dataView.tables[0].columns[2].id

  // Verify compact row-config-wrap layout: [Table+Column], [Display+Template(hidden)], Template details(hidden), Filter "where <select1> is <select2>", Hint
  let stateSrow = dataView['schema-rows'][2]
  const rowConfigChildren = stateSrow['row-config-wrap'].children
  assert.equal(rowConfigChildren[0], stateSrow['ref-target-line'])
  assert.equal(stateSrow['ref-target-line'].children[0], stateSrow['ref-table-field'])
  assert.equal(stateSrow['ref-target-line'].children[1], stateSrow['ref-col-field'])
  assert.equal(stateSrow['ref-table-field'].children[0].textContent, 'Table')
  assert.equal(stateSrow['ref-col-field'].children[0].textContent, 'Column')
  assert.equal(rowConfigChildren[1], stateSrow['ref-disp-line'])
  assert.equal(stateSrow['ref-disp-line'].children[0], stateSrow['ref-disp-field'])
  assert.equal(stateSrow['ref-disp-line'].children[1], stateSrow['ref-tmpl-field'])
  assert.equal(stateSrow['ref-disp-field'].children[0].textContent, 'Display')
  assert.equal(stateSrow['ref-tmpl-field'].children[0].textContent, 'Template')
  assert.equal(stateSrow['ref-tmpl-field'].hidden, true)
  assert.equal(rowConfigChildren[2], stateSrow['ref-tmpl-details'])
  assert.equal(stateSrow['ref-tmpl-details'].hidden, true)
  assert.equal(rowConfigChildren[3].children[0].textContent, 'Filter')
  assert.equal(rowConfigChildren[3], stateSrow['ref-filter-field'])
  assert.equal(rowConfigChildren[4], stateSrow['row-hint-el'])
  assert.deepEqual(
   stateSrow['ref-display-el'].children.map(o => ({ v: o.value, t: o.textContent })),
   [
    { v: '', t: 'None' },
    { v: '$template', t: 'Template' },
   ]
  )
  const filterControls = stateSrow['ref-filter-controls'].children
  assert.equal(filterControls[0].textContent, 'where')
  assert.equal(filterControls[1], stateSrow['ref-filter-col-el'])
  assert.equal(filterControls[2].textContent, 'is')
  assert.equal(filterControls[3], stateSrow['filter-by-col-el'])
  assert.equal(stateSrow['ref-filter-col-el'].disabled, true)
  assert.equal(stateSrow['filter-by-col-el'].disabled, true)

  // Select Table = states and Column = name
  stateSrow['ref-table-el'].value = statesTableId
  await stateSrow['ref-table-el'].listeners.change()
  stateSrow = dataView['schema-rows'][2]
  assert.equal(stateSrow['ref-filter-col-el'].disabled, false)
  assert.equal(stateSrow['filter-by-col-el'].disabled, false)

  stateSrow['ref-col-el'].value = statesNameColId
  await stateSrow['ref-col-el'].listeners.change()
  stateSrow = dataView['schema-rows'][2]

  // Check options in the two side-by-side Filter dropdowns
  assert.deepEqual(
   stateSrow['ref-filter-col-el'].children.map(o => ({ v: o.value, t: o.textContent })),
   [
    { v: '', t: 'None (optional)' },
    { v: statesNameColId, t: 'states.name (text)' },
    { v: statesCountryColId, t: 'states.country (row(countries.name))' },
   ]
  )
  assert.deepEqual(
   stateSrow['filter-by-col-el'].children.map(o => ({ v: o.value, t: o.textContent })),
   [
    { v: '', t: 'None (optional)' },
    { v: peopleNameColId, t: 'people.name (text)' },
    { v: peopleCountryColId, t: 'people.country (row(countries.name))' },
   ]
  )

  // Selecting only the first filter dropdown marks the second as required
  stateSrow['ref-filter-col-el'].value = statesCountryColId
  await stateSrow['ref-filter-col-el'].listeners.change()
  stateSrow = dataView['schema-rows'][2]
  assert.match(stateSrow['filter-by-col-el'].className, /lane-data-row-select--required/)
  assert.match(stateSrow['row-hint-el'].textContent, /select matching filter column/)

  // Selecting the second filter dropdown completes "Filter where states.country is people.country"
  stateSrow['filter-by-col-el'].value = peopleCountryColId
  await stateSrow['filter-by-col-el'].listeners.change()
  stateSrow = dataView['schema-rows'][2]
  assert.doesNotMatch(stateSrow['ref-filter-col-el'].className, /lane-data-row-select--required/)
  assert.doesNotMatch(stateSrow['filter-by-col-el'].className, /lane-data-row-select--required/)
  assert.equal(stateSrow['ref-filter-controls'].children[2].textContent, 'is')
  assert.equal(stateSrow['row-hint-el'].textContent, 'Stores text · filter where states.country is people.country')

  // When the linked table's filter column is multiple ([]), the operator text and hints say "contains" instead of "is"
  dataView.tables[2].columns[1].multiple = true
  await dataView['render-schema']()
  await dataView['render-grid']()
  stateSrow = dataView['schema-rows'][2]
  assert.equal(stateSrow['ref-filter-controls'].children[2].textContent, 'contains')
  assert.equal(stateSrow['row-hint-el'].textContent, 'Stores text · filter where states.country contains people.country')
  assert.match(dataView['grid-head-cells'][3]['type-el'].title, /filter where states\.country contains people\.country/)
  dataView.tables[2].columns[1].multiple = false
  await dataView['render-schema']()
  await dataView['render-grid']()
  stateSrow = dataView['schema-rows'][2]
  assert.equal(stateSrow['ref-filter-controls'].children[2].textContent, 'is')

  // Add Row 1 in people: Alice, country = USA
  await dataView['add-row-btn'].listeners.click()
  const personRow0 = dataView['grid-rows'][0]
  personRow0.cells[0]['input-el'].value = 'Alice'
  await personRow0.cells[0]['input-el'].listeners.input()

  await personRow0.cells[1]['trigger-el'].listeners.click()
  await rowPicker['option-items'].find(o => o.item.value === 'USA').el.listeners.click()
  assert.equal(dataView.tables[0].rows[0].values[peopleCountryColId], 'USA')

  // Open state picker for Alice -> ONLY USA states (California, Texas) are available
  await personRow0.cells[2]['trigger-el'].listeners.click()
  assert.equal(rowPicker['is-open'], true)
  assert.deepEqual(rowPicker['option-items'].map(o => o.item.value), ['California', 'Texas'])
  await rowPicker['option-items'][0].el.listeners.click() // California
  assert.equal(dataView.tables[0].rows[0].values[peopleStateColId], 'California')
  assert.equal(personRow0.cells[2]['display-el'].textContent, 'California')
  assert.equal(personRow0.cells[2]['id-el'].hidden, true)
  assert.equal(personRow0.cells[2]['trigger-el'].className, 'lane-data-row-trigger lane-data-row-trigger--filled')
  assert.equal(personRow0.cells[2]['trigger-el'].attributes['aria-invalid'], 'false')

  // Add Row 2 in people: Bob, country = Canada
  await dataView['add-row-btn'].listeners.click()
  const personRow1 = dataView['grid-rows'][1]
  personRow1.cells[0]['input-el'].value = 'Bob'
  await personRow1.cells[0]['input-el'].listeners.input()

  await personRow1.cells[1]['trigger-el'].listeners.click()
  await rowPicker['option-items'].find(o => o.item.value === 'Canada').el.listeners.click()

  // Open state picker for Bob -> ONLY Canada states (Ontario, Quebec) are available
  await personRow1.cells[2]['trigger-el'].listeners.click()
  assert.deepEqual(rowPicker['option-items'].map(o => o.item.value), ['Ontario', 'Quebec'])
  await rowPicker['option-items'][0].el.listeners.click() // Ontario
  assert.equal(dataView.tables[0].rows[1].values[peopleStateColId], 'Ontario')
  assert.equal(personRow1.cells[2]['trigger-el'].className, 'lane-data-row-trigger lane-data-row-trigger--filled')
  assert.equal(personRow1.cells[2]['trigger-el'].attributes['aria-invalid'], 'false')

  // Change Alice's country from USA to Canada while her state is California -> state immediately shows error!
  const livePersonRow0 = dataView['grid-rows'][0]
  await livePersonRow0.cells[1]['trigger-el'].listeners.click()
  await rowPicker['option-items'].find(o => o.item.value === 'Canada').el.listeners.click()
  assert.equal(dataView.tables[0].rows[0].values[peopleCountryColId], 'Canada')
  assert.equal(dataView.tables[0].rows[0].values[peopleStateColId], 'California')
  assert.equal(livePersonRow0.cells[2]['display-el'].textContent, 'California')
  assert.equal(livePersonRow0.cells[2]['id-el'].textContent, '(invalid)')
  assert.equal(livePersonRow0.cells[2]['id-el'].hidden, false)
  assert.match(livePersonRow0.cells[2]['trigger-el'].className, /lane-data-row-trigger--invalid/)
  assert.equal(livePersonRow0.cells[2]['trigger-el'].attributes['aria-invalid'], 'true')
  assert.match(livePersonRow0.cells[2]['trigger-el'].title, /Filter mismatch: states\.country is "USA", expected "Canada" \(people\.country\)/)

  // Reload app -> persisted filter and error state on Alice's out-of-country state restore intact
  const fReload = makeRuntime()
  await fReload.run(parse(mainSource, '/src/main.fs'))
  const rDataView = fReload.state.lanes[0].notebook['data-view']
  await rDataView['select-table'](peopleTableId)
  const rStateCol = rDataView.tables[0].columns[2]
  assert.equal(rStateCol.refFilterColumnId, statesCountryColId)
  assert.equal(rStateCol.filterByColumnId, peopleCountryColId)

  const rAliceStateCell = rDataView['grid-rows'][0].cells[2]
  assert.equal(rAliceStateCell['display-el'].textContent, 'California')
  assert.equal(rAliceStateCell['id-el'].textContent, '(invalid)')
  assert.equal(rAliceStateCell['id-el'].hidden, false)
  assert.match(rAliceStateCell['trigger-el'].className, /lane-data-row-trigger--invalid/)
  assert.equal(rAliceStateCell['trigger-el'].attributes['aria-invalid'], 'true')

  const rBobStateCell = rDataView['grid-rows'][1].cells[2]
  assert.equal(rBobStateCell['display-el'].textContent, 'Ontario')
  assert.equal(rBobStateCell['id-el'].hidden, true)
  assert.equal(rBobStateCell['trigger-el'].className, 'lane-data-row-trigger lane-data-row-trigger--filled')
  assert.equal(rBobStateCell['trigger-el'].attributes['aria-invalid'], 'false')

  // Clicking Alice's invalid state cell offers Canada states (Ontario, Quebec); picking Quebec clears the error
  await rAliceStateCell['trigger-el'].listeners.click()
  assert.deepEqual(rDataView['row-picker']['option-items'].map(o => o.item.value), ['Ontario', 'Quebec'])
  await rDataView['row-picker']['option-items'][1].el.listeners.click() // Quebec
  assert.equal(rAliceStateCell['display-el'].textContent, 'Quebec')
  assert.equal(rAliceStateCell['id-el'].hidden, true)
  assert.equal(rAliceStateCell['trigger-el'].className, 'lane-data-row-trigger lane-data-row-trigger--filled')
  assert.equal(rAliceStateCell['trigger-el'].attributes['aria-invalid'], 'false')

  // Expanding "+ Add" in Select state (states) on Bob's row pre-populates country = 'Canada' and saves/selects 'Alberta' on Save
  await rBobStateCell['trigger-el'].listeners.click()
  const rPicker = rDataView['row-picker']
  assert.equal(rPicker['is-open'], true)
  await rPicker['add-trigger-btn'].listeners.click()
  assert.equal(rPicker['add-expanded'], true)
  assert.equal(rPicker['add-fields'].length, 2)
  assert.equal(rPicker['add-fields'][0].name, 'name')
  assert.equal(rPicker['add-fields'][1].name, 'country')
  assert.equal(rPicker['add-fields'][1]['input-el'].value, 'Canada')
  rPicker['add-fields'][0]['input-el'].value = 'Alberta'
  await rPicker['add-fields'][0]['input-el'].listeners.input()
  await rPicker['add-save-btn'].listeners.click()
  assert.equal(rPicker['is-open'], false)
  assert.equal(rDataView.tables[2].rows.length, 5)
  assert.equal(rDataView.tables[2].rows[4].values[statesNameColId], 'Alberta')
  assert.equal(rDataView.tables[2].rows[4].values[statesCountryColId], 'Canada')
  assert.equal(rDataView.tables[0].rows[1].values[peopleStateColId], 'Alberta')
  assert.equal(rBobStateCell['display-el'].textContent, 'Alberta')
  assert.equal(rBobStateCell['trigger-el'].className, 'lane-data-row-trigger lane-data-row-trigger--filled')
  assert.equal(rBobStateCell['trigger-el'].attributes['aria-invalid'], 'false')
 }
 finally {
  globalThis.fetch = origFetch
 }
})

test('Data tab Multiple ([]) columns: full-width resizable chips, filter input above items, and table cell max-height scrolling after ~10 items', async () => {
 const indexHtml = await fs.readFile(new URL('./index.html', import.meta.url), 'utf8')
 // Verify CSS for table cell max-height (~10 items tall), full-width chips, and filter input
 assert.match(indexHtml, /\.lane-data-td\s*\{[^}]*max-height:\s*20em;[^}]*overflow-y:\s*auto;/s)
 assert.match(indexHtml, /\.lane-data-td--sized\s*\{[^}]*overflow-x:\s*hidden;[^}]*overflow-y:\s*auto;/s)
 assert.match(indexHtml, /\.lane-data-multi\s*\{[^}]*align-items:\s*stretch;[^}]*display:\s*flex;[^}]*flex-direction:\s*column;[^}]*max-height:\s*20em;[^}]*overflow-y:\s*auto;[^}]*width:\s*100%;/s)
 assert.match(indexHtml, /\.lane-data-multi-bar\s*\{[^}]*display:\s*flex;[^}]*min-width:\s*0;[^}]*width:\s*100%;/s)
 assert.match(indexHtml, /\.lane-data-multi-bar\s*>\s*\.lane-data-multi-filter\s*\{[^}]*flex:\s*1 1 auto;/s)
 assert.match(indexHtml, /\.lane-data-multi-filter\s*\{[^}]*min-width:\s*0;[^}]*width:\s*100%;/s)
 assert.match(indexHtml, /\.lane-data-multi-items\s*\{[^}]*display:\s*flex;[^}]*flex-direction:\s*column;[^}]*max-height:\s*16\.5em;[^}]*overflow-y:\s*auto;[^}]*width:\s*100%;/s)
 assert.match(indexHtml, /\.lane-data-multi-items:empty\s*\{[^}]*display:\s*none;/s)
 assert.match(indexHtml, /\.lane-data-multi-add\s*\{[^}]*aspect-ratio:\s*1\s*\/\s*1;[^}]*height:\s*var\(--lane-data-cell-size,\s*20px\);[^}]*width:\s*var\(--lane-data-cell-size,\s*20px\);/s)
 assert.match(indexHtml, /\.lane-data-multi-item\s*\{[^}]*display:\s*flex;[^}]*flex-shrink:\s*0;[^}]*max-width:\s*100%;[^}]*min-width:\s*0;[^}]*width:\s*100%;/s)
 assert.match(indexHtml, /\.lane-data-multi-item\s+\.lane-data-cell-input\s*\{[^}]*flex:\s*1 1 auto;[^}]*min-width:\s*0;[^}]*width:\s*100%;/s)
 assert.match(indexHtml, /\.lane-data-multi-item\s+\.lane-data-cell-input--num\s*\{[^}]*min-width:\s*0;[^}]*width:\s*100%;/s)
 assert.match(indexHtml, /\.lane-data-multi-item\s+\.lane-data-cell-select\s*\{[^}]*flex:\s*1 1 auto;[^}]*min-width:\s*0;[^}]*width:\s*100%;/s)
 assert.match(indexHtml, /\.lane-data-multi-item\s+\.lane-data-row-trigger\s*\{[^}]*flex:\s*1 1 auto;[^}]*min-width:\s*0;[^}]*width:\s*100%;/s)
 assert.match(indexHtml, /\.lane-data-multi-item\s+\.lane-data-lane-control\s*\{[^}]*flex:\s*1 1 auto;[^}]*max-width:\s*100%;[^}]*min-width:\s*0;[^}]*width:\s*100%;/s)

 const dataSource = await fs.readFile(new URL('./src/lane-data.fs', import.meta.url), 'utf8')
 const confirmModalSource = await fs.readFile(new URL('./src/confirm-modal.fs', import.meta.url), 'utf8')
 const rowPickerModalSource = await fs.readFile(new URL('./src/lane-row-picker-modal.fs', import.meta.url), 'utf8')

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
    if (idx === -1) { this.children.push(child) }
    else { this.children.splice(idx, 0, child) }
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
   hashNamespace(name) { return createMockKV(qualify(name)) },
   async get(key) { return kv.get(qualify(key)) },
   async set(key, value) { kv.set(qualify(key), value) },
   async delete(key) { kv.delete(qualify(key)) },
  }
 }

 const mockBody = createMockElement('body')
 const mockDocument = {
  body: mockBody,
  createElement(tag) {
   return createMockElement(tag)
  },
 }
 const windowListeners = {}
 let uuidCounter = 0
 const mockWindow = {
  Array,
  Date,
  JSON,
  Math,
  Number,
  Object,
  Reflect,
  Set,
  String,
  addEventListener(type, fn) {
   if (!windowListeners[type]) windowListeners[type] = []
   windowListeners[type].push(fn)
  },
  removeEventListener(type, fn) {
   if (windowListeners[type]) {
    windowListeners[type] = windowListeners[type].filter(l => l !== fn)
   }
  },
  crypto: {
   randomUUID() {
    uuidCounter += 1
    return `mchip-uuid-${uuidCounter}`
   },
  },
 }

 const rootKv = createMockKV()
 const lane = {
  id: 'lane-mchip',
  title: 'Multi Chip Lane',
  tab: 'data',
  subroute: '',
  data: rootKv.namespace('lane-mchip'),
 }
 const container = createMockElement('div')
 mockBody.appendChild(container)

 const origFetch = globalThis.fetch
 globalThis.fetch = async url => {
  if (url === '/src/lane-data.fs') return { text: async () => dataSource }
  if (url === '/src/confirm-modal.fs') return { text: async () => confirmModalSource }
  if (url === '/src/lane-row-picker-modal.fs') return { text: async () => rowPickerModalSource }
  throw new Error(`Unexpected fetch: ${url}`)
 }

 try {
  const f = field({
   console: { log() {}, error() {} },
   data: rootKv,
   document: mockDocument,
   ...DATA_RUNTIME_ENV,
   window: mockWindow,
  })

  const dataMod = await f.load('/src/lane-data.fs')
  const dataView = await dataMod.mount(lane, container, {})

  // Create a table with a text[] column and a row[] column
  await dataView['add-table-btn'].listeners.click()
  await dataView['open-edit-table-modal']()
  dataView['edit-table-modal']['name-input'].value = 'inventory'
  await dataView['edit-table-modal']['save-btn'].listeners.click({})

  await dataView['add-col-btn'].listeners.click()
  dataView['schema-rows'][0]['name-el'].value = 'tags'
  await dataView['schema-rows'][0]['name-el'].listeners.input()
  await dataView['schema-rows'][0]['multi-btn'].listeners.click()

  // Add a row and populate 12 items in the text[] column (more than 10 items tall)
  await dataView['add-row-btn'].listeners.click()
  const row0 = dataView['grid-rows'][0]
  const tagsCell = row0.cells[0]
  assert.equal(tagsCell.multi, true)
  assert.ok(tagsCell['multi-bar'])
  assert.equal(tagsCell['multi-bar'].className, 'lane-data-multi-bar')
  assert.ok(tagsCell['filter-input'])
  assert.equal(tagsCell['filter-input'].className, 'lane-data-multi-filter')
  assert.deepEqual(tagsCell['multi-bar'].children, [tagsCell['filter-input'], tagsCell['add-btn']])
  assert.deepEqual(tagsCell['multi-wrap'].children, [tagsCell['multi-bar'], tagsCell['items-el']])
  assert.deepEqual(tagsCell.td.children, [tagsCell['multi-wrap'], tagsCell['menu-btn']])
  assert.equal(tagsCell['items-el'].hidden, true)

  const sampleTags = [
   'alpha-core',
   'beta-service',
   'gamma-worker',
   'delta-core',
   'epsilon-api',
   'zeta-worker',
   'eta-core',
   'theta-db',
   'iota-cache',
   'kappa-core',
   'lambda-queue',
   'mu-gateway',
  ]
  for (let i = 0; i < sampleTags.length; i += 1) {
   await tagsCell['add-btn'].listeners.click()
   tagsCell.items[i]['input-el'].value = sampleTags[i]
   await tagsCell.items[i]['input-el'].listeners.input()
  }
  assert.equal(tagsCell['items-el'].hidden, false)
  assert.equal(tagsCell.items.length, 12)
  assert.equal(tagsCell['match-count'], 12)
  assert.ok(tagsCell.items.every(item => item.el.hidden === false && item.matched === true))

  // Filter items by "core" -> only the 4 matching items remain visible, without mutating stored array
  tagsCell['filter-input'].value = 'CORE'
  await tagsCell['filter-input'].listeners.input()
  assert.equal(tagsCell['filter-query'], 'CORE')
  assert.equal(tagsCell['match-count'], 4)
  const visibleTags = tagsCell.items.filter(item => !item.el.hidden).map(item => item['input-el'].value)
  assert.deepEqual(visibleTags, ['alpha-core', 'delta-core', 'eta-core', 'kappa-core'])
  const tagsColId = dataView.tables[0].columns[0].id
  assert.equal(dataView.tables[0].rows[0].values[tagsColId].length, 12)

  // Editing an item while filtered updates its visibility live
  tagsCell.items[1]['input-el'].value = 'beta-core'
  await tagsCell.items[1]['input-el'].listeners.input()
  assert.equal(tagsCell['match-count'], 5)
  assert.equal(tagsCell.items[1].el.hidden, false)

  // Removing a matching item while filtered preserves the filter query on re-render
  await tagsCell.items[0]['remove-btn'].listeners.click()
  await dataView['confirm-modal']['confirm-btn'].listeners.click()
  assert.equal(tagsCell.items.length, 11)
  assert.equal(tagsCell['filter-input'].value, 'CORE')
  assert.equal(tagsCell['match-count'], 4)
  assert.deepEqual(
   tagsCell.items.filter(item => !item.el.hidden).map(item => item['input-el'].value),
   ['beta-core', 'delta-core', 'eta-core', 'kappa-core']
  )

  // Pressing Escape in filter input clears the filter and shows all 11 items
  await tagsCell['filter-input'].listeners.keydown({
   key: 'Escape',
   preventDefault() {},
   stopPropagation() {},
  })
  assert.equal(tagsCell['filter-input'].value, '')
  assert.equal(tagsCell['filter-query'], '')
  assert.equal(tagsCell['match-count'], 11)
  assert.ok(tagsCell.items.every(item => item.el.hidden === false))

  // Resizing the column updates header and cell width so full-width chips resize with the column
  dataView.tables[0].columns[0].width = 260
  await dataView['apply-column-width'](0, 260)
  assert.equal(tagsCell.td.style.width, '260px')
  assert.match(tagsCell.td.className, /lane-data-td--sized/)
 }
 finally {
  globalThis.fetch = origFetch
 }
})

test('Inbound subtables display options above table header, left caret column, multi-subtable titled groups, and session-dirty persistence (Save/Fork/Abandon)', async () => {
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
   className: '',
   title: '',
   hidden: false,
   disabled: false,
   checked: false,
   focused: false,
   removed: false,
   setAttribute(name, value) { this.attributes[name] = String(value) },
   getAttribute(name) { return this.attributes[name] ?? null },
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

 const makeMemStorage = () => {
  const m = new Map()
  return {
   getItem(k) { return m.has(k) ? m.get(k) : null },
   setItem(k, v) { m.set(k, String(v)) },
   removeItem(k) { m.delete(k) },
  }
 }

 const laneId = 'a64fdf49-41d9-4764-acc3-0acd620f5063'
 const tasksTable = {
  id: 'tbl-tasks',
  name: 'tasks',
  columns: [
   { id: 'col-title', name: 'title', type: 'text', multiple: false, width: 248 },
   { id: 'col-id', name: 'id', type: 'integer', multiple: false, width: 92 },
  ],
  rows: [
   { id: 'row-task-0', values: { 'col-title': 'Replace Innocent with Mwenecho', 'col-id': 0 } },
   { id: 'row-task-1', values: { 'col-title': 'Fix missing /unsend URL on TMI Robots', 'col-id': 1 } },
  ],
 }
 const taskLogsTable = {
  id: 'tbl-task-logs',
  name: 'task_logs',
  columns: [
   {
    id: 'col-log-task',
    name: 'task',
    type: 'row',
    multiple: false,
    refTableId: 'tbl-tasks',
    refColumnId: 'col-id',
    refDisplayColumnId: 'col-title',
   },
   { id: 'col-log-comment', name: 'comment', type: 'text', multiple: false },
   { id: 'col-log-hours', name: 'hours', type: 'fixed', multiple: false, decimals: 2 },
  ],
  rows: [
   {
    id: 'row-log-1',
    values: {
     'col-log-task': 1,
     'col-log-comment': 'Noticed that the unsend instructions were incomplete',
     'col-log-hours': 0,
    },
   },
  ],
 }
 const taskNotesTable = {
  id: 'tbl-task-notes',
  name: 'task_notes',
  columns: [
   {
    id: 'col-note-task',
    name: 'task',
    type: 'row',
    multiple: false,
    refTableId: 'tbl-tasks',
    refColumnId: 'col-id',
    refDisplayColumnId: 'col-title',
   },
   { id: 'col-note-body', name: 'note', type: 'text', multiple: false },
  ],
  rows: [
   { id: 'row-note-1', values: { 'col-note-task': 1, 'col-note-body': 'Follow up on robot docs' } },
  ],
 }

 await rootKv.namespace(laneId).set('title', 'Projects')
 await rootKv.namespace(laneId).set('path', 'data/tasks')
 await registerLaneInPackage(rootKv, laneId, 'Projects', DEFAULT_PACKAGE_ID)
 await saveLaneTables(rootKv, rootKv.namespace(laneId), laneId, [tasksTable, taskLogsTable, taskNotesTable])

  // Unit check for resolveInboundSubtables and getInboundSubtableRowsForParent
  const inboundSpecs = resolveInboundSubtables([tasksTable, taskLogsTable, taskNotesTable], tasksTable)
  assert.equal(inboundSpecs.length, 2)
  assert.equal(inboundSpecs[0].tableName, 'task_logs')
  assert.deepEqual(inboundSpecs[0].linkColumnIds, ['col-log-task'])
  assert.deepEqual(inboundSpecs[0].displayColumns.map(c => c.name), ['comment', 'hours'])
  assert.equal(inboundSpecs[1].tableName, 'task_notes')
  assert.deepEqual(inboundSpecs[1].linkColumnIds, ['col-note-task'])
  assert.deepEqual(inboundSpecs[1].displayColumns.map(c => c.name), ['note'])
  assert.equal(getInboundSubtableRowsForParent(inboundSpecs[0], tasksTable.rows[0], [tasksTable, taskLogsTable, taskNotesTable]).length, 0)
  const matchedForTask1 = getInboundSubtableRowsForParent(inboundSpecs[0], tasksTable.rows[1], [tasksTable, taskLogsTable, taskNotesTable])
  assert.equal(matchedForTask1.length, 1)
  assert.equal(matchedForTask1[0].rowNumber, 1)
  assert.equal(matchedForTask1[0].row.id, 'row-log-1')

 let uuid = 0
 const localStore = makeMemStorage()
 const sessionStore = makeMemStorage()
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
  crypto: { randomUUID: () => `subtbl-uuid-${++uuid}` },
  history: { pushState(_s, _t, url) { mockWindow.location.pathname = url } },
  location: { pathname: `/${laneId};data|tasks`, search: '', hash: '' },
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
   console: { log() {}, error() {} },
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

  const laneControl = f.state['lane-control']
  const summary = laneControl['workspace-summary']
  const projLane = laneControl['by-id'][laneId]
  const dv = projLane.notebook['data-view']

  // 1. Session starts clean; display options row is visible right above grid-table inside grid-wrap
  assert.equal(laneControl['session-dirty'], false)
  assert.equal(dv['grid-wrap'].children[0], dv['display-options-el'])
  assert.equal(dv['display-options-el'].hidden, false)
  assert.equal(dv['display-options-btns'].length, 2)
  assert.equal(dv['display-options-btns'][0]['name-el'].textContent, 'task_logs')
  assert.equal(dv['display-options-btns'][0].active, false)
  assert.equal(dv['display-options-btns'][1]['name-el'].textContent, 'task_notes')
  assert.equal(dv['display-options-btns'][1].active, false)

  // Before any subtable is toggled visible, no subtoggle column is rendered (first header is '#')
  assert.equal(dv['grid-head-cells'][0].kind, 'num')
  assert.equal(dv['grid-head-cells'][0].el.textContent, '#')
  assert.equal(dv['grid-rows'].length, 2)
  assert.equal(dv['grid-rows'][0]['num-el'].textContent, 1)
  assert.equal(dv['grid-rows'][1]['num-el'].textContent, 2)
  assert.equal(dv['grid-rows'][0]['subtoggle-el'], null)
  assert.equal(dv['grid-rows'][1]['subtable-groups'].length, 0)

  // 2. Toggle `task_logs` on -> session goes unsaved (dirty), left caret column appears, row numbers stay 1 and 2
  await dv['display-options-btns'][0].el.listeners.click()
  assert.equal(laneControl['session-dirty'], true)
  assert.equal(summary['draft-box'].hidden, false)
  assert.equal(dv['display-options-btns'][0].active, true)
  assert.equal(dv['grid-head-cells'][0].kind, 'subtoggle')
  assert.equal(dv['grid-head-cells'][1].kind, 'num')
  assert.equal(dv['grid-head-cells'][1].el.textContent, '#')
  assert.equal(dv['grid-rows'][0]['num-el'].textContent, 1)
  assert.equal(dv['grid-rows'][1]['num-el'].textContent, 2)
  assert.ok(dv['grid-rows'][0]['subtoggle-el'])
  assert.ok(dv['grid-rows'][1]['subtoggle-el'])

  // Row 1 (task id = 0) has no task_logs; Row 2 (task id = 1) has 1 group for task_logs, default expanded
  // The subtable row is indented by one empty subtoggle cell so the caret cell sits directly under the parent '#' row number column,
  // and the linking `task` column is omitted from the subtable columns (leaving only `comment` and `hours`).
  assert.equal(dv['grid-rows'][0]['subtable-groups'].length, 0)
  assert.equal(dv['grid-rows'][1]['subtable-groups'].length, 1)
  const logGroup = dv['grid-rows'][1]['subtable-groups'][0]
  assert.equal(logGroup['table-name'], 'task_logs')
  assert.equal(logGroup.el.children[0], logGroup['indent-td'])
  assert.match(logGroup['indent-td'].className, /lane-data-td--subtable-indent/)
  assert.equal(logGroup.el.children[1], logGroup['caret-td'])
  assert.match(logGroup['caret-td'].className, /lane-data-td--num/)
  assert.equal(logGroup.el.children[2], logGroup['content-td'])
  assert.deepEqual(logGroup['display-columns'].map(c => c.name), ['comment', 'hours'])
  assert.equal(logGroup.collapsed, false)
  assert.equal(logGroup['caret-btn'].textContent, '▾')
  assert.equal(logGroup['body-el'].hidden, false)
  assert.equal(logGroup['count-el'].textContent, 1)
  assert.equal(logGroup.rows.length, 1)
  assert.equal(logGroup.rows[0]['num-el'].textContent, 1)
  assert.equal(logGroup.rows[0].cells.length, 2)
  assert.equal(logGroup.rows[0].cells[0].col.name, 'comment')
  assert.equal(logGroup.rows[0].cells[0]['input-el'].value, 'Noticed that the unsend instructions were incomplete')
  assert.equal(logGroup.rows[0].cells[1].col.name, 'hours')

  // Clicking the caret collapses and expands the subtable group
  await logGroup['caret-btn'].listeners.click()
  assert.equal(logGroup.collapsed, true)
  assert.equal(logGroup['caret-btn'].textContent, '▸')
  assert.equal(logGroup['body-el'].hidden, true)
  await logGroup['caret-btn'].listeners.click()
  assert.equal(logGroup.collapsed, false)
  assert.equal(logGroup['caret-btn'].textContent, '▾')
  assert.equal(logGroup['body-el'].hidden, false)

  // 3. Also toggle `task_notes` on -> Row 2 now shows 2 titled groups underneath it, each with its own caret under the '#' column and without `task`
  await dv['display-options-btns'][1].el.listeners.click()
  assert.equal(dv['grid-rows'][1]['subtable-groups'].length, 2)
  assert.equal(dv['grid-rows'][1]['subtable-groups'][0]['table-name'], 'task_logs')
  assert.equal(dv['grid-rows'][1]['subtable-groups'][1]['table-name'], 'task_notes')
  assert.equal(dv['grid-rows'][1]['subtable-groups'][1].rows[0].cells.length, 1)
  assert.equal(dv['grid-rows'][1]['subtable-groups'][1].rows[0].cells[0].col.name, 'note')
  assert.equal(dv['grid-rows'][1]['subtable-groups'][1].rows[0].cells[0]['input-el'].value, 'Follow up on robot docs')

  // 4. Save session draft -> commits tableDisplayOptions and clears dirty state
  await summary['draft-save-btn'].listeners.click()
  assert.equal(laneControl['session-dirty'], false)
  assert.deepEqual(
   laneControl['saved-table-display-options'][`${laneId}:tbl-tasks`],
   ['tbl-task-logs', 'tbl-task-notes']
  )

  // 5. Hide `task_notes` -> marks session dirty again; Abandon reverts back to saved state (both visible)
  await dv['display-options-btns'][1].el.listeners.click()
  assert.equal(laneControl['session-dirty'], true)
  assert.equal(dv['grid-rows'][1]['subtable-groups'].length, 1)

  await summary['draft-abandon-btn'].listeners.click()
  assert.equal(laneControl['session-dirty'], false)
  const restoredDv = laneControl['by-id'][laneId].notebook['data-view']
  assert.equal(restoredDv['display-options-btns'][0].active, true)
  assert.equal(restoredDv['display-options-btns'][1].active, true)
  assert.equal(restoredDv['grid-rows'][1]['subtable-groups'].length, 2)
 }
 finally {
  globalThis.fetch = origFetch
 }
})

test('Multiselect Apply/Cancel on selectable multiple Data columns: lane[], row[] (pagination, chips, Clear, + Add), text(workflow)[], and nested + Add inline multiselect', async () => {
 const indexHtml = await fs.readFile(new URL('./index.html', import.meta.url), 'utf8')
 assert.match(indexHtml, /\.lane-multiselect-bar\s*\{/)
 assert.match(indexHtml, /\.lane-multiselect-chip\s*\{/)
 assert.match(indexHtml, /\.lane-row-picker-footer-actions\s*\{/)
 assert.match(indexHtml, /\.lane-inline-multiselect\s*\{/)

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
   checked: false,
   className: '',
   title: '',
   hidden: false,
   disabled: false,
   focused: false,
   removed: false,
   rect: { top: 24, left: 0, width: 640, height: 480 },
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
    this.children = []
    for (const n of nodes) this.appendChild(n)
   },
   addEventListener(event, handler) { this.listeners[event] = handler },
   focus() { this.focused = true },
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
 }

 const kv = new Map()
 function createMockKV(prefix = '') {
  const qualify = key => (prefix ? `${prefix}.${key}` : key)
  const client = {
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

 let uuid = 0
 const windowListeners = {}
 const localMap = new Map()
 const sessionMap = new Map()
 const makeStore = m => ({
  getItem: k => (m.has(k) ? m.get(k) : null),
  setItem: (k, v) => m.set(k, String(v)),
  removeItem: k => m.delete(k),
 })
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
  innerHeight: 900,
  innerWidth: 1440,
  localStorage: makeStore(localMap),
  sessionStorage: makeStore(sessionMap),
  location: { pathname: '/', search: '', hash: '' },
  history: {
   pushState(_s, _t, url) {
    if (typeof url === 'string') mockWindow.location.pathname = url.split('?')[0].split('#')[0] || '/'
   },
   replaceState(_s, _t, url) {
    if (typeof url === 'string') mockWindow.location.pathname = url.split('?')[0].split('#')[0] || '/'
   },
  },
  crypto: { randomUUID: () => `ms-uuid-${++uuid}` },
  addEventListener(event, handler) {
   if (!windowListeners[event]) windowListeners[event] = []
   windowListeners[event].push(handler)
  },
  removeEventListener() {},
 }
 async function dispatchWindowKey(key) {
  for (const fn of windowListeners.keydown || []) {
   await fn({ key })
  }
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
  const mockDocument = {
   body: createMockElement('body'),
   documentElement: createMockElement('html'),
   defaultView: mockWindow,
   createElement: createMockElement,
  }
  const f = field({
   ...DATA_RUNTIME_ENV,
   console: { log() {} },
   createIdleTracker,
   data: rootKv,
   defaultRowPickerPageSize: 2,
   defaultValueForType,
   document: mockDocument,
   formatImportLine,
   hasImportCycle,
   history: mockWindow.history,
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
  await lc['confirm-session-data-dir'](null)

  const hubLane = await lc.add()
  await lc.rename(hubLane.id, 'Hub')
  const alphaLane = await lc.add()
  await lc.rename(alphaLane.id, 'Alpha')
  const betaLane = await lc.add()
  await lc.rename(betaLane.id, 'Beta')
  const gammaLane = await lc.add()
  await lc.rename(gammaLane.id, 'Gamma')

  await hubLane.notebook['set-tab']('data')
  const dv = hubLane.notebook['data-view']
  const laneModal = lc['lane-modal']
  const rowPicker = lc['row-picker-modal']

  // 1. Setup workflow table (`wf`: from -> to)
  const wfTbl = await dv['add-table']('wf')
  const wfFromCol = await dv['add-column']('from', 'text', false)
  const wfToCol = await dv['add-column']('to', 'text', false)
  const wfRow1 = await dv['add-row']()
  wfRow1.values[wfFromCol.id] = 'backlog'
  wfRow1.values[wfToCol.id] = 'active'
  const wfRow2 = await dv['add-row']()
  wfRow2.values[wfFromCol.id] = 'active'
  wfRow2.values[wfToCol.id] = 'shipped'
  await dv['save-schema-and-rows'](wfTbl)

  // 2. Setup `teams` table (id integer, name text, members lane[]) so we can also test nested + Add inline multiselect
  const teamsTbl = await dv['add-table']('teams')
  const teamIdCol = await dv['add-column']('id', 'integer', false)
  const teamNameCol = await dv['add-column']('name', 'text', false)
  const teamMembersCol = await dv['add-column']('members', 'lane', true)
  for (const [tid, tname] of [[1, 'Core'], [2, 'Infra'], [3, 'Platform'], [4, 'Security']]) {
   const r = await dv['add-row']()
   r.values[teamIdCol.id] = tid
   r.values[teamNameCol.id] = tname
  }
  await dv['save-schema-and-rows'](teamsTbl)

  // 3. Setup `projects` table with lane[], row[] (pointing to teams), and text(workflow)[]
  await dv['add-table']('projects')
  const lanesCol = await dv['add-column']('lanes', 'lane', true)
  const teamsCol = await dv['add-column']('teams', {
   type: 'row',
   refTableId: teamsTbl.id,
   refColumnId: teamIdCol.id,
   refDisplayColumnId: teamNameCol.id,
  }, true)
  const stagesCol = await dv['add-column']('stages', {
   type: 'text',
   constraint: {
    type: 'workflow',
    tableId: wfTbl.id,
    fromColumnId: wfFromCol.id,
    toColumnId: wfToCol.id,
   },
  }, true)

  const projRow = await dv['add-row']()
  const gRow = dv['grid-rows'][0]
  const lanesCell = gRow.cells[0]
  const teamsCell = gRow.cells[1]
  const stagesCell = gRow.cells[2]

  // --- A. lane[] multiselect ---
  assert.equal(lanesCell['add-btn'].title, 'Add or remove items')
  await lanesCell['add-btn'].listeners.click()
  assert.equal(laneModal['is-open'], true)
  assert.equal(laneModal.multiple, true)
  assert.equal(laneModal['selected-section'].hidden, false)
  assert.equal(laneModal['selected-label-el'].textContent, 'Selected (0)')
  assert.equal(laneModal.footer.hidden, false)

  // Toggle Alpha, Beta, Gamma on, then remove Beta before clicking Apply
  await laneModal.items.find(it => it.entry.id === alphaLane.id)['add-btn'].listeners.click()
  await laneModal.items.find(it => it.entry.id === betaLane.id)['add-btn'].listeners.click()
  await laneModal.items.find(it => it.entry.id === gammaLane.id)['add-btn'].listeners.click()
  assert.deepEqual(laneModal['selected-ids'], [alphaLane.id, betaLane.id, gammaLane.id])
  assert.equal(laneModal['selected-label-el'].textContent, 'Selected (3)')
  // Remove Beta via row Remove button
  await laneModal.items.find(it => it.entry.id === betaLane.id)['remove-btn'].listeners.click()
  assert.deepEqual(laneModal['selected-ids'], [alphaLane.id, gammaLane.id])
  // Cell is still untouched before Apply
  assert.deepEqual(projRow.values[lanesCol.id], [])

  await laneModal['apply-btn'].listeners.click()
  assert.equal(laneModal['is-open'], false)
  assert.deepEqual(projRow.values[lanesCol.id], [alphaLane.id, gammaLane.id])
  assert.equal(lanesCell.items.length, 2)
  assert.equal(lanesCell.items[0]['display-el'].textContent, 'Alpha')
  assert.equal(lanesCell.items[1]['display-el'].textContent, 'Gamma')

  // Clicking an existing item's trigger in lane[] also opens multiselect; Clear + Escape cancels without losing saved items
  await lanesCell.items[0]['trigger-el'].listeners.click()
  assert.equal(laneModal['is-open'], true)
  assert.equal(laneModal.multiple, true)
  assert.deepEqual(laneModal['selected-ids'], [alphaLane.id, gammaLane.id])
  await laneModal['clear-btn'].listeners.click()
  assert.equal(laneModal['is-open'], true) // Clear does NOT close in multiselect mode
  assert.deepEqual(laneModal['selected-ids'], [])
  await dispatchWindowKey('Escape')
  assert.equal(laneModal['is-open'], false)
  assert.deepEqual(projRow.values[lanesCol.id], [alphaLane.id, gammaLane.id])

  // Re-open via +, remove Alpha via Selected chip × button, add Beta, and Apply -> [Gamma, Beta]
  await lanesCell['add-btn'].listeners.click()
  assert.equal(laneModal['selected-chips'][0].title, 'Alpha')
  await laneModal['selected-chips'][0]['remove-btn'].listeners.click()
  await laneModal.items.find(it => it.entry.id === betaLane.id)['add-btn'].listeners.click()
  await laneModal['apply-btn'].listeners.click()
  assert.deepEqual(projRow.values[lanesCol.id], [gammaLane.id, betaLane.id])

  // --- B. row[] multiselect (with pagination page-size=2, out-of-page selected chips, + Add new row with nested lane[] multiselect, Cancel & Apply) ---
  await teamsCell['add-btn'].listeners.click()
  assert.equal(rowPicker['is-open'], true)
  assert.equal(rowPicker.multiple, true)
  assert.equal(rowPicker['apply-btn'].hidden, false)
  assert.equal(rowPicker['option-items'].length, 2) // Page 1: Core (1), Infra (2)
  await rowPicker['option-items'][0].el.listeners.click() // Add 1 (Core)
  rowPicker['search-input'].value = 'Security'
  await rowPicker['search-input'].listeners.input()
  await rowPicker['option-items'][0].el.listeners.click() // Add 4 (Security from page 2)
  assert.deepEqual(rowPicker['selected-values'], [1, 4])
  await rowPicker['apply-btn'].listeners.click()
  assert.equal(rowPicker['is-open'], false)
  assert.deepEqual(projRow.values[teamsCol.id], [1, 4])

  // Re-open teamsCell: page 1 loads only [1, 2], yet out-of-page item 4 ('Security') is still shown in Selected (2) chips and preserved!
  await teamsCell['add-btn'].listeners.click()
  assert.equal(rowPicker['option-items'].length, 2)
  assert.equal(rowPicker['selected-chips'].length, 2)
  assert.equal(rowPicker['selected-chips'][0]['label-el'].textContent, 'Core')
  assert.equal(rowPicker['selected-chips'][1]['label-el'].textContent, 'Security')

  // Expand "+ Add" inside multiselect row-picker to create Team 5 ('AI') and test nested lane[] inline multiselect!
  await rowPicker['add-trigger-btn'].listeners.click()
  assert.equal(rowPicker['add-expanded'], true)
  const membersField = rowPicker['add-fields'][2]
  assert.equal(membersField.name, 'members')
  assert.equal(membersField.selectable, true)
  assert.equal(membersField['inline-picker'].hidden, true)
  await membersField['add-btn'].listeners.click()
  assert.equal(membersField['inline-picker'].hidden, false)
  const inlineAlpha = membersField['inline-options'].find(o => o.item.value === alphaLane.id)
  const inlineHub = membersField['inline-options'].find(o => o.item.value === hubLane.id)
  await inlineAlpha.el.listeners.click()
  await inlineHub.el.listeners.click()
  // Cancel inline picker -> keeps members empty
  await membersField['inline-cancel-btn'].listeners.click()
  assert.equal(membersField['inline-picker'].hidden, true)
  assert.equal(membersField.items.length, 0)
  // Re-open inline picker, pick Alpha + Beta, and Apply -> populates draft members without touching table yet
  await membersField['add-btn'].listeners.click()
  await membersField['inline-options'].find(o => o.item.value === alphaLane.id).el.listeners.click()
  await membersField['inline-options'].find(o => o.item.value === betaLane.id).el.listeners.click()
  await membersField['inline-apply-btn'].listeners.click()
  assert.equal(membersField['inline-picker'].hidden, true)
  assert.equal(membersField.items.length, 2)

  rowPicker['add-fields'][0]['input-el'].value = '5'
  await rowPicker['add-fields'][0]['input-el'].listeners.input()
  rowPicker['add-fields'][1]['input-el'].value = 'AI'
  await rowPicker['add-fields'][1]['input-el'].listeners.input()
  await rowPicker['add-save-btn'].listeners.click()
  // In multiselect mode, saving + Add keeps rowPicker open, collapses + Add, and adds 5 ('AI') to draft selection!
  assert.equal(rowPicker['is-open'], true)
  assert.equal(rowPicker['add-expanded'], false)
  assert.deepEqual(teamsTbl.rows[4].values[teamMembersCol.id], [alphaLane.id, betaLane.id])
  assert.deepEqual(rowPicker['selected-values'], [1, 4, 5])
  // Remove Core (1) via chip × button, then click Apply -> [4, 5]
  await rowPicker['selected-chips'][0]['remove-btn'].listeners.click()
  assert.deepEqual(rowPicker['selected-values'], [4, 5])
  await rowPicker['apply-btn'].listeners.click()
  assert.equal(rowPicker['is-open'], false)
  assert.deepEqual(projRow.values[teamsCol.id], [4, 5])
  // Note: after-select re-rendered grid, so grab latest cells from grid-rows[0]
  const latestTeamsCell = dv['grid-rows'][0].cells[1]
  const latestStagesCell = dv['grid-rows'][0].cells[2]
  assert.equal(latestTeamsCell.items.length, 2)
  assert.equal(latestTeamsCell.items[0]['display-el'].textContent, 'Security')
  assert.equal(latestTeamsCell.items[1]['display-el'].textContent, 'AI')

  // --- C. text(workflow)[] multiselect ---
  assert.equal(latestStagesCell['add-btn'].title, 'Add or remove items')
  await latestStagesCell['add-btn'].listeners.click()
  assert.equal(rowPicker['is-open'], true)
  assert.equal(rowPicker.multiple, true)
  assert.equal(rowPicker['count-el'].textContent, 'Showing 2 of 3 states')
  await rowPicker['load-more']()
  assert.deepEqual(rowPicker['option-items'].map(o => o.item.value), ['backlog', 'active', 'shipped'])

  await rowPicker['option-items'][0].el.listeners.click() // backlog
  await rowPicker['option-items'][2].el.listeners.click() // shipped
  await rowPicker['cancel-btn'].listeners.click()
  assert.deepEqual(projRow.values[stagesCol.id], [])

  await latestStagesCell['add-btn'].listeners.click()
  await rowPicker['load-more']()
  await rowPicker['option-items'][0].el.listeners.click() // backlog
  await rowPicker['option-items'][2].el.listeners.click() // shipped
  await rowPicker['apply-btn'].listeners.click()
  assert.equal(rowPicker['is-open'], false)
  assert.deepEqual(projRow.values[stagesCol.id], ['backlog', 'shipped'])
  assert.equal(latestStagesCell.items.length, 2)
  // Individual workflow items still render transition <select> controls inline!
  assert.ok(latestStagesCell.items[0]['select-el'])
  assert.equal(latestStagesCell.items[0]['select-el'].value, 'backlog')
 }
 finally {
  globalThis.fetch = origFetch
 }
})

test('Remote table helpers: normalization, runtime status guards, stored parsing, and read-only syncTable rejection', () => {
 assert.deepEqual(TABLE_IMPORT_MODES, ['read-only', 'read-write'])
 assert.equal(normalizeTableImportMode('read-write'), 'read-write')
 assert.equal(normalizeTableImportMode('READ-WRITE'), 'read-write')
 assert.equal(normalizeTableImportMode('read-only'), 'read-only')
 assert.equal(normalizeTableImportMode('unknown'), 'read-only')
 assert.equal(normalizeTableImportMode(null), 'read-only')

 assert.equal(normalizeTableRemoteSpec(null), null)
 assert.equal(normalizeTableRemoteSpec({ laneId: 'lane-a' }), null)
 assert.deepEqual(
  normalizeTableRemoteSpec({
   laneId: ' lane-a ',
   tableId: ' tbl-1 ',
   tableName: 'inventory',
   mode: 'read-write',
   customName: true,
   missing: true,
   accessDenied: true,
  }),
  {
   laneId: 'lane-a',
   tableId: 'tbl-1',
   tableName: 'inventory',
   mode: 'read-write',
   customName: true,
  }
 )
 assert.deepEqual(
  normalizeTableRemoteSpec(
   { laneId: 'lane-a', tableId: 'tbl-1', tableName: 'inventory', mode: 'bad', missing: true, accessDenied: false },
   { includeRuntimeStatus: true }
  ),
  {
   laneId: 'lane-a',
   tableId: 'tbl-1',
   tableName: 'inventory',
   mode: 'read-only',
   missing: true,
   accessDenied: false,
  }
 )

 const roTable = {
  id: 'tbl-ro',
  name: 'ro_inv',
  columns: [{ id: 'c1', name: 'sku', type: 'text', multiple: false }],
  rows: [{ id: 'r1', values: { c1: 'A-1' } }],
  remote: { laneId: 'owner-1', tableId: 'owner-tbl-1', tableName: 'inv', mode: 'read-only' },
 }
 const rwTable = {
  id: 'tbl-rw',
  name: 'rw_inv',
  columns: [{ id: 'c1', name: 'sku', type: 'text', multiple: false }],
  rows: [{ id: 'r1', values: { c1: 'A-1' } }],
  remote: { laneId: 'owner-1', tableId: 'owner-tbl-1', tableName: 'inv', mode: 'read-write' },
 }
 const localTable = {
  id: 'tbl-local',
  name: 'local_items',
  columns: [{ id: 'c1', name: 'sku', type: 'text', multiple: false }],
  rows: [],
 }

 assert.equal(isRemoteTable(roTable), true)
 assert.equal(isRemoteTable(rwTable), true)
 assert.equal(isRemoteTable(localTable), false)
 assert.equal(isReadOnlyRemoteTable(roTable), true)
 assert.equal(isReadOnlyRemoteTable(rwTable), false)
 assert.equal(isReadOnlyRemoteTable(localTable), false)
 assert.equal(isReadOnlyRemoteTable({ ...rwTable, remote: { ...rwTable.remote, accessDenied: true } }), true)
 assert.equal(isReadOnlyRemoteTable({ ...rwTable, remote: { ...rwTable.remote, missing: true } }), true)

 const storedReparsed = parseStoredTables(JSON.stringify([roTable, rwTable, localTable]))
 assert.equal(storedReparsed.length, 3)
 assert.deepEqual(storedReparsed[0].remote, {
  laneId: 'owner-1',
  tableId: 'owner-tbl-1',
  tableName: 'inv',
  mode: 'read-only',
 })
 assert.deepEqual(storedReparsed[1].remote, {
  laneId: 'owner-1',
  tableId: 'owner-tbl-1',
  tableName: 'inv',
  mode: 'read-write',
 })
 assert.equal('remote' in storedReparsed[2], false)

 const roSyncRes = syncTableRowsInMemory([roTable, rwTable], 'ro_inv', [{ sku: 'NEW' }], 'sku')
 assert.equal(roSyncRes.ok, false)
 assert.equal(roSyncRes.changed, false)
 assert.equal(roSyncRes.readOnly, true)
 assert.match(roSyncRes.error, /read-only/i)
 assert.equal(roTable.rows.length, 1)

 const rwSyncRes = syncTableRowsInMemory([roTable, rwTable], 'rw_inv', [{ sku: 'A-1' }, { sku: 'B-2' }], 'sku')
 assert.equal(rwSyncRes.ok, true)
 assert.equal(rwSyncRes.count, 2)
 assert.equal(rwTable.rows.length, 2)
})

test('Data tab Import button, Table Import modal, remote badges, Jump-to-Owner navigation, read-only enforcement, read-write live sync, Import settings, and safe Remove import', async () => {
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
   style: { setProperty() {}, removeProperty() {}, getPropertyValue() { return '' } },
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
   readOnly: false,
   focused: false,
   removed: false,
   rect: { top: 24, left: 0, width: 640, height: 480 },
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
    this.children = []
    for (const n of nodes) this.appendChild(n)
   },
   addEventListener(event, handler) { this.listeners[event] = handler },
   focus() { this.focused = true },
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

 let uuid = 0
 const localStore = new Map()
 const sessionStore = new Map()
 const makeStorage = m => ({
  getItem: k => (m.has(k) ? m.get(k) : null),
  setItem: (k, v) => m.set(k, String(v)),
  removeItem: k => m.delete(k),
 })
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
  innerHeight: 900,
  innerWidth: 1440,
  localStorage: makeStorage(localStore),
  sessionStorage: makeStorage(sessionStore),
  location: { pathname: '/', search: '', hash: '' },
  history: {
   pushState(_s, _t, url) {
    if (typeof url === 'string') mockWindow.location.pathname = url.split('?')[0].split('#')[0] || '/'
   },
   replaceState(_s, _t, url) {
    if (typeof url === 'string') mockWindow.location.pathname = url.split('?')[0].split('#')[0] || '/'
   },
  },
  crypto: { randomUUID: () => `rt-uuid-${++uuid}` },
  setTimeout: () => 1,
  clearTimeout() {},
  addEventListener() {},
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
  const mockDocument = {
   body: createMockElement('body'),
   documentElement: createMockElement('html'),
   defaultView: mockWindow,
   createElement: createMockElement,
   addEventListener() {},
  }
  const f = field({
   ...DATA_RUNTIME_ENV,
   console: { log() {} },
   createIdleTracker,
   data: defaultRootKv,
   defaultValueForType,
   document: mockDocument,
   formatImportLine,
   hasImportCycle,
   history: mockWindow.history,
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
  await lc['confirm-session-data-dir'](null)

  const warehouseLane = await lc.add()
  await lc.rename(warehouseLane.id, 'Warehouse')
  const storefrontLane = await lc.add()
  await lc.rename(storefrontLane.id, 'Storefront')
  const auditorLane = await lc.add()
  await lc.rename(auditorLane.id, 'Auditor')

  // Seed Owner ("Warehouse") with two tables: "inventory" (2 rows) and "warehouses" (active)
  await warehouseLane.notebook['set-tab']('data')
  const wDv = warehouseLane.notebook['data-view']
  const invTbl = await wDv['add-table']('inventory')
  const skuCol = await wDv['add-column']('sku', 'text', false)
  const qtyCol = await wDv['add-column']('qty', 'integer', false)
  const wRow1 = await wDv['add-row']()
  wRow1.values[skuCol.id] = 'A-1'
  wRow1.values[qtyCol.id] = 10
  await wDv['save-row'](invTbl, wRow1)
  const wRow2 = await wDv['add-row']()
  wRow2.values[skuCol.id] = 'B-2'
  wRow2.values[qtyCol.id] = 5
  await wDv['save-row'](invTbl, wRow2)

  const whTbl = await wDv['add-table']('warehouses')
  const codeCol = await wDv['add-column']('code', 'text', false)
  const whRow = await wDv['add-row']()
  whRow.values[codeCol.id] = 'EAST'
  await wDv['save-row'](whTbl, whRow)
  assert.equal(wDv['active-table-id'], whTbl.id)

  // Setup Importer ("Storefront") with its own local table named "inventory" to test collision disambiguation
  await storefrontLane.notebook['set-tab']('data')
  const sDv = storefrontLane.notebook['data-view']
  assert.deepEqual(sDv['bar-el'].children, [sDv['tabs-el'], sDv['bar-actions-el']])
  assert.deepEqual(sDv['bar-actions-el'].children, [sDv['add-table-btn'], sDv['import-table-btn']])
  assert.equal(sDv['add-table-btn'].textContent, '+ Table')
  assert.equal(sDv['import-table-btn'].textContent, 'Import')

  const localInv = await sDv['add-table']('inventory')
  const orderSkuCol = await sDv['add-column']('order_no', 'text', false)
  const sLocalRow = await sDv['add-row']()
  sLocalRow.values[orderSkuCol.id] = 'ORD-1'
  await sDv['save-row'](localInv, sLocalRow)

  // Local table keeps menu children [edit-table-btn, clear-rows-btn, delete-table-btn] and hidden remote banner
  assert.equal(sDv['remote-bar-el'].hidden, true)
  assert.deepEqual(sDv['table-menu'].children, [sDv['edit-table-btn'], sDv['clear-rows-btn'], sDv['delete-table-btn']])

  // Click Import next to + Table -> opens Import Table modal
  const importModal = lc['table-import-modal']
  await sDv['import-table-btn'].listeners.click()
  assert.equal(importModal['is-open'], true)
  assert.equal(importModal['heading-el'].textContent, 'Import Table')
  assert.deepEqual(
   importModal['lane-items'].map(it => it.id),
   [warehouseLane.id, auditorLane.id]
  )

  const whLaneItem = importModal['lane-items'].find(it => it.id === warehouseLane.id)
  await whLaneItem.el.listeners.click()
  assert.deepEqual(
   importModal['table-items'].map(it => it.table.name),
   ['inventory', 'warehouses']
  )
  const invTableItem = importModal['table-items'].find(it => it.table.id === invTbl.id)
  await invTableItem.el.listeners.click()
  assert.equal(importModal['alias-input'].value, 'inventory_2')
  assert.equal(importModal.mode, 'read-only')

  // Confirm Read-only import
  await importModal.form.listeners.submit({})
  assert.equal(importModal['is-open'], false)
  assert.equal(sDv.tables.length, 2)
  const roImported = sDv.tables[1]
  assert.equal(roImported.name, 'inventory_2')
  assert.equal(roImported.remote.laneId, warehouseLane.id)
  assert.equal(roImported.remote.tableId, invTbl.id)
  assert.equal(roImported.remote.mode, 'read-only')
  assert.equal(roImported.remote.customName, true)
  assert.equal(roImported.rows.length, 2)

  // Single source of truth: ZERO row keys persisted under Storefront's imported table namespace
  const defaultStore = getStore('__default__')
  const dupRowKeys = [...defaultStore.keys()].filter(k =>
   k.startsWith(`lanes#${storefrontLane.id}/tables/${roImported.id}/rows`)
  )
  assert.deepEqual(dupRowKeys, [])

  // Visual remote badges on tab pill + origin banner
  const roTab = sDv['table-tabs'][1]
  assert.match(roTab.el.className, /lane-data-table-tab--remote/)
  assert.match(roTab.el.className, /lane-data-table-tab--readonly/)
  assert.equal(roTab['remote-el'].textContent, '↗ RO')
  assert.equal(roTab.el.getAttribute('data-remote-lane'), warehouseLane.id)
  assert.equal(roTab.el.getAttribute('data-remote-table'), invTbl.id)
  assert.equal(roTab.el.getAttribute('data-remote-mode'), 'read-only')

  assert.equal(sDv['remote-bar-el'].hidden, false)
  assert.equal(sDv['remote-mode-badge'].textContent, 'REMOTE · READ-ONLY')
  assert.equal(sDv['remote-jump-btn'].textContent, '← From Warehouse · data/inventory ↗')
  assert.equal(sDv['remote-edit-btn'].hidden, false)
  assert.deepEqual(sDv['table-menu'].children, [
   sDv['jump-owner-btn'],
   sDv['edit-import-btn'],
   sDv['delete-table-btn'],
  ])
  assert.equal(sDv['delete-table-btn'].textContent, 'Remove import')

  // Read-only enforcement in UI
  await sDv['open-edit-table-modal']()
  assert.equal(sDv['edit-table-modal']['is-open'], false)
  assert.equal(sDv['add-row-btn'].hidden, true)
  assert.equal(sDv['add-row-btn'].disabled, true)
  assert.equal(sDv['add-col-btn'].hidden, true)
  assert.equal(sDv['add-col-btn'].disabled, true)
  assert.equal(sDv['grid-rows'][0]['remove-btn'].hidden, true)
  assert.equal(sDv['grid-rows'][0].cells[0]['input-el'].disabled, true)
  assert.equal(sDv['grid-rows'][0].cells[1]['input-el'].disabled, true)
  await sDv['schema-toggle-btn'].listeners.click()
  assert.equal(sDv['schema-rows'][0]['name-el'].disabled, true)
  assert.equal(sDv['schema-rows'][0]['type-el'].disabled, true)
  assert.equal(sDv['schema-rows'][0]['remove-btn'].hidden, true)

  // Local table can still create a row-type column referencing imported read-only table, with + Add disabled
  await sDv['select-table'](localInv.id)
  const linkCol = await sDv['add-column']('stock_ref', {
   type: 'row',
   multiple: false,
   refTableId: roImported.id,
   refColumnId: skuCol.id,
  })
  const rowPicker = lc['row-picker-modal']
  await sDv['grid-rows'][0].cells[1]['trigger-el'].listeners.click()
  assert.equal(rowPicker['is-open'], true)
  assert.equal(rowPicker['can-add'], false)
  assert.deepEqual(rowPicker['option-items'].map(o => o.item.value), ['A-1', 'B-2'])
  await rowPicker['option-items'][0].el.listeners.click()
  assert.equal(localInv.rows[0].values[linkCol.id], 'A-1')

  // Source scope exposes $inventory_2 natively, while !syncTable on read-only remote table is rejected
  await sDv['select-table'](roImported.id)
  await storefrontLane.notebook['set-tab']('source')
  storefrontLane.notebook.rows[0]['input-el'].value =
   "; to res !syncTable inventory_2 { [ object { sku 'Z-9' } { qty 1 } ] } sku"
  await storefrontLane.notebook.rows[0]['input-el'].listeners.input()
  assert.equal(storefrontLane.notebook.state.res.ok, false)
  assert.match(storefrontLane.notebook.state.res.error, /read-only/i)
  assert.deepEqual(storefrontLane.notebook.state.inventory_2, [
   { sku: 'A-1', qty: 10 },
   { sku: 'B-2', qty: 5 },
  ])
  await storefrontLane.notebook['set-tab']('data')

  // Auditor importing from Storefront must NOT see Storefront's imported table (prevents chains/cycles)
  await auditorLane.notebook['set-tab']('data')
  const aDv = auditorLane.notebook['data-view']
  await aDv['import-table-btn'].listeners.click()
  const sfItem = importModal['lane-items'].find(it => it.id === storefrontLane.id)
  await sfItem.el.listeners.click()
  assert.deepEqual(
   importModal['table-items'].map(it => it.table.name),
   ['inventory']
  )
  await importModal['close-btn'].listeners.click()

  // Owner rename live-updates remote jump button text
  await lc.rename(warehouseLane.id, 'Central Warehouse')
  assert.equal(sDv['remote-jump-btn'].textContent, '← From Central Warehouse · data/inventory ↗')

  // Jump-to-Owner Case 1: open owner currently on Source tab & different active table ("warehouses")
  await warehouseLane.notebook['set-tab']('source')
  assert.equal(wDv['active-table-id'], whTbl.id)
  await sDv['remote-jump-btn'].listeners.click()
  assert.equal(warehouseLane.notebook['active-tab'], 'data')
  assert.equal(wDv['active-table-id'], invTbl.id)
  assert.equal(warehouseLane['is-highlighted'], true)
  assert.match(mockWindow.location.pathname, new RegExp(`${warehouseLane.id};data\\|inventory`))

  // Jump-to-Owner Case 2: minimized owner -> restores and switches to data/inventory
  await lc.minimize(warehouseLane.id, 'left')
  assert.equal(warehouseLane['is-minimized'], true)
  await sDv['jump-owner-btn'].listeners.click()
  const restoredOwner = lc['by-id'][warehouseLane.id]
  assert.equal(restoredOwner['is-minimized'], false)
  assert.equal(restoredOwner.notebook['active-tab'], 'data')
  assert.equal(restoredOwner.notebook['data-view']['active-table-id'], invTbl.id)

  // Jump-to-Owner Case 3: closed owner -> opens immediately after importing lane on data/inventory + URL sync
  await lc.close(warehouseLane.id)
  assert.equal(Boolean(lc['by-id'][warehouseLane.id]), false)
  await sDv['remote-jump-btn'].listeners.click()
  const reopenedOwner = lc['by-id'][warehouseLane.id]
  assert.ok(reopenedOwner)
  const sfIdx = lc['lane-ids'].indexOf(storefrontLane.id)
  assert.equal(lc['lane-ids'][sfIdx + 1], warehouseLane.id)
  assert.equal(reopenedOwner.notebook['active-tab'], 'data')
  assert.equal(reopenedOwner.notebook['data-view']['active-table-id'], invTbl.id)
  assert.match(mockWindow.location.pathname, new RegExp(`${warehouseLane.id};data\\|inventory`))
  const latestWDv = reopenedOwner.notebook['data-view']

  // Import Settings: switch Storefront remote table to Read-write with alias "remote_stock"
  await sDv['remote-edit-btn'].listeners.click()
  assert.equal(importModal['is-open'], true)
  assert.equal(importModal['heading-el'].textContent, 'Import Settings')
  await importModal['rw-btn'].listeners.click()
  importModal['alias-input'].value = 'remote_stock'
  await importModal['alias-input'].listeners.input()
  await importModal.form.listeners.submit({})

  assert.equal(importModal['is-open'], false)
  assert.equal(roImported.name, 'remote_stock')
  assert.equal(roImported.remote.mode, 'read-write')
  assert.equal(roImported.remote.customName, true)
  assert.equal(sDv['remote-mode-badge'].textContent, 'REMOTE · READ-WRITE')
  assert.equal(sDv['table-tabs'][1]['remote-el'].textContent, '↗ RW')
  assert.equal(sDv['add-row-btn'].hidden, false)
  assert.equal(sDv['add-row-btn'].disabled, false)
  assert.equal(latestWDv.tables.find(t => t.id === invTbl.id).name, 'inventory')

  // Also mount Warehouse "inventory" into Auditor as Read-only so we verify 3-way live sync
  await auditorLane.notebook['set-tab']('data')
  await aDv['import-table-btn'].listeners.click()
  await importModal['lane-items'].find(it => it.id === warehouseLane.id).el.listeners.click()
  await importModal['table-items'].find(it => it.table.id === invTbl.id).el.listeners.click()
  await importModal.form.listeners.submit({})
  const auditorRoTbl = aDv.tables[0]
  assert.equal(auditorRoTbl.remote.mode, 'read-only')

  // Write-through from Read-write Importer ("Storefront"): edit row 1 qty -> 42 and add row 3 ("C-3": 99)
  sDv['grid-rows'][0].cells[1]['input-el'].value = '42'
  await sDv['grid-rows'][0].cells[1]['input-el'].listeners.input()
  const addedRwRow = await sDv['add-row']()
  addedRwRow.values[skuCol.id] = 'C-3'
  addedRwRow.values[qtyCol.id] = 99
  await sDv['save-row'](roImported, addedRwRow)

  const liveOwnerInv = latestWDv.tables.find(t => t.id === invTbl.id)
  assert.equal(liveOwnerInv.rows.length, 3)
  assert.equal(liveOwnerInv.rows[0].values[qtyCol.id], 42)
  assert.equal(liveOwnerInv.rows[2].values[skuCol.id], 'C-3')
  assert.equal(liveOwnerInv.rows[2].values[qtyCol.id], 99)
  assert.equal(auditorRoTbl.rows.length, 3)
  assert.equal(auditorRoTbl.rows[0].values[qtyCol.id], 42)
  assert.equal(auditorRoTbl.rows[2].values[skuCol.id], 'C-3')

  // Zero duplicate row keys under Storefront's imported table ID after write-through!
  const dupAfterRw = [...defaultStore.keys()].filter(k =>
   k.startsWith(`lanes#${storefrontLane.id}/tables/${roImported.id}/rows`)
  )
  assert.deepEqual(dupAfterRw, [])

  // Owner edit live-syncs open Read-write and Read-only importers
  latestWDv['grid-rows'][1].cells[1]['input-el'].value = '15'
  await latestWDv['grid-rows'][1].cells[1]['input-el'].listeners.input()
  assert.equal(roImported.rows[1].values[qtyCol.id], 15)
  assert.equal(auditorRoTbl.rows[1].values[qtyCol.id], 15)

  // Safe Remove import: unlinks remote table from Storefront without agreement checkbox and WITHOUT deleting owner table/rows
  const confirmModal = sDv['confirm-modal']
  await sDv['table-menu-btn'].listeners.click({})
  await sDv['delete-table-btn'].listeners.click()
  assert.equal(confirmModal['is-open'], true)
  assert.equal(confirmModal['title-el'].textContent, 'Remove Imported Table')
  assert.equal(confirmModal['require-agreement'], false)
  assert.equal(confirmModal['confirm-btn'].disabled, false)
  assert.match(confirmModal['message-el'].textContent, /Central Warehouse/)
  assert.match(confirmModal['message-el'].textContent, /will not be deleted/)
  await confirmModal['confirm-btn'].listeners.click()

  assert.equal(sDv.tables.length, 1)
  assert.equal(sDv.tables[0].id, localInv.id)
  const ownerAfterUnlink = await loadLaneTables(defaultRootKv, defaultRootKv.namespace(warehouseLane.id), warehouseLane.id)
  const persistedOwnerInv = ownerAfterUnlink.find(t => t.id === invTbl.id)
  assert.equal(persistedOwnerInv.rows.length, 3)
  assert.equal(persistedOwnerInv.rows[0].values[qtyCol.id], 42)
  assert.equal(persistedOwnerInv.rows[1].values[qtyCol.id], 15)
  assert.equal(persistedOwnerInv.rows[2].values[skuCol.id], 'C-3')
 }
 finally {
  globalThis.fetch = origFetch
 }
})

test('Agent API import-table action, read-only guards, read-write write-through, and collectLaneSyncBundle owner inclusion', async () => {
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
 const mockWin = {
  Array,
  JSON,
  Object,
  crypto: {
   _seq: 0,
   randomUUID() { return `ag-uuid-${++this._seq}` },
  },
 }
 await createNewSession(defaultRootKv, mockWin, { name: 'Remote Agent Test', dataDir: null })
 await defaultRootKv.set(`sessions#default/data-dir-confirmed`, 'true')

 const eventHub = createAgentEventHub()
 const ownerRes = await agentCreateLane(defaultRootKv, {
  title: 'LedgerOwner',
  lines: ['; to owner_ready true'],
  eventHub,
 })
 const importerRes = await agentCreateLane(defaultRootKv, {
  title: 'ReportConsumer',
  lines: ['; to report $ledger.0.account'],
  eventHub,
 })
 assert.equal(ownerRes.ok, true)
 assert.equal(importerRes.ok, true)
 const ownerId = ownerRes.laneId
 const importerId = importerRes.laneId

 await agentMutateLaneTable(defaultRootKv, {
  laneId: ownerId,
  action: 'create-table',
  tableName: 'accounts',
  columns: [
   { name: 'account', type: 'text', required: true },
   { name: 'balance', type: 'fixed', decimals: 2 },
  ],
  eventHub,
 })
 await agentMutateLaneTable(defaultRootKv, {
  laneId: ownerId,
  action: 'add-row',
  table: 'accounts',
  values: { account: 'Checking', balance: '125.50' },
  eventHub,
 })

 // Import read-only
 const impRo = await agentMutateLaneTable(defaultRootKv, {
  laneId: importerId,
  action: 'import-table',
  sourceLane: 'LedgerOwner',
  sourceTable: 'accounts',
  mode: 'read-only',
  localName: 'ro_ledger',
  eventHub,
 })
 assert.equal(impRo.ok, true)
 assert.equal(impRo.table.name, 'ro_ledger')
 assert.equal(impRo.table.remote.mode, 'read-only')

 const roFail = await agentMutateLaneTable(defaultRootKv, {
  laneId: importerId,
  action: 'add-row',
  table: 'ro_ledger',
  values: { account: 'Blocked', balance: '1.00' },
  eventHub,
 })
 assert.equal(roFail.ok, false)
 assert.match(roFail.error, /read-only/i)

 // Import read-write as "ledger" and write through to owner
 const impRw = await agentMutateLaneTable(defaultRootKv, {
  laneId: importerId,
  action: 'import-table',
  sourceLane: 'LedgerOwner',
  sourceTable: 'accounts',
  mode: 'read-write',
  localName: 'ledger',
  eventHub,
 })
 assert.equal(impRw.ok, true)
 assert.equal(impRw.table.remote.mode, 'read-write')

 const rwAdd = await agentMutateLaneTable(defaultRootKv, {
  laneId: importerId,
  action: 'add-row',
  table: 'ledger',
  values: { account: 'Reserve', balance: '500.00' },
  eventHub,
 })
 assert.equal(rwAdd.ok, true)

 const ownerCheck = await agentGetLane(defaultRootKv, { laneId: ownerId })
 assert.equal(ownerCheck.lane.tables[0].namedRows.length, 2)
 assert.equal(ownerCheck.lane.tables[0].namedRows[1].account, 'Reserve')
 assert.equal(ownerCheck.lane.tables[0].namedRows[1].balance, 50000)

 // Sync bundle includes remote table owner lane when includeImports = true
 const bundle = await collectLaneSyncBundle(defaultRootKv, importerId, { includeImports: true, win: mockWin })
 assert.deepEqual(bundle.lanes.map(l => l.id), [importerId, ownerId])

 // Deleting imported table via agent safely unlinks without deleting owner table
 const delImp = await agentMutateLaneTable(defaultRootKv, {
  laneId: importerId,
  action: 'delete-table',
  table: 'ro_ledger',
  eventHub,
 })
 assert.equal(delImp.ok, true)
 const ownerStillThere = await agentGetLane(defaultRootKv, { laneId: ownerId })
 assert.equal(ownerStillThere.lane.tables[0].namedRows.length, 2)
})

test('lane-data mount shows in-flight loading state and disables table actions until KV resolves', async () => {
 const dataSource = await fs.readFile(new URL('./src/lane-data.fs', import.meta.url), 'utf8')
 const confirmModalSource = await fs.readFile(new URL('./src/confirm-modal.fs', import.meta.url), 'utf8')
 const rowPickerModalSource = await fs.readFile(new URL('./src/lane-row-picker-modal.fs', import.meta.url), 'utf8')

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
   focus() { this.focused = true },
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

 let releaseLoad = null
 const loadGate = new Promise(resolve => { releaseLoad = resolve })
 const kvMap = new Map()
 function makeDeferredKv(prefix = '', rootRef = null) {
  const qualify = key => (prefix ? `${prefix}/${key}` : key)
  const client = {
   get root() { return rootRef || client },
   namespace(name) { return makeDeferredKv(qualify(name), client.root) },
   async get(key) {
    if (prefix === 'lane-load-test') {
     await loadGate
    }
    return kvMap.has(qualify(key)) ? kvMap.get(qualify(key)) : null
   },
   async set(key, value) { kvMap.set(qualify(key), String(value)) },
   async delete(key) { kvMap.delete(qualify(key)) },
  }
  return client
 }
 const rootKv = makeDeferredKv()

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
  crypto: { randomUUID: () => 'data-loading-uuid' },
  addEventListener() {},
 }
 const mockDocument = {
  body: createMockElement('body'),
  defaultView: mockWindow,
  createElement: createMockElement,
  addEventListener() {},
 }

 const origFetch = globalThis.fetch
 globalThis.fetch = async url => {
  if (url === '/src/lane-data.fs') return { text: async () => dataSource }
  if (url === '/src/confirm-modal.fs') return { text: async () => confirmModalSource }
  if (url === '/src/lane-row-picker-modal.fs') return { text: async () => rowPickerModalSource }
  throw new Error(`Unexpected fetch: ${url}`)
 }

 try {
  const f = field({
   ...DATA_RUNTIME_ENV,
   console: { log() {}, error() {}, warn() {} },
   data: rootKv,
   document: mockDocument,
   window: mockWindow,
  })
  const dataMod = await f.run(parse(dataSource, '/src/lane-data.fs'))
  const containerEl = createMockElement('div')
  const lane = {
   id: 'lane-load-test',
   title: 'Data Loading Lane',
   subroute: '',
   data: rootKv.namespace('lane-load-test'),
  }
  const mockLaneControl = {
   'confirm-modal': null,
   'row-picker-modal': null,
   'open-package-ids': [],
  }

  const mountPromise = dataMod.mount(lane, containerEl, mockLaneControl)
  await new Promise(resolve => setTimeout(resolve, 15))

  const rootEl = containerEl.children[0]
  assert.equal(rootEl.className, 'lane-data')
  const barEl = rootEl.children[0]
  const barActionsEl = barEl.children[1]
  const addTableBtn = barActionsEl.children[0]
  const importTableBtn = barActionsEl.children[1]
  const loadingEl = rootEl.children[1]
  const emptyEl = rootEl.children[2]
  const activeEl = rootEl.children[3]

  assert.equal(loadingEl.className, 'cc-loading')
  assert.equal(loadingEl.textContent, 'Loading tables…')
  assert.equal(loadingEl.hidden, false)
  assert.equal(emptyEl.className, 'lane-data-empty')
  assert.equal(emptyEl.hidden, true)
  assert.equal(activeEl.hidden, true)
  assert.equal(addTableBtn.disabled, true)
  assert.equal(importTableBtn.disabled, true)

  // Clicking disabled action handlers while loading is guarded and must not create a table
  await addTableBtn.listeners.click()
  assert.equal(activeEl.hidden, true)

  releaseLoad()
  const view = await mountPromise
  assert.equal(view['is-loading'], false)
  assert.equal(view['loading-el'].hidden, true)
  assert.equal(view['empty-el'].hidden, false)
  assert.equal(view['empty-el'].textContent, 'No tables yet. Create a table to define columns and add rows.')
  assert.equal(view['add-table-btn'].disabled, false)
  assert.equal(view['import-table-btn'].disabled, false)
 }
 finally {
  globalThis.fetch = origFetch
 }
})

test('table view & column filter helpers: operators across all column types, parsing, evaluation, bubble labels, view normalization, sanitization, and KV trigger exclusion', async () => {
 for (const colType of DATA_COLUMN_TYPES) {
  const scalarOps = getFilterOperatorsForColumn({ id: `col-${colType}`, name: colType, type: colType, multiple: false })
  assert.ok(scalarOps.some(o => o.op === 'has_value'), `${colType} missing has_value`)
  assert.ok(scalarOps.some(o => o.op === 'is_empty'), `${colType} missing is_empty`)
  const multiOps = getFilterOperatorsForColumn({ id: `col-${colType}-m`, name: colType, type: colType, multiple: true })
  assert.ok(multiOps.some(o => o.op === 'contains_item'), `${colType}[] missing contains_item`)
  assert.ok(multiOps.some(o => o.op === 'contains_all_of'), `${colType}[] missing contains_all_of`)
  assert.ok(multiOps.some(o => o.op === 'count_gte'), `${colType}[] missing count_gte`)
  assert.ok(multiOps.some(o => o.op === 'has_value'), `${colType}[] missing has_value`)
  assert.ok(multiOps.some(o => o.op === 'is_empty'), `${colType}[] missing is_empty`)
 }

 const wfTable = {
  id: 'tbl-wf',
  name: 'wf_transitions',
  columns: [
   { id: 'c-from', name: 'from', type: 'text', multiple: false },
   { id: 'c-to', name: 'to', type: 'text', multiple: false },
  ],
  rows: [
   { id: 'w1', values: { 'c-from': 'open', 'c-to': 'triage' } },
   { id: 'w2', values: { 'c-from': 'triage', 'c-to': 'closed' } },
  ],
 }
 const teamsTable = {
  id: 'tbl-teams',
  name: 'teams',
  columns: [
   { id: 'c-tkey', name: 'code', type: 'text', multiple: false },
   { id: 'c-tname', name: 'label', type: 'text', multiple: false },
  ],
  rows: [
   { id: 'tm1', values: { 'c-tkey': 'core', 'c-tname': 'Core Platform' } },
   { id: 'tm2', values: { 'c-tkey': 'ui', 'c-tname': 'Design Systems' } },
  ],
 }
 const issuesTable = {
  id: 'tbl-issues',
  name: 'issues',
  columns: [
   { id: 'c-title', name: 'title', type: 'text', multiple: false },
   { id: 'c-status', name: 'status', type: 'text', multiple: false, constraint: { type: 'workflow', tableId: 'tbl-wf', fromColumnId: 'c-from', toColumnId: 'c-to' } },
   { id: 'c-prio', name: 'priority', type: 'integer', multiple: false },
   { id: 'c-budget', name: 'budget', type: 'fixed', decimals: 2, multiple: false },
   { id: 'c-weight', name: 'weight', type: 'decimal', multiple: false },
   { id: 'c-done', name: 'done', type: 'boolean', multiple: false },
   { id: 'c-due', name: 'due', type: 'date', multiple: false },
   { id: 'c-ts', name: 'created', type: 'datetime', multiple: false },
   { id: 'c-url', name: 'link', type: 'url', multiple: false },
   { id: 'c-mail', name: 'contact', type: 'email', multiple: false },
   { id: 'c-meta', name: 'meta', type: 'json', multiple: false },
   { id: 'c-team', name: 'team', type: 'row', multiple: false, refTableId: 'tbl-teams', refColumnId: 'c-tkey', refDisplayColumnId: 'c-tname' },
   { id: 'c-parent', name: 'parent', type: 'row', multiple: false, refTableId: '$self', refColumnId: 'c-title', refDisplayColumnId: 'c-title' },
   { id: 'c-owner', name: 'owner', type: 'lane', multiple: false },
   { id: 'c-tags', name: 'tags', type: 'text', multiple: true },
  ],
  rows: [
   {
    id: 'r1',
    values: {
     'c-title': 'Auth token leak',
     'c-status': 'open',
     'c-prio': 0,
     'c-budget': 1250,
     'c-weight': 3.5,
     'c-done': false,
     'c-due': '2026-05-08',
     'c-ts': '2026-05-08T10:00:00.000Z',
     'c-url': 'https://sec.example.com/1',
     'c-mail': 'sec@example.com',
     'c-meta': { severity: 'sev1', owner: 'ops' },
     'c-team': 'core',
     'c-parent': '',
     'c-owner': 'lane-a',
     'c-tags': ['security', 'urgent'],
    },
   },
   {
    id: 'r2',
    values: {
     'c-title': 'Button alignment',
     'c-status': 'triage',
     'c-prio': 3,
     'c-budget': 5000,
     'c-weight': 1.25,
     'c-done': true,
     'c-due': '2026-05-10',
     'c-ts': '2026-05-10T12:00:00.000Z',
     'c-url': 'https://ui.example.com/2',
     'c-mail': 'ui@example.com',
     'c-meta': { component: 'button' },
     'c-team': 'ui',
     'c-parent': 'Auth token leak',
     'c-owner': 'lane-b',
     'c-tags': ['ui'],
    },
   },
   {
    id: 'r3',
    values: {
     'c-title': 'Auth Audit Queue',
     'c-status': 'closed',
     'c-prio': null,
     'c-budget': null,
     'c-weight': null,
     'c-done': false,
     'c-due': '2026-05-13',
     'c-ts': '2026-05-13T18:30:00.000Z',
     'c-url': '',
     'c-mail': '',
     'c-meta': null,
     'c-team': 'core',
     'c-parent': 'Auth token leak',
     'c-owner': 'lane-a',
     'c-tags': [],
    },
   },
  ],
 }
 const allTables = [wfTable, teamsTable, issuesTable]
 const colById = Object.fromEntries(issuesTable.columns.map(c => [c.id, c]))
 const nowMs = Date.UTC(2026, 4, 10, 14, 0, 0) // 2026-05-10T14:00:00Z
 const evalOpts = {
  tables: allTables,
  ownerTable: issuesTable,
  displayOpts: { timeZone: 'UTC', hourFormat: '24h' },
  lookupLaneTitle: id => (id === 'lane-a' ? 'Security Lane' : id),
  nowMs,
 }

 // Parsing, validation, reversed bounds normalization, and round-trip edit formatting
 assert.equal(parseTableFilterInput(colById['c-title'], 'matches_regex', '[bad').ok, false)
 const regexParsed = parseTableFilterInput(colById['c-title'], 'matches_regex', '/^auth/i')
 assert.equal(regexParsed.ok, true)
 const numRangeParsed = parseTableFilterInput(colById['c-budget'], 'between', '50.00', '10.00')
 assert.deepEqual(numRangeParsed, { ok: true, operator: 'between', value: 1000, valueTo: 5000, hasValue: true, error: null })
 assert.deepEqual(formatTableFilterInputValues({ operator: 'between', value: 1000, valueTo: 5000 }, colById['c-budget']), {
  value: '10.00',
  valueTo: '50.00',
 })
 const dateRangeParsed = parseTableFilterInput(colById['c-due'], 'between', '2026-05-12', '2026-05-07')
 assert.deepEqual(dateRangeParsed, { ok: true, operator: 'between', value: '2026-05-07', valueTo: '2026-05-12', hasValue: true, error: null })
 const selfParentParsed = parseTableFilterInput(colById['c-parent'], 'is', 'Auth token leak', undefined, evalOpts)
 assert.deepEqual(selfParentParsed, { ok: true, operator: 'is', value: 'Auth token leak', valueTo: undefined, hasValue: true, error: null })

 // Evaluate every operator category
 const filterIds = filters => filterTableRows(issuesTable, filters, evalOpts).matchedEntries.map(e => ({ id: e.row.id, num: e.rowNumber }))
 assert.deepEqual(filterIds([{ id: 'f1', columnId: 'c-title', operator: 'contains', value: 'auth' }]), [
  { id: 'r1', num: 1 },
  { id: 'r3', num: 3 },
 ])
 assert.deepEqual(filterIds([{ id: 'f1', columnId: 'c-title', operator: 'matches_regex', value: '/queue$/i' }]), [{ id: 'r3', num: 3 }])
 assert.deepEqual(filterIds([{ id: 'f1', columnId: 'c-status', operator: 'is_any_of', value: ['open', 'closed'] }]), [
  { id: 'r1', num: 1 },
  { id: 'r3', num: 3 },
 ])
 assert.deepEqual(filterIds([{ id: 'f1', columnId: 'c-prio', operator: 'has_value' }]), [
  { id: 'r1', num: 1 },
  { id: 'r2', num: 2 },
 ])
 assert.deepEqual(filterIds([{ id: 'f1', columnId: 'c-prio', operator: 'is_empty' }]), [{ id: 'r3', num: 3 }])
 assert.deepEqual(filterIds([{ id: 'f1', columnId: 'c-done', operator: 'is_true' }]), [{ id: 'r2', num: 2 }])
 assert.deepEqual(filterIds([{ id: 'f1', columnId: 'c-done', operator: 'is_false' }]), [
  { id: 'r1', num: 1 },
  { id: 'r3', num: 3 },
 ])
 assert.deepEqual(filterIds([{ id: 'f1', columnId: 'c-due', operator: 'between', value: '2026-05-07', valueTo: '2026-05-10' }]), [
  { id: 'r1', num: 1 },
  { id: 'r2', num: 2 },
 ])
 assert.deepEqual(filterIds([{ id: 'f1', columnId: 'c-due', operator: 'after', value: '2026-05-10' }]), [{ id: 'r3', num: 3 }])
 assert.deepEqual(filterIds([{ id: 'f1', columnId: 'c-due', operator: 'before', value: '2026-05-10' }]), [{ id: 'r1', num: 1 }])
 assert.deepEqual(filterIds([{ id: 'f1', columnId: 'c-due', operator: 'is_today' }]), [{ id: 'r2', num: 2 }])
 assert.deepEqual(filterIds([{ id: 'f1', columnId: 'c-due', operator: 'in_last_days', value: 2 }]), [
  { id: 'r1', num: 1 },
  { id: 'r2', num: 2 },
 ])
 assert.deepEqual(filterIds([{ id: 'f1', columnId: 'c-due', operator: 'in_next_days', value: 3 }]), [
  { id: 'r2', num: 2 },
  { id: 'r3', num: 3 },
 ])
 assert.deepEqual(filterIds([{ id: 'f1', columnId: 'c-ts', operator: 'after', value: '2026-05-10T11:00:00.000Z' }]), [
  { id: 'r2', num: 2 },
  { id: 'r3', num: 3 },
 ])
 assert.deepEqual(filterIds([{ id: 'f1', columnId: 'c-meta', operator: 'has_key', value: 'severity' }]), [{ id: 'r1', num: 1 }])
 assert.deepEqual(filterIds([{ id: 'f1', columnId: 'c-team', operator: 'is', value: 'core' }]), [
  { id: 'r1', num: 1 },
  { id: 'r3', num: 3 },
 ])
 assert.deepEqual(filterIds([{ id: 'f1', columnId: 'c-parent', operator: 'is', value: 'Auth token leak' }]), [
  { id: 'r2', num: 2 },
  { id: 'r3', num: 3 },
 ])
 assert.deepEqual(filterIds([{ id: 'f1', columnId: 'c-owner', operator: 'contains', value: 'Security Lane' }]), [
  { id: 'r1', num: 1 },
  { id: 'r3', num: 3 },
 ])
 assert.deepEqual(filterIds([{ id: 'f1', columnId: 'c-tags', operator: 'contains_all_of', value: ['security', 'urgent'] }]), [{ id: 'r1', num: 1 }])
 assert.deepEqual(filterIds([{ id: 'f1', columnId: 'c-tags', operator: 'count_gte', value: 1 }]), [
  { id: 'r1', num: 1 },
  { id: 'r2', num: 2 },
 ])

 // Pinned row remains visible even when filter wouldn't match it
 const pinnedRes = filterTableRows(issuesTable, [{ id: 'f1', columnId: 'c-prio', operator: 'eq', value: 3 }], {
  ...evalOpts,
  pinnedRowIds: ['r1'],
 })
 assert.deepEqual(pinnedRes.matchedEntries.map(e => ({ id: e.row.id, num: e.rowNumber })), [
  { id: 'r1', num: 1 },
  { id: 'r2', num: 2 },
 ])

 // Bubble formatting
 assert.equal(formatTableFilterBubbleLabel({ operator: 'contains', value: 'auth' }, colById['c-title'], evalOpts), 'contains "auth"')
 assert.equal(formatTableFilterBubbleLabel({ operator: 'between', value: '2026-05-07', valueTo: '2026-05-12' }, colById['c-due'], evalOpts), '2026-05-07 – 2026-05-12')
 assert.equal(formatTableFilterBubbleLabel({ operator: 'in_last_days', value: 7 }, colById['c-due'], evalOpts), 'last 7d')
 assert.equal(formatTableFilterBubbleLabel({ operator: 'has_value' }, colById['c-due'], evalOpts), 'has value')
 assert.equal(formatTableFilterBubbleLabel({ operator: 'is', value: 'core' }, colById['c-team'], evalOpts), 'is Core Platform')
 assert.equal(formatTableFilterBubbleLabel({ operator: 'is', value: 'lane-a' }, colById['c-owner'], evalOpts), 'is Security Lane')

 // View record normalization, display naming, sanitization & KV round-trip without triggers
 const normRec = normalizeTableViewsRecord({
  activeViewId: 'v-sec',
  views: [
   { id: DEFAULT_TABLE_VIEW_ID, isDefault: true, filters: [{ id: 'f0', columnId: 'c-title', operator: 'has_value' }] },
   { id: 'v-sec', name: 'Security', filters: [{ id: 'f1', columnId: 'c-team', operator: 'is', value: 'core' }] },
  ],
 }, issuesTable.columns, allTables)
 assert.equal(resolveTableViewDisplayName(normRec.views[0], issuesTable, 0), 'issues')
 assert.equal(resolveTableViewDisplayName(normRec.views[1], issuesTable, 0), 'Security')
 assert.equal(buildUniqueTableViewName(normRec.views, 'issues', issuesTable, 0), 'issues 2')

 const sanitized = sanitizeTableViewsForColumns({
  activeViewId: 'v-sec',
  views: [
   { id: DEFAULT_TABLE_VIEW_ID, isDefault: true, filters: [{ id: 'f-dead', columnId: 'c-deleted', operator: 'has_value' }] },
   { id: 'v-sec', name: 'Security', filters: [{ id: 'f1', columnId: 'c-team', operator: 'is', value: 'core' }] },
  ],
  workingFilters: [{ id: 'f-dead', columnId: 'c-deleted', operator: 'has_value' }],
 }, issuesTable.columns, allTables)
 assert.equal(sanitized.savedChanged, true)
 assert.equal(sanitized.views[0].filters.length, 0)
 assert.equal(sanitized.views[1].filters.length, 1)
 assert.equal(sanitized.workingFilters.length, 0)
 assert.equal(tableViewFiltersEqual(normRec.views[1].filters, sanitized.views[1].filters), true)

 const kvMap = new Map()
 const kv = {
  namespace() { return kv },
  async get(k) { return kvMap.has(k) ? kvMap.get(k) : null },
  async set(k, v) { kvMap.set(k, String(v)) },
  async delete(k) { kvMap.delete(k) },
 }
 const viewsKey = tableViewsKey('lane-1', 'tbl-issues')
 assert.equal(viewsKey, 'lanes#lane-1/tables/tbl-issues/views')
 assert.equal(isTriggerExcludedKey(viewsKey), true)
 assert.deepEqual(resolveMatchingTriggerTargets(viewsKey), [])

 await saveTableViews(kv, kv, 'lane-1', 'tbl-issues', normRec, issuesTable.columns, allTables)
 assert.equal(kvMap.has(viewsKey), true)
 const loadedViews = await loadTableViews(kv, kv, 'lane-1', 'tbl-issues', issuesTable.columns, allTables)
 assert.deepEqual(loadedViews, normRec)

 // Saving default clean view with no filters removes the KV key cleanly
 await saveTableViews(kv, kv, 'lane-1', 'tbl-issues', { activeViewId: DEFAULT_TABLE_VIEW_ID, views: [{ id: DEFAULT_TABLE_VIEW_ID, isDefault: true, filters: [] }] }, issuesTable.columns, allTables)
 assert.equal(kvMap.has(viewsKey), false)
})

test('Data tab table views & column filters UI: View selector popover, Edit table rename, Filters row funnel + dotted + + wrapping bubbles, Unsaved filters Save/Fork/Abandon, and reload persistence', async () => {
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

 function createMockElement(tagName) {
  return {
   tag: tagName,
   tagName: String(tagName || '').toLowerCase(),
   nodeType: 1,
   style: { setProperty() {}, removeProperty() {}, getPropertyValue() { return '' } },
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
   readOnly: false,
   focused: false,
   removed: false,
   rect: { top: 24, left: 0, width: 640, height: 480 },
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
    this.children = []
    for (const n of nodes) this.appendChild(n)
   },
   addEventListener(event, handler) { this.listeners[event] = handler },
   focus() { this.focused = true },
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
 const localStore = new Map()
 const sessionStore = new Map()
 const makeStorage = m => ({
  getItem: k => (m.has(k) ? m.get(k) : null),
  setItem: (k, v) => m.set(k, String(v)),
  removeItem: k => m.delete(k),
 })

 let uuid = 0
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

 const bootApp = async (initialPathname = '/') => {
  const windowListeners = {}
  const documentListeners = {}
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
   innerHeight: 900,
   innerWidth: 1440,
   localStorage: makeStorage(localStore),
   sessionStorage: makeStorage(sessionStore),
   location: { pathname: initialPathname, search: '', hash: '' },
   history: {
    pushState(_s, _t, url) {
     if (typeof url === 'string') mockWindow.location.pathname = url.split('?')[0].split('#')[0] || '/'
    },
    replaceState(_s, _t, url) {
     if (typeof url === 'string') mockWindow.location.pathname = url.split('?')[0].split('#')[0] || '/'
    },
   },
   crypto: { randomUUID: () => `vw-uuid-${++uuid}` },
   setTimeout: () => 1,
   clearTimeout() {},
   addEventListener(event, handler) {
    windowListeners[event] ||= []
    windowListeners[event].push(handler)
   },
   removeEventListener() {},
  }
  const mockDocument = {
   body: createMockElement('body'),
   documentElement: createMockElement('html'),
   defaultView: mockWindow,
   activeElement: null,
   createElement: createMockElement,
   addEventListener(event, handler) {
    documentListeners[event] ||= []
    documentListeners[event].push(handler)
   },
  }
  const f = field({
   ...DATA_RUNTIME_ENV,
   console: { log() {} },
   createIdleTracker,
   data: defaultRootKv,
   defaultValueForType,
   document: mockDocument,
   formatImportLine,
   hasImportCycle,
   history: mockWindow.history,
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
  return {
   f,
   mockWindow,
   mockDocument,
   async dispatchWindow(event, ev) {
    for (const h of windowListeners[event] || []) await h(ev)
   },
   async dispatchDocument(event, ev) {
    for (const h of documentListeners[event] || []) await h(ev)
   },
  }
 }

 try {
  const app1 = await bootApp('/')
  const lc1 = app1.f.state['lane-control']
  await lc1['confirm-session-data-dir'](null)
  const lane1 = await lc1.add()
  await lane1.notebook['set-tab']('data')
  const dv = lane1.notebook['data-view']

  // Create "issues" table: header defaults to View selector showing table name ("issues")
  const issuesTbl = await dv['add-table']('issues')
  assert.equal(dv['view-wrap'].hidden, false)
  assert.equal(dv['edit-table-modal']['is-open'], false)
  assert.equal(dv['view-name-el'].textContent, 'issues')
  assert.equal(dv['view-count-badge'].hidden, true)
  assert.equal(dv['view-dirty-badge'].hidden, true)

  // Open ⋯ -> Edit table opens dedicated Edit Table modal without hiding View selector; Cancel discards edits
  await dv['table-menu-btn'].listeners.click({})
  assert.equal(dv['table-menu'].hidden, false)
  assert.equal(dv['edit-table-btn'].textContent, 'Edit table')
  await dv['edit-table-btn'].listeners.click({})
  assert.equal(dv['table-menu'].hidden, true)
  assert.equal(dv['view-wrap'].hidden, false)
  assert.equal(dv['edit-table-modal']['is-open'], true)
  assert.equal(dv['edit-table-modal'].heading.textContent, 'Edit Table')
  assert.equal(dv['edit-table-modal']['name-input'].value, 'issues')
  dv['edit-table-modal']['name-input'].value = 'discard_me'
  await dv['edit-table-modal']['cancel-btn'].listeners.click({})
  assert.equal(dv['edit-table-modal']['is-open'], false)
  assert.equal(dv.tables[0].name, 'issues')
  assert.equal(dv['view-name-el'].textContent, 'issues')

  // Open Edit Table modal, validate empty guard, then rename to "bugs" -> Save changes -> rename back to "issues"
  await dv['open-edit-table-modal']()
  assert.equal(dv['view-wrap'].hidden, false)
  dv['edit-table-modal']['name-input'].value = '   '
  await dv['edit-table-modal']['save-btn'].listeners.click({})
  assert.equal(dv['edit-table-modal']['is-open'], true)
  assert.equal(dv['edit-table-modal']['error-el'].hidden, false)
  dv['edit-table-modal']['name-input'].value = 'bugs'
  await dv['edit-table-modal']['name-input'].listeners.input()
  assert.equal(dv['edit-table-modal']['error-el'].hidden, true)
  await dv['edit-table-modal']['save-btn'].listeners.click({})
  assert.equal(dv['edit-table-modal']['is-open'], false)
  assert.equal(dv['view-wrap'].hidden, false)
  assert.equal(dv['table-tabs'][0]['label-el'].textContent, 'bugs')
  assert.equal(dv['view-name-el'].textContent, 'bugs')

  await dv['open-edit-table-modal']()
  dv['edit-table-modal']['name-input'].value = 'issues'
  await dv['edit-table-modal']['save-btn'].listeners.click({})
  assert.equal(dv['view-name-el'].textContent, 'issues')

  // Add typed columns: title (text), priority (integer), opened (date), tags (text[]), triaged (boolean)
  await dv['add-col-btn'].listeners.click()
  dv['schema-rows'][0]['name-el'].value = 'title'
  await dv['schema-rows'][0]['name-el'].listeners.input()

  await dv['add-col-btn'].listeners.click()
  dv['schema-rows'][1]['name-el'].value = 'priority'
  await dv['schema-rows'][1]['name-el'].listeners.input()
  dv['schema-rows'][1]['type-el'].value = 'integer'
  await dv['schema-rows'][1]['type-el'].listeners.change()

  await dv['add-col-btn'].listeners.click()
  dv['schema-rows'][2]['name-el'].value = 'opened'
  await dv['schema-rows'][2]['name-el'].listeners.input()
  dv['schema-rows'][2]['type-el'].value = 'date'
  await dv['schema-rows'][2]['type-el'].listeners.change()

  await dv['add-col-btn'].listeners.click()
  dv['schema-rows'][3]['name-el'].value = 'tags'
  await dv['schema-rows'][3]['name-el'].listeners.input()
  await dv['schema-rows'][3]['multi-btn'].listeners.click()

  await dv['add-col-btn'].listeners.click()
  dv['schema-rows'][4]['name-el'].value = 'triaged'
  await dv['schema-rows'][4]['name-el'].listeners.input()
  dv['schema-rows'][4]['type-el'].value = 'boolean'
  await dv['schema-rows'][4]['type-el'].listeners.change()

  // Seed 4 rows
  const seedRows = [
   { title: 'Auth token expiry', prio: '1', opened: '2026-01-15', tags: ['auth', 'p0'], triaged: true },
   { title: 'Button spacing', prio: '3', opened: '2026-02-10', tags: ['ui'], triaged: false },
   { title: 'Auth redirect loop', prio: '2', opened: '2026-03-05', tags: ['auth', 'backend'], triaged: true },
   { title: 'Footer alignment', prio: '4', opened: '2026-04-20', tags: ['ui'], triaged: true },
  ]
  for (let i = 0; i < seedRows.length; i++) {
   const spec = seedRows[i]
   const rObj = await dv['add-row']()
   const grow = dv['grid-rows'][i]
   grow.cells[0]['input-el'].value = spec.title
   await grow.cells[0]['input-el'].listeners.input()
   grow.cells[1]['input-el'].value = spec.prio
   await grow.cells[1]['input-el'].listeners.input()
   grow.cells[2]['input-el'].value = spec.opened
   await grow.cells[2]['input-el'].listeners.change()
   for (let ti = 0; ti < spec.tags.length; ti++) {
    await grow.cells[3]['add-btn'].listeners.click()
    const itemInput = dv['grid-rows'][i].cells[3].items[ti]['input-el']
    itemInput.value = spec.tags[ti]
    await itemInput.listeners.input()
   }
   grow.cells[4]['input-el'].checked = spec.triaged
   await grow.cells[4]['input-el'].listeners.change()
   assert.equal(rObj.id.length > 0, true)
  }

  // Verify 3-row thead: grid-hrow (names), grid-trow (types), grid-frow (filters with funnel SVG and dotted '+' buttons)
  assert.equal(dv['grid-hrow'].parentNode.children[0], dv['grid-hrow'])
  assert.equal(dv['grid-hrow'].parentNode.children[1], dv['grid-trow'])
  assert.equal(dv['grid-hrow'].parentNode.children[2], dv['grid-frow'])
  assert.equal(dv['grid-filter-cells'].length, 7) // num + 5 cols + actions
  assert.equal(dv['grid-filter-cells'][0].kind, 'num')
  assert.match(dv['grid-filter-cells'][0].el.innerHTML, /<svg class="lane-data-filter-funnel-icon"/)
  assert.equal(dv['grid-filter-cells'][1]['wrap-el'].className, 'lane-data-filter-cell')
  assert.equal(dv['grid-filter-cells'][1]['add-btn'].className, 'lane-data-filter-add-btn')
  assert.equal(dv['grid-filter-cells'][1]['add-btn'].textContent, '+')

  // Add filter via '+' under title column ("contains auth")
  await dv['grid-filter-cells'][1]['add-btn'].listeners.click({})
  assert.equal(dv['filter-editor'].open, true)
  assert.equal(dv['filter-menu'].hidden, false)
  assert.equal(dv['filter-menu-col-name'].textContent, 'title')
  assert.equal(dv['filter-op-select'].value, 'contains')
  dv['filter-val-el'].value = 'auth'
  await dv['filter-apply-btn'].listeners.click()
  assert.equal(dv['filter-editor'].open, false)
  assert.equal(dv['filter-menu'].hidden, true)

  // View shows 2 matching rows with real row numbers 1 & 3, and notebook scope still sees all 4 rows
  assert.equal(dv['rows-title'].textContent, 'Rows (2 of 4)')
  assert.equal(dv['grid-rows'].length, 2)
  assert.deepEqual(dv['grid-rows'].map(gr => gr['num-el'].textContent), [1, 3])
  assert.equal(dv['grid-filter-cells'][1].chips.length, 1)
  assert.equal(dv['grid-filter-cells'][1].chips[0]['label-el'].textContent, 'contains "auth"')
  const nbScope = dv['seed-env'](Object.create(null))
  assert.equal(nbScope.issues.length, 4)

  // Unsaved filters state surfaced on button + View popover (with Save / Fork / Abandon, New view disabled)
  assert.equal(dv['view-count-badge'].hidden, false)
  assert.equal(dv['view-count-badge'].textContent, '1')
  assert.equal(dv['view-dirty-badge'].hidden, false)
  assert.equal(dv['view-dirty-badge'].textContent, 'Unsaved filters')
  await dv['view-btn'].listeners.click({})
  assert.equal(dv['view-menu-open'], true)
  assert.equal(dv['view-menu'].hidden, false)
  assert.equal(dv['view-draft-row'].hidden, false)
  assert.equal(dv['view-new-btn'].disabled, true)
  assert.equal(dv['view-delete-btn'].disabled, true)

  // Click filter bubble to edit operator/value -> Invalid input shows inline error, valid Update updates filter
  await dv['grid-filter-cells'][1].chips[0]['label-el'].listeners.click({})
  assert.equal(dv['filter-editor'].mode, 'edit')
  assert.equal(dv['filter-apply-btn'].textContent, 'Update filter')
  assert.equal(dv['filter-delete-btn'].hidden, false)
  dv['filter-op-select'].value = 'matches_regex'
  await dv['filter-op-select'].listeners.change()
  dv['filter-val-el'].value = '[unclosed'
  await dv['filter-apply-btn'].listeners.click()
  assert.equal(dv['filter-error-el'].hidden, false)
  assert.equal(dv['filter-editor'].open, true)
  dv['filter-val-el'].value = 'expiry'
  dv['filter-op-select'].value = 'contains'
  await dv['filter-op-select'].listeners.change()
  await dv['filter-apply-btn'].listeners.click()
  assert.equal(dv['filter-editor'].open, false)
  assert.equal(dv['rows-title'].textContent, 'Rows (1 of 4)')

  // Adding a new row while filtered pins it visible in grid-rows
  const pinnedAdded = await dv['add-row']()
  assert.equal(dv['grid-rows'].length, 2)
  assert.equal(dv['grid-rows'][1].row.id, pinnedAdded.id)

  // Delete newly pinned empty row so counts stay clean, then Abandon changes
  await dv['grid-rows'][1]['remove-btn'].listeners.click()
  await dv['confirm-modal']['confirm-btn'].listeners.click()
  assert.equal(dv['tables'][0].rows.length, 4)

  await dv['view-btn'].listeners.click({})
  await dv['view-abandon-btn'].listeners.click()
  assert.equal(dv['view-dirty-badge'].hidden, true)
  assert.equal(dv['view-count-badge'].hidden, true)
  assert.equal(dv['rows-title'].textContent, 'Rows (4)')
  assert.equal(dv['grid-rows'].length, 4)

  // Add multiple column filters (text + date range + boolean has_value) and Save view on default view
  await dv['grid-filter-cells'][1]['add-btn'].listeners.click({})
  dv['filter-val-el'].value = 'auth'
  await dv['filter-apply-btn'].listeners.click()
  await dv['grid-filter-cells'][3]['add-btn'].listeners.click({})
  dv['filter-op-select'].value = 'between'
  await dv['filter-op-select'].listeners.change()
  dv['filter-val-el'].value = '2026-01-01'
  dv['filter-val-to-el'].value = '2026-02-28'
  await dv['filter-apply-btn'].listeners.click()
  await dv['grid-filter-cells'][5]['add-btn'].listeners.click({})
  dv['filter-op-select'].value = 'is_true'
  await dv['filter-op-select'].listeners.change()
  assert.equal(dv['filter-value-wrap'].hidden, true)
  await dv['filter-apply-btn'].listeners.click()
  assert.equal(dv['rows-title'].textContent, 'Rows (1 of 4)')
  assert.equal(dv['grid-rows'].map(r => r.row.id).length, 1)

  await dv['view-btn'].listeners.click({})
  await dv['view-save-btn'].listeners.click()
  assert.equal(dv['view-dirty-badge'].hidden, true)
  assert.equal(dv['view-draft-row'].hidden, true)
  assert.equal(dv['view-new-btn'].disabled, false)

  // Modify filters (remove date range via quick '×' remove button) -> dirty again -> Fork view
  await dv['grid-filter-cells'][3].chips[0]['remove-el'].listeners.click({})
  assert.equal(dv['rows-title'].textContent, 'Rows (2 of 4)')
  assert.equal(dv['view-dirty-badge'].hidden, false)
  await dv['view-btn'].listeners.click({})
  // Switching back to original saved view is locked while Unsaved filters exist
  assert.equal(dv['view-option-els'].length, 1)
  await dv['view-fork-btn'].listeners.click()
  assert.equal(dv['view-dirty-badge'].hidden, true)
  assert.equal(dv['view-name-el'].textContent, 'issues copy')
  assert.equal(dv['view-option-els'].length, 2)
  assert.equal(dv['view-title-btn'].hidden, false)
  assert.equal(dv['view-title-text'].textContent, 'issues copy')
  assert.equal(dv['view-rename-row'].hidden, true)

  // Click custom view header -> swaps to input/Save/Cancel; Cancel exits without renaming
  await dv['view-title-btn'].listeners.click({})
  assert.equal(dv['view-title-btn'].hidden, true)
  assert.equal(dv['view-rename-row'].hidden, false)
  assert.equal(dv['editing-view-name'], true)
  dv['view-rename-input'].value = 'Temporary'
  await dv['view-rename-cancel-btn'].listeners.click({})
  assert.equal(dv['editing-view-name'], false)
  assert.equal(dv['view-title-btn'].hidden, false)
  assert.equal(dv['view-rename-row'].hidden, true)
  assert.equal(dv['view-name-el'].textContent, 'issues copy')

  // Click header again, rename forked custom view to "Auth all dates", Save, then test Duplicate, Reset, Delete
  await dv['view-title-btn'].listeners.click({})
  dv['view-rename-input'].value = 'Auth all dates'
  await dv['view-rename-btn'].listeners.click()
  assert.equal(dv['editing-view-name'], false)
  assert.equal(dv['view-title-btn'].hidden, false)
  assert.equal(dv['view-title-text'].textContent, 'Auth all dates')
  assert.equal(dv['view-rename-row'].hidden, true)
  assert.equal(dv['view-name-el'].textContent, 'Auth all dates')

  // Duplicate -> "Auth all dates copy", Reset -> clears filters -> Abandon restores, then Delete custom view
  await dv['view-duplicate-btn'].listeners.click()
  assert.equal(dv['view-name-el'].textContent, 'Auth all dates copy')
  assert.equal(dv['view-option-els'].length, 3)
  await dv['view-reset-btn'].listeners.click()
  assert.equal(dv['rows-title'].textContent, 'Rows (4)')
  assert.equal(dv['view-dirty-badge'].hidden, false)
  // While 2+ views exist and working filters are dirty, switching to another view is disabled
  assert.equal(dv['view-option-els'][0].el.disabled, true)
  assert.equal(dv['view-new-btn'].disabled, true)
  await dv['view-abandon-btn'].listeners.click()
  assert.equal(dv['rows-title'].textContent, 'Rows (2 of 4)')
  await dv['view-delete-btn'].listeners.click()
  assert.equal(dv['confirm-modal']['is-open'], true)
  await dv['confirm-modal']['confirm-btn'].listeners.click()
  assert.equal(dv['view-option-els'].length, 2)

  // New view creates a blank custom view; Escape closes open popovers
  await dv['view-btn'].listeners.click({})
  assert.equal(dv['view-new-btn'].disabled, false)
  await dv['view-new-btn'].listeners.click()
  assert.equal(dv['view-name-el'].textContent, 'View')
  assert.equal(dv['rows-title'].textContent, 'Rows (4)')
  await app1.dispatchWindow('keydown', { key: 'Escape' })
  assert.equal(dv['view-menu-open'], false)
  assert.equal(dv['view-menu'].hidden, true)
  await dv['view-delete-btn'].listeners.click()
  await dv['confirm-modal']['confirm-btn'].listeners.click()
  assert.equal(dv['view-option-els'].length, 2)

  // Select "Auth all dates" and verify original default view retained all 3 filters untouched
  await dv['view-btn'].listeners.click({})
  const authOpt = dv['view-option-els'].find(o => o.el.children[0].textContent === 'Auth all dates')
  assert.ok(authOpt)
  await authOpt.el.listeners.click({})
  assert.equal(dv['view-name-el'].textContent, 'Auth all dates')
  assert.equal(dv['rows-title'].textContent, 'Rows (2 of 4)')

  // Reload fresh browser instance against same defaultRootKv and verify saved views & filters persist
  const savedPathname = app1.mockWindow.location.pathname
  const app2 = await bootApp(savedPathname)
  const laneReloaded = app2.f.state.lanes[0]
  const dv2 = laneReloaded.notebook['data-view']
  assert.equal(dv2.tables[0].id, issuesTbl.id)
  assert.equal(dv2['view-name-el'].textContent, 'Auth all dates')
  assert.equal(dv2['view-dirty-badge'].hidden, true)
  assert.equal(dv2['view-count-badge'].textContent, '2')
  assert.equal(dv2['rows-title'].textContent, 'Rows (2 of 4)')
  assert.deepEqual(dv2['grid-rows'].map(gr => gr['num-el'].textContent), [1, 3])
  await dv2['view-btn'].listeners.click({})
  assert.equal(dv2['view-option-els'].length, 2)
  await dv2['view-option-els'][0].el.listeners.click({})
  assert.equal(dv2['view-name-el'].textContent, 'issues')
  assert.equal(dv2['rows-title'].textContent, 'Rows (1 of 4)')
 }
 finally {
  globalThis.fetch = origFetch
 }
})

test('Custom numeric cell inputs: zero type="number" spin arrows, strict format validation, dark-mode error highlighting, blur normalization, and Schema/RowPicker coverage', async () => {
 // 1. Unit tests for parseNumericCellInput & parseFixedDecimalsInput
 assert.deepEqual(parseNumericCellInput('0', 'integer'), { ok: true, value: 0, error: null })
 assert.deepEqual(parseNumericCellInput('42', 'integer'), { ok: true, value: 42, error: null })
 assert.deepEqual(parseNumericCellInput('-7', 'integer'), { ok: true, value: -7, error: null })
 assert.deepEqual(parseNumericCellInput('+12', 'integer'), { ok: true, value: 12, error: null })
 assert.strictEqual(Object.is(parseNumericCellInput('-0', 'integer').value, 0), true)
 assert.deepEqual(parseNumericCellInput('', 'integer'), { ok: true, value: null, error: null })
 for (const badInt of ['2.5', '2.', '.5', '1e3', '1e', '0x10', 'abc', '12a', '-', '+', '--5', '1,000', ' 42', '42 ', '   ', '9007199254740992']) {
  assert.equal(parseNumericCellInput(badInt, 'integer').ok, false, `integer should reject ${JSON.stringify(badInt)}`)
 }

 assert.deepEqual(parseNumericCellInput('0', 'decimal'), { ok: true, value: 0, error: null })
 assert.deepEqual(parseNumericCellInput('234.55', 'decimal'), { ok: true, value: 234.55, error: null })
 assert.deepEqual(parseNumericCellInput('-0.25', 'decimal'), { ok: true, value: -0.25, error: null })
 assert.deepEqual(parseNumericCellInput('.5', 'decimal'), { ok: true, value: 0.5, error: null })
 assert.deepEqual(parseNumericCellInput('5.', 'decimal'), { ok: true, value: 5, error: null })
 assert.strictEqual(Object.is(parseNumericCellInput('-0.0', 'decimal').value, 0), true)
 assert.deepEqual(parseNumericCellInput('', 'decimal'), { ok: true, value: null, error: null })
 for (const badDec of ['1e5', '1e-2', '0x10', '0b10', '0o10', 'Infinity', 'NaN', '1.2.3', '.', '-', '-.', '12abc', ' 1.5', '1.5 ', '   ']) {
  assert.equal(parseNumericCellInput(badDec, 'decimal').ok, false, `decimal should reject ${JSON.stringify(badDec)}`)
  assert.equal(parseCellValue(badDec, 'decimal').ok, [' 1.5', '1.5 ', '   '].includes(badDec), `parseCellValue decimal check for ${JSON.stringify(badDec)}`)
 }

 assert.deepEqual(parseNumericCellInput('12.34', 'fixed'), { ok: true, value: 1234, error: null })
 assert.deepEqual(parseNumericCellInput('5', 'fixed'), { ok: true, value: 500, error: null })
 assert.deepEqual(parseNumericCellInput('-0.05', 'fixed'), { ok: true, value: -5, error: null })
 assert.deepEqual(parseNumericCellInput('', 'fixed'), { ok: true, value: null, error: null })
 for (const badFix of ['12.345', '1e2', ' 12.34', '12.34 ', 'abc']) {
  assert.equal(parseNumericCellInput(badFix, 'fixed').ok, false, `fixed should reject ${JSON.stringify(badFix)}`)
 }

 assert.deepEqual(parseFixedDecimalsInput('0'), { ok: true, value: 0, error: null })
 assert.deepEqual(parseFixedDecimalsInput('2'), { ok: true, value: 2, error: null })
 assert.deepEqual(parseFixedDecimalsInput('12'), { ok: true, value: 12, error: null })
 for (const badDp of ['', '-1', '13', '2.5', ' 2', '2 ', 'abc']) {
  assert.equal(parseFixedDecimalsInput(badDp).ok, false, `parseFixedDecimalsInput should reject ${JSON.stringify(badDp)}`)
 }

 // 2. Static CSS & source checks
 const indexHtml = await fs.readFile(new URL('./index.html', import.meta.url), 'utf8')
 const dataSource = await fs.readFile(new URL('./src/lane-data.fs', import.meta.url), 'utf8')
 const rowPickerModalSource = await fs.readFile(new URL('./src/lane-row-picker-modal.fs', import.meta.url), 'utf8')
 const confirmModalSource = await fs.readFile(new URL('./src/confirm-modal.fs', import.meta.url), 'utf8')
 const mainSource = await fs.readFile(new URL('./src/main.fs', import.meta.url), 'utf8')
 const laneSource = await fs.readFile(new URL('./src/lane-control.fs', import.meta.url), 'utf8')
 const notebookSource = await fs.readFile(new URL('./src/lane-notebook.fs', import.meta.url), 'utf8')
 const inputsSource = await fs.readFile(new URL('./src/lane-inputs.fs', import.meta.url), 'utf8')
 const scopeSource = await fs.readFile(new URL('./src/lane-scope.fs', import.meta.url), 'utf8')
 const outputSource = await fs.readFile(new URL('./src/lane-output.fs', import.meta.url), 'utf8')
 const modalSource = await fs.readFile(new URL('./src/lane-modal.fs', import.meta.url), 'utf8')
 const configModalSource = await fs.readFile(new URL('./src/lane-config-modal.fs', import.meta.url), 'utf8')
 const importModalSource = await fs.readFile(new URL('./src/lane-import-modal.fs', import.meta.url), 'utf8')
 const railsSource = await fs.readFile(new URL('./src/lane-rails.fs', import.meta.url), 'utf8')

 assert.match(indexHtml, /input\[type="number"\]\s*\{[^}]*appearance:\s*textfield;/s)
 assert.match(indexHtml, /input\[type="number"\]::-webkit-inner-spin-button,\s*input\[type="number"\]::-webkit-outer-spin-button\s*\{[^}]*-webkit-appearance:\s*none;/s)
 assert.match(indexHtml, /\.lane-data-cell-input--invalid,\s*\.lane-data-cell-input--invalid:focus\s*\{[^}]*background-color:\s*#3a1216;[^}]*border-color:\s*#ff5555cc;/s)
 assert.match(indexHtml, /\.lane-data-decimals-input--invalid,\s*\.lane-data-decimals-input--invalid:focus\s*\{[^}]*background-color:\s*#3a1216;[^}]*border-color:\s*#ff5555cc;/s)
 assert.match(indexHtml, /\.lane-data-multi-item\s+\.lane-data-cell-input--invalid,\s*\.lane-data-multi-item\s+\.lane-data-cell-input--invalid:focus\s*\{[^}]*background-color:\s*#3a1216;[^}]*border-color:\s*#ff5555cc;/s)
 assert.match(indexHtml, /\.lane-row-picker-add-control\s+\.lane-data-cell-input--invalid,\s*\.lane-row-picker-add-control\s+\.lane-data-cell-input--invalid:focus\s*\{[^}]*background-color:\s*#3a1216;[^}]*border-color:\s*#ff5555cc;/s)
 assert.match(indexHtml, /\.lane-data-td:has\(\.lane-data-cell-input--invalid\)/)

 assert.doesNotMatch(dataSource, /\{\s*\[ propertyIs integer col\.type \]\s*:\s*number\s*\}/)
 assert.doesNotMatch(dataSource, /\{\s*\[ propertyIs decimal col\.type \]\s*:\s*number\s*\}/)
 assert.doesNotMatch(dataSource, /\$decimals-el\s+\{\s*type number\s*\}/)
 assert.doesNotMatch(rowPickerModalSource, /\{\s*\[ propertyIs integer col\.type \]\s*:\s*number\s*\}/)
 assert.doesNotMatch(rowPickerModalSource, /\{\s*\[ propertyIs decimal col\.type \]\s*:\s*number\s*\}/)

 // 3. UI integration: Data grid cells, integer[], Schema dp input, and Row Picker "+ Add"
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
   readOnly: false,
   focused: false,
   removed: false,
   scrollWidth: 0,
   scrollLeft: 0,
   setAttribute(name, value) { this.attributes[name] = value },
   getAttribute(name) { return this.attributes[name] ?? null },
   appendChild(child) { this.children.push(child); return child },
   insertBefore(child, ref) {
    const idx = this.children.indexOf(ref)
    if (idx === -1) { this.children.push(child) }
    else { this.children.splice(idx, 0, child) }
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
  crypto: { randomUUID: () => `num-uuid-${++uuid}` },
  history: { pushState(_s, _t, url) { mockWindow.location.pathname = url } },
  location: { pathname: '/' },
  addEventListener() {},
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
   runLines,
   runTransportedScripts,
  })
  await f.run(parse(mainSource, '/src/main.fs'))
  await f.state.tableHeadRowAddButton.listeners.click()
  const lane = f.state.lanes[0]
  const nb = lane.notebook
  const dataView = nb['data-view']
  const rowPicker = dataView['row-picker']
  await nb.tabs.data.listeners.click()

  // Table 1 (`metrics`): qty (integer), scores (integer[]), ratio (decimal), total (fixed(2))
  await dataView['add-table-btn'].listeners.click()
  const metricsTableId = dataView.tables[0].id
  await dataView['add-col-btn'].listeners.click()
  dataView['schema-rows'][0]['name-el'].value = 'qty'
  await dataView['schema-rows'][0]['name-el'].listeners.input()
  dataView['schema-rows'][0]['type-el'].value = 'integer'
  await dataView['schema-rows'][0]['type-el'].listeners.change()

  await dataView['add-col-btn'].listeners.click()
  dataView['schema-rows'][1]['name-el'].value = 'scores'
  await dataView['schema-rows'][1]['name-el'].listeners.input()
  dataView['schema-rows'][1]['type-el'].value = 'integer'
  await dataView['schema-rows'][1]['type-el'].listeners.change()
  await dataView['schema-rows'][1]['multi-btn'].listeners.click()

  await dataView['add-col-btn'].listeners.click()
  dataView['schema-rows'][2]['name-el'].value = 'ratio'
  await dataView['schema-rows'][2]['name-el'].listeners.input()
  dataView['schema-rows'][2]['type-el'].value = 'decimal'
  await dataView['schema-rows'][2]['type-el'].listeners.change()

  await dataView['add-col-btn'].listeners.click()
  dataView['schema-rows'][3]['name-el'].value = 'total'
  await dataView['schema-rows'][3]['name-el'].listeners.input()
  dataView['schema-rows'][3]['type-el'].value = 'fixed'
  await dataView['schema-rows'][3]['type-el'].listeners.change()

  // Schema `dp` input uses type="text" with inputmode="numeric", highlights invalid input, and blocks invalid change
  const decEl = dataView['schema-rows'][3]['decimals-el']
  assert.equal(decEl.type, 'text')
  assert.equal(decEl.attributes.inputmode, 'numeric')
  assert.equal(decEl.attributes.step, undefined)
  decEl.value = '99'
  await decEl.listeners.input()
  assert.match(decEl.className, /lane-data-decimals-input--invalid/)
  assert.equal(decEl.attributes['aria-invalid'], 'true')
  await decEl.listeners.change()
  assert.equal(dataView.tables[0].columns[3].decimals, 2)
  decEl.value = '2'
  await decEl.listeners.input()
  assert.doesNotMatch(decEl.className, /lane-data-decimals-input--invalid/)
  assert.equal(decEl.attributes['aria-invalid'], 'false')

  await dataView['add-row-btn'].listeners.click()
  const row0 = dataView['grid-rows'][0]
  const qtyColId = dataView.tables[0].columns[0].id
  const ratioColId = dataView.tables[0].columns[2].id
  const qtyInput = row0.cells[0]['input-el']
  const ratioInput = row0.cells[2]['input-el']
  const totalInput = row0.cells[3]['input-el']

  // Verify NO type="number" and NO step attributes on grid cells
  assert.equal(qtyInput.type, 'text')
  assert.equal(qtyInput.attributes.inputmode, 'numeric')
  assert.equal(qtyInput.attributes['data-num-type'], 'integer')
  assert.equal(qtyInput.attributes.step, undefined)
  assert.equal(ratioInput.type, 'text')
  assert.equal(ratioInput.attributes.inputmode, 'decimal')
  assert.equal(ratioInput.attributes['data-num-type'], 'decimal')
  assert.equal(ratioInput.attributes.step, undefined)
  assert.equal(totalInput.type, 'text')
  assert.equal(totalInput.attributes.inputmode, 'decimal')
  assert.equal(totalInput.attributes['data-num-type'], 'fixed')

  // Multiple integer[] item input also uses type="text"
  await row0.cells[1]['add-btn'].listeners.click()
  const score0Input = row0.cells[1].items[0]['input-el']
  assert.equal(score0Input.type, 'text')
  assert.equal(score0Input.attributes.inputmode, 'numeric')
  assert.equal(score0Input.attributes.step, undefined)

  // Every invalid integer string triggers invalid styling, preserves typed text on blur, and leaves stored integer untouched
  for (const bad of ['2.5', '12abc', '1e2', '--3', '-', '42 ', '   ', '9007199254740992']) {
   qtyInput.value = bad
   await qtyInput.listeners.input()
   assert.match(qtyInput.className, /lane-data-cell-input--invalid/)
   assert.equal(qtyInput.attributes['aria-invalid'], 'true')
   assert.ok(qtyInput.title.length > 0)
   await qtyInput.listeners.blur()
   assert.equal(qtyInput.value, bad)
   assert.strictEqual(dataView.tables[0].rows[0].values[qtyColId], 0)
  }

  // Valid integer input clears invalid state, updates stored value, and normalizes on blur
  qtyInput.value = '007'
  await qtyInput.listeners.input()
  assert.doesNotMatch(qtyInput.className, /lane-data-cell-input--invalid/)
  assert.equal(qtyInput.attributes['aria-invalid'], 'false')
  assert.strictEqual(dataView.tables[0].rows[0].values[qtyColId], 7)
  await qtyInput.listeners.blur()
  assert.equal(qtyInput.value, '7')

  qtyInput.value = '-0'
  await qtyInput.listeners.input()
  assert.strictEqual(Object.is(dataView.tables[0].rows[0].values[qtyColId], 0), true)
  await qtyInput.listeners.blur()
  assert.equal(qtyInput.value, '0')

  // Decimal rejects '1e5' / '0x10', highlights invalid, then accepts '.5' -> normalizes to '0.5' on blur
  ratioInput.value = '1e5'
  await ratioInput.listeners.input()
  assert.match(ratioInput.className, /lane-data-cell-input--invalid/)
  ratioInput.value = '.5'
  await ratioInput.listeners.input()
  assert.doesNotMatch(ratioInput.className, /lane-data-cell-input--invalid/)
  assert.strictEqual(dataView.tables[0].rows[0].values[ratioColId], 0.5)
  await ratioInput.listeners.blur()
  assert.equal(ratioInput.value, '0.5')

  // Table 2 (`refs`) with a `row` column pointing to `metrics.qty` to test Row Picker "+ Add" numeric inputs
  await dataView['add-table-btn'].listeners.click()
  await dataView['add-col-btn'].listeners.click()
  dataView['schema-rows'][0]['name-el'].value = 'metric'
  await dataView['schema-rows'][0]['name-el'].listeners.input()
  dataView['schema-rows'][0]['type-el'].value = 'row'
  await dataView['schema-rows'][0]['type-el'].listeners.change()
  dataView['schema-rows'][0]['ref-table-el'].value = metricsTableId
  await dataView['schema-rows'][0]['ref-table-el'].listeners.change()
  dataView['schema-rows'][0]['ref-col-el'].value = qtyColId
  await dataView['schema-rows'][0]['ref-col-el'].listeners.change()
  await dataView['add-row-btn'].listeners.click()

  await dataView['grid-rows'][0].cells[0]['trigger-el'].listeners.click()
  await rowPicker['add-trigger-btn'].listeners.click()
  const addQtyInput = rowPicker['add-fields'][0]['input-el']
  const addRatioInput = rowPicker['add-fields'][2]['input-el']
  assert.equal(addQtyInput.type, 'text')
  assert.equal(addQtyInput.attributes.inputmode, 'numeric')
  assert.equal(addQtyInput.attributes.step, undefined)
  assert.equal(addRatioInput.type, 'text')
  assert.equal(addRatioInput.attributes.inputmode, 'decimal')
  assert.equal(addRatioInput.attributes.step, undefined)

  addQtyInput.value = '12.5'
  await addQtyInput.listeners.input()
  assert.match(addQtyInput.className, /lane-data-cell-input--invalid/)
  assert.equal(addQtyInput.attributes['aria-invalid'], 'true')
  addQtyInput.value = '009'
  await addQtyInput.listeners.input()
  assert.doesNotMatch(addQtyInput.className, /lane-data-cell-input--invalid/)
  await addQtyInput.listeners.blur()
  assert.equal(addQtyInput.value, '9')
 }
 finally {
  globalThis.fetch = origFetch
 }
})

test('Multi-type workflow & all-column constraint helpers: type matching, stacking, date_range timezone/ms bounds, fixed rescaling, and validation', () => {
 // 1. WORKFLOW_COLUMN_TYPES, columnSupportsWorkflow, getSupportedColumnConstraints across all 12 column types
 assert.deepEqual(WORKFLOW_COLUMN_TYPES, ['text', 'integer', 'boolean'])
 assert.equal(columnSupportsWorkflow('text'), true)
 assert.equal(columnSupportsWorkflow('integer[]'), true)
 assert.equal(columnSupportsWorkflow('boolean'), true)
 assert.equal(columnSupportsWorkflow('decimal'), false)
 assert.equal(columnSupportsWorkflow('date'), false)

 assert.deepEqual(getSupportedColumnConstraints('integer').map(c => c.type), ['workflow', 'min', 'max', 'range', 'step', 'unique'])
 assert.deepEqual(getSupportedColumnConstraints('decimal').map(c => c.type), ['min', 'max', 'range', 'unique'])
 assert.deepEqual(getSupportedColumnConstraints('fixed').map(c => c.type), ['min', 'max', 'range', 'unique'])
 assert.deepEqual(getSupportedColumnConstraints('text').map(c => c.type), ['workflow', 'min_length', 'max_length', 'pattern', 'one_of', 'unique'])
 assert.deepEqual(getSupportedColumnConstraints('boolean').map(c => c.type), ['workflow', 'boolean_value'])
 assert.deepEqual(getSupportedColumnConstraints('date').map(c => c.type), ['date_range', 'unique'])
 assert.deepEqual(getSupportedColumnConstraints('datetime').map(c => c.type), ['date_range', 'unique'])
 assert.deepEqual(getSupportedColumnConstraints('url').map(c => c.type), ['https_only', 'domain', 'pattern', 'max_length', 'unique'])
 assert.deepEqual(getSupportedColumnConstraints('email').map(c => c.type), ['domain', 'pattern', 'max_length', 'unique'])
 assert.deepEqual(getSupportedColumnConstraints('json').map(c => c.type), ['json_type', 'required_keys'])
 assert.deepEqual(getSupportedColumnConstraints('row').map(c => c.type), ['unique'])
 assert.deepEqual(getSupportedColumnConstraints('lane').map(c => c.type), ['unique'])

 // 2. findWorkflowDefaultColumns filters strictly to matching scalar type
 const wfTable = {
  id: 't-wf',
  name: 'transitions',
  columns: [
   { id: 'c-from-txt', name: 'from', type: 'text', multiple: false },
   { id: 'c-to-arr', name: 'to', type: 'integer', multiple: true },
   { id: 'c-from-int', name: 'From', type: 'integer', multiple: false },
   { id: 'c-to-int', name: 'To', type: 'integer', multiple: false },
   { id: 'c-from-bool', name: 'from', type: 'boolean', multiple: false },
   { id: 'c-to-bool', name: 'to', type: 'boolean', multiple: false },
  ],
  rows: [
   { id: 'w1', values: { 'c-from-int': 0, 'c-to-int': 1, 'c-from-bool': false, 'c-to-bool': true } },
   { id: 'w2', values: { 'c-from-int': 1, 'c-to-int': 2 } },
  ],
 }
 assert.deepEqual(findWorkflowDefaultColumns(wfTable, 'integer'), { fromColumnId: 'c-from-int', toColumnId: 'c-to-int' })
 assert.deepEqual(findWorkflowDefaultColumns(wfTable, 'boolean'), { fromColumnId: 'c-from-bool', toColumnId: 'c-to-bool' })
 assert.deepEqual(findWorkflowDefaultColumns(wfTable, 'text'), { fromColumnId: 'c-from-txt', toColumnId: '' })

 // 3. Integer & Boolean resolveWorkflowTarget / getWorkflowCellState & mismatch rejection
 const intCol = {
  id: 'c-stage',
  name: 'stage',
  type: 'integer',
  multiple: false,
  constraints: [{ type: 'workflow', tableId: 't-wf', fromColumnId: 'c-from-int', toColumnId: 'c-to-int' }],
 }
 const boolCol = {
  id: 'c-done',
  name: 'done',
  type: 'boolean',
  multiple: false,
  constraint: { type: 'workflow', tableId: 't-wf', fromColumnId: 'c-from-bool', toColumnId: 'c-to-bool' },
 }
 const mismatchCol = {
  id: 'c-bad',
  name: 'bad',
  type: 'integer',
  multiple: false,
  constraint: { type: 'workflow', tableId: 't-wf', fromColumnId: 'c-from-txt', toColumnId: 'c-to-arr' },
 }
 const intTables = [wfTable]

 const int0 = getWorkflowCellState(intTables, intCol, 0)
 assert.equal(int0.valid, true)
 assert.equal(int0.isValueValid, true)
 assert.deepEqual(int0.options.map(o => ({ v: o.value, t: o.typedValue })), [
  { v: '0', t: 0 },
  { v: '1', t: 1 },
 ])
 const int2 = getWorkflowCellState(intTables, intCol, 2)
 assert.equal(int2.isValueValid, true)
 assert.deepEqual(int2.options.map(o => o.typedValue), [2])
 const intInvalid = getWorkflowCellState(intTables, intCol, 99)
 assert.equal(intInvalid.isValueValid, false)
 assert.deepEqual(intInvalid.options.map(o => ({ t: o.typedValue, inv: o.isInvalid })), [
  { t: 99, inv: true },
  { t: 0, inv: false },
  { t: 1, inv: false },
 ])
 const intNull = getWorkflowCellState(intTables, intCol, null)
 assert.equal(intNull.isValueValid, false)
 assert.equal(intNull.options[0].typedValue, null)

 const boolFalse = getWorkflowCellState(intTables, boolCol, false)
 assert.equal(boolFalse.valid, true)
 assert.equal(boolFalse.isValueValid, true)
 assert.deepEqual(boolFalse.options.map(o => o.typedValue), [false, true])
 const boolTrue = getWorkflowCellState(intTables, boolCol, true)
 assert.equal(boolTrue.isValueValid, true)
 assert.deepEqual(boolTrue.options.map(o => o.typedValue), [true])

 const mismatchTarget = resolveWorkflowTarget(intTables, mismatchCol)
 assert.equal(mismatchTarget.active, true)
 assert.equal(mismatchTarget.valid, false)
 assert.equal(mismatchTarget.typeMismatch, true)
 assert.equal(mismatchTarget.fromMatchesType, false)
 assert.equal(mismatchTarget.toMatchesType, false)
 const mismatchState = getWorkflowCellState(intTables, mismatchCol, 0)
 assert.equal(mismatchState.valid, false)
 assert.equal(mismatchState.error, 'Workflow From and To columns must be integer')

 assert.equal(parseWorkflowOptionValue('0', intCol), 0)
 assert.equal(parseWorkflowOptionValue('', intCol), null)
 assert.equal(parseWorkflowOptionValue('false', boolCol), false)
 assert.equal(parseWorkflowOptionValue('true', boolCol), true)
 assert.deepEqual(getColumnWorkflowConstraint(intCol), intCol.constraints[0])

 // 4. Stacking normalization, formatColumnType, fixed decimal rescaling, and stored table persistence
 const stackedIntCol = {
  id: 'c-st',
  name: 'stage',
  type: 'integer',
  multiple: false,
  constraints: [
   intCol.constraints[0],
   { type: 'min', min: '0' },
   { type: 'max', max: 10 },
   { type: 'range', min: 1, max: 9 },
   { type: 'step', step: 2 },
   { type: 'unique' },
  ],
 }
 assert.equal(formatColumnType(stackedIntCol), 'integer(workflow, min, max, range, step, unique)')
 assert.deepEqual(normalizeColumnConstraints([
  { type: 'min', min: 1 },
  { type: 'min', min: 5 },
  { type: 'https_only' },
 ], 'integer'), [{ type: 'min', min: 1 }])

 const fixedCol2 = {
  id: 'c-amt',
  name: 'amount',
  type: 'fixed',
  multiple: false,
  decimals: 2,
  constraints: [
   { type: 'min', min: 1000 },
   { type: 'max', max: 5000 },
   { type: 'range', min: 500, max: 9500 },
  ],
 }
 const rescaledFixed = parseColumnType(fixedCol2, false, 3)
 assert.deepEqual(rescaledFixed.constraints, [
  { type: 'min', min: 10000 },
  { type: 'max', max: 50000 },
  { type: 'range', min: 5000, max: 95000 },
 ])
 assert.equal(formatColumnType(fixedCol2), 'fixed(2, min, max, range)')
 assert.equal(formatColumnType({ type: 'date', multiple: false, constraint: { type: 'date_range', relative: 'today_or_future' } }), 'date(range)')
 assert.equal(formatColumnType({ type: 'datetime', multiple: false, constraint: { type: 'date_range', relative: 'past' } }), 'datetime(range)')
 assert.equal(formatColumnType({ type: 'boolean', multiple: false, constraint: { type: 'boolean_value', expected: false } }), 'boolean(=false)')
 assert.equal(formatColumnType({ type: 'json', multiple: false, constraint: { type: 'json_type', expected: 'object' } }), 'json(object)')
 const rowUniqTable = [
  { id: 't-u', name: 'users', columns: [{ id: 'c-uid', name: 'id', type: 'integer', multiple: false }], rows: [] },
  {
   id: 't-o',
   name: 'orders',
   columns: [{ id: 'c-ou', name: 'user', type: 'row', multiple: false, refTableId: 't-u', refColumnId: 'c-uid', constraints: [{ type: 'unique' }] }],
   rows: [],
  },
 ]
 assert.equal(formatColumnType(rowUniqTable[1].columns[0], undefined, undefined, rowUniqTable), 'row(users.id, unique)')

 const reparsedStacked = parseStoredTables(JSON.stringify([{ id: 't-s', name: 's', columns: [stackedIntCol], rows: [] }]))
 assert.equal(reparsedStacked[0].columns[0].constraints.length, 6)
 assert.equal(reparsedStacked[0].columns[0].constraint.type, 'workflow')

 // 5. validateColumnConstraints across numeric, date_range, text, boolean_value, url, email, json, and unique
 assert.equal(validateColumnConstraints({ type: 'integer', constraints: [{ type: 'min', min: 10 }] }, 10).ok, true)
 assert.equal(validateColumnConstraints({ type: 'integer', constraints: [{ type: 'min', min: 10 }] }, 9).error, 'Must be at least 10')
 assert.equal(validateColumnConstraints({ type: 'decimal', constraints: [{ type: 'max', max: 2.5 }] }, 2.6).error, 'Must be at most 2.5')
 assert.equal(validateColumnConstraints({ type: 'fixed', decimals: 2, constraints: [{ type: 'range', min: 1000, max: 500 }] }, 700).error, 'Invalid range constraint (min 10.00 > max 5.00)')
 assert.equal(validateColumnConstraints({ type: 'integer', constraints: [{ type: 'step', step: 5 }] }, -15).ok, true)
 assert.equal(validateColumnConstraints({ type: 'integer', constraints: [{ type: 'step', step: 5 }] }, 0).ok, true)
 assert.equal(validateColumnConstraints({ type: 'integer', constraints: [{ type: 'step', step: 5 }] }, 7).error, 'Must be a multiple of 5')

 // Date Range (`date`) at 1-day resolution in specified timezone (2026-11-27T02:00:00Z is 2026-11-26 in America/New_York)
 const nyNowMs = Date.parse('2026-11-27T02:00:00Z')
 const nyOpts = { timeZone: 'America/New_York' }
 const datePastCol = { type: 'date', constraints: [{ type: 'date_range', relative: 'today_or_past' }] }
 const dateFutureCol = { type: 'date', constraints: [{ type: 'date_range', relative: 'today_or_future' }] }
 assert.equal(validateColumnConstraints(datePastCol, '2026-11-26', { nowMs: nyNowMs, displayOpts: nyOpts }).ok, true)
 assert.equal(validateColumnConstraints(datePastCol, '2026-11-27', { nowMs: nyNowMs, displayOpts: nyOpts }).ok, false)
 assert.equal(validateColumnConstraints(dateFutureCol, '2026-11-26', { nowMs: nyNowMs, displayOpts: nyOpts }).ok, true)
 assert.equal(validateColumnConstraints(dateFutureCol, '2026-11-25', { nowMs: nyNowMs, displayOpts: nyOpts }).ok, false)
 const dateBoundsCol = { type: 'date', constraints: [{ type: 'date_range', min: '2026-01-01', max: '2026-12-31' }] }
 assert.equal(validateColumnConstraints(dateBoundsCol, '2026-06-01', { nowMs: nyNowMs }).ok, true)
 assert.equal(validateColumnConstraints(dateBoundsCol, '2025-12-31', { nowMs: nyNowMs }).error, 'Date must be on or after 2026-01-01')

 // Date Range (`datetime`) relative to exact `nowMs` + min/max
 const dtNowMs = Date.parse('2026-11-27T15:00:00Z')
 const dtPastCol = { type: 'datetime', constraints: [{ type: 'date_range', relative: 'past' }] }
 const dtFutureCol = { type: 'datetime', constraints: [{ type: 'date_range', relative: 'future' }] }
 assert.equal(validateColumnConstraints(dtPastCol, '2026-11-27T14:59:59Z', { nowMs: dtNowMs }).ok, true)
 assert.equal(validateColumnConstraints(dtPastCol, '2026-11-27T15:00:00Z', { nowMs: dtNowMs }).ok, false)
 assert.equal(validateColumnConstraints(dtPastCol, '2026-11-27T15:00:01Z', { nowMs: dtNowMs }).error, 'Date/time must be in the past')
 assert.equal(validateColumnConstraints(dtFutureCol, '2026-11-27T15:00:01Z', { nowMs: dtNowMs }).ok, true)
 assert.equal(validateColumnConstraints(dtFutureCol, '2026-11-27T15:00:00Z', { nowMs: dtNowMs }).ok, false)
 assert.equal(validateColumnConstraints(dtFutureCol, '2026-11-27T14:59:59Z', { nowMs: dtNowMs }).error, 'Date/time must be in the future')
 assert.equal(validateColumnConstraints({ type: 'datetime', constraints: [{ type: 'date_range', min: '2026-11-27T10:00:00Z', max: '2026-11-27T20:00:00Z' }] }, '2026-11-27T21:00:00Z', { nowMs: dtNowMs }).ok, false)

 // Text, Boolean Expected, URL, Email, JSON, Unique
 const txtCol = { type: 'text', constraints: [{ type: 'min_length', min: 3 }, { type: 'max_length', max: 6 }, { type: 'pattern', pattern: '/^[A-Z0-9]+$/' }, { type: 'one_of', values: ['ABC1', 'XYZ2'] }] }
 assert.equal(validateColumnConstraints(txtCol, 'ABC1').ok, true)
 assert.equal(validateColumnConstraints(txtCol, 'ab').errors.length, 3)
 assert.equal(validateColumnConstraints(txtCol, 'abcdef!').errors.length, 3)

 assert.equal(validateColumnConstraints({ type: 'boolean', constraints: [{ type: 'boolean_value', expected: true }] }, false).error, 'Must be true')
 assert.equal(validateColumnConstraints({ type: 'boolean', constraints: [{ type: 'boolean_value', expected: false }] }, false).ok, true)
 assert.equal(validateColumnConstraints({ type: 'boolean', constraints: [{ type: 'boolean_value', expected: false }] }, true).error, 'Must be false')

 const urlCol = { type: 'url', constraints: [{ type: 'https_only' }, { type: 'domain', domains: ['example.com'] }] }
 assert.equal(validateColumnConstraints(urlCol, 'https://api.example.com/v1').ok, true)
 assert.equal(validateColumnConstraints(urlCol, 'http://example.com').error, 'URL must use https://')
 assert.equal(validateColumnConstraints(urlCol, 'https://evil-example.com').error, 'URL domain must match: example.com')

 const emailCol = { type: 'email', constraints: [{ type: 'domain', domains: ['acme.com'] }] }
 assert.equal(validateColumnConstraints(emailCol, 'ada@acme.com').ok, true)
 assert.equal(validateColumnConstraints(emailCol, 'ada@sub.acme.com').error, 'Email domain must be one of: acme.com')

 const jsonCol = { type: 'json', constraints: [{ type: 'json_type', expected: 'object' }, { type: 'required_keys', keys: ['id', 'ok'] }] }
 assert.equal(validateColumnConstraints(jsonCol, { id: 1, ok: true }).ok, true)
 assert.equal(validateColumnConstraints(jsonCol, [1, 2]).errors[0], 'Must be a JSON object ({...})')
 assert.equal(validateColumnConstraints(jsonCol, { id: 1 }).error, 'Missing required JSON key: ok')

 const uniqTable = {
  id: 't-uniq',
  name: 'uniq',
  columns: [{ id: 'c-code', name: 'code', type: 'text', multiple: false, constraints: [{ type: 'unique' }] }],
  rows: [
   { id: 'r1', values: { 'c-code': 'ALPHA' } },
   { id: 'r2', values: { 'c-code': 'ALPHA' } },
   { id: 'r3', values: { 'c-code': 'BETA' } },
  ],
 }
 assert.equal(validateColumnConstraints(uniqTable.columns[0], 'ALPHA', { table: uniqTable, rowId: 'r1' }).error, 'Duplicate value — must be unique')
 assert.equal(validateColumnConstraints(uniqTable.columns[0], 'BETA', { table: uniqTable, rowId: 'r3' }).ok, true)
 assert.match(describeAllColumnConstraints(datePastCol, null, nyOpts), /Date Range: Must be today or past/)
})

test('Data tab multi-type constraints UI: integer/boolean workflow & matching From/To, integer[] multiselect, stacked integer bounds, Date/Datetime Date Range presets, Unique, and persistence', async () => {
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
   selected: false,
   className: '',
   title: '',
   hidden: false,
   disabled: false,
   readOnly: false,
   focused: false,
   removed: false,
   scrollWidth: 0,
   scrollLeft: 0,
   setAttribute(name, value) { this.attributes[name] = value },
   getAttribute(name) { return this.attributes[name] ?? null },
   appendChild(child) { this.children.push(child); return child },
   insertBefore(child, ref) {
    const idx = this.children.indexOf(ref)
    if (idx === -1) { this.children.push(child) }
    else { this.children.splice(idx, 0, child) }
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

 let uuid = 0
 function createRuntime(pathname = '/') {
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
   crypto: { randomUUID: () => `mc-uuid-${++uuid}` },
   history: {
    pushState(_s, _t, url) { mockWindow.location.pathname = url },
    replaceState(_s, _t, url) { mockWindow.location.pathname = url },
   },
   location: { pathname, hash: '' },
   addEventListener() {},
   removeEventListener() {},
  }
  const mockDocument = {
   body: createMockElement('body'),
   documentElement: createMockElement('html'),
   defaultView: mockWindow,
   createElement: createMockElement,
  }
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
  return { f, mockWindow }
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
  const { f, mockWindow } = createRuntime()
  await f.run(parse(mainSource, '/src/main.fs'))
  await f.state.tableHeadRowAddButton.listeners.click()
  const lane = f.state.lanes[0]
  await lane.notebook.tabs.data.listeners.click()
  const dataView = lane.notebook['data-view']
  const rowPicker = dataView['row-picker']

  // 1. Mixed workflow table: text `label_from`, integer `from`, integer `to` with 0->1, 1->2, 2->10
  const mixedWf = await dataView['add-table']('mixed_wf')
  await dataView['add-column']('label_from', 'text', false)
  const mwFromCol = await dataView['add-column']('from', 'integer', false)
  const mwToCol = await dataView['add-column']('to', 'integer', false)
  for (const [fVal, tVal] of [['0', '1'], ['1', '2'], ['2', '10']]) {
   await dataView['add-row']()
   const r = dataView['grid-rows'][dataView['grid-rows'].length - 1]
   r.cells[1]['input-el'].value = fVal
   await r.cells[1]['input-el'].listeners.input()
   r.cells[2]['input-el'].value = tVal
   await r.cells[2]['input-el'].listeners.input()
  }

  // 2. Boolean workflow table: `from` (boolean) -> `to` (boolean) false -> true
  const boolWf = await dataView['add-table']('bool_wf')
  const bwFromCol = await dataView['add-column']('from', 'boolean', false)
  const bwToCol = await dataView['add-column']('to', 'boolean', false)
  await dataView['add-row']()
  dataView['grid-rows'][0].cells[0]['input-el'].checked = false
  await dataView['grid-rows'][0].cells[0]['input-el'].listeners.change()
  dataView['grid-rows'][0].cells[1]['input-el'].checked = true
  await dataView['grid-rows'][0].cells[1]['input-el'].listeners.change()

  // 3. Target table `items` with stage (int), stages (int[]), locked (bool), due_date (date), event_at (datetime), code (text)
  const itemsTbl = await dataView['add-table']('items')
  const stageCol = await dataView['add-column']('stage', 'integer', false)
  const stagesCol = await dataView['add-column']('stages', 'integer', true)
  const lockedCol = await dataView['add-column']('locked', 'boolean', false)
  await dataView['add-column']('due_date', 'date', false)
  await dataView['add-column']('event_at', 'datetime', false)
  await dataView['add-column']('code', 'text', false)

  await dataView['add-row']()
  await dataView['add-row']()

  // 4. Configure `stage` (integer) Workflow + stacked Minimum / Maximum / Range
  const stageAdd = dataView['schema-rows'][0]['constraint-add-el']
  stageAdd.value = 'workflow'
  await stageAdd.listeners.change()
  dataView['schema-rows'][0]['constraint-table-el'].value = mixedWf.id
  await dataView['schema-rows'][0]['constraint-table-el'].listeners.change()

  // Verify From and To dropdowns ONLY list matching integer columns (never text `label_from`)
  const stageWfCard = dataView['schema-rows'][0]['constraint-cards'][0]
  assert.deepEqual(stageWfCard['from-el'].children.slice(1).map(o => o.textContent), ['from (integer)', 'to (integer)'])
  assert.deepEqual(stageWfCard['to-el'].children.slice(1).map(o => o.textContent), ['from (integer)', 'to (integer)'])
  assert.equal(stageWfCard['from-el'].value, mwFromCol.id)
  assert.equal(stageWfCard['to-el'].value, mwToCol.id)

  // Verify integer transitions store real JS numbers: 0 -> 1 -> 2 -> 10
  assert.equal(dataView['grid-rows'][0].cells[0]['select-el'].tag, 'select')
  assert.strictEqual(itemsTbl.rows[0].values[stageCol.id], 0)
  assert.deepEqual(dataView['grid-rows'][0].cells[0]['option-els'].map(o => o.value), ['0', '1'])
  dataView['grid-rows'][0].cells[0]['select-el'].value = '1'
  await dataView['grid-rows'][0].cells[0]['select-el'].listeners.change()
  assert.strictEqual(itemsTbl.rows[0].values[stageCol.id], 1)
  dataView['grid-rows'][0].cells[0]['select-el'].value = '2'
  await dataView['grid-rows'][0].cells[0]['select-el'].listeners.change()
  assert.strictEqual(itemsTbl.rows[0].values[stageCol.id], 2)

  // Stack Minimum (>= 1), Maximum (<= 5), and Range (0..3) on `stage` alongside Workflow!
  dataView['schema-rows'][0]['constraint-add-el'].value = 'min'
  await dataView['schema-rows'][0]['constraint-add-el'].listeners.change()
  dataView['schema-rows'][0]['constraint-add-el'].value = 'max'
  await dataView['schema-rows'][0]['constraint-add-el'].listeners.change()
  dataView['schema-rows'][0]['constraint-add-el'].value = 'range'
  await dataView['schema-rows'][0]['constraint-add-el'].listeners.change()

  const stageCards = dataView['schema-rows'][0]['constraint-cards']
  assert.equal(stageCards.length, 4)
  assert.equal(dataView['grid-head-cells'][1]['type-el'].textContent, 'integer(workflow, min, max, range)')
  assert.equal(stageCards[1]['min-el'].type, 'text')
  assert.equal(stageCards[1]['min-el'].attributes.inputmode, 'numeric')
  assert.equal(stageCards[1]['min-el'].attributes.step, undefined)

  stageCards[1]['min-el'].value = '2.5'
  await stageCards[1]['min-el'].listeners.input()
  assert.match(stageCards[1]['min-el'].className, /lane-data-cell-input--invalid/)
  assert.equal(stageCards[1]['min-el'].attributes['aria-invalid'], 'true')
  stageCards[1]['min-el'].value = '01'
  await stageCards[1]['min-el'].listeners.input()
  assert.doesNotMatch(stageCards[1]['min-el'].className, /lane-data-cell-input--invalid/)
  await stageCards[1]['min-el'].listeners.blur()
  assert.equal(stageCards[1]['min-el'].value, '1')
  stageCards[2]['max-el'].value = '5'
  await stageCards[2]['max-el'].listeners.input()
  stageCards[3]['min-el'].value = '0'
  await stageCards[3]['min-el'].listeners.input()
  stageCards[3]['max-el'].value = '3'
  await stageCards[3]['max-el'].listeners.input()

  // Row 0 is at 2 -> satisfies workflow + all 3 bounds -> valid; Row 1 is at 0 -> valid in workflow yet fails Minimum (>= 1)!
  assert.equal(dataView['grid-rows'][0].cells[0]['select-el'].attributes['aria-invalid'], 'false')
  assert.match(dataView['grid-rows'][1].cells[0]['select-el'].className, /lane-data-cell-select--invalid/)
  assert.equal(dataView['grid-rows'][1].cells[0]['select-el'].attributes['aria-invalid'], 'true')

  // Transition Row 0 to 10 (allowed in workflow 2->10) -> highlights invalid because > Maximum (5) / Range (3)
  dataView['grid-rows'][0].cells[0]['select-el'].value = '10'
  await dataView['grid-rows'][0].cells[0]['select-el'].listeners.change()
  assert.strictEqual(itemsTbl.rows[0].values[stageCol.id], 10)
  assert.match(dataView['grid-rows'][0].cells[0]['select-el'].className, /lane-data-cell-select--invalid/)

  // Remove ONLY Range card via its `×` button -> Workflow, Minimum, and Maximum stay intact
  await dataView['schema-rows'][0]['constraint-cards'][3]['remove-btn'].listeners.click()
  assert.equal(dataView['schema-rows'][0]['constraint-cards'].length, 3)
  assert.equal(dataView['grid-head-cells'][1]['type-el'].textContent, 'integer(workflow, min, max)')

  // 5. `stages` (integer(workflow)[]) multiselect opens rowPicker and stores JS numbers [0, 1]
  dataView['schema-rows'][1]['constraint-add-el'].value = 'workflow'
  await dataView['schema-rows'][1]['constraint-add-el'].listeners.change()
  dataView['schema-rows'][1]['constraint-table-el'].value = mixedWf.id
  await dataView['schema-rows'][1]['constraint-table-el'].listeners.change()
  await dataView['grid-rows'][0].cells[1]['add-btn'].listeners.click()
  assert.equal(rowPicker['is-open'], true)
  assert.equal(rowPicker.multiple, true)
  await rowPicker['option-items'][0].el.listeners.click() // '0'
  await rowPicker['option-items'][1].el.listeners.click() // '1'
  await rowPicker['apply-btn'].listeners.click()
  assert.deepEqual(itemsTbl.rows[0].values[stagesCol.id], [0, 1])

  // 6. `locked` (boolean) Workflow renders <select> instead of checkbox and stores real JS booleans
  dataView['schema-rows'][2]['constraint-add-el'].value = 'workflow'
  await dataView['schema-rows'][2]['constraint-add-el'].listeners.change()
  dataView['schema-rows'][2]['constraint-table-el'].value = boolWf.id
  await dataView['schema-rows'][2]['constraint-table-el'].listeners.change()
  const lockedCard = dataView['schema-rows'][2]['constraint-cards'][0]
  assert.equal(lockedCard['from-el'].value, bwFromCol.id)
  assert.equal(lockedCard['to-el'].value, bwToCol.id)
  assert.equal(dataView['grid-rows'][0].cells[2]['select-el'].tag, 'select')
  assert.deepEqual(dataView['grid-rows'][0].cells[2]['option-els'].map(o => o.value), ['false', 'true'])
  dataView['grid-rows'][0].cells[2]['select-el'].value = 'true'
  await dataView['grid-rows'][0].cells[2]['select-el'].listeners.change()
  assert.strictEqual(itemsTbl.rows[0].values[lockedCol.id], true)
  assert.deepEqual(dataView['grid-rows'][0].cells[2]['option-els'].map(o => o.value), ['true'])

  // 7. `due_date` (date) Date Range presets: Must be today or past / Must be today or future
  dataView['schema-rows'][3]['constraint-add-el'].value = 'date_range'
  await dataView['schema-rows'][3]['constraint-add-el'].listeners.change()
  const dueCard = dataView['schema-rows'][3]['constraint-cards'][0]
  assert.equal(dueCard['preset-past-btn'].textContent, 'Must be today or past')
  assert.equal(dueCard['preset-future-btn'].textContent, 'Must be today or future')

  await dueCard['preset-future-btn'].listeners.click()
  assert.equal(dataView['schema-rows'][3]['constraint-cards'][0]['preset-future-btn'].attributes['aria-pressed'], 'true')
  const dueInput0 = dataView['grid-rows'][0].cells[3]['input-el']
  dueInput0.value = '2000-01-01'
  await dueInput0.listeners.input()
  assert.match(dueInput0.className, /lane-data-cell-input--invalid/)
  dueInput0.value = '2099-12-31'
  await dueInput0.listeners.input()
  assert.doesNotMatch(dueInput0.className, /lane-data-cell-input--invalid/)

  await dataView['schema-rows'][3]['constraint-cards'][0]['preset-past-btn'].listeners.click()
  assert.match(dataView['grid-rows'][0].cells[3]['input-el'].className, /lane-data-cell-input--invalid/)
  dataView['grid-rows'][0].cells[3]['input-el'].value = '2000-01-01'
  await dataView['grid-rows'][0].cells[3]['input-el'].listeners.input()
  assert.doesNotMatch(dataView['grid-rows'][0].cells[3]['input-el'].className, /lane-data-cell-input--invalid/)

  // 8. `event_at` (datetime) Date Range presets: Must be in the past / Must be in the future
  dataView['schema-rows'][4]['constraint-add-el'].value = 'date_range'
  await dataView['schema-rows'][4]['constraint-add-el'].listeners.change()
  const evCard = dataView['schema-rows'][4]['constraint-cards'][0]
  assert.equal(evCard['preset-past-btn'].textContent, 'Must be in the past')
  assert.equal(evCard['preset-future-btn'].textContent, 'Must be in the future')

  await evCard['preset-past-btn'].listeners.click()
  dataView['grid-rows'][0].cells[4]['input-el'].value = '2099-12-31T12:00'
  await dataView['grid-rows'][0].cells[4]['input-el'].listeners.input()
  assert.match(dataView['grid-rows'][0].cells[4]['input-el'].className, /lane-data-cell-input--invalid/)
  dataView['grid-rows'][0].cells[4]['input-el'].value = '2000-01-01T12:00'
  await dataView['grid-rows'][0].cells[4]['input-el'].listeners.input()
  assert.doesNotMatch(dataView['grid-rows'][0].cells[4]['input-el'].className, /lane-data-cell-input--invalid/)

  await dataView['schema-rows'][4]['constraint-cards'][0]['preset-future-btn'].listeners.click()
  assert.match(dataView['grid-rows'][0].cells[4]['input-el'].className, /lane-data-cell-input--invalid/)
  dataView['grid-rows'][0].cells[4]['input-el'].value = '2099-12-31T12:00'
  await dataView['grid-rows'][0].cells[4]['input-el'].listeners.input()
  assert.doesNotMatch(dataView['grid-rows'][0].cells[4]['input-el'].className, /lane-data-cell-input--invalid/)

  // 9. `code` (text) Unique + Pattern: live cross-row duplicate highlight & clear
  dataView['schema-rows'][5]['constraint-add-el'].value = 'unique'
  await dataView['schema-rows'][5]['constraint-add-el'].listeners.change()
  dataView['schema-rows'][5]['constraint-add-el'].value = 'pattern'
  await dataView['schema-rows'][5]['constraint-add-el'].listeners.change()
  dataView['schema-rows'][5]['constraint-cards'][1]['text-el'].value = '/^[A-Z]+$/'
  await dataView['schema-rows'][5]['constraint-cards'][1]['text-el'].listeners.input()

  dataView['grid-rows'][0].cells[5]['input-el'].value = 'abc'
  await dataView['grid-rows'][0].cells[5]['input-el'].listeners.input()
  assert.match(dataView['grid-rows'][0].cells[5]['input-el'].className, /lane-data-cell-input--invalid/)

  dataView['grid-rows'][0].cells[5]['input-el'].value = 'ALPHA'
  await dataView['grid-rows'][0].cells[5]['input-el'].listeners.input()
  assert.doesNotMatch(dataView['grid-rows'][0].cells[5]['input-el'].className, /lane-data-cell-input--invalid/)

  dataView['grid-rows'][1].cells[5]['input-el'].value = 'ALPHA'
  await dataView['grid-rows'][1].cells[5]['input-el'].listeners.input()
  assert.match(dataView['grid-rows'][0].cells[5]['input-el'].className, /lane-data-cell-input--invalid/)
  assert.match(dataView['grid-rows'][1].cells[5]['input-el'].className, /lane-data-cell-input--invalid/)

  dataView['grid-rows'][1].cells[5]['input-el'].value = 'BETA'
  await dataView['grid-rows'][1].cells[5]['input-el'].listeners.input()
  assert.doesNotMatch(dataView['grid-rows'][0].cells[5]['input-el'].className, /lane-data-cell-input--invalid/)
  assert.doesNotMatch(dataView['grid-rows'][1].cells[5]['input-el'].className, /lane-data-cell-input--invalid/)

  // 10. Reload runtime and verify all stacked constraints & typed values persist cleanly
  const reloaded = createRuntime(mockWindow.location.pathname)
  await reloaded.f.run(parse(mainSource, '/src/main.fs'))
  const rDataView = reloaded.f.state.lanes[0].notebook['data-view']
  const rItems = rDataView.tables.find(t => t.name === 'items')
  assert.deepEqual(rItems.columns[0].constraints.map(c => c.type), ['workflow', 'min', 'max'])
  assert.deepEqual(rItems.columns[2].constraints, [{ type: 'workflow', tableId: boolWf.id, fromColumnId: bwFromCol.id, toColumnId: bwToCol.id }])
  assert.equal(rItems.columns[3].constraints[0].relative, 'today_or_past')
  assert.equal(rItems.columns[4].constraints[0].relative, 'future')
  assert.deepEqual(rItems.columns[5].constraints.map(c => c.type), ['unique', 'pattern'])
  assert.strictEqual(rItems.rows[0].values[stageCol.id], 10)
  assert.deepEqual(rItems.rows[0].values[stagesCol.id], [0, 1])
  assert.strictEqual(rItems.rows[0].values[lockedCol.id], true)
  assert.equal(rDataView['grid-rows'][0].cells[2]['select-el'].tag, 'select')
 }
 finally {
  globalThis.fetch = origFetch
 }
})

test('Cell flag helpers, row serialization/hydration, syncTable preservation, snapshot revision, and flag filter operators', async () => {
 assert.deepEqual(CELL_FLAGS, ['unknown', 'incorrect'])
 assert.equal(normalizeCellFlag('unknown'), 'unknown')
 assert.equal(normalizeCellFlag('  UNKNOWN '), 'unknown')
 assert.equal(normalizeCellFlag('incorrect'), 'incorrect')
 assert.equal(normalizeCellFlag('  Incorrect '), 'incorrect')
 assert.equal(normalizeCellFlag('none'), null)
 assert.equal(normalizeCellFlag('unset'), null)
 assert.equal(normalizeCellFlag('normal'), null)
 assert.equal(normalizeCellFlag(''), null)
 assert.equal(normalizeCellFlag(null), null)
 assert.equal(normalizeCellFlag(undefined), null)
 assert.equal(normalizeCellFlag(false), null)
 assert.equal(normalizeCellFlag('bogus'), null)

 const cols = [
  { id: 'c-name', name: 'name', type: 'text', multiple: false },
  { id: 'c-age', name: 'age', type: 'integer', multiple: false },
 ]
 const cleanedFlags = normalizeRowFlags({
  'c-name': 'UNKNOWN',
  'c-age': 'incorrect',
  'c-missing': 'unknown',
  __proto__: 'incorrect',
  constructor: 'unknown',
  prototype: 'incorrect',
 }, cols)
 assert.deepEqual(cleanedFlags, { 'c-name': 'unknown', 'c-age': 'incorrect' })

 const row = { id: 'r1', values: { 'c-name': 'Ada', 'c-age': null } }
 assert.equal(getRowCellFlag(row, 'c-name'), null)
 assert.deepEqual(setRowCellFlag(row, 'c-age', 'unknown'), { changed: true, previousFlag: null, flag: 'unknown' })
 assert.deepEqual(row.flags, { 'c-age': 'unknown' })
 assert.equal(getRowCellFlag(row, 'c-age'), 'unknown')

 // Only one flag per cell: setting incorrect replaces unknown
 assert.deepEqual(setRowCellFlag(row, 'c-age', 'incorrect'), { changed: true, previousFlag: 'unknown', flag: 'incorrect' })
 assert.deepEqual(row.flags, { 'c-age': 'incorrect' })

 // Unsetting removes empty flags object cleanly
 assert.deepEqual(setRowCellFlag(row, 'c-age', 'none'), { changed: true, previousFlag: 'incorrect', flag: null })
 assert.equal(Object.hasOwn(row, 'flags'), false)
 assert.equal(setRowCellFlag(row, '__proto__', 'incorrect').changed, false)

 // serializeTableRow / parseStoredTables / loadLaneTables round-trip
 const plainRow = { id: 'r-plain', values: { 'c-name': 'Grace' } }
 assert.equal(Object.hasOwn(JSON.parse(serializeTableRow(plainRow)), 'flags'), false)
 const flaggedRow = { id: 'r-flagged', values: { 'c-name': 'Ada', 'c-age': 42 }, flags: { 'c-name': 'incorrect', 'c-age': 'unknown' } }
 assert.deepEqual(JSON.parse(serializeTableRow(flaggedRow)), flaggedRow)

 const reparsed = parseStoredTables(JSON.stringify([
  { id: 't1', name: 'people', columns: cols, rows: [plainRow, flaggedRow] },
 ]))
 assert.equal(Object.hasOwn(reparsed[0].rows[0], 'flags'), false)
 assert.deepEqual(reparsed[0].rows[1].flags, { 'c-name': 'incorrect', 'c-age': 'unknown' })

 const kvMap = new Map()
 const makeKv = (prefix = '') => {
  const qual = k => (prefix ? `${prefix}/${k}` : k)
  return {
   namespace(ns) { return makeKv(qual(ns)) },
   async get(k) { return kvMap.has(qual(k)) ? kvMap.get(qual(k)) : null },
   async set(k, v) { kvMap.set(qual(k), String(v)) },
   async delete(k) { kvMap.delete(qual(k)) },
  }
 }
 const rootKv = makeKv()
 const laneData = rootKv.namespace('lane-flags-unit')
 await saveLaneTables(rootKv, laneData, 'lane-flags-unit', reparsed)
 const loadedTables = await loadLaneTables(rootKv, laneData, 'lane-flags-unit')
 assert.equal(Object.hasOwn(loadedTables[0].rows[0], 'flags'), false)
 assert.deepEqual(loadedTables[0].rows[1].flags, { 'c-name': 'incorrect', 'c-age': 'unknown' })

 // Snapshot revision distinguishes flagged vs unflagged rows
 const revBefore = computeLaneSnapshotRevision({ laneId: 'l1', tables: loadedTables })
 setRowCellFlag(loadedTables[0].rows[0], 'c-name', 'unknown')
 const revAfter = computeLaneSnapshotRevision({ laneId: 'l1', tables: loadedTables })
 assert.notEqual(revBefore, revAfter)

 // syncTableRowsInMemory preserves flags on matched rows and applies _flags updates
 const syncRes = syncTableRowsInMemory(loadedTables, 'people', [
  { _rowId: 'r-plain', name: 'Grace Hopper', age: 85 },
  { _rowId: 'r-flagged', name: 'Ada Lovelace', age: 36, _flags: { name: 'none', age: 'incorrect' } },
 ])
 assert.equal(syncRes.ok, true)
 assert.equal(syncRes.changed, true)
 assert.deepEqual(loadedTables[0].rows[0].flags, { 'c-name': 'unknown' })
 assert.deepEqual(loadedTables[0].rows[1].flags, { 'c-age': 'incorrect' })
 const syncFlagOnly = syncTableRowsInMemory(loadedTables, 'people', [
  { _rowId: 'r-plain', name: 'Grace Hopper', age: 85, _flags: { name: 'incorrect' } },
  { _rowId: 'r-flagged', name: 'Ada Lovelace', age: 36, _flags: { age: 'incorrect' } },
 ])
 assert.equal(syncFlagOnly.changed, true)
 assert.deepEqual(loadedTables[0].rows[0].flags, { 'c-name': 'incorrect' })

 // Filter operators across scalar and multiple[] columns
 for (const colType of DATA_COLUMN_TYPES) {
  for (const multiple of [false, true]) {
   const ops = getFilterOperatorsForColumn({ id: `col-${colType}`, name: colType, type: colType, multiple })
   for (const flagOp of ['flagged_unknown', 'flagged_incorrect', 'is_flagged', 'not_flagged']) {
    assert.ok(ops.some(o => o.op === flagOp), `${colType}${multiple ? '[]' : ''} missing ${flagOp}`)
   }
  }
 }
 const filterTbl = {
  id: 'tf1',
  name: 'audit',
  columns: cols,
  rows: [
   { id: 'r1', values: { 'c-name': 'A', 'c-age': 1 }, flags: { 'c-name': 'unknown' } },
   { id: 'r2', values: { 'c-name': 'B', 'c-age': 2 }, flags: { 'c-name': 'incorrect' } },
   { id: 'r3', values: { 'c-name': 'C', 'c-age': 3 } },
  ],
 }
 assert.deepEqual(filterTableRows(filterTbl, [{ id: 'f1', columnId: 'c-name', operator: 'flagged_unknown' }]).matchedEntries.map(e => e.row.id), ['r1'])
 assert.deepEqual(filterTableRows(filterTbl, [{ id: 'f2', columnId: 'c-name', operator: 'flagged_incorrect' }]).matchedEntries.map(e => e.row.id), ['r2'])
 assert.deepEqual(filterTableRows(filterTbl, [{ id: 'f3', columnId: 'c-name', operator: 'is_flagged' }]).matchedEntries.map(e => e.row.id), ['r1', 'r2'])
 assert.deepEqual(filterTableRows(filterTbl, [{ id: 'f4', columnId: 'c-name', operator: 'not_flagged' }]).matchedEntries.map(e => e.row.id), ['r3'])
})

test('Data tab Cell menu & cell flags: input-matched square top-right button, blank/flag circles, Unknown (orange) / Incorrect (red) / None highlights, per-row storage, subtables, reload, remote sync, column delete, and Agent API', async () => {
 const indexHtml = await fs.readFile(new URL('./index.html', import.meta.url), 'utf8')
 assert.match(indexHtml, /--lane-data-cell-size:\s*20px;/)
 assert.match(indexHtml, /\.lane-data-cell-input\s*\{[^}]*height:\s*var\(--lane-data-cell-size,\s*20px\);/)
 assert.match(indexHtml, /\.lane-data-cell-select\s*\{[^}]*height:\s*var\(--lane-data-cell-size,\s*20px\);[^}]*line-height:\s*1\.2;[^}]*padding:\s*0 0\.25em;/s)
 assert.match(indexHtml, /\.lane-data-row-trigger\s*\{[^}]*height:\s*var\(--lane-data-cell-size,\s*20px\);[^}]*line-height:\s*1\.2;[^}]*padding:\s*0 0\.45em;/s)
 assert.match(indexHtml, /\.lane-data-row-cell-id\s*\{[^}]*line-height:\s*1\.2;[^}]*padding:\s*0 0\.32em;/s)
 assert.match(indexHtml, /\.lane-data-lane-open-btn\s*\{[^}]*height:\s*var\(--lane-data-cell-size,\s*20px\);[^}]*line-height:\s*1\.2;[^}]*padding:\s*0 0\.45em;/s)
 assert.match(indexHtml, /\.lane-data-cell-menu-btn\s*\{[^}]*aspect-ratio:\s*1\s*\/\s*1;[^}]*height:\s*var\(--lane-data-cell-size,\s*20px\);[^}]*top:\s*2px;[^}]*width:\s*var\(--lane-data-cell-size,\s*20px\);/)
 assert.match(indexHtml, /\.lane-data-cell-menu-circle,\s*\.lane-data-cell-menu-swatch\s*\{[^}]*border-radius:\s*50%;/)
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

 function createMockElement(tagName) {
  return {
   tag: tagName,
   tagName: String(tagName || '').toUpperCase(),
   nodeType: 1,
   style: { setProperty() {}, removeProperty() {}, getPropertyValue() { return '' } },
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
   readOnly: false,
   focused: false,
   removed: false,
   offsetWidth: 140,
   rect: { top: 40, left: 20, right: 320, bottom: 56, width: 640, height: 480 },
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
    this.children = []
    for (const n of nodes) this.appendChild(n)
   },
   addEventListener(event, handler) { this.listeners[event] = handler },
   focus() { this.focused = true },
   select() {},
   remove() {
    this.removed = true
    if (this.parentNode && this.parentNode.children) {
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
   namespace(name) { return createMockKV(qualify(name)) },
   withBasePath() { return client },
   setBasePath() {},
   async get(key) { return kv.has(qualify(key)) ? kv.get(qualify(key)) : null },
   async set(key, value) { kv.set(qualify(key), value) },
   async delete(key) { kv.delete(qualify(key)) },
  }
  return client
 }

 const rootKv = createMockKV()
 await createNewSession(rootKv, { name: 'Flags Session', dataDirConfirmed: true })

 let uuid = 0
 function createRuntime(initialPathname = '/') {
  const windowListeners = {}
  const docListeners = {}
  const mockWindow = {
   Array,
   Boolean,
   Date,
   JSON,
   Math,
   Object,
   Reflect,
   decodeURIComponent,
   crypto: { randomUUID: () => `flag-uuid-${++uuid}` },
   history: { pushState(_s, _t, url) { mockWindow.location.pathname = url } },
   location: { pathname: initialPathname },
   addEventListener(event, handler) {
    windowListeners[event] ||= []
    windowListeners[event].push(handler)
   },
   removeEventListener(event, handler) {
    windowListeners[event] = (windowListeners[event] || []).filter(h => h !== handler)
   },
  }
  const mockDocument = {
   body: createMockElement('body'),
   defaultView: mockWindow,
   createElement: createMockElement,
   addEventListener(event, handler) {
    docListeners[event] ||= []
    docListeners[event].push(handler)
   },
  }
  const dispatchDocumentClick = async target => {
   for (const handler of docListeners.click || []) {
    await handler({ target })
   }
  }
  const dispatchWindowKeydown = async ev => {
   for (const handler of windowListeners.keydown || []) {
    await handler(ev)
   }
  }
  const f = field({
   ...DATA_RUNTIME_ENV,
   console: { log() {}, error() {} },
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
   createSourceWorkerRunner: opts => createSourceWorkerRunner(opts),
   runLines,
   runTransportedScripts,
  })
  return { f, dispatchDocumentClick, dispatchWindowKeydown, mockWindow }
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
  const { f, dispatchDocumentClick, dispatchWindowKeydown, mockWindow } = createRuntime('/')
  await f.run(parse(mainSource, '/src/main.fs'))

  // 1. Create Owner lane with contacts + inbound notes subtable
  await f.state.tableHeadRowAddButton.listeners.click()
  const ownerLane = f.state.lanes[0]
  await ownerLane.notebook.tabs.data.listeners.click()
  const dv = ownerLane.notebook['data-view']
  const contactsTbl = await dv['add-table']('contacts')
  const nameCol = await dv['add-column']('name', 'text', false)
  const ageCol = await dv['add-column']('age', 'integer', false)
  const tagsCol = await dv['add-column']('tags', 'text', true)
  const cRow1 = await dv['add-row']()
  const cRow2 = await dv['add-row']()
  dv['grid-rows'][0].cells[0]['input-el'].value = 'Ada'
  await dv['grid-rows'][0].cells[0]['input-el'].listeners.input()
  dv['grid-rows'][0].cells[1]['input-el'].value = '36'
  await dv['grid-rows'][0].cells[1]['input-el'].listeners.input()
  dv['grid-rows'][1].cells[0]['input-el'].value = 'Grace'
  await dv['grid-rows'][1].cells[0]['input-el'].listeners.input()

  const notesTbl = await dv['add-table']('notes')
  await dv['add-column']('contact', 'text', false)
  notesTbl.columns[0].type = 'row'
  notesTbl.columns[0].refTableId = contactsTbl.id
  notesTbl.columns[0].refColumnId = nameCol.id
  notesTbl.columns[0].refDisplayColumnId = nameCol.id
  await dv['save-schema'](notesTbl)
  const noteTextCol = await dv['add-column']('note', 'text', false)
  const nRow1 = await dv['add-row']()
  nRow1.values[notesTbl.columns[0].id] = 'Ada'
  nRow1.values[noteTextCol.id] = 'Needs verification'
  await dv['save-row'](notesTbl, nRow1)

  await dv['select-table'](contactsTbl.id)
  await dv['display-options-btns'][0].el.listeners.click()

  // 2. Every data cell (scalar, multiple[], and inbound subtable) has top-right square "Cell menu" button
  const nameCell = dv['grid-rows'][0].cells[0]
  const ageCell = dv['grid-rows'][0].cells[1]
  const tagsCell = dv['grid-rows'][0].cells[2]
  const subNoteCell = dv['grid-rows'][0]['subtable-groups'][0].rows[0].cells[0]

  for (const cell of [nameCell, ageCell, tagsCell, subNoteCell]) {
   assert.ok(cell['menu-btn'], 'Expected menu-btn on cell')
   assert.equal(cell['menu-btn'].attributes['aria-label'], 'Cell menu')
   assert.equal(cell['menu-btn'].attributes['aria-haspopup'], 'menu')
   assert.equal(cell['menu-btn'].attributes['aria-expanded'], 'false')
   assert.equal(cell['menu-btn'].textContent, '')
   assert.equal(cell['menu-btn'].className, 'lane-data-cell-menu-btn')
   assert.ok(cell['menu-circle'], 'Expected menu-circle inside menu-btn')
   assert.equal(cell['menu-btn']['circle-el'], cell['menu-circle'])
   assert.equal(cell['menu-btn'].children[0], cell['menu-circle'])
   assert.equal(cell['menu-circle'].attributes['aria-hidden'], 'true')
   assert.equal(cell['menu-circle'].className, 'lane-data-cell-menu-circle')
   assert.equal(cell['menu-circle'].textContent, '')
   assert.match(cell.td.className, /lane-data-td--cell/)
   assert.equal(cell.td.children[cell.td.children.length - 1], cell['menu-btn'])
  }

  // 3. Open Cell menu on nameCell -> check header, active None option, descriptions, circular swatches
  const cellMenu = dv['cell-menu']
  assert.equal(cellMenu.hidden, true)
  await nameCell['menu-btn'].listeners.click({ stopPropagation() {} })
  assert.equal(cellMenu.hidden, false)
  assert.equal(dv['cell-menu-title-el'].textContent, 'Cell menu')
  assert.equal(dv['cell-menu-meta-el'].textContent, 'name · #1')
  assert.equal(nameCell['menu-btn'].attributes['aria-expanded'], 'true')
  assert.match(nameCell['menu-btn'].className, /lane-data-cell-menu-btn--open/)
  assert.equal(dv['cell-flag-none-btn'].attributes['aria-checked'], 'true')
  assert.equal(dv['cell-flag-none-btn'].children[0].textContent, '')
  assert.equal(dv['cell-flag-unknown-btn'].attributes['aria-checked'], 'false')
  assert.equal(dv['cell-flag-unknown-btn'].children[0].textContent, '?')
  assert.equal(dv['cell-flag-incorrect-btn'].attributes['aria-checked'], 'false')
  assert.equal(dv['cell-flag-incorrect-btn'].children[0].textContent, '!')
  assert.match(dv['cell-flag-unknown-btn'].children[1].children[1].textContent, /needed but missing/i)
  assert.match(dv['cell-flag-incorrect-btn'].children[1].children[1].textContent, /incomplete or wrong/i)

  // Clicking the inner circle element does not dismiss the menu as an outside click
  await dispatchDocumentClick(nameCell['menu-circle'])
  assert.equal(cellMenu.hidden, false)

  // Clicking the same button again closes the menu
  await nameCell['menu-btn'].listeners.click({ stopPropagation() {} })
  assert.equal(cellMenu.hidden, true)
  assert.equal(nameCell['menu-btn'].attributes['aria-expanded'], 'false')

  // Outside document click closes menu
  await nameCell['menu-btn'].listeners.click({ stopPropagation() {} })
  assert.equal(cellMenu.hidden, false)
  await dispatchDocumentClick(mockDocumentBodyPlaceholder())
  function mockDocumentBodyPlaceholder() { return createMockElement('div') }
  assert.equal(cellMenu.hidden, true)

  // Escape closes menu
  await nameCell['menu-btn'].listeners.click({ stopPropagation() {} })
  assert.equal(cellMenu.hidden, false)
  await dispatchWindowKeydown({ key: 'Escape' })
  assert.equal(cellMenu.hidden, true)

  // 4. Mark nameCell Unknown -> orange highlight, circle '?', stored per row
  await nameCell['menu-btn'].listeners.click({ stopPropagation() {} })
  await dv['cell-flag-unknown-btn'].listeners.click({ stopPropagation() {} })
  assert.equal(cellMenu.hidden, true)
  assert.deepEqual(cRow1.flags, { [nameCol.id]: 'unknown' })
  assert.equal(Object.hasOwn(cRow2, 'flags'), false)
  assert.match(nameCell.td.className, /lane-data-td--flag-unknown/)
  assert.doesNotMatch(nameCell.td.className, /lane-data-td--flag-incorrect/)
  assert.equal(nameCell.td.attributes['data-cell-flag'], 'unknown')
  assert.equal(nameCell['menu-btn'].textContent, '')
  assert.equal(nameCell['menu-circle'].textContent, '?')
  assert.equal(nameCell['menu-circle'].className, 'lane-data-cell-menu-circle lane-data-cell-menu-circle--unknown')
  assert.equal(nameCell['menu-btn'].attributes['aria-label'], 'Cell menu')
  assert.match(nameCell['menu-btn'].className, /lane-data-cell-menu-btn--unknown/)

  // 5. Switch directly to Incorrect -> only one flag per cell, red highlight, circle '!'
  await nameCell['menu-btn'].listeners.click({ stopPropagation() {} })
  assert.equal(dv['cell-flag-unknown-btn'].attributes['aria-checked'], 'true')
  await dv['cell-flag-incorrect-btn'].listeners.click({ stopPropagation() {} })
  assert.deepEqual(cRow1.flags, { [nameCol.id]: 'incorrect' })
  assert.match(nameCell.td.className, /lane-data-td--flag-incorrect/)
  assert.doesNotMatch(nameCell.td.className, /lane-data-td--flag-unknown/)
  assert.equal(nameCell.td.attributes['data-cell-flag'], 'incorrect')
  assert.equal(nameCell['menu-btn'].textContent, '')
  assert.equal(nameCell['menu-circle'].textContent, '!')
  assert.equal(nameCell['menu-circle'].className, 'lane-data-cell-menu-circle lane-data-cell-menu-circle--incorrect')
  assert.equal(nameCell['menu-btn'].attributes['aria-label'], 'Cell menu')
  assert.match(nameCell['menu-btn'].className, /lane-data-cell-menu-btn--incorrect/)

  // Editing cell value & resizing column width preserve cell flag & highlight
  nameCell['input-el'].value = 'Ada L.'
  await nameCell['input-el'].listeners.input()
  await dv['apply-column-width'](0, 210)
  assert.equal(cRow1.flags[nameCol.id], 'incorrect')
  assert.match(nameCell.td.className, /lane-data-td--flag-incorrect/)
  assert.match(nameCell.td.className, /lane-data-td--sized/)

  // 6. Flag multiple[] cell Unknown (orange) and subtable cell Incorrect (red)
  await tagsCell['menu-btn'].listeners.click({ stopPropagation() {} })
  await dv['cell-flag-unknown-btn'].listeners.click({ stopPropagation() {} })
  assert.deepEqual(cRow1.flags, { [nameCol.id]: 'incorrect', [tagsCol.id]: 'unknown' })
  assert.match(tagsCell.td.className, /lane-data-td--flag-unknown/)
  assert.match(tagsCell['multi-wrap'].className, /lane-data-multi--flag-unknown/)

  await subNoteCell['menu-btn'].listeners.click({ stopPropagation() {} })
  await dv['cell-flag-incorrect-btn'].listeners.click({ stopPropagation() {} })
  assert.deepEqual(nRow1.flags, { [noteTextCol.id]: 'incorrect' })
  assert.match(subNoteCell.td.className, /lane-data-td--flag-incorrect/)

  // 7. Flag filter updates rows and clearing via None restores normal state
  const nameFilterCell = dv['grid-filter-cells'].find(fc => fc.col && fc.col.id === nameCol.id)
  await nameFilterCell['add-btn'].listeners.click({ stopPropagation() {} })
  dv['filter-op-select'].value = 'flagged_incorrect'
  await dv['filter-op-select'].listeners.change()
  await dv['filter-apply-btn'].listeners.click()
  assert.equal(dv['grid-rows'].length, 1)
  assert.equal(dv['grid-rows'][0].row.id, cRow1.id)

  await dv['grid-rows'][0].cells[0]['menu-btn'].listeners.click({ stopPropagation() {} })
  await dv['cell-flag-none-btn'].listeners.click({ stopPropagation() {} })
  assert.deepEqual(cRow1.flags, { [tagsCol.id]: 'unknown' })
  assert.equal(dv['grid-rows'].length, 0)
  await dv['reset-active-view']()
  assert.equal(dv['grid-rows'].length, 2)
  assert.doesNotMatch(dv['grid-rows'][0].cells[0].td.className, /lane-data-td--flag-/)
  assert.equal(dv['grid-rows'][0].cells[0]['menu-btn'].textContent, '')
  assert.equal(dv['grid-rows'][0].cells[0]['menu-circle'].textContent, '')
  assert.equal(dv['grid-rows'][0].cells[0]['menu-circle'].className, 'lane-data-cell-menu-circle')

  // Mark ageCell Unknown so row 1 has age=unknown and tags=unknown before reload
  await dv['grid-rows'][0].cells[1]['menu-btn'].listeners.click({ stopPropagation() {} })
  await dv['cell-flag-unknown-btn'].listeners.click({ stopPropagation() {} })
  assert.deepEqual(cRow1.flags, { [tagsCol.id]: 'unknown', [ageCol.id]: 'unknown' })

  // 8. Reload runtime and verify flags & highlights persist across reload
  const reloaded = createRuntime(mockWindow.location.pathname)
  await reloaded.f.run(parse(mainSource, '/src/main.fs'))
  const rLane = reloaded.f.state.lanes[0]
  const rDv = rLane.notebook['data-view']
  await rDv['select-table'](contactsTbl.id)
  const rContacts = rDv.tables.find(t => t.id === contactsTbl.id)
  assert.deepEqual(rContacts.rows[0].flags, { [tagsCol.id]: 'unknown', [ageCol.id]: 'unknown' })
  assert.equal(Object.hasOwn(rContacts.rows[1], 'flags'), false)
  assert.match(rDv['grid-rows'][0].cells[1].td.className, /lane-data-td--flag-unknown/)
  assert.equal(rDv['grid-rows'][0].cells[1]['menu-btn'].textContent, '')
  assert.equal(rDv['grid-rows'][0].cells[1]['menu-circle'].textContent, '?')
  assert.equal(rDv['grid-rows'][0].cells[1]['menu-circle'].className, 'lane-data-cell-menu-circle lane-data-cell-menu-circle--unknown')
  assert.match(rDv['grid-rows'][0].cells[2].td.className, /lane-data-td--flag-unknown/)

  // 9. Remote imported tables: read-only disables Cell menu & blocks set-cell-flag; read-write propagates flags
  await reloaded.f.state.tableHeadRowAddButton.listeners.click()
  const roLane = reloaded.f.state.lanes[1]
  await roLane.notebook.tabs.data.listeners.click()
  const roDv = roLane.notebook['data-view']
  const roTbl = await roDv['import-table']({
   laneId: rLane.id,
   tableId: contactsTbl.id,
   tableName: 'contacts',
   mode: 'read-only',
   localName: 'ro_contacts',
   columns: rContacts.columns,
   rows: rContacts.rows,
  })
  assert.equal(roDv['grid-rows'][0].cells[1]['menu-btn'].disabled, true)
  assert.match(roDv['grid-rows'][0].cells[1].td.className, /lane-data-td--flag-unknown/)
  await roDv['set-cell-flag'](roTbl, roTbl.rows[0], ageCol, 'incorrect')
  assert.equal(roTbl.rows[0].flags[ageCol.id], 'unknown')

  await reloaded.f.state.tableHeadRowAddButton.listeners.click()
  const rwLane = reloaded.f.state.lanes[2]
  await rwLane.notebook.tabs.data.listeners.click()
  const rwDv = rwLane.notebook['data-view']
  const rwTbl = await rwDv['import-table']({
   laneId: rLane.id,
   tableId: contactsTbl.id,
   tableName: 'contacts',
   mode: 'read-write',
   localName: 'rw_contacts',
   columns: rContacts.columns,
   rows: rContacts.rows,
  })
  assert.equal(rwDv['grid-rows'][0].cells[0]['menu-btn'].disabled, false)
  await rwDv['grid-rows'][0].cells[0]['menu-btn'].listeners.click({ stopPropagation() {} })
  await rwDv['cell-flag-incorrect-btn'].listeners.click({ stopPropagation() {} })
  assert.equal(rContacts.rows[0].flags[nameCol.id], 'incorrect')
  assert.match(rDv['grid-rows'][0].cells[0].td.className, /lane-data-td--flag-incorrect/)

  // 10. Deleting a flagged column strips its key from row.flags
  await rDv['request-delete-column'](rContacts, 1) // delete ageCol
  await rDv['confirm-modal']['confirm-btn'].listeners.click()
  assert.equal(rContacts.rows[0].flags[ageCol.id], undefined)
  assert.deepEqual(rContacts.rows[0].flags, { [tagsCol.id]: 'unknown', [nameCol.id]: 'incorrect' })

  // 11. Agent API supports flags on add-row, preserves flags on update-row, and supports set-flag
  const agentAdded = await agentMutateLaneTable(rootKv, {
   laneId: rLane.id,
   action: 'add-row',
   table: 'contacts',
   values: { name: 'Linus' },
   flags: { name: 'unknown' },
  })
  assert.equal(agentAdded.ok, true)
  assert.deepEqual(agentAdded.row.flags, { [nameCol.id]: 'unknown' })
  assert.deepEqual(agentAdded.table.namedRows.find(nr => nr._rowId === agentAdded.row.id)._flags, { name: 'unknown' })

  const agentUpdated = await agentMutateLaneTable(rootKv, {
   laneId: rLane.id,
   action: 'update-row',
   table: 'contacts',
   rowId: agentAdded.row.id,
   values: { name: 'Linus T.' },
  })
  assert.equal(agentUpdated.ok, true)
  assert.deepEqual(agentUpdated.row.flags, { [nameCol.id]: 'unknown' })

  const agentFlagged = await agentMutateLaneTable(rootKv, {
   laneId: rLane.id,
   action: 'set-flag',
   table: 'contacts',
   rowId: agentAdded.row.id,
   column: 'name',
   flag: 'incorrect',
  })
  assert.equal(agentFlagged.ok, true)
  assert.deepEqual(agentFlagged.row.flags, { [nameCol.id]: 'incorrect' })

  const agentCleared = await agentMutateLaneTable(rootKv, {
   laneId: rLane.id,
   action: 'set-flag',
   table: 'contacts',
   rowId: agentAdded.row.id,
   column: 'name',
   flag: 'none',
  })
  assert.equal(agentCleared.ok, true)
  assert.equal(Object.hasOwn(agentCleared.row, 'flags'), false)

  const agentBadFlag = await agentMutateLaneTable(rootKv, {
   laneId: rLane.id,
   action: 'set-flag',
   table: 'contacts',
   rowId: agentAdded.row.id,
   column: 'name',
   flag: 'invalid_flag',
  })
  assert.equal(agentBadFlag.ok, false)

  const fetched = await agentGetLane(rootKv, { laneId: rLane.id })
  const fetchedContacts = fetched.lane.tables.find(t => t.name === 'contacts')
  const row0Named = fetchedContacts.namedRows.find(nr => nr._rowId === rContacts.rows[0].id)
  assert.deepEqual(row0Named._flags, { name: 'incorrect', tags: 'unknown' })
 }
 finally {
  globalThis.fetch = origFetch
 }
})

test('Data table 3-row sticky thead (separate same-size type row), 100vh max-height, left-frozen # column only, narrow resize, and subtable header rows', async () => {
 const indexHtml = await fs.readFile(new URL('./index.html', import.meta.url), 'utf8')
 assert.match(indexHtml, /--lane-data-head-row-size:\s*24px;/)
 assert.match(indexHtml, /\.lane-data-grid-wrap\s*\{[^}]*box-sizing:\s*border-box;[^}]*max-height:\s*100vh;[^}]*overflow:\s*auto;/s)
 assert.match(indexHtml, /\.lane-data-grid\s*\{[^}]*border-collapse:\s*separate;[^}]*border-spacing:\s*0;/s)
 assert.match(indexHtml, /\.lane-data-subtable-grid\s*\{[^}]*border-collapse:\s*separate;[^}]*border-spacing:\s*0;/s)
 assert.match(
  indexHtml,
  /\.lane-data-head-row\s*>\s*\.lane-data-th,\s*\.lane-data-type-row\s*>\s*\.lane-data-th\s*\{[^}]*height:\s*var\(--lane-data-head-row-size,\s*24px\);[^}]*padding-bottom:\s*0;[^}]*padding-top:\s*0;[^}]*vertical-align:\s*middle;/s
 )
 assert.match(indexHtml, /\.lane-data-grid-wrap\s*>\s*\.lane-data-grid\s*>\s*thead\s*\{[^}]*position:\s*sticky;[^}]*top:\s*0;/s)
 assert.match(indexHtml, /\.lane-data-grid-wrap\s*>\s*\.lane-data-grid\s*>\s*thead\s*>\s*\.lane-data-head-row\s*>\s*\.lane-data-th\s*\{[^}]*background:\s*#212121;/s)
 assert.match(indexHtml, /\.lane-data-grid-wrap\s*>\s*\.lane-data-grid\s*>\s*thead\s*>\s*\.lane-data-type-row\s*>\s*\.lane-data-th\s*\{[^}]*background:\s*#1e1e1e;/s)
 assert.match(indexHtml, /\.lane-data-grid-wrap\s*>\s*\.lane-data-grid\s*>\s*thead\s*>\s*\.lane-data-filter-row\s*>\s*\.lane-data-th\s*\{[^}]*background:\s*#1c1c1c;/s)
 assert.match(indexHtml, /\.lane-fullscreen-body\s+\.lane-data-grid-wrap\s*>\s*\.lane-data-grid\s*>\s*thead\s*>\s*\.lane-data-head-row\s*>\s*\.lane-data-th\s*\{[^}]*background:\s*#0b0b0b;/s)
 assert.match(indexHtml, /\.lane-fullscreen-body\s+\.lane-data-grid-wrap\s*>\s*\.lane-data-grid\s*>\s*thead\s*>\s*\.lane-data-type-row\s*>\s*\.lane-data-th\s*\{[^}]*background:\s*#080808;/s)
 assert.match(indexHtml, /\.lane-fullscreen-body\s+\.lane-data-grid-wrap\s*>\s*\.lane-data-grid\s*>\s*thead\s*>\s*\.lane-data-filter-row\s*>\s*\.lane-data-th\s*\{[^}]*background:\s*#050505;/s)
 assert.match(indexHtml, /\.lane-data-grid-wrap\s*>\s*\.lane-data-grid\s*>\s*thead\s*>\s*tr\s*>\s*\.lane-data-th--num\s*\{[^}]*left:\s*0;[^}]*position:\s*sticky;/s)
 assert.match(indexHtml, /\.lane-data-grid-wrap\s*>\s*\.lane-data-grid\s*>\s*tbody\s*>\s*tr\s*>\s*\.lane-data-td--num\s*\{[^}]*background:\s*#1a1a1a;[^}]*left:\s*0;[^}]*position:\s*sticky;/s)
 assert.match(indexHtml, /\.lane-fullscreen-body\s+\.lane-data-grid-wrap\s*>\s*\.lane-data-grid\s*>\s*tbody\s*>\s*tr\s*>\s*\.lane-data-td--num\s*\{[^}]*background:\s*#000000;/s)
 assert.match(indexHtml, /\.lane-data-type-th\s+\.lane-data-th-type\s*\{[^}]*max-width:\s*100%;[^}]*overflow:\s*hidden;[^}]*text-overflow:\s*ellipsis;/s)

 // Confirm only the 3-row thead and '#' column selectors declare sticky inside .lane-data-grid-wrap
 const stickyRules = [...indexHtml.matchAll(/([^\{\}]+)\{[^}]*position:\s*sticky;[^}]*\}/gs)]
  .map(m => m[1].trim())
  .filter(sel => sel.includes('.lane-data-'))
 assert.deepEqual(stickyRules, [
  '.lane-data-grid-wrap > .lane-data-grid > thead',
  '.lane-data-grid-wrap > .lane-data-grid > thead > tr > .lane-data-th--num',
  '.lane-data-grid-wrap > .lane-data-grid > tbody > tr > .lane-data-td--num',
 ])

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

 function createMockElement(tagName) {
  return {
   tag: tagName,
   tagName: String(tagName || '').toUpperCase(),
   nodeType: 1,
   style: { setProperty() {}, removeProperty() {}, getPropertyValue() { return '' } },
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
   readOnly: false,
   offsetWidth: 140,
   rect: { top: 40, left: 20, right: 320, bottom: 56, width: 140, height: 24 },
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
    this.children = []
    for (const n of nodes) this.appendChild(n)
   },
   addEventListener(event, handler) { this.listeners[event] = handler },
   focus() { this.focused = true },
   select() {},
   remove() {
    this.removed = true
    if (this.parentNode && this.parentNode.children) {
     const idx = this.parentNode.children.indexOf(this)
     if (idx !== -1) this.parentNode.children.splice(idx, 1)
     this.parentNode = null
    }
   },
  }
 }

 const kv = new Map()
 const rootKv = {
  namespace(name) {
   const prefix = `${name}.`
   const child = {
    namespace(sub) { return rootKv.namespace(`${name}.${sub}`) },
    withBasePath() { return child },
    setBasePath() {},
    async get(key) { return kv.has(prefix + key) ? kv.get(prefix + key) : null },
    async set(key, value) { kv.set(prefix + key, value) },
    async delete(key) { kv.delete(prefix + key) },
   }
   return child
  },
  withBasePath() { return rootKv },
  setBasePath() {},
  async get(key) { return kv.has(key) ? kv.get(key) : null },
  async set(key, value) { kv.set(key, value) },
  async delete(key) { kv.delete(key) },
 }
 await createNewSession(rootKv, { name: 'Sticky Head Session', dataDirConfirmed: true })

 const windowListeners = {}
 const dispatchWindowEvent = async (event, ev) => {
  for (const handler of [...(windowListeners[event] || [])]) {
   await handler(ev)
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
  crypto: { randomUUID: () => `head-uuid-${++uuid}` },
  history: { pushState() {} },
  location: { pathname: '/' },
  addEventListener(event, handler) {
   windowListeners[event] ||= []
   windowListeners[event].push(handler)
  },
  removeEventListener(event, handler) {
   windowListeners[event] = (windowListeners[event] || []).filter(h => h !== handler)
  },
 }
 const mockDocument = {
  body: createMockElement('body'),
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
   console: { log() {}, error() {} },
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
  })
  await f.run(parse(mainSource, '/src/main.fs'))

  await f.state.tableHeadRowAddButton.listeners.click()
  const lane = f.state.lanes[0]
  await lane.notebook.tabs.data.listeners.click()
  const dv = lane.notebook['data-view']

  // Parent table `accounts` + inbound `entries` subtable
  const accountsTbl = await dv['add-table']('accounts')
  await dv['add-column']('account_label', 'text', false)
  await dv['add-column']('amount', 'fixed', false)
  await dv['add-row']()
  dv['grid-rows'][0].cells[0]['input-el'].value = 'Checking'
  await dv['grid-rows'][0].cells[0]['input-el'].listeners.input()

  const entriesTbl = await dv['add-table']('entries')
  await dv['add-column']('account', 'text', false)
  entriesTbl.columns[0].type = 'row'
  entriesTbl.columns[0].refTableId = accountsTbl.id
  entriesTbl.columns[0].refColumnId = accountsTbl.columns[0].id
  await dv['save-schema'](entriesTbl)
  await dv['add-column']('memo', 'text', false)
  await dv['add-row']()
  entriesTbl.rows[0].values[entriesTbl.columns[0].id] = 'Checking'
  await dv['save-row'](entriesTbl, entriesTbl.rows[0], 0)

  // Switch back to parent `accounts` table and check 3-row thead layout
  await dv['select-table'](accountsTbl.id)
  const thead = dv['grid-hrow'].parentNode
  assert.equal(thead.children.length, 3)
  assert.equal(thead.children[0], dv['grid-hrow'])
  assert.equal(thead.children[1], dv['grid-trow'])
  assert.equal(thead.children[2], dv['grid-frow'])
  assert.equal(dv['grid-hrow'].className, 'lane-data-head-row')
  assert.equal(dv['grid-trow'].className, 'lane-data-type-row')
  assert.equal(dv['grid-frow'].className, 'lane-data-filter-row')

  // Row 1 holds only column names; Row 2 holds types; Row 3 holds filters (num + 2 cols + actions = 4)
  assert.equal(dv['grid-head-cells'].length, 4)
  assert.equal(dv['grid-type-cells'].length, 4)
  assert.equal(dv['grid-filter-cells'].length, 4)
  assert.equal(dv['grid-head-cells'][0].kind, 'num')
  assert.equal(dv['grid-head-cells'][0].el.textContent, '#')
  assert.equal(dv['grid-type-cells'][0].kind, 'num')
  assert.equal(dv['grid-type-cells'][0].el.className, 'lane-data-th lane-data-th--num lane-data-type-th lane-data-type-th--num')
  assert.equal(dv['grid-type-cells'][0].el.textContent, '')

  const col0Head = dv['grid-head-cells'][1]
  const col0Type = dv['grid-type-cells'][1]
  const col1Type = dv['grid-type-cells'][2]
  assert.equal(col0Head.el.children[0].children.length, 1)
  assert.equal(col0Head.el.children[0].children[0], col0Head['name-el'])
  assert.equal(col0Head['name-el'].className, 'lane-data-th-name')
  assert.equal(col0Head['name-el'].textContent, 'account_label')
  assert.equal(col0Head['name-el'].title, 'account_label')
  assert.equal(col0Head['type-el'], col0Type['type-el'])
  assert.equal(col0Type.el.className, 'lane-data-th lane-data-type-th')
  assert.equal(col0Type['inner-el'].className, 'lane-data-th-inner lane-data-type-th-inner')
  assert.equal(col0Type['inner-el'].children.length, 1)
  assert.equal(col0Type['inner-el'].children[0], col0Type['type-el'])
  assert.equal(col0Type['type-el'].className, 'lane-data-th-type')
  assert.equal(col0Type['type-el'].textContent, 'text')
  assert.equal(col1Type['type-el'].textContent, 'fixed(2)')
  assert.equal(dv['grid-type-cells'][3].kind, 'actions')
  assert.equal(dv['grid-type-cells'][3].el.className, 'lane-data-th lane-data-th--actions lane-data-type-th lane-data-type-th--actions')

  // Live schema rename updates both textContent and tooltip title on Row 1
  dv['schema-rows'][0]['name-el'].value = 'acct_name'
  await dv['schema-rows'][0]['name-el'].listeners.input()
  assert.equal(col0Head['name-el'].textContent, 'acct_name')
  assert.equal(col0Head['name-el'].title, 'acct_name')

  // Dragging Row 2 type-row resizer down to narrow 48px keeps Row 1, Row 2, Row 3, and body cells synchronized
  await col0Type['resizer-el'].listeners.mousedown({ clientX: 200, preventDefault() {}, stopPropagation() {} })
  await dispatchWindowEvent('mousemove', { clientX: 100 })
  await dispatchWindowEvent('mouseup', {})
  assert.equal(accountsTbl.columns[0].width, 48)
  assert.equal(col0Head.el.style.width, '48px')
  assert.equal(col0Type.el.style.width, '48px')
  assert.equal(dv['grid-filter-cells'][1].el.style.width, '48px')
  assert.equal(dv['grid-rows'][0].cells[0].td.style.width, '48px')
  assert.match(col0Type.el.className, /lane-data-th--sized/)
  assert.match(dv['grid-filter-cells'][1].el.className, /lane-data-th--sized/)

  await col0Type['resizer-el'].listeners.dblclick()
  assert.equal(Object.hasOwn(accountsTbl.columns[0], 'width'), false)
  assert.equal(col0Head.el.style.width, '')
  assert.equal(col0Type.el.style.width, '')
  assert.equal(dv['grid-filter-cells'][1].el.style.width, '')
  assert.equal(dv['grid-rows'][0].cells[0].td.style.width, '')

  // Toggling inbound subtable visible keeps subtoggle/num/cols/actions aligned across all 3 header rows & splits subtable thead into 2 rows
  await dv['display-options-btns'][0].el.listeners.click()
  assert.equal(dv['grid-head-cells'].length, 5)
  assert.equal(dv['grid-type-cells'].length, 5)
  assert.equal(dv['grid-filter-cells'].length, 5)
  assert.equal(dv['grid-head-cells'][0].kind, 'subtoggle')
  assert.equal(dv['grid-type-cells'][0].kind, 'subtoggle')
  assert.equal(dv['grid-type-cells'][1].kind, 'num')
  assert.equal(dv['grid-type-cells'][2]['type-el'].textContent, 'text')
  assert.equal(dv['grid-type-cells'][3]['type-el'].textContent, 'fixed(2)')
  assert.equal(dv['grid-type-cells'][4].kind, 'actions')

  const subGroup = dv['grid-rows'][0]['subtable-groups'][0]
  const subGrid = subGroup['body-el'].children[0]
  const subThead = subGrid.children[0]
  assert.equal(subThead.children.length, 2)
  assert.equal(subThead.children[0].className, 'lane-data-head-row')
  assert.equal(subThead.children[1].className, 'lane-data-type-row')
  assert.equal(subThead.children[0].children[1].children[0].children.length, 1)
  assert.equal(subThead.children[0].children[1].children[0].children[0].className, 'lane-data-th-name')
  assert.equal(subThead.children[0].children[1].children[0].children[0].textContent, 'memo')
  assert.equal(subThead.children[1].children[1].children[0].children[0].className, 'lane-data-th-type')
  assert.equal(subThead.children[1].children[1].children[0].children[0].textContent, 'text')
 }
 finally {
  globalThis.fetch = origFetch
 }
})

test('Row schema compactness: Table+Column inline, Display options (None, Template, columns) + conditional Template visibility & persistence', async () => {
 const indexHtml = await fs.readFile(new URL('./index.html', import.meta.url), 'utf8')
 assert.match(indexHtml, /\.lane-data-row-line\s*\{[^}]*display:\s*flex;[^}]*flex-wrap:\s*nowrap;/s)
 assert.match(indexHtml, /\.lane-data-row-line--display-template\s*>\s*\.lane-data-row-field--inline:first-child\s*\{/)

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

 function createMockElement(tagName) {
  return {
   tag: tagName,
   tagName: String(tagName || '').toUpperCase(),
   nodeType: 1,
   style: { setProperty() {}, removeProperty() {}, getPropertyValue() { return '' } },
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
   readOnly: false,
   rect: { top: 40, left: 20, right: 320, bottom: 56, width: 140, height: 24 },
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
    this.children = []
    for (const n of nodes) this.appendChild(n)
   },
   addEventListener(event, handler) { this.listeners[event] = handler },
   focus() { this.focused = true },
   select() {},
   remove() {
    this.removed = true
    if (this.parentNode && this.parentNode.children) {
     const idx = this.parentNode.children.indexOf(this)
     if (idx !== -1) this.parentNode.children.splice(idx, 1)
     this.parentNode = null
    }
   },
  }
 }

 const kv = new Map()
 const rootKv = {
  namespace(name) {
   const prefix = `${name}.`
   const child = {
    namespace(sub) { return rootKv.namespace(`${name}.${sub}`) },
    withBasePath() { return child },
    setBasePath() {},
    async get(key) { return kv.has(prefix + key) ? kv.get(prefix + key) : null },
    async set(key, value) { kv.set(prefix + key, value) },
    async delete(key) { kv.delete(prefix + key) },
   }
   return child
  },
  withBasePath() { return rootKv },
  setBasePath() {},
  async get(key) { return kv.has(key) ? kv.get(key) : null },
  async set(key, value) { kv.set(key, value) },
  async delete(key) { kv.delete(key) },
 }
 await createNewSession(rootKv, { name: 'Row Compact Session', dataDirConfirmed: true })

 let uuid = 0
 let currentPathname = '/'
 function createRuntime() {
  const mockWindow = {
   Array,
   Boolean,
   Date,
   JSON,
   Math,
   Object,
   Reflect,
   decodeURIComponent,
   crypto: { randomUUID: () => `row-compact-uuid-${++uuid}` },
   history: { pushState(_s, _t, url) { currentPathname = url; mockWindow.location.pathname = url } },
   location: { pathname: currentPathname },
   addEventListener() {},
   removeEventListener() {},
  }
  const mockDocument = {
   body: createMockElement('body'),
   defaultView: mockWindow,
   createElement: createMockElement,
   addEventListener() {},
  }
  return field({
   ...DATA_RUNTIME_ENV,
   console: { log() {}, error() {} },
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
  })
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
  const f = createRuntime()
  await f.run(parse(mainSource, '/src/main.fs'))
  await f.state.tableHeadRowAddButton.listeners.click()
  const lane = f.state.lanes[0]
  await lane.notebook.tabs.data.listeners.click()
  const dv = lane.notebook['data-view']

  // Table 1: `people` with id (integer), first (text), last (text) + legacy API template column test table
  const peopleTbl = await dv['add-table']('people')
  const pidCol = await dv['add-column']('id', 'integer', false)
  const firstCol = await dv['add-column']('first', 'text', false)
  const lastCol = await dv['add-column']('last', 'text', false)
  const pRow = await dv['add-row']()
  pRow.values[pidCol.id] = 42
  pRow.values[firstCol.id] = 'Ada'
  pRow.values[lastCol.id] = 'Lovelace'
  await dv['save-row'](peopleTbl, pRow, 0)

  // Table 2: `tasks` with `assignee` (row) and `legacy_ref` (row pre-populated with refDisplayTemplate)
  const tasksTbl = await dv['add-table']('tasks')
  const assigneeCol = await dv['add-column']('assignee', 'text', false)
  const legacyCol = await dv['add-column']('legacy_ref', 'text', false)
  legacyCol.type = 'row'
  legacyCol.refTableId = peopleTbl.id
  legacyCol.refColumnId = pidCol.id
  legacyCol.refDisplayColumnId = ''
  legacyCol.refDisplayTemplate = '; add $last'
  await dv['save-schema'](tasksTbl)
  await dv['render']()

  // Legacy/API column with saved refDisplayTemplate opens directly with Display = Template and Template shown
  let legacySrow = dv['schema-rows'][1]
  assert.equal(legacySrow['ref-display-el'].value, '$template')
  assert.equal(legacySrow['ref-tmpl-field'].hidden, false)
  assert.equal(legacySrow['ref-tmpl-details'].hidden, false)
  assert.equal(legacySrow['ref-tmpl-el'].value, '; add $last')
  assert.match(legacySrow['ref-disp-line'].className, /lane-data-row-line--display-template/)

  // Convert `assignee` to row -> verify compact single-line groupings & Display options
  dv['schema-rows'][0]['type-el'].value = 'row'
  await dv['schema-rows'][0]['type-el'].listeners.change()
  let srow = dv['schema-rows'][0]
  assert.equal(srow['row-config-wrap'].children[0], srow['ref-target-line'])
  assert.deepEqual(srow['ref-target-line'].children, [srow['ref-table-field'], srow['ref-col-field']])
  assert.equal(srow['row-config-wrap'].children[1], srow['ref-disp-line'])
  assert.deepEqual(srow['ref-disp-line'].children, [srow['ref-disp-field'], srow['ref-tmpl-field']])
  assert.equal(srow['ref-tmpl-field'].hidden, true)
  assert.equal(srow['ref-tmpl-details'].hidden, true)
  assert.doesNotMatch(srow['ref-disp-line'].className, /lane-data-row-line--display-template/)

  // Pick Table = people and Column = id
  srow['ref-table-el'].value = peopleTbl.id
  await srow['ref-table-el'].listeners.change()
  srow = dv['schema-rows'][0]
  assert.deepEqual(
   srow['ref-display-el'].children.map(o => ({ v: o.value, t: o.textContent })),
   [
    { v: '', t: 'None' },
    { v: '$template', t: 'Template' },
    { v: pidCol.id, t: 'id (integer)' },
    { v: firstCol.id, t: 'first (text)' },
    { v: lastCol.id, t: 'last (text)' },
   ]
  )
  assert.equal(srow['ref-display-el'].value, '')
  assert.equal(srow['ref-tmpl-field'].hidden, true)
  assert.equal(srow['ref-tmpl-details'].hidden, true)

  srow['ref-col-el'].value = pidCol.id
  await srow['ref-col-el'].listeners.change()
  srow = dv['schema-rows'][0]
  assert.equal(srow['ref-tmpl-field'].hidden, true)

  // Pick a regular column (`first`) -> Template remains hidden
  srow['ref-display-el'].value = firstCol.id
  await srow['ref-display-el'].listeners.change()
  srow = dv['schema-rows'][0]
  assert.equal(srow['ref-display-el'].value, firstCol.id)
  assert.equal(srow['ref-tmpl-field'].hidden, true)
  assert.equal(srow['ref-tmpl-details'].hidden, true)
  assert.equal(srow['row-hint-el'].textContent, 'Stores integer · displays first')

  // Switch Display to `Template` -> Template field & details appear on the Display line
  srow['ref-display-el'].value = '$template'
  await srow['ref-display-el'].listeners.change()
  srow = dv['schema-rows'][0]
  assert.equal(srow['ref-display-el'].value, '$template')
  assert.equal(srow['ref-tmpl-field'].hidden, false)
  assert.equal(srow['ref-tmpl-details'].hidden, false)
  assert.match(srow['ref-disp-line'].className, /lane-data-row-line--display-template/)
  assert.equal(srow['row-hint-el'].textContent, 'Stores integer · enter display template')

  // Click token chips / type template and add row -> grid renders template & persists across reload
  await srow['ref-tmpl-tools'].children[1].listeners.click() // inserts $first (ignored incomplete parse, still visible)
  srow = dv['schema-rows'][0]
  assert.equal(srow['ref-tmpl-el'].value, '$first')
  srow['ref-tmpl-el'].value = "; add $first ' ' $last"
  await srow['ref-tmpl-el'].listeners.change()
  srow = dv['schema-rows'][0]
  assert.equal(tasksTbl.columns[0].refDisplayTemplate, "; add $first ' ' $last")
  assert.equal(srow['ref-tmpl-preview'].textContent, 'Ada Lovelace')
  assert.equal(srow['row-hint-el'].textContent, "Stores integer · template ; add $first ' ' $last")
  assert.match(dv['grid-type-cells'][1]['type-el'].title, /template ; add \$first ' ' \$last/)

  const tRow = await dv['add-row']()
  tRow.values[assigneeCol.id] = 42
  await dv['save-row'](tasksTbl, tRow, 0)
  await dv['render-grid']()
  assert.equal(dv['grid-rows'][0].cells[0]['display-el'].textContent, 'Ada Lovelace')

  // Clearing template text while Display = Template keeps Template selected and field visible
  srow = dv['schema-rows'][0]
  srow['ref-tmpl-el'].value = ''
  await srow['ref-tmpl-el'].listeners.change()
  srow = dv['schema-rows'][0]
  assert.equal(srow['ref-display-el'].value, '$template')
  assert.equal(srow['ref-tmpl-field'].hidden, false)
  assert.equal(Object.hasOwn(tasksTbl.columns[0], 'refDisplayTemplate'), false)

  // Restore template, reload runtime, verify persistence
  srow['ref-tmpl-el'].value = "; add $first ' ' $last"
  await srow['ref-tmpl-el'].listeners.change()
  const fReload = createRuntime()
  await fReload.run(parse(mainSource, '/src/main.fs'))
  const dvReload = fReload.state.lanes[0].notebook['data-view']
  await dvReload['select-table'](tasksTbl.id)
  const reloadSrow = dvReload['schema-rows'][0]
  assert.equal(reloadSrow['ref-display-el'].value, '$template')
  assert.equal(reloadSrow['ref-tmpl-field'].hidden, false)
  assert.equal(reloadSrow['ref-tmpl-el'].value, "; add $first ' ' $last")
  assert.equal(dvReload['grid-rows'][0].cells[0]['display-el'].textContent, 'Ada Lovelace')

  // Switching Display from Template to None hides Template & clears refDisplayTemplate
  reloadSrow['ref-display-el'].value = ''
  await reloadSrow['ref-display-el'].listeners.change()
  const srowAfterNone = dvReload['schema-rows'][0]
  assert.equal(srowAfterNone['ref-display-el'].value, '')
  assert.equal(srowAfterNone['ref-tmpl-field'].hidden, true)
  assert.equal(srowAfterNone['ref-tmpl-details'].hidden, true)
  assert.equal(Object.hasOwn(dvReload.tables[1].columns[0], 'refDisplayTemplate'), false)
  assert.equal(dvReload['grid-rows'][0].cells[0]['display-el'].textContent, '42')
 }
 finally {
  globalThis.fetch = origFetch
 }
})
