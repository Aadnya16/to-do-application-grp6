(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const api = window.TaskFlowAPI;
  const dateKey = (date) => {
    const d = new Date(date);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  };
  const parseDate = (value) => value ? new Date(`${value}T00:00:00`) : null;
  const isCompleted = (task) => String(task.status || '').toLowerCase() === 'completed';
  const priority = (task) => String(task.priority || 'medium').toLowerCase();
  const fmtDue = (date) => date ? date.toLocaleDateString(undefined, {month:'short', day:'numeric'}) : 'No due date';
  const safe = (value) => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));

  function renderIcons() {
    window.lucide?.createIcons();
  }

  function clock() {
    const now = new Date();
    $('currentDate').textContent = now.toLocaleDateString(undefined, {weekday:'long', year:'numeric', month:'long', day:'numeric'});
    $('currentTime').textContent = now.toLocaleTimeString(undefined, {hour:'2-digit', minute:'2-digit', second:'2-digit'});
    const hour = now.getHours();
    $('greetingTitle').textContent = `Good ${hour<12?'morning':hour<17?'afternoon':'evening'}, ${userName()}!`;
  }

  function sessionInfo() {
    return api?.getSession?.() || {};
  }

  function userName() {
    const s = sessionInfo();
    return s.name || 'there';
  }

  function setupProfile() {
    const s = sessionInfo();
    const name = s.name || 'TaskFlow User';
    const role = s.role === 'admin' ? 'Administrator' : 'TaskFlow User';
    $('userName').textContent = name;
    $('userRole').textContent = role;
    $('userAvatar').textContent = name.split(/\s+/).map(x => x[0]).slice(0, 2).join('').toUpperCase();

    $('profileTrigger')?.addEventListener('click', () => {
      const expanded = $('profileTrigger').getAttribute('aria-expanded') === 'true';
      $('profileTrigger').setAttribute('aria-expanded', String(!expanded));
      const menu = $('profileMenu');
      menu.hidden = expanded;
      menu.classList.toggle('open', !expanded);
    });

    $('profileMenuLink')?.addEventListener('click', () => {
      location.href = "profile.html";
    });

    document.addEventListener('click', e => {
      if (!e.target.closest('.sidebar-footer')) {
        $('profileMenu').hidden = true;
        $('profileMenu').classList.remove('open');
        $('profileTrigger').setAttribute('aria-expanded', 'false');
      }
    });
  }

  function due(task) {
    return parseDate(task.dueDate || task.due_date);
  }

  function overdue(task) {
    const d = due(task);
    return d && dateKey(d) < dateKey(new Date()) && !isCompleted(task);
  }

  function renderMetrics(all) {
    const done = all.filter(isCompleted).length;
    const inProgress = all.filter(t => String(t.status || '').toLowerCase() === 'in_progress').length;
    const over = all.filter(overdue).length;
    $('metricTotal').textContent = all.length;
    $('metricPending').textContent = inProgress;
    $('metricCompleted').textContent = done;
    $('metricOverdue').textContent = over;
  }

  function renderOverview(all) {
    const done = all.filter(isCompleted).length;
    const pending = all.filter(t => String(t.status || '').toLowerCase() === 'pending').length;
    const inProgress = all.filter(t => String(t.status || '').toLowerCase() === 'in_progress').length;
    const total = Math.max(1, all.length);
    const p1 = pending / total * 360;
    const p2 = (pending + inProgress) / total * 360;
    const colors = all.length
      ? `conic-gradient(#2563EB 0deg ${p1}deg,#6366F1 ${p1}deg ${p2}deg,#10B981 ${p2}deg 360deg)`
      : 'conic-gradient(#E5E7EB 0deg 360deg)';

    $('taskDonut').style.background = colors;
    $('donutTotal').textContent = all.length;
    $('chartLegend').innerHTML = `
      <div class="legend-row">
        <span class="legend-dot" style="background:#2563EB"></span>
        <span class="legend-label">Pending</span>
        <span class="legend-value">${pending} (${Math.round(pending/total*100)}%)</span>
      </div>
      <div class="legend-row">
        <span class="legend-dot" style="background:#6366F1"></span>
        <span class="legend-label">In progress</span>
        <span class="legend-value">${inProgress} (${Math.round(inProgress/total*100)}%)</span>
      </div>
      <div class="legend-row">
        <span class="legend-dot" style="background:#10B981"></span>
        <span class="legend-label">Completed</span>
        <span class="legend-value">${done} (${Math.round(done/total*100)}%)</span>
      </div>`;

    if (!all.length) {
      $('chartLegend').innerHTML = '<p class="upcoming-empty">Your task overview will appear here once you add tasks.</p>';
    }
  }

  function renderToday(all) {
    const dueToday = all.filter(t => due(t) && dateKey(due(t)) === dateKey(new Date()) && !isCompleted(t));
    $('todaySubtitle').textContent = `${dueToday.length} task${dueToday.length === 1 ? '' : 's'} scheduled for today`;
    const host = $('todayTasks');

    if (!dueToday.length) {
      host.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon"><i data-lucide="calendar-check"></i></div>
          <strong>Nothing scheduled for today</strong>
          <p>You're all caught up. Want to plan something?</p>
          <a class="btn btn-primary" href="add-task.html?dueDate=${dateKey(new Date())}" id="quickCreateToday">
            <i data-lucide="plus"></i>Create task
          </a>
        </div>`;
    } else {
      host.innerHTML = dueToday.slice(0, 4).map(t => `
        <div class="today-task-row">
          <span class="priority-line priority-${priority(t)}"></span>
          <input class="task-check" type="checkbox" aria-label="Complete ${safe(t.title)}" data-complete-id="${safe(t.id)}">
          <span class="today-title" title="${safe(t.title)}">${safe(t.title)}</span>
          <span class="priority-badge ${priority(t)}">${priority(t)[0].toUpperCase() + priority(t).slice(1)}</span>
          <span class="today-date"><i data-lucide="calendar"></i>Today</span>
        </div>`).join('');
    }
  }

  function renderUpcoming(all) {
    const upcoming = all.filter(t => !isCompleted(t) && due(t) && dateKey(due(t)) >= dateKey(new Date()))
      .sort((a, b) => due(a) - due(b)).slice(0, 4);
    const host = $('upcomingList');

    if (!upcoming.length) {
      host.innerHTML = '<p class="upcoming-empty">No upcoming deadlines. You have room to plan ahead.</p>';
      return;
    }

    host.innerHTML = upcoming.map(t => {
      const d = due(t);
      return `
        <div class="upcoming-row">
          <div class="deadline-date">
            <div class="month">${d.toLocaleDateString(undefined, {month:'short'})}</div>
            <div class="day">${d.getDate()}</div>
          </div>
          <div>
            <div class="deadline-title">${safe(t.title)}</div>
            <div class="deadline-due">${dateKey(d) === dateKey(new Date()) ? 'Due today' : fmtDue(d)}</div>
          </div>
          <span class="priority-badge ${priority(t)}">${priority(t)[0].toUpperCase() + priority(t).slice(1)}</span>
        </div>`;
    }).join('');
  }

  function renderActivity(all) {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      days.push(d);
    }

    const counts = days.map(d => {
      const key = dateKey(d);
      const created = all.filter(t => t.createdAt && dateKey(new Date(t.createdAt)) === key).length;
      const completed = all.filter(t => t.completedAt && dateKey(new Date(t.completedAt)) === key).length;
      return { day: d, created, completed };
    });

    const max = Math.max(1, ...counts.map(x => x.created + x.completed));
    $('weeklyChart').innerHTML = counts.map(x => {
      const cH = Math.max(0, x.created / max * 100);
      const dH = Math.max(0, x.completed / max * 100);
      return `
        <div class="chart-day">
          <div class="bar-stack">
            <div class="bar-created" style="height:${cH}%"></div>
            <div class="bar-completed" style="height:${dH}%"></div>
          </div>
          <span class="chart-day-label">${x.day.toLocaleDateString(undefined, {weekday:'short'})}</span>
        </div>`;
    }).join('');
  }

  async function refresh() {
    try {
      const all = await api.getTasks();
      renderMetrics(all);
      renderOverview(all);
      renderToday(all);
      renderUpcoming(all);
      renderActivity(all);
      renderIcons();
    } catch (err) {
      console.error("Dashboard refresh error:", err);
      window.TaskFlowApp?.showToast?.(err.message || "Failed to load tasks", "error");
    }
  }

  function setupSidebar() {
    const layout = $('appLayout');
    $('hamburgerBtn')?.addEventListener('click', () => {
      $('sidebar').classList.toggle('open');
      $('sidebarOverlay').classList.toggle('active');
    });
    $('sidebarOverlay')?.addEventListener('click', () => {
      $('sidebar').classList.remove('open');
      $('sidebarOverlay').classList.remove('active');
    });
  }

  document.addEventListener('change', async e => {
    const input = e.target.closest('[data-complete-id]');
    if (!input) return;
    try {
      const id = input.dataset.completeId;
      await api.updateTask(id, { status: 'completed' });
      await refresh();
      window.TaskFlowApp?.showToast?.('Task marked complete!', 'success');
    } catch (err) {
      window.TaskFlowApp?.showToast?.(err.message || 'Could not update task', 'error');
    }
  });

  document.addEventListener('DOMContentLoaded', () => {
    setupProfile();
    setupSidebar();
    clock();
    setInterval(clock, 1000);
    refresh();
  });
})();
