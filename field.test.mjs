import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import { field, formatValue, parse, runLines } from './field.mjs'

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

test('runLines evaluates notebook scripts top-to-bottom and previews JSON results', async () => {
 const { results, state } = await runLines(
  [
   'hello world',
   'to input 5',
   'to output ; add 3 $input',
   '$output',
   '; to explicit ; add $output 2',
   '!Math.max 2 $explicit',
   '-- a comment line',
   '',
   'toString world',
   'object { a 1 } { b $output }',
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
 assert.deepEqual(results[8].value, ['toString', 'world'])
 assert.equal(results[8].preview, '["toString","world"]')
 assert.deepEqual(results[9].value, { a: 1, b: 8 })
 assert.equal(results[9].preview, '{"a":1,"b":8}')
 assert.equal(state.output, 8)
})

test('runLines captures parse and runtime errors per line with line numbers', async () => {
 const { results } = await runLines(
  [
   'to x 1',
   '!missing.boom 1',
   'add 2 3 ]',
   'add $x 4',
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
  throw new Error(`Unexpected fetch: ${url}`)
 }

 try {
  const f = field({
   console: mockConsole,
   crypto: mockCrypto,
   data: mockData,
   document: mockDocument,
   history: mockHistory,
   location: mockLocation,
   runLines,
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
  const metaEl = headerTop.children[0]
  assert.equal(metaEl.children[0].textContent, 'Direct Title')
  assert.equal(metaEl.children[1].textContent, 'direct-id')
  assert.equal(headerTop.children[1], mountedLane['close-btn'])
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
 const modalSource = await fs.readFile(new URL('./src/lane-modal.fs', import.meta.url), 'utf8')

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
   windowListeners[event] = handler
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
  if (url === '/src/lane-modal.fs') {
   return { text: async () => modalSource }
  }
  throw new Error(`Unexpected fetch: ${url}`)
 }

 try {
  const f = field({
   console: { log() {} },
   data: createMockKV(),
   document: mockDocument,
   runLines,
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

  // Type "hello world" into line 1 -> previews ["hello","world"]
  nb.rows[0]['input-el'].value = 'hello world'
  await nb.rows[0]['input-el'].listeners.input()
  assert.equal(nb.rows[0]['preview-el'].textContent, '["hello","world"]')

  // Click "+" button to add line 2 -> type "to input 5"
  await nb['add-btn'].listeners.click()
  assert.equal(nb.rows.length, 2)
  assert.equal(nb.rows[1]['num-el'].textContent, 2)
  assert.equal(nb.rows[1]['input-el'].focused, true)
  nb.rows[1]['input-el'].value = 'to input 5'
  await nb.rows[1]['input-el'].listeners.input()
  assert.equal(nb.rows[1]['preview-el'].textContent, '5')

  // Press Enter on line 2 to insert line 3 -> type "to output ; add 3 $input"
  let prevented = false
  await nb.rows[1]['input-el'].listeners.keydown({
   key: 'Enter',
   preventDefault() { prevented = true },
  })
  assert.equal(prevented, true)
  assert.equal(nb.rows.length, 3)
  assert.equal(nb.rows[2]['num-el'].textContent, 3)
  nb.rows[2]['input-el'].value = 'to output ; add 3 $input'
  await nb.rows[2]['input-el'].listeners.input()
  assert.equal(nb.rows[2]['preview-el'].textContent, '8')

  // Click "+" to add line 4 -> type "$output"
  await nb['add-btn'].listeners.click()
  nb.rows[3]['input-el'].value = '$output'
  await nb.rows[3]['input-el'].listeners.input()
  assert.equal(nb.rows[3]['preview-el'].textContent, '8')

  // Remove line 1 ("hello world") -> remaining 3 lines renumber to 1, 2, 3 and stay evaluated
  await nb.rows[0]['remove-btn'].listeners.click()
  assert.equal(nb.rows.length, 3)
  assert.deepEqual(nb.rows.map(r => r['num-el'].textContent), [1, 2, 3])
  assert.deepEqual(nb.rows.map(r => r['preview-el'].textContent), ['5', '8', '8'])
  assert.equal(
   kv.get('m-uuid-1.script'),
   JSON.stringify(['to input 5', 'to output ; add 3 $input', '$output'])
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
  assert.deepEqual(reopened.notebook.lines, ['to input 5', 'to output ; add 3 $input', '$output'])
  assert.deepEqual(reopened.notebook.rows.map(r => r['preview-el'].textContent), ['5', '8', '8'])

  // Re-open modal and close Lane 2 from inside the modal, then dismiss modal with Escape
  await f.state.tableHeadRowOpenButton.listeners.click()
  const lane2Item = modal.items.find(item => item.entry.id === 'm-uuid-2')
  assert.equal(lane2Item['is-open'], true)
  await lane2Item['close-btn'].listeners.click()
  assert.equal(f.state.lanes.length, 1)
  assert.equal(mockWindow.location.pathname, '/m-uuid-1')
  assert.equal(modal.items.find(item => item.entry.id === 'm-uuid-2')['is-open'], false)

  await windowListeners.keydown({ key: 'Escape' })
  assert.equal(modal['is-open'], false)

  // Simulate full reload from URL -> persisted script re-runs automatically on lane load
  const fReload = field({
   console: { log() {} },
   data: createMockKV(),
   document: {
    body: createMockElement('body'),
    defaultView: mockWindow,
    createElement: createMockElement,
   },
   runLines,
  })
  await fReload.run(parse(mainSource, '/src/main.fs'))
  assert.equal(fReload.state.lanes.length, 1)
  const reloadedNb = fReload.state.lanes[0].notebook
  assert.deepEqual(reloadedNb.lines, ['to input 5', 'to output ; add 3 $input', '$output'])
  assert.deepEqual(reloadedNb.rows.map(r => r['num-el'].textContent), [1, 2, 3])
  assert.deepEqual(reloadedNb.rows.map(r => r['preview-el'].textContent), ['5', '8', '8'])
 }
 finally {
  globalThis.fetch = origFetch
 }
})
