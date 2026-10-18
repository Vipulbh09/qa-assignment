import { z } from 'zod';

export const CLASSIFICATIONS = ['product_bug', 'flaky_test', 'environment_issue', 'test_gap'] as const;
export const EVIDENCE_SOURCES = ['log', 'diff', 'history', 'signal', 'known_defect'] as const;
export const ACTION_TYPES = ['file_bug', 'quarantine', 'fix_test', 'rerun', 'restart_env', 'escalate_human'] as const;

const Classification = z.enum(CLASSIFICATIONS);

export const TriageResultSchema = z.object({
  classification: Classification,
  confidence: z.enum(['high', 'medium', 'low']),
  summary: z.string().describe('One or two sentences: what failed and why you believe that.'),
  evidence: z
    .array(
      z.object({
        source: z.enum(EVIDENCE_SOURCES),
        quote: z.string().describe('Exact text copied from the input (log, diff or signal). Never paraphrase.'),
        why: z.string().describe('What this quote tells you about the cause.'),
      }),
    )
    .min(1),
  alternative: z.object({
    classification: Classification,
    why_not: z.string().describe('Why the runner-up classification was rejected.'),
  }),
  known_defect: z.string().nullable().describe('DEF-xx id from the defect log if this matches one, else null.'),
  next_action: z.object({
    type: z.enum(ACTION_TYPES),
    detail: z.string(),
    owner_pod: z.enum(['Checkout & Payments', 'Catalogue & Pricing', 'Storefront', 'Quality Platform']),
  }),
  needs_human: z.boolean(),
});

export type TriageResult = z.infer<typeof TriageResultSchema>;
export type Classification = (typeof CLASSIFICATIONS)[number];

/** What the caller provides. Everything else is gathered by the evidence collector. */
export interface TriageInput {
  testName: string;
  log: string;
  gitDiff: string;
}

/** Optional context the collector adds from CI artifacts. */
export interface RunContext {
  file?: string;
  project?: string;
  status?: string; // Playwright: expected | unexpected | flaky | skipped
  retries?: number;
  attempts?: { status: string; error?: string }[];
  annotations?: { type: string; description?: string }[];
  siblingFailures: string[];
  gatewayTimeoutSiblings?: number; // other failed tests in this run whose own error is a 504
  totalFailed?: number;
  totalExecuted?: number;
  unhealthyContainers: string[];
  testCaseId?: string;
}

export interface Signal {
  id: string;
  hint: string;
  quote: string;
}

export interface EvidencePack {
  input: TriageInput;
  context: RunContext;
  signals: Signal[];
}
