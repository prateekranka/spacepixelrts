"""Compose preview frames from produced assets (960x540 logical, fit-contain)."""
import json
import os
import numpy as np
from PIL import Image

OUT = '/tmp/aaa-art/out'
CIV = f'{OUT}/front-end/civilizations'
PREV = f'{OUT}/preview'
os.makedirs(PREV, exist_ok=True)


def cover(im, w, h):
    if im.width / im.height >= w / h:
        nw = w
        nh = int(w * im.height / im.width)
    else:
        nw = int(h * im.width / im.height)
        nh = h
    im = im.resize((nw, nh), Image.NEAREST)
    x0 = (nw - w) // 2
    y0 = (nh - h) // 2
    return im.crop((x0, y0, x0 + w, y0 + h))


def contain(im, box):
    """Fit image inside box preserving AR, centered."""
    x, y, w, h = box
    r = im.width / im.height
    bw, bh = w, h
    if w / h > r:
        bw = int(h * r)
    else:
        bh = int(w / r)
    im = im.resize((max(1, bw), max(1, bh)), Image.NEAREST)
    out = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    out.paste(im, ((w - bw) // 2, (h - bh) // 2))
    return out


def blit(canvas, sprite, rect, blend):
    x, y, w, h = rect
    if blend == 'screen':
        s = np.asarray(sprite.convert('RGBA')).astype(np.float32)
        a = s[..., 3:4] / 255.0
        rgb = s[..., :3] * a
        region = canvas.crop((x, y, x + w, y + h)).convert('RGB')
        rr = np.asarray(region).astype(np.float32)
        mix = 255 - (255 - rr) * (255 - rgb) / 255.0
        canvas.paste(Image.fromarray(mix.astype(np.uint8)), (x, y))
        return
    layer = Image.new('RGBA', canvas.size, (0, 0, 0, 0))
    layer.paste(sprite, (x, y))
    canvas.alpha_composite(layer)


def compose(civ, mode, frame=0):
    man = json.load(open(f'{CIV}/{civ}/manifest.json'))[mode]
    d = f'{CIV}/{civ}/{mode}'
    W, H = man['canvas']['width'], man['canvas']['height']
    canvas = Image.new('RGBA', (W, H), (8, 10, 16, 255))
    for a in man['assets']:
        im = Image.open(f'{d}/{a["file"]}')
        if a['kind'] == 'cover':
            im = cover(im, W, H)
        elif a['kind'] == 'rect':
            im = contain(im, a['rect'])
            blit(canvas, im, a['rect'], a['blend'])
            continue
        blit(canvas, im, [0, 0, W, H], a['blend'])
    for sp in man.get('sprites', []):
        sheet = Image.open(f'{d}/{sp["file"]}')
        frames = sp['frames']
        for place in sp['places']:
            idx = place['frame'] if place['frame'] >= 0 else frame % len(frames)
            fr = frames[idx]
            spr = sheet.crop(fr)
            blit(canvas, contain(spr, place['box']), place['box'], sp['blend'])
    path = f'{PREV}/{civ}-{mode}.png'
    canvas.convert('RGB').resize((1920, 1080), Image.NEAREST).save(path)
    return path


for civ in ('sunweaver', 'gravemark'):
    for mode in ('menu', 'loading'):
        print(compose(civ, mode))
