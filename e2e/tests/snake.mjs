import { chromium, BASE, api, contextFor, tracker, sleep, watchResponses, SHOTS } from "../lib/pw.mjs";

const t = tracker();
for (const u of ["alice", "bob"]) await api(u, "PUT", "/api/profile", { username: u });
const browser = await chromium.launch();
const bad = [];
const SIZE = 20;
const DX = [0, 1, 0, -1];
const DY = [-1, 0, 1, 0];
const KEY = ["ArrowUp", "ArrowRight", "ArrowDown", "ArrowLeft"];

const stateOf = (page) =>
  page.locator("[data-head]").evaluate((el) => ({
    head: Number(el.dataset.head),
    dir: Number(el.dataset.dir),
    food: Number(el.dataset.food),
    body: (el.dataset.body || "").split(",").filter(Boolean).map(Number),
  }));
const scoreOf = async (page) => Number(((await page.locator("p.gs-gradient-text").first().textContent()) ?? "0").replace(/,/g, ""));

// The page's numbers can be a step behind the snake (they refresh 10 times
// a second); plan from where the head is about to be.
function ahead(s) {
  const x = (s.head % SIZE) + DX[s.dir];
  const y = Math.floor(s.head / SIZE) + DY[s.dir];
  if (x < 0 || x >= SIZE || y < 0 || y >= SIZE) return s;
  return { ...s, head: y * SIZE + x, body: [y * SIZE + x, ...s.body.slice(0, -1)] };
}

// Shortest way to the byte that doesn't hit a wall or the body.
function nextDir(s) {
  const blocked = new Set(s.body.slice(0, -1));
  const start = s.head;
  if (start === s.food) return s.dir;
  const prev = new Map([[start, -1]]);
  const queue = [start];
  while (queue.length) {
    const cell = queue.shift();
    if (cell === s.food) break;
    for (let d = 0; d < 4; d++) {
      const x = (cell % SIZE) + DX[d];
      const y = Math.floor(cell / SIZE) + DY[d];
      if (x < 0 || x >= SIZE || y < 0 || y >= SIZE) continue;
      const next = y * SIZE + x;
      if (blocked.has(next) || prev.has(next)) continue;
      if (cell === start && d === (s.dir + 2) % 4) continue;
      prev.set(next, cell);
      queue.push(next);
    }
  }
  if (!prev.has(s.food)) {
    for (const d of [s.dir, (s.dir + 1) % 4, (s.dir + 3) % 4]) {
      const x = (start % SIZE) + DX[d];
      const y = Math.floor(start / SIZE) + DY[d];
      if (x >= 0 && x < SIZE && y >= 0 && y < SIZE && !blocked.has(y * SIZE + x)) return d;
    }
    return s.dir;
  }
  let cell = s.food;
  while (prev.get(cell) !== start) cell = prev.get(cell);
  const dx = (cell % SIZE) - (start % SIZE);
  const dy = Math.floor(cell / SIZE) - Math.floor(start / SIZE);
  return DX.findIndex((v, d) => v === dx && DY[d] === dy);
}

async function bot(page, ms, stopAt = Infinity) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const s = await stateOf(page).catch(() => null);
    if (!s || Number.isNaN(s.head)) break;
    if ((await scoreOf(page)) >= stopAt) break;
    const d = nextDir(s);
    if (d !== s.dir && d !== (s.dir + 2) % 4) {
      await page.keyboard.press(KEY[d]);
      // Let the page catch up before deciding again.
      await sleep(110);
    }
    await sleep(35);
  }
}

try {
  // ================= Solo =================
  const page = await (await contextFor(browser, "alice")).newPage();
  t.watch(page, "solo"); watchResponses(page, bad);
  const before = (await api("alice", "GET", "/api/games/stats")).data["byte-snake"] ?? { best: 0, plays: 0, wins: 0 };
  await page.goto(BASE + "/games/byte-snake/solo", { waitUntil: "networkidle" });
  await sleep(3200);
  const start = await stateOf(page);
  t.check("the snake starts on the middle row, heading right", Math.floor(start.head / SIZE) === 10 && start.dir === 1 && start.body.length === 3, JSON.stringify(start));
  await sleep(500);
  t.check("it moves on its own", (await stateOf(page)).head !== start.head);
  // Turn up and check it answers.
  await page.keyboard.press("ArrowUp");
  await sleep(300);
  const turned = await stateOf(page);
  t.check("arrow keys turn it", turned.dir === 0 && Math.floor(turned.head / SIZE) < 10, JSON.stringify(turned));
  await bot(page, 25000, 60);
  const score = await scoreOf(page);
  t.check("eating bytes scores points", score >= 10 && score % 10 === 0, String(score));
  await page.screenshot({ path: `${SHOTS}/snake-solo.png` });
  // Now drive into the nearest wall.
  const s = await stateOf(page);
  const x = s.head % SIZE;
  const y = Math.floor(s.head / SIZE);
  const toWall = [y, SIZE - 1 - x, SIZE - 1 - y, x];
  const order = [0, 1, 2, 3].filter((d) => d !== (s.dir + 2) % 4).sort((a, b) => toWall[a] - toWall[b]);
  await page.keyboard.press(KEY[order[0]]);
  await sleep(250);
  await page.screenshot({ path: `${SHOTS}/snake-crash.png` });
  const results = page.getByRole("dialog", { name: "Results" });
  const ended = await (async () => {
    for (let i = 0; i < 60; i++) {
      if ((await results.count()) === 1) return true;
      await sleep(100);
    }
    return false;
  })();
  t.check("hitting the wall ends the game", ended);
  const text = ended ? await results.textContent() : "";
  t.check("results show the score", text.includes(`${score.toLocaleString()} pts`) || /\d+ pts/.test(text), text.slice(0, 100));
  await sleep(800);
  const after = (await api("alice", "GET", "/api/games/stats")).data["byte-snake"];
  t.check("the score is saved", after && after.plays === before.plays + 1 && after.best >= score, JSON.stringify(after));
  await page.screenshot({ path: `${SHOTS}/snake-results.png` });

  // ================= Online: alice vs bob, 1 minute =================
  const a = await (await contextFor(browser, "alice")).newPage();
  t.watch(a, "alice"); watchResponses(a, bad);
  await a.goto(BASE + "/games/byte-snake", { waitUntil: "networkidle" });
  await a.getByRole("button", { name: "Play with friends" }).click();
  await a.waitForURL(/\/games\/play\/[A-Z0-9]{6}$/, { timeout: 15000 });
  const code = a.url().split("/").pop();
  const b = await (await contextFor(browser, "bob")).newPage();
  t.watch(b, "bob"); watchResponses(b, bad);
  await b.goto(BASE + "/games/play/" + code, { waitUntil: "networkidle" });
  await sleep(1500);
  await a.getByRole("tab", { name: "1 min" }).click();
  await sleep(400);
  await a.getByRole("button", { name: "Start game" }).click();
  await sleep(3900);
  // Both play at once for the whole minute.
  await Promise.all([bot(a, 62000), (async () => { await sleep(200); await bot(b, 62000); })()]);
  await a.screenshot({ path: `${SHOTS}/snake-online.png` });
  const ra = a.getByRole("dialog", { name: "Results" });
  const rb = b.getByRole("dialog", { name: "Results" });
  let both = false;
  for (let i = 0; i < 60 && !both; i++) {
    both = (await ra.count()) === 1 && (await rb.count()) === 1;
    if (!both) await sleep(150);
  }
  t.check("time's up: results for both", both);
  const ta = (await ra.textContent()) ?? "";
  const tb = (await rb.textContent()) ?? "";
  const pts = (text) => [...new Set([...text.matchAll(/([\d,]+) pts/g)].map((m) => m[1]))].sort().join("|");
  t.check("both browsers agree on every score", pts(ta) === pts(tb) && pts(ta).length > 0, `${pts(ta)} vs ${pts(tb)}`);
  await b.screenshot({ path: `${SHOTS}/snake-online-results.png` });
} finally {
  await browser.close();
}
console.log("failed responses:", bad.length ? bad.join(" | ") : "none");
t.done();
