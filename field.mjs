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

function isThenable(value) {
 return value != null && (typeof value === 'object' || typeof value === 'function') && typeof value.then === 'function'
}

function then(value, onFulfilled) {
 return isThenable(value) ? value.then(onFulfilled) : onFulfilled(value)
}

function wrapErrorCatch(result, node) {
 return isThenable(result)
  ? result.catch(err => { throw wrapRuntimeError(err, node) })
  : result
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

export const TRANSPORT_PACKET_TYPE = 'field-transport/script'
const TRANSPORT_TAG = '__fieldTransport'
const TRANSPORT_UNSERIALIZABLE = Symbol('transportUnserializable')
const TRANSPORT_EXCLUDED_BINDINGS = new Set([
 'argv',
 'console',
 'data',
 'Date',
 'document',
 'importLane',
 'JSON',
 'Math',
 'output',
 'window',
])

function encodeTransportValue(value, seen = new Set(), strict = true) {
 if (value === undefined) {
  return { [TRANSPORT_TAG]: 'undefined' }
 }
 if (value === null || typeof value === 'boolean' || typeof value === 'string') {
  return value
 }
 if (typeof value === 'number') {
  if (Number.isNaN(value)) {
   return { [TRANSPORT_TAG]: 'number', value: 'NaN' }
  }
  if (value === Infinity) {
   return { [TRANSPORT_TAG]: 'number', value: 'Infinity' }
  }
  if (value === -Infinity) {
   return { [TRANSPORT_TAG]: 'number', value: '-Infinity' }
  }
  if (Object.is(value, -0)) {
   return { [TRANSPORT_TAG]: 'number', value: '-0' }
  }
  return value
 }
 if (typeof value === 'function' || typeof value === 'symbol' || typeof value === 'bigint') {
  if (strict) {
   throw new TypeError(`Cannot transport ${typeof value} value across code transport`)
  }
  return TRANSPORT_UNSERIALIZABLE
 }
 if (value instanceof Date) {
  const iso = Number.isNaN(value.getTime()) ? 'Invalid Date' : value.toISOString()
  return { [TRANSPORT_TAG]: 'date', value: iso }
 }
 if (seen.has(value)) {
  if (strict) {
   throw new TypeError('Cannot transport circular value across code transport')
  }
  return TRANSPORT_UNSERIALIZABLE
 }
 if (Array.isArray(value)) {
  seen.add(value)
  const out = []
  for (let i = 0; i < value.length; i++) {
   const encoded = encodeTransportValue(value[i], seen, strict)
   if (encoded === TRANSPORT_UNSERIALIZABLE) {
    seen.delete(value)
    return TRANSPORT_UNSERIALIZABLE
   }
   out.push(encoded)
  }
  seen.delete(value)
  return out
 }
 const proto = Object.getPrototypeOf(value)
 if (proto !== null && proto !== Object.prototype) {
  if (strict) {
   throw new TypeError('Cannot transport non-plain object across code transport')
  }
  return TRANSPORT_UNSERIALIZABLE
 }
 seen.add(value)
 const entries = Object.entries(value)
 const hasReservedTag = Object.hasOwn(value, TRANSPORT_TAG)
 const out = {}
 for (const [k, v] of entries) {
  const encoded = encodeTransportValue(v, seen, strict)
  if (encoded === TRANSPORT_UNSERIALIZABLE) {
   seen.delete(value)
   return TRANSPORT_UNSERIALIZABLE
  }
  out[k] = encoded
 }
 seen.delete(value)
 if (hasReservedTag) {
  return { [TRANSPORT_TAG]: 'object', entries: Object.entries(out) }
 }
 return out
}

function decodeTransportValue(value) {
 if (value === null || typeof value !== 'object') {
  return value
 }
 if (Array.isArray(value)) {
  return value.map(decodeTransportValue)
 }
 if (Object.hasOwn(value, TRANSPORT_TAG)) {
  const tag = value[TRANSPORT_TAG]
  if (tag === 'undefined') {
   return undefined
  }
  if (tag === 'number') {
   if (value.value === 'NaN') { return NaN }
   if (value.value === 'Infinity') { return Infinity }
   if (value.value === '-Infinity') { return -Infinity }
   if (value.value === '-0') { return -0 }
   return Number(value.value)
  }
  if (tag === 'date') {
   return value.value === 'Invalid Date' ? new Date(NaN) : new Date(value.value)
  }
  if (tag === 'object' && Array.isArray(value.entries)) {
   return Object.fromEntries(value.entries.map(([k, v]) => [k, decodeTransportValue(v)]))
  }
 }
 const out = {}
 for (const [k, v] of Object.entries(value)) {
  out[k] = decodeTransportValue(v)
 }
 return out
}

function snapshotSerializableState(state) {
 const bindings = {}
 if (!state || typeof state !== 'object') {
  return bindings
 }
 const seenKeys = new Set()
 let cur = state
 while (cur && cur !== Object.prototype) {
  for (const key of Object.keys(cur)) {
   if (seenKeys.has(key) || TRANSPORT_EXCLUDED_BINDINGS.has(key)) {
    continue
   }
   seenKeys.add(key)
   try {
    const val = state[key]
    const encoded = encodeTransportValue(val, new Set(), false)
    if (encoded !== TRANSPORT_UNSERIALIZABLE) {
     bindings[key] = decodeTransportValue(encoded)
    }
   }
   catch {
    // skip throwing getters
   }
  }
  cur = Object.getPrototypeOf(cur)
 }
 return bindings
}

export function serializeTransportPacket(packet) {
 if (!packet || typeof packet !== 'object' || !Array.isArray(packet.ast)) {
  throw new TypeError('serializeTransportPacket expects a transport packet with an AST array')
 }
 const encoded = encodeTransportValue(
  {
   type: TRANSPORT_PACKET_TYPE,
   index: packet.index ?? 0,
   lineNumber: packet.lineNumber ?? null,
   ast: packet.ast,
   args: Array.isArray(packet.args) ? packet.args : [],
   bindings: packet.bindings && typeof packet.bindings === 'object' ? packet.bindings : {},
  },
  new Set(),
  true
 )
 return JSON.stringify(encoded)
}

export function deserializeTransportPacket(wire) {
 const parsed = typeof wire === 'string' ? JSON.parse(wire) : wire
 const decoded = decodeTransportValue(parsed)
 if (!decoded || typeof decoded !== 'object' || decoded.type !== TRANSPORT_PACKET_TYPE || !Array.isArray(decoded.ast)) {
  throw new TypeError('Invalid FieldScript code transport packet')
 }
 return {
  type: TRANSPORT_PACKET_TYPE,
  index: decoded.index ?? 0,
  lineNumber: decoded.lineNumber ?? null,
  ast: decoded.ast,
  args: Array.isArray(decoded.args) ? decoded.args : [],
  bindings: decoded.bindings && typeof decoded.bindings === 'object' ? decoded.bindings : {},
 }
}

export function isTransportPacket(value) {
 return Boolean(
  value &&
  typeof value === 'object' &&
  value.type === TRANSPORT_PACKET_TYPE &&
  Array.isArray(value.ast)
 )
}

export function isDomElement(value) {
 if (!value || typeof value !== 'object') {
  return false
 }
 if (typeof Element === 'function' && value instanceof Element) {
  return true
 }
 if (typeof DocumentFragment === 'function' && value instanceof DocumentFragment) {
  return true
 }
 if (value.nodeType === 1 || value.nodeType === 11) {
  return true
 }
 if (
  typeof value.tag === 'string' &&
  typeof value.appendChild === 'function' &&
  typeof value.setAttribute === 'function'
 ) {
  return true
 }
 return false
}

export function createTransport() {
 const queue = []
 let currentLineNumber = null
 return {
  setLineNumber(lineNumber) {
   currentLineNumber = lineNumber
  },
  send(block, args = [], meta = {}) {
   let ast
   let baseArgs = []
   let baseBindings = {}
   if (typeof block === 'function' && Array.isArray(block.ast)) {
    ast = block.ast
   }
   else if (isTransportPacket(block)) {
    ast = block.ast
    baseArgs = Array.isArray(block.args) ? block.args : []
    baseBindings = block.bindings && typeof block.bindings === 'object' ? block.bindings : {}
   }
   else {
    throw new TypeError('send expects a deferred ( ... ) block')
   }
   const resolvedArgs = args.length > 0 ? args : baseArgs
   const stateBindings = meta.state ? snapshotSerializableState(meta.state) : {}
   const bindings = { ...baseBindings, ...stateBindings }
   const index = queue.length
   const lineNumber = meta.lineNumber ?? currentLineNumber
   const wire = serializeTransportPacket({
    type: TRANSPORT_PACKET_TYPE,
    index,
    lineNumber,
    ast,
    args: resolvedArgs,
    bindings,
   })
   const packet = deserializeTransportPacket(wire)
   packet.wire = wire
   queue.push(packet)
   return packet
  },
  packets() {
   return queue.slice()
  },
  wires() {
   return queue.map(item => item.wire)
  },
  clear() {
   queue.length = 0
  },
 }
}

export function field(initialState={}, options={}) {
 const transport = options.transport || createTransport()
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
  function match(...pairs) {
   const step = i => {
    while (i < pairs.length) {
     const pair = pairs[i]
     if (!Array.isArray(pair) || pair.length !== 2) {
      throw new TypeError(`match expects { condition ( will ) } pairs, got: ${JSON.stringify(pair)}`)
     }
     const [cond, body] = pair
     const matched = Array.isArray(cond) && typeof cond[0] === 'string' && typeof me[cond[0]] === 'function'
      ? me[cond[0]](...cond.slice(1))
      : cond
     if (isThenable(matched)) {
      return matched.then(m => (m ? invokeBranch(body) : step(i + 1)))
     }
     if (matched) {
      return invokeBranch(body)
     }
     i++
    }
    return undefined
   }
   return step(0)
  }
  function each(iterable, fn) {
   if (iterable == null || typeof iterable[Symbol.iterator] !== 'function') {
    throw new TypeError(`each expects an iterable, got: ${iterable}`)
   }
   if (typeof fn !== 'function') {
    throw new TypeError(`each expects a function, got: ${fn}`)
   }
   const iter = iterable[Symbol.iterator]()
   let index = 0
   let last
   const step = () => {
    while (true) {
     const next = iter.next()
     if (next.done) {
      return last
     }
     const res = fn(next.value, index++)
     if (isThenable(res)) {
      return res.then(v => {
       last = v
       return step()
      })
     }
     last = res
    }
   }
   return step()
  }
  function whileLoop(cond, body) {
   let last
   const loop = () => {
    while (true) {
     const c = Array.isArray(cond) && typeof cond[0] === 'string' && typeof me[cond[0]] === 'function'
      ? me[cond[0]](...cond.slice(1))
      : typeof cond === 'function'
       ? invokeBranch(cond)
       : cond
     if (isThenable(c)) {
      return c.then(ok => {
       if (!ok) { return last }
       return then(invokeBranch(body), v => {
        last = v
        return loop()
       })
      })
     }
     if (!c) {
      return last
     }
     const res = invokeBranch(body)
     if (isThenable(res)) {
      return res.then(v => {
       last = v
       return loop()
      })
     }
     last = res
    }
   }
   return loop()
  }

  function tryBlock(body, onError) {
   try {
    const res = invokeBranch(body)
    if (isThenable(res)) {
     return res.catch(err => (typeof onError === 'function' ? onError(err) : onError))
    }
    return res
   }
   catch (err) {
    return typeof onError === 'function' ? onError(err) : onError
   }
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

  function seriesAll(source, fn) {
   const out = []
   const step = i => {
    while (i < source.length) {
     const res = fn(source[i])
     if (isThenable(res)) {
      return res.then(v => {
       out.push(v)
       return step(i + 1)
      })
     }
     out.push(res)
     i++
    }
    return out
   }
   return step(0)
  }

  function evalCondition(condAst) {
   if (
    Array.isArray(condAst) &&
    condAst[0] !== '@' &&
    typeof condAst[0] === 'string' &&
    typeof me[condAst[0]] === 'function'
   ) {
    return then(seriesAll(condAst.slice(1), compile), args => me[condAst[0]](...args))
   }
   if (Array.isArray(condAst) && condAst[0] === '@' && condAst[1] === 'will') {
    return then(compile(condAst), fn => invokeBranch(fn))
   }
   return compile(condAst)
  }

  function evalMatch(armAsts) {
   const step = i => {
    while (i < armAsts.length) {
     const armAst = armAsts[i]
     if (Array.isArray(armAst) && armAst[0] !== '@' && armAst.length === 2) {
      const [condAst, bodyAst] = armAst
      const matched = evalCondition(condAst)
      if (isThenable(matched)) {
       return matched.then(m =>
        m ? then(compile(bodyAst), invokeBranch) : step(i + 1)
       )
      }
      if (matched) {
       return then(compile(bodyAst), invokeBranch)
      }
     }
     else {
      const handlePair = pair => {
       if (!Array.isArray(pair) || pair.length !== 2) {
        throw new TypeError(`match expects { condition ( will ) } pairs, got: ${JSON.stringify(pair)}`)
       }
       const [cond, body] = pair
       const matched = Array.isArray(cond) && typeof cond[0] === 'string' && typeof me[cond[0]] === 'function'
        ? me[cond[0]](...cond.slice(1))
        : cond
       return then(matched, m => (m ? invokeBranch(body) : step(i + 1)))
      }
      const pair = compile(armAst)
      return isThenable(pair) ? pair.then(handlePair) : handlePair(pair)
     }
     i++
    }
    return undefined
   }
   return step(0)
  }

  function evalWhile(condAst, bodyAst) {
   const isWillBody = Array.isArray(bodyAst) && bodyAst[0] === '@' && bodyAst[1] === 'will'
   const runWithBody = compiledBody => {
    let last
    const loop = () => {
     while (true) {
      const cond = evalCondition(condAst)
      if (isThenable(cond)) {
       return cond.then(c => {
        if (!c) { return last }
        const bodyRes = isWillBody ? invokeBranch(compiledBody) : then(compile(bodyAst), invokeBranch)
        return then(bodyRes, v => {
         last = v
         return loop()
        })
       })
      }
      if (!cond) {
       return last
      }
      const bodyRes = isWillBody ? invokeBranch(compiledBody) : then(compile(bodyAst), invokeBranch)
      if (isThenable(bodyRes)) {
       return bodyRes.then(v => {
        last = v
        return loop()
       })
      }
      last = bodyRes
     }
    }
    return loop()
   }
   return isWillBody ? then(compile(bodyAst), runWithBody) : runWithBody(null)
  }

  function evalBlock(stmts) {
   let last
   const step = i => {
    while (i < stmts.length) {
     const stmt = stmts[i]
     const value = compile(stmt)
     if (isThenable(value)) {
      return value.then(v => {
       if (!isCommentNode(stmt)) {
        last = v
       }
       return step(i + 1)
      })
     }
     if (!isCommentNode(stmt)) {
      last = value
     }
     i++
    }
    return last
   }
   return step(0)
  }

  function compile(x) {
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
        return wrapErrorCatch(evalMatch(x.slice(2)), x)
       }
       if (x[1] === 'while') {
        return wrapErrorCatch(evalWhile(x[2], x[3]), x)
       }
       const res = then(
        seriesAll(x.slice(2), compile),
        args => me[x[1]](...args)
       )
       return wrapErrorCatch(res, x)
      }
      catch (err) {
       throw wrapRuntimeError(err, x)
      }
     }
     return seriesAll(x, compile)
    case typeof x === 'object' && x:
     return then(
      seriesAll(
       Object.entries(x),
       ([k, v]) => then(compile(v), val => [k, val])
      ),
      entries => Object.fromEntries(entries)
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

  function send(block, ...args) {
   return transport.send(block, args, { state })
  }

  function will(...blocks) {
   const stmts = blocks.length === 1 && blocks[0][0] === '@'
    ? blocks[0].slice(1)
    : blocks
   function fn(...a) {
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
   send,
   series,
   set,
   state,
   tap,
   to,
   transport,
   'try': tryBlock,
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

 const rootState = options.preservePrototype ? initialState : { ...initialState }
 const rootArgv = Array.isArray(options.argv) ? options.argv : []
 return createScope(rootState, rootArgv)
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
     chr === 'r' ? '\r' :
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

export const PRIMITIVE_TYPES = ['string', 'number', 'boolean', 'null', 'undefined']

export const LANE_TABS = ['source', 'input', 'scope', 'data', 'view']
export const DEFAULT_LANE_TAB = 'source'

export function normalizeLaneTab(tab) {
 if (typeof tab === 'string') {
  const lower = tab.trim().toLowerCase()
  if (LANE_TABS.includes(lower)) {
   return lower
  }
 }
 return DEFAULT_LANE_TAB
}

function safeDecodeURIComponent(value) {
 try {
  return decodeURIComponent(value)
 }
 catch {
  return value
 }
}

function parseTabAndSubroute(rawTab) {
 const raw = String(rawTab ?? '')
 const pipeIdx = raw.indexOf('|')
 if (pipeIdx !== -1) {
  const tab = normalizeLaneTab(safeDecodeURIComponent(raw.slice(0, pipeIdx)))
  const subroute = safeDecodeURIComponent(raw.slice(pipeIdx + 1))
  return { tab, subroute: tab === 'data' && subroute.length > 0 ? subroute : '' }
 }
 const encodedPipe = /^(.*)%7[cC](.*)$/.exec(raw)
 if (encodedPipe) {
  const tab = normalizeLaneTab(safeDecodeURIComponent(encodedPipe[1]))
  const subroute = safeDecodeURIComponent(encodedPipe[2])
  return { tab, subroute: tab === 'data' && subroute.length > 0 ? subroute : '' }
 }
 return { tab: normalizeLaneTab(safeDecodeURIComponent(raw)), subroute: '' }
}

export function parseLaneRouteSegment(segment) {
 if (typeof segment !== 'string' || segment.length === 0) {
  return null
 }
 const semiIdx = segment.lastIndexOf(';')
 if (semiIdx !== -1) {
  const rawId = segment.slice(0, semiIdx)
  const rawTab = segment.slice(semiIdx + 1)
  const id = safeDecodeURIComponent(rawId)
  if (id.length === 0) {
   return null
  }
  const { tab, subroute } = parseTabAndSubroute(rawTab)
  return subroute ? { id, tab, subroute } : { id, tab }
 }
 const encodedMatch = /^(.*)%3[bB]([^%]*)$/.exec(segment)
 if (encodedMatch) {
  const { tab, subroute } = parseTabAndSubroute(encodedMatch[2])
  const candidateTab = encodedMatch[2].split('|')[0].trim().toLowerCase()
  if (LANE_TABS.includes(candidateTab)) {
   const id = safeDecodeURIComponent(encodedMatch[1])
   if (id.length > 0) {
    return subroute ? { id, tab, subroute } : { id, tab }
   }
  }
 }
 const id = safeDecodeURIComponent(segment)
 if (id.length === 0) {
  return null
 }
 return {
  id,
  tab: DEFAULT_LANE_TAB,
 }
}

export function parseLaneRoutes(pathname) {
 if (typeof pathname !== 'string' || pathname.length === 0) {
  return []
 }
 const clean = pathname.split('?')[0].split('#')[0]
 const segments = clean.split('/').filter(Boolean)
 const routes = []
 for (const seg of segments) {
  const parsed = parseLaneRouteSegment(seg)
  if (parsed) {
   routes.push(parsed)
  }
 }
 return routes
}

export function formatLaneRouteSegment(id, tab = DEFAULT_LANE_TAB, subroute = '') {
 const encodedId = encodeURIComponent(String(id ?? ''))
 const normalizedTab = normalizeLaneTab(tab)
 if (normalizedTab === DEFAULT_LANE_TAB) {
  return encodedId
 }
 if (normalizedTab === 'data' && typeof subroute === 'string' && subroute.length > 0) {
  return `${encodedId};data|${encodeURIComponent(subroute)}`
 }
 return `${encodedId};${normalizedTab}`
}

function getLaneDataSubroute(item) {
 const dv = item.notebook && item.notebook['data-view']
 if (dv && Array.isArray(dv.tables) && dv['active-table-id']) {
  const active = dv.tables.find(tbl => tbl && tbl.id === dv['active-table-id'])
  if (active && typeof active.name === 'string' && active.name.length > 0) {
   return active.name
  }
 }
 return typeof item.subroute === 'string' ? item.subroute : ''
}

export function formatLaneRoutes(lanes) {
 if (!Array.isArray(lanes) || lanes.length === 0) {
  return '/'
 }
 const segments = []
 for (const item of lanes) {
  if (typeof item === 'string') {
   if (item.length > 0) {
    segments.push(formatLaneRouteSegment(item, DEFAULT_LANE_TAB))
   }
   continue
  }
  if (!item || typeof item !== 'object' || !item.id) {
   continue
  }
  const tab = item.notebook && typeof item.notebook['active-tab'] === 'string'
   ? item.notebook['active-tab']
   : item.tab
  const subroute = normalizeLaneTab(tab) === 'data' ? getLaneDataSubroute(item) : ''
  segments.push(formatLaneRouteSegment(item.id, tab, subroute))
 }
 return `/${segments.join('/')}`
}

const UNSAFE_HASH_KEYS = new Set(['__proto__', 'constructor', 'prototype'])

function isPlainObject(value) {
 if (value === null || typeof value !== 'object' || Array.isArray(value)) {
  return false
 }
 const proto = Object.getPrototypeOf(value)
 return proto === Object.prototype || proto === null
}

function parseHashOptionValue(rawValue) {
 const decoded = safeDecodeURIComponent(rawValue)
 if (/^-?\d+(?:\.\d+)?$/.test(decoded)) {
  const num = Number(decoded)
  if (Number.isFinite(num)) {
   return num
  }
 }
 if (decoded === 'true') {
  return true
 }
 if (decoded === 'false') {
  return false
 }
 if (decoded === 'null') {
  return null
 }
 return decoded
}

export function parseHashOptions(hash) {
 const result = {}
 if (typeof hash !== 'string') {
  return result
 }
 const trimmed = hash.trim()
 const raw = trimmed.startsWith('#') ? trimmed.slice(1) : trimmed
 if (raw.length === 0) {
  return result
 }
 for (const part of raw.split('&')) {
  if (part.length === 0) {
   continue
  }
  const eqIdx = part.indexOf('=')
  const rawKey = eqIdx === -1 ? part : part.slice(0, eqIdx)
  const key = safeDecodeURIComponent(rawKey)
  if (key.length === 0) {
   continue
  }
  const segments = key.split('.').filter(Boolean)
  if (segments.length === 0 || segments.some(seg => UNSAFE_HASH_KEYS.has(seg))) {
   continue
  }
  const value = eqIdx === -1 ? true : parseHashOptionValue(part.slice(eqIdx + 1))
  let cursor = result
  for (let i = 0; i < segments.length - 1; i++) {
   const seg = segments[i]
   if (!isPlainObject(cursor[seg])) {
    cursor[seg] = {}
   }
   cursor = cursor[seg]
  }
  cursor[segments[segments.length - 1]] = value
 }
 return result
}

function collectHashOptionPairs(obj, prefix, pairs) {
 for (const key of Object.keys(obj)) {
  if (UNSAFE_HASH_KEYS.has(key)) {
   continue
  }
  const value = obj[key]
  if (value === undefined) {
   continue
  }
  const path = prefix.length > 0 ? `${prefix}.${encodeURIComponent(key)}` : encodeURIComponent(key)
  if (isPlainObject(value)) {
   collectHashOptionPairs(value, path, pairs)
  }
  else {
   pairs.push(`${path}=${encodeURIComponent(String(value))}`)
  }
 }
}

export function formatHashOptions(options) {
 if (!isPlainObject(options)) {
  return ''
 }
 const pairs = []
 collectHashOptionPairs(options, '', pairs)
 return pairs.length > 0 ? `#${pairs.join('&')}` : ''
}

export function normalizePrimitiveType(type) {
 return PRIMITIVE_TYPES.includes(type) ? type : 'string'
}

export function defaultValueForType(type) {
 switch (type) {
  case 'number':
   return 0
  case 'boolean':
   return false
  case 'null':
   return null
  case 'undefined':
   return undefined
  case 'string':
  default:
   return ''
 }
}

export const DATA_COLUMN_TYPES = [
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
]

export const DEFAULT_FIXED_DECIMALS = 2
export const DEFAULT_ROW_PICKER_PAGE_SIZE = 25
export const MIN_COLUMN_WIDTH = 48
export const MAX_COLUMN_WIDTH = 1200
const MAX_FIXED_DECIMALS = 12
const MAX_SAFE_BIGINT = BigInt(Number.MAX_SAFE_INTEGER)
const MIN_SAFE_BIGINT = BigInt(Number.MIN_SAFE_INTEGER)

export function normalizeColumnWidth(width) {
 if (width === null || width === undefined || width === '') {
  return null
 }
 const num = typeof width === 'number' ? width : Number(String(width).replace(/px$/i, '').trim())
 if (!Number.isFinite(num) || num <= 0) {
  return null
 }
 return Math.min(MAX_COLUMN_WIDTH, Math.max(MIN_COLUMN_WIDTH, Math.round(num)))
}

export function normalizeFixedDecimals(decimals) {
 if (decimals === null || decimals === undefined || decimals === '') {
  return DEFAULT_FIXED_DECIMALS
 }
 if (typeof decimals === 'number') {
  if (!Number.isFinite(decimals)) {
   return DEFAULT_FIXED_DECIMALS
  }
  const n = Math.trunc(decimals)
  return Math.min(MAX_FIXED_DECIMALS, Math.max(0, n))
 }
 const trimmed = String(decimals).trim()
 if (!/^\d+$/.test(trimmed)) {
  return DEFAULT_FIXED_DECIMALS
 }
 const n = Number(trimmed)
 if (!Number.isFinite(n)) {
  return DEFAULT_FIXED_DECIMALS
 }
 return Math.min(MAX_FIXED_DECIMALS, Math.max(0, n))
}

function parseTypeString(raw) {
 const str = typeof raw === 'string' ? raw.trim() : ''
 const isArr = str.endsWith('[]')
 const body = isArr ? str.slice(0, -2) : str
 const fixedMatch = /^fixed\((\d+)\)$/.exec(body)
 if (fixedMatch) {
  return {
   type: 'fixed',
   multiple: isArr,
   decimals: normalizeFixedDecimals(fixedMatch[1]),
   hasDecimals: true,
  }
 }
 return {
  type: DATA_COLUMN_TYPES.includes(body) ? body : 'text',
  multiple: isArr,
  decimals: undefined,
  hasDecimals: false,
 }
}

function numberToPlainDecimalString(num) {
 const str = String(num)
 if (!/[eE]/.test(str)) {
  return str
 }
 const neg = str.startsWith('-')
 const unsigned = neg ? str.slice(1) : str
 const [coeff, expStr] = unsigned.split(/[eE]/)
 const exp = Number(expStr)
 const [intPart, fracPart = ''] = coeff.split('.')
 const digits = intPart + fracPart
 const pointPos = intPart.length + exp
 let out
 if (pointPos <= 0) {
  out = `0.${'0'.repeat(-pointPos)}${digits}`
 }
 else if (pointPos >= digits.length) {
  out = digits + '0'.repeat(pointPos - digits.length)
 }
 else {
  out = `${digits.slice(0, pointPos)}.${digits.slice(pointPos)}`
 }
 return neg ? `-${out}` : out
}

function scaleDecimalStringToFixed(rawStr, decimals, { allowRounding = false } = {}) {
 const dec = normalizeFixedDecimals(decimals)
 const trimmed = String(rawStr).trim()
 if (trimmed === '') {
  return { ok: true, value: null, error: null }
 }
 if (dec === 0 && !allowRounding) {
  if (!/^[+-]?\d+$/.test(trimmed)) {
   return { ok: false, value: null, error: 'Must be a whole number (0 decimal places)' }
  }
  const big = BigInt(trimmed)
  if (big > MAX_SAFE_BIGINT || big < MIN_SAFE_BIGINT) {
   return { ok: false, value: null, error: 'Value out of safe range' }
  }
  const num = Number(big)
  return { ok: true, value: num === 0 ? 0 : num, error: null }
 }
 const match = /^([+-]?)(?:(\d+)(?:\.(\d*))?|\.(\d+))$/.exec(trimmed)
 if (!match) {
  const unit = dec === 1 ? 'place' : 'places'
  return {
   ok: false,
   value: null,
   error: dec === 0 ? 'Must be a whole number (0 decimal places)' : `Must be a fixed-point number (up to ${dec} decimal ${unit})`,
  }
 }
 const neg = match[1] === '-'
 const intPart = match[2] ?? '0'
 const fracPart = match[3] ?? match[4] ?? ''
 if (!allowRounding && fracPart.length > dec) {
  const unit = dec === 1 ? 'place' : 'places'
  return { ok: false, value: null, error: `At most ${dec} decimal ${unit} allowed` }
 }
 let keptFrac
 let roundUp = false
 if (fracPart.length > dec) {
  keptFrac = fracPart.slice(0, dec)
  roundUp = Number(fracPart[dec]) >= 5
 }
 else {
  keptFrac = fracPart.padEnd(dec, '0')
 }
 const combined = `${intPart}${keptFrac}`.replace(/^0+(?=\d)/, '') || '0'
 let big = BigInt(combined)
 if (roundUp) {
  big += 1n
 }
 const signedBig = neg ? -big : big
 if (signedBig > MAX_SAFE_BIGINT || signedBig < MIN_SAFE_BIGINT) {
  return { ok: false, value: null, error: 'Value out of safe range' }
 }
 const value = Number(signedBig)
 return { ok: true, value: value === 0 ? 0 : value, error: null }
}

function formatFixedInteger(value, decimals) {
 if (value === null || value === undefined) {
  return ''
 }
 const num = typeof value === 'number' ? value : Number(value)
 if (!Number.isFinite(num)) {
  return ''
 }
 const intVal = Math.trunc(num)
 const dec = normalizeFixedDecimals(decimals)
 if (dec === 0) {
  return String(intVal === 0 ? 0 : intVal)
 }
 const neg = intVal < 0
 const digits = String(Math.abs(intVal)).padStart(dec + 1, '0')
 const splitAt = digits.length - dec
 const formatted = `${digits.slice(0, splitAt)}.${digits.slice(splitAt)}`
 return neg ? `-${formatted}` : formatted
}

function rescaleFixedInteger(value, fromDecimals, toDecimals) {
 if (value === null || value === undefined || value === '') {
  return null
 }
 const num = typeof value === 'number' ? value : Number(value)
 if (!Number.isFinite(num)) {
  return null
 }
 const intVal = Math.trunc(num)
 const fromDec = normalizeFixedDecimals(fromDecimals)
 const toDec = normalizeFixedDecimals(toDecimals)
 if (fromDec === toDec) {
  return Number.isSafeInteger(intVal) ? (intVal === 0 ? 0 : intVal) : null
 }
 const formatted = formatFixedInteger(intVal, fromDec)
 const scaled = scaleDecimalStringToFixed(formatted, toDec, { allowRounding: true })
 return scaled.ok ? scaled.value : null
}

export function normalizeDataColumnType(type) {
 if (typeof type === 'string') {
  return parseTypeString(type).type
 }
 if (type && typeof type === 'object' && typeof type.type === 'string') {
  return parseTypeString(type.type).type
 }
 return 'text'
}

export function parseColumnType(spec, multiple, decimals) {
 if (spec && typeof spec === 'object') {
  const parsed = parseTypeString(typeof spec.type === 'string' ? spec.type : 'text')
  const resolvedMultiple = multiple !== undefined ? Boolean(multiple) : Boolean(spec.multiple || parsed.multiple)
  if (parsed.type === 'fixed') {
   const resolvedDecimals = decimals !== undefined
    ? normalizeFixedDecimals(decimals)
    : spec.decimals !== undefined
     ? normalizeFixedDecimals(spec.decimals)
     : parsed.hasDecimals
      ? parsed.decimals
      : DEFAULT_FIXED_DECIMALS
   return {
    type: 'fixed',
    multiple: resolvedMultiple,
    decimals: resolvedDecimals,
   }
  }
  if (parsed.type === 'row') {
   return {
    type: 'row',
    multiple: resolvedMultiple,
    refTableId: typeof spec.refTableId === 'string' ? spec.refTableId : '',
    refColumnId: typeof spec.refColumnId === 'string' ? spec.refColumnId : '',
    refDisplayColumnId: typeof spec.refDisplayColumnId === 'string' ? spec.refDisplayColumnId : '',
   }
  }
  return {
   type: parsed.type,
   multiple: resolvedMultiple,
  }
 }
 const parsed = parseTypeString(spec)
 const resolvedMultiple = Boolean(multiple || parsed.multiple)
 if (parsed.type === 'fixed') {
  const resolvedDecimals = decimals !== undefined
   ? normalizeFixedDecimals(decimals)
   : parsed.hasDecimals
    ? parsed.decimals
    : DEFAULT_FIXED_DECIMALS
  return {
   type: 'fixed',
   multiple: resolvedMultiple,
   decimals: resolvedDecimals,
  }
 }
 if (parsed.type === 'row') {
  return {
   type: 'row',
   multiple: resolvedMultiple,
   refTableId: '',
   refColumnId: '',
   refDisplayColumnId: '',
  }
 }
 return {
  type: parsed.type,
  multiple: resolvedMultiple,
 }
}

export function dataValuesEqual(a, b) {
 if (a === b) {
  return true
 }
 if (typeof a === 'number' && typeof b === 'number' && Number.isNaN(a) && Number.isNaN(b)) {
  return true
 }
 if (a === null || b === null || a === undefined || b === undefined) {
  return false
 }
 if (typeof a === 'object' && typeof b === 'object') {
  try {
   return JSON.stringify(a) === JSON.stringify(b)
  }
  catch {
   return false
  }
 }
 return false
}

export function resolveRowValueSpec(tables, col, visited = new Set()) {
 if (!Array.isArray(tables) || !col || typeof col !== 'object') {
  return null
 }
 const refTableId = typeof col.refTableId === 'string' ? col.refTableId : ''
 const refColumnId = typeof col.refColumnId === 'string' ? col.refColumnId : ''
 if (!refTableId || !refColumnId) {
  return null
 }
 const visitKey = `${refTableId}:${refColumnId}`
 if (visited.has(visitKey)) {
  return null
 }
 const table = tables.find(t => t && t.id === refTableId)
 if (!table || !Array.isArray(table.columns)) {
  return null
 }
 const linkCol = table.columns.find(c => c && c.id === refColumnId)
 if (!linkCol) {
  return null
 }
 const parsed = parseColumnType(linkCol, false)
 if (parsed.type === 'row') {
  const nextVisited = new Set(visited)
  nextVisited.add(visitKey)
  return resolveRowValueSpec(tables, linkCol, nextVisited)
 }
 return parsed
}

export function resolveRowTarget(tables, col) {
 const refTableId = col && typeof col.refTableId === 'string' ? col.refTableId : ''
 const refColumnId = col && typeof col.refColumnId === 'string' ? col.refColumnId : ''
 const refDisplayColumnId = col && typeof col.refDisplayColumnId === 'string' ? col.refDisplayColumnId : ''
 const configured = Boolean(refTableId && refColumnId)
 const table = Array.isArray(tables) && refTableId
  ? tables.find(t => t && t.id === refTableId) || null
  : null
 const cols = table && Array.isArray(table.columns) ? table.columns : []
 const linkCol = refColumnId ? cols.find(c => c && c.id === refColumnId) || null : null
 const rawDisplayCol = refDisplayColumnId ? cols.find(c => c && c.id === refDisplayColumnId) || null : null
 const displayCol = rawDisplayCol && linkCol && rawDisplayCol.id !== linkCol.id ? rawDisplayCol : null
 const valueSpec = linkCol ? resolveRowValueSpec(tables, { refTableId, refColumnId }) : null
 const displaySpec = displayCol
  ? (displayCol.type === 'row'
   ? (resolveRowValueSpec(tables, displayCol) || parseColumnType(displayCol, false))
   : parseColumnType(displayCol, false))
  : null
 return {
  configured,
  valid: Boolean(table && linkCol && valueSpec),
  refTableId,
  refColumnId,
  refDisplayColumnId,
  table,
  linkCol,
  displayCol,
  valueSpec,
  displaySpec,
 }
}

export function formatColumnType(type, multiple, decimals, tables = null) {
 const parsed = parseColumnType(type, multiple, decimals)
 let base
 if (parsed.type === 'fixed') {
  base = `fixed(${parsed.decimals})`
 }
 else if (parsed.type === 'row') {
  const target = Array.isArray(tables) ? resolveRowTarget(tables, parsed) : null
  if (target && target.table && target.linkCol) {
   const tLabel = typeof target.table.name === 'string' && target.table.name.trim().length > 0
    ? target.table.name.trim()
    : target.table.id
   const cLabel = typeof target.linkCol.name === 'string' && target.linkCol.name.trim().length > 0
    ? target.linkCol.name.trim()
    : target.linkCol.id
   base = `row(${tLabel}.${cLabel})`
  }
  else {
   base = 'row'
  }
 }
 else {
  base = parsed.type
 }
 return parsed.multiple ? `${base}[]` : base
}

export function defaultDataValue(type, multiple, decimals) {
 const parsed = parseColumnType(type, multiple, decimals)
 if (parsed.multiple) {
  return []
 }
 switch (parsed.type) {
  case 'integer':
  case 'decimal':
  case 'fixed':
   return 0
  case 'boolean':
   return false
  case 'json':
  case 'row':
   return null
  case 'date':
  case 'datetime':
  case 'url':
  case 'email':
  case 'text':
  default:
   return ''
 }
}

export function parseCellValue(raw, type, decimals, tables = null) {
 const parsed = parseColumnType(type, false, decimals)
 const base = parsed.type
 switch (base) {
  case 'integer': {
   if (raw === null || raw === undefined) {
    return { ok: true, value: null, error: null }
   }
   if (typeof raw === 'number') {
    return Number.isSafeInteger(raw)
     ? { ok: true, value: raw, error: null }
     : { ok: false, value: null, error: 'Must be a whole integer' }
   }
   const trimmed = String(raw).trim()
   if (trimmed === '') {
    return { ok: true, value: null, error: null }
   }
   if (!/^[+-]?\d+$/.test(trimmed)) {
    return { ok: false, value: null, error: 'Must be a whole integer' }
   }
   const num = Number(trimmed)
   if (!Number.isSafeInteger(num)) {
    return { ok: false, value: null, error: 'Integer out of safe range' }
   }
   return { ok: true, value: num, error: null }
  }
  case 'decimal': {
   if (raw === null || raw === undefined) {
    return { ok: true, value: null, error: null }
   }
   if (typeof raw === 'number') {
    return Number.isFinite(raw)
     ? { ok: true, value: raw, error: null }
     : { ok: false, value: null, error: 'Must be a decimal number' }
   }
   const trimmed = String(raw).trim()
   if (trimmed === '') {
    return { ok: true, value: null, error: null }
   }
   const num = Number(trimmed)
   if (!Number.isFinite(num)) {
    return { ok: false, value: null, error: 'Must be a decimal number' }
   }
   return { ok: true, value: num, error: null }
  }
  case 'fixed': {
   if (raw === null || raw === undefined) {
    return { ok: true, value: null, error: null }
   }
   if (typeof raw === 'number') {
    if (!Number.isFinite(raw)) {
     return { ok: false, value: null, error: 'Must be a fixed-point number' }
    }
    return scaleDecimalStringToFixed(numberToPlainDecimalString(raw), parsed.decimals, { allowRounding: false })
   }
   return scaleDecimalStringToFixed(String(raw), parsed.decimals, { allowRounding: false })
  }
  case 'boolean': {
   if (typeof raw === 'boolean') {
    return { ok: true, value: raw, error: null }
   }
   if (typeof raw === 'string') {
    const lower = raw.trim().toLowerCase()
    if (lower === 'true' || lower === '1') {
     return { ok: true, value: true, error: null }
    }
    if (lower === 'false' || lower === '0' || lower === '') {
     return { ok: true, value: false, error: null }
    }
    return { ok: false, value: false, error: 'Must be true or false' }
   }
   return { ok: true, value: Boolean(raw), error: null }
  }
  case 'date': {
   const trimmed = raw === null || raw === undefined ? '' : String(raw).trim()
   if (trimmed === '') {
    return { ok: true, value: '', error: null }
   }
   if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return { ok: false, value: trimmed, error: 'Expected YYYY-MM-DD date' }
   }
   const [y, m, d] = trimmed.split('-').map(Number)
   const dt = new Date(Date.UTC(y, m - 1, d))
   if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) {
    return { ok: false, value: trimmed, error: 'Invalid calendar date' }
   }
   return { ok: true, value: trimmed, error: null }
  }
  case 'datetime': {
   const trimmed = raw === null || raw === undefined ? '' : String(raw).trim()
   if (trimmed === '') {
    return { ok: true, value: '', error: null }
   }
   if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})?$/.test(trimmed) || Number.isNaN(Date.parse(trimmed))) {
    return { ok: false, value: trimmed, error: 'Expected ISO date-time (YYYY-MM-DDTHH:mm)' }
   }
   return { ok: true, value: trimmed, error: null }
  }
  case 'url': {
   const trimmed = raw === null || raw === undefined ? '' : String(raw).trim()
   if (trimmed === '') {
    return { ok: true, value: '', error: null }
   }
   try {
    new URL(trimmed)
    return { ok: true, value: trimmed, error: null }
   }
   catch {
    return { ok: false, value: trimmed, error: 'Must be a valid URL (e.g. https://...)' }
   }
  }
  case 'email': {
   const trimmed = raw === null || raw === undefined ? '' : String(raw).trim()
   if (trimmed === '') {
    return { ok: true, value: '', error: null }
   }
   if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    return { ok: false, value: trimmed, error: 'Must be a valid email address' }
   }
   return { ok: true, value: trimmed, error: null }
  }
  case 'json': {
   if (raw === null || raw === undefined) {
    return { ok: true, value: null, error: null }
   }
   if (typeof raw !== 'string') {
    return { ok: true, value: raw, error: null }
   }
   const trimmed = raw.trim()
   if (trimmed === '') {
    return { ok: true, value: null, error: null }
   }
   try {
    return { ok: true, value: JSON.parse(trimmed), error: null }
   }
   catch {
    return { ok: false, value: null, error: 'Must be valid JSON' }
   }
  }
  case 'row': {
   if (raw === null || raw === undefined) {
    return { ok: true, value: null, error: null }
   }
   const valueSpec = tables ? resolveRowValueSpec(tables, parsed) : null
   if (valueSpec) {
    return parseCellValue(raw, valueSpec)
   }
   return { ok: true, value: raw, error: null }
  }
  case 'text':
  default:
   return { ok: true, value: raw === null || raw === undefined ? '' : String(raw), error: null }
 }
}

export function formatCellInputValue(value, type, decimals, tables = null) {
 const parsed = parseColumnType(type, false, decimals)
 const base = parsed.type
 if (base === 'boolean') {
  return Boolean(value)
 }
 if (value === null || value === undefined) {
  return ''
 }
 if (base === 'fixed') {
  return formatFixedInteger(value, parsed.decimals)
 }
 if (base === 'row') {
  const valueSpec = tables ? resolveRowValueSpec(tables, parsed) : null
  if (valueSpec) {
   return formatCellInputValue(value, valueSpec)
  }
  return String(value)
 }
 if (base === 'json') {
  try {
   return JSON.stringify(value)
  }
  catch {
   return String(value)
  }
 }
 return String(value)
}

function formatRowCellText(value, spec) {
 if (value === null || value === undefined) {
  return ''
 }
 const parsed = parseColumnType(spec, false)
 if (parsed.type === 'boolean') {
  return value ? 'true' : 'false'
 }
 return String(formatCellInputValue(value, parsed))
}

function coerceSingleDataValue(value, targetSpec, fromSpec = null, tables = null) {
 const parsed = typeof targetSpec === 'object' && targetSpec !== null ? targetSpec : parseColumnType(targetSpec, false)
 const effectiveFromSpec = fromSpec && fromSpec.type === 'row' && tables
  ? resolveRowValueSpec(tables, fromSpec)
  : fromSpec
 const base = parsed.type
 if (base === 'row') {
  if (value === null || value === undefined) {
   return null
  }
  const resolvedTarget = tables ? resolveRowValueSpec(tables, parsed) : null
  if (resolvedTarget) {
   if (value === '' && resolvedTarget.type !== 'text') {
    return null
   }
   return coerceSingleDataValue(value, resolvedTarget, effectiveFromSpec, tables)
  }
  return cloneDataValue(value)
 }
 if (base === 'fixed') {
  if (value === null || value === undefined || value === '') {
   return null
  }
  if (effectiveFromSpec && effectiveFromSpec.type === 'fixed') {
   return rescaleFixedInteger(value, effectiveFromSpec.decimals, parsed.decimals)
  }
  if (typeof value === 'boolean') {
   return value ? Number(10n ** BigInt(parsed.decimals)) : 0
  }
  if (typeof value === 'number') {
   if (!Number.isFinite(value)) {
    return null
   }
   if (!effectiveFromSpec && Number.isSafeInteger(value)) {
    return value === 0 ? 0 : value
   }
   const scaled = scaleDecimalStringToFixed(numberToPlainDecimalString(value), parsed.decimals, { allowRounding: true })
   return scaled.ok ? scaled.value : null
  }
  const scaled = scaleDecimalStringToFixed(String(value), parsed.decimals, { allowRounding: true })
  return scaled.ok ? scaled.value : null
 }
 let inputVal = value
 if (effectiveFromSpec && effectiveFromSpec.type === 'fixed' && value !== null && value !== undefined && value !== '') {
  if (base === 'boolean') {
   const num = Number(value)
   return Number.isFinite(num) ? num !== 0 : Boolean(value)
  }
  const formatted = formatFixedInteger(value, effectiveFromSpec.decimals)
  if (base === 'json') {
   return formatted === '' ? null : Number(formatted)
  }
  inputVal = formatted
 }
 switch (base) {
  case 'integer': {
   if (inputVal === null || inputVal === undefined || inputVal === '') {
    return null
   }
   if (typeof inputVal === 'boolean') {
    return inputVal ? 1 : 0
   }
   const num = Number(inputVal)
   return Number.isFinite(num) ? Math.trunc(num) : null
  }
  case 'decimal': {
   if (inputVal === null || inputVal === undefined || inputVal === '') {
    return null
   }
   if (typeof inputVal === 'boolean') {
    return inputVal ? 1 : 0
   }
   const num = Number(inputVal)
   return Number.isFinite(num) ? num : null
  }
  case 'boolean': {
   if (typeof inputVal === 'boolean') {
    return inputVal
   }
   if (typeof inputVal === 'string') {
    const lower = inputVal.trim().toLowerCase()
    return lower === 'true' || lower === '1'
   }
   return Boolean(inputVal)
  }
  case 'json': {
   if (inputVal === undefined) {
    return null
   }
   if (typeof inputVal === 'string') {
    const trimmed = inputVal.trim()
    if (trimmed === '') {
     return null
    }
    try {
     return JSON.parse(trimmed)
    }
    catch {
     return inputVal
    }
   }
   return inputVal
  }
  case 'date':
  case 'datetime':
  case 'url':
  case 'email':
  case 'text':
  default: {
   if (inputVal === null || inputVal === undefined) {
    return ''
   }
   if (typeof inputVal === 'object') {
    try {
     return JSON.stringify(inputVal)
    }
    catch {
     return String(inputVal)
    }
   }
   return String(inputVal)
  }
 }
}

export function coerceDataValue(value, type, multiple, fromType = null, tables = null) {
 const parsed = parseColumnType(type, multiple)
 const fromParsed = fromType ? parseColumnType(fromType) : null
 if (parsed.multiple) {
  if (Array.isArray(value)) {
   return value.map(item => coerceSingleDataValue(item, parsed, fromParsed, tables))
  }
  if (value === null || value === undefined || value === '') {
   return []
  }
  return [coerceSingleDataValue(value, parsed, fromParsed, tables)]
 }
 if (Array.isArray(value)) {
  return value.length > 0 ? coerceSingleDataValue(value[0], parsed, fromParsed, tables) : defaultDataValue(parsed, false)
 }
 return coerceSingleDataValue(value, parsed, fromParsed, tables)
}

export function checkColumnChangeImpact(table, colId, nextType, nextMultiple, nextDecimals, tables = null) {
 if (!table || !Array.isArray(table.columns) || !Array.isArray(table.rows) || table.rows.length === 0) {
  return { destructive: false, affectedRows: 0, reason: '' }
 }
 const col = table.columns.find(c => c && c.id === colId)
 if (!col) {
  return { destructive: false, affectedRows: 0, reason: '' }
 }
 const prevParsed = parseColumnType(col)
 const parsed = parseColumnType(nextType, nextMultiple, nextDecimals)
 const sameRowTarget = prevParsed.type !== 'row' || (
  prevParsed.refTableId === parsed.refTableId &&
  prevParsed.refColumnId === parsed.refColumnId
 )
 const sameType = prevParsed.type === parsed.type &&
  (parsed.type !== 'fixed' || prevParsed.decimals === parsed.decimals) &&
  sameRowTarget
 if (sameType && prevParsed.multiple === parsed.multiple) {
  return { destructive: false, affectedRows: 0, reason: '' }
 }
 if (prevParsed.multiple && !parsed.multiple) {
  let multiLoss = 0
  for (const row of table.rows) {
   const cur = row && row.values ? row.values[colId] : undefined
   if (Array.isArray(cur) && cur.length > 1) {
    multiLoss += 1
   }
  }
  if (multiLoss > 0) {
   const unit = multiLoss === 1 ? 'row has' : 'rows have'
   return {
    destructive: true,
    affectedRows: multiLoss,
    reason: `${multiLoss} ${unit} multiple values that will be truncated to the first item.`,
   }
  }
 }
 const unresolvedRowTarget = parsed.type === 'row' && !resolveRowValueSpec(tables, parsed)
 if (!sameType && !unresolvedRowTarget) {
  let changed = 0
  for (const row of table.rows) {
   const cur = row && row.values ? row.values[colId] : undefined
   const nextVal = coerceDataValue(cur, parsed, parsed.multiple, prevParsed, tables)
   if (JSON.stringify(cur) !== JSON.stringify(nextVal)) {
    changed += 1
   }
  }
  if (changed > 0) {
   const unit = changed === 1 ? 'row has' : 'rows have'
   return {
    destructive: true,
    affectedRows: changed,
    reason: `${changed} ${unit} existing values that will be converted and may lose data.`,
   }
  }
 }
 return { destructive: false, affectedRows: 0, reason: '' }
}

function cloneDataValue(value) {
 if (value === null || value === undefined || typeof value !== 'object') {
  return value
 }
 try {
  return JSON.parse(JSON.stringify(value))
 }
 catch {
  return value
 }
}

export function parseStoredTables(stored) {
 if (stored === null || stored === undefined) {
  return []
 }
 let raw = stored
 if (typeof stored === 'string') {
  if (!stored.trim().startsWith('[')) {
   return []
  }
  try {
   raw = JSON.parse(stored)
  }
  catch {
   return []
  }
 }
 if (!Array.isArray(raw)) {
  return []
 }
 const out = []
 const rawRowsPerTable = []
 for (let t = 0; t < raw.length; t++) {
  const item = raw[t]
  if (!item || typeof item !== 'object') {
   continue
  }
  const tableId = typeof item.id === 'string' && item.id.length > 0 ? item.id : `tbl-${t + 1}`
  const tableName = item.name === null || item.name === undefined ? '' : String(item.name)
  const columns = []
  const rawCols = Array.isArray(item.columns) ? item.columns : []
  for (let c = 0; c < rawCols.length; c++) {
   const col = rawCols[c]
   if (!col || typeof col !== 'object') {
    continue
   }
   const colId = typeof col.id === 'string' && col.id.length > 0 ? col.id : `col-${t + 1}-${c + 1}`
   const colName = col.name === null || col.name === undefined ? '' : String(col.name)
   const parsedType = parseColumnType(col)
   const normalizedCol = {
    id: colId,
    name: colName,
    type: parsedType.type,
    multiple: parsedType.multiple,
   }
   if (parsedType.type === 'fixed') {
    normalizedCol.decimals = parsedType.decimals
   }
   else if (parsedType.type === 'row') {
    normalizedCol.refTableId = parsedType.refTableId
    normalizedCol.refColumnId = parsedType.refColumnId
    normalizedCol.refDisplayColumnId = parsedType.refDisplayColumnId
   }
   const width = normalizeColumnWidth(col.width)
   if (width !== null) {
    normalizedCol.width = width
   }
   columns.push(normalizedCol)
  }
  out.push({ id: tableId, name: tableName, columns, rows: [] })
  rawRowsPerTable.push(Array.isArray(item.rows) ? item.rows : [])
 }
 for (let t = 0; t < out.length; t++) {
  const table = out[t]
  const rawRows = rawRowsPerTable[t]
  for (let r = 0; r < rawRows.length; r++) {
   const row = rawRows[r]
   if (!row || typeof row !== 'object') {
    continue
   }
   const rowId = typeof row.id === 'string' && row.id.length > 0 ? row.id : `row-${t + 1}-${r + 1}`
   const rawValues = row.values && typeof row.values === 'object' ? row.values : {}
   const values = {}
   for (const col of table.columns) {
    if (Object.hasOwn(rawValues, col.id)) {
     values[col.id] = coerceDataValue(rawValues[col.id], col, col.multiple, null, out)
    }
    else {
     values[col.id] = defaultDataValue(col, col.multiple)
    }
   }
   table.rows.push({ id: rowId, values })
  }
 }
 return out
}

export function lookupRowDisplay(tables, col, value) {
 const target = resolveRowTarget(tables, col)
 const tableName = target.table ? (String(target.table.name || '').trim() || target.table.id) : ''
 const linkColName = target.linkCol ? (String(target.linkCol.name || '').trim() || target.linkCol.id) : ''
 const displayColName = target.displayCol ? (String(target.displayCol.name || '').trim() || target.displayCol.id) : ''
 const isEmpty = value === null || value === undefined
 if (isEmpty) {
  return {
   configured: target.configured,
   valid: target.valid,
   isEmpty: true,
   found: false,
   hasSeparateDisplay: Boolean(target.displayCol),
   value: null,
   valueText: '',
   displayText: '',
   label: '',
   tableName,
   linkColName,
   displayColName,
  }
 }
 const valueText = target.valueSpec ? formatRowCellText(value, target.valueSpec) : String(value)
 if (!target.valid) {
  return {
   configured: target.configured,
   valid: false,
   isEmpty: false,
   found: false,
   hasSeparateDisplay: false,
   value,
   valueText,
   displayText: '',
   label: valueText,
   tableName,
   linkColName,
   displayColName,
  }
 }
 let matchedRow = null
 const rows = Array.isArray(target.table.rows) ? target.table.rows : []
 for (let i = 0; i < rows.length; i++) {
  const row = rows[i]
  if (!row || !row.values) {
   continue
  }
  if (dataValuesEqual(row.values[target.linkCol.id], value)) {
   matchedRow = row
   break
  }
 }
 const found = Boolean(matchedRow)
 const hasSeparateDisplay = Boolean(target.displayCol)
 let displayText = ''
 if (found && target.displayCol && target.displaySpec && Object.hasOwn(matchedRow.values, target.displayCol.id)) {
  displayText = formatRowCellText(matchedRow.values[target.displayCol.id], target.displaySpec)
 }
 const label = hasSeparateDisplay && displayText.length > 0 ? `${displayText} (${valueText})` : valueText
 return {
  configured: target.configured,
  valid: true,
  isEmpty: false,
  found,
  hasSeparateDisplay,
  value,
  valueText,
  displayText,
  label,
  tableName,
  linkColName,
  displayColName,
 }
}

export async function fetchRowOptionsPage(tables, col, options = {}) {
 await Promise.resolve()
 const rawOffset = Number(options && options.offset)
 const rawLimit = Number(options && options.limit)
 const offset = Number.isFinite(rawOffset) && rawOffset >= 0 ? Math.trunc(rawOffset) : 0
 const limit = Number.isFinite(rawLimit) && rawLimit >= 1 ? Math.trunc(rawLimit) : DEFAULT_ROW_PICKER_PAGE_SIZE
 const target = resolveRowTarget(tables, col)
 if (!target || !target.valid) {
  return {
   ok: false,
   error: 'Linked table or column not found',
   items: [],
   offset: 0,
   limit,
   nextOffset: 0,
   hasMore: false,
   total: 0,
  }
 }
 const rows = Array.isArray(target.table.rows) ? target.table.rows : []
 const total = rows.length
 const start = Math.min(offset, total)
 const end = Math.min(total, start + limit)
 const items = []
 for (let i = start; i < end; i++) {
  const row = rows[i]
  if (!row || !row.values || !Object.hasOwn(row.values, target.linkCol.id)) {
   continue
  }
  const rawVal = row.values[target.linkCol.id]
  if (rawVal === null || rawVal === undefined) {
   continue
  }
  const valueText = formatRowCellText(rawVal, target.valueSpec)
  let displayText = ''
  if (target.displayCol && target.displaySpec && Object.hasOwn(row.values, target.displayCol.id)) {
   displayText = formatRowCellText(row.values[target.displayCol.id], target.displaySpec)
  }
  const hasSeparateDisplay = Boolean(target.displayCol && displayText.length > 0)
  const label = hasSeparateDisplay ? `${displayText} (${valueText})` : valueText
  items.push({
   rowId: row.id,
   rowIndex: i,
   value: cloneDataValue(rawVal),
   valueText,
   displayText,
   hasSeparateDisplay,
   label,
   searchText: `${displayText} ${valueText}`.trim().toLowerCase(),
  })
 }
 return {
  ok: true,
  error: null,
  items,
  offset: start,
  limit,
  nextOffset: end,
  hasMore: end < total,
  total,
 }
}

export function filterRowOptions(items, query = '') {
 const list = Array.isArray(items) ? items : []
 const q = String(query ?? '').trim().toLowerCase()
 if (q.length === 0) {
  return list.slice()
 }
 return list.filter(item => item && typeof item.searchText === 'string' && item.searchText.includes(q))
}

export function buildTablesScope(tables) {
 const out = {}
 if (!Array.isArray(tables)) {
  return out
 }
 for (const table of tables) {
  if (!table || typeof table !== 'object') {
   continue
  }
  const tableName = typeof table.name === 'string' ? table.name.trim() : ''
  if (tableName.length === 0) {
   continue
  }
  const cols = Array.isArray(table.columns) ? table.columns : []
  const rows = Array.isArray(table.rows) ? table.rows : []
  out[tableName] = rows.map(row => {
   const record = {}
   const values = row && row.values && typeof row.values === 'object' ? row.values : {}
   for (const col of cols) {
    const colName = col && typeof col.name === 'string' ? col.name.trim() : ''
    if (colName.length === 0) {
     continue
    }
    const val = Object.hasOwn(values, col.id) ? values[col.id] : defaultDataValue(col, col.multiple)
    record[colName] = cloneDataValue(val)
   }
   return record
  })
 }
 return out
}

export function isExpandableValue(value) {
 return value !== null && (typeof value === 'object' || typeof value === 'function')
}

function safePrettyJson(value) {
 try {
  const json = JSON.stringify(value, null, 2)
  return json === undefined ? formatValue(value) : json
 }
 catch {
  return formatValue(value)
 }
}

function truncateText(text, maxLen = 36) {
 return text.length > maxLen ? `${text.slice(0, maxLen - 1)}…` : text
}

export function describeValue(value) {
 if (value === null) {
  return { type: 'null', summary: 'null', detail: 'null', expandable: false }
 }
 if (value === undefined) {
  return { type: 'undefined', summary: 'undefined', detail: 'undefined', expandable: false }
 }
 const t = typeof value
 if (t === 'boolean') {
  const text = String(value)
  return { type: 'boolean', summary: text, detail: text, expandable: false }
 }
 if (t === 'number') {
  const text = Object.is(value, -0) ? '-0' : Number.isNaN(value) ? 'NaN' : String(value)
  return { type: 'number', summary: text, detail: text, expandable: false }
 }
 if (t === 'bigint') {
  const text = `${value}n`
  return { type: 'bigint', summary: text, detail: text, expandable: false }
 }
 if (t === 'symbol') {
  const text = String(value)
  return { type: 'symbol', summary: truncateText(text), detail: text, expandable: false }
 }
 if (t === 'string') {
  const full = JSON.stringify(value)
  return { type: 'string', summary: truncateText(full), detail: full, expandable: false }
 }
 if (t === 'function') {
  const summary = value.name ? `fn ${value.name}()` : 'fn()'
  return { type: 'function', summary, detail: formatValue(value), expandable: true }
 }
 if (Array.isArray(value)) {
  return {
   type: 'array',
   summary: `Array(${value.length})`,
   detail: safePrettyJson(value),
   expandable: true,
  }
 }
 if (value instanceof Date) {
  const text = Number.isNaN(value.getTime()) ? 'Invalid Date' : value.toISOString()
  return { type: 'date', summary: text, detail: text, expandable: true }
 }
 if (value instanceof RegExp) {
  const text = String(value)
  return { type: 'regexp', summary: text, detail: text, expandable: true }
 }
 if (value instanceof Map) {
  const text = `Map(${value.size})`
  return { type: 'map', summary: text, detail: text, expandable: true }
 }
 if (value instanceof Set) {
  const text = `Set(${value.size})`
  return { type: 'set', summary: text, detail: text, expandable: true }
 }
 const ctorName = value.constructor && typeof value.constructor.name === 'string' && value.constructor.name.length > 0
  ? value.constructor.name
  : 'Object'
 return {
  type: 'object',
  summary: ctorName,
  detail: safePrettyJson(value),
  expandable: true,
 }
}

function compareKeys(a, b, numericFirst = false) {
 if (numericFirst) {
  const aIdx = /^(0|[1-9]\d*)$/.test(a) ? Number(a) : null
  const bIdx = /^(0|[1-9]\d*)$/.test(b) ? Number(b) : null
  if (aIdx !== null && bIdx !== null) {
   return aIdx - bIdx
  }
  if (aIdx !== null) {
   return -1
  }
  if (bIdx !== null) {
   return 1
  }
 }
 const lowerCmp = a.toLowerCase().localeCompare(b.toLowerCase())
 return lowerCmp !== 0 ? lowerCmp : a.localeCompare(b)
}

function makeEntry(key, target, { inherited = false, enumerable = true, overrideValue, hasOverride = false } = {}) {
 try {
  const value = hasOverride ? overrideValue : target[key]
  const desc = describeValue(value)
  return {
   key,
   value,
   error: null,
   type: desc.type,
   summary: desc.summary,
   detail: desc.detail,
   expandable: desc.expandable,
   inherited,
   enumerable,
  }
 }
 catch (err) {
  const message = err instanceof Error ? err.message : String(err)
  return {
   key,
   value: undefined,
   error: message,
   type: 'error',
   summary: 'Error',
   detail: message,
   expandable: false,
   inherited,
   enumerable,
  }
 }
}

export function listScopeEntries(target, options = {}) {
 const { isRoot = false, argv = [] } = options
 if (!isExpandableValue(target)) {
  return []
 }

 if (isRoot) {
  const seen = new Set(['__proto__', 'argv'])
  const keys = []
  let cur = target
  while (cur && cur !== Object.prototype) {
   for (const key of Object.getOwnPropertyNames(cur)) {
    if (!seen.has(key)) {
     seen.add(key)
     keys.push(key)
    }
   }
   cur = Object.getPrototypeOf(cur)
  }
  keys.push('argv')
  keys.sort((a, b) => compareKeys(a, b, false))
  return keys.map(key =>
   key === 'argv'
    ? makeEntry(key, target, { inherited: false, enumerable: true, overrideValue: argv, hasOverride: true })
    : makeEntry(key, target, { inherited: false, enumerable: true })
  )
 }

 const isArr = Array.isArray(target)
 const seen = new Set(['__proto__'])
 if (typeof target === 'function') {
  seen.add('caller')
  seen.add('callee')
  seen.add('arguments')
 }

 const ownEnumKeys = []
 const ownNonEnumKeys = []
 for (const key of Object.getOwnPropertyNames(target)) {
  if (seen.has(key)) {
   continue
  }
  seen.add(key)
  const desc = Object.getOwnPropertyDescriptor(target, key)
  if (desc && desc.enumerable) {
   ownEnumKeys.push(key)
  }
  else {
   ownNonEnumKeys.push(key)
  }
 }
 ownEnumKeys.sort((a, b) => compareKeys(a, b, isArr))
 ownNonEnumKeys.sort((a, b) => compareKeys(a, b, false))

 const inheritedKeys = []
 let proto = Object.getPrototypeOf(target)
 while (proto && proto !== Object.prototype && proto !== Function.prototype) {
  for (const key of Object.getOwnPropertyNames(proto)) {
   if (seen.has(key)) {
    continue
   }
   seen.add(key)
   inheritedKeys.push(key)
  }
  proto = Object.getPrototypeOf(proto)
 }
 inheritedKeys.sort((a, b) => compareKeys(a, b, false))

 return [
  ...ownEnumKeys.map(key => makeEntry(key, target, { inherited: false, enumerable: true })),
  ...ownNonEnumKeys.map(key => makeEntry(key, target, { inherited: false, enumerable: false })),
  ...inheritedKeys.map(key => makeEntry(key, target, { inherited: true, enumerable: false })),
 ]
}

export function resolveScopeColumns(state, selectedPath = [], options = {}) {
 const rootState = state && typeof state === 'object' ? state : {}
 const pathList = Array.isArray(selectedPath) ? selectedPath : []
 const rootEntries = listScopeEntries(rootState, { isRoot: true, argv: options.argv ?? [] })
 const validPath = []
 const columns = [
  {
   kind: 'entries',
   title: 'scope',
   path: [],
   selectedKey: null,
   valueType: 'scope',
   valueSummary: `${rootEntries.length}`,
   valueDetail: '',
   entries: rootEntries,
  },
 ]

 let currentEntries = rootEntries
 for (let i = 0; i < pathList.length; i++) {
  const seg = String(pathList[i])
  const match = currentEntries.find(entry => entry.key === seg)
  if (!match) {
   break
  }
  columns[columns.length - 1].selectedKey = seg
  validPath.push(seg)
  const nextPath = validPath.slice()
  if (match.expandable && !match.error) {
   const childEntries = listScopeEntries(match.value, { isRoot: false })
   columns.push({
    kind: 'entries',
    title: seg,
    path: nextPath,
    selectedKey: null,
    valueType: match.type,
    valueSummary: match.summary,
    valueDetail: match.detail,
    entries: childEntries,
   })
   currentEntries = childEntries
  }
  else {
   columns.push({
    kind: 'value',
    title: seg,
    path: nextPath,
    selectedKey: null,
    value: match.value,
    valueType: match.type,
    valueSummary: match.summary,
    valueDetail: match.detail,
    error: match.error,
   })
   break
  }
 }

 return {
  path: validPath,
  columns,
 }
}

const RESERVED_BARE_WORDS = new Set(['true', 'false', 'null', 'undefined'])

function quoteFieldToken(value) {
 const str = String(value ?? '')
 if (
  str.length > 0 &&
  /^[A-Za-z0-9_][A-Za-z0-9_-]*$/.test(str) &&
  !str.includes('--') &&
  !RESERVED_BARE_WORDS.has(str)
 ) {
  const num = Number(str)
  if (!(Number.isFinite(num) && String(num) === str)) {
   return str
  }
 }
 const escaped = str
  .replace(/\\/g, '\\\\')
  .replace(/'/g, "\\'")
  .replace(/\n/g, '\\n')
  .replace(/\r/g, '\\r')
  .replace(/\t/g, '\\t')
 return `'${escaped}'`
}

export function formatImportLine(spec = {}) {
 const alias = String(spec.alias ?? '').trim()
 const laneId = String(spec.laneId ?? '').trim()
 const path = Array.isArray(spec.path) ? spec.path.map(seg => String(seg)) : []
 const args = [quoteFieldToken(laneId), ...path.map(quoteFieldToken)].join(' ')
 if (alias.length > 0) {
  return `; to ${quoteFieldToken(alias)} !importLane ${args}`
 }
 return `!importLane ${args}`
}

function isImportInvokeNode(node) {
 return (
  Array.isArray(node) &&
  node.length === 4 &&
  node[0] === '@' &&
  node[1] === 'invoke' &&
  Array.isArray(node[2]) &&
  node[3] === 'importLane' &&
  node[2].every(arg => typeof arg === 'string' || typeof arg === 'number')
 )
}

export function parseImportLine(source) {
 const text = String(source ?? '')
 if (text.trim().length === 0) {
  return null
 }
 try {
  const ast = parse(`${text}\n`)
  const stmts = ast.filter(node => !isCommentNode(node))
  if (stmts.length !== 1) {
   return null
  }
  const stmt = stmts[0]
  if (
   Array.isArray(stmt) &&
   stmt.length === 4 &&
   stmt[0] === '@' &&
   stmt[1] === 'to' &&
   typeof stmt[2] === 'string' &&
   isImportInvokeNode(stmt[3])
  ) {
   const args = stmt[3][2]
   return {
    alias: stmt[2],
    laneId: args.length > 0 ? String(args[0]) : '',
    path: args.slice(1).map(seg => String(seg)),
   }
  }
  if (isImportInvokeNode(stmt)) {
   const args = stmt[2]
   return {
    alias: '',
    laneId: args.length > 0 ? String(args[0]) : '',
    path: args.slice(1).map(seg => String(seg)),
   }
  }
  return null
 }
 catch {
  return null
 }
}

export function resolveScopePath(state, path = [], options = {}) {
 const segments = Array.isArray(path) ? path.map(seg => String(seg)) : []
 if (segments.length === 0) {
  return { found: false, value: undefined, error: 'No property selected to import' }
 }
 const root = segments[0]
 let cur
 try {
  if (root === 'argv') {
   cur = options.argv ?? []
  }
  else if (state && typeof state === 'object' && root in state) {
   cur = state[root]
  }
  else {
   return { found: false, value: undefined, error: `Property "$${root}" not found in target lane` }
  }
  for (let i = 1; i < segments.length; i++) {
   const seg = segments[i]
   if (cur === null || cur === undefined) {
    return {
     found: false,
     value: undefined,
     error: `Property "$${segments.join('.')}" not found in target lane`,
    }
   }
   const container = typeof cur === 'object' || typeof cur === 'function' ? cur : Object(cur)
   if (!(seg in container)) {
    return {
     found: false,
     value: undefined,
     error: `Property "$${segments.join('.')}" not found in target lane`,
    }
   }
   cur = cur[seg]
  }
  return { found: true, value: cur, error: null }
 }
 catch (err) {
  const message = err instanceof Error ? err.message : String(err)
  return { found: false, value: undefined, error: message }
 }
}

const LANE_EXPORT_EXCLUDED_KEYS = new Set(['argv', 'console', 'data', 'Date', 'importLane', 'JSON', 'Math'])

export function extractLaneExports(state) {
 const out = {}
 if (!state || typeof state !== 'object') {
  return out
 }
 const seen = new Set()
 let cur = state
 while (cur && cur !== Object.prototype) {
  for (const key of Object.keys(cur)) {
   if (seen.has(key) || LANE_EXPORT_EXCLUDED_KEYS.has(key)) {
    continue
   }
   seen.add(key)
   out[key] = state[key]
  }
  cur = Object.getPrototypeOf(cur)
 }
 return out
}

export function resolveImportValue(stateResult, path = []) {
 if (!stateResult || !stateResult.ok) {
  throw new Error(stateResult && stateResult.error ? stateResult.error : 'Target lane is not available')
 }
 const segments = Array.isArray(path) ? path.map(seg => String(seg)) : []
 if (segments.length === 0) {
  return extractLaneExports(stateResult.state)
 }
 const resolved = resolveScopePath(stateResult.state, segments)
 if (!resolved.found) {
  throw new Error(resolved.error || 'Imported property not found')
 }
 return resolved.value
}

export function createIdleTracker() {
 let activeCount = 0
 let completed = false
 let waiters = []
 return {
  get running() {
   return activeCount > 0
  },
  get hasCompleted() {
   return completed
  },
  isRunning() {
   return activeCount > 0
  },
  hasRun() {
   return completed
  },
  begin() {
   activeCount += 1
   let ended = false
   return (didComplete = true) => {
    if (ended) {
     return
    }
    ended = true
    activeCount = Math.max(0, activeCount - 1)
    if (didComplete) {
     completed = true
    }
    if (activeCount === 0 && waiters.length > 0) {
     const pending = waiters
     waiters = []
     for (const resolve of pending) {
      resolve()
     }
    }
   }
  },
  whenIdle() {
   if (activeCount === 0) {
    return Promise.resolve()
   }
   return new Promise(resolve => {
    waiters.push(resolve)
   })
  },
 }
}

export function hasImportCycle(activeTargets, fromId, targetId) {
 if (!fromId || !targetId) {
  return false
 }
 if (fromId === targetId) {
  return true
 }
 const visited = new Set([fromId])
 const stack = [targetId]
 while (stack.length > 0) {
  const cur = stack.pop()
  if (cur === fromId) {
   return true
  }
  if (visited.has(cur)) {
   continue
  }
  visited.add(cur)
  const next = activeTargets && activeTargets[cur]
  if (Array.isArray(next)) {
   for (const id of next) {
    stack.push(id)
   }
  }
  else if (typeof next === 'string' && next.length > 0) {
   stack.push(next)
  }
 }
 return false
}

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
 if (isTransportPacket(value)) {
  const num = (value.index ?? 0) + 1
  const count = value.ast.filter(node => !isCommentNode(node)).length
  const unit = count === 1 ? 'stmt' : 'stmts'
  return `[sent #${num} · ${count} ${unit}]`
 }
 try {
  const json = JSON.stringify(value)
  return json === undefined ? String(value) : json
 }
 catch {
  return String(value)
 }
}

export async function runTransportedScripts(packets, options = {}) {
 const {
  document: doc,
  window: win = doc && doc.defaultView ? doc.defaultView : undefined,
  console: cons = globalThis.console,
  output = null,
  extraEnv = {},
  isCancelled = null,
 } = options
 const browserGlobals = {
  ...extraEnv,
  console: cons,
  document: doc,
  window: win,
  Math: win && win.Math ? win.Math : Math,
  JSON: win && win.JSON ? win.JSON : JSON,
  Date: win && win.Date ? win.Date : Date,
  output,
 }
 const browserState = { ...browserGlobals }
 const browserGlobalKeys = new Set(Object.keys(browserGlobals))
 const results = []
 const list = Array.isArray(packets) ? packets : []

 for (let i = 0; i < list.length; i++) {
  if (typeof isCancelled === 'function' && isCancelled()) {
   break
  }
  const raw = list[i]
  try {
   const decoded = typeof raw === 'string'
    ? deserializeTransportPacket(raw)
    : raw && typeof raw.wire === 'string'
     ? deserializeTransportPacket(raw.wire)
     : deserializeTransportPacket(serializeTransportPacket(raw))
   const bindingKeys = new Set(Object.keys(decoded.bindings || {}))
   const scriptState = Object.create(browserState)
   for (const [k, v] of Object.entries(decoded.bindings || {})) {
    if (!browserGlobalKeys.has(k)) {
     scriptState[k] = v
    }
   }
   const runner = field(scriptState, { preservePrototype: true, argv: decoded.args || [] })
   const value = await runner.evalBlock(decoded.ast || [])
   if (typeof isCancelled === 'function' && isCancelled()) {
    break
   }
   for (const k of Object.keys(runner.state)) {
    if (!browserGlobalKeys.has(k) && !bindingKeys.has(k)) {
     browserState[k] = runner.state[k]
    }
   }
   let appended = false
   if (output && typeof output.appendChild === 'function' && isDomElement(value)) {
    output.appendChild(value)
    appended = true
   }
   results.push({
    index: decoded.index ?? i,
    lineNumber: decoded.lineNumber ?? null,
    value,
    preview: formatValue(value),
    appended,
    error: null,
   })
  }
  catch (err) {
   const message = err instanceof Error ? err.message : String(err)
   results.push({
    index: raw && typeof raw === 'object' && raw.index != null ? raw.index : i,
    lineNumber: raw && typeof raw === 'object' && raw.lineNumber != null ? raw.lineNumber : null,
    value: undefined,
    preview: message,
    appended: false,
    error: message,
   })
  }
 }

 return { results, state: browserState }
}

export async function runLines(lines, options = {}) {
 const { initialState = {}, filename = 'lane', transport = createTransport() } = options
 const runner = field(initialState, { transport })
 const results = []

 for (let i = 0; i < lines.length; i++) {
  const source = String(lines[i] ?? '')
  const lineNumber = i + 1
  if (typeof transport.setLineNumber === 'function') {
   transport.setLineNumber(lineNumber)
  }
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
   const ast = parse(`${source}\n`, filename, i)
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
   const stmts = ast.filter(node => !isCommentNode(node))
   if (stmts.length === 0) {
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
   let value
   if (stmts.length === 1) {
    value = await runner.compile(stmts[0])
   }
   else {
    value = []
    for (const stmt of stmts) {
     value.push(await runner.compile(stmt))
    }
   }
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
 if (typeof transport.setLineNumber === 'function') {
  transport.setLineNumber(null)
 }
 const sent = typeof transport.packets === 'function' ? transport.packets() : []
 return { results, state: runner.state, sent }
}
