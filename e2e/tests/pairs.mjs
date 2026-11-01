import { chromium, BASE, api, contextFor, tracker, sleep, watchResponses, SHOTS } from "../lib/pw.mjs";
import { PAIRS } from "../dist/pairs.mjs";

const t = tracker();
for (const u of ["alice", "bob"]) await api(u, "PUT", "/api/profile", { username: u });
const browser = await chromium.launch();
const bad = [];
const pairOf = new Map(PAIRS.flatMap((p) => [[p.a.text, p.id], [p.b.text, p.id]]));

const statusOf = async (page) => ((await page.locator('[aria-live="polite"] p').first().textContent()) ?? "").trim();
const cardsOn = (page) =>
  page.evaluate(() => [...document.querySelectorAll("[data-card]")].map((el) => ({ i: +el.dataset.card, up: el.dataset.up === "true", label: el.getAttribute("aria-label") })));
async function waitFor(fn, ms = 8000, step = 100) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await fn()) return true;
    await sleep(step);
  }
  return false;
}

// A player with a perfect memory: remembers every card seen, takes known
// pairs, otherwise flips unknown cards.
function memory() {
  const seen = new Map(); // index → text
  return {
    look(cards) {
      for (const c of cards) if (c.up && !/face down/.test(c.label)) seen.set(c.i, c.label.replace(/, found$/, ""));
    },
    known(cards) {
      const down = new Set(cards.filter((c) => !c.up).map((c) => c.i));
      const byPair = new Map();
      for (const [i, text] of seen) {
        if (!down.has(i)) continue;
        const id = pairOf.get(text);
        byPair.set(id, [...(byPair.get(id) ?? []), i]);
      }
      return [...byPair.values()].find((list) => list.length === 2) ?? null;
    },
    partnerOf(text, cards) {
      const down = new Set(cards.filter((c) => !c.up).map((c) => c.i));
      for (const [i, other] of seen) if (down.has(i) && other !== text && pairOf.get(other) === pairOf.get(text)) return i;
      return null;
    },
    unknown(cards, except = -1) {
      return cards.find((c) => !c.up && !seen.has(c.i) && c.i !== except)?.i ?? cards.find((c) => !c.up && c.i !== except)?.i;
    },
  };
}

const card = (page, i) => page.locator(`[data-card="${i}"]`);

// One turn: flip two cards (or keep going after a match). Returns "found" or "miss".
async function playTurn(page, mind) {
  let cards = await cardsOn(page);
  mind.look(cards);
  const pair = mind.known(cards);
  if (pair) {
    await card(page, pair[0]).click();
    await sleep(120);
    await card(page, pair[1]).click();
    await sleep(200);
    mind.look(await cardsOn(page));
    return "found";
  }
  const a = mind.unknown(cards);
  await card(page, a).click();
  await sleep(150);
  cards = await cardsOn(page);
  mind.look(cards);
  const text = cards.find((c) => c.i === a).label;
  const partner = mind.partnerOf(text, cards);
  const b = partner ?? mind.unknown(cards, a);
  await card(page, b).click();
  await sleep(200);
  cards = await cardsOn(page);
  mind.look(cards);
  return cards.find((c) => c.i === b).up && cards.find((c) => c.i === a).up && pairOf.get(cards.find((c) => c.i === a).label.replace(/, found$/, "")) === pairOf.get(cards.find((c) => c.i === b).label.replace(/, found$/, "")) ? "found" : "miss";
}

try {
  // ================= Solo =================
  const page = await (await contextFor(browser, "alice")).newPage();
  t.watch(page, "solo"); watchResponses(page, bad);
  const before = (await api("alice", "GET", "/api/games/stats")).data["pair-programming"] ?? { best: 0, plays: 0, wins: 0 };
  await page.goto(BASE + "/games/pair-programming/solo?pairs=8", { waitUntil: "networkidle" });
  await sleep(600);
  await page.screenshot({ path: `${SHOTS}/pairs-deal.png` });
  await sleep(2600);
  t.check("16 cards dealt face down", (await cardsOn(page)).filter((c) => !c.up).length === 16);
  const hidden = await page.evaluate(() => [...document.querySelectorAll("[data-card]")].map((el) => el.textContent.replace("</>", "").trim()).filter(Boolean).length);
  t.check("face-down cards don't give their text away", hidden === 0, String(hidden));

  const mind = memory();
  let misses = 0;
  let shotMiss = false;
  let shotFound = false;
  for (let turn = 0; turn < 40; turn++) {
    if ((await cardsOn(page)).every((c) => c.up)) break;
    const result = await playTurn(page, mind);
    if (result === "miss") {
      misses++;
      if (!shotMiss) {
        await sleep(250);
        await page.screenshot({ path: `${SHOTS}/pairs-miss.png` });
        shotMiss = true;
      }
      await sleep(1000);
    } else if (!shotFound) {
      await sleep(350);
      await page.screenshot({ path: `${SHOTS}/pairs-found.png` });
      shotFound = true;
    }
  }
  t.check("every pair found", (await cardsOn(page)).every((c) => c.up));
  t.check("misses are counted", (await page.getByText("Misses").locator("..").textContent()).includes(String(misses)), `${misses} misses`);
  await sleep(400);
  await page.screenshot({ path: `${SHOTS}/pairs-done.png` });
  const results = page.getByRole("dialog", { name: "Results" });
  t.check("results appear", await waitFor(async () => (await results.count()) === 1, 4000));
  const text = await results.textContent();
  t.check("results show points and the time", /pts/.test(text) && /8 pairs in \d+s/.test(text), text.slice(0, 120));
  await sleep(800);
  const after = (await api("alice", "GET", "/api/games/stats")).data["pair-programming"];
  t.check("the score is saved", after && after.plays === before.plays + 1 && after.best > 0, JSON.stringify(after));
  await page.screenshot({ path: `${SHOTS}/pairs-results.png` });

  // ================= Online: alice vs bob =================
  const a = await (await contextFor(browser, "alice")).newPage();
  t.watch(a, "alice"); watchResponses(a, bad);
  await a.goto(BASE + "/games/pair-programming", { waitUntil: "networkidle" });
  await a.getByRole("button", { name: "Play with friends" }).click();
  await a.waitForURL(/\/games\/play\/[A-Z0-9]{6}$/, { timeout: 15000 });
  const code = a.url().split("/").pop();
  const b = await (await contextFor(browser, "bob")).newPage();
  t.watch(b, "bob"); watchResponses(b, bad);
  await b.goto(BASE + "/games/play/" + code, { waitUntil: "networkidle" });
  await sleep(1500);
  // 6 pairs, to keep it short.
  await a.getByRole("tab", { name: "6 pairs" }).click();
  await sleep(400);
  await a.getByRole("button", { name: "Start game" }).click();
  await sleep(4300);
  t.check("12 cards for 6 pairs", (await cardsOn(a)).length === 12, String((await cardsOn(a)).length));
  t.check("alice goes first", /Your turn/.test(await statusOf(a)) && /alice's turn/.test(await statusOf(b)), `${await statusOf(a)} | ${await statusOf(b)}`);

  // Alice flips one card; bob sees it.
  const first = (await cardsOn(a))[0].i;
  await card(a, first).click();
  t.check("bob sees alice's card turn over", await waitFor(async () => (await cardsOn(b)).find((c) => c.i === first)?.up === true, 3000));
  // Then times out: bob's browser passes the turn on after 15 s.
  await sleep(9000);
  await a.screenshot({ path: `${SHOTS}/pairs-online-clock.png` });
  t.check("alice's turn runs out and passes to bob", await waitFor(async () => /Your turn/.test(await statusOf(b)), 9000, 200), await statusOf(b));
  t.check("and alice's card turns back", (await cardsOn(a)).find((c) => c.i === first)?.up === false);

  // Now play it out, each with a perfect memory.
  const minds = new Map([[a, memory()], [b, memory()]]);
  const canFlipOn = async (page) => (await page.locator('[data-card][data-open="true"]').count()) > 0;
  const deadline = Date.now() + 120000;
  while (Date.now() < deadline) {
    if ((await cardsOn(a)).every((c) => c.up)) break;
    const p = (await canFlipOn(a)) ? a : (await canFlipOn(b)) ? b : null;
    if (!p) { await sleep(150); continue; }
    for (const [page2, mind2] of minds) mind2.look(await cardsOn(page2));
    const result = await playTurn(p, minds.get(p));
    for (const [page2, mind2] of minds) mind2.look(await cardsOn(page2));
    if (result === "miss") await sleep(1500);
    else await sleep(250);
  }
  await sleep(300);
  await b.screenshot({ path: `${SHOTS}/pairs-online-end.png` });
  const ra = a.getByRole("dialog", { name: "Results" });
  const rb = b.getByRole("dialog", { name: "Results" });
  t.check("results for both", await waitFor(async () => (await ra.count()) === 1 && (await rb.count()) === 1, 5000));
  const ta = await ra.textContent();
  const tb = await rb.textContent();
  t.check("results list pairs", /\d pairs?/.test(ta) && /\d pairs?/.test(tb), `${ta.slice(0, 80)} | ${tb.slice(0, 80)}`);
  await a.screenshot({ path: `${SHOTS}/pairs-online-results.png` });
} finally {
  await browser.close();
}
console.log("failed responses:", bad.length ? bad.join(" | ") : "none");
t.done();
