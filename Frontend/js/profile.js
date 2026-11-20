
document.addEventListener("DOMContentLoaded", () => {
    const $ = id => document.getElementById(id);

    // Session belongs in sessionStorage, not localStorage.
    const readSession = () => {
        try {
            return JSON.parse(sessionStorage.getItem("taskflow_session") || "null");
        } catch {
            return null;
        }
    };

    const readUsers = () => {
        try {
            return JSON.parse(localStorage.getItem("taskflow_users") || "[]");
        } catch {
            return [];
        }
    };

    const showMessage = (message, type = "success") => {
        if (window.TaskFlowApp?.showToast) {
            window.TaskFlowApp.showToast(message, type);
        } else {
            alert(message);
        }
    };

    const getInitials = name =>
        (name || "User")
            .trim()
            .split(/\s+/)
            .map(part => part[0])
            .slice(0, 2)
            .join("")
            .toUpperCase();

    const session = readSession();

    if (!session || !["user", "admin"].includes(session.role)) {
        location.replace("index.html");
        return;
    }

    const profileForm = $("profileForm");
    const passwordForm = $("changePasswordForm");
    const nameInput = $("profileName");
    const emailInput = $("profileEmail");

    if (!profileForm || !passwordForm || !nameInput || !emailInput) {
        console.error("Profile form elements are missing.");
        return;
    }

    let users = readUsers();

    const getCurrentUserIndex = () =>
        users.findIndex(user =>
            user.email?.toLowerCase() === session.email?.toLowerCase() &&
            user.role === session.role &&
            user.status === "active"
        );

    let currentIndex = getCurrentUserIndex();

    if (currentIndex === -1) {
        sessionStorage.removeItem("taskflow_session");
        location.replace("login.html?mode=user-login");
        return;
    }

    const updateDisplay = () => {
        const name = session.name || "User";

        if ($("profileDisplayName")) {
            $("profileDisplayName").textContent = name;
        }

        if ($("profileDisplayEmail")) {
            $("profileDisplayEmail").textContent = session.email;
        }

        if ($("profileAvatar")) {
            $("profileAvatar").textContent = getInitials(name);
        }

        if ($("profileRole")) {
            $("profileRole").textContent =
                session.role === "admin" ? "Administrator" : "User";
        }

        if ($("profileStatus")) {
            $("profileStatus").textContent = "Active";
        }

        document.querySelectorAll(".user-name-display").forEach(element => {
            element.textContent = name;
        });

        document.querySelectorAll(".user-avatar-display").forEach(element => {
            element.textContent = getInitials(name);
        });

        // Also update any sidebar elements using these common classes.
    };

    // Load the actual logged-in account.
    const currentUser = users[currentIndex];

    session.name = currentUser.name;
    session.email = currentUser.email;

    sessionStorage.setItem("taskflow_session", JSON.stringify(session));

    nameInput.value = currentUser.name || "";
    emailInput.value = currentUser.email || "";

    updateDisplay();

    // UPDATE PROFILE
    profileForm.addEventListener("submit", event => {
        event.preventDefault();

        const name = nameInput.value.trim();
        const email = emailInput.value.trim().toLowerCase();

        if (name.length < 2) {
            showMessage("Name must contain at least 2 characters.", "error");
            return;
        }

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            showMessage("Enter a valid email address.", "error");
            return;
        }

        users = readUsers();
        currentIndex = getCurrentUserIndex();

        if (currentIndex === -1) {
            showMessage("Account not found. Please log in again.", "error");
            return;
        }

        const oldEmail = users[currentIndex].email;

        const duplicateEmail = users.some((user, index) =>
            index !== currentIndex &&
            user.email?.toLowerCase() === email
        );

        if (duplicateEmail) {
            showMessage("This email is already registered.", "error");
            return;
        }

        users[currentIndex].name = name;
        users[currentIndex].email = email;

        localStorage.setItem("taskflow_users", JSON.stringify(users));

        // Preserve task ownership if the user changes their email.
        if (oldEmail.toLowerCase() !== email) {
            try {
                const tasks = JSON.parse(
                    localStorage.getItem("taskflow_tasks") || "[]"
                );

                tasks.forEach(task => {
                    if (task.ownerEmail?.toLowerCase() === oldEmail.toLowerCase()) {
                        task.ownerEmail = email;
                    }
                });

                localStorage.setItem("taskflow_tasks", JSON.stringify(tasks));
            } catch (error) {
                console.error("Could not update task ownership:", error);
            }
        }

        session.name = name;
        session.email = email;

        sessionStorage.setItem("taskflow_session", JSON.stringify(session));

        updateDisplay();
        showMessage("Profile updated successfully!");
    });

    // RESET PROFILE FORM
    profileForm.addEventListener("reset", () => {
        setTimeout(() => {
            nameInput.value = session.name || "";
            emailInput.value = session.email || "";
        }, 0);
    });

    // CHANGE PASSWORD
    passwordForm.addEventListener("submit", event => {
        event.preventDefault();

        const currentPassword = $("currentPassword").value;
        const newPassword = $("newPassword").value;
        const confirmPassword = $("confirmPassword").value;

        if (!currentPassword || !newPassword || !confirmPassword) {
            showMessage("Please fill in all password fields.", "error");
            return;
        }

        users = readUsers();
        currentIndex = getCurrentUserIndex();

        if (currentIndex === -1) {
            showMessage("Account not found.", "error");
            return;
        }

        const user = users[currentIndex];

        if (user.password !== currentPassword) {
            showMessage("Current password is incorrect.", "error");
            return;
        }

        if (newPassword.length < 6) {
            showMessage("New password must contain at least 6 characters.", "error");
            return;
        }

        if (newPassword !== confirmPassword) {
            showMessage("New passwords do not match.", "error");
            return;
        }

        if (newPassword === currentPassword) {
            showMessage("Choose a different password.", "error");
            return;
        }

        user.password = newPassword;

        localStorage.setItem("taskflow_users", JSON.stringify(users));

        passwordForm.reset();
        showMessage("Password changed successfully!");
    });
});
