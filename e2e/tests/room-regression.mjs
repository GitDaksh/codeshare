// The rest of the app still works with the games added: rooms, presence,
// chat and live editing.
import { chromium, BASE, api, contextFor, tracker, sleep, watchResponses, SHOTS } from "../lib/pw.mjs";

const t = tracker();
for (const u of ["alice", "bob"]) await api(u, "PUT", "/api/profile", { username: u });
const created = await api("alice", "POST", "/api/rooms", { name: "Regression room", language: "javascript" });
t.check("alice creates a room", created.status === 201 && !!created.data._id, `${created.status}`);
const id = created.data._id;
const invite = created.data.invites?.edit;
const browser = await chromium.launch();
const bad = [];
try {
  const a = await (await contextFor(browser, "alice")).newPage();
  t.watch(a, "alice"); watchResponses(a, bad);
  await a.goto(`${BASE}/room/${id}`, { waitUntil: "networkidle" });
  const b = await (await contextFor(browser, "bob")).newPage();
  t.watch(b, "bob"); watchResponses(b, bad);
  await b.goto(`${BASE}/room/${id}?invite=${invite}`, { waitUntil: "networkidle" });
  await sleep(3000);
  const people = async (page) => ((await page.getByText(/^People/).first().locator("..").textContent()) ?? "").replace(/\s+/g, " ");
  t.check("alice sees two people in the room", /People ?2/.test(await people(a)), await people(a));
  t.check("bob sees two people in the room", /People ?2/.test(await people(b)), await people(b));

  // Chat
  const chatA = a.getByPlaceholder("Message the room…");
  if ((await chatA.count()) === 0) {
    // The chat may sit behind a tab or button.
    const open = a.getByRole("button", { name: /chat/i }).first();
    if (await open.count()) await open.click();
    await sleep(400);
  }
  const chatB = b.getByPlaceholder("Message the room…");
  if ((await chatB.count()) === 0) {
    const open = b.getByRole("button", { name: /chat/i }).first();
    if (await open.count()) await open.click();
    await sleep(400);
  }
  await a.getByPlaceholder("Message the room…").fill("hello from alice");
  await a.keyboard.press("Enter");
  let seen = false;
  for (let i = 0; i < 40 && !seen; i++) {
    seen = (await b.getByText("hello from alice").count()) > 0;
    if (!seen) await sleep(150);
  }
  t.check("bob gets alice's chat message", seen);

  // Live editing (if the editor loads here).
  const editorA = a.locator(".monaco-editor").first();
  let editorLoaded = false;
  for (let i = 0; i < 40 && !editorLoaded; i++) {
    editorLoaded = (await editorA.count()) > 0;
    if (!editorLoaded) await sleep(250);
  }
  if (editorLoaded) {
    await editorA.click();
    await a.keyboard.press("Control+End");
    await a.keyboard.type("\n// typed by alice", { delay: 20 });
    let synced = false;
    for (let i = 0; i < 40 && !synced; i++) {
      synced = ((await b.locator(".monaco-editor .view-lines").first().textContent()) ?? "").replace(/\u00a0/g, " ").includes("typed by alice");
      if (!synced) await sleep(150);
    }
    t.check("bob sees alice's typing", synced);
  } else {
    console.log("  (the code editor can't load in this sandbox: it comes from a CDN; skipping the typing check)");
  }
  await a.screenshot({ path: `${SHOTS}/room-regression.png` });
} finally {
  await browser.close();
  await api("alice", "DELETE", `/api/rooms/${id}`);
}
console.log("failed responses:", bad.length ? bad.join(" | ") : "none");
t.done();
