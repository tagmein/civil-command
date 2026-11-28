export const DEFAULT_ALLOWED_LOCAL_HOSTS = Object.freeze([
 'localhost',
 '127.0.0.1',
 '::1',
 '[::1]',
])

function addHostVariant(set, rawEntry) {
 if (typeof rawEntry !== 'string') {
  return
 }
 const clean = rawEntry.trim().toLowerCase()
 if (!clean || clean === '*' || /[\s,@/\\?#\0]/.test(clean)) {
  return
 }
 if (clean.startsWith('[') && clean.endsWith(']')) {
  const bare = clean.slice(1, -1)
  if (bare) {
   set.add(clean)
   set.add(bare)
  }
  return
 }
 const colonCount = (clean.match(/:/g) || []).length
 if (colonCount >= 2) {
  set.add(clean)
  set.add(`[${clean}]`)
  return
 }
 set.add(clean)
}

export function resolveAllowedLocalHostnames(options = {}) {
 const set = new Set(DEFAULT_ALLOWED_LOCAL_HOSTS)
 const opts = options && typeof options === 'object' ? options : {}
 const useEnv = opts.useEnv !== false
 const sources = []
 if (opts.allowedHosts !== undefined && opts.allowedHosts !== null) {
  sources.push(opts.allowedHosts)
 }
 if (useEnv && typeof process !== 'undefined' && process && process.env && process.env.CC_ALLOWED_HOSTS) {
  sources.push(process.env.CC_ALLOWED_HOSTS)
 }
 for (const src of sources) {
  if (Array.isArray(src)) {
   for (const item of src) {
    addHostVariant(set, String(item ?? ''))
   }
  }
  else if (typeof src === 'string') {
   for (const part of src.split(',')) {
    addHostVariant(set, part)
   }
  }
 }
 return set
}

export function parseHostHeader(rawHost) {
 if (typeof rawHost !== 'string') {
  return null
 }
 const trimmed = rawHost.trim()
 if (!trimmed || /[\s,@/\\?#\0]/.test(trimmed)) {
  return null
 }
 let explicitPort = ''
 if (trimmed.startsWith('[')) {
  const closeIdx = trimmed.indexOf(']')
  if (closeIdx <= 1) {
   return null
  }
  const rest = trimmed.slice(closeIdx + 1)
  if (rest) {
   const m = /^:(\d{1,5})$/.exec(rest)
   if (!m) {
    return null
   }
   const portNum = Number(m[1])
   if (!Number.isInteger(portNum) || portNum < 1 || portNum > 65535) {
    return null
   }
   explicitPort = String(portNum)
  }
 }
 else {
  const firstColon = trimmed.indexOf(':')
  const lastColon = trimmed.lastIndexOf(':')
  if (firstColon !== lastColon) {
   return null
  }
  if (firstColon !== -1) {
   const portText = trimmed.slice(firstColon + 1)
   if (!/^\d{1,5}$/.test(portText)) {
    return null
   }
   const portNum = Number(portText)
   if (!Number.isInteger(portNum) || portNum < 1 || portNum > 65535) {
    return null
   }
   explicitPort = String(portNum)
  }
 }

 let parsed
 try {
  parsed = new URL(`http://${trimmed}`)
 }
 catch {
  return null
 }
 if (parsed.username !== '' || parsed.password !== '' || parsed.pathname !== '/' || parsed.search !== '' || parsed.hash !== '') {
  return null
 }
 const hostname = parsed.hostname.toLowerCase()
 if (!hostname) {
  return null
 }
 const bareHostname = hostname.startsWith('[') && hostname.endsWith(']')
  ? hostname.slice(1, -1)
  : hostname
 const port = parsed.port || explicitPort || ''
 return { hostname, bareHostname, port }
}

export function isAllowedLocalHost(req, options = {}) {
 const rawHost = req && req.headers ? req.headers.host : undefined
 if (Array.isArray(rawHost)) {
  return false
 }
 if (rawHost === undefined || rawHost === null || String(rawHost).trim() === '') {
  return !Boolean(options && options.requireHost)
 }
 const parsed = parseHostHeader(rawHost)
 if (!parsed) {
  return false
 }
 const allowed = resolveAllowedLocalHostnames(options)
 return allowed.has(parsed.hostname) || allowed.has(parsed.bareHostname)
}

export function isAllowedLocalOrigin(req, options = {}) {
 if (!isAllowedLocalHost(req, options)) {
  return false
 }

 const secFetchSite = req && req.headers ? req.headers['sec-fetch-site'] : undefined
 if (Array.isArray(secFetchSite)) {
  return false
 }
 if (typeof secFetchSite === 'string' && secFetchSite.trim() !== '') {
  const sfs = secFetchSite.trim().toLowerCase()
  const secFetchMode = req && req.headers && typeof req.headers['sec-fetch-mode'] === 'string'
   ? req.headers['sec-fetch-mode'].trim().toLowerCase()
   : ''
  const allowNav = Boolean(options && options.allowCrossSiteNavigate === true && secFetchMode === 'navigate')
  if (sfs !== 'same-origin' && sfs !== 'none' && !(allowNav && sfs === 'cross-site')) {
   return false
  }
 }

 const rawOrigin = req && req.headers ? req.headers.origin : undefined
 if (rawOrigin === undefined || rawOrigin === null) {
  return true
 }
 if (Array.isArray(rawOrigin)) {
  return false
 }
 const trimmedOrigin = String(rawOrigin).trim()
 if (trimmedOrigin === '') {
  return true
 }
 if (trimmedOrigin.toLowerCase() === 'null') {
  return false
 }

 let parsedOrigin
 try {
  parsedOrigin = new URL(trimmedOrigin)
 }
 catch {
  return false
 }
 if ((parsedOrigin.protocol !== 'http:' && parsedOrigin.protocol !== 'https:') || parsedOrigin.username || parsedOrigin.password) {
  return false
 }
 const originHost = parsedOrigin.hostname.toLowerCase()
 const bareOriginHost = originHost.startsWith('[') && originHost.endsWith(']')
  ? originHost.slice(1, -1)
  : originHost
 const allowed = resolveAllowedLocalHostnames(options)
 if (!allowed.has(originHost) && !allowed.has(bareOriginHost)) {
  return false
 }

 const rawHost = req && req.headers ? req.headers.host : undefined
 if (typeof rawHost === 'string' && rawHost.trim() !== '') {
  const hostInfo = parseHostHeader(rawHost)
  if (hostInfo && hostInfo.port) {
   const originPort = parsedOrigin.port || (parsedOrigin.protocol === 'https:' ? '443' : '80')
   if (originPort !== hostInfo.port) {
    return false
   }
  }
 }

 return true
}

export function hasJsonContentType(req) {
 const raw = req && req.headers ? req.headers['content-type'] : undefined
 if (typeof raw !== 'string') {
  return false
 }
 const mediaType = raw.split(';')[0].trim().toLowerCase()
 return mediaType === 'application/json'
}

export function acceptsGzip(req) {
 const encodings = String(req.headers['accept-encoding'] || '').split(',')
 return encodings.some(entry => {
  const [encoding, ...params] = entry.trim().toLowerCase().split(';')
  if (encoding.trim() !== 'gzip') {
   return false
  }
  const quality = params.map(param => param.trim()).find(param => param.startsWith('q='))
  return quality === undefined || Number(quality.slice(2)) > 0
 })
}
