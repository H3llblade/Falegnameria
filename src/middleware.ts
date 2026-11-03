import { NextResponse, type NextRequest } from "next/server";

/**
 * Il sito è consultabile senza accesso (sezioni pubbliche decise dall'amministratore).
 * Qui si filtrano solo le pagine di scrittura: senza cookie di sessione → login.
 * La verifica vera di sessione e permessi avviene lato server (pagine, azioni, API).
 */
const WRITE_PAGE = /^\/(impostazioni(\/.*)?|[a-z]+\/(nuovo|nuova)|[a-z]+\/[^/]+\/modifica)$/;

/** Origine pubblica: dietro Nginx l'URL interno sarebbe localhost:PORT */
function publicOrigin(req: NextRequest): string {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? req.nextUrl.host;
  const proto = req.headers.get("x-forwarded-proto") ?? req.nextUrl.protocol.replace(":", "");
  return `${proto}://${host}`;
}

export function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;
  if (!WRITE_PAGE.test(path)) return NextResponse.next();
  const has = req.cookies.has("__Host-fl_session") || req.cookies.has("fl_session");
  if (has) return NextResponse.next();
  return NextResponse.redirect(`${publicOrigin(req)}/login?next=${encodeURIComponent(path)}`);
}

export const config = {
  matcher: ["/((?!api/|_next/static|_next/image|favicon.ico|icon.svg|tesseract/|robots.txt|login).*)"],
};
