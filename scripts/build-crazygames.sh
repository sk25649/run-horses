#!/usr/bin/env bash
# build-crazygames.sh <game>
# Builds a static export for CrazyGames submission.
#
# Usage:
#   bash scripts/build-crazygames.sh candy-catch
#   bash scripts/build-crazygames.sh run-horses
#   bash scripts/build-crazygames.sh minefield
#
# What it does:
#   1. Temporarily moves API route directories out of the tree
#      (Next.js static export fails on routes that use server-only APIs)
#   2. Runs `next build` with CrazyGames env vars set
#   3. Restores the API directories
#   4. Output lands in out-crazygames/

set -euo pipefail

GAME="${1:-}"
if [[ -z "$GAME" ]]; then
  echo "Usage: bash scripts/build-crazygames.sh <run-horses|minefield|candy-catch>"
  exit 1
fi

if [[ "$GAME" != "run-horses" && "$GAME" != "minefield" && "$GAME" != "candy-catch" ]]; then
  echo "Unknown game: $GAME. Must be 'run-horses', 'minefield', or 'candy-catch'."
  exit 1
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
STASH_DIR="$ROOT/.api-stash"

# Directories containing API routes that are incompatible with static export
API_DIRS=(
  "app/(games)/run-horses/api"
  "app/(games)/minefield/api"
  "app/(games)/candy-catch/api"
)

cleanup() {
  echo "→ Restoring API directories..."
  for dir in "${API_DIRS[@]}"; do
    stash_name="${dir//\//_}"
    if [[ -d "$STASH_DIR/$stash_name" ]]; then
      mkdir -p "$ROOT/$(dirname "$dir")"
      mv "$STASH_DIR/$stash_name" "$ROOT/$dir"
    fi
  done
  rm -rf "$STASH_DIR"
}

# Always restore on exit (even if build fails)
trap cleanup EXIT

echo "→ Stashing API directories..."
mkdir -p "$STASH_DIR"
for dir in "${API_DIRS[@]}"; do
  if [[ -d "$ROOT/$dir" ]]; then
    stash_name="${dir//\//_}"
    mv "$ROOT/$dir" "$STASH_DIR/$stash_name"
    echo "  stashed: $dir"
  fi
done

echo "→ Building $GAME for CrazyGames..."
cd "$ROOT"
NEXT_PUBLIC_CRAZYGAMES=1 NEXT_PUBLIC_CRAZYGAMES_GAME="$GAME" next build

echo ""
echo "✓ Build complete. Output: out-poki/"
echo "  Upload the out-poki/ directory to CrazyGames developer portal."
