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

export function renderAgentList() {
  if (!dom.agentListDeck) return;
  dom.agentListDeck.innerHTML = '';

  const sessions = state.activeSessionsList;
  const count = sessions.length;

  // Header count badge (e.g., "1 AGENT" or "3 AGENTS")
  if (dom.headerCountBadge) {
    dom.headerCountBadge.textContent = count === 1 ? '1 AGENT' : `${count} AGENTS`;
  }

  // Header quota badge from active session or first session
  if (dom.expandedQuotaBadge) {
    const active = getActiveSession() || sessions[0];
    const qPct = active?.quotaPercent ?? 95;
    dom.expandedQuotaBadge.textContent = `${qPct}% QTA`;
  }

  if (count === 0) {
    const empty = document.createElement('div');
    empty.className = 'agent-deck-empty';
    empty.textContent = 'Standby & ready';
    dom.agentListDeck.appendChild(empty);
    updateCompactCycleIndicator();
    return;
  }

  // Priority bubbling: waiting > thinking > done > idle
  const sortedSessions = [...sessions].sort((a, b) => {
    const pA = a.state === 'waiting' ? 4 : a.state === 'thinking' ? 3 : a.state === 'done' ? 2 : 1;
    const pB = b.state === 'waiting' ? 4 : b.state === 'thinking' ? 3 : b.state === 'done' ? 2 : 1;
    return pB - pA;
  });

  sortedSessions.forEach(sess => {
    const agentState = sess.state || 'idle';
    const modelName = formatModelName(sess.model);
    const isSelected = sess.id === state.selectedSessionId;

    const row = document.createElement('div');
    row.className = `agent-row state-${agentState} ${isSelected ? 'is-active-session' : ''}`;
    row.dataset.id = sess.id;
    row.title = `Click to focus Antigravity (${sess.project || 'Agent'})`;

    // 1. Leading Dot
    const leading = document.createElement('div');
    leading.className = 'agent-row-leading';
    const dot = document.createElement('span');
    dot.className = `agent-row-dot dot-${agentState}`;
    leading.appendChild(dot);

    // 2. Content: Top row (Title + Status Tag + Model) & Bottom row (Live Message or Tool)
    const content = document.createElement('div');
    content.className = 'agent-row-content';

    const topRow = document.createElement('div');
    topRow.className = 'agent-row-top';

    const title = document.createElement('span');
    title.className = 'agent-row-title';
    title.textContent = sess.project || 'Antigravity';

    const statusTag = document.createElement('span');
    statusTag.className = `agent-status-tag tag-${agentState}`;
    if (agentState === 'thinking') statusTag.textContent = 'Thinking';
    else if (agentState === 'waiting') statusTag.textContent = 'Action Required';
    else if (agentState === 'done') statusTag.textContent = 'Done';
    else statusTag.textContent = 'Standby';

    const modelTag = document.createElement('span');
    modelTag.className = 'agent-model-tag';
    modelTag.textContent = modelName;

    topRow.appendChild(title);
    topRow.appendChild(statusTag);
    topRow.appendChild(modelTag);

    const bottomRow = document.createElement('div');
    bottomRow.className = 'agent-row-bottom';

    const msgSpan = document.createElement('span');
    if (sess.toolName) {
      msgSpan.className = 'agent-message-text is-tool';
      msgSpan.textContent = `Tool: ${sess.toolName}`;
    } else {
      msgSpan.className = 'agent-message-text';
      let msg = sess.message;
      if (!msg) {
        if (agentState === 'thinking') msg = `Processing with ${modelName}...`;
        else if (agentState === 'waiting') msg = 'Action or approval required';
        else if (agentState === 'done') msg = 'Task completed successfully';
        else msg = 'Ready & listening';
      }
      msgSpan.textContent = msg;
    }
    bottomRow.appendChild(msgSpan);

    content.appendChild(topRow);
    content.appendChild(bottomRow);

    // 3. Trailing: Metric Pill
    const trailing = document.createElement('div');
    trailing.className = 'agent-row-trailing';

    if (typeof sess.quotaPercent === 'number') {
      const metric = document.createElement('span');
      metric.className = 'agent-row-metric';
      metric.textContent = `${sess.quotaPercent}% QTA`;
      trailing.appendChild(metric);
    }

    row.appendChild(leading);
    row.appendChild(content);
    row.appendChild(trailing);

    // Row Click: Focus Antigravity & Select Session
    row.addEventListener('click', (e) => {
      e.stopPropagation();
      state.selectedSessionId = sess.id;
      renderAgentList();
      window.graviAPI?.focusAntigravity();
    });

    dom.agentListDeck.appendChild(row);
  });

  updateCompactCycleIndicator();
}

// Aliases for compatibility
export const renderAgentTabs = renderAgentList;
export const renderActiveSessionDetail = renderAgentList;

export function cycleNextSession() {
  if (state.activeSessionsList.length <= 1) return;
  const currentIndex = state.activeSessionsList.findIndex(s => s.id === state.selectedSessionId);
  const nextIndex = (currentIndex + 1) % state.activeSessionsList.length;
  state.selectedSessionId = state.activeSessionsList[nextIndex].id;
  const sess = state.activeSessionsList[nextIndex];
  updateIslandLabels(sess, formatModelName(sess.model));
  renderAgentList();
  triggerWateryMorph();
  playPopSound('blossom');
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
  renderAgentList();
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
