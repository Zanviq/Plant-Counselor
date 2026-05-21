import pygame


class BaseScene:
    """Abstract base class for all game screens."""

    def __init__(self, app):
        self.app = app

    def on_enter(self, params: dict) -> None:
        """Called when this scene becomes active. Override to initialise state."""
        pass

    def on_exit(self) -> None:
        """Called when this scene is deactivated. Override to clean up."""
        pass

    def update(self, dt: float) -> None:
        """Advance scene logic by dt seconds."""
        pass

    def render(self, surface: pygame.Surface) -> None:
        """Draw the scene onto surface."""
        pass

    def handle_event(self, event: pygame.event.Event) -> None:
        """Process a pygame event."""
        pass
