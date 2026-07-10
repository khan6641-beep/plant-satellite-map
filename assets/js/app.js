window.PlantMap = window.PlantMap || {};

(function (namespace) {
  "use strict";

  const { formatNumber, safeText, scientificName, debounce } = namespace.Utils;
  const config = namespace.CONFIG;

  const state = {
    plants: [],
    meta: {},
    mapController: null,
    searchIndex: null,
    elements: {},
    toastTimer: null
  };

  function byId(id) {
    return document.getElementById(id);
  }

  function cacheElements() {
    state.elements = {
      loading: byId("loading-overlay"),
      loadingText: byId("loading-text"),
      loadingProgress: byId("loading-progress"),
      statusCount: byId("status-count"),
      statusData: byId("status-data"),
      searchToggle: byId("search-toggle"),
      searchPanel: byId("search-panel"),
      searchClose: byId("search-close"),
      searchInput: byId("search-input"),
      searchClear: byId("search-clear"),
      searchSummary: byId("search-summary"),
      searchResults: byId("search-results"),
      locateButton: byId("locate-button"),
      fitButton: byId("fit-button"),
      card: byId("plant-card-panel"),
      cardClose: byId("plant-card-close"),
      cardCommon: byId("card-common-name"),
      cardScientific: byId("card-scientific-name"),
      cardOrigin: byId("card-origin"),
      toast: byId("toast"),
      tileNotice: byId("tile-notice"),
      tileNoticeClose: byId("tile-notice-close")
    };
  }

  function showLoading(message, processed = 0, total = 0) {
    state.elements.loading.hidden = false;
    state.elements.loadingText.textContent = message;
    if (total > 0) {
      state.elements.loadingProgress.hidden = false;
      state.elements.loadingProgress.max = total;
      state.elements.loadingProgress.value = processed;
    } else {
      state.elements.loadingProgress.hidden = true;
    }
  }

  function hideLoading() {
    state.elements.loading.hidden = true;
  }

  function showToast(message, kind = "info", duration = config.UI_CONFIG.toastDurationMs) {
    const toast = state.elements.toast;
    window.clearTimeout(state.toastTimer);
    toast.textContent = message;
    toast.dataset.kind = kind;
    toast.hidden = false;
    state.toastTimer = window.setTimeout(() => {
      toast.hidden = true;
    }, duration);
  }

  function showTileNotice() {
    state.elements.tileNotice.hidden = false;
  }

  function hideTileNotice() {
    state.elements.tileNotice.hidden = true;
  }

  function openSearch() {
    state.elements.searchPanel.hidden = false;
    state.elements.searchToggle.setAttribute("aria-expanded", "true");
    window.requestAnimationFrame(() => state.elements.searchInput.focus());
  }

  function closeSearch() {
    state.elements.searchPanel.hidden = true;
    state.elements.searchToggle.setAttribute("aria-expanded", "false");
    state.elements.searchToggle.focus();
  }

  function clearSearch() {
    state.elements.searchInput.value = "";
    state.elements.searchResults.replaceChildren();
    state.elements.searchSummary.textContent = "국명, 학명 또는 표찰번호를 입력하세요.";
    state.elements.searchClear.hidden = true;
    state.mapController?.setSearchIndex(null);
    state.elements.searchInput.focus();
  }

  function createResultItem(plant, index) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "search-result";
    button.setAttribute("role", "option");
    button.dataset.index = String(index);
    button.setAttribute("aria-label", `${safeText(plant.commonName)}, ${scientificName(plant)}, 표찰번호 ${safeText(plant.origin)}`);

    const common = document.createElement("strong");
    common.className = "search-result__common";
    common.textContent = safeText(plant.commonName);

    const scientific = document.createElement("em");
    scientific.className = "search-result__scientific";
    scientific.textContent = scientificName(plant);

    const origin = document.createElement("span");
    origin.className = "search-result__origin";
    origin.textContent = safeText(plant.origin);

    button.append(common, scientific, origin);
    button.addEventListener("click", () => {
      state.mapController.focusPlant(index);
      closeSearch();
    });
    return button;
  }

  function renderSearchResults(query) {
    const trimmed = query.trim();
    state.elements.searchClear.hidden = !trimmed;
    state.elements.searchResults.replaceChildren();

    if (!trimmed) {
      state.elements.searchSummary.textContent = "국명, 학명 또는 표찰번호를 입력하세요.";
      state.mapController?.setSearchIndex(null);
      return;
    }

    const indexes = state.searchIndex.search(trimmed, config.SEARCH_CONFIG.resultLimit);
    if (!indexes.length) {
      state.elements.searchSummary.textContent = "검색 결과가 없습니다.";
      return;
    }

    state.elements.searchSummary.textContent = indexes.length >= config.SEARCH_CONFIG.resultLimit
      ? `상위 ${formatNumber(indexes.length)}개 결과를 표시합니다.`
      : `${formatNumber(indexes.length)}개 결과`;

    const fragment = document.createDocumentFragment();
    for (const index of indexes) fragment.append(createResultItem(state.plants[index], index));
    state.elements.searchResults.append(fragment);
  }

  function showPlantCard(index) {
    const plant = state.plants[index];
    if (!plant) return;
    state.elements.cardCommon.textContent = safeText(plant.commonName);
    state.elements.cardScientific.textContent = scientificName(plant);
    state.elements.cardOrigin.textContent = safeText(plant.origin);
    state.elements.card.hidden = false;
    state.elements.card.setAttribute("aria-hidden", "false");
    document.querySelector(".app-shell")?.classList.add("card-open");
  }

  function hidePlantCard() {
    state.elements.card.hidden = true;
    state.elements.card.setAttribute("aria-hidden", "true");
    document.querySelector(".app-shell")?.classList.remove("card-open");
  }

  function updateStatus(visible, total) {
    state.elements.statusCount.textContent = `화면 ${formatNumber(visible)} / 전체 ${formatNumber(total)}`;
  }

  function validateData() {
    if (!Array.isArray(window.PLANT_DATA)) {
      throw new Error("식물 데이터 파일(data/plants-data.js)을 찾을 수 없거나 읽을 수 없습니다.");
    }
    if (!window.PLANT_DATA.length) {
      throw new Error("식물 데이터가 비어 있습니다.");
    }

    const valid = window.PLANT_DATA.filter((plant) =>
      Number.isFinite(plant.latitude) && Number.isFinite(plant.longitude) &&
      plant.latitude >= -90 && plant.latitude <= 90 &&
      plant.longitude >= -180 && plant.longitude <= 180
    );
    if (!valid.length) throw new Error("유효한 좌표가 없습니다.");
    return valid;
  }

  function setDataSummary() {
    const meta = state.meta;
    const total = meta.totalRows ?? state.plants.length;
    const valid = meta.validRows ?? state.plants.length;
    const invalid = meta.invalidRows ?? Math.max(0, total - valid);
    state.elements.statusData.textContent = `정상 좌표 ${formatNumber(valid)}개 · 제외 ${formatNumber(invalid)}개`;
    state.elements.statusData.title = `전체 데이터 ${formatNumber(total)}개, 정상 좌표 ${formatNumber(valid)}개, 제외된 좌표 ${formatNumber(invalid)}개`;
  }

  function registerUiEvents() {
    state.elements.searchToggle.addEventListener("click", () => {
      if (state.elements.searchPanel.hidden) openSearch();
      else closeSearch();
    });
    state.elements.searchClose.addEventListener("click", closeSearch);
    state.elements.searchClear.addEventListener("click", clearSearch);
    state.elements.searchInput.addEventListener("input", debounce(
      (event) => renderSearchResults(event.target.value),
      config.SEARCH_CONFIG.debounceMs
    ));
    state.elements.searchInput.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeSearch();
      if (event.key === "ArrowDown") {
        const firstResult = state.elements.searchResults.querySelector("button");
        if (firstResult) {
          event.preventDefault();
          firstResult.focus();
        }
      }
    });
    state.elements.searchResults.addEventListener("keydown", (event) => {
      const current = event.target.closest("button");
      if (!current) return;
      if (event.key === "ArrowDown") {
        event.preventDefault();
        (current.nextElementSibling || state.elements.searchResults.firstElementChild)?.focus();
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        (current.previousElementSibling || state.elements.searchInput)?.focus();
      } else if (event.key === "Escape") closeSearch();
    });
    state.elements.locateButton.addEventListener("click", () => state.mapController.locateUser());
    state.elements.fitButton.addEventListener("click", () => state.mapController.showAll());
    state.elements.cardClose.addEventListener("click", () => state.mapController.clearSelection());
    state.elements.tileNoticeClose.addEventListener("click", hideTileNotice);
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !state.elements.card.hidden) state.mapController.clearSelection();
    });
    window.addEventListener("offline", showTileNotice);
    window.addEventListener("online", () => {
      hideTileNotice();
      showToast("인터넷 연결이 복구되었습니다.", "success");
    });
  }

  function registerServiceWorker() {
    if (!("serviceWorker" in navigator) || !/^https?:$/.test(location.protocol)) return;
    navigator.serviceWorker.register("./service-worker.js").catch((error) => {
      console.warn("서비스 워커 등록 실패:", error);
    });
  }

  async function start() {
    cacheElements();
    registerUiEvents();
    showLoading("식물 데이터를 확인하는 중입니다.");

    try {
      state.plants = validateData();
      state.meta = window.PLANT_DATA_META || {};
      setDataSummary();
      showLoading("검색 색인을 만드는 중입니다.");
      state.searchIndex = new namespace.PlantSearchIndex(state.plants);

      showLoading("지도 마커를 준비하는 중입니다.", 0, state.plants.length);
      state.mapController = new namespace.PlantMapController("map", state.plants, {
        onLoadProgress: (processed, total) => {
          showLoading(`지도 마커를 불러오는 중입니다. ${formatNumber(processed)} / ${formatNumber(total)}`, processed, total);
        },
        onVisibleCount: updateStatus,
        onSelectPlant: showPlantCard,
        onClearSelection: hidePlantCard,
        onTileError: showTileNotice,
        onTileRecovered: hideTileNotice,
        onError: (message) => showToast(message, "error", 8000),
        onLocationPending: () => showToast("현재 위치를 확인하는 중입니다.", "info"),
        onLocationSuccess: (accuracy) => showToast(`현재 위치를 표시했습니다. 정확도 약 ${Math.round(accuracy)}m`, "success"),
        onLocationError: (message) => showToast(message, "error", 7000)
      });
      await state.mapController.init();
      hideLoading();
      registerServiceWorker();

      if (location.protocol === "file:") {
        showToast("로컬 파일 실행 모드입니다. 지도 타일·현재 위치·PWA 기능은 브라우저 정책에 따라 제한될 수 있습니다.", "info", 8000);
      }
      if (!navigator.onLine) showTileNotice();
    } catch (error) {
      console.error(error);
      showLoading(`실행 오류: ${error.message || error}`);
      state.elements.loadingProgress.hidden = true;
      state.elements.loading.classList.add("loading-overlay--error");
    }
  }

  window.addEventListener("error", (event) => {
    if (!state.elements.toast) return;
    showToast(`오류가 발생했습니다: ${event.message}`, "error", 8000);
  });

  document.addEventListener("DOMContentLoaded", start, { once: true });
})(window.PlantMap);
