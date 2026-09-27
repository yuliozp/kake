"use client";
import { useEffect, useMemo, useState } from "react";
import { defaultCatalog, IMAGES } from "@/lib/defaults";

function tomorrowISO() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

const DELIVERY_NOTE = "Para solicitar env\u00edo consulte el costo seg\u00fan la distancia.";

const STEPS = [
  { id: "cliente", title: "Tus datos" },
  { id: "fecha", title: "Fecha de entrega" },
  { id: "hora", title: "Hora de entrega" },
  { id: "envio", title: "Entrega" },
  { id: "size", title: "Tama\u00f1o" },
  { id: "sabor", title: "Sabor del pastel" },
  { id: "relleno", title: "Sabor del relleno" },
  { id: "diseno", title: "Dise\u00f1o favorito" },
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
    deliveryType: DELIVERY_NOTE,
    deliveryAddress: "",
    size: "", cakeFlavor: "", fillingFlavor: "",
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
    t += Number(form.designPrice || 0);
    return t;
  }, [form, catalog]);

  const previewImg = form.designImage || form.uploadPreview || find("size", form.size)?.image || find("cake_flavor", form.cakeFlavor)?.image || IMAGES.hero;

  function next() {
    if (step === 0 && (!form.name || !form.phone || !form.email)) return setStatus("Completa nombre, tel\u00e9fono y email.");
    if (step === 4 && !form.size) return setStatus("Elige un tama\u00f1o.");
    if (step === 5 && !form.cakeFlavor) return setStatus("Elige el sabor del pastel.");
    if (step === 6 && !form.fillingFlavor) return setStatus("Elige el sabor del relleno.");
    if (step === 7 && !form.designLabel && !form.designNotes && !form.uploadPreview) return setStatus("Elige un dise\u00f1o, descr\u00edbelo o sube una foto.");
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
        designLabel: f.designLabel || "Dise\u00f1o propio",
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
        deliveryType: DELIVERY_NOTE,
        deliveryAddress: form.deliveryAddress || form.address || "",
        deliveryDate: form.deliveryDate,
        deliveryTime: form.deliveryTime,
        size: form.size,
        cakeFlavor: form.cakeFlavor,
        fillingFlavor: form.fillingFlavor,
        fillingCount: 2,
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
    setStatus("\u00a1Pedido " + data.orderNumber + " confirmado!");
  }

  function printTicket() { window.print(); }
  function closeWizard() { setOpen(false); setStep(0); setStatus(""); setOrderNumber(""); }

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
    ["Tel\u00e9fono", form.phone],
    ["Email", form.email],
    ["Entrega", DELIVERY_NOTE],
    ["Direcci\u00f3n", form.address || form.deliveryAddress || "\u2014"],
    ["Fecha", form.deliveryDate],
    ["Hora", form.deliveryTime],
    ["Tama\u00f1o", form.size],
    ["Sabor del pastel", form.cakeFlavor],
    ["Relleno", form.fillingFlavor],
    ["Dise\u00f1o", form.designLabel || (form.uploadPreview ? "Dise\u00f1o propio" : "\u2014")],
    ["Descripci\u00f3n del kake", form.designNotes || "\u2014"],
    ["Total", "$" + total.toFixed(2)],
  ];

  return (
    <main className="wrap">
      <div className="card no-print">
        <h2>Arma tu kake</h2>
        <p className="note">Cada paso es una pantalla. El precio se actualiza con cada elecci\u00f3n.</p>
        <button className="btn" onClick={() => setOpen(true)}>Continuar personalizaci\u00f3n</button>
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
                  <label>Tel\u00e9fono *</label><input required value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                  <label>Email *</label><input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                  <label>Direcci\u00f3n (opcional)</label><input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
                </>
              )}
              {current.id === "fecha" && (
                <>
                  <label>Fecha de entrega (predeterminada: ma\u00f1ana) *</label>
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
                <div className="card" style={{ boxShadow: "none", border: "2px solid #ffd0de" }}>
                  <p style={{ fontSize: 18, margin: 0 }}>{DELIVERY_NOTE}</p>
                  <p className="note">El total del pastel no incluye domicilio. Si lo necesitas, escr\u00edbenos para cotizarlo.</p>
                </div>
              )}
              {current.id === "size" && <Options category="size" field="size" />}
              {current.id === "sabor" && <Options category="cake_flavor" field="cakeFlavor" />}
              {current.id === "relleno" && <Options category="filling" field="fillingFlavor" />}
              {current.id === "diseno" && (
                <>
                  <p className="note">Elige un dise\u00f1o, descr\u00edbelo o sube una foto. Inspiraci\u00f3n: <a href={IMAGES.instagram} target="_blank">Instagram</a></p>
                  <Options extra={(catalog.designs || []).map((d) => ({ ...d, image: d.image || d.image_url }))} field="designLabel" />
                  <label>Describe c\u00f3mo quieres tu kake</label>
                  <textarea rows={4} placeholder="Colores, frase, personaje, flores, n\u00famero de velas..." value={form.designNotes} onChange={(e) => setForm({ ...form, designNotes: e.target.value })} />
                  <label>O sube una imagen de referencia</label>
                  <input type="file" accept="image/*" onChange={onUpload} />
                  {form.uploadPreview && <img src={form.uploadPreview} alt="Tu referencia" style={{ maxWidth: "220px", marginTop: 10, borderRadius: 16 }} />}
                  <label>O pega la URL de una imagen</label>
                  <input placeholder="https://..." value={form.uploadPreview?.startsWith("http") ? form.uploadPreview : ""} onChange={(e) => setForm({ ...form, uploadPreview: e.target.value, designImage: e.target.value, designLabel: form.designLabel || "Dise\u00f1o propio" })} />
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
                          <tr key={k}><th>{k}</th><td>{String(v || "\u2014")}</td></tr>
                        ))}
                      </tbody>
                    </table>
                    {previewImg && <img src={previewImg} alt="Dise\u00f1o" style={{ maxWidth: "240px", margin: "12px 0", borderRadius: 16 }} />}
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
                  <button className="btn ghost" onClick={() => step === 0 ? setOpen(false) : setStep(step - 1)}>Atr\u00e1s</button>
                  {step < STEPS.length - 1 && <button className="btn" onClick={next}>Siguiente</button>}
                </div>
              )}
            </div>
            <aside className="preview no-print">
              <img src={previewImg} alt="Vista previa" />
              <div className="total">${total.toFixed(2)}</div>
              <ul>
                <li>Medida: {form.size || "\u2014"}</li>
                <li>Sabor: {form.cakeFlavor || "\u2014"}</li>
                <li>Relleno: {form.fillingFlavor || "\u2014"}</li>
                <li>Dise\u00f1o: {form.designLabel || "\u2014"}</li>
                <li>{DELIVERY_NOTE}</li>
              </ul>
            </aside>
          </div>
        </div>
      )}
    </main>
  );
}
