const DEFAULT_MAX_QUERY_LENGTH = 120;
const GENERIC_WORDS = new Set([
  "a",
  "comprar",
  "compre",
  "com",
  "da",
  "de",
  "desconto",
  "do",
  "e",
  "em",
  "frete",
  "gratis",
  "grátis",
  "loja",
  "na",
  "no",
  "novo",
  "o",
  "oferta",
  "original",
  "para",
  "preco",
  "preço",
  "produto",
  "promo",
  "promocao",
  "promoção",
  "reais",
  "sem",
  "usado",
]);

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/https?:\/\/\S+/gi, " ")
    .replace(/\b(?:r\$|brl)\s*\d+(?:[\s.,]\d+)*/gi, " ")
    .replace(/\b\d+(?:[\s.,]\d+)*\s*(?:brl|reais)\b/gi, " ")
    .replace(/[#$€£¥]/g, " ")
    .replace(/[^\p{L}\p{N}\s.-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getNormalizedKey(value) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function tokenize(value) {
  return normalizeText(value)
    .split(" ")
    .map((token) => token.trim())
    .filter(Boolean)
    .filter((token) => !GENERIC_WORDS.has(getNormalizedKey(token)));
}

function pushUnique(tokens, token, seen) {
  const key = getNormalizedKey(token);

  if (!key || seen.has(key)) {
    return;
  }

  seen.add(key);
  tokens.push(token);
}

function limitQueryLength(query, maxLength) {
  if (query.length <= maxLength) {
    return query;
  }

  const limited = query.slice(0, maxLength).trim();
  return limited.replace(/\s+\S*$/, "").trim() || limited;
}

function normalizeSearchQuery(product, options = {}) {
  const source = product && typeof product === "object" ? product : {};
  const maxLength = Number.isFinite(options.maxLength) && options.maxLength > 0
    ? options.maxLength
    : DEFAULT_MAX_QUERY_LENGTH;
  const tokens = [];
  const seen = new Set();

  [source.brand, source.name].forEach((value) => {
    tokenize(value).forEach((token) => pushUnique(tokens, token, seen));
  });

  return limitQueryLength(tokens.join(" "), maxLength);
}

module.exports = {
  normalizeSearchQuery,
};
