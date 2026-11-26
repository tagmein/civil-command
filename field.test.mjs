import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import {
 PRIMITIVE_TYPES,
 TRANSPORT_PACKET_TYPE,
 VALID_FIELD_COMMANDS,
 createTransport,
 defaultValueForType,
 describeValue,
 deserializeTransportPacket,
 field,
 filterScopeEntries,
 formatValue,
 isDomElement,
 isParseableFieldScriptLine,
 isTransportPacket,
 listScopeEntries,
 normalizePrimitiveType,
 parse,
 resolveScopeColumns,
 runLines,
 runScript,
 runTransportedScripts,
 serializeTransportPacket,
 validateFieldScriptLine,
 validateFieldScriptLines,
} from './field.fixtures.mjs'

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

test('object accepts { key value } pair lists, shorthand keys, and rejects invalid arguments', async () => {
 const { f } = await runScript(`
  ; to empty ; object
  ; to id lane-9
  ; to a 10
  ; to b 20
  ; to c 30
  ; to user ; object { id $id } { count 3 }
  ; to short ; object a b c
  ; to mixed ; object id { count 3 } a
  ; to multi [ object
   { a 1 }
   { b 2 }
  ]
 `)
 assert.deepEqual(f.state.empty, {})
 assert.deepEqual(f.state.user, { id: 'lane-9', count: 3 })
 assert.deepEqual(f.state.short, { a: 10, b: 20, c: 30 })
 assert.deepEqual(f.state.mixed, { id: 'lane-9', count: 3, a: 10 })
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

test('resolveScopeColumns browses root scope, nested objects, arrays, non-enumerables, functions, and throwing getters', async () => {
 assert.deepEqual(PRIMITIVE_TYPES, ['string', 'number', 'boolean', 'null', 'undefined', 'secret'])
 assert.strictEqual(defaultValueForType('string'), '')
 assert.strictEqual(defaultValueForType('number'), 0)
 assert.strictEqual(defaultValueForType('boolean'), false)
 assert.strictEqual(defaultValueForType('null'), null)
 assert.strictEqual(defaultValueForType('undefined'), undefined)
 assert.strictEqual(defaultValueForType('secret'), '')
 assert.strictEqual(normalizePrimitiveType('object'), 'string')
 assert.strictEqual(normalizePrimitiveType('boolean'), 'boolean')
 assert.strictEqual(normalizePrimitiveType('secret'), 'secret')

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

test('FieldScript parser & syntax validator: rejects all unparseable and syntax-error lines while accepting valid constructs', () => {
 assert.ok(VALID_FIELD_COMMANDS.includes('to'))
 assert.ok(VALID_FIELD_COMMANDS.includes('send'))

 // Valid lines
 for (const validLine of [
  '',
  '   ',
  '-- comment only',
  'hello world',
  'set foo bar',
  '$total.balance',
  '; to count 42',
  "; to msg 'hello \\'world\\''",
  '!console.log $msg',
  '!$dynamicFn arg1 arg2',
  '; to fn (\n ; to { a ...rest } $argv\n ; add $a $rest.length\n)',
  '; send ( !document.createElement div )',
  '= ; to @1 @2\n alpha 1\n beta 2\n=',
  '= !@2+.appendChild $@1',
 ]) {
  const res = validateFieldScriptLine(validLine, { filename: 'lane-ok' })
  assert.equal(res.ok, true, `Expected valid line to pass: ${validLine} (got ${res.error})`)
  assert.equal(isParseableFieldScriptLine(validLine), true)
 }

 // Invalid / unparseable / syntax-error lines
 const invalidCases = [
  ["; to msg 'unterminated", /Unterminated string literal/],
  ["'trailing\\", /Unterminated string literal/],
  ['( ; to x 1', /Unclosed block '\('/],
  ['; to items { a b', /Unclosed block '\{'/],
  ['[ add 1 2', /Unclosed block '\['/],
  ['; add 1 2 ]', /no block is open/],
  ['( ; to x 1 }', /Block end mismatch/],
  ['{ a b )', /Block end mismatch/],
  ['!', /Empty invoke block/],
  [';', /Empty command block/],
  ['; to fn :', /Empty deferred block/],
  ['[]', /Empty command block/],
  ["; console.log 'wrong sigil'", /is not a valid FieldScript command/],
  ['; unknownCommand 1 2', /is not a valid FieldScript command/],
  ['; send ( ; badNestedCmd 1 )', /is not a valid FieldScript command/],
  ['[ 123 456 ]', /is not a valid FieldScript command/],
  ['; $fn 1', /is not a valid FieldScript command/],
  ['; to', /"to" requires at least 2 arguments/],
  ['; to onlyTarget', /"to" requires at least 2 arguments/],
  ['; set 1', /"set" requires at least 2 arguments/],
  ['; get', /"get" requires at least 1 argument/],
  ['; tap', /"tap" requires at least 1 argument/],
  ['; invoke {}', /"invoke" requires at least 2 arguments/],
  ['; add 1', /"add" requires at least 2 arguments/],
  ['; condition { propertyIs 1 x }', /"condition" requires at least 2 arguments/],
  ['; each $items', /"each" requires at least 2 arguments/],
  ['; while true', /"while" requires at least 2 arguments/],
  ['; to { ...rest extra } $argv', /Rest element must be last/],
  ['; to { ... } $argv', /Rest element requires a binding name/],
  ['; to { [ add 1 2 ] } $argv', /Destructuring pattern cannot contain command expressions/],
  ['= ; notACommand @1', /is not a valid FieldScript command/],
 ]
 for (const [badLine, pattern] of invalidCases) {
  assert.throws(() => parse(`${badLine}\n`, 'lane-bad'), err => {
   assert.ok(err instanceof SyntaxError, `Expected SyntaxError for: ${badLine}`)
   assert.match(err.message, pattern)
   return true
  })
  const res = validateFieldScriptLine(badLine, { filename: 'lane-bad', lineIndex: 2 })
  assert.equal(res.ok, false, `Expected invalid line to fail: ${badLine}`)
  assert.match(res.error, pattern)
  assert.equal(isParseableFieldScriptLine(badLine), false)
 }

 const batch = validateFieldScriptLines(['; to a 1', '; to b (', '; add $a 2'], { filename: 'lane-batch' })
 assert.equal(batch.ok, false)
 assert.equal(batch.errors.length, 1)
 assert.equal(batch.errors[0].lineNumber, 2)
 assert.match(batch.error, /line 2/)
})
