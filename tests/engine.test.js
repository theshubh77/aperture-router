import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultEngine } from '../src/router/engine.js';

test('Engine: routes lightweight task to Tier 1 Nano SLM', () => {
  const prompt = 'Sentiment: The app works fine.';
  const decision = defaultEngine.route(prompt);

  assert.strictEqual(decision.selectedTier, 'tier1_nano');
  assert.strictEqual(decision.isAdaptive, true);
  assert.ok(decision.savings.vramSavedGb > 15, 'Should save substantial VRAM vs 70B');
  assert.ok(decision.savings.latencyMultiplier > 2, 'Should offer multi-fold latency reduction');
});

test('Engine: routes coding task to Tier 2 Balanced Coder', () => {
  const prompt = 'Fix this python function:\ndef add(a, b):\n  return a - b\n';
  const decision = defaultEngine.route(prompt);

  assert.strictEqual(decision.selectedTier, 'tier2_balanced');
  assert.strictEqual(decision.selectedModel, 'qwen2.5-coder:7b');
});

test('Engine: respects explicit model override when requested', () => {
  const prompt = 'Hello world';
  const decision = defaultEngine.route(prompt, { model: 'llama3.3:70b' });

  assert.strictEqual(decision.selectedTier, 'explicit');
  assert.strictEqual(decision.selectedModel, 'llama3.3:70b');
  assert.strictEqual(decision.isAdaptive, false);
});
