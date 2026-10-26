import http from 'http';

export const CajyuLib = {
  Server: class {
    constructor(port = 3000) {
      this.port = port;
      this.routes = {};
      this.getHandlers = {};
      this.postHandlers = [];
      this.sleeping = false;
      this.server = null;
      this.wake();
    }

    wake() {
      if (this.server) return;
      this.sleeping = false;
      this.server = http.createServer(async (req, res) => {
        if (this.sleeping) {
          res.writeHead(503);
          res.end(JSON.stringify({ error: 'Server is sleeping' }));
          return;
        }

        if (req.method === 'POST') {
          let body = '';
          for await (const chunk of req) body += chunk;
          let json = {};
          try { json = JSON.parse(body || '{}'); } catch { json = {}; }

          for (const handler of this.postHandlers) {
            try {
              const result = await handler(json);
              if (result !== undefined) {
                const code = result.code || 200;
                const payload = { ...result };
                delete payload.code;
                res.writeHead(code, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(payload));
                return;
              }
            } catch (e) {
              res.writeHead(500);
              res.end(JSON.stringify({ error: String(e.message) }));
              return;
            }
          }
          res.writeHead(404);
          res.end(JSON.stringify({ error: 'No POST handler' }));
          return;
        }

        if (req.method === 'GET') {
          const url = req.url || '/';

          if (this.getHandlers[url]) {
            const reqObj = { url, headers: req.headers };
            const resObj = {
              _res: res,
              json(data, code = 200) {
                res.writeHead(code, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(data));
              },
              send(data, code = 200, type = 'text/plain') {
                res.writeHead(code, { 'Content-Type': type });
                res.end(String(data));
              },
              html(data, code = 200) {
                res.writeHead(code, { 'Content-Type': 'text/html' });
                res.end(String(data));
              },
            };
            try {
              await this.getHandlers[url](reqObj, resObj);
            } catch (e) {
              res.writeHead(500);
              res.end(JSON.stringify({ error: String(e.message) }));
            }
            return;
          }

          const staticUrl = url === '/' ? '/index.html' : url;
          if (this.routes[staticUrl]) {
            const { content, type } = this.routes[staticUrl];
            res.writeHead(200, { 'Content-Type': type });
            res.end(String(content));
            return;
          }

          res.writeHead(404);
          res.end('Not found');
          return;
        }

        res.writeHead(405);
        res.end('Method not allowed');
      });
    }

    sleep() {
      this.sleeping = true;
      console.log('[http] Server is now sleeping');
    }

    post(handler) {
      if (typeof handler === 'function') {
        this.postHandlers.push(handler);
        console.log(`[http] Post method created.`);
      }
    }

    get(route, handler) {
      if (typeof handler === 'function') {
        const r = route.startsWith('/') ? route : '/' + route;
        this.getHandlers[r] = handler;
        console.log(`[http] Get method created for ${r}.`);
      }
    }

    file(route, content, type) {
      const r = route.startsWith('/') ? route : '/' + route;
      const resolvedType = type || inferType(r);
      this.routes[r] = { content, type: resolvedType };
      console.log(`[http] Created file ${route} as type ${resolvedType}`);
    }

    close() {
      if (this.server) {
        this.server.close();
        this.server = null;
        console.log(`[http] Closed server http on port ${this.port}`);
      }
    }

    start() {
      this.server.listen(this.port, () => {
        console.log(`[http] Created server http on port ${this.port}`);
      });
    }
  }
};

function inferType(route) {
  const ext = route.split('.').pop().toLowerCase();
  const map = {
    html: 'text/html',
    htm:  'text/html',
    css:  'text/css',
    js:   'application/javascript',
    json: 'application/json',
    xml:  'application/xml',
    svg:  'image/svg+xml',
    png:  'image/png',
    jpg:  'image/jpeg',
    jpeg: 'image/jpeg',
    gif:  'image/gif',
    ico:  'image/x-icon',
    txt:  'text/plain',
    md:   'text/markdown',
    csv:  'text/csv',
    pdf:  'application/pdf',
  };
  return map[ext] || 'text/plain';
}
