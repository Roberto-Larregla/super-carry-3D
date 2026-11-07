import asyncio, sys
from playwright.async_api import async_playwright
import os, pathlib
ROOT = pathlib.Path(__file__).resolve().parent.parent
URL_DOC = (ROOT / 'docs' / 'index.html').as_uri()
os.makedirs(ROOT / 'shots', exist_ok=True); os.chdir(ROOT)

URL = URL_DOC
async def vshot(pg, path):
    await pg.evaluate("document.querySelector('#modelo').scrollIntoView()"); await pg.wait_for_timeout(250)
    await pg.evaluate("window.scrollBy(0, -50)")
    bb = await pg.evaluate("(()=>{const r=document.querySelector('#viewer').getBoundingClientRect();return [r.x, r.y + window.scrollY, r.width, r.height]})()")
    await pg.screenshot(path=path, full_page=True, clip={"x": bb[0], "y": bb[1], "width": bb[2], "height": bb[3]})
async def shot(pg, sel, path, maxh=6000):
    await pg.evaluate(f"document.querySelector('{sel}').scrollIntoView()"); await pg.wait_for_timeout(300)
    bb = await pg.evaluate(f"(()=>{{const r=document.querySelector('{sel}').getBoundingClientRect();return [r.x, r.y + window.scrollY, r.width, r.height]}})()")
    await pg.screenshot(path=path, full_page=True, clip={"x": bb[0], "y": bb[1], "width": bb[2], "height": min(bb[3], maxh)})
async def main(dev, steps):
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=os.environ.get("CHROME", "/usr/bin/google-chrome"), args=["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader","--ignore-gpu-blocklist"])
        logs = []
        if dev == 'm': ctx = await b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
        else: ctx = await b.new_context(viewport={"width": 1360, "height": 900}, device_scale_factor=1)
        pg = await ctx.new_page()
        pg.on("console", lambda m: logs.append(f"[{m.type}] {m.text}") if m.type in ("error","warning") and "GPU stall" not in m.text and "ERR_TUNNEL" not in m.text and "fonts.g" not in m.text else None)
        pg.on("pageerror", lambda e: logs.append(f"[pageerror] {e}"))
        await pg.goto(URL); await pg.wait_for_timeout(2500)
        await pg.evaluate("window.__viewer.isRunning() && document.querySelector('#tb-run').click()")  # pausa para capturas estables
        for st in steps.split(','):
            if st == 'van': await vshot(pg, f"shots/t_{dev}_van.png")
            elif st == 'vanside':
                await pg.click("#tb-body [data-v=solid]"); await pg.click("#tb-view [data-v=lado]"); await pg.wait_for_timeout(1200)
                await vshot(pg, f"shots/t_{dev}_vanside.png"); await pg.click("#tb-body [data-v=ghost]"); await pg.click("#tb-view [data-v=iso]"); await pg.wait_for_timeout(900)
            elif st == 'front':
                await pg.click("#tb-view [data-v=frente]"); await pg.wait_for_timeout(1200); await vshot(pg, f"shots/t_{dev}_front.png")
                await pg.click("#tb-view [data-v=iso]"); await pg.wait_for_timeout(900)
            elif st == 'sens':
                await pg.click("#syschips [data-sys=sensores]"); await pg.wait_for_timeout(1300); await vshot(pg, f"shots/t_{dev}_sens.png")
                await shot(pg, "#infocard", f"shots/t_{dev}_senscard.png", 1400)
                await pg.click("#syschips [data-sys='']"); await pg.wait_for_timeout(900)
            elif st == 'selsensor':
                await pg.evaluate("document.querySelector('#infocard [data-part]') || 0")
                await pg.click("#syschips [data-sys=sensores]"); await pg.wait_for_timeout(600)
                await pg.click("#infocard [data-part=s_aceite]"); await pg.wait_for_timeout(1300)
                await vshot(pg, f"shots/t_{dev}_selsensor.png"); await shot(pg, "#infocard", f"shots/t_{dev}_selcard.png", 1600)
                await pg.click("#syschips [data-sys='']"); await pg.wait_for_timeout(600)
            elif st in ('eng','engnone','engxray','englong','engtrans'):
                await pg.click("#modebar [data-mode=eng]"); await pg.wait_for_timeout(1300)
                cut = st[3:] or 'none'
                await pg.click(f"#tb-cut [data-v={cut}]"); await pg.wait_for_timeout(900)
                await vshot(pg, f"shots/t_{dev}_eng_{cut}.png")
            elif st == 'tilt':
                await pg.click("#tb-tilt"); await pg.wait_for_timeout(1200); await vshot(pg, f"shots/t_{dev}_eng_tilt.png"); await pg.click("#tb-tilt"); await pg.wait_for_timeout(900)
            elif st == 'engexp':
                await pg.evaluate("(()=>{const r=document.querySelector('#tb-explode'); r.value=100; r.dispatchEvent(new Event('input'))})()"); await pg.wait_for_timeout(900)
                await vshot(pg, f"shots/t_{dev}_eng_exp.png")
                await pg.evaluate("(()=>{const r=document.querySelector('#tb-explode'); r.value=0; r.dispatchEvent(new Event('input'))})()"); await pg.wait_for_timeout(500)
            elif st.startswith('engview'):
                v = st[7:]; await pg.click(f"#tb-view [data-v={v}]"); await pg.wait_for_timeout(1200); await vshot(pg, f"shots/t_{dev}_eng_v_{v}.png")
            elif st == 'engsens':
                await pg.click("#syschips [data-sys=sensores]"); await pg.wait_for_timeout(1300); await vshot(pg, f"shots/t_{dev}_eng_sens.png"); await pg.click("#syschips [data-sys='']"); await pg.wait_for_timeout(600)
            elif st == 'engsel':
                await pg.click("#infocard [data-part=valvulas]"); await pg.wait_for_timeout(1300); await vshot(pg, f"shots/t_{dev}_eng_sel.png"); await shot(pg, "#infocard", f"shots/t_{dev}_eng_card.png", 1400)
            elif st == 'angle':
                for a in [0, 200, 400]:
                    await pg.evaluate(f"(()=>{{const r=document.querySelector('#tb-angle'); r.value={a}; r.dispatchEvent(new Event('input'))}})()"); await pg.wait_for_timeout(500)
                    await vshot(pg, f"shots/t_{dev}_ang{a}.png")
            elif st == 'map': await shot(pg, "#sensores", f"shots/t_{dev}_map.png", 4000)
            elif st.startswith('sel_'):
                pid = st[4:]
                await pg.evaluate(f"window.__viewer && window.__viewer.select('{pid}')"); await pg.wait_for_timeout(1300)
                await vshot(pg, f"shots/t_{dev}_sel_{pid}.png")
                await shot(pg, "#infocard", f"shots/t_{dev}_selcard_{pid}.png", 1800)
            elif st.startswith('cam_'):
                # cam_x_y_z_tx_ty_tz : posición de cámara libre para inspección
                v = [float(a) for a in st[4:].split('_')]
                await pg.evaluate(f"window.__viewer && window.__viewer.debugCam({v})"); await pg.wait_for_timeout(900)
                await vshot(pg, f"shots/t_{dev}_cam_{'_'.join(str(int(a*100)) for a in v[:3])}.png")
            elif st == 'van2':
                await pg.click("#modebar [data-mode=van]"); await pg.wait_for_timeout(1300); await vshot(pg, f"shots/t_{dev}_van2.png")
        print("\n".join(logs) or "sin errores")
        await b.close()
asyncio.run(main(sys.argv[1], sys.argv[2]))
