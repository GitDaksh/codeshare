// Keyword with friends: both players type from the keyboard (with a key
// grabber on the page, like a browser extension) and their guesses go in.
import { chromium, BASE, api, contextFor, tracker, sleep, watchResponses, SHOTS } from "../lib/pw.mjs";

const t = tracker();
for (const u of ["alice", "bob"]) await api(u, "PUT", "/api/profile", { username: u });
const browser = await chromium.launch();
const bad = [];

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

try {
  const ca = await contextFor(browser, "alice");
  await ca.addInitScript(keyGrabber);
  const a = await ca.newPage();
  t.watch(a, "alice"); watchResponses(a, bad);
  await a.goto(BASE + "/games/keyword", { waitUntil: "networkidle" });
  await a.getByRole("button", { name: "Play with friends" }).click();
  await a.waitForURL(/\/games\/play\/[A-Z0-9]{6}$/, { timeout: 15000 });
  const code = a.url().split("/").pop();

  const cb = await contextFor(browser, "bob");
  await cb.addInitScript(keyGrabber);
  const b = await cb.newPage();
  t.watch(b, "bob"); watchResponses(b, bad);
  await b.goto(BASE + "/games/play/" + code, { waitUntil: "networkidle" });
  await sleep(1500);
  await a.getByRole("button", { name: "Start game" }).click();
  await sleep(4200);

  await a.keyboard.type("salad", { delay: 40 });
  await b.keyboard.type("sedan", { delay: 40 });
  await sleep(150);
  t.check("alice types A, S and D", (await typed(a)) === "salad", await typed(a));
  t.check("bob types A, S and D", (await typed(b)) === "sedan", await typed(b));
  await a.keyboard.press("Enter");
  await b.keyboard.press("Enter");
  await sleep(1800);
  t.check("both guesses go in", (await revealed(a)) === 5 && (await revealed(b)) === 5, `${await revealed(a)} ${await revealed(b)}`);
  await a.keyboard.type("dread", { delay: 40 });
  await a.keyboard.press("Enter");
  await sleep(1800);
  t.check("alice's second guess goes in", (await revealed(a)) === 10, String(await revealed(a)));
  // Bob sees alice's board fill in (her colors, never her letters).
  const bobSees = await b.evaluate(() => document.body.innerText.includes("alice"));
  t.check("bob sees alice in the match", bobSees);
  t.check("nothing reached the key grabber", (await a.evaluate(() => window.__stolen)) === 0 && (await b.evaluate(() => window.__stolen)) === 0);
  await a.screenshot({ path: `${SHOTS}/keyword-online-keys.png` });
} finally {
  await browser.close();
}
console.log("failed responses:", bad.length ? bad.join(" | ") : "none");
t.done();
