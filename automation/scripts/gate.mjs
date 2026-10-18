// The pass/fail decision for CI, made from test-results/results.json after a full run.
//
// Tests that cover a known defect (marked with knownDefect('DEF-xx')) assert the CORRECT behaviour, so while the bug
// exists they genuinely FAIL, and the reports show them red. This script decides whether the build is allowed to pass:
//   - a failing test that is NOT a known defect          -> real regression: exit 1
//   - a known-defect test that PASSES                    -> the bug is fixed, remove knownDefect() from it: exit 1
//   - a known-defect test that fails                     -> expected, listed, does not block
// Usage: node scripts/gate.mjs [path/to/results.json]

import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const path = process.argv[2] ?? join(dirname(fileURLToPath(import.meta.url)), '../test-results/results.json');
if (!existsSync(path)) {
  console.error(`gate: ${path} not found, so the run did not finish`);
  process.exit(1);
}

const tests = [];
const walk = (suite, file) => {
  for (const spec of suite.specs ?? [])
    for (const t of spec.tests)
      tests.push({
        name: `${t.projectName} › ${spec.file ?? file} › ${spec.title}`,
        status: t.status, // expected | unexpected | flaky | skipped
        defect: t.annotations?.find(a => a.type === 'defect')?.description,
      });
  for (const child of suite.suites ?? []) walk(child, child.file ?? file);
};
JSON.parse(readFileSync(path, 'utf8')).suites.forEach(s => walk(s, s.file));

const failing = tests.filter(t => t.status === 'unexpected');
const regressions = failing.filter(t => !t.defect);
const knownFailing = failing.filter(t => t.defect);
const fixed = tests.filter(t => t.defect && (t.status === 'expected' || t.status === 'flaky'));

console.log(`\ngate: ${tests.length} tests, ${knownFailing.length} failing on known defects, ${regressions.length} real failures, ${fixed.length} known defects now passing`);
for (const t of knownFailing) console.log(`  known defect ${t.defect}: ${t.name}`);
for (const t of regressions) console.log(`  REGRESSION: ${t.name}`);
for (const t of fixed) console.log(`  FIXED ${t.defect}, remove knownDefect() from: ${t.name}`);

process.exit(regressions.length || fixed.length ? 1 : 0);
