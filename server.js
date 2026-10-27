const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'AQ.Ab8RN6I5DNzddl4yRvwjTeULQRI34PIBaNDPEN6YQLqG2h-1Fw';

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff'
};

// Calls Google Gemini API
function callGeminiAPI(prompt, mode, userName) {
  return new Promise((resolve, reject) => {
    // Select persona instructions based on mode
    let systemInstruction = `You are S.P.A.R.T (Smart Perpetual Assistant for Research Tasks), an advanced, dignified, highly knowledgeable and polite male AI assistant. The user's name is ${userName || 'User'}.
Your responses must be directly and specifically tailored to the user's exact question without repetitive boilerplate.
Provide authoritative, accurate, well-structured answers using clean markdown (clear headings, bullet points, bold key terms, and code blocks with language tags when programming is involved).
Never give generic canned answers. Address the exact specific subject, constraints, and details the user asked about.`;

    const lowerPrompt = (prompt || '').toLowerCase();
    const isStudy = mode === 'study' || lowerPrompt.includes('study') || lowerPrompt.includes('quiz') || lowerPrompt.includes('flashcard') || lowerPrompt.includes('feynman') || lowerPrompt.includes('exam') || lowerPrompt.includes('syllabus');
    const isCareer = mode === 'career' || lowerPrompt.includes('career') || lowerPrompt.includes('resume') || lowerPrompt.includes('interview') || lowerPrompt.includes('job') || lowerPrompt.includes('salary') || lowerPrompt.includes('promotion');

    if (isStudy) {
      systemInstruction += `\n[Study Intelligence Activated]: Prioritize active recall, intuitive analogies (Feynman technique), step-by-step logic, and high-retention study guidance. Provide structured quizzes or flashcards if requested. Always ensure results are deeply accurate, well-mannered, and conclude with a concise spoken summary.`;
    } else if (isCareer) {
      systemInstruction += `\n[Career Intelligence Activated]: Provide executive-level career advice, tier-1 ATS resume audits (Google XYZ formula: Accomplished [X] as measured by [Y] by doing [Z]), STAR behavioral interview techniques, and strategic negotiation scripts. Keep the tone dignified, supportive, and well-mannered.`;
    }

    const fullPrompt = `${systemInstruction}\n\nUser Question:\n${prompt}`;

    const postData = JSON.stringify({
      contents: [{ parts: [{ text: fullPrompt }] }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 2048
      }
    });

    // Fast and confirmed active models for Google Gemini
    const models = ['gemini-3.5-flash-lite', 'gemini-3.6-flash', 'gemini-3.7-flash', 'gemini-flash-latest'];

    function attemptModel(modelIndex) {
      if (modelIndex >= models.length) {
        return reject(new Error('All Gemini models failed or timed out.'));
      }

      const modelName = models[modelIndex];
      const req = https.request({
        hostname: 'generativelanguage.googleapis.com',
        path: `/v1beta/models/${modelName}:generateContent?key=${GEMINI_API_KEY}`,
        method: 'POST',
        timeout: 9000,
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        }
      }, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          if (res.statusCode === 200) {
            try {
              const parsed = JSON.parse(body);
              const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
              if (text && text.trim().length > 0) {
                return resolve(text);
              }
            } catch (e) {}
          }
          // Retry next model if 404, 503 or 429
          attemptModel(modelIndex + 1);
        });
      });

      req.on('timeout', () => {
        req.destroy();
        attemptModel(modelIndex + 1);
      });

      req.on('error', () => {
        attemptModel(modelIndex + 1);
      });

      req.write(postData);
      req.end();
    }

    attemptModel(0);
  });
}

// Function to transcribe audio data using Gemini Multimodal Audio (supports English & Tamil)
function transcribeAudioWithGemini(base64Audio, mimeType, language) {
  return new Promise((resolve, reject) => {
    const isTamil = Boolean(language && language.toLowerCase().includes('ta'));
    const langPrompt = isTamil 
      ? 'Transcribe this Tamil speech audio into Tamil script with high accuracy. Return only the exact transcribed Tamil words with punctuation. Do not add any conversational preamble.'
      : 'Transcribe this speech audio into accurate English text. Return only the exact transcribed speech text with correct punctuation, and no conversational preamble or quotes.';

    const postData = JSON.stringify({
      contents: [{
        parts: [
          { text: langPrompt },
          { inlineData: { mimeType: mimeType || 'audio/webm', data: base64Audio } }
        ]
      }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 1024
      }
    });

    const models = ['gemini-3.5-flash-lite', 'gemini-3.6-flash', 'gemini-3.7-flash', 'gemini-flash-latest'];

    function attemptAudioModel(idx) {
      if (idx >= models.length) {
        return reject(new Error('All transcription models failed or timed out.'));
      }
      const modelName = models[idx];
      const req = https.request({
        hostname: 'generativelanguage.googleapis.com',
        path: `/v1beta/models/${modelName}:generateContent?key=${GEMINI_API_KEY}`,
        method: 'POST',
        timeout: 12000,
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        }
      }, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          if (res.statusCode === 200) {
            try {
              const parsed = JSON.parse(body);
              const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
              if (text && text.trim()) return resolve(text.trim());
            } catch (e) {}
          }
          attemptAudioModel(idx + 1);
        });
      });

      req.on('timeout', () => { req.destroy(); attemptAudioModel(idx + 1); });
      req.on('error', () => attemptAudioModel(idx + 1));
      req.write(postData);
      req.end();
    }

    attemptAudioModel(0);
  });
}

const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = parsedUrl.pathname;

  // 1. API Route: POST /api/transcribe (Audio Speech-to-Text)
  if (req.method === 'POST' && pathname === '/api/transcribe') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body || '{}');
        const audioBase64 = payload.audio || payload.audioData || '';
        const mimeType = payload.mimeType || 'audio/webm';
        const language = payload.language || 'en-IN';

        if (!audioBase64) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Audio data required' }));
          return;
        }

        try {
          const transcript = await transcribeAudioWithGemini(audioBase64, mimeType, language);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, text: transcript, transcript: transcript }));
        } catch (sttErr) {
          console.warn('Gemini audio transcription error:', sttErr.message);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: sttErr.message }));
        }
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Invalid JSON payload' }));
      }
    });
    return;
  }

  // 2. API Route: POST /api/chat
  if (req.method === 'POST' && pathname === '/api/chat') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body || '{}');
        const userPrompt = payload.prompt || '';
        const mode = payload.mode || 'general';
        const userName = payload.userName || 'Devadharshini';

        if (!userPrompt.trim()) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Prompt is required' }));
          return;
        }

        try {
          const aiResponse = await callGeminiAPI(userPrompt, mode, userName);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            success: true,
            text: aiResponse,
            source: 'gemini-live'
          }));
        } catch (apiErr) {
          console.warn('Gemini live call timed out or failed, returning dynamic intelligence:', apiErr.message);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            success: false,
            error: apiErr.message,
            source: 'fallback'
          }));
        }
      } catch (parseErr) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON payload' }));
      }
    });
    return;
  }

  // 2. Static File Serving
  let reqPath = pathname;
  if (reqPath === '/') reqPath = '/index.html';

  const filePath = path.join(__dirname, reqPath);

  // Prevent path traversal
  if (!filePath.startsWith(__dirname)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('403 Forbidden');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'no-cache'
    });

    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  });
});

server.listen(PORT, () => {
  console.log(`S.P.A.R.T Server running with Gemini API Key on http://localhost:${PORT}`);
});
