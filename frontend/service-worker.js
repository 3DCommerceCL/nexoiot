'use strict';
// service-worker.js — PWA mínima del panel: instalable, network-first con fallback a
// caché solo cuando no hay conexión. Nunca cachea /api/ — los datos siempre deben ser frescos.

const CACHE_NAME = 'nexosuite-v1';
const APP_SHELL = ['/dashboard.html', '/dashboard.js'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET' || request.url.includes('/api/')) return;

  event.respondWith(
    fetch(request)
      .then(res => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
        return res;
      })
      .catch(() => caches.match(request))
  );
});
