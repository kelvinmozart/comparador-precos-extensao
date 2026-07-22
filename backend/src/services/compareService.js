const { getProviderConfig } = require("../config/providerConfig");
const { getMockPriceProvider, getPriceProvider } = require("../providers/priceProviderFactory");
const { addSimilarityToOffers } = require("./similarityService");
const cacheService = require("./cacheService");
const { buildCacheKey } = require("../utils/buildCacheKey");
const { normalizeProduct } = require("../utils/normalizeProduct");

const MIN_CONFIDENCE = 0.7;
const HIGH_CONFIDENCE = 0.85;
const DEFAULT_CACHE_TTL_MS = 60 * 60 * 1000;
const EMPTY_RESULTS_CACHE_TTL_MS = 5 * 60 * 1000;

function parseBooleanWithDefault(value, defaultValue) {
  if (value === undefined || value === null || String(value).trim() === "") {
    return defaultValue;
  }

  return ["1", "true", "yes", "y", "sim"].includes(String(value).trim().toLowerCase());
}

function parsePositiveInteger(value, defaultValue) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : defaultValue;
}

function getCacheConfig(env = process.env) {
  return {
    enabled: parseBooleanWithDefault(env.COMPARE_CACHE_ENABLED, true),
    ttlMs: parsePositiveInteger(env.COMPARE_CACHE_TTL_MS, DEFAULT_CACHE_TTL_MS),
  };
}

function cloneResponse(response) {
  return JSON.parse(JSON.stringify(response));
}

function shouldUseShortCacheTtl(providerResult, results) {
  return (
    results.length === 0 ||
    providerResult.fallbackUsed === true ||
    Boolean(providerResult.failedProvider)
  );
}

function normalizeOffer(offer) {
  const source = offer && typeof offer === "object" ? offer : {};

  return {
    store: source.store || "Loja desconhecida",
    title: source.title || "Oferta encontrada",
    price: Number.isFinite(source.price) ? source.price : null,
    currency: source.currency || "BRL",
    url: source.url || null,
    image: source.image || null,
    source: source.source || "unknown",
    raw: source.raw,
    confidence: Number.isFinite(source.confidence) ? source.confidence : null,
  };
}

function getMatchLabel(confidence) {
  return confidence >= HIGH_CONFIDENCE ? "Alta similaridade" : "Oferta parecida";
}

function toPublicOffer(offer) {
  return {
    store: offer.store,
    title: offer.title,
    price: offer.price,
    currency: offer.currency,
    url: offer.url,
    image: offer.image,
    source: offer.source,
    confidence: offer.confidence,
    matchLabel: getMatchLabel(offer.confidence),
  };
}

function sortOffersByPrice(offers) {
  return offers.slice().sort((left, right) => {
    const leftPrice = Number.isFinite(left.price) ? left.price : Number.POSITIVE_INFINITY;
    const rightPrice = Number.isFinite(right.price) ? right.price : Number.POSITIVE_INFINITY;
    const priceDiff = leftPrice - rightPrice;

    if (priceDiff !== 0) {
      return priceDiff;
    }

    return right.confidence - left.confidence;
  });
}

async function searchOffersWithProvider(provider, product) {
  const offers = await provider.searchOffers(product);
  return Array.isArray(offers) ? offers : [];
}

async function getOffers(product, config) {
  let provider;

  try {
    provider = getPriceProvider(config);
    return {
      offers: await searchOffersWithProvider(provider, product),
      providerName: provider.name,
      requestedProvider: config.providerName,
      fallbackUsed: false,
      failedProvider: null,
    };
  } catch (error) {
    const providerName = provider?.name || config.providerName;
    console.error(`[compareService] Price provider "${providerName}" failed: ${error.message}`);

    if (!config.fallbackToMock) {
      return {
        offers: [],
        providerName,
        requestedProvider: config.providerName,
        fallbackUsed: false,
        failedProvider: providerName,
      };
    }

    try {
      const mockProvider = getMockPriceProvider();

      return {
        offers: await searchOffersWithProvider(mockProvider, product),
        providerName: mockProvider.name,
        requestedProvider: config.providerName,
        fallbackUsed: true,
        failedProvider: providerName,
      };
    } catch (fallbackError) {
      console.error(`[compareService] Mock fallback failed: ${fallbackError.message}`);
      return {
        offers: [],
        providerName: "mock",
        requestedProvider: config.providerName,
        fallbackUsed: true,
        failedProvider: providerName,
      };
    }
  }
}

async function compareProductPrices(inputProduct, options = {}) {
  const product = normalizeProduct(inputProduct);
  const config = {
    ...getProviderConfig(),
    ...options.providerConfig,
  };
  const cacheConfig = {
    ...getCacheConfig(),
    ...options.cacheConfig,
  };
  const cacheKey = buildCacheKey(product, config.providerName);

  if (cacheConfig.enabled && cacheKey) {
    const cachedResponse = cacheService.get(cacheKey);

    if (cachedResponse) {
      return {
        ...cloneResponse(cachedResponse),
        cacheHit: true,
      };
    }
  }

  const providerResult = await getOffers(product, config);
  const normalizedOffers = providerResult.offers.map(normalizeOffer);
  const results = sortOffersByPrice(addSimilarityToOffers(product, normalizedOffers))
    .filter((offer) => offer.confidence >= MIN_CONFIDENCE)
    .map(toPublicOffer);

  const response = {
    currentProduct: {
      name: product.name,
      price: product.price,
      currency: product.currency,
      url: product.url,
    },
    results,
    provider: {
      name: providerResult.providerName,
      requestedProvider: providerResult.requestedProvider,
      fallbackUsed: providerResult.fallbackUsed,
      failedProvider: providerResult.failedProvider,
    },
    cacheHit: false,
    generatedAt: new Date().toISOString(),
  };

  if (cacheConfig.enabled && cacheKey) {
    const ttlMs = shouldUseShortCacheTtl(providerResult, results)
      ? EMPTY_RESULTS_CACHE_TTL_MS
      : cacheConfig.ttlMs;
    cacheService.set(cacheKey, cloneResponse(response), ttlMs);
  }

  return response;
}

module.exports = {
  compareProductPrices,
  getCacheConfig,
  shouldUseShortCacheTtl,
};
