import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';

const root = resolve(process.cwd(), process.argv[2] ?? 'dist/analog/public');
const mime: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
};

createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url ?? '/', 'http://localhost').pathname);
    let file = resolve(root, `.${pathname}`);
    if (!file.startsWith(root + sep) && file !== root) throw new Error('Invalid path');
    // `prerender.autoSubfolderIndex: false` emits /docs/guide as docs/guide.html (Cloudflare Pages serves it at the slash-less
    // URL), including for a route that also has children (docs/reference.html next to the docs/reference/ directory).
    const info = await stat(file).catch(() => undefined);
    const html = `${file}.html`;
    if (!info && !extname(file)) file = html;
    else if (info?.isDirectory())
      file = (await stat(resolve(file, 'index.html')).catch(() => undefined)) ? resolve(file, 'index.html') : html;
    // Read before writing headers: a directory without index.html (for example the bare /docs/v prefix) must answer 404.
    const body = await readFile(file);
    response.writeHead(200, { 'content-type': mime[extname(file)] ?? 'application/octet-stream' });
    response.end(body);
  } catch {
    response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    response.end('Not found');
  }
}).listen(Number(process.env.PORT ?? 4173), '127.0.0.1', () =>
  console.log(`Previewing ${root} at http://127.0.0.1:${process.env.PORT ?? 4173}`),
);
