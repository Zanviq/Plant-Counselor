#!/usr/bin/env python3
"""
Plant-Counselor — Imagen AI asset generator.
Generates each asset via Imagen API, removes background, resizes to spec.
"""
import os, json, base64, io, urllib.request, urllib.error, time
from PIL import Image
import numpy as np

API_KEY = os.environ.get("GEMINI_API_KEY", "")
MODEL   = "imagen-4.0-generate-001"
API_URL = f"https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:predict?key={API_KEY}"

try:
    LANCZOS = Image.LANCZOS
except AttributeError:
    LANCZOS = Image.ANTIALIAS  # Pillow < 9.1

# ─── API helpers ─────────────────────────────────────────────────────────────
def call_imagen(prompt, retries=3):
    body = json.dumps({
        "instances": [{"prompt": prompt}],
        "parameters": {"sampleCount": 1}
    }).encode()
    req = urllib.request.Request(
        API_URL, data=body,
        headers={"Content-Type": "application/json"}, method="POST"
    )
    for attempt in range(1, retries+1):
        try:
            with urllib.request.urlopen(req, timeout=120) as resp:
                result = json.loads(resp.read())
            b64 = result["predictions"][0]["bytesBase64Encoded"]
            return Image.open(io.BytesIO(base64.b64decode(b64))).convert("RGBA")
        except Exception as e:
            print(f"    attempt {attempt} failed: {e}")
            if attempt < retries:
                time.sleep(3)
    return None

# ─── Post-processing ──────────────────────────────────────────────────────────
def remove_bg(img, tolerance=45):
    """Remove background by sampling the 4 corners."""
    data = np.array(img)
    h, w = data.shape[:2]
    corners = np.array([data[0,0,:3], data[0,-1,:3],
                        data[-1,0,:3], data[-1,-1,:3]], dtype=float)
    bg = np.mean(corners, axis=0).astype(int)
    diff = np.abs(data[:,:,:3].astype(int) - bg.reshape(1,1,3)).max(axis=2)
    data[diff < tolerance, 3] = 0
    return Image.fromarray(data)

def crop_to_ratio(img, tw, th):
    """Center-crop to match target w:h ratio."""
    sw, sh = img.size
    if sw == 0 or sh == 0:
        return img
    target_r = tw / th
    src_r    = sw / sh
    if abs(src_r - target_r) < 0.02:
        return img
    if src_r > target_r:          # too wide → trim left/right
        nw = int(sh * target_r)
        x0 = (sw - nw) // 2
        img = img.crop((x0, 0, x0 + nw, sh))
    else:                          # too tall → trim top/bottom
        nh = int(sw / target_r)
        y0 = (sh - nh) // 2
        img = img.crop((0, y0, sw, y0 + nh))
    return img

def resize_to(img, tw, th):
    """Crop to aspect ratio then resize; use stepped downsample for tiny."""
    img = crop_to_ratio(img, tw, th)
    if max(tw, th) <= 64:
        # Stepped: first to 4× via LANCZOS, then NEAREST
        mid_w, mid_h = tw * 4, th * 4
        if img.size[0] > mid_w:
            img = img.resize((mid_w, mid_h), LANCZOS)
    return img.resize((tw, th), LANCZOS)

def save_png(img, path):
    os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
    img.save(path, "PNG")

# ─── Per-asset generator ─────────────────────────────────────────────────────
def gen(path, tw, th, prompt, remove_background=True):
    name = os.path.basename(path)
    print(f"  [{name}]  {tw}×{th}  ", end="", flush=True)

    full_prompt = (
        "pixel art game sprite, sharp edges, " + prompt
        + ", centered subject, clean white background"
    )
    img = call_imagen(full_prompt)
    if img is None:
        print("SKIP (API error)")
        return False

    if remove_background:
        img = remove_bg(img)
    img = resize_to(img, tw, th)
    save_png(img, path)
    print(f"saved  ({img.size[0]}×{img.size[1]})")
    return True

# ─── Asset list ───────────────────────────────────────────────────────────────
P = "assets/pixels"

ASSETS = [
    # ── tree_oak ──────────────────────────────────────────────────────────
    (f"{P}/plants/tree_oak/seed.png",    16, 16,
     "single acorn seed sitting on a thin soil line, dark brown/green acorn with small cap, centered, minimal"),

    (f"{P}/plants/tree_oak/bud.png",     32, 32,
     "small green plant bud on short stem, closed bud at top, 2 tiny leaves, no pot, early stage"),

    (f"{P}/plants/tree_oak/stem_a.png",  32, 48,
     "bare oak sapling stem with 2 short horizontal branches, NO leaves NO flowers, dark green trunk, vertical"),

    (f"{P}/plants/tree_oak/stem_b.png",  32, 64,
     "taller bare oak sapling with 4 horizontal branches, NO leaves NO flowers, darker green trunk, vertical"),

    (f"{P}/plants/tree_oak/leaf_a.png",  32, 48,
     "sparse small oak leaves only, leaves positioned at branch tips, no visible stem, transparent areas, side-spread"),

    (f"{P}/plants/tree_oak/leaf_b.png",  32, 64,
     "fuller oak leaf clusters only, denser leaves at branch tips, no stem, lush green"),

    (f"{P}/plants/tree_oak/flower.png",  32, 64,
     "small oak flower clusters only, tiny yellow-green flower tufts at branch tips, no stem, spring"),

    (f"{P}/plants/tree_oak/fruit.png",   32, 64,
     "small acorns only hanging from branch positions, 4 ripe acorns with caps, no stem, autumn"),

    (f"{P}/plants/tree_oak/wilting.png", 32, 64,
     "wilting plant overlay, drooping yellowing brown leaves, dry withered patches, semi-sparse"),

    (f"{P}/plants/tree_oak/rot.png",     32, 64,
     "dark rotted plant silhouette, collapsed blackened twisted remains, no leaves, dark moody"),

    # ── Pot ───────────────────────────────────────────────────────────────
    (f"{P}/pots/pot_clay.png",           48, 32,
     "terracotta clay flower pot front view, wider at top, warm orange-brown color, simple clean pot, no plant"),

    # ── Floor ─────────────────────────────────────────────────────────────
    (f"{P}/floor/grass_01.png",          64, 16,
     "pixel art grass strip, horizontal band, short upward grass blades variation A, green, seamless tile"),

    (f"{P}/floor/grass_02.png",          64, 16,
     "pixel art grass strip, horizontal band, short upward grass blades variation B, green, seamless tile"),

    (f"{P}/floor/deco_grass_tuft.png",   16, 12,
     "tiny clump of 3-4 grass blades, small grass tuft decoration, isolated"),

    # ── Background ────────────────────────────────────────────────────────
    (f"{P}/background/sky_day.png",      320, 180,
     "pixel art daytime sky background, pale blue-green sky, soft cloud pixel clusters, very subtle, calming",
     False),   # do NOT remove background

    (f"{P}/background/sky_night.png",    320, 180,
     "pixel art night sky background, deep dark teal sky, tiny white star dots scattered, calm night, 16:9",
     False),

    # ── Icons (24×24) ─────────────────────────────────────────────────────
    (f"{P}/icons/home.png",              24, 24,
     "minimal line icon, simple house outline, 2px stroke, dark color, app navigation icon"),

    (f"{P}/icons/plant.png",             24, 24,
     "minimal line icon, potted plant outline, small pot with stem and leaves, 2px stroke, dark"),

    (f"{P}/icons/calendar.png",          24, 24,
     "minimal line icon, calendar page with two ring binders at top, grid lines, 2px stroke, dark"),

    (f"{P}/icons/chat.png",              24, 24,
     "minimal line icon, chat speech bubble outline with tail, 2px stroke, dark"),

    (f"{P}/icons/settings.png",          24, 24,
     "minimal line icon, gear/cogwheel outline, round gear shape, 2px stroke, dark"),

    # ── Character ─────────────────────────────────────────────────────────
    (f"{P}/characters/ai_avatar.png",    64, 64,
     "cute pixel art mascot, friendly round leaf face, big green leaf shape as face, tiny dot eyes and small smile, plant counselor mascot"),

    # ── Logo ──────────────────────────────────────────────────────────────
    ("assets/logo/logo_mark.png",        128, 128,
     "app logo mark, square frame with rounded corners, stylized leaf growing from small pot inside frame, tiny heart at top-left corner, minimal line illustration, dark green color, clean"),

    ("assets/logo/logo_full.png",        360, 128,
     "app logo, square leaf-pot logo mark on left, word 'Plant' in clean sans-serif on right, dark green, horizontal layout, brand identity, transparent background"),

    ("assets/logo/logo_wordmark.png",    240, 96,
     "wordmark only, the word 'Plant' in clean rounded sans-serif font, with a short underline below, dark green color"),

    ("assets/logo/logo_mono_dark.png",   360, 128,
     "app logo inverted, light cream/white logo mark and text on dark green background, same as logo_full but dark theme"),
]

# Build full task list (add bg_remove=True default where not specified)
def _norm(t):
    if len(t) == 5:
        return t                    # already has bg_remove flag
    return (*t, True)               # default: remove background

TASKS = [_norm(t) for t in ASSETS]

# ─── @2x icons + logo_mark ────────────────────────────────────────────────────
SCALE2X_SOURCES = {
    f"{P}/icons/home.png":       f"{P}/icons/home@2x.png",
    f"{P}/icons/plant.png":      f"{P}/icons/plant@2x.png",
    f"{P}/icons/calendar.png":   f"{P}/icons/calendar@2x.png",
    f"{P}/icons/chat.png":       f"{P}/icons/chat@2x.png",
    f"{P}/icons/settings.png":   f"{P}/icons/settings@2x.png",
    "assets/logo/logo_mark.png": "assets/logo/logo_mark@2x.png",
}

# ─── Vignette (programmatic — Imagen can't do alpha gradients) ────────────────
def make_vignette():
    import struct, zlib
    w, h = 320, 180
    dr, dg, db = 0x22, 0x3B, 0x2F  # #223B2F
    raw = b''
    for y in range(h):
        raw += b'\x00'
        for x in range(w):
            fx = abs(x - w//2) / (w//2)
            fy = abs(y - h//2) / (h//2)
            strength = max(fx, fy) ** 2
            alpha = min(255, int(210 * strength))
            raw += bytes([dr, dg, db, alpha])
    def chunk(tag, data):
        body = tag + data
        return struct.pack('>I', len(data)) + body + struct.pack('>I', zlib.crc32(body) & 0xffffffff)
    sig = b'\x89PNG\r\n\x1a\n'
    ihdr = chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 6, 0, 0, 0))
    idat = chunk(b'IDAT', zlib.compress(raw, 9))
    iend = chunk(b'IEND', b'')
    path = f"{P}/background/vignette_overlay.png"
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'wb') as f:
        f.write(sig + ihdr + idat + iend)
    print(f"  [vignette_overlay.png]  320×180  saved (programmatic)")

# ─── Main ─────────────────────────────────────────────────────────────────────
def main():
    if not API_KEY:
        print("ERROR: GEMINI_API_KEY not set.")
        return

    done = skipped = 0
    for path, tw, th, prompt, bg_remove in TASKS:
        ok = gen(path, tw, th, prompt, bg_remove)
        if ok:
            done += 1
            time.sleep(0.4)   # gentle rate limit
        else:
            skipped += 1

    # Programmatic vignette
    make_vignette()
    done += 1

    # Create @2x by scaling source images
    print("\n── @2x versions")
    for src, dst in SCALE2X_SOURCES.items():
        if os.path.exists(src):
            img = Image.open(src)
            img2 = img.resize((img.width*2, img.height*2), Image.NEAREST)
            save_png(img2, dst)
            print(f"  [{os.path.basename(dst)}]  {img2.size[0]}×{img2.size[1]}  saved")

    print(f"\n{'='*50}")
    print(f"Done: {done} generated, {skipped} skipped")
    print(f"Output: assets/")

if __name__ == "__main__":
    main()
