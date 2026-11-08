# Recorrido de la interfaz con capturas en shots/: python3 tools/prueba.py d|m
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
        await pg.goto(URL_DOC); await pg.wait_for_timeout(3000)
        async def shot(n): await pg.screenshot(path=str(ROOT / "shots" / f"ui_{dev}_{n}.png"))
        tap = (lambda sel: pg.tap(sel)) if dev == 'm' else (lambda sel: pg.click(sel))
        # sistema frenos
        if dev == 'm': await tap('#tabbar [data-tab=sistemas]'); await pg.wait_for_timeout(500)
        await tap('.syscard[data-sys=frenos]'); await pg.wait_for_timeout(1400); await shot('1_frenos')
        await pg.evaluate("document.querySelector('#v-detail [data-jump=s-diag]').click()"); await pg.wait_for_timeout(900); await shot('2_frenos_diag')
        # pieza desde la lista del sistema
        await pg.evaluate("document.querySelector('#v-detail .prow[data-part=frenos_del]').click()"); await pg.wait_for_timeout(1400); await shot('3_pieza')
        print('a', await pg.evaluate("window.__app.state"))
        await pg.evaluate("document.querySelector('#v-detail [data-back]').click()"); await pg.wait_for_timeout(600)
        print('b', await pg.evaluate("window.__app.state"))
        await pg.evaluate("document.querySelector('#v-detail [data-back]').click()"); await pg.wait_for_timeout(800)
        print('c', await pg.evaluate("window.__app.state"))
        # piezas: búsqueda
        await tap('#tabbar [data-tab=piezas]'); await pg.wait_for_timeout(500)
        await pg.fill('#psearch', 'bomba'); await pg.wait_for_timeout(300); await shot('4_buscar')
        # sensores
        await tap('#tabbar [data-tab=sensores]'); await pg.wait_for_timeout(1300); await shot('5_sensores')
        if dev == 'm': await pg.evaluate("window.__app.setSheet('full')"); await pg.wait_for_timeout(500); await shot('5b_sensores_full')
        # datos
        await tap('#tabbar [data-tab=datos]'); await pg.wait_for_timeout(500); await shot('6_datos')
        await pg.evaluate("document.querySelector('[data-dsub=precision]').click()"); await pg.wait_for_timeout(400); await shot('7_precision')
        # motor + capas
        if dev == 'm': await pg.evaluate("window.__app.setSheet('peek')"); await pg.wait_for_timeout(400)
        await tap('#modebar [data-mode=eng]'); await pg.wait_for_timeout(1600)
        await tap('#dock [data-pop=capas]'); await pg.wait_for_timeout(300); await shot('8_motor_capas')
        await pg.evaluate("document.querySelector('#tb-cut [data-v=long]').click()"); await pg.wait_for_timeout(900)
        await tap('#tb-run'); await pg.wait_for_timeout(1200); await shot('9_motor_corte')
        await tap('#tb-run'); await pg.wait_for_timeout(300)
        await tap('#modebar [data-mode=van]'); await pg.wait_for_timeout(1400)
        await tap('#dock [data-pop=capas]'); await pg.wait_for_timeout(200)
        await pg.evaluate("document.querySelector('#tb-body [data-v=ghost]').click()"); await pg.wait_for_timeout(300)
        await tap('#dock [data-pop=color]'); await pg.wait_for_timeout(200)
        await pg.evaluate("document.querySelector('#tb-color [data-v=sys]').click()"); await pg.wait_for_timeout(900); await shot('10_rayosx_sistema')
        await tap('#helpbtn'); await pg.wait_for_timeout(400); await shot('11_ayuda')
        print("\n".join(errs) or "sin errores")
        await b.close()
asyncio.run(main(sys.argv[1]))
