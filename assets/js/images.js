window.PlantMap = window.PlantMap || {};

(function (namespace) {
  "use strict";

  const DEFAULT_RECORD = Object.freeze({
    src: "./assets/images/plant-placeholder.svg",
    alt: "대표 이미지 준비 중",
    credit: "대표 이미지 미등록",
    license: ""
  });

  function safeImageUrl(value) {
    const url = String(value || "").trim();
    if (!url) return "";
    if (/^(?:javascript|vbscript):/i.test(url)) return "";
    if (/^data:/i.test(url) && !/^data:image\//i.test(url)) return "";
    return url;
  }

  function normalizeRecord(value, plant) {
    if (!value) return null;
    const raw = typeof value === "string" ? { src: value } : value;
    const src = safeImageUrl(raw.src || raw.url || raw.imageUrl);
    if (!src) return null;
    const commonName = String(plant?.commonName || "식물").trim() || "식물";
    return {
      src,
      alt: String(raw.alt || `${commonName} 대표 이미지`).trim(),
      credit: String(raw.credit || raw.source || "").trim(),
      license: String(raw.license || "").trim()
    };
  }

  function resolve(plant) {
    const map = window.PLANT_IMAGE_MAP || {};
    const scientific = namespace.Utils.scientificName(plant);
    const candidates = [
      plant?.image,
      plant?.imageUrl,
      map.byOrigin?.[plant?.origin],
      map.byCommonName?.[plant?.commonName],
      map.byScientificName?.[scientific]
    ];
    for (const candidate of candidates) {
      const record = normalizeRecord(candidate, plant);
      if (record) return { ...record, isFallback: false };
    }
    return { ...DEFAULT_RECORD, isFallback: true };
  }

  function fallback() {
    return { ...DEFAULT_RECORD, isFallback: true };
  }

  namespace.PlantImages = Object.freeze({ resolve, fallback });
})(window.PlantMap);
