#!/usr/bin/env python3
"""Tiny local server for the Ontario report dashboard. Serves files and lists/saves uploads."""
from __future__ import annotations

import base64
import json
import mimetypes
import os
import re
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlparse

ROOT = Path(__file__).resolve().parent
UPLOADS = ROOT / "uploads"
PORT = int(os.environ.get("PORT", "8080"))
SAFE_NAME = re.compile(r"[^A-Za-z0-9._ -]+")


def safe_filename(name: str) -> str:
    name = os.path.basename(unquote(name)).strip().replace("\x00", "")
    name = SAFE_NAME.sub("_", name)
    return name[:180] or "untitled"


def file_type(path: Path) -> str:
    ext = path.suffix.lower()
    mapping = {
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
        ".md": "Text",
        ".pptx": "PowerPoint",
        ".ppt": "PowerPoint",
        ".mp4": "Video",
        ".mov": "Video",
    }
    return mapping.get(ext, ext.replace(".", "").upper() or "file")


def list_uploads() -> list[dict]:
    UPLOADS.mkdir(exist_ok=True)
    files = []
    for path in sorted(UPLOADS.iterdir(), key=lambda p: p.name.lower()):
        if not path.is_file() or path.name.startswith("."):
            continue
        size = path.stat().st_size
        if size < 1024:
            size_s = f"{size} bytes"
        elif size < 1024 * 1024:
            size_s = f"{size / 1024:.1f} KB"
        else:
            size_s = f"{size / (1024 * 1024):.1f} MB"
        files.append({"name": path.name, "type": file_type(path), "size": size_s})
    return files


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt: str, *args) -> None:
        print("[%s] " % self.log_date_time_string() + (fmt % args))

    def _json(self, code: int, payload: dict) -> None:
        data = json.dumps(payload).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        if parsed.path == "/api/uploads":
            self._json(200, {"files": list_uploads()})
            return
        rel = unquote(parsed.path.lstrip("/")) or "index.html"
        if ".." in rel.split("/"):
            self.send_error(400, "Bad path")
            return
        path = (ROOT / rel).resolve()
        if not str(path).startswith(str(ROOT)) or not path.is_file():
            self.send_error(404, "Not found")
            return
        ctype = mimetypes.guess_type(str(path))[0] or "application/octet-stream"
        data = path.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_POST(self) -> None:
        parsed = urlparse(self.path)
        if parsed.path != "/api/uploads":
            self.send_error(404, "Not found")
            return
        length = int(self.headers.get("Content-Length", "0") or 0)
        if length > 40 * 1024 * 1024:
            self._json(400, {"error": "File too large for this simple dashboard."})
            return
        raw = self.rfile.read(length)
        try:
            payload = json.loads(raw.decode("utf-8"))
        except Exception:
            self._json(400, {"error": "Could not read upload."})
            return
        UPLOADS.mkdir(exist_ok=True)
        saved = []
        for item in payload.get("files") or []:
            name = safe_filename(str(item.get("name") or "untitled"))
            try:
                data = base64.b64decode(item.get("data") or "", validate=False)
            except Exception:
                self._json(400, {"error": "Could not read file data."})
                return
            dest = UPLOADS / name
            dest.write_bytes(data)
            saved.append(name)
        self._json(200, {"saved": saved, "files": list_uploads()})


def main() -> None:
    UPLOADS.mkdir(exist_ok=True)
    httpd = ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    print(f"Dashboard: http://localhost:{PORT}")
    print("Leave this window open. Press Ctrl+C to stop.")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.")


if __name__ == "__main__":
    main()
