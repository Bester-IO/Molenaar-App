import './styles.css';

const storageKeys = {
  page: 'molenaar-page'
};

const pages = ['home', 'create-project', 'projects', 'tasks', 'notes', 'members', 'settings'];
const databaseConfig = {
  name: 'molenaar-local-db',
  version: 1,
  stores: {
    projects: 'projects'
  }
};

const app = document.querySelector('#app');

let currentPage = loadInitialPage();
let isDrawerOpen = false;
let selectedProjectId = null;
let editingProjectId = null;

renderApp();
registerServiceWorker();

function renderApp() {
  app.innerHTML = `
    <div class="brand-banner" aria-label="Molenaar brand banner">
      <div class="brand-primary">
        <div class="brand-logo-wrap">
          <img class="brand-logo" src="./branding/molenaar-logo.svg" alt="MOLENAAR logo" />
          <p class="brand-tagline">Think Service Exellence</p>
        </div>
      </div>
      <div class="brand-secondary" aria-hidden="true"></div>
    </div>

    <button id="menu-toggle" class="menu-toggle" type="button" aria-label="Open navigation" aria-controls="left-drawer" aria-expanded="false">&#8230;</button>
    <div id="drawer-backdrop" class="drawer-backdrop" hidden></div>
    <aside id="left-drawer" class="left-drawer" aria-hidden="true">
      <div class="drawer-banner" aria-hidden="true">
        <div class="drawer-banner-primary">
          <p class="drawer-nav-label">Navigation</p>
        </div>
        <div class="drawer-banner-secondary"></div>
      </div>

      <div class="drawer-content">
        <nav class="drawer-nav drawer-nav-home" aria-label="Home page">
          <button type="button" class="drawer-link drawer-link-home" data-page="home" aria-label="Home" title="Home">Home</button>
        </nav>

        <section class="drawer-section" aria-label="Projects section">
          <p class="drawer-subheader">Projects</p>
          <nav class="drawer-nav drawer-nav-section" aria-label="Projects pages">
            <button type="button" class="drawer-link" data-page="create-project" aria-label="Create Project" title="Create Project">Create Project</button>
            <button type="button" class="drawer-link" data-page="projects" aria-label="Current Projects" title="Current Projects">Current Projects</button>
          </nav>
        </section>

        <section class="drawer-section" aria-label="Pelotons section">
          <p class="drawer-subheader">Pelotons</p>
          <nav class="drawer-nav drawer-nav-section" aria-label="Pelotons pages">
            <button type="button" class="drawer-link" data-page="members" aria-label="Pelotons" title="Pelotons">Pelotons</button>
          </nav>
        </section>

        <nav class="drawer-nav drawer-nav-utility" aria-label="Utility pages">
          <button type="button" class="drawer-link" data-page="tasks" aria-label="Tasks" title="Tasks">Tasks</button>
          <button type="button" class="drawer-link" data-page="notes" aria-label="Notes" title="Notes">Notes</button>
          <button type="button" class="drawer-link drawer-link-settings" data-page="settings" aria-label="Settings" title="Settings">Settings</button>
        </nav>
      </div>
    </aside>

    <main class="shell">
      <section class="page-screen" data-page-content="home"></section>

      <section class="page-screen" data-page-content="create-project">
        <div class="create-project-layout">
          <article class="project-block project-form-block">
            <div class="panel-header">
              <h2>Create Project</h2>
            </div>

            <form id="project-form" class="form-grid">
              <label class="field-label" for="project-name">Project name</label>
              <input id="project-name" name="projectName" class="text-input" type="text" required />

              <label class="field-label" for="project-number">Project number</label>
              <input id="project-number" name="projectNumber" class="text-input" type="text" />

              <label class="field-label" for="project-location">Project location</label>
              <input id="project-location" name="projectLocation" class="text-input" type="text" />

              <div class="drawer-form-actions">
                <button type="submit" class="primary">Save Project</button>
                <button id="project-cancel" type="button" class="ghost">Cancel</button>
              </div>
              <p id="project-status" class="drawer-form-status" aria-live="polite"></p>
            </form>
          </article>

          <article class="project-block project-list-block">
            <div class="panel-header project-list-header">
              <h2>Existing Projects</h2>
            </div>
            <ul id="project-list-create" class="record-list" aria-live="polite"></ul>
            <div class="project-admin-actions">
              <button id="edit-project-btn" type="button" class="ghost">Edit Project</button>
              <button id="delete-project-btn" type="button" class="ghost">Delete Project</button>
            </div>
          </article>
        </div>
      </section>

      <section class="page-screen" data-page-content="projects">
        <article class="card panel page-panel create-project-panel">
          <div class="panel-header">
            <h2>Current Projects</h2>
          </div>
          <ul id="project-list" class="record-list" aria-live="polite"></ul>
        </article>
      </section>
    </main>
  `;

  bindNavigation();
  bindProjectForm();
  bindProjectListInteractions();
  bindProjectAdminActions();
  showPage(currentPage);
}

function bindNavigation() {
  const menuToggle = document.querySelector('#menu-toggle');
  const drawerBackdrop = document.querySelector('#drawer-backdrop');

  menuToggle?.addEventListener('click', () => {
    setDrawerOpen(!isDrawerOpen);
  });

  drawerBackdrop?.addEventListener('click', () => {
    setDrawerOpen(false);
  });

  document.querySelectorAll('.drawer-link').forEach((button) => {
    button.addEventListener('click', () => {
      const target = button.dataset.page;
      if (!target) {
        return;
      }
      showPage(target);
    });
  });
}

function setDrawerOpen(nextState) {
  const drawer = document.querySelector('#left-drawer');
  const drawerBackdrop = document.querySelector('#drawer-backdrop');
  const menuToggle = document.querySelector('#menu-toggle');

  if (!drawer || !drawerBackdrop || !menuToggle) {
    return;
  }

  isDrawerOpen = nextState;
  drawer.classList.toggle('open', nextState);
  drawerBackdrop.hidden = !nextState;
  drawerBackdrop.classList.toggle('open', nextState);
  drawer.setAttribute('aria-hidden', nextState ? 'false' : 'true');
  menuToggle.setAttribute('aria-expanded', nextState ? 'true' : 'false');
}

function showPage(nextPage) {
  if (!pages.includes(nextPage)) {
    return;
  }

  if (isDrawerOpen) {
    setDrawerOpen(false);
  }

  currentPage = nextPage;
  localStorage.setItem(storageKeys.page, nextPage);

  document.querySelectorAll('.drawer-link').forEach((button) => {
    const active = button.dataset.page === nextPage;
    button.classList.toggle('active', active);
    button.setAttribute('aria-current', active ? 'page' : 'false');
  });

  document.querySelectorAll('[data-page-content]').forEach((section) => {
    const isActive = section.getAttribute('data-page-content') === nextPage;
    section.classList.toggle('active', isActive);
  });

  if (nextPage === 'create-project') {
    const nameInput = document.querySelector('#project-name');
    nameInput?.focus();
  }

  if (nextPage === 'projects' || nextPage === 'create-project') {
    renderProjectLists();
  }
}

function loadInitialPage() {
  const saved = localStorage.getItem(storageKeys.page);
  return pages.includes(saved) ? saved : 'home';
}

function bindProjectForm() {
  const form = document.querySelector('#project-form');
  const cancel = document.querySelector('#project-cancel');
  const status = document.querySelector('#project-status');

  form?.addEventListener('submit', async (event) => {
    event.preventDefault();

    const formData = new FormData(form);
    const name = String(formData.get('projectName') ?? '').trim();
    const number = String(formData.get('projectNumber') ?? '').trim();
    const location = String(formData.get('projectLocation') ?? '').trim();

    if (!name) {
      if (status) {
        status.textContent = 'Project name is required.';
      }
      return;
    }

    try {
      if (editingProjectId) {
        await updateProject(editingProjectId, { name, number, location });
      } else {
        await createProject({ name, number, location });
      }

      form.reset();
      if (status) {
        status.textContent = editingProjectId ? 'Project updated.' : 'Project saved.';
      }
      editingProjectId = null;
      showPage('projects');
    } catch {
      if (status) {
        status.textContent = editingProjectId ? 'Could not update project. Try again.' : 'Could not save project. Try again.';
      }
    }
  });

  cancel?.addEventListener('click', () => {
    if (status) {
      status.textContent = '';
    }
    editingProjectId = null;
    form?.reset();
    showPage('home');
  });
}

function bindProjectListInteractions() {
  const lists = [
    document.querySelector('#project-list-create'),
    document.querySelector('#project-list')
  ];

  lists.forEach((list) => {
    list?.addEventListener('click', async (event) => {
      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }

      const infoButton = target.closest('.project-info-btn');
      if (infoButton) {
        const rawId = infoButton.getAttribute('data-project-id');
        const projectId = Number(rawId);
        if (!Number.isNaN(projectId)) {
          await showProjectInfo(projectId);
        }
        return;
      }

      const row = target.closest('[data-project-id]');
      if (!row) {
        return;
      }

      const projectId = Number(row.getAttribute('data-project-id'));
      if (Number.isNaN(projectId)) {
        return;
      }

      selectedProjectId = projectId;
      renderProjectLists();
    });
  });
}

function bindProjectAdminActions() {
  const editButton = document.querySelector('#edit-project-btn');
  const deleteButton = document.querySelector('#delete-project-btn');
  const status = document.querySelector('#project-status');

  editButton?.addEventListener('click', async () => {
    if (!selectedProjectId) {
      if (status) {
        status.textContent = 'Select an existing project first.';
      }
      return;
    }

    const project = await getProjectById(selectedProjectId);
    if (!project) {
      if (status) {
        status.textContent = 'Selected project no longer exists.';
      }
      return;
    }

    editingProjectId = project.id;
    const nameInput = document.querySelector('#project-name');
    const numberInput = document.querySelector('#project-number');
    const locationInput = document.querySelector('#project-location');

    if (nameInput instanceof HTMLInputElement) {
      nameInput.value = project.name || '';
    }
    if (numberInput instanceof HTMLInputElement) {
      numberInput.value = project.number || '';
    }
    if (locationInput instanceof HTMLInputElement) {
      locationInput.value = project.location || '';
    }

    if (status) {
      status.textContent = `Editing project: ${project.name}`;
    }
  });

  deleteButton?.addEventListener('click', async () => {
    if (!selectedProjectId) {
      if (status) {
        status.textContent = 'Select an existing project first.';
      }
      return;
    }

    const confirmed = window.confirm('Delete selected project?');
    if (!confirmed) {
      return;
    }

    try {
      await deleteProject(selectedProjectId);
      if (editingProjectId === selectedProjectId) {
        editingProjectId = null;
      }
      selectedProjectId = null;
      if (status) {
        status.textContent = 'Project deleted.';
      }
      renderProjectLists();
    } catch {
      if (status) {
        status.textContent = 'Could not delete project. Try again.';
      }
    }
  });
}

async function renderProjectLists() {
  const projects = await fetchProjects();
  const lists = [
    document.querySelector('#project-list-create'),
    document.querySelector('#project-list')
  ];

  lists.forEach((list) => {
    if (!list) {
      return;
    }

    if (!projects.length) {
      list.innerHTML = '<li class="empty-state">No projects yet.</li>';
      return;
    }

    list.innerHTML = projects
      .map((project) => {
        const isSelected = selectedProjectId === project.id;
        return `
        <li class="record-item${isSelected ? ' record-item-selected' : ''}" data-project-id="${project.id}">
          <div class="record-main">
            <h3>${escapeHtml(project.name)}</h3>
            <p>${escapeHtml(project.number || 'No project number')}</p>
            <p>${escapeHtml(project.location || 'No project location')}</p>
          </div>
          <button type="button" class="project-info-btn" data-project-id="${project.id}" aria-label="Project info" title="Project info">i</button>
        </li>
      `;
      })
      .join('');
  });
}

async function fetchProjects() {
  return withDatabase((database) => {
    const transaction = database.transaction(databaseConfig.stores.projects, 'readonly');
    const store = transaction.objectStore(databaseConfig.stores.projects);
    return requestToPromise(store.getAll());
  });
}

async function createProject(project) {
  return withDatabase((database) => {
    const transaction = database.transaction(databaseConfig.stores.projects, 'readwrite');
    const store = transaction.objectStore(databaseConfig.stores.projects);
    return requestToPromise(
      store.add({
        ...project,
        createdAt: new Date().toISOString()
      })
    );
  });
}

async function updateProject(projectId, project) {
  return withDatabase((database) => {
    const transaction = database.transaction(databaseConfig.stores.projects, 'readwrite');
    const store = transaction.objectStore(databaseConfig.stores.projects);
    const request = store.get(projectId);

    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        const existing = request.result;
        if (!existing) {
          resolve(null);
          return;
        }

        const updateRequest = store.put({
          ...existing,
          ...project,
          updatedAt: new Date().toISOString()
        });

        updateRequest.onsuccess = () => resolve(updateRequest.result);
        updateRequest.onerror = () => reject(updateRequest.error);
      };

      request.onerror = () => reject(request.error);
    });
  });
}

async function deleteProject(projectId) {
  return withDatabase((database) => {
    const transaction = database.transaction(databaseConfig.stores.projects, 'readwrite');
    const store = transaction.objectStore(databaseConfig.stores.projects);
    return requestToPromise(store.delete(projectId));
  });
}

async function getProjectById(projectId) {
  return withDatabase((database) => {
    const transaction = database.transaction(databaseConfig.stores.projects, 'readonly');
    const store = transaction.objectStore(databaseConfig.stores.projects);
    return requestToPromise(store.get(projectId));
  });
}

async function showProjectInfo(projectId) {
  const project = await getProjectById(projectId);
  if (!project) {
    return;
  }

  const details = [
    `Project: ${project.name || '-'}`,
    `Number: ${project.number || '-'}`,
    `Location: ${project.location || '-'}`
  ].join('\n');

  window.alert(details);
}

let databasePromise;

function openDatabase() {
  const request = indexedDB.open(databaseConfig.name, databaseConfig.version);

  request.onupgradeneeded = (event) => {
    const database = event.target.result;
    if (!database.objectStoreNames.contains(databaseConfig.stores.projects)) {
      database.createObjectStore(databaseConfig.stores.projects, { keyPath: 'id', autoIncrement: true });
    }
  };

  return requestToPromise(request);
}

function getDatabase() {
  if (!databasePromise) {
    databasePromise = openDatabase();
  }
  return databasePromise;
}

async function withDatabase(action) {
  const database = await getDatabase();
  return action(database);
}

function requestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    return;
  }

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}
