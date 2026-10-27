/**
 * S.P.A.R.T Local Development Server with Gemini API Proxy
 * Zero external dependencies. Uses Node.js built-in 'http', 'https', and 'fs'.
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

// Auto-load .env file if present
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split(/\r?\n/).forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const match = trimmed.match(/^([\w.-]+)\s*=\s*(.*)?$/);
    if (match) {
      const key = match[1];
      let val = (match[2] || '').trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      process.env[key] = val;
    }
  });
}

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = __dirname;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';

const MIME_TYPES = {
  '.html': 'text/html; charset=UTF-8',
  '.css': 'text/css; charset=UTF-8',
  '.js': 'application/javascript; charset=UTF-8',
  '.json': 'application/json; charset=UTF-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg'
};

function queryGemini(prompt, userName, mode, callback) {
  if (!GEMINI_API_KEY) {
    callback(new Error('No GEMINI_API_KEY configured in environment or .env file.'));
    return;
  }

  const systemPrompt = `You are S.P.A.R.T (Smart Perpetual Assistant for Research Tasks), an advanced, highly articulate, polite, and respectful autonomous research AI assistant.
The user's name is ${userName || 'Researcher'}. Current Research Mode: ${mode || 'general'}.

Guidelines:
1. Always maintain a well-mannered, respectful, courteous, and intellectual tone. Address the user politely.
2. Provide accurate, clear, factual, and scientifically grounded responses.
3. Structure your response with clean formatting, bullet points, and sections when appropriate.
4. Keep the initial sentence or two concise, natural, and clear so it sounds wonderful when read aloud by text-to-speech.`;

  const payload = JSON.stringify({
    contents: [
      {
        role: 'user',
        parts: [
          { text: systemPrompt + '\n\nUser Question/Request: "' + prompt + '"' }
        ]
      }
    ],
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 1000
    }
  });

  const model = 'gemini-3.5-flash-lite';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;

  const req = https.request(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload)
    },
    timeout: 12000
  }, (res) => {
    let body = '';
    res.on('data', chunk => body += chunk);
    res.on('end', () => {
      try {
        const json = JSON.parse(body);
        if (json.candidates && json.candidates[0] && json.candidates[0].content && json.candidates[0].content.parts[0]) {
          const fullText = json.candidates[0].content.parts[0].text;
          callback(null, fullText);
        } else if (json.error) {
          callback(new Error(json.error.message || 'Gemini API Error'));
        } else {
          callback(new Error('Unexpected response format from Gemini'));
        }
      } catch (err) {
        callback(err);
      }
    });
  });

  req.on('error', err => callback(err));
  req.on('timeout', () => {
    req.destroy();
    callback(new Error('Gemini API request timed out'));
  });

  req.write(payload);
  req.end();
}

const server = http.createServer((req, res) => {
  // Handle API route: /api/ask
  if (req.method === 'POST' && req.url === '/api/ask') {
    let raw = '';
    req.on('data', chunk => raw += chunk);
    req.on('end', () => {
      try {
        const data = JSON.parse(raw);
        const prompt = data.prompt;
        const userName = data.userName || 'Researcher';
        const mode = data.mode || 'general';

        if (!prompt) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Missing prompt' }));
          return;
        }

        queryGemini(prompt, userName, mode, (err, answer) => {
          if (err) {
            console.warn('Gemini proxy error:', err.message);
            res.writeHead(502, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message }));
            return;
          }

          res.writeHead(200, {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          });
          res.end(JSON.stringify({ success: true, text: answer }));
        });
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON request' }));
      }
    });
    return;
  }

  // Handle Static files
  let reqPath = req.url.split('?')[0];
  if (reqPath === '/' || reqPath === '') {
    reqPath = '/index.html';
  }

  const safePath = path.normalize(reqPath).replace(/^(\.\.[\/\\])+/, '');
  const filePath = path.join(PUBLIC_DIR, safePath);

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found: ' + reqPath);
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'no-cache, no-store, must-revalidate'
    });

    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  });
});

server.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(` S.P.A.R.T Autonomous Voice Research Assistant Server `);
  console.log(` Powered by Gemini API`);
  console.log(` Running at: http://localhost:${PORT}`);
  console.log(`=======================================================`);
});
