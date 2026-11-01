import { chromium, BASE, api, contextFor, tracker, sleep, watchResponses, SHOTS } from "../lib/pw.mjs";
import { chooseMove } from "../dist/four.mjs";

const t = tracker();
for (const u of ["alice", "bob"]) await api(u, "PUT", "/api/profile", { username: u });
const browser = await chromium.launch();
const bad = [];

const discsOn = (page) =>
  page.evaluate(() => [...document.querySelectorAll("[data-disc]")].map((el) => ({ disc: +el.dataset.disc, col: +el.dataset.col, row: +el.dataset.row })));
const boardOf = (discs) => {
  const b = Array(42).fill(0);
  for (const d of discs) b[d.row * 7 + d.col] = d.disc;
  return b;
};
const statusOf = async (page) => ((await page.locator('[aria-live="polite"] p').first().textContent()) ?? "").trim();
const column = (page, n) => page.getByRole("button", { name: new RegExp(`^Drop a disc in column ${n}`) });
async function waitFor(fn, ms = 8000, step = 100) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await fn()) return true;
    await sleep(step);
  }
  return false;
}

try {
  // ================= Solo against the computer =================
  const page = await (await contextFor(browser, "alice")).newPage();
  t.watch(page, "solo"); watchResponses(page, bad);
  const before = (await api("alice", "GET", "/api/games/stats")).data["four-in-a-row"] ?? { best: 0, plays: 0, wins: 0 };
  await page.goto(BASE + "/games/four-in-a-row/solo?level=easy", { waitUntil: "networkidle" });
  await sleep(1200);
  await page.screenshot({ path: `${SHOTS}/four-countdown.png` });
  t.check("you go first in the first game", /You go first/.test(await statusOf(page)), await statusOf(page));
  await sleep(2300);
  t.check("your disc waits over the middle column", (await page.locator("[data-ghost]").getAttribute("data-ghost")) === "3");
  await page.screenshot({ path: `${SHOTS}/four-start.png` });

  // Play with the hard computer's brain against the easy computer.
  let mine = 0;
  let thinkMs = [];
  for (let turn = 0; turn < 40; turn++) {
    const st = await statusOf(page);
    if (/win|draw|left/i.test(st)) break;
    if (st !== "Your move") { await sleep(120); continue; }
    const board = boardOf(await discsOn(page));
    const col = chooseMove(board, 1, "hard", 1000 + turn);
    await column(page, col + 1).click();
    mine++;
    const sent = Date.now();
    if (mine === 2) {
      await sleep(180);
      await page.screenshot({ path: `${SHOTS}/four-falling.png` });
    }
    const ok = await waitFor(async () => /win|draw|left|Your move/i.test(await statusOf(page)) && (await statusOf(page)) !== "Your move" ? true : (await discsOn(page)).length > board.filter(Boolean).length + 1, 6000, 60);
    if (ok) thinkMs.push(Date.now() - sent);
  }
  await sleep(700);
  const finalStatus = await statusOf(page);
  t.check("you beat the easy computer", /You win/.test(finalStatus), finalStatus);
  t.check("the winning line is drawn", (await page.locator(".four-line").count()) === 1);
  t.check("four discs pulse", (await page.locator(".four-win").count()) >= 4, String(await page.locator(".four-win").count()));
  await page.screenshot({ path: `${SHOTS}/four-win.png` });
  t.check("the computer answered each move in time", thinkMs.every((ms) => ms < 4000), thinkMs.join(","));
  const results = page.getByRole("dialog", { name: "Results" });
  t.check("results appear after the win", await waitFor(async () => (await results.count()) === 1, 4000));
  t.check("results say you won", /You won!/.test(await results.textContent()));
  await page.screenshot({ path: `${SHOTS}/four-results.png` });
  await sleep(800);
  const after = (await api("alice", "GET", "/api/games/stats")).data["four-in-a-row"];
  t.check("the game is saved (a solo win isn't a leaderboard win)", after && after.wins === before.wins && after.plays === before.plays + 1 && after.best >= 1, JSON.stringify(after));

  // Play again: the computer goes first this time.
  await page.keyboard.press("Enter");
  await sleep(600);
  t.check("the computer goes first in the second game", /goes first/.test(await statusOf(page)), await statusOf(page));
  t.check("the computer moves soon after go", await waitFor(async () => (await discsOn(page)).length === 1, 6500));
  t.check("then it's your move", await waitFor(async () => (await statusOf(page)) === "Your move", 3000));
  const first = (await discsOn(page))[0];
  t.check("the computer's disc is rose (it went first)", first?.disc === 1, JSON.stringify(first));
  await sleep(300);
  await page.keyboard.press("ArrowLeft");
  await sleep(250);
  t.check("← moves your disc left", (await page.locator("[data-ghost]").getAttribute("data-ghost")) === "2");
  await page.keyboard.press("Enter");
  await sleep(150);
  const kb = (await discsOn(page)).find((d) => d.disc === 2);
  t.check("Enter drops it in that column", kb?.col === 2, JSON.stringify(kb));
  t.check("the computer answers", await waitFor(async () => (await statusOf(page)) === "Your move" && (await discsOn(page)).length === 3, 5000));
  await page.keyboard.press("7");
  await sleep(150);
  t.check("7 drops in the last column", (await discsOn(page)).some((d) => d.disc === 2 && d.col === 6));
  await page.screenshot({ path: `${SHOTS}/four-game2.png` });

  // Hard thinks quickly enough.
  const hard = await (await contextFor(browser, "alice")).newPage();
  t.watch(hard, "hard"); watchResponses(hard, bad);
  await hard.goto(BASE + "/games/four-in-a-row/solo?level=hard", { waitUntil: "networkidle" });
  await sleep(3500);
  await column(hard, 4).click();
  const started = Date.now();
  t.check("hard answers within 2.5 s", await waitFor(async () => (await discsOn(hard)).length === 2, 2500, 50), `${Date.now() - started} ms`);
  await hard.close();

  // ================= Online: alice vs bob =================
  const a = await (await contextFor(browser, "alice")).newPage();
  t.watch(a, "alice"); watchResponses(a, bad);
  await a.goto(BASE + "/games/four-in-a-row", { waitUntil: "networkidle" });
  await a.getByRole("button", { name: "Play with friends" }).click();
  await a.waitForURL(/\/games\/play\/[A-Z0-9]{6}$/, { timeout: 15000 });
  const code = a.url().split("/").pop();
  const b = await (await contextFor(browser, "bob")).newPage();
  t.watch(b, "bob"); watchResponses(b, bad);
  await b.goto(BASE + "/games/play/" + code, { waitUntil: "networkidle" });
  await sleep(1500);
  await a.getByRole("button", { name: "Start game" }).click();
  await sleep(4300);
  t.check("alice moves first", (await statusOf(a)) === "Your move" && /alice is thinking/.test(await statusOf(b)), `${await statusOf(a)} | ${await statusOf(b)}`);

  // Bob watches alice's disc follow her mouse.
  const box = await column(a, 6).boundingBox();
  await a.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  t.check("bob sees alice's disc over column 6", await waitFor(async () => (await b.locator("[data-ghost]").getAttribute("data-ghost").catch(() => null)) === "5", 3000));
  await b.screenshot({ path: `${SHOTS}/four-online-hover.png` });

  // alice: column 1 four times; bob: column 2 three times.
  const plan = [[a, 1], [b, 2], [a, 1], [b, 2], [a, 1], [b, 2], [a, 1]];
  let n = 0;
  for (const [p, col] of plan) {
    const ready = await waitFor(async () => (await statusOf(p)) === "Your move", 6000);
    if (!ready) { t.check(`move ${n + 1} came round`, false, await statusOf(p)); break; }
    await column(p, col).click();
    n++;
    const other = p === a ? b : a;
    await waitFor(async () => (await discsOn(other)).length === n, 4000, 50);
  }
  await sleep(900);
  t.check("both see the same board", JSON.stringify(boardOf(await discsOn(a))) === JSON.stringify(boardOf(await discsOn(b))));
  t.check("alice wins on her screen", /You win/.test(await statusOf(a)), await statusOf(a));
  t.check("and on bob's", /alice wins/.test(await statusOf(b)), await statusOf(b));
  t.check("bob sees the line too", (await b.locator(".four-line").count()) === 1);
  await a.screenshot({ path: `${SHOTS}/four-online-win.png` });
  const ra = a.getByRole("dialog", { name: "Results" });
  const rb = b.getByRole("dialog", { name: "Results" });
  t.check("results for both", await waitFor(async () => (await ra.count()) === 1 && (await rb.count()) === 1, 5000));
  t.check("alice: You won!", /You won!/.test(await ra.textContent()));
  await sleep(600);
  const onlineAfter = (await api("alice", "GET", "/api/games/stats")).data["four-in-a-row"];
  t.check("the server saved alice's online win", onlineAfter && onlineAfter.wins === (after?.wins ?? 0) + 1, JSON.stringify(onlineAfter));
  t.check("bob: Good game!", /Good game!/.test(await rb.textContent()));
  await b.screenshot({ path: `${SHOTS}/four-online-results.png` });

  // Rematch: bob goes first, and runs out of time.
  await waitFor(async () => !(await a.getByRole("button", { name: "Play again" }).isDisabled()), 6000);
  await a.getByRole("button", { name: "Play again" }).click();
  await sleep(4300);
  t.check("bob goes first in the rematch", (await statusOf(b)) === "Your move", await statusOf(b));
  await sleep(21000);
  t.check("bob's clock shows near the end", /\ds/.test(await b.locator("text=/^\\d+s$/").first().textContent().catch(() => "")));
  await b.screenshot({ path: `${SHOTS}/four-online-clock.png` });
  t.check("time runs out: a disc is dropped for bob", await waitFor(async () => (await discsOn(a)).length === 1, 12000, 200));
  t.check("alice is told", await waitFor(async () => /bob ran out of time/.test(await a.locator('[aria-live="polite"]').textContent()), 2000));
  t.check("bob is told", /You ran out of time/.test(await b.locator('[aria-live="polite"]').textContent()));
  t.check("then it's alice's move", (await statusOf(a)) === "Your move", await statusOf(a));

  // Bob leaves: alice wins.
  await b.getByRole("button", { name: "Leave", exact: true }).click();
  t.check("alice wins when bob leaves", await waitFor(async () => /bob left\. You win!/.test(await statusOf(a)), 4000), await statusOf(a));
  t.check("results say so", await waitFor(async () => /The other player left/.test((await ra.textContent().catch(() => "")) ?? ""), 4000));
  await a.screenshot({ path: `${SHOTS}/four-online-forfeit.png` });
} finally {
  await browser.close();
}
console.log("failed responses:", bad.length ? bad.join(" | ") : "none");
t.done();
