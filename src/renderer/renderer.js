const api = window.graviAPI;

// DOM Elements
const islandRoot = document.getElementById('islandRoot');
const island = document.getElementById('island');
const compactView = document.getElementById('compactView');
const expandedView = document.getElementById('expandedView');
const primaryLabel = document.getElementById('primaryLabel');
const secondaryLabel = document.getElementById('secondaryLabel');
const metricVal = document.getElementById('metricVal');
const gaugeFill = document.getElementById('gaugeFill');
const glyphIdle = document.getElementById('glyphIdle');
const glyphThinking = document.getElementById('glyphThinking');
const glyphWaiting = document.getElementById('glyphWaiting');
const glyphDone = document.getElementById('glyphDone');
const vTooltipDot = document.getElementById('vTooltipDot');
const vTooltipStatus = document.getElementById('vTooltipStatus');
const vTooltipModel = document.getElementById('vTooltipModel');
const vGlyphBtn = document.getElementById('vGlyphBtn');
const btnSettings = document.getElementById('btnSettings');
const btnMiniClose = document.getElementById('btnMiniClose');
const countdownBar = document.getElementById('countdownBar');

// Expanded View DOM Elements
const agentTabsDeck = document.getElementById('agentTabsDeck');
const expandedOrb = document.getElementById('expandedOrb');
const expandedAgentName = document.getElementById('expandedAgentName');
const expandedStatusBadge = document.getElementById('expandedStatusBadge');
const expandedModelPill = document.getElementById('expandedModelPill');
const expandedMessage = document.getElementById('expandedMessage');
const expandedToolRow = document.getElementById('expandedToolRow');
const expandedToolTag = document.getElementById('expandedToolTag');
const expandedQuotaBadge = document.getElementById('expandedQuotaBadge');
const btnExpandedSettings = document.getElementById('btnExpandedSettings');
const btnHeaderRetract = document.getElementById('btnHeaderRetract');
const btnFocusAntigravity = document.getElementById('btnFocusAntigravity');
const btnDismissActive = document.getElementById('btnDismissActive');
const btnRetractExpanded = document.getElementById('btnRetractExpanded');

// State Variables
let soundEnabled = true;
let sleepModeEnabled = true;
let stealthCodingEnabled = true; // Zen Mode: Stay tucked during thinking, emerge only on alerts/done
let thinkingPreviewEnabled = true; // Peek on task start, then tuck into sleep
let autoCloseDoneDuration = 5; // Seconds to auto-dismiss on done (0 = manual)
let currentPosition = 'center'; // 'center' | 'left' | 'right'
let currentState = 'idle';
let sleepTimer = null;
let thinkingPreviewTimer = null;
let doneAutoDismissTimer = null;
let doneCountdownStartTimer = null;
let isSwitchingPosition = false;
let isInteractiveArea = false;
let wakeHoverTimer = null;
let retractTimer = null;
let isExpanded = false;
let activeSessionsList = [];
let selectedSessionId = null;

// Prevent Windows native context menu & toggle center settings window
window.addEventListener('contextmenu', e => {
  e.preventDefault();
  api.toggleSettings();
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
// Dual-Scale Morphing (Notch Kecil <-> Notch Gede ~620x185)
// ==========================================================
function hasAnyWaitingSession() {
  if (currentState === 'waiting') return true;
  return activeSessionsList.some(s => s.state === 'waiting');
}

function getActiveSession() {
  if (selectedSessionId) {
    const found = activeSessionsList.find(s => s.id === selectedSessionId);
    if (found) return found;
  }
  return activeSessionsList[0] || null;
}

function getOrbIconSvg(state) {
  if (state === 'thinking') {
    return `<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
      <path d="M12 1.5C12 7.298 7.298 12 1.5 12C7.298 12 12 16.702 12 22.5C12 16.702 16.702 12 22.5 12C16.702 12 12 7.298 12 1.5Z" />
    </svg>`;
  }
  if (state === 'waiting') {
    return `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
      <line x1="12" y1="9" x2="12" y2="13"></line>
      <line x1="12" y1="17" x2="12.01" y2="17"></line>
    </svg>`;
  }
  if (state === 'done') {
    return `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>`;
  }
  return `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M12 2.5L19.5 12L12 21.5L4.5 12L12 2.5Z" fill="currentColor" fill-opacity="0.18" />
    <circle cx="12" cy="12" r="2.5" fill="currentColor" />
  </svg>`;
}

function renderAgentTabs() {
  if (!agentTabsDeck) return;
  agentTabsDeck.innerHTML = '';

  if (activeSessionsList.length === 0) return;

  activeSessionsList.forEach(sess => {
    const btn = document.createElement('button');
    btn.className = `agent-tab ${sess.id === selectedSessionId ? 'active' : ''}`;
    btn.dataset.id = sess.id;
    btn.title = `${sess.project} (${sess.state || 'idle'})`;

    const dot = document.createElement('span');
    dot.className = `agent-tab-dot dot-${sess.state || 'idle'}`;

    const label = document.createElement('span');
    label.className = 'agent-tab-label';
    label.textContent = sess.project || 'Agent';

    btn.appendChild(dot);
    btn.appendChild(label);

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      selectedSessionId = sess.id;
      renderAgentTabs();
      renderActiveSessionDetail();
    });

    agentTabsDeck.appendChild(btn);
  });
}

function renderActiveSessionDetail() {
  const sess = getActiveSession();
  if (!sess) return;

  const state = sess.state || 'idle';
  const modelName = formatModelName(sess.model);

  if (expandedOrb) {
    expandedOrb.className = `expanded-orb orb-${state}`;
    expandedOrb.innerHTML = getOrbIconSvg(state);
  }

  if (expandedAgentName) {
    expandedAgentName.textContent = sess.project || 'Antigravity';
  }

  if (expandedStatusBadge) {
    expandedStatusBadge.className = `expanded-status-badge badge-${state}`;
    if (state === 'thinking') expandedStatusBadge.textContent = 'Thinking';
    else if (state === 'waiting') expandedStatusBadge.textContent = 'Action Required';
    else if (state === 'done') expandedStatusBadge.textContent = 'Done';
    else expandedStatusBadge.textContent = 'Standby';
  }

  if (expandedModelPill) {
    expandedModelPill.textContent = modelName;
  }

  if (expandedMessage) {
    let msg = sess.message;
    if (!msg) {
      if (state === 'thinking') msg = `Processing with ${modelName}...`;
      else if (state === 'waiting') msg = 'Action or approval required';
      else if (state === 'done') msg = 'Task completed successfully';
      else msg = 'Ready & listening';
    }
    expandedMessage.textContent = msg;
  }

  if (expandedToolRow && expandedToolTag) {
    if (sess.toolName) {
      expandedToolRow.style.display = 'flex';
      expandedToolTag.textContent = `Tool: ${sess.toolName}`;
    } else {
      expandedToolRow.style.display = 'none';
    }
  }

  if (expandedQuotaBadge) {
    const qPct = sess.quotaPercent ?? 95;
    expandedQuotaBadge.textContent = `${qPct}% QTA`;
  }
}

function clearRetractTimer() {
  if (retractTimer) {
    clearTimeout(retractTimer);
    retractTimer = null;
  }
}

function expandToLuxuryCard() {
  if (currentPosition !== 'center') return;
  clearRetractTimer();
  if (island.classList.contains('is-sleeping')) {
    wakeUpIsland('expand');
  }
  if (!isExpanded) {
    isExpanded = true;
    island.classList.add('is-expanded');
    playPopSound('blossom');
  }
  renderAgentTabs();
  renderActiveSessionDetail();
}

function collapseToCompact(force = false) {
  if (!force && hasAnyWaitingSession()) return;
  clearRetractTimer();
  if (isExpanded) {
    isExpanded = false;
    island.classList.remove('is-expanded');
    playPopSound('implode');
  }
}

function scheduleRetraction(delay = 350) {
  if (hasAnyWaitingSession()) return;
  if (!isExpanded) return;
  clearRetractTimer();
  retractTimer = setTimeout(() => {
    retractTimer = null;
    collapseToCompact();
  }, delay);
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

function enterSleepMode(force = false) {
  clearSleepTimer();
  if (!sleepModeEnabled && !force) return;
  if (isSwitchingPosition) return;
  if (isInteractiveArea && !force) return; // Never sleep while user is hovering unless forced
  if (isExpanded && !force) return; // Never sleep while luxury card is open unless forced

  if (!force) {
    if (currentState === 'waiting' || hasAnyWaitingSession()) return;
    if (currentState === 'done') return;
    if (currentState === 'thinking' && !stealthCodingEnabled) return;
  }

  collapseToCompact(true);
  island.classList.add('is-sleeping');
  if (force) {
    isInteractiveArea = false;
    api.setIgnoreMouseEvents(true, { forward: true });
  }
}

function scheduleSleep(delay = 1400, force = false) {
  if (!sleepModeEnabled && !force) return;
  if (isSwitchingPosition) return;
  if (island.classList.contains('is-sleeping')) return;
  if (!force && (currentState === 'waiting' || hasAnyWaitingSession() || currentState === 'done')) return;
  if (isExpanded && !force) return;

  if (sleepTimer && !force) return;

  clearSleepTimer();
  sleepTimer = setTimeout(() => {
    sleepTimer = null;
    enterSleepMode(force);
  }, delay);
}

// Auto-Dismiss Helpers for Task Completion
function cancelDoneAutoDismiss() {
  if (doneAutoDismissTimer) {
    clearTimeout(doneAutoDismissTimer);
    doneAutoDismissTimer = null;
  }
  if (doneCountdownStartTimer) {
    clearTimeout(doneCountdownStartTimer);
    doneCountdownStartTimer = null;
  }
  if (countdownBar) {
    countdownBar.classList.remove('active');
    countdownBar.style.removeProperty('--cd-duration');
  }
}

function dismissDoneState() {
  cancelDoneAutoDismiss();
  if (currentState === 'done') {
    currentState = 'idle';
    island.classList.remove('state-done');
    triggerWateryMorph();
    updateIslandLabels({ state: 'idle' }, 'Antigravity');
    scheduleSleep(600, true);
  }
}

function scheduleDoneAutoDismiss() {
  cancelDoneAutoDismiss();
  if (autoCloseDoneDuration <= 0) return; // 0 = manual dismissal only

  const totalMs = autoCloseDoneDuration * 1000;
  const countdownMs = Math.min(2000, totalMs);
  const delayBeforeCountdown = Math.max(0, totalMs - countdownMs);

  doneCountdownStartTimer = setTimeout(() => {
    if (currentState === 'done' && countdownBar && !isInteractiveArea) {
      countdownBar.style.setProperty('--cd-duration', `${countdownMs}ms`);
      countdownBar.classList.add('active');
    }
  }, delayBeforeCountdown);

  doneAutoDismissTimer = setTimeout(() => {
    dismissDoneState();
  }, totalMs);
}

// Mini Close / Retract button: Force immediate sleep without keyboard shortcut
// Mini Close / Retract button: Force immediate sleep without keyboard shortcut
if (btnMiniClose) {
  btnMiniClose.addEventListener('click', e => {
    e.stopPropagation();
    cancelDoneAutoDismiss();
    collapseToCompact(true);
    if (currentState === 'done') {
      currentState = 'idle';
      island.classList.remove('state-done');
      updateIslandLabels({ state: 'idle' }, 'Antigravity');
    }
    enterSleepMode(true);
  });
}

// Action Buttons inside Expanded Notch Gede
if (btnFocusAntigravity) {
  btnFocusAntigravity.addEventListener('click', (e) => {
    e.stopPropagation();
    api.focusAntigravity();
  });
}

if (btnDismissActive) {
  btnDismissActive.addEventListener('click', (e) => {
    e.stopPropagation();
    const sess = getActiveSession();
    const idToDismiss = sess ? sess.id : null;
    api.dismissSession(idToDismiss);
  });
}

if (btnRetractExpanded) {
  btnRetractExpanded.addEventListener('click', (e) => {
    e.stopPropagation();
    collapseToCompact(true);
  });
}

if (btnHeaderRetract) {
  btnHeaderRetract.addEventListener('click', (e) => {
    e.stopPropagation();
    collapseToCompact(true);
  });
}

if (btnExpandedSettings) {
  btnExpandedSettings.addEventListener('click', (e) => {
    e.stopPropagation();
    api.toggleSettings();
  });
}

// Click to wake immediately when sleeping or expand to luxury card
island.addEventListener('click', e => {
  if (btnSettings.contains(e.target) || (btnMiniClose && btnMiniClose.contains(e.target)) || e.target.closest('button')) return;
  if (island.classList.contains('is-sleeping')) {
    if (wakeHoverTimer) {
      clearTimeout(wakeHoverTimer);
      wakeHoverTimer = null;
    }
    wakeUpIsland('click');
    if (currentPosition === 'center') {
      expandToLuxuryCard();
    }
    return;
  }
  if (!isExpanded && currentPosition === 'center') {
    expandToLuxuryCard();
    return;
  }
  if (currentState === 'done') {
    dismissDoneState();
  }
});

// ==========================================================
// Intelligent Zero-Padding Click-Through Pass & Hover Intent
// ==========================================================
function checkInteractiveHit(e) {
  const hit = document.elementFromPoint(e.clientX, e.clientY);
  const shouldBeInteractive = Boolean(island && (island === hit || island.contains(hit)));

  if (shouldBeInteractive !== isInteractiveArea) {
    isInteractiveArea = shouldBeInteractive;
    if (isInteractiveArea) {
      // Mouse touched the island or controls
      api.setIgnoreMouseEvents(false);
      clearRetractTimer();

      // If in done state, pause countdown bar while user is reading/interacting
      if (currentState === 'done') {
        cancelDoneAutoDismiss();
      }

      // If it was sleeping, check hover intent with debounce (160ms)
      if (island.classList.contains('is-sleeping')) {
        if (wakeHoverTimer) clearTimeout(wakeHoverTimer);
        wakeHoverTimer = setTimeout(() => {
          if (isInteractiveArea && island.classList.contains('is-sleeping')) {
            wakeUpIsland('hover');
            if (currentPosition === 'center') {
              expandToLuxuryCard();
            }
          }
        }, 160);
      } else {
        if (currentPosition === 'center') {
          expandToLuxuryCard();
        }
      }
    } else {
      // Mouse left the interactive surfaces: clicks pass right through immediately!
      if (wakeHoverTimer) {
        clearTimeout(wakeHoverTimer);
        wakeHoverTimer = null;
      }
      api.setIgnoreMouseEvents(true, { forward: true });

      // Trigger retraction with 350ms grace period (unless waiting)
      scheduleRetraction(350);

      // Persistent open: never sleep if waiting!
      if (currentState === 'waiting' || hasAnyWaitingSession()) {
        return;
      }
      // If done state, resume auto-dismiss countdown
      if (currentState === 'done') {
        scheduleDoneAutoDismiss();
        return;
      }
      // If in stealth coding mode and thinking: tuck back to sleep after short delay
      if (currentState === 'thinking' && stealthCodingEnabled) {
        scheduleSleep(1200, true);
      } else if (currentState === 'idle') {
        scheduleSleep(1400, true);
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
  scheduleRetraction(350);

  if (currentState === 'waiting' || hasAnyWaitingSession()) return;
  if (currentState === 'done') {
    scheduleDoneAutoDismiss();
    return;
  }
  if (currentState === 'thinking' && stealthCodingEnabled) {
    scheduleSleep(1200, true);
  } else if (currentState === 'idle') {
    scheduleSleep(1400, true);
  }
});

window.addEventListener('blur', () => {
  if (wakeHoverTimer) {
    clearTimeout(wakeHoverTimer);
    wakeHoverTimer = null;
  }
  if (isInteractiveArea) {
    isInteractiveArea = false;
    api.setIgnoreMouseEvents(true, { forward: true });
  }
  scheduleRetraction(350);

  if (currentState === 'waiting' || hasAnyWaitingSession()) return;
  if (currentState === 'done') {
    scheduleDoneAutoDismiss();
    return;
  }
  if (currentState === 'thinking' && stealthCodingEnabled) {
    enterSleepMode();
  } else if (currentState === 'idle') {
    scheduleSleep(1400, true);
  }
});

function updateRadialGauge(quotaPercent) {
  if (!gaugeFill) return;
  const pct = Math.max(0, Math.min(100, quotaPercent ?? 95));
  // Circle radius 18.5 -> Circumference = 2 * PI * 18.5 = 116.24
  const offset = 116.24 * (1 - pct / 100);
  gaugeFill.style.strokeDasharray = '116.24';
  gaugeFill.style.strokeDashoffset = offset.toFixed(1);

  if (pct <= 15) {
    gaugeFill.style.stroke = '#ef4444';
  } else if (pct <= 35) {
    gaugeFill.style.stroke = '#f59e0b';
  } else {
    gaugeFill.style.stroke = '#10b981';
  }
}

function updateStateGlyph(state, modelLabel, message) {
  const glyphs = [glyphIdle, glyphThinking, glyphWaiting, glyphDone];
  glyphs.forEach(g => {
    if (g) g.classList.remove('active');
  });

  const model = modelLabel || 'Antigravity';
  if (vTooltipModel) vTooltipModel.textContent = model;

  if (state === 'thinking') {
    if (glyphThinking) glyphThinking.classList.add('active');
    if (vTooltipStatus) vTooltipStatus.textContent = 'Coding...';
    if (vTooltipDot) vTooltipDot.className = 'v-tooltip-dot dot-thinking';
  } else if (state === 'waiting') {
    if (glyphWaiting) glyphWaiting.classList.add('active');
    if (vTooltipStatus) vTooltipStatus.textContent = message || 'Action Required';
    if (vTooltipDot) vTooltipDot.className = 'v-tooltip-dot dot-waiting';
  } else if (state === 'done') {
    if (glyphDone) glyphDone.classList.add('active');
    if (vTooltipStatus) vTooltipStatus.textContent = 'Task Completed';
    if (vTooltipDot) vTooltipDot.className = 'v-tooltip-dot dot-done';
  } else {
    if (glyphIdle) glyphIdle.classList.add('active');
    if (vTooltipStatus) vTooltipStatus.textContent = 'Standby';
    if (vTooltipDot) vTooltipDot.className = 'v-tooltip-dot dot-idle';
  }
}

// ==========================================================
// Content & Label Formatter
// ==========================================================
function updateIslandLabels(data, modelLabel) {
  updateRadialGauge(data.quotaPercent);
  updateStateGlyph(data.state, modelLabel, data.message);

  if (data.state === 'thinking') {
    primaryLabel.textContent = data.project || 'Antigravity Coding';
    secondaryLabel.textContent = data.message || `Processing with ${modelLabel}`;
    metricVal.textContent = 'ACTIVE';
  } else if (data.state === 'done') {
    primaryLabel.textContent = data.project ? `${data.project} • Done` : 'Task Completed';
    secondaryLabel.textContent = `Ready for next prompt • ${modelLabel}`;
    metricVal.textContent = 'DONE';
  } else if (data.state === 'waiting') {
    primaryLabel.textContent = data.project ? `${data.project} • Action` : 'Action Required';
    secondaryLabel.textContent = data.message || 'Waiting for approval';
    metricVal.textContent = 'WAIT';
  } else {
    primaryLabel.textContent = data.project || 'Antigravity';
    secondaryLabel.textContent = modelLabel;
    metricVal.textContent = data.quotaPercent !== null && data.quotaPercent !== undefined
      ? `${data.quotaPercent}% QTA`
      : (data.contextPercent !== null && data.contextPercent !== undefined ? `${data.contextPercent}% CTX` : 'READY');
  }
}

// ==========================================================
// Agent State Updates (Zen Coding & Terminal Bug Fix)
// ==========================================================
function updateIslandState(data) {
  // Sync sessions list
  if (Array.isArray(data.sessions) && data.sessions.length > 0) {
    activeSessionsList = data.sessions;
  } else {
    activeSessionsList = [{
      id: data.heroId || 'default',
      project: data.project || 'Antigravity',
      state: data.state || 'idle',
      model: data.model || 'Antigravity',
      message: data.message || null,
      toolName: data.toolName || null,
      quotaPercent: data.quotaPercent,
      contextPercent: data.contextPercent
    }];
  }

  // Priority bubbling: if any session is waiting, focus it automatically!
  const waitingSess = activeSessionsList.find(s => s.state === 'waiting');
  if (waitingSess) {
    selectedSessionId = waitingSess.id;
  } else if (!selectedSessionId || !activeSessionsList.some(s => s.id === selectedSessionId)) {
    selectedSessionId = data.heroId || activeSessionsList[0].id;
  }

  renderAgentTabs();
  renderActiveSessionDetail();

  const modelLabel = formatModelName(data.model);
  const previousState = currentState;
  const targetState = data.state || 'idle';
  const stateChanged = previousState !== targetState;
  currentState = targetState;

  // Always update text and metrics in DOM quietly
  updateIslandLabels(data, modelLabel);

  if (targetState === 'waiting' || hasAnyWaitingSession()) {
    // 🚨 ACTION REQUIRED: Must bloom open immediately and STAY open until user proceeds!
    cancelDoneAutoDismiss();
    clearTimeout(thinkingPreviewTimer);
    thinkingPreviewTimer = null;
    clearSleepTimer();
    clearRetractTimer();

    wakeUpIsland('alert');
    expandToLuxuryCard();
    island.classList.remove('state-thinking', 'state-done');
    island.classList.add('state-waiting');
    triggerWateryMorph();
    playChime('alert');
  } else if (targetState === 'done') {
    // 🌟 TASK COMPLETED: Bloom open and auto-retract according to user duration preference
    cancelDoneAutoDismiss();
    clearTimeout(thinkingPreviewTimer);
    thinkingPreviewTimer = null;
    clearSleepTimer();

    wakeUpIsland('done');
    island.classList.remove('state-thinking', 'state-waiting');
    island.classList.add('state-done');
    triggerWateryMorph();
    playChime('success');
    scheduleDoneAutoDismiss();
  } else if (targetState === 'thinking') {
    // 🟣 CODING / THINKING:
    cancelDoneAutoDismiss();
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
            if (currentState === 'thinking' && !isInteractiveArea && !isExpanded) {
              enterSleepMode();
            }
          }, 2500);
        } else {
          // Immediate stealth: Stay tucked without popping up
          clearTimeout(thinkingPreviewTimer);
          thinkingPreviewTimer = null;
          if (!isInteractiveArea && !isExpanded) {
            enterSleepMode();
          }
        }
      } else {
        wakeUpIsland('thinking');
      }
    } else {
      // Periodic update while still thinking: keep asleep if stealth mode active
      if (stealthCodingEnabled && !thinkingPreviewTimer && !isInteractiveArea && !isExpanded) {
        enterSleepMode();
      }
    }
  } else {
    // 🟢 NORMAL IDLE:
    cancelDoneAutoDismiss();
    clearTimeout(thinkingPreviewTimer);
    thinkingPreviewTimer = null;
    island.classList.remove('state-thinking', 'state-done', 'state-waiting');

    if (stateChanged) {
      triggerWateryMorph();
      scheduleSleep(1200, true);
    } else {
      // Periodic idle telemetry from terminal
      if (!island.classList.contains('is-sleeping') && !isInteractiveArea && !isExpanded) {
        scheduleSleep(1400, false);
      }
    }
  }
}

api.onAgentUpdate((data) => {
  updateIslandState(data);
});

// ==========================================================
// Settings Button & Config Synchronization
// ==========================================================
btnSettings.addEventListener('click', (e) => {
  e.stopPropagation();
  api.toggleSettings();
});

function applyOrientationClasses(orientation) {
  islandRoot.classList.remove('vertical-left', 'vertical-right');
  if (orientation === 'vertical-left') {
    islandRoot.classList.add('vertical-left');
  } else if (orientation === 'vertical-right') {
    islandRoot.classList.add('vertical-right');
  }
}

api.onPositionChanged((info) => {
  const pos = typeof info === 'string' ? info : info.position;
  const orientation = typeof info === 'object' ? info.orientation : null;
  currentPosition = pos;
  if (orientation) applyOrientationClasses(orientation);
  if (currentPosition !== 'center') {
    collapseToCompact(true);
  }
  triggerWateryMorph();
  playPopSound('blossom');
  scheduleSleep(4000);
});

api.getInitialConfig();
api.onInitialConfig((cfg) => {
  if (cfg) {
    if (cfg.position) currentPosition = cfg.position;
    if (cfg.orientation) applyOrientationClasses(cfg.orientation);
    if (cfg.sound !== undefined) soundEnabled = cfg.sound;
    if (cfg.sleepMode !== undefined) sleepModeEnabled = cfg.sleepMode;
    if (cfg.stealthMode !== undefined) stealthCodingEnabled = cfg.stealthMode;
    if (cfg.thinkingPreview !== undefined) thinkingPreviewEnabled = cfg.thinkingPreview;
    if (cfg.autoCloseDoneDuration !== undefined) autoCloseDoneDuration = cfg.autoCloseDoneDuration;
    scheduleSleep(4000);
  }
});
