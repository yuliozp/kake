// Cliente mínimo de la API de Stripe (sin SDK): Checkout y verificación de webhooks.
import { createHmac, timingSafeEqual } from "crypto";

const API = process.env.STRIPE_API_BASE || "https://api.stripe.com/v1"; // override solo para pruebas locales

export const stripeEnabled = () => !!process.env.STRIPE_SECRET_KEY;
export const stripeTestMode = () => (process.env.STRIPE_SECRET_KEY || "").startsWith("sk_test_");

// Convierte { a: { b: 1 }, c: [ { d: 2 } ] } en a[b]=1&c[0][d]=2 (formato que usa Stripe).
function encode(obj, prefix = "", out = []) {
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (typeof v === "object") encode(v, key, out);
    else out.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(v))}`);
  }
  return out.join("&");
}

async function stripe(method, path, params) {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY no configurada");
  const res = await fetch(API + path, {
    method,
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "Stripe-Version": "2024-06-20",
    },
    body: method === "GET" ? undefined : encode(params || {}),
    cache: "no-store",
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = json?.error?.message || `Stripe ${res.status}`;
    throw new Error(msg);
  }
  return json;
}

export function createCheckoutSession({ orderId, orderNumber, amount, email, lang, successUrl, cancelUrl }) {
  const cents = Math.round(Number(amount) * 100);
  const name = lang === "en" ? `Deposit · order ${orderNumber}` : `Anticipo · pedido ${orderNumber}`;
  const meta = { order_id: String(orderId), order_number: orderNumber, kind: "deposit" };
  return stripe("POST", "/checkout/sessions", {
    mode: "payment",
    locale: lang === "en" ? "en" : "es",
    customer_email: email || undefined,
    client_reference_id: String(orderId),
    success_url: successUrl,
    cancel_url: cancelUrl,
    line_items: [{ quantity: 1, price_data: { currency: "usd", unit_amount: cents, product_data: { name } } }],
    metadata: meta,
    payment_intent_data: { description: `Karla's Bake · ${name}`, metadata: meta },
  });
}

export const getCheckoutSession = (id) => stripe("GET", `/checkout/sessions/${encodeURIComponent(id)}`);

// Cierra una página de pago abierta para que ya no se pueda pagar desde ella.
export const expireCheckoutSession = (id) => stripe("POST", `/checkout/sessions/${encodeURIComponent(id)}/expire`, {});

// Verifica la firma "Stripe-Signature: t=...,v1=..." del webhook.
export function verifyWebhook(rawBody, header, secret, toleranceSec = 300) {
  if (!header || !secret) return false;
  const parts = Object.fromEntries(
    header.split(",").map((p) => p.split("=")).filter((p) => p.length === 2).map(([k, v]) => [k.trim(), v.trim()])
  );
  const sigs = header.split(",").filter((p) => p.trim().startsWith("v1=")).map((p) => p.trim().slice(3));
  const t = Number(parts.t);
  if (!t || !sigs.length) return false;
  if (Math.abs(Date.now() / 1000 - t) > toleranceSec) return false;
  const expected = createHmac("sha256", secret).update(`${t}.${rawBody}`).digest("hex");
  const a = Buffer.from(expected);
  return sigs.some((s) => {
    const b = Buffer.from(s);
    return b.length === a.length && timingSafeEqual(a, b);
  });
}
