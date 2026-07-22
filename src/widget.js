(function () {
  const WIDGET_ID = "price-compare-widget";
  const EMPTY_VALUE = "-";
  const MAX_OFFERS = 5;
  const STATE_MESSAGES = {
    loading: "Analisando produto...",
    detected: "Produto detectado nesta página.",
    comparing: "Buscando ofertas...",
    compared: "Ofertas parecidas encontradas",
    no_offers: "Produto detectado, mas nenhuma oferta parecida foi encontrada.",
    not_found: "Nenhum produto detectado nesta página.",
    compare_error: "Backend indisponível. Tente novamente em instantes.",
    error: "Não foi possível analisar esta página.",
  };
  const PRODUCT_VISIBLE_STATES = new Set([
    "detected",
    "comparing",
    "compared",
    "no_offers",
    "compare_error",
  ]);

  function createElement(tagName, className, textContent) {
    const element = document.createElement(tagName);

    if (className) {
      element.className = className;
    }

    if (typeof textContent === "string") {
      element.textContent = textContent;
    }

    return element;
  }

  function firstDefined(...values) {
    for (const value of values) {
      if (value !== null && value !== undefined && value !== "") {
        return value;
      }
    }

    return "";
  }

  function sanitizeText(text, options = {}) {
    const formatter = window.priceCompareFormatters;

    if (typeof formatter?.sanitizeText === "function") {
      return formatter.sanitizeText(text, options);
    }

    const fallback = options.fallback ?? "";
    const maxLength = Number.isFinite(options.maxLength) && options.maxLength > 0
      ? options.maxLength
      : 180;

    if (text === null || text === undefined) {
      return fallback;
    }

    const normalized = String(text).replace(/\s+/g, " ").trim();
    if (!normalized) {
      return fallback;
    }

    return normalized.length > maxLength
      ? `${normalized.slice(0, Math.max(0, maxLength - 3)).trim()}...`
      : normalized;
  }

  function normalizeCurrency(currency) {
    const formatter = window.priceCompareFormatters;

    if (typeof formatter?.normalizeCurrency === "function") {
      return formatter.normalizeCurrency(currency);
    }

    const value = String(firstDefined(currency)).trim().toUpperCase();
    return /^[A-Z]{3}$/.test(value) ? value : "";
  }

  function parsePriceNumber(value) {
    const formatter = window.priceCompareFormatters;

    if (typeof formatter?.parsePriceNumber === "function") {
      return formatter.parsePriceNumber(value);
    }

    if (typeof value === "number") {
      return Number.isFinite(value) ? value : null;
    }

    const text = String(firstDefined(value)).trim();
    if (!text) {
      return null;
    }

    let normalized = text.replace(/[^\d,.-]/g, "");
    if (!/\d/.test(normalized)) {
      return null;
    }

    const commaIndex = normalized.lastIndexOf(",");
    const dotIndex = normalized.lastIndexOf(".");

    if (commaIndex !== -1 && dotIndex !== -1) {
      const decimalSeparator = commaIndex > dotIndex ? "," : ".";
      const thousandsSeparator = decimalSeparator === "," ? "." : ",";

      normalized = normalized
        .replace(new RegExp("\\" + thousandsSeparator, "g"), "")
        .replace(decimalSeparator, ".");
    } else if (commaIndex !== -1) {
      normalized = normalizeSingleSeparatorPrice(normalized, ",");
    } else if (dotIndex !== -1) {
      normalized = normalizeSingleSeparatorPrice(normalized, ".");
    }

    const price = Number.parseFloat(normalized);
    return Number.isFinite(price) ? price : null;
  }

  function normalizeSingleSeparatorPrice(value, separator) {
    const parts = value.split(separator);
    const lastPart = parts[parts.length - 1];
    const hasDecimalPart = lastPart.length > 0 && lastPart.length <= 2;

    if (parts.length === 2 && hasDecimalPart) {
      return value.replace(separator, ".");
    }

    if (parts.length > 2 && hasDecimalPart) {
      return parts.slice(0, -1).join("").replace(/[,.]/g, "") + "." + lastPart;
    }

    return value.replace(new RegExp("\\" + separator, "g"), "");
  }

  function formatPrice(value, currency) {
    const formatter = window.priceCompareFormatters;

    if (typeof formatter?.formatCurrency === "function") {
      return formatter.formatCurrency(value, currency);
    }

    const currencyCode = normalizeCurrency(currency);

    if (value === "") {
      return "Preço não informado";
    }

    if (typeof value === "number" && Number.isFinite(value)) {
      return formatCurrency(value, currencyCode || "BRL");
    }

    const text = String(value || "").trim();
    if (!text) {
      return "";
    }

    const numericValue = parsePriceNumber(text);
    if (currencyCode && numericValue !== null) {
      return formatCurrency(numericValue, currencyCode);
    }

    return text;
  }

  function formatCurrency(value, currency) {
    const formatter = window.priceCompareFormatters;

    if (typeof formatter?.formatCurrency === "function") {
      return formatter.formatCurrency(value, currency);
    }

    try {
      return new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency,
      }).format(value);
    } catch (error) {
      return `${currency} ${value}`;
    }
  }

  function formatConfidence(value) {
    const formatter = window.priceCompareFormatters;

    if (typeof formatter?.formatConfidence === "function") {
      const confidence = formatter.formatConfidence(value);
      return confidence === "similaridade não calculada"
        ? confidence
        : `similaridade: ${confidence}`;
    }

    const numericValue = parsePriceNumber(value);

    if (numericValue === null) {
      return "similaridade não calculada";
    }

    const percentage = numericValue <= 1 ? numericValue * 100 : numericValue;
    return `similaridade: ${Math.round(percentage)}%`;
  }

  function formatSourceLabel(source) {
    const normalizedSource = sanitizeText(source, { fallback: "unknown" }).toLowerCase();

    if (normalizedSource === "mercadolivre") {
      return "Fonte: Mercado Livre";
    }

    if (normalizedSource === "mock") {
      return "Fonte: mock local";
    }

    return `Fonte: ${sanitizeText(source, { fallback: "desconhecida", maxLength: 60 })}`;
  }

  function formatUpdatedAt(value) {
    const rawValue = firstDefined(value);
    if (!rawValue) {
      return "";
    }

    const date = new Date(rawValue);
    if (Number.isNaN(date.getTime())) {
      return "";
    }

    const diffMs = Date.now() - date.getTime();
    if (diffMs >= 0 && diffMs < 5 * 60 * 1000) {
      return "Atualizado agora";
    }

    try {
      return `Atualizado em ${new Intl.DateTimeFormat("pt-BR", {
        dateStyle: "short",
        timeStyle: "short",
      }).format(date)}`;
    } catch (error) {
      return `Atualizado em ${date.toLocaleString()}`;
    }
  }

  function normalizeProduct(product) {
    const source = product || {};
    const price = firstDefined(source.price, source.detectedPrice, source.amount);
    const currency = firstDefined(source.currency, source.priceCurrency);

    return {
      name: sanitizeText(firstDefined(source.name, source.productName, source.title), {
        fallback: "Produto sem nome",
      }),
      price: formatPrice(price, currency),
    };
  }

  function getProductPayload(payload, fallback) {
    if (payload?.currentProduct) {
      return payload.currentProduct;
    }

    if (payload?.product) {
      return payload.product;
    }

    return payload || fallback || {};
  }

  function normalizeOffers(payload) {
    const offers = Array.isArray(payload?.results)
      ? payload.results
      : Array.isArray(payload?.offers)
        ? payload.offers
        : [];

    return offers
      .map(normalizeOffer)
      .filter((offer) => offer.store || offer.title || offer.price || offer.url)
      .sort(compareOffersByPrice)
      .slice(0, MAX_OFFERS);
  }

  function getLowestOffer(offers) {
    return offers.find((offer) => offer.priceValue !== null) || offers[0] || null;
  }

  function normalizeOffer(offer) {
    const source = offer || {};
    const price = firstDefined(source.price, source.detectedPrice, source.amount);
    const currency = normalizeCurrency(firstDefined(source.currency, source.priceCurrency)) || "BRL";

    return {
      store: sanitizeText(firstDefined(source.store, source.seller, source.merchant), {
        fallback: "Oferta",
        maxLength: 80,
      }),
      title: sanitizeText(firstDefined(source.title, source.name, source.productName), {
        fallback: "Oferta encontrada",
        maxLength: 180,
      }),
      price: formatPrice(price, currency),
      priceValue: parsePriceNumber(price),
      confidence: formatConfidence(source.confidence),
      matchLabel: sanitizeText(source.matchLabel, { fallback: "Oferta parecida", maxLength: 40 }),
      source: sanitizeText(source.source, { fallback: "unknown", maxLength: 40 }),
      sourceLabel: formatSourceLabel(source.source),
      url: sanitizeText(firstDefined(source.url, source.link), { fallback: "", maxLength: 500 }),
    };
  }

  function compareOffersByPrice(left, right) {
    const leftPrice = left.priceValue === null ? Number.POSITIVE_INFINITY : left.priceValue;
    const rightPrice = right.priceValue === null ? Number.POSITIVE_INFINITY : right.priceValue;
    return leftPrice - rightPrice;
  }

  function getUpdatedAtParts(payload) {
    const parts = [];
    const updatedAt = formatUpdatedAt(payload?.generatedAt);

    if (updatedAt) {
      parts.push(updatedAt);
    }

    if (payload?.cacheHit === true) {
      parts.push("cache");
    }

    return parts;
  }

  class PriceWidget {
    constructor(options = {}) {
      this.state = options.state || "loading";
      this.product = options.product || {};
      this.comparison = options.comparison || null;
      this.onClose = typeof options.onClose === "function" ? options.onClose : null;
      this.onHideSite = typeof options.onHideSite === "function" ? options.onHideSite : null;
      this.root = null;
      this.elements = {};
      this.handleCloseClick = this.close.bind(this);
      this.handleHideSiteClick = this.hideSite.bind(this);
      this.handleToggleClick = this.toggleMinimized.bind(this);
      this.handleHeaderClick = this.expandFromHeader.bind(this);
    }

    render() {
      if (!document.body) {
        return null;
      }

      const existing = document.getElementById(WIDGET_ID);
      if (existing) {
        this.root = existing;
        this.cacheElements();
        return existing;
      }

      const widget = createElement("aside", "price-compare-widget");
      widget.id = WIDGET_ID;
      widget.setAttribute("aria-label", "Comparador de preços");
      widget.setAttribute("role", "region");

      const header = createElement("div", "price-compare-widget__header");
      const title = createElement("strong", "price-compare-widget__title", "Comparador de preços");
      const actions = createElement("div", "price-compare-widget__actions");

      const toggleButton = createElement("button", "price-compare-widget__toggle", "-");
      toggleButton.type = "button";
      toggleButton.setAttribute("aria-label", "Minimizar widget");
      toggleButton.setAttribute("aria-expanded", "true");
      toggleButton.addEventListener("click", this.handleToggleClick);

      const closeButton = createElement("button", "price-compare-widget__close", "×");
      closeButton.type = "button";
      closeButton.setAttribute("aria-label", "Fechar widget");
      closeButton.addEventListener("click", this.handleCloseClick);
      header.addEventListener("click", this.handleHeaderClick);

      const body = createElement("div", "price-compare-widget__body");
      const status = createElement("p", "price-compare-widget__status");
      status.setAttribute("aria-live", "polite");
      status.setAttribute("aria-atomic", "true");
      const notice = createElement("p", "price-compare-widget__notice");
      notice.hidden = true;

      const details = createElement("div", "price-compare-widget__details");

      const productSection = createElement("div", "price-compare-widget__product");
      const nameRow = createElement("div", "price-compare-widget__row");
      const nameLabel = createElement("span", "price-compare-widget__label", "Produto atual");
      const nameValue = createElement(
        "span",
        "price-compare-widget__value price-compare-widget__product-name",
        EMPTY_VALUE
      );

      const priceRow = createElement("div", "price-compare-widget__row");
      const priceLabel = createElement("span", "price-compare-widget__label", "Preço atual");
      const priceValue = createElement(
        "span",
        "price-compare-widget__value price-compare-widget__product-price",
        EMPTY_VALUE
      );

      const bestPriceRow = createElement("div", "price-compare-widget__row price-compare-widget__best-price-row");
      bestPriceRow.hidden = true;
      const bestPriceLabel = createElement("span", "price-compare-widget__label", "Menor preço encontrado");
      const bestPriceValue = createElement(
        "span",
        "price-compare-widget__value price-compare-widget__best-price",
        EMPTY_VALUE
      );

      const offersSection = createElement("div", "price-compare-widget__offers");
      offersSection.hidden = true;
      const offersTitle = createElement("span", "price-compare-widget__section-title", "Ofertas parecidas");
      const offersList = createElement("div", "price-compare-widget__offers-list");
      const updatedAt = createElement("p", "price-compare-widget__updated-at");
      updatedAt.hidden = true;
      const hideSiteButton = createElement("button", "price-compare-widget__hide-site", "Não mostrar neste site");
      hideSiteButton.type = "button";
      hideSiteButton.addEventListener("click", this.handleHideSiteClick);

      actions.append(toggleButton, closeButton);
      header.append(title, actions);
      nameRow.append(nameLabel, nameValue);
      priceRow.append(priceLabel, priceValue);
      bestPriceRow.append(bestPriceLabel, bestPriceValue);
      productSection.append(nameRow, priceRow, bestPriceRow);
      offersSection.append(offersTitle, offersList, updatedAt);
      details.append(productSection, offersSection);
      body.append(status, notice, details, hideSiteButton);
      widget.append(header, body);

      document.body.appendChild(widget);

      this.root = widget;
      this.elements = {
        body,
        closeButton,
        toggleButton,
        header,
        title,
        status,
        notice,
        nameValue,
        priceValue,
        bestPriceRow,
        bestPriceValue,
        offersSection,
        offersList,
        updatedAt,
        hideSiteButton,
      };
      this.setState(this.state, this.product);

      return widget;
    }

    cacheElements() {
      if (!this.root) {
        return;
      }

      const closeButton = this.root.querySelector(".price-compare-widget__close");
      if (closeButton) {
        closeButton.removeEventListener("click", this.handleCloseClick);
        closeButton.addEventListener("click", this.handleCloseClick);
      }

      const toggleButton = this.root.querySelector(".price-compare-widget__toggle");
      if (toggleButton) {
        toggleButton.removeEventListener("click", this.handleToggleClick);
        toggleButton.addEventListener("click", this.handleToggleClick);
      }

      const hideSiteButton = this.root.querySelector(".price-compare-widget__hide-site");
      if (hideSiteButton) {
        hideSiteButton.removeEventListener("click", this.handleHideSiteClick);
        hideSiteButton.addEventListener("click", this.handleHideSiteClick);
      }

      const header = this.root.querySelector(".price-compare-widget__header");
      if (header) {
        header.removeEventListener("click", this.handleHeaderClick);
        header.addEventListener("click", this.handleHeaderClick);
      }

      this.elements = {
        body: this.root.querySelector(".price-compare-widget__body"),
        closeButton,
        toggleButton,
        header,
        title: this.root.querySelector(".price-compare-widget__title"),
        status: this.root.querySelector(".price-compare-widget__status"),
        notice: this.root.querySelector(".price-compare-widget__notice"),
        nameValue: this.root.querySelector(".price-compare-widget__product-name"),
        priceValue: this.root.querySelector(".price-compare-widget__product-price"),
        bestPriceRow: this.root.querySelector(".price-compare-widget__best-price-row"),
        bestPriceValue: this.root.querySelector(".price-compare-widget__best-price"),
        offersSection: this.root.querySelector(".price-compare-widget__offers"),
        offersList: this.root.querySelector(".price-compare-widget__offers-list"),
        updatedAt: this.root.querySelector(".price-compare-widget__updated-at"),
        hideSiteButton,
      };
    }

    setState(state, payload) {
      const baseState = STATE_MESSAGES[state] ? state : "error";
      const nextOffers = baseState === "compared" ? normalizeOffers(payload) : [];
      const nextState = baseState === "compared" && nextOffers.length === 0 ? "no_offers" : baseState;
      const nextProduct = normalizeProduct(getProductPayload(payload, this.product));
      const shouldShowProduct = PRODUCT_VISIBLE_STATES.has(nextState);

      this.state = nextState;
      this.product = nextProduct;
      this.comparison = baseState === "compared" ? payload : null;

      if (!this.root) {
        return;
      }

      this.root.dataset.state = nextState;
      this.root.dataset.hasOffers = String(nextOffers.length > 0);

      if (this.elements.status) {
        this.elements.status.textContent = STATE_MESSAGES[nextState];
      }

      if (this.elements.nameValue) {
        this.elements.nameValue.textContent = shouldShowProduct && nextProduct.name
          ? nextProduct.name
          : EMPTY_VALUE;
      }

      if (this.elements.priceValue) {
        this.elements.priceValue.textContent = shouldShowProduct && nextProduct.price
          ? nextProduct.price
          : EMPTY_VALUE;
      }

      this.renderBestPrice(nextOffers);
      this.renderOffers(nextOffers);
      this.renderProviderNotice(payload);
      this.renderUpdatedAt(baseState === "compared" ? payload : null);
    }

    renderBestPrice(offers) {
      if (!this.elements.bestPriceRow || !this.elements.bestPriceValue) {
        return;
      }

      const lowestOffer = getLowestOffer(offers);
      this.elements.bestPriceValue.textContent = lowestOffer?.price || EMPTY_VALUE;
      this.elements.bestPriceRow.hidden = !lowestOffer;
    }

    renderOffers(offers) {
      if (!this.elements.offersSection || !this.elements.offersList) {
        return;
      }

      this.elements.offersList.replaceChildren();
      this.elements.offersSection.hidden = offers.length === 0;

      offers.forEach((offer) => {
        const offerItem = createElement("div", "price-compare-widget__offer");
        const offerHeader = createElement("div", "price-compare-widget__offer-header");
        const store = createElement("span", "price-compare-widget__offer-store", offer.store || "Oferta");
        const price = createElement("span", "price-compare-widget__offer-price", offer.price || EMPTY_VALUE);
        const title = createElement(
          "div",
          "price-compare-widget__offer-title",
          offer.title || "Oferta encontrada"
        );
        const footer = createElement("div", "price-compare-widget__offer-footer");
        const meta = createElement("div", "price-compare-widget__offer-meta");
        const matchLabel = createElement(
          "span",
          "price-compare-widget__offer-match",
          offer.matchLabel || "Oferta parecida"
        );
        const confidence = createElement(
          "span",
          "price-compare-widget__offer-confidence",
          offer.confidence || "similaridade não calculada"
        );
        const source = createElement("span", "price-compare-widget__offer-source", offer.sourceLabel);
        const action = offer.url
          ? createElement("a", "price-compare-widget__offer-link", "Ver oferta")
          : createElement("span", "price-compare-widget__offer-link is-disabled", "Sem link");

        title.title = offer.title || "";

        if (offer.url) {
          action.href = offer.url;
          action.target = "_blank";
          action.rel = "noopener noreferrer";
        }

        offerHeader.append(store, price);
        meta.append(matchLabel, confidence, source);
        footer.append(meta, action);
        offerItem.append(offerHeader, title, footer);
        this.elements.offersList.appendChild(offerItem);
      });
    }

    renderProviderNotice(payload) {
      if (!this.elements.notice) {
        return;
      }

      const fallbackUsed = payload?.provider?.fallbackUsed === true;

      this.elements.notice.textContent = fallbackUsed
        ? "Fonte real indisponível. Exibindo dados de teste."
        : "";
      this.elements.notice.hidden = !fallbackUsed;
    }

    renderUpdatedAt(payload) {
      if (!this.elements.updatedAt) {
        return;
      }

      const parts = getUpdatedAtParts(payload);
      this.elements.updatedAt.textContent = parts.join(" · ");
      this.elements.updatedAt.hidden = parts.length === 0;
    }

    toggleMinimized() {
      if (!this.root) {
        return;
      }

      this.setMinimized(this.root.dataset.minimized !== "true");
    }

    expandFromHeader(event) {
      if (!this.root || this.root.dataset.minimized !== "true") {
        return;
      }

      if (event.target?.closest?.("button, a")) {
        return;
      }

      this.setMinimized(false);
    }

    setMinimized(isMinimized) {
      if (!this.root) {
        return;
      }

      this.root.dataset.minimized = String(isMinimized);

      if (this.elements.toggleButton) {
        this.elements.toggleButton.textContent = isMinimized ? "+" : "-";
        this.elements.toggleButton.setAttribute(
          "aria-label",
          isMinimized ? "Expandir widget" : "Minimizar widget"
        );
        this.elements.toggleButton.setAttribute("aria-expanded", String(!isMinimized));
      }

      if (this.elements.title) {
        this.elements.title.textContent = isMinimized ? "Comparador" : "Comparador de preços";
      }
    }

    hideSite() {
      this.onHideSite?.();
    }

    destroy() {
      this.close({ silent: true });
    }

    close(options = {}) {
      if (!this.root) {
        return;
      }

      if (this.elements.closeButton) {
        this.elements.closeButton.removeEventListener("click", this.handleCloseClick);
      }

      if (this.elements.toggleButton) {
        this.elements.toggleButton.removeEventListener("click", this.handleToggleClick);
      }

      if (this.elements.hideSiteButton) {
        this.elements.hideSiteButton.removeEventListener("click", this.handleHideSiteClick);
      }

      if (this.elements.header) {
        this.elements.header.removeEventListener("click", this.handleHeaderClick);
      }

      this.root.remove();
      this.root = null;
      this.elements = {};

      if (!options.silent) {
        this.onClose?.();
      }
    }
  }

  PriceWidget.STATES = Object.freeze(Object.keys(STATE_MESSAGES));
  window.PriceWidget = PriceWidget;
  window.PriceCompareWidget = PriceWidget;
})();
