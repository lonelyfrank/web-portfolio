// Regression cases found during the full-project audit.
const assert = require('node:assert/strict');
const { chromium, url, browserOptions, setSystemMotion, trackErrors } = require('./browser-settings.cjs');

(async () => {
  const browser = await chromium.launch(browserOptions);
  const errors = [];
  const open = async options => {
    const page = await browser.newPage(options);
    trackErrors(page, errors);
    return page;
  };
  try {
    const page = await open({ viewport: { width: 1440, height: 900 } });
    await page.addInitScript(() => localStorage.setItem('fs-mode', 'invalid-old-value'));
    await page.goto(url);
    assert.equal(await page.locator('html').evaluate(n => n.classList.contains('journey')), true, 'Invalid stored mode falls back to viewport');
    const cancelled = await page.evaluate(async () => {
      const { director } = await import('./js/stage/director.js');
      const waiting = director.wait(10000).then(() => true);
      director.cancel();
      return Promise.race([waiting, new Promise(resolve => setTimeout(() => resolve(false), 100))]);
    });
    assert.equal(cancelled, true, 'Cancellation releases pending waits');

    await page.locator('.site-nav [href="#about"]').click();
    await page.waitForFunction(() => document.querySelector('.journey-strip').dataset.phase === 'approaching');
    await page.locator('[data-mode="read"]').click();
    assert.equal(await page.locator('.bay-lift, .bay-mount').evaluateAll(nodes => nodes.reduce((sum, node) => sum + node.getAnimations().length, 0)), 0, 'No abandoned lift animations in Reading');
    assert.equal(await page.locator('.page[hidden], .page[inert]').count(), 0);
    await page.locator('[data-mode="journey"]').click();
    await setSystemMotion(page, 'reduce');
    assert.equal(await page.locator('html').evaluate(n => getComputedStyle(n).scrollBehavior), 'auto');
    await page.locator('#motion').click();
    assert.equal(await page.locator('#motion').getAttribute('aria-pressed'), 'false');
    assert.notEqual(await page.locator('.ship-cargo').evaluate(n => getComputedStyle(n).animationName), 'none', 'Explicit motion preference updates CSS and JS together');
    await page.locator('#motion').click();
    await page.locator('.site-nav [href="#about"]').click();
    // hashchange is asynchronous and moves focus to the section title.
    await page.waitForFunction(() => document.querySelector('.page.active').id === 'about');
    await page.locator('.skip').focus();
    await page.locator('.skip').click();
    assert.equal(await page.locator('.page.active').getAttribute('id'), 'about', 'Skip link does not change section');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'content');
    await page.keyboard.press('Control+ArrowRight');
    assert.equal(await page.locator('.page.active').getAttribute('id'), 'about', 'Modified arrows remain native');
    await page.evaluate(() => {
      const main = document.querySelector('main');
      const start = new Touch({ identifier: 1, target: main, clientX: 300, clientY: 100 });
      const end = new Touch({ identifier: 1, target: main, clientX: 100, clientY: 100 });
      main.dispatchEvent(new TouchEvent('touchstart', { touches: [start] }));
      main.dispatchEvent(new TouchEvent('touchcancel'));
      main.dispatchEvent(new TouchEvent('touchend', { changedTouches: [end] }));
    });
    assert.equal(await page.locator('.page.active').getAttribute('id'), 'about', 'Cancelled touch does not navigate');

    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, value: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    assert.equal(await page.locator('.ship-cargo').evaluate(n => getComputedStyle(n).animationPlayState), 'paused');
    await page.evaluate(() => { delete document.hidden; document.dispatchEvent(new Event('visibilitychange')); });

    // A visible inner wrapper may have no scroll range while its page still does.
    await page.setViewportSize({ width: 720, height: 450 });
    await page.locator('.site-nav [href="#projects"]').click();
    await page.waitForFunction(() => document.querySelector('#projects').classList.contains('active'));
    const scroll = await page.evaluate(() => {
      const section = document.querySelector('#projects');
      section.scrollTop = 0;
      const event = new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: 100 });
      section.querySelector('.summary').dispatchEvent(event);
      return { prevented: event.defaultPrevented, range: section.scrollHeight - section.clientHeight };
    });
    assert.ok(scroll.range > 100);
    assert.equal(scroll.prevented, false, 'Wheel is available to the scrollable page ancestor');
    assert.equal(await page.locator('.page.active').getAttribute('id'), 'projects');
    await page.evaluate(() => {
      const section = document.querySelector('#projects');
      section.scrollTop = section.scrollHeight;
      section.querySelector('.summary').dispatchEvent(new WheelEvent('wheel', {
        bubbles: true, cancelable: true, deltaY: 6, deltaMode: WheelEvent.DOM_DELTA_LINE,
      }));
    });
    await page.waitForFunction(() => document.querySelector('.page.active').id === 'contact');

    // Stalled image decoding must release busy state and allow a subsequent retry.
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.locator('.site-nav [href="#projects"]').click();
    await page.clock.install();
    await page.evaluate(() => {
      window.originalDecode = HTMLImageElement.prototype.decode;
      HTMLImageElement.prototype.decode = () => new Promise(() => {});
    });
    await page.locator('#project-next').click();
    assert.equal(await page.locator('.project-carousel').getAttribute('aria-busy'), 'true');
    await page.clock.runFor(10050);
    assert.equal(await page.locator('.project-carousel').getAttribute('aria-busy'), null);
    assert.equal(await page.locator('.project-carousel').getAttribute('data-project'), 'project-1');
    assert.match(await page.locator('#project-status').textContent(), /non disponibile/);
    await page.locator('#project-next').click();
    await page.locator('[data-mode="read"]').click();
    assert.equal(await page.locator('.project-carousel').getAttribute('aria-busy'), null);
    await page.evaluate(() => { HTMLImageElement.prototype.decode = window.originalDecode; });
    await page.locator('[data-mode="journey"]').click();
    await page.locator('.site-nav [href="#projects"]').click();
    await page.locator('#project-next').click();
    await page.waitForFunction(() => document.querySelector('.project-carousel').dataset.project === 'project-2');
    assert.deepEqual(errors, []);
    console.log('PASS: stored mode, cancelled waits/lifts/touch, skip link, modified keys, hidden animations, nested scrolling, wheel units and image timeout/retry.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
