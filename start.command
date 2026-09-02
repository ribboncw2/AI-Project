#!/bin/bash
cd "$(dirname "$0")"
echo "Starting the report dashboard..."
echo "When you see a web address, open: http://localhost:8080"
echo "Leave this window open while you work."
echo ""
if command -v python3 >/dev/null 2>&1 && python3 -c "import http.server" >/dev/null 2>&1; then
  python3 server.py
else
  NODE=""
  if command -v node >/dev/null 2>&1; then
    NODE="node"
  elif [ -x "/Applications/Cursor.app/Contents/Resources/app/resources/helpers/node" ]; then
    NODE="/Applications/Cursor.app/Contents/Resources/app/resources/helpers/node"
  fi
  if [ -n "$NODE" ]; then
    "$NODE" server.js
  else
    echo "Could not start: Python or Node is needed. If macOS asks to install developer tools, choose Install, wait, then double-click this file again."
    read -r _
  fi
fi
