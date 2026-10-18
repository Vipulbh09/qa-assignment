import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { collectEvidence, flattenResults } from './evidence.ts';
import { ClaudeCodeCli } from './llm/ClaudeCodeCli.ts';
import { triage, type TriageOutcome } from './triage.ts';
import type { Signal } from './types.ts';

// eslint-disable-next-line no-control-regex
const stripAnsi = (s: string) => s.replace(/\x1b\[[0-9;]*m/g, '');
const repoRoot = fileURLToPath(new URL('../../', import.meta.url));

const { values } = parseArgs({
  options: {
    results: { type: 'string' },
    'docker-ps': { type: 'string' },
    diff: { type: 'string' },
    out: { type: 'string', default: 'triage-results.json' },
    model: { type: 'string', default: 'sonnet' },
    max: { type: 'string', default: '6' },
    'signals-only': { type: 'boolean', default: false },
  },
});
if (!values.results) {
  console.error('usage: node src/ci-triage.ts --results results.json [--docker-ps f] [--diff f] [--out f] [--max 6] [--signals-only]');
  process.exit(2);
}

export interface TriageEntry {
  testName: string;
  status: string;
  project?: string;
  signals: Signal[];
  outcome?: Pick<TriageOutcome, 'result' | 'guardrailNotes' | 'durationMs' | 'promptVersion'>;
  error?: string;
}

const resultsPath = resolve(values.results);
const dockerPs = values['docker-ps'] && existsSync(values['docker-ps']) ? resolve(values['docker-ps']) : undefined;
const gitDiff = values.diff && existsSync(values.diff) ? readFileSync(values.diff, 'utf8') : '';

const all = flattenResults(JSON.parse(readFileSync(resultsPath, 'utf8')));
// Red builds first, then tests that only passed on retry. Tests marked knownDefect() fail by design (the bug is documented
// in bugs/), so a failing one is not triaged again: the CI gate (automation/scripts/gate.mjs) already accepts it. A marked
// test that PASSES is the opposite case: the gate turns the build red because the bug looks fixed, so the agent explains it.
const isKnownDefect = (t: { annotations?: { type: string }[] }) => !!t.annotations?.some(a => a.type === 'defect');
const failing = [
  ...all.filter(t => t.status === 'unexpected' && !isKnownDefect(t)),
  ...all.filter(t => t.status === 'expected' && isKnownDefect(t)),
  ...all.filter(t => t.status === 'flaky'),
];
const max = Number(values.max);
const picked = failing.slice(0, max);

const llm = new ClaudeCodeCli({ model: values.model });
const entries: TriageEntry[] = [];

for (const t of picked) {
  const testName = `${t.file ?? ''} > ${t.title}`;
  const log = t.results
    .map((r, i) => `Attempt ${i + 1} (${r.status}):\n${stripAnsi(r.error?.message ?? '(no error message)')}`)
    .join('\n\n');
  const input = { testName, log, gitDiff };
  const opts = { resultsPath, dockerPsPath: dockerPs };
  const entry: TriageEntry = { testName, status: t.status, project: t.project, signals: collectEvidence(input, opts).signals };

  if (!values['signals-only']) {
    process.stdout.write(`triaging ${t.title} ... `);
    try {
      const o = await triage(input, llm, repoRoot, opts);
      entry.outcome = { result: o.result, guardrailNotes: o.guardrailNotes, durationMs: o.durationMs, promptVersion: o.promptVersion };
      console.log(`${o.result.classification} (${o.result.confidence})`);
    } catch (e) {
      // Shadow mode: a model failure must never fail the build.
      entry.error = String((e as Error).message).slice(0, 400);
      console.log(`failed: ${entry.error}`);
    }
  }
  entries.push(entry);
}

const out = {
  generatedAt: new Date().toISOString(),
  mode: values['signals-only'] ? 'signals-only' : 'model',
  model: values.model,
  totalFailing: failing.length,
  triaged: entries.length,
  skipped: failing.length - entries.length,
  entries,
};
mkdirSync(dirname(resolve(values.out)), { recursive: true });
writeFileSync(resolve(values.out), JSON.stringify(out, null, 2));
console.log(`${failing.length} failing/flaky test(s), ${entries.length} triaged (${out.mode}) -> ${values.out}`);
