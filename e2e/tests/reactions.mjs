// Reactions fly across everyone's screen during a match.
import { chromium, BASE, api, contextFor, tracker, sleep, watchResponses, SHOTS } from "../lib/pw.mjs";
const t = tracker();
for (const u of ["alice", "bob"]) await api(u, "PUT", "/api/profile", { username: u });
const browser = await chromium.launch();
const bad = [];
try {
  const a = await (await contextFor(browser, "alice")).newPage();
  t.watch(a, "alice"); watchResponses(a, bad);
  await a.goto(BASE + "/games/bit-flip", { waitUntil: "networkidle" });
  await a.getByRole("button", { name: "Play with friends" }).click();
  await a.waitForURL(/\/games\/play\/[A-Z0-9]{6}$/, { timeout: 15000 });
  const code = a.url().split("/").pop();
  const b = await (await contextFor(browser, "bob")).newPage();
  t.watch(b, "bob"); watchResponses(b, bad);
  await b.goto(BASE + "/games/play/" + code, { waitUntil: "networkidle" });
  await sleep(1200);
  await a.getByRole("button", { name: "Start game" }).click();
  await sleep(4000);
  await a.getByRole("button", { name: "Send a reaction" }).click();
  await sleep(200);
  await a.getByRole("button", { name: "React 🔥" }).click();
  let seen = false;
  for (let i = 0; i < 30 && !seen; i++) {
    seen = (await b.locator(".gs-float").filter({ hasText: "🔥" }).count()) > 0;
    if (!seen) await sleep(100);
  }
  t.check("bob sees alice's 🔥 float up", seen);
  await sleep(300);
  await b.screenshot({ path: `${SHOTS}/reaction.png` });
  await sleep(3000);
  t.check("and it goes away", (await b.locator(".gs-float").count()) === 0);
} finally { await browser.close(); }
console.log("failed responses:", bad.length ? bad.join(" | ") : "none");
t.done();
