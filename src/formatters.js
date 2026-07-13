(function () {
  const DEFAULT_CURRENCY = "BRL";
  const DEFAULT_MAX_TEXT_LENGTH = 180;
  const EMPTY_PRICE_MESSAGE = "Preço não informado";
  const EMPTY_CONFIDENCE_MESSAGE = "similaridade não calculada";

  function sanitizeText(text, options = {}) {
    const fallback = Object.prototype.hasOwnProperty.call(options, "fallback")
      ? options.fallback
      : "";
    const maxLength = Number.isFinite(options.maxLength) && options.maxLength > 0
      ? options.maxLength
      : DEFAULT_MAX_TEXT_LENGTH;

    if (text === null || text === undefined) {
      return fallback;
    }

    const normalized = String(text).replace(/\s+/g, " ").trim();
    if (!normalized) {
      return fallback;
    }

    if (normalized.length <= maxLength) {
      return normalized;
    }

    return `${normalized.slice(0, Math.max(0, maxLength - 3)).trim()}...`;
  }

  function firstValue(...values) {
    for (const value of values) {
      if (value !== null && value !== undefined && value !== "") {
        return value;
      }
    }

    return null;
  }

  function normalizeCurrency(currency) {
    const normalized = sanitizeText(currency).toUpperCase();
    return /^[A-Z]{3}$/.test(normalized) ? normalized : DEFAULT_CURRENCY;
  }

  function parsePriceNumber(value) {
    if (typeof value === "number") {
      return Number.isFinite(value) ? value : null;
    }

    const text = sanitizeText(value);
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

  function formatCurrency(value, currency) {
    const price = parsePriceNumber(value);
    if (price === null) {
      return EMPTY_PRICE_MESSAGE;
    }

    try {
      return new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: normalizeCurrency(currency),
      }).format(price);
    } catch (error) {
      return `${normalizeCurrency(currency)} ${price}`;
    }
  }

  function formatConfidence(confidence) {
    const value = parsePriceNumber(confidence);
    if (value === null) {
      return EMPTY_CONFIDENCE_MESSAGE;
    }

    const percentage = value <= 1 ? value * 100 : value;
    return `${Math.round(percentage)}%`;
  }

  function normalizeProductForCompare(product) {
    const source = product && typeof product === "object" ? product : {};
    const currency = normalizeCurrency(firstValue(source.currency, source.priceCurrency));

    return {
      name: sanitizeText(firstValue(source.name, source.productName, source.title), {
        fallback: "Produto sem nome",
        maxLength: 180,
      }),
      price: parsePriceNumber(firstValue(source.price, source.detectedPrice, source.amount)),
      currency,
      url: sanitizeText(source.url, { fallback: null, maxLength: 500 }),
      brand: sanitizeText(source.brand, { fallback: null, maxLength: 120 }),
      sku: sanitizeText(source.sku, { fallback: null, maxLength: 120 }),
      gtin: sanitizeText(firstValue(source.gtin, source.gtin13, source.gtin14, source.gtin8), {
        fallback: null,
        maxLength: 64,
      }),
    };
  }

  window.priceCompareFormatters = {
    ...(window.priceCompareFormatters || {}),
    formatCurrency,
    formatConfidence,
    normalizeCurrency,
    normalizeProductForCompare,
    parsePriceNumber,
    sanitizeText,
  };
})();
