/**
 * Telemetry and statistical collector for routing performance & savings
 */
export class MetricsCollector {
  constructor(windowSize = 1000) {
    this.windowSize = windowSize;
    this.totalRequests = 0;
    this.totalTokens = 0;
    this.tierCounts = {
      tier1_nano: 0,
      tier2_balanced: 0,
      tier3_heavy: 0,
      explicit: 0
    };
    this.latenciesMs = [];
    this.cumulativeVramSavedGbHours = 0;
    this.startTime = Date.now();
  }

  /**
   * Records a completed routing or inference event
   */
  record(event) {
    this.totalRequests++;
    const tokens = event.tokens || event.analysis?.estimatedTokens || 15;
    this.totalTokens += tokens;

    const tier = event.selectedTier || 'tier1_nano';
    if (this.tierCounts[tier] !== undefined) {
      this.tierCounts[tier]++;
    } else {
      this.tierCounts[tier] = 1;
    }

    if (event.durationMs) {
      this.latenciesMs.push(event.durationMs);
      if (this.latenciesMs.length > this.windowSize) {
        this.latenciesMs.shift();
      }
    }

    if (event.savings?.vramSavedGb) {
      // Estimate VRAM hour savings based on active inference window
      const inferenceDurationHours = (event.durationMs || 100) / (1000 * 3600);
      this.cumulativeVramSavedGbHours += event.savings.vramSavedGb * inferenceDurationHours;
    }
  }

  /**
   * Calculates percentiles from recorded latencies
   */
  getPercentiles() {
    if (this.latenciesMs.length === 0) {
      return { p50: 0, p90: 0, p95: 0, p99: 0 };
    }
    const sorted = [...this.latenciesMs].sort((a, b) => a - b);
    const getP = (p) => {
      const idx = Math.floor((p / 100) * sorted.length);
      return sorted[Math.min(idx, sorted.length - 1)];
    };
    return {
      p50: Math.round(getP(50) * 10) / 10,
      p90: Math.round(getP(90) * 10) / 10,
      p95: Math.round(getP(95) * 10) / 10,
      p99: Math.round(getP(99) * 10) / 10
    };
  }

  /**
   * Returns snapshot of system telemetry
   */
  getSnapshot() {
    const uptimeSec = Math.floor((Date.now() - this.startTime) / 1000);
    const percentiles = this.getPercentiles();

    const t1 = this.tierCounts.tier1_nano || 0;
    const t2 = this.tierCounts.tier2_balanced || 0;
    const t3 = this.tierCounts.tier3_heavy || 0;
    const routedTotal = t1 + t2 + t3;

    // Relative compute efficiency ratio:
    // Baseline if all routed to 70B = 1.0
    // Weighted footprint based on 1.2GB (T1), 5.5GB (T2), 24GB (T3)
    let weightedVram = (t1 * 1.2) + (t2 * 5.5) + (t3 * 24.0);
    let baselineVram = routedTotal * 24.0;
    const efficiencyRatio = baselineVram > 0 ? Math.round((1 - (weightedVram / baselineVram)) * 100) : 0;

    return {
      totalRequests: this.totalRequests,
      totalTokens: this.totalTokens,
      uptimeSeconds: uptimeSec,
      tierDistribution: {
        tier1_nano: t1,
        tier2_balanced: t2,
        tier3_heavy: t3,
        explicit: this.tierCounts.explicit || 0
      },
      efficiencyRatioPercent: efficiencyRatio,
      latencies: percentiles,
      recentSamplesCount: this.latenciesMs.length,
      vramSavedGbHours: Math.round(this.cumulativeVramSavedGbHours * 1000) / 1000
    };
  }

  reset() {
    this.totalRequests = 0;
    this.totalTokens = 0;
    this.tierCounts = { tier1_nano: 0, tier2_balanced: 0, tier3_heavy: 0, explicit: 0 };
    this.latenciesMs = [];
    this.cumulativeVramSavedGbHours = 0;
  }
}

export const metricsCollector = new MetricsCollector();
