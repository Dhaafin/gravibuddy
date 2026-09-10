const { ipcRenderer } = require('electron');

// DOM Elements
const islandRoot = document.getElementById('islandRoot');
const island = document.getElementById('island');
const primaryLabel = document.getElementById('primaryLabel');
const secondaryLabel = document.getElementById('secondaryLabel');
const metricVal = document.getElementById('metricVal');
const settingsCard = document.getElementById('settingsCard');
const vState = document.getElementById('vState');
const vQuota = document.getElementById('vQuota');
const sleepIndicator = document.getElementById('sleepIndicator');

const btnSettings = document.getElementById('btnSettings');
const btnCloseSettings = document.getElementById('btnCloseSettings');
const btnPosLeft = document.getElementById('btnPosLeft');
const btnPosCenter = document.getElementById('btnPosCenter');
const btnPosRight = document.getElementById('btnPosRight');
const btnToggleSound = document.getElementById('btnToggleSound');
const appleToggleSound = document.getElementById('appleToggleSound');
const btnToggleSleep = document.getElementById('btnToggleSleep');
const appleToggleSleep = document.getElementById('appleToggleSleep');

const testThinking = document.getElementById('testThinking');
const testDone = document.getElementById('testDone');
const testWait = document.getElementById('testWait');
const testSleep = document.getElementById('testSleep');
const testIdle = document.getElementById('testIdle');

// State Variables
let soundEnabled = true;
let sleepModeEnabled = true;
let currentPosition = 'center'; // 'center' | 'left' | 'right'
let currentState = 'idle';
let sleepTimer = null;
let isSwitchingPosition = false;

// Prevent Windows native context menu & toggle settings on right click
window.addEventListener('contextmenu', e => {
  e.preventDefault();
  toggleSettings();
});

function formatModelName(model) {
  if (!model) return 'Antigravity';
  if (typeof model === 'string') return model;
  if (typeof model === 'object') {
    return model.display_name || model.displayName || model.label || model.name || model.id || 'Antigravity';
  }
  return String(model);
}

// ==========================================================
// Web Audio Synthesizer (Apple Chimes & Bubble Pops)
// ==========================================================
let audioCtx = null;

function getAudioContext() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

function playChime(type = 'success') {
  if (!soundEnabled) return;
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    gain.connect(ctx.destination);
    osc.connect(gain);

    if (type === 'success') {
      // Apple completion chime: E5 -> B5
      osc.frequency.setValueAtTime(659.25, now);
      osc.frequency.exponentialRampToValueAtTime(987.77, now + 0.16);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
      osc.start(now);
      osc.stop(now + 0.55);
    } else if (type === 'alert') {
      // Gentle warning ping: 880Hz
      osc.frequency.setValueAtTime(880, now);
      gain.gain.setValueAtTime(0.07, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc.start(now);
      osc.stop(now + 0.35);
    }
  } catch (err) {
    console.error('Audio chime error:', err);
  }
}

function playPopSound(type = 'blossom') {
  if (!soundEnabled) return;
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    gain.connect(ctx.destination);
    osc.connect(gain);

    if (type === 'blossom') {
      // Crisp liquid bubble pop: sweeps from 420Hz to 880Hz
      osc.frequency.setValueAtTime(420, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.06);
      gain.gain.setValueAtTime(0.09, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      osc.start(now);
      osc.stop(now + 0.12);
    } else if (type === 'implode') {
      // Gentle droplet collapse / reverse suction: sweeps from 700Hz to 320Hz
      osc.frequency.setValueAtTime(700, now);
      osc.frequency.exponentialRampToValueAtTime(320, now + 0.08);
      gain.gain.setValueAtTime(0.06, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);
      osc.start(now);
      osc.stop(now + 0.11);
    }
  } catch (err) {
    console.error('Pop sound error:', err);
  }
}

// ==========================================================
// Fluid Watery Morphing & Light Sheen Trigger
// ==========================================================
function triggerWateryMorph() {
  island.classList.remove('watery-morph', 'sheen-active');
  void island.offsetWidth; // Force CSS reflow
  island.classList.add('watery-morph', 'sheen-active');
  setTimeout(() => {
    island.classList.remove('watery-morph', 'sheen-active');
  }, 680);
}

// ==========================================================
// Sleep Mode (Option 1: Ultra-Thin Notch Tab)
// ==========================================================
function clearSleepTimer() {
  if (sleepTimer) {
    clearTimeout(sleepTimer);
    sleepTimer = null;
  }
}

function wakeUpIsland() {
  clearSleepTimer();
  if (island.classList.contains('is-sleeping')) {
    island.classList.remove('is-sleeping');
    triggerWateryMorph();
    playPopSound('blossom');
  }
}

function enterSleepMode() {
  if (!sleepModeEnabled) return;
  if (currentState !== 'idle') return;
  if (settingsCard.classList.contains('visible')) return;
  if (isSwitchingPosition) return;
  if (isInteractiveArea) return;

  island.classList.add('is-sleeping');
}

function scheduleSleep(delay = 4500) {
  clearSleepTimer();
  if (!sleepModeEnabled) return;
  if (currentState !== 'idle') return;
  if (settingsCard.classList.contains('visible')) return;
  if (isSwitchingPosition) return;

  sleepTimer = setTimeout(() => {
    enterSleepMode();
  }, delay);
}

// ==========================================================
// Intelligent Zero-Padding Click-Through Pass
// (As long as mouse is not touching the pill/settings, clicks pass right through!)
// ==========================================================
let isInteractiveArea = false;

function checkInteractiveHit(e) {
  const hit = document.elementFromPoint(e.clientX, e.clientY);
  const overIsland = Boolean(island && (island === hit || island.contains(hit)));
  const overSettings = Boolean(settingsCard && settingsCard.classList.contains('visible') && (settingsCard === hit || settingsCard.contains(hit)));
  const shouldBeInteractive = overIsland || overSettings;

  if (shouldBeInteractive !== isInteractiveArea) {
    isInteractiveArea = shouldBeInteractive;
    if (isInteractiveArea) {
      ipcRenderer.send('set-ignore-mouse-events', false);
      wakeUpIsland();
    } else {
      ipcRenderer.send('set-ignore-mouse-events', true, { forward: true });
      scheduleSleep(3500);
    }
  }
}

window.addEventListener('mousemove', checkInteractiveHit);

window.addEventListener('mouseleave', () => {
  if (isInteractiveArea) {
    isInteractiveArea = false;
    ipcRenderer.send('set-ignore-mouse-events', true, { forward: true });
  }
  scheduleSleep(3500);
});

window.addEventListener('blur', () => {
  if (settingsCard.classList.contains('visible')) {
    settingsCard.classList.remove('visible');
  }
  if (isInteractiveArea) {
    isInteractiveArea = false;
    ipcRenderer.send('set-ignore-mouse-events', true, { forward: true });
  }
  scheduleSleep(3500);
});

// ==========================================================
// Agent State Updates & Dynamic Reactions
// ==========================================================
function updateIslandState(data) {
  const modelLabel = formatModelName(data.model);

  if (data.state !== currentState) {
    triggerWateryMorph();
    currentState = data.state;
  }

  // Activity immediately wakes the island from sleep
  wakeUpIsland();

  island.classList.remove('state-thinking', 'state-done', 'state-waiting');

  if (data.state === 'thinking') {
    island.classList.add('state-thinking');
    primaryLabel.textContent = 'Antigravity Coding';
    secondaryLabel.textContent = data.message || `Processing with ${modelLabel}`;
    metricVal.textContent = 'ACTIVE';
    vState.textContent = 'BUSY';
  } else if (data.state === 'done') {
    island.classList.add('state-done');
    primaryLabel.textContent = 'Task Completed';
    secondaryLabel.textContent = `Ready for next prompt • ${modelLabel}`;
    metricVal.textContent = 'DONE';
    vState.textContent = 'DONE';
    playChime('success');

    // Display celebration for 4.5s then return to idle
    setTimeout(() => {
      if (!island.classList.contains('state-thinking') && !island.classList.contains('state-waiting')) {
        island.classList.remove('state-done');
        triggerWateryMorph();
        currentState = 'idle';
        primaryLabel.textContent = 'Antigravity';
        secondaryLabel.textContent = modelLabel;
        metricVal.textContent = data.quotaPercent !== null ? `${data.quotaPercent}% QTA` : 'READY';
        vState.textContent = 'IDLE';
        scheduleSleep(4000);
      }
    }, 4500);
  } else if (data.state === 'waiting') {
    island.classList.add('state-waiting');
    primaryLabel.textContent = 'Action Required';
    secondaryLabel.textContent = data.message || 'Waiting for tool approval in terminal';
    metricVal.textContent = 'WAIT';
    vState.textContent = 'WAIT';
    playChime('alert');
  } else {
    // Normal Idle
    primaryLabel.textContent = 'Antigravity';
    secondaryLabel.textContent = modelLabel;
    metricVal.textContent = data.quotaPercent !== null ? `${data.quotaPercent}% QTA` : (data.contextPercent !== null ? `${data.contextPercent}% CTX` : 'READY');
    vState.textContent = 'IDLE';
    scheduleSleep(4500);
  }

  if (data.quotaPercent !== null && data.quotaPercent !== undefined) {
    vQuota.textContent = `${data.quotaPercent}%`;
  }
}

ipcRenderer.on('agent-update', (event, data) => {
  updateIslandState(data);
});

// ==========================================================
// Settings UI Logic
// ==========================================================
function toggleSettings() {
  wakeUpIsland();
  settingsCard.classList.toggle('visible');
  if (!settingsCard.classList.contains('visible')) {
    scheduleSleep(3500);
  }
}

btnSettings.addEventListener('click', e => {
  e.stopPropagation();
  toggleSettings();
});

btnCloseSettings.addEventListener('click', e => {
  e.stopPropagation();
  settingsCard.classList.remove('visible');
  scheduleSleep(3500);
});

document.addEventListener('click', e => {
  if (!settingsCard.contains(e.target) && !btnSettings.contains(e.target)) {
    if (settingsCard.classList.contains('visible')) {
      settingsCard.classList.remove('visible');
      scheduleSleep(3500);
    }
  }
});

function applyOrientationClasses(orientation) {
  islandRoot.classList.remove('vertical-left', 'vertical-right');
  if (orientation === 'vertical-left') {
    islandRoot.classList.add('vertical-left');
  } else if (orientation === 'vertical-right') {
    islandRoot.classList.add('vertical-right');
  }
}

function setActivePositionButton(pos) {
  [btnPosLeft, btnPosCenter, btnPosRight].forEach(btn => {
    btn.classList.toggle('active', btn.dataset.pos === pos);
  });
}

// ==========================================================
// Seamless 3-Phase Position Switching ("Enak Banget")
// ==========================================================
function transitionToPosition(targetPos, targetOrientation) {
  if (isSwitchingPosition) return;
  if (currentPosition === targetPos) return;

  isSwitchingPosition = true;
  clearSleepTimer();

  const wasSettingsOpen = settingsCard.classList.contains('visible');

  // Step 1: Smoothly fold out settings card if open
  if (wasSettingsOpen) {
    settingsCard.classList.add('folding-out');
  }

  // Step 2: Liquid droplet implosion (collapse)
  island.classList.remove('is-sleeping', 'watery-morph', 'island-blossom');
  island.classList.add('switching-implode');
  playPopSound('implode');

  setTimeout(() => {
    // Step 3: Change window bounds and orientation while 100% invisible
    ipcRenderer.send('set-position', targetPos);
    currentPosition = targetPos;
    setActivePositionButton(targetPos);
    applyOrientationClasses(targetOrientation);

    // Prepare for entry at new location
    island.classList.remove('switching-implode');
    island.classList.add('switching-prep');

    // Wait 80ms for Electron and Windows DWM to finish transparent window repositioning
    setTimeout(() => {
      island.classList.remove('switching-prep');
      island.classList.add('island-blossom');
      
      playPopSound('blossom');
      triggerWateryMorph();

      // If settings was previously open, smoothly restore it next to the island
      if (wasSettingsOpen) {
        setTimeout(() => {
          settingsCard.classList.remove('folding-out');
          settingsCard.classList.add('visible');
          isSwitchingPosition = false;
        }, 180);
      } else {
        setTimeout(() => {
          isSwitchingPosition = false;
          scheduleSleep(4500);
        }, 350);
      }

      // Cleanup blossom class
      setTimeout(() => {
        island.classList.remove('island-blossom');
      }, 650);

    }, 80);
  }, 220);
}

btnPosLeft.addEventListener('click', () => {
  transitionToPosition('left', 'vertical-left');
});

btnPosCenter.addEventListener('click', () => {
  transitionToPosition('center', 'horizontal-center');
});

btnPosRight.addEventListener('click', () => {
  transitionToPosition('right', 'vertical-right');
});

ipcRenderer.on('position-changed', (event, info) => {
  const pos = typeof info === 'string' ? info : info.position;
  const orientation = typeof info === 'object' ? info.orientation : null;
  currentPosition = pos;
  setActivePositionButton(pos);
  if (orientation) applyOrientationClasses(orientation);
  if (!isSwitchingPosition) scheduleSleep(4000);
});

// Sound Toggle
btnToggleSound.addEventListener('click', () => {
  soundEnabled = !soundEnabled;
  appleToggleSound.classList.toggle('active', soundEnabled);
  ipcRenderer.send('save-sound-config', soundEnabled);
  if (soundEnabled) playChime('success');
});

// Sleep Mode Toggle
btnToggleSleep.addEventListener('click', () => {
  sleepModeEnabled = !sleepModeEnabled;
  appleToggleSleep.classList.toggle('active', sleepModeEnabled);
  ipcRenderer.send('save-sleep-config', sleepModeEnabled);
  if (!sleepModeEnabled) {
    wakeUpIsland();
  } else {
    scheduleSleep(3000);
  }
});

// ==========================================================
// Settings Test Buttons
// ==========================================================
testThinking.addEventListener('click', () => {
  updateIslandState({ state: 'thinking', model: 'Gemini 3.8 Flash (High)' });
});

testDone.addEventListener('click', () => {
  updateIslandState({ state: 'done', model: 'Gemini 3.8 Flash (High)' });
});

testWait.addEventListener('click', () => {
  updateIslandState({ state: 'waiting', model: 'Gemini 3.8 Flash (High)' });
});

testSleep.addEventListener('click', () => {
  // Test immediate sleep mode entry
  settingsCard.classList.remove('visible');
  currentState = 'idle';
  enterSleepMode();
});

testIdle.addEventListener('click', () => {
  wakeUpIsland();
  updateIslandState({ state: 'idle', model: 'Gemini 3.8 Flash (High)', quotaPercent: 94 });
});

// ==========================================================
// Initial Config Restoration
// ==========================================================
ipcRenderer.send('get-initial-config');
ipcRenderer.on('initial-config', (event, cfg) => {
  if (cfg) {
    if (cfg.position) {
      currentPosition = cfg.position;
      setActivePositionButton(cfg.position);
    }
    if (cfg.orientation) applyOrientationClasses(cfg.orientation);
    if (cfg.sound !== undefined) {
      soundEnabled = cfg.sound;
      appleToggleSound.classList.toggle('active', soundEnabled);
    }
    if (cfg.sleepMode !== undefined) {
      sleepModeEnabled = cfg.sleepMode;
      appleToggleSleep.classList.toggle('active', sleepModeEnabled);
    }
    scheduleSleep(4000);
  }
});
