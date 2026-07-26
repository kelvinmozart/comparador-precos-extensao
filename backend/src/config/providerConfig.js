const DEFAULT_PROVIDER = "mock";

function normalizeProviderName(value) {
  return String(value || DEFAULT_PROVIDER).trim().toLowerCase() || DEFAULT_PROVIDER;
}

function normalizeProviderNames(value) {
  return String(value || "")
    .split(",")
    .map((providerName) => String(providerName || "").trim().toLowerCase())
    .filter(Boolean);
}

function unique(values) {
  return Array.from(new Set(values));
}

function parseBoolean(value) {
  return ["1", "true", "yes", "y", "sim"].includes(String(value || "").trim().toLowerCase());
}

function getProviderConfig(env = process.env) {
  const providerNames = env.PRICE_PROVIDERS
    ? normalizeProviderNames(env.PRICE_PROVIDERS)
    : [normalizeProviderName(env.PRICE_PROVIDER)];

  return {
    providerName: providerNames[0] || DEFAULT_PROVIDER,
    providerNames: unique(providerNames.length > 0 ? providerNames : [DEFAULT_PROVIDER]),
    fallbackToMock: parseBoolean(env.PRICE_PROVIDER_FALLBACK_MOCK),
  };
}

module.exports = {
  DEFAULT_PROVIDER,
  getProviderConfig,
  normalizeProviderName,
  normalizeProviderNames,
  parseBoolean,
};
