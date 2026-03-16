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
  echo "→ Restoring stashed directories..."
  for dir in "${API_DIRS[@]}"; do
    stash_name="${dir//\//_}"
    if [[ -d "$STASH_DIR/$stash_name" ]]; then
      mkdir -p "$ROOT/$(dirname "$dir")"
      mv "$STASH_DIR/$stash_name" "$ROOT/$dir"
    fi
  done
  # Restore other game dirs
  OTHER_GAMES=("run-horses" "minefield" "candy-catch")
  for g in "${OTHER_GAMES[@]}"; do
    stash_name="games_${g}"
    if [[ -d "$STASH_DIR/$stash_name" ]]; then
      mv "$STASH_DIR/$stash_name" "$ROOT/app/(games)/$g"
    fi
  done
  rm -rf "$STASH_DIR"
}

# Always restore on exit (even if build fails)
trap cleanup EXIT

echo "→ Stashing non-$GAME game directories and API routes..."
mkdir -p "$STASH_DIR"

# Stash API dirs
for dir in "${API_DIRS[@]}"; do
  if [[ -d "$ROOT/$dir" ]]; then
    stash_name="${dir//\//_}"
    mv "$ROOT/$dir" "$STASH_DIR/$stash_name"
    echo "  stashed: $dir"
  fi
done

# Stash other game dirs to avoid their dynamic routes breaking static export
OTHER_GAMES=("run-horses" "minefield" "candy-catch")
for g in "${OTHER_GAMES[@]}"; do
  if [[ "$g" != "$GAME" && -d "$ROOT/app/(games)/$g" ]]; then
    stash_name="games_${g}"
    mv "$ROOT/app/(games)/$g" "$STASH_DIR/$stash_name"
    echo "  stashed: app/(games)/$g"
  fi
done

echo "→ Building $GAME for CrazyGames..."
cd "$ROOT"
NEXT_PUBLIC_CRAZYGAMES=1 NEXT_PUBLIC_CRAZYGAMES_GAME="$GAME" npx next build

echo ""
ZIP_NAME="crazygames-$GAME.zip"
echo "→ Creating $ZIP_NAME..."
cd "$ROOT/out-crazygames"
zip -r "$ROOT/$ZIP_NAME" . -x "*.DS_Store"
cd "$ROOT"

echo ""
echo "✓ Build complete!"
echo "  ZIP: $ROOT/$ZIP_NAME"
echo "  Upload $ZIP_NAME to your CrazyGames game entry."
