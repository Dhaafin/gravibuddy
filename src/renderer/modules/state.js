// Centralized reactive state store and helper accessors
export const state = {
  // User Configurable Preferences
  soundEnabled: true,
  sleepModeEnabled: true,
  stealthCodingEnabled: true,
  thinkingPreviewEnabled: true,
  autoCloseDoneDuration: 5,
  currentPosition: 'center',

  // HUD State & Status
  currentState: 'idle',
  isSwitchingPosition: false,
  isInteractiveArea: false,
  isExpanded: false,
  activeSessionsList: [],
  selectedSessionId: null,

  // Runtime Timers
  sleepTimer: null,
  thinkingPreviewTimer: null,
  doneAutoDismissTimer: null,
  doneCountdownStartTimer: null,
  wakeHoverTimer: null,
  retractTimer: null,
  waitingNudgeTimer: null,
  waitingNudgePeekTimer: null
};

export function formatModelName(model) {
  if (!model) return 'Antigravity';
  if (typeof model === 'string') return model;
  if (typeof model === 'object') {
    return model.display_name || model.displayName || model.label || model.name || model.id || 'Antigravity';
  }
  return String(model);
}

export function getActiveSession() {
  if (state.selectedSessionId) {
    const found = state.activeSessionsList.find(s => s.id === state.selectedSessionId);
    if (found) return found;
  }
  return state.activeSessionsList[0] || null;
}

export function hasAnyWaitingSession() {
  if (state.currentState === 'waiting') return true;
  return state.activeSessionsList.some(s => s.state === 'waiting');
}

export function clearSleepTimer() {
  if (state.sleepTimer) {
    clearTimeout(state.sleepTimer);
    state.sleepTimer = null;
  }
}

export function clearRetractTimer() {
  if (state.retractTimer) {
    clearTimeout(state.retractTimer);
    state.retractTimer = null;
  }
}

export function clearWakeHoverTimer() {
  if (state.wakeHoverTimer) {
    clearTimeout(state.wakeHoverTimer);
    state.wakeHoverTimer = null;
  }
}

export function clearThinkingPreviewTimer() {
  if (state.thinkingPreviewTimer) {
    clearTimeout(state.thinkingPreviewTimer);
    state.thinkingPreviewTimer = null;
  }
}

export function cancelDoneAutoDismiss(countdownBar) {
  if (state.doneAutoDismissTimer) {
    clearTimeout(state.doneAutoDismissTimer);
    state.doneAutoDismissTimer = null;
  }
  if (state.doneCountdownStartTimer) {
    clearTimeout(state.doneCountdownStartTimer);
    state.doneCountdownStartTimer = null;
  }
  if (countdownBar) {
    countdownBar.classList.remove('active');
    countdownBar.style.removeProperty('--cd-duration');
  }
}

export function clearWaitingNudgeTimers() {
  if (state.waitingNudgeTimer) {
    clearTimeout(state.waitingNudgeTimer);
    state.waitingNudgeTimer = null;
  }
  if (state.waitingNudgePeekTimer) {
    clearTimeout(state.waitingNudgePeekTimer);
    state.waitingNudgePeekTimer = null;
  }
}

