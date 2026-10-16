(function () {
  const key = "cet-theme";
  const saved = localStorage.getItem(key);
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const theme = saved || (prefersDark ? "dark" : "light");
  document.documentElement.setAttribute("data-theme", theme);

  window.CETTheme = {
    current() {
      return document.documentElement.getAttribute("data-theme") || "light";
    },
    toggle() {
      const next = this.current() === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", next);
      localStorage.setItem(key, next);
      document.dispatchEvent(new CustomEvent("cet-theme", { detail: next }));
      return next;
    },
    label() {
      return this.current() === "dark" ? "Light mode" : "Dark mode";
    }
  };
})();
