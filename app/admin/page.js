"use client";
import { useState } from "react";

const emptyOpt = { id: null, category: "size", label: "", description: "", price: 0, image_url: "" };

export default function AdminPage() {
  const [key, setKey] = useState("");
  const [data, setData] = useState(null);
  const [orders, setOrders] = useState([]);
  const [msg, setMsg] = useState("");
  const [opt, setOpt] = useState(emptyOpt);
  const [design, setDesign] = useState({ label: "", image_url: "", price: 0 });

  async function load() {
    const res = await fetch("/api/admin", { headers: { "x-admin-key": key } });
    const json = await res.json();
    if (!res.ok) return setMsg(json.error || "Clave incorrecta. Prueba: kake");
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
    const json = await res.json();
    if (!res.ok) return setMsg(json.error || "No se pudo guardar");
    setMsg(opt.id ? "Opción actualizada" : "Opción creada");
    setOpt(emptyOpt);
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
    setDesign({ label: "", image_url: "", price: 0 });
    load();
  }

  function editRow(o) {
    setOpt({
      id: o.id,
      category: o.category || "size",
      label: o.label || "",
      description: o.description || "",
      price: Number(o.price || 0),
      image_url: o.image_url || o.image || "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
    setMsg("Editando #" + o.id + " — cambia los campos y pulsa Guardar");
  }

  const grouped = {};
  (data?.options || []).forEach((o) => {
    grouped[o.category] = grouped[o.category] || [];
    grouped[o.category].push(o);
  });

  const catName = {
    size: "Tamaño",
    cake_flavor: "Sabor pastel",
    filling: "Sabor relleno",
    filling_count: "Cantidad rellenos",
    delivery: "Envío / recogida",
    shape: "Forma",
    frosting: "Cobertura",
  };

  return (
    <main className="wrap">
      <div className="card">
        <h2>Panel admin kake</h2>
        <p className="note">Clave actual: <code>kake</code></p>
        <label>Clave admin</label>
        <input value={key} onChange={(e) => setKey(e.target.value)} />
        <button className="btn" style={{ marginTop: 12 }} onClick={load}>Entrar</button>
        {msg && <p>{msg}</p>}
      </div>

      {data && (
        <>
          <div className="card" style={{ marginTop: 16 }}>
            <h3>{opt.id ? "Editar opción #" + opt.id : "Nueva opción"}</h3>
            <form onSubmit={saveOption}>
              <label>Categoría</label>
              <select value={opt.category} onChange={(e) => setOpt({ ...opt, category: e.target.value })}>
                <option value="size">Tamaño</option>
                <option value="cake_flavor">Sabor pastel</option>
                <option value="filling">Sabor relleno</option>
                <option value="filling_count">Cantidad rellenos</option>
                <option value="delivery">Envío / recogida</option>
              </select>
              <label>Nombre que ve el cliente</label>
              <input placeholder="Etiqueta" value={opt.label} onChange={(e) => setOpt({ ...opt, label: e.target.value })} />
              <label>Descripción</label>
              <input placeholder="Descripción" value={opt.description} onChange={(e) => setOpt({ ...opt, description: e.target.value })} />
              <label>Precio</label>
              <input type="number" step="0.01" value={opt.price} onChange={(e) => setOpt({ ...opt, price: Number(e.target.value) })} />
              <label>URL de la foto</label>
              <input placeholder="https://..." value={opt.image_url} onChange={(e) => setOpt({ ...opt, image_url: e.target.value })} />
              {opt.image_url ? <img src={opt.image_url} alt="" style={{ maxWidth: 160, marginTop: 8, borderRadius: 12 }} /> : null}
              <div className="row">
                <button className="btn" type="submit">{opt.id ? "Guardar cambios" : "Crear opción"}</button>
                {opt.id ? <button className="btn ghost" type="button" onClick={() => setOpt(emptyOpt)}>Cancelar edición</button> : null}
              </div>
            </form>
          </div>

          {Object.keys(grouped).map((cat) => (
            <div className="card" key={cat} style={{ marginTop: 16 }}>
              <h3>{catName[cat] || cat}</h3>
              <div style={{ overflow: "auto" }}>
                <table className="table">
                  <thead><tr><th>ID</th><th>Opción</th><th>Descripción</th><th>Precio</th><th>Foto</th><th></th></tr></thead>
                  <tbody>
                    {grouped[cat].map((o) => (
                      <tr key={o.id}>
                        <td>{o.id}</td>
                        <td>{o.label}</td>
                        <td>{o.description}</td>
                        <td>${Number(o.price).toFixed(2)}</td>
                        <td>{o.image_url ? "sí" : "—"}</td>
                        <td><button className="btn ghost" type="button" onClick={() => editRow(o)}>Editar</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}

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
                    <th># Pedido</th><th>Nombre</th><th>Entrega</th>
                    <th>Tamaño</th><th>Sabor</th><th>Relleno</th>
                    <th>Diseño</th><th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o) => (
                    <tr key={o.id || o.order_number}>
                      <td>{o.order_number}</td>
                      <td>{o.customer_name || o.customer?.name}</td>
                      <td>{o.delivery_type}</td>
                      <td>{o.size_label || o.size}</td>
                      <td>{o.cake_flavor}</td>
                      <td>{o.filling_flavor}</td>
                      <td>{o.design_label}</td>
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
