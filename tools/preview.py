# Genera docs/preview.png (1200×630), la imagen de vista previa del sitio.
# Uso: python3 tools/preview.py  (después de npm run build)
import asyncio, base64, io, os, pathlib
from playwright.async_api import async_playwright
ROOT = pathlib.Path(__file__).resolve().parent.parent
DOC = (ROOT / 'docs' / 'index.html').as_uri()
CAM = "{pos:[4.9,2.0,-4.6], target:[-0.95,0.92,0.0], fov:29, w:820, h:630, bg:'#efe5d3'}"
async def render(pg, body, color):
    await pg.goto(DOC); await pg.wait_for_timeout(2500)
    await pg.evaluate("window.__viewer.isRunning() && document.querySelector('#tb-run').click()")
    await pg.evaluate(f"document.querySelector('#tb-body [data-v={body}]').click()")
    await pg.evaluate(f"document.querySelector('#tb-color [data-v={color}]').click()"); await pg.wait_for_timeout(500)
    return await pg.evaluate(f"window.__viewer.debugPersp({CAM})")
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=os.environ.get("CHROME", "/usr/bin/google-chrome"), args=["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader","--ignore-gpu-blocklist"])
        pg = await (await b.new_context(viewport={"width": 1360, "height": 900})).new_page()
        van = await render(pg, 'solid', 'real')
        f = lambda n: base64.b64encode((ROOT / 'fonts' / n).read_bytes()).decode()
        html = f"""<html><head><style>
@font-face{{font-family:BC;font-weight:700;src:url(data:font/woff2;base64,{f('barlow-condensed-latin-700-normal.woff2')})}}
@font-face{{font-family:B;font-weight:400;src:url(data:font/woff2;base64,{f('barlow-latin-400-normal.woff2')})}}
@font-face{{font-family:M;font-weight:500;src:url(data:font/woff2;base64,{f('ibm-plex-mono-latin-500-normal.woff2')})}}
body{{margin:0;width:1200px;height:630px;background:#f4ebdd;overflow:hidden;position:relative}}
.st{{position:absolute;left:0;right:0;top:0;height:18px;background:linear-gradient(180deg,#c2412d 0 33.4%,#e3a72f 33.4% 66.7%,#1f5f6b 66.7%)}}
.dc{{position:absolute;left:64px;top:118px}}
img{{position:absolute;right:-30px;top:0;width:820px;height:630px}}
.t{{position:absolute;left:64px;top:168px;width:470px;color:#2a2420}}
.k{{font:500 18px M;letter-spacing:.12em;color:#c2412d;text-transform:uppercase}}
h1{{font:italic 700 80px/0.95 BC;margin:16px 0 22px;text-transform:uppercase}} h1 em{{color:#c2412d}}
p{{font:400 25px/1.35 B;color:#574c43;margin:0}}
.u{{position:absolute;left:64px;bottom:52px;font:500 17px M;color:#75685b;letter-spacing:.04em}}
</style></head><body><div class="st"></div><svg class="dc" width="76" height="44" viewBox="0 0 38 22"><path d="M8 0h8L8 22H0z" fill="#c2412d"/><path d="M19 0h8l-8 22h-8z" fill="#e3a72f"/><path d="M30 0h8l-8 22h-8z" fill="#1f5f6b"/></svg><img src="{van}"><div class="t"><div class="k">Modelo 3D interactivo</div><h1>Super Carry <em>1000</em> por dentro</h1>
<p>Suzuki SK410 1996: carrocería, motor F10A, sistemas y sensores, en 3D.</p></div><div class="u">Furgón SK410 · 5 velocidades · motor F10A</div></body></html>"""
        pg2 = await (await b.new_context(viewport={"width": 1200, "height": 630})).new_page()
        await pg2.set_content(html); await pg2.wait_for_timeout(800)
        await pg2.screenshot(path=str(ROOT / 'docs' / 'preview.png'))
        await b.close()
        print('docs/preview.png listo')
asyncio.run(main())
