const { app, BrowserWindow, screen, ipcMain, dialog } = require('electron');
const { spawn } = require('child_process');
const http = require('http');
const path = require('path');
const fs = require('fs');

let mainWindow = null;
let lastState = 'idle';
let currentPosition = 'center'; // 'center' | 'left' | 'right'

const CONFIG_FILE = path.join(app.getPath('userData'), 'gravibuddy-config.json');
const LEGACY_CONFIG_FILE = path.join(app.getPath('userData'), 'vibing-config.json');
const AGY_SETTINGS_FILE = path.join(app.getPath('home'), '.gemini', 'antigravity-cli', 'settings.json');

function loadConfig() {
  let cfg = { position: 'center', sound: true, sleepMode: true, stealthMode: true, thinkingPreview: true, recentWorkspaces: [] };
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

function getWorkspaces() {
  const list = new Set(userConfig.recentWorkspaces || []);
  try {
    if (fs.existsSync(AGY_SETTINGS_FILE)) {
      const data = JSON.parse(fs.readFileSync(AGY_SETTINGS_FILE, 'utf8'));
      (data.trustedWorkspaces || []).forEach(p => {
        if (p && fs.existsSync(p) && p !== app.getPath('home')) list.add(p);
      });
    }
  } catch (e) {}
  return Array.from(list);
}

function launchAgyInWorkspace(projectDir) {
  if (!projectDir || !fs.existsSync(projectDir)) return false;

  userConfig.lastOpenedWorkspace = projectDir;
  const recents = (userConfig.recentWorkspaces || []).filter(p => p !== projectDir);
  userConfig.recentWorkspaces = [projectDir, ...recents].slice(0, 8);
  saveConfig(userConfig);

  try {
    const wtProc = spawn('wt.exe', ['-d', projectDir, 'powershell.exe', '-NoExit', '-Command', 'agy'], {
      detached: true,
      stdio: 'ignore'
    });
    wtProc.on('error', () => {
      const psProc = spawn('powershell.exe', ['-NoExit', '-Command', `Set-Location -LiteralPath '${projectDir}'; agy`], {
        detached: true,
        stdio: 'ignore'
      });
      psProc.unref();
    });
    wtProc.unref();
    return true;
  } catch (err) {
    const psProc = spawn('powershell.exe', ['-NoExit', '-Command', `Set-Location -LiteralPath '${projectDir}'; agy`], {
      detached: true,
      stdio: 'ignore'
    });
    psProc.unref();
    return true;
  }
}

function getWindowBoundsForPosition(pos) {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { x: screenX, y: screenY, width: screenWidth, height: screenHeight } = primaryDisplay.bounds;

  if (pos === 'left') {
    const width = 460;
    const height = 480;
    const x = screenX;
    const y = screenY + Math.round((screenHeight - height) / 2);
    return { width, height, x, y, orientation: 'vertical-left' };
  }

  if (pos === 'right') {
    const width = 460;
    const height = 480;
    const x = screenX + screenWidth - width;
    const y = screenY + Math.round((screenHeight - height) / 2);
    return { width, height, x, y, orientation: 'vertical-right' };
  }

  // Default: Center Top Attached Hardware Notch (Flush with bezel)
  const width = 520;
  const height = 480;
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

  mainWindow.webContents.send('position-changed', {
    position: pos,
    orientation: bounds.orientation
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
    skipTaskbar: false,
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

function handleAgentEvent(payload) {
  if (!mainWindow || mainWindow.isDestroyed()) return;

  const rawState = (payload.agent_state || payload.state || 'idle').toLowerCase();
  const isWaitingConfirmation = payload.tool_confirmation_pending === true;
  let state = 'idle';

  if (isWaitingConfirmation || rawState.includes('wait') || rawState.includes('auth')) {
    state = 'waiting';
  } else if (rawState.includes('think') || rawState.includes('work') || rawState.includes('run') || rawState.includes('coding') || rawState === 'tool_use') {
    state = 'thinking';
  } else {
    if (lastState === 'thinking') {
      state = 'done';
    } else {
      state = 'idle';
    }
  }

  lastState = (state === 'done') ? 'idle' : state;

  const ctxUsed = payload.context_window?.used_percentage;
  const contextPercent = typeof ctxUsed === 'number' ? Math.round(ctxUsed) : null;

  let quotaFraction = payload.quota?.['gemini-5h']?.remaining_fraction ?? payload.quota?.['3p-5h']?.remaining_fraction;
  const quotaPercent = typeof quotaFraction === 'number' ? Math.round(quotaFraction * 100) : null;

  const eventData = {
    state,
    model: extractModelName(payload.model),
    plan: payload.plan_tier || 'Google AI Pro',
    cost: payload.cost?.total_usd ?? payload.cost ?? null,
    contextPercent,
    quotaPercent,
    message: payload.message || null,
    timestamp: Date.now()
  };

  mainWindow.webContents.send('agent-update', eventData);
}

// IPC Handlers
ipcMain.on('set-position', (event, pos) => {
  applyPosition(pos);
});

ipcMain.on('get-initial-config', event => {
  const bounds = getWindowBoundsForPosition(currentPosition);
  event.reply('initial-config', {
    ...userConfig,
    orientation: bounds.orientation
  });
});

ipcMain.on('save-sound-config', (event, soundEnabled) => {
  userConfig.sound = soundEnabled;
  saveConfig(userConfig);
});

ipcMain.on('save-sleep-config', (event, sleepEnabled) => {
  userConfig.sleepMode = sleepEnabled;
  saveConfig(userConfig);
});

ipcMain.on('save-stealth-config', (event, stealthEnabled) => {
  userConfig.stealthMode = stealthEnabled;
  saveConfig(userConfig);
});

ipcMain.on('save-thinking-preview-config', (event, previewEnabled) => {
  userConfig.thinkingPreview = previewEnabled;
  saveConfig(userConfig);
});

ipcMain.on('reset-to-idle', () => {
  lastState = 'idle';
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('agent-update', {
      state: 'idle',
      model: 'Antigravity',
      plan: 'Google AI Pro',
      cost: null,
      contextPercent: null,
      quotaPercent: 95,
      message: null,
      timestamp: Date.now()
    });
  }
});

ipcMain.handle('get-workspaces-data', () => {
  return {
    workspaces: getWorkspaces(),
    lastOpened: userConfig.lastOpenedWorkspace || null
  };
});

ipcMain.on('launch-workspace', (event, dirPath) => {
  launchAgyInWorkspace(dirPath);
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('workspaces-updated', {
      workspaces: getWorkspaces(),
      lastOpened: userConfig.lastOpenedWorkspace
    });
  }
});

ipcMain.on('browse-and-launch', async () => {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Select Project Folder for Antigravity',
    properties: ['openDirectory']
  });
  if (!result.canceled && result.filePaths.length > 0) {
    const selectedPath = result.filePaths[0];
    launchAgyInWorkspace(selectedPath);
    mainWindow.webContents.send('workspaces-updated', {
      workspaces: getWorkspaces(),
      lastOpened: userConfig.lastOpenedWorkspace
    });
  }
});

ipcMain.on('set-ignore-mouse-events', (event, ignore, options) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win && !win.isDestroyed()) {
    win.setIgnoreMouseEvents(ignore, options);
  }
});

app.whenReady().then(() => {
  createWindow();
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
