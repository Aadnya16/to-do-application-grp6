
(() => {
  const $ = id => document.getElementById(id);

  const getUsers = () => {
    try {
      return JSON.parse(localStorage.getItem("taskflow_users") || "[]");
    } catch {
      return [];
    }
  };

  const saveUsers = users => {
    localStorage.setItem("taskflow_users", JSON.stringify(users));
  };

  function showError(id, message) {
    const element = $(id);
    if (element) element.textContent = message;
  }

  function clearErrors() {
    [
      "loginEmailError",
      "loginPasswordError",
      "regNameError",
      "regEmailError",
      "regPasswordError"
    ].forEach(id => showError(id, ""));
  }

  document.addEventListener("DOMContentLoaded", () => {
    const loginForm = $("loginForm");
    const registerForm = $("registerForm");

    if (!loginForm || !registerForm) return;

    const roleInput = $("loginSelectedRole");

    function getRole() {
      return roleInput?.value || "user";
    }

    function switchForm(showRegister) {
      loginForm.style.display = showRegister ? "none" : "block";
      registerForm.style.display = showRegister ? "block" : "none";

      if ($("authTabsContainer")) {
        $("authTabsContainer").style.display =
          getRole() === "admin" || showRegister ? "none" : "flex";
      }

      clearErrors();
    }

    $("switchToRegister")?.addEventListener("click", event => {
      event.preventDefault();
      if (getRole() === "user") switchForm(true);
    });

    $("switchToLogin")?.addEventListener("click", event => {
      event.preventDefault();
      switchForm(false);
    });

    $("loginTabBtn")?.addEventListener("click", () => switchForm(false));
    $("registerTabBtn")?.addEventListener("click", () => {
      if (getRole() === "user") switchForm(true);
    });

    // Demo credentials autofill
    $("fillDemoBtn")?.addEventListener("click", () => {
      const admin = getRole() === "admin";

      $("loginEmail").value = admin
        ? "admin@taskflow.dev"
        : "vrunda.dilip@taskflow.dev";

      $("loginPassword").value = admin ? "admin123" : "123456";
      clearErrors();
    });

    // LOGIN
    loginForm.addEventListener("submit", event => {
      event.preventDefault();
      clearErrors();

      const email = $("loginEmail").value.trim().toLowerCase();
      const password = $("loginPassword").value;
      const role = getRole();

      let valid = true;

      if (!email) {
        showError("loginEmailError", "Email is required.");
        valid = false;
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        showError("loginEmailError", "Enter a valid email address.");
        valid = false;
      }

      if (!password) {
        showError("loginPasswordError", "Password is required.");
        valid = false;
      }

      if (!valid) return;

      let user = null;

      if (role === "admin") {
        if (
          email === "admin@taskflow.dev" &&
          password === "admin123"
        ) {
          user = {
            name: "Administrator",
            email,
            role: "admin"
          };
        }
      } else {
        user = getUsers().find(
          u => u.email === email && u.password === password
        );

        // Demo user
        if (
          !user &&
          email === "vrunda.dilip@taskflow.dev" &&
          password === "123456"
        ) {
          user = {
            name: "Vrunda Dilip",
            email,
            role: "user"
          };
        }
      }

      if (!user) {
        showError("loginPasswordError", "Invalid email or password.");
        return;
      }

      const session = {
        name: user.name,
        email: user.email,
        role: user.role
      };

      sessionStorage.setItem(
        "taskflow_session",
        JSON.stringify(session)
      );

      sessionStorage.setItem(
        "taskflow_auth",
        JSON.stringify({
          isLoggedIn: true,
          email: user.email,
          role: user.role
        })
      );

      window.location.href =
        role === "admin" ? "admin-dashboard.html" : "dashboard.html";
    });

    // REGISTRATION
    registerForm.addEventListener("submit", event => {
      event.preventDefault();
      clearErrors();

      const name = $("regName").value.trim();
      const email = $("regEmail").value.trim().toLowerCase();
      const password = $("regPassword").value;

      let valid = true;

      if (name.length < 2) {
        showError("regNameError", "Enter your full name.");
        valid = false;
      }

      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        showError("regEmailError", "Enter a valid email address.");
        valid = false;
      }

      if (password.length < 6) {
        showError(
          "regPasswordError",
          "Password must contain at least 6 characters."
        );
        valid = false;
      }

      if (!valid) return;

      const users = getUsers();

      if (users.some(user => user.email === email)) {
        showError(
          "regEmailError",
          "An account with this email already exists."
        );
        return;
      }

      users.push({
        name,
        email,
        password,
        role: "user"
      });

      saveUsers(users);

      window.TaskFlowApp?.showToast("Account created. Please sign in.");

      switchForm(false);
      $("loginEmail").value = email;
      $("loginPassword").value = "";
    });
  });
})();
