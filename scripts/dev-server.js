#!/usr/bin/env node

const http = require('http');
const fs = require('fs');
const path = require('path');
const { addCategory, deleteCategory } = require('./category-store');
const { collectCustomCategory } = require('./collect-custom');
const { generateHTML } = require('./generate-html');

const ROOT = path.join(__dirname, '..');
const PUBLIC = path.join(ROOT, 'public');
const ENV_PORT = process.env.PORT;
const PREFERRED_PORT = ENV_PORT !== undefined ? Number(ENV_PORT) : 3000;
const STRICT_PORT = ENV_PORT !== undefined;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function mergeCustomData(newBlock) {
  const dataFile = path.join(ROOT, 'data', 'custom-data.json');
  let list = [];
  if (fs.existsSync(dataFile)) {
    try {
      list = JSON.parse(fs.readFileSync(dataFile, 'utf-8'));
    } catch {
      list = [];
    }
  }
  const i = list.findIndex((c) => c.id === newBlock.id);
  if (i >= 0) list[i] = newBlock;
  else list.push(newBlock);
  fs.writeFileSync(dataFile, JSON.stringify(list, null, 2));

  const today = new Date().toISOString().slice(0, 10);
  const datedFile = path.join(ROOT, 'data', 'custom-data-' + today + '.json');
  fs.writeFileSync(datedFile, JSON.stringify(list, null, 2));
}

async function handleAddCategory(res, bodyText) {
  let body;
  try {
    body = JSON.parse(bodyText || '{}');
  } catch {
    res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: '无效的 JSON' }));
    return;
  }

  const { name, keywords } = body;
  const keywordList =
    typeof keywords === 'string'
      ? keywords
          .split(',')
          .map((k) => k.trim())
          .filter(Boolean)
      : Array.isArray(keywords)
        ? keywords.filter(Boolean)
        : [];

  try {
    const entry = addCategory(name, keywordList);
    console.log('📌 已保存栏目，开始全网采集:', entry.name);
    const block = await collectCustomCategory(entry);
    mergeCustomData(block);
    await generateHTML();
    console.log('✅ 栏目采集完成并已重新生成页面');
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ success: true, id: entry.id, message: '添加并采集成功' }));
  } catch (e) {
    const code = e.statusCode || 500;
    console.error(code >= 500 ? e : e.message);
    res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: e.message || '操作失败' }));
  }
}

async function handleDeleteCategory(res, bodyText) {
  let body;
  try { body = JSON.parse(bodyText || '{}'); } catch {
    res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
    return res.end(JSON.stringify({ error: '无效的 JSON' }));
  }

  const { id } = body;
  try {
    const result = deleteCategory(id);
    await generateHTML();
    console.log('🗑️ 栏目已删除并重新生成页面:', id);
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ success: true, ...result }));
  } catch (e) {
    const code = e.statusCode || 500;
    console.error(code >= 500 ? e : e.message);
    res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: e.message || '操作失败' }));
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://127.0.0.1`);

  if (req.method === 'POST' && url.pathname === '/api/add-category') {
    const body = await readBody(req);
    return handleAddCategory(res, body);
  }

  if (req.method === 'POST' && url.pathname === '/api/delete-category') {
    const body = await readBody(req);
    return handleDeleteCategory(res, body);
  }

  let filePath = url.pathname === '/' ? '/index.html' : url.pathname;
  filePath = path.normalize(filePath).replace(/^(\.\.[/\\])+/, '');
  const abs = path.join(PUBLIC, filePath);

  if (!abs.startsWith(PUBLIC)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }

  fs.readFile(abs, (err, data) => {
    if (err) {
      res.writeHead(err.code === 'ENOENT' ? 404 : 500);
      return res.end(err.code === 'ENOENT' ? 'Not found' : 'Error');
    }
    const ext = path.extname(abs);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
});

let listenPort = PREFERRED_PORT;
const PORT_CEILING = PREFERRED_PORT + 40;
let readyLogged = false;

function startListening() {
  server.once('error', (err) => {
    if (err.code !== 'EADDRINUSE') {
      console.error(err);
      process.exit(1);
    }
    if (STRICT_PORT || listenPort >= PORT_CEILING) {
      console.error(
        STRICT_PORT
          ? `端口 ${listenPort} 已被占用。请结束占用进程，或换端口`
          : `端口 ${listenPort} 已被占用，且已尝试到 ${PORT_CEILING - 1}。请关闭之前的 node 进程。`
      );
      process.exit(1);
    }
    console.log(`  提示: 端口 ${listenPort} 已被占用，改用 ${listenPort + 1}`);
    listenPort += 1;
    startListening();
  });

  server.listen(listenPort, () => {
    server.removeAllListeners('error');
    if (readyLogged) return;
    readyLogged = true;
    console.log('');
    console.log(`  本地预览: http://127.0.0.1:${listenPort}`);
    console.log('  添加栏目后系统会通过搜索引擎全网采集，通常需 30 秒～2 分钟');
    console.log('');
  });
}

startListening();
