const http = require('http');
const path = require('path');
const fs = require('fs');

const eventType = process.argv[2] || 'pre-invocation';
let inputData = '';

process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => {
  inputData += chunk;
});

function inspectLastPlannerStep(transcriptPath) {
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
    for (let i = lines.length - 1; i >= 0; i--) {
      try {
        const entry = JSON.parse(lines[i]);
        if (entry.type === 'PLANNER_RESPONSE') {
          return entry;
        }
      } catch (e) {}
    }
  } catch (e) {}
  return null;
}

process.stdin.on('end', () => {
  // Always immediately output valid JSON to stdout so Antigravity 2.0 never blocks or waits
  process.stdout.write('{}\n');

  let payload = {};
  try {
    if (inputData.trim()) {
      payload = JSON.parse(inputData);
    }
  } catch (e) {
    payload = {};
  }

  // Derive target agent state and descriptive message
  let state = 'thinking';
  let message = null;
  let toolName = null;

  const lastStep = inspectLastPlannerStep(payload.transcriptPath);
  if (lastStep?.tool_calls && lastStep.tool_calls.length > 0) {
    toolName = lastStep.tool_calls[0].name;
  }

  if (eventType === 'stop') {
    // 1. Check if background tasks/commands are still actively executing
    if (payload.fullyIdle === false) {
      state = 'thinking';
      message = toolName ? `Executing ${toolName}...` : 'Running in background...';
    } else {
      // 2. Check if the turn stopped because the agent asked a question
      const questionTool = lastStep?.tool_calls?.find(t => t.name === 'ask_question');

      if (questionTool) {
        state = 'waiting';
        const qList = questionTool.args?.questions;
        message = Array.isArray(qList) && qList[0]?.question ? qList[0].question : 'Question from Antigravity';
      } else if (payload.terminationReason === 'error') {
        state = 'waiting';
        message = payload.error || 'Execution stopped with error';
      } else {
        // Genuinely completed turn
        state = 'done';
        message = 'Task completed';
      }
    }
  } else if (eventType === 'pre-invocation') {
    state = 'thinking';
    message = toolName ? `Running ${toolName}...` : 'Thinking & reasoning...';
  }

  // Extract project name from workspacePaths if available
  let projectName = null;
  if (Array.isArray(payload.workspacePaths) && payload.workspacePaths.length > 0) {
    projectName = path.basename(payload.workspacePaths[0]);
  }

  const postPayload = JSON.stringify({
    source: 'antigravity-2.0',
    conversationId: payload.conversationId || null,
    state: state,
    model: payload.modelName || 'Gemini',
    project: projectName,
    message: message,
    toolName: toolName,
    timestamp: Date.now()
  });

  // Fire-and-forget HTTP POST to Gravibuddy
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
    req.on('error', () => {}); // Silently ignore if Gravibuddy is not running
    req.write(postPayload);
    req.end();
  } catch (e) {}
});
