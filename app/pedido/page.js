"use client";
import { useEffect, useMemo, useState } from "react";
import { defaultCatalog, IMAGES } from "@/lib/defaults";

function tomorrowISO() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

const STEPS = [
  { id: "cliente", title: "Tus datos" },
  { id: "fecha", title: "Fecha de entrega" },
  { id: "hora", title: "Hora de entrega" },
  { id: "envio", title: "Envío o recogida" },
  { id: "size", title: "Tamaño" },
  { id: "sabor", title: "Sabor del pastel" },
  { id: "relleno", title: "Sabor del relleno" },
  { id: "capas", title: "Cantidad de rellenos" },
  { id: "diseno", title: "Diseño favorito" },
  { id: "resumen", title: "Confirmar pedido" },
];

export default function PedidoPage() {
  const [catalog, setCatalog] = useState(defaultCatalog);
  const [step, setStep] = useState(0);
  const [open, setOpen] = useState(true);
  const [status, setStatus] = useState("");
  const [form, setForm] = useState({
    name: "", phone: "", email: "", address: "",
    deliveryDate: tomorrowISO(),
    deliveryTime: "15:00",
    deliveryType: "",
    deliveryAddress: "",
    size: "", cakeFlavor: "", fillingFlavor: "", fillingCount: "",
    designLabel: "", designImage: "", designPrice: 0,
    uploadPreview: "",
  });

  useEffect(() => {
    fetch("/api/catalog").then((r) => r.json()).then((d) => {
      if (d.options) setCatalog({ options: d.options, designs: d.designs || [] });
    }).catch(() => {});
  }, []);

  const by = (cat) => (catalog.options || []).filter((o) => o.category === cat);
  const find = (cat, label) => by(cat).find((o) => o.label === label);

  const total = useMemo(() => {
    let t = 0;
    const add = (cat, label) => { const o = find(cat, label); if (o) t += Number(o.price || 0); };
    add("size", form.size);
    add("cake_flavor", form.cakeFlavor);
    add("filling", form.fillingFlavor);
    add("filling_count", form.fillingCount);
    add("delivery", form.deliveryType);
    t += Number(form.designPrice || 0);
    return t;
  }, [form, catalog]);

  const previewImg = form.designImage || form.uploadPreview || find("size", form.size)?.image || find("cake_flavor", form.cakeFlavor)?.image || IMAGES.hero;

  function next() {
    if (step === 0 && (!form.name || !form.phone || !form.email)) return setStatus("Completa nombre, teléfono y email.");
    if (step === 3 && form.deliveryType?.includes("Envío") && !form.deliveryAddress) return setStatus("Escribe la dirección de envío.");
    setStatus("");
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  async function submit() {
    setStatus("Guardando...");
    const res = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customer: { name: form.name, phone: form.phone, email: form.email, address: form.address || form.deliveryAddress },
        deliveryType: form.deliveryType,
        deliveryAddress: form.deliveryAddress,
        deliveryDate: form.deliveryDate,
        deliveryTime: form.deliveryTime,
        size: form.size,
        cakeFlavor: form.cakeFlavor,
        fillingFlavor: form.fillingFlavor,
        fillingCount: form.fillingCount?.startsWith("3") ? 3 : 2,
        designLabel: form.designLabel,
        designImage: form.designImage || form.uploadPreview,
        selections: form,
        total,
      }),
    });
    const data = await res.json();
    if (!res.ok) return setStatus(data.error || "Error al guardar");
    setStatus("¡Pedido " + data.orderNumber + " confirmado!");
  }

  function Options({ category, field, extra }) {
    const items = extra || by(category);
    return (
      <div className="grid">
        {items.map((o) => {
          const selected = form[field] === o.label;
          return (
            <div key={o.id || o.label} className={"opt" + (selected ? " selected" : "")}
              onClick={() => setForm((f) => ({ ...f, [field]: o.label, ...(field === "designLabel" ? { designImage: o.image || o.image_url, designPrice: o.price } : {}) }))}>
              {(o.image || o.image_url) && <img src={o.image || o.image_url} alt={o.label} />}
              <div className="meta">
                <strong>{o.label}</strong>
                <div className="note">{o.description}</div>
                <div className="price">+ ${Number(o.price || 0).toFixed(2)}</div>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  const current = STEPS[step];

  return (
    <main className="wrap">
      <div className="card">
        <h2>Arma tu kake</h2>
        <p className="note">Cada paso es una pantalla. El precio se actualiza con cada elección.</p>
        <button className="btn" onClick={() => setOpen(true)}>Continuar personalización</button>
      </div>
      {open && (
        <div className="modal-bg">
          <div className="modal">
            <div>
              <p className="note">Paso {step + 1} de {STEPS.length}</p>
              <h2>{current.title}</h2>
              {current.id === "cliente" && (
                <>
                  <label>Nombre</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                  <label>Teléfono</label><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                  <label>Email</label><input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                  <label>Dirección (opcional)</label><input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
                </>
              )}
              {current.id === "fecha" && (
                <>
                  <label>Fecha de entrega (predeterminada: mañana)</label>
                  <input type="date" min={tomorrowISO()} value={form.deliveryDate} onChange={(e) => setForm({ ...form, deliveryDate: e.target.value })} />
                </>
              )}
              {current.id === "hora" && (
                <>
                  <label>Hora de entrega</label>
                  <input type="time" value={form.deliveryTime} onChange={(e) => setForm({ ...form, deliveryTime: e.target.value })} />
                </>
              )}
              {current.id === "envio" && (
                <>
                  <Options category="delivery" field="deliveryType" />
                  {form.deliveryType?.toLowerCase().includes("envío") || form.deliveryType?.toLowerCase().includes("envio") ? (
                    <>
                      <label>Dirección detallada de envío</label>
                      <textarea rows={3} value={form.deliveryAddress} onChange={(e) => setForm({ ...form, deliveryAddress: e.target.value })} />
                    </>
                  ) : <p className="note">Si eliges recogida, pasa al siguiente paso.</p>}
                </>
              )}
              {current.id === "size" && <Options category="size" field="size" />}
              {current.id === "sabor" && <Options category="cake_flavor" field="cakeFlavor" />}
              {current.id === "relleno" && <Options category="filling" field="fillingFlavor" />}
              {current.id === "capas" && <Options category="filling_count" field="fillingCount" />}
              {current.id === "diseno" && (
                <>
                  <p className="note">Elige del banco Kake o sube tu referencia. Inspiración: <a href={IMAGES.instagram} target="_blank">Instagram</a></p>
                  <Options extra={(catalog.designs || []).map((d) => ({ ...d, image: d.image || d.image_url }))} field="designLabel" />
                  <label>O sube / pega URL de tu imagen</label>
                  <input placeholder="https://..." onChange={(e) => setForm({ ...form, uploadPreview: e.target.value, designImage: e.target.value, designLabel: form.designLabel || "Diseño propio" })} />
                </>
              )}
              {current.id === "resumen" && (
                <div>
                  <p><b>{form.name}</b> · {form.phone} · {form.email}</p>
                  <p>{form.deliveryType} · {form.deliveryDate} {form.deliveryTime}</p>
                  <p>{form.size} · {form.cakeFlavor} · relleno {form.fillingFlavor} · {form.fillingCount}</p>
                  <p>Diseño: {form.designLabel || "propio"}</p>
                  <button className="btn" onClick={submit}>Confirmar y guardar pedido</button>
                </div>
              )}
              {status && <p className="note">{status}</p>}
              <div className="row">
                <button className="btn ghost" onClick={() => step === 0 ? setOpen(false) : setStep(step - 1)}>Atrás</button>
                {step < STEPS.length - 1 && <button className="btn" onClick={next}>Siguiente</button>}
              </div>
            </div>
            <aside className="preview">
              <img src={previewImg} alt="Vista previa" />
              <div className="total">${total.toFixed(2)}</div>
              <ul>
                <li>Medida: {form.size || "—"}</li>
                <li>Sabor: {form.cakeFlavor || "—"}</li>
                <li>Relleno: {form.fillingFlavor || "—"}</li>
                <li>Capas: {form.fillingCount || "—"}</li>
                <li>Diseño: {form.designLabel || "—"}</li>
                <li>{form.deliveryType || "Entrega"}</li>
              </ul>
            </aside>
          </div>
        </div>
      )}
    </main>
  );
}
