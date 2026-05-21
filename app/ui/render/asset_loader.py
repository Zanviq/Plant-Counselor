import os
import pygame


class AssetLoader:
    """Cached image loader with typed accessors for game assets.

    All paths are relative to ``assets_dir`` (project root ``assets/``).
    Returns None silently when a file is missing — callers must handle None.
    """

    def __init__(self, assets_dir: str):
        self.assets_dir = assets_dir
        self._image_cache: dict[str, pygame.Surface] = {}

    # ------------------------------------------------------------------
    # Core loader
    # ------------------------------------------------------------------

    def load_image(self, rel_path: str) -> pygame.Surface | None:
        """Load and cache an image. Returns None if file not found."""
        if rel_path in self._image_cache:
            return self._image_cache[rel_path]

        full = os.path.join(self.assets_dir, rel_path)
        if not os.path.exists(full):
            return None
        try:
            img = pygame.image.load(full)
            # convert_alpha() requires a display surface; fall back gracefully
            try:
                img = img.convert_alpha()
            except pygame.error:
                pass
            self._image_cache[rel_path] = img
            return img
        except Exception:
            return None

    # ------------------------------------------------------------------
    # Typed accessors
    # ------------------------------------------------------------------

    def pixel(self, rel_path: str, scale: int = 1) -> pygame.Surface | None:
        """Load a pixel-art image and optionally scale it by integer factor."""
        img = self.load_image(rel_path)
        if img is None:
            return None
        if scale != 1:
            w, h = img.get_size()
            img = pygame.transform.scale(img, (w * scale, h * scale))
        return img

    def icon(self, name: str, size: int = 24) -> pygame.Surface | None:
        """Load ``pixels/icons/<name>.png``.

        Prefers @2x version when available and scales down — better quality.
        """
        path_2x = f"pixels/icons/{name}@2x.png"
        img = self.load_image(path_2x)
        if img is not None:
            return pygame.transform.smoothscale(img, (size, size))

        path = f"pixels/icons/{name}.png"
        img = self.load_image(path)
        if img is None:
            return None
        return pygame.transform.smoothscale(img, (size, size))

    def plant_layer(self, species: str, layer: str) -> pygame.Surface | None:
        """Load ``pixels/plants/<species>/<layer>.png``."""
        return self.load_image(f"pixels/plants/{species}/{layer}.png")

    def pot(self, style: str = "clay") -> pygame.Surface | None:
        """Load ``pixels/pots/pot_<style>.png``."""
        # Prefer @2x
        img = self.load_image(f"pixels/pots/pot_{style}@2x.png")
        if img is not None:
            return img
        return self.load_image(f"pixels/pots/pot_{style}.png")

    def background(self, name: str) -> pygame.Surface | None:
        """Load ``pixels/background/<name>.png``."""
        return self.load_image(f"pixels/background/{name}.png")

    def floor_tile(self, name: str) -> pygame.Surface | None:
        """Load ``pixels/floor/<name>.png``."""
        return self.load_image(f"pixels/floor/{name}.png")

    def logo(self, variant: str = "logo_full") -> pygame.Surface | None:
        """Load ``logo/<variant>.png``, preferring @2x when available."""
        img = self.load_image(f"logo/{variant}@2x.png")
        if img is not None:
            return img
        return self.load_image(f"logo/{variant}.png")
