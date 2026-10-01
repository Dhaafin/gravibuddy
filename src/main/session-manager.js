const fs = require('fs');
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

function extractQuestionMessage(args) {
  if (!args) return 'Question from Antigravity';
  let qList = args.questions;
  if (typeof qList === 'string') {
    try {
      qList = JSON.parse(qList);
    } catch (e) {}
  }
  if (Array.isArray(qList) && qList[0]?.question) {
    return qList[0].question;
  }
  return 'Question from Antigravity';
}

function inspectTranscriptState(transcriptPath) {
  if (!transcriptPath || typeof transcriptPath !== 'string') return null;
  try {
    if (!fs.existsSync(transcriptPath)) return null;
    const stat = fs.statSync(transcriptPath);
    if (!stat || stat.size === 0) return null;

    const bufSize = Math.min(stat.size, 131072);
    const fd = fs.openSync(transcriptPath, 'r');
    const buf = Buffer.alloc(bufSize);
    fs.readSync(fd, buf, 0, bufSize, stat.size - bufSize);
    fs.closeSync(fd);

    const lines = buf.toString('utf8').trim().split('\n').filter(Boolean);
    const entries = [];
    for (const line of lines) {
      try {
        entries.push(JSON.parse(line));
      } catch (e) {}
    }

    let lastPlannerIdx = -1;
    for (let i = entries.length - 1; i >= 0; i--) {
      if (entries[i].type === 'PLANNER_RESPONSE') {
        lastPlannerIdx = i;
        break;
      }
    }
    if (lastPlannerIdx === -1) return null;

    const planner = entries[lastPlannerIdx];
    const toolCalls = Array.isArray(planner.tool_calls) ? planner.tool_calls : [];
    const questionTool = toolCalls.find(t => t.name === 'ask_question');

    // Check if tool step after lastPlannerIdx has already finished
    const subsequentEntries = entries.slice(lastPlannerIdx + 1);
    const hasCompletedStepAfter = subsequentEntries.some(
      e => (e.type === 'GENERIC' || e.type === 'USER_INPUT') && e.status === 'DONE'
    );

    if (questionTool && !hasCompletedStepAfter) {
      return {
        state: 'waiting',
        message: extractQuestionMessage(questionTool.args),
        toolName: null
      };
    }

    if (toolCalls.length > 0 && !hasCompletedStepAfter) {
      return {
        state: 'thinking',
        message: `Running ${toolCalls[0].name}...`,
        toolName: toolCalls[0].name
      };
    }

    return {
      state: 'thinking',
      message: 'Thinking & reasoning...',
      toolName: null
    };
  } catch (e) {
    return null;
  }
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

function broadcastSessions(completionTriggered = false) {
  const sessionsList = getSortedSessions();
  const heroSession = sessionsList[0];
  if (!heroSession) return;

  sendAgentUpdate({
    state: heroSession.state,
    project: heroSession.project,
    model: heroSession.model,
    plan: 'Google AI Pro',
    contextPercent: heroSession.contextPercent,
    quotaPercent: heroSession.quotaPercent,
    message: heroSession.message,
    toolName: heroSession.toolName,
    timestamp: Date.now(),
    completionTriggered,
    sessions: sessionsList,
    heroId: heroSession.id
  });
}

// Live transcript watcher for mid-turn blocking tools (e.g. ask_question)
setInterval(() => {
  if (!isMainWindowReady() || activeSessions.size === 0) return;

  let changed = false;
  for (const sess of activeSessions.values()) {
    if (!sess.transcriptPath || (sess.state !== 'thinking' && sess.state !== 'waiting')) continue;

    try {
      const stat = fs.statSync(sess.transcriptPath);
      if (sess.lastTranscriptMtime === stat.mtimeMs) continue;
      sess.lastTranscriptMtime = stat.mtimeMs;

      const inspected = inspectTranscriptState(sess.transcriptPath);
      if (!inspected) continue;

      if (inspected.state === 'waiting' && sess.state !== 'waiting') {
        sess.state = 'waiting';
        sess.message = inspected.message;
        sess.toolName = null;
        sess.updatedAt = Date.now();
        changed = true;
      } else if (inspected.state === 'thinking' && sess.state === 'waiting') {
        sess.state = 'thinking';
        sess.message = inspected.message;
        sess.toolName = inspected.toolName;
        sess.updatedAt = Date.now();
        changed = true;
      } else if (
        inspected.state === 'thinking' &&
        sess.state === 'thinking' &&
        inspected.toolName !== sess.toolName
      ) {
        sess.toolName = inspected.toolName;
        sess.message = inspected.message;
        changed = true;
      }
    } catch (e) {}
  }

  if (changed) {
    broadcastSessions(false);
  }
}, 600);

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
    transcriptPath: payload.transcriptPath || existingSess?.transcriptPath || null,
    lastTranscriptMtime: existingSess?.lastTranscriptMtime || 0,
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

  if (state === 'thinking') {
    clearTimeout(watchdogTimer);
    watchdogTimer = setTimeout(() => {
      if (lastState === 'thinking') {
        lastState = 'idle';
        if (activeSessions.has(sessionId)) {
          activeSessions.get(sessionId).state = 'idle';
        }
        broadcastSessions(false);
      }
    }, 180000);
  } else {
    clearTimeout(watchdogTimer);
    watchdogTimer = null;
  }

  broadcastSessions(isFreshCompletion);
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

  broadcastSessions(false);
}

module.exports = {
  handleAgentEvent,
  dismissSession
};
