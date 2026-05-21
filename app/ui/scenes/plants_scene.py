"""PlantsScene — 정원 풍경 (식물 목록)."""
import pygame
import random
from .base_scene import BaseScene
from app.ui.widgets.chat_widget import ChatWidget

SIDEBAR_W = 72


class PlantsScene(BaseScene):
    def __init__(self, app):
        super().__init__(app)
        self._plants = []
        self._chat_widget = None
        self._grass_seed = 42
        self._floor_tiles = []

    def on_enter(self, params):
        self._plants = self._load_plants()
        sw, sh = self.app.screen.get_size()
        if not self._chat_widget:
            self._chat_widget = ChatWidget(
                (sw, sh), self.app.theme, self.app.fonts,
                getattr(self.app, "assets", None),
                self.app.chat_controller
            )

    def _load_plants(self):
        plants = self.app.plant_manager.list(include_dormant=False, sort="activity")
        for p in plants:
            buds = self.app.bud_manager.list(plant_id=p["id"])
            p["_buds"] = buds
        return plants

    def update(self, dt):
        if self._chat_widget:
            self._chat_widget.update(dt)

    def handle_event(self, event):
        if self._chat_widget and self._chat_widget.is_open():
            if self._chat_widget.handle_event(event):
                return

        theme = self.app.theme
        sw, sh = self.app.screen.get_size()

        if event.type == pygame.KEYDOWN and event.key == pygame.K_SPACE:
            if self._chat_widget:
                self._chat_widget.toggle()
        elif event.type == pygame.MOUSEBUTTONDOWN and event.button == 1:
            # 식물 클릭 체크
            plant_pos = self._get_plant_positions(sw, sh)
            for plant, (px, py, pw, ph) in zip(self._plants, plant_pos):
                click_rect = pygame.Rect(px, py, pw, ph + 60)  # 화분 + 라벨 포함
                if click_rect.collidepoint(event.pos):
                    self.app.scenes.switch_scene("plant_detail", {"plant": plant})
                    return
        elif event.type == pygame.MOUSEBUTTONDOWN and event.button == 3:
            plant_pos = self._get_plant_positions(sw, sh)
            for plant, (px, py, pw, ph) in zip(self._plants, plant_pos):
                click_rect = pygame.Rect(px, py, pw, ph + 60)
                if click_rect.collidepoint(event.pos):
                    if self._chat_widget:
                        self._chat_widget.open(
                            scene=f"식물 상세({plant.get('name', '')})",
                            plant_id=plant.get("id")
                        )
                    return

        # 사이드바 내비
        if event.type == pygame.MOUSEBUTTONDOWN and event.button == 1:
            self._handle_sidebar_click(event.pos)

    def _handle_sidebar_click(self, pos):
        items = [("home", 80), ("plants", 136), ("settings", 192)]
        btn_size = 40
        for scene_key, by in items:
            bx = (SIDEBAR_W - btn_size) // 2
            if pygame.Rect(bx, by, btn_size, btn_size).collidepoint(pos):
                if scene_key != "plants":
                    self.app.scenes.switch_scene(scene_key)
                break

    def render(self, surface):
        theme = self.app.theme
        fonts = self.app.fonts
        sw, sh = surface.get_size()

        chat_w = ChatWidget.PANEL_W if self._chat_widget and self._chat_widget.is_open() else 0
        content_x = SIDEBAR_W
        content_w = sw - SIDEBAR_W - chat_w

        # ── 배경 ──
        surface.fill(theme.color("bg.app"))

        # 잔디 바닥 영역 (하단 1/3)
        floor_y = sh * 2 // 3
        grass_color = (139, 195, 74)
        floor_rect = pygame.Rect(content_x, floor_y, content_w, sh - floor_y)
        pygame.draw.rect(surface, (180, 210, 140), floor_rect)

        # 잔디 타일
        assets = getattr(self.app, "assets", None)
        if assets:
            grass = assets.floor_tile("grass_01")
            if grass:
                gw = grass.get_width()
                for tx in range(content_x, content_x + content_w, gw):
                    surface.blit(grass, (tx, floor_y))

        # ── 상단바 ──
        top_bar = pygame.Rect(content_x, 0, content_w, 56)
        pygame.draw.rect(surface, theme.color("bg.surface"), top_bar)
        pygame.draw.line(surface, theme.color("border.subtle"),
                         (content_x, 56), (sw, 56))
        if fonts:
            f_disp = fonts.get("sans", theme.font_size("text.display"), True)
            t = f_disp.render("식물 정원", True, theme.color("text.primary"))
            surface.blit(t, (content_x + theme.space("space.10"), 16))

        pad = theme.space("space.10")

        # ── 식물들 ──
        plant_pos = self._get_plant_positions(sw, sh)

        if not self._plants:
            # 빈 정원 안내
            if fonts:
                f_body = fonts.get("sans", theme.font_size("text.body"), False)
                t = f_body.render("어떤 분야의 식물을 먼저 키울까요? AI에게 말해보세요.", True, theme.color("text.muted"))
                tx = content_x + (content_w - t.get_width()) // 2
                ty = sh // 2 - t.get_height() // 2
                surface.blit(t, (tx, ty))
        else:
            for plant, (px, py, pw, ph) in zip(self._plants, plant_pos):
                self._render_plant(surface, plant, px, py, pw, ph, theme, fonts)

        # ── 사이드바 ──
        self._render_sidebar(surface, sw, sh)

        # ── 채팅 패널 ──
        if self._chat_widget:
            if self._chat_widget.screen_w != sw or self._chat_widget.screen_h != sh:
                self._chat_widget.update_screen_size(sw, sh)
            self._chat_widget.render(surface)

    def _get_plant_positions(self, sw, sh):
        chat_w = ChatWidget.PANEL_W if self._chat_widget and self._chat_widget.is_open() else 0
        content_w = sw - SIDEBAR_W - chat_w
        n = max(len(self._plants), 1)
        plant_w = 100
        plant_h = 120
        floor_y = sh * 2 // 3
        total_needed = n * plant_w + (n - 1) * 20
        start_x = SIDEBAR_W + (content_w - total_needed) // 2
        positions = []
        for i in range(len(self._plants)):
            px = start_x + i * (plant_w + 20)
            py = floor_y - plant_h
            positions.append((px, py, plant_w, plant_h))
        return positions

    def _render_plant(self, surface, plant, px, py, pw, ph, theme, fonts):
        assets = getattr(self.app, "assets", None)
        plant_sprite = getattr(self.app, "plant_sprite", None)

        species = plant.get("species", "tree_oak")
        buds = plant.get("_buds", [])
        dominant_status = "seed"
        for s in ["flower", "fruit", "bud", "wilting", "rot", "seed"]:
            if any(b.get("status") == s for b in buds):
                dominant_status = s
                break

        # 식물 합성 이미지
        if plant_sprite:
            sprite = plant_sprite.render(species, dominant_status, 50, (pw, ph))
            surface.blit(sprite, (px, py))
        else:
            # 폴백: 색 직사각형 + 화분
            color_key = plant.get("color", "brand.primary_leaf")
            try:
                col = theme.color(color_key)
            except Exception:
                col = theme.color("brand.primary_leaf")
            # 줄기
            stem_rect = pygame.Rect(px + pw // 2 - 4, py + 30, 8, ph - 50)
            pygame.draw.rect(surface, (100, 140, 80), stem_rect)
            # 잎 원
            pygame.draw.circle(surface, col, (px + pw // 2, py + 20), 30)
            # 화분
            pot_rect = pygame.Rect(px + pw // 4, py + ph - 30, pw // 2, 30)
            pygame.draw.rect(surface, (160, 100, 60), pot_rect, border_radius=4)

        # 라벨 카드
        label_rect = pygame.Rect(px - 10, py + ph + 6, pw + 20, 56)
        r = theme.radius("radius.lg")
        pygame.draw.rect(surface, theme.color("bg.surface"), label_rect, border_radius=r)
        pygame.draw.rect(surface, theme.color("border.subtle"), label_rect, width=1, border_radius=r)

        if fonts:
            pad = theme.space("space.2")
            f_h2 = fonts.get("sans", theme.font_size("text.body_sm"), True)
            name = plant.get("name", "")[:8]
            t = f_h2.render(name, True, theme.color("text.primary"))
            surface.blit(t, (label_rect.x + pad, label_rect.y + 6))

            f_sm = fonts.get("sans", theme.font_size("text.caption"), False)
            active = len([b for b in buds if b.get("status") not in ("harvested", "rot")])
            t2 = f_sm.render(f"{active}개 봉우리", True, theme.color("text.muted"))
            surface.blit(t2, (label_rect.x + pad, label_rect.y + 6 + t.get_height() + 2))

    def _render_sidebar(self, surface, sw, sh):
        theme = self.app.theme
        fonts = self.app.fonts
        pygame.draw.rect(surface, theme.color("bg.surface_soft"), pygame.Rect(0, 0, SIDEBAR_W, sh))
        pygame.draw.line(surface, theme.color("border.subtle"), (SIDEBAR_W, 0), (SIDEBAR_W, sh))

        logo = getattr(self.app, "assets", None) and self.app.assets.logo("logo_mark")
        if logo:
            lsize = 36
            ls = pygame.transform.smoothscale(logo, (lsize, lsize))
            surface.blit(ls, ((SIDEBAR_W - lsize) // 2, 16))

        items = [("home", "홈", "home"), ("plants", "식물", "plant"), ("settings", "설정", "settings")]
        btn_size = 40
        sp = theme.space("space.3")
        start_y = 80
        assets = getattr(self.app, "assets", None)
        for i, (scene_key, label, icon_name) in enumerate(items):
            by = start_y + i * (btn_size + sp)
            bx = (SIDEBAR_W - btn_size) // 2
            btn_rect = pygame.Rect(bx, by, btn_size, btn_size)
            is_active = (scene_key == "plants")
            if is_active:
                pygame.draw.rect(surface, theme.color("brand.leaf_soft"), btn_rect,
                                 border_radius=theme.radius("radius.md"))
            icon = assets.icon(icon_name, 24) if assets else None
            if icon:
                surface.blit(icon, (bx + (btn_size - icon.get_width()) // 2,
                                    by + (btn_size - icon.get_height()) // 2))
            elif fonts:
                f = fonts.get("sans", theme.font_size("text.caption"), False)
                col = theme.color("brand.primary_leaf") if is_active else theme.color("text.muted")
                t = f.render(label[0], True, col)
                surface.blit(t, (bx + (btn_size - t.get_width()) // 2,
                                 by + (btn_size - t.get_height()) // 2))
