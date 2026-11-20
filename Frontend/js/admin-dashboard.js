
document.addEventListener("DOMContentLoaded", () => {
  "use strict";

  const $ = id => document.getElementById(id);

  const read = key => {
    try {
      const value = JSON.parse(localStorage.getItem(key) || "[]");
      return Array.isArray(value) ? value : [];
    } catch {
      return [];
    }
  };

  const save = (key, value) =>
    localStorage.setItem(key, JSON.stringify(value));

  const escapeHTML = value =>
    String(value ?? "").replace(/[&<>"']/g, char => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[char]);

  let session;

  try {
    session = JSON.parse(
      sessionStorage.getItem("taskflow_session") || "null"
    );
  } catch {
    session = null;
  }

  if (!session || session.role !== "admin") {
    location.replace("login.html?mode=admin-login");
    return;
  }

  if ($("adminName")) {
    $("adminName").textContent = session.name || "Administrator";
  }

  function render() {
    const allUsers = read("taskflow_users");

    const users = allUsers.filter(user =>
      user.role === "user" && user.status === "active"
    );

    const requests = allUsers.filter(user =>
      user.role === "pending_admin" && user.status === "pending"
    );

    const tasks = read("taskflow_tasks");

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

    const rate = total
      ? Math.round(completed / total * 100)
      : 0;

    $("totalUsers").textContent = users.length;
    $("totalTasks").textContent = total;
    $("pendingTasks").textContent = pending;
    $("inProgressTasks").textContent = inProgress;
    $("completedTasks").textContent = completed;

    $("overallProgressText").textContent = `${rate}%`;
    $("overallProgressBar").style.width = `${rate}%`;

    // Registered users
    const usersBody = $("usersTableBody");

    usersBody.innerHTML = users.length
      ? users.map(user => {
          const ownTasks = tasks.filter(task =>
            (task.ownerEmail || "").toLowerCase() ===
            user.email.toLowerCase()
          );

          const done = ownTasks.filter(
            task => task.status === "completed"
          ).length;

          const percent = ownTasks.length
            ? Math.round(done / ownTasks.length * 100)
            : 0;

          return `
            <tr>
              <td>${escapeHTML(user.name)}</td>
              <td>${escapeHTML(user.email)}</td>
              <td>${ownTasks.length}</td>
              <td>${done}</td>
              <td>${percent}%</td>
            </tr>
          `;
        }).join("")
      : '<tr><td colspan="5">No registered users found.</td></tr>';

    // Pending admin requests
    const requestsBody = $("adminRequestsTableBody");

    requestsBody.innerHTML = requests.length
      ? requests.map(request => `
          <tr>
            <td>${escapeHTML(request.name)}</td>
            <td>${escapeHTML(request.email)}</td>
            <td>
              ${request.createdAt
                ? escapeHTML(new Date(request.createdAt).toLocaleDateString())
                : "—"}
            </td>
            <td class="request-actions">
              <button
                type="button"
                class="btn btn-primary btn-sm"
                data-action="approve"
                data-id="${escapeHTML(request.id)}"
              >Approve</button>

              <button
                type="button"
                class="btn btn-danger btn-sm"
                data-action="reject"
                data-id="${escapeHTML(request.id)}"
              >Reject</button>
            </td>
          </tr>
        `).join("")
      : '<tr><td colspan="4">No pending requests.</td></tr>';

    // All tasks
    const tasksBody = $("adminTasksTableBody");

    tasksBody.innerHTML = tasks.length
      ? tasks.map(task => {
          const owner = users.find(user =>
            user.email.toLowerCase() ===
            (task.ownerEmail || "").toLowerCase()
          );

          return `
            <tr>
              <td>${escapeHTML(task.title)}</td>
              <td>${escapeHTML(owner?.name || task.ownerEmail || "Unknown")}</td>
              <td>${escapeHTML(task.priority || "medium")}</td>
              <td>${escapeHTML(task.dueDate || "—")}</td>
              <td>${escapeHTML((task.status || "pending").replaceAll("_", " "))}</td>
            </tr>
          `;
        }).join("")
      : '<tr><td colspan="5">No tasks found.</td></tr>';
  }

  // Approve / reject requests
  $("adminRequestsTableBody").addEventListener("click", event => {
    const button = event.target.closest("button[data-action]");

    if (!button) return;

    const users = read("taskflow_users");

    const target = users.find(user =>
      String(user.id) === button.dataset.id &&
      user.role === "pending_admin" &&
      user.status === "pending"
    );

    if (!target) {
      alert("This request is no longer pending.");
      render();
      return;
    }

    const approve = button.dataset.action === "approve";

    const confirmed = confirm(
      `${approve ? "Approve" : "Reject"} admin access for ${target.name}?`
    );

    if (!confirmed) return;

    target.role = approve ? "admin" : "rejected_admin";
    target.status = approve ? "active" : "rejected";

    target[approve ? "approvedAt" : "rejectedAt"] =
      new Date().toISOString();

    target[approve ? "approvedBy" : "rejectedBy"] =
      session.email;

    save("taskflow_users", users);

    alert(
      approve
        ? "Admin request approved."
        : "Admin request rejected."
    );

    render();
  });

  // Logout
  $("logoutBtn")?.addEventListener("click", () => {
    sessionStorage.removeItem("taskflow_session");
    location.href = "index.html";
  });

  // Mobile sidebar
  $("menuToggle")?.addEventListener("click", () => {
    $("sidebar")?.classList.toggle("open");
    $("sidebarOverlay")?.classList.toggle("active");
  });

  $("sidebarOverlay")?.addEventListener("click", () => {
    $("sidebar")?.classList.remove("open");
    $("sidebarOverlay")?.classList.remove("active");
  });

  render();

  window.addEventListener("storage", event => {
    if (
      event.key === "taskflow_users" ||
      event.key === "taskflow_tasks"
    ) {
      render();
    }
  });
});
