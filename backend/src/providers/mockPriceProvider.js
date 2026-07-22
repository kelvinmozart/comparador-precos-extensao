const DEFAULT_BASE_PRICE = 999.9;
const PRICE_FACTORS = [0.94, 0.98, 1.01, 1.04, 1.08];
const CONFIDENCE_VALUES = [0.92, 0.9, 0.86, 0.82, 0.78];

function roundPrice(value) {
  return Math.round(value * 100) / 100;
}

function buildOffer(product, factor, index) {
  return {
    store: `Loja Mock ${index + 1}`,
    title: index === 0
      ? product.name
      : `${product.name} - Oferta ${index + 1}`,
    price: roundPrice(product.basePrice * factor),
    currency: product.currency || "BRL",
    url: `https://example.com/oferta-${index + 1}`,
    image: null,
    source: "mock",
    raw: {
      factor,
      confidence: CONFIDENCE_VALUES[index],
    },
  };
}

async function searchOffers(product) {
  const basePrice = product.price || DEFAULT_BASE_PRICE;
  const productForOffers = {
    ...product,
    basePrice,
  };

  return PRICE_FACTORS.map((factor, index) => buildOffer(productForOffers, factor, index));
}

module.exports = {
  name: "mock",
  searchOffers,
};
