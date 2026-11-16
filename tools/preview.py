# Genera docs/preview.png (1200×630), la imagen de vista previa del sitio.
# Uso: python3 tools/preview.py  (después de npm run build)
# Misma identidad que la página: el furgón sobre el azul del forro de la carga
# y, a la derecha, la hoja del manual con el sello COOL–HOT y el título.
import asyncio, base64, os, pathlib
from playwright.async_api import async_playwright
ROOT = pathlib.Path(__file__).resolve().parent.parent
DOC = (ROOT / 'docs' / 'index.html').as_uri()
CAM = "{pos:[5.2,2.05,-4.9], target:[-0.62,0.8,0.0], fov:26.5, w:660, h:630, bg:null}"
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
img{{position:absolute;left:0;top:0;width:660px;height:630px}}
.pp{{position:absolute;left:660px;right:0;top:0;bottom:0;background:#f6f6f3;border-left:2px solid #15171a;padding:0 52px 0 54px;color:#15171a;display:flex;flex-direction:column;justify-content:center}}
.mk{{width:76px;height:40px;background:linear-gradient(129deg,#2fa8e8 50%,#f2b8b5 50%);border-radius:3px;margin-bottom:38px}}
.k{{font-size:35px;font-weight:540;line-height:1.15;color:#3b3f45;margin:0 0 10px}}
h1{{font-weight:780;font-stretch:102%;font-size:66px;line-height:0.98;letter-spacing:-.018em;word-spacing:.05em;margin:0;white-space:nowrap}}
</style></head><body>
<img src="{van}">
<div class="pp"><span class="mk"></span><p class="k">Modelo 3D interactivo</p><h1>Super Carry<br>1000cc</h1></div>
</body></html>"""
        pg2 = await (await b.new_context(viewport={"width": 1200, "height": 630})).new_page()
        await pg2.set_content(html); await pg2.wait_for_timeout(800)
        await pg2.screenshot(path=str(ROOT / 'docs' / 'preview.png'))
        await b.close()
        print('docs/preview.png listo')
asyncio.run(main())
