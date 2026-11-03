import { execSync } from "node:child_process";

/** Applica le migrazioni al database di test (solo se configurato) */
export default function setup() {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) return;
  if (!/test/i.test(url)) throw new Error("TEST_DATABASE_URL deve puntare a un database di test (il nome deve contenere 'test')");
  execSync("npx prisma migrate deploy", { env: { ...process.env, DATABASE_URL: url }, stdio: "inherit" });
}
