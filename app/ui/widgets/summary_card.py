import pygame
from .base_widget import BaseWidget


CARD_VARIANTS = {
    "concerns_active": {
        "badge_color": "brand.leaf_soft",
        "icon_color": "brand.primary_leaf",
        "data_key": "active_concerns",
        "label": "진행 중인 고민",
        "icon_char": "♠",
    },
    "schedules_active": {
        "badge_color": "accent.amber_schedule",
        "icon_color": "accent.amber_schedule",
        "data_key": "active_schedules",
        "label": "진행 중인 일정",
        "icon_char": "◆",
        "badge_alpha": 0.2,
    },
    "harvested_this_month": {
        "badge_color": "accent.yellow_bloom",
        "icon_color": "accent.yellow_bloom",
        "data_key": "harvested_this_month",
        "label": "이번 달 수확",
        "icon_char": "★",
        "badge_alpha": 0.2,
    },
    "wilting": {
        "badge_color": "accent.rose_care",
        "icon_color": "accent.rose_care",
        "data_key": "wilting_count",
        "label": "시들고 있는 봉우리",
        "icon_char": "↓",
        "badge_alpha": 0.2,
    },
}


class SummaryCard(BaseWidget):
    def __init__(self, rect, theme, fonts, variant="concerns_active", value=0, on_click=None):
        super().__init__(rect, theme, fonts)
        self.variant = variant
        self.value = value
        self.on_click = on_click
        self._pressed = False
        self._hover_y_off = 0

    def render(self, surface):
        if not self.visible:
            return
        theme = self.theme
        cfg = CARD_VARIANTS.get(self.variant, CARD_VARIANTS["concerns_active"])

        y_off = -1 if self._hovered and not self._pressed else (1 if self._pressed else 0)
        r = theme.radius("radius.xl")
        rect = self.rect.move(0, y_off)

        # 카드 배경 + 그림자
        shadow_surf = pygame.Surface((rect.width + 12, rect.height + 12), pygame.SRCALPHA)
        shadow_rect = pygame.Rect(6, 6 + 4, rect.width, rect.height)
        shadow_col = (0, 0, 0, int(255 * 0.08))
        pygame.draw.rect(shadow_surf, shadow_col, shadow_rect, border_radius=r)
        surface.blit(shadow_surf, (rect.x - 6, rect.y - 6))

        pygame.draw.rect(surface, theme.color("bg.surface"), rect, border_radius=r)

        pad = theme.space("space.5")

        # 아이콘 배지 (40×40)
        badge_size = 40
        badge_rect = pygame.Rect(rect.x + pad, rect.y + pad, badge_size, badge_size)
        badge_r = theme.radius("radius.md")
        badge_col = theme.color(cfg["badge_color"])
        if cfg.get("badge_alpha"):
            badge_surf = pygame.Surface((badge_size, badge_size), pygame.SRCALPHA)
            bc = badge_col + (int(255 * cfg["badge_alpha"]),)
            pygame.draw.rect(badge_surf, bc, (0, 0, badge_size, badge_size), border_radius=badge_r)
            surface.blit(badge_surf, badge_rect.topleft)
        else:
            pygame.draw.rect(surface, badge_col, badge_rect, border_radius=badge_r)

        # 아이콘 문자
        if self.fonts:
            icon_size = theme.font_size("text.h2")
            f_icon = self.fonts.get("sans", icon_size, True)
            icon_col = theme.color(cfg["icon_color"])
            icon_surf = f_icon.render(cfg["icon_char"], True, icon_col)
            ix = badge_rect.x + (badge_size - icon_surf.get_width()) // 2
            iy = badge_rect.y + (badge_size - icon_surf.get_height()) // 2
            surface.blit(icon_surf, (ix, iy))

        # 숫자
        num_y = rect.y + pad + badge_size + theme.space("space.3")
        if self.fonts:
            num_size = theme.font_size("text.number_lg")
            f_num = self.fonts.get("sans", num_size, True)
            num_surf = f_num.render(str(self.value), True, theme.color("text.primary"))
            surface.blit(num_surf, (rect.x + pad, num_y))

            # 라벨
            lbl_size = theme.font_size("text.body_sm")
            f_lbl = self.fonts.get("sans", lbl_size, False)
            lbl_surf = f_lbl.render(cfg["label"], True, theme.color("text.muted"))
            lbl_y = num_y + num_surf.get_height() + theme.space("space.1")
            surface.blit(lbl_surf, (rect.x + pad, lbl_y))

    def handle_event(self, event):
        super().handle_event(event)
        if not self.enabled or not self.visible:
            return False
        if event.type == pygame.MOUSEBUTTONDOWN and event.button == 1:
            if self.rect.collidepoint(event.pos):
                self._pressed = True
                return True
        if event.type == pygame.MOUSEBUTTONUP and event.button == 1:
            was = self._pressed
            self._pressed = False
            if was and self.rect.collidepoint(event.pos):
                if self.on_click:
                    self.on_click(self.variant)
                return True
        return False


class SummaryCardsRow:
    def __init__(self, rect, theme, fonts, stats=None, on_card_click=None):
        self.rect = rect
        self.theme = theme
        self.fonts = fonts
        self.stats = stats or {}
        self.on_card_click = on_card_click
        self.cards = []
        self._build()

    def _build(self):
        self.cards.clear()
        variants = ["concerns_active", "schedules_active", "harvested_this_month", "wilting"]
        n = len(variants)
        gap = self.theme.space("space.6")
        card_w = (self.rect.width - gap * (n - 1)) // n
        card_h = self.rect.height

        for i, v in enumerate(variants):
            x = self.rect.x + i * (card_w + gap)
            r = pygame.Rect(x, self.rect.y, card_w, card_h)
            cfg = CARD_VARIANTS[v]
            val = self.stats.get(cfg["data_key"], 0)
            card = SummaryCard(r, self.theme, self.fonts, variant=v, value=val, on_click=self.on_card_click)
            self.cards.append(card)

    def update_stats(self, stats):
        self.stats = stats
        for card in self.cards:
            cfg = CARD_VARIANTS[card.variant]
            card.value = stats.get(cfg["data_key"], 0)

    def update(self, dt):
        for c in self.cards:
            c.update(dt)

    def render(self, surface):
        for c in self.cards:
            c.render(surface)

    def handle_event(self, event):
        for c in self.cards:
            if c.handle_event(event):
                return True
        return False
