// Quick look: 1 camera angle x 4 hours into .playwright-mcp/work (gitignored). See shot-sheet.js.
//
// Run it through the Playwright MCP `browser_run_code_unsafe` tool with
// `filename: "scripts/shot-sheet.js"` (or paste the function into any
// Playwright `page` runner), against a dev server you started yourself, e.g.
//   npx vite --port 5174 --strictPort
// Edit OUT (and optionally HOURS / ANGLES / EXTRA_QUERY) before running.
//
// The sheet is the M2 exit evidence: 06:00, 12:00, 18:30 and 21:00 from four
// yaw stops 90 degrees apart, HUD hidden (?shot), fixed seed.
// prettier-ignore
async (page) => {
  const BASE = 'http://localhost:5174/';
  const OUT = '.playwright-mcp/work';
  const HOURS = [6, 12, 18.5, 21];
  const ANGLES = 1;
  const DISTANCE = 105;
  const EXTRA_QUERY = '';

  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(`${BASE}?golden&shot&seed=olympus-07&hour=12${EXTRA_QUERY}`);
  await page.waitForFunction(() => window.__regolith !== undefined);
  await page.evaluate((d) => window.__regolith.rig.setDistance(d), DISTANCE);
  await page.waitForTimeout(800);

  const files = [];
  for (let a = 0; a < ANGLES; a++) {
    for (const h of HOURS) {
      await page.evaluate((hour) => window.__regolith.setHour(hour), h);
      await page.waitForTimeout(350);
      const name = `${OUT}/a${a}-${String(Math.floor(h)).padStart(2, '0')}${h % 1 ? '30' : '00'}.png`;
      await page.screenshot({ path: name });
      files.push(name);
    }
    // Two 45 degree stops = a quarter turn; let the easing settle.
    await page.evaluate(() => {
      window.__regolith.rig.rotateStep(1);
      window.__regolith.rig.rotateStep(1);
    });
    await page.waitForTimeout(900);
  }
  return files;
}
