const RUN_IN_SCOPE = Symbol('runInScope')
const LEXICAL_SCOPE = Symbol('lexicalScope')
const FIELD_ERROR_TAGGED = Symbol('fieldErrorTagged')
const AST_LOC = new WeakMap()

function splitRootPath(a, rest) {
 if (typeof a === 'string' && a.includes('.')) {
  const parts = a.split('.')
  return [parts[0], ...parts.slice(1), ...rest]
 }
 return [a, ...rest]
}

function isCommentNode(node) {
 return Array.isArray(node) && node[0] === '@' && node[1] === 'comment'
}

function formatLoc(loc) {
 if (!loc) {
  return ''
 }
 const where = loc.filename
  ? `${loc.filename}:${loc.line}:${loc.col}`
  : `line ${loc.line} at column ${loc.col}`
 return loc.sourceLine !== undefined && loc.sourceLine.length > 0
  ? ` (${where}: ${loc.sourceLine.trim()})`
  : ` (${where})`
}

function wrapRuntimeError(err, node) {
 if (err && typeof err === 'object' && err[FIELD_ERROR_TAGGED]) {
  return err
 }
 const loc = node && typeof node === 'object' ? AST_LOC.get(node) : undefined
 if (!loc) {
  return err
 }
 const suffix = formatLoc(loc)
 if (err instanceof Error) {
  err.message = `${err.message}${suffix}`
  err.fieldLocation = loc
  err[FIELD_ERROR_TAGGED] = true
  return err
 }
 const wrapped = new Error(`${err}${suffix}`)
 wrapped.fieldLocation = loc
 wrapped[FIELD_ERROR_TAGGED] = true
 return wrapped
}

export function field(initialState={}) {
 function createScope(state, argv = []) {
  function get(a, ...p) {
   const [root, ...path] = splitRootPath(a, p)
   let v = root === 'argv' ? argv : state[root]
   for (const s of path) {
    if (v != null) {
     v = v[s]
    }
   }
   return v
  }
  function propertyIs(x, a, ...p) {
   return get(a, ...p) === x
  }
  function propertyIsLessThan(x, a, ...p) {
   return get(a, ...p) < x
  }
  function propertyIsGreaterThan(x, a, ...p) {
   return get(a, ...p) > x
  }
  function propertyIsLessThanOrEqual(x, a, ...p) {
   return get(a, ...p) <= x
  }
  function propertyIsGreaterThanOrEqual(x, a, ...p) {
   return get(a, ...p) >= x
  }
  function series(...b) {
   return b.map(
    line =>
     line[0] === '@'
      ? me[line[1]](...line.slice(2))
      : line
   )
  }
  function assignBinding(target, key, value) {
   if (!Array.isArray(key)) {
    target[key] = value
    return
   }
   const list = Array.isArray(value)
    ? value
    : value != null && typeof value[Symbol.iterator] === 'function'
     ? Array.from(value)
     : null
   if (list === null) {
    throw new TypeError(`Cannot destructure non-iterable value: ${value}`)
   }
   for (let i = 0; i < key.length; i++) {
    const k = key[i]
    if (k === null || k === undefined) {
     continue
    }
    if (typeof k === 'string' && k.startsWith('...') && k.length > 3) {
     if (i !== key.length - 1) {
      throw new Error('Rest element must be last in destructuring pattern')
     }
     target[k.slice(3)] = list.slice(i)
     return
    }
    assignBinding(target, k, list[i])
   }
  }
  function assign(target, ...sources) {
   const obj = typeof target === 'string' ? get(target) : target
   if (!obj || typeof obj !== 'object') {
    throw new TypeError(`assign target is not an object: ${JSON.stringify(target)}`)
   }
   for (const source of sources) {
    if (source === null || source === undefined) {
     continue
    }
    if (Array.isArray(source)) {
     if (source.length !== 2) {
      throw new TypeError(`assign expects { key value } pairs or objects, got: ${JSON.stringify(source)}`)
     }
     obj[source[0]] = source[1]
    }
    else if (typeof source === 'object') {
     Object.assign(obj, source)
    }
    else {
     throw new TypeError(`assign expects { key value } pairs or objects, got: ${JSON.stringify(source)}`)
    }
   }
   return obj
  }
  function to(a, ...c) {
   const b = c.pop()
   return set(b, a, ...c)
  }
  function set(b, a, ...c) {
   const [root, ...path] = splitRootPath(a, c)
   if (path.length === 0) {
    assignBinding(state, root, b)
    return b
   }
   let v = state[root]
   const f = path.pop()
   for (const d of path) {
    v = v[d]
   }
   assignBinding(v, f, b)
   return b
  }
  function invoke(b, a, ...c) {
   const [root, ...path] = splitRootPath(a, c)
   if (path.length === 0) {
    const fn = typeof root === 'function' ? root : state[root]
    if (typeof fn !== 'function') {
     throw new Error(`invoke: ${JSON.stringify(root)} is not a function`)
    }
    return fn(...b)
   }
   let v = typeof root === 'string' ? state[root] : root
   if (v == null) {
    throw new Error(`invokeProperty: ${JSON.stringify(root)} not found`)
   }
   const f = path.pop()
   for (const d of path) {
    v = v[d]
    if (v == null) {
     throw new Error(`invokeProperty: ${JSON.stringify(d)} not found in ${[root, ...path].join('.')}`)
    }
   }
   return v[f](...b)
  }
  function tap(a, ...c) {
   return invoke([], a, ...c)
  }
  function and(...blocks) {
   let v = true
   for (const [ b, ...a ] of blocks) {
    v &= me[b](...a)
   }
   return v
  }
  function comment() {
   // no-op
  }
  function invokeBranch(body) {
   if (typeof body === 'function') {
    return body[LEXICAL_SCOPE] === me ? body[RUN_IN_SCOPE](me) : body()
   }
   return body
  }
  function condition([b, ...a], t) {
   if (me[b](...a)) {
    return invokeBranch(t)
   }
  }
  async function match(...pairs) {
   for (const pair of pairs) {
    if (!Array.isArray(pair) || pair.length !== 2) {
     throw new TypeError(`match expects { condition ( will ) } pairs, got: ${JSON.stringify(pair)}`)
    }
    const [cond, body] = pair
    const matched = Array.isArray(cond) && typeof cond[0] === 'string' && typeof me[cond[0]] === 'function'
     ? await me[cond[0]](...cond.slice(1))
     : cond
    if (matched) {
     return invokeBranch(body)
    }
   }
   return undefined
  }
  async function each(iterable, fn) {
   if (iterable == null || typeof iterable[Symbol.iterator] !== 'function') {
    throw new TypeError(`each expects an iterable, got: ${iterable}`)
   }
   if (typeof fn !== 'function') {
    throw new TypeError(`each expects a function, got: ${fn}`)
   }
   let index = 0
   let last
   for (const item of iterable) {
    last = await fn(item, index)
    index++
   }
   return last
  }
  async function whileLoop(cond, body) {
   let last
   while (
    Array.isArray(cond) && typeof cond[0] === 'string' && typeof me[cond[0]] === 'function'
     ? await me[cond[0]](...cond.slice(1))
     : typeof cond === 'function'
      ? await invokeBranch(cond)
      : cond
   ) {
    last = await invokeBranch(body)
   }
   return last
  }

  function willInvoke(a, ...b) {
   return function (...d) {
    return me.get(...b)(...a, ...d)
   }
  }

  function willSeries(...b) {
   return function func(...a) {
    const child = createScope(Object.create(state), a)
    for (const [c, ...d] of b) {
     child[c](...d)
    }
   }
  }

  function add(a, b) { return a + b }
  function subtract(a, b) { return a - b }
  function multiply(a, b) { return a * b }
  function divide(a, b) { return a / b }
  function ternary(a, b, c) { return a ? b : c }
  function modulus(a, b) { return a % b }

  async function seriesAll(source, fn) {
   const out = []
   for (const x of source) {
    out.push(await fn(x))
   }
   return out
  }

  async function evalCondition(condAst) {
   if (
    Array.isArray(condAst) &&
    condAst[0] !== '@' &&
    typeof condAst[0] === 'string' &&
    typeof me[condAst[0]] === 'function'
   ) {
    return me[condAst[0]](...(await seriesAll(condAst.slice(1), compile)))
   }
   if (Array.isArray(condAst) && condAst[0] === '@' && condAst[1] === 'will') {
    const fn = await compile(condAst)
    return invokeBranch(fn)
   }
   return compile(condAst)
  }

  async function evalMatch(armAsts) {
   for (const armAst of armAsts) {
    if (Array.isArray(armAst) && armAst[0] !== '@' && armAst.length === 2) {
     const [condAst, bodyAst] = armAst
     if (await evalCondition(condAst)) {
      const body = await compile(bodyAst)
      return invokeBranch(body)
     }
    }
    else {
     const pair = await compile(armAst)
     if (!Array.isArray(pair) || pair.length !== 2) {
      throw new TypeError(`match expects { condition ( will ) } pairs, got: ${JSON.stringify(pair)}`)
     }
     const [cond, body] = pair
     const matched = Array.isArray(cond) && typeof cond[0] === 'string' && typeof me[cond[0]] === 'function'
      ? await me[cond[0]](...cond.slice(1))
      : cond
     if (matched) {
      return invokeBranch(body)
     }
    }
   }
   return undefined
  }

  async function evalWhile(condAst, bodyAst) {
   const isWillBody = Array.isArray(bodyAst) && bodyAst[0] === '@' && bodyAst[1] === 'will'
   const compiledBody = isWillBody ? await compile(bodyAst) : null
   let last
   while (await evalCondition(condAst)) {
    const body = isWillBody ? compiledBody : await compile(bodyAst)
    last = await invokeBranch(body)
   }
   return last
  }

  async function evalBlock(stmts) {
   let last
   for (const stmt of stmts) {
    const value = await compile(stmt)
    if (!isCommentNode(stmt)) {
     last = value
    }
   }
   return last
  }

  async function compile(x) {
   switch (true) {
    case x && Array.isArray(x):
     if (x[0] === '@') {
      if (x[1] === '@') {
       return x.slice(1)
      }
      try {
       if (!Object.hasOwn(me, x[1]) || typeof me[x[1]] !== 'function') {
        throw new Error(`${JSON.stringify(x[1])} is not a valid FieldScript command`)
       }
       if (x[1] === 'will') {
        return me[x[1]]([ '@', ...x.slice(2) ])
       }
       if (x[1] === 'match') {
        return await evalMatch(x.slice(2))
       }
       if (x[1] === 'while') {
        return await evalWhile(x[2], x[3])
       }
       return await me[x[1]](
        ...(await seriesAll(x.slice(2), compile))
       )
      }
      catch (err) {
       throw wrapRuntimeError(err, x)
      }
     }
     return seriesAll(x, compile)
    case typeof x === 'object' && x:
     return Object.fromEntries(
      await seriesAll(
       Object.entries(x),
       async ([k, v]) => [k, await compile(v)]
      )
     )
    default:
     return x
   }
  }

  function template(x, vars) {
   switch (true) {
    case x && Array.isArray(x): {
     if (x[0] === '@') {
      if (x[1] === '@') {
       return x.slice(1)
      }
      if (x.length === 1) {
       return undefined
      }
      if (typeof x[1] !== 'string') {
       throw new Error('expecting string after @')
      }
      if (x[1].substr(0, 9) === 'template#') {
       return vars[x[1].substr(9)]
      }
     }
     const mapped = x.map(y => template(y, vars))
     const loc = AST_LOC.get(x)
     if (loc) {
      AST_LOC.set(mapped, loc)
     }
     return mapped
    }
    case typeof x === 'object' && x:
     return Object.fromEntries(
      Object.entries(x).map(
       ([k, v]) => [k, template(v, vars)]
      )
     )
    default:
     return x
   }
  }

  async function run(program, vars) {
   const templated = me.template(program, vars)
   if (Array.isArray(templated) && templated[0] !== '@') {
    return evalBlock(templated)
   }
   return me.compile(templated)
  }

  async function load(scriptPath, vars = {}) {
   const scriptText = await (
    await fetch(scriptPath)
   ).text()
   const program = parse(scriptText, scriptPath)
   const child = createScope(Object.create(state), [])
   return child.run(program, vars)
  }

  function object(...entries) {
   const result = {}
   for (const entry of entries) {
    if (!Array.isArray(entry) || entry.length !== 2) {
     throw new TypeError(`object expects { key value } pairs, got: ${JSON.stringify(entry)}`)
    }
    result[entry[0]] = entry[1]
   }
   return result
  }

  function will(...blocks) {
   const stmts = blocks.length === 1 && blocks[0][0] === '@'
    ? blocks[0].slice(1)
    : blocks
   async function fn(...a) {
    const child = createScope(Object.create(state), a)
    return child.evalBlock(stmts)
   }
   fn.ast = stmts
   fn[LEXICAL_SCOPE] = me
   fn[RUN_IN_SCOPE] = scope => scope.evalBlock(stmts)
   return fn
  }

  const me = {
   add,
   subtract,
   multiply,
   divide,
   ternary,
   modulus,
   and,
   assign,
   comment,
   condition,
   each,
   get,
   invoke,
   load,
   match,
   object,
   propertyIs,
   propertyIsLessThan,
   propertyIsGreaterThan,
   propertyIsLessThanOrEqual,
   propertyIsGreaterThanOrEqual,
   series,
   set,
   state,
   tap,
   to,
   'while': whileLoop,
   will,
   willInvoke,
   willSeries,
   compile,
   evalBlock,
   template,
   run
  }
  return me
 }

 return createScope({ ...initialState }, [])
}

export function parse(text, filename, startRow = 0) {
 const output = []
 const root = { block: output }
 const stack = [ root ]
 const length = text.length
 const sourceLines = text.split('\n')
 let scope = root
 let pendingWord = ''
 let pendingWordStartRow = startRow
 let pendingWordStartCol = 0
 let inString = false
 let inEscape = false
 let inPatternDefinition = false
 let pattern = undefined
 let patternScope = undefined
 let collectedPatternIndex = undefined
 let patternLineRow = startRow
 let patternLineCol = 0
 function makeLoc(lineIndex, colIndex) {
  return {
   filename,
   line: lineIndex + 1,
   col: colIndex + 1,
   sourceLine: (sourceLines[lineIndex - startRow] || '').replace(/\r$/, ''),
  }
 }
 function flushAutoBlock() {
  if (!scope.autoBlock) { throw new Error('no autoBlock') }
  scope.autoBlock = false
  if (scope.isInvoke) {
   if (scope.block.length === 0) {
    throw new Error(`Empty invoke block (!)${formatLoc(scope.loc)}`)
   }
   const [ target, ...args ] = scope.block
   const path = typeof target === 'string' ? target.split('.') : [ target ]
   scope.block.splice(0, scope.block.length, '@', 'invoke', args, ...path)
  }
  else if (scope.block[0] === 'list') {
   scope.block.shift()
  }
  else {
   if (scope.isDeferred) {
    scope.block.unshift('will')
   }
   scope.block.unshift('@')
  }
  if (scope.loc) {
   AST_LOC.set(scope.block, scope.loc)
  }
  stack.pop()
  scope = stack[stack.length - 1]
 }
 function flushPendingWord(isString = false) {
  if (isString || pendingWord.length > 0) {
   let pendingValue = pendingWord
   if (!isString) {
    if (pendingValue.length > 1 && pendingValue[0] === '$') {
     pendingValue = [ '@', 'get', ...pendingValue.slice(1).split('.') ]
     AST_LOC.set(pendingValue, makeLoc(pendingWordStartRow, pendingWordStartCol))
    }
    else if (pendingValue === 'false') {
     pendingValue = false
    }
    else if (pendingValue === 'true') {
     pendingValue = true
    }
    else if (pendingValue === 'null') {
     pendingValue = null
    }
    else if (pendingValue === 'undefined') {
     pendingValue = undefined
    }
    else if (pendingValue === '=') {
     inPatternDefinition = true
     pattern = undefined
     patternScope = scope
     collectedPatternIndex = scope.block.length
     pendingWord = ''
     return
    }
    else {
     const num = Number(pendingValue)
     if (Number.isFinite(num) && String(num) === pendingValue) {
      pendingValue = num
     }
    }
   }
   if (pattern) {
    if (sinceLastNewline.length === 0) {
     patternLineRow = pendingWordStartRow
     patternLineCol = pendingWordStartCol
    }
    sinceLastNewline.push(pendingValue)
   }
   else {
    scope.block.push(pendingValue)
   }
   pendingWord = ''
  }
 }

 function resolvePattern(x, vars, overrideLoc) {
  switch (true) {
   case x && Array.isArray(x): {
    const resolved = x.reduce(
     (init, y) => init.concat(resolvePattern(y, vars, overrideLoc)), []
    )
    const loc = overrideLoc || AST_LOC.get(x)
    if (loc) {
     AST_LOC.set(resolved, loc)
    }
    return [ resolved ]
   }
   case typeof x === 'object' && x:
    return [
     Object.fromEntries(
      Object.entries(x).map(
       ([k, v]) => [k, resolvePattern(v, vars, overrideLoc)]
      )
     )
    ]
   case typeof x === 'string' && x.length > 1 && x[0] === '@':
    const candidateString = x.slice(1)
    if (candidateString.endsWith('+')) {
     const candidateStringForRest = candidateString.substr(0, candidateString.length - 1)
     const candidateIntForRest = parseInt(candidateStringForRest, 10)
     if (candidateIntForRest.toString(10) === candidateStringForRest) {
      return vars.slice(candidateIntForRest)
     }
    }
    else {
     const candidateInt = parseInt(candidateString, 10)
     if (candidateInt.toString(10) === candidateString) {
      return [ vars[candidateInt] ]
     }
    }
   case typeof x === 'string' && x.includes('.') && x.includes('@'):
    return [
     x.split('.').map(seg => {
      if (seg.length > 1 && seg[0] === '@') {
       const idx = parseInt(seg.slice(1), 10)
       if (idx.toString(10) === seg.slice(1)) {
        return vars[idx]
       }
      }
      return seg
     }).join('.')
    ]
   default:
    return [ x ]
  }
 }

 function flushPatternLine(pattern, line) {
  const lineLoc = makeLoc(patternLineRow, patternLineCol)
  const resolvedPattern = resolvePattern(pattern, [line, ...line], lineLoc)
  scope.block.push(...resolvedPattern)
 }

 let sinceLastNewline = []
 let row = startRow
 let col = -1
 for (let i = 0 ; i < length ; i++) {
  col++
  function info() {
   const where = filename
    ? `${filename}:${row + 1}:${col + 1}`
    : `on line ${row + 1} at column ${col + 1}`
   return ` ${where}: ${text.substr(i - col, col)}`
  }
  const chr = text[i]
  if (inString) {
   if (inEscape) {
    pendingWord +=
     chr === 'n' ? '\n' :
     chr === 't' ? '\t' :
     chr
    inEscape = false
    continue
   }
   switch (chr) {
    case '\\':
     inEscape = true
     break
    case "'":
     inString = false
     flushPendingWord(true)
     break
    default:
     pendingWord += chr
   }
   continue
  }
  if (
   chr === '-' &&
   pendingWord.length === 0 &&
   text[i + 1] === '-' &&
   (i + 2 === length || text[i + 2] === ' ' || text[i + 2] === '\t' || text[i + 2] === '\n' || text[i + 2] === '\r')
  ) {
   const commentLoc = makeLoc(row, col)
   let start = i + 2
   if (text[start] === ' ') { start++ }
   let end = start
   while (end < length && text[end] !== '\n') { end++ }
   const commentText = text.slice(start, end).replace(/\r$/, '')
   if (pattern && sinceLastNewline.length > 0) {
    const line = sinceLastNewline
    sinceLastNewline = []
    flushPatternLine(pattern, line)
   }
   while (scope.autoBlock) { flushAutoBlock() }
   if (inPatternDefinition && scope === patternScope) {
    inPatternDefinition = false
    pattern = scope.block.splice(collectedPatternIndex)
    if (pattern.length === 0) {
     pattern = undefined
    }
   }
   const commentNode = [ '@', 'comment', commentText ]
   AST_LOC.set(commentNode, commentLoc)
   scope.block.push(commentNode)
   i = end
   if (end < length && text[end] === '\n') {
    row++
    col = -1
   }
   continue
  }
  switch (chr) {
   case "'":
    inString = true
    pendingWordStartRow = row
    pendingWordStartCol = col
    break
   case ';':
   case ':':
   case '!': {
    const isDeferred = chr === ':'
    const isInvoke = chr === '!'
    flushPendingWord()
    const block = []
    scope.block.push(block)
    const autoScope = { block, autoBlock: true, isDeferred, isInvoke, loc: makeLoc(row, col) }
    stack.push(autoScope)
    scope = autoScope
    break
   }
   case '\n':
   case ',':
    if (chr === '\n') {
     row++
     col = -1
    }
    flushPendingWord()
    const line = sinceLastNewline
    sinceLastNewline = []
    while (scope.autoBlock) { flushAutoBlock() }
    if (inPatternDefinition) {
     if (scope === patternScope) {
      inPatternDefinition = false
      pattern = scope.block.splice(collectedPatternIndex)
      if (pattern.length === 0) {
       pattern = undefined
      }
     }
    }
    else if (pattern) {
     flushPatternLine(pattern, line)
    }
    break
   case ' ':
   case '\t':
   case '\r':
    flushPendingWord()
    break
   case '{':
   case '[':
   case '(':
    flushPendingWord()
    const isDeferred = chr === '('
    const isList = chr === '{'
    const inner = isDeferred ? [ 'will' ] : isList ? [ 'list' ] : []
    scope.block.push(inner)
    const branch = { block: inner, isDeferred, isList, loc: makeLoc(row, col) }
    stack.push(branch)
    scope = branch
    break
   case '}':
   case ']':
   case ')':
    if (stack.length < 2) {
     throw new Error(`no block is open, you are at output${info()}`)
    }
    flushPendingWord()
    while (scope.autoBlock) { flushAutoBlock() }
    if (stack.length < 2) {
     throw new Error(`no block is open, you are at output${info()}`)
    }

    const expectedList = chr === '}'
    if (scope.isList ? !expectedList : expectedList) {
     throw new Error(`Block end mismatch: got ${chr}, expected ${
      scope.isList ? '{}' : scope.isDeferred ? ')' : ']'
     }${info()}`)
    }
    const expectedDeferred = chr === ')'
    if (scope.isDeferred ? !expectedDeferred : expectedDeferred) {
     throw new Error(`Block end mismatch: got ${chr}, expected ${scope.isDeferred ? ')' : ']'}${info()}`)
    }

    if (scope.block[0] === 'list') {
     scope.block.shift()
    }
    else if (
     !scope.isList &&
     !scope.isDeferred &&
     scope.block.length === 1 &&
     Array.isArray(scope.block[0]) &&
     scope.block[0][0] === '@'
    ) {
     const innerLoc = AST_LOC.get(scope.block[0])
     scope.block.splice(0, 1, ...scope.block[0])
     if (innerLoc) {
      AST_LOC.set(scope.block, innerLoc)
     }
    }
    else {
     scope.block.unshift('@')
     if (scope.loc) {
      AST_LOC.set(scope.block, scope.loc)
     }
    }

    stack.pop()
    scope = stack[stack.length - 1]
    break
   default:
    if (pendingWord.length === 0) {
     pendingWordStartRow = row
     pendingWordStartCol = col
    }
    pendingWord += chr
    break
  }
 }
 flushPendingWord()
 while (scope.autoBlock) { flushAutoBlock() }
 if (inPatternDefinition) {
  patternScope.block.splice(collectedPatternIndex)
 }
 else if (pattern && sinceLastNewline.length > 0) {
  flushPatternLine(pattern, sinceLastNewline)
 }
 return output
}

const INTERNAL_COMMANDS = new Set([ 'compile', 'evalBlock', 'template', 'run' ])

export function formatValue(value) {
 if (value === undefined) {
  return 'undefined'
 }
 if (typeof value === 'number' && Number.isNaN(value)) {
  return 'NaN'
 }
 if (typeof value === 'function') {
  return '[function]'
 }
 try {
  const json = JSON.stringify(value)
  return json === undefined ? String(value) : json
 }
 catch {
  return String(value)
 }
}

export async function runLines(lines, options = {}) {
 const { initialState = {}, filename = 'lane' } = options
 const runner = field(initialState)
 const results = []
 const isCommand = name =>
  typeof name === 'string' &&
  !INTERNAL_COMMANDS.has(name) &&
  Object.hasOwn(runner, name) &&
  typeof runner[name] === 'function'

 for (let i = 0; i < lines.length; i++) {
  const source = String(lines[i] ?? '')
  const lineNumber = i + 1
  if (source.trim().length === 0) {
   results.push({
    index: i,
    lineNumber,
    source,
    value: undefined,
    preview: '',
    error: null,
    isEmpty: true,
    isComment: false,
   })
   continue
  }
  try {
   const ast = parse(source, filename, i)
   if (ast.length === 0) {
    results.push({
     index: i,
     lineNumber,
     source,
     value: undefined,
     preview: '',
     error: null,
     isEmpty: true,
     isComment: false,
    })
    continue
   }
   if (ast.length === 1 && isCommentNode(ast[0])) {
    results.push({
     index: i,
     lineNumber,
     source,
     value: undefined,
     preview: '',
     error: null,
     isEmpty: false,
     isComment: true,
    })
    continue
   }
   let expr
   if (ast.length === 1) {
    expr = isCommand(ast[0]) ? [ '@', ast[0] ] : ast[0]
   }
   else if (isCommand(ast[0])) {
    expr = [ '@', ...ast ]
   }
   else {
    expr = ast
   }
   if (Array.isArray(expr) && expr[0] === '@' && !AST_LOC.has(expr)) {
    AST_LOC.set(expr, { filename, line: lineNumber, col: 1, sourceLine: source })
   }
   const value = await runner.compile(expr)
   results.push({
    index: i,
    lineNumber,
    source,
    value,
    preview: formatValue(value),
    error: null,
    isEmpty: false,
    isComment: false,
   })
  }
  catch (err) {
   const message = err instanceof Error ? err.message : String(err)
   results.push({
    index: i,
    lineNumber,
    source,
    value: undefined,
    preview: message,
    error: message,
    isEmpty: false,
    isComment: false,
   })
  }
 }
 return { results, state: runner.state }
}
