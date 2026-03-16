#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
echo "→ Building all games for CrazyGames..."
echo ""
bash "$ROOT/scripts/build-crazygames.sh" candy-catch
echo ""
bash "$ROOT/scripts/build-crazygames.sh" run-horses
echo ""
bash "$ROOT/scripts/build-crazygames.sh" minefield
echo ""
echo "✓ All done! ZIPs ready to upload:"
echo "  $ROOT/crazygames-candy-catch.zip"
echo "  $ROOT/crazygames-run-horses.zip"
echo "  $ROOT/crazygames-minefield.zip"
