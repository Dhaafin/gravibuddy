const { BrowserWindow, screen } = require('electron');
const path = require('path');
const { userConfig, saveConfig } = require('./config');

let mainWindow = null;
let settingsWindow = null;
let currentPosition = userConfig.position || 'center';

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

  const width = 680;
  const height = 240;
  const x = screenX + Math.round((screenWidth - width) / 2);
  const y = screenY;
  return { width, height, x, y, orientation: 'horizontal-center' };
}

function getConfigPayload() {
  const bounds = getWindowBoundsForPosition(currentPosition);
  return {
    ...userConfig,
    position: currentPosition,
    orientation: bounds.orientation
  };
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

function broadcastConfigChange() {
  const cfgPayload = getConfigPayload();
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('initial-config', cfgPayload);
  }
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.webContents.send('initial-config', cfgPayload);
  }
}

function sendAgentUpdate(eventData) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('agent-update', eventData);
  }
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

function toggleSettingsWindow() {
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
    settingsWindow.webContents.send('initial-config', getConfigPayload());
    settingsWindow.show();
    settingsWindow.focus();
    settingsWindow.webContents.send('request-open-card');
  }
}

function closeSettingsWindow() {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.hide();
  }
}

function isMainWindowReady() {
  return Boolean(mainWindow && !mainWindow.isDestroyed());
}

module.exports = {
  createWindow,
  createSettingsWindow,
  toggleSettingsWindow,
  closeSettingsWindow,
  applyPosition,
  getConfigPayload,
  broadcastConfigChange,
  sendAgentUpdate,
  isMainWindowReady
};
