// Builds the CI triage agent report (one static HTML page, no dependencies):
//   --eval   evals/results/latest.json   the 14-case eval (fresh from this CI run, or the last committed one)
//   --fresh  true|false                  was the eval re-run in this build?
//   --triage triage-results.json         triage of this run's failing tests (optional)
//   --out    dir                         writes <out>/index.html
//   --summary file                       also writes a short markdown summary (for $GITHUB_STEP_SUMMARY)
// Usage: node report/build.mjs --eval latest.json --fresh true --triage triage-results.json --out site/agent

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : fallback;
};
const evalPath = resolve(arg('eval', 'evals/results/latest.json'));
const fresh = arg('fresh', 'false') === 'true';
const triagePath = arg('triage', null);
const outDir = resolve(arg('out', 'dist'));
const summaryPath = arg('summary', null);

const ev = JSON.parse(readFileSync(evalPath, 'utf8'));
const tr = triagePath && existsSync(triagePath) ? JSON.parse(readFileSync(triagePath, 'utf8')) : null;

const env = process.env;
const repoUrl = env.GITHUB_REPOSITORY ? `${env.GITHUB_SERVER_URL ?? 'https://github.com'}/${env.GITHUB_REPOSITORY}` : '';
const sha = env.GITHUB_SHA ? env.GITHUB_SHA.slice(0, 7) : '';
const runUrl = env.GITHUB_RUN_ID && repoUrl ? `${repoUrl}/actions/runs/${env.GITHUB_RUN_ID}` : '';

const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const LABEL = { product_bug: 'Product bug', flaky_test: 'Flaky test', environment_issue: 'Environment issue', test_gap: 'Test gap' };
const label = c => LABEL[c] ?? c;
const pct = (n, d) => (d ? Math.round((100 * n) / d) : 0);
const fmtDate = iso => new Date(iso).toUTCString().replace(' GMT', ' UTC');

// Status is always text plus a symbol, never colour alone.
const badge = (ok, yes = 'Pass', no = 'Fail') => `<span class="badge ${ok ? 'ok' : 'bad'}"><span aria-hidden="true">${ok ? '✓' : '✕'}</span> ${ok ? yes : no}</span>`;
const conf = c => `<span class="conf ${esc(c)}">${esc(c)}</span>`;

const tile = (l, v, sub) => `<div class="tile"><div class="tile-label">${l}</div><div class="tile-value">${v}</div><div class="tile-sub">${sub}</div></div>`;

function evidenceList(r) {
  return `<ul class="ev">${r.evidence
    .map(e => `<li><span class="src">${esc(e.source)}</span> <code>${esc(String(e.quote).replace(/\s+/g, ' ').slice(0, 220))}</code><br><span class="why">${esc(e.why)}</span></li>`)
    .join('')}</ul>`;
}

function resultBody(r, notes = []) {
  return `<p>${esc(r.summary)}</p>
  ${evidenceList(r)}
  <p class="small"><b>Runner-up:</b> ${esc(label(r.alternative.classification))}. ${esc(r.alternative.why_not)}</p>
  <p class="small"><b>Next action:</b> ${esc(r.next_action.type.replace('_', ' '))} · ${esc(r.next_action.owner_pod)}. ${esc(r.next_action.detail)}</p>
  ${notes.length ? `<p class="small muted"><b>Guardrails:</b> ${notes.map(esc).join('; ')}</p>` : ''}`;
}

// ---------- this run's failures ----------
function triageSection() {
  if (!tr) return `<section class="card"><h2>Failures in this run</h2><p class="card-sub">No triage output in this build.</p></section>`;
  if (tr.totalFailing === 0)
    return `<section class="card"><h2>Failures in this run</h2><p class="card-sub">No failing or flaky tests in this run, so there was nothing to triage.</p></section>`;
  const sub =
    tr.mode === 'signals-only'
      ? 'The model was not available in this build (no <code>CLAUDE_CODE_OAUTH_TOKEN</code>). Only the rule-based signals are shown, not a classification.'
      : `Shadow mode: these are suggestions for a human to confirm. Nothing was filed, quarantined or rerun. ${tr.skipped ? `${tr.skipped} more failure(s) were not triaged (cap of ${tr.triaged}).` : ''}`;
  const items = tr.entries
    .map(e => {
      const o = e.outcome;
      const head = o
        ? `<b>${esc(label(o.result.classification))}</b> ${conf(o.result.confidence)}${o.result.known_defect ? ` · <span class="mono">${esc(o.result.known_defect)}</span>` : ''}${o.result.needs_human ? ' · <span class="human">needs a human</span>' : ''}`
        : e.error
          ? '<b>Not classified</b> <span class="muted">model call failed</span>'
          : '<b>Not classified</b> <span class="muted">signals only</span>';
      const body = o
        ? resultBody(o.result, o.guardrailNotes)
        : `${e.error ? `<p class="small">${esc(e.error)}</p>` : ''}${
            e.signals.length ? `<ul class="ev">${e.signals.map(s => `<li><span class="src">signal</span> ${esc(s.hint)}<br><code>${esc(s.quote)}</code></li>`).join('')}</ul>` : '<p class="small muted">No rule-based signals matched.</p>'
          }`;
      return `<details class="case" open><summary><span class="tname">${esc(e.testName)}</span><span class="sum">${esc(e.status === 'flaky' ? 'passed on retry' : 'failed')} · ${head}</span></summary><div class="case-body">${body}</div></details>`;
    })
    .join('');
  return `<section class="card"><h2>Failures in this run</h2><p class="card-sub">${sub}</p>${items}</section>`;
}

// ---------- eval ----------
const barRows = ev.bar.map(b => `<tr><td>${esc(b.name)}</td><td>${badge(b.pass)}</td></tr>`).join('');
const caseRows = ev.cases
  .map(
    c => `<details class="case"><summary><span class="tname"><span class="mono">${esc(c.id)}</span> ${c.provenance === 'real' ? '' : '<span class="tag">constructed</span>'}</span>
  <span class="sum">expected <b>${esc(label(c.expected.classification))}</b> · got <b>${esc(label(c.got.classification))}</b> ${conf(c.got.confidence)} ${badge(c.ok, 'Correct', 'Wrong')}</span></summary>
  <div class="case-body"><p class="small muted">${esc(c.testName)}</p>${resultBody(c.got, c.guardrailNotes)}</div></details>`,
  )
  .join('');
const classes = Object.keys(ev.matrix);
const matrixRows = classes.map(e => `<tr><th scope="row">${esc(label(e))}</th>${classes.map(p => `<td class="num${e === p && ev.matrix[e][p] ? ' diag' : ''}">${ev.matrix[e][p]}</td>`).join('')}</tr>`).join('');
const constructedN = ev.cases.filter(c => c.provenance !== 'real').length;

const banner = fresh
  ? `<div class="note">The eval was re-run in this CI build, through Claude Code with a subscription token, not an API key.</div>`
  : `<div class="note warn">The eval was <b>not</b> re-run in this build (it runs on pushes to main, nightly and on manual runs, and needs the <code>CLAUDE_CODE_OAUTH_TOKEN</code> secret). Showing the last committed result from ${esc(fmtDate(ev.ranAt))}.</div>`;

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>CI Triage Agent Report</title>
<meta name="description" content="Evaluation of the CI failure triage agent and its triage of the latest CI run.">
<style>
:root { color-scheme: light; --page:#f9f9f7; --surface:#fcfcfb; --ink:#0b0b0b; --ink-2:#52514e; --muted:#898781; --grid:#e1e0d9; --axis:#c3c2b7; --ring:rgba(11,11,11,.10); --accent:#2a78d6; --good:#006300; --good-bg:#e4f2e4; --bad:#a81d1d; --bad-bg:#f8e3e3; --warn-bg:#fdf1d6; --warn-ink:#6a4b00; }
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { color-scheme: dark; --page:#0d0d0d; --surface:#1a1a19; --ink:#f0efec; --ink-2:#c3c2b7; --muted:#898781; --grid:#2c2c2a; --axis:#383835; --ring:rgba(255,255,255,.10); --accent:#3987e5; --good:#5fd35f; --good-bg:#12301a; --bad:#ff8a8a; --bad-bg:#3a1a1a; --warn-bg:#3a2e0e; --warn-ink:#f3cf7a; } }
:root[data-theme="dark"] { color-scheme: dark; --page:#0d0d0d; --surface:#1a1a19; --ink:#f0efec; --ink-2:#c3c2b7; --muted:#898781; --grid:#2c2c2a; --axis:#383835; --ring:rgba(255,255,255,.10); --accent:#3987e5; --good:#5fd35f; --good-bg:#12301a; --bad:#ff8a8a; --bad-bg:#3a1a1a; --warn-bg:#3a2e0e; --warn-ink:#f3cf7a; }
* { box-sizing: border-box; }
body { margin:0; background:var(--page); color:var(--ink); font:15px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif; }
main { max-width:1040px; margin:0 auto; padding:32px 16px 64px; }
a { color:var(--accent); } code { font:12px ui-monospace,SFMono-Regular,Menlo,monospace; word-break:break-word; }
h1 { font-size:26px; margin:0 0 4px; font-weight:650; } h2 { font-size:17px; margin:0 0 4px; font-weight:600; }
.lede,.card-sub,.tile-sub,.small { color:var(--ink-2); } .muted { color:var(--muted); } .small { font-size:13px; margin:6px 0; }
.meta { font-size:13px; color:var(--ink-2); margin-bottom:16px; }
.note { border:1px solid var(--ring); background:var(--surface); border-radius:10px; padding:10px 14px; font-size:13px; margin-bottom:16px; }
.note.warn { background:var(--warn-bg); color:var(--warn-ink); border-color:transparent; }
.card { background:var(--surface); border:1px solid var(--ring); border-radius:12px; padding:20px; margin-top:16px; }
.card-sub { font-size:13px; margin:0 0 14px; }
.kpis { display:grid; grid-template-columns:repeat(auto-fit,minmax(200px,1fr)); gap:12px; }
.tile { border:1px solid var(--ring); border-radius:10px; padding:12px 14px; background:var(--surface); }
.tile-label { font-size:13px; color:var(--ink-2); } .tile-value { font-size:28px; font-weight:600; } .tile-sub { font-size:12px; }
table { width:100%; border-collapse:collapse; font-size:13px; } th { text-align:left; font-weight:600; color:var(--ink-2); border-bottom:1px solid var(--axis); padding:6px 8px; }
td { border-bottom:1px solid var(--grid); padding:7px 8px; vertical-align:top; } td.num,th.num { text-align:right; font-variant-numeric:tabular-nums; } td.diag { font-weight:700; }
.table-wrap { overflow-x:auto; } .grid2 { display:grid; grid-template-columns:1fr 1fr; gap:16px; } .grid2 > * { min-width:0; } .grid2 .card { margin-top:0; }
.badge { display:inline-flex; gap:4px; align-items:center; padding:1px 8px; border-radius:10px; font-size:12px; font-weight:600; white-space:nowrap; }
.badge.ok { background:var(--good-bg); color:var(--good); } .badge.bad { background:var(--bad-bg); color:var(--bad); }
.conf { font-size:12px; border:1px solid var(--axis); border-radius:10px; padding:0 8px; white-space:nowrap; } .conf.high { border-color:var(--good); } .conf.low { border-style:dashed; }
.human { font-weight:600; color:var(--warn-ink); background:var(--warn-bg); border-radius:8px; padding:0 6px; }
.tag { font-size:11px; border:1px dashed var(--axis); border-radius:8px; padding:0 6px; color:var(--ink-2); }
.mono { font:12px ui-monospace,SFMono-Regular,Menlo,monospace; }
details.case { border-top:1px solid var(--grid); } details.case:first-of-type { border-top:0; }
details.case summary { cursor:pointer; padding:10px 0; display:flex; flex-wrap:wrap; gap:6px 16px; justify-content:space-between; }
.tname { font-size:13px; min-width:0; word-break:break-word; } .sum { font-size:13px; display:flex; gap:8px; flex-wrap:wrap; align-items:center; }
.case-body { padding:0 0 12px 12px; border-left:2px solid var(--grid); }
ul.ev { margin:6px 0; padding-left:18px; font-size:13px; } ul.ev li { margin:5px 0; } .src { font-size:11px; text-transform:uppercase; letter-spacing:.04em; color:var(--muted); } .why { color:var(--ink-2); }
footer { font-size:12px; color:var(--muted); margin-top:24px; }
@media (max-width:720px) { .grid2 { grid-template-columns:1fr; } }
</style>
</head>
<body>
<main>
<h1>CI Triage Agent Report</h1>
<p class="lede">Classifies a failing test as product bug, flaky test, environment issue or test gap. Shadow mode: it reports, a human decides. <a href="../">Back to the QA metrics dashboard</a>.</p>
<div class="meta">${sha ? `Commit <a href="${repoUrl}/commit/${esc(env.GITHUB_SHA)}">${sha}</a> · ` : ''}${runUrl ? `<a href="${runUrl}">CI run ${esc(env.GITHUB_RUN_ID)}</a> · ` : ''}Prompt ${esc(ev.promptVersion)} · model ${esc(ev.model)}${repoUrl ? ` · <a href="${repoUrl}/blob/main/agentic/AGENT-DESIGN.md">Design</a>` : ''}</div>
${banner}

<section class="card">
  <h2>Evaluation</h2>
  <p class="card-sub">${ev.total} labelled cases, ${ev.runsPerCase} run each. Eval ran ${esc(fmtDate(ev.ranAt))} (${ev.source === 'ci' ? 'in CI' : 'locally'}).</p>
  <div class="kpis">
    ${tile('Accuracy', `${pct(ev.correct, ev.total)}%`, `${ev.correct} of ${ev.total} classified correctly`)}
    ${tile('Known defect matched', `${ev.knownDefect.matched}/${ev.knownDefect.total}`, 'cases where the right DEF-xx was named')}
    ${tile('Real bugs called flaky', String(ev.falseFlaky), 'the costly mistake: it hides bugs')}
    ${tile('Model time', `${Math.round(ev.modelSeconds)}s`, `${(ev.modelSeconds / Math.max(1, ev.total * ev.runsPerCase)).toFixed(1)}s per failure`)}
  </div>
  <div class="table-wrap" style="margin-top:14px"><table><caption class="small" style="text-align:left">Success bar, set before the first run</caption><tbody>${barRows}</tbody></table></div>
</section>

${triageSection()}

<section class="card">
  <h2>Every case</h2>
  <p class="card-sub">Open a row to see the evidence the agent quoted, the runner-up it rejected and the action it proposed.</p>
  ${caseRows}
</section>

<div class="grid2" style="margin-top:16px">
<section class="card">
  <h2>Confusion matrix</h2>
  <p class="card-sub">Rows are the expected class, columns what the agent answered.</p>
  <div class="table-wrap"><table><thead><tr><th></th>${classes.map(c => `<th class="num">${esc(label(c))}</th>`).join('')}</tr></thead><tbody>${matrixRows}</tbody></table></div>
</section>
<section class="card">
  <h2>Confidence calibration</h2>
  <p class="card-sub">When the agent says high, is it right?</p>
  <div class="table-wrap"><table><thead><tr><th>Confidence</th><th class="num">Answers</th><th class="num">Correct</th></tr></thead><tbody>${ev.calibration.map(c => `<tr><td>${esc(c.l)}</td><td class="num">${c.n}</td><td class="num">${c.ok}</td></tr>`).join('')}</tbody></table></div>
  <div class="table-wrap" style="margin-top:12px"><table><thead><tr><th>Class</th><th class="num">Cases</th><th class="num">Precision</th><th class="num">Recall</th></tr></thead><tbody>${ev.perClass.map(p => `<tr><td>${esc(label(p.c))}</td><td class="num">${p.actual}</td><td class="num">${esc(p.precision)}</td><td class="num">${esc(p.recall)}</td></tr>`).join('')}</tbody></table></div>
</section>
</div>

<section class="card">
  <h2>How far to trust this</h2>
  <ul class="small">
    <li><b>${ev.total} cases is directional</b>, not statistically strong. Read the cases, not just the percentage.</li>
    <li><b>${constructedN} of ${ev.total} cases are constructed</b> in Playwright's real error format; only ${ev.total - constructedN} use error text captured from a real run. Real CI failures will be messier.</li>
    <li><b>The prompt was tuned on these same cases</b> (v1 scored 12/14, the fixes were made after seeing the misses), so the score is not a held-out result.</li>
    <li><b>Only the class and the known-defect match are scored.</b> The proposed next action and owning pod are suggestions.</li>
    <li>Not measured yet: agreement between the agent and a human reviewer in shadow mode.</li>
  </ul>
</section>

<footer>Built by <code>agentic/report/build.mjs</code> from the eval output and this run's Playwright results.</footer>
</main>
</body>
</html>
`;

mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'index.html'), html);

if (summaryPath) {
  const lines = [
    '## CI triage agent',
    '',
    `Eval ${fresh ? 're-run in this build' : `**not** re-run (last committed result, ${fmtDate(ev.ranAt)})`}: **${ev.correct}/${ev.total}** correct (prompt ${ev.promptVersion}, ${ev.model}). ${ev.bar.map(b => `${b.pass ? 'PASS' : 'FAIL'}: ${b.name}`).join(' · ')}`,
    '',
  ];
  if (!tr) lines.push('No triage output in this build.');
  else if (tr.totalFailing === 0) lines.push('No failing or flaky tests in this run.');
  else {
    lines.push(`${tr.totalFailing} failing or flaky test(s), ${tr.triaged} triaged (${tr.mode}). Shadow mode: suggestions only.`, '', '| Test | Result | Confidence | Next action |', '|---|---|---|---|');
    for (const e of tr.entries) {
      const r = e.outcome?.result;
      lines.push(`| ${e.testName.replace(/\|/g, '\\|')} | ${r ? `${label(r.classification)}${r.known_defect ? ` (${r.known_defect})` : ''}${r.needs_human ? ', needs a human' : ''}` : 'not classified'} | ${r ? r.confidence : '-'} | ${r ? `${r.next_action.type.replace('_', ' ')} · ${r.next_action.owner_pod}` : '-'} |`);
    }
  }
  writeFileSync(resolve(summaryPath), lines.join('\n') + '\n');
}
console.log(`Agent report -> ${join(outDir, 'index.html')} | eval ${ev.correct}/${ev.total} (${fresh ? 'fresh' : 'committed'}) | ${tr ? `${tr.totalFailing} failing, ${tr.triaged} triaged (${tr.mode})` : 'no triage file'}`);
