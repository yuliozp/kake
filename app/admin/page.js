"use client";
import { useState } from "react";
import Logo from "@/components/Logo";

const emptyOpt = { id: null, category: "size", label: "", description: "", price: 0, image_url: "", active: true };
const CAT = [
  ["size", "Tamano"],
  ["cake_flavor", "Sabor pastel"],
  ["filling", "Sabor relleno"],
  ["filling_count", "Cantidad rellenos"],
  ["delivery", "Envio / recogida"],
];

function fileToDataUrl(file, max = 900) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("No se pudo leer la foto"));
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      };
      img.onerror = () => resolve(reader.result);
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

export default function AdminPage() {
  const [key, setKey] = useState("");
  const [data, setData] = useState(null);
  const [orders, setOrders] = useState([]);
  const [msg, setMsg] = useState("");
  const [opt, setOpt] = useState(emptyOpt);
  const [design, setDesign] = useState({ id: null, label: "", image_url: "", price: 0, active: true });

  async function load() {
    const res = await fetch("/api/admin", { headers: { "x-admin-key": key } });
    const json = await res.json();
    if (!res.ok) return setMsg(json.error || "Clave incorrecta. Prueba: kake");
    setData(json);
    const o = await fetch("/api/orders").then((r) => r.json());
    setOrders(o.orders || []);
    setMsg("Catalogo cargado");
  }

  async function postOption(body) {
    const res = await fetch("/api/admin", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-admin-key": key },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Error");
  }

  async function onOptFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setOpt((o) => ({ ...o, image_url: await fileToDataUrl(file) }));
  }
  async function onDesignFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setDesign((d) => ({ ...d, image_url: await fileToDataUrl(file) }));
  }

  async function saveOption(e) {
    e.preventDefault();
    if (!opt.label.trim()) return setMsg("Nombre obligatorio");
    await postOption(opt);
    setOpt(emptyOpt);
    load();
  }

  async function saveDesign(e) {
    e.preventDefault();
    if (!design.label.trim()) return setMsg("Nombre del diseno obligatorio");
    await postOption(design.id ? { type: "design_update", ...design } : { type: "design", ...design });
    setDesign({ id: null, label: "", image_url: "", price: 0, active: true });
    load();
  }

  async function setCat(cat, show) {
    for (const o of (data.options || []).filter((x) => x.category === cat)) {
      await postOption({ ...o, active: show });
    }
    load();
  }

  const grouped = {};
  (data?.options || []).forEach((o) => {
    grouped[o.category] = grouped[o.category] || [];
    grouped[o.category].push(o);
  });

  return (
    <main className="wrap">
      <div className="card">
        <Logo />
        <h2>Admin Karla's Bake</h2>
        <p className="note">Ventana aparte del pedido. Clave: kake</p>
        <input value={key} onChange={(e) => setKey(e.target.value)} placeholder="Clave" />
        <button className="btn" style={{ marginTop: 12 }} onClick={load}>Entrar</button>
        {msg && <p>{msg}</p>}
      </div>
      {data && CAT.map(([cat, name]) => (
        <div className="card" key={cat} style={{ marginTop: 16 }}>
          <h3>{name}</h3>
          <label>Mostrar este campo al cliente</label>
          <select onChange={(e) => setCat(cat, e.target.value === "mostrar")} defaultValue={(grouped[cat] || []).some((o) => o.active !== false) ? "mostrar" : "ocultar"}>
            <option value="mostrar">Mostrar</option>
            <option value="ocultar">Ocultar</option>
          </select>
          <table className="table">
            <tbody>
              {(grouped[cat] || []).map((o) => (
                <tr key={o.id}>
                  <td>{o.label}</td>
                  <td>${Number(o.price).toFixed(2)}</td>
                  <td>{o.active === false ? "oculto" : "visible"}</td>
                  <td><button className="btn ghost" type="button" onClick={() => setOpt({ ...o, image_url: o.image_url || "" })}>Editar</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
      {data && (
        <div className="card" style={{ marginTop: 16 }}>
          <h3>{opt.id ? "Editar opcion" : "Nueva opcion"}</h3>
          <form onSubmit={saveOption}>
            <select value={opt.category} onChange={(e) => setOpt({ ...opt, category: e.target.value })}>
              {CAT.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <input required placeholder="Nombre" value={opt.label} onChange={(e) => setOpt({ ...opt, label: e.target.value })} />
            <input placeholder="Descripcion" value={opt.description} onChange={(e) => setOpt({ ...opt, description: e.target.value })} />
            <input type="number" step="0.01" value={opt.price} onChange={(e) => setOpt({ ...opt, price: Number(e.target.value) })} />
            <label>Foto (desde galeria)</label>
            <input type="file" accept="image/*" onChange={onOptFile} />
            {opt.image_url ? <img src={opt.image_url} alt="" style={{ maxWidth: 140, borderRadius: 12 }} /> : null}
            <button className="btn">Guardar</button>
          </form>
        </div>
      )}
      {data && (
        <div className="card" style={{ marginTop: 16 }}>
          <h3>Banco de disenos</h3>
          <form onSubmit={saveDesign}>
            <input required placeholder="Nombre" value={design.label} onChange={(e) => setDesign({ ...design, label: e.target.value })} />
            <input type="number" step="0.01" value={design.price} onChange={(e) => setDesign({ ...design, price: Number(e.target.value) })} />
            <input type="file" accept="image/*" onChange={onDesignFile} />
            {design.image_url ? <img src={design.image_url} alt="" style={{ maxWidth: 140, borderRadius: 12 }} /> : null}
            <button className="btn">{design.id ? "Guardar cambios del diseno" : "Agregar diseno"}</button>
          </form>
          <div className="grid" style={{ marginTop: 12 }}>
            {(data.designs || []).map((d) => (
              <div className="opt" key={d.id}>
                <img src={d.image_url || d.image} alt={d.label} />
                <div className="meta">
                  <strong>{d.label}</strong>
                  <button className="btn ghost" type="button" onClick={() => setDesign({ id: d.id, label: d.label, image_url: d.image_url || d.image || "", price: Number(d.price || 0), active: d.active !== false })}>Editar</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {data && (
        <div className="card" style={{ marginTop: 16 }}>
          <h3>Pedidos</h3>
          <table className="table">
            <thead><tr><th>#</th><th>Nombre</th><th>Total</th></tr></thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id || o.order_number}><td>{o.order_number}</td><td>{o.customer_name}</td><td>${Number(o.total || 0).toFixed(2)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
