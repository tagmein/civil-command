import { constants as fsConstants } from 'node:fs'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { verifyApiSessionToken } from './data-proxy.mjs'
import { hasJsonContentType, isAllowedLocalOrigin } from './http-security.mjs'
import { getDefaultServerSecretStore } from './storage.mjs'

const MAX_JSON_BODY_BYTES = 64 * 1024

const PSEUDO_FS_TYPES = new Set([
 'autofs',
 'binfmt_misc',
 'bpf',
 'cgroup',
 'cgroup2',
 'configfs',
 'debugfs',
 'devpts',
 'devtmpfs',
 'efivarfs',
 'fuse.lxcfs',
 'fuse.portal',
 'fusectl',
 'hugetlbfs',
 'mqueue',
 'nsfs',
 'overlay',
 'proc',
 'pstore',
 'ramfs',
 'rpc_pipefs',
 'securityfs',
 'squashfs',
 'sysfs',
 'tmpfs',
 'tracefs',
])

const SYSTEM_MOUNT_PREFIXES = [
 '/boot',
 '/dev',
 '/proc',
 '/snap',
 '/sys',
 '/var/lib/containers',
 '/var/lib/docker',
]

function isSystemMountPath(mountPath) {
 for (const prefix of SYSTEM_MOUNT_PREFIXES) {
  if (mountPath === prefix || mountPath.startsWith(`${prefix}/`)) {
   return true
  }
 }
 return false
}

export function unescapeMountPath(raw) {
 const input = String(raw || '')
 if (!input.includes('\\')) {
  return input
 }
 const bytes = []
 for (let i = 0; i < input.length; i++) {
  if (input[i] === '\\' && i + 3 < input.length && /^[0-7]{3}$/.test(input.slice(i + 1, i + 4))) {
   bytes.push(parseInt(input.slice(i + 1, i + 4), 8))
   i += 3
  }
  else {
   const encoded = Buffer.from(input[i], 'utf8')
   for (const b of encoded) {
    bytes.push(b)
   }
  }
 }
 return Buffer.from(bytes).toString('utf8')
}

export function parseProcMounts(mountsText) {
 const text = String(mountsText || '')
 const out = []
 const seen = new Set()
 const lines = text.split(/\r?\n/)
 for (const line of lines) {
  const trimmed = line.trim()
  if (!trimmed || trimmed.startsWith('#')) {
   continue
  }
  const fields = trimmed.split(/\s+/)
  if (fields.length < 3) {
   continue
  }
  const device = unescapeMountPath(fields[0])
  const mount = unescapeMountPath(fields[1])
  const fsType = fields[2]
  if (!mount || seen.has(mount)) {
   continue
  }
  if (PSEUDO_FS_TYPES.has(fsType)) {
   continue
  }
  if (isSystemMountPath(mount)) {
   continue
  }
  const isSpecialMount = mount.startsWith('/mnt/') || mount.startsWith('/media/') || mount.startsWith('/run/media/')
  const isRealDevice = device.startsWith('/') || device.includes(':/') || device.startsWith('//')
  if (!isSpecialMount && !isRealDevice && fsType === 'fuse') {
   continue
  }
  seen.add(mount)
  out.push({ device, mount, fsType })
 }
 return out
}

function getPathModule(platform) {
 return platform === 'win32' ? path.win32 : path.posix
}

function expandHomePath(rawPath, homedir, platform) {
 const pathMod = getPathModule(platform)
 const trimmed = String(rawPath || '').trim()
 if (!trimmed) {
  return homedir || (platform === 'win32' ? 'C:\\' : '/')
 }
 if (trimmed === '~') {
  return homedir || (platform === 'win32' ? 'C:\\' : '/')
 }
 if (trimmed.startsWith('~/') || (platform === 'win32' && trimmed.startsWith('~\\'))) {
  return pathMod.join(homedir || '/', trimmed.slice(2))
 }
 return trimmed
}

export function buildBreadcrumbs(dirPath, platform = process.platform) {
 const pathMod = getPathModule(platform)
 const resolved = pathMod.resolve(String(dirPath || (platform === 'win32' ? 'C:\\' : '/')))
 const parsed = pathMod.parse(resolved)
 const root = parsed.root || (platform === 'win32' ? resolved.slice(0, 3) : '/')
 const crumbs = [{ name: root, path: root }]
 const rest = resolved.slice(root.length)
 if (!rest) {
  return crumbs
 }
 const parts = rest.split(/[\\/]+/).filter(Boolean)
 let acc = root
 for (const part of parts) {
  acc = pathMod.join(acc, part)
  crumbs.push({ name: part, path: acc })
 }
 return crumbs
}

async function isAccessibleDir(targetPath) {
 try {
  const st = await fs.stat(targetPath)
  return st.isDirectory()
 }
 catch {
  return false
 }
}

async function scanSubdirMounts(parentDirs, platform) {
 const pathMod = getPathModule(platform)
 const candidates = []
 for (const parent of parentDirs) {
  if (!parent) {
   continue
  }
  try {
   const entries = await fs.readdir(parent, { withFileTypes: true })
   for (const ent of entries) {
    const full = pathMod.join(parent, ent.name)
    if (ent.isDirectory()) {
     candidates.push({ name: ent.name, path: full })
    }
    else if (ent.isSymbolicLink() && await isAccessibleDir(full)) {
     candidates.push({ name: ent.name, path: full })
    }
   }
  }
  catch {
   // directory does not exist or is unreadable
  }
 }
 return candidates
}

export async function listDisks(opts = {}) {
 const platform = opts.platform || process.platform
 const pathMod = getPathModule(platform)
 const homedir = opts.homedir || os.homedir()
 const username = opts.username || (() => {
  try {
   return os.userInfo().username
  }
  catch {
   return process.env.USER || process.env.USERNAME || ''
  }
 })()

 const rawCandidates = []
 if (homedir) {
  rawCandidates.push({
   name: 'Home',
   path: pathMod.resolve(homedir),
   kind: 'home',
   fsType: '',
   device: '',
  })
 }

 if (platform !== 'win32') {
  rawCandidates.push({
   name: 'Root (/)',
   path: '/',
   kind: 'root',
   fsType: '',
   device: '',
  })
 }

 if (platform === 'linux') {
  let mountsText = typeof opts.mountsText === 'string' ? opts.mountsText : ''
  if (opts.mountsText === undefined) {
   try {
    mountsText = await fs.readFile('/proc/mounts', 'utf8')
   }
   catch {
    mountsText = ''
   }
  }
  const parsedMounts = parseProcMounts(mountsText)
  for (const m of parsedMounts) {
   const baseName = pathMod.basename(m.mount) || m.mount
   const isRoot = m.mount === '/'
   rawCandidates.push({
    name: isRoot ? 'Root (/)' : baseName,
    path: m.mount,
    kind: isRoot ? 'root' : 'disk',
    fsType: m.fsType || '',
    device: m.device || '',
   })
  }
  const mountParents = [
   '/mnt',
   '/media',
   username ? pathMod.join('/media', username) : '',
   username ? pathMod.join('/run/media', username) : '',
   ...(Array.isArray(opts.extraMountParents) ? opts.extraMountParents : []),
  ]
  const scanned = await scanSubdirMounts(mountParents, platform)
  for (const item of scanned) {
   rawCandidates.push({
    name: item.name,
    path: item.path,
    kind: 'disk',
    fsType: '',
    device: '',
   })
  }
 }
 else if (platform === 'darwin') {
  const volumesDir = opts.volumesDir || '/Volumes'
  const scanned = await scanSubdirMounts([volumesDir, ...(Array.isArray(opts.extraMountParents) ? opts.extraMountParents : [])], platform)
  for (const item of scanned) {
   rawCandidates.push({
    name: item.name,
    path: item.path,
    kind: 'disk',
    fsType: '',
    device: '',
   })
  }
 }
 else if (platform === 'win32') {
  const drives = Array.isArray(opts.probeRoots)
   ? opts.probeRoots
   : Array.from({ length: 26 }, (_, i) => `${String.fromCharCode(65 + i)}:\\`)
  const checks = await Promise.all(drives.map(async drive => ({
   drive,
   ok: await isAccessibleDir(drive),
  })))
  for (const chk of checks) {
   if (chk.ok) {
    rawCandidates.push({
     name: chk.drive,
     path: chk.drive,
     kind: 'disk',
     fsType: '',
     device: chk.drive,
    })
   }
  }
 }

 const byPath = new Map()
 const verified = await Promise.all(rawCandidates.map(async cand => {
  const resolved = pathMod.resolve(cand.path)
  const ok = await isAccessibleDir(resolved)
  return ok ? { ...cand, path: resolved } : null
 }))

 for (const item of verified) {
  if (!item) {
   continue
  }
  const existing = byPath.get(item.path)
  if (!existing) {
   byPath.set(item.path, item)
   continue
  }
  if (!existing.fsType && item.fsType) {
   existing.fsType = item.fsType
  }
  if (!existing.device && item.device) {
   existing.device = item.device
  }
 }

 return {
  home: homedir ? pathMod.resolve(homedir) : (platform === 'win32' ? 'C:\\' : '/'),
  platform,
  sep: pathMod.sep,
  roots: Array.from(byPath.values()),
 }
}

function mapFsError(err, fallbackStatus = 500) {
 const code = err && err.code
 if (code === 'ENOENT') {
  return { status: 404, error: 'Directory not found' }
 }
 if (code === 'EACCES' || code === 'EPERM') {
  return { status: 403, error: 'Permission denied' }
 }
 if (code === 'ENOTDIR') {
  return { status: 400, error: 'Path is not a directory' }
 }
 if (code === 'EEXIST') {
  return { status: 409, error: 'A file or folder with that name already exists' }
 }
 if (code === 'EROFS') {
  return { status: 403, error: 'Filesystem is read-only' }
 }
 return { status: fallbackStatus, error: err && err.message ? err.message : 'Filesystem error' }
}

export async function listDirectories(rawPath, opts = {}) {
 const platform = opts.platform || process.platform
 const pathMod = getPathModule(platform)
 const homedir = opts.homedir || os.homedir()
 const expanded = expandHomePath(rawPath, homedir, platform)
 const targetPath = pathMod.resolve(expanded)
 const dirname = pathMod.dirname(targetPath)
 const parent = dirname !== targetPath ? dirname : null
 const breadcrumbs = buildBreadcrumbs(targetPath, platform)

 let stat
 try {
  stat = await fs.stat(targetPath)
 }
 catch (err) {
  const mapped = mapFsError(err, 400)
  return {
   ok: false,
   status: mapped.status,
   error: `${mapped.error}: ${targetPath}`,
   path: targetPath,
   parent,
   writable: false,
   breadcrumbs,
   directories: [],
  }
 }

 if (!stat.isDirectory()) {
  return {
   ok: false,
   status: 400,
   error: `Path is not a directory: ${targetPath}`,
   path: targetPath,
   parent,
   writable: false,
   breadcrumbs,
   directories: [],
  }
 }

 let entries
 try {
  entries = await fs.readdir(targetPath, { withFileTypes: true })
 }
 catch (err) {
  const mapped = mapFsError(err, 403)
  return {
   ok: false,
   status: mapped.status,
   error: `${mapped.error}: ${targetPath}`,
   path: targetPath,
   parent,
   writable: false,
   breadcrumbs,
   directories: [],
  }
 }

 let writable = false
 try {
  await fs.access(targetPath, fsConstants.W_OK)
  writable = true
 }
 catch {
  writable = false
 }

 const resolvedDirs = await Promise.all(entries.map(async ent => {
  const fullPath = pathMod.join(targetPath, ent.name)
  if (ent.isDirectory()) {
   return {
    name: ent.name,
    path: fullPath,
    hidden: ent.name.startsWith('.'),
    symlink: false,
   }
  }
  if (ent.isSymbolicLink()) {
   if (await isAccessibleDir(fullPath)) {
    return {
     name: ent.name,
     path: fullPath,
     hidden: ent.name.startsWith('.'),
     symlink: true,
    }
   }
  }
  return null
 }))

 const directories = resolvedDirs.filter(Boolean).sort((a, b) => {
  if (a.hidden !== b.hidden) {
   return a.hidden ? 1 : -1
  }
  const cmp = a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
  if (cmp !== 0) {
   return cmp
  }
  return a.name < b.name ? -1 : (a.name > b.name ? 1 : 0)
 })

 return {
  ok: true,
  status: 200,
  path: targetPath,
  parent,
  writable,
  breadcrumbs,
  directories,
 }
}

export async function createDirectory(parentDir, folderName, opts = {}) {
 const platform = opts.platform || process.platform
 const pathMod = getPathModule(platform)
 const homedir = opts.homedir || os.homedir()

 const cleanName = String(folderName === null || folderName === undefined ? '' : folderName).trim()
 if (!cleanName) {
  return { ok: false, status: 400, error: 'Folder name is required' }
 }
 if (cleanName === '.' || cleanName === '..' || cleanName.includes('/') || cleanName.includes('\\') || cleanName.includes('\0')) {
  return { ok: false, status: 400, error: 'Folder name cannot contain path separators or traversal segments' }
 }

 const rawParent = String(parentDir === null || parentDir === undefined ? '' : parentDir).trim()
 if (!rawParent) {
  return { ok: false, status: 400, error: 'Parent directory is required' }
 }
 const resolvedParent = pathMod.resolve(expandHomePath(rawParent, homedir, platform))

 try {
  const st = await fs.stat(resolvedParent)
  if (!st.isDirectory()) {
   return { ok: false, status: 400, error: `Parent is not a directory: ${resolvedParent}` }
  }
 }
 catch (err) {
  const mapped = mapFsError(err, 404)
  return { ok: false, status: mapped.status, error: mapped.error }
 }

 const targetPath = pathMod.join(resolvedParent, cleanName)
 try {
  await fs.mkdir(targetPath, { recursive: false })
  return {
   ok: true,
   status: 201,
   path: targetPath,
   name: cleanName,
  }
 }
 catch (err) {
  const mapped = mapFsError(err, 500)
  return { ok: false, status: mapped.status, error: mapped.error }
 }
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

function readJsonBody(req) {
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
   if (total > MAX_JSON_BODY_BYTES) {
    settled = true
    const err = new Error('Request body too large')
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
   const text = Buffer.concat(chunks).toString('utf8').trim()
   if (!text) {
    resolve({})
    return
   }
   try {
    const parsed = JSON.parse(text)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
     const err = new Error('Expected JSON object body')
     err.status = 400
     reject(err)
     return
    }
    resolve(parsed)
   }
   catch {
    const err = new Error('Invalid JSON body')
    err.status = 400
    reject(err)
   }
  })
  req.on('error', err => {
   if (!settled) {
    settled = true
    reject(err)
   }
  })
 })
}

export async function handleFsApiRequest(req, res, opts = {}) {
 if (!isAllowedLocalOrigin(req, opts)) {
  return sendJson(res, 403, { ok: false, error: 'Cross-origin filesystem access denied' })
 }
 if (opts.requireAuth !== false) {
  const authRes = verifyApiSessionToken(req, {
   secretStore: opts.secretStore || getDefaultServerSecretStore(),
   allowQueryToken: false,
   allowLaneScoped: false,
  })
  if (!authRes.ok) {
   return sendJson(res, authRes.status, { ok: false, error: authRes.error }, authRes.headers)
  }
 }

 const url = new URL(req.url || '/', 'http://localhost')
 const pathname = url.pathname
 const method = (req.method || 'GET').toUpperCase()

 if (pathname === '/api/fs/roots') {
  if (method !== 'GET') {
   return sendJson(res, 405, { error: 'Method not allowed' })
  }
  const result = await listDisks(opts)
  return sendJson(res, 200, result)
 }

 if (pathname === '/api/fs/list') {
  if (method !== 'GET') {
   return sendJson(res, 405, { error: 'Method not allowed' })
  }
  const targetPath = url.searchParams.get('path') || ''
  const result = await listDirectories(targetPath, opts)
  return sendJson(res, result.status || 200, result)
 }

 if (pathname === '/api/fs/mkdir') {
  if (method !== 'POST') {
   return sendJson(res, 405, { error: 'Method not allowed' })
  }
  if (!hasJsonContentType(req)) {
   return sendJson(res, 415, { ok: false, error: 'Content-Type must be application/json' })
  }
  let body
  try {
   body = await readJsonBody(req)
  }
  catch (err) {
   return sendJson(res, err && err.status ? err.status : 400, { ok: false, error: err.message || 'Invalid request body' })
  }
  const result = await createDirectory(body.parent, body.name, opts)
  return sendJson(res, result.status || 200, result)
 }

 return sendJson(res, 404, { error: 'Not found' })
}
