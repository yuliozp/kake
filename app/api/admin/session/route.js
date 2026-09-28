import { NextResponse } from "next/server";
import { checkAdminKey, cookieOptions, createSession, isAdmin, SESSION_COOKIE } from "@/lib/auth";
import { rateLimit } from "@/lib/db";
import { clientIp, sameOrigin } from "@/lib/validate";

export const dynamic = "force-dynamic";

// ¿Hay sesión abierta?
export async function GET(req) {
  return NextResponse.json({ ok: isAdmin(req) }, { headers: { "Cache-Control": "no-store" } });
}

// Iniciar sesión. Máximo 8 intentos cada 15 minutos por dirección IP.
export async function POST(req) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "Origen no permitido" }, { status: 403 });
  const ip = clientIp(req);
  try {
    if (!(await rateLimit("login:" + ip, 8, 15 * 60))) {
      console.warn("[admin:login] demasiados intentos", ip);
      return NextResponse.json({ error: "Demasiados intentos. Espera 15 minutos." }, { status: 429 });
    }
  } catch (e) {
    console.error("[admin:login] rate limit", e);
  }
  const body = await req.json().catch(() => ({}));
  if (!checkAdminKey(body.key)) {
    console.warn("[admin:login] clave incorrecta", ip);
    return NextResponse.json({ error: "Clave incorrecta" }, { status: 401 });
  }
  const s = createSession();
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, s.value, cookieOptions(s.maxAge));
  return res;
}

// Cerrar sesión.
export async function DELETE(req) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "Origen no permitido" }, { status: 403 });
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, "", cookieOptions(0));
  return res;
}
