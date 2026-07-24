import './styles.css';

const storageKeys = {
  page: 'molenaar-page',
  focus: 'molenaar-focus',
  tasks: 'molenaar-tasks',
  note: 'molenaar-note',
  compactTasks: 'molenaar-compact-tasks',
  apiBaseUrl: 'molenaar-api-base-url'
};

const pages = ['home', 'tasks', 'notes', 'projects', 'members', 'settings'];

const databaseConfig = {
  name: 'molenaar-app-db',
  version: 1,
  stores: {
    projects: 'projects',
    members: 'members'
  }
};

const defaultTasks = [
  { id: crypto.randomUUID(), text: 'Check today\'s top priority', done: false },
  { id: crypto.randomUUID(), text: 'Review schedule', done: true },
  { id: crypto.randomUUID(), text: 'Capture new ideas', done: false }
];

const app = document.querySelector('#app');

let tasks = loadJson(storageKeys.tasks, defaultTasks);
let projects = [];
let members = [];
let deferredInstallPrompt;
let currentPage = loadInitialPage();
let dbPromise;

window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
  updateInstallUi();
});

window.addEventListener('appinstalled', () => {
  deferredInstallPrompt = undefined;
  updateInstallUi('Installed. You can launch Molenaar Companion from your home screen or app list.');
});

init();

async function init() {
  await loadDatabaseState();
  renderApp();
  registerServiceWorker();
}

async function loadDatabaseState() {
  try {
    projects = await fetchProjects();
    members = await fetchMembers();
  } catch {
    projects = [];
    members = [];
  }
}

function renderApp() {
  app.innerHTML = `
    <main class="shell">
      <section class="hero card">
        <div>
          <p class="eyebrow">Installable Web App</p>
          <h1>Molenaar Companion</h1>
          <p class="lede">A responsive workspace with separate pages for your day, tasks, notes, and app settings.</p>
        </div>
        <div class="hero-actions">
          <button id="install-button" class="primary" hidden>Install app</button>
          <p id="install-hint" class="hint">Open this app in Chrome, Edge, or Safari and use the install/share option to add it to your device.</p>
        </div>
      </section>

      <nav class="page-nav" aria-label="App pages">
        <button type="button" class="page-link" data-page="home">Home</button>
        <button type="button" class="page-link" data-page="tasks">Tasks</button>
        <button type="button" class="page-link" data-page="notes">Notes</button>
        <button type="button" class="page-link" data-page="projects">Projects</button>
        <button type="button" class="page-link" data-page="members">Peloton Members</button>
        <button type="button" class="page-link" data-page="settings">Settings</button>
      </nav>

      <section class="pages" data-pages>
        <section class="page" data-page-panel="home">
          <div class="grid">
            <article class="card panel accent-panel">
              <p class="eyebrow">Today</p>
              <label class="field-label" for="focus-input">Main focus</label>
              <input id="focus-input" class="text-input" type="text" maxlength="120" placeholder="What matters most today?" />
              <p class="hint">Saved locally on this device.</p>
            </article>

            <article class="card panel">
              <div class="panel-header">
                <div>
                  <p class="eyebrow">Snapshot</p>
                  <h2>Today at a glance</h2>
                </div>
              </div>
              <div class="stat-grid">
                <div class="stat-card">
                  <p class="stat-label">Open tasks</p>
                  <p id="open-count" class="stat-value">0</p>
                </div>
                <div class="stat-card">
                  <p class="stat-label">Completed</p>
                  <p id="done-count" class="stat-value">0</p>
                </div>
                <div class="stat-card">
                  <p class="stat-label">Total notes</p>
                  <p id="note-count" class="stat-value">0</p>
                </div>
                <div class="stat-card">
                  <p class="stat-label">Projects</p>
                  <p id="project-count" class="stat-value">0</p>
                </div>
                <div class="stat-card">
                  <p class="stat-label">Members</p>
                  <p id="member-count" class="stat-value">0</p>
                </div>
              </div>
            </article>
          </div>
        </section>

        <section class="page" data-page-panel="tasks">
          <article class="card panel page-panel">
            <div class="panel-header">
              <div>
                <p class="eyebrow">Checklist</p>
                <h2>Task manager</h2>
              </div>
              <button id="clear-done" class="ghost">Clear done</button>
            </div>
            <form id="task-form" class="task-form">
              <input id="task-input" class="text-input" type="text" maxlength="100" placeholder="Add a task" required />
              <button class="primary" type="submit">Add</button>
            </form>
            <ul id="task-list" class="task-list"></ul>
          </article>
        </section>

        <section class="page" data-page-panel="notes">
          <article class="card panel page-panel">
            <p class="eyebrow">Notes</p>
            <h2>Quick capture</h2>
            <textarea id="note-input" class="note-input" placeholder="Capture notes, reminders, or links here."></textarea>
          </article>
        </section>

        <section class="page" data-page-panel="projects">
          <article class="card panel page-panel">
            <p class="eyebrow">Projects Database</p>
            <h2>Create project</h2>
            <form id="project-form" class="form-grid">
              <input id="project-name" class="text-input" type="text" maxlength="120" placeholder="Project name" required />
              <input id="project-number" class="text-input" type="text" maxlength="40" placeholder="Project number" required />
              <input id="project-location" class="text-input" type="text" maxlength="120" placeholder="Project location" required />
              <button class="primary" type="submit">Save project</button>
            </form>
            <p id="project-feedback" class="hint"></p>
            <ul id="project-list" class="record-list"></ul>
          </article>
        </section>

        <section class="page" data-page-panel="members">
          <article class="card panel page-panel">
            <p class="eyebrow">Peloton Members</p>
            <h2>Add member profile</h2>
            <form id="member-form" class="form-grid">
              <input id="member-name" class="text-input" type="text" maxlength="60" placeholder="Name" required />
              <input id="member-surname" class="text-input" type="text" maxlength="60" placeholder="Surname" required />
              <input id="member-employee-number" class="text-input" type="text" maxlength="40" placeholder="Employee number" required />
              <input id="member-qualification" class="text-input" type="text" maxlength="120" placeholder="Qualification" required />
              <select id="member-project" class="text-input">
                <option value="">No linked project</option>
              </select>
              <label class="file-input-wrap" for="member-documents">Attach PDF files (optional)</label>
              <input id="member-documents" class="file-input" type="file" accept="application/pdf,.pdf" multiple />
              <button class="primary" type="submit">Save member</button>
            </form>
            <p id="member-feedback" class="hint"></p>
            <ul id="member-list" class="record-list"></ul>
          </article>
        </section>

        <section class="page" data-page-panel="settings">
          <article class="card panel page-panel">
            <p class="eyebrow">Preferences</p>
            <h2>App settings</h2>
            <div class="settings-stack">
              <div class="settings-block">
                <label class="field-label" for="api-base-url">Shared database API URL</label>
                <input id="api-base-url" class="text-input" type="url" placeholder="http://localhost:8787" />
                <div class="settings-actions">
                  <button id="save-api-url" type="button" class="primary">Use shared database</button>
                  <button id="clear-api-url" type="button" class="ghost">Use local database</button>
                </div>
                <p id="api-status" class="hint"></p>
              </div>
              <label class="settings-row" for="compact-tasks-toggle">
                <span>Compact tasks list</span>
                <input id="compact-tasks-toggle" type="checkbox" />
              </label>
              <button id="reset-data" type="button" class="ghost">Reset all local data</button>
              <p class="hint">This clears focus/tasks/notes and also clears projects/members in the active data mode.</p>
            </div>
          </article>
        </section>
      </section>
    </main>
  `;

  bindNavigation();

  const focusInput = document.querySelector('#focus-input');
  const taskForm = document.querySelector('#task-form');
  const taskInput = document.querySelector('#task-input');
  const taskList = document.querySelector('#task-list');
  const clearDoneButton = document.querySelector('#clear-done');
  const noteInput = document.querySelector('#note-input');
  const projectForm = document.querySelector('#project-form');
  const projectNameInput = document.querySelector('#project-name');
  const projectNumberInput = document.querySelector('#project-number');
  const projectLocationInput = document.querySelector('#project-location');
  const projectList = document.querySelector('#project-list');
  const projectFeedback = document.querySelector('#project-feedback');
  const memberForm = document.querySelector('#member-form');
  const memberNameInput = document.querySelector('#member-name');
  const memberSurnameInput = document.querySelector('#member-surname');
  const memberEmployeeNumberInput = document.querySelector('#member-employee-number');
  const memberQualificationInput = document.querySelector('#member-qualification');
  const memberProjectSelect = document.querySelector('#member-project');
  const memberDocumentsInput = document.querySelector('#member-documents');
  const memberList = document.querySelector('#member-list');
  const memberFeedback = document.querySelector('#member-feedback');
  const apiBaseUrlInput = document.querySelector('#api-base-url');
  const saveApiUrlButton = document.querySelector('#save-api-url');
  const clearApiUrlButton = document.querySelector('#clear-api-url');
  const apiStatus = document.querySelector('#api-status');
  const compactTasksToggle = document.querySelector('#compact-tasks-toggle');
  const resetDataButton = document.querySelector('#reset-data');

  focusInput.value = localStorage.getItem(storageKeys.focus) ?? '';
  noteInput.value = localStorage.getItem(storageKeys.note) ?? '';
  apiBaseUrlInput.value = getApiBaseUrl() ?? '';
  apiStatus.textContent = getApiBaseUrl()
    ? `Shared mode enabled: ${getApiBaseUrl()}`
    : 'Local mode enabled: data stored on this device.';
  compactTasksToggle.checked = localStorage.getItem(storageKeys.compactTasks) === '1';

  focusInput.addEventListener('input', () => {
    localStorage.setItem(storageKeys.focus, focusInput.value.trim());
  });

  noteInput.addEventListener('input', () => {
    localStorage.setItem(storageKeys.note, noteInput.value);
    updateStats();
  });

  taskForm.addEventListener('submit', (event) => {
    event.preventDefault();

    const text = taskInput.value.trim();
    if (!text) {
      return;
    }

    tasks.unshift({ id: crypto.randomUUID(), text, done: false });
    persistTasks(storageKeys.tasks, tasks);
    taskInput.value = '';
    renderTasks(taskList);
    updateStats();
  });

  clearDoneButton.addEventListener('click', () => {
    tasks = tasks.filter((task) => !task.done);
    persistTasks(storageKeys.tasks, tasks);
    renderTasks(taskList);
    updateStats();
  });

  projectForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    const project = {
      id: crypto.randomUUID(),
      name: projectNameInput.value.trim(),
      number: projectNumberInput.value.trim(),
      location: projectLocationInput.value.trim(),
      createdAt: new Date().toISOString()
    };

    if (!project.name || !project.number || !project.location) {
      projectFeedback.textContent = 'Please complete all project fields.';
      return;
    }

    const savedProject = await createProject(project);
    projects.unshift(savedProject);
    projectForm.reset();
    projectFeedback.textContent = `Saved project ${savedProject.number}.`;
    renderProjects(projectList, projectFeedback);
    renderProjectOptions(memberProjectSelect);
    updateStats();
  });

  memberForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    const fileCandidates = Array.from(memberDocumentsInput.files || []);
    const invalidFile = fileCandidates.find((file) => {
      const type = (file.type || '').toLowerCase();
      const isPdfType = type === 'application/pdf';
      const isPdfName = file.name.toLowerCase().endsWith('.pdf');
      return !isPdfType && !isPdfName;
    });

    if (invalidFile) {
      memberFeedback.textContent = 'Only PDF files can be attached.';
      return;
    }

    const memberDraft = {
      id: crypto.randomUUID(),
      name: memberNameInput.value.trim(),
      surname: memberSurnameInput.value.trim(),
      employeeNumber: memberEmployeeNumberInput.value.trim(),
      qualification: memberQualificationInput.value.trim(),
      projectId: memberProjectSelect.value || null,
      createdAt: new Date().toISOString()
    };

    if (!memberDraft.name || !memberDraft.surname || !memberDraft.employeeNumber || !memberDraft.qualification) {
      memberFeedback.textContent = 'Please complete all member fields except project/PDF.';
      return;
    }

    const savedMember = await createMember(memberDraft, fileCandidates);
    members.unshift(savedMember);
    memberForm.reset();
    memberFeedback.textContent = `Saved member ${savedMember.name} ${savedMember.surname}.`;
    renderMembers(memberList, memberFeedback);
    updateStats();
  });

  saveApiUrlButton.addEventListener('click', async () => {
    const candidate = normalizeApiUrl(apiBaseUrlInput.value);
    if (!candidate) {
      apiStatus.textContent = 'Please enter a valid API URL, e.g. http://localhost:8787';
      return;
    }

    try {
      await pingApi(candidate);
      localStorage.setItem(storageKeys.apiBaseUrl, candidate);
      await loadDatabaseState();
      apiStatus.textContent = `Connected to shared database: ${candidate}`;
      renderApp();
    } catch {
      apiStatus.textContent = 'Could not reach API. Start the backend server and try again.';
    }
  });

  clearApiUrlButton.addEventListener('click', async () => {
    localStorage.removeItem(storageKeys.apiBaseUrl);
    await loadDatabaseState();
    renderApp();
  });

  compactTasksToggle.addEventListener('change', () => {
    localStorage.setItem(storageKeys.compactTasks, compactTasksToggle.checked ? '1' : '0');
    taskList.classList.toggle('compact', compactTasksToggle.checked);
  });

  resetDataButton.addEventListener('click', async () => {
    localStorage.removeItem(storageKeys.focus);
    localStorage.removeItem(storageKeys.tasks);
    localStorage.removeItem(storageKeys.note);

    tasks = [...defaultTasks];
    persistTasks(storageKeys.tasks, tasks);
    await clearAllDataRecords();
    await loadDatabaseState();

    focusInput.value = '';
    noteInput.value = '';
    renderTasks(taskList);
    renderProjects(projectList, projectFeedback);
    renderMembers(memberList, memberFeedback);
    renderProjectOptions(memberProjectSelect);
    updateStats();
  });

  taskList.classList.toggle('compact', compactTasksToggle.checked);
  renderTasks(taskList);
  renderProjects(projectList, projectFeedback);
  renderMembers(memberList, memberFeedback);
  renderProjectOptions(memberProjectSelect);
  updateStats();
  showPage(currentPage);
  updateInstallUi();
}

function renderTasks(taskList) {
  if (!tasks.length) {
    taskList.innerHTML = '<li class="empty-state">No tasks yet. Add one above.</li>';
    return;
  }

  taskList.innerHTML = tasks
    .map(
      (task) => `
        <li class="task-item ${task.done ? 'done' : ''}">
          <label>
            <input type="checkbox" data-task-id="${task.id}" ${task.done ? 'checked' : ''} />
            <span>${escapeHtml(task.text)}</span>
          </label>
          <button class="ghost delete-task" type="button" data-delete-id="${task.id}">Delete</button>
        </li>
      `
    )
    .join('');

  taskList.querySelectorAll('input[type="checkbox"]').forEach((checkbox) => {
    checkbox.addEventListener('change', (event) => {
      const taskId = event.target.dataset.taskId;
      tasks = tasks.map((task) => {
        if (task.id !== taskId) {
          return task;
        }

        return { ...task, done: event.target.checked };
      });
      persistTasks(storageKeys.tasks, tasks);
      renderTasks(taskList);
      updateStats();
    });
  });

  taskList.querySelectorAll('.delete-task').forEach((button) => {
    button.addEventListener('click', () => {
      const taskId = button.dataset.deleteId;
      tasks = tasks.filter((task) => task.id !== taskId);
      persistTasks(storageKeys.tasks, tasks);
      renderTasks(taskList);
      updateStats();
    });
  });
}

function bindNavigation() {
  document.querySelectorAll('.page-link').forEach((button) => {
    button.addEventListener('click', () => {
      const target = button.dataset.page;
      if (!target) {
        return;
      }
      showPage(target);
    });
  });
}

function renderProjects(projectList, projectFeedback) {
  if (!projects.length) {
    projectList.innerHTML = '<li class="empty-state">No projects yet. Add your first project above.</li>';
    return;
  }

  projectList.innerHTML = projects
    .map(
      (project) => `
        <li class="record-item">
          <div class="record-main">
            <h3>${escapeHtml(project.name)}</h3>
            <p class="hint">Number: ${escapeHtml(project.number)} | Location: ${escapeHtml(project.location)}</p>
          </div>
          <button class="ghost" type="button" data-delete-project-id="${project.id}">Delete</button>
        </li>
      `
    )
    .join('');

  projectList.querySelectorAll('[data-delete-project-id]').forEach((button) => {
    button.addEventListener('click', async () => {
      const projectId = button.dataset.deleteProjectId;
      if (!projectId) {
        return;
      }

      await deleteProject(projectId);
      projects = projects.filter((project) => project.id !== projectId);

      projectFeedback.textContent = 'Project deleted.';
      renderProjects(projectList, projectFeedback);
      renderProjectOptions(document.querySelector('#member-project'));
      renderMembers(document.querySelector('#member-list'), document.querySelector('#member-feedback'));
      updateStats();
    });
  });
}

function renderProjectOptions(selectElement) {
  if (!selectElement) {
    return;
  }

  const options = projects
    .map(
      (project) =>
        `<option value="${project.id}">${escapeHtml(project.number)} - ${escapeHtml(project.name)}</option>`
    )
    .join('');

  selectElement.innerHTML = `<option value="">No linked project</option>${options}`;
}

function renderMembers(memberList, memberFeedback) {
  if (!members.length) {
    memberList.innerHTML = '<li class="empty-state">No members yet. Add a profile above.</li>';
    return;
  }

  memberList.innerHTML = members
    .map((member) => {
      const linkedProject = projects.find((project) => project.id === member.projectId);
      const docs = (member.documents || [])
        .map(
          (doc) => `
            <li>
              <button
                class="ghost doc-download"
                type="button"
                data-member-id="${member.id}"
                data-doc-id="${doc.id}"
              >${escapeHtml(doc.name)}</button>
            </li>
          `
        )
        .join('');

      return `
        <li class="record-item">
          <div class="record-main">
            <h3>${escapeHtml(member.name)} ${escapeHtml(member.surname)}</h3>
            <p class="hint">Employee: ${escapeHtml(member.employeeNumber)} | Qualification: ${escapeHtml(member.qualification)}</p>
            <p class="hint">Project: ${linkedProject ? `${escapeHtml(linkedProject.number)} - ${escapeHtml(linkedProject.name)}` : 'No linked project'}</p>
            ${docs ? `<ul class="doc-list">${docs}</ul>` : '<p class="hint">No PDF attachments.</p>'}
          </div>
          <button class="ghost" type="button" data-delete-member-id="${member.id}">Delete</button>
        </li>
      `;
    })
    .join('');

  memberList.querySelectorAll('[data-delete-member-id]').forEach((button) => {
    button.addEventListener('click', async () => {
      const memberId = button.dataset.deleteMemberId;
      if (!memberId) {
        return;
      }

      await deleteMember(memberId);
      members = members.filter((member) => member.id !== memberId);
      memberFeedback.textContent = 'Member removed.';
      renderMembers(memberList, memberFeedback);
      updateStats();
    });
  });

  memberList.querySelectorAll('.doc-download').forEach((button) => {
    button.addEventListener('click', () => {
      const memberId = button.dataset.memberId;
      const docId = button.dataset.docId;

      const member = members.find((entry) => entry.id === memberId);
      const documentEntry = member?.documents?.find((doc) => doc.id === docId);
      if (!documentEntry) {
        memberFeedback.textContent = 'Could not load this PDF file.';
        return;
      }

      if (!documentEntry.blob) {
        const apiBase = getApiBaseUrl();
        if (!apiBase) {
          memberFeedback.textContent = 'Document download is not available.';
          return;
        }
        const link = document.createElement('a');
        link.href = `${apiBase}/members/${member.id}/documents/${documentEntry.id}`;
        link.target = '_blank';
        link.rel = 'noopener';
        document.body.appendChild(link);
        link.click();
        link.remove();
        return;
      }

      const objectUrl = URL.createObjectURL(documentEntry.blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = documentEntry.name;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(objectUrl), 2000);
    });
  });
}

function showPage(nextPage) {
  if (!pages.includes(nextPage)) {
    return;
  }

  currentPage = nextPage;
  localStorage.setItem(storageKeys.page, nextPage);

  document.querySelectorAll('.page-link').forEach((button) => {
    const active = button.dataset.page === nextPage;
    button.classList.toggle('active', active);
    button.setAttribute('aria-current', active ? 'page' : 'false');
  });

  document.querySelectorAll('[data-page-panel]').forEach((panel) => {
    panel.classList.toggle('active', panel.dataset.pagePanel === nextPage);
  });
}

function updateStats() {
  const openCount = document.querySelector('#open-count');
  const doneCount = document.querySelector('#done-count');
  const noteCount = document.querySelector('#note-count');
  const projectCount = document.querySelector('#project-count');
  const memberCount = document.querySelector('#member-count');

  if (!openCount || !doneCount || !noteCount || !projectCount || !memberCount) {
    return;
  }

  const done = tasks.filter((task) => task.done).length;
  const open = tasks.length - done;
  const notes = (localStorage.getItem(storageKeys.note) || '').trim();
  const words = notes ? notes.split(/\s+/).length : 0;

  openCount.textContent = String(open);
  doneCount.textContent = String(done);
  noteCount.textContent = String(words);
  projectCount.textContent = String(projects.length);
  memberCount.textContent = String(members.length);
}

function loadInitialPage() {
  const saved = localStorage.getItem(storageKeys.page);
  return pages.includes(saved) ? saved : 'home';
}

function updateInstallUi(message) {
  const installButton = document.querySelector('#install-button');
  const installHint = document.querySelector('#install-hint');

  if (!installButton || !installHint) {
    return;
  }

  if (message) {
    installHint.textContent = message;
  }

  installButton.hidden = !deferredInstallPrompt;
  installButton.onclick = async () => {
    if (!deferredInstallPrompt) {
      return;
    }

    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = undefined;
    updateInstallUi();
  };

  if (deferredInstallPrompt && !message) {
    installHint.textContent = 'This app is ready to install on this device.';
  }
}

function persistTasks(key, data) {
  localStorage.setItem(key, JSON.stringify(data));
}

function loadJson(key, fallback) {
  const value = localStorage.getItem(key);
  if (!value) {
    return fallback;
  }

  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function escapeHtml(value) {
  const stringValue = String(value ?? '');
  return stringValue
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

async function getAllRecords(storeName) {
  const db = await getDatabase();
  const transaction = db.transaction(storeName, 'readonly');
  const request = transaction.objectStore(storeName).getAll();
  const records = await requestToPromise(request);
  await transactionDone(transaction);
  return records.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
}

async function fetchProjects() {
  const apiBase = getApiBaseUrl();
  if (apiBase) {
    return requestJson(`${apiBase}/projects`);
  }
  return getAllRecords(databaseConfig.stores.projects);
}

async function fetchMembers() {
  const apiBase = getApiBaseUrl();
  if (apiBase) {
    return requestJson(`${apiBase}/members`);
  }
  return getAllRecords(databaseConfig.stores.members);
}

async function createProject(project) {
  const apiBase = getApiBaseUrl();
  if (apiBase) {
    return requestJson(`${apiBase}/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(project)
    });
  }

  await putRecord(databaseConfig.stores.projects, project);
  return project;
}

async function createMember(memberDraft, files) {
  const apiBase = getApiBaseUrl();
  if (apiBase) {
    const formData = new FormData();
    formData.append('name', memberDraft.name);
    formData.append('surname', memberDraft.surname);
    formData.append('employeeNumber', memberDraft.employeeNumber);
    formData.append('qualification', memberDraft.qualification);
    formData.append('projectId', memberDraft.projectId || '');
    formData.append('createdAt', memberDraft.createdAt);
    files.forEach((file) => formData.append('documents', file));

    return requestJson(`${apiBase}/members`, {
      method: 'POST',
      body: formData
    });
  }

  const member = {
    ...memberDraft,
    documents: files.map((file) => ({
      id: crypto.randomUUID(),
      name: file.name,
      type: file.type || 'application/pdf',
      size: file.size,
      blob: file
    }))
  };

  await putRecord(databaseConfig.stores.members, member);
  return member;
}

async function deleteProject(projectId) {
  const apiBase = getApiBaseUrl();
  if (apiBase) {
    await requestNoContent(`${apiBase}/projects/${projectId}`, { method: 'DELETE' });
    return;
  }

  await deleteRecord(databaseConfig.stores.projects, projectId);

  const affectedMembers = members.filter((member) => member.projectId === projectId);
  if (affectedMembers.length) {
    await Promise.all(
      affectedMembers.map((member) => {
        const updated = { ...member, projectId: null };
        return putRecord(databaseConfig.stores.members, updated);
      })
    );
    members = members.map((member) => (member.projectId === projectId ? { ...member, projectId: null } : member));
  }
}

async function deleteMember(memberId) {
  const apiBase = getApiBaseUrl();
  if (apiBase) {
    await requestNoContent(`${apiBase}/members/${memberId}`, { method: 'DELETE' });
    return;
  }

  await deleteRecord(databaseConfig.stores.members, memberId);
}

async function clearAllDataRecords() {
  const apiBase = getApiBaseUrl();
  if (apiBase) {
    await Promise.all([
      requestNoContent(`${apiBase}/projects`, { method: 'DELETE' }),
      requestNoContent(`${apiBase}/members`, { method: 'DELETE' })
    ]);
    return;
  }

  await clearStore(databaseConfig.stores.projects);
  await clearStore(databaseConfig.stores.members);
}

async function pingApi(apiBase) {
  await requestJson(`${apiBase}/health`);
}

function getApiBaseUrl() {
  const value = localStorage.getItem(storageKeys.apiBaseUrl);
  return value ? normalizeApiUrl(value) : null;
}

function normalizeApiUrl(value) {
  if (!value) {
    return null;
  }

  try {
    const url = new URL(value.trim());
    return url.toString().replace(/\/$/, '');
  } catch {
    return null;
  }
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, options);
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }
  return response.json();
}

async function requestNoContent(url, options = {}) {
  const response = await fetch(url, options);
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }
}

async function putRecord(storeName, record) {
  const db = await getDatabase();
  const transaction = db.transaction(storeName, 'readwrite');
  const request = transaction.objectStore(storeName).put(record);
  await requestToPromise(request);
  await transactionDone(transaction);
}

async function deleteRecord(storeName, key) {
  const db = await getDatabase();
  const transaction = db.transaction(storeName, 'readwrite');
  const request = transaction.objectStore(storeName).delete(key);
  await requestToPromise(request);
  await transactionDone(transaction);
}

async function clearStore(storeName) {
  const db = await getDatabase();
  const transaction = db.transaction(storeName, 'readwrite');
  const request = transaction.objectStore(storeName).clear();
  await requestToPromise(request);
  await transactionDone(transaction);
}

async function getDatabase() {
  if (dbPromise) {
    return dbPromise;
  }

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseConfig.name, databaseConfig.version);

    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains(databaseConfig.stores.projects)) {
        db.createObjectStore(databaseConfig.stores.projects, { keyPath: 'id' });
      }

      if (!db.objectStoreNames.contains(databaseConfig.stores.members)) {
        db.createObjectStore(databaseConfig.stores.members, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Failed to open local database'));
  });

  return dbPromise;
}

function requestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('IndexedDB request failed'));
  });
}

function transactionDone(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || new Error('IndexedDB transaction failed'));
    transaction.onabort = () => reject(transaction.error || new Error('IndexedDB transaction aborted'));
  });
}

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    return;
  }

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('./sw.js')
      .then((registration) => registration.update())
      .catch(() => {
        const installHint = document.querySelector('#install-hint');
        if (installHint) {
          installHint.textContent = 'The app runs, but offline caching could not be enabled in this browser.';
        }
      });
  });
}
