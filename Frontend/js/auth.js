
document.addEventListener("DOMContentLoaded", () => {
  "use strict";

  const $ = id => document.getElementById(id);
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

  // Same rules as the backend (the backend re-checks everything).
  const passwordProblem = value => {
    if (value.length < 8) return "Password must contain at least 8 characters.";
    if (!/[A-Za-z]/.test(value) || !/\d/.test(value)) {
      return "Password must contain both letters and numbers.";
    }
    return "";
  };

  const busy = (form, isBusy) => {
    const button = form.querySelector('button[type="submit"]');
    if (button) button.disabled = isBusy;
  };

  // Login
  $("loginForm").addEventListener("submit", async event => {
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

    busy($("loginForm"), true);

    try {
      // The backend checks the bcrypt hash and returns a signed token.
      const user = await TaskFlowAPI.login(email, password);

      if (user.role !== currentRole) {
        TaskFlowAPI.clearSession();
        setError(
          "loginPasswordError",
          currentRole === "admin"
            ? "This account is not an administrator."
            : "This account cannot access the user dashboard."
        );
        return;
      }

      location.href = user.role === "admin"
        ? "admin-dashboard.html"
        : "dashboard.html";
    } catch (error) {
      setError("loginPasswordError", error.message);
    } finally {
      busy($("loginForm"), false);
    }
  });

  // User registration
  $("registerForm").addEventListener("submit", async event => {
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

    const problem = passwordProblem(password);
    if (problem) {
      setError("regPasswordError", problem);
      invalid = true;
    }

    if (invalid) return;

    busy($("registerForm"), true);

    try {
      await TaskFlowAPI.register(name, email, password);
      $("registerForm").reset();
      toast("Account created. You can now sign in.");
      openLogin("user");
    } catch (error) {
      setError(error.status === 409 ? "regEmailError" : "regPasswordError", error.message);
    } finally {
      busy($("registerForm"), false);
    }
  });

  // Admin registration request (stays "pending" until an admin approves it)
  $("adminRegisterForm").addEventListener("submit", async event => {
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

    const problem = passwordProblem(password);
    if (problem) {
      setError("adminRegPasswordError", problem);
      invalid = true;
    }

    if (invalid) return;

    busy($("adminRegisterForm"), true);

    try {
      await TaskFlowAPI.registerAdmin(name, email, password);
      $("adminRegisterForm").reset();

      showScreen("pendingScreen");
      setTitle(
        "Request Submitted",
        "Your administrator request is awaiting approval."
      );
    } catch (error) {
      setError(error.status === 409 ? "adminRegEmailError" : "adminRegPasswordError", error.message);
    } finally {
      busy($("adminRegisterForm"), false);
    }
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
