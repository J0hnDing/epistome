import { createReadStream, existsSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { AGENT_GUIDE } from "./agent-guide.js";
import { AGENT_TOOLS } from "./agent-tools.js";
import { openDatabase } from "./database.js";
import { AppError, badRequest } from "./errors.js";
import { KnowledgeBase } from "./knowledge-base.js";
import { OPENAPI_SPEC } from "./openapi.js";

const projectRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const publicRoot = join(projectRoot, "public");
const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml"
};

function sendJson(response, status, value) {
  const body = JSON.stringify(value);
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store"
  });
  response.end(body);
}

async function readJson(request, { maxLength = 1_000_000 } = {}) {
  let body = "";
  let receivedLength = 0;
  for await (const chunk of request) {
    receivedLength += typeof chunk === "string" ? Buffer.byteLength(chunk) : chunk.length;
    body += chunk;
    if (receivedLength > maxLength) throw badRequest("body_too_large", "Request body is too large.");
  }
  if (!body) return {};
  try {
    return JSON.parse(body);
  } catch {
    throw badRequest("invalid_json", "Request body must be valid JSON.");
  }
}

function parseId(value) {
  const id = Number(value);
  if (!Number.isInteger(id) || id < 1) throw badRequest("invalid_id", "Resource id must be a positive integer.");
  return id;
}

function serveStatic(request, response, pathname) {
  const requested = pathname === "/" ? "index.html" : pathname.slice(1);
  const filePath = normalize(join(publicRoot, requested));
  if (!filePath.startsWith(publicRoot) || !existsSync(filePath)) return false;

  response.writeHead(200, {
    "Content-Type": contentTypes[extname(filePath)] ?? "application/octet-stream",
    "Cache-Control": "no-cache"
  });
  createReadStream(filePath).pipe(response);
  return true;
}

export function createApp({
  databasePath = join(projectRoot, "data", "knowledge.sqlite"),
  seedInitialTaxonomy = true
} = {}) {
  const database = openDatabase(databasePath, { seed: seedInitialTaxonomy });
  const knowledgeBase = new KnowledgeBase(database);

  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url, "http://localhost");
      const { pathname } = url;
      const method = request.method;

      if (method === "GET" && pathname === "/api/health") {
        return sendJson(response, 200, { status: "ok" });
      }
      if (method === "GET" && pathname === "/api/openapi.json") {
        return sendJson(response, 200, OPENAPI_SPEC);
      }
      if (method === "GET" && pathname === "/api/agent/guide") {
        return sendJson(response, 200, AGENT_GUIDE);
      }
      if (method === "GET" && pathname === "/api/agent/tools") {
        return sendJson(response, 200, {
          project: "Epistome",
          guide_url: "/api/agent/guide",
          openapi_url: "/api/openapi.json",
          tools: AGENT_TOOLS
        });
      }
      if (method === "POST" && pathname === "/api/agent/search_knowledge") {
        return sendJson(response, 200, {
          results: knowledgeBase.searchKnowledge(await readJson(request))
        });
      }
      if (method === "POST" && pathname === "/api/agent/list_frontier_nodes") {
        return sendJson(response, 200, knowledgeBase.listFrontierNodes(await readJson(request)));
      }
      if (method === "POST" && pathname === "/api/agent/get_knowledge_node") {
        return sendJson(response, 200, knowledgeBase.getKnowledgeNode(await readJson(request)));
      }
      if (method === "POST" && pathname === "/api/agent/establish_known_node") {
        return sendJson(response, 200, knowledgeBase.establishKnownNode(await readJson(request)));
      }
      if (method === "POST" && pathname === "/api/agent/update_known_node") {
        return sendJson(response, 200, knowledgeBase.updateKnownNode(await readJson(request)));
      }
      if (method === "GET" && pathname === "/api/tree") {
        return sendJson(response, 200, { branches: knowledgeBase.getTree() });
      }
      if (method === "GET" && pathname === "/api/export") {
        return sendJson(response, 200, knowledgeBase.exportKnowledgeBase());
      }
      if (method === "POST" && pathname === "/api/import") {
        const snapshot = await readJson(request, { maxLength: 50 * 1024 * 1024 });
        return sendJson(response, 200, { imported: knowledgeBase.importKnowledgeBase(snapshot) });
      }
      if (method === "POST" && pathname === "/api/clear") {
        return sendJson(response, 200, { cleared: knowledgeBase.clearKnowledge() });
      }
      if (method === "GET" && pathname === "/api/nodes") {
        return sendJson(response, 200, { nodes: knowledgeBase.listNodes() });
      }
      if (method === "POST" && pathname === "/api/nodes") {
        return sendJson(response, 201, { node: knowledgeBase.createNode(await readJson(request)) });
      }
      if (method === "POST" && pathname === "/api/connections") {
        return sendJson(response, 201, { connection: knowledgeBase.createConnection(await readJson(request)) });
      }

      const nodeMatch = pathname.match(/^\/api\/nodes\/(\d+)$/);
      if (nodeMatch && method === "GET") {
        return sendJson(response, 200, { node: knowledgeBase.getNode(parseId(nodeMatch[1])) });
      }
      if (nodeMatch && method === "PATCH") {
        return sendJson(response, 200, { node: knowledgeBase.updateNode(parseId(nodeMatch[1]), await readJson(request)) });
      }
      if (nodeMatch && method === "DELETE") {
        knowledgeBase.deleteNode(parseId(nodeMatch[1]));
        response.writeHead(204).end();
        return;
      }

      const connectionMatch = pathname.match(/^\/api\/connections\/(\d+)$/);
      if (connectionMatch && method === "DELETE") {
        knowledgeBase.deleteConnection(parseId(connectionMatch[1]));
        response.writeHead(204).end();
        return;
      }

      if (method === "GET" && serveStatic(request, response, pathname)) return;
      sendJson(response, 404, { error: { code: "not_found", message: "Route not found." } });
    } catch (error) {
      if (error instanceof AppError) {
        return sendJson(response, error.status, {
          error: { code: error.code, message: error.message, details: error.details }
        });
      }
      console.error(error);
      sendJson(response, 500, { error: { code: "internal_error", message: "An unexpected error occurred." } });
    }
  });

  return {
    server,
    knowledgeBase,
    close() {
      return new Promise((resolveClose, rejectClose) => {
        if (!server.listening) {
          knowledgeBase.close();
          return resolveClose();
        }
        server.close((error) => {
          knowledgeBase.close();
          if (error) rejectClose(error);
          else resolveClose();
        });
      });
    }
  };
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const port = Number(process.env.PORT ?? 3000);
  const host = process.env.HOST ?? "127.0.0.1";
  const databasePath = process.env.DATABASE_PATH ?? join(projectRoot, "data", "knowledge.sqlite");
  const app = createApp({ databasePath });
  app.server.listen(port, host, () => {
    console.log(`Epistome is running at http://${host}:${port}`);
    console.log(`Database: ${databasePath}`);
  });

  const shutdown = async () => {
    await app.close();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}
