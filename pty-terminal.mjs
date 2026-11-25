import crypto from 'node:crypto'
import { spawn } from 'node:child_process'
import { EventEmitter } from 'node:events'

export const WS_MAGIC_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11'

const PTY_BRIDGE_SCRIPT = String.raw`
import errno, fcntl, os, pty, select, signal, struct, sys, termios

def set_winsz(fd, rows, cols):
 try:
  fcntl.ioctl(fd, termios.TIOCSWINSZ, struct.pack('HHHH', max(1, rows), max(1, cols), 0, 0))
 except Exception:
  pass

def write_all(fd, data):
 mv = memoryview(data)
 sent = 0
 while sent < len(mv):
  try:
   n = os.write(fd, mv[sent:])
   if n <= 0:
    break
   sent += n
  except BlockingIOError:
   select.select([], [fd], [], 0.05)
  except OSError:
   break

def main():
 argv = sys.argv[1:]
 if len(argv) < 4 or argv[2] != '--':
  sys.stderr.write('Invalid PTY bridge arguments\n')
  sys.exit(2)
 cols = int(argv[0])
 rows = int(argv[1])
 cmd = argv[3:]
 pid, master_fd = pty.fork()
 if pid == 0:
  os.environ.setdefault('TERM', 'xterm-256color')
  set_winsz(0, rows, cols)
  try:
   os.execvp(cmd[0], cmd)
  except Exception as exc:
   sys.stderr.write(f'Failed to exec {cmd[0]}: {exc}\n')
   os._exit(127)

 set_winsz(master_fd, rows, cols)
 def forward_term(_sig, _frame):
  try:
   os.kill(pid, signal.SIGTERM)
  except ProcessLookupError:
   pass
 signal.signal(signal.SIGTERM, forward_term)
 signal.signal(signal.SIGHUP, forward_term)

 stdin_open = True
 ctrl_open = True
 ctrl_buf = b''
 watch_fds = [master_fd, 0, 3]
 while True:
  rlist = [master_fd]
  if stdin_open:
   rlist.append(0)
  if ctrl_open:
   rlist.append(3)
  try:
   readable, _, _ = select.select(rlist, [], [], 0.25)
  except InterruptedError:
   continue
  if master_fd in readable:
   try:
    chunk = os.read(master_fd, 8192)
   except OSError as exc:
    if exc.errno in (errno.EIO, errno.EBADF):
     break
    raise
   if not chunk:
    break
   write_all(1, chunk)
  if 0 in readable:
   try:
    data = os.read(0, 4096)
   except OSError:
    data = b''
   if not data:
    stdin_open = False
   else:
    write_all(master_fd, data)
  if 3 in readable:
   try:
    cdata = os.read(3, 1024)
   except OSError:
    cdata = b''
   if not cdata:
    ctrl_open = False
   else:
    ctrl_buf += cdata
    while b'\n' in ctrl_buf:
     line, ctrl_buf = ctrl_buf.split(b'\n', 1)
     parts = line.decode('utf-8', 'ignore').strip().split()
     if len(parts) == 3 and parts[0] == 'R':
      try:
       next_cols = int(parts[1])
       next_rows = int(parts[2])
       set_winsz(master_fd, next_rows, next_cols)
       os.kill(pid, signal.SIGWINCH)
      except Exception:
       pass
     elif len(parts) == 2 and parts[0] == 'S':
      sig_name = parts[1].upper()
      sig_obj = getattr(signal, f'SIG{sig_name}', None)
      if sig_obj is not None:
       try:
        os.kill(pid, sig_obj)
       except ProcessLookupError:
        pass
 try:
  os.close(master_fd)
 except OSError:
  pass
 try:
  _, status = os.waitpid(pid, 0)
  if hasattr(os, 'waitstatus_to_exitcode'):
   code = os.waitstatus_to_exitcode(status)
  elif os.WIFEXITED(status):
   code = os.WEXITSTATUS(status)
  elif os.WIFSIGNALED(status):
   code = 128 + os.WTERMSIG(status)
  else:
   code = 1
 except ChildProcessError:
  code = 0
 sys.exit(code)

if __name__ == '__main__':
 main()
`

export function computeWebSocketAccept(key) {
 return crypto
  .createHash('sha1')
  .update(String(key || '').trim() + WS_MAGIC_GUID, 'utf8')
  .digest('base64')
}

export function encodeWsFrame(opcode, payload = Buffer.alloc(0)) {
 const body = Buffer.isBuffer(payload) ? payload : Buffer.from(String(payload ?? ''), 'utf8')
 const len = body.length
 let header
 if (len < 126) {
  header = Buffer.allocUnsafe(2)
  header[0] = 0x80 | (opcode & 0x0f)
  header[1] = len
 }
 else if (len <= 0xffff) {
  header = Buffer.allocUnsafe(4)
  header[0] = 0x80 | (opcode & 0x0f)
  header[1] = 126
  header.writeUInt16BE(len, 2)
 }
 else {
  header = Buffer.allocUnsafe(10)
  header[0] = 0x80 | (opcode & 0x0f)
  header[1] = 127
  header.writeBigUInt64BE(BigInt(len), 2)
 }
 return Buffer.concat([header, body])
}

export function parseWsFrames(buffer) {
 let offset = 0
 const frames = []
 while (offset + 2 <= buffer.length) {
  const b0 = buffer[offset]
  const b1 = buffer[offset + 1]
  const fin = Boolean(b0 & 0x80)
  const opcode = b0 & 0x0f
  const masked = Boolean(b1 & 0x80)
  let payloadLen = b1 & 0x7f
  let cursor = offset + 2

  if (payloadLen === 126) {
   if (cursor + 2 > buffer.length) {
    break
   }
   payloadLen = buffer.readUInt16BE(cursor)
   cursor += 2
  }
  else if (payloadLen === 127) {
   if (cursor + 8 > buffer.length) {
    break
   }
   const bigLen = buffer.readBigUInt64BE(cursor)
   if (bigLen > BigInt(16 * 1024 * 1024)) {
    throw new Error('WebSocket frame too large')
   }
   payloadLen = Number(bigLen)
   cursor += 8
  }

  let maskKey = null
  if (masked) {
   if (cursor + 4 > buffer.length) {
    break
   }
   maskKey = buffer.subarray(cursor, cursor + 4)
   cursor += 4
  }

  if (cursor + payloadLen > buffer.length) {
   break
  }

  const rawPayload = Buffer.from(buffer.subarray(cursor, cursor + payloadLen))
  if (masked && maskKey) {
   for (let i = 0; i < rawPayload.length; i++) {
    rawPayload[i] ^= maskKey[i & 3]
   }
  }
  frames.push({ fin, opcode, payload: rawPayload })
  offset = cursor + payloadLen
 }

 return {
  frames,
  remainder: offset > 0 ? buffer.subarray(offset) : buffer,
 }
}

export function acceptWebSocket(req, socket, head = Buffer.alloc(0)) {
 const upgrade = String(req.headers && req.headers.upgrade || '').toLowerCase()
 const key = req.headers && req.headers['sec-websocket-key']
 if (upgrade !== 'websocket' || !key) {
  socket.write('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n')
  socket.destroy()
  return null
 }

 const accept = computeWebSocketAccept(key)
 socket.write(
  'HTTP/1.1 101 Switching Protocols\r\n' +
  'Upgrade: websocket\r\n' +
  'Connection: Upgrade\r\n' +
  `Sec-WebSocket-Accept: ${accept}\r\n\r\n`
 )

 const emitter = new EventEmitter()
 let open = true
 let rxBuf = head && head.length > 0 ? Buffer.from(head) : Buffer.alloc(0)
 let fragOpcode = null
 let fragChunks = []

 function sendFrame(opcode, payload) {
  if (!open || socket.destroyed) {
   return false
  }
  try {
   socket.write(encodeWsFrame(opcode, payload))
   return true
  }
  catch {
   return false
  }
 }

 function handleIncoming(chunk) {
  if (chunk && chunk.length > 0) {
   rxBuf = rxBuf.length > 0 ? Buffer.concat([rxBuf, chunk]) : Buffer.from(chunk)
  }
  let parsed
  try {
   parsed = parseWsFrames(rxBuf)
  }
  catch (err) {
   emitter.emit('error', err)
   closeWs(1002, 'Protocol error')
   return
  }
  rxBuf = parsed.remainder
  for (const frame of parsed.frames) {
   const op = frame.opcode
   if (op === 0x8) {
    closeWs(1000, '')
    return
   }
   if (op === 0x9) {
    sendFrame(0x0a, frame.payload)
    continue
   }
   if (op === 0x0a) {
    continue
   }
   if (op === 0x01 || op === 0x02) {
    if (frame.fin) {
     emitter.emit('message', op === 0x01 ? frame.payload.toString('utf8') : frame.payload)
    }
    else {
     fragOpcode = op
     fragChunks = [frame.payload]
    }
    continue
   }
   if (op === 0x00 && fragOpcode !== null) {
    fragChunks.push(frame.payload)
    if (frame.fin) {
     const combined = Buffer.concat(fragChunks)
     const finalOp = fragOpcode
     fragOpcode = null
     fragChunks = []
     emitter.emit('message', finalOp === 0x01 ? combined.toString('utf8') : combined)
    }
   }
  }
 }

 function closeWs(code = 1000, reason = '') {
  if (!open) {
   return
  }
  open = false
  if (!socket.destroyed) {
   const reasonBuf = Buffer.from(String(reason || ''), 'utf8')
   const payload = Buffer.allocUnsafe(2 + reasonBuf.length)
   payload.writeUInt16BE(code, 0)
   reasonBuf.copy(payload, 2)
   try {
    socket.end(encodeWsFrame(0x8, payload))
   }
   catch {
    socket.destroy()
   }
  }
  emitter.emit('close', code, reason)
 }

 socket.on('data', handleIncoming)
 socket.on('end', () => {
  try {
   socket.end()
  }
  catch {
   // ignore end errors
  }
  if (open) {
   open = false
   emitter.emit('close', 1000, '')
  }
 })
 socket.on('close', () => {
  if (open) {
   open = false
   emitter.emit('close', 1006, '')
  }
 })
 socket.on('error', err => {
  emitter.emit('error', err)
 })

 if (rxBuf.length > 0) {
  queueMicrotask(() => handleIncoming(Buffer.alloc(0)))
 }

 return {
  on: (...args) => emitter.on(...args),
  once: (...args) => emitter.once(...args),
  off: (...args) => emitter.off(...args),
  isOpen: () => open && !socket.destroyed,
  sendText(text) {
   return sendFrame(0x1, Buffer.from(String(text ?? ''), 'utf8'))
  },
  sendJson(obj) {
   return sendFrame(0x1, Buffer.from(JSON.stringify(obj), 'utf8'))
  },
  close: closeWs,
 }
}

export function spawnPty({
 command,
 args = [],
 cols = 100,
 rows = 30,
 cwd,
 env,
} = {}) {
 if (!command) {
  throw new Error('spawnPty requires command')
 }
 const initCols = Math.max(10, Math.min(400, Math.trunc(Number(cols) || 100)))
 const initRows = Math.max(4, Math.min(200, Math.trunc(Number(rows) || 30)))
 const child = spawn(
  'python3',
  ['-u', '-c', PTY_BRIDGE_SCRIPT, String(initCols), String(initRows), '--', String(command), ...args.map(String)],
  {
   cwd: cwd || process.cwd(),
   env: env ? { ...process.env, ...env } : { ...process.env },
   stdio: ['pipe', 'pipe', 'pipe', 'pipe'],
  }
 )

 const emitter = new EventEmitter()
 const ctrlStream = child.stdio[3]
 let exited = false

 const emitData = chunk => {
  const text = Buffer.isBuffer(chunk) ? chunk.toString('utf8') : String(chunk)
  if (text.length > 0) {
   emitter.emit('data', text)
  }
 }

 child.stdout.on('data', emitData)
 child.stderr.on('data', emitData)

 child.on('error', err => {
  emitData(`\r\n[PTY error: ${err && err.message ? err.message : String(err)}]\r\n`)
  if (!exited) {
   exited = true
   emitter.emit('exit', 1)
  }
 })

 child.on('close', (code, signalName) => {
  if (!exited) {
   exited = true
   const finalCode = typeof code === 'number' ? code : (signalName ? 128 : 0)
   emitter.emit('exit', finalCode)
  }
 })

 return {
  pid: child.pid,
  write(data) {
   if (exited || !child.stdin || child.stdin.destroyed) {
    return false
   }
   try {
    child.stdin.write(String(data))
    return true
   }
   catch {
    return false
   }
  },
  resize(nextCols, nextRows) {
   if (exited || !ctrlStream || ctrlStream.destroyed) {
    return false
   }
   const c = Math.max(10, Math.min(400, Math.trunc(Number(nextCols) || 100)))
   const r = Math.max(4, Math.min(200, Math.trunc(Number(nextRows) || 30)))
   try {
    ctrlStream.write(`R ${c} ${r}\n`)
    return true
   }
   catch {
    return false
   }
  },
  signal(sigName = 'INT') {
   if (exited || !ctrlStream || ctrlStream.destroyed) {
    return false
   }
   const clean = String(sigName || 'INT').toUpperCase().replace(/[^A-Z0-9]/g, '')
   try {
    ctrlStream.write(`S ${clean}\n`)
    return true
   }
   catch {
    return false
   }
  },
  kill() {
   if (exited) {
    return
   }
   try {
    child.kill('SIGTERM')
   }
   catch {
    // ignore already dead process
   }
  },
  onData(fn) {
   emitter.on('data', fn)
   return () => emitter.off('data', fn)
  },
  onExit(fn) {
   emitter.on('exit', fn)
   return () => emitter.off('exit', fn)
  },
 }
}

export function createTerminalManager({
 maxBufferBytes = 256 * 1024,
 sessionTtlMs = 30 * 60 * 1000,
 spawnPtyImpl = spawnPty,
} = {}) {
 const sessions = new Map()

 function appendBuffer(session, text) {
  session.buffer += text
  if (session.buffer.length > maxBufferBytes) {
   session.buffer = session.buffer.slice(session.buffer.length - maxBufferBytes)
  }
 }

 function broadcast(session, payload) {
  for (const ws of session.clients) {
   if (ws.isOpen()) {
    ws.sendJson(payload)
   }
  }
 }

 function createSession({
  title = 'Terminal',
  command,
  args = [],
  commandDisplay = '',
  cols = 100,
  rows = 30,
  cwd,
  env,
  cleanup = null,
 } = {}) {
  const id = crypto.randomUUID()
  const pty = spawnPtyImpl({ command, args, cols, rows, cwd, env })
  const session = {
   id,
   title: String(title || 'Terminal'),
   commandDisplay: String(commandDisplay || [command, ...args].join(' ')),
   pty,
   status: 'running',
   exitCode: null,
   buffer: '',
   clients: new Set(),
   cleanup: typeof cleanup === 'function' ? cleanup : null,
   ttlTimer: null,
   createdAt: new Date().toISOString(),
  }
  sessions.set(id, session)

  pty.onData(text => {
   appendBuffer(session, text)
   broadcast(session, { type: 'output', data: text })
  })

  pty.onExit(exitCode => {
   session.status = 'exited'
   session.exitCode = exitCode
   broadcast(session, { type: 'status', status: 'exited', exitCode })
   if (session.cleanup) {
    Promise.resolve(session.cleanup()).catch(() => {})
    session.cleanup = null
   }
   session.ttlTimer = setTimeout(() => {
    sessions.delete(id)
   }, sessionTtlMs)
   if (session.ttlTimer && typeof session.ttlTimer.unref === 'function') {
    session.ttlTimer.unref()
   }
  })

  return session
 }

 function attachWebSocket(sessionId, req, socket, head) {
  const session = sessions.get(String(sessionId || '').trim())
  if (!session) {
   socket.write('HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n')
   socket.destroy()
   return null
  }

  const ws = acceptWebSocket(req, socket, head)
  if (!ws) {
   return null
  }

  session.clients.add(ws)
  ws.sendJson({
   type: 'init',
   sessionId: session.id,
   title: session.title,
   commandDisplay: session.commandDisplay,
   status: session.status,
   exitCode: session.exitCode,
  })
  if (session.buffer.length > 0) {
   ws.sendJson({ type: 'output', data: session.buffer })
  }
  if (session.status === 'exited') {
   ws.sendJson({ type: 'status', status: 'exited', exitCode: session.exitCode })
  }

  ws.on('message', raw => {
   if (typeof raw !== 'string') {
    return
   }
   let msg
   try {
    msg = JSON.parse(raw)
   }
   catch {
    return
   }
   if (!msg || typeof msg !== 'object') {
    return
   }
   if (msg.type === 'input' && typeof msg.data === 'string') {
    session.pty.write(msg.data)
   }
   else if (msg.type === 'resize') {
    session.pty.resize(msg.cols, msg.rows)
   }
   else if (msg.type === 'signal') {
    session.pty.signal(msg.name || 'INT')
   }
   else if (msg.type === 'kill') {
    killSession(session.id)
   }
  })

  ws.on('close', () => {
   session.clients.delete(ws)
  })

  return ws
 }

 function getSession(sessionId) {
  return sessions.get(String(sessionId || '').trim()) || null
 }

 function killSession(sessionId) {
  const session = sessions.get(String(sessionId || '').trim())
  if (!session) {
   return false
  }
  if (session.ttlTimer) {
   clearTimeout(session.ttlTimer)
   session.ttlTimer = null
  }
  session.pty.kill()
  return true
 }

 function killAll() {
  for (const id of Array.from(sessions.keys())) {
   killSession(id)
  }
 }

 return {
  createSession,
  attachWebSocket,
  getSession,
  killSession,
  killAll,
 }
}
