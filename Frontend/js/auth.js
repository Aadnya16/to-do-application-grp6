
document.addEventListener("DOMContentLoaded", () => {
    "use strict";

    const $ = id => document.getElementById(id);

    // Local storage helpers
    const readUsers = () => {
        try {
            return JSON.parse(
                localStorage.getItem("taskflow_users") || "[]"
            );
        } catch {
            return [];
        }
    };

    const saveUsers = users => {
        localStorage.setItem("taskflow_users", JSON.stringify(users));
    };

    // Toast notification
    const showToast = (message, type = "success") => {
        if (window.TaskFlowApp?.showToast) {
            window.TaskFlowApp.showToast(message, type);
        } else {
            alert(message);
        }
    };

    // Screen management
    const screens = [
        "loginForm",
        "registerForm",
        "adminRegisterForm",
        "pendingScreen",
        "adminOtpForm"
    ];

    const showScreen = screenId => {
        screens.forEach(id => {
            const element = $(id);

            if (element) {
                element.style.display =
                    id === screenId ? "block" : "none";
            }
        });
    };

    const setTitle = (title, subtitle) => {
        $("authTitle").textContent = title;
        $("authSubtitle").textContent = subtitle;
    };

    // Correct email validation
    const emailOK = email =>
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

    const setError = (id, message) => {
        if ($(id)) {
            $(id).textContent = message;
        }
    };

    const clearErrors = ids => {
        ids.forEach(id => setError(id, ""));
    };

    const params = new URLSearchParams(location.search);

    let loginRole = "user";

    // LOGIN SCREEN
    const openLogin = role => {
        loginRole = role;

        $("loginSelectedRole").value = role;

        showScreen("loginForm");

        setTitle(
            role === "admin" ? "TaskFlow Admin" : "TaskFlow",
            role === "admin"
                ? "Sign in to your administrator account."
                : "Welcome back! Sign in to continue."
        );

        $("loginSwitch").style.display =
            role === "user" ? "block" : "none";

        $("adminRegisterSwitch").style.display =
            role === "admin" ? "block" : "none";

        clearErrors([
            "loginEmailError",
            "loginPasswordError",
            "adminOtpError"
        ]);
    };

    // USER REGISTRATION SCREEN
    const openUserSignup = () => {
        showScreen("registerForm");

        setTitle(
            "Create Account",
            "Join TaskFlow today."
        );

        clearErrors([
            "regNameError",
            "regEmailError",
            "regPasswordError"
        ]);
    };

    // ADMIN REGISTRATION SCREEN
    const openAdminSignup = () => {
        showScreen("adminRegisterForm");

        setTitle(
            "Admin Registration",
            "Request administrator access."
        );
    };

    // NAVIGATION EVENTS
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

    // LOGIN
    $("loginForm").addEventListener("submit", event => {
        event.preventDefault();

        clearErrors([
            "loginEmailError",
            "loginPasswordError"
        ]);

        const email = $("loginEmail").value.trim().toLowerCase();
        const password = $("loginPassword").value;

        if (!emailOK(email)) {
            setError(
                "loginEmailError",
                "Enter a valid email address."
            );
            return;
        }

        if (!password) {
            setError(
                "loginPasswordError",
                "Password is required."
            );
            return;
        }

        const users = readUsers();

        const user = users.find(account =>
            account.email === email &&
            account.password === password
        );

        if (!user) {
            setError(
                "loginPasswordError",
                "Invalid email or password."
            );
            return;
        }

        // ADMIN LOGIN
        if (loginRole === "admin") {
            if (
                user.role !== "admin" ||
                user.status !== "active"
            ) {
                setError(
                    "loginPasswordError",
                    "Your administrator account is not approved."
                );
                return;
            }

            sessionStorage.setItem(
                "taskflow_pending_admin_email",
                email
            );

            showScreen("adminOtpForm");

            setTitle(
                "Admin Verification",
                "Enter your email verification code."
            );

            return;
        }

        // USER LOGIN
        if (
            user.role !== "user" ||
            user.status !== "active"
        ) {
            setError(
                "loginPasswordError",
                "This account cannot access the user dashboard."
            );
            return;
        }

        sessionStorage.setItem(
            "taskflow_session",
            JSON.stringify({
                name: user.name,
                email: user.email,
                role: "user"
            })
        );

        location.href = "dashboard.html";
    });

    // USER REGISTRATION
    $("registerForm").addEventListener("submit", event => {
        event.preventDefault();

        clearErrors([
            "regNameError",
            "regEmailError",
            "regPasswordError"
        ]);

        const name = $("regName").value.trim();
        const email = $("regEmail").value.trim().toLowerCase();
        const password = $("regPassword").value;

        let invalid = false;

        if (name.length < 2) {
            setError("regNameError", "Enter your full name.");
            invalid = true;
        }

        if (!emailOK(email)) {
            setError("regEmailError", "Enter a valid email address.");
            invalid = true;
        }

        if (password.length < 6) {
            setError(
                "regPasswordError",
                "Password must contain at least 6 characters."
            );
            invalid = true;
        }

        if (invalid) return;

        const users = readUsers();

        if (users.some(user => user.email === email)) {
            setError(
                "regEmailError",
                "This email is already registered."
            );
            return;
        }

        users.push({
            id: crypto.randomUUID
                ? crypto.randomUUID()
                : String(Date.now()),
            name,
            email,
            password,
            role: "user",
            status: "active",
            createdAt: new Date().toISOString()
        });

        saveUsers(users);

        $("registerForm").reset();

        showToast("Account created successfully. Please sign in.");

        openLogin("user");
    });

    // ADMIN REGISTRATION REQUEST
    $("adminRegisterForm").addEventListener("submit", event => {
        event.preventDefault();

        const name = $("adminRegName").value.trim();
        const email = $("adminRegEmail").value.trim().toLowerCase();
        const password = $("adminRegPassword").value;

        if (name.length < 2) {
            showToast("Enter your full name.", "error");
            return;
        }

        if (!emailOK(email)) {
            showToast("Enter a valid email address.", "error");
            return;
        }

        if (password.length < 6) {
            showToast(
                "Password must contain at least 6 characters.",
                "error"
            );
            return;
        }

        const users = readUsers();

        if (users.some(user => user.email === email)) {
            showToast(
                "This email is already registered.",
                "error"
            );
            return;
        }

        users.push({
            id: crypto.randomUUID
                ? crypto.randomUUID()
                : String(Date.now()),
            name,
            email,
            password,
            role: "pending_admin",
            status: "pending",
            createdAt: new Date().toISOString()
        });

        saveUsers(users);

        sessionStorage.setItem(
            "taskflow_pending_admin_email",
            email
        );

        $("adminRegisterForm").reset();

        showScreen("pendingScreen");

        setTitle(
            "Request Submitted",
            "Your administrator request has been submitted."
        );
    });

    // ADMIN OTP
    $("adminOtpForm").addEventListener("submit", event => {
        event.preventDefault();

        const otp = $("adminOtp").value.trim();

        if (!/^\d{6}$/.test(otp)) {
            setError(
                "adminOtpError",
                "Enter a valid 6-digit code."
            );
            return;
        }

        setError(
            "adminOtpError",
            "OTP verification requires backend integration."
        );
    });

    // INITIAL SCREEN BASED ON URL
    const mode = params.get("mode") || "user-login";

    if (mode === "user-signup") {
        openUserSignup();
    } else if (mode === "admin-login") {
        openLogin("admin");
    } else if (mode === "admin-signup") {
        openAdminSignup();
    } else if (mode === "admin-pending") {
        showScreen("pendingScreen");

        setTitle(
            "Request Submitted",
            "Your administrator request is pending approval."
        );
    } else {
        openLogin("user");
    }
});
