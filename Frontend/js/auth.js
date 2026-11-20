
document.addEventListener("DOMContentLoaded", () => {
  "use strict";

  const $ = id => document.getElementById(id);
  const USERS_KEY = "taskflow_users";

  const DEMO_ADMIN = {
    id: "taskflow-demo-admin",
    name: "TaskFlow Admin",
    email: "admin@taskflow.dev",
    password: "admin123",
    role: "admin",
    status: "active",
    isDemo: true,
    createdAt: "2026-01-01T00:00:00.000Z"
  };

  const DEMO_USER = {
    id: "taskflow-demo-user",
    name: "Demo User",
    email: "user@taskflow.dev",
    password: "user123",
    role: "user",
    status: "active",
    isDemo: true,
    createdAt: "2026-01-01T00:00:00.000Z"
  };

  const readUsers = () => {
    try {
      const value = JSON.parse(localStorage.getItem(USERS_KEY) || "[]");
      return Array.isArray(value) ? value : [];
    } catch {
      return [];
    }
  };

  const saveUsers = users =>
    localStorage.setItem(USERS_KEY, JSON.stringify(users));

  // Frontend demo accounts. Replace with securely provisioned backend accounts.
  function seedDemoAccounts() {
    const users = readUsers();
    let changed = false;

    if (!users.some(u => u.email?.toLowerCase() === DEMO_ADMIN.email)) {
      users.push(DEMO_ADMIN);
      changed = true;
    }

    if (!users.some(u => u.email?.toLowerCase() === DEMO_USER.email)) {
      users.push(DEMO_USER);
      changed = true;
    }

    if (changed) saveUsers(users);
  }

  seedDemoAccounts();

  const toast = (message, type = "success") => {
    if (window.TaskFlowApp?.showToast) {
      window.TaskFlowApp.showToast(message, type);
    } else {
      alert(message);
    }
  };

  const screens = [
    "loginForm",
    "registerForm",
    "adminRegisterForm",
    "pendingScreen"
  ];

  function showScreen(id) {
    screens.forEach(screenId => {
      const element = $(screenId);
      if (element) {
        element.style.display = screenId === id ? "block" : "none";
      }
    });
  }

  const setText = (id, value) => {
    if ($(id)) $(id).textContent = value;
  };

  const setError = (id, value) => setText(id, value);
  const clearErrors = ids => ids.forEach(id => setError(id, ""));
  const validEmail = value => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

  let currentRole = "user";

  function setTitle(title, subtitle) {
    setText("authAppTitle", title);
    setText("authSubtitle", subtitle);
  }

  function openLogin(role = "user") {
    currentRole = role;
    $("loginSelectedRole").value = role;

    showScreen("loginForm");

    setTitle(
      role === "admin" ? "TaskFlow Admin" : "TaskFlow",
      role === "admin"
        ? "Administrator Portal — Manage users and task progress."
        : "Welcome back! Please enter your details."
    );

    $("userRoleBtn").classList.toggle("active", role === "user");
    $("adminRoleBtn").classList.toggle("active", role === "admin");
    $("authCard").classList.toggle("admin-mode", role === "admin");

    $("loginEmailLabel").textContent =
      role === "admin" ? "Admin Email Address" : "User Email Address";

    $("loginEmail").placeholder =
      role === "admin" ? "admin@taskflow.dev" : "name@example.com";

    $("loginSubmitBtn").textContent =
      role === "admin" ? "Sign In as Admin" : "Sign In to TaskFlow";

    $("userRegisterSwitch").style.display =
      role === "user" ? "block" : "none";

    $("adminNoticeSwitch").style.display =
      role === "admin" ? "block" : "none";

    $("demoCredText").textContent =
      role === "admin"
        ? "Demo admin: admin@taskflow.dev / admin123"
        : "Demo user: user@taskflow.dev / user123";

    clearErrors(["loginEmailError", "loginPasswordError"]);
  }

  function openUserSignup() {
    showScreen("registerForm");
    setTitle("Create Account", "Join TaskFlow and organize your work.");
    clearErrors(["regNameError", "regEmailError", "regPasswordError"]);
  }

  function openAdminSignup() {
    showScreen("adminRegisterForm");
    setTitle("Admin Registration", "Request administrator access.");
    clearErrors([
      "adminRegNameError",
      "adminRegEmailError",
      "adminRegPasswordError"
    ]);
  }

  // Role selection
  $("userRoleBtn").addEventListener("click", () => openLogin("user"));
  $("adminRoleBtn").addEventListener("click", () => openLogin("admin"));

  // Demo autofill
  $("fillDemoBtn").addEventListener("click", () => {
    $("loginEmail").value =
      currentRole === "admin" ? DEMO_ADMIN.email : DEMO_USER.email;

    $("loginPassword").value =
      currentRole === "admin" ? DEMO_ADMIN.password : DEMO_USER.password;
  });

  // Navigation
  $("switchToRegister").addEventListener("click", event => {
    event.preventDefault();
    openUserSignup();
  });

  $("switchToLogin").addEventListener("click", event => {
    event.preventDefault();
    openLogin("user");
  });

  $("switchToAdminRegister").addEventListener("click", event => {
    event.preventDefault();
    openAdminSignup();
  });

  $("backToAdminLogin").addEventListener("click", event => {
    event.preventDefault();
    openLogin("admin");
  });

  $("pendingBackBtn").addEventListener("click", () => {
    openLogin("admin");
  });

  // Login
  $("loginForm").addEventListener("submit", event => {
    event.preventDefault();

    clearErrors(["loginEmailError", "loginPasswordError"]);

    const email = $("loginEmail").value.trim().toLowerCase();
    const password = $("loginPassword").value;

    if (!validEmail(email)) {
      setError("loginEmailError", "Enter a valid email address.");
      return;
    }

    if (!password) {
      setError("loginPasswordError", "Password is required.");
      return;
    }

    const user = readUsers().find(account =>
      account.email?.toLowerCase() === email &&
      account.password === password
    );

    if (!user) {
      setError("loginPasswordError", "Invalid email or password.");
      return;
    }

    if (currentRole === "admin") {
      if (user.role !== "admin" || user.status !== "active") {
        setError(
          "loginPasswordError",
          "Admin access is pending approval or has been rejected."
        );
        return;
      }

      sessionStorage.setItem("taskflow_session", JSON.stringify({
        id: user.id,
        name: user.name,
        email: user.email,
        role: "admin"
      }));

      location.href = "admin-dashboard.html";
      return;
    }

    if (user.role !== "user" || user.status !== "active") {
      setError(
        "loginPasswordError",
        "This account cannot access the user dashboard."
      );
      return;
    }

    sessionStorage.setItem("taskflow_session", JSON.stringify({
      id: user.id,
      name: user.name,
      email: user.email,
      role: "user"
    }));

    location.href = "dashboard.html";
  });

  // User registration
  $("registerForm").addEventListener("submit", event => {
    event.preventDefault();

    clearErrors(["regNameError", "regEmailError", "regPasswordError"]);

    const name = $("regName").value.trim();
    const email = $("regEmail").value.trim().toLowerCase();
    const password = $("regPassword").value;

    let invalid = false;

    if (name.length < 2) {
      setError("regNameError", "Enter your full name.");
      invalid = true;
    }

    if (!validEmail(email)) {
      setError("regEmailError", "Enter a valid email address.");
      invalid = true;
    }

    if (password.length < 6) {
      setError("regPasswordError", "Password must contain at least 6 characters.");
      invalid = true;
    }

    if (invalid) return;

    const users = readUsers();

    if (users.some(user => user.email?.toLowerCase() === email)) {
      setError("regEmailError", "This email is already registered.");
      return;
    }

    users.push({
      id: crypto.randomUUID ? crypto.randomUUID() : `user-${Date.now()}`,
      name,
      email,
      password,
      role: "user",
      status: "active",
      createdAt: new Date().toISOString()
    });

    saveUsers(users);
    $("registerForm").reset();

    toast("Account created. You can now sign in.");
    openLogin("user");
  });

  // Admin registration request
  $("adminRegisterForm").addEventListener("submit", event => {
    event.preventDefault();

    clearErrors([
      "adminRegNameError",
      "adminRegEmailError",
      "adminRegPasswordError"
    ]);

    const name = $("adminRegName").value.trim();
    const email = $("adminRegEmail").value.trim().toLowerCase();
    const password = $("adminRegPassword").value;

    let invalid = false;

    if (name.length < 2) {
      setError("adminRegNameError", "Enter your full name.");
      invalid = true;
    }

    if (!validEmail(email)) {
      setError("adminRegEmailError", "Enter a valid email address.");
      invalid = true;
    }

    if (password.length < 6) {
      setError("adminRegPasswordError", "Password must contain at least 6 characters.");
      invalid = true;
    }

    if (invalid) return;

    const users = readUsers();

    if (users.some(user => user.email?.toLowerCase() === email)) {
      setError("adminRegEmailError", "This email is already registered.");
      return;
    }

    users.push({
      id: crypto.randomUUID ? crypto.randomUUID() : `admin-request-${Date.now()}`,
      name,
      email,
      password,
      role: "pending_admin",
      status: "pending",
      createdAt: new Date().toISOString()
    });

    saveUsers(users);
    $("adminRegisterForm").reset();

    showScreen("pendingScreen");
    setTitle(
      "Request Submitted",
      "Your administrator request is awaiting approval."
    );
  });

  // Open the correct screen from URL
  const mode = new URLSearchParams(location.search).get("mode");

  if (mode === "admin-login") {
    openLogin("admin");
  } else if (mode === "admin-signup") {
    openAdminSignup();
  } else if (mode === "user-signup") {
    openUserSignup();
  } else {
    openLogin("user");
  }
});
