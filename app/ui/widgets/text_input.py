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
