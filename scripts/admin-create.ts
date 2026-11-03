/**
 * Bootstrap sicuro dell'amministratore: da eseguire sul server.
 *   npm run admin:create                      (interattivo, password nascosta)
 *   ADMIN_USERNAME=x ADMIN_PASSWORD=y npm run admin:create   (non interattivo, es. prima installazione)
 *   npm run admin:create -- --reset           (reimposta la password di un utente esistente)
 * Crea anche le categorie predefinite del ricettario se mancano.
 */
import { PrismaClient } from "@prisma/client";
import readline from "node:readline";
import { hashPassword, passwordProblems } from "../src/lib/auth/password";
import { DEFAULT_RECIPE_CATEGORIES } from "../src/lib/labels";

const prisma = new PrismaClient();

function ask(q: string, hidden = false): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  if (hidden) {
    const out = rl as unknown as { _writeToOutput: (s: string) => void; output: NodeJS.WriteStream };
    out._writeToOutput = (s: string) => {
      if (s.includes(q)) out.output.write(s);
      else out.output.write("*");
    };
  }
  return new Promise((res) =>
    rl.question(q, (a) => {
      rl.close();
      if (hidden) process.stdout.write("\n");
      res(a.trim());
    }),
  );
}

async function main() {
  const reset = process.argv.includes("--reset");
  let username = (process.env.ADMIN_USERNAME || "").trim().toLowerCase();
  let password = process.env.ADMIN_PASSWORD || "";
  let displayName = (process.env.ADMIN_DISPLAY_NAME || "").trim();
  if (!username) username = (await ask("Nome utente amministratore: ")).toLowerCase();
  if (!/^[a-z0-9._-]{3,40}$/.test(username)) throw new Error("Nome utente non valido (3-40 caratteri: lettere, numeri, . _ -)");
  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing && !reset) throw new Error(`L'utente "${username}" esiste già. Usare --reset per reimpostare la password.`);
  if (!existing && !displayName && !process.env.ADMIN_USERNAME) displayName = await ask("Nome visualizzato (es. Mastro falegname): ");
  if (!password) {
    password = await ask("Password (min 10 caratteri, lettere e numeri): ", true);
    const again = await ask("Ripeti la password: ", true);
    if (again !== password) throw new Error("Le password non coincidono");
  }
  const problem = passwordProblems(password);
  if (problem) throw new Error(problem);
  const passwordHash = await hashPassword(password);
  if (existing) {
    await prisma.user.update({ where: { id: existing.id }, data: { passwordHash, active: true } });
    await prisma.session.deleteMany({ where: { userId: existing.id } });
    await prisma.auditLog.create({ data: { userId: existing.id, action: "password_reset_cli", entity: "User", entityId: existing.id } });
    console.log(`Password di "${username}" reimpostata; sessioni precedenti chiuse.`);
  } else {
    const u = await prisma.user.create({ data: { username, displayName: displayName || username, passwordHash, role: "ADMIN" } });
    await prisma.auditLog.create({ data: { userId: u.id, action: "bootstrap", entity: "User", entityId: u.id } });
    console.log(`Amministratore "${username}" creato.`);
  }
  if ((await prisma.category.count()) === 0) {
    await prisma.category.createMany({ data: DEFAULT_RECIPE_CATEGORIES.map((name, i) => ({ name, kind: "RECIPE" as const, sortOrder: i })) });
    console.log("Categorie predefinite del ricettario create.");
  }
}

main()
  .catch((e) => {
    console.error("Errore:", e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
