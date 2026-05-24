(function () {
  try {
    var raw = localStorage.getItem("pc-theme");
    var s = raw ? JSON.parse(raw).state : null;
    var mode = (s && s.mode) || "system";
    var accent = (s && s.accent) || "emerald";
    var resolved =
      mode === "system"
        ? window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light"
        : mode;
    var d = document.documentElement;
    d.setAttribute("data-theme", resolved);
    if (accent !== "emerald") d.setAttribute("data-accent", accent);
  } catch (e) {}
})();
