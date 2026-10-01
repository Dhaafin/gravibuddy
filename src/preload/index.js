const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('graviAPI', {
  // Event listeners
  onAgentUpdate: (callback) => {
    ipcRenderer.on('agent-update', (_, data) => callback(data));
  },
  onPositionChanged: (callback) => {
    ipcRenderer.on('position-changed', (_, data) => callback(data));
  },
  onInitialConfig: (callback) => {
    ipcRenderer.on('initial-config', (_, data) => callback(data));
  },
  onRequestClose: (callback) => {
    ipcRenderer.on('request-close-card', () => callback());
  },
  onRequestOpen: (callback) => {
    ipcRenderer.on('request-open-card', () => callback());
  },
  // Actions
  getInitialConfig: () => {
    ipcRenderer.send('get-initial-config');
  },
  setPosition: (pos) => {
    ipcRenderer.send('set-position', pos);
  },
  setIgnoreMouseEvents: (ignore, options) => {
    ipcRenderer.send('set-ignore-mouse-events', ignore, options);
  },
  saveSoundConfig: (enabled) => {
    ipcRenderer.send('save-sound-config', enabled);
  },
  saveSleepConfig: (enabled) => {
    ipcRenderer.send('save-sleep-config', enabled);
  },
  saveStealthConfig: (enabled) => {
    ipcRenderer.send('save-stealth-config', enabled);
  },
  saveThinkingPreviewConfig: (enabled) => {
    ipcRenderer.send('save-thinking-preview-config', enabled);
  },
  saveAutoCloseDoneConfig: (duration) => {
    ipcRenderer.send('save-auto-close-done-config', duration);
  },
  toggleSettings: () => {
    ipcRenderer.send('toggle-settings');
  },
  closeSettings: () => {
    ipcRenderer.send('close-settings');
  },
  focusAntigravity: () => {
    ipcRenderer.send('focus-antigravity');
  },
  dismissSession: (sessionId) => {
    ipcRenderer.send('dismiss-session', sessionId);
  },
  quitApp: () => {
    ipcRenderer.send('quit-app');
  }
});
