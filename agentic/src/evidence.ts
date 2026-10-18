import { existsSync, readFileSync } from 'node:fs';
import { detectSignals } from './signals.ts';
import type { EvidencePack, RunContext, TriageInput } from './types.ts';

interface PwTest {
  title: string;
  file?: string;
  project?: string;
  status: string;
  annotations?: { type: string; description?: string }[];
  results: { status: string; error?: { message?: string } }[];
}

export const GATEWAY_TIMEOUT = /Received:\s*504\b|\b504 Gateway Time-?out/i;
const stripAnsi = (s: string) => s.replace(/\x1b\[[0-9;]*m/g, '');

/** Flattens Playwright's JSON report (the same file dashboard/build.mjs reads). */
export function flattenResults(report: any): PwTest[] {
  const out: PwTest[] = [];
  const walk = (suite: any, file?: string, path: string[] = []) => {
    const f = suite.file ?? file;
    const here = suite.title && suite.title !== f ? [...path, suite.title] : path;
    for (const spec of suite.specs ?? [])
      for (const t of spec.tests ?? [])
        out.push({
          title: [...here, spec.title].join(' > '),
          file: spec.file ?? f,
          project: t.projectName,
          status: t.status,
          annotations: t.annotations,
          results: t.results ?? [],
        });
    for (const child of suite.suites ?? []) walk(child, f, here);
  };
  for (const s of report.suites ?? []) walk(s);
  return out;
}

/** Input is `docker ps --format '{{.Names}} {{.Status}}'`: the container name is the first token. */
export function findUnhealthy(dockerPs: string): string[] {
  return dockerPs
    .split('\n')
    .filter(l => /\(unhealthy\)/.test(l))
    .map(l => l.trim().split(/\s+/)[0]);
}

export interface CollectOptions {
  resultsPath?: string;
  dockerPsPath?: string;
  /** Run metadata supplied directly (used by the eval cases instead of a full results.json). */
  context?: Partial<RunContext>;
}

export function collectEvidence(input: TriageInput, opts: CollectOptions = {}): EvidencePack {
  const ctx: RunContext = { siblingFailures: [], unhealthyContainers: [] };
  ctx.testCaseId = input.testName.match(/TC-[A-Z]+-\d+/)?.[0];

  if (opts.resultsPath && existsSync(opts.resultsPath)) {
    const tests = flattenResults(JSON.parse(readFileSync(opts.resultsPath, 'utf8')));
    const mine = tests.find(t => input.testName.includes(t.title) || t.title.includes(input.testName));
    if (mine) {
      ctx.file = mine.file;
      ctx.project = mine.project;
      ctx.status = mine.status;
      ctx.retries = Math.max(0, mine.results.length - 1);
      ctx.attempts = mine.results.map(r => ({ status: r.status, error: r.error?.message?.slice(0, 300) }));
      ctx.annotations = mine.annotations;
    }
    const failed = tests.filter(t => t.status === 'unexpected' && t !== mine);
    ctx.siblingFailures = failed.map(t => t.title);
    ctx.gatewayTimeoutSiblings = failed.filter(t => GATEWAY_TIMEOUT.test(stripAnsi(t.results.at(-1)?.error?.message ?? ''))).length;
    ctx.totalFailed = failed.length + (mine?.status === 'unexpected' ? 1 : 0);
    ctx.totalExecuted = tests.filter(t => t.status !== 'skipped').length;
  }
  if (opts.dockerPsPath && existsSync(opts.dockerPsPath)) ctx.unhealthyContainers = findUnhealthy(readFileSync(opts.dockerPsPath, 'utf8'));

  Object.assign(ctx, opts.context);
  return { input, context: ctx, signals: detectSignals(input, ctx) };
}
