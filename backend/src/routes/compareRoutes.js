const { createMockComparison } = require("../services/mockCompareService");
const { normalizeProduct } = require("../utils/normalizeProduct");

const MAX_BODY_SIZE = 1024 * 1024;

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
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

  const product = normalizeProduct(body);

  if (!product.name) {
    sendJson(response, 400, {
      error: "validation_error",
      message: "Field name is required.",
    });
    return;
  }

  sendJson(response, 200, createMockComparison(product));
}

module.exports = {
  handleCompareRequest,
};
