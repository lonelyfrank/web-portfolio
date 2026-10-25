// Run suites sequentially so rendering/timing checks do not compete for the CPU.
const { spawnSync } = require('node:child_process');
const { readdirSync } = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const suites = ['lifecycle', 'journey', 'projects', 'stations', 'about', 'contact', 'bubbles'];
const requested = process.argv.slice(2);
if (requested.some(name => ![...suites, 'appearance'].includes(name))) {
  console.error(`Choose from: ${suites.join(', ')}, appearance (requires PORTFOLIO_BASELINE_URL)`);
  process.exit(1);
}
function run(command, args) {
  const result = spawnSync(command, args, { cwd: root, stdio: 'inherit', env: process.env });
  if (result.error) console.error(result.error.message);
  if (result.status !== 0) process.exit(result.status || 1);
}
run('python3', ['-B', 'tools/check-assets.py']);
for (const directory of ['dist', 'tools']) {
  for (const file of readdirSync(path.join(root, directory)).filter(name => /\.(c?js)$/.test(name))) {
    run(process.execPath, ['--check', `${directory}/${file}`]);
  }
}
for (const name of requested.length ? requested : suites) {
  console.log(`\nChecking ${name}…`);
  run(process.execPath, [`tools/check-${name}.cjs`]);
}
console.log('\nAll requested checks passed.');
