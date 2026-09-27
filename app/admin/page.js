"use client";
import { useState } from "react";

export default function AdminPage() {
  const [key, setKey] = useState("");
  const [data, setData] = useState(null);
  const [orders, setOrders] = useState([]);
  const [msg, setMsg] = useState("");
  const [opt, setOpt] = useState({ category: "size", label: "", description: "", price: 0, image_url: "" });
  const [design, setDesign] = useState({ label: "", image_url: "", price: 0 });

  async function load() {
    const res = await fetch("/api/admin", { headers: { "x-admin-key": key } });
    const json = await res.json();
    if (!res.ok) return setMsg(json.error || "Clave incorrecta");
    setData(json);
    const o = await fetch("/api/orders").then((r) => r.json());
    setOrders(o.orders || []);
    setMsg("Catálogo y pedidos cargados");
  }

  async function saveOption(e) {
    e.preventDefault();
    const res = await fetch("/api/admin", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-admin-key": key },
      body: JSON.stringify(opt),
    });
    setMsg((await res.json()).error || "Opción guardada");
    load();
  }

  async function saveDesign(e) {
    e.preventDefault();
    const res = await fetch("/api/admin", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-admin-key": key },
      body: JSON.stringify({ type: "design", ...design }),
    });
    setMsg((await res.json()).error || "Diseño agregado al banco");
    load();
  }

  return (
    <main className="wrap">
      <div className="card">
        <h2>Panel admin kake</h2>
        <p className="note">Clave por defecto: <code>kake</code> (cámbiala con ADMIN_KEY en Vercel).</p>
        <label>Clave admin</label>
        <input value={key} onChange={(e) => setKey(e.target.value)} />
        <button className="btn" style={{ marginTop: 12 }} onClick={load}>Entrar</button>
        {msg && <p>{msg}</p>}
      </div>

      {data && (
        <>
          <div className="card" style={{ marginTop: 16 }}>
            <h3>Agregar / editar opción (precios y muestras)</h3>
            <form onSubmit={saveOption} className="grid">
              <select value={opt.category} onChange={(e) => setOpt({ ...opt, category: e.target.value })}>
                <option value="size">Tamaño</option>
                <option value="cake_flavor">Sabor pastel</option>
                <option value="filling">Sabor relleno</option>
                <option value="filling_count">Cantidad rellenos</option>
                <option value="delivery">Envío / recogida</option>
              </select>
              <input placeholder="Etiqueta" value={opt.label} onChange={(e) => setOpt({ ...opt, label: e.target.value })} />
              <input placeholder="Descripción" value={opt.description} onChange={(e) => setOpt({ ...opt, description: e.target.value })} />
              <input type="number" step="0.01" placeholder="Precio" value={opt.price} onChange={(e) => setOpt({ ...opt, price: Number(e.target.value) })} />
              <input placeholder="URL imagen de muestra" value={opt.image_url} onChange={(e) => setOpt({ ...opt, image_url: e.target.value })} />
              <button className="btn">Guardar opción</button>
            </form>
            <div style={{ overflow: "auto", marginTop: 12 }}>
              <table className="table">
                <thead><tr><th>ID</th><th>Categoría</th><th>Opción</th><th>Precio</th></tr></thead>
                <tbody>
                  {(data.options || []).map((o) => (
                    <tr key={o.id}><td>{o.id}</td><td>{o.category}</td><td>{o.label}</td><td>${Number(o.price).toFixed(2)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card" style={{ marginTop: 16 }}>
            <h3>Banco de fotos / diseños favoritos</h3>
            <form onSubmit={saveDesign} className="grid">
              <input placeholder="Nombre del diseño" value={design.label} onChange={(e) => setDesign({ ...design, label: e.target.value })} />
              <input placeholder="URL de foto" value={design.image_url} onChange={(e) => setDesign({ ...design, image_url: e.target.value })} />
              <input type="number" step="0.01" placeholder="Precio extra" value={design.price} onChange={(e) => setDesign({ ...design, price: Number(e.target.value) })} />
              <button className="btn">Agregar al banco</button>
            </form>
            <div className="grid" style={{ marginTop: 12 }}>
              {(data.designs || []).map((d) => (
                <div className="opt" key={d.id}>
                  <img src={d.image_url || d.image} alt={d.label} />
                  <div className="meta"><strong>{d.label}</strong><div className="price">+ ${Number(d.price||0).toFixed(2)}</div></div>
                </div>
              ))}
            </div>
          </div>

          <div className="card" style={{ marginTop: 16 }}>
            <h3>Pedidos</h3>
            <div style={{ overflow: "auto" }}>
              <table className="table">
                <thead>
                  <tr>
                    <th># Pedido</th><th>ID cliente</th><th>Nombre</th><th>Entrega</th>
                    <th>Tamaño</th><th>Sabor</th><th>Relleno</th><th>Capas</th>
                    <th>Diseño</th><th>Pedido</th><th>Entrega</th><th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o) => (
                    <tr key={o.id || o.order_number}>
                      <td>{o.order_number}</td>
                      <td>{o.customer_id}</td>
                      <td>{o.customer_name || o.customer?.name}</td>
                      <td>{o.delivery_type}</td>
                      <td>{o.size_label || o.size}</td>
                      <td>{o.cake_flavor}</td>
                      <td>{o.filling_flavor}</td>
                      <td>{o.filling_count}</td>
                      <td>{o.design_label}</td>
                      <td>{String(o.ordered_at || "").slice(0,16)}</td>
                      <td>{o.delivery_date} {o.delivery_time}</td>
                      <td>${Number(o.total || 0).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </main>
  );
}
