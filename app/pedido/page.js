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
  const [saving, setSaving] = useState(false);
  const [orderNumber, setOrderNumber] = useState("");
  const [form, setForm] = useState({
    name: "", phone: "", email: "", address: "",
    deliveryDate: tomorrowISO(),
    deliveryTime: "15:00",
    deliveryType: "",
    deliveryAddress: "",
    size: "", cakeFlavor: "", fillingFlavor: "", fillingCount: "",
    designLabel: "", designImage: "", designPrice: 0,
    uploadPreview: "", designNotes: "",
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
    if (step === 3 && !form.deliveryType) return setStatus("Elige envío o recogida.");
    if (step === 3 && form.deliveryType?.toLowerCase().includes("env") && !form.deliveryAddress) return setStatus("Escribe la dirección de envío.");
    if (step === 4 && !form.size) return setStatus("Elige un tamaño.");
    if (step === 5 && !form.cakeFlavor) return setStatus("Elige el sabor del pastel.");
    if (step === 6 && !form.fillingFlavor) return setStatus("Elige el sabor del relleno.");
    if (step === 7 && !form.fillingCount) return setStatus("Elige 2 o 3 rellenos.");
    if (step === 8 && !form.designLabel && !form.designNotes && !form.uploadPreview) return setStatus("Elige un diseño, descríbelo o sube una foto.");
    setStatus("");
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  function onUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setForm((f) => ({
        ...f,
        uploadPreview: reader.result,
        designImage: reader.result,
        designLabel: f.designLabel || "Diseño propio",
      }));
    };
    reader.readAsDataURL(file);
  }

  async function submit() {
    setSaving(true);
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
        selections: { ...form, designNotes: form.designNotes },
        total,
      }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) return setStatus(data.error || "Error al guardar");
    setOrderNumber(data.orderNumber);
    setStatus("¡Pedido " + data.orderNumber + " confirmado!");
  }

  function printTicket() {
    window.print();
  }

  function closeWizard() {
    setOpen(false);
    setStep(0);
    setStatus("");
    setOrderNumber("");
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
  const rows = [
    ["No. pedido", orderNumber || "(se asigna al confirmar)"],
    ["Cliente", form.name],
    ["Teléfono", form.phone],
    ["Email", form.email],
    ["Entrega", form.deliveryType],
    ["Dirección", form.deliveryAddress || form.address || "—"],
    ["Fecha", form.deliveryDate],
    ["Hora", form.deliveryTime],
    ["Tamaño", form.size],
    ["Sabor del pastel", form.cakeFlavor],
    ["Relleno", form.fillingFlavor],
    ["Capas", form.fillingCount],
    ["Diseño", form.designLabel || (form.uploadPreview ? "Diseño propio" : "—")],
    ["Descripción del kake", form.designNotes || "—"],
    ["Total", "$" + total.toFixed(2)],
  ];

  return (
    <main className="wrap">
      <div className="card no-print">
        <h2>Arma tu kake</h2>
        <p className="note">Cada paso es una pantalla. El precio se actualiza con cada elección.</p>
        <button className="btn" onClick={() => setOpen(true)}>Continuar personalización</button>
      </div>
      {open && (
        <div className="modal-bg">
          <div className="modal">
            <div>
              <p className="note no-print">Paso {step + 1} de {STEPS.length}</p>
              <h2 className="no-print">{current.title}</h2>
              {current.id === "cliente" && (
                <>
                  <label>Nombre *</label><input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                  <label>Teléfono *</label><input required value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                  <label>Email *</label><input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                  <label>Dirección (opcional)</label><input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
                </>
              )}
              {current.id === "fecha" && (
                <>
                  <label>Fecha de entrega (predeterminada: mañana) *</label>
                  <input type="date" min={tomorrowISO()} value={form.deliveryDate} onChange={(e) => setForm({ ...form, deliveryDate: e.target.value })} />
                </>
              )}
              {current.id === "hora" && (
                <>
                  <label>Hora de entrega *</label>
                  <input type="time" value={form.deliveryTime} onChange={(e) => setForm({ ...form, deliveryTime: e.target.value })} />
                </>
              )}
              {current.id === "envio" && (
                <>
                  <Options category="delivery" field="deliveryType" />
                  {form.deliveryType?.toLowerCase().includes("env") ? (
                    <>
                      <label>Dirección detallada de envío *</label>
                      <textarea rows={3} value={form.deliveryAddress} onChange={(e) => setForm({ ...form, deliveryAddress: e.target.value })} />
                    </>
                  ) : <p className="note">Si eliges recogida, pasa al siguiente paso.</p>}
                </>
              )}
              {current.id === "size" && <Options category="size" field="size" />}
              {current.id === "sabor" && <Options category="cake_flavor" field="cakeFlavor" />}
              {current.id === "relleno" && <Options category="filling" field="fillingFlavor" />}
              {current.id === "capas" && (
                <>
                  <p className="note">Elige cuántas capas de relleno lleva tu kake. Cada foto muestra 2 o 3 rellenos.</p>
                  <Options category="filling_count" field="fillingCount" />
                </>
              )}
              {current.id === "diseno" && (
                <>
                  <p className="note">Elige un diseño, descríbelo o sube una foto. Inspiración: <a href={IMAGES.instagram} target="_blank">Instagram</a></p>
                  <Options extra={(catalog.designs || []).map((d) => ({ ...d, image: d.image || d.image_url }))} field="designLabel" />
                  <label>Describe cómo quieres tu kake</label>
                  <textarea rows={4} placeholder="Colores, frase, personaje, flores, número de velas..." value={form.designNotes} onChange={(e) => setForm({ ...form, designNotes: e.target.value })} />
                  <label>O sube una imagen de referencia</label>
                  <input type="file" accept="image/*" onChange={onUpload} />
                  {form.uploadPreview && <img src={form.uploadPreview} alt="Tu referencia" style={{ maxWidth: "220px", marginTop: 10, borderRadius: 16 }} />}
                  <label>O pega la URL de una imagen</label>
                  <input placeholder="https://..." value={form.uploadPreview?.startsWith("http") ? form.uploadPreview : ""} onChange={(e) => setForm({ ...form, uploadPreview: e.target.value, designImage: e.target.value, designLabel: form.designLabel || "Diseño propio" })} />
                </>
              )}
              {current.id === "resumen" && (
                <div>
                  <div id="ticket" className="ticket">
                    <h2>Karla's Bake</h2>
                    <p className="ticket-no">{orderNumber || "Pedido pendiente de confirmar"}</p>
                    <p>Ticket de pedido</p>
                    <table className="table">
                      <tbody>
                        {rows.map(([k, v]) => (
                          <tr key={k}><th>{k}</th><td>{String(v || "—")}</td></tr>
                        ))}
                      </tbody>
                    </table>
                    {previewImg && <img src={previewImg} alt="Diseño" style={{ maxWidth: "240px", margin: "12px 0", borderRadius: 16 }} />}
                  </div>
                  {!orderNumber && (
                    <button className="btn no-print" disabled={saving} onClick={submit}>
                      {saving ? "Enviando..." : "Confirmar opciones y realizar pedido"}
                    </button>
                  )}
                  {orderNumber && (
                    <div className="row no-print">
                      <button className="btn" onClick={printTicket}>Descargar / imprimir pedido</button>
                      <button className="btn ghost" onClick={closeWizard}>Cerrar ventana</button>
                    </div>
                  )}
                </div>
              )}
              {status && <p className="note no-print">{status}</p>}
              {!orderNumber && (
                <div className="row no-print">
                  <button className="btn ghost" onClick={() => step === 0 ? setOpen(false) : setStep(step - 1)}>Atrás</button>
                  {step < STEPS.length - 1 && <button className="btn" onClick={next}>Siguiente</button>}
                </div>
              )}
            </div>
            <aside className="preview no-print">
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
