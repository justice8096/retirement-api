#!/usr/bin/env bash
# package-standalone.sh — Build and zip the dashboard for standalone distribution.
#
# Usage: bash tools/package-standalone.sh [--skip-build]
#
# Produces: retirement-dashboard-standalone.zip containing:
#   - All built dashboard files (HTML, JS, CSS, WASM, data)
#   - serve.js — a zero-dependency Node.js server with required COOP/COEP headers
#   - README.txt — quick-start instructions
#
# Recipients just need Node.js installed. Unzip and run: node serve.js

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DASHBOARD_DIR="$PROJECT_ROOT/dashboard"
DIST_DIR="$DASHBOARD_DIR/dist"
STAGING_DIR="$PROJECT_ROOT/.standalone-staging"
ZIP_NAME="retirement-dashboard-standalone.zip"
ZIP_PATH="$PROJECT_ROOT/$ZIP_NAME"

# --- Build dashboard (unless --skip-build) ---
if [[ "${1:-}" != "--skip-build" ]]; then
  echo "Building dashboard..."
  cd "$DASHBOARD_DIR"
  npm run build
  echo "Build complete."
else
  echo "Skipping build (using existing dist/)."
fi

if [[ ! -d "$DIST_DIR" ]]; then
  echo "ERROR: dist/ not found. Run without --skip-build first." >&2
  exit 1
fi

# --- Prepare staging directory ---
rm -rf "$STAGING_DIR"
mkdir -p "$STAGING_DIR"

# Copy dist contents (dereference symlinks so data files are real copies)
cp -rL "$DIST_DIR/." "$STAGING_DIR/"

# --- Create the embedded server ---
cat > "$STAGING_DIR/serve.js" << 'SERVEREOF'
const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = parseInt(process.env.PORT || "8080", 10);
const ROOT = __dirname;

const MIME = {
  ".html": "text/html",
  ".js":   "application/javascript",
  ".mjs":  "application/javascript",
  ".css":  "text/css",
  ".json": "application/json",
  ".wasm": "application/wasm",
  ".png":  "image/png",
  ".jpg":  "image/jpeg",
  ".svg":  "image/svg+xml",
  ".ico":  "image/x-icon",
  ".db":   "application/octet-stream",
};

const server = http.createServer((req, res) => {
  let url = decodeURIComponent(req.url.split("?")[0]);
  if (url === "/") url = "/index.html";

  const filePath = path.join(ROOT, url);

  // Prevent directory traversal
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      // SPA fallback — serve index.html for non-file routes
      if (err.code === "ENOENT" && !path.extname(url)) {
        fs.readFile(path.join(ROOT, "index.html"), (err2, html) => {
          if (err2) { res.writeHead(500); res.end("Server error"); return; }
          res.writeHead(200, headers("text/html"));
          res.end(html);
        });
        return;
      }
      res.writeHead(404);
      res.end("Not found");
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const mime = MIME[ext] || "application/octet-stream";
    res.writeHead(200, headers(mime));
    res.end(data);
  });
});

function headers(contentType) {
  return {
    "Content-Type": contentType,
    // Required for sql.js WASM (SharedArrayBuffer)
    "Cross-Origin-Opener-Policy": "same-origin",
    "Cross-Origin-Embedder-Policy": "require-corp",
    "Cache-Control": "no-cache",
  };
}

server.listen(PORT, () => {
  console.log(`Retirement Dashboard running at http://localhost:${PORT}`);
  console.log("Press Ctrl+C to stop.");
});
SERVEREOF

# --- Create README ---
cat > "$STAGING_DIR/README.txt" << 'READMEEOF'
Retirement Planning Dashboard — Standalone Package
===================================================

Requirements: Node.js 18+ (https://nodejs.org)

Quick Start:
  1. Unzip this archive
  2. Open a terminal in the unzipped folder
  3. Run:  node serve.js
  4. Open:  http://localhost:8080

Options:
  - Custom port:  PORT=3000 node serve.js

All data is self-contained. No internet connection required.
READMEEOF

# --- Create zip ---
rm -f "$ZIP_PATH"
cd "$STAGING_DIR"

if command -v zip &>/dev/null; then
  zip -r "$ZIP_PATH" . -x "*.DS_Store"
elif command -v powershell.exe &>/dev/null; then
  # Windows fallback using PowerShell
  powershell.exe -NoProfile -Command "Compress-Archive -Path '$(cygpath -w "$STAGING_DIR")\\*' -DestinationPath '$(cygpath -w "$ZIP_PATH")' -Force"
else
  echo "ERROR: No zip tool found. Install 'zip' or use PowerShell." >&2
  rm -rf "$STAGING_DIR"
  exit 1
fi

# --- Cleanup ---
rm -rf "$STAGING_DIR"

ZIP_SIZE=$(du -h "$ZIP_PATH" | cut -f1)
echo ""
echo "Done! Created: $ZIP_PATH ($ZIP_SIZE)"
echo "To test: unzip it somewhere, then run 'node serve.js'"
