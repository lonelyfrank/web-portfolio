// Browser regression checks. Supply PLAYWRIGHT_MODULE / BROWSER_EXECUTABLE
// when Playwright is installed outside this buildless project.
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const url = process.env.PORTFOLIO_URL || 'http://127.0.0.1:8082';

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.BROWSER_EXECUTABLE || undefined });
  const errors = [];
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    page.on('pageerror', error => errors.push(error.message));
    page.on('response', response => {
      if (response.url().startsWith(url) && response.status() >= 400) errors.push(response.url());
    });
    assert.equal((await page.goto(url)).status(), 200);
    const nav = id => page.locator(`.site-nav a[href="#${id}"]`).click();
    const phase = name => page.waitForFunction(name => document.querySelector('.journey-world').dataset.phase === name, name);
    const ownership = async id => {
      assert.equal(await page.locator('.journey-world .composite-active').count(), 1);
      assert.equal(await page.locator(`#avatar`).evaluate(n => getComputedStyle(n).visibility), 'hidden');
      assert.equal(await page.locator(`.station-${id} .station-equipment`).evaluate(n => getComputedStyle(n).visibility), 'hidden');
      assert.equal(await page.locator(`.station-${id} .station-composite`).evaluate(n => getComputedStyle(n).display), 'block');
    };
    const geometry = async () => {
      const result = await page.evaluate(() => {
        const world = document.querySelector('.journey-world');
        const unit = document.querySelector('#avatar').offsetWidth / 128;
        const floor = world.getBoundingClientRect().bottom - parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--road-h'));
        const pads = [...world.querySelectorAll('.station-deck')].map(n => n.getBoundingClientRect());
        const rails = [...world.querySelectorAll('.route-rail')].map(n => n.getBoundingClientRect());
        return {
          floors: pads.map(p => Math.abs(p.top + 4 * unit - floor)),
          railOverlap: pads.some(p => rails.some(r => r.left < p.right && r.right > p.left)),
          overflow: document.documentElement.scrollWidth > innerWidth,
        };
      });
      assert.ok(result.floors.every(delta => delta < 1), JSON.stringify(result));
      assert.equal(result.railOverlap, false);
      assert.equal(result.overflow, false);
    };
    await geometry();
    assert.equal(await page.locator('.station-home .station-equipment').count(), 0);
    assert.equal(await page.locator('.station-projects').getAttribute('data-asset-status'), 'missing-projector');
    await page.waitForFunction(() => document.querySelector('#avatar').classList.contains('petting'), null, { timeout: 8000 });
    await nav('about');
    await phase('approaching');
    assert.equal(await page.locator('#avatar').evaluate(n => getComputedStyle(n).visibility), 'visible');
    await phase('interacting');
    await ownership('about');
    assert.equal(await page.locator('#avatar').evaluate(n => n.classList.contains('petting')), false);
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, value: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    const pausedFrame = await page.locator('.station-about').evaluate(n => n.style.getPropertyValue('--frame'));
    await page.waitForTimeout(500);
    assert.equal(await page.locator('.station-about').evaluate(n => n.style.getPropertyValue('--frame')), pausedFrame);
    await page.evaluate(() => {
      delete document.hidden;
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await page.screenshot({ path: '/tmp/stations-about-verified.png' });
    await phase('waiting');
    const aboutFrame = await page.locator('.station-about').evaluate(n => n.style.getPropertyValue('--frame'));
    await page.waitForTimeout(500);
    assert.notEqual(await page.locator('.station-about').evaluate(n => n.style.getPropertyValue('--frame')), aboutFrame);
    await nav('contact');
    await phase('approaching');
    assert.equal(await page.locator('.journey-world .composite-active').count(), 0);
    await phase('interacting');
    await ownership('contact');
    await phase('waiting');
    assert.equal(await page.locator('.station-contact').evaluate(n => n.style.getPropertyValue('--frame')), '7');
    await page.waitForTimeout(850);
    assert.equal(await page.locator('.station-contact').evaluate(n => n.style.getPropertyValue('--frame')), '7');
    await page.screenshot({ path: '/tmp/stations-contact-verified.png' });

    // Interrupt a composite, then retarget an in-progress walk, without teleporting.
    await nav('about');
    await phase('interacting');
    await nav('home');
    await page.waitForTimeout(150);
    const before = await page.locator('#avatar').evaluate(n => parseFloat(getComputedStyle(n).left));
    await nav('projects');
    const after = await page.locator('#avatar').evaluate(n => parseFloat(getComputedStyle(n).left));
    assert.ok(Math.abs(before - after) < 35, `Interrupted travel jumped ${before} -> ${after}`);
    await phase('waiting');
    assert.equal(await page.locator('#avatar').evaluate(n => getComputedStyle(n).visibility), 'visible');
    assert.equal(await page.locator('.journey-world .composite-active').count(), 0);

    await nav('contact');
    await phase('interacting');
    await page.locator('#motion').click();
    await phase('waiting');
    await ownership('contact');
    assert.equal(await page.locator('.station-contact').evaluate(n => n.style.getPropertyValue('--frame')), '7');
    await nav('about');
    await phase('waiting');
    await ownership('about');
    assert.equal(await page.locator('.station-about').evaluate(n => n.style.getPropertyValue('--frame')), '0');

    await page.locator('[data-mode="read"]').click();
    assert.equal(await page.locator('#about > .station-about').count(), 1);
    assert.equal(await page.locator('#contact > .station-contact').count(), 1);
    assert.equal(await page.locator('.station-about').count(), 1);
    await page.locator('[data-mode="journey"]').click();
    await geometry();
    for (const viewport of [{width: 1024, height: 700}, {width: 390, height: 844}, {width: 320, height: 568}]) {
      await page.setViewportSize(viewport);
      await nav('contact');
      await phase('waiting');
      await page.waitForTimeout(100);
      await ownership('contact');
      await geometry();
      const box = await page.locator('.station-contact').boundingBox();
      assert.ok(box.x >= 0 && box.x + box.width <= viewport.width);
      await nav('about');
      await phase('waiting');
      await ownership('about');
    }
    await page.screenshot({ path: '/tmp/stations-mobile-verified.png' });
    const mobile = await browser.newPage({ viewport: {width: 390, height: 844}, reducedMotion: 'reduce' });
    await mobile.goto(`${url}/#contact`);
    assert.equal(await mobile.locator('html').evaluate(n => n.classList.contains('journey')), false);
    assert.equal(await mobile.locator('.station-contact').count(), 1);
    assert.equal(await mobile.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await mobile.locator('[data-mode="journey"]').click();
    assert.equal(await mobile.locator('.journey-world').getAttribute('data-phase'), 'waiting');
    assert.equal(await mobile.locator('#avatar .avatar-sprite').evaluate(n => getComputedStyle(n).animationName), 'none');
    assert.deepEqual(errors, []);
    console.log('PASS: floor continuity, rail openings, single composite ownership, finite radio / looping desk, rapid retargeting, reduced motion, Reading and 1440/1024/390/320px layouts.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
