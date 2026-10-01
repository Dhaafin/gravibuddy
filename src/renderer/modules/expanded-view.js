// Expanded Luxury Card View (Multi-Agent Tabs & Active Detail)
import { dom } from './dom.js';
import { state, formatModelName, getActiveSession, hasAnyWaitingSession, clearRetractTimer } from './state.js';
import { playPopSound } from './audio.js';
import { triggerWateryMorph } from './effects.js';
import { updateIslandLabels, updateCompactCycleIndicator } from './compact-view.js';
import { wakeUpIsland } from './lifecycle.js';

export function getOrbIconSvg(agentState) {
  if (agentState === 'thinking') {
    return `<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
      <path d="M12 1.5C12 7.298 7.298 12 1.5 12C7.298 12 12 16.702 12 22.5C12 16.702 16.702 12 22.5 12C16.702 12 12 7.298 12 1.5Z" />
    </svg>`;
  }
  if (agentState === 'waiting') {
    return `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
      <line x1="12" y1="9" x2="12" y2="13"></line>
      <line x1="12" y1="17" x2="12.01" y2="17"></line>
    </svg>`;
  }
  if (agentState === 'done') {
    return `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>`;
  }
  return `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M12 2.5L19.5 12L12 21.5L4.5 12L12 2.5Z" fill="currentColor" fill-opacity="0.18" />
    <circle cx="12" cy="12" r="2.5" fill="currentColor" />
  </svg>`;
}

export function renderAgentTabs() {
  if (!dom.agentTabsDeck) return;
  dom.agentTabsDeck.innerHTML = '';

  if (state.activeSessionsList.length === 0) return;

  state.activeSessionsList.forEach(sess => {
    const btn = document.createElement('button');
    btn.className = `agent-tab ${sess.id === state.selectedSessionId ? 'active' : ''}`;
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
      state.selectedSessionId = sess.id;
      renderAgentTabs();
      renderActiveSessionDetail();
    });

    dom.agentTabsDeck.appendChild(btn);
  });
  updateCompactCycleIndicator();
}

export function cycleNextSession() {
  if (state.activeSessionsList.length <= 1) return;
  const currentIndex = state.activeSessionsList.findIndex(s => s.id === state.selectedSessionId);
  const nextIndex = (currentIndex + 1) % state.activeSessionsList.length;
  state.selectedSessionId = state.activeSessionsList[nextIndex].id;
  const sess = state.activeSessionsList[nextIndex];
  updateIslandLabels(sess, formatModelName(sess.model));
  renderAgentTabs();
  renderActiveSessionDetail();
  triggerWateryMorph();
  playPopSound('blossom');
}

export function renderActiveSessionDetail() {
  const sess = getActiveSession();
  if (!sess) return;

  const agentState = sess.state || 'idle';
  const modelName = formatModelName(sess.model);

  if (dom.expandedOrb) {
    dom.expandedOrb.className = `expanded-orb orb-${agentState}`;
    dom.expandedOrb.innerHTML = getOrbIconSvg(agentState);
  }

  if (dom.expandedAgentName) {
    dom.expandedAgentName.textContent = sess.project || 'Antigravity';
  }

  if (dom.expandedStatusBadge) {
    dom.expandedStatusBadge.className = `expanded-status-badge badge-${agentState}`;
    if (agentState === 'thinking') dom.expandedStatusBadge.textContent = 'Thinking';
    else if (agentState === 'waiting') dom.expandedStatusBadge.textContent = 'Action Required';
    else if (agentState === 'done') dom.expandedStatusBadge.textContent = 'Done';
    else dom.expandedStatusBadge.textContent = 'Standby';
  }

  if (dom.expandedModelPill) {
    dom.expandedModelPill.textContent = modelName;
  }

  if (dom.expandedMessage) {
    let msg = sess.message;
    if (!msg) {
      if (agentState === 'thinking') msg = `Processing with ${modelName}...`;
      else if (agentState === 'waiting') msg = 'Action or approval required';
      else if (agentState === 'done') msg = 'Task completed successfully';
      else msg = 'Ready & listening';
    }
    dom.expandedMessage.textContent = msg;
  }

  if (dom.expandedToolRow && dom.expandedToolTag) {
    if (sess.toolName) {
      dom.expandedToolRow.style.display = 'flex';
      dom.expandedToolTag.textContent = `Tool: ${sess.toolName}`;
    } else {
      dom.expandedToolRow.style.display = 'none';
    }
  }

  if (dom.expandedQuotaBadge) {
    const qPct = sess.quotaPercent ?? 95;
    dom.expandedQuotaBadge.textContent = `${qPct}% QTA`;
  }
}

export function expandToLuxuryCard() {
  if (state.currentPosition !== 'center') return;
  clearRetractTimer();
  if (dom.island && dom.island.classList.contains('is-sleeping')) {
    wakeUpIsland('expand');
  }
  if (!state.isExpanded) {
    state.isExpanded = true;
    if (dom.island) dom.island.classList.add('is-expanded');
    try { localStorage.setItem('gravi_deck_expanded', 'true'); } catch (e) {}
    playPopSound('blossom');
  }
  if (dom.btnExpandCard) {
    dom.btnExpandCard.classList.remove('has-alert');
    dom.btnExpandCard.title = 'Collapse Deck';
    dom.btnExpandCard.innerHTML = `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"></polyline></svg>`;
  }
  renderAgentTabs();
  renderActiveSessionDetail();
}

export function collapseToCompact(force = false) {
  if (!force && hasAnyWaitingSession()) return;
  clearRetractTimer();
  if (state.isExpanded) {
    state.isExpanded = false;
    if (dom.island) dom.island.classList.remove('is-expanded');
    try { localStorage.setItem('gravi_deck_expanded', 'false'); } catch (e) {}
    playPopSound('implode');
  }
  if (dom.btnExpandCard) {
    dom.btnExpandCard.title = 'Expand Deck';
    dom.btnExpandCard.innerHTML = `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>`;
  }
}

export function scheduleRetraction() {
  // Retraction disabled: expand and collapse modes are sticky per user preference
  clearRetractTimer();
}
