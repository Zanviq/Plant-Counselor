# UI Infrastructure Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the complete pygame UI infrastructure layer for Plant Counselor — design token system, render primitives, scene/widget framework, and all 19 specified files.

**Architecture:** ThemeManager provides typed design token lookups; FontRegistry, ShadowRenderer, TextRenderer, AssetLoader, PlantSprite form the render layer; SceneManager + BaseScene manage screen switching; BaseWidget and concrete widgets (Button, TextInput, Sidebar, ToastWidget, ModalWidget) compose the interactive UI. All color references go through `theme.color(key)` — no raw hex anywhere in widget code.

**Tech Stack:** Python 3.11+, pygame >= 2.5.0, no additional dependencies (all stdlib beyond pygame)

---

## File Map

| File | Responsibility |
|------|---------------|
| `app/ui/__init__.py` | Package marker |
| `app/ui/theme_manager.py` | Design token store + typed accessor methods |
| `app/ui/render/__init__.py` | Package marker |
| `app/ui/render/font_registry.py` | Pygame font cache; file + system fallback |
| `app/ui/render/text_renderer.py` | Multi-line draw, measure, wrap |
| `app/ui/render/shadow_renderer.py` | Box shadow simulation + rounded rect draw |
| `app/ui/render/animator.py` | Tween + Animator for time-based interpolation |
| `app/ui/render/asset_loader.py` | Image cache; typed helpers (icon, plant_layer, pot…) |
| `app/ui/render/plant_sprite.py` | Layer compositing for plant visuals |
| `app/ui/scene_manager.py` | Screen switching + overlay stack |
| `app/ui/scenes/__init__.py` | Package marker |
| `app/ui/scenes/base_scene.py` | Abstract base for all scenes |
| `app/ui/widgets/__init__.py` | Package marker |
| `app/ui/widgets/base_widget.py` | Abstract base for all widgets |
| `app/ui/widgets/button.py` | Button — primary/secondary/ghost/icon variants |
| `app/ui/widgets/text_input.py` | Text input — default/search/password/chat variants |
| `app/ui/widgets/sidebar.py` | 72 px navigation sidebar |
| `app/ui/widgets/toast_widget.py` | Slide-in/out notification toasts |
| `app/ui/widgets/modal_widget.py` | Centered confirm/cancel dialog overlay |

---

## Task 1: Package Init Files (빈 파일 4개)

**Files:**
- Create: `app/ui/__init__.py`
- Create: `app/ui/render/__init__.py`
- Create: `app/ui/scenes/__init__.py`
- Create: `app/ui/widgets/__init__.py`

- [ ] **Step 1: Create the four empty package init files**

```python
# app/ui/__init__.py  (empty — just a package marker)
```
```python
# app/ui/render/__init__.py  (empty)
```
```python
# app/ui/scenes/__init__.py  (empty)
```
```python
# app/ui/widgets/__init__.py  (empty)
```

Use Write tool for each. Content is a single newline.

- [ ] **Step 2: Verify importability (no pygame needed yet)**

```bash
cd C:\Users\jaemi\Documents\Project\plant-counselor
python -c "import app.ui; import app.ui.render; import app.ui.scenes; import app.ui.widgets; print('OK')"
```
Expected output: `OK`

- [ ] **Step 3: Commit**

```bash
git add app/ui/__init__.py app/ui/render/__init__.py app/ui/scenes/__init__.py app/ui/widgets/__init__.py
git commit -m "feat(ui): add package init files for ui, render, scenes, widgets"
```

---

## Task 2: ThemeManager

**Files:**
- Create: `app/ui/theme_manager.py`

- [ ] **Step 1: Write the file**

```python
# app/ui/theme_manager.py
import datetime


class ThemeManager:
    """Provides typed access to all design tokens."""

    def __init__(self):
        self.variant = "light_default"
        self._tokens = {
            "colors": {
                # Background
                "bg.app":          "#F6F8F1",
                "bg.surface":      "#FFFFFF",
                "bg.surface_soft": "#EEF4E9",
                "border.subtle":   "#D9E1D6",
                # Text
                "text.primary":    "#18231D",
                "text.muted":      "#667267",
                "text.inverse":    "#FFFFFF",
                # Brand
                "brand.primary_leaf": "#4E7E4D",
                "brand.deep_stem":    "#223B2F",
                "brand.leaf_soft":    "#CFE3C2",
                "brand.mint_growth":  "#9CCB8C",
                # Accent
                "accent.amber_schedule": "#D7B16A",
                "accent.lavender_ai":    "#A78BFA",
                "accent.yellow_bloom":   "#F2C94C",
                "accent.rose_care":      "#E88C83",
            },
            "spacing": {
                "space.0":  0,
                "space.1":  4,
                "space.2":  8,
                "space.3":  12,
                "space.4":  16,
                "space.5":  20,
                "space.6":  24,
                "space.8":  32,
                "space.10": 40,
                "space.12": 48,
            },
            "radius": {
                "radius.sm":   6,
                "radius.md":   10,
                "radius.lg":   14,
                "radius.xl":   20,
                "radius.pill": 999,
            },
            "shadows": {
                "shadow.sm": {"y": 1,  "blur": 2,  "alpha": 0.06},
                "shadow.md": {"y": 4,  "blur": 10, "alpha": 0.08},
                "shadow.lg": {"y": 12, "blur": 24, "alpha": 0.12},
            },
            "motion": {
                "motion.fast": 120,
                "motion.base": 200,
                "motion.slow": 320,
            },
            "typography": {
                # (size_px, is_bold)
                "text.display":   (28, True),
                "text.h1":        (20, True),
                "text.h2":        (16, True),
                "text.body":      (14, False),
                "text.body_sm":   (13, False),
                "text.caption":   (12, False),
                "text.number_lg": (32, True),
                "text.label":     (13, False),
                "text.mono":      (13, False),
            },
        }

    # ------------------------------------------------------------------
    # Color
    # ------------------------------------------------------------------

    def color(self, key: str) -> tuple:
        """Return an RGB tuple for a color token key.

        Falls back to hot pink (255, 0, 255) so undefined keys are obvious.
        """
        hex_str = self._tokens["colors"].get(key, "#FF00FF")
        return self._hex_to_rgb(hex_str)

    def color_alpha(self, key: str, alpha: float) -> tuple:
        """Return an RGBA tuple (0-255). alpha is 0.0-1.0."""
        r, g, b = self.color(key)
        return (r, g, b, int(alpha * 255))

    # ------------------------------------------------------------------
    # Spacing / radius / shadow / motion
    # ------------------------------------------------------------------

    def space(self, key: str) -> int:
        return self._tokens["spacing"].get(key, 0)

    def radius(self, key: str) -> int:
        return self._tokens["radius"].get(key, 0)

    def shadow(self, key: str) -> dict:
        return self._tokens["shadows"].get(key, {"y": 0, "blur": 0, "alpha": 0.0})

    def motion(self, key: str) -> int:
        """Return duration in milliseconds."""
        return self._tokens["motion"].get(key, 200)

    # ------------------------------------------------------------------
    # Typography
    # ------------------------------------------------------------------

    def font_size(self, style_key: str) -> int:
        entry = self._tokens["typography"].get(style_key, (14, False))
        return entry[0]

    def is_bold(self, style_key: str) -> bool:
        entry = self._tokens["typography"].get(style_key, (14, False))
        return entry[1]

    # ------------------------------------------------------------------
    # Theme variant
    # ------------------------------------------------------------------

    def set_theme(self, variant: str) -> None:
        self.variant = variant

    def auto_pick_by_date(self) -> None:
        """Set seasonal theme variant based on current month."""
        month = datetime.date.today().month
        if month in (3, 4, 5):
            self.set_theme("light_spring")
        elif month in (6, 7, 8):
            self.set_theme("light_summer")
        elif month in (9, 10, 11):
            self.set_theme("light_autumn")
        else:
            self.set_theme("light_winter")

    # ------------------------------------------------------------------
    # Internal
    # ------------------------------------------------------------------

    @staticmethod
    def _hex_to_rgb(hex_str: str) -> tuple:
        h = hex_str.lstrip("#")
        return tuple(int(h[i:i+2], 16) for i in (0, 2, 4))
```

- [ ] **Step 2: Smoke-test without pygame**

```bash
cd C:\Users\jaemi\Documents\Project\plant-counselor
python -c "
from app.ui.theme_manager import ThemeManager
t = ThemeManager()
assert t.color('brand.primary_leaf') == (78, 126, 77), t.color('brand.primary_leaf')
assert t.color_alpha('bg.app', 0.5)[3] == 127
assert t.space('space.6') == 24
assert t.radius('radius.lg') == 14
assert t.shadow('shadow.md') == {'y': 4, 'blur': 10, 'alpha': 0.08}
assert t.motion('motion.base') == 200
assert t.font_size('text.h1') == 20
assert t.is_bold('text.h1') is True
assert t.is_bold('text.body') is False
t.auto_pick_by_date()
print('ThemeManager OK, variant=', t.variant)
"
```
Expected: `ThemeManager OK, variant= light_<season>`

- [ ] **Step 3: Commit**

```bash
git add app/ui/theme_manager.py
git commit -m "feat(ui): add ThemeManager with full design token store"
```

---

## Task 3: FontRegistry

**Files:**
- Create: `app/ui/render/font_registry.py`

- [ ] **Step 1: Write the file**

```python
# app/ui/render/font_registry.py
import os
import pygame


class FontRegistry:
    """Pygame font cache with file-first, system-Korean fallback strategy."""

    # Common sizes pre-loaded at startup
    _PRELOAD_SIZES = [12, 13, 14, 16, 20, 28, 32]

    def __init__(self, font_dir: str):
        """
        Parameters
        ----------
        font_dir:
            Absolute path to ``assets/fonts/`` directory.
        """
        self.font_dir = font_dir
        self._cache: dict[tuple, pygame.font.Font] = {}
        self._system_korean: str | None = None  # resolved lazily

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def get(self, style_key: str = "sans", size: int = 14, bold: bool = False) -> pygame.font.Font:
        """Return a cached pygame.font.Font.

        Parameters
        ----------
        style_key : "sans" | "mono" | "pixel"
        size      : pixel size
        bold      : whether bold variant is requested
        """
        cache_key = (style_key, size, bold)
        if cache_key in self._cache:
            return self._cache[cache_key]

        font = self._load_font(style_key, size, bold)
        self._cache[cache_key] = font
        return font

    def preload(self) -> None:
        """Pre-load commonly used size/style combinations into cache."""
        for size in self._PRELOAD_SIZES:
            for style in ("sans",):
                for bold in (False, True):
                    self.get(style, size, bold)

    # ------------------------------------------------------------------
    # Internal
    # ------------------------------------------------------------------

    def _load_font(self, style_key: str, size: int, bold: bool) -> pygame.font.Font:
        path = self._find_font_file(style_key, bold)
        if path:
            try:
                return pygame.font.Font(path, size)
            except Exception:
                pass  # fall through to system fallback

        # Try system Korean font
        sys_path = self._get_system_korean_font()
        if sys_path:
            try:
                return pygame.font.Font(sys_path, size)
            except Exception:
                pass

        # Last resort: pygame default
        return pygame.font.Font(None, size)

    def _find_font_file(self, style_key: str, bold: bool) -> str | None:
        """Return absolute path to font file if it exists, else None."""
        candidates: dict[tuple, list[str]] = {
            ("sans", True):  ["Pretendard-Bold.otf", "Pretendard-Bold.ttf"],
            ("sans", False): ["Pretendard-Regular.otf", "Pretendard-Regular.ttf"],
            ("mono", False): ["JetBrainsMono-Regular.ttf"],
            ("mono", True):  ["JetBrainsMono-Bold.ttf", "JetBrainsMono-Regular.ttf"],
            ("pixel", False): ["DungGeunMo.otf", "DungGeunMo.ttf"],
            ("pixel", True):  ["DungGeunMo.otf", "DungGeunMo.ttf"],
        }
        for fname in candidates.get((style_key, bold), []):
            path = os.path.join(self.font_dir, fname)
            if os.path.exists(path):
                return path
        return None

    def _get_system_korean_font(self) -> str | None:
        """Locate a system Korean font using pygame.font.match_font."""
        if self._system_korean is not None:
            return self._system_korean or None

        for name in [
            "malgun gothic",
            "malgungothic",
            "AppleGothic",
            "nanum gothic",
            "nanumgothic",
        ]:
            result = pygame.font.match_font(name)
            if result:
                self._system_korean = result
                return result

        self._system_korean = ""  # sentinel: searched, not found
        return None
```

- [ ] **Step 2: Verify (requires pygame)**

```bash
cd C:\Users\jaemi\Documents\Project\plant-counselor
python -c "
import pygame
pygame.init()
from app.ui.render.font_registry import FontRegistry
import os
font_dir = os.path.join(os.getcwd(), 'assets', 'fonts')
fr = FontRegistry(font_dir)
f = fr.get('sans', 14, False)
assert f is not None
fr.preload()
print('FontRegistry OK, font type:', type(f))
pygame.quit()
"
```
Expected: `FontRegistry OK, font type: <class 'pygame.font.Font'>`

- [ ] **Step 3: Commit**

```bash
git add app/ui/render/font_registry.py
git commit -m "feat(ui/render): add FontRegistry with file+system Korean fallback"
```

---

## Task 4: TextRenderer

**Files:**
- Create: `app/ui/render/text_renderer.py`

- [ ] **Step 1: Write the file**

```python
# app/ui/render/text_renderer.py
import pygame


class TextRenderer:
    """Draws text onto pygame Surfaces using ThemeManager tokens."""

    def __init__(self, font_registry, theme_manager):
        self.fonts = font_registry
        self.theme = theme_manager

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def draw(
        self,
        surface: pygame.Surface,
        text: str,
        style_key: str,
        rect: pygame.Rect,
        color_key: str = "text.primary",
        align: str = "left",
    ) -> None:
        """Draw multi-line text with optional ellipsis clipping inside rect."""
        size = self.theme.font_size(style_key)
        bold = self.theme.is_bold(style_key)
        font = self.fonts.get("sans", size, bold)
        color = self.theme.color(color_key)

        lines = self.wrap(text, rect.width, style_key)
        line_height = font.get_linesize()
        y = rect.y

        for line in lines:
            if y + line_height > rect.bottom:
                # Clip last visible line with ellipsis
                ellipsis = "…"
                while line and font.size(line + ellipsis)[0] > rect.width:
                    line = line[:-1]
                line = line + ellipsis
                surf = font.render(line, True, color)
                x = self._align_x(surf.get_width(), rect, align)
                surface.blit(surf, (x, y))
                break

            surf = font.render(line, True, color)
            x = self._align_x(surf.get_width(), rect, align)
            surface.blit(surf, (x, y))
            y += line_height

    def draw_single(
        self,
        surface: pygame.Surface,
        text: str,
        style_key: str,
        pos: tuple,
        color_key: str = "text.primary",
    ) -> None:
        """Draw a single line of text at top-left position pos=(x, y)."""
        size = self.theme.font_size(style_key)
        bold = self.theme.is_bold(style_key)
        font = self.fonts.get("sans", size, bold)
        color = self.theme.color(color_key)
        surf = font.render(text, True, color)
        surface.blit(surf, pos)

    def measure(self, text: str, style_key: str) -> tuple[int, int]:
        """Return (width, height) of text rendered in style_key."""
        size = self.theme.font_size(style_key)
        bold = self.theme.is_bold(style_key)
        font = self.fonts.get("sans", size, bold)
        return font.size(text)

    def wrap(self, text: str, width: int, style_key: str) -> list[str]:
        """Word-wrap text to fit within width pixels. Returns list of lines."""
        size = self.theme.font_size(style_key)
        bold = self.theme.is_bold(style_key)
        font = self.fonts.get("sans", size, bold)

        lines: list[str] = []
        for paragraph in text.split("\n"):
            words = paragraph.split(" ")
            current = ""
            for word in words:
                test = (current + " " + word).strip()
                if font.size(test)[0] <= width:
                    current = test
                else:
                    if current:
                        lines.append(current)
                    current = word
            if current:
                lines.append(current)
        return lines if lines else [""]

    # ------------------------------------------------------------------
    # Internal
    # ------------------------------------------------------------------

    def _align_x(self, text_width: int, rect: pygame.Rect, align: str) -> int:
        if align == "center":
            return rect.x + (rect.width - text_width) // 2
        if align == "right":
            return rect.right - text_width
        return rect.x  # "left"
```

- [ ] **Step 2: Verify**

```bash
cd C:\Users\jaemi\Documents\Project\plant-counselor
python -c "
import pygame
pygame.init()
from app.ui.theme_manager import ThemeManager
from app.ui.render.font_registry import FontRegistry
from app.ui.render.text_renderer import TextRenderer
import os

theme = ThemeManager()
fr = FontRegistry(os.path.join(os.getcwd(), 'assets', 'fonts'))
tr = TextRenderer(fr, theme)

w, h = tr.measure('Hello', 'text.body')
assert w > 0 and h > 0, (w, h)

lines = tr.wrap('This is a long sentence that should wrap at some point', 100, 'text.body')
assert len(lines) > 1, lines

surf = pygame.Surface((300, 100))
tr.draw(surf, 'Test line', 'text.body', pygame.Rect(0, 0, 300, 100))
tr.draw_single(surf, 'Single', 'text.body', (0, 0))
print('TextRenderer OK, lines wrapped:', len(lines))
pygame.quit()
"
```
Expected: `TextRenderer OK, lines wrapped: <N>` where N > 1

- [ ] **Step 3: Commit**

```bash
git add app/ui/render/text_renderer.py
git commit -m "feat(ui/render): add TextRenderer with wrap/clip/align support"
```

---

## Task 5: ShadowRenderer

**Files:**
- Create: `app/ui/render/shadow_renderer.py`

- [ ] **Step 1: Write the file**

```python
# app/ui/render/shadow_renderer.py
import pygame


class ShadowRenderer:
    """Simulates CSS-like box shadows with layered semi-transparent rects."""

    def draw_box_shadow(
        self,
        surface: pygame.Surface,
        rect: pygame.Rect,
        radius: int,
        shadow_key: str,
        theme,
    ) -> None:
        """Draw a box shadow below rect using token values from theme.

        pygame has no blur; we simulate with multiple translucent offset rects,
        each slightly larger than the previous, to approximate a soft shadow.
        """
        shadow = theme.shadow(shadow_key)
        y_offset = shadow["y"]
        blur = shadow["blur"]
        alpha = shadow["alpha"]

        # Number of simulation layers ≈ blur / 2 (capped at 6)
        layers = min(max(blur // 2, 1), 6)
        per_layer_alpha = int(alpha * 255 / layers)

        shadow_surf = pygame.Surface(
            (rect.width + blur * 2, rect.height + blur * 2),
            pygame.SRCALPHA,
        )

        for i in range(layers, 0, -1):
            expand = i * (blur // max(layers, 1))
            layer_rect = pygame.Rect(
                blur - expand // 2,
                blur - expand // 2 + y_offset,
                rect.width + expand,
                rect.height + expand,
            )
            pygame.draw.rect(
                shadow_surf,
                (0, 0, 0, per_layer_alpha),
                layer_rect,
                border_radius=radius,
            )

        surface.blit(shadow_surf, (rect.x - blur, rect.y - blur))

    def draw_rounded_rect(
        self,
        surface: pygame.Surface,
        rect: pygame.Rect,
        color: tuple,
        radius: int,
        border_color: tuple = None,
        border_width: int = 0,
    ) -> None:
        """Draw a rounded rectangle with optional border."""
        pygame.draw.rect(surface, color, rect, border_radius=radius)
        if border_color and border_width > 0:
            pygame.draw.rect(
                surface, border_color, rect,
                width=border_width,
                border_radius=radius,
            )
```

- [ ] **Step 2: Verify**

```bash
cd C:\Users\jaemi\Documents\Project\plant-counselor
python -c "
import pygame
pygame.init()
from app.ui.theme_manager import ThemeManager
from app.ui.render.shadow_renderer import ShadowRenderer

theme = ThemeManager()
sr = ShadowRenderer()
surf = pygame.Surface((400, 300), pygame.SRCALPHA)
rect = pygame.Rect(50, 50, 200, 100)
sr.draw_box_shadow(surf, rect, theme.radius('radius.md'), 'shadow.md', theme)
sr.draw_rounded_rect(surf, rect, theme.color('bg.surface'), theme.radius('radius.md'),
                     theme.color('border.subtle'), 1)
print('ShadowRenderer OK')
pygame.quit()
"
```
Expected: `ShadowRenderer OK`

- [ ] **Step 3: Commit**

```bash
git add app/ui/render/shadow_renderer.py
git commit -m "feat(ui/render): add ShadowRenderer with layered shadow simulation"
```

---

## Task 6: Animator

**Files:**
- Create: `app/ui/render/animator.py`

- [ ] **Step 1: Write the file**

```python
# app/ui/render/animator.py


class Tween:
    """Single interpolated value over time."""

    def __init__(self, start, end, duration_ms: int, easing: str = "ease_out"):
        self.start = start
        self.end = end
        self.duration = duration_ms / 1000.0
        self.easing = easing
        self.elapsed = 0.0
        self.done = False

    def update(self, dt: float) -> float:
        """Advance by dt seconds; return current interpolated value."""
        self.elapsed = min(self.elapsed + dt, self.duration)
        t = self.elapsed / self.duration if self.duration > 0 else 1.0
        t = self._ease(t)
        self.done = self.elapsed >= self.duration
        return self.start + (self.end - self.start) * t

    def _ease(self, t: float) -> float:
        if self.easing == "ease_out":
            return 1 - (1 - t) ** 2
        if self.easing == "ease_in_out":
            return t * t * (3 - 2 * t)
        if self.easing == "ease_in":
            return t * t
        return t  # linear


class Animator:
    """Manages a collection of named tweens."""

    def __init__(self):
        self._tweens: dict[str, Tween] = {}

    def tween(
        self,
        key: str,
        start,
        end,
        duration_ms: int,
        easing: str = "ease_out",
    ) -> "Animator":
        """Register or restart a tween. Returns self for chaining."""
        self._tweens[key] = Tween(start, end, duration_ms, easing)
        return self

    def update(self, dt: float) -> dict:
        """Advance all tweens; remove finished ones. Returns {key: value}."""
        result = {}
        finished = []
        for key, tw in self._tweens.items():
            result[key] = tw.update(dt)
            if tw.done:
                finished.append(key)
        for key in finished:
            del self._tweens[key]
        return result

    def is_running(self, key: str) -> bool:
        """True if tween with key is currently active."""
        return key in self._tweens

    def cancel(self, key: str) -> None:
        """Remove a tween without completing it."""
        self._tweens.pop(key, None)
```

- [ ] **Step 2: Verify (no pygame needed)**

```bash
cd C:\Users\jaemi\Documents\Project\plant-counselor
python -c "
from app.ui.render.animator import Tween, Animator

tw = Tween(0, 100, 200)  # 200 ms
v0 = tw.update(0.05)   # 50 ms in
assert 0 < v0 < 100, v0
v1 = tw.update(0.2)    # complete
assert v1 == 100.0, v1
assert tw.done

anim = Animator()
anim.tween('alpha', 0, 255, 300, 'ease_in_out')
assert anim.is_running('alpha')
vals = anim.update(0.3)    # 300 ms = full duration
assert 'alpha' not in anim._tweens  # should be removed
print('Animator OK, v0=', v0)
"
```
Expected: `Animator OK, v0= <float between 0 and 100>`

- [ ] **Step 3: Commit**

```bash
git add app/ui/render/animator.py
git commit -m "feat(ui/render): add Tween and Animator for time-based interpolation"
```

---

## Task 7: AssetLoader

**Files:**
- Create: `app/ui/render/asset_loader.py`

- [ ] **Step 1: Write the file**

```python
# app/ui/render/asset_loader.py
import os
import pygame


class AssetLoader:
    """Cached image loader with typed accessors for game assets.

    All paths are relative to ``assets_dir`` (project root ``assets/``).
    Returns None silently when a file is missing — callers must handle None.
    """

    def __init__(self, assets_dir: str):
        self.assets_dir = assets_dir
        self._image_cache: dict[str, pygame.Surface] = {}

    # ------------------------------------------------------------------
    # Core loader
    # ------------------------------------------------------------------

    def load_image(self, rel_path: str) -> pygame.Surface | None:
        """Load and cache an image. Returns None if file not found."""
        if rel_path in self._image_cache:
            return self._image_cache[rel_path]

        full = os.path.join(self.assets_dir, rel_path)
        if not os.path.exists(full):
            return None
        try:
            img = pygame.image.load(full).convert_alpha()
            self._image_cache[rel_path] = img
            return img
        except Exception:
            return None

    # ------------------------------------------------------------------
    # Typed accessors
    # ------------------------------------------------------------------

    def pixel(self, rel_path: str, scale: int = 1) -> pygame.Surface | None:
        """Load a pixel-art image and optionally scale it by integer factor."""
        img = self.load_image(rel_path)
        if img is None:
            return None
        if scale != 1:
            w, h = img.get_size()
            img = pygame.transform.scale(img, (w * scale, h * scale))
        return img

    def icon(self, name: str, size: int = 24) -> pygame.Surface | None:
        """Load ``pixels/icons/<name>.png``.

        Prefers @2x version when available and scales down — better quality.
        """
        path_2x = f"pixels/icons/{name}@2x.png"
        img = self.load_image(path_2x)
        if img is not None:
            return pygame.transform.smoothscale(img, (size, size))

        path = f"pixels/icons/{name}.png"
        img = self.load_image(path)
        if img is None:
            return None
        return pygame.transform.smoothscale(img, (size, size))

    def plant_layer(self, species: str, layer: str) -> pygame.Surface | None:
        """Load ``pixels/plants/<species>/<layer>.png``."""
        return self.load_image(f"pixels/plants/{species}/{layer}.png")

    def pot(self, style: str = "clay") -> pygame.Surface | None:
        """Load ``pixels/pots/pot_<style>.png``."""
        # Prefer @2x
        img = self.load_image(f"pixels/pots/pot_{style}@2x.png")
        if img is not None:
            return img
        return self.load_image(f"pixels/pots/pot_{style}.png")

    def background(self, name: str) -> pygame.Surface | None:
        """Load ``pixels/background/<name>.png``."""
        return self.load_image(f"pixels/background/{name}.png")

    def floor_tile(self, name: str) -> pygame.Surface | None:
        """Load ``pixels/floor/<name>.png``."""
        return self.load_image(f"pixels/floor/{name}.png")

    def logo(self, variant: str = "logo_full") -> pygame.Surface | None:
        """Load ``logo/<variant>.png``, preferring @2x when available."""
        img = self.load_image(f"logo/{variant}@2x.png")
        if img is not None:
            return img
        return self.load_image(f"logo/{variant}.png")
```

- [ ] **Step 2: Verify**

```bash
cd C:\Users\jaemi\Documents\Project\plant-counselor
python -c "
import pygame
pygame.init()
from app.ui.render.asset_loader import AssetLoader
import os

al = AssetLoader(os.path.join(os.getcwd(), 'assets'))

# Should load existing assets
icon = al.icon('home', 24)
assert icon is not None, 'home icon missing'
assert icon.get_width() == 24

pot = al.pot('clay')
assert pot is not None, 'clay pot missing'

plant = al.plant_layer('tree_oak', 'seed')
assert plant is not None, 'tree_oak/seed missing'

logo = al.logo('logo_mark')
assert logo is not None, 'logo_mark missing'

# Missing asset should return None, not raise
missing = al.load_image('does/not/exist.png')
assert missing is None

print('AssetLoader OK')
pygame.quit()
"
```
Expected: `AssetLoader OK`

- [ ] **Step 3: Commit**

```bash
git add app/ui/render/asset_loader.py
git commit -m "feat(ui/render): add AssetLoader with cache and typed asset helpers"
```

---

## Task 8: PlantSprite

**Files:**
- Create: `app/ui/render/plant_sprite.py`

- [ ] **Step 1: Write the file**

```python
# app/ui/render/plant_sprite.py
import pygame


class PlantSprite:
    """Composites plant pixel-art layers into a single Surface."""

    def __init__(self, asset_loader):
        self.assets = asset_loader
        self._cache: dict[tuple, pygame.Surface] = {}

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def render(
        self,
        species: str,
        status: str,
        progress: int,
        size: tuple,
    ) -> pygame.Surface:
        """Return a composited Surface of (width, height) = size.

        Layers are drawn bottom-to-top: pot → plant layers.
        Result is cached by (species, status, progress, size).
        """
        key = (species, status, progress, size)
        if key in self._cache:
            return self._cache[key]

        surf = pygame.Surface(size, pygame.SRCALPHA)
        w, h = size

        # --- Pot (lower 1/3) ---
        pot_img = self.assets.pot("clay")
        if pot_img:
            ph = h // 3
            pw = max(1, int(pot_img.get_width() * ph / pot_img.get_height()))
            pot_scaled = pygame.transform.scale(pot_img, (pw, ph))
            px = (w - pw) // 2
            py = h - ph
            surf.blit(pot_scaled, (px, py))

        # --- Plant layers (upper 2/3) ---
        plant_h = h * 2 // 3
        for layer_name in self._get_layers(species, status, progress):
            img = self.assets.plant_layer(species, layer_name)
            if img is None:
                continue
            orig_w, orig_h = img.get_size()
            if orig_h == 0:
                continue
            iw = max(1, int(orig_w * plant_h / orig_h))
            scaled = pygame.transform.scale(img, (iw, plant_h))
            ix = (w - iw) // 2
            surf.blit(scaled, (ix, 0))

        self._cache[key] = surf
        return surf

    def render_thumbnail(
        self,
        species: str,
        status: str,
        progress: int,
        size: int = 40,
    ) -> pygame.Surface:
        """Convenience wrapper for square thumbnails."""
        return self.render(species, status, progress, (size, size))

    # ------------------------------------------------------------------
    # Internal
    # ------------------------------------------------------------------

    def _get_layers(self, species: str, status: str, progress: int) -> list[str]:
        """Return ordered list of layer filenames for the given plant state."""
        if status == "seed":
            return ["seed"]
        if status == "bud":
            return ["stem_a", "leaf_a", "bud"]
        if status == "flower":
            return ["stem_b", "leaf_b", "flower"]
        if status == "wilting":
            return ["stem_b", "leaf_b", "flower", "wilting"]
        if status == "fruit":
            return ["stem_b", "leaf_b", "fruit"]
        if status == "harvested":
            return ["stem_b", "leaf_b", "fruit"]
        if status == "rot":
            return ["rot"]
        # Fallback
        return ["seed"]
```

- [ ] **Step 2: Verify**

```bash
cd C:\Users\jaemi\Documents\Project\plant-counselor
python -c "
import pygame
pygame.init()
from app.ui.render.asset_loader import AssetLoader
from app.ui.render.plant_sprite import PlantSprite
import os

al = AssetLoader(os.path.join(os.getcwd(), 'assets'))
ps = PlantSprite(al)

# Render each status — should not raise
for status in ('seed', 'bud', 'flower', 'wilting', 'fruit', 'harvested', 'rot'):
    surf = ps.render('tree_oak', status, 50, (80, 80))
    assert surf.get_size() == (80, 80), surf.get_size()

thumb = ps.render_thumbnail('tree_oak', 'seed', 0, 40)
assert thumb.get_size() == (40, 40)

# Cache hit
surf2 = ps.render('tree_oak', 'seed', 50, (80, 80))
assert surf2 is ps._cache[('tree_oak', 'seed', 50, (80, 80))]

print('PlantSprite OK')
pygame.quit()
"
```
Expected: `PlantSprite OK`

- [ ] **Step 3: Commit**

```bash
git add app/ui/render/plant_sprite.py
git commit -m "feat(ui/render): add PlantSprite layer compositor"
```

---

## Task 9: SceneManager + BaseScene

**Files:**
- Create: `app/ui/scene_manager.py`
- Create: `app/ui/scenes/base_scene.py`

- [ ] **Step 1: Write scene_manager.py**

```python
# app/ui/scene_manager.py
import pygame


class SceneManager:
    """Routes events, updates, and renders to the active scene and overlay stack."""

    def __init__(self, app):
        self.app = app
        self.current = None
        self.overlays: list = []   # push/pop stack (ChatWidget, ToastWidget, etc.)
        self._scenes: dict[str, object] = {}

    # ------------------------------------------------------------------
    # Scene registry
    # ------------------------------------------------------------------

    def register(self, name: str, scene) -> None:
        """Register a scene instance under a string key."""
        self._scenes[name] = scene

    def switch_scene(self, name: str, params: dict = None) -> None:
        """Deactivate the current scene and activate name."""
        if self.current is not None:
            self.current.on_exit()
        self.current = self._scenes.get(name)
        if self.current is not None:
            self.current.on_enter(params or {})

    # ------------------------------------------------------------------
    # Overlay stack
    # ------------------------------------------------------------------

    def push_overlay(self, widget) -> None:
        """Push a widget onto the overlay stack (rendered on top)."""
        self.overlays.append(widget)

    def pop_overlay(self) -> None:
        """Remove and discard the topmost overlay."""
        if self.overlays:
            self.overlays.pop()

    # ------------------------------------------------------------------
    # Game loop hooks
    # ------------------------------------------------------------------

    def handle_event(self, event: pygame.event.Event) -> None:
        """Overlays consume events first; falls through to current scene."""
        if self.overlays:
            self.overlays[-1].handle_event(event)
            return
        if self.current is not None:
            self.current.handle_event(event)

    def update(self, dt: float) -> None:
        """Advance current scene and all overlays."""
        if self.current is not None:
            self.current.update(dt)
        for overlay in self.overlays:
            overlay.update(dt)

    def render(self, surface: pygame.Surface) -> None:
        """Draw current scene, then overlays in push order."""
        if self.current is not None:
            self.current.render(surface)
        for overlay in self.overlays:
            overlay.render(surface)
```

- [ ] **Step 2: Write base_scene.py**

```python
# app/ui/scenes/base_scene.py
import pygame


class BaseScene:
    """Abstract base class for all game screens."""

    def __init__(self, app):
        self.app = app

    def on_enter(self, params: dict) -> None:
        """Called when this scene becomes active. Override to initialise state."""
        pass

    def on_exit(self) -> None:
        """Called when this scene is deactivated. Override to clean up."""
        pass

    def update(self, dt: float) -> None:
        """Advance scene logic by dt seconds."""
        pass

    def render(self, surface: pygame.Surface) -> None:
        """Draw the scene onto surface."""
        pass

    def handle_event(self, event: pygame.event.Event) -> None:
        """Process a pygame event."""
        pass
```

- [ ] **Step 3: Verify (no pygame display needed)**

```bash
cd C:\Users\jaemi\Documents\Project\plant-counselor
python -c "
import pygame
pygame.init()
from app.ui.scene_manager import SceneManager
from app.ui.scenes.base_scene import BaseScene

class MockApp:
    pass

class TestScene(BaseScene):
    entered = False
    exited = False
    def on_enter(self, params): self.entered = True
    def on_exit(self): self.exited = True

app = MockApp()
sm = SceneManager(app)
s = TestScene(app)
sm.register('test', s)
sm.switch_scene('test', {'foo': 1})
assert s.entered
assert sm.current is s

sm.switch_scene('missing')  # should not raise
assert sm.current is None

print('SceneManager + BaseScene OK')
pygame.quit()
"
```
Expected: `SceneManager + BaseScene OK`

- [ ] **Step 4: Commit**

```bash
git add app/ui/scene_manager.py app/ui/scenes/base_scene.py
git commit -m "feat(ui): add SceneManager and BaseScene"
```

---

## Task 10: BaseWidget

**Files:**
- Create: `app/ui/widgets/base_widget.py`

- [ ] **Step 1: Write the file**

```python
# app/ui/widgets/base_widget.py
import pygame


class BaseWidget:
    """Abstract base for all interactive UI widgets."""

    def __init__(self, rect: pygame.Rect, theme, fonts=None):
        self.rect = rect
        self.theme = theme
        self.fonts = fonts
        self.visible = True
        self.enabled = True
        self._hovered = False

    def update(self, dt: float) -> None:
        """Advance widget state by dt seconds. Override as needed."""
        pass

    def render(self, surface: pygame.Surface) -> None:
        """Draw the widget. Override in subclasses."""
        pass

    def handle_event(self, event: pygame.event.Event) -> bool:
        """Process event; update _hovered on MOUSEMOTION.

        Returns True if the event was consumed (stops further propagation).
        """
        if event.type == pygame.MOUSEMOTION:
            self._hovered = self.rect.collidepoint(event.pos)
        return False

    def set_rect(self, rect: pygame.Rect) -> None:
        """Reposition/resize the widget."""
        self.rect = rect
```

- [ ] **Step 2: Verify**

```bash
cd C:\Users\jaemi\Documents\Project\plant-counselor
python -c "
import pygame
pygame.init()
from app.ui.widgets.base_widget import BaseWidget
from app.ui.theme_manager import ThemeManager

theme = ThemeManager()
w = BaseWidget(pygame.Rect(10, 10, 100, 40), theme)
assert w.visible
assert w.enabled
assert not w._hovered

# Simulate mouse move onto widget
ev = pygame.event.Event(pygame.MOUSEMOTION, pos=(50, 30))
consumed = w.handle_event(ev)
assert w._hovered
assert consumed is False  # base never consumes

# Mouse off widget
ev2 = pygame.event.Event(pygame.MOUSEMOTION, pos=(200, 200))
w.handle_event(ev2)
assert not w._hovered

print('BaseWidget OK')
pygame.quit()
"
```
Expected: `BaseWidget OK`

- [ ] **Step 3: Commit**

```bash
git add app/ui/widgets/base_widget.py
git commit -m "feat(ui/widgets): add BaseWidget with hover tracking"
```

---

## Task 11: Button Widget

**Files:**
- Create: `app/ui/widgets/button.py`

- [ ] **Step 1: Write the file**

```python
# app/ui/widgets/button.py
import pygame
from .base_widget import BaseWidget


class Button(BaseWidget):
    """Clickable button with four visual variants.

    Variants
    --------
    primary   - filled brand.primary_leaf background
    secondary - outlined, surface background
    ghost     - transparent; brand text; soft hover fill
    icon      - square, no label, app background
    """

    def __init__(
        self,
        rect: pygame.Rect,
        theme,
        fonts,
        label: str = "",
        variant: str = "primary",
        on_click=None,
        icon: pygame.Surface = None,
    ):
        super().__init__(rect, theme, fonts)
        self.label = label
        self.variant = variant
        self.on_click = on_click
        self.icon = icon
        self._pressed = False

    # ------------------------------------------------------------------
    # Widget hooks
    # ------------------------------------------------------------------

    def render(self, surface: pygame.Surface) -> None:
        if not self.visible:
            return

        bg, text_color, border = self._get_colors()
        r = self.theme.radius("radius.md")
        y_off = 1 if self._pressed else 0
        draw_rect = self.rect.move(0, y_off)

        pygame.draw.rect(surface, bg, draw_rect, border_radius=r)
        if border:
            pygame.draw.rect(surface, border, draw_rect, width=1, border_radius=r)

        # Icon (left of label, or centered when no label)
        icon_x = draw_rect.x
        if self.icon:
            iw, ih = self.icon.get_size()
            if self.label:
                ix = draw_rect.x + self.theme.space("space.3")
                iy = draw_rect.y + (draw_rect.height - ih) // 2
            else:
                ix = draw_rect.x + (draw_rect.width - iw) // 2
                iy = draw_rect.y + (draw_rect.height - ih) // 2
            surface.blit(self.icon, (ix, iy))
            icon_x = ix + iw + self.theme.space("space.2")

        if self.label and self.fonts:
            bold = self.variant == "primary"
            size = self.theme.font_size("text.label")
            font = self.fonts.get("sans", size, bold)
            txt_surf = font.render(self.label, True, text_color)
            if self.icon:
                tx = icon_x
                ty = draw_rect.y + (draw_rect.height - txt_surf.get_height()) // 2
            else:
                tx = draw_rect.x + (draw_rect.width - txt_surf.get_width()) // 2
                ty = draw_rect.y + (draw_rect.height - txt_surf.get_height()) // 2
            surface.blit(txt_surf, (tx, ty))

    def handle_event(self, event: pygame.event.Event) -> bool:
        super().handle_event(event)
        if not self.enabled or not self.visible:
            return False

        if event.type == pygame.MOUSEBUTTONDOWN and event.button == 1:
            if self.rect.collidepoint(event.pos):
                self._pressed = True
                return True

        if event.type == pygame.MOUSEBUTTONUP and event.button == 1:
            was_pressed = self._pressed
            self._pressed = False
            if was_pressed and self.rect.collidepoint(event.pos):
                if self.on_click:
                    self.on_click()
                return True

        return False

    # ------------------------------------------------------------------
    # Internal
    # ------------------------------------------------------------------

    def _get_colors(self) -> tuple:
        """Return (bg_color, text_color, border_color_or_None)."""
        if self.variant == "primary":
            if self._hovered:
                bg = self.theme.color("brand.deep_stem")
            else:
                bg = self.theme.color("brand.primary_leaf")
            return bg, self.theme.color("text.inverse"), None

        if self.variant == "secondary":
            if self._hovered:
                bg = self.theme.color("bg.surface_soft")
            else:
                bg = self.theme.color("bg.surface")
            return bg, self.theme.color("text.primary"), self.theme.color("border.subtle")

        if self.variant == "ghost":
            if self._hovered:
                bg = self.theme.color("bg.surface_soft")
            else:
                bg = (0, 0, 0, 0)
            return bg, self.theme.color("brand.primary_leaf"), None

        # "icon" variant
        if self._hovered:
            bg = self.theme.color("bg.surface_soft")
        else:
            bg = self.theme.color("bg.app")
        return bg, self.theme.color("text.muted"), None
```

- [ ] **Step 2: Verify**

```bash
cd C:\Users\jaemi\Documents\Project\plant-counselor
python -c "
import pygame
pygame.init()
from app.ui.theme_manager import ThemeManager
from app.ui.render.font_registry import FontRegistry
from app.ui.widgets.button import Button
import os

theme = ThemeManager()
fr = FontRegistry(os.path.join(os.getcwd(), 'assets', 'fonts'))
surf = pygame.Surface((400, 300))

clicked = []
btn = Button(pygame.Rect(50, 50, 120, 40), theme, fr, label='Click me',
             variant='primary', on_click=lambda: clicked.append(1))
btn.render(surf)

# Simulate press + release
ev_down = pygame.event.Event(pygame.MOUSEBUTTONDOWN, button=1, pos=(110, 70))
ev_up   = pygame.event.Event(pygame.MOUSEBUTTONUP,   button=1, pos=(110, 70))
btn.handle_event(ev_down)
btn.handle_event(ev_up)
assert clicked == [1], clicked

# Test all variants render without error
for v in ('primary', 'secondary', 'ghost', 'icon'):
    b = Button(pygame.Rect(0,0,80,32), theme, fr, label='X', variant=v)
    b.render(surf)

print('Button OK')
pygame.quit()
"
```
Expected: `Button OK`

- [ ] **Step 3: Commit**

```bash
git add app/ui/widgets/button.py
git commit -m "feat(ui/widgets): add Button with primary/secondary/ghost/icon variants"
```

---

## Task 12: TextInput Widget

**Files:**
- Create: `app/ui/widgets/text_input.py`

- [ ] **Step 1: Write the file**

```python
# app/ui/widgets/text_input.py
import pygame
from .base_widget import BaseWidget


class TextInput(BaseWidget):
    """Single-line (or multiline) text entry with cursor and placeholder.

    Variants
    --------
    default  - standard bordered input
    search   - same style; caller may prefix a search icon
    password - masks characters with bullets (•)
    chat     - same as default; multiline support enabled externally
    """

    def __init__(
        self,
        rect: pygame.Rect,
        theme,
        fonts,
        placeholder: str = "",
        variant: str = "default",
        on_submit=None,
        multiline: bool = False,
    ):
        super().__init__(rect, theme, fonts)
        self.placeholder = placeholder
        self.variant = variant
        self.on_submit = on_submit
        self.multiline = multiline
        self.text = ""
        self._focused = False
        self._cursor_visible = True
        self._cursor_timer = 0.0

    # ------------------------------------------------------------------
    # Widget hooks
    # ------------------------------------------------------------------

    def update(self, dt: float) -> None:
        """Blink cursor at 0.5s interval."""
        self._cursor_timer += dt
        if self._cursor_timer >= 0.5:
            self._cursor_visible = not self._cursor_visible
            self._cursor_timer = 0.0

    def render(self, surface: pygame.Surface) -> None:
        if not self.visible:
            return

        r = self.theme.radius("radius.md")
        bg = self.theme.color("bg.surface")
        border_color = (
            self.theme.color("brand.primary_leaf")
            if self._focused
            else self.theme.color("border.subtle")
        )
        border_width = 2 if self._focused else 1

        pygame.draw.rect(surface, bg, self.rect, border_radius=r)
        pygame.draw.rect(surface, border_color, self.rect,
                         width=border_width, border_radius=r)

        if not self.fonts:
            return

        size = self.theme.font_size("text.body")
        font = self.fonts.get("sans", size, False)
        pad = self.theme.space("space.3")

        # Determine display string and color
        if self.text:
            display = "•" * len(self.text) if self.variant == "password" else self.text
            text_color = self.theme.color("text.primary")
        else:
            display = self.placeholder
            text_color = self.theme.color("text.muted")

        txt_surf = font.render(display, True, text_color)
        clip_w = self.rect.width - pad * 2
        clip_rect = pygame.Rect(self.rect.x + pad, self.rect.y, clip_w, self.rect.height)
        ty = self.rect.y + (self.rect.height - txt_surf.get_height()) // 2

        surface.set_clip(clip_rect)
        # Scroll so cursor is visible when text is wider than input
        txt_w = txt_surf.get_width()
        if txt_w > clip_w:
            blit_x = self.rect.x + pad + clip_w - txt_w
        else:
            blit_x = self.rect.x + pad
        surface.blit(txt_surf, (blit_x, ty))
        surface.set_clip(None)

        # Cursor
        if self._focused and self._cursor_visible and self.text is not None:
            cursor_x = blit_x + font.size(display)[0]
            cursor_x = min(cursor_x, self.rect.right - pad)
            pygame.draw.line(
                surface,
                self.theme.color("text.primary"),
                (cursor_x, self.rect.y + 6),
                (cursor_x, self.rect.bottom - 6),
                1,
            )

    def handle_event(self, event: pygame.event.Event) -> bool:
        super().handle_event(event)

        if event.type == pygame.MOUSEBUTTONDOWN and event.button == 1:
            self._focused = self.rect.collidepoint(event.pos)
            return self._focused

        if not self._focused:
            return False

        if event.type == pygame.KEYDOWN:
            if event.key == pygame.K_RETURN and not self.multiline:
                if self.on_submit and self.text.strip():
                    self.on_submit(self.text.strip())
                    self.text = ""
                return True

            if event.key == pygame.K_BACKSPACE:
                self.text = self.text[:-1]
                return True

            if event.unicode and event.unicode.isprintable():
                self.text += event.unicode
                return True

        return False
```

- [ ] **Step 2: Verify**

```bash
cd C:\Users\jaemi\Documents\Project\plant-counselor
python -c "
import pygame
pygame.init()
from app.ui.theme_manager import ThemeManager
from app.ui.render.font_registry import FontRegistry
from app.ui.widgets.text_input import TextInput
import os

theme = ThemeManager()
fr = FontRegistry(os.path.join(os.getcwd(), 'assets', 'fonts'))
surf = pygame.Surface((400, 300))

submitted = []
ti = TextInput(pygame.Rect(20, 20, 200, 36), theme, fr,
               placeholder='Type here', on_submit=lambda t: submitted.append(t))

# Click to focus
ev_click = pygame.event.Event(pygame.MOUSEBUTTONDOWN, button=1, pos=(120, 38))
ti.handle_event(ev_click)
assert ti._focused

# Type text
for ch in 'hello':
    ti.handle_event(pygame.event.Event(pygame.KEYDOWN, key=ord(ch), unicode=ch))
assert ti.text == 'hello', ti.text

# Submit
ti.handle_event(pygame.event.Event(pygame.KEYDOWN, key=pygame.K_RETURN, unicode=''))
assert submitted == ['hello'], submitted
assert ti.text == ''

# Render all variants without error
for v in ('default', 'search', 'password', 'chat'):
    t = TextInput(pygame.Rect(0,0,150,36), theme, fr, variant=v)
    t.render(surf)

print('TextInput OK')
pygame.quit()
"
```
Expected: `TextInput OK`

- [ ] **Step 3: Commit**

```bash
git add app/ui/widgets/text_input.py
git commit -m "feat(ui/widgets): add TextInput with focus, cursor, placeholder, submit"
```

---

## Task 13: Sidebar Widget

**Files:**
- Create: `app/ui/widgets/sidebar.py`

- [ ] **Step 1: Write the file**

```python
# app/ui/widgets/sidebar.py
import pygame
from .base_widget import BaseWidget


class Sidebar(BaseWidget):
    """72-pixel-wide navigation sidebar with icon buttons.

    Navigation items are defined in ITEMS as (scene_key, label, icon_name).
    """

    ITEMS = [
        ("home",     "홈",   "home"),
        ("plants",   "식물", "plant"),
        ("calendar", "캘린더", "calendar"),
        ("chat",     "채팅", "chat"),
        ("settings", "설정", "settings"),
    ]

    WIDTH = 72
    BTN_SIZE = 40

    def __init__(
        self,
        rect: pygame.Rect,
        theme,
        fonts,
        assets,
        on_navigate,
        active_scene: str = "home",
    ):
        super().__init__(rect, theme, fonts)
        self.assets = assets
        self.on_navigate = on_navigate
        self.active_scene = active_scene

    # ------------------------------------------------------------------
    # Widget hooks
    # ------------------------------------------------------------------

    def render(self, surface: pygame.Surface) -> None:
        if not self.visible:
            return

        # Background
        pygame.draw.rect(surface, self.theme.color("bg.surface_soft"), self.rect)
        # Right border
        pygame.draw.line(
            surface,
            self.theme.color("border.subtle"),
            self.rect.topright,
            self.rect.bottomright,
        )

        # Logo mark (top)
        logo = self.assets.logo("logo_mark")
        if logo:
            lw = 36
            lh = max(1, int(logo.get_height() * lw / logo.get_width()))
            logo_scaled = pygame.transform.smoothscale(logo, (lw, lh))
            lx = self.rect.x + (self.WIDTH - lw) // 2
            surface.blit(logo_scaled, (lx, self.rect.y + 16))

        # Nav buttons
        start_y = self.rect.y + 80
        sp = self.theme.space("space.3")
        r = self.theme.radius("radius.md")

        for i, (scene_key, label, icon_name) in enumerate(self.ITEMS):
            by = start_y + i * (self.BTN_SIZE + sp)
            bx = self.rect.x + (self.WIDTH - self.BTN_SIZE) // 2
            btn_rect = pygame.Rect(bx, by, self.BTN_SIZE, self.BTN_SIZE)
            is_active = scene_key == self.active_scene

            if is_active:
                pygame.draw.rect(
                    surface,
                    self.theme.color("brand.leaf_soft"),
                    btn_rect,
                    border_radius=r,
                )

            icon = self.assets.icon(icon_name, 24)
            if icon:
                tinted = icon.copy()
                if is_active:
                    tinted.fill(
                        self.theme.color("brand.primary_leaf") + (255,),
                        special_flags=pygame.BLEND_RGBA_MULT,
                    )
                ix = bx + (self.BTN_SIZE - tinted.get_width()) // 2
                iy = by + (self.BTN_SIZE - tinted.get_height()) // 2
                surface.blit(tinted, (ix, iy))
            elif self.fonts:
                # Text fallback: first character of label
                size = self.theme.font_size("text.caption")
                font = self.fonts.get("sans", size, False)
                col = (
                    self.theme.color("brand.primary_leaf")
                    if is_active
                    else self.theme.color("text.muted")
                )
                txt = font.render(label[0], True, col)
                tx = bx + (self.BTN_SIZE - txt.get_width()) // 2
                ty = by + (self.BTN_SIZE - txt.get_height()) // 2
                surface.blit(txt, (tx, ty))

    def handle_event(self, event: pygame.event.Event) -> bool:
        super().handle_event(event)
        if event.type == pygame.MOUSEBUTTONDOWN and event.button == 1:
            start_y = self.rect.y + 80
            sp = self.theme.space("space.3")
            for i, (scene_key, label, _) in enumerate(self.ITEMS):
                by = start_y + i * (self.BTN_SIZE + sp)
                bx = self.rect.x + (self.WIDTH - self.BTN_SIZE) // 2
                btn_rect = pygame.Rect(bx, by, self.BTN_SIZE, self.BTN_SIZE)
                if btn_rect.collidepoint(event.pos):
                    self.active_scene = scene_key
                    if self.on_navigate:
                        self.on_navigate(scene_key)
                    return True
        return False
```

- [ ] **Step 2: Verify**

```bash
cd C:\Users\jaemi\Documents\Project\plant-counselor
python -c "
import pygame
pygame.init()
from app.ui.theme_manager import ThemeManager
from app.ui.render.font_registry import FontRegistry
from app.ui.render.asset_loader import AssetLoader
from app.ui.widgets.sidebar import Sidebar
import os

theme = ThemeManager()
fr = FontRegistry(os.path.join(os.getcwd(), 'assets', 'fonts'))
al = AssetLoader(os.path.join(os.getcwd(), 'assets'))
surf = pygame.Surface((72, 600))

navigated = []
sb = Sidebar(pygame.Rect(0,0,72,600), theme, fr, al,
             on_navigate=lambda k: navigated.append(k), active_scene='home')
sb.render(surf)

# Click on 'plants' button (second item, y ≈ 80 + 40 + 12 = 132)
ev = pygame.event.Event(pygame.MOUSEBUTTONDOWN, button=1, pos=(36, 136))
sb.handle_event(ev)
assert navigated == ['plants'], navigated
assert sb.active_scene == 'plants'

print('Sidebar OK')
pygame.quit()
"
```
Expected: `Sidebar OK`

- [ ] **Step 3: Commit**

```bash
git add app/ui/widgets/sidebar.py
git commit -m "feat(ui/widgets): add Sidebar navigation widget"
```

---

## Task 14: ToastWidget

**Files:**
- Create: `app/ui/widgets/toast_widget.py`

- [ ] **Step 1: Write the file**

```python
# app/ui/widgets/toast_widget.py
import pygame
from .base_widget import BaseWidget
from app.ui.render.animator import Animator


class ToastWidget(BaseWidget):
    """Slide-in/fade-out notification toast shown in the bottom-right corner.

    kind: "info" | "success" | "warn" | "error"
    duration_ms: time the toast stays fully visible (default 3000 ms)

    Usage
    -----
    toast = ToastWidget(surface_rect, theme, fonts, message="Saved!", kind="success")
    scene_manager.push_overlay(toast)
    # ToastWidget calls scene_manager.pop_overlay via on_done when finished.
    """

    KIND_COLORS = {
        "info":    "accent.lavender_ai",
        "success": "brand.primary_leaf",
        "warn":    "accent.amber_schedule",
        "error":   "accent.rose_care",
    }

    HEIGHT = 48
    WIDTH = 280
    MARGIN = 16
    SLIDE_MS = 220
    FADE_MS = 180

    def __init__(
        self,
        screen_rect: pygame.Rect,
        theme,
        fonts,
        message: str,
        kind: str = "info",
        duration_ms: int = 3000,
        on_done=None,
    ):
        toast_rect = pygame.Rect(
            screen_rect.right - self.WIDTH - self.MARGIN,
            screen_rect.bottom - self.HEIGHT - self.MARGIN,
            self.WIDTH,
            self.HEIGHT,
        )
        super().__init__(toast_rect, theme, fonts)
        self.screen_rect = screen_rect
        self.message = message
        self.kind = kind
        self.duration_ms = duration_ms / 1000.0
        self.on_done = on_done

        self._animator = Animator()
        self._elapsed = 0.0
        self._phase = "slide_in"  # slide_in → hold → fade_out → done
        self._alpha = 0
        self._y_offset = self.HEIGHT + self.MARGIN  # start below screen

        # Kick off slide-in
        self._animator.tween("y_off", float(self._y_offset), 0.0,
                             self.SLIDE_MS, "ease_out")
        self._animator.tween("alpha", 0.0, 255.0, self.SLIDE_MS, "ease_out")

    # ------------------------------------------------------------------
    # Widget hooks
    # ------------------------------------------------------------------

    def update(self, dt: float) -> None:
        vals = self._animator.update(dt)
        if "y_off" in vals:
            self._y_offset = int(vals["y_off"])
        if "alpha" in vals:
            self._alpha = int(vals["alpha"])

        if self._phase == "slide_in" and not self._animator.is_running("y_off"):
            self._phase = "hold"
            self._elapsed = 0.0
            self._alpha = 255

        elif self._phase == "hold":
            self._elapsed += dt
            if self._elapsed >= self.duration_ms:
                self._phase = "fade_out"
                self._animator.tween("alpha", 255.0, 0.0, self.FADE_MS, "ease_in")

        elif self._phase == "fade_out" and not self._animator.is_running("alpha"):
            self._phase = "done"
            if self.on_done:
                self.on_done()

    def render(self, surface: pygame.Surface) -> None:
        if not self.visible or self._phase == "done":
            return

        r = self.theme.radius("radius.lg")
        accent = self.theme.color(self.KIND_COLORS.get(self.kind, "brand.primary_leaf"))

        draw_y = self.rect.y + self._y_offset

        # Shadow (simple)
        shadow_rect = pygame.Rect(self.rect.x + 2, draw_y + 4, self.rect.width, self.rect.height)
        shadow_surf = pygame.Surface((self.rect.width, self.rect.height), pygame.SRCALPHA)
        pygame.draw.rect(shadow_surf, (0, 0, 0, 30), shadow_surf.get_rect(), border_radius=r)
        surface.blit(shadow_surf, shadow_rect.topleft)

        # Card background
        card_surf = pygame.Surface((self.rect.width, self.rect.height), pygame.SRCALPHA)
        bg = self.theme.color("bg.surface")
        pygame.draw.rect(card_surf, bg + (self._alpha,), card_surf.get_rect(), border_radius=r)

        # Accent left bar (4px)
        bar_rect = pygame.Rect(0, 0, 4, self.rect.height)
        pygame.draw.rect(card_surf, accent + (self._alpha,), bar_rect,
                         border_radius=r)

        # Text
        if self.fonts:
            size = self.theme.font_size("text.body_sm")
            font = self.fonts.get("sans", size, False)
            txt_color = self.theme.color("text.primary") + (self._alpha,)
            txt = font.render(self.message, True, txt_color)
            pad = self.theme.space("space.4")
            ty = (self.rect.height - txt.get_height()) // 2
            card_surf.blit(txt, (pad + 4 + self.theme.space("space.2"), ty))

        surface.blit(card_surf, (self.rect.x, draw_y))

    def handle_event(self, event: pygame.event.Event) -> bool:
        # Toasts don't consume events (let clicks pass through)
        return False

    @property
    def is_done(self) -> bool:
        return self._phase == "done"
```

- [ ] **Step 2: Verify**

```bash
cd C:\Users\jaemi\Documents\Project\plant-counselor
python -c "
import pygame
pygame.init()
from app.ui.theme_manager import ThemeManager
from app.ui.render.font_registry import FontRegistry
from app.ui.widgets.toast_widget import ToastWidget
import os

theme = ThemeManager()
fr = FontRegistry(os.path.join(os.getcwd(), 'assets', 'fonts'))
screen_rect = pygame.Rect(0, 0, 800, 600)
surf = pygame.Surface((800, 600))

done = []
toast = ToastWidget(screen_rect, theme, fr, 'Saved!', kind='success',
                    duration_ms=100, on_done=lambda: done.append(1))
assert toast._phase == 'slide_in'

# Advance past slide_in (220ms)
toast.update(0.25)
assert toast._phase == 'hold', toast._phase

# Advance past hold (100ms)
toast.update(0.15)
assert toast._phase == 'fade_out', toast._phase

# Advance past fade_out (180ms)
toast.update(0.20)
assert toast._phase == 'done', toast._phase
assert done == [1]

# Render without error (any phase)
toast2 = ToastWidget(screen_rect, theme, fr, 'Test', kind='info')
toast2.render(surf)

print('ToastWidget OK')
pygame.quit()
"
```
Expected: `ToastWidget OK`

- [ ] **Step 3: Commit**

```bash
git add app/ui/widgets/toast_widget.py
git commit -m "feat(ui/widgets): add ToastWidget with slide/fade animation"
```

---

## Task 15: ModalWidget

**Files:**
- Create: `app/ui/widgets/modal_widget.py`

- [ ] **Step 1: Write the file**

```python
# app/ui/widgets/modal_widget.py
import pygame
from .base_widget import BaseWidget
from app.ui.render.shadow_renderer import ShadowRenderer


class ModalWidget(BaseWidget):
    """Centered confirmation/alert dialog with a semi-transparent backdrop.

    Usage
    -----
    modal = ModalWidget(
        screen_rect, theme, fonts,
        title="삭제하시겠습니까?",
        message="이 식물을 삭제하면 되돌릴 수 없습니다.",
        confirm_label="삭제",
        cancel_label="취소",
        on_confirm=lambda: do_delete(),
        on_cancel=lambda: scene_manager.pop_overlay(),
    )
    scene_manager.push_overlay(modal)
    """

    CARD_WIDTH = 320
    CARD_HEIGHT = 180

    def __init__(
        self,
        screen_rect: pygame.Rect,
        theme,
        fonts,
        title: str = "",
        message: str = "",
        confirm_label: str = "확인",
        cancel_label: str = "취소",
        on_confirm=None,
        on_cancel=None,
    ):
        # Widget rect = full screen (for backdrop)
        super().__init__(screen_rect, theme, fonts)
        self.screen_rect = screen_rect
        self.title = title
        self.message = message
        self.confirm_label = confirm_label
        self.cancel_label = cancel_label
        self.on_confirm = on_confirm
        self.on_cancel = on_cancel

        self._shadow = ShadowRenderer()

        # Card centered on screen
        cx = screen_rect.centerx - self.CARD_WIDTH // 2
        cy = screen_rect.centery - self.CARD_HEIGHT // 2
        self._card_rect = pygame.Rect(cx, cy, self.CARD_WIDTH, self.CARD_HEIGHT)

        pad = theme.space("space.4")
        btn_h = 36
        btn_w = (self.CARD_WIDTH - pad * 3) // 2

        # Cancel button (left)
        self._cancel_rect = pygame.Rect(
            self._card_rect.x + pad,
            self._card_rect.bottom - btn_h - pad,
            btn_w,
            btn_h,
        )
        # Confirm button (right)
        self._confirm_rect = pygame.Rect(
            self._cancel_rect.right + pad,
            self._card_rect.bottom - btn_h - pad,
            btn_w,
            btn_h,
        )

        self._hovered_confirm = False
        self._hovered_cancel = False

    # ------------------------------------------------------------------
    # Widget hooks
    # ------------------------------------------------------------------

    def render(self, surface: pygame.Surface) -> None:
        if not self.visible:
            return

        # Semi-transparent backdrop
        overlay = pygame.Surface(self.screen_rect.size, pygame.SRCALPHA)
        overlay.fill((0, 0, 0, 140))
        surface.blit(overlay, self.screen_rect.topleft)

        # Card shadow
        self._shadow.draw_box_shadow(
            surface, self._card_rect,
            self.theme.radius("radius.xl"),
            "shadow.lg",
            self.theme,
        )

        # Card background
        pygame.draw.rect(
            surface,
            self.theme.color("bg.surface"),
            self._card_rect,
            border_radius=self.theme.radius("radius.xl"),
        )

        pad = self.theme.space("space.4")

        # Title
        if self.fonts and self.title:
            size = self.theme.font_size("text.h2")
            font = self.fonts.get("sans", size, True)
            txt = font.render(self.title, True, self.theme.color("text.primary"))
            surface.blit(txt, (self._card_rect.x + pad, self._card_rect.y + pad))

        # Message
        if self.fonts and self.message:
            size = self.theme.font_size("text.body_sm")
            font = self.fonts.get("sans", size, False)
            txt = font.render(self.message, True, self.theme.color("text.muted"))
            title_h = self.theme.font_size("text.h2") + self.theme.space("space.2")
            surface.blit(
                txt,
                (self._card_rect.x + pad, self._card_rect.y + pad + title_h),
            )

        # Cancel button
        cancel_bg = (
            self.theme.color("bg.surface_soft")
            if self._hovered_cancel
            else self.theme.color("bg.surface")
        )
        pygame.draw.rect(
            surface, cancel_bg, self._cancel_rect,
            border_radius=self.theme.radius("radius.md"),
        )
        pygame.draw.rect(
            surface, self.theme.color("border.subtle"), self._cancel_rect,
            width=1, border_radius=self.theme.radius("radius.md"),
        )
        if self.fonts:
            size = self.theme.font_size("text.label")
            font = self.fonts.get("sans", size, False)
            txt = font.render(self.cancel_label, True, self.theme.color("text.primary"))
            tx = self._cancel_rect.x + (self._cancel_rect.width - txt.get_width()) // 2
            ty = self._cancel_rect.y + (self._cancel_rect.height - txt.get_height()) // 2
            surface.blit(txt, (tx, ty))

        # Confirm button
        confirm_bg = (
            self.theme.color("brand.deep_stem")
            if self._hovered_confirm
            else self.theme.color("brand.primary_leaf")
        )
        pygame.draw.rect(
            surface, confirm_bg, self._confirm_rect,
            border_radius=self.theme.radius("radius.md"),
        )
        if self.fonts:
            size = self.theme.font_size("text.label")
            font = self.fonts.get("sans", size, True)
            txt = font.render(self.confirm_label, True, self.theme.color("text.inverse"))
            tx = self._confirm_rect.x + (self._confirm_rect.width - txt.get_width()) // 2
            ty = self._confirm_rect.y + (self._confirm_rect.height - txt.get_height()) // 2
            surface.blit(txt, (tx, ty))

    def handle_event(self, event: pygame.event.Event) -> bool:
        if not self.visible:
            return False

        if event.type == pygame.MOUSEMOTION:
            self._hovered_confirm = self._confirm_rect.collidepoint(event.pos)
            self._hovered_cancel  = self._cancel_rect.collidepoint(event.pos)
            return True  # block hover from passing through backdrop

        if event.type == pygame.MOUSEBUTTONDOWN and event.button == 1:
            if self._confirm_rect.collidepoint(event.pos):
                if self.on_confirm:
                    self.on_confirm()
                return True
            if self._cancel_rect.collidepoint(event.pos):
                if self.on_cancel:
                    self.on_cancel()
                return True
            # Click on backdrop — treat as cancel
            if not self._card_rect.collidepoint(event.pos):
                if self.on_cancel:
                    self.on_cancel()
            return True  # always consume clicks

        if event.type == pygame.KEYDOWN:
            if event.key == pygame.K_ESCAPE:
                if self.on_cancel:
                    self.on_cancel()
                return True
            if event.key == pygame.K_RETURN:
                if self.on_confirm:
                    self.on_confirm()
                return True

        return False
```

- [ ] **Step 2: Verify**

```bash
cd C:\Users\jaemi\Documents\Project\plant-counselor
python -c "
import pygame
pygame.init()
from app.ui.theme_manager import ThemeManager
from app.ui.render.font_registry import FontRegistry
from app.ui.widgets.modal_widget import ModalWidget
import os

theme = ThemeManager()
fr = FontRegistry(os.path.join(os.getcwd(), 'assets', 'fonts'))
screen_rect = pygame.Rect(0, 0, 800, 600)
surf = pygame.Surface((800, 600))

confirmed = []
cancelled = []
modal = ModalWidget(
    screen_rect, theme, fr,
    title='삭제?', message='되돌릴 수 없습니다.',
    confirm_label='삭제', cancel_label='취소',
    on_confirm=lambda: confirmed.append(1),
    on_cancel=lambda: cancelled.append(1),
)

modal.render(surf)

# Click confirm
cx = modal._confirm_rect.centerx
cy = modal._confirm_rect.centery
modal.handle_event(pygame.event.Event(pygame.MOUSEBUTTONDOWN, button=1, pos=(cx, cy)))
assert confirmed == [1], confirmed

# ESC cancels
modal.handle_event(pygame.event.Event(pygame.KEYDOWN, key=pygame.K_ESCAPE, unicode=''))
assert cancelled == [1], cancelled

print('ModalWidget OK')
pygame.quit()
"
```
Expected: `ModalWidget OK`

- [ ] **Step 3: Commit**

```bash
git add app/ui/widgets/modal_widget.py
git commit -m "feat(ui/widgets): add ModalWidget with backdrop, confirm/cancel buttons"
```

---

## Final Smoke Test

- [ ] **Run full import chain**

```bash
cd C:\Users\jaemi\Documents\Project\plant-counselor
python -c "
import pygame
pygame.init()
import os

# Core
from app.ui.theme_manager import ThemeManager
from app.ui.render.font_registry import FontRegistry
from app.ui.render.text_renderer import TextRenderer
from app.ui.render.shadow_renderer import ShadowRenderer
from app.ui.render.animator import Animator, Tween
from app.ui.render.asset_loader import AssetLoader
from app.ui.render.plant_sprite import PlantSprite
from app.ui.scene_manager import SceneManager
from app.ui.scenes.base_scene import BaseScene
from app.ui.widgets.base_widget import BaseWidget
from app.ui.widgets.button import Button
from app.ui.widgets.text_input import TextInput
from app.ui.widgets.sidebar import Sidebar
from app.ui.widgets.toast_widget import ToastWidget
from app.ui.widgets.modal_widget import ModalWidget

theme = ThemeManager()
theme.auto_pick_by_date()
fr = FontRegistry(os.path.join(os.getcwd(), 'assets', 'fonts'))
fr.preload()
al = AssetLoader(os.path.join(os.getcwd(), 'assets'))
tr = TextRenderer(fr, theme)
sr = ShadowRenderer()
anim = Animator()
ps = PlantSprite(al)

surf = pygame.Surface((800, 600))
screen_rect = pygame.Rect(0, 0, 800, 600)

sidebar = Sidebar(pygame.Rect(0,0,72,600), theme, fr, al, on_navigate=lambda k: None)
sidebar.render(surf)

toast = ToastWidget(screen_rect, theme, fr, 'Hello!', kind='success')
toast.render(surf)

modal = ModalWidget(screen_rect, theme, fr, title='Test', message='OK?')
modal.render(surf)

print('ALL IMPORTS AND RENDERS OK')
pygame.quit()
"
```
Expected: `ALL IMPORTS AND RENDERS OK`

- [ ] **Final commit**

```bash
git add -A
git commit -m "feat(ui): complete UI infrastructure layer — all 19 files"
```

---

## Self-Review Checklist

### Spec Coverage

| Spec Requirement | Task |
|-----------------|------|
| `app/ui/__init__.py` (empty) | Task 1 |
| `app/ui/theme_manager.py` with full token dict | Task 2 |
| `app/ui/render/__init__.py` (empty) | Task 1 |
| `app/ui/render/font_registry.py` with system Korean fallback | Task 3 |
| `app/ui/render/text_renderer.py` with wrap/clip/align | Task 4 |
| `app/ui/render/shadow_renderer.py` | Task 5 |
| `app/ui/render/animator.py` (Tween + Animator) | Task 6 |
| `app/ui/render/asset_loader.py` with all typed helpers | Task 7 |
| `app/ui/render/plant_sprite.py` with layer order | Task 8 |
| `app/ui/scene_manager.py` with overlay stack | Task 9 |
| `app/ui/scenes/__init__.py` (empty) | Task 1 |
| `app/ui/scenes/base_scene.py` | Task 9 |
| `app/ui/widgets/__init__.py` (empty) | Task 1 |
| `app/ui/widgets/base_widget.py` | Task 10 |
| `app/ui/widgets/button.py` 4 variants | Task 11 |
| `app/ui/widgets/text_input.py` 4 variants + cursor | Task 12 |
| `app/ui/widgets/sidebar.py` 72px + 5 items | Task 13 |
| `app/ui/widgets/toast_widget.py` slide+fade animation | Task 14 |
| `app/ui/widgets/modal_widget.py` backdrop + buttons | Task 15 |

All 19 spec files are covered. No placeholders remain.
