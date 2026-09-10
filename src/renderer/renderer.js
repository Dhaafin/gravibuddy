const api = window.graviAPI;

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
const btnToggleStealth = document.getElementById('btnToggleStealth');
const appleToggleStealth = document.getElementById('appleToggleStealth');
const btnToggleThinkingPreview = document.getElementById('btnToggleThinkingPreview');
const appleToggleThinkingPreview = document.getElementById('appleToggleThinkingPreview');

const testThinking = document.getElementById('testThinking');
const testDone = document.getElementById('testDone');
const testWait = document.getElementById('testWait');
const testSleep = document.getElementById('testSleep');
const testIdle = document.getElementById('testIdle');

// State Variables
let soundEnabled = true;
let sleepModeEnabled = true;
let stealthCodingEnabled = true; // Zen Mode: Stay tucked during thinking, emerge only on alerts/done
let thinkingPreviewEnabled = true; // Peek on task start, then tuck into sleep
let currentPosition = 'center'; // 'center' | 'left' | 'right'
let currentState = 'idle';
let sleepTimer = null;
let thinkingPreviewTimer = null;
let isSwitchingPosition = false;
let isInteractiveArea = false;
let wakeHoverTimer = null;

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
      // Gentle droplet collapse: sweeps from 700Hz to 320Hz
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
// Sleep Mode (Attached Notch Tab) & Wake Logic
// ==========================================================
function clearSleepTimer() {
  if (sleepTimer) {
    clearTimeout(sleepTimer);
    sleepTimer = null;
  }
}

function wakeUpIsland(reason = 'interaction') {
  clearSleepTimer();
  if (wakeHoverTimer) {
    clearTimeout(wakeHoverTimer);
    wakeHoverTimer = null;
  }
  if (island.classList.contains('is-sleeping')) {
    island.classList.remove('is-sleeping');
    triggerWateryMorph();
    playPopSound('blossom');
  }
}

function enterSleepMode() {
  clearSleepTimer();
  if (!sleepModeEnabled) return;
  if (settingsCard.classList.contains('visible')) return;
  if (isSwitchingPosition) return;
  if (isInteractiveArea) return; // Never sleep while user is hovering

  // In waiting or done states, keep visible so user sees the alert/result
  if (currentState === 'waiting') return;
  if (currentState === 'done') return;

  // In thinking state: sleep only if stealth coding mode is enabled
  if (currentState === 'thinking' && !stealthCodingEnabled) return;

  island.classList.add('is-sleeping');
}

function scheduleSleep(delay = 1400, force = false) {
  if (!sleepModeEnabled) return;
  if (settingsCard.classList.contains('visible')) return;
  if (isSwitchingPosition) return;
  if (island.classList.contains('is-sleeping')) return; // Already sleeping!
  if (currentState === 'waiting' || currentState === 'done') return; // Persistent open until next action!

  // If sleep timer is already actively counting down and not forced, let it finish!
  if (sleepTimer && !force) return;

  clearSleepTimer();
  sleepTimer = setTimeout(() => {
    sleepTimer = null;
    enterSleepMode();
  }, delay);
}

// Click to wake immediately when sleeping or dismiss done state
island.addEventListener('click', e => {
  if (btnSettings.contains(e.target) || e.target.closest('button')) return;
  if (island.classList.contains('is-sleeping')) {
    if (wakeHoverTimer) {
      clearTimeout(wakeHoverTimer);
      wakeHoverTimer = null;
    }
    wakeUpIsland('click');
    return;
  }
  if (currentState === 'done') {
    // User acknowledged completed task: smoothly return to idle
    currentState = 'idle';
    island.classList.remove('state-done');
    triggerWateryMorph();
    updateIslandLabels({ state: 'idle' }, 'Antigravity');
    scheduleSleep(1200, true);
  }
});

// ==========================================================
// Intelligent Zero-Padding Click-Through Pass & Hover Intent
// ==========================================================
function checkInteractiveHit(e) {
  const hit = document.elementFromPoint(e.clientX, e.clientY);
  const overIsland = Boolean(island && (island === hit || island.contains(hit)));
  const overSettings = Boolean(settingsCard && settingsCard.classList.contains('visible') && (settingsCard === hit || settingsCard.contains(hit)));
  const shouldBeInteractive = overIsland || overSettings;

  if (shouldBeInteractive !== isInteractiveArea) {
    isInteractiveArea = shouldBeInteractive;
    if (isInteractiveArea) {
      // Mouse touched the island or settings card
      api.setIgnoreMouseEvents(false);

      // If it was sleeping, check hover intent with debounce (160ms)
      // This prevents rapid cursor flicks over browser tabs from accidentally popping open the notch!
      if (island.classList.contains('is-sleeping')) {
        if (wakeHoverTimer) clearTimeout(wakeHoverTimer);
        wakeHoverTimer = setTimeout(() => {
          if (isInteractiveArea && island.classList.contains('is-sleeping')) {
            wakeUpIsland('hover');
          }
        }, 160);
      }
    } else {
      // Mouse left the interactive surfaces: clicks pass right through immediately!
      if (wakeHoverTimer) {
        clearTimeout(wakeHoverTimer);
        wakeHoverTimer = null;
      }
      api.setIgnoreMouseEvents(true, { forward: true });

      // Persistent open: never sleep if waiting or done!
      if (currentState === 'waiting' || currentState === 'done') {
        return;
      }
      // If in stealth coding mode and thinking: tuck back to sleep after short delay
      if (currentState === 'thinking' && stealthCodingEnabled) {
        scheduleSleep(800, true);
      } else if (currentState === 'idle') {
        scheduleSleep(1200, true);
      }
    }
  }
}

window.addEventListener('mousemove', checkInteractiveHit);

window.addEventListener('mouseleave', () => {
  if (wakeHoverTimer) {
    clearTimeout(wakeHoverTimer);
    wakeHoverTimer = null;
  }
  if (isInteractiveArea) {
    isInteractiveArea = false;
    api.setIgnoreMouseEvents(true, { forward: true });
  }
  if (currentState === 'waiting' || currentState === 'done') return;
  if (currentState === 'thinking' && stealthCodingEnabled) {
    scheduleSleep(800, true);
  } else if (currentState === 'idle') {
    scheduleSleep(1400, true);
  }
});

window.addEventListener('blur', () => {
  if (wakeHoverTimer) {
    clearTimeout(wakeHoverTimer);
    wakeHoverTimer = null;
  }
  if (settingsCard.classList.contains('visible')) {
    settingsCard.classList.remove('visible');
  }
  if (isInteractiveArea) {
    isInteractiveArea = false;
    api.setIgnoreMouseEvents(true, { forward: true });
  }
  if (currentState === 'waiting' || currentState === 'done') return;
  if (currentState === 'thinking' && stealthCodingEnabled) {
    enterSleepMode();
  } else if (currentState === 'idle') {
    scheduleSleep(1400, true);
  }
});

// ==========================================================
// Content & Label Formatter
// ==========================================================
function updateIslandLabels(data, modelLabel) {
  if (data.quotaPercent !== null && data.quotaPercent !== undefined) {
    vQuota.textContent = `${data.quotaPercent}%`;
  }

  if (data.state === 'thinking') {
    primaryLabel.textContent = 'Antigravity Coding';
    secondaryLabel.textContent = data.message || `Processing with ${modelLabel}`;
    metricVal.textContent = 'ACTIVE';
    vState.textContent = 'BUSY';
  } else if (data.state === 'done') {
    primaryLabel.textContent = 'Task Completed';
    secondaryLabel.textContent = `Ready for next prompt • ${modelLabel}`;
    metricVal.textContent = 'DONE';
    vState.textContent = 'DONE';
  } else if (data.state === 'waiting') {
    primaryLabel.textContent = 'Action Required';
    secondaryLabel.textContent = data.message || 'Waiting for tool approval in terminal';
    metricVal.textContent = 'WAIT';
    vState.textContent = 'WAIT';
  } else {
    primaryLabel.textContent = 'Antigravity';
    secondaryLabel.textContent = modelLabel;
    metricVal.textContent = data.quotaPercent !== null ? `${data.quotaPercent}% QTA` : (data.contextPercent !== null ? `${data.contextPercent}% CTX` : 'READY');
    vState.textContent = 'IDLE';
  }
}

// ==========================================================
// Agent State Updates (Zen Coding & Terminal Bug Fix)
// ==========================================================
function updateIslandState(data) {
  const modelLabel = formatModelName(data.model);
  const previousState = currentState;
  const targetState = data.state || 'idle';
  const stateChanged = previousState !== targetState;
  currentState = targetState;

  // Always update text and metrics in DOM quietly
  updateIslandLabels(data, modelLabel);

  if (targetState === 'waiting') {
    // 🚨 ACTION REQUIRED: Must bloom open immediately and STAY open until user proceeds!
    clearTimeout(thinkingPreviewTimer);
    thinkingPreviewTimer = null;
    clearSleepTimer();

    wakeUpIsland('alert');
    island.classList.remove('state-thinking', 'state-done');
    island.classList.add('state-waiting');
    triggerWateryMorph();
    playChime('alert');
  } else if (targetState === 'done') {
    // 🌟 TASK COMPLETED: Bloom open and STAY open until user clicks or next command starts!
    clearTimeout(thinkingPreviewTimer);
    thinkingPreviewTimer = null;
    clearSleepTimer();

    wakeUpIsland('done');
    island.classList.remove('state-thinking', 'state-waiting');
    island.classList.add('state-done');
    triggerWateryMorph();
    playChime('success');
  } else if (targetState === 'thinking') {
    // 🟣 CODING / THINKING:
    clearSleepTimer();
    island.classList.remove('state-done', 'state-waiting');
    island.classList.add('state-thinking');

    if (stateChanged) {
      triggerWateryMorph();
      if (stealthCodingEnabled) {
        if (thinkingPreviewEnabled) {
          // Peek on task start: Pop up for 2.5s, then automatically sleep
          wakeUpIsland('thinking-peek');
          clearTimeout(thinkingPreviewTimer);
          thinkingPreviewTimer = setTimeout(() => {
            thinkingPreviewTimer = null;
            if (currentState === 'thinking' && !isInteractiveArea && !settingsCard.classList.contains('visible')) {
              enterSleepMode();
            }
          }, 2500);
        } else {
          // Immediate stealth: Stay tucked without popping up
          clearTimeout(thinkingPreviewTimer);
          thinkingPreviewTimer = null;
          if (!isInteractiveArea && !settingsCard.classList.contains('visible')) {
            enterSleepMode();
          }
        }
      } else {
        wakeUpIsland('thinking');
      }
    } else {
      // Periodic update while still thinking: keep asleep if stealth mode active
      if (stealthCodingEnabled && !thinkingPreviewTimer && !isInteractiveArea && !settingsCard.classList.contains('visible')) {
        enterSleepMode();
      }
    }
  } else {
    // 🟢 NORMAL IDLE:
    clearTimeout(thinkingPreviewTimer);
    thinkingPreviewTimer = null;
    island.classList.remove('state-thinking', 'state-done', 'state-waiting');

    if (stateChanged) {
      triggerWateryMorph();
      scheduleSleep(1200, true);
    } else {
      // Periodic idle telemetry from terminal
      if (!island.classList.contains('is-sleeping') && !isInteractiveArea && !settingsCard.classList.contains('visible')) {
        scheduleSleep(1400, false);
      }
    }
  }
}

api.onAgentUpdate((data) => {
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
    api.setPosition(targetPos);
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

api.onPositionChanged((info) => {
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
  api.saveSoundConfig(soundEnabled);
  if (soundEnabled) playChime('success');
});

// Sleep Mode Toggle
btnToggleSleep.addEventListener('click', () => {
  sleepModeEnabled = !sleepModeEnabled;
  appleToggleSleep.classList.toggle('active', sleepModeEnabled);
  api.saveSleepConfig(sleepModeEnabled);
  if (!sleepModeEnabled) {
    wakeUpIsland();
  } else {
    scheduleSleep(3000);
  }
});

// Stealth Coding Mode Toggle
btnToggleStealth.addEventListener('click', () => {
  stealthCodingEnabled = !stealthCodingEnabled;
  appleToggleStealth.classList.toggle('active', stealthCodingEnabled);
  api.saveStealthConfig(stealthCodingEnabled);
  if (stealthCodingEnabled && currentState === 'thinking' && !isInteractiveArea) {
    enterSleepMode();
  } else if (!stealthCodingEnabled && currentState === 'thinking') {
    wakeUpIsland('stealth-off');
  }
});

// Peek on Task Start Toggle
if (btnToggleThinkingPreview && appleToggleThinkingPreview) {
  btnToggleThinkingPreview.addEventListener('click', () => {
    thinkingPreviewEnabled = !thinkingPreviewEnabled;
    appleToggleThinkingPreview.classList.toggle('active', thinkingPreviewEnabled);
    api.saveThinkingPreviewConfig(thinkingPreviewEnabled);
  });
}

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
  api.resetToIdle();
});

// ==========================================================
// Initial Config Restoration
// ==========================================================
api.getInitialConfig();
api.onInitialConfig((cfg) => {
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
    if (cfg.stealthMode !== undefined) {
      stealthCodingEnabled = cfg.stealthMode;
      appleToggleStealth.classList.toggle('active', stealthCodingEnabled);
    }
    if (cfg.thinkingPreview !== undefined && appleToggleThinkingPreview) {
      thinkingPreviewEnabled = cfg.thinkingPreview;
      appleToggleThinkingPreview.classList.toggle('active', thinkingPreviewEnabled);
    }
    scheduleSleep(4000);
  }
});
