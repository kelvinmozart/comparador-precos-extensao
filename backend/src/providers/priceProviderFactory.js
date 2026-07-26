const { getProviderConfig, normalizeProviderName } = require("../config/providerConfig");
const genericSearchPriceProvider = require("./genericSearchPriceProvider");
const mockPriceProvider = require("./mockPriceProvider");
const mercadoLivrePriceProvider = require("./mercadoLivrePriceProvider");

const PROVIDERS = {
  generic: genericSearchPriceProvider,
  mock: mockPriceProvider,
  mercadolivre: mercadoLivrePriceProvider,
};

function getPriceProvider(config = getProviderConfig()) {
  const providerName = normalizeProviderName(config.providerName);
  const provider = PROVIDERS[providerName];

  if (!provider) {
    throw new Error(`Unknown price provider: ${providerName}`);
  }

  return provider;
}

function getProviderByName(providerName) {
  const normalizedProviderName = normalizeProviderName(providerName);
  const provider = PROVIDERS[normalizedProviderName];

  if (!provider) {
    throw new Error(`Unknown price provider: ${normalizedProviderName}`);
  }

  return provider;
}

function getEnabledProviders(config = getProviderConfig()) {
  const providerNames = Array.isArray(config.providerNames) && config.providerNames.length > 0
    ? config.providerNames
    : [config.providerName];

  return providerNames.map(getProviderByName);
}

function getMockPriceProvider() {
  return mockPriceProvider;
}

module.exports = {
  getEnabledProviders,
  getMockPriceProvider,
  getProviderByName,
  getPriceProvider,
};
