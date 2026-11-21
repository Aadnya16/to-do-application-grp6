document.addEventListener("DOMContentLoaded", () => {
  const activeContainer = document.getElementById("inProgressTasksContainer");
  const completedContainer = document.getElementById("completedTasksContainer");
  if (!activeContainer || !completedContainer || !window.TaskFlowStore) return;

  // Role-aware navigation/title for administrators using Task Overview.
  try {
    const session = JSON.parse(sessionStorage.getItem("taskflow_session") || "null");
    if (session?.role === "admin") {
      const dashboardLink = document.querySelector('.sidebar-nav a[href="dashboard.html"]');
      if (dashboardLink) { dashboardLink.href = "admin-dashboard.html"; dashboardLink.querySelector("span:last-child").textContent = "Admin Dashboard"; }
      const pageTitle = document.querySelector(".page-title"); if (pageTitle) pageTitle.textContent = "Task Overview";
      document.querySelectorAll(".sidebar-nav a[href='task-list.html']").forEach(a => { const label=a.querySelector("span:last-child"); if(label) label.textContent="Task Overview"; });
    }
  } catch {}

  const searchInput = document.getElementById("taskSearchInput");
  const taskCountBadge = document.getElementById("taskCountBadge");
  const editModal = document.getElementById("editModalOverlay");
  const deleteModal = document.getElementById("deleteModalOverlay");
  const editForm = document.getElementById("editTaskForm");
  const filterToggle = document.getElementById("filterToggleBtn");
  const filterPanel = document.getElementById("filterPanel");
  const filterCount = document.getElementById("activeFilterCount");
  const chipsContainer = document.getElementById("activeFilterChips");
  const clearFiltersBtn = document.getElementById("clearFiltersBtn");
  const inProgressCount = document.getElementById("inProgressCount");
  const completedCount = document.getElementById("completedCount");

  let selectedStatuses = new Set();
  let selectedPriorities = new Set();
  let pendingDeleteId = null;

  const refreshIcons = () => window.lucide?.createIcons?.({ attrs: { "stroke-width": 1.8 } });
  const toast = (message, type = "success") => {
    if (window.TaskFlowApp?.showToast) window.TaskFlowApp.showToast(message, type);
    else alert(message);
  };
  const openModal = modal => window.TaskFlowApp?.openModal(modal);
  const closeModal = modal => window.TaskFlowApp?.closeModal(modal);

  const normalizePriority = priority => String(priority || "medium").toLowerCase();
  const normalizeStatus = status => String(status || "pending").toLowerCase();
  const isCompleted = task => normalizeStatus(task.status) === "completed";

  function getFilteredTasks() {
    const query = (searchInput?.value || "").trim().toLowerCase();
    return TaskFlowStore.getTasks().filter(task => {
      const status = normalizeStatus(task.status);
      const priority = normalizePriority(task.priority);
      const matchesSearch = `${task.title || ""} ${task.description || ""}`.toLowerCase().includes(query);
      const matchesStatus = selectedStatuses.size === 0 || selectedStatuses.has(status);
      const matchesPriority = selectedPriorities.size === 0 || selectedPriorities.has(priority);
      return matchesSearch && matchesStatus && matchesPriority;
    });
  }

  function createEmptyState(title, description) {
    const state = document.createElement("div");
    state.className = "task-empty-state";
    const heading = document.createElement("strong");
    heading.textContent = title;
    const message = document.createElement("p");
    message.textContent = description;
    state.append(heading, message);
    return state;
  }

  function parseDateOnly(value) {
    if (!value) return null;
    const parts = String(value).slice(0, 10).split("-").map(Number);
    if (parts.length !== 3 || parts.some(Number.isNaN)) return null;
    return new Date(parts[0], parts[1] - 1, parts[2]);
  }

  function formatDate(value) {
    const date = parseDateOnly(value);
    return date ? date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : value;
  }

  function getDueInfo(value, completed) {
    if (!value || completed) return null;
    const due = parseDateOnly(value);
    if (!due) return null;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const diff = Math.round((due - today) / 86400000);
    if (diff < 0) return {kind: "overdue", label: "Overdue"};
    if (diff === 0) return {kind: "today", label: "Due today"};
    if (diff <= 7) return {kind: "upcoming", label: "Due soon"};
    return {kind: "future", label: "Upcoming"};
  }

  function createCompletedRow(task) {
    const row = document.createElement("tr");
    const taskCell = document.createElement("td");
    taskCell.className = "completed-task-name-cell";
    const title = document.createElement("span");
    title.className = "completed-task-title"; title.textContent = task.title || "Untitled task";
    taskCell.appendChild(title);
    if (task.description) {
      const desc = document.createElement("small"); desc.textContent = task.description; taskCell.appendChild(desc);
    }
    const priorityCell = document.createElement("td");
    const priority = normalizePriority(task.priority);
    const priorityBadge = document.createElement("span");
    priorityBadge.className = `table-priority priority-${priority}`;
    priorityBadge.textContent = priority.charAt(0).toUpperCase() + priority.slice(1);
    priorityCell.appendChild(priorityBadge);
    const dueCell = document.createElement("td"); dueCell.textContent = task.dueDate ? formatDate(task.dueDate) : "—";
    const completedCell = document.createElement("td");
    completedCell.textContent = task.completedAt ? new Date(task.completedAt).toLocaleDateString() : "—";
    const actionsCell = document.createElement("td"); actionsCell.className = "completed-table-actions";
    const makeAction = (label, className, handler) => {
      const button = document.createElement("button"); button.type = "button"; button.className = `table-action ${className}`; button.innerHTML = label === "Reopen" ? `<i data-lucide="rotate-ccw"></i> ${label}` : label === "Edit" ? `<i data-lucide="pencil"></i> ${label}` : `<i data-lucide="trash-2"></i> ${label}`; button.addEventListener("click", handler); return button;
    };
    actionsCell.append(
      makeAction("Reopen", "reopen", () => {
        const updated = TaskFlowStore.updateTask(task.id, {status: "pending", completedAt: null});
        if (!updated) return toast("Could not reopen task.", "error");
        toast("Task reopened!"); render();
      }),
      makeAction("Edit", "edit", () => {
        document.getElementById("editTaskId").value = task.id;
        document.getElementById("editTaskTitle").value = task.title || "";
        document.getElementById("editTaskDesc").value = task.description || "";
        document.getElementById("editTaskDueDate").value = task.dueDate || "";
        document.getElementById("editTaskPriority").value = priority.charAt(0).toUpperCase() + priority.slice(1);
        openModal(editModal);
      }),
      makeAction("Delete", "delete", () => { pendingDeleteId = task.id; openModal(deleteModal); })
    );
    row.append(taskCell, priorityCell, dueCell, completedCell, actionsCell);
    return row;
  }

  function createTaskCard(task, completed) {
    const card = document.createElement("article");
    const priority = normalizePriority(task.priority);
    card.className = `task-card priority-${priority}${completed ? " completed-card" : ""}`;

    const top = document.createElement("div");
    top.className = "task-card-top";
    const title = document.createElement("h3");
    title.className = "task-card-title";
    title.textContent = task.title || "Untitled task";

    const statusBadge = document.createElement("span");
    statusBadge.className = `task-status-badge${completed ? " completed" : ""}`;
    statusBadge.textContent = completed ? "Completed" : "Pending";
    top.append(title, statusBadge);

    const description = document.createElement("p");
    description.className = "task-card-description";
    description.textContent = task.description || "No description added.";

    const meta = document.createElement("div");
    meta.className = "task-meta-row";
    const priorityPill = document.createElement("span");
    priorityPill.className = `task-meta-pill priority-${priority}`;
    priorityPill.textContent = `${priority.charAt(0).toUpperCase()}${priority.slice(1)} priority`;
    const duePill = document.createElement("span");
    duePill.className = "task-meta-pill";
    const dueInfo = getDueInfo(task.dueDate, completed);
    duePill.textContent = task.dueDate ? `Due: ${formatDate(task.dueDate)}` : "No due date";
    if (dueInfo) {
      duePill.classList.add(`due-${dueInfo.kind}`);
      duePill.title = dueInfo.label;
    }
    meta.append(priorityPill, duePill);

    const actions = document.createElement("div");
    actions.className = "task-actions";

    const statusButton = document.createElement("button");
    statusButton.type = "button";
    statusButton.className = `task-action-button ${completed ? "reopen" : "complete"}`;
    statusButton.innerHTML = completed ? `<i data-lucide="rotate-ccw"></i> Reopen` : `<i data-lucide="check"></i> Complete`;
    statusButton.addEventListener("click", () => {
      const newStatus = completed ? "pending" : "completed";
      const updated = TaskFlowStore.updateTask(task.id, {
        status: newStatus,
        completedAt: completed ? null : new Date().toISOString()
      });
      if (!updated) return toast("Could not update task.", "error");
      toast(newStatus === "completed" ? "Task completed!" : "Task reopened!");
      render();
    });

    const editButton = document.createElement("button");
    editButton.type = "button";
    editButton.className = "task-action-button edit";
    editButton.innerHTML = `<i data-lucide="pencil"></i> Edit`;
    editButton.addEventListener("click", () => {
      const fields = {
        id: document.getElementById("editTaskId"),
        title: document.getElementById("editTaskTitle"),
        desc: document.getElementById("editTaskDesc"),
        due: document.getElementById("editTaskDueDate"),
        priority: document.getElementById("editTaskPriority")
      };
      if (!editModal || Object.values(fields).some(field => !field)) {
        return toast("Edit form elements are missing.", "error");
      }
      fields.id.value = task.id;
      fields.title.value = task.title || "";
      fields.desc.value = task.description || "";
      fields.due.value = task.dueDate || "";
      fields.priority.value = priority.charAt(0).toUpperCase() + priority.slice(1);
      openModal(editModal);
    });

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "task-action-button delete";
    deleteButton.innerHTML = `<i data-lucide="trash-2"></i> Delete`;
    deleteButton.addEventListener("click", () => {
      pendingDeleteId = task.id;
      openModal(deleteModal);
    });

    actions.append(statusButton, editButton, deleteButton);
    card.append(top, description, meta, actions);
    return card;
  }

  function renderFilterChips() {
    if (!chipsContainer) return;
    chipsContainer.replaceChildren();

    const chipData = [
      ...Array.from(selectedStatuses, status => ({type: "status", value: status, label: `Status: ${status === "pending" ? "Pending" : "Completed"}`})),
      ...Array.from(selectedPriorities, priority => ({type: "priority", value: priority, label: `Priority: ${priority.charAt(0).toUpperCase()}${priority.slice(1)}`}))
    ];
    chipData.forEach(item => {
      const chip = document.createElement("span");
      chip.className = "filter-chip";
      const label = document.createElement("span");
      label.textContent = item.label;
      const remove = document.createElement("button");
      remove.type = "button";
      remove.setAttribute("aria-label", `Remove ${item.label} filter`);
      remove.innerHTML = `<i data-lucide="x"></i>`;
      remove.addEventListener("click", () => {
        (item.type === "status" ? selectedStatuses : selectedPriorities).delete(item.value);
        syncFilterButtons();
        render();
      });
      chip.append(label, remove);
      chipsContainer.appendChild(chip);
    });
  }

  function syncFilterButtons() {
    document.querySelectorAll("[data-status-filter]").forEach(button => {
      button.classList.toggle("selected", selectedStatuses.has(button.dataset.statusFilter));
      button.setAttribute("aria-pressed", selectedStatuses.has(button.dataset.statusFilter) ? "true" : "false");
    });
    document.querySelectorAll("[data-priority-filter]").forEach(button => {
      button.classList.toggle("selected", selectedPriorities.has(button.dataset.priorityFilter));
      button.setAttribute("aria-pressed", selectedPriorities.has(button.dataset.priorityFilter) ? "true" : "false");
    });
    const count = selectedStatuses.size + selectedPriorities.size;
    if (filterCount) {
      filterCount.textContent = String(count);
      filterCount.hidden = count === 0;
    }
  }

  function render() {
    const filtered = getFilteredTasks();
    const activeTasks = filtered.filter(task => !isCompleted(task));
    const completedTasks = filtered.filter(isCompleted);
    activeContainer.replaceChildren();
    completedContainer.replaceChildren();

    if (inProgressCount) inProgressCount.textContent = String(activeTasks.length);
    if (completedCount) completedCount.textContent = String(completedTasks.length);
    if (taskCountBadge) taskCountBadge.textContent = `${filtered.length} ${filtered.length === 1 ? "task" : "tasks"}`;

    if (activeTasks.length) activeTasks.forEach(task => activeContainer.appendChild(createTaskCard(task, false)));
    else activeContainer.appendChild(createEmptyState(
      selectedStatuses.has("completed") && selectedStatuses.size === 1 ? "No unfinished tasks match" : "You're all caught up!",
      selectedStatuses.has("completed") && selectedStatuses.size === 1 ? "Try clearing or changing your filters." : "New or reopened tasks will appear here."
    ));

    if (completedTasks.length) completedTasks.forEach(task => completedContainer.appendChild(createCompletedRow(task)));
    else {
      const row = document.createElement("tr");
      const cell = document.createElement("td"); cell.colSpan = 5;
      cell.className = "completed-table-empty"; cell.textContent = "No completed tasks yet — tasks you finish will appear here.";
      row.appendChild(cell); completedContainer.appendChild(row);
    }

    renderFilterChips();
    refreshIcons();
  }

  editForm?.addEventListener("submit", event => {
    event.preventDefault();
    const id = document.getElementById("editTaskId")?.value;
    const title = document.getElementById("editTaskTitle")?.value.trim();
    if (!id || !title) return toast("Task title is required.", "error");

    const updated = TaskFlowStore.updateTask(id, {
      title,
      description: document.getElementById("editTaskDesc")?.value || "",
      dueDate: document.getElementById("editTaskDueDate")?.value || "",
      priority: normalizePriority(document.getElementById("editTaskPriority")?.value || "medium")
    });
    if (!updated) return toast("Task update failed.", "error");
    closeModal(editModal);
    toast("Task updated!");
    render();
  });

  document.getElementById("closeEditModalBtn")?.addEventListener("click", () => closeModal(editModal));
  document.getElementById("cancelDeleteBtn")?.addEventListener("click", () => {
    pendingDeleteId = null;
    closeModal(deleteModal);
  });
  document.getElementById("confirmDeleteBtn")?.addEventListener("click", () => {
    if (pendingDeleteId === null) return;
    const deleted = TaskFlowStore.deleteTask(pendingDeleteId);
    pendingDeleteId = null;
    closeModal(deleteModal);
    if (!deleted) return toast("Delete failed.", "error");
    toast("Task deleted!");
    render();
  });

  searchInput?.addEventListener("input", render);
  document.querySelectorAll("[data-status-filter]").forEach(button => {
    button.addEventListener("click", () => {
      const value = button.dataset.statusFilter;
      selectedStatuses.has(value) ? selectedStatuses.delete(value) : selectedStatuses.add(value);
      syncFilterButtons();
      render();
    });
  });
  document.querySelectorAll("[data-priority-filter]").forEach(button => {
    button.addEventListener("click", () => {
      const value = button.dataset.priorityFilter;
      selectedPriorities.has(value) ? selectedPriorities.delete(value) : selectedPriorities.add(value);
      syncFilterButtons();
      render();
    });
  });
  clearFiltersBtn?.addEventListener("click", () => {
    selectedStatuses.clear();
    selectedPriorities.clear();
    syncFilterButtons();
    render();
  });
  filterToggle?.addEventListener("click", () => {
    const open = filterPanel?.classList.toggle("open");
    filterToggle.setAttribute("aria-expanded", open ? "true" : "false");
  });
  document.addEventListener("click", event => {
    if (!event.target.closest(".filter-control")) {
      filterPanel?.classList.remove("open");
      filterToggle?.setAttribute("aria-expanded", "false");
    }
  });
  document.addEventListener("keydown", event => {
    if (event.key === "Escape") {
      filterPanel?.classList.remove("open");
      filterToggle?.setAttribute("aria-expanded", "false");
    }
  });

  // Shared date and live clock widget
  const dateDisplay = document.getElementById("currentDateDisplay");
  const timeDisplay = document.getElementById("currentTimeDisplay");
  function updateClock() {
    const now = new Date();
    if (dateDisplay) dateDisplay.textContent = now.toLocaleDateString(undefined, {weekday: "long", day: "numeric", month: "long", year: "numeric"});
    if (timeDisplay) timeDisplay.textContent = now.toLocaleTimeString(undefined, {hour: "2-digit", minute: "2-digit", second: "2-digit"});
  }
  updateClock(); window.setInterval(updateClock, 1000);

  // Desktop sidebar collapse and profile menu
  const sidebar = document.getElementById("sidebar");
  const collapseBtn = document.getElementById("sidebarCollapseBtn");
  collapseBtn?.addEventListener("click", () => {
    sidebar?.classList.toggle("collapsed");
    document.body.classList.toggle("sidebar-collapsed");
    collapseBtn?.setAttribute("aria-label", document.body.classList.contains("sidebar-collapsed") ? "Expand sidebar" : "Collapse sidebar");
    collapseBtn?.setAttribute("title", document.body.classList.contains("sidebar-collapsed") ? "Expand sidebar" : "Collapse sidebar");
  });
  const profileTrigger = document.getElementById("profileMenuTrigger");
  const profileMenu = document.getElementById("profileMenu");
  profileTrigger?.addEventListener("click", event => {
    event.stopPropagation(); const open = profileMenu?.classList.toggle("open");
    profileTrigger.setAttribute("aria-expanded", open ? "true" : "false");
  });
  document.addEventListener("click", event => {
    if (!event.target.closest(".profile-menu-wrap")) {
      profileMenu?.classList.remove("open"); profileTrigger?.setAttribute("aria-expanded", "false");
    }
  });

  syncFilterButtons();
  render();
  refreshIcons();
});
