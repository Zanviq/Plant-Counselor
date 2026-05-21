import pygame


class BaseWidget:
    """Abstract base for all interactive UI widgets."""

    def __init__(self, rect: pygame.Rect, theme, fonts=None):
        self.rect = rect
        self.theme = theme
        self.fonts = fonts
        self.visible = True
        self.enabled = True
        self._hovered = False

    def update(self, dt: float) -> None:
        """Advance widget state by dt seconds. Override as needed."""
        pass

    def render(self, surface: pygame.Surface) -> None:
        """Draw the widget. Override in subclasses."""
        pass

    def handle_event(self, event: pygame.event.Event) -> bool:
        """Process event; update _hovered on MOUSEMOTION.

        Returns True if the event was consumed (stops further propagation).
        """
        if event.type == pygame.MOUSEMOTION:
            self._hovered = self.rect.collidepoint(event.pos)
        return False

    def set_rect(self, rect: pygame.Rect) -> None:
        """Reposition/resize the widget."""
        self.rect = rect
