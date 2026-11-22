(() => {
  const layout = document.getElementById("appLayout");
  const collapseButton = document.getElementById("sidebarCollapseBtn");
  const logo = document.querySelector(".sidebar-logo .logo-icon");
  if (!layout || !collapseButton || !logo) return;

  const storageKey = "taskflow_sidebar_collapsed";
  const setCollapsed = (collapsed) => {
    layout.classList.toggle("sidebar-collapsed", collapsed);
    try { localStorage.setItem(storageKey, collapsed ? "true" : "false"); } catch (_) {}
  };

  try {
    setCollapsed(localStorage.getItem(storageKey) === "true");
  } catch (_) {
    setCollapsed(false);
  }

  collapseButton.addEventListener("click", () => {
    setCollapsed(!layout.classList.contains("sidebar-collapsed"));
  });

  logo.setAttribute("role", "button");
  logo.setAttribute("tabindex", "0");
  logo.setAttribute("aria-label", "Expand sidebar");
  logo.addEventListener("click", () => {
    if (layout.classList.contains("sidebar-collapsed")) setCollapsed(false);
  });
  logo.addEventListener("keydown", (event) => {
    if (layout.classList.contains("sidebar-collapsed") && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      setCollapsed(false);
    }
  });
})();
