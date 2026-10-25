// Scrub the real camera: no intermediate walking, invisible relocation only,
// fixed floor anchors, reversals/resizes and lifecycle cancellation.
const assert = require('node:assert/strict');
const { chromium, url, shots, browserOptions, trackErrors } = require('./browser-settings.cjs');

(async () => {
  const browser = await chromium.launch(browserOptions);
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  trackErrors(page, errors);
  try {
    await page.goto(url);
    await page.locator('[data-mode="journey"]').click();
    const nav = async id => {
      await page.locator(`.site-nav a[href="#${id}"]`).click();
      await page.waitForFunction(id => document.querySelector('.page.active').id === id
        && document.querySelector('.bridge-track').getAnimations().length > 0, id);
    };
    const snapshot = () => page.evaluate(() => {
      const actor = document.querySelector('#avatar');
      const sprite = actor.querySelector('.avatar-sprite');
      const track = document.querySelector('.bridge-track');
      const su = actor.offsetWidth / 128;
      const cam = -new DOMMatrixReadOnly(getComputedStyle(track).transform).m41 / su;
      const position = new DOMMatrixReadOnly(getComputedStyle(actor).transform).m41 / su;
      const animation = track.getAnimations()[0];
      const target = document.querySelector('.page.active').id;
      const station = document.querySelector(`[data-station="${target}"]`).getBoundingClientRect();
      const stops = { home: 72, about: 91, projects: 138, contact: 61 };
      return {
        cam, world: cam + position, position, frame: Number(actor.style.getPropertyValue('--teleport-frame')),
        effect: actor.dataset.teleport, teleporting: actor.classList.contains('teleporting'),
        walking: actor.classList.contains('walking'), phase: document.querySelector('.journey-strip').dataset.phase,
        spriteFloor: sprite.getBoundingClientRect().top + 132 * su,
        floor: document.querySelector('.track-walkway:not(.track-walkway-top)').getBoundingClientRect().top,
        x: getComputedStyle(sprite).backgroundPositionX, width: sprite.getBoundingClientRect().width,
        duration: animation?.effect.getTiming().duration,
        content: parseFloat(getComputedStyle(document.querySelector('.page.active')).translate),
        parallax: Number(document.documentElement.style.getPropertyValue('--step')),
        destinationOffset: actor.getBoundingClientRect().left + 64 * su - station.left - stops[target] * su,
      };
    });
    const scrub = async fraction => {
      await page.evaluate(fraction => {
        const animation = document.querySelector('.bridge-track').getAnimations()[0];
        animation.pause();
        animation.currentTime = animation.effect.getTiming().duration * fraction;
      }, fraction);
      await page.waitForTimeout(40);
      return snapshot();
    };
    const finish = async () => {
      await page.evaluate(() => document.querySelector('.bridge-track').getAnimations().forEach(a => a.finish()));
      await page.waitForFunction(() => ['waiting', 'interacting'].includes(document.querySelector('.journey-strip').dataset.phase));
      assert.equal(await page.locator('#avatar.teleporting, #avatar[data-teleport]').count(), 0);
    };
    for (const target of ['contact', 'home', 'projects']) {
      await nav(target);
      const start = await scrub(0);
      assert.equal(start.frame, 0);
      assert.equal(start.teleporting, true);
      const samples = [];
      // Sample the centre of every outgoing and incoming pose, plus the blank hold.
      const times = [...Array.from({ length: 12 }, (_, i) => (i + .5) * 55), start.duration / 2,
        ...Array.from({ length: 12 }, (_, i) => start.duration - (11.5 - i) * 55)];
      for (const ms of times) {
        const state = await scrub(ms / start.duration);
        samples.push(state);
        assert.equal(state.walking, false);
        assert.ok(Math.abs(state.spriteFloor - state.floor) < 1, 'Effects share the bridge floor');
        assert.ok(Math.abs(parseFloat(state.x) / 100 * 11 - state.frame) < .001, 'Complete atlas cells');
      }
      const departure = samples.slice(0, 12);
      const arrival = samples.slice(-12);
      assert.deepEqual(departure.map(s => s.frame), Array.from({ length: 12 }, (_, i) => i));
      assert.deepEqual(arrival.map(s => s.frame), Array.from({ length: 12 }, (_, i) => 11 - i));
      departure.forEach(s => assert.ok(Math.abs(s.world - start.world) < .02, 'Departure stays anchored to its world position'));
      arrival.forEach(s => assert.ok(Math.abs(s.world - arrival[0].world) < .02, 'Arrival stays anchored to the destination'));
      arrival.forEach(s => assert.ok(Math.abs(s.destinationOffset) < .1, 'The actor materialises at the station stop'));
      assert.equal(samples[12].frame, 11, 'The actor remains invisible between the two effects');
      assert.ok(Math.abs(arrival[0].world - start.world) > 500, 'Relocation covers the skipped sections');
      assert.ok(Math.abs(arrival[0].content - start.content) > 500, 'Panels keep scrolling');
      assert.notEqual(arrival[0].parallax, start.parallax, 'Scenery keeps scrolling');
      await page.screenshot({ path: `${shots}/teleport-${target}-arrival.png` });
      await finish();
    }

    // Reverse while materialising, disappearing or invisible; keep the current
    // pose and world position through the click, then complete the last request.
    for (const fraction of [.06, .5, .91]) {
      await nav('home');
      const before = await scrub(fraction);
      await nav('contact');
      const after = await scrub(0);
      assert.equal(after.frame, before.frame, 'Retarget starts at the visible pose');
      assert.ok(Math.abs(after.world - before.world) < .02, 'Retarget does not move a visible actor');
      await finish();
      await nav('projects'); // Adjacent travel returns to walking after completion.
      assert.equal(await page.locator('#avatar.walking').count(), 1);
      await finish();
    }

    for (const fraction of [.06, .5, .91]) {
      await nav('home');
      const before = await scrub(fraction);
      const width = page.viewportSize().width === 1440 ? 1366 : 1440;
      await page.setViewportSize({ width, height: width === 1366 ? 720 : 900 });
      await page.waitForTimeout(60);
      const after = await snapshot();
      assert.equal(after.teleporting, true);
      assert.ok(Math.abs(after.frame - before.frame) <= 2, 'Resize resumes the current sequence');
      assert.ok(Math.abs(after.world - before.world) < .02, 'Resize keeps the same world anchor');
      await finish();
      await nav('projects');
      await finish();
    }

    // Reproduce CSS cancellation before a resize callback takes ownership.
    // A cancelled transition must never be mistaken for a completed journey.
    await nav('home');
    await scrub(.35);
    const cancelledPhase = await page.evaluate(async () => {
      document.querySelector('.bridge-track').getAnimations()[0].cancel();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      const phase = document.querySelector('.journey-strip').dataset.phase;
      window.dispatchEvent(new Event('resize'));
      return phase;
    });
    assert.equal(cancelledPhase, 'approaching', 'Cancellation must not commit the destination');
    await page.waitForTimeout(60);
    await finish();
    await nav('projects');
    await finish();

    await nav('home');
    await scrub(.5);
    await page.locator('#motion').click();
    assert.equal(await page.locator('#avatar.teleporting, #avatar[data-teleport]').count(), 0);
    assert.equal((await snapshot()).phase, 'waiting');
    await page.locator('#motion').click();
    await nav('contact');
    await scrub(.5);
    await page.locator('[data-mode="read"]').click();
    assert.equal(await page.locator('#avatar.teleporting, #avatar[data-teleport]').count(), 0);
    await page.locator('[data-mode="journey"]').click();
    await nav('home');
    await scrub(.5);
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, value: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    assert.equal(await page.locator('#avatar.teleporting, #avatar[data-teleport]').count(), 0);
    assert.equal((await snapshot()).phase, 'waiting');
    assert.deepEqual(errors, []);
    console.log('PASS: teleport frames, floor/world anchors, scrolling, reversals, resizes and cancellation.');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
