/**
 * Standardized open-weight benchmark workloads across task tiers
 */
export const BENCHMARK_WORKLOADS = [
  {
    id: 'wl_sentiment',
    name: 'Short Sentiment Classification',
    category: 'CLASSIFICATION',
    expectedTier: 'tier1_nano',
    prompt: 'Classify the sentiment of this review as POSITIVE, NEGATIVE, or NEUTRAL: "The laptop battery lasts 14 hours and the screen is sharp, but the keyboard travel is slightly mushy."'
  },
  {
    id: 'wl_json_extract',
    name: 'Structured JSON Entity Extraction',
    category: 'EXTRACTION',
    expectedTier: 'tier1_nano',
    prompt: 'Extract the name, company, email, and conference city from this snippet into a valid JSON schema with keys {"name", "company", "email", "city"}: "Please RSVP Dr. Sarah Chen from NeuroTech Labs (schen@neurotech.io) for the upcoming summit in Mysuru."'
  },
  {
    id: 'wl_code_debug',
    name: 'JavaScript Async Bugfix',
    category: 'CODE',
    expectedTier: 'tier2_balanced',
    prompt: 'Fix the bug in this asynchronous JavaScript function where items are processed concurrently without rate limiting:\n```javascript\nasync function fetchAll(urls) {\n  return urls.map(async u => await fetch(u));\n}\n```\nProvide a working version using Promise.all and concurrency control.'
  },
  {
    id: 'wl_sql_query',
    name: 'Relational SQL Query Synthesis',
    category: 'CODE',
    expectedTier: 'tier2_balanced',
    prompt: 'Write an optimized PostgreSQL query to find the top 5 customers by total spending who have placed at least 3 orders in the last 6 months. Schema has tables: customers(id, name), orders(id, customer_id, created_at, total_amount).'
  },
  {
    id: 'wl_multi_step_math',
    name: 'Multi-Step Mathematical Logic',
    category: 'REASONING',
    expectedTier: 'tier3_heavy',
    prompt: 'Solve step by step: A water reservoir has two inlet pipes A and B, and one drain pipe C. Pipe A fills the tank in 6 hours, Pipe B fills it in 8 hours. Pipe C empties a full tank in 4 hours. If Pipe A is opened at 9 AM, Pipe B at 10 AM, and Pipe C at 11 AM, at what exact time will the reservoir be completely full or empty?'
  },
  {
    id: 'wl_arch_tradeoff',
    name: 'Distributed Systems Architecture Analysis',
    category: 'REASONING',
    expectedTier: 'tier3_heavy',
    prompt: 'Evaluate the trade-offs step-by-step between Raft and Paxos for a multi-region distributed vector database requiring strong consistency on partition and sub-50ms read latency. Detail leader election failure modes and network split recovery.'
  }
];
