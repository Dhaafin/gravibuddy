const http = require('http');

function sendEvent(data) {
  const postData = JSON.stringify(data);
  const req = http.request({
    hostname: '127.0.0.1',
    port: 8998,
    path: '/update',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
    }
  }, res => {
    console.log(`Sent: ${data.state || data.agent_state} -> HTTP ${res.statusCode}`);
  });
  req.on('error', err => console.log('Error:', err.message));
  req.write(postData);
  req.end();
}

const action = process.argv[2] || 'thinking';

if (action === 'thinking') {
  sendEvent({ agent_state: 'thinking', model: { display_name: 'Gemini 3.8 Flash (High)' }, message: 'Synthesizing feature implementation...' });
} else if (action === 'done') {
  sendEvent({ agent_state: 'idle', model: { display_name: 'Gemini 3.8 Flash (High)' }, message: 'Refactoring completed successfully' });
} else if (action === 'waiting') {
  sendEvent({ agent_state: 'waiting_for_input', tool_confirmation_pending: true, model: { display_name: 'Gemini 3.8 Flash (High)' }, message: 'Bash command requires confirmation' });
} else if (action === 'agy2') {
  sendEvent({ source: 'antigravity-2.0', state: 'thinking', model: 'Gemini 3.8 Flash (High)', project: 'gravibuddy', message: 'Analyzing codebase with Antigravity 2.0' });
} else if (action === 'agy2-done') {
  sendEvent({ source: 'antigravity-2.0', state: 'done', model: 'Gemini 3.8 Flash (High)', project: 'gravibuddy', message: 'Turn complete' });
} else {
  sendEvent({ agent_state: 'idle', model: { display_name: 'Gemini 3.8 Flash (High)' }, quota: { 'gemini-5h': { remaining_fraction: 0.94 } } });
}
