
(() => {
    const $ = (selector, parent = document) =>
        parent.querySelector(selector);

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

    function getInitials(name) {
        return (name || "User")
            .trim()
            .split(/\s+/)
            .map(part => part[0])
            .slice(0, 2)
            .join("")
            .toUpperCase();
    }

    document.addEventListener("DOMContentLoaded", () => {
        const page = location.pathname.split("/").pop();

        let session = null;

        try {
            session = JSON.parse(
                sessionStorage.getItem("taskflow_session") || "null"
            );
        } catch (error) {
            console.error("Could not read session:", error);
        }

        const protectedUserPages = [
            "dashboard.html",
            "add-task.html",
            "profile.html"
        ];

        if (
            protectedUserPages.includes(page) &&
            (!session || session.role !== "user")
        ) {
            location.replace("index.html");
            return;
        }

        // Task List is shared: regular users see their tasks; admins use it as Task Overview.
        if (
            page === "task-list.html" &&
            (!session || !["user", "admin"].includes(session.role))
        ) {
            location.replace("index.html");
            return;
        }

        if (
            (page === "admin-dashboard.html" || page === "admin-task-overview.html") &&
            (!session || session.role !== "admin")
        ) {
            location.replace("index.html");
            return;
        }

        // Update sidebar with the currently logged-in account.
        if (session) {
            const name = session.name || "User";
            const initials = getInitials(name);

            document.querySelectorAll(".user-name-display").forEach(el => {
                el.textContent = name;
            });

            document.querySelectorAll(".user-avatar-display").forEach(el => {
                el.textContent = initials;
            });
        }

        const sidebar = $("#sidebar");
        const overlay = $("#sidebarOverlay");
        const hamburger = $("#hamburgerBtn");

        hamburger?.addEventListener("click", () => {
            sidebar?.classList.toggle("open");
            overlay?.classList.toggle("active");
        });

        overlay?.addEventListener("click", () => {
            sidebar?.classList.remove("open");
            overlay?.classList.remove("active");
        });

        document.querySelectorAll(".btn-logout-trigger").forEach(button => {
            button.addEventListener("click", () => {
                openModal($("#logoutModalOverlay"));
            });
        });

        $("#cancelLogoutBtn")?.addEventListener("click", () => {
            closeModal($("#logoutModalOverlay"));
        });

        $("#confirmLogoutBtn")?.addEventListener("click", () => {
            sessionStorage.removeItem("taskflow_session");
            sessionStorage.removeItem("taskflow_auth");
            location.href = "index.html";
        });

        document.querySelectorAll("[data-target].password-toggle-btn")
            .forEach(button => {
                button.addEventListener("click", () => {
                    const input = document.getElementById(button.dataset.target);

                    if (input) {
                        input.type =
                            input.type === "password" ? "text" : "password";
                    }
                });
            });

        document.addEventListener("keydown", event => {
            if (event.key === "Escape") {
                document.querySelectorAll(".modal-overlay.active")
                    .forEach(closeModal);

                sidebar?.classList.remove("open");
                overlay?.classList.remove("active");
            }
        });
    });

    window.TaskFlowApp = {
        showToast,
        openModal,
        closeModal
    };
})();
