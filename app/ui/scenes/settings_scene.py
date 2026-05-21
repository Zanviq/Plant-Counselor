"""SettingsScene — 설정 화면."""
import pygame
from .base_scene import BaseScene

SIDEBAR_W = 72

TABS = ["계정", "AI 설정", "정원 규칙", "시각/사운드", "데이터", "정보"]


class SettingsScene(BaseScene):
    def __init__(self, app):
        super().__init__(app)
        self._active_tab = 0
        self._api_key_text = ""
        self._api_key_focused = False
        self._msg = ""
        self._msg_color_key = "text.muted"
        # 비밀번호 변경 필드
        self._old_pw = ""
        self._new_pw = ""
        self._new_pw2 = ""
        self._pw_active = None

    def on_enter(self, params):
        self._msg = ""
        user = self.app.user_manager.current()
        if user:
            self._api_key_text = ""  # 보안상 표시하지 않음

    def handle_event(self, event):
        if event.type == pygame.MOUSEBUTTONDOWN and event.button == 1:
            self._handle_tab_click(event.pos)
            self._handle_sidebar_click(event.pos)
            if self._active_tab == 0:
                self._handle_account_click(event.pos)
            elif self._active_tab == 1:
                self._handle_ai_click(event.pos)
        elif event.type == pygame.KEYDOWN:
            self._handle_key(event)

    def _handle_tab_click(self, pos):
        sw, sh = self.app.screen.get_size()
        tab_panel_x = SIDEBAR_W
        tab_w = 140
        tab_y = 56
        tab_h = 48
        for i, label in enumerate(TABS):
            r = pygame.Rect(tab_panel_x, tab_y + i * tab_h, tab_w, tab_h)
            if r.collidepoint(pos):
                self._active_tab = i
                self._msg = ""
                break

    def _handle_sidebar_click(self, pos):
        items = [("home", 80), ("plants", 136), ("settings", 192)]
        btn_size = 40
        for scene_key, by in items:
            bx = (SIDEBAR_W - btn_size) // 2
            if pygame.Rect(bx, by, btn_size, btn_size).collidepoint(pos):
                if scene_key != "settings":
                    self.app.scenes.switch_scene(scene_key)
                break

    def _handle_account_click(self, pos):
        sw, sh = self.app.screen.get_size()
        content_x = SIDEBAR_W + 140
        pad = self.app.theme.space("space.6")

        logout_btn = pygame.Rect(content_x + pad, 120, 160, 40)
        if logout_btn.collidepoint(pos):
            self.app.user_manager.logout()
            self.app.scenes.switch_scene("login")
            return

        # 비밀번호 변경 입력창들
        pw_fields = [
            ("_old_pw", "현재 비밀번호", pygame.Rect(content_x + pad, 220, 300, 44)),
            ("_new_pw", "새 비밀번호", pygame.Rect(content_x + pad, 290, 300, 44)),
            ("_new_pw2", "새 비밀번호 확인", pygame.Rect(content_x + pad, 360, 300, 44)),
        ]
        self._pw_active = None
        for attr, label, r in pw_fields:
            if r.collidepoint(pos):
                self._pw_active = attr
                break

        pw_btn = pygame.Rect(content_x + pad, 430, 160, 40)
        if pw_btn.collidepoint(pos):
            ok = self.app.user_manager.change_password(self._old_pw, self._new_pw
                                                        if self._new_pw == self._new_pw2 else "")
            if ok:
                self._msg = "비밀번호가 변경됐습니다."
                self._msg_color_key = "brand.primary_leaf"
                self._old_pw = self._new_pw = self._new_pw2 = ""
            else:
                self._msg = "비밀번호 변경 실패. 현재 비밀번호를 확인하세요."
                self._msg_color_key = "accent.rose_care"

    def _handle_ai_click(self, pos):
        sw, sh = self.app.screen.get_size()
        content_x = SIDEBAR_W + 140
        pad = self.app.theme.space("space.6")

        api_rect = pygame.Rect(content_x + pad, 130, 360, 44)
        if api_rect.collidepoint(pos):
            self._api_key_focused = True
            return
        self._api_key_focused = False

        save_btn = pygame.Rect(content_x + pad, 190, 140, 40)
        if save_btn.collidepoint(pos):
            self.app.llm_client.set_api_key(self._api_key_text.strip())
            self._msg = "API 키가 저장됐습니다."
            self._msg_color_key = "brand.primary_leaf"

        # 톤 선택
        tones = [("counselor", "따뜻한 상담사"), ("assistant", "담백한 비서"), ("friend", "친구")]
        for i, (tone_key, tone_label) in enumerate(tones):
            r = pygame.Rect(content_x + pad, 270 + i * 52, 280, 44)
            if r.collidepoint(pos):
                user = self.app.user_manager.current()
                if user:
                    user["tone"] = tone_key
                    self.app.file_store.write_json(
                        self.app.path_resolver.user_file(user["nickname"]), user
                    )
                break

    def _handle_key(self, event):
        if self._active_tab == 1 and self._api_key_focused:
            if event.key == pygame.K_BACKSPACE:
                self._api_key_text = self._api_key_text[:-1]
            elif event.key == pygame.K_RETURN:
                self._api_key_focused = False
            elif event.unicode and event.unicode.isprintable():
                self._api_key_text += event.unicode
        elif self._active_tab == 0 and self._pw_active:
            attr = self._pw_active
            cur = getattr(self, attr, "")
            if event.key == pygame.K_BACKSPACE:
                setattr(self, attr, cur[:-1])
            elif event.key == pygame.K_TAB:
                fields = ["_old_pw", "_new_pw", "_new_pw2"]
                idx = fields.index(attr) if attr in fields else 0
                self._pw_active = fields[(idx + 1) % len(fields)]
            elif event.unicode and event.unicode.isprintable():
                setattr(self, attr, cur + event.unicode)

    def render(self, surface):
        theme = self.app.theme
        fonts = self.app.fonts
        sw, sh = surface.get_size()

        surface.fill(theme.color("bg.app"))

        # ── 사이드바 ──
        self._render_sidebar(surface, sw, sh)

        # ── 탭 패널 ──
        tab_x = SIDEBAR_W
        tab_w = 140
        tab_panel = pygame.Rect(tab_x, 0, tab_w, sh)
        pygame.draw.rect(surface, theme.color("bg.surface"), tab_panel)
        pygame.draw.line(surface, theme.color("border.subtle"),
                         (tab_x + tab_w, 0), (tab_x + tab_w, sh))

        if fonts:
            f_h2 = fonts.get("sans", theme.font_size("text.h2"), True)
            t = f_h2.render("설정", True, theme.color("text.primary"))
            surface.blit(t, (tab_x + 16, 16))

        tab_h = 48
        tab_y = 56
        for i, label in enumerate(TABS):
            r = pygame.Rect(tab_x, tab_y + i * tab_h, tab_w, tab_h)
            is_active = (i == self._active_tab)
            if is_active:
                pygame.draw.rect(surface, theme.color("brand.leaf_soft"), r)
                pygame.draw.line(surface, theme.color("brand.primary_leaf"),
                                 r.topleft, r.bottomleft, 3)
            if fonts:
                f_body = fonts.get("sans", theme.font_size("text.body"), False)
                col = theme.color("brand.primary_leaf") if is_active else theme.color("text.primary")
                t = f_body.render(label, True, col)
                surface.blit(t, (tab_x + 16, r.y + (tab_h - t.get_height()) // 2))

        # ── 콘텐츠 영역 ──
        content_x = tab_x + tab_w
        content_rect = pygame.Rect(content_x, 56, sw - content_x, sh - 56)
        pygame.draw.rect(surface, theme.color("bg.app"), content_rect)

        # 상단 타이틀
        if fonts:
            f_disp = fonts.get("sans", theme.font_size("text.display"), True)
            t = f_disp.render(TABS[self._active_tab], True, theme.color("text.primary"))
            surface.blit(t, (content_x + self.app.theme.space("space.6"), 68))

        pad = theme.space("space.6")

        if self._active_tab == 0:
            self._render_account(surface, theme, fonts, content_x, pad)
        elif self._active_tab == 1:
            self._render_ai(surface, theme, fonts, content_x, pad)
        elif self._active_tab == 2:
            self._render_garden_rules(surface, theme, fonts, content_x, pad)
        elif self._active_tab == 3:
            self._render_appearance(surface, theme, fonts, content_x, pad)
        elif self._active_tab == 4:
            self._render_data(surface, theme, fonts, content_x, pad)
        elif self._active_tab == 5:
            self._render_about(surface, theme, fonts, content_x, pad)

        # 메시지
        if self._msg and fonts:
            f_sm = fonts.get("sans", theme.font_size("text.body_sm"), False)
            t = f_sm.render(self._msg, True, theme.color(self._msg_color_key))
            surface.blit(t, (content_x + pad, sh - 40))

    def _render_account(self, surface, theme, fonts, cx, pad):
        user = self.app.user_manager.current()
        if not user or not fonts:
            return
        sw, sh = surface.get_size()
        f_h2 = fonts.get("sans", theme.font_size("text.h2"), True)
        f_body = fonts.get("sans", theme.font_size("text.body"), False)
        f_sm = fonts.get("sans", theme.font_size("text.body_sm"), False)

        y = 120
        t = f_body.render(f"사용자: {user.get('nickname', '')}", True, theme.color("text.primary"))
        surface.blit(t, (cx + pad, y))
        y += t.get_height() + theme.space("space.3")

        # 로그아웃 버튼
        logout_btn = pygame.Rect(cx + pad, y, 160, 40)
        r_btn = theme.radius("radius.md")
        pygame.draw.rect(surface, theme.color("accent.rose_care"), logout_btn, border_radius=r_btn)
        lt = f_sm.render("로그아웃", True, theme.color("text.inverse"))
        surface.blit(lt, (logout_btn.x + (logout_btn.w - lt.get_width()) // 2,
                          logout_btn.y + (logout_btn.h - lt.get_height()) // 2))
        y += 60

        # 비밀번호 변경
        t = f_h2.render("비밀번호 변경", True, theme.color("text.primary"))
        surface.blit(t, (cx + pad, y))
        y += t.get_height() + theme.space("space.3")

        pw_fields = [
            ("_old_pw", "현재 비밀번호"),
            ("_new_pw", "새 비밀번호"),
            ("_new_pw2", "새 비밀번호 확인"),
        ]
        for attr, label in pw_fields:
            self._draw_pw_input(surface, theme, fonts, label, getattr(self, attr, ""),
                                pygame.Rect(cx + pad, y, 300, 44), self._pw_active == attr)
            y += 70

        pw_btn = pygame.Rect(cx + pad, y, 160, 40)
        pygame.draw.rect(surface, theme.color("brand.primary_leaf"), pw_btn, border_radius=theme.radius("radius.md"))
        bt = f_sm.render("비밀번호 변경", True, theme.color("text.inverse"))
        surface.blit(bt, (pw_btn.x + (pw_btn.w - bt.get_width()) // 2,
                          pw_btn.y + (pw_btn.h - bt.get_height()) // 2))

    def _draw_pw_input(self, surface, theme, fonts, label, value, rect, focused):
        r = theme.radius("radius.md")
        pygame.draw.rect(surface, theme.color("bg.surface"), rect, border_radius=r)
        border = theme.color("brand.primary_leaf") if focused else theme.color("border.subtle")
        pygame.draw.rect(surface, border, rect, width=1 if not focused else 2, border_radius=r)
        if fonts:
            f_sm = fonts.get("sans", theme.font_size("text.body_sm"), False)
            lbl = f_sm.render(label, True, theme.color("text.muted"))
            surface.blit(lbl, (rect.x, rect.y - 16))
            f_body = fonts.get("sans", theme.font_size("text.body"), False)
            show = "•" * len(value)
            t = f_body.render(show, True, theme.color("text.primary"))
            pad = theme.space("space.3")
            surface.blit(t, (rect.x + pad, rect.y + (rect.height - t.get_height()) // 2))

    def _render_ai(self, surface, theme, fonts, cx, pad):
        if not fonts:
            return
        sw, sh = surface.get_size()
        f_sm = fonts.get("sans", theme.font_size("text.body_sm"), False)
        f_body = fonts.get("sans", theme.font_size("text.body"), False)
        f_h2 = fonts.get("sans", theme.font_size("text.h2"), True)

        y = 120
        t = f_body.render("Anthropic API 키", True, theme.color("text.muted"))
        surface.blit(t, (cx + pad, y))
        y += t.get_height() + 4

        api_rect = pygame.Rect(cx + pad, y, 360, 44)
        r = theme.radius("radius.md")
        pygame.draw.rect(surface, theme.color("bg.surface"), api_rect, border_radius=r)
        border = theme.color("brand.primary_leaf") if self._api_key_focused else theme.color("border.subtle")
        pygame.draw.rect(surface, border, api_rect, width=1 if not self._api_key_focused else 2, border_radius=r)
        display = "•" * len(self._api_key_text) if self._api_key_text else "sk-ant-..."
        col = theme.color("text.primary") if self._api_key_text else theme.color("text.muted")
        t = f_body.render(display, True, col)
        ip_pad = theme.space("space.3")
        surface.blit(t, (api_rect.x + ip_pad, api_rect.y + (api_rect.height - t.get_height()) // 2))
        y += 54

        save_btn = pygame.Rect(cx + pad, y, 140, 40)
        pygame.draw.rect(surface, theme.color("brand.primary_leaf"), save_btn,
                         border_radius=theme.radius("radius.md"))
        bt = f_sm.render("저장", True, theme.color("text.inverse"))
        surface.blit(bt, (save_btn.x + (save_btn.w - bt.get_width()) // 2,
                          save_btn.y + (save_btn.h - bt.get_height()) // 2))
        y += 60

        # 응답 톤
        t = f_h2.render("AI 응답 톤", True, theme.color("text.primary"))
        surface.blit(t, (cx + pad, y))
        y += t.get_height() + theme.space("space.3")

        user = self.app.user_manager.current()
        current_tone = user.get("tone", "counselor") if user else "counselor"
        tones = [("counselor", "따뜻한 상담사"), ("assistant", "담백한 비서"), ("friend", "친구")]
        for tone_key, tone_label in tones:
            r_tone = pygame.Rect(cx + pad, y, 280, 44)
            is_sel = current_tone == tone_key
            bg_col = theme.color("brand.leaf_soft") if is_sel else theme.color("bg.surface")
            pygame.draw.rect(surface, bg_col, r_tone, border_radius=theme.radius("radius.md"))
            pygame.draw.rect(surface, theme.color("border.subtle"), r_tone, width=1,
                             border_radius=theme.radius("radius.md"))
            t = f_body.render(tone_label, True, theme.color("brand.primary_leaf") if is_sel else theme.color("text.primary"))
            surface.blit(t, (r_tone.x + theme.space("space.4"), r_tone.y + (r_tone.height - t.get_height()) // 2))
            y += 52

    def _render_garden_rules(self, surface, theme, fonts, cx, pad):
        if not fonts:
            return
        user = self.app.user_manager.current()
        rules = (user or {}).get("garden_rules", {})
        f_body = fonts.get("sans", theme.font_size("text.body"), False)
        f_sm = fonts.get("sans", theme.font_size("text.body_sm"), False)

        y = 120
        items = [
            ("시듦 기준 일수", "wilting_days", 7),
            ("시듦 → 썩음 추가 일수", "wilting_review_extra_days", 7),
            ("썩음 후 사라짐 일수", "rot_disappear_days", 14),
            ("마감 임박 알림 기준일", "deadline_warn_days", 3),
        ]
        for label, key, default in items:
            t = f_sm.render(label, True, theme.color("text.muted"))
            surface.blit(t, (cx + pad, y))
            val = rules.get(key, default)
            t2 = f_body.render(str(val) + "일", True, theme.color("text.primary"))
            surface.blit(t2, (cx + pad + 280, y))
            y += t.get_height() + theme.space("space.6")

    def _render_appearance(self, surface, theme, fonts, cx, pad):
        if not fonts:
            return
        f_body = fonts.get("sans", theme.font_size("text.body"), False)
        f_sm = fonts.get("sans", theme.font_size("text.body_sm"), False)

        y = 120
        t = f_sm.render("테마", True, theme.color("text.muted"))
        surface.blit(t, (cx + pad, y))
        y += t.get_height() + 4

        user = self.app.user_manager.current()
        current_theme = (user or {}).get("appearance", {}).get("theme", "auto")
        themes_list = [
            ("auto", "자동"),
            ("light_spring", "봄"),
            ("light_summer", "여름"),
            ("light_autumn", "가을"),
            ("light_winter", "겨울"),
            ("night", "야간"),
        ]
        for tk, tl in themes_list:
            is_sel = current_theme == tk
            r_theme = pygame.Rect(cx + pad, y, 200, 40)
            bg = theme.color("brand.leaf_soft") if is_sel else theme.color("bg.surface")
            pygame.draw.rect(surface, bg, r_theme, border_radius=theme.radius("radius.md"))
            pygame.draw.rect(surface, theme.color("border.subtle"), r_theme, width=1,
                             border_radius=theme.radius("radius.md"))
            t = f_body.render(tl, True, theme.color("brand.primary_leaf") if is_sel else theme.color("text.primary"))
            surface.blit(t, (r_theme.x + theme.space("space.4"), r_theme.y + (r_theme.height - t.get_height()) // 2))
            y += 48

    def _render_data(self, surface, theme, fonts, cx, pad):
        if not fonts:
            return
        f_body = fonts.get("sans", theme.font_size("text.body"), False)
        f_sm = fonts.get("sans", theme.font_size("text.body_sm"), False)

        y = 120
        user = self.app.user_manager.current()
        if user:
            path = self.app.path_resolver.user_root(user["nickname"])
            t = f_sm.render(f"데이터 위치: {path}", True, theme.color("text.muted"))
            surface.blit(t, (cx + pad, y))
            y += t.get_height() + theme.space("space.4")

        # 백업 버튼
        backup_btn = pygame.Rect(cx + pad, y, 180, 40)
        pygame.draw.rect(surface, theme.color("brand.primary_leaf"), backup_btn,
                         border_radius=theme.radius("radius.md"))
        bt = f_sm.render("스냅샷 만들기", True, theme.color("text.inverse"))
        surface.blit(bt, (backup_btn.x + (backup_btn.w - bt.get_width()) // 2,
                          backup_btn.y + (backup_btn.h - bt.get_height()) // 2))

    def _render_about(self, surface, theme, fonts, cx, pad):
        if not fonts:
            return
        f_body = fonts.get("sans", theme.font_size("text.body"), False)
        f_sm = fonts.get("sans", theme.font_size("text.body_sm"), False)

        y = 120
        items = [
            "Plant Counselor v0.1.0",
            "나의 계획, 고민, 일정을 식물로 시각화하는 LLM 기반 앱.",
            "데이터는 로컬에 저장되며, LLM API 호출만 외부로 나갑니다.",
        ]
        for item in items:
            t = f_body.render(item, True, theme.color("text.primary"))
            surface.blit(t, (cx + pad, y))
            y += t.get_height() + theme.space("space.4")

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
            is_active = (scene_key == "settings")
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
