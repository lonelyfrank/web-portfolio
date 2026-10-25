// Browser regression coverage for the holographic carousel and its scene lifecycle.
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const url = process.env.PORTFOLIO_URL || 'http://127.0.0.1:8082';
const shots = process.env.SCREENSHOT_DIR || '/tmp';

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.BROWSER_EXECUTABLE || undefined });
  const errors = [];
  const open = async options => {
    const page = await browser.newPage(options);
    page.on('pageerror', error => errors.push(error.message));
    page.on('response', response => { if (response.url().startsWith(url) && response.status() >= 400) errors.push(response.url()); });
    return page;
  };
  try {
    const page = await open({ viewport: { width: 1440, height: 900 } });
    await page.goto(url);
    const settled = id => page.waitForFunction(id => document.querySelector('.page.active')?.id === id
      && document.querySelector('.journey-strip').dataset.phase === 'waiting', id);
    const selected = n => page.waitForFunction(n => document.querySelector('.project-carousel').dataset.project === `project-${n}`
      && !document.querySelector('.project-carousel').hasAttribute('aria-busy'), n);
    const nav = async id => { await page.locator(`.site-nav [href="#${id}"]`).click(); await settled(id); };
    const next = async (n, previous = false) => { await page.locator(previous ? '#project-prev' : '#project-next').click(); await selected(n); };
    await page.evaluate(() => {
      window.projectIgnitions = [];
      new MutationObserver(() => {
        const section = document.querySelector('#projects');
        if (section.dataset.projectPower !== 'on') return;
        window.projectIgnitions.push({
          moving: document.querySelector('#avatar').matches('.walking, .running'),
          cameraMoving: document.querySelector('.bridge-track').getAnimations().some(a => a.playState === 'running'),
          liftMoving: [...document.querySelectorAll('.bay-lift')].some(n => n.getAnimations().length),
        });
      }).observe(document.querySelector('#projects'), { attributes: true, attributeFilter: ['data-project-power'] });
    });
    await page.locator('.site-nav [href="#projects"]').click();
    await page.waitForFunction(() => document.querySelector('.journey-strip').dataset.phase === 'approaching');
    await page.locator('#project-next').evaluate(button => button.click());
    assert.equal(await page.locator('.project-carousel').getAttribute('data-project'), 'project-1', 'No navigation during travel');
    for (let i = 0; i < 3; i++) {
      assert.equal(await page.locator('.station-projects').getAttribute('data-power'), 'off');
      assert.equal(await page.locator('.holo-projection').getAttribute('data-power'), 'off');
      assert.equal(await page.locator('.scene-link.beam').evaluate(n => getComputedStyle(n).visibility), 'hidden');
      assert.equal(await page.locator('#projects-grid').evaluate(n => getComputedStyle(n).opacity), '0');
      assert.equal(await page.locator('#projects-grid').evaluate(n => n.inert), true);
      assert.equal(await page.locator('#projects .section-heading').evaluate(n => getComputedStyle(n).opacity), '1');
      await page.waitForTimeout(180);
    }
    await settled('projects');
    await page.waitForFunction(() => document.querySelector('.holo-projection').getAnimations().length === 0);
    assert.equal(await page.locator('.projector').count(), 1);
    assert.equal(await page.locator('.scene-link.on').count(), 1);
    assert.equal(await page.locator('.holo-projection').getAttribute('data-power'), 'on');
    assert.deepEqual(await page.evaluate(() => window.projectIgnitions), [{ moving: false, cameraMoving: false, liftMoving: false }]);
    assert.equal(await page.locator('#project-count').count(), 0);
    assert.equal(await page.locator('#projects-grid').evaluate(n => getComputedStyle(n).opacity), '1');
    assert.equal(await page.locator('#projects-grid').evaluate(n => n.inert), false);
    const composition = await page.evaluate(() => {
      const rect = s => document.querySelector(s).getBoundingClientRect();
      const card = rect('.holo-projection'), prev = rect('#project-prev'), next = rect('#project-next');
      return { beamRatio: rect('.scene-link.beam').width / card.width,
        leftGap: card.left - prev.right, rightGap: next.left - card.right,
        background: getComputedStyle(document.querySelector('.project:not([hidden])')).backgroundImage };
    });
    assert.ok(Math.abs(composition.beamRatio - .6) < .01, JSON.stringify(composition));
    assert.ok(composition.leftGap >= 2 && composition.rightGap >= 2, JSON.stringify(composition));
    assert.equal(composition.background, 'none');
    await selected(1);
    const baseline = await page.locator('.holo-projection').boundingBox();
    const information = await page.locator('.projects-grid').boundingBox();
    for (const n of [2, 3, 4, 5, 1]) {
      await next(n);
      const state = await page.evaluate(() => {
        const panel = document.querySelector('.project:not([hidden])');
        return { count: document.querySelectorAll('.project:not([hidden])').length,
          image: document.querySelector('#project-image').getAttribute('src'),
          source: panel.querySelector('img').getAttribute('src'),
          alt: document.querySelector('#project-image').alt, name: panel.querySelector('h3').textContent };
      });
      assert.equal(state.count, 1);
      assert.equal(state.image, state.source);
      assert.ok(state.alt.includes(state.name));
      assert.deepEqual(await page.locator('.holo-projection').boundingBox(), baseline, 'Fixed media geometry across all cards');
      assert.deepEqual(await page.locator('.projects-grid').boundingBox(), information, 'Fixed information panel geometry');
      await page.screenshot({ path: `${shots}/projects-card-${n}.png` });
    }
    await next(5, true);
    await page.locator('#project-next').evaluate(button => { for (let i = 0; i < 20; i++) button.click(); });
    await selected(1);
    await page.locator('.project-carousel').focus();
    await page.keyboard.press('ArrowLeft');
    await selected(5);
    assert.equal(await page.evaluate(() => location.hash), '#projects');
    await page.locator('#project-5 summary').click();
    assert.equal(await page.locator('#detail').evaluate(n => n.open), true);
    assert.equal(await page.locator('#detail h2').textContent(), 'Good Game');
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#detail').evaluate(n => n.open), false);
    assert.equal(await page.evaluate(() => document.activeElement.closest('.project')?.id), 'project-5');

    // Cancel a change while leaving; no stale completion may select a later card.
    await page.locator('#project-next').click();
    await page.locator('.site-nav [href="#contact"]').click();
    assert.equal(await page.locator('.scene-link.beam').evaluate(n => getComputedStyle(n).visibility), 'hidden', 'Beam switches off immediately on departure');
    await settled('contact');
    const retained = await page.locator('.project-carousel').getAttribute('data-project');
    await nav('home');
    await nav('about');
    await nav('projects');
    assert.equal(await page.locator('.project-carousel').getAttribute('data-project'), retained);

    for (const viewport of [{ width: 1366, height: 768 }, { width: 1920, height: 1080 }, { width: 1024, height: 768 }, { width: 900, height: 640 }]) {
      await page.setViewportSize(viewport);
      await settled('projects');
      await page.waitForFunction(() => document.querySelector('.holo-projection').getAnimations().length === 0);
      const geometry = await page.evaluate(() => {
        const rect = selector => document.querySelector(selector).getBoundingClientRect();
        const card = rect('.holo-projection'), emitter = rect('.projector'), walkway = rect('.track-walkway');
        const panel = document.querySelector('.project:not([hidden])');
        const parts = [...panel.children].filter(n => getComputedStyle(n).display !== 'none').map(n => n.getBoundingClientRect());
        return { ratio: card.width / card.height, alignment: Math.abs(card.x + card.width / 2 - emitter.x - emitter.width / 2),
          clearance: walkway.top - card.bottom, overflow: document.documentElement.scrollWidth > innerWidth,
          overlaps: parts.slice(1).some((r, i) => r.top < parts[i].bottom - 1) };
      });
      assert.ok(Math.abs(geometry.ratio - 1.5) < .01, JSON.stringify(geometry));
      assert.ok(geometry.alignment < 2, JSON.stringify(geometry));
      assert.ok(geometry.clearance > 0, JSON.stringify(geometry));
      assert.equal(geometry.overflow, false, JSON.stringify(geometry));
      assert.equal(geometry.overlaps, false, `${JSON.stringify(viewport)} ${JSON.stringify(geometry)}`);
      for (let i = 0; i < 5; i++) {
        const active = Number((await page.locator('.project-carousel').getAttribute('data-project')).split('-')[1]);
        await next(active % 5 + 1);
        const clipped = await page.locator('.project:not([hidden])').evaluate(panel => [...panel.children]
          .filter(n => getComputedStyle(n).display !== 'none' && n.scrollHeight > n.clientHeight + 1)
          .map(n => n.className));
        assert.deepEqual(clipped, [], `Text must fit at ${viewport.width}px`);
      }
      await page.screenshot({ path: `${shots}/projects-${viewport.width}.png` });
    }
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await settled('projects');
    await page.locator('#project-next').click();
    await page.waitForFunction(() => !document.querySelector('.project-carousel').hasAttribute('aria-busy'));
    assert.equal(await page.locator('.holo-float').evaluate(n => n.getAnimations().length), 0);
    assert.equal(await page.locator('.holo-card').evaluate(n => n.getAnimations().length), 0);
    await page.locator('[data-mode="read"]').click();
    assert.equal(await page.locator('.project:visible').count(), 5);
    assert.equal(await page.locator('.project-carousel').isVisible(), false);
    await page.locator('#project-3 summary').click();
    assert.equal(await page.locator('#project-3 details').getAttribute('open'), '');
    assert.equal(await page.locator('#detail').evaluate(n => n.open), false);

    const mobile = await open({ viewport: { width: 390, height: 844 } });
    await mobile.goto(`${url}/#projects`);
    assert.equal(await mobile.locator('.project:visible').count(), 5);
    assert.equal(await mobile.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await mobile.locator('[data-mode="journey"]').click();
    await mobile.locator('.site-nav [href="#projects"]').click();
    await mobile.waitForFunction(() => document.querySelector('.page.active')?.id === 'projects'
      && document.querySelector('.journey-strip').dataset.phase === 'waiting');
    await mobile.locator('#project-next').click();
    await mobile.waitForFunction(() => document.querySelector('.project-carousel').dataset.project === 'project-2');
    assert.equal(await mobile.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);

    const nojs = await open({ viewport: { width: 1440, height: 900 }, javaScriptEnabled: false });
    await nojs.goto(`${url}/#projects`);
    assert.equal(await nojs.locator('.project:visible').count(), 5);
    // Let native smooth scrolling to the deep link finish before click auto-scroll.
    await nojs.waitForTimeout(1500);
    await nojs.locator('#project-1 summary').click();
    assert.equal(await nojs.locator('#project-1 details').getAttribute('open'), '');
    assert.deepEqual(errors, []);
    console.log('PASS: arrival, single projector, all cards and metadata, cyclic navigation, rapid clicks, keyboard, details/focus, departure/return, fixed dimensions, resize, reduced motion, Reading, mobile and no JavaScript.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
