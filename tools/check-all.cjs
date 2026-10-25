// Run suites sequentially so rendering/timing checks do not compete for the CPU.
const { spawnSync } = require('node:child_process');
const { readdirSync, readFileSync } = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const suites = ['lifecycle', 'teleport', 'journey', 'projects', 'stations', 'about', 'contact', 'bubbles'];
const comparisons = ['appearance', 'styles']; // require PORTFOLIO_BASELINE_URL
const requested = process.argv.slice(2);
if (requested.some(name => ![...suites, ...comparisons].includes(name))) {
  console.error(`Choose from: ${suites.join(', ')}, ${comparisons.join(', ')} (require PORTFOLIO_BASELINE_URL)`);
  process.exit(1);
}
function run(command, args, options = {}) {
  const result = spawnSync(command, args, { cwd: root, stdio: 'inherit', env: process.env, ...options });
  if (result.error) console.error(result.error.message);
  if (result.status !== 0) {
    if (options.input) console.error(`${args.at(-1)}: ${result.stderr}`);
    process.exit(result.status || 1);
  }
}
const files = (directory, pattern) => readdirSync(path.join(root, directory), { recursive: true })
  .filter(name => pattern.test(name)).map(name => path.join(directory, name));

run('python3', ['-B', 'tools/check-assets.py']);
for (const file of files('tools', /\.cjs$/)) run(process.execPath, ['--check', file]);
// Without a package type, Node may accept invalid module syntax: force ESM parsing.
for (const file of files('dist/js', /\.js$/)) {
  run(process.execPath, ['--input-type=module', '--check', '-', file],
    { input: readFileSync(path.join(root, file)), stdio: ['pipe', 'inherit', 'pipe'] });
}
for (const name of requested.length ? requested : suites) {
  console.log(`\nChecking ${name}…`);
  run(process.execPath, [`tools/check-${name}.cjs`]);
}
console.log('\nAll requested checks passed.');
