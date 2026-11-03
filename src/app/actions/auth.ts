"use server";

import { randomBytes } from "node:crypto";
import { redirect } from "next/navigation";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { runAction, type ActionResult } from "@/lib/action-result";
import { DUMMY_HASH, hashPassword, passwordProblems, verifyPassword } from "@/lib/auth/password";
import { clearFailures, isRateLimited, registerFailure } from "@/lib/auth/rate-limit";
import { clientIp, createSession, destroySession, requireUser } from "@/lib/auth/session";
import { loginSchema, passwordChangeSchema, userCreateSchema } from "@/lib/validation/schemas";
import { DomainError } from "@/lib/services/errors";
import { SECTIONS, setPublicSections } from "@/lib/services/settings";

export type LoginState = { error?: string; username?: string } | undefined;

export async function loginAction(_prev: LoginState, form: FormData): Promise<LoginState> {
  const parsed = loginSchema.safeParse({ username: form.get("username"), password: form.get("password") });
  if (!parsed.success) return { error: "Inserire nome utente e password" };
  const username = parsed.data.username.toLowerCase();
  const ip = await clientIp();
  const keys = [`ip:${ip}`, `user:${username}`];
  const rl = isRateLimited(keys);
  if (rl.limited) {
    return { error: `Troppi tentativi falliti. Riprovare tra ${Math.ceil(rl.retryAfterSec / 60)} minuti.`, username };
  }
  const user = await prisma.user.findUnique({ where: { username } });
  const ok = await verifyPassword(parsed.data.password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !ok || !user.active) {
    registerFailure(keys);
    await audit(prisma, { action: "login_failed", entity: "User", details: { username: username.slice(0, 60), ip } });
    return { error: "Credenziali non valide", username };
  }
  clearFailures(keys);
  await createSession(user.id);
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await audit(prisma, { userId: user.id, action: "login", entity: "User", entityId: user.id, details: { ip } });
  const next = String(form.get("next") || "/");
  redirect(next.startsWith("/") && !next.startsWith("//") ? next : "/");
}

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}

export async function changePasswordAction(raw: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const me = await requireUser();
    const d = passwordChangeSchema.parse(raw);
    const problem = passwordProblems(d.next);
    if (problem) throw new DomainError(problem, { next: problem });
    const user = await prisma.user.findUniqueOrThrow({ where: { id: me.id } });
    if (!(await verifyPassword(d.current, user.passwordHash)))
      throw new DomainError("Password attuale errata", { current: "Password errata" });
    await prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: me.id }, data: { passwordHash: await hashPassword(d.next) } });
      await audit(tx, { userId: me.id, action: "password_change", entity: "User", entityId: me.id });
    });
  }, "Password aggiornata");
}

/** Chiude tutte le sessioni dell'utente (incluse quelle su altri dispositivi) */
export async function logoutEverywhereAction() {
  const me = await requireUser();
  await prisma.session.deleteMany({ where: { userId: me.id } });
  await audit(prisma, { userId: me.id, action: "logout_all", entity: "User", entityId: me.id });
  await destroySession();
  redirect("/login");
}

export async function createUserAction(raw: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const me = await requireUser("ADMIN");
    const d = userCreateSchema.parse(raw);
    const problem = passwordProblems(d.password);
    if (problem) throw new DomainError(problem, { password: problem });
    const username = d.username.toLowerCase();
    if (await prisma.user.findUnique({ where: { username } })) throw new DomainError("Nome utente già in uso", { username: "Già in uso" });
    await prisma.$transaction(async (tx) => {
      const u = await tx.user.create({
        data: { username, displayName: d.displayName, role: d.role, passwordHash: await hashPassword(d.password) },
      });
      await audit(tx, { userId: me.id, action: "create", entity: "User", entityId: u.id, details: { username, role: d.role } });
    });
    revalidatePath("/impostazioni");
  }, "Utente creato");
}

export async function setUserActiveAction(userId: string, active: boolean): Promise<ActionResult> {
  return runAction(async () => {
    const me = await requireUser("ADMIN");
    if (userId === me.id) throw new DomainError("Non è possibile disattivare il proprio account");
    if (!active) await assertNotLastAdmin(userId);
    await prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: userId }, data: { active } });
      if (!active) await tx.session.deleteMany({ where: { userId } });
      await audit(tx, { userId: me.id, action: active ? "activate" : "deactivate", entity: "User", entityId: userId });
    });
    revalidatePath("/impostazioni");
  }, active ? "Utente riattivato" : "Utente disattivato");
}

/** Password leggibile generata casualmente (senza caratteri ambigui come 0/O, 1/l) */
function generatePassword(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const bytes = randomBytes(14);
  let out = "";
  for (const b of bytes) out += alphabet[b % alphabet.length];
  // garantisce lettere e numeri
  return `${out.slice(0, 6)}-${out.slice(6, 10)}-${(bytes[0] % 90) + 10}${out.slice(10)}`;
}

async function assertNotLastAdmin(userId: string) {
  const target = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (target.role !== "ADMIN") return;
  const admins = await prisma.user.count({ where: { role: "ADMIN", active: true } });
  if (admins <= 1) throw new DomainError("Deve restare almeno un amministratore attivo");
}

/**
 * Reimposta la password di un utente. La nuova password viene restituita UNA sola volta
 * (nel database resta solo l'hash): l'amministratore la comunica al gestore.
 */
export async function resetUserPasswordAction(userId: string): Promise<ActionResult<{ password: string }>> {
  return runAction(async () => {
    const me = await requireUser("ADMIN");
    const password = generatePassword();
    await prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: String(userId) }, data: { passwordHash: await hashPassword(password) } });
      await tx.session.deleteMany({ where: { userId: String(userId) } });
      await audit(tx, { userId: me.id, action: "password_reset", entity: "User", entityId: String(userId) });
    });
    return { password };
  }, "Nuova password generata");
}

const userUpdateSchema = z.object({
  displayName: z.string().trim().min(1, "Nome obbligatorio").max(80),
  role: z.enum(["ADMIN", "STAFF"]),
});

export async function updateUserAction(userId: string, raw: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const me = await requireUser("ADMIN");
    const d = userUpdateSchema.parse(raw);
    const id = String(userId);
    if (d.role !== "ADMIN") {
      if (id === me.id) throw new DomainError("Non potete togliere a voi stessi il ruolo di amministratore");
      await assertNotLastAdmin(id);
    }
    await prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id }, data: { displayName: d.displayName, role: d.role } });
      await audit(tx, { userId: me.id, action: "update", entity: "User", entityId: id, details: d });
    });
    revalidatePath("/impostazioni");
  }, "Utente aggiornato");
}

export async function setPublicSectionsAction(sections: string[]): Promise<ActionResult> {
  return runAction(async () => {
    const me = await requireUser("ADMIN");
    const list = z.array(z.enum(SECTIONS)).max(SECTIONS.length).parse(sections);
    await setPublicSections(prisma, list, me.id);
    revalidatePath("/", "layout");
  }, "Visibilità pubblica aggiornata");
}
