const http = require("http");
const https = require("https");
const { normalizeSearchQuery } = require("../utils/normalizeSearchQuery");
const logger = require("../utils/logger");

const DEFAULT_SEARCH_BASE_URL = "https://api.mercadolibre.com/sites/MLB/search";
const DEFAULT_TIMEOUT_MS = 5000;
const DEFAULT_LIMIT = 10;
const MAX_RESPONSE_SIZE = 2 * 1024 * 1024;

function getSearchBaseUrl() {
  return process.env.MERCADOLIVRE_SEARCH_BASE_URL || DEFAULT_SEARCH_BASE_URL;
}

function getProviderTimeoutMs() {
  const timeoutMs = Number(process.env.PROVIDER_TIMEOUT_MS);
  return Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : DEFAULT_TIMEOUT_MS;
}

function buildSearchUrl(query) {
  const url = new URL(getSearchBaseUrl());
  url.searchParams.set("q", query);
  url.searchParams.set("limit", String(DEFAULT_LIMIT));
  return url;
}

function createHttpError(statusCode, body) {
  const error = new Error(`Mercado Livre API returned HTTP ${statusCode}`);
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
      headers: {
        Accept: "application/json",
        "User-Agent": "comparador-precos-local/1.0",
      },
      signal: controller?.signal,
    });
    const text = await response.text();

    if (!response.ok) {
      throw createHttpError(response.status, text);
    }

    return JSON.parse(text);
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error(`Mercado Livre API timeout after ${timeoutMs}ms`);
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
      headers: {
        Accept: "application/json",
        "User-Agent": "comparador-precos-local/1.0",
      },
    }, (response) => {
      let body = "";

      response.setEncoding("utf8");

      response.on("data", (chunk) => {
        body += chunk;

        if (body.length > MAX_RESPONSE_SIZE) {
          request.destroy(new Error("Mercado Livre API response is too large"));
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
          reject(new Error("Mercado Livre API returned invalid JSON"));
        }
      });
    });

    request.on("error", reject);
    request.setTimeout(timeoutMs, () => {
      request.destroy(new Error(`Mercado Livre API timeout after ${timeoutMs}ms`));
    });
    request.end();
  });
}

function normalizePrice(value) {
  const price = Number(value);
  return Number.isFinite(price) ? price : null;
}

function normalizeCurrency(value) {
  const currency = String(value || "").trim().toUpperCase();
  return /^[A-Z]{3}$/.test(currency) ? currency : "BRL";
}

function mapResultToOffer(item) {
  if (!item || typeof item !== "object") {
    return null;
  }

  return {
    store: "Mercado Livre",
    title: item.title || "Oferta Mercado Livre",
    price: normalizePrice(item.price),
    currency: normalizeCurrency(item.currency_id),
    url: item.permalink || null,
    image: item.thumbnail || null,
    source: "mercadolivre",
    raw: item,
  };
}

function mapSearchResponse(payload, context = {}) {
  if (!payload || !Array.isArray(payload.results)) {
    logger.warn("Mercado Livre retornou formato inesperado.", {
      requestId: context.requestId,
    });
    throw new Error("Mercado Livre API returned an unexpected response format");
  }

  return payload.results
    .map(mapResultToOffer)
    .filter((offer) => offer && offer.title && offer.price !== null && offer.url);
}

async function searchOffers(product, context = {}) {
  const searchQuery = normalizeSearchQuery(product);

  if (!searchQuery) {
    return [];
  }

  const url = buildSearchUrl(searchQuery);
  const timeoutMs = getProviderTimeoutMs();

  try {
    const payload = await fetchJson(url, timeoutMs);
    return mapSearchResponse(payload, context);
  } catch (error) {
    throw error;
  }
}

module.exports = {
  name: "mercadolivre",
  searchOffers,
};
