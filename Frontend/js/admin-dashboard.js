document.addEventListener("DOMContentLoaded", () => {
  "use strict";

  const $ = id => document.getElementById(id);

  const escapeHTML = value =>
    String(value ?? "").replace(/[&<>"']/g, char => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[char]);

  const session = window.TaskFlowAPI?.getSession();

  // UI convenience only. The real protection is on the server: every /api/admin/*
  // call is rejected (403) unless the token belongs to an active admin.
  if (!session || session.role !== "admin") {
    location.replace("login.html?mode=admin-login");
    return;
  }

  if ($("adminName")) {
    $("adminName").textContent = session.name || "Administrator";
  }

  async function render() {
    let users, requests, tasks;

    try {
      [users, requests, tasks] = await Promise.all([
        TaskFlowAPI.adminGetUsers(),
        TaskFlowAPI.adminGetRequests(),
        TaskFlowAPI.adminGetTasks()
      ]);
    } catch (error) {
      if (error.status === 403) {
        location.replace("index.html");
        return;
      }
      alert(error.message);
      return;
    }

    const count = status => tasks.filter(task => task.status === status).length;

    const pending = count("pending");
    const inProgress = count("in_progress");
    const completed = count("completed");
    const total = tasks.length;
    const rate = total ? Math.round(completed / total * 100) : 0;

    $("totalUsers").textContent = users.length;
    $("totalTasks").textContent = total;
    $("pendingTasks").textContent = pending;
    $("inProgressTasks").textContent = inProgress;
    $("completedTasks").textContent = completed;

    $("overallProgressText").textContent = `${rate}%`;
    $("overallProgressBar").style.width = `${rate}%`;

    // Registered users
    $("usersTableBody").innerHTML = users.length
      ? users.map(user => {
          const percent = user.total_tasks
            ? Math.round(user.completed_tasks / user.total_tasks * 100)
            : 0;

          return `
            <tr>
              <td>${escapeHTML(user.name)}</td>
              <td>${escapeHTML(user.email)}</td>
              <td>${user.total_tasks}</td>
              <td>${user.completed_tasks}</td>
              <td>${percent}%</td>
            </tr>
          `;
        }).join("")
      : '<tr><td colspan="5">No registered users found.</td></tr>';

    // Pending admin requests
    $("adminRequestsTableBody").innerHTML = requests.length
      ? requests.map(request => `
          <tr>
            <td>${escapeHTML(request.name)}</td>
            <td>${escapeHTML(request.email)}</td>
            <td>
              ${request.created_at
                ? escapeHTML(new Date(request.created_at).toLocaleDateString())
                : "—"}
            </td>
            <td class="request-actions">
              <button type="button" class="btn btn-primary btn-sm"
                data-action="approve" data-id="${escapeHTML(request.user_id)}"
                data-name="${escapeHTML(request.name)}">Approve</button>

              <button type="button" class="btn btn-danger btn-sm"
                data-action="reject" data-id="${escapeHTML(request.user_id)}"
                data-name="${escapeHTML(request.name)}">Reject</button>
            </td>
          </tr>
        `).join("")
      : '<tr><td colspan="4">No pending requests.</td></tr>';

    // All tasks
    $("adminTasksTableBody").innerHTML = tasks.length
      ? tasks.map(task => `
          <tr>
            <td>${escapeHTML(task.title)}</td>
            <td>${escapeHTML(task.owner_name || task.owner_email || "Unknown")}</td>
            <td>${escapeHTML(task.priority || "medium")}</td>
            <td>${escapeHTML(task.due_date || "—")}</td>
            <td>${escapeHTML((task.status || "pending").replaceAll("_", " "))}</td>
          </tr>
        `).join("")
      : '<tr><td colspan="5">No tasks found.</td></tr>';
  }

  // Approve / reject requests
  $("adminRequestsTableBody").addEventListener("click", async event => {
    const button = event.target.closest("button[data-action]");

    if (!button) return;

    const approve = button.dataset.action === "approve";

    const confirmed = confirm(
      `${approve ? "Approve" : "Reject"} admin access for ${button.dataset.name}?`
    );

    if (!confirmed) return;

    button.disabled = true;

    try {
      await TaskFlowAPI.adminDecide(button.dataset.id, button.dataset.action);
      alert(approve ? "Admin request approved." : "Admin request rejected.");
    } catch (error) {
      alert(error.message);
    }

    render();
  });

  // Logout
  $("logoutBtn")?.addEventListener("click", () => {
    TaskFlowAPI.clearSession();
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
});
