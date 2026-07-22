const DEFAULT_PROVIDER = "mock";

function normalizeProviderName(value) {
  return String(value || DEFAULT_PROVIDER).trim().toLowerCase() || DEFAULT_PROVIDER;
}

function parseBoolean(value) {
  return ["1", "true", "yes", "y", "sim"].includes(String(value || "").trim().toLowerCase());
}

function getProviderConfig(env = process.env) {
  return {
    providerName: normalizeProviderName(env.PRICE_PROVIDER),
    fallbackToMock: parseBoolean(env.PRICE_PROVIDER_FALLBACK_MOCK),
  };
}

module.exports = {
  DEFAULT_PROVIDER,
  getProviderConfig,
  normalizeProviderName,
  parseBoolean,
};
