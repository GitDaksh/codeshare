import { chromium, BASE, api, contextFor, tracker, sleep, watchResponses, SHOTS } from "../lib/pw.mjs";
const t = tracker();
await api("alice", "PUT", "/api/profile", { username: "alice" });
const browser = await chromium.launch();
const bad = [];
try {
  const page = await (await contextFor(browser, "alice")).newPage();
  t.watch(page, "racer"); watchResponses(page, bad);
  await page.goto(BASE + "/games/code-racer/solo?language=javascript&length=short&rivals=bots", { waitUntil: "networkidle" });
  await sleep(1200);
  await page.screenshot({ path: `${SHOTS}/racer-countdown.png` });
  t.check("four lanes (you + 3 racers)", (await page.getByText("Rookie", { exact: true }).count()) === 1 && (await page.getByText("Ace", { exact: true }).count()) === 1 && (await page.getByText("Racer", { exact: true }).count()) === 1);
  // Read the snippet from the page, then type it (minus the indentation).
  const code = await page.evaluate(() => [...document.querySelectorAll("[class*=whitespace-pre]")].map((el) => el.textContent.replace(/↵/g, "")).join("\n"));
  await sleep(2600);
  await page.keyboard.type("§");
  await sleep(150);
  let typedChars = 0;
  for (const line of code.split("\n")) {
    const text = line.replace(/^ +/, "");
    if (typedChars > 0) { await page.keyboard.press("Enter"); }
    // About 200 words a minute: fast, but under the server's limit for a
    // believable score (250), so the result is saved.
    await page.keyboard.type(text, { delay: 60 });
    typedChars += text.length + 1;
    if (typedChars > 40 && typedChars < 60) await page.screenshot({ path: `${SHOTS}/racer-typing.png` });
  }
  await sleep(1500);
  await page.screenshot({ path: `${SHOTS}/racer-results.png` });
  const dialog = page.getByRole("dialog", { name: "Results" });
  t.check("results appear when you finish", (await dialog.count()) === 1);
  const text = await dialog.textContent();
  t.check("results show your WPM and accuracy", /\d+ WPM/.test(text) && /% accuracy/.test(text), text.slice(0, 160));
  t.check("one wrong key counted (accuracy under 100%)", /9\d% accuracy/.test(text));
  const stats = await api("alice", "GET", "/api/games/stats");
  t.check("the result was saved to alice's stats", (stats.data["code-racer"]?.plays ?? 0) >= 1, JSON.stringify(stats.data["code-racer"]));
  // Play again with Enter.
  await page.keyboard.press("Enter");
  await sleep(600);
  t.check("Enter starts a new race", (await dialog.count()) === 0);
} finally { await browser.close(); }
console.log("failed responses:", bad.length ? bad.join(" | ") : "none");
t.done();
