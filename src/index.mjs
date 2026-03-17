import swaggerUi from "swagger-ui-express";
import express from "express";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";

import { server } from "./mcp-server.mjs";
import { PORT, SERVER_VERSION, SERVER_NAME } from "./constants.mjs";
import { requireAuth } from "./require-auth.mjs";
import { apiRouterV1 } from "./api-router-v1.mjs";
import { checkHealtDatabase } from "./database.mjs";
import { swaggerSpec } from "./swagger.mjs";
import { loadDatabaseFromGCS } from "./storage.mjs";
import { oauthRouter } from "./oauth-router.mjs";

console.log(`⚙️ Server name: ${SERVER_NAME}`);

console.log(`📘 Server version: ${SERVER_VERSION}`);

await loadDatabaseFromGCS();

checkHealtDatabase();

const app = express();

app.use(express.json());

app.use("/oauth", oauthRouter);

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.get('/openapi.json', (req, res) => {
  res.json(swaggerSpec);
});

app.use("/api/v1/", requireAuth, apiRouterV1);

const sseTransports = {};

app.get("/sse", requireAuth, async (req, res) => {
  try {
    const transport = new SSEServerTransport("/messages", res);
    sseTransports[transport.sessionId] = transport;

    console.log(`[SSE] open session ${transport.sessionId} from ${req.ip}`);
    res.on("close", () => {
      console.log(`[SSE] closed ${transport.sessionId}`);
      try { transport.close?.(); } catch { }
      delete sseTransports[transport.sessionId];
    });

    await server.connect(transport);
  } catch (err) {
    console.error("Error establishing SSE:", err);
    if (!res.headersSent) res.status(500).send("SSE init error");
  }
});

// POST /messages?sessionId=... → forward JSON-RPC
app.post("/messages", async (req, res) => {
  try {
    const sid = String(req.query.sessionId || "");
    const transport = sseTransports[sid];
    if (!sid || !transport) {
      console.warn(`[SSE] /messages missing or invalid sessionId: "${sid}"`);
      res.status(400).send("Bad request");
      return;
    }
    await transport.handlePostMessage(req, res, req.body);
  } catch (err) {
    console.error("SSE /messages error:", err);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: { code: -32603, message: String(err?.message || err) },
        id: null,
      });
    }
  }
});

// Health check
app.get("/", (req, res) => {
  res.status(200).json({
    ok: true,
    service: SERVER_NAME,
    version: SERVER_VERSION,
    endpoints: { sse: "/sse", messages: "/messages", "rest-api": "/api/v1/", "rest-api-docs": "/api-docs", "openapi-json": "/openapi.json", oauth: "/oauth" },
  });
});

// Start
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Listening on :${PORT}`);
  console.log(`📡 SSE: GET /sse  |  POST /messages?sessionId=...`);
  console.log(`🧑‍⚕️ CheckHealth: GET /`);
  console.log(`📚 Swagger: GET /api-docs`);
  console.log(`📋 OpenAPI: GET /openapi.json`);
  console.log(`🔍 Search: GET /api/v1/search?query=...`);
  console.log(`🎯 Fetch: GET /api/v1/fetch?id=`);
  console.log(`🔐 OAuth: GET /oauth/authorize, GET /oauth/callback, POST /oauth/token`);
});
