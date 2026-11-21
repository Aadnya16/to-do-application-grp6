(() => {
  "use strict";

  const api = window.TaskFlowAPI;
  const $ = (id) => document.getElementById(id);

  const initials = (name) => String(name || 'User').trim().split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase() || 'U';

  const normalizeRole = (role) => {
    const value = String(role || 'user').trim().toLowerCase().replace(/[_\s]+/g, '-');
    if (value === 'master-admin' || value === 'masteradmin' || value === 'master') return 'master-admin';
    if (value === 'admin' || value === 'administrator') return 'admin';
    return 'user';
  };

  const roleLabel = (role) => role === 'master-admin' ? 'Master Admin' : role === 'admin' ? 'Admin' : 'User';
  const roleIcon = (role) => role === 'master-admin' ? 'shield-check' : role === 'admin' ? 'shield' : 'user-round';

  const roleNav = (role) => {
    if (role === 'master-admin') return [
      { label: 'SYSTEM', items: [
        { title: 'System overview', href: 'master-admin-dashboard.html', icon: 'layout-dashboard' },
        { title: 'Admin requests', href: 'master-admin-dashboard.html#requests', icon: 'user-check' },
        { title: 'Administrators', href: 'master-admin-dashboard.html#administrators', icon: 'users' }
      ] },
      { label: 'ACCOUNT', items: [{ title: 'Profile', href: 'profile.html', icon: 'user-round', active: true }] }
    ];
    if (role === 'admin') return [
      { label: 'MAIN MENU', items: [
        { title: 'Admin Dashboard', href: 'admin-dashboard.html', icon: 'layout-dashboard' },
        { title: 'Task List', href: 'task-list.html', icon: 'list-checks' }
      ] },
      { label: 'ACCOUNT', items: [{ title: 'Profile', href: 'profile.html', icon: 'user-round', active: true }] }
    ];
    return [
      { label: 'MAIN MENU', items: [
        { title: 'Dashboard', href: 'dashboard.html', icon: 'layout-dashboard' },
        { title: 'Task List', href: 'task-list.html', icon: 'list-checks' },
        { title: 'Add Task', href: 'add-task.html', icon: 'square-plus' }
      ] },
      { label: 'ACCOUNT', items: [{ title: 'Profile', href: 'profile.html', icon: 'user-round', active: true }] }
    ];
  };

  function renderNav(role) {
    const host = $('sidebarNav');
    if (!host) return;
    host.innerHTML = roleNav(role).map(group => `
      <div class="nav-label">${group.label}</div>
      ${group.items.map(item => `
        <a href="${item.href}" class="nav-item${item.active ? ' active' : ''}"${item.active ? ' aria-current="page"' : ''}>
          <span class="nav-icon"><i data-lucide="${item.icon}"></i></span>
          <span class="nav-text">${item.title}</span>
        </a>
      `).join('')}
    `).join('');
  }

  function showToast(message, type = 'success') {
    const container = $('toastContainer');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('show'));
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 220);
    }, 2800);
  }

  function setStatus(status) {
    const active = String(status || 'active').toLowerCase() === 'active';
    const label = active ? 'Active' : 'Inactive';
    ['profileStatusChip', 'detailStatus'].forEach(id => {
      const chip = $(id);
      if (!chip) return;
      chip.classList.toggle('inactive', !active);
      const text = chip.querySelector('span:last-child');
      if (text) text.textContent = label;
    });
  }

  function setClock() {
    const now = new Date();
    $('currentDate').textContent = now.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    $('currentTime').textContent = now.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  function closeProfileMenu() {
    $('profileMenu').hidden = true;
    $('profileTrigger').setAttribute('aria-expanded', 'false');
  }

  function openLogoutModal() {
    const modal = $('logoutModalOverlay');
    modal.classList.add('show');
    modal.setAttribute('aria-hidden', 'false');
  }

  function closeLogoutModal() {
    const modal = $('logoutModalOverlay');
    modal.classList.remove('show');
    modal.setAttribute('aria-hidden', 'true');
  }

  async function init() {
    let session = api.getSession();
    if (!session || !api.getToken()) {
      location.replace('index.html');
      return;
    }

    try {
      // Sync with real backend
      const currentUser = await api.getMe();
      session = api.updateSessionUser(currentUser);
    } catch (err) {
      console.warn("Could not sync profile with backend:", err);
    }

    const name = session.name || 'User';
    const email = session.email || 'user@example.com';
    const role = normalizeRole(session.role);
    const label = roleLabel(role);
    const avatar = initials(name);
    const accountStatus = session.status || 'active';

    renderNav(role);
    document.title = `TaskFlow — Profile (${label})`;
    $('profileName').textContent = name;
    $('profileEmail').textContent = email;
    $('profileAvatar').textContent = avatar;
    $('profileRoleChip').innerHTML = `<i data-lucide="${roleIcon(role)}"></i><span>${label}</span>`;
    $('detailName').textContent = name;
    $('detailEmail').textContent = email;
    $('detailRole').textContent = label;
    $('sidebarName').textContent = name;
    $('sidebarRole').textContent = label;
    $('sidebarAvatar').textContent = avatar;
    setStatus(accountStatus);

    if ($('editName')) $('editName').value = name;

    // Handle Profile & Password updates via backend API
    $('updateProfileForm')?.addEventListener('submit', async event => {
      event.preventDefault();
      const updatedName = $('editName').value.trim();
      const currentPassword = $('currentPassword')?.value;
      const newPassword = $('editPassword')?.value;
      const confirmPassword = $('editConfirm')?.value;

      if (!updatedName) {
        showToast('Please enter your full name.', 'error');
        return;
      }

      if (newPassword) {
        if (!currentPassword) { showToast('Please enter your current password to set a new password.', 'error'); return; }
        if (newPassword.length < 8) { showToast('New password must be at least 8 characters.', 'error'); return; }
        if (newPassword !== confirmPassword) { showToast('New passwords do not match.', 'error'); return; }
      }

      const saveBtn = $('saveProfileBtn');
      const origHtml = saveBtn ? saveBtn.innerHTML : '';
      if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.textContent = 'Saving changes…';
      }

      try {
        // 1. Update Name if changed
        if (updatedName !== session.name) {
          const updatedUser = await api.updateProfile(updatedName);
          session = api.updateSessionUser(updatedUser);
          $('profileName').textContent = updatedName;
          $('detailName').textContent = updatedName;
          $('sidebarName').textContent = updatedName;
          const newAvatar = initials(updatedName);
          $('profileAvatar').textContent = newAvatar;
          $('sidebarAvatar').textContent = newAvatar;
        }

        // 2. Change password if provided
        if (newPassword) {
          await api.changePassword(currentPassword, newPassword);
          $('currentPassword').value = '';
          $('editPassword').value = '';
          $('editConfirm').value = '';
        }

        showToast('Profile updated successfully!', 'success');
      } catch (err) {
        showToast(err.message || 'Failed to update profile.', 'error');
      } finally {
        if (saveBtn) {
          saveBtn.disabled = false;
          saveBtn.innerHTML = origHtml;
          window.lucide?.createIcons();
        }
      }
    });

    window.lucide?.createIcons();
    setClock();
    setInterval(setClock, 1000);

    $('profileTrigger')?.addEventListener('click', () => {
      const isOpen = $('profileTrigger').getAttribute('aria-expanded') === 'true';
      $('profileTrigger').setAttribute('aria-expanded', String(!isOpen));
      $('profileMenu').hidden = isOpen;
    });

    document.addEventListener('click', event => {
      if (!event.target.closest('.profile-menu-wrap')) closeProfileMenu();
    });

    $('logoutTrigger')?.addEventListener('click', () => { closeProfileMenu(); openLogoutModal(); });
    $('cancelLogoutBtn')?.addEventListener('click', closeLogoutModal);
    $('logoutModalOverlay')?.addEventListener('click', event => { if (event.target === $('logoutModalOverlay')) closeLogoutModal(); });
    $('confirmLogoutBtn')?.addEventListener('click', () => api.logout());

    $('sidebarCollapseBtn')?.addEventListener('click', () => $('appLayout').classList.toggle('sidebar-collapsed'));
    $('hamburgerBtn')?.addEventListener('click', () => { $('sidebar').classList.toggle('open'); $('sidebarOverlay').classList.toggle('active'); });
    $('sidebarOverlay')?.addEventListener('click', () => { $('sidebar').classList.remove('open'); $('sidebarOverlay').classList.remove('active'); });
  }

  document.addEventListener('DOMContentLoaded', init);
})();
