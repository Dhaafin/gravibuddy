const { app, BrowserWindow } = require('electron');
const { createWindow, createSettingsWindow } = require('./windows');
const { registerIpcHandlers } = require('./ipc-handlers');
const { startServer } = require('./bridge-server');

// Crash Resilience & Global Exception Guards
process.on('uncaughtException', (err) => {
  console.error('[gravibuddy] Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[gravibuddy] Unhandled Rejection at:', promise, 'reason:', reason);
});

// Windows Display Sleep & GPU recovery flags
app.commandLine.appendSwitch('disable-gpu-process-crash-limit');

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
