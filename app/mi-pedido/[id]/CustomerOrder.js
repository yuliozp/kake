"use client";
import { useEffect, useRef, useState } from "react";
import Logo from "@/components/Logo";
import { translateLabel, trFact } from "@/lib/i18n";
import { GOOGLE } from "@/lib/google";

const money = (n) => "$" + Number(n || 0).toFixed(2);

const TXT = {
  es: {
    title: "Tu pedido", loading: "Cargando tu pedido…", when: "Entrega", mode: "Modalidad", address: "Dirección",
    cake: "Pastel", cakeOptions: "Personalización", notes: "Notas", subtotal: "Subtotal",
    size: "Tamaño", flavor: "Sabor / relleno", design: "Diseño", deco: "Decoración",
    reviewing: "Tu pedido está en revisión. Karla lo está revisando y confirmará el costo pendiente. Cuando lo acepte, te enviaremos un correo con el total y el enlace para pagar el anticipo.",
    reviewingSimple: "Tu pedido está en revisión. Cuando Karla lo acepte, te enviaremos un correo con el enlace para pagar el anticipo y reservar tu fecha.",
    pendingItems: "Por confirmar", estimate: "Total estimado",
    accepted: "¡Karla aceptó tu pedido! Para confirmarlo y reservar tu fecha, paga el anticipo.",
    total: "Total", deposit: "Anticipo (50 %)",
    confirmed: "¡Tu pedido está confirmado! Tu fecha queda reservada.",
    readyPickup: "¡Tu pedido está listo para recoger!", readyDelivery: "¡Tu pedido está listo! Pronto saldrá a entrega.",
    directions: "Cómo llegar",
    delivered: "Pedido entregado. ¡Gracias por tu preferencia!", review: "Evaluar nuestro servicio en Google",
    payNote: "Karla te contactará con las opciones de pago.",
    payDeposit: "Pagar anticipo", payBalance: "Pagar saldo", paying: "Abriendo el pago…", paySecure: "Pago seguro con Stripe: tarjeta, Apple Pay o Google Pay.",
    verifying: "Confirmando tu pago…", paidOk: "¡Pago recibido! Gracias.", payCancelled: "No se completó el pago. Puedes intentarlo de nuevo cuando quieras.",
    payPending: "Tu pago se está procesando. Te avisaremos por correo cuando se confirme.",
    paid: "Pagado", balance: "Saldo pendiente", balanceNote: "El saldo se paga al recoger o recibir tu pastel.", fullyPaid: "Pagado por completo",
    testMode: "Modo de prueba: usa la tarjeta 4242 4242 4242 4242, cualquier fecha futura y cualquier CVC.",
    cancelled: "Este pedido fue cancelado. Si tienes dudas, escríbenos.",
    help: "¿Preguntas? WhatsApp +1 (409) 332-5768",
  },
  en: {
    title: "Your order", loading: "Loading your order…", when: "Delivery", mode: "Method", address: "Address",
    cake: "Cake", cakeOptions: "Customization", notes: "Notes", subtotal: "Subtotal",
    size: "Size", flavor: "Flavor / filling", design: "Design", deco: "Decoration",
    reviewing: "Your order is under review. Karla is reviewing it and will confirm the pending cost. Once she accepts it, we'll email you the total and the link to pay the deposit.",
    reviewingSimple: "Your order is under review. Once Karla accepts it, we'll email you the link to pay the deposit and hold your date.",
    pendingItems: "To be confirmed", estimate: "Estimated total",
    accepted: "Karla accepted your order! To confirm it and hold your date, please pay the deposit.",
    total: "Total", deposit: "Deposit (50%)",
    confirmed: "Your order is confirmed! Your date is reserved.",
    readyPickup: "Your order is ready for pickup!", readyDelivery: "Your order is ready! It will be out for delivery soon.",
    directions: "Get directions",
    delivered: "Order delivered. Thank you for choosing us!", review: "Rate our service on Google",
    payNote: "Karla will contact you with payment options.",
    payDeposit: "Pay deposit", payBalance: "Pay balance", paying: "Opening payment…", paySecure: "Secure payment with Stripe: card, Apple Pay or Google Pay.",
    verifying: "Confirming your payment…", paidOk: "Payment received! Thank you.", payCancelled: "The payment wasn't completed. You can try again anytime.",
    payPending: "Your payment is processing. We'll email you once it's confirmed.",
    paid: "Paid", balance: "Balance due", balanceNote: "The balance is due when you pick up or receive your cake.", fullyPaid: "Fully paid",
    testMode: "Test mode: use card 4242 4242 4242 4242, any future date and any CVC.",
    cancelled: "This order was cancelled. If you have questions, contact us.",
    help: "Questions? WhatsApp +1 (409) 332-5768",
  },
};

function fmtDate(v, lang) {
  if (!v) return "—";
  const [y, m, d] = String(v).slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(lang === "en" ? "en-US" : "es-US", { weekday: "long", day: "numeric", month: "long" });
}
function fmtTime(v, lang) {
  if (!v) return "";
  const [h, m] = v.split(":").map(Number);
  return new Date(2000, 0, 1, h, m).toLocaleTimeString(lang === "en" ? "en-US" : "es-US", { hour: "numeric", minute: "2-digit" });
}

// Página del cliente: estado de su pedido y pagos en línea (anticipo y saldo).
export default function CustomerOrder({ id, token, paidSession = "", cancelled = false, fresh = false, autoPay = false }) {
  const [o, setO] = useState(null);
  const [error, setError] = useState("");
  const [paying, setPaying] = useState(false);
  // "", "verifying", "ok", "pending", "cancelled"
  const [payMsg, setPayMsg] = useState(paidSession ? "verifying" : cancelled ? "cancelled" : "");
  const autoPayDone = useRef(false);

  async function load() {
    const r = await fetch(`/api/confirmar/cliente/${id}?t=${encodeURIComponent(token)}`, { cache: "no-store" });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || "Error");
    setO(j);
    if (j.lang === "en") document.documentElement.lang = "en";
    return j;
  }

  async function pay() {
    setPaying(true);
    setError("");
    try {
      const r = await fetch(`/api/pagar/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ t: token }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.url) throw new Error(j.error || "Error");
      window.location.assign(j.url);
    } catch (e) {
      setError(e.message);
      setPaying(false);
    }
  }

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        if (paidSession) {
          // Volvió de Stripe: confirmamos el pago con Stripe antes de mostrar el pedido.
          let paid = false;
          for (let i = 0; i < 4 && !paid && alive; i++) {
            const r = await fetch(`/api/pagar/${id}/verificar`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ t: token, session_id: paidSession }),
            });
            const j = await r.json().catch(() => ({}));
            paid = r.ok && j.paid;
            if (!paid) await new Promise((res) => setTimeout(res, 1500));
          }
          if (alive) setPayMsg(paid ? "ok" : "pending");
        }
        if (paidSession || cancelled || fresh || autoPay) {
          const url = new URL(window.location.href);
          for (const k of ["pagado", "cancelado", "nuevo", "pagar"]) url.searchParams.delete(k);
          window.history.replaceState(null, "", url.toString());
        }
        if (!alive) return;
        const j = await load();
        // Enlace "Pagar" del correo: se abre directo la página de pago.
        if (autoPay && !autoPayDone.current && j.can_pay && alive) {
          autoPayDone.current = true;
          await pay();
        }
      } catch (e) {
        if (alive) setError(e.message);
      }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, token]);

  const lang = o?.lang === "en" ? "en" : "es";
  const t = TXT[lang];

  if (error && !o) return <main id="contenido" className="wrap narrow"><div className="card"><Logo /><p className="alert" role="alert">{error}</p></div></main>;
  if (!o) return <main id="contenido" className="wrap narrow"><p className="note" role="status">{payMsg === "verifying" ? TXT.es.verifying : TXT.es.loading}</p></main>;

  const balance = Math.max(0, Number(o.final_total || 0) - Number(o.paid_amount || 0));
  const extraCost = o.price_pending && o.final_total != null && o.final_total > o.estimate;

  const payBox = (
    <div className="pay-box">
      {payMsg === "ok" && <p className="ok" role="status">{t.paidOk}</p>}
      {payMsg === "pending" && <p className="note" role="status">{t.payPending}</p>}
      {payMsg === "cancelled" && o.can_pay && <p className="note" role="status">{t.payCancelled}</p>}
      {Number(o.paid_amount) > 0 && (
        <p>{t.paid}: <strong>{money(o.paid_amount)}</strong>
          {" · "}{balance > 0 ? <>{t.balance}: <strong>{money(balance)}</strong></> : <strong>✓ {t.fullyPaid}</strong>}</p>
      )}
      {o.can_pay ? (
        <>
          {error && <p className="alert" role="alert">{error}</p>}
          <button className="btn wide" onClick={pay} disabled={paying}>
            {paying ? t.paying : `${o.pay_kind === "balance" ? t.payBalance : t.payDeposit} ${money(o.pay_amount)}`}
          </button>
          <p className="note">🔒 {t.paySecure}</p>
          {o.test_mode && <p className="note" style={{ color: "#7a4d00" }}>{t.testMode}</p>}
        </>
      ) : o.status === "aceptado" && o.deposit_due > 0 ? (
        <p className="note">{t.payNote}</p>
      ) : balance > 0 && o.status !== "entregado" ? (
        <p className="note">{t.balanceNote}</p>
      ) : null}
    </div>
  );

  let stateBlock;
  if (o.status === "cancelado") {
    stateBlock = <p className="alert">{t.cancelled}</p>;
  } else if (o.status === "nuevo") {
    stateBlock = (
      <>
        <p className="ok" role={fresh ? "status" : undefined}>{o.price_pending ? t.reviewing : t.reviewingSimple}</p>
        <p className="note">{t.estimate}: <strong>{money(o.estimate)}</strong>{o.price_pending ? ` · ${t.pendingItems}: ${o.pending_items}` : ""}</p>
      </>
    );
  } else {
    const msg = {
      aceptado: t.accepted, confirmado: t.confirmed,
      completado: o.pickup ? t.readyPickup : t.readyDelivery, entregado: t.delivered,
    }[o.status] || "";
    stateBlock = (
      <>
        <p className="ok">{msg}</p>
        {extraCost && o.status === "aceptado" && (
          <dl className="summary compact">
            <div><dt>{t.subtotal}</dt><dd>{money(o.estimate)}</dd></div>
            <div><dt>{o.pending_items}</dt><dd>+ {money(o.final_total - o.estimate)}</dd></div>
          </dl>
        )}
        <p className="total">{t.total}: {money(o.final_total)}</p>
        {o.status === "aceptado" && o.deposit != null && <p>{t.deposit}: <strong>{money(o.deposit)}</strong></p>}
        {o.status === "completado" && o.pickup && (
          <p><a href={GOOGLE.directions} target="_blank" rel="noreferrer">{t.directions}</a></p>
        )}
        {o.status === "entregado" && (
          <p><a className="btn" href={GOOGLE.writeReview} target="_blank" rel="noreferrer">{t.review}</a></p>
        )}
        {payBox}
      </>
    );
  }

  return (
    <main id="contenido" className="wrap narrow">
      <div className="card">
        <Logo />
        <p className="note" style={{ marginBottom: 0 }}>{t.title}</p>
        <h1 className="h2">{o.order_number}</h1>

        <dl className="summary compact">
          <div><dt>{t.when}</dt><dd>{fmtDate(o.delivery_date, lang)} · {fmtTime(o.delivery_time, lang)}</dd></div>
          {o.delivery_type && <div><dt>{t.mode}</dt><dd>{o.delivery_type}</dd></div>}
          {o.delivery_address && <div><dt>{t.address}</dt><dd>{o.delivery_address}</dd></div>}
          {o.cake_name && <div><dt>{t.cake}</dt><dd>{translateLabel(lang, o.cake_name)}{o.cake_details ? ` · ${trFact(lang, o.cake_details)}` : ""}</dd></div>}
          {o.cake_options && <div><dt>{t.cakeOptions}</dt><dd>{o.cake_options}</dd></div>}
          {o.notes && <div><dt>{t.notes}</dt><dd>{o.notes}</dd></div>}
          {o.size_label && <div><dt>{t.size}</dt><dd>{o.size_label}</dd></div>}
          {(o.cake_flavor || o.filling_flavor) && <div><dt>{t.flavor}</dt><dd>{[o.cake_flavor, o.filling_flavor].filter(Boolean).join(" · ")}</dd></div>}
          {o.design_label && <div><dt>{t.design}</dt><dd>{o.design_label}</dd></div>}
          {o.decoration_label && <div><dt>{t.deco}</dt><dd>{o.decoration_label}</dd></div>}
        </dl>

        <div style={{ marginTop: 16 }}>{stateBlock}</div>
        <p className="note" style={{ marginTop: 16 }}>{t.help}</p>
      </div>
    </main>
  );
}
