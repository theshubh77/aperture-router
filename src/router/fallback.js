import { logger } from '../utils/logger.js';
import { config } from '../config.js';

/**
 * Validates whether a model response meets quality criteria based on the prompt's intent.
 */
export function validateResponse(responseContent, analysis) {
  if (!responseContent || typeof responseContent !== 'string') {
    return { valid: false, reason: 'Empty response payload' };
  }

  const trimmed = responseContent.trim();
  if (trimmed.length < 2) {
    return { valid: false, reason: 'Response too short or blank' };
  }

  // If structured JSON was explicitly requested, test parseability
  if (analysis.detectedFeatures.includes('STRUCTURED_SCHEMA')) {
    const jsonMatch = trimmed.match(/```json\s*([\s\S]*?)\s*```/) || trimmed.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
    if (!jsonMatch) {
      return { valid: false, reason: 'Structured JSON requested but no JSON block found' };
    }
    try {
      JSON.parse(jsonMatch[1] || jsonMatch[0]);
    } catch {
      return { valid: false, reason: 'JSON block failed validation' };
    }
  }

  return { valid: true };
}

/**
 * Manages fallback execution and tier escalation
 */
export class FallbackManager {
  constructor(engineConfig = null) {
    this.tiers = engineConfig?.tiers || config.router.tiers || {};
    this.tierOrder = ['tier1_nano', 'tier2_balanced', 'tier3_heavy'];
  }

  getNextTier(currentTierId) {
    const index = this.tierOrder.indexOf(currentTierId);
    if (index >= 0 && index < this.tierOrder.length - 1) {
      const nextTierId = this.tierOrder[index + 1];
      return this.tiers[nextTierId] || null;
    }
    return null;
  }

  /**
   * Executes a prompt with adaptive escalation if smaller tiers fail quality validation.
   */
  async executeWithFallback(executeFn, initialDecision, promptInput) {
    let currentTierId = initialDecision.selectedTier;
    let currentModel = initialDecision.selectedModel;
    let attempts = 0;
    const maxAttempts = config.router.maxEscalations + 1;
    const escalations = [];

    while (attempts < maxAttempts) {
      attempts++;
      try {
        const result = await executeFn(currentModel, currentTierId);
        const validation = validateResponse(result.content, initialDecision.analysis);

        if (validation.valid || !config.router.fallbackEnabled) {
          return {
            ...result,
            attempts,
            escalations,
            finalTier: currentTierId,
            finalModel: currentModel
          };
        }

        logger.warn(`Model ${currentModel} on tier ${currentTierId} failed validation: ${validation.reason}. Escalating.`);
        escalations.push({
          fromTier: currentTierId,
          fromModel: currentModel,
          reason: validation.reason
        });

        const nextTier = this.getNextTier(currentTierId);
        if (!nextTier) {
          logger.warn('Maximum tier reached, returning last result');
          return {
            ...result,
            attempts,
            escalations,
            finalTier: currentTierId,
            finalModel: currentModel,
            warning: 'Returned unvalidated output after exhausting tiers'
          };
        }

        currentTierId = nextTier.id;
        currentModel = nextTier.default_model;
      } catch (err) {
        logger.error(`Execution error on tier ${currentTierId}: ${err.message}`);
        const nextTier = this.getNextTier(currentTierId);
        if (!nextTier) throw err;
        currentTierId = nextTier.id;
        currentModel = nextTier.default_model;
      }
    }

    throw new Error('All model tiers exhausted without a valid response');
  }
}

export const fallbackManager = new FallbackManager();
