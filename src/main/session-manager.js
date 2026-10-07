const fs = require('fs');
const path = require('path');
const { sendAgentUpdate, isMainWindowReady } = require('./windows');

const activeSessions = new Map();

// Weight hierarchy: waiting (action needed) > done (task completed) > thinking (active work) > idle (standby/ready)
const STATE_PRIORITY = { waiting: 4, done: 3, thinking: 2, idle: 1 };
const THINKING_STALE_TIMEOUT_MS = 90000;
const SESSION_EXPIRY_MS = 300000;

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

function inspectTranscriptState(transcriptPath, lastKnownMtime = 0) {
  if (!transcriptPath || typeof transcriptPath !== 'string') return null;
  let fd = null;
  try {
    if (!fs.existsSync(transcriptPath)) return null;
    const stat = fs.statSync(transcriptPath);
    if (!stat || stat.size === 0) return null;

    // Fast-path: if file mtime hasn't changed, don't re-read or re-parse JSON
    if (lastKnownMtime && stat.mtimeMs <= lastKnownMtime) {
      return { unchanged: true, mtimeMs: stat.mtimeMs };
    }

    const bufSize = Math.min(stat.size, 65536);
    fd = fs.openSync(transcriptPath, 'r');
    const buf = Buffer.allocUnsafe(bufSize);
    fs.readSync(fd, buf, 0, bufSize, stat.size - bufSize);
    fs.closeSync(fd);
    fd = null;

    const lines = buf.toString('utf8').trim().split('\n').filter(Boolean);
    const entries = [];
    for (const line of lines) {
      try {
        entries.push(JSON.parse(line));
      } catch (e) {}
    }

    let latestPlanner = null;
    let latestUserInputStep = -1;
    for (const entry of entries) {
      const stepIdx = entry.step_index ?? 0;
      if (entry.type === 'USER_INPUT' && stepIdx >= latestUserInputStep) {
        latestUserInputStep = stepIdx;
      }
      if (
        entry.type === 'PLANNER_RESPONSE' &&
        (!latestPlanner || stepIdx >= (latestPlanner.step_index ?? 0))
      ) {
        latestPlanner = entry;
      }
    }
    if (!latestPlanner) return null;

    const plannerStep = latestPlanner.step_index ?? -1;
    const toolCalls = Array.isArray(latestPlanner.tool_calls) ? latestPlanner.tool_calls : [];
    const questionTool = toolCalls.find(t => t.name === 'ask_question');

    // Check if any step after latestPlanner's step_index has already completed
    const hasCompletedStepAfter = entries.some(
      e => (e.step_index ?? -1) > plannerStep && e.status === 'DONE'
    );

    if (questionTool && !hasCompletedStepAfter) {
      return {
        state: 'waiting',
        message: extractQuestionMessage(questionTool.args),
        toolName: null,
        mtimeMs: stat.mtimeMs
      };
    }

    if (toolCalls.length > 0 && !hasCompletedStepAfter) {
      return {
        state: 'thinking',
        message: `Running ${toolCalls[0].name}...`,
        toolName: toolCalls[0].name,
        mtimeMs: stat.mtimeMs
      };
    }

    const isTurnReplyDone =
      plannerStep > latestUserInputStep &&
      latestPlanner.status === 'DONE' &&
      toolCalls.length === 0 &&
      !hasCompletedStepAfter;

    return {
      state: 'thinking',
      message: 'Thinking & reasoning...',
      toolName: null,
      mtimeMs: stat.mtimeMs,
      isTurnReplyDone
    };
  } catch (e) {
    return null;
  } finally {
    if (fd !== null) {
      try {
        fs.closeSync(fd);
      } catch (e) {}
    }
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

function broadcastSessions(completionTriggered = false, thinkingTriggered = false, expand = null, wake = null) {
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
    thinkingTriggered,
    sessions: sessionsList,
    heroId: heroSession.id,
    expand,
    wake
  });
}

// Live transcript watcher for mid-turn blocking tools & per-session stale watchdog
setInterval(() => {
  if (!isMainWindowReady() || activeSessions.size === 0) return;

  const now = Date.now();
  let changed = false;

  for (const [id, sess] of activeSessions.entries()) {
    if ((sess.state === 'done' || sess.state === 'idle') && (now - sess.updatedAt > SESSION_EXPIRY_MS)) {
      if (activeSessions.size > 1) {
        activeSessions.delete(id);
        changed = true;
        continue;
      }
    }

    if (sess.state !== 'thinking' && sess.state !== 'waiting') continue;

    const inspected = sess.transcriptPath
      ? inspectTranscriptState(sess.transcriptPath, sess.lastTranscriptMtime || 0)
      : null;

    if (inspected && inspected.mtimeMs && inspected.mtimeMs > (sess.lastTranscriptMtime || 0)) {
      sess.lastTranscriptMtime = inspected.mtimeMs;
      sess.lastActivityAt = now;
    }

    // Per-session watchdog: if stuck in thinking with no hook or transcript activity, or turn reply already finished
    if (sess.state === 'thinking') {
      const inactiveMs = now - (sess.lastActivityAt || sess.updatedAt || now);
      const replyFinishedAndSettled = Boolean(inspected?.isTurnReplyDone && inactiveMs > 6000);
      if (inactiveMs > THINKING_STALE_TIMEOUT_MS || replyFinishedAndSettled) {
        sess.state = 'idle';
        sess.toolName = null;
        sess.message = 'Ready & listening';
        sess.updatedAt = now;
        changed = true;
        console.log(`[gravibuddy] Session "${sess.project}" -> auto-reset stale thinking to idle`);
        continue;
      }
    }

    if (!inspected || inspected.unchanged) continue;

    if (inspected.state === 'waiting' && (sess.state !== 'waiting' || sess.message !== inspected.message)) {
      sess.state = 'waiting';
      sess.message = inspected.message;
      sess.toolName = null;
      sess.updatedAt = now;
      sess.lastActivityAt = now;
      changed = true;
      console.log(`[gravibuddy] Session "${sess.project}" -> waiting: ${sess.message}`);
    } else if (inspected.state === 'thinking' && sess.state === 'waiting') {
      sess.state = 'thinking';
      sess.message = inspected.message;
      sess.toolName = inspected.toolName;
      sess.updatedAt = now;
      sess.lastActivityAt = now;
      changed = true;
      console.log(`[gravibuddy] Session "${sess.project}" -> resumed thinking`);
    } else if (
      inspected.state === 'thinking' &&
      sess.state === 'thinking' &&
      inspected.toolName !== sess.toolName
    ) {
      sess.toolName = inspected.toolName;
      sess.message = inspected.message;
      changed = true;
    }
  }

  if (changed) {
    broadcastSessions(false, false);
  }
}, 450);

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

  const now = Date.now();
  const sessionId = payload.conversationId || projectName || 'default';
  const existingSess = activeSessions.get(sessionId);
  const prevSessState = existingSess ? existingSess.state : 'idle';

  const state = resolveSessionState(payload, prevSessState);
  const isFreshCompletion = (state === 'done' && prevSessState !== 'done');
  const isFreshThinking = (state === 'thinking' && prevSessState !== 'thinking');
  const modelName = extractModelName(payload.model);

  const ctxUsed = payload.context_window?.used_percentage;
  const contextPercent = typeof ctxUsed === 'number' ? Math.round(ctxUsed) : (existingSess?.contextPercent ?? null);

  const quotaFraction = payload.quota?.['gemini-5h']?.remaining_fraction ?? payload.quota?.['3p-5h']?.remaining_fraction;
  const quotaPercent = typeof quotaFraction === 'number' ? Math.round(quotaFraction * 100) : (existingSess?.quotaPercent ?? null);

  const transcriptPath = payload.transcriptPath || existingSess?.transcriptPath || null;
  let lastTranscriptMtime = existingSess?.lastTranscriptMtime || 0;
  if (transcriptPath) {
    try {
      if (fs.existsSync(transcriptPath)) {
        lastTranscriptMtime = fs.statSync(transcriptPath).mtimeMs;
      }
    } catch (e) {}
  }

  // Clean up older inactive/stale conversations belonging to the exact same project workspace
  if (projectName) {
    for (const [id, sess] of activeSessions.entries()) {
      if (id !== sessionId && sess.project === projectName) {
        const inactiveAge = now - (sess.lastActivityAt || sess.updatedAt || 0);
        if (sess.state === 'idle' || sess.state === 'done' || inactiveAge > 45000) {
          activeSessions.delete(id);
        }
      }
    }
  }

  activeSessions.set(sessionId, {
    id: sessionId,
    project: projectName || existingSess?.project || 'Antigravity',
    state,
    model: modelName,
    message: payload.message || null,
    toolName: payload.toolName || null,
    transcriptPath,
    lastTranscriptMtime,
    quotaPercent,
    contextPercent,
    updatedAt: now,
    lastActivityAt: now
  });

  // Auto-expiry: Remove sessions that are idle/done and haven't updated for >5 minutes
  for (const [id, sess] of activeSessions.entries()) {
    if ((sess.state === 'done' || sess.state === 'idle') && (now - sess.updatedAt > SESSION_EXPIRY_MS)) {
      if (activeSessions.size > 1) {
        activeSessions.delete(id);
      }
    }
  }

  broadcastSessions(isFreshCompletion, isFreshThinking, payload.expand, payload.wake);
}

function dismissSession(sessionId) {
  const now = Date.now();
  if (sessionId === 'done') {
    for (const sess of activeSessions.values()) {
      if (sess.state === 'done') {
        sess.state = 'idle';
        sess.message = 'Ready & listening';
        sess.updatedAt = now;
      }
    }
  } else if (sessionId && activeSessions.has(sessionId)) {
    const sess = activeSessions.get(sessionId);
    sess.state = 'idle';
    sess.message = 'Acknowledged';
    sess.updatedAt = now;
  } else if (!sessionId) {
    for (const sess of activeSessions.values()) {
      sess.state = 'idle';
      sess.updatedAt = now;
    }
  }

  broadcastSessions(false, false);
}

function resetAllSessions() {
  activeSessions.clear();
  sendAgentUpdate({
    state: 'idle',
    project: 'Antigravity',
    model: 'Antigravity',
    plan: 'Google AI Pro',
    message: 'Ready & listening',
    sessions: [],
    heroId: 'default',
    expand: false
  });
}

module.exports = {
  handleAgentEvent,
  dismissSession,
  resetAllSessions
};

