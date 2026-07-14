"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
global.window = global;
global.PlantMap = {};
vm.runInThisContext(fs.readFileSync(path.join(root, "assets/js/utils.js"), "utf8"), { filename: "utils.js" });
vm.runInThisContext(fs.readFileSync(path.join(root, "assets/js/search.js"), "utf8"), { filename: "search.js" });
vm.runInThisContext(fs.readFileSync(path.join(root, "assets/js/images.js"), "utf8"), { filename: "images.js" });

const plants = JSON.parse(fs.readFileSync(path.join(root, "data/plants.json"), "utf8"));
const search = new PlantMap.PlantSearchIndex(plants);

function firstPlant(query) {
  const result = search.searchDetailed(query, 20);
  assert(result.indexes.length > 0, `${query}: 검색 결과 없음`);
  return { result, plant: plants[result.indexes[0]] };
}

assert.strictEqual(firstPlant("참느릅나무").plant.commonName, "참느릅나무");
assert.strictEqual(firstPlant("참느릅나무 어디 있어?").plant.commonName, "참느릅나무");
assert.strictEqual(firstPlant("무궁화를 찾아줘").plant.commonName, "무궁화");
assert.strictEqual(firstPlant("표찰번호 12-L-00001 찾아줘").plant.origin, "12-L-00001");
assert.strictEqual(firstPlant("왕벗나무").plant.commonName, "왕벚나무");
assert.strictEqual(firstPlant("Quercuus 위치 보여줘").plant.genus, "Quercus");
assert.strictEqual(firstPlant("Ulmus parvifolia").plant.commonName, "참느릅나무");

const exactParticleEnding = plants.find((plant) => String(plant.commonName).endsWith("이"));
if (exactParticleEnding) {
  assert.strictEqual(firstPlant(exactParticleEnding.commonName).plant.commonName, exactParticleEnding.commonName);
}

global.PLANT_IMAGE_MAP = {
  byOrigin: {},
  byCommonName: {
    "왕벚나무": { src: "./assets/images/plants/왕벚나무.jpg", credit: "테스트 촬영자", license: "테스트" }
  },
  byScientificName: {}
};
const mappedImage = PlantMap.PlantImages.resolve({ commonName: "왕벚나무", genus: "Prunus", species: "yedoensis", origin: "X" });
assert.strictEqual(mappedImage.src, "./assets/images/plants/왕벚나무.jpg");
assert.strictEqual(mappedImage.credit, "테스트 촬영자");
assert.strictEqual(PlantMap.PlantImages.resolve({ commonName: "미등록", genus: "", species: "", origin: "" }).isFallback, true);

const fuzzy = search.searchDetailed("왕벗나무", 20);
assert.strictEqual(fuzzy.mode, "fuzzy");
assert(fuzzy.corrections.some((item) => item.to === "왕벚나무"));

console.log("[통과] 정확 검색, 자연어 검색, 조사 제거, 표찰번호, 한글·영문 오탈자 보정, 대표 이미지 매핑");
