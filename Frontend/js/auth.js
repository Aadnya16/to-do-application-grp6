/* ============================================================
   TASKFLOW — AUTHENTICATION CONTROLLER
   Connects all registration, login, verification, and role routing
   to the real TaskFlow backend API.
   ============================================================ */

(() => {
  "use strict";

  const api = window.TaskFlowAPI;
  if (!api) {
    console.error("TaskFlowAPI is required for authentication.");
    return;
  }

  const $ = selector => document.querySelector(selector);

  function showNotice(message, type = "success") {
    const el = $("#notice");
    if (!el) return;
    el.textContent = message;
    el.className = `notice show ${type}`;
  }

  function setButtonLoading(btn, isLoading, loadingText = "Please wait…") {
    if (!btn) return;
    if (isLoading) {
      btn.dataset.origText = btn.textContent;
      btn.textContent = loadingText;
      btn.disabled = true;
    } else {
      btn.textContent = btn.dataset.origText || "Submit";
      btn.disabled = false;
    }
  }

  // ---------- ROUTING HELPER ----------
  function routeUser(user) {
    const role = (user.role || "").toLowerCase().replace(/[_\s]+/g, "-");
    if (role === "master-admin" || role === "masteradmin") {
      location.replace("master-admin-dashboard.html");
    } else if (role === "admin") {
      location.replace("admin-dashboard.html");
    } else {
      location.replace("dashboard.html");
    }
  }

  // ---------- FORM HANDLERS ----------
  async function handleUserRegister(form) {
    const name = form.querySelector("#name")?.value.trim();
    const email = form.querySelector("#email")?.value.trim().toLowerCase();
    const password = form.querySelector("#password")?.value;
    const confirm = form.querySelector("#confirm")?.value;
    const submitBtn = form.querySelector("button[type='submit'], .primary-btn");

    if (password !== confirm) {
      showNotice("Passwords do not match.", "error");
      return;
    }

    try {
      setButtonLoading(submitBtn, true, "Creating account…");
      const user = await api.register(name, email, password);
      showNotice("Account created successfully! Redirecting to dashboard…", "success");
      setTimeout(() => routeUser(user), 800);
    } catch (err) {
      showNotice(err.message, "error");
    } finally {
      setButtonLoading(submitBtn, false);
    }
  }

  async function handleAdminRegister(form) {
    const name = form.querySelector("#name")?.value.trim();
    const email = form.querySelector("#email")?.value.trim().toLowerCase();
    const password = form.querySelector("#password")?.value;
    const confirm = form.querySelector("#confirm")?.value;
    const reason = form.querySelector("#reason")?.value.trim() || "";
    const submitBtn = form.querySelector("button[type='submit'], .primary-btn");

    if (password !== confirm) {
      showNotice("Passwords do not match.", "error");
      return;
    }

    try {
      setButtonLoading(submitBtn, true, "Submitting request…");
      const res = await api.registerAdmin(name, email, password, reason);
      const followUp = res.email_sent ? " Master Admin notification email sent." : " Master Admin can review the request from the dashboard (email notification is not configured).";
      showNotice((res.message || "Administrator access request submitted.") + followUp, "success");
      form.reset();
    } catch (err) {
      showNotice(err.message, "error");
    } finally {
      setButtonLoading(submitBtn, false);
    }
  }

  async function handleUserLogin(form) {
    const email = form.querySelector("#email")?.value.trim().toLowerCase();
    const password = form.querySelector("#password")?.value;
    const submitBtn = form.querySelector("button[type='submit'], .primary-btn");

    try {
      setButtonLoading(submitBtn, true, "Signing in…");
      const user = await api.login(email, password);
      if (user.role !== "user") {
        showNotice("This login is for regular users. Please use Administrator login.", "error");
        api.clearSession();
        return;
      }
      showNotice("Sign-in successful! Loading your tasks…", "success");
      setTimeout(() => routeUser(user), 600);
    } catch (err) {
      showNotice(err.message, "error");
    } finally {
      setButtonLoading(submitBtn, false);
    }
  }

  async function handleAdminLogin(form) {
    const email = form.querySelector("#email")?.value.trim().toLowerCase();
    const password = form.querySelector("#password")?.value;
    const submitBtn = form.querySelector("button[type='submit'], .primary-btn");

    try {
      setButtonLoading(submitBtn, true, "Signing in…");
      const user = await api.login(email, password);
      if (user.role !== "admin") {
        showNotice("This login is for administrators. Please use User login.", "error");
        api.clearSession();
        return;
      }
      showNotice("Administrator access granted! Redirecting…", "success");
      setTimeout(() => routeUser(user), 600);
    } catch (err) {
      if (err.message && err.message.toLowerCase().includes("verification code")) {
        sessionStorage.setItem("taskflow_admin_verify_email", email);
        showNotice("Your request has been approved! Redirecting to complete verification…", "warning");
        setTimeout(() => location.href = "admin-verify.html", 1000);
        return;
      }
      showNotice(err.message, err.status === 403 ? "warning" : "error");
    } finally {
      setButtonLoading(submitBtn, false);
    }
  }

  async function handleAdminVerify(form) {
    const email = form.querySelector("#email")?.value.trim().toLowerCase();
    const password = form.querySelector("#password")?.value;
    const code = form.querySelector("#code")?.value.trim();
    const submitBtn = form.querySelector("button[type='submit'], .primary-btn");

    try {
      setButtonLoading(submitBtn, true, "Verifying…");
      const user = await api.verifyAdmin(email, password, code);
      showNotice("Verification successful! Administrator account activated.", "success");
      setTimeout(() => routeUser(user), 800);
    } catch (err) {
      showNotice(err.message, "error");
    } finally {
      setButtonLoading(submitBtn, false);
    }
  }

  async function handleMasterLogin(form) {
    const username = form.querySelector("#username")?.value.trim().toLowerCase();
    const password = form.querySelector("#password")?.value;
    const submitBtn = form.querySelector("button[type='submit'], .primary-btn");

    try {
      setButtonLoading(submitBtn, true, "Authenticating…");
      const user = await api.masterLogin(username, password);
      showNotice("Master Admin authenticated. Redirecting…", "success");
      setTimeout(() => routeUser(user), 600);
    } catch (err) {
      showNotice(err.message, "error");
    } finally {
      setButtonLoading(submitBtn, false);
    }
  }

  // Pre-fill email on verification page if available
  document.addEventListener("DOMContentLoaded", () => {
    if (location.pathname.includes("admin-verify.html")) {
      const email = sessionStorage.getItem("taskflow_admin_verify_email");
      if (email && $("#email")) {
        $("#email").value = email;
      }
    }

    // Bind all auth forms
    document.querySelectorAll("[data-auth-form], form").forEach(form => {
      const formType = form.dataset.authForm || form.id;
      if (!formType) return;

      form.addEventListener("submit", event => {
        event.preventDefault();
        if (formType === "user-register") handleUserRegister(form);
        else if (formType === "admin-register") handleAdminRegister(form);
        else if (formType === "user-login") handleUserLogin(form);
        else if (formType === "admin-login") handleAdminLogin(form);
        else if (formType === "admin-verify") handleAdminVerify(form);
        else if (formType === "master-login") handleMasterLogin(form);
      });
    });
  });

  window.TaskFlowAuth = {
    showNotice,
    routeUser
  };
})();
