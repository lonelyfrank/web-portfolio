// Full random cycles: ten visible bubbles, atomic swaps and organic gap filling.
const assert = require('node:assert/strict');
const { chromium, url, shots, browserOptions, setSystemMotion, trackErrors } = require('./browser-settings.cjs');
(async () => {
  const browser = await chromium.launch(browserOptions);
  try {
    for (const width of [1440, 1024, 390, 320]) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      const errors = [];
      trackErrors(page, errors);
      // Different reproducible random schedules exercise both single and double births.
      await page.addInitScript(seed => {
        Math.random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
      }, width);
      const epoch = new Date('2026-10-24T10:00:00Z');
      await page.clock.install({ time: epoch }); await page.clock.pauseAt(epoch);
      await page.goto(`${url}/#about`);
      await page.locator('.skill-orbits').scrollIntoViewIfNeeded();
      await page.waitForFunction(() => !document.querySelector('.skill-orbits').classList.contains('is-paused'));
      const snapshot = () => page.locator('.skill-orbits').evaluate(field => {
        const area = field.getBoundingClientRect();
        return [...field.querySelectorAll('[data-alive]')].map(n => {
          const r = n.getBoundingClientRect(), img = n.querySelector('img');
          return { key: img.getAttribute('src'), name: n.textContent.trim(), x: r.x - area.x, y: r.y - area.y,
            w: r.width, h: r.height, fw: area.width, fh: area.height, opacity: Number(getComputedStyle(n).opacity),
            scale: new DOMMatrixReadOnly(getComputedStyle(img).transform).a };
        });
      });
      await page.clock.runFor(80);
      const resting = await snapshot();
      assert.equal(resting.length, 10);
      if (width >= 1024) {
        const left = resting.reduce((a, b) => a.x < b.x ? a : b);
        const area = await page.locator('.skill-orbits').boundingBox();
        await page.mouse.move(area.x + left.x + left.w / 2 - 8, area.y + left.y + left.w / 2);
        const moved = state => state.filter(b => {
          const before = resting.find(a => a.key === b.key);
          return Math.hypot(b.x - before.x, b.y - before.y) > .5;
        });
        await page.clock.runFor(100);
        assert.equal(moved(await snapshot()).length, 1, 'Nearest bubble reacts first');
        await page.clock.runFor(350);
        assert.ok(moved(await snapshot()).length >= 2 && moved(await snapshot()).length <= 4, 'Only a local chain moves');
        await page.mouse.move(2, 2);
        await page.clock.runFor(550);
        assert.equal(moved(await snapshot()).length, 0, 'Group settles when pointer leaves');
      }
      // Audit every frame, including frames between the slower geometry samples.
      await page.evaluate(() => {
        window.bubbleAudit = { bad: [], swaps: [] };
        const field = document.querySelector('.skill-orbits');
        new MutationObserver(records => {
          const retired = records.filter(r => r.attributeName === 'data-alive' && !r.target.hasAttribute('data-alive'));
          if (retired.length) window.bubbleAudit.swaps.push({ time: performance.now(), count: retired.length });
        }).observe(field, { subtree: true, attributes: true, attributeFilter: ['data-alive'] });
        const audit = () => {
          const nodes = [...field.children].filter(n => Number(n.style.opacity) > .08);
          if (nodes.length !== 10) window.bubbleAudit.bad.push({ count: nodes.length, time: performance.now() });
          window.bubbleAudit.frame = requestAnimationFrame(audit);
        };
        audit();
      });
      let previous = await snapshot();
      const seen = new Set(previous.map(b => b.key)), births = [];
      let concurrentReflows = 0, priorBirth = null;
      for (let elapsed = .25; elapsed <= 85; elapsed += .25) {
        await page.clock.runFor(250);
        const bubbles = await snapshot();
        assert.equal(bubbles.length, 10);
        assert.ok(bubbles.every(b => b.opacity === 1 && b.scale >= .18), 'All ten remain visible during every replacement');
        assert.equal(new Set(bubbles.map(b => b.name)).size, 10, 'No duplicate Windows variants');
        const incoming = bubbles.filter(b => !previous.some(p => p.key === b.key));
        for (const b of bubbles) {
          seen.add(b.key);
          assert.ok(b.x >= -1 && b.y >= -1 && b.x + b.w <= b.fw + 1 && b.y + b.h <= b.fh + 1,
            `${width}: bubble escapes its column`);
        }
        if (incoming.length) {
          assert.ok(incoming.length === 1 || incoming.length === 2);
          incoming.forEach(b => {
            assert.ok(b.scale < .35, 'New bubbles start small');
            births.push([b.x + b.w / 2, b.y + b.h / 2]);
          });
          priorBirth = { before: previous, born: new Set(incoming.map(b => b.key)), remaining: 4 };
        }
        if (priorBirth) {
          const growing = bubbles.filter(b => priorBirth.born.has(b.key));
          const neighboursMoved = bubbles.filter(b => !priorBirth.born.has(b.key)).some(b => {
            const old = priorBirth.before.find(p => p.key === b.key);
            return old && Math.hypot(b.x - old.x, b.y - old.y) > 1;
          });
          if (growing.some(b => b.scale < .98) && neighboursMoved) concurrentReflows++;
          if (--priorBirth.remaining <= 0) priorBirth = null;
        }
        // Mature spheres remain close but logos must not bury each other.
        const mature = bubbles.filter(b => b.scale > .98);
        for (let i = 0; i < mature.length; i++) for (const b of mature.slice(i + 1)) {
          const a = mature[i];
          assert.ok(Math.hypot(a.x - b.x, a.y - b.y) > a.w * .60, `${width}: logos overlap deeply`);
        }
        previous = bubbles;
        if (elapsed === 12) await page.screenshot({ path: `${shots}/foam-ten-${width}.png` });
      }
      const audit = await page.evaluate(() => {
        cancelAnimationFrame(window.bubbleAudit.frame);
        return window.bubbleAudit;
      });
      assert.deepEqual(audit.bad, [], 'Ten visible bubbles on every animation frame');
      assert.ok(audit.swaps.some(s => s.count === 1) && audit.swaps.some(s => s.count === 2));
      const intervals = audit.swaps.slice(1).map((s, i) => (s.time - audit.swaps[i].time) / 1000);
      assert.ok(Math.max(...intervals) - Math.min(...intervals) > 1, 'Intervals are irregular');
      intervals.forEach(interval => assert.ok(interval >= 2.1 && interval <= 5.1));
      assert.equal(seen.size, 18);
      assert.ok(concurrentReflows >= 10, 'Growth and neighbour movement happen together');
      const span = axis => Math.max(...births.map(p => p[axis])) - Math.min(...births.map(p => p[axis]));
      assert.ok(span(0) > previous[0].w * .6 && span(1) > previous[0].w * .6, 'Births use varied gaps, not a fixed centre');
      assert.equal(await page.locator('.skill-name').evaluateAll(nodes => nodes.every(n => getComputedStyle(n).clipPath === 'inset(50%)')), true);
      assert.equal(await page.locator('.skill-orb img').evaluateAll(imgs => imgs.every(i => i.complete && i.naturalWidth > 0)), true);
      await page.evaluate(() => {
        Object.defineProperty(document, 'hidden', { configurable: true, value: true });
        document.dispatchEvent(new Event('visibilitychange'));
      });
      const paused = await snapshot();
      await page.clock.runFor(30000);
      assert.deepEqual(await snapshot(), paused);
      await page.evaluate(() => { delete document.hidden; document.dispatchEvent(new Event('visibilitychange')); });
      await setSystemMotion(page, 'reduce');
      await page.waitForFunction(() => !document.querySelector('.skill-orbits').classList.contains('is-floating'));
      assert.equal(await page.locator('.skill-orb:visible').count(), 18);
      const still = await page.locator('.skill-orbits').innerHTML();
      await page.clock.runFor(30000);
      assert.equal(await page.locator('.skill-orbits').innerHTML(), still);
      assert.deepEqual(errors, []);
      await page.close();
      console.log(`Foam OK at ${width}px: always ten visible, random single/double swaps, 18 assets, varied gaps, concurrent growth/reflow, mouse and reduced motion`);
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
