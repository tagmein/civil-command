import { formatDataDirLabel, normalizeDataDir } from './data.mjs'
import {
 coerceDataValue,
 defaultDataValue,
 formatTimestampWithZone,
 normalizeColumnWidth,
 parse,
 parseColumnType,
 parseImportLine,
 parseStoredTables,
 validateFieldScriptLine,
 validateFieldScriptLines,
} from './field.mjs'

export { formatDataDirLabel, normalizeDataDir }

export const MAX_KV_VALUE_BYTES = 1024
export const DEFAULT_PACKAGE_ID = 'default'
export const DEFAULT_PACKAGE_NAME = 'Default'
export const SESSION_STORAGE_KEY = 'civil-command.session'
export const RECENT_SESSIONS_STORAGE_KEY = 'civil-command.recent-sessions'
export const SESSION_HISTORY_STORAGE_KEY = 'civil-command.session-history'
export const LANE_SOURCE_DRAFTS_STORAGE_PREFIX = 'civil-command.source-drafts'

const CONCURRENCY_LIMIT = 16
const MAX_RECENT_SESSIONS = 25
const MAX_SESSION_HISTORY = 100
const utf8Encoder = new TextEncoder()
const utf8Decoder = new TextDecoder()

const writeQueues = new WeakMap()
const chunkCountCache = new WeakMap()
const pagedIndexCache = new WeakMap()
const fallbackStorages = new WeakMap()

export function unwrapKv(kv) {
 if (kv && typeof kv === 'object' && typeof kv.getActiveClient === 'function') {
  return kv.getActiveClient()
 }
 return kv
}

export function resolveRegistryKv(rootKv) {
 if (rootKv && typeof rootKv === 'object' && rootKv.defaultRoot) {
  return unwrapKv(rootKv.defaultRoot)
 }
 return unwrapKv(rootKv)
}

export function resolveSessionKv(rootKv, dataDir) {
 const cleanDir = normalizeDataDir(dataDir)
 if (rootKv && typeof rootKv === 'object' && typeof rootKv.withBasePath === 'function') {
  return unwrapKv(rootKv.withBasePath(cleanDir))
 }
 return unwrapKv(rootKv)
}

export function activateSessionKv(rootKv, dataDir) {
 const cleanDir = normalizeDataDir(dataDir)
 if (rootKv && typeof rootKv === 'object' && typeof rootKv.setBasePath === 'function') {
  return unwrapKv(rootKv.setBasePath(cleanDir))
 }
 return resolveSessionKv(rootKv, cleanDir)
}

function getKvMap(weakMap, kv) {
 const keyObj = unwrapKv(kv)
 let map = weakMap.get(keyObj)
 if (!map) {
  map = new Map()
  weakMap.set(keyObj, map)
 }
 return map
}

function isMissingValue(raw) {
 return raw === null || raw === undefined || raw === ''
}

export function utf8ByteLength(str) {
 return utf8Encoder.encode(String(str)).length
}

export function encodeKeySegment(segment) {
 return encodeURIComponent(String(segment)).replace(/\./g, '%2E')
}

export function splitUtf8Chunks(str, maxBytes = MAX_KV_VALUE_BYTES) {
 const text = String(str)
 if (text.length === 0) {
  return ['']
 }
 const limit = Math.max(4, Math.floor(Number(maxBytes) || MAX_KV_VALUE_BYTES))
 const chunks = []
 let start = 0
 let curBytes = 0
 for (let i = 0; i < text.length; ) {
  const cp = text.codePointAt(i)
  const unitLen = cp > 0xffff ? 2 : 1
  let charBytes
  if (cp <= 0x7f) {
   charBytes = 1
  }
  else if (cp <= 0x7ff) {
   charBytes = 2
  }
  else if (cp <= 0xffff) {
   charBytes = 3
  }
  else {
   charBytes = 4
  }
  if (curBytes + charBytes > limit && i > start) {
   chunks.push(text.slice(start, i))
   start = i
   curBytes = 0
  }
  curBytes += charBytes
  i += unitLen
 }
 if (start < text.length) {
  chunks.push(text.slice(start))
 }
 return chunks
}

export async function kvDelete(kv, key) {
 if (!kv) {
  return
 }
 if (typeof kv.delete === 'function') {
  await kv.delete(key)
  return
 }
 await kv.set(key, '')
}

function enqueueWrite(kv, key, fn) {
 const keyObj = unwrapKv(kv)
 if (!keyObj || typeof keyObj !== 'object') {
  return fn()
 }
 const map = getKvMap(writeQueues, keyObj)
 const prev = map.get(key) || Promise.resolve()
 const next = prev.catch(() => {}).then(fn)
 map.set(key, next)
 const cleanup = () => {
  if (map.get(key) === next) {
   map.delete(key)
  }
 }
 next.then(cleanup, cleanup)
 return next
}

export async function mapConcurrent(items, limit, fn) {
 const list = Array.from(items || [])
 if (list.length === 0) {
  return []
 }
 const results = new Array(list.length)
 const workersCount = Math.max(1, Math.min(limit || CONCURRENCY_LIMIT, list.length))
 let cursor = 0
 const workers = Array.from({ length: workersCount }, async () => {
  while (cursor < list.length) {
   const idx = cursor++
   results[idx] = await fn(list[idx], idx)
  }
 })
 await Promise.all(workers)
 return results
}

function parseChunkManifest(raw) {
 if (typeof raw !== 'string' || !raw.startsWith('{')) {
  return null
 }
 try {
  const parsed = JSON.parse(raw)
  if (
   parsed &&
   typeof parsed === 'object' &&
   parsed.__cc_chunks === 1 &&
   Number.isInteger(parsed.n) &&
   parsed.n >= 0
  ) {
   return parsed.n
  }
 }
 catch {
  return null
 }
 return null
}

async function resolvePrevChunkCount(kv, key) {
 const targetKv = unwrapKv(kv)
 const cache = targetKv && typeof targetKv === 'object' ? getKvMap(chunkCountCache, targetKv) : null
 if (cache && cache.has(key)) {
  return cache.get(key)
 }
 const existing = await targetKv.get(key)
 const count = parseChunkManifest(existing)
 return count === null ? 0 : count
}

export async function kvGetChunked(kv, key) {
 const targetKv = unwrapKv(kv)
 if (!targetKv) {
  return null
 }
 const raw = await targetKv.get(key)
 if (isMissingValue(raw)) {
  if (typeof targetKv === 'object') {
   getKvMap(chunkCountCache, targetKv).set(key, 0)
  }
  return null
 }
 const chunkCount = parseChunkManifest(raw)
 if (chunkCount === null) {
  if (typeof targetKv === 'object') {
   getKvMap(chunkCountCache, targetKv).set(key, 0)
  }
  return raw
 }
 if (typeof targetKv === 'object') {
  getKvMap(chunkCountCache, targetKv).set(key, chunkCount)
 }
 if (chunkCount === 0) {
  return ''
 }
 const indices = Array.from({ length: chunkCount }, (_, i) => i)
 const parts = await mapConcurrent(indices, CONCURRENCY_LIMIT, idx => targetKv.get(`${key}.chunks/${idx}`))
 for (const part of parts) {
  if (part === null || part === undefined) {
   return null
  }
 }
 return parts.join('')
}

async function kvSetChunkedUnlocked(kv, key, rawString, maxBytes = MAX_KV_VALUE_BYTES) {
 const targetKv = unwrapKv(kv)
 const str = String(rawString)
 const limit = Math.max(4, Math.floor(Number(maxBytes) || MAX_KV_VALUE_BYTES))
 const cache = targetKv && typeof targetKv === 'object' ? getKvMap(chunkCountCache, targetKv) : null
 const prevCount = await resolvePrevChunkCount(targetKv, key)

 if (utf8ByteLength(str) <= limit) {
  await targetKv.set(key, str)
  if (prevCount > 0) {
   const stale = Array.from({ length: prevCount }, (_, i) => i)
   await mapConcurrent(stale, CONCURRENCY_LIMIT, idx => kvDelete(targetKv, `${key}.chunks/${idx}`))
  }
  if (cache) {
   cache.set(key, 0)
  }
  return
 }

 const chunks = splitUtf8Chunks(str, limit)
 await mapConcurrent(chunks, CONCURRENCY_LIMIT, (chunk, idx) => targetKv.set(`${key}.chunks/${idx}`, chunk))
 await targetKv.set(key, JSON.stringify({ __cc_chunks: 1, n: chunks.length }))
 if (prevCount > chunks.length) {
  const stale = Array.from({ length: prevCount - chunks.length }, (_, i) => chunks.length + i)
  await mapConcurrent(stale, CONCURRENCY_LIMIT, idx => kvDelete(targetKv, `${key}.chunks/${idx}`))
 }
 if (cache) {
  cache.set(key, chunks.length)
 }
}

export function kvSetChunked(kv, key, rawString, maxBytes = MAX_KV_VALUE_BYTES) {
 const targetKv = unwrapKv(kv)
 return enqueueWrite(targetKv, key, () => kvSetChunkedUnlocked(targetKv, key, rawString, maxBytes))
}

async function kvDeleteChunkedUnlocked(kv, key) {
 const targetKv = unwrapKv(kv)
 const cache = targetKv && typeof targetKv === 'object' ? getKvMap(chunkCountCache, targetKv) : null
 const prevCount = await resolvePrevChunkCount(targetKv, key)
 await kvDelete(targetKv, key)
 if (prevCount > 0) {
  const indices = Array.from({ length: prevCount }, (_, i) => i)
  await mapConcurrent(indices, CONCURRENCY_LIMIT, idx => kvDelete(targetKv, `${key}.chunks/${idx}`))
 }
 if (cache) {
  cache.set(key, 0)
 }
}

export function kvDeleteChunked(kv, key) {
 const targetKv = unwrapKv(kv)
 return enqueueWrite(targetKv, key, () => kvDeleteChunkedUnlocked(targetKv, key))
}

function packIdsIntoPages(ids, maxBytes = MAX_KV_VALUE_BYTES) {
 const pages = []
 let current = []
 for (const rawId of ids) {
  const id = String(rawId)
  const candidate = [...current, id]
  const candidateJson = JSON.stringify(candidate)
  if (current.length > 0 && utf8ByteLength(candidateJson) > maxBytes) {
   pages.push(JSON.stringify(current))
   current = [id]
  }
  else {
   current = candidate
  }
 }
 if (current.length > 0) {
  pages.push(JSON.stringify(current))
 }
 return pages
}

export async function readPagedIds(kv, basePrefix) {
 const targetKv = unwrapKv(kv)
 if (!targetKv) {
  return { exists: false, ids: [] }
 }
 const indexKey = `${basePrefix}-index`
 const raw = await kvGetChunked(targetKv, indexKey)
 if (isMissingValue(raw)) {
  if (typeof targetKv === 'object') {
   getKvMap(pagedIndexCache, targetKv).delete(basePrefix)
  }
  return { exists: false, ids: [] }
 }
 let parsed
 try {
  parsed = JSON.parse(raw)
 }
 catch {
  return { exists: false, ids: [] }
 }
 if (!parsed || typeof parsed !== 'object') {
  return { exists: false, ids: [] }
 }
 if (Array.isArray(parsed.ids)) {
  const ids = parsed.ids.map(String)
  if (typeof targetKv === 'object') {
   getKvMap(pagedIndexCache, targetKv).set(basePrefix, { pageCount: 0, pageJsons: [] })
  }
  return { exists: true, ids }
 }
 if (Number.isInteger(parsed.pages) && parsed.pages >= 0) {
  const pageIndices = Array.from({ length: parsed.pages }, (_, i) => i)
  const rawPages = await mapConcurrent(pageIndices, CONCURRENCY_LIMIT, idx => kvGetChunked(targetKv, `${basePrefix}-pages/${idx}`))
  const ids = []
  const pageJsons = []
  for (const pageRaw of rawPages) {
   if (isMissingValue(pageRaw)) {
    pageJsons.push('')
    continue
   }
   pageJsons.push(pageRaw)
   try {
    const arr = JSON.parse(pageRaw)
    if (Array.isArray(arr)) {
     for (const item of arr) {
      ids.push(String(item))
     }
    }
   }
   catch {
    // ignore malformed page
   }
  }
  if (typeof targetKv === 'object') {
   getKvMap(pagedIndexCache, targetKv).set(basePrefix, { pageCount: parsed.pages, pageJsons })
  }
  return { exists: true, ids }
 }
 return { exists: false, ids: [] }
}

async function resolvePrevPagedInfo(kv, basePrefix) {
 const targetKv = unwrapKv(kv)
 const cache = targetKv && typeof targetKv === 'object' ? getKvMap(pagedIndexCache, targetKv) : null
 if (cache && cache.has(basePrefix)) {
  return cache.get(basePrefix)
 }
 const raw = await kvGetChunked(targetKv, `${basePrefix}-index`)
 if (isMissingValue(raw)) {
  return { pageCount: 0, pageJsons: [] }
 }
 try {
  const parsed = JSON.parse(raw)
  if (parsed && Number.isInteger(parsed.pages) && parsed.pages >= 0) {
   return { pageCount: parsed.pages, pageJsons: [] }
  }
 }
 catch {
  // ignore
 }
 return { pageCount: 0, pageJsons: [] }
}

export function writePagedIds(kv, basePrefix, ids) {
 const targetKv = unwrapKv(kv)
 const indexKey = `${basePrefix}-index`
 return enqueueWrite(targetKv, indexKey, async () => {
  const cleanIds = Array.from(ids || [], String)
  const cache = targetKv && typeof targetKv === 'object' ? getKvMap(pagedIndexCache, targetKv) : null
  const prevInfo = await resolvePrevPagedInfo(targetKv, basePrefix)
  const inlineJson = JSON.stringify({ v: 1, ids: cleanIds })

  if (utf8ByteLength(inlineJson) <= MAX_KV_VALUE_BYTES) {
   await kvSetChunkedUnlocked(targetKv, indexKey, inlineJson)
   if (prevInfo.pageCount > 0) {
    const stale = Array.from({ length: prevInfo.pageCount }, (_, i) => i)
    await mapConcurrent(stale, CONCURRENCY_LIMIT, idx => kvDeleteChunked(targetKv, `${basePrefix}-pages/${idx}`))
   }
   if (cache) {
    cache.set(basePrefix, { pageCount: 0, pageJsons: [] })
   }
   return cleanIds
  }

  const pageJsons = packIdsIntoPages(cleanIds, MAX_KV_VALUE_BYTES)
  const dirtyIndices = []
  for (let i = 0; i < pageJsons.length; i++) {
   if (prevInfo.pageJsons[i] !== pageJsons[i]) {
    dirtyIndices.push(i)
   }
  }
  await mapConcurrent(dirtyIndices, CONCURRENCY_LIMIT, idx => kvSetChunked(targetKv, `${basePrefix}-pages/${idx}`, pageJsons[idx]))
  await kvSetChunkedUnlocked(targetKv, indexKey, JSON.stringify({ v: 1, count: cleanIds.length, pages: pageJsons.length }))
  if (prevInfo.pageCount > pageJsons.length) {
   const stale = Array.from({ length: prevInfo.pageCount - pageJsons.length }, (_, i) => pageJsons.length + i)
   await mapConcurrent(stale, CONCURRENCY_LIMIT, idx => kvDeleteChunked(targetKv, `${basePrefix}-pages/${idx}`))
  }
  if (cache) {
   cache.set(basePrefix, { pageCount: pageJsons.length, pageJsons })
  }
  return cleanIds
 })
}

export function deletePagedIds(kv, basePrefix) {
 const targetKv = unwrapKv(kv)
 const indexKey = `${basePrefix}-index`
 return enqueueWrite(targetKv, indexKey, async () => {
  const cache = targetKv && typeof targetKv === 'object' ? getKvMap(pagedIndexCache, targetKv) : null
  const prevInfo = await resolvePrevPagedInfo(targetKv, basePrefix)
  await kvDeleteChunkedUnlocked(targetKv, indexKey)
  if (prevInfo.pageCount > 0) {
   const stale = Array.from({ length: prevInfo.pageCount }, (_, i) => i)
   await mapConcurrent(stale, CONCURRENCY_LIMIT, idx => kvDeleteChunked(targetKv, `${basePrefix}-pages/${idx}`))
  }
  if (cache) {
   cache.delete(basePrefix)
  }
 })
}

export function resolveLaneStorage(rootKv, laneData, laneId) {
 const unwrappedRoot = unwrapKv(rootKv)
 const kv = (laneData && laneData.root) || unwrappedRoot || laneData
 let legacyKv = laneData || null
 if (!legacyKv && unwrappedRoot && typeof unwrappedRoot.namespace === 'function' && laneId) {
  legacyKv = unwrappedRoot.namespace(laneId)
 }
 return { kv, legacyKv }
}

// ---------- Tables split storage & instant migration ----------

export function laneTablesBase(laneId) {
 return `lanes#${encodeKeySegment(laneId)}/tables`
}

export function tableSchemaKey(laneId, tableId) {
 return `lanes#${encodeKeySegment(laneId)}/tables/${encodeKeySegment(tableId)}/schema`
}

export function tableRowsBase(laneId, tableId) {
 return `lanes#${encodeKeySegment(laneId)}/tables/${encodeKeySegment(tableId)}/rows`
}

export function tableRowKey(laneId, tableId, rowId) {
 return `lanes#${encodeKeySegment(laneId)}/tables/${encodeKeySegment(tableId)}/rows/${encodeKeySegment(rowId)}`
}

export function tableUpdatesKey(laneId, tableId) {
 return `lanes#${encodeKeySegment(laneId)}/tables/${encodeKeySegment(tableId)}/updates`
}

function normalizeSchemaRecord(rawSchema, tableIdFallback) {
 if (!rawSchema || typeof rawSchema !== 'object') {
  return null
 }
 const tableId = typeof rawSchema.id === 'string' && rawSchema.id.length > 0 ? rawSchema.id : String(tableIdFallback)
 const tableName = rawSchema.name === null || rawSchema.name === undefined ? '' : String(rawSchema.name)
 const columns = []
 const rawCols = Array.isArray(rawSchema.columns) ? rawSchema.columns : []
 for (let c = 0; c < rawCols.length; c++) {
  const col = rawCols[c]
  if (!col || typeof col !== 'object') {
   continue
  }
  const colId = typeof col.id === 'string' && col.id.length > 0 ? col.id : `col-${c + 1}`
  const colName = col.name === null || col.name === undefined ? '' : String(col.name)
  const parsedType = parseColumnType(col)
  const normalizedCol = {
   id: colId,
   name: colName,
   type: parsedType.type,
   multiple: parsedType.multiple,
  }
  if (parsedType.type === 'fixed') {
   normalizedCol.decimals = parsedType.decimals
  }
  else if (parsedType.type === 'row') {
   normalizedCol.refTableId = parsedType.refTableId
   normalizedCol.refColumnId = parsedType.refColumnId
   normalizedCol.refDisplayColumnId = parsedType.refDisplayColumnId
   if (parsedType.refFilterColumnId) {
    normalizedCol.refFilterColumnId = parsedType.refFilterColumnId
   }
   if (parsedType.filterByColumnId) {
    normalizedCol.filterByColumnId = parsedType.filterByColumnId
   }
  }
  else if (parsedType.type === 'text' && parsedType.constraint) {
   normalizedCol.constraint = parsedType.constraint
  }
  const width = normalizeColumnWidth(col.width)
  if (width !== null) {
   normalizedCol.width = width
  }
  if (col.required === true) {
   normalizedCol.required = true
  }
  columns.push(normalizedCol)
 }
 return { id: tableId, name: tableName, columns }
}

export function serializeTableSchema(table) {
 const normalized = normalizeSchemaRecord(table, table && table.id) || { id: '', name: '', columns: [] }
 return JSON.stringify(normalized)
}

export function serializeTableRow(row) {
 return JSON.stringify({
  id: row && row.id ? String(row.id) : '',
  values: row && row.values && typeof row.values === 'object' ? row.values : {},
 })
}

async function deleteTableKeys(kv, laneId, tableId, knownRowIds = null) {
 let rowIds = knownRowIds
 if (!Array.isArray(rowIds)) {
  const rowIdx = await readPagedIds(kv, tableRowsBase(laneId, tableId))
  rowIds = rowIdx.ids
 }
 await mapConcurrent(rowIds, CONCURRENCY_LIMIT, rowId => kvDeleteChunked(kv, tableRowKey(laneId, tableId, rowId)))
 await deletePagedIds(kv, tableRowsBase(laneId, tableId))
 await kvDeleteChunked(kv, tableSchemaKey(laneId, tableId))
 await kvDeleteChunked(kv, tableUpdatesKey(laneId, tableId))
}

async function writeSingleTableFull(kv, laneId, table) {
 const rows = Array.isArray(table.rows) ? table.rows : []
 const rowIds = rows.map(r => String(r.id))
 const nextRowIdSet = new Set(rowIds)
 const prevRowIdx = await readPagedIds(kv, tableRowsBase(laneId, table.id))
 await kvSetChunked(kv, tableSchemaKey(laneId, table.id), serializeTableSchema(table))
 await mapConcurrent(rows, CONCURRENCY_LIMIT, row => kvSetChunked(kv, tableRowKey(laneId, table.id, row.id), serializeTableRow(row)))
 await writePagedIds(kv, tableRowsBase(laneId, table.id), rowIds)
 if (prevRowIdx.exists && prevRowIdx.ids.length > 0) {
  const staleRowIds = prevRowIdx.ids.filter(rid => !nextRowIdSet.has(String(rid)))
  if (staleRowIds.length > 0) {
   await mapConcurrent(staleRowIds, CONCURRENCY_LIMIT, rid => kvDeleteChunked(kv, tableRowKey(laneId, table.id, rid)))
  }
 }
}

export async function loadLaneTables(rootKv, laneData, laneId) {
 const { kv, legacyKv } = resolveLaneStorage(rootKv, laneData, laneId)
 const [legacyRaw, modernTablesIdx] = await Promise.all([
  legacyKv ? legacyKv.get('tables') : Promise.resolve(null),
  readPagedIds(kv, laneTablesBase(laneId)),
 ])

 if (typeof legacyRaw === 'string' && legacyRaw.trim().startsWith('[')) {
  const migrated = parseStoredTables(legacyRaw)
  const newTableIds = migrated.map(t => String(t.id))
  const newTableIdSet = new Set(newTableIds)

  const oldRowsByTable = new Map()
  if (modernTablesIdx.exists) {
   const oldTableIdSet = new Set(modernTablesIdx.ids)
   const overlappingIds = newTableIds.filter(id => oldTableIdSet.has(id))
   const oldIndices = await mapConcurrent(overlappingIds, CONCURRENCY_LIMIT, id => readPagedIds(kv, tableRowsBase(laneId, id)))
   for (let i = 0; i < overlappingIds.length; i++) {
    if (oldIndices[i].exists) {
     oldRowsByTable.set(overlappingIds[i], oldIndices[i].ids)
    }
   }
  }

  await mapConcurrent(migrated, CONCURRENCY_LIMIT, tbl => writeSingleTableFull(kv, laneId, tbl))
  await writePagedIds(kv, laneTablesBase(laneId), newTableIds)

  if (modernTablesIdx.exists) {
   const staleTableIds = modernTablesIdx.ids.filter(id => !newTableIdSet.has(id))
   await mapConcurrent(staleTableIds, CONCURRENCY_LIMIT, oldId => deleteTableKeys(kv, laneId, oldId))
   for (const tbl of migrated) {
    const oldRowIds = oldRowsByTable.get(String(tbl.id))
    if (oldRowIds) {
     const newRowSet = new Set((tbl.rows || []).map(r => String(r.id)))
     const staleRowIds = oldRowIds.filter(rid => !newRowSet.has(rid))
     if (staleRowIds.length > 0) {
      await mapConcurrent(staleRowIds, CONCURRENCY_LIMIT, rid => kvDeleteChunked(kv, tableRowKey(laneId, tbl.id, rid)))
     }
    }
   }
  }

  await kvDelete(legacyKv, 'tables')
  return migrated
 }

 if (!modernTablesIdx.exists || modernTablesIdx.ids.length === 0) {
  return []
 }

 const tableEntries = await mapConcurrent(modernTablesIdx.ids, CONCURRENCY_LIMIT, async tableId => {
  const [schemaRaw, rowsIdx] = await Promise.all([
   kvGetChunked(kv, tableSchemaKey(laneId, tableId)),
   readPagedIds(kv, tableRowsBase(laneId, tableId)),
  ])
  if (isMissingValue(schemaRaw)) {
   return null
  }
  let parsedSchema
  try {
   parsedSchema = JSON.parse(schemaRaw)
  }
  catch {
   return null
  }
  const schema = normalizeSchemaRecord(parsedSchema, tableId)
  if (!schema) {
   return null
  }
  const rawRows = await mapConcurrent(rowsIdx.ids, CONCURRENCY_LIMIT, rowId => kvGetChunked(kv, tableRowKey(laneId, tableId, rowId)))
  return { schema, rowIds: rowsIdx.ids, rawRows }
 })

 const out = []
 const loadedRowsPerTable = []
 for (const entry of tableEntries) {
  if (!entry) {
   continue
  }
  out.push({ id: entry.schema.id, name: entry.schema.name, columns: entry.schema.columns, rows: [] })
  loadedRowsPerTable.push({ rowIds: entry.rowIds, rawRows: entry.rawRows })
 }

 for (let t = 0; t < out.length; t++) {
  const table = out[t]
  const { rowIds, rawRows } = loadedRowsPerTable[t]
  for (let r = 0; r < rawRows.length; r++) {
   const rowRaw = rawRows[r]
   if (isMissingValue(rowRaw)) {
    continue
   }
   let row
   try {
    row = JSON.parse(rowRaw)
   }
   catch {
    continue
   }
   if (!row || typeof row !== 'object') {
    continue
   }
   const rowId = typeof row.id === 'string' && row.id.length > 0 ? row.id : String(rowIds[r] || `row-${t + 1}-${r + 1}`)
   const rawValues = row.values && typeof row.values === 'object' ? row.values : {}
   const values = {}
   for (const col of table.columns) {
    if (Object.hasOwn(rawValues, col.id)) {
     values[col.id] = coerceDataValue(rawValues[col.id], col, col.multiple, null, out)
    }
    else {
     values[col.id] = defaultDataValue(col, col.multiple)
    }
   }
   table.rows.push({ id: rowId, values })
  }
 }
 return out
}

export async function saveTableRow(rootKv, laneData, laneId, tableId, row) {
 if (!tableId || !row || !row.id) {
  return
 }
 const { kv } = resolveLaneStorage(rootKv, laneData, laneId)
 await kvSetChunked(kv, tableRowKey(laneId, tableId, row.id), serializeTableRow(row))
}

export async function addTableRow(rootKv, laneData, laneId, tableId, row, allRowIds) {
 if (!tableId || !row || !row.id) {
  return
 }
 const { kv } = resolveLaneStorage(rootKv, laneData, laneId)
 await kvSetChunked(kv, tableRowKey(laneId, tableId, row.id), serializeTableRow(row))
 await writePagedIds(kv, tableRowsBase(laneId, tableId), allRowIds)
}

export async function deleteTableRow(rootKv, laneData, laneId, tableId, rowId, remainingRowIds) {
 if (!tableId || !rowId) {
  return
 }
 const { kv } = resolveLaneStorage(rootKv, laneData, laneId)
 await writePagedIds(kv, tableRowsBase(laneId, tableId), remainingRowIds)
 await kvDeleteChunked(kv, tableRowKey(laneId, tableId, rowId))
}

export async function clearTableRows(rootKv, laneData, laneId, tableId, removedRowIds) {
 if (!tableId) {
  return
 }
 const { kv } = resolveLaneStorage(rootKv, laneData, laneId)
 await writePagedIds(kv, tableRowsBase(laneId, tableId), [])
 const ids = Array.isArray(removedRowIds) ? removedRowIds : []
 await mapConcurrent(ids, CONCURRENCY_LIMIT, rowId => kvDeleteChunked(kv, tableRowKey(laneId, tableId, rowId)))
}

export async function saveTableSchema(rootKv, laneData, laneId, table) {
 if (!table || !table.id) {
  return
 }
 const { kv } = resolveLaneStorage(rootKv, laneData, laneId)
 await kvSetChunked(kv, tableSchemaKey(laneId, table.id), serializeTableSchema(table))
}

export async function saveTableSchemaAndRows(rootKv, laneData, laneId, table) {
 if (!table || !table.id) {
  return
 }
 const { kv } = resolveLaneStorage(rootKv, laneData, laneId)
 const rows = Array.isArray(table.rows) ? table.rows : []
 const rowIds = rows.map(r => String(r.id))
 const nextRowIdSet = new Set(rowIds)
 const prevRowIdx = await readPagedIds(kv, tableRowsBase(laneId, table.id))
 await kvSetChunked(kv, tableSchemaKey(laneId, table.id), serializeTableSchema(table))
 await mapConcurrent(rows, CONCURRENCY_LIMIT, row => kvSetChunked(kv, tableRowKey(laneId, table.id, row.id), serializeTableRow(row)))
 await writePagedIds(kv, tableRowsBase(laneId, table.id), rowIds)
 if (prevRowIdx.exists && prevRowIdx.ids.length > 0) {
  const staleRowIds = prevRowIdx.ids.filter(rid => !nextRowIdSet.has(String(rid)))
  if (staleRowIds.length > 0) {
   await mapConcurrent(staleRowIds, CONCURRENCY_LIMIT, rid => kvDeleteChunked(kv, tableRowKey(laneId, table.id, rid)))
  }
 }
}

const MAX_TABLE_UPDATES_HISTORY = 20

function normalizeTableUpdateEntry(raw, tableIdFallback = '') {
 if (!raw || typeof raw !== 'object') {
  return null
 }
 const id = raw.id ? String(raw.id).trim() : generateId('upd')
 const tableId = raw.tableId ? String(raw.tableId).trim() : String(tableIdFallback || '').trim()
 const tableName = raw.tableName === null || raw.tableName === undefined ? '' : String(raw.tableName).trim()
 const targetLaneId = raw.targetLaneId === null || raw.targetLaneId === undefined ? '' : String(raw.targetLaneId).trim()
 const targetLaneTitle = raw.targetLaneTitle === null || raw.targetLaneTitle === undefined
  ? targetLaneId
  : String(raw.targetLaneTitle).trim()
 const status = raw.status ? String(raw.status).trim() : 'deployed'
 const ok = raw.ok !== undefined ? Boolean(raw.ok) : status !== 'error'
 const slug = raw.slug === null || raw.slug === undefined ? '' : String(raw.slug).trim()
 const serverName = raw.serverName === null || raw.serverName === undefined ? '' : String(raw.serverName).trim()
 const publicUrl = raw.publicUrl === null || raw.publicUrl === undefined ? '' : String(raw.publicUrl).trim()
 const recordCount = Number.isFinite(Number(raw.recordCount)) ? Math.max(0, Math.trunc(Number(raw.recordCount))) : null
 const trigger = raw.trigger === null || raw.trigger === undefined ? '' : String(raw.trigger).trim()
 const summary = raw.summary === null || raw.summary === undefined ? '' : String(raw.summary).trim()
 const nowIso = new Date().toISOString()
 const triggeredAt = typeof raw.triggeredAt === 'string' && raw.triggeredAt.trim() ? raw.triggeredAt.trim() : nowIso
 const deployedAt = typeof raw.deployedAt === 'string' && raw.deployedAt.trim() ? raw.deployedAt.trim() : triggeredAt
 const error = raw.error ? String(raw.error) : null
 return {
  id,
  tableId,
  tableName,
  targetLaneId,
  targetLaneTitle,
  status,
  ok,
  slug,
  serverName,
  publicUrl,
  recordCount,
  trigger,
  summary,
  triggeredAt,
  deployedAt,
  error,
 }
}

export async function loadTableUpdates(rootKv, laneData, laneId, tableId) {
 if (!laneId || !tableId) {
  return []
 }
 const { kv } = resolveLaneStorage(rootKv, laneData, laneId)
 if (!kv) {
  return []
 }
 const raw = await kvGetChunked(kv, tableUpdatesKey(laneId, tableId))
 if (isMissingValue(raw)) {
  return []
 }
 try {
  const parsed = JSON.parse(raw)
  if (!Array.isArray(parsed)) {
   return []
  }
  return parsed.map(item => normalizeTableUpdateEntry(item, tableId)).filter(Boolean)
 }
 catch {
  return []
 }
}

export async function saveTableUpdates(rootKv, laneData, laneId, tableId, updates) {
 if (!laneId || !tableId) {
  return []
 }
 const { kv } = resolveLaneStorage(rootKv, laneData, laneId)
 const list = (Array.isArray(updates) ? updates : [])
  .map(item => normalizeTableUpdateEntry(item, tableId))
  .filter(Boolean)
  .slice(0, MAX_TABLE_UPDATES_HISTORY)
 if (!kv) {
  return list
 }
 if (list.length === 0) {
  await kvDeleteChunked(kv, tableUpdatesKey(laneId, tableId))
  return []
 }
 await kvSetChunked(kv, tableUpdatesKey(laneId, tableId), JSON.stringify(list))
 return list
}

export async function recordTableDeploymentUpdate(rootKv, laneData, laneId, tableId, entry) {
 if (!laneId || !tableId || !entry) {
  return []
 }
 const norm = normalizeTableUpdateEntry(entry, tableId)
 if (!norm) {
  return []
 }
 const existing = await loadTableUpdates(rootKv, laneData, laneId, tableId)
 const filtered = existing.filter(item => item && item.id !== norm.id)
 const next = [norm, ...filtered].slice(0, MAX_TABLE_UPDATES_HISTORY)
 return saveTableUpdates(rootKv, laneData, laneId, tableId, next)
}

export async function addLaneTable(rootKv, laneData, laneId, table, allTableIds) {
 if (!table || !table.id) {
  return
 }
 const { kv } = resolveLaneStorage(rootKv, laneData, laneId)
 await writeSingleTableFull(kv, laneId, table)
 await writePagedIds(kv, laneTablesBase(laneId), allTableIds)
}

export async function deleteLaneTable(rootKv, laneData, laneId, table, remainingTableIds) {
 if (!table || !table.id) {
  return
 }
 const { kv } = resolveLaneStorage(rootKv, laneData, laneId)
 await writePagedIds(kv, laneTablesBase(laneId), remainingTableIds)
 const rowIds = Array.isArray(table.rows) ? table.rows.map(r => String(r.id)) : null
 await deleteTableKeys(kv, laneId, table.id, rowIds)
}

export async function saveLaneTables(rootKv, laneData, laneId, tables) {
 const { kv } = resolveLaneStorage(rootKv, laneData, laneId)
 const list = Array.isArray(tables) ? tables : []
 const nextTableIds = list.map(t => String(t.id))
 const nextSet = new Set(nextTableIds)
 const prevIdx = await readPagedIds(kv, laneTablesBase(laneId))
 await mapConcurrent(list, CONCURRENCY_LIMIT, tbl => writeSingleTableFull(kv, laneId, tbl))
 await writePagedIds(kv, laneTablesBase(laneId), nextTableIds)
 if (prevIdx.exists) {
  const stale = prevIdx.ids.filter(id => !nextSet.has(id))
  await mapConcurrent(stale, CONCURRENCY_LIMIT, oldId => deleteTableKeys(kv, laneId, oldId))
 }
}

// ---------- Scripts per-line split storage, timestamps & migration ----------

export function laneScriptBase(laneId) {
 return `lanes#${encodeKeySegment(laneId)}/script`
}

export function scriptLineKey(laneId, lineId) {
 return `lanes#${encodeKeySegment(laneId)}/script/${encodeKeySegment(lineId)}`
}

let fallbackLineSeq = 0
export function generateLineId(win) {
 const c = (!win || win === globalThis) ? globalThis.crypto : globalThis.crypto
 if (c && typeof c.randomUUID === 'function') {
  return `ln-${c.randomUUID()}`
 }
 fallbackLineSeq += 1
 return `ln-${Date.now()}-${fallbackLineSeq}`
}

export function parseLegacyScript(stored) {
 if (stored === null || stored === undefined) {
  return ['']
 }
 const str = String(stored)
 if (str.startsWith('[')) {
  try {
   const parsed = JSON.parse(str)
   if (Array.isArray(parsed)) {
    return parsed.map(item => (item === null || item === undefined ? '' : String(item)))
   }
  }
  catch {
   return ['']
  }
 }
 return str.split('\n')
}

export function normalizeLineSetBy(raw) {
 if (!raw || typeof raw !== 'object') {
  return null
 }
 const laneId = raw.laneId === null || raw.laneId === undefined ? '' : String(raw.laneId).trim()
 const lineId = raw.lineId === null || raw.lineId === undefined ? '' : String(raw.lineId).trim()
 if (!laneId) {
  return null
 }
 return { laneId, lineId }
}

function serializeScriptLine(record) {
 const setBy = normalizeLineSetBy(record && record.setBy)
 const payload = {
  id: String(record.id),
  text: record.text === null || record.text === undefined ? '' : String(record.text),
  updatedAt: typeof record.updatedAt === 'string' && record.updatedAt.length > 0 ? record.updatedAt : null,
 }
 if (setBy) {
  payload.setBy = setBy
 }
 return JSON.stringify(payload)
}

export async function loadLaneScript(rootKv, laneData, laneId, win) {
 const { kv, legacyKv } = resolveLaneStorage(rootKv, laneData, laneId)
 const [legacyRaw, modernIdx] = await Promise.all([
  legacyKv ? legacyKv.get('script') : Promise.resolve(null),
  readPagedIds(kv, laneScriptBase(laneId)),
 ])

 if (typeof legacyRaw === 'string' && legacyRaw.length > 0) {
  const parsedLines = parseLegacyScript(legacyRaw)
  const records = parsedLines.map(text => ({
   id: generateLineId(win),
   text,
   updatedAt: null,
  }))
  const newIds = records.map(r => r.id)
  const newIdSet = new Set(newIds)
  await mapConcurrent(records, CONCURRENCY_LIMIT, rec => kvSetChunked(kv, scriptLineKey(laneId, rec.id), serializeScriptLine(rec)))
  await writePagedIds(kv, laneScriptBase(laneId), newIds)
  if (modernIdx.exists) {
   const staleIds = modernIdx.ids.filter(id => !newIdSet.has(id))
   await mapConcurrent(staleIds, CONCURRENCY_LIMIT, oldId => kvDeleteChunked(kv, scriptLineKey(laneId, oldId)))
  }
  await kvDelete(legacyKv, 'script')
  return { initialized: true, records }
 }

 if (modernIdx.exists) {
  if (modernIdx.ids.length === 0) {
   return { initialized: true, records: [] }
  }
  const raws = await mapConcurrent(modernIdx.ids, CONCURRENCY_LIMIT, lineId => kvGetChunked(kv, scriptLineKey(laneId, lineId)))
  const records = []
  for (let i = 0; i < modernIdx.ids.length; i++) {
   const lineId = modernIdx.ids[i]
   const raw = raws[i]
   if (isMissingValue(raw)) {
    continue
   }
   try {
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object') {
     const setBy = normalizeLineSetBy(parsed.setBy)
     const rec = {
      id: typeof parsed.id === 'string' && parsed.id.length > 0 ? parsed.id : lineId,
      text: parsed.text === null || parsed.text === undefined ? '' : String(parsed.text),
      updatedAt: typeof parsed.updatedAt === 'string' && parsed.updatedAt.length > 0 ? parsed.updatedAt : null,
     }
     if (setBy) {
      rec.setBy = setBy
     }
     records.push(rec)
     continue
    }
   }
   catch {
    records.push({ id: lineId, text: String(raw), updatedAt: null })
   }
  }
  return { initialized: true, records }
 }

 return {
  initialized: false,
  records: [{ id: generateLineId(win), text: '', updatedAt: null }],
 }
}

function assertParseableScriptLine(text, laneId, lineIndex = 0) {
 const cleanLane = laneId ? String(laneId).trim() : ''
 const res = validateFieldScriptLine(text, {
  filename: cleanLane || undefined,
  lineIndex,
 })
 if (!res.ok) {
  const err = new SyntaxError(
   `Cannot save unparseable FieldScript in lane "${cleanLane || 'lane'}" line ${lineIndex + 1}: ${res.error}`
  )
  err.syntaxError = true
  if (res.location) {
   err.fieldLocation = res.location
  }
  throw err
 }
}

function assertParseableScriptRecords(linesOrRecords, laneId) {
 const cleanLane = laneId ? String(laneId).trim() : ''
 const res = validateFieldScriptLines(linesOrRecords, {
  filename: cleanLane || undefined,
 })
 if (!res.ok) {
  const err = new SyntaxError(
   `Cannot save unparseable FieldScript in lane "${cleanLane || 'lane'}": ${res.error}`
  )
  err.syntaxError = true
  err.errors = res.errors
  if (res.errors[0] && res.errors[0].location) {
   err.fieldLocation = res.errors[0].location
  }
  throw err
 }
}

function resolveDraftDataDir(rootKvOrDataDir) {
 if (typeof rootKvOrDataDir === 'string') {
  return normalizeDataDir(rootKvOrDataDir)
 }
 if (rootKvOrDataDir && typeof rootKvOrDataDir === 'object') {
  const client = unwrapKv(rootKvOrDataDir)
  return normalizeDataDir(client && client.basePath)
 }
 return null
}

export function laneSourceDraftsStorageKey(laneId, rootKvOrDataDir = null) {
 const cleanLane = String(laneId || '').trim()
 const cleanDir = resolveDraftDataDir(rootKvOrDataDir)
 return cleanDir
  ? `${LANE_SOURCE_DRAFTS_STORAGE_PREFIX}:${cleanDir}:${cleanLane}`
  : `${LANE_SOURCE_DRAFTS_STORAGE_PREFIX}:${cleanLane}`
}

function normalizeSourceDraftEntry(raw, fallbackLineId = '') {
 if (!raw || typeof raw !== 'object') {
  return null
 }
 const lineId = String(raw.lineId || fallbackLineId || '').trim()
 if (!lineId) {
  return null
 }
 const lineIndex = Number.isInteger(raw.lineIndex) && raw.lineIndex >= 0 ? raw.lineIndex : null
 const text = raw.text === null || raw.text === undefined ? '' : String(raw.text)
 const savedText = raw.savedText === null || raw.savedText === undefined ? '' : String(raw.savedText)
 const error = raw.error ? String(raw.error) : 'Syntax error'
 const rejectedAt = typeof raw.rejectedAt === 'string' && raw.rejectedAt.trim()
  ? raw.rejectedAt.trim()
  : new Date().toISOString()
 const setBy = normalizeLineSetBy(raw.setBy)
 const out = {
  lineId,
  lineIndex,
  text,
  savedText,
  error,
  rejectedAt,
 }
 if (typeof raw.exprText === 'string') {
  out.exprText = raw.exprText
 }
 if (setBy) {
  out.setBy = setBy
 }
 return out
}

export function loadLaneSourceDrafts(rootKvOrDataDir, win, laneId) {
 const cleanLane = String(laneId || '').trim()
 if (!cleanLane) {
  return {}
 }
 const { local } = getWebStoragePair(win)
 const raw = local.getItem(laneSourceDraftsStorageKey(cleanLane, rootKvOrDataDir))
 if (isMissingValue(raw)) {
  return {}
 }
 try {
  const parsed = JSON.parse(raw)
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
   return {}
  }
  const out = {}
  for (const [key, item] of Object.entries(parsed)) {
   const norm = normalizeSourceDraftEntry(item, key)
   if (norm) {
    out[norm.lineId] = norm
   }
  }
  return out
 }
 catch {
  return {}
 }
}

export function listLaneSourceDrafts(rootKvOrDataDir, win, laneId) {
 return Object.values(loadLaneSourceDrafts(rootKvOrDataDir, win, laneId))
}

export function saveLaneSourceDraft(rootKvOrDataDir, win, laneId, draftSpec) {
 const cleanLane = String(laneId || '').trim()
 const norm = normalizeSourceDraftEntry(draftSpec)
 if (!cleanLane || !norm) {
  return null
 }
 const { local } = getWebStoragePair(win)
 const key = laneSourceDraftsStorageKey(cleanLane, rootKvOrDataDir)
 const existing = loadLaneSourceDrafts(rootKvOrDataDir, win, cleanLane)
 existing[norm.lineId] = norm
 local.setItem(key, JSON.stringify(existing))
 return norm
}

export function clearLaneSourceDraft(rootKvOrDataDir, win, laneId, lineId) {
 const cleanLane = String(laneId || '').trim()
 const cleanLine = String(lineId || '').trim()
 if (!cleanLane || !cleanLine) {
  return false
 }
 const { local } = getWebStoragePair(win)
 const key = laneSourceDraftsStorageKey(cleanLane, rootKvOrDataDir)
 const existing = loadLaneSourceDrafts(rootKvOrDataDir, win, cleanLane)
 if (!Object.hasOwn(existing, cleanLine)) {
  return false
 }
 delete existing[cleanLine]
 if (Object.keys(existing).length === 0) {
  local.removeItem(key)
 }
 else {
  local.setItem(key, JSON.stringify(existing))
 }
 return true
}

export function clearAllLaneSourceDrafts(rootKvOrDataDir, win, laneId) {
 const cleanLane = String(laneId || '').trim()
 if (!cleanLane) {
  return
 }
 const { local } = getWebStoragePair(win)
 local.removeItem(laneSourceDraftsStorageKey(cleanLane, rootKvOrDataDir))
}

export async function saveScriptLine(rootKv, laneData, laneId, record, allLineIds, ensureIndex = false, explicitTimestamp = undefined) {
 if (!record || !record.id) {
  return
 }
 const idx = Array.isArray(allLineIds) ? Math.max(0, allLineIds.indexOf(String(record.id))) : 0
 assertParseableScriptLine(record.text, laneId, idx)
 const { kv } = resolveLaneStorage(rootKv, laneData, laneId)
 const stamp = explicitTimestamp === undefined ? new Date().toISOString() : explicitTimestamp
 record.updatedAt = stamp
 await kvSetChunked(kv, scriptLineKey(laneId, record.id), serializeScriptLine(record))
 if (ensureIndex && Array.isArray(allLineIds)) {
  await writePagedIds(kv, laneScriptBase(laneId), allLineIds)
 }
 return record
}

export async function saveScriptLinesAndIndex(rootKv, laneData, laneId, dirtyRecords, allLineIds, removedLineIds = [], explicitTimestamp = undefined) {
 const dirty = Array.isArray(dirtyRecords) ? dirtyRecords : []
 for (let i = 0; i < dirty.length; i++) {
  const rec = dirty[i]
  if (rec) {
   const idx = Array.isArray(allLineIds) && rec.id ? Math.max(0, allLineIds.indexOf(String(rec.id))) : i
   assertParseableScriptLine(rec.text, laneId, idx)
  }
 }
 const { kv } = resolveLaneStorage(rootKv, laneData, laneId)
 const stamp = explicitTimestamp === undefined ? new Date().toISOString() : explicitTimestamp
 for (const rec of dirty) {
  if (rec) {
   rec.updatedAt = stamp
  }
 }
 await mapConcurrent(dirty, CONCURRENCY_LIMIT, rec => kvSetChunked(kv, scriptLineKey(laneId, rec.id), serializeScriptLine(rec)))
 if (Array.isArray(allLineIds)) {
  await writePagedIds(kv, laneScriptBase(laneId), allLineIds)
 }
 const removed = Array.isArray(removedLineIds) ? removedLineIds : []
 if (removed.length > 0) {
  await mapConcurrent(removed, CONCURRENCY_LIMIT, lineId => kvDeleteChunked(kv, scriptLineKey(laneId, lineId)))
 }
}

export async function saveLaneScript(rootKv, laneData, laneId, linesOrRecords, win, explicitTimestamp = undefined) {
 assertParseableScriptRecords(linesOrRecords, laneId)
 const { kv, legacyKv } = resolveLaneStorage(rootKv, laneData, laneId)
 const prevIdx = await readPagedIds(kv, laneScriptBase(laneId))
 const stamp = explicitTimestamp === undefined ? new Date().toISOString() : explicitTimestamp
 const records = Array.from(linesOrRecords || []).map(item => {
  if (item && typeof item === 'object') {
   const setBy = normalizeLineSetBy(item.setBy)
   const rec = {
    id: item.id || generateLineId(win),
    text: item.text === null || item.text === undefined ? '' : String(item.text),
    updatedAt: item.updatedAt === undefined ? stamp : item.updatedAt,
   }
   if (setBy) {
    rec.setBy = setBy
   }
   return rec
  }
  return {
   id: generateLineId(win),
   text: item === null || item === undefined ? '' : String(item),
   updatedAt: stamp,
  }
 })
 const newIds = records.map(r => r.id)
 const newSet = new Set(newIds)
 await mapConcurrent(records, CONCURRENCY_LIMIT, rec => kvSetChunked(kv, scriptLineKey(laneId, rec.id), serializeScriptLine(rec)))
 await writePagedIds(kv, laneScriptBase(laneId), newIds)
 if (prevIdx.exists) {
  const stale = prevIdx.ids.filter(id => !newSet.has(id))
  if (stale.length > 0) {
   await mapConcurrent(stale, CONCURRENCY_LIMIT, oldId => kvDeleteChunked(kv, scriptLineKey(laneId, oldId)))
  }
 }
 if (legacyKv) {
  const legacyRaw = await legacyKv.get('script')
  if (!isMissingValue(legacyRaw)) {
   await kvDelete(legacyKv, 'script')
  }
 }
 return records
}

export function formatLineTimestamp(isoString, options = {}) {
 return formatTimestampWithZone(isoString, options)
}

// ---------- Crypto & Storage Shims for Sessions & Packages ----------

const SHA256_K = new Uint32Array([
 0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
 0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
])

function sha256BytesFallback(bytes) {
 const rotr = (x, n) => (x >>> n) | (x << (32 - n))
 const len = bytes.length
 const bitLen = len * 8
 const padLen = ((len + 9 + 63) & ~63)
 const buf = new Uint8Array(padLen)
 buf.set(bytes)
 buf[len] = 0x80
 const dv = new DataView(buf.buffer)
 dv.setUint32(padLen - 8, Math.floor(bitLen / 0x100000000), false)
 dv.setUint32(padLen - 4, bitLen >>> 0, false)

 const h = new Uint32Array([
  0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
  0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
 ])
 const w = new Uint32Array(64)

 for (let offset = 0; offset < padLen; offset += 64) {
  for (let i = 0; i < 16; i++) {
   w[i] = dv.getUint32(offset + i * 4, false)
  }
  for (let i = 16; i < 64; i++) {
   const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3)
   const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10)
   w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0
  }
  let [a, b, c, d, e, f, g, hh] = h
  for (let i = 0; i < 64; i++) {
   const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)
   const ch = (e & f) ^ (~e & g)
   const temp1 = (hh + S1 + ch + SHA256_K[i] + w[i]) >>> 0
   const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)
   const maj = (a & b) ^ (a & c) ^ (b & c)
   const temp2 = (S0 + maj) >>> 0
   hh = g
   g = f
   f = e
   e = (d + temp1) >>> 0
   d = c
   c = b
   b = a
   a = (temp1 + temp2) >>> 0
  }
  h[0] = (h[0] + a) >>> 0
  h[1] = (h[1] + b) >>> 0
  h[2] = (h[2] + c) >>> 0
  h[3] = (h[3] + d) >>> 0
  h[4] = (h[4] + e) >>> 0
  h[5] = (h[5] + f) >>> 0
  h[6] = (h[6] + g) >>> 0
  h[7] = (h[7] + hh) >>> 0
 }
 const out = new Uint8Array(32)
 const outDv = new DataView(out.buffer)
 for (let i = 0; i < 8; i++) {
  outDv.setUint32(i * 4, h[i], false)
 }
 return out
}

function bytesToHex(uint8) {
 let out = ''
 for (const b of uint8) {
  out += b.toString(16).padStart(2, '0')
 }
 return out
}

function hexToBytes(hex) {
 const clean = String(hex || '').trim()
 if (clean.length === 0 || clean.length % 2 !== 0) {
  return new Uint8Array(0)
 }
 const out = new Uint8Array(clean.length / 2)
 for (let i = 0; i < out.length; i++) {
  out[i] = Number.parseInt(clean.slice(i * 2, i * 2 + 2), 16) || 0
 }
 return out
}

export async function hashPassphrase(passphrase, salt) {
 const payload = utf8Encoder.encode(`${String(salt)}:${String(passphrase)}`)
 const c = globalThis.crypto
 if (c && c.subtle && typeof c.subtle.digest === 'function') {
  try {
   const digest = await c.subtle.digest('SHA-256', payload)
   return bytesToHex(new Uint8Array(digest))
  }
  catch {
   // fall back to pure JS SHA-256
  }
 }
 return bytesToHex(sha256BytesFallback(payload))
}

let fallbackIdSeq = 0
function generateId(prefix) {
 const c = globalThis.crypto
 if (c && typeof c.randomUUID === 'function') {
  const raw = c.randomUUID()
  return prefix ? `${prefix}-${raw}` : raw
 }
 fallbackIdSeq += 1
 const raw = `${Date.now().toString(36)}-${fallbackIdSeq}`
 return prefix ? `${prefix}-${raw}` : raw
}

export function generateSalt() {
 const c = globalThis.crypto
 if (c && typeof c.getRandomValues === 'function') {
  const bytes = new Uint8Array(16)
  c.getRandomValues(bytes)
  return bytesToHex(bytes)
 }
 return generateId('salt')
}

function getWebStoragePair(win) {
 const key = win && typeof win === 'object' ? win : globalThis
 let fallback = fallbackStorages.get(key)
 if (!fallback) {
  const makeMem = () => {
   const map = new Map()
   return {
    getItem(k) { return map.has(k) ? map.get(k) : null },
    setItem(k, v) { map.set(k, String(v)) },
    removeItem(k) { map.delete(k) },
   }
  }
  fallback = { local: makeMem(), session: makeMem() }
  fallbackStorages.set(key, fallback)
 }
 const safeWrap = (candidate, backup) => {
  if (!candidate || typeof candidate.getItem !== 'function' || typeof candidate.setItem !== 'function') {
   return backup
  }
  return {
   getItem(k) {
    try { return candidate.getItem(k) }
    catch { return backup.getItem(k) }
   },
   setItem(k, v) {
    try { candidate.setItem(k, String(v)) }
    catch { backup.setItem(k, String(v)) }
   },
   removeItem(k) {
    try {
     if (typeof candidate.removeItem === 'function') {
      candidate.removeItem(k)
     }
     else {
      candidate.setItem(k, '')
     }
    }
    catch { backup.removeItem(k) }
   },
  }
 }
 return {
  local: safeWrap(win && win.localStorage, fallback.local),
  session: safeWrap(win && win.sessionStorage, fallback.session),
 }
}

function readRecentSessions(local) {
 const raw = local.getItem(RECENT_SESSIONS_STORAGE_KEY)
 if (isMissingValue(raw)) {
  return []
 }
 try {
  const parsed = JSON.parse(raw)
  if (!Array.isArray(parsed)) {
   return []
  }
  const out = []
  const seen = new Set()
  for (const item of parsed) {
   if (!item || typeof item !== 'object') {
    continue
   }
   const id = typeof item.id === 'string' ? item.id.trim() : ''
   if (!id || seen.has(id)) {
    continue
   }
   seen.add(id)
   const dataDir = normalizeDataDir(item.dataDir)
   out.push({
    id,
    name: typeof item.name === 'string' && item.name.trim() ? item.name.trim() : '',
    lastUsedAt: typeof item.lastUsedAt === 'string' ? item.lastUsedAt : '',
    dataDir,
    dataDirConfirmed: item.dataDirConfirmed === true || Boolean(dataDir),
   })
  }
  return out
 }
 catch {
  return []
 }
}

function writeRecentSession(local, id, name, dataDir = undefined, dataDirConfirmed = undefined) {
 const cleanId = String(id || '').trim()
 if (!cleanId) {
  return []
 }
 const existing = readRecentSessions(local)
 const prev = existing.find(item => item.id === cleanId)
 const resolvedName = name !== undefined && name !== null && String(name).trim()
  ? String(name).trim()
  : (prev && prev.name ? prev.name : '')
 const resolvedDir = dataDir !== undefined
  ? normalizeDataDir(dataDir)
  : (prev ? normalizeDataDir(prev.dataDir) : null)
 const resolvedConfirmed = dataDirConfirmed !== undefined
  ? Boolean(dataDirConfirmed) || Boolean(resolvedDir)
  : (prev ? Boolean(prev.dataDirConfirmed) || Boolean(resolvedDir) : false)
 const next = [
  {
   id: cleanId,
   name: resolvedName,
   lastUsedAt: new Date().toISOString(),
   dataDir: resolvedDir,
   dataDirConfirmed: resolvedConfirmed,
  },
  ...existing.filter(item => item.id !== cleanId),
 ].slice(0, MAX_RECENT_SESSIONS)
 local.setItem(RECENT_SESSIONS_STORAGE_KEY, JSON.stringify(next))
 return next
}

async function refreshRecentSessionsMeta(registryKv, local) {
 const current = readRecentSessions(local)
 if (!registryKv || current.length === 0) {
  return current
 }
 const rawMetas = await mapConcurrent(current, CONCURRENCY_LIMIT, item => kvGetChunked(registryKv, sessionMetaKey(item.id)))
 let changed = false
 const next = current.map((item, idx) => {
  const raw = rawMetas[idx]
  if (isMissingValue(raw)) {
   return item
  }
  try {
   const meta = JSON.parse(raw)
   if (!meta || typeof meta !== 'object') {
    return item
   }
   const nextName = meta.name && String(meta.name).trim() ? String(meta.name).trim() : item.name
   const nextDir = normalizeDataDir(meta.dataDir)
   const nextConfirmed = meta.dataDirConfirmed === true || Boolean(nextDir)
   if (nextName !== item.name || nextDir !== item.dataDir || nextConfirmed !== item.dataDirConfirmed) {
    changed = true
    return {
     ...item,
     name: nextName,
     dataDir: nextDir,
     dataDirConfirmed: nextConfirmed,
    }
   }
   return item
  }
  catch {
   return item
  }
 })
 if (changed) {
  local.setItem(RECENT_SESSIONS_STORAGE_KEY, JSON.stringify(next))
 }
 return next
}

function readSessionHistoryFromStorage(local) {
 const raw = local.getItem(SESSION_HISTORY_STORAGE_KEY)
 if (isMissingValue(raw)) {
  return []
 }
 try {
  const parsed = JSON.parse(raw)
  if (!Array.isArray(parsed)) {
   return []
  }
  const out = []
  for (const item of parsed) {
   if (!item || typeof item !== 'object') {
    continue
   }
   const sessionId = typeof item.sessionId === 'string' ? item.sessionId.trim() : ''
   if (!sessionId) {
    continue
   }
   const dataDir = normalizeDataDir(item.dataDir)
   out.push({
    id: typeof item.id === 'string' && item.id.trim() ? item.id.trim() : generateId('hist'),
    sessionId,
    sessionName: typeof item.sessionName === 'string' && item.sessionName.trim() ? item.sessionName.trim() : sessionId,
    startedAt: typeof item.startedAt === 'string' ? item.startedAt : '',
    endedAt: typeof item.endedAt === 'string' && item.endedAt.trim() ? item.endedAt : null,
    laneCount: Number.isInteger(item.laneCount) && item.laneCount >= 0 ? item.laneCount : 0,
    packageCount: Number.isInteger(item.packageCount) && item.packageCount >= 0 ? item.packageCount : 0,
    dataDir,
    dataDirConfirmed: item.dataDirConfirmed === true || Boolean(dataDir),
   })
  }
  return out
 }
 catch {
  return []
 }
}

export function readSessionHistory(win) {
 const { local } = getWebStoragePair(win)
 return readSessionHistoryFromStorage(local)
}

function updateSessionHistoryDataDir(local, sessionId, dataDir, dataDirConfirmed) {
 const cleanId = String(sessionId || '').trim()
 if (!cleanId) {
  return readSessionHistoryFromStorage(local)
 }
 const cleanDir = normalizeDataDir(dataDir)
 const confirmed = Boolean(dataDirConfirmed) || Boolean(cleanDir)
 const existing = readSessionHistoryFromStorage(local)
 let changed = false
 const next = existing.map(entry => {
  if (entry.sessionId !== cleanId) {
   return entry
  }
  if (entry.dataDir !== cleanDir || entry.dataDirConfirmed !== confirmed) {
   changed = true
   return { ...entry, dataDir: cleanDir, dataDirConfirmed: confirmed }
  }
  return entry
 })
 if (changed) {
  local.setItem(SESSION_HISTORY_STORAGE_KEY, JSON.stringify(next))
 }
 return next
}

function recordSessionHistory(local, sessionId, sessionName, laneCount = 0, packageCount = 0, dataDir = undefined, dataDirConfirmed = undefined) {
 const cleanId = String(sessionId || '').trim()
 if (!cleanId) {
  return readSessionHistoryFromStorage(local)
 }
 const now = new Date().toISOString()
 const cleanName = sessionName && String(sessionName).trim() ? String(sessionName).trim() : cleanId
 const cleanLanes = Number.isInteger(laneCount) && laneCount >= 0 ? laneCount : 0
 const cleanPkgs = Number.isInteger(packageCount) && packageCount >= 0 ? packageCount : 0
 const existing = readSessionHistoryFromStorage(local)
 const prevMatch = existing.find(item => item.sessionId === cleanId)
 const resolvedDir = dataDir !== undefined
  ? normalizeDataDir(dataDir)
  : (prevMatch ? normalizeDataDir(prevMatch.dataDir) : null)
 const resolvedConfirmed = dataDirConfirmed !== undefined
  ? Boolean(dataDirConfirmed) || Boolean(resolvedDir)
  : (prevMatch ? Boolean(prevMatch.dataDirConfirmed) || Boolean(resolvedDir) : false)
 if (existing.length > 0 && existing[0].sessionId === cleanId && !existing[0].endedAt) {
  existing[0] = {
   ...existing[0],
   sessionName: cleanName,
   laneCount: cleanLanes,
   packageCount: cleanPkgs,
   dataDir: resolvedDir,
   dataDirConfirmed: resolvedConfirmed,
  }
  local.setItem(SESSION_HISTORY_STORAGE_KEY, JSON.stringify(existing))
  return existing
 }
 if (existing.length > 0 && !existing[0].endedAt) {
  existing[0] = { ...existing[0], endedAt: now }
 }
 const entry = {
  id: generateId('hist'),
  sessionId: cleanId,
  sessionName: cleanName,
  startedAt: now,
  endedAt: null,
  laneCount: cleanLanes,
  packageCount: cleanPkgs,
  dataDir: resolvedDir,
  dataDirConfirmed: resolvedConfirmed,
 }
 const next = [entry, ...existing].slice(0, MAX_SESSION_HISTORY)
 local.setItem(SESSION_HISTORY_STORAGE_KEY, JSON.stringify(next))
 return next
}

export function formatSessionDuration(startedAt, endedAt) {
 if (!endedAt) {
  return 'Active now'
 }
 const startMs = Date.parse(startedAt)
 const endMs = Date.parse(endedAt)
 if (Number.isNaN(startMs) || Number.isNaN(endMs) || endMs <= startMs) {
  return '< 1m'
 }
 const totalSec = Math.floor((endMs - startMs) / 1000)
 if (totalSec < 60) {
  return '< 1m'
 }
 const totalMin = Math.floor(totalSec / 60)
 if (totalMin < 60) {
  return `${totalMin}m`
 }
 const hrs = Math.floor(totalMin / 60)
 const mins = totalMin % 60
 return mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`
}

// ---------- Packages & Sessions Key Builders ----------

export function lanePackageKey(laneId) {
 return `lanes#${encodeKeySegment(laneId)}/package`
}

export function packageMetaKey(packageId) {
 return `packages#${encodeKeySegment(packageId)}/meta`
}

export function packageLanesBase(packageId) {
 return `packages#${encodeKeySegment(packageId)}/lanes`
}

export function packageLaneKey(packageId, laneId) {
 return `packages#${encodeKeySegment(packageId)}/lanes/${encodeKeySegment(laneId)}`
}

export function packageSessionsBase(packageId) {
 return `packages#${encodeKeySegment(packageId)}/sessions`
}

export function sessionMetaKey(sessionId) {
 return `sessions#${encodeKeySegment(sessionId)}/meta`
}

export function sessionPackagesBase(sessionId) {
 return `sessions#${encodeKeySegment(sessionId)}/packages`
}

async function addSessionToPackageIndex(rootKv, packageId, sessionId) {
 const cleanPkg = String(packageId || '').trim()
 const cleanSess = String(sessionId || '').trim()
 if (!rootKv || !cleanPkg || !cleanSess) {
  return
 }
 const idx = await readPagedIds(rootKv, packageSessionsBase(cleanPkg))
 if (!idx.ids.includes(cleanSess)) {
  await writePagedIds(rootKv, packageSessionsBase(cleanPkg), [...idx.ids, cleanSess])
 }
}

async function removeSessionFromPackageIndex(rootKv, packageId, sessionId) {
 const cleanPkg = String(packageId || '').trim()
 const cleanSess = String(sessionId || '').trim()
 if (!rootKv || !cleanPkg || !cleanSess) {
  return
 }
 const idx = await readPagedIds(rootKv, packageSessionsBase(cleanPkg))
 if (idx.exists && idx.ids.includes(cleanSess)) {
  await writePagedIds(rootKv, packageSessionsBase(cleanPkg), idx.ids.filter(id => id !== cleanSess))
 }
}

export function normalizeSessionTableDisplayOptions(raw) {
 const out = {}
 if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
  return out
 }
 const keys = Object.keys(raw).sort()
 for (const k of keys) {
  const cleanKey = String(k || '').trim()
  if (!cleanKey) {
   continue
  }
  const val = raw[k]
  let subtableIds = []
  if (Array.isArray(val)) {
   subtableIds = val
  }
  else if (val && typeof val === 'object' && Array.isArray(val.subtables)) {
   subtableIds = val.subtables
  }
  else if (val && typeof val === 'object') {
   subtableIds = Object.keys(val).filter(sk => Boolean(val[sk]))
  }
  const uniqueIds = []
  const seen = new Set()
  for (const sid of subtableIds) {
   const cleanSid = String(sid || '').trim()
   if (cleanSid && !seen.has(cleanSid)) {
    seen.add(cleanSid)
    uniqueIds.push(cleanSid)
   }
  }
  uniqueIds.sort()
  if (uniqueIds.length > 0) {
   out[cleanKey] = uniqueIds
  }
 }
 return out
}

export function sessionTableDisplayOptionsEqual(a, b) {
 const normA = normalizeSessionTableDisplayOptions(a)
 const normB = normalizeSessionTableDisplayOptions(b)
 return JSON.stringify(normA) === JSON.stringify(normB)
}

export function normalizeSessionLinkIds(rawIds, selfSessionId = '') {
 const exclude = String(selfSessionId || '').trim()
 const list = Array.isArray(rawIds) ? rawIds : []
 const out = []
 const seen = new Set()
 for (const item of list) {
  const clean = item === null || item === undefined ? '' : String(item).trim()
  if (!clean || clean === exclude || seen.has(clean)) {
   continue
  }
  seen.add(clean)
  out.push(clean)
 }
 return out
}

function normalizeSessionPathname(rawPathname, fallbackLaneIds = []) {
 if (typeof rawPathname === 'string' && rawPathname.trim().length > 0) {
  const trimmed = rawPathname.trim()
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`
 }
 if (Array.isArray(fallbackLaneIds) && fallbackLaneIds.length > 0) {
  const segs = fallbackLaneIds.map(id => encodeURIComponent(String(id))).filter(Boolean)
  return segs.length > 0 ? `/${segs.join('/')}` : '/'
 }
 return '/'
}

function countPathnameLanes(pathname, fallbackLaneIds = []) {
 if (Array.isArray(fallbackLaneIds) && fallbackLaneIds.length > 0) {
  return fallbackLaneIds.length
 }
 if (typeof pathname !== 'string' || !pathname.trim() || pathname.trim() === '/') {
  return 0
 }
 return pathname.split('/').filter(Boolean).length
}

async function writeSessionMeta(registryKv, sessionKv, sessionId, meta) {
 const payload = JSON.stringify(meta)
 const key = sessionMetaKey(sessionId)
 if (registryKv) {
  await kvSetChunked(registryKv, key, payload)
 }
 if (sessionKv && sessionKv !== registryKv) {
  await kvSetChunked(sessionKv, key, payload)
 }
}

export async function listPackageSessions(rootKv, packageId) {
 const kv = unwrapKv(rootKv)
 const cleanPkg = String(packageId || '').trim() || DEFAULT_PACKAGE_ID
 if (!kv) {
  return { packageId: cleanPkg, sessions: [] }
 }
 const idx = await readPagedIds(kv, packageSessionsBase(cleanPkg))
 if (!idx.exists || idx.ids.length === 0) {
  return { packageId: cleanPkg, sessions: [] }
 }
 const rows = await mapConcurrent(idx.ids, CONCURRENCY_LIMIT, async sid => {
  const [rawMeta, pkgIdx] = await Promise.all([
   kvGetChunked(kv, sessionMetaKey(sid)),
   readPagedIds(kv, sessionPackagesBase(sid)),
  ])
  if (isMissingValue(rawMeta)) {
   return null
  }
  if (pkgIdx.exists && !pkgIdx.ids.includes(cleanPkg)) {
   return null
  }
  let meta
  try {
   meta = JSON.parse(rawMeta)
  }
  catch {
   return null
  }
  if (!meta || typeof meta !== 'object') {
   return null
  }
  const laneIds = Array.isArray(meta.laneIds) ? meta.laneIds.map(String) : []
  const pathname = normalizeSessionPathname(meta.pathname, laneIds)
  const dataDir = normalizeDataDir(meta.dataDir)
  const dataDirConfirmed = meta.dataDirConfirmed === true || Boolean(dataDir)
  return {
   id: String(meta.id || sid),
   name: meta.name ? String(meta.name) : `Session ${sid.slice(0, 8)}`,
   laneCount: countPathnameLanes(pathname, laneIds),
   packageCount: pkgIdx.exists ? pkgIdx.ids.length : 1,
   version: Number.isInteger(meta.version) && meta.version > 0 ? meta.version : 1,
   dataDir,
   dataDirConfirmed,
   updatedAt: meta.updatedAt || meta.createdAt || null,
  }
 })
 const sessions = rows.filter(Boolean).sort((a, b) => {
  const ta = a.updatedAt ? Date.parse(a.updatedAt) : 0
  const tb = b.updatedAt ? Date.parse(b.updatedAt) : 0
  return tb - ta
 })
 return { packageId: cleanPkg, sessions }
}

export async function listPackageLanes(rootKv, packageId) {
 const kv = unwrapKv(rootKv)
 const cleanPkg = String(packageId || '').trim() || DEFAULT_PACKAGE_ID
 if (!kv) {
  return { packageId: cleanPkg, lanes: [] }
 }
 const laneIdx = await readPagedIds(kv, packageLanesBase(cleanPkg))
 if (!laneIdx.exists || laneIdx.ids.length === 0) {
  return { packageId: cleanPkg, lanes: [] }
 }
 const raws = await mapConcurrent(laneIdx.ids, CONCURRENCY_LIMIT, laneId => kvGetChunked(kv, packageLaneKey(cleanPkg, laneId)))
 const lanes = []
 for (let i = 0; i < laneIdx.ids.length; i++) {
  const laneId = laneIdx.ids[i]
  const raw = raws[i]
  let title = laneId
  if (!isMissingValue(raw)) {
   try {
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object' && parsed.title !== undefined && parsed.title !== null) {
     title = String(parsed.title)
    }
   }
   catch {
    title = String(raw)
   }
  }
  lanes.push({ id: laneId, title, packageId: cleanPkg })
 }
 return { packageId: cleanPkg, lanes }
}

function sanitizePackageMeta(meta) {
 if (!meta || typeof meta !== 'object') {
  return null
 }
 return {
  id: String(meta.id),
  name: meta.name === null || meta.name === undefined ? String(meta.id) : String(meta.name),
  hasPassphrase: Boolean(meta.hasPassphrase),
  createdAt: meta.createdAt || null,
  updatedAt: meta.updatedAt || null,
 }
}

async function readRawPackageMeta(kv, packageId) {
 const targetKv = unwrapKv(kv)
 const raw = await kvGetChunked(targetKv, packageMetaKey(packageId))
 if (isMissingValue(raw)) {
  return null
 }
 try {
  const parsed = JSON.parse(raw)
  return parsed && typeof parsed === 'object' ? parsed : null
 }
 catch {
  return null
 }
}

export async function getPackageMeta(rootKv, packageId) {
 const kv = unwrapKv(rootKv)
 const cleanId = String(packageId || '').trim() || DEFAULT_PACKAGE_ID
 const raw = await readRawPackageMeta(kv, cleanId)
 if (raw) {
  return sanitizePackageMeta(raw)
 }
 if (cleanId === DEFAULT_PACKAGE_ID) {
  return await ensureDefaultPackage(kv)
 }
 return null
}

export async function ensureDefaultPackage(rootKv) {
 const kv = unwrapKv(rootKv)
 if (!kv) {
  return {
   id: DEFAULT_PACKAGE_ID,
   name: DEFAULT_PACKAGE_NAME,
   hasPassphrase: false,
   createdAt: null,
   updatedAt: null,
  }
 }
 const existing = await readRawPackageMeta(kv, DEFAULT_PACKAGE_ID)
 if (existing) {
  return sanitizePackageMeta(existing)
 }
 const now = new Date().toISOString()
 const meta = {
  id: DEFAULT_PACKAGE_ID,
  name: DEFAULT_PACKAGE_NAME,
  hasPassphrase: false,
  passphraseSalt: null,
  passphraseHash: null,
  createdAt: now,
  updatedAt: now,
 }
 await kvSetChunked(kv, packageMetaKey(DEFAULT_PACKAGE_ID), JSON.stringify(meta))
 const idx = await readPagedIds(kv, packageLanesBase(DEFAULT_PACKAGE_ID))
 if (!idx.exists) {
  await writePagedIds(kv, packageLanesBase(DEFAULT_PACKAGE_ID), [])
 }
 return sanitizePackageMeta(meta)
}

export async function getLanePackageId(rootKv, laneId) {
 const kv = unwrapKv(rootKv)
 if (!kv || !laneId) {
  return DEFAULT_PACKAGE_ID
 }
 const raw = await kvGetChunked(kv, lanePackageKey(laneId))
 if (isMissingValue(raw)) {
  return DEFAULT_PACKAGE_ID
 }
 const trimmed = String(raw).trim()
 return trimmed.length > 0 ? trimmed : DEFAULT_PACKAGE_ID
}

export async function migrateLegacyCatalog(rootKv) {
 const kv = unwrapKv(rootKv)
 if (!kv) {
  return false
 }
 const raw = await kv.get('lanes')
 const trimmedRaw = isMissingValue(raw) ? '' : String(raw).trim()
 if (!trimmedRaw.startsWith('{') && !trimmedRaw.startsWith('[')) {
  return false
 }
 let parsed
 try {
  parsed = JSON.parse(trimmedRaw)
 }
 catch {
  return false
 }
 if (!parsed || typeof parsed !== 'object') {
  return false
 }
 await ensureDefaultPackage(kv)
 const entries = Object.values(parsed)
 const grouped = new Map()
 await mapConcurrent(entries, CONCURRENCY_LIMIT, async entry => {
  if (!entry || typeof entry !== 'object') {
   return
  }
  const laneId = typeof entry.id === 'string' ? entry.id.trim() : ''
  if (!laneId) {
   return
  }
  const existingPkg = await kvGetChunked(kv, lanePackageKey(laneId))
  const packageId = !isMissingValue(existingPkg) && String(existingPkg).trim()
   ? String(existingPkg).trim()
   : DEFAULT_PACKAGE_ID
  if (isMissingValue(existingPkg)) {
   await kvSetChunked(kv, lanePackageKey(laneId), packageId)
  }
  const title = entry.title === null || entry.title === undefined ? laneId : String(entry.title)
  const record = { id: laneId, title, packageId }
  await kvSetChunked(kv, packageLaneKey(packageId, laneId), JSON.stringify(record))
  let list = grouped.get(packageId)
  if (!list) {
   list = []
   grouped.set(packageId, list)
  }
  list.push(laneId)
 })

 for (const [packageId, laneIds] of grouped.entries()) {
  const existingIdx = await readPagedIds(kv, packageLanesBase(packageId))
  const seen = new Set(existingIdx.ids)
  const merged = [...existingIdx.ids]
  for (const id of laneIds) {
   if (!seen.has(id)) {
    seen.add(id)
    merged.push(id)
   }
  }
  await writePagedIds(kv, packageLanesBase(packageId), merged)
 }
 await kvDelete(kv, 'lanes')
 return true
}

async function loadOrCreateSessionRecord(rootKv, sessionId, defaultName = '', opts = {}) {
 const cleanId = String(sessionId || '').trim()
 const registryKv = resolveRegistryKv(rootKv)
 let meta = null
 let isNew = false
 const rawMeta = registryKv ? await kvGetChunked(registryKv, sessionMetaKey(cleanId)) : null
 if (!isMissingValue(rawMeta)) {
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

 const now = new Date().toISOString()
 let dataDir
 let dataDirConfirmed
 if (meta) {
  dataDir = normalizeDataDir(meta.dataDir)
  dataDirConfirmed = meta.dataDirConfirmed === true || Boolean(dataDir)
 }
 else {
  dataDir = normalizeDataDir(opts && opts.dataDir)
  dataDirConfirmed = opts && opts.dataDirConfirmed !== undefined
   ? (Boolean(opts.dataDirConfirmed) || Boolean(dataDir))
   : Boolean(dataDir)
 }

 const sessionKv = resolveSessionKv(rootKv, dataDir)
 await ensureDefaultPackage(sessionKv)

 if (!meta) {
  isNew = true
  meta = {
   id: cleanId,
   name: defaultName || `Session ${cleanId.slice(0, 8)}`,
   activePackageId: DEFAULT_PACKAGE_ID,
   laneIds: [],
   pathname: '/',
   version: 1,
   forkedFrom: null,
   dataDir,
   dataDirConfirmed,
   previousSessionIds: normalizeSessionLinkIds(opts && opts.previousSessionIds, cleanId),
   nextSessionIds: normalizeSessionLinkIds(opts && opts.nextSessionIds, cleanId),
   createdAt: now,
   updatedAt: now,
  }
  await writeSessionMeta(registryKv, sessionKv, cleanId, meta)
 }

 let pkgIdx = sessionKv ? await readPagedIds(sessionKv, sessionPackagesBase(cleanId)) : { exists: false, ids: [] }
 if (!pkgIdx.exists) {
  pkgIdx = { exists: true, ids: [DEFAULT_PACKAGE_ID] }
  if (sessionKv) {
   await writePagedIds(sessionKv, sessionPackagesBase(cleanId), pkgIdx.ids)
   await addSessionToPackageIndex(sessionKv, DEFAULT_PACKAGE_ID, cleanId)
  }
 }

 const openPackageIds = []
 const seen = new Set()
 for (const id of pkgIdx.ids) {
  const p = String(id).trim()
  if (p && !seen.has(p)) {
   seen.add(p)
   openPackageIds.push(p)
  }
 }

 const rawMetas = await mapConcurrent(openPackageIds, CONCURRENCY_LIMIT, pid => getPackageMeta(sessionKv, pid))
 const openPackages = []
 const validIds = []
 for (let i = 0; i < openPackageIds.length; i++) {
  const pkg = rawMetas[i]
  if (pkg) {
   openPackages.push(pkg)
   validIds.push(pkg.id)
  }
 }

 const laneIds = Array.isArray(meta.laneIds) ? meta.laneIds.map(String).filter(Boolean) : []
 const pathname = normalizeSessionPathname(meta.pathname, laneIds)
 const version = Number.isInteger(meta.version) && meta.version > 0 ? meta.version : 1
 const forkedFrom = typeof meta.forkedFrom === 'string' && meta.forkedFrom.trim() ? meta.forkedFrom.trim() : null
 const previousSessionIds = normalizeSessionLinkIds(meta.previousSessionIds, cleanId)
 const nextSessionIds = normalizeSessionLinkIds(meta.nextSessionIds, cleanId)
 const tableDisplayOptions = normalizeSessionTableDisplayOptions(meta.tableDisplayOptions)

 let activePackageId = typeof meta.activePackageId === 'string' && validIds.includes(meta.activePackageId)
  ? meta.activePackageId
  : (validIds[0] || '')

 if (activePackageId !== meta.activePackageId && (registryKv || sessionKv)) {
  meta.activePackageId = activePackageId
  meta.dataDir = dataDir
  meta.dataDirConfirmed = dataDirConfirmed
  meta.previousSessionIds = previousSessionIds
  meta.nextSessionIds = nextSessionIds
  meta.tableDisplayOptions = tableDisplayOptions
  meta.updatedAt = now
  await writeSessionMeta(registryKv, sessionKv, cleanId, meta)
 }

 return {
  isNew,
  dataDir,
  dataDirConfirmed,
  meta: {
   id: meta.id,
   name: meta.name || `Session ${cleanId.slice(0, 8)}`,
   activePackageId,
   laneIds,
   pathname,
   version,
   forkedFrom,
   dataDir,
   dataDirConfirmed,
   previousSessionIds,
   nextSessionIds,
   tableDisplayOptions,
   createdAt: meta.createdAt || now,
   updatedAt: meta.updatedAt || now,
  },
  laneIds,
  pathname,
  previousSessionIds,
  nextSessionIds,
  tableDisplayOptions,
  openPackageIds: validIds,
  openPackages,
  activePackageId,
 }
}

async function buildSessionState(rootKv, win, browserSessionId, activeSessionId, defaultName = '', opts = {}) {
 const registryKv = resolveRegistryKv(rootKv)
 const loaded = await loadOrCreateSessionRecord(rootKv, activeSessionId, defaultName, opts)
 const sessionKv = activateSessionKv(rootKv, loaded.meta.dataDir)
 await migrateLegacyCatalog(sessionKv)
 const { local } = getWebStoragePair(win)
 await refreshRecentSessionsMeta(registryKv, local)
 writeRecentSession(local, browserSessionId)
 const recentSessions = writeRecentSession(
  local,
  activeSessionId,
  loaded.meta.name,
  loaded.meta.dataDir,
  loaded.meta.dataDirConfirmed,
 )
 const sessionHistory = recordSessionHistory(
  local,
  activeSessionId,
  loaded.meta.name,
  countPathnameLanes(loaded.pathname, loaded.laneIds),
  loaded.openPackageIds.length,
  loaded.meta.dataDir,
  loaded.meta.dataDirConfirmed,
 )
 return {
  sessionId: activeSessionId,
  browserSessionId,
  isOverridden: activeSessionId !== browserSessionId,
  isNew: loaded.isNew,
  dataDir: loaded.meta.dataDir,
  dataDirConfirmed: loaded.meta.dataDirConfirmed,
  meta: loaded.meta,
  laneIds: loaded.laneIds,
  pathname: loaded.pathname,
  previousSessionIds: loaded.previousSessionIds,
  nextSessionIds: loaded.nextSessionIds,
  tableDisplayOptions: loaded.tableDisplayOptions,
  openPackageIds: loaded.openPackageIds,
  openPackages: loaded.openPackages,
  activePackageId: loaded.activePackageId,
  recentSessions,
  sessionHistory,
 }
}

export function initSessionState(rootKv, win) {
 return enqueueWrite(resolveRegistryKv(rootKv) || win, '__session_init__', async () => {
  const { local, session } = getWebStoragePair(win)
  let browserSessionId = (local.getItem(SESSION_STORAGE_KEY) || '').trim()
  if (!browserSessionId) {
   browserSessionId = generateId('')
   local.setItem(SESSION_STORAGE_KEY, browserSessionId)
  }
  let tabSessionId = (session.getItem(SESSION_STORAGE_KEY) || '').trim()
  if (!tabSessionId) {
   tabSessionId = browserSessionId
   session.setItem(SESSION_STORAGE_KEY, tabSessionId)
  }
  return buildSessionState(rootKv, win, browserSessionId, tabSessionId)
 })
}

export async function switchTabSession(rootKv, win, nextSessionId, opts = {}) {
 const { local, session } = getWebStoragePair(win)
 let browserSessionId = (local.getItem(SESSION_STORAGE_KEY) || '').trim()
 if (!browserSessionId) {
  browserSessionId = generateId('', win)
  local.setItem(SESSION_STORAGE_KEY, browserSessionId)
 }
 const cleanNext = String(nextSessionId || '').trim() || generateId('', win)
 session.setItem(SESSION_STORAGE_KEY, cleanNext)
 return buildSessionState(rootKv, win, browserSessionId, cleanNext, opts && opts.name ? String(opts.name) : '', opts)
}

export async function createNewTabSession(rootKv, win, nameOrOpts = '', maybeOpts = {}) {
 const opts = nameOrOpts && typeof nameOrOpts === 'object'
  ? nameOrOpts
  : { ...(maybeOpts || {}), name: nameOrOpts || (maybeOpts && maybeOpts.name ? maybeOpts.name : '') }
 const nextId = generateId('', win)
 return switchTabSession(rootKv, win, nextId, opts)
}

export async function createNewSession(rootKv, win, opts = {}) {
 const nextId = generateId('', win)
 const cleanOpts = opts && typeof opts === 'object' ? opts : {}
 if (cleanOpts.tabOnly) {
  return switchTabSession(rootKv, win, nextId, cleanOpts)
 }
 return switchBrowserSession(rootKv, win, nextId, cleanOpts)
}

export async function returnToBrowserSession(rootKv, win) {
 const { local, session } = getWebStoragePair(win)
 let browserSessionId = (local.getItem(SESSION_STORAGE_KEY) || '').trim()
 if (!browserSessionId) {
  browserSessionId = generateId('', win)
  local.setItem(SESSION_STORAGE_KEY, browserSessionId)
 }
 session.setItem(SESSION_STORAGE_KEY, browserSessionId)
 return buildSessionState(rootKv, win, browserSessionId, browserSessionId)
}

export async function promoteTabToBrowserSession(rootKv, win) {
 const { local, session } = getWebStoragePair(win)
 let tabSessionId = (session.getItem(SESSION_STORAGE_KEY) || '').trim()
 if (!tabSessionId) {
  tabSessionId = (local.getItem(SESSION_STORAGE_KEY) || '').trim() || generateId('', win)
  session.setItem(SESSION_STORAGE_KEY, tabSessionId)
 }
 local.setItem(SESSION_STORAGE_KEY, tabSessionId)
 return buildSessionState(rootKv, win, tabSessionId, tabSessionId)
}

export async function switchBrowserSession(rootKv, win, nextSessionId, opts = {}) {
 const { local, session } = getWebStoragePair(win)
 const cleanNext = String(nextSessionId || '').trim() || generateId('', win)
 local.setItem(SESSION_STORAGE_KEY, cleanNext)
 session.setItem(SESSION_STORAGE_KEY, cleanNext)
 return buildSessionState(rootKv, win, cleanNext, cleanNext, opts && opts.name ? String(opts.name) : '', opts)
}

export async function renameSession(rootKv, win, sessionId, nextName) {
 const cleanId = String(sessionId || '').trim()
 if (!cleanId) {
  return null
 }
 const registryKv = resolveRegistryKv(rootKv)
 const loaded = await loadOrCreateSessionRecord(rootKv, cleanId)
 const sessionKv = resolveSessionKv(rootKv, loaded.meta.dataDir)
 const trimmed = String(nextName || '').trim() || loaded.meta.name
 const now = new Date().toISOString()
 const nextMeta = { ...loaded.meta, name: trimmed, updatedAt: now }
 await writeSessionMeta(registryKv, sessionKv, cleanId, nextMeta)
 const { local } = getWebStoragePair(win)
 const recentSessions = writeRecentSession(
  local,
  cleanId,
  trimmed,
  loaded.meta.dataDir,
  loaded.meta.dataDirConfirmed,
 )
 const sessionHistory = recordSessionHistory(
  local,
  cleanId,
  trimmed,
  loaded.laneIds.length,
  loaded.openPackageIds.length,
  loaded.meta.dataDir,
  loaded.meta.dataDirConfirmed,
 )
 return { meta: nextMeta, recentSessions, sessionHistory }
}

export async function setSessionLinks(rootKv, win, sessionId, opts = {}) {
 const cleanId = String(sessionId || '').trim()
 if (!cleanId) {
  return { ok: false, error: 'Session ID is required', meta: null, previousSessionIds: [], nextSessionIds: [] }
 }
 const registryKv = resolveRegistryKv(rootKv)
 const loaded = await loadOrCreateSessionRecord(rootKv, cleanId)
 const sessionKv = resolveSessionKv(rootKv, loaded.meta.dataDir)
 const previousSessionIds = opts && opts.previousSessionIds !== undefined
  ? normalizeSessionLinkIds(opts.previousSessionIds, cleanId)
  : loaded.previousSessionIds
 const nextSessionIds = opts && opts.nextSessionIds !== undefined
  ? normalizeSessionLinkIds(opts.nextSessionIds, cleanId)
  : loaded.nextSessionIds
 const now = new Date().toISOString()
 const nextMeta = {
  ...loaded.meta,
  previousSessionIds,
  nextSessionIds,
  updatedAt: now,
 }
 await writeSessionMeta(registryKv, sessionKv, cleanId, nextMeta)
 return {
  ok: true,
  meta: nextMeta,
  previousSessionIds,
  nextSessionIds,
 }
}

export async function resolveSessionLinks(rootKv, win, sessionIds, excludeSessionId = '') {
 const cleanIds = normalizeSessionLinkIds(sessionIds, excludeSessionId)
 if (cleanIds.length === 0) {
  return []
 }
 const registryKv = resolveRegistryKv(rootKv)
 const { local } = getWebStoragePair(win)
 const recentById = new Map()
 for (const item of readRecentSessions(local)) {
  recentById.set(item.id, item)
 }
 for (const entry of readSessionHistoryFromStorage(local)) {
  if (!recentById.has(entry.sessionId)) {
   recentById.set(entry.sessionId, {
    id: entry.sessionId,
    name: entry.sessionName,
    dataDir: entry.dataDir,
    dataDirConfirmed: entry.dataDirConfirmed,
   })
  }
 }
 if (!registryKv) {
  return cleanIds.map(id => {
   const fallback = recentById.get(id)
   return {
    id,
    name: (fallback && fallback.name) || id,
    dataDir: fallback ? normalizeDataDir(fallback.dataDir) : null,
    dataDirConfirmed: fallback ? Boolean(fallback.dataDirConfirmed) : false,
    available: false,
   }
  })
 }
 const rawMetas = await mapConcurrent(cleanIds, CONCURRENCY_LIMIT, id => kvGetChunked(registryKv, sessionMetaKey(id)))
 return cleanIds.map((id, idx) => {
  const raw = rawMetas[idx]
  const fallback = recentById.get(id)
  if (!isMissingValue(raw)) {
   try {
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object') {
     const dataDir = normalizeDataDir(parsed.dataDir)
     const dataDirConfirmed = parsed.dataDirConfirmed === true || Boolean(dataDir)
     const name = parsed.name && String(parsed.name).trim()
      ? String(parsed.name).trim()
      : ((fallback && fallback.name) || `Session ${id.slice(0, 8)}`)
     return {
      id: String(parsed.id || id),
      name,
      dataDir,
      dataDirConfirmed,
      available: true,
     }
    }
   }
   catch {
    // treat malformed meta as unavailable
   }
  }
  return {
   id,
   name: (fallback && fallback.name) || id,
   dataDir: fallback ? normalizeDataDir(fallback.dataDir) : null,
   dataDirConfirmed: fallback ? Boolean(fallback.dataDirConfirmed) : false,
   available: false,
  }
 })
}

export async function listAvailableSessions(rootKv, win, excludeSessionId = '', extraIds = []) {
 const { local } = getWebStoragePair(win)
 const candidateIds = []
 for (const item of readRecentSessions(local)) {
  candidateIds.push(item.id)
 }
 for (const entry of readSessionHistoryFromStorage(local)) {
  candidateIds.push(entry.sessionId)
 }
 if (Array.isArray(extraIds)) {
  for (const id of extraIds) {
   candidateIds.push(id)
  }
 }
 const resolved = await resolveSessionLinks(rootKv, win, candidateIds, excludeSessionId)
 return resolved.filter(item => item.available)
}

export async function saveSessionVersion(rootKv, win, sessionId, opts = {}) {
 const cleanId = String(sessionId || '').trim()
 if (!cleanId) {
  return null
 }
 const registryKv = resolveRegistryKv(rootKv)
 const loaded = await loadOrCreateSessionRecord(rootKv, cleanId)
 const sessionKv = resolveSessionKv(rootKv, loaded.meta.dataDir)
 const prevPkgIds = loaded.openPackageIds
 const nextLaneIds = Array.isArray(opts.laneIds)
  ? Array.from(opts.laneIds, String).filter(Boolean)
  : loaded.laneIds
 const nextPathname = opts.pathname !== undefined && opts.pathname !== null
  ? normalizeSessionPathname(opts.pathname, nextLaneIds)
  : (Array.isArray(opts.laneIds) ? normalizeSessionPathname('', nextLaneIds) : loaded.pathname)
 const rawPkgIds = Array.isArray(opts.openPackageIds)
  ? Array.from(opts.openPackageIds, String).filter(Boolean)
  : prevPkgIds
 const nextPkgIds = []
 const pkgSeen = new Set()
 for (const pid of rawPkgIds) {
  if (!pkgSeen.has(pid)) {
   pkgSeen.add(pid)
   nextPkgIds.push(pid)
  }
 }
 const nextActivePkg = typeof opts.activePackageId === 'string' && nextPkgIds.includes(opts.activePackageId)
  ? opts.activePackageId
  : (nextPkgIds[0] || '')
 const nextName = opts.name !== undefined && opts.name !== null && String(opts.name).trim()
  ? String(opts.name).trim()
  : loaded.meta.name
 const shouldIncrement = opts.incrementVersion !== false
 const nextVersion = shouldIncrement ? (loaded.meta.version + 1) : loaded.meta.version
 const nextTableDisplayOptions = opts.tableDisplayOptions !== undefined
  ? normalizeSessionTableDisplayOptions(opts.tableDisplayOptions)
  : loaded.tableDisplayOptions
 const now = new Date().toISOString()
 const nextMeta = {
  ...loaded.meta,
  name: nextName,
  laneIds: nextLaneIds,
  pathname: nextPathname,
  activePackageId: nextActivePkg,
  tableDisplayOptions: nextTableDisplayOptions,
  version: nextVersion,
  updatedAt: now,
 }
 if (sessionKv) {
  await writePagedIds(sessionKv, sessionPackagesBase(cleanId), nextPkgIds)
  const addedPkgs = nextPkgIds.filter(pid => !prevPkgIds.includes(pid))
  const removedPkgs = prevPkgIds.filter(pid => !nextPkgIds.includes(pid))
  await mapConcurrent(addedPkgs, CONCURRENCY_LIMIT, pid => addSessionToPackageIndex(sessionKv, pid, cleanId))
  await mapConcurrent(removedPkgs, CONCURRENCY_LIMIT, pid => removeSessionFromPackageIndex(sessionKv, pid, cleanId))
 }
 await writeSessionMeta(registryKv, sessionKv, cleanId, nextMeta)
 const refreshed = await loadOrCreateSessionRecord(rootKv, cleanId)
 const { local } = getWebStoragePair(win)
 const recentSessions = writeRecentSession(
  local,
  cleanId,
  refreshed.meta.name,
  refreshed.meta.dataDir,
  refreshed.meta.dataDirConfirmed,
 )
 const sessionHistory = recordSessionHistory(
  local,
  cleanId,
  refreshed.meta.name,
  refreshed.laneIds.length,
  refreshed.openPackageIds.length,
  refreshed.meta.dataDir,
  refreshed.meta.dataDirConfirmed,
 )
 return {
  ...refreshed,
  recentSessions,
  sessionHistory,
 }
}

export async function forkSession(rootKv, win, sourceSessionId, opts = {}) {
 const registryKv = resolveRegistryKv(rootKv)
 const srcId = String(sourceSessionId || '').trim()
 const srcLoaded = srcId ? await loadOrCreateSessionRecord(rootKv, srcId) : null
 if (srcId && Array.isArray(opts.restoreSourcePackageIds) && (registryKv || rootKv)) {
  const restoreIds = Array.from(opts.restoreSourcePackageIds, String).filter(Boolean)
  const restoreActive = typeof opts.restoreSourceActivePackageId === 'string' && restoreIds.includes(opts.restoreSourceActivePackageId)
   ? opts.restoreSourceActivePackageId
   : (restoreIds[0] || '')
  await saveSessionVersion(rootKv, win, srcId, {
   laneIds: srcLoaded ? srcLoaded.laneIds : [],
   pathname: srcLoaded ? srcLoaded.pathname : '/',
   openPackageIds: restoreIds,
   activePackageId: restoreActive,
   incrementVersion: false,
  })
 }
 const nextId = generateId('', win)
 const laneIds = Array.isArray(opts.laneIds)
  ? Array.from(opts.laneIds, String).filter(Boolean)
  : (srcLoaded ? srcLoaded.laneIds : [])
 const pathname = opts.pathname !== undefined && opts.pathname !== null
  ? normalizeSessionPathname(opts.pathname, laneIds)
  : (Array.isArray(opts.laneIds) ? normalizeSessionPathname('', laneIds) : (srcLoaded ? srcLoaded.pathname : '/'))
 const rawPkgIds = Array.isArray(opts.openPackageIds)
  ? Array.from(opts.openPackageIds, String).filter(Boolean)
  : (srcLoaded ? srcLoaded.openPackageIds : [DEFAULT_PACKAGE_ID])
 const openPackageIds = []
 const seen = new Set()
 for (const pid of rawPkgIds) {
  if (!seen.has(pid)) {
   seen.add(pid)
   openPackageIds.push(pid)
  }
 }
 if (openPackageIds.length === 0) {
  openPackageIds.push(DEFAULT_PACKAGE_ID)
 }
 const activePackageId = typeof opts.activePackageId === 'string' && openPackageIds.includes(opts.activePackageId)
  ? opts.activePackageId
  : (openPackageIds[0] || '')
 const baseName = srcLoaded && srcLoaded.meta && srcLoaded.meta.name ? srcLoaded.meta.name : 'Session'
 const forkName = opts.name !== undefined && opts.name !== null && String(opts.name).trim()
  ? String(opts.name).trim()
  : `${baseName} (Fork)`
 const forkDataDir = opts.dataDir !== undefined
  ? normalizeDataDir(opts.dataDir)
  : (srcLoaded ? normalizeDataDir(srcLoaded.meta.dataDir) : null)
 const forkDataDirConfirmed = opts.dataDirConfirmed !== undefined
  ? (Boolean(opts.dataDirConfirmed) || Boolean(forkDataDir))
  : (srcLoaded ? (Boolean(srcLoaded.meta.dataDirConfirmed) || Boolean(forkDataDir)) : Boolean(forkDataDir))
 const targetSessionKv = resolveSessionKv(rootKv, forkDataDir)
 await ensureDefaultPackage(targetSessionKv)
 const now = new Date().toISOString()
 const meta = {
  id: nextId,
  name: forkName,
  activePackageId,
  laneIds,
  pathname,
  version: 1,
  forkedFrom: srcId || null,
  dataDir: forkDataDir,
  dataDirConfirmed: forkDataDirConfirmed,
  previousSessionIds: normalizeSessionLinkIds(
   opts && opts.previousSessionIds !== undefined
    ? opts.previousSessionIds
    : (srcLoaded ? srcLoaded.previousSessionIds : []),
   nextId,
  ),
  nextSessionIds: normalizeSessionLinkIds(
   opts && opts.nextSessionIds !== undefined
    ? opts.nextSessionIds
    : (srcLoaded ? srcLoaded.nextSessionIds : []),
   nextId,
  ),
  tableDisplayOptions: opts && opts.tableDisplayOptions !== undefined
   ? normalizeSessionTableDisplayOptions(opts.tableDisplayOptions)
   : (srcLoaded ? normalizeSessionTableDisplayOptions(srcLoaded.tableDisplayOptions) : {}),
  createdAt: now,
  updatedAt: now,
 }
 await writeSessionMeta(registryKv, targetSessionKv, nextId, meta)
 if (targetSessionKv) {
  await writePagedIds(targetSessionKv, sessionPackagesBase(nextId), openPackageIds)
  await mapConcurrent(openPackageIds, CONCURRENCY_LIMIT, pid => addSessionToPackageIndex(targetSessionKv, pid, nextId))
 }
 const { local, session } = getWebStoragePair(win)
 if (opts && opts.tabOnly) {
  let browserSessionId = (local.getItem(SESSION_STORAGE_KEY) || '').trim()
  if (!browserSessionId) {
   browserSessionId = nextId
   local.setItem(SESSION_STORAGE_KEY, browserSessionId)
  }
  session.setItem(SESSION_STORAGE_KEY, nextId)
  return buildSessionState(rootKv, win, browserSessionId, nextId, forkName)
 }
 local.setItem(SESSION_STORAGE_KEY, nextId)
 session.setItem(SESSION_STORAGE_KEY, nextId)
 return buildSessionState(rootKv, win, nextId, nextId, forkName)
}

export async function setSessionDataDir(rootKv, win, sessionId, opts = {}) {
 const cleanId = String(sessionId || '').trim()
 if (!cleanId) {
  return { ok: false, error: 'Session ID is required', session: null }
 }
 const registryKv = resolveRegistryKv(rootKv)
 const existing = await loadOrCreateSessionRecord(rootKv, cleanId)
 if (existing.meta.dataDirConfirmed && !opts.force) {
  return {
   ok: false,
   error: 'Data directory is already permanently set for this session',
   session: existing,
  }
 }

 const nextDir = normalizeDataDir(opts.dataDir)
 const prevDir = normalizeDataDir(existing.meta.dataDir)
 const dirChanged = nextDir !== prevDir
 const sessionKv = activateSessionKv(rootKv, nextDir)
 await ensureDefaultPackage(sessionKv)

 let nextLaneIds = existing.laneIds
 let nextPathname = existing.pathname
 let nextActivePkg = existing.activePackageId || DEFAULT_PACKAGE_ID
 let nextVersion = existing.meta.version || 1

 if (dirChanged) {
  let dirMeta = null
  if (sessionKv && sessionKv !== registryKv) {
   const rawDirMeta = await kvGetChunked(sessionKv, sessionMetaKey(cleanId))
   if (!isMissingValue(rawDirMeta)) {
    try {
     const parsed = JSON.parse(rawDirMeta)
     if (parsed && typeof parsed === 'object') {
      dirMeta = parsed
     }
    }
    catch {
     dirMeta = null
    }
   }
  }
  if (dirMeta) {
   nextLaneIds = Array.isArray(dirMeta.laneIds) ? dirMeta.laneIds.map(String).filter(Boolean) : []
   nextPathname = normalizeSessionPathname(dirMeta.pathname, nextLaneIds)
   nextActivePkg = typeof dirMeta.activePackageId === 'string' && dirMeta.activePackageId.trim()
    ? dirMeta.activePackageId.trim()
    : DEFAULT_PACKAGE_ID
   nextVersion = Number.isInteger(dirMeta.version) && dirMeta.version > 0 ? dirMeta.version : nextVersion
  }
  else {
   nextLaneIds = []
   nextPathname = '/'
   nextActivePkg = DEFAULT_PACKAGE_ID
  }
 }

 const now = new Date().toISOString()
 const nextMeta = {
  ...existing.meta,
  laneIds: nextLaneIds,
  pathname: nextPathname,
  activePackageId: nextActivePkg,
  version: nextVersion,
  dataDir: nextDir,
  dataDirConfirmed: true,
  updatedAt: now,
 }
 await writeSessionMeta(registryKv, sessionKv, cleanId, nextMeta)
 if (sessionKv) {
  const pkgIdx = await readPagedIds(sessionKv, sessionPackagesBase(cleanId))
  const pkgIds = pkgIdx.exists && pkgIdx.ids.length > 0 ? pkgIdx.ids : [DEFAULT_PACKAGE_ID]
  if (!pkgIdx.exists || pkgIdx.ids.length === 0) {
   await writePagedIds(sessionKv, sessionPackagesBase(cleanId), pkgIds)
  }
  await mapConcurrent(pkgIds, CONCURRENCY_LIMIT, pid => addSessionToPackageIndex(sessionKv, pid, cleanId))
 }

 const { local } = getWebStoragePair(win)
 updateSessionHistoryDataDir(local, cleanId, nextDir, true)
 let browserSessionId = (local.getItem(SESSION_STORAGE_KEY) || '').trim()
 if (!browserSessionId) {
  browserSessionId = cleanId
  local.setItem(SESSION_STORAGE_KEY, browserSessionId)
 }
 const sessionState = await buildSessionState(rootKv, win, browserSessionId, cleanId)
 return {
  ok: true,
  dirChanged,
  session: sessionState,
 }
}

export async function createPackage(rootKv, sessionId, opts = {}, win = null) {
 const cleanSessionId = String(sessionId || '').trim()
 const loaded = cleanSessionId ? await loadOrCreateSessionRecord(rootKv, cleanSessionId) : null
 const sessionKv = loaded ? resolveSessionKv(rootKv, loaded.meta.dataDir) : unwrapKv(rootKv)
 const rawName = opts && opts.name !== undefined && opts.name !== null ? String(opts.name).trim() : ''
 const name = rawName || 'Untitled Package'
 const passphrase = opts && opts.passphrase !== undefined && opts.passphrase !== null ? String(opts.passphrase) : ''
 const pkgId = generateId('pkg', win)
 const now = new Date().toISOString()
 const hasPassphrase = passphrase.length > 0
 const passphraseSalt = hasPassphrase ? generateSalt(win) : null
 const passphraseHash = hasPassphrase ? await hashPassphrase(passphrase, passphraseSalt, win) : null
 const meta = {
  id: pkgId,
  name,
  hasPassphrase,
  passphraseSalt,
  passphraseHash,
  createdAt: now,
  updatedAt: now,
 }
 await kvSetChunked(sessionKv, packageMetaKey(pkgId), JSON.stringify(meta))
 await writePagedIds(sessionKv, packageLanesBase(pkgId), [])
 const opened = await openPackageInSession(rootKv, sessionId, {
  packageId: pkgId,
  passphrase,
  setActive: true,
 }, win)
 return {
  ok: true,
  pkg: sanitizePackageMeta(meta),
  sessionState: opened.sessionState,
 }
}

export async function openPackageInSession(rootKv, sessionId, opts = {}, win = null) {
 const registryKv = resolveRegistryKv(rootKv)
 const cleanSessionId = String(sessionId || '').trim()
 const loaded = await loadOrCreateSessionRecord(rootKv, cleanSessionId)
 const sessionKv = resolveSessionKv(rootKv, loaded.meta.dataDir)
 const rawPkgId = opts && opts.packageId !== undefined && opts.packageId !== null ? String(opts.packageId).trim() : ''
 const packageId = rawPkgId || DEFAULT_PACKAGE_ID
 const passphrase = opts && opts.passphrase !== undefined && opts.passphrase !== null ? String(opts.passphrase) : ''
 const setActive = opts && opts.setActive !== undefined ? Boolean(opts.setActive) : true

 if (packageId === DEFAULT_PACKAGE_ID) {
  await ensureDefaultPackage(sessionKv)
 }
 const rawMeta = await readRawPackageMeta(sessionKv, packageId)
 if (!rawMeta) {
  return {
   ok: false,
   needsPassphrase: false,
   packageName: '',
   error: `Package "${packageId}" not found`,
  }
 }
 if (rawMeta.hasPassphrase) {
  if (!passphrase) {
   return {
    ok: false,
    needsPassphrase: true,
    packageName: rawMeta.name || packageId,
    error: 'Passphrase required to open this package',
   }
  }
  const actualHash = await hashPassphrase(passphrase, rawMeta.passphraseSalt || '', win)
  if (actualHash !== rawMeta.passphraseHash) {
   return {
    ok: false,
    needsPassphrase: true,
    packageName: rawMeta.name || packageId,
    error: 'Incorrect passphrase',
   }
  }
 }

 const nextIds = loaded.openPackageIds.includes(packageId)
  ? [...loaded.openPackageIds]
  : [...loaded.openPackageIds, packageId]
 await writePagedIds(sessionKv, sessionPackagesBase(cleanSessionId), nextIds)
 await addSessionToPackageIndex(sessionKv, packageId, cleanSessionId)

 if (setActive && loaded.meta.activePackageId !== packageId) {
  const nextMeta = { ...loaded.meta, activePackageId: packageId, updatedAt: new Date().toISOString() }
  await writeSessionMeta(registryKv, sessionKv, cleanSessionId, nextMeta)
 }
 const sessionState = await loadOrCreateSessionRecord(rootKv, cleanSessionId)
 return {
  ok: true,
  pkg: sanitizePackageMeta(rawMeta),
  sessionState,
 }
}

export async function closePackageInSession(rootKv, sessionId, packageId) {
 const registryKv = resolveRegistryKv(rootKv)
 const cleanSessionId = String(sessionId || '').trim()
 const cleanPkgId = String(packageId || '').trim()
 const loaded = await loadOrCreateSessionRecord(rootKv, cleanSessionId)
 const sessionKv = resolveSessionKv(rootKv, loaded.meta.dataDir)
 const nextIds = loaded.openPackageIds.filter(id => id !== cleanPkgId)
 await writePagedIds(sessionKv, sessionPackagesBase(cleanSessionId), nextIds)
 await removeSessionFromPackageIndex(sessionKv, cleanPkgId, cleanSessionId)

 if (loaded.meta.activePackageId === cleanPkgId) {
  const nextActive = nextIds[0] || ''
  const nextMeta = { ...loaded.meta, activePackageId: nextActive, updatedAt: new Date().toISOString() }
  await writeSessionMeta(registryKv, sessionKv, cleanSessionId, nextMeta)
 }
 return await loadOrCreateSessionRecord(rootKv, cleanSessionId)
}

export async function setActivePackageInSession(rootKv, sessionId, packageId) {
 const registryKv = resolveRegistryKv(rootKv)
 const cleanSessionId = String(sessionId || '').trim()
 const cleanPkgId = String(packageId || '').trim()
 const loaded = await loadOrCreateSessionRecord(rootKv, cleanSessionId)
 const sessionKv = resolveSessionKv(rootKv, loaded.meta.dataDir)
 if (!loaded.openPackageIds.includes(cleanPkgId)) {
  return loaded
 }
 if (loaded.meta.activePackageId !== cleanPkgId) {
  const nextMeta = { ...loaded.meta, activePackageId: cleanPkgId, updatedAt: new Date().toISOString() }
  await writeSessionMeta(registryKv, sessionKv, cleanSessionId, nextMeta)
 }
 return await loadOrCreateSessionRecord(rootKv, cleanSessionId)
}

export async function checkLaneAccess(rootKv, openPackageIds, laneId) {
 const kv = unwrapKv(rootKv)
 const packageId = await getLanePackageId(kv, laneId)
 const list = Array.isArray(openPackageIds) ? openPackageIds : []
 return {
  allowed: list.includes(packageId),
  packageId,
 }
}

export async function loadSessionCatalog(rootKv, openPackageIds) {
 const kv = unwrapKv(rootKv)
 await migrateLegacyCatalog(kv)
 const pkgIds = Array.isArray(openPackageIds) ? openPackageIds : []
 const catalog = {}
 const list = []
 if (!kv || pkgIds.length === 0) {
  return { catalog, list }
 }
 const pkgResults = await mapConcurrent(pkgIds, CONCURRENCY_LIMIT, async pkgId => {
  const [pkgMeta, laneIdx] = await Promise.all([
   getPackageMeta(kv, pkgId),
   readPagedIds(kv, packageLanesBase(pkgId)),
  ])
  if (!pkgMeta || !laneIdx.exists || laneIdx.ids.length === 0) {
   return []
  }
  const laneRaws = await mapConcurrent(laneIdx.ids, CONCURRENCY_LIMIT, laneId => kvGetChunked(kv, packageLaneKey(pkgId, laneId)))
  const entries = []
  for (let i = 0; i < laneIdx.ids.length; i++) {
   const laneId = laneIdx.ids[i]
   const raw = laneRaws[i]
   let title = laneId
   if (!isMissingValue(raw)) {
    try {
     const parsed = JSON.parse(raw)
     if (parsed && typeof parsed === 'object' && parsed.title !== undefined && parsed.title !== null) {
      title = String(parsed.title)
     }
    }
    catch {
     title = String(raw)
    }
   }
   entries.push({
    id: laneId,
    title,
    packageId: pkgId,
    packageName: pkgMeta.name,
   })
  }
  return entries
 })

 const seen = new Set()
 for (const entries of pkgResults) {
  for (const entry of entries) {
   if (seen.has(entry.id)) {
    continue
   }
   seen.add(entry.id)
   catalog[entry.id] = entry
   list.push(entry)
  }
 }
 return { catalog, list }
}

export async function registerLaneInPackage(rootKv, laneId, title, packageId = DEFAULT_PACKAGE_ID) {
 const kv = unwrapKv(rootKv)
 const cleanLaneId = String(laneId || '').trim()
 if (!cleanLaneId) {
  return null
 }
 const cleanPkgId = String(packageId || '').trim() || DEFAULT_PACKAGE_ID
 const cleanTitle = title === null || title === undefined ? cleanLaneId : String(title)
 if (!kv) {
  return { id: cleanLaneId, title: cleanTitle, packageId: cleanPkgId }
 }
 if (cleanPkgId === DEFAULT_PACKAGE_ID) {
  await ensureDefaultPackage(kv)
 }
 const entry = { id: cleanLaneId, title: cleanTitle, packageId: cleanPkgId }
 await kvSetChunked(kv, lanePackageKey(cleanLaneId), cleanPkgId)
 await kvSetChunked(kv, packageLaneKey(cleanPkgId, cleanLaneId), JSON.stringify(entry))
 const idx = await readPagedIds(kv, packageLanesBase(cleanPkgId))
 if (!idx.ids.includes(cleanLaneId)) {
  await writePagedIds(kv, packageLanesBase(cleanPkgId), [...idx.ids, cleanLaneId])
 }
 return entry
}

export async function moveLaneToPackage(rootKv, laneId, title, fromPackageId, toPackageId) {
 const kv = unwrapKv(rootKv)
 const cleanLaneId = String(laneId || '').trim()
 const fromPkg = String(fromPackageId || '').trim() || DEFAULT_PACKAGE_ID
 const toPkg = String(toPackageId || '').trim() || DEFAULT_PACKAGE_ID
 const cleanTitle = title === null || title === undefined ? cleanLaneId : String(title)
 if (!cleanLaneId || fromPkg === toPkg) {
  return { id: cleanLaneId, title: cleanTitle, packageId: toPkg }
 }
 const entry = await registerLaneInPackage(kv, cleanLaneId, cleanTitle, toPkg)
 if (kv) {
  const oldIdx = await readPagedIds(kv, packageLanesBase(fromPkg))
  if (oldIdx.exists && oldIdx.ids.includes(cleanLaneId)) {
   await writePagedIds(kv, packageLanesBase(fromPkg), oldIdx.ids.filter(id => id !== cleanLaneId))
  }
  await kvDeleteChunked(kv, packageLaneKey(fromPkg, cleanLaneId))
 }
 return entry
}

// ---------- Remote Server Profiles, Deployments & Civil-Memory Sync ----------

export const DEPLOY_SERVERS_BASE = 'deploy#servers'
export const DEPLOYMENTS_BASE = 'deploy#deployments'
export const DEPLOYED_SCRIPTS_BASE = 'deploy#deployed-scripts'

export function deployServerKey(serverId) {
 return `${DEPLOY_SERVERS_BASE}/${encodeKeySegment(serverId)}`
}

export function deploymentKey(laneId) {
 return `${DEPLOYMENTS_BASE}/${encodeKeySegment(laneId)}`
}

export function deployedScriptKey(laneId) {
 return `${DEPLOYED_SCRIPTS_BASE}/${encodeKeySegment(laneId)}`
}

export function normalizeServiceSlug(raw, fallback = 'lane-service') {
 const clean = raw => String(raw === null || raw === undefined ? '' : raw)
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9-]+/g, '-')
  .replace(/-+/g, '-')
  .replace(/^-+|-+$/g, '')
  .slice(0, 48)
  .replace(/-+$/g, '')
 const primary = clean(raw)
 if (primary) {
  return primary
 }
 const fb = clean(fallback)
 return fb || 'lane-service'
}

const DOMAIN_LABEL_RE = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*$/

export function normalizeDomainName(raw) {
 if (raw === null || raw === undefined) {
  return ''
 }
 const trimmed = String(raw).trim().toLowerCase().replace(/\.+$/, '')
 if (!trimmed || trimmed.length > 253) {
  return ''
 }
 if (!DOMAIN_LABEL_RE.test(trimmed)) {
  return ''
 }
 return trimmed
}

export function normalizeSubpath(raw) {
 if (raw === null || raw === undefined) {
  return ''
 }
 const trimmed = String(raw).trim()
 if (!trimmed) {
  return ''
 }
 if (trimmed.includes('..') || /[\s?#;\\]/.test(trimmed)) {
  return ''
 }
 if (!/^[A-Za-z0-9._~/-]+$/.test(trimmed)) {
  return ''
 }
 const withLeading = trimmed.startsWith('/') ? trimmed : `/${trimmed}`
 const collapsed = withLeading.replace(/\/+/g, '/')
 if (collapsed === '/') {
  return '/'
 }
 return collapsed.replace(/\/+$/, '') || '/'
}

export function buildPublicEndpointUrl({ routeMode = 'subpath', domain = '', subpath = '', https = false } = {}) {
 const cleanDomain = normalizeDomainName(domain)
 if (!cleanDomain) {
  return ''
 }
 const proto = https ? 'https' : 'http'
 if (routeMode === 'subpath') {
  const cleanSub = normalizeSubpath(subpath)
  if (cleanSub && cleanSub !== '/') {
   return `${proto}://${cleanDomain}${cleanSub}`
  }
 }
 return `${proto}://${cleanDomain}`
}

export function allocateNextPort(deployments, serverId = '', basePort = 4100) {
 const parsedBase = Number(basePort)
 const start = Number.isInteger(parsedBase) && parsedBase >= 1024 && parsedBase <= 65535
  ? parsedBase
  : 4100
 const list = Array.isArray(deployments) ? deployments : []
 const used = new Set()
 const cleanServer = String(serverId || '').trim()
 for (const item of list) {
  if (!item || typeof item !== 'object') {
   continue
  }
  if (cleanServer && String(item.serverId || '').trim() !== cleanServer) {
   continue
  }
  const p = Number(item.port)
  if (Number.isInteger(p) && p > 0) {
   used.add(p)
  }
 }
 let candidate = start
 while (used.has(candidate) && candidate < 65535) {
  candidate += 1
 }
 return candidate
}

function normalizeServerRecord(raw, idFallback = '') {
 if (!raw || typeof raw !== 'object') {
  return null
 }
 const id = String(raw.id || idFallback || '').trim()
 if (!id) {
  return null
 }
 const parsedSshPort = Number(raw.sshPort)
 const sshPort = Number.isInteger(parsedSshPort) && parsedSshPort >= 1 && parsedSshPort <= 65535 ? parsedSshPort : 22
 const parsedBasePort = Number(raw.basePort)
 const basePort = Number.isInteger(parsedBasePort) && parsedBasePort >= 1024 && parsedBasePort <= 65535 ? parsedBasePort : 4100
 const parsedCmPort = Number(raw.civilMemoryPort)
 const civilMemoryPort = Number.isInteger(parsedCmPort) && parsedCmPort >= 1 && parsedCmPort <= 65535 ? parsedCmPort : 3333
 const mode = raw.civilMemoryMode === 'local' || raw.civilMemoryMode === 'external'
  ? raw.civilMemoryMode
  : 'none'
 return {
  id,
  name: String(raw.name || raw.host || id).trim(),
  host: String(raw.host || '').trim(),
  sshPort,
  user: String(raw.user || 'root').trim(),
  identityFile: String(raw.identityFile || '').trim(),
  defaultDomain: normalizeDomainName(raw.defaultDomain || ''),
  basePort,
  installRoot: String(raw.installRoot || '/opt/civil-command').trim() || '/opt/civil-command',
  civilMemoryMode: mode,
  civilMemoryUrl: String(raw.civilMemoryUrl || (mode === 'local' ? `http://127.0.0.1:${civilMemoryPort}` : '')).trim(),
  civilMemoryPort,
  civilMemoryDataRoot: String(raw.civilMemoryDataRoot || '/opt/civil-command/data').trim() || '/opt/civil-command/data',
  civilMemoryVerified: Boolean(raw.civilMemoryVerified),
  civilMemoryLastCheckedAt: typeof raw.civilMemoryLastCheckedAt === 'string' ? raw.civilMemoryLastCheckedAt : null,
  createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : new Date().toISOString(),
  updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : new Date().toISOString(),
 }
}

export function buildDeploymentId({
 laneId = '',
 serverId = '',
 slug = '',
 routeMode = 'subpath',
 domain = '',
 subpath = '',
} = {}) {
 const cleanLaneId = String(laneId || '').trim()
 if (!cleanLaneId) {
  return ''
 }
 const cleanServer = String(serverId || '').trim()
 const cleanSlug = normalizeServiceSlug(slug || cleanLaneId, cleanLaneId)
 const cleanMode = routeMode === 'domain' ? 'domain' : 'subpath'
 const cleanDomain = normalizeDomainName(domain || '')
 const cleanSubpath = cleanMode === 'subpath' ? (normalizeSubpath(subpath || `/${cleanSlug}`) || `/${cleanSlug}`) : ''
 return `${cleanLaneId}::${cleanServer}::${cleanSlug}::${cleanMode}::${cleanDomain}::${cleanSubpath}`
}

function normalizeDeploymentRecord(raw, laneIdFallback = '') {
 if (!raw || typeof raw !== 'object') {
  return null
 }
 const fallbackStr = String(laneIdFallback || '').trim()
 const fallbackLaneId = fallbackStr.includes('::') ? fallbackStr.split('::')[0] : fallbackStr
 const laneId = String(raw.laneId || fallbackLaneId || '').trim()
 if (!laneId) {
  return null
 }
 const routeMode = raw.routeMode === 'domain' ? 'domain' : 'subpath'
 const slug = normalizeServiceSlug(raw.slug || raw.title || laneId, laneId)
 const domain = normalizeDomainName(raw.domain || '')
 const subpath = routeMode === 'subpath' ? (normalizeSubpath(raw.subpath || `/${slug}`) || `/${slug}`) : ''
 const serverId = String(raw.serverId || '').trim()
 const parsedPort = Number(raw.port)
 const port = Number.isInteger(parsedPort) && parsedPort >= 1 && parsedPort <= 65535 ? parsedPort : 4100
 const enableLetsEncrypt = Boolean(raw.enableLetsEncrypt)
 const publicUrl = String(raw.publicUrl || buildPublicEndpointUrl({
  routeMode,
  domain,
  subpath,
  https: enableLetsEncrypt,
 })).trim()
 const rawId = String(raw.id || '').trim()
 const id = rawId || buildDeploymentId({
  laneId,
  serverId,
  slug,
  routeMode,
  domain,
  subpath,
 })
 return {
  id,
  laneId,
  title: String(raw.title || laneId).trim(),
  serverId,
  slug,
  port,
  routeMode,
  domain,
  subpath,
  enableLetsEncrypt,
  letsEncryptEmail: String(raw.letsEncryptEmail || '').trim(),
  cors: raw.cors !== false,
  civilMemoryUrl: String(raw.civilMemoryUrl || '').trim(),
  dataBasePath: String(raw.dataBasePath || '').trim(),
  includeImports: Boolean(raw.includeImports),
  kvReady: Boolean(raw.kvReady),
  lastSyncedAt: typeof raw.lastSyncedAt === 'string' ? raw.lastSyncedAt : null,
  lastDeployedAt: typeof raw.lastDeployedAt === 'string' ? raw.lastDeployedAt : null,
  lastSyncLaneIds: Array.isArray(raw.lastSyncLaneIds) ? raw.lastSyncLaneIds.map(String) : [],
  publicUrl,
  updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : new Date().toISOString(),
 }
}

export async function loadDeployServers(rootKv) {
 const kv = resolveRegistryKv(rootKv)
 if (!kv) {
  return []
 }
 const idx = await readPagedIds(kv, DEPLOY_SERVERS_BASE)
 if (!idx.exists || idx.ids.length === 0) {
  return []
 }
 const raws = await mapConcurrent(idx.ids, CONCURRENCY_LIMIT, id => kvGetChunked(kv, deployServerKey(id)))
 const out = []
 for (let i = 0; i < idx.ids.length; i++) {
  const raw = raws[i]
  if (isMissingValue(raw)) {
   continue
  }
  try {
   const norm = normalizeServerRecord(JSON.parse(raw), idx.ids[i])
   if (norm) {
    out.push(norm)
   }
  }
  catch {
   // skip corrupt entry
  }
 }
 return out
}

export async function saveDeployServer(rootKv, server) {
 const kv = resolveRegistryKv(rootKv)
 const id = String(server && server.id ? server.id : '').trim() || `srv-${generateLineId(null).slice(3)}`
 const now = new Date().toISOString()
 const norm = normalizeServerRecord({
  ...server,
  id,
  createdAt: server && server.createdAt ? server.createdAt : now,
  updatedAt: now,
 }, id)
 if (!norm || !kv) {
  return norm
 }
 await enqueueWrite(kv, DEPLOY_SERVERS_BASE, async () => {
  await kvSetChunked(kv, deployServerKey(norm.id), JSON.stringify(norm))
  const idx = await readPagedIds(kv, DEPLOY_SERVERS_BASE)
  if (!idx.ids.includes(norm.id)) {
   await writePagedIds(kv, DEPLOY_SERVERS_BASE, [...idx.ids, norm.id])
  }
 })
 return norm
}

export async function deleteDeployServer(rootKv, serverId) {
 const kv = resolveRegistryKv(rootKv)
 const cleanId = String(serverId || '').trim()
 if (!kv || !cleanId) {
  return
 }
 await enqueueWrite(kv, DEPLOY_SERVERS_BASE, async () => {
  await kvDeleteChunked(kv, deployServerKey(cleanId))
  const idx = await readPagedIds(kv, DEPLOY_SERVERS_BASE)
  if (idx.exists && idx.ids.includes(cleanId)) {
   await writePagedIds(kv, DEPLOY_SERVERS_BASE, idx.ids.filter(id => id !== cleanId))
  }
 })
}

export async function loadDeployments(rootKv) {
 const kv = resolveRegistryKv(rootKv)
 if (!kv) {
  return []
 }
 const idx = await readPagedIds(kv, DEPLOYMENTS_BASE)
 if (!idx.exists || idx.ids.length === 0) {
  return []
 }
 const raws = await mapConcurrent(idx.ids, CONCURRENCY_LIMIT, id => kvGetChunked(kv, deploymentKey(id)))
 const out = []
 for (let i = 0; i < idx.ids.length; i++) {
  const raw = raws[i]
  if (isMissingValue(raw)) {
   continue
  }
  try {
   const norm = normalizeDeploymentRecord(JSON.parse(raw), idx.ids[i])
   if (norm) {
    out.push(norm)
   }
  }
  catch {
   // skip corrupt entry
  }
 }
 return out
}

export async function loadLaneDeployments(rootKv, laneId) {
 const kv = resolveRegistryKv(rootKv)
 const cleanId = String(laneId || '').trim()
 if (!kv || !cleanId) {
  return []
 }
 const all = await loadDeployments(kv)
 const matched = all.filter(dep => dep && dep.laneId === cleanId)
 if (matched.length > 0) {
  return matched
 }
 const raw = await kvGetChunked(kv, deploymentKey(cleanId))
 if (isMissingValue(raw)) {
  return []
 }
 try {
  const single = normalizeDeploymentRecord(JSON.parse(raw), cleanId)
  return single ? [single] : []
 }
 catch {
  return []
 }
}

export async function loadLaneDeployment(rootKv, laneId) {
 const list = await loadLaneDeployments(rootKv, laneId)
 if (list.length === 0) {
  return null
 }
 const deployedList = list.filter(d => Boolean(d && d.lastDeployedAt))
 if (deployedList.length > 0) {
  return deployedList[deployedList.length - 1]
 }
 return list[list.length - 1]
}

export async function saveLaneDeployment(rootKv, deployment) {
 const kv = resolveRegistryKv(rootKv)
 const cleanLaneId = String(deployment && deployment.laneId ? deployment.laneId : '').trim()
 if (!cleanLaneId) {
  return null
 }
 const norm = normalizeDeploymentRecord({
  ...deployment,
  laneId: cleanLaneId,
  updatedAt: new Date().toISOString(),
 }, cleanLaneId)
 if (!norm || !kv) {
  return norm
 }
 await enqueueWrite(kv, DEPLOYMENTS_BASE, async () => {
  await kvSetChunked(kv, deploymentKey(norm.id), JSON.stringify(norm))
  const idx = await readPagedIds(kv, DEPLOYMENTS_BASE)
  let nextIds = idx.ids.slice()
  if (norm.id !== norm.laneId && nextIds.includes(norm.laneId)) {
   const legacyRaw = await kvGetChunked(kv, deploymentKey(norm.laneId))
   let replaceLegacy = isMissingValue(legacyRaw)
   if (!replaceLegacy) {
    try {
     const legacyNorm = normalizeDeploymentRecord(JSON.parse(legacyRaw), norm.laneId)
     if (legacyNorm && legacyNorm.id === norm.id) {
      replaceLegacy = true
     }
    }
    catch {
     replaceLegacy = true
    }
   }
   if (replaceLegacy) {
    await kvDeleteChunked(kv, deploymentKey(norm.laneId))
    nextIds = nextIds.filter(id => id !== norm.laneId)
   }
  }
  if (!nextIds.includes(norm.id)) {
   nextIds.push(norm.id)
  }
  await writePagedIds(kv, DEPLOYMENTS_BASE, nextIds)
 })
 return norm
}

export async function saveDeployedLaneScript(rootKv, laneId, records, deployedAt = new Date().toISOString()) {
 const kv = resolveRegistryKv(rootKv)
 const cleanId = String(laneId || '').trim()
 if (!kv || !cleanId) {
  return null
 }
 const normRecords = (Array.isArray(records) ? records : []).map(r => ({
  id: r && r.id !== undefined && r.id !== null ? String(r.id) : '',
  text: r && r.text !== undefined && r.text !== null ? String(r.text) : '',
 }))
 const payload = {
  laneId: cleanId,
  deployedAt: typeof deployedAt === 'string' && deployedAt.trim() ? deployedAt : new Date().toISOString(),
  records: normRecords,
 }
 await kvSetChunked(kv, deployedScriptKey(cleanId), JSON.stringify(payload))
 return payload
}

export async function loadDeployedLaneScript(rootKv, laneId) {
 const kv = resolveRegistryKv(rootKv)
 const cleanId = String(laneId || '').trim()
 if (!kv || !cleanId) {
  return null
 }
 const raw = await kvGetChunked(kv, deployedScriptKey(cleanId))
 if (isMissingValue(raw)) {
  return null
 }
 try {
  const parsed = JSON.parse(raw)
  if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.records)) {
   return null
  }
  return {
   laneId: String(parsed.laneId || cleanId),
   deployedAt: typeof parsed.deployedAt === 'string' ? parsed.deployedAt : null,
   records: parsed.records.map(r => ({
    id: r && r.id !== undefined && r.id !== null ? String(r.id) : '',
    text: r && r.text !== undefined && r.text !== null ? String(r.text) : '',
   })),
  }
 }
 catch {
  return null
 }
}

export function diffLaneScripts(deployedRecords, currentRecords) {
 const cur = (Array.isArray(currentRecords) ? currentRecords : []).map((r, i) => ({
  id: r && r.id !== undefined && r.id !== null ? String(r.id) : '',
  text: r && r.text !== undefined && r.text !== null ? String(r.text) : '',
  lineNumber: i + 1,
 }))
 if (!Array.isArray(deployedRecords)) {
  const lineChanges = cur.map(r => ({
   type: 'added',
   lineId: r.id,
   lineNumber: r.lineNumber,
   before: null,
   after: r.text,
  }))
  return {
   hasChanges: true,
   unknownBaseline: true,
   orderChanged: false,
   deployedCount: 0,
   currentCount: cur.length,
   lineChanges,
   changedLines: lineChanges,
  }
 }
 const dep = deployedRecords.map((r, i) => ({
  id: r && r.id !== undefined && r.id !== null ? String(r.id) : '',
  text: r && r.text !== undefined && r.text !== null ? String(r.text) : '',
  lineNumber: i + 1,
 }))
 const depById = new Map()
 for (const rec of dep) {
  if (rec.id) {
   depById.set(rec.id, rec)
  }
 }
 const curById = new Map()
 for (const rec of cur) {
  if (rec.id) {
   curById.set(rec.id, rec)
  }
 }
 const lineChanges = []
 for (const rec of cur) {
  const prev = rec.id ? depById.get(rec.id) : null
  if (!prev) {
   lineChanges.push({
    type: 'added',
    lineId: rec.id,
    lineNumber: rec.lineNumber,
    before: null,
    after: rec.text,
   })
  }
  else if (prev.text !== rec.text) {
   lineChanges.push({
    type: 'modified',
    lineId: rec.id,
    lineNumber: rec.lineNumber,
    before: prev.text,
    after: rec.text,
   })
  }
  else {
   lineChanges.push({
    type: 'unchanged',
    lineId: rec.id,
    lineNumber: rec.lineNumber,
    before: prev.text,
    after: rec.text,
   })
  }
 }
 for (const prev of dep) {
  if (!prev.id || !curById.has(prev.id)) {
   lineChanges.push({
    type: 'removed',
    lineId: prev.id,
    lineNumber: prev.lineNumber,
    before: prev.text,
    after: null,
   })
  }
 }
 const orderChanged = dep.length === cur.length && dep.some((r, i) => r.id !== cur[i].id)
 const changedLines = lineChanges.filter(c => c.type !== 'unchanged')
 return {
  hasChanges: changedLines.length > 0 || orderChanged,
  unknownBaseline: false,
  orderChanged,
  deployedCount: dep.length,
  currentCount: cur.length,
  lineChanges,
  changedLines,
 }
}

export async function getLaneDeployStatus(rootKv, workspaceKv, laneId) {
 const cleanId = String(laneId || '').trim()
 if (!cleanId) {
  return {
   laneId: '',
   deployed: false,
   hasDeploymentRecord: false,
   hasChanges: false,
   unknownBaseline: false,
   status: 'not-deployed',
   deployment: null,
   deployedScript: null,
   currentRecords: [],
   diff: diffLaneScripts([], []),
  }
 }
 const regKv = resolveRegistryKv(rootKv || workspaceKv)
 const wsKv = unwrapKv(workspaceKv || rootKv)
 const [deployment, deployedScript, loadedScript] = await Promise.all([
  regKv ? loadLaneDeployment(regKv, cleanId) : Promise.resolve(null),
  regKv ? loadDeployedLaneScript(regKv, cleanId) : Promise.resolve(null),
  wsKv ? loadLaneScript(wsKv, wsKv.namespace(cleanId), cleanId, null) : Promise.resolve({ records: [] }),
 ])
 const currentRecords = Array.isArray(loadedScript && loadedScript.records) ? loadedScript.records : []
 const diff = diffLaneScripts(deployedScript ? deployedScript.records : null, currentRecords)
 const deployed = Boolean(deployment && deployment.lastDeployedAt)
 const hasDeploymentRecord = Boolean(deployment)
 let status = 'not-deployed'
 let hasChanges = false
 if (deployed) {
  if (!deployedScript) {
   status = 'unverified-baseline'
   hasChanges = true
  }
  else if (diff.hasChanges) {
   status = 'needs-deploy'
   hasChanges = true
  }
  else {
   status = 'up-to-date'
   hasChanges = false
  }
 }
 return {
  laneId: cleanId,
  deployed,
  hasDeploymentRecord,
  hasChanges,
  unknownBaseline: Boolean(deployed && !deployedScript),
  status,
  deployment,
  deployedScript,
  currentRecords,
  diff,
 }
}

export async function setTargetLaneLine(rootKv, targetLaneId, targetLineId, nextText, win = null, setBy = null) {
 const kv = unwrapKv(rootKv)
 const cleanLane = String(targetLaneId || '').trim()
 const cleanLine = String(targetLineId || '').trim()
 if (!kv || !cleanLane || !cleanLine) {
  return {
   ok: false,
   changed: false,
   setByChanged: false,
   error: 'Target lane and line ID are required',
   laneId: cleanLane,
   lineId: cleanLine,
  }
 }
 const laneData = kv.namespace(cleanLane)
 const loaded = await loadLaneScript(kv, laneData, cleanLane, win)
 const records = Array.isArray(loaded && loaded.records) ? loaded.records : []
 const idx = records.findIndex(r => r && String(r.id) === cleanLine)
 if (idx === -1) {
  return {
   ok: false,
   changed: false,
   setByChanged: false,
   error: `Target line "${cleanLine}" not found`,
   laneId: cleanLane,
   lineId: cleanLine,
  }
 }
 const rec = records[idx]
 const prevText = rec.text === null || rec.text === undefined ? '' : String(rec.text)
 const prevSetBy = normalizeLineSetBy(rec.setBy)
 const allIds = records.map(r => r.id)
 const ensureIdx = !(loaded && loaded.initialized)

 if (setBy && typeof setBy === 'object' && setBy.clear === true) {
  const matchLane = setBy.laneId === null || setBy.laneId === undefined ? '' : String(setBy.laneId).trim()
  const matchLine = setBy.lineId === null || setBy.lineId === undefined ? '' : String(setBy.lineId).trim()
  const shouldClear = Boolean(
   prevSetBy &&
   (!matchLane || prevSetBy.laneId === matchLane) &&
   (!matchLine || prevSetBy.lineId === matchLine)
  )
  if (shouldClear) {
   delete rec.setBy
   await saveScriptLine(kv, laneData, cleanLane, rec, allIds, ensureIdx, rec.updatedAt || null)
  }
  return {
   ok: true,
   changed: false,
   setByChanged: shouldClear,
   laneId: cleanLane,
   lineId: cleanLine,
   lineNumber: idx + 1,
   previousText: prevText,
   text: prevText,
   updatedAt: rec.updatedAt || null,
   setBy: normalizeLineSetBy(rec.setBy),
  }
 }

 const nextStr = nextText === null || nextText === undefined ? '' : String(nextText)
 const nextSetBy = normalizeLineSetBy(setBy)
 const check = validateFieldScriptLine(nextStr, { filename: cleanLane, lineIndex: idx })
 if (!check.ok) {
  let savedDraft = null
  if (win) {
   savedDraft = saveLaneSourceDraft(kv, win, cleanLane, {
    lineId: cleanLine,
    lineIndex: idx,
    text: nextStr,
    savedText: prevText,
    error: check.error,
    setBy: nextSetBy,
   })
  }
  return {
   ok: false,
   changed: false,
   setByChanged: false,
   syntaxError: true,
   syntaxErrorDetail: check.error,
   error: `Cannot save unparseable FieldScript in lane "${cleanLane}" line ${idx + 1}: ${check.error}`,
   laneId: cleanLane,
   lineId: cleanLine,
   lineNumber: idx + 1,
   previousText: prevText,
   text: prevText,
   draft: savedDraft,
  }
 }
 const textChanged = prevText !== nextStr
 const setByChanged = Boolean(
  nextSetBy &&
  (!prevSetBy || prevSetBy.laneId !== nextSetBy.laneId || prevSetBy.lineId !== nextSetBy.lineId)
 )

 if (!textChanged) {
  if (win) {
   clearLaneSourceDraft(kv, win, cleanLane, cleanLine)
  }
  if (setByChanged) {
   rec.setBy = nextSetBy
   await saveScriptLine(kv, laneData, cleanLane, rec, allIds, ensureIdx, rec.updatedAt || null)
  }
  return {
   ok: true,
   changed: false,
   setByChanged,
   laneId: cleanLane,
   lineId: cleanLine,
   lineNumber: idx + 1,
   previousText: prevText,
   text: prevText,
   updatedAt: rec.updatedAt || null,
   setBy: normalizeLineSetBy(rec.setBy),
  }
 }

 rec.text = nextStr
 if (nextSetBy) {
  rec.setBy = nextSetBy
 }
 await saveScriptLine(kv, laneData, cleanLane, rec, allIds, ensureIdx)
 if (win) {
  clearLaneSourceDraft(kv, win, cleanLane, cleanLine)
 }
 return {
  ok: true,
  changed: true,
  setByChanged,
  laneId: cleanLane,
  lineId: cleanLine,
  lineNumber: idx + 1,
  previousText: prevText,
  text: rec.text,
  updatedAt: rec.updatedAt || null,
  setBy: normalizeLineSetBy(rec.setBy),
 }
}

export async function clearTargetLaneLineSetBy(rootKv, targetLaneId, targetLineId, sourceLaneId = '', sourceLineId = '', win = null) {
 return setTargetLaneLine(rootKv, targetLaneId, targetLineId, null, win, {
  clear: true,
  laneId: sourceLaneId,
  lineId: sourceLineId,
 })
}

export async function deleteLaneDeployment(rootKv, laneIdOrDeploymentId, deploymentId = '') {
 const kv = resolveRegistryKv(rootKv)
 const firstArg = String(laneIdOrDeploymentId || '').trim()
 const secondArg = String(deploymentId || '').trim()
 if (!kv || (!firstArg && !secondArg)) {
  return
 }
 await enqueueWrite(kv, DEPLOYMENTS_BASE, async () => {
  const idx = await readPagedIds(kv, DEPLOYMENTS_BASE)
  const curIds = idx.exists ? idx.ids.slice() : []
  const raws = await mapConcurrent(curIds, CONCURRENCY_LIMIT, id => kvGetChunked(kv, deploymentKey(id)))
  const recordsById = new Map()
  for (let i = 0; i < curIds.length; i++) {
   const raw = raws[i]
   if (isMissingValue(raw)) {
    continue
   }
   try {
    const norm = normalizeDeploymentRecord(JSON.parse(raw), curIds[i])
    if (norm) {
     recordsById.set(curIds[i], norm)
    }
   }
   catch {
    // ignore corrupt entry
   }
  }

  const specificDepId = secondArg || (curIds.includes(firstArg) && firstArg.includes('::') ? firstArg : '')
  const toRemove = new Set()
  const affectedLanes = new Set()

  if (specificDepId) {
   toRemove.add(specificDepId)
   const rec = recordsById.get(specificDepId)
   if (rec && rec.laneId) {
    affectedLanes.add(rec.laneId)
   }
   else if (firstArg && !firstArg.includes('::')) {
    affectedLanes.add(firstArg)
   }
  }
  else if (firstArg) {
   toRemove.add(firstArg)
   affectedLanes.add(firstArg)
   for (const [id, rec] of recordsById.entries()) {
    if (id === firstArg || (rec && (rec.id === firstArg || rec.laneId === firstArg))) {
     toRemove.add(id)
    }
   }
  }

  for (const rmId of toRemove) {
   await kvDeleteChunked(kv, deploymentKey(rmId))
  }
  const nextIds = curIds.filter(id => !toRemove.has(id))
  if (idx.exists || toRemove.size > 0) {
   await writePagedIds(kv, DEPLOYMENTS_BASE, nextIds)
  }

  for (const laneId of affectedLanes) {
   const stillHas = nextIds.some(id => {
    const rec = recordsById.get(id)
    return rec && rec.laneId === laneId
   })
   if (!stillHas) {
    await kvDeleteChunked(kv, deployedScriptKey(laneId))
   }
  }
 })
}

function collectImportTargetsFromLine(text) {
 const out = []
 const parsedSpec = parseImportLine(text)
 if (parsedSpec && parsedSpec.laneId) {
  out.push(String(parsedSpec.laneId).trim())
  return out
 }
 const src = String(text || '')
 if (!src.includes('importLane')) {
  return out
 }
 try {
  const ast = parse(`${src}\n`)
  const walk = node => {
   if (!Array.isArray(node)) {
    return
   }
   if (node[0] === '@' && node[1] === 'invoke' && Array.isArray(node[2]) && node[3] === 'importLane') {
    const firstArg = node[2][0]
    if (typeof firstArg === 'string' && firstArg.trim().length > 0) {
     out.push(firstArg.trim())
    }
   }
   for (const child of node) {
    if (Array.isArray(child)) {
     walk(child)
    }
   }
  }
  walk(ast)
 }
 catch {
  // ignore unparseable line while scanning imports
 }
 return out
}

export async function collectLaneSyncBundle(rootKv, laneId, options = {}) {
 const kv = unwrapKv(rootKv)
 const cleanLaneId = String(laneId || '').trim()
 const includeImports = Boolean(options.includeImports)
 const openPackageIds = Array.isArray(options.openPackageIds) ? options.openPackageIds : null
 const win = options.win || null
 if (!kv || !cleanLaneId) {
  throw new Error('collectLaneSyncBundle requires rootKv and laneId')
 }

 const pending = [cleanLaneId]
 const seen = new Set()
 const lanes = []

 while (pending.length > 0) {
  const curId = pending.shift()
  if (!curId || seen.has(curId)) {
   continue
  }
  seen.add(curId)

  if (curId !== cleanLaneId && openPackageIds) {
   const access = await checkLaneAccess(kv, openPackageIds, curId)
   if (!access.allowed) {
    continue
   }
  }

  const laneData = kv.namespace(curId)
  const [title, inputsRaw, loadedScript, tables] = await Promise.all([
   laneData.get('title'),
   laneData.get('inputs'),
   loadLaneScript(kv, laneData, curId, win),
   loadLaneTables(kv, laneData, curId),
  ])

  const records = Array.isArray(loadedScript && loadedScript.records)
   ? loadedScript.records.map(r => ({
    id: String(r.id || generateLineId(win)),
    text: r.text === null || r.text === undefined ? '' : String(r.text),
    updatedAt: typeof r.updatedAt === 'string' && r.updatedAt.length > 0 ? r.updatedAt : null,
   }))
   : []

  lanes.push({
   id: curId,
   title: title === null || title === undefined ? '' : String(title),
   inputsRaw: inputsRaw === null || inputsRaw === undefined ? null : String(inputsRaw),
   records,
   tables: Array.isArray(tables) ? tables : [],
  })

  if (includeImports) {
   for (const rec of records) {
    const deps = collectImportTargetsFromLine(rec.text)
    for (const depId of deps) {
     if (depId && !seen.has(depId)) {
      pending.push(depId)
     }
    }
   }
  }
 }

 return {
  mainLaneId: cleanLaneId,
  includeImports,
  lanes,
  collectedAt: new Date().toISOString(),
 }
}

export async function writeLaneSyncBundleToKv(targetRootKv, bundle, win = null) {
 const kv = unwrapKv(targetRootKv)
 if (!kv || !bundle || !Array.isArray(bundle.lanes) || bundle.lanes.length === 0) {
  throw new Error('Invalid lane sync bundle or KV client')
 }
 const syncedIds = []
 for (const item of bundle.lanes) {
  if (!item || !item.id) {
   continue
  }
  const laneId = String(item.id).trim()
  if (!laneId) {
   continue
  }
  const laneData = kv.namespace(laneId)
  if (item.title !== undefined && item.title !== null && item.title !== '') {
   await laneData.set('title', String(item.title))
  }
  else {
   await laneData.set('title', laneId)
  }
  if (item.inputsRaw !== null && item.inputsRaw !== undefined) {
   await laneData.set('inputs', String(item.inputsRaw))
  }
  else {
   await kvDelete(laneData, 'inputs')
  }
  const deployRecords = (Array.isArray(item.records) ? item.records : []).map(r => (
   r && typeof r === 'object'
    ? { id: r.id, text: r.text, updatedAt: r.updatedAt }
    : r
  ))
  await saveLaneScript(kv, laneData, laneId, deployRecords, win, null)
  await saveLaneTables(kv, laneData, laneId, Array.isArray(item.tables) ? item.tables : [])
  syncedIds.push(laneId)
 }
 return {
  ok: true,
  laneCount: syncedIds.length,
  laneIds: syncedIds,
  syncedAt: new Date().toISOString(),
 }
}

export function formatAgentContext(options = {}) {
 const opts = options && typeof options === 'object' ? options : {}
 const sessionId = opts.sessionId !== undefined && opts.sessionId !== null ? String(opts.sessionId).trim() : ''
 const sessionName = opts.sessionName !== undefined && opts.sessionName !== null && String(opts.sessionName).trim()
  ? String(opts.sessionName).trim()
  : sessionId
 const dataDir = normalizeDataDir(opts.dataDir)
 const dataDirConfirmed = opts.dataDirConfirmed === true || Boolean(dataDir)
 const dirLabel = formatDataDirLabel(dataDir, dataDirConfirmed)
 const openPackages = Array.isArray(opts.openPackages) ? opts.openPackages : []
 const openPackageIds = Array.isArray(opts.openPackageIds)
  ? opts.openPackageIds.map(String).filter(Boolean)
  : openPackages.map(p => (p && typeof p === 'object' ? String(p.id || '') : String(p || ''))).filter(Boolean)
 const activePackageId = opts.activePackageId !== undefined && opts.activePackageId !== null
  ? String(opts.activePackageId).trim()
  : ''
 const laneId = opts.laneId !== undefined && opts.laneId !== null ? String(opts.laneId).trim() : ''
 const laneTitle = opts.laneTitle !== undefined && opts.laneTitle !== null && String(opts.laneTitle).trim()
  ? String(opts.laneTitle).trim()
  : laneId
 const lanePackageId = opts.lanePackageId !== undefined && opts.lanePackageId !== null && String(opts.lanePackageId).trim()
  ? String(opts.lanePackageId).trim()
  : ''
 const lanePath = opts.lanePath !== undefined && opts.lanePath !== null && String(opts.lanePath).trim()
  ? String(opts.lanePath).trim()
  : ''
 const openLanes = Array.isArray(opts.openLanes) ? opts.openLanes : []
 const pathname = opts.pathname !== undefined && opts.pathname !== null && String(opts.pathname).trim()
  ? String(opts.pathname).trim()
  : ''
 const lineObj = opts.line && typeof opts.line === 'object' ? opts.line : null
 const rawLineNum = opts.lineNumber ?? opts['line-number'] ?? (lineObj ? (lineObj.lineNumber ?? lineObj['line-number'] ?? lineObj.number) : undefined)
 const lineNumberStr = rawLineNum !== undefined && rawLineNum !== null && String(rawLineNum).trim() !== ''
  ? String(rawLineNum).trim().replace(/^#/, '')
  : ''
 const rawLineId = opts.lineId ?? opts['line-id'] ?? (lineObj ? (lineObj.lineId ?? lineObj['line-id'] ?? lineObj.id) : undefined)
 const lineId = rawLineId !== undefined && rawLineId !== null ? String(rawLineId).trim() : ''
 const rawLineText = opts.lineText ?? opts['line-text'] ?? opts.lineSource ?? (lineObj ? (lineObj.lineText ?? lineObj['line-text'] ?? lineObj.text ?? lineObj.source) : undefined)
 const hasLineText = rawLineText !== undefined && rawLineText !== null && String(rawLineText).length > 0
 const lineText = hasLineText
  ? String(rawLineText).replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\n/g, '\\n')
  : ''
 const rawLineUpdatedAt = opts.lineUpdatedAt ?? opts['line-updated-at'] ?? opts.updatedAt ?? opts['updated-at'] ?? (lineObj ? (lineObj.lineUpdatedAt ?? lineObj['line-updated-at'] ?? lineObj.updatedAt ?? lineObj['updated-at']) : undefined)
 const rawSetBy = opts.lineSetBy ?? opts['line-set-by'] ?? opts.setBy ?? opts['set-by'] ?? (lineObj ? (lineObj.lineSetBy ?? lineObj['line-set-by'] ?? lineObj.setBy ?? lineObj['set-by']) : undefined)
 const rawSetByLabel = opts.lineSetByLabel ?? opts['line-set-by-label'] ?? opts.setByLabel ?? opts['set-by-label'] ?? (lineObj ? (lineObj.lineSetByLabel ?? lineObj['line-set-by-label'] ?? lineObj.setByLabel ?? lineObj['set-by-label']) : undefined)
 const rawSetByTitle = opts.lineSetByTitle ?? opts['line-set-by-title'] ?? opts.setByTitle ?? opts['set-by-title'] ?? (lineObj ? (lineObj.lineSetByTitle ?? lineObj['line-set-by-title'] ?? lineObj.setByTitle ?? lineObj['set-by-title']) : undefined)
 const hasLineInfo = Boolean(lineNumberStr || lineId || lineObj)

 const lines = ['Civil Command Agent Context']
 if (sessionId) {
  lines.push(`Session: ${sessionName && sessionName !== sessionId ? `${sessionName} (${sessionId})` : sessionId}`)
 }
 else if (sessionName) {
  lines.push(`Session: ${sessionName}`)
 }
 lines.push(`Data Directory (basePath): ${dirLabel}`)
 if (openPackages.length > 0) {
  const pkgLabels = openPackages
   .map(pkg => {
    if (!pkg || typeof pkg !== 'object') {
     return String(pkg || '').trim()
    }
    const pid = String(pkg.id || '').trim()
    const pname = String(pkg.name || pid).trim()
    const base = pname && pname !== pid ? `${pname} (${pid})` : (pid || pname)
    return pid && pid === activePackageId ? `${base} [active]` : base
   })
   .filter(Boolean)
  if (pkgLabels.length > 0) {
   lines.push(`Open Packages: ${pkgLabels.join(', ')}`)
  }
 }
 else if (openPackageIds.length > 0) {
  lines.push(`Open Packages: ${openPackageIds.join(', ')}`)
 }
 if (laneId) {
  lines.push(`Lane: ${laneTitle && laneTitle !== laneId ? `${laneTitle} (${laneId})` : laneId}`)
  if (lanePackageId) {
   lines.push(`Lane Package: ${lanePackageId}`)
  }
  if (lanePath) {
   lines.push(`Lane Path: ${lanePath}`)
  }
 }
 else if (openLanes.length > 0) {
  const laneLabels = openLanes
   .map(lane => {
    if (!lane || typeof lane !== 'object') {
     return String(lane || '').trim()
    }
    const lid = String(lane.id || '').trim()
    const ltitle = String(lane.title || lid).trim()
    return ltitle && ltitle !== lid ? `${ltitle} (${lid})` : (lid || ltitle)
   })
   .filter(Boolean)
  if (laneLabels.length > 0) {
   lines.push(`Open Lanes (${laneLabels.length}): ${laneLabels.join(', ')}`)
  }
 }
 if (hasLineInfo) {
  if (lineNumberStr) {
   lines.push(`Line: #${lineNumberStr}${lineId ? ` (${lineId})` : ''}`)
  }
  else if (lineId) {
   lines.push(`Line: ${lineId}`)
  }
  lines.push(`Line ID: ${lineId || '(unsaved)'}`)
  if (hasLineText) {
   lines.push(`Line Source: ${lineText}`)
  }
  const clockDisplayOptions = opts.clockDisplayOptions && typeof opts.clockDisplayOptions === 'object'
   ? opts.clockDisplayOptions
   : (opts['clock-display-options'] && typeof opts['clock-display-options'] === 'object' ? opts['clock-display-options'] : undefined)
  const ts = formatLineTimestamp(rawLineUpdatedAt === undefined || rawLineUpdatedAt === null ? '' : String(rawLineUpdatedAt), clockDisplayOptions)
  const modLabel = ts.known
   ? (ts.display && ts.display !== ts.iso ? `${ts.display} (${ts.iso})` : ts.iso)
   : 'Unknown'
  lines.push(`Line Modified: ${modLabel}`)
  if (rawSetBy && typeof rawSetBy === 'object') {
   const sbLaneId = rawSetBy.laneId !== undefined && rawSetBy.laneId !== null ? String(rawSetBy.laneId).trim() : ''
   const sbLineId = rawSetBy.lineId !== undefined && rawSetBy.lineId !== null ? String(rawSetBy.lineId).trim() : ''
   if (sbLaneId) {
    const sbTitle = rawSetByTitle !== undefined && rawSetByTitle !== null && String(rawSetByTitle).trim()
     ? String(rawSetByTitle).trim()
     : (rawSetBy.laneTitle && String(rawSetBy.laneTitle).trim() ? String(rawSetBy.laneTitle).trim() : sbLaneId)
    const sbLineLbl = rawSetByLabel !== undefined && rawSetByLabel !== null && String(rawSetByLabel).trim()
     ? String(rawSetByLabel).trim()
     : (rawSetBy.lineLabel && String(rawSetBy.lineLabel).trim() ? String(rawSetBy.lineLabel).trim() : sbLineId)
    const sbDesc = sbLineLbl ? `${sbTitle} · ${sbLineLbl}` : sbTitle
    const sbIds = sbLineId ? `${sbLaneId} / ${sbLineId}` : sbLaneId
    const fullSb = (sbTitle !== sbLaneId || (sbLineId && sbLineLbl !== sbLineId))
     ? `${sbDesc} (${sbIds})`
     : sbDesc
    lines.push(`Line Set By: ${fullSb}`)
   }
  }
  else if (typeof rawSetBy === 'string' && rawSetBy.trim()) {
   lines.push(`Line Set By: ${rawSetBy.trim()}`)
  }
 }
 if (pathname) {
  lines.push(`Route: ${pathname}`)
 }
 return lines.join('\n')
}

export function formatAgentPrompt(contextOrOptions = {}) {
 const contextBlock = typeof contextOrOptions === 'string'
  ? contextOrOptions.trim()
  : formatAgentContext(contextOrOptions)
 return `Read @AGENTS.md and use \`./cc\` to inspect my workspace:\n\n${contextBlock}\n\nTask: `
}

export async function inspectSessionForAgent(rootKv, options = {}) {
 const opts = options && typeof options === 'object' ? options : {}
 const registryKv = resolveRegistryKv(rootKv)
 const defaultPkgSessions = registryKv ? await listPackageSessions(registryKv, DEFAULT_PACKAGE_ID) : { sessions: [] }
 const sessions = Array.isArray(defaultPkgSessions && defaultPkgSessions.sessions) ? defaultPkgSessions.sessions : []

 const rawSessionId = opts.sessionId !== undefined && opts.sessionId !== null ? String(opts.sessionId).trim() : ''
 let matchedSession = null
 if (rawSessionId) {
  matchedSession = sessions.find(s => s.id === rawSessionId || s.name === rawSessionId) || null
  if (!matchedSession && registryKv) {
   const rawMeta = await kvGetChunked(registryKv, sessionMetaKey(rawSessionId))
   if (!isMissingValue(rawMeta)) {
    try {
     const meta = JSON.parse(rawMeta)
     if (meta && typeof meta === 'object') {
      const dataDir = normalizeDataDir(meta.dataDir)
      matchedSession = {
       id: String(meta.id || rawSessionId),
       name: meta.name ? String(meta.name) : rawSessionId,
       dataDir,
       dataDirConfirmed: meta.dataDirConfirmed === true || Boolean(dataDir),
       version: Number.isInteger(meta.version) && meta.version > 0 ? meta.version : 1,
       updatedAt: meta.updatedAt || meta.createdAt || null,
      }
     }
    }
    catch {
     matchedSession = null
    }
   }
  }
 }
 else if (sessions.length > 0) {
  matchedSession = sessions[0]
 }

 const resolvedDataDir = opts.dataDir !== undefined
  ? normalizeDataDir(opts.dataDir)
  : (matchedSession ? normalizeDataDir(matchedSession.dataDir) : null)
 const sessionKv = resolveSessionKv(rootKv, resolvedDataDir)

 let sessionRecord = null
 if (matchedSession && matchedSession.id) {
  sessionRecord = await loadOrCreateSessionRecord(rootKv, matchedSession.id)
 }

 const openPackageIds = sessionRecord && Array.isArray(sessionRecord.openPackageIds) && sessionRecord.openPackageIds.length > 0
  ? sessionRecord.openPackageIds
  : [DEFAULT_PACKAGE_ID]
 const catalogLoaded = sessionKv ? await loadSessionCatalog(sessionKv, openPackageIds) : { catalog: {}, list: [] }
 const catalogList = Array.isArray(catalogLoaded && catalogLoaded.list) ? catalogLoaded.list : []
 const rawLaneId = opts.laneId !== undefined && opts.laneId !== null ? String(opts.laneId).trim() : ''
 let resolvedLaneId = rawLaneId
 if (rawLaneId && catalogList.length > 0) {
  const exactId = catalogList.find(item => item && item.id === rawLaneId)
  if (exactId) {
   resolvedLaneId = exactId.id
  }
  else {
   const lower = rawLaneId.toLowerCase()
   const exactTitle = catalogList.find(item => item && String(item.title || '').trim().toLowerCase() === lower)
   if (exactTitle) {
    resolvedLaneId = exactTitle.id
   }
  }
 }
 let lane = null
 if (resolvedLaneId && sessionKv) {
  const laneData = sessionKv.namespace(resolvedLaneId)
  const [title, path, width, minimized, featuresRaw, inputsRaw, scriptLoaded, tables, packageId] = await Promise.all([
   laneData.get('title'),
   laneData.get('path'),
   laneData.get('width'),
   laneData.get('minimized'),
   laneData.get('features'),
   laneData.get('inputs'),
   loadLaneScript(sessionKv, laneData, resolvedLaneId, opts.win || null),
   loadLaneTables(sessionKv, laneData, resolvedLaneId),
   getLanePackageId(sessionKv, resolvedLaneId),
  ])
  let inputs = []
  if (typeof inputsRaw === 'string' && inputsRaw.trim()) {
   try {
    const parsedInputs = JSON.parse(inputsRaw)
    if (Array.isArray(parsedInputs)) {
     inputs = parsedInputs
    }
   }
   catch {
    inputs = []
   }
  }
  const records = Array.isArray(scriptLoaded && scriptLoaded.records) ? scriptLoaded.records : []
  lane = {
   id: resolvedLaneId,
   title: title === null || title === undefined ? '' : String(title),
   packageId,
   path: path === null || path === undefined ? '' : String(path),
   width: width === null || width === undefined ? '' : String(width),
   minimized: minimized === null || minimized === undefined ? '' : String(minimized),
   features: featuresRaw === null || featuresRaw === undefined ? '' : String(featuresRaw),
   inputs,
   scriptInitialized: Boolean(scriptLoaded && scriptLoaded.initialized),
   records,
   lines: records.map(r => (r && r.text !== undefined && r.text !== null ? String(r.text) : '')),
   tables: Array.isArray(tables) ? tables : [],
  }
 }

 return {
  sessions,
  activeSession: sessionRecord ? sessionRecord.meta : matchedSession,
  dataDir: resolvedDataDir,
  openPackages: sessionRecord ? sessionRecord.openPackages : [],
  openPackageIds,
  catalog: catalogList,
  lane,
 }
}

// ---------- Encrypted Set-Once Secret Inputs ----------

export function vaultMasterKey() {
 return 'vault#master-key'
}

export function laneSecretsBase(laneId) {
 return `lanes#${encodeKeySegment(laneId)}/secrets`
}

export function laneSecretKey(laneId, secretId) {
 return `lanes#${encodeKeySegment(laneId)}/secrets/${encodeKeySegment(secretId)}`
}

let fallbackRandomByteSeq = 0
function randomBytes(length) {
 const out = new Uint8Array(length)
 const c = globalThis.crypto
 if (c && typeof c.getRandomValues === 'function') {
  c.getRandomValues(out)
  return out
 }
 for (let i = 0; i < length; i++) {
  fallbackRandomByteSeq = (fallbackRandomByteSeq + 1) & 0xff
  out[i] = (Date.now() + i * 31 + fallbackRandomByteSeq) & 0xff
 }
 return out
}

export async function ensureVaultMasterKey(rootKv) {
 const registryKv = resolveRegistryKv(rootKv) || unwrapKv(rootKv)
 if (registryKv) {
  const existing = await kvGetChunked(registryKv, vaultMasterKey())
  if (!isMissingValue(existing) && typeof existing === 'string' && existing.trim().length >= 64) {
   return existing.trim()
  }
  const generated = bytesToHex(randomBytes(32))
  await kvSetChunked(registryKv, vaultMasterKey(), generated)
  return generated
 }
 return bytesToHex(sha256BytesFallback(utf8Encoder.encode('civil-command-ephemeral-vault-key')))
}

async function deriveSecretKeyBytes(masterKeyHex, laneId, secretId, saltHex) {
 const material = utf8Encoder.encode(`${String(masterKeyHex)}:${String(laneId)}:${String(secretId)}:${String(saltHex)}`)
 const c = globalThis.crypto
 if (c && c.subtle && typeof c.subtle.digest === 'function') {
  try {
   const digest = await c.subtle.digest('SHA-256', material)
   return new Uint8Array(digest)
  }
  catch {
   // fall back to pure JS SHA-256
  }
 }
 return sha256BytesFallback(material)
}

export async function encryptSecretValue(masterKeyHex, laneId, secretId, plaintext) {
 const salt = generateSalt()
 const ivBytes = randomBytes(12)
 const iv = bytesToHex(ivBytes)
 const keyBytes = await deriveSecretKeyBytes(masterKeyHex, laneId, secretId, salt)
 const plainBytes = utf8Encoder.encode(String(plaintext ?? ''))
 const c = globalThis.crypto
 if (!c || !c.subtle || typeof c.subtle.importKey !== 'function' || typeof c.subtle.encrypt !== 'function') {
  throw new Error('WebCrypto AES-256-GCM is required to encrypt secret inputs')
 }
 const cryptoKey = await c.subtle.importKey('raw', keyBytes, { name: 'AES-GCM' }, false, ['encrypt'])
 const encryptedBuf = await c.subtle.encrypt({ name: 'AES-GCM', iv: ivBytes }, cryptoKey, plainBytes)
 const ciphertext = bytesToHex(new Uint8Array(encryptedBuf))
 return {
  v: 1,
  alg: 'AES-256-GCM',
  laneId: String(laneId),
  secretId: String(secretId),
  salt,
  iv,
  ciphertext,
  createdAt: new Date().toISOString(),
 }
}

export async function decryptSecretRecord(masterKeyHex, laneId, secretId, record) {
 if (!record || typeof record !== 'object' || record.alg !== 'AES-256-GCM') {
  throw new Error('Invalid encrypted secret record')
 }
 const ivBytes = hexToBytes(record.iv)
 const cipherBytes = hexToBytes(record.ciphertext)
 if (ivBytes.length === 0 || cipherBytes.length === 0) {
  throw new Error('Corrupt encrypted secret record')
 }
 const keyBytes = await deriveSecretKeyBytes(masterKeyHex, laneId, secretId, record.salt || '')
 const c = globalThis.crypto
 if (!c || !c.subtle || typeof c.subtle.importKey !== 'function' || typeof c.subtle.decrypt !== 'function') {
  throw new Error('WebCrypto AES-256-GCM is required to decrypt secret inputs')
 }
 const cryptoKey = await c.subtle.importKey('raw', keyBytes, { name: 'AES-GCM' }, false, ['decrypt'])
 const plainBuf = await c.subtle.decrypt({ name: 'AES-GCM', iv: ivBytes }, cryptoKey, cipherBytes)
 return utf8Decoder.decode(new Uint8Array(plainBuf))
}

export async function loadLaneSecretRecord(rootKv, _laneData, laneId, secretId) {
 const kv = unwrapKv(rootKv)
 const cleanLaneId = String(laneId || '').trim()
 const cleanSecretId = String(secretId || '').trim()
 if (!kv || !cleanLaneId || !cleanSecretId) {
  return null
 }
 const raw = await kvGetChunked(kv, laneSecretKey(cleanLaneId, cleanSecretId))
 if (isMissingValue(raw)) {
  return null
 }
 try {
  const parsed = JSON.parse(raw)
  return parsed && typeof parsed === 'object' ? parsed : null
 }
 catch {
  return null
 }
}

export async function setLaneSecret(rootKv, laneData, laneId, inputName, plaintext, existingSecretId = '') {
 const kv = unwrapKv(rootKv)
 const cleanLaneId = String(laneId || '').trim()
 const cleanName = String(inputName || '').trim()
 const secretText = plaintext === null || plaintext === undefined ? '' : String(plaintext)
 if (!kv || !cleanLaneId) {
  return { ok: false, error: 'rootKv and laneId are required' }
 }
 if (secretText.length === 0) {
  return { ok: false, error: 'Secret value cannot be empty' }
 }
 const cleanExistingId = String(existingSecretId || '').trim()
 if (cleanExistingId) {
  const existingRecord = await loadLaneSecretRecord(rootKv, laneData, cleanLaneId, cleanExistingId)
  if (existingRecord && existingRecord.ciphertext) {
   return {
    ok: false,
    alreadySet: true,
    error: 'Secret input is already set (set once, cannot reveal or overwrite). Remove the input first to replace it.',
   }
  }
 }
 if (laneData && typeof laneData.get === 'function' && cleanName) {
  const rawInputs = await laneData.get('inputs')
  if (typeof rawInputs === 'string' && rawInputs.trim().startsWith('[')) {
   try {
    const parsed = JSON.parse(rawInputs)
    if (Array.isArray(parsed)) {
     const found = parsed.find(item => item && String(item.name || '').trim() === cleanName && item.type === 'secret')
     if (found && (found.secretSet === true || found.secretId)) {
      const checkId = String(found.secretId || cleanExistingId || '').trim()
      if (checkId) {
       const rec = await loadLaneSecretRecord(rootKv, laneData, cleanLaneId, checkId)
       if (rec && rec.ciphertext) {
        return {
         ok: false,
         alreadySet: true,
         error: 'Secret input is already set (set once, cannot reveal or overwrite). Remove the input first to replace it.',
        }
       }
      }
     }
    }
   }
   catch {}
  }
 }

 const secretId = cleanExistingId || generateId('sec')
 const existingOnDisk = await loadLaneSecretRecord(rootKv, laneData, cleanLaneId, secretId)
 if (existingOnDisk && existingOnDisk.ciphertext) {
  return {
   ok: false,
   alreadySet: true,
   error: 'Secret input is already set (set once, cannot reveal or overwrite). Remove the input first to replace it.',
  }
 }

 const masterKeyHex = await ensureVaultMasterKey(rootKv)
 const encryptedRecord = await encryptSecretValue(masterKeyHex, cleanLaneId, secretId, secretText)
 await kvSetChunked(kv, laneSecretKey(cleanLaneId, secretId), JSON.stringify(encryptedRecord))

 return {
  ok: true,
  laneId: cleanLaneId,
  name: cleanName,
  secretId,
  secretSet: true,
  alg: encryptedRecord.alg,
  createdAt: encryptedRecord.createdAt,
 }
}

export async function resolveLaneSecret(rootKv, laneData, laneId, entry) {
 if (!entry || typeof entry !== 'object' || entry.type !== 'secret') {
  return ''
 }
 const secretId = String(entry.secretId || '').trim()
 if (!secretId) {
  return ''
 }
 const cleanLaneId = String(laneId || '').trim()
 const record = await loadLaneSecretRecord(rootKv, laneData, cleanLaneId, secretId)
 if (!record || !record.ciphertext) {
  return ''
 }
 try {
  const masterKeyHex = await ensureVaultMasterKey(rootKv)
  return await decryptSecretRecord(masterKeyHex, cleanLaneId, secretId, record)
 }
 catch {
  return ''
 }
}

export async function resolveLaneSecrets(rootKv, laneData, laneId, inputs) {
 const list = Array.isArray(inputs) ? inputs : []
 const values = {}
 const secretNames = []
 const secretSetNames = []
 const secretValues = []
 for (const entry of list) {
  if (!entry || typeof entry !== 'object' || entry.type !== 'secret') {
   continue
  }
  const name = String(entry.name || '').trim()
  if (!name) {
   continue
  }
  secretNames.push(name)
  const decrypted = await resolveLaneSecret(rootKv, laneData, laneId, entry)
  values[name] = decrypted
  if (typeof decrypted === 'string' && decrypted.length > 0) {
   secretSetNames.push(name)
   secretValues.push(decrypted)
  }
  else if (entry.secretSet === true) {
   secretSetNames.push(name)
  }
 }
 return {
  values,
  secretNames,
  secretSetNames,
  secretValues,
 }
}

export async function deleteLaneSecret(rootKv, _laneData, laneId, secretId) {
 const kv = unwrapKv(rootKv)
 const cleanLaneId = String(laneId || '').trim()
 const cleanSecretId = String(secretId || '').trim()
 if (!kv || !cleanLaneId || !cleanSecretId) {
  return { ok: false }
 }
 await kvDeleteChunked(kv, laneSecretKey(cleanLaneId, cleanSecretId))
 return { ok: true, laneId: cleanLaneId, secretId: cleanSecretId }
}
