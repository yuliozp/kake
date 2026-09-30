import { NextResponse } from "next/server";
import { verifyLink } from "@/lib/links";
import { sameOrigin } from "@/lib/validate";
import { getCheckoutSession, stripeEnabled } from "@/lib/stripe";
import { handlePaidSession } from "@/lib/payments";

export const dynamic = "force-dynamic";
const fail = (error, status = 400) => NextResponse.json({ error }, { status, headers: { "Cache-Control": "no-store" } });

// Al volver de Stripe, confirmamos el pago directamente con Stripe (no confiamos en la URL).
export async function POST(req, { params }) {
  if (!sameOrigin(req)) return fail("Origen no permitido", 403);
  if (!stripeEnabled()) return fail("Pago en línea no disponible", 503);
  const { id } = await params;
  if (!/^\d+$/.test(id)) return fail("Not found", 404);
  const oid = Number(id);
  const body = await req.json().catch(() => ({}));
  if (!verifyLink("cliente", oid, body.t)) return fail("Invalid link", 403);
  const sid = typeof body.session_id === "string" ? body.session_id : "";
  if (!/^cs_(test|live)_[A-Za-z0-9]{10,200}$/.test(sid)) return fail("Sesión inválida", 400);
  try {
    const session = await getCheckoutSession(sid);
    const sessionOrder = Number(session.metadata?.order_id || session.client_reference_id);
    if (sessionOrder !== oid) return fail("Sesión inválida", 400);
    if (session.payment_status !== "paid") return NextResponse.json({ paid: false }, { headers: { "Cache-Control": "no-store" } });
    const r = await handlePaidSession(session);
    return NextResponse.json({ paid: true, recorded: r.recorded }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("[pagar:verificar]", oid, e);
    return fail("No se pudo verificar el pago", 502);
  }
}
