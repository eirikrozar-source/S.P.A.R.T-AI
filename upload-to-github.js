/**
 * S.P.A.R.T GitHub Uploader
 * Uploads all project files directly to https://github.com/eirikrozar-source/S.P.A.R.T-AI
 * using GitHub's REST API without requiring git.exe to be installed.
 *
 * Usage:
 *   node upload-to-github.js <YOUR_GITHUB_PERSONAL_ACCESS_TOKEN>
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const REPO_OWNER = 'eirikrozar-source';
const REPO_NAME = 'S.P.A.R.T-AI';
const BRANCH = 'main';

const token = process.argv[2] || process.env.GITHUB_TOKEN;

if (!token) {
  console.log(`\n======================================================`);
  console.log(` S.P.A.R.T GitHub Direct Uploader`);
  console.log(`======================================================`);
  console.log(`Error: Missing GitHub Personal Access Token.`);
  console.log(`\nTo upload, run:`);
  console.log(`  node upload-to-github.js <YOUR_GITHUB_TOKEN>`);
  console.log(`\nHow to get a GitHub token:`);
  console.log(`  1. Open: https://github.com/settings/tokens?type=beta`);
  console.log(`     (or classic tokens: https://github.com/settings/tokens)`);
  console.log(`  2. Click "Generate new token" and give "repo" or "Contents: Read & write" permission.`);
  console.log(`  3. Copy token and run: node upload-to-github.js ghp_yourTokenHere`);
  console.log(`======================================================\n`);
  process.exit(1);
}

// Files to upload
const FILES_TO_UPLOAD = [
  'README.md',
  'index.html',
  'styles.css',
  'app.js',
  'server.js',
  'start.bat',
  '.gitignore',
  '.env.example'
];

function uploadFile(fileName) {
  return new Promise((resolve, reject) => {
    const filePath = path.join(__dirname, fileName);
    if (!fs.existsSync(filePath)) {
      return reject(new Error(`File not found: ${fileName}`));
    }

    const contentBuffer = fs.readFileSync(filePath);
    const base64Content = contentBuffer.toString('base64');

    const payload = JSON.stringify({
      message: `Add ${fileName}`,
      content: base64Content,
      branch: BRANCH
    });

    const options = {
      hostname: 'api.github.com',
      path: `/repos/${REPO_OWNER}/${REPO_NAME}/contents/${encodeURIComponent(fileName)}`,
      method: 'PUT',
      headers: {
        'User-Agent': 'SPART-Uploader-Script',
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github+json',
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        if (res.statusCode === 200 || res.statusCode === 201) {
          console.log(`✓ Uploaded: ${fileName}`);
          resolve(fileName);
        } else {
          try {
            const errJson = JSON.parse(body);
            reject(new Error(`Failed ${fileName} [HTTP ${res.statusCode}]: ${errJson.message}`));
          } catch (e) {
            reject(new Error(`Failed ${fileName} [HTTP ${res.statusCode}]: ${body}`));
          }
        }
      });
    });

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function run() {
  console.log(`\n======================================================`);
  console.log(` Uploading S.P.A.R.T to https://github.com/${REPO_OWNER}/${REPO_NAME}`);
  console.log(` Target Branch: ${BRANCH}`);
  console.log(`======================================================\n`);

  for (const file of FILES_TO_UPLOAD) {
    try {
      await uploadFile(file);
      // Brief delay to avoid rate limiting
      await new Promise(r => setTimeout(r, 600));
    } catch (err) {
      console.error(`✗ Error uploading ${file}:`, err.message);
      process.exit(1);
    }
  }

  console.log(`\n======================================================`);
  console.log(`🎉 SUCCESS! All files uploaded successfully.`);
  console.log(`View repository at: https://github.com/${REPO_OWNER}/${REPO_NAME}`);
  console.log(`======================================================\n`);
}

run();

