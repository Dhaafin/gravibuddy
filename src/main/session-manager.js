const path = require('path');
const { sendAgentUpdate, isMainWindowReady } = require('./windows');

let watchdogTimer = null;
let lastState = 'idle';
const activeSessions = new Map();

// Weight hierarchy: waiting (action needed) > done (task completed) > thinking (active work) > idle (standby/ready)
const STATE_PRIORITY = { waiting: 4, done: 3, thinking: 2, idle: 1 };

function extractModelName(model) {
  if (!model) return 'Antigravity';
  if (typeof model === 'string') return model;
  if (typeof model === 'object') {
    return model.display_name || model.displayName || model.label || model.name || model.id || 'Antigravity';
  }
  return String(model);
}

function getSortedSessions() {
  const sessionsList = Array.from(activeSessions.values());
  sessionsList.sort((a, b) => {
    const diff = (STATE_PRIORITY[b.state] || 1) - (STATE_PRIORITY[a.state] || 1);
    if (diff !== 0) return diff;
    return (b.updatedAt || 0) - (a.updatedAt || 0);
  });
  return sessionsList;
}

function resolveSessionState(payload, prevSessState) {
  const rawState = (payload.agent_state || payload.state || 'idle').toLowerCase();
  const isWaitingConfirmation = payload.tool_confirmation_pending === true;

  if (isWaitingConfirmation || rawState.includes('wait') || rawState.includes('auth') || rawState.includes('question')) {
    return 'waiting';
  }
  if (rawState.includes('think') || rawState.includes('work') || rawState.includes('run') || rawState.includes('coding') || rawState === 'tool_use') {
    return 'thinking';
  }
  if (rawState === 'done') {
    return 'done';
  }
  if (rawState === 'idle' && payload.source !== 'antigravity-2.0' && prevSessState === 'thinking') {
    return 'done';
  }
  return 'idle';
}

function handleAgentEvent(payload) {
  if (!isMainWindowReady()) return;

  let projectName = payload.project || payload.projectName || null;
  if (!projectName && Array.isArray(payload.workspacePaths) && payload.workspacePaths.length > 0) {
    projectName = path.basename(payload.workspacePaths[0]);
  }

  const sessionId = payload.conversationId || projectName || 'default';
  const existingSess = activeSessions.get(sessionId);
  const prevSessState = existingSess ? existingSess.state : 'idle';

  const state = resolveSessionState(payload, prevSessState);
  const isFreshCompletion = (state === 'done' && prevSessState !== 'done');
  lastState = (state === 'done') ? 'idle' : state;
  const modelName = extractModelName(payload.model);

  const ctxUsed = payload.context_window?.used_percentage;
  const contextPercent = typeof ctxUsed === 'number' ? Math.round(ctxUsed) : null;

  const quotaFraction = payload.quota?.['gemini-5h']?.remaining_fraction ?? payload.quota?.['3p-5h']?.remaining_fraction;
  const quotaPercent = typeof quotaFraction === 'number' ? Math.round(quotaFraction * 100) : null;

  activeSessions.set(sessionId, {
    id: sessionId,
    project: projectName || 'Antigravity',
    state,
    model: modelName,
    message: payload.message || null,
    toolName: payload.toolName || null,
    quotaPercent,
    contextPercent,
    updatedAt: Date.now()
  });

  // Auto-expiry: Remove sessions that are idle/done and haven't updated for >5 minutes
  const now = Date.now();
  for (const [id, sess] of activeSessions.entries()) {
    if ((sess.state === 'done' || sess.state === 'idle') && (now - sess.updatedAt > 300000)) {
      activeSessions.delete(id);
    }
  }

  const sessionsList = getSortedSessions();
  const heroSession = sessionsList[0] || activeSessions.get(sessionId);

  if (state === 'thinking') {
    clearTimeout(watchdogTimer);
    watchdogTimer = setTimeout(() => {
      if (lastState === 'thinking') {
        lastState = 'idle';
        if (activeSessions.has(sessionId)) {
          activeSessions.get(sessionId).state = 'idle';
        }
        sendAgentUpdate({
          state: 'idle',
          model: modelName,
          project: projectName,
          quotaPercent: 95,
          sessions: getSortedSessions(),
          heroId: sessionId,
          timestamp: Date.now()
        });
      }
    }, 180000);
  } else {
    clearTimeout(watchdogTimer);
    watchdogTimer = null;
  }

  sendAgentUpdate({
    state: heroSession.state,
    project: heroSession.project,
    model: heroSession.model,
    plan: payload.plan_tier || 'Google AI Pro',
    cost: payload.cost?.total_usd ?? payload.cost ?? null,
    contextPercent: heroSession.contextPercent,
    quotaPercent: heroSession.quotaPercent,
    message: heroSession.message,
    toolName: heroSession.toolName,
    timestamp: Date.now(),
    completionTriggered: isFreshCompletion,
    sessions: sessionsList,
    heroId: heroSession.id
  });
}

function dismissSession(sessionId) {
  if (sessionId && activeSessions.has(sessionId)) {
    const sess = activeSessions.get(sessionId);
    sess.state = 'idle';
    sess.message = 'Acknowledged';
    sess.updatedAt = Date.now();
  } else if (!sessionId) {
    for (const sess of activeSessions.values()) {
      sess.state = 'idle';
      sess.updatedAt = Date.now();
    }
  }

  const sessionsList = getSortedSessions();
  const heroSession = sessionsList[0];
  if (heroSession) {
    sendAgentUpdate({
      state: heroSession.state,
      project: heroSession.project,
      model: heroSession.model,
      message: heroSession.message,
      toolName: heroSession.toolName,
      quotaPercent: heroSession.quotaPercent,
      contextPercent: heroSession.contextPercent,
      timestamp: Date.now(),
      sessions: sessionsList,
      heroId: heroSession.id
    });
  }
}

module.exports = {
  handleAgentEvent,
  dismissSession
};
