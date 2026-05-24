"""
Plant Counselor pixel-art sprite generator v5.

Style: potted houseplant — green curving stem, round leaves, white pot.
Each plant is ONE composite image (stem+leaves+pot) with bud slot coords.
Buds are separate small sprites placed by the frontend.

Key changes from v4:
- Green stem (not brown tree trunk)
- Curved/organic stem shapes
- Rounder, bigger leaf clusters
- Pot integrated into same image (no separate pot file)
- Larger canvas (200x280 actual)
- Sky background image generated
- Auto-crop with bbox tracking for slot coord adjustment
"""
from __future__ import annotations
import json, math, random
from pathlib import Path
from PIL import Image, ImageDraw

OUT = Path(__file__).parent.parent / "assets" / "sprites"
OUT.mkdir(parents=True, exist_ok=True)

SCALE = 4
MAX_BUDS = 6

# Palette
P = {
    "stem":      (88, 145, 62),
    "stem_dk":   (62, 112, 42),
    "stem_lt":   (115, 170, 85),
    "leaf":      (95, 160, 65),
    "leaf_dk":   (65, 125, 42),
    "leaf_lt":   (130, 192, 98),
    "leaf_pale": (170, 215, 140),
    "leaf_hi":   (185, 228, 155),
    # pot
    "pot":       (240, 234, 224),
    "pot_rim":   (250, 246, 238),
    "pot_dk":    (215, 208, 196),
    "pot_sh":    (198, 192, 180),
    "pot_acc":   (195, 215, 172),
    "soil":      (130, 105, 75),
    "soil_lt":   (155, 130, 98),
    # buds
    "petal_pk":  (238, 148, 168),
    "petal_dk":  (210, 112, 138),
    "center_y":  (248, 215, 78),
    "fruit_r":   (215, 62, 48),
    "fruit_hi":  (242, 108, 88),
    "fruit_dk":  (175, 40, 30),
    "gold":      (218, 178, 52),
    "gold_lt":   (252, 222, 108),
    "sparkle":   (255, 252, 218),
    "wilt":      (172, 148, 70),
    "wilt_dk":   (135, 112, 48),
    "seed_b":    (152, 135, 95),
    "seed_lt":   (185, 168, 128),
    "sprout":    (118, 178, 82),
    "sprout_dk": (82, 140, 55),
    # sky/ground
    "sky_top":   (200, 220, 235),
    "sky_bot":   (225, 238, 215),
    "grass":     (122, 176, 80),
    "grass_dk":  (90, 145, 55),
    "grass_lt":  (150, 200, 108),
}


def px(d, x, y, c, s=SCALE):
    d.rectangle([x*s, y*s, (x+1)*s-1, (y+1)*s-1], fill=c)

def mpx(d, pts, c, s=SCALE):
    for x, y in pts: px(d, x, y, c, s)

def filled_circle(d, cx, cy, r, c, s=SCALE):
    for dy in range(-r, r+1):
        for dx in range(-r, r+1):
            if dx*dx + dy*dy <= r*r:
                px(d, cx+dx, cy+dy, c, s)

def filled_ellipse(d, cx, cy, rx, ry, c, s=SCALE):
    for dy in range(-ry, ry+1):
        for dx in range(-rx, rx+1):
            if (dx*dx)/(rx*rx+0.01) + (dy*dy)/(ry*ry+0.01) <= 1.0:
                px(d, cx+dx, cy+dy, c, s)

def curve_points(x0, y0, x1, y1, bend, steps=20):
    mx, my = (x0+x1)/2 + bend, (y0+y1)/2 - abs(bend)*0.5
    pts = []
    for t_i in range(steps+1):
        t = t_i / steps
        x = (1-t)**2 * x0 + 2*(1-t)*t * mx + t**2 * x1
        y = (1-t)**2 * y0 + 2*(1-t)*t * my + t**2 * y1
        pts.append((round(x), round(y)))
    return pts

def draw_curve(d, x0, y0, x1, y1, bend, c, c_dk=None, s=SCALE):
    pts = curve_points(x0, y0, x1, y1, bend)
    for x, y in pts:
        px(d, x, y, c, s)
        if c_dk:
            px(d, x+1, y, c_dk, s)

def auto_crop(img):
    bbox = img.getbbox()
    if not bbox: return img, (0,0,0,0)
    return img.crop(bbox), bbox


# ── Plant composite (stem + leaves + pot) ───────────────────

CANVAS_LW, CANVAS_LH = 50, 70  # logical pixels
CANVAS_W, CANVAS_H = CANVAS_LW * SCALE, CANVAS_LH * SCALE  # 200x280

def make_plant():
    """Generate a complete plant: green curved stem, round leaves, white pot.
    Returns (image, slots) where slots are logical (x,y) bud attachment points."""
    img = Image.new("RGBA", (CANVAS_W, CANVAS_H), (0,0,0,0))
    d = ImageDraw.Draw(img)
    cx = 25  # center x

    # ── Pot (bottom) ──
    pot_top = 58
    # Rim
    for x in range(cx-10, cx+11):
        px(d, x, pot_top, P["pot_rim"])
        px(d, x, pot_top+1, P["pot_rim"])
    # Body
    for row in range(8):
        inset = row * 3 // 8
        for x in range(cx-9+inset, cx+10-inset):
            c = P["pot"]
            if x <= cx-8+inset: c = P["pot_dk"]
            elif x >= cx+8-inset: c = P["pot_sh"]
            px(d, x, pot_top+2+row, c)
    # Accent stripe
    for x in range(cx-7, cx+8):
        px(d, x, pot_top+4, P["pot_acc"])
    # Soil
    for x in range(cx-8, cx+9):
        px(d, x, pot_top+2, P["soil"])
    for x in range(cx-7, cx+8):
        px(d, x, pot_top+3, P["soil_lt"])

    # ── Main stem (curved green) ──
    stem_base_y = pot_top + 1  # where stem enters soil
    stem_top_y = 12

    # Draw main stem as a gentle S-curve
    main_pts = curve_points(cx, stem_base_y, cx+1, stem_top_y, bend=-2, steps=40)
    for x, y in main_pts:
        px(d, x, y, P["stem"])
        px(d, x-1, y, P["stem_dk"])

    # ── Branches + leaf clusters + bud slots ──
    slots = []

    branch_defs = [
        # (stem_y, direction, length, bend, leaf_size)
        (18, -1, 10, -3, 4),   # slot 0: upper-left
        (18, +1, 10, +3, 4),   # slot 1: upper-right
        (30, -1, 12, -4, 5),   # slot 2: mid-left (biggest)
        (30, +1, 12, +4, 5),   # slot 3: mid-right (biggest)
        (42, -1, 9,  -3, 4),   # slot 4: lower-left
        (42, +1, 9,  +3, 4),   # slot 5: lower-right
    ]

    for stem_y, direction, length, bend, leaf_r in branch_defs:
        bx0 = cx
        by0 = stem_y
        bx1 = cx + direction * length
        by1 = stem_y - 3  # branches angle upward slightly

        # Draw branch curve
        bpts = curve_points(bx0, by0, bx1, by1, bend=bend*0.5, steps=15)
        for x, y in bpts:
            px(d, x, y, P["stem_lt"])

        # Leaf cluster at branch tip
        tip_x, tip_y = bx1, by1
        # Main leaf (ellipse)
        filled_ellipse(d, tip_x, tip_y-1, leaf_r, leaf_r-1, P["leaf"])
        filled_ellipse(d, tip_x, tip_y-2, leaf_r-1, leaf_r-2, P["leaf_lt"])
        # Highlight
        px(d, tip_x-1, tip_y-leaf_r+1, P["leaf_hi"])
        px(d, tip_x, tip_y-leaf_r+1, P["leaf_hi"])
        # Shadow
        for dx in range(-leaf_r+1, leaf_r):
            px(d, tip_x+dx, tip_y+leaf_r-2, P["leaf_dk"])

        # Record slot position (bud attaches at top of leaf cluster)
        slots.append((tip_x, tip_y - leaf_r))

    # ── Top crown ──
    crown_cx, crown_cy = cx+1, stem_top_y
    filled_ellipse(d, crown_cx, crown_cy, 5, 4, P["leaf"])
    filled_ellipse(d, crown_cx, crown_cy-1, 4, 3, P["leaf_lt"])
    filled_ellipse(d, crown_cx, crown_cy-2, 3, 2, P["leaf_hi"])

    return img, slots


# ── Bud sprites (small, separate images) ────────────────────

BUD_LW, BUD_LH = 14, 14

def new_bud_canvas():
    return Image.new("RGBA", (BUD_LW*SCALE, BUD_LH*SCALE), (0,0,0,0))

def make_bud_seed():
    img = new_bud_canvas()
    d = ImageDraw.Draw(img)
    cx, cy = 7, 9
    # seed body only
    filled_ellipse(d, cx, cy, 2, 2, P["seed_b"])
    mpx(d, [(cx-1,cy-1),(cx,cy-1)], P["seed_lt"])
    # tiny sprout tip (no stem)
    mpx(d, [(cx-1,cy-3),(cx+1,cy-3)], P["sprout"])
    px(d, cx, cy-4, P["sprout_dk"])
    return img

def make_bud_sprout():
    img = new_bud_canvas()
    d = ImageDraw.Draw(img)
    cx, cy = 7, 9
    # just leaf cluster (no stem)
    filled_ellipse(d, cx-2, cy-1, 2, 2, P["leaf"])
    filled_ellipse(d, cx+2, cy-1, 2, 2, P["leaf"])
    px(d, cx-2, cy-2, P["leaf_lt"])
    px(d, cx+2, cy-2, P["leaf_lt"])
    filled_ellipse(d, cx, cy-3, 2, 2, P["leaf_lt"])
    px(d, cx, cy-4, P["leaf_hi"])
    return img

def make_bud_flower():
    img = new_bud_canvas()
    d = ImageDraw.Draw(img)
    cx, cy = 7, 7
    # petals only (5 around center, no stem)
    for angle_i in range(5):
        a = angle_i * 2 * math.pi / 5 - math.pi/2
        px_x = cx + round(math.cos(a)*3)
        px_y = cy + round(math.sin(a)*3)
        filled_circle(d, px_x, px_y, 1, P["petal_pk"])
    # center
    filled_circle(d, cx, cy, 1, P["center_y"])
    return img

def make_bud_fruit():
    img = new_bud_canvas()
    d = ImageDraw.Draw(img)
    cx, cy = 7, 7
    # fruit sphere only (no stem)
    filled_circle(d, cx, cy, 3, P["fruit_r"])
    # highlight
    filled_circle(d, cx-1, cy-1, 1, P["fruit_hi"])
    # shadow
    mpx(d, [(cx+2,cy+1),(cx+1,cy+2)], P["fruit_dk"])
    # tiny leaf on top
    px(d, cx, cy-4, P["leaf"])
    px(d, cx+1, cy-4, P["leaf_dk"])
    return img

def make_bud_wilted():
    img = new_bud_canvas()
    d = ImageDraw.Draw(img)
    cx, cy = 7, 8
    # droopy wilted shape only (no stem)
    mpx(d, [(cx-1,cy),(cx,cy),(cx+1,cy)], P["wilt"])
    mpx(d, [(cx-2,cy+1),(cx-3,cy+2),(cx+2,cy+1),(cx+3,cy+2)], P["wilt"])
    mpx(d, [(cx-3,cy+3),(cx+3,cy+3)], P["wilt_dk"])
    # droopy petal
    mpx(d, [(cx,cy-1),(cx+1,cy-1),(cx+2,cy-2)], P["wilt"])
    px(d, cx+2, cy-1, P["wilt_dk"])
    return img

def make_bud_harvested():
    img = new_bud_canvas()
    d = ImageDraw.Draw(img)
    cx, cy = 7, 8
    # sparkles only (no stem)
    for sx, sy in [(cx-3,cy-2),(cx+3,cy-3),(cx,cy-5),(cx-2,cy-4),(cx+2,cy-1)]:
        px(d, sx, sy, P["sparkle"])
    mpx(d, [(cx,cy-2),(cx-1,cy-1),(cx+1,cy-1)], P["gold"])
    mpx(d, [(cx+2,cy-2),(cx-1,cy-3)], P["gold_lt"])
    return img


# ── Sky background ──────────────────────────────────────────

def make_sky():
    w, h = 800, 400
    img = Image.new("RGBA", (w, h), (0,0,0,0))
    d = ImageDraw.Draw(img)
    for y in range(h):
        t = y / h
        r = int(P["sky_top"][0] * (1-t) + P["sky_bot"][0] * t)
        g = int(P["sky_top"][1] * (1-t) + P["sky_bot"][1] * t)
        b = int(P["sky_top"][2] * (1-t) + P["sky_bot"][2] * t)
        d.line([(0, y), (w, y)], fill=(r, g, b, 255))
    # Simple clouds
    random.seed(7)
    for _ in range(4):
        cloud_x = random.randint(50, 750)
        cloud_y = random.randint(30, 150)
        for dx in range(-20, 21):
            for dy in range(-6, 7):
                if dx*dx/400 + dy*dy/36 < 1:
                    a = int(60 * (1 - (dx*dx/400 + dy*dy/36)))
                    if 0 <= cloud_x+dx < w and 0 <= cloud_y+dy < h:
                        existing = img.getpixel((cloud_x+dx, cloud_y+dy))
                        nr = min(255, existing[0] + a)
                        ng = min(255, existing[1] + a)
                        nb = min(255, existing[2] + a)
                        img.putpixel((cloud_x+dx, cloud_y+dy), (nr, ng, nb, 255))
    return img


# ── Grass ───────────────────────────────────────────────────

def make_grass():
    w, h = 800, 32
    img = Image.new("RGBA", (w, h), (0,0,0,0))
    d = ImageDraw.Draw(img)
    lw = w // SCALE
    random.seed(42)
    for x in range(lw):
        for y in range(2, 8):
            px(d, x, y, P["grass"])
        px(d, x, 7, P["grass_dk"])
    for x in range(lw):
        if random.random() > 0.25:
            h_off = random.randint(0, 2)
            c = P["grass_lt"] if random.random() > 0.4 else P["grass"]
            px(d, x, 1-h_off, c)
    return img


# ── Generate ────────────────────────────────────────────────

BUD_TYPES = {
    "seed": make_bud_seed, "sprout": make_bud_sprout,
    "flower": make_bud_flower, "fruit": make_bud_fruit,
    "wilted": make_bud_wilted, "harvested": make_bud_harvested,
}

STATUS_MAP = {
    "seed": "seed", "bud": "sprout", "flower": "flower",
    "fruit": "fruit", "wilting": "wilted", "rot": "wilted",
    "harvested": "harvested",
}

def main():
    # Plant composite
    plant_img, raw_slots = make_plant()
    plant_cropped, (ox, oy, _, _) = auto_crop(plant_img)
    plant_cropped.save(OUT / "plant.png")
    slots = [{"x": sx*SCALE - ox, "y": sy*SCALE - oy} for sx, sy in raw_slots]
    pw, ph = plant_cropped.size
    print(f"  plant.png {pw}x{ph}, {len(slots)} slots")
    for i, s in enumerate(slots):
        print(f"    slot {i}: ({s['x']}, {s['y']})")

    # Bud sprites
    bud_info = {}
    for name, factory in BUD_TYPES.items():
        bimg = factory()
        bc, (bx, by, _, _) = auto_crop(bimg)
        bc.save(OUT / f"bud_{name}.png")
        bw, bh = bc.size
        bud_info[name] = {"file": f"bud_{name}.png", "width": bw, "height": bh, "anchor": {"x": bw//2, "y": bh}}
        print(f"  bud_{name}.png {bw}x{bh}")

    # Sky
    sky = make_sky()
    sky.save(OUT / "sky.png")
    print(f"  sky.png {sky.size[0]}x{sky.size[1]}")

    # Grass
    grass = make_grass()
    grass.save(OUT / "grass.png")
    print(f"  grass.png {grass.size[0]}x{grass.size[1]}")

    # Manifest
    manifest = {
        "max_buds": MAX_BUDS,
        "plant": {"file": "plant.png", "width": pw, "height": ph, "slots": slots},
        "buds": bud_info,
        "status_to_sprite": STATUS_MAP,
        "sky": {"file": "sky.png", "width": 800, "height": 400},
        "grass": {"file": "grass.png", "width": 800, "height": 32},
    }
    with open(OUT / "manifest.json", "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2, ensure_ascii=False)
    print(f"  manifest.json\nDone: {2+len(BUD_TYPES)+2} sprites")

if __name__ == "__main__":
    main()
