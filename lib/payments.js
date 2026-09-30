// Lógica del anticipo en línea, compartida por la página del cliente y el webhook de Stripe.
import { getOrderSummary, recordOnlinePayment } from "./db";
import { notifyPaymentKarla, notifyPaymentCustomer } from "./notify";
import { customerUrl, siteUrl } from "./links";
import { depositFor } from "./validate";

// Estados en los que el cliente puede pagar el anticipo.
export const PAYABLE = ["confirmado", "en_preparacion", "listo", "en_entrega"];

export function depositInfo(o) {
  const finalTotal = o.final_total != null ? Number(o.final_total) : null;
  const deposit = o.deposit_amount != null ? Number(o.deposit_amount) : finalTotal ? depositFor(finalTotal) : null;
  const paid = Number(o.paid_amount || 0);
  const due = deposit != null ? Math.max(0, Math.round((deposit - paid) * 100) / 100) : null;
  return { finalTotal, deposit, paid, due };
}

// Registra una sesión de Checkout pagada. Seguro de llamar varias veces (desde el
// regreso del cliente y desde el webhook): solo la primera registra y avisa.
export async function handlePaidSession(session) {
  if (!session || session.payment_status !== "paid") return { recorded: false, reason: "not_paid" };
  if (session.metadata?.kind !== "deposit") return { recorded: false, reason: "other" };
  const orderId = Number(session.metadata?.order_id || session.client_reference_id);
  if (!Number.isInteger(orderId) || orderId <= 0) return { recorded: false, reason: "no_order" };
  if ((session.currency || "usd").toLowerCase() !== "usd") return { recorded: false, reason: "currency" };
  const amount = Math.round(Number(session.amount_total || 0)) / 100;
  if (!(amount > 0)) return { recorded: false, reason: "amount" };

  const recorded = await recordOnlinePayment({
    orderId, sessionId: session.id, amount,
    paymentIntent: typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id,
  });
  if (recorded) {
    const o = await getOrderSummary(orderId);
    if (o) {
      const info = depositInfo(o);
      await Promise.all([
        notifyPaymentKarla({ o, amount, ...info, adminLink: `${siteUrl()}/admin` }),
        notifyPaymentCustomer({ o, amount, ...info, link: customerUrl(orderId) }),
      ]).catch((e) => console.error("[pago] aviso", orderId, e));
    }
  }
  return { recorded, orderId, amount };
}
