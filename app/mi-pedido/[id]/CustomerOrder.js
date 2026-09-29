"use client";
import { useEffect, useState } from "react";
import Logo from "@/components/Logo";

const money = (n) => "$" + Number(n || 0).toFixed(2);

const TXT = {
  es: {
    title: "Tu pedido", loading: "Cargando tu pedido…", when: "Entrega", mode: "Modalidad", address: "Dirección",
    size: "Tamaño", flavor: "Sabor / relleno", design: "Diseño", deco: "Decoración",
    reviewing: "Karla está revisando tu pedido. Te enviaremos el precio final por correo para que lo apruebes.",
    reviewingSimple: "Karla está revisando tu pedido y te lo confirmará por correo.",
    pendingItems: "Por confirmar", estimate: "Subtotal estimado",
    priceReady: "Karla confirmó el precio de tu pedido. Si estás de acuerdo, confírmalo:",
    total: "Total", deposit: "Anticipo (50 %)", confirm: "Confirmar mi pedido", confirming: "Confirmando…",
    confirmNote: "Al confirmar reservamos tu fecha. El siguiente paso es el pago del anticipo.",
    confirmed: "¡Tu pedido está confirmado!", nextStep: "Siguiente paso: pago del anticipo de",
    payNote: "Karla te contactará con las opciones de pago. Pronto podrás pagar en línea desde aquí.",
    progress: "Tu pedido está en marcha", cancelled: "Este pedido fue cancelado. Si tienes dudas, escríbenos.",
    help: "¿Preguntas? WhatsApp +1 (409) 332-5768",
    status: { confirmado: "Confirmado", en_preparacion: "En preparación", listo: "Listo", en_entrega: "En entrega", completado: "Completado" },
  },
  en: {
    title: "Your order", loading: "Loading your order…", when: "Delivery", mode: "Method", address: "Address",
    size: "Size", flavor: "Flavor / filling", design: "Design", deco: "Decoration",
    reviewing: "Karla is reviewing your order. We'll email you the final price for your approval.",
    reviewingSimple: "Karla is reviewing your order and will confirm it by email.",
    pendingItems: "To be confirmed", estimate: "Estimated subtotal",
    priceReady: "Karla confirmed the price of your order. If you agree, please confirm:",
    total: "Total", deposit: "Deposit (50%)", confirm: "Confirm my order", confirming: "Confirming…",
    confirmNote: "Confirming reserves your date. The next step is paying the deposit.",
    confirmed: "Your order is confirmed!", nextStep: "Next step: deposit payment of",
    payNote: "Karla will contact you with payment options. Online payment is coming soon.",
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
export default function CustomerOrder({ id, token }) {
  const [o, setO] = useState(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`/api/confirmar/cliente/${id}?t=${encodeURIComponent(token)}`, { cache: "no-store" })
      .then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.error || "Error");
        setO(j);
        if (j.lang === "en") document.documentElement.lang = "en";
      })
      .catch((e) => setError(e.message));
  }, [id, token]);

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
  if (!o) return <main id="contenido" className="wrap narrow"><p className="note" role="status">{TXT.es.loading}</p></main>;

  const awaitingMe = o.status === "nuevo" && o.price_confirmed && !o.customer_confirmed;
  const inProgress = !["nuevo", "cancelado"].includes(o.status);

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
              <p className="total">{t.total}: {money(o.final_total)}</p>
              <p>{t.deposit}: <strong>{money(o.deposit)}</strong></p>
              {error && <p className="alert" role="alert">{error}</p>}
              <button className="btn wide" onClick={confirm} disabled={saving}>{saving ? t.confirming : t.confirm}</button>
              <p className="note">{t.confirmNote}</p>
            </>
          ) : (
            <>
              <p className="ok">{o.status === "confirmado" ? t.confirmed : `${t.progress}: ${t.status[o.status] || o.status}`}</p>
              <p className="total">{t.total}: {money(o.final_total)}</p>
              {o.status === "confirmado" && (
                <>
                  <p>{t.nextStep} <strong>{money(o.deposit)}</strong>.</p>
                  <p className="note">{t.payNote}</p>
                </>
              )}
              {inProgress && o.status !== "confirmado" && <p className="note">{t.deposit}: {money(o.deposit)}</p>}
            </>
          )}
        </div>
        <p className="note" style={{ marginTop: 16 }}>{t.help}</p>
      </div>
    </main>
  );
}
