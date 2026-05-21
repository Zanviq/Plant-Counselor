class Tween:
    """Single interpolated value over time."""

    def __init__(self, start, end, duration_ms: int, easing: str = "ease_out"):
        self.start = start
        self.end = end
        self.duration = duration_ms / 1000.0
        self.easing = easing
        self.elapsed = 0.0
        self.done = False

    def update(self, dt: float) -> float:
        """Advance by dt seconds; return current interpolated value."""
        self.elapsed = min(self.elapsed + dt, self.duration)
        t = self.elapsed / self.duration if self.duration > 0 else 1.0
        t = self._ease(t)
        self.done = self.elapsed >= self.duration
        return self.start + (self.end - self.start) * t

    def _ease(self, t: float) -> float:
        if self.easing == "ease_out":
            return 1 - (1 - t) ** 2
        if self.easing == "ease_in_out":
            return t * t * (3 - 2 * t)
        if self.easing == "ease_in":
            return t * t
        return t  # linear


class Animator:
    """Manages a collection of named tweens."""

    def __init__(self):
        self._tweens: dict[str, Tween] = {}

    def tween(
        self,
        key: str,
        start,
        end,
        duration_ms: int,
        easing: str = "ease_out",
    ) -> "Animator":
        """Register or restart a tween. Returns self for chaining."""
        self._tweens[key] = Tween(start, end, duration_ms, easing)
        return self

    def update(self, dt: float) -> dict:
        """Advance all tweens; remove finished ones. Returns {key: value}."""
        result = {}
        finished = []
        for key, tw in self._tweens.items():
            result[key] = tw.update(dt)
            if tw.done:
                finished.append(key)
        for key in finished:
            del self._tweens[key]
        return result

    def is_running(self, key: str) -> bool:
        """True if tween with key is currently active."""
        return key in self._tweens

    def cancel(self, key: str) -> None:
        """Remove a tween without completing it."""
        self._tweens.pop(key, None)
