"use client";
import { useEffect, useMemo, useState } from "react";
import { defaultCatalog, IMAGES } from "@/lib/defaults";
import Logo from "@/components/Logo";
import { useI18n } from "@/components/LanguageProvider";
import { translateLabel } from "@/lib/i18n";
import { fileToDataUrl } from "@/lib/image";

// Fecha local (no UTC): evita que de noche "mañana" salga como pasado mañana.
function localISO(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function prettyDate(iso, lang) {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(lang === "en" ? "en-US" : "es-US", { weekday: "long", day: "numeric", month: "long" });
}
function prettyTime(hhmm, lang) {
  if (!hhmm) return "";
  const [h, m] = hhmm.split(":").map(Number);
  return new Date(2000, 0, 1, h, m).toLocaleTimeString(lang === "en" ? "en-US" : "es-US", { hour: "numeric", minute: "2-digit" });
}

const isShipping =(label) => /env[ií]o|domicilio|delivery/i.test(label || "");
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const money = (n) => "$" + Number(n || 0).toFixed(2);

function OptionGrid({ items, selected, onPick, L }) {
  const { t } = useI18n();
  return (
    <div className="grid" role="radiogroup">
      {items.map((o) => {
        const isOn = selected === o.label;
        const img = o.image || o.image_url;
        return (
          <button type="button" role="radio" aria-checked={isOn} key={o.id || o.label}
            className={"opt" + (isOn ? " selected" : "")} onClick={() => onPick(o)}>
            {img && <img src={img} alt="" loading="lazy" />}
            <span className="meta">
              <strong>{L(o.label)}</strong>
              <span className="price">{Number(o.price) > 0 ? "+ " + money(o.price) : t.included}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

const EMPTY = {
  name: "", phone: "", email: "", address: "", smsOptIn: false,
  deliveryDate: localISO(1), deliveryTime: "15:00",
  deliveryType: "", deliveryAddress: "",
  size: "", cakeFlavor: "", fillingFlavor: "", fillingCount: "",
  designId: null, designLabel: "", designImage: "", designPrice: 0, uploadPreview: "", designNotes: "",
};

export default function PedidoPage() {
  const { lang, t } = useI18n();
  const [catalog, setCatalog] = useState(defaultCatalog);
  const [step, setStep] = useState(0);
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  useEffect(() => {
    fetch("/api/catalog").then((r) => r.json()).then((d) => {
      if (Array.isArray(d.options)) setCatalog({ options: d.options, designs: d.designs || [] });
    }).catch(() => {});
  }, []);

  const by = (cat) => (catalog.options || []).filter((o) => o.category === cat);
  const find = (cat, label) => by(cat).find((o) => o.label === label);
  const has = (cat) => by(cat).length > 0;
  const L = (label) => translateLabel(lang, label);

  const STEPS = useMemo(() => {
    const s = [{ id: "cliente" }, { id: "fecha" }, { id: "hora" }];
    if (has("delivery")) s.push({ id: "envio" });
    if (has("size")) s.push({ id: "size" });
    if (has("cake_flavor")) s.push({ id: "sabor" });
    if (has("filling")) s.push({ id: "relleno" });
    if (has("filling_count")) s.push({ id: "capas" });
    s.push({ id: "diseno" }, { id: "resumen" });
    return s;
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, catalog]);

  const previewImg = form.uploadPreview || form.designImage || find("size", form.size)?.image || IMAGES.hero;
  const current = STEPS[Math.min(step, STEPS.length - 1)];
  const goTo = (id) => { setStatus(""); setStep(Math.max(0, STEPS.findIndex((s) => s.id === id))); };

  function validate(id) {
    if (id === "cliente") {
      if (!form.name.trim() || !form.phone.trim() || !form.email.trim()) return t.needClient;
      if (!EMAIL_RE.test(form.email.trim())) return t.badEmail;
    }
    if (id === "fecha" && !form.deliveryDate) return t.needDate;
    if (id === "envio") {
      if (!form.deliveryType) return t.needDelivery;
      if (isShipping(form.deliveryType) && !(form.deliveryAddress || form.address).trim()) return t.needAddress;
    }
    if (id === "size" && !form.size) return t.needSize;
    if (id === "sabor" && !form.cakeFlavor) return t.needFlavor;
    if (id === "relleno" && !form.fillingFlavor) return t.needFilling;
    if (id === "diseno" && !form.designLabel && !form.designNotes.trim() && !form.uploadPreview) return t.needDesign;
    return "";
  }

  function next() {
    const err = validate(current.id);
    if (err) return setStatus(err);
    setStatus("");
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  function back() {
    setStatus("");
    if (step === 0) window.location.href = "/";
    else setStep(step - 1);
  }

  async function onUpload(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const url = await fileToDataUrl(file);
      set({ uploadPreview: url });
      setStatus("");
    } catch {
      setStatus(t.badPhoto);
    }
  }

  async function submit() {
    for (const s of STEPS) {
      const err = validate(s.id);
      if (err) { goTo(s.id); return setStatus(err); }
    }
    setSaving(true);
    setStatus("");
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lang,
          customer: { name: form.name, phone: form.phone, email: form.email, address: form.address, smsOptIn: form.smsOptIn },
          deliveryType: form.deliveryType,
          deliveryAddress: isShipping(form.deliveryType) ? form.deliveryAddress || form.address : "",
          deliveryDate: form.deliveryDate, deliveryTime: form.deliveryTime,
          size: form.size, cakeFlavor: form.cakeFlavor, fillingFlavor: form.fillingFlavor, fillingCount: form.fillingCount,
          designId: form.designId,
          designLabel: form.designLabel || (form.uploadPreview || form.designNotes ? t.ownDesign : ""),
          designNotes: form.designNotes,
          designImage: form.uploadPreview,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || t.errorGeneric);
      setDone({ orderNumber: data.orderNumber, total: data.total ?? total });
    } catch (err) {
      setStatus(err.message || t.errorGeneric);
    } finally {
      setSaving(false);
    }
  }

  const summary = [
    ["cliente", t.customer, `${form.name} · ${form.phone} · ${form.email}`],
    ["fecha", t.when, `${prettyDate(form.deliveryDate, lang)} · ${prettyTime(form.deliveryTime, lang)}`],
    has("delivery") && ["envio", t.mode, L(form.deliveryType)],
    has("delivery") && isShipping(form.deliveryType) && ["envio", t.address, form.deliveryAddress || form.address],
    has("size") && ["size", t.steps.size, L(form.size)],
    has("cake_flavor") && ["sabor", t.steps.sabor, L(form.cakeFlavor)],
    has("filling") && ["relleno", t.steps.relleno, L(form.fillingFlavor)],
    has("filling_count") && ["capas", t.steps.capas, L(form.fillingCount)],
    ["diseno", t.steps.diseno, form.designLabel || (form.uploadPreview ? t.ownDesign : t.noDesign)],
    form.designNotes && ["diseno", t.notes, form.designNotes],
    ["cliente", t.promotions, form.smsOptIn ? t.smsYes : t.smsNo],
  ].filter(Boolean);

  if (done) {
    return (
      <main className="wrap narrow">
        <div className="card done">
          <Logo size={72} />
          <h1 className="done-title">{t.doneTitle}</h1>
          <p className="note">{t.orderNo}</p>
          <p className="ticket-no">{done.orderNumber}</p>
          <p className="total">{t.total}: {money(done.total)}</p>
          <p>{t.doneBody}</p>
          <div className="row center">
            <a className="btn" href="/">{t.backHome}</a>
            <button className="btn ghost" onClick={() => { setForm(EMPTY); setStep(0); setDone(null); }}>{t.newOrder}</button>
          </div>
        </div>
      </main>
    );
  }

  const progress = Math.round(((step + 1) / STEPS.length) * 100);

  return (
    <main className="wrap">
      <div className="modal-bg">
        <div className="modal">
          <div className="modal-main">
            <div className="modal-head">
              <Logo size={48} />
              <div style={{ flex: 1 }}>
                <p className="note">{t.stepOf} {step + 1} {t.of} {STEPS.length}</p>
                <h2 style={{ margin: 0 }}>{current.id === "resumen" ? t.summaryTitle : t.steps[current.id]}</h2>
                <div className="progress" aria-hidden="true"><span style={{ width: progress + "%" }} /></div>
              </div>
            </div>

            {current.id === "cliente" && (
              <>
                <label htmlFor="f-name">{t.name} *</label>
                <input id="f-name" autoComplete="name" value={form.name} onChange={(e) => set({ name: e.target.value })} />
                <label htmlFor="f-phone">{t.phone} *</label>
                <input id="f-phone" type="tel" autoComplete="tel" inputMode="tel" value={form.phone} onChange={(e) => set({ phone: e.target.value })} />
                <label htmlFor="f-email">{t.email} *</label>
                <input id="f-email" type="email" autoComplete="email" value={form.email} onChange={(e) => set({ email: e.target.value })} />
                <label htmlFor="f-addr">{t.addressOptional}</label>
                <input id="f-addr" autoComplete="street-address" value={form.address} onChange={(e) => set({ address: e.target.value })} />
                <label className="check">
                  <input type="checkbox" checked={form.smsOptIn} onChange={(e) => set({ smsOptIn: e.target.checked })} />
                  {t.smsOpt}
                </label>
              </>
            )}
            {current.id === "fecha" && (
              <input type="date" aria-label={t.steps.fecha} min={localISO(1)} value={form.deliveryDate} onChange={(e) => set({ deliveryDate: e.target.value })} />
            )}
            {current.id === "hora" && (
              <input type="time" aria-label={t.steps.hora} step={900} value={form.deliveryTime} onChange={(e) => set({ deliveryTime: e.target.value })} />
            )}
            {current.id === "envio" && (
              <>
                <OptionGrid items={by("delivery")} selected={form.deliveryType} L={L} onPick={(o) => set({ deliveryType: o.label })} />
                {isShipping(form.deliveryType) && (
                  <>
                    <label htmlFor="f-ship">{t.shipAddress} *</label>
                    <input id="f-ship" autoComplete="street-address" value={form.deliveryAddress || form.address}
                      onChange={(e) => set({ deliveryAddress: e.target.value })} />
                  </>
                )}
              </>
            )}
            {current.id === "size" && <OptionGrid items={by("size")} selected={form.size} L={L} onPick={(o) => set({ size: o.label })} />}
            {current.id === "sabor" && <OptionGrid items={by("cake_flavor")} selected={form.cakeFlavor} L={L} onPick={(o) => set({ cakeFlavor: o.label })} />}
            {current.id === "relleno" && <OptionGrid items={by("filling")} selected={form.fillingFlavor} L={L} onPick={(o) => set({ fillingFlavor: o.label })} />}
            {current.id === "capas" && <OptionGrid items={by("filling_count")} selected={form.fillingCount} L={L} onPick={(o) => set({ fillingCount: o.label })} />}
            {current.id === "diseno" && (
              <>
                <p className="note">{t.designHint}</p>
                <OptionGrid
                  items={catalog.designs || []}
                  selected={form.designLabel}
                  L={L}
                  onPick={(d) => form.designId === d.id
                    ? set({ designId: null, designLabel: "", designImage: "", designPrice: 0 })
                    : set({ designId: d.id, designLabel: d.label, designImage: d.image || d.image_url, designPrice: Number(d.price || 0) })}
                />
                <label htmlFor="f-photo">{t.uploadPhoto}</label>
                <input id="f-photo" type="file" accept="image/*" onChange={onUpload} />
                {form.uploadPreview && (
                  <div className="thumb">
                    <img src={form.uploadPreview} alt="" />
                    <button type="button" className="btn ghost small" onClick={() => set({ uploadPreview: "" })}>{t.removePhoto}</button>
                  </div>
                )}
                <label htmlFor="f-notes">{t.describe}</label>
                <textarea id="f-notes" rows={3} value={form.designNotes} onChange={(e) => set({ designNotes: e.target.value })} />
              </>
            )}
            {current.id === "resumen" && (
              <>
                <dl className="summary">
                  {summary.map(([id, k, v], i) => (
                    <div key={i}>
                      <dt>{k}</dt>
                      <dd>{v || "—"}</dd>
                      <button type="button" className="link" onClick={() => goTo(id)}>{t.edit}</button>
                    </div>
                  ))}
                </dl>
                <p className="note">{t.priceNote}</p>
                <button className="btn wide" disabled={saving} onClick={submit}>
                  {saving ? t.saving : `${t.confirm} · ${money(total)}`}
                </button>
              </>
            )}

            {status && <p className="alert" role="alert">{status}</p>}
            <div className="row">
              <button className="btn ghost" onClick={back} disabled={saving}>{t.back}</button>
              {current.id !== "resumen" && <button className="btn" onClick={next}>{t.next}</button>}
            </div>
          </div>
          <aside className="preview">
            <img src={previewImg} alt="" />
            <p className="note" style={{ margin: "10px 0 2px" }}>{t.total}</p>
            <div className="total">{money(total)}</div>
          </aside>
        </div>
      </div>
    </main>
  );
}
