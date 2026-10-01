const http = require('http');
const path = require('path');

const eventType = process.argv[2] || 'pre-invocation';
let inputData = '';

process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => {
  inputData += chunk;
});

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

  // Derive target agent state
  let state = 'thinking';
  if (eventType === 'stop') {
    state = 'done';
  } else if (eventType === 'pre-invocation') {
    state = 'thinking';
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
