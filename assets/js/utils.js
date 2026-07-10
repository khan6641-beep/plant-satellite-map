window.PlantMap = window.PlantMap || {};

(function (namespace) {
  "use strict";

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function normalizeText(value) {
    return String(value ?? "")
      .normalize("NFKC")
      .toLocaleLowerCase()
      .replace(/\s+/g, " ")
      .trim();
  }

  function safeText(value, fallback = "정보 없음") {
    const text = String(value ?? "").trim();
    return text || fallback;
  }

  function scientificName(plant) {
    const name = [plant?.genus, plant?.species]
      .map((part) => String(part ?? "").trim())
      .filter(Boolean)
      .join(" ");
    return name || "정보 없음";
  }

  function debounce(callback, delay) {
    let timerId = null;
    const debounced = function (...args) {
      window.clearTimeout(timerId);
      timerId = window.setTimeout(() => callback.apply(this, args), delay);
    };
    debounced.cancel = () => window.clearTimeout(timerId);
    return debounced;
  }

  function nextAnimationFrame() {
    return new Promise((resolve) => window.requestAnimationFrame(resolve));
  }

  function formatNumber(value) {
    return new Intl.NumberFormat("ko-KR").format(Number(value) || 0);
  }

  function prefersReducedMotion() {
    return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
  }

  namespace.Utils = Object.freeze({
    escapeHtml,
    normalizeText,
    safeText,
    scientificName,
    debounce,
    nextAnimationFrame,
    formatNumber,
    prefersReducedMotion
  });
})(window.PlantMap);
