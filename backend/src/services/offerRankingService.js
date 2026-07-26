const DEFAULT_MIN_CONFIDENCE = 0.7;
const DEFAULT_MAX_RESULTS = 10;
const SIMILAR_TITLE_THRESHOLD = 0.86;
const CLOSE_PRICE_PERCENT = 0.02;

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(value) {
  return normalizeText(value)
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length > 1);
}

function normalizeUrl(value) {
  const rawUrl = String(value || "").trim();

  if (!rawUrl) {
    return "";
  }

  try {
    const url = new URL(rawUrl);
    url.hash = "";
    return url.href.replace(/\/$/, "").toLowerCase();
  } catch (error) {
    return "";
  }
}

function hasValidUrl(offer) {
  const normalizedUrl = normalizeUrl(offer?.url);
  return normalizedUrl.startsWith("http://") || normalizedUrl.startsWith("https://");
}

function hasValidPrice(offer) {
  return Number.isFinite(offer?.price);
}

function getCurrentPrice(product) {
  return Number.isFinite(product?.price) && product.price > 0 ? product.price : null;
}

function isCheaperThanCurrentPrice(currentPrice) {
  return (offer) => currentPrice === null || offer.price < currentPrice;
}

function hasTitle(offer) {
  return normalizeText(offer?.title).length > 0;
}

function getPriceKey(offer) {
  return Number.isFinite(offer?.price) ? String(Math.round(offer.price * 100) / 100) : "";
}

function getExternalId(offer) {
  const raw = offer?.raw && typeof offer.raw === "object" ? offer.raw : {};
  const value = raw.id || raw.itemId || raw.item_id || raw.productId || raw.product_id || raw.sku;
  return String(value || "").trim().toLowerCase();
}

function getTitleSimilarity(leftTitle, rightTitle) {
  const leftTokens = new Set(tokenize(leftTitle));
  const rightTokens = new Set(tokenize(rightTitle));

  if (leftTokens.size === 0 || rightTokens.size === 0) {
    return 0;
  }

  let intersection = 0;
  leftTokens.forEach((token) => {
    if (rightTokens.has(token)) {
      intersection += 1;
    }
  });

  return (2 * intersection) / (leftTokens.size + rightTokens.size);
}

function arePricesEqual(left, right) {
  return hasValidPrice(left) && hasValidPrice(right) && getPriceKey(left) === getPriceKey(right);
}

function arePricesClose(left, right) {
  if (!hasValidPrice(left) || !hasValidPrice(right)) {
    return false;
  }

  const reference = Math.min(Math.abs(left.price), Math.abs(right.price));
  const tolerance = Math.max(1, reference * CLOSE_PRICE_PERCENT);
  return Math.abs(left.price - right.price) <= tolerance;
}

function isMockOffer(offer) {
  return String(offer?.source || "").trim().toLowerCase() === "mock";
}

function compareByQuality(left, right) {
  const confidenceDiff = (right.confidence || 0) - (left.confidence || 0);
  if (confidenceDiff !== 0) {
    return confidenceDiff;
  }

  if (hasValidPrice(left) && hasValidPrice(right) && left.price !== right.price) {
    return left.price - right.price;
  }

  if (isMockOffer(left) !== isMockOffer(right)) {
    return isMockOffer(left) ? 1 : -1;
  }

  if (Boolean(left.url) !== Boolean(right.url)) {
    return left.url ? -1 : 1;
  }

  if (Boolean(left.image) !== Boolean(right.image)) {
    return left.image ? -1 : 1;
  }

  return 0;
}

function shouldReplaceOffer(existingOffer, candidateOffer) {
  return compareByQuality(candidateOffer, existingOffer) < 0;
}

function areDuplicateOffers(left, right) {
  const leftUrl = normalizeUrl(left?.url);
  const rightUrl = normalizeUrl(right?.url);

  if (leftUrl && rightUrl && leftUrl === rightUrl) {
    return true;
  }

  const leftExternalId = getExternalId(left);
  const rightExternalId = getExternalId(right);
  const leftSource = normalizeText(left?.source);
  const rightSource = normalizeText(right?.source);

  if (leftSource && leftSource === rightSource && leftExternalId && leftExternalId === rightExternalId) {
    return true;
  }

  const leftTitle = normalizeText(left?.title);
  const rightTitle = normalizeText(right?.title);

  if (leftTitle && leftTitle === rightTitle && arePricesEqual(left, right)) {
    return true;
  }

  const titleSimilarity = getTitleSimilarity(left?.title, right?.title);
  const sameStore = normalizeText(left?.store) === normalizeText(right?.store);

  return titleSimilarity >= SIMILAR_TITLE_THRESHOLD && (arePricesClose(left, right) || sameStore);
}

function deduplicateOffers(offers) {
  const deduplicated = [];

  offers.forEach((offer) => {
    const duplicateIndex = deduplicated.findIndex((existingOffer) => areDuplicateOffers(existingOffer, offer));

    if (duplicateIndex === -1) {
      deduplicated.push(offer);
      return;
    }

    if (shouldReplaceOffer(deduplicated[duplicateIndex], offer)) {
      deduplicated[duplicateIndex] = offer;
    }
  });

  return deduplicated;
}

function compareRank(left, right) {
  if (arePricesClose(left, right) && isMockOffer(left) !== isMockOffer(right)) {
    return isMockOffer(left) ? 1 : -1;
  }

  if (hasValidPrice(left) && hasValidPrice(right) && left.price !== right.price) {
    return left.price - right.price;
  }

  const confidenceDiff = (right.confidence || 0) - (left.confidence || 0);
  if (confidenceDiff !== 0) {
    return confidenceDiff;
  }

  if (Boolean(left.url) !== Boolean(right.url)) {
    return left.url ? -1 : 1;
  }

  if (Boolean(left.image) !== Boolean(right.image)) {
    return left.image ? -1 : 1;
  }

  if (isMockOffer(left) !== isMockOffer(right)) {
    return isMockOffer(left) ? 1 : -1;
  }

  return 0;
}

function roundMoney(value) {
  return Math.round(value * 100) / 100;
}

function roundPercent(value) {
  return Math.round(value * 10) / 10;
}

function withRankingFields(product, offers) {
  const currentPrice = getCurrentPrice(product);

  return offers.map((offer, index) => {
    const priceDifference = currentPrice !== null && hasValidPrice(offer)
      ? roundMoney(offer.price - currentPrice)
      : null;
    const priceDifferencePercent = currentPrice !== null && currentPrice > 0 && priceDifference !== null
      ? roundPercent((priceDifference / currentPrice) * 100)
      : null;

    return {
      ...offer,
      rank: index + 1,
      isBestPrice: index === 0,
      priceDifferenceFromCurrent: priceDifference,
      priceDifferencePercentFromCurrent: priceDifferencePercent,
    };
  });
}

function rankOffersWithStats(product, offers, options = {}) {
  const minConfidence = Number.isFinite(options.minConfidence)
    ? options.minConfidence
    : DEFAULT_MIN_CONFIDENCE;
  const maxResults = Number.isFinite(options.maxResults) && options.maxResults > 0
    ? options.maxResults
    : DEFAULT_MAX_RESULTS;
  const currentPrice = getCurrentPrice(product);
  const withTitle = offers.filter(hasTitle);
  const withValidPrice = withTitle.filter(hasValidPrice);
  const cheaperThanCurrentPrice = withValidPrice.filter(isCheaperThanCurrentPrice(currentPrice));
  const withValidUrl = cheaperThanCurrentPrice.filter(hasValidUrl);
  const eligibleOffers = withValidUrl
    .filter((offer) => Number.isFinite(offer.confidence) && offer.confidence >= minConfidence);
  const deduplicatedOffers = deduplicateOffers(eligibleOffers);
  const rankedOffers = withRankingFields(
    product,
    deduplicatedOffers.sort(compareRank).slice(0, maxResults)
  );

  return {
    results: rankedOffers,
    stats: {
      input: offers.length,
      removedMissingTitle: offers.length - withTitle.length,
      removedInvalidPrice: withTitle.length - withValidPrice.length,
      removedNotCheaper: withValidPrice.length - cheaperThanCurrentPrice.length,
      removedInvalidUrl: cheaperThanCurrentPrice.length - withValidUrl.length,
      removedBySimilarity: withValidUrl.length - eligibleOffers.length,
      beforeDeduplication: eligibleOffers.length,
      removedByDeduplication: eligibleOffers.length - deduplicatedOffers.length,
      afterDeduplication: deduplicatedOffers.length,
      final: rankedOffers.length,
      minConfidence,
      maxResults,
      hasCurrentPrice: currentPrice !== null,
    },
  };
}

function rankOffers(product, offers, options = {}) {
  return rankOffersWithStats(product, offers, options).results;
}

module.exports = {
  deduplicateOffers,
  rankOffers,
  rankOffersWithStats,
};
