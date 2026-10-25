// Optional cascade comparison against a separately served original checkout.
// Every element and pseudo-element of the body is compared property by property,
// in Reading, Journey (each section), mobile Journey, no JavaScript, forced sprite
// states and the open dialog. Reduced motion keeps the values deterministic; a
// second pass compares only animation and transition declarations in full motion.
const assert = require('node:assert/strict');
const { chromium, url, browserOptions } = require('./browser-settings.cjs');
const baseline = process.env.PORTFOLIO_BASELINE_URL;
assert.ok(baseline, 'Set PORTFOLIO_BASELINE_URL to the original site served locally');

const SECTIONS = ['home', 'about', 'projects', 'contact'];
const READ = [[320, 568], [390, 844], [820, 900], [1024, 768], [1280, 800], [1440, 900], [1920, 1080], [2560, 1440]];
const JOURNEY = [[390, 844], [900, 640], [1024, 768], [1280, 600], [1366, 768], [1440, 900], [1600, 900], [1920, 1080], [2560, 1440]];
const MOTION_PROPERTIES = '^(animation|transition)';

// Runs in the page. Returns one hash per element, or the full values of `only`.
function inspect([filter, only]) {
  const origin = location.origin;
  const pattern = filter && new RegExp(filter);
  const key = node => {
    const parts = [];
    for (; node && node !== document.body; node = node.parentElement) {
      const siblings = [...node.parentElement.children].filter(n => n.tagName !== 'SCRIPT');
      parts.unshift(`${node.tagName.toLowerCase()}:${siblings.indexOf(node)}`);
    }
    return parts.join('>');
  };
  const read = (node, pseudo) => {
    const style = getComputedStyle(node, pseudo);
    if (pseudo && style.content === 'none') return null;
    const values = [];
    for (let i = 0; i < style.length; i++) {
      if (pattern && !pattern.test(style[i])) continue;
      values.push(`${style[i]}: ${style.getPropertyValue(style[i]).split(origin).join('')}`);
    }
    // Custom properties are enumerated in no stable order.
    return values.sort();
  };
  const hash = text => {
    let h = 2166136261;
    for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
    return h >>> 0;
  };
  const result = {};
  for (const node of document.body.querySelectorAll('*')) {
    if (node.tagName === 'SCRIPT') continue;
    const id = key(node);
    const pseudos = ['::before', '::after'];
    if (node.tagName === 'DIALOG') pseudos.push('::backdrop');
    if (getComputedStyle(node).display === 'list-item') pseudos.push('::marker');
    for (const pseudo of ['', ...pseudos]) {
      if (only && !only.includes(id + pseudo)) continue;
      const values = read(node, pseudo || null);
      if (values) result[id + pseudo] = only ? values : hash(values.join('\n'));
    }
  }
  return result;
}

(async () => {
  const browser = await chromium.launch(browserOptions);
  const differences = [];
  let states = 0;
  const travel = section => async page => {
    await page.locator(`.site-nav [href="#${section}"]`).click();
    await page.waitForFunction(id => document.querySelector('.page.active')?.id === id
      && document.querySelector('.journey-strip').dataset.phase === 'waiting', section);
  };
  // Both versions advance in lockstep; details are fetched only for diverging elements.
  const run = async ({ viewport, mode, reducedMotion = 'reduce', javaScriptEnabled = true }, steps) => {
    const pages = await Promise.all([baseline, url].map(async address => {
      const page = await browser.newPage({ viewport: { width: viewport[0], height: viewport[1] }, reducedMotion, javaScriptEnabled });
      if (mode) await page.addInitScript(mode => localStorage.setItem('fs-mode', mode), mode);
      await page.addInitScript(() => {
        let seed = 7;
        Math.random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
      });
      await page.goto(address);
      await page.evaluate(() => document.fonts.ready);
      return page;
    }));
    try {
      for (const [label, action, filter = null] of steps) {
        if (action) await Promise.all(pages.map(action));
        // Let observers and frame callbacks triggered by the action settle.
        await Promise.all(pages.map(page => page.waitForTimeout(400)));
        const [before, after] = await Promise.all(pages.map(page => page.evaluate(inspect, [filter, null])));
        const changed = [...new Set([...Object.keys(before), ...Object.keys(after)])].filter(key => before[key] !== after[key]);
        const prefix = `${viewport.join('×')} ${label}`;
        if (changed.length) {
          const [old, current] = await Promise.all(pages.map(page => page.evaluate(inspect, [filter, changed])));
          for (const key of changed) {
            if (!old[key] || !current[key]) { differences.push(`${prefix} ${key}: ${old[key] ? 'missing' : 'extra'}`); continue; }
            const a = new Set(old[key]), b = new Set(current[key]);
            const removed = old[key].filter(v => !b.has(v)), added = current[key].filter(v => !a.has(v));
            differences.push(`${prefix} ${key}\n    - ${removed.join('\n    - ')}\n    + ${added.join('\n    + ')}`);
          }
        }
        states++;
      }
    } finally { await Promise.all(pages.map(page => page.close())); }
  };

  try {
    for (const viewport of READ) await run({ viewport, mode: 'read' }, [['read']]);
    for (const viewport of JOURNEY) {
      await run({ viewport, mode: 'journey' }, SECTIONS.map(section => [`journey ${section}`, travel(section)]));
    }
    for (const viewport of [[390, 844], [1440, 900]]) await run({ viewport, javaScriptEnabled: false }, [['no-js']]);
    await run({ viewport: [1440, 900], mode: 'read', reducedMotion: 'no-preference' }, [['read motion', null, MOTION_PROPERTIES]]);
    await run({ viewport: [1440, 900], mode: 'journey', reducedMotion: 'no-preference' },
      SECTIONS.map(section => [`journey ${section} motion`, travel(section), MOTION_PROPERTIES]));

    const sprite = (classes, frame) => page => page.locator('#avatar').evaluate((node, [classes, frame]) => {
      node.className = `avatar ${classes}`;
      node.style.setProperty('--teleport-frame', frame);
      node.style.setProperty('--cycle-ms', '571ms');
    }, [classes, frame]);
    await run({ viewport: [1440, 900], mode: 'journey' }, [
      ['avatar walking', sprite('walking', 0)],
      ['avatar walking back', sprite('walking back', 0)],
      ['avatar petting', sprite('petting', 0)],
      ['avatar teleporting', sprite('teleporting back', 7)],
    ]);
    await run({ viewport: [1440, 900], mode: 'journey' }, [['dialog', async page => {
      await travel('projects')(page);
      await page.locator('.project:not([hidden]) summary').click();
      await page.locator('#detail[open]').waitFor();
    }]]);
    await run({ viewport: [390, 844], mode: 'read' }, [['details open', page => page.locator('#project-1 summary').click()]]);
  } finally { await browser.close(); }

  if (differences.length) {
    console.error(differences.slice(0, 40).join('\n'));
    console.error([...new Set(differences.map(line => line.split(/ (?=[a-z]+:\d)/)[0]))].join('\n'));
    console.error(`${differences.length} elements differ in ${states} states.`);
    process.exitCode = 1;
  } else console.log(`PASS: identical computed styles for every element in ${states} states.`);
})().catch(error => { console.error(error); process.exitCode = 1; });
