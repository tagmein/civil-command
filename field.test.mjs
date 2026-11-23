import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import {
 DATA_COLUMN_TYPES,
 DEFAULT_FIXED_DECIMALS,
 DEFAULT_LANE_TAB,
 LANE_TABS,
 PRIMITIVE_TYPES,
 TRANSPORT_PACKET_TYPE,
 buildTablesScope,
 checkColumnChangeImpact,
 coerceDataValue,
 createIdleTracker,
 createTransport,
 defaultDataValue,
 defaultValueForType,
 deserializeTransportPacket,
 field,
 formatCellInputValue,
 formatColumnType,
 formatImportLine,
 formatLaneRouteSegment,
 formatLaneRoutes,
 formatValue,
 hasImportCycle,
 isDomElement,
 isTransportPacket,
 listScopeEntries,
 normalizeColumnWidth,
 normalizeDataColumnType,
 normalizeFixedDecimals,
 normalizeLaneTab,
 normalizePrimitiveType,
 parse,
 parseCellValue,
 parseColumnType,
 parseImportLine,
 parseLaneRouteSegment,
 parseLaneRoutes,
 parseStoredTables,
 resolveImportValue,
 resolveScopeColumns,
 resolveScopePath,
 runLines,
 runTransportedScripts,
 serializeTransportPacket,
} from './field.mjs'

const DATA_RUNTIME_ENV = {
 buildTablesScope,
 checkColumnChangeImpact,
 coerceDataValue,
 dataColumnTypes: DATA_COLUMN_TYPES,
 defaultDataValue,
 formatCellInputValue,
 formatColumnType,
 formatLaneRoutes,
 normalizeColumnWidth,
 normalizeDataColumnType,
 normalizeFixedDecimals,
 normalizeLaneTab,
 parseCellValue,
 parseColumnType,
 parseLaneRoutes,
 parseStoredTables,
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
 const outputSource = await fs.readFile(new URL('./src/lane-output.fs', import.meta.url), 'utf8')
 const configModalSource = await fs.readFile(new URL('./src/lane-config-modal.fs', import.meta.url), 'utf8')
 const importModalSource = await fs.readFile(new URL('./src/lane-import-modal.fs', import.meta.url), 'utf8')

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
  if (url === '/src/lane-output.fs') {
   return { text: async () => outputSource }
  }
  if (url === '/src/lane-config-modal.fs') {
   return { text: async () => configModalSource }
  }
  if (url === '/src/lane-import-modal.fs') {
   return { text: async () => importModalSource }
  }
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
  assert.equal(headerTop.children[2], mountedLane['reload-btn'])
  assert.equal(mountedLane['reload-btn'].className, 'lane-reload-btn')
  assert.equal(headerTop.children[3], mountedLane['close-btn'])
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
 const outputSource = await fs.readFile(new URL('./src/lane-output.fs', import.meta.url), 'utf8')
 const modalSource = await fs.readFile(new URL('./src/lane-modal.fs', import.meta.url), 'utf8')
 const configModalSource = await fs.readFile(new URL('./src/lane-config-modal.fs', import.meta.url), 'utf8')
 const importModalSource = await fs.readFile(new URL('./src/lane-import-modal.fs', import.meta.url), 'utf8')

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
  assert.equal(
   kv.get('m-uuid-1.script'),
   JSON.stringify(['; to input 5', '; to output ; add 3 $input', '$output'])
  )

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
  if (url === '/src/lane-output.fs') {
   return { text: async () => outputSource }
  }
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
 assert.equal(kv.get('script'), JSON.stringify(nb.lines))

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

 // FieldScript functions expose .ast as an expandable property
 const fnAst = resolveScopeColumns(state, ['greet', 'ast', '0'])
 assert.equal(fnAst.columns[1].valueType, 'function')
 assert.equal(fnAst.columns[2].valueType, 'array')
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
  if (url === '/src/lane-output.fs') {
   return { text: async () => outputSource }
  }
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
 const outputSource = await fs.readFile(new URL('./src/lane-output.fs', import.meta.url), 'utf8')
 const modalSource = await fs.readFile(new URL('./src/lane-modal.fs', import.meta.url), 'utf8')
 const configModalSource = await fs.readFile(new URL('./src/lane-config-modal.fs', import.meta.url), 'utf8')
 const importModalSource = await fs.readFile(new URL('./src/lane-import-modal.fs', import.meta.url), 'utf8')

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
  if (url === '/src/lane-output.fs') { return { text: async () => outputSource } }
  if (url === '/src/lane-modal.fs') { return { text: async () => modalSource } }
  if (url === '/src/lane-config-modal.fs') { return { text: async () => configModalSource } }
  if (url === '/src/lane-import-modal.fs') { return { text: async () => importModalSource } }
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
 const outputSource = await fs.readFile(new URL('./src/lane-output.fs', import.meta.url), 'utf8')
 const modalSource = await fs.readFile(new URL('./src/lane-modal.fs', import.meta.url), 'utf8')
 const configModalSource = await fs.readFile(new URL('./src/lane-config-modal.fs', import.meta.url), 'utf8')
 const importModalSource = await fs.readFile(new URL('./src/lane-import-modal.fs', import.meta.url), 'utf8')

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
  if (url === '/src/lane-output.fs') { return { text: async () => outputSource } }
  if (url === '/src/lane-modal.fs') { return { text: async () => modalSource } }
  if (url === '/src/lane-config-modal.fs') { return { text: async () => configModalSource } }
  if (url === '/src/lane-import-modal.fs') { return { text: async () => importModalSource } }
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
 const outputSource = await fs.readFile(new URL('./src/lane-output.fs', import.meta.url), 'utf8')
 const modalSource = await fs.readFile(new URL('./src/lane-modal.fs', import.meta.url), 'utf8')
 const configModalSource = await fs.readFile(new URL('./src/lane-config-modal.fs', import.meta.url), 'utf8')
 const importModalSource = await fs.readFile(new URL('./src/lane-import-modal.fs', import.meta.url), 'utf8')

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
  if (url === '/src/lane-output.fs') { return { text: async () => outputSource } }
  if (url === '/src/lane-modal.fs') { return { text: async () => modalSource } }
  if (url === '/src/lane-config-modal.fs') { return { text: async () => configModalSource } }
  if (url === '/src/lane-import-modal.fs') { return { text: async () => importModalSource } }
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
 const outputSource = await fs.readFile(new URL('./src/lane-output.fs', import.meta.url), 'utf8')
 const modalSource = await fs.readFile(new URL('./src/lane-modal.fs', import.meta.url), 'utf8')
 const configModalSource = await fs.readFile(new URL('./src/lane-config-modal.fs', import.meta.url), 'utf8')
 const importModalSource = await fs.readFile(new URL('./src/lane-import-modal.fs', import.meta.url), 'utf8')

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
  if (url === '/src/lane-output.fs') { return { text: async () => outputSource } }
  if (url === '/src/lane-modal.fs') { return { text: async () => modalSource } }
  if (url === '/src/lane-config-modal.fs') { return { text: async () => configModalSource } }
  if (url === '/src/lane-import-modal.fs') { return { text: async () => importModalSource } }
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
 const outputSource = await fs.readFile(new URL('./src/lane-output.fs', import.meta.url), 'utf8')
 const modalSource = await fs.readFile(new URL('./src/lane-modal.fs', import.meta.url), 'utf8')
 const configModalSource = await fs.readFile(new URL('./src/lane-config-modal.fs', import.meta.url), 'utf8')
 const importModalSource = await fs.readFile(new URL('./src/lane-import-modal.fs', import.meta.url), 'utf8')

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
  if (url === '/src/lane-output.fs') { return { text: async () => outputSource } }
  if (url === '/src/lane-modal.fs') { return { text: async () => modalSource } }
  if (url === '/src/lane-config-modal.fs') { return { text: async () => configModalSource } }
  if (url === '/src/lane-import-modal.fs') { return { text: async () => importModalSource } }
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
 assert.deepEqual(LANE_TABS, ['source', 'input', 'scope', 'data', 'view'])
 assert.equal(DEFAULT_LANE_TAB, 'source')
 assert.equal(normalizeLaneTab('data'), 'data')
 assert.equal(normalizeLaneTab('VIEW'), 'view')
 assert.equal(normalizeLaneTab('unknown'), 'source')
 assert.equal(normalizeLaneTab(undefined), 'source')

 const id = 'e9f68d51-60f9-4f2a-af09-31a2cdbf0b36'
 assert.equal(formatLaneRouteSegment(id, 'source'), id)
 assert.equal(formatLaneRouteSegment(id, 'data'), `${id};data`)
 assert.equal(formatLaneRouteSegment(id, 'view'), `${id};view`)
 assert.equal(formatLaneRouteSegment(id, 'input'), `${id};input`)
 assert.equal(formatLaneRouteSegment(id, 'scope'), `${id};scope`)
 assert.equal(formatLaneRouteSegment('lane;1', 'data'), 'lane%3B1;data')
 assert.equal(formatLaneRouteSegment('lane;1', 'source'), 'lane%3B1')

 assert.deepEqual(parseLaneRouteSegment(id), { id, tab: 'source' })
 assert.deepEqual(parseLaneRouteSegment(`${id};data`), { id, tab: 'data' })
 assert.deepEqual(parseLaneRouteSegment(`${id};view`), { id, tab: 'view' })
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
 const outputSource = await fs.readFile(new URL('./src/lane-output.fs', import.meta.url), 'utf8')
 const modalSource = await fs.readFile(new URL('./src/lane-modal.fs', import.meta.url), 'utf8')
 const configModalSource = await fs.readFile(new URL('./src/lane-config-modal.fs', import.meta.url), 'utf8')
 const importModalSource = await fs.readFile(new URL('./src/lane-import-modal.fs', import.meta.url), 'utf8')

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
  if (url === '/src/lane-output.fs') { return { text: async () => outputSource } }
  if (url === '/src/lane-modal.fs') { return { text: async () => modalSource } }
  if (url === '/src/lane-config-modal.fs') { return { text: async () => configModalSource } }
  if (url === '/src/lane-import-modal.fs') { return { text: async () => importModalSource } }
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
 const outputSource = await fs.readFile(new URL('./src/lane-output.fs', import.meta.url), 'utf8')
 const modalSource = await fs.readFile(new URL('./src/lane-modal.fs', import.meta.url), 'utf8')
 const configModalSource = await fs.readFile(new URL('./src/lane-config-modal.fs', import.meta.url), 'utf8')
 const importModalSource = await fs.readFile(new URL('./src/lane-import-modal.fs', import.meta.url), 'utf8')

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
  if (url === '/src/lane-output.fs') { return { text: async () => outputSource } }
  if (url === '/src/lane-modal.fs') { return { text: async () => modalSource } }
  if (url === '/src/lane-config-modal.fs') { return { text: async () => configModalSource } }
  if (url === '/src/lane-import-modal.fs') { return { text: async () => importModalSource } }
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
 const outputSource = await fs.readFile(new URL('./src/lane-output.fs', import.meta.url), 'utf8')
 const modalSource = await fs.readFile(new URL('./src/lane-modal.fs', import.meta.url), 'utf8')
 const configModalSource = await fs.readFile(new URL('./src/lane-config-modal.fs', import.meta.url), 'utf8')
 const importModalSource = await fs.readFile(new URL('./src/lane-import-modal.fs', import.meta.url), 'utf8')

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
  if (url === '/src/lane-output.fs') { return { text: async () => outputSource } }
  if (url === '/src/lane-modal.fs') { return { text: async () => modalSource } }
  if (url === '/src/lane-config-modal.fs') { return { text: async () => configModalSource } }
  if (url === '/src/lane-import-modal.fs') { return { text: async () => importModalSource } }
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

  // Verify reload button is immediately to the left of close button on the far right of header
  const headerTop = lane1.element.children[0]
  assert.equal(headerTop.children[2], lane1['reload-btn'])
  assert.equal(headerTop.children[3], lane1['close-btn'])

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
