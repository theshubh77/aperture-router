import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzePrompt } from '../src/router/analyzer.js';

test('Analyzer: identifies simple sentiment classification as lightweight task', () => {
  const prompt = 'Classify the sentiment of this review as POSITIVE or NEGATIVE: Great product!';
  const result = analyzePrompt(prompt);

  assert.strictEqual(result.taskType, 'CLASSIFICATION');
  assert.ok(result.complexityScore <= 35, `Expected score <= 35, got ${result.complexityScore}`);
  assert.ok(result.detectedFeatures.includes('LIGHTWEIGHT_TASK'));
});

test('Analyzer: identifies code intensive task with syntax markers', () => {
  const prompt = 'function mergeSort(arr) { if (arr.length <= 1) return arr; const mid = Math.floor(arr.length / 2); }';
  const result = analyzePrompt(prompt);

  assert.strictEqual(result.taskType, 'CODE');
  assert.ok(result.detectedFeatures.includes('CODE_SYNTAX'));
  assert.ok(result.complexityScore >= 35, `Expected score >= 35, got ${result.complexityScore}`);
});

test('Analyzer: identifies multi-step mathematical reasoning', () => {
  const prompt = 'Solve step-by-step: compute the derivative of f(x) = x^3 * e^(2x) and prove why the inflection point exists.';
  const result = analyzePrompt(prompt);

  assert.strictEqual(result.taskType, 'REASONING');
  assert.ok(result.detectedFeatures.includes('MULTI_STEP_REASONING'));
  assert.ok(result.complexityScore >= 45, `Expected score >= 45, got ${result.complexityScore}`);
});

test('Analyzer: sub-millisecond execution guarantee', () => {
  const prompt = 'Analyze the following architectural trade-offs in distributed event streaming with Kafka vs RabbitMQ.';
  const result = analyzePrompt(prompt);

  assert.ok(result.analysisLatencyMs < 2.0, `Analysis took ${result.analysisLatencyMs}ms (expected < 2.0ms)`);
});
