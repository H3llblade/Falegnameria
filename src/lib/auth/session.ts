import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import type { Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getPublicSections, type Section } from "@/lib/services/settings";

const SESSION_DAYS = Number(process.env.SESSION_DAYS || 7);

export function cookieSecure(): boolean {
  if (process.env.COOKIE_SECURE === "false") return false;
  return process.env.NODE_ENV === "production";
}

/** In produzione su HTTPS si usa il prefisso __Host- (Secure, Path=/, nessun Domain) */
export function sessionCookieName(): string {
  return cookieSecure() ? "__Host-fl_session" : "fl_session";
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export type SessionUser = { id: string; username: string; displayName: string; role: Role };

export async function clientIp(): Promise<string> {
  const h = await headers();
  return (h.get("x-real-ip") || h.get("x-forwarded-for")?.split(",")[0] || "unknown").trim();
}

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400_000);
  const h = await headers();
  await prisma.session.create({
    data: {
      id: hashToken(token),
      userId,
      expiresAt,
      userAgent: h.get("user-agent")?.slice(0, 300) ?? null,
      ip: await clientIp(),
    },
  });
  const jar = await cookies();
  jar.set(sessionCookieName(), token, {
    httpOnly: true,
    secure: cookieSecure(),
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(sessionCookieName())?.value;
  if (token) await prisma.session.deleteMany({ where: { id: hashToken(token) } });
  jar.delete(sessionCookieName());
}

/** Utente corrente (validato sul DB), memorizzato per la singola richiesta */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const jar = await cookies();
  const token = jar.get(sessionCookieName())?.value;
  if (!token || token.length > 100) return null;
  const session = await prisma.session.findUnique({
    where: { id: hashToken(token) },
    include: { user: { select: { id: true, username: true, displayName: true, role: true, active: true } } },
  });
  if (!session || session.expiresAt < new Date() || !session.user.active) return null;
  const { id, username, displayName, role } = session.user;
  return { id, username, displayName, role };
});

/** Per pagine server: reindirizza al login se non autenticato */
export async function requirePageUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export class AuthError extends Error {}

/** Per azioni server e API: errore se non autenticato / non autorizzato */
export async function requireUser(role?: Role): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw new AuthError("Sessione scaduta: effettua di nuovo l'accesso");
  if (role === "ADMIN" && user.role !== "ADMIN") throw new AuthError("Operazione riservata all'amministratore");
  return user;
}

/** Sezioni pubbliche, una sola lettura per richiesta */
export const getPublicSectionsCached = cache(() => getPublicSections(prisma));

/**
 * Per le pagine di consultazione: restituisce l'utente (gestore/admin) oppure null se è
 * un visitatore e la sezione è pubblica. Se la sezione non è pubblica rimanda al login.
 */
export async function viewerFor(section: Section, nextPath: string): Promise<SessionUser | null> {
  const user = await getCurrentUser();
  if (user) return user;
  const pub = await getPublicSectionsCached();
  if (!pub.includes(section)) redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  return null;
}

/** Per le API in sola lettura: consentito a utenti autenticati o se la sezione è pubblica */
export async function canRead(section: Section): Promise<boolean> {
  if (await getCurrentUser()) return true;
  return (await getPublicSectionsCached()).includes(section);
}

export async function purgeExpiredSessions() {
  await prisma.session.deleteMany({ where: { expiresAt: { lt: new Date() } } });
}
