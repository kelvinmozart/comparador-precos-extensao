const { compareProductPrices } = require("../services/compareService");

const MAX_BODY_SIZE = 1024 * 1024;
const LOG_PREFIX = "[backend][compare]";

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
  let body;

  try {
    body = await readJsonBody(request);
  } catch (error) {
    const statusCode = error.message === "body_too_large" ? 413 : 400;

    sendJson(response, statusCode, {
      error: error.message,
      message: error.message === "body_too_large"
        ? "Request body is too large."
        : "Request body must be valid JSON.",
    });
    return;
  }

  try {
    console.info(LOG_PREFIX, "Recebida requisição /compare.", {
      name: body?.name,
      brand: body?.brand,
      price: body?.price,
      currency: body?.currency,
    });

    const result = await compareProductPrices(body);

    console.info(LOG_PREFIX, "Resposta /compare gerada.", {
      results: Array.isArray(result.results) ? result.results.length : 0,
      provider: result.provider,
      cacheHit: result.cacheHit,
    });

    sendJson(response, 200, result);
  } catch (error) {
    console.error(LOG_PREFIX, "Erro ao processar /compare.", {
      message: error.message,
      stack: error.stack,
    });

    sendJson(response, 500, {
      error: "compare_failed",
      message: "Não foi possível buscar ofertas agora.",
    });
  }
}

module.exports = {
  handleCompareRequest,
};
