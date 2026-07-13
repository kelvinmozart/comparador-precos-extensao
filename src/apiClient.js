(function () {
  const COMPARE_URL = "http://localhost:3000/compare";
  const DEFAULT_TIMEOUT_MS = 8000;
  const FRIENDLY_ERROR_MESSAGE = "Não foi possível buscar ofertas agora.";

  function createFriendlyError(cause) {
    const error = new Error(FRIENDLY_ERROR_MESSAGE);
    error.originalError = cause;
    return error;
  }

  function isDetectedProduct(product) {
    return product?.detected === true;
  }

  function normalizeProductForCompare(product) {
    const formatter = window.priceCompareFormatters;

    if (typeof formatter?.normalizeProductForCompare === "function") {
      return formatter.normalizeProductForCompare(product);
    }

    return product;
  }

  async function comparePrices(product, options = {}) {
    if (!isDetectedProduct(product)) {
      return null;
    }

    const productForCompare = normalizeProductForCompare(product);
    const timeoutMs = Number.isFinite(options.timeoutMs) && options.timeoutMs > 0
      ? options.timeoutMs
      : DEFAULT_TIMEOUT_MS;
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(COMPARE_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(productForCompare),
        signal: controller.signal,
      });

      let payload = null;

      try {
        payload = await response.json();
      } catch (error) {
        payload = null;
      }

      if (!response.ok) {
        throw createFriendlyError(payload);
      }

      return payload;
    } catch (error) {
      throw createFriendlyError(error);
    } finally {
      window.clearTimeout(timeoutId);
    }
  }

  window.priceCompareApi = {
    ...(window.priceCompareApi || {}),
    comparePrices,
  };
  window.comparePrices = comparePrices;
})();
