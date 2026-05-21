"""
Smoke test for the UI infrastructure layer.
Run from project root: python scripts/test_ui_infra.py
"""
import os
import sys

# Ensure project root is on path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# No-pygame tests ---------------------------------------------------------------
from app.ui.theme_manager import ThemeManager

t = ThemeManager()
assert t.color("brand.primary_leaf") == (78, 126, 77), t.color("brand.primary_leaf")
assert t.color_alpha("bg.app", 0.5)[3] == 127
assert t.space("space.6") == 24
assert t.radius("radius.lg") == 14
assert t.shadow("shadow.md") == {"y": 4, "blur": 10, "alpha": 0.08}
assert t.motion("motion.base") == 200
assert t.font_size("text.h1") == 20
assert t.is_bold("text.h1") is True
assert t.is_bold("text.body") is False
t.auto_pick_by_date()
print("[OK] ThemeManager - variant=" + t.variant)

from app.ui.render.animator import Tween, Animator

tw = Tween(0, 100, 200)
v0 = tw.update(0.05)
assert 0 < v0 < 100, v0
tw.update(0.2)
assert tw.done

anim = Animator()
anim.tween("alpha", 0, 255, 300, "ease_in_out")
assert anim.is_running("alpha")
anim.update(0.3)
assert not anim.is_running("alpha")
print("[OK] Animator - v0=" + str(round(v0, 2)))

# Pygame tests ------------------------------------------------------------------
import pygame
pygame.init()

from app.ui.render.font_registry import FontRegistry

assets_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "assets")
fr = FontRegistry(os.path.join(assets_dir, "fonts"))
f = fr.get("sans", 14, False)
assert f is not None
fr.preload()
print("[OK] FontRegistry")

from app.ui.render.text_renderer import TextRenderer

tr = TextRenderer(fr, t)
w, h = tr.measure("Hello", "text.body")
assert w > 0 and h > 0
lines = tr.wrap("This is a long sentence that should wrap eventually", 80, "text.body")
assert len(lines) > 1
surf = pygame.Surface((300, 100))
tr.draw(surf, "Test", "text.body", pygame.Rect(0, 0, 300, 100))
tr.draw_single(surf, "Single", "text.body", (0, 0))
print("[OK] TextRenderer - lines=" + str(len(lines)))

from app.ui.render.shadow_renderer import ShadowRenderer

sr = ShadowRenderer()
surf2 = pygame.Surface((400, 300), pygame.SRCALPHA)
rect = pygame.Rect(50, 50, 200, 100)
sr.draw_box_shadow(surf2, rect, t.radius("radius.md"), "shadow.md", t)
sr.draw_rounded_rect(surf2, rect, t.color("bg.surface"), t.radius("radius.md"),
                     t.color("border.subtle"), 1)
print("[OK] ShadowRenderer")

from app.ui.render.asset_loader import AssetLoader

al = AssetLoader(assets_dir)
icon = al.icon("home", 24)
assert icon is not None, "home icon missing"
assert icon.get_width() == 24
pot = al.pot("clay")
assert pot is not None, "clay pot missing"
plant = al.plant_layer("tree_oak", "seed")
assert plant is not None, "tree_oak/seed missing"
logo = al.logo("logo_mark")
assert logo is not None, "logo_mark missing"
missing = al.load_image("does/not/exist.png")
assert missing is None
print("[OK] AssetLoader")

from app.ui.render.plant_sprite import PlantSprite

ps = PlantSprite(al)
for status in ("seed", "bud", "flower", "wilting", "fruit", "harvested", "rot"):
    s = ps.render("tree_oak", status, 50, (80, 80))
    assert s.get_size() == (80, 80)
thumb = ps.render_thumbnail("tree_oak", "seed", 0, 40)
assert thumb.get_size() == (40, 40)
print("[OK] PlantSprite")

from app.ui.scene_manager import SceneManager
from app.ui.scenes.base_scene import BaseScene

class MockApp:
    pass

class TestScene(BaseScene):
    entered = False
    def on_enter(self, params): self.entered = True

app = MockApp()
sm = SceneManager(app)
sc = TestScene(app)
sm.register("test", sc)
sm.switch_scene("test", {"foo": 1})
assert sc.entered
assert sm.current is sc
sm.switch_scene("missing")
assert sm.current is None
print("[OK] SceneManager + BaseScene")

from app.ui.widgets.base_widget import BaseWidget

bw = BaseWidget(pygame.Rect(10, 10, 100, 40), t)
ev = pygame.event.Event(pygame.MOUSEMOTION, pos=(50, 30))
bw.handle_event(ev)
assert bw._hovered
print("[OK] BaseWidget")

from app.ui.widgets.button import Button

surf3 = pygame.Surface((400, 300))
clicked = []
btn = Button(pygame.Rect(50, 50, 120, 40), t, fr, label="Click me",
             variant="primary", on_click=lambda: clicked.append(1))
btn.render(surf3)
ev_down = pygame.event.Event(pygame.MOUSEBUTTONDOWN, button=1, pos=(110, 70))
ev_up   = pygame.event.Event(pygame.MOUSEBUTTONUP,   button=1, pos=(110, 70))
btn.handle_event(ev_down)
btn.handle_event(ev_up)
assert clicked == [1]
for v in ("primary", "secondary", "ghost", "icon"):
    Button(pygame.Rect(0, 0, 80, 32), t, fr, label="X", variant=v).render(surf3)
print("[OK] Button")

from app.ui.widgets.text_input import TextInput

submitted = []
ti = TextInput(pygame.Rect(20, 20, 200, 36), t, fr,
               placeholder="Type here", on_submit=lambda s: submitted.append(s))
ti.handle_event(pygame.event.Event(pygame.MOUSEBUTTONDOWN, button=1, pos=(120, 38)))
assert ti._focused
for ch in "hello":
    ti.handle_event(pygame.event.Event(pygame.KEYDOWN, key=ord(ch), unicode=ch))
assert ti.text == "hello"
ti.handle_event(pygame.event.Event(pygame.KEYDOWN, key=pygame.K_RETURN, unicode=""))
assert submitted == ["hello"]
assert ti.text == ""
for v in ("default", "search", "password", "chat"):
    TextInput(pygame.Rect(0, 0, 150, 36), t, fr, variant=v).render(surf3)
print("[OK] TextInput")

from app.ui.widgets.sidebar import Sidebar

navigated = []
sb = Sidebar(pygame.Rect(0, 0, 72, 600), t, fr, al,
             on_navigate=lambda k: navigated.append(k), active_scene="home")
sb.render(pygame.Surface((72, 600)))
ev_click = pygame.event.Event(pygame.MOUSEBUTTONDOWN, button=1, pos=(36, 136))
sb.handle_event(ev_click)
assert navigated == ["plants"], navigated
assert sb.active_scene == "plants"
print("[OK] Sidebar")

from app.ui.widgets.toast_widget import ToastWidget

screen_rect = pygame.Rect(0, 0, 800, 600)
done = []
toast = ToastWidget(screen_rect, t, fr, "Saved!", kind="success",
                    duration_ms=100, on_done=lambda: done.append(1))
assert toast._phase == "slide_in"
toast.update(0.25)
assert toast._phase == "hold", toast._phase
toast.update(0.15)
assert toast._phase == "fade_out", toast._phase
toast.update(0.20)
assert toast._phase == "done", toast._phase
assert done == [1]
ToastWidget(screen_rect, t, fr, "Test", kind="info").render(pygame.Surface((800, 600)))
print("[OK] ToastWidget")

from app.ui.widgets.modal_widget import ModalWidget

confirmed = []
cancelled = []
modal = ModalWidget(screen_rect, t, fr,
                    title="Delete?", message="Cannot be undone.",
                    confirm_label="Delete", cancel_label="Cancel",
                    on_confirm=lambda: confirmed.append(1),
                    on_cancel=lambda: cancelled.append(1))
modal.render(pygame.Surface((800, 600)))
cx, cy = modal._confirm_rect.centerx, modal._confirm_rect.centery
modal.handle_event(pygame.event.Event(pygame.MOUSEBUTTONDOWN, button=1, pos=(cx, cy)))
assert confirmed == [1]
modal.handle_event(pygame.event.Event(pygame.KEYDOWN, key=pygame.K_ESCAPE, unicode=""))
assert cancelled == [1]
print("[OK] ModalWidget")

pygame.quit()
print("\n=== ALL UI INFRASTRUCTURE TESTS PASSED ===")
