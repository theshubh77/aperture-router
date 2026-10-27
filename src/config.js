import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

let rawConfig = {};
try {
  const configPath = path.join(ROOT_DIR, 'router.config.json');
  if (fs.existsSync(configPath)) {
    rawConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  }
} catch (err) {
  console.warn('Failed to parse router.config.json, using defaults', err.message);
}

export const config = {
  server: {
    port: parseInt(process.env.PORT || rawConfig.server?.port || 8080, 10),
    host: process.env.HOST || rawConfig.server?.host || '0.0.0.0'
  },
  router: {
    defaultStrategy: process.env.ROUTER_STRATEGY || rawConfig.router?.default_strategy || 'adaptive',
    fallbackEnabled: process.env.ROUTER_FALLBACK !== 'false' && (rawConfig.router?.fallback_enabled ?? true),
    maxEscalations: parseInt(process.env.MAX_ESCALATIONS || rawConfig.router?.max_escalations || 2, 10),
    backend: process.env.ROUTER_BACKEND || rawConfig.router?.backend || 'mock_adaptive',
    endpoints: {
      ollama: process.env.OLLAMA_URL || rawConfig.router?.endpoints?.ollama || 'http://127.0.0.1:11434',
      vllm: process.env.VLLM_URL || rawConfig.router?.endpoints?.vllm || 'http://127.0.0.1:8000/v1'
    },
    tiers: rawConfig.router?.tiers || {}
  },
  harness: {
    defaultIterations: parseInt(process.env.HARNESS_ITERATIONS || rawConfig.harness?.default_iterations || 10, 10),
    concurrencyLimit: parseInt(process.env.HARNESS_CONCURRENCY || rawConfig.harness?.concurrency_limit || 4, 10),
    telemetryWindowSize: parseInt(rawConfig.harness?.telemetry_window_size || 1000, 10)
  },
  paths: {
    root: ROOT_DIR,
    public: path.join(ROOT_DIR, 'public')
  }
};
