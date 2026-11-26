// Maximum bytes written to a single physical KV value (key). Logical values
// larger than this are transparently split into `<key>.chunks/<n>` keys by
// storage.mjs. This is a writer-side convention, not a Civil Memory limit.
//
// Resolution order (first valid wins):
//   1. globalThis.CC_KV_CHUNK_BYTES  (browser startup option / Node override)
//   2. process.env.CC_KV_CHUNK_BYTES (env var / start --kv-chunk-bytes=<n>)
//   3. DEFAULT_KV_CHUNK_BYTES (16 KiB)
export const DEFAULT_KV_CHUNK_BYTES = 16384
export const KV_CHUNK_BYTES_ENV_VAR = 'CC_KV_CHUNK_BYTES'
export const KV_CHUNK_BYTES_GLOBAL = 'CC_KV_CHUNK_BYTES'
export const MIN_KV_CHUNK_BYTES = 4
export const MAX_KV_CHUNK_BYTES = 8 * 1024 * 1024

export function normalizeKvChunkBytes(value) {
 if (value === undefined || value === null) return null
 if (typeof value === 'string') {
  const trimmed = value.trim()
  if (!trimmed) return null
  value = Number(trimmed)
 }
 if (typeof value !== 'number' || !Number.isInteger(value)) return null
 if (value < MIN_KV_CHUNK_BYTES || value > MAX_KV_CHUNK_BYTES) return null
 return value
}

export function resolveKvChunkBytes(options = {}) {
 const envValue = Object.hasOwn(options, 'envValue')
  ? options.envValue
  : (typeof process !== 'undefined' && process.env ? process.env[KV_CHUNK_BYTES_ENV_VAR] : undefined)
 const globalValue = Object.hasOwn(options, 'globalValue')
  ? options.globalValue
  : (typeof globalThis !== 'undefined' ? globalThis[KV_CHUNK_BYTES_GLOBAL] : undefined)
 return normalizeKvChunkBytes(globalValue) ?? normalizeKvChunkBytes(envValue) ?? DEFAULT_KV_CHUNK_BYTES
}

export let MAX_KV_VALUE_BYTES = resolveKvChunkBytes()

export function getKvChunkBytes() {
 return MAX_KV_VALUE_BYTES
}

// Startup-only setter; changing it after writes have begun mixes chunk sizes,
// which still reads correctly but changes how subsequent values are split.
export function setKvChunkBytes(value) {
 const normalized = normalizeKvChunkBytes(value)
 if (normalized === null) {
  throw new RangeError(`Invalid KV chunk size: ${String(value)}; expected an integer between ${MIN_KV_CHUNK_BYTES} and ${MAX_KV_CHUNK_BYTES} bytes`)
 }
 MAX_KV_VALUE_BYTES = normalized
 return normalized
}
