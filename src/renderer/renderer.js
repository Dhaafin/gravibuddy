// Gravibuddy Floating Dynamic Island HUD — Main Renderer Orchestrator
import { dom } from './modules/dom.js';
import { 
  state, 
  formatModelName, 
  hasAnyWaitingSession, 
  clearSleepTimer, 
  clearRetractTimer, 
  cancelDoneAutoDismiss 
} from './modules/state.js';
import { playChime, playPopSound } from './modules/audio.js';
import { triggerWateryMorph } from './modules/effects.js';
import { updateIslandLabels, applyOrientationClasses } from './modules/compact-view.js';
import { 
  renderAgentList, 
  expandToLuxuryCard, 
  collapseToCompact 
} from './modules/expanded-view.js';
import { 
  wakeUpIsland, 
  enterSleepMode, 
  scheduleSleep, 
  scheduleDoneAutoDismiss 
} from './modules/lifecycle.js';
import { setupInteractions } from './modules/interaction.js';

const api = window.graviAPI;

// ==========================================================
// Agent State Updates & State Machine Router
// ==========================================================
function updateIslandState(data) {
  // Sync sessions list
  if (Array.isArray(data.sessions) && data.sessions.length > 0) {
    state.activeSessionsList = data.sessions;
  } else {
    state.activeSessionsList = [{
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
  const waitingSess = state.activeSessionsList.find(s => s.state === 'waiting');
  if (waitingSess) {
    state.selectedSessionId = waitingSess.id;
  } else if (!state.selectedSessionId || !state.activeSessionsList.some(s => s.id === state.selectedSessionId)) {
    state.selectedSessionId = data.heroId || state.activeSessionsList[0].id;
  }

  renderAgentList();

  const modelLabel = formatModelName(data.model);
  const previousState = state.currentState;
  const targetState = data.state || 'idle';
  const stateChanged = previousState !== targetState;
  state.currentState = targetState;

  // Always update text and metrics in DOM quietly
  updateIslandLabels(data, modelLabel);

  if (targetState === 'waiting' || hasAnyWaitingSession()) {
    // 🚨 ACTION REQUIRED: Notify clearly with amber aura and pulsing expand button
    cancelDoneAutoDismiss(dom.countdownBar);
    clearTimeout(state.thinkingPreviewTimer);
    state.thinkingPreviewTimer = null;
    clearSleepTimer();
    clearRetractTimer();

    wakeUpIsland('alert');
    if (state.isExpanded) {
      renderAgentList();
    }
    dom.island.classList.remove('state-thinking', 'state-done');
    dom.island.classList.add('state-waiting');
    if (dom.btnExpandCard && !state.isExpanded) {
      dom.btnExpandCard.classList.add('has-alert');
    }
    triggerWateryMorph();
    playChime('alert');
  } else if (targetState === 'done') {
    // 🌟 TASK COMPLETED: Ambient green chime and countdown
    cancelDoneAutoDismiss(dom.countdownBar);
    clearTimeout(state.thinkingPreviewTimer);
    state.thinkingPreviewTimer = null;
    clearSleepTimer();

    if (dom.btnExpandCard) {
      dom.btnExpandCard.classList.remove('has-alert');
    }
    wakeUpIsland('done');
    if (state.isExpanded) {
      renderAgentList();
    }
    dom.island.classList.remove('state-thinking', 'state-waiting');
    dom.island.classList.add('state-done');
    triggerWateryMorph();
    playChime('success');
    scheduleDoneAutoDismiss();
  } else if (targetState === 'thinking') {
    if (dom.btnExpandCard) {
      dom.btnExpandCard.classList.remove('has-alert');
    }
    // 🟣 CODING / THINKING:
    cancelDoneAutoDismiss(dom.countdownBar);
    clearSleepTimer();
    dom.island.classList.remove('state-done', 'state-waiting');
    dom.island.classList.add('state-thinking');

    if (state.isExpanded) {
      renderAgentList();
    }

    if (stateChanged) {
      triggerWateryMorph();
      if (state.stealthCodingEnabled) {
        if (state.thinkingPreviewEnabled) {
          // Peek on task start: Pop up for 2.5s, then automatically sleep
          wakeUpIsland('thinking-peek');
          clearTimeout(state.thinkingPreviewTimer);
          state.thinkingPreviewTimer = setTimeout(() => {
            state.thinkingPreviewTimer = null;
            if (state.currentState === 'thinking' && !state.isInteractiveArea) {
              enterSleepMode();
            }
          }, 2500);
        } else {
          // Immediate stealth: Stay tucked without popping up
          clearTimeout(state.thinkingPreviewTimer);
          state.thinkingPreviewTimer = null;
          if (!state.isInteractiveArea) {
            enterSleepMode();
          }
        }
      } else {
        wakeUpIsland('thinking');
      }
    } else {
      // Periodic update while still thinking: keep asleep if stealth mode active
      if (state.stealthCodingEnabled && !state.thinkingPreviewTimer && !state.isInteractiveArea) {
        enterSleepMode();
      }
    }
  } else {
    // 🟢 NORMAL IDLE:
    if (dom.btnExpandCard) {
      dom.btnExpandCard.classList.remove('has-alert');
    }
    cancelDoneAutoDismiss(dom.countdownBar);
    clearTimeout(state.thinkingPreviewTimer);
    state.thinkingPreviewTimer = null;
    dom.island.classList.remove('state-thinking', 'state-done', 'state-waiting');

    if (state.isExpanded) {
      renderAgentList();
    }

    if (stateChanged) {
      triggerWateryMorph();
      scheduleSleep(1200, true);
    } else {
      // Periodic idle telemetry from terminal
      if (!dom.island.classList.contains('is-sleeping') && !state.isInteractiveArea) {
        scheduleSleep(1400, false);
      }
    }
  }
}

// ==========================================================
// Initialization & IPC Synchronization
// ==========================================================
// Wire up user interactions & window listeners
setupInteractions(api);

// Bridge telemetry listener
api.onAgentUpdate((data) => {
  updateIslandState(data);
});

// Position & Orientation Synchronization
api.onPositionChanged((info) => {
  const pos = typeof info === 'string' ? info : info.position;
  const orientation = typeof info === 'object' ? info.orientation : null;
  state.currentPosition = pos;
  if (orientation) applyOrientationClasses(orientation);
  if (state.currentPosition !== 'center') {
    collapseToCompact(true);
  }
  triggerWateryMorph();
  playPopSound('blossom');
  scheduleSleep(4000);
});

// Initial Config Synchronization
api.getInitialConfig();
api.onInitialConfig((cfg) => {
  if (cfg) {
    if (cfg.position) state.currentPosition = cfg.position;
    if (cfg.orientation) applyOrientationClasses(cfg.orientation);
    if (cfg.sound !== undefined) state.soundEnabled = cfg.sound;
    if (cfg.sleepMode !== undefined) state.sleepModeEnabled = cfg.sleepMode;
    if (cfg.stealthMode !== undefined) state.stealthCodingEnabled = cfg.stealthMode;
    if (cfg.thinkingPreview !== undefined) state.thinkingPreviewEnabled = cfg.thinkingPreview;
    if (cfg.autoCloseDoneDuration !== undefined) state.autoCloseDoneDuration = cfg.autoCloseDoneDuration;
    scheduleSleep(4000);
  }
});

// Restore saved expanded/collapse mode preference
try {
  const savedExpanded = localStorage.getItem('gravi_deck_expanded') === 'true';
  if (savedExpanded && state.currentPosition === 'center') {
    expandToLuxuryCard();
  }
} catch (e) {}
