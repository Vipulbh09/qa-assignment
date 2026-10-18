import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { ClaudeCodeCli } from './llm/ClaudeCodeCli.ts';
import { renderMarkdown } from './report.ts';
import { triage } from './triage.ts';

const repoRoot = fileURLToPath(new URL('../../', import.meta.url));

const { values } = parseArgs({
  options: {
    test: { type: 'string' },
    log: { type: 'string' },
    diff: { type: 'string' },
    results: { type: 'string' },
    'docker-ps': { type: 'string' },
    model: { type: 'string', default: 'sonnet' },
    json: { type: 'boolean', default: false },
    'no-rules': { type: 'boolean', default: false },
  },
});

if (!values.test || !values.log) {
  console.error('usage: npm run triage -- --test "<test name>" --log <file> [--diff <file>] [--results results.json] [--docker-ps file] [--model sonnet] [--json] [--no-rules]');
  process.exit(2);
}

const outcome = await triage(
  { testName: values.test, log: readFileSync(resolve(values.log), 'utf8'), gitDiff: values.diff ? readFileSync(resolve(values.diff), 'utf8') : '' },
  new ClaudeCodeCli({ model: values.model }),
  repoRoot,
  { resultsPath: values.results && resolve(values.results), dockerPsPath: values['docker-ps'] && resolve(values['docker-ps']), rules: !values['no-rules'] },
);

console.log(values.json ? JSON.stringify(outcome.result, null, 2) : renderMarkdown(values.test, outcome));
