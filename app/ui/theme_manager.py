import datetime


class ThemeManager:
    """Provides typed access to all design tokens."""

    def __init__(self):
        self.variant = "light_default"
        self._tokens = {
            "colors": {
                # Background
                "bg.app":          "#F6F8F1",
                "bg.surface":      "#FFFFFF",
                "bg.surface_soft": "#EEF4E9",
                "border.subtle":   "#D9E1D6",
                # Text
                "text.primary":    "#18231D",
                "text.muted":      "#667267",
                "text.inverse":    "#FFFFFF",
                # Brand
                "brand.primary_leaf": "#4E7E4D",
                "brand.deep_stem":    "#223B2F",
                "brand.leaf_soft":    "#CFE3C2",
                "brand.mint_growth":  "#9CCB8C",
                # Accent
                "accent.amber_schedule": "#D7B16A",
                "accent.lavender_ai":    "#A78BFA",
                "accent.yellow_bloom":   "#F2C94C",
                "accent.rose_care":      "#E88C83",
            },
            "spacing": {
                "space.0":  0,
                "space.1":  4,
                "space.2":  8,
                "space.3":  12,
                "space.4":  16,
                "space.5":  20,
                "space.6":  24,
                "space.8":  32,
                "space.10": 40,
                "space.12": 48,
            },
            "radius": {
                "radius.sm":   6,
                "radius.md":   10,
                "radius.lg":   14,
                "radius.xl":   20,
                "radius.pill": 999,
            },
            "shadows": {
                "shadow.sm": {"y": 1,  "blur": 2,  "alpha": 0.06},
                "shadow.md": {"y": 4,  "blur": 10, "alpha": 0.08},
                "shadow.lg": {"y": 12, "blur": 24, "alpha": 0.12},
            },
            "motion": {
                "motion.fast": 120,
                "motion.base": 200,
                "motion.slow": 320,
            },
            "typography": {
                # (size_px, is_bold)
                "text.display":   (28, True),
                "text.h1":        (20, True),
                "text.h2":        (16, True),
                "text.body":      (14, False),
                "text.body_sm":   (13, False),
                "text.caption":   (12, False),
                "text.number_lg": (32, True),
                "text.label":     (13, False),
                "text.mono":      (13, False),
            },
        }

    # ------------------------------------------------------------------
    # Color
    # ------------------------------------------------------------------

    def color(self, key: str) -> tuple:
        """Return an RGB tuple for a color token key.

        Falls back to hot pink (255, 0, 255) so undefined keys are obvious.
        """
        hex_str = self._tokens["colors"].get(key, "#FF00FF")
        return self._hex_to_rgb(hex_str)

    def color_alpha(self, key: str, alpha: float) -> tuple:
        """Return an RGBA tuple (0-255). alpha is 0.0-1.0."""
        r, g, b = self.color(key)
        return (r, g, b, int(alpha * 255))

    # ------------------------------------------------------------------
    # Spacing / radius / shadow / motion
    # ------------------------------------------------------------------

    def space(self, key: str) -> int:
        return self._tokens["spacing"].get(key, 0)

    def radius(self, key: str) -> int:
        return self._tokens["radius"].get(key, 0)

    def shadow(self, key: str) -> dict:
        return self._tokens["shadows"].get(key, {"y": 0, "blur": 0, "alpha": 0.0})

    def motion(self, key: str) -> int:
        """Return duration in milliseconds."""
        return self._tokens["motion"].get(key, 200)

    # ------------------------------------------------------------------
    # Typography
    # ------------------------------------------------------------------

    def font_size(self, style_key: str) -> int:
        entry = self._tokens["typography"].get(style_key, (14, False))
        return entry[0]

    def is_bold(self, style_key: str) -> bool:
        entry = self._tokens["typography"].get(style_key, (14, False))
        return entry[1]

    # ------------------------------------------------------------------
    # Theme variant
    # ------------------------------------------------------------------

    def set_theme(self, variant: str) -> None:
        self.variant = variant

    def auto_pick_by_date(self) -> None:
        """Set seasonal theme variant based on current month."""
        month = datetime.date.today().month
        if month in (3, 4, 5):
            self.set_theme("light_spring")
        elif month in (6, 7, 8):
            self.set_theme("light_summer")
        elif month in (9, 10, 11):
            self.set_theme("light_autumn")
        else:
            self.set_theme("light_winter")

    # ------------------------------------------------------------------
    # Internal
    # ------------------------------------------------------------------

    @staticmethod
    def _hex_to_rgb(hex_str: str) -> tuple:
        h = hex_str.lstrip("#")
        return tuple(int(h[i:i+2], 16) for i in (0, 2, 4))
