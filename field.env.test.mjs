import test from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import http from 'node:http'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = path.dirname(fileURLToPath(import.meta.url))
const startPath = path.join(repoRoot, 'start')

async function freePort() {
 const listener = net.createServer()
 listener.listen(0, '127.0.0.1')
 await new Promise(resolve => listener.once('listening', resolve))
 const port = listener.address().port
 await new Promise(resolve => listener.close(resolve))
 return port
}

function childEnvironment(dir, overrides = {}) {
 const env = { ...process.env, HOME: dir }
 for (const key of [
  'HOST', 'CC_HOST', 'PORT', 'CC_PORT', 'CC_ALLOWED_HOSTS',
  'CC_DATA_BACKEND_URL', 'CC_KEEP_ALIVE_TIMEOUT_MS', 'CC_HEADERS_TIMEOUT_MS',
  'CC_LISTEN_BACKLOG',
 ]) {
  delete env[key]
 }
 return { ...env, ...overrides }
}

function startServer(dir, env) {
 return new Promise((resolve, reject) => {
  const child = spawn(process.execPath, [startPath], {
   cwd: dir,
   env,
   stdio: ['ignore', 'pipe', 'pipe'],
  })
  let stdout = ''
  let stderr = ''
  let settled = false
  const finish = (err, value) => {
   if (settled) return
   settled = true
   clearTimeout(timer)
   if (err) reject(err)
   else resolve(value)
  }
  const timer = setTimeout(() => {
   finish(new Error(`start did not become ready; stdout=${stdout} stderr=${stderr}`))
  }, 15000)
  child.stdout.on('data', chunk => {
   stdout += chunk.toString()
   const match = /Serving on http:\/\/([^\s:]+):(\d+)/.exec(stdout)
   if (match) {
    finish(null, { child, host: match[1], port: Number(match[2]) })
   }
  })
  child.stderr.on('data', chunk => {
   stderr += chunk.toString()
  })
  child.on('exit', code => {
   finish(new Error(`start exited with ${code}; stdout=${stdout} stderr=${stderr}`))
  })
 })
}

function getStatus(port, hostHeader, origin) {
 return new Promise((resolve, reject) => {
  const headers = { Host: hostHeader }
  if (origin) headers.Origin = origin
  const req = http.request({
   hostname: '127.0.0.1',
   port,
   path: '/api/agent/sessions',
   method: 'GET',
   headers,
  }, res => {
   res.resume()
   res.on('end', () => resolve(res.statusCode))
  })
  req.on('error', reject)
  req.end()
 })
}

test('.env.local configures listen address, public origin, and socket timeouts', async t => {
 const dir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'cc-env-local-'))
 const port = await freePort()
 await fs.promises.writeFile(path.join(dir, '.env.local'), [
  '# production overrides moved out of source',
  'HOST=127.0.0.1',
  `PORT=${port}`,
  'CC_ALLOWED_HOSTS=public.example.com',
  'CC_DATA_BACKEND_URL=http://127.0.0.1:3333/?mode=disk',
  'CC_KEEP_ALIVE_TIMEOUT_MS=130000',
  'CC_HEADERS_TIMEOUT_MS=135000',
  'CC_LISTEN_BACKLOG=2048',
 ].join('\n') + '\n')
 const server = await startServer(dir, childEnvironment(dir))
 t.after(() => {
  server.child.kill('SIGTERM')
 })
 assert.equal(server.host, '127.0.0.1')
 assert.equal(server.port, port)

 // Localhost remains allowed by default.
 assert.notEqual(await getStatus(port, `127.0.0.1:${port}`), 403)
 // The public host and its matching Origin come from .env.local.
 assert.notEqual(await getStatus(port, 'public.example.com', 'https://public.example.com'), 403)
 // An unrelated host is still rejected by the shared security boundary.
 assert.equal(await getStatus(port, 'evil.example.com', 'https://evil.example.com'), 403)
})

test('explicit process environment takes precedence over .env.local', async t => {
 const dir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'cc-env-local-'))
 const filePort = await freePort()
 const envPort = await freePort()
 await fs.promises.writeFile(path.join(dir, '.env.local'), [
  'HOST=127.0.0.1',
  `PORT=${filePort}`,
 ].join('\n') + '\n')
 const server = await startServer(dir, childEnvironment(dir, { PORT: String(envPort) }))
 t.after(() => {
  server.child.kill('SIGTERM')
 })
 assert.equal(server.host, '127.0.0.1')
 assert.equal(server.port, envPort)
})
