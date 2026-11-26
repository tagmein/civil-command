import {
 SECRET_MASK,
 formatValue,
 getBrowserTimeZone,
 isMaskedSecretValue,
 isTransportPacket,
 isValidTimeZone,
 normalizeClockHourFormat,
 normalizeClockShowSeconds,
 normalizePrimitiveType,
 parseExportLine,
 parseImportLine,
 redactSecretText,
 redactSecretValue,
} from './field.mjs'

import {
 MAX_KV_VALUE_BYTES,
 encodeKeySegment,
 kvGetChunked,
 kvSetChunked,
 mapConcurrent,
 readPagedIds,
 resolveLaneStorage,
 utf8ByteLength,
 writePagedIds,
} from './storage.mjs'

export const STORY_NAMESPACE = 'stories'
export const DEFAULT_STORY_PAGE_SIZE = 20
export const STORY_INLINE_MAX_BYTES = 940
export const STORY_VALUE_MAX_JSON_CHARS = 4096
export const STORY_PREVIEW_MAX_CHARS = 220

const CONCURRENCY_LIMIT = 16
const MS_PER_DAY = 86400000
const MONTH_NAMES = [
 'January',
 'February',
 'March',
 'April',
 'May',
 'June',
 'July',
 'August',
 'September',
 'October',
 'November',
 'December',
]

const laneWriteQueues = new WeakMap()
const dtfCacheByIntl = new WeakMap()

let idSeqCounter = 0

function enqueueLaneStoryWrite(kv, laneId, fn) {
 if (!kv || typeof kv !== 'object') {
  return fn()
 }
 let byLane = laneWriteQueues.get(kv)
 if (!byLane) {
  byLane = new Map()
  laneWriteQueues.set(kv, byLane)
 }
 const key = String(laneId || '')
 const prev = byLane.get(key) || Promise.resolve()
 const next = prev.catch(() => {}).then(fn)
 byLane.set(key, next)
 const cleanup = () => {
  if (byLane.get(key) === next) {
   byLane.delete(key)
  }
 }
 next.then(cleanup, cleanup)
 return next
}

function getDtf(intl, locale, opts) {
 if (!intl || typeof intl.DateTimeFormat !== 'function') {
  return null
 }
 let cache = dtfCacheByIntl.get(intl)
 if (!cache) {
  cache = new Map()
  dtfCacheByIntl.set(intl, cache)
 }
 const key = `${locale || ''}|${JSON.stringify(opts)}`
 let dtf = cache.get(key)
 if (!dtf) {
  dtf = new intl.DateTimeFormat(locale, opts)
  cache.set(key, dtf)
 }
 return dtf
}

// ---------- 1. civil-memory Namespace & 4-Tier Hierarchical Time Index ----------

export function storyRootIndexKey(laneId) {
 return `${STORY_NAMESPACE}#${encodeKeySegment(laneId)}/idx/root`
}

export function storyYearIndexKey(laneId, year) {
 return `${STORY_NAMESPACE}#${encodeKeySegment(laneId)}/idx/y/${String(year)}`
}

export function storyMonthIndexKey(laneId, yearMonth) {
 return `${STORY_NAMESPACE}#${encodeKeySegment(laneId)}/idx/m/${String(yearMonth)}`
}

export function storyDayIdsBase(laneId, utcDateStr) {
 return `${STORY_NAMESPACE}#${encodeKeySegment(laneId)}/idx/d/${String(utcDateStr)}`
}

export function storyRunCardKey(laneId, utcDateStr, runId) {
 return `${STORY_NAMESPACE}#${encodeKeySegment(laneId)}/r/${String(utcDateStr)}/${encodeKeySegment(runId)}`
}

export function storyRunIoKey(laneId, utcDateStr, runId) {
 return `${STORY_NAMESPACE}#${encodeKeySegment(laneId)}/d/${String(utcDateStr)}/${encodeKeySegment(runId)}/io`
}

export function storyRunOutputKey(laneId, utcDateStr, runId) {
 return `${STORY_NAMESPACE}#${encodeKeySegment(laneId)}/d/${String(utcDateStr)}/${encodeKeySegment(runId)}/out`
}

// ---------- 2. Sortable Run ID & Date Helpers ----------

export function generateStoryRunId(ts = Date.now()) {
 const safeTs = Math.max(0, Math.trunc(Number(ts) || 0))
 const tsPart = String(safeTs).padStart(13, '0')
 idSeqCounter = (idSeqCounter + 1) % 1296
 const seqPart = idSeqCounter.toString(36).padStart(2, '0')
 const randPart = Math.floor(Math.random() * 1296).toString(36).padStart(2, '0')
 return `st-${tsPart}-${seqPart}${randPart}`
}

export function parseStoryRunIdTimestamp(runId) {
 if (typeof runId !== 'string') {
  return null
 }
 const match = /^st-(\d{13,})(?:-|$)/.exec(runId)
 if (!match) {
  return null
 }
 const parsed = Number(match[1])
 return Number.isSafeInteger(parsed) ? parsed : null
}

export function utcDayFromTs(ts) {
 const n = Number(ts)
 const safe = Number.isFinite(n) ? Math.trunc(n) : 0
 return new Date(safe).toISOString().slice(0, 10)
}

export function formatOrdinalDay(day) {
 const n = Math.trunc(Number(day))
 if (!Number.isFinite(n) || n <= 0) {
  return String(day ?? '')
 }
 const mod100 = n % 100
 if (mod100 >= 11 && mod100 <= 13) {
  return `${n}th`
 }
 switch (n % 10) {
  case 1:
   return `${n}st`
  case 2:
   return `${n}nd`
  case 3:
   return `${n}rd`
  default:
   return `${n}th`
 }
}

// ---------- 3. Timezone-Aware Heading Classification & Timeline Formatting ----------

export function resolveStoryTimeZone(timeZone, intl = globalThis.Intl) {
 const tz = typeof timeZone === 'string' ? timeZone.trim() : ''
 if (!tz || tz.toLowerCase() === 'browser') {
  return getBrowserTimeZone(intl) || 'UTC'
 }
 if (isValidTimeZone(tz, intl)) {
  return tz
 }
 return getBrowserTimeZone(intl) || 'UTC'
}

function getZonedParts(ts, timeZone, intl = globalThis.Intl) {
 const date = new Date(ts)
 if (timeZone === 'UTC' || !intl || typeof intl.DateTimeFormat !== 'function') {
  return {
   year: date.getUTCFullYear(),
   month: date.getUTCMonth() + 1,
   day: date.getUTCDate(),
   hour: date.getUTCHours(),
   minute: date.getUTCMinutes(),
   second: date.getUTCSeconds(),
  }
 }
 try {
  const dtf = getDtf(intl, 'en-US', {
   timeZone,
   year: 'numeric',
   month: '2-digit',
   day: '2-digit',
   hour: '2-digit',
   minute: '2-digit',
   second: '2-digit',
   hourCycle: 'h23',
  })
  const parts = dtf.formatToParts(date)
  let year = 0
  let month = 1
  let day = 1
  let hour = 0
  let minute = 0
  let second = 0
  for (const p of parts) {
   if (p.type === 'year') {
    year = Number(p.value)
   }
   else if (p.type === 'month') {
    month = Number(p.value)
   }
   else if (p.type === 'day') {
    day = Number(p.value)
   }
   else if (p.type === 'hour') {
    hour = Number(p.value) % 24
   }
   else if (p.type === 'minute') {
    minute = Number(p.value)
   }
   else if (p.type === 'second') {
    second = Number(p.value)
   }
  }
  return { year, month, day, hour, minute, second }
 }
 catch {
  return {
   year: date.getUTCFullYear(),
   month: date.getUTCMonth() + 1,
   day: date.getUTCDate(),
   hour: date.getUTCHours(),
   minute: date.getUTCMinutes(),
   second: date.getUTCSeconds(),
  }
 }
}

function getZonedCalendar(ts, timeZone, intl = globalThis.Intl) {
 const date = new Date(ts)
 if (timeZone === 'UTC' || !intl || typeof intl.DateTimeFormat !== 'function') {
  return {
   year: date.getUTCFullYear(),
   month: date.getUTCMonth() + 1,
   day: date.getUTCDate(),
  }
 }
 try {
  const dtf = getDtf(intl, 'en-US', {
   timeZone,
   year: 'numeric',
   month: '2-digit',
   day: '2-digit',
  })
  const parts = dtf.formatToParts(date)
  let year = 0
  let month = 1
  let day = 1
  for (const p of parts) {
   if (p.type === 'year') {
    year = Number(p.value)
   }
   else if (p.type === 'month') {
    month = Number(p.value)
   }
   else if (p.type === 'day') {
    day = Number(p.value)
   }
  }
  return { year, month, day }
 }
 catch {
  return {
   year: date.getUTCFullYear(),
   month: date.getUTCMonth() + 1,
   day: date.getUTCDate(),
  }
 }
}

function compareCal(a, b) {
 if (a.year !== b.year) {
  return a.year - b.year
 }
 if (a.month !== b.month) {
  return a.month - b.month
 }
 return a.day - b.day
}

function sameCal(a, b) {
 return a.year === b.year && a.month === b.month && a.day === b.day
}

function shiftCalendarDay(cal, deltaDays) {
 const dt = new Date(Date.UTC(cal.year, cal.month - 1, cal.day + deltaDays))
 return {
  year: dt.getUTCFullYear(),
  month: dt.getUTCMonth() + 1,
  day: dt.getUTCDate(),
 }
}

function formatDateKey(cal) {
 const y = String(cal.year).padStart(4, '0')
 const m = String(cal.month).padStart(2, '0')
 const d = String(cal.day).padStart(2, '0')
 return `${y}-${m}-${d}`
}

function getZonedDayStartTs(year, month, day, timeZone, intl = globalThis.Intl) {
 const utcGuess = Date.UTC(year, month - 1, day, 0, 0, 0, 0)
 if (timeZone === 'UTC' || !intl || typeof intl.DateTimeFormat !== 'function') {
  return utcGuess
 }
 const target = { year, month, day }

 const estimate = refTs => {
  const p = getZonedParts(refTs, timeZone, intl)
  const localAsUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second, 0)
  return utcGuess - (localAsUtc - refTs)
 }

 const t1 = estimate(utcGuess)
 const t2 = estimate(t1)
 const cAtT2 = getZonedCalendar(t2, timeZone, intl)
 const cBeforeT2 = getZonedCalendar(t2 - 1, timeZone, intl)
 if (compareCal(cAtT2, target) >= 0 && compareCal(cBeforeT2, target) < 0) {
  return t2
 }

 // Fallback binary search for midnight-DST transitions
 let lo = utcGuess - 18 * 3600000
 let hi = utcGuess + 18 * 3600000
 while (lo < hi) {
  const mid = lo + Math.floor((hi - lo) / 2)
  const cal = getZonedCalendar(mid, timeZone, intl)
  if (compareCal(cal, target) >= 0) {
   hi = mid
  }
  else {
   lo = mid + 1
  }
 }
 return lo
}

function getZonedDayBounds(cal, timeZone, intl = globalThis.Intl) {
 const next = shiftCalendarDay(cal, 1)
 const startTs = getZonedDayStartTs(cal.year, cal.month, cal.day, timeZone, intl)
 const endTs = getZonedDayStartTs(next.year, next.month, next.day, timeZone, intl) - 1
 return { startTs, endTs }
}

function getZonedYearBounds(year, timeZone, intl = globalThis.Intl) {
 const startTs = getZonedDayStartTs(year, 1, 1, timeZone, intl)
 const endTs = getZonedDayStartTs(year + 1, 1, 1, timeZone, intl) - 1
 return { startTs, endTs }
}

export function classifyStoryHeading(ts, options = {}) {
 const intl = options.intl || globalThis.Intl
 const tz = resolveStoryTimeZone(options.timeZone, intl)
 const nowMs = Number.isFinite(Number(options.now)) ? Number(options.now) : Date.now()
 const entryMs = Number.isFinite(Number(ts)) ? Number(ts) : nowMs

 const nowCal = getZonedCalendar(nowMs, tz, intl)
 const yesterdayCal = shiftCalendarDay(nowCal, -1)
 const entryCal = getZonedCalendar(entryMs, tz, intl)
 const dateKey = formatDateKey(entryCal)

 if (sameCal(entryCal, nowCal) || entryMs > nowMs) {
  const bounds = getZonedDayBounds(nowCal, tz, intl)
  const entryBounds = sameCal(entryCal, nowCal) ? bounds : getZonedDayBounds(entryCal, tz, intl)
  return {
   key: 'today',
   label: 'Today',
   kind: 'today',
   dateKey,
   year: entryCal.year,
   startTs: bounds.startTs,
   endTs: Math.max(bounds.endTs, entryBounds.endTs),
  }
 }

 if (sameCal(entryCal, yesterdayCal)) {
  const bounds = getZonedDayBounds(yesterdayCal, tz, intl)
  return {
   key: 'yesterday',
   label: 'Yesterday',
   kind: 'yesterday',
   dateKey,
   year: entryCal.year,
   startTs: bounds.startTs,
   endTs: bounds.endTs,
  }
 }

 if (entryCal.year === nowCal.year) {
  const bounds = getZonedDayBounds(entryCal, tz, intl)
  return {
   key: `day:${dateKey}`,
   label: `${MONTH_NAMES[entryCal.month - 1]} ${formatOrdinalDay(entryCal.day)}`,
   kind: 'day',
   dateKey,
   year: entryCal.year,
   startTs: bounds.startTs,
   endTs: bounds.endTs,
  }
 }

 if (entryCal.year === nowCal.year - 1) {
  const bounds = getZonedYearBounds(entryCal.year, tz, intl)
  return {
   key: 'last-year',
   label: 'Last year',
   kind: 'last-year',
   year: entryCal.year,
   startTs: bounds.startTs,
   endTs: bounds.endTs,
  }
 }

 const bounds = getZonedYearBounds(entryCal.year, tz, intl)
 return {
  key: 'archives',
  label: 'Archives',
  kind: 'archives',
  year: entryCal.year,
  startTs: bounds.startTs,
  endTs: bounds.endTs,
 }
}

export function formatStoryEntryTime(ts, headingKind, options = {}) {
 const intl = options.intl || globalThis.Intl
 const tz = resolveStoryTimeZone(options.timeZone, intl)
 const hourFormat = normalizeClockHourFormat(options.hourFormat, intl)
 const is12 = hourFormat === '12h'
 const showSeconds = normalizeClockShowSeconds(options.showSeconds)
 const showTimeZone = options.showTimeZone !== false
 const safeMs = Number.isFinite(Number(ts)) ? Number(ts) : 0
 const dateObj = new Date(safeMs)

 const needsDate = headingKind === 'last-year' || headingKind === 'archives'

 if (!intl || typeof intl.DateTimeFormat !== 'function') {
  const iso = dateObj.toISOString()
  const timePart = showSeconds ? iso.slice(11, 19) : iso.slice(11, 16)
  const withZone = showTimeZone ? `${timePart} UTC` : timePart
  return needsDate ? `${iso.slice(0, 10)} · ${withZone}` : withZone
 }

 const timeSpec = {
  timeZone: tz,
  hour: is12 ? 'numeric' : '2-digit',
  minute: '2-digit',
  hour12: is12,
  hourCycle: is12 ? 'h12' : 'h23',
 }
 if (showSeconds) {
  timeSpec.second = '2-digit'
 }
 if (showTimeZone) {
  timeSpec.timeZoneName = 'short'
 }

 try {
  const timeStr = getDtf(intl, 'en-US', timeSpec).format(dateObj).replace(/[\u202f\u00a0]/g, ' ')
  if (!needsDate) {
   return timeStr
  }
  const dateStr = getDtf(intl, 'en-US', {
   timeZone: tz,
   month: 'short',
   day: 'numeric',
   year: 'numeric',
  }).format(dateObj).replace(/[\u202f\u00a0]/g, ' ')
  return `${dateStr} · ${timeStr}`
 }
 catch {
  const iso = dateObj.toISOString()
  const timePart = showSeconds ? iso.slice(11, 19) : iso.slice(11, 16)
  const withZone = showTimeZone ? `${timePart} UTC` : timePart
  return needsDate ? `${iso.slice(0, 10)} · ${withZone}` : withZone
 }
}

// ---------- 4. Snapshot, Redaction & Recorder API ----------

function truncateWithEllipsis(str, maxChars) {
 const text = String(str ?? '')
 if (text.length <= maxChars) {
  return { text, truncated: false }
 }
 if (maxChars <= 1) {
  return { text: text.slice(0, maxChars), truncated: true }
 }
 return { text: `${text.slice(0, maxChars - 1)}…`, truncated: true }
}

function isDomLikeElement(value) {
 if (!value || typeof value !== 'object') {
  return false
 }
 if (typeof Element === 'function' && value instanceof Element) {
  return true
 }
 if (typeof DocumentFragment === 'function' && value instanceof DocumentFragment) {
  return true
 }
 return value.nodeType === 1 || value.nodeType === 11
}

function safeJsonClone(value, secretValues, seen = new WeakSet()) {
 if (isMaskedSecretValue(value)) {
  return value.secretSet ? SECRET_MASK : '(unset secret)'
 }
 if (value === null || typeof value === 'boolean') {
  return value
 }
 if (value === undefined) {
  return undefined
 }
 if (typeof value === 'string') {
  return redactSecretText(value, secretValues)
 }
 if (typeof value === 'number') {
  if (Number.isNaN(value)) {
   return 'NaN'
  }
  if (value === Infinity) {
   return 'Infinity'
  }
  if (value === -Infinity) {
   return '-Infinity'
  }
  if (Object.is(value, -0)) {
   return '-0'
  }
  return value
 }
 if (typeof value === 'bigint') {
  return `${value}n`
 }
 if (typeof value === 'symbol') {
  return String(value)
 }
 if (typeof value === 'function') {
  return '[function]'
 }
 if (value instanceof Date) {
  return Number.isNaN(value.getTime()) ? 'Invalid Date' : value.toISOString()
 }
 if (value instanceof RegExp) {
  return redactSecretText(value.toString(), secretValues)
 }
 if (value instanceof Error) {
  return {
   name: value.name || 'Error',
   message: redactSecretText(value.message || String(value), secretValues),
  }
 }
 if (isDomLikeElement(value)) {
  const tag = String(value.tagName || value.tag || 'element').toLowerCase()
  return `<${tag}>`
 }
 if (isTransportPacket(value)) {
  return {
   type: value.type,
   index: value.index ?? 0,
   lineNumber: value.lineNumber ?? null,
   args: safeJsonClone(value.args ?? [], secretValues, seen),
   bindings: safeJsonClone(value.bindings ?? {}, secretValues, seen),
  }
 }
 if (seen.has(value)) {
  return '[Circular]'
 }
 seen.add(value)
 try {
  if (Array.isArray(value)) {
   const out = []
   for (let i = 0; i < value.length; i++) {
    const item = safeJsonClone(value[i], secretValues, seen)
    out.push(item === undefined ? null : item)
   }
   return out
  }
  if (value instanceof Map) {
   const out = []
   for (const [k, v] of value.entries()) {
    out.push([
     safeJsonClone(k, secretValues, seen),
     safeJsonClone(v, secretValues, seen),
    ])
   }
   return { __type: 'Map', entries: out }
  }
  if (value instanceof Set) {
   const out = []
   for (const v of value.values()) {
    out.push(safeJsonClone(v, secretValues, seen))
   }
   return { __type: 'Set', values: out }
  }
  if (ArrayBuffer.isView(value)) {
   return {
    __type: value.constructor ? value.constructor.name : 'TypedArray',
    length: value.byteLength,
   }
  }
  const out = {}
  for (const key of Object.keys(value)) {
   const safeKey = redactSecretText(key, secretValues)
   try {
    const cloned = safeJsonClone(value[key], secretValues, seen)
    if (cloned !== undefined) {
     out[safeKey] = cloned
    }
   }
   catch {
    out[safeKey] = '[Unreadable]'
   }
  }
  return out
 }
 finally {
  seen.delete(value)
 }
}

export function snapshotStoryValue(rawValue, secretValues = []) {
 const secrets = Array.isArray(secretValues) ? secretValues : []

 if (isMaskedSecretValue(rawValue)) {
  const preview = rawValue.secretSet ? SECRET_MASK : '(unset secret)'
  return {
   type: 'secret',
   preview,
   json: JSON.stringify(preview),
   truncated: false,
  }
 }
 if (rawValue === undefined) {
  return { type: 'undefined', preview: 'undefined', json: 'undefined', truncated: false }
 }
 if (rawValue === null) {
  return { type: 'null', preview: 'null', json: 'null', truncated: false }
 }
 if (typeof rawValue === 'boolean') {
  const str = rawValue ? 'true' : 'false'
  return { type: 'boolean', preview: str, json: str, truncated: false }
 }
 if (typeof rawValue === 'number') {
  let str
  if (Number.isNaN(rawValue)) {
   str = 'NaN'
  }
  else if (rawValue === Infinity) {
   str = 'Infinity'
  }
  else if (rawValue === -Infinity) {
   str = '-Infinity'
  }
  else if (Object.is(rawValue, -0)) {
   str = '-0'
  }
  else {
   str = String(rawValue)
  }
  return { type: 'number', preview: str, json: str, truncated: false }
 }
 if (typeof rawValue === 'bigint') {
  const str = `${rawValue}n`
  return { type: 'bigint', preview: str, json: JSON.stringify(str), truncated: false }
 }
 if (typeof rawValue === 'symbol') {
  const str = String(rawValue)
  return { type: 'symbol', preview: str, json: JSON.stringify(str), truncated: false }
 }
 if (typeof rawValue === 'function') {
  return { type: 'function', preview: '[function]', json: '"[function]"', truncated: false }
 }

 if (isTransportPacket(rawValue)) {
  const rawPreview = redactSecretText(formatValue(rawValue), secrets)
  const cloned = safeJsonClone(rawValue, secrets)
  const rawJson = redactSecretText(JSON.stringify(cloned, null, 2) || rawPreview, secrets)
  const p = truncateWithEllipsis(rawPreview, STORY_PREVIEW_MAX_CHARS)
  const j = truncateWithEllipsis(rawJson, STORY_VALUE_MAX_JSON_CHARS)
  return {
   type: 'transport',
   preview: p.text,
   json: j.text,
   truncated: p.truncated || j.truncated,
  }
 }

 if (typeof rawValue === 'string') {
  const scrubbed = redactSecretText(rawValue, secrets)
  const rawPreview = redactSecretText(formatValue(scrubbed), secrets)
  const rawJson = redactSecretText(JSON.stringify(scrubbed), secrets)
  const p = truncateWithEllipsis(rawPreview, STORY_PREVIEW_MAX_CHARS)
  const j = truncateWithEllipsis(rawJson, STORY_VALUE_MAX_JSON_CHARS)
  return {
   type: 'string',
   preview: p.text,
   json: j.text,
   truncated: p.truncated || j.truncated,
  }
 }

 if (rawValue instanceof Error) {
  const msg = redactSecretText(rawValue.message || String(rawValue), secrets)
  const errObj = {
   name: rawValue.name || 'Error',
   message: msg,
  }
  if (rawValue.stack) {
   errObj.stack = redactSecretText(String(rawValue.stack), secrets)
  }
  const rawPreview = msg || errObj.name
  const rawJson = redactSecretText(JSON.stringify(errObj, null, 2), secrets)
  const p = truncateWithEllipsis(rawPreview, STORY_PREVIEW_MAX_CHARS)
  const j = truncateWithEllipsis(rawJson, STORY_VALUE_MAX_JSON_CHARS)
  return {
   type: 'error',
   preview: p.text,
   json: j.text,
   truncated: p.truncated || j.truncated,
  }
 }

 if (rawValue instanceof Date) {
  const iso = Number.isNaN(rawValue.getTime()) ? 'Invalid Date' : rawValue.toISOString()
  return { type: 'date', preview: iso, json: JSON.stringify(iso), truncated: false }
 }

 const isArr = Array.isArray(rawValue)
 const type = isArr ? 'array' : (isDomLikeElement(rawValue) ? 'element' : 'object')
 const redacted = redactSecretValue(rawValue, secrets)
 const cloned = safeJsonClone(redacted, secrets)
 const rawPreview = redactSecretText(formatValue(cloned), secrets)
 let rawJson
 try {
  rawJson = redactSecretText(JSON.stringify(cloned, null, 2) ?? rawPreview, secrets)
 }
 catch {
  rawJson = rawPreview
 }
 const p = truncateWithEllipsis(rawPreview, STORY_PREVIEW_MAX_CHARS)
 const j = truncateWithEllipsis(rawJson, STORY_VALUE_MAX_JSON_CHARS)
 return {
  type,
  preview: p.text,
  json: j.text,
  truncated: p.truncated || j.truncated,
 }
}

export function captureStoryEnvInputs(inputsList, env) {
 const list = Array.isArray(inputsList) ? inputsList : []
 const secretSetNames = new Set(
  Array.isArray(env?.__secretSetNames)
   ? env.__secretSetNames.map(n => String(n || '').trim()).filter(Boolean)
   : []
 )
 const secretSet = new Set()
 if (Array.isArray(env?.__secretValues)) {
  for (const val of env.__secretValues) {
   if (typeof val === 'string' && val.length > 0) {
    secretSet.add(val)
   }
  }
 }
 const secretValues = [...secretSet]
 const inputs = []

 for (const entry of list) {
  if (!entry || typeof entry !== 'object') {
   continue
  }
  const name = typeof entry.name === 'string' ? entry.name.trim() : String(entry.name || '').trim()
  if (!name) {
   continue
  }
  const type = normalizePrimitiveType(entry.type)
  if (type === 'secret') {
   const isSet = Boolean(entry.secretSet || secretSetNames.has(name))
   const preview = isSet ? SECRET_MASK : '(unset secret)'
   inputs.push({
    name,
    type: 'secret',
    secret: true,
    secretSet: isSet,
    preview,
    json: JSON.stringify(preview),
   })
   continue
  }
  const rawVal = env && typeof env === 'object' ? env[name] : undefined
  const snap = snapshotStoryValue(rawVal, secretValues)
  inputs.push({
   name,
   type,
   secret: false,
   secretSet: false,
   preview: snap.preview,
   json: snap.json,
  })
 }

 return { inputs, secretValues }
}

export function createStoryRunRecorder(meta = {}) {
 const imports = []
 const exports = []
 return {
  laneId: meta.laneId ? String(meta.laneId) : '',
  trigger: meta.trigger ? String(meta.trigger) : 'manual',
  startedAt: Number.isFinite(Number(meta.startedAt)) ? Number(meta.startedAt) : Date.now(),
  imports,
  exports,
  recordImport(item) {
   if (item && typeof item === 'object') {
    imports.push(item)
   }
   return item
  },
  recordExport(item) {
   if (item && typeof item === 'object') {
    exports.push(item)
   }
   return item
  },
 }
}

export async function trackStoryImportCall({
 recorder,
 lineContext,
 lines,
 targetId,
 path,
 laneTitle,
 invokeImport,
} = {}) {
 const idx = lineContext && Number.isInteger(lineContext.index) ? lineContext.index : null
 const lineSource = Array.isArray(lines) && idx !== null && idx >= 0 ? lines[idx] : ''
 const parsed = lineSource ? parseImportLine(lineSource) : null
 const alias = parsed && typeof parsed.alias === 'string' ? parsed.alias : ''
 const resolvedLaneId = targetId !== undefined && targetId !== null && String(targetId) !== ''
  ? String(targetId)
  : (parsed?.laneId || '')
 const resolvedPath = Array.isArray(path)
  ? path.map(seg => String(seg))
  : (path !== undefined && path !== null && path !== '' ? [String(path)] : (parsed?.path || []))
 const resolvedTitle = laneTitle !== undefined && laneTitle !== null && String(laneTitle) !== ''
  ? String(laneTitle)
  : resolvedLaneId
 const lineNumber = lineContext?.lineNumber ?? (idx !== null ? idx + 1 : null)
 const lineId = typeof lineContext?.lineId === 'string' ? lineContext.lineId : ''

 try {
  const value = await invokeImport()
  if (recorder) {
   const event = {
    alias,
    laneId: resolvedLaneId,
    laneTitle: resolvedTitle,
    path: resolvedPath,
    ok: true,
    value,
    error: null,
    lineNumber,
    lineId,
   }
   if (typeof recorder.recordImport === 'function') {
    recorder.recordImport(event)
   }
   else if (Array.isArray(recorder.imports)) {
    recorder.imports.push(event)
   }
  }
  return value
 }
 catch (err) {
  const message = err instanceof Error ? err.message : String(err)
  if (recorder) {
   const event = {
    alias,
    laneId: resolvedLaneId,
    laneTitle: resolvedTitle,
    path: resolvedPath,
    ok: false,
    value: undefined,
    error: message,
    lineNumber,
    lineId,
   }
   if (typeof recorder.recordImport === 'function') {
    recorder.recordImport(event)
   }
   else if (Array.isArray(recorder.imports)) {
    recorder.imports.push(event)
   }
  }
  throw err
 }
}

export function trackStoryExportLineCall({ recorder, lineContext, lines, result } = {}) {
 const idx = lineContext && Number.isInteger(lineContext.index) ? lineContext.index : null
 const lineSource = Array.isArray(lines) && idx !== null && idx >= 0 ? lines[idx] : ''
 const parsed = lineSource ? parseExportLine(lineSource) : null
 const contentExpr = parsed && typeof parsed.contentExpr === 'string' ? parsed.contentExpr : ''
 const lineNumber = lineContext?.lineNumber ?? (idx !== null ? idx + 1 : null)
 const lineId = typeof lineContext?.lineId === 'string' ? lineContext.lineId : ''

 const rawTargets = Array.isArray(result?.targets) ? result.targets : []
 const normalizedTargets = rawTargets.map(t => ({
  laneId: String(t?.laneId ?? ''),
  laneTitle: String(t?.laneTitle ?? t?.laneId ?? ''),
  lineId: String(t?.lineId ?? ''),
  lineNumber: t?.lineNumber != null ? Number(t.lineNumber) : null,
  changed: Boolean(t?.changed),
  ok: t?.ok !== false,
  error: t?.error ? String(t.error) : null,
 }))

 const event = {
  kind: 'line',
  contentExpr,
  content: result?.content ?? '',
  targets: normalizedTargets,
  changedCount: Number.isFinite(Number(result?.changedCount)) ? Number(result.changedCount) : 0,
  ok: result?.ok !== false,
  error: result?.error ? String(result.error) : null,
  lineNumber,
  lineId,
 }
 if (recorder) {
  if (typeof recorder.recordExport === 'function') {
   recorder.recordExport(event)
  }
  else if (Array.isArray(recorder.exports)) {
   recorder.exports.push(event)
  }
 }
 return event
}

export function trackStoryExportTableCall({
 recorder,
 lineContext,
 targetLaneId,
 laneTitle,
 tableName,
 records,
 result,
} = {}) {
 const idx = lineContext && Number.isInteger(lineContext.index) ? lineContext.index : null
 const lineNumber = lineContext?.lineNumber ?? (idx !== null ? idx + 1 : null)
 const lineId = typeof lineContext?.lineId === 'string' ? lineContext.lineId : ''
 const cleanTargetId = String(targetLaneId ?? '')
 const cleanTitle = laneTitle !== undefined && laneTitle !== null && String(laneTitle) !== ''
  ? String(laneTitle)
  : cleanTargetId
 const added = Number.isFinite(Number(result?.added)) ? Number(result.added) : 0
 const updated = Number.isFinite(Number(result?.updated)) ? Number(result.updated) : 0
 const removed = Number.isFinite(Number(result?.removed)) ? Number(result.removed) : 0
 const count = Number.isFinite(Number(result?.count))
  ? Number(result.count)
  : (Array.isArray(records) ? records.length : 0)
 const changedCount = Number.isFinite(Number(result?.changedCount))
  ? Number(result.changedCount)
  : (result?.changed ? Math.max(1, added + updated + removed) : added + updated + removed)

 const event = {
  kind: 'table',
  targets: [
   {
    laneId: cleanTargetId,
    laneTitle: cleanTitle,
    changed: Boolean(result?.changed),
   },
  ],
  tableName: String(tableName || result?.table?.name || ''),
  count,
  added,
  updated,
  changedCount,
  ok: result?.ok !== false,
  error: result?.error ? String(result.error) : null,
  lineNumber,
  lineId,
 }
 if (recorder) {
  if (typeof recorder.recordExport === 'function') {
   recorder.recordExport(event)
  }
  else if (Array.isArray(recorder.exports)) {
   recorder.exports.push(event)
  }
 }
 return event
}

function sanitizeCapturedInput(item, secretValues) {
 if (!item || typeof item !== 'object') {
  return null
 }
 const name = typeof item.name === 'string' ? item.name.trim() : String(item.name || '').trim()
 if (!name) {
  return null
 }
 const type = normalizePrimitiveType(item.type)
 if (type === 'secret' || item.secret === true) {
  const secretSet = Boolean(item.secretSet)
  const preview = secretSet ? SECRET_MASK : '(unset secret)'
  return {
   name,
   type: 'secret',
   secret: true,
   secretSet,
   preview,
   json: JSON.stringify(preview),
  }
 }
 const preview = redactSecretText(String(item.preview ?? ''), secretValues)
 const json = redactSecretText(String(item.json ?? preview), secretValues)
 return {
  name,
  type,
  secret: false,
  secretSet: false,
  preview: truncateWithEllipsis(preview, STORY_PREVIEW_MAX_CHARS).text,
  json: truncateWithEllipsis(json, STORY_VALUE_MAX_JSON_CHARS).text,
 }
}

export function buildStoryRunSnapshot({
 laneId = '',
 ts,
 durationMs,
 trigger = 'manual',
 capturedInputs = null,
 imports = [],
 exports = [],
 outcome = null,
 lineRecords = null,
 error = null,
} = {}) {
 const runTs = Number.isFinite(Number(ts)) ? Math.max(0, Math.trunc(Number(ts))) : Date.now()
 const id = generateStoryRunId(runTs)
 const iso = new Date(runTs).toISOString()
 const day = utcDayFromTs(runTs)
 const trig = trigger ? String(trigger) : 'manual'
 const ms = Number.isFinite(Number(durationMs)) ? Math.max(0, Math.round(Number(durationMs))) : 0
 const secretValues = Array.isArray(capturedInputs?.secretValues) ? capturedInputs.secretValues : []

 const inputs = (Array.isArray(capturedInputs?.inputs) ? capturedInputs.inputs : [])
  .map(item => sanitizeCapturedInput(item, secretValues))
  .filter(Boolean)

 const cleanImports = (Array.isArray(imports) ? imports : []).map(imp => {
  const ok = imp?.ok !== false
  const errText = imp?.error ? redactSecretText(String(imp.error), secretValues) : null
  let preview = ''
  let json = ''
  if (ok) {
   if (imp && Object.hasOwn(imp, 'value')) {
    const snap = snapshotStoryValue(imp.value, secretValues)
    preview = snap.preview
    json = snap.json
   }
   else if (imp?.preview !== undefined) {
    preview = truncateWithEllipsis(redactSecretText(String(imp.preview), secretValues), STORY_PREVIEW_MAX_CHARS).text
    json = truncateWithEllipsis(redactSecretText(String(imp.json ?? imp.preview), secretValues), STORY_VALUE_MAX_JSON_CHARS).text
   }
   else {
    preview = 'undefined'
    json = 'undefined'
   }
  }
  return {
   alias: String(imp?.alias ?? ''),
   laneId: String(imp?.laneId ?? ''),
   laneTitle: redactSecretText(String(imp?.laneTitle ?? imp?.laneId ?? ''), secretValues),
   path: Array.isArray(imp?.path) ? imp.path.map(s => redactSecretText(String(s), secretValues)) : [],
   ok,
   preview,
   json,
   error: errText,
   lineNumber: imp?.lineNumber != null ? Number(imp.lineNumber) : null,
   lineId: typeof imp?.lineId === 'string' ? imp.lineId : '',
  }
 })

 const cleanExports = (Array.isArray(exports) ? exports : []).map(exp => {
  if (exp?.kind === 'table') {
   return {
    kind: 'table',
    targets: (Array.isArray(exp.targets) ? exp.targets : []).map(t => ({
     laneId: String(t?.laneId ?? ''),
     laneTitle: redactSecretText(String(t?.laneTitle ?? t?.laneId ?? ''), secretValues),
     changed: Boolean(t?.changed),
    })),
    tableName: redactSecretText(String(exp.tableName ?? ''), secretValues),
    count: Number.isFinite(Number(exp.count)) ? Number(exp.count) : 0,
    added: Number.isFinite(Number(exp.added)) ? Number(exp.added) : 0,
    updated: Number.isFinite(Number(exp.updated)) ? Number(exp.updated) : 0,
    changedCount: Number.isFinite(Number(exp.changedCount)) ? Number(exp.changedCount) : 0,
    ok: exp.ok !== false,
    error: exp.error ? redactSecretText(String(exp.error), secretValues) : null,
    lineNumber: exp.lineNumber != null ? Number(exp.lineNumber) : null,
    lineId: typeof exp.lineId === 'string' ? exp.lineId : '',
   }
  }
  const rawContent = exp?.content === null || exp?.content === undefined ? '' : String(exp.content)
  const scrubbedContent = redactSecretText(rawContent, secretValues)
  const contentPreview = truncateWithEllipsis(scrubbedContent, STORY_PREVIEW_MAX_CHARS).text
  const boundedContent = truncateWithEllipsis(scrubbedContent, STORY_VALUE_MAX_JSON_CHARS).text
  return {
   kind: 'line',
   contentExpr: redactSecretText(String(exp?.contentExpr ?? ''), secretValues),
   content: boundedContent,
   preview: contentPreview,
   targets: (Array.isArray(exp?.targets) ? exp.targets : []).map(t => ({
    laneId: String(t?.laneId ?? ''),
    laneTitle: redactSecretText(String(t?.laneTitle ?? t?.laneId ?? ''), secretValues),
    lineId: String(t?.lineId ?? ''),
    lineNumber: t?.lineNumber != null ? Number(t.lineNumber) : null,
    changed: Boolean(t?.changed),
    ok: t?.ok !== false,
    error: t?.error ? redactSecretText(String(t.error), secretValues) : null,
   })),
   changedCount: Number.isFinite(Number(exp?.changedCount)) ? Number(exp.changedCount) : 0,
   ok: exp?.ok !== false,
   error: exp?.error ? redactSecretText(String(exp.error), secretValues) : null,
   lineNumber: exp?.lineNumber != null ? Number(exp.lineNumber) : null,
   lineId: typeof exp?.lineId === 'string' ? exp.lineId : '',
  }
 })

 const rawResults = Array.isArray(outcome?.results) ? outcome.results : []
 const cleanLines = rawResults.map((res, idx) => {
  const index = res?.index ?? idx
  const rec = Array.isArray(lineRecords) ? lineRecords[index] : null
  const lineId = typeof res?.lineId === 'string' && res.lineId
   ? res.lineId
   : (rec && typeof rec.id === 'string' ? rec.id : '')
  const rawSource = res?.source ?? rec?.text ?? ''
  const rawPreview = res?.preview ?? ''
  const rawErr = res?.error ?? null
  return {
   lineNumber: res?.lineNumber ?? (index + 1),
   lineId,
   source: redactSecretText(String(rawSource), secretValues),
   preview: truncateWithEllipsis(redactSecretText(String(rawPreview), secretValues), STORY_VALUE_MAX_JSON_CHARS).text,
   error: rawErr ? redactSecretText(String(rawErr), secretValues) : null,
   isEmpty: Boolean(res?.isEmpty),
   isComment: Boolean(res?.isComment),
  }
 })

 const rawSent = Array.isArray(outcome?.sent) ? outcome.sent : []
 const cleanSent = rawSent.map((pkt, idx) => {
  const index = pkt?.index ?? idx
  const lineNumber = pkt?.lineNumber ?? null
  const ast = Array.isArray(pkt?.ast) ? pkt.ast : []
  const stmtCount = ast.filter(n => !(Array.isArray(n) && n[0] === '@' && n[1] === 'comment')).length
  const label = isTransportPacket(pkt)
   ? formatValue(pkt)
   : `[sent #${index + 1} · ${stmtCount} ${stmtCount === 1 ? 'stmt' : 'stmts'}]`
  const argsSnap = snapshotStoryValue(pkt?.args ?? [], secretValues)
  return {
   index,
   lineNumber,
   stmtCount,
   preview: truncateWithEllipsis(redactSecretText(label, secretValues), STORY_PREVIEW_MAX_CHARS).text,
   argsPreview: argsSnap.preview,
  }
 })

 let firstError = null
 let lastNonEmpty = null
 for (let i = 0; i < rawResults.length; i++) {
  const res = rawResults[i]
  if (!res) {
   continue
  }
  if (res.error && !firstError) {
   firstError = {
    message: redactSecretText(String(res.error), secretValues),
    lineNumber: res.lineNumber ?? (i + 1),
   }
  }
  if (!res.isEmpty && !res.isComment && !res.error) {
   lastNonEmpty = {
    value: res.value,
    lineNumber: res.lineNumber ?? (i + 1),
   }
  }
 }

 const explicitErr = error
  ? redactSecretText(error instanceof Error ? error.message : String(error), secretValues)
  : null

 const ok = !explicitErr && !firstError
 let err = null
 let fin
 let finalValue

 if (!ok) {
  const fullErr = explicitErr || firstError.message
  const errLineNumber = explicitErr ? null : firstError.lineNumber
  const errPreview = truncateWithEllipsis(fullErr, STORY_PREVIEW_MAX_CHARS).text
  err = errPreview
  fin = {
   ok: false,
   t: 'error',
   p: errPreview,
   ln: errLineNumber,
  }
  finalValue = {
   type: 'error',
   preview: errPreview,
   json: truncateWithEllipsis(JSON.stringify(fullErr), STORY_VALUE_MAX_JSON_CHARS).text,
   truncated: fullErr.length > STORY_PREVIEW_MAX_CHARS,
   lineNumber: errLineNumber,
  }
 }
 else if (lastNonEmpty) {
  const snap = snapshotStoryValue(lastNonEmpty.value, secretValues)
  fin = {
   ok: true,
   t: snap.type,
   p: snap.preview,
   ln: lastNonEmpty.lineNumber,
  }
  finalValue = {
   ...snap,
   lineNumber: lastNonEmpty.lineNumber,
  }
 }
 else {
  const snap = snapshotStoryValue(undefined, secretValues)
  fin = {
   ok: true,
   t: snap.type,
   p: snap.preview,
   ln: null,
  }
  finalValue = {
   ...snap,
   lineNumber: null,
  }
 }

 const cardBase = {
  v: 1,
  id,
  ts: runTs,
  iso,
  day,
  trig,
  ok,
  ms,
  err,
  fin,
  inCnt: inputs.length,
  impCnt: cleanImports.length,
  expCnt: cleanExports.length,
  lnCnt: cleanLines.length,
  sentCnt: cleanSent.length,
  hasDetail: true,
 }

 const detail = {
  inputs,
  finalValue,
  imports: cleanImports,
  exports: cleanExports,
  lines: cleanLines,
  sent: cleanSent,
 }

 const withInline = { ...cardBase, inl: detail }
 const card = utf8ByteLength(JSON.stringify(withInline)) <= STORY_INLINE_MAX_BYTES
  ? withInline
  : cardBase

 return { card, detail }
}

// ---------- 5. Persisted Write / Read / Query / Buckets API ----------

async function readJsonKey(kv, key) {
 const raw = await kvGetChunked(kv, key)
 if (raw === null || raw === undefined || raw === '') {
  return null
 }
 try {
  return JSON.parse(raw)
 }
 catch {
  return null
 }
}

function compareRunIdsDesc(idA, idB) {
 const tsA = parseStoryRunIdTimestamp(idA) ?? 0
 const tsB = parseStoryRunIdTimestamp(idB) ?? 0
 return (tsB - tsA) || String(idB).localeCompare(String(idA))
}

export async function appendLaneStory(rootKv, laneData, laneId, snapshotInput) {
 const snapshot = snapshotInput && snapshotInput.card && snapshotInput.detail
  ? snapshotInput
  : buildStoryRunSnapshot({ laneId, ...(snapshotInput || {}) })

 const { card, detail } = snapshot
 const cleanLaneId = laneId ? String(laneId) : ''
 const { kv } = resolveLaneStorage(rootKv, laneData, cleanLaneId)
 if (!kv || !cleanLaneId) {
  return { ...card, detail }
 }

 return enqueueLaneStoryWrite(kv, cleanLaneId, async () => {
  const runId = card.id
  const ts = card.ts
  const utcDay = card.day || utcDayFromTs(ts)
  const year = utcDay.slice(0, 4)
  const monthMM = utcDay.slice(5, 7)
  const dayDD = utcDay.slice(8, 10)
  const yearMonth = `${year}-${monthMM}`
  const dayStartMs = Date.UTC(Number(year), Number(monthMM) - 1, Number(dayDD), 0, 0, 0, 0)
  const secOfDay = Math.max(0, Math.min(86399, Math.floor((ts - dayStartMs) / 1000)))

  const writeTasks = [
   kvSetChunked(kv, storyRunCardKey(cleanLaneId, utcDay, runId), JSON.stringify(card)),
  ]
  if (!card.inl) {
   const ioPayload = {
    inputs: detail.inputs || [],
    finalValue: detail.finalValue ?? null,
    imports: detail.imports || [],
    exports: detail.exports || [],
   }
   const outPayload = {
    lines: detail.lines || [],
    sent: detail.sent || [],
   }
   writeTasks.push(
    kvSetChunked(kv, storyRunIoKey(cleanLaneId, utcDay, runId), JSON.stringify(ioPayload)),
    kvSetChunked(kv, storyRunOutputKey(cleanLaneId, utcDay, runId), JSON.stringify(outPayload))
   )
  }
  await Promise.all(writeTasks)

  // Tier 4: Day paged IDs
  const dayBase = storyDayIdsBase(cleanLaneId, utcDay)
  const prevDay = await readPagedIds(kv, dayBase)
  const prevSet = new Set(prevDay.ids)
  const alreadyPresent = prevSet.has(runId)
  if (!alreadyPresent) {
   prevSet.add(runId)
  }
  const nextDayIds = Array.from(prevSet).sort(compareRunIdsDesc)
  await writePagedIds(kv, dayBase, nextDayIds)

  // Tier 3: Month index
  const monthKey = storyMonthIndexKey(cleanLaneId, yearMonth)
  const prevMonth = await readJsonKey(kv, monthKey)
  const dayRows = Array.isArray(prevMonth?.d) ? prevMonth.d.map(row => [...row]) : []
  const existingDayIdx = dayRows.findIndex(row => Array.isArray(row) && row[0] === dayDD)
  if (existingDayIdx >= 0) {
   const row = dayRows[existingDayIdx]
   const prevMin = Number.isFinite(Number(row[2])) ? Number(row[2]) : secOfDay
   const prevMax = Number.isFinite(Number(row[3])) ? Number(row[3]) : secOfDay
   dayRows[existingDayIdx] = [
    dayDD,
    nextDayIds.length,
    Math.min(prevMin, secOfDay),
    Math.max(prevMax, secOfDay),
   ]
  }
  else {
   dayRows.push([dayDD, nextDayIds.length, secOfDay, secOfDay])
  }
  dayRows.sort((a, b) => String(b[0]).localeCompare(String(a[0])))
  const monthCount = dayRows.reduce((sum, row) => sum + (Number(row[1]) || 0), 0)
  const monthIdx = {
   v: 1,
   ym: yearMonth,
   c: monthCount,
   d: dayRows,
  }
  await kvSetChunked(kv, monthKey, JSON.stringify(monthIdx))

  // Tier 2: Year index
  const yearKey = storyYearIndexKey(cleanLaneId, year)
  const prevYear = await readJsonKey(kv, yearKey)
  const monthRows = Array.isArray(prevYear?.m) ? prevYear.m.map(row => [...row]) : []
  const existingMonthIdx = monthRows.findIndex(row => Array.isArray(row) && row[0] === monthMM)
  if (existingMonthIdx >= 0) {
   const row = monthRows[existingMonthIdx]
   const prevFirst = row[2] != null && Number.isFinite(Number(row[2])) ? Number(row[2]) : ts
   const prevLast = row[3] != null && Number.isFinite(Number(row[3])) ? Number(row[3]) : ts
   monthRows[existingMonthIdx] = [
    monthMM,
    monthCount,
    Math.min(prevFirst, ts),
    Math.max(prevLast, ts),
   ]
  }
  else {
   monthRows.push([monthMM, monthCount, ts, ts])
  }
  monthRows.sort((a, b) => String(b[0]).localeCompare(String(a[0])))
  let yearCount = 0
  let yearFirstTs = null
  let yearLastTs = null
  for (const row of monthRows) {
   yearCount += Number(row[1]) || 0
   if (row[2] != null && Number.isFinite(Number(row[2]))) {
    yearFirstTs = yearFirstTs === null ? Number(row[2]) : Math.min(yearFirstTs, Number(row[2]))
   }
   if (row[3] != null && Number.isFinite(Number(row[3]))) {
    yearLastTs = yearLastTs === null ? Number(row[3]) : Math.max(yearLastTs, Number(row[3]))
   }
  }
  const yearIdx = {
   v: 1,
   y: year,
   c: yearCount,
   firstTs: yearFirstTs,
   lastTs: yearLastTs,
   m: monthRows,
  }
  await kvSetChunked(kv, yearKey, JSON.stringify(yearIdx))

  // Tier 1: Root index
  const rootKey = storyRootIndexKey(cleanLaneId)
  const prevRoot = await readJsonKey(kv, rootKey)
  const yearSet = new Set(Array.isArray(prevRoot?.years) ? prevRoot.years.map(String) : [])
  yearSet.add(year)
  const years = Array.from(yearSet).sort((a, b) => b.localeCompare(a))
  const prevTotal = Number.isFinite(Number(prevRoot?.total)) ? Number(prevRoot.total) : 0
  const nextTotal = alreadyPresent ? Math.max(prevTotal, yearCount) : prevTotal + 1
  const prevRootFirst = prevRoot?.firstTs != null && Number.isFinite(Number(prevRoot.firstTs))
   ? Number(prevRoot.firstTs)
   : null
  const prevRootLast = prevRoot?.lastTs != null && Number.isFinite(Number(prevRoot.lastTs))
   ? Number(prevRoot.lastTs)
   : null
  const rootIdx = {
   v: 1,
   total: years.length <= 1 ? yearCount : nextTotal,
   firstTs: prevRootFirst === null ? ts : Math.min(prevRootFirst, ts),
   lastTs: prevRootLast === null ? ts : Math.max(prevRootLast, ts),
   years,
  }
  await kvSetChunked(kv, rootKey, JSON.stringify(rootIdx))

  return { ...card, detail }
 })
}

export async function recordLaneStoryFromRun(
 rootKv,
 laneData,
 laneId,
 recorder,
 capturedInputs,
 outcome,
 lineRecords,
 extraMeta = {}
) {
 const snapshot = buildStoryRunSnapshot({
  laneId,
  ts: extraMeta.ts ?? Date.now(),
  durationMs: extraMeta.durationMs ?? (
   recorder && Number.isFinite(Number(recorder.startedAt))
    ? Math.max(0, Date.now() - Number(recorder.startedAt))
    : 0
  ),
  trigger: extraMeta.trigger ?? recorder?.trigger ?? 'manual',
  capturedInputs,
  imports: extraMeta.imports ?? recorder?.imports ?? [],
  exports: extraMeta.exports ?? recorder?.exports ?? [],
  outcome,
  lineRecords,
  error: extraMeta.error ?? null,
 })

 const cleanLaneId = laneId ? String(laneId) : ''
 const { kv } = resolveLaneStorage(rootKv, laneData, cleanLaneId)
 if (!kv || !cleanLaneId) {
  return { ...snapshot.card, detail: snapshot.detail }
 }

 return appendLaneStory(rootKv, laneData, cleanLaneId, snapshot)
}

export async function loadLaneStoryDetail(rootKv, laneData, laneId, card) {
 if (!card || typeof card !== 'object') {
  return null
 }
 if (card.detail && typeof card.detail === 'object') {
  return card.detail
 }
 if (card.inl && typeof card.inl === 'object') {
  return card.inl
 }
 const cleanLaneId = laneId ? String(laneId) : ''
 const { kv } = resolveLaneStorage(rootKv, laneData, cleanLaneId)
 if (!kv || !cleanLaneId || !card.id) {
  return null
 }
 const inferredTs = Number.isFinite(Number(card.ts))
  ? Number(card.ts)
  : parseStoryRunIdTimestamp(card.id)
 const utcDay = card.day || (inferredTs !== null ? utcDayFromTs(inferredTs) : '')
 if (!utcDay) {
  return null
 }
 const [io, out] = await Promise.all([
  readJsonKey(kv, storyRunIoKey(cleanLaneId, utcDay, card.id)),
  readJsonKey(kv, storyRunOutputKey(cleanLaneId, utcDay, card.id)),
 ])
 if (!io && !out) {
  return {
   inputs: [],
   finalValue: null,
   imports: [],
   exports: [],
   lines: [],
   sent: [],
  }
 }
 return {
  inputs: Array.isArray(io?.inputs) ? io.inputs : [],
  finalValue: io?.finalValue ?? null,
  imports: Array.isArray(io?.imports) ? io.imports : [],
  exports: Array.isArray(io?.exports) ? io.exports : [],
  lines: Array.isArray(out?.lines) ? out.lines : [],
  sent: Array.isArray(out?.sent) ? out.sent : [],
 }
}

function passesCursor(ts, id, beforeTs, beforeId) {
 if (beforeTs === null) {
  return true
 }
 if (ts < beforeTs) {
  return true
 }
 if (ts === beforeTs && beforeId !== null) {
  return String(id).localeCompare(beforeId) < 0
 }
 return false
}

function passesRange(ts, startTs, endTs) {
 if (startTs !== null && ts < startTs) {
  return false
 }
 if (endTs !== null && ts > endTs) {
  return false
 }
 return true
}

export async function queryLaneStories(rootKv, laneData, laneId, options = {}) {
 const cleanLaneId = laneId ? String(laneId) : ''
 const { kv } = resolveLaneStorage(rootKv, laneData, cleanLaneId)
 if (!kv || !cleanLaneId) {
  return { entries: [], hasMore: false, nextCursor: null, total: 0 }
 }

 const limit = Math.max(1, Math.trunc(Number(options.limit) || DEFAULT_STORY_PAGE_SIZE))
 const beforeTs = options.beforeTs !== undefined && options.beforeTs !== null && Number.isFinite(Number(options.beforeTs))
  ? Number(options.beforeTs)
  : null
 const beforeId = typeof options.beforeId === 'string' && options.beforeId.length > 0
  ? options.beforeId
  : null
 const startTs = options.startTs !== undefined && options.startTs !== null && Number.isFinite(Number(options.startTs))
  ? Number(options.startTs)
  : null
 const endTs = options.endTs !== undefined && options.endTs !== null && Number.isFinite(Number(options.endTs))
  ? Number(options.endTs)
  : null

 const rootIdx = await readJsonKey(kv, storyRootIndexKey(cleanLaneId))
 if (!rootIdx || !Array.isArray(rootIdx.years) || rootIdx.years.length === 0) {
  return { entries: [], hasMore: false, nextCursor: null, total: 0 }
 }

 const total = Number.isFinite(Number(rootIdx.total)) ? Number(rootIdx.total) : 0
 const effectiveStart = startTs !== null ? startTs : -Infinity
 const effectiveEnd = Math.min(
  endTs !== null ? endTs : Infinity,
  beforeTs !== null ? beforeTs : Infinity
 )
 if (effectiveStart > effectiveEnd) {
  return { entries: [], hasMore: false, nextCursor: null, total }
 }

 const years = rootIdx.years.map(String).sort((a, b) => b.localeCompare(a))
 const collected = []
 let hasMore = false

 yearLoop: for (const yearStr of years) {
  const yNum = Number(yearStr)
  if (!Number.isInteger(yNum)) {
   continue
  }
  const yStart = Date.UTC(yNum, 0, 1, 0, 0, 0, 0)
  const yEnd = Date.UTC(yNum + 1, 0, 1, 0, 0, 0, 0) - 1
  if (yEnd < effectiveStart || yStart > effectiveEnd) {
   continue
  }

  const yearIdx = await readJsonKey(kv, storyYearIndexKey(cleanLaneId, yearStr))
  if (!yearIdx || !Array.isArray(yearIdx.m) || yearIdx.m.length === 0) {
   continue
  }
  if (
   (yearIdx.lastTs != null && Number(yearIdx.lastTs) < effectiveStart) ||
   (yearIdx.firstTs != null && Number(yearIdx.firstTs) > effectiveEnd)
  ) {
   continue
  }

  const months = [...yearIdx.m].sort((a, b) => String(b[0]).localeCompare(String(a[0])))
  for (const mRow of months) {
   const monthMM = String(mRow[0])
   const mNum = Number(monthMM)
   if (!Number.isInteger(mNum) || mNum < 1 || mNum > 12) {
    continue
   }
   const mStart = Date.UTC(yNum, mNum - 1, 1, 0, 0, 0, 0)
   const mEnd = Date.UTC(yNum, mNum, 1, 0, 0, 0, 0) - 1
   if (mEnd < effectiveStart || mStart > effectiveEnd) {
    continue
   }
   if (
    (mRow[3] != null && Number(mRow[3]) < effectiveStart) ||
    (mRow[2] != null && Number(mRow[2]) > effectiveEnd)
   ) {
    continue
   }

   const yearMonth = `${yearStr}-${monthMM}`
   const monthIdx = await readJsonKey(kv, storyMonthIndexKey(cleanLaneId, yearMonth))
   if (!monthIdx || !Array.isArray(monthIdx.d) || monthIdx.d.length === 0) {
    continue
   }

   const days = [...monthIdx.d].sort((a, b) => String(b[0]).localeCompare(String(a[0])))
   for (const dRow of days) {
    const dayDD = String(dRow[0])
    const dNum = Number(dayDD)
    if (!Number.isInteger(dNum) || dNum < 1 || dNum > 31) {
     continue
    }
    const dayBase = Date.UTC(yNum, mNum - 1, dNum, 0, 0, 0, 0)
    const minSec = Number.isFinite(Number(dRow[2])) ? Number(dRow[2]) : 0
    const maxSec = Number.isFinite(Number(dRow[3])) ? Number(dRow[3]) : 86399
    const dStart = dayBase + minSec * 1000
    const dEnd = dayBase + maxSec * 1000 + 999
    if (dEnd < effectiveStart || dStart > effectiveEnd) {
     continue
    }

    const utcDay = `${yearMonth}-${dayDD}`
    const dayPaged = await readPagedIds(kv, storyDayIdsBase(cleanLaneId, utcDay))
    for (const runId of dayPaged.ids) {
     const ts = parseStoryRunIdTimestamp(runId)
     if (ts === null) {
      continue
     }
     if (!passesRange(ts, startTs, endTs) || !passesCursor(ts, runId, beforeTs, beforeId)) {
      continue
     }
     if (collected.length < limit) {
      collected.push({ utcDay, runId, ts })
     }
     else {
      hasMore = true
      break yearLoop
     }
    }
   }
  }
 }

 const cards = await mapConcurrent(collected, CONCURRENCY_LIMIT, item =>
  readJsonKey(kv, storyRunCardKey(cleanLaneId, item.utcDay, item.runId))
 )
 const entries = cards.filter(card => card && typeof card === 'object')
 const lastEntry = entries.length > 0 ? entries[entries.length - 1] : null
 const nextCursor = hasMore && lastEntry
  ? { beforeTs: lastEntry.ts, beforeId: lastEntry.id }
  : null

 return {
  entries,
  hasMore,
  nextCursor,
  total,
 }
}

export async function loadLaneStoryBuckets(rootKv, laneData, laneId, options = {}) {
 const cleanLaneId = laneId ? String(laneId) : ''
 const { kv } = resolveLaneStorage(rootKv, laneData, cleanLaneId)
 if (!kv || !cleanLaneId) {
  return { total: 0, firstTs: null, lastTs: null, buckets: [] }
 }

 const intl = options.intl || globalThis.Intl
 const tz = resolveStoryTimeZone(options.timeZone, intl)
 const nowMs = Number.isFinite(Number(options.now)) ? Number(options.now) : Date.now()
 const nowCal = getZonedCalendar(nowMs, tz, intl)
 const nowYear = nowCal.year

 const rootIdx = await readJsonKey(kv, storyRootIndexKey(cleanLaneId))
 if (!rootIdx || !Array.isArray(rootIdx.years) || rootIdx.years.length === 0) {
  return {
   total: 0,
   firstTs: rootIdx?.firstTs ?? null,
   lastTs: rootIdx?.lastTs ?? null,
   buckets: [],
  }
 }

 const years = rootIdx.years.map(String).sort((a, b) => b.localeCompare(a))
 const yearIndices = await mapConcurrent(years, CONCURRENCY_LIMIT, y =>
  readJsonKey(kv, storyYearIndexKey(cleanLaneId, y))
 )
 const yearMap = new Map()
 for (let i = 0; i < years.length; i++) {
  if (yearIndices[i]) {
   yearMap.set(years[i], yearIndices[i])
  }
 }

 const bucketMap = new Map()
 const archiveYearCounts = new Map()

 const addToBucket = (heading, count) => {
  if (!count || count <= 0) {
   return
  }
  const existing = bucketMap.get(heading.key)
  if (existing) {
   existing.count += count
   existing.startTs = Math.min(existing.startTs, heading.startTs)
   existing.endTs = Math.max(existing.endTs, heading.endTs)
  }
  else {
   bucketMap.set(heading.key, {
    key: heading.key,
    label: heading.label,
    kind: heading.kind,
    dateKey: heading.dateKey,
    year: heading.year,
    count,
    startTs: heading.startTs,
    endTs: heading.endTs,
   })
  }
  if (heading.kind === 'archives' && Number.isInteger(heading.year)) {
   archiveYearCounts.set(heading.year, (archiveYearCounts.get(heading.year) || 0) + count)
  }
 }

 const classifyOpts = { now: nowMs, timeZone: tz, intl }

 const processMonthDays = async (utcYearStr, monthMM) => {
  const yearMonth = `${utcYearStr}-${monthMM}`
  const monthIdx = await readJsonKey(kv, storyMonthIndexKey(cleanLaneId, yearMonth))
  if (!monthIdx || !Array.isArray(monthIdx.d)) {
   return
  }
  const yNum = Number(utcYearStr)
  const mNum = Number(monthMM)
  const straddlingDays = []

  for (const dRow of monthIdx.d) {
   const dayDD = String(dRow[0])
   const dCount = Number(dRow[1]) || 0
   if (dCount <= 0) {
    continue
   }
   const dNum = Number(dayDD)
   const dayBase = Date.UTC(yNum, mNum - 1, dNum, 0, 0, 0, 0)
   const minSec = Number.isFinite(Number(dRow[2])) ? Number(dRow[2]) : 0
   const maxSec = Number.isFinite(Number(dRow[3])) ? Number(dRow[3]) : 86399
   const minTs = dayBase + minSec * 1000
   const maxTs = dayBase + maxSec * 1000 + 999

   const minH = classifyStoryHeading(minTs, classifyOpts)
   const maxH = classifyStoryHeading(maxTs, classifyOpts)
   if (minH.key === maxH.key && (minH.kind !== 'archives' || minH.year === maxH.year)) {
    addToBucket(minH, dCount)
   }
   else {
    straddlingDays.push(`${yearMonth}-${dayDD}`)
   }
  }

  if (straddlingDays.length > 0) {
   const dayPages = await mapConcurrent(straddlingDays, CONCURRENCY_LIMIT, utcDay =>
    readPagedIds(kv, storyDayIdsBase(cleanLaneId, utcDay))
   )
   for (const page of dayPages) {
    for (const runId of page.ids) {
     const ts = parseStoryRunIdTimestamp(runId)
     if (ts === null) {
      continue
     }
     addToBucket(classifyStoryHeading(ts, classifyOpts), 1)
    }
   }
  }
 }

 const monthsToInspect = []
 for (const yearStr of years) {
  const yearIdx = yearMap.get(yearStr)
  if (!yearIdx || !Array.isArray(yearIdx.m)) {
   continue
  }
  const yNum = Number(yearStr)
  for (const mRow of yearIdx.m) {
   const monthMM = String(mRow[0])
   const mCount = Number(mRow[1]) || 0
   if (mCount <= 0) {
    continue
   }
   const mFirst = mRow[2] != null && Number.isFinite(Number(mRow[2])) ? Number(mRow[2]) : null
   const mLast = mRow[3] != null && Number.isFinite(Number(mRow[3])) ? Number(mRow[3]) : null

   // Always inspect all months in nowYear, plus boundary months (Dec of nowYear-1, Jan of nowYear+1)
   const isNowYear = yNum === nowYear
   const isPrevDec = yNum === nowYear - 1 && monthMM === '12'
   const isNextJan = yNum === nowYear + 1 && monthMM === '01'

   if (isNowYear || isPrevDec || isNextJan) {
    monthsToInspect.push([yearStr, monthMM])
    continue
   }

   if (mFirst !== null && mLast !== null) {
    const hFirst = classifyStoryHeading(mFirst, classifyOpts)
    const hLast = classifyStoryHeading(mLast, classifyOpts)
    if (
     hFirst.key === hLast.key &&
     (hFirst.kind !== 'archives' || hFirst.year === hLast.year) &&
     (hFirst.kind === 'last-year' || hFirst.kind === 'archives')
    ) {
     addToBucket(hFirst, mCount)
     continue
    }
   }

   // Straddling year boundary month (or missing timestamps): inspect month index
   monthsToInspect.push([yearStr, monthMM])
  }
 }

 await mapConcurrent(monthsToInspect, CONCURRENCY_LIMIT, ([y, m]) => processMonthDays(y, m))

 // Assemble ordered buckets: Today, Yesterday, <Month> <Ordinal> desc, Last year, Archives
 const buckets = []
 if (bucketMap.has('today')) {
  const b = bucketMap.get('today')
  buckets.push({
   key: b.key,
   label: b.label,
   kind: b.kind,
   count: b.count,
   startTs: b.startTs,
   endTs: b.endTs,
  })
 }
 if (bucketMap.has('yesterday')) {
  const b = bucketMap.get('yesterday')
  buckets.push({
   key: b.key,
   label: b.label,
   kind: b.kind,
   count: b.count,
   startTs: b.startTs,
   endTs: b.endTs,
  })
 }

 const dayBuckets = []
 for (const b of bucketMap.values()) {
  if (b.kind === 'day') {
   dayBuckets.push(b)
  }
 }
 dayBuckets.sort((a, b) => String(b.dateKey || '').localeCompare(String(a.dateKey || '')))
 for (const b of dayBuckets) {
  buckets.push({
   key: b.key,
   label: b.label,
   kind: b.kind,
   count: b.count,
   startTs: b.startTs,
   endTs: b.endTs,
  })
 }

 if (bucketMap.has('last-year')) {
  const b = bucketMap.get('last-year')
  buckets.push({
   key: b.key,
   label: b.label,
   kind: b.kind,
   count: b.count,
   startTs: b.startTs,
   endTs: b.endTs,
  })
 }

 if (bucketMap.has('archives')) {
  const b = bucketMap.get('archives')
  const archiveYears = Array.from(archiveYearCounts.keys()).sort((a, bYear) => bYear - a)
  const out = {
   key: b.key,
   label: b.label,
   kind: b.kind,
   count: b.count,
   startTs: b.startTs,
   endTs: b.endTs,
  }
  if (archiveYears.length > 1) {
   out.subBuckets = archiveYears.map(yr => {
    const bounds = getZonedYearBounds(yr, tz, intl)
    return {
     key: `archive:${yr}`,
     label: String(yr),
     kind: 'archives',
     year: yr,
     count: archiveYearCounts.get(yr) || 0,
     startTs: bounds.startTs,
     endTs: bounds.endTs,
    }
   })
  }
  buckets.push(out)
 }

 return {
  total: Number.isFinite(Number(rootIdx.total)) ? Number(rootIdx.total) : 0,
  firstTs: rootIdx.firstTs ?? null,
  lastTs: rootIdx.lastTs ?? null,
  buckets,
 }
}
