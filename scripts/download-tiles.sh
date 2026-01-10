#!/bin/bash
# Download mahjong tile images from FluffyStuff's public domain tile set

TILES_DIR="public/tiles"
BASE_URL="https://raw.githubusercontent.com/FluffyStuff/riichi-mahjong-tiles/master/Export/Regular"

mkdir -p "$TILES_DIR"

echo "Downloading tile images..."

# Back and Front
curl -sLo "$TILES_DIR/Back.png" "$BASE_URL/Back.png"
curl -sLo "$TILES_DIR/Front.png" "$BASE_URL/Front.png"

# Man (Characters) 1-9
for i in 1 2 3 4 5 6 7 8 9; do
  curl -sLo "$TILES_DIR/Man${i}.png" "$BASE_URL/Man${i}.png"
done

# Pin (Dots) 1-9
for i in 1 2 3 4 5 6 7 8 9; do
  curl -sLo "$TILES_DIR/Pin${i}.png" "$BASE_URL/Pin${i}.png"
done

# Sou (Bamboo) 1-9
for i in 1 2 3 4 5 6 7 8 9; do
  curl -sLo "$TILES_DIR/Sou${i}.png" "$BASE_URL/Sou${i}.png"
done

# Winds
curl -sLo "$TILES_DIR/Ton.png" "$BASE_URL/Ton.png"   # East
curl -sLo "$TILES_DIR/Nan.png" "$BASE_URL/Nan.png"   # South
curl -sLo "$TILES_DIR/Shaa.png" "$BASE_URL/Shaa.png" # West
curl -sLo "$TILES_DIR/Pei.png" "$BASE_URL/Pei.png"   # North

# Dragons
curl -sLo "$TILES_DIR/Chun.png" "$BASE_URL/Chun.png"   # Red
curl -sLo "$TILES_DIR/Hatsu.png" "$BASE_URL/Hatsu.png" # Green
curl -sLo "$TILES_DIR/Haku.png" "$BASE_URL/Haku.png"   # White

echo "Downloaded $(ls -1 "$TILES_DIR"/*.png 2>/dev/null | wc -l) tile images"
ls -la "$TILES_DIR"

