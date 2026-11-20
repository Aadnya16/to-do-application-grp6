
(() => {
  const $ = (selector, parent = document) => parent.querySelector(selector);

  function showToast(message, type = "success") {
    const container = $("#toastContainer");
    if (!container) return;

    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    container.appendChild(toast);

    requestAnimationFrame(() => toast.classList.add("show"));
    setTimeout(() => {
      toast.classList.remove("show");
      setTimeout(() => toast.remove(), 250);
    }, 3000);
  }

  
function openModal(modal) {
  if (!modal) return;
  modal.classList.add("show");
  modal.setAttribute("aria-hidden", "false");
}

function closeModal(modal) {
  if (!modal) return;
  modal.classList.remove("show");
  modal.setAttribute("aria-hidden", "true");
}


  document.addEventListener("DOMContentLoaded", () => {
    const sidebar = $("#sidebar");
    const overlay = $("#sidebarOverlay");
    const hamburger = $("#hamburgerBtn");

    hamburger?.addEventListener("click", () => {
      sidebar?.classList.toggle("open");
      overlay?.classList.toggle("active");
    });

    overlay?.addEventListener("click", () => {
      sidebar?.classList.remove("open");
      overlay.classList.remove("active");
    });

    document.querySelectorAll(".btn-logout-trigger").forEach(button => {
      button.addEventListener("click", () => openModal($("#logoutModalOverlay")));
    });

    $("#cancelLogoutBtn")?.addEventListener("click", () => closeModal($("#logoutModalOverlay")));

    $("#confirmLogoutBtn")?.addEventListener("click", () => {
      sessionStorage.removeItem("taskflow_session");
      localStorage.removeItem("taskflow_session");
      window.location.href = "login.html";
    });

    document.querySelectorAll("[data-target].password-toggle-btn").forEach(button => {
      button.addEventListener("click", () => {
        const input = document.getElementById(button.dataset.target);
        if (input) input.type = input.type === "password" ? "text" : "password";
      });
    });

    document.addEventListener("keydown", event => {
      if (event.key === "Escape") {
        document.querySelectorAll(".modal-overlay.active").forEach(closeModal);
        sidebar?.classList.remove("open");
        overlay?.classList.remove("active");
      }
    });
  });

  window.TaskFlowApp = { showToast, openModal, closeModal };
})();
