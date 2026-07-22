const { getProviderConfig, normalizeProviderName } = require("../config/providerConfig");
const mockPriceProvider = require("./mockPriceProvider");
const mercadoLivrePriceProvider = require("./mercadoLivrePriceProvider");

const PROVIDERS = {
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

function getMockPriceProvider() {
  return mockPriceProvider;
}

module.exports = {
  getMockPriceProvider,
  getPriceProvider,
};
