# python3 ortho.py → superpone la vista ortográfica del modelo con las fotos de plano (costado, frente, atrás)
import asyncio, base64, io, sys
from playwright.async_api import async_playwright
from PIL import Image, ImageChops, ImageFilter, ImageOps
import os, pathlib
ROOT = pathlib.Path(__file__).resolve().parent.parent
URL_DOC = (ROOT / 'docs' / 'index.html').as_uri()
os.makedirs(ROOT / 'shots', exist_ok=True); os.chdir(ROOT)

UP = '/mnt/user-data/uploads/'
async def main(which):
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=os.environ.get("CHROME", "/usr/bin/google-chrome"), args=["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader","--ignore-gpu-blocklist"])
        ctx = await b.new_context(viewport={"width": 1360, "height": 900}); pg = await ctx.new_page()
        await pg.goto(URL_DOC); await pg.wait_for_timeout(2500)
        await pg.evaluate("document.querySelector('#tb-run').click()")
        await pg.evaluate("document.querySelector('#tb-body [data-v=solid]').click()"); await pg.wait_for_timeout(300)
        await pg.evaluate("document.querySelector('#tb-color [data-v=real]').click()"); await pg.wait_for_timeout(300)
        jobs = {
          # costado: foto girada 0,8° y escala 504 px/m; centro de imagen = (X −0,955, Y 1,2435)
          'left': dict(photo='8155ef21-image.jpg', rot=-0.8, args="{dir:'left', ppm:504, w:1659, h:2212, cx:-0.9553, cy:1.2435}"),
          # frente: cámara a ~5,3 m de la cara del parachoques, altura 1,54 m, 8 cm hacia la derecha; f ≈ 2.708 px
          'front': dict(photo='d0b8ecd1-image.jpg', rot=0, persp="{pos:[6.07,1.539,0.081], target:[0.765,1.539,0.081], fov:44.4}"),
          # atrás: a ~8,4 m de la cara trasera; f ≈ 463·8,4 = 3.889 px
          'rear': dict(photo='bbc6085b-image.jpg', rot=0, persp="{pos:[-10.84,1.535,-0.003], target:[-2.44,1.535,-0.003], fov:31.6}"),
        }
        for k in which:
            j = jobs[k]
            url = await pg.evaluate(f"window.__viewer.debugOrtho({j['args']})") if 'args' in j else await pg.evaluate(f"window.__viewer.debugPersp({j['persp']})")
            m = Image.open(io.BytesIO(base64.b64decode(url.split(',')[1]))).convert('RGB')
            ph = Image.open(UP + j['photo']).convert('RGB').rotate(j['rot'], resample=Image.BICUBIC)
            # bordes del modelo en rojo sobre la foto
            L = m.convert('L')
            mask = L.point(lambda v: 110 if v > 12 else 0)                     # silueta del modelo, semitransparente
            edge = L.point(lambda v: 255 if v > 12 else 0).filter(ImageFilter.FIND_EDGES).point(lambda v: 255 if v > 60 else 0)
            inner = L.filter(ImageFilter.FIND_EDGES).point(lambda v: 255 if v > 70 else 0)
            out = ph.copy()
            out.paste(Image.new('RGB', ph.size, (255, 30, 30)), mask=mask)
            out.paste(Image.new('RGB', ph.size, (0, 255, 255)), mask=inner)
            out.paste(Image.new('RGB', ph.size, (255, 255, 0)), mask=edge)
            out.save(f'shots/ortho_{k}.png'); m.save(f'shots/ortho_{k}_model.png')
            print('ok', k)
        await b.close()
asyncio.run(main(sys.argv[1:] or ['left']))
