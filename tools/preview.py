# Genera docs/preview.png (1200×630), la imagen que aparece al compartir el enlace y arriba del README.
# Uso: python3 tools/preview.py  (después de npm run build)
# Misma identidad que la página: el furgón en rayos X sobre el azul del forro de la carga, pintado por sistema,
# y a la derecha la hoja del manual con el sello COOL–HOT, el título, los datos del furgón y los sistemas que
# tienen vista propia, con el mismo color que llevan en el modelo.
import asyncio, base64, json, os, pathlib, subprocess
from playwright.async_api import async_playwright
ROOT = pathlib.Path(__file__).resolve().parent.parent
DOC = (ROOT / 'docs' / 'index.html').as_uri()
CAM = "{pos:[4.6,2.95,-5.5], target:[-0.66,0.74,0.0], fov:27.5, w:640, h:630, bg:null}"
VISTAS = ['motor', 'combustible', 'transmision', 'frenos', 'calefaccion', 'refrigeracion', 'electrico']   # los sistemas con vista propia
# nombres, colores y cantidad de piezas, desde los datos del modelo
DATA = json.loads(subprocess.run(['node', '-e', "import('./src/data.js').then(d => console.log(JSON.stringify({ n: Object.keys(d.PARTS).length, sys: d.SYSTEMS })))"],
                                 cwd=ROOT, capture_output=True, text=True, check=True).stdout)
SYS = {s['id']: s for s in DATA['sys']}
FICHA = [('Año', '1996'), ('Versión', 'Furgón SK410 (DA21V), volante a la izquierda'), ('Motor', 'F10A de 970 cm³ y 41 CV, con carburador')]

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=os.environ.get("CHROME", "/usr/bin/google-chrome"), args=["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader","--ignore-gpu-blocklist"])
        pg = await (await b.new_context(viewport={"width": 1360, "height": 900})).new_page()
        await pg.goto(DOC); await pg.wait_for_timeout(2500)
        await pg.evaluate("window.__viewer.isRunning() && document.querySelector('#tb-run').click()")
        await pg.evaluate("window.__viewer.setBody('ghost'); window.__viewer.setColorMode('sys')")   # rayos X, cada sistema con su color
        await pg.wait_for_timeout(600)
        van = await pg.evaluate(f"window.__viewer.debugPersp({CAM})")
        f = lambda n: base64.b64encode((ROOT / 'fonts' / n).read_bytes()).decode()
        filas = ''.join(f'<tr><td>{k}</td><td>{v}</td></tr>' for k, v in FICHA)
        chips = ''.join(f'<li style="--c:{SYS[s]["color"]}">{SYS[s]["short"]}</li>' for s in VISTAS)
        html = f"""<html><head><style>
@font-face{{font-family:A;font-weight:100 900;font-stretch:62% 125%;src:url(data:font/woff2;base64,{f('archivo-latin-wdth-normal.woff2')})}}
body{{margin:0;width:1200px;height:630px;overflow:hidden;position:relative;background:#2a3550;font-family:A}}
img{{position:absolute;left:0;top:0;width:640px;height:630px}}
.pp{{position:absolute;left:640px;right:0;top:0;bottom:0;background:#f6f6f3;border-left:2px solid #15171a;padding:0 46px 0 46px;color:#15171a;display:flex;flex-direction:column;justify-content:center}}
.k{{display:flex;align-items:center;gap:14px;font-size:25px;font-weight:540;color:#3b3f45;margin:0 0 12px}}
.mk{{width:46px;height:24px;background:linear-gradient(129deg,#2fa8e8 50%,#f2b8b5 50%);border-radius:2px;flex:none}}
h1{{font-weight:780;font-stretch:102%;font-size:62px;line-height:0.98;letter-spacing:-.018em;word-spacing:.05em;margin:0 0 26px;white-space:nowrap}}
table{{width:100%;border-collapse:collapse;border-top:2px solid #15171a;margin:0 0 22px}}
td{{border-bottom:1px solid #d2d5d8;padding:9px 0 10px;font-size:18px;line-height:1.25;vertical-align:baseline}}
td:first-child{{color:#5f656e;width:84px}} td:last-child{{font-weight:650}}
.v{{font-size:18px;color:#3b3f45;margin:0 0 10px}} .v b{{color:#15171a;font-weight:700}}
ul{{list-style:none;margin:0;padding:0;display:flex;flex-wrap:wrap;gap:7px 8px}}
li{{display:flex;align-items:center;gap:7px;font-size:16px;font-weight:600;padding:5px 10px 6px 9px;border:1px solid #c9cdd2;border-radius:3px;background:#fff}}
li::before{{content:"";width:10px;height:10px;border-radius:50%;background:var(--c)}}
</style></head><body>
<img src="{van}">
<div class="pp">
<p class="k"><span class="mk"></span>Modelo 3D interactivo</p>
<h1>Super Carry<br>1000cc</h1>
<table>{filas}</table>
<p class="v"><b>{DATA['n']} piezas</b> y {len(VISTAS)} sistemas que se abren en detalle, con el color que llevan en el modelo:</p>
<ul>{chips}</ul>
</div>
</body></html>"""
        pg2 = await (await b.new_context(viewport={"width": 1200, "height": 630})).new_page()
        await pg2.set_content(html); await pg2.wait_for_timeout(800)
        await pg2.screenshot(path=str(ROOT / 'docs' / 'preview.png'))
        await b.close()
        print('docs/preview.png listo')
asyncio.run(main())
