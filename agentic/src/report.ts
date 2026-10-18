import type { TriageOutcome } from './triage.ts';

export function renderMarkdown(testName: string, o: TriageOutcome): string {
  const r = o.result;
  return [
    `# Triage: ${testName}`,
    '',
    `**${r.classification}** · confidence **${r.confidence}**${r.known_defect ? ` · known defect **${r.known_defect}**` : ''}${r.needs_human ? ' · **needs a human**' : ''}`,
    '',
    r.summary,
    '',
    '## Evidence',
    ...r.evidence.map(e => `- *${e.source}*: \`${e.quote.replace(/\n/g, ' ').slice(0, 200)}\`: ${e.why}`),
    '',
    `## Runner-up: ${r.alternative.classification}`,
    r.alternative.why_not,
    '',
    `## Next action: ${r.next_action.type} (${r.next_action.owner_pod})`,
    r.next_action.detail,
    ...(o.guardrailNotes.length ? ['', '## Guardrails applied', ...o.guardrailNotes.map(n => `- ${n}`)] : []),
    '',
    `<sub>${o.decidedBy === 'rule' ? `decided by rule ${o.ruleId}, no model call` : `prompt ${o.promptVersion} · ${(o.durationMs / 1000).toFixed(1)}s`} · shadow mode: no action was taken</sub>`,
  ].join('\n');
}
