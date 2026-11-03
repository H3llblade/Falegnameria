# Falegnameria — Wild Lands 1900

Gestionale web per la bottega di falegnameria del Roleplay *Wild Lands 1900*: ordini e commesse, incassi e crediti, bacheca, strilloni, ricettario delle lavorazioni, rubrica con codici missiva e importazione dei contatti da screenshot (OCR locale).

**Produzione:** https://falegnameria.devicloud.me · **Deploy:** [docs/DEPLOY.md](docs/DEPLOY.md)

## Accesso e ruoli

| Chi | Cosa può fare |
|---|---|
| **Visitatore** (nessun accesso) | Consulta in sola lettura le sezioni rese pubbliche dall'amministratore (default: tutte). Non vede bozze né elementi archiviati. Non esiste registrazione. |
| **Gestore** | Crea e modifica ordini, pagamenti, contatti, ricette e strilloni; può archiviare e annullare, **non eliminare**. |
| **Amministratore** | Tutto, comprese le eliminazioni, la gestione utenti (nuovi gestori, nuova password, ruoli, disattivazione) e la visibilità pubblica. |

Le password non sono mai visibili, nemmeno all'amministratore: nel database c'è solo un hash scrypt. Per consegnare un accesso si usa *Impostazioni → Nuova password*, che mostra la password generata una sola volta.

## Tecnologie

Next.js 15 (App Router) · TypeScript · Tailwind CSS 4 · PostgreSQL 16 · Prisma 6 · React Hook Form + Zod · Tesseract.js (OCR nel browser) · pdf-lib · PM2 · Nginx · Let's Encrypt · GitHub Actions.

## Sezioni

| Sezione | Percorso | Contenuto |
|---|---|---|
| Registro generale | `/` | Da riscuotere, incassi per periodo, valore commesse aperte, ordini in lavorazione, ultimi ordini/pagamenti/strilloni |
| Bacheca ordini | `/ordini` | Fogli affissi con timbri, ricerca, filtri stato/pagamento, ordinamento, archivio |
| Nuovo ordine | `/ordini/nuovo` | Cliente da rubrica o nuovo, più righe, ricette, calcolo materiali, acconto, bozza automatica |
| Dettaglio ordine | `/ordini/[id]` | Registro pagamenti (aggiungi/correggi/annulla con motivo), stati, duplica, stampa, PDF, cronologia |
| Strilloni | `/strilloni` | Manifesti con emoji, categorie, priorità, fissati in alto, bozze, scadenze, anteprima, stampa |
| Ricettario | `/ricettario` | Schede lavorazione, materiali per unità, calcolo per N unità, immagine, duplica, collega a ordine |
| Rubrica | `/rubrica` | Registro alfabetico (cognome, nome, collazione italiana), duplicati, CSV, **Importa da immagine** |
| Impostazioni | `/impostazioni` | Password, sessioni, categorie, visibilità pubblica, utenti e gestori, registro di controllo |

## Sviluppo in GitHub Codespaces

Il Codespace avvia automaticamente PostgreSQL (`.devcontainer/`), copia `.env.example` in `.env`, installa le dipendenze e applica le migrazioni.

```bash
npm run admin:create      # crea il primo amministratore (interattivo)
npm run seed:demo         # FACOLTATIVO: ricette/strillone dimostrativi (marcati come esempio)
npm run dev               # http://localhost:3000
```

Fuori da Codespaces: `npm run db:up` avvia PostgreSQL con Docker.

## Script

| Comando | Descrizione |
|---|---|
| `npm run dev` / `build` / `start` | Sviluppo, build di produzione, avvio |
| `npm run typecheck` · `lint` · `test` | Controlli TypeScript, ESLint, test (Vitest) |
| `npm run check` | Tutti i controlli insieme |
| `npm run db:migrate` | Nuova migrazione in sviluppo (`prisma migrate dev`) |
| `npm run db:deploy` · `db:status` | Applica / mostra le migrazioni |
| `npm run admin:create` | Crea un amministratore; `-- --reset` reimposta la password |
| `npm run seed:demo` | Dati dimostrativi (bloccato in produzione) |
| `npm run e2e` | Prova nel browser di tutti gli scenari (richiede server avviato) |

### Test

- **Unitari**: denaro in centesimi, quantità, ordinamento italiano, duplicati, CSV, parser OCR.
- **Scenari su PostgreSQL** (`tests/scenarios.integration.test.ts`): ordine con due righe e acconto, saldo, nessuna eccedenza, correzione/annullamento pagamenti, ricetta e storico ordini, emoji, eliminazione contatto, pagamenti concorrenti. Richiedono `TEST_DATABASE_URL` (database dedicato, viene svuotato).
- **End-to-end** (`tests/e2e/smoke.mjs`, Playwright): i 5 scenari di accettazione nel browser, incluso l'OCR di uno screenshot, più controllo dello scorrimento orizzontale su smartphone.

```bash
TEST_DATABASE_URL="postgresql://falegnameria:falegnameria_dev@localhost:5432/falegnameria_test?schema=public" npm test
npx playwright install chromium   # una volta
BASE_URL=http://localhost:3000 E2E_USER=... E2E_PASS=... npm run e2e
```

## Scelte progettuali

- **Importi** in centesimi interi (`Int`), mai floating point. Quantità materiali in `Decimal(12,3)` e calcolate in millesimi interi.
- **Totale e incassato** dell'ordine sono ricalcolati in transazione da righe e pagamenti validi, con lock di riga (`SELECT … FOR UPDATE`): i pagamenti non possono superare il totale, nemmeno in concorrenza.
- **Storico intatto**: l'ordine conserva nome e codice missiva del cliente e una copia dei materiali della ricetta; modificare/eliminare contatti o ricette non altera gli ordini passati.
- **Pagamenti** mai cancellati: si correggono (con motivo e valore precedente nell'audit) o si annullano (barrati, esclusi dagli incassi).
- **Eliminazione ordini** solo per ordini annullati o archiviati, digitando `ELIMINA <numero>`; copia completa nel registro di controllo.
- **Sicurezza**: password con scrypt, sessioni con token casuale (nel DB solo l'hash), cookie `__Host-` HttpOnly/Secure/SameSite=Lax, CSRF gestito dalle Server Actions (controllo Origin), rate limiting del login, CSP restrittiva, contenuti utente sempre resi come testo.
- **OCR** nel browser con Tesseract.js: lo screenshot non lascia il dispositivo; worker e motore serviti dal sito, dizionari ita/eng da jsDelivr (gratuito) o copia locale. Nessun salvataggio senza conferma; i campi incerti sono evidenziati.
