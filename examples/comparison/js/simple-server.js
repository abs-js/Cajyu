// Simple HTML server - JavaScript
import http from 'http';

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(`
    <!DOCTYPE html>
    <html>
      <head><title>Simple Server</title></head>
      <body>
        <h1>Hello from JavaScript!</h1>
        <p>This is a simple text served by a Node.js server.</p>
      </body>
    </html>
  `);
});

server.listen(3000, () => {
  console.log('JS server running at http://localhost:3000');
});
