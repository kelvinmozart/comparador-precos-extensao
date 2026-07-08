(function () {
  const WIDGET_ID = "price-compare-widget";
  const EMPTY_VALUE = "-";
  const STATE_MESSAGES = {
    loading: "Analisando produto...",
    detected: "Produto detectado nesta página.",
    not_found: "Nenhum produto detectado nesta página.",
    error: "Não foi possível analisar esta página.",
  };

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

  function normalizeProduct(product) {
    const source = product || {};
    const price = firstDefined(source.price, source.detectedPrice, source.amount);
    const currency = firstDefined(source.currency, source.priceCurrency);

    return {
      name: firstDefined(source.name, source.productName, source.title),
      price: formatPrice(price, currency),
    };
  }

  function firstDefined(...values) {
    for (const value of values) {
      if (value !== null && value !== undefined && value !== "") {
        return value;
      }
    }

    return "";
  }

  function formatPrice(value, currency) {
    if (value === "") {
      return "";
    }

    if (typeof value === "number" && Number.isFinite(value)) {
      if (currency) {
        try {
          return new Intl.NumberFormat(undefined, {
            style: "currency",
            currency,
          }).format(value);
        } catch (error) {
          return `${currency} ${value}`;
        }
      }

      return String(value);
    }

    const text = String(value).trim();

    if (!text || !currency || text.toUpperCase().includes(String(currency).toUpperCase())) {
      return text;
    }

    return `${currency} ${text}`;
  }

  class PriceWidget {
    constructor(options = {}) {
      this.state = options.state || "loading";
      this.product = options.product || {};
      this.root = null;
      this.elements = {};
      this.handleCloseClick = this.close.bind(this);
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
      const closeButton = createElement("button", "price-compare-widget__close", "×");
      closeButton.type = "button";
      closeButton.setAttribute("aria-label", "Fechar widget");
      closeButton.addEventListener("click", this.handleCloseClick);

      const status = createElement("p", "price-compare-widget__status");
      status.setAttribute("aria-live", "polite");
      status.setAttribute("aria-atomic", "true");
      const details = createElement("div", "price-compare-widget__details");

      const nameRow = createElement("div", "price-compare-widget__row");
      const nameLabel = createElement("span", "price-compare-widget__label", "Produto");
      const nameValue = createElement(
        "span",
        "price-compare-widget__value price-compare-widget__product-name",
        EMPTY_VALUE
      );

      const priceRow = createElement("div", "price-compare-widget__row");
      const priceLabel = createElement("span", "price-compare-widget__label", "Preço detectado");
      const priceValue = createElement(
        "span",
        "price-compare-widget__value price-compare-widget__product-price",
        EMPTY_VALUE
      );

      header.append(title, closeButton);
      nameRow.append(nameLabel, nameValue);
      priceRow.append(priceLabel, priceValue);
      details.append(nameRow, priceRow);
      widget.append(header, status, details);

      document.body.appendChild(widget);

      this.root = widget;
      this.elements = {
        status,
        nameValue,
        priceValue,
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
        closeButton.addEventListener("click", this.handleCloseClick);
      }

      this.elements = {
        status: this.root.querySelector(".price-compare-widget__status"),
        nameValue: this.root.querySelector(".price-compare-widget__product-name"),
        priceValue: this.root.querySelector(".price-compare-widget__product-price"),
      };
    }

    setState(state, product) {
      const nextState = STATE_MESSAGES[state] ? state : "error";
      const nextProduct = normalizeProduct(product);

      this.state = nextState;
      this.product = nextProduct;

      if (!this.root) {
        return;
      }

      this.root.dataset.state = nextState;

      if (this.elements.status) {
        this.elements.status.textContent = STATE_MESSAGES[nextState];
      }

      if (this.elements.nameValue) {
        this.elements.nameValue.textContent = nextState === "detected" && nextProduct.name
          ? nextProduct.name
          : EMPTY_VALUE;
      }

      if (this.elements.priceValue) {
        this.elements.priceValue.textContent = nextState === "detected" && nextProduct.price
          ? nextProduct.price
          : EMPTY_VALUE;
      }
    }

    close() {
      if (!this.root) {
        return;
      }

      const closeButton = this.root.querySelector(".price-compare-widget__close");
      if (closeButton) {
        closeButton.removeEventListener("click", this.handleCloseClick);
      }

      this.root.remove();
      this.root = null;
      this.elements = {};
    }
  }

  PriceWidget.STATES = Object.freeze(Object.keys(STATE_MESSAGES));
  window.PriceWidget = PriceWidget;
  window.PriceCompareWidget = PriceWidget;
})();
