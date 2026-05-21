"""ChatWidget — AI 대화 패널. 화면 우측에서 슬라이드 인."""
import pygame
import threading
from .base_widget import BaseWidget


class ChatWidget:
    PANEL_W = 380

    def __init__(self, screen_size, theme, fonts, assets, chat_controller):
        self.screen_w, self.screen_h = screen_size
        self.theme = theme
        self.fonts = fonts
        self.assets = assets
        self.chat_controller = chat_controller

        self.visible = False
        self._x_current = self.screen_w  # 숨김 상태
        self._x_target = self.screen_w
        self._anim_speed = 1200  # px/s

        self.messages = []  # [{"role": "user"|"assistant", "content": "..."}]
        self._scroll_y = 0
        self._max_scroll = 0

        # 입력창 상태
        self._input_text = ""
        self._input_focused = False
        self._cursor_visible = True
        self._cursor_timer = 0.0
        self._loading = False

        self._context_scene = "홈"
        self._selected_plant_id = None
        self._selected_bud_id = None

        # 빠른 질문 칩
        self.quick_asks = ["일정 정리", "감정 기록", "식물 상태"]

    # ── 공개 API ──

    def open(self, scene="홈", plant_id=None, bud_id=None):
        self._context_scene = scene
        self._selected_plant_id = plant_id
        self._selected_bud_id = bud_id
        self.visible = True
        self._x_target = self.screen_w - self.PANEL_W

    def close(self):
        self._x_target = self.screen_w
        self.visible = False

    def toggle(self):
        if self._x_target < self.screen_w:
            self.close()
        else:
            self.open()

    def is_open(self):
        return self._x_current < self.screen_w - 10

    def append_message(self, role, content):
        self.messages.append({"role": role, "content": content})
        self._scroll_to_bottom()

    def update_screen_size(self, w, h):
        self.screen_w, self.screen_h = w, h
        if not self.visible:
            self._x_current = w
            self._x_target = w

    # ── 내부 ──

    def _scroll_to_bottom(self):
        self._scroll_y = max(0, self._max_scroll)

    def _panel_rect(self):
        return pygame.Rect(int(self._x_current), 0, self.PANEL_W, self.screen_h)

    def _content_x(self):
        return int(self._x_current)

    def update(self, dt):
        # 슬라이드 애니메이션
        diff = self._x_target - self._x_current
        if abs(diff) > 0.5:
            step = self._anim_speed * dt
            if abs(diff) < step:
                self._x_current = self._x_target
            else:
                self._x_current += step if diff > 0 else -step

        # 커서 깜빡임
        self._cursor_timer += dt
        if self._cursor_timer >= 0.5:
            self._cursor_visible = not self._cursor_visible
            self._cursor_timer = 0

    def render(self, surface):
        if self._x_current >= self.screen_w:
            return

        theme = self.theme
        panel = self._panel_rect()

        # 패널 배경
        r = theme.radius("radius.xl")
        pygame.draw.rect(surface, theme.color("bg.surface"), panel)
        pygame.draw.line(surface, theme.color("border.subtle"),
                         panel.topleft, panel.bottomleft, 1)

        # ── 헤더 ──
        hdr_h = 72
        hdr_rect = pygame.Rect(panel.x, panel.y, panel.width, hdr_h)
        pygame.draw.rect(surface, theme.color("bg.surface"), hdr_rect)
        pygame.draw.line(surface, theme.color("border.subtle"),
                         (panel.x, hdr_h), (panel.right, hdr_h))

        pad = theme.space("space.5")
        cx = panel.x + pad

        # 아바타
        avatar = self.assets.load_image("pixels/characters/ai_avatar.png") if self.assets else None
        av_size = 36
        av_y = hdr_rect.y + (hdr_h - av_size) // 2
        if avatar:
            av = pygame.transform.smoothscale(avatar, (av_size, av_size))
            surface.blit(av, (cx, av_y))
        else:
            pygame.draw.circle(surface, theme.color("brand.leaf_soft"),
                               (cx + av_size // 2, av_y + av_size // 2), av_size // 2)

        # 제목
        if self.fonts:
            tx = cx + av_size + theme.space("space.3")
            f_h2 = self.fonts.get("sans", theme.font_size("text.h2"), True)
            f_sm = self.fonts.get("sans", theme.font_size("text.body_sm"), False)
            t1 = f_h2.render("상담 AI", True, theme.color("text.primary"))
            t2 = f_sm.render("고민과 일정을 함께 봅니다", True, theme.color("text.muted"))
            surface.blit(t1, (tx, av_y + 2))
            surface.blit(t2, (tx, av_y + t1.get_height() + 2))

        # 닫기 버튼
        close_r = pygame.Rect(panel.right - 40, hdr_rect.y + 16, 28, 28)
        if self.fonts:
            f_cap = self.fonts.get("sans", theme.font_size("text.h2"), False)
            t = f_cap.render("✕", True, theme.color("text.muted"))
            surface.blit(t, (close_r.x + (close_r.w - t.get_width()) // 2,
                             close_r.y + (close_r.h - t.get_height()) // 2))

        # ── 대화 영역 ──
        input_h = 80
        quick_h = 44
        msg_area = pygame.Rect(panel.x, hdr_h, panel.width, panel.height - hdr_h - input_h - quick_h)
        clip = surface.get_clip()
        surface.set_clip(msg_area)

        msg_y = msg_area.y + pad - self._scroll_y
        self._max_scroll = 0
        for msg in self.messages:
            rendered_h = self._render_message(surface, msg, panel, msg_y, msg_area)
            msg_y += rendered_h + theme.space("space.3")
        self._max_scroll = max(0, msg_y - msg_area.bottom + pad)

        # 로딩 표시
        if self._loading and self.fonts:
            f_sm = self.fonts.get("sans", theme.font_size("text.body_sm"), False)
            t = f_sm.render("AI가 생각 중...", True, theme.color("text.muted"))
            surface.blit(t, (panel.x + pad, msg_y))

        surface.set_clip(clip)

        # ── 빠른 질문 칩 ──
        chip_y = panel.bottom - input_h - quick_h
        chip_x = panel.x + pad
        if self.fonts:
            f_lbl = self.fonts.get("sans", theme.font_size("text.label"), False)
            for qask in self.quick_asks:
                t = f_lbl.render(qask, True, theme.color("brand.primary_leaf"))
                chip_w = t.get_width() + 20
                chip_rect = pygame.Rect(chip_x, chip_y + 8, chip_w, 28)
                chip_r = theme.radius("radius.pill")
                pygame.draw.rect(surface, theme.color("brand.leaf_soft"), chip_rect, border_radius=chip_r)
                surface.blit(t, (chip_rect.x + 10, chip_rect.y + (chip_rect.height - t.get_height()) // 2))
                chip_x += chip_w + theme.space("space.2")

        # ── 입력창 ──
        input_y = panel.bottom - input_h
        input_rect = pygame.Rect(panel.x + pad, input_y + 14, panel.width - pad * 2 - 44, 44)
        r_inp = theme.radius("radius.lg")
        pygame.draw.rect(surface, theme.color("bg.surface_soft"), input_rect, border_radius=r_inp)
        border_col = theme.color("brand.primary_leaf") if self._input_focused else theme.color("border.subtle")
        pygame.draw.rect(surface, border_col, input_rect, width=1, border_radius=r_inp)

        if self.fonts:
            f_body = self.fonts.get("sans", theme.font_size("text.body"), False)
            ip_pad = theme.space("space.3")
            display = self._input_text or "발화를 입력하세요..."
            col = theme.color("text.primary") if self._input_text else theme.color("text.muted")
            t = f_body.render(display, True, col)
            clip2 = pygame.Rect(input_rect.x + ip_pad, input_rect.y,
                                input_rect.width - ip_pad * 2, input_rect.height)
            surface.set_clip(clip2)
            surface.blit(t, (input_rect.x + ip_pad,
                             input_rect.y + (input_rect.height - t.get_height()) // 2))
            surface.set_clip(clip)

            if self._input_focused and self._cursor_visible:
                cx2 = input_rect.x + ip_pad + f_body.size(self._input_text)[0]
                cx2 = min(cx2, input_rect.right - ip_pad)
                pygame.draw.line(surface, theme.color("text.primary"),
                                 (cx2, input_rect.y + 8), (cx2, input_rect.bottom - 8), 1)

        # 전송 버튼
        send_btn = pygame.Rect(input_rect.right + theme.space("space.2"), input_y + 14, 40, 44)
        r_btn = theme.radius("radius.md")
        send_col = theme.color("brand.primary_leaf") if self._input_text else theme.color("border.subtle")
        pygame.draw.rect(surface, send_col, send_btn, border_radius=r_btn)
        if self.fonts:
            f_lbl = self.fonts.get("sans", theme.font_size("text.h2"), True)
            t = f_lbl.render("↑", True, theme.color("text.inverse"))
            surface.blit(t, (send_btn.x + (send_btn.w - t.get_width()) // 2,
                             send_btn.y + (send_btn.h - t.get_height()) // 2))

        # 힌트
        if self.fonts:
            f_cap = self.fonts.get("sans", theme.font_size("text.caption"), False)
            t = f_cap.render("Enter로 전송", True, theme.color("text.muted"))
            surface.blit(t, (panel.x + pad, panel.bottom - 16))

    def _render_message(self, surface, msg, panel, y, clip_rect):
        theme = self.theme
        pad = theme.space("space.4")
        is_user = msg["role"] == "user"
        content = msg["content"]
        max_w = panel.width - pad * 4

        if not self.fonts:
            return 20

        f_body = self.fonts.get("sans", theme.font_size("text.body"), False)
        f_cap = self.fonts.get("sans", theme.font_size("text.caption"), False)

        # 텍스트 줄바꿈
        words = content.split()
        lines = []
        cur = ""
        for w in words:
            test = (cur + " " + w).strip()
            if f_body.size(test)[0] <= max_w:
                cur = test
            else:
                if cur:
                    lines.append(cur)
                cur = w
        if cur:
            lines.append(cur)
        if not lines:
            lines = [""]

        line_h = f_body.get_height() + 2
        bubble_h = len(lines) * line_h + pad * 2
        bubble_w = min(max_w, max((f_body.size(l)[0] for l in lines), default=60) + pad * 2)

        if is_user:
            bx = panel.right - bubble_w - pad
        else:
            bx = panel.x + pad

        if y + bubble_h > clip_rect.top and y < clip_rect.bottom:
            r = theme.radius("radius.lg")
            bg = theme.color("brand.leaf_soft") if is_user else theme.color("bg.surface_soft")
            bubble_rect = pygame.Rect(bx, y, bubble_w, bubble_h)
            pygame.draw.rect(surface, bg, bubble_rect, border_radius=r)

            ty = y + pad
            for line in lines:
                t = f_body.render(line, True, theme.color("text.primary"))
                surface.blit(t, (bx + pad, ty))
                ty += line_h

        return bubble_h

    def handle_event(self, event):
        theme = self.theme
        panel = self._panel_rect()

        if event.type == pygame.MOUSEBUTTONDOWN and event.button == 1:
            # 닫기 버튼
            close_r = pygame.Rect(panel.right - 40, 16, 28, 28)
            if close_r.collidepoint(event.pos):
                self.close()
                return True
            # 입력창 포커스
            input_h = 80
            input_y = panel.bottom - input_h
            input_rect = pygame.Rect(panel.x + theme.space("space.5"), input_y + 14,
                                     panel.width - theme.space("space.5") * 2 - 44, 44)
            if input_rect.collidepoint(event.pos):
                self._input_focused = True
                return True
            # 전송 버튼
            send_btn = pygame.Rect(input_rect.right + theme.space("space.2"), input_y + 14, 40, 44)
            if send_btn.collidepoint(event.pos):
                self._send()
                return True
            # 빠른 질문 칩
            if panel.collidepoint(event.pos):
                self._input_focused = False
                return True

        if event.type == pygame.KEYDOWN and self._input_focused:
            if event.key == pygame.K_RETURN:
                self._send()
                return True
            elif event.key == pygame.K_BACKSPACE:
                self._input_text = self._input_text[:-1]
                return True
            elif event.key == pygame.K_ESCAPE:
                self._input_focused = False
                return True
            elif event.unicode and event.unicode.isprintable():
                self._input_text += event.unicode
                return True

        if event.type == pygame.MOUSEWHEEL and panel.collidepoint(pygame.mouse.get_pos()):
            self._scroll_y = max(0, min(self._max_scroll, self._scroll_y - event.y * 30))
            return True

        return False

    def _send(self):
        text = self._input_text.strip()
        if not text or self._loading:
            return
        self._input_text = ""
        self.append_message("user", text)
        self._loading = True

        def _do():
            try:
                response = self.chat_controller.send_user_message(text)
                self.append_message("assistant", response or "")
            except Exception as e:
                self.append_message("assistant", f"오류: {e}")
            finally:
                self._loading = False

        t = threading.Thread(target=_do, daemon=True)
        t.start()
