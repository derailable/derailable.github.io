import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "dist");
const host = process.env.HOST || "127.0.0.1";
const port = Number(process.env.PORT || process.argv[2] || 3001);
const types = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpg": "image/jpeg",
  ".md": "text/markdown; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
};

function resolveRequest(requestUrl) {
  const pathname = decodeURIComponent(new URL(requestUrl, `http://${host}:${port}`).pathname);
  const target = path.resolve(root, pathname.replace(/^\/+/, ""));
  return target === root || target.startsWith(`${root}${path.sep}`) ? target : null;
}

const server = createServer(async (request, response) => {
  if (request.method !== "GET" && request.method !== "HEAD") {
    response.writeHead(405, { Allow: "GET, HEAD" });
    response.end();
    return;
  }

  try {
    let target = resolveRequest(request.url || "/");
    if (!target) throw Object.assign(new Error("Invalid path"), { code: "ENOENT" });
    if ((await stat(target)).isDirectory()) target = path.join(target, "index.html");

    const body = await readFile(target);
    response.writeHead(200, {
      "Cache-Control": "no-cache",
      "Content-Length": body.byteLength,
      "Content-Type": types[path.extname(target).toLowerCase()] || "application/octet-stream",
    });
    response.end(request.method === "HEAD" ? undefined : body);
  } catch (error) {
    const status = error.code === "ENOENT" || error.code === "ENOTDIR" ? 404 : 500;
    const body = Buffer.from(status === 404 ? "Not found\n" : "Server error\n");
    response.writeHead(status, {
      "Content-Length": body.byteLength,
      "Content-Type": "text/plain; charset=utf-8",
    });
    response.end(request.method === "HEAD" ? undefined : body);
  }
});

server.listen(port, host, () => {
  console.log(`Derailable is available at http://${host}:${port}`);
});

server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.error(
      `Port ${port} is already in use. Stop the existing server or run: npm run preview -- ${port + 1}`,
    );
    process.exit(1);
  }
  throw error;
});

process.on("SIGINT", () => server.close(() => process.exit(0)));
