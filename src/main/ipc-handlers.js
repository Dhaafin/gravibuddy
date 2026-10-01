const { app, BrowserWindow, ipcMain } = require('electron');
const { exec } = require('child_process');
const { userConfig, saveConfig } = require('./config');
const {
  applyPosition,
  getConfigPayload,
  broadcastConfigChange,
  toggleSettingsWindow,
  closeSettingsWindow
} = require('./windows');
const { dismissSession } = require('./session-manager');

const FOCUS_CMD = `powershell -NoProfile -Command "(Get-Process -Name 'Antigravity','Code','WindowsTerminal' -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne 0 } | Select-Object -First 1) | ForEach-Object { (New-Object -ComObject WScript.Shell).AppActivate($_.Id) }"`;

function updatePreference(key, value) {
  userConfig[key] = value;
  saveConfig(userConfig);
  broadcastConfigChange();
}

function registerIpcHandlers() {
  ipcMain.on('focus-antigravity', () => {
    try {
      exec(FOCUS_CMD);
    } catch (e) {}
  });

  ipcMain.on('dismiss-session', (_event, sessionId) => {
    dismissSession(sessionId);
  });

  ipcMain.on('set-position', (_event, pos) => {
    applyPosition(pos);
  });

  ipcMain.on('get-initial-config', event => {
    event.reply('initial-config', getConfigPayload());
  });

  ipcMain.on('save-sound-config', (_event, val) => updatePreference('sound', val));
  ipcMain.on('save-sleep-config', (_event, val) => updatePreference('sleepMode', val));
  ipcMain.on('save-stealth-config', (_event, val) => updatePreference('stealthMode', val));
  ipcMain.on('save-thinking-preview-config', (_event, val) => updatePreference('thinkingPreview', val));
  ipcMain.on('save-auto-close-done-config', (_event, duration) => {
    updatePreference('autoCloseDoneDuration', typeof duration === 'number' ? duration : 5);
  });

  ipcMain.on('toggle-settings', () => toggleSettingsWindow());
  ipcMain.on('close-settings', () => closeSettingsWindow());
  ipcMain.on('quit-app', () => app.quit());

  ipcMain.on('set-ignore-mouse-events', (event, ignore, options) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win && !win.isDestroyed()) {
      win.setIgnoreMouseEvents(ignore, options);
    }
  });
}

module.exports = { registerIpcHandlers };
