// Correos del sitio (vía Resend). Karla recibe los suyos en español;
// el cliente, en el idioma en que hizo el pedido.

const NOTIFY_TO = process.env.ORDER_NOTIFY_EMAIL || "karlasbake25@gmail.com";
const RESEND_OWNER = process.env.RESEND_OWNER_EMAIL || "yuliozorrilla@gmail.com";
const PINK = "#cc2f69";

const esc = (v) =>
  String(v ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
const money = (n) => "$" + Number(n || 0).toFixed(2);

function prettyDate(iso, lang = "es") {
  if (!iso) return "—";
  const [y, m, d] = String(iso).slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(lang === "en" ? "en-US" : "es-US", {
    weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC",
  });
}

function prettyTime(hhmm, lang = "es") {
  if (!hhmm) return "";
  const [h, m] = hhmm.split(":").map(Number);
  const suffix = lang === "en" ? (h >= 12 ? "PM" : "AM") : h >= 12 ? "p. m." : "a. m.";
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${suffix}`;
}

function layout({ kicker, title, intro, rows = [], totalLabel, totalValue, extra = "", button, footer }) {
  const tr = rows
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([k, v], i) => `<tr style="background:${i % 2 ? "#fff" : "#fff8fb"}">
      <td style="padding:8px 12px;color:#8a5a58;font-size:13px;width:40%;vertical-align:top">${esc(k)}</td>
      <td style="padding:8px 12px;color:#4a2c2a;font-weight:600">${esc(v)}</td></tr>`)
    .join("");
  const btn = button
    ? `<div style="padding:8px 22px 22px;text-align:center">
        <a href="${esc(button.href)}" style="display:inline-block;background:${PINK};color:#fff;text-decoration:none;font-weight:800;padding:14px 28px;border-radius:999px;font-size:16px">${esc(button.label)}</a>
        ${button.note ? `<p style="color:#8a5a58;font-size:12px;margin:10px 0 0">${esc(button.note)}</p>` : ""}
      </div>`
    : "";
  return `<div style="font-family:Arial,Helvetica,sans-serif;background:#fff6f0;padding:24px">
    <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #f3d5de">
      <div style="background:${PINK};color:#fff;padding:18px 22px">
        <div style="font-size:13px;opacity:.9">${esc(kicker)}</div>
        <div style="font-size:24px;font-weight:800">${esc(title)}</div>
      </div>
      ${intro ? `<p style="padding:16px 22px 4px;margin:0;color:#4a2c2a;line-height:1.5">${intro}</p>` : ""}
      ${tr ? `<table style="width:100%;border-collapse:collapse;margin-top:8px">${tr}</table>` : ""}
      ${totalLabel ? `<div style="padding:16px 22px;border-top:1px solid #f3d5de">
        <span style="color:#8a5a58">${esc(totalLabel)}</span>
        <strong style="float:right;font-size:20px;color:${PINK}">${esc(totalValue)}</strong>
      </div>` : ""}
      ${extra}
      ${btn}
      ${footer ? `<p style="padding:0 22px 18px;margin:0;color:#8a5a58;font-size:12px;line-height:1.5">${footer}</p>` : ""}
    </div>
  </div>`;
}

function attachment(dataUrl, name) {
  const m = /^data:image\/(jpeg|png|webp);base64,(.+)$/.exec(dataUrl || "");
  if (!m) return null;
  return { filename: `${name}.${m[1] === "jpeg" ? "jpg" : m[1]}`, content: m[2] };
}

async function sendResend(to, subject, html, attachments = [], replyTo) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { ok: false, via: "none", error: "RESEND_API_KEY no configurada" };
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.RESEND_FROM || "Karla's Bake <onboarding@resend.dev>",
      to: [to],
      subject,
      html,
      ...(attachments.length ? { attachments } : {}),
      ...(replyTo ? { reply_to: replyTo } : {}),
    }),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, via: "resend", to, error: res.ok ? undefined : data?.message || `HTTP ${res.status}` };
}

// Envío a Karla con respaldo al dueño de la cuenta si falla.
async function toKarla(subject, html, attachments, replyTo) {
  try {
    let r = await sendResend(NOTIFY_TO, subject, html, attachments, replyTo);
    if (!r.ok) {
      console.warn("[notify] falló envío a", NOTIFY_TO, "-", r.error, "→ copia al dueño");
      r = await sendResend(RESEND_OWNER, subject + " (copia)", html, attachments, replyTo);
    }
    return r;
  } catch (e) {
    console.error("[notify:karla]", e);
    return { ok: false, error: String(e?.message || e) };
  }
}

async function toCustomer(email, subject, html) {
  try {
    const r = await sendResend(email, subject, html, [], NOTIFY_TO);
    if (!r.ok) console.warn("[notify] falló envío al cliente", email, "-", r.error);
    return r;
  } catch (e) {
    console.error("[notify:cliente]", e);
    return { ok: false, error: String(e?.message || e) };
  }
}

/* ---------- Karla: pedido nuevo ---------- */

export async function notifyNewOrder({ orderNumber, order, total, pending, confirmed = false, deposit = null, karlaLink, adminLink }) {
  const c = order.customer;
  const attachments = [
    attachment(order.designImage, "referencia-diseno"),
    ...(order.decorationPhotos || []).map((p, i) => attachment(p, `decoracion-${i + 1}`)),
  ].filter(Boolean);
  const pendingTxt = pending.length ? `Por confirmar: ${pending.join(" y ")}` : "";
  const html = layout({
    kicker: confirmed ? "Karla's Bake · Nuevo pedido CONFIRMADO" : "Karla's Bake · Nuevo pedido",
    title: orderNumber,
    intro: confirmed
      ? `Pedido del catálogo <strong>sin envío</strong>: ya quedó <strong>CONFIRMADO</strong> y al cliente le llegó la confirmación para pagar el anticipo de <strong>${money(deposit)}</strong>. No tienes que hacer nada más para confirmarlo.`
      : pending.length
      ? `<strong>Este pedido tiene precio por confirmar</strong> (${esc(pending.join(" y "))}). Toca el botón para poner el monto adicional; al cliente le llegará para que lo apruebe. El pedido solo se procesa cuando el cliente confirma.`
      : `Revisa el pedido y toca <em>Confirmar pedido</em>. Al cliente le llegará la confirmación con el anticipo.`,
    rows: [
      ["Cliente", c.name], ["Teléfono", c.phone], ["Correo", c.email],
      ["Entrega", `${prettyDate(order.deliveryDate)} · ${prettyTime(order.deliveryTime)}`],
      ["Modalidad", order.deliveryType || "—"],
      ["Dirección", order.deliveryAddress || c.address || ""],
      ["Pastel", order.cake?.name], ["Detalles", order.cake?.details], ["Personalización", order.cake?.optionsText],
      ["Tamaño", order.size], ["Sabor del pastel", order.cakeFlavor], ["Relleno", order.fillingFlavor],
      ["Cantidad de rellenos", order.fillingCountLabel],
      ["Diseño", order.designLabel], [order.cake ? "Notas del cliente" : "Descripción del diseño", order.designNotes],
      ["Decoración", order.decorationLabel], ["Detalle de la decoración", order.decorationNotes],
      ["SMS promociones", c.smsOptIn ? "Sí" : "No"],
    ],
    totalLabel: pending.length ? "Subtotal (sin lo pendiente)" : "Total",
    totalValue: money(total),
    extra: pendingTxt ? `<p style="padding:0 22px 8px;margin:0;color:#b3261e;font-weight:700">${esc(pendingTxt)}</p>` : "",
    button: confirmed ? { href: adminLink, label: "Abrir el panel" } : { href: karlaLink, label: pending.length ? "Confirmar y poner precio" : "Confirmar pedido" },
    footer: `${attachments.length ? "Las fotos del cliente van adjuntas. " : ""}También puedes verlo en el <a href="${esc(adminLink)}" style="color:${PINK}">panel</a>. Si respondes este correo, le escribes directo al cliente.`,
  });
  return toKarla(`${confirmed ? "Pedido confirmado" : "Nuevo pedido"} ${orderNumber} — ${c.name} — ${prettyDate(order.deliveryDate)}`, html, attachments, c.email);
}

/* ---------- Cliente ---------- */

const T = {
  es: {
    brand: "Karla's Bake",
    receivedK: "Recibimos tu pedido",
    receivedI: (pending) => pending
      ? "¡Gracias! Karla revisará tu pedido y te enviará el <strong>precio final</strong> por este medio para que lo apruebes."
      : "¡Gracias! Karla revisará tu pedido y te confirmará por este medio.",
    when: "Entrega", mode: "Modalidad", size: "Tamaño", flavor: "Sabor", filling: "Relleno", design: "Diseño", deco: "Decoración",
    cake: "Pastel", cakeOptions: "Personalización", address: "Dirección", sub: "Subtotal",
    estimate: "Total estimado", subtotal: "Subtotal (sin lo pendiente)", pendingLine: (p) => `Por confirmar: ${p}`,
    priceK: "Tu pedido tiene precio", priceI: "Karla revisó tu pedido. Este es el precio final. Si estás de acuerdo, confírmalo con el botón.",
    total: "Total", deposit: "Anticipo (50 %)", confirmBtn: "Confirmar mi pedido",
    confirmNote: "Al confirmar, reservamos tu fecha. El siguiente paso es el pago del anticipo.",
    doneK: "Pedido confirmado", doneI: "¡Tu pedido está confirmado! Para reservar la fecha, el siguiente paso es el pago del anticipo. Puedes pagarlo en línea con tarjeta, Apple Pay o Google Pay.",
    seeBtn: "Ver mi pedido", payBtn: "Pagar anticipo",
    paidK: "Pago recibido", paidI: (a) => `¡Gracias! Recibimos tu pago de <strong>${a}</strong>. Tu fecha queda reservada.`,
    paidAmount: "Pagado", balance: "Saldo pendiente", balanceNote: "El saldo se paga al recibir tu pastel.", footer: "Si tienes preguntas, responde este correo o escríbenos por WhatsApp al +1 (409) 332-5768.",
  },
  en: {
    brand: "Karla's Bake",
    receivedK: "We received your order",
    receivedI: (pending) => pending
      ? "Thank you! Karla will review your order and email you the <strong>final price</strong> for your approval."
      : "Thank you! Karla will review your order and confirm it by email.",
    when: "Delivery", mode: "Method", size: "Size", flavor: "Flavor", filling: "Filling", design: "Design", deco: "Decoration",
    cake: "Cake", cakeOptions: "Customization", address: "Address", sub: "Subtotal",
    estimate: "Estimated total", subtotal: "Subtotal (pending items not included)", pendingLine: (p) => `To be confirmed: ${p}`,
    priceK: "Your order has a price", priceI: "Karla reviewed your order. This is the final price. If you agree, confirm it with the button.",
    total: "Total", deposit: "Deposit (50%)", confirmBtn: "Confirm my order",
    confirmNote: "Confirming reserves your date. The next step is paying the deposit.",
    doneK: "Order confirmed", doneI: "Your order is confirmed! To hold your date, the next step is paying the deposit. You can pay online by card, Apple Pay or Google Pay.",
    seeBtn: "View my order", payBtn: "Pay deposit",
    paidK: "Payment received", paidI: (a) => `Thank you! We received your payment of <strong>${a}</strong>. Your date is reserved.`,
    paidAmount: "Paid", balance: "Balance due", balanceNote: "The balance is paid when you receive your cake.", footer: "Questions? Reply to this email or text us on WhatsApp at +1 (409) 332-5768.",
  },
};

function orderRows(o, t, lang) {
  return [
    [t.when, `${prettyDate(o.delivery_date, lang)} · ${prettyTime(o.delivery_time, lang)}`],
    [t.mode, o.delivery_type], [t.address, o.delivery_address],
    [t.cake, o.cake_name], [t.cakeOptions, o.cake_options],
    [t.size, o.size_label], [t.flavor, o.cake_flavor], [t.filling, o.filling_flavor],
    [t.design, o.design_label], [t.deco, o.decoration_label],
  ];
}

export async function notifyCustomerReceived({ order, orderNumber, total, pending, link }) {
  const lang = order.lang === "en" ? "en" : "es";
  const t = T[lang];
  const o = {
    delivery_date: order.deliveryDate, delivery_time: order.deliveryTime, delivery_type: order.deliveryType,
    size_label: order.size, cake_flavor: order.cakeFlavor, filling_flavor: order.fillingFlavor,
    design_label: order.designLabel, decoration_label: order.decorationLabel,
    delivery_address: order.deliveryAddress, cake_name: order.cake?.name, cake_options: order.cake?.optionsText,
  };
  const html = layout({
    kicker: `${t.brand} · ${t.receivedK}`, title: orderNumber, intro: t.receivedI(pending.length > 0),
    rows: orderRows(o, t, lang),
    totalLabel: pending.length ? t.subtotal : t.estimate, totalValue: money(total),
    extra: pending.length ? `<p style="padding:0 22px 8px;margin:0;color:#8a5a58;font-weight:700">${esc(t.pendingLine(pending.join(", ")))}</p>` : "",
    button: { href: link, label: t.seeBtn }, footer: esc(t.footer),
  });
  return toCustomer(order.customer.email, `${t.brand} · ${t.receivedK} ${orderNumber}`, html);
}

export async function notifyCustomerPrice({ o, finalTotal, deposit, link }) {
  const lang = o.lang === "en" ? "en" : "es";
  const t = T[lang];
  const html = layout({
    kicker: `${t.brand} · ${t.priceK}`, title: o.order_number, intro: t.priceI,
    // Desglose: subtotal del pedido + lo que Karla agregó (envío, decoración premium).
    rows: [...orderRows(o, t, lang), ...(o.price_pending && Number(finalTotal) >= Number(o.total || 0)
      ? [[t.sub, money(o.total)], [o.pending_items || "+", "+ " + money(Number(finalTotal) - Number(o.total || 0))]] : [])],
    totalLabel: t.total, totalValue: money(finalTotal),
    extra: `<div style="padding:0 22px 12px;color:#4a2c2a">${esc(t.deposit)}: <strong>${money(deposit)}</strong></div>`,
    button: { href: link, label: t.confirmBtn, note: t.confirmNote }, footer: esc(t.footer),
  });
  return toCustomer(o.email, `${t.brand} · ${t.priceK}: ${money(finalTotal)} (${o.order_number})`, html);
}

export async function notifyCustomerConfirmed({ o, finalTotal, deposit, link }) {
  const lang = o.lang === "en" ? "en" : "es";
  const t = T[lang];
  const html = layout({
    kicker: `${t.brand} · ${t.doneK}`, title: o.order_number, intro: t.doneI,
    rows: orderRows(o, t, lang), totalLabel: t.total, totalValue: money(finalTotal),
    extra: `<div style="padding:0 22px 12px;color:#4a2c2a">${esc(t.deposit)}: <strong>${money(deposit)}</strong></div>`,
    button: { href: link, label: process.env.STRIPE_SECRET_KEY ? `${t.payBtn} ${money(deposit)}` : t.seeBtn }, footer: esc(t.footer),
  });
  return toCustomer(o.email, `${t.brand} · ${t.doneK} ${o.order_number}`, html);
}

/* ---------- Karla: el cliente confirmó ---------- */

export async function notifyKarlaCustomerConfirmed({ o, finalTotal, deposit, adminLink }) {
  const html = layout({
    kicker: "Karla's Bake · Cliente confirmó", title: o.order_number,
    intro: `<strong>${esc(o.customer_name)}</strong> aprobó el precio. El pedido quedó <strong>CONFIRMADO</strong>.${process.env.STRIPE_SECRET_KEY ? " Ya puede pagar el anticipo en línea; te avisaremos cuando pague." : ""}`,
    rows: [["Entrega", `${prettyDate(o.delivery_date)} · ${prettyTime(o.delivery_time)}`], ["Teléfono", o.phone], ["Anticipo", money(deposit)]],
    totalLabel: "Total", totalValue: money(finalTotal),
    button: { href: adminLink, label: "Abrir el panel" },
  });
  return toKarla(`Confirmado ${o.order_number} — ${o.customer_name} — ${money(finalTotal)}`, html, [], o.email);
}

/* ---------- Pago del anticipo en línea ---------- */

export async function notifyPaymentCustomer({ o, amount, finalTotal, paid, link }) {
  const lang = o.lang === "en" ? "en" : "es";
  const t = T[lang];
  const balance = Math.max(0, Number(finalTotal || 0) - Number(paid || 0));
  const html = layout({
    kicker: `${t.brand} · ${t.paidK}`, title: o.order_number, intro: t.paidI(money(amount)),
    rows: [...orderRows(o, t, lang), [t.total, money(finalTotal)], [t.paidAmount, money(paid)]],
    totalLabel: t.balance, totalValue: money(balance),
    extra: balance > 0 ? `<p style="padding:0 22px 8px;margin:0;color:#8a5a58">${esc(t.balanceNote)}</p>` : "",
    button: { href: link, label: t.seeBtn }, footer: esc(t.footer),
  });
  return toCustomer(o.email, `${t.brand} · ${t.paidK} ${money(amount)} (${o.order_number})`, html);
}

export async function notifyPaymentKarla({ o, amount, finalTotal, paid, adminLink }) {
  const balance = Math.max(0, Number(finalTotal || 0) - Number(paid || 0));
  const html = layout({
    kicker: "Karla's Bake · Pago recibido", title: o.order_number,
    intro: `<strong>${esc(o.customer_name)}</strong> pagó <strong>${money(amount)}</strong> en línea (Stripe). Ya quedó registrado en el pedido.`,
    rows: [["Entrega", `${prettyDate(o.delivery_date)} · ${prettyTime(o.delivery_time)}`], ["Teléfono", o.phone],
      ["Total del pedido", money(finalTotal)], ["Pagado", money(paid)]],
    totalLabel: "Saldo pendiente", totalValue: money(balance),
    button: { href: adminLink, label: "Abrir el panel" },
  });
  return toKarla(`Pago recibido ${money(amount)} — ${o.order_number} — ${o.customer_name}`, html, [], o.email);
}
