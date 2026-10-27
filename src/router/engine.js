import { analyzePrompt } from './analyzer.js';
import { config } from '../config.js';

/**
 * Aperture Routing Engine
 * Maps query complexity to the optimal open-weight model tier.
 */
export class RoutingEngine {
  constructor(customConfig = null) {
    this.config = customConfig || config.router;
    this.tiers = this.config.tiers || {};
  }

  /**
   * Evaluates prompt and selects the best model tier
   * @param {string|Array} input Prompt string or messages array
   * @param {Object} options Optional explicit model overrides or hints
   * @returns {Object} Full routing decision
   */
  route(input, options = {}) {
    const analysis = analyzePrompt(input);
    const { complexityScore, taskType } = analysis;

    // Check if user requested an explicit model that is NOT auto/aperture
    if (options.model && options.model !== 'auto' && options.model !== 'aperture' && options.model !== 'adaptive') {
      return {
        selectedTier: 'explicit',
        selectedModel: options.model,
        reason: 'User explicitly specified model',
        isAdaptive: false,
        analysis,
        metrics: {
          vramEstimateGb: 8.0,
          latencySavingRatio: 0
        }
      };
    }

    const tier1 = this.tiers.tier1_nano || {
      id: 'tier1_nano',
      name: 'Tier 1: Nano / SLM',
      default_model: 'llama3.2:1b',
      vram_gb: 1.2,
      max_complexity_score: 35
    };

    const tier2 = this.tiers.tier2_balanced || {
      id: 'tier2_balanced',
      name: 'Tier 2: Balanced / Coder',
      default_model: 'qwen2.5-coder:7b',
      vram_gb: 5.5,
      max_complexity_score: 75
    };

    const tier3 = this.tiers.tier3_heavy || {
      id: 'tier3_heavy',
      name: 'Tier 3: Reasoning / Heavy',
      default_model: 'llama3.3:70b',
      vram_gb: 24.0,
      max_complexity_score: 100
    };

    let selectedTier = tier3;
    let rationale = '';

    // Specialized task routing rules
    if (taskType === 'CODE') {
      // Code tasks route to Tier 2 (Coder) unless ultra-complex logic
      if (complexityScore > 80) {
        selectedTier = tier3;
        rationale = 'High-complexity architectural reasoning detected in code task. Dispatched to Tier 3 Frontier model.';
      } else {
        selectedTier = tier2;
        rationale = 'Code syntax detected. Dispatched to Tier 2 specialized code model (e.g. Qwen 2.5 Coder / Llama 3.2).';
      }
    } else if (taskType === 'CLASSIFICATION' || taskType === 'EXTRACTION') {
      // Structured JSON / extraction / classification can be effortlessly handled by modern SLMs
      if (complexityScore <= tier1.max_complexity_score) {
        selectedTier = tier1;
        rationale = 'Structured extraction / lightweight classification task. Handled by Tier 1 SLM (<1.5B) for maximum throughput.';
      } else {
        selectedTier = tier2;
        rationale = 'Moderate structured complexity. Assigned to Tier 2 balanced model.';
      }
    } else {
      // General scoring
      if (complexityScore <= tier1.max_complexity_score) {
        selectedTier = tier1;
        rationale = `Low complexity score (${complexityScore}/100). Routed to Tier 1 SLM for sub-50ms response.`;
      } else if (complexityScore <= tier2.max_complexity_score) {
        selectedTier = tier2;
        rationale = `Moderate complexity score (${complexityScore}/100). Routed to Tier 2 balanced model.`;
      } else {
        selectedTier = tier3;
        rationale = `High complexity score (${complexityScore}/100) with deep reasoning. Routed to Tier 3 frontier open-weight model.`;
      }
    }

    // Benchmark comparison metrics vs naive Tier 3 baseline
    const baselineVram = tier3.vram_gb || 24.0;
    const actualVram = selectedTier.vram_gb || 1.2;
    const vramSavedGb = Math.max(0, baselineVram - actualVram);
    const vramSavingPercent = Math.round((vramSavedGb / baselineVram) * 100);

    const baselineLatencyMs = tier3.avg_ttft_ms || 200;
    const actualLatencyMs = selectedTier.avg_ttft_ms || 30;
    const latencySavingRatio = Math.round((baselineLatencyMs / actualLatencyMs) * 10) / 10;

    return {
      selectedTier: selectedTier.id,
      tierName: selectedTier.name,
      selectedModel: selectedTier.default_model,
      rationale,
      isAdaptive: true,
      analysis,
      savings: {
        vramSavedGb,
        vramSavingPercent,
        latencyMultiplier: latencySavingRatio,
        targetVramGb: actualVram
      }
    };
  }
}

export const defaultEngine = new RoutingEngine();
