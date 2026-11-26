function encodeSegment(segment) {
 return encodeURIComponent(String(segment)).replace(/\./g, '%2E')
}

export function normalizeDataDir(raw) {
 if (raw === null || raw === undefined) {
  return null
 }
 const trimmed = String(raw).trim()
 if (!trimmed) {
  return null
 }
 if (trimmed === '/') {
  return '/'
 }
 if (/^[A-Za-z]:[\\/]?$/.test(trimmed)) {
  return `${trimmed[0]}:\\`
 }
 const stripped = trimmed.replace(/[\\/]+$/, '')
 return stripped || '/'
}

export function formatDataDirLabel(dataDir, dataDirConfirmed = true) {
 const clean = normalizeDataDir(dataDir)
 if (clean !== null) {
  return clean
 }
 return dataDirConfirmed ? 'Default' : 'Default (unconfirmed)'
}

export function buildDataUrl(baseUrl, basePath = null) {
 const url = new URL(baseUrl)
 const clean = normalizeDataDir(basePath)
 if (clean !== null) {
  url.searchParams.set('modeOptions.disk.basePath', clean)
 }
 else {
  url.searchParams.delete('modeOptions.disk.basePath')
 }
 return url.toString()
}

export function httpKV({
 baseUrl,
 namespace = '',
 root = null,
 basePath = null,
 defaultRoot = null,
 switchable = false,
 headers = null,
 _clientsByPath = null,
}) {
 const clientsByPath = _clientsByPath || new Map()
 const cleanBasePath = normalizeDataDir(basePath)
 const requestHeaders = headers && typeof headers === 'object' ? headers : null
 const withHeaders = init => {
  if (!requestHeaders) {
   return init
  }
  return { ...(init || {}), headers: { ...requestHeaders, ...((init && init.headers) || {}) } }
 }

 const getOrCreateRootClient = targetPath => {
  const norm = normalizeDataDir(targetPath)
  const key = norm === null ? '__default__' : norm
  if (clientsByPath.has(key)) {
   return clientsByPath.get(key)
  }
  let def = defaultRoot || clientsByPath.get('__default__') || null
  if (!def && norm !== null) {
   def = httpKV({
    baseUrl,
    namespace: '',
    basePath: null,
    switchable: false,
    headers: requestHeaders,
    _clientsByPath: clientsByPath,
   })
  }
  const created = httpKV({
   baseUrl,
   namespace: '',
   basePath: norm,
   defaultRoot: def,
   switchable: false,
   headers: requestHeaders,
   _clientsByPath: clientsByPath,
  })
  return created
 }

 if (switchable) {
  const defaultClient = getOrCreateRootClient(null)
  let activeClient = getOrCreateRootClient(cleanBasePath)
  return {
   get prefix() {
    return activeClient.prefix
   },
   get basePath() {
    return activeClient.basePath
   },
   get root() {
    return activeClient
   },
   defaultRoot: defaultClient,
   getActiveClient() {
    return activeClient
   },
   withBasePath(nextPath) {
    return getOrCreateRootClient(nextPath)
   },
   setBasePath(nextPath) {
    activeClient = getOrCreateRootClient(nextPath)
    return activeClient
   },
   namespace(name) {
    return activeClient.namespace(name)
   },
   hashNamespace(name) {
    return activeClient.hashNamespace(name)
   },
   get(key) {
    return activeClient.get(key)
   },
   set(key, value) {
    return activeClient.set(key, value)
   },
   delete(key) {
    return activeClient.delete(key)
   },
  }
 }

 const effectiveBaseUrl = buildDataUrl(baseUrl, cleanBasePath)
 const isHash = namespace.includes('#')
 const qualify = key => {
  if (isHash) {
   return namespace.endsWith('#') ? `${namespace}${key}` : `${namespace}/${key}`
  }
  return namespace ? `${namespace}.${key}` : key
 }

 const client = {
  prefix: namespace,
  basePath: cleanBasePath,
  root: root || null,
  defaultRoot: defaultRoot || null,

  getActiveClient() {
   return client
  },

  withBasePath(nextPath) {
   return getOrCreateRootClient(nextPath)
  },

  namespace(name) {
   const nextNamespace = isHash ? qualify(encodeSegment(name)) : qualify(name)
   return httpKV({
    baseUrl,
    namespace: nextNamespace,
    root: client.root,
    basePath: cleanBasePath,
    defaultRoot: client.defaultRoot,
    headers: requestHeaders,
    _clientsByPath: clientsByPath,
   })
  },

  hashNamespace(name) {
   return httpKV({
    baseUrl,
    namespace: `${encodeSegment(name)}#`,
    root: client.root,
    basePath: cleanBasePath,
    defaultRoot: client.defaultRoot,
    headers: requestHeaders,
    _clientsByPath: clientsByPath,
   })
  },

  async get(key) {
   const url = new URL(effectiveBaseUrl)
   url.searchParams.set('key', qualify(key))
   const finalUrl = url.toString()
   const resp = await fetch(finalUrl, withHeaders())

   // treat not found as null
   if (resp.status === 404) {
    return null
   }

   if (!resp.ok) {
    const responseText = await resp.text()
    throw new Error(
     `GET ${finalUrl}: HTTP ${resp.status}: ${resp.statusText}: ${responseText}`
    )
   }

   return resp.text()
  },

  async set(key, value) {
   const url = new URL(effectiveBaseUrl)
   url.searchParams.set('key', qualify(key))
   const finalUrl = url.toString()
   const method = 'POST'
   const resp = await fetch(finalUrl, withHeaders({
    method,
    body: value,
   }))

   if (!resp.ok) {
    const responseText = await resp.text()
    throw new Error(
     `${method} ${finalUrl}: HTTP ${resp.status}: ${resp.statusText}: ${responseText}`
    )
   }
  },

  async delete(key) {
   const url = new URL(effectiveBaseUrl)
   url.searchParams.set('key', qualify(key))
   const finalUrl = url.toString()
   const method = 'DELETE'
   const resp = await fetch(finalUrl, withHeaders({ method }))

   // treat not found as idempotent delete
   if (resp.status === 404) {
    return
   }

   if (!resp.ok) {
    const responseText = await resp.text()
    throw new Error(
     `${method} ${finalUrl}: HTTP ${resp.status}: ${resp.statusText}: ${responseText}`
    )
   }
  },
 }

 if (!client.root) {
  client.root = client
 }
 if (!namespace && !root) {
  const cacheKey = cleanBasePath === null ? '__default__' : cleanBasePath
  if (!clientsByPath.has(cacheKey)) {
   clientsByPath.set(cacheKey, client)
  }
  if (!client.defaultRoot) {
   client.defaultRoot = cleanBasePath === null ? client : getOrCreateRootClient(null)
  }
 }
 else if (!client.defaultRoot && client.root && client.root.defaultRoot) {
  client.defaultRoot = client.root.defaultRoot
 }
 return client
}

const origin = typeof location !== 'undefined' && location && location.origin
 ? location.origin
 : 'http://localhost:8080'
const baseUrl = `${origin}/api/data?mode=disk`

export const data = httpKV({ baseUrl, switchable: true })

export async function fetchFsRoots() {
 const resp = await fetch(`${origin}/api/fs/roots`)
 let parsed = null
 try {
  parsed = await resp.json()
 }
 catch {
  parsed = null
 }
 if (!resp.ok) {
  const msg = parsed && parsed.error ? parsed.error : `HTTP ${resp.status}: ${resp.statusText}`
  throw new Error(msg)
 }
 return parsed || { home: '', platform: '', sep: '/', roots: [] }
}

export async function fetchFsList(dirPath = '') {
 const url = new URL(`${origin}/api/fs/list`)
 if (dirPath !== null && dirPath !== undefined && String(dirPath).trim() !== '') {
  url.searchParams.set('path', String(dirPath))
 }
 const resp = await fetch(url.toString())
 let parsed = null
 try {
  parsed = await resp.json()
 }
 catch {
  parsed = null
 }
 if (!parsed || typeof parsed !== 'object') {
  return {
   ok: resp.ok,
   status: resp.status,
   error: `HTTP ${resp.status}: ${resp.statusText}`,
   path: String(dirPath || ''),
   parent: null,
   writable: false,
   breadcrumbs: [],
   directories: [],
  }
 }
 return {
  ...parsed,
  ok: parsed.ok !== undefined ? Boolean(parsed.ok) : resp.ok,
  status: parsed.status || resp.status,
 }
}

export async function createFsDir(parentDir, name) {
 const resp = await fetch(`${origin}/api/fs/mkdir`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ parent: parentDir, name }),
 })
 let parsed = null
 try {
  parsed = await resp.json()
 }
 catch {
  parsed = null
 }
 if (!parsed || typeof parsed !== 'object') {
  return {
   ok: resp.ok,
   status: resp.status,
   error: `HTTP ${resp.status}: ${resp.statusText}`,
  }
 }
 return {
  ...parsed,
  ok: parsed.ok !== undefined ? Boolean(parsed.ok) : resp.ok,
  status: parsed.status || resp.status,
 }
}

async function postDeployJson(endpointPath, payload = {}) {
 const resp = await fetch(`${origin}${endpointPath}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload),
 })
 let parsed = null
 try {
  parsed = await resp.json()
 }
 catch {
  parsed = null
 }
 if (!parsed || typeof parsed !== 'object') {
  return {
   ok: resp.ok,
   status: resp.status,
   error: `HTTP ${resp.status}: ${resp.statusText}`,
  }
 }
 return {
  ...parsed,
  ok: parsed.ok !== undefined ? Boolean(parsed.ok) : resp.ok,
  status: parsed.status || resp.status,
 }
}

export async function testRemoteCivilMemory({ url, basePath = '' } = {}) {
 return postDeployJson('/api/deploy/kv/test', { url, basePath })
}

export async function syncLaneToRemoteCivilMemory({ url, basePath = '', bundle } = {}) {
 return postDeployJson('/api/deploy/kv/sync', { url, basePath, bundle })
}

const clientResyncQueues = new Map()

function enqueueClientResync(key, fn) {
 const cleanKey = String(key || '__default__')
 const prev = clientResyncQueues.get(cleanKey) || Promise.resolve()
 const next = prev.then(fn, fn)
 const tracked = next.finally(() => {
  if (clientResyncQueues.get(cleanKey) === tracked) {
   clientResyncQueues.delete(cleanKey)
  }
 })
 clientResyncQueues.set(cleanKey, tracked)
 return next
}

export async function resyncDeployedLane(payload = {}) {
 const dep = payload && payload.deployment && typeof payload.deployment === 'object' ? payload.deployment : null
 const queueKey = String((dep && (dep.id || dep.slug || dep.laneId)) || payload.laneId || '__default__')
 return enqueueClientResync(queueKey, async () => {
  const direct = await postDeployJson('/api/deploy/resync', payload)
  if (direct && (direct.ok || direct.status !== 404)) {
   return direct
  }
  const srv = payload && payload.server && typeof payload.server === 'object' ? payload.server : null
  const bundle = payload && payload.bundle && typeof payload.bundle === 'object' ? payload.bundle : null
  if (!srv || !srv.host || !dep || !bundle) {
   if (dep && dep.civilMemoryUrl && bundle) {
    return syncLaneToRemoteCivilMemory({
     url: dep.civilMemoryUrl,
     basePath: dep.dataBasePath || '',
     bundle,
    })
   }
   return direct
  }
  const started = await startDeployTerminalSession({
   action: 'deploy-lane',
   server: srv,
   deployment: dep,
   syncBundle: bundle,
   subtitle: `${srv.user || 'root'}@${srv.host} · ${dep.slug || dep.laneId || ''}`,
  })
  if (!started || !started.ok || !started.wsPath) {
   return started || direct
  }
  const WsCtor = globalThis.WebSocket
  if (typeof WsCtor !== 'function') {
   return { ok: true, deployedAt: new Date().toISOString(), publicUrl: dep.publicUrl || '' }
  }
  const wsBase = origin.replace(/^http/i, 'ws')
  const wsUrl = started.wsPath.startsWith('ws://') || started.wsPath.startsWith('wss://')
   ? started.wsPath
   : `${wsBase}${started.wsPath.startsWith('/') ? '' : '/'}${started.wsPath}`
  return new Promise(resolve => {
   let outputText = ''
   let deployData = null
   let settled = false
   const ws = new WsCtor(wsUrl)
   const finish = result => {
    if (settled) {
     return
    }
    settled = true
    try { ws.close() } catch {}
    resolve(result)
   }
   const scanOutput = () => {
    const lines = outputText.split(/\r?\n/)
    for (let i = lines.length - 1; i >= 0; i--) {
     const line = lines[i]
     const idx = line.indexOf('__CC_DEPLOY_OK__')
     if (idx !== -1) {
      const rawJson = line.slice(idx + '__CC_DEPLOY_OK__'.length).trim()
      try {
       deployData = JSON.parse(rawJson)
      }
      catch {
       deployData = { ok: true }
      }
      break
     }
    }
   }
   const onMsg = ev => {
    const raw = ev && ev.data !== undefined ? ev.data : ev
    let msg
    try { msg = typeof raw === 'string' ? JSON.parse(raw) : raw } catch { return }
    if (!msg || typeof msg !== 'object') {
     return
    }
    if (msg.type === 'output' && typeof msg.data === 'string') {
     outputText += msg.data
     scanOutput()
    }
    else if (msg.type === 'status' && msg.status === 'exited') {
     scanOutput()
     const nowIso = new Date().toISOString()
     if (deployData || msg.exitCode === 0) {
      finish({
       ok: true,
       slug: (deployData && deployData.slug) || dep.slug || '',
       laneId: (deployData && deployData.laneId) || dep.laneId || payload.laneId || '',
       port: (deployData && deployData.port) || dep.port || 4100,
       publicUrl: (deployData && deployData.publicUrl) || dep.publicUrl || '',
       deployedAt: (deployData && deployData.deployedAt) || nowIso,
       syncedAt: (deployData && deployData.deployedAt) || nowIso,
      })
     }
     else {
      finish({
       ok: false,
       error: `Remote deploy exited with code ${msg.exitCode}`,
      })
     }
    }
   }
   if (typeof ws.addEventListener === 'function') {
    ws.addEventListener('message', onMsg)
    ws.addEventListener('error', () => finish({ ok: false, error: 'WebSocket deploy connection failed' }))
    ws.addEventListener('close', () => {
     scanOutput()
     const nowIso = new Date().toISOString()
     if (deployData) {
      finish({
       ok: true,
       slug: deployData.slug || dep.slug || '',
       laneId: deployData.laneId || dep.laneId || payload.laneId || '',
       port: deployData.port || dep.port || 4100,
       publicUrl: deployData.publicUrl || dep.publicUrl || '',
       deployedAt: deployData.deployedAt || nowIso,
       syncedAt: deployData.deployedAt || nowIso,
      })
     }
     else {
      finish({ ok: false, error: 'Deploy session closed before completion' })
     }
    })
   }
   else {
    ws.onmessage = onMsg
    ws.onerror = () => finish({ ok: false, error: 'WebSocket deploy connection failed' })
    ws.onclose = () => finish({ ok: Boolean(deployData), deployedAt: new Date().toISOString(), publicUrl: dep.publicUrl || '' })
   }
  })
 })
}

export async function proxyDeployRequest({ url, method = 'GET', headers = {}, body = '' } = {}) {
 return postDeployJson('/api/deploy/proxy', { url, method, headers, body })
}

export async function startDeployTerminalSession(payload = {}) {
 return postDeployJson('/api/deploy/terminal/start', payload)
}

export async function killDeployTerminalSession(sessionId) {
 return postDeployJson('/api/deploy/terminal/kill', { sessionId })
}

export function subscribeAgentEvents(onEvent, win = globalThis) {
 if (typeof onEvent !== 'function') {
  return () => {}
 }
 const EventSourceCtor = (win && win.EventSource) || globalThis.EventSource
 if (typeof EventSourceCtor !== 'function') {
  return () => {}
 }
 let es
 try {
  es = new EventSourceCtor(`${origin}/api/agent/events`)
 }
 catch {
  return () => {}
 }
 es.onmessage = ev => {
  if (!ev || !ev.data) {
   return
  }
  try {
   const parsed = JSON.parse(ev.data)
   if (parsed && typeof parsed === 'object') {
    onEvent(parsed)
   }
  }
  catch {
   // ignore malformed event
  }
 }
 return () => {
  try {
   es.close()
  }
  catch {}
 }
}

