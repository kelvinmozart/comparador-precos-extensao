const { getProviderConfig, normalizeProviderName } = require("../config/providerConfig");
const {
  getEnabledProviders,
  getMockPriceProvider,
} = require("../providers/priceProviderFactory");
const { addSimilarityToOffers } = require("./similarityService");
const { rankOffersWithStats } = require("./offerRankingService");
const cacheService = require("./cacheService");
const { buildCacheKey } = require("../utils/buildCacheKey");
const logger = require("../utils/logger");
const { normalizeProduct } = require("../utils/normalizeProduct");

const MIN_CONFIDENCE = 0.7;
const HIGH_CONFIDENCE = 0.85;
const MAX_RESULTS = 10;
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
    providerResult.providers.some((provider) => provider.status === "error")
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
    rank: offer.rank,
    isBestPrice: offer.isBestPrice,
    priceDifferenceFromCurrent: offer.priceDifferenceFromCurrent,
    priceDifferencePercentFromCurrent: offer.priceDifferencePercentFromCurrent,
  };
}

async function searchOffersWithProvider(provider, product, context = {}) {
  const offers = await provider.searchOffers(product, context);
  return Array.isArray(offers) ? offers : [];
}

async function searchProvider(provider, product, context = {}) {
  try {
    const offers = await searchOffersWithProvider(provider, product, context);

    logger.debug("Provider retornou ofertas.", {
      requestId: context.requestId,
      provider: provider.name,
      count: offers.length,
    });

    return {
      provider,
      offers,
      meta: {
        name: provider.name,
        status: "ok",
        count: offers.length,
      },
    };
  } catch (error) {
    logger.warn("Provider de preco falhou.", {
      requestId: context.requestId,
      provider: provider.name,
      message: error.message,
      statusCode: error.statusCode,
    });

    return {
      provider,
      offers: [],
      meta: {
        name: provider.name,
        status: "error",
        count: 0,
      },
    };
  }
}

function getRequestedProviderNames(config) {
  return Array.isArray(config.providerNames) && config.providerNames.length > 0
    ? config.providerNames
    : [config.providerName];
}

function normalizeServiceProviderConfig(config, overrides) {
  const normalizedConfig = { ...config, ...overrides };

  if (
    overrides &&
    Object.prototype.hasOwnProperty.call(overrides, "providerName") &&
    !Object.prototype.hasOwnProperty.call(overrides, "providerNames")
  ) {
    normalizedConfig.providerNames = [normalizeProviderName(overrides.providerName)];
  }

  normalizedConfig.providerNames = getRequestedProviderNames(normalizedConfig).map(normalizeProviderName);
  normalizedConfig.providerName = normalizedConfig.providerNames[0];
  return normalizedConfig;
}

function resolveEnabledProviders(config, context = {}) {
  try {
    const providers = getEnabledProviders(config);

    logger.debug("Providers habilitados.", {
      requestId: context.requestId,
      providers: providers.map((provider) => provider.name),
    });

    return {
      providers,
      providerErrors: [],
    };
  } catch (error) {
    logger.error("Configuracao de providers falhou.", {
      requestId: context.requestId,
      requestedProviders: getRequestedProviderNames(config),
      message: error.message,
    });

    return {
      providers: [],
      providerErrors: getRequestedProviderNames(config).map((name) => ({
        name,
        status: "error",
        count: 0,
      })),
    };
  }
}

function shouldUseMockFallback(providerResults, enabledProviders, config) {
  if (!config.fallbackToMock) {
    return false;
  }

  if (enabledProviders.some((provider) => provider.name === "mock")) {
    return false;
  }

  const realProviderResults = providerResults.filter((result) => result.provider.name !== "mock");
  return realProviderResults.length > 0 && realProviderResults.every((result) => result.meta.status === "error");
}

async function getOffers(product, config, context = {}) {
  const requestedProviderNames = getRequestedProviderNames(config);
  const { providers: enabledProviders, providerErrors } = resolveEnabledProviders(config, context);
  const providerResults = await Promise.all(
    enabledProviders.map((provider) => searchProvider(provider, product, context))
  );
  let fallbackUsed = false;

  if (shouldUseMockFallback(providerResults, enabledProviders, config)) {
    const mockProvider = getMockPriceProvider();
    const mockResult = await searchProvider(mockProvider, product, context);
    mockResult.meta.fallbackUsed = true;
    providerResults.push(mockResult);
    fallbackUsed = mockResult.meta.status === "ok";

    logger.warn("Fallback mock usado apos falha de providers reais.", {
      requestId: context.requestId,
      requestedProviders: requestedProviderNames,
      fallbackProvider: mockProvider.name,
      fallbackStatus: mockResult.meta.status,
    });
  }

  const providers = [
    ...providerResults.map((result) => result.meta),
    ...providerErrors,
  ];
  const offers = providerResults.flatMap((result) => result.offers);
  const failedProviders = providers
    .filter((provider) => provider.status === "error")
    .map((provider) => provider.name);
  const successfulProviders = providers
    .filter((provider) => provider.status === "ok")
    .map((provider) => provider.name);

  return {
    offers,
    providers,
    providerName: successfulProviders.length > 0
      ? successfulProviders.join(",")
      : requestedProviderNames.join(","),
    requestedProvider: requestedProviderNames.join(","),
    fallbackUsed,
    failedProvider: failedProviders[0] || null,
  };
}

async function compareProductPrices(inputProduct, options = {}) {
  const requestId = options.requestId || logger.createRequestId();
  const product = normalizeProduct(inputProduct);
  const config = normalizeServiceProviderConfig(getProviderConfig(), options.providerConfig);
  const cacheConfig = {
    ...getCacheConfig(),
    ...options.cacheConfig,
  };
  const requestedProviderNames = getRequestedProviderNames(config);
  const cacheKey = buildCacheKey(product, requestedProviderNames);

  logger.debug("Produto normalizado para comparacao.", {
    requestId,
    product,
  });

  if (!product.name || product.name === "Produto sem nome") {
    logger.warn("Produto sem nome recebido pelo compareService.", {
      requestId,
      productUrl: product.url,
    });
  }

  if (!Number.isFinite(product.price)) {
    logger.warn("Produto sem preco recebido pelo compareService.", {
      requestId,
      productName: product.name,
      productUrl: product.url,
    });
  }

  logger.debug("Cache configurado para comparacao.", {
    requestId,
    cacheEnabled: cacheConfig.enabled,
    cacheTtlMs: cacheConfig.ttlMs,
    cacheKey,
    requestedProviders: requestedProviderNames,
  });

  if (cacheConfig.enabled && cacheKey) {
    const cachedResponse = cacheService.get(cacheKey);

    if (cachedResponse) {
      const response = {
        ...cloneResponse(cachedResponse),
        requestId,
        cacheHit: true,
      };

      logger.info("Comparacao respondida pelo cache.", {
        requestId,
        provider: response.provider?.name,
        cacheHit: true,
        finalResults: Array.isArray(response.results) ? response.results.length : 0,
      });

      return {
        ...response,
      };
    }
  }

  logger.debug("Cache miss para comparacao.", {
    requestId,
    cacheKey,
  });

  const providerResult = await getOffers(product, config, { requestId });
  const normalizedOffers = providerResult.offers.map(normalizeOffer);
  const offersWithSimilarity = addSimilarityToOffers(product, normalizedOffers);
  const rankedResult = rankOffersWithStats(product, offersWithSimilarity, {
    maxResults: MAX_RESULTS,
    minConfidence: MIN_CONFIDENCE,
  });
  const rankedOffers = rankedResult.results;
  const results = rankedOffers
    .map(toPublicOffer);

  logger.debug("Diagnostico de filtros e ranking.", {
    requestId,
    providerCounts: providerResult.providers,
    totalProviderOffers: providerResult.offers.length,
    normalizedOffers: normalizedOffers.length,
    ranking: rankedResult.stats,
  });

  const response = {
    requestId,
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
    providers: providerResult.providers,
    cacheHit: false,
    generatedAt: new Date().toISOString(),
  };

  logger.info("Comparacao gerada.", {
    requestId,
    provider: response.provider.name,
    cacheHit: false,
    finalResults: results.length,
  });

  if (cacheConfig.enabled && cacheKey) {
    const ttlMs = shouldUseShortCacheTtl(providerResult, results)
      ? EMPTY_RESULTS_CACHE_TTL_MS
      : cacheConfig.ttlMs;

    logger.debug("Resposta salva no cache.", {
      requestId,
      cacheKey,
      ttlMs,
      finalResults: results.length,
    });

    cacheService.set(cacheKey, cloneResponse(response), ttlMs);
  }

  return response;
}

module.exports = {
  compareProductPrices,
  getCacheConfig,
  shouldUseShortCacheTtl,
};
