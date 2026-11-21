(() => {
  "use strict";

  const api = window.TaskFlowAPI;
  const $ = (id) => document.getElementById(id);

  const session = api?.getSession?.();
  const roleNorm = String(session?.role || "").toLowerCase().replace(/[_\s]+/g, "-");
  if (!session || !["master-admin", "masteradmin", "master"].includes(roleNorm)) {
    location.replace("index.html");
    return;
  }

  const getInitials = (name) => String(name || "Master Admin").trim().split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]).join("").toUpperCase();
  const displayName = (u) => u.name || u.fullName || u.email || "Unnamed account";
  const email = (u) => u.email || "—";
  const initials = (name) => String(name || "?").trim().split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]).join("").toUpperCase();

  const dateLabel = (date) => {
    if (!date) return "—";
    const d = new Date(date);
    return Number.isNaN(d.getTime()) ? String(date) : d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  };

  const setClock = () => {
    const now = new Date();
    $("currentDate").textContent = now.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" });
    $("currentTime").textContent = now.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  };

  const toast = (msg, type = "success") => {
    const box = $("toastContainer");
    if (!box) return;
    const el = document.createElement("div");
    el.className = `toast ${type}`;
    el.textContent = msg;
    box.appendChild(el);
    requestAnimationFrame(() => el.classList.add("show"));
    setTimeout(() => {
      el.classList.remove("show");
      setTimeout(() => el.remove(), 220);
    }, 2800);
  };

  const escapeHTML = (value) => String(value ?? "").replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  let cachedRequests = [];
  let requestAction = null;

  const openDecision = (requestItem, action) => {
    requestAction = { request: requestItem, action };
    $("decisionTitle").textContent = action === "approve" ? "Approve administrator?" : "Reject request?";
    $("decisionBody").textContent = action === "approve"
      ? `Approve ${displayName(requestItem)} and issue administrator verification code?`
      : `Reject the administrator access request from ${displayName(requestItem)}?`;
    $("decisionConfirm").textContent = action === "approve" ? "Approve request" : "Reject request";
    $("decisionConfirm").className = action === "approve" ? "btn btn-primary btn-sm" : "btn btn-danger btn-sm";
    $("decisionIcon").innerHTML = `<i data-lucide="${action === 'approve' ? 'shield-check' : 'user-x'}"></i>`;
    window.lucide?.createIcons();
    $("decisionModal").classList.add("show");
    $("decisionModal").setAttribute("aria-hidden", "false");
  };

  const closeDecision = () => {
    $("decisionModal").classList.remove("show");
    $("decisionModal").setAttribute("aria-hidden", "true");
    requestAction = null;
  };

  async function loadMasterData() {
    try {
      const [overview, requests, admins, users] = await Promise.all([
        api.masterGetOverview(),
        api.masterGetRequests(),
        api.masterGetAdmins(),
        api.masterGetUsers()
      ]);

      cachedRequests = requests;
      renderStats(overview);
      renderRequests(requests);
      renderAdmins(admins);
      renderUsers(users);
      window.lucide?.createIcons();
    } catch (err) {
      console.error("Master Admin load error:", err);
      toast(err.message || "Failed to load system data", "error");
    }
  }

  function renderStats(stats) {
    if (!stats) return;
    $("totalUsers").textContent = stats.total_users;
    $("totalAdmins").textContent = stats.total_admins;
    $("pendingRequests").textContent = stats.pending_requests;
    $("activeAccounts").textContent = stats.active_accounts;
    $("globalTasks").textContent = stats.global_tasks;
    $("globalCompleted").textContent = stats.global_completed;
    $("globalPending").textContent = stats.global_pending;
    $("completionRate").textContent = `${stats.completion_rate}%`;
    $("completionBar").style.width = `${stats.completion_rate}%`;
  }

  function renderRequests(requests) {
    $("pendingRequests").textContent = requests.length;
    $("navRequestCount").textContent = requests.length;
    $("requestCountLabel").textContent = `${requests.length} pending`;

    const list = $("requestList");
    if (!requests.length) {
      list.innerHTML = '<div class="request-empty"><i data-lucide="check-circle-2"></i><span>No pending admin requests. You’re all caught up.</span></div>';
      window.lucide?.createIcons();
      return;
    }

    list.innerHTML = requests.map((r, i) => `
      <div class="request-row">
        <div class="request-person">
          <span class="request-avatar">${initials(displayName(r))}</span>
          <div class="request-details">
            <strong>${escapeHTML(displayName(r))}</strong>
            <span>${escapeHTML(email(r))}</span>
            ${r.reason ? `<div class="request-reason">${escapeHTML(r.reason)}</div>` : ''}
            <div class="request-meta">Requested ${dateLabel(r.created_at)}</div>
          </div>
        </div>
        <div class="request-actions">
          <button class="mini-action approve" data-request-action="approve" data-request-index="${i}">
            <i data-lucide="check"></i>Approve
          </button>
          <button class="mini-action reject" data-request-action="reject" data-request-index="${i}">
            <i data-lucide="x"></i>Reject
          </button>
        </div>
      </div>
    `).join("");

    list.querySelectorAll("[data-request-action]").forEach(btn => {
      btn.addEventListener("click", () => {
        const item = requests[Number(btn.dataset.requestIndex)];
        if (item) openDecision(item, btn.dataset.requestAction);
      });
    });

    window.lucide?.createIcons();
  }

  function renderAdmins(admins) {
    const tbody = $("adminTableBody");
    const empty = $("adminEmpty");
    if (!tbody) return;

    if (!admins.length) {
      tbody.innerHTML = "";
      empty.hidden = false;
      return;
    }
    empty.hidden = true;

    tbody.innerHTML = admins.map(u => {
      const active = u.status === "active";
      return `
        <tr>
          <td>
            <div class="table-person">
              <span class="table-avatar">${initials(displayName(u))}</span>
              <strong>${escapeHTML(displayName(u))}</strong>
            </div>
          </td>
          <td class="email-cell">${escapeHTML(email(u))}</td>
          <td>
            <span class="account-chip ${active ? '' : 'inactive'}">
              <span class="dot"></span>${active ? 'Active' : (u.status === 'pending' ? 'Pending Approval' : (u.status === 'approved' ? 'Awaiting Verification' : 'Inactive'))}
            </span>
          </td>
          <td>${dateLabel(u.approved_at || u.created_at)}</td>
          <td>${u.status === 'approved' ? `<button class="mini-action approve" data-reissue-code="${u.user_id}"><i data-lucide="key-round"></i>Reissue code</button>` : ''}</td>
        </tr>
      `;
    }).join("");
    tbody.querySelectorAll('[data-reissue-code]').forEach(button => button.addEventListener('click', async () => {
      button.disabled = true;
      try {
        const result = await api.masterReissueCode(button.dataset.reissueCode);
        alert(`NEW ADMIN VERIFICATION CODE\n\nCode: ${result.code}\n\n${result.email_sent ? 'The code was emailed to the administrator.' : 'Email is unavailable; provide this code manually.'}`);
        toast('Verification code reissued.', 'success');
      } catch (err) { toast(err.message || 'Could not reissue verification code.', 'error'); }
      finally { button.disabled = false; }
    }));
    window.lucide?.createIcons();
  }

  function renderUsers(usersList) {
    const tbody = $("usersTableBody");
    const empty = $("usersEmpty");
    if (!tbody) return;

    if (!usersList.length) {
      tbody.innerHTML = "";
      empty.hidden = false;
      return;
    }
    empty.hidden = true;

    tbody.innerHTML = usersList.slice(0, 8).map(u => {
      const active = u.status === "active";
      return `
        <tr>
          <td>
            <div class="table-person">
              <span class="table-avatar">${initials(displayName(u))}</span>
              <strong>${escapeHTML(displayName(u))}</strong>
            </div>
          </td>
          <td class="email-cell">${escapeHTML(email(u))}</td>
          <td>
            <span class="account-chip ${active ? '' : 'inactive'}">
              <span class="dot"></span>${active ? 'Active' : 'Inactive'}
            </span>
          </td>
          <td>${dateLabel(u.created_at)}</td>
        </tr>
      `;
    }).join("");
  }

  function init() {
    const name = session.name || "Master Admin";
    $("sidebarName").textContent = name;
    $("sidebarRole").textContent = "Master Admin";
    $("sidebarAvatar").textContent = getInitials(name);
    setClock();
    setInterval(setClock, 1000);

    loadMasterData();

    $("profileTrigger")?.addEventListener("click", () => {
      const open = $("profileTrigger").getAttribute("aria-expanded") === "true";
      $("profileTrigger").setAttribute("aria-expanded", String(!open));
      $("profileMenu").hidden = open;
    });

    document.addEventListener("click", e => {
      if (!e.target.closest(".profile-menu-wrap")) {
        $("profileMenu").hidden = true;
        $("profileTrigger")?.setAttribute("aria-expanded", "false");
      }
    });

    $("sidebarCollapseBtn")?.addEventListener("click", () => $("appLayout").classList.toggle("sidebar-collapsed"));
    $("hamburgerBtn")?.addEventListener("click", () => {
      $("sidebar").classList.toggle("open");
      $("sidebarOverlay").classList.toggle("active");
    });
    $("sidebarOverlay")?.addEventListener("click", () => {
      $("sidebar").classList.remove("open");
      $("sidebarOverlay").classList.remove("active");
    });

    $("refreshBtn")?.addEventListener("click", () => {
      loadMasterData();
      toast("Dashboard refreshed.");
    });

    $("decisionCancel")?.addEventListener("click", closeDecision);
    $("decisionModal")?.addEventListener("click", e => {
      if (e.target === $("decisionModal")) closeDecision();
    });

    // Handle Approve / Reject Confirmation via Real Backend
    $("decisionConfirm")?.addEventListener("click", async () => {
      if (!requestAction) return;
      const { request: item, action } = requestAction;
      const confirmBtn = $("decisionConfirm");
      confirmBtn.disabled = true;

      try {
        if (action === "approve") {
          const res = await api.masterApproveRequest(item.user_id);
          closeDecision();
          await loadMasterData();
          const delivery = res.email_sent ? "The code was emailed to the applicant." : "Email delivery is not configured or failed. Copy the code and provide it to the applicant manually.";
          alert(`ADMINISTRATOR ACCESS APPROVED\n\nGenerated 6-Digit Verification Code: ${res.code} (expires in 15 minutes)\n\n${delivery}\n\nApplicant: ${item.name} (${item.email})`);
          toast(res.email_sent ? "Request approved and verification email sent." : "Request approved. Verification code issued for manual delivery.", "success");
        } else {
          const res = await api.masterRejectRequest(item.user_id);
          closeDecision();
          await loadMasterData();
          toast(res.email_sent ? "Request rejected; notification email sent." : "Administrator access request rejected.", "warning");
        }
      } catch (err) {
        toast(err.message || "Failed to update request.", "error");
      } finally {
        confirmBtn.disabled = false;
      }
    });

    $("logoutTrigger")?.addEventListener("click", () => {
      $("profileMenu").hidden = true;
      $("profileTrigger")?.setAttribute("aria-expanded", "false");
      $("logoutModalOverlay").classList.add("show");
      $("logoutModalOverlay").setAttribute("aria-hidden", "false");
    });

    $("cancelLogoutBtn")?.addEventListener("click", () => {
      $("logoutModalOverlay").classList.remove("show");
      $("logoutModalOverlay").setAttribute("aria-hidden", "true");
    });

    $("logoutModalOverlay")?.addEventListener("click", e => {
      if (e.target === $("logoutModalOverlay")) {
        $("logoutModalOverlay").classList.remove("show");
        $("logoutModalOverlay").setAttribute("aria-hidden", "true");
      }
    });

    $("confirmLogoutBtn")?.addEventListener("click", () => api.logout());

    document.addEventListener("keydown", e => {
      if (e.key === "Escape") {
        closeDecision();
        $("logoutModalOverlay").classList.remove("show");
        $("sidebar").classList.remove("open");
        $("sidebarOverlay").classList.remove("active");
      }
    });
  }

  document.addEventListener("DOMContentLoaded", init);
})();
