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
  const originalPath = req.headers['x-matched-path'] || req.headers['x-forwarded-url'] || req.url;
  const url = new URL(originalPath, `http://${req.headers.host || 'localhost'}`);
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

    if (pathname === '/api' || pathname === '/api/') {
      sendJson(res, 200, {
        name: 'Aperture Open-Weight Router API',
        status: 'active',
        endpoints: ['/v1/chat/completions', '/v1/models', '/api/route', '/api/metrics', '/api/benchmark/run', '/health']
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
            messages: [{ role: 'user', content: 'Your prompt here' }]
          }
        },
        curl_example: "curl -X POST https://aperture-router.vercel.app/v1/chat/completions -H 'Content-Type: application/json' -d '{\"model\":\"aperture\",\"messages\":[{\"role\":\"user\",\"content\":\"Hello\"}]}'",
        dashboard: 'https://aperture-router.vercel.app'
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

    sendJson(res, 404, {
      error: 'Endpoint not found',
      debug: {
        reqUrl: req.url,
        pathname,
        matchedPath: req.headers['x-matched-path'],
        forwardedUrl: req.headers['x-forwarded-url']
      }
    });
  } catch (err) {
    sendJson(res, 500, { error: err.message });
  }
}
