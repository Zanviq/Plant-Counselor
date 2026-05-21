"""PlantDetailScene — 식물 상세 (봉우리 시각화)."""
import pygame
from .base_scene import BaseScene
from app.ui.widgets.chat_widget import ChatWidget

SIDEBAR_W = 72

STATUS_COLORS = {
    "seed": "text.muted",
    "bud": "brand.leaf_soft",
    "flower": "brand.mint_growth",
    "fruit": "brand.primary_leaf",
    "harvested": "accent.yellow_bloom",
    "wilting": "accent.amber_schedule",
    "rot": "accent.rose_care",
}
STATUS_LABELS = {
    "seed": "씨앗", "bud": "봉우리", "flower": "꽃",
    "fruit": "열매", "harvested": "수확됨", "wilting": "시듦", "rot": "썩음",
}


class PlantDetailScene(BaseScene):
    def __init__(self, app):
        super().__init__(app)
        self._plant = None
        self._buds = []
        self._selected_bud = None
        self._chat_widget = None
        self._scroll_y = 0

    def on_enter(self, params):
        self._plant = params.get("plant")
        if self._plant:
            self._buds = self.app.bud_manager.list(plant_id=self._plant["id"])
            self._plant["_buds"] = self._buds
        self._selected_bud = None
        self._scroll_y = 0
        sw, sh = self.app.screen.get_size()
        if not self._chat_widget:
            self._chat_widget = ChatWidget(
                (sw, sh), self.app.theme, self.app.fonts,
                getattr(self.app, "assets", None),
                self.app.chat_controller
            )

    def update(self, dt):
        if self._chat_widget:
            self._chat_widget.update(dt)

    def handle_event(self, event):
        if self._chat_widget and self._chat_widget.is_open():
            if self._chat_widget.handle_event(event):
                return

        if event.type == pygame.KEYDOWN:
            if event.key == pygame.K_ESCAPE:
                self.app.scenes.switch_scene("plants")
            elif event.key == pygame.K_SPACE:
                if self._chat_widget:
                    self._chat_widget.toggle()
        elif event.type == pygame.MOUSEBUTTONDOWN and event.button == 1:
            self._handle_sidebar_click(event.pos)
            self._handle_bud_click(event.pos)

    def _handle_sidebar_click(self, pos):
        items = [("home", 80), ("plants", 136), ("settings", 192)]
        btn_size = 40
        for scene_key, by in items:
            bx = (SIDEBAR_W - btn_size) // 2
            if pygame.Rect(bx, by, btn_size, btn_size).collidepoint(pos):
                self.app.scenes.switch_scene(scene_key)
                break

    def _handle_bud_click(self, pos):
        sw, sh = self.app.screen.get_size()
        bud_rects = self._get_bud_rects(sw, sh)
        for bud, rect in zip(self._buds, bud_rects):
            if rect.collidepoint(pos):
                self._selected_bud = bud
                break

    def _get_bud_rects(self, sw, sh):
        chat_w = ChatWidget.PANEL_W if self._chat_widget and self._chat_widget.is_open() else 0
        content_x = SIDEBAR_W
        content_w = sw - SIDEBAR_W - chat_w
        pad = self.app.theme.space("space.10")
        plant_area_w = content_w * 6 // 12
        bud_area_x = content_x + pad + plant_area_w + pad
        bud_area_w = content_w - plant_area_w - pad * 3
        rects = []
        bud_h = 56
        bud_gap = self.app.theme.space("space.2")
        by = 80
        for bud in self._buds:
            r = pygame.Rect(bud_area_x, by + 60 - self._scroll_y, bud_area_w, bud_h)
            rects.append(r)
            by += bud_h + bud_gap
        return rects

    def render(self, surface):
        theme = self.app.theme
        fonts = self.app.fonts
        sw, sh = surface.get_size()

        surface.fill(theme.color("bg.app"))

        chat_w = ChatWidget.PANEL_W if self._chat_widget and self._chat_widget.is_open() else 0
        content_x = SIDEBAR_W
        content_w = sw - SIDEBAR_W - chat_w
        pad = theme.space("space.10")

        # ── 상단바 ──
        top_bar = pygame.Rect(content_x, 0, content_w, 56)
        pygame.draw.rect(surface, theme.color("bg.surface"), top_bar)
        pygame.draw.line(surface, theme.color("border.subtle"),
                         (content_x, 56), (content_x + content_w, 56))
        if fonts and self._plant:
            f_disp = fonts.get("sans", theme.font_size("text.display"), True)
            t = f_disp.render(self._plant.get("name", ""), True, theme.color("text.primary"))
            surface.blit(t, (content_x + pad, 16))
            # 뒤로 버튼
            f_sm = fonts.get("sans", theme.font_size("text.body_sm"), False)
            back = f_sm.render("← 정원으로", True, theme.color("brand.primary_leaf"))
            surface.blit(back, (content_x + content_w - back.get_width() - pad, 20))

        if not self._plant:
            return

        # ── 식물 정보 영역 (왼쪽 6/12) ──
        plant_area_w = content_w * 6 // 12
        plant_rect = pygame.Rect(content_x + pad, 80, plant_area_w - pad, sh - 120)

        # 식물 스프라이트
        plant_sprite = getattr(self.app, "plant_sprite", None)
        species = self._plant.get("species", "tree_oak")
        dominant_status = self._get_dominant_status()
        sprite_size = min(plant_area_w - pad, sh - 200)
        if plant_sprite:
            sprite = plant_sprite.render(species, dominant_status, 50, (sprite_size, sprite_size))
            sx = content_x + pad + (plant_area_w - pad - sprite_size) // 2
            surface.blit(sprite, (sx, 80))
        else:
            self._draw_fallback_plant(surface, theme, content_x + pad, 80, plant_area_w - pad, sprite_size, dominant_status)

        # 봉우리 노드들 (식물 위에 위치)
        self._render_bud_nodes(surface, theme, fonts, content_x + pad, 80, plant_area_w - pad, sprite_size)

        # 식물 통계
        stats = self._plant.get("stats", {})
        stat_y = 80 + sprite_size + theme.space("space.4")
        if fonts and stat_y < sh - 80:
            f_sm = fonts.get("sans", theme.font_size("text.body_sm"), False)
            items = [
                f"수확: {stats.get('harvested_count', 0)}회",
                f"활성 봉우리: {stats.get('active_bud_count', 0)}개",
                f"포기: {stats.get('rot_count', 0)}회",
            ]
            for ii, text in enumerate(items):
                t = f_sm.render(text, True, theme.color("text.muted"))
                surface.blit(t, (content_x + pad + ii * 120, stat_y))

        # ── 봉우리 목록 (오른쪽) ──
        bud_area_x = content_x + pad + plant_area_w
        bud_area_w = content_w - plant_area_w - pad * 2
        self._render_bud_list(surface, theme, fonts, bud_area_x, bud_area_w, sh)

        # ── 봉우리 상세 패널 ──
        if self._selected_bud:
            self._render_bud_detail(surface, theme, fonts, content_x, content_w, sh)

        # ── 사이드바 ──
        self._render_sidebar(surface, sw, sh)

        # ── 채팅 패널 ──
        if self._chat_widget:
            if self._chat_widget.screen_w != sw or self._chat_widget.screen_h != sh:
                self._chat_widget.update_screen_size(sw, sh)
            self._chat_widget.render(surface)

    def _get_dominant_status(self):
        for s in ["flower", "fruit", "bud", "wilting", "rot", "seed"]:
            if any(b.get("status") == s for b in self._buds):
                return s
        return "seed"

    def _draw_fallback_plant(self, surface, theme, x, y, w, h, status):
        col_key = STATUS_COLORS.get(status, "brand.primary_leaf")
        try:
            col = theme.color(col_key)
        except Exception:
            col = theme.color("brand.primary_leaf")
        cx = x + w // 2
        stem_rect = pygame.Rect(cx - 5, y + h // 3, 10, h * 2 // 3 - 30)
        pygame.draw.rect(surface, (100, 140, 80), stem_rect)
        pygame.draw.circle(surface, col, (cx, y + h // 3), h // 4)
        pot_rect = pygame.Rect(cx - 30, y + h - 30, 60, 30)
        pygame.draw.rect(surface, (160, 100, 60), pot_rect, border_radius=4)

    def _render_bud_nodes(self, surface, theme, fonts, x, y, w, h):
        if not self._buds or not fonts:
            return
        cx = x + w // 2
        import math
        radius = h // 3
        for i, bud in enumerate(self._buds[:8]):
            angle = (i / max(len(self._buds[:8]), 1)) * 2 * math.pi - math.pi / 2
            bx = cx + int(radius * math.cos(angle))
            by = y + h // 3 + int(radius * 0.5 * math.sin(angle))
            status = bud.get("status", "seed")
            col_key = STATUS_COLORS.get(status, "text.muted")
            try:
                col = theme.color(col_key)
            except Exception:
                col = theme.color("text.muted")
            dot_size = 8
            if status == "flower":
                dot_size = 12
            elif status in ("fruit", "harvested"):
                dot_size = 10
            pygame.draw.circle(surface, col, (bx, by), dot_size)
            if bud == self._selected_bud:
                pygame.draw.circle(surface, theme.color("brand.deep_stem"), (bx, by), dot_size + 3, 2)

    def _render_bud_list(self, surface, theme, fonts, x, w, sh):
        if not fonts:
            return
        pad = theme.space("space.4")
        bud_h = 56
        bud_gap = theme.space("space.2")
        by = 80 - self._scroll_y

        # 헤더
        f_h1 = fonts.get("sans", theme.font_size("text.h1"), True)
        t = f_h1.render("봉우리", True, theme.color("text.primary"))
        surface.blit(t, (x, 60))

        for bud in self._buds:
            rect = pygame.Rect(x, by + 36, w - pad, bud_h)
            if rect.bottom < 60 or rect.top > sh - 20:
                by += bud_h + bud_gap
                continue

            is_selected = bud == self._selected_bud
            status = bud.get("status", "seed")
            col_key = STATUS_COLORS.get(status, "text.muted")
            try:
                bg_col = theme.color(col_key)
            except Exception:
                bg_col = theme.color("text.muted")

            r = theme.radius("radius.md")
            bg_surf = pygame.Surface((rect.width, rect.height), pygame.SRCALPHA)
            alpha_col = bg_col + (int(255 * 0.15),)
            pygame.draw.rect(bg_surf, alpha_col, (0, 0, rect.width, rect.height), border_radius=r)
            surface.blit(bg_surf, rect.topleft)
            if is_selected:
                pygame.draw.rect(surface, bg_col, rect, width=2, border_radius=r)

            f_h2 = fonts.get("sans", theme.font_size("text.body"), True)
            f_sm = fonts.get("sans", theme.font_size("text.caption"), False)
            t1 = f_h2.render(bud.get("title", "")[:20], True, theme.color("text.primary"))
            t2 = f_sm.render(STATUS_LABELS.get(status, status) + f"  {bud.get('progress', 0)}%",
                             True, theme.color("text.muted"))
            surface.blit(t1, (rect.x + pad, rect.y + 8))
            surface.blit(t2, (rect.x + pad, rect.y + 8 + t1.get_height() + 2))

            by += bud_h + bud_gap

    def _render_bud_detail(self, surface, theme, fonts, cx, cw, sh):
        if not self._selected_bud or not fonts:
            return
        bud = self._selected_bud
        panel_w = min(480, cw - SIDEBAR_W * 2)
        panel_h = min(400, sh - 100)
        panel_x = cx + (cw - panel_w) // 2
        panel_y = (sh - panel_h) // 2

        overlay = pygame.Surface((cw, sh), pygame.SRCALPHA)
        overlay.fill((0, 0, 0, 100))
        surface.blit(overlay, (cx, 0))

        r = theme.radius("radius.xl")
        panel_rect = pygame.Rect(panel_x, panel_y, panel_w, panel_h)
        pygame.draw.rect(surface, theme.color("bg.surface"), panel_rect, border_radius=r)

        pad = theme.space("space.5")
        ty = panel_y + pad

        f_h2 = fonts.get("sans", theme.font_size("text.h2"), True)
        f_body = fonts.get("sans", theme.font_size("text.body"), False)
        f_sm = fonts.get("sans", theme.font_size("text.body_sm"), False)
        f_cap = fonts.get("sans", theme.font_size("text.caption"), False)

        t = f_h2.render(bud.get("title", ""), True, theme.color("text.primary"))
        surface.blit(t, (panel_x + pad, ty))
        ty += t.get_height() + theme.space("space.3")

        status = bud.get("status", "seed")
        status_label = STATUS_LABELS.get(status, status)
        t = f_sm.render(f"상태: {status_label}  진행률: {bud.get('progress', 0)}%",
                        True, theme.color("text.muted"))
        surface.blit(t, (panel_x + pad, ty))
        ty += t.get_height() + theme.space("space.2")

        if bud.get("detail"):
            t = f_body.render(bud["detail"][:60], True, theme.color("text.primary"))
            surface.blit(t, (panel_x + pad, ty))
            ty += t.get_height() + theme.space("space.2")

        if bud.get("deadline"):
            t = f_sm.render(f"마감: {bud['deadline']}", True, theme.color("accent.amber_schedule"))
            surface.blit(t, (panel_x + pad, ty))
            ty += t.get_height() + theme.space("space.4")

        # 진행률 바
        bar_rect = pygame.Rect(panel_x + pad, ty, panel_w - pad * 2, 8)
        r_bar = theme.radius("radius.pill")
        pygame.draw.rect(surface, theme.color("border.subtle"), bar_rect, border_radius=r_bar)
        progress = bud.get("progress", 0)
        if progress > 0:
            fill_w = int(bar_rect.width * progress / 100)
            pygame.draw.rect(surface, theme.color("brand.primary_leaf"),
                             pygame.Rect(bar_rect.x, bar_rect.y, fill_w, 8), border_radius=r_bar)
        ty += 20

        # 닫기 버튼
        close_btn = pygame.Rect(panel_x + panel_w - 40, panel_y + 12, 28, 28)
        t = f_h2.render("✕", True, theme.color("text.muted"))
        surface.blit(t, close_btn.topleft)

        # AI 상담 버튼
        btn_rect = pygame.Rect(panel_x + pad, panel_y + panel_h - 60, panel_w - pad * 2, 40)
        r_btn = theme.radius("radius.md")
        pygame.draw.rect(surface, theme.color("brand.primary_leaf"), btn_rect, border_radius=r_btn)
        t = f_sm.render("AI에게 이 봉우리 상담받기", True, theme.color("text.inverse"))
        surface.blit(t, (btn_rect.x + (btn_rect.width - t.get_width()) // 2,
                         btn_rect.y + (btn_rect.height - t.get_height()) // 2))

    def _render_sidebar(self, surface, sw, sh):
        theme = self.app.theme
        fonts = self.app.fonts
        pygame.draw.rect(surface, theme.color("bg.surface_soft"), pygame.Rect(0, 0, SIDEBAR_W, sh))
        pygame.draw.line(surface, theme.color("border.subtle"), (SIDEBAR_W, 0), (SIDEBAR_W, sh))
        assets = getattr(self.app, "assets", None)
        logo = assets.logo("logo_mark") if assets else None
        if logo:
            lsize = 36
            ls = pygame.transform.smoothscale(logo, (lsize, lsize))
            surface.blit(ls, ((SIDEBAR_W - lsize) // 2, 16))
        items = [("home", "홈", "home"), ("plants", "식물", "plant"), ("settings", "설정", "settings")]
        btn_size = 40
        sp = theme.space("space.3")
        for i, (scene_key, label, icon_name) in enumerate(items):
            by = 80 + i * (btn_size + sp)
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
