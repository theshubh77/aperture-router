/**
 * Sub-millisecond prompt complexity analyzer and intent classifier
 */

const CODE_KEYWORDS = /\b(function|const|let|var|def|class|import|from|export|return|async|await|struct|impl|fn|pub|interface|type|extends|implements|select|from|where|insert|delete|update|join|group by|order by|curl|dockerfile|git diff)\b/gi;
const CODE_PUNCTUATION = /[{}[\];:=><#$@`|&~]/g;
const CODE_BLOCKS = /```[\s\S]*?```/g;

const REASONING_KEYWORDS = /\b(step-by-step|step by step|prove|proof|derive|derivation|calculate|compute|solve|equation|theorem|deduce|logic puzzle|why does|explain the mechanism|trade-offs|architectural decision|formal verification|counterexample)\b/gi;
const MATH_SYMBOLS = /[\^√∑∫π≤≥≠≈±÷×]/g;

const STRUCTURED_KEYWORDS = /\b(json|yaml|xml|csv|schema|regex|regular expression|key-value|tabular format|extract the following fields)\b/gi;

const SIMPLE_KEYWORDS = /\b(sentiment|classify|summarize in one sentence|fix typo|fix spelling|yes or no|true or false|translate this phrase|define the word|synonym for)\b/gi;

/**
 * Analyzes a raw prompt or chat message array and computes complexity heuristics
 * Execution time is strictly < 0.5ms on modern V8 runtimes.
 */
export function analyzePrompt(input) {
  const startTime = performance.now();

  let text = '';
  if (typeof input === 'string') {
    text = input;
  } else if (Array.isArray(input)) {
    text = input.map(msg => `${msg.role || ''}: ${msg.content || ''}`).join('\n');
  } else if (input && typeof input.content === 'string') {
    text = input.content;
  }

  const charLength = text.length;
  const estimatedTokens = Math.max(1, Math.ceil(charLength / 4));

  const codeBlocksCount = (text.match(CODE_BLOCKS) || []).length;
  const codeKeywordMatches = (text.match(CODE_KEYWORDS) || []).length;
  const codePunctuationMatches = (text.match(CODE_PUNCTUATION) || []).length;
  const punctuationDensity = charLength > 0 ? codePunctuationMatches / charLength : 0;

  const isCodeIntensive = codeBlocksCount > 0 || codeKeywordMatches >= 3 || punctuationDensity > 0.08;

  const reasoningMatches = (text.match(REASONING_KEYWORDS) || []).length;
  const mathSymbolMatches = (text.match(MATH_SYMBOLS) || []).length;
  const hasReasoningMarkers = reasoningMatches > 0 || mathSymbolMatches >= 2;

  const structuredMatches = (text.match(STRUCTURED_KEYWORDS) || []).length;
  const isStructuredRequired = structuredMatches > 0;

  const simpleMatches = (text.match(SIMPLE_KEYWORDS) || []).length;
  const isSimpleTask = simpleMatches > 0 && charLength < 350 && !isCodeIntensive && !hasReasoningMarkers;

  // Complexity score calculation (scale 1 - 100)
  let score = 10;

  // Length weight (max 25 points)
  score += Math.min(25, Math.floor(estimatedTokens / 20));

  // Code weight (max 35 points)
  if (isCodeIntensive) {
    score += Math.min(35, 20 + (codeBlocksCount * 10) + (codeKeywordMatches * 2));
  }

  // Reasoning weight (max 45 points)
  if (hasReasoningMarkers) {
    score += Math.min(45, 20 + (reasoningMatches * 8) + (mathSymbolMatches * 4));
  }

  // Structured format weight
  if (isStructuredRequired) {
    score += 8;
  }

  // Simple task discount
  if (isSimpleTask) {
    score = Math.max(5, score - 20);
  }

  // Clamp final score
  const finalScore = Math.min(100, Math.max(1, Math.round(score)));

  // Determine Task Type
  let taskType = 'GENERAL';
  if (isSimpleTask) {
    taskType = 'CLASSIFICATION';
  } else if (isCodeIntensive) {
    taskType = 'CODE';
  } else if (hasReasoningMarkers) {
    taskType = 'REASONING';
  } else if (isStructuredRequired) {
    taskType = 'EXTRACTION';
  } else if (estimatedTokens < 60) {
    taskType = 'CONVERSATION';
  }

  const detectedFeatures = [];
  if (isCodeIntensive) detectedFeatures.push('CODE_SYNTAX');
  if (codeBlocksCount > 0) detectedFeatures.push('MARKDOWN_CODE_BLOCK');
  if (hasReasoningMarkers) detectedFeatures.push('MULTI_STEP_REASONING');
  if (isStructuredRequired) detectedFeatures.push('STRUCTURED_SCHEMA');
  if (isSimpleTask) detectedFeatures.push('LIGHTWEIGHT_TASK');

  const durationMs = Math.round((performance.now() - startTime) * 1000) / 1000;

  return {
    complexityScore: finalScore,
    taskType,
    estimatedTokens,
    detectedFeatures,
    analysisLatencyMs: durationMs,
    signals: {
      codeKeywords: codeKeywordMatches,
      reasoningKeywords: reasoningMatches,
      structuredKeywords: structuredMatches,
      punctuationDensity: Math.round(punctuationDensity * 1000) / 1000
    }
  };
}
