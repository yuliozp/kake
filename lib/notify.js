// Correos del sitio (vía Resend). Karla recibe los suyos en español;
// el cliente, en el idioma en que hizo el pedido.
import { GOOGLE } from "./google";
import { translateLabel, trFact } from "./i18n";

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

function layout({ kicker, title, intro, rows = [], totalLabel, totalValue, extra = "", button, footer, after = "" }) {
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
      ${after}
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
  const res = await fetch(process.env.RESEND_API_URL || "https://api.resend.com/emails", { // override solo para pruebas locales
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

/* ---------- Datos del negocio (pie de los correos) ---------- */

const BUSINESS = {
  name: "Karla's Bake",
  address: "3920 Highway 365 Apt 247 Building 17, Port Arthur, Texas 77642",
  phone: "+1 (409) 332-5768",
  tel: "tel:+14093325768",
  whatsapp: "https://wa.me/14093325768",
  email: "karlasbake25@gmail.com",
  facebook: "https://www.facebook.com/karla.sbake",
  instagram: "https://www.instagram.com/karlasbake/",
  tiktok: "https://www.tiktok.com/@karlasbake",
};

const aLink = (href, label) => `<a href="${esc(href)}" style="color:${PINK};font-weight:700">${esc(label)}</a>`;

function businessCard(lang) {
  const en = lang === "en";
  return `<div style="margin:6px 22px 18px;padding:14px 16px;border-radius:12px;background:#fff8fb;border:1px solid #f3d5de;color:#4a2c2a;font-size:14px;line-height:1.7">
    <strong style="font-size:15px">${esc(BUSINESS.name)}</strong><br>
    ${aLink(GOOGLE.mapsShort, BUSINESS.address)}<br>
    ${en ? "Phone / WhatsApp" : "Teléfono / WhatsApp"}: ${aLink(BUSINESS.tel, BUSINESS.phone)}<br>
    Email: ${aLink("mailto:" + BUSINESS.email, BUSINESS.email)}<br>
    ${aLink(BUSINESS.facebook, "Facebook")} · ${aLink(BUSINESS.instagram, "Instagram")} · ${aLink(BUSINESS.tiktok, "TikTok")}
  </div>`;
}

/* ---------- Karla: pedido nuevo para revisar ---------- */

export async function notifyNewOrder({ orderNumber, order, total, pending, karlaLink, adminLink }) {
  const c = order.customer;
  const attachments = [
    attachment(order.designImage, "referencia-diseno"),
    ...(order.decorationPhotos || []).map((p, i) => attachment(p, `decoracion-${i + 1}`)),
  ].filter(Boolean);
  const pendingTxt = pending.length ? `Por confirmar: ${pending.join(" y ")}` : "";
  const html = layout({
    kicker: "Karla's Bake · Nuevo pedido por aceptar",
    title: orderNumber,
    intro: pending.length
      ? `Revisa el pedido. <strong>Tiene costo por confirmar</strong> (${esc(pending.join(" y "))}): al aceptarlo escribes el monto adicional. Al cliente le llegará la aceptación con el total y el enlace para pagar el anticipo.`
      : `Revisa el pedido y tócalo para <strong>aceptarlo</strong>. Al cliente le llegará la aceptación con el enlace para pagar el anticipo; cuando pague, el pedido queda CONFIRMADO.`,
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
    button: { href: karlaLink, label: pending.length ? "Revisar, poner costo y aceptar" : "Revisar y aceptar pedido" },
    footer: `${attachments.length ? "Las fotos del cliente van adjuntas. " : ""}También puedes verlo en el <a href="${esc(adminLink)}" style="color:${PINK}">panel</a>. Si respondes este correo, le escribes directo al cliente.`,
  });
  return toKarla(`Nuevo pedido por aceptar ${orderNumber} — ${c.name} — ${prettyDate(order.deliveryDate)}`, html, attachments, c.email);
}

/* ---------- Cliente ---------- */

const T = {
  es: {
    brand: "Karla's Bake",
    when: "Entrega", mode: "Modalidad", size: "Tamaño", flavor: "Sabor", filling: "Relleno", design: "Diseño", deco: "Decoración",
    cake: "Pastel", cakeOptions: "Personalización", address: "Dirección", sub: "Subtotal",
    total: "Total", deposit: "Anticipo (50 %)", paidAmount: "Pagado", balance: "Saldo pendiente",
    estimate: "Total estimado", subtotal: "Subtotal (sin lo pendiente)", pendingLine: (p) => `Por confirmar: ${p}`,
    seeBtn: "Ver mi pedido",
    reviewK: "Pedido en revisión",
    reviewI: (pending) => pending
      ? "¡Gracias por tu pedido! Karla lo está revisando y confirmará el costo pendiente. Cuando lo acepte, te enviaremos un correo con el total y el enlace para pagar el anticipo y reservar tu fecha."
      : "¡Gracias por tu pedido! Karla lo está revisando. Cuando lo acepte, te enviaremos un correo con el enlace para pagar el anticipo y reservar tu fecha.",
    acceptedK: "Pedido aceptado",
    acceptedI: "¡Buenas noticias! Karla aceptó tu pedido. Para confirmarlo y reservar tu fecha, por favor paga el anticipo con el enlace de abajo. El saldo se paga al recoger o recibir tu pastel.",
    acceptedOffline: "Karla te contactará con las opciones para pagar el anticipo.",
    payDepositBtn: "Pagar anticipo", payNote: "Pago seguro con Stripe: tarjeta, Apple Pay o Google Pay.",
    confirmedK: "Pedido confirmado",
    confirmedI: (a) => a
      ? `¡Gracias! Recibimos tu anticipo de <strong>${a}</strong>. Tu pedido está <strong>confirmado</strong> y tu fecha queda reservada.`
      : "¡Gracias! Tu pedido está <strong>confirmado</strong> y tu fecha queda reservada.",
    balanceNote: "El saldo se paga al recoger o recibir tu pastel.",
    readyK: "Tu pedido está listo",
    readyI: "¡Tu pastel está listo para recoger! Te esperamos en la dirección de abajo en la fecha y hora de tu pedido.",
    readyPay: (b) => `Saldo pendiente: <strong>${b}</strong>. Puedes pagarlo ahora con el enlace de abajo o al recoger tu pedido.`,
    readyPaid: "Tu pedido ya está pagado por completo.",
    payBalanceBtn: "Pagar saldo", directions: "Cómo llegar",
    paidK: "Pago recibido", paidI: (a) => `¡Gracias! Recibimos tu pago de <strong>${a}</strong>.`,
    thanksK: "Gracias por tu preferencia",
    thanksTitle: "¡Gracias!",
    thanksBody: (name) => `<p style="margin:0 0 12px">Estimado(a) ${esc(name)}:</p>
      <p style="margin:0 0 12px">En nombre de todo el equipo de Karla's Bake, le agradecemos sinceramente por confiarnos la preparación de su pedido. Ha sido un honor formar parte de su celebración y esperamos que cada detalle haya estado a la altura de sus expectativas.</p>
      <p style="margin:0 0 12px">Su opinión es muy valiosa para nosotros. Le agradeceríamos mucho que dedicara un momento a evaluar nuestro servicio en Google; sus comentarios nos ayudan a seguir mejorando y a que otras personas nos conozcan.</p>
      <p style="margin:0">Quedamos a su disposición para cualquier consulta o para su próxima ocasión especial.</p>`,
    reviewBtn: "Evaluar nuestro servicio",
    regards: "Atentamente,<br><strong>Karla's Bake</strong>",
    footer: "Si tienes preguntas, responde este correo o escríbenos por WhatsApp al +1 (409) 332-5768.",
  },
  en: {
    brand: "Karla's Bake",
    when: "Delivery", mode: "Method", size: "Size", flavor: "Flavor", filling: "Filling", design: "Design", deco: "Decoration",
    cake: "Cake", cakeOptions: "Customization", address: "Address", sub: "Subtotal",
    total: "Total", deposit: "Deposit (50%)", paidAmount: "Paid", balance: "Balance due",
    estimate: "Estimated total", subtotal: "Subtotal (pending items not included)", pendingLine: (p) => `To be confirmed: ${p}`,
    seeBtn: "View my order",
    reviewK: "Order under review",
    reviewI: (pending) => pending
      ? "Thank you for your order! Karla is reviewing it and will confirm the pending cost. Once she accepts it, we'll email you the total and the link to pay the deposit and hold your date."
      : "Thank you for your order! Karla is reviewing it. Once she accepts it, we'll email you the link to pay the deposit and hold your date.",
    acceptedK: "Order accepted",
    acceptedI: "Good news! Karla accepted your order. To confirm it and hold your date, please pay the deposit using the link below. The balance is due when you pick up or receive your cake.",
    acceptedOffline: "Karla will contact you with the options to pay the deposit.",
    payDepositBtn: "Pay deposit", payNote: "Secure payment with Stripe: card, Apple Pay or Google Pay.",
    confirmedK: "Order confirmed",
    confirmedI: (a) => a
      ? `Thank you! We received your deposit of <strong>${a}</strong>. Your order is <strong>confirmed</strong> and your date is reserved.`
      : "Thank you! Your order is <strong>confirmed</strong> and your date is reserved.",
    balanceNote: "The balance is due when you pick up or receive your cake.",
    readyK: "Your order is ready",
    readyI: "Your cake is ready for pickup! We look forward to seeing you at the address below on your order's date and time.",
    readyPay: (b) => `Balance due: <strong>${b}</strong>. You can pay it now with the link below or when you pick up your order.`,
    readyPaid: "Your order is fully paid.",
    payBalanceBtn: "Pay balance", directions: "Get directions",
    paidK: "Payment received", paidI: (a) => `Thank you! We received your payment of <strong>${a}</strong>.`,
    thanksK: "Thank you for choosing us",
    thanksTitle: "Thank you!",
    thanksBody: (name) => `<p style="margin:0 0 12px">Dear ${esc(name)},</p>
      <p style="margin:0 0 12px">On behalf of the entire Karla's Bake team, we sincerely thank you for trusting us with your order. It has been an honor to be part of your celebration, and we hope every detail met your expectations.</p>
      <p style="margin:0 0 12px">Your opinion is very important to us. We would greatly appreciate it if you could take a moment to rate our service on Google; your feedback helps us keep improving and helps others discover us.</p>
      <p style="margin:0">We remain at your service for any questions or for your next special occasion.</p>`,
    reviewBtn: "Rate our service",
    regards: "Sincerely,<br><strong>Karla's Bake</strong>",
    footer: "Questions? Reply to this email or text us on WhatsApp at +1 (409) 332-5768.",
  },
};

const langOf = (o) => (o.lang === "en" ? "en" : "es");
const payLink = (link) => link + (link.includes("?") ? "&" : "?") + "pagar=1";

// Nombres del catálogo (en español en la base de datos) en el idioma del cliente.
const tr = (lang, v) => (v ? translateLabel(lang, v) : v);
const trOptions = (lang, text) => !text ? text : String(text).split(" · ").map((part) => {
  const i = part.indexOf(":");
  return i < 0 ? tr(lang, part.trim()) : `${tr(lang, part.slice(0, i).trim())}: ${tr(lang, part.slice(i + 1).trim())}`;
}).join(" · ");

function orderRows(o, t, lang) {
  return [
    [t.when, `${prettyDate(o.delivery_date, lang)} · ${prettyTime(o.delivery_time, lang)}`],
    [t.mode, tr(lang, o.delivery_type)], [t.address, o.delivery_address],
    [t.cake, tr(lang, o.cake_name)], [t.cakeOptions, trOptions(lang, o.cake_options)],
    [t.size, tr(lang, o.size_label)], [t.flavor, tr(lang, o.cake_flavor)], [t.filling, tr(lang, o.filling_flavor)],
    [t.design, o.design_label], [t.deco, o.decoration_label],
  ];
}

const line = (html) => `<div style="padding:0 22px 12px;color:#4a2c2a;line-height:1.5">${html}</div>`;

// 1) El cliente terminó el pedido: queda en revisión.
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
    kicker: `${t.brand} · ${t.reviewK}`, title: orderNumber, intro: t.reviewI(pending.length > 0),
    rows: orderRows(o, t, lang),
    totalLabel: pending.length ? t.subtotal : t.estimate, totalValue: money(total),
    extra: pending.length ? `<p style="padding:0 22px 8px;margin:0;color:#8a5a58;font-weight:700">${esc(t.pendingLine(pending.join(", ")))}</p>` : "",
    button: { href: link, label: t.seeBtn }, footer: esc(t.footer),
  });
  return toCustomer(order.customer.email, `${t.brand} · ${t.reviewK} ${orderNumber}`, html);
}

// 2) Karla aceptó: total final y enlace para pagar el anticipo.
export async function notifyCustomerAccepted({ o, finalTotal, deposit, link }) {
  const lang = langOf(o);
  const t = T[lang];
  const online = !!process.env.STRIPE_SECRET_KEY;
  const extraCost = o.price_pending && Number(finalTotal) > Number(o.total || 0);
  const html = layout({
    kicker: `${t.brand} · ${t.acceptedK}`, title: o.order_number, intro: t.acceptedI,
    rows: [...orderRows(o, t, lang), ...(extraCost
      ? [[t.sub, money(o.total)], [trOptions(lang, o.pending_items) || "+", "+ " + money(Number(finalTotal) - Number(o.total || 0))]] : [])],
    totalLabel: t.total, totalValue: money(finalTotal),
    extra: line(`${esc(t.deposit)}: <strong>${money(deposit)}</strong>${online ? "" : `<br>${esc(t.acceptedOffline)}`}`),
    button: online
      ? { href: payLink(link), label: `${t.payDepositBtn} ${money(deposit)}`, note: t.payNote }
      : { href: link, label: t.seeBtn },
    footer: esc(t.footer),
  });
  return toCustomer(o.email, `${t.brand} · ${t.acceptedK}: ${t.payDepositBtn.toLowerCase()} ${money(deposit)} (${o.order_number})`, html);
}

// 3) Anticipo pagado: pedido confirmado.
export async function notifyCustomerConfirmed({ o, finalTotal, paid, amount = null, link }) {
  const lang = langOf(o);
  const t = T[lang];
  const balance = Math.max(0, Number(finalTotal || 0) - Number(paid || 0));
  const html = layout({
    kicker: `${t.brand} · ${t.confirmedK}`, title: o.order_number, intro: t.confirmedI(amount ? money(amount) : ""),
    rows: [...orderRows(o, t, lang), [t.total, money(finalTotal)], [t.paidAmount, money(paid)]],
    totalLabel: t.balance, totalValue: money(balance),
    extra: balance > 0 ? `<p style="padding:0 22px 8px;margin:0;color:#8a5a58">${esc(t.balanceNote)}</p>` : "",
    button: { href: link, label: t.seeBtn }, footer: esc(t.footer),
  });
  return toCustomer(o.email, `${t.brand} · ${t.confirmedK} ${o.order_number}`, html);
}

// 4) Pedido completado y es para recoger: listo, con enlace para pagar el saldo.
export async function notifyCustomerReady({ o, finalTotal, paid, link, canPay }) {
  const lang = langOf(o);
  const t = T[lang];
  const balance = Math.max(0, Math.round((Number(finalTotal || 0) - Number(paid || 0)) * 100) / 100);
  const html = layout({
    kicker: `${t.brand} · ${t.readyK}`, title: o.order_number, intro: t.readyI,
    rows: [[t.when, `${prettyDate(o.delivery_date, lang)} · ${prettyTime(o.delivery_time, lang)}`],
      [t.address, BUSINESS.address], [t.cake, tr(lang, o.cake_name)], [t.cakeOptions, trOptions(lang, o.cake_options)],
      [t.total, money(finalTotal)], [t.paidAmount, money(paid)]],
    totalLabel: t.balance, totalValue: money(balance),
    extra: line(`${balance > 0 ? t.readyPay(money(balance)) : esc(t.readyPaid)}<br>${aLink(GOOGLE.directions, t.directions)}`),
    button: balance > 0 && canPay
      ? { href: payLink(link), label: `${t.payBalanceBtn} ${money(balance)}`, note: t.payNote }
      : { href: link, label: t.seeBtn },
    footer: esc(t.footer),
  });
  return toCustomer(o.email, `${t.brand} · ${t.readyK} (${o.order_number})`, html);
}

// 5) Pedido entregado: agradecimiento formal, datos del negocio y solicitud de evaluación.
export async function notifyCustomerThanks({ o }) {
  const lang = langOf(o);
  const t = T[lang];
  const html = layout({
    kicker: `${t.brand} · ${t.thanksK}`, title: t.thanksTitle,
    intro: "",
    extra: `<div style="padding:18px 22px 6px;color:#4a2c2a;line-height:1.6">${t.thanksBody(o.customer_name || "")}</div>`
      + `<div style="padding:4px 22px 6px;color:#4a2c2a">${t.regards}</div>`,
    button: { href: GOOGLE.writeReview, label: t.reviewBtn },
    after: businessCard(lang),
  });
  return toCustomer(o.email, lang === "en" ? `Thank you from Karla's Bake (${o.order_number})` : `Gracias de parte de Karla's Bake (${o.order_number})`, html);
}

/* ---------- Pagos en línea ---------- */

// Pago recibido que no cambia el estado (por ejemplo, el saldo).
export async function notifyPaymentCustomer({ o, amount, finalTotal, paid, link }) {
  const lang = langOf(o);
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

export async function notifyPaymentKarla({ o, amount, kind, finalTotal, paid, confirmed, adminLink }) {
  const balance = Math.max(0, Number(finalTotal || 0) - Number(paid || 0));
  const what = kind === "balance" ? "el saldo" : "el anticipo";
  const html = layout({
    kicker: "Karla's Bake · Pago recibido", title: o.order_number,
    intro: `<strong>${esc(o.customer_name)}</strong> pagó ${what}: <strong>${money(amount)}</strong> en línea (Stripe). Ya quedó registrado en el pedido.${confirmed ? " El pedido pasó a <strong>CONFIRMADO</strong> y al cliente le llegó la confirmación." : ""}`,
    rows: [["Entrega", `${prettyDate(o.delivery_date)} · ${prettyTime(o.delivery_time)}`], ["Modalidad", o.delivery_type], ["Teléfono", o.phone],
      ["Total del pedido", money(finalTotal)], ["Pagado", money(paid)]],
    totalLabel: "Saldo pendiente", totalValue: money(balance),
    button: { href: adminLink, label: "Abrir el panel" },
  });
  return toKarla(`Pago recibido ${money(amount)} (${kind === "balance" ? "saldo" : "anticipo"}) — ${o.order_number} — ${o.customer_name}`, html, [], o.email);
}
