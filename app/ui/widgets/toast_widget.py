import pygame
from .base_widget import BaseWidget
from app.ui.render.animator import Animator


class ToastWidget(BaseWidget):
    """Slide-in/fade-out notification toast shown in the bottom-right corner.

    kind: "info" | "success" | "warn" | "error"
    duration_ms: time the toast stays fully visible (default 3000 ms)

    Usage
    -----
    toast = ToastWidget(surface_rect, theme, fonts, message="Saved!", kind="success",
                        on_done=lambda: scene_manager.pop_overlay())
    scene_manager.push_overlay(toast)
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
        self._phase = "slide_in"  # slide_in -> hold -> fade_out -> done
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

        # Shadow (simple drop shadow)
        shadow_surf = pygame.Surface((self.rect.width, self.rect.height), pygame.SRCALPHA)
        pygame.draw.rect(shadow_surf, (0, 0, 0, 30), shadow_surf.get_rect(), border_radius=r)
        surface.blit(shadow_surf, (self.rect.x + 2, draw_y + 4))

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
