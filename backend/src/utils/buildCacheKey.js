function normalizePart(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeProviderPart(providerNames) {
  const names = Array.isArray(providerNames) ? providerNames : [providerNames];
  const normalizedNames = names
    .map(normalizePart)
    .filter(Boolean);

  return normalizedNames.length > 0 ? normalizedNames.join("+") : "unknown";
}

function buildCacheKey(product, providerNames) {
  const providerPart = normalizeProviderPart(providerNames);
  const gtinPart = normalizePart(product?.gtin);
  const brandPart = normalizePart(product?.brand);
  const namePart = normalizePart(product?.name);
  const shouldUseBrandPart = brandPart && !namePart.split("-").includes(brandPart);
  const productPart = [
    gtinPart,
    shouldUseBrandPart ? brandPart : "",
    namePart,
  ].filter(Boolean).join("-");

  if (!productPart) {
    return null;
  }

  return `compare:${providerPart}:${productPart}`;
}

module.exports = {
  buildCacheKey,
  normalizePart,
  normalizeProviderPart,
};
