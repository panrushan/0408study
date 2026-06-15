/* ================================
   安肌成分检测 - Node.js 代理服务器
   功能：静态文件服务 + 百度OCR代理
   启动：node server.js
   访问：http://localhost:3000
   ================================ */

require('dotenv').config();

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = 3000;
// 从环境变量读取百度API密钥，避免上传到代码仓库泄露
const BAIDU_AK = process.env.BAIDU_AK;
const BAIDU_SK = process.env.BAIDU_SK;

if (!BAIDU_AK || !BAIDU_SK) {
  console.error('ERROR: 请设置环境变量 BAIDU_AK 和 BAIDU_SK');
  console.error('可以在 .env 文件中配置，或执行：set BAIDU_AK=你的AK');
  process.exit(1);
}

let baiduToken = null;
let tokenExpireTime = 0;

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

function sendJSON(res, status, data) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(JSON.stringify(data));
}

function sendError(res, status, message) {
  sendJSON(res, status, { error: message });
}

async function getBaiduToken() {
  const now = Date.now();
  if (baiduToken && now < tokenExpireTime - 60000) {
    return baiduToken;
  }

  const tokenUrl = `https://aip.baidubce.com/oauth/2.0/token?grant_type=client_credentials&client_id=${encodeURIComponent(BAIDU_AK)}&client_secret=${encodeURIComponent(BAIDU_SK)}`;

  try {
    const response = await fetch(tokenUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' } });
    const data = await response.json();
    if (data.access_token) {
      baiduToken = data.access_token;
      tokenExpireTime = now + (data.expires_in || 2592000) * 1000;
      console.log('[Baidu OCR] Access Token OK');
      return baiduToken;
    } else {
      throw new Error(data.error_description || 'Token failed');
    }
  } catch (err) {
    console.error('[Baidu OCR] Token error:', err.message);
    throw err;
  }
}

async function callBaiduOCR(imageBase64) {
  const token = await getBaiduToken();
  const pureBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');

  console.log('[Debug] base64 length:', pureBase64.length);
  console.log('[Debug] base64 head:', pureBase64.substring(0, 100));

  if (pureBase64.length < 100) {
    throw new Error('Invalid image data');
  }

  const ocrUrl = `https://aip.baidubce.com/rest/2.0/ocr/v1/accurate_basic?access_token=${encodeURIComponent(token)}`;

  const response = await fetch(ocrUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `image=${encodeURIComponent(pureBase64)}`,
  });

  const data = await response.json();
  console.log('[Debug] Baidu response:', JSON.stringify(data).substring(0, 500));
  if (data.error_code) {
    throw new Error(`Baidu OCR ${data.error_code}: ${data.error_msg}`);
  }
  return data;
}

function serveStatic(req, res, filePath) {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      if (err.code === 'ENOENT') {
        sendError(res, 404, 'Not found');
      } else {
        sendError(res, 500, 'Server error');
      }
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    const contentType = mimeTypes[ext] || 'application/octet-stream';
    res.writeHead(200, {
      'Content-Type': contentType,
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
    });
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    res.end();
    return;
  }

  // Version debug route
  if (pathname === '/version' && req.method === 'GET') {
    try {
      const indexContent = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
      const hasV3 = indexContent.includes('百度OCR版 v3');
      sendJSON(res, 200, {
        success: true,
        port: PORT,
        time: new Date().toLocaleString('zh-CN'),
        hasV3Tag: hasV3,
        message: hasV3 ? 'index.html is latest' : 'index.html missing v3 tag'
      });
    } catch (err) {
      sendError(res, 500, err.message);
    }
    return;
  }

  // OCR API route
  if (pathname === '/api/ocr' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const json = JSON.parse(body);
        if (!json.image) {
          sendError(res, 400, 'Missing image');
          return;
        }
        console.log('[OCR] Processing image...');
        const result = await callBaiduOCR(json.image);
        console.log('[OCR] Recognized', result.words_result ? result.words_result.length : 0, 'lines');
        sendJSON(res, 200, { success: true, data: result });
      } catch (err) {
        console.error('[OCR error]', err.message);
        sendError(res, 500, err.message);
      }
    });
    return;
  }

  // Static files
  let filePath = pathname === '/' ? '/index.html' : pathname;
  filePath = path.join(__dirname, filePath);

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      sendError(res, 404, 'Not found');
      return;
    }
    serveStatic(req, res, filePath);
  });
});

server.listen(PORT, () => {
  console.log(`================================`);
  console.log(`AnJi Server Started`);
  console.log(`URL: http://localhost:${PORT}`);
  console.log(`Keep this window running`);
  console.log(`================================`);
});
