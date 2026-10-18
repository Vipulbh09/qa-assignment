import type { EvidencePack, TriageResult } from './types.ts';

const S1_AREA = /currenc|payment|checkout|price|cost|charge|order/i;

export interface Guarded {
  result: TriageResult;
  notes: string[];
}

/** Every quote must come from the input we sent. */
function haystack(pack: EvidencePack, defectText: string): string {
  return [pack.input.testName, pack.input.log, pack.input.gitDiff, JSON.stringify(pack.context), ...pack.signals.map(s => s.quote), defectText].join('\n');
}

const norm = (s: string) => s.replace(/\s+/g, ' ').trim();

/**
 * Deterministic checks applied after the model answers. They only ever make the result
 * more cautious (downgrade confidence, escalate to a human); they never change the class.
 */
export function applyGuardrails(raw: TriageResult, pack: EvidencePack, defectText = ''): Guarded {
  const result: TriageResult = structuredClone(raw);
  const notes: string[] = [];
  const hay = norm(haystack(pack, defectText));

  const bad = result.evidence.filter(e => !hay.includes(norm(e.quote)));
  if (bad.length) {
    notes.push(`${bad.length} evidence quote(s) are not in the input and were removed`);
    result.evidence = result.evidence.filter(e => !bad.includes(e));
    if (result.evidence.length === 0) {
      result.confidence = 'low';
      result.needs_human = true;
      notes.push('no verifiable evidence left: confidence set to low');
    }
  }

  const sources = new Set(result.evidence.map(e => e.source));
  if (result.confidence === 'high' && (result.evidence.length < 2 || sources.size < 2)) {
    result.confidence = 'medium';
    notes.push('high confidence needs two evidence items from different sources: downgraded to medium');
  }

  if (result.confidence === 'low' && !result.needs_human) {
    result.needs_human = true;
    notes.push('low confidence: escalated to a human');
  }

  if (!result.needs_human && S1_AREA.test(`${pack.input.testName} ${pack.input.log}`) && result.classification === 'flaky_test') {
    result.needs_human = true;
    notes.push('money/checkout area classified as flaky: escalated to a human');
  }

  return { result, notes };
}
