// Browser regression checks for the Journey stage. Supply PLAYWRIGHT_MODULE /
// BROWSER_EXECUTABLE when Playwright is installed outside this buildless project.
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const url = process.env.PORTFOLIO_URL || 'http://127.0.0.1:8082';
const shots = process.env.SCREENSHOT_DIR || '/tmp';

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.BROWSER_EXECUTABLE || undefined });
  const errors = [];
  const open = async (viewport, options = {}) => {
    const page = await browser.newPage({ viewport, ...options });
    page.on('pageerror', error => errors.push(error.message));
    page.on('response', response => {
      if (response.url().startsWith(url) && response.status() >= 400) errors.push(response.url());
    });
    return page;
  };
  try {
    const page = await open({ width: 1440, height: 900 });
    assert.equal((await page.goto(url)).status(), 200);
    await page.evaluate(() => localStorage.setItem('fs-mode', 'journey'));
    await page.reload();
    const nav = id => page.locator(`.site-nav a[href="#${id}"]`).click();
    const phase = (name, timeout = 6000) => page.waitForFunction(
      name => document.querySelector('.journey-strip').dataset.phase === name, name, { timeout });
    // Settled = requested area active, content switched on, no lift moving.
    const settled = id => page.waitForFunction(id => ['waiting', 'interacting'].includes(document.querySelector('.journey-strip').dataset.phase)
      && document.querySelector('.page.active')?.id === id
      && document.querySelector('.page.active').dataset.stage === 'on'
      && !document.querySelector('.page.leaving')
      && ![...document.querySelectorAll('.bay-lift')].some(n => n.getAnimations().length), id, { timeout: 6000 });

    // One area at a time: one raised lift, holding the current set, centred and flush.
    const stage = async id => {
      const result = await page.evaluate(id => {
        const su = document.querySelector('#avatar').offsetWidth / 128;
        const raised = [...document.querySelectorAll('.bay.raised')];
        const walkway = document.querySelector('.track-walkway:not(.track-walkway-top)').getBoundingClientRect();
        const station = document.querySelector(`[data-station="${id}"]`);
        const canvas = station.getBoundingClientRect();
        const plate = raised[0]?.querySelector('.bay-plate').getBoundingClientRect();
        const avatar = document.querySelector('#avatar').getBoundingClientRect();
        const shown = [...document.querySelectorAll('.page')].filter(p => !p.hidden).map(p => p.id);
        const visibleSets = [...document.querySelectorAll('.bay')].filter(b => {
          const r = b.querySelector('.bay-mount .station')?.getBoundingClientRect();
          return r && r.right > 0 && r.left < innerWidth && b.classList.contains('raised');
        }).length;
        return {
          raised: raised.length,
          holds: raised[0]?.contains(station),
          floor: Math.abs(canvas.top + 132 * su - walkway.top),
          plate: plate && Math.abs(plate.top - (walkway.top - 4 * su)),
          feet: Math.abs(avatar.bottom - 4 * su - walkway.top),
          shown,
          visibleSets,
          overflow: document.documentElement.scrollWidth > innerWidth,
          scenicInert: [...document.querySelectorAll(`#${id} .scenic`)].some(n => n.inert),
        };
      }, id);
      assert.equal(result.raised, 1, JSON.stringify(result));
      assert.equal(result.holds, true, JSON.stringify(result));
      assert.equal(result.visibleSets, 1, JSON.stringify(result));
      assert.ok(result.floor < 1 && result.plate < 1 && result.feet < 1, JSON.stringify(result));
      assert.deepEqual(result.shown, [id]);
      assert.equal(result.overflow, false);
      assert.equal(result.scenicInert, false);
    };
    // Panels must stay inside the content area (no clipping by the scene).
    const fits = () => page.evaluate(() => {
      const main = document.querySelector('main').getBoundingClientRect();
      const active = document.querySelector('.page.active');
      return active.scrollHeight <= active.clientHeight + 1 && [...active.querySelectorAll('.scenic')].every(n => {
        const r = n.getBoundingClientRect();
        return r.top >= main.top - 1 && r.bottom <= main.bottom + 1;
      });
    });

    await settled('home');
    await stage('home');
    await page.waitForFunction(() => document.querySelector('#avatar').classList.contains('petting'), null, { timeout: 8000 });

    // About → Projects: the reference sequence.
    await nav('about');
    await phase('approaching');
    assert.equal(await page.locator('#avatar').evaluate(n => n.classList.contains('running')), true);
    assert.equal(await page.locator('#about .scenic').evaluate(n => n.inert), true);
    await phase('interacting');
    await stage('about');
    assert.equal(await page.locator('.station-about .station-actors').evaluate(n => getComputedStyle(n).display), 'block');
    assert.equal(await page.locator('#avatar').evaluate(n => getComputedStyle(n).visibility), 'hidden');
    assert.equal(await page.locator('[data-link="about"]').evaluate(n => n.classList.contains('on')), true);
    assert.ok(await fits());
    // Desk keyboard stays under the authored hands: equipment never moves at rest.
    const desk = await page.locator('.station-about .station-equipment').boundingBox();
    await page.waitForTimeout(900);
    assert.deepEqual(await page.locator('.station-about .station-equipment').boundingBox(), desk);
    await page.screenshot({ path: `${shots}/stations-about-verified.png` });

    const camBefore = await page.evaluate(() => getComputedStyle(document.querySelector('.bridge-track')).transform);
    await nav('projects');
    await phase('approaching');
    await page.waitForTimeout(300);
    // The world moves, the character stays put (only the small stop offset).
    const midway = await page.evaluate(() => ({
      cam: getComputedStyle(document.querySelector('.bridge-track')).transform,
      avatar: document.querySelector('#avatar').getBoundingClientRect().left,
      back: document.querySelector('#avatar').classList.contains('back'),
    }));
    assert.notEqual(midway.cam, camBefore);
    assert.equal(midway.back, false);
    await settled('projects');
    await stage('projects');
    assert.equal(await page.locator('.station-projects').getAttribute('data-power'), 'on');
    assert.equal(await page.locator('[data-link="feature"].on').count(), 1);
    assert.ok(await fits());
    // Selecting a project retunes the projection without travelling.
    await page.locator('#project-tab-3').click();
    assert.equal(await page.locator('#project-3').isVisible(), true);
    assert.equal(await page.locator('#project-1').isVisible(), false);
    assert.equal(await page.locator('.journey-strip').getAttribute('data-phase'), 'waiting');
    await page.keyboard.press('ArrowRight');
    assert.equal(await page.locator('#project-4').isVisible(), true);
    assert.equal(await page.evaluate(() => location.hash), '#projects');
    await page.screenshot({ path: `${shots}/stations-projects-verified.png` });

    // Backwards: world and character turn around.
    await nav('about');
    await phase('approaching');
    assert.equal(await page.locator('#avatar').evaluate(n => n.classList.contains('back')), true);
    await settled('about');
    await stage('about');

    // Rapid tab changes: the last request wins, nothing queues or stays halfway.
    for (const id of ['projects', 'contact', 'home', 'projects', 'contact']) {
      await nav(id);
      await page.waitForTimeout(90);
    }
    await settled('contact');
    await stage('contact');
    await phase('waiting', 8000);
    assert.equal(await page.locator('.station-contact').evaluate(n => n.style.getPropertyValue('--frame')), '7');
    assert.equal(await page.locator('#avatar').evaluate(n => n.className), 'avatar station-owned');
    assert.ok(await fits());
    await page.screenshot({ path: `${shots}/stations-contact-verified.png` });

    // Return mid-transfer: the same equipment comes back up, no second set.
    await nav('projects');
    await phase('approaching');
    await page.waitForTimeout(250);
    await nav('contact');
    await settled('contact');
    await stage('contact');

    // Keyboard and wheel use the same path.
    await page.locator('body').click({ position: { x: 5, y: 300 } });
    await page.keyboard.press('ArrowLeft');
    await settled('projects');
    await stage('projects');
    await page.mouse.move(720, 150);
    await page.mouse.wheel(0, 300);
    await settled('contact');
    await stage('contact');

    // Hidden document mid-transfer: settle, never freeze halfway.
    await nav('home');
    await phase('approaching');
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, value: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await stage('home');
    await page.evaluate(() => { delete document.hidden; document.dispatchEvent(new Event('visibilitychange')); });

    // Resize mid-transfer, then at every reference desktop size.
    await nav('about');
    await phase('approaching');
    await page.setViewportSize({ width: 1366, height: 768 });
    await settled('about');
    await stage('about');
    for (const viewport of [{ width: 1366, height: 768 }, { width: 1440, height: 900 }, { width: 1920, height: 1080 }]) {
      await page.setViewportSize(viewport);
      for (const id of ['home', 'about', 'projects', 'contact']) {
        await page.evaluate(id => { location.hash = id; }, id);
        await settled(id);
        await stage(id);
        assert.ok(await fits(), `${id} clipped at ${viewport.width}×${viewport.height}`);
      }
    }

    // Reduced motion: stable, complete composition straight away.
    await page.locator('#motion').click();
    await page.evaluate(() => { location.hash = 'about'; });
    await page.waitForTimeout(50);
    await stage('about');
    assert.equal(await page.locator('.journey-strip').getAttribute('data-phase'), 'waiting');
    assert.equal(await page.locator('.station-about').evaluate(n => n.style.getPropertyValue('--frame')), '0');
    await page.locator('#motion').click();

    // Reading mode: every panel and project, same station nodes, no tabs.
    await page.locator('[data-mode="read"]').click();
    assert.equal(await page.locator('#about > .station-about').count(), 1);
    assert.equal(await page.locator('#contact > .station-contact').count(), 1);
    assert.equal(await page.locator('.about-grid > article:visible').count(), 3);
    assert.equal(await page.locator('.project:visible').count(), 4);
    assert.equal(await page.locator('.view-tabs').isVisible(), false);
    assert.equal(await page.locator('.journey-strip').isVisible(), false);
    await page.locator('[data-mode="journey"]').click();
    await settled('about');
    await stage('about');

    // Focus never reaches inactive areas.
    const focusable = await page.evaluate(() => [...document.querySelectorAll('.page:not(.active) a, .page:not(.active) button')]
      .filter(n => n.checkVisibility() && !n.closest('[inert]')).length);
    assert.equal(focusable, 0);

    // Mobile keeps Reading by default; Journey stays usable if chosen.
    const mobile = await open({ width: 390, height: 844 }, { reducedMotion: 'reduce' });
    await mobile.goto(`${url}/#contact`);
    assert.equal(await mobile.locator('html').evaluate(n => n.classList.contains('journey')), false);
    assert.equal(await mobile.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await mobile.locator('[data-mode="journey"]').click();
    assert.equal(await mobile.locator('.journey-strip').getAttribute('data-phase'), 'waiting');
    assert.equal(await mobile.locator('#avatar .avatar-sprite').evaluate(n => getComputedStyle(n).animationName), 'none');
    assert.equal(await mobile.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await mobile.screenshot({ path: `${shots}/stations-mobile-verified.png` });

    // Radar: one 2.25 s scan after 30–45 s, only while Contact is idle.
    const radarPage = await open({ width: 1440, height: 900 });
    await radarPage.addInitScript(() => { Math.random = () => 0; localStorage.setItem('fs-mode', 'journey'); });
    const epoch = new Date('2026-10-24T10:00:00Z');
    await radarPage.clock.install({ time: epoch });
    await radarPage.clock.pauseAt(epoch);
    await radarPage.goto(`${url}/#contact`);
    const radar = radarPage.locator('.station-contact .station-equipment');
    await radarPage.clock.runFor(100 + 8 * 400);
    assert.equal(await radarPage.locator('.journey-strip').getAttribute('data-phase'), 'waiting');
    const radarBox = await radar.boundingBox();
    await radarPage.clock.runFor(29999);
    assert.equal(await radar.getAttribute('data-state'), 'resting');
    await radarPage.clock.runFor(1);
    assert.equal(await radar.getAttribute('data-state'), 'scanning');
    await radarPage.clock.runFor(500);
    assert.notEqual(await radar.evaluate(n => n.style.getPropertyValue('--radio-frame')), '1');
    assert.deepEqual(await radar.boundingBox(), radarBox);
    await radarPage.clock.runFor(1750);
    assert.equal(await radar.getAttribute('data-state'), 'resting');
    await radarPage.emulateMedia({ reducedMotion: 'reduce' });
    await radarPage.clock.runFor(60000);
    assert.equal(await radar.getAttribute('data-state'), 'resting');

    assert.deepEqual(errors, []);
    console.log('PASS: single active area, flush lifts, feet on the floor, About → Projects sequence, reverse travel, rapid retargeting, return mid-transfer, keyboard/wheel/hash, hidden document, resize, 1366/1440/1920 layouts without clipping, reduced motion, Reading, focus, mobile, radar timing.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
