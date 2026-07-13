const http = require("http");
const { URL } = require("url");
const { handleCompareRequest } = require("./routes/compareRoutes");

const DEFAULT_PORT = 3000;

function setCorsHeaders(response) {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function sendJson(response, statusCode, payload) {
  setCorsHeaders(response);
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
  });
  response.end(JSON.stringify(payload));
}

async function handleRequest(request, response) {
  setCorsHeaders(response);

  if (request.method === "OPTIONS") {
    response.writeHead(204);
    response.end();
    return;
  }

  const requestUrl = new URL(request.url, `http://${request.headers.host || "localhost"}`);

  if (request.method === "GET" && requestUrl.pathname === "/health") {
    sendJson(response, 200, { status: "ok" });
    return;
  }

  if (request.method === "POST" && requestUrl.pathname === "/compare") {
    await handleCompareRequest(request, response);
    return;
  }

  sendJson(response, 404, {
    error: "not_found",
    message: "Endpoint not found.",
  });
}

function createServer() {
  return http.createServer((request, response) => {
    handleRequest(request, response).catch(() => {
      sendJson(response, 500, {
        error: "internal_error",
        message: "Unexpected server error.",
      });
    });
  });
}

if (require.main === module) {
  const port = Number(process.env.PORT) || DEFAULT_PORT;
  const server = createServer();

  server.listen(port, () => {
    console.log(`Backend local rodando em http://localhost:${port}`);
  });
}

module.exports = {
  createServer,
};
