"use client";
import { useEffect, useMemo, useState } from "react";
import { defaultCatalog, IMAGES } from "@/lib/defaults";
import Logo from "@/components/Logo";
import { useI18n } from "@/components/LanguageProvider";
import { translateLabel } from "@/lib/i18n";

function tomorrowISO() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

export default function PedidoPage() {
  const { lang, t } = useI18n();
  const [catalog, setCatalog] = useState(defaultCatalog);
  const [step, setStep] = useState(0);
  const [open, setOpen] = useState(true);
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);
  const [orderNumber, setOrderNumber] = useState("");
  const [form, setForm] = useState({
    name: "", phone: "", email: "", address: "", smsOptIn: false,
    deliveryDate: tomorrowISO(), deliveryTime: "15:00",
    deliveryType: "", deliveryAddress: "",
    size: "", cakeFlavor: "", fillingFlavor: "", fillingCount: "",
    designLabel: "", designImage: "", designPrice: 0, uploadPreview: "", designNotes: "",
  });

  useEffect(() => {
    fetch("/api/catalog").then((r) => r.json()).then((d) => {
      if (d.options) setCatalog({ options: d.options, designs: d.designs || [] });
    }).catch(() => {});
  }, []);

  const by = (cat) => (catalog.options || []).filter((o) => o.category === cat);
  const find = (cat, label) => by(cat).find((o) => o.label === label);
  const has = (cat) => by(cat).length > 0;
  const L = (label) => translateLabel(lang, label);

  const STEPS = useMemo(() => {
    const s = [
      { id: "cliente" }, { id: "fecha" }, { id: "hora" },
    ];
    if (has("delivery")) s.push({ id: "envio" });
    if (has("size")) s.push({ id: "size" });
    if (has("cake_flavor")) s.push({ id: "sabor" });
    if (has("filling")) s.push({ id: "relleno" });
    if (has("filling_count")) s.push({ id: "capas" });
    s.push({ id: "diseno" }, { id: "resumen" });
    return s;
  }, [catalog]);

  const total = useMemo(() => {
    let n = 0;
    const add = (cat, label) => { const o = find(cat, label); if (o) n += Number(o.price || 0); };
    add("size", form.size);
    add("cake_flavor", form.cakeFlavor);
    add("filling", form.fillingFlavor);
    add("filling_count", form.fillingCount);
    add("delivery", form.deliveryType);
    n += Number(form.designPrice || 0);
    return n;
  }, [form, catalog]);

  const previewImg = form.designImage || form.uploadPreview || find("size", form.size)?.image || IMAGES.hero;
  const current = STEPS[step] || STEPS[0];

  function next() {
    if (current.id === "cliente" && (!form.name || !form.phone || !form.email)) return setStatus(t.needClient);
    if (current.id === "size" && !form.size) return setStatus(t.needSize);
    if (current.id === "sabor" && !form.cakeFlavor) return setStatus(t.needFlavor);
    if (current.id === "relleno" && !form.fillingFlavor) return setStatus(t.needFilling);
    if (current.id === "diseno" && !form.designLabel && !form.designNotes && !form.uploadPreview) return setStatus(t.needDesign);
    setStatus("");
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  function onUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setForm((f) => ({ ...f, uploadPreview: reader.result, designImage: reader.result, designLabel: f.designLabel || t.ownDesign }));
    reader.readAsDataURL(file);
  }

  async function submit() {
    setSaving(true);
    const res = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customer: { name: form.name, phone: form.phone, email: form.email, address: form.address, smsOptIn: form.smsOptIn },
        deliveryType: form.deliveryType,
        deliveryAddress: form.deliveryAddress || form.address || "",
        deliveryDate: form.deliveryDate, deliveryTime: form.deliveryTime,
        size: form.size, cakeFlavor: form.cakeFlavor, fillingFlavor: form.fillingFlavor,
        fillingCount: form.fillingCount?.startsWith("3") ? 3 : 2,
        designLabel: form.designLabel || t.ownDesign,
        designImage: form.designImage || form.uploadPreview,
        selections: form, total,
      }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) return setStatus(data.error || "Error");
    setOrderNumber(data.orderNumber);
    setStatus(t.saved + " " + data.orderNumber);
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
              {(o.image || o.image_url) && <img src={o.image || o.image_url} alt={L(o.label)} />}
              <div className="meta"><strong>{L(o.label)}</strong><div className="price">+ ${Number(o.price || 0).toFixed(2)}</div></div>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <main className="wrap">
      <div className="card no-print"><Logo /><h2>{t.wizardTitle}</h2></div>
      {open && (
        <div className="modal-bg">
          <div className="modal">
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Logo size={48} />
                <div>
                  <p className="note no-print">{t.stepOf} {step + 1} {t.of} {STEPS.length}</p>
                  <h2 className="no-print" style={{ margin: 0 }}>{t.steps[current.id]}</h2>
                </div>
              </div>
              {current.id === "cliente" && (
                <>
                  <label>{t.name} *</label><input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                  <label>{t.phone} *</label><input required value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                  <label>{t.email} *</label><input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                  <label>{t.addressOptional}</label><input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
                  <label style={{ display: "flex", gap: 8, alignItems: "center", fontWeight: 600 }}>
                    <input type="checkbox" style={{ width: "auto" }} checked={form.smsOptIn} onChange={(e) => setForm({ ...form, smsOptIn: e.target.checked })} />
                    {t.smsOpt}
                  </label>
                </>
              )}
              {current.id === "fecha" && <input type="date" min={tomorrowISO()} value={form.deliveryDate} onChange={(e) => setForm({ ...form, deliveryDate: e.target.value })} />}
              {current.id === "hora" && <input type="time" value={form.deliveryTime} onChange={(e) => setForm({ ...form, deliveryTime: e.target.value })} />}
              {current.id === "envio" && <Options category="delivery" field="deliveryType" />}
              {current.id === "size" && <Options category="size" field="size" />}
              {current.id === "sabor" && <Options category="cake_flavor" field="cakeFlavor" />}
              {current.id === "relleno" && <Options category="filling" field="fillingFlavor" />}
              {current.id === "capas" && <Options category="filling_count" field="fillingCount" />}
              {current.id === "diseno" && (
                <>
                  <p className="note">{t.designHint}</p>
                  <Options extra={(catalog.designs || []).map((d) => ({ ...d, image: d.image || d.image_url }))} field="designLabel" />
                  <label>{t.uploadPhoto}</label>
                  <input type="file" accept="image/*" onChange={onUpload} />
                  {form.uploadPreview && <img src={form.uploadPreview} alt="" style={{ maxWidth: 220, borderRadius: 16 }} />}
                  <textarea rows={3} placeholder={t.describe} value={form.designNotes} onChange={(e) => setForm({ ...form, designNotes: e.target.value })} />
                </>
              )}
              {current.id === "resumen" && (
                <div>
                  <p>{t.promotions}: {form.smsOptIn ? t.smsYes : t.smsNo}</p>
                  {!orderNumber && <button className="btn" disabled={saving} onClick={submit}>{saving ? t.saving : t.confirm}</button>}
                  {orderNumber && <p>{t.saved} {orderNumber}</p>}
                </div>
              )}
              {status && <p className="note">{status}</p>}
              {!orderNumber && (
                <div className="row">
                  <button className="btn ghost" onClick={() => step === 0 ? setOpen(false) : setStep(step - 1)}>{t.back}</button>
                  {step < STEPS.length - 1 && <button className="btn" onClick={next}>{t.next}</button>}
                </div>
              )}
            </div>
            <aside className="preview no-print">
              <img src={previewImg} alt="" />
              <div className="total">${total.toFixed(2)}</div>
            </aside>
          </div>
        </div>
      )}
    </main>
  );
}
