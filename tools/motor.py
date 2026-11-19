# Un solo motor para todas las vistas: python3 tools/motor.py d|m
# Revisa que encendido, temperatura del agua, temperatura de afuera, calefacción y fallas sean los mismos en
# Furgón, Calefacción, Alimentación, Transmisión, Refrigeración y el esquema del panel.
import asyncio, sys, os, pathlib, json
ROOT = pathlib.Path(__file__).resolve().parent.parent
URL_DOC = (ROOT / "docs" / "index.html").as_uri()
os.makedirs(ROOT / "shots", exist_ok=True)
from playwright.async_api import async_playwright

async def main(dev):
    ok = True
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=os.environ.get("CHROME", "/usr/bin/google-chrome"), args=["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader","--ignore-gpu-blocklist"])
        ctx = await b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True) if dev == 'm' else await b.new_context(viewport={"width": 1440, "height": 900})
        pg = await ctx.new_page(); pg.set_default_timeout(120000); errs = []
        pg.on("console", lambda m: errs.append(m.text[:300]) if m.type == 'error' and 'TUNNEL' not in m.text else None)
        pg.on("pageerror", lambda e: errs.append('[pageerror] ' + str(e)[:400]))
        await pg.goto(URL_DOC); await pg.wait_for_timeout(2500)
        js = pg.evaluate
        async def shot(n): await pg.screenshot(path=str(ROOT / "shots" / f"motor_{dev}_{n}.png"))
        async def click(sel): await js(f"document.querySelector({json.dumps(sel)}).click()"); await pg.wait_for_timeout(300)
        async def view(sys_): await js(f"window.__app.openSys('{sys_}')"); await pg.wait_for_timeout(1800)
        async def label(sel): return await js(f"(document.querySelector({json.dumps(sel)}) || {{}}).textContent || ''")
        async def pressed(sel): return await js(f"[...document.querySelectorAll({json.dumps(sel + ' [aria-pressed=true]')})].map(b => b.dataset.v).join(',')")
        def check(name, cond, extra=''):
            nonlocal ok
            ok = ok and bool(cond)
            print(('OK   ' if cond else 'MAL  ') + name + (f'  [{extra}]' if extra else ''))
        st = lambda: js("(() => { const s = window.__viewer.coolState; return { on: window.__viewer.engineOn, Te: s.Te, amb: s.amb, fail: s.fail, heat: s.heat, fu: window.__viewer.fuelState.on, dr: window.__viewer.driveState.sim.on }; })()")

        s = await st(); check('parte detenido y frío', not s['on'] and abs(s['Te'] - s['amb']) < 0.5, f"Te {s['Te']:.1f}")
        await view('calefaccion'); s = await st()
        check('Calefacción: entrar no lo enciende', not s['on'])
        check('Calefacción: el mando dice Frío', await pressed('#tb-heng') == 'frio')
        await click('#tb-heat'); s = await st()
        check('Calefacción: Encender', s['on'] and s['fu'], await label('#tb-heat'))
        await view('combustible'); s = await st()
        check('Alimentación: sigue en marcha', s['on'] and 'Apagar' in await label('#tb-fuel'))
        await view('refrigeracion'); s = await st()
        check('Refrigeración: sigue en marcha', s['on'] and 'Apagar' in await label('#tb-cool'))
        await click('#tb-ceng [data-v=caliente]'); s = await st()
        check('Refrigeración: Caliente deja el agua regulando', 78 < s['Te'] < 90, f"Te {s['Te']:.1f}")
        for seg in ['#tb-heng', '#tb-feng', '#tb-ceng']:
            check(f'{seg} marca Caliente', await pressed(seg) == 'caliente')
        hud = await js("document.querySelector('#refhud').innerText")
        check('Refrigeración: presión en kg/cm²', 'kg/cm²' in hud and ' bar' not in hud)
        await click('#tb-cheat [data-v="0"]'); s = await st()
        check('Refrigeración: Calefacción Cerrada cierra la llave', s['heat']['temp'] == 0)
        amb = await js("(() => { const r = document.querySelector('#tb-camb'); r.value = 6; r.dispatchEvent(new Event('input')); return window.__viewer.coolState.amb; })()")
        check('Refrigeración: 6 °C afuera', amb == 6)
        await view('calefaccion'); s = await st()
        check('Calefacción: palanca en COOL', await js("+document.querySelector('#tb-htemp').value") == 0)
        check('Calefacción: 6 °C afuera', await js("+document.querySelector('#tb-hamb').value") == 6)
        te_cal = await js("window.__viewer.heat().Tw")
        check('Calefacción: misma agua', abs(te_cal - s['Te']) < 0.6, f"{te_cal:.1f} / {s['Te']:.1f}")
        await click('#tb-hfail [data-v=resistencia]'); s = await st()
        check('Calefacción: falla compartida', s['fail'] == 'resistencia')
        await shot('1_calefaccion')
        await view('refrigeracion')
        note = await js("(n => n && !n.hidden ? n.textContent : '')(document.querySelector('#tb-cfail-note'))")
        check('Refrigeración: avisa la falla de la otra vista', 'Resistencia' in note, note)
        await click('#tb-cfail [data-v=llave]')
        await view('calefaccion')
        check('Calefacción: marca la falla elegida en Refrigeración', await pressed('#tb-hfail') == 'llave')
        await click('#tb-hfail [data-v=ok]')
        await view('transmision'); s = await st()
        check('Transmisión: sigue en marcha', s['on'] and s['dr'] and 'Apagar' in await label('#tb-drive'))
        await click('#tb-drive'); s = await st()
        check('Transmisión: Apagar lo apaga en todas', not s['on'] and not s['fu'] and not s['dr'])
        await view('frenos')
        hud = await js("(() => { document.querySelector('#tb-press') && document.querySelector('#tb-press').click(); return document.querySelector('#brkhud').innerText; })()")
        await pg.wait_for_timeout(600); hud = await js("document.querySelector('#brkhud').innerText")
        check('Frenos: presión en kg/cm²', ' bar' not in hud, hud.replace('\n', ' | ')[:120])
        await js("document.querySelector('#crumb-back').click()"); await pg.wait_for_timeout(1500)
        check('Furgón: botón dice Encender', 'Encender' in await label('#tb-run'))
        await click('#tb-run'); s = await st()
        check('Furgón: Encender lo enciende para todas', s['on'] and s['fu'])
        # esquema del panel: el mismo motor
        await js("window.__app.openSys('refrigeracion')"); await pg.wait_for_timeout(1800)
        await js("window.__app.setSheet && window.__app.setSheet('full')"); await pg.wait_for_timeout(600)
        await js("(() => { const f = [...document.querySelectorAll('.diag-body')].find(e => e.offsetParent && e.querySelector('input[type=range]')); f && f.scrollIntoView({ block: 'center' }); })()"); await pg.wait_for_timeout(900)
        d = await js("""(() => { const f = [...document.querySelectorAll('.diag-body')].find(e => e.offsetParent && e.querySelector('input[type=range]'));
          if (!f) return null; const segs = [...f.querySelectorAll('.ctl.seg')].map(c => [c.querySelector('.clabel').textContent, [...c.querySelectorAll('[aria-pressed=true]')].map(b => b.textContent).join()]);
          return { T: +f.querySelector('input[type=range]').value, segs, txt: f.querySelector('.readout').textContent, cap: f.querySelector('figcaption').textContent }; })()""")
        if d:
            s = await st()
            check('Esquema: misma temperatura', abs(d['T'] - s['Te']) <= 1.5, f"{d['T']} / {s['Te']:.1f}")
            segs = dict(d['segs'])
            check('Esquema: motor en marcha', segs.get('Motor') == 'En marcha', str(segs))
            check('Esquema: llave cerrada como en Refrigeración', segs.get('Llave de la calefacción') == 'Cerrada')
            check('Esquema: tapa en kg/cm²', 'bar' not in d['txt'] and 'puede variar' not in d['cap'])
            await js("""(() => { const f = [...document.querySelectorAll('.diag-body')].find(e => e.offsetParent && e.querySelector('input[type=range]')); const r = f.querySelector('input[type=range]'); r.value = 100; r.dispatchEvent(new Event('input')); })()""")
            s = await st(); check('Esquema: mover la temperatura cambia el motor', abs(s['Te'] - 100) < 1.5, f"{s['Te']:.1f}")
            await shot('2_esquema')
        else:
            check('Esquema visible', False)
        print("\n".join(errs) or "sin errores")
        await b.close()
    print('TODO BIEN' if ok and not errs else 'HAY PROBLEMAS')

asyncio.run(main(sys.argv[1] if len(sys.argv) > 1 else 'd'))
