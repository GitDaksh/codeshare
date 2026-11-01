// A pointer resting on the very bottom edge of something that lifts on hover
// must not make it jitter (lift, lose the hover, drop back, hover, lift…).
import { chromium, BASE, contextFor, tracker, sleep } from "../lib/pw.mjs";

const t = tracker();
const browser = await chromium.launch();

// Rests the pointer 1px inside the bottom edge of `target` and reports whether
// the element (and the hover) settles.
async function settles(page, target) {
  const box = await target.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height - 1);
  await sleep(450);
  const samples = await target.evaluate(async (el) => {
    const out = [];
    for (let i = 0; i < 24; i++) {
      out.push(Math.round(el.getBoundingClientRect().top * 10) / 10 + (el.matches(":hover") ? "h" : ""));
      await new Promise((r) => requestAnimationFrame(r));
    }
    return out;
  });
  return { still: new Set(samples).size === 1, hovered: samples.every((s) => s.endsWith("h")), samples: [...new Set(samples)].join(" ") };
}

try {
  const context = await contextFor(browser, "alice", { viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  t.watch(page, "jitter");

  // A quiz answer.
  await page.goto(BASE + "/games/big-o-blitz/solo?rounds=5", { waitUntil: "networkidle" });
  await sleep(3600);
  const option = page.locator("button.group.flex.min-h-14").first();
  const quiz = await settles(page, option);
  t.check("a quiz answer holds still under a pointer on its bottom edge", quiz.still && quiz.hovered, quiz.samples);
  await option.click({ timeout: 3000 });
  t.check("and it can be clicked", true);

  // A card on the Games page.
  await page.goto(BASE + "/games", { waitUntil: "networkidle" });
  await sleep(1500);
  const card = page.locator("article").first().locator("xpath=..");
  const games = await settles(page, card);
  t.check("a game card holds still under a pointer on its bottom edge", games.still && games.hovered, games.samples);
} finally {
  await browser.close();
}
t.done();
