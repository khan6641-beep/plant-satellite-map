window.PlantMap = window.PlantMap || {};

(function (namespace) {
  "use strict";

  const { normalizeText, scientificName } = namespace.Utils;

  class PlantSearchIndex {
    constructor(plants) {
      // 검색 시 매번 문자열을 조합하지 않도록 최초 한 번만 정규화합니다.
      this.entries = plants.map((plant, index) => {
        const commonName = normalizeText(plant.commonName);
        const genus = normalizeText(plant.genus);
        const species = normalizeText(plant.species);
        const scientific = normalizeText(scientificName(plant));
        const origin = normalizeText(plant.origin);
        return {
          index,
          commonName,
          genus,
          species,
          scientific,
          origin,
          searchable: `${commonName}\u0000${genus}\u0000${species}\u0000${scientific}\u0000${origin}`
        };
      });
    }

    search(rawQuery, limit = 100) {
      const query = normalizeText(rawQuery);
      if (!query) return [];

      const tokens = query.split(" ").filter(Boolean);
      const matches = [];

      for (const entry of this.entries) {
        if (!tokens.every((token) => entry.searchable.includes(token))) continue;

        let score = 100;
        if (entry.commonName === query || entry.origin === query) score = 0;
        else if (entry.scientific === query) score = 4;
        else if (entry.commonName.startsWith(query)) score = 8;
        else if (entry.scientific.startsWith(query)) score = 12;
        else if (entry.origin.startsWith(query)) score = 16;
        else if (entry.genus === query || entry.species === query) score = 20;
        else if (entry.commonName.includes(query)) score = 24;
        else if (entry.scientific.includes(query)) score = 28;
        else if (entry.origin.includes(query)) score = 32;

        matches.push({ index: entry.index, score });
      }

      matches.sort((a, b) => a.score - b.score || a.index - b.index);
      return matches.slice(0, limit).map((match) => match.index);
    }
  }

  namespace.PlantSearchIndex = PlantSearchIndex;
})(window.PlantMap);
