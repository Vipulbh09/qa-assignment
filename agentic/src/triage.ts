import { z } from 'zod';
import { collectEvidence, type CollectOptions } from './evidence.ts';
import { RULES_VERSION, ruleVerdict } from './baseline.ts';
import { applyGuardrails } from './guardrails.ts';
import { loadKnownDefects, renderDefects } from './knowledge.ts';
import type { LlmClient } from './llm/LlmClient.ts';
import { PROMPT_VERSION, systemPrompt, userPrompt } from './prompt.ts';
import { TriageResultSchema, type EvidencePack, type TriageInput, type TriageResult } from './types.ts';

export interface TriageOutcome {
  decidedBy: 'rule' | 'model';
  ruleId?: string;
  result: TriageResult;
  guardrailNotes: string[];
  pack: EvidencePack;
  promptVersion: string;
  durationMs: number;
  costUsd?: number;
}

export interface TriageOptions extends CollectOptions {
  rules?: boolean; // default true; false forces every failure to the model
}

/** The rules-only baseline. Null when no rule applies and the model should decide. */
export function triageByRule(pack: EvidencePack, repoRoot: string): TriageOutcome | null {
  const verdict = ruleVerdict(pack);
  if (!verdict) return null;
  const g = applyGuardrails(verdict.result, pack, renderDefects(loadKnownDefects(repoRoot)));
  return { decidedBy: 'rule', ruleId: verdict.ruleId, result: g.result, guardrailNotes: g.notes, pack, promptVersion: `rules ${RULES_VERSION}`, durationMs: 0, costUsd: 0 };
}

export async function triage(input: TriageInput, llm: LlmClient, repoRoot: string, opts: TriageOptions = {}): Promise<TriageOutcome> {
  const pack = collectEvidence(input, opts);
  if (opts.rules !== false) {
    const byRule = triageByRule(pack, repoRoot);
    if (byRule) return byRule;
  }
  const defects = loadKnownDefects(repoRoot);
  const req = {
    system: systemPrompt(),
    prompt: userPrompt(pack, defects),
    jsonSchema: z.toJSONSchema(TriageResultSchema),
  };

  // One retry if the reply does not satisfy our schema.
  let last: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await llm.complete(req);
    const parsed = TriageResultSchema.safeParse(res.output);
    if (parsed.success) {
      const g = applyGuardrails(parsed.data, pack, renderDefects(defects));
      return { decidedBy: 'model', result: g.result, guardrailNotes: g.notes, pack, promptVersion: PROMPT_VERSION, durationMs: res.durationMs, costUsd: res.costUsd };
    }
    last = parsed.error.message;
  }
  throw new Error(`Model reply failed schema validation twice: ${last}`);
}
