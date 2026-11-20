# Vista Eléctrico y su coherencia con las demás: python3 tools/electrico.py d|m [partes]
# partes (todas si no se dice): base partida carga fallas vistas esquema
import asyncio, sys, os, pathlib, json
ROOT = pathlib.Path(__file__).resolve().parent.parent
URL_DOC = (ROOT / "docs" / "index.html").as_uri()
os.makedirs(ROOT / "shots", exist_ok=True)
from playwright.async_api import async_playwright

async def main(dev, parts):
    ok = True
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=os.environ.get("CHROME", "/usr/bin/google-chrome"), args=["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader","--ignore-gpu-blocklist"])
        ctx = await b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True) if dev == 'm' else await b.new_context(viewport={"width": 1440, "height": 900})
        pg = await ctx.new_page(); pg.set_default_timeout(120000); errs = []
        pg.on("console", lambda m: errs.append(m.text[:300]) if m.type == 'error' and 'TUNNEL' not in m.text else None)
        pg.on("pageerror", lambda e: errs.append('[pageerror] ' + str(e)[:400]))
        await pg.goto(URL_DOC); await pg.wait_for_timeout(2500)
        js = pg.evaluate
        async def shot(n): await pg.screenshot(path=str(ROOT / "shots" / f"electrico_{dev}_{n}.png"))
        async def click(sel): await js(f"document.querySelector({json.dumps(sel)}).click()"); await pg.wait_for_timeout(250)
        async def view(sys_): await js(f"window.__app.openSys('{sys_}')"); await pg.wait_for_timeout(1600)
        async def label(sel): return await js(f"(document.querySelector({json.dumps(sel)}) || {{}}).textContent || ''")
        async def pressed(sel): return await js(f"[...document.querySelectorAll({json.dumps(sel + ' [aria-pressed=true]')})].map(b => b.dataset.v).join(',')")
        def check(name, cond, extra=''):
            nonlocal ok
            ok = ok and bool(cond)
            print(('OK   ' if cond else 'MAL  ') + name + (f'  [{extra}]' if extra else ''))
        E = lambda o='{}': js(f"(() => {{ const r = window.__viewer.elec({o}); return {{ key: r.key, run: r.run, V: r.V, iAlt: r.iAlt, iBat: r.iBat, iLoad: r.iLoad, soc: r.soc, rate: r.rate, turnFast: r.turnFast, lamps: r.lamps, radio: r.radio, misfire: r.misfire, rpm: r.rpm, gauges: r.gauges, crank: r.crank && {{ I: r.crank.I, n: r.crank.n }} }}; }})()")
        adv = lambda s: js(f"(() => {{ const r = window.__viewer.debugElec({s}); return {{ key: r.key, run: r.run, V: r.V, on: window.__viewer.engineOn }}; }})()")
        toast = lambda: js("(t => t.classList.contains('gone') ? '' : t.textContent)(document.querySelector('#toast'))")
        want = lambda k: not parts or k in parts

        if want('base'):
            r = await E()
            check('Parte con la llave en LOCK y el motor detenido', r['key'] == 'lock' and not r['run'])
            g = await js("window.__viewer.coolState.gauge")
            check('Sin contacto la aguja de temperatura descansa bajo la C', g < 0, f"{g:.2f}")
            await view('electrico')
            check('Eléctrico: abre su vista', await js("window.__viewer.getMode()") == 'ele')
            hud = await js("document.querySelector('#elehud').innerText")
            check('Eléctrico: el indicador dice LOCK', 'LOCK' in hud, hud.split('\n')[1] if '\n' in hud else hud)
            check('Eléctrico: el botón dice Encender', 'Encender' in await label('#tb-elec'))
            check('Eléctrico: la caja de fusibles se abre la primera vez', await js("window.__viewer.state.bcut") is True)
            await click('#tb-key [data-v=on]'); r = await E()
            check('ON: luces de carga y de aceite encendidas', r['lamps']['charge'] and r['lamps']['oil'])
            g0 = await js("window.__viewer.coolState.ign")
            check('ON: la aguja de temperatura recibe contacto', g0 is True)
            fan = await js("window.__viewer.heat().fanEff")
            check('ON con el motor detenido: el ventilador de la calefacción sopla', fan > 0, f"vel. {fan}")
            await click('#tb-key [data-v=acc]'); r = await E()
            check('ACC: la radio suena y el encendido no', r['radio']['on'] and not r['lamps']['charge'])
            await click('#tb-key [data-v=lock]'); r = await E()
            check('LOCK: la radio se apaga con la llave', not r['radio']['on'])
            await js("window.__viewer.elec({ hazard: true })"); r = await adv(0.5); r2 = await E()
            check('Balizas: destellan sin llave, a ritmo normal', r2['rate'] > 70 and r2['rate'] < 100 and not r2['turnFast'], f"{r2['rate']} por minuto")
            await js("window.__viewer.elec({ hazard: false })")
            await shot('1_lock')

        if want('partida'):
            if not want('base'): await view('electrico')
            await click('#tb-elec'); c = await js("window.__viewer.elecResult.crank")
            check('Encender: da la partida con la llave en START', c is not None and c['I'] > 120, f"{c and round(c['I'])} A")
            check('Partida: la batería baja a menos de 11 V', c and c['vBat'] < 11, f"{c and round(c['vBat'], 1)} V")
            await shot('2_partida')
            r = await adv(2.5)
            check('Partida: el motor parte y la llave vuelve a ON', r['on'] and r['key'] == 'on')
            check('Eléctrico: el botón dice Apagar', 'Apagar' in await label('#tb-elec'))
            r = await E("{ lights: 'baja', fan: 0, radio: { on: false } }")
            check('Ralentí con bajas: carga a 14,4–15,0 V', 14.4 <= r['V'] <= 15.0 and r['iBat'] > 0, f"{r['V']:.2f} V, {r['iBat']:+.1f} A")
            r = await E("{ fan: 3, wipers: 'rapido', radio: { on: true } }")
            check('Ralentí con todo: el alternador no alcanza y la batería pone', r['iBat'] < 0 and r['V'] < 13.2, f"{r['V']:.2f} V, {r['iBat']:+.1f} A")
            await js("window.__viewer.elec({ pedal: 0.6 })"); await adv(3); r = await E()
            check('Acelerando: el alternador vuelve a cargar', r['iBat'] > 0 and r['rpm'] > 1500, f"{r['rpm']:.0f} rpm, {r['iBat']:+.1f} A")
            await js("window.__viewer.elec({ pedal: 0, fan: 2, wipers: 'off', lights: 'off' })")
            await click('#tb-elec'); r = await E()
            check('Apagar: llave a LOCK y motor detenido', r['key'] == 'lock' and not await js("window.__viewer.engineOn"))
            # batería baja: no parte en ninguna vista
            await js("window.__viewer.elec({ soc: 0.12 })"); await click('#tb-elec'); await adv(3.5)
            check('Batería al 12 %: no parte', not await js("window.__viewer.engineOn"), (await toast())[:90])
            await view('refrigeracion'); await click('#tb-cool')
            check('Refrigeración: con la batería baja tampoco parte', not await js("window.__viewer.engineOn") and 'No parte' in await toast())
            await view('transmision'); await click('#tb-drive')
            check('Transmisión: tampoco parte', not await js("window.__viewer.engineOn") and not await js("window.__viewer.driveState.sim.on"))
            await view('electrico')
            await js("window.__viewer.elec({ soc: 0.3 })"); await click('#tb-elec'); await adv(3)
            check('Batería al 30 %: parte', await js("window.__viewer.engineOn"))
            await click('#tb-elec'); await js("window.__viewer.elec({ soc: 0.9 })")

        if want('carga'):
            if not (want('base') or want('partida')): await view('electrico')
            await js("window.__viewer.elec({ key: 'lock', lights: 'baja' })"); r = await E()
            check('Faros encendidos sin motor: descargan la batería', r['iBat'] < -7, f"{r['iBat']:+.1f} A")
            s0 = r['soc']; await adv(60); r = await E()
            check('Un minuto con los faros: baja la carga', r['soc'] < s0, f"{s0*100:.2f} → {r['soc']*100:.2f} %")
            await js("window.__viewer.elec({ lights: 'off' })")
            await view('combustible'); lv = await js("window.__viewer.fuelState.level")
            await view('electrico'); await js("window.__viewer.elec({ key: 'on' })"); r = await E()
            check('El indicador de bencina marca lo del estanque', abs(r['gauges']['fuel'] - lv) < 0.01, f"{r['gauges']['fuel']:.2f} / {lv:.2f}")
            await js("window.__viewer.elec({ key: 'lock' })")

        if want('fallas'):
            if not (want('base') or want('partida') or want('carga')): await view('electrico')
            await js("window.__viewer.elec({ key: 'on', turn: -1 })"); await adv(0.3)
            await click('#tb-efail [data-v=destellador]'); r = await E()
            check('Destellador: rápido aunque encienden todas', r['turnFast'] and r['rate'] > 120, f"{r['rate']} por minuto")
            await js("window.__viewer.elec({ turn: 1 })"); r = await E()
            check('Destellador: rápido también a la derecha', r['turnFast'])
            await click('#tb-efail [data-v=ampolleta]'); r = await E()
            check('Ampolleta quemada: a la derecha destella normal', not r['turnFast'])
            await js("window.__viewer.elec({ turn: -1 })"); r = await E()
            check('Ampolleta quemada: a la izquierda destella rápido', r['turnFast'])
            await js("window.__viewer.elec({ turn: 0, key: 'acc' })")
            await click('#tb-efail [data-v=parlantes]')
            mutes = 0
            for _ in range(30):
                r = await adv(2)
                rr = await E(); mutes += 1 if rr['radio']['mute'] else 0
            check('Falso contacto: la radio queda sin sonido a ratos y vuelve sola', 0 < mutes < 30, f"{mutes} de 30 muestras")
            await click('#tb-efail [data-v=correa]')
            check('Correa: es la misma falla de Refrigeración', await js("window.__viewer.coolState.fail") == 'correa')
            await view('refrigeracion')
            check('Refrigeración: marca la correa', await pressed('#tb-cfail') == 'correa')
            await click('#tb-cfail [data-v=cerrado]')
            await view('electrico')
            check('Eléctrico: otra falla del agua no marca nada aquí', await pressed('#tb-efail') == 'ok')
            note = await js("(n => n && !n.hidden ? n.textContent : '')(document.querySelector('#tb-efail-note'))")
            check('Eléctrico: avisa la falla del agua', 'Termostato' in note, note)
            await js("window.__viewer.cool({ fail: 'ok' })")
            await click('#tb-efail [data-v=bujia]'); await js("window.__viewer.elec({ key: 'lock' })"); await click('#tb-elec'); await adv(2.5); r = await E()
            check('Bujía cortada: el motor anda con un cilindro menos', r['run'] and r['misfire'])
            await view('transmision')
            await js("window.__viewer.drive({ gear: 'R' })"); await js("window.__viewer.debugDrive(2.5)"); r = await E()
            gear = await js("window.__viewer.driveState.sim.gear")
            check('Transmisión: en R se encienden las luces de retroceso', gear == 'R' and r['lamps']['rev'] > 0, f"marcha {gear}")
            await view('frenos'); await click('#tb-press'); await pg.wait_for_timeout(300); r = await E()
            check('Frenos: al pisar se encienden las luces de freno', r['lamps']['stop'] > 0)
            await view('electrico'); await click('#tb-efail [data-v=ok]'); await click('#tb-elec')
            await js("window.__viewer.elec({ key: 'lock', radio: { on: true } })")
            await shot('3_fallas')

        if want('esquema'):
            await view('electrico')
            await js("window.__viewer.elec({ key: 'on' })")
            await js("window.__app.setSheet && window.__app.setSheet('full')"); await pg.wait_for_timeout(500)
            await js("(() => { const f = [...document.querySelectorAll('.diag-body')].find(e => e.offsetParent && e.querySelector('.ctl.seg')); f && f.scrollIntoView({ block: 'center' }); })()"); await pg.wait_for_timeout(900)
            d = await js("""(() => { const f = [...document.querySelectorAll('.diag-body')].find(e => e.offsetParent && e.querySelector('.ctl.seg'));
              if (!f) return null; const segs = [...f.querySelectorAll('.ctl.seg')].map(c => [c.querySelector('.clabel').textContent, [...c.querySelectorAll('[aria-pressed=true]')].map(b => b.dataset.v).join()]);
              return { segs, txt: f.querySelector('.readout').textContent, caps: [...f.querySelectorAll('figcaption')].map(c => c.textContent).join(' ') }; })()""")
            if d:
                segs = dict(d['segs'])
                check('Esquema: la misma llave del modelo', segs.get('Llave') == 'on', str(segs))
                check('Esquema: regulación del manual', '14,4–15,0' in d['caps'] and '14,2' not in d['caps'])
                await js("""(() => { const f = [...document.querySelectorAll('.diag-body')].find(e => e.offsetParent && e.querySelector('.ctl.seg')); f.querySelector('[data-v=lock]').click(); })()""")
                check('Esquema: LOCK en el esquema apaga la llave del modelo', await js("window.__viewer.elecState.key") == 'lock')
            else:
                check('Esquema visible', False)
            await shot('4_esquema')
        print("\n".join(errs) or "sin errores")
        await b.close()
    print('TODO BIEN' if ok and not errs else 'HAY PROBLEMAS')

asyncio.run(main(sys.argv[1] if len(sys.argv) > 1 else 'd', sys.argv[2:]))
