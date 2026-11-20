
/* =========================================
   TASKFLOW - TEMPORARY FRONTEND DATA STORE
   This is for frontend testing only.
   It will later be replaced by backend API calls.
========================================= */

(function () {
  "use strict";

  const STORAGE_KEY = "taskflow_tasks";

  function readTasks() {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error("Could not read tasks:", error);
      return [];
    }
  }

  function writeTasks(tasks) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  }

  function createId() {
    if (window.crypto && crypto.randomUUID) {
      return crypto.randomUUID();
    }

    return `task-${Date.now()}-${Math.random()
      .toString(16)
      .slice(2)}`;
  }

  function getTasks() {
    return readTasks().sort((a, b) => {
      return new Date(b.createdAt) - new Date(a.createdAt);
    });
  }

  function getTaskById(id) {
    return readTasks().find(task => task.id === id) || null;
  }

  function addTask(data) {
    const tasks = readTasks();

    const task = {
      id: createId(),
      title: data.title.trim(),
      description: data.description?.trim() || "",
      dueDate: data.dueDate || "",
      priority: (data.priority || "medium").toLowerCase(),
      status: "pending",
      createdAt: new Date().toISOString()
    };

    tasks.push(task);
    writeTasks(tasks);

    return task;
  }

  function updateTask(id, updates) {
    const tasks = readTasks();
    const index = tasks.findIndex(task => task.id === id);

    if (index === -1) return null;

    tasks[index] = {
      ...tasks[index],
      ...updates,
      id: tasks[index].id
    };

    writeTasks(tasks);
    return tasks[index];
  }

  function deleteTask(id) {
    const tasks = readTasks();
    const updatedTasks = tasks.filter(task => task.id !== id);

    if (updatedTasks.length === tasks.length) {
      return false;
    }

    writeTasks(updatedTasks);
    return true;
  }

  function getStats() {
    const tasks = readTasks();

    const total = tasks.length;
    const pending = tasks.filter(
      task => task.status === "pending"
    ).length;
    const inProgress = tasks.filter(
      task => task.status === "in_progress"
    ).length;
    const completed = tasks.filter(
      task => task.status === "completed"
    ).length;

    return {
      total,
      pending,
      inProgress,
      completed,
      completionRate: total
        ? Math.round((completed / total) * 100)
        : 0
    };
  }

  window.TaskFlowStore = {
    getTasks,
    getTaskById,
    addTask,
    updateTask,
    deleteTask,
    getStats
  };
})();
