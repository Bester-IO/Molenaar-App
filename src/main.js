import './styles.css';
import { initializeApp } from 'firebase/app';
import {
  GoogleAuthProvider,
  OAuthProvider,
  browserLocalPersistence,
  getAuth,
  onAuthStateChanged,
  setPersistence,
  signInWithPopup,
  signInWithRedirect,
  signOut
} from 'firebase/auth';

const app = document.querySelector('#app');

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

const allowedEmails = parseCsv(import.meta.env.VITE_ALLOWED_EMAILS);
const allowedDomains = parseCsv(import.meta.env.VITE_ALLOWED_DOMAINS);

const providers = {
  google: new GoogleAuthProvider(),
  microsoft: new OAuthProvider('microsoft.com')
};

const defaultTasks = [
  { id: crypto.randomUUID(), text: 'Check today\'s top priority', done: false },
  { id: crypto.randomUUID(), text: 'Review schedule', done: true },
  { id: crypto.randomUUID(), text: 'Capture new ideas', done: false }
];

let currentUser = null;
let deferredInstallPrompt;
let auth;

window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
  updateInstallUi();
});

window.addEventListener('appinstalled', () => {
  deferredInstallPrompt = undefined;
  updateInstallUi('Installed. You can launch Molenaar Companion from your home screen or app list.');
});

boot();
registerServiceWorker();

async function boot() {
  if (!isFirebaseConfigured()) {
    renderSetupState();
    return;
  }

  const firebaseApp = initializeApp(firebaseConfig);
  auth = getAuth(firebaseApp);

  try {
    await setPersistence(auth, browserLocalPersistence);
  } catch {
    renderAuthState('We could not enable persistent sign-in in this browser. You can still sign in for this session.');
  }

  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      currentUser = null;
      renderAuthState();
      return;
    }

    currentUser = user;

    if (!isAuthorized(user)) {
      await signOut(auth);
      renderAuthState('Access denied. Your staff account is not on the allowlist for this app.');
      return;
    }

    renderProtectedApp();
  });
}

function renderSetupState() {
  app.innerHTML = `
    <main class="shell shell-centered">
      <section class="card auth-card">
        <p class="eyebrow">Security Setup</p>
        <h1>Molenaar Companion</h1>
        <p class="lede">This app now expects Firebase authentication before staff can access it.</p>
        <div class="status-banner warning">
          Add the Firebase web config values in <strong>.env.local</strong> before publishing or testing sign-in.
        </div>
        <div class="setup-list">
          <p>Required variables:</p>
          <p>VITE_FIREBASE_API_KEY</p>
          <p>VITE_FIREBASE_AUTH_DOMAIN</p>
          <p>VITE_FIREBASE_PROJECT_ID</p>
          <p>VITE_FIREBASE_APP_ID</p>
          <p>Optional restrictions:</p>
          <p>VITE_ALLOWED_EMAILS=person@company.com</p>
          <p>VITE_ALLOWED_DOMAINS=company.com</p>
        </div>
      </section>
    </main>
  `;
}

function renderAuthState(message = '') {
  app.innerHTML = `
    <main class="shell shell-centered">
      <section class="hero card auth-card">
        <div>
          <p class="eyebrow">Staff Access</p>
          <h1>Molenaar Companion</h1>
          <p class="lede">Sign in with your staff account to access the planner on desktop, phone, or tablet.</p>
        </div>
        <div class="auth-actions">
          <button id="google-sign-in" class="primary">Continue with Google</button>
          <button id="microsoft-sign-in" class="ghost auth-provider">Continue with Microsoft</button>
          <p class="hint">Only approved staff accounts can open the app.</p>
          ${message ? `<p class="status-banner error">${escapeHtml(message)}</p>` : ''}
        </div>
      </section>
    </main>
  `;

  document.querySelector('#google-sign-in').addEventListener('click', () => {
    signIn('google');
  });

  document.querySelector('#microsoft-sign-in').addEventListener('click', () => {
    signIn('microsoft');
  });
}

function renderProtectedApp() {
  const storageKeys = getStorageKeys(currentUser);
  let tasks = loadJson(storageKeys.tasks, defaultTasks);

  app.innerHTML = `
    <main class="shell">
      <section class="hero card">
        <div>
          <p class="eyebrow">Staff Workspace</p>
          <h1>Molenaar Companion</h1>
          <p class="lede">Signed in as ${escapeHtml(currentUser.displayName || currentUser.email || 'staff user')}.</p>
        </div>
        <div class="hero-actions hero-actions-end">
          <div class="user-chip">${escapeHtml(currentUser.email || 'Authenticated')}</div>
          <button id="install-button" class="primary" hidden>Install app</button>
          <button id="sign-out-button" class="ghost">Sign out</button>
          <p id="install-hint" class="hint">Open this app in Chrome, Edge, or Safari and use the install/share option to add it to your device.</p>
        </div>
      </section>

      <section class="grid">
        <article class="card panel accent-panel">
          <p class="eyebrow">Today</p>
          <label class="field-label" for="focus-input">Main focus</label>
          <input id="focus-input" class="text-input" type="text" maxlength="120" placeholder="What matters most today?" />
          <p class="hint">Saved locally for this signed-in staff account on this device.</p>
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
  const signOutButton = document.querySelector('#sign-out-button');

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
    renderTasks(taskList, tasks, storageKeys.tasks, (nextTasks) => {
      tasks = nextTasks;
    });
  });

  clearDoneButton.addEventListener('click', () => {
    tasks = tasks.filter((task) => !task.done);
    persistTasks(storageKeys.tasks, tasks);
    renderTasks(taskList, tasks, storageKeys.tasks, (nextTasks) => {
      tasks = nextTasks;
    });
  });

  signOutButton.addEventListener('click', async () => {
    await signOut(auth);
  });

  renderTasks(taskList, tasks, storageKeys.tasks, (nextTasks) => {
    tasks = nextTasks;
  });
  updateInstallUi();
}

function renderTasks(taskList, tasks, storageKey, setTasks) {
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
      const nextTasks = tasks.map((task) => {
        if (task.id !== taskId) {
          return task;
        }

        return { ...task, done: event.target.checked };
      });
      persistTasks(storageKey, nextTasks);
      setTasks(nextTasks);
      renderTasks(taskList, nextTasks, storageKey, setTasks);
    });
  });

  taskList.querySelectorAll('.delete-task').forEach((button) => {
    button.addEventListener('click', () => {
      const taskId = button.dataset.deleteId;
      const nextTasks = tasks.filter((task) => task.id !== taskId);
      persistTasks(storageKey, nextTasks);
      setTasks(nextTasks);
      renderTasks(taskList, nextTasks, storageKey, setTasks);
    });
  });
}

async function signIn(providerName) {
  const provider = providers[providerName];

  try {
    if (shouldUseRedirect()) {
      await signInWithRedirect(auth, provider);
      return;
    }

    await signInWithPopup(auth, provider);
  } catch (error) {
    if (error?.code === 'auth/popup-blocked' || error?.code === 'auth/operation-not-supported-in-this-environment') {
      await signInWithRedirect(auth, provider);
      return;
    }

    renderAuthState(error?.message || 'Sign-in failed. Try again.');
  }
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

function getStorageKeys(user) {
  const suffix = user?.uid || 'guest';
  return {
    focus: `molenaar-focus-${suffix}`,
    tasks: `molenaar-tasks-${suffix}`,
    note: `molenaar-note-${suffix}`
  };
}

function isFirebaseConfigured() {
  return Object.values(firebaseConfig).every(Boolean);
}

function isAuthorized(user) {
  const email = user.email?.toLowerCase();
  if (!email) {
    return false;
  }

  if (!allowedEmails.length && !allowedDomains.length) {
    return true;
  }

  if (allowedEmails.includes(email)) {
    return true;
  }

  const domain = email.split('@')[1];
  return Boolean(domain && allowedDomains.includes(domain));
}

function shouldUseRedirect() {
  return window.matchMedia('(max-width: 820px)').matches || window.matchMedia('(display-mode: standalone)').matches;
}

function persistTasks(key, tasks) {
  localStorage.setItem(key, JSON.stringify(tasks));
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

function parseCsv(value) {
  return (value || '')
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
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
    navigator.serviceWorker.register('./sw.js').catch(() => {
      const installHint = document.querySelector('#install-hint');
      if (installHint) {
        installHint.textContent = 'The app runs, but offline caching could not be enabled in this browser.';
      }
    });
  });
}