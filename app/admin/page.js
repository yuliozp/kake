"use client";
import { useState } from "react";

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
  const [design, setDesign] = useState({ label: "", image_url: "", price: 0 });

  async function load() {
    const res = await fetch("/api/admin", { headers: { "x-admin-key": key } });
    const json = await res.json();
    if (!res.ok) return setMsg(json.error || "Clave incorrecta. Prueba: kake");
    setData(json);
    const o = await fetch("/api/orders").then((r) => r.json());
    setOrders(o.orders || []);
    setMsg("Catalogo y pedidos cargados");
  }

  async function postOption(body) {
    const res = await fetch("/api/admin", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-admin-key": key },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Error");
    return json;
  }

  async function onOptFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setMsg("Cargando foto...");
    const url = await fileToDataUrl(file);
    setOpt((o) => ({ ...o, image_url: url }));
    setMsg("Foto lista. Guarda los cambios.");
  }

  async function onDesignFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setMsg("Cargando foto...");
    const url = await fileToDataUrl(file);
    setDesign((d) => ({ ...d, image_url: url }));
    setMsg("Foto lista. Agrega el diseno.");
  }

  async function saveOption(e) {
    e.preventDefault();
    if (!opt.category || !String(opt.label).trim()) return setMsg("Categoria y nombre son obligatorios.");
    try {
      await postOption({ ...opt, active: opt.active !== false });
      setMsg(opt.id ? "Opcion actualizada" : "Opcion creada");
      setOpt(emptyOpt);
      load();
    } catch (err) {
      setMsg(String(err.message || err));
    }
  }

  async function toggle(o) {
    await postOption({ ...o, image_url: o.image_url || o.image || "", active: !o.active });
    setMsg(o.active ? "Oculta para el cliente" : "Visible para el cliente");
    load();
  }

  async function hideCategory(cat) {
    const rows = (data.options || []).filter((o) => o.category === cat);
    for (const o of rows) {
      await postOption({ ...o, image_url: o.image_url || "", active: false });
    }
    setMsg("Categoria ocultada. El cliente ya no la ve.");
    load();
  }

  async function showCategory(cat) {
    const rows = (data.options || []).filter((o) => o.category === cat);
    for (const o of rows) {
      await postOption({ ...o, image_url: o.image_url || "", active: true });
    }
    setMsg("Categoria visible otra vez.");
    load();
  }

  async function saveDesign(e) {
    e.preventDefault();
    if (!String(design.label).trim() || !design.image_url) return setMsg("El diseno necesita nombre y foto.");
    const res = await fetch("/api/admin", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-admin-key": key },
      body: JSON.stringify({ type: "design", ...design }),
    });
    setMsg((await res.json()).error || "Diseno agregado");
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
      active: o.active !== false,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const grouped = {};
  (data?.options || []).forEach((o) => {
    grouped[o.category] = grouped[o.category] || [];
    grouped[o.category].push(o);
  });
  const catName = Object.fromEntries(CAT);

  return (
    <main className="wrap">
      <div className="card">
        <h2>Panel admin kake</h2>
        <p className="note">Clave: <code>kake</code>. Oculta un campo y el cliente deja de verlo en el pedido.</p>
        <label>Clave admin</label>
        <input value={key} onChange={(e) => setKey(e.target.value)} />
        <button className="btn" style={{ marginTop: 12 }} onClick={load}>Entrar</button>
        {msg && <p>{msg}</p>}
      </div>

      {data && (
        <>
          <div className="card" style={{ marginTop: 16 }}>
            <h3>{opt.id ? "Editar opcion #" + opt.id : "Nueva opcion"}</h3>
            <form onSubmit={saveOption}>
              <label>Categoria *</label>
              <select required value={opt.category} onChange={(e) => setOpt({ ...opt, category: e.target.value })}>
                {CAT.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
              <label>Nombre *</label>
              <input required value={opt.label} onChange={(e) => setOpt({ ...opt, label: e.target.value })} />
              <label>Descripcion</label>
              <input value={opt.description} onChange={(e) => setOpt({ ...opt, description: e.target.value })} />
              <label>Precio *</label>
              <input required type="number" step="0.01" value={opt.price} onChange={(e) => setOpt({ ...opt, price: Number(e.target.value) })} />
              <label>Foto</label>
              <input type="file" accept="image/*" onChange={onOptFile} />
              <input placeholder="o URL https://..." value={String(opt.image_url || "").startsWith("data:") ? "" : opt.image_url} onChange={(e) => setOpt({ ...opt, image_url: e.target.value })} />
              {opt.image_url ? <img src={opt.image_url} alt="" style={{ maxWidth: 160, marginTop: 8, borderRadius: 12 }} /> : null}
              <div className="row">
                <button className="btn" type="submit">{opt.id ? "Guardar cambios" : "Crear opcion"}</button>
                {opt.id ? <button className="btn ghost" type="button" onClick={() => setOpt(emptyOpt)}>Cancelar</button> : null}
              </div>
            </form>
          </div>

          {CAT.map(([cat, name]) => (
            <div className="card" key={cat} style={{ marginTop: 16 }}>
              <h3>{name}</h3>
              <div className="row">
                <button className="btn ghost" type="button" onClick={() => hideCategory(cat)}>Ocultar todo este campo</button>
                <button className="btn ghost" type="button" onClick={() => showCategory(cat)}>Mostrar otra vez</button>
              </div>
              <div style={{ overflow: "auto" }}>
                <table className="table">
                  <thead><tr><th>ID</th><th>Opcion</th><th>Precio</th><th>Estado</th><th></th></tr></thead>
                  <tbody>
                    {(grouped[cat] || []).map((o) => (
                      <tr key={o.id} style={{ opacity: o.active === false ? 0.45 : 1 }}>
                        <td>{o.id}</td>
                        <td>{o.label}</td>
                        <td>${Number(o.price).toFixed(2)}</td>
                        <td>{o.active === false ? "oculto" : "visible"}</td>
                        <td>
                          <button className="btn ghost" type="button" onClick={() => editRow(o)}>Editar</button>
                          <button className="btn ghost" type="button" onClick={() => toggle(o)}>{o.active === false ? "Mostrar" : "Ocultar"}</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}

          <div className="card" style={{ marginTop: 16 }}>
            <h3>Banco de disenos</h3>
            <form onSubmit={saveDesign}>
              <input required placeholder="Nombre" value={design.label} onChange={(e) => setDesign({ ...design, label: e.target.value })} />
              <input type="file" accept="image/*" onChange={onDesignFile} />
              <input placeholder="o URL" value={String(design.image_url || "").startsWith("data:") ? "" : design.image_url} onChange={(e) => setDesign({ ...design, image_url: e.target.value })} />
              {design.image_url ? <img src={design.image_url} alt="" style={{ maxWidth: 160, borderRadius: 12 }} /> : null}
              <input type="number" step="0.01" placeholder="Precio extra" value={design.price} onChange={(e) => setDesign({ ...design, price: Number(e.target.value) })} />
              <button className="btn">Agregar</button>
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
                <thead><tr><th>#</th><th>Nombre</th><th>Tamano</th><th>Sabor</th><th>Relleno</th><th>Total</th></tr></thead>
                <tbody>
                  {orders.map((o) => (
                    <tr key={o.id || o.order_number}>
                      <td>{o.order_number}</td>
                      <td>{o.customer_name || o.customer?.name}</td>
                      <td>{o.size_label || o.size}</td>
                      <td>{o.cake_flavor}</td>
                      <td>{o.filling_flavor}</td>
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
