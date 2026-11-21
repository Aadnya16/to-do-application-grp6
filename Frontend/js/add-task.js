(() => {
  const $ = (selector) => document.querySelector(selector);
  const form = $('#addTaskForm');
  const title = $('#taskTitle');
  const description = $('#taskDescription');
  const dueDate = $('#taskDueDate');
  const titleError = $('#titleError');
  const titleCount = $('#titleCount');
  const descriptionCount = $('#descriptionCount');
  const previewTitle = $('#previewTitle');
  const previewDescription = $('#previewDescription');
  const previewDue = $('#previewDue');
  const previewPriority = $('#previewPriority');

  const getTodayLocal = () => {
    const now = new Date();
    return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  };

  function updatePreview() {
    const trimmedTitle = title.value.trim();
    const trimmedDescription = description.value.trim();
    const priority = document.querySelector('input[name="priority"]:checked')?.value || 'medium';
    previewTitle.textContent = trimmedTitle || 'Your task title';
    previewDescription.textContent = trimmedDescription || 'Your description will appear here.';
    previewPriority.className = `preview-priority ${priority}`;
    previewPriority.innerHTML = `<span class="priority-dot"></span>${priority.charAt(0).toUpperCase() + priority.slice(1)} priority`;
    if (dueDate.value) {
      const parsed = new Date(`${dueDate.value}T00:00:00`);
      previewDue.innerHTML = `<i data-lucide="calendar"></i>${parsed.toLocaleDateString(undefined, {day:'numeric',month:'short',year:'numeric'})}`;
    } else {
      previewDue.innerHTML = '<i data-lucide="calendar"></i>No due date';
    }
    if (window.lucide) lucide.createIcons();
    titleCount.textContent = `${title.value.length} / 100`;
    descriptionCount.textContent = `${description.value.length} / 500`;
  }

  function setTitleError(message = '') {
    titleError.textContent = message;
    titleError.classList.toggle('show', Boolean(message));
    title.classList.toggle('error', Boolean(message));
  }

  function toast(message, type = 'success') {
    const container = $('#toastContainer');
    if (!container) return;
    const item = document.createElement('div');
    item.className = `toast ${type}`;
    item.textContent = message;
    container.appendChild(item);
    setTimeout(() => item.classList.add('show'), 10);
    setTimeout(() => { item.classList.add('removing'); setTimeout(() => item.remove(), 300); }, 3200);
  }

  title.addEventListener('input', () => {
    if (title.value.trim()) setTitleError();
    updatePreview();
  });
  description.addEventListener('input', updatePreview);
  dueDate.addEventListener('change', updatePreview);
  document.querySelectorAll('input[name="priority"]').forEach(input => input.addEventListener('change', updatePreview));

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const taskTitle = title.value.trim();
    if (!taskTitle) {
      setTitleError('Please enter a task title.');
      title.focus();
      return;
    }
    setTitleError();

    if (!window.TaskFlowStore || typeof TaskFlowStore.addTask !== 'function') {
      toast('Task storage is unavailable. Please refresh and try again.', 'error');
      return;
    }

    const created = TaskFlowStore.addTask({
      title: taskTitle,
      description: description.value.trim(),
      dueDate: dueDate.value,
      priority: document.querySelector('input[name="priority"]:checked')?.value || 'medium',
      status: 'pending'
    });

    if (!created) {
      toast('Unable to create task. Please make sure you are logged in as a User.', 'error');
      return;
    }

    toast('Task created successfully!', 'success');
    form.reset();
    dueDate.value = '';
    document.querySelector('input[name="priority"][value="medium"]').checked = true;
    updatePreview();
    title.focus();
  });

  // Set up the page shell: date/time, sidebar, profile dropdown, logout modal.
  function updateClock() {
    const now = new Date();
    const dateEl = $('#currentDate');
    const timeEl = $('#currentTime');
    if (dateEl) dateEl.textContent = now.toLocaleDateString(undefined, {weekday:'short',month:'short',day:'numeric',year:'numeric'});
    if (timeEl) timeEl.textContent = now.toLocaleTimeString(undefined, {hour:'2-digit',minute:'2-digit',second:'2-digit'});
  }
  updateClock();
  setInterval(updateClock, 1000);

  const sidebar = $('#sidebar');
  const overlay = $('#sidebarOverlay');
  const session = (() => { try { return JSON.parse(sessionStorage.getItem('taskflow_session') || 'null'); } catch { return null; } })();
  if (!session || session.role !== 'user') {
    location.replace('index.html');
    return;
  }
  const sessionName = session.name || 'User';
  const initials = sessionName.trim().split(/\s+/).map(part => part[0]).slice(0, 2).join('').toUpperCase();
  document.querySelectorAll('.user-name-display').forEach(el => el.textContent = sessionName);
  document.querySelectorAll('.user-avatar-display').forEach(el => el.textContent = initials || 'U');
  document.querySelectorAll('.user-role-display').forEach(el => el.textContent = 'User');
  $('#hamburgerBtn')?.addEventListener('click', () => { sidebar?.classList.toggle('open'); overlay?.classList.toggle('active'); });
  overlay?.addEventListener('click', () => { sidebar?.classList.remove('open'); overlay?.classList.remove('active'); });

  const appLayout = $('#appLayout');
  const collapseBtn = $('#sidebarCollapseBtn');
  if (localStorage.getItem('taskflow_sidebar_collapsed') === 'true') appLayout?.classList.add('sidebar-collapsed');
  collapseBtn?.addEventListener('click', () => {
    appLayout?.classList.toggle('sidebar-collapsed');
    localStorage.setItem('taskflow_sidebar_collapsed', appLayout?.classList.contains('sidebar-collapsed') ? 'true' : 'false');
  });

  const profileTrigger = $('#profileTrigger');
  const profileMenu = $('#profileMenu');
  profileTrigger?.addEventListener('click', () => {
    const expanded = profileTrigger.getAttribute('aria-expanded') === 'true';
    profileTrigger.setAttribute('aria-expanded', String(!expanded));
    if (profileMenu) profileMenu.hidden = expanded;
  });
  document.addEventListener('click', event => {
    if (profileMenu && !profileMenu.hidden && !event.target.closest('.profile-menu-wrap')) {
      profileMenu.hidden = true;
      profileTrigger?.setAttribute('aria-expanded', 'false');
    }
  });

  const logoutModal = $('#logoutModalOverlay');
  document.querySelectorAll('.btn-logout-trigger').forEach(button => button.addEventListener('click', () => logoutModal?.classList.add('show')));
  $('#cancelLogoutBtn')?.addEventListener('click', () => logoutModal?.classList.remove('show'));
  $('#confirmLogoutBtn')?.addEventListener('click', () => {
    sessionStorage.removeItem('taskflow_session');
    sessionStorage.removeItem('taskflow_auth');
    localStorage.removeItem('taskflow_session');
    location.href = 'index.html';
  });
  logoutModal?.addEventListener('click', event => { if (event.target === logoutModal) logoutModal.classList.remove('show'); });
  document.addEventListener('keydown', event => { if (event.key === 'Escape') { logoutModal?.classList.remove('show'); sidebar?.classList.remove('open'); overlay?.classList.remove('active'); } });

  updatePreview();
  if (window.lucide) lucide.createIcons();
})();
