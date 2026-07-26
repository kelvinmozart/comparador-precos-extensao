const http = require("http");
const https = require("https");
const { normalizeSearchQuery } = require("../utils/normalizeSearchQuery");
const logger = require("../utils/logger");

const DEFAULT_PROVIDER_NAME = "Generic Search";
const DEFAULT_TIMEOUT_MS = 5000;
const DEFAULT_LIMIT = 10;
const MAX_RESPONSE_SIZE = 2 * 1024 * 1024;

function parseBoolean(value) {
  return ["1", "true", "yes", "y", "sim"].includes(String(value || "").trim().toLowerCase());
}

function getProviderName() {
  return String(process.env.GENERIC_SEARCH_PROVIDER_NAME || DEFAULT_PROVIDER_NAME).trim() || DEFAULT_PROVIDER_NAME;
}

function getBaseUrl() {
  return String(process.env.GENERIC_SEARCH_PROVIDER_BASE_URL || "").trim();
}

function getProviderTimeoutMs() {
  const timeoutMs = Number(process.env.GENERIC_SEARCH_PROVIDER_TIMEOUT_MS);
  return Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : DEFAULT_TIMEOUT_MS;
}

function isEnabled() {
  return parseBoolean(process.env.GENERIC_SEARCH_PROVIDER_ENABLED);
}

function getApiKeyHeaderName() {
  return String(process.env.GENERIC_SEARCH_PROVIDER_API_KEY_HEADER || "Authorization").trim() || "Authorization";
}

function buildHeaders() {
  const headers = {
    Accept: "application/json",
    "User-Agent": "comparador-precos-local/1.0",
  };
  const apiKey = String(process.env.GENERIC_SEARCH_PROVIDER_API_KEY || "").trim();

  if (!apiKey) {
    return headers;
  }

  const headerName = getApiKeyHeaderName();
  headers[headerName] = headerName.toLowerCase() === "authorization"
    ? `Bearer ${apiKey}`
    : apiKey;
  return headers;
}

function buildSearchUrl(query) {
  const url = new URL(getBaseUrl());
  url.searchParams.set("q", query);
  url.searchParams.set("limit", String(DEFAULT_LIMIT));
  return url;
}

function createHttpError(statusCode, body) {
  const error = new Error(`Generic search API returned HTTP ${statusCode}`);
  error.statusCode = statusCode;
  error.responseBody = body;
  return error;
}

async function fetchJson(url, timeoutMs) {
  if (typeof fetch === "function") {
    return fetchJsonWithNativeFetch(url, timeoutMs);
  }

  return fetchJsonWithHttpModule(url, timeoutMs);
}

async function fetchJsonWithNativeFetch(url, timeoutMs) {
  const controller = typeof AbortController === "function" ? new AbortController() : null;
  const timeoutId = setTimeout(() => {
    controller?.abort();
  }, timeoutMs);

  try {
    const response = await fetch(url, {
      headers: buildHeaders(),
      signal: controller?.signal,
    });
    const text = await response.text();

    if (!response.ok) {
      throw createHttpError(response.status, text);
    }

    return JSON.parse(text);
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error(`Generic search API timeout after ${timeoutMs}ms`);
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

function fetchJsonWithHttpModule(url, timeoutMs) {
  return new Promise((resolve, reject) => {
    const client = url.protocol === "https:" ? https : http;
    const request = client.request(url, {
      method: "GET",
      headers: buildHeaders(),
    }, (response) => {
      let body = "";

      response.setEncoding("utf8");

      response.on("data", (chunk) => {
        body += chunk;

        if (body.length > MAX_RESPONSE_SIZE) {
          request.destroy(new Error("Generic search API response is too large"));
        }
      });

      response.on("end", () => {
        if (response.statusCode < 200 || response.statusCode >= 300) {
          reject(createHttpError(response.statusCode, body));
          return;
        }

        try {
          resolve(JSON.parse(body));
        } catch (error) {
          reject(new Error("Generic search API returned invalid JSON"));
        }
      });
    });

    request.on("error", reject);
    request.setTimeout(timeoutMs, () => {
      request.destroy(new Error(`Generic search API timeout after ${timeoutMs}ms`));
    });
    request.end();
  });
}

function firstValue(...values) {
  return values.find((value) => value !== null && value !== undefined && value !== "");
}

function normalizePrice(value) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  let normalized = String(value || "").trim().replace(/[^\d,.-]/g, "");

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
    normalized = normalized.replace(",", ".");
  }

  const price = Number(normalized);
  return Number.isFinite(price) ? price : null;
}

function normalizeCurrency(value) {
  const currency = String(value || "").trim().toUpperCase();
  return /^[A-Z]{3}$/.test(currency) ? currency : "BRL";
}

function findResultList(response) {
  if (!response || typeof response !== "object") {
    return null;
  }

  return [response.results, response.items, response.products, response.data]
    .find((value) => Array.isArray(value)) || null;
}

function mapItemToOffer(item) {
  if (!item || typeof item !== "object") {
    return null;
  }

  const price = normalizePrice(firstValue(item.price, item.currentPrice, item.salePrice));

  return {
    store: String(firstValue(item.store, item.merchant, item.seller, getProviderName())).trim(),
    title: String(firstValue(item.title, item.name, item.productName, "Oferta encontrada")).trim(),
    price,
    currency: normalizeCurrency(firstValue(item.currency, item.currencyCode)),
    url: firstValue(item.url, item.link, item.productUrl) || null,
    image: firstValue(item.image, item.imageUrl, item.thumbnail) || null,
    source: "generic",
    raw: item,
  };
}

function mapGenericResults(response, context = {}) {
  const items = findResultList(response);

  if (!items) {
    logger.warn("Provider generic retornou formato inesperado.", {
      requestId: context.requestId,
    });
    return [];
  }

  return items
    .map(mapItemToOffer)
    .filter((offer) => offer && offer.title && offer.price !== null && offer.url);
}

async function searchOffers(product, context = {}) {
  if (!isEnabled()) {
    logger.warn("Provider generic desabilitado por configuracao.", {
      requestId: context.requestId,
    });
    return [];
  }

  if (!getBaseUrl()) {
    logger.warn("Provider generic sem GENERIC_SEARCH_PROVIDER_BASE_URL.", {
      requestId: context.requestId,
    });
    return [];
  }

  const searchQuery = normalizeSearchQuery(product);

  if (!searchQuery) {
    return [];
  }

  const url = buildSearchUrl(searchQuery);
  const timeoutMs = getProviderTimeoutMs();
  const payload = await fetchJson(url, timeoutMs);
  return mapGenericResults(payload, context);
}

module.exports = {
  name: "generic",
  searchOffers,
};
