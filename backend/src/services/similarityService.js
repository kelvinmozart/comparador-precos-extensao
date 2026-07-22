const PROBLEMATIC_TERMS = [
  "usado",
  "seminovo",
  "recondicionado",
  "vitrine",
  "open box",
  "peca",
  "capa",
  "pelicula",
  "carregador",
  "compativel",
];

const ACCESSORY_TERMS = new Set(["peca", "capa", "pelicula", "carregador", "compativel"]);

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}\s."]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stripPunctuation(value) {
  return normalizeText(value)
    .replace(/[."]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(value) {
  return stripPunctuation(value)
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length > 1);
}

function unique(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

function clampConfidence(value) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.min(1, Math.round(value * 100) / 100));
}

function getTokenMatchRatio(leftTokens, rightTokens) {
  if (leftTokens.length === 0 || rightTokens.length === 0) {
    return 0;
  }

  const right = new Set(rightTokens);
  const matches = leftTokens.filter((token) => right.has(token)).length;
  return matches / leftTokens.length;
}

function getBrandScore(product, offerText) {
  const brandTokens = tokenize(product?.brand);
  if (brandTokens.length === 0) {
    return 0;
  }

  const offerTokens = new Set(tokenize(offerText));
  const matches = brandTokens.filter((token) => offerTokens.has(token)).length;

  if (matches === brandTokens.length) {
    return 0.12;
  }

  return -0.04;
}

function extractModelTokens(value) {
  return unique(tokenize(value).filter((token) => /\d/.test(token)));
}

function extractSpecTokens(value) {
  const text = normalizeText(value);
  const specs = [];
  const patterns = [
    /\b\d+(?:[.,]\d+)?\s*(?:gb|tb|mb)\b/g,
    /\b\d+(?:[.,]\d+)?\s*(?:kg|g)\b/g,
    /\b\d+(?:[.,]\d+)?\s*(?:"|pol|polegadas|inch|in)\b/g,
  ];

  patterns.forEach((pattern) => {
    for (const match of text.matchAll(pattern)) {
      specs.push(match[0].replace(/\s+/g, "").replace(",", ".").replace(/"$/, "pol"));
    }
  });

  return unique(specs);
}

function getProblematicPenalty(product, offer) {
  const productText = normalizeText([product?.name, product?.brand].filter(Boolean).join(" "));
  const offerText = normalizeText(offer?.title);
  let penalty = 0;

  PROBLEMATIC_TERMS.forEach((term) => {
    if (!hasTerm(offerText, term) || hasTerm(productText, term)) {
      return;
    }

    penalty += ACCESSORY_TERMS.has(term) ? 0.3 : 0.18;
  });

  return Math.min(0.45, penalty);
}

function hasTerm(text, term) {
  return new RegExp(`(^|\\s)${term.replace(/\s+/g, "\\s+")}(\\s|$)`).test(text);
}

function normalizeIdentifier(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

function collectRawIdentifierValues(raw, keys) {
  if (!raw || typeof raw !== "object") {
    return [];
  }

  const values = [];

  keys.forEach((key) => {
    if (raw[key] !== null && raw[key] !== undefined) {
      values.push(raw[key]);
    }
  });

  if (Array.isArray(raw.attributes)) {
    raw.attributes.forEach((attribute) => {
      const id = normalizeIdentifier(attribute?.id || attribute?.name);

      if (keys.some((key) => normalizeIdentifier(key) === id)) {
        values.push(attribute.value_name || attribute.value_id);
      }
    });
  }

  return values.map(normalizeIdentifier).filter(Boolean);
}

function getIdentifierValues(source, keys) {
  const directValues = keys
    .map((key) => source?.[key])
    .map(normalizeIdentifier)
    .filter(Boolean);

  return unique([...directValues, ...collectRawIdentifierValues(source?.raw, keys)]);
}

function getIdentifierAdjustment(product, offer) {
  const productGtins = getIdentifierValues(product, ["gtin", "gtin8", "gtin13", "gtin14"]);
  const offerGtins = getIdentifierValues(offer, ["gtin", "gtin8", "gtin13", "gtin14"]);
  const productSkus = getIdentifierValues(product, ["sku", "mpn"]);
  const offerSkus = getIdentifierValues(offer, ["sku", "mpn", "seller_custom_field"]);

  if (productGtins.length > 0 && offerGtins.length > 0) {
    const hasEqualGtin = productGtins.some((value) => offerGtins.includes(value));
    return hasEqualGtin ? { minimum: 0.96, multiplier: 1 } : { minimum: 0, multiplier: 0.35 };
  }

  if (productSkus.length > 0 && offerSkus.length > 0) {
    const hasEqualSku = productSkus.some((value) => offerSkus.includes(value));
    return hasEqualSku ? { minimum: 0.9, multiplier: 1 } : { minimum: 0, multiplier: 0.85 };
  }

  return { minimum: 0, multiplier: 1 };
}

function calculateSimilarity(product, offer) {
  const productName = product?.name || "";
  const offerTitle = offer?.title || "";
  const productTokens = unique(tokenize(productName));
  const offerTokens = unique(tokenize(offerTitle));

  if (productTokens.length === 0 || offerTokens.length === 0) {
    return 0;
  }

  const tokenScore = getTokenMatchRatio(productTokens, offerTokens) * 0.72;
  const brandScore = getBrandScore(product, offerTitle);
  const modelScore = getTokenMatchRatio(extractModelTokens(productName), extractModelTokens(offerTitle)) * 0.08;
  const specScore = getTokenMatchRatio(extractSpecTokens(productName), extractSpecTokens(offerTitle)) * 0.08;
  const penalty = getProblematicPenalty(product, offer);
  const identifierAdjustment = getIdentifierAdjustment(product, offer);
  const baseScore = Math.max(identifierAdjustment.minimum, tokenScore + brandScore + modelScore + specScore);

  return clampConfidence((baseScore - penalty) * identifierAdjustment.multiplier);
}

function addSimilarityToOffers(product, offers) {
  return offers.map((offer) => ({
    ...offer,
    confidence: calculateSimilarity(product, offer),
  }));
}

module.exports = {
  addSimilarityToOffers,
  calculateSimilarity,
};
