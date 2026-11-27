import fsSync from 'node:fs'
import http from 'node:http'
import https from 'node:https'
import os from 'node:os'
import path from 'node:path'
import {
 SESSION_TOKEN_HEADER,
 TOKEN_BOOTSTRAP_HEADER,
 buildDataUrl,
 httpKV,
 normalizeDataDir,
} from './data.mjs'
import {
 hasJsonContentType,
 isAllowedLocalOrigin,
} from './http-security.mjs'
import {
 FORBIDDEN_PROPERTY_KEYS,
} from './field.mjs'
import {
 createSafeExternalFetch,
 validateSourceFetchUrl,
} from './sandbox.mjs'
import {
 DEFAULT_PACKAGE_ID,
 bindSecretStoreToKv,
 classifyKvKey,
 closePackageInSession,
 createCapabilityToken,
 createPackage,
 createServerSecretStore,
 deleteLaneSecret,
 ensureDefaultPackage,
 getDefaultServerSecretStore,
 getLanePackageId,
 getPackageMeta,
 isForbiddenDirectKvKey,
 kvGetChunked,
 loadLaneSecretRecord,
 openPackageInSession,
 packageMetaKey,
 resolveLaneSecret,
 resolveRegistryKv,
 resolveSessionKv,
 sessionMetaKey,
 sessionPackagesBase,
 setDefaultServerSecretStore,
 setLaneSecret,
 readPagedIds,
 unwrapKv,
 verifyCapabilityToken,
} from './storage.mjs'

const MAX_PROXY_BODY_BYTES = 8 * 1024 * 1024

export function resolveDefaultVaultStorePath(env = process.env) {
 if (env && typeof env.CC_VAULT_KEY_FILE === 'string' && env.CC_VAULT_KEY_FILE.trim()) {
  return path.resolve(env.CC_VAULT_KEY_FILE.trim())
 }
 return path.join(os.homedir(), '.config', 'civil-command', 'vault-secrets.json')
}

export function createFileBackedServerSecretStore(options = {}) {
 const filePath = options && options.filePath
  ? path.resolve(String(options.filePath))
  : resolveDefaultVaultStorePath()
 let loadedSnapshot = null
 let hadExistingFile = false
 try {
  const raw = fsSync.readFileSync(filePath, 'utf8')
  const parsed = JSON.parse(raw)
  if (parsed && typeof parsed === 'object') {
   loadedSnapshot = parsed
   hadExistingFile = true
  }
 }
 catch {
  loadedSnapshot = null
 }

 const writeSnapshotToDisk = snapshot => {
  const dir = path.dirname(filePath)
  fsSync.mkdirSync(dir, { recursive: true, mode: 0o700 })
  try {
   fsSync.chmodSync(dir, 0o700)
  }
  catch {
   // Ignore chmod errors on non-POSIX filesystems
  }
  const tmpPath = `${filePath}.tmp-${process.pid}-${Date.now()}`
  fsSync.writeFileSync(tmpPath, JSON.stringify(snapshot, null, 1) + '\n', {
   encoding: 'utf8',
   mode: 0o600,
  })
  try {
   fsSync.chmodSync(tmpPath, 0o600)
  }
  catch {
   // Ignore chmod errors on non-POSIX filesystems
  }
  fsSync.renameSync(tmpPath, filePath)
 }

 const store = createServerSecretStore({
  ...options,
  snapshot: loadedSnapshot,
  onPersist: writeSnapshotToDisk,
 })

 if (!hadExistingFile) {
  try {
   writeSnapshotToDisk(store.exportSnapshot())
  }
  catch {
   // Allow read-only environments to continue in memory
  }
 }

 return store
}

function sendJson(res, status, payload, extraHeaders = null) {
 const body = JSON.stringify(payload)
 res.writeHead(status, {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
  ...(extraHeaders || {}),
 })
 res.end(body)
}

function readRawBody(req, maxBytes = MAX_PROXY_BODY_BYTES) {
 return new Promise((resolve, reject) => {
  const chunks = []
  let total = 0
  let settled = false
  req.on('data', chunk => {
   if (settled) {
    return
   }
   const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
   total += buf.length
   if (total > maxBytes) {
    settled = true
    const err = new Error('Request body exceeds maximum size')
    err.status = 413
    reject(err)
    return
   }
   chunks.push(buf)
  })
  req.on('end', () => {
   if (settled) {
    return
   }
   settled = true
   resolve(Buffer.concat(chunks))
  })
  req.on('error', err => {
   if (!settled) {
    settled = true
    reject(err)
   }
  })
 })
}

async function readJsonBody(req) {
 const buf = await readRawBody(req)
 const text = buf.toString('utf8').trim()
 if (!text) {
  return {}
 }
 try {
  const parsed = JSON.parse(text)
  return parsed && typeof parsed === 'object' ? parsed : {}
 }
 catch {
  const err = new Error('Invalid JSON request body')
  err.status = 400
  throw err
 }
}

export function extractCapabilityTokenFromRequest(req, options = {}) {
 const headerKey = SESSION_TOKEN_HEADER.toLowerCase()
 const direct = req && req.headers && req.headers[headerKey]
 if (typeof direct === 'string' && direct.trim()) {
  return direct.trim()
 }
 if (Array.isArray(direct) && direct[0]) {
  return String(direct[0]).trim()
 }
 const auth = req && req.headers && req.headers.authorization
 if (typeof auth === 'string' && /^Bearer\s+cc_tok\./i.test(auth.trim())) {
  return auth.trim().replace(/^Bearer\s+/i, '').trim()
 }
 if (options && options.allowQueryToken === true && req && typeof req.url === 'string') {
  try {
   const parsed = new URL(req.url, 'http://localhost')
   const qTok = parsed.searchParams.get('token')
   if (typeof qTok === 'string' && qTok.trim()) {
    return qTok.trim()
   }
  }
  catch {
   // Ignore malformed URL
  }
 }
 return ''
}

export function verifyApiSessionToken(req, options = {}) {
 const store = (options && options.secretStore) || getDefaultServerSecretStore()
 const rawToken = extractCapabilityTokenFromRequest(req, options)
 if (!rawToken) {
  return {
   ok: false,
   status: 401,
   needsBootstrap: true,
   headers: { [TOKEN_BOOTSTRAP_HEADER]: '/api/vault/session' },
   error: 'Missing session capability token',
  }
 }
 const verified = verifyCapabilityToken(rawToken, store)
 if (!verified.ok) {
  const expired = /expired/i.test(verified.error || '')
  return {
   ok: false,
   status: 401,
   needsBootstrap: expired,
   headers: expired ? { [TOKEN_BOOTSTRAP_HEADER]: '/api/vault/session' } : null,
   error: verified.error || 'Invalid session capability token',
  }
 }
 if (!(options && options.allowLaneScoped) && Array.isArray(verified.claims.lanes)) {
  return {
   ok: false,
   status: 403,
   needsBootstrap: false,
   headers: null,
   error: 'Lane capability token is not authorized for this endpoint',
  }
 }
 return {
  ok: true,
  token: rawToken,
  claims: verified.claims,
 }
}

function extractRequestToken(req) {
 return extractCapabilityTokenFromRequest(req)
}

function sanitizePackageMetaJsonText(rawText) {
 if (typeof rawText !== 'string' || !rawText.trim().startsWith('{')) {
  return rawText
 }
 try {
  const parsed = JSON.parse(rawText)
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
   return rawText
  }
  if (!Object.hasOwn(parsed, 'passphraseHash') && !Object.hasOwn(parsed, 'passphraseSalt')) {
   return rawText
  }
  const { passphraseHash: _h, passphraseSalt: _s, ...clean } = parsed
  return JSON.stringify(clean)
 }
 catch {
  return rawText
 }
}

function requestBackendBuffer(backendUrl, method, bodyBuf, contentType = '') {
 return new Promise((resolve, reject) => {
  const parsed = new URL(backendUrl)
  const lib = parsed.protocol === 'https:' ? https : http
  const headers = {}
  const upperMethod = String(method || 'GET').toUpperCase()
  if (upperMethod !== 'GET' && upperMethod !== 'HEAD') {
   const len = bodyBuf ? bodyBuf.length : 0
   headers['Content-Length'] = String(len)
   if (upperMethod === 'POST' || upperMethod === 'PUT' || upperMethod === 'PATCH' || len > 0) {
    headers['Content-Type'] = contentType || 'text/plain;charset=UTF-8'
   }
  }
  const upstreamReq = lib.request(
   {
    protocol: parsed.protocol,
    hostname: parsed.hostname,
    port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
    path: `${parsed.pathname}${parsed.search}`,
    method,
    headers,
   },
   upstreamRes => {
    const chunks = []
    upstreamRes.on('data', chunk => {
     chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
    })
    upstreamRes.on('end', () => {
     resolve({
      statusCode: upstreamRes.statusCode || 502,
      headers: upstreamRes.headers || {},
      body: Buffer.concat(chunks),
     })
    })
   }
  )
  upstreamReq.on('error', reject)
  if (bodyBuf && bodyBuf.length > 0 && method !== 'GET' && method !== 'HEAD') {
   upstreamReq.write(bodyBuf)
  }
  upstreamReq.end()
 })
}

export function createDataProxyHandler(options = {}) {
 const backendBaseUrl = options.backendBaseUrl || 'http://127.0.0.1:3333/?mode=disk'
 const secretStore = options.secretStore || createServerSecretStore()
 const safeExternalFetch = typeof options.externalFetch === 'function'
  ? options.externalFetch
  : createSafeExternalFetch()
 if (options.setAsDefaultStore !== false) {
  setDefaultServerSecretStore(secretStore)
 }
 const backendRootKv = options.backendKv || httpKV({
  baseUrl: backendBaseUrl,
  switchable: true,
  proxyCapabilities: false,
 })
 bindSecretStoreToKv(backendRootKv, secretStore)

 function getBoundSessionKv(basePath) {
  return bindSecretStoreToKv(resolveSessionKv(backendRootKv, basePath), secretStore)
 }

 async function executeAuthorizedExternalFetch(body) {
  const urlCheck = validateSourceFetchUrl(body && body.url)
  if (!urlCheck.ok) {
   return { status: 400, payload: { ok: false, error: urlCheck.error } }
  }
  const rawMethod = body && body.method !== undefined && body.method !== null
   ? String(body.method).trim().toUpperCase()
   : 'GET'
  if (!rawMethod || rawMethod.length > 32 || !/^[A-Z][A-Z0-9-]*$/.test(rawMethod)) {
   return { status: 400, payload: { ok: false, error: 'fetch method must be a valid HTTP method name' } }
  }
  const safeInit = {
   method: rawMethod,
   credentials: 'omit',
  }
  if (body && body.headers !== undefined && body.headers !== null) {
   if (typeof body.headers !== 'object' || Array.isArray(body.headers)) {
    return { status: 400, payload: { ok: false, error: 'fetch headers must be a plain object' } }
   }
   const cleanHeaders = {}
   for (const [k, v] of Object.entries(body.headers)) {
    if (FORBIDDEN_PROPERTY_KEYS.includes(k)) {
     return { status: 400, payload: { ok: false, error: `Forbidden header key: ${k}` } }
    }
    if (/[\r\n]/.test(k)) {
     return { status: 400, payload: { ok: false, error: 'Header name must not contain CR/LF' } }
    }
    if (k && v !== undefined && v !== null) {
     const sv = String(v)
     if (/[\r\n]/.test(sv)) {
      return { status: 400, payload: { ok: false, error: 'Header value must not contain CR/LF' } }
     }
     cleanHeaders[k] = sv
    }
   }
   if (Object.keys(cleanHeaders).length > 0) {
    safeInit.headers = cleanHeaders
   }
  }
  if (rawMethod !== 'GET' && rawMethod !== 'HEAD' && body && body.body !== undefined && body.body !== null) {
   safeInit.body = typeof body.body === 'string' ? body.body : JSON.stringify(body.body)
  }

  try {
   const resp = await safeExternalFetch(urlCheck.url, safeInit)
   if (!resp || typeof resp !== 'object') {
    return { status: 502, payload: { ok: false, error: 'External fetch returned empty response' } }
   }
   let bodyText = ''
   if (typeof resp.text === 'function') {
    bodyText = String((await resp.text()) ?? '')
   }
   else if (typeof resp.json === 'function') {
    bodyText = JSON.stringify(await resp.json())
   }
   const outHeaders = {}
   if (resp.headers && typeof resp.headers.forEach === 'function') {
    resp.headers.forEach((v, k) => {
     outHeaders[String(k).toLowerCase()] = String(v)
    })
   }
   else if (resp.headers && typeof resp.headers === 'object') {
    for (const [hk, hv] of Object.entries(resp.headers)) {
     outHeaders[String(hk).toLowerCase()] = String(hv)
    }
   }
   return {
    status: 200,
    payload: {
     ok: true,
     response: {
      ok: resp.ok !== false,
      status: Number.isInteger(resp.status) ? resp.status : (resp.ok === false ? 500 : 200),
      statusText: typeof resp.statusText === 'string' ? resp.statusText : '',
      url: typeof resp.url === 'string' ? resp.url : urlCheck.url,
      headers: outHeaders,
      bodyText,
     },
    },
   }
  }
  catch (err) {
   const msg = err && err.message ? err.message : String(err || 'External fetch failed')
   const status = /blocked|private|loopback|localhost|protocol|invalid/i.test(msg) ? 403 : 502
   return { status, payload: { ok: false, error: msg } }
  }
 }

 async function isPassphraseProtectedPkg(sessionKv, basePath, packageId) {
  const cleanPkg = String(packageId || '').trim() || DEFAULT_PACKAGE_ID
  if (cleanPkg === DEFAULT_PACKAGE_ID) {
   return false
  }
  if (secretStore.hasPackageVerifier(basePath, cleanPkg)) {
   return true
  }
  const raw = await kvGetChunked(sessionKv, packageMetaKey(cleanPkg))
  if (!raw) {
   return false
  }
  try {
   const parsed = JSON.parse(raw)
   if (parsed && typeof parsed === 'object') {
    if (parsed.passphraseHash) {
     secretStore.setPackageVerifier(basePath, cleanPkg, {
      salt: parsed.passphraseSalt || '',
      hash: String(parsed.passphraseHash),
     })
    }
    return Boolean(parsed.hasPassphrase)
   }
  }
  catch {
   // Ignore malformed meta
  }
  return false
 }

 function resolveRawTokenAuth(rawToken, requestedBasePath, allowRegistryFallback = false, allowUnlockedAnyDir = false) {
  if (!rawToken) {
   return {
    ok: false,
    status: 401,
    needsBootstrap: true,
    error: 'Missing session capability token',
   }
  }
  const verified = verifyCapabilityToken(rawToken, secretStore)
  if (!verified.ok) {
   return {
    ok: false,
    status: 401,
    needsBootstrap: /expired/i.test(verified.error || ''),
    error: verified.error || 'Invalid session capability token',
   }
  }
  const claims = verified.claims
  const reqDir = normalizeDataDir(requestedBasePath)
  const anyUnlockedDirAllowed = Boolean(
   allowUnlockedAnyDir &&
   claims.sid === null &&
   claims.dir === null &&
   claims.allowUnlocked === true
  )
  const dirMatches = claims.dir === reqDir || anyUnlockedDirAllowed || (allowRegistryFallback && reqDir === null)
  if (!dirMatches) {
   return {
    ok: false,
    status: 403,
    needsBootstrap: false,
    error: 'Session capability token is not authorized for requested data directory',
   }
  }
  const effectiveDir = reqDir !== null ? reqDir : claims.dir
  const effectivePkgs = new Set(
   claims.pkgs.filter(pid => !secretStore.isPackageGrantRevoked(claims.sid, effectiveDir, pid, claims.iat))
  )
  return {
   ok: true,
   claims,
   reqDir,
   effectiveDir,
   effectivePkgs,
  }
 }

 function resolveRequestAuth(req, requestedBasePath, allowRegistryFallback = false) {
  return resolveRawTokenAuth(extractRequestToken(req), requestedBasePath, allowRegistryFallback, false)
 }

 async function isPackageAllowedForAuth(sessionKv, basePath, packageId, authCtx) {
  const cleanPkg = String(packageId || '').trim() || DEFAULT_PACKAGE_ID
  if (Array.isArray(authCtx.claims.lanes)) {
   return false
  }
  if (authCtx.effectivePkgs.has(cleanPkg)) {
   return true
  }
  if (authCtx.claims.allowUnlocked) {
   if (cleanPkg === DEFAULT_PACKAGE_ID) {
    return true
   }
   const isProtected = await isPassphraseProtectedPkg(sessionKv, basePath, cleanPkg)
   return !isProtected
  }
  return false
 }

 async function resolveDotKeyOwnerPackage(sessionKv, candidateLaneIds) {
  for (let i = 0; i < candidateLaneIds.length; i++) {
   const cand = candidateLaneIds[i]
   const raw = await kvGetChunked(sessionKv, `lanes#${encodeURIComponent(cand).replace(/\./g, '%2E')}/package`)
   if (raw !== null && raw !== undefined && String(raw).trim()) {
    return { laneId: cand, packageId: String(raw).trim() }
   }
  }
  return {
   laneId: candidateLaneIds[0] || '',
   packageId: DEFAULT_PACKAGE_ID,
  }
 }

 async function isLaneAllowedForAuth(sessionKv, basePath, laneId, authCtx) {
  const cleanLane = String(laneId || '').trim()
  if (!cleanLane) {
   return false
  }
  if (Array.isArray(authCtx.claims.lanes)) {
   return authCtx.claims.lanes.includes(cleanLane)
  }
  const ownerPkg = await getLanePackageId(sessionKv, cleanLane)
  return isPackageAllowedForAuth(sessionKv, basePath, ownerPkg, authCtx)
 }

 async function computeSessionGrantedPackages(sessionKv, basePath, openPackageIds, prevEffectiveSet = null) {
  const granted = []
  const seen = new Set()
  const candidates = Array.isArray(openPackageIds) && openPackageIds.length > 0
   ? openPackageIds
   : [DEFAULT_PACKAGE_ID]
  for (const rawId of candidates) {
   const pid = String(rawId || '').trim()
   if (!pid || seen.has(pid)) {
    continue
   }
   seen.add(pid)
   const protectedPkg = await isPassphraseProtectedPkg(sessionKv, basePath, pid)
   if (!protectedPkg || (prevEffectiveSet && prevEffectiveSet.has(pid))) {
    granted.push(pid)
   }
  }
  if (!seen.has(DEFAULT_PACKAGE_ID) && candidates.includes(DEFAULT_PACKAGE_ID)) {
   granted.unshift(DEFAULT_PACKAGE_ID)
  }
  return granted
 }

 async function filterSessionRecordForGrants(sessionKv, sessionRecord, grantedSet) {
  if (!sessionRecord || typeof sessionRecord !== 'object') {
   return sessionRecord
  }
  const openPackageIds = Array.isArray(sessionRecord.openPackageIds)
   ? sessionRecord.openPackageIds.filter(pid => grantedSet.has(pid))
   : []
  const openPackages = []
  for (const pid of openPackageIds) {
   const meta = await getPackageMeta(sessionKv, pid)
   if (meta) {
    openPackages.push(meta)
   }
  }
  const activePackageId = openPackageIds.includes(sessionRecord.activePackageId)
   ? sessionRecord.activePackageId
   : (openPackageIds[0] || '')
  return {
   ...sessionRecord,
   openPackageIds,
   openPackages,
   activePackageId,
  }
 }

 async function loadSessionSummary(sessionId, fallbackBasePath = null) {
  const cleanSid = String(sessionId || '').trim()
  const registryKv = resolveRegistryKv(backendRootKv)
  let meta = null
  const rawMeta = registryKv ? await kvGetChunked(registryKv, sessionMetaKey(cleanSid)) : null
  if (rawMeta) {
   try {
    const parsed = JSON.parse(rawMeta)
    if (parsed && typeof parsed === 'object') {
     meta = parsed
    }
   }
   catch {
    meta = null
   }
  }
  const resolvedDir = meta ? normalizeDataDir(meta.dataDir) : normalizeDataDir(fallbackBasePath)
  const sessionKv = getBoundSessionKv(resolvedDir)
  await ensureDefaultPackage(sessionKv)
  const pkgIdx = await readPagedIds(sessionKv, sessionPackagesBase(cleanSid))
  const openPackageIds = pkgIdx.exists && pkgIdx.ids.length > 0 ? pkgIdx.ids : [DEFAULT_PACKAGE_ID]
  return {
   meta,
   dataDir: resolvedDir,
   sessionKv,
   openPackageIds,
  }
 }

 async function handleVaultApiRequest(req, res) {
  if (!isAllowedLocalOrigin(req, options)) {
   return sendJson(res, 403, { ok: false, error: 'Cross-origin vault access denied' })
  }
  const url = new URL(req.url || '/', 'http://localhost')
  const pathname = url.pathname
  const method = String(req.method || 'GET').toUpperCase()

  try {
   if (pathname === '/api/vault/session' && method === 'POST') {
    if (!hasJsonContentType(req)) {
     return sendJson(res, 415, { ok: false, error: 'Content-Type must be application/json' })
    }
    const body = await readJsonBody(req)
    const rawSid = body.sessionId ? String(body.sessionId).trim() : ''
    const requestedDir = normalizeDataDir(body.basePath)

    if (!rawSid) {
     const token = createCapabilityToken({
      sessionId: null,
      basePath: requestedDir,
      packages: [DEFAULT_PACKAGE_ID],
      allowUnlocked: true,
     }, secretStore)
     return sendJson(res, 200, {
      ok: true,
      sessionId: null,
      basePath: requestedDir,
      openPackageIds: [DEFAULT_PACKAGE_ID],
      token,
     })
    }

    const summary = await loadSessionSummary(rawSid, requestedDir)
    const effectiveDir = body.basePath !== undefined && (!summary.meta || !summary.meta.dataDirConfirmed)
     ? requestedDir
     : summary.dataDir

    let prevGranted = null
    const existingTok = extractRequestToken(req)
    if (existingTok) {
     const verifiedPrev = verifyCapabilityToken(existingTok, secretStore)
     if (verifiedPrev.ok && verifiedPrev.claims.sid === rawSid) {
      prevGranted = new Set(
       verifiedPrev.claims.pkgs.filter(
        pid => !secretStore.isPackageGrantRevoked(rawSid, effectiveDir, pid, verifiedPrev.claims.iat)
       )
      )
     }
    }

    const targetSessionKv = getBoundSessionKv(effectiveDir)
    if (effectiveDir !== summary.dataDir) {
     await ensureDefaultPackage(targetSessionKv)
    }
    const grantedPkgs = await computeSessionGrantedPackages(
     targetSessionKv,
     effectiveDir,
     summary.openPackageIds,
     prevGranted
    )
    const token = createCapabilityToken({
     sessionId: rawSid,
     basePath: effectiveDir,
     packages: grantedPkgs,
     allowUnlocked: false,
    }, secretStore)
    return sendJson(res, 200, {
     ok: true,
     sessionId: rawSid,
     basePath: effectiveDir,
     openPackageIds: grantedPkgs,
     token,
    })
   }

   if (pathname === '/api/vault/lane-token' && method === 'POST') {
    if (!hasJsonContentType(req)) {
     return sendJson(res, 415, { ok: false, error: 'Content-Type must be application/json' })
    }
    const body = await readJsonBody(req)
    const reqDir = normalizeDataDir(body.basePath)
    const authCtx = resolveRequestAuth(req, reqDir, false)
    if (!authCtx.ok) {
     return sendJson(res, authCtx.status, { ok: false, error: authCtx.error })
    }
    const rawLanes = Array.isArray(body.lanes)
     ? body.lanes
     : (body.laneId ? [body.laneId] : [])
    const cleanLanes = rawLanes.map(l => String(l || '').trim()).filter(Boolean)
    if (cleanLanes.length === 0) {
     return sendJson(res, 400, { ok: false, error: 'At least one laneId is required' })
    }
    const sessionKv = getBoundSessionKv(reqDir)
    for (const lid of cleanLanes) {
     const allowed = await isLaneAllowedForAuth(sessionKv, reqDir, lid, authCtx)
     if (!allowed) {
      return sendJson(res, 403, { ok: false, error: `Access denied for lane "${lid}"` })
     }
    }
    const token = createCapabilityToken({
     sessionId: authCtx.claims.sid,
     basePath: reqDir,
     packages: [],
     lanes: cleanLanes,
     allowUnlocked: false,
     ttlMs: body.ttlMs,
    }, secretStore)
    return sendJson(res, 200, {
     ok: true,
     lanes: cleanLanes,
     basePath: reqDir,
     token,
    })
   }

   if (pathname === '/api/vault/package/create' && method === 'POST') {
    if (!hasJsonContentType(req)) {
     return sendJson(res, 415, { ok: false, error: 'Content-Type must be application/json' })
    }
    const body = await readJsonBody(req)
    const cleanSid = String(body.sessionId || '').trim()
    const reqDir = normalizeDataDir(body.basePath)
    const authCtx = resolveRequestAuth(req, reqDir, true)
    if (!authCtx.ok) {
     return sendJson(res, authCtx.status, { ok: false, error: authCtx.error })
    }
    const created = await createPackage(backendRootKv, cleanSid, {
     name: body.name,
     passphrase: body.passphrase,
    })
    const effectiveDir = created.sessionState ? normalizeDataDir(created.sessionState.dataDir) : reqDir
    const sessionKv = getBoundSessionKv(effectiveDir)
    const prevSet = new Set([...authCtx.effectivePkgs, created.pkg.id])
    const grantedPkgs = await computeSessionGrantedPackages(
     sessionKv,
     effectiveDir,
     created.sessionState ? created.sessionState.openPackageIds : [DEFAULT_PACKAGE_ID, created.pkg.id],
     prevSet
    )
    const filteredState = await filterSessionRecordForGrants(sessionKv, created.sessionState, new Set(grantedPkgs))
    const token = createCapabilityToken({
     sessionId: cleanSid || authCtx.claims.sid,
     basePath: effectiveDir,
     packages: grantedPkgs,
     allowUnlocked: !cleanSid && authCtx.claims.allowUnlocked,
    }, secretStore)
    return sendJson(res, 200, {
     ok: true,
     pkg: created.pkg,
     sessionState: filteredState,
     sessionId: cleanSid || authCtx.claims.sid,
     basePath: effectiveDir,
     token,
    })
   }

   if (pathname === '/api/vault/package/open' && method === 'POST') {
    if (!hasJsonContentType(req)) {
     return sendJson(res, 415, { ok: false, error: 'Content-Type must be application/json' })
    }
    const body = await readJsonBody(req)
    const cleanSid = String(body.sessionId || '').trim()
    const reqDir = normalizeDataDir(body.basePath)
    const authCtx = resolveRequestAuth(req, reqDir, true)
    if (!authCtx.ok) {
     return sendJson(res, authCtx.status, { ok: false, error: authCtx.error })
    }
    if (!cleanSid) {
     return sendJson(res, 400, { ok: false, error: 'sessionId is required to open a package' })
    }
    const opened = await openPackageInSession(backendRootKv, cleanSid, {
     packageId: body.packageId,
     passphrase: body.passphrase,
     setActive: body.setActive,
    })
    if (!opened.ok) {
     const status = opened.needsPassphrase ? 403 : 404
     return sendJson(res, status, opened)
    }
    const effectiveDir = opened.sessionState ? normalizeDataDir(opened.sessionState.dataDir) : reqDir
    const sessionKv = getBoundSessionKv(effectiveDir)
    const nextGrantSet = new Set([...authCtx.effectivePkgs, opened.pkg.id])
    const grantedPkgs = await computeSessionGrantedPackages(
     sessionKv,
     effectiveDir,
     opened.sessionState.openPackageIds,
     nextGrantSet
    )
    const filteredState = await filterSessionRecordForGrants(sessionKv, opened.sessionState, new Set(grantedPkgs))
    const token = createCapabilityToken({
     sessionId: cleanSid,
     basePath: effectiveDir,
     packages: grantedPkgs,
     allowUnlocked: false,
    }, secretStore)
    return sendJson(res, 200, {
     ok: true,
     pkg: opened.pkg,
     sessionState: filteredState,
     sessionId: cleanSid,
     basePath: effectiveDir,
     token,
    })
   }

   if (pathname === '/api/vault/package/close' && method === 'POST') {
    if (!hasJsonContentType(req)) {
     return sendJson(res, 415, { ok: false, error: 'Content-Type must be application/json' })
    }
    const body = await readJsonBody(req)
    const cleanSid = String(body.sessionId || '').trim()
    const cleanPkgId = String(body.packageId || '').trim()
    const reqDir = normalizeDataDir(body.basePath)
    const authCtx = resolveRequestAuth(req, reqDir, true)
    if (!authCtx.ok) {
     return sendJson(res, authCtx.status, { ok: false, error: authCtx.error })
    }
    if (!cleanSid || !cleanPkgId) {
     return sendJson(res, 400, { ok: false, error: 'sessionId and packageId are required' })
    }
    const updatedState = await closePackageInSession(backendRootKv, cleanSid, cleanPkgId)
    const effectiveDir = normalizeDataDir(updatedState.dataDir)
    const sessionKv = getBoundSessionKv(effectiveDir)
    const remainingSet = new Set([...authCtx.effectivePkgs].filter(pid => pid !== cleanPkgId))
    const grantedPkgs = await computeSessionGrantedPackages(
     sessionKv,
     effectiveDir,
     updatedState.openPackageIds,
     remainingSet
    )
    const filteredState = await filterSessionRecordForGrants(sessionKv, updatedState, new Set(grantedPkgs))
    const token = createCapabilityToken({
     sessionId: cleanSid,
     basePath: effectiveDir,
     packages: grantedPkgs,
     allowUnlocked: false,
    }, secretStore)
    return sendJson(res, 200, {
     ok: true,
     sessionState: filteredState,
     sessionId: cleanSid,
     basePath: effectiveDir,
     token,
    })
   }

   if (pathname === '/api/vault/secret') {
    if (method === 'GET') {
     const reqDir = normalizeDataDir(url.searchParams.get('basePath'))
     const cleanLaneId = String(url.searchParams.get('laneId') || '').trim()
     const cleanSecretId = String(url.searchParams.get('secretId') || '').trim()
     const authCtx = resolveRequestAuth(req, reqDir, false)
     if (!authCtx.ok) {
      return sendJson(res, authCtx.status, { ok: false, error: authCtx.error })
     }
     const sessionKv = getBoundSessionKv(authCtx.effectiveDir)
     if (!(await isLaneAllowedForAuth(sessionKv, authCtx.effectiveDir, cleanLaneId, authCtx))) {
      return sendJson(res, 403, { ok: false, error: 'Access denied: lane belongs to a locked or unopened package' })
     }
     const rec = await loadLaneSecretRecord(sessionKv, sessionKv.namespace(cleanLaneId), cleanLaneId, cleanSecretId)
     if (!rec) {
      return sendJson(res, 200, { ok: true, record: null })
     }
     return sendJson(res, 200, {
      ok: true,
      record: {
       v: rec.v || 1,
       alg: rec.alg || 'AES-256-GCM',
       laneId: cleanLaneId,
       secretId: cleanSecretId,
       secretSet: Boolean(rec.ciphertext),
       createdAt: rec.createdAt || null,
      },
     })
    }

    if (method === 'POST') {
     if (!hasJsonContentType(req)) {
      return sendJson(res, 415, { ok: false, error: 'Content-Type must be application/json' })
     }
     const body = await readJsonBody(req)
     const reqDir = normalizeDataDir(body.basePath)
     const cleanLaneId = String(body.laneId || '').trim()
     const authCtx = resolveRequestAuth(req, reqDir, false)
     if (!authCtx.ok) {
      return sendJson(res, authCtx.status, { ok: false, error: authCtx.error })
     }
     const sessionKv = getBoundSessionKv(authCtx.effectiveDir)
     if (!(await isLaneAllowedForAuth(sessionKv, authCtx.effectiveDir, cleanLaneId, authCtx))) {
      return sendJson(res, 403, { ok: false, error: 'Access denied: lane belongs to a locked or unopened package' })
     }
     const result = await setLaneSecret(
      sessionKv,
      sessionKv.namespace(cleanLaneId),
      cleanLaneId,
      body.name || '',
      body.plaintext,
      body.existingSecretId || ''
     )
     return sendJson(res, result.ok ? 200 : 400, result)
    }

    if (method === 'DELETE') {
     if (!hasJsonContentType(req)) {
      return sendJson(res, 415, { ok: false, error: 'Content-Type must be application/json' })
     }
     const body = await readJsonBody(req)
     const reqDir = normalizeDataDir(body.basePath)
     const cleanLaneId = String(body.laneId || '').trim()
     const cleanSecretId = String(body.secretId || '').trim()
     const authCtx = resolveRequestAuth(req, reqDir, false)
     if (!authCtx.ok) {
      return sendJson(res, authCtx.status, { ok: false, error: authCtx.error })
     }
     const sessionKv = getBoundSessionKv(authCtx.effectiveDir)
     if (!(await isLaneAllowedForAuth(sessionKv, authCtx.effectiveDir, cleanLaneId, authCtx))) {
      return sendJson(res, 403, { ok: false, error: 'Access denied: lane belongs to a locked or unopened package' })
     }
     const result = await deleteLaneSecret(sessionKv, sessionKv.namespace(cleanLaneId), cleanLaneId, cleanSecretId)
     return sendJson(res, result.ok ? 200 : 400, result)
    }

    return sendJson(res, 405, { ok: false, error: 'Method not allowed' })
   }

   if (pathname === '/api/vault/resolve' && method === 'POST') {
    if (!hasJsonContentType(req)) {
     return sendJson(res, 415, { ok: false, error: 'Content-Type must be application/json' })
    }
    const body = await readJsonBody(req)
    const reqDir = normalizeDataDir(body.basePath)
    const cleanLaneId = String(body.laneId || '').trim()
    const cleanSecretId = String(body.secretId || '').trim()
    const authCtx = resolveRequestAuth(req, reqDir, false)
    if (!authCtx.ok) {
     return sendJson(res, authCtx.status, { ok: false, error: authCtx.error })
    }
    const sessionKv = getBoundSessionKv(authCtx.effectiveDir)
    if (!(await isLaneAllowedForAuth(sessionKv, authCtx.effectiveDir, cleanLaneId, authCtx))) {
     return sendJson(res, 403, { ok: false, error: 'Access denied: lane belongs to a locked or unopened package' })
    }
    const value = await resolveLaneSecret(
     sessionKv,
     sessionKv.namespace(cleanLaneId),
     cleanLaneId,
     { type: 'secret', secretId: cleanSecretId, secretSet: true }
    )
    return sendJson(res, 200, { ok: true, value })
   }

   if (pathname === '/api/vault/fetch' && method === 'POST') {
    if (!hasJsonContentType(req)) {
     return sendJson(res, 415, { ok: false, error: 'Content-Type must be application/json' })
    }
    const body = await readJsonBody(req)
    const reqDir = normalizeDataDir(body.basePath)
    const authCtx = resolveRawTokenAuth(extractRequestToken(req), reqDir, true, true)
    if (!authCtx.ok) {
     const extraHeaders = authCtx.needsBootstrap
      ? { [TOKEN_BOOTSTRAP_HEADER]: '/api/vault/session' }
      : null
     return sendJson(res, authCtx.status, { ok: false, error: authCtx.error }, extraHeaders)
    }
    const out = await executeAuthorizedExternalFetch(body)
    return sendJson(res, out.status, out.payload)
   }

   return sendJson(res, 404, { ok: false, error: `Unknown vault endpoint: ${pathname}` })
  }
  catch (err) {
   return sendJson(res, err.status || 500, {
    ok: false,
    error: err && err.message ? err.message : 'Vault API error',
   })
  }
 }

 function isDeployRegistryKey(rawKey) {
  if (typeof rawKey !== 'string') {
   return false
  }
  return (
   rawKey.startsWith('deploy#') ||
   rawKey === 'deploy-servers' ||
   rawKey.startsWith('deploy-servers.') ||
   rawKey.startsWith('deploy-servers-') ||
   rawKey === 'deployments' ||
   rawKey.startsWith('deployments.') ||
   rawKey.startsWith('deployments-')
  )
 }

 async function authorizeKvAccess({
  rawToken,
  method,
  requestedBasePath,
  rawKey,
  bodyText = undefined,
  readBodyText = null,
  allowUnlockedAnyDir = false,
  allowDeployRegistryFallback = true,
 }) {
  if (isForbiddenDirectKvKey(rawKey)) {
   return {
    ok: false,
    status: 403,
    needsBootstrap: false,
    error: 'Direct KV access to server-only vault and secret keys is forbidden',
   }
  }

  const classified = classifyKvKey(rawKey)
  if (classified.kind === 'invalid') {
   return { ok: false, status: 400, needsBootstrap: false, error: 'Invalid KV key' }
  }

  const normDir = normalizeDataDir(requestedBasePath)
  const allowRegistryFallback =
   classified.kind === 'session-meta' ||
   classified.kind === 'session-packages' ||
   (classified.kind === 'package-data' && classified.packageId === DEFAULT_PACKAGE_ID && rawKey.startsWith('packages#default/sessions')) ||
   (allowDeployRegistryFallback && isDeployRegistryKey(rawKey))

  const authCtx = resolveRawTokenAuth(rawToken, normDir, allowRegistryFallback, allowUnlockedAnyDir)
  if (!authCtx.ok) {
   return authCtx
  }

  let effectiveBodyText = bodyText
  if (method === 'POST' && effectiveBodyText === undefined && typeof readBodyText === 'function') {
   effectiveBodyText = await readBodyText()
  }

  const sessionKv = getBoundSessionKv(normDir)

  if (Array.isArray(authCtx.claims.lanes)) {
   if (classified.kind === 'lane') {
    if (!authCtx.claims.lanes.includes(classified.laneId)) {
     return { ok: false, status: 403, needsBootstrap: false, error: 'Lane capability token is not authorized for this lane' }
    }
   }
   else if (classified.kind === 'lane-dot') {
    const owner = await resolveDotKeyOwnerPackage(sessionKv, classified.candidateLaneIds)
    const matched = classified.candidateLaneIds.some(id => authCtx.claims.lanes.includes(id))
    if (!matched || (owner.laneId && !authCtx.claims.lanes.includes(owner.laneId))) {
     return { ok: false, status: 403, needsBootstrap: false, error: 'Lane capability token is not authorized for this lane' }
    }
   }
   else {
    return { ok: false, status: 403, needsBootstrap: false, error: 'Lane capability token cannot access non-lane KV keys' }
   }
  }
  else {
   if (classified.kind === 'package-meta') {
    if (method === 'POST' || method === 'DELETE') {
     if (!(await isPackageAllowedForAuth(sessionKv, normDir, classified.packageId, authCtx))) {
      return { ok: false, status: 403, needsBootstrap: false, error: 'Access denied: package is locked or unopened in this session' }
     }
     if (method === 'POST' && typeof effectiveBodyText === 'string') {
      const txt = effectiveBodyText.trim()
      if (txt.startsWith('{')) {
       try {
        const parsed = JSON.parse(txt)
        if (parsed && (Object.hasOwn(parsed, 'passphraseHash') || Object.hasOwn(parsed, 'passphraseSalt'))) {
         return { ok: false, status: 403, needsBootstrap: false, error: 'Package passphrase verifiers cannot be written via /api/data' }
        }
       }
       catch {
        // Ignore non-JSON chunk
       }
      }
     }
    }
   }
   else if (classified.kind === 'package-data') {
    const isDefaultSessionIndex =
     classified.packageId === DEFAULT_PACKAGE_ID &&
     rawKey.startsWith('packages#default/sessions')
    if (!isDefaultSessionIndex) {
     if (!(await isPackageAllowedForAuth(sessionKv, normDir, classified.packageId, authCtx))) {
      return { ok: false, status: 403, needsBootstrap: false, error: 'Access denied: package is locked or unopened in this session' }
     }
    }
   }
   else if (classified.kind === 'session-packages') {
    if (method === 'POST' && typeof effectiveBodyText === 'string') {
     const txt = effectiveBodyText.trim()
     if (txt.startsWith('[')) {
      try {
       const ids = JSON.parse(txt)
       if (Array.isArray(ids)) {
        for (const pid of ids) {
         if (!(await isPackageAllowedForAuth(sessionKv, normDir, pid, authCtx))) {
          return {
           ok: false,
           status: 403,
           needsBootstrap: false,
           error: `Cannot add locked package "${pid}" without unlocking via passphrase`,
          }
         }
        }
       }
      }
      catch {
       return { ok: false, status: 400, needsBootstrap: false, error: 'Invalid session packages payload' }
      }
     }
    }
   }
   else if (classified.kind === 'lane-package') {
    if (method === 'POST' || method === 'DELETE') {
     const currentPkg = await getLanePackageId(sessionKv, classified.laneId)
     if (!(await isPackageAllowedForAuth(sessionKv, normDir, currentPkg, authCtx))) {
      return { ok: false, status: 403, needsBootstrap: false, error: 'Access denied: current lane package is locked or unopened' }
     }
     if (method === 'POST' && typeof effectiveBodyText === 'string') {
      const targetPkg = effectiveBodyText.trim() || DEFAULT_PACKAGE_ID
      if (!(await isPackageAllowedForAuth(sessionKv, normDir, targetPkg, authCtx))) {
       return { ok: false, status: 403, needsBootstrap: false, error: 'Access denied: target package is locked or unopened' }
      }
     }
    }
   }
   else if (classified.kind === 'lane') {
    if (!(await isLaneAllowedForAuth(sessionKv, normDir, classified.laneId, authCtx))) {
     return { ok: false, status: 403, needsBootstrap: false, error: 'Access denied: lane belongs to a locked or unopened package' }
    }
   }
   else if (classified.kind === 'lane-dot') {
    const owner = await resolveDotKeyOwnerPackage(sessionKv, classified.candidateLaneIds)
    if (!(await isPackageAllowedForAuth(sessionKv, normDir, owner.packageId, authCtx))) {
     return { ok: false, status: 403, needsBootstrap: false, error: 'Access denied: lane belongs to a locked or unopened package' }
    }
   }
  }

  return {
   ok: true,
   authCtx,
   classified,
   reqDir: normDir,
   sessionKv,
  }
 }

 async function handleDataProxyRequest(req, res) {
  if (!isAllowedLocalOrigin(req, options)) {
   return sendJson(res, 403, { ok: false, error: 'Cross-origin data proxy access denied' })
  }
  const method = String(req.method || 'GET').toUpperCase()
  if (method !== 'GET' && method !== 'POST' && method !== 'DELETE' && method !== 'HEAD') {
   return sendJson(res, 405, { ok: false, error: 'Method not allowed' })
  }

  const url = new URL(req.url || '/', 'http://localhost')
  const rawKey = url.searchParams.get('key')
  if (rawKey === null || rawKey === '') {
   return sendJson(res, 400, { ok: false, error: 'Missing required key query parameter' })
  }

  const requestedBasePath = normalizeDataDir(url.searchParams.get('modeOptions.disk.basePath'))
  const rawToken = extractRequestToken(req)
  let bodyBuf = null
  let bodyReadError = null

  const authCheck = await authorizeKvAccess({
   rawToken,
   method,
   requestedBasePath,
   rawKey,
   readBodyText: async () => {
    try {
     bodyBuf = await readRawBody(req)
     return bodyBuf.toString('utf8')
    }
    catch (err) {
     bodyReadError = err
     return null
    }
   },
   allowUnlockedAnyDir: false,
   allowDeployRegistryFallback: true,
  })

  if (bodyReadError) {
   return sendJson(res, bodyReadError.status || 400, { ok: false, error: bodyReadError.message || 'Invalid request body' })
  }

  if (!authCheck.ok) {
   const extraHeaders = authCheck.needsBootstrap
    ? { [TOKEN_BOOTSTRAP_HEADER]: '/api/vault/session' }
    : null
   return sendJson(res, authCheck.status, { ok: false, error: authCheck.error }, extraHeaders)
  }

  const { classified, sessionKv } = authCheck

  // Forward authorized KV request to backend civil-memory
  try {
   if (options.backendKv) {
    if (method === 'GET' || method === 'HEAD') {
     const val = await sessionKv.get(rawKey)
     if (val === null || val === undefined) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
      res.end('Not found')
      return
     }
     const outText = classified.kind === 'package-meta'
      ? sanitizePackageMetaJsonText(String(val))
      : String(val)
     res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' })
     res.end(method === 'HEAD' ? '' : outText)
     return
    }
    if (method === 'POST') {
     await sessionKv.set(rawKey, bodyBuf ? bodyBuf.toString('utf8') : '')
     res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' })
     res.end('ok')
     return
    }
    if (method === 'DELETE') {
     if (typeof sessionKv.delete === 'function') {
      await sessionKv.delete(rawKey)
     }
     res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' })
     res.end('ok')
     return
    }
   }

   const targetUrl = new URL(buildDataUrl(backendBaseUrl, requestedBasePath))
   for (const [paramKey, paramVal] of url.searchParams.entries()) {
    targetUrl.searchParams.set(paramKey, paramVal)
   }
   const upstream = await requestBackendBuffer(targetUrl.toString(), method, bodyBuf, 'text/plain;charset=UTF-8')
   let responseBody = upstream.body
   if ((method === 'GET' || method === 'HEAD') && upstream.statusCode === 200 && classified.kind === 'package-meta') {
    const scrubbed = sanitizePackageMetaJsonText(responseBody.toString('utf8'))
    responseBody = Buffer.from(scrubbed, 'utf8')
   }
   const outHeaders = { ...upstream.headers }
   delete outHeaders['transfer-encoding']
   outHeaders['content-length'] = String(method === 'HEAD' ? 0 : responseBody.length)
   res.writeHead(upstream.statusCode, outHeaders)
   res.end(method === 'HEAD' ? undefined : responseBody)
  }
  catch (err) {
   res.writeHead(502, { 'Content-Type': 'text/plain; charset=utf-8' })
   res.end('Bad gateway: ' + (err && err.message ? err.message : String(err)))
  }
 }

 function createAuthorizedRootKv(rawToken) {
  let currentToken = typeof rawToken === 'string' ? rawToken.trim() : ''
  let activeSessionId = ''
  const clientsByPath = new Map()
  const encodeSeg = seg => encodeURIComponent(String(seg)).replace(/\./g, '%2E')

  const getOrCreateRootClient = targetPath => {
   const norm = normalizeDataDir(targetPath)
   const key = norm === null ? '__default__' : norm
   if (clientsByPath.has(key)) {
    return clientsByPath.get(key)
   }
   const def = norm === null ? null : getOrCreateRootClient(null)
   const client = createScopedClient({ namespace: '', basePath: norm, root: null, defaultRoot: def })
   clientsByPath.set(key, client)
   return client
  }

  function createScopedClient({ namespace = '', basePath = null, root = null, defaultRoot = null }) {
   const cleanBasePath = normalizeDataDir(basePath)
   const isHash = namespace.includes('#')
   const qualify = key => {
    if (isHash) {
     return namespace.endsWith('#') ? `${namespace}${key}` : `${namespace}/${key}`
    }
    return namespace ? `${namespace}.${key}` : String(key)
   }
   const rawStorageClient = unwrapKv(getBoundSessionKv(cleanBasePath))

   const authOrThrow = async (method, fullKey, bodyText = undefined) => {
    const auth = await authorizeKvAccess({
     rawToken: currentToken,
     method,
     requestedBasePath: cleanBasePath,
     rawKey: fullKey,
     bodyText,
     allowUnlockedAnyDir: true,
     allowDeployRegistryFallback: true,
    })
    if (!auth.ok) {
     const err = new Error(auth.error || 'Access denied')
     err.status = auth.status || 403
     throw err
    }
    return auth
   }

   const fetchVaultApi = async (subpath, vaultOpts = {}) => {
    const method = vaultOpts && vaultOpts.method ? String(vaultOpts.method).toUpperCase() : 'POST'
    const cleanSub = String(subpath || '').replace(/^\/+/, '')
    const query = vaultOpts && vaultOpts.query && typeof vaultOpts.query === 'object' ? vaultOpts.query : {}
    const body = vaultOpts && vaultOpts.body && typeof vaultOpts.body === 'object' ? vaultOpts.body : {}
    const targetDir = normalizeDataDir(
     vaultOpts && vaultOpts.basePath !== undefined
      ? vaultOpts.basePath
      : (body.basePath !== undefined ? body.basePath : (query.basePath !== undefined ? query.basePath : cleanBasePath))
    )

    if (cleanSub === 'session' && method === 'POST') {
     const rawSid = body.sessionId ? String(body.sessionId).trim() : ''
     const authCtx = resolveRawTokenAuth(currentToken, targetDir, true, true)
     if (!authCtx.ok) {
      return { ok: false, status: authCtx.status, data: { ok: false, error: authCtx.error } }
     }
     if (!rawSid) {
      return {
       ok: true,
       status: 200,
       data: {
        ok: true,
        sessionId: null,
        basePath: targetDir,
        openPackageIds: [DEFAULT_PACKAGE_ID],
       },
      }
     }
     const summary = await loadSessionSummary(rawSid, targetDir)
     const effectiveDir = body.basePath !== undefined && (!summary.meta || !summary.meta.dataDirConfirmed) ? targetDir : summary.dataDir
     const prevGranted = authCtx.claims.sid === rawSid ? authCtx.effectivePkgs : null
     const targetSessionKv = getBoundSessionKv(effectiveDir)
     if (effectiveDir !== summary.dataDir) {
      await ensureDefaultPackage(targetSessionKv)
     }
     const grantedPkgs = await computeSessionGrantedPackages(
      targetSessionKv,
      effectiveDir,
      summary.openPackageIds,
      prevGranted
     )
     return {
      ok: true,
      status: 200,
      data: {
       ok: true,
       sessionId: rawSid,
       basePath: effectiveDir,
       openPackageIds: grantedPkgs,
      },
     }
    }

    if (cleanSub === 'secret') {
     const authCtx = resolveRawTokenAuth(currentToken, targetDir, false, true)
     if (!authCtx.ok) {
      return { ok: false, status: authCtx.status, data: { ok: false, error: authCtx.error } }
     }
     const cleanLaneId = String((method === 'GET' ? query.laneId : body.laneId) || '').trim()
     const sessionKv = getBoundSessionKv(authCtx.effectiveDir)
     if (!(await isLaneAllowedForAuth(sessionKv, authCtx.effectiveDir, cleanLaneId, authCtx))) {
      return {
       ok: false,
       status: 403,
       data: { ok: false, error: 'Access denied: lane belongs to a locked or unopened package' },
      }
     }
     if (method === 'GET') {
      const cleanSecretId = String(query.secretId || '').trim()
      const rec = await loadLaneSecretRecord(sessionKv, sessionKv.namespace(cleanLaneId), cleanLaneId, cleanSecretId)
      return {
       ok: true,
       status: 200,
       data: {
        ok: true,
        record: rec
         ? {
          v: rec.v || 1,
          alg: rec.alg || 'AES-256-GCM',
          laneId: cleanLaneId,
          secretId: cleanSecretId,
          secretSet: Boolean(rec.ciphertext),
          createdAt: rec.createdAt || null,
         }
         : null,
       },
      }
     }
     if (method === 'POST') {
      const result = await setLaneSecret(
       sessionKv,
       sessionKv.namespace(cleanLaneId),
       cleanLaneId,
       body.name || '',
       body.plaintext,
       body.existingSecretId || ''
      )
      return { ok: Boolean(result && result.ok), status: result && result.ok ? 200 : 400, data: result }
     }
     if (method === 'DELETE') {
      const cleanSecretId = String(body.secretId || '').trim()
      const result = await deleteLaneSecret(sessionKv, sessionKv.namespace(cleanLaneId), cleanLaneId, cleanSecretId)
      return { ok: Boolean(result && result.ok), status: result && result.ok ? 200 : 400, data: result }
     }
    }

    if (cleanSub === 'resolve' && method === 'POST') {
     const authCtx = resolveRawTokenAuth(currentToken, targetDir, false, true)
     if (!authCtx.ok) {
      return { ok: false, status: authCtx.status, data: { ok: false, error: authCtx.error } }
     }
     const cleanLaneId = String(body.laneId || '').trim()
     const cleanSecretId = String(body.secretId || '').trim()
     const sessionKv = getBoundSessionKv(authCtx.effectiveDir)
     if (!(await isLaneAllowedForAuth(sessionKv, authCtx.effectiveDir, cleanLaneId, authCtx))) {
      return {
       ok: false,
       status: 403,
       data: { ok: false, error: 'Access denied: lane belongs to a locked or unopened package' },
      }
     }
     const value = await resolveLaneSecret(
      sessionKv,
      sessionKv.namespace(cleanLaneId),
      cleanLaneId,
      { type: 'secret', secretId: cleanSecretId, secretSet: true }
     )
     return { ok: true, status: 200, data: { ok: true, value } }
    }

    if (cleanSub === 'fetch' && method === 'POST') {
     const authCtx = resolveRawTokenAuth(currentToken, targetDir, true, true)
     if (!authCtx.ok) {
      return { ok: false, status: authCtx.status, data: { ok: false, error: authCtx.error } }
     }
     const out = await executeAuthorizedExternalFetch(body)
     return { ok: out.status >= 200 && out.status < 300, status: out.status, data: out.payload }
    }

    return { ok: false, status: 400, data: { ok: false, error: `Unsupported vault operation: ${cleanSub}` } }
   }

   const client = {
    isProxyBacked: true,
    prefix: namespace,
    basePath: cleanBasePath,
    root: null,
    defaultRoot: null,
    getActiveClient() {
     return client
    },
    getSessionToken() {
     return currentToken
    },
    setSessionToken(nextTok) {
     if (typeof nextTok === 'string' && nextTok.trim()) {
      currentToken = nextTok.trim()
     }
     return currentToken
    },
    setActiveSession(sid) {
     activeSessionId = sid ? String(sid).trim() : ''
    },
    fetchVaultApi,
    withBasePath(nextPath) {
     return getOrCreateRootClient(nextPath)
    },
    namespace(name) {
     const nextNs = isHash ? qualify(encodeSeg(name)) : qualify(name)
     return createScopedClient({
      namespace: nextNs,
      basePath: cleanBasePath,
      root: client.root,
      defaultRoot: client.defaultRoot,
     })
    },
    hashNamespace(name) {
     return createScopedClient({
      namespace: `${encodeSeg(name)}#`,
      basePath: cleanBasePath,
      root: client.root,
      defaultRoot: client.defaultRoot,
     })
    },
    async get(key) {
     const fullKey = qualify(key)
     const auth = await authOrThrow('GET', fullKey)
     const val = await rawStorageClient.get(fullKey)
     if (val === null || val === undefined) {
      return null
     }
     return auth.classified.kind === 'package-meta'
      ? sanitizePackageMetaJsonText(String(val))
      : String(val)
    },
    async set(key, value, opts = null) {
     const fullKey = qualify(key)
     const textVal = value === null || value === undefined ? '' : String(value)
     await authOrThrow('POST', fullKey, textVal)
     await rawStorageClient.set(fullKey, textVal, opts)
    },
    async delete(key, opts = null) {
     const fullKey = qualify(key)
     await authOrThrow('DELETE', fullKey)
     if (typeof rawStorageClient.delete === 'function') {
      await rawStorageClient.delete(fullKey, opts)
     }
     else {
      await rawStorageClient.set(fullKey, '', opts)
     }
    },
   }

   client.root = root || client
   if (defaultRoot) {
    client.defaultRoot = defaultRoot
   }
   else if (!namespace && !root) {
    client.defaultRoot = cleanBasePath === null ? client : getOrCreateRootClient(null)
   }
   else if (client.root && client.root.defaultRoot) {
    client.defaultRoot = client.root.defaultRoot
   }
   return client
  }

  const defaultClient = getOrCreateRootClient(null)
  let activeClient = defaultClient
  return {
   isProxyBacked: true,
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
   getSessionToken() {
    return currentToken
   },
   setSessionToken(nextTok) {
    if (typeof nextTok === 'string' && nextTok.trim()) {
     currentToken = nextTok.trim()
    }
    return currentToken
   },
   setActiveSession(sid) {
    activeSessionId = sid ? String(sid).trim() : ''
    void activeSessionId
   },
   fetchVaultApi(subpath, vaultOpts = {}) {
    return activeClient.fetchVaultApi(subpath, {
     basePath: activeClient.basePath,
     ...(vaultOpts || {}),
    })
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
   set(key, value, opts) {
    return activeClient.set(key, value, opts)
   },
   delete(key, opts) {
    return activeClient.delete(key, opts)
   },
  }
 }

 return {
  secretStore,
  backendRootKv,
  createAuthorizedRootKv,
  handleDataProxyRequest,
  handleVaultApiRequest,
 }
}
