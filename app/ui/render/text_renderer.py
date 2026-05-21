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
