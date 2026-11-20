
document.addEventListener("DOMContentLoaded", () => {
  const container = document.getElementById("taskListContainer");
  if (!container || !window.TaskFlowStore) return;

  const search = document.getElementById("taskSearchInput");
  const badge = document.getElementById("taskCountBadge");
  const editModal = document.getElementById("editModalOverlay");
  const deleteModal = document.getElementById("deleteModalOverlay");
  const editForm = document.getElementById("editTaskForm");

  let filter = "all";
  let deleteId = null;

  const toast = (message, type = "success") => {
    if (window.TaskFlowApp?.showToast) {
      window.TaskFlowApp.showToast(message, type);
    } else {
      alert(message);
    }
  };

  const openModal = modal => {
    if (!modal) return toast("Modal not found.", "error");
    window.TaskFlowApp?.openModal(modal);
  };

  const closeModal = modal => {
    if (modal) window.TaskFlowApp?.closeModal(modal);
  };

  function render() {
    const query = (search?.value || "").trim().toLowerCase();

    const tasks = TaskFlowStore.getTasks().filter(task => {
      const matchesFilter = filter === "all" || task.status === filter;
      const matchesSearch =
        `${task.title} ${task.description || ""}`.toLowerCase().includes(query);

      return matchesFilter && matchesSearch;
    });

    if (badge) badge.textContent = `${tasks.length} tasks`;
    container.replaceChildren();

    if (!tasks.length) {
      const empty = document.createElement("p");
      empty.textContent = "No tasks found.";
      container.appendChild(empty);
      return;
    }

    tasks.forEach(task => {
      const card = document.createElement("article");
      card.className = "task-card";

      const title = document.createElement("h3");
      title.textContent = task.title;

      const description = document.createElement("p");
      description.textContent = task.description || "No description";

      const details = document.createElement("p");
      details.textContent =
        `Priority: ${task.priority} · Due: ${task.dueDate || "Not set"} · Status: ${task.status.replace("_", " ")}`;

      const actions = document.createElement("div");
      actions.className = "task-actions";

      const statusButton = document.createElement("button");
      statusButton.type = "button";
      statusButton.textContent =
        task.status === "completed" ? "Reopen" : "Mark complete";

      statusButton.addEventListener("click", () => {
        const newStatus =
          task.status === "completed" ? "pending" : "completed";

        const updated = TaskFlowStore.updateTask(task.id, {
          status: newStatus
        });

        if (!updated) return toast("Could not update task.", "error");

        toast(newStatus === "completed" ? "Task completed!" : "Task reopened!");
        render();
      });

      const editButton = document.createElement("button");
      editButton.type = "button";
      editButton.textContent = "Edit";

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
        fields.title.value = task.title;
        fields.desc.value = task.description || "";
        fields.due.value = task.dueDate || "";
        fields.priority.value = task.priority;

        openModal(editModal);
      });

      const deleteButton = document.createElement("button");
      deleteButton.type = "button";
      deleteButton.textContent = "Delete";

      deleteButton.addEventListener("click", () => {
        deleteId = task.id;
        openModal(deleteModal);
      });

      actions.append(statusButton, editButton, deleteButton);
      card.append(title, description, details, actions);
      container.appendChild(card);
    });
  }

  editForm?.addEventListener("submit", event => {
    event.preventDefault();

    const id = document.getElementById("editTaskId")?.value;
    const title = document.getElementById("editTaskTitle")?.value.trim();

    if (!id || !title) {
      return toast("Task title is required.", "error");
    }

    const updated = TaskFlowStore.updateTask(id, {
      title,
      description: document.getElementById("editTaskDesc")?.value || "",
      dueDate: document.getElementById("editTaskDueDate")?.value || "",
      priority: (
        document.getElementById("editTaskPriority")?.value || "medium"
      ).toLowerCase()
    });

    if (!updated) return toast("Task update failed.", "error");

    closeModal(editModal);
    toast("Task updated!");
    render();
  });

  document.getElementById("closeEditModalBtn")
    ?.addEventListener("click", () => closeModal(editModal));

  document.getElementById("cancelDeleteBtn")
    ?.addEventListener("click", () => {
      deleteId = null;
      closeModal(deleteModal);
    });

  document.getElementById("confirmDeleteBtn")
    ?.addEventListener("click", () => {
      if (!deleteId) return;

      const deleted = TaskFlowStore.deleteTask(deleteId);
      deleteId = null;

      closeModal(deleteModal);

      if (!deleted) return toast("Delete failed.", "error");

      toast("Task deleted!");
      render();
    });

  search?.addEventListener("input", render);

  document.querySelectorAll("[data-filter]").forEach(button => {
    button.addEventListener("click", () => {
      filter = button.dataset.filter;

      document.querySelectorAll("[data-filter]").forEach(item => {
        item.classList.remove("active");
      });

      button.classList.add("active");
      render();
    });
  });

  render();
});
