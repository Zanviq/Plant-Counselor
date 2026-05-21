import pygame


class PlantSprite:
    """Composites plant pixel-art layers into a single Surface."""

    def __init__(self, asset_loader):
        self.assets = asset_loader
        self._cache: dict[tuple, pygame.Surface] = {}

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def render(
        self,
        species: str,
        status: str,
        progress: int,
        size: tuple,
    ) -> pygame.Surface:
        """Return a composited Surface of (width, height) = size.

        Layers are drawn bottom-to-top: pot -> plant layers.
        Result is cached by (species, status, progress, size).
        """
        key = (species, status, progress, size)
        if key in self._cache:
            return self._cache[key]

        surf = pygame.Surface(size, pygame.SRCALPHA)
        w, h = size

        # --- Pot (lower 1/3) ---
        pot_img = self.assets.pot("clay")
        if pot_img:
            ph = h // 3
            pw = max(1, int(pot_img.get_width() * ph / pot_img.get_height()))
            pot_scaled = pygame.transform.scale(pot_img, (pw, ph))
            px = (w - pw) // 2
            py = h - ph
            surf.blit(pot_scaled, (px, py))

        # --- Plant layers (upper 2/3) ---
        plant_h = h * 2 // 3
        for layer_name in self._get_layers(species, status, progress):
            img = self.assets.plant_layer(species, layer_name)
            if img is None:
                continue
            orig_w, orig_h = img.get_size()
            if orig_h == 0:
                continue
            iw = max(1, int(orig_w * plant_h / orig_h))
            scaled = pygame.transform.scale(img, (iw, plant_h))
            ix = (w - iw) // 2
            surf.blit(scaled, (ix, 0))

        self._cache[key] = surf
        return surf

    def render_thumbnail(
        self,
        species: str,
        status: str,
        progress: int,
        size: int = 40,
    ) -> pygame.Surface:
        """Convenience wrapper for square thumbnails."""
        return self.render(species, status, progress, (size, size))

    # ------------------------------------------------------------------
    # Internal
    # ------------------------------------------------------------------

    def _get_layers(self, species: str, status: str, progress: int) -> list[str]:
        """Return ordered list of layer filenames for the given plant state."""
        if status == "seed":
            return ["seed"]
        if status == "bud":
            return ["stem_a", "leaf_a", "bud"]
        if status == "flower":
            return ["stem_b", "leaf_b", "flower"]
        if status == "wilting":
            return ["stem_b", "leaf_b", "flower", "wilting"]
        if status == "fruit":
            return ["stem_b", "leaf_b", "fruit"]
        if status == "harvested":
            return ["stem_b", "leaf_b", "fruit"]
        if status == "rot":
            return ["rot"]
        # Fallback
        return ["seed"]
