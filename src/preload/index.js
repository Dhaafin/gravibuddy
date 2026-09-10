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
  onWorkspacesUpdated: (callback) => {
    ipcRenderer.on('workspaces-updated', (_, data) => callback(data));
  },

  // Actions
  getInitialConfig: () => {
    ipcRenderer.send('get-initial-config');
  },
  getWorkspacesData: () => {
    return ipcRenderer.invoke('get-workspaces-data');
  },
  launchWorkspace: (dirPath) => {
    ipcRenderer.send('launch-workspace', dirPath);
  },
  browseAndLaunch: () => {
    ipcRenderer.send('browse-and-launch');
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
  toggleSettings: () => {
    ipcRenderer.send('toggle-settings');
  },
  closeSettings: () => {
    ipcRenderer.send('close-settings');
  },
  testState: (stateData) => {
    ipcRenderer.send('test-state', stateData);
  },
  resetToIdle: () => {
    ipcRenderer.send('reset-to-idle');
  }
});
