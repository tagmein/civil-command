const SENTINEL_PREFIXES = [
 '__CC_CIVIL_MEMORY_READY__',
 '__CC_KV_READY__',
 '__CC_SYNC_OK__',
 '__CC_DEPLOY_OK__',
 '__CC_UNDEPLOY_OK__',
]

const ANSI_STRIP_RE = /\x1b(?:\[[0-9;?]*[ -/]*[@-~]|\][^\x07\x1b]*(?:\x07|\x1b\\)|[@-Z\\-_])/g

const FG_COLOR_NAMES = [
 'black', 'red', 'green', 'yellow', 'blue', 'magenta', 'cyan', 'white',
 'bright-black', 'bright-red', 'bright-green', 'bright-yellow',
 'bright-blue', 'bright-magenta', 'bright-cyan', 'bright-white',
]

export function stripAnsi(text) {
 return String(text || '').replace(ANSI_STRIP_RE, '')
}

const MAX_SENTINEL_WRAP_LINES = 16

function matchSentinelPrefix(line) {
 const trimmedStart = String(line || '').trimStart()
 for (const prefix of SENTINEL_PREFIXES) {
  if (trimmedStart.startsWith(`${prefix} `)) {
   return { prefix, rest: trimmedStart.slice(prefix.length + 1) }
  }
 }
 return null
}

function scanSentinelLines(lines, { allowIncomplete = false } = {}) {
 const events = []
 const total = lines.length
 for (let i = 0; i < total; i++) {
  const match = matchSentinelPrefix(lines[i])
  if (!match) {
   continue
  }
  let combined = match.rest
  let parsedData
  let parsed = false
  try {
   parsedData = JSON.parse(combined.trim())
   parsed = true
  }
  catch {
   // might be wrapped across subsequent PTY lines
  }
  if (parsed) {
   events.push({ type: match.prefix, data: parsedData })
   continue
  }
  let consumedTo = i
  let hitBoundary = false
  const limit = Math.min(total, i + 1 + MAX_SENTINEL_WRAP_LINES)
  for (let j = i + 1; j < limit; j++) {
   const nextLine = lines[j]
   if (!nextLine || nextLine.trim() === '' || matchSentinelPrefix(nextLine)) {
    hitBoundary = true
    break
   }
   combined += nextLine
   try {
    parsedData = JSON.parse(combined.trim())
    parsed = true
    consumedTo = j
    break
   }
   catch {
    // keep appending wrapped lines
   }
  }
  if (parsed) {
   events.push({ type: match.prefix, data: parsedData })
   i = consumedTo
  }
  else if (allowIncomplete && !hitBoundary && total - i <= MAX_SENTINEL_WRAP_LINES) {
   return { events, pendingFromIndex: i }
  }
 }
 return { events, pendingFromIndex: -1 }
}

export function extractSentinelEvents(text) {
 const clean = stripAnsi(text).replace(/\r\n/g, '\n').replace(/\r/g, '\n')
 const lines = clean.split('\n')
 return scanSentinelLines(lines, { allowIncomplete: false }).events
}

export function encodeKeyEventToVt(ev) {
 if (!ev || typeof ev !== 'object') {
  return ''
 }
 const key = typeof ev.key === 'string' ? ev.key : ''
 const ctrl = Boolean(ev.ctrlKey)
 const alt = Boolean(ev.altKey)
 const meta = Boolean(ev.metaKey)
 const shift = Boolean(ev.shiftKey)

 if (ctrl && !alt && !meta) {
  if (shift && (key === 'C' || key === 'c' || key === 'V' || key === 'v')) {
   return ''
  }
  if (/^[a-zA-Z]$/.test(key)) {
   const code = key.toUpperCase().charCodeAt(0) - 64
   return String.fromCharCode(code)
  }
  if (key === '[') { return '\x1b' }
  if (key === '\\') { return '\x1c' }
  if (key === ']') { return '\x1d' }
 }

 if (meta) {
  return ''
 }

 switch (key) {
  case 'Enter':
   return '\r'
  case 'Backspace':
   return '\x7f'
  case 'Tab':
   return '\t'
  case 'Escape':
   return '\x1b'
  case 'ArrowUp':
   return '\x1b[A'
  case 'ArrowDown':
   return '\x1b[B'
  case 'ArrowRight':
   return '\x1b[C'
  case 'ArrowLeft':
   return '\x1b[D'
  case 'Home':
   return '\x1b[H'
  case 'End':
   return '\x1b[F'
  case 'Delete':
   return '\x1b[3~'
  case 'PageUp':
   return '\x1b[5~'
  case 'PageDown':
   return '\x1b[6~'
  default:
   break
 }

 if (key.length === 1 && !ctrl) {
  return alt ? `\x1b${key}` : key
 }
 return ''
}

function defaultStyle() {
 return {
  fg: null,
  bg: null,
  bold: false,
  dim: false,
  underline: false,
  inverse: false,
 }
}

function cloneStyle(s) {
 return {
  fg: s.fg,
  bg: s.bg,
  bold: s.bold,
  dim: s.dim,
  underline: s.underline,
  inverse: s.inverse,
 }
}

function stylesEqual(a, b) {
 return (
  a.fg === b.fg &&
  a.bg === b.bg &&
  a.bold === b.bold &&
  a.dim === b.dim &&
  a.underline === b.underline &&
  a.inverse === b.inverse
 )
}

function makeEmptyRow() {
 return []
}

function rowToText(row) {
 if (!Array.isArray(row) || row.length === 0) {
  return ''
 }
 let out = ''
 for (let i = 0; i < row.length; i++) {
  const cell = row[i]
  out += cell && cell.ch ? cell.ch : ' '
 }
 return out.replace(/\s+$/, '')
}

function rowToSpans(row) {
 if (!Array.isArray(row) || row.length === 0) {
  return []
 }
 const spans = []
 let cur = null
 for (let i = 0; i < row.length; i++) {
  const cell = row[i]
  const ch = cell && cell.ch ? cell.ch : ' '
  const st = cell ? cell.style : defaultStyle()
  if (cur && stylesEqual(cur.style, st)) {
   cur.text += ch
  }
  else {
   cur = { text: ch, style: st }
   spans.push(cur)
  }
 }
 return spans
}

export function createTerminalBuffer({
 cols = 100,
 rows = 28,
 maxScrollback = 2000,
} = {}) {
 let curCols = Math.max(10, Math.trunc(Number(cols) || 100))
 let curRows = Math.max(4, Math.trunc(Number(rows) || 28))
 const scrollLimit = Math.max(50, Math.trunc(Number(maxScrollback) || 2000))

 let scrollback = []
 let screen = Array.from({ length: curRows }, makeEmptyRow)
 let cursorRow = 0
 let cursorCol = 0
 let savedCursor = { row: 0, col: 0 }
 let savedPrimary = null
 let style = defaultStyle()
 let pendingEsc = ''

 function ensureRow(r) {
  while (screen.length <= r) {
   screen.push(makeEmptyRow())
  }
  if (!screen[r]) {
   screen[r] = makeEmptyRow()
  }
  return screen[r]
 }

 function lineFeed() {
  if (cursorRow + 1 < curRows) {
   cursorRow += 1
  }
  else {
   const top = screen.shift() || makeEmptyRow()
   if (!savedPrimary) {
    scrollback.push(top)
    if (scrollback.length > scrollLimit) {
     scrollback.shift()
    }
   }
   screen.push(makeEmptyRow())
  }
 }

 function putChar(ch) {
  if (cursorCol >= curCols) {
   cursorCol = 0
   lineFeed()
  }
  const row = ensureRow(cursorRow)
  while (row.length < cursorCol) {
   row.push({ ch: ' ', style: defaultStyle() })
  }
  row[cursorCol] = { ch, style: cloneStyle(style) }
  cursorCol += 1
 }

 function applySgr(params) {
  const list = params.length === 0 ? [0] : params
  for (let i = 0; i < list.length; i++) {
   const code = list[i]
   if (code === 0) {
    style = defaultStyle()
   }
   else if (code === 1) { style.bold = true }
   else if (code === 2) { style.dim = true }
   else if (code === 4) { style.underline = true }
   else if (code === 7) { style.inverse = true }
   else if (code === 22) { style.bold = false; style.dim = false }
   else if (code === 24) { style.underline = false }
   else if (code === 27) { style.inverse = false }
   else if (code >= 30 && code <= 37) { style.fg = FG_COLOR_NAMES[code - 30] }
   else if (code === 39) { style.fg = null }
   else if (code >= 40 && code <= 47) { style.bg = FG_COLOR_NAMES[code - 40] }
   else if (code === 49) { style.bg = null }
   else if (code >= 90 && code <= 97) { style.fg = FG_COLOR_NAMES[8 + (code - 90)] }
   else if (code >= 100 && code <= 107) { style.bg = FG_COLOR_NAMES[8 + (code - 100)] }
   else if (code === 38 || code === 48) {
    const mode = list[i + 1]
    if (mode === 5) {
     const colorIdx = list[i + 2]
     if (typeof colorIdx === 'number' && colorIdx >= 0 && colorIdx < 16) {
      if (code === 38) { style.fg = FG_COLOR_NAMES[colorIdx] }
      else { style.bg = FG_COLOR_NAMES[colorIdx] }
     }
     i += 2
    }
    else if (mode === 2) {
     i += 4
    }
   }
  }
 }

 function handleCsi(body, finalChar) {
  const isPrivate = body.startsWith('?')
  const paramStr = isPrivate ? body.slice(1) : body
  const params = paramStr.length === 0
   ? []
   : paramStr.split(';').map(p => (p === '' ? 0 : Number.parseInt(p, 10) || 0))
  const p1 = params[0] || 0
  const p2 = params[1] || 0

  if (isPrivate) {
   if ((finalChar === 'h' || finalChar === 'l') && params.includes(1049)) {
    if (finalChar === 'h' && !savedPrimary) {
     savedPrimary = {
      screen: screen.map(r => r.slice()),
      cursorRow,
      cursorCol,
     }
     screen = Array.from({ length: curRows }, makeEmptyRow)
     cursorRow = 0
     cursorCol = 0
    }
    else if (finalChar === 'l' && savedPrimary) {
     screen = savedPrimary.screen
     cursorRow = Math.min(curRows - 1, savedPrimary.cursorRow)
     cursorCol = Math.min(curCols - 1, savedPrimary.cursorCol)
     savedPrimary = null
    }
   }
   return
  }

  switch (finalChar) {
   case 'm':
    applySgr(params)
    break
   case 'A':
    cursorRow = Math.max(0, cursorRow - (p1 || 1))
    break
   case 'B':
    cursorRow = Math.min(curRows - 1, cursorRow + (p1 || 1))
    break
   case 'C':
    cursorCol = Math.min(curCols - 1, cursorCol + (p1 || 1))
    break
   case 'D':
    cursorCol = Math.max(0, cursorCol - (p1 || 1))
    break
   case 'G':
    cursorCol = Math.max(0, Math.min(curCols - 1, (p1 || 1) - 1))
    break
   case 'd':
    cursorRow = Math.max(0, Math.min(curRows - 1, (p1 || 1) - 1))
    break
   case 'H':
   case 'f':
    cursorRow = Math.max(0, Math.min(curRows - 1, (p1 || 1) - 1))
    cursorCol = Math.max(0, Math.min(curCols - 1, (p2 || 1) - 1))
    break
   case 'J': {
    const mode = p1
    if (mode === 2 || mode === 3) {
     screen = Array.from({ length: curRows }, makeEmptyRow)
     if (mode === 3 && !savedPrimary) {
      scrollback = []
     }
     cursorRow = 0
     cursorCol = 0
    }
    else if (mode === 0) {
     const row = ensureRow(cursorRow)
     row.length = Math.min(row.length, cursorCol)
     for (let r = cursorRow + 1; r < screen.length; r++) {
      screen[r] = makeEmptyRow()
     }
    }
    else if (mode === 1) {
     for (let r = 0; r < cursorRow; r++) {
      screen[r] = makeEmptyRow()
     }
     const row = ensureRow(cursorRow)
     for (let c = 0; c <= cursorCol && c < row.length; c++) {
      row[c] = { ch: ' ', style: defaultStyle() }
     }
    }
    break
   }
   case 'K': {
    const mode = p1
    const row = ensureRow(cursorRow)
    if (mode === 0) {
     row.length = Math.min(row.length, cursorCol)
    }
    else if (mode === 1) {
     for (let c = 0; c <= cursorCol && c < row.length; c++) {
      row[c] = { ch: ' ', style: defaultStyle() }
     }
    }
    else if (mode === 2) {
     screen[cursorRow] = makeEmptyRow()
    }
    break
   }
   case 's':
    savedCursor = { row: cursorRow, col: cursorCol }
    break
   case 'u':
    cursorRow = Math.max(0, Math.min(curRows - 1, savedCursor.row))
    cursorCol = Math.max(0, Math.min(curCols - 1, savedCursor.col))
    break
   default:
    break
  }
 }

 function write(chunk) {
  const input = pendingEsc + String(chunk ?? '')
  pendingEsc = ''
  let i = 0
  while (i < input.length) {
   const ch = input[i]
   if (ch === '\x1b') {
    if (i + 1 >= input.length) {
     pendingEsc = input.slice(i)
     break
    }
    const next = input[i + 1]
    if (next === '[') {
     let j = i + 2
     while (j < input.length && (input.charCodeAt(j) < 0x40 || input.charCodeAt(j) > 0x7e)) {
      j += 1
     }
     if (j >= input.length) {
      pendingEsc = input.slice(i)
      break
     }
     handleCsi(input.slice(i + 2, j), input[j])
     i = j + 1
     continue
    }
    if (next === ']') {
     let j = i + 2
     let foundEnd = false
     while (j < input.length) {
      if (input[j] === '\x07') {
       i = j + 1
       foundEnd = true
       break
      }
      if (input[j] === '\x1b' && input[j + 1] === '\\') {
       i = j + 2
       foundEnd = true
       break
      }
      j += 1
     }
     if (!foundEnd) {
      pendingEsc = input.slice(i)
      break
     }
     continue
    }
    if (next === '(' || next === ')') {
     if (i + 2 >= input.length) {
      pendingEsc = input.slice(i)
      break
     }
     i += 3
     continue
    }
    i += 2
    continue
   }
   if (ch === '\r') {
    cursorCol = 0
    i += 1
    continue
   }
   if (ch === '\n') {
    lineFeed()
    i += 1
    continue
   }
   if (ch === '\b') {
    if (cursorCol > 0) {
     cursorCol -= 1
    }
    i += 1
    continue
   }
   if (ch === '\t') {
    const nextStop = Math.min(curCols - 1, (Math.floor(cursorCol / 8) + 1) * 8)
    while (cursorCol < nextStop) {
     putChar(' ')
    }
    i += 1
    continue
   }
   if (ch.charCodeAt(0) < 0x20) {
    i += 1
    continue
   }
   putChar(ch)
   i += 1
  }
 }

 function getActiveLastRow() {
  let last = cursorRow
  for (let r = screen.length - 1; r > last; r--) {
   if (screen[r] && screen[r].length > 0) {
    last = r
    break
   }
  }
  return last
 }

 function getRows() {
  const visible = screen.slice(0, getActiveLastRow() + 1)
  return savedPrimary ? visible : [...scrollback, ...visible]
 }

 function getRenderLines() {
  return getRows().map(row => rowToSpans(row))
 }

 function plainText() {
  return getRows().map(rowToText).join('\n')
 }

 function resize(nextCols, nextRows) {
  curCols = Math.max(10, Math.trunc(Number(nextCols) || curCols))
  curRows = Math.max(4, Math.trunc(Number(nextRows) || curRows))
  while (screen.length < curRows) {
   screen.push(makeEmptyRow())
  }
  if (screen.length > curRows) {
   const overflow = screen.length - curRows
   const moved = screen.splice(0, overflow)
   if (!savedPrimary) {
    for (const r of moved) {
     scrollback.push(r)
    }
    if (scrollback.length > scrollLimit) {
     scrollback = scrollback.slice(scrollback.length - scrollLimit)
    }
   }
  }
  cursorRow = Math.max(0, Math.min(curRows - 1, cursorRow))
  cursorCol = Math.max(0, Math.min(curCols - 1, cursorCol))
 }

 function clear() {
  scrollback = []
  screen = Array.from({ length: curRows }, makeEmptyRow)
  savedPrimary = null
  cursorRow = 0
  cursorCol = 0
  pendingEsc = ''
 }

 return {
  write,
  resize,
  clear,
  getRows,
  getRenderLines,
  plainText,
  getState: () => ({
   cols: curCols,
   rows: curRows,
   cursorRow,
   cursorCol,
   scrollbackCount: scrollback.length,
  }),
 }
}

function buildSpanClass(style) {
 const cls = ['cc-term-span']
 if (style.fg) { cls.push(`cc-ansi-fg-${style.fg}`) }
 if (style.bg) { cls.push(`cc-ansi-bg-${style.bg}`) }
 if (style.bold) { cls.push('cc-ansi-bold') }
 if (style.dim) { cls.push('cc-ansi-dim') }
 if (style.underline) { cls.push('cc-ansi-underline') }
 if (style.inverse) { cls.push('cc-ansi-inverse') }
 return cls.join(' ')
}

function clearElementChildren(el) {
 if (typeof el.replaceChildren === 'function') {
  el.replaceChildren()
  return
 }
 while (el.children && el.children.length > 0) {
  const prevLen = el.children.length
  const child = el.children[prevLen - 1]
  if (child && typeof child.remove === 'function') {
   child.remove()
  }
  if (el.children.length === prevLen) {
   el.children.pop()
  }
 }
 el.textContent = ''
}

function resolveWebSocketUrl(wsUrl, win) {
 const raw = String(wsUrl || '').trim()
 if (!raw) {
  return ''
 }
 if (raw.startsWith('ws://') || raw.startsWith('wss://')) {
  return raw
 }
 const loc = win && win.location ? win.location : (typeof location !== 'undefined' ? location : null)
 if (loc && loc.host) {
  const proto = loc.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${proto}//${loc.host}${raw.startsWith('/') ? raw : `/${raw}`}`
 }
 return `ws://localhost:8080${raw.startsWith('/') ? raw : `/${raw}`}`
}

export function mountTerminalView(container, options = {}) {
 const doc = options.document || (container && container.ownerDocument) || globalThis.document
 const win = options.window || (doc && doc.defaultView) || globalThis.window
 const WsCtor = options.WebSocketCtor || (win && win.WebSocket) || globalThis.WebSocket
 const buffer = createTerminalBuffer({
  cols: options.cols || 100,
  rows: options.rows || 28,
 })

 const screenEl = doc.createElement('div')
 screenEl.className = 'cc-term-screen'
 screenEl.tabIndex = 0
 screenEl.setAttribute('role', 'textbox')
 screenEl.setAttribute('aria-label', 'Interactive SSH Terminal')

 if (container && typeof container.appendChild === 'function') {
  container.appendChild(screenEl)
 }

 let ws = null
 let disconnected = false
 let renderPending = false
 let sentinelTail = ''

 function renderNow() {
  renderPending = false
  clearElementChildren(screenEl)
  const lines = buffer.getRenderLines()
  for (let i = 0; i < lines.length; i++) {
   const lineEl = doc.createElement('div')
   lineEl.className = 'cc-term-line'
   const spans = lines[i]
   if (spans.length === 0) {
    lineEl.textContent = ' '
   }
   else {
    for (const sp of spans) {
     const spanEl = doc.createElement('span')
     spanEl.className = buildSpanClass(sp.style)
     spanEl.textContent = sp.text
     lineEl.appendChild(spanEl)
    }
   }
   screenEl.appendChild(lineEl)
  }
  if (typeof screenEl.scrollHeight === 'number') {
   screenEl.scrollTop = screenEl.scrollHeight
  }
 }

 function scheduleRender() {
  if (win && typeof win.requestAnimationFrame === 'function') {
   if (!renderPending) {
    renderPending = true
    win.requestAnimationFrame(renderNow)
   }
  }
  else {
   renderNow()
  }
 }

 function scanSentinels(chunk, flush = false) {
  sentinelTail += String(chunk || '')
  let work = stripAnsi(sentinelTail).replace(/\r\n/g, '\n')
  if (flush) {
   work = work.replace(/\r/g, '\n')
  }
  else {
   work = work.replace(/\r(?!$)/g, '\n')
  }
  const hasTrailingCr = !flush && work.endsWith('\r')
  const inspectText = hasTrailingCr ? work.slice(0, -1) : work
  const hasNewline = inspectText.includes('\n')
  if (!flush && !hasNewline) {
   if (sentinelTail.length > 16384) {
    sentinelTail = sentinelTail.slice(-16384)
   }
   return
  }
  const lines = inspectText.split('\n')
  const endedWithNl = !hasTrailingCr && inspectText.endsWith('\n')
  const completeLines = (flush || endedWithNl) ? lines : lines.slice(0, -1)
  if (endedWithNl && completeLines.length > 0 && completeLines[completeLines.length - 1] === '') {
   completeLines.pop()
  }
  const { events, pendingFromIndex } = scanSentinelLines(completeLines, { allowIncomplete: !flush })
  if (events.length > 0 && typeof options.onSentinel === 'function') {
   for (const evt of events) {
    options.onSentinel(evt)
   }
  }
  if (flush) {
   sentinelTail = ''
   return
  }
  if (pendingFromIndex !== -1) {
   const tailLines = lines.slice(pendingFromIndex)
   sentinelTail = tailLines.join('\n') + (hasTrailingCr ? '\r' : '')
   return
  }
  sentinelTail = endedWithNl ? '' : (lines[lines.length - 1] + (hasTrailingCr ? '\r' : ''))
 }

 function feedOutput(chunk) {
  buffer.write(chunk)
  scanSentinels(chunk)
  scheduleRender()
 }

 function sendWsJson(payload) {
  if (ws && ws.readyState === 1) {
   ws.send(JSON.stringify(payload))
   return true
  }
  return false
 }

 function sendInput(data) {
  return sendWsJson({ type: 'input', data: String(data ?? '') })
 }

 function sendCtrlC() {
  return sendInput('\x03')
 }

 function resize(nextCols, nextRows) {
  buffer.resize(nextCols, nextRows)
  scheduleRender()
  return sendWsJson({
   type: 'resize',
   cols: Number(nextCols) || 100,
   rows: Number(nextRows) || 28,
  })
 }

 function clear() {
  buffer.clear()
  scheduleRender()
 }

 function focus() {
  if (typeof screenEl.focus === 'function') {
   screenEl.focus()
  }
 }

 function disconnect() {
  if (disconnected) {
   return
  }
  disconnected = true
  if (ws && typeof ws.close === 'function') {
   try {
    ws.close()
   }
   catch {
    // ignore close errors
   }
  }
 }

 screenEl.addEventListener('keydown', ev => {
  const seq = encodeKeyEventToVt(ev)
  if (!seq) {
   return
  }
  if (typeof ev.preventDefault === 'function') {
   ev.preventDefault()
  }
  if (typeof ev.stopPropagation === 'function') {
   ev.stopPropagation()
  }
  sendInput(seq)
 })

 screenEl.addEventListener('paste', ev => {
  const text = ev && ev.clipboardData && typeof ev.clipboardData.getData === 'function'
   ? ev.clipboardData.getData('text/plain')
   : ''
  if (!text) {
   return
  }
  if (typeof ev.preventDefault === 'function') {
   ev.preventDefault()
  }
  if (typeof ev.stopPropagation === 'function') {
   ev.stopPropagation()
  }
  sendInput(text)
 })

 screenEl.addEventListener('click', () => {
  focus()
 })

 if (options.wsUrl && typeof WsCtor === 'function') {
  const resolvedUrl = resolveWebSocketUrl(options.wsUrl, win)
  ws = new WsCtor(resolvedUrl)
  if (typeof options.onStatus === 'function') {
   options.onStatus({ status: 'connecting', exitCode: null })
  }
  const onOpen = () => {
   if (typeof options.onStatus === 'function') {
    options.onStatus({ status: 'running', exitCode: null })
   }
   const st = buffer.getState()
   sendWsJson({ type: 'resize', cols: st.cols, rows: st.rows })
  }
  const onMessage = ev => {
   const raw = ev && ev.data !== undefined ? ev.data : ev
   let msg
   try {
    msg = typeof raw === 'string' ? JSON.parse(raw) : raw
   }
   catch {
    return
   }
   if (!msg || typeof msg !== 'object') {
    return
   }
   if (msg.type === 'output' && typeof msg.data === 'string') {
    feedOutput(msg.data)
   }
   else if (msg.type === 'init') {
    if (typeof options.onStatus === 'function') {
     options.onStatus({
      status: msg.status || 'running',
      exitCode: msg.exitCode ?? null,
      title: msg.title || '',
     })
    }
   }
   else if (msg.type === 'status') {
    if (sentinelTail.trim().length > 0) {
     scanSentinels('', true)
    }
    if (typeof options.onStatus === 'function') {
     options.onStatus({
      status: msg.status || 'exited',
      exitCode: msg.exitCode ?? 0,
     })
    }
   }
  }
  const onError = () => {
   feedOutput('\r\n[WebSocket connection error]\r\n')
   if (typeof options.onStatus === 'function') {
    options.onStatus({ status: 'error', exitCode: null })
   }
  }
  const onClose = () => {
   if (typeof options.onClose === 'function') {
    options.onClose()
   }
  }
  if (typeof ws.addEventListener === 'function') {
   ws.addEventListener('open', onOpen)
   ws.addEventListener('message', onMessage)
   ws.addEventListener('error', onError)
   ws.addEventListener('close', onClose)
  }
  else {
   ws.onopen = onOpen
   ws.onmessage = onMessage
   ws.onerror = onError
   ws.onclose = onClose
  }
 }

 renderNow()

 return {
  element: screenEl,
  buffer,
  feedOutput,
  sendInput,
  sendCtrlC,
  resize,
  clear,
  getPlainText: () => buffer.plainText(),
  disconnect,
  focus,
 }
}
