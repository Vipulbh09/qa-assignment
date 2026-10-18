import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { renderDefects, type KnownDefect } from './knowledge.ts';
import type { EvidencePack } from './types.ts';

export const PROMPT_VERSION = 'v2';

const MAX_LOG = 6000;
const MAX_DIFF = 6000;

export function systemPrompt(): string {
  return readFileSync(fileURLToPath(new URL('../prompts/triage.system.md', import.meta.url)), 'utf8');
}

/** Keeps the head and the tail: stack traces and assertion messages are usually at the ends. */
export function clip(text: string, max: number): string {
  if (text.length <= max) return text;
  const half = Math.floor(max / 2);
  return `${text.slice(0, half)}\n[... ${text.length - max} characters omitted ...]\n${text.slice(-half)}`;
}

export function userPrompt(pack: EvidencePack, defects: KnownDefect[]): string {
  const { input, context, signals } = pack;
  return [
    '## Known defects (bugs/README.md)',
    renderDefects(defects),
    '',
    '## Failing test',
    input.testName,
    '',
    '## Run context (from CI artifacts)',
    JSON.stringify(context, null, 2),
    '',
    '## Pre-computed signals (hints from rules, not verdicts)',
    signals.length ? signals.map(s => `- [${s.id}] ${s.hint}\n  evidence: ${s.quote}`).join('\n') : '(none)',
    '',
    '## Failure log',
    '```',
    clip(input.log, MAX_LOG),
    '```',
    '',
    '## Git diff',
    '```diff',
    input.gitDiff.trim() ? clip(input.gitDiff, MAX_DIFF) : '(empty)',
    '```',
  ].join('\n');
}
