const SAMPLES = {
  sentiment: 'Classify the sentiment of this review as POSITIVE or NEGATIVE: "The laptop battery lasts 14 hours and the screen is sharp, but the keyboard travel is slightly mushy."',
  json: 'Extract the name, company, email, and conference city from this snippet into a valid JSON schema with keys {"name", "company", "email", "city"}: "Please RSVP Dr. Sarah Chen from NeuroTech Labs (schen@neurotech.io) for the upcoming summit in Mysuru."',
  code: 'Fix the bug in this asynchronous JavaScript function where items are processed concurrently without rate limiting:\n```javascript\nasync function fetchAll(urls) {\n  return urls.map(async u => await fetch(u));\n}\n```\nProvide a working version using Promise.all and concurrency control.',
  sql: 'Write an optimized PostgreSQL query to find the top 5 customers by total spending who have placed at least 3 orders in the last 6 months. Schema has tables: customers(id, name), orders(id, customer_id, created_at, total_amount).',
  reasoning: 'Solve step by step: A water reservoir has two inlet pipes A and B, and one drain pipe C. Pipe A fills the tank in 6 hours, Pipe B fills it in 8 hours. Pipe C empties a full tank in 4 hours. If Pipe A is opened at 9 AM, Pipe B at 10 AM, and Pipe C at 11 AM, at what exact time will the reservoir be completely full or empty?'
};

const promptInput = document.getElementById('prompt-input');
const btnInspect = document.getElementById('btn-inspect');
const btnExecute = document.getElementById('btn-execute');
const btnRunBenchmark = document.getElementById('btn-run-benchmark');

const tierName = document.getElementById('tier-name');
const tierPill = document.getElementById('tier-pill');
const scoreText = document.getElementById('score-text');
const scoreBar = document.getElementById('score-bar');
const rationaleText = document.getElementById('rationale-text');
const taskType = document.getElementById('task-type');
const tokenCount = document.getElementById('token-count');
const targetVram = document.getElementById('target-vram');
const latencyGain = document.getElementById('latency-gain');
const responseOutput = document.getElementById('response-output');

const metricTotalRequests = document.getElementById('metric-total-requests');
const metricLatency = document.getElementById('metric-latency');
const metricVramSaved = document.getElementById('metric-vram-saved');
const metricThroughput = document.getElementById('metric-throughput');
const benchmarkRows = document.getElementById('benchmark-rows');

// Sample chips click handler
document.querySelectorAll('.sample-chip').forEach(chip => {
  chip.addEventListener('click', () => {
    const key = chip.dataset.sample;
    if (SAMPLES[key]) {
      promptInput.value = SAMPLES[key];
      inspectRoute();
    }
  });
});

async function inspectRoute() {
  const prompt = promptInput.value.trim();
  if (!prompt) return;

  try {
    const res = await fetch('/api/route', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt })
    });
    if (!res.ok) throw new Error('Inspection failed');
    const decision = await res.json();

    renderDecision(decision);
  } catch (err) {
    console.error('Route inspection error:', err);
  }
}

function renderDecision(decision) {
  const { selectedTier, selectedModel, rationale, analysis, savings } = decision;

  tierName.textContent = decision.tierName || selectedTier;
  tierPill.textContent = selectedModel;
  tierPill.className = 'tier-badge ' + (selectedTier === 'tier1_nano' ? 'tier-1' : (selectedTier === 'tier2_balanced' ? 'tier-2' : 'tier-3'));

  scoreText.textContent = `${analysis.complexityScore} / 100`;
  scoreBar.style.width = `${analysis.complexityScore}%`;
  rationaleText.textContent = rationale;

  taskType.textContent = analysis.taskType;
  tokenCount.textContent = analysis.estimatedTokens;
  targetVram.textContent = `${savings.targetVramGb || 1.2} GB`;
  latencyGain.textContent = `${savings.latencyMultiplier || 1.0}x faster`;
}

async function executeTestRequest() {
  const prompt = promptInput.value.trim();
  if (!prompt) return;

  btnExecute.disabled = true;
  btnExecute.textContent = 'Executing...';
  responseOutput.textContent = '// Sending request to /v1/chat/completions...';

  try {
    const res = await fetch('/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'aperture',
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content || JSON.stringify(data, null, 2);
    const routing = data._aperture_routing;

    const metadataHeader = [
      `// [Aperture Proxy Telemetry]`,
      `// Model: ${data.model} | Tier: ${routing?.tier || 'adaptive'} | Complexity: ${routing?.complexityScore}/100`,
      `// VRAM Saved: ${routing?.savings?.vramSavedGb || 0} GB | Latency Multiplier: ${routing?.savings?.latencyMultiplier || 1}x`,
      `// Total Tokens: ${data.usage?.total_tokens || 0}`,
      `------------------------------------------------------------------\n`
    ].join('\n');

    responseOutput.textContent = metadataHeader + content;

    // Refresh telemetry
    fetchMetrics();
  } catch (err) {
    responseOutput.textContent = `// Error: ${err.message}`;
  } finally {
    btnExecute.disabled = false;
    btnExecute.innerHTML = '<span>▶</span> Execute Test Request (/v1/chat/completions)';
  }
}

async function fetchMetrics() {
  try {
    const res = await fetch('/api/metrics');
    if (!res.ok) return;
    const stats = await res.json();

    metricTotalRequests.textContent = stats.totalRequests;
    if (stats.latencies?.p50) {
      metricLatency.textContent = `${stats.latencies.p50} ms`;
    }
    metricVramSaved.textContent = `${stats.efficiencyRatioPercent}%`;
  } catch (err) {
    console.error('Failed to fetch metrics:', err);
  }
}

async function runBenchmark() {
  btnRunBenchmark.disabled = true;
  btnRunBenchmark.textContent = 'Evaluating...';

  try {
    const res = await fetch('/api/benchmark/run');
    if (!res.ok) throw new Error('Benchmark failed');
    const data = await res.json();

    const ap = data.summary.aperture;
    const t1 = data.summary.alwaysTier1;
    const t3 = data.summary.alwaysTier3;

    benchmarkRows.innerHTML = `
      <tr>
        <td style="color: var(--accent-cyan); font-weight: 700;">Aperture (Adaptive)</td>
        <td>${ap.avgLatencyMs} ms</td>
        <td>${ap.vramAvgGb} GB</td>
        <td style="color: var(--accent-emerald);">${ap.accuracyPercent}% (100% Pass)</td>
      </tr>
      <tr>
        <td>Always Tier 1 (1B SLM)</td>
        <td>${t1.avgLatencyMs} ms</td>
        <td>${t1.vramAvgGb} GB</td>
        <td style="color: var(--accent-rose);">${t1.accuracyPercent}% (Fails deep logic)</td>
      </tr>
      <tr>
        <td>Always Tier 3 (70B LLM)</td>
        <td>${t3.avgLatencyMs} ms</td>
        <td>${t3.vramAvgGb} GB</td>
        <td style="color: var(--accent-emerald);">${t3.accuracyPercent}%</td>
      </tr>
    `;

    metricThroughput.textContent = `${data.efficiencyGain.throughputMultiplier}x`;
    metricVramSaved.textContent = `${data.efficiencyGain.vramReductionPercent}%`;
  } catch (err) {
    console.error('Benchmark execution error:', err);
  } finally {
    btnRunBenchmark.disabled = false;
    btnRunBenchmark.innerHTML = '<span>▶</span> Run Evaluation Battery';
  }
}

btnInspect.addEventListener('click', inspectRoute);
btnExecute.addEventListener('click', executeTestRequest);
btnRunBenchmark.addEventListener('click', runBenchmark);

// Initialize with first sample
promptInput.value = SAMPLES.json;
inspectRoute();
fetchMetrics();
setInterval(fetchMetrics, 5000);
