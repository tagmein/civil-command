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
 _clientsByPath = null,
}) {
 const clientsByPath = _clientsByPath || new Map()
 const cleanBasePath = normalizeDataDir(basePath)

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
    _clientsByPath: clientsByPath,
   })
  }
  const created = httpKV({
   baseUrl,
   namespace: '',
   basePath: norm,
   defaultRoot: def,
   switchable: false,
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
    _clientsByPath: clientsByPath,
   })
  },

  async get(key) {
   const url = new URL(effectiveBaseUrl)
   url.searchParams.set('key', qualify(key))
   const finalUrl = url.toString()
   const resp = await fetch(finalUrl)

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
   const resp = await fetch(finalUrl, {
    method,
    body: value,
   })

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
   const resp = await fetch(finalUrl, { method })

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

export async function proxyDeployRequest({ url, method = 'GET', headers = {}, body = '' } = {}) {
 return postDeployJson('/api/deploy/proxy', { url, method, headers, body })
}

export async function startDeployTerminalSession(payload = {}) {
 return postDeployJson('/api/deploy/terminal/start', payload)
}

export async function killDeployTerminalSession(sessionId) {
 return postDeployJson('/api/deploy/terminal/kill', { sessionId })
}
