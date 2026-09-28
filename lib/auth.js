import { timingSafeEqual } from "crypto";

// La clave vive solo en la variable ADMIN_KEY de Vercel.
// En desarrollo local (sin ADMIN_KEY) se acepta "kake" para poder probar.
function expectedKey() {
  if (process.env.ADMIN_KEY) return process.env.ADMIN_KEY;
  return process.env.NODE_ENV === "production" ? null : "kake";
}

export function isAdmin(req) {
  const expected = expectedKey();
  if (!expected) return false;
  const given = req.headers.get("x-admin-key") || "";
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
