const http = require('http');
const path = require('path');
const fs = require('fs');

const eventType = process.argv[2] || 'pre-invocation';
let inputData = '';

process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => {
  inputData += chunk;
});

function inspectTranscript(transcriptPath) {
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

    let latestPlanner = null;
    for (const entry of entries) {
      if (
        entry.type === 'PLANNER_RESPONSE' &&
        (!latestPlanner || (entry.step_index ?? 0) >= (latestPlanner.step_index ?? 0))
      ) {
        latestPlanner = entry;
      }
    }
    if (!latestPlanner) return null;

    const plannerStep = latestPlanner.step_index ?? -1;
    const hasCompletedStepAfter = entries.some(
      e => (e.step_index ?? -1) > plannerStep && e.status === 'DONE'
    );

    return { latestPlanner, hasCompletedStepAfter };
  } catch (e) {}
  return null;
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

process.stdin.on('end', () => {
  if (eventType === 'pre-tool-use') {
    process.stdout.write('{"decision":"allow"}\n');
  } else {
    process.stdout.write('{}\n');
  }

  let payload = {};
  try {
    if (inputData.trim()) {
      payload = JSON.parse(inputData);
    }
  } catch (e) {
    payload = {};
  }

  let state = 'thinking';
  let message = null;
  let toolName = null;

  const inspected = inspectTranscript(payload.transcriptPath);
  const lastStep = inspected?.latestPlanner || null;
  const isPendingStep = inspected ? !inspected.hasCompletedStepAfter : false;
  const latestTool = isPendingStep ? (lastStep?.tool_calls?.[0]?.name || null) : null;
  const questionToolInStep = isPendingStep
    ? lastStep?.tool_calls?.find(t => t.name === 'ask_question')
    : null;

  if (eventType === 'pre-tool-use') {
    const tc = payload.toolCall || {};
    const resolvedToolName = (tc.name && tc.name !== 'generic') ? tc.name : latestTool;

    if (tc.name === 'ask_question' || resolvedToolName === 'ask_question' || questionToolInStep) {
      state = 'waiting';
      message = extractQuestionMessage(tc.args?.questions ? tc.args : questionToolInStep?.args);
      toolName = null;
    } else {
      state = 'thinking';
      toolName = resolvedToolName;
      message = resolvedToolName ? `Running ${resolvedToolName}...` : 'Thinking & reasoning...';
    }
  } else if (eventType === 'post-tool-use') {
    state = 'thinking';
    toolName = null;
    message = 'Thinking & reasoning...';
  } else if (eventType === 'stop') {
    if (payload.fullyIdle === false && latestTool) {
      state = 'thinking';
      toolName = latestTool;
      message = `Executing ${toolName}...`;
    } else if (questionToolInStep) {
      state = 'waiting';
      message = extractQuestionMessage(questionToolInStep.args);
    } else if (payload.terminationReason === 'error') {
      state = 'waiting';
      message = payload.error || 'Execution stopped with error';
    } else {
      state = 'done';
      message = 'Task completed';
    }
  } else if (eventType === 'pre-invocation') {
    state = 'thinking';
    toolName = latestTool;
    message = toolName ? `Running ${toolName}...` : 'Thinking & reasoning...';
  }

  let projectName = null;
  if (Array.isArray(payload.workspacePaths) && payload.workspacePaths.length > 0) {
    projectName = path.basename(payload.workspacePaths[0]);
  }

  const postPayload = JSON.stringify({
    source: 'antigravity-2.0',
    conversationId: payload.conversationId || null,
    transcriptPath: payload.transcriptPath || null,
    state,
    model: payload.modelName || 'Gemini',
    project: projectName,
    message,
    toolName,
    timestamp: Date.now()
  });

  try {
    const req = http.request({
      hostname: '127.0.0.1',
      port: 8998,
      path: '/update',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postPayload)
      },
      timeout: 250
    });
    req.on('error', () => {});
    req.write(postPayload);
    req.end();
  } catch (e) {}
});
