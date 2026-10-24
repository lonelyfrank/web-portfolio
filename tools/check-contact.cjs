// Contact layout, keyboard access, motion and scene independence.
// Uses the same local browser environment as check-stations.cjs.
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const url = process.env.PORTFOLIO_URL || 'http://127.0.0.1:8082';
const shots = process.env.SCREENSHOT_DIR || '/tmp';

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.BROWSER_EXECUTABLE || undefined });
  const errors = [];
  const open = async options => {
    const page = await browser.newPage(options);
    page.on('pageerror', e => errors.push(e.message));
    page.on('response', r => { if (r.url().startsWith(url) && r.status() >= 400) errors.push(r.url()); });
    return page;
  };
  try {
    for (const [width, height] of [[2560, 1440], [1920, 1080], [1920, 720], [1600, 900], [1440, 900], [1440, 640], [1366, 768], [1280, 800], [1280, 600], [1100, 700], [1024, 768], [1024, 600], [900, 600], [820, 900], [390, 844], [320, 568]]) {
      const page = await open({ viewport: { width, height } });
      await page.goto(`${url}/#contact`);
      await page.evaluate(() => document.fonts.ready);
      for (const mode of ['read', 'journey']) {
        await page.locator(`[data-mode="${mode}"]`).click();
        await page.locator('.site-nav a[href="#contact"]').click();
        const section = page.locator('#contact');
        await section.waitFor({ state: 'visible' });
        await page.waitForTimeout(350);
        assert.equal(await section.locator('.panel, .scenic, button, [data-placeholder]').count(), 0);
        assert.equal(await page.locator('[data-link="contact"]').count(), 0);
        assert.deepEqual(await section.locator('.contact-label').allTextContents(), ['GitHub', 'Email', 'LinkedIn', 'Scarica CV']);
        assert.equal(await section.locator('img:not([alt=""])').count(), 0);
        assert.equal(await section.locator('a[href="#"]').count(), 0);
        const layout = await section.evaluate(n => {
          const rect = el => {
            const r = el.getBoundingClientRect();
            return { x: r.x, y: r.y, right: r.right, bottom: r.bottom };
          };
          return {
            intro: rect(n.querySelector('.contact-intro')),
            items: [...n.querySelectorAll('.contact-channel')].map(rect),
            scene: n.querySelector('.station-contact') ? rect(n.querySelector('.station-contact')) : null,
            fits: n.scrollWidth <= n.clientWidth + 1,
            fitsHeight: n.scrollHeight <= n.clientHeight + 1,
            frame: rect(n),
            translate: getComputedStyle(n).translate,
            italic: getComputedStyle(n.querySelector('em')).fontStyle,
            mainSize: parseFloat(getComputedStyle(n.querySelector('h2')).fontSize),
            messageSize: parseFloat(getComputedStyle(n.querySelector('.contact-message')).fontSize),
          };
        });
        assert.ok(layout.fits, `${width} ${mode}: horizontal clipping`);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
        assert.equal(layout.italic, 'italic');
        assert.ok(layout.mainSize > layout.messageSize * 1.5);
        if (width > 1100 || (mode === 'journey' && width >= 900)) assert.ok(layout.intro.right < layout.items[0].x, 'Text has a separate left column');
        else assert.ok(layout.intro.bottom < layout.items[0].y, 'Text precedes contacts');
        if (width > 360) {
          assert.ok(layout.items[0].right < layout.items[1].x);
          assert.ok(Math.abs(layout.items[0].y - layout.items[1].y) < 1);
          assert.ok(layout.items[1].bottom < layout.items[2].y);
        } else layout.items.slice(1).forEach((r, i) => assert.ok(r.y > layout.items[i].bottom));
        if (mode === 'journey') {
          assert.equal(layout.translate, 'none');
          if (width >= 900) {
            assert.ok(layout.fitsHeight, `${width}×${height}: desktop Contact must fit without vertical scrolling`);
            assert.ok(layout.intro.bottom <= layout.frame.bottom, 'Entire message fits above the scene');
            assert.ok(layout.items.every(r => r.y >= layout.frame.y && r.bottom <= layout.frame.bottom), 'Every CTA is visible without scrolling');
            assert.equal(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 1), true, 'No desktop document scrolling');
            assert.equal(await section.evaluate(n => {
              n.scrollTop = 100;
              return n.scrollTop;
            }), 0, 'No hidden vertical scroll range');
          }
          await section.evaluate(n => { n.scrollTop = n.scrollHeight; });
          const last = await section.locator('.contact-channel').last().boundingBox();
          const main = await page.locator('main').boundingBox();
          const scene = await page.locator('.journey-strip').boundingBox();
          assert.ok(last.y + last.height <= main.y + main.height + 1, 'Last contact can scroll into view');
          assert.ok(main.y + main.height <= scene.y + 1, 'Scene stays below the content');
          await section.evaluate(n => { n.scrollTop = 0; });
        } else {
          assert.ok(layout.scene.y >= layout.items.at(-1).bottom, 'Reading scene follows the contacts');
        }
        const github = section.locator('a.contact-channel');
        assert.equal(await github.getAttribute('href'), 'https://github.com/lonelyfrank');
        assert.equal(await github.getAttribute('rel'), 'noopener noreferrer');
        // Missing destinations remain honest static content outside keyboard order.
        assert.equal(await section.locator('[data-unavailable]').count(), 3);
        await page.keyboard.press('Tab');
        await github.focus();
        assert.equal(await github.evaluate(n => n === document.activeElement && getComputedStyle(n).outlineStyle === 'solid'), true);
        await page.keyboard.press('Tab');
        assert.equal(await page.evaluate(() => !!document.activeElement.closest('#contact')), false);
        if ([1920, 1280, 390].includes(width)) {
          await page.evaluate(() => document.activeElement.blur());
          await section.evaluate(n => { n.scrollTop = 0; });
          if (mode === 'read') await section.screenshot({ path: `${shots}/contact-${width}-${mode}.png`, style: '.site-header, .skip { visibility: hidden !important; }' });
          else await page.screenshot({ path: `${shots}/contact-${width}-${mode}.png` });
        }
      }
      await page.close();
      console.log(`Contact OK: ${width}×${height}, Lettura / Viaggio`);
    }

    const page = await open({ viewport: { width: 1440, height: 900 } });
    await page.goto(`${url}/#contact`);
    const visual = page.locator('.contact-visual').first();
    const link = page.locator('a.contact-channel');
    const playState = () => visual.evaluate(n => getComputedStyle(n).animationPlayState);
    await page.waitForFunction(() => document.querySelector('.contact-visual').classList.contains('is-floating'));
    assert.equal(await playState(), 'running');
    const bounds = await link.boundingBox();
    await page.waitForTimeout(250);
    assert.deepEqual(await link.boundingBox(), bounds, 'Animated image must not move the target');
    await link.hover();
    assert.equal(await playState(), 'paused');
    const frozen = await visual.evaluate(n => getComputedStyle(n).transform);
    await page.waitForTimeout(200);
    assert.equal(await visual.evaluate(n => getComputedStyle(n).transform), frozen, 'Hover freezes at the current position');
    await page.mouse.move(0, 0);
    await link.focus();
    assert.equal(await playState(), 'paused');
    await page.keyboard.press('Tab');
    assert.equal(await playState(), 'running');
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, value: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    assert.equal(await playState(), 'paused');
    await page.evaluate(() => { delete document.hidden; document.dispatchEvent(new Event('visibilitychange')); });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    assert.equal(await visual.evaluate(n => getComputedStyle(n).animationName), 'none');
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.locator('#motion').click();
    assert.equal(await visual.evaluate(n => getComputedStyle(n).animationName), 'none');
    await page.locator('#motion').click();
    await page.locator('.site-nav a[href="#home"]').click();
    await page.waitForFunction(() => document.querySelector('#home').classList.contains('active')
      && getComputedStyle(document.querySelector('.contact-visual')).animationPlayState === 'paused');
    assert.equal(await playState(), 'paused');
    await page.locator('.site-nav a[href="#contact"]').click();
    await page.waitForFunction(() => document.querySelector('#contact').classList.contains('active')
      && document.querySelector('.journey-strip').dataset.phase === 'approaching');
    assert.equal(await link.evaluate(n => !!n.closest('[inert]')), false, 'Contact works during the journey');
    await page.locator('#contact').evaluate(n => { n.dataset.stage = 'off'; });
    assert.equal(await page.locator('.contact-layout').evaluate(n => getComputedStyle(n).opacity), '1');
    assert.equal(await page.locator('#contact').evaluate(n => getComputedStyle(n).translate), 'none');
    await page.locator('[data-mode="read"]').click();
    await page.locator('.site-nav a[href="#home"]').click();
    await page.waitForFunction(() => [...document.querySelectorAll('.contact-visual')].every(n => getComputedStyle(n).animationPlayState === 'paused'));
    await page.close();

    const noJS = await open({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
    await noJS.goto(`${url}/#contact`);
    assert.equal(await noJS.locator('.contact-label:visible').count(), 4);
    assert.equal(await noJS.locator('a.contact-channel').isVisible(), true);
    assert.equal(await noJS.locator('.contact-visual').first().evaluate(n => getComputedStyle(n).animationPlayState), 'paused');
    await noJS.close();
    assert.deepEqual(errors, []);
    console.log('Contact: focus, stationary targets, visibility, reduced motion, no-JS and browser errors OK');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
