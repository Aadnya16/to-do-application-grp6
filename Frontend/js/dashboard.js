
document.addEventListener("DOMContentLoaded", () => {
  if (!window.TaskFlowStore) return;

  const stats = TaskFlowStore.getStats();
  const session = JSON.parse(sessionStorage.getItem("taskflow_session") || "{}");

  const set = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  };

  set("welcomeUserName", session.name || "User");
  set("statTotalTasks", stats.total);
  set("statPendingTasks", stats.pending);
  set("statCompletedTasks", stats.completed);
  set("statCompletionRate", `${stats.completionRate}%`);
  set("dashboardProgressText", `${stats.completionRate}%`);
  set("dashboardProgressDesc", `${stats.completed} of ${stats.total} tasks completed`);

  const progress = document.getElementById("dashboardProgressFill");
  if (progress) progress.style.width = `${stats.completionRate}%`;

  const list = document.getElementById("recentTasksList");
  if (list) {
    const tasks = TaskFlowStore.getTasks().slice(0, 5);
    list.replaceChildren();

    if (!tasks.length) {
      list.textContent = "No tasks yet. Add your first task!";
    } else {
      tasks.forEach(task => {
        const item = document.createElement("div");
        item.className = "recent-task-item";
        const title = document.createElement("span");
        title.textContent = task.title;
        const status = document.createElement("span");
        status.textContent = task.status.replace("_", " ");
        item.append(title, status);
        list.appendChild(item);
      });
    }
  }
});
