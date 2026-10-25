// Optional before/after comparison against a separately served original checkout.
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { chromium, url, shots, browserOptions } = require('./browser-settings.cjs');
const baseline = process.env.PORTFOLIO_BASELINE_URL;
assert.ok(baseline, 'Set PORTFOLIO_BASELINE_URL to the original site served locally');

(async () => {
  const browser = await chromium.launch(browserOptions);
  const names = [];
  try {
    for (const [version, address] of [['before', baseline], ['after', url]]) {
      for (const [width, mode] of [[1440, 'journey'], [1440, 'read'], [390, 'read']]) {
        const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
        await page.addInitScript(mode => localStorage.setItem('fs-mode', mode), mode);
        await page.goto(address);
        await page.evaluate(async () => {
          document.querySelectorAll('img').forEach(image => { image.loading = 'eager'; });
          await Promise.all([...document.images].filter(image => image.src).map(image => image.decode()));
          await document.fonts.ready;
        });
        for (const section of ['home', 'about', 'projects', 'contact']) {
          await page.locator(`.site-nav [href="#${section}"]`).click();
          if (mode === 'journey') await page.waitForFunction(section => document.querySelector('.page.active').id === section
            && document.querySelector('.journey-strip').dataset.phase === 'waiting', section);
          else await page.locator(`#${section}`).evaluate(node => node.scrollIntoView({ behavior: 'instant' }));
          await page.evaluate(() => document.activeElement.blur());
          const name = `${width}-${mode}-${section}`;
          if (version === 'before') names.push(name);
          if (mode === 'journey') await page.screenshot({ path: `${shots}/${name}-${version}.png` });
          else await page.locator(`#${section}`).screenshot({ path: `${shots}/${name}-${version}.png`,
            style: '.site-header, .skip { visibility: hidden !important; }' });
        }
        await page.close();
      }
    }
  } finally { await browser.close(); }
  const result = spawnSync('python3', ['-c', `
import sys
from pathlib import Path
from PIL import Image, ImageChops
folder = Path(sys.argv[1])
for name in sys.argv[2:]:
    with Image.open(folder / (name + '-before.png')) as before, Image.open(folder / (name + '-after.png')) as after:
        assert before.size == after.size, (name, before.size, after.size)
        bounds = ImageChops.difference(before.convert('RGB'), after.convert('RGB')).getbbox()
        assert bounds is None, (name, 'Different pixels in', bounds)
    print('Identical appearance:', name)
`, shots, ...names], { stdio: 'inherit' });
  assert.equal(result.status, 0, 'Review before/after screenshots');
})().catch(error => { console.error(error); process.exitCode = 1; });
