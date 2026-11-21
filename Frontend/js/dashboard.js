
document.addEventListener("DOMContentLoaded", async () => {
  if (!window.TaskFlowAPI) {
    console.error("TaskFlowAPI is not available.");
    return;
  }

  const session = TaskFlowAPI.getSession() || {};

  let allTasks = [];

  try {
    allTasks = await TaskFlowAPI.getTasks();
  } catch (error) {
    window.TaskFlowApp?.showToast(error.message, "error");
  }

  const setText = (id, value) => {
    const element = document.getElementById(id);

    if (element) {
      element.textContent = value;
    }
  };

  // UPDATE DASHBOARD STATISTICS
  const renderStatistics = () => {
    const stats = TaskFlowAPI.computeStats(allTasks);

    setText("welcomeUserName", session.name || "User");

    setText("statTotalTasks", stats.total);
    setText("statPendingTasks", stats.pending);
    setText("statCompletedTasks", stats.completed);
    setText("statCompletionRate", `${stats.completionRate}%`);

    setText(
      "dashboardProgressBadge",
      `${stats.completionRate}% Complete`
    );

    setText(
      "dashboardProgressText",
      `${stats.completionRate}%`
    );

    setText(
      "dashboardProgressDesc",
      `${stats.completed} of ${stats.total} tasks completed`
    );

    const progress = document.getElementById(
      "dashboardProgressFill"
    );

    if (progress) {
      const percentage = Math.min(
        100,
        Math.max(0, Number(stats.completionRate) || 0)
      );

      progress.style.width = `${percentage}%`;
      progress.setAttribute("aria-valuenow", percentage);
    }
  };

  // RENDER RECENT TASKS
  const renderRecentTasks = () => {
    const list = document.getElementById("recentTasksList");

    if (!list) return;

    const priorityFilter = document.getElementById(
      "recentPriorityFilter"
    );

    const selectedPriority = priorityFilter
      ? priorityFilter.value.toLowerCase()
      : "all";

    // FILTER TASKS BY PRIORITY
    const filteredTasks = allTasks.filter(task => {
      if (selectedPriority === "all") {
        return true;
      }

      const taskPriority = String(
        task.priority || "medium"
      ).toLowerCase();

      return taskPriority === selectedPriority;
    });

    // SHOW LATEST FIVE MATCHING TASKS
    const recentTasks = filteredTasks.slice(0, 5);

    list.replaceChildren();

    if (recentTasks.length === 0) {
      const emptyMessage = document.createElement("p");

      emptyMessage.className = "recent-tasks-empty";

      emptyMessage.textContent =
        selectedPriority === "all"
          ? "No tasks yet. Add your first task!"
          : `No ${selectedPriority}-priority tasks found.`;

      list.appendChild(emptyMessage);
      return;
    }

    recentTasks.forEach(task => {
      const item = document.createElement("div");

      item.className = "recent-task-item";

      // TASK TITLE
      const title = document.createElement("span");

      title.className = "recent-task-title";
      title.textContent = task.title || "Untitled Task";

      // TASK DETAILS
      const details = document.createElement("div");

      details.className = "recent-task-details";

      // PRIORITY BADGE
      const priority = document.createElement("span");

      const priorityValue = String(
        task.priority || "medium"
      ).toLowerCase();

      const validPriorities = ["high", "medium", "low"];

      const safePriority = validPriorities.includes(priorityValue)
        ? priorityValue
        : "medium";

      priority.className =
        `task-priority priority-${safePriority}`;

      priority.textContent =
        safePriority.charAt(0).toUpperCase() +
        safePriority.slice(1);

      // STATUS BADGE
      const status = document.createElement("span");

      status.className = "recent-task-status";

      status.textContent = String(
        task.status || "pending"
      ).replace(/_/g, " ");

      details.append(priority, status);

      item.append(title, details);

      list.appendChild(item);
    });
  };

  // PRIORITY FILTER EVENT LISTENER
  const priorityFilter = document.getElementById(
    "recentPriorityFilter"
  );

  if (priorityFilter) {
    priorityFilter.addEventListener("change", renderRecentTasks);
  }

  // INITIAL RENDER
  renderStatistics();
  renderRecentTasks();
});
