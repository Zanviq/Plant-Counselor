import os
import pygame


class FontRegistry:
    """Pygame font cache with file-first, system-Korean fallback strategy."""

    # Common sizes pre-loaded at startup
    _PRELOAD_SIZES = [12, 13, 14, 16, 20, 28, 32]

    def __init__(self, font_dir: str):
        """
        Parameters
        ----------
        font_dir:
            Absolute path to ``assets/fonts/`` directory.
        """
        self.font_dir = font_dir
        self._cache: dict[tuple, pygame.font.Font] = {}
        self._system_korean: str | None = None  # resolved lazily

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def get(self, style_key: str = "sans", size: int = 14, bold: bool = False) -> pygame.font.Font:
        """Return a cached pygame.font.Font.

        Parameters
        ----------
        style_key : "sans" | "mono" | "pixel"
        size      : pixel size
        bold      : whether bold variant is requested
        """
        cache_key = (style_key, size, bold)
        if cache_key in self._cache:
            return self._cache[cache_key]

        font = self._load_font(style_key, size, bold)
        self._cache[cache_key] = font
        return font

    def preload(self) -> None:
        """Pre-load commonly used size/style combinations into cache."""
        for size in self._PRELOAD_SIZES:
            for style in ("sans",):
                for bold in (False, True):
                    self.get(style, size, bold)

    # ------------------------------------------------------------------
    # Internal
    # ------------------------------------------------------------------

    def _load_font(self, style_key: str, size: int, bold: bool) -> pygame.font.Font:
        path = self._find_font_file(style_key, bold)
        if path:
            try:
                return pygame.font.Font(path, size)
            except Exception:
                pass  # fall through to system fallback

        # Try system Korean font
        sys_path = self._get_system_korean_font()
        if sys_path:
            try:
                return pygame.font.Font(sys_path, size)
            except Exception:
                pass

        # Last resort: pygame default
        return pygame.font.Font(None, size)

    def _find_font_file(self, style_key: str, bold: bool) -> str | None:
        """Return absolute path to font file if it exists, else None."""
        candidates: dict[tuple, list[str]] = {
            ("sans", True):   ["Pretendard-Bold.otf", "Pretendard-Bold.ttf"],
            ("sans", False):  ["Pretendard-Regular.otf", "Pretendard-Regular.ttf"],
            ("mono", False):  ["JetBrainsMono-Regular.ttf"],
            ("mono", True):   ["JetBrainsMono-Bold.ttf", "JetBrainsMono-Regular.ttf"],
            ("pixel", False): ["DungGeunMo.otf", "DungGeunMo.ttf"],
            ("pixel", True):  ["DungGeunMo.otf", "DungGeunMo.ttf"],
        }
        for fname in candidates.get((style_key, bold), []):
            path = os.path.join(self.font_dir, fname)
            if os.path.exists(path):
                return path
        return None

    def _get_system_korean_font(self) -> str | None:
        """Locate a system Korean font using pygame.font.match_font."""
        if self._system_korean is not None:
            return self._system_korean or None

        for name in [
            "malgun gothic",
            "malgungothic",
            "AppleGothic",
            "nanum gothic",
            "nanumgothic",
        ]:
            result = pygame.font.match_font(name)
            if result:
                self._system_korean = result
                return result

        self._system_korean = ""  # sentinel: searched, not found
        return None
