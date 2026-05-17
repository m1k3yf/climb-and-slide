#!/usr/bin/env bash
# Build script for Climb & Slide.
#
# What it does:
#   1. Compiles game.jsx (the React/JSX source) → game.js (plain ES2015) using Babel.
#      This is what ships to users — dropping the in-browser Babel transformer
#      saves ~3 MB and ~1.5 s of cold-load JIT compile time on mobile.
#   2. game.html / index.html should reference <script src="game.js"></script>
#      (already wired up — no per-build rewriting needed).
#
# When to run: after editing game.jsx, before pushing to GitHub. Or run on a
# pre-commit hook if you want it fully automatic.
#
# Requirements: Node 18+ and `npm install` once (installs @babel/cli + preset-react).
set -euo pipefail

cd "$(dirname "$0")"

if [ ! -d node_modules ]; then
  echo "→ Installing Babel toolchain (one-time)..."
  npm install --no-audit --no-fund --silent
fi

echo "→ Compiling game.jsx → game.js"
npx --no-install babel game.jsx \
  --presets=@babel/preset-react \
  --no-babelrc \
  --out-file game.js \
  --source-maps inline

# Sanity: did we produce a non-empty file?
if [ ! -s game.js ]; then
  echo "✗ Build failed — game.js is empty." >&2
  exit 1
fi

bytes=$(wc -c < game.js | tr -d ' ')
lines=$(wc -l < game.js | tr -d ' ')
echo "✓ game.js built — ${lines} lines, $((bytes / 1024)) KB"
echo "  Ready to commit & push."
