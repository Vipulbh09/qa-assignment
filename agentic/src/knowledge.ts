import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export interface KnownDefect {
  id: string;
  severity: string;
  summary: string;
}

/** Reads the defect table in bugs/README.md so the agent's knowledge cannot drift from the defect log. */
export function loadKnownDefects(repoRoot: string): KnownDefect[] {
  const md = readFileSync(join(repoRoot, 'bugs/README.md'), 'utf8');
  const rows = md.matchAll(/^\| \[(DEF-\d+)\]\([^)]*\) \| \**(S\d)\** \| ([^|]+) \|/gm);
  return [...rows].map(m => ({ id: m[1], severity: m[2], summary: m[3].trim() }));
}

export function renderDefects(defects: KnownDefect[]): string {
  return defects.map(d => `- ${d.id} (${d.severity}): ${d.summary}`).join('\n');
}
