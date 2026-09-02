#!/usr/bin/env node
"use strict";
const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const UPLOADS = path.join(ROOT, "uploads");
const PORT = Number(process.env.PORT || 8080);

function safeName(name) {
  const base = path.basename(String(name || "untitled")).replace(/[^\w.\- ]+/g, "_").trim();
  return (base || "untitled").slice(0, 180);
}

function fileType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const map = {
    ".pdf": "PDF",
    ".doc": "Word",
    ".docx": "Word",
    ".pages": "Pages",
    ".xls": "Spreadsheet",
    ".xlsx": "Spreadsheet",
    ".csv": "Spreadsheet",
    ".png": "Image",
    ".jpg": "Image",
    ".jpeg": "Image",
    ".gif": "Image",
    ".webp": "Image",
    ".txt": "Text",
    ".md": "Text"
  };
  return map[ext] || (ext.replace(".", "").toUpperCase() || "file");
}

function formatSize(n) {
  if (n < 1024) return n + " bytes";
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + " KB";
  return (n / (1024 * 1024)).toFixed(1) + " MB";
}

function listUploads() {
  fs.mkdirSync(UPLOADS, { recursive: true });
  return fs
    .readdirSync(UPLOADS)
    .filter((n) => !n.startsWith("."))
    .map((n) => {
      const p = path.join(UPLOADS, n);
      const st = fs.statSync(p);
      if (!st.isFile()) return null;
      return { name: n, type: fileType(p), size: formatSize(st.size) };
    })
    .filter(Boolean)
    .sort((a, b) => a.name.localeCompare(b.name));
}

const mime = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".pdf": "application/pdf",
  ".ico": "image/x-icon"
};

function send(res, code, body, type) {
  const buf = Buffer.isBuffer(body) ? body : Buffer.from(String(body));
  res.writeHead(code, { "Content-Type": type || "text/plain", "Content-Length": buf.length, "Cache-Control": "no-store" });
  res.end(buf);
}

function sendJson(res, code, obj) {
  send(res, code, JSON.stringify(obj), "application/json; charset=utf-8");
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://127.0.0.1");
  if (req.method === "GET" && url.pathname === "/api/uploads") {
    return sendJson(res, 200, { files: listUploads() });
  }
  if (req.method === "POST" && url.pathname === "/api/uploads") {
    const chunks = [];
    let total = 0;
    req.on("data", (c) => {
      total += c.length;
      if (total > 40 * 1024 * 1024) {
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => {
      try {
        const payload = JSON.parse(Buffer.concat(chunks).toString("utf8"));
        fs.mkdirSync(UPLOADS, { recursive: true });
        const saved = [];
        for (const item of payload.files || []) {
          const name = safeName(item.name);
          const data = Buffer.from(item.data || "", "base64");
          fs.writeFileSync(path.join(UPLOADS, name), data);
          saved.push(name);
        }
        sendJson(res, 200, { saved, files: listUploads() });
      } catch (e) {
        sendJson(res, 400, { error: "Could not read upload." });
      }
    });
    return;
  }
  if (req.method !== "GET") {
    return send(res, 405, "Method not allowed");
  }
  let rel = decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname);
  rel = rel.replace(/^\/+/, "");
  if (rel.split("/").includes("..")) return send(res, 400, "Bad path");
  const filePath = path.resolve(ROOT, rel);
  if (!filePath.startsWith(ROOT) || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    return send(res, 404, "Not found");
  }
  const type = mime[path.extname(filePath).toLowerCase()] || "application/octet-stream";
  send(res, 200, fs.readFileSync(filePath), type);
});

fs.mkdirSync(UPLOADS, { recursive: true });
server.listen(PORT, "127.0.0.1", () => {
  console.log("Dashboard: http://localhost:" + PORT);
  console.log("Leave this window open. Press Ctrl+C to stop.");
});
