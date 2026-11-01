import { chromium, BASE, api, contextFor, tracker, sleep, watchResponses, SHOTS } from "../lib/pw.mjs";
const t = tracker();
for (const u of ["alice", "bob"]) await api(u, "PUT", "/api/profile", { username: u });
const browser = await chromium.launch();
const bad = [];
try {
  const a = await (await contextFor(browser, "alice")).newPage();
  t.watch(a, "alice"); watchResponses(a, bad);
  await a.goto(BASE + "/games", { waitUntil: "networkidle" });
  await sleep(800);
  t.check("hub shows 9 games", (await a.locator("article").count()) === 9);
  await a.screenshot({ path: `${SHOTS}/hub.png`, fullPage: true });
  await a.goto(BASE + "/games/code-racer", { waitUntil: "networkidle" });
  await sleep(600);
  await a.screenshot({ path: `${SHOTS}/game-home.png`, fullPage: true });
  // Play with friends.
  await a.getByRole("button", { name: "Play with friends" }).click();
  await a.waitForURL(/\/games\/play\/[A-Z0-9]{6}$/, { timeout: 15000 });
  const code = a.url().split("/").pop();
  await sleep(1200);
  t.check("lobby shows the code", (await a.getByLabel(`Lobby code ${code}`).count()) === 1);
  const b = await (await contextFor(browser, "bob")).newPage();
  t.watch(b, "bob"); watchResponses(b, bad);
  await b.goto(BASE + "/games/play/" + code, { waitUntil: "networkidle" });
  await sleep(1500);
  t.check("bob sees two players", (await b.getByText("Waiting for alice to start").count()) === 1);
  await a.screenshot({ path: `${SHOTS}/lobby.png` });
  await a.getByRole("button", { name: "Start game" }).click();
  await sleep(1500);
  await a.screenshot({ path: `${SHOTS}/countdown.png` });
  await sleep(3500);
  t.check("the race starts for both", (await a.getByText("Type the code").count()) + (await a.locator("textarea").count()) > 0 && (await b.locator("textarea").count()) > 0);
  // Alice leaves: bob is told, and the match ends for him.
  await a.getByRole("button", { name: "Leave", exact: true }).click();
  await sleep(1500);
  await b.screenshot({ path: `${SHOTS}/results.png` });
  t.check("bob's race ends when he's the only one left", (await b.getByRole("dialog", { name: "Results" }).count()) === 1 || (await b.getByText(/left/i).count()) > 0);
} finally { await browser.close(); }
console.log("failed responses:", bad.length ? bad.join(" | ") : "none");
t.done();
