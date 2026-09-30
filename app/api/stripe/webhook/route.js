import { NextResponse } from "next/server";
import { verifyWebhook } from "@/lib/stripe";
import { handlePaidSession } from "@/lib/payments";

export const dynamic = "force-dynamic";

// Stripe avisa aquí cuando se completa un pago (respaldo por si el cliente no vuelve al sitio).
export async function POST(req) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "Webhook no configurado" }, { status: 503 });
  const raw = await req.text();
  if (!verifyWebhook(raw, req.headers.get("stripe-signature"), secret)) {
    return NextResponse.json({ error: "Firma inválida" }, { status: 400 });
  }
  let event;
  try { event = JSON.parse(raw); } catch { return NextResponse.json({ error: "JSON inválido" }, { status: 400 }); }
  try {
    if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
      const r = await handlePaidSession(event.data?.object);
      console.log("[stripe:webhook]", event.type, event.id, r);
    }
    return NextResponse.json({ received: true });
  } catch (e) {
    console.error("[stripe:webhook]", event?.id, e);
    return NextResponse.json({ error: "Error interno" }, { status: 500 }); // Stripe reintenta
  }
}
