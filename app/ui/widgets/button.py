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
