# Recorrido de la vista Calefacción con capturas en shots/: python3 tools/calefaccion.py d|m [pasos]
import asyncio, sys, os, pathlib
ROOT = pathlib.Path(__file__).resolve().parent.parent
URL_DOC = (ROOT / "docs" / "index.html").as_uri()
os.makedirs(ROOT / "shots", exist_ok=True)
from playwright.async_api import async_playwright
async def main(dev, steps):
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=os.environ.get("CHROME", "/usr/bin/google-chrome"), args=["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader","--ignore-gpu-blocklist"])
        ctx = await b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True) if dev == 'm' else await b.new_context(viewport={"width": 1440, "height": 900})
        pg = await ctx.new_page(); errs = []
        pg.on("console", lambda m: errs.append(m.text[:300]) if m.type == 'error' and 'TUNNEL' not in m.text else None)
        pg.on("pageerror", lambda e: errs.append('[pageerror] ' + str(e)[:400]))
        await pg.goto(URL_DOC); await pg.wait_for_timeout(2500)
        async def shot(n): await pg.screenshot(path=str(ROOT / "shots" / f"cal_{dev}_{n}.png"))
        js = pg.evaluate
        await js("document.querySelector('#modebar [data-mode=cal]').click()"); await pg.wait_for_timeout(2500); await shot('1_iso')
        if 'modos' in steps or 'all' in steps:
            for v in ['cara', 'bi', 'vidrio']:
                await js(f"document.querySelector('#tb-hmode [data-v={v}]').click()"); await pg.wait_for_timeout(1200); await shot('2_' + v)
            await js("document.querySelector('#tb-hmode [data-v=pies]').click()")
            await js("document.querySelector('#tb-hair [data-v=ext]').click()"); await pg.wait_for_timeout(1200); await shot('3_exterior')
        if 'cut' in steps or 'all' in steps:
            await js("document.querySelector('#tb-bcut [data-v=in]').click()"); await pg.wait_for_timeout(400)
            for v in ['caja', 'mandos', 'admision', 'cabina']:
                await js(f"window.__viewer.setView('{v}', true)"); await pg.wait_for_timeout(1300); await shot('4_' + v)
        if 'fail' in steps or 'all' in steps:
            await js("window.__viewer.setView('iso', true)")
            for f in ['resistencia', 'llave']:
                await js(f"document.querySelector('#tb-hfail [data-v={f}]').click()"); await pg.wait_for_timeout(1000); await shot('5_' + f)
        print(await js("JSON.stringify(window.__viewer.debugStats())"))
        print("\n".join(errs) or "sin errores")
        await b.close()
asyncio.run(main(sys.argv[1], sys.argv[2:] or ['all']))
