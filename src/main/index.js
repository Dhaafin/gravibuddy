const { app, BrowserWindow, screen, ipcMain } = require('electron');
const http = require('http');
const path = require('path');
const fs = require('fs');

let mainWindow = null;
let lastState = 'idle';
let currentPosition = 'center'; // 'center' | 'left' | 'right'

const CONFIG_FILE = path.join(app.getPath('userData'), 'gravibuddy-config.json');
const LEGACY_CONFIG_FILE = path.join(app.getPath('userData'), 'vibing-config.json');

function loadConfig() {
  let cfg = { position: 'center', sound: true, sleepMode: true, stealthMode: true, thinkingPreview: true, autoCloseDoneDuration: 5 };
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      cfg = { ...cfg, ...JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')) };
    } else if (fs.existsSync(LEGACY_CONFIG_FILE)) {
      cfg = { ...cfg, ...JSON.parse(fs.readFileSync(LEGACY_CONFIG_FILE, 'utf8')) };
    }
  } catch (e) {}
  return cfg;
}

function saveConfig(cfg) {
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2), 'utf8');
  } catch (e) {}
}

const userConfig = loadConfig();
currentPosition = userConfig.position || 'center';


function getWindowBoundsForPosition(pos) {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { x: screenX, y: screenY, width: screenWidth, height: screenHeight } = primaryDisplay.bounds;

  if (pos === 'left') {
    const width = 240;
    const height = 230;
    const x = screenX;
    const y = screenY + Math.round((screenHeight - height) / 2);
    return { width, height, x, y, orientation: 'vertical-left' };
  }

  if (pos === 'right') {
    const width = 240;
    const height = 230;
    const x = screenX + screenWidth - width;
    const y = screenY + Math.round((screenHeight - height) / 2);
    return { width, height, x, y, orientation: 'vertical-right' };
  }

  // Default: Center Top Attached Hardware Notch (Flush with bezel, accommodates 620x185 expanded card)
  const width = 680;
  const height = 240;
  const x = screenX + Math.round((screenWidth - width) / 2);
  const y = screenY; // 0px from physical top screen bezel!
  return { width, height, x, y, orientation: 'horizontal-center' };
}

function applyPosition(pos) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  currentPosition = pos;
  userConfig.position = pos;
  saveConfig(userConfig);

  const bounds = getWindowBoundsForPosition(pos);
  mainWindow.setBounds({
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height
  }, false);

  const eventData = {
    position: pos,
    orientation: bounds.orientation
  };
  mainWindow.webContents.send('position-changed', eventData);
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.webContents.send('position-changed', eventData);
  }
}

let settingsWindow = null;

function createSettingsWindow() {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;
  const width = 360;
  const height = 440;

  settingsWindow = new BrowserWindow({
    width,
    height,
    x: Math.round((screenWidth - width) / 2),
    y: Math.round((screenHeight - height) / 2),
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    type: 'toolbar',
    hasShadow: false,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, '../preload/index.js')
    }
  });

  settingsWindow.setMenu(null);
  settingsWindow.setAlwaysOnTop(true, 'screen-saver');
  settingsWindow.loadFile(path.join(__dirname, '../renderer/settings.html'));

  settingsWindow.on('blur', () => {
    if (settingsWindow && !settingsWindow.isDestroyed() && settingsWindow.isVisible()) {
      settingsWindow.webContents.send('request-close-card');
    }
  });

  settingsWindow.on('closed', () => {
    settingsWindow = null;
  });
}

function createWindow() {
  const bounds = getWindowBoundsForPosition(currentPosition);

  mainWindow = new BrowserWindow({
    width: bounds.width,
    height: bounds.height,
    x: bounds.x,
    y: bounds.y,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    type: 'toolbar',
    hasShadow: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, '../preload/index.js')
    }
  });

  mainWindow.setMenu(null);
  mainWindow.setAlwaysOnTop(true, 'screen-saver');
  mainWindow.setIgnoreMouseEvents(true, { forward: true });
  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.webContents.send('position-changed', {
      position: currentPosition,
      orientation: bounds.orientation
    });
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function extractModelName(model) {
  if (!model) return 'Antigravity';
  if (typeof model === 'string') return model;
  if (typeof model === 'object') {
    return model.display_name || model.displayName || model.label || model.name || model.id || 'Antigravity';
  }
  return String(model);
}

// Local HTTP Server to receive events from Antigravity CLI
function startServer() {
  const PORT = 8998;
  const server = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    if (req.method === 'POST' && (req.url === '/update' || req.url === '/event')) {
      let body = '';
      req.on('data', chunk => {
        body += chunk.toString();
      });

      req.on('end', () => {
        try {
          const data = JSON.parse(body || '{}');
          handleAgentEvent(data);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ status: 'ok' }));
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        }
      });
      return;
    }

    if (req.method === 'GET' && req.url === '/ping') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'online', app: 'gravibuddy' }));
      return;
    }

    res.writeHead(404);
    res.end();
  });

  server.listen(PORT, '127.0.0.1', () => {
    console.log(`[gravibuddy] Bridge server listening on http://127.0.0.1:${PORT}`);
  });
}

let watchdogTimer = null;
const activeSessions = new Map();
const STATE_PRIORITY = { waiting: 4, thinking: 3, done: 2, idle: 1 };

function handleAgentEvent(payload) {
  if (!mainWindow || mainWindow.isDestroyed()) return;

  const rawState = (payload.agent_state || payload.state || 'idle').toLowerCase();
  const isWaitingConfirmation = payload.tool_confirmation_pending === true;
  let state = 'idle';

  if (isWaitingConfirmation || rawState.includes('wait') || rawState.includes('auth') || rawState.includes('question')) {
    state = 'waiting';
  } else if (rawState.includes('think') || rawState.includes('work') || rawState.includes('run') || rawState.includes('coding') || rawState === 'tool_use') {
    state = 'thinking';
  } else if (rawState === 'done') {
    state = 'done';
  } else if (rawState === 'idle' && payload.source !== 'antigravity-2.0' && lastState === 'thinking') {
    state = 'done';
  } else {
    state = 'idle';
  }

  lastState = (state === 'done') ? 'idle' : state;

  // Extract project name from payload or workspacePaths if available
  let projectName = payload.project || payload.projectName || null;
  if (!projectName && Array.isArray(payload.workspacePaths) && payload.workspacePaths.length > 0) {
    projectName = path.basename(payload.workspacePaths[0]);
  }

  const sessionId = payload.conversationId || projectName || 'default';
  const modelName = extractModelName(payload.model);

  const ctxUsed = payload.context_window?.used_percentage;
  const contextPercent = typeof ctxUsed === 'number' ? Math.round(ctxUsed) : null;

  let quotaFraction = payload.quota?.['gemini-5h']?.remaining_fraction ?? payload.quota?.['3p-5h']?.remaining_fraction;
  const quotaPercent = typeof quotaFraction === 'number' ? Math.round(quotaFraction * 100) : null;

  // Update or register session
  activeSessions.set(sessionId, {
    id: sessionId,
    project: projectName || 'Antigravity',
    state: state,
    model: modelName,
    message: payload.message || null,
    toolName: payload.toolName || null,
    quotaPercent,
    contextPercent,
    updatedAt: Date.now()
  });

  // Auto-expiry: Remove sessions that are idle/done and haven't updated for >5 minutes
  const now = Date.now();
  for (const [id, sess] of activeSessions.entries()) {
    if ((sess.state === 'done' || sess.state === 'idle') && (now - sess.updatedAt > 300000)) {
      activeSessions.delete(id);
    }
  }

  // Priority Bubbling: waiting > thinking > done > idle
  const sessionsList = Array.from(activeSessions.values());
  sessionsList.sort((a, b) => {
    const diff = (STATE_PRIORITY[b.state] || 1) - (STATE_PRIORITY[a.state] || 1);
    if (diff !== 0) return diff;
    return (b.updatedAt || 0) - (a.updatedAt || 0);
  });

  const heroSession = sessionsList[0] || {
    id: sessionId,
    project: projectName || 'Antigravity',
    state,
    model: modelName,
    message: payload.message || null,
    toolName: payload.toolName || null,
    quotaPercent,
    contextPercent
  };

  // Safety watchdog to prevent ghost thinking states if connection drops abruptly
  if (state === 'thinking') {
    clearTimeout(watchdogTimer);
    watchdogTimer = setTimeout(() => {
      if (lastState === 'thinking') {
        lastState = 'idle';
        if (activeSessions.has(sessionId)) {
          activeSessions.get(sessionId).state = 'idle';
        }
        mainWindow?.webContents?.send('agent-update', {
          state: 'idle',
          model: modelName,
          project: projectName,
          quotaPercent: 95,
          sessions: Array.from(activeSessions.values()),
          heroId: sessionId,
          timestamp: Date.now()
        });
      }
    }, 180000);
  } else {
    clearTimeout(watchdogTimer);
    watchdogTimer = null;
  }

  const eventData = {
    state: heroSession.state,
    project: heroSession.project,
    model: heroSession.model,
    plan: payload.plan_tier || 'Google AI Pro',
    cost: payload.cost?.total_usd ?? payload.cost ?? null,
    contextPercent: heroSession.contextPercent,
    quotaPercent: heroSession.quotaPercent,
    message: heroSession.message,
    toolName: heroSession.toolName,
    timestamp: Date.now(),
    sessions: sessionsList,
    heroId: heroSession.id
  };

  mainWindow.webContents.send('agent-update', eventData);
}

ipcMain.on('focus-antigravity', () => {
  try {
    const { exec } = require('child_process');
    const cmd = `powershell -NoProfile -Command "(Get-Process -Name 'Antigravity','Code','WindowsTerminal' -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne 0 } | Select-Object -First 1) | ForEach-Object { (New-Object -ComObject WScript.Shell).AppActivate($_.Id) }"`;
    exec(cmd);
  } catch (e) {}
});

ipcMain.on('dismiss-session', (event, sessionId) => {
  if (sessionId && activeSessions.has(sessionId)) {
    const sess = activeSessions.get(sessionId);
    sess.state = 'idle';
    sess.message = 'Acknowledged';
    sess.updatedAt = Date.now();
  } else if (!sessionId) {
    for (const sess of activeSessions.values()) {
      sess.state = 'idle';
      sess.updatedAt = Date.now();
    }
  }
  const sessionsList = Array.from(activeSessions.values());
  sessionsList.sort((a, b) => {
    const diff = (STATE_PRIORITY[b.state] || 1) - (STATE_PRIORITY[a.state] || 1);
    if (diff !== 0) return diff;
    return (b.updatedAt || 0) - (a.updatedAt || 0);
  });
  const heroSession = sessionsList[0];
  if (heroSession && mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('agent-update', {
      state: heroSession.state,
      project: heroSession.project,
      model: heroSession.model,
      message: heroSession.message,
      toolName: heroSession.toolName,
      quotaPercent: heroSession.quotaPercent,
      contextPercent: heroSession.contextPercent,
      timestamp: Date.now(),
      sessions: sessionsList,
      heroId: heroSession.id
    });
  }
});

// IPC Handlers
ipcMain.on('set-position', (event, pos) => {
  applyPosition(pos);
});

ipcMain.on('get-initial-config', event => {
  const bounds = getWindowBoundsForPosition(currentPosition);
  event.reply('initial-config', {
    ...userConfig,
    position: currentPosition,
    orientation: bounds.orientation
  });
});

function broadcastConfigChange() {
  const cfgPayload = {
    ...userConfig,
    position: currentPosition,
    orientation: getWindowBoundsForPosition(currentPosition).orientation
  };
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('initial-config', cfgPayload);
  }
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.webContents.send('initial-config', cfgPayload);
  }
}

ipcMain.on('save-sound-config', (event, soundEnabled) => {
  userConfig.sound = soundEnabled;
  saveConfig(userConfig);
  broadcastConfigChange();
});

ipcMain.on('save-sleep-config', (event, sleepEnabled) => {
  userConfig.sleepMode = sleepEnabled;
  saveConfig(userConfig);
  broadcastConfigChange();
});

ipcMain.on('save-stealth-config', (event, stealthEnabled) => {
  userConfig.stealthMode = stealthEnabled;
  saveConfig(userConfig);
  broadcastConfigChange();
});

ipcMain.on('save-thinking-preview-config', (event, previewEnabled) => {
  userConfig.thinkingPreview = previewEnabled;
  saveConfig(userConfig);
  broadcastConfigChange();
});

ipcMain.on('save-auto-close-done-config', (event, duration) => {
  userConfig.autoCloseDoneDuration = typeof duration === 'number' ? duration : 5;
  saveConfig(userConfig);
  broadcastConfigChange();
});

ipcMain.on('toggle-settings', () => {
  if (!settingsWindow || settingsWindow.isDestroyed()) {
    createSettingsWindow();
  }
  if (settingsWindow.isVisible()) {
    settingsWindow.webContents.send('request-close-card');
  } else {
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;
    settingsWindow.setPosition(
      Math.round((screenWidth - 360) / 2),
      Math.round((screenHeight - 440) / 2)
    );
    settingsWindow.webContents.send('initial-config', {
      ...userConfig,
      position: currentPosition,
      orientation: getWindowBoundsForPosition(currentPosition).orientation
    });
    settingsWindow.show();
    settingsWindow.focus();
    settingsWindow.webContents.send('request-open-card');
  }
});

ipcMain.on('close-settings', () => {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.hide();
  }
});

ipcMain.on('quit-app', () => {
  app.quit();
});


ipcMain.on('set-ignore-mouse-events', (event, ignore, options) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win && !win.isDestroyed()) {
    win.setIgnoreMouseEvents(ignore, options);
  }
});

app.whenReady().then(() => {
  createWindow();
  createSettingsWindow();
  startServer();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
