(function () {
  const COMPARE_URL = "http://localhost:3000/compare";
  const DEFAULT_TIMEOUT_MS = 8000;
  const MESSAGE_TYPE_COMPARE = "PRICE_COMPARE_COMPARE";
  const LOG_PREFIX = "[PriceCompare][background]";

  function getErrorPayload(error) {
    return {
      name: error?.name || "Error",
      message: error?.message || "Erro desconhecido ao chamar o backend.",
      status: error?.status,
      payload: error?.payload,
    };
  }

  async function postCompare(product, timeoutMs) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      console.info(LOG_PREFIX, "Chamando backend local pelo background.", {
        url: COMPARE_URL,
        timeoutMs,
        product,
      });

      const response = await fetch(COMPARE_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(product),
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

      console.info(LOG_PREFIX, "Backend respondeu com sucesso.", {
        status: response.status,
        results: Array.isArray(payload?.results) ? payload.results.length : null,
        provider: payload?.provider,
      });

      return payload;
    } catch (error) {
      if (error?.name === "AbortError") {
        throw new Error(`Timeout ao chamar o backend depois de ${timeoutMs}ms.`);
      }

      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message?.type !== MESSAGE_TYPE_COMPARE) {
      return false;
    }

    const timeoutMs = Number.isFinite(message.timeoutMs) && message.timeoutMs > 0
      ? message.timeoutMs
      : DEFAULT_TIMEOUT_MS;

    postCompare(message.product, timeoutMs)
      .then((payload) => {
        sendResponse({
          ok: true,
          payload,
        });
      })
      .catch((error) => {
        console.error(LOG_PREFIX, "Falha ao buscar ofertas.", getErrorPayload(error));
        sendResponse({
          ok: false,
          error: getErrorPayload(error),
        });
      });

    return true;
  });
})();
