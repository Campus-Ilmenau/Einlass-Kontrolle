#!/bin/bash
# Lädt Tesseract.js (Bibliothek, WASM-Kern, englische Sprachdaten) nach public/vendor/,
# damit die Testseite komplett offline vom Pi ausgeliefert werden kann.
set -euo pipefail

TESSERACT_VERSION=7.0.0
CORE_VERSION=7.0.0
LANG_VERSION=1.0.0

DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
OUT="$DIR/public/vendor/tesseract"
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

cd "$TMP"
npm pack -q "tesseract.js@$TESSERACT_VERSION" "tesseract.js-core@$CORE_VERSION" "@tesseract.js-data/eng@$LANG_VERSION" >/dev/null
for f in *.tgz; do
  mkdir -p "x/${f%.tgz}"
  tar -xzf "$f" -C "x/${f%.tgz}"
done

rm -rf "$OUT"
mkdir -p "$OUT/core" "$OUT/lang"
cp "x/tesseract.js-$TESSERACT_VERSION/package/dist/tesseract.min.js" "$OUT/"
cp "x/tesseract.js-$TESSERACT_VERSION/package/dist/worker.min.js" "$OUT/"
cp "x/tesseract.js-core-$CORE_VERSION/package/"tesseract-core*.{js,wasm} "$OUT/core/"
cp "x/tesseract.js-data-eng-$LANG_VERSION/package/4.0.0_best_int/eng.traineddata.gz" "$OUT/lang/"
echo "Vendor-Dateien in $OUT:"
du -sh "$OUT"
