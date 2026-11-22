(() => {
  "use strict";

  const api = window.TaskFlowAPI;
  const $ = (s, root = document) => root.querySelector(s);
  const safe = (value = "") => String(value ?? "").replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const initials = (name = "User") => name.trim().split(/\s+/).slice(0, 2).map(x => x[0] || "").join("").toUpperCase();

  const fmtDate = value => {
    if (!value) return "—";
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  };

  const fmtRelative = value => {
    if (!value) return "No activity yet";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "No activity yet";
    const diff = Math.max(0, Date.now() - d.getTime());
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins} min${mins === 1 ? "" : "s"} ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs} hour${hrs === 1 ? "" : "s"} ago`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;
    return fmtDate(value);
  };

  const statusOf = t => (t.status || "pending").toLowerCase().includes("complete")
    ? "completed"
    : (t.status || "pending").toLowerCase().includes("progress")
    ? "in-progress"
    : "pending";

  const session = api?.getSession?.();
  if (!session || (session.role !== "admin" && session.role !== "master-admin")) {
    location.replace("index.html");
    return;
  }

  let cachedUsers = [];
  let cachedOverview = null;

  async function loadData() {
    try {
      const [overview, users] = await Promise.all([
        api.adminGetOverview(),
        api.adminGetUsers()
      ]);
      cachedOverview = overview;
      cachedUsers = users;
      renderMetrics(overview);
      renderUsers(users);
      renderRecent(overview.recent_activity || []);
      window.lucide?.createIcons();
    } catch (err) {
      console.error("Admin dashboard load error:", err);
      window.TaskFlowApp?.showToast?.(err.message || "Failed to load admin data", "error");
    }
  }

  function renderMetrics(overview) {
    if (!overview) return;
    $("#metricUsers").textContent = overview.total_users;
    $("#metricTasks").textContent = overview.total_tasks;
    $("#metricCompleted").textContent = overview.completed_tasks;
    $("#metricPending").textContent = overview.pending_tasks;
    $("#donutTotal").textContent = overview.total_tasks;

    const complete = overview.completed_tasks;
    const pending = overview.pending_tasks;
    const total = Math.max(overview.total_tasks, 1);

    const pendingPercent = (pending / total) * 100;
    const completePercent = ((pending + complete) / total) * 100;

    $("#statusDonut").style.background = `conic-gradient(#2563eb 0 ${pendingPercent}%, #10b981 ${pendingPercent}% ${completePercent}%, #e2e8f0 ${completePercent}% 100%)`;
    $("#statusLegend").innerHTML = `
      <div class="legend-row"><span class="legend-dot" style="background:#2563eb"></span>Pending<strong>${pending}</strong></div>
      <div class="legend-row"><span class="legend-dot" style="background:#10b981"></span>Completed<strong>${complete}</strong></div>
    `;
  }

  function renderUsers(usersList, filter = "") {
    const filtered = usersList.filter(u =>
      `${u.name || ""} ${u.email || ""}`.toLowerCase().includes(filter.toLowerCase())
    );

    const tbody = $("#usersTableBody");
    if (!tbody) return;

    if (!filtered.length) {
      tbody.innerHTML = `<tr><td colspan="6"><div class="log-empty">No users match your search.</div></td></tr>`;
      $("#usersCount").textContent = `Showing 0 of ${usersList.length} users`;
      return;
    }

    tbody.innerHTML = filtered.map(u => `
      <tr>
        <td>
          <div class="user-cell">
            <span class="table-avatar">${safe(initials(u.name))}</span>
            <div>
              <button type="button" class="user-name-link" data-user-id="${u.user_id}">
                ${safe(u.name)}
              </button>
              <span class="user-email">${safe(u.email)}</span>
            </div>
          </div>
        </td>
        <td><span class="table-number">${u.total_tasks}</span></td>
        <td><span class="table-completed">${u.completed_tasks}</span></td>
        <td><span class="table-pending">${u.pending_tasks}</span></td>
        <td>${safe(fmtRelative(u.last_activity))}</td>
        <td>
          <button type="button" class="view-logs-btn" data-user-id="${u.user_id}">
            <i data-lucide="file-clock"></i>View logs
          </button>
        </td>
      </tr>
    `).join("");

    $("#usersCount").textContent = `Showing ${filtered.length} of ${usersList.length} users`;
    window.lucide?.createIcons();
  }

  function renderRecent(recentList) {
    const host = $("#recentActivity");
    if (!host) return;

    if (!recentList.length) {
      host.innerHTML = `<div class="activity-empty">No task activity yet.</div>`;
      return;
    }

    host.innerHTML = recentList.map(r => `
      <div class="activity-row">
        <span class="activity-icon ${r.kind}">
          <i data-lucide="${r.kind === 'completed' ? 'check-circle-2' : 'plus-circle'}"></i>
        </span>
        <div class="activity-copy">
          <strong>${safe(r.owner_name || 'A user')}</strong> ${r.kind === 'completed' ? 'completed' : 'created'} a task
          <span class="activity-task">${safe(r.title || 'Untitled task')}</span>
          <span class="activity-time">${safe(fmtRelative(r.created_at))}</span>
        </div>
      </div>
    `).join("");

    window.lucide?.createIcons();
  }

  async function openLogs(userId) {
    const user = cachedUsers.find(u => String(u.user_id) === String(userId));
    if (!user) return;

    $("#logAvatar").textContent = initials(user.name);
    $("#logModalTitle").textContent = user.name;
    $("#logModalEmail").textContent = user.email;
    $("#logSummary").innerHTML = `
      <div class="log-summary-card"><span>Total tasks</span><strong>${user.total_tasks}</strong></div>
      <div class="log-summary-card"><span>Completed</span><strong>${user.completed_tasks}</strong></div>
      <div class="log-summary-card"><span>Pending</span><strong>${user.pending_tasks}</strong></div>
    `;

    $("#logTaskCount").textContent = "Loading tasks…";
    $("#userTaskLogs").innerHTML = `<div class="log-empty">Fetching user task activity from server…</div>`;
    $("#taskLogModal").classList.add("show");
    $("#taskLogModal").setAttribute("aria-hidden", "false");

    try {
      const tasks = await api.adminGetUserTasks(userId);
      $("#logTaskCount").textContent = `${tasks.length} task${tasks.length === 1 ? "" : "s"}`;

      if (!tasks.length) {
        $("#userTaskLogs").innerHTML = `<div class="log-empty"><i data-lucide="clipboard-list"></i>No task records found for this user yet.</div>`;
      } else {
        $("#userTaskLogs").innerHTML = tasks.map(t => {
          const st = statusOf(t);
          return `
            <article class="log-task-card">
              <div class="log-task-top">
                <div>
                  <div class="log-task-title">${safe(t.title || "Untitled task")}</div>
                  ${t.description ? `<p class="log-task-description">${safe(t.description)}</p>` : ""}
                </div>
                <span class="log-status ${st}">${st === "in-progress" ? "In progress" : st === "completed" ? "Completed" : "Pending"}</span>
              </div>
              <div class="log-task-meta">
                <span><i data-lucide="calendar-plus"></i>Created ${safe(fmtDate(t.createdAt))}</span>
                ${t.dueDate ? `<span><i data-lucide="calendar"></i>Due ${safe(fmtDate(t.dueDate))}</span>` : ""}
                <span><i data-lucide="flag"></i>${safe((t.priority || "medium").replace(/^./, c => c.toUpperCase()))} priority</span>
              </div>
              <div class="log-timeline">
                <span class="timeline-dot"></span>
                <span>${st === "completed" ? `Completed on ${safe(fmtDate(t.completedAt || t.updatedAt || t.createdAt))}` : `Task ${st === "in-progress" ? "is in progress" : "is pending"}${t.updatedAt ? ` · Last updated ${safe(fmtDate(t.updatedAt))}` : ""}`}</span>
              </div>
            </article>
          `;
        }).join("");
      }
      window.lucide?.createIcons();
    } catch (err) {
      $("#userTaskLogs").innerHTML = `<div class="log-empty" style="color:#ef4444">${safe(err.message || "Failed to load tasks.")}</div>`;
    }
  }

  function closeLogs() {
    $("#taskLogModal").classList.remove("show");
    $("#taskLogModal").setAttribute("aria-hidden", "true");
  }

  function setupShell() {
    const layout = $("#appLayout");
    $("#hamburgerBtn")?.addEventListener("click", () => {
      $("#sidebar").classList.toggle("open");
      $("#sidebarOverlay").classList.toggle("active");
    });
    $("#sidebarOverlay")?.addEventListener("click", () => {
      $("#sidebar").classList.remove("open");
      $("#sidebarOverlay").classList.remove("active");
    });

    const name = session?.name || "Administrator";
    $("#sidebarName").textContent = name;
    $("#sidebarAvatar").textContent = initials(name);
    $("#sidebarRole").textContent = session?.role === "master-admin" ? "Master Admin" : "Administrator";

    $("#profileTrigger")?.addEventListener("click", () => {
      const open = $("#profileTrigger").getAttribute("aria-expanded") === "true";
      $("#profileTrigger").setAttribute("aria-expanded", String(!open));
      $("#profileMenu").hidden = open;
      $("#profileMenu").classList.toggle("open", !open);
    });

    document.addEventListener("click", e => {
      if (!e.target.closest(".profile-menu-wrap")) {
        $("#profileMenu").hidden = true;
        $("#profileMenu").classList.remove("open");
        $("#profileTrigger")?.setAttribute("aria-expanded", "false");
      }
    });

    $("#logoutTrigger")?.addEventListener("click", () => $("#logoutModalOverlay").classList.add("show"));
    $("#cancelLogoutBtn")?.addEventListener("click", () => $("#logoutModalOverlay").classList.remove("show"));
    $("#confirmLogoutBtn")?.addEventListener("click", () => api.logout());

    $("#closeLogModal")?.addEventListener("click", closeLogs);
    $("#taskLogModal")?.addEventListener("click", e => {
      if (e.target === $("#taskLogModal")) closeLogs();
    });

    document.addEventListener("keydown", e => {
      if (e.key === "Escape") {
        closeLogs();
        $("#logoutModalOverlay").classList.remove("show");
        $("#sidebar").classList.remove("open");
        $("#sidebarOverlay").classList.remove("active");
      }
    });
  }

  function clock() {
    const d = new Date();
    $("#currentDateDisplay").textContent = d.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric", year: "numeric" });
    $("#currentTimeDisplay").textContent = d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    const h = d.getHours();
    $("#greetingTitle").textContent = `Good ${h < 12 ? "morning" : h < 17 ? "afternoon" : "evening"}${session?.name ? `, ${session.name.split(" ")[0]}` : ""}!`;
  }

  document.addEventListener("click", e => {
    const btn = e.target.closest("[data-user-id]");
    if (btn) openLogs(btn.dataset.userId);
  });

  $("#userSearch")?.addEventListener("input", e => renderUsers(cachedUsers, e.target.value));

  setupShell();
  clock();
  setInterval(clock, 1000);
  loadData();
})();
