(function () {
  function getLocation(locationRef) {
    if (locationRef) {
      return locationRef;
    }

    if (typeof window !== "undefined") {
      return window.location;
    }

    return null;
  }

  function getDocument(documentRef) {
    if (documentRef) {
      return documentRef;
    }

    if (typeof document !== "undefined") {
      return document;
    }

    return null;
  }

  function createEmptyResult(locationRef) {
    const location = getLocation(locationRef);

    return {
      detected: false,
      source: "none",
      name: null,
      price: null,
      currency: null,
      image: null,
      url: location?.href || null,
      sku: null,
      gtin: null,
      brand: null,
    };
  }

  function normalizeScalar(value) {
    if (value === null || value === undefined) {
      return null;
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        const normalized = normalizeScalar(item);

        if (normalized) {
          return normalized;
        }
      }

      return null;
    }

    if (typeof value === "string") {
      const trimmed = value.trim();
      return trimmed || null;
    }

    if (typeof value === "number" || typeof value === "boolean") {
      return String(value);
    }

    return null;
  }

  function firstScalar(...values) {
    for (const value of values) {
      const normalized = normalizeScalar(value);

      if (normalized) {
        return normalized;
      }
    }

    return null;
  }

  function parsePrice(value) {
    if (typeof value === "number") {
      return Number.isFinite(value) ? value : null;
    }

    const text = normalizeScalar(value);
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

  function normalizeTypeValue(value) {
    return normalizeScalar(value)?.toLowerCase() || "";
  }

  function hasType(node, typeName) {
    const type = node?.["@type"];
    const expected = typeName.toLowerCase();

    if (Array.isArray(type)) {
      return type.some((item) => hasType({ "@type": item }, typeName));
    }

    const normalized = normalizeTypeValue(type);
    return (
      normalized === expected ||
      normalized.endsWith("/" + expected) ||
      normalized.endsWith("#" + expected) ||
      normalized.endsWith(":" + expected)
    );
  }

  function getJsonLdScripts(documentRef) {
    if (!documentRef || typeof documentRef.querySelectorAll !== "function") {
      return [];
    }

    return Array.from(documentRef.querySelectorAll("script")).filter((script) => {
      const type = normalizeScalar(script.type || script.getAttribute?.("type")) || "";
      return type.toLowerCase().split(";")[0].trim() === "application/ld+json";
    });
  }

  function parseJsonLdScript(script) {
    const text = normalizeScalar(script?.textContent || script?.innerText);

    if (!text) {
      return null;
    }

    try {
      return JSON.parse(text);
    } catch (error) {
      return null;
    }
  }

  function findProductNodes(value) {
    return findTypedNodes(value, "Product");
  }

  function findTypedNodes(value, typeName) {
    const nodes = [];
    const seen = new Set();

    function visit(node) {
      if (!node || typeof node !== "object" || seen.has(node)) {
        return;
      }

      seen.add(node);

      if (Array.isArray(node)) {
        node.forEach(visit);
        return;
      }

      if (hasType(node, typeName)) {
        nodes.push(node);
      }

      Object.keys(node).forEach((key) => {
        if (key === "@context") {
          return;
        }

        visit(node[key]);
      });
    }

    visit(value);
    return nodes;
  }

  function getOfferPrice(offer) {
    if (!offer || typeof offer !== "object") {
      return null;
    }

    return offer.price ?? offer.priceSpecification?.price ?? null;
  }

  function getOfferCurrency(offer) {
    if (!offer || typeof offer !== "object") {
      return null;
    }

    return firstScalar(offer.priceCurrency, offer.priceSpecification?.priceCurrency);
  }

  function getProductPrice(product) {
    const directPrice = parsePrice(product?.price ?? product?.priceSpecification?.price);

    if (directPrice !== null) {
      return directPrice;
    }

    return parsePrice(getOfferPrice(chooseOffer(product?.offers)));
  }

  function getProductCurrency(product) {
    const directCurrency = firstScalar(product?.priceCurrency, product?.priceSpecification?.priceCurrency);

    if (directCurrency) {
      return directCurrency;
    }

    return getOfferCurrency(chooseOffer(product?.offers));
  }

  function chooseOffer(offers) {
    if (!offers) {
      return null;
    }

    const offerList = Array.isArray(offers) ? offers : [offers];
    const objectOffers = offerList.filter((offer) => offer && typeof offer === "object");

    return objectOffers.find((offer) => parsePrice(getOfferPrice(offer)) !== null) || objectOffers[0] || null;
  }

  function hasAnyJsonLdType(values, typeNames) {
    return values.some((value) => typeNames.some((typeName) => findTypedNodes(value, typeName).length > 0));
  }

  function getMetaContent(documentRef, selectors) {
    if (!documentRef || typeof documentRef.querySelector !== "function") {
      return null;
    }

    for (const selector of selectors) {
      const element = documentRef.querySelector(selector);
      const content = normalizeScalar(element?.content || element?.getAttribute?.("content"));

      if (content) {
        return content;
      }
    }

    return null;
  }

  function isEditorialPage(jsonLdValues, documentRef) {
    const editorialTypes = [
      "Article",
      "NewsArticle",
      "BlogPosting",
      "ReportageNewsArticle",
      "OpinionNewsArticle",
      "AnalysisNewsArticle",
      "ReviewNewsArticle",
    ];
    const ogType = getMetaContent(documentRef, [
      'meta[property="og:type"]',
      'meta[name="og:type"]',
    ]);

    return (
      hasAnyJsonLdType(jsonLdValues, editorialTypes) ||
      normalizeTypeValue(ogType) === "article"
    );
  }

  function isValidProductCandidate(product, options = {}) {
    if (options.isEditorialPage) {
      return false;
    }

    if (!normalizeScalar(product?.name)) {
      return false;
    }

    if (getProductPrice(product) === null) {
      return false;
    }

    return true;
  }

  function normalizeUrl(value, locationRef) {
    const url = normalizeScalar(value);
    const baseUrl = getLocation(locationRef)?.href;

    if (!url) {
      return null;
    }

    try {
      return new URL(url, baseUrl || undefined).href;
    } catch (error) {
      return url;
    }
  }

  function normalizeImage(image, locationRef) {
    if (!image) {
      return null;
    }

    if (Array.isArray(image)) {
      for (const item of image) {
        const normalized = normalizeImage(item, locationRef);

        if (normalized) {
          return normalized;
        }
      }

      return null;
    }

    if (typeof image === "object") {
      return normalizeUrl(firstScalar(image.url, image.contentUrl, image["@id"]), locationRef);
    }

    return normalizeUrl(image, locationRef);
  }

  function normalizeBrand(brand) {
    if (!brand) {
      return null;
    }

    if (Array.isArray(brand)) {
      for (const item of brand) {
        const normalized = normalizeBrand(item);

        if (normalized) {
          return normalized;
        }
      }

      return null;
    }

    if (typeof brand === "object") {
      return firstScalar(brand.name, brand["@id"]);
    }

    return normalizeScalar(brand);
  }

  function scoreProduct(product) {
    const offer = chooseOffer(product.offers);
    let score = 0;

    if (normalizeScalar(product.name)) {
      score += 4;
    }

    if (parsePrice(getOfferPrice(offer)) !== null) {
      score += 3;
    }

    if (normalizeImage(product.image)) {
      score += 1;
    }

    if (normalizeScalar(product.sku)) {
      score += 1;
    }

    return score;
  }

  function chooseProduct(products, options = {}) {
    return products
      .filter((product) => isValidProductCandidate(product, options))
      .slice()
      .sort((left, right) => scoreProduct(right) - scoreProduct(left))[0] || null;
  }

  function normalizeProduct(product, locationRef) {
    const offer = chooseOffer(product.offers);
    const price = getProductPrice(product);
    const currency = getProductCurrency(product);
    const url = normalizeUrl(firstScalar(offer?.url, product.url), locationRef);

    return {
      detected: true,
      source: "jsonld",
      name: normalizeScalar(product.name),
      price,
      currency: currency ? currency.toUpperCase() : null,
      image: normalizeImage(product.image, locationRef),
      url: url || getLocation(locationRef)?.href || null,
      sku: normalizeScalar(product.sku),
      gtin: firstScalar(product.gtin, product.gtin13, product.gtin14, product.gtin8),
      brand: normalizeBrand(product.brand),
      raw: product,
    };
  }

  function detectProductFromPage(documentRef, locationRef) {
    const documentToAnalyze = getDocument(documentRef);
    const location = getLocation(locationRef);

    if (!documentToAnalyze) {
      return createEmptyResult(location);
    }

    const products = [];
    const scripts = getJsonLdScripts(documentToAnalyze);
    const jsonLdValues = [];

    scripts.forEach((script) => {
      const parsed = parseJsonLdScript(script);

      if (parsed !== null) {
        jsonLdValues.push(parsed);
        products.push(...findProductNodes(parsed));
      }
    });

    const product = chooseProduct(products, {
      isEditorialPage: isEditorialPage(jsonLdValues, documentToAnalyze),
    });

    if (!product) {
      return createEmptyResult(location);
    }

    return normalizeProduct(product, location);
  }

  function isHttpOrHttps(locationRef) {
    const location = getLocation(locationRef);
    return location && (location.protocol === "http:" || location.protocol === "https:");
  }

  const api = {
    detectProductFromPage,
    detectProduct: detectProductFromPage,
    isPossibleProductPage: isHttpOrHttps,
  };

  if (typeof window !== "undefined") {
    window.detectProductFromPage = detectProductFromPage;
    window.productDetector = {
      ...(window.productDetector || {}),
      ...api,
    };
  }
})();
