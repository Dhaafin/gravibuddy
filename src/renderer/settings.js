const api = window.graviAPI;

// DOM Elements
const btnCloseSettings = document.getElementById('btnCloseSettings');
const btnPosLeft = document.getElementById('btnPosLeft');
const btnPosCenter = document.getElementById('btnPosCenter');
const btnPosRight = document.getElementById('btnPosRight');
const btnToggleSound = document.getElementById('btnToggleSound');
const appleToggleSound = document.getElementById('appleToggleSound');
const btnToggleSleep = document.getElementById('btnToggleSleep');
const appleToggleSleep = document.getElementById('appleToggleSleep');
const btnToggleStealth = document.getElementById('btnToggleStealth');
const appleToggleStealth = document.getElementById('appleToggleStealth');
const btnToggleThinkingPreview = document.getElementById('btnToggleThinkingPreview');
const appleToggleThinkingPreview = document.getElementById('appleToggleThinkingPreview');
const btnBrowseFolder = document.getElementById('btnBrowseFolder');
const workspaceList = document.getElementById('workspaceList');

const testThinking = document.getElementById('testThinking');
const testDone = document.getElementById('testDone');
const testWait = document.getElementById('testWait');
const testSleep = document.getElementById('testSleep');
const testIdle = document.getElementById('testIdle');
const btnQuitGravibuddy = document.getElementById('btnQuitGravibuddy');

let soundEnabled = true;
let sleepModeEnabled = true;
let stealthCodingEnabled = true;
let thinkingPreviewEnabled = true;

// Close button & Esc key
if (btnCloseSettings) {
  btnCloseSettings.addEventListener('click', () => {
    api.closeSettings();
  });
}

// Quit Gravibuddy completely
if (btnQuitGravibuddy) {
  btnQuitGravibuddy.addEventListener('click', () => {
    api.quitApp();
  });
}

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    api.closeSettings();
  }
});

function setActivePositionButton(pos) {
  [btnPosLeft, btnPosCenter, btnPosRight].forEach(btn => {
    if (btn) btn.classList.toggle('active', btn.dataset.pos === pos);
  });
}

if (btnPosLeft) btnPosLeft.addEventListener('click', () => api.setPosition('left'));
if (btnPosCenter) btnPosCenter.addEventListener('click', () => api.setPosition('center'));
if (btnPosRight) btnPosRight.addEventListener('click', () => api.setPosition('right'));

if (api && api.onPositionChanged) {
  api.onPositionChanged((info) => {
    const pos = typeof info === 'string' ? info : info.position;
    setActivePositionButton(pos);
  });
}

// Sound Toggle
if (btnToggleSound) {
  btnToggleSound.addEventListener('click', () => {
    soundEnabled = !soundEnabled;
    appleToggleSound.classList.toggle('active', soundEnabled);
    api.saveSoundConfig(soundEnabled);
  });
}

// Sleep Mode Toggle
if (btnToggleSleep) {
  btnToggleSleep.addEventListener('click', () => {
    sleepModeEnabled = !sleepModeEnabled;
    appleToggleSleep.classList.toggle('active', sleepModeEnabled);
    api.saveSleepConfig(sleepModeEnabled);
  });
}

// Stealth Coding Mode Toggle
if (btnToggleStealth) {
  btnToggleStealth.addEventListener('click', () => {
    stealthCodingEnabled = !stealthCodingEnabled;
    appleToggleStealth.classList.toggle('active', stealthCodingEnabled);
    api.saveStealthConfig(stealthCodingEnabled);
  });
}

// Peek on Task Start Toggle
if (btnToggleThinkingPreview && appleToggleThinkingPreview) {
  btnToggleThinkingPreview.addEventListener('click', () => {
    thinkingPreviewEnabled = !thinkingPreviewEnabled;
    appleToggleThinkingPreview.classList.toggle('active', thinkingPreviewEnabled);
    api.saveThinkingPreviewConfig(thinkingPreviewEnabled);
  });
}

// Workspaces
async function loadWorkspaces() {
  if (!api || !api.getWorkspacesData) return;
  try {
    const data = await api.getWorkspacesData();
    renderWorkspaces(data);
  } catch (e) {}
}

function renderWorkspaces(data) {
  if (!workspaceList) return;
  workspaceList.innerHTML = '';
  const { workspaces = [], lastOpened = null } = data || {};

  if (workspaces.length === 0) {
    workspaceList.innerHTML = '<div class="workspace-empty">No projects detected. Click "+ Open Folder"</div>';
    return;
  }

  workspaces.forEach(dirPath => {
    const parts = dirPath.split(/[/\\]/);
    const folderName = parts[parts.length - 1] || dirPath;
    const isLast = dirPath === lastOpened;

    const item = document.createElement('div');
    item.className = `workspace-item${isLast ? ' is-last-opened' : ''}`;
    item.title = `Launch agy in ${dirPath}`;
    item.innerHTML = `
      <div class="workspace-info">
        <span class="workspace-name">${folderName}${isLast ? ' <span style="color:#10b981;font-size:8.5px;font-weight:700;">● Recent</span>' : ''}</span>
        <span class="workspace-path">${dirPath}</span>
      </div>
      <div class="workspace-launch-badge">▶</div>
    `;

    item.addEventListener('click', () => {
      api.launchWorkspace(dirPath);
    });

    workspaceList.appendChild(item);
  });
}

if (btnBrowseFolder) {
  btnBrowseFolder.addEventListener('click', () => {
    api.browseAndLaunch();
  });
}

if (api && api.onWorkspacesUpdated) {
  api.onWorkspacesUpdated((data) => {
    renderWorkspaces(data);
  });
}

// Test State buttons
if (testThinking) {
  testThinking.addEventListener('click', () => {
    api.testState({ state: 'thinking', model: 'Gemini 3.8 Flash (High)' });
  });
}

if (testDone) {
  testDone.addEventListener('click', () => {
    api.testState({ state: 'done', model: 'Gemini 3.8 Flash (High)' });
  });
}

if (testWait) {
  testWait.addEventListener('click', () => {
    api.testState({ state: 'waiting', model: 'Gemini 3.8 Flash (High)' });
  });
}

if (testSleep) {
  testSleep.addEventListener('click', () => {
    api.testState({ state: 'idle', model: 'Gemini 3.8 Flash (High)' });
    api.closeSettings();
  });
}

if (testIdle) {
  testIdle.addEventListener('click', () => {
    api.resetToIdle();
  });
}

// Initial Config Restoration
if (api && api.getInitialConfig) {
  api.getInitialConfig();
  api.onInitialConfig((cfg) => {
    if (cfg) {
      if (cfg.position) setActivePositionButton(cfg.position);
      if (cfg.sound !== undefined && appleToggleSound) {
        soundEnabled = cfg.sound;
        appleToggleSound.classList.toggle('active', soundEnabled);
      }
      if (cfg.sleepMode !== undefined && appleToggleSleep) {
        sleepModeEnabled = cfg.sleepMode;
        appleToggleSleep.classList.toggle('active', sleepModeEnabled);
      }
      if (cfg.stealthMode !== undefined && appleToggleStealth) {
        stealthCodingEnabled = cfg.stealthMode;
        appleToggleStealth.classList.toggle('active', stealthCodingEnabled);
      }
      if (cfg.thinkingPreview !== undefined && appleToggleThinkingPreview) {
        thinkingPreviewEnabled = cfg.thinkingPreview;
        appleToggleThinkingPreview.classList.toggle('active', thinkingPreviewEnabled);
      }
    }
    loadWorkspaces();
  });
}
