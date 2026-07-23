import './styles.css';

const storageKeys = {
  focus: 'molenaar-focus',
  tasks: 'molenaar-tasks',
  note: 'molenaar-note'
};

const defaultTasks = [
  { id: crypto.randomUUID(), text: 'Check today\'s top priority', done: false },
  { id: crypto.randomUUID(), text: 'Review schedule', done: true },
  { id: crypto.randomUUID(), text: 'Capture new ideas', done: false }
];

const app = document.querySelector('#app');

let tasks = loadJson(storageKeys.tasks, defaultTasks);
let deferredInstallPrompt;

window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
  updateInstallUi();
});

window.addEventListener('appinstalled', () => {
  deferredInstallPrompt = undefined;
  updateInstallUi('Installed. You can launch Molenaar Companion from your home screen or app list.');
});

renderPublicApp();
registerServiceWorker();

function renderPublicApp() {
  app.innerHTML = `
    <main class="shell">
      <section class="hero card">
        <div>
          <p class="eyebrow">Installable Web App</p>
          <h1>Molenaar Companion</h1>
          <p class="lede">A responsive planner that installs on laptops, phones, and tablets and keeps working offline.</p>
        </div>
        <div class="hero-actions">
          <button id="install-button" class="primary" hidden>Install app</button>
          <p id="install-hint" class="hint">Open this app in Chrome, Edge, or Safari and use the install/share option to add it to your device.</p>
        </div>
      </section>

      <section class="grid">
        <article class="card panel accent-panel">
          <p class="eyebrow">Today</p>
          <label class="field-label" for="focus-input">Main focus</label>
          <input id="focus-input" class="text-input" type="text" maxlength="120" placeholder="What matters most today?" />
          <p class="hint">Saved locally on this device.</p>
        </article>

        <article class="card panel">
          <div class="panel-header">
            <div>
              <p class="eyebrow">Checklist</p>
              <h2>Keep moving</h2>
            </div>
            <button id="clear-done" class="ghost">Clear done</button>
          </div>
          <form id="task-form" class="task-form">
            <input id="task-input" class="text-input" type="text" maxlength="100" placeholder="Add a task" required />
            <button class="primary" type="submit">Add</button>
          </form>
          <ul id="task-list" class="task-list"></ul>
        </article>

        <article class="card panel wide">
          <p class="eyebrow">Notes</p>
          <h2>Quick capture</h2>
          <textarea id="note-input" class="note-input" placeholder="Capture notes, reminders, or links here."></textarea>
        </article>
      </section>
    </main>
  `;

  const focusInput = document.querySelector('#focus-input');
  const taskForm = document.querySelector('#task-form');
  const taskInput = document.querySelector('#task-input');
  const taskList = document.querySelector('#task-list');
  const clearDoneButton = document.querySelector('#clear-done');
  const noteInput = document.querySelector('#note-input');

  focusInput.value = localStorage.getItem(storageKeys.focus) ?? '';
  noteInput.value = localStorage.getItem(storageKeys.note) ?? '';

  focusInput.addEventListener('input', () => {
    localStorage.setItem(storageKeys.focus, focusInput.value.trim());
  });

  noteInput.addEventListener('input', () => {
    localStorage.setItem(storageKeys.note, noteInput.value);
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
  });

  clearDoneButton.addEventListener('click', () => {
    tasks = tasks.filter((task) => !task.done);
    persistTasks(storageKeys.tasks, tasks);
    renderTasks(taskList);
  });

  renderTasks(taskList);
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
    });
  });

  taskList.querySelectorAll('.delete-task').forEach((button) => {
    button.addEventListener('click', () => {
      const taskId = button.dataset.deleteId;
      tasks = tasks.filter((task) => task.id !== taskId);
      persistTasks(storageKeys.tasks, tasks);
      renderTasks(taskList);
    });
  });
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
  return value
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
