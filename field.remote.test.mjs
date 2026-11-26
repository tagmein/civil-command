import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveAgentRootKv } from './agent-api.mjs'
import { basicAuthorizationHeader, resolveAgentRemoteOptions } from './agent-remote.mjs'
import { httpKV } from './data.mjs'

function decodeBasic(header) {
 return Buffer.from(String(header).slice('Basic '.length), 'base64').toString('utf8')
}

test('remote --host resolves to the origin KV API and forwards basic auth and custom headers', () => {
 const remote = resolveAgentRemoteOptions({
  host: 'https://io.example.com/4cf920c4-23b1-47bc-8d05-b1008083020d',
  user: 'agent',
  password: 'secret',
  header: ['X-A: 1', 'X-B: 2'],
 }, {})
 assert.equal(remote.baseUrl, 'https://io.example.com/api/data?mode=disk')
 assert.equal(remote.serverOrigin, 'https://io.example.com')
 assert.equal(decodeBasic(remote.headers.Authorization), 'agent:secret')
 assert.equal(remote.headers['X-A'], '1')
 assert.equal(remote.headers['X-B'], '2')
 assert.equal(remote.usesBasicAuth, true)
})

test('credentials embedded in a remote URL are stripped and converted to basic auth', () => {
 const remote = resolveAgentRemoteOptions({ url: 'https://agent:secret@example.com/api/data?mode=disk' }, {})
 assert.equal(remote.baseUrl, 'https://example.com/api/data?mode=disk')
 assert.equal(decodeBasic(remote.headers.Authorization), 'agent:secret')
})

test('bearer token overrides basic auth and incomplete basic credentials are rejected', () => {
 assert.equal(resolveAgentRemoteOptions({}, { CC_TOKEN: 'token' }).headers.Authorization, 'Bearer token')
 assert.equal(resolveAgentRemoteOptions({ user: 'agent', password: 'secret', token: 'token' }, {}).headers.Authorization, 'Bearer token')
 assert.equal(decodeBasic(resolveAgentRemoteOptions({}, { CC_USER: 'agent', CC_PASSWORD: 'secret' }).headers.Authorization), 'agent:secret')
 assert.throws(() => resolveAgentRemoteOptions({ user: 'agent' }, {}), /Both --user and --password/)
 assert.equal(decodeBasic(basicAuthorizationHeader('agent', 'secret')), 'agent:secret')
})

test('httpKV and resolveAgentRootKv attach auth headers to every KV request', async () => {
 const calls = []
 const originalFetch = globalThis.fetch
 globalThis.fetch = async (url, init) => {
  calls.push({ url: String(url), init: init || {} })
  return new Response('ok', { status: 200 })
 }
 try {
  const kv = resolveAgentRootKv({
   baseUrl: 'https://example.com/api/data?mode=disk',
   headers: { Authorization: 'Basic abc', 'X-Auth': 'yes' },
  })
  await kv.get('a')
  await kv.set('b', 'value')
  await kv.delete('c')
  await kv.namespace('ns').get('d')
  await kv.withBasePath('/tmp/x').get('e')
  const distinct = httpKV({ baseUrl: 'https://example.com/api/data?mode=disk', headers: { 'X-Auth': 'yes' } })
  await distinct.hashNamespace('h#').get('f')
 }
 finally {
  globalThis.fetch = originalFetch
 }
 assert.equal(calls.length, 6)
 for (const call of calls) {
  assert.match(call.url, /^https:\/\/example\.com\/api\/data\?/)
  assert.equal(call.init.headers['X-Auth'], 'yes')
 }
 assert.equal(calls[0].init.headers.Authorization, 'Basic abc')
 assert.equal(calls[1].init.method, 'POST')
 assert.equal(calls[1].init.body, 'value')
 assert.equal(calls[2].init.method, 'DELETE')
 assert.match(calls[3].url, /key=ns\.d/)
 assert.match(calls[4].url, /basePath=%2Ftmp%2Fx/)
})
