/*
 * 애플리케이션 내부 설정입니다.
 * 일반 사용자는 이 파일을 수정하지 마세요.
 * Mapbox 토큰은 프로젝트 최상단의 MAPBOX_TOKEN.js에만 입력합니다.
 */
window.PlantMap = window.PlantMap || {};

window.PlantMap.CONFIG = Object.freeze({
  MAP_CONFIG: Object.freeze({
    provider: "Mapbox Satellite",

    // Mapbox가 Leaflet용으로 공식 안내하는 위성영상 Raster Tiles 주소입니다.
    tileUrl: "https://api.mapbox.com/v4/mapbox.satellite/{z}/{x}/{y}@2x.jpg90?access_token={MAPBOX_TOKEN}",
    attribution:
      '© <a href="https://www.mapbox.com/about/maps/" target="_blank" rel="noopener">Mapbox</a> ' +
      '© <a href="https://www.maxar.com/" target="_blank" rel="noopener">Maxar</a>',

    minZoom: 3,
    maxZoom: 22,
    maxNativeZoom: 22,
    initialCenter: [36.0349, 126.7219],
    initialZoom: 15,
    tileErrorThreshold: 3
  }),

  LABEL_ZOOM_LEVELS: Object.freeze({
    hiddenBelow: 15,
    partialFrom: 15,
    showMoreFrom: 18,
    showAllFrom: 20
  }),

  LABEL_LIMITS: Object.freeze({
    partial: 60,
    showMore: 260
  }),

  SEARCH_CONFIG: Object.freeze({
    resultLimit: 100,
    moveZoom: 22,
    debounceMs: 120
  }),

  CLUSTER_CONFIG: Object.freeze({
    // 확대할수록 클러스터 반경을 줄여 서로 다른 좌표를 최대한 분리합니다.
    // 줌 22에서도 완전히 같거나 매우 가까운 좌표만 클러스터로 남아 클릭 시 펼쳐집니다.
    maxClusterRadius(zoom) {
      if (zoom >= 22) return 10;
      if (zoom >= 20) return 18;
      if (zoom >= 18) return 32;
      return 55;
    },
    disableClusteringAtZoom: null,
    chunkInterval: 140,
    chunkDelay: 24
  }),

  CARD_CONFIG: Object.freeze({
    panPaddingTop: 84,
    panPaddingBottom: 270
  }),

  UI_CONFIG: Object.freeze({
    mapEventDebounceMs: 110,
    toastDurationMs: 4200
  })
});
