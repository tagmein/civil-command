export function field(initialState={}) {
 let argv = []
 const state = { ...initialState }
 function get(a, ...p) {
  if (a === 'argv') {
  // console.log('got argv', argv)
   return argv
  }
  let v = state[a]
  for (const s of p) {
   if (v) {
    v = v[s]
   }
  }
  return v
 }
 function propertyIs(x, a, ...p) {
  let v = state[a]
  for (const s of p) {
   if (v) {
    v = v[s]
   }
  }
  return v === x
 }
 function propertyIsLessThan(x, a, ...p) {
  let v = state[a]
  for (const s of p) {
   if (v) {
    v = v[s]
   }
  }
  return v < x
 }
 function propertyIsGreaterThan(x, a, ...p) {
  let v = state[a]
  for (const s of p) {
   if (v) {
    v = v[s]
   }
  }
  return v > x
 }
 function propertyIsLessThanOrEqual(x, a, ...p) {
  let v = state[a]
  for (const s of p) {
   if (v) {
    v = v[s]
   }
  }
  return v <= x
 }
 function propertyIsGreaterThanOrEqual(x, a, ...p) {
  let v = state[a]
  for (const s of p) {
   if (v) {
    v = v[s]
   }
  }
  return v >= x
 }
 function series(...b) {
  return b.map(
   line =>
    line[0] === '@'
     ? me[line[1]](...line.slice(2))
     : line
  )
 }
 function to(a, ...c) {
  const b = c.pop()
  if (c.length === 0) {
   state[a] = b
   return
  }
  let v = state[a]
  const f = c.pop()
  for (const d of c) {
   v = v[d]
  }
  v[f] = b
 }
 function set(b, a, ...c) {
  if (c.length === 0) {
   state[a] = b
   return
  }
  let v = state[a]
  const f = c.pop()
  for (const d of c) {
   v = v[d]
  }
  v[f] = b
 }
 function invoke(b, a, ...c) {
  if (c.length === 0) {
   return state[a](...b)
  }
  let v = typeof a === 'string' ? state[a] : a
  if (!v) {
   throw new Error(`invokeProperty: ${JSON.stringify(a)} not found`)
  }
  const f = c.pop()
  for (const d of c) {
   v = v[d]
   if (!v) {
    throw new Error(`invokeProperty: ${JSON.stringify(d)} not found in ${[a, ...c].join('.')}`)
   }
  }
  // console.log('Final call', v, f, b)
  return v[f](...b)
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
 function condition([b, ...a], t) {
  if (me[b](...a)) {
   return t()
  }
 }
 
 function willInvoke(a, ...b) {
  return function (...d) {
   return me.get(...b)(...a, ...d)
  }
 }
 
 function willSeries(...b) {
  return function func(...a) {
   argv = a
   for (const [c, ...d] of b) {
    me[c](...d)
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

 async function compile(x) {
  switch (true) {
   case x && Array.isArray(x):
    if (x[0] === '@') {
     if (x[1] === '@') {
      return x.slice(1)
     }
     if (typeof me[x[1]] !== 'function') {
      // console.log({ me, x, x_1: x[1] })
      throw new Error(`${JSON.stringify(x[1])} is not a valid FieldScript command`)
     }
     if (x[1] === 'will') {
      return me[x[1]]([ '@', ...x.slice(2) ])
     }
     else {
      return me[x[1]](
       ...(await seriesAll(x.slice(2), compile))
      )
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
   case x && Array.isArray(x):
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
    return x.map(y => template(y, vars))
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
  return me.compile(me.template(program, vars))
 }

 async function load(scriptPath, vars = {}) {
  const scriptText = await (
   await fetch(scriptPath)
  ).text()
  const program = parse(scriptText)
  /*console.log(
   JSON.stringify(program, null, 1)
    .split('\n')
    .map((x, i) => `${i < 9 ? '   ' : i < 99 ? '  ' : i < 999 ? ' ' : ''}${i + 1}| ${x}`)
    .join('\n')
  )*/
  return me.run(program, vars)
 }
 
 function object() {
  return {}
 }
 
 function will(...blocks) {
  return async function (...a) {
   argv = a
   return blocks.length === 1 && blocks[0][0] === '@' ?
    seriesAll(blocks[0].slice(1), compile) :
    seriesAll(blocks, compile)
  }
 }

 const me = {
  add,
  subtract,
  multiply,
  divide,
  ternary,
  modulus,
  and,
  comment,
  condition,
  get,
  invoke,
  load,
  object,
  propertyIs,
  propertyIsLessThan,
  propertyIsGreaterThan,
  propertyIsLessThanOrEqual,
  propertyIsGreaterThanOrEqual,
  series,
  set,
  state,
  to,
  will,
  willInvoke,
  willSeries,
  compile,
  template,
  run
 }
 return me
}

export function parse(text) {
 const output = []
 const root = { block: output }
 const stack = [ root ]
 const length = text.length
 let scope = root
 let pendingWord = ''
 let inString = false
 let inEscape = false
 let inPatternDefinition = false
 let pattern = undefined
 let collectedPatternIndex = undefined
 function flushAutoBlock() {
  if (!scope.autoBlock) { throw new Error('no autoBlock') }
  scope.autoBlock = false
  if (scope.block[0] === 'list') {
   scope.block.shift()
  }
  else {
   if (scope.isDeferred) {
    scope.block.unshift('will')
   }
   scope.block.unshift('@')
  }
  stack.pop()
  scope = stack[stack.length - 1]
 }
 function flushPendingWord() {
  if (pendingWord.length > 0) {
   let pendingValue = pendingWord
   if (pendingValue.length < 6) {
    if (pendingValue === 'false') {
     pendingValue = false
    }
    else if (pendingValue === 'true') {
     pendingValue = true
    }
    else if (pendingValue === 'null') {
     pendingValue = null
    }
    else if (pendingValue === '=') {
     inPatternDefinition = true
     pattern = undefined
     collectedPatternIndex = scope.block.length
     pendingWord = ''
     return
    }
   }
   else if (pendingValue.length < 24) {
    if (pendingValue === 'undefined') {
     pendingValue = undefined
    }
    else {
     const anyFirstThreeNum = [0, 1, 2].some(
      x => Math.abs(
       pendingValue.charCodeAt(x) * 2 - 105
      ) <= 9
     )
     if (anyFirstThreeNum) {
      const integerCandidate = parseInt(pendingValue, 10)
      if (integerCandidate.toString(10) === pendingValue) {
       pendingValue = integerCandidate
      }
      else {
       const floatCandidate = parseFloat(pendingValue)
       if (floatCandidate.toString(10) === pendingValue) {
        pendingValue = floatCandidate
       }
      }
     }
    }
   }
   if (pattern) {
    sinceLastNewline.push(pendingValue)
   }
   else {
    scope.block.push(pendingValue)
   }
   pendingWord = ''
  }
 }
 
 function resolvePattern(x, vars) {
  switch (true) {
   case x && Array.isArray(x):
    return [ x.reduce(
     (init, y) => init.concat(resolvePattern(y, vars)), []
    ) ]
   case typeof x === 'object' && x:
    return [
     Object.fromEntries(
      Object.entries(x).map(
       ([k, v]) => [k, resolvePattern(v, vars)]
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
   default:
    return [ x ]
  }
 }
 
 function flushPatternLine(pattern, line) {
  const resolvedPattern = resolvePattern(pattern, [line, ...line])
  // console.log(JSON.stringify({resolvedPattern, vars: [line, ...line]}, null, 2))
  scope.block.push(...resolvedPattern)
 }
 
 let sinceLastNewline = []
 let row = 0
 let col = -1
 for (let i = 0 ; i < length ; i++) {
  col++
  function info() {
   return ` on line ${row + 1} at column ${col + 1}: ${text.substr(i - col, col)}`
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
     flushPendingWord()
     break
    default:
     pendingWord += chr
   }
   continue
  }
  switch (chr) {
   case "'":
    inString = true
    break
   case ';':
   case ':': {
    const isDeferred = chr === ':'
    flushPendingWord()
    const block = []
    scope.block.push(block)
    const autoScope = { block, autoBlock: true, isDeferred }
    stack.push(autoScope)
    scope = autoScope
    break
   }
   case '\n':
   case ',':
    if (chr === '\n') {
     row++
     col=-1
    }
    flushPendingWord()
    const line = sinceLastNewline
    sinceLastNewline = []
    while (scope.autoBlock) { flushAutoBlock() }
    if (inPatternDefinition) {
     inPatternDefinition = false
     pattern = scope.block.splice(collectedPatternIndex)
     if (pattern.length === 0) {
      pattern = undefined
     }
    }
    else if (pattern) {
     flushPatternLine(pattern, line) 
    }
    break
   case ' ':
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
    const branch = { block: inner, isDeferred, isList }
    stack.push(branch)
    scope = branch
    break
   case '}':
   case ']':
   case ')':
    if (stack.length < 2) {
     throw new Error(`no block is open, you are at output ${info()}`)
    }
    if (scope.autoBlock) { flushAutoBlock() }
    
    const expectedList = chr === '}'
    if (scope.isList ? !expectedList : expectedList) {
     throw new Error(`Block end mismatch: got ${chr}, expected ${
      scope.isList ? '{}' : scope.isDeferred ? ')' : ']'
     } ${info()}`)
    }
    const expectedDeferred = chr === ')'
    if (scope.isDeferred ? !expectedDeferred : expectedDeferred) {
     throw new Error(`Block end mismatch: got ${chr}, expected ${scope.isDeferred ? ')' : ']'} ${info()}`)
    }

    flushPendingWord()
    if (scope.block[0] === 'list') {
     scope.block.shift()
    }
    else {
     scope.block.unshift('@')
    }

    stack.pop()
    scope = stack[stack.length - 1]
    break
   default:
    pendingWord += chr
    break
  }
 }
 flushPendingWord()
 // console.log({ text, output })
 return output
}
