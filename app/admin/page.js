"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Logo from "@/components/Logo";
import { fileToDataUrl } from "@/lib/image";
import { isShipping } from "@/lib/validate";

const CAT = [
  ["size", "Tamaño"],
  ["cake_flavor", "Sabor del pastel"],
  ["filling", "Sabor del relleno"],
  ["filling_count", "Cantidad de rellenos"],
  ["delivery", "Envío / recogida"],
  ["decoration", "Decoración"],
];
// Flujo: En revisión → Aceptada (falta anticipo) → Confirmada (anticipo pagado) → Completada (lista) → Entregada.
const STATUS = [
  ["nuevo", "En revisión"],
  ["aceptado", "Aceptada"],
  ["confirmado", "Confirmada"],
  ["completado", "Completada"],
  ["entregado", "Entregada"],
  ["cancelado", "Cancelada"],
];
const STATUS_LABEL = Object.fromEntries(STATUS);
const METHODS = [
  ["efectivo", "Efectivo"],
  ["zelle", "Zelle"],
  ["cashapp", "Cash App"],
  ["venmo", "Venmo"],
  ["tarjeta", "Tarjeta"],
  ["paypal", "PayPal"],
  ["transferencia", "Transferencia"],
  ["otro", "Otro"],
];
const METHOD_LABEL = Object.fromEntries(METHODS);
const FILTERS = [
  ["pendientes", "Por entregar"],
  ["nuevos", "Por aceptar"],
  ["por_cobrar", "Por cobrar"],
  ["entregados", "Entregadas"],
  ["cancelados", "Cancelados"],
  ["todos", "Todos"],
];

const emptyOpt = { id: null, category: "size", label: "", description: "", price: 0, image_url: "", active: true, price_on_request: false };
const emptyDesign = { id: null, label: "", image_url: "", price: 0, active: true };
const emptyCake = { id: null, name: "", price: "", portions: "", size: "", frosting: "", description: "", optionsText: "", image_url: "", active: true };
// Personalizaciones: una por línea, "Color: Rosa, Azul, Blanco".
function parseOptions(text) {
  return String(text || "").split("\n").map((line) => {
    const i = line.indexOf(":");
    if (i < 0) return null;
    const name = line.slice(0, i).trim();
    const choices = line.slice(i + 1).split(",").map((x) => x.trim()).filter(Boolean);
    return name && choices.length ? { name, choices } : null;
  }).filter(Boolean);
}
const optionsToText = (o) => (o || []).map((g) => `${g.name}: ${g.choices.join(", ")}`).join("\n");
const money = (n) => "$" + Number(n || 0).toFixed(2);

function localToday() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function fmtDate(v, opts = { weekday: "short", day: "numeric", month: "short" }) {
  if (!v) return "—";
  const [y, m, d] = String(v).slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("es-US", opts);
}

function fmtTime(v) {
  if (!v) return "";
  const [h, m] = v.split(":").map(Number);
  return new Date(2000, 0, 1, h, m).toLocaleTimeString("es-US", { hour: "numeric", minute: "2-digit" });
}

function payInfo(o) {
  const due = Number(o.final_total ?? o.total ?? 0);
  const paid = Number(o.paid_amount || 0);
  const balance = Math.max(0, Math.round((due - paid) * 100) / 100);
  const state = paid <= 0 ? "sin_pagar" : balance > 0 ? "anticipo" : "pagado";
  const label = { sin_pagar: "Sin pagar", anticipo: "Anticipo", pagado: "Pagado" }[state];
  return { due, paid, balance, state, label };
}

async function api(url, opts = {}) {
  const res = await fetch(url, {
    ...opts,
    headers: opts.body ? { "Content-Type": "application/json" } : undefined,
    credentials: "same-origin",
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(json.error || "Algo salió mal. Intenta de nuevo.");
    err.status = res.status;
    throw err;
  }
  return json;
}

export default function AdminPage() {
  const [authed, setAuthed] = useState(null); // null = verificando
  const [key, setKey] = useState("");
  const [data, setData] = useState(null);
  const [orders, setOrders] = useState([]);
  const [tab, setTab] = useState("pedidos");
  const [focusId, setFocusId] = useState(null); // pedido a abrir desde la agenda
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  const flash = useCallback((text, kind = "ok") => {
    setMsg({ text, kind, at: Date.now() });
  }, []);
  useEffect(() => {
    if (msg?.kind !== "ok") return;
    const t = setTimeout(() => setMsg(null), Math.min(8000, 2500 + msg.text.length * 35));
    return () => clearTimeout(t);
  }, [msg]);

  const onAuthError = useCallback((err) => {
    if (err.status === 401) { setAuthed(false); flash("Tu sesión venció. Vuelve a entrar.", "error"); return true; }
    return false;
  }, [flash]);

  const load = useCallback(async () => {
    const [cat, ord] = await Promise.all([api("/api/admin"), api("/api/orders")]);
    setData(cat);
    setOrders(ord.orders || []);
  }, []);

  useEffect(() => {
    api("/api/admin/session")
      .then((s) => {
        setAuthed(!!s.ok);
        if (s.ok) load().catch((e) => onAuthError(e) || flash(e.message, "error"));
      })
      .catch(() => setAuthed(false));
  }, [load, flash, onAuthError]);

  async function login(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await api("/api/admin/session", { method: "POST", body: JSON.stringify({ key }) });
      setKey("");
      setAuthed(true);
      setMsg(null);
      await load();
    } catch (err) {
      flash(err.message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    await api("/api/admin/session", { method: "DELETE" }).catch(() => {});
    setAuthed(false); setData(null); setOrders([]);
  }

  async function refresh() {
    try { await load(); flash("Actualizado"); } catch (e) { onAuthError(e) || flash(e.message, "error"); }
  }

  if (authed === null) {
    return <main id="contenido" className="wrap narrow"><p className="note" role="status">Cargando…</p></main>;
  }

  if (!authed) {
    return (
      <main id="contenido" className="wrap narrow">
        <form className="card" onSubmit={login}>
          <Logo />
          <h1 className="h2">Panel de administración</h1>
          <p className="note">Acceso solo para el equipo de Karla&apos;s Bake.</p>
          <label htmlFor="admin-key">Clave</label>
          <input id="admin-key" type="password" autoComplete="current-password" autoFocus value={key} onChange={(e) => setKey(e.target.value)} />
          <button className="btn wide" style={{ marginTop: 14 }} disabled={busy || !key}>{busy ? "Entrando…" : "Entrar"}</button>
          {msg && <p className={msg.kind === "error" ? "alert" : "ok"} role="alert">{msg.text}</p>}
        </form>
      </main>
    );
  }

  return (
    <main id="contenido" className="wrap admin">
      <div className="admin-bar card">
        <Logo size={44} />
        <div className="tabs" role="tablist" aria-label="Secciones del panel">
          {[["pedidos", `Pedidos (${orders.length})`], ["agenda", "Agenda"], ["pasteles", "Pasteles"], ["catalogo", "Opciones y envío"], ["disenos", "Diseños"], ["web", "Personalizar sitio"]].map(([id, name]) => (
            <button key={id} role="tab" id={"tab-" + id} aria-controls={"panel-" + id} aria-selected={tab === id}
              className={tab === id ? "on" : ""} onClick={() => setTab(id)}>{name}</button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn ghost small" onClick={refresh}>Actualizar</button>
          <button className="btn ghost small" onClick={logout}>Salir</button>
        </div>
      </div>
      <div aria-live="polite">
        {msg && <p className={"toast " + (msg.kind === "error" ? "alert" : "ok")} role={msg.kind === "error" ? "alert" : "status"}>{msg.text}</p>}
      </div>

      <section role="tabpanel" id={"panel-" + tab} aria-labelledby={"tab-" + tab}>
        {tab === "pedidos" && <Orders orders={orders} setOrders={setOrders} flash={flash} onAuthError={onAuthError} focusId={focusId} onFocused={() => setFocusId(null)} />}
        {tab === "agenda" && <Agenda orders={orders} onOpen={(id) => { setFocusId(id); setTab("pedidos"); }} />}
        {tab === "pasteles" && <Cakes data={data} load={load} flash={flash} onAuthError={onAuthError} />}
        {tab === "web" && <SiteEditor data={data} load={load} flash={flash} onAuthError={onAuthError} />}
        {tab === "catalogo" && <Catalog data={data} load={load} flash={flash} onAuthError={onAuthError} />}
        {tab === "disenos" && <Designs data={data} load={load} flash={flash} onAuthError={onAuthError} />}
      </section>
    </main>
  );
}

/* ================= Pedidos ================= */

function Orders({ orders, setOrders, flash, onAuthError, focusId, onFocused }) {
  const [filter, setFilter] = useState("pendientes");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(null);

  // Abierto desde la agenda: se muestra el pedido con su detalle.
  useEffect(() => {
    if (!focusId) return;
    setFilter("todos");
    setQ("");
    setOpen(focusId);
    onFocused?.();
    setTimeout(() => document.getElementById(`order-${focusId}`)?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  }, [focusId, onFocused]);

  const today = localToday();
  const month = today.slice(0, 7);
  const active = (o) => o.status !== "entregado" && o.status !== "cancelado";

  const stats = useMemo(() => {
    const pending = orders.filter(active);
    const soon = pending.filter((o) => o.delivery_date && o.delivery_date <= addDays(today, 1));
    const receivable = orders.filter((o) => o.status !== "cancelado").reduce((s, o) => s + payInfo(o).balance, 0);
    const collected = orders.filter((o) => (o.paid_at || "").startsWith(month)).reduce((s, o) => s + Number(o.paid_amount || 0), 0);
    return { pending: pending.length, soon: soon.length, receivable, collected };
  }, [orders, today, month]);

  const list = useMemo(() => {
    const term = q.trim().toLowerCase();
    let l = orders.filter((o) => {
      if (filter === "pendientes") return active(o);
      if (filter === "por_cobrar") return o.status !== "cancelado" && payInfo(o).balance > 0;
      if (filter === "entregados") return o.status === "entregado";
      if (filter === "nuevos") return o.status === "nuevo";
      if (filter === "cancelados") return o.status === "cancelado";
      return true;
    });
    if (term) {
      l = l.filter((o) => [o.order_number, o.customer_name, o.phone, o.email].some((v) => String(v || "").toLowerCase().includes(term)));
    }
    const byDelivery = (a, b) => String(a.delivery_date).localeCompare(String(b.delivery_date)) || String(a.delivery_time).localeCompare(String(b.delivery_time));
    return filter === "pendientes" || filter === "por_cobrar" ? [...l].sort(byDelivery) : l;
  }, [orders, filter, q]);

  function patchLocal(id, fields) {
    setOrders((os) => os.map((o) => (o.id === id ? { ...o, ...fields } : o)));
  }

  async function changeStatus(o, status) {
    const prev = o.status;
    patchLocal(o.id, { status });
    try {
      const r = await api(`/api/orders/${o.id}`, { method: "PATCH", body: JSON.stringify({ status }) });
      if (r.order) patchLocal(o.id, r.order);
      flash(`${o.order_number}: ${STATUS_LABEL[status]}.${r.note ? " " + r.note : ""}`);
    } catch (e) {
      patchLocal(o.id, { status: prev });
      onAuthError(e) || flash(e.message, "error");
    }
  }

  return (
    <div className="card" style={{ marginTop: 16 }}>
      <div className="stats">
        <div><span>{stats.pending}</span>por entregar</div>
        <div><span>{stats.soon}</span>para hoy o mañana</div>
        <div><span>{money(stats.receivable)}</span>por cobrar</div>
        <div><span>{money(stats.collected)}</span>cobrado este mes</div>
      </div>

      <div className="order-tools">
        <div className="chips" role="group" aria-label="Filtrar pedidos">
          {FILTERS.map(([id, name]) => (
            <button key={id} className={"chip" + (filter === id ? " on" : "")} aria-pressed={filter === id} onClick={() => setFilter(id)}>{name}</button>
          ))}
        </div>
        <input type="search" className="search" placeholder="Buscar por nombre, teléfono o #" aria-label="Buscar pedidos" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      {list.length === 0 ? (
        <p className="note" style={{ padding: "20px 0" }}>No hay pedidos en esta vista.</p>
      ) : (
        <ul className="order-list">
          {list.map((o) => (
            <OrderCard key={o.id} o={o} open={open === o.id} today={today}
              onToggle={() => setOpen(open === o.id ? null : o.id)}
              onStatus={(s) => changeStatus(o, s)}
              onSaved={(fields) => patchLocal(o.id, fields)}
              flash={flash} onAuthError={onAuthError} />
          ))}
        </ul>
      )}
    </div>
  );
}

function addDays(iso, n) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d + n);
  const p = (x) => String(x).padStart(2, "0");
  return `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())}`;
}

function OrderCard({ o, open, today, onToggle, onStatus, onSaved, flash, onAuthError }) {
  const pay = payInfo(o);
  const late = o.delivery_date && o.delivery_date < today && o.status !== "entregado" && o.status !== "cancelado";
  const needsKarla = o.status === "nuevo";
  const waitingCustomer = o.status === "aceptado";
  const isToday = o.delivery_date === today;
  const detailId = `order-detail-${o.id}`;
  return (
    <li id={`order-${o.id}`} className={"order-card status-" + o.status}>
      <div className="order-top">
        <div>
          <strong className="order-no">{o.order_number}</strong>
          <span className={"when" + (late ? " late" : isToday ? " today" : "")}>
            {late ? "Atrasado · " : isToday ? "Hoy · " : ""}{fmtDate(o.delivery_date)} {fmtTime(o.delivery_time)}
          </span>
        </div>
        <label className="status-select">
          <span className="sr-only">Estado del pedido {o.order_number}</span>
          <select value={o.status || "nuevo"} onChange={(e) => onStatus(e.target.value)} className={"st-" + (o.status || "nuevo")}>
            {STATUS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
      </div>
      <div className="order-mid">
        <div>
          <div className="order-customer">{o.customer_name}</div>
          <div className="note">{(o.cake_name ? [o.cake_name, o.cake_options] : [o.size_label, o.cake_flavor, o.filling_flavor]).filter(Boolean).join(" · ") || "—"}</div>
          {needsKarla && <span className="status-flag">{o.price_pending ? `Por aceptar · costo por confirmar: ${o.pending_items}` : "Por aceptar"}</span>}
          {waitingCustomer && <span className="status-flag wait">Esperando el anticipo de {money(o.deposit_amount)}</span>}
        </div>
        <div className="order-money">
          <strong>{money(pay.due)}</strong>
          <span className={"pay-badge pay-" + pay.state}>{pay.label}{pay.state === "anticipo" ? ` · debe ${money(pay.balance)}` : ""}</span>
        </div>
      </div>
      <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
        <button className="link order-toggle" aria-expanded={open} aria-controls={detailId} onClick={onToggle}>
          {open ? "Ocultar detalle" : "Ver detalle y cobro"}
        </button>
        {needsKarla && o.karla_path && (
          <a className="btn small" href={o.karla_path} target="_blank" rel="noreferrer">
            {o.price_pending ? "Revisar, poner costo y aceptar" : "Revisar y aceptar"}
          </a>
        )}
      </div>
      {open && (
        <div id={detailId} className="order-detail">
          <div className="detail-grid">
            <dl className="summary compact">
              <div><dt>Teléfono</dt><dd><a href={`tel:${o.phone}`}>{o.phone || "—"}</a></dd></div>
              <div><dt>Correo</dt><dd><a href={`mailto:${o.email}`}>{o.email || "—"}</a></dd></div>
              <div><dt>SMS promociones</dt><dd>{o.sms_opt_in ? "Sí" : "No"}</dd></div>
              <div><dt>Modalidad</dt><dd>{o.delivery_type || "—"}</dd></div>
              <div><dt>Dirección</dt><dd>{o.delivery_address || "—"}</dd></div>
              {o.cake_name ? (
                <>
                  <div><dt>Pastel</dt><dd>{o.cake_name}</dd></div>
                  {o.cake_details && <div><dt>Detalles</dt><dd>{o.cake_details}</dd></div>}
                  {o.cake_options && <div><dt>Personalización</dt><dd>{o.cake_options}</dd></div>}
                  <div><dt>Notas del cliente</dt><dd>{o.design_notes || "—"}</dd></div>
                </>
              ) : (
                <>
                  <div><dt>Rellenos</dt><dd>{o.filling_count || "—"}</dd></div>
                  <div><dt>Diseño</dt><dd>{o.design_label || "—"}</dd></div>
                  <div><dt>Descripción</dt><dd>{o.design_notes || "—"}</dd></div>
                </>
              )}
              {o.decoration_label && <div><dt>Decoración</dt><dd>{o.decoration_label}</dd></div>}
              {o.decoration_notes && <div><dt>Detalle decoración</dt><dd>{o.decoration_notes}</dd></div>}
              {o.deposit_amount != null && <div><dt>Anticipo acordado</dt><dd>{money(o.deposit_amount)}</dd></div>}
              <div><dt>Pedido el</dt><dd>{new Date(o.ordered_at).toLocaleString("es-US", { dateStyle: "medium", timeStyle: "short" })}</dd></div>
            </dl>
            {o.has_design_image && (
              <a href={`/api/orders/${o.id}/image?kind=design`} target="_blank" rel="noreferrer" className="ref-photo">
                <img className="thumb-img" src={`/api/orders/${o.id}/image?kind=design&v=${o.img_version || ""}`} alt={`Foto de referencia del pedido ${o.order_number}`} />
                <span className="note">Foto de referencia</span>
              </a>
            )}
          </div>
          {(o.photo_ids || []).length > 0 && (
            <div className="photo-strip" aria-label="Fotos de decoración del cliente">
              {o.photo_ids.map((pid, i) => (
                <a key={pid} href={`/api/orders/${o.id}/photos/${pid}`} target="_blank" rel="noreferrer">
                  <img src={`/api/orders/${o.id}/photos/${pid}`} alt={`Foto de decoración ${i + 1} del pedido ${o.order_number}`} />
                </a>
              ))}
            </div>
          )}
          <PaymentForm o={o} onSaved={onSaved} flash={flash} onAuthError={onAuthError} />
        </div>
      )}
    </li>
  );
}

function PaymentForm({ o, onSaved, flash, onAuthError }) {
  const [f, setF] = useState(() => ({
    finalTotal: o.final_total != null ? String(Number(o.final_total)) : "",
    amount: Number(o.paid_amount || 0) > 0 ? String(Number(o.paid_amount)) : "",
    date: o.paid_at || localToday(),
    method: o.payment_method || "",
    note: o.payment_note || "",
  }));
  const [proof, setProof] = useState(undefined); // undefined = sin cambios · string = nueva · null = quitar
  const [saving, setSaving] = useState(false);
  const set = (patch) => setF((x) => ({ ...x, ...patch }));
  const due = f.finalTotal !== "" ? Number(f.finalTotal) : Number(o.total || 0);
  const balance = Math.max(0, due - Number(f.amount || 0));
  const ids = (s) => `pay-${s}-${o.id}`;

  async function pick(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try { setProof(await fileToDataUrl(file, 1400, 0.8)); } catch { flash("No se pudo leer la foto", "error"); }
  }

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const payment = { ...f, amount: f.amount || 0, method: f.method || null, date: Number(f.amount || 0) > 0 ? f.date : f.date || null };
      if (proof !== undefined) payment.proof = proof;
      const r = await api(`/api/orders/${o.id}`, { method: "PATCH", body: JSON.stringify({ payment }) });
      onSaved({
        final_total: f.finalTotal === "" ? null : Number(f.finalTotal),
        paid_amount: Number(f.amount || 0),
        paid_at: f.date,
        payment_method: f.method || null,
        payment_note: f.note,
        ...(proof !== undefined ? { has_payment_proof: !!proof, img_version: String(Date.now()) } : {}),
        ...(r.order ? { status: r.order.status } : {}),
      });
      setProof(undefined);
      flash(`Cobro de ${o.order_number} guardado.${r.note ? " " + r.note : ""}`);
    } catch (err) {
      onAuthError(err) || flash(err.message, "error");
    } finally {
      setSaving(false);
    }
  }

  const existingProof = o.has_payment_proof && proof === undefined;

  return (
    <form className="pay-form" onSubmit={save}>
      <h3>Cobro</h3>
      <div className="form-grid">
        <div>
          <label htmlFor={ids("final")}>Precio final (USD)</label>
          <input id={ids("final")} type="number" min="0" step="0.01" inputMode="decimal" placeholder={Number(o.total || 0).toFixed(2)}
            value={f.finalTotal} onChange={(e) => set({ finalTotal: e.target.value })} aria-describedby={ids("final-hint")} />
          <span id={ids("final-hint")} className="hint">Déjalo vacío si es igual al estimado ({money(o.total)}).</span>
        </div>
        <div>
          <label htmlFor={ids("amount")}>Monto cobrado (USD)</label>
          <input id={ids("amount")} type="number" min="0" step="0.01" inputMode="decimal" value={f.amount} onChange={(e) => set({ amount: e.target.value })} />
          <button type="button" className="link" onClick={() => set({ amount: due.toFixed(2) })}>Pagó completo ({money(due)})</button>
          <span className="hint">Es el total cobrado hasta hoy (no se suma a lo anterior).
            {Number(o.online_paid) > 0 && <> Ya incluye <strong>{money(o.online_paid)}</strong> pagado en línea con Stripe.</>}
          </span>
        </div>
        <div>
          <label htmlFor={ids("date")}>Fecha de pago</label>
          <input id={ids("date")} type="date" value={f.date} onChange={(e) => set({ date: e.target.value })} />
        </div>
        <div>
          <label htmlFor={ids("method")}>Forma de pago</label>
          <select id={ids("method")} value={f.method} onChange={(e) => set({ method: e.target.value })}>
            <option value="">Elegir…</option>
            {METHODS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <div className="span-2">
          <label htmlFor={ids("note")}>Nota (opcional)</label>
          <input id={ids("note")} value={f.note} maxLength={500} placeholder="Ej.: anticipo 50 %, resto al entregar" onChange={(e) => set({ note: e.target.value })} />
        </div>
        <div className="span-2">
          <label htmlFor={ids("proof")}>Evidencia de pago (foto o captura)</label>
          <input id={ids("proof")} type="file" accept="image/*" onChange={pick} />
          <div className="proof-row">
            {existingProof && (
              <a href={`/api/orders/${o.id}/image?kind=proof`} target="_blank" rel="noreferrer">
                <img className="thumb-img" src={`/api/orders/${o.id}/image?kind=proof&v=${o.img_version || ""}`} alt={`Evidencia de pago del pedido ${o.order_number}`} />
              </a>
            )}
            {typeof proof === "string" && <img className="thumb-img" src={proof} alt="Nueva evidencia de pago (sin guardar)" />}
            {(existingProof || typeof proof === "string") && (
              <button type="button" className="btn ghost small danger" onClick={() => setProof(o.has_payment_proof ? null : undefined)}>Quitar foto</button>
            )}
            {proof === null && <span className="note">La foto se quitará al guardar.</span>}
          </div>
        </div>
      </div>
      <div className="pay-footer">
        <span>Saldo pendiente: <strong className={balance > 0 ? "due" : "paid"}>{money(balance)}</strong>
          {o.payment_method && <span className="note"> · último registro: {METHOD_LABEL[o.payment_method]} {o.paid_at ? fmtDate(o.paid_at, { day: "numeric", month: "short" }) : ""}</span>}
        </span>
        <button className="btn" disabled={saving}>{saving ? "Guardando…" : "Guardar cobro"}</button>
      </div>
    </form>
  );
}

/* ================= Agenda ================= */

const WEEKDAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const isoOf = (y, m, d) => `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

// Anticipo confirmado cuando lo pagado cubre el anticipo acordado.
function depositState(o) {
  const dep = o.deposit_amount != null ? Number(o.deposit_amount) : null;
  return dep != null && dep > 0 && Number(o.paid_amount || 0) >= dep ? "confirmado" : "pendiente";
}

function AgendaItem({ o, onOpen, compact = false }) {
  const dep = depositState(o);
  const ship = isShipping(o.delivery_type);
  return (
    <button type="button" className={"agenda-item st-border-" + o.status + (compact ? " compact" : "")} onClick={() => onOpen(o.id)}
      aria-label={`${fmtTime(o.delivery_time)} ${o.order_number}, ${ship ? "delivery" : "recogida"}, ${STATUS_LABEL[o.status] || o.status}, anticipo ${dep}`}>
      <span className="agenda-time">{fmtTime(o.delivery_time) || "—"}</span>
      <strong className="agenda-no">{o.order_number}</strong>
      <span className="agenda-tags">
        <span className={"tag " + (ship ? "tag-ship" : "tag-pick")}>{ship ? "Delivery" : "Recogida"}</span>
        <span className={"tag st-" + o.status}>{STATUS_LABEL[o.status] || o.status}</span>
        <span className={"tag dep-" + dep}>Anticipo {dep}</span>
      </span>
      {!compact && <span className="agenda-who">{o.customer_name}{o.cake_name ? ` · ${o.cake_name}` : ""}</span>}
    </button>
  );
}

function Agenda({ orders, onOpen }) {
  const today = localToday();
  const [ym, setYm] = useState(() => today.slice(0, 7));
  const [day, setDay] = useState(today);
  const [showCancelled, setShowCancelled] = useState(false);
  const [y, m] = ym.split("-").map(Number);
  const month = m - 1;

  const byDay = useMemo(() => {
    const map = {};
    for (const o of orders) {
      if (!o.delivery_date || (!showCancelled && o.status === "cancelado")) continue;
      (map[o.delivery_date] ||= []).push(o);
    }
    for (const k of Object.keys(map)) map[k].sort((a, b) => String(a.delivery_time).localeCompare(String(b.delivery_time)));
    return map;
  }, [orders, showCancelled]);

  const first = new Date(y, month, 1);
  const lead = (first.getDay() + 6) % 7; // semana empieza en lunes
  const days = new Date(y, month + 1, 0).getDate();
  const cells = [...Array(lead).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  while (cells.length % 7) cells.push(null);

  const move = (n) => {
    const d = new Date(y, month + n, 1);
    setYm(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  };
  const goToday = () => { setYm(today.slice(0, 7)); setDay(today); };
  const cap = (x) => x.charAt(0).toUpperCase() + x.slice(1);
  const title = cap(first.toLocaleDateString("es-US", { month: "long", year: "numeric" }));
  const monthCount = Object.entries(byDay).filter(([k]) => k.startsWith(ym)).reduce((n, [, l]) => n + l.length, 0);
  const dayList = byDay[day] || [];

  return (
    <div className="card agenda" style={{ marginTop: 16 }}>
      <div className="agenda-head">
        <div className="agenda-nav">
          <button className="btn ghost small" onClick={() => move(-1)} aria-label="Mes anterior">‹</button>
          <h2 className="agenda-title">{title}</h2>
          <button className="btn ghost small" onClick={() => move(1)} aria-label="Mes siguiente">›</button>
          <button className="btn ghost small" onClick={goToday}>Hoy</button>
        </div>
        <div className="agenda-tools">
          <span className="note">{monthCount} {monthCount === 1 ? "pedido" : "pedidos"} este mes</span>
          <label className="check-inline">
            <input type="checkbox" checked={showCancelled} onChange={(e) => setShowCancelled(e.target.checked)} /> Mostrar canceladas
          </label>
        </div>
      </div>

      <div className="agenda-legend" aria-hidden="true">
        {STATUS.map(([v, l]) => <span key={v} className={"tag st-" + v}>{l}</span>)}
      </div>

      <div className="agenda-grid" role="grid" aria-label={`Pedidos de ${title}`}>
        {WEEKDAYS.map((w) => <div key={w} className="agenda-wd" role="columnheader">{w}</div>)}
        {cells.map((d, i) => {
          if (!d) return <div key={i} className="agenda-cell empty" />;
          const iso = isoOf(y, month, d);
          const list = byDay[iso] || [];
          const cls = "agenda-cell" + (iso === today ? " today" : "") + (iso === day ? " selected" : "") + (list.length ? " has" : "");
          return (
            <div key={i} className={cls} role="gridcell">
              <button type="button" className="agenda-day" onClick={() => setDay(iso)} aria-pressed={iso === day}
                aria-label={`${fmtDate(iso, { weekday: "long", day: "numeric", month: "long" })}: ${list.length} ${list.length === 1 ? "pedido" : "pedidos"}`}>
                <span>{d}</span>
                {list.length > 0 && <span className="agenda-count">{list.length}</span>}
              </button>
              <div className="agenda-cell-items">
                {list.slice(0, 3).map((o) => <AgendaItem key={o.id} o={o} onOpen={onOpen} compact />)}
                {list.length > 3 && <button type="button" className="link agenda-more" onClick={() => setDay(iso)}>+{list.length - 3} más</button>}
              </div>
            </div>
          );
        })}
      </div>

      <div className="agenda-day-list">
        <h3>{cap(fmtDate(day, { weekday: "long", day: "numeric", month: "long" }))}</h3>
        {dayList.length === 0
          ? <p className="note">No hay pedidos para este día.</p>
          : <div className="agenda-list">{dayList.map((o) => <AgendaItem key={o.id} o={o} onOpen={onOpen} />)}</div>}
      </div>
    </div>
  );
}

/* ================= Catálogo ================= */

function usePoster(load, flash, onAuthError) {
  const [busy, setBusy] = useState(false);
  const post = useCallback(async (body, okText = "Guardado") => {
    setBusy(true);
    try {
      await api("/api/admin", { method: "POST", body: JSON.stringify(body) });
      await load();
      flash(okText);
      return true;
    } catch (err) {
      onAuthError(err) || flash(err.message, "error");
      return false;
    } finally {
      setBusy(false);
    }
  }, [load, flash, onAuthError]);
  return { busy, post };
}

async function pickPhoto(e, apply, flash, max = 900) {
  const file = e.target.files?.[0];
  e.target.value = "";
  if (!file) return;
  try { apply(await fileToDataUrl(file, max)); } catch { flash("No se pudo leer la foto", "error"); }
}

function Catalog({ data, load, flash, onAuthError }) {
  const { busy, post } = usePoster(load, flash, onAuthError);
  const [opt, setOpt] = useState(emptyOpt);
  const grouped = {};
  (data?.options || []).forEach((o) => { (grouped[o.category] = grouped[o.category] || []).push(o); });

  async function saveOption(e) {
    e.preventDefault();
    if (await post(opt, opt.id ? "Opción actualizada" : "Opción agregada")) setOpt(emptyOpt);
  }
  async function removeOption(o) {
    if (confirm(`¿Eliminar "${o.label || "(sin nombre)"}"? Esta acción no se puede deshacer.`)) {
      if (await post({ type: "option_delete", id: o.id }, "Opción eliminada") && opt.id === o.id) setOpt(emptyOpt);
    }
  }

  return (
    <>
      {CAT.map(([cat, name]) => {
        const items = grouped[cat] || [];
        const visible = items.some((o) => o.active !== false);
        return (
          <div className="card" key={cat} style={{ marginTop: 16 }}>
            <div className="section-head">
              <h2 className="h3">{name}</h2>
              <label className="check">
                <input type="checkbox" checked={visible} disabled={busy || !items.length}
                  onChange={(e) => post({ type: "category_active", category: cat, active: e.target.checked }, e.target.checked ? "Paso visible" : "Paso oculto")} />
                Mostrar este paso al cliente
              </label>
            </div>
            <table className="table">
              <caption className="sr-only">Opciones de {name}</caption>
              <thead className="sr-only"><tr><th>Nombre</th><th>Precio</th><th>Estado</th><th>Acciones</th></tr></thead>
              <tbody>
                {items.map((o) => (
                  <tr key={o.id} className={o.active === false ? "muted" : ""}>
                    <td>{o.label || <em className="alert-text">Sin nombre (no se muestra)</em>}</td>
                    <td>{o.price_on_request ? "A confirmar" : money(o.price)}</td>
                    <td>{o.active === false ? "Oculto" : "Visible"}</td>
                    <td><div className="actions">
                      <button className="btn ghost small" type="button" aria-label={`Editar ${o.label}`} onClick={() => { setOpt({ ...emptyOpt, ...o, price: Number(o.price), image_url: o.image_url || "" }); document.getElementById("opt-form")?.scrollIntoView({ behavior: "smooth" }); }}>Editar</button>
                      <button className="btn ghost small danger" type="button" aria-label={`Eliminar ${o.label}`} onClick={() => removeOption(o)}>Eliminar</button>
                    </div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}
      <div className="card" id="opt-form" style={{ marginTop: 16 }}>
        <h2 className="h3">{opt.id ? `Editar: ${opt.label}` : "Nueva opción"}</h2>
        <form onSubmit={saveOption} className="form-grid">
          <div><label htmlFor="o-cat">Categoría</label>
            <select id="o-cat" value={opt.category} onChange={(e) => setOpt({ ...opt, category: e.target.value })}>
              {CAT.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select></div>
          <div><label htmlFor="o-name">Nombre *</label><input id="o-name" required value={opt.label} onChange={(e) => setOpt({ ...opt, label: e.target.value })} /></div>
          <div><label htmlFor="o-desc">Descripción</label><input id="o-desc" value={opt.description || ""} onChange={(e) => setOpt({ ...opt, description: e.target.value })} /></div>
          <div><label htmlFor="o-price">Precio (USD)</label><input id="o-price" type="number" min="0" step="0.01" value={opt.price} onChange={(e) => setOpt({ ...opt, price: e.target.value })} /></div>
          <div><label className="check"><input type="checkbox" checked={opt.active !== false} onChange={(e) => setOpt({ ...opt, active: e.target.checked })} /> Visible para clientes</label></div>
          <div><label className="check"><input type="checkbox" checked={!!opt.price_on_request} onChange={(e) => setOpt({ ...opt, price_on_request: e.target.checked })} /> Precio a confirmar por Karla</label>
            <span className="hint">El cliente ve "Precio a confirmar" y tú pones el precio al confirmar el pedido.</span></div>
          <div><label htmlFor="o-photo">Foto</label><input id="o-photo" type="file" accept="image/*" onChange={(e) => pickPhoto(e, (url) => setOpt((o) => ({ ...o, image_url: url })), flash)} /></div>
          {opt.image_url && <img className="thumb-img" src={opt.image_url} alt="Vista previa de la foto" />}
          <div className="row">
            {opt.id && <button type="button" className="btn ghost" onClick={() => setOpt(emptyOpt)}>Cancelar</button>}
            <button className="btn" disabled={busy}>{opt.id ? "Guardar cambios" : "Agregar opción"}</button>
          </div>
        </form>
      </div>
    </>
  );
}

/* ================= Pasteles del catálogo ================= */

function Cakes({ data, load, flash, onAuthError }) {
  const { busy, post } = usePoster(load, flash, onAuthError);
  const [cake, setCake] = useState(emptyCake);
  const set = (patch) => setCake((c) => ({ ...c, ...patch }));
  const cakes = data?.cakes || [];
  const customOn = data?.settings?.custom_cake !== false;

  async function save(e) {
    e.preventDefault();
    if (!cake.image_url) return flash("Agrega una foto del pastel", "error");
    if (!(Number(cake.price) > 0)) return flash("Escribe el precio del pastel", "error");
    const { optionsText, ...rest } = cake;
    const ok = await post({ ...rest, type: "cake", options: parseOptions(optionsText) }, cake.id ? "Pastel actualizado" : "Pastel agregado");
    if (ok) setCake(emptyCake);
  }
  async function remove(c) {
    if (confirm(`¿Eliminar el pastel "${c.name}"? Los pedidos ya hechos no se borran.`)) {
      if (await post({ type: "cake_delete", id: c.id }, "Pastel eliminado") && cake.id === c.id) setCake(emptyCake);
    }
  }
  function edit(c) {
    setCake({ ...emptyCake, ...c, price: Number(c.price), optionsText: optionsToText(c.options), image_url: c.image_url || "" });
    document.getElementById("cake-form")?.scrollIntoView({ behavior: "smooth" });
  }
  const preview = parseOptions(cake.optionsText);

  return (
    <>
      <div className="card" id="cake-form" style={{ marginTop: 16 }}>
        <h2 className="h3">{cake.id ? `Editar: ${cake.name}` : "Agregar pastel al catálogo"}</h2>
        <p className="note">Estos pasteles son lo primero que ve el cliente al pedir. El precio es fijo; las personalizaciones no tienen costo adicional.</p>
        <form onSubmit={save} className="form-grid">
          <div><label htmlFor="c-name">Nombre *</label><input id="c-name" required maxLength={120} value={cake.name} onChange={(e) => set({ name: e.target.value })} /></div>
          <div><label htmlFor="c-price">Precio (USD) *</label><input id="c-price" type="number" min="1" step="0.01" inputMode="decimal" required value={cake.price} onChange={(e) => set({ price: e.target.value })} /></div>
          <div><label htmlFor="c-portions">Porciones</label><input id="c-portions" maxLength={80} placeholder="Ej.: 15-18 porciones" value={cake.portions} onChange={(e) => set({ portions: e.target.value })} /></div>
          <div><label htmlFor="c-size">Tamaño</label><input id="c-size" maxLength={80} placeholder="Ej.: 8 pulgadas, 2 pisos" value={cake.size} onChange={(e) => set({ size: e.target.value })} /></div>
          <div><label htmlFor="c-frosting">Tipo de merengue / cobertura</label><input id="c-frosting" maxLength={80} placeholder="Ej.: merengue suizo" value={cake.frosting} onChange={(e) => set({ frosting: e.target.value })} /></div>
          <div><label className="check"><input type="checkbox" checked={cake.active !== false} onChange={(e) => set({ active: e.target.checked })} /> Visible para clientes</label></div>
          <div className="span-2"><label htmlFor="c-desc">Descripción</label>
            <textarea id="c-desc" rows={2} maxLength={600} placeholder="Ej.: bizcocho de vainilla con relleno de fresa, decorado con rosetas." value={cake.description} onChange={(e) => set({ description: e.target.value })} /></div>
          <div className="span-2">
            <label htmlFor="c-opts">Personalizaciones sin costo (una por línea)</label>
            <textarea id="c-opts" rows={3} aria-describedby="c-opts-hint" placeholder={"Color: Rosa, Azul, Blanco\nRelleno: Fresa, Chocolate, Dulce de leche"} value={cake.optionsText} onChange={(e) => set({ optionsText: e.target.value })} />
            <span id="c-opts-hint" className="hint">Formato: <strong>Nombre: opción 1, opción 2, opción 3</strong>. El cliente elige una de cada línea.</span>
            {preview.length > 0 && (
              <p className="note" style={{ marginBottom: 0 }}>El cliente verá: {preview.map((g) => `${g.name} (${g.choices.length} opciones)`).join(" · ")}</p>
            )}
          </div>
          <div><label htmlFor="c-photo">Foto *</label><input id="c-photo" type="file" accept="image/*" onChange={(e) => pickPhoto(e, (url) => set({ image_url: url }), flash)} /></div>
          {cake.image_url && <img className="thumb-img" src={cake.image_url} alt="Vista previa del pastel" />}
          <div className="row">
            {cake.id && <button type="button" className="btn ghost" onClick={() => setCake(emptyCake)}>Cancelar</button>}
            <button className="btn" disabled={busy}>{cake.id ? "Guardar cambios" : "Agregar pastel"}</button>
          </div>
        </form>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="section-head">
          <h2 className="h3">Pasteles en el catálogo ({cakes.length})</h2>
          <label className="check">
            <input type="checkbox" checked={customOn} disabled={busy}
              onChange={(e) => post({ type: "setting", key: "custom_cake", value: e.target.checked }, e.target.checked ? "Opción visible" : "Opción oculta")} />
            Ofrecer también “Pastel a tu medida”
          </label>
        </div>
        {cakes.length === 0 ? (
          <p className="note">Todavía no hay pasteles. Mientras tanto, la página de pedido muestra “Pastel a tu medida” (tamaño, sabores y decoración).</p>
        ) : (
          <div className="cake-admin-list">
            {cakes.map((c) => (
              <div className={"opt static" + (c.active === false ? " muted" : "")} key={c.id}>
                {c.image_url && <img src={c.image_url} alt={c.name} loading="lazy" />}
                <div className="meta">
                  <strong>{c.name}</strong>
                  <span className="price">{money(c.price)}{c.active === false ? " · oculto" : ""}</span>
                  <span className="note" style={{ display: "block" }}>{[c.size, c.portions, c.frosting].filter(Boolean).join(" · ")}</span>
                  {(c.options || []).length > 0 && <span className="note" style={{ display: "block" }}>Personaliza: {c.options.map((g) => g.name).join(", ")}</span>}
                  <div className="actions" style={{ marginTop: 8 }}>
                    <button className="btn ghost small" type="button" aria-label={`Editar ${c.name}`} onClick={() => edit(c)}>Editar</button>
                    <button className="btn ghost small danger" type="button" aria-label={`Eliminar ${c.name}`} onClick={() => remove(c)}>Eliminar</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

/* ================= Personalizar web ================= */

const LAYOUTS = [
  ["tarjetas", "Tarjetas", "Fotos en cuadrícula con su descripción debajo."],
  ["alternado", "Foto y texto", "Una foto grande al lado de su descripción, alternando lados."],
  ["carrusel", "Carrusel", "Fotos en fila que se deslizan hacia los lados."],
];
const emptySection = { id: null, title_es: "", title_en: "", body_es: "", body_en: "", layout: "tarjetas", active: true, in_menu: true };

// Los tres diseños, con un dibujito de cómo se ve cada uno.
function LayoutPicker({ name, value, onChange }) {
  return (
    <fieldset className="layout-picker">
      <legend>Diseño de la sección</legend>
      <div className="layout-options">
        {LAYOUTS.map(([id, label, hint]) => (
          <label key={id} className={"layout-option" + (value === id ? " on" : "")}>
            <input type="radio" name={name} value={id} checked={value === id} onChange={() => onChange(id)} />
            <span className={"layout-sketch sk-" + id} aria-hidden="true"><i /><i /><i /></span>
            <strong>{label}</strong>
            <span className="hint">{hint}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function SectionFields({ f, set, idp }) {
  return (
    <div className="form-grid">
      <div><label htmlFor={idp + "-tes"}>Título *</label><input id={idp + "-tes"} required maxLength={80} value={f.title_es} onChange={(e) => set({ title_es: e.target.value })} /></div>
      <div><label htmlFor={idp + "-ten"}>Título en inglés</label><input id={idp + "-ten"} maxLength={80} value={f.title_en || ""} onChange={(e) => set({ title_en: e.target.value })} /></div>
      <div className="span-2"><label htmlFor={idp + "-bes"}>Descripción general de la sección</label>
        <textarea id={idp + "-bes"} rows={3} maxLength={1200} value={f.body_es || ""} onChange={(e) => set({ body_es: e.target.value })} /></div>
      <div className="span-2"><label htmlFor={idp + "-ben"}>Descripción en inglés</label>
        <textarea id={idp + "-ben"} rows={2} maxLength={1200} value={f.body_en || ""} onChange={(e) => set({ body_en: e.target.value })} /></div>
      <div className="span-2"><LayoutPicker name={idp + "-layout"} value={f.layout} onChange={(layout) => set({ layout })} /></div>
      <div><label className="check"><input type="checkbox" checked={f.active !== false} onChange={(e) => set({ active: e.target.checked })} /> Mostrar esta sección en la página</label></div>
      <div><label className="check"><input type="checkbox" checked={f.in_menu !== false} onChange={(e) => set({ in_menu: e.target.checked })} /> Poner su enlace en el menú</label></div>
    </div>
  );
}

function SiteEditor({ data, load, flash, onAuthError }) {
  const { busy, post } = usePoster(load, flash, onAuthError);
  const photos = data?.sitePhotos || [];
  const sections = data?.sections || [];
  const [fresh, setFresh] = useState(emptySection);
  const targets = [["portada", "Portada (foto principal)"], ...sections.map((x) => [x.key, x.title_es])];
  const hero = photos.filter((p) => p.section === "portada");

  async function addSection(e) {
    e.preventDefault();
    if (await post({ ...fresh, type: "site_section" }, "Sección agregada")) setFresh(emptySection);
  }

  return (
    <>
      <div className="card" style={{ marginTop: 16 }}>
        <h2 className="h3">Personalizar el sitio</h2>
        <p className="note" style={{ marginBottom: 0 }}>Aquí armas la página principal: agrega o quita secciones, escribe su descripción, elige uno de los tres diseños y pon las fotos con su texto. Los cambios se ven en el sitio al recargar la página. Las reseñas de Google y la sección de contacto siempre se muestran al final.</p>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="section-head">
          <h2 className="h3">Portada (foto principal)</h2>
          <span className="note">{hero.filter((p) => p.active !== false).length} visibles de {hero.length}</span>
        </div>
        <p className="note">Se muestra la primera foto visible, arriba de todo.</p>
        {hero.map((p, i) => (
          <SitePhotoRow key={p.id + ":" + p.caption_es + ":" + p.caption_en} p={p} first={i === 0} last={i === hero.length - 1} busy={busy} post={post} targets={targets} />
        ))}
        <AddSitePhoto section="portada" busy={busy} post={post} flash={flash} />
      </div>

      {sections.map((sec, i) => (
        <SectionCard key={sec.id + ":" + [sec.title_es, sec.title_en, sec.body_es, sec.body_en, sec.layout, sec.active, sec.in_menu].join("|")}
          sec={sec} first={i === 0} last={i === sections.length - 1} photos={photos.filter((p) => p.section === sec.key)}
          targets={targets} busy={busy} post={post} flash={flash} />
      ))}

      <div className="card" style={{ marginTop: 16 }}>
        <h2 className="h3">Agregar sección</h2>
        <form onSubmit={addSection}>
          <SectionFields f={fresh} set={(patch) => setFresh((x) => ({ ...x, ...patch }))} idp="new-sec" />
          <div className="row"><button className="btn" disabled={busy || !fresh.title_es.trim()}>Agregar sección</button></div>
          <p className="note">Después de agregarla aparece arriba para que le pongas sus fotos.</p>
        </form>
      </div>
    </>
  );
}

function SectionCard({ sec, first, last, photos, targets, busy, post, flash }) {
  const [f, setF] = useState(sec);
  const dirty = ["title_es", "title_en", "body_es", "body_en", "layout", "active", "in_menu"].some((k) => (f[k] ?? "") !== (sec[k] ?? ""));
  const idp = "sec-" + sec.id;
  return (
    <div className={"card" + (sec.active === false ? " section-off" : "")} style={{ marginTop: 16 }}>
      <div className="section-head">
        <h2 className="h3">{sec.title_es}{sec.active === false ? " (oculta)" : ""}</h2>
        <div className="actions">
          <button type="button" className="btn ghost small" disabled={busy || first} aria-label={`Subir la sección ${sec.title_es}`} onClick={() => post({ type: "site_section_move", id: sec.id, dir: -1 }, "Orden actualizado")}>↑ Subir</button>
          <button type="button" className="btn ghost small" disabled={busy || last} aria-label={`Bajar la sección ${sec.title_es}`} onClick={() => post({ type: "site_section_move", id: sec.id, dir: 1 }, "Orden actualizado")}>↓ Bajar</button>
          <button type="button" className="btn ghost small danger" disabled={busy}
            onClick={() => { if (confirm(`¿Quitar la sección "${sec.title_es}" con sus ${photos.length} fotos? Esta acción no se puede deshacer.`)) post({ type: "site_section_delete", id: sec.id }, "Sección eliminada"); }}>Quitar sección</button>
        </div>
      </div>
      <form onSubmit={(e) => { e.preventDefault(); post({ ...f, type: "site_section", id: sec.id }, "Sección guardada"); }}>
        <SectionFields f={f} set={(patch) => setF((x) => ({ ...x, ...patch }))} idp={idp} />
        <div className="row">
          {dirty && <span className="note">Tienes cambios sin guardar.</span>}
          <button className="btn" disabled={busy || !dirty || !f.title_es.trim()}>Guardar sección</button>
        </div>
      </form>
      <h3 style={{ marginTop: 18 }}>Fotos y descripciones ({photos.filter((p) => p.active !== false).length} visibles de {photos.length})</h3>
      {photos.map((p, i) => (
        <SitePhotoRow key={p.id + ":" + p.caption_es + ":" + p.caption_en} p={p} first={i === 0} last={i === photos.length - 1} busy={busy} post={post} targets={targets} />
      ))}
      <AddSitePhoto section={sec.key} busy={busy} post={post} flash={flash} />
    </div>
  );
}

function SitePhotoRow({ p, first, last, busy, post, targets }) {
  const [es, setEs] = useState(p.caption_es || "");
  const [en, setEn] = useState(p.caption_en || "");
  const dirty = es !== (p.caption_es || "") || en !== (p.caption_en || "");
  const base = { type: "site_photo", id: p.id, section: p.section, caption_es: p.caption_es, caption_en: p.caption_en, active: p.active !== false };
  const label = es || `foto ${p.id}`;
  return (
    <div className={"site-photo" + (p.active === false ? " muted" : "")}>
      <img src={p.image_url} alt={es || "Foto de la sección"} loading="lazy" />
      <div className="fields">
        <label className="sr-only" htmlFor={`sp-es-${p.id}`}>Descripción en español</label>
        <input id={`sp-es-${p.id}`} placeholder="Descripción (opcional)" maxLength={240} value={es} onChange={(e) => setEs(e.target.value)} />
        <label className="sr-only" htmlFor={`sp-en-${p.id}`}>Descripción en inglés</label>
        <input id={`sp-en-${p.id}`} placeholder="Descripción en inglés (opcional)" maxLength={240} value={en} onChange={(e) => setEn(e.target.value)} />
        <div className="actions">
          <label className="check" style={{ margin: 0 }}>
            <input type="checkbox" checked={p.active !== false} disabled={busy}
              onChange={(e) => post({ ...base, active: e.target.checked }, e.target.checked ? "Foto visible" : "Foto oculta")} />
            Mostrar
          </label>
          <button type="button" className="btn ghost small" disabled={busy || first} aria-label={`Subir ${label}`} onClick={() => post({ type: "site_photo_move", id: p.id, dir: -1 }, "Orden actualizado")}>↑</button>
          <button type="button" className="btn ghost small" disabled={busy || last} aria-label={`Bajar ${label}`} onClick={() => post({ type: "site_photo_move", id: p.id, dir: 1 }, "Orden actualizado")}>↓</button>
          <label className="sr-only" htmlFor={`sp-sec-${p.id}`}>Sección</label>
          <select id={`sp-sec-${p.id}`} value={p.section} disabled={busy} style={{ width: "auto" }}
            onChange={(e) => post({ ...base, section: e.target.value }, "Foto movida de sección")}>
            {targets.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          {dirty && <button type="button" className="btn small" disabled={busy} onClick={() => post({ ...base, caption_es: es, caption_en: en }, "Descripción guardada")}>Guardar descripción</button>}
          <button type="button" className="btn ghost small danger" disabled={busy} aria-label={`Eliminar ${label}`}
            onClick={() => { if (confirm("¿Eliminar esta foto de la página?")) post({ type: "site_photo_delete", id: p.id }, "Foto eliminada"); }}>Eliminar</button>
        </div>
      </div>
    </div>
  );
}

function AddSitePhoto({ section, busy, post, flash }) {
  const [img, setImg] = useState("");
  const [es, setEs] = useState("");
  const [en, setEn] = useState("");
  async function add(e) {
    e.preventDefault();
    if (!img) return flash("Elige una foto", "error");
    if (await post({ type: "site_photo", section, image_url: img, caption_es: es, caption_en: en, active: true }, "Foto agregada")) { setImg(""); setEs(""); setEn(""); }
  }
  return (
    <form onSubmit={add} className="form-grid" style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid #ffe0ea" }}>
      <div><label htmlFor={`add-photo-${section}`}>Agregar foto</label>
        <input id={`add-photo-${section}`} type="file" accept="image/*" onChange={(e) => pickPhoto(e, setImg, flash, 1200)} /></div>
      {img && <img className="thumb-img" src={img} alt="Vista previa de la foto nueva" />}
      {section !== "portada" && (
        <>
          <div><label htmlFor={`add-es-${section}`}>Descripción</label><input id={`add-es-${section}`} maxLength={240} value={es} onChange={(e) => setEs(e.target.value)} /></div>
          <div><label htmlFor={`add-en-${section}`}>Descripción en inglés</label><input id={`add-en-${section}`} maxLength={240} value={en} onChange={(e) => setEn(e.target.value)} /></div>
        </>
      )}
      <div className="row"><button className="btn" disabled={busy || !img}>Agregar foto</button></div>
    </form>
  );
}

/* ================= Diseños ================= */

function Designs({ data, load, flash, onAuthError }) {
  const { busy, post } = usePoster(load, flash, onAuthError);
  const [design, setDesign] = useState(emptyDesign);

  async function saveDesign(e) {
    e.preventDefault();
    if (!design.image_url) return flash("Agrega una foto del diseño", "error");
    const ok = await post({ ...design, type: design.id ? "design_update" : "design" }, design.id ? "Diseño actualizado" : "Diseño agregado");
    if (ok) setDesign(emptyDesign);
  }
  async function removeDesign(d) {
    if (confirm(`¿Eliminar el diseño "${d.label}"?`)) {
      if (await post({ type: "design_delete", id: d.id }, "Diseño eliminado") && design.id === d.id) setDesign(emptyDesign);
    }
  }

  return (
    <div className="card" style={{ marginTop: 16 }}>
      <h2 className="h3">{design.id ? `Editar: ${design.label}` : "Agregar diseño"}</h2>
      <form onSubmit={saveDesign} className="form-grid">
        <div><label htmlFor="d-name">Nombre *</label><input id="d-name" required value={design.label} onChange={(e) => setDesign({ ...design, label: e.target.value })} /></div>
        <div><label htmlFor="d-price">Precio extra (USD)</label><input id="d-price" type="number" min="0" step="0.01" value={design.price} onChange={(e) => setDesign({ ...design, price: e.target.value })} /></div>
        <div><label className="check"><input type="checkbox" checked={design.active !== false} onChange={(e) => setDesign({ ...design, active: e.target.checked })} /> Visible para clientes</label></div>
        <div><label htmlFor="d-photo">Foto *</label><input id="d-photo" type="file" accept="image/*" onChange={(e) => pickPhoto(e, (url) => setDesign((d) => ({ ...d, image_url: url })), flash)} /></div>
        {design.image_url && <img className="thumb-img" src={design.image_url} alt="Vista previa del diseño" />}
        <div className="row">
          {design.id && <button type="button" className="btn ghost" onClick={() => setDesign(emptyDesign)}>Cancelar</button>}
          <button className="btn" disabled={busy}>{design.id ? "Guardar cambios" : "Agregar diseño"}</button>
        </div>
      </form>
      <div className="grid" style={{ marginTop: 18 }}>
        {(data?.designs || []).map((d) => (
          <div className={"opt static" + (d.active === false ? " muted" : "")} key={d.id}>
            <img src={d.image_url || d.image} alt={d.label} loading="lazy" />
            <div className="meta">
              <strong>{d.label}</strong>
              <span className="price">+ {money(d.price)}{d.active === false ? " · oculto" : ""}</span>
              <div className="actions" style={{ marginTop: 8 }}>
                <button className="btn ghost small" type="button" aria-label={`Editar ${d.label}`} onClick={() => { setDesign({ id: d.id, label: d.label, image_url: d.image_url || d.image || "", price: Number(d.price || 0), active: d.active !== false }); window.scrollTo({ top: 0, behavior: "smooth" }); }}>Editar</button>
                <button className="btn ghost small danger" type="button" aria-label={`Eliminar ${d.label}`} onClick={() => removeDesign(d)}>Eliminar</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
