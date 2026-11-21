
/* =========================================
   TASKFLOW - TEMPORARY FRONTEND DATA STORE
   User-specific task storage for frontend testing.
   Will later be replaced by backend API calls.
========================================= */

(function () {
    "use strict";

    const STORAGE_KEY = "taskflow_tasks";

    // Get currently logged-in user
    function getSession() {
        try {
            return JSON.parse(
                sessionStorage.getItem("taskflow_session") || "null"
            );
        } catch {
            return null;
        }
    }

    function getCurrentOwner() {
        const session = getSession();

        if (!session) return null;

        return {
            email: (session.email || "").trim().toLowerCase(),
            role: session.role
        };
    }

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

    // Admin sees all tasks; users see only their own.
    function getVisibleTasks() {
        const owner = getCurrentOwner();

        if (!owner || !owner.email) return [];

        const tasks = readTasks();

        if (owner.role === "admin") {
            return tasks;
        }

        return tasks.filter(task =>
            (task.ownerEmail || "").toLowerCase() === owner.email
        );
    }

    function getTasks() {
        return getVisibleTasks().sort((a, b) =>
            new Date(b.createdAt) - new Date(a.createdAt)
        );
    }

    function getTaskById(id) {
        return getVisibleTasks().find(task => task.id === id) || null;
    }

    function addTask(data) {
        const owner = getCurrentOwner();

        if (!owner || owner.role !== "user" || !owner.email) {
            console.error("A logged-in user is required to create tasks.");
            return null;
        }

        const tasks = readTasks();

        const task = {
            id: createId(),
            ownerEmail: owner.email,
            title: (data.title || "").trim(),
            description: data.description?.trim() || "",
            dueDate: data.dueDate || "",
            priority: (data.priority || "medium").toLowerCase(),
            status: data.status || "pending",
            createdAt: new Date().toISOString()
        };

        tasks.push(task);
        writeTasks(tasks);

        return task;
    }

    function updateTask(id, updates) {
        const tasks = readTasks();
        const owner = getCurrentOwner();

        if (!owner || !owner.email) return null;

        const index = tasks.findIndex(task => {
            if (task.id !== id) return false;

            return owner.role === "admin" ||
                (task.ownerEmail || "").toLowerCase() === owner.email;
        });

        if (index === -1) return null;

        const safeUpdates = { ...updates };

        // Never allow changing task ownership or identity.
        delete safeUpdates.id;
        delete safeUpdates.ownerEmail;

        tasks[index] = {
            ...tasks[index],
            ...safeUpdates,
            id: tasks[index].id,
            ownerEmail: tasks[index].ownerEmail
        };

        writeTasks(tasks);

        return tasks[index];
    }

    function deleteTask(id) {
        const tasks = readTasks();
        const owner = getCurrentOwner();

        if (!owner || !owner.email) return false;

        const index = tasks.findIndex(task => {
            if (task.id !== id) return false;

            return owner.role === "admin" ||
                (task.ownerEmail || "").toLowerCase() === owner.email;
        });

        if (index === -1) return false;

        tasks.splice(index, 1);
        writeTasks(tasks);

        return true;
    }

    function getStats() {
        const tasks = getVisibleTasks();

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
