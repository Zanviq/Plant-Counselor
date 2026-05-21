import pygame
from .base_widget import BaseWidget


class Sidebar(BaseWidget):
    """72-pixel-wide navigation sidebar with icon buttons.

    Navigation items are defined in ITEMS as (scene_key, label, icon_name).
    """

    ITEMS = [
        ("home",     "홈",    "home"),
        ("plants",   "식물",  "plant"),
        ("calendar", "캘린더", "calendar"),
        ("chat",     "채팅",  "chat"),
        ("settings", "설정",  "settings"),
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
