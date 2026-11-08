// Arma docs/index.html: un solo archivo que funciona sin internet (JavaScript, tipografías y
// código fuente adentro). Uso: npm install && npm run build
import { build } from 'esbuild';
import { readFileSync, writeFileSync, readdirSync, statSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { gzipSync } from 'zlib';

const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const VERSION = pkg.version.split('.')[0], FECHA = process.env.FECHA || new Date().toISOString().slice(0, 10);

const r = await build({ entryPoints: ['src/main.js'], bundle: true, minify: true, format: 'iife', target: ['es2020'], write: false, legalComments: 'eof', logLevel: 'warning' });
const js = r.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');

// tipografías (licencia OFL, ver fonts/) incrustadas como data URI
const FONTS = [
  ['Barlow Condensed', 500, 'normal', 'barlow-condensed-latin-500-normal'], ['Barlow Condensed', 600, 'normal', 'barlow-condensed-latin-600-normal'],
  ['Barlow Condensed', 700, 'normal', 'barlow-condensed-latin-700-normal'], ['Barlow', 400, 'normal', 'barlow-latin-400-normal'],
  ['Barlow', 400, 'italic', 'barlow-latin-400-italic'], ['Barlow', 500, 'normal', 'barlow-latin-500-normal'], ['Barlow', 600, 'normal', 'barlow-latin-600-normal'],
  ['IBM Plex Mono', 400, 'normal', 'ibm-plex-mono-latin-400-normal'], ['IBM Plex Mono', 500, 'normal', 'ibm-plex-mono-latin-500-normal'],
];
const fontCSS = FONTS.map(([fam, w, st, f]) => `/*fonts/${f}.woff2*/@font-face{font-family:"${fam}";font-style:${st};font-weight:${w};font-display:swap;src:url(data:font/woff2;base64,${readFileSync(join('fonts', f + '.woff2')).toString('base64')}) format("woff2")}`).join('\n');

// código fuente completo dentro del mismo archivo: con sólo el .html se puede reconstruir y actualizar
const files = {};
const add = p => { if (!existsSync(p)) return; if (statSync(p).isDirectory()) { for (const n of readdirSync(p).sort()) add(join(p, n)); return; }
  if (p.endsWith('.woff2') || p.includes('__pycache__')) return;                     // las tipografías ya van en el CSS del mismo archivo
  files[p] = /\.(png|jpg)$/.test(p) ? { b64: readFileSync(p).toString('base64') } : readFileSync(p, 'utf8'); };
['README.md', 'package.json', 'package-lock.json', 'build.mjs', 'index.template.html', '.gitignore', 'src', 'fonts', 'tools'].forEach(add);
const fuente = gzipSync(Buffer.from(JSON.stringify({ version: VERSION, fecha: FECHA, files })), { level: 9 }).toString('base64');

const out = readFileSync('index.template.html', 'utf8')
  .replace('/*FONTS*/', () => fontCSS)
  .replace('/*APPCSS*/', () => readFileSync('src/styles/app.css', 'utf8'))
  .replace('/*DIAGCSS*/', () => readFileSync('src/styles/diagramas.css', 'utf8'))
  .replace('<!--APP-->', () => `<script>\n${js}\n</script>`)
  .replace('<!--FUENTE-->', () => `<script type="application/gzip" id="codigo-fuente" data-formato="json+gzip+base64" data-version="${VERSION}">${fuente}</script>`)
  .replaceAll('{{VERSION}}', VERSION).replaceAll('{{FECHA}}', FECHA).replaceAll('{{SITIO}}', pkg.homepage || '');
mkdirSync('docs', { recursive: true });
writeFileSync('docs/index.html', out);
console.log(`docs/index.html · versión ${VERSION} (${FECHA}) · ${(out.length / 1024).toFixed(0)} KB · fuente ${Object.keys(files).length} archivos`);
