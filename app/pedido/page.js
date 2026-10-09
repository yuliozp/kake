"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { defaultCatalog, IMAGES } from "@/lib/defaults";
import Logo from "@/components/Logo";
import { useI18n } from "@/components/LanguageProvider";
import { translateLabel, trFact } from "@/lib/i18n";
import { CakeCardBody, CakeFilter, cakeGroup } from "@/components/CakeCatalog";
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

const MIN_DAYS = 3;       // primera fecha: dentro de 3 días (hoy viernes → lunes)
const MIN_TIME = "10:00"; // desde las 10:00 a. m.
const MAX_PHOTOS = 4;

const isShipping = (label) => /env[ií]o|domicilio|delivery/i.test(label || "");
const depositFor = (n) => (Number(n) > 0 ? Math.ceil(Number(n) / 2 / 5) * 5 : 0);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const money = (n) => "$" + Number(n || 0).toFixed(2);

function OptionGrid({ items, selected, onPick, L, note }) {
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
              {note && <span className="hint">{note}</span>}
              <span className="price">{o.price_on_request ? t.priceTbd : Number(o.price) > 0 ? "+ " + money(o.price) : t.included}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

// Pasteles del catálogo para elegir, con filtro por tamaño cuando son muchos.
function CakeGrid({ cakes, selectedId, custom, showCustom, onPick, onCustom }) {
  const { t } = useI18n();
  const [group, setGroup] = useState("");
  const shown = group ? cakes.filter((c) => cakeGroup(c) === group) : cakes;
  // Si ya hay un pastel elegido (viene del catálogo o volvió a este paso), se lleva a la vista.
  useEffect(() => {
    document.querySelector(".cake-card.selected")?.scrollIntoView({ block: "center" });
  }, []);
  return (
    <>
      <CakeFilter cakes={cakes} value={group} onChange={setGroup} />
      <div className="cake-grid" role="radiogroup" aria-label={t.cakePick}>
        {showCustom && (
          <button type="button" role="radio" aria-checked={custom} className={"cake-card custom" + (custom ? " selected" : "")} onClick={onCustom}>
            <span className="cake-body">
              <span className="cake-top"><strong>{t.customTitle}</strong></span>
              <span className="cake-desc">{t.customDesc}</span>
              <span className="cake-free">{t.customPrice}</span>
            </span>
          </button>
        )}
        {shown.map((c) => {
          const isOn = selectedId === c.id;
          return (
            <button type="button" role="radio" aria-checked={isOn} key={c.id} className={"cake-card" + (isOn ? " selected" : "")} onClick={() => onPick(c)}>
              <CakeCardBody cake={c} />
            </button>
          );
        })}
      </div>
    </>
  );
}

// Las personalizaciones con una sola opción quedan elegidas de una vez.
function singleChoices(c) {
  const pre = {};
  (c.options || []).forEach((g) => { if (g.choices.length === 1) pre[g.name] = g.choices[0]; });
  return pre;
}

const EMPTY = {
  cakeId: null, custom: false, cakeOptions: {}, cakeNotes: "",
  name: "", phone: "", email: "", address: "", smsOptIn: false,
  deliveryDate: localISO(MIN_DAYS), deliveryTime: MIN_TIME,
  deliveryType: "", deliveryAddress: "",
  size: "", cakeFlavor: "", fillingFlavor: "", fillingCount: "",
  designId: null, designLabel: "", designImage: "", designPrice: 0, uploadPreview: "", designNotes: "",
  decorationLabel: "", decorationNotes: "", decorationPhotos: [],
};

export default function PedidoPage() {
  const { lang, t } = useI18n();
  const [catalog, setCatalog] = useState(defaultCatalog);
  const [step, setStep] = useState(0);
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(null);
  const [form, setForm] = useState(EMPTY);
  // Identificador único del intento: si el cliente reenvía, no se duplica el pedido.
  const [clientRef, setClientRef] = useState("");
  const [website, setWebsite] = useState(""); // campo trampa anti-bots
  const [redirecting, setRedirecting] = useState(false);
  const [loaded, setLoaded] = useState(false); // el catálogo decide por qué paso se empieza
  const [leaving, setLeaving] = useState(false);
  const leaveRef = useRef(null);
  const headingRef = useRef(null);
  const firstRender = useRef(true);
  const newRef = () => (globalThis.crypto?.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(36).slice(2));
  useEffect(() => { setClientRef(newRef()); }, []);
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  useEffect(() => {
    fetch("/api/catalog").then((r) => r.json()).then((d) => {
      if (Array.isArray(d.options)) setCatalog({ options: d.options, designs: d.designs || [], cakes: d.cakes || [], customCake: d.customCake !== false });
      // Viene de la página del catálogo con un pastel ya elegido (/pedido?pastel=12).
      const qs = new URLSearchParams(window.location.search);
      const wanted = Number(qs.get("pastel"));
      const pre = (d.cakes || []).find((c) => c.id === wanted);
      if (pre) setForm((f) => ({ ...f, cakeId: pre.id, custom: false, cakeOptions: singleChoices(pre) }));
      else if (qs.get("medida") === "1") setForm((f) => ({ ...f, cakeId: null, custom: true }));
    }).catch(() => {}).finally(() => setLoaded(true));
  }, []);

  const by = (cat) => (catalog.options || []).filter((o) => o.category === cat);
  const find = (cat, label) => by(cat).find((o) => o.label === label);
  const has = (cat) => by(cat).length > 0;
  const L = (label) => translateLabel(lang, label);

  const cakes = catalog.cakes || [];
  const hasCakes = cakes.length > 0;
  const cake = cakes.find((c) => c.id === form.cakeId) || null;
  // "A tu medida": cuando el cliente lo elige, o cuando todavía no hay pasteles en el catálogo.
  const customMode = !hasCakes || (form.custom && !cake);

  // Orden: datos del cliente → pastel del catálogo → personalización → recogida o entrega → confirmar.
  const STEPS = useMemo(() => {
    const s = [{ id: "cliente" }];
    if (hasCakes) s.push({ id: "pastel" });
    if (customMode) {
      if (has("size")) s.push({ id: "size" });
      if (has("cake_flavor")) s.push({ id: "sabor" });
      if (has("filling")) s.push({ id: "relleno" });
      if (has("filling_count")) s.push({ id: "capas" });
      s.push({ id: "diseno" });
      if (has("decoration")) s.push({ id: "decoracion" });
    } else {
      s.push({ id: "personaliza" });
    }
    s.push({ id: "envio" }, { id: "resumen" });
    return s;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalog, customMode]);

  // Total conocido + lo que queda "por confirmar" (decoración premium, envío a domicilio).
  const { total, pending } = useMemo(() => {
    let n = 0;
    const pend = [];
    const add = (cat, label) => {
      const o = find(cat, label);
      if (!o) return;
      if (o.price_on_request) pend.push(L(o.label));
      else n += Number(o.price || 0);
    };
    add("delivery", form.deliveryType);
    if (customMode) {
      add("size", form.size);
      add("cake_flavor", form.cakeFlavor);
      add("filling", form.fillingFlavor);
      add("filling_count", form.fillingCount);
      add("decoration", form.decorationLabel);
      n += Number(form.designPrice || 0);
    } else if (cake) {
      n += Number(cake.price || 0);
    }
    return { total: n, pending: pend };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, catalog, lang, customMode]);
  const decoOption = find("decoration", form.decorationLabel);
  const isPremiumDeco = customMode && !!decoOption?.price_on_request;
  const totalText = pending.length ? `${money(total)} + ${t.toConfirm}` : money(total);
  // Pastel del catálogo sin envío: se confirma al instante y sigue el pago del anticipo.
  const instant = !customMode && !!cake && pending.length === 0 && total > 0;

  // Dirección de entrega: la que escribió en sus datos, salvo que ponga otra para este pedido.
  const shipAddress = form.deliveryAddress || form.address;
  const deposit = depositFor(total);

  const previewImg = (!customMode && cake?.image) || form.decorationPhotos[0] || form.uploadPreview || form.designImage || find("size", form.size)?.image || IMAGES.hero;
  const current = STEPS[Math.min(step, STEPS.length - 1)];

  // Al cambiar de paso, el foco va al título para que el lector de pantalla lo anuncie.
  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return; }
    headingRef.current?.focus();
  }, [step]);
  const goTo = (id) => { setStatus(""); setStep(Math.max(0, STEPS.findIndex((s) => s.id === id))); };

  function validate(id) {
    if (id === "cliente") {
      if (!form.name.trim() || !form.phone.trim() || !form.email.trim()) return t.needClient;
      if (!EMAIL_RE.test(form.email.trim())) return t.badEmail;
    }
    if (id === "pastel" && !cake && !(form.custom && catalog.customCake !== false)) return t.needCake;
    if (id === "personaliza") {
      if (!cake) return t.needCake;
      const missing = (cake.options || []).find((g) => !g.choices.includes(form.cakeOptions[g.name]));
      if (missing) return t.needOption.replace("{name}", missing.name);
    }
    if (id === "envio") {
      if (has("delivery") && !form.deliveryType) return t.needDelivery;
      if (isShipping(form.deliveryType) && shipAddress.trim().length < 6) return t.needAddress;
      if (!form.deliveryDate) return t.needDate;
      if (form.deliveryDate < localISO(MIN_DAYS)) return t.badDate2;
      if (!form.deliveryTime || form.deliveryTime < MIN_TIME) return t.badTime;
    }
    if (id === "size" && !form.size) return t.needSize;
    if (id === "sabor" && !form.cakeFlavor) return t.needFlavor;
    if (id === "relleno" && !form.fillingFlavor) return t.needFilling;
    if (id === "diseno" && !form.designLabel && !form.designNotes.trim() && !form.uploadPreview) return t.needDesign;
    if (id === "decoracion") {
      if (!form.decorationLabel) return t.needDeco;
      if (isPremiumDeco && !form.decorationPhotos.length && !form.decorationNotes.trim()) return t.needDecoPhotos;
    }
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
    if (step === 0) setLeaving(true); // salir del pedido: primero se pregunta
    else setStep(step - 1);
  }

  // Aviso antes de cerrar la ventana del pedido: se interrumpe y aún no está confirmado.
  useEffect(() => {
    const dlg = leaveRef.current;
    if (!dlg) return;
    if (leaving && !dlg.open) dlg.showModal();
    if (!leaving && dlg.open) dlg.close();
  }, [leaving]);
  function leave() {
    // Vuelve al catálogo si el cliente venía de ahí; si no, al inicio.
    window.location.href = new URLSearchParams(window.location.search).get("pastel") ? "/catalogo" : "/";
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

  async function onDecoUpload(e) {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (!files.length) return;
    const room = MAX_PHOTOS - form.decorationPhotos.length;
    if (room <= 0) return setStatus(t.maxPhotos);
    try {
      const urls = [];
      for (const f of files.slice(0, room)) urls.push(await fileToDataUrl(f, 1000, 0.78));
      setForm((f) => ({ ...f, decorationPhotos: [...f.decorationPhotos, ...urls] }));
      setStatus(files.length > room ? t.maxPhotos : "");
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
          lang, clientRef, website,
          customer: { name: form.name, phone: form.phone, email: form.email, address: form.address, smsOptIn: form.smsOptIn },
          deliveryType: form.deliveryType,
          deliveryAddress: isShipping(form.deliveryType) ? shipAddress : "",
          deliveryDate: form.deliveryDate, deliveryTime: form.deliveryTime,
          ...(customMode ? {
            size: form.size, cakeFlavor: form.cakeFlavor, fillingFlavor: form.fillingFlavor, fillingCount: form.fillingCount,
            designId: form.designId,
            designLabel: form.designLabel || (form.uploadPreview || form.designNotes ? t.ownDesign : ""),
            designNotes: form.designNotes,
            designImage: form.uploadPreview,
            decorationLabel: form.decorationLabel,
            decorationNotes: isPremiumDeco ? form.decorationNotes : "",
            decorationPhotos: isPremiumDeco ? form.decorationPhotos : [],
          } : {
            cakeId: cake.id, cakeOptions: form.cakeOptions, designNotes: form.cakeNotes, designImage: form.uploadPreview,
          }),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || t.errorGeneric);
      // Pedido confirmado al instante (recogida): se pasa directo a la página de pago del anticipo.
      if (data.confirmed && data.trackPath) {
        setStatus("");
        setRedirecting(true);
        let payUrl = "";
        if (data.id && data.t) {
          try {
            const pr = await fetch(`/api/pagar/${data.id}`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ t: data.t }),
            });
            const pj = await pr.json().catch(() => ({}));
            if (pr.ok && pj.url) payUrl = pj.url;
          } catch { /* sin pago en línea: se muestra el pedido confirmado */ }
        }
        // Si el pago en línea no está disponible, se muestra el pedido confirmado con sus instrucciones.
        window.location.assign(payUrl || data.trackPath + "&nuevo=1");
        return;
      }
      setDone({ orderNumber: data.orderNumber, total: data.total ?? total, pending: data.pending || [], deposit: data.deposit, trackPath: data.trackPath });
    } catch (err) {
      setStatus(err.message || t.errorGeneric);
    } finally {
      setSaving(false);
    }
  }

  const summary = (customMode ? [
    hasCakes && ["pastel", t.cake, t.customTitle],
    has("size") && ["size", t.steps.size, L(form.size)],
    has("cake_flavor") && ["sabor", t.steps.sabor, L(form.cakeFlavor)],
    has("filling") && ["relleno", t.steps.relleno, L(form.fillingFlavor)],
    has("filling_count") && ["capas", t.steps.capas, L(form.fillingCount)],
    ["diseno", t.steps.diseno, form.designLabel || (form.uploadPreview ? t.ownDesign : t.noDesign)],
    form.designNotes && ["diseno", t.notes, form.designNotes],
    has("decoration") && ["decoracion", t.steps.decoracion, L(form.decorationLabel) + (isPremiumDeco ? ` (${t.priceTbd})` : "")],
    isPremiumDeco && form.decorationNotes && ["decoracion", t.notes, form.decorationNotes],
    isPremiumDeco && form.decorationPhotos.length > 0 && ["decoracion", lang === "en" ? "Photos" : "Fotos", `${form.decorationPhotos.length}`],
  ] : [
    ["pastel", t.cake, cake ? `${L(cake.name)} · ${money(cake.price)}` : ""],
    ...(cake?.options || []).map((g) => ["personaliza", L(g.name), L(form.cakeOptions[g.name])]),
    form.cakeNotes && ["personaliza", t.notesShort, form.cakeNotes],
    form.uploadPreview && ["personaliza", t.refPhoto, t.photoAttached],
  ]).concat([
    has("delivery") && ["envio", t.mode, L(form.deliveryType) + (isShipping(form.deliveryType) && pending.length ? ` (${t.priceTbd})` : "")],
    has("delivery") && isShipping(form.deliveryType) && ["envio", t.address, shipAddress],
    ["envio", t.when, `${prettyDate(form.deliveryDate, lang)} · ${prettyTime(form.deliveryTime, lang)}`],
    ["cliente", t.customer, `${form.name} · ${form.phone} · ${form.email}`],
  ]).filter(Boolean);

  function pickCake(c) {
    set({ cakeId: c.id, custom: false, cakeOptions: form.cakeId === c.id ? form.cakeOptions : singleChoices(c) });
    setStatus("");
  }

  if (done) {
    return (
      <main id="contenido" className="wrap narrow">
        <div className="card done">
          <Logo size={72} />
          <h1 className="done-title">{t.doneTitle}</h1>
          <p className="note">{t.orderNo}</p>
          <p className="ticket-no">{done.orderNumber}</p>
          <p className="total">{t.total}: {done.pending.length ? `${money(done.total)} + ${t.toConfirm}` : money(done.total)}</p>
          {done.pending.length ? (
            <p>{t.doneBodyPending.replace("{items}", done.pending.map(L).join(", "))}</p>
          ) : (
            <p>{t.doneBodyDeposit} <strong>{money(done.deposit)}</strong>.</p>
          )}
          {done.trackPath && <p><a href={done.trackPath}>{t.trackOrder}</a></p>}
          <div className="row center">
            <a className="btn" href="/">{t.backHome}</a>
            <button className="btn ghost" onClick={() => { setForm(EMPTY); setStep(0); setDone(null); setClientRef(newRef()); }}>{t.newOrder}</button>
          </div>
        </div>
      </main>
    );
  }

  if (!loaded) {
    return <main id="contenido" className="wrap narrow"><p className="note" role="status">{lang === "en" ? "Loading…" : "Cargando…"}</p></main>;
  }

  const progress = Math.round(((step + 1) / STEPS.length) * 100);

  const stepNav = () => (
    <>
      {status && <p className="alert" role="alert">{status}</p>}
      <div className="row step-nav">
        <button className="btn ghost" onClick={back} disabled={saving}>{t.back}</button>
        {current.id !== "resumen" && <button className="btn" onClick={next}>{t.next}</button>}
      </div>
    </>
  );

  return (
    <main id="contenido" className="wrap">
      <div className="modal-bg">
        <div className="modal" role="dialog" aria-modal="true" aria-labelledby="step-title">
          <div className="modal-main">
            <div className="modal-head">
              <Logo size={48} />
              <div style={{ flex: 1 }}>
                <p className="note">{t.stepOf} {step + 1} {t.of} {STEPS.length}</p>
                <h2 id="step-title" ref={headingRef} tabIndex={-1} style={{ margin: 0 }}>{current.id === "resumen" ? t.summaryTitle : t.steps[current.id]}</h2>
                <div className="progress" aria-hidden="true"><span style={{ width: progress + "%" }} /></div>
              </div>
              <button type="button" className="modal-close" aria-label={t.closeOrder} title={t.closeOrder} onClick={() => setLeaving(true)} disabled={saving || redirecting}>
                <span aria-hidden="true">×</span>
              </button>
            </div>
            <dialog ref={leaveRef} className="leave-dialog" aria-labelledby="leave-title" aria-describedby="leave-text"
              onClose={() => setLeaving(false)} onCancel={() => setLeaving(false)}>
              <h3 id="leave-title">{t.leaveTitle}</h3>
              <p id="leave-text">{t.leaveBody}</p>
              <div className="row">
                <button type="button" className="btn ghost danger" onClick={leave}>{t.leaveYes}</button>
                <button type="button" className="btn" autoFocus onClick={() => setLeaving(false)}>{t.leaveNo}</button>
              </div>
            </dialog>
            {current.id === "cliente" && cake && (
              <p className="picked" role="status">{t.pickedCake}: <strong>{L(cake.name)}</strong> · {money(cake.price)}</p>
            )}

            {current.id === "cliente" && (
              <>
                <label htmlFor="f-name">{t.name} *</label>
                <input id="f-name" autoComplete="name" required aria-required="true" value={form.name} onChange={(e) => set({ name: e.target.value })} />
                <label htmlFor="f-phone">{t.phone} *</label>
                <input id="f-phone" type="tel" autoComplete="tel" inputMode="tel" value={form.phone} onChange={(e) => set({ phone: e.target.value })} />
                <label htmlFor="f-email">{t.email} *</label>
                <input id="f-email" type="email" autoComplete="email" value={form.email} onChange={(e) => set({ email: e.target.value })} />
                <label htmlFor="f-addr">{t.addressOptional}</label>
                <input id="f-addr" autoComplete="street-address" aria-describedby="f-addr-hint" value={form.address} onChange={(e) => set({ address: e.target.value })} />
                <p id="f-addr-hint" className="hint">{t.addressHint}</p>
                <label className="check">
                  <input type="checkbox" checked={form.smsOptIn} onChange={(e) => set({ smsOptIn: e.target.checked })} />
                  {t.smsOpt}
                </label>
                <div className="hp" aria-hidden="true">
                  <label htmlFor="f-website">Website</label>
                  <input id="f-website" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
                </div>
              </>
            )}
            {current.id === "pastel" && (
              <CakeGrid cakes={cakes} selectedId={cake?.id ?? null} custom={!cake && form.custom} showCustom={catalog.customCake !== false}
                onPick={pickCake} onCustom={() => { set({ cakeId: null, custom: true }); setStatus(""); }} />
            )}
            {current.id === "personaliza" && cake && (
              <>
                <p className="note" style={{ marginTop: 0 }}>
                  <strong>{L(cake.name)}</strong>
                  {[cake.size, cake.portions, cake.frosting].filter(Boolean).length > 0 && " · " + [trFact(lang, cake.size), trFact(lang, cake.portions), cake.frosting].filter(Boolean).join(" · ")}
                </p>
                {(cake.options || []).length > 0 ? <p className="free-tag">{t.freeCustom}</p> : <p>{t.noOptions}</p>}
                {(cake.options || []).map((g, gi) => (
                  <fieldset key={g.name} className="opt-group">
                    <legend>{L(g.name)} *</legend>
                    <div className="chips" role="radiogroup" aria-label={L(g.name)}>
                      {g.choices.map((c) => {
                        const on = form.cakeOptions[g.name] === c;
                        return (
                          <button type="button" role="radio" aria-checked={on} key={c} className={"chip big" + (on ? " on" : "")}
                            onClick={() => { setForm((f) => ({ ...f, cakeOptions: { ...f.cakeOptions, [g.name]: c } })); setStatus(""); }}>
                            {L(c)}
                          </button>
                        );
                      })}
                    </div>
                  </fieldset>
                ))}
                <label htmlFor="f-cake-notes">{t.cakeNotes}</label>
                <textarea id="f-cake-notes" rows={2} maxLength={1000} value={form.cakeNotes} onChange={(e) => set({ cakeNotes: e.target.value })} />
                <label htmlFor="f-ref-photo">{t.refPhotoLabel}</label>
                <input id="f-ref-photo" type="file" accept="image/*" onChange={onUpload} />
                {form.uploadPreview && (
                  <div className="thumb">
                    <img src={form.uploadPreview} alt="" />
                    <button type="button" className="btn ghost small" onClick={() => set({ uploadPreview: "" })}>{t.removePhoto}</button>
                  </div>
                )}
              </>
            )}
            {current.id === "envio" && (
              <>
                {has("delivery") && <OptionGrid items={by("delivery")} selected={form.deliveryType} L={L} onPick={(o) => { set({ deliveryType: o.label }); setStatus(""); }} />}
                {isShipping(form.deliveryType) && (
                  <>
                    <label htmlFor="f-ship">{t.shipAddress} *</label>
                    <input id="f-ship" autoComplete="street-address" required aria-required="true" value={shipAddress}
                      onChange={(e) => set({ deliveryAddress: e.target.value, ...(e.target.value ? {} : { address: "" }) })} />
                    {find("delivery", form.deliveryType)?.price_on_request && (
                      <p className="alert" style={{ background: "#fdf1dc", color: "#7a4d00" }}>{t.shipNote}</p>
                    )}
                  </>
                )}
                <div className="two-col">
                  <div>
                    <label htmlFor="f-date">{t.dateLabel} *</label>
                    <input id="f-date" type="date" min={localISO(MIN_DAYS)} value={form.deliveryDate} onChange={(e) => set({ deliveryDate: e.target.value })} />
                  </div>
                  <div>
                    <label htmlFor="f-time">{t.timeLabel} *</label>
                    <input id="f-time" type="time" step={900} min={MIN_TIME} value={form.deliveryTime} onChange={(e) => set({ deliveryTime: e.target.value })} />
                  </div>
                </div>
                <p className="hint">{t.badDate2} {t.badTime}</p>
              </>
            )}
            {current.id === "size" && <OptionGrid items={by("size")} selected={form.size} L={L} note={t.decoCustom} onPick={(o) => set({ size: o.label })} />}
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
            {current.id === "decoracion" && (
              <>
                <p className="note">{t.decoHint}</p>
                <OptionGrid items={by("decoration")} selected={form.decorationLabel} L={L} onPick={(o) => set({ decorationLabel: o.label })} />
                {isPremiumDeco && (
                  <>
                    <label htmlFor="f-deco-photos">{t.decoPhotos}</label>
                    <input id="f-deco-photos" type="file" accept="image/*" multiple onChange={onDecoUpload}
                      disabled={form.decorationPhotos.length >= MAX_PHOTOS} />
                    {form.decorationPhotos.length > 0 && (
                      <div className="photo-strip">
                        {form.decorationPhotos.map((src, i) => (
                          <div key={i} className="photo-item">
                            <img src={src} alt="" />
                            <button type="button" className="btn ghost small"
                              onClick={() => setForm((f) => ({ ...f, decorationPhotos: f.decorationPhotos.filter((_, j) => j !== i) }))}>
                              {t.removePhoto}
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    <label htmlFor="f-deco-notes">{t.decoNotes}</label>
                    <textarea id="f-deco-notes" rows={3} value={form.decorationNotes} onChange={(e) => set({ decorationNotes: e.target.value })} />
                  </>
                )}
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
                {/* Recogida: precio confirmado, total y anticipo. Entrega: pendiente del costo de envío. */}
                <dl className="totals">
                  {pending.length > 0 ? (
                    <>
                      <div><dt>{t.subtotalL}</dt><dd>{money(total)}</dd></div>
                      {pending.map((it) => <div key={it}><dt>{it}</dt><dd className="tbd">{t.toConfirm}</dd></div>)}
                    </>
                  ) : (
                    <>
                      <div className="grand"><dt>{instant ? t.totalOrder : t.total}</dt><dd>{money(total)}</dd></div>
                      {total > 0 && <div><dt>{t.deposit}</dt><dd>{money(deposit)}</dd></div>}
                    </>
                  )}
                </dl>
                {pending.length > 0
                  ? <p className="alert" style={{ background: "#fdf1dc", color: "#7a4d00" }}>{t.pendingNote.replace("{items}", pending.join(", "))}</p>
                  : instant
                  ? <p className="note">{t.confirmNowNote}</p>
                  : <p className="note">{t.priceNote}</p>}
                {redirecting && <p className="ok" role="status">{t.redirecting}</p>}
                <button className="btn wide" disabled={saving || redirecting} onClick={submit}>
                  {saving || redirecting ? t.saving : pending.length ? t.confirmPending : instant ? `${t.confirmPay} · ${money(deposit)}` : `${t.confirm} · ${money(total)}`}
                </button>
              </>
            )}

            {/* En celular los botones van al final del paso; en PC, debajo de la foto y el precio. */}
            <div className="step-nav-mobile">{stepNav()}</div>
            {current.id !== "resumen" && !validate(current.id) && (
              <button className="btn step-float" onClick={next}>{t.next}</button>
            )}
          </div>
          <aside className="preview">
            <img src={previewImg} alt="" />
            <p className="note" style={{ margin: "10px 0 2px" }}>{instant ? t.totalFinal : t.total}</p>
            <div className="total">{money(total)}</div>
            {pending.length > 0 && <p className="note" style={{ margin: 0 }}>+ {t.toConfirm}</p>}
            <div className="step-nav-desk">{stepNav()}</div>
          </aside>
        </div>
      </div>
    </main>
  );
}
