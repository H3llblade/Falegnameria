"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { runAction, type ActionResult } from "@/lib/action-result";
import { DUMMY_HASH, hashPassword, passwordProblems, verifyPassword } from "@/lib/auth/password";
import { clearFailures, isRateLimited, registerFailure } from "@/lib/auth/rate-limit";
import { clientIp, createSession, destroySession, requireUser } from "@/lib/auth/session";
import { loginSchema, passwordChangeSchema, userCreateSchema } from "@/lib/validation/schemas";
import { DomainError } from "@/lib/services/errors";

export type LoginState = { error?: string } | undefined;

export async function loginAction(_prev: LoginState, form: FormData): Promise<LoginState> {
  const parsed = loginSchema.safeParse({ username: form.get("username"), password: form.get("password") });
  if (!parsed.success) return { error: "Inserire nome utente e password" };
  const username = parsed.data.username.toLowerCase();
  const ip = await clientIp();
  const keys = [`ip:${ip}`, `user:${username}`];
  const rl = isRateLimited(keys);
  if (rl.limited) {
    return { error: `Troppi tentativi falliti. Riprovare tra ${Math.ceil(rl.retryAfterSec / 60)} minuti.` };
  }
  const user = await prisma.user.findUnique({ where: { username } });
  const ok = await verifyPassword(parsed.data.password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !ok || !user.active) {
    registerFailure(keys);
    await audit(prisma, { action: "login_failed", entity: "User", details: { username: username.slice(0, 60), ip } });
    return { error: "Credenziali non valide" };
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
    await prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: userId }, data: { active } });
      if (!active) await tx.session.deleteMany({ where: { userId } });
      await audit(tx, { userId: me.id, action: active ? "activate" : "deactivate", entity: "User", entityId: userId });
    });
    revalidatePath("/impostazioni");
  }, active ? "Utente riattivato" : "Utente disattivato");
}
