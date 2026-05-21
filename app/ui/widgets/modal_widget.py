import pygame
from .base_widget import BaseWidget
from app.ui.render.shadow_renderer import ShadowRenderer


class ModalWidget(BaseWidget):
    """Centered confirmation/alert dialog with a semi-transparent backdrop.

    Usage
    -----
    modal = ModalWidget(
        screen_rect, theme, fonts,
        title="삭제하시겠습니까?",
        message="이 식물을 삭제하면 되돌릴 수 없습니다.",
        confirm_label="삭제",
        cancel_label="취소",
        on_confirm=lambda: do_delete(),
        on_cancel=lambda: scene_manager.pop_overlay(),
    )
    scene_manager.push_overlay(modal)
    """

    CARD_WIDTH = 320
    CARD_HEIGHT = 180

    def __init__(
        self,
        screen_rect: pygame.Rect,
        theme,
        fonts,
        title: str = "",
        message: str = "",
        confirm_label: str = "확인",
        cancel_label: str = "취소",
        on_confirm=None,
        on_cancel=None,
    ):
        # Widget rect = full screen (for backdrop)
        super().__init__(screen_rect, theme, fonts)
        self.screen_rect = screen_rect
        self.title = title
        self.message = message
        self.confirm_label = confirm_label
        self.cancel_label = cancel_label
        self.on_confirm = on_confirm
        self.on_cancel = on_cancel

        self._shadow = ShadowRenderer()

        # Card centered on screen
        cx = screen_rect.centerx - self.CARD_WIDTH // 2
        cy = screen_rect.centery - self.CARD_HEIGHT // 2
        self._card_rect = pygame.Rect(cx, cy, self.CARD_WIDTH, self.CARD_HEIGHT)

        pad = theme.space("space.4")
        btn_h = 36
        btn_w = (self.CARD_WIDTH - pad * 3) // 2

        # Cancel button (left)
        self._cancel_rect = pygame.Rect(
            self._card_rect.x + pad,
            self._card_rect.bottom - btn_h - pad,
            btn_w,
            btn_h,
        )
        # Confirm button (right)
        self._confirm_rect = pygame.Rect(
            self._cancel_rect.right + pad,
            self._card_rect.bottom - btn_h - pad,
            btn_w,
            btn_h,
        )

        self._hovered_confirm = False
        self._hovered_cancel = False

    # ------------------------------------------------------------------
    # Widget hooks
    # ------------------------------------------------------------------

    def render(self, surface: pygame.Surface) -> None:
        if not self.visible:
            return

        # Semi-transparent backdrop
        overlay = pygame.Surface(self.screen_rect.size, pygame.SRCALPHA)
        overlay.fill((0, 0, 0, 140))
        surface.blit(overlay, self.screen_rect.topleft)

        # Card shadow
        self._shadow.draw_box_shadow(
            surface, self._card_rect,
            self.theme.radius("radius.xl"),
            "shadow.lg",
            self.theme,
        )

        # Card background
        pygame.draw.rect(
            surface,
            self.theme.color("bg.surface"),
            self._card_rect,
            border_radius=self.theme.radius("radius.xl"),
        )

        pad = self.theme.space("space.4")

        # Title
        if self.fonts and self.title:
            size = self.theme.font_size("text.h2")
            font = self.fonts.get("sans", size, True)
            txt = font.render(self.title, True, self.theme.color("text.primary"))
            surface.blit(txt, (self._card_rect.x + pad, self._card_rect.y + pad))

        # Message
        if self.fonts and self.message:
            size = self.theme.font_size("text.body_sm")
            font = self.fonts.get("sans", size, False)
            txt = font.render(self.message, True, self.theme.color("text.muted"))
            title_h = self.theme.font_size("text.h2") + self.theme.space("space.2")
            surface.blit(
                txt,
                (self._card_rect.x + pad, self._card_rect.y + pad + title_h),
            )

        # Cancel button
        cancel_bg = (
            self.theme.color("bg.surface_soft")
            if self._hovered_cancel
            else self.theme.color("bg.surface")
        )
        pygame.draw.rect(
            surface, cancel_bg, self._cancel_rect,
            border_radius=self.theme.radius("radius.md"),
        )
        pygame.draw.rect(
            surface, self.theme.color("border.subtle"), self._cancel_rect,
            width=1, border_radius=self.theme.radius("radius.md"),
        )
        if self.fonts:
            size = self.theme.font_size("text.label")
            font = self.fonts.get("sans", size, False)
            txt = font.render(self.cancel_label, True, self.theme.color("text.primary"))
            tx = self._cancel_rect.x + (self._cancel_rect.width - txt.get_width()) // 2
            ty = self._cancel_rect.y + (self._cancel_rect.height - txt.get_height()) // 2
            surface.blit(txt, (tx, ty))

        # Confirm button
        confirm_bg = (
            self.theme.color("brand.deep_stem")
            if self._hovered_confirm
            else self.theme.color("brand.primary_leaf")
        )
        pygame.draw.rect(
            surface, confirm_bg, self._confirm_rect,
            border_radius=self.theme.radius("radius.md"),
        )
        if self.fonts:
            size = self.theme.font_size("text.label")
            font = self.fonts.get("sans", size, True)
            txt = font.render(self.confirm_label, True, self.theme.color("text.inverse"))
            tx = self._confirm_rect.x + (self._confirm_rect.width - txt.get_width()) // 2
            ty = self._confirm_rect.y + (self._confirm_rect.height - txt.get_height()) // 2
            surface.blit(txt, (tx, ty))

    def handle_event(self, event: pygame.event.Event) -> bool:
        if not self.visible:
            return False

        if event.type == pygame.MOUSEMOTION:
            self._hovered_confirm = self._confirm_rect.collidepoint(event.pos)
            self._hovered_cancel  = self._cancel_rect.collidepoint(event.pos)
            return True  # block hover from passing through backdrop

        if event.type == pygame.MOUSEBUTTONDOWN and event.button == 1:
            if self._confirm_rect.collidepoint(event.pos):
                if self.on_confirm:
                    self.on_confirm()
                return True
            if self._cancel_rect.collidepoint(event.pos):
                if self.on_cancel:
                    self.on_cancel()
                return True
            # Click on backdrop — treat as cancel
            if not self._card_rect.collidepoint(event.pos):
                if self.on_cancel:
                    self.on_cancel()
            return True  # always consume clicks

        if event.type == pygame.KEYDOWN:
            if event.key == pygame.K_ESCAPE:
                if self.on_cancel:
                    self.on_cancel()
                return True
            if event.key == pygame.K_RETURN:
                if self.on_confirm:
                    self.on_confirm()
                return True

        return False
