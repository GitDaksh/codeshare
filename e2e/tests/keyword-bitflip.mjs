import { chromium, BASE, api, contextFor, tracker, sleep, watchResponses, SHOTS } from "../lib/pw.mjs";
const t = tracker();
const browser = await chromium.launch();
const bad = [];
try {
  // ---------- Keyword (endless) ----------
  const page = await (await contextFor(browser, "alice")).newPage();
  t.watch(page, "keyword"); watchResponses(page, bad);
  await page.goto(BASE + "/games/keyword/solo?mode=endless", { waitUntil: "networkidle" });
  await sleep(3600);
  await page.keyboard.type("qwert"); await page.keyboard.press("Enter"); await sleep(400);
  t.check("an unknown word is refused", (await page.getByText("Not in the word list").count()) === 1);
  for (let i = 0; i < 5; i++) await page.keyboard.press("Backspace");
  await page.keyboard.type("crane"); await page.keyboard.press("Enter"); await sleep(1500);
  await page.keyboard.type("lousy"); await page.keyboard.press("Enter"); await sleep(1500);
  await page.screenshot({ path: `${SHOTS}/keyword.png` });
  const colored = await page.evaluate(() => [...document.querySelectorAll(".kw-revealed .kw-back")].length);
  t.check("two guesses revealed (10 colored tiles)", colored === 10, String(colored));
  // ---------- Bit Flip ----------
  const bf = await (await contextFor(browser, "alice")).newPage();
  t.watch(bf, "bitflip"); watchResponses(bf, bad);
  await bf.goto(BASE + "/games/bit-flip/solo?base=binary&seconds=30", { waitUntil: "networkidle" });
  await sleep(3300);
  let hits = 0;
  for (let round = 0; round < 6; round++) {
    const target = Number(await bf.locator("p.gs-gradient-text").first().textContent());
    const values = [128, 64, 32, 16, 8, 4, 2, 1];
    for (let i = 0; i < 8; i++) if (target & values[i]) { await bf.keyboard.press(String(i + 1)); await sleep(30); }
    await sleep(150);
    hits++;
  }
  await bf.screenshot({ path: `${SHOTS}/bitflip.png` });
  const shown = Number((await bf.locator("p.text-3xl").first().textContent()).trim());
  t.check("hitting 6 targets counts 6", shown === 6, String(shown));
  await sleep(26000);
  const dialog = bf.getByRole("dialog", { name: "Results" });
  let over = false;
  for (let i = 0; i < 80 && !over; i++) { over = (await dialog.count()) === 1; if (!over) await sleep(100); }
  t.check("time's up shows the results", over);
  t.check("results show 6 targets", /6 targets/.test(await dialog.textContent()));
} finally { await browser.close(); }
console.log("failed responses:", bad.length ? bad.join(" | ") : "none");
t.done();
