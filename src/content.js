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

  function detectProduct() {
    const detector = window.productDetector;

    if (typeof detector?.detectProductFromPage !== "function") {
      throw new Error("Product detector is not available.");
    }

    return detector.detectProductFromPage(document, window.location);
  }

  function updateWidget(result) {
    const widget = getWidget();
    if (!widget) {
      return;
    }

    if (result?.detected) {
      widget.setState("detected", result);
      return;
    }

    widget.setState("not_found", result);
  }

  function runDetection() {
    ensureWidgetStyles();

    const widget = getWidget();
    if (!widget) {
      return;
    }

    widget.setState("loading");

    window.setTimeout(() => {
      try {
        updateWidget(detectProduct());
      } catch (error) {
        widget.setState("error");
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
