// Rendered intermediate frames, fixed world anchors and interrupted navigation.
// Same PLAYWRIGHT_MODULE / BROWSER_EXECUTABLE / PORTFOLIO_URL as check-stations.
const assert = require('node:assert/strict');
const { chromium, url, shots, browserOptions, setSystemMotion, trackErrors } = require('./browser-settings.cjs');

(async () => {
  const browser = await chromium.launch(browserOptions);
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  trackErrors(page, errors);
  try {
    await page.clock.install();
    await page.goto(url);
    await page.locator('[data-mode="journey"]').click();
    await page.evaluate(() => document.fonts.ready);
    const nav = async id => {
      await page.locator(`.site-nav a[href="#${id}"]`).click();
      await page.waitForFunction(id => document.querySelector('.page.active').id === id, id);
    };
    const snapshot = () => page.evaluate(() => {
      const main = document.querySelector('main');
      const gutter = parseFloat(getComputedStyle(main).paddingLeft);
      const base = main.getBoundingClientRect().left + gutter;
      const width = main.clientWidth - 2 * gutter;
      return [...document.querySelectorAll('.page')].map(n => {
        const x = parseFloat(getComputedStyle(n).translate);
        const children = [...n.querySelectorAll('h1, h2, .hero, .role, .intro, .actions, .about-bio, .about-skills, .about-education, .contact-intro, .contact-channel, .holo-deck')];
        return { id: n.id, x, left: base + x, right: base + x + width,
          hidden: n.hidden, inert: n.inert, opacity: getComputedStyle(n).opacity,
          childOpacity: children.map(c => getComputedStyle(c).opacity),
          locals: n.hidden ? [] : children.map(c => c.getBoundingClientRect().left - n.getBoundingClientRect().left),
          screen: innerWidth, gap: Math.max(40, gutter),
        };
      });
    });
    const validate = (frames, active) => {
      for (const n of frames) {
        const inView = n.right > 1 && n.left < n.screen - 1;
        if (inView) assert.equal(n.hidden, false, `${n.id}: hidden while crossing viewport`);
        assert.equal(n.inert, n.id !== active, `${n.id}: navigation and visibility are separate`);
        assert.equal(n.opacity, '1', `${n.id}: no page fade`);
        assert.ok(n.childOpacity.every(o => o === '1'), `${n.id}: no scene-driven text fade`);
      }
      const sorted = [...frames].sort((a, b) => a.left - b.left);
      for (let i = 1; i < sorted.length; i++) {
        assert.ok(Math.abs(sorted[i].left - sorted[i - 1].right - sorted[i].gap) < .1,
          `Consecutive slides retain only the minimum gap for the viewport: ${JSON.stringify(sorted)}`);
      }
    };
    // Scrub the browser's real camera transition, not a simulated page transform.
    // Pausing at fractions makes even a one-frame reveal error reproducible.
    const frame = async fraction => {
      await page.evaluate(fraction => {
        for (const node of [document.querySelector('.bridge-track'), document.querySelector('#avatar')]) {
          for (const animation of node.getAnimations()) {
            animation.pause();
            animation.currentTime = animation.effect.getTiming().duration * fraction;
          }
        }
      }, fraction);
      await page.waitForTimeout(50);
      return snapshot();
    };
    const finish = async () => {
      const duration = await page.evaluate(() => {
        const camera = document.querySelector('.bridge-track');
        const duration = parseFloat(getComputedStyle(camera).transitionDuration) * 1000;
        for (const n of [camera, document.querySelector('#avatar')]) n.getAnimations().forEach(a => a.finish());
        return duration;
      });
      await page.clock.fastForward(duration + 600);
      await page.waitForFunction(() => ['waiting', 'interacting'].includes(document.querySelector('.journey-strip').dataset.phase));
    };

    for (const [from, to] of [['home', 'about'], ['about', 'home'], ['home', 'contact'],
      ['contact', 'about'], ['about', 'contact'], ['contact', 'projects'], ['projects', 'about']]) {
      await nav(to);
      const first = await frame(0);
      validate(first, to);
      assert.ok(Math.abs(first.find(n => n.id === to).x) > 500, 'Destination must never flash in the centre');
      let previous = first;
      for (const fraction of [.12, .35, .5, .65, .88, .99]) {
        const current = await frame(fraction);
        validate(current, to);
        for (let i = 0; i < current.length; i++) {
          assert.ok(Math.abs((current[i].x - previous[i].x) - (current[0].x - previous[0].x)) < .1,
            'All compositions share exactly the camera displacement');
          if (previous[i].locals.length && current[i].locals.length) {
            current[i].locals.forEach((x, j) => assert.ok(Math.abs(x - previous[i].locals[j]) < .1,
              'Internal alignment stays rigid'));
          }
        }
        if (fraction === .5 && ['home-about', 'contact-about', 'contact-projects'].includes(`${from}-${to}`)) {
          await page.screenshot({ path: `${shots}/journey-${from}-${to}-mid.png` });
        }
        if ((from === 'home' && to === 'about' && [.12, .35, .88].includes(fraction))
          || (from === 'about' && to === 'home' && fraction === .35)
          || (from === 'about' && to === 'contact' && fraction === .88)) {
          await page.screenshot({ path: `${shots}/journey-${from}-${to}-${fraction}.png` });
        }
        previous = current;
      }
      await finish();
      validate(await snapshot(), to);
      assert.ok(Math.abs((await snapshot()).find(n => n.id === to).x) < .01);
      console.log(`Journey frames OK: ${from} → ${to}`);
    }

    // A real-time departure must retain its outgoing content after the old 180ms timer.
    await nav('home');
    await page.waitForTimeout(300);
    assert.equal(await page.locator('#about').evaluate(n => n.hidden), false);
    await frame(.5);
    const before = await snapshot();
    await nav('about');
    const after = await frame(0);
    before.forEach((n, i) => assert.ok(Math.abs(n.x - after[i].x) < 2, 'Reversal must start at the rendered position'));
    await finish();

    for (const target of ['contact', 'home', 'projects', 'contact', 'about']) {
      const before = await frame(0);
      await nav(target);
      const after = await frame(0);
      before.forEach((n, i) => assert.ok(Math.abs(n.x - after[i].x) < 12, 'Rapid requests must preserve world anchors'));
      validate(after, target);
    }
    await finish();
    await page.waitForTimeout(300);
    assert.equal(await page.locator('#about').evaluate(n => n.hidden), false, 'No stale exit timer');

    // Tabbing into the destination must not scroll the world horizontally.
    await nav('contact');
    await frame(.2);
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(() => !!document.activeElement.closest('.page[inert]')), false);
    assert.equal(await page.evaluate(() => scrollX + document.body.scrollLeft + document.querySelector('main').scrollLeft), 0);
    await nav('about');
    await finish();

    // An interrupted interaction can leave the feet already at their target
    // world coordinate, with the camera still offset. Reframe without a snap.
    const reframe = await page.evaluate(async () => {
      const { avatar, track } = await import('./js/dom.js');
      const { director } = await import('./js/stage/director.js');
      const { cancelStation } = await import('./js/stage/stations.js');
      const { contentPositions, currentCam, positionContent, setCam } = await import('./js/stage/camera.js');
      const { currentActor, restActor, setActor } = await import('./js/stage/actor.js');
      const { show } = await import('./js/navigation.js');
      director.cancel();
      cancelStation();
      setCam(contentPositions.get(1) + 30);
      setActor(restActor(1) - 30);
      void avatar.offsetWidth;
      positionContent();
      const before = currentCam() + currentActor();
      show(1);
      return { before, duration: parseFloat(getComputedStyle(track).transitionDuration) };
    });
    assert.ok(reframe.duration > .1, 'Zero ground distance still needs a smooth camera transition');
    await frame(.5);
    assert.ok(Math.abs(await page.evaluate(async () => {
      const { currentCam } = await import('./js/stage/camera.js');
      const { currentActor } = await import('./js/stage/actor.js');
      return currentCam() + currentActor();
    }) - reframe.before) < .1,
      'Camera reframing does not slide stationary feet');
    await finish();

    // Normalisation is a coordinate change, including scenery and bridge texture.
    const normalized = await page.evaluate(async () => {
      const { STAGE } = await import('./js/config.js');
      const { pages, stationNodes } = await import('./js/dom.js');
      const { director } = await import('./js/stage/director.js');
      const camera = await import('./js/stage/camera.js');
      const { currentCam, normalize, positionContent, setCam } = camera;
      director.cancel();
      setCam(currentCam() + STAGE.bay * 2);
      positionContent();
      const read = () => ({
        text: pages.map(n => n.style.getPropertyValue('--content-x')),
        scenery: getComputedStyle(document.querySelector('.skyline-near')).transform,
        station: stationNodes[1].getBoundingClientRect().left,
        texture: -currentCam() - camera.textureOffset,
      });
      const before = read();
      normalize();
      return { before, after: read() };
    });
    assert.deepEqual(normalized.after, normalized.before, 'Normalization must preserve every rendered coordinate');
    await nav('home');
    await finish();
    await nav('contact');
    await frame(.35);
    await page.setViewportSize({ width: 1920, height: 720 });
    await page.waitForTimeout(80);
    assert.equal(await page.locator('.journey-strip').getAttribute('data-phase'), 'approaching', 'Resize must resume, not settle');
    assert.ok(Math.abs((await snapshot()).find(n => n.id === 'contact').x) > 500);
    validate(await frame(.5), 'contact');
    await finish();
    await page.screenshot({ path: `${shots}/journey-contact-low-wide.png` });

    await nav('home');
    await frame(.3);
    await page.locator('[data-mode="read"]').click();
    await page.clock.fastForward(30000);
    assert.equal(await page.locator('.page[hidden], .page[inert]').count(), 0);
    await page.locator('[data-mode="journey"]').click();
    await setSystemMotion(page, 'reduce');
    for (const id of ['about', 'contact', 'projects', 'home']) {
      await nav(id);
      assert.equal(await page.locator(`#${id}`).evaluate(n => parseFloat(getComputedStyle(n).translate)), 0);
      assert.equal(await page.locator('.bridge-track').evaluate(n => n.getAnimations().length), 0);
      if (id === 'projects') {
        await page.locator('#project-next').click();
        await page.waitForFunction(() => !document.querySelector('.project-carousel').hasAttribute('aria-busy'));
        await page.locator('.project:not([hidden]) summary').click();
        assert.equal(await page.locator('#detail').evaluate(n => n.open), true);
        await page.locator('#detail .close').click();
        assert.equal(await page.locator('.station-projects').getAttribute('data-power'), 'on');
      }
    }
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(() => !!document.activeElement.closest('.page[inert]')), false);
    await setSystemMotion(page, 'no-preference');

    // Effective CSS viewport at 200% desktop zoom; long content must scroll.
    await page.setViewportSize({ width: 720, height: 450 });
    await setSystemMotion(page, 'reduce');
    await nav('about');
    await page.locator('#about').evaluate(n => { n.scrollTop = n.scrollHeight; });
    const education = await page.locator('.education-course li').last().boundingBox();
    const main = await page.locator('main').boundingBox();
    assert.ok(education.y + education.height <= main.y + main.height + 1);
    await nav('home');
    await page.locator('#home').evaluate(n => { n.scrollTop = 0; });
    const eyebrow = await page.locator('#home .eyebrow').boundingBox();
    assert.ok(eyebrow.y >= main.y, 'Home starts inside its scrollport at zoom');
    await page.locator('#home').evaluate(n => { n.scrollTop = n.scrollHeight; });
    const action = await page.locator('#home .actions a').last().boundingBox();
    assert.ok(action.y + action.height <= main.y + main.height + 1, 'Last Home CTA remains reachable');
    assert.deepEqual(errors, []);
    console.log('Journey OK: visibility, rigid groups, no overlap/fades, reversal, rapid requests, normalization, resize, modes, reduced motion, keyboard and zoom-sized viewport');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
