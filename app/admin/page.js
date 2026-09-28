"use client";
import { useCallback, useEffect, useState } from "react";
import Logo from "@/components/Logo";
import { fileToDataUrl } from "@/lib/image";

const CAT = [
  ["size", "Tamaño"],
  ["cake_flavor", "Sabor del pastel"],
  ["filling", "Sabor del relleno"],
  ["filling_count", "Cantidad de rellenos"],
  ["delivery", "Envío / recogida"],
];
const emptyOpt = { id: null, category: "size", label: "", description: "", price: 0, image_url: "", active: true };
const emptyDesign = { id: null, label: "", image_url: "", price: 0, active: true };
const money = (n) => "$" + Number(n || 0).toFixed(2);
const KEY_STORE = "kake-admin-key";

function fmtDate(v) {
  if (!v) return "—";
  const s = String(v).slice(0, 10);
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("es-US", { weekday: "short", day: "numeric", month: "short" });
}

export default function AdminPage() {
  const [key, setKey] = useState("");
  const [authed, setAuthed] = useState(false);
  const [data, setData] = useState(null);
  const [orders, setOrders] = useState([]);
  const [tab, setTab] = useState("pedidos");
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const [opt, setOpt] = useState(emptyOpt);
  const [design, setDesign] = useState(emptyDesign);
  const [openOrder, setOpenOrder] = useState(null);

  const flash = (text, kind = "ok") => { setMsg({ text, kind }); if (kind === "ok") setTimeout(() => setMsg(null), 2500); };

  const load = useCallback(async (k) => {
    const headers = { "x-admin-key": k };
    const [cat, ord] = await Promise.all([
      fetch("/api/admin", { headers }),
      fetch("/api/orders", { headers }),
    ]);
    const catJson = await cat.json().catch(() => ({}));
    if (!cat.ok) throw new Error(catJson.error || "No autorizado");
    const ordJson = await ord.json().catch(() => ({}));
    setData(catJson);
    setOrders(ordJson.orders || []);
  }, []);

  useEffect(() => {
    const saved = sessionStorage.getItem(KEY_STORE);
    if (!saved) return;
    setKey(saved);
    load(saved).then(() => setAuthed(true)).catch(() => sessionStorage.removeItem(KEY_STORE));
  }, [load]);

  async function login(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await load(key);
      sessionStorage.setItem(KEY_STORE, key);
      setAuthed(true);
      setMsg(null);
    } catch (err) {
      flash(err.message, "error");
    } finally {
      setBusy(false);
    }
  }

  function logout() {
    sessionStorage.removeItem(KEY_STORE);
    setAuthed(false); setData(null); setOrders([]); setKey("");
  }

  async function post(body, okText = "Guardado") {
    setBusy(true);
    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-key": key },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Error al guardar");
      await load(key);
      flash(okText);
      return true;
    } catch (err) {
      flash(err.message, "error");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function pickPhoto(e, apply) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const url = await fileToDataUrl(file, 900);
      apply(url);
    } catch {
      flash("No se pudo leer la foto", "error");
    }
  }

  async function saveOption(e) {
    e.preventDefault();
    if (await post(opt, opt.id ? "Opción actualizada" : "Opción agregada")) setOpt(emptyOpt);
  }
  async function saveDesign(e) {
    e.preventDefault();
    if (!design.image_url) return flash("Agrega una foto del diseño", "error");
    const ok = await post({ ...design, type: design.id ? "design_update" : "design" }, design.id ? "Diseño actualizado" : "Diseño agregado");
    if (ok) setDesign(emptyDesign);
  }
  async function removeOption(o) {
    if (confirm(`¿Eliminar "${o.label}"? Esta acción no se puede deshacer.`)) {
      if (await post({ type: "option_delete", id: o.id }, "Opción eliminada") && opt.id === o.id) setOpt(emptyOpt);
    }
  }
  async function removeDesign(d) {
    if (confirm(`¿Eliminar el diseño "${d.label}"?`)) {
      if (await post({ type: "design_delete", id: d.id }, "Diseño eliminado") && design.id === d.id) setDesign(emptyDesign);
    }
  }

  if (!authed) {
    return (
      <main className="wrap narrow">
        <form className="card" onSubmit={login}>
          <Logo />
          <h2>Panel de administración</h2>
          <p className="note">Acceso solo para el equipo de Karla's Bake.</p>
          <label htmlFor="admin-key">Clave</label>
          <input id="admin-key" type="password" autoComplete="current-password" autoFocus value={key} onChange={(e) => setKey(e.target.value)} />
          <button className="btn wide" style={{ marginTop: 14 }} disabled={busy || !key}>{busy ? "Entrando..." : "Entrar"}</button>
          {msg && <p className={msg.kind === "error" ? "alert" : "ok"} role="status">{msg.text}</p>}
        </form>
      </main>
    );
  }

  const grouped = {};
  (data?.options || []).forEach((o) => { (grouped[o.category] = grouped[o.category] || []).push(o); });
  const pending = orders.filter((o) => String(o.delivery_date || "").slice(0, 10) >= new Date().toISOString().slice(0, 10));

  return (
    <main className="wrap admin">
      <div className="admin-bar card">
        <Logo size={44} />
        <nav className="tabs" role="tablist">
          {[["pedidos", `Pedidos (${orders.length})`], ["catalogo", "Catálogo"], ["disenos", "Diseños"]].map(([id, name]) => (
            <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? "on" : ""} onClick={() => setTab(id)}>{name}</button>
          ))}
        </nav>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn ghost small" onClick={() => load(key).then(() => flash("Actualizado")).catch((e) => flash(e.message, "error"))}>Actualizar</button>
          <button className="btn ghost small" onClick={logout}>Salir</button>
        </div>
      </div>
      {msg && <p className={"toast " + (msg.kind === "error" ? "alert" : "ok")} role="status">{msg.text}</p>}

      {tab === "pedidos" && (
        <section className="card" style={{ marginTop: 16 }}>
          <div className="stats">
            <div><span>{orders.length}</span>pedidos totales</div>
            <div><span>{pending.length}</span>por entregar</div>
            <div><span>{money(pending.reduce((s, o) => s + Number(o.total || 0), 0))}</span>por cobrar (estimado)</div>
          </div>
          {orders.length === 0 ? <p className="note">Aún no hay pedidos.</p> : (
            <div className="table-scroll">
              <table className="table">
                <thead><tr><th>Pedido</th><th>Entrega</th><th>Cliente</th><th>Tamaño / sabor</th><th>Total</th><th /></tr></thead>
                <tbody>
                  {orders.map((o) => (
                    <FragmentRow key={o.id || o.order_number} o={o} open={openOrder === o.id} onToggle={() => setOpenOrder(openOrder === o.id ? null : o.id)} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {tab === "catalogo" && (
        <>
          {CAT.map(([cat, name]) => {
            const items = grouped[cat] || [];
            const visible = items.some((o) => o.active !== false);
            return (
              <section className="card" key={cat} style={{ marginTop: 16 }}>
                <div className="section-head">
                  <h3>{name}</h3>
                  <label className="check">
                    <input type="checkbox" checked={visible} disabled={busy || !items.length}
                      onChange={(e) => post({ type: "category_active", category: cat, active: e.target.checked }, e.target.checked ? "Paso visible" : "Paso oculto")} />
                    Mostrar este paso al cliente
                  </label>
                </div>
                <table className="table">
                  <tbody>
                    {items.map((o) => (
                      <tr key={o.id} className={o.active === false ? "muted" : ""}>
                        <td>{o.label}</td>
                        <td>{money(o.price)}</td>
                        <td>{o.active === false ? "Oculto" : "Visible"}</td>
                        <td><div className="actions">
                          <button className="btn ghost small" type="button" onClick={() => { setOpt({ ...emptyOpt, ...o, price: Number(o.price), image_url: o.image_url || "" }); document.getElementById("opt-form")?.scrollIntoView({ behavior: "smooth" }); }}>Editar</button>
                          <button className="btn ghost small danger" type="button" onClick={() => removeOption(o)}>Eliminar</button>
                        </div></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            );
          })}
          <section className="card" id="opt-form" style={{ marginTop: 16 }}>
            <h3>{opt.id ? `Editar: ${opt.label}` : "Nueva opción"}</h3>
            <form onSubmit={saveOption} className="form-grid">
              <div><label>Categoría</label>
                <select value={opt.category} onChange={(e) => setOpt({ ...opt, category: e.target.value })}>
                  {CAT.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select></div>
              <div><label>Nombre *</label><input required value={opt.label} onChange={(e) => setOpt({ ...opt, label: e.target.value })} /></div>
              <div><label>Descripción</label><input value={opt.description || ""} onChange={(e) => setOpt({ ...opt, description: e.target.value })} /></div>
              <div><label>Precio (USD)</label><input type="number" min="0" step="0.01" value={opt.price} onChange={(e) => setOpt({ ...opt, price: e.target.value })} /></div>
              <div><label className="check"><input type="checkbox" checked={opt.active !== false} onChange={(e) => setOpt({ ...opt, active: e.target.checked })} /> Visible para clientes</label></div>
              <div><label>Foto</label><input type="file" accept="image/*" onChange={(e) => pickPhoto(e, (url) => setOpt((o) => ({ ...o, image_url: url })))} /></div>
              {opt.image_url && <img className="thumb-img" src={opt.image_url} alt="" />}
              <div className="row">
                {opt.id && <button type="button" className="btn ghost" onClick={() => setOpt(emptyOpt)}>Cancelar</button>}
                <button className="btn" disabled={busy}>{opt.id ? "Guardar cambios" : "Agregar opción"}</button>
              </div>
            </form>
          </section>
        </>
      )}

      {tab === "disenos" && (
        <section className="card" style={{ marginTop: 16 }}>
          <h3>{design.id ? `Editar: ${design.label}` : "Agregar diseño"}</h3>
          <form onSubmit={saveDesign} className="form-grid">
            <div><label>Nombre *</label><input required value={design.label} onChange={(e) => setDesign({ ...design, label: e.target.value })} /></div>
            <div><label>Precio extra (USD)</label><input type="number" min="0" step="0.01" value={design.price} onChange={(e) => setDesign({ ...design, price: e.target.value })} /></div>
            <div><label className="check"><input type="checkbox" checked={design.active !== false} onChange={(e) => setDesign({ ...design, active: e.target.checked })} /> Visible para clientes</label></div>
            <div><label>Foto *</label><input type="file" accept="image/*" onChange={(e) => pickPhoto(e, (url) => setDesign((d) => ({ ...d, image_url: url })))} /></div>
            {design.image_url && <img className="thumb-img" src={design.image_url} alt="" />}
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
                    <button className="btn ghost small" type="button" onClick={() => { setDesign({ id: d.id, label: d.label, image_url: d.image_url || d.image || "", price: Number(d.price || 0), active: d.active !== false }); window.scrollTo({ top: 0, behavior: "smooth" }); }}>Editar</button>
                    <button className="btn ghost small danger" type="button" onClick={() => removeDesign(d)}>Eliminar</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}

function FragmentRow({ o, open, onToggle }) {
  return (
    <>
      <tr className="clickable" onClick={onToggle}>
        <td><strong>{o.order_number}</strong><div className="note">{new Date(o.ordered_at).toLocaleDateString("es-US")}</div></td>
        <td>{fmtDate(o.delivery_date)}<div className="note">{o.delivery_time}</div></td>
        <td>{o.customer_name}<div className="note">{o.phone}</div></td>
        <td>{o.size_label || "—"}<div className="note">{[o.cake_flavor, o.filling_flavor].filter(Boolean).join(" / ")}</div></td>
        <td><strong>{money(o.total)}</strong></td>
        <td>{open ? "▲" : "▼"}</td>
      </tr>
      {open && (
        <tr className="detail">
          <td colSpan={6}>
            <div className="detail-grid">
              <dl className="summary compact">
                <div><dt>Correo</dt><dd><a href={`mailto:${o.email}`}>{o.email || "—"}</a></dd></div>
                <div><dt>Teléfono</dt><dd><a href={`tel:${o.phone}`}>{o.phone || "—"}</a></dd></div>
                <div><dt>SMS promociones</dt><dd>{o.sms_opt_in ? "Sí" : "No"}</dd></div>
                <div><dt>Modalidad</dt><dd>{o.delivery_type || "—"}</dd></div>
                <div><dt>Dirección</dt><dd>{o.delivery_address || "—"}</dd></div>
                <div><dt>Rellenos</dt><dd>{o.filling_count || "—"}</dd></div>
                <div><dt>Diseño</dt><dd>{o.design_label || "—"}</dd></div>
                <div><dt>Descripción</dt><dd>{o.design_notes || "—"}</dd></div>
              </dl>
              {o.design_image && <a href={o.design_image} target="_blank" rel="noreferrer"><img className="thumb-img" src={o.design_image} alt="Referencia" /></a>}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
