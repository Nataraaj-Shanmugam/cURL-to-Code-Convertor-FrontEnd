#!/usr/bin/env node
/**
 * Repo hygiene checks, run by CI (`npm run check:docs`). Each check guards a drift that has already
 * happened once:
 *
 *  - every VITE_* variable that src/lib/env.ts reads is documented in README.md;
 *  - the stale planning files stay deleted;
 *  - .claude/settings.local.json (machine-specific) is not tracked by git;
 *  - ci.yml runs the gates the release depends on (coverage, mocked e2e, bundle budgets) and keeps
 *    the live e2e job optional (continue-on-error), since it needs a private backend checkout;
 *  - docs/RELEASE.md exists.
 *
 *   node scripts/check-docs-ci.mjs [repoRoot]   (defaults to the repository this file lives in)
 */
import { existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';

const root = resolve(process.argv[2] ?? join(dirname(fileURLToPath(import.meta.url)), '..'));
const failures = [];
const read = (rel) => readFileSync(join(root, rel), 'utf8');

// 1. Every VITE_* name read in env.ts is documented in the README.
const envSource = read('src/lib/env.ts');
const readVars = [...new Set(envSource.match(/VITE_[A-Z0-9_]+/g) ?? [])];
const readme = read('README.md');
for (const name of readVars) {
  if (!readme.includes(name)) failures.push(`README.md does not document ${name} (read in src/lib/env.ts)`);
}

// 2. Stale planning files stay removed.
for (const stale of ['TODO.md', 'TODO_NEWFEATURE.md', 'DESIGN_REVIEW.md', 'Refactoring.txt']) {
  if (existsSync(join(root, stale))) failures.push(`${stale} is stale and should be deleted`);
}

// 3. Machine-specific settings are not tracked (and are ignored).
const gitignore = read('.gitignore');
if (!/^\.claude\/settings\.local\.json$/m.test(gitignore)) failures.push('.gitignore does not ignore .claude/settings.local.json');
try {
  const tracked = execFileSync('git', ['-C', root, 'ls-files', '.claude/settings.local.json'], { encoding: 'utf8' }).trim();
  if (tracked) failures.push('.claude/settings.local.json is tracked by git; run `git rm --cached` on it');
} catch {
  // Not a git checkout (e.g. an exported archive): nothing to check.
}

// 4. CI runs the release gates; the live job is optional and checks out the private backend.
const ci = yaml.load(read('.github/workflows/ci.yml'));
const jobs = ci?.jobs ?? {};
const runs = (job) => (jobs[job]?.steps ?? []).map((s) => String(s.run ?? '')).join('\n');
const allRuns = Object.keys(jobs).map(runs).join('\n');
const required = [
  ['npm run test:coverage', 'coverage gate'],
  ['npm run test:e2e', 'mocked Playwright e2e'],
  ['perf:check -- --bundle-only', 'bundle budgets'],
];
for (const [needle, what] of required) {
  if (!allRuns.includes(needle)) failures.push(`ci.yml does not run the ${what} (${needle})`);
}
const liveJob = Object.entries(jobs).find(([, job]) =>
  (job.steps ?? []).some((s) => String(s.with?.repository ?? '').includes('cURL-to-Code-Convertor-BackEnd')),
);
if (!liveJob) {
  failures.push('ci.yml has no job that checks out the backend repository for the live e2e');
} else {
  const [name, job] = liveJob;
  if (job['continue-on-error'] !== true) failures.push(`ci.yml job "${name}" must set continue-on-error: true`);
  if (!allRuns.includes('npm run test:e2e:live')) failures.push('ci.yml does not run npm run test:e2e:live');
}

// 5. The release runbook exists.
if (!existsSync(join(root, 'docs/RELEASE.md'))) failures.push('docs/RELEASE.md is missing');

if (failures.length) {
  console.error(`check:docs FAILED (${failures.length}):\n  ${failures.join('\n  ')}`);
  process.exit(1);
}
console.log(`check:docs passed (${readVars.length} env variables documented, CI gates present)`);
