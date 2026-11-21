
document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("addTaskForm");
  if (!form || !window.TaskFlowAPI) return;

  const title = document.getElementById("taskTitle");
  const date = document.getElementById("taskDueDate");

  const showError = message => {
    window.TaskFlowApp?.showToast(message, "error");
  };

  form.addEventListener("submit", async event => {
    event.preventDefault();

    if (!title.value.trim()) {
      showError("Task title is required.");
      title.focus();
      return;
    }

    if (!date.value) {
      showError("Please select a due date.");
      date.focus();
      return;
    }

    if (date.value < new Date().toLocaleDateString("en-CA")) {
      showError("Due date cannot be in the past.");
      date.focus();
      return;
    }

    const priority =
      document.querySelector('input[name="taskPriority"]:checked')?.value || "medium";

    const submitButton = form.querySelector('button[type="submit"]');
    if (submitButton) submitButton.disabled = true;

    try {
      await TaskFlowAPI.addTask({
        title: title.value.trim(),
        description: document.getElementById("taskDescription")?.value || "",
        dueDate: date.value,
        priority
      });

      showError("Task created successfully!");
      setTimeout(() => {
        window.location.href = "task-list.html";
      }, 500);
    } catch (error) {
      showError(error.message);
      if (submitButton) submitButton.disabled = false;
    }
  });
});
