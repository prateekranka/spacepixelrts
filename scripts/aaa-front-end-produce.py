"""Starhaven AAA front-end asset production pipeline (v2: measured rects).

Inputs: /tmp/aaa-art/layers/<pack>/<asset>.png (1024x576 generator output)
Output: /tmp/aaa-art/out/front-end/civilizations/<civ>/<mode>/ (final assets)
        /tmp/aaa-art/out/front-end/civilizations/<civ>/manifest.json
All outputs exactly 1920x1080 master coordinates.
Manifest rects are 960x540 logical units (half of master space).
Fit-contain: an image is scaled to fit inside its rect preserving aspect ratio,
centered. The runtime must implement fit-contain.
"""
import os
import json
import numpy as np
from PIL import Image

SRC = '/tmp/aaa-art/layers'
OUT = '/tmp/aaa-art/out'
MASK_W, MASK_H = 1920, 1080
LOG_W, LOG_H = 960, 540
UP = 2
CX = (1024 * UP - MASK_W) // 2
CY = (576 * UP - MASK_H) // 2


def load(path):
    im = Image.open(path).convert('RGB')
    big = im.resize((1024 * UP, 576 * UP), Image.NEAREST)
    return big.crop((CX, CY, CX + MASK_W, CY + MASK_H))


def chroma_key(rgb):
    a = np.asarray(rgb).astype(np.float32)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    d = g - np.maximum(r, b)
    alpha = np.clip((d - 55.0) / 35.0, 0.0, 1.0)
    spill = (alpha > 0) & (alpha < 0.95)
    g2 = np.where(spill, np.minimum(g, np.maximum(r, b) + 0.5), g)
    out = np.stack([r, g2, b, (1.0 - alpha) * 255.0], axis=-1)
    return Image.fromarray(out.astype(np.uint8), 'RGBA')


def black_key(rgb):
    a = np.asarray(rgb).astype(np.float32)
    lum = a.max(axis=-1)
    alpha = np.clip(lum, 0, 255)
    out = np.concatenate([a, alpha[..., None]], axis=-1)
    return Image.fromarray(out.astype(np.uint8), 'RGBA')


def save_webp(im, path):
    im.save(path, 'WEBP', quality=95, method=6)


def place_body(src, cx_frac, cy_frac, r_frac_h, halo_color=(255, 205, 130), halo_alpha=110):
    a = np.asarray(src.convert('RGB')).astype(int)
    lum = a.max(axis=2)
    ys, xs = np.where(lum > 28)
    x0, y0, x1, y1 = int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())
    disc = src.crop((x0, y0, x1 + 1, y1 + 1))
    r_target = r_frac_h * MASK_H
    cur_r = max(x1 - x0, y1 - y0) / 2.0
    scale = r_target / cur_r
    nw, nh = max(1, int(disc.width * scale)), max(1, int(disc.height * scale))
    disc = disc.resize((nw, nh), Image.LANCZOS)
    cx, cy = int(cx_frac * MASK_W), int(cy_frac * MASK_H)
    canvas = Image.new('RGB', (MASK_W, MASK_H), (0, 0, 0))
    # soft additive halo beneath the disc (fixes clipped halo edges)
    halo_r = int(r_target * 1.62)
    grad = np.zeros((halo_r * 2, halo_r * 2, 3), dtype=np.float32)
    yy, xx = np.mgrid[-halo_r:halo_r, -halo_r:halo_r]
    dist = np.sqrt(xx * xx + yy * yy) / halo_r
    fall = np.clip(1.0 - dist, 0, 1) ** 1.8
    for k, c in enumerate(halo_color):
        grad[..., k] = fall * (c / 255.0) * (halo_alpha / 255.0)
    halo = Image.fromarray((grad * 255).astype(np.uint8))
    halo_mask = Image.fromarray((fall * 255).astype(np.uint8), 'L')
    canvas.paste(halo, (cx - halo_r, cy - halo_r), halo_mask)
    canvas.paste(disc, (cx - nw // 2, cy - nh // 2))
    return canvas


def slice_grid(im, ncols, nrows):
    a = np.asarray(im)[..., 3]
    ys, xs = np.where(a > 16)
    if xs.size == 0 or ys.size == 0:
        return []
    x0, x1 = int(xs.min()), int(xs.max()) + 1
    y0, y1 = int(ys.min()), int(ys.max()) + 1
    cw, ch = (x1 - x0) / ncols, (y1 - y0) / nrows
    frames = []
    for r in range(nrows):
        for c in range(ncols):
            fx0 = int(x0 + c * cw)
            fx1 = int(x0 + (c + 1) * cw)
            fy0 = int(y0 + r * ch)
            fy1 = int(y0 + (r + 1) * ch)
            cell = im.crop((fx0, fy0, fx1, fy1))
            b = np.asarray(cell)[..., 3]
            if b.max() <= 16:
                continue
            yy, xx = np.where(b > 16)
            frames.append((int(fx0 + xx.min()), int(fy0 + yy.min()),
                           int(fx0 + xx.max() + 1), int(fy0 + yy.max() + 1)))
    return frames


def lights_mask(img, thr=120):
    a = np.asarray(img)
    lum = np.zeros(a.shape[:2], dtype=np.float32)
    rgb = a[..., :3].astype(np.float32)
    vis = a[..., 3] > 24
    lum[vis] = rgb[vis].max(axis=-1)
    mask = np.clip((lum - thr) * 2.2, 0, 255).astype(np.uint8)
    return Image.fromarray(mask, 'L')


def half(rect):
    """1920x1080 rect -> 960x540 logical."""
    x0, y0, x1, y1 = rect
    return [x0 / 2, y0 / 2, (x1 - x0) / 2, (y1 - y0) / 2]


def main():
    civs = {}

    # ---------------- SUNWEAVER MENU ----------------
    swm = SRC + '/sunweaver-menu'
    d = OUT + '/front-end/civilizations/sunweaver/menu'
    os.makedirs(d, exist_ok=True)
    sky = load(swm + '/sky.png')
    body = place_body(load(swm + '/celestial-body.png'), 0.28, 0.26, 0.21)
    far = chroma_key(load(swm + '/far-terrain.png'))
    setl = chroma_key(load(swm + '/settlement.png'))
    fgd = chroma_key(load(swm + '/foreground.png'))
    atm = black_key(load(swm + '/atmosphere.png'))
    ships = chroma_key(load(swm + '/ships.png'))
    thrust = black_key(load(swm + '/ship-thrusters-strip.png'))
    beacon = black_key(load(swm + '/beacon-strip.png'))
    flag = chroma_key(load(swm + '/flag-strip.png'))
    energy = black_key(load(swm + '/energy-strip.png'))

    save_webp(sky, d + '/sky.webp')
    save_webp(body, d + '/celestial-body.webp')
    save_webp(far, d + '/far-terrain.webp')
    save_webp(setl, d + '/settlement.webp')
    save_webp(fgd, d + '/foreground.webp')
    save_webp(atm, d + '/atmosphere.webp')
    ships.save(d + '/ships.png')
    thrust.save(d + '/ship-thrusters-strip.png')
    beacon.save(d + '/beacon-strip.png')
    flag.save(d + '/flag-strip.png')
    energy.save(d + '/energy-strip.png')
    lights_mask(setl, 135).save(d + '/lights-mask.png')

    ships_frames = slice_grid(ships, 2, 2)
    thrust_frames = slice_grid(thrust, 5, 1)
    beacon_frames = slice_grid(beacon, 5, 1)
    flag_frames = slice_grid(flag, 4, 2)
    energy_frames = slice_grid(energy, 4, 2)

    civs['sunweaver'] = {
        'menu': {
            'scene': 'sunweaver-capital', 'mode': 'menu',
            'canvas': {'width': LOG_W, 'height': LOG_H},
            'assets': [
                {'file': 'sky.webp', 'kind': 'cover', 'blend': 'source-over'},
                {'file': 'celestial-body.webp', 'kind': 'cover', 'blend': 'screen'},
                {'file': 'far-terrain.webp', 'kind': 'cover', 'blend': 'source-over'},
                {'file': 'settlement.webp', 'kind': 'rect', 'rect': [86, 130, 640, 360], 'blend': 'source-over'},
                {'file': 'foreground.webp', 'kind': 'cover', 'blend': 'source-over'},
                {'file': 'atmosphere.webp', 'kind': 'cover', 'blend': 'screen'},
            ],
            'sprites': [
                {'file': 'ships.png', 'frames': ships_frames, 'frameRate': 2,
                 'drift': {'amplitude': 4, 'phase': 0.7}, 'blend': 'source-over',
                 'places': [
                     {'frame': 0, 'box': [196, 204, 72, 46]},
                     {'frame': 1, 'box': [464, 228, 72, 40]},
                     {'frame': 2, 'box': [700, 206, 72, 46]},
                 ]},
                {'file': 'ship-thrusters-strip.png', 'frames': thrust_frames, 'frameRate': 12,
                 'blend': 'screen',
                 'places': [
                     {'frame': -1, 'box': [206, 214, 30, 34]},
                     {'frame': -1, 'box': [474, 234, 30, 28]},
                 ]},
                {'file': 'flag-strip.png', 'frames': flag_frames, 'frameRate': 8,
                 'blend': 'source-over',
                 'places': [{'frame': -1, 'box': [322, 86, 104, 66]}]},
                {'file': 'beacon-strip.png', 'frames': beacon_frames, 'frameRate': 6,
                 'blend': 'screen',
                 'places': [
                     {'frame': -1, 'box': [238, 112, 52, 52]},
                     {'frame': -1, 'box': [104, 404, 44, 44]},
                 ]},
                {'file': 'energy-strip.png', 'frames': energy_frames, 'frameRate': 8,
                 'blend': 'screen',
                 'places': [{'frame': -1, 'box': [216, 166, 76, 112]}]},
            ],
            'twinkles': {'mask': 'lights-mask.png', 'fps': 6},
            'fallbackPalette': ['#26151e', '#e1834e', '#f6c95f', '#0d1424', '#120f17'],
        },
        'loading': None,
    }

    # ---------------- GRAVEMARK MENU ----------------
    gvm = SRC + '/gravemark-menu'
    d = OUT + '/front-end/civilizations/gravemark/menu'
    os.makedirs(d, exist_ok=True)
    sky = load(gvm + '/sky.png')
    body = place_body(load(gvm + '/celestial-body.png'), 0.26, 0.22, 0.17)
    far = chroma_key(load(gvm + '/far-terrain.png'))
    city = chroma_key(load(gvm + '/quarry-city.png'))
    fgd = chroma_key(load(gvm + '/foreground.png'))
    atm = black_key(load(gvm + '/atmosphere.png'))
    skim = chroma_key(load(gvm + '/grav-skimmers.png'))
    crane = chroma_key(load(gvm + '/crane-strip.png'))
    mineral = chroma_key(load(gvm + '/mineral-strip.png'))
    gfield = black_key(load(gvm + '/gravity-field-strip.png'))

    save_webp(sky, d + '/sky.webp')
    save_webp(body, d + '/celestial-body.webp')
    save_webp(far, d + '/far-terrain.webp')
    save_webp(city, d + '/quarry-city.webp')
    save_webp(fgd, d + '/foreground.webp')
    save_webp(atm, d + '/atmosphere.webp')
    skim.save(d + '/grav-skimmers.png')
    crane.save(d + '/crane-strip.png')
    mineral.save(d + '/mineral-strip.png')
    gfield.save(d + '/gravity-field-strip.png')
    lights_mask(city, 150).save(d + '/lights-mask.png')

    civs['gravemark'] = {'menu': {
        'scene': 'gravemark-quarry', 'mode': 'menu',
        'canvas': {'width': LOG_W, 'height': LOG_H},
        'assets': [
            {'file': 'sky.webp', 'kind': 'cover', 'blend': 'source-over'},
            {'file': 'celestial-body.webp', 'kind': 'cover', 'blend': 'screen'},
            {'file': 'far-terrain.webp', 'kind': 'cover', 'blend': 'source-over'},
            {'file': 'quarry-city.webp', 'kind': 'rect', 'rect': [29, 205, 451, 254], 'blend': 'source-over'},
            {'file': 'foreground.webp', 'kind': 'cover', 'blend': 'source-over'},
            {'file': 'atmosphere.webp', 'kind': 'cover', 'blend': 'screen'},
        ],
        'sprites': [
            {'file': 'grav-skimmers.png', 'frames': slice_grid(skim, 2, 2), 'frameRate': 2,
             'drift': {'amplitude': 4, 'phase': 1.1}, 'blend': 'source-over',
             'places': [
                 {'frame': 0, 'box': [252, 268, 110, 58]},
                 {'frame': 1, 'box': [392, 300, 110, 58]},
                 {'frame': 2, 'box': [316, 236, 110, 58]},
             ]},
            {'file': 'crane-strip.png', 'frames': slice_grid(crane, 3, 2), 'frameRate': 6,
             'blend': 'source-over',
             'places': [{'frame': -1, 'box': [46, 196, 150, 168]}]},
            {'file': 'mineral-strip.png', 'frames': slice_grid(mineral, 3, 2), 'frameRate': 6,
             'blend': 'source-over',
             'places': [{'frame': -1, 'box': [84, 308, 150, 104]}]},
            {'file': 'gravity-field-strip.png', 'frames': slice_grid(gfield, 4, 2), 'frameRate': 8,
             'blend': 'screen',
             'places': [{'frame': -1, 'box': [516, 118, 78, 78]}]},
        ],
        'twinkles': {'mask': 'lights-mask.png', 'fps': 6},
        'fallbackPalette': ['#0a111b', '#203548', '#81c8bb', '#0c141c', '#080e14'],
    }, 'loading': None}

    # ---------------- SUNWEAVER LOADING ----------------
    swl = SRC + '/sunweaver-loading'
    d = OUT + '/front-end/civilizations/sunweaver/loading'
    os.makedirs(d, exist_ok=True)
    save_webp(load(swm + '/sky.png'), d + '/sky.webp')
    save_webp(place_body(load(swm + '/celestial-body.png'), 0.28, 0.26, 0.21), d + '/celestial-body.webp')
    setl = chroma_key(load(swl + '/settlement.png'))
    fgd = chroma_key(load(swl + '/foreground.png'))
    save_webp(setl, d + '/settlement.webp')
    save_webp(fgd, d + '/foreground.webp')
    save_webp(atm, d + '/atmosphere.webp')
    carrier = chroma_key(load(swl + '/carrier.png'))
    drop = chroma_key(load(swl + '/dropships.png'))
    carrier.save(d + '/carrier.png')
    drop.save(d + '/dropships.png')
    thrust.save(d + '/thrusters-strip.png')
    beacon.save(d + '/beacon-strip.png')

    civs['sunweaver']['loading'] = {
        'scene': 'sunweaver-capital', 'mode': 'loading',
        'canvas': {'width': LOG_W, 'height': LOG_H},
        'assets': [
            {'file': 'sky.webp', 'kind': 'cover', 'blend': 'source-over'},
            {'file': 'celestial-body.webp', 'kind': 'cover', 'blend': 'screen'},
            {'file': 'settlement.webp', 'kind': 'rect', 'rect': [446, 108, 500, 281], 'blend': 'source-over'},
            {'file': 'foreground.webp', 'kind': 'cover', 'blend': 'source-over'},
            {'file': 'atmosphere.webp', 'kind': 'cover', 'blend': 'screen'},
        ],
        'sprites': [
            {'file': 'carrier.png', 'frames': slice_grid(carrier, 1, 1), 'frameRate': 2,
             'drift': {'amplitude': 3, 'phase': 2.2}, 'blend': 'source-over',
             'places': [{'frame': -1, 'box': [66, 150, 300, 168]}]},
            {'file': 'thrusters-strip.png', 'frames': thrust_frames, 'frameRate': 12,
             'blend': 'screen',
             'places': [
                 {'frame': -1, 'box': [88, 264, 44, 54]},
                 {'frame': -1, 'box': [192, 264, 44, 54]},
             ]},
            {'file': 'dropships.png', 'frames': slice_grid(drop, 2, 1), 'frameRate': 2,
             'drift': {'amplitude': 4, 'phase': 3.1}, 'blend': 'source-over',
             'places': [
                 {'frame': 0, 'box': [742, 186, 130, 66]},
                 {'frame': 1, 'box': [612, 122, 130, 66]},
             ]},
            {'file': 'beacon-strip.png', 'frames': beacon_frames, 'frameRate': 6, 'blend': 'screen',
             'places': [{'frame': -1, 'box': [470, 396, 52, 52]}]},
        ],
        'fallbackPalette': ['#26151e', '#e1834e', '#f6c95f', '#0d1424', '#120f17'],
    }

    # ---------------- GRAVEMARK LOADING ----------------
    gvl = SRC + '/gravemark-loading'
    d = OUT + '/front-end/civilizations/gravemark/loading'
    os.makedirs(d, exist_ok=True)
    save_webp(load(gvm + '/sky.png'), d + '/sky.webp')
    save_webp(place_body(load(gvm + '/celestial-body.png'), 0.26, 0.22, 0.17,
                         halo_color=(200, 230, 240), halo_alpha=70), d + '/celestial-body.webp')
    fort = chroma_key(load(gvl + '/fortress.png'))
    save_webp(fort, d + '/fortress.webp')
    save_webp(chroma_key(load(gvm + '/foreground.png')), d + '/foreground.webp')
    save_webp(black_key(load(gvm + '/atmosphere.png')), d + '/atmosphere.webp')
    hc = chroma_key(load(gvl + '/heavy-carrier.png'))
    pods = chroma_key(load(gvl + '/drop-pods.png'))
    hc.save(d + '/heavy-carrier.png')
    pods.save(d + '/drop-pods.png')
    gthrust = black_key(load(gvl + '/thrusters-strip.png'))
    gthrust.save(d + '/thrusters-strip.png')
    gbeam = black_key(load(gvl + '/gravity-beam-strip.png'))
    gbeam.save(d + '/gravity-beam-strip.png')

    civs['gravemark']['loading'] = {
        'scene': 'gravemark-quarry', 'mode': 'loading',
        'canvas': {'width': LOG_W, 'height': LOG_H},
        'assets': [
            {'file': 'sky.webp', 'kind': 'cover', 'blend': 'source-over'},
            {'file': 'celestial-body.webp', 'kind': 'cover', 'blend': 'screen'},
            {'file': 'fortress.webp', 'kind': 'rect', 'rect': [360, 216, 560, 315], 'blend': 'source-over'},
            {'file': 'foreground.webp', 'kind': 'cover', 'blend': 'source-over'},
            {'file': 'atmosphere.webp', 'kind': 'cover', 'blend': 'screen'},
        ],
        'sprites': [
            {'file': 'heavy-carrier.png', 'frames': slice_grid(hc, 1, 1), 'frameRate': 2,
             'drift': {'amplitude': 2, 'phase': 1.7}, 'blend': 'source-over',
             'places': [{'frame': -1, 'box': [30, 170, 320, 172]}]},
            {'file': 'thrusters-strip.png', 'frames': slice_grid(gthrust, 5, 1), 'frameRate': 12,
             'blend': 'screen',
             'places': [
                 {'frame': -1, 'box': [66, 304, 40, 52]},
                 {'frame': -1, 'box': [196, 304, 40, 52]},
             ]},
            {'file': 'drop-pods.png', 'frames': slice_grid(pods, 2, 1), 'frameRate': 2,
             'drift': {'amplitude': 3, 'phase': 4.0}, 'blend': 'source-over',
             'places': [
                 {'frame': 0, 'box': [726, 160, 110, 104]},
                 {'frame': 1, 'box': [608, 258, 110, 104]},
             ]},
            {'file': 'gravity-beam-strip.png', 'frames': slice_grid(gbeam, 4, 2), 'frameRate': 8,
             'blend': 'screen',
             'places': [
                 {'frame': -1, 'box': [804, 24, 96, 400]},
                 {'frame': -1, 'box': [70, 388, 80, 240]},
             ]},
        ],
        'fallbackPalette': ['#0a111b', '#203548', '#81c8bb', '#0c141c', '#080e14'],
    }

    for civ, modes in civs.items():
        with open(f'{OUT}/front-end/civilizations/{civ}/manifest.json', 'w') as f:
            json.dump(modes, f, indent=1)
    mdir = f'{OUT}/masters'
    os.makedirs(mdir, exist_ok=True)
    masters = {
        'sunweaver-menu': '/tmp/aaa-art/candidates/sun-menu-v2.png',
        'gravemark-menu': '/tmp/aaa-art/candidates/grav-menu-v2.png',
        'sunweaver-loading': '/tmp/aaa-art/candidates/sun-loading-v1.png',
        'gravemark-loading': '/tmp/aaa-art/candidates/grav-loading-v2.png',
    }
    for name, path in masters.items():
        im = Image.open(path).convert('RGB')
        big = im.resize((2048, 1152), Image.NEAREST).crop((CX, CY, CX + MASK_W, CY + MASK_H))
        big.save(f'{mdir}/{name}.png')
    print('OK - out:', OUT)


if __name__ == '__main__':
    main()
