# python3 views.py d|m body(ghost|solid|hidden) mode(van|eng) view1,view2,...  [cam:x,y,z>tx,ty,tz ...]
import asyncio, sys, json, time
from playwright.async_api import async_playwright
import os, pathlib
ROOT = pathlib.Path(__file__).resolve().parent.parent
URL_DOC = (ROOT / 'docs' / 'index.html').as_uri()
os.makedirs(ROOT / 'shots', exist_ok=True); os.chdir(ROOT)

async def main(dev, body, mode, views, cams):
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=os.environ.get("CHROME", "/usr/bin/google-chrome"), args=["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader","--ignore-gpu-blocklist"])
        if dev == 'm': ctx = await b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
        else: ctx = await b.new_context(viewport={"width": 1360, "height": 900})
        pg = await ctx.new_page(); logs = []
        pg.on("console", lambda m: logs.append(m.text[:200]) if m.type == 'error' and 'TUNNEL' not in m.text else None)
        pg.on("pageerror", lambda e: logs.append('[pageerror] ' + str(e)[:300]))
        await pg.goto(URL_DOC); await pg.wait_for_timeout(2500)
        await pg.evaluate("window.__viewer.isRunning() && document.querySelector('#tb-run').click()")
        if mode == 'eng': await pg.evaluate("document.querySelector('#modebar [data-mode=eng]').click()"); await pg.wait_for_timeout(1200)
        if body != 'ghost' and mode == 'van': await pg.evaluate(f"document.querySelector('#tb-body [data-v={body}]').click()"); await pg.wait_for_timeout(600)
        await pg.evaluate("document.querySelector('#modelo').scrollIntoView()"); await pg.wait_for_timeout(200); await pg.evaluate("window.scrollBy(0,-50)")
        bb = await pg.evaluate("(()=>{const r=document.querySelector('#viewer').getBoundingClientRect();return [r.x, r.y + window.scrollY, r.width, r.height]})()")
        async def shoot(name):
            await pg.screenshot(path=f"shots/v_{dev}_{mode}_{body}_{name}.png", full_page=True, clip={"x": bb[0], "y": bb[1], "width": bb[2], "height": bb[3]})
        for v in [x for x in views.split(',') if x]:
            await pg.evaluate(f"window.__viewer.setView('{v}', true)"); await pg.wait_for_timeout(500); await shoot(v)
        for c in cams:
            name, rest = c.split(':', 1)
            if rest.startswith('@'):
                pid, off = rest[1:].split('>')
                box = await pg.evaluate(f"window.__viewer.debugBox('{pid}')")
                cc = [(box[0][i] + box[1][i]) / 2 for i in range(3)]; o = [float(t) for t in off.split(',')]
                cam = [cc[0] + o[0], cc[1] + o[1], cc[2] + o[2]] + cc
            else:
                a, t = rest.split('>'); cam = [float(x) for x in a.split(',')] + [float(x) for x in t.split(',')]
            await pg.evaluate(f"window.__viewer.debugCam({json.dumps(cam)})"); await pg.wait_for_timeout(500); await shoot(name)
        st = await pg.evaluate("window.__viewer.debugStats()")
        print(st, "\n".join(logs) or "sin errores")
        await b.close()
asyncio.run(main(sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4], sys.argv[5:]))
