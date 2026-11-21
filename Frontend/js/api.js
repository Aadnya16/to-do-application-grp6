/* =========================================
   TASKFLOW - API CLIENT
   Replaces the old localStorage mock store.
   All data and all authentication now live in the backend.
========================================= */
(function () {
    "use strict";

    // Change this when the backend is deployed (or set window.TASKFLOW_API_BASE before this script).
    const API_BASE = window.TASKFLOW_API_BASE || "http://127.0.0.1:8000";

    const TOKEN_KEY = "taskflow_token";
    const SESSION_KEY = "taskflow_session";

    // ---------- session (UI info only; the backend re-checks the token on every request) ----------
    function getToken() {
        return sessionStorage.getItem(TOKEN_KEY);
    }

    function getSession() {
        try {
            return JSON.parse(sessionStorage.getItem(SESSION_KEY) || "null");
        } catch {
            return null;
        }
    }

    function saveSession(token, user) {
        sessionStorage.setItem(TOKEN_KEY, token);
        setUser(user);
    }

    function setUser(user) {
        sessionStorage.setItem(SESSION_KEY, JSON.stringify({
            id: user.user_id,
            name: user.name,
            email: user.email,
            role: user.role
        }));
    }

    function clearSession() {
        sessionStorage.removeItem(TOKEN_KEY);
        sessionStorage.removeItem(SESSION_KEY);
        sessionStorage.removeItem("taskflow_auth");
    }

    // ---------- HTTP ----------
    class ApiError extends Error {
        constructor(message, status) {
            super(message);
            this.status = status;
        }
    }

    function errorMessage(data, fallback) {
        const detail = data && data.detail;
        if (typeof detail === "string") return detail;
        if (Array.isArray(detail)) {
            // FastAPI validation errors -> readable text
            return detail
                .map(item => String(item.msg || "").replace(/^Value error, /, ""))
                .filter(Boolean)
                .join(" ") || fallback;
        }
        return fallback;
    }

    async function request(path, { method = "GET", body, auth = true } = {}) {
        const headers = {};
        if (body !== undefined) headers["Content-Type"] = "application/json";

        if (auth) {
            const token = getToken();
            if (token) headers["Authorization"] = `Bearer ${token}`;
        }

        let response;
        try {
            response = await fetch(`${API_BASE}${path}`, {
                method,
                headers,
                body: body !== undefined ? JSON.stringify(body) : undefined
            });
        } catch {
            throw new ApiError("Cannot reach the server. Is the backend running?", 0);
        }

        if (response.status === 204) return null;

        let data = null;
        try {
            data = await response.json();
        } catch {
            data = null;
        }

        if (!response.ok) {
            // Expired / invalid token on a protected call -> back to login.
            if (response.status === 401 && auth) {
                clearSession();
                location.replace("login.html");
            }
            throw new ApiError(
                errorMessage(data, `Request failed (${response.status}).`),
                response.status
            );
        }

        return data;
    }

    // ---------- auth ----------
    async function login(email, password) {
        const data = await request("/api/auth/login", {
            method: "POST",
            body: { email, password },
            auth: false
        });
        saveSession(data.access_token, data.user);
        return data.user;
    }

    const register = (name, email, password) =>
        request("/api/auth/register", { method: "POST", body: { name, email, password }, auth: false });

    const registerAdmin = (name, email, password) =>
        request("/api/auth/register-admin", { method: "POST", body: { name, email, password }, auth: false });

    const getMe = () => request("/api/auth/me");

    async function updateProfile(name, email) {
        const user = await request("/api/auth/me", { method: "PUT", body: { name, email } });
        setUser(user);
        return user;
    }

    const changePassword = (current_password, new_password) =>
        request("/api/auth/change-password", {
            method: "POST",
            body: { current_password, new_password }
        });

    // ---------- tasks (backend shape <-> the shape the pages use) ----------
    const toTask = t => ({
        id: t.task_id,
        title: t.title,
        description: t.description || "",
        dueDate: t.due_date || "",
        priority: t.priority,
        status: t.status,
        createdAt: t.created_at
    });

    function toPayload(data) {
        const payload = {};
        if ("title" in data) payload.title = data.title;
        if ("description" in data) payload.description = data.description || null;
        if ("dueDate" in data) payload.due_date = data.dueDate || null;
        if ("priority" in data) payload.priority = data.priority;
        if ("status" in data) payload.status = data.status;
        return payload;
    }

    async function getTasks() {
        const tasks = await request("/api/tasks");
        return tasks.map(toTask);
    }

    async function addTask(data) {
        return toTask(await request("/api/tasks", { method: "POST", body: toPayload(data) }));
    }

    async function updateTask(id, updates) {
        return toTask(await request(`/api/tasks/${encodeURIComponent(id)}`, {
            method: "PUT",
            body: toPayload(updates)
        }));
    }

    const deleteTask = id =>
        request(`/api/tasks/${encodeURIComponent(id)}`, { method: "DELETE" });

    function computeStats(tasks) {
        const total = tasks.length;
        const count = status => tasks.filter(task => task.status === status).length;
        const completed = count("completed");

        return {
            total,
            pending: count("pending"),
            inProgress: count("in_progress"),
            completed,
            completionRate: total ? Math.round((completed / total) * 100) : 0
        };
    }

    // ---------- admin ----------
    const adminGetUsers = () => request("/api/admin/users");
    const adminGetTasks = () => request("/api/admin/tasks");
    const adminGetRequests = () => request("/api/admin/admin-requests");
    const adminDecide = (userId, action) =>
        request(`/api/admin/admin-requests/${encodeURIComponent(userId)}/${action}`, { method: "POST" });

    window.TaskFlowAPI = {
        ApiError,
        getSession, clearSession,
        login, register, registerAdmin, getMe, updateProfile, changePassword,
        getTasks, addTask, updateTask, deleteTask, computeStats,
        adminGetUsers, adminGetTasks, adminGetRequests, adminDecide
    };
})();
