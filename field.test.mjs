import test from 'node:test'
import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import http from 'node:http'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'
import { EventEmitter } from 'node:events'
import {
 buildDataUrl,
 formatDataDirLabel,
 httpKV,
 killDeployTerminalSession,
 normalizeDataDir,
 proxyDeployRequest,
 startDeployTerminalSession,
 syncLaneToRemoteCivilMemory,
 testRemoteCivilMemory,
} from './data.mjs'
import {
 createResponseHelper,
 detectLaneHandlers,
 extractLastLaneValue,
 buildRequestObject,
 normalizeHttpResult,
 executeLaneHttpRequest,
 simulateLaneRequest,
} from './lane-http.mjs'
import {
 createLaneHttpServer,
 normalizeCivilMemoryBaseUrl,
} from './lane-server.mjs'
import {
 WS_MAGIC_GUID,
 acceptWebSocket,
 computeWebSocketAccept,
 createTerminalManager,
 encodeWsFrame,
 parseWsFrames,
 spawnPty,
} from './pty-terminal.mjs'
import {
 buildSshBaseArgs,
 generateCivilMemoryServerScript,
 generateCivilMemorySystemdUnit,
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
 handleDeployUpgrade,
 isAllowedLocalOrigin,
 shellQuote,
 validateSshTarget,
} from './deploy-api.mjs'
import {
 createTerminalBuffer,
 encodeKeyEventToVt,
 extractSentinelEvents,
 mountTerminalView,
} from './terminal-ui.mjs'
import {
 buildBreadcrumbs,
 createDirectory,
 handleFsApiRequest,
 listDirectories,
 listDisks,
 parseProcMounts,
 unescapeMountPath,
} from './fs-api.mjs'
import {
 DEFAULT_PACKAGE_ID,
 DEFAULT_PACKAGE_NAME,
 MAX_KV_VALUE_BYTES,
 RECENT_SESSIONS_STORAGE_KEY,
 SESSION_HISTORY_STORAGE_KEY,
 SESSION_STORAGE_KEY,
 addLaneTable,
 addTableRow,
 allocateNextPort,
 buildPublicEndpointUrl,
 checkLaneAccess,
 clearTableRows,
 closePackageInSession,
 collectLaneSyncBundle,
 createNewSession,
 createNewTabSession,
 createPackage,
 deleteDeployServer,
 deleteLaneDeployment,
 deleteLaneTable,
 deletePagedIds,
 deleteTableRow,
 deployedScriptKey,
 deploymentKey,
 diffLaneScripts,
 encodeKeySegment,
 ensureDefaultPackage,
 forkSession,
 formatLineTimestamp,
 formatSessionDuration,
 generateLineId,
 getLaneDeployStatus,
 getLanePackageId,
 getPackageMeta,
 hashPassphrase,
 initSessionState,
 kvDeleteChunked,
 kvGetChunked,
 kvSetChunked,
 lanePackageKey,
 laneScriptBase,
 laneTablesBase,
 listPackageLanes,
 listPackageSessions,
 loadDeployServers,
 loadDeployments,
 loadDeployedLaneScript,
 loadLaneDeployment,
 loadLaneScript,
 loadLaneTables,
 loadSessionCatalog,
 migrateLegacyCatalog,
 moveLaneToPackage,
 normalizeDomainName,
 normalizeServiceSlug,
 normalizeSubpath,
 openPackageInSession,
 packageLaneKey,
 packageLanesBase,
 packageMetaKey,
 packageSessionsBase,
 promoteTabToBrowserSession,
 readPagedIds,
 readSessionHistory,
 registerLaneInPackage,
 renameSession,
 returnToBrowserSession,
 saveDeployServer,
 saveDeployedLaneScript,
 saveLaneDeployment,
 saveLaneScript,
 saveLaneTables,
 saveScriptLine,
 saveScriptLinesAndIndex,
 saveSessionVersion,
 saveTableRow,
 saveTableSchema,
 saveTableSchemaAndRows,
 scriptLineKey,
 sessionMetaKey,
 sessionPackagesBase,
 setActivePackageInSession,
 setSessionDataDir,
 setTargetLaneLine,
 splitUtf8Chunks,
 switchBrowserSession,
 switchTabSession,
 tableRowKey,
 tableRowsBase,
 tableSchemaKey,
 utf8ByteLength,
 writeLaneSyncBundleToKv,
 writePagedIds,
} from './storage.mjs'
import {
 DATA_COLUMN_TYPES,
 DATA_CONSTRAINT_TYPES,
 DEFAULT_FIXED_DECIMALS,
 DEFAULT_LANE_TAB,
 DEFAULT_ROW_PICKER_PAGE_SIZE,
 DEFAULT_SCROLLBAR_COLOR,
 LANE_FEATURES,
 LANE_MINIMIZE_SIDES,
 LANE_TABS,
 MIN_LANE_WIDTH,
 PRIMITIVE_TYPES,
 TRANSPORT_PACKET_TYPE,
 buildTablesScope,
 checkColumnChangeImpact,
 coerceDataValue,
 computeLaneScrollLeft,
 createIdleTracker,
 createTransport,
 dataValuesEqual,
 defaultDataValue,
 defaultValueForType,
 describeValue,
 deserializeTransportPacket,
 fetchRowOptionsPage,
 field,
 filterRowOptions,
 filterScopeEntries,
 findWorkflowDefaultColumns,
 formatCellInputValue,
 formatColumnType,
 formatExportLine,
 formatHashOptions,
 formatImportLine,
 formatLanePath,
 formatLaneRouteSegment,
 formatLaneRoutes,
 formatValue,
 getLaneInitial,
 getWorkflowCellState,
 hasImportCycle,
 isDomElement,
 isTransportPacket,
 listScopeEntries,
 lookupRowDisplay,
 normalizeColumnConstraint,
 normalizeColumnWidth,
 normalizeDataColumnType,
 normalizeFixedDecimals,
 normalizeLaneFeatures,
 normalizeLaneMinimizeSide,
 normalizeLanePath,
 normalizeLaneTab,
 normalizeLaneWidth,
 normalizePrimitiveType,
 parse,
 parseCellValue,
 parseColumnType,
 parseExportLine,
 parseHashOptions,
 parseImportLine,
 parseLaneFeatures,
 parseLanePath,
 parseLaneRouteSegment,
 parseLaneRoutes,
 parseStoredTables,
 resolveImportValue,
 resolveLaneRenderedWidth,
 resolveRowTarget,
 resolveRowValueSpec,
 resolveScopeColumns,
 resolveScopePath,
 resolveScrollbarColor,
 resolveWorkflowTarget,
 runLines,
 runTransportedScripts,
 seedPreferencesScrollbarRecords,
 seedPreferencesScrollbarSource,
 serializeTransportPacket,
} from './field.mjs'

const lineInfoModalSource = await fs.readFile(new URL('./src/lane-line-info-modal.fs', import.meta.url), 'utf8')
const exportModalSource = await fs.readFile(new URL('./src/lane-export-modal.fs', import.meta.url), 'utf8')
const exportDeployModalSource = await fs.readFile(new URL('./src/lane-export-deploy-modal.fs', import.meta.url), 'utf8')
const sessionModalSource = await fs.readFile(new URL('./src/lane-session-modal.fs', import.meta.url), 'utf8')
const packageModalSource = await fs.readFile(new URL('./src/lane-package-modal.fs', import.meta.url), 'utf8')
const dirModalSource = await fs.readFile(new URL('./src/lane-dir-modal.fs', import.meta.url), 'utf8')
const laneServerSource = await fs.readFile(new URL('./src/lane-server.fs', import.meta.url), 'utf8')
const laneServersModalSource = await fs.readFile(new URL('./src/lane-servers-modal.fs', import.meta.url), 'utf8')
const laneTerminalModalSource = await fs.readFile(new URL('./src/lane-terminal-modal.fs', import.meta.url), 'utf8')

const DATA_RUNTIME_ENV = {
 DEFAULT_PACKAGE_ID,
 DEFAULT_PACKAGE_NAME,
 LANE_FEATURES,
 addLaneTable,
 addTableRow,
 allocateNextPort,
 buildPublicEndpointUrl,
 buildTablesScope,
 checkColumnChangeImpact,
 checkLaneAccess,
 clearTableRows,
 closePackageInSession,
 coerceDataValue,
 collectLaneSyncBundle,
 computeLaneScrollLeft,
 createNewSession,
 createNewTabSession,
 createPackage,
 createResponseHelper,
 dataColumnTypes: DATA_COLUMN_TYPES,
 dataConstraintTypes: DATA_CONSTRAINT_TYPES,
 dataValuesEqual,
 defaultDataValue,
 defaultRowPickerPageSize: DEFAULT_ROW_PICKER_PAGE_SIZE,
 defaultScrollbarColor: DEFAULT_SCROLLBAR_COLOR,
 deleteDeployServer,
 deleteLaneDeployment,
 deleteLaneTable,
 deleteTableRow,
 detectLaneHandlers,
 diffLaneScripts,
 fetchRowOptionsPage,
 filterRowOptions,
 findWorkflowDefaultColumns,
 forkSession,
 formatCellInputValue,
 formatColumnType,
 formatDataDirLabel,
 formatExportLine,
 formatHashOptions,
 formatLanePath,
 formatLaneRoutes,
 formatLineTimestamp,
 formatSessionDuration,
 generateLineId,
 getLaneDeployStatus,
 getLaneInitial,
 getLanePackageId,
 getPackageMeta,
 getWorkflowCellState,
 initSessionState,
 killDeployTerminalSession,
 listPackageLanes,
 listPackageSessions,
 loadDeployServers,
 loadDeployments,
 loadDeployedLaneScript,
 loadLaneDeployment,
 loadLaneScript,
 loadLaneTables,
 loadSessionCatalog,
 lookupRowDisplay,
 mountTerminalView,
 moveLaneToPackage,
 normalizeColumnConstraint,
 normalizeColumnWidth,
 normalizeDataColumnType,
 normalizeDataDir,
 normalizeDomainName,
 normalizeFixedDecimals,
 normalizeLaneFeatures,
 normalizeLaneMinimizeSide,
 normalizeLanePath,
 normalizeLaneTab,
 normalizeLaneWidth,
 normalizeServiceSlug,
 normalizeSubpath,
 openPackageInSession,
 parseCellValue,
 parseColumnType,
 parseExportLine,
 parseHashOptions,
 parseLaneFeatures,
 parseLanePath,
 parseLaneRoutes,
 parseStoredTables,
 promoteTabToBrowserSession,
 proxyDeployRequest,
 readSessionHistory,
 registerLaneInPackage,
 renameSession,
 resolveLaneRenderedWidth,
 resolveRowTarget,
 resolveRowValueSpec,
 resolveScrollbarColor,
 resolveWorkflowTarget,
 returnToBrowserSession,
 saveDeployServer,
 saveDeployedLaneScript,
 saveLaneDeployment,
 saveLaneScript,
 saveLaneTables,
 saveScriptLine,
 saveScriptLinesAndIndex,
 saveSessionVersion,
 saveTableRow,
 saveTableSchema,
 saveTableSchemaAndRows,
 seedPreferencesScrollbarRecords,
 seedPreferencesScrollbarSource,
 setActivePackageInSession,
 setSessionDataDir,
 setTargetLaneLine,
 simulateLaneRequest,
 startDeployTerminalSession,
 switchBrowserSession,
 switchTabSession,
 syncLaneToRemoteCivilMemory,
 testRemoteCivilMemory,
 writeLaneSyncBundleToKv,
}

async function runScript(script, initialState = {}) {
 const f = field(initialState)
 const result = await f.run(parse(script))
 return { f, result }
}

test('to destructures a flat list into top-level state', async () => {
 const { f } = await runScript(`
  ; to { a b c } { alpha beta gamma }
 `)
 assert.equal(f.state.a, 'alpha')
 assert.equal(f.state.b, 'beta')
 assert.equal(f.state.c, 'gamma')
})

test('to destructures argv inside a deferred block and returns last value', async () => {
 const { f } = await runScript(`
  ; to fn (
   ; to { id title payload } $argv
   ; object { id $id } { title $title } { payload $payload }
  )
 `)
 const payload = { ok: true }
 const result = await f.state.fn('lane-1', 'Lane 1', payload)
 assert.deepEqual(result, { id: 'lane-1', title: 'Lane 1', payload })
 assert.equal('id' in f.state, false)
})

test('set supports list destructuring', async () => {
 const { f } = await runScript(`
  ; set { first second } { x y }
 `)
 assert.equal(f.state.x, 'first')
 assert.equal(f.state.y, 'second')
})

test('to and set support scoped path before destructuring list', async () => {
 const { f } = await runScript(`
  ; to scope ; object
  ; to scope.nested ; object
  ; to scope { a b } { one two }
  ; set { three four } scope.nested { c d }
 `)
 assert.deepEqual(f.state.scope, {
  a: 'one',
  b: 'two',
  nested: { c: 'three', d: 'four' },
 })
})

test('supports nested list destructuring', async () => {
 const { f } = await runScript(`
  ; to { a { b { c } } d } { one { two { three } } four }
 `)
 assert.equal(f.state.a, 'one')
 assert.equal(f.state.b, 'two')
 assert.equal(f.state.c, 'three')
 assert.equal(f.state.d, 'four')
})

test('supports skipping slots with null and undefined', async () => {
 const { f } = await runScript(`
  ; to { null second undefined fourth } { one two three four }
 `)
 assert.equal(f.state.second, 'two')
 assert.equal(f.state.fourth, 'four')
 assert.equal('null' in f.state, false)
 assert.equal('undefined' in f.state, false)
})

test('supports rest element in destructuring pattern', async () => {
 const { f } = await runScript(`
  ; to { head ...tail } { one two three four }
  ; to { only ...empty } { solo }
  ; to { ...copy } { x y }
  ; to { a { b ...innerTail } } { first { second third fourth } }
 `)
 assert.equal(f.state.head, 'one')
 assert.deepEqual(f.state.tail, ['two', 'three', 'four'])
 assert.equal(f.state.only, 'solo')
 assert.deepEqual(f.state.empty, [])
 assert.deepEqual(f.state.copy, ['x', 'y'])
 assert.equal(f.state.a, 'first')
 assert.equal(f.state.b, 'second')
 assert.deepEqual(f.state.innerTail, ['third', 'fourth'])
})

test('handles shorter, longer, and empty lists', async () => {
 const { f } = await runScript(`
  ; to { a b c } { only }
  ; to { d e } { first second third }
  ; to {} { ignored }
 `)
 assert.equal(f.state.a, 'only')
 assert.equal(f.state.b, undefined)
 assert.equal(f.state.c, undefined)
 assert.equal(f.state.d, 'first')
 assert.equal(f.state.e, 'second')
})

test('destructures non-array iterables', async () => {
 const { f } = await runScript(
  `
   ; to { first second third } $items
  `,
  { items: new Set(['s1', 's2', 's3']) }
 )
 assert.equal(f.state.first, 's1')
 assert.equal(f.state.second, 's2')
 assert.equal(f.state.third, 's3')
})

test('throws TypeError when destructuring non-iterable values', async () => {
 for (const bad of [null, undefined, 42, { a: 1 }]) {
  await assert.rejects(
   () => runScript(`; to { a b } $bad\n`, { bad }),
   TypeError
  )
 }
})

test('throws Error when rest element is not last', async () => {
 await assert.rejects(
  () => runScript(`; to { ...rest last } { one two }\n`),
  /Rest element must be last/
 )
})

test('parses numbers of any length and empty string literals', async () => {
 const { f } = await runScript(`
  ; to zero 0
  ; to one 1
  ; to neg -42
  ; to pi 3.14
  ; to sum ; add 2 3
  ; to quotedNum '0'
  ; to leadingZero 007
  ; to unit 10px
  ; to hex #202020
  ; to hugeId 12345678901234567890
  ; to empty ''
  ; to pair { '' 'x' }
 `)
 assert.strictEqual(f.state.zero, 0)
 assert.strictEqual(f.state.one, 1)
 assert.strictEqual(f.state.neg, -42)
 assert.strictEqual(f.state.pi, 3.14)
 assert.strictEqual(f.state.sum, 5)
 assert.strictEqual(f.state.quotedNum, '0')
 assert.strictEqual(f.state.leadingZero, '007')
 assert.strictEqual(f.state.unit, '10px')
 assert.strictEqual(f.state.hex, '#202020')
 assert.strictEqual(f.state.hugeId, '12345678901234567890')
 assert.strictEqual(f.state.empty, '')
 assert.deepEqual(f.state.pair, ['', 'x'])
})

test('flushes autoblocks and patterns at EOF without trailing newline', async () => {
 assert.deepEqual(parse('; to x ; get y'), parse('; to x ; get y\n'))
 assert.deepEqual(
  parse('; to fn (\n ; get a\n)'),
  parse('; to fn (\n ; get a\n)\n')
 )
 assert.deepEqual(
  parse('; to fn : {\n alpha\n beta\n}'),
  parse('; to fn : {\n alpha\n beta\n}\n')
 )
 assert.deepEqual(
  parse('= ; to @1 @2\n a one\n b two'),
  parse('= ; to @1 @2\n a one\n b two\n')
 )
 assert.deepEqual(parse('= ; to @1 @2'), [])

 const { f } = await runScript('; to greeting hello')
 assert.equal(f.state.greeting, 'hello')
})

test('flushes pending word and nested autoblocks before closing }, ], )', async () => {
 assert.deepEqual(
  parse('{ popstate ; get scope sync}'),
  parse('{ popstate ; get scope sync }')
 )
 assert.deepEqual(
  parse('{ ; add 1 ; add 2 3}'),
  [[['@', 'add', 1, ['@', 'add', 2, 3]]]]
 )
 assert.deepEqual(
  parse('[ !document.createElement div]'),
  [['@', 'invoke', ['div'], 'document', 'createElement']]
 )
 const { result } = await runScript('{ ; add 1 ; add 2 3}')
 assert.deepEqual(result, [6])
})

test('supports multiline explicit blocks inside ; and : autoblocks', async () => {
 const { f } = await runScript(
  `; to listFn : {\n alpha\n beta\n}\n; to items {\n first\n second\n}\n; to sum [\n add\n foo\n bar\n]\n; to deferred (\n ; to captured $argv\n $captured\n)`
 )
 assert.deepEqual(await f.state.listFn(), ['alpha', 'beta'])
 assert.deepEqual(f.state.items, ['first', 'second'])
 assert.equal(f.state.sum, 'foobar')
 assert.deepEqual(await f.state.deferred('ok'), ['ok'])
})

test('supports multiline = pattern templates containing inner blocks', async () => {
 const calls = []
 const { f } = await runScript(
  `
   ; to scope ; object
   = ; to scope.@1 (
    ; to { arg } $argv
    !record @2 $arg
   )
    greet Hello
    farewell Goodbye
   =
   ; to lists ; object
   = ; to lists.@1 : {
    @2
    @3+
   }
    first a b c
    second x y
   =
   ; to after done
  `,
  { record: (...args) => calls.push(args) }
 )

 await f.state.scope.greet('world')
 await f.state.scope.farewell('friend')
 assert.deepEqual(calls, [
  ['Hello', 'world'],
  ['Goodbye', 'friend'],
 ])
 assert.deepEqual(await f.state.lists.first(), ['a', 'b', 'c'])
 assert.deepEqual(await f.state.lists.second(), ['x', 'y'])
 assert.equal(f.state.after, 'done')
})

test('supports multiline = pattern template inside a nested block', async () => {
 const { f } = await runScript(`
  ; to build (
   ; to out ; object
   = ; to out.@1 {
    @2
    @3+
   }
    one a b
    two c d e
   =
   $out
  )
 `)
 const result = await f.state.build()
 assert.deepEqual(result, {
  one: ['a', 'b'],
  two: ['c', 'd', 'e'],
 })
})

test('supports $var and $a.b.c shorthand including argv and patterns', async () => {
 assert.deepEqual(
  parse('; set $lc-mount-id lc-lane id\n'),
  parse('; set [ get lc-mount-id ] lc-lane id\n')
 )
 assert.deepEqual(
  parse('; invoke { popstate $scope.sync } window addEventListener\n'),
  parse('; invoke { popstate [ get scope sync ] } window addEventListener\n')
 )
 assert.deepEqual(
  parse('$very-long-variable-name-past-24-chars'),
  [['@', 'get', 'very-long-variable-name-past-24-chars']]
 )

 const seen = []
 const { f } = await runScript(
  `
   ; to scope ; object { lanes { a b c } }
   ; to len $scope.lanes.length
   ; to missing $scope.nope.deep
   ; to quoted '$scope.lanes.length'
   ; to quotedTrue 'true'
   ; to quotedEq '='
   ; to bareDollar $
   ; to readArg (
    ; object { first $argv.0 } { count $argv.length } { label $argv.1.label }
   )
   = !push $scope.@1
    lanes
   =
  `,
  { push: v => seen.push(v) }
 )
 assert.equal(f.state.len, 3)
 assert.equal(f.state.missing, undefined)
 assert.equal(f.state.quoted, '$scope.lanes.length')
 assert.equal(f.state.quotedTrue, 'true')
 assert.equal(f.state.quotedEq, '=')
 assert.equal(f.state.bareDollar, '$')
 assert.deepEqual(seen, [['a', 'b', 'c']])

 assert.deepEqual(await f.state.readArg('hello', { label: 'nested-ok' }), {
  first: 'hello',
  count: 2,
  label: 'nested-ok',
 })
})

test('supports ! invoke shorthand and symmetric dot paths', async () => {
 assert.deepEqual(
  parse('!lc-element.setAttribute data-lane-id $id\n'),
  parse('; invoke { data-lane-id $id } lc-element setAttribute\n')
 )
 assert.deepEqual(
  parse('!scope.clear-next\n'),
  parse('; invoke {} scope clear-next\n')
 )

 const calls = []
 const box = {
  value: 10,
  add(n) {
   this.value += n
   return this.value
  },
  double(n) {
   return n * 2
  },
 }
 const { f } = await runScript(
  `
   ; to out !box.add !box.double 3
   ; to fn $record
   !$fn first [ !box.double 4 ]
   ; to map ; object
   ; to dotKey 'a.b.c'
   ; to map $dotKey ok
   ; to scope ; object { by-id ; object }
   ; to scope.by-id $dotKey preserved
   ; to style-el ; object { style ; object }
   ; set red style-el.style.color
  `,
  {
   box,
   record: (...args) => calls.push(args),
  }
 )
 assert.equal(f.state.out, 16)
 assert.deepEqual(calls, [['first', 8]])
 assert.equal(f.state.map['a.b.c'], 'ok')
 assert.equal(f.state.scope['by-id']['a.b.c'], 'preserved')
 assert.equal(f.state['style-el'].style.color, 'red')
})

test('tap calls functions and methods with zero arguments', async () => {
 let pingArgs
 const counter = {
  count: 0,
  inc(...args) {
   this.count += 1
   return args.length
  },
 }
 const { f } = await runScript(
  `
   ; tap ping
   ; to incArgs ; tap counter.inc
   ; tap counter inc
   ; to produce (
    ; to result ok
    $result
   )
   ; to direct ; tap produce
  `,
  {
   ping(...args) {
    pingArgs = args
   },
   counter,
  }
 )
 assert.deepEqual(pingArgs, [])
 assert.equal(counter.count, 2)
 assert.equal(f.state.incArgs, 0)
 assert.equal(f.state.direct, 'ok')
})

test('object accepts { key value } pair lists and rejects flat arguments', async () => {
 const { f } = await runScript(`
  ; to empty ; object
  ; to id lane-9
  ; to user ; object { id $id } { count 3 }
  ; to multi [ object
   { a 1 }
   { b 2 }
  ]
 `)
 assert.deepEqual(f.state.empty, {})
 assert.deepEqual(f.state.user, { id: 'lane-9', count: 3 })
 assert.deepEqual(f.state.multi, { a: 1, b: 2 })

 await assert.rejects(
  () => runScript('; to bad ; object a 1\n'),
  TypeError
 )
 await assert.rejects(
  () => runScript('; to bad ; object { a 1 2 }\n'),
  TypeError
 )
})

test('-- comments produce no-op comment AST nodes and never clobber return values', async () => {
 const ast = parse(`
  -- Top-level doc comment with 'quotes', {braces}, and $vars!
  ; to fn (
   -- Describes fn
   ; to val lane-control--add -- inline comment
   ; to cssVar --color-primary
   ; object { val $val } { css $cssVar }
   -- trailing comment should not replace return value
  )
 `)
 assert.deepEqual(ast[0], [
  '@',
  'comment',
  "Top-level doc comment with 'quotes', {braces}, and $vars!",
 ])
 const fnBody = ast[1][3]
 assert.deepEqual(fnBody[2], ['@', 'comment', 'Describes fn'])
 assert.deepEqual(fnBody[4], ['@', 'comment', 'inline comment'])
 assert.deepEqual(fnBody[7], [
  '@',
  'comment',
  'trailing comment should not replace return value',
 ])

 const f = field()
 await f.run(ast)
 assert.deepEqual(await f.state.fn(), {
  val: 'lane-control--add',
  css: '--color-primary',
 })
})

test('lexical per-call scopes isolate concurrent async invocations and preserve condition scope', async () => {
 const resolvers = new Map()
 let bothWaiting
 const ready = new Promise(resolve => { bothWaiting = resolve })
 const { f } = await runScript(
  `
   ; to outer original
   ; to work (
    ; to { id delayKey } $argv
    ; to outer shadowed
    ; to result default
    ; to fetched !waitFor $delayKey
    ; condition { propertyIs null fetched } (
     ; to result ; add 'fallback-' $argv.0
    )
    ; object { id $id } { fetched $fetched } { result $result } { outer $outer }
   )
  `,
  {
   waitFor(key) {
    return new Promise(resolve => {
     resolvers.set(key, resolve)
     if (resolvers.size === 2) {
      bothWaiting()
     }
    })
   },
  }
 )

 const p1 = f.state.work('first', 'k1')
 const p2 = f.state.work('second', 'k2')

 // Wait until both concurrent calls are suspended at !waitFor, then resolve out of order
 await ready
 resolvers.get('k2')(null)
 resolvers.get('k1')('loaded-1')

 const [r1, r2] = await Promise.all([p1, p2])
 assert.deepEqual(r1, {
  id: 'first',
  fetched: 'loaded-1',
  result: 'default',
  outer: 'shadowed',
 })
 assert.deepEqual(r2, {
  id: 'second',
  fetched: null,
  result: 'fallback-second',
  outer: 'shadowed',
 })
 assert.equal(f.state.outer, 'original')
 assert.equal('id' in f.state, false)
})

test('assign merges { key value } pairs and objects onto a target', async () => {
 const { f } = await runScript(`
  ; to element ; object { style ; object }
  ; to preset ; object { color white } { padding '1px' }
  ; to returned ; assign element.style $preset { textAlign left } { padding '0.25em 0.75em' } null undefined
  ; to fresh ; assign [ object { a 1 } ] { b 2 } ; object { c 3 }
 `)
 assert.equal(f.state.returned, f.state.element.style)
 assert.deepEqual(f.state.element.style, {
  color: 'white',
  padding: '0.25em 0.75em',
  textAlign: 'left',
 })
 assert.deepEqual(f.state.fresh, { a: 1, b: 2, c: 3 })

 await assert.rejects(() => runScript('; assign missing { a 1 }\n'), TypeError)
 await assert.rejects(() => runScript('; to o ; object\n; assign o { a 1 2 }\n'), TypeError)
 await assert.rejects(() => runScript('; to o ; object\n; assign o 42\n'), TypeError)
})

test('match evaluates branches lazily and returns first truthy branch result', async () => {
 const evaluated = []
 const { f } = await runScript(
  `
   ; to classify (
    ; to { n } $argv
    [ match
     { { propertyIs 0 n } (
      ; to tag zero
      $tag
     ) }
     { [ !check 'gt-10' $n ] (
      ; add 'big:' $argv.0
     ) }
     { [ !check 'should-not-run' $n ] (
      unreachable
     ) }
     { true (
      ; add 'other:' $n
     ) }
    ]
   )
   ; to noneMatched ; match { false ( nope ) }
  `,
  {
   check(label, n) {
    evaluated.push(label)
    return label === 'gt-10' ? n > 10 : true
   },
  }
 )

 assert.equal(await f.state.classify(0), 'zero')
 assert.deepEqual(evaluated, [])

 assert.equal(await f.state.classify(25), 'big:25')
 assert.deepEqual(evaluated, ['gt-10'])

 evaluated.length = 0
 assert.equal(await f.state.classify(5), 'unreachable')
 assert.deepEqual(evaluated, ['gt-10', 'should-not-run'])

 assert.equal(f.state.noneMatched, undefined)
})

test(': deferred autoblock works as trailing block in match arms, conditions, and calls', async () => {
 assert.deepEqual(
  parse(`
   ; to element [ match
    { $created.header : $created.header }
    { true : $created }
   ]
   ; to body-el [ match
    { $created.body : $created.body }
    { true : null }
   ]
   ; condition { propertyIs true flag } : !record ok
   !emitter.on click : !record clicked
  `),
  parse(`
   ; to element [ match
    { $created.header ( $created.header ) }
    { true ( $created ) }
   ]
   ; to body-el [ match
    { $created.body ( $created.body ) }
    { true ( null ) }
   ]
   ; condition { propertyIs true flag } ( !record ok )
   !emitter.on click ( !record clicked )
  `)
 )

 const seen = []
 let listener
 const { f } = await runScript(
  `
   ; to flag true
   ; to pick (
    ; to { created } $argv
    ; to element [ match
     { $created.header : $created.header }
     { true : $created }
    ]
    ; to body-el [ match
     { $created.body : $created.body }
     { true : null }
    ]
    ; object { element $element } { body $body-el }
   )
   ; condition { propertyIs true flag } : !record cond-ok
   !emitter.on click : !record clicked
  `,
  {
   record: v => seen.push(v),
   emitter: { on: (_ev, fn) => { listener = fn } },
  }
 )

 assert.deepEqual(await f.state.pick({ header: 'H', body: 'B' }), { element: 'H', body: 'B' })
 assert.deepEqual(await f.state.pick('RAW'), { element: 'RAW', body: null })
 await listener()
 assert.deepEqual(seen, ['cond-ok', 'clicked'])
})

test('each iterates arrays and iterables sequentially with (item, index)', async () => {
 const log = []
 const { f } = await runScript(
  `
   ; to last ; each { alpha beta gamma } (
    ; to { item index } $argv
    !record $index $item
    ; add $index ; add ':' $item
   )
   ; to fromSet ; each $items (
    ; to { item } $argv
    !record set $item
    $item
   )
  `,
  {
   items: new Set(['x', 'y']),
   async record(...args) {
    await Promise.resolve()
    log.push(args)
   },
  }
 )
 assert.equal(f.state.last, '2:gamma')
 assert.equal(f.state.fromSet, 'y')
 assert.deepEqual(log, [
  [0, 'alpha'],
  [1, 'beta'],
  [2, 'gamma'],
  ['set', 'x'],
  ['set', 'y'],
 ])

 await assert.rejects(() => runScript('; each 123 ( )\n'), TypeError)
})

test('while loops with predicates, values, and deferred conditions sharing enclosing scope', async () => {
 const seen = []
 const { f } = await runScript(
  `
   ; to runLoop (
    ; to i 0
    ; to last ; while { propertyIsLessThan 4 i } (
     !record $i
     ; to i ; add $i 1
     $i
    )
    ; to queue { a b }
    ; while $queue.length (
     !record !queue.shift
    )
    ; to never ; while false (
     !record bad
    )
    ; object { i $i } { last $last } { never $never }
   )
  `,
  { record: v => seen.push(v) }
 )
 assert.deepEqual(await f.state.runLoop(), { i: 4, last: 4, never: undefined })
 assert.deepEqual(seen, [0, 1, 2, 3, 'a', 'b'])
 assert.equal('i' in f.state, false)
})

test('try catches both synchronous throws and async rejections with err in argv', async () => {
 const { f, result } = await runScript(`
  ; to syncRes [ try ( !JSON.parse '{bad' ) ( ; to { err } $argv, ; add 'caught:' $err.name ) ]
  ; to asyncRes [ try ( !failAsync ) ( ; to { err } $argv, ; add 'async:' $err.message ) ]
  ; to okRes [ try ( ; add 2 3 ) ( ; to { err } $argv, 'fallback' ) ]
  ; object { sync $syncRes } { async $asyncRes } { ok $okRes }
 `, {
  JSON,
  failAsync: async () => { throw new Error('boom') },
 })
 assert.equal(result.sync, 'caught:SyntaxError')
 assert.match(result.async, /^async:boom/)
 assert.equal(result.ok, 5)
 assert.equal(f.state.okRes, 5)
})

test('will functions expose their AST including -- doc comments', async () => {
 const { f } = await runScript(`
  ; to greet (
   -- Greets the caller by name
   ; to { name } $argv
   ; add 'Hi ' $name
  )
  ; to doc $greet.ast.0.2
 `)
 assert.equal(f.state.doc, 'Greets the caller by name')
 assert.deepEqual(f.state.greet.ast[0], ['@', 'comment', 'Greets the caller by name'])
 assert.equal(await f.state.greet('Ada'), 'Hi Ada')
})

test('runtime errors include line, column, source snippet, and filename when known', async () => {
 const script = `; to ok 1\n; to bad ( \n !missingObj.boom 123\n)\n!bad\n`
 const f1 = field()
 await assert.rejects(
  () => f1.run(parse(script, 'src/demo.fs')),
  err => {
   assert.match(err.message, /src\/demo\.fs:3:2/)
   assert.match(err.message, /!missingObj\.boom 123/)
   assert.deepEqual(err.fieldLocation, {
    filename: 'src/demo.fs',
    line: 3,
    col: 2,
    sourceLine: ' !missingObj.boom 123',
   })
   return true
  }
 )

 // Without filename, still reports line and column and preserves TypeError
 const f2 = field()
 await assert.rejects(
  () => f2.run(parse('; to x 1\n; assign missing { a 1 }\n')),
  err => {
   assert.ok(err instanceof TypeError)
   assert.match(err.message, /line 2 at column 1/)
   assert.match(err.message, /; assign missing \{ a 1 \}/)
   return true
  }
 )

 // Via load(), automatically attaches the fetched scriptPath as filename
 const origFetch = globalThis.fetch
 globalThis.fetch = async url => ({
  text: async () => `; to ok 1\n!nope.fail\n`,
 })
 try {
  const f3 = field()
  await assert.rejects(
   () => f3.load('/src/broken.fs'),
   err => {
    assert.match(err.message, /\/src\/broken\.fs:2:1/)
    assert.equal(err.fieldLocation.filename, '/src/broken.fs')
    return true
   }
  )
 }
 finally {
  globalThis.fetch = origFetch
 }
})

test('runLines evaluates notebook scripts using exact FieldScript syntax', async () => {
 const { results, state } = await runLines(
  [
   'hello world',
   '; to input 5',
   '; to output ; add 3 $input',
   '$output',
   '; to explicit ; add $output 2 -- inline comment',
   '!Math.max 2 $explicit',
   '-- a comment line',
   '',
   'set foo bar',
   '; object { a 1 } { b $output }',
   '; to a 1, ; to b 2, ; add $a $b',
  ],
  { filename: 'lane-test', initialState: { Math } }
 )

 assert.deepEqual(results[0].value, ['hello', 'world'])
 assert.equal(results[0].preview, '["hello","world"]')
 assert.equal(results[1].value, 5)
 assert.equal(results[1].preview, '5')
 assert.equal(results[2].value, 8)
 assert.equal(results[2].preview, '8')
 assert.equal(results[3].value, 8)
 assert.equal(results[3].preview, '8')
 assert.equal(results[4].value, 10)
 assert.equal(results[4].preview, '10')
 assert.equal(results[5].value, 10)
 assert.equal(results[5].preview, '10')
 assert.equal(results[6].isComment, true)
 assert.equal(results[6].preview, '')
 assert.equal(results[7].isEmpty, true)
 assert.equal(results[7].preview, '')
 // Without a leading `;`, bare words evaluate as a data list and never invoke commands
 assert.deepEqual(results[8].value, ['set', 'foo', 'bar'])
 assert.equal(results[8].preview, '["set","foo","bar"]')
 assert.equal('bar' in state, false)
 assert.deepEqual(results[9].value, { a: 1, b: 8 })
 assert.equal(results[9].preview, '{"a":1,"b":8}')
 assert.deepEqual(results[10].value, [1, 2, 3])
 assert.equal(results[10].preview, '[1,2,3]')
 assert.equal(state.output, 8)
})

test('runLines captures parse and runtime errors per line with line numbers', async () => {
 const { results } = await runLines(
  [
   '; to x 1',
   '!missing.boom 1',
   '; add 2 3 ]',
   '; add $x 4',
  ],
  { filename: 'lane-err' }
 )
 assert.equal(results[0].preview, '1')
 assert.equal(results[0].error, null)
 assert.match(results[1].error, /lane-err:2:1/)
 assert.match(results[2].error, /Block end mismatch|no block is open/)
 assert.equal(results[3].preview, '5')
 assert.equal(results[3].error, null)
 assert.equal(formatValue(NaN), 'NaN')
 assert.equal(formatValue(undefined), 'undefined')
})

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
  assert.equal(headerTop.children[2], mountedLane['min-left-btn'])
  assert.equal(mountedLane['min-left-btn'].className, 'lane-min-btn lane-min-btn--left')
  assert.equal(headerTop.children[3], mountedLane['min-right-btn'])
  assert.equal(mountedLane['min-right-btn'].className, 'lane-min-btn lane-min-btn--right')
  assert.equal(headerTop.children[4], mountedLane['reload-btn'])
  assert.equal(mountedLane['reload-btn'].className, 'lane-reload-btn')
  assert.equal(headerTop.children[5], mountedLane['close-btn'])
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

test('resolveScopeColumns browses root scope, nested objects, arrays, non-enumerables, functions, and throwing getters', async () => {
 assert.deepEqual(PRIMITIVE_TYPES, ['string', 'number', 'boolean', 'null', 'undefined'])
 assert.strictEqual(defaultValueForType('string'), '')
 assert.strictEqual(defaultValueForType('number'), 0)
 assert.strictEqual(defaultValueForType('boolean'), false)
 assert.strictEqual(defaultValueForType('null'), null)
 assert.strictEqual(defaultValueForType('undefined'), undefined)
 assert.strictEqual(normalizePrimitiveType('object'), 'string')
 assert.strictEqual(normalizePrimitiveType('boolean'), 'boolean')

 const circular = { label: 'loop' }
 circular.self = circular
 const risky = {}
 Object.defineProperty(risky, 'boom', {
  enumerable: true,
  get() { throw new Error('getter exploded') },
 })

 const { state } = await runLines(
  [
   '; to user ; object { name Ada } { profile ; object { role ops } }',
   '; to items { alpha beta }',
   '; to greet ( ; to { n } $argv, ; add Hi $n )',
   '; to count 42',
  ],
  { initialState: { Math, circular, risky } }
 )

 // Root column includes argv, globals, and user vars
 const rootView = resolveScopeColumns(state, [])
 assert.equal(rootView.columns.length, 1)
 const rootKeys = rootView.columns[0].entries.map(e => e.key)
 assert.ok(rootKeys.includes('argv'))
 assert.ok(rootKeys.includes('Math'))
 assert.ok(rootKeys.includes('user'))
 assert.ok(rootKeys.includes('items'))
 assert.ok(rootKeys.includes('greet'))
 assert.ok(rootKeys.includes('count'))

 // Clicking nested objects reveals property columns, clicking primitive reveals value column
 const deepView = resolveScopeColumns(state, ['user', 'profile', 'role'])
 assert.deepEqual(deepView.path, ['user', 'profile', 'role'])
 assert.equal(deepView.columns.length, 4)
 assert.equal(deepView.columns[0].selectedKey, 'user')
 assert.equal(deepView.columns[1].kind, 'entries')
 assert.equal(deepView.columns[1].selectedKey, 'profile')
 assert.equal(deepView.columns[2].kind, 'entries')
 assert.equal(deepView.columns[2].selectedKey, 'role')
 assert.equal(deepView.columns[3].kind, 'value')
 assert.equal(deepView.columns[3].valueType, 'string')
 assert.equal(deepView.columns[3].valueDetail, '"ops"')

 // Non-enumerable built-ins like Math.PI and Array.length + prototype methods are browsable
 const mathPi = resolveScopeColumns(state, ['Math', 'PI'])
 assert.equal(mathPi.columns.length, 3)
 assert.equal(mathPi.columns[2].kind, 'value')
 assert.equal(mathPi.columns[2].valueType, 'number')
 assert.equal(mathPi.columns[2].value, Math.PI)

 const arrEntries = listScopeEntries(state.items)
 assert.equal(arrEntries[0].key, '0')
 assert.equal(arrEntries[1].key, '1')
 assert.ok(arrEntries.some(e => e.key === 'length' && !e.enumerable && !e.inherited))
 assert.ok(arrEntries.some(e => e.key === 'map' && e.inherited))

 // FieldScript will functions expose .ast as an expandable list property
 const fnAst = resolveScopeColumns(state, ['greet', 'ast', '0'])
 assert.equal(fnAst.columns[1].valueType, 'will')
 assert.equal(fnAst.columns[1].valueSummary, 'will')
 assert.equal(fnAst.columns[2].valueType, 'list')
 assert.equal(fnAst.columns[2].valueSummary, 'list{2}')
 assert.equal(fnAst.columns[3].kind, 'entries')

 // Circular references and throwing getters are handled safely
 const circView = resolveScopeColumns(state, ['circular', 'self', 'label'])
 assert.equal(circView.columns[3].kind, 'value')
 assert.equal(circView.columns[3].valueDetail, '"loop"')

 const errView = resolveScopeColumns(state, ['risky', 'boom'])
 assert.equal(errView.columns[2].kind, 'value')
 assert.equal(errView.columns[2].valueType, 'error')
 assert.match(errView.columns[2].error, /getter exploded/)

 // Stale paths truncate cleanly to the longest valid prefix
 const staleView = resolveScopeColumns(state, ['user', 'missing', 'deeper'])
 assert.deepEqual(staleView.path, ['user'])
 assert.equal(staleView.columns.length, 2)
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
   ['string', 'number', 'boolean', 'null', 'undefined']
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

test('Scope FieldScript type previews, filterScopeEntries, filter bar, proto toggle, and Copy $path', async () => {
 // FieldScript type previews in describeValue
 assert.equal(describeValue({}).type, 'object')
 assert.equal(describeValue({}).summary, 'object')
 assert.equal(describeValue(Object.create(null)).summary, 'object')
 assert.equal(describeValue([1, 2, 3]).type, 'list')
 assert.equal(describeValue([1, 2, 3]).summary, 'list{3}')
 assert.equal(describeValue(new Map([['a', 1], ['b', 2]])).summary, 'map{2}')
 assert.equal(describeValue(new Set(['x', 'y'])).summary, 'set{2}')
 assert.equal(describeValue(Promise.resolve(1)).summary, 'promise')
 assert.equal(describeValue(new Uint8Array(4)).summary, 'bytes{4}')
 assert.equal(describeValue(new TypeError('bad')).type, 'error')
 assert.equal(describeValue(new TypeError('bad')).summary, 'error')
 assert.equal(describeValue(function helper() {}).summary, 'fn helper')
 assert.equal(describeValue(() => {}).summary, 'fn')

 const { state } = await runLines([
  '; to docfn ( -- Greets a user\n ; to { who } $argv\n ; add Hi $who\n)',
  '; to items { a b c }',
  '; to user ; object { name Ada } { role ops }',
  '; to count 7',
 ])

 const docDesc = describeValue(state.docfn)
 assert.equal(docDesc.type, 'will')
 assert.equal(docDesc.summary, 'will')
 assert.equal(docDesc.detail, 'will — Greets a user')

 // filterScopeEntries filters case-insensitively and respects includeInherited
 const itemEntries = listScopeEntries(state.items)
 const filteredItems = filterScopeEntries(itemEntries, 'LEN')
 assert.deepEqual(filteredItems.map(e => e.key), ['length'])
 const ownOnlyItems = filterScopeEntries(itemEntries, '', { includeInherited: false })
 assert.ok(!ownOnlyItems.some(e => e.inherited))
 assert.ok(ownOnlyItems.some(e => e.key === '0'))

 // resolveScopeColumns supports filter, filterColumnIndex, and includeInherited
 const filteredRoot = resolveScopeColumns(state, [], { filter: 'us' })
 assert.equal(filteredRoot.filterColumnIndex, 0)
 assert.equal(filteredRoot.columns[0].filtered, true)
 assert.deepEqual(filteredRoot.columns[0].entries.map(e => e.key), ['user'])

 const noProtoCol = resolveScopeColumns(state, ['items'], { includeInherited: false })
 assert.ok(!noProtoCol.columns[1].entries.some(e => e.inherited))

 // UI test with lane-scope.fs
 const scopeSource = await fs.readFile(new URL('./src/lane-scope.fs', import.meta.url), 'utf8')
 function createMockElement(tag) {
  return {
   tag,
   style: {},
   attributes: {},
   children: [],
   listeners: {},
   textContent: '',
   value: '',
   placeholder: '',
   title: '',
   className: '',
   hidden: false,
   focused: false,
   removed: false,
   scrollWidth: 0,
   scrollLeft: 0,
   setAttribute(name, value) { this.attributes[name] = value },
   appendChild(child) { this.children.push(child); return child },
   addEventListener(event, handler) { this.listeners[event] = handler },
   focus() { this.focused = true },
   remove() { this.removed = true },
  }
 }

 const copied = []
 const mockWindow = {
  Array,
  Date,
  JSON,
  Math,
  navigator: {
   clipboard: {
    async writeText(text) { copied.push(text) },
   },
  },
 }
 const f = field({
  document: { createElement: createMockElement },
  resolveScopeColumns,
  window: mockWindow,
 })
 const scopeMod = await f.run(parse(scopeSource, '/src/lane-scope.fs'))
 const container = createMockElement('div')
 const view = await scopeMod.mount({ id: 'scope-test' }, container)
 await view.render(state)

 // Verify FieldScript summaries in rendered root items
 const userItem = view.columns[0].items.find(i => i.key === 'user')
 const itemsItem = view.columns[0].items.find(i => i.key === 'items')
 const docfnItem = view.columns[0].items.find(i => i.key === 'docfn')
 assert.equal(userItem.entry.summary, 'object')
 assert.equal(itemsItem.entry.summary, 'list{3}')
 assert.equal(docfnItem.entry.summary, 'will')
 assert.equal(view['copy-btn'].hidden, true)

 // Filter root scope by "it" -> narrows to `items`, shows match count and clear button
 view['filter-input'].value = 'it'
 await view['filter-input'].listeners.input()
 assert.deepEqual(view.columns[0].items.map(i => i.key), ['items'])
 assert.equal(view['filter-clear-btn'].hidden, false)
 assert.equal(view['filter-count-el'].hidden, false)
 assert.match(view['filter-count-el'].textContent, /^1 \/ \d+$/)

 // Pressing Enter in filter input selects first match (`items`) while keeping col 0 filtered and col 1 unfiltered
 let prevented = false
 await view['filter-input'].listeners.keydown({ key: 'Enter', preventDefault() { prevented = true } })
 assert.equal(prevented, true)
 assert.deepEqual(view['selected-path'], ['items'])
 assert.equal(view.columns.length, 2)
 assert.equal(view.columns[1].items.some(i => i.key === '0'), true)
 assert.equal(view.columns[1].items.some(i => i.key === 'map'), true)
 assert.equal(view['copy-btn'].hidden, false)

 // Copy button copies `$items` to clipboard
 await view['copy-btn'].listeners.click()
 assert.deepEqual(copied, ['$items'])
 assert.equal(view['copy-btn'].textContent, 'Copied')

 // Toggling proto hides inherited prototype entries in `items`
 await view['proto-btn'].listeners.click()
 assert.equal(view['show-proto'], false)
 assert.equal(view.columns[1].items.some(i => i.key === 'map'), false)
 assert.equal(view.columns[1].items.some(i => i.key === '0'), true)

 // Pressing Escape in filter input clears filter and stops propagation
 let stopped = false
 await view['filter-input'].listeners.keydown({ key: 'Escape', stopPropagation() { stopped = true } })
 assert.equal(stopped, true)
 assert.equal(view['filter-query'], '')
 assert.equal(view['filter-clear-btn'].hidden, true)
 assert.ok(view.columns[0].items.length > 1)
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

test('send command, JSON code transport codec, and runTransportedScripts in browser context', async () => {
 // 1. Wire codec preserves special primitives, Dates, nested ASTs, and reserved tag keys
 const when = new Date('2026-11-23T12:00:00.000Z')
 const rawPacket = {
  type: TRANSPORT_PACKET_TYPE,
  index: 0,
  lineNumber: 3,
  ast: [['@', 'to', 'x', undefined], ['@', 'get', 'x']],
  args: [undefined, NaN, Infinity, -Infinity, -0, when, { __fieldTransport: 'user-value', nested: [1, undefined] }],
  bindings: { label: 'hello', missing: undefined },
 }
 const wire = serializeTransportPacket(rawPacket)
 assert.equal(typeof wire, 'string')
 const decoded = deserializeTransportPacket(wire)
 assert.equal(decoded.type, TRANSPORT_PACKET_TYPE)
 assert.equal(decoded.lineNumber, 3)
 assert.deepEqual(decoded.ast, [['@', 'to', 'x', undefined], ['@', 'get', 'x']])
 assert.equal(decoded.args[0], undefined)
 assert.ok(Number.isNaN(decoded.args[1]))
 assert.equal(decoded.args[2], Infinity)
 assert.equal(decoded.args[3], -Infinity)
 assert.ok(Object.is(decoded.args[4], -0))
 assert.equal(decoded.args[5].toISOString(), when.toISOString())
 assert.deepEqual(decoded.args[6], { __fieldTransport: 'user-value', nested: [1, undefined] })
 assert.deepEqual(decoded.bindings, { label: 'hello', missing: undefined })

 // Rejects non-serializable explicit args & non-block send targets
 const transport = createTransport()
 assert.throws(() => transport.send('not-a-block'), TypeError)
 const cyclic = {}
 cyclic.self = cyclic
 assert.throws(
  () => serializeTransportPacket({ type: TRANSPORT_PACKET_TYPE, ast: [], args: [cyclic], bindings: {} }),
  TypeError
 )

 // 2. Server lane has NO document; send collects serialized packets without executing block on server
 const serverSecret = { token: 'server-only', secretFn() { return 'nope' } }
 const fakeDataClient = Object.assign(Object.create({ async get() { return 'kv' } }), { prefix: 'lane' })
 const { results, sent, state } = await runLines(
  [
   '; to greeting \'Hello from FieldScript\'',
   '; send ( [ to title [ invoke { h1 } document createElement ] ] [set \'Hello from FieldScript\' title textContent] [ get title ] ) -- if last item returned from script is an element it is appended to Lane Output below the lane',
   "[ send ( ; to { prefix } $argv, ; to p !document.createElement p, ; to msg ; add $prefix $greeting, ; set $msg p.textContent, $p ) 'Msg: ' ]",
   '; to items { Alpha Beta }',
   '; each $items ( ; to { label } $argv, ; send ( ; to li !document.createElement div, ; set $label li.textContent, $li ) )',
   '; to savedBlock ( ; to badge !document.createElement span, ; set \'Reused\' badge.textContent, $badge )',
   '; send $savedBlock',
   '; to pkt ; send ( ; to theme \'#9ce5ff\', \'not-an-element\' )',
   '; send ( ; to styled !document.createElement p, ; set $theme styled.style.color, ; set \'Themed\' styled.textContent, $styled )',
   '; to greeting \'Mutated after send\'',
  ],
  { filename: 'server-lane', initialState: { data: fakeDataClient, serverSecret, Math, JSON, Date } }
 )

 assert.equal(results.every(r => r.error === null), true, JSON.stringify(results.filter(r => r.error)))
 assert.equal(sent.length, 7)
 assert.equal(isTransportPacket(sent[0]), true)
 assert.equal(typeof sent[0].wire, 'string')
 assert.equal(sent[0].lineNumber, 2)
 assert.equal(results[1].preview, '[sent #1 · 3 stmts]')
 // Server-only globals (`data`) and non-serializable objects (`serverSecret` containing a function) are excluded
 assert.equal('data' in sent[0].bindings, false)
 assert.equal('serverSecret' in sent[0].bindings, false)
 // Snapshot captured before later mutation (`greeting` stays 'Hello from FieldScript' in packet #2)
 assert.equal(sent[1].bindings.greeting, 'Hello from FieldScript')
 assert.equal(state.greeting, 'Mutated after send')
 // Loop iterations captured distinct snapshots
 assert.equal(sent[2].bindings.label, 'Alpha')
 assert.equal(sent[3].bindings.label, 'Beta')
 // Re-sending an existing transport packet also works
 const resent = transport.send(state.pkt)
 assert.deepEqual(resent.ast, state.pkt.ast)

 // 3. Execute transported scripts in browser context via runTransportedScripts
 function createMockEl(tag) {
  return {
   tag,
   nodeType: 1,
   style: {},
   attributes: {},
   children: [],
   listeners: {},
   textContent: '',
   setAttribute(k, v) { this.attributes[k] = v },
   appendChild(c) { this.children.push(c); return c },
   addEventListener(ev, fn) { this.listeners[ev] = fn },
  }
 }
 const mockWindow = { Array, Date, JSON, Math, String }
 const mockDocument = { defaultView: mockWindow, createElement: createMockEl }
 const outputEl = createMockEl('div')
 assert.equal(isDomElement(outputEl), true)
 assert.equal(isDomElement({ tag: 'plain' }), false)
 assert.equal(isDomElement('text'), false)

 const browserOutcome = await runTransportedScripts(
  sent.map(p => p.wire),
  { document: mockDocument, window: mockWindow, output: outputEl }
 )

 assert.equal(browserOutcome.results.length, 7)
 assert.equal(browserOutcome.results.every(r => r.error === null), true, JSON.stringify(browserOutcome.results))
 // 6 of 7 returned elements; packet #6 returned string 'not-an-element' and was NOT appended
 assert.deepEqual(
  browserOutcome.results.map(r => r.appended),
  [true, true, true, true, true, false, true]
 )
 assert.equal(outputEl.children.length, 6)
 assert.equal(outputEl.children[0].tag, 'h1')
 assert.equal(outputEl.children[0].textContent, 'Hello from FieldScript')
 assert.equal(outputEl.children[1].tag, 'p')
 assert.equal(outputEl.children[1].textContent, 'Msg: Hello from FieldScript')
 assert.equal(outputEl.children[2].tag, 'div')
 assert.equal(outputEl.children[2].textContent, 'Alpha')
 assert.equal(outputEl.children[3].tag, 'div')
 assert.equal(outputEl.children[3].textContent, 'Beta')
 assert.equal(outputEl.children[4].tag, 'span')
 assert.equal(outputEl.children[4].textContent, 'Reused')
 // Packet #6 set browser-side `theme` which packet #7 read!
 assert.equal(outputEl.children[5].tag, 'p')
 assert.equal(outputEl.children[5].style.color, '#9ce5ff')
 assert.equal(outputEl.children[5].textContent, 'Themed')

 // 4. Browser event handlers keep isolated closures across blocks, and errors don't stop later scripts
 const { sent: interactiveSent } = await runLines([
  `; send ( ; to el !document.createElement button, ; set 'Btn 1' el.textContent, !el.addEventListener click ( ; set 'Clicked 1' el.textContent ), $el )`,
  `; send ( !document.missingMethod )`,
  `; send ( ; to el !document.createElement button, ; set 'Btn 2' el.textContent, !el.addEventListener click ( ; set 'Clicked 2' el.textContent ), $el )`,
 ])
 const out2 = createMockEl('div')
 const res2 = await runTransportedScripts(interactiveSent, { document: mockDocument, window: mockWindow, output: out2 })
 assert.equal(res2.results[0].appended, true)
 assert.ok(res2.results[1].error)
 assert.equal(res2.results[1].appended, false)
 assert.equal(res2.results[2].appended, true)
 assert.equal(out2.children.length, 2)
 // Clicking button 1 updates button 1 (not clobbered by button 2's `el`)
 await out2.children[0].listeners.click()
 assert.equal(out2.children[0].textContent, 'Clicked 1')
 assert.equal(out2.children[1].textContent, 'Btn 2')
 await out2.children[1].listeners.click()
 assert.equal(out2.children[1].textContent, 'Clicked 2')

 // 5. isCancelled halts remaining scripts
 const out3 = createMockEl('div')
 let count = 0
 const res3 = await runTransportedScripts(interactiveSent, {
  document: mockDocument,
  window: mockWindow,
  output: out3,
  isCancelled: () => ++count > 1,
 })
 assert.equal(res3.results.length, 0)
 assert.equal(out3.children.length, 0)
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

  // Enter the user's send block -> Lane Output mini-browser appears below the lane with the <h1>
  nb1.rows[0]['input-el'].value = "; send ( [ to title [ invoke { h1 } document createElement ] ] [set 'Hello from FieldScript' title textContent] [ get title ] ) -- if last item returned from script is an element it is appended to Lane Output below the lane"
  await nb1.rows[0]['input-el'].listeners.input()
  assert.equal(nb1.rows[0]['preview-el'].textContent, '[sent #1 · 3 stmts]')
  assert.equal(out1.element.hidden, false)
  assert.equal(out1['count-el'].textContent, '1 script')
  assert.equal(out1['errors-el'].hidden, true)
  assert.equal(out1['viewport-el'].children.length, 1)
  assert.equal(out1['viewport-el'].children[0].tag, 'h1')
  assert.equal(out1['viewport-el'].children[0].textContent, 'Hello from FieldScript')

  // Add a server value and an interactive button sent to the mini-browser
  await nb1['add-btn'].listeners.click()
  nb1.rows[1]['input-el'].value = "; to serverLabel 'Launch'"
  await nb1.rows[1]['input-el'].listeners.input()
  await nb1['add-btn'].listeners.click()
  nb1.rows[2]['input-el'].value = "; send ( ; to btn !document.createElement button, ; set $serverLabel btn.textContent, !btn.addEventListener click ( ; set 'Launched!' btn.textContent ), $btn )"
  await nb1.rows[2]['input-el'].listeners.input()

  assert.equal(out1['count-el'].textContent, '2 scripts')
  assert.equal(out1['viewport-el'].children.length, 2)
  assert.equal(out1['viewport-el'].children[1].tag, 'button')
  assert.equal(out1['viewport-el'].children[1].textContent, 'Launch')

  // Clicking the rendered button runs FieldScript in browser context
  await out1['viewport-el'].children[1].listeners.click()
  assert.equal(out1['viewport-el'].children[1].textContent, 'Launched!')

  // Clicking the mini-browser Reload button resets & re-runs sent scripts cleanly
  await out1['reload-btn'].listeners.click()
  assert.equal(out1['viewport-el'].children.length, 2)
  assert.equal(out1['viewport-el'].children[1].textContent, 'Launch')

  // Browser runtime error displays inside Lane Output errors panel without dropping valid elements
  await nb1['add-btn'].listeners.click()
  nb1.rows[3]['input-el'].value = '; send ( !document.doesNotExist )'
  await nb1.rows[3]['input-el'].listeners.input()
  assert.equal(out1['count-el'].textContent, '3 scripts')
  assert.equal(out1['viewport-el'].children.length, 2)
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
  assert.equal(out2['viewport-el'].children.length, 1)
  assert.equal(out2['viewport-el'].children[0].textContent, 'Imported: Launch')

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
  assert.equal(reloadedOut1['viewport-el'].children.length, 2)
  assert.equal(reloadedOut1['viewport-el'].children[0].tag, 'h1')
  assert.equal(reloadedOut1['viewport-el'].children[0].textContent, 'Hello from FieldScript')

  // Removing all `send` lines hides Lane Output again
  const reloadedNb1 = fReload.state.lanes[0].notebook
  await reloadedNb1.rows[2]['remove-btn'].listeners.click()
  await reloadedNb1.rows[0]['remove-btn'].listeners.click()
  assert.equal(reloadedOut1.element.hidden, true)
  assert.equal(reloadedOut1['viewport-el'].children.length, 0)
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
  const card = outView['viewport-el'].children[0]
  assert.equal(card.children[0].textContent, 'NF')
  assert.equal(card.children[1].textContent, 'Nate Ferrero')
  assert.equal(card.children[2].textContent, 'Hello, Nate Ferrero')
  assert.equal(card.children[3].textContent, '$234.55')

  // Reactive cascade: editing Ledger balance automatically updates Profile -> Profile Viewer -> Lane Output!
  ledger.notebook.rows[0]['input-el'].value = '; to balance 500'
  await ledger.notebook.rows[0]['input-el'].listeners.input()
  const updatedCard = outView['viewport-el'].children[0]
  assert.equal(updatedCard.children[3].textContent, '$500.00')
 }
 finally {
  globalThis.fetch = origFetch
 }
})

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

  dataView['table-name-input'].value = 'expenses'
  await dataView['table-name-input'].listeners.input()
  assert.equal(dataView['table-tabs'][0]['label-el'].textContent, 'expenses')

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

  await dataView['clear-rows-btn'].listeners.click()
  assert.equal(confirmModal['is-open'], true)
  assert.match(confirmModal['message-el'].textContent, /Delete all 1 row/)
  await confirmModal['cancel-btn'].listeners.click()
  assert.equal(dataView.tables[1].rows.length, 1)

  await dataView['clear-rows-btn'].listeners.click()
  await confirmModal['confirm-btn'].listeners.click()
  assert.equal(dataView.tables[1].rows.length, 0)
  assert.equal(dataView.tables[1].columns.length, 1)

  // Switching to table with rows collapses schema by default; switching to empty table opens it
  await dataView['table-tabs'][0].el.listeners.click()
  assert.equal(dataView['schema-open'], false)
  assert.equal(dataView['schema-section'].hidden, true)
  await dataView['table-tabs'][1].el.listeners.click()
  assert.equal(dataView['schema-open'], true)
  assert.equal(dataView['schema-section'].hidden, false)

  await dataView['delete-table-btn'].listeners.click()
  assert.equal(confirmModal['is-open'], true)
  assert.match(confirmModal['message-el'].textContent, /Delete table/)
  await confirmModal['cancel-btn'].listeners.click()
  assert.equal(dataView.tables.length, 2)

  await dataView['delete-table-btn'].listeners.click()
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
  dataView['table-name-input'].value = 'invoices'
  await dataView['table-name-input'].listeners.input()

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

test('Lane tab route helpers parse and format ;tab segments including encoded %3B and home Source', () => {
 assert.deepEqual(LANE_TABS, ['source', 'input', 'scope', 'data', 'view', 'server'])
 assert.equal(DEFAULT_LANE_TAB, 'source')
 assert.equal(normalizeLaneTab('data'), 'data')
 assert.equal(normalizeLaneTab('VIEW'), 'view')
 assert.equal(normalizeLaneTab('SERVER'), 'server')
 assert.equal(normalizeLaneTab('unknown'), 'source')
 assert.equal(normalizeLaneTab(undefined), 'source')

 const id = 'e9f68d51-60f9-4f2a-af09-31a2cdbf0b36'
 assert.equal(formatLaneRouteSegment(id, 'source'), id)
 assert.equal(formatLaneRouteSegment(id, 'data'), `${id};data`)
 assert.equal(formatLaneRouteSegment(id, 'view'), `${id};view`)
 assert.equal(formatLaneRouteSegment(id, 'server'), `${id};server`)
 assert.equal(formatLaneRouteSegment(id, 'input'), `${id};input`)
 assert.equal(formatLaneRouteSegment(id, 'scope'), `${id};scope`)
 assert.equal(formatLaneRouteSegment('lane;1', 'data'), 'lane%3B1;data')
 assert.equal(formatLaneRouteSegment('lane;1', 'source'), 'lane%3B1')

 assert.deepEqual(parseLaneRouteSegment(id), { id, tab: 'source' })
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
  assert.equal(out1['viewport-el'].children[0].textContent, 'Hello View')

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
  assert.equal(out1['viewport-el'].children[0].textContent, 'Hello View')

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
  assert.equal(rl1.notebook['output-view']['viewport-el'].children[0].textContent, 'Hello View')
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
  await labelHead['resizer-el'].listeners.mousedown({ clientX: 100, preventDefault() {}, stopPropagation() {} })
  await dispatchWindowEvent('mousemove', { clientX: 190 })
  await dispatchWindowEvent('mouseup', {})
  assert.equal(dataView.tables[0].columns[0].width, 230)
  assert.equal(labelHead.el.style.width, '230px')
  assert.equal(row0.cells[0].td.style.width, '230px')
  assert.match(labelHead.el.className, /lane-data-th--sized/)
  assert.match(row0.cells[0].td.className, /lane-data-td--sized/)

  const balHead = dataView['grid-head-cells'][4]
  await balHead['resizer-el'].listeners.mousedown({ clientX: 300, preventDefault() {}, stopPropagation() {} })
  await dispatchWindowEvent('mousemove', { clientX: 260 })
  await dispatchWindowEvent('mouseup', {})
  assert.equal(dataView.tables[0].columns[3].width, 100)
  assert.equal(balHead.el.style.width, '100px')
  assert.equal(row0.cells[3].td.style.width, '100px')
  // Preserves right-align class when sized!
  assert.match(row0.cells[3].td.className, /lane-data-td--right/)
  assert.match(row0.cells[3].td.className, /lane-data-td--sized/)

  // Reload app -> persisted widths survive in schema and are applied to th & td immediately
  const fReload = makeRuntime()
  await fReload.run(parse(mainSource, '/src/main.fs'))
  const reloadedData = fReload.state.lanes[0].notebook['data-view']
  assert.equal(reloadedData.tables[0].columns[0].width, 230)
  assert.equal(reloadedData.tables[0].columns[3].width, 100)
  assert.equal(reloadedData['grid-head-cells'][1].el.style.width, '230px')
  assert.equal(reloadedData['grid-rows'][0].cells[0].td.style.width, '230px')
  assert.equal(reloadedData['grid-head-cells'][4].el.style.width, '100px')
  assert.equal(reloadedData['grid-rows'][0].cells[3].td.style.width, '100px')

  // Double-clicking resizer resets column width back to auto and persists
  await reloadedData['grid-head-cells'][1]['resizer-el'].listeners.dblclick()
  assert.equal(Object.hasOwn(reloadedData.tables[0].columns[0], 'width'), false)
  assert.equal(reloadedData['grid-head-cells'][1].el.style.width, '')
  assert.equal(reloadedData['grid-rows'][0].cells[0].td.style.width, '')
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
   runLines: countedRunLines,
   runTransportedScripts,
  })

  await f.run(parse(mainSource, '/src/main.fs'))
  await f.state.tableHeadRowAddButton.listeners.click()
  await f.state.tableHeadRowAddButton.listeners.click()
  const lane1 = f.state.lanes[0]
  const lane2 = f.state.lanes[1]

  // Verify minimize, reload, and close buttons on the right of header
  const headerTop = lane1.element.children[0]
  assert.equal(headerTop.children[2], lane1['min-left-btn'])
  assert.equal(headerTop.children[3], lane1['min-right-btn'])
  assert.equal(headerTop.children[4], lane1['reload-btn'])
  assert.equal(headerTop.children[5], lane1['close-btn'])

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
  assert.equal(lane1.notebook['output-view']['viewport-el'].children[0].textContent, 'Updated from Server')
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
  dataView['table-name-input'].value = 'customers'
  await dataView['table-name-input'].listeners.input()
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
  dataView['table-name-input'].value = 'orders'
  await dataView['table-name-input'].listeners.input()

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
  assert.equal(custCell0['display-el'].textContent, 'Select row…')
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
  assert.equal(custCell0['display-el'].textContent, 'Select row…')

  // Pick 'Acme Beta' (102) via initial page 1 (zero extra page loads)
  fetchCalls.length = 0
  await custCell0['trigger-el'].listeners.click()
  assert.deepEqual(fetchCalls, [{ offset: 0, limit: 3 }])
  await rowPicker['option-items'][1].el.listeners.click()
  assert.strictEqual(dataView.tables[1].rows[0].values[customerColId], 102)
  assert.equal(custCell0['display-el'].textContent, 'Acme Beta')
  assert.equal(custCell0['id-el'].textContent, '102')

  // Edit watchers (row[]): add two linked items (101 and 106)
  const watchersCell0 = orderRow0.cells[1]
  await watchersCell0['add-btn'].listeners.click()
  await watchersCell0.items[0]['trigger-el'].listeners.click()
  await rowPicker['option-items'][0].el.listeners.click() // 101 Acme Alpha
  await watchersCell0['add-btn'].listeners.click()
  await watchersCell0.items[1]['trigger-el'].listeners.click()
  rowPicker['search-input'].value = 'Zeta'
  await rowPicker['search-input'].listeners.input()
  await rowPicker['option-items'][0].el.listeners.click() // 106 Delta Zeta
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
  assert.equal(dv2['table-name-input'].value, 'orders')

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
 const activeCache = cacheStorage.get('civil-command-v1')
 for (const f of srcFiles) {
  assert.ok(activeCache.has(`/src/${f}`), `sw.js APP_SHELL should precache /src/${f}`)
 }

 // Activate removes old civil-command-* cache and claims clients
 const activatePromises = []
 swListeners.activate({ waitUntil: p => activatePromises.push(p) })
 await Promise.all(activatePromises)
 assert.equal(clientsClaimCalled, true)
 assert.equal(cacheStorage.has('civil-command-v0'), false)
 assert.equal(cacheStorage.has('civil-command-v1'), true)

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
 assert.match(indexHtml, /\.lane-body--sized\s+\.lane-scope-columns,\s*\.lane-body--sized\s+\.lane-data-grid-wrap\s*\{[^}]*max-width:\s*100%;[^}]*width:\s*100%;/s)

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

test('workflow constraint helpers: normalization, default from/to detection, transition graph, cell states, and stored persistence', () => {
 assert.deepEqual(DATA_CONSTRAINT_TYPES, ['workflow'])
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

 // parseColumnType & formatColumnType keep workflow constraint only on text columns
 const wfSpec = {
  type: 'text',
  multiple: false,
  constraint: { type: 'workflow', tableId: 't-wf', fromColumnId: 'c-from', toColumnId: 'c-to' },
 }
 assert.deepEqual(parseColumnType(wfSpec), wfSpec)
 assert.deepEqual(parseColumnType({ type: 'integer', multiple: false, constraint: wfSpec.constraint }), {
  type: 'integer',
  multiple: false,
 })
 assert.equal(formatColumnType(wfSpec), 'text(workflow)')
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

  // Verify `+ constraint` dropdown is visible ONLY on text columns, and Constraint section starts hidden
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
  assert.equal(prioritySrow['constraint-add-el'].hidden, true)
  assert.equal(prioritySrow['constraint-config-wrap'].hidden, true)

  // 3. Add Workflow constraint to `status` via `+ constraint` dropdown
  statusSrow['constraint-add-el'].value = 'workflow'
  await statusSrow['constraint-add-el'].listeners.change()

  const statusSrowOpen = dataView['schema-rows'][1]
  assert.equal(statusSrowOpen['constraint-add-el'].hidden, true)
  assert.equal(statusSrowOpen['constraint-config-wrap'].hidden, false)
  assert.deepEqual(
   statusSrowOpen['constraint-type-el'].children.map(o => ({ v: o.value, t: o.textContent })),
   [{ v: 'workflow', t: 'Workflow' }]
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

test('Fixed left and right side rails: styles, chevron minimize buttons, 26px initial icons, non-interactive hover preview, vertical placeholder, and in-place restore', async () => {
 // 1. Unit checks for side rail helpers
 assert.deepEqual(LANE_MINIMIZE_SIDES, ['left', 'right'])
 assert.equal(normalizeLaneMinimizeSide('left'), 'left')
 assert.equal(normalizeLaneMinimizeSide(' RIGHT '), 'right')
 assert.equal(normalizeLaneMinimizeSide('center'), null)
 assert.equal(normalizeLaneMinimizeSide(''), null)
 assert.equal(normalizeLaneMinimizeSide(null), null)

 assert.equal(getLaneInitial('Alpha'), 'A')
 assert.equal(getLaneInitial('  beta lane'), 'B')
 assert.equal(getLaneInitial('🚀 Rocket'), '🚀')
 assert.equal(getLaneInitial('', 'lane-9'), 'L')
 assert.equal(getLaneInitial('   ', ''), '?')

 // 2. Verify CSS rules in index.html and sw.js precache
 const indexHtml = await fs.readFile(new URL('./index.html', import.meta.url), 'utf8')
 const swSource = await fs.readFile(new URL('./sw.js', import.meta.url), 'utf8')
 assert.match(swSource, /'\/src\/lane-rails\.fs'/)
 assert.match(indexHtml, /body\s*\{[^}]*margin-right:\s*64px;[^}]*margin-left:\s*64px;/s)
 assert.match(indexHtml, /\.side-rail\s*\{[^}]*background-color:\s*#383838;[^}]*bottom:\s*0;[^}]*box-sizing:\s*border-box;[^}]*position:\s*fixed;[^}]*top:\s*0;[^}]*width:\s*32px;[^}]*z-index:\s*2000;/s)
 assert.match(indexHtml, /\.side-rail--left\s*\{[^}]*border-right:\s*1px solid [^;]+;[^}]*left:\s*0;/s)
 assert.match(indexHtml, /\.side-rail--right\s*\{[^}]*border-left:\s*1px solid [^;]+;[^}]*right:\s*0;/s)
 assert.match(indexHtml, /\.side-rail-icon\s*\{[^}]*background:\s*#ffffff0e;[^}]*border:\s*1px solid #ffffff24;[^}]*box-sizing:\s*border-box;[^}]*height:\s*26px;[^}]*justify-content:\s*center;[^}]*width:\s*26px;/s)
 assert.match(indexHtml, /\.side-rail-preview\s*\{[^}]*pointer-events:\s*none;[^}]*position:\s*fixed;[^}]*user-select:\s*none;[^}]*z-index:\s*2100;/s)
 assert.match(indexHtml, /\.lane-minimized-title\s*\{[^}]*writing-mode:\s*vertical-rl;/s)

 // 3. Full integration test
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
  const el = {
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
   rect: { top: 48, height: 300, width: 320 },
   getBoundingClientRect() { return this.rect },
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
   replaceChildren(...nodes) {
    for (const c of this.children.slice()) {
     c.parentNode = null
     c.removed = true
    }
    this.children = []
    for (const n of nodes) { this.appendChild(n) }
   },
   addEventListener(event, handler) { this.listeners[event] = handler },
   focus() {},
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
  return el
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
  if (url === '/src/lane-servers-modal.fs') { return { text: async () => laneServersModalSource } }
  if (url === '/src/lane-terminal-modal.fs') { return { text: async () => laneTerminalModalSource } }
  if (url === '/src/lane-session-modal.fs') { return { text: async () => sessionModalSource } }
  if (url === '/src/lane-package-modal.fs') { return { text: async () => packageModalSource } }
  if (url === '/src/lane-dir-modal.fs') { return { text: async () => dirModalSource } }
  throw new Error(`Unexpected fetch: ${url}`)
 }

 function createRuntime(initialPathname = '/') {
  const mockWindow = {
   Array,
   Boolean,
   Date,
   JSON,
   Math,
   Object,
   Reflect,
   innerHeight: 600,
   decodeURIComponent,
   crypto: { randomUUID: () => `rail-uuid-${++uuid}` },
   history: { pushState(_s, _t, url) { mockWindow.location.pathname = url } },
   location: { pathname: initialPathname, search: '', hash: '' },
   addEventListener() {},
   removeEventListener() {},
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
  return { f, mockWindow, mockBody }
 }

 try {
  const { f, mockWindow, mockBody } = createRuntime('/')
  await f.run(parse(mainSource, '/src/main.fs'))
  const laneControl = f.state['lane-control']
  const rails = laneControl.rails

  // Both fixed rails are always mounted and open on startup (even with 0 lanes)
  assert.equal(rails['left-rail'].tag, 'aside')
  assert.equal(rails['left-rail'].className, 'side-rail side-rail--left')
  assert.equal(rails['right-rail'].tag, 'aside')
  assert.equal(rails['right-rail'].className, 'side-rail side-rail--right')
  assert.equal(rails['preview-el'].className, 'side-rail-preview')
  assert.equal(rails['preview-el'].hidden, true)
  assert.equal(rails['preview-el'].attributes['aria-hidden'], 'true')
  assert.ok(mockBody.children.includes(rails['left-rail']))
  assert.ok(mockBody.children.includes(rails['right-rail']))
  assert.ok(mockBody.children.includes(rails['preview-el']))

  // Create 3 lanes: Alpha, Beta (420px wide), Gamma
  await f.state.tableHeadRowAddButton.listeners.click()
  await f.state.tableHeadRowAddButton.listeners.click()
  await f.state.tableHeadRowAddButton.listeners.click()
  const [laneA, laneB, laneC] = f.state.lanes
  await laneControl.rename(laneA.id, 'Alpha')
  await laneControl.rename(laneB.id, 'Beta')
  await laneControl.rename(laneC.id, 'Gamma')
  await laneControl['set-width'](laneB.id, 420)
  laneB.notebook.rows[0]['input-el'].value = '; add 20 22'
  await laneB.notebook.rows[0]['input-el'].listeners.input()
  assert.equal(laneB.notebook.rows[0]['preview-el'].textContent, '42')

  // Verify chevron minimize buttons on lane header
  assert.equal(laneB['min-left-btn'].className, 'lane-min-btn lane-min-btn--left')
  assert.match(laneB['min-left-btn'].innerHTML, /<svg\b[^>]*class="lane-min-icon"/)
  assert.equal(laneB['min-right-btn'].className, 'lane-min-btn lane-min-btn--right')
  assert.match(laneB['min-right-btn'].innerHTML, /<svg\b[^>]*class="lane-min-icon"/)

  // Minimize middle lane Beta to the LEFT rail
  await laneB['min-left-btn'].listeners.click()
  assert.equal(laneB['is-minimized'], true)
  assert.equal(laneB['minimized-side'], 'left')
  assert.equal(kv.get(`${laneB.id}.minimized`), 'left')
  assert.equal(laneB.element.className, 'lane-header lane-header--minimized')
  assert.equal(laneB.body.className, 'lane-body lane-body--minimized')
  assert.equal(laneB.element.style.width, '')
  assert.equal(laneB.body.style.width, '')

  // Position in table & lanes array is preserved with a clickable vertical-text placeholder
  assert.deepEqual(f.state.lanes.map(l => l.id), [laneA.id, laneB.id, laneC.id])
  assert.equal(f.state.tableHeadRow.children[2], laneB.element)
  assert.equal(f.state.tableBodyRow.children[2], laneB.body)
  assert.ok(laneB['minimized-placeholder'])
  assert.equal(laneB['minimized-placeholder'].className, 'lane-minimized-placeholder')
  assert.equal(laneB['minimized-title-el'].className, 'lane-minimized-title')
  assert.equal(laneB['minimized-title-el'].textContent, 'Beta')

  // Left rail has 26px initial icon 'B'
  assert.equal(rails['left-items'].length, 1)
  assert.equal(rails['right-items'].length, 0)
  const betaIcon = rails['left-items'][0]['icon-el']
  assert.equal(betaIcon.className, 'side-rail-icon')
  assert.equal(betaIcon.textContent, 'B')
  assert.equal(betaIcon.title, 'Beta')
  assert.equal(betaIcon.attributes['data-rail-side'], 'left')
  assert.equal(rails['left-rail'].children[0], betaIcon)

  // Hovering left rail icon shows floating non-interactive preview with live lane DOM & clamped top
  betaIcon.rect = { top: 450, height: 26, width: 26 }
  rails['preview-el'].rect = { top: 0, height: 300, width: 420 }
  await betaIcon.listeners.mouseenter()
  assert.equal(rails['preview-el'].hidden, false)
  assert.equal(rails['preview-el'].className, 'side-rail-preview side-rail-preview--left')
  assert.equal(rails['preview-el'].style.top, '292px')
  assert.equal(rails['preview-lane'], laneB)
  assert.ok(rails['preview-header'].children.includes(laneB['header-top']))
  assert.ok(rails['preview-body'].children.includes(laneB.notebook.element))
  assert.equal(rails['preview-header'].style.width, '420px')
  assert.equal(rails['preview-body'].style.width, '420px')

  // Mouseleave hides preview and returns live lane DOM back into laneB
  await betaIcon.listeners.mouseleave()
  assert.equal(rails['preview-el'].hidden, true)
  assert.equal(rails['preview-lane'], null)
  assert.ok(laneB.element.children.includes(laneB['header-top']))
  assert.ok(laneB.body.children.includes(laneB.notebook.element))

  // Minimize Gamma to the RIGHT rail
  await laneC['min-right-btn'].listeners.click()
  assert.equal(laneC['is-minimized'], true)
  assert.equal(laneC['minimized-side'], 'right')
  assert.equal(rails['right-items'].length, 1)
  const gammaIcon = rails['right-items'][0]['icon-el']
  assert.equal(gammaIcon.textContent, 'G')
  assert.equal(gammaIcon.attributes['data-rail-side'], 'right')
  assert.equal(laneC['minimized-title-el'].textContent, 'Gamma')

  // Hovering right rail icon shows right-anchored preview
  await gammaIcon.listeners.mouseenter()
  assert.equal(rails['preview-el'].hidden, false)
  assert.equal(rails['preview-el'].className, 'side-rail-preview side-rail-preview--right')
  await gammaIcon.listeners.mouseleave()
  assert.equal(rails['preview-el'].hidden, true)

  // Renaming Beta -> Zeta while minimized updates both rail initial ('Z') and vertical placeholder ('Zeta')
  await laneControl.rename(laneB.id, 'Zeta')
  assert.equal(betaIcon.textContent, 'Z')
  assert.equal(betaIcon.title, 'Zeta')
  assert.equal(laneB['minimized-title-el'].textContent, 'Zeta')

  // Clicking rail icon while preview is active hides preview and restores lane in-place with original 420px width
  await betaIcon.listeners.mouseenter()
  assert.equal(rails['preview-el'].hidden, false)
  await betaIcon.listeners.click()
  assert.equal(rails['preview-el'].hidden, true)
  assert.equal(rails['left-items'].length, 0)
  assert.equal(laneB['is-minimized'], false)
  assert.equal(laneB['minimized-side'], null)
  assert.equal(laneB['minimized-placeholder'], null)
  assert.equal(kv.get(`${laneB.id}.minimized`), '')
  assert.equal(laneB.element.className, 'lane-header lane-header--sized')
  assert.equal(laneB.element.style.width, '420px')
  assert.equal(laneB.body.className, 'lane-body lane-body--sized')
  assert.equal(laneB.body.style.width, '420px')
  assert.equal(f.state.tableHeadRow.children[2], laneB.element)
  assert.equal(f.state.tableBodyRow.children[2], laneB.body)
  assert.ok(laneB.element.children.includes(laneB['header-top']))
  assert.ok(laneB.body.children.includes(laneB.notebook.element))

  // Clicking the vertical placeholder also unminimizes (restores) Gamma in-place
  await laneC['minimized-placeholder'].listeners.click()
  assert.equal(laneC['is-minimized'], false)
  assert.equal(laneC['minimized-placeholder'], null)
  assert.equal(rails['right-items'].length, 0)
  assert.equal(f.state.tableHeadRow.children[3], laneC.element)
  assert.equal(f.state.tableBodyRow.children[3], laneC.body)

  // Persisted minimized state restores cleanly across full app reload
  await laneA['min-left-btn'].listeners.click()
  await laneC['min-right-btn'].listeners.click()
  const reloaded = createRuntime(mockWindow.location.pathname)
  await reloaded.f.run(parse(mainSource, '/src/main.fs'))
  const [rA, rB, rC] = reloaded.f.state.lanes
  const rRails = reloaded.f.state['lane-control'].rails
  assert.equal(rA['is-minimized'], true)
  assert.equal(rA['minimized-side'], 'left')
  assert.equal(rA['minimized-title-el'].textContent, 'Alpha')
  assert.equal(rRails['left-items'].length, 1)
  assert.equal(rRails['left-items'][0]['icon-el'].textContent, 'A')
  assert.equal(rB['is-minimized'], false)
  assert.equal(rC['is-minimized'], true)
  assert.equal(rC['minimized-side'], 'right')
  assert.equal(rC['minimized-title-el'].textContent, 'Gamma')
  assert.equal(rRails['right-items'].length, 1)
  assert.equal(rRails['right-items'][0]['icon-el'].textContent, 'G')

  // Closing a minimized lane removes its rail icon and clears persisted minimized state
  await reloaded.f.state['lane-control'].close(rC.id)
  assert.equal(rRails['right-items'].length, 0)
  assert.equal(kv.get(`${rC.id}.minimized`), '')
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

  // Click cell trigger -> opens full-screen lane-modal in picker mode mimicking Open Lane
  await cell1['trigger-el'].listeners.click()
  assert.equal(modal['is-open'], true)
  assert.equal(modal.mode, 'pick')
  assert.equal(modal['heading-el'].textContent, 'Select target_lane')
  assert.equal(modal['clear-btn'].hidden, true)
  assert.equal(modal['search-input'].focused, true)
  assert.equal(modal['count-el'].textContent, '3 lanes')
  assert.ok(mockBody.children.includes(modal.backdrop))

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

  // Test multiple lane[] column: add 2 items, select lanes, verify split controls + open-to-right moves open lane
  const multiCell = dv['grid-rows'][0].cells[1]
  await multiCell['add-btn'].listeners.click()
  await multiCell['add-btn'].listeners.click()
  assert.equal(multiCell.items.length, 2)
  await multiCell.items[0]['trigger-el'].listeners.click()
  await modal.items.find(it => it.entry.id === boardLane.id)['select-btn'].listeners.click()
  await multiCell.items[1]['trigger-el'].listeners.click()
  await modal.items.find(it => it.entry.id === workerBLane.id)['select-btn'].listeners.click()
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

test('Fixed 16px top rail: styles, centered 12px icon buttons, root html fullscreen with corner-inverting SVG, and Open Lane search button', async () => {
 const indexHtml = await fs.readFile(new URL('./index.html', import.meta.url), 'utf8')
 assert.match(indexHtml, /:root\s*\{[^}]*padding:\s*calc\(16px \+ 1em\) 1em 1em;/s)
 assert.match(indexHtml, /\.lane-modal-backdrop\s*\{[^}]*padding:\s*calc\(16px \+ 1\.5em\) calc\(32px \+ 1\.5em\) 1\.5em;/s)
 assert.match(indexHtml, /\.top-rail\s*\{[^}]*align-items:\s*center;[^}]*background-color:\s*#383838;[^}]*border-bottom:\s*1px solid #ffffff24;[^}]*box-sizing:\s*border-box;[^}]*height:\s*16px;[^}]*justify-content:\s*center;[^}]*position:\s*fixed;[^}]*top:\s*0;[^}]*z-index:\s*2001;/s)
 assert.match(indexHtml, /\.top-rail-icon\s*\{[^}]*background:\s*#ffffff0e;[^}]*border:\s*1px solid #ffffff24;[^}]*box-sizing:\s*border-box;[^}]*height:\s*12px;[^}]*justify-content:\s*center;[^}]*padding:\s*0;[^}]*width:\s*12px;/s)
 assert.match(indexHtml, /\.side-rail\s*\{[^}]*padding:\s*20px 0 4px;/s)
 assert.match(indexHtml, /\.side-rail-preview\s*\{[^}]*top:\s*24px;/s)

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
  const el = {
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
  return el
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
  if (url === '/src/lane-servers-modal.fs') { return { text: async () => laneServersModalSource } }
  if (url === '/src/lane-terminal-modal.fs') { return { text: async () => laneTerminalModalSource } }
  if (url === '/src/lane-session-modal.fs') { return { text: async () => sessionModalSource } }
  if (url === '/src/lane-package-modal.fs') { return { text: async () => packageModalSource } }
  if (url === '/src/lane-dir-modal.fs') { return { text: async () => dirModalSource } }
  throw new Error(`Unexpected fetch: ${url}`)
 }

 const docListeners = {}
 const mockHtml = createMockElement('html')
 const mockBody = createMockElement('body')
 let requestCalls = 0
 let bodyRequestCalls = 0
 let exitCalls = 0
 let rejectNextFullscreen = false
 mockBody.requestFullscreen = async () => { bodyRequestCalls++ }

 const mockDocument = {
  body: mockBody,
  documentElement: mockHtml,
  fullscreenElement: null,
  createElement: createMockElement,
  addEventListener(event, handler) {
   docListeners[event] ||= []
   docListeners[event].push(handler)
  },
  async exitFullscreen() {
   exitCalls++
   mockDocument.fullscreenElement = null
   for (const handler of docListeners.fullscreenchange || []) {
    await handler()
   }
  },
 }

 mockHtml.requestFullscreen = async function () {
  requestCalls++
  assert.equal(this, mockHtml)
  if (rejectNextFullscreen) {
   rejectNextFullscreen = false
   throw new Error('Fullscreen blocked')
  }
  mockDocument.fullscreenElement = mockHtml
  for (const handler of docListeners.fullscreenchange || []) {
   await handler()
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
  innerHeight: 600,
  decodeURIComponent,
  crypto: { randomUUID: () => `top-rail-uuid-${++uuid}` },
  history: { pushState(_s, _t, url) { mockWindow.location.pathname = url } },
  location: { pathname: '/', search: '', hash: '' },
  addEventListener() {},
  removeEventListener() {},
 }
 mockDocument.defaultView = mockWindow

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

 try {
  await f.run(parse(mainSource, '/src/main.fs'))
  const laneControl = f.state['lane-control']
  const rails = laneControl.rails
  const modal = laneControl['lane-modal']

  // Top rail is mounted on body with 6 centered icon buttons in order: fullscreen, search, session, packages, servers, preferences
  const topRail = rails['top-rail']
  assert.equal(topRail.tag, 'aside')
  assert.equal(topRail.className, 'top-rail')
  assert.equal(topRail.attributes.role, 'region')
  assert.ok(mockBody.children.includes(topRail))
  assert.equal(topRail.children.length, 6)

  const fsBtn = rails['fullscreen-btn']
  const searchBtn = rails['search-btn']
  const sessionBtn = rails['session-btn']
  const packagesBtn = rails['packages-btn']
  const serversBtn = rails['servers-btn']
  const prefBtn = rails['preferences-btn']
  assert.equal(topRail.children[0], fsBtn)
  assert.equal(topRail.children[1], searchBtn)
  assert.equal(topRail.children[2], sessionBtn)
  assert.equal(topRail.children[3], packagesBtn)
  assert.equal(topRail.children[4], serversBtn)
  assert.equal(topRail.children[5], prefBtn)
  assert.equal(sessionBtn.className, 'top-rail-icon top-rail-icon--session')
  assert.equal(sessionBtn.textContent, '')
  assert.match(sessionBtn.innerHTML, /class="top-rail-icon-svg top-rail-icon-svg--session"/)
  assert.equal(packagesBtn.className, 'top-rail-icon top-rail-icon--packages')
  assert.equal(packagesBtn.textContent, '')
  assert.match(packagesBtn.innerHTML, /class="top-rail-icon-svg top-rail-icon-svg--packages"/)
  assert.equal(serversBtn.className, 'top-rail-icon top-rail-icon--servers')
  assert.equal(serversBtn.textContent, '')
  assert.match(serversBtn.innerHTML, /class="top-rail-icon-svg top-rail-icon-svg--servers"/)
  assert.equal(prefBtn.className, 'top-rail-icon top-rail-icon--preferences')
  assert.equal(prefBtn.textContent, '')
  assert.match(prefBtn.innerHTML, /class="top-rail-icon-svg top-rail-icon-svg--preferences"/)

  // Initial fullscreen button state: no text, outward 4-corners SVG
  assert.equal(fsBtn.tag, 'button')
  assert.equal(fsBtn.type, 'button')
  assert.equal(fsBtn.className, 'top-rail-icon top-rail-icon--fullscreen')
  assert.equal(fsBtn.textContent, '')
  assert.equal(rails['is-fullscreen'], false)
  assert.equal(fsBtn.attributes['data-fullscreen'], 'false')
  assert.equal(fsBtn.attributes['aria-pressed'], 'false')
  assert.match(fsBtn.innerHTML, /class="top-rail-icon-svg top-rail-icon-svg--fullscreen-enter"/)
  assert.match(fsBtn.innerHTML, /M1\.5 3\.5V1\.5H3\.5M6\.5 1\.5H8\.5V3\.5M8\.5 6\.5V8\.5H6\.5M3\.5 8\.5H1\.5V6\.5/)

  // Clicking fullscreen enters fullscreen on root <html> (documentElement) and inverts all 4 corners
  await fsBtn.listeners.click()
  assert.equal(requestCalls, 1)
  assert.equal(bodyRequestCalls, 0)
  assert.equal(mockDocument.fullscreenElement, mockHtml)
  assert.equal(rails['is-fullscreen'], true)
  assert.equal(fsBtn.textContent, '')
  assert.equal(fsBtn.attributes['data-fullscreen'], 'true')
  assert.equal(fsBtn.attributes['aria-pressed'], 'true')
  assert.match(fsBtn.innerHTML, /class="top-rail-icon-svg top-rail-icon-svg--fullscreen-exit"/)
  assert.match(fsBtn.innerHTML, /M1\.5 3\.5H3\.5V1\.5M6\.5 1\.5V3\.5H8\.5M8\.5 6\.5H6\.5V8\.5M3\.5 8\.5V6\.5H1\.5/)

  // Clicking again exits fullscreen and reverts the 4 corners outward
  await fsBtn.listeners.click()
  assert.equal(exitCalls, 1)
  assert.equal(mockDocument.fullscreenElement, null)
  assert.equal(rails['is-fullscreen'], false)
  assert.equal(fsBtn.attributes['data-fullscreen'], 'false')
  assert.equal(fsBtn.attributes['aria-pressed'], 'false')
  assert.match(fsBtn.innerHTML, /class="top-rail-icon-svg top-rail-icon-svg--fullscreen-enter"/)

  // External fullscreenchange (e.g. Escape key in browser) keeps the icon synced
  mockDocument.fullscreenElement = mockHtml
  for (const handler of docListeners.fullscreenchange || []) { await handler() }
  assert.equal(rails['is-fullscreen'], true)
  assert.match(fsBtn.innerHTML, /class="top-rail-icon-svg top-rail-icon-svg--fullscreen-exit"/)
  mockDocument.fullscreenElement = null
  for (const handler of docListeners.fullscreenchange || []) { await handler() }
  assert.equal(rails['is-fullscreen'], false)
  assert.match(fsBtn.innerHTML, /class="top-rail-icon-svg top-rail-icon-svg--fullscreen-enter"/)

  // Rejected requestFullscreen() promise is handled safely without throwing
  rejectNextFullscreen = true
  await fsBtn.listeners.click()
  assert.equal(requestCalls, 2)
  assert.equal(mockDocument.fullscreenElement, null)
  assert.equal(rails['is-fullscreen'], false)
  assert.match(fsBtn.innerHTML, /class="top-rail-icon-svg top-rail-icon-svg--fullscreen-enter"/)

  // Create and rename a lane, then close it so search modal can show both open and closed lanes
  await f.state.tableHeadRowAddButton.listeners.click()
  await f.state.tableHeadRowAddButton.listeners.click()
  const [lane1, lane2] = f.state.lanes
  await laneControl.rename(lane1.id, 'Alpha')
  await laneControl.rename(lane2.id, 'Beta')
  await laneControl.close(lane2.id)

  // Search button has no text, search SVG, and opens the same Open Lane dialog as Home's Open button
  assert.equal(searchBtn.tag, 'button')
  assert.equal(searchBtn.type, 'button')
  assert.equal(searchBtn.className, 'top-rail-icon top-rail-icon--search')
  assert.equal(searchBtn.textContent, '')
  assert.match(searchBtn.innerHTML, /class="top-rail-icon-svg top-rail-icon-svg--search"/)

  await searchBtn.listeners.click()
  assert.equal(modal['is-open'], true)
  assert.equal(modal.mode, 'open')
  assert.equal(modal['heading-el'].textContent, 'Open Lane')
  assert.equal(modal['clear-btn'].hidden, true)
  assert.equal(modal['count-el'].textContent, '2 lanes')
  assert.ok(mockBody.children.includes(modal.backdrop))
  assert.ok(modal.items.find(it => it.entry.id === lane1.id)['close-btn'])
  assert.ok(modal.items.find(it => it.entry.id === lane2.id)['open-btn'])

  // Opening Beta from the top-rail search dialog mounts Beta and closes the modal
  await modal.items.find(it => it.entry.id === lane2.id)['open-btn'].listeners.click()
  assert.equal(modal['is-open'], false)
  assert.equal(f.state.lanes.length, 2)
 }
 finally {
  globalThis.fetch = origFetch
 }
})

test('Top-rail wrench preferences dropdown: create seeded lane, pick existing lane without seeding, live & startup interface.backgroundColor', async () => {
 const indexHtml = await fs.readFile(new URL('./index.html', import.meta.url), 'utf8')
 assert.match(indexHtml, /\.top-rail-menu\s*\{[^}]*position:\s*fixed;[^}]*top:\s*18px;/s)

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
   className: '',
   title: '',
   hidden: false,
   disabled: false,
   removed: false,
   focused: false,
   rect: { left: 200, width: 12, top: 2, height: 12 },
   getBoundingClientRect() { return this.rect },
   contains(target) {
    if (target === this) { return true }
    return this.children.some(child => typeof child.contains === 'function' && child.contains(target))
   },
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
  if (url === '/src/lane-servers-modal.fs') { return { text: async () => laneServersModalSource } }
  if (url === '/src/lane-terminal-modal.fs') { return { text: async () => laneTerminalModalSource } }
  if (url === '/src/lane-session-modal.fs') { return { text: async () => sessionModalSource } }
  if (url === '/src/lane-package-modal.fs') { return { text: async () => packageModalSource } }
  if (url === '/src/lane-dir-modal.fs') { return { text: async () => dirModalSource } }
  throw new Error(`Unexpected fetch: ${url}`)
 }

 function createRuntime(initialPathname = '/') {
  const docListeners = {}
  const winListeners = {}
  const mockHtml = createMockElement('html')
  const mockBody = createMockElement('body')
  const mockDocument = {
   body: mockBody,
   documentElement: mockHtml,
   fullscreenElement: null,
   createElement: createMockElement,
   addEventListener(event, handler) {
    docListeners[event] ||= []
    docListeners[event].push(handler)
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
   innerHeight: 600,
   decodeURIComponent,
   crypto: { randomUUID: () => `pref-uuid-${++uuid}` },
   history: { pushState(_s, _t, url) { mockWindow.location.pathname = url } },
   location: { pathname: initialPathname, search: '', hash: '' },
   addEventListener(event, handler) {
    winListeners[event] ||= []
    winListeners[event].push(handler)
   },
   removeEventListener() {},
  }
  mockDocument.defaultView = mockWindow
  const dispatchDocEvent = async (event, ev) => {
   for (const handler of docListeners[event] || []) { await handler(ev) }
  }
  const dispatchWinEvent = async (event, ev) => {
   for (const handler of winListeners[event] || []) { await handler(ev) }
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
  return { f, mockBody, mockWindow, dispatchDocEvent, dispatchWinEvent }
 }

 try {
  const { f, mockBody, mockWindow, dispatchDocEvent, dispatchWinEvent } = createRuntime('/')
  await f.run(parse(mainSource, '/src/main.fs'))
  const laneControl = f.state['lane-control']
  const rails = laneControl.rails
  const modal = laneControl['lane-modal']

  assert.equal(mockBody.style.backgroundColor, '#202020')
  assert.equal(laneControl['preferences-lane-id'], null)

  // Preferences menu starts closed and mounted on body (not clipped inside top-rail)
  const prefBtn = rails['preferences-btn']
  const prefMenu = rails['preferences-menu']
  assert.ok(mockBody.children.includes(prefMenu))
  assert.equal(prefMenu.hidden, true)
  assert.equal(rails['is-preferences-open'], false)
  assert.equal(rails['preferences-status-el'].textContent, 'No preferences lane set')
  assert.equal(rails['preferences-open-btn'].hidden, true)
  assert.equal(rails['preferences-set-btn'].textContent, 'Set preferences lane')
  assert.equal(rails['preferences-create-btn'].textContent, 'Create preference lane')

  // Clicking wrench opens dropdown centered on wrench; clicking outside or pressing Escape closes it
  await prefBtn.listeners.click({ stopPropagation() {} })
  assert.equal(prefMenu.hidden, false)
  assert.equal(rails['is-preferences-open'], true)
  assert.equal(prefMenu.style.left, '206px')
  assert.equal(prefBtn.attributes['aria-expanded'], 'true')
  await dispatchDocEvent('click', { target: mockBody })
  assert.equal(prefMenu.hidden, true)
  assert.equal(rails['is-preferences-open'], false)

  await prefBtn.listeners.click({ stopPropagation() {} })
  assert.equal(prefMenu.hidden, false)
  await dispatchWinEvent('keydown', { key: 'Escape' })
  assert.equal(prefMenu.hidden, true)

  // Create preference lane -> creates lane, assigns global preferences-lane KV, seeds interface.backgroundColor #202020
  await prefBtn.listeners.click({ stopPropagation() {} })
  await rails['preferences-create-btn'].listeners.click()
  assert.equal(prefMenu.hidden, true)
  assert.equal(f.state.lanes.length, 1)
  const prefLane = f.state.lanes[0]
  assert.equal(prefLane.title, 'Preferences')
  assert.equal(laneControl['preferences-lane-id'], prefLane.id)
  assert.equal(kv.get('preferences-lane'), prefLane.id)
  assert.equal(kv.get(`${prefLane.id}.preferences-lane`), undefined)
  assert.deepEqual(prefLane.notebook.lines, [
   '; to interface ; object',
   '; to interface.backgroundColor #202020',
   '; to interface.scrollbarColor #383838',
  ])
  assert.equal(mockBody.style.backgroundColor, '#202020')
  assert.equal(mockWindow.location.pathname, `/${prefLane.id}`)

  // Editing interface.backgroundColor live updates document.body.style.backgroundColor immediately
  prefLane.notebook.rows[1]['input-el'].value = '; to interface.backgroundColor #1a2b3c'
  await prefLane.notebook.rows[1]['input-el'].listeners.input()
  assert.equal(mockBody.style.backgroundColor, '#1a2b3c')

  // Close preferences lane and simulate full app reload at '/' -> preferences still load & apply on startup
  await laneControl.close(prefLane.id)
  assert.equal(f.state.lanes.length, 0)

  const reloaded = createRuntime('/')
  await reloaded.f.run(parse(mainSource, '/src/main.fs'))
  const rLaneControl = reloaded.f.state['lane-control']
  const rRails = rLaneControl.rails
  const rModal = rLaneControl['lane-modal']
  assert.equal(reloaded.f.state.lanes.length, 0)
  assert.equal(rLaneControl['preferences-lane-id'], prefLane.id)
  assert.equal(reloaded.mockBody.style.backgroundColor, '#1a2b3c')

  // Opening wrench dropdown when preferences lane is set shows its title and "Open preferences lane"
  await rRails['preferences-btn'].listeners.click({ stopPropagation() {} })
  assert.equal(rRails['preferences-status-el'].textContent, 'Preferences: Preferences')
  assert.equal(rRails['preferences-open-btn'].hidden, false)
  assert.equal(rRails['preferences-open-btn'].textContent, 'Open preferences lane')

  // Clicking "Open preferences lane" opens it cleanly
  await rRails['preferences-open-btn'].listeners.click()
  assert.equal(rRails['preferences-menu'].hidden, true)
  assert.equal(reloaded.f.state.lanes.length, 1)
  assert.equal(reloaded.f.state.lanes[0].id, prefLane.id)

  // Create a custom theme lane with its own script, then test "Set preferences lane" picker (MUST NOT seed/overwrite script!)
  await reloaded.f.state.tableHeadRowAddButton.listeners.click()
  const customLane = reloaded.f.state.lanes[1]
  await rLaneControl.rename(customLane.id, 'Ocean Theme')
  customLane.notebook.rows[0]['input-el'].value = '; to interface ; object'
  await customLane.notebook.rows[0]['input-el'].listeners.input()
  await customLane.notebook.rows[0]['input-el'].listeners.keydown({ key: 'Enter', preventDefault() {} })
  customLane.notebook.rows[1]['input-el'].value = '; to interface.backgroundColor #0d1b2a'
  await customLane.notebook.rows[1]['input-el'].listeners.input()

  // Also create an empty lane to ensure switching to it does NOT seed it and resets background to #202020
  await reloaded.f.state.tableHeadRowAddButton.listeners.click()
  const emptyLane = reloaded.f.state.lanes[2]
  await rLaneControl.rename(emptyLane.id, 'Blank Slate')

  // Use "Set preferences lane" -> picks Empty Lane -> does NOT seed Empty Lane, resets body bg to #202020
  await rRails['preferences-btn'].listeners.click({ stopPropagation() {} })
  await rRails['preferences-set-btn'].listeners.click()
  assert.equal(rModal['is-open'], true)
  assert.equal(rModal.mode, 'pick')
  assert.equal(rModal['heading-el'].textContent, 'Set Preferences Lane')
  await rModal.items.find(it => it.entry.id === emptyLane.id)['select-btn'].listeners.click()
  assert.equal(rLaneControl['preferences-lane-id'], emptyLane.id)
  assert.equal(kv.get('preferences-lane'), emptyLane.id)
  assert.deepEqual(emptyLane.notebook.lines, [''])
  assert.equal(reloaded.mockBody.style.backgroundColor, '#202020')

  // Use "Set preferences lane" -> picks Ocean Theme -> applies #0d1b2a without overwriting Ocean Theme's lines
  await rRails['preferences-btn'].listeners.click({ stopPropagation() {} })
  await rRails['preferences-set-btn'].listeners.click()
  await rModal.items.find(it => it.entry.id === customLane.id)['select-btn'].listeners.click()
  assert.equal(rLaneControl['preferences-lane-id'], customLane.id)
  assert.equal(reloaded.mockBody.style.backgroundColor, '#0d1b2a')
  assert.deepEqual(customLane.notebook.lines, [
   '; to interface ; object',
   '; to interface.backgroundColor #0d1b2a',
  ])

  // Clear preferences lane via picker Clear button -> clears global key, resets background to #202020
  await rRails['preferences-btn'].listeners.click({ stopPropagation() {} })
  await rRails['preferences-set-btn'].listeners.click()
  assert.equal(rModal['clear-btn'].hidden, false)
  await rModal['clear-btn'].listeners.click()
  assert.equal(rLaneControl['preferences-lane-id'], null)
  assert.equal(kv.get('preferences-lane'), '')
  assert.equal(reloaded.mockBody.style.backgroundColor, '#202020')
  assert.equal(rRails['preferences-status-el'].textContent, 'No preferences lane set')
  assert.equal(rRails['preferences-open-btn'].hidden, true)
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
  dv1['table-name-input'].value = 'customers'
  await dv1['table-name-input'].listeners.input()
  assert.equal(lane1.path, 'data/customers')
  assert.equal(kv.get(`${lane1.id}.path`), 'data/customers')

  // Delete customers -> falls back to remaining table orders and updates remembered path
  await dv1['delete-table-btn'].listeners.click()
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
  let nextRafId = 1
  const mockBody = createMockElement('body')
  const documentElement = { clientWidth: 1000, scrollLeft: 0, scrollTop: 0 }
  const mockWindow = {
   Array,
   Boolean,
   Date,
   JSON,
   Math,
   Object,
   Reflect,
   innerWidth: 1000,
   scrollX: 0,
   scrollY: 0,
   decodeURIComponent,
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
  return { f, mockWindow, documentElement, scrollToCalls, cancelledRafs, flushRaf }
 }

 try {
  const { f, mockWindow, scrollToCalls, cancelledRafs, flushRaf } = createRuntime('/')
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

  // 5. Restoring a minimized lane from the side rail scrolls it smoothly into view with right margin
  await laneControl.minimize(lane3.id, 'right')
  setWorldBounds(lane3.id, 1520, 380)
  await rails['right-items'][0]['icon-el'].listeners.click()
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

  // 8. Startup sync with #scroll.left=333 preserves hash scroll without scroll-lane-into-view overriding it
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

test('data.mjs httpKV hashNamespace and real diskKV directory layout enforce <= 1024b per file without collisions', async () => {
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

  // Seed exempt .inputs key (> 1024 bytes explicitly allowed only for .inputs)
  const bigInputs = Array.from({ length: 40 }, (_, i) => ({ name: `inp_${i}`, type: 'string', value: 'v'.repeat(30) }))
  await laneData.set('inputs', JSON.stringify(bigInputs))

  // Add 2 tables with wide columns and large (> 1024b) multi-byte row payload
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

  const bigEmojiRow = { id: 'r_big', values: { c0: '🚀'.repeat(450), c1: 'a'.repeat(500) } }
  t1.rows.push(bigEmojiRow)
  await addTableRow(disk, laneData, laneId, 't1', bigEmojiRow, ['r_big'])

  // Save script lines including > 1500 byte line
  await saveLaneScript(disk, laneData, laneId, [
   '; to a 1',
   `-- ${'x'.repeat(1600)}`,
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
  assert.equal(loadedTables[0].rows[0].values.c0, '🚀'.repeat(450))
  const loadedScript = await loadLaneScript(disk, laneData, laneId, memWindow)
  assert.equal(loadedScript.records.length, 3)
  assert.equal(loadedScript.records[1].text, `-- ${'x'.repeat(1600)}`)
 }
 finally {
  await fs.rm(tempDir, { recursive: true, force: true })
 }
})

test('storage.mjs chunking, multi-byte UTF-8 splitting, and paged ID indexes stay <= 1024 bytes', async () => {
 const emojiText = '🧪'.repeat(600) + 'hello' + 'あ'.repeat(400)
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

 // Shrink <= 1024 bytes deletes old chunk keys
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
 const ids = Array.from({ length: 100 }, (_, i) => `long-item-identifier-segment-${String(i).padStart(4, '0')}`)
 await writePagedIds(kv, 'items', ids)
 const pageKeysBefore = Array.from(store.keys()).filter(k => k.startsWith('items-pages/'))
 assert.ok(pageKeysBefore.length >= 3)
 for (const [k, val] of store.entries()) {
  if (k.startsWith('items')) {
   assert.ok(utf8ByteLength(val) <= MAX_KV_VALUE_BYTES, `${k} exceeded 1024 bytes`)
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
  await confirmModal['confirm-btn'].listeners.click()
  assert.equal(kv.has(tableRowKey('leg-lane-1', 't-orders', 'o1')), false)

  await dv['delete-table-btn'].listeners.click()
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
  assert.deepEqual(writtenKeys, [scriptLineKey('leg-script-1', rec1.id)])
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

test('Scrollbar color helpers: resolveScrollbarColor, seedPreferencesScrollbarSource, and seedPreferencesScrollbarRecords', () => {
 assert.equal(DEFAULT_SCROLLBAR_COLOR, '#383838')
 assert.deepEqual(resolveScrollbarColor(null), {
  color: '#383838',
  css: '#383838 transparent',
  thumb: '#383838',
  track: 'transparent',
 })
 assert.deepEqual(resolveScrollbarColor(''), {
  color: '#383838',
  css: '#383838 transparent',
  thumb: '#383838',
  track: 'transparent',
 })
 assert.deepEqual(resolveScrollbarColor('#9ce5ff'), {
  color: '#9ce5ff',
  css: '#9ce5ff transparent',
  thumb: '#9ce5ff',
  track: 'transparent',
 })
 assert.deepEqual(resolveScrollbarColor('rgb(56, 56, 56)'), {
  color: 'rgb(56, 56, 56)',
  css: 'rgb(56, 56, 56) transparent',
  thumb: 'rgb(56, 56, 56)',
  track: 'transparent',
 })
 assert.deepEqual(resolveScrollbarColor('#555555 #181818'), {
  color: '#555555 #181818',
  css: '#555555 #181818',
  thumb: '#555555',
  track: '#181818',
 })
 assert.deepEqual(resolveScrollbarColor('auto'), {
  color: 'auto',
  css: 'auto',
  thumb: '',
  track: '',
 })

 // Seeds scrollbarColor right after existing interface lines while preserving line IDs & updatedAt
 let seq = 0
 const seededExisting = seedPreferencesScrollbarRecords(
  [
   { id: 'ln-1', text: '; to interface ; object', updatedAt: '2026-11-24T10:00:00.000Z' },
   { id: 'ln-2', text: '; to interface.backgroundColor #1a2b3c', updatedAt: '2026-11-24T10:05:00.000Z' },
   { id: 'ln-3', text: '; to extra 42', updatedAt: '2026-11-24T10:10:00.000Z' },
  ],
  '#383838',
  () => `ln-new-${++seq}`
 )
 assert.equal(seededExisting.seeded, true)
 assert.deepEqual(seededExisting.lines, [
  '; to interface ; object',
  '; to interface.backgroundColor #1a2b3c',
  '; to interface.scrollbarColor #383838',
  '; to extra 42',
 ])
 assert.equal(seededExisting.records[0].id, 'ln-1')
 assert.equal(seededExisting.records[0].updatedAt, '2026-11-24T10:00:00.000Z')
 assert.equal(seededExisting.records[1].id, 'ln-2')
 assert.equal(seededExisting.records[1].updatedAt, '2026-11-24T10:05:00.000Z')
 assert.equal(seededExisting.records[2].id, 'ln-new-1')
 assert.equal(seededExisting.records[2].updatedAt, null)
 assert.equal(seededExisting.records[3].id, 'ln-3')

 // Re-running is idempotent
 const secondPass = seedPreferencesScrollbarRecords(seededExisting.records)
 assert.equal(secondPass.seeded, false)
 assert.deepEqual(secondPass.lines, seededExisting.lines)

 // Recognizes set, object literal, assign, and commented scrollbarColor without duplicating
 for (const lines of [
  ['; to interface ; object', '; set #9ce5ff interface.scrollbarColor'],
  ['; to interface [ object { backgroundColor #202020 } { scrollbarColor #444444 } ]'],
  ['; to interface ; object', '; assign interface { scrollbarColor #444444 }'],
  ['; to interface ; object', '-- ; to interface.scrollbarColor #383838'],
 ]) {
  const res = seedPreferencesScrollbarSource(lines)
  assert.equal(res.seeded, false)
  assert.deepEqual(res.lines, lines)
 }

 // Seeds interface object + scrollbarColor into blank lane without leaving an empty leading row
 const seededBlank = seedPreferencesScrollbarSource([''])
 assert.equal(seededBlank.seeded, true)
 assert.deepEqual(seededBlank.lines, [
  '; to interface ; object',
  '; to interface.scrollbarColor #383838',
 ])
})

test('Default #383838 scrollbar styling, live interface.scrollbarColor preference, and seeding on create or opening already-selected preferences lane', async () => {
 const indexHtml = await fs.readFile(new URL('./index.html', import.meta.url), 'utf8')
 assert.match(indexHtml, /:root\s*\{[^}]*--scrollbar-color:\s*#383838 transparent;[^}]*scrollbar-color:\s*var\(--scrollbar-color\);/s)
 assert.match(indexHtml, /@supports not \(scrollbar-color:\s*#383838 transparent\)/)
 assert.match(indexHtml, /\.side-rail\s*\{[^}]*background-color:\s*#383838;/s)

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
   className: '',
   title: '',
   hidden: false,
   disabled: false,
   removed: false,
   focused: false,
   rect: { left: 200, width: 12, top: 2, height: 12 },
   getBoundingClientRect() { return this.rect },
   contains(target) {
    if (target === this) { return true }
    return this.children.some(child => typeof child.contains === 'function' && child.contains(target))
   },
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
   async delete(key) { kv.delete(qualify(key)) },
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
  if (url === '/src/lane-servers-modal.fs') { return { text: async () => laneServersModalSource } }
  if (url === '/src/lane-terminal-modal.fs') { return { text: async () => laneTerminalModalSource } }
  if (url === '/src/lane-session-modal.fs') { return { text: async () => sessionModalSource } }
  if (url === '/src/lane-package-modal.fs') { return { text: async () => packageModalSource } }
  if (url === '/src/lane-dir-modal.fs') { return { text: async () => dirModalSource } }
  throw new Error(`Unexpected fetch: ${url}`)
 }

 function createRuntime(initialPathname = '/') {
  const mockHtml = createMockElement('html')
  const mockBody = createMockElement('body')
  const mockDocument = {
   body: mockBody,
   documentElement: mockHtml,
   fullscreenElement: null,
   createElement: createMockElement,
   addEventListener() {},
  }
  const mockWindow = {
   Array,
   Boolean,
   Date,
   JSON,
   Math,
   Object,
   Reflect,
   innerHeight: 600,
   decodeURIComponent,
   crypto: { randomUUID: () => `sb-uuid-${++uuid}` },
   history: { pushState(_s, _t, url) { mockWindow.location.pathname = url } },
   location: { pathname: initialPathname, search: '', hash: '' },
   addEventListener() {},
   removeEventListener() {},
  }
  mockDocument.defaultView = mockWindow
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
  return { f, mockHtml, mockBody, mockWindow }
 }

 try {
  // 1. Pre-existing legacy preferences lane without interface.scrollbarColor in KV
  const rootKv = createMockKV()
  const legacyPrefId = 'legacy-pref-lane'
  await rootKv.set('preferences-lane', legacyPrefId)
  await rootKv.namespace(legacyPrefId).set('title', 'My Prefs')
  await saveLaneScript(
   rootKv,
   rootKv.namespace(legacyPrefId),
   legacyPrefId,
   [
    '; to interface ; object',
    '; to interface.backgroundColor #1b222c',
   ],
   null,
   '2026-11-24T09:00:00.000Z'
  )

  // Startup at '/' applies default #383838 scrollbar color without mutating unmounted lane yet
  const boot = createRuntime('/')
  await boot.f.run(parse(mainSource, '/src/main.fs'))
  const laneControl = boot.f.state['lane-control']
  const rails = laneControl.rails
  assert.equal(boot.mockBody.style.backgroundColor, '#1b222c')
  assert.equal(boot.mockHtml.style.scrollbarColor, '#383838 transparent')
  assert.equal(boot.mockHtml.style.getPropertyValue('--scrollbar-color'), '#383838 transparent')
  assert.equal(boot.mockHtml.style.getPropertyValue('--scrollbar-thumb-color'), '#383838')
  assert.equal(laneControl.preferences.interface.scrollbarColor, '#383838')

  // Opening already-selected preferences lane seeds interface.scrollbarColor #383838 when missing
  await rails['preferences-open-btn'].listeners.click()
  assert.equal(boot.f.state.lanes.length, 1)
  const openedPref = boot.f.state.lanes[0]
  assert.equal(openedPref.id, legacyPrefId)
  assert.deepEqual(openedPref.notebook.lines, [
   '; to interface ; object',
   '; to interface.backgroundColor #1b222c',
   '; to interface.scrollbarColor #383838',
  ])
  assert.equal(openedPref.notebook['line-records'][0].updatedAt, '2026-11-24T09:00:00.000Z')
  assert.equal(openedPref.notebook['line-records'][1].updatedAt, '2026-11-24T09:00:00.000Z')

  // Editing interface.scrollbarColor live updates document.documentElement.style.scrollbarColor (both single color and two-color pair)
  openedPref.notebook.rows[2]['input-el'].value = '; to interface.scrollbarColor #9ce5ff'
  await openedPref.notebook.rows[2]['input-el'].listeners.input()
  assert.equal(boot.mockHtml.style.scrollbarColor, '#9ce5ff transparent')
  assert.equal(boot.mockHtml.style.getPropertyValue('--scrollbar-thumb-color'), '#9ce5ff')
  assert.equal(laneControl.preferences.interface.scrollbarColor, '#9ce5ff')

  openedPref.notebook.rows[2]['input-el'].value = "; to interface.scrollbarColor '#66ccff #101820'"
  await openedPref.notebook.rows[2]['input-el'].listeners.input()
  assert.equal(boot.mockHtml.style.scrollbarColor, '#66ccff #101820')
  assert.equal(boot.mockHtml.style.getPropertyValue('--scrollbar-thumb-color'), '#66ccff')
  assert.equal(boot.mockHtml.style.getPropertyValue('--scrollbar-track-color'), '#101820')

  // Re-opening already-selected preferences lane does NOT duplicate or overwrite custom scrollbarColor
  await laneControl.close(legacyPrefId)
  await laneControl['open-preferences-lane']()
  assert.deepEqual(boot.f.state.lanes[0].notebook.lines, [
   '; to interface ; object',
   '; to interface.backgroundColor #1b222c',
   "; to interface.scrollbarColor '#66ccff #101820'",
  ])

  // Selecting an already-open lane via Set Preferences Lane does NOT seed until opened as selected preferences lane
  const customLane = await laneControl.add()
  customLane.notebook.rows[0]['input-el'].value = '; to interface ; object'
  await customLane.notebook.rows[0]['input-el'].listeners.input()
  await laneControl['set-preferences-lane'](customLane.id)
  assert.deepEqual(customLane.notebook.lines, ['; to interface ; object'])
  assert.equal(boot.mockHtml.style.scrollbarColor, '#383838 transparent')

  // Clicking Open preferences lane on that already-mounted selected preferences lane seeds interface.scrollbarColor
  await laneControl['open-preferences-lane']()
  assert.deepEqual(customLane.notebook.lines, [
   '; to interface ; object',
   '; to interface.scrollbarColor #383838',
  ])
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
  async function invokeFsApi(method, urlPath, jsonBody = null) {
   const req = new EventEmitter()
   req.method = method
   req.url = urlPath
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
  const apiNoImp = createLaneHttpServer({
   slug: 'api-no-imp',
   laneId: apiId,
   civilMemoryUrl: cmUrl,
   dataBasePath: basePath,
   includeImports: false,
   basePath: '/api',
  })
  await apiNoImp.reload()
  const addr1 = await apiNoImp.listen(0, '127.0.0.1')

  try {
   const healthRes = await fetch(`http://127.0.0.1:${addr1.port}/_cc/health`).then(r => r.json())
   assert.equal(healthRes.ok, true)
   assert.equal(healthRes.mode, 'handler')
   assert.deepEqual(healthRes.handlers, ['GET', 'POST'])

   const g1 = await fetch(`http://127.0.0.1:${addr1.port}/api/users/7?role=admin`)
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
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'bolt' }),
   })
   assert.equal(p1.status, 201)
   assert.equal(p1.headers.get('x-lane'), 'api')
   assert.deepEqual(await p1.json(), { echoed: { name: 'bolt' } })

   const d1 = await fetch(`http://127.0.0.1:${addr1.port}/api/items`, { method: 'DELETE' })
   assert.equal(d1.status, 405)

   // Verify KV state persisted on disk bucket for that exact basePath
   assert.equal(getBucket(basePath).get(`${apiId}.hits`), '1')
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

 const subNginx = generateNginxSubpathConfig({ slug: 'calc-api', port: 4100, subpath: '/calc' })
 assert.match(subNginx, /location = \/calc \{/)
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
  history: { pushState(_s, _t, url) { mockWindow.location.pathname = url } },
  location: { pathname: '/', host: 'localhost:8080', protocol: 'http:' },
  addEventListener() {},
  removeEventListener() {},
 }
 const mockDocument = { body: createMockElement('body'), defaultView: mockWindow, createElement: createMockElement }

 const syncedPayloads = []
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
  assert.deepEqual(JSON.parse(await apiLane.data.get('features')), { httpServer: true })

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
  lastWs.emitOpen()
  lastWs.emitMessage({ type: 'init', status: 'running', title: 'Deploy calc-api' })
  lastWs.emitMessage({ type: 'output', data: '__CC_DEPLOY_OK__ {"ok":true,"slug":"calc-api","port":4100,"publicUrl":"https://api.example.com/calc-api","deployedAt":"2026-11-25T12:05:00Z"}\r\n' })
  lastWs.emitMessage({ type: 'status', status: 'exited', exitCode: 0 })
  await new Promise(r => setTimeout(r, 20))
  assert.equal(sv['deploy-err'].textContent, '')
  assert.match(sv['deploy-status'].textContent, /https:\/\/api\.example\.com\/calc-api/)
  await laneControl['terminal-modal'].close(true)

  // 6. Disabling HTTP Server while Server tab is active falls back cleanly to Source and hides Server tab
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
 const changedRes = await setTargetLaneLine(kv, 'lane-a', 'ln-1', "!console log 'hello world'", null)
 assert.equal(changedRes.ok, true)
 assert.equal(changedRes.changed, true)
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
 }
 finally {
  globalThis.fetch = origFetch
 }
})
