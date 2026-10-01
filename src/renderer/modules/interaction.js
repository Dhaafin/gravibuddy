// Zero-Padding Click-Through & User Interaction Handlers
import { dom } from './dom.js';
import { 
  state, 
  hasAnyWaitingSession, 
  getActiveSession, 
  clearRetractTimer, 
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

export function checkInteractiveHit(e, api) {
  const hit = document.elementFromPoint(e.clientX, e.clientY);
  const shouldBeInteractive = Boolean(dom.island && (dom.island === hit || dom.island.contains(hit)));

  if (shouldBeInteractive !== state.isInteractiveArea) {
    state.isInteractiveArea = shouldBeInteractive;
    if (state.isInteractiveArea) {
      // Mouse touched the island or controls: enable clicks
      api.setIgnoreMouseEvents(false);
      clearRetractTimer();

      // If island was peeking during a waiting nudge, cancel the 5s auto re-tuck timer so user can interact
      if (state.waitingNudgePeekTimer) {
        clearTimeout(state.waitingNudgePeekTimer);
        state.waitingNudgePeekTimer = null;
      }

      // If in done state, pause countdown bar while user is reading/interacting
      if (state.currentState === 'done') {
        cancelDoneAutoDismiss(dom.countdownBar);
      }

      // If it was sleeping, wake up on deliberate hover (160ms)
      if (dom.island && dom.island.classList.contains('is-sleeping')) {
        if (state.wakeHoverTimer) clearTimeout(state.wakeHoverTimer);
        state.wakeHoverTimer = setTimeout(() => {
          if (state.isInteractiveArea && dom.island && dom.island.classList.contains('is-sleeping')) {
            wakeUpIsland('hover');
          }
        }, 160);
      }
    } else {
      // Mouse left the interactive surfaces: clicks pass right through immediately!
      if (state.wakeHoverTimer) {
        clearTimeout(state.wakeHoverTimer);
        state.wakeHoverTimer = null;
      }
      api.setIgnoreMouseEvents(true, { forward: true });

      // If done state, resume auto-dismiss countdown
      if (state.currentState === 'done') {
        scheduleDoneAutoDismiss();
        return;
      }

      // If waiting, thinking, or idle: schedule sleep with comfortable delay
      if (state.currentState === 'waiting' || hasAnyWaitingSession()) {
        scheduleSleep(1200, true);
      } else if (state.currentState === 'thinking' && state.stealthCodingEnabled) {
        scheduleSleep(1200, true);
      } else if (state.currentState === 'idle') {
        scheduleSleep(1400, true);
      }
    }
  }
}

export function setupInteractions(api) {
  // Prevent Windows native context menu & toggle center settings window
  window.addEventListener('contextmenu', e => {
    e.preventDefault();
    api.toggleSettings();
  });

  // Mouse move hit testing
  window.addEventListener('mousemove', e => checkInteractiveHit(e, api));

  // Mouse leave window boundary: sweep out delay
  window.addEventListener('mouseleave', () => {
    if (state.wakeHoverTimer) {
      clearTimeout(state.wakeHoverTimer);
      state.wakeHoverTimer = null;
    }
    if (state.isInteractiveArea) {
      state.isInteractiveArea = false;
      api.setIgnoreMouseEvents(true, { forward: true });
    }

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
  });

  // Window blur / unfocus: User clicked outside on editor/terminal to lock in!
  window.addEventListener('blur', () => {
    if (state.wakeHoverTimer) {
      clearTimeout(state.wakeHoverTimer);
      state.wakeHoverTimer = null;
    }
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

    // Instant minimize into the sleep tab for maximum lock-in focus
    enterSleepMode(true);
  });

  // Mini Close / Retract button in compact mode
  if (dom.btnMiniClose) {
    dom.btnMiniClose.addEventListener('click', e => {
      e.stopPropagation();
      cancelDoneAutoDismiss(dom.countdownBar);
      if (state.currentState === 'done') {
        state.currentState = 'idle';
        if (dom.island) dom.island.classList.remove('state-done');
        updateIslandLabels({ state: 'idle' }, 'Antigravity');
      }
      enterSleepMode(true);
    });
  }

  // Expanded View Action Buttons
  if (dom.btnFocusAntigravity) {
    dom.btnFocusAntigravity.addEventListener('click', e => {
      e.stopPropagation();
      api.focusAntigravity();
    });
  }

  if (dom.btnDismissActive) {
    dom.btnDismissActive.addEventListener('click', e => {
      e.stopPropagation();
      const sess = getActiveSession();
      const idToDismiss = sess ? sess.id : null;
      api.dismissSession(idToDismiss);
    });
  }

  // Collapse back to compact mode
  if (dom.btnRetractExpanded) {
    dom.btnRetractExpanded.addEventListener('click', e => {
      e.stopPropagation();
      collapseToCompact(true);
    });
  }

  // Header "X" button minimizes into the bezel sleep tab
  if (dom.btnHeaderRetract) {
    dom.btnHeaderRetract.title = 'Minimize';
    dom.btnHeaderRetract.addEventListener('click', e => {
      e.stopPropagation();
      enterSleepMode(true);
    });
  }

  if (dom.btnExpandedSettings) {
    dom.btnExpandedSettings.addEventListener('click', e => {
      e.stopPropagation();
      api.toggleSettings();
    });
  }

  // Settings Icon in compact view
  if (dom.btnSettings) {
    dom.btnSettings.addEventListener('click', e => {
      e.stopPropagation();
      api.toggleSettings();
    });
  }

  // Expand / collapse deck toggle button
  if (dom.btnExpandCard) {
    dom.btnExpandCard.addEventListener('click', e => {
      e.stopPropagation();
      if (state.isExpanded) {
        collapseToCompact(true);
      } else {
        expandToLuxuryCard();
      }
    });
  }

  // Compact content click: cycle next session or expand card
  if (dom.islandContent) {
    dom.islandContent.addEventListener('click', e => {
      e.stopPropagation();
      if (state.activeSessionsList.length > 1 && !state.isExpanded) {
        cycleNextSession();
      } else if (!state.isExpanded) {
        expandToLuxuryCard();
      }
    });
  }

  // Island container click: wake when sleeping, expand when compact, or dismiss done state
  if (dom.island) {
    dom.island.addEventListener('click', e => {
      if (
        (dom.btnSettings && dom.btnSettings.contains(e.target)) ||
        (dom.btnMiniClose && dom.btnMiniClose.contains(e.target)) ||
        (dom.btnExpandCard && dom.btnExpandCard.contains(e.target)) ||
        (dom.islandContent && dom.islandContent.contains(e.target)) ||
        e.target.closest('button')
      ) return;

      if (dom.island.classList.contains('is-sleeping')) {
        if (state.wakeHoverTimer) {
          clearTimeout(state.wakeHoverTimer);
          state.wakeHoverTimer = null;
        }
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
