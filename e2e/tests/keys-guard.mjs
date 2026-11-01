// Letters and WASD still reach the games when something else on the page
// (a browser extension, say) listens on the document and swallows them.
import { chromium, BASE, api, contextFor, tracker, sleep, watchResponses } from "../lib/pw.mjs";

const t = tracker();
await api("alice", "PUT", "/api/profile", { username: "alice" });
const browser = await chromium.launch();
const bad = [];

// Runs before the page's own scripts, like an extension's content script.
function keyGrabber() {
  window.__stolen = 0;
  document.addEventListener(
    "keydown",
    (e) => {
      if (/^[asdw]$/i.test(e.key)) {
        window.__stolen++;
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    },
    true
  );
}

const typed = (page) =>
  page.evaluate(() => [...document.querySelectorAll(".kw-inner.kw-pop")].map((el) => el.firstElementChild?.textContent ?? "").join(""));
const revealed = (page) => page.evaluate(() => document.querySelectorAll(".kw-revealed .kw-back").length);
const stolen = (page) => page.evaluate(() => window.__stolen);
// A key press the way some keyboards and input methods report it.
const odd = (page, key, code) =>
  page.evaluate(([key, code]) => document.body.dispatchEvent(new KeyboardEvent("keydown", { key, code, bubbles: true, cancelable: true })), [key, code]);

try {
  const context = await contextFor(browser, "alice");
  await context.addInitScript(keyGrabber);

  // ---------- The grabber works on this site ----------
  const hub = await context.newPage();
  t.watch(hub, "hub"); watchResponses(hub, bad);
  await hub.goto(BASE + "/games", { waitUntil: "networkidle" });
  await hub.keyboard.press("a");
  t.check("control: the grabber swallows 'a' on a page without a game", (await stolen(hub)) === 1, String(await stolen(hub)));
  await hub.close();

  // ---------- Keyword ----------
  const page = await context.newPage();
  t.watch(page, "keyword"); watchResponses(page, bad);
  await page.goto(BASE + "/games/keyword/solo?mode=endless", { waitUntil: "networkidle" });
  await sleep(3600);

  await page.keyboard.type("salad", { delay: 40 });
  await sleep(200);
  t.check("A, S and D type with a key grabber on the page", (await typed(page)) === "salad", await typed(page));
  await page.keyboard.press("Enter");
  await sleep(1700);
  t.check("the guess goes in", (await revealed(page)) === 5, String(await revealed(page)));

  // When `key` isn't a plain letter, the key's place on the keyboard decides.
  await odd(page, "Unidentified", "KeyS");
  await odd(page, "у", "KeyE");
  await odd(page, "Process", "KeyD");
  await odd(page, ",", "KeyM");
  await odd(page, "1", "Digit1");
  await sleep(200);
  t.check("oddly reported keys type the right letter; punctuation and digits don't", (await typed(page)) === "sed", await typed(page));
  await page.keyboard.type("an", { delay: 40 });
  await page.keyboard.press("Enter");
  await sleep(1700);
  t.check("second guess goes in", (await revealed(page)) === 10, String(await revealed(page)));

  // Mouse, then keyboard: Enter sends the word (not the last key clicked).
  for (const k of "dread") await page.getByRole("button", { name: new RegExp(`^${k}$`, "i") }).click();
  await sleep(150);
  t.check("on-screen keys type", (await typed(page)) === "dread", await typed(page));
  await page.keyboard.press("Enter");
  await sleep(1700);
  t.check("Enter after clicking keys sends the word", (await revealed(page)) === 15 && (await typed(page)) === "", `${await revealed(page)} "${await typed(page)}"`);

  // Three more misses end the run; Enter on the results plays again.
  for (const w of ["squad", "sadly", "waste"]) {
    await page.keyboard.type(w, { delay: 40 });
    await page.keyboard.press("Enter");
    await sleep(1700);
  }
  const results = page.getByRole("dialog", { name: "Results" });
  let shown = false;
  for (let i = 0; i < 40 && !shown; i++) {
    shown = (await results.count()) === 1;
    if (!shown) await sleep(100);
  }
  t.check("six misses end the run", shown);
  await page.keyboard.press("Enter");
  await sleep(4000);
  t.check("Enter on the results plays again", (await results.count()) === 0 && (await revealed(page)) === 0, String(await revealed(page)));
  await page.keyboard.type("sad", { delay: 40 });
  await sleep(150);
  t.check("typing works in the new game", (await typed(page)) === "sad", await typed(page));
  t.check("letters the game takes go no further", (await stolen(page)) === 0, String(await stolen(page)));
  await page.close();

  // ---------- Byte Snake ----------
  const snake = await context.newPage();
  t.watch(snake, "snake"); watchResponses(snake, bad);
  await snake.goto(BASE + "/games/byte-snake/solo", { waitUntil: "networkidle" });
  await sleep(3200);
  const dirOf = async () => Number(await snake.locator("[data-head]").evaluate((el) => el.dataset.dir));
  t.check("the snake starts heading right", (await dirOf()) === 1);
  const seen = [];
  for (const [key, dir] of [["w", 0], ["d", 1], ["s", 2], ["a", 3]]) {
    await snake.keyboard.press(key);
    let ok = false;
    for (let i = 0; i < 8 && !ok; i++) {
      await sleep(100);
      ok = (await dirOf()) === dir;
    }
    seen.push(`${key}:${ok ? "turned" : "ignored"}`);
    await sleep(250);
  }
  t.check("W, A, S and D steer the snake with a key grabber on the page", seen.every((s) => s.endsWith("turned")), seen.join(" "));
  t.check("keys the snake takes go no further", (await stolen(snake)) === 0, String(await stolen(snake)));
} finally {
  await browser.close();
}
console.log("failed responses:", bad.length ? bad.join(" | ") : "none");
t.done();
