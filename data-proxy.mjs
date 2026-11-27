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
 DEFAULT_PACKAGE_ID,
 bindSecretStoreToKv,
 classifyKvKey,
 closePackageInSession,
 createCapabilityToken,
 createPackage,
 createServerSecretStore,
 deleteLaneSecret,
 ensureDefaultPackage,
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

function extractRequestToken(req) {
 const headerKey = SESSION_TOKEN_HEADER.toLowerCase()
 const direct = req.headers && req.headers[headerKey]
 if (typeof direct === 'string' && direct.trim()) {
  return direct.trim()
 }
 if (Array.isArray(direct) && direct[0]) {
  return String(direct[0]).trim()
 }
 const auth = req.headers && req.headers.authorization
 if (typeof auth === 'string' && /^Bearer\s+cc_tok\./i.test(auth.trim())) {
  return auth.trim().replace(/^Bearer\s+/i, '').trim()
 }
 return ''
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

function requestBackendBuffer(backendUrl, method, bodyBuf) {
 return new Promise((resolve, reject) => {
  const parsed = new URL(backendUrl)
  const lib = parsed.protocol === 'https:' ? https : http
  const headers = {}
  if (bodyBuf && bodyBuf.length > 0) {
   headers['Content-Length'] = String(bodyBuf.length)
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

 function resolveRequestAuth(req, requestedBasePath, allowRegistryFallback = false) {
  const rawToken = extractRequestToken(req)
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
    needsBootstrap: false,
    error: verified.error || 'Invalid session capability token',
   }
  }
  const claims = verified.claims
  const reqDir = normalizeDataDir(requestedBasePath)
  const dirMatches = claims.dir === reqDir || (allowRegistryFallback && reqDir === null)
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
  const url = new URL(req.url || '/', 'http://localhost')
  const pathname = url.pathname
  const method = String(req.method || 'GET').toUpperCase()

  try {
   if (pathname === '/api/vault/session' && method === 'POST') {
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
    const effectiveDir = body.basePath !== undefined && summary.meta === null
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

   return sendJson(res, 404, { ok: false, error: `Unknown vault endpoint: ${pathname}` })
  }
  catch (err) {
   return sendJson(res, err.status || 500, {
    ok: false,
    error: err && err.message ? err.message : 'Vault API error',
   })
  }
 }

 async function handleDataProxyRequest(req, res) {
  const method = String(req.method || 'GET').toUpperCase()
  if (method !== 'GET' && method !== 'POST' && method !== 'DELETE' && method !== 'HEAD') {
   return sendJson(res, 405, { ok: false, error: 'Method not allowed' })
  }

  const url = new URL(req.url || '/', 'http://localhost')
  const rawKey = url.searchParams.get('key')
  if (rawKey === null || rawKey === '') {
   return sendJson(res, 400, { ok: false, error: 'Missing required key query parameter' })
  }

  if (isForbiddenDirectKvKey(rawKey)) {
   return sendJson(res, 403, {
    ok: false,
    error: 'Direct KV access to server-only vault and secret keys is forbidden',
   })
  }

  const classified = classifyKvKey(rawKey)
  if (classified.kind === 'invalid') {
   return sendJson(res, 400, { ok: false, error: 'Invalid KV key' })
  }

  const requestedBasePath = normalizeDataDir(url.searchParams.get('modeOptions.disk.basePath'))
  const allowRegistryFallback =
   classified.kind === 'session-meta' ||
   classified.kind === 'session-packages' ||
   (classified.kind === 'package-data' && classified.packageId === DEFAULT_PACKAGE_ID && rawKey.startsWith('packages#default/sessions'))

  const authCtx = resolveRequestAuth(req, requestedBasePath, allowRegistryFallback)
  if (!authCtx.ok) {
   const extraHeaders = authCtx.needsBootstrap
    ? { [TOKEN_BOOTSTRAP_HEADER]: '/api/vault/session' }
    : null
   return sendJson(res, authCtx.status, { ok: false, error: authCtx.error }, extraHeaders)
  }

  let bodyBuf = null
  try {
   if (method === 'POST') {
    bodyBuf = await readRawBody(req)
   }
  }
  catch (err) {
   return sendJson(res, err.status || 400, { ok: false, error: err.message || 'Invalid request body' })
  }

  const sessionKv = getBoundSessionKv(requestedBasePath)

  // Strict lane-scoped capability token enforcement
  if (Array.isArray(authCtx.claims.lanes)) {
   if (classified.kind === 'lane') {
    if (!authCtx.claims.lanes.includes(classified.laneId)) {
     return sendJson(res, 403, { ok: false, error: 'Lane capability token is not authorized for this lane' })
    }
   }
   else if (classified.kind === 'lane-dot') {
    const owner = await resolveDotKeyOwnerPackage(sessionKv, classified.candidateLaneIds)
    const matched = classified.candidateLaneIds.some(id => authCtx.claims.lanes.includes(id))
    if (!matched || (owner.laneId && !authCtx.claims.lanes.includes(owner.laneId))) {
     return sendJson(res, 403, { ok: false, error: 'Lane capability token is not authorized for this lane' })
    }
   }
   else {
    return sendJson(res, 403, { ok: false, error: 'Lane capability token cannot access non-lane KV keys' })
   }
  }
  else {
   // Session / package capability enforcement
   if (classified.kind === 'package-meta') {
    if (method === 'POST' || method === 'DELETE') {
     if (!(await isPackageAllowedForAuth(sessionKv, requestedBasePath, classified.packageId, authCtx))) {
      return sendJson(res, 403, { ok: false, error: 'Access denied: package is locked or unopened in this session' })
     }
     if (method === 'POST' && bodyBuf) {
      const txt = bodyBuf.toString('utf8').trim()
      if (txt.startsWith('{')) {
       try {
        const parsed = JSON.parse(txt)
        if (parsed && (Object.hasOwn(parsed, 'passphraseHash') || Object.hasOwn(parsed, 'passphraseSalt'))) {
         return sendJson(res, 403, { ok: false, error: 'Package passphrase verifiers cannot be written via /api/data' })
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
     if (!(await isPackageAllowedForAuth(sessionKv, requestedBasePath, classified.packageId, authCtx))) {
      return sendJson(res, 403, { ok: false, error: 'Access denied: package is locked or unopened in this session' })
     }
    }
   }
   else if (classified.kind === 'session-packages') {
    if (method === 'POST' && bodyBuf) {
     const txt = bodyBuf.toString('utf8').trim()
     if (txt.startsWith('[')) {
      try {
       const ids = JSON.parse(txt)
       if (Array.isArray(ids)) {
        for (const pid of ids) {
         if (!(await isPackageAllowedForAuth(sessionKv, requestedBasePath, pid, authCtx))) {
          return sendJson(res, 403, {
           ok: false,
           error: `Cannot add locked package "${pid}" without unlocking via passphrase`,
          })
         }
        }
       }
      }
      catch {
       return sendJson(res, 400, { ok: false, error: 'Invalid session packages payload' })
      }
     }
    }
   }
   else if (classified.kind === 'lane-package') {
    if (method === 'POST' || method === 'DELETE') {
     const currentPkg = await getLanePackageId(sessionKv, classified.laneId)
     if (!(await isPackageAllowedForAuth(sessionKv, requestedBasePath, currentPkg, authCtx))) {
      return sendJson(res, 403, { ok: false, error: 'Access denied: current lane package is locked or unopened' })
     }
     if (method === 'POST' && bodyBuf) {
      const targetPkg = bodyBuf.toString('utf8').trim() || DEFAULT_PACKAGE_ID
      if (!(await isPackageAllowedForAuth(sessionKv, requestedBasePath, targetPkg, authCtx))) {
       return sendJson(res, 403, { ok: false, error: 'Access denied: target package is locked or unopened' })
      }
     }
    }
   }
   else if (classified.kind === 'lane') {
    if (!(await isLaneAllowedForAuth(sessionKv, requestedBasePath, classified.laneId, authCtx))) {
     return sendJson(res, 403, { ok: false, error: 'Access denied: lane belongs to a locked or unopened package' })
    }
   }
   else if (classified.kind === 'lane-dot') {
    const owner = await resolveDotKeyOwnerPackage(sessionKv, classified.candidateLaneIds)
    if (!(await isPackageAllowedForAuth(sessionKv, requestedBasePath, owner.packageId, authCtx))) {
     return sendJson(res, 403, { ok: false, error: 'Access denied: lane belongs to a locked or unopened package' })
    }
   }
  }

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
   const upstream = await requestBackendBuffer(targetUrl.toString(), method, bodyBuf)
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

 return {
  secretStore,
  backendRootKv,
  handleDataProxyRequest,
  handleVaultApiRequest,
 }
}
