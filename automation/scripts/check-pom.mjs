// Fails if a test file talks to the page or the API directly.
// Tests may only call page objects (pages/) and API clients (api/), through fixtures.
// Usage: node scripts/check-pom.mjs   (run by `npm run lint:pom` and by CI)

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const testsDir = join(root, 'tests');

const RULES = [
  [/\.locator\(/, 'locator in a test: add it to a page object'],
  [/\.getBy[A-Z]\w*\(/, 'getBy... in a test: add it to a page object'],
  [/\.(click|dblclick|fill|check|uncheck|press|hover|selectOption|waitForURL|waitForSelector|addInitScript|route)\(/, 'direct browser interaction in a test: add a page object method'],
  [/\b(page|context|browser)\.\w+/, 'raw page, context or browser in a test: use the pages, newTab or newSession fixtures'],
  [/\brequest\.(get|post|put|patch|delete|fetch)\(/, 'raw HTTP call in a test: add a method to an API client'],
  [/['"`]\/(api|feature|flagservice)\//, 'endpoint URL in a test: it belongs in an API client'],
  [/data-cy|\[data-|#[a-z_]+['"`]/, 'selector string in a test: it belongs in a page object'],
  [/from '@playwright\/test'/, "import test and expect from '../../fixtures', not from Playwright directly"],
];

const files = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path) : path.endsWith('.ts') ? [path] : [];
  });

// Blank out comments but keep line numbers, so prose about locators does not trigger a rule.
const stripComments = (src) =>
  src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:'"`])\/\/.*$/gm, '$1');

const violations = [];
for (const file of files(testsDir)) {
  stripComments(readFileSync(file, 'utf8'))
    .split('\n')
    .forEach((line, i) => {
      for (const [pattern, message] of RULES) {
        if (pattern.test(line)) violations.push(`${relative(root, file)}:${i + 1}  ${message}\n    ${line.trim()}`);
      }
    });
}

if (violations.length) {
  console.error(`POM check failed: ${violations.length} violation(s)\n\n${violations.join('\n')}`);
  process.exit(1);
}
console.log(`POM check passed: ${files(testsDir).length} test files call only page objects and API clients.`);
