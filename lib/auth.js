import { createHmac, timingSafeEqual } from "crypto";

// Sesión del panel admin: cookie HttpOnly firmada que vence en 12 horas.
// La clave nunca se guarda en el navegador; si cambias ADMIN_KEY en Vercel,
// todas las sesiones abiertas se cierran solas.

export const SESSION_COOKIE = "kake_admin";
const TTL_SECONDS = 12 * 60 * 60;

function adminKey() {
  if (process.env.ADMIN_KEY) return process.env.ADMIN_KEY;
  return process.env.NODE_ENV === "production" ? null : "kake";
}

function safeEqual(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && timingSafeEqual(x, y);
}

function sign(payload) {
  return createHmac("sha256", "kake-session:" + adminKey()).update(payload).digest("base64url");
}

export function checkAdminKey(given) {
  const key = adminKey();
  return !!key && typeof given === "string" && safeEqual(given, key);
}

export function createSession() {
  const exp = Math.floor(Date.now() / 1000) + TTL_SECONDS;
  return { value: `${exp}.${sign(String(exp))}`, maxAge: TTL_SECONDS };
}

export function isAdmin(req) {
  if (!adminKey()) return false;
  const raw = req.cookies?.get(SESSION_COOKIE)?.value || "";
  const [exp, sig] = raw.split(".");
  if (!exp || !sig || !/^\d+$/.test(exp)) return false;
  if (Number(exp) < Date.now() / 1000) return false;
  return safeEqual(sig, sign(exp));
}

export const cookieOptions = (maxAge) => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict",
  path: "/",
  maxAge,
});
