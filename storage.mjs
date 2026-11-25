import {
 coerceDataValue,
 defaultDataValue,
 normalizeColumnWidth,
 parseColumnType,
 parseStoredTables,
} from './field.mjs'

export const MAX_KV_VALUE_BYTES = 1024
export const DEFAULT_PACKAGE_ID = 'default'
export const DEFAULT_PACKAGE_NAME = 'Default'
export const SESSION_STORAGE_KEY = 'civil-command.session'
export const RECENT_SESSIONS_STORAGE_KEY = 'civil-command.recent-sessions'
export const SESSION_HISTORY_STORAGE_KEY = 'civil-command.session-history'

const CONCURRENCY_LIMIT = 16
const MAX_RECENT_SESSIONS = 25
const MAX_SESSION_HISTORY = 100
const utf8Encoder = new TextEncoder()

const writeQueues = new WeakMap()
const chunkCountCache = new WeakMap()
const pagedIndexCache = new WeakMap()
const fallbackStorages = new WeakMap()

function getKvMap(weakMap, kv) {
 let map = weakMap.get(kv)
 if (!map) {
  map = new Map()
  weakMap.set(kv, map)
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
 if (!kv || typeof kv !== 'object') {
  return fn()
 }
 const map = getKvMap(writeQueues, kv)
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
 const cache = kv && typeof kv === 'object' ? getKvMap(chunkCountCache, kv) : null
 if (cache && cache.has(key)) {
  return cache.get(key)
 }
 const existing = await kv.get(key)
 const count = parseChunkManifest(existing)
 return count === null ? 0 : count
}

export async function kvGetChunked(kv, key) {
 if (!kv) {
  return null
 }
 const raw = await kv.get(key)
 if (isMissingValue(raw)) {
  if (typeof kv === 'object') {
   getKvMap(chunkCountCache, kv).set(key, 0)
  }
  return null
 }
 const chunkCount = parseChunkManifest(raw)
 if (chunkCount === null) {
  if (typeof kv === 'object') {
   getKvMap(chunkCountCache, kv).set(key, 0)
  }
  return raw
 }
 if (typeof kv === 'object') {
  getKvMap(chunkCountCache, kv).set(key, chunkCount)
 }
 if (chunkCount === 0) {
  return ''
 }
 const indices = Array.from({ length: chunkCount }, (_, i) => i)
 const parts = await mapConcurrent(indices, CONCURRENCY_LIMIT, idx => kv.get(`${key}.chunks/${idx}`))
 for (const part of parts) {
  if (part === null || part === undefined) {
   return null
  }
 }
 return parts.join('')
}

async function kvSetChunkedUnlocked(kv, key, rawString, maxBytes = MAX_KV_VALUE_BYTES) {
 const str = String(rawString)
 const limit = Math.max(4, Math.floor(Number(maxBytes) || MAX_KV_VALUE_BYTES))
 const cache = kv && typeof kv === 'object' ? getKvMap(chunkCountCache, kv) : null
 const prevCount = await resolvePrevChunkCount(kv, key)

 if (utf8ByteLength(str) <= limit) {
  await kv.set(key, str)
  if (prevCount > 0) {
   const stale = Array.from({ length: prevCount }, (_, i) => i)
   await mapConcurrent(stale, CONCURRENCY_LIMIT, idx => kvDelete(kv, `${key}.chunks/${idx}`))
  }
  if (cache) {
   cache.set(key, 0)
  }
  return
 }

 const chunks = splitUtf8Chunks(str, limit)
 await mapConcurrent(chunks, CONCURRENCY_LIMIT, (chunk, idx) => kv.set(`${key}.chunks/${idx}`, chunk))
 await kv.set(key, JSON.stringify({ __cc_chunks: 1, n: chunks.length }))
 if (prevCount > chunks.length) {
  const stale = Array.from({ length: prevCount - chunks.length }, (_, i) => chunks.length + i)
  await mapConcurrent(stale, CONCURRENCY_LIMIT, idx => kvDelete(kv, `${key}.chunks/${idx}`))
 }
 if (cache) {
  cache.set(key, chunks.length)
 }
}

export function kvSetChunked(kv, key, rawString, maxBytes = MAX_KV_VALUE_BYTES) {
 return enqueueWrite(kv, key, () => kvSetChunkedUnlocked(kv, key, rawString, maxBytes))
}

async function kvDeleteChunkedUnlocked(kv, key) {
 const cache = kv && typeof kv === 'object' ? getKvMap(chunkCountCache, kv) : null
 const prevCount = await resolvePrevChunkCount(kv, key)
 await kvDelete(kv, key)
 if (prevCount > 0) {
  const indices = Array.from({ length: prevCount }, (_, i) => i)
  await mapConcurrent(indices, CONCURRENCY_LIMIT, idx => kvDelete(kv, `${key}.chunks/${idx}`))
 }
 if (cache) {
  cache.set(key, 0)
 }
}

export function kvDeleteChunked(kv, key) {
 return enqueueWrite(kv, key, () => kvDeleteChunkedUnlocked(kv, key))
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
 if (!kv) {
  return { exists: false, ids: [] }
 }
 const indexKey = `${basePrefix}-index`
 const raw = await kvGetChunked(kv, indexKey)
 if (isMissingValue(raw)) {
  if (typeof kv === 'object') {
   getKvMap(pagedIndexCache, kv).delete(basePrefix)
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
  if (typeof kv === 'object') {
   getKvMap(pagedIndexCache, kv).set(basePrefix, { pageCount: 0, pageJsons: [] })
  }
  return { exists: true, ids }
 }
 if (Number.isInteger(parsed.pages) && parsed.pages >= 0) {
  const pageIndices = Array.from({ length: parsed.pages }, (_, i) => i)
  const rawPages = await mapConcurrent(pageIndices, CONCURRENCY_LIMIT, idx => kvGetChunked(kv, `${basePrefix}-pages/${idx}`))
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
  if (typeof kv === 'object') {
   getKvMap(pagedIndexCache, kv).set(basePrefix, { pageCount: parsed.pages, pageJsons })
  }
  return { exists: true, ids }
 }
 return { exists: false, ids: [] }
}

async function resolvePrevPagedInfo(kv, basePrefix) {
 const cache = kv && typeof kv === 'object' ? getKvMap(pagedIndexCache, kv) : null
 if (cache && cache.has(basePrefix)) {
  return cache.get(basePrefix)
 }
 const raw = await kvGetChunked(kv, `${basePrefix}-index`)
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
 const indexKey = `${basePrefix}-index`
 return enqueueWrite(kv, indexKey, async () => {
  const cleanIds = Array.from(ids || [], String)
  const cache = kv && typeof kv === 'object' ? getKvMap(pagedIndexCache, kv) : null
  const prevInfo = await resolvePrevPagedInfo(kv, basePrefix)
  const inlineJson = JSON.stringify({ v: 1, ids: cleanIds })

  if (utf8ByteLength(inlineJson) <= MAX_KV_VALUE_BYTES) {
   await kvSetChunkedUnlocked(kv, indexKey, inlineJson)
   if (prevInfo.pageCount > 0) {
    const stale = Array.from({ length: prevInfo.pageCount }, (_, i) => i)
    await mapConcurrent(stale, CONCURRENCY_LIMIT, idx => kvDeleteChunked(kv, `${basePrefix}-pages/${idx}`))
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
  await mapConcurrent(dirtyIndices, CONCURRENCY_LIMIT, idx => kvSetChunked(kv, `${basePrefix}-pages/${idx}`, pageJsons[idx]))
  await kvSetChunkedUnlocked(kv, indexKey, JSON.stringify({ v: 1, count: cleanIds.length, pages: pageJsons.length }))
  if (prevInfo.pageCount > pageJsons.length) {
   const stale = Array.from({ length: prevInfo.pageCount - pageJsons.length }, (_, i) => pageJsons.length + i)
   await mapConcurrent(stale, CONCURRENCY_LIMIT, idx => kvDeleteChunked(kv, `${basePrefix}-pages/${idx}`))
  }
  if (cache) {
   cache.set(basePrefix, { pageCount: pageJsons.length, pageJsons })
  }
  return cleanIds
 })
}

export function deletePagedIds(kv, basePrefix) {
 const indexKey = `${basePrefix}-index`
 return enqueueWrite(kv, indexKey, async () => {
  const cache = kv && typeof kv === 'object' ? getKvMap(pagedIndexCache, kv) : null
  const prevInfo = await resolvePrevPagedInfo(kv, basePrefix)
  await kvDeleteChunkedUnlocked(kv, indexKey)
  if (prevInfo.pageCount > 0) {
   const stale = Array.from({ length: prevInfo.pageCount }, (_, i) => i)
   await mapConcurrent(stale, CONCURRENCY_LIMIT, idx => kvDeleteChunked(kv, `${basePrefix}-pages/${idx}`))
  }
  if (cache) {
   cache.delete(basePrefix)
  }
 })
}

export function resolveLaneStorage(rootKv, laneData, laneId) {
 const kv = rootKv || (laneData && laneData.root) || laneData
 let legacyKv = laneData || null
 if (!legacyKv && rootKv && typeof rootKv.namespace === 'function' && laneId) {
  legacyKv = rootKv.namespace(laneId)
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
  }
  else if (parsedType.type === 'text' && parsedType.constraint) {
   normalizedCol.constraint = parsedType.constraint
  }
  const width = normalizeColumnWidth(col.width)
  if (width !== null) {
   normalizedCol.width = width
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
}

async function writeSingleTableFull(kv, laneId, table) {
 const rows = Array.isArray(table.rows) ? table.rows : []
 const rowIds = rows.map(r => String(r.id))
 await kvSetChunked(kv, tableSchemaKey(laneId, table.id), serializeTableSchema(table))
 await mapConcurrent(rows, CONCURRENCY_LIMIT, row => kvSetChunked(kv, tableRowKey(laneId, table.id, row.id), serializeTableRow(row)))
 await writePagedIds(kv, tableRowsBase(laneId, table.id), rowIds)
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
 await kvSetChunked(kv, tableSchemaKey(laneId, table.id), serializeTableSchema(table))
 await mapConcurrent(rows, CONCURRENCY_LIMIT, row => kvSetChunked(kv, tableRowKey(laneId, table.id, row.id), serializeTableRow(row)))
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

function serializeScriptLine(record) {
 return JSON.stringify({
  id: String(record.id),
  text: record.text === null || record.text === undefined ? '' : String(record.text),
  updatedAt: typeof record.updatedAt === 'string' && record.updatedAt.length > 0 ? record.updatedAt : null,
 })
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
     records.push({
      id: typeof parsed.id === 'string' && parsed.id.length > 0 ? parsed.id : lineId,
      text: parsed.text === null || parsed.text === undefined ? '' : String(parsed.text),
      updatedAt: typeof parsed.updatedAt === 'string' && parsed.updatedAt.length > 0 ? parsed.updatedAt : null,
     })
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

export async function saveScriptLine(rootKv, laneData, laneId, record, allLineIds, ensureIndex = false, explicitTimestamp = undefined) {
 if (!record || !record.id) {
  return
 }
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
 const { kv } = resolveLaneStorage(rootKv, laneData, laneId)
 const stamp = explicitTimestamp === undefined ? new Date().toISOString() : explicitTimestamp
 const dirty = Array.isArray(dirtyRecords) ? dirtyRecords : []
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
 const { kv, legacyKv } = resolveLaneStorage(rootKv, laneData, laneId)
 const prevIdx = await readPagedIds(kv, laneScriptBase(laneId))
 const stamp = explicitTimestamp === undefined ? new Date().toISOString() : explicitTimestamp
 const records = Array.from(linesOrRecords || []).map(item => {
  if (item && typeof item === 'object') {
   return {
    id: item.id || generateLineId(win),
    text: item.text === null || item.text === undefined ? '' : String(item.text),
    updatedAt: item.updatedAt === undefined ? stamp : item.updatedAt,
   }
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

export function formatLineTimestamp(isoString) {
 if (typeof isoString !== 'string' || isoString.trim().length === 0) {
  return { known: false, display: 'Unknown', iso: '' }
 }
 const dt = new Date(isoString)
 if (Number.isNaN(dt.getTime())) {
  return { known: false, display: 'Unknown', iso: '' }
 }
 let display
 try {
  display = dt.toLocaleString(undefined, {
   year: 'numeric',
   month: 'short',
   day: '2-digit',
   hour: '2-digit',
   minute: '2-digit',
   second: '2-digit',
  })
 }
 catch {
  display = dt.toISOString()
 }
 return { known: true, display, iso: dt.toISOString() }
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
   out.push({
    id,
    name: typeof item.name === 'string' && item.name.trim() ? item.name.trim() : '',
    lastUsedAt: typeof item.lastUsedAt === 'string' ? item.lastUsedAt : '',
   })
  }
  return out
 }
 catch {
  return []
 }
}

function writeRecentSession(local, id, name) {
 const cleanId = String(id || '').trim()
 if (!cleanId) {
  return []
 }
 const existing = readRecentSessions(local)
 const prev = existing.find(item => item.id === cleanId)
 const resolvedName = name !== undefined && name !== null && String(name).trim()
  ? String(name).trim()
  : (prev && prev.name ? prev.name : '')
 const next = [
  { id: cleanId, name: resolvedName, lastUsedAt: new Date().toISOString() },
  ...existing.filter(item => item.id !== cleanId),
 ].slice(0, MAX_RECENT_SESSIONS)
 local.setItem(RECENT_SESSIONS_STORAGE_KEY, JSON.stringify(next))
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
   out.push({
    id: typeof item.id === 'string' && item.id.trim() ? item.id.trim() : generateId('hist'),
    sessionId,
    sessionName: typeof item.sessionName === 'string' && item.sessionName.trim() ? item.sessionName.trim() : sessionId,
    startedAt: typeof item.startedAt === 'string' ? item.startedAt : '',
    endedAt: typeof item.endedAt === 'string' && item.endedAt.trim() ? item.endedAt : null,
    laneCount: Number.isInteger(item.laneCount) && item.laneCount >= 0 ? item.laneCount : 0,
    packageCount: Number.isInteger(item.packageCount) && item.packageCount >= 0 ? item.packageCount : 0,
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

function recordSessionHistory(local, sessionId, sessionName, laneCount = 0, packageCount = 0) {
 const cleanId = String(sessionId || '').trim()
 if (!cleanId) {
  return readSessionHistoryFromStorage(local)
 }
 const now = new Date().toISOString()
 const cleanName = sessionName && String(sessionName).trim() ? String(sessionName).trim() : cleanId
 const cleanLanes = Number.isInteger(laneCount) && laneCount >= 0 ? laneCount : 0
 const cleanPkgs = Number.isInteger(packageCount) && packageCount >= 0 ? packageCount : 0
 const existing = readSessionHistoryFromStorage(local)
 if (existing.length > 0 && existing[0].sessionId === cleanId && !existing[0].endedAt) {
  existing[0] = {
   ...existing[0],
   sessionName: cleanName,
   laneCount: cleanLanes,
   packageCount: cleanPkgs,
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

export async function listPackageSessions(rootKv, packageId) {
 const cleanPkg = String(packageId || '').trim() || DEFAULT_PACKAGE_ID
 if (!rootKv) {
  return { packageId: cleanPkg, sessions: [] }
 }
 const idx = await readPagedIds(rootKv, packageSessionsBase(cleanPkg))
 if (!idx.exists || idx.ids.length === 0) {
  return { packageId: cleanPkg, sessions: [] }
 }
 const rows = await mapConcurrent(idx.ids, CONCURRENCY_LIMIT, async sid => {
  const [rawMeta, pkgIdx] = await Promise.all([
   kvGetChunked(rootKv, sessionMetaKey(sid)),
   readPagedIds(rootKv, sessionPackagesBase(sid)),
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
  return {
   id: String(meta.id || sid),
   name: meta.name ? String(meta.name) : `Session ${sid.slice(0, 8)}`,
   laneCount: countPathnameLanes(pathname, laneIds),
   packageCount: pkgIdx.exists ? pkgIdx.ids.length : 1,
   version: Number.isInteger(meta.version) && meta.version > 0 ? meta.version : 1,
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
 const cleanPkg = String(packageId || '').trim() || DEFAULT_PACKAGE_ID
 if (!rootKv) {
  return { packageId: cleanPkg, lanes: [] }
 }
 const laneIdx = await readPagedIds(rootKv, packageLanesBase(cleanPkg))
 if (!laneIdx.exists || laneIdx.ids.length === 0) {
  return { packageId: cleanPkg, lanes: [] }
 }
 const raws = await mapConcurrent(laneIdx.ids, CONCURRENCY_LIMIT, laneId => kvGetChunked(rootKv, packageLaneKey(cleanPkg, laneId)))
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
 const raw = await kvGetChunked(kv, packageMetaKey(packageId))
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
 const cleanId = String(packageId || '').trim() || DEFAULT_PACKAGE_ID
 const raw = await readRawPackageMeta(rootKv, cleanId)
 if (raw) {
  return sanitizePackageMeta(raw)
 }
 if (cleanId === DEFAULT_PACKAGE_ID) {
  return await ensureDefaultPackage(rootKv)
 }
 return null
}

export async function ensureDefaultPackage(rootKv) {
 if (!rootKv) {
  return {
   id: DEFAULT_PACKAGE_ID,
   name: DEFAULT_PACKAGE_NAME,
   hasPassphrase: false,
   createdAt: null,
   updatedAt: null,
  }
 }
 const existing = await readRawPackageMeta(rootKv, DEFAULT_PACKAGE_ID)
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
 await kvSetChunked(rootKv, packageMetaKey(DEFAULT_PACKAGE_ID), JSON.stringify(meta))
 const idx = await readPagedIds(rootKv, packageLanesBase(DEFAULT_PACKAGE_ID))
 if (!idx.exists) {
  await writePagedIds(rootKv, packageLanesBase(DEFAULT_PACKAGE_ID), [])
 }
 return sanitizePackageMeta(meta)
}

export async function getLanePackageId(rootKv, laneId) {
 if (!rootKv || !laneId) {
  return DEFAULT_PACKAGE_ID
 }
 const raw = await kvGetChunked(rootKv, lanePackageKey(laneId))
 if (isMissingValue(raw)) {
  return DEFAULT_PACKAGE_ID
 }
 const trimmed = String(raw).trim()
 return trimmed.length > 0 ? trimmed : DEFAULT_PACKAGE_ID
}

export async function migrateLegacyCatalog(rootKv) {
 if (!rootKv) {
  return false
 }
 const raw = await rootKv.get('lanes')
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
 await ensureDefaultPackage(rootKv)
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
  const existingPkg = await kvGetChunked(rootKv, lanePackageKey(laneId))
  const packageId = !isMissingValue(existingPkg) && String(existingPkg).trim()
   ? String(existingPkg).trim()
   : DEFAULT_PACKAGE_ID
  if (isMissingValue(existingPkg)) {
   await kvSetChunked(rootKv, lanePackageKey(laneId), packageId)
  }
  const title = entry.title === null || entry.title === undefined ? laneId : String(entry.title)
  const record = { id: laneId, title, packageId }
  await kvSetChunked(rootKv, packageLaneKey(packageId, laneId), JSON.stringify(record))
  let list = grouped.get(packageId)
  if (!list) {
   list = []
   grouped.set(packageId, list)
  }
  list.push(laneId)
 })

 for (const [packageId, laneIds] of grouped.entries()) {
  const existingIdx = await readPagedIds(rootKv, packageLanesBase(packageId))
  const seen = new Set(existingIdx.ids)
  const merged = [...existingIdx.ids]
  for (const id of laneIds) {
   if (!seen.has(id)) {
    seen.add(id)
    merged.push(id)
   }
  }
  await writePagedIds(rootKv, packageLanesBase(packageId), merged)
 }
 await kvDelete(rootKv, 'lanes')
 return true
}

async function loadOrCreateSessionRecord(rootKv, sessionId, defaultName = '') {
 const cleanId = String(sessionId || '').trim()
 await ensureDefaultPackage(rootKv)
 let meta = null
 let isNew = false
 const rawMeta = rootKv ? await kvGetChunked(rootKv, sessionMetaKey(cleanId)) : null
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
 let pkgIdx = rootKv ? await readPagedIds(rootKv, sessionPackagesBase(cleanId)) : { exists: false, ids: [] }
 const now = new Date().toISOString()

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
   createdAt: now,
   updatedAt: now,
  }
  if (rootKv) {
   await kvSetChunked(rootKv, sessionMetaKey(cleanId), JSON.stringify(meta))
  }
 }

 if (!pkgIdx.exists) {
  pkgIdx = { exists: true, ids: [DEFAULT_PACKAGE_ID] }
  if (rootKv) {
   await writePagedIds(rootKv, sessionPackagesBase(cleanId), pkgIdx.ids)
   await addSessionToPackageIndex(rootKv, DEFAULT_PACKAGE_ID, cleanId)
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

 const rawMetas = await mapConcurrent(openPackageIds, CONCURRENCY_LIMIT, pid => getPackageMeta(rootKv, pid))
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

 let activePackageId = typeof meta.activePackageId === 'string' && validIds.includes(meta.activePackageId)
  ? meta.activePackageId
  : (validIds[0] || '')

 if (activePackageId !== meta.activePackageId && rootKv) {
  meta.activePackageId = activePackageId
  meta.updatedAt = now
  await kvSetChunked(rootKv, sessionMetaKey(cleanId), JSON.stringify(meta))
 }

 return {
  isNew,
  meta: {
   id: meta.id,
   name: meta.name || `Session ${cleanId.slice(0, 8)}`,
   activePackageId,
   laneIds,
   pathname,
   version,
   forkedFrom,
   createdAt: meta.createdAt || now,
   updatedAt: meta.updatedAt || now,
  },
  laneIds,
  pathname,
  openPackageIds: validIds,
  openPackages,
  activePackageId,
 }
}

async function buildSessionState(rootKv, win, browserSessionId, activeSessionId, defaultName = '') {
 await migrateLegacyCatalog(rootKv)
 const loaded = await loadOrCreateSessionRecord(rootKv, activeSessionId, defaultName)
 const { local } = getWebStoragePair(win)
 writeRecentSession(local, browserSessionId)
 const recentSessions = writeRecentSession(local, activeSessionId, loaded.meta.name)
 const sessionHistory = recordSessionHistory(
  local,
  activeSessionId,
  loaded.meta.name,
  countPathnameLanes(loaded.pathname, loaded.laneIds),
  loaded.openPackageIds.length,
 )
 return {
  sessionId: activeSessionId,
  browserSessionId,
  isOverridden: activeSessionId !== browserSessionId,
  isNew: loaded.isNew,
  meta: loaded.meta,
  laneIds: loaded.laneIds,
  pathname: loaded.pathname,
  openPackageIds: loaded.openPackageIds,
  openPackages: loaded.openPackages,
  activePackageId: loaded.activePackageId,
  recentSessions,
  sessionHistory,
 }
}

export function initSessionState(rootKv, win) {
 return enqueueWrite(rootKv || win, '__session_init__', async () => {
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
 return buildSessionState(rootKv, win, browserSessionId, cleanNext, opts && opts.name ? String(opts.name) : '')
}

export async function createNewTabSession(rootKv, win, name = '') {
 const nextId = generateId('', win)
 return switchTabSession(rootKv, win, nextId, { name })
}

export async function createNewSession(rootKv, win, opts = {}) {
 const nextId = generateId('', win)
 const name = opts && opts.name ? String(opts.name) : ''
 if (opts && opts.tabOnly) {
  return switchTabSession(rootKv, win, nextId, { name })
 }
 return switchBrowserSession(rootKv, win, nextId, { name })
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
 return buildSessionState(rootKv, win, cleanNext, cleanNext, opts && opts.name ? String(opts.name) : '')
}

export async function renameSession(rootKv, win, sessionId, nextName) {
 const cleanId = String(sessionId || '').trim()
 if (!cleanId) {
  return null
 }
 const loaded = await loadOrCreateSessionRecord(rootKv, cleanId)
 const trimmed = String(nextName || '').trim() || loaded.meta.name
 const now = new Date().toISOString()
 const nextMeta = { ...loaded.meta, name: trimmed, updatedAt: now }
 if (rootKv) {
  await kvSetChunked(rootKv, sessionMetaKey(cleanId), JSON.stringify(nextMeta))
 }
 const { local } = getWebStoragePair(win)
 const recentSessions = writeRecentSession(local, cleanId, trimmed)
 const sessionHistory = recordSessionHistory(
  local,
  cleanId,
  trimmed,
  loaded.laneIds.length,
  loaded.openPackageIds.length,
 )
 return { meta: nextMeta, recentSessions, sessionHistory }
}

export async function saveSessionVersion(rootKv, win, sessionId, opts = {}) {
 const cleanId = String(sessionId || '').trim()
 if (!cleanId) {
  return null
 }
 const loaded = await loadOrCreateSessionRecord(rootKv, cleanId)
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
 const now = new Date().toISOString()
 const nextMeta = {
  ...loaded.meta,
  name: nextName,
  laneIds: nextLaneIds,
  pathname: nextPathname,
  activePackageId: nextActivePkg,
  version: nextVersion,
  updatedAt: now,
 }
 if (rootKv) {
  await writePagedIds(rootKv, sessionPackagesBase(cleanId), nextPkgIds)
  await kvSetChunked(rootKv, sessionMetaKey(cleanId), JSON.stringify(nextMeta))
  const addedPkgs = nextPkgIds.filter(pid => !prevPkgIds.includes(pid))
  const removedPkgs = prevPkgIds.filter(pid => !nextPkgIds.includes(pid))
  await mapConcurrent(addedPkgs, CONCURRENCY_LIMIT, pid => addSessionToPackageIndex(rootKv, pid, cleanId))
  await mapConcurrent(removedPkgs, CONCURRENCY_LIMIT, pid => removeSessionFromPackageIndex(rootKv, pid, cleanId))
 }
 const refreshed = await loadOrCreateSessionRecord(rootKv, cleanId)
 const { local } = getWebStoragePair(win)
 const recentSessions = writeRecentSession(local, cleanId, refreshed.meta.name)
 const sessionHistory = recordSessionHistory(
  local,
  cleanId,
  refreshed.meta.name,
  refreshed.laneIds.length,
  refreshed.openPackageIds.length,
 )
 return {
  ...refreshed,
  recentSessions,
  sessionHistory,
 }
}

export async function forkSession(rootKv, win, sourceSessionId, opts = {}) {
 const srcId = String(sourceSessionId || '').trim()
 const srcLoaded = srcId ? await loadOrCreateSessionRecord(rootKv, srcId) : null
 if (srcId && Array.isArray(opts.restoreSourcePackageIds) && rootKv) {
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
 const now = new Date().toISOString()
 const meta = {
  id: nextId,
  name: forkName,
  activePackageId,
  laneIds,
  pathname,
  version: 1,
  forkedFrom: srcId || null,
  createdAt: now,
  updatedAt: now,
 }
 if (rootKv) {
  await kvSetChunked(rootKv, sessionMetaKey(nextId), JSON.stringify(meta))
  await writePagedIds(rootKv, sessionPackagesBase(nextId), openPackageIds)
  await mapConcurrent(openPackageIds, CONCURRENCY_LIMIT, pid => addSessionToPackageIndex(rootKv, pid, nextId))
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

export async function createPackage(rootKv, sessionId, opts = {}, win = null) {
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
 await kvSetChunked(rootKv, packageMetaKey(pkgId), JSON.stringify(meta))
 await writePagedIds(rootKv, packageLanesBase(pkgId), [])
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
 const cleanSessionId = String(sessionId || '').trim()
 const rawPkgId = opts && opts.packageId !== undefined && opts.packageId !== null ? String(opts.packageId).trim() : ''
 const packageId = rawPkgId || DEFAULT_PACKAGE_ID
 const passphrase = opts && opts.passphrase !== undefined && opts.passphrase !== null ? String(opts.passphrase) : ''
 const setActive = opts && opts.setActive !== undefined ? Boolean(opts.setActive) : true

 if (packageId === DEFAULT_PACKAGE_ID) {
  await ensureDefaultPackage(rootKv)
 }
 const rawMeta = await readRawPackageMeta(rootKv, packageId)
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

 const loaded = await loadOrCreateSessionRecord(rootKv, cleanSessionId)
 const nextIds = loaded.openPackageIds.includes(packageId)
  ? [...loaded.openPackageIds]
  : [...loaded.openPackageIds, packageId]
 await writePagedIds(rootKv, sessionPackagesBase(cleanSessionId), nextIds)
 await addSessionToPackageIndex(rootKv, packageId, cleanSessionId)

 if (setActive && loaded.meta.activePackageId !== packageId) {
  const nextMeta = { ...loaded.meta, activePackageId: packageId, updatedAt: new Date().toISOString() }
  await kvSetChunked(rootKv, sessionMetaKey(cleanSessionId), JSON.stringify(nextMeta))
 }
 const sessionState = await loadOrCreateSessionRecord(rootKv, cleanSessionId)
 return {
  ok: true,
  pkg: sanitizePackageMeta(rawMeta),
  sessionState,
 }
}

export async function closePackageInSession(rootKv, sessionId, packageId) {
 const cleanSessionId = String(sessionId || '').trim()
 const cleanPkgId = String(packageId || '').trim()
 const loaded = await loadOrCreateSessionRecord(rootKv, cleanSessionId)
 const nextIds = loaded.openPackageIds.filter(id => id !== cleanPkgId)
 await writePagedIds(rootKv, sessionPackagesBase(cleanSessionId), nextIds)
 await removeSessionFromPackageIndex(rootKv, cleanPkgId, cleanSessionId)

 if (loaded.meta.activePackageId === cleanPkgId) {
  const nextActive = nextIds[0] || ''
  const nextMeta = { ...loaded.meta, activePackageId: nextActive, updatedAt: new Date().toISOString() }
  await kvSetChunked(rootKv, sessionMetaKey(cleanSessionId), JSON.stringify(nextMeta))
 }
 return await loadOrCreateSessionRecord(rootKv, cleanSessionId)
}

export async function setActivePackageInSession(rootKv, sessionId, packageId) {
 const cleanSessionId = String(sessionId || '').trim()
 const cleanPkgId = String(packageId || '').trim()
 const loaded = await loadOrCreateSessionRecord(rootKv, cleanSessionId)
 if (!loaded.openPackageIds.includes(cleanPkgId)) {
  return loaded
 }
 if (loaded.meta.activePackageId !== cleanPkgId) {
  const nextMeta = { ...loaded.meta, activePackageId: cleanPkgId, updatedAt: new Date().toISOString() }
  await kvSetChunked(rootKv, sessionMetaKey(cleanSessionId), JSON.stringify(nextMeta))
 }
 return await loadOrCreateSessionRecord(rootKv, cleanSessionId)
}

export async function checkLaneAccess(rootKv, openPackageIds, laneId) {
 const packageId = await getLanePackageId(rootKv, laneId)
 const list = Array.isArray(openPackageIds) ? openPackageIds : []
 return {
  allowed: list.includes(packageId),
  packageId,
 }
}

export async function loadSessionCatalog(rootKv, openPackageIds) {
 await migrateLegacyCatalog(rootKv)
 const pkgIds = Array.isArray(openPackageIds) ? openPackageIds : []
 const catalog = {}
 const list = []
 if (!rootKv || pkgIds.length === 0) {
  return { catalog, list }
 }
 const pkgResults = await mapConcurrent(pkgIds, CONCURRENCY_LIMIT, async pkgId => {
  const [pkgMeta, laneIdx] = await Promise.all([
   getPackageMeta(rootKv, pkgId),
   readPagedIds(rootKv, packageLanesBase(pkgId)),
  ])
  if (!pkgMeta || !laneIdx.exists || laneIdx.ids.length === 0) {
   return []
  }
  const laneRaws = await mapConcurrent(laneIdx.ids, CONCURRENCY_LIMIT, laneId => kvGetChunked(rootKv, packageLaneKey(pkgId, laneId)))
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
 const cleanLaneId = String(laneId || '').trim()
 if (!cleanLaneId) {
  return null
 }
 const cleanPkgId = String(packageId || '').trim() || DEFAULT_PACKAGE_ID
 const cleanTitle = title === null || title === undefined ? cleanLaneId : String(title)
 if (!rootKv) {
  return { id: cleanLaneId, title: cleanTitle, packageId: cleanPkgId }
 }
 if (cleanPkgId === DEFAULT_PACKAGE_ID) {
  await ensureDefaultPackage(rootKv)
 }
 const entry = { id: cleanLaneId, title: cleanTitle, packageId: cleanPkgId }
 await kvSetChunked(rootKv, lanePackageKey(cleanLaneId), cleanPkgId)
 await kvSetChunked(rootKv, packageLaneKey(cleanPkgId, cleanLaneId), JSON.stringify(entry))
 const idx = await readPagedIds(rootKv, packageLanesBase(cleanPkgId))
 if (!idx.ids.includes(cleanLaneId)) {
  await writePagedIds(rootKv, packageLanesBase(cleanPkgId), [...idx.ids, cleanLaneId])
 }
 return entry
}

export async function moveLaneToPackage(rootKv, laneId, title, fromPackageId, toPackageId) {
 const cleanLaneId = String(laneId || '').trim()
 const fromPkg = String(fromPackageId || '').trim() || DEFAULT_PACKAGE_ID
 const toPkg = String(toPackageId || '').trim() || DEFAULT_PACKAGE_ID
 const cleanTitle = title === null || title === undefined ? cleanLaneId : String(title)
 if (!cleanLaneId || fromPkg === toPkg) {
  return { id: cleanLaneId, title: cleanTitle, packageId: toPkg }
 }
 const entry = await registerLaneInPackage(rootKv, cleanLaneId, cleanTitle, toPkg)
 if (rootKv) {
  const oldIdx = await readPagedIds(rootKv, packageLanesBase(fromPkg))
  if (oldIdx.exists && oldIdx.ids.includes(cleanLaneId)) {
   await writePagedIds(rootKv, packageLanesBase(fromPkg), oldIdx.ids.filter(id => id !== cleanLaneId))
  }
  await kvDeleteChunked(rootKv, packageLaneKey(fromPkg, cleanLaneId))
 }
 return entry
}
