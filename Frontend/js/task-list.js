document.addEventListener("DOMContentLoaded", () => {
  "use strict";

  const api = window.TaskFlowAPI;
  const activeContainer = document.getElementById("inProgressTasksContainer");
  const completedContainer = document.getElementById("completedTasksContainer");
  if (!activeContainer || !completedContainer || !api) return;

  const session = api.getSession();

  // Role-aware navigation/title for administrators using Task Overview
  if (session?.role === "admin") {
    const dashboardLink = document.querySelector('.sidebar-nav a[href="dashboard.html"]');
    if (dashboardLink) {
      dashboardLink.href = "admin-dashboard.html";
      dashboardLink.querySelector("span:last-child").textContent = "Admin Dashboard";
    }
    const pageTitle = document.querySelector(".page-title");
    if (pageTitle) pageTitle.textContent = "Task Overview";
    document.querySelectorAll(".sidebar-nav a[href='task-list.html']").forEach(a => {
      const label = a.querySelector("span:last-child");
      if (label) label.textContent = "Task Overview";
    });
  }

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
  const categoryFilter = document.getElementById("categoryFilter");
  const sortSelect = document.getElementById("taskSortSelect");
  const deleteCategoryBtn = document.getElementById("deleteCategoryBtn");
  const editCategorySelect = document.getElementById("editTaskCategory");
  const adminView = session?.role === "admin";
  let cachedCategories = [];

  async function loadCategories() {
    if (adminView || !categoryFilter || !api.getCategories) return;
    try {
      cachedCategories = await api.getCategories();
      const options = '<option value="">All categories</option>' + cachedCategories.map(c => `<option value="${c.category_id}">${escapeHtml(c.category_name)}</option>`).join('');
      const selected = categoryFilter.value;
      categoryFilter.innerHTML = options;
      if (selected && cachedCategories.some(c => String(c.category_id) === selected)) categoryFilter.value = selected;
      if (editCategorySelect) editCategorySelect.innerHTML = '<option value="">No category</option>' + cachedCategories.map(c => `<option value="${c.category_id}">${escapeHtml(c.category_name)}</option>`).join('');
      if (deleteCategoryBtn) deleteCategoryBtn.hidden = !categoryFilter.value;
    } catch (err) { toast(err.message || 'Could not load categories.', 'error'); }
  }
  function escapeHtml(value) { return String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c])); }

  let selectedStatuses = new Set();
  let selectedPriorities = new Set();
  let pendingDeleteId = null;
  let cachedTasks = [];

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
    if (diff < 0) return { kind: "overdue", label: "Overdue" };
    if (diff === 0) return { kind: "today", label: "Due today" };
    if (diff <= 7) return { kind: "upcoming", label: "Due soon" };
    return { kind: "future", label: "Upcoming" };
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

  function createCompletedRow(task) {
    const row = document.createElement("tr");
    const taskCell = document.createElement("td");
    taskCell.className = "completed-task-name-cell";
    const title = document.createElement("span");
    title.className = "completed-task-title";
    title.textContent = task.title || "Untitled task";
    taskCell.appendChild(title);
    if (task.description) {
      const desc = document.createElement("small");
      desc.textContent = task.description;
      taskCell.appendChild(desc);
    }

    const priorityCell = document.createElement("td");
    const priority = normalizePriority(task.priority);
    const priorityBadge = document.createElement("span");
    priorityBadge.className = `table-priority priority-${priority}`;
    priorityBadge.textContent = priority.charAt(0).toUpperCase() + priority.slice(1);
    priorityCell.appendChild(priorityBadge);

    const dueCell = document.createElement("td");
    dueCell.textContent = task.dueDate ? formatDate(task.dueDate) : "—";

    const completedCell = document.createElement("td");
    completedCell.textContent = task.completedAt ? new Date(task.completedAt).toLocaleDateString() : "—";

    const actionsCell = document.createElement("td");
    actionsCell.className = "completed-table-actions";
    if (adminView) { actionsCell.hidden = true; row.classList.add('admin-readonly-row'); }

    const makeAction = (label, className, handler) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `table-action ${className}`;
      button.innerHTML = label === "Reopen"
        ? `<i data-lucide="rotate-ccw"></i> ${label}`
        : label === "Edit"
        ? `<i data-lucide="pencil"></i> ${label}`
        : `<i data-lucide="trash-2"></i> ${label}`;
      button.addEventListener("click", handler);
      return button;
    };

    if (!adminView) {
      actionsCell.append(
        makeAction("Reopen", "reopen", async () => {
          try {
            await api.updateTask(task.id, { status: "pending" });
            toast("Task reopened!");
            await loadAndRender();
          } catch (err) { toast(err.message || "Could not reopen task.", "error"); }
        }),
        makeAction("Edit", "edit", () => openEdit(task)),
        makeAction("Delete", "delete", () => { pendingDeleteId = task.id; openModal(deleteModal); })
      );
    }

    row.append(taskCell, priorityCell, dueCell, completedCell, actionsCell);
    return row;
  }

  function openEdit(task) {
    document.getElementById("editTaskId").value = task.id;
    document.getElementById("editTaskTitle").value = task.title || "";
    document.getElementById("editTaskDesc").value = task.description || "";
    document.getElementById("editTaskDueDate").value = task.dueDate || "";
    document.getElementById("editTaskPriority").value = normalizePriority(task.priority).charAt(0).toUpperCase() + normalizePriority(task.priority).slice(1);
    if (editCategorySelect) editCategorySelect.value = task.categoryId || "";
    openModal(editModal);
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
    statusBadge.textContent = completed ? "Completed" : (task.status === "in_progress" ? "In Progress" : "Pending");
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
    if (task.categoryName) {
      const categoryPill = document.createElement('span');
      categoryPill.className = 'task-meta-pill task-category-pill';
      categoryPill.textContent = task.categoryName;
      meta.appendChild(categoryPill);
    }

    const actions = document.createElement("div");
    actions.className = "task-actions";

    const statusButton = document.createElement("button");
    statusButton.type = "button";
    statusButton.className = `task-action-button ${completed ? "reopen" : "complete"}`;
    statusButton.innerHTML = completed ? `<i data-lucide="rotate-ccw"></i> Reopen` : `<i data-lucide="check"></i> Complete`;
    statusButton.addEventListener("click", async () => {
      const newStatus = completed ? "pending" : "completed";
      try {
        await api.updateTask(task.id, { status: newStatus });
        toast(newStatus === "completed" ? "Task completed!" : "Task reopened!");
        await loadAndRender();
      } catch (err) {
        toast(err.message || "Could not update task.", "error");
      }
    });

    const editButton = document.createElement("button");
    editButton.type = "button";
    editButton.className = "task-action-button edit";
    editButton.innerHTML = `<i data-lucide="pencil"></i> Edit`;
    editButton.addEventListener("click", () => openEdit(task));

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "task-action-button delete";
    deleteButton.innerHTML = `<i data-lucide="trash-2"></i> Delete`;
    deleteButton.addEventListener("click", () => {
      pendingDeleteId = task.id;
      openModal(deleteModal);
    });

    if (!adminView) actions.append(statusButton, editButton, deleteButton);
    card.append(top, description, ...(adminView ? [] : [actions]),);
    return card;
  }

  function renderFilterChips() {
    if (!chipsContainer) return;
    chipsContainer.replaceChildren();

    const chipData = [
      ...Array.from(selectedStatuses, status => ({
        type: "status",
        value: status,
        label: `Status: ${status === "in_progress" ? "In Progress" : status === "completed" ? "Completed" : "Pending"}`
      })),
      ...Array.from(selectedPriorities, priority => ({
        type: "priority",
        value: priority,
        label: `Priority: ${priority.charAt(0).toUpperCase()}${priority.slice(1)}`
      })),
      ...(categoryFilter?.value ? [{ type: 'category', value: categoryFilter.value, label: `Category: ${categoryFilter.options[categoryFilter.selectedIndex]?.text || 'Selected'}` }] : [])
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
        if (item.type === 'category') categoryFilter.value = '';
        else (item.type === "status" ? selectedStatuses : selectedPriorities).delete(item.value);
        syncFilterButtons();
        filterAndRender();
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
    const count = selectedStatuses.size + selectedPriorities.size + (categoryFilter?.value ? 1 : 0);
    if (filterCount) {
      filterCount.textContent = String(count);
      filterCount.hidden = count === 0;
    }
  }

  function filterAndRender() {
    const query = (searchInput?.value || "").trim().toLowerCase();
    const filtered = cachedTasks.filter(task => {
      const status = normalizeStatus(task.status);
      const priority = normalizePriority(task.priority);
      const matchesSearch = `${task.title || ""} ${task.description || ""}`.toLowerCase().includes(query);
      const matchesStatus = selectedStatuses.size === 0 || selectedStatuses.has(status);
      const matchesPriority = selectedPriorities.size === 0 || selectedPriorities.has(priority);
      const selectedCategory = categoryFilter?.value || '';
      const matchesCategory = !selectedCategory || String(task.categoryId || '') === selectedCategory;
      return matchesSearch && matchesStatus && matchesPriority && matchesCategory;
    });

    const activeTasks = filtered.filter(task => !isCompleted(task));
    const completedTasks = filtered.filter(isCompleted);

    activeContainer.replaceChildren();
    completedContainer.replaceChildren();

    if (inProgressCount) inProgressCount.textContent = String(activeTasks.length);
    if (completedCount) completedCount.textContent = String(completedTasks.length);
    if (taskCountBadge) taskCountBadge.textContent = `${filtered.length} ${filtered.length === 1 ? "task" : "tasks"}`;

    if (activeTasks.length) {
      activeTasks.forEach(task => activeContainer.appendChild(createTaskCard(task, false)));
    } else {
      activeContainer.appendChild(createEmptyState(
        selectedStatuses.has("completed") && selectedStatuses.size === 1 ? "No unfinished tasks match" : "You're all caught up!",
        selectedStatuses.has("completed") && selectedStatuses.size === 1 ? "Try clearing or changing your filters." : "New or reopened tasks will appear here."
      ));
    }

    if (completedTasks.length) {
      completedTasks.forEach(task => completedContainer.appendChild(createCompletedRow(task)));
    } else {
      const row = document.createElement("tr");
      const cell = document.createElement("td");
      cell.colSpan = 5;
      cell.className = "completed-table-empty";
      cell.textContent = "No completed tasks yet — tasks you finish will appear here.";
      row.appendChild(cell);
      completedContainer.appendChild(row);
    }

    renderFilterChips();
    refreshIcons();
  }

  function sortCachedTasks() {
    const sort = sortSelect?.value || 'newest';
    const priorityRank = { high: 0, medium: 1, low: 2 };
    cachedTasks.sort((a, b) => {
      if (sort === 'oldest') return new Date(a.createdAt || 0) - new Date(b.createdAt || 0);
      if (sort === 'due_date') return (a.dueDate || '9999-12-31').localeCompare(b.dueDate || '9999-12-31') || new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
      if (sort === 'priority') return priorityRank[normalizePriority(a.priority)] - priorityRank[normalizePriority(b.priority)] || new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
      return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
    });
  }

  async function loadAndRender() {
    try {
      if (session?.role === "admin") {
        cachedTasks = await api.adminGetAllTasks();
      } else {
        cachedTasks = await api.getTasks({ sort: sortSelect?.value || 'newest' });
      }
      if (adminView) sortCachedTasks();
      filterAndRender();
    } catch (err) {
      console.error("Load tasks error:", err);
      toast(err.message || "Failed to load tasks from server.", "error");
    }
  }

  // Edit Task Submit
  editForm?.addEventListener("submit", async event => {
    event.preventDefault();
    const id = document.getElementById("editTaskId")?.value;
    const title = document.getElementById("editTaskTitle")?.value.trim();
    if (!id || !title) return toast("Task title is required.", "error");

    try {
      await api.updateTask(id, {
        title,
        description: document.getElementById("editTaskDesc")?.value || "",
        dueDate: document.getElementById("editTaskDueDate")?.value || null,
        priority: normalizePriority(document.getElementById("editTaskPriority")?.value || "medium"),
        categoryId: editCategorySelect?.value || null
      });
      closeModal(editModal);
      toast("Task updated successfully!");
      await loadAndRender();
    } catch (err) {
      toast(err.message || "Task update failed.", "error");
    }
  });

  document.getElementById("closeEditModalBtn")?.addEventListener("click", () => closeModal(editModal));
  document.getElementById("cancelDeleteBtn")?.addEventListener("click", () => {
    pendingDeleteId = null;
    closeModal(deleteModal);
  });

  document.getElementById("confirmDeleteBtn")?.addEventListener("click", async () => {
    if (pendingDeleteId === null) return;
    try {
      await api.deleteTask(pendingDeleteId);
      pendingDeleteId = null;
      closeModal(deleteModal);
      toast("Task deleted!");
      await loadAndRender();
    } catch (err) {
      toast(err.message || "Delete failed.", "error");
    }
  });

  searchInput?.addEventListener("input", filterAndRender);
  sortSelect?.addEventListener("change", () => loadAndRender());

  document.querySelectorAll("[data-status-filter]").forEach(button => {
    button.addEventListener("click", () => {
      const value = button.dataset.statusFilter;
      selectedStatuses.has(value) ? selectedStatuses.delete(value) : selectedStatuses.add(value);
      syncFilterButtons();
      filterAndRender();
    });
  });

  document.querySelectorAll("[data-priority-filter]").forEach(button => {
    button.addEventListener("click", () => {
      const value = button.dataset.priorityFilter;
      selectedPriorities.has(value) ? selectedPriorities.delete(value) : selectedPriorities.add(value);
      syncFilterButtons();
      filterAndRender();
    });
  });

  clearFiltersBtn?.addEventListener("click", () => {
    selectedStatuses.clear();
    selectedPriorities.clear();
    if (categoryFilter) categoryFilter.value = '';
    if (deleteCategoryBtn) deleteCategoryBtn.hidden = true;
    syncFilterButtons();
    filterAndRender();
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

  // Live clock
  const dateDisplay = document.getElementById("currentDateDisplay");
  const timeDisplay = document.getElementById("currentTimeDisplay");
  function updateClock() {
    const now = new Date();
    if (dateDisplay) dateDisplay.textContent = now.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
    if (timeDisplay) timeDisplay.textContent = now.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  }
  updateClock();
  window.setInterval(updateClock, 1000);

  // Profile Menu
  const profileTrigger = document.getElementById("profileMenuTrigger");
  const profileMenu = document.getElementById("profileMenu");
  profileTrigger?.addEventListener("click", event => {
    event.stopPropagation();
    const open = profileMenu?.classList.toggle("open");
    profileTrigger.setAttribute("aria-expanded", open ? "true" : "false");
  });
  document.addEventListener("click", event => {
    if (!event.target.closest(".profile-menu-wrap")) {
      profileMenu?.classList.remove("open");
      profileTrigger?.setAttribute("aria-expanded", "false");
    }
  });

  if (adminView) {
    document.querySelector('.completed-task-table thead th:last-child')?.setAttribute('hidden', '');
    if (categoryFilter) categoryFilter.closest('.filter-group-block')?.setAttribute('hidden', '');
    if (editModal) editModal.hidden = true;
    if (deleteModal) deleteModal.hidden = true;
  }
  categoryFilter?.addEventListener('change', () => {
    if (deleteCategoryBtn) deleteCategoryBtn.hidden = !categoryFilter.value;
    filterAndRender();
  });
  deleteCategoryBtn?.addEventListener('click', async () => {
    const categoryId = categoryFilter?.value;
    const selectedName = categoryFilter?.options[categoryFilter.selectedIndex]?.text;
    if (!categoryId || !confirm(`Delete category “${selectedName}”? Tasks assigned to it will become uncategorized.`)) return;
    try {
      await api.deleteCategory(categoryId);
      categoryFilter.value = '';
      await loadCategories();
      await loadAndRender();
      toast('Category deleted.');
    } catch (err) { toast(err.message || 'Could not delete category.', 'error'); }
  });
  syncFilterButtons();
  loadCategories().then(loadAndRender);
});
