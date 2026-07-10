/* 사용자가 자주 바꾸는 설정을 한곳에 모았습니다. */
window.PlantMap = window.PlantMap || {};
window.PlantMap.CONFIG = Object.freeze({
  MAP_CONFIG: Object.freeze({
    // 기본값은 API 키 없이 접근 가능한 Esri World Imagery 타일입니다.
    // 공급자 정책이나 기관 계약에 맞춰 URL과 저작권 문구를 함께 변경하세요.
    tileUrl: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: "Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community",
    apiKey: "",
    minZoom: 3,
    maxZoom: 22,
    maxNativeZoom: 19,
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
    moveZoom: 20,
    debounceMs: 120
  }),

  CLUSTER_CONFIG: Object.freeze({
    maxClusterRadius: 55,
    disableClusteringAtZoom: 20,
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
