// Full random cycles: random pops, births in sequence after each pop, a cluster that stays packed.
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
      // Bubbles belong to Journey; Reading uses the static labelled grid (check-about).
      await page.addInitScript(() => localStorage.setItem('fs-mode', 'journey'));
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
        // Hover grows the bubble under the pointer and the others make room; nothing else moves.
        const target = resting.find(b => b.scale > .98 && b.x > resting[0].fw * .3 && b.x < resting[0].fw * .6) || resting[0];
        const area = await page.locator('.skill-orbits').boundingBox();
        await page.mouse.move(area.x + target.x + target.w / 2, area.y + target.y + target.h / 2);
        await page.clock.runFor(900);
        const grown = await snapshot();
        const hovered = grown.find(b => b.key === target.key);
        assert.ok(hovered.scale > 1.15 && hovered.scale < 1.3, 'Hovered bubble grows a little');
        assert.equal(grown.filter(b => b.scale > 1.02).length, 1, 'Only the hovered bubble grows');
        const shifted = grown.filter(b => b.key !== target.key && Math.hypot(b.x - resting.find(a => a.key === b.key).x,
          b.y - resting.find(a => a.key === b.key).y) > .5);
        assert.ok(shifted.length >= 1, 'Neighbours make room for the grown bubble');
        assert.ok(await page.locator('.skill-orbits').evaluate(n => n.classList.contains('is-hovering')));
        await page.mouse.move(2, 2);
        await page.clock.runFor(1500);
        assert.ok((await snapshot()).every(b => Math.abs(b.scale - 1) < .02), 'Bubbles return to size when the pointer leaves');
        // Easter egg: a double click pops the bubble and the replacement follows.
        await page.evaluate(() => {
          window.eggOrder = '';
          new MutationObserver(records => {
            for (const r of records) {
              const on = r.target.hasAttribute(r.attributeName);
              if (r.attributeName === 'data-popping' && on) window.eggOrder += 'P';
              if (r.attributeName === 'data-alive' && on && r.oldValue === null) window.eggOrder += 'B';
            }
          }).observe(document.querySelector('.skill-orbits'), { subtree: true, attributes: true,
            attributeOldValue: true, attributeFilter: ['data-alive', 'data-popping'] });
        });
        const clickable = (await snapshot()).filter(b => b.scale > .98).pop();
        await page.mouse.dblclick(area.x + clickable.x + clickable.w / 2, area.y + clickable.y + clickable.h / 2);
        await page.clock.runFor(120);
        assert.equal(await page.locator('.skill-orbits [data-popping]').count(), 1, 'Double click pops the bubble');
        await page.clock.runFor(1800);
        const after = await snapshot();
        assert.equal(after.length, 10, 'A new bubble is generated after the pop');
        assert.ok(!after.some(b => b.key === clickable.key), 'The clicked bubble is gone');
        assert.ok((await page.evaluate(() => window.eggOrder)).replace(/^B/, '').startsWith('P'), 'The double click pops a bubble');
        assert.ok((await page.evaluate(() => window.eggOrder)).includes('PB'), 'A birth follows the pop');
        await page.mouse.move(2, 2);
        await page.clock.runFor(2500);
      }
      // Audit every frame: population bounds and the order of pops (P) and births (B).
      await page.evaluate(() => {
        window.bubbleAudit = { bad: [], order: '', popped: [], times: [] };
        const field = document.querySelector('.skill-orbits');
        new MutationObserver(records => {
          for (const r of records) {
            const n = r.target, on = n.hasAttribute(r.attributeName);
            if (r.attributeName === 'data-popping' && on) {
              window.bubbleAudit.order += 'P';
              window.bubbleAudit.popped.push(n.textContent.trim());
              window.bubbleAudit.times.push(performance.now());
            }
            if (r.attributeName === 'data-alive' && on && r.oldValue === null) window.bubbleAudit.order += 'B';
          }
        }).observe(field, { subtree: true, attributes: true, attributeOldValue: true,
          attributeFilter: ['data-alive', 'data-popping'] });
        const audit = () => {
          const count = field.querySelectorAll('[data-alive]').length;
          if (count < 9 || count > 10) window.bubbleAudit.bad.push({ count, time: performance.now() });
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
        assert.ok(bubbles.length >= 9 && bubbles.length <= 10, 'Nine or ten bubbles at any time');
        assert.equal(new Set(bubbles.map(b => b.name)).size, bubbles.length, 'No duplicate Windows variants');
        const incoming = bubbles.filter(b => !previous.some(p => p.key === b.key));
        for (const b of bubbles) {
          seen.add(b.key);
          assert.ok(b.x >= -1 && b.y >= -1 && b.x + b.w <= b.fw + 1 && b.y + b.h <= b.fh + 1,
            `${width}: bubble escapes its column`);
        }
        if (incoming.length) {
          assert.equal(incoming.length, 1, 'Births are sequential, one at a time');
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
        // Mature spheres stay packed without burying each other's logos.
        const mature = bubbles.filter(b => b.scale > .98 && b.opacity === 1);
        for (let i = 0; i < mature.length; i++) for (const b of mature.slice(i + 1)) {
          const a = mature[i];
          assert.ok(Math.hypot(a.x - b.x, a.y - b.y) > a.w * .60, `${width}: logos overlap deeply`);
        }
        if (elapsed > 3) for (const a of mature) {
          const nearest = Math.min(...bubbles.filter(b => b !== a).map(b => Math.hypot(a.x - b.x, a.y - b.y)));
          assert.ok(nearest < a.w * 1.35, `${width}: cluster stays compact, a bubble drifts alone`);
        }
        previous = bubbles;
        if (elapsed === 12) await page.screenshot({ path: `${shots}/foam-ten-${width}.png` });
      }
      const audit = await page.evaluate(() => {
        cancelAnimationFrame(window.bubbleAudit.frame);
        return window.bubbleAudit;
      });
      assert.deepEqual(audit.bad, [], 'Never fewer than nine or more than ten bubbles');
      // The audit may begin while the birth of an earlier pop is still pending.
      assert.match(audit.order.replace(/^B/, ''), /^P(BP?)*B?$/, 'Pops are followed by births, never two births in a row');
      assert.ok(!audit.order.includes('BB'), 'Births are sequential');
      assert.ok(audit.order.split('P').length - 1 >= 8, 'Pops keep happening, at a calm pace');
      assert.ok(new Set(audit.popped).size >= 6, 'Pops hit many different bubbles at random');
      const gaps = audit.times.slice(1).map((t, i) => (t - audit.times[i]) / 1000);
      assert.ok(Math.max(...gaps) - Math.min(...gaps) > 1, 'Intervals are irregular');
      assert.ok(gaps.every(g => g >= 2), 'Pops are never close together');
      assert.ok(gaps.filter(g => g >= 4.9 && g <= 7.1).length >= gaps.length / 2, 'Most pops are 5-7 s apart');
      assert.ok(seen.size >= 15, 'Many different assets rotate in');
      assert.ok(concurrentReflows >= 8, 'Growth and neighbour movement happen together');
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
      console.log(`Foam OK at ${width}px: random pops, sequential births, compact cluster, varied gaps, concurrent growth/reflow, mouse and reduced motion`);
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
