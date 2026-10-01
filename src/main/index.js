const { app, BrowserWindow } = require('electron');
const { createWindow, createSettingsWindow } = require('./windows');
const { registerIpcHandlers } = require('./ipc-handlers');
const { startServer } = require('./bridge-server');

registerIpcHandlers();

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
