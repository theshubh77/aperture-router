import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { handleChatCompletions, handleListModels } from './proxy.js';
import { defaultEngine } from '../router/engine.js';
import { metricsCollector } from '../harness/metrics.js';
import { runBenchmarkSuite } from '../harness/benchmark.js';
import { logger } from '../utils/logger.js';
import { config } from '../config.js';

const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png'
};

function sendJson(res, statusCode, data, extraHeaders = {}) {
  const json = JSON.stringify(data);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key',
    ...extraHeaders
  });
  res.end(json);
}

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 10 * 1024 * 1024) { // 10MB limit
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(new Error('Invalid JSON payload'));
      }
    });
    req.on('error', reject);
  });
}

function serveStatic(req, res, pathname) {
  let relativePath = pathname === '/' ? '/index.html' : pathname;
  // Prevent directory traversal
  const safePath = path.normalize(relativePath).replace(/^(\.\.[/\\])+/, '');
  const filePath = path.join(config.paths.public, safePath);

  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('404 Not Found');
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  const mime = MIME_TYPES[ext] || 'application/octet-stream';
  const content = fs.readFileSync(filePath);

  res.writeHead(200, {
    'Content-Type': mime,
    'Cache-Control': 'no-cache',
    'Access-Control-Allow-Origin': '*'
  });
  res.end(content);
}

export function createServer() {
  return http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const pathname = url.pathname;

    // Handle CORS Preflight
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key'
      });
      res.end();
      return;
    }

    try {
      // Healthcheck probe for DigitalOcean / Docker
      if (pathname === '/health' && req.method === 'GET') {
        sendJson(res, 200, {
          status: 'healthy',
          timestamp: new Date().toISOString(),
          version: '1.0.0',
          engine: 'Aperture Open-Weight Router'
        });
        return;
      }

      if (pathname === '/v1' || pathname === '/v1/') {
        sendJson(res, 200, {
          status: 'active',
          service: 'Aperture OpenAI-Compatible Proxy',
          routes: ['/v1/chat/completions (POST)', '/v1/models (GET)'],
          docs: 'https://github.com/theshubh77/aperture-router#drop-in-openai-compatibility'
        });
        return;
      }

      if (pathname === '/v1/chat/completions' && req.method === 'GET') {
        sendJson(res, 200, {
          endpoint: '/v1/chat/completions',
          status: 'active',
          message: 'Aperture OpenAI-compatible chat completions proxy. Send a POST request to execute inference.',
          usage_example: {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: {
              model: 'aperture',
              messages: [{ role: 'user', content: 'Hello Aperture!' }]
            }
          },
          curl_example: "curl -X POST https://aperture-router.vercel.app/v1/chat/completions -H 'Content-Type: application/json' -d '{\"model\":\"aperture\",\"messages\":[{\"role\":\"user\",\"content\":\"Hello\"}]}'",
          dashboard: 'https://aperture-router.vercel.app'
        });
        return;
      }

      // OpenAI-compatible Chat Completions
      if (pathname === '/v1/chat/completions' && req.method === 'POST') {
        const body = await parseJsonBody(req);
        const result = await handleChatCompletions(body);
        sendJson(res, result.statusCode, result.body, result.headers);
        return;
      }

      // OpenAI-compatible Models endpoint
      if (pathname === '/v1/models' && req.method === 'GET') {
        sendJson(res, 200, handleListModels());
        return;
      }

      // Route Inspection API
      if (pathname === '/api/route') {
        let prompt = url.searchParams.get('prompt') || '';
        let model = url.searchParams.get('model') || 'aperture';

        if (req.method === 'POST') {
          const body = await parseJsonBody(req);
          prompt = body.prompt || body.messages || prompt;
          model = body.model || model;
        }

        const decision = defaultEngine.route(prompt, { model });
        sendJson(res, 200, decision);
        return;
      }

      // Live Telemetry Metrics API
      if (pathname === '/api/metrics' && req.method === 'GET') {
        sendJson(res, 200, metricsCollector.getSnapshot());
        return;
      }

      // Benchmark Runner API
      if (pathname === '/api/benchmark/run') {
        const results = await runBenchmarkSuite();
        sendJson(res, 200, results);
        return;
      }

      // Static assets fallback
      if (req.method === 'GET') {
        serveStatic(req, res, pathname);
        return;
      }

      sendJson(res, 404, { error: 'Endpoint not found' });
    } catch (err) {
      logger.error(`Error processing ${req.method} ${pathname}: ${err.message}`, err);
      sendJson(res, 500, { error: err.message });
    }
  });
}
