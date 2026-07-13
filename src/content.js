(function () {
  const STATE_KEY = "__priceCompareContentState";
  const WIDGET_ID = "price-compare-widget";
  const STYLE_ID = "price-compare-widget-styles";
  const WIDGET_CSS_PATH = "src/widget.css";

  const existingState = window[STATE_KEY];
  if (existingState?.initialized) {
    existingState.runDetection?.();
    return;
  }

  const state = {
    initialized: true,
    lastUrl: window.location.href,
    widget: null,
    runDetection: null,
    runId: 0,
  };

  window[STATE_KEY] = state;

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

  function getWidget() {
    const Widget = window.PriceCompareWidget || window.PriceWidget;
    if (!Widget) {
      return null;
    }

    if (!document.getElementById(WIDGET_ID)) {
      state.widget = null;
    }

    if (!state.widget) {
      state.widget = new Widget({ state: "loading" });
      state.widget.render();
    }

    return state.widget;
  }

  function removeWidget() {
    if (state.widget && typeof state.widget.close === "function") {
      state.widget.close();
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

  function isCurrentRun(runId, widget) {
    return (
      state.runId === runId &&
      state.widget === widget &&
      widget?.root &&
      document.getElementById(WIDGET_ID) === widget.root
    );
  }

  function runDetection() {
    const runId = state.runId + 1;
    state.runId = runId;

    removeWidget();

    window.setTimeout(async () => {
      let product = null;

      try {
        product = detectProduct();
      } catch (error) {
        removeWidget();
        return;
      }

      if (state.runId !== runId) {
        return;
      }

      if (!product?.detected) {
        removeWidget();
        return;
      }

      ensureWidgetStyles();

      const widget = getWidget();
      if (!widget || state.runId !== runId) {
        return;
      }

      widget.setState("detected", product);
      widget.setState("comparing", product);

      try {
        const comparison = await comparePrices(product);

        if (isCurrentRun(runId, widget)) {
          widget.setState("compared", comparison || product);
        }
      } catch (error) {
        if (isCurrentRun(runId, widget)) {
          widget.setState("compare_error", product);
        }
      }
    }, 0);
  }

  function handleUrlChange() {
    const currentUrl = window.location.href;

    if (currentUrl === state.lastUrl) {
      return;
    }

    state.lastUrl = currentUrl;
    runDetection();
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
  }

  state.runDetection = runDetection;

  watchUrlChanges();
  runDetection();
})();
