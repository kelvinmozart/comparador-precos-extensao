(function () {
  const STATE_KEY = "__priceCompareContentState";
  const WIDGET_ID = "price-compare-widget";
  const STYLE_ID = "price-compare-widget-styles";
  const WIDGET_CSS_PATH = "src/widget.css";
  const CLOSED_URLS_SESSION_KEY = "priceCompareClosedUrls";
  const HIDDEN_SITES_STORAGE_KEY = "priceCompareHiddenSites";
  const DETECTION_DEBOUNCE_MS = 250;
  const LOG_PREFIX = "[PriceCompare][content]";

  const existingState = window[STATE_KEY];
  if (existingState?.initialized) {
    existingState.runDetection?.("reinjected");
    return;
  }

  const state = {
    initialized: true,
    lastUrl: window.location.href,
    widget: null,
    runDetection: null,
    runId: 0,
    detectionTimer: null,
    inFlightKey: null,
    inFlightRunId: null,
    lastComparison: null,
  };

  window[STATE_KEY] = state;

  function readSessionObject(key) {
    try {
      return JSON.parse(window.sessionStorage.getItem(key) || "{}") || {};
    } catch (error) {
      return {};
    }
  }

  function writeSessionObject(key, value) {
    try {
      window.sessionStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.warn(LOG_PREFIX, "Nao foi possivel salvar preferencia de sessao.", {
        key,
        message: error.message,
      });
    }
  }

  function getUrlKey() {
    return window.location.href;
  }

  function getCurrentHost() {
    return String(window.location.hostname || "").trim().toLowerCase().replace(/^www\./, "");
  }

  function isCurrentUrlClosed() {
    return readSessionObject(CLOSED_URLS_SESSION_KEY)[getUrlKey()] === true;
  }

  function markCurrentUrlClosed() {
    const closedUrls = readSessionObject(CLOSED_URLS_SESSION_KEY);
    closedUrls[getUrlKey()] = true;
    writeSessionObject(CLOSED_URLS_SESSION_KEY, closedUrls);
  }

  function canUseChromeStorage() {
    return typeof window.chrome?.storage?.local?.get === "function";
  }

  function getStorageValue(key) {
    if (!canUseChromeStorage()) {
      try {
        return Promise.resolve(JSON.parse(window.localStorage.getItem(key) || "[]"));
      } catch (error) {
        return Promise.resolve([]);
      }
    }

    return new Promise((resolve) => {
      window.chrome.storage.local.get([key], (items) => {
        const runtimeError = window.chrome.runtime?.lastError;
        if (runtimeError) {
          console.warn(LOG_PREFIX, "Nao foi possivel ler chrome.storage.local.", {
            key,
            message: runtimeError.message,
          });
          resolve([]);
          return;
        }

        resolve(items?.[key] || []);
      });
    });
  }

  function setStorageValue(key, value) {
    if (!canUseChromeStorage()) {
      try {
        window.localStorage.setItem(key, JSON.stringify(value));
      } catch (error) {
        console.warn(LOG_PREFIX, "Nao foi possivel salvar preferencia local.", {
          key,
          message: error.message,
        });
      }
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      window.chrome.storage.local.set({ [key]: value }, () => {
        const runtimeError = window.chrome.runtime?.lastError;
        if (runtimeError) {
          console.warn(LOG_PREFIX, "Nao foi possivel salvar chrome.storage.local.", {
            key,
            message: runtimeError.message,
          });
        }

        resolve();
      });
    });
  }

  async function isCurrentSiteHidden() {
    const host = getCurrentHost();
    if (!host) {
      return false;
    }

    const hiddenSites = await getStorageValue(HIDDEN_SITES_STORAGE_KEY);
    return Array.isArray(hiddenSites) && hiddenSites.includes(host);
  }

  async function hideCurrentSite() {
    const host = getCurrentHost();
    if (!host) {
      removeWidget();
      return;
    }

    const hiddenSites = await getStorageValue(HIDDEN_SITES_STORAGE_KEY);
    const nextHiddenSites = Array.from(new Set([
      ...(Array.isArray(hiddenSites) ? hiddenSites : []),
      host,
    ]));

    await setStorageValue(HIDDEN_SITES_STORAGE_KEY, nextHiddenSites);
    console.info(LOG_PREFIX, "Widget ocultado neste site.", { host });
    removeWidget();
  }

  function hasWidgetStyles() {
    if (document.getElementById(STYLE_ID)) {
      return true;
    }

    try {
      return Array.from(document.styleSheets).some((styleSheet) => {
        return typeof styleSheet.href === "string" && styleSheet.href.includes(WIDGET_CSS_PATH);
      });
    } catch (error) {
      return false;
    }
  }

  function ensureWidgetStyles() {
    if (hasWidgetStyles() || !document.head) {
      return;
    }

    if (typeof window.chrome?.runtime?.getURL !== "function") {
      return;
    }

    const link = document.createElement("link");
    link.id = STYLE_ID;
    link.rel = "stylesheet";
    link.href = window.chrome.runtime.getURL(WIDGET_CSS_PATH);
    document.head.appendChild(link);
  }

  function handleWidgetClose() {
    markCurrentUrlClosed();
    state.widget = null;
    console.info(LOG_PREFIX, "Widget fechado nesta URL durante a sessao.", {
      url: getUrlKey(),
    });
  }

  function getWidget() {
    const Widget = window.PriceCompareWidget || window.PriceWidget;
    if (!Widget) {
      return null;
    }

    if (!document.getElementById(WIDGET_ID)) {
      state.widget = null;
    }

    if (!state.widget) {
      state.widget = new Widget({
        state: "loading",
        onClose: handleWidgetClose,
        onHideSite: () => {
          hideCurrentSite().catch((error) => {
            console.error(LOG_PREFIX, "Nao foi possivel ocultar este site.", {
              message: error.message,
            });
          });
        },
      });
      state.widget.render();
    }

    return state.widget;
  }

  function removeWidget() {
    if (state.widget && typeof state.widget.destroy === "function") {
      state.widget.destroy();
    } else if (state.widget && typeof state.widget.close === "function") {
      state.widget.close({ silent: true });
    }

    document.getElementById(WIDGET_ID)?.remove();
    state.widget = null;
  }

  function detectProduct() {
    const detector = window.productDetector;

    if (typeof detector?.detectProductFromPage !== "function") {
      throw new Error("Product detector is not available.");
    }

    return detector.detectProductFromPage(document, window.location);
  }

  function comparePrices(product) {
    const apiClient = window.priceCompareApi;

    if (typeof apiClient?.comparePrices === "function") {
      return apiClient.comparePrices(product);
    }

    if (typeof window.comparePrices === "function") {
      return window.comparePrices(product);
    }

    throw new Error("API client is not available.");
  }

  function isComparableProduct(product) {
    return (
      product?.detected === true &&
      typeof product.name === "string" &&
      product.name.trim().length > 0 &&
      Number.isFinite(product.price)
    );
  }

  function normalizeKeyPart(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");
  }

  function buildProductKey(product) {
    return [
      normalizeKeyPart(product?.name),
      normalizeKeyPart(product?.brand),
      normalizeKeyPart(product?.gtin),
      normalizeKeyPart(product?.sku),
      normalizeKeyPart(product?.currency),
      Number.isFinite(product?.price) ? String(product.price) : "",
    ].join("|");
  }

  function buildComparisonKey(product) {
    return `${getUrlKey()}::${buildProductKey(product)}`;
  }

  function isCurrentRun(runId, widget) {
    return (
      state.runId === runId &&
      state.widget === widget &&
      widget?.root &&
      document.getElementById(WIDGET_ID) === widget.root
    );
  }

  async function runDetectionNow(reason) {
    const runId = state.runId + 1;
    state.runId = runId;

    console.info(LOG_PREFIX, "Iniciando deteccao de produto.", {
      runId,
      reason,
      url: window.location.href,
    });

    if (isCurrentUrlClosed()) {
      console.info(LOG_PREFIX, "URL fechada nesta sessao. Widget nao sera exibido.", {
        runId,
        url: getUrlKey(),
      });
      removeWidget();
      return;
    }

    if (await isCurrentSiteHidden()) {
      console.info(LOG_PREFIX, "Site ocultado pelo usuario. Widget nao sera exibido.", {
        runId,
        host: getCurrentHost(),
      });
      removeWidget();
      return;
    }

    let product = null;

    try {
      product = detectProduct();
    } catch (error) {
      console.error(LOG_PREFIX, "Erro ao detectar produto.", {
        runId,
        message: error.message,
      });
      removeWidget();
      return;
    }

    if (state.runId !== runId) {
      return;
    }

    if (!isComparableProduct(product)) {
      console.info(LOG_PREFIX, "Nenhum produto com preco detectado. Widget nao sera exibido.", {
        runId,
        product,
      });
      removeWidget();
      return;
    }

    ensureWidgetStyles();

    const widget = getWidget();
    if (!widget || state.runId !== runId) {
      return;
    }

    const comparisonKey = buildComparisonKey(product);

    if (state.lastComparison?.key === comparisonKey) {
      console.info(LOG_PREFIX, "Usando ultima comparacao local desta pagina.", {
        runId,
        comparisonKey,
      });
      widget.setState("compared", state.lastComparison.payload);
      return;
    }

    if (state.inFlightKey === comparisonKey) {
      console.info(LOG_PREFIX, "Comparacao ja em andamento para este produto.", {
        runId,
        comparisonKey,
      });
      state.runId = state.inFlightRunId || state.runId;
      return;
    }

    console.info(LOG_PREFIX, "Produto detectado.", {
      runId,
      product,
    });

    widget.setState("detected", product);
    widget.setState("comparing", product);
    state.inFlightKey = comparisonKey;
    state.inFlightRunId = runId;

    try {
      const comparison = await comparePrices(product);

      if (isCurrentRun(runId, widget)) {
        console.info(LOG_PREFIX, "Comparacao concluida.", {
          runId,
          results: Array.isArray(comparison?.results) ? comparison.results.length : null,
          provider: comparison?.provider,
          cacheHit: comparison?.cacheHit,
        });

        state.lastComparison = {
          key: comparisonKey,
          payload: comparison || product,
        };
        widget.setState("compared", comparison || product);
      }
    } catch (error) {
      console.error(LOG_PREFIX, "Nao foi possivel buscar ofertas.", {
        runId,
        message: error.message,
        originalError: {
          name: error.originalError?.name,
          message: error.originalError?.message,
          status: error.originalError?.status,
          payload: error.originalError?.payload,
        },
      });

      if (isCurrentRun(runId, widget)) {
        widget.setState("compare_error", product);
      }
    } finally {
      if (state.inFlightKey === comparisonKey) {
        state.inFlightKey = null;
        state.inFlightRunId = null;
      }
    }
  }

  function scheduleDetection(reason = "scheduled") {
    window.clearTimeout(state.detectionTimer);
    state.detectionTimer = window.setTimeout(() => {
      runDetectionNow(reason).catch((error) => {
        console.error(LOG_PREFIX, "Erro inesperado na analise agendada.", {
          reason,
          message: error.message,
        });
        removeWidget();
      });
    }, DETECTION_DEBOUNCE_MS);
  }

  function handleUrlChange() {
    const currentUrl = window.location.href;

    if (currentUrl === state.lastUrl) {
      return;
    }

    state.lastUrl = currentUrl;
    state.inFlightKey = null;
    state.inFlightRunId = null;
    scheduleDetection("url_change");
  }

  function watchUrlChanges() {
    const scheduleUrlCheck = () => {
      window.setTimeout(handleUrlChange, 0);
    };

    ["pushState", "replaceState"].forEach((methodName) => {
      const originalMethod = window.history[methodName];

      if (typeof originalMethod !== "function") {
        return;
      }

      window.history[methodName] = function (...args) {
        const result = originalMethod.apply(this, args);
        scheduleUrlCheck();
        return result;
      };
    });

    window.addEventListener("popstate", scheduleUrlCheck);
    window.addEventListener("hashchange", scheduleUrlCheck);
  }

  state.runDetection = scheduleDetection;

  watchUrlChanges();
  scheduleDetection("initial");
})();
