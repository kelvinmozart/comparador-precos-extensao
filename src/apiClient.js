(function () {
  const COMPARE_URL = "http://localhost:3000/compare";
  const DEFAULT_TIMEOUT_MS = 8000;
  const FRIENDLY_ERROR_MESSAGE = "Não foi possível buscar ofertas agora.";
  const MESSAGE_TYPE_COMPARE = "PRICE_COMPARE_COMPARE";
  const LOG_PREFIX = "[PriceCompare][apiClient]";

  function createFriendlyError(cause) {
    const error = new Error(FRIENDLY_ERROR_MESSAGE);
    error.originalError = cause;
    return error;
  }

  function getErrorDetails(error) {
    if (!error) {
      return null;
    }

    return {
      name: error.name,
      message: error.message,
      status: error.status,
      payload: error.payload,
    };
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

  function canUseBackgroundClient() {
    return typeof globalThis.chrome?.runtime?.sendMessage === "function";
  }

  function compareViaBackground(productForCompare, timeoutMs) {
    return new Promise((resolve, reject) => {
      globalThis.chrome.runtime.sendMessage({
        type: MESSAGE_TYPE_COMPARE,
        product: productForCompare,
        timeoutMs,
      }, (response) => {
        const runtimeError = globalThis.chrome.runtime.lastError;

        if (runtimeError) {
          reject(new Error(runtimeError.message));
          return;
        }

        if (!response?.ok) {
          const backgroundError = new Error(response?.error?.message || FRIENDLY_ERROR_MESSAGE);
          backgroundError.name = response?.error?.name || "BackgroundError";
          backgroundError.status = response?.error?.status;
          backgroundError.payload = response?.error?.payload;
          reject(backgroundError);
          return;
        }

        resolve(response.payload);
      });
    });
  }

  async function compareViaFetch(productForCompare, timeoutMs) {
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
        const httpError = new Error(`Backend respondeu HTTP ${response.status}`);
        httpError.status = response.status;
        httpError.payload = payload;
        throw httpError;
      }

      return payload;
    } finally {
      window.clearTimeout(timeoutId);
    }
  }

  async function comparePrices(product, options = {}) {
    if (!isDetectedProduct(product)) {
      return null;
    }

    const productForCompare = normalizeProductForCompare(product);
    const timeoutMs = Number.isFinite(options.timeoutMs) && options.timeoutMs > 0
      ? options.timeoutMs
      : DEFAULT_TIMEOUT_MS;

    try {
      console.info(LOG_PREFIX, "Chamando backend local.", {
        url: COMPARE_URL,
        timeoutMs,
        transport: canUseBackgroundClient() ? "background" : "fetch",
        product: productForCompare,
      });

      const payload = canUseBackgroundClient()
        ? await compareViaBackground(productForCompare, timeoutMs)
        : await compareViaFetch(productForCompare, timeoutMs);

      console.info(LOG_PREFIX, "Backend respondeu com sucesso.", {
        results: Array.isArray(payload?.results) ? payload.results.length : null,
        provider: payload?.provider,
        cacheHit: payload?.cacheHit,
      });

      return payload;
    } catch (error) {
      console.error(LOG_PREFIX, "Falha ao buscar ofertas.", getErrorDetails(error));
      throw createFriendlyError(error);
    }
  }

  window.priceCompareApi = {
    ...(window.priceCompareApi || {}),
    comparePrices,
  };
  window.comparePrices = comparePrices;
})();
