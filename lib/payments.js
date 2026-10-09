// Pagos en línea (anticipo y saldo), compartidos por la página del cliente, el panel y el webhook de Stripe.
import { confirmIfDepositPaid, getOrderSummary, recordOnlinePayment, setCheckoutSession } from "./db";
import { expireCheckoutSession, stripeEnabled } from "./stripe";
import { notifyCustomerConfirmed, notifyPaymentCustomer, notifyPaymentKarla } from "./notify";
import { customerUrl, siteUrl } from "./links";
import { depositFor } from "./validate";

const round = (n) => Math.round(n * 100) / 100;

export function depositInfo(o) {
  const finalTotal = o.final_total != null ? Number(o.final_total) : null;
  const deposit = o.deposit_amount != null ? Number(o.deposit_amount) : finalTotal ? depositFor(finalTotal) : null;
  const paid = Number(o.paid_amount || 0);
  const due = deposit != null ? Math.max(0, round(deposit - paid)) : null;
  const balance = finalTotal != null ? Math.max(0, round(finalTotal - paid)) : null;
  return { finalTotal, deposit, paid, due, balance };
}

// Lo que el cliente puede pagar en línea ahora mismo, o null.
//  - Anticipo: pedido aceptado por Karla (o confirmado a mano sin anticipo completo).
//  - Saldo: pedido completado (listo), con el anticipo ya cubierto.
export function payableNow(o) {
  if (!o) return null;
  const { due, balance } = depositInfo(o);
  if (["aceptado", "confirmado"].includes(o.status) && due > 0) return { kind: "deposit", amount: due };
  if (o.status === "completado" && balance > 0) return { kind: "balance", amount: balance };
  return null;
}

// Registra una sesión de Checkout pagada. Seguro de llamar varias veces (desde el
// regreso del cliente y desde el webhook): solo la primera registra y avisa.
export async function handlePaidSession(session) {
  if (!session || session.payment_status !== "paid") return { recorded: false, reason: "not_paid" };
  const kind = session.metadata?.kind;
  if (kind !== "deposit" && kind !== "balance") return { recorded: false, reason: "other" };
  const orderId = Number(session.metadata?.order_id || session.client_reference_id);
  if (!Number.isInteger(orderId) || orderId <= 0) return { recorded: false, reason: "no_order" };
  if ((session.currency || "usd").toLowerCase() !== "usd") return { recorded: false, reason: "currency" };
  const amount = Math.round(Number(session.amount_total || 0)) / 100;
  if (!(amount > 0)) return { recorded: false, reason: "amount" };

  const recorded = await recordOnlinePayment({
    orderId, sessionId: session.id, amount,
    paymentIntent: typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id,
  });
  let confirmed = false;
  if (recorded) {
    // Con el anticipo pagado, el pedido aceptado queda CONFIRMADO.
    confirmed = await confirmIfDepositPaid(orderId).catch((e) => { console.error("[pago] confirmar", orderId, e); return false; });
    const o = await getOrderSummary(orderId);
    if (o) {
      const info = depositInfo(o);
      const link = customerUrl(orderId);
      await Promise.all([
        notifyPaymentKarla({ o, amount, kind, ...info, confirmed, adminLink: `${siteUrl()}/admin` }),
        confirmed
          ? notifyCustomerConfirmed({ o, finalTotal: info.finalTotal, paid: info.paid, amount, link })
          : notifyPaymentCustomer({ o, amount, ...info, link }),
      ]).catch((e) => console.error("[pago] aviso", orderId, e));
    }
  }
  return { recorded, confirmed, orderId, amount };
}

// Si el pedido ya no tiene nada que pagar en línea (se registró un cobro en el panel, se
// canceló o se entregó), se cierra la página de pago de Stripe que hubiera quedado abierta.
export async function closeCheckoutIfSettled(orderId) {
  if (!stripeEnabled()) return false;
  const o = await getOrderSummary(orderId);
  if (!o?.checkout_session_id) return false;
  if (payableNow(o)) return false;
  await expireCheckoutSession(o.checkout_session_id).catch(() => {}); // ya pagada o vencida: nada que cerrar
  await setCheckoutSession(orderId, null);
  return true;
}
