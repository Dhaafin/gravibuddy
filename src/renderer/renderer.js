import { dom } from './modules/dom.js';
import { 
  state, 
  formatModelName, 
  hasAnyWaitingSession, 
  clearSleepTimer, 
  clearThinkingPreviewTimer, 
  cancelDoneAutoDismiss,
  clearWaitingNudgeTimers 
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

function updateIslandState(data) {
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

  const waitingSess = state.activeSessionsList.find(s => s.state === 'waiting');
  if (waitingSess) {
    state.selectedSessionId = waitingSess.id;
  } else if (!state.selectedSessionId || !state.activeSessionsList.some(s => s.id === state.selectedSessionId)) {
    state.selectedSessionId = data.heroId || state.activeSessionsList[0].id;
  }

  if (data.wake === true) {
    wakeUpIsland('manual');
  }
  if (data.expand === true) {
    expandToLuxuryCard();
  } else if (data.expand === false) {
    collapseToCompact(true);
  }

  renderAgentList();

  const modelLabel = formatModelName(data.model);
  const previousState = state.currentState;
  const targetState = data.state || 'idle';
  const stateChanged = previousState !== targetState;
  state.currentState = targetState;

  updateIslandLabels(data, modelLabel);

  if (targetState === 'waiting' || hasAnyWaitingSession()) {
    cancelDoneAutoDismiss(dom.countdownBar);
    clearThinkingPreviewTimer();
    clearSleepTimer();

    wakeUpIsland('alert');
    dom.island.classList.remove('state-thinking', 'state-done');
    dom.island.classList.add('state-waiting');
    if (dom.btnExpandCard && !state.isExpanded) {
      dom.btnExpandCard.classList.add('has-alert');
    }
    if (stateChanged || previousState !== 'waiting') {
      triggerWateryMorph();
      playChime('alert');
    }
  } else if (targetState === 'done') {
    clearWaitingNudgeTimers();
    clearThinkingPreviewTimer();
    clearSleepTimer();

    dom.btnExpandCard?.classList.remove('has-alert');
    dom.island.classList.remove('state-thinking', 'state-waiting');
    dom.island.classList.add('state-done');
    if (stateChanged || data.completionTriggered) {
      cancelDoneAutoDismiss(dom.countdownBar);
      wakeUpIsland('done');
      triggerWateryMorph();
      playChime('success');
      scheduleDoneAutoDismiss();
    }
  } else if (targetState === 'thinking') {
    clearWaitingNudgeTimers();
    dom.btnExpandCard?.classList.remove('has-alert');
    cancelDoneAutoDismiss(dom.countdownBar);
    clearSleepTimer();
    dom.island.classList.remove('state-done', 'state-waiting');
    dom.island.classList.add('state-thinking');

    const shouldPeekThinking = Boolean(data.thinkingTriggered);

    if (stateChanged || data.thinkingTriggered) {
      triggerWateryMorph();
      if (state.stealthCodingEnabled) {
        if (state.thinkingPreviewEnabled && shouldPeekThinking) {
          wakeUpIsland('thinking-peek');
          clearThinkingPreviewTimer();
          state.thinkingPreviewTimer = setTimeout(() => {
            state.thinkingPreviewTimer = null;
            if (state.currentState === 'thinking' && !state.isInteractiveArea) {
              enterSleepMode();
            }
          }, 2500);
        } else {
          clearThinkingPreviewTimer();
          if (!state.isInteractiveArea) {
            enterSleepMode();
          }
        }
      } else {
        wakeUpIsland('thinking');
      }
    } else if (state.stealthCodingEnabled && !state.thinkingPreviewTimer && !state.isInteractiveArea) {
      enterSleepMode();
    }
  } else {
    clearWaitingNudgeTimers();
    dom.btnExpandCard?.classList.remove('has-alert');
    cancelDoneAutoDismiss(dom.countdownBar);
    clearThinkingPreviewTimer();
    dom.island.classList.remove('state-thinking', 'state-done', 'state-waiting');

    if (stateChanged) {
      triggerWateryMorph();
      scheduleSleep(1200, true);
    } else if (!dom.island.classList.contains('is-sleeping') && !state.isInteractiveArea) {
      scheduleSleep(1400, false);
    }
  }
}

setupInteractions(api);

api.onAgentUpdate((data) => {
  updateIslandState(data);
});

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

try {
  const savedExpanded = localStorage.getItem('gravi_deck_expanded') === 'true';
  if (savedExpanded && state.currentPosition === 'center') {
    expandToLuxuryCard();
  }
} catch (e) {}
