const { compareProductPrices } = require("../services/compareService");
const logger = require("../utils/logger");

const MAX_BODY_SIZE = 1024 * 1024;

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Private-Network": "true",
    "Content-Type": "application/json; charset=utf-8",
  });
  response.end(JSON.stringify(payload));
}

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";

    request.on("data", (chunk) => {
      body += chunk;

      if (body.length > MAX_BODY_SIZE) {
        reject(new Error("body_too_large"));
        request.destroy();
      }
    });

    request.on("end", () => {
      if (!body.trim()) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(new Error("invalid_json"));
      }
    });

    request.on("error", reject);
  });
}

async function handleCompareRequest(request, response) {
  const requestId = logger.createRequestId();
  let body;

  try {
    body = await readJsonBody(request);
  } catch (error) {
    const statusCode = error.message === "body_too_large" ? 413 : 400;

    logger.warn("Corpo invalido recebido em /compare.", {
      requestId,
      error: error.message,
    });

    sendJson(response, statusCode, {
      requestId,
      error: error.message,
      message: error.message === "body_too_large"
        ? "Request body is too large."
        : "Request body must be valid JSON.",
    });
    return;
  }

  try {
    logger.info("Requisicao /compare recebida.", {
      requestId,
      name: body?.name,
      brand: body?.brand,
      price: body?.price,
      currency: body?.currency,
    });

    const result = await compareProductPrices(body, { requestId });

    logger.info("Resposta /compare enviada.", {
      requestId,
      results: Array.isArray(result.results) ? result.results.length : 0,
      provider: result.provider?.name,
      cacheHit: result.cacheHit,
    });

    sendJson(response, 200, result);
  } catch (error) {
    logger.error("Erro ao processar /compare.", {
      requestId,
      message: error.message,
    });

    sendJson(response, 500, {
      requestId,
      error: "compare_failed",
      message: "Nao foi possivel buscar ofertas agora.",
    });
  }
}

module.exports = {
  handleCompareRequest,
};
