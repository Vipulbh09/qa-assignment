import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { ClaudeCodeCli } from '../src/llm/ClaudeCodeCli.ts';
import { PROMPT_VERSION } from '../src/prompt.ts';
import { triage } from '../src/triage.ts';
import { CLASSIFICATIONS, type Classification, type RunContext, type TriageResult } from '../src/types.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const repoRoot = join(here, '../../');
const casesDir = join(here, 'cases');
const { values } = parseArgs({
  options: {
    only: { type: 'string' },
    model: { type: 'string', default: 'sonnet' },
    force: { type: 'boolean', default: false },
    runs: { type: 'string', default: '1' },
    out: { type: 'string' },
  },
});

const resultsDir = values.out ? resolve(values.out) : join(here, 'results');
const cacheDir = join(resultsDir, 'cache');


interface CaseMeta {
  id: string;
  category: string;
  provenance: string;
  testName: string;
  expected: { classification: Classification; known_defect?: string };
  context?: Partial<RunContext>;
}

interface Run {
  result: TriageResult;
  guardrailNotes: string[];
  durationMs: number;
  costUsd?: number;
}

const only = values.only?.split(',');
const ids = readdirSync(casesDir).filter(d => existsSync(join(casesDir, d, 'case.json')) && (!only || only.includes(d)));
const runsPer = Number(values.runs);
mkdirSync(cacheDir, { recursive: true });

const llm = new ClaudeCodeCli({ model: values.model });
const rows: { meta: CaseMeta; runs: Run[]; cached: number }[] = [];

for (const id of ids) {
  const dir = join(casesDir, id);
  const meta: CaseMeta = JSON.parse(readFileSync(join(dir, 'case.json'), 'utf8'));
  const log = readFileSync(join(dir, 'log.txt'), 'utf8');
  const diff = readFileSync(join(dir, 'diff.patch'), 'utf8');
  const runs: Run[] = [];
  let cached = 0;
  for (let i = 0; i < runsPer; i++) {
    const cacheFile = join(cacheDir, `${id}.${PROMPT_VERSION}.${values.model}.${i}.json`);
    if (!values.force && existsSync(cacheFile)) {
      runs.push(JSON.parse(readFileSync(cacheFile, 'utf8')));
      cached++;
      continue;
    }
    process.stdout.write(`running ${id} #${i + 1} ... `);
    const o = await triage({ testName: meta.testName, log, gitDiff: diff }, llm, repoRoot, { context: meta.context });
    const run: Run = { result: o.result, guardrailNotes: o.guardrailNotes, durationMs: o.durationMs, costUsd: o.costUsd };
    writeFileSync(cacheFile, JSON.stringify(run, null, 2));
    runs.push(run);
    console.log(`${run.result.classification} (${run.result.confidence}) in ${(run.durationMs / 1000).toFixed(1)}s`);
  }
  rows.push({ meta, runs, cached });
}

// ---------- scoring (first run of each case is the headline; extra runs measure stability) ----------
const head = rows.map(r => ({ ...r, got: r.runs[0].result, ok: r.runs[0].result.classification === r.meta.expected.classification }));
const correct = head.filter(h => h.ok).length;
const pct = (n: number, d: number) => (d ? `${((100 * n) / d).toFixed(0)}%` : 'n/a');

const matrix: Record<string, Record<string, number>> = {};
for (const c of CLASSIFICATIONS) matrix[c] = Object.fromEntries(CLASSIFICATIONS.map(x => [x, 0]));
for (const h of head) matrix[h.meta.expected.classification][h.got.classification]++;

const perClass = CLASSIFICATIONS.map(c => {
  const tp = matrix[c][c];
  const predicted = CLASSIFICATIONS.reduce((n, e) => n + matrix[e][c], 0);
  const actual = CLASSIFICATIONS.reduce((n, p) => n + matrix[c][p], 0);
  return { c, precision: pct(tp, predicted), recall: pct(tp, actual), actual };
});

const byConf = (lvl: string) => head.filter(h => h.got.confidence === lvl);
const calib = ['high', 'medium', 'low'].map(l => ({ l, n: byConf(l).length, ok: byConf(l).filter(h => h.ok).length }));
const falseFlaky = head.filter(h => h.meta.expected.classification === 'product_bug' && h.got.classification === 'flaky_test');
const s1FalseFlaky = falseFlaky.filter(h => /currenc|price|payment|charge/i.test(h.meta.testName));
const withDefect = head.filter(h => h.meta.expected.known_defect);
const defectOk = withDefect.filter(h => h.got.known_defect === h.meta.expected.known_defect);
const highWrong = head.filter(h => h.got.confidence === 'high' && !h.ok);
const unstable = rows.filter(r => new Set(r.runs.map(x => x.result.classification)).size > 1);
const totalCost = rows.flatMap(r => r.runs).reduce((s, r) => s + (r.costUsd ?? 0), 0);
const totalSec = rows.flatMap(r => r.runs).reduce((s, r) => s + r.durationMs, 0) / 1000;

const bar = [
  { name: `at least ${Math.ceil(0.85 * head.length)}/${head.length} correct`, pass: correct >= Math.ceil(0.85 * head.length) },
  { name: 'every high-confidence answer is correct', pass: highWrong.length === 0 },
  { name: 'no S1 product bug labelled flaky', pass: s1FalseFlaky.length === 0 },
];

const md = [
  `# Eval results`,
  '',
  `Prompt **${PROMPT_VERSION}** · model **${values.model}** · ${head.length} cases × ${runsPer} run(s) · ${new Date().toISOString().slice(0, 10)}`,
  '',
  `> With ${head.length} cases these numbers are directional, not statistically strong. Read the per-case table, not just the percentages. ` +
    `Cases marked *constructed* were written in Playwright's real error format but not captured from a live break.`,
  '',
  `**Accuracy: ${correct}/${head.length} (${pct(correct, head.length)})** · known-defect match ${defectOk.length}/${withDefect.length} · cost ${totalCost.toFixed(2)} USD-equivalent · ${totalSec.toFixed(0)}s model time`,
  '',
  '## Success bar',
  ...bar.map(b => `- ${b.pass ? 'PASS' : 'FAIL'}: ${b.name}`),
  '',
  '## Per case',
  '| Case | Expected | Got | Confidence | Defect | Human? | OK | Source |',
  '|---|---|---|---|---|---|---|---|',
  ...head.map(h => `| ${h.meta.id} | ${h.meta.expected.classification} | ${h.got.classification} | ${h.got.confidence} | ${h.got.known_defect ?? '-'}${h.meta.expected.known_defect && h.got.known_defect !== h.meta.expected.known_defect ? ` (want ${h.meta.expected.known_defect})` : ''} | ${h.got.needs_human ? 'yes' : 'no'} | ${h.ok ? 'yes' : '**NO**'} | ${h.meta.provenance.split(':')[0]} |`),
  '',
  '## Per class',
  '| Class | Cases | Precision | Recall |',
  '|---|---|---|---|',
  ...perClass.map(p => `| ${p.c} | ${p.actual} | ${p.precision} | ${p.recall} |`),
  '',
  '## Confusion matrix (rows = expected, columns = got)',
  `| | ${CLASSIFICATIONS.join(' | ')} |`,
  `|---|${CLASSIFICATIONS.map(() => '---').join('|')}|`,
  ...CLASSIFICATIONS.map(e => `| ${e} | ${CLASSIFICATIONS.map(p => matrix[e][p]).join(' | ')} |`),
  '',
  '## Confidence calibration',
  '| Confidence | Answers | Correct |',
  '|---|---|---|',
  ...calib.map(c => `| ${c.l} | ${c.n} | ${c.ok} |`),
  '',
  `False "flaky" on real product bugs: **${falseFlaky.length}** (the costly error: it hides bugs).`,
  ...(runsPer > 1 ? ['', `Unstable across ${runsPer} runs: ${unstable.length ? unstable.map(u => u.meta.id).join(', ') : 'none'}`] : []),
  '',
  '## Misses',
  ...(head.filter(h => !h.ok).length
    ? head.filter(h => !h.ok).flatMap(h => [`### ${h.meta.id}: expected ${h.meta.expected.classification}, got ${h.got.classification} (${h.got.confidence})`, h.got.summary, `Runner-up it gave: ${h.got.alternative.classification}. Guardrails: ${h.runs[0].guardrailNotes.join('; ') || 'none'}`, ''])
    : ['None.']),
].join('\n');

const report = {
  promptVersion: PROMPT_VERSION,
  model: values.model,
  ranAt: new Date().toISOString(),
  source: process.env.GITHUB_ACTIONS ? 'ci' : 'local',
  runUrl: process.env.GITHUB_RUN_ID ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}` : null,
  runsPerCase: runsPer,
  correct,
  total: head.length,
  accuracy: head.length ? correct / head.length : 0,
  knownDefect: { matched: defectOk.length, total: withDefect.length },
  falseFlaky: falseFlaky.length,
  costUsd: totalCost,
  modelSeconds: totalSec,
  bar,
  perClass,
  matrix,
  calibration: calib,
  unstable: unstable.map(u => u.meta.id),
  cases: head.map(h => ({
    id: h.meta.id,
    category: h.meta.category,
    provenance: h.meta.provenance.split(':')[0],
    testName: h.meta.testName,
    expected: h.meta.expected,
    ok: h.ok,
    got: h.got,
    guardrailNotes: h.runs[0].guardrailNotes,
    stable: new Set(h.runs.map(x => x.result.classification)).size === 1,
  })),
};

if (!only) {
  mkdirSync(resultsDir, { recursive: true });
  writeFileSync(join(resultsDir, 'latest.md'), md + '\n');
  writeFileSync(join(resultsDir, 'latest.json'), JSON.stringify(report, null, 2));
}
console.log('\n' + md);
