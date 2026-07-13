const DEFAULT_CURRENCY = "BRL";

function normalizeText(value, options = {}) {
  const fallback = options.fallback ?? null;
  const maxLength = Number.isFinite(options.maxLength) && options.maxLength > 0
    ? options.maxLength
    : 180;

  if (value === null || value === undefined) {
    return fallback;
  }

  const text = String(value).replace(/\s+/g, " ").trim();
  if (!text) {
    return fallback;
  }

  return text.length > maxLength
    ? `${text.slice(0, Math.max(0, maxLength - 3)).trim()}...`
    : text;
}

function normalizeCurrency(value) {
  const currency = normalizeText(value, { fallback: DEFAULT_CURRENCY, maxLength: 3 }).toUpperCase();
  return /^[A-Z]{3}$/.test(currency) ? currency : DEFAULT_CURRENCY;
}

function normalizePrice(value) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  const text = normalizeText(value);
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

function normalizeProduct(input) {
  const source = input && typeof input === "object" ? input : {};

  return {
    name: normalizeText(source.name, { fallback: "Produto sem nome", maxLength: 180 }),
    price: normalizePrice(source.price),
    currency: normalizeCurrency(source.currency),
    url: normalizeText(source.url, { fallback: null, maxLength: 500 }),
    brand: normalizeText(source.brand, { fallback: null, maxLength: 120 }),
    sku: normalizeText(source.sku, { fallback: null, maxLength: 120 }),
    gtin: normalizeText(source.gtin, { fallback: null, maxLength: 64 }),
  };
}

module.exports = {
  normalizeProduct,
};
