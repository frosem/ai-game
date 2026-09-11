#!/usr/bin/env bash
# Serve the game locally. ES modules require HTTP; file:// will not work.
set -euo pipefail
PORT="${1:-8080}"
echo "http://localhost:$PORT"
exec python3 -m http.server "$PORT"