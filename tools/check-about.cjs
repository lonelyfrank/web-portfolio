// About layout, accessibility and scene independence. Same environment as check-stations.cjs.
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const url = process.env.PORTFOLIO_URL || 'http://127.0.0.1:8082';
const shots = process.env.SCREENSHOT_DIR || '/tmp';

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.BROWSER_EXECUTABLE || undefined });
  const errors = [];
  try {
    for (const [width, height] of [[1920, 1080], [1440, 900], [1366, 768], [1280, 600], [1024, 768], [820, 900], [390, 844], [320, 568]]) {
      const page = await browser.newPage({ viewport: { width, height } });
      page.on('pageerror', e => errors.push(e.message));
      page.on('response', r => { if (r.url().startsWith(url) && r.status() >= 400) errors.push(r.url()); });
      await page.goto(`${url}/#about`);
      await page.evaluate(() => document.fonts.ready);
      for (const mode of ['read', 'journey']) {
        await page.locator(`[data-mode="${mode}"]`).click();
        await page.locator('.site-nav a[href="#about"]').click();
        if (mode === 'journey') await page.waitForFunction(id =>
          document.querySelector('.page.active')?.id === id
          && ['waiting', 'interacting'].includes(document.querySelector('.journey-strip').dataset.phase), 'about', { timeout: 30000 });
        const about = page.locator('#about');
        await about.waitFor({ state: 'visible' });
        await page.waitForTimeout(350);
        assert.equal(await about.locator('[role="tab"], [role="tabpanel"], button, .scenic, .panel').count(), 0);
        assert.equal(await page.locator('[data-link="about"]').count(), 0);
        assert.deepEqual(await about.locator('.skill-name').allTextContents(), ['HTML', 'CSS', 'JavaScript', 'Windows', 'Vue', 'PHP', 'Laravel', 'AEM', 'WordPress', 'Jira', 'Linux', 'GitHub', 'Windows', 'React', 'Python', 'TypeScript', 'Claude', 'Shopify']);
        const layout = await about.evaluate(n => {
          const rect = s => {
            const r = n.querySelector(s).getBoundingClientRect();
            return { x: r.x, y: r.y, right: r.right, bottom: r.bottom };
          };
          return {
            bio: rect('.about-bio'), skills: rect('.about-skills'), education: rect('.about-education'),
            scrollWidth: n.scrollWidth, width: n.clientWidth, scrollHeight: n.scrollHeight, height: n.clientHeight,
            overflowY: getComputedStyle(n).overflowY,
            inert: !!n.closest('[inert]'), translate: getComputedStyle(n).translate,
            leadSize: parseFloat(getComputedStyle(n.querySelector('.about-lead')).fontSize),
          };
        });
        assert.equal(layout.inert, false);
        assert.ok(layout.leadSize >= 19, 'Introductory sentence has its own typographic emphasis');
        assert.ok(layout.scrollWidth <= layout.width + 1, `${width} ${mode}: horizontal clipping`);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
        if (width > 1000) {
          assert.ok(layout.bio.right < layout.skills.x && layout.skills.right < layout.education.x, 'Three separate columns');
        } else {
          assert.ok(layout.bio.bottom < layout.skills.y && layout.skills.bottom < layout.education.y, 'Biography, skills, education in reading order');
        }
        const hiddenNames = await about.locator('.skill-name').evaluateAll(nodes => nodes.every(n => {
          const style = getComputedStyle(n);
          return style.clipPath === 'inset(50%)' && n.getBoundingClientRect().width <= 1;
        }));
        assert.equal(hiddenNames, true, 'Names stay available to screen readers without visible subtitles');
        if (mode === 'journey') {
          assert.equal(parseFloat(layout.translate), 0);
          assert.equal(layout.overflowY, 'auto');
          // Even a compact viewport must let the last education bullet scroll into view,
          // above the animated scene, without switching to the next section.
          await about.evaluate(n => { n.scrollTop = n.scrollHeight; });
          const bottom = await about.locator('.education-course li').last().boundingBox();
          const main = await page.locator('main').boundingBox();
          const scene = await page.locator('.journey-strip').boundingBox();
          assert.ok(bottom.y + bottom.height <= main.y + main.height + 1);
          assert.ok(main.y + main.height <= scene.y + 1, 'Content viewport remains above the scene');
          await about.evaluate(n => { n.scrollTop = 0; });
        }
        if ([1920, 1280, 390].includes(width)) {
          if (mode === 'read') await about.screenshot({ path: `${shots}/about-${width}-${mode}.png` });
          else await page.screenshot({ path: `${shots}/about-${width}-${mode}.png` });
        }
      }
      // Both the system preference and the site's motion control stop the orbs.
      await page.emulateMedia({ reducedMotion: 'reduce' });
      assert.equal(await page.locator('.skill-orb').first().evaluate(n => getComputedStyle(n).animationName), 'none');
      await page.emulateMedia({ reducedMotion: 'no-preference' });
      await page.locator('#motion').click();
      assert.equal(await page.locator('.skill-orb').first().evaluate(n => getComputedStyle(n).animationName), 'none');
      await page.close();
      console.log(`About OK: ${width}×${height}, Lettura / Viaggio`);
    }
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(url);
    await page.locator('[data-mode="journey"]').click();
    await page.locator('.site-nav a[href="#about"]').click();
    await page.waitForFunction(() => document.querySelector('.journey-strip').dataset.phase === 'approaching');
    assert.equal(await page.locator('#about a').evaluate(n => !!n.closest('[inert]')), false);
    // Simulate the old scene's off state: About remains readable and focusable.
    await page.locator('#about').evaluate(n => { n.dataset.stage = 'off'; });
    assert.equal(await page.locator('.about-layout').evaluate(n => getComputedStyle(n).opacity), '1');
    await page.locator('#about a').focus();
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(() => !!document.activeElement.closest('#about')), false, 'No old tabs or skill buttons in keyboard order');
    await page.close();
    const noJS = await browser.newPage({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
    await noJS.goto(`${url}/#about`);
    assert.equal(await noJS.locator('.about-layout > :visible').count(), 3);
    assert.equal(await noJS.locator('.skill-name:visible').count(), 18);
    await noJS.close();
    assert.deepEqual(errors, []);
    console.log('About: scene independence, keyboard, reduced motion, no-JS and browser errors OK');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
