import { GATEWAY_TIMEOUT } from './evidence.ts';
import type { EvidencePack, TriageResult } from './types.ts';

/**
 * Rules-only baseline: failures a rule can classify without the model.
 *
 * Only one rule exists, deliberately. It was chosen from what the two real outages we captured showed:
 * a paused service answers 504 on nearly every test, so a wall of 504s is a clear stack fault. 500s are
 * not rule material (the product's own bugs return them), and neither are timeouts, locator failures or
 * wrong values, so those still go to the model.
 */
export const RULES_VERSION = 'r1';
export const MIN_GATEWAY_SIBLINGS = 3;

// Services on the request path of the flows the suite exercises. A change to one of them can itself make
// requests time out, so a 504 wall alongside such a diff is not blamed on the stack.
const REQUEST_PATH = /^diff --git a\/src\/(checkout|cart|payment|currency|product-catalog|quote|shipping|frontend|frontend-proxy)\//m;

export interface RuleVerdict {
  ruleId: string;
  result: TriageResult;
}

/** The text of each attempt. A log without "Attempt N" headers (a pasted log) counts as one attempt. */
function attempts(log: string): string[] {
  const parts = log.split(/^Attempt \d+ \((?:failed|passed|timedOut|interrupted|skipped)\):\n?/m).slice(1);
  return parts.length ? parts : [log];
}

/** Returns a verdict if a rule applies, otherwise null and the model decides. */
export function ruleVerdict(pack: EvidencePack): RuleVerdict | null {
  const { input, context: ctx } = pack;

  if (ctx.status !== 'unexpected') return null; // flaky (passed on retry) and passing tests are for the model
  const tries = attempts(input.log);
  if (!tries.every(t => GATEWAY_TIMEOUT.test(t))) return null; // every attempt must be this test's own 504
  const siblings = ctx.gatewayTimeoutSiblings ?? 0;
  if (siblings < MIN_GATEWAY_SIBLINGS) return null; // one 504 could be a product timeout; a wall is the stack
  if (REQUEST_PATH.test(input.gitDiff)) return null;

  const line = input.log.match(GATEWAY_TIMEOUT)![0];
  const signal = pack.signals.find(s => s.id === 'env-wall-of-gateway-errors');
  return {
    ruleId: 'gateway-504-wall',
    result: {
      classification: 'environment_issue',
      confidence: 'high',
      summary: `This test got a 504 Gateway Timeout on every attempt, and ${siblings} other test(s) in the same run also failed with a 504. A wall of gateway timeouts points to the stack, not to this test or the product.`,
      evidence: [
        { source: 'log', quote: line, why: 'The failure is the gateway timing out, not a wrong value or a failed assertion on business data.' },
        ...(signal ? [{ source: 'signal' as const, quote: signal.quote, why: `${siblings} other failed tests also ended in a 504 in this run.` }] : []),
      ],
      alternative: {
        classification: 'product_bug',
        why_not: 'A product bug fails one flow with a wrong value or a specific error. It does not return the same gateway timeout across unrelated tests, and the diff touches no service on the request path.',
      },
      known_defect: null,
      next_action: {
        type: 'restart_env',
        detail: 'Check `docker ps -a` for paused, exited or unhealthy containers, restart the stack and re-run. Do not file a bug from this run.',
        owner_pod: 'Quality Platform',
      },
      needs_human: false,
    },
  };
}
