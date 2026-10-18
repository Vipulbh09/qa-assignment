import { z } from 'zod';
import { collectEvidence, type CollectOptions } from './evidence.ts';
import { applyGuardrails } from './guardrails.ts';
import { loadKnownDefects, renderDefects } from './knowledge.ts';
import type { LlmClient } from './llm/LlmClient.ts';
import { PROMPT_VERSION, systemPrompt, userPrompt } from './prompt.ts';
import { TriageResultSchema, type EvidencePack, type TriageInput, type TriageResult } from './types.ts';

export interface TriageOutcome {
  result: TriageResult;
  guardrailNotes: string[];
  pack: EvidencePack;
  promptVersion: string;
  durationMs: number;
  costUsd?: number;
}

export async function triage(input: TriageInput, llm: LlmClient, repoRoot: string, opts: CollectOptions = {}): Promise<TriageOutcome> {
  const pack = collectEvidence(input, opts);
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
      return { result: g.result, guardrailNotes: g.notes, pack, promptVersion: PROMPT_VERSION, durationMs: res.durationMs, costUsd: res.costUsd };
    }
    last = parsed.error.message;
  }
  throw new Error(`Model reply failed schema validation twice: ${last}`);
}
