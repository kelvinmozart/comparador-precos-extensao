function normalizePart(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function buildCacheKey(product, providerName) {
  const providerPart = normalizePart(providerName) || "unknown";
  const gtinPart = normalizePart(product?.gtin);
  const brandPart = normalizePart(product?.brand);
  const namePart = normalizePart(product?.name);
  const productPart = [gtinPart, brandPart, namePart].filter(Boolean).join("-");

  if (!productPart) {
    return null;
  }

  return `compare:${providerPart}:${productPart}`;
}

module.exports = {
  buildCacheKey,
  normalizePart,
};
