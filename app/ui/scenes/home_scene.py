"""HomeScene — 정원 한눈 보기 홈 화면."""
import pygame
from .base_scene import BaseScene
from app.ui.widgets.summary_card import SummaryCardsRow
from app.ui.widgets.plant_card import PlantBoard
from app.ui.widgets.chat_widget import ChatWidget


SIDEBAR_W = 72


class HomeScene(BaseScene):
    def __init__(self, app):
        super().__init__(app)
        self._stats = {}
        self._briefing = ""
        self._plants = []
        self._wilting_buds = []
        self._summary_row = None
        self._plant_board = None
        self._chat_widget = None
        self._scroll_y = 0
        self._built = False

    def on_enter(self, params):
        self._scroll_y = 0
        self._stats = self.app.garden_state.get_summary()
        self._plants = self._load_plants()
        self._wilting_buds = self._load_wilting()
        briefing = self.app.garden_state.get_daily_briefing()
        if not briefing:
            briefing = self.app.garden_state.build_briefing()
            self.app.garden_state.set_daily_briefing(briefing)
        self._briefing = briefing
        self._built = False
        self._build_widgets()

    def _load_plants(self):
        plants = self.app.plant_manager.list(include_dormant=False, sort="activity")
        for p in plants:
            buds = self.app.bud_manager.list(plant_id=p["id"])
            p["_buds"] = buds
        return plants

    def _load_wilting(self):
        return self.app.bud_manager.list(status="wilting")

    def _build_widgets(self):
        sw, sh = self.app.screen.get_size()
        chat_open = self._chat_widget and self._chat_widget.is_open()
        chat_w = ChatWidget.PANEL_W if chat_open else 0
        content_w = sw - SIDEBAR_W - chat_w
        content_x = SIDEBAR_W
        theme = self.app.theme
        fonts = self.app.fonts
        pad = theme.space("space.10")

        # 통계 카드 행
        cards_h = 140
        cards_rect = pygame.Rect(content_x + pad, 64 + theme.space("space.6"),
                                 content_w - pad * 2, cards_h)
        self._summary_row = SummaryCardsRow(
            cards_rect, theme, fonts, self._stats,
            on_card_click=self._on_card_click
        )

        # 식물 보드
        board_y = cards_rect.bottom + theme.space("space.6")
        board_h = sh - board_y - 120
        board_rect = pygame.Rect(content_x + pad, board_y,
                                 (content_w - pad * 2) * 8 // 12 - theme.space("space.6"), board_h)
        self._plant_board = PlantBoard(
            board_rect, theme, fonts,
            self.app.plant_sprite if hasattr(self.app, "plant_sprite") else None,
            on_plant_click=self._on_plant_click,
            on_plant_right_click=self._on_plant_right_click
        )
        self._plant_board.set_plants(self._plants)

        # ChatWidget
        if not self._chat_widget:
            self._chat_widget = ChatWidget(
                (sw, sh), theme, fonts,
                self.app.assets if hasattr(self.app, "assets") else None,
                self.app.chat_controller
            )

        self._built = True

    def _on_card_click(self, variant):
        self.app.scenes.switch_scene("plants")

    def _on_plant_click(self, plant):
        self.app.scenes.switch_scene("plant_detail", {"plant": plant})

    def _on_plant_right_click(self, plant):
        if self._chat_widget:
            self._chat_widget.open(
                scene=f"식물 상세({plant.get('name', '')})",
                plant_id=plant.get("id")
            )

    def update(self, dt):
        if self._summary_row:
            self._summary_row.update(dt)
        if self._plant_board:
            self._plant_board.update(dt)
        if self._chat_widget:
            self._chat_widget.update(dt)

    def handle_event(self, event):
        if self._chat_widget and self._chat_widget.is_open():
            if self._chat_widget.handle_event(event):
                return
        if event.type == pygame.KEYDOWN and event.key == pygame.K_SPACE:
            if self._chat_widget:
                self._chat_widget.toggle()
            return
        if self._summary_row:
            self._summary_row.handle_event(event)
        if self._plant_board:
            self._plant_board.handle_event(event)

    def render(self, surface):
        theme = self.app.theme
        fonts = self.app.fonts
        sw, sh = surface.get_size()

        if not self._built or sw != getattr(self, "_last_sw", 0) or sh != getattr(self, "_last_sh", 0):
            self._last_sw, self._last_sh = sw, sh
            self._build_widgets()

        content_x = SIDEBAR_W
        pad = theme.space("space.10")

        # ── 상단바 ──
        top_bar = pygame.Rect(content_x, 0, sw - content_x, 56)
        pygame.draw.rect(surface, theme.color("bg.surface"), top_bar)
        pygame.draw.line(surface, theme.color("border.subtle"),
                         (content_x, 56), (sw, 56))
        if fonts:
            f_disp = fonts.get("sans", theme.font_size("text.display"), True)
            t = f_disp.render("홈", True, theme.color("text.primary"))
            surface.blit(t, (content_x + pad, top_bar.y + (56 - t.get_height()) // 2))

        # ── 통계 카드 ──
        if self._summary_row:
            self._summary_row.render(surface)

        # ── 브리핑 패널 ──
        if self._summary_row:
            brief_y = self._summary_row.rect.bottom + theme.space("space.4")
            brief_rect = pygame.Rect(content_x + pad, brief_y,
                                     self._summary_row.rect.width, 60)
            r = theme.radius("radius.lg")
            pygame.draw.rect(surface, theme.color("bg.surface_soft"), brief_rect, border_radius=r)
            if fonts and self._briefing:
                f_body = fonts.get("sans", theme.font_size("text.body"), False)
                # 말줄임 처리
                brief_text = self._briefing[:80] + "..." if len(self._briefing) > 80 else self._briefing
                t = f_body.render(brief_text, True, theme.color("text.primary"))
                surface.blit(t, (brief_rect.x + theme.space("space.4"),
                                 brief_rect.y + (brief_rect.height - t.get_height()) // 2))

        # ── 식물 관리 보드 헤더 ──
        if self._plant_board:
            hdr_y = self._plant_board.rect.y - 32
            if fonts:
                f_h1 = fonts.get("sans", theme.font_size("text.h1"), True)
                t = f_h1.render("식물 관리 보드", True, theme.color("text.primary"))
                surface.blit(t, (self._plant_board.rect.x, hdr_y))

        # ── 식물 보드 ──
        if self._plant_board:
            self._plant_board.render(surface)

        # ── 시들고 있는 식물 섹션 ──
        if self._plant_board and self._wilting_buds:
            wilt_y = self._plant_board.rect.bottom + theme.space("space.8")
            if fonts:
                f_h1 = fonts.get("sans", theme.font_size("text.h1"), True)
                t = f_h1.render(f"시들고 있는 봉우리  주의 {len(self._wilting_buds)}개",
                                True, theme.color("accent.rose_care"))
                surface.blit(t, (content_x + pad, wilt_y))
            wilt_y += 36
            self._render_wilting(surface, wilt_y, content_x + pad,
                                 sw - content_x - pad * 2 - (ChatWidget.PANEL_W if self._chat_widget and self._chat_widget.is_open() else 0))

        # ── 사이드바 ──
        self._render_sidebar(surface, sw, sh)

        # ── 채팅 패널 ──
        if self._chat_widget:
            if self._chat_widget.screen_w != sw or self._chat_widget.screen_h != sh:
                self._chat_widget.update_screen_size(sw, sh)
            self._chat_widget.render(surface)

        # ── 채팅 토글 버튼 (우하단 FAB) ──
        self._render_chat_fab(surface, sw, sh)

    def _render_sidebar(self, surface, sw, sh):
        theme = self.app.theme
        fonts = self.app.fonts
        sidebar_rect = pygame.Rect(0, 0, SIDEBAR_W, sh)
        pygame.draw.rect(surface, theme.color("bg.surface_soft"), sidebar_rect)
        pygame.draw.line(surface, theme.color("border.subtle"),
                         (SIDEBAR_W, 0), (SIDEBAR_W, sh))

        # 로고
        logo = self.app.assets.logo("logo_mark") if hasattr(self.app, "assets") else None
        if logo:
            lsize = 36
            ls = pygame.transform.smoothscale(logo, (lsize, lsize))
            lx = (SIDEBAR_W - lsize) // 2
            surface.blit(ls, (lx, 16))

        # 내비게이션 항목
        items = [("home", "홈", "home"), ("plants", "식물", "plant"), ("settings", "설정", "settings")]
        btn_size = 40
        sp = theme.space("space.3")
        start_y = 80
        for i, (scene_key, label, icon_name) in enumerate(items):
            by = start_y + i * (btn_size + sp)
            bx = (SIDEBAR_W - btn_size) // 2
            btn_rect = pygame.Rect(bx, by, btn_size, btn_size)
            is_active = (scene_key == "home")
            if is_active:
                r = theme.radius("radius.md")
                pygame.draw.rect(surface, theme.color("brand.leaf_soft"), btn_rect, border_radius=r)

            icon = None
            if hasattr(self.app, "assets"):
                icon = self.app.assets.icon(icon_name, 24)
            if icon:
                ix = bx + (btn_size - icon.get_width()) // 2
                iy = by + (btn_size - icon.get_height()) // 2
                surface.blit(icon, (ix, iy))
            elif fonts:
                size = theme.font_size("text.caption")
                f = fonts.get("sans", size, False)
                col = theme.color("brand.primary_leaf") if is_active else theme.color("text.muted")
                t = f.render(label[0], True, col)
                surface.blit(t, (bx + (btn_size - t.get_width()) // 2,
                                 by + (btn_size - t.get_height()) // 2))

    def _render_wilting(self, surface, y, x, total_w):
        theme = self.app.theme
        fonts = self.app.fonts
        cols = 4
        gap = theme.space("space.6")
        card_w = (total_w - gap * (cols - 1)) // cols
        card_h = 80

        for i, bud in enumerate(self._wilting_buds[:cols]):
            cx = x + i * (card_w + gap)
            r_card = pygame.Rect(cx, y, card_w, card_h)
            r = theme.radius("radius.lg")
            # 파스텔 핑크 배경
            bg_surf = pygame.Surface((card_w, card_h), pygame.SRCALPHA)
            bc = theme.color("accent.rose_care") + (int(255 * 0.12),)
            pygame.draw.rect(bg_surf, bc, (0, 0, card_w, card_h), border_radius=r)
            surface.blit(bg_surf, r_card.topleft)
            pygame.draw.rect(surface, theme.color("accent.rose_care"), r_card, width=1, border_radius=r)

            if fonts:
                pad = theme.space("space.4")
                f_h2 = fonts.get("sans", theme.font_size("text.h2"), True)
                f_sm = fonts.get("sans", theme.font_size("text.body_sm"), False)
                t1 = f_h2.render(bud.get("title", "")[:18], True, theme.color("text.primary"))
                surface.blit(t1, (r_card.x + pad, r_card.y + pad))
                t2 = f_sm.render("시들고 있음", True, theme.color("accent.rose_care"))
                surface.blit(t2, (r_card.x + pad, r_card.y + pad + t1.get_height() + 4))

    def _render_chat_fab(self, surface, sw, sh):
        theme = self.app.theme
        fonts = self.app.fonts
        fab_size = 52
        fab_x = sw - fab_size - theme.space("space.8")
        if self._chat_widget and self._chat_widget.is_open():
            fab_x -= ChatWidget.PANEL_W
        fab_y = sh - fab_size - theme.space("space.8")
        fab_rect = pygame.Rect(fab_x, fab_y, fab_size, fab_size)
        r = theme.radius("radius.pill")
        col = theme.color("brand.primary_leaf")
        pygame.draw.circle(surface, col,
                           (fab_rect.centerx, fab_rect.centery), fab_size // 2)
        if fonts:
            f = fonts.get("sans", theme.font_size("text.h1"), True)
            t = f.render("💬", True, theme.color("text.inverse"))
            surface.blit(t, (fab_rect.centerx - t.get_width() // 2,
                             fab_rect.centery - t.get_height() // 2))
