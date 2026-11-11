# Recorrido de la vista Alimentación con capturas en shots/: python3 tools/alimentacion.py d|m
import asyncio, sys, os, pathlib
ROOT = pathlib.Path(__file__).resolve().parent.parent
URL_DOC = (ROOT / "docs" / "index.html").as_uri()
os.makedirs(ROOT / "shots", exist_ok=True)
from playwright.async_api import async_playwright
async def main(dev):
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=os.environ.get("CHROME", "/usr/bin/google-chrome"), args=["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader","--ignore-gpu-blocklist"])
        ctx = await b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True) if dev == 'm' else await b.new_context(viewport={"width": 1440, "height": 900})
        pg = await ctx.new_page(); errs = []
        pg.on("console", lambda m: errs.append(m.text[:300]) if m.type == 'error' and 'TUNNEL' not in m.text else None)
        pg.on("pageerror", lambda e: errs.append('[pageerror] ' + str(e)[:400]))
        await pg.goto(URL_DOC); await pg.wait_for_timeout(2500)
        async def shot(n): await pg.screenshot(path=str(ROOT / "shots" / f"ali_{dev}_{n}.png"))
        js = pg.evaluate
        await js("window.__app.openSys('combustible')"); await pg.wait_for_timeout(2600); await shot('1_iso')
        await js("document.querySelector('#tb-bcut [data-v=in]').click()")
        for v in ['carb', 'palancas', 'estanque', 'pedal']:
            await js(f"window.__viewer.setView('{v}', true)"); await pg.wait_for_timeout(1300); await shot('2_' + v)
        await js("window.__viewer.setView('carb', true)")
        for a in ['20', '100']:
            await js(f"document.querySelector('#tb-accseg [data-v=\"{a}\"]').click()"); await pg.wait_for_timeout(1500); await shot('3_acel' + a)
        await js("document.querySelector('#tb-accseg [data-v=\"0\"]').click()")
        await js("document.querySelector('#tb-feng [data-v=frio]').click(); const c = document.querySelector('#tb-choke'); c.value = 100; c.dispatchEvent(new Event('input'))"); await pg.wait_for_timeout(1500); await shot('4_ahogador')
        print(await js("document.querySelector('#alihud').innerText.replace(/\\n+/g, ' | ')"))
        await js("const c = document.querySelector('#tb-choke'); c.value = 0; c.dispatchEvent(new Event('input')); document.querySelector('#tb-feng [data-v=caliente]').click()")
        for f in ['aguja', 'solenoide', 'filtro']:
            await js(f"document.querySelector('#tb-ffail [data-v={f}]').click()"); await js("document.querySelector('#tb-accseg [data-v=\"" + ('100' if f == 'filtro' else '0') + "\"]').click()"); await pg.wait_for_timeout(1400); await shot('5_' + f)
            print(f, await js("document.querySelector('#alihud').innerText.replace(/\\n+/g, ' | ')"))
        print(await js("JSON.stringify(window.__viewer.debugStats())"))
        print("\n".join(errs) or "sin errores")
        await b.close()
asyncio.run(main(sys.argv[1]))
