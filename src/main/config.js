const { app } = require('electron');
const path = require('path');
const fs = require('fs');

const CONFIG_FILE = path.join(app.getPath('userData'), 'gravibuddy-config.json');
const LEGACY_CONFIG_FILE = path.join(app.getPath('userData'), 'vibing-config.json');

const DEFAULT_CONFIG = {
  position: 'center',
  sound: true,
  sleepMode: true,
  stealthMode: true,
  thinkingPreview: true,
  autoCloseDoneDuration: 5
};

function loadConfig() {
  let cfg = { ...DEFAULT_CONFIG };
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

module.exports = {
  userConfig,
  saveConfig
};
