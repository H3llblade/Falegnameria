import { chromium } from "playwright";
const b = await chromium.launch(); const c = await b.newContext({ viewport: { width: 390, height: 844 } }); const p = await c.newPage();
await p.goto("http://localhost:3100/login"); await p.fill("#username","mastro"); await p.fill("#password","Bottega1900test"); await p.click("button:has-text('Apri')"); await p.waitForURL("http://localhost:3100/");
for (const path of ["/", "/ordini/cmw0xcwhv00445xef664z6k7f"]) {
  await p.goto("http://localhost:3100" + path); await p.waitForTimeout(1200);
  console.log(path, await p.evaluate(() => { const W = innerWidth; return [document.documentElement.scrollWidth, ...[...document.querySelectorAll("body *")].filter(e => e.getBoundingClientRect().right > W + 1).slice(0,5).map(e => e.tagName + "." + (e.className?.toString?.()||"").slice(0,70) + " r=" + Math.round(e.getBoundingClientRect().right))]; }));
}
await b.close();
