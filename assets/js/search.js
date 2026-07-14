window.PlantMap = window.PlantMap || {};

(function (namespace) {
  "use strict";

  const { normalizeText, scientificName } = namespace.Utils;

  const STOP_WORDS = new Set([
    "식물", "나무", "지도", "위성지도", "검색", "검색해줘", "검색해주세요",
    "찾아줘", "찾아주세요", "찾아주십시오", "보여줘", "보여주세요", "표시해줘", "표시해주세요",
    "알려줘", "알려주세요", "어디", "어디에", "어디서", "어디있어", "어디있나요", "어디있습니까",
    "위치", "장소", "정보", "학명", "국명", "표찰", "표찰번호", "번호", "좀", "제발", "부탁해"
  ]);

  const PARTICLES = [
    "으로부터", "에게서는", "에서는", "으로는", "에게서", "한테서", "까지는", "부터는",
    "이라도", "라도", "으로", "에서", "에게", "한테", "께서", "까지", "부터", "처럼",
    "보다", "만은", "만을", "하고", "이며", "이랑", "랑", "과", "와", "은", "는", "이", "가", "을", "를", "의", "에", "로", "도", "만"
  ];

  function cleanupNaturalLanguage(rawQuery) {
    const normalized = normalizeText(rawQuery)
      .replace(/[?!.,~"'“”‘’()[\]{}<>]/g, " ")
      .replace(/(?:어디\s*(?:에|서)?\s*(?:있어|있나요|있습니까|있는지)?)/g, " ")
      .replace(/(?:위치\s*(?:를|가|는)?\s*(?:알려줘|알려주세요|보여줘|보여주세요|표시해줘|표시해주세요)?)/g, " ")
      .replace(/(?:찾아줘|찾아주세요|찾아주십시오|검색해줘|검색해주세요|보여줘|보여주세요|표시해줘|표시해주세요|알려줘|알려주세요)/g, " ")
      .replace(/(?:지도에서|지도에|위성지도에서|위성지도에)/g, " ")
      .replace(/(?:표찰\s*번호|표찰번호)/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    if (!normalized) return "";

    const tokens = normalized.split(" ").map((token) => {
      if (!token || STOP_WORDS.has(token)) return "";
      for (const particle of PARTICLES) {
        if (token.length > particle.length + 1 && token.endsWith(particle)) {
          const stripped = token.slice(0, -particle.length);
          if (stripped && !STOP_WORDS.has(stripped)) return stripped;
        }
      }
      return token;
    }).filter((token) => token && !STOP_WORDS.has(token));

    return tokens.join(" ").trim();
  }

  function damerauLevenshtein(left, right, maxDistance = Number.POSITIVE_INFINITY) {
    const a = Array.from(left);
    const b = Array.from(right);
    if (Math.abs(a.length - b.length) > maxDistance) return maxDistance + 1;
    if (!a.length) return b.length;
    if (!b.length) return a.length;

    let previousPrevious = null;
    let previous = Array.from({ length: b.length + 1 }, (_, index) => index);

    for (let i = 1; i <= a.length; i += 1) {
      const current = [i];
      let rowMinimum = current[0];
      for (let j = 1; j <= b.length; j += 1) {
        const substitutionCost = a[i - 1] === b[j - 1] ? 0 : 1;
        let value = Math.min(
          current[j - 1] + 1,
          previous[j] + 1,
          previous[j - 1] + substitutionCost
        );
        if (
          previousPrevious && i > 1 && j > 1 &&
          a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]
        ) {
          value = Math.min(value, previousPrevious[j - 2] + 1);
        }
        current[j] = value;
        rowMinimum = Math.min(rowMinimum, value);
      }
      if (rowMinimum > maxDistance) return maxDistance + 1;
      previousPrevious = previous;
      previous = current;
    }
    return previous[b.length];
  }

  function allowedDistance(length) {
    if (length <= 2) return 0;
    if (length <= 4) return 1;
    if (length <= 7) return 2;
    if (length <= 12) return 3;
    return 4;
  }

  class PlantSearchIndex {
    constructor(plants) {
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

      const nameTerms = new Map();
      const originTerms = new Map();
      const addTerm = (map, normalized, display, typePriority) => {
        if (!normalized) return;
        const existing = map.get(normalized);
        if (!existing || typePriority < existing.typePriority) {
          map.set(normalized, { normalized, display: String(display || normalized).trim(), typePriority });
        }
      };

      for (const plant of plants) {
        addTerm(nameTerms, normalizeText(plant.commonName), plant.commonName, 0);
        addTerm(nameTerms, normalizeText(scientificName(plant)), scientificName(plant), 1);
        addTerm(nameTerms, normalizeText(plant.genus), plant.genus, 2);
        addTerm(nameTerms, normalizeText(plant.species), plant.species, 3);
        addTerm(originTerms, normalizeText(plant.origin), plant.origin, 0);
      }
      this.nameTerms = Array.from(nameTerms.values());
      this.originTerms = Array.from(originTerms.values());
    }

    directSearch(query, limit) {
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

    findBestCorrection(token) {
      if (!token || token.length <= 2) return null;
      const looksLikeOrigin = /[0-9-]/.test(token);
      const candidates = looksLikeOrigin ? this.originTerms : this.nameTerms;
      const maxDistance = allowedDistance(Array.from(token).length);
      let best = null;

      for (const candidate of candidates) {
        const candidateLength = Array.from(candidate.normalized).length;
        const tokenLength = Array.from(token).length;
        if (Math.abs(candidateLength - tokenLength) > maxDistance) continue;
        if (looksLikeOrigin && token[0] !== candidate.normalized[0]) continue;

        const distance = damerauLevenshtein(token, candidate.normalized, maxDistance);
        if (distance === 0 || distance > maxDistance) continue;
        const ratio = distance / Math.max(tokenLength, candidateLength, 1);
        if (ratio > 0.34) continue;

        const score = distance * 100 + ratio * 20 + candidate.typePriority;
        if (!best || score < best.score || (score === best.score && candidate.normalized < best.normalized)) {
          best = { ...candidate, distance, score };
        }
      }
      return best;
    }

    searchDetailed(rawQuery, limit = 100) {
      const originalQuery = normalizeText(rawQuery);
      if (!originalQuery) {
        return { indexes: [], originalQuery: "", interpretedQuery: "", correctedQuery: "", mode: "empty", corrections: [] };
      }

      let indexes = this.directSearch(originalQuery, limit);
      if (indexes.length) {
        return {
          indexes,
          originalQuery,
          interpretedQuery: originalQuery,
          correctedQuery: originalQuery,
          mode: "direct",
          corrections: []
        };
      }

      const interpretedQuery = cleanupNaturalLanguage(rawQuery) || originalQuery;
      if (interpretedQuery !== originalQuery) indexes = this.directSearch(interpretedQuery, limit);
      if (indexes.length) {
        return {
          indexes,
          originalQuery,
          interpretedQuery,
          correctedQuery: interpretedQuery,
          mode: "natural",
          corrections: []
        };
      }

      const tokens = interpretedQuery.split(" ").filter(Boolean);
      const corrections = [];
      const correctedTokens = tokens.map((token) => {
        const correction = this.findBestCorrection(token);
        if (!correction) return token;
        corrections.push({ from: token, to: correction.display, normalizedTo: correction.normalized });
        return correction.normalized;
      });
      const correctedQuery = correctedTokens.join(" ");
      if (corrections.length) indexes = this.directSearch(correctedQuery, limit);

      return {
        indexes,
        originalQuery,
        interpretedQuery,
        correctedQuery,
        mode: indexes.length && corrections.length ? "fuzzy" : "none",
        corrections
      };
    }

    search(rawQuery, limit = 100) {
      return this.searchDetailed(rawQuery, limit).indexes;
    }
  }

  namespace.PlantSearchIndex = PlantSearchIndex;
})(window.PlantMap);
