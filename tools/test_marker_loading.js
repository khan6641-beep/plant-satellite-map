"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
global.window = global;
global.requestAnimationFrame = (callback) => callback();
global.PlantMap = {
  CONFIG: {
    UI_CONFIG: { mapEventDebounceMs: 0 }
  },
  Utils: {
    escapeHtml: (value) => String(value),
    safeText: (value) => String(value ?? ""),
    debounce: (callback) => callback,
    prefersReducedMotion: () => true
  }
};

vm.runInThisContext(fs.readFileSync(path.join(root, "assets/js/map.js"), "utf8"), { filename: "map.js" });

async function main() {
  const total = 855;
  let progressCalls = 0;
  const controller = Object.create(PlantMap.PlantMapController.prototype);
  controller.markers = Array.from({ length: total }, (_, index) => ({ index }));
  controller.scheduleLabelUpdate = () => {};
  controller.callbacks = {
    onLoadProgress(processed, chunkTotal) {
      progressCalls += 1;
      assert.strictEqual(chunkTotal, total);
      assert(processed >= 0 && processed <= total);
    }
  };
  controller.clusterGroup = {
    options: { chunkProgress: null },
    layers: [],
    addLayers(layers) {
      this.layers = layers.slice();
      this.options.chunkProgress?.(400, layers.length);
      this.options.chunkProgress?.(layers.length, layers.length);
    },
    getLayers() {
      return this.layers.slice();
    }
  };

  await controller.addMarkersInChunks();
  assert(progressCalls >= 2, "초기 로딩 진행 콜백이 호출되어야 합니다.");
  assert.strictEqual(controller.clusterGroup.options.chunkProgress, null, "초기 로딩 후 진행 콜백이 해제되어야 합니다.");

  const callsAfterInitialLoad = progressCalls;
  controller.clusterGroup.addLayers(controller.markers);
  assert.strictEqual(progressCalls, callsAfterInitialLoad, "검색 필터링 때 초기 로딩 콜백이 다시 호출되면 안 됩니다.");

  console.log("[통과] 855개 검색 결과 재클러스터링 시 초기 로딩 오버레이 콜백 재실행 방지");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
