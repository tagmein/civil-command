function encodeSegment(segment) {
 return encodeURIComponent(String(segment)).replace(/\./g, '%2E')
}

export function httpKV({ baseUrl, namespace = '', root = null }) {
 const isHash = namespace.includes('#')
 const qualify = key => {
  if (isHash) {
   return namespace.endsWith('#') ? `${namespace}${key}` : `${namespace}/${key}`
  }
  return namespace ? `${namespace}.${key}` : key
 }
 const client = {
  prefix: namespace,
  root: root || null,

  namespace(name) {
   const nextNamespace = isHash ? qualify(encodeSegment(name)) : qualify(name)
   return httpKV({ baseUrl, namespace: nextNamespace, root: client.root })
  },

  hashNamespace(name) {
   return httpKV({
    baseUrl,
    namespace: `${encodeSegment(name)}#`,
    root: client.root,
   })
  },

  async get(key) {
   const url = new URL(baseUrl)
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
   const url = new URL(baseUrl)
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
   const url = new URL(baseUrl)
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
 return client
}

const origin = typeof location !== 'undefined' && location && location.origin
 ? location.origin
 : 'http://localhost:8080'
const baseUrl = `${origin}/api/data?mode=disk`

export const data = httpKV({ baseUrl })
