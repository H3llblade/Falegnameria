import { NextResponse, type NextRequest } from "next/server";

/**
 * Filtro rapido: senza cookie di sessione si viene rimandati al login.
 * La validazione vera della sessione avviene lato server (layout, azioni, API).
 */
export function middleware(req: NextRequest) {
  const has = req.cookies.has("__Host-fl_session") || req.cookies.has("fl_session");
  if (!has) {
    if (req.nextUrl.pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = req.nextUrl.pathname !== "/" ? `?next=${encodeURIComponent(req.nextUrl.pathname)}` : "";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  // Escluse: login, health check, asset statici, file OCR
  matcher: ["/((?!login|api/health|_next/static|_next/image|favicon.ico|icon.svg|tesseract/|robots.txt).*)"],
};
