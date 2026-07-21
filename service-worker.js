"use strict";

const CACHE_NAME = "plant-satellite-map-mapbox-v6-images-20260721";
const CORE_ASSETS = [
  "./",
  "./index.html",
  "./start.html",
  "./manifest.webmanifest",
  "./MAPBOX_TOKEN.js",
  "./assets/css/style.css",
  "./assets/js/config.js",
  "./assets/js/utils.js",
  "./assets/js/search.js",
  "./assets/js/images.js",
  "./assets/js/map.js",
  "./assets/js/app.js",
  "./assets/vendor/leaflet/leaflet.css",
  "./assets/vendor/leaflet/leaflet.js",
  "./assets/vendor/leaflet/images/layers.png",
  "./assets/vendor/leaflet/images/layers-2x.png",
  "./assets/vendor/leaflet/images/marker-icon.png",
  "./assets/vendor/leaflet/images/marker-icon-2x.png",
  "./assets/vendor/leaflet/images/marker-shadow.png",
  "./assets/vendor/markercluster/MarkerCluster.css",
  "./assets/vendor/markercluster/MarkerCluster.Default.css",
  "./assets/vendor/markercluster/leaflet.markercluster.js",
  "./assets/icons/icon.svg",
  "./assets/icons/icon-192.png",
  "./assets/icons/icon-512.png",
  "./assets/images/plant-placeholder.svg",
  "./data/plants-data.js",
  "./data/plant-images.js?v=20260721",
  "./data/plants.json",
  "./data/data-summary.json",
  "./README.txt",
  "./TEST-RESULTS.txt"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(CORE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const requestUrl = new URL(event.request.url);

  // 위성 지도 타일은 공급자 정책을 존중해 서비스 워커에서 사전 캐시하거나 가로채지 않습니다.
  if (requestUrl.origin !== self.location.origin || event.request.method !== "GET") return;

  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put("./index.html", clone));
          return response;
        })
        .catch(() => caches.match("./index.html"))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        if (!response || response.status !== 200 || response.type === "opaque") return response;
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        return response;
      });
    })
  );
});
