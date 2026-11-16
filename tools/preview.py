# Genera docs/preview.png (1200×630), la imagen de vista previa del sitio.
# Uso: python3 tools/preview.py  (después de npm run build)
# Misma identidad que la página: plástico del tablero arriba, escenario azul
# del forro de la carga, y la hoja del manual a la derecha.
import asyncio, base64, os, pathlib
from playwright.async_api import async_playwright
ROOT = pathlib.Path(__file__).resolve().parent.parent
DOC = (ROOT / 'docs' / 'index.html').as_uri()
CAM = "{pos:[5.2,2.05,-4.9], target:[-0.55,0.86,0.05], fov:29, w:724, h:566, bg:null}"
GRAIN = ("url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'>"
         "<filter id='n'><feTurbulence type='fractalNoise' baseFrequency='1.15' numOctaves='2' stitchTiles='stitch'/>"
         "<feColorMatrix values='0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.07 0'/></filter>"
         "<rect width='100%' height='100%' filter='url(%23n)'/></svg>\")")
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=os.environ.get("CHROME", "/usr/bin/google-chrome"), args=["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader","--ignore-gpu-blocklist"])
        pg = await (await b.new_context(viewport={"width": 1360, "height": 900})).new_page()
        await pg.goto(DOC); await pg.wait_for_timeout(2500)
        await pg.evaluate("window.__viewer.isRunning() && document.querySelector('#tb-run').click()")
        await pg.wait_for_timeout(500)
        van = await pg.evaluate(f"window.__viewer.debugPersp({CAM})")
        f = lambda n: base64.b64encode((ROOT / 'fonts' / n).read_bytes()).decode()
        html = f"""<html><head><style>
@font-face{{font-family:A;font-weight:100 900;font-stretch:62% 125%;src:url(data:font/woff2;base64,{f('archivo-latin-wdth-normal.woff2')})}}
body{{margin:0;width:1200px;height:630px;overflow:hidden;position:relative;background:#2a3550;font-family:A}}
.top{{position:absolute;left:0;right:0;top:0;height:64px;background:{GRAIN} #2e3034;border-bottom:1px solid #121315;display:flex;align-items:center;gap:16px;padding:0 34px}}
.mk{{width:46px;height:24px;background:linear-gradient(129deg,#2fa8e8 50%,#f2b8b5 50%);border-radius:2px}}
.b1{{font-weight:700;font-size:25px;font-stretch:120%;color:#f2f3ef;letter-spacing:-.005em}}
.b3{{font-size:17px;color:#a9aeb5;padding-left:16px;border-left:1px solid #4a4e55}}
img{{position:absolute;left:0;top:64px;width:724px;height:566px}}
.pp{{position:absolute;left:724px;right:0;top:64px;bottom:0;background:#f6f6f3;border-left:2px solid #15171a;padding:40px 42px 0 40px;color:#15171a}}
h1{{font-weight:760;font-stretch:106%;font-size:41px;line-height:1.04;letter-spacing:-.015em;margin:0 0 18px;white-space:nowrap}}
p{{font-size:20px;line-height:1.42;color:#3b3f45;margin:0 0 26px}}
table{{width:100%;border-collapse:collapse;border-top:2px solid #15171a}}
td{{border-bottom:1px solid #d2d5d8;padding:9px 0 10px;font-size:17px;vertical-align:baseline}}
td:first-child{{color:#5f656e;width:112px}} td:last-child{{font-weight:650}}
</style></head><body>
<div class="top"><span class="mk"></span><span class="b1">Super Carry 1000</span><span class="b3">SK410 furgón 1996, motor F10A</span></div>
<img src="{van}">
<div class="pp"><h1>Super Carry 1000<br>por dentro</h1>
<p>El furgón en 3D, con motor, transmisión, frenos, calefacción y sensores en su lugar.</p>
<table><tr><td>Motor</td><td>F10A, 970 cm³</td></tr>
<tr><td>Caja</td><td>5 velocidades y reversa</td></tr>
<tr><td>Diferencial</td><td>5,125 : 1</td></tr>
<tr><td>Frenos</td><td>discos adelante, tambores atrás</td></tr></table></div>
</body></html>"""
        pg2 = await (await b.new_context(viewport={"width": 1200, "height": 630})).new_page()
        await pg2.set_content(html); await pg2.wait_for_timeout(800)
        await pg2.screenshot(path=str(ROOT / 'docs' / 'preview.png'))
        await b.close()
        print('docs/preview.png listo')
asyncio.run(main())
