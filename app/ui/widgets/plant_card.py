import pygame
from .base_widget import BaseWidget


class PlantCard(BaseWidget):
    def __init__(self, rect, theme, fonts, plant_data, plant_sprite, on_click=None, on_right_click=None):
        super().__init__(rect, theme, fonts)
        self.plant = plant_data
        self.plant_sprite = plant_sprite
        self.on_click = on_click
        self.on_right_click = on_right_click
        self._pressed = False

    def render(self, surface):
        if not self.visible:
            return
        theme = self.theme
        r = theme.radius("radius.xl")
        y_off = -1 if self._hovered and not self._pressed else (1 if self._pressed else 0)
        rect = self.rect.move(0, y_off)

        # 그림자
        shadow_surf = pygame.Surface((rect.width + 12, rect.height + 16), pygame.SRCALPHA)
        shadow_col = (0, 0, 0, int(255 * 0.08))
        pygame.draw.rect(shadow_surf, shadow_col, pygame.Rect(6, 10, rect.width, rect.height), border_radius=r)
        surface.blit(shadow_surf, (rect.x - 6, rect.y - 6))

        # 카드 배경
        pygame.draw.rect(surface, theme.color("bg.surface"), rect, border_radius=r)

        pad = theme.space("space.5")

        # 썸네일 (40×40)
        species = self.plant.get("species", "tree_oak")
        status = self._get_dominant_status()
        thumb_size = 40
        thumb = None
        if self.plant_sprite:
            thumb = self.plant_sprite.render_thumbnail(species, status, 50, thumb_size)
        if thumb:
            surface.blit(thumb, (rect.x + pad, rect.y + pad))
        else:
            # 폴백: 색 원
            color_key = self.plant.get("color", "brand.primary_leaf")
            try:
                col = theme.color(color_key)
            except Exception:
                col = theme.color("brand.primary_leaf")
            pygame.draw.circle(surface, col,
                               (rect.x + pad + thumb_size // 2, rect.y + pad + thumb_size // 2),
                               thumb_size // 2)

        # 상태 점 (우상단)
        dot_x = rect.right - pad - 8
        dot_y = rect.y + pad + 8
        dot_col = self._get_status_dot_color()
        pygame.draw.circle(surface, dot_col, (dot_x, dot_y), 5)

        if not self.fonts:
            return

        text_x = rect.x + pad
        text_y = rect.y + pad + thumb_size + theme.space("space.3")

        # 분야명
        f_h2 = self.fonts.get("sans", theme.font_size("text.h2"), True)
        name_surf = f_h2.render(self.plant.get("name", ""), True, theme.color("text.primary"))
        name_surf = self._clip_text(name_surf, rect.width - pad * 2)
        surface.blit(name_surf, (text_x, text_y))
        text_y += name_surf.get_height() + theme.space("space.1")

        # 봉우리 수
        f_sm = self.fonts.get("sans", theme.font_size("text.body_sm"), False)
        active = self.plant.get("stats", {}).get("active_bud_count", 0)
        desc = self.plant.get("description", "")
        meta = f"{active}개 봉우리"
        meta_surf = f_sm.render(meta, True, theme.color("text.muted"))
        surface.blit(meta_surf, (text_x, text_y))
        text_y += meta_surf.get_height() + theme.space("space.3")

        # 진행률 막대
        bar_h = 6
        bar_rect = pygame.Rect(text_x, text_y, rect.width - pad * 2, bar_h)
        r_bar = theme.radius("radius.pill")
        pygame.draw.rect(surface, theme.color("border.subtle"), bar_rect, border_radius=r_bar)
        progress = self._avg_progress()
        if progress > 0:
            fill_w = int(bar_rect.width * progress / 100)
            if fill_w > 0:
                fill_rect = pygame.Rect(bar_rect.x, bar_rect.y, fill_w, bar_h)
                color_key = self.plant.get("color", "brand.primary_leaf")
                try:
                    fill_col = theme.color(color_key)
                except Exception:
                    fill_col = theme.color("brand.primary_leaf")
                pygame.draw.rect(surface, fill_col, fill_rect, border_radius=r_bar)

    def _get_dominant_status(self):
        buds = self.plant.get("_buds", [])
        if not buds:
            return "seed"
        statuses = [b.get("status", "seed") for b in buds]
        for s in ["flower", "fruit", "bud", "wilting", "rot", "seed"]:
            if s in statuses:
                return s
        return "seed"

    def _get_status_dot_color(self):
        status = self._get_dominant_status()
        mapping = {
            "flower": "brand.mint_growth",
            "fruit": "brand.primary_leaf",
            "bud": "brand.mint_growth",
            "seed": "brand.leaf_soft",
            "wilting": "accent.amber_schedule",
            "rot": "accent.rose_care",
            "harvested": "accent.yellow_bloom",
        }
        return self.theme.color(mapping.get(status, "brand.mint_growth"))

    def _avg_progress(self):
        buds = self.plant.get("_buds", [])
        active = [b for b in buds if b.get("status") not in ("harvested", "rot")]
        if not active:
            return 0
        return sum(b.get("progress", 0) for b in active) // len(active)

    def _clip_text(self, surf, max_w):
        if surf.get_width() <= max_w:
            return surf
        clipped = pygame.Surface((max_w, surf.get_height()), pygame.SRCALPHA)
        clipped.blit(surf, (0, 0))
        return clipped

    def handle_event(self, event):
        super().handle_event(event)
        if not self.enabled or not self.visible:
            return False
        if event.type == pygame.MOUSEBUTTONDOWN:
            if self.rect.collidepoint(event.pos):
                if event.button == 1:
                    self._pressed = True
                    return True
                elif event.button == 3:
                    if self.on_right_click:
                        self.on_right_click(self.plant)
                    return True
        if event.type == pygame.MOUSEBUTTONUP and event.button == 1:
            was = self._pressed
            self._pressed = False
            if was and self.rect.collidepoint(event.pos):
                if self.on_click:
                    self.on_click(self.plant)
                return True
        return False


class PlantBoard:
    """홈 화면의 식물 카드 그리드."""

    def __init__(self, rect, theme, fonts, plant_sprite, on_plant_click=None, on_plant_right_click=None):
        self.rect = rect
        self.theme = theme
        self.fonts = fonts
        self.plant_sprite = plant_sprite
        self.on_plant_click = on_plant_click
        self.on_plant_right_click = on_plant_right_click
        self.plants = []
        self.cards = []
        self._scroll_y = 0

    def set_plants(self, plants_with_buds):
        self.plants = plants_with_buds
        self._rebuild_cards()

    def _rebuild_cards(self):
        self.cards.clear()
        if not self.plants:
            return
        gap = self.theme.space("space.6")
        cols = 3
        card_w = (self.rect.width - gap * (cols - 1)) // cols
        card_h = 180

        for i, plant in enumerate(self.plants):
            row = i // cols
            col = i % cols
            x = self.rect.x + col * (card_w + gap)
            y = self.rect.y + row * (card_h + gap) - self._scroll_y
            r = pygame.Rect(x, y, card_w, card_h)
            card = PlantCard(r, self.theme, self.fonts, plant, self.plant_sprite,
                             on_click=self.on_plant_click,
                             on_right_click=self.on_plant_right_click)
            self.cards.append(card)

    def update(self, dt):
        for c in self.cards:
            c.update(dt)

    def render(self, surface):
        clip = surface.get_clip()
        surface.set_clip(self.rect)
        for c in self.cards:
            if c.rect.bottom >= self.rect.top and c.rect.top <= self.rect.bottom:
                c.render(surface)

        # 빈 상태
        if not self.plants and self.fonts:
            f = self.fonts.get("sans", self.theme.font_size("text.body"), False)
            t = f.render("식물이 없습니다. AI에게 첫 식물을 만들어 달라고 말해보세요.", True, self.theme.color("text.muted"))
            tx = self.rect.x + (self.rect.width - t.get_width()) // 2
            ty = self.rect.y + (self.rect.height - t.get_height()) // 2
            surface.blit(t, (tx, ty))
        surface.set_clip(clip)

    def handle_event(self, event):
        if event.type == pygame.MOUSEWHEEL:
            if self.rect.collidepoint(pygame.mouse.get_pos()):
                self._scroll_y = max(0, self._scroll_y - event.y * 30)
                self._rebuild_cards()
                return True
        for c in self.cards:
            if c.handle_event(event):
                return True
        return False
