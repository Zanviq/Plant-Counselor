import pygame


class SceneManager:
    """Routes events, updates, and renders to the active scene and overlay stack."""

    def __init__(self, app):
        self.app = app
        self.current = None
        self.overlays: list = []   # push/pop stack (ChatWidget, ToastWidget, etc.)
        self._scenes: dict[str, object] = {}

    # ------------------------------------------------------------------
    # Scene registry
    # ------------------------------------------------------------------

    def register(self, name: str, scene) -> None:
        """Register a scene instance under a string key."""
        self._scenes[name] = scene

    def switch_scene(self, name: str, params: dict = None) -> None:
        """Deactivate the current scene and activate name."""
        if self.current is not None:
            self.current.on_exit()
        self.current = self._scenes.get(name)
        if self.current is not None:
            self.current.on_enter(params or {})

    # ------------------------------------------------------------------
    # Overlay stack
    # ------------------------------------------------------------------

    def push_overlay(self, widget) -> None:
        """Push a widget onto the overlay stack (rendered on top)."""
        self.overlays.append(widget)

    def pop_overlay(self) -> None:
        """Remove and discard the topmost overlay."""
        if self.overlays:
            self.overlays.pop()

    # ------------------------------------------------------------------
    # Game loop hooks
    # ------------------------------------------------------------------

    def handle_event(self, event: pygame.event.Event) -> None:
        """Overlays consume events first; falls through to current scene."""
        if self.overlays:
            self.overlays[-1].handle_event(event)
            return
        if self.current is not None:
            self.current.handle_event(event)

    def update(self, dt: float) -> None:
        """Advance current scene and all overlays."""
        if self.current is not None:
            self.current.update(dt)
        for overlay in self.overlays:
            overlay.update(dt)

    def render(self, surface: pygame.Surface) -> None:
        """Draw current scene, then overlays in push order."""
        if self.current is not None:
            self.current.render(surface)
        for overlay in self.overlays:
            overlay.render(surface)
