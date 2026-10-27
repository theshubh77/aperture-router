import test from 'node:test';
import assert from 'node:assert/strict';
import { validateResponse, FallbackManager } from '../src/router/fallback.js';

test('Fallback: rejects empty or blank responses', () => {
  const analysis = { detectedFeatures: [] };
  const res1 = validateResponse('', analysis);
  const res2 = validateResponse('  ', analysis);

  assert.strictEqual(res1.valid, false);
  assert.strictEqual(res2.valid, false);
});

test('Fallback: enforces JSON parsing when structured schema is requested', () => {
  const analysis = { detectedFeatures: ['STRUCTURED_SCHEMA'] };
  
  const invalidJson = validateResponse('Here is your data: name: John, age: 30', analysis);
  assert.strictEqual(invalidJson.valid, false);

  const validJson = validateResponse('```json\n{"name": "John", "age": 30}\n```', analysis);
  assert.strictEqual(validJson.valid, true);
});

test('FallbackManager: escalates tier sequentially on failure', () => {
  const manager = new FallbackManager({
    tiers: {
      tier1_nano: { id: 'tier1_nano', default_model: 'llama3.2:1b' },
      tier2_balanced: { id: 'tier2_balanced', default_model: 'qwen2.5-coder:7b' },
      tier3_heavy: { id: 'tier3_heavy', default_model: 'llama3.3:70b' }
    }
  });

  const nextFromT1 = manager.getNextTier('tier1_nano');
  assert.strictEqual(nextFromT1.id, 'tier2_balanced');

  const nextFromT2 = manager.getNextTier('tier2_balanced');
  assert.strictEqual(nextFromT2.id, 'tier3_heavy');

  const nextFromT3 = manager.getNextTier('tier3_heavy');
  assert.strictEqual(nextFromT3, null);
});
