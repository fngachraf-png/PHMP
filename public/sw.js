// Pharmacy Management Platform PHMP - Service Worker
// Strategy: Network-first for HTML, Cache-first for assets
const CACHE_NAME = 'phmp-v6'
const STATIC_CACHE = 'phmp-static-v6'

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/logo.png',
  '/logo-dark.png',
  '/logo-watermark.png',
  '/logo-watermark-dark.png',
  '/favicon-32.png',
  '/favicon-dark-32.png',
  '/favicon-16.png',
  '/favicon.ico',
  '/apple-touch-icon.png',
  '/assistant-logo.png',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
]

// Install: cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  )
})

// Activate: clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME && name !== STATIC_CACHE)
          .map((name) => caches.delete(name))
      )
    }).then(() => self.clients.claim())
  )
})

// Fetch: network-first for HTML (always get latest), cache-first for assets
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Skip non-GET requests
  if (request.method !== 'GET') return

  // Only handle same-origin requests
  if (url.origin !== self.location.origin) return

  // For HTML documents: network-first
  if (request.mode === 'navigate' || url.pathname === '/') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
          return response
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match('/index.html')))
    )
    return
  }

  // For static assets (JS, CSS, images): cache-first
  event.respondWith(
    caches.match(request)
      .then((cached) => cached || fetch(request).then((response) => {
        const clone = response.clone()
        caches.open(STATIC_CACHE).then((cache) => cache.put(request, clone))
        return response
      }))
  )
})
