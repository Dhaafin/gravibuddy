// Sleep Mode & HUD Lifecycle State Machine (Dual-Mode: Compact & Expanded)
import { dom } from './dom.js';
import { 
  state, 
  hasAnyWaitingSession, 
  clearSleepTimer, 
  cancelDoneAutoDismiss 
} from './state.js';
import { triggerWateryMorph } from './effects.js';
import { playPopSound } from './audio.js';
import { updateIslandLabels } from './compact-view.js';
import { renderActiveSessionDetail, renderAgentTabs } from './expanded-view.js';

let slideUpTimer = null;

export function wakeUpIsland(reason = 'interaction') {
  clearSleepTimer();
  if (state.wakeHoverTimer) {
    clearTimeout(state.wakeHoverTimer);
    state.wakeHoverTimer = null;
  }
  if (slideUpTimer) {
    clearTimeout(slideUpTimer);
    slideUpTimer = null;
    if (dom.island) dom.island.classList.remove('sliding-up');
  }

  if (dom.island && (dom.island.classList.contains('is-sleeping') || dom.island.classList.contains('sliding-up'))) {
    if (state.isExpanded) {
      // Snap to 620px behind the top bezel without horizontal transition
      dom.island.classList.add('slide-prep');
      dom.island.classList.remove('is-sleeping', 'sliding-up');
      void dom.island.offsetHeight; // Force reflow at -185px

      // Animate: Smooth vertical slide down from top bezel
      requestAnimationFrame(() => {
        if (dom.island) {
          dom.island.classList.remove('slide-prep');
        }
      });
    } else {
      dom.island.classList.remove('is-sleeping');
      triggerWateryMorph();
    }
    playPopSound('blossom');
  }
}

export function enterSleepMode(force = false) {
  clearSleepTimer();
  if (!state.sleepModeEnabled && !force) return;
  if (state.isSwitchingPosition) return;
  if (state.isInteractiveArea && !force) return; // Never sleep while user is hovering unless forced

  if (!force) {
    if (state.currentState === 'waiting' || hasAnyWaitingSession()) return;
    if (state.currentState === 'done') return;
    if (state.currentState === 'thinking' && !state.stealthCodingEnabled) return;
  }

  if (slideUpTimer) {
    clearTimeout(slideUpTimer);
    slideUpTimer = null;
  }

  if (state.isExpanded && dom.island && !dom.island.classList.contains('is-sleeping')) {
    // Smoothly slide up into top bezel first
    dom.island.classList.add('sliding-up');
    slideUpTimer = setTimeout(() => {
      slideUpTimer = null;
      if (dom.island) {
        dom.island.classList.remove('sliding-up');
        dom.island.classList.add('is-sleeping');
      }
      if (force) {
        state.isInteractiveArea = false;
        window.graviAPI?.setIgnoreMouseEvents(true, { forward: true });
      }
    }, 240);
  } else {
    if (dom.island) dom.island.classList.add('is-sleeping');
    if (force) {
      state.isInteractiveArea = false;
      window.graviAPI?.setIgnoreMouseEvents(true, { forward: true });
    }
  }
}

export function scheduleSleep(delay = 1400, force = false) {
  if (!state.sleepModeEnabled && !force) return;
  if (state.isSwitchingPosition) return;
  if (dom.island && dom.island.classList.contains('is-sleeping')) return;
  if (!force && (state.currentState === 'waiting' || hasAnyWaitingSession() || state.currentState === 'done')) return;

  if (state.sleepTimer && !force) return;

  clearSleepTimer();
  state.sleepTimer = setTimeout(() => {
    state.sleepTimer = null;
    enterSleepMode(force);
  }, delay);
}

export function dismissDoneState() {
  cancelDoneAutoDismiss(dom.countdownBar);
  if (state.currentState === 'done') {
    state.currentState = 'idle';
    if (dom.island) dom.island.classList.remove('state-done');
    triggerWateryMorph();
    updateIslandLabels({ state: 'idle' }, 'Antigravity');
    if (state.isExpanded) {
      renderActiveSessionDetail();
      renderAgentTabs();
    }
    scheduleSleep(600, true);
  }
}

export function scheduleDoneAutoDismiss() {
  cancelDoneAutoDismiss(dom.countdownBar);
  if (state.autoCloseDoneDuration <= 0) return; // 0 = manual dismissal only

  const totalMs = state.autoCloseDoneDuration * 1000;
  const countdownMs = Math.min(2000, totalMs);
  const delayBeforeCountdown = Math.max(0, totalMs - countdownMs);

  state.doneCountdownStartTimer = setTimeout(() => {
    if (state.currentState === 'done' && dom.countdownBar && !state.isInteractiveArea) {
      dom.countdownBar.style.setProperty('--cd-duration', `${countdownMs}ms`);
      dom.countdownBar.classList.add('active');
    }
  }, delayBeforeCountdown);

  state.doneAutoDismissTimer = setTimeout(() => {
    dismissDoneState();
  }, totalMs);
}
