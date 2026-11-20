
document.addEventListener("DOMContentLoaded", () => {
    "use strict";

    const $ = id => document.getElementById(id);

    // Read local demo data
    const read = key => {
        try {
            return JSON.parse(localStorage.getItem(key) || "[]");
        } catch (error) {
            console.error(`Could not read ${key}:`, error);
            return [];
        }
    };

    // Save local demo data
    const save = (key, data) => {
        localStorage.setItem(key, JSON.stringify(data));
    };

    // Prevent HTML injection
    const escapeHTML = value =>
        String(value ?? "").replace(/[&<>"']/g, char => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        })[char]);

    // Check admin session
    let session = null;

    try {
        session = JSON.parse(
            sessionStorage.getItem("taskflow_session") || "null"
        );
    } catch {
        session = null;
    }

    if (!session || session.role !== "admin") {
        location.replace("index.html");
        return;
    }

    if ($("adminName")) {
        $("adminName").textContent = session.name || "Administrator";
    }

    // Render dashboard
    function renderDashboard() {
        const allUsers = read("taskflow_users");

        const users = allUsers.filter(user =>
            user.role === "user" && user.status === "active"
        );

        const requests = allUsers.filter(user =>
            user.role === "pending_admin" && user.status === "pending"
        );

        const tasks = read("taskflow_tasks");

        // Task statistics
        const pending = tasks.filter(
            task => task.status === "pending"
        ).length;

        const inProgress = tasks.filter(
            task => task.status === "in_progress"
        ).length;

        const completed = tasks.filter(
            task => task.status === "completed"
        ).length;

        const total = tasks.length;

        const progress = total
            ? Math.round((completed / total) * 100)
            : 0;

        // Update statistics
        $("totalUsers").textContent = users.length;
        $("totalTasks").textContent = total;
        $("pendingTasks").textContent = pending;
        $("inProgressTasks").textContent = inProgress;
        $("completedTasks").textContent = completed;

        $("overallProgressText").textContent = `${progress}%`;
        $("overallProgressBar").style.width = `${progress}%`;

        // Registered users table
        const usersBody = $("usersTableBody");
        usersBody.replaceChildren();

        if (!users.length) {
            usersBody.innerHTML =
                '<tr><td colspan="5">No registered users found.</td></tr>';
        } else {
            users.forEach(user => {
                const userTasks = tasks.filter(task =>
                    task.ownerEmail?.toLowerCase() ===
                    user.email?.toLowerCase()
                );

                const userCompleted = userTasks.filter(
                    task => task.status === "completed"
                ).length;

                const userProgress = userTasks.length
                    ? Math.round(
                        (userCompleted / userTasks.length) * 100
                    )
                    : 0;

                const row = document.createElement("tr");

                row.innerHTML = `
                    <td>${escapeHTML(user.name)}</td>
                    <td>${escapeHTML(user.email)}</td>
                    <td>${userTasks.length}</td>
                    <td>${userCompleted}</td>
                    <td>${userProgress}%</td>
                `;

                usersBody.appendChild(row);
            });
        }

        // Pending admin requests table
        const requestsBody = $("adminRequestsTableBody");

        if (requestsBody) {
            requestsBody.replaceChildren();

            if (!requests.length) {
                requestsBody.innerHTML =
                    '<tr><td colspan="4">No pending requests.</td></tr>';
            } else {
                requests.forEach(request => {
                    const row = document.createElement("tr");

                    const requestedDate = request.createdAt
                        ? new Date(request.createdAt).toLocaleDateString()
                        : "—";

                    row.innerHTML = `
                        <td>${escapeHTML(request.name)}</td>
                        <td>${escapeHTML(request.email)}</td>
                        <td>${escapeHTML(requestedDate)}</td>
                        <td>
                            <button
                                type="button"
                                data-action="approve"
                                data-id="${escapeHTML(request.id)}"
                            >
                                Approve
                            </button>

                            <button
                                type="button"
                                data-action="reject"
                                data-id="${escapeHTML(request.id)}"
                            >
                                Reject
                            </button>
                        </td>
                    `;

                    requestsBody.appendChild(row);
                });
            }
        }

        // All tasks table
        const tasksBody = $("adminTasksTableBody");
        tasksBody.replaceChildren();

        if (!tasks.length) {
            tasksBody.innerHTML =
                '<tr><td colspan="5">No tasks found.</td></tr>';
        } else {
            tasks.forEach(task => {
                const owner = users.find(user =>
                    user.email?.toLowerCase() ===
                    task.ownerEmail?.toLowerCase()
                );

                const row = document.createElement("tr");

                row.innerHTML = `
                    <td>${escapeHTML(task.title)}</td>
                    <td>${escapeHTML(
                        owner?.name || task.ownerEmail || "Unknown"
                    )}</td>
                    <td>${escapeHTML(task.priority || "Medium")}</td>
                    <td>${escapeHTML(task.dueDate || "—")}</td>
                    <td>${escapeHTML(
                        (task.status || "pending").replace("_", " ")
                    )}</td>
                `;

                tasksBody.appendChild(row);
            });
        }
    }

    // Approve or reject admin requests
    $("adminRequestsTableBody")?.addEventListener("click", event => {
        const button = event.target.closest("button[data-action]");

        if (!button) return;

        const id = button.dataset.id;
        const action = button.dataset.action;

        const users = read("taskflow_users");

        const request = users.find(user =>
            String(user.id) === String(id) &&
            user.role === "pending_admin" &&
            user.status === "pending"
        );

        if (!request) {
            alert("This request is no longer available.");
            renderDashboard();
            return;
        }

        if (action === "approve") {
            const confirmed = confirm(
                `Approve admin access for ${request.name}?`
            );

            if (!confirmed) return;

            request.role = "admin";
            request.status = "active";
            request.approvedAt = new Date().toISOString();
            request.approvedBy = session.email;

            save("taskflow_users", users);

            alert("Admin request approved successfully.");
        }

        if (action === "reject") {
            const confirmed = confirm(
                `Reject the admin request from ${request.name}?`
            );

            if (!confirmed) return;

            request.role = "rejected_admin";
            request.status = "rejected";
            request.rejectedAt = new Date().toISOString();
            request.rejectedBy = session.email;

            save("taskflow_users", users);

            alert("Admin request rejected.");
        }

        renderDashboard();
    });

    // Initial dashboard load
    renderDashboard();

    // Refresh when local storage changes in another tab
    window.addEventListener("storage", event => {
        if (
            event.key === "taskflow_users" ||
            event.key === "taskflow_tasks"
        ) {
            renderDashboard();
        }
    });

    // Refresh dashboard periodically
    const refreshInterval = setInterval(renderDashboard, 3000);

    // Mobile sidebar
    const sidebar = $("sidebar");
    const overlay = $("sidebarOverlay");

    $("menuToggle")?.addEventListener("click", () => {
        sidebar?.classList.toggle("open");
        overlay?.classList.toggle("active");
    });

    overlay?.addEventListener("click", () => {
        sidebar?.classList.remove("open");
        overlay?.classList.remove("active");
    });

    // Logout
    $("logoutBtn")?.addEventListener("click", () => {
        sessionStorage.removeItem("taskflow_session");
        sessionStorage.removeItem("taskflow_auth");

        location.href = "login.html";
    });

    // Cleanup
    window.addEventListener("pagehide", () => {
        clearInterval(refreshInterval);
    });
});
