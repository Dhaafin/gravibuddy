const http = require('http');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

let input = '';

process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => {
  input += chunk;
});

process.stdin.on('end', () => {
  if (input.trim()) {
    // Debug dump
    try {
      fs.writeFileSync(path.join(__dirname, 'last_payload.json'), input, 'utf8');
    } catch (e) {}

    // 1. Post to agy-vibing floating island (fire-and-forget)
    try {
      const parsed = JSON.parse(input);
      const postData = JSON.stringify(parsed);
      const req = http.request({
        hostname: '127.0.0.1',
        port: 8998,
        path: '/update',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        },
        timeout: 300
      });
      req.on('error', () => {}); // Silently ignore if agy-vibing is not running
      req.write(postData);
      req.end();
    } catch (e) {}
  }

  // 2. Also pass through to agy-hud so the terminal statusline continues working
  const hudPath = 'C:\\Users\\Dhaafin\\.gemini\\config\\plugins\\agy-hud\\dist\\agy-hud.js';
  try {
    if (fs.existsSync(hudPath)) {
      const hudProc = spawn(process.execPath, [hudPath, 'statusline'], {
        stdio: ['pipe', 'inherit', 'inherit']
      });
      hudProc.stdin.write(input);
      hudProc.stdin.end();
      hudProc.on('exit', code => {
        process.exit(code || 0);
      });
      return;
    }
  } catch (e) {}

  process.exit(0);
});
