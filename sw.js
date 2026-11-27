const CACHE_PREFIX = 'civil-command-'
const CACHE_NAME = `${CACHE_PREFIX}v3`

const APP_SHELL = [
 '/',
 '/index.html',
 '/manifest.webmanifest',
 '/favicon.ico',
 '/icons/icon-192.png',
 '/icons/icon-512.png',
 '/icons/icon-maskable-192.png',
 '/icons/icon-maskable-512.png',
 '/icons/apple-touch-icon.png',
 '/icons/icon.svg',
 '/field.mjs',
 '/data.mjs',
 '/kv-config.mjs',
 '/storage.mjs',
 '/story.mjs',
 '/lane-http.mjs',
 '/sandbox.mjs',
 '/source-worker.mjs',
 '/terminal-ui.mjs',
 '/src/main.fs',
 '/src/confirm-modal.fs',
 '/src/lane-config-modal.fs',
 '/src/lane-control.fs',
 '/src/lane-data.fs',
 '/src/lane-dir-modal.fs',
 '/src/lane-export-deploy-modal.fs',
 '/src/lane-export-modal.fs',
 '/src/lane-import-modal.fs',
 '/src/lane-inputs.fs',
 '/src/lane-line-info-modal.fs',
 '/src/lane-modal.fs',
 '/src/lane-notebook.fs',
 '/src/lane-output.fs',
 '/src/lane-package-modal.fs',
 '/src/lane-rails.fs',
 '/src/lane-row-picker-modal.fs',
 '/src/lane-scope.fs',
 '/src/lane-server.fs',
 '/src/lane-servers-modal.fs',
 '/src/lane-session-modal.fs',
 '/src/lane-story.fs',
 '/src/lane-terminal-modal.fs',
]

self.addEventListener('install', event => {
 event.waitUntil(
  caches.open(CACHE_NAME)
   .then(cache => cache.addAll(APP_SHELL))
   .then(() => self.skipWaiting())
 )
})

self.addEventListener('activate', event => {
 event.waitUntil(
  caches.keys()
   .then(keys => Promise.all(
    keys
     .filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
     .map(key => caches.delete(key))
   ))
   .then(() => self.clients.claim())
 )
})

self.addEventListener('fetch', event => {
 const { request } = event
 if (request.method !== 'GET') return

 const url = new URL(request.url)
 if (url.origin !== self.location.origin) return
 if (url.pathname.startsWith('/api/')) return

 if (request.mode === 'navigate') {
  event.respondWith(
   fetch(request)
    .then(response => {
     if (response && response.ok && response.type === 'basic') {
      const copy = response.clone()
      caches.open(CACHE_NAME).then(cache => cache.put('/index.html', copy))
     }
     return response
    })
    .catch(() => caches.match('/index.html').then(cached => cached || caches.match('/')))
  )
  return
 }

 event.respondWith(
  fetch(request)
   .then(response => {
    if (response && response.ok && response.type === 'basic') {
     const copy = response.clone()
     caches.open(CACHE_NAME).then(cache => cache.put(request, copy))
    }
    return response
   })
   .catch(() => caches.match(request))
 )
})
