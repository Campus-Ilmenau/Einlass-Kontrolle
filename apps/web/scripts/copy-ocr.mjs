// Kopiert Tesseract.js (Worker, WASM-Kern, englische Sprachdaten) nach public/ocr/,
// damit die Texterkennung komplett offline vom Pi geladen wird (kein CDN).
import { cpSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const web = join(dirname(fileURLToPath(import.meta.url)), '..');
const nm = join(web, 'node_modules');
const out = join(web, 'public', 'ocr');

rmSync(out, { recursive: true, force: true });
mkdirSync(join(out, 'core'), { recursive: true });
mkdirSync(join(out, 'lang'), { recursive: true });

cpSync(join(nm, 'tesseract.js', 'dist', 'worker.min.js'), join(out, 'worker.min.js'));

// Nur die LSTM-Varianten (OEM 1) – die Legacy-Engine wird nicht genutzt
const core = join(nm, 'tesseract.js-core');
const files = readdirSync(core).filter((f) => /^tesseract-core.*lstm.*\.(js|wasm)$/.test(f));
for (const f of files) cpSync(join(core, f), join(out, 'core', f));

cpSync(
  join(nm, '@tesseract.js-data', 'eng', '4.0.0_best_int', 'eng.traineddata.gz'),
  join(out, 'lang', 'eng.traineddata.gz'),
);
console.log(`OCR-Dateien nach public/ocr kopiert (${files.length} Kern-Dateien)`);
