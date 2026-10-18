// Builds the QA metrics dashboard (a single static HTML page) from files in this repo:
//   ../test-cases/*.md            -> automation coverage ("Automation status" field)
//   ../test-cases/README.md       -> defects, severity, "Detected by"
//   test-results/results.json     -> pass rate, flaky rate, known-defect tests (Playwright JSON reporter)
//   history.json (optional)       -> previous CI runs, for the trend
//
// Usage: node dashboard/build.mjs [--results test-results/results.json] [--history in.json] [--out dist]
// No dependencies, so CI can run it without npm install.

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '../..');
const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : fallback;
};
const resultsPath = resolve(arg('results', join(here, '../test-results/results.json')));
const historyPath = arg('history', null);
const outDir = resolve(arg('out', join(here, 'dist')));

// ---------- 1. Test cases: automation coverage ----------

const FLOWS = [
  { file: 'checkout.md', name: 'Checkout' },
  { file: 'payment.md', name: 'Payment' },
  { file: 'cart.md', name: 'Cart' },
];
const STATUSES = ['Automated', 'Partial', 'Manual'];

const cases = FLOWS.flatMap(({ file, name }) => {
  const text = readFileSync(join(repo, 'test-cases', file), 'utf8');
  return text.split(/^## /m).slice(1).flatMap(block => {
    const head = block.match(/^(TC-[A-Z]+-\d+): (.+)$/m);
    const status = block.match(/^\| Automation status \| (\w+)/m);
    if (!head || !status) return [];
    if (!STATUSES.includes(status[1])) throw new Error(`${head[1]}: unknown status "${status[1]}"`);
    return [{ id: head[1], title: head[2].trim(), flow: name, status: status[1] }];
  });
});
if (!cases.length) throw new Error('No test cases parsed from test-cases/*.md');

// ---------- 2. Defects ----------

const plain = s => s.replace(/\*\*|`/g, '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').trim();
const readme = readFileSync(join(repo, 'test-cases', 'README.md'), 'utf8');
const defects = [...readme.matchAll(/^\| \*\*(DEF-\d+)\*\* \| (?:\*\*)?(S\d)(?:\*\*)? \| (.+?) \| (.+?) \| (TC-[A-Z]+-\d+) \|$/gm)].map(
  m => ({ id: m[1], severity: m[2], summary: plain(m[3]), detectedBy: m[4], testCase: m[5] })
);
if (!defects.length) throw new Error('No defects parsed from test-cases/README.md');

// ---------- 3. Playwright results ----------

let run = null;
if (existsSync(resultsPath)) {
  const report = JSON.parse(readFileSync(resultsPath, 'utf8'));
  const tests = [];
  const walk = (suite, file) => {
    for (const spec of suite.specs ?? [])
      for (const t of spec.tests)
        tests.push({
          title: spec.title,
          file: file ?? suite.file,
          project: t.projectName,
          expected: t.expectedStatus,
          status: t.status, // expected | unexpected | flaky | skipped
          defect: t.annotations?.find(a => a.type === 'fail')?.description,
        });
    for (const child of suite.suites ?? []) walk(child, file ?? suite.file);
  };
  report.suites.forEach(s => walk(s));

  const count = pred => tests.filter(pred).length;
  const executed = count(t => t.status !== 'skipped');
  const passed = count(t => t.status === 'expected' || t.status === 'flaky');
  const projects = [...new Set(tests.map(t => t.project))].map(p => {
    const mine = tests.filter(t => t.project === p);
    return {
      name: p,
      total: mine.length,
      passed: mine.filter(t => t.status === 'expected' && t.expected === 'passed').length,
      knownDefect: mine.filter(t => t.expected === 'failed').length,
      skipped: mine.filter(t => t.status === 'skipped').length,
      flaky: mine.filter(t => t.status === 'flaky').length,
      failed: mine.filter(t => t.status === 'unexpected').length,
    };
  });
  run = {
    startTime: report.stats.startTime,
    durationMs: report.stats.duration,
    total: tests.length,
    executed,
    passed,
    flaky: count(t => t.status === 'flaky'),
    failed: count(t => t.status === 'unexpected'),
    skipped: count(t => t.status === 'skipped'),
    passRate: executed ? passed / executed : 0,
    flakyRate: executed ? count(t => t.status === 'flaky') / executed : 0,
    knownDefectTests: tests.filter(t => t.expected === 'failed'),
    projects,
  };
}

// ---------- 4. History (CI runs) ----------

const env = process.env;
let history = [];
if (historyPath && existsSync(historyPath)) {
  try {
    history = JSON.parse(readFileSync(historyPath, 'utf8'));
  } catch {
    history = [];
  }
}
if (run && env.GITHUB_RUN_ID) {
  history = history.filter(h => h.runId !== env.GITHUB_RUN_ID);
  history.push({
    runId: env.GITHUB_RUN_ID,
    sha: (env.GITHUB_SHA ?? '').slice(0, 7),
    date: run.startTime,
    passRate: run.passRate,
    flakyRate: run.flakyRate,
    total: run.total,
  });
  history = history.slice(-50);
}

// ---------- 5. Metrics ----------

const byStatus = s => cases.filter(c => c.status === s).length;
const pct = (n, d) => (d ? Math.round((100 * n) / d) : 0);
const coverage = {
  total: cases.length,
  automated: byStatus('Automated'),
  partial: byStatus('Partial'),
  manual: byStatus('Manual'),
};
const caughtByAutomation = defects.filter(d => d.detectedBy === 'Automated suite').length;
const DETECTION = ['Automated suite', 'Manual probing', 'Manual exploration'];

// ---------- 6. Render ----------

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const repoUrl = env.GITHUB_REPOSITORY ? `${env.GITHUB_SERVER_URL}/${env.GITHUB_REPOSITORY}` : 'https://github.com/Vipulbh09/qa-assignment';
const runUrl = env.GITHUB_RUN_ID ? `${repoUrl}/actions/runs/${env.GITHUB_RUN_ID}` : null;
const sha = (env.GITHUB_SHA ?? '').slice(0, 7);

/** Horizontal stacked bar: segments [{label, value, cls}], 2px surface gaps, 4px round on the data end. */
function stackedBar(segments, total, rowLabel, scale = total) {
  let x = 0;
  const parts = segments.filter(s => s.value > 0);
  const rects = parts
    .map((s, i) => {
      const w = (100 * s.value) / scale;
      const last = i === parts.length - 1;
      const html = `<span class="seg ${s.cls}${last ? ' end' : ''}" style="left:${x}%;width:calc(${w}% - ${last ? 0 : 2}px)"
        tabindex="0" data-tip="${esc(`${rowLabel}: ${s.label} ${s.value} of ${total} (${pct(s.value, total)}%)`)}">${
        w >= 12 ? `<span class="seg-label">${s.value}</span>` : ''
      }</span>`;
      x += w;
      return html;
    })
    .join('');
  return `<div class="bar" role="img" aria-label="${esc(
    `${rowLabel}: ` + parts.map(s => `${s.label} ${s.value}`).join(', ')
  )}">${rects}</div>`;
}

const coverageRows = FLOWS.map(({ name }) => {
  const mine = cases.filter(c => c.flow === name);
  const segs = [
    { label: 'Automated', value: mine.filter(c => c.status === 'Automated').length, cls: 'ord-1' },
    { label: 'Partial', value: mine.filter(c => c.status === 'Partial').length, cls: 'ord-2' },
    { label: 'Manual', value: mine.filter(c => c.status === 'Manual').length, cls: 'ord-3' },
  ];
  return `<div class="row"><span class="row-label">${name}</span>${stackedBar(segs, mine.length, name)}<span class="row-total">${mine.length}</span></div>`;
}).join('');

const detectionSegs = [
  { label: 'Automated suite', value: caughtByAutomation, cls: 'accent' },
  { label: 'Manual probing', value: defects.filter(d => d.detectedBy === 'Manual probing').length, cls: 'muted-1' },
  { label: 'Manual exploration', value: defects.filter(d => d.detectedBy === 'Manual exploration').length, cls: 'muted-2' },
];

const severityRows = [['All defects', defects], ...['S1', 'S2', 'S3'].map(sv => [{ S1: 'Critical (S1)', S2: 'Serious (S2)', S3: 'Minor (S3)' }[sv], defects.filter(d => d.severity === sv)])]
  .map(([label, list]) => {
    const segs = detectionSegs.map(s => ({ ...s, value: list.filter(d => d.detectedBy === s.label).length }));
    return `<div class="row"><span class="row-label">${label}</span>${stackedBar(segs, list.length, label, defects.length)}<span class="row-total">${list.length}</span></div>`;
  })
  .join('');

// bugs/DEF-xx-<slug>.md -> link target for each defect id
const bugFiles = existsSync(join(repo, 'bugs')) ? readdirSync(join(repo, 'bugs')).filter(f => /^DEF-\d+-.*\.md$/.test(f)) : [];
const bugLink = id => {
  const f = bugFiles.find(x => x.startsWith(`${id}-`));
  return f ? `<a href="${repoUrl}/blob/main/bugs/${f}">${id}</a>` : id;
};

const SEV = { S1: ['critical', 'Critical', '!!'], S2: ['serious', 'Serious', '!'], S3: ['warning', 'Minor', '•'] };
const knownByDefect = id => run?.knownDefectTests.filter(t => t.defect === id) ?? [];
const defectRows = defects
  .map(d => {
    const tests = knownByDefect(d.id);
    const fixed = tests.some(t => t.status === 'unexpected');
    const state = !run
      ? '<span class="muted">no run data</span>'
      : fixed
      ? '<span class="state good">✓ Test now passes: fixed?</span>'
      : tests.length
      ? `<span class="state">Open · ${tests.length} test${tests.length > 1 ? 's' : ''}</span>`
      : '<span class="state">Open · fixme</span>';
    const [cls, label, icon] = SEV[d.severity] ?? ['warning', d.severity, '•'];
    return `<tr><td class="mono">${bugLink(d.id)}</td><td><span class="sev ${cls}"><span class="sev-icon" aria-hidden="true">${icon}</span>${d.severity} ${label}</span></td>
      <td>${esc(d.summary)}</td><td><span class="dot ${detectionSegs.find(s => s.label === d.detectedBy)?.cls ?? 'muted-1'}"></span>${esc(d.detectedBy)}</td>
      <td class="mono">${d.testCase}</td><td>${state}</td></tr>`;
  })
  .join('');

const caseRows = cases
  .map(
    c => `<tr><td class="mono">${c.id}</td><td>${esc(c.title)}</td><td>${c.flow}</td><td><span class="dot ${
      { Automated: 'ord-1', Partial: 'ord-2', Manual: 'ord-3' }[c.status]
    }"></span>${c.status}</td></tr>`
  )
  .join('');

const projectRows = (run?.projects ?? [])
  .map(
    p => `<tr><td class="mono">${p.name}</td><td class="num">${p.total}</td><td class="num">${p.passed}</td><td class="num">${p.knownDefect}</td><td class="num">${p.skipped}</td><td class="num">${p.flaky}</td><td class="num">${p.failed}</td></tr>`
  )
  .join('');

function trendChart() {
  const pts = history.filter(h => typeof h.passRate === 'number');
  if (pts.length < 2)
    return `<p class="muted">The trend starts with the first CI run that publishes this page; it appears once there are two runs. ${
      pts.length ? `1 run recorded (${Math.round(pts[0].passRate * 100)}% pass rate).` : ''
    }</p>`;
  const W = 640, H = 160, L = 36, R = 12, T = 12, B = 24;
  const xs = i => L + ((W - L - R) * i) / (pts.length - 1);
  const ys = v => T + (H - T - B) * (1 - v);
  const path = pts.map((p, i) => `${i ? 'L' : 'M'}${xs(i).toFixed(1)},${ys(p.passRate).toFixed(1)}`).join(' ');
  const grid = [0, 0.5, 1]
    .map(v => `<line x1="${L}" x2="${W - R}" y1="${ys(v)}" y2="${ys(v)}" class="grid"/><text x="${L - 6}" y="${ys(v) + 4}" class="tick" text-anchor="end">${v * 100}%</text>`)
    .join('');
  const dots = pts
    .map(
      (p, i) => `<circle cx="${xs(i)}" cy="${ys(p.passRate)}" r="4" class="pt" tabindex="0"
        data-tip="${esc(`Run ${p.runId} · ${p.sha} · ${new Date(p.date).toISOString().slice(0, 16).replace('T', ' ')} UTC · pass ${(p.passRate * 100).toFixed(1)}% · flaky ${(p.flakyRate * 100).toFixed(1)}%`)}"/>`
    )
    .join('');
  return `<svg viewBox="0 0 ${W} ${H}" class="trend" role="img" aria-label="CI pass rate over the last ${pts.length} runs">${grid}<path d="${path}" class="line"/>${dots}
    <text x="${W - R}" y="${H - 6}" class="tick" text-anchor="end">latest</text><text x="${L}" y="${H - 6}" class="tick">${pts.length} runs ago</text></svg>`;
}

const tile = (label, value, sub) =>
  `<div class="tile"><div class="tile-label">${label}</div><div class="tile-value">${value}</div><div class="tile-sub">${sub}</div></div>`;

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>QA Metrics Dashboard</title>
<meta name="description" content="Automation coverage, defects and CI results for the Astronomy Shop QA assignment, generated from the repo on every CI run.">
<style>
:root {
  color-scheme: light;
  --page: #f9f9f7; --surface: #fcfcfb; --ink: #0b0b0b; --ink-2: #52514e; --muted: #898781;
  --grid: #e1e0d9; --axis: #c3c2b7; --ring: rgba(11,11,11,0.10);
  --accent: #2a78d6; --ord-1: #184f95; --ord-2: #3987e5; --ord-3: #86b6ef;
  --gray-1: #a9a7a0; --gray-2: #d3d1c8; --good: #006300;
  --label-on-dark: #fff; --label-ord-1: #fff; --label-ord-3: #0b0b0b;
  --critical: #d03b3b; --serious: #ec835a; --warning: #fab219;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    color-scheme: dark;
    --page: #0d0d0d; --surface: #1a1a19; --ink: #f0efec; --ink-2: #c3c2b7; --muted: #898781;
    --grid: #2c2c2a; --axis: #383835; --ring: rgba(255,255,255,0.10);
    --accent: #3987e5; --ord-1: #86b6ef; --ord-2: #3987e5; --ord-3: #184f95;
    --gray-1: #6e6d68; --gray-2: #454542; --good: #0ca30c;
    --label-on-dark: #fff; --label-ord-1: #0b0b0b; --label-ord-3: #fff;
  }
}
:root[data-theme="dark"] {
  color-scheme: dark;
  --page: #0d0d0d; --surface: #1a1a19; --ink: #f0efec; --ink-2: #c3c2b7; --muted: #898781;
  --grid: #2c2c2a; --axis: #383835; --ring: rgba(255,255,255,0.10);
  --accent: #3987e5; --ord-1: #86b6ef; --ord-2: #3987e5; --ord-3: #184f95;
  --gray-1: #6e6d68; --gray-2: #454542; --good: #0ca30c;
  --label-on-dark: #fff; --label-ord-1: #0b0b0b; --label-ord-3: #fff;
}
* { box-sizing: border-box; }
body { margin: 0; background: var(--page); color: var(--ink); font: 15px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif; }
main { max-width: 1040px; margin: 0 auto; padding: 32px 16px 64px; }
a { color: var(--accent); }
h1 { font-size: 26px; margin: 0 0 4px; font-weight: 650; }
h2 { font-size: 17px; margin: 0 0 4px; font-weight: 600; }
.lede, .muted, .tile-sub, .card-sub { color: var(--ink-2); }
.muted { color: var(--muted); }
.meta { font-size: 13px; color: var(--ink-2); margin-bottom: 24px; }
.card { background: var(--surface); border: 1px solid var(--ring); border-radius: 12px; padding: 20px; margin-top: 16px; }
.card-sub { font-size: 13px; margin: 0 0 16px; }
.hero { display: grid; grid-template-columns: minmax(220px, 1fr) 2fr; gap: 16px; }
.hero-figure { font-size: 56px; font-weight: 650; line-height: 1.05; }
.kpis { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
.tile { border: 1px solid var(--ring); border-radius: 10px; padding: 12px 14px; }
.tile-label { font-size: 13px; color: var(--ink-2); }
.tile-value { font-size: 28px; font-weight: 600; }
.tile-sub { font-size: 12px; }
.row { display: grid; grid-template-columns: 96px 1fr 28px; align-items: center; gap: 12px; margin: 10px 0; }
.row-label { font-size: 14px; }
.row-total { font-size: 13px; color: var(--muted); text-align: right; font-variant-numeric: tabular-nums; }
.bar { position: relative; height: 24px; }
.seg { position: absolute; top: 0; bottom: 0; outline-offset: 2px; display: flex; align-items: center; justify-content: center; }
.seg.end { border-radius: 0 4px 4px 0; }
.seg-label { font-size: 12px; font-weight: 600; color: var(--label-on-dark); }
.ord-1 .seg-label { color: var(--label-ord-1); } .ord-3 .seg-label { color: var(--label-ord-3); }
.ord-1 { background: var(--ord-1); } .ord-2 { background: var(--ord-2); } .ord-3 { background: var(--ord-3); }
.accent { background: var(--accent); } .muted-1 { background: var(--gray-1); } .muted-2 { background: var(--gray-2); }
.muted-1 .seg-label, .muted-2 .seg-label { color: var(--ink); }
.legend { display: flex; flex-wrap: wrap; gap: 16px; font-size: 13px; color: var(--ink-2); margin-top: 8px; }
.dot { display: inline-block; width: 10px; height: 10px; border-radius: 3px; margin-right: 6px; vertical-align: -1px; }
.grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.grid2 .card { margin-top: 0; }
.grid2 > *, .hero > *, .kpis > * { min-width: 0; }
table { width: 100%; border-collapse: collapse; font-size: 13px; }
th { text-align: left; font-weight: 600; color: var(--ink-2); border-bottom: 1px solid var(--axis); padding: 6px 8px; }
td { border-bottom: 1px solid var(--grid); padding: 7px 8px; vertical-align: top; }
td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; }
.mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; white-space: nowrap; }
.table-wrap { overflow-x: auto; }
.sev { display: inline-flex; align-items: center; gap: 6px; white-space: nowrap; }
.sev-icon { display: inline-flex; align-items: center; justify-content: center; min-width: 18px; height: 18px; border-radius: 9px; font-size: 11px; font-weight: 700; color: #0b0b0b; }
.sev.critical .sev-icon { background: var(--critical); color: #fff; } .sev.serious .sev-icon { background: var(--serious); } .sev.warning .sev-icon { background: var(--warning); }
.state { color: var(--ink-2); } .state.good { color: var(--good); font-weight: 600; }
.trend { width: 100%; height: auto; }
.trend .grid { stroke: var(--grid); stroke-width: 1; }
.trend .tick { fill: var(--muted); font-size: 11px; }
.trend .line { fill: none; stroke: var(--accent); stroke-width: 2; stroke-linejoin: round; stroke-linecap: round; }
.trend .pt { fill: var(--accent); stroke: var(--surface); stroke-width: 2; }
.na { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
.na div { border: 1px dashed var(--axis); border-radius: 10px; padding: 12px 14px; font-size: 13px; color: var(--ink-2); }
.na b { color: var(--ink); display: block; margin-bottom: 2px; }
details summary { cursor: pointer; font-size: 13px; color: var(--accent); margin-top: 12px; }
#tip { position: fixed; pointer-events: none; background: var(--ink); color: var(--surface); font-size: 12px; padding: 6px 8px; border-radius: 6px; max-width: 320px; opacity: 0; transition: opacity .1s; z-index: 10; }
footer { font-size: 12px; color: var(--muted); margin-top: 24px; }
@media (max-width: 720px) {
  .hero, .grid2, .na, .kpis { grid-template-columns: 1fr; }
  .hero-figure { font-size: 48px; }
}
</style>
</head>
<body>
<main>
<h1>QA Metrics Dashboard</h1>
<p class="lede">OpenTelemetry Astronomy Shop · generated from this repo's test cases, defect log and Playwright results on every CI run.</p>
<div class="meta">${
  sha ? `Commit <a href="${repoUrl}/commit/${env.GITHUB_SHA}">${sha}</a> · ` : ''
}${runUrl ? `<a href="${runUrl}">CI run ${env.GITHUB_RUN_ID}</a> · ` : ''}${
  run ? `Tests ran ${esc(new Date(run.startTime).toUTCString())}` : 'No test results in this build'
} · <a href="agent/">CI triage agent report</a> · <a href="${repoUrl}">Repository</a></div>

<section class="card hero">
  <div>
    <div class="tile-label">Automation coverage</div>
    <div class="hero-figure">${pct(coverage.automated, coverage.total)}%</div>
    <div class="tile-sub">${coverage.automated} of ${coverage.total} test cases fully automated · ${pct(
  coverage.automated + coverage.partial,
  coverage.total
)}% with the main path automated</div>
  </div>
  <div class="kpis">
    ${tile('Bugs caught by automation', `${pct(caughtByAutomation, defects.length)}%`, `${caughtByAutomation} of ${defects.length} defects were first found by a failing automated test`)}
    ${run ? tile('CI pass rate (latest run)', `${(run.passRate * 100).toFixed(run.passRate === 1 ? 0 : 1)}%`, `${run.passed} of ${run.executed} executed · known-defect tests count as passing while the bug exists`) : tile('CI pass rate', 'n/a', 'No results file')}
    ${run ? tile('Flaky rate', `${(run.flakyRate * 100).toFixed(run.flaky ? 1 : 0)}%`, `${run.flaky} test${run.flaky === 1 ? '' : 's'} passed only on retry`) : tile('Flaky rate', 'n/a', 'No results file')}
    ${tile('Open defects', defects.length, `${defects.filter(d => d.severity === 'S1').length} critical · tracked by ${run ? run.knownDefectTests.length : '—'} known-defect tests`)}
  </div>
</section>

<div class="grid2" style="margin-top:16px">
<section class="card">
  <h2>Automation coverage by flow</h2>
  <p class="card-sub">From the “Automation status” field of each test case in <code>test-cases/</code>.</p>
  ${coverageRows}
  <div class="legend"><span><span class="dot ord-1"></span>Automated</span><span><span class="dot ord-2"></span>Partial (main path automated, a human step remains)</span><span><span class="dot ord-3"></span>Manual</span></div>
  <details><summary>Show the ${cases.length} test cases</summary><div class="table-wrap"><table><thead><tr><th>ID</th><th>Test case</th><th>Flow</th><th>Status</th></tr></thead><tbody>${caseRows}</tbody></table></div></details>
</section>

<section class="card">
  <h2>How each defect was first found</h2>
  <p class="card-sub">From the “Detected by” column in <code>test-cases/README.md</code>, split by severity. Exploration found both critical defects; automation found the subtle ones.</p>
  ${severityRows}
  <div class="legend">${detectionSegs.map(s => `<span><span class="dot ${s.cls}"></span>${s.label} (${s.value})</span>`).join('')}</div>
</section>
</div>

<section class="card">
  <h2>Defects and their regression tests</h2>
  <p class="card-sub">Each defect has a report with steps to reproduce (click the ID) and a test asserting the correct behaviour, wrapped in <code>test.fail()</code>. “Open · 2 tests” means two tests still fail as expected. When a bug is fixed, its test starts passing and the status changes here. DEF-10 is intermittent, so it is a <code>fixme</code> instead.</p>
  <div class="table-wrap"><table><thead><tr><th>ID</th><th>Severity</th><th>Defect</th><th>Detected by</th><th>Test case</th><th>Status</th></tr></thead><tbody>${defectRows}</tbody></table></div>
</section>

<div class="grid2" style="margin-top:16px">
<section class="card">
  <h2>CI pass rate over time</h2>
  <p class="card-sub">Main-branch and nightly runs against a fresh Docker Compose stack.</p>
  ${trendChart()}
</section>
<section class="card">
  <h2>Latest run by project</h2>
  <p class="card-sub">${run ? `${run.total} tests · ${(run.durationMs / 1000).toFixed(0)}s` : 'No results file in this build.'}</p>
  <div class="table-wrap"><table><thead><tr><th>Project</th><th class="num">Tests</th><th class="num">Passed</th><th class="num">Known defect</th><th class="num">Skipped</th><th class="num">Flaky</th><th class="num">Failed</th></tr></thead><tbody>${projectRows}</tbody></table></div>
</section>
</div>

<section class="card">
  <h2>Not measurable in this setting</h2>
  <p class="card-sub">Defined in <code>test-strategy.md</code> §6. Shown here instead of inventing numbers.</p>
  <div class="na">
    <div><b>Defect leakage</b>Bugs found in a later stage ÷ all bugs for a release. Needs releases and stage-tagged bugs.</div>
    <div><b>Escaped defects</b>Production bugs per release, by severity. There is no production here.</div>
    <div><b>Pass rate: staging and production</b>Only an ephemeral CI stack exists. Production would come from the synthetic checkout suite.</div>
    <div><b>Mean time to triage</b>CI red to classified. Would come from the CI triage agent's timestamps (see <code>agentic/</code>).</div>
  </div>
</section>

<footer>Built by <code>automation/dashboard/build.mjs</code>. Every number on this page is computed from a file in the repository.</footer>
</main>
<div id="tip" role="tooltip"></div>
<script>
const tip = document.getElementById('tip');
const show = (el, x, y) => { tip.textContent = el.dataset.tip; tip.style.opacity = 1; tip.style.left = Math.min(x + 12, innerWidth - tip.offsetWidth - 8) + 'px'; tip.style.top = (y + 14) + 'px'; };
document.querySelectorAll('[data-tip]').forEach(el => {
  el.addEventListener('mousemove', e => show(el, e.clientX, e.clientY));
  el.addEventListener('mouseleave', () => (tip.style.opacity = 0));
  el.addEventListener('focus', () => { const r = el.getBoundingClientRect(); show(el, r.left, r.bottom); });
  el.addEventListener('blur', () => (tip.style.opacity = 0));
});
</script>
</body>
</html>
`;

mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'index.html'), html);
writeFileSync(join(outDir, 'history.json'), JSON.stringify(history, null, 2));
writeFileSync(
  join(outDir, 'metrics.json'),
  JSON.stringify({ coverage, defects: { total: defects.length, caughtByAutomation }, run: run && { ...run, knownDefectTests: undefined } }, null, 2)
);
console.log(
  `Dashboard -> ${join(outDir, 'index.html')} | coverage ${coverage.automated}/${coverage.total} | defects ${defects.length} (automation ${caughtByAutomation})` +
    (run ? ` | pass ${(run.passRate * 100).toFixed(1)}% flaky ${run.flaky}` : ' | no results')
);
