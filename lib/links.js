import { createHmac, timingSafeEqual } from "crypto";

// Enlaces firmados de los correos: cada botón lleva una firma única para
// ese pedido y ese uso ("karla" o "cliente"). Sin la firma correcta no se
// puede ver ni confirmar nada, aunque alguien adivine el número de pedido.

function secret() {
  const base = process.env.LINK_SECRET || process.env.ADMIN_KEY || (process.env.NODE_ENV === "production" ? "" : "kake");
  if (!base) throw new Error("Falta LINK_SECRET o ADMIN_KEY");
  return "kake-links:" + base;
}

export function signLink(purpose, orderId) {
  return createHmac("sha256", secret()).update(`${purpose}:${orderId}`).digest("base64url").slice(0, 32);
}

export function verifyLink(purpose, orderId, token) {
  if (typeof token !== "string" || token.length !== 32) return false;
  const expected = Buffer.from(signLink(purpose, orderId));
  const given = Buffer.from(token);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

// Dirección pública del sitio para los botones de los correos.
// Mientras karlasbake.com termina de propagarse se usa la de Vercel.
export function siteUrl() {
  return (process.env.SITE_URL || "https://kake-five.vercel.app").replace(/\/$/, "");
}

export const karlaUrl = (id) => `${siteUrl()}/confirmar/${id}?t=${signLink("karla", id)}`;
export const customerUrl = (id) => `${siteUrl()}/mi-pedido/${id}?t=${signLink("cliente", id)}`;
