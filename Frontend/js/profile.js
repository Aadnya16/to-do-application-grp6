document.addEventListener("DOMContentLoaded", async () => {
    const $ = id => document.getElementById(id);

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

    const profileForm = $("profileForm");
    const passwordForm = $("changePasswordForm");
    const nameInput = $("profileName");
    const emailInput = $("profileEmail");

    if (!profileForm || !passwordForm || !nameInput || !emailInput) {
        console.error("Profile form elements are missing.");
        return;
    }

    if (!TaskFlowAPI.getSession()) {
        location.replace("index.html");
        return;
    }

    // The profile always comes from the server, never from browser storage.
    let user;

    try {
        user = await TaskFlowAPI.getMe();
    } catch (error) {
        showMessage(error.message, "error");
        return;
    }

    const updateDisplay = () => {
        if ($("profileDisplayName")) $("profileDisplayName").textContent = user.name;
        if ($("profileDisplayEmail")) $("profileDisplayEmail").textContent = user.email;
        if ($("profileAvatar")) $("profileAvatar").textContent = getInitials(user.name);

        if ($("profileRole")) {
            $("profileRole").textContent =
                user.role === "admin" ? "Administrator" : "User";
        }

        if ($("profileStatus")) {
            $("profileStatus").textContent = "Active";
        }

        document.querySelectorAll(".user-name-display").forEach(element => {
            element.textContent = user.name;
        });

        document.querySelectorAll(".user-avatar-display").forEach(element => {
            element.textContent = getInitials(user.name);
        });
    };

    nameInput.value = user.name;
    emailInput.value = user.email;
    updateDisplay();

    // UPDATE PROFILE
    profileForm.addEventListener("submit", async event => {
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

        try {
            user = await TaskFlowAPI.updateProfile(name, email);
            updateDisplay();
            showMessage("Profile updated successfully!");
        } catch (error) {
            showMessage(error.message, "error");
        }
    });

    // RESET PROFILE FORM
    profileForm.addEventListener("reset", () => {
        setTimeout(() => {
            nameInput.value = user.name;
            emailInput.value = user.email;
        }, 0);
    });

    // CHANGE PASSWORD (the new password is hashed by the server)
    passwordForm.addEventListener("submit", async event => {
        event.preventDefault();

        const currentPassword = $("currentPassword").value;
        const newPassword = $("newPassword").value;
        const confirmPassword = $("confirmPassword").value;

        if (!currentPassword || !newPassword || !confirmPassword) {
            showMessage("Please fill in all password fields.", "error");
            return;
        }

        if (newPassword.length < 8 || !/[A-Za-z]/.test(newPassword) || !/\d/.test(newPassword)) {
            showMessage("New password needs 8+ characters with letters and numbers.", "error");
            return;
        }

        if (newPassword !== confirmPassword) {
            showMessage("New passwords do not match.", "error");
            return;
        }

        try {
            await TaskFlowAPI.changePassword(currentPassword, newPassword);
            passwordForm.reset();
            showMessage("Password changed successfully!");
        } catch (error) {
            showMessage(error.message, "error");
        }
    });
});
