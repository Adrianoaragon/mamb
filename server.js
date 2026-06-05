const http = require('http');
const fs = require('fs');
const path = require('path');
let sharp;
try { sharp = require('sharp'); } catch { sharp = null; }

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, 'public');
const UPLOADS_DIR = path.join(ROOT, 'uploads');
const DB_PATH = path.join(ROOT, 'db.json');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.bin': 'application/octet-stream',
};

function loadDB() {
  try {
    if (fs.existsSync(DB_PATH)) return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
  } catch {}
  return { obras: [] };
}

function saveDB(db) {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

function sendJson(res, statusCode, payload) {
  send(res, statusCode, JSON.stringify(payload), 'application/json; charset=utf-8');
}

function send(res, statusCode, body, contentType) {
  res.writeHead(statusCode, {
    'Content-Type': contentType,
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 25 * 1024 * 1024) {
        req.destroy();
        reject(new Error('Body demasiado grande.'));
      }
    });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

function safeResolve(baseDir, requestPath) {
  const decodedPath = decodeURIComponent(requestPath.split('?')[0]);
  const normalizedPath = decodedPath === '/' ? '/index.html' : decodedPath;
  const filePath = path.normalize(path.join(baseDir, normalizedPath));
  return filePath.startsWith(baseDir) ? filePath : null;
}

function serveFile(res, filePath) {
  fs.readFile(filePath, (err, data) => {
    if (err) return send(res, 404, 'Archivo no encontrado', 'text/plain; charset=utf-8');

    const contentType = MIME_TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
    res.writeHead(200, {
      'Content-Type': contentType,
      'Access-Control-Allow-Origin': '*',
    });
    res.end(data);
  });
}

async function saveImage(dataUrl, filename) {
  const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, '');
  const buffer = Buffer.from(base64, 'base64');
  const outPath = path.join(UPLOADS_DIR, filename);
  if (sharp) {
    // Comprimir a JPEG calidad 75, max 1200px de ancho
    await sharp(buffer)
      .resize({ width: 1200, withoutEnlargement: true })
      .jpeg({ quality: 75, progressive: true })
      .toFile(outPath);
  } else {
    fs.writeFileSync(outPath, buffer);
  }
}

async function handleApi(req, res) {
  if (req.method === 'OPTIONS') return send(res, 204, '', 'text/plain; charset=utf-8');

  if (req.method === 'GET' && req.url === '/api/status') {
    return sendJson(res, 200, {
      ok: true,
      message: 'MAMB Servidor activo',
      timestamp: new Date().toISOString(),
    });
  }

  if (req.method === 'GET' && req.url === '/api/obras') {
    return sendJson(res, 200, { ok: true, obras: loadDB().obras });
  }

  if (req.method === 'POST' && req.url === '/api/save-obra') {
    try {
      const body = JSON.parse(await readBody(req));
      const { title, autor, style, generatedImage, originalImage, description, tags } = body;
      if (!generatedImage) return sendJson(res, 400, { error: 'Falta la imagen generada.' });

      if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

      const ts = Date.now();
      const genFilename = `obra_${ts}.jpg`;
      await saveImage(generatedImage, genFilename);

      let origFilename = null;
      if (originalImage) {
        origFilename = `original_${ts}.jpg`;
        await saveImage(originalImage, origFilename);
      }

      const db = loadDB();
      const obra = {
        id: ts,
        num: (db.obras.length + 1).toString().padStart(3, '0'),
        title: title || 'Sin titulo',
        autor: autor || 'Artista anonimo',
        style: style || 'Vincent van Gogh',
        url: `/uploads/${genFilename}`,
        originalUrl: origFilename ? `/uploads/${origFilename}` : null,
        description: description || 'Tu obra esta lista para el museo.',
        tags: tags || ['arte'],
        date: new Date().toLocaleDateString('es-CO'),
      };

      db.obras.unshift(obra);
      saveDB(db);

      return sendJson(res, 200, { ok: true, obra });
    } catch {
      return sendJson(res, 400, { error: 'Solicitud invalida.' });
    }
  }

  return sendJson(res, 404, { error: 'Ruta no encontrada.' });
}

const server = http.createServer(async (req, res) => {
  if (req.url.startsWith('/api/')) return handleApi(req, res);

  if (req.url.startsWith('/uploads/')) {
    const uploadPath = safeResolve(ROOT, req.url);
    if (!uploadPath) return send(res, 403, 'Ruta invalida', 'text/plain; charset=utf-8');
    return serveFile(res, uploadPath);
  }

  const filePath = safeResolve(PUBLIC_DIR, req.url);
  if (filePath && fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    return serveFile(res, filePath);
  }

  return serveFile(res, path.join(PUBLIC_DIR, 'index.html'));
});

server.listen(PORT, () => {
  console.log(`\nMAMB - Servidor corriendo en http://localhost:${PORT}`);
  console.log(`   Sitio web:       http://localhost:${PORT}/`);
  console.log(`   App interactiva: http://localhost:${PORT}/interactivo.html`);
  console.log(`   API status:      http://localhost:${PORT}/api/status\n`);
});