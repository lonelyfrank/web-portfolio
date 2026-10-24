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
    // Render the authored poses side by side at the same scene scale for review.
    const preview = await open({ width: 1440, height: 650 });
    const pose = (state, frame, label) => `<figure><figcaption>${label}</figcaption><div class="avatar ${state}" data-frame="${frame}"><span class="avatar-sprite"></span></div></figure>`;
    await preview.setContent(`<link rel="stylesheet" href="${url}/style.css">
      <style>body{padding:24px;background:#101827;color:#fff;font:14px sans-serif}
      .poses{display:grid;grid-template-columns:repeat(8,1fr);gap:8px;margin:16px 0}
      figure{margin:0;height:150px;background:#182439;border-bottom:1px solid #59809b}
      figcaption{padding:8px}.avatar{position:relative;left:auto;bottom:auto;margin:0 auto;--u:2}
      .avatar-sprite{filter:none}</style>
      <div class="poses">${pose('', 0, 'Riposo')}${pose('petting', 0, 'Inizio carezza')}</div>
      <div class="poses">${Array.from({ length: 8 }, (_, i) => pose('walking', i, `Camminata ${i + 1}`)).join('')}</div>
      <div class="poses">${Array.from({ length: 8 }, (_, i) => pose('running', i, `Corsa ${i + 1}`)).join('')}</div>`);
    await preview.evaluate(async () => {
      for (const sprite of document.querySelectorAll('.avatar-sprite')) {
        const image = new Image();
        image.src = getComputedStyle(sprite).backgroundImage.slice(5, -2);
        await image.decode();
        const animation = sprite.getAnimations()[0];
        animation.pause();
        animation.currentTime = (Number(sprite.parentElement.dataset.frame) + .5) * animation.effect.getTiming().duration / 8;
      }
    });
    await preview.screenshot({ path: `${shots}/stations-motion-frames-verified.png` });
    await preview.close();
    const page = await open({ width: 1440, height: 900 });
    assert.equal((await page.goto(url)).status(), 200);
    await page.evaluate(() => localStorage.setItem('fs-mode', 'journey'));
    await page.reload();
    const nav = async id => {
      await page.locator(`.site-nav a[href="#${id}"]`).click();
      await page.waitForFunction(id => document.querySelector('.page.active')?.id === id, id);
    };
    const phase = (name, timeout = 30000) => page.waitForFunction(
      name => document.querySelector('.journey-strip').dataset.phase === name, name, { timeout });
    const contentFollows = async (id, backwards = false) => {
      const ratio = await page.evaluate(() => {
        const main = document.querySelector('main');
        const gutter = parseFloat(getComputedStyle(main).paddingLeft);
        const pitch = main.clientWidth - 2 * gutter + Math.max(40, gutter);
        const frames = document.querySelector('.bridge-track').getAnimations()[0].effect.getKeyframes();
        const distance = Math.abs(new DOMMatrixReadOnly(frames.at(-1).transform).m41
          - new DOMMatrixReadOnly(frames[0].transform).m41);
        return pitch / distance;
      });
      const snapshot = () => page.evaluate(id => ({
        panel: document.querySelector(`#${id} .scenic, #${id} .about-layout`).getBoundingClientRect().left,
        station: document.querySelector(`[data-station="${id}"]`).getBoundingClientRect().left,
      }), id);
      const before = await snapshot();
      await page.waitForTimeout(200);
      const after = await snapshot();
      const panelDelta = after.panel - before.panel;
      const stationDelta = after.station - before.station;
      assert.ok(backwards ? panelDelta > 15 : panelDelta < -15, JSON.stringify({ before, after }));
      assert.ok(Math.abs(panelDelta - stationDelta * ratio) < 8, 'Slides follow the compact camera path at their own pitch');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    };
    const overlappingLifts = async (from, to) => {
      const lifts = await page.evaluate(({ from, to }) => {
        const read = id => {
          const lift = document.querySelector(`[data-station="${id}"]`).closest('.bay')?.querySelector('.bay-lift');
          const frames = lift?.getAnimations()[0]?.effect.getKeyframes();
          return frames && frames.map(frame => new DOMMatrixReadOnly(frame.transform).m42);
        };
        return { from: read(from), to: read(to), phase: document.querySelector('.journey-strip').dataset.phase };
      }, { from, to });
      assert.equal(lifts.phase, 'approaching');
      assert.ok(lifts.from && lifts.from[0] < lifts.from.at(-1), `Outgoing lift must descend immediately: ${JSON.stringify(lifts)}`);
      assert.ok(lifts.to && lifts.to[0] > lifts.to.at(-1), `Destination must rise during departure: ${JSON.stringify(lifts)}`);
      assert.equal(await page.locator(`#${to}`).getAttribute('data-stage'), 'on', 'Text begins appearing with its lift');
      assert.equal(await page.locator(`#${to} .scenic, #${to} .about-layout, #${to} .contact-layout`).first().evaluate(n => n.inert), false);
      const names = { projects: ['index', 'feature'] }[to] || [];
      assert.deepEqual(await page.locator('.scene-link.on').evaluateAll(nodes => nodes.map(n => n.dataset.link).sort()), names.sort(),
        'Only the destination connections turn on as its lift rises');
      assert.equal(await page.locator(`[data-station="${to}"]`).evaluate(n => n.classList.contains('interaction-active')), false,
        'Frank must reach the station before interacting');
    };
    const projectionFollows = async () => {
      const beams = await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => {
        resolve(['index', 'feature'].map(name => {
          const beam = document.querySelector(`[data-link="${name}"]`);
          const emitter = document.querySelector(`[data-emitter="${name}"]`).getBoundingClientRect();
          const panel = document.querySelector(name === 'index' ? '.holo-index' : '.projects-grid').getBoundingClientRect();
          return {
            top: parseFloat(beam.style.top), bottom: parseFloat(beam.style.top) + parseFloat(beam.style.height),
            left: parseFloat(beam.style.left), panelBottom: panel.bottom,
            lensY: emitter.top + emitter.height * .22,
            expectedLeft: Math.min(emitter.left + emitter.width * .3, panel.left + 8),
          };
        }));
      })));
      beams.forEach(beam => {
        assert.ok(Math.abs(beam.top - beam.panelBottom) < 2, JSON.stringify(beam));
        assert.ok(Math.abs(beam.bottom - beam.lensY) < 2, JSON.stringify(beam));
        assert.ok(Math.abs(beam.left - beam.expectedLeft) < 2, JSON.stringify(beam));
      });
    };
    const gait = async (expected, backwards = false) => {
      await phase('approaching');
      const movement = await page.locator('#avatar').evaluate(n => {
        const sprite = getComputedStyle(n.querySelector('.avatar-sprite'));
        return {
          walking: n.classList.contains('walking'), running: n.classList.contains('running'),
          backwards: n.classList.contains('back'), row: sprite.backgroundPositionY,
          cycle: parseFloat(sprite.animationDuration),
        };
      });
      // Derive ground speed from the rendered camera/actor animation paths;
      // reframing can slow the feet slightly without changing the camera speed.
      const cycle = await page.evaluate(expected => {
        const camera = document.querySelector('.bridge-track').getAnimations()[0];
        const actor = document.querySelector('#avatar').getAnimations()[0];
        const delta = animation => {
          const frames = animation.effect.getKeyframes();
          return new DOMMatrixReadOnly(frames.at(-1).transform).m41 - new DOMMatrixReadOnly(frames[0].transform).m41;
        };
        const su = document.querySelector('#avatar').offsetWidth / 128;
        const speed = Math.abs(-delta(camera) + delta(actor)) / su / (camera.effect.getTiming().duration / 1000);
        return (expected === 'walking' ? 96 : 120) / speed;
      }, expected);
      assert.ok(Math.abs(movement.cycle - cycle) < .002, 'Stride follows the actual ground speed');
      assert.ok(movement.cycle >= (expected === 'walking' ? .57 : .428), 'Sprite keeps a natural gait');
      delete movement.cycle;
      assert.deepEqual(movement, {
        walking: expected === 'walking', running: expected === 'running', backwards,
        row: expected === 'walking' ? '0%' : '100%',
      });
      // Every held pose must show exactly one full atlas cell, including wraparound.
      // Sampling inside each step catches a strip advancing by the old cell width.
      const misaligned = await page.locator('#avatar .avatar-sprite').evaluate(sprite => {
        const animation = sprite.getAnimations()[0];
        const time = animation.currentTime;
        const duration = animation.effect.getTiming().duration;
        const width = sprite.getBoundingClientRect().width;
        const failures = [];
        animation.pause();
        for (let step = 0; step < 16; step++) {
          for (const fraction of [.01, .5, .99]) {
            animation.currentTime = (step + fraction) * duration / 8;
            const position = getComputedStyle(sprite).backgroundPositionX;
            const x = position.endsWith('%') ? parseFloat(position) / 100 * -7 * width : parseFloat(position);
            if (Math.abs(x + step % 8 * width) > .1) failures.push({ step, fraction, position, width });
          }
        }
        animation.currentTime = time;
        animation.play();
        return failures;
      });
      assert.deepEqual(misaligned, [], 'Sprite must hold complete frames without horizontal drift');
    };
    // Settled = requested area active, content switched on, no lift moving.
    const settled = id => page.waitForFunction(id => ['waiting', 'interacting'].includes(document.querySelector('.journey-strip').dataset.phase)
      && document.querySelector('.page.active')?.id === id
      && document.querySelector('.page.active').dataset.stage === 'on'
      && !document.querySelector('.page.leaving')
      && ![...document.querySelectorAll('.bay-lift')].some(n => n.getAnimations().length), id, { timeout: 30000 });

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
          scenicInert: [...document.querySelectorAll(`#${id} .scenic, #${id} .about-layout`)].some(n => n.inert),
          contentOffset: parseFloat(getComputedStyle(document.querySelector(`#${id}`)).translate) || 0,
        };
      }, id);
      assert.equal(result.raised, 1, JSON.stringify(result));
      assert.equal(result.holds, true, JSON.stringify(result));
      assert.equal(result.visibleSets, 1, JSON.stringify(result));
      assert.ok(result.floor < 1 && result.plate < 1 && result.feet < 1, JSON.stringify(result));
      assert.deepEqual(result.shown, [id]);
      assert.equal(result.overflow, false);
      assert.equal(result.scenicInert, false);
      assert.ok(Math.abs(result.contentOffset) < 1, 'Text must finish in its reading position');
    };
    // Panels must stay inside the content area (no clipping by the scene).
    const fits = () => page.evaluate(() => {
      const main = document.querySelector('main').getBoundingClientRect();
      const active = document.querySelector('.page.active');
      // Desktop Contact fits above the scene without a vertical scroll range.
      if (active.id === 'contact') return active.scrollWidth <= active.clientWidth + 1
        && active.scrollHeight <= active.clientHeight + 1
        && main.bottom <= document.querySelector('.journey-strip').getBoundingClientRect().top + 1;
      return active.scrollHeight <= active.clientHeight + 1 && [...active.querySelectorAll('.scenic')].every(n => {
        const r = n.getBoundingClientRect();
        return r.top >= main.top - 1 && r.bottom <= main.bottom + 1;
      });
    });

    await settled('home');
    await stage('home');
    await page.waitForFunction(() => document.querySelector('#avatar').classList.contains('petting'), null, { timeout: 8000 });

    // About → Projects: the reference sequence.
    await page.locator('#next').click();
    await overlappingLifts('home', 'about');
    await gait('walking');
    const adjacentSeconds = await page.locator('.bridge-track').evaluate(n => parseFloat(getComputedStyle(n).transitionDuration));
    assert.ok(adjacentSeconds > 2 && adjacentSeconds < 2.4, `Adjacent navigation: ${adjacentSeconds}s`);
    await page.waitForTimeout(200);
    assert.ok(await page.locator('#about .about-layout').evaluate(n => parseFloat(getComputedStyle(n).opacity) > 0));
    assert.equal(await page.locator('#avatar').evaluate(n => n.classList.contains('walking')), true);
    await phase('interacting');
    await stage('about');
    assert.equal(await page.locator('.station-about .station-actors').evaluate(n => getComputedStyle(n).display), 'block');
    assert.equal(await page.locator('#avatar').evaluate(n => getComputedStyle(n).visibility), 'hidden');
    assert.equal(await page.locator('[data-link="about"]').count(), 0);
    assert.ok(await fits());
    // Desk keyboard stays under the authored hands: equipment never moves at rest.
    const desk = await page.locator('.station-about .station-equipment').boundingBox();
    await page.waitForTimeout(900);
    assert.deepEqual(await page.locator('.station-about .station-equipment').boundingBox(), desk);
    await page.screenshot({ path: `${shots}/stations-about-verified.png` });

    const camBefore = await page.evaluate(() => getComputedStyle(document.querySelector('.bridge-track')).transform);
    await nav('projects');
    await overlappingLifts('about', 'projects');
    await gait('walking');
    assert.equal(await page.locator('.station-projects').getAttribute('data-power'), 'on');
    await projectionFollows();
    await contentFollows('projects');
    await projectionFollows();
    await page.waitForTimeout(350);
    await projectionFollows();
    assert.equal(await page.locator('.journey-strip').getAttribute('data-phase'), 'approaching');
    assert.equal(await page.locator('[data-link="feature"]').evaluate(n => {
      const style = getComputedStyle(n);
      return Number(style.opacity) > .8 && (style.transform === 'none' || new DOMMatrixReadOnly(style.transform).m22 > .99);
    }), true, 'Projection finishes appearing before Frank arrives');
    await page.screenshot({ path: `${shots}/stations-projects-travel-verified.png` });
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
    await gait('walking', true);
    await contentFollows('about', true);
    await settled('about');
    await stage('about');

    // Navbar jumps use the running frames in both directions.
    const runOrigin = await page.locator('.bridge-track').evaluate(n => -new DOMMatrixReadOnly(getComputedStyle(n).transform).m41);
    await nav('contact');
    await overlappingLifts('about', 'contact');
    await gait('running');
    const twoSectionRun = await page.locator('.bridge-track').evaluate((n, origin) => {
      const unit = document.querySelector('#avatar').offsetWidth / 128;
      return { distance: Math.abs(Number(n.style.getPropertyValue('--cam')) - origin / unit),
        seconds: parseFloat(getComputedStyle(n).transitionDuration) };
    }, runOrigin);
    assert.ok(twoSectionRun.distance > 600 && twoSectionRun.distance < 720, JSON.stringify(twoSectionRun));
    // The character also covers the offset between each station's standing point.
    assert.ok(twoSectionRun.seconds > 2 && twoSectionRun.seconds < 2.7, JSON.stringify(twoSectionRun));
    await page.waitForTimeout(1200);
    assert.equal(await page.locator('#avatar').evaluate(n => n.classList.contains('running')), true);
    assert.equal(await page.locator('[data-station="contact"]').evaluate(n => {
      const bay = n.closest('.bay');
      return bay?.classList.contains('raised') && bay.querySelector('.bay-lift').getAnimations().length === 0;
    }), true, 'Destination is ready before the run ends');
    assert.equal(await page.locator('.station-contact').evaluate(n => n.classList.contains('interaction-active')), false);
    await settled('contact');
    const reverseOrigin = await page.locator('.bridge-track').evaluate(n => -new DOMMatrixReadOnly(getComputedStyle(n).transform).m41);
    await nav('home');
    await gait('running', true);
    const threeSectionRun = await page.locator('.bridge-track').evaluate((n, origin) => {
      const unit = document.querySelector('#avatar').offsetWidth / 128;
      return { distance: Math.abs(Number(n.style.getPropertyValue('--cam')) - origin / unit),
        seconds: parseFloat(getComputedStyle(n).transitionDuration) };
    }, reverseOrigin);
    assert.ok(threeSectionRun.distance > 900 && threeSectionRun.distance < 1080, JSON.stringify(threeSectionRun));
    assert.ok(threeSectionRun.seconds > twoSectionRun.seconds + .8 && threeSectionRun.seconds < 4, JSON.stringify(threeSectionRun));
    await settled('home');

    // Retarget during a run, then during a walk: never retain the old gait/row.
    await nav('contact');
    await gait('running');
    await page.waitForTimeout(250);
    await nav('projects');
    await gait('walking');
    await nav('home');
    await gait('running', true);
    await settled('home');
    await page.locator('#next').click();
    await gait('walking');
    await settled('about');

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
    await gait('walking', true);
    await settled('projects');
    await stage('projects');
    await page.mouse.move(720, 150);
    await page.mouse.wheel(0, 300);
    await gait('walking');
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
    assert.equal(await page.locator('.about-layout > :visible').count(), 3);
    assert.equal(await page.locator('.project:visible').count(), 4);
    assert.equal(await page.locator('#about [role="tab"], #about [role="tabpanel"]').count(), 0);
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
