"use client";
import { useEffect, useState } from "react";
import Logo from "@/components/Logo";

const money = (n) => "$" + Number(n || 0).toFixed(2);

const TXT = {
  es: {
    title: "Tu pedido", loading: "Cargando tu pedido…", when: "Entrega", mode: "Modalidad", address: "Dirección",
    cake: "Pastel", cakeOptions: "Personalización", notes: "Notas", subtotal: "Subtotal",
    thanks: "¡Gracias! Recibimos tu pedido y ya está confirmado. Te enviamos la confirmación por correo.",
    size: "Tamaño", flavor: "Sabor / relleno", design: "Diseño", deco: "Decoración",
    reviewing: "Karla está revisando tu pedido. Te enviaremos el precio final por correo para que lo apruebes.",
    reviewingSimple: "Karla está revisando tu pedido y te lo confirmará por correo.",
    pendingItems: "Por confirmar", estimate: "Subtotal estimado",
    priceReady: "Karla confirmó el precio de tu pedido. Si estás de acuerdo, confírmalo:",
    total: "Total", deposit: "Anticipo (50 %)", confirm: "Confirmar mi pedido", confirming: "Confirmando…",
    confirmNote: "Al confirmar reservamos tu fecha. El siguiente paso es el pago del anticipo.",
    confirmed: "¡Tu pedido está confirmado!", nextStep: "Siguiente paso: pago del anticipo de",
    payNote: "Karla te contactará con las opciones de pago.",
    payBtn: "Pagar anticipo", paying: "Abriendo el pago…", paySecure: "Pago seguro con Stripe: tarjeta, Apple Pay o Google Pay.",
    verifying: "Confirmando tu pago…", paidOk: "¡Pago recibido! Tu fecha queda reservada.", payCancelled: "No se completó el pago. Puedes intentarlo de nuevo cuando quieras.",
    payPending: "Tu pago se está procesando. Te avisaremos por correo cuando se confirme.",
    depositPaid: "Anticipo pagado", paid: "Pagado", balance: "Saldo pendiente", balanceNote: "El saldo se paga al recibir tu pastel.",
    testMode: "Modo de prueba: usa la tarjeta 4242 4242 4242 4242, cualquier fecha futura y cualquier CVC.",
    progress: "Tu pedido está en marcha", cancelled: "Este pedido fue cancelado. Si tienes dudas, escríbenos.",
    help: "¿Preguntas? WhatsApp +1 (409) 332-5768",
    status: { confirmado: "Confirmado", en_preparacion: "En preparación", listo: "Listo", en_entrega: "En entrega", completado: "Completado" },
  },
  en: {
    title: "Your order", loading: "Loading your order…", when: "Delivery", mode: "Method", address: "Address",
    cake: "Cake", cakeOptions: "Customization", notes: "Notes", subtotal: "Subtotal",
    thanks: "Thank you! We received your order and it's confirmed. We emailed you the confirmation.",
    size: "Size", flavor: "Flavor / filling", design: "Design", deco: "Decoration",
    reviewing: "Karla is reviewing your order. We'll email you the final price for your approval.",
    reviewingSimple: "Karla is reviewing your order and will confirm it by email.",
    pendingItems: "To be confirmed", estimate: "Estimated subtotal",
    priceReady: "Karla confirmed the price of your order. If you agree, please confirm:",
    total: "Total", deposit: "Deposit (50%)", confirm: "Confirm my order", confirming: "Confirming…",
    confirmNote: "Confirming reserves your date. The next step is paying the deposit.",
    confirmed: "Your order is confirmed!", nextStep: "Next step: deposit payment of",
    payNote: "Karla will contact you with payment options.",
    payBtn: "Pay deposit", paying: "Opening payment…", paySecure: "Secure payment with Stripe: card, Apple Pay or Google Pay.",
    verifying: "Confirming your payment…", paidOk: "Payment received! Your date is reserved.", payCancelled: "The payment wasn't completed. You can try again anytime.",
    payPending: "Your payment is processing. We'll email you once it's confirmed.",
    depositPaid: "Deposit paid", paid: "Paid", balance: "Balance due", balanceNote: "The balance is paid when you receive your cake.",
    testMode: "Test mode: use card 4242 4242 4242 4242, any future date and any CVC.",
    progress: "Your order is in progress", cancelled: "This order was cancelled. If you have questions, contact us.",
    help: "Questions? WhatsApp +1 (409) 332-5768",
    status: { confirmado: "Confirmed", en_preparacion: "Being prepared", listo: "Ready", en_entrega: "Out for delivery", completado: "Completed" },
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

// Página del cliente: estado de su pedido y botón para aprobar el precio final.
export default function CustomerOrder({ id, token, paidSession = "", cancelled = false, fresh = false }) {
  const [o, setO] = useState(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [paying, setPaying] = useState(false);
  // "", "verifying", "ok", "pending", "cancelled"
  const [payMsg, setPayMsg] = useState(paidSession ? "verifying" : cancelled ? "cancelled" : "");

  async function load() {
    const r = await fetch(`/api/confirmar/cliente/${id}?t=${encodeURIComponent(token)}`, { cache: "no-store" });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || "Error");
    setO(j);
    if (j.lang === "en") document.documentElement.lang = "en";
    return j;
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
        if (paidSession || cancelled || fresh) {
          const url = new URL(window.location.href);
          url.searchParams.delete("pagado");
          url.searchParams.delete("cancelado");
          url.searchParams.delete("nuevo");
          window.history.replaceState(null, "", url.toString());
        }
        if (alive) await load();
      } catch (e) {
        if (alive) setError(e.message);
      }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, token]);

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

  const lang = o?.lang === "en" ? "en" : "es";
  const t = TXT[lang];

  async function confirm() {
    setSaving(true);
    setError("");
    try {
      const r = await fetch(`/api/confirmar/cliente/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ t: token }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || "Error");
      setO((prev) => ({ ...prev, ...j }));
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  if (error && !o) return <main id="contenido" className="wrap narrow"><div className="card"><Logo /><p className="alert" role="alert">{error}</p></div></main>;
  if (!o) return <main id="contenido" className="wrap narrow"><p className="note" role="status">{payMsg === "verifying" ? TXT.es.verifying : TXT.es.loading}</p></main>;

  const awaitingMe = o.status === "nuevo" && o.price_confirmed && !o.customer_confirmed;
  const depositPaid = o.deposit != null && o.deposit_due === 0;
  const balance = Math.max(0, Number(o.final_total || 0) - Number(o.paid_amount || 0));

  const payment = (
    <div className="pay-box">
      {payMsg === "ok" && <p className="ok" role="status">{t.paidOk}</p>}
      {payMsg === "pending" && <p className="note" role="status">{t.payPending}</p>}
      {payMsg === "cancelled" && !depositPaid && <p className="note" role="status">{t.payCancelled}</p>}
      {depositPaid ? (
        <>
          <p><strong>✓ {t.depositPaid}</strong> · {t.paid}: {money(o.paid_amount)}</p>
          {balance > 0 && <p className="note">{t.balance}: <strong>{money(balance)}</strong>. {t.balanceNote}</p>}
        </>
      ) : o.can_pay ? (
        <>
          {Number(o.paid_amount) > 0 && <p className="note">{t.paid}: {money(o.paid_amount)}</p>}
          {error && <p className="alert" role="alert">{error}</p>}
          <button className="btn wide" onClick={pay} disabled={paying}>
            {paying ? t.paying : `${t.payBtn} ${money(o.deposit_due)}`}
          </button>
          <p className="note">🔒 {t.paySecure}</p>
          {o.test_mode && <p className="note" style={{ color: "#7a4d00" }}>{t.testMode}</p>}
        </>
      ) : (
        <>
          <p>{t.nextStep} <strong>{money(o.deposit)}</strong>.</p>
          <p className="note">{t.payNote}</p>
        </>
      )}
    </div>
  );

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
          {o.cake_name && <div><dt>{t.cake}</dt><dd>{o.cake_name}{o.cake_details ? ` · ${o.cake_details}` : ""}</dd></div>}
          {o.cake_options && <div><dt>{t.cakeOptions}</dt><dd>{o.cake_options}</dd></div>}
          {o.notes && <div><dt>{t.notes}</dt><dd>{o.notes}</dd></div>}
          {o.size_label && <div><dt>{t.size}</dt><dd>{o.size_label}</dd></div>}
          {(o.cake_flavor || o.filling_flavor) && <div><dt>{t.flavor}</dt><dd>{[o.cake_flavor, o.filling_flavor].filter(Boolean).join(" · ")}</dd></div>}
          {o.design_label && <div><dt>{t.design}</dt><dd>{o.design_label}</dd></div>}
          {o.decoration_label && <div><dt>{t.deco}</dt><dd>{o.decoration_label}</dd></div>}
        </dl>

        <div style={{ marginTop: 16 }}>
          {o.status === "cancelado" ? (
            <p className="alert">{t.cancelled}</p>
          ) : o.status === "nuevo" && !o.price_confirmed ? (
            <>
              <p>{o.price_pending ? t.reviewing : t.reviewingSimple}</p>
              <p className="note">{t.estimate}: <strong>{money(o.estimate)}</strong>{o.price_pending ? ` · ${t.pendingItems}: ${o.pending_items}` : ""}</p>
            </>
          ) : awaitingMe ? (
            <>
              <p>{t.priceReady}</p>
              {o.price_pending && o.final_total >= o.estimate && (
                <dl className="summary compact">
                  <div><dt>{t.subtotal}</dt><dd>{money(o.estimate)}</dd></div>
                  <div><dt>{o.pending_items}</dt><dd>+ {money(o.final_total - o.estimate)}</dd></div>
                </dl>
              )}
              <p className="total">{t.total}: {money(o.final_total)}</p>
              <p>{t.deposit}: <strong>{money(o.deposit)}</strong></p>
              {error && <p className="alert" role="alert">{error}</p>}
              <button className="btn wide" onClick={confirm} disabled={saving}>{saving ? t.confirming : t.confirm}</button>
              <p className="note">{t.confirmNote}</p>
            </>
          ) : (
            <>
              <p className="ok" role={fresh ? "status" : undefined}>{o.status === "confirmado" ? (fresh && !payMsg ? t.thanks : t.confirmed) : `${t.progress}: ${t.status[o.status] || o.status}`}</p>
              <p className="total">{t.total}: {money(o.final_total)}</p>
              {o.status === "completado" ? null : o.deposit != null && payment}
            </>
          )}
        </div>
        <p className="note" style={{ marginTop: 16 }}>{t.help}</p>
      </div>
    </main>
  );
}
