"use client";
import { useEffect, useState } from "react";
import Logo from "@/components/Logo";

const money = (n) => "$" + Number(n || 0).toFixed(2);
const deposit = (n) => (Number(n) > 0 ? Math.ceil(Number(n) / 2 / 5) * 5 : 0);

function fmtDate(v) {
  if (!v) return "—";
  const [y, m, d] = String(v).slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("es-US", { weekday: "long", day: "numeric", month: "long" });
}
function fmtTime(v) {
  if (!v) return "";
  const [h, m] = v.split(":").map(Number);
  return new Date(2000, 0, 1, h, m).toLocaleTimeString("es-US", { hour: "numeric", minute: "2-digit" });
}

// Página que abre Karla desde el botón "Confirmar pedido" del correo.
export default function KarlaConfirm({ id, token }) {
  const [o, setO] = useState(null);
  const [error, setError] = useState("");
  const [price, setPrice] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(null);

  useEffect(() => {
    fetch(`/api/confirmar/karla/${id}?t=${encodeURIComponent(token)}`, { cache: "no-store" })
      .then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.error || "No se pudo abrir el pedido");
        setO(j);
        setPrice(j.price_pending ? "" : Number(j.total).toFixed(2));
      })
      .catch((e) => setError(e.message));
  }, [id, token]);

  async function confirm(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const r = await fetch(`/api/confirmar/karla/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ t: token, finalTotal: price }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || "No se pudo confirmar");
      setDone(j);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (error && !o) {
    return <main id="contenido" className="wrap narrow"><div className="card"><Logo /><p className="alert" role="alert">{error}</p></div></main>;
  }
  if (!o) return <main id="contenido" className="wrap narrow"><p className="note" role="status">Cargando pedido…</p></main>;

  const waitingCustomer = o.status === "nuevo" && o.price_confirmed_at && !o.customer_confirmed_at;
  const canConfirm = o.status === "nuevo" && !o.price_confirmed_at;
  const photoUrl = (pid) => `/api/orders/${id}/photos/${pid}?t=${encodeURIComponent(token)}`;

  return (
    <main id="contenido" className="wrap narrow">
      <div className="card">
        <Logo />
        <p className="note" style={{ marginBottom: 0 }}>Confirmar pedido</p>
        <h1 className="h2">{o.order_number} · {o.customer_name}</h1>

        <dl className="summary compact">
          <div><dt>Entrega</dt><dd>{fmtDate(o.delivery_date)} · {fmtTime(o.delivery_time)}</dd></div>
          <div><dt>Modalidad</dt><dd>{o.delivery_type || "—"}</dd></div>
          {o.delivery_address && <div><dt>Dirección</dt><dd>{o.delivery_address}</dd></div>}
          <div><dt>Teléfono</dt><dd><a href={`tel:${o.phone}`}>{o.phone}</a></dd></div>
          <div><dt>Tamaño</dt><dd>{o.size_label || "—"}</dd></div>
          <div><dt>Sabor / relleno</dt><dd>{[o.cake_flavor, o.filling_flavor].filter(Boolean).join(" · ") || "—"}</dd></div>
          <div><dt>Diseño</dt><dd>{o.design_label || "—"}</dd></div>
          {o.design_notes && <div><dt>Descripción</dt><dd>{o.design_notes}</dd></div>}
          {o.decoration_label && <div><dt>Decoración</dt><dd>{o.decoration_label}</dd></div>}
          {o.decoration_notes && <div><dt>Detalle decoración</dt><dd>{o.decoration_notes}</dd></div>}
        </dl>

        {(o.has_design_image || (o.photo_ids || []).length > 0) && (
          <div className="photo-strip">
            {o.has_design_image && (
              <a href={`/api/orders/${id}/image?kind=design&t=${encodeURIComponent(token)}`} target="_blank" rel="noreferrer">
                <img src={`/api/orders/${id}/image?kind=design&t=${encodeURIComponent(token)}`} alt="Foto de referencia del diseño" />
              </a>
            )}
            {(o.photo_ids || []).map((pid, i) => (
              <a key={pid} href={photoUrl(pid)} target="_blank" rel="noreferrer">
                <img src={photoUrl(pid)} alt={`Foto de decoración ${i + 1}`} />
              </a>
            ))}
          </div>
        )}

        {done ? (
          <div className="ok" role="status" style={{ marginTop: 16 }}>
            {done.needsCustomer
              ? <>Listo. Le enviamos a {o.customer_name} el precio de <strong>{money(done.finalTotal)}</strong> (anticipo {money(done.deposit)}). Cuando lo apruebe te llega un aviso y el pedido pasa a CONFIRMADO.</>
              : <>Pedido <strong>CONFIRMADO</strong>. Le enviamos la confirmación a {o.customer_name} con el anticipo de {money(done.deposit)}.</>}
          </div>
        ) : canConfirm ? (
          <form onSubmit={confirm} style={{ marginTop: 16 }}>
            {o.price_pending && (
              <p className="alert" style={{ background: "#fdf1dc", color: "#7a4d00" }}>
                Precio por confirmar: <strong>{o.pending_items}</strong>. El subtotal sin eso es {money(o.total)}; suma lo que corresponda.
              </p>
            )}
            <label htmlFor="final-price">Precio final del pedido (USD)</label>
            <input id="final-price" type="number" min="1" step="0.01" inputMode="decimal" required autoFocus
              value={price} onChange={(e) => setPrice(e.target.value)} />
            <p className="hint">Anticipo que se le pedirá al cliente (50 %, redondeado a 5): <strong>{money(deposit(price))}</strong></p>
            {error && <p className="alert" role="alert">{error}</p>}
            <button className="btn wide" disabled={saving || !price} style={{ marginTop: 10 }}>
              {saving ? "Confirmando…" : "Confirmar pedido"}
            </button>
            <p className="note">
              {o.price_pending || Number(price) !== Number(o.total)
                ? "Al confirmar, al cliente le llega el precio para que lo apruebe."
                : "Al confirmar, el pedido queda CONFIRMADO y al cliente le llega el aviso."}
            </p>
          </form>
        ) : waitingCustomer ? (
          <p className="ok" style={{ marginTop: 16 }}>Ya confirmaste el precio ({money(o.final_total)}). Esperando que el cliente lo apruebe.</p>
        ) : (
          <p className="ok" style={{ marginTop: 16 }}>
            Este pedido ya está {o.status === "cancelado" ? "CANCELADO" : "CONFIRMADO"}{o.final_total ? ` · ${money(o.final_total)}` : ""}.
          </p>
        )}
        <p style={{ marginTop: 16 }}><a href="/admin">Abrir el panel</a></p>
      </div>
    </main>
  );
}
