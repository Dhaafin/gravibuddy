import { dom } from './dom.js';
import { 
  state, 
  hasAnyWaitingSession, 
  getActiveSession, 
  clearWakeHoverTimer,
  cancelDoneAutoDismiss 
} from './state.js';
import { updateIslandLabels } from './compact-view.js';
import { 
  expandToLuxuryCard, 
  collapseToCompact, 
  cycleNextSession 
} from './expanded-view.js';
import { 
  wakeUpIsland, 
  enterSleepMode, 
  scheduleSleep, 
  dismissDoneState, 
  scheduleDoneAutoDismiss 
} from './lifecycle.js';

function scheduleHoverExitSleep() {
  if (state.currentState === 'done') {
    scheduleDoneAutoDismiss();
    return;
  }
  if (state.currentState === 'waiting' || hasAnyWaitingSession()) {
    scheduleSleep(1200, true);
  } else if (state.currentState === 'thinking' && state.stealthCodingEnabled) {
    scheduleSleep(1200, true);
  } else if (state.currentState === 'idle') {
    scheduleSleep(1400, true);
  }
}

function bindClick(el, handler) {
  if (!el) return;
  el.addEventListener('click', e => {
    e.stopPropagation();
    handler(e);
  });
}

export function checkInteractiveHit(e, api) {
  const hit = document.elementFromPoint(e.clientX, e.clientY);
  const shouldBeInteractive = Boolean(dom.island && (dom.island === hit || dom.island.contains(hit)));

  if (shouldBeInteractive === state.isInteractiveArea) return;
  state.isInteractiveArea = shouldBeInteractive;

  if (state.isInteractiveArea) {
    api.setIgnoreMouseEvents(false);

    if (state.waitingNudgePeekTimer) {
      clearTimeout(state.waitingNudgePeekTimer);
      state.waitingNudgePeekTimer = null;
    }

    if (state.currentState === 'done') {
      cancelDoneAutoDismiss(dom.countdownBar);
    }

    if (dom.island?.classList.contains('is-sleeping')) {
      clearWakeHoverTimer();
      state.wakeHoverTimer = setTimeout(() => {
        if (state.isInteractiveArea && dom.island?.classList.contains('is-sleeping')) {
          wakeUpIsland('hover');
        }
      }, 160);
    }
  } else {
    clearWakeHoverTimer();
    api.setIgnoreMouseEvents(true, { forward: true });
    scheduleHoverExitSleep();
  }
}

export function setupInteractions(api) {
  window.addEventListener('contextmenu', e => {
    e.preventDefault();
    api.toggleSettings();
  });

  window.addEventListener('mousemove', e => checkInteractiveHit(e, api));

  window.addEventListener('mouseleave', () => {
    clearWakeHoverTimer();
    if (state.isInteractiveArea) {
      state.isInteractiveArea = false;
      api.setIgnoreMouseEvents(true, { forward: true });
    }
    scheduleHoverExitSleep();
  });

  window.addEventListener('blur', () => {
    clearWakeHoverTimer();
    if (state.isInteractiveArea) {
      state.isInteractiveArea = false;
      api.setIgnoreMouseEvents(true, { forward: true });
    }
    if (state.currentState === 'done') {
      scheduleDoneAutoDismiss();
      return;
    }
    if (state.currentState === 'waiting' || hasAnyWaitingSession()) {
      return;
    }
    enterSleepMode(true);
  });

  bindClick(dom.btnMiniClose, () => {
    cancelDoneAutoDismiss(dom.countdownBar);
    if (state.currentState === 'done') {
      state.currentState = 'idle';
      dom.island?.classList.remove('state-done');
      updateIslandLabels({ state: 'idle' }, 'Antigravity');
    }
    enterSleepMode(true);
  });

  bindClick(dom.btnFocusAntigravity, () => api.focusAntigravity());

  bindClick(dom.btnDismissActive, () => {
    const sess = getActiveSession();
    api.dismissSession(sess ? sess.id : null);
  });

  bindClick(dom.btnRetractExpanded, () => collapseToCompact(true));

  if (dom.btnHeaderRetract) dom.btnHeaderRetract.title = 'Minimize';
  bindClick(dom.btnHeaderRetract, () => enterSleepMode(true));

  bindClick(dom.btnExpandedSettings, () => api.toggleSettings());
  bindClick(dom.btnSettings, () => api.toggleSettings());

  bindClick(dom.btnExpandCard, () => {
    if (state.isExpanded) collapseToCompact(true);
    else expandToLuxuryCard();
  });

  bindClick(dom.islandContent, () => {
    if (state.activeSessionsList.length > 1 && !state.isExpanded) {
      cycleNextSession();
    } else if (!state.isExpanded) {
      expandToLuxuryCard();
    }
  });

  if (dom.island) {
    dom.island.addEventListener('click', e => {
      if (
        dom.btnSettings?.contains(e.target) ||
        dom.btnMiniClose?.contains(e.target) ||
        dom.btnExpandCard?.contains(e.target) ||
        dom.islandContent?.contains(e.target) ||
        e.target.closest('button')
      ) return;

      if (dom.island.classList.contains('is-sleeping')) {
        clearWakeHoverTimer();
        wakeUpIsland('click');
        return;
      }
      if (!state.isExpanded && state.currentPosition === 'center') {
        expandToLuxuryCard();
        return;
      }
      if (state.currentState === 'done') {
        dismissDoneState();
      }
    });
  }
}
