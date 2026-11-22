(() => {
  "use strict";

  const api = window.TaskFlowAPI;
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
  const categorySelect = $('#taskCategory');
  const manageCategoriesBtn = $('#manageCategoriesBtn');

  async function loadCategories() {
    if (!categorySelect) return;
    try {
      const categories = await api.getCategories();
      categorySelect.innerHTML = '<option value="">No category</option>' + categories.map(c => `<option value="${c.category_id}">${escapeHtml(c.category_name)}</option>`).join('');
    } catch (err) { toast(err.message || 'Could not load categories.', 'error'); }
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  }

  manageCategoriesBtn?.addEventListener('click', async () => {
    const name = prompt('Enter a new category name:');
    if (!name || !name.trim()) return;
    try {
      await api.createCategory(name.trim());
      await loadCategories();
      categorySelect.value = [...categorySelect.options].find(o => o.text.toLowerCase() === name.trim().toLowerCase())?.value || '';
      toast('Category added.', 'success');
    } catch (err) { toast(err.message || 'Could not create category.', 'error'); }
  });

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
    if (window.TaskFlowApp?.showToast) {
      window.TaskFlowApp.showToast(message, type);
      return;
    }
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

  // Form submit -> Real backend API
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const taskTitle = title.value.trim();
    if (!taskTitle) {
      setTitleError('Please enter a task title.');
      title.focus();
      return;
    }
    setTitleError();

    const submitBtn = $('#createTaskBtn');
    const origHtml = submitBtn ? submitBtn.innerHTML : '';
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Creating task…';
    }

    try {
      await api.createTask({
        title: taskTitle,
        description: description.value.trim() || '',
        dueDate: dueDate.value || null,
        priority: document.querySelector('input[name="priority"]:checked')?.value || 'medium',
        status: 'pending',
        categoryId: categorySelect?.value || null
      });

      toast('Task created successfully!', 'success');
      form.reset();
      dueDate.value = '';
      if (categorySelect) categorySelect.value = '';
      const mediumRadio = document.querySelector('input[name="priority"][value="medium"]');
      if (mediumRadio) mediumRadio.checked = true;
      updatePreview();
      title.focus();
    } catch (err) {
      toast(err.message || 'Unable to create task on the server.', 'error');
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = origHtml;
        if (window.lucide) lucide.createIcons();
      }
    }
  });

  // Shell controls
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
  const session = api?.getSession?.();
  if (!session) {
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

  const profileTrigger = $('#profileTrigger');
  const profileMenu = $('#profileMenu');
  profileTrigger?.addEventListener('click', () => {
    const expanded = profileTrigger.getAttribute('aria-expanded') === 'true';
    profileTrigger.setAttribute('aria-expanded', String(!expanded));
    if (profileMenu) { profileMenu.hidden = expanded; profileMenu.classList.toggle('open', !expanded); }
  });
  document.addEventListener('click', event => {
    if (profileMenu && !profileMenu.hidden && !event.target.closest('.profile-menu-wrap')) {
      profileMenu.hidden = true;
      profileMenu.classList.remove('open');
      profileTrigger?.setAttribute('aria-expanded', 'false');
    }
  });

  const logoutModal = $('#logoutModalOverlay');
  document.querySelectorAll('.btn-logout-trigger').forEach(button => button.addEventListener('click', () => logoutModal?.classList.add('show')));
  $('#cancelLogoutBtn')?.addEventListener('click', () => logoutModal?.classList.remove('show'));
  $('#confirmLogoutBtn')?.addEventListener('click', () => api.logout());
  logoutModal?.addEventListener('click', event => { if (event.target === logoutModal) logoutModal.classList.remove('show'); });
  document.addEventListener('keydown', event => { if (event.key === 'Escape') { logoutModal?.classList.remove('show'); sidebar?.classList.remove('open'); overlay?.classList.remove('active'); } });

  loadCategories();
  const requestedDueDate = new URLSearchParams(location.search).get('dueDate');
  if (requestedDueDate && /^\d{4}-\d{2}-\d{2}$/.test(requestedDueDate)) dueDate.value = requestedDueDate;
  updatePreview();
  if (window.lucide) lucide.createIcons();
})();
