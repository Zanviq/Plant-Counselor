import pygame
from .base_scene import BaseScene


class LoginScene(BaseScene):
    def __init__(self, app):
        super().__init__(app)
        self._mode = "login"  # "login" | "signup"
        self._nickname = ""
        self._password = ""
        self._password2 = ""
        self._active_field = "nickname"  # which field has focus
        self._error_msg = ""
        self._cursor_visible = True
        self._cursor_timer = 0.0

    def on_enter(self, params):
        self._error_msg = ""
        self._nickname = ""
        self._password = ""
        self._password2 = ""
        last = self.app.user_manager.get_last_user()
        if last:
            self._nickname = last

    def update(self, dt):
        self._cursor_timer += dt
        if self._cursor_timer >= 0.5:
            self._cursor_visible = not self._cursor_visible
            self._cursor_timer = 0

    def handle_event(self, event):
        theme = self.app.theme
        if event.type == pygame.KEYDOWN:
            if event.key == pygame.K_TAB:
                fields = ["nickname", "password"] + (["password2"] if self._mode == "signup" else [])
                idx = fields.index(self._active_field) if self._active_field in fields else 0
                self._active_field = fields[(idx + 1) % len(fields)]
            elif event.key == pygame.K_RETURN:
                self._submit()
            elif event.key == pygame.K_BACKSPACE:
                if self._active_field == "nickname":
                    self._nickname = self._nickname[:-1]
                elif self._active_field == "password":
                    self._password = self._password[:-1]
                elif self._active_field == "password2":
                    self._password2 = self._password2[:-1]
            elif event.unicode and event.unicode.isprintable():
                if self._active_field == "nickname":
                    self._nickname += event.unicode
                elif self._active_field == "password":
                    self._password += event.unicode
                elif self._active_field == "password2":
                    self._password2 += event.unicode

        elif event.type == pygame.MOUSEBUTTONDOWN and event.button == 1:
            sw, sh = self.app.screen.get_size()
            card_w, card_h = 400, 480 if self._mode == "signup" else 380
            cx = (sw - card_w) // 2
            cy = (sh - card_h) // 2
            pad = 32

            nick_rect = pygame.Rect(cx + pad, cy + 100, card_w - pad * 2, 44)
            pw_rect = pygame.Rect(cx + pad, cy + 185, card_w - pad * 2, 44)
            btn_rect = pygame.Rect(cx + pad, cy + (290 if self._mode == "signup" else 260), card_w - pad * 2, 48)
            toggle_rect = pygame.Rect(cx + 60, cy + card_h - 52, card_w - 120, 32)

            if nick_rect.collidepoint(event.pos):
                self._active_field = "nickname"
            elif pw_rect.collidepoint(event.pos):
                self._active_field = "password"
            elif btn_rect.collidepoint(event.pos):
                self._submit()
            elif toggle_rect.collidepoint(event.pos):
                self._mode = "signup" if self._mode == "login" else "login"
                self._error_msg = ""
                self._password = ""
                self._password2 = ""

            if self._mode == "signup":
                pw2_rect = pygame.Rect(cx + pad, cy + 270, card_w - pad * 2, 44)
                if pw2_rect.collidepoint(event.pos):
                    self._active_field = "password2"

    def _submit(self):
        if self._mode == "login":
            result = self.app.user_manager.login(self._nickname.strip(), self._password)
            if result:
                self.app.user_manager.save_last_user(self._nickname.strip())
                self.app.garden_state.refresh_summary()
                self.app.transition_engine.scan()
                self.app.scenes.switch_scene("home")
            else:
                self._error_msg = "닉네임 또는 비밀번호가 맞지 않습니다."
        else:
            nick = self._nickname.strip()
            if not nick:
                self._error_msg = "닉네임을 입력해주세요."
                return
            if len(self._password) < 4:
                self._error_msg = "비밀번호는 4자 이상이어야 합니다."
                return
            if self._password != self._password2:
                self._error_msg = "비밀번호가 일치하지 않습니다."
                return
            result = self.app.user_manager.signup(nick, self._password)
            if result:
                self.app.user_manager.login(nick, self._password)
                self.app.user_manager.save_last_user(nick)
                self.app.garden_state.refresh_summary()
                self.app.scenes.switch_scene("home")
            else:
                self._error_msg = "이미 존재하는 닉네임입니다."

    def render(self, surface):
        theme = self.app.theme
        fonts = self.app.fonts
        sw, sh = surface.get_size()

        # 배경
        surface.fill(theme.color("bg.app"))

        # 카드
        card_w = 400
        card_h = 480 if self._mode == "signup" else 380
        cx = (sw - card_w) // 2
        cy = (sh - card_h) // 2
        card_rect = pygame.Rect(cx, cy, card_w, card_h)
        r = theme.radius("radius.xl")
        pygame.draw.rect(surface, theme.color("bg.surface"), card_rect, border_radius=r)
        pygame.draw.rect(surface, theme.color("border.subtle"), card_rect, width=1, border_radius=r)

        pad = 32

        # 로고 + 타이틀
        logo = self.app.assets.logo("logo_mark")
        if logo:
            lsize = 48
            ls = pygame.transform.smoothscale(logo, (lsize, lsize))
            surface.blit(ls, (cx + (card_w - lsize) // 2, cy + 24))
            title_y = cy + 80
        else:
            title_y = cy + 40

        if fonts:
            size_h2 = theme.font_size("text.h2")
            size_body = theme.font_size("text.body")
            size_sm = theme.font_size("text.body_sm")
            size_cap = theme.font_size("text.caption")
            size_h1 = theme.font_size("text.h1")

            f_h1 = fonts.get("sans", size_h1, True)
            f_h2 = fonts.get("sans", size_h2, True)
            f_body = fonts.get("sans", size_body, False)
            f_sm = fonts.get("sans", size_sm, False)
            f_cap = fonts.get("sans", size_cap, False)

            label = "로그인" if self._mode == "login" else "새 계정 만들기"
            t = f_h2.render(label, True, theme.color("text.primary"))
            surface.blit(t, (cx + (card_w - t.get_width()) // 2, title_y))

        # 입력창 - 닉네임
        self._draw_input(surface, "닉네임", self._nickname, False,
                         pygame.Rect(cx + pad, cy + 100, card_w - pad * 2, 44),
                         self._active_field == "nickname", fonts, theme)

        # 입력창 - 비밀번호
        self._draw_input(surface, "비밀번호", self._password, True,
                         pygame.Rect(cx + pad, cy + 185, card_w - pad * 2, 44),
                         self._active_field == "password", fonts, theme)

        btn_y = cy + 260
        if self._mode == "signup":
            self._draw_input(surface, "비밀번호 확인", self._password2, True,
                             pygame.Rect(cx + pad, cy + 270, card_w - pad * 2, 44),
                             self._active_field == "password2", fonts, theme)
            btn_y = cy + 340

        # 에러 메시지
        if self._error_msg and fonts:
            size_cap = theme.font_size("text.caption")
            f_cap = fonts.get("sans", size_cap, False)
            err = f_cap.render(self._error_msg, True, theme.color("accent.rose_care"))
            surface.blit(err, (cx + pad, btn_y - 20))

        # 버튼
        btn_rect = pygame.Rect(cx + pad, btn_y, card_w - pad * 2, 48)
        r_btn = theme.radius("radius.md")
        pygame.draw.rect(surface, theme.color("brand.primary_leaf"), btn_rect, border_radius=r_btn)
        if fonts:
            size_label = theme.font_size("text.label")
            f_label = fonts.get("sans", size_label, True)
            btn_lbl = "로그인" if self._mode == "login" else "가입하기"
            t = f_label.render(btn_lbl, True, theme.color("text.inverse"))
            surface.blit(t, (btn_rect.x + (btn_rect.width - t.get_width()) // 2,
                             btn_rect.y + (btn_rect.height - t.get_height()) // 2))

        # 토글 텍스트
        toggle_y = cy + card_h - 48
        if fonts:
            size_sm = theme.font_size("text.body_sm")
            f_sm = fonts.get("sans", size_sm, False)
            toggle = "계정이 없으신가요? 가입하기" if self._mode == "login" else "이미 계정이 있으신가요? 로그인"
            t = f_sm.render(toggle, True, theme.color("brand.primary_leaf"))
            surface.blit(t, (cx + (card_w - t.get_width()) // 2, toggle_y))

    def _draw_input(self, surface, label, value, is_password, rect, focused, fonts, theme):
        r = theme.radius("radius.md")
        bg = theme.color("bg.surface")
        border = theme.color("brand.primary_leaf") if focused else theme.color("border.subtle")
        pygame.draw.rect(surface, bg, rect, border_radius=r)
        pygame.draw.rect(surface, border, rect, width=1 if not focused else 2, border_radius=r)

        if fonts:
            pad = theme.space("space.3")
            size_sm = theme.font_size("text.body_sm")
            size_body = theme.font_size("text.body")
            f_sm = fonts.get("sans", size_sm, False)
            f_body = fonts.get("sans", size_body, False)

            # 라벨 위에
            lbl = f_sm.render(label, True, theme.color("text.muted"))
            surface.blit(lbl, (rect.x, rect.y - 18))

            # 값
            display = "•" * len(value) if is_password else value
            if not display:
                display = ""
            col = theme.color("text.primary")
            t = f_body.render(display, True, col)
            clip = pygame.Rect(rect.x + pad, rect.y, rect.width - pad * 2, rect.height)
            surface.set_clip(clip)
            ty = rect.y + (rect.height - t.get_height()) // 2
            surface.blit(t, (rect.x + pad, ty))
            surface.set_clip(None)

            # 커서
            if focused and self._cursor_visible:
                cx2 = rect.x + pad + f_body.size(display)[0]
                cx2 = min(cx2, rect.right - pad)
                pygame.draw.line(surface, col, (cx2, rect.y + 8), (cx2, rect.bottom - 8), 1)
