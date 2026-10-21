import http from 'node:http';
import { stat } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { parseByteRange } from './src/range.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.ogg': 'audio/ogg', '.mp4': 'video/mp4', '.gltf': 'model/gltf+json', '.glb': 'model/gltf-binary', '.wasm': 'application/wasm' };
const port = Number(process.env.CRASH_MENU_PORT || 4173);
const server = http.createServer(async (req, res) => {
  try {
    let name = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    if (name.startsWith('/assets/')) name = '/public' + name;
    const file = path.resolve(root, '.' + (name === '/' ? '/index.html' : name));
    if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
    const info = await stat(file);
    if (!info.isFile()) { res.writeHead(404).end(); return; }
    const mime = types[path.extname(file)] || 'application/octet-stream';
    const range = parseByteRange(req.headers.range, info.size);
    if (range === false) { res.writeHead(416, { 'Content-Range': `bytes */${info.size}` }).end(); return; }
    const start = range?.start ?? 0, end = range?.end ?? info.size - 1;
    const headers = { 'Content-Type': mime, 'Content-Length': end - start + 1, 'Accept-Ranges': 'bytes', 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-cache' };
    if (range) headers['Content-Range'] = `bytes ${start}-${end}/${info.size}`;
    res.writeHead(range ? 206 : 200, headers);
    if (req.method === 'HEAD' || !info.size) { res.end(); return; }
    const stream = createReadStream(file, { start, end });
    stream.on('error', () => res.destroy()); res.on('close', () => stream.destroy()); stream.pipe(res);
  } catch { res.writeHead(404).end('Not found'); }
});
server.on('error', (err) => { console.error(err.code === 'EADDRINUSE' ? `Port ${port} is busy. Try http://127.0.0.1:${port}` : err.message); process.exitCode = 1; });
server.listen(port, '127.0.0.1', () => console.log(`Crash menu: http://127.0.0.1:${port}`));
