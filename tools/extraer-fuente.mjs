// Saca el código fuente que viene dentro del .html del modelo.
// Uso: node tools/extraer-fuente.mjs super-carry-1000.html [carpeta-destino]
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { gunzipSync } from 'zlib';
import { dirname, join } from 'path';
const [, , html, out = 'fuente-extraida'] = process.argv;
if (!html) { console.error('Uso: node tools/extraer-fuente.mjs archivo.html [carpeta]'); process.exit(1); }
const txt = readFileSync(html, 'utf8');
const m = txt.match(/<script type="application\/gzip" id="codigo-fuente"[^>]*>([A-Za-z0-9+/=]+)<\/script>/);
if (!m) { console.error('Este archivo no trae el código fuente adentro.'); process.exit(1); }
const { version, fecha, files } = JSON.parse(gunzipSync(Buffer.from(m[1], 'base64')).toString('utf8'));
// tipografías: vienen en el CSS del archivo, marcadas con su nombre
for (const [, name, b64] of txt.matchAll(/\/\*(fonts\/[\w.-]+\.woff2)\*\/@font-face\{[^}]*?base64,([A-Za-z0-9+/=]+)\)/g)) files[name] = { b64 };
for (const [p, v] of Object.entries(files)) { const dst = join(out, p); mkdirSync(dirname(dst), { recursive: true }); writeFileSync(dst, typeof v === 'string' ? v : Buffer.from(v.b64, 'base64')); }
console.log(`Versión ${version} (${fecha}): ${Object.keys(files).length} archivos en ${out}/ — luego: cd ${out} && npm install && npm run build`);
