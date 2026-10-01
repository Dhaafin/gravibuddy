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
} else if (action === 'agy2-bg') {
  sendEvent({ source: 'antigravity-2.0', state: 'thinking', model: 'Gemini 3.8 Flash (High)', project: 'gravibuddy', message: 'Running npm test in background...' });
} else if (action === 'agy2-question') {
  sendEvent({ source: 'antigravity-2.0', state: 'waiting', model: 'Gemini 3.8 Flash (High)', project: 'gravibuddy', message: 'Mending kita ke Tauri in juga atau ngga?' });
} else if (action === 'agy2-done') {
  sendEvent({ source: 'antigravity-2.0', state: 'done', model: 'Gemini 3.8 Flash (High)', project: 'gravibuddy', message: 'Turn complete' });
} else if (action === 'multi') {
  sendEvent({ source: 'antigravity-2.0', conversationId: 'c1', project: 'agy-vibing', state: 'thinking', model: 'Gemini 3.8 Flash', message: 'Refactoring src/renderer/styles/island.css', toolName: 'replace_file_content' });
  setTimeout(() => {
    sendEvent({ source: 'antigravity-2.0', conversationId: 'c2', project: 'backend-api', state: 'idle', model: 'Claude 3.5 Sonnet', message: 'Server listening on :4000' });
  }, 100);
  setTimeout(() => {
    sendEvent({ source: 'antigravity-2.0', conversationId: 'c3', project: 'mobile-app', state: 'done', model: 'GPT-4o', message: 'Build succeeded in 12s' });
  }, 200);
} else if (action === 'multi-alert') {
  sendEvent({ source: 'antigravity-2.0', conversationId: 'c2', project: 'backend-api', state: 'waiting', model: 'Claude 3.5 Sonnet', message: 'Delete table `users` confirmation required', toolName: 'run_command' });
} else if (action === 'multi-switch') {
  sendEvent({ source: 'antigravity-2.0', conversationId: 'c3', project: 'mobile-app', state: 'thinking', model: 'GPT-4o', message: 'Compiling release APK...', toolName: 'gradle_build' });
} else {
  sendEvent({ agent_state: 'idle', model: { display_name: 'Gemini 3.8 Flash (High)' }, quota: { 'gemini-5h': { remaining_fraction: 0.94 } } });
}
