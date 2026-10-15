// Tiny sink for screenshot passes. The preview webview cannot always hand out
// a composited frame, so the page posts its own canvas here instead.
//
//   node tools/shot-server.mjs [outDir] [port]
//
// Only bound to loopback. Nothing is ever read back out.

import { createServer } from "node:http";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const outDir = path.resolve(process.argv[2] || "shots");
const port = Number(process.argv[3] || 5299);

await mkdir(outDir, { recursive: true });

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    res.writeHead(204, cors);
    res.end();
    return;
  }
  const url = new URL(req.url, `http://127.0.0.1:${port}`);
  if (req.method !== "POST" || url.pathname !== "/shot") {
    res.writeHead(404, cors);
    res.end("not found");
    return;
  }
  const name = (url.searchParams.get("name") || "shot").replace(/[^a-z0-9._-]/gi, "_");
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const body = Buffer.concat(chunks).toString("utf8");
  const base64 = body.replace(/^data:image\/\w+;base64,/, "");
  const file = path.join(outDir, `${name}.png`);
  try {
    await writeFile(file, Buffer.from(base64, "base64"));
    res.writeHead(200, { ...cors, "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, file }));
  } catch (err) {
    res.writeHead(500, { ...cors, "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: false, error: String(err) }));
  }
}).listen(port, "127.0.0.1", () => {
  console.log(`shot server on http://127.0.0.1:${port} writing to ${outDir}`);
});
