document.addEventListener('DOMContentLoaded', async () => {
  "use strict";

  const api = window.TaskFlowAPI;
  const session = api?.getSession?.();
  if (!session || (session.role !== 'admin' && session.role !== 'master-admin')) {
    location.replace('index.html');
    return;
  }

  const $ = s => document.querySelector(s);
  const safe = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const date = v => v ? new Date(v).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

  let cachedTasks = [];

  async function loadTasks() {
    try {
      cachedTasks = await api.adminGetAllTasks();
      render();
    } catch (err) {
      console.error("Admin task overview error:", err);
      window.TaskFlowApp?.showToast?.(err.message || "Failed to load tasks", "error");
    }
  }

  function render() {
    const q = ($('#taskSearch')?.value || '').toLowerCase().trim();
    const st = $('#statusFilter')?.value || 'all';
    const pr = $('#priorityFilter')?.value || 'all';

    const rows = cachedTasks.filter(t => {
      const text = `${t.ownerName || ''} ${t.ownerEmail || ''} ${t.title || ''} ${t.description || ''}`.toLowerCase();
      const statusMatch = st === 'all' || String(t.status || 'pending').toLowerCase() === st;
      const priorityMatch = pr === 'all' || String(t.priority || 'medium').toLowerCase() === pr;
      return text.includes(q) && statusMatch && priorityMatch;
    });

    $('#taskTotal').textContent = `${rows.length} task${rows.length === 1 ? '' : 's'}`;
    const tbody = $('#adminTasksBody');
    if (!tbody) return;

    if (!rows.length) {
      tbody.innerHTML = '';
      $('#emptyState').hidden = false;
      return;
    }
    $('#emptyState').hidden = true;

    tbody.innerHTML = rows.map(t => {
      const status = String(t.status || 'pending').toLowerCase();
      const priority = String(t.priority || 'medium').toLowerCase();
      return `
        <tr>
          <td>
            <strong>${safe(t.ownerName || 'Unknown user')}</strong>
            <small class="task-owner-email">${safe(t.ownerEmail || '')}</small>
          </td>
          <td><strong>${safe(t.title || 'Untitled task')}</strong></td>
          <td class="task-description-cell">${safe(t.description || '—')}</td>
          <td>
            <span class="task-status-pill ${safe(status)}">
              ${safe(({ pending: 'Pending', in_progress: 'In progress', completed: 'Completed' })[status] || status)}
            </span>
          </td>
          <td>
            <span class="task-priority-pill ${safe(priority)}">
              ${safe(priority.charAt(0).toUpperCase() + priority.slice(1))}
            </span>
          </td>
          <td>${safe(date(t.dueDate))}</td>
          <td>${safe(date(t.createdAt))}</td>
        </tr>
      `;
    }).join('');

    window.lucide?.createIcons();
  }

  $('#taskSearch')?.addEventListener('input', render);
  $('#statusFilter')?.addEventListener('change', render);
  $('#priorityFilter')?.addEventListener('change', render);

  $('#hamburgerBtn')?.addEventListener('click', () => {
    $('#sidebar').classList.toggle('open');
    $('#sidebarOverlay').classList.toggle('active');
  });
  $('#sidebarOverlay')?.addEventListener('click', () => {
    $('#sidebar').classList.remove('open');
    $('#sidebarOverlay').classList.remove('active');
  });

  const n = session.name || 'Admin';
  $('#sidebarName').textContent = n;
  $('#sidebarAvatar').textContent = n.split(/\s+/).map(x => x[0]).slice(0, 2).join('').toUpperCase();

  $('#profileTrigger')?.addEventListener('click', () => {
    const open = $('#profileTrigger').getAttribute('aria-expanded') === 'true';
    $('#profileTrigger').setAttribute('aria-expanded', String(!open));
    $('#profileMenu').hidden = open;
    $('#profileMenu').classList.toggle('open', !open);
  });

  document.addEventListener('click', e => {
    if (!e.target.closest('.profile-menu-wrap')) {
      $('#profileMenu').hidden = true;
      $('#profileMenu').classList.remove('open');
      $('#profileTrigger')?.setAttribute('aria-expanded', 'false');
    }
  });

  $('#logoutTrigger')?.addEventListener('click', () => $('#logoutModalOverlay').classList.add('show'));
  $('#cancelLogoutBtn')?.addEventListener('click', () => $('#logoutModalOverlay').classList.remove('show'));
  $('#confirmLogoutBtn')?.addEventListener('click', () => api.logout());

  function clock() {
    const d = new Date();
    $('#currentDateDisplay').textContent = d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    $('#currentTimeDisplay').textContent = d.toLocaleTimeString();
  }
  clock();
  setInterval(clock, 1000);

  await loadTasks();
});
