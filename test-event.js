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
} else {
  sendEvent({ agent_state: 'idle', model: { display_name: 'Gemini 3.8 Flash (High)' }, quota: { 'gemini-5h': { remaining_fraction: 0.94 } } });
}
