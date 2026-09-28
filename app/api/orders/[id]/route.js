import { NextResponse } from "next/server";
import { updateOrder } from "@/lib/db";
import { isAdmin } from "@/lib/auth";
import { isISODate, isUploadedImage, money, ORDER_STATUSES, PAYMENT_METHODS, sameOrigin, str } from "@/lib/validate";

export const dynamic = "force-dynamic";

const fail = (error, status = 400) => NextResponse.json({ error }, { status });

// Cambiar estado del pedido y/o registrar el cobro.
export async function PATCH(req, { params }) {
  if (!isAdmin(req)) return fail("Sesión vencida. Vuelve a entrar.", 401);
  if (!sameOrigin(req)) return fail("Origen no permitido", 403);
  const { id } = await params;
  if (!/^\d+$/.test(id)) return fail("Pedido inválido", 404);

  const body = await req.json().catch(() => null);
  if (!body) return fail("Solicitud inválida");

  const update = {};
  if (body.status !== undefined) {
    if (!ORDER_STATUSES.includes(body.status)) return fail("Estado inválido");
    update.status = body.status;
  }
  if (body.payment) {
    const p = body.payment;
    const amount = money(p.amount || 0);
    const finalTotal = p.finalTotal === "" || p.finalTotal == null ? null : money(p.finalTotal);
    if (amount === null) return fail("El monto cobrado no es válido");
    if (p.finalTotal !== "" && p.finalTotal != null && finalTotal === null) return fail("El precio final no es válido");
    if (p.date && !isISODate(p.date)) return fail("La fecha de pago no es válida");
    if (p.method && !PAYMENT_METHODS.includes(p.method)) return fail("Forma de pago inválida");
    if (amount > 0 && (!p.date || !p.method)) return fail("Indica la fecha y la forma de pago");
    let proof;
    if (p.proof === null) proof = "";
    else if (p.proof !== undefined) {
      if (!isUploadedImage(p.proof)) return fail("La foto de evidencia no es válida o es muy pesada");
      proof = p.proof;
    }
    update.payment = {
      amount,
      finalTotal,
      date: p.date || null,
      method: p.method || null,
      note: str(p.note, 500),
      proof,
    };
  }
  if (!update.status && !update.payment) return fail("No hay cambios");

  try {
    const ok = await updateOrder(Number(id), update);
    if (!ok) return fail("Pedido no encontrado", 404);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[orders:update]", id, e);
    return fail("No se pudo guardar el cambio", 500);
  }
}
