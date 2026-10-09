import { NextResponse } from "next/server";
import { acceptOrder, confirmIfDepositPaid, getOrderSummary, transitionStatus, updateOrder } from "@/lib/db";
import { isAdmin } from "@/lib/auth";
import { closeCheckoutIfSettled, depositInfo, payableNow } from "@/lib/payments";
import { customerUrl } from "@/lib/links";
import { stripeEnabled } from "@/lib/stripe";
import {
  notifyCustomerAccepted, notifyCustomerConfirmed, notifyCustomerReady, notifyCustomerThanks,
} from "@/lib/notify";
import { depositFor, isISODate, isShipping, isUploadedImage, money, ORDER_STATUSES, PAYMENT_METHODS, sameOrigin, str } from "@/lib/validate";

export const dynamic = "force-dynamic";

const fail = (error, status = 400) => NextResponse.json({ error }, { status });

// Correo al cliente según el estado nuevo. Devuelve una frase para el aviso del panel.
async function emailForStatus(oid, to) {
  const o = await getOrderSummary(oid);
  if (!o?.email) return "";
  const link = customerUrl(oid);
  const info = depositInfo(o);
  let r = null, what = "";
  if (to === "aceptado") {
    r = await notifyCustomerAccepted({ o, finalTotal: info.finalTotal, deposit: info.deposit, link });
    what = "el enlace para pagar el anticipo";
  } else if (to === "confirmado") {
    r = await notifyCustomerConfirmed({ o, finalTotal: info.finalTotal, paid: info.paid, link });
    what = "la confirmación del pedido";
  } else if (to === "completado" && !isShipping(o.delivery_type)) {
    r = await notifyCustomerReady({ o, finalTotal: info.finalTotal, paid: info.paid, link, canPay: stripeEnabled() && !!payableNow(o) });
    what = info.balance > 0 ? "el aviso de pedido listo y el enlace para pagar el saldo" : "el aviso de pedido listo para recoger";
  } else if (to === "entregado") {
    r = await notifyCustomerThanks({ o });
    what = "el agradecimiento con la solicitud de evaluación";
  }
  if (!r) return "";
  return r.ok ? `Se le envió al cliente ${what}.` : `No se pudo enviar el correo al cliente (${r.error || "error"}).`;
}

// Cambiar estado del pedido y/o registrar el cobro.
export async function PATCH(req, { params }) {
  if (!isAdmin(req)) return fail("Sesión vencida. Vuelve a entrar.", 401);
  if (!sameOrigin(req)) return fail("Origen no permitido", 403);
  const { id } = await params;
  if (!/^\d+$/.test(id)) return fail("Pedido inválido", 404);
  const oid = Number(id);

  const body = await req.json().catch(() => null);
  if (!body) return fail("Solicitud inválida");

  let payment = null;
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
    payment = { amount, finalTotal, date: p.date || null, method: p.method || null, note: str(p.note, 500), proof };
  }
  const to = body.status;
  if (to !== undefined && !ORDER_STATUSES.includes(to)) return fail("Estado inválido");
  if (to === undefined && !payment) return fail("No hay cambios");

  try {
    const o = await getOrderSummary(oid);
    if (!o) return fail("Pedido no encontrado", 404);
    const notes = [];

    if (payment) {
      // Campo vacío = sin cambio: no se borra el precio final que Karla puso al aceptar.
      if (payment.finalTotal === null && o.final_total != null) payment.finalTotal = Number(o.final_total);
      const ok = await updateOrder(oid, { payment });
      if (!ok) return fail("Pedido no encontrado", 404);
      // Si con este cobro el anticipo quedó cubierto, el pedido aceptado pasa a CONFIRMADO.
      if (!to && (await confirmIfDepositPaid(oid))) {
        notes.push("Anticipo cubierto: el pedido pasó a Confirmado.");
        const m = await emailForStatus(oid, "confirmado");
        if (m) notes.push(m);
      }
    }

    let status = (await getOrderSummary(oid))?.status || o.status;
    if (to && to !== status) {
      const from = status;
      // Aceptar (o confirmar) desde "En revisión": hace falta el precio final.
      if (from === "nuevo" && (to === "aceptado" || to === "confirmado")) {
        const fresh = await getOrderSummary(oid);
        const finalTotal = fresh.final_total != null ? Number(fresh.final_total) : fresh.price_pending ? null : Number(fresh.total || 0);
        if (!(finalTotal > 0)) {
          return fail(`Este pedido tiene costo por confirmar (${fresh.pending_items || "envío"}). Usa "Revisar y aceptar" para poner el monto.`, 409);
        }
        if (!(await acceptOrder(oid, finalTotal, depositFor(finalTotal)))) return fail("El pedido cambió. Actualiza la página.", 409);
        status = "aceptado";
        if (to === "aceptado") {
          const m = await emailForStatus(oid, "aceptado");
          if (m) notes.push(m);
        }
      }
      if (to !== status) {
        if (!(await transitionStatus(oid, status, to))) return fail("El pedido cambió. Actualiza la página.", 409);
        // Correos solo al avanzar (no al corregir un estado hacia atrás).
        const order = ["nuevo", "aceptado", "confirmado", "completado", "entregado"];
        const forward = to !== "cancelado" && order.indexOf(to) > order.indexOf(from);
        if (forward) {
          const m = await emailForStatus(oid, to);
          if (m) notes.push(m);
        }
      }
    }
    await closeCheckoutIfSettled(oid).catch((e) => console.error("[orders:update] cerrar pago", id, e));
    const fresh = await getOrderSummary(oid);
    return NextResponse.json({
      ok: true, note: notes.join(" "),
      order: fresh && {
        status: fresh.status, final_total: fresh.final_total, deposit_amount: fresh.deposit_amount,
        price_confirmed_at: fresh.price_confirmed_at, paid_amount: fresh.paid_amount,
      },
    });
  } catch (e) {
    console.error("[orders:update]", id, e);
    return fail("No se pudo guardar el cambio", 500);
  }
}
