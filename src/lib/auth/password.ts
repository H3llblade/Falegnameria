import { randomBytes, scrypt as scryptCb, timingSafeEqual, type ScryptOptions } from "node:crypto";

// scrypt (memory-hard) dal modulo crypto di Node: nessuna dipendenza nativa.
const N = 2 ** 15;
const r = 8;
const p = 1;
const KEYLEN = 64;
const MAXMEM = 64 * 1024 * 1024;

function scrypt(password: string, salt: Buffer, keylen: number, opts: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scryptCb(password.normalize("NFKC"), salt, keylen, opts, (err, key) => (err ? reject(err) : resolve(key))),
  );
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(password, salt, KEYLEN, { N, r, p, maxmem: MAXMEM });
  return `scrypt$${N}$${r}$${p}$${salt.toString("base64")}$${key.toString("base64")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [, nS, rS, pS, saltB64, keyB64] = parts;
  const expected = Buffer.from(keyB64, "base64");
  const key = await scrypt(password, Buffer.from(saltB64, "base64"), expected.length, {
    N: Number(nS),
    r: Number(rS),
    p: Number(pS),
    maxmem: MAXMEM,
  });
  return key.length === expected.length && timingSafeEqual(key, expected);
}

export const PASSWORD_MIN_LENGTH = 10;

export function passwordProblems(pw: string): string | null {
  if (pw.length < PASSWORD_MIN_LENGTH) return `La password deve contenere almeno ${PASSWORD_MIN_LENGTH} caratteri`;
  if (pw.length > 200) return "Password troppo lunga";
  if (!/[A-Za-z]/.test(pw) || !/[0-9]/.test(pw)) return "La password deve contenere lettere e numeri";
  return null;
}

/** Hash fittizio per uniformare i tempi quando l'utente non esiste */
export const DUMMY_HASH =
  "scrypt$32768$8$1$AAAAAAAAAAAAAAAAAAAAAA==$" + Buffer.alloc(64).toString("base64");
