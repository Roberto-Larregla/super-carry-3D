# Recorrido de la vista Transmisión con capturas en shots/: python3 tools/transmision.py d|m
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
        async def shot(n): await pg.wait_for_timeout(700); await pg.screenshot(path=str(ROOT / "shots" / f"tra_{dev}_{n}.png"))
        js = pg.evaluate
        hud = "document.querySelector('#trahud').innerText.replace(/\\n+/g, ' | ')"
        fwd = lambda s: js(f"window.__viewer.debugDrive({s}) && 1")
        await js("window.__app.openSys('transmision')"); await pg.wait_for_timeout(2600); await shot('1_iso')
        for v in ['embrague', 'caja', 'selector', 'cardan', 'dif']:
            await js(f"window.__viewer.setView('{v}', true)"); await shot('2_' + v)
        await js("window.__viewer.setView('caja', true)")
        await js("document.querySelector('#tb-drive').click()"); await fwd(2)
        for g in ['1', '2', '3', '4', '5']:
            await js(f"document.querySelector('#tb-gear [data-v=\"{g}\"]').click()"); await js("const a = document.querySelector('#tb-dacc'); a.value = 70; a.dispatchEvent(new Event('input'))"); await fwd(6)
            print(g, await js(hud)); await shot('3_marcha' + g)
        await js("const a = document.querySelector('#tb-dacc'); a.value = 0; a.dispatchEvent(new Event('input')); document.querySelector('#tb-dstop').click()"); await fwd(12)
        await js("document.querySelector('#tb-dstop').click(); document.querySelector('#tb-gear [data-v=R]').click()"); await fwd(5); print('R', await js(hud)); await shot('4_atras')
        await js("document.querySelector('#tb-gear [data-v=N]').click()"); await fwd(6)
        await js("document.querySelector('#tb-turn [data-v=\"-1\"]').click(); document.querySelector('#tb-gear [data-v=\"1\"]').click(); window.__viewer.setView('dif', true)"); await fwd(5); print('curva', await js(hud)); await shot('5_curva')
        await js("document.querySelector('#tb-turn [data-v=\"0\"]').click(); document.querySelector('#tb-nogrip').click()"); await fwd(4); print('sin agarre', await js(hud)); await shot('6_sinagarre')
        await js("document.querySelector('#tb-nogrip').click(); window.__viewer.setView('embrague', true)")
        for f in ['disco', 'juego0', 'estirada', 'sincro', 'cruceta']:
            await js(f"document.querySelector('#tb-tfail [data-v={f}]').click()"); await js("document.querySelector('#tb-gear [data-v=\"2\"]').click()"); await fwd(5); print(f, await js(hud)); await shot('7_' + f)
            await js("document.querySelector('#tb-gear [data-v=\"1\"]').click()"); await fwd(4)
        print(await js("JSON.stringify(window.__viewer.debugStats())"))
        print("\n".join(errs) or "sin errores")
        await b.close()
asyncio.run(main(sys.argv[1]))
