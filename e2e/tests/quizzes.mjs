import { chromium, BASE, contextFor, tracker, sleep, watchResponses, SHOTS } from "../lib/pw.mjs";
const t = tracker();
const browser = await chromium.launch();
const bad = [];
try {
  for (const [game, query] of [["output-oracle", "rounds=5&language=mixed"], ["big-o-blitz", "rounds=5"], ["bug-hunt", "rounds=5"]]) {
    const page = await (await contextFor(browser, "alice")).newPage();
    t.watch(page, game); watchResponses(page, bad);
    await page.goto(`${BASE}/games/${game}/solo?${query}`, { waitUntil: "networkidle" });
    await sleep(3400);
    await page.screenshot({ path: `${SHOTS}/${game}-question.png` });
    for (let round = 0; round < 5; round++) {
      // Answer: the first choice (or the third line in Bug Hunt).
      if (game === "bug-hunt") {
        const lines = page.locator("button.flex.w-full.text-left");
        await lines.nth(Math.min(2, (await lines.count()) - 1)).click();
      } else {
        await page.locator("button.group.flex.min-h-14").first().click();
      }
      await sleep(400);
      if (round === 0) await page.screenshot({ path: `${SHOTS}/${game}-reveal.png` });
      // Wait out the reveal.
      await sleep(game === "bug-hunt" ? 4600 : game === "big-o-blitz" ? 3600 : 3900);
    }
    await sleep(800);
    const dialog = page.getByRole("dialog", { name: "Results" });
    t.check(`${game}: 5 rounds then results`, (await dialog.count()) === 1);
    const text = (await dialog.textContent()) ?? "";
    t.check(`${game}: results count right answers`, /\d of 5 right/.test(text), text.slice(0, 120));
    await page.close();
  }
} finally { await browser.close(); }
console.log("failed responses:", bad.length ? bad.join(" | ") : "none");
t.done();
