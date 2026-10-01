import { dom } from './dom.js';
import { state, formatModelName, getActiveSession, hasAnyWaitingSession } from './state.js';
import { playPopSound } from './audio.js';
import { triggerWateryMorph } from './effects.js';
import { updateIslandLabels, updateCompactCycleIndicator } from './compact-view.js';
import { wakeUpIsland } from './lifecycle.js';

const STATE_WEIGHT = { waiting: 4, thinking: 3, done: 2, idle: 1 };
const CHEVRON_UP_SVG = `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"></polyline></svg>`;
const CHEVRON_DOWN_SVG = `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>`;

function updateGlobalStatusOrb(sessions) {
  if (!dom.globalStatusOrb) return;
  dom.globalStatusOrb.className = 'global-status-orb';

  const hasWaiting = sessions.some(s => s.state === 'waiting');
  const hasFree = sessions.some(s => s.state === 'idle' || s.state === 'done');
  const allBusy = sessions.length > 0 && sessions.every(s => s.state === 'thinking');

  if (hasWaiting) {
    dom.globalStatusOrb.classList.add('orb-waiting');
    dom.globalStatusOrb.title = 'Action required on an agent';
  } else if (hasFree || sessions.length === 0) {
    dom.globalStatusOrb.classList.add('orb-ready');
    dom.globalStatusOrb.title = 'Agents available / ready';
  } else if (allBusy) {
    dom.globalStatusOrb.classList.add('orb-thinking');
    dom.globalStatusOrb.title = 'All agents currently busy';
  } else {
    dom.globalStatusOrb.classList.add('orb-ready');
  }
}

function getDefaultSessionMessage(agentState, modelName) {
  if (agentState === 'thinking') return `Processing with ${modelName}...`;
  if (agentState === 'waiting') return 'Action or approval required';
  if (agentState === 'done') return 'Task completed successfully';
  return 'Ready & listening';
}

function createAgentRow(sess) {
  const agentState = sess.state || 'idle';
  const modelName = formatModelName(sess.model);
  const isSelected = sess.id === state.selectedSessionId;
  const dotClass = agentState === 'thinking' ? 'dot-thinking' : agentState === 'waiting' ? 'dot-waiting' : 'dot-ready';

  const row = document.createElement('div');
  row.className = `agent-row state-${agentState} ${isSelected ? 'is-active-session' : ''}`;
  row.dataset.id = sess.id;
  row.title = `Click to focus Antigravity (${sess.project || 'Agent'})`;

  const leading = document.createElement('div');
  leading.className = 'agent-row-leading';
  const dot = document.createElement('span');
  dot.className = `agent-row-dot ${dotClass}`;
  leading.appendChild(dot);

  const content = document.createElement('div');
  content.className = 'agent-row-content';

  const topRow = document.createElement('div');
  topRow.className = 'agent-row-top';
  const title = document.createElement('span');
  title.className = 'agent-row-title';
  title.textContent = sess.project || 'Antigravity';
  const modelTag = document.createElement('span');
  modelTag.className = 'agent-model-tag';
  modelTag.textContent = modelName;
  topRow.append(title, modelTag);

  const bottomRow = document.createElement('div');
  bottomRow.className = 'agent-row-bottom';
  const msgSpan = document.createElement('span');
  msgSpan.className = sess.toolName ? 'agent-message-text is-tool' : 'agent-message-text';
  msgSpan.textContent = sess.toolName
    ? `Tool: ${sess.toolName}`
    : (sess.message || getDefaultSessionMessage(agentState, modelName));
  bottomRow.appendChild(msgSpan);

  content.append(topRow, bottomRow);

  const trailing = document.createElement('div');
  trailing.className = 'agent-row-trailing';
  if (typeof sess.quotaPercent === 'number') {
    const metric = document.createElement('span');
    metric.className = 'agent-row-metric';
    metric.textContent = `${sess.quotaPercent}% QTA`;
    trailing.appendChild(metric);
  }

  row.append(leading, content, trailing);
  row.addEventListener('click', (e) => {
    e.stopPropagation();
    state.selectedSessionId = sess.id;
    renderAgentList();
    window.graviAPI?.focusAntigravity();
  });

  return row;
}

export function renderAgentList() {
  if (!dom.agentListDeck) return;
  dom.agentListDeck.innerHTML = '';

  const sessions = state.activeSessionsList;
  const count = sessions.length;

  if (dom.headerCountBadge) {
    dom.headerCountBadge.textContent = count === 1 ? '1 AGENT' : `${count} AGENTS`;
  }

  updateGlobalStatusOrb(sessions);

  if (dom.expandedQuotaBadge) {
    const active = getActiveSession() || sessions[0];
    dom.expandedQuotaBadge.textContent = `${active?.quotaPercent ?? 95}% QTA`;
  }

  if (count === 0) {
    const empty = document.createElement('div');
    empty.className = 'agent-deck-empty';
    empty.textContent = 'Standby & ready';
    dom.agentListDeck.appendChild(empty);
    updateCompactCycleIndicator();
    return;
  }

  const sortedSessions = [...sessions].sort((a, b) => (STATE_WEIGHT[b.state] || 1) - (STATE_WEIGHT[a.state] || 1));
  sortedSessions.forEach(sess => dom.agentListDeck.appendChild(createAgentRow(sess)));

  updateCompactCycleIndicator();
}

export function cycleNextSession() {
  if (state.activeSessionsList.length <= 1) return;
  const currentIndex = state.activeSessionsList.findIndex(s => s.id === state.selectedSessionId);
  const nextIndex = (currentIndex + 1) % state.activeSessionsList.length;
  const sess = state.activeSessionsList[nextIndex];
  state.selectedSessionId = sess.id;
  updateIslandLabels(sess, formatModelName(sess.model));
  renderAgentList();
  triggerWateryMorph();
  playPopSound('blossom');
}

export function expandToLuxuryCard() {
  if (state.currentPosition !== 'center') return;
  const wasSleeping = dom.island && dom.island.classList.contains('is-sleeping');
  if (wasSleeping) {
    wakeUpIsland('expand');
  }
  if (!state.isExpanded) {
    state.isExpanded = true;
    dom.island?.classList.add('is-expanded');
    try { localStorage.setItem('gravi_deck_expanded', 'true'); } catch (e) {}
    if (!wasSleeping) {
      triggerWateryMorph();
      playPopSound('blossom');
    }
  }
  if (dom.btnExpandCard) {
    dom.btnExpandCard.classList.remove('has-alert');
    dom.btnExpandCard.title = 'Collapse Deck';
    dom.btnExpandCard.innerHTML = CHEVRON_UP_SVG;
  }
  renderAgentList();
}

export function collapseToCompact(force = false) {
  if (!force && hasAnyWaitingSession()) return;
  if (state.isExpanded) {
    state.isExpanded = false;
    dom.island?.classList.remove('is-expanded');
    try { localStorage.setItem('gravi_deck_expanded', 'false'); } catch (e) {}
    triggerWateryMorph();
    playPopSound('implode');
  }
  if (dom.btnExpandCard) {
    dom.btnExpandCard.title = 'Expand Deck';
    dom.btnExpandCard.innerHTML = CHEVRON_DOWN_SVG;
  }
}
