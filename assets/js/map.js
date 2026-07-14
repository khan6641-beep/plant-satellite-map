window.PlantMap = window.PlantMap || {};

(function (namespace) {
  "use strict";

  const CONFIG = namespace.CONFIG;
  const {
    escapeHtml,
    safeText,
    debounce,
    prefersReducedMotion
  } = namespace.Utils;

  class PlantMapController {
    constructor(elementId, plants, callbacks = {}) {
      this.elementId = elementId;
      this.plants = plants;
      this.callbacks = callbacks;
      this.map = null;
      this.tileLayer = null;
      this.clusterGroup = null;
      this.labelLayer = null;
      this.markers = [];
      this.bounds = null;
      this.selectedIndex = null;
      this.searchIndex = null;
      this.filteredIndexes = null;
      this.allIndexes = plants.map((_, index) => index);
      this.locationMarker = null;
      this.locationAccuracy = null;
      this.tileErrorCount = 0;
      this.tileErrorNotified = false;
      this.reducedMotion = prefersReducedMotion();
      this.scheduleLabelUpdate = debounce(
        () => window.requestAnimationFrame(() => this.updateLabels()),
        CONFIG.UI_CONFIG.mapEventDebounceMs
      );
      this.scheduleVisibleCount = debounce(
        () => window.requestAnimationFrame(() => this.updateVisibleCount()),
        CONFIG.UI_CONFIG.mapEventDebounceMs
      );
    }

    init() {
      if (!window.L || !L.markerClusterGroup) {
        throw new Error("Leaflet 또는 마커 클러스터 라이브러리를 불러오지 못했습니다.");
      }

      const mapConfig = CONFIG.MAP_CONFIG;
      this.map = L.map(this.elementId, {
        preferCanvas: true,
        zoomControl: false,
        minZoom: mapConfig.minZoom,
        maxZoom: mapConfig.maxZoom,
        zoomSnap: 1,
        wheelPxPerZoomLevel: 100
      });

      L.control.zoom({ position: "bottomright", zoomInTitle: "확대", zoomOutTitle: "축소" }).addTo(this.map);
      this.labelLayer = L.layerGroup([], { pane: "tooltipPane" }).addTo(this.map);
      this.addTileLayer();

      this.clusterGroup = L.markerClusterGroup({
        maxClusterRadius: CONFIG.CLUSTER_CONFIG.maxClusterRadius,
        disableClusteringAtZoom: CONFIG.CLUSTER_CONFIG.disableClusteringAtZoom,
        chunkedLoading: true,
        chunkInterval: CONFIG.CLUSTER_CONFIG.chunkInterval,
        chunkDelay: CONFIG.CLUSTER_CONFIG.chunkDelay,
        removeOutsideVisibleBounds: true,
        showCoverageOnHover: false,
        spiderfyOnMaxZoom: true,
        spiderfyDistanceMultiplier: 2,
        animate: !this.reducedMotion,
        animateAddingMarkers: false,
        iconCreateFunction: (cluster) => this.createClusterIcon(cluster)
      }).addTo(this.map);

      this.createMarkers();
      this.registerEvents();

      if (!this.bounds?.isValid()) {
        throw new Error("유효한 식물 좌표가 없습니다.");
      }

      this.map.fitBounds(this.bounds, { padding: [30, 30], animate: false });
      this.updateVisibleCount();
      return this.addMarkersInChunks();
    }

    addTileLayer() {
      const config = CONFIG.MAP_CONFIG;
      let tileUrl = String(config.tileUrl || "").trim();

      if (tileUrl.includes("{MAPBOX_TOKEN}")) {
        const token = String(window.MAPBOX_ACCESS_TOKEN || "").trim();
        const placeholderToken = token.includes("여기에_") || token.includes("Mapbox_공개_토큰");

        if (!token || placeholderToken || !token.startsWith("pk.")) {
          this.callbacks.onError?.(
            "Mapbox 공개 토큰이 설정되지 않았습니다. 프로젝트 최상단의 MAPBOX_TOKEN.js 파일에 pk.로 시작하는 토큰을 입력하세요."
          );
          return;
        }

        tileUrl = tileUrl.replaceAll("{MAPBOX_TOKEN}", encodeURIComponent(token));
      }

      if (!tileUrl) {
        this.callbacks.onError?.("Mapbox 위성 지도 주소를 불러오지 못했습니다.");
        return;
      }

      this.tileLayer = L.tileLayer(tileUrl, {
        attribution: config.attribution,
        minZoom: config.minZoom,
        maxZoom: config.maxZoom,
        maxNativeZoom: config.maxNativeZoom,
        updateWhenIdle: true,
        updateWhenZooming: false,
        keepBuffer: 3
      });

      this.tileLayer.on("tileerror", () => {
        this.tileErrorCount += 1;
        if (!this.tileErrorNotified && this.tileErrorCount >= config.tileErrorThreshold) {
          this.tileErrorNotified = true;
          this.callbacks.onTileError?.();
        }
      });
      this.tileLayer.on("tileload", () => {
        if (this.tileErrorNotified && navigator.onLine) {
          this.callbacks.onTileRecovered?.();
          this.tileErrorNotified = false;
          this.tileErrorCount = 0;
        }
      });
      this.tileLayer.addTo(this.map);
    }

    createClusterIcon(cluster) {
      const count = cluster.getChildCount();
      const sizeClass = count < 10 ? "small" : count < 100 ? "medium" : "large";
      const size = sizeClass === "small" ? 38 : sizeClass === "medium" ? 46 : 54;
      return L.divIcon({
        html: `<span class="plant-cluster__count">${count.toLocaleString("ko-KR")}</span>`,
        className: `plant-cluster plant-cluster--${sizeClass}`,
        iconSize: L.point(size, size)
      });
    }

    createMarkerIcon(selected = false) {
      return L.divIcon({
        className: `plant-marker${selected ? " plant-marker--selected" : ""}`,
        html: '<span class="plant-marker__dot" aria-hidden="true"></span>',
        iconSize: [22, 22],
        iconAnchor: [11, 11]
      });
    }

    createMarkers() {
      this.defaultMarkerIcon = this.createMarkerIcon(false);
      this.selectedMarkerIcon = this.createMarkerIcon(true);
      this.bounds = L.latLngBounds();

      this.markers = this.plants.map((plant, index) => {
        const latLng = L.latLng(plant.latitude, plant.longitude);
        this.bounds.extend(latLng);
        const commonName = safeText(plant.commonName);
        const marker = L.marker(latLng, {
          icon: this.defaultMarkerIcon,
          keyboard: true,
          title: commonName,
          alt: `${commonName} 식물 위치`,
          riseOnHover: true,
          riseOffset: 500
        });
        marker.plantIndex = index;
        marker.on("click", (event) => {
          if (event.originalEvent) L.DomEvent.stopPropagation(event.originalEvent);
          if (this.selectedIndex === index) {
            this.clearSelection();
            return;
          }
          this.selectPlant(index, { openCard: true, panIntoView: true });
        });
        return marker;
      });
    }

    addMarkersInChunks() {
      return new Promise((resolve) => {
        const total = this.markers.length;
        const previousChunkProgress = this.clusterGroup.options.chunkProgress;
        let resolved = false;
        let initialLoadProgress = null;

        const finish = () => {
          if (resolved) return;
          resolved = true;
          if (this.clusterGroup.options.chunkProgress === initialLoadProgress) {
            this.clusterGroup.options.chunkProgress = previousChunkProgress || null;
          }
          this.scheduleLabelUpdate();
          this.callbacks.onLoadProgress?.(total, total);
          resolve();
        };

        initialLoadProgress = (processed, chunkTotal) => {
          if (resolved) return;
          this.callbacks.onLoadProgress?.(processed, chunkTotal);
          if (processed >= chunkTotal) finish();
        };
        this.clusterGroup.options.chunkProgress = initialLoadProgress;
        this.clusterGroup.addLayers(this.markers);
        if (!total) finish();
        window.setTimeout(() => {
          if (this.clusterGroup.getLayers().length === total) finish();
        }, 0);
      });
    }

    registerEvents() {
      this.map.on("click", () => this.clearSelection());
      this.map.on("moveend zoomend", () => {
        this.scheduleLabelUpdate();
        this.scheduleVisibleCount();
      });
      this.clusterGroup.on("animationend spiderfied unspiderfied", () => this.scheduleLabelUpdate());
      window.addEventListener("resize", () => {
        this.map.invalidateSize({ debounceMoveend: true });
        this.scheduleLabelUpdate();
      }, { passive: true });
    }

    showAll() {
      const activeIndexes = this.getActiveIndexes();
      const targetBounds = this.filteredIndexes === null
        ? this.bounds
        : L.latLngBounds(activeIndexes.map((index) => this.markers[index].getLatLng()));
      if (targetBounds?.isValid()) {
        this.map.fitBounds(targetBounds, { padding: [30, 30], maxZoom: 20, animate: !this.reducedMotion });
      }
    }

    getActiveIndexes() {
      return this.filteredIndexes ?? this.allIndexes;
    }

    setSearchIndex(index) {
      this.searchIndex = Number.isInteger(index) ? index : null;
      this.scheduleLabelUpdate();
    }

    setSearchResults(indexes) {
      if (!this.clusterGroup || !this.map) return;
      const uniqueIndexes = Array.from(new Set(indexes))
        .filter((index) => Number.isInteger(index) && index >= 0 && index < this.markers.length);
      const activeSet = new Set(uniqueIndexes);

      if (this.selectedIndex !== null && !activeSet.has(this.selectedIndex)) this.clearSelection();
      this.filteredIndexes = uniqueIndexes;
      this.searchIndex = uniqueIndexes.length === 1 ? uniqueIndexes[0] : null;
      this.clusterGroup.clearLayers();
      if (uniqueIndexes.length) this.clusterGroup.addLayers(uniqueIndexes.map((index) => this.markers[index]));

      this.labelLayer?.clearLayers();
      this.scheduleLabelUpdate();
      this.updateVisibleCount();

      if (!uniqueIndexes.length) return;
      const resultBounds = L.latLngBounds(uniqueIndexes.map((index) => this.markers[index].getLatLng()));
      if (uniqueIndexes.length === 1) {
        this.map.setView(resultBounds.getCenter(), Math.min(20, this.map.getMaxZoom()), { animate: !this.reducedMotion });
      } else {
        this.map.fitBounds(resultBounds, { padding: [34, 34], maxZoom: 20, animate: !this.reducedMotion });
      }
    }

    resetSearchResults() {
      if (!this.clusterGroup || !this.map || this.filteredIndexes === null) {
        this.setSearchIndex(null);
        return;
      }
      this.filteredIndexes = null;
      this.searchIndex = null;
      this.clusterGroup.clearLayers();
      this.clusterGroup.addLayers(this.markers);
      this.labelLayer?.clearLayers();
      this.showAll();
      this.scheduleLabelUpdate();
      this.updateVisibleCount();
    }

    focusPlant(index) {
      const marker = this.markers[index];
      if (!marker) return;
      this.setSearchIndex(index);
      const targetZoom = Math.min(CONFIG.SEARCH_CONFIG.moveZoom, this.map.getMaxZoom());
      const latLng = marker.getLatLng();
      this.map.setView(latLng, targetZoom, { animate: !this.reducedMotion });

      let revealed = false;
      const reveal = () => {
        if (revealed) return;
        revealed = true;
        this.clusterGroup.zoomToShowLayer(marker, () => {
          this.selectPlant(index, { openCard: true, panIntoView: true });
        });
      };
      this.map.once("moveend", reveal);
      window.setTimeout(reveal, this.reducedMotion ? 0 : 450);
    }

    selectPlant(index, options = {}) {
      const marker = this.markers[index];
      if (!marker) return;

      if (this.selectedIndex !== null && this.markers[this.selectedIndex]) {
        this.markers[this.selectedIndex].setIcon(this.defaultMarkerIcon);
        this.markers[this.selectedIndex].setZIndexOffset(0);
      }

      this.selectedIndex = index;
      marker.setIcon(this.selectedMarkerIcon);
      marker.setZIndexOffset(1000);
      this.scheduleLabelUpdate();

      if (options.panIntoView) {
        this.map.panInside(marker.getLatLng(), {
          paddingTopLeft: [20, CONFIG.CARD_CONFIG.panPaddingTop],
          paddingBottomRight: [20, CONFIG.CARD_CONFIG.panPaddingBottom],
          animate: !this.reducedMotion
        });
      }
      if (options.openCard) this.callbacks.onSelectPlant?.(index);
    }

    clearSelection() {
      if (this.selectedIndex !== null && this.markers[this.selectedIndex]) {
        this.markers[this.selectedIndex].setIcon(this.defaultMarkerIcon);
        this.markers[this.selectedIndex].setZIndexOffset(0);
      }
      this.selectedIndex = null;
      this.searchIndex = null;
      this.labelLayer?.clearLayers();
      this.scheduleLabelUpdate();
      this.callbacks.onClearSelection?.();
    }

    updateVisibleCount() {
      if (!this.map) return;
      const bounds = this.map.getBounds();
      const activeIndexes = this.getActiveIndexes();
      let visible = 0;
      for (const index of activeIndexes) {
        const plant = this.plants[index];
        if (bounds.contains([plant.latitude, plant.longitude])) visible += 1;
      }
      this.callbacks.onVisibleCount?.(visible, activeIndexes.length, this.filteredIndexes !== null);
    }

    updateLabels() {
      if (!this.map || !this.clusterGroup || !this.labelLayer) return;
      this.labelLayer.clearLayers();

      const zoom = this.map.getZoom();
      const levels = CONFIG.LABEL_ZOOM_LEVELS;
      const mapBounds = this.map.getBounds().pad(0.03);
      const centerPoint = this.map.latLngToContainerPoint(this.map.getCenter());
      const candidates = [];

      for (const index of this.getActiveIndexes()) {
        const plant = this.plants[index];
        if (!mapBounds.contains([plant.latitude, plant.longitude])) continue;
        const marker = this.markers[index];
        const forced = index === this.selectedIndex || index === this.searchIndex;
        const visibleParent = this.clusterGroup.getVisibleParent(marker);
        if (!forced && visibleParent !== marker) continue;
        if (zoom < levels.hiddenBelow && !forced) continue;

        const point = this.map.latLngToContainerPoint(marker.getLatLng());
        const distance = point.distanceTo(centerPoint);
        const priority = index === this.selectedIndex ? 0 : index === this.searchIndex ? 1 : 2;
        candidates.push({ index, plant, marker, point, distance, priority, forced });
      }

      candidates.sort((a, b) => a.priority - b.priority || a.distance - b.distance || a.index - b.index);

      const showAll = zoom >= levels.showAllFrom;
      const maxLabels = showAll
        ? Number.POSITIVE_INFINITY
        : zoom >= levels.showMoreFrom
          ? CONFIG.LABEL_LIMITS.showMore
          : CONFIG.LABEL_LIMITS.partial;

      const occupiedCells = new Set();
      let shown = 0;
      for (const candidate of candidates) {
        if (!candidate.forced && shown >= maxLabels) break;
        const label = safeText(candidate.plant.commonName);
        const width = Math.min(230, Math.max(54, 20 + Array.from(label).length * 14));
        const rect = {
          left: candidate.point.x - width / 2,
          right: candidate.point.x + width / 2,
          top: candidate.point.y - 48,
          bottom: candidate.point.y - 18
        };

        if (!showAll && !candidate.forced && this.collides(rect, occupiedCells)) continue;
        this.markCollision(rect, occupiedCells);
        this.addLabel(candidate.index, candidate.marker.getLatLng(), label, candidate.forced);
        shown += 1;
      }
    }

    collides(rect, occupiedCells) {
      const cellSize = 42;
      const x1 = Math.floor(rect.left / cellSize);
      const x2 = Math.floor(rect.right / cellSize);
      const y1 = Math.floor(rect.top / cellSize);
      const y2 = Math.floor(rect.bottom / cellSize);
      for (let x = x1; x <= x2; x += 1) {
        for (let y = y1; y <= y2; y += 1) {
          if (occupiedCells.has(`${x}:${y}`)) return true;
        }
      }
      return false;
    }

    markCollision(rect, occupiedCells) {
      const cellSize = 42;
      const x1 = Math.floor(rect.left / cellSize);
      const x2 = Math.floor(rect.right / cellSize);
      const y1 = Math.floor(rect.top / cellSize);
      const y2 = Math.floor(rect.bottom / cellSize);
      for (let x = x1; x <= x2; x += 1) {
        for (let y = y1; y <= y2; y += 1) occupiedCells.add(`${x}:${y}`);
      }
    }

    addLabel(index, latLng, label, forced) {
      const icon = L.divIcon({
        className: "plant-label-anchor",
        html: `<span class="plant-name-label${forced ? " plant-name-label--forced" : ""}">${escapeHtml(label)}</span>`,
        iconSize: [1, 1],
        iconAnchor: [0, 14]
      });
      L.marker(latLng, { icon, pane: "tooltipPane", interactive: false, keyboard: false, zIndexOffset: forced ? 2000 : 600 })
        .addTo(this.labelLayer)
        .plantIndex = index;
    }

    locateUser() {
      if (!navigator.geolocation) {
        this.callbacks.onLocationError?.("이 브라우저는 현재 위치 기능을 지원하지 않습니다.");
        return;
      }

      this.callbacks.onLocationPending?.();
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const latLng = L.latLng(position.coords.latitude, position.coords.longitude);
          const accuracy = Math.max(1, position.coords.accuracy || 0);

          if (this.locationMarker) this.locationMarker.remove();
          if (this.locationAccuracy) this.locationAccuracy.remove();

          this.locationAccuracy = L.circle(latLng, {
            radius: accuracy,
            color: "#1478c8",
            weight: 1,
            fillColor: "#4ba3e3",
            fillOpacity: 0.18,
            interactive: false
          }).addTo(this.map);

          this.locationMarker = L.circleMarker(latLng, {
            radius: 8,
            color: "#ffffff",
            weight: 3,
            fillColor: "#1478c8",
            fillOpacity: 1
          }).addTo(this.map).bindTooltip("현재 위치", { direction: "top", permanent: false });

          this.map.setView(latLng, Math.max(this.map.getZoom(), 18), { animate: !this.reducedMotion });
          this.callbacks.onLocationSuccess?.(accuracy);
        },
        (error) => {
          const messages = {
            1: "위치 권한이 거부되었습니다. 브라우저 설정에서 위치 권한을 허용해 주세요.",
            2: "현재 위치를 확인할 수 없습니다. GPS 또는 네트워크 상태를 확인해 주세요.",
            3: "현재 위치 확인 시간이 초과되었습니다. 잠시 후 다시 시도해 주세요."
          };
          this.callbacks.onLocationError?.(messages[error.code] || "현재 위치를 가져오는 중 오류가 발생했습니다.");
        },
        { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 }
      );
    }
  }

  namespace.PlantMapController = PlantMapController;
})(window.PlantMap);
