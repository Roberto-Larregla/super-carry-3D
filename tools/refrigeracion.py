# Recorrido de la vista Refrigeración con capturas en shots/: python3 tools/refrigeracion.py d|m [esc cut fail proc pot]
import asyncio, sys, os, pathlib, json
ROOT = pathlib.Path(__file__).resolve().parent.parent
URL_DOC = (ROOT / "docs" / "index.html").as_uri()
os.makedirs(ROOT / "shots", exist_ok=True)
from playwright.async_api import async_playwright

def fila(nombre, r):
    return f"{nombre:<22} agua {r['Te']:6.1f} °C  aguja {r['gauge']:.2f}  termostato {r['lift']:4.1f} mm  presión {r['P']:.2f}  depósito {r['res']:.3f}  hierve {r['boil']:.2f}"

async def main(dev, steps):
    todo = 'all' in steps
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=os.environ.get("CHROME", "/usr/bin/google-chrome"), args=["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader","--ignore-gpu-blocklist"])
        ctx = await b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True) if dev == 'm' else await b.new_context(viewport={"width": 1440, "height": 900})
        pg = await ctx.new_page(); pg.set_default_timeout(120000); errs = []
        pg.on("console", lambda m: errs.append(m.text[:300]) if m.type == 'error' and 'TUNNEL' not in m.text else None)
        pg.on("pageerror", lambda e: errs.append('[pageerror] ' + str(e)[:400]))
        await pg.goto(URL_DOC); await pg.wait_for_timeout(2500)
        async def shot(n): await pg.screenshot(path=str(ROOT / "shots" / f"ref_{dev}_{n}.png"))
        js = pg.evaluate
        async def click(sel): await js(f"document.querySelector({json.dumps(sel)}).click()"); await pg.wait_for_timeout(250)
        async def adv(sec): await js(f"window.__viewer.debugCool({sec}) && 1")
        async def read(): return await js("(() => { const s = window.__viewer.coolState; return {Te: s.Te, gauge: s.gauge, lift: s.lift, P: s.P, res: s.res, boil: s.boil}; })()")
        await js("window.__app.openSys('refrigeracion')"); await pg.wait_for_timeout(2500)
        await js("document.querySelector('#toast') && document.querySelector('#toast').classList.add('gone')")
        await shot('1_iso')
        if todo or 'esc' in steps:
            await click('#tb-cool')
            for v, sec in [('ralenti', 1500), ('ciudad', 1500), ('taco', 1800), ('subida', 1500), ('carretera', 1500)]:
                await click(f'#tb-cscen [data-v={v}]'); await adv(sec); await pg.wait_for_timeout(900)
                print(fila(v, await read())); await shot('2_' + v)
            await click('#tb-cscen [data-v=ralenti]'); await adv(900)
            await click('#tb-cool'); await adv(300); print(fila('apagado 5 min', await read())); await shot('2_apagado')
        if todo or 'cut' in steps:
            await click('#tb-bcut [data-v=in]')
            for v in ['radiador', 'termostato', 'bomba', 'deposito', 'tapa', 'arriba']:
                await js(f"window.__viewer.setView('{v}', true)"); await pg.wait_for_timeout(1400); await shot('3_' + v)
            await js("window.__viewer.setView('iso', true)")
        if todo or 'fail' in steps:
            on = await js("window.__viewer.engineOn")
            if not on: await click('#tb-cool')
            for f, esc in [('cerrado', 'ciudad'), ('abierto', 'carretera'), ('correa', 'subida'), ('carenado', 'taco'), ('panal', 'subida'), ('tapa', 'taco'), ('bomba', 'subida'), ('aire', 'ralenti'), ('fuga', 'ciudad'), ('culata', 'ciudad'), ('llave', 'ralenti'), ('radiador', 'ralenti')]:
                if os.environ.get('FALLAS') and f not in os.environ['FALLAS'].split(','): continue
                await click(f'#tb-cfail [data-v={f}]'); await click(f'#tb-cscen [data-v={esc}]'); await click('#tb-ceng [data-v=frio]')
                await adv(1500); await pg.wait_for_timeout(700)
                print(fila(f'{f} ({esc})', await read())); await shot('4_' + f)
            await click('#tb-cfail [data-v=ok]'); await click('#tb-cscen [data-v=ralenti]'); await click('#tb-ceng [data-v=frio]')
        if todo or 'proc' in steps:
            await click('#tb-cproc'); await pg.wait_for_timeout(1500)
            n = await js("window.__viewer.coolState.proc ? 11 : 0")
            for i in range(n):
                await adv(6); await pg.wait_for_timeout(1300); await shot(f'5_paso{i + 1:02d}')
                if i < n - 1: await click('#guide [data-g=next]')
            await click('#guide [data-g=exit]'); await pg.wait_for_timeout(800)
        if todo or 'pot' in steps:
            await click('#tb-cpot'); await pg.wait_for_timeout(1500); await shot('6_olla')
            for cond in ['bueno', 'tarde', 'pegado']:
                await click(f'#tb-potcond [data-v={cond}]'); await click('#guide [data-g=potreset]'); await click('#guide [data-g=heat]')
                await adv(70); await pg.wait_for_timeout(900)
                pot = await js("(() => { const p = window.__viewer.coolState.pot; return {T: p.T, lift: p.lift, openT: p.openT}; })()")
                verd = await js("(document.querySelector('#guide .gverd') || {}).textContent || ''")
                print(f"olla {cond:<7} {pot['T']:5.1f} °C  alzada {pot['lift']:4.1f} mm  abrió a {pot['openT']}  → {verd}")
                await shot('6_' + cond)
            await click('#guide [data-g=exit]')
        print(await js("JSON.stringify(window.__viewer.debugStats())"))
        print("\n".join(errs) or "sin errores")
        await b.close()
asyncio.run(main(sys.argv[1], sys.argv[2:] or ['all']))
