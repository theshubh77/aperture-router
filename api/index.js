import { handleChatCompletions, handleListModels } from '../src/server/proxy.js';
import { defaultEngine } from '../src/router/engine.js';
import { metricsCollector } from '../src/harness/metrics.js';
import { runBenchmarkSuite } from '../src/harness/benchmark.js';

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
  return new Promise((resolve) => {
    if (req.body && typeof req.body === 'object') {
      return resolve(req.body);
    }
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        resolve({});
      }
    });
    req.on('error', () => resolve({}));
  });
}

export default async function handler(req, res) {
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
    if (pathname === '/health' && req.method === 'GET') {
      sendJson(res, 200, {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        environment: 'Vercel Serverless',
        engine: 'Aperture Open-Weight Router'
      });
      return;
    }

    if (pathname === '/v1/chat/completions' && req.method === 'POST') {
      const body = await parseJsonBody(req);
      const result = await handleChatCompletions(body);
      sendJson(res, result.statusCode, result.body, result.headers);
      return;
    }

    if (pathname === '/v1/models' && req.method === 'GET') {
      sendJson(res, 200, handleListModels());
      return;
    }

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

    if (pathname === '/api/metrics' && req.method === 'GET') {
      sendJson(res, 200, metricsCollector.getSnapshot());
      return;
    }

    if (pathname === '/api/benchmark/run') {
      const results = await runBenchmarkSuite();
      sendJson(res, 200, results);
      return;
    }

    sendJson(res, 404, { error: 'Endpoint not found' });
  } catch (err) {
    sendJson(res, 500, { error: err.message });
  }
}
