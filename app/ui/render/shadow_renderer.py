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
