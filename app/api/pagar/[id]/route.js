import { NextResponse } from "next/server";
import { getOrderSummary, rateLimit, setCheckoutSession } from "@/lib/db";
import { verifyLink, signLink, siteUrl } from "@/lib/links";
import { sameOrigin, clientIp } from "@/lib/validate";
import { createCheckoutSession, expireCheckoutSession, getCheckoutSession, stripeEnabled } from "@/lib/stripe";
import { PAYABLE, depositInfo } from "@/lib/payments";

export const dynamic = "force-dynamic";
const fail = (error, status = 400) => NextResponse.json({ error }, { status, headers: { "Cache-Control": "no-store" } });

// El cliente pulsa "Pagar anticipo": creamos (o reutilizamos) la sesión de Stripe Checkout.
export async function POST(req, { params }) {
  if (!sameOrigin(req)) return fail("Origen no permitido", 403);
  if (!stripeEnabled()) return fail("El pago en línea aún no está disponible.", 503);
  const { id } = await params;
  if (!/^\d+$/.test(id)) return fail("Not found", 404);
  const oid = Number(id);
  const body = await req.json().catch(() => ({}));
  if (!verifyLink("cliente", oid, body.t)) return fail("Invalid link", 403);
  if (!(await rateLimit("pay:" + clientIp(req), 20, 60 * 60))) return fail("Demasiados intentos. Intenta más tarde.", 429);

  const o = await getOrderSummary(oid);
  if (!o) return fail("Not found", 404);
  const en = o.lang === "en";
  if (!PAYABLE.includes(o.status)) return fail(en ? "This order can't be paid right now." : "Este pedido no se puede pagar en este momento.", 409);
  const { due } = depositInfo(o);
  if (!(due > 0)) return fail(en ? "Your deposit is already paid." : "Tu anticipo ya está pagado.", 409);
  if (due < 0.5) return fail("Monto demasiado pequeño para pago en línea.", 409);

  try {
    // Si hay una sesión abierta por el mismo monto, se reutiliza (evita cobros duplicados).
    if (o.checkout_session_id) {
      const prev = await getCheckoutSession(o.checkout_session_id).catch(() => null);
      if (prev?.status === "open" && prev.amount_total === Math.round(due * 100) && prev.url) {
        return NextResponse.json({ url: prev.url }, { headers: { "Cache-Control": "no-store" } });
      }
      // Quedó abierta por otro monto (cambió lo que se debe): se cierra para que solo exista una página de pago.
      if (prev?.status === "open") await expireCheckoutSession(o.checkout_session_id).catch(() => {});
    }
    const back = `${siteUrl()}/mi-pedido/${oid}?t=${signLink("cliente", oid)}`;
    const session = await createCheckoutSession({
      orderId: oid, orderNumber: o.order_number, amount: due, email: o.email, lang: o.lang,
      successUrl: `${back}&pagado={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${back}&cancelado=1`,
    });
    await setCheckoutSession(oid, session.id);
    return NextResponse.json({ url: session.url }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("[pagar]", oid, e);
    return fail(en ? "We couldn't start the payment. Please try again." : "No se pudo iniciar el pago. Intenta de nuevo.", 502);
  }
}
