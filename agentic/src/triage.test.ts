import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ruleVerdict } from './baseline.ts';
import { collectEvidence, findUnhealthy, flattenResults } from './evidence.ts';
import { applyGuardrails } from './guardrails.ts';
import { loadKnownDefects } from './knowledge.ts';
import { parseCliOutput } from './llm/ClaudeCodeCli.ts';
import type { LlmClient } from './llm/LlmClient.ts';
import { detectSignals } from './signals.ts';
import { triage } from './triage.ts';
import type { EvidencePack, TriageResult } from './types.ts';

const repoRoot = fileURLToPath(new URL('../../', import.meta.url));

const pack = (log: string, over: Partial<EvidencePack['context']> = {}, diff = ''): EvidencePack => {
  const base = collectEvidence({ testName: 'api/checkout > TC-CHK-02 order cost equals price', log, gitDiff: diff });
  return { ...base, context: { ...base.context, ...over } };
};

const result = (over: Partial<TriageResult> = {}): TriageResult => ({
  classification: 'product_bug',
  confidence: 'high',
  summary: 's',
  evidence: [
    { source: 'log', quote: 'received 799999999', why: 'w' },
    { source: 'known_defect', quote: 'DEF-01', why: 'w' },
  ],
  alternative: { classification: 'test_gap', why_not: 'n' },
  known_defect: 'DEF-01',
  next_action: { type: 'file_bug', detail: 'd', owner_pod: 'Catalogue & Pricing' },
  needs_human: false,
  ...over,
});

test('known defects are read from bugs/README.md', () => {
  const d = loadKnownDefects(repoRoot);
  assert.equal(d.length, 11);
  assert.equal(d.find(x => x.id === 'DEF-01')?.severity, 'S1');
});

test('signals: DEF-01 price shift and test case id', () => {
  const p = collectEvidence({ testName: 'TC-CHK-02 cost', log: 'expected 80000000 received 799999999', gitDiff: '' });
  assert.equal(p.context.testCaseId, 'TC-CHK-02');
  assert.ok(p.signals.some(s => s.id === 'def-01-price-shift'));
});

test('signals: a wall of 504s plus an unhealthy container reads as environment', () => {
  const input = { testName: 't', log: 'Error: 504 Gateway Timeout', gitDiff: '' };
  const ctx = { siblingFailures: ['a', 'b', 'c'], unhealthyContainers: ['checkout'] };
  const ids = detectSignals(input, ctx).map(x => x.id);
  assert.ok(ids.includes('env-wall-of-gateway-errors'));
  assert.ok(ids.includes('env-unhealthy-container'));
  // one isolated 504 is not a wall
  assert.ok(!detectSignals(input, { siblingFailures: [], unhealthyContainers: [] }).some(x => x.id === 'env-wall-of-gateway-errors'));
  assert.deepEqual(findUnhealthy('checkout Up 2 minutes (unhealthy)\ncart Up 2 minutes (healthy)'), ['checkout']);
});

test('signals: knownDefect test now passing and flaky-on-retry', () => {
  const input = { testName: 't', log: 'x', gitDiff: '' };
  const fixed = detectSignals(input, { siblingFailures: [], unhealthyContainers: [], status: 'expected', annotations: [{ type: 'defect', description: 'DEF-01' }] });
  assert.ok(fixed.some(x => x.id === 'known-defect-now-passing'));
  assert.ok(!fixed.some(x => x.id === 'known-defect-test-failing'));
  const flaky = detectSignals(input, { siblingFailures: [], unhealthyContainers: [], status: 'flaky' });
  assert.ok(flaky.some(x => x.id === 'flaky-passed-on-retry'));
});

test('signals: a failing knownDefect test is flagged as the documented bug', () => {
  const input = { testName: 't', log: 'x', gitDiff: '' };
  const s = detectSignals(input, { siblingFailures: [], unhealthyContainers: [], status: 'unexpected', annotations: [{ type: 'defect', description: 'DEF-03' }] });
  assert.ok(s.some(x => x.id === 'known-defect-test-failing'));
});

test('signals: diff limited to automation/ is flagged as test-only', () => {
  const p = collectEvidence({ testName: 't', log: 'x', gitDiff: 'diff --git a/automation/pages/CartPage.ts b/automation/pages/CartPage.ts\n' });
  assert.ok(p.signals.some(s => s.id === 'diff-touches-page-objects'));
});

test('flattenResults finds status, annotations and attempts', () => {
  const report = {
    suites: [{ file: 'a.spec.ts', title: 'a.spec.ts', suites: [{ title: 'TC-X', specs: [{ title: 't1', file: 'a.spec.ts', tests: [{ projectName: 'api', status: 'flaky', annotations: [{ type: 'defect', description: 'DEF-01' }], results: [{ status: 'failed' }, { status: 'passed' }] }] }] }] }],
  };
  const [t] = flattenResults(report);
  assert.equal(t.title, 'TC-X > t1');
  assert.equal(t.results.length, 2);
});

test('guardrails drop quotes that are not in the input and cap confidence', () => {
  const g = applyGuardrails(result({ evidence: [{ source: 'log', quote: 'invented text', why: 'w' }] }), pack('received 799999999'));
  assert.equal(g.result.evidence.length, 0);
  assert.equal(g.result.confidence, 'low');
  assert.equal(g.result.needs_human, true);
});

test('guardrails downgrade high confidence with a single source', () => {
  const g = applyGuardrails(result({ evidence: [{ source: 'log', quote: 'received 799999999', why: 'w' }] }), pack('received 799999999'));
  assert.equal(g.result.confidence, 'medium');
});

test('guardrails escalate money-area flaky verdicts but never change the class', () => {
  const g = applyGuardrails(result({ classification: 'flaky_test', confidence: 'medium' }), pack('payment charge received 799999999'));
  assert.equal(g.result.classification, 'flaky_test');
  assert.equal(g.result.needs_human, true);
});

test('parseCliOutput reads structured_output and fenced JSON results', () => {
  const a = parseCliOutput(JSON.stringify({ type: 'result', structured_output: { x: 1 }, total_cost_usd: 0.01 }), 5);
  assert.deepEqual(a.output, { x: 1 });
  const b = parseCliOutput(JSON.stringify([{ type: 'system' }, { type: 'result', result: '```json\n{"y":2}\n```' }]), 5);
  assert.deepEqual(b.output, { y: 2 });
  assert.throws(() => parseCliOutput(JSON.stringify({ type: 'result', is_error: true, result: 'boom' }), 1), /boom/);
});

test('triage retries once on an invalid reply, then guards the valid one', async () => {
  let calls = 0;
  const llm: LlmClient = {
    async complete() {
      calls++;
      return { output: calls === 1 ? { nope: true } : result(), durationMs: 1 };
    },
  };
  const out = await triage({ testName: 'TC-CHK-02 cost', log: 'received 799999999 DEF-01', gitDiff: '' }, llm, repoRoot);
  assert.equal(calls, 2);
  assert.equal(out.result.classification, 'product_bug');
});

test('triage gives up after two invalid replies', async () => {
  const llm: LlmClient = { complete: async () => ({ output: { nope: true }, durationMs: 1 }) };
  await assert.rejects(triage({ testName: 't', log: 'l', gitDiff: '' }, llm, repoRoot), /schema validation twice/);
});

// ---------- rules-only baseline ----------
const A504 = 'Error: expect(received).toBe(expected)\n\nExpected: 200\nReceived: 504\n';
const wall = (log: string, ctx: Partial<EvidencePack['context']> = {}, diff = '') =>
  collectEvidence(
    { testName: 'api/checkout.spec.ts > TC-CHK-02 order cost equals price', log, gitDiff: diff },
    { context: { status: 'unexpected', siblingFailures: ['a', 'b', 'c', 'd'], gatewayTimeoutSiblings: 4, ...ctx } },
  );
const attempts = (...logs: string[]) => logs.map((l, i) => `Attempt ${i + 1} (failed):\n${l}`).join('\n\n');
const productDiff = 'diff --git a/src/checkout/main.go b/src/checkout/main.go\n+  time.Sleep(20 * time.Second)\n';

test('rule: a 504 on every attempt plus a wall of 504s is an environment issue, with no model call', async () => {
  const p = wall(attempts(A504, A504));
  const v = ruleVerdict(p);
  assert.equal(v?.ruleId, 'gateway-504-wall');
  assert.equal(v?.result.classification, 'environment_issue');
  const never: LlmClient = { complete: async () => { throw new Error('the model must not be called'); } };
  const o = await triage(p.input, never, repoRoot, { context: p.context });
  assert.equal(o.decidedBy, 'rule');
  assert.equal(o.result.confidence, 'high'); // survives the guardrails: log + signal are two sources
  assert.equal(o.durationMs, 0);
});

test('rule: does not fire without a wall, on retry-pass, on mixed codes, or on an expected 504', () => {
  assert.equal(ruleVerdict(wall(attempts(A504, A504), { gatewayTimeoutSiblings: 2 })), null, 'one or two 504s could be a product timeout');
  assert.equal(ruleVerdict(wall(attempts(A504, 'passed'), { status: 'flaky' })), null, 'flaky goes to the model');
  assert.equal(ruleVerdict(wall(attempts(A504, 'Expected: 200\nReceived: 500\n'))), null, 'a 504 then a 500 is not this rule');
  assert.equal(ruleVerdict(wall(attempts('Expected: 504\nReceived: 200\n'))), null, 'a test that expects 504 got 200');
  assert.equal(ruleVerdict(wall(attempts('Expected: 57.08\nReceived: 57.8\n'))), null, 'a wall around a test whose own error is a wrong value (the DEF-01 shape)');
  assert.equal(ruleVerdict(wall(attempts('Expected: 200\nReceived: 502\n'))), null, 'only 504 is a rule');
});

test('rule: a diff to a service on the request path goes to the model; an unrelated service does not', () => {
  assert.equal(ruleVerdict(wall(attempts(A504, A504), {}, productDiff)), null);
  const unrelated = 'diff --git a/src/ad/src/main/java/oteldemo/AdService.java b/src/ad/src/main/java/oteldemo/AdService.java\n+  // todo\n';
  assert.equal(ruleVerdict(wall(attempts(A504, A504), {}, unrelated))?.ruleId, 'gateway-504-wall');
});

test('rule: rules: false always calls the model', async () => {
  let calls = 0;
  const llm: LlmClient = {
    complete: async () => {
      calls++;
      return { output: result({ classification: 'environment_issue', confidence: 'medium' }), durationMs: 1 };
    },
  };
  const p = wall(attempts(A504, A504));
  const o = await triage(p.input, llm, repoRoot, { context: p.context, rules: false });
  assert.equal(calls, 1);
  assert.equal(o.decidedBy, 'model');
});

test('evidence: counts sibling failures whose own error is a 504', () => {
  const spec = (title: string, msg: string) => ({ title: 's', specs: [{ title, file: 'a.spec.ts', tests: [{ projectName: 'api', status: 'unexpected', results: [{ status: 'failed', error: { message: msg } }] }] }] });
  const report = { suites: [{ file: 'a.spec.ts', title: 'a.spec.ts', suites: [spec('mine', A504), spec('b', A504), spec('c', 'Expected: 200\nReceived: 500'), spec('d', A504)] }] };
  const f = join(mkdtempSync(join(tmpdir(), 'tri-')), 'results.json');
  writeFileSync(f, JSON.stringify(report));
  const p = collectEvidence({ testName: 'mine', log: A504, gitDiff: '' }, { resultsPath: f });
  assert.equal(p.context.gatewayTimeoutSiblings, 2);
});
