/* ============================================================
   TASKFLOW — CENTRALIZED FRONTEND API SERVICE LAYER
   Production-ready API client connecting Frontend to FastAPI backend.
   Handles JWT authentication, requests, error handling, session lifecycle.
   ============================================================ */

(() => {
  "use strict";

  const API_BASE = String(window.TASKFLOW_API_BASE || "http://127.0.0.1:8000").replace(/\/$/, "");

  const STORAGE_KEYS = {
    TOKEN: "taskflow_access_token",
    SESSION: "taskflow_session",
    AUTH_INTENT: "taskflow_auth_intent",
    VERIFY_EMAIL: "taskflow_admin_verify_email"
  };

  // ---------- SESSION & TOKEN MANAGEMENT ----------
  function getToken() {
    return sessionStorage.getItem(STORAGE_KEYS.TOKEN);
  }

  function getSession() {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEYS.SESSION) || localStorage.getItem(STORAGE_KEYS.SESSION);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function saveSession(token, user) {
    sessionStorage.setItem(STORAGE_KEYS.TOKEN, token);
    localStorage.removeItem(STORAGE_KEYS.TOKEN); // migrate away from persistent JWT storage

    const sessionObj = {
      id: user.user_id,
      name: user.name,
      email: user.email,
      role: user.role === "master_admin" ? "master-admin" : user.role,
      status: user.status || "active"
    };

    const sessionStr = JSON.stringify(sessionObj);
    sessionStorage.setItem(STORAGE_KEYS.SESSION, sessionStr);
    localStorage.setItem(STORAGE_KEYS.SESSION, sessionStr);
    sessionStorage.setItem("taskflow_auth", "true");
    return sessionObj;
  }

  function updateSessionUser(user) {
    const existing = getSession() || {};
    const updated = {
      ...existing,
      name: user.name || existing.name,
      email: user.email || existing.email,
      role: (user.role === "master_admin" ? "master-admin" : user.role) || existing.role,
      status: user.status || existing.status
    };
    const str = JSON.stringify(updated);
    sessionStorage.setItem(STORAGE_KEYS.SESSION, str);
    localStorage.setItem(STORAGE_KEYS.SESSION, str);
    return updated;
  }

  function clearSession() {
    sessionStorage.removeItem(STORAGE_KEYS.TOKEN);
    localStorage.removeItem(STORAGE_KEYS.TOKEN);
    sessionStorage.removeItem(STORAGE_KEYS.SESSION);
    localStorage.removeItem(STORAGE_KEYS.SESSION);
    sessionStorage.removeItem("taskflow_auth");
    sessionStorage.removeItem(STORAGE_KEYS.VERIFY_EMAIL);
  }

  // ---------- HTTP REQUEST CLIENT ----------
  class ApiError extends Error {
    constructor(message, status = 0, data = null) {
      super(message);
      this.status = status;
      this.data = data;
    }
  }

  function parseErrorMessage(data, status) {
    if (!data) return `Request failed (HTTP ${status})`;
    if (typeof data.detail === "string") return data.detail;
    if (Array.isArray(data.detail)) {
      return data.detail
        .map(item => String(item.msg || "").replace(/^Value error,\s*/, ""))
        .filter(Boolean)
        .join(" ") || `Validation error (HTTP ${status})`;
    }
    if (data.message) return data.message;
    return `An error occurred (HTTP ${status})`;
  }

  async function request(endpoint, options = {}) {
    const { method = "GET", body = null, auth = true } = options;
    const url = `${API_BASE}${endpoint}`;

    const headers = {
      "Accept": "application/json"
    };

    if (body !== null && body !== undefined) {
      headers["Content-Type"] = "application/json";
    }

    if (auth) {
      const token = getToken();
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
    }

    let response;
    try {
      response = await fetch(url, {
        method,
        headers,
        body: body !== null && body !== undefined ? JSON.stringify(body) : undefined
      });
    } catch (err) {
      console.error("TaskFlow API Connection Error:", err);
      throw new ApiError(
        "Unable to connect to the TaskFlow server. Please verify the backend is running at " + API_BASE,
        0
      );
    }

    if (response.status === 204) {
      return null;
    }

    let data = null;
    try {
      data = await response.json();
    } catch {
      data = null;
    }

    if (!response.ok) {
      const errorMsg = parseErrorMessage(data, response.status);

      // Handle session expiration on protected requests
      if (response.status === 401 && auth) {
        clearSession();
        if (!location.pathname.endsWith("index.html") && !location.pathname.includes("login")) {
          location.replace("index.html");
        }
      }

      const err = new ApiError(errorMsg, response.status, data);
      throw err;
    }

    return data;
  }

  // ---------- AUTHENTICATION APIS ----------
  async function register(name, email, password) {
    const data = await request("/api/auth/register", {
      method: "POST",
      body: { name, email, password },
      auth: false
    });
    saveSession(data.access_token, data.user);
    return data.user;
  }

  async function registerAdmin(name, email, password, reason = "") {
    return await request("/api/auth/register-admin", {
      method: "POST",
      body: { name, email, password, reason },
      auth: false
    });
  }

  async function login(email, password) {
    const data = await request("/api/auth/login", {
      method: "POST",
      body: { email, password },
      auth: false
    });
    saveSession(data.access_token, data.user);
    return data.user;
  }

  async function verifyAdmin(email, password, code) {
    const data = await request("/api/auth/admin-verify", {
      method: "POST",
      body: { email, password, code },
      auth: false
    });
    saveSession(data.access_token, data.user);
    return data.user;
  }

  async function masterLogin(username, password) {
    const data = await request("/api/auth/master-admin/login", {
      method: "POST",
      body: { username, password },
      auth: false
    });
    saveSession(data.access_token, data.user);
    return data.user;
  }

  async function getMe() {
    const user = await request("/api/auth/me");
    updateSessionUser(user);
    return user;
  }

  async function updateProfile(name, email = null) {
    const body = {};
    if (name) body.name = name;
    if (email) body.email = email;
    const user = await request("/api/auth/me", { method: "PUT", body });
    updateSessionUser(user);
    return user;
  }

  async function changePassword(current_password, new_password) {
    return await request("/api/auth/change-password", {
      method: "POST",
      body: { current_password, new_password }
    });
  }

  function logout() {
    clearSession();
    location.replace("index.html");
  }

  // ---------- TASK APIS (Transforms to match UI fields) ----------
  function normalizeTask(t) {
    return {
      id: String(t.task_id),
      taskId: t.task_id,
      userId: t.user_id,
      categoryId: t.category_id,
      categoryName: t.category_name,
      title: t.title || "Untitled task",
      description: t.description || "",
      dueDate: t.due_date ? String(t.due_date).slice(0, 10) : "",
      priority: (t.priority || "medium").toLowerCase(),
      status: (t.status || "pending").toLowerCase(),
      createdAt: t.created_at || new Date().toISOString(),
      updatedAt: t.updated_at,
      completedAt: t.completed_at
    };
  }

  function toApiTaskPayload(data) {
    const payload = {};
    if ("title" in data) payload.title = data.title;
    if ("description" in data) payload.description = data.description || "";
    if ("dueDate" in data) payload.due_date = data.dueDate || null;
    if ("priority" in data) payload.priority = (data.priority || "medium").toLowerCase();
    if ("status" in data) payload.status = (data.status || "pending").toLowerCase();
    if ("categoryId" in data) payload.category_id = data.categoryId ? Number(data.categoryId) : null;
    return payload;
  }

  async function getTasks(filters = {}) {
    const params = new URLSearchParams();
    if (filters.status) params.append("status", filters.status);
    if (filters.priority) params.append("priority", filters.priority);
    if (filters.categoryId) params.append("category_id", filters.categoryId);
    if (filters.q) params.append("q", filters.q);
    if (filters.sort) params.append("sort", filters.sort);

    const query = params.toString() ? `?${params.toString()}` : "";
    const tasks = await request(`/api/tasks${query}`);
    return tasks.map(normalizeTask);
  }

  async function getTaskById(id) {
    const t = await request(`/api/tasks/${id}`);
    return normalizeTask(t);
  }

  async function createTask(data) {
    const t = await request("/api/tasks", {
      method: "POST",
      body: toApiTaskPayload(data)
    });
    return normalizeTask(t);
  }

  async function updateTask(id, updates) {
    const t = await request(`/api/tasks/${id}`, {
      method: "PUT",
      body: toApiTaskPayload(updates)
    });
    return normalizeTask(t);
  }

  async function deleteTask(id) {
    await request(`/api/tasks/${id}`, { method: "DELETE" });
    return true;
  }

  async function getTaskStats() {
    return await request("/api/tasks/stats/summary");
  }

  // ---------- CATEGORY APIS ----------
  async function getCategories() {
    return await request("/api/categories");
  }

  async function createCategory(name) {
    return await request("/api/categories", {
      method: "POST",
      body: { category_name: name }
    });
  }

  async function deleteCategory(id) {
    await request(`/api/categories/${id}`, { method: "DELETE" });
    return true;
  }

  // ---------- ADMIN APIS ----------
  async function adminGetOverview() {
    return await request("/api/admin/overview");
  }

  async function adminGetUsers() {
    return await request("/api/admin/users");
  }

  async function adminGetUserTasks(userId) {
    const tasks = await request(`/api/admin/users/${userId}/tasks`);
    return tasks.map(normalizeTask);
  }

  async function adminGetAllTasks(limit = 500) {
    const tasks = await request(`/api/admin/tasks?limit=${limit}`);
    return tasks.map(t => ({
      ...normalizeTask(t),
      ownerName: t.owner_name,
      ownerEmail: t.owner_email
    }));
  }

  // ---------- MASTER ADMIN APIS ----------
  async function masterGetOverview() {
    return await request("/api/master-admin/overview");
  }

  async function masterGetRequests() {
    return await request("/api/master-admin/requests");
  }

  async function masterApproveRequest(userId) {
    return await request(`/api/master-admin/requests/${userId}/approve`, { method: "POST" });
  }

  async function masterRejectRequest(userId) {
    return await request(`/api/master-admin/requests/${userId}/reject`, { method: "POST" });
  }

  async function masterGetAdmins() {
    return await request("/api/master-admin/administrators");
  }

  async function masterReissueCode(userId) {
    return await request(`/api/master-admin/administrators/${userId}/reissue-code`, { method: "POST" });
  }

  async function masterGetUsers() {
    return await request("/api/master-admin/users");
  }

  // Expose to window
  window.TaskFlowAPI = {
    API_BASE,
    STORAGE_KEYS,
    ApiError,
    getToken,
    getSession,
    saveSession,
    updateSessionUser,
    clearSession,
    // Auth
    register,
    registerAdmin,
    login,
    verifyAdmin,
    masterLogin,
    getMe,
    updateProfile,
    changePassword,
    logout,
    // Tasks
    getTasks,
    getTaskById,
    createTask,
    updateTask,
    deleteTask,
    getTaskStats,
    // Categories
    getCategories,
    createCategory,
    deleteCategory,
    // Admin
    adminGetOverview,
    adminGetUsers,
    adminGetUserTasks,
    adminGetAllTasks,
    // Master Admin
    masterGetOverview,
    masterGetRequests,
    masterApproveRequest,
    masterRejectRequest,
    masterGetAdmins,
    masterReissueCode,
    masterGetUsers
  };

})();
