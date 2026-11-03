/**
 * Prova end-to-end nel browser (Playwright): login, scenari 1-5, schermate desktop e mobile.
 * Uso: BASE_URL=http://localhost:3100 E2E_USER=... E2E_PASS=... node tests/e2e/smoke.mjs [cartella-screenshot]
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const OUT = process.argv[2] || "e2e-screens";
mkdirSync(OUT, { recursive: true });
const step = (m) => console.log("•", m);
const errors = [];
/** URL di una pagina di dettaglio (id cuid), escluse /nuovo e /nuova */
const detail = (section) => (u) => new RegExp(`/${section}/(?!nuov[oa]$)[a-z0-9]{20,}$`).test(u.pathname);

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 }, locale: "it-IT" });
const page = await ctx.newPage();
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => m.type() === "error" && !/favicon|Failed to load resource: the server responded with a status of 40/.test(m.text()) && errors.push(m.text()));

step("login");
await page.goto(`${BASE}/login`);
await page.screenshot({ path: `${OUT}/01-login.png` });
await page.fill("#username", process.env.E2E_USER);
await page.fill("#password", process.env.E2E_PASS);
await page.click("button:has-text('Apri il registro')");
await page.waitForURL(`${BASE}/`);

step("scenario 1: contatto");
const code = "0" + Math.floor(1000 + Math.random() * 8999);
await page.goto(`${BASE}/rubrica/nuovo`);
await page.fill("#c-fn", "Jack");
await page.fill("#c-ln", "Hartley" + code);
await page.fill("#c-code", code);
await page.fill("#c-act", "Allevatore di cavalli");
await page.fill("#c-city", "Strawberry");
await page.click("button:has-text('Registra contatto')");
await page.waitForURL(detail("rubrica"));
if (!(await page.textContent("body")).includes(code)) throw new Error("codice missiva non conservato");

step("scenario 1: ordine con due lavorazioni e acconto");
await page.click("text=Nuovo ordine per questo cliente");
await page.waitForURL(/ordini\/nuovo/);
await page.fill("#title", "Arredo per la stalla");
await page.selectOption("#it-r-0", { label: "Tavoli · Tavolo da saloon (esempio) ($ 35,00)" });
await page.fill("#it-q-0", "2");
await page.click("button:has-text('Aggiungi articolo')");
await page.fill("#it-d-1", "Mangiatoia su misura");
await page.fill("#it-q-1", "1");
await page.fill("#it-p-1", "18,50");
await page.fill("#deposit", "30");
await page.screenshot({ path: `${OUT}/02-nuovo-ordine.png`, fullPage: true });
const mats = await page.textContent("aside");
if (!mats.includes("8") || !mats.includes("Assi di legno")) throw new Error("materiali non calcolati (atteso 8 assi)");
await page.click("button:has-text('Registra commissione')");
await page.waitForURL(detail("ordini"));
let body = await page.textContent("main");
if (!body.includes("$ 88,50")) throw new Error("totale errato (atteso $ 88,50)");
if (!body.includes("$ 58,50")) throw new Error("residuo errato (atteso $ 58,50)");
const orderUrl = page.url();

step("scenario 2: saldo");
await page.click("text=Inserisci l'intero residuo");
await page.fill("#pay-note", "Saldo");
await page.click("button:has-text('Registra pagamento')");
await page.waitForSelector("text=Commissione interamente saldata");
await page.screenshot({ path: `${OUT}/03-ordine-saldato.png`, fullPage: true });
body = await page.textContent("main");
if (!body.includes("Saldato")) throw new Error("timbro SALDATO assente");

step("bacheca e homepage");
await page.goto(`${BASE}/ordini`);
await page.screenshot({ path: `${OUT}/04-bacheca.png`, fullPage: true });
await page.goto(`${BASE}/?periodo=totale`);
await page.screenshot({ path: `${OUT}/05-registro.png`, fullPage: true });

step("scenario 4: strillone con emoji");
const emoji = "Assi di quercia 🪵🪚 pagamento 💵 — 🤠 àèìòù";
await page.goto(`${BASE}/strilloni/nuovo`);
await page.evaluate(() => localStorage.clear());
await page.reload();
await page.fill("#a-title", "Prova 📣");
await page.fill("#a-content", emoji);
await page.click("button:has-text('Affiggi strillone')");
await page.waitForURL(detail("strilloni"));
await page.click("text=Modifica");
await page.waitForURL(/modifica/);
if ((await page.inputValue("#a-content")) !== emoji) throw new Error("emoji alterate nel caricamento");
await page.fill("#a-content", emoji + " ✅");
await page.click("button:has-text('Salva modifiche')");
await page.waitForURL(detail("strilloni"));
if (!(await page.textContent("article")).includes(emoji + " ✅")) throw new Error("emoji perse dopo la modifica");
await page.goto(`${BASE}/strilloni`);
await page.screenshot({ path: `${OUT}/06-strilloni.png`, fullPage: true });

step("scenario 3: ricettario e calcolo");
await page.goto(`${BASE}/ricettario`);
await page.screenshot({ path: `${OUT}/07-ricettario.png`, fullPage: true });
await Promise.all([page.waitForURL(/\/ricettario\/[a-z0-9]+$/), page.click("a:has-text('Tavolo da saloon (esempio)')")]);
await page.fill("input[type=number]", "5");
const calc = await page.textContent("table");
if (!calc.includes("20 pz")) throw new Error("calcolo materiali errato (atteso 20 pz)");
await page.screenshot({ path: `${OUT}/08-ricetta.png`, fullPage: true });

step("scenario 5: import da screenshot (OCR)");
const [r1, r2, r3] = [0, 1, 2].map(() => String(Math.floor(1000 + Math.random() * 8999)));
const shot = await ctx.newPage();
await shot.setViewportSize({ width: 900, height: 260 });
await shot.setContent(`<body style="margin:0;background:#1d1a17;color:#eee;font:22px Arial;padding:20px">
<table style="border-collapse:collapse;width:100%"><tr style="color:#d9b26a"><td>Nome</td><td>Cognome</td><td>Codice missiva</td><td>Attività</td></tr>
<tr><td>Lenny</td><td>Summers</td><td>0${r1}</td><td>Pistolero</td></tr>
<tr><td>Abigail</td><td>Roberts</td><td>${r2}</td><td>Cuoca</td></tr>
<tr><td>Charles</td><td>Smith</td><td>${r3}</td><td>Cacciatore</td></tr></table></body>`);
const png = await shot.screenshot({ path: `${OUT}/screenshot-contatti.png` });
await shot.close();
await page.goto(`${BASE}/rubrica`);
await page.click("button:has-text('Importa da immagine')");
await page.setInputFiles("dialog input[type=file]", { name: "contatti.png", mimeType: "image/png", buffer: png });
await page.waitForSelector("text=Verificate e correggete", { timeout: 120000 });
await page.screenshot({ path: `${OUT}/09-import-ocr.png`, fullPage: true });
const vals = await page.$$eval("dialog tbody input.input", (els) => els.map((e) => e.value));
console.log("   OCR →", JSON.stringify(vals));
for (const expected of ["Lenny", "0" + r1, "Abigail", r2, "Charles", r3]) {
  if (!vals.includes(expected)) throw new Error(`OCR: valore atteso mancante ${expected}`);
}
// Righe segnalate come possibili duplicati (esecuzioni precedenti) sono deselezionate: le si importa consapevolmente
for (const cb of await page.$$("dialog tbody input[type=checkbox]")) if (!(await cb.isChecked())) await cb.check();
const saveBtn = page.locator("dialog button:has-text('Conferma e salva 3 contatti')");
await saveBtn.click();
await page.waitForSelector("text=contatti importati", { timeout: 15000 });
await page.waitForTimeout(500);
if (!(await page.textContent("main")).includes("Summers")) throw new Error("contatti importati non visibili in rubrica");
await page.screenshot({ path: `${OUT}/10-rubrica.png`, fullPage: true });

step("schermate mobile");
const m = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, storageState: await ctx.storageState() });
const mp = await m.newPage();
for (const [path, name] of [["/", "m-registro"], ["/ordini", "m-bacheca"], [new URL(orderUrl).pathname, "m-ordine"], ["/rubrica", "m-rubrica"]]) {
  await mp.goto(BASE + path);
  await mp.waitForTimeout(900); // fine delle animazioni d'ingresso
  const overflow = await mp.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  if (overflow) errors.push(`scorrimento orizzontale su mobile: ${path}`);
  await mp.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
}
await mp.click("button:has-text('Menu')");
await mp.screenshot({ path: `${OUT}/m-menu.png` });

await browser.close();
if (errors.length) {
  console.log("Errori rilevati:\n - " + errors.join("\n - "));
  process.exit(1);
}
console.log("OK: tutti gli scenari superati");
