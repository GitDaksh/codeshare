// The landing page's Games section, the hero badge that points to it, and the
// navbar on tablets (signed out and in).
import { chromium, BASE, contextFor, tracker, sleep } from "../lib/pw.mjs";

const t = tracker();
const browser = await chromium.launch();
try {
  // ---------- The section ----------
  const context = await contextFor(browser, null);
  const page = await context.newPage();
  t.watch(page, "landing");
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  await sleep(1000);
  const tabs = page.getByRole("tab");
  t.check("the dock has all nine games", (await tabs.count()) === 9, String(await tabs.count()));
  t.check("the first game is selected", (await page.locator('[role="tab"][aria-selected="true"]').getAttribute("aria-label")) === "Code Racer");

  // The hero badge glides to the section (it stops just below the navbar).
  await page.getByRole("link", { name: /Games: nine quick ones/ }).click();
  await sleep(2200);
  const top = await page.evaluate(() => Math.round(document.getElementById("games").getBoundingClientRect().top));
  t.check("the hero badge scrolls to the Games section", top >= 60 && top <= 100, `${top}px`);

  // It moves on by itself while on screen...
  await sleep(5600);
  const cycled = await page.locator('[role="tab"][aria-selected="true"]').getAttribute("aria-label");
  t.check("the console moves to the next game by itself", cycled === "Keyword", cycled);

  // ...until you pick one.
  await page.getByRole("tab", { name: "Byte Snake" }).click();
  await sleep(600);
  // Every game's details sit in the panel; all but the shown one are inert.
  const panel = page.locator("#games-panel .col-start-1.row-start-1:not([inert])");
  t.check("picking a game shows its details", (await panel.locator("h3").textContent()) === "Byte Snake");
  await page.keyboard.press("ArrowLeft");
  await sleep(500);
  t.check("arrow keys move between games", (await page.locator('[role="tab"][aria-selected="true"]').getAttribute("aria-label")) === "Pair Programming");
  await sleep(5800);
  t.check("after a pick it stays put", (await page.locator('[role="tab"][aria-selected="true"]').getAttribute("aria-label")) === "Pair Programming");
  const reachable = await page.evaluate(() => [...document.querySelectorAll("#games-panel a, #games-panel button")].filter((el) => !el.closest("[inert]")).map((el) => el.textContent.trim()));
  t.check("only the shown game's buttons can be reached", reachable.length === 2 && reachable[0] === "Play solo", reachable.join(", "));
  // From the dock, Shift+Tab goes back to the shown game's buttons (never a hidden one).
  await page.keyboard.press("Shift+Tab");
  const focused = await page.evaluate(() => ({ text: document.activeElement?.textContent?.trim(), inert: !!document.activeElement?.closest("[inert]") }));
  t.check("the keyboard reaches the shown game's buttons", focused.text === "Play with friends" && !focused.inert, JSON.stringify(focused));

  // Play solo opens that game (no account needed).
  await panel.getByRole("link", { name: "Play solo" }).click();
  await page.waitForURL(/\/games\/pair-programming\/solo\?/, { timeout: 15000 });
  t.check("Play solo opens the game", /\/games\/pair-programming\/solo\?pairs=\d+/.test(page.url()), page.url().replace(BASE, ""));

  // Play with friends asks a signed-out visitor to sign in first.
  await page.goto(BASE + "/#games", { waitUntil: "networkidle" });
  await sleep(800);
  await page.getByRole("tab", { name: "Keyword" }).click();
  await sleep(400);
  await page.locator("#games-panel .col-start-1.row-start-1:not([inert])").getByRole("button", { name: "Play with friends" }).click();
  await page.waitForURL(/\/sign-in/, { timeout: 15000 });
  t.check("Play with friends asks you to sign in", /\/sign-in\?redirect_url=%2Fgames%2Fkeyword/.test(page.url()), page.url().replace(BASE, ""));

  // The footer links.
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  const footer = page.locator("footer");
  t.check("the footer links to Games and Interviews", (await footer.getByRole("link", { name: "Games" }).count()) === 1 && (await footer.getByRole("link", { name: "Interviews" }).count()) === 1);
  await context.close();

  // ---------- Reduced motion: nothing moves by itself ----------
  {
    const ctx = await contextFor(browser, null, { reducedMotion: "reduce" });
    const p = await ctx.newPage();
    await p.goto(BASE + "/", { waitUntil: "networkidle" });
    await p.evaluate(() => document.getElementById("games").scrollIntoView());
    await sleep(6500);
    t.check("with reduced motion the console doesn't cycle", (await p.locator('[role="tab"][aria-selected="true"]').getAttribute("aria-label")) === "Code Racer");
    await ctx.close();
  }

  // ---------- No sideways scrolling, signed out and in ----------
  const wide = [];
  for (const user of [null, "alice"]) {
    for (const width of [360, 390, 700, 768, 820, 900, 1024, 1280, 1440]) {
      const ctx = await contextFor(browser, user, { viewport: { width, height: 900 } });
      const p = await ctx.newPage();
      await p.goto(BASE + "/", { waitUntil: "networkidle" });
      const over = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      if (over > 0) wide.push(`${user ?? "signed out"} @${width}: ${over}px`);
      await ctx.close();
    }
  }
  t.check("the landing page never scrolls sideways (9 widths, signed out and in)", wide.length === 0, wide.join(", "));

  // ---------- Tablets, signed out: links live in the menu ----------
  {
    const ctx = await contextFor(browser, null, { viewport: { width: 820, height: 900 } });
    const p = await ctx.newPage();
    await p.goto(BASE + "/", { waitUntil: "networkidle" });
    await p.getByRole("button", { name: "Open menu" }).click();
    await sleep(400);
    t.check("on a tablet the menu holds the links", (await p.locator("header nav").getByRole("link", { name: "Games" }).count()) >= 1);
    await ctx.close();
  }
} finally {
  await browser.close();
}
t.done();
