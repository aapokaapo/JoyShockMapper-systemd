const fs = require('fs');
const fsp = require('fs/promises');
const http = require('http');
const net = require('net');
const path = require('path');

const ROOT_DIR = __dirname;
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');
const PORT = Number.parseInt(process.env.PORT ?? '3210', 10);
const DEFAULT_SOCKET_PATH = process.env.JSM_SOCKET_PATH ?? `/run/user/${typeof process.getuid === 'function' ? process.getuid() : '1000'}/joyshockmapper.sock`;

const CONTENT_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml; charset=utf-8'
};

function createHttpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, { 'Content-Type': CONTENT_TYPES['.json'] });
  response.end(JSON.stringify(payload));
}

function resolveSocketPath(candidate) {
  if (typeof candidate !== 'string') {
    return DEFAULT_SOCKET_PATH;
  }

  const trimmed = candidate.trim();
  return trimmed.length > 0 ? trimmed : DEFAULT_SOCKET_PATH;
}

async function getSocketStatus(candidate) {
  const socketPath = resolveSocketPath(candidate);

  try {
    const stats = await fsp.stat(socketPath);
    if (!stats.isSocket()) {
      return { available: false, socketPath, message: 'The path exists, but it is not a UNIX socket.' };
    }

    await new Promise((resolve, reject) => {
      const client = net.createConnection(socketPath);
      let settled = false;

      const finish = (callback, value) => {
        if (settled) {
          return;
        }
        settled = true;
        callback(value);
      };

      client.setTimeout(500, () => {
        client.destroy();
        finish(reject, new Error('Timed out while connecting to the JoyShockMapper socket.'));
      });
      client.once('error', (error) => {
        client.destroy();
        finish(reject, error);
      });
      client.once('connect', () => client.end(() => finish(resolve)));
    });

    return { available: true, socketPath };
  } catch (error) {
    return { available: false, socketPath, message: error.message };
  }
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    let body = '';
    let settled = false;

    const finish = (callback, value) => {
      if (settled) {
        return;
      }
      settled = true;
      callback(value);
    };

    request.on('data', (chunk) => {
      body += chunk;
      if (body.length > 1024 * 1024) {
        finish(reject, createHttpError(400, 'Request body is too large.'));
        request.destroy();
      }
    });

    request.on('end', () => {
      if (body.length === 0) {
        finish(resolve, {});
        return;
      }

      try {
        finish(resolve, JSON.parse(body));
      } catch (error) {
        finish(reject, createHttpError(400, 'Request body must be valid JSON.'));
      }
    });

    request.on('error', (error) => finish(reject, error));
  });
}

function sendCommands(commands, socketPath) {
  return new Promise((resolve, reject) => {
    const client = net.createConnection(socketPath);
    let settled = false;

    const finish = (callback, value) => {
      if (settled) {
        return;
      }
      settled = true;
      callback(value);
    };

    client.setTimeout(1000, () => {
      client.destroy();
      finish(reject, new Error('Timed out while writing to the JoyShockMapper socket.'));
    });
    client.once('error', (error) => {
      client.destroy();
      finish(reject, error);
    });
    client.once('connect', () => {
      client.end(`${commands.join('\n')}\n`, 'utf8', () => finish(resolve));
    });
  });
}

function isSafePublicPath(candidate) {
  const resolved = path.resolve(candidate);
  return resolved === PUBLIC_DIR || resolved.startsWith(`${PUBLIC_DIR}${path.sep}`);
}

async function serveStatic(requestPath, response) {
  let normalizedPath;

  try {
    normalizedPath = requestPath === '/' ? '/index.html' : decodeURIComponent(requestPath);
  } catch (error) {
    sendJson(response, 400, { error: 'Invalid asset path.' });
    return;
  }

  const filePath = path.resolve(path.join(PUBLIC_DIR, normalizedPath));

  if (!isSafePublicPath(filePath)) {
    sendJson(response, 403, { error: 'Forbidden path.' });
    return;
  }

  try {
    const data = await fsp.readFile(filePath);
    const extension = path.extname(filePath);
    response.writeHead(200, {
      'Content-Type': CONTENT_TYPES[extension] ?? 'application/octet-stream'
    });
    response.end(data);
  } catch (error) {
    if (error.code === 'ENOENT' || error.code === 'EISDIR') {
      sendJson(response, 404, { error: 'Not found.' });
      return;
    }

    sendJson(response, 500, { error: 'Failed to read asset.', detail: error.message });
  }
}

async function handleApi(request, response, url) {
  if (request.method === 'GET' && url.pathname === '/api/socket-status') {
    sendJson(response, 200, await getSocketStatus(url.searchParams.get('path')));
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/commands') {
    try {
      const payload = await readJson(request);
      const socketPath = resolveSocketPath(payload.socketPath);
      const commands = Array.isArray(payload.commands)
        ? payload.commands.map((command) => String(command).trim()).filter(Boolean)
        : [];

      if (commands.length === 0) {
        sendJson(response, 400, { error: 'Provide at least one non-empty command.' });
        return;
      }

      await sendCommands(commands, socketPath);
      sendJson(response, 200, { ok: true, sent: commands, socketPath });
    } catch (error) {
      const statusCode = error.statusCode ?? 500;
      sendJson(response, statusCode, {
        error: statusCode === 400 ? 'Invalid command request.' : 'Failed to send commands.',
        detail: error.message
      });
    }
    return;
  }

  sendJson(response, 404, { error: 'Unknown API route.' });
}

const server = http.createServer(async (request, response) => {
  let url;

  try {
    url = new URL(request.url ?? '/', 'http://127.0.0.1');
  } catch (error) {
    sendJson(response, 400, { error: 'Invalid request URL.' });
    return;
  }

  if (url.pathname.startsWith('/api/')) {
    await handleApi(request, response, url);
    return;
  }

  await serveStatic(url.pathname, response);
});

server.listen(PORT, () => {
  console.log(`JoyShockMapper socket UI listening on http://127.0.0.1:${PORT}`);
  console.log(`Default JoyShockMapper socket: ${DEFAULT_SOCKET_PATH}`);
});
