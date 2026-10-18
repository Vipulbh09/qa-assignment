import type { RunContext, Signal, TriageInput } from './types.ts';

interface Rule {
  id: string;
  hint: string;
  test: (text: string, input: TriageInput, ctx: RunContext) => string | undefined;
}

const first = (text: string, re: RegExp) => text.match(re)?.[0];

/**
 * Cheap, high-precision pre-signals. They are passed to the model as hints, never as verdicts.
 * Each one comes from something this repo already learned the hard way
 * (automation-strategy.md section 4, bugs/*).
 */
const RULES: Rule[] = [
  {
    id: 'env-wall-of-gateway-errors',
    hint: 'Several tests failed with 502/503/504 or timeouts in one run: a wall of 504s is an environment signal, not many product bugs.',
    test: (t, _i, c) => (c.siblingFailures.length >= 3 ? first(t, /\b50[234]\b|Timeout \d+ms exceeded|ECONNREFUSED/) : undefined),
  },
  {
    id: 'env-unhealthy-container',
    hint: 'A stack container is unhealthy, so results from this run are not trustworthy.',
    test: (_t, _i, c) => (c.unhealthyContainers.length ? `${c.unhealthyContainers.join(', ')} (unhealthy)` : undefined),
  },
  {
    id: 'flaky-passed-on-retry',
    hint: 'The test failed and then passed on retry in the same run. Check it is not an intermittent product bug (server state correct but UI wrong).',
    test: (_t, _i, c) => (c.status === 'flaky' ? 'status: flaky (passed on retry)' : undefined),
  },
  {
    id: 'stale-expected-failure',
    hint: 'This test is annotated test.fail for a known defect but now PASSES: the defect is probably fixed and the annotation is stale. That is not a product bug.',
    test: (_t, _i, c) => {
      const a = c.annotations?.find(x => x.type === 'fail');
      return a && c.status === 'unexpected' ? `test.fail(${a.description ?? ''}) is unexpectedly passing` : undefined;
    },
  },
  {
    id: 'locator-failure',
    hint: 'A locator timed out or matched the wrong number of elements. If the diff touches page objects, data-cy hooks or frontend markup, suspect a stale selector (test gap), not a product bug.',
    test: t => first(t, /waiting for (?:getByTestId|locator)\([^\n]*|strict mode violation[^\n]*|locator\.[a-zA-Z]+: Timeout[^\n]*/),
  },
  {
    id: 'diff-touches-page-objects',
    hint: 'The diff changes page objects or test code only; no product source changed.',
    test: (_t, i) => {
      const files = [...i.gitDiff.matchAll(/^diff --git a\/(\S+)/gm)].map(m => m[1]);
      return files.length > 0 && files.every(f => /^automation\//.test(f)) ? files.join(', ') : undefined;
    },
  },
  {
    id: 'diff-touches-product-source',
    hint: 'The diff changes product source under src/. Raises the prior for a product bug if it sits on the failing flow.',
    test: (_t, i) => first(i.gitDiff, /^diff --git a\/src\/\S+/m),
  },
  // Known defect signatures (bugs/DEF-xx)
  {
    id: 'def-01-price-shift',
    hint: 'Matches DEF-01: prices with 1-9 cents are read with leading zeros dropped (57.08 becomes 57.80).',
    test: t => first(t, /799999999|Expected: 57\.08\s+Received: 57\.8\b|57\.80\b/),
  },
  {
    id: 'def-05-zero-price',
    hint: 'Matches DEF-05: an unsupported currency code prices everything at 0 and checkout accepts it.',
    test: t => first(t, /currencyCode[=:"' ]+(?:XXX|ZZZ)[^\n]*|price[^\n]*\b0\b[^\n]*unsupported/i),
  },
  {
    id: 'def-07-cart-500',
    hint: 'Matches DEF-07: an unknown product in the cart makes every cart read return 500.',
    test: t => first(t, /Product Not Found[^\n]*|NOT-A-PRODUCT[^\n]*/),
  },
];

export function detectSignals(input: TriageInput, ctx: RunContext): Signal[] {
  const text = `${input.log}\n${input.testName}`;
  return RULES.flatMap(r => {
    const quote = r.test(text, input, ctx);
    return quote ? [{ id: r.id, hint: r.hint, quote }] : [];
  });
}
