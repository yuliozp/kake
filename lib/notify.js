const NOTIFY_TO = process.env.ORDER_NOTIFY_EMAIL || "karlagabizorrilla@gmail.com";
const RESEND_OWNER = process.env.RESEND_OWNER_EMAIL || "yuliozorrilla@gmail.com";

const esc = (v) =>
  String(v ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));

function prettyDate(iso) {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("es-US", {
    weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC",
  });
}

function prettyTime(hhmm) {
  if (!hhmm) return "";
  const [h, m] = hhmm.split(":").map(Number);
  const suffix = h >= 12 ? "p. m." : "a. m.";
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${suffix}`;
}

function orderHtml(orderNumber, o, total, hasPhoto) {
  const c = o.customer;
  const rows = [
    ["Cliente", c.name],
    ["Teléfono", c.phone],
    ["Correo", c.email],
    ["SMS promociones", c.smsOptIn ? "Sí" : "No"],
    ["Entrega", `${prettyDate(o.deliveryDate)} · ${prettyTime(o.deliveryTime)}`],
    ["Modalidad", o.deliveryType || "—"],
    ["Dirección", o.deliveryAddress || c.address || "—"],
    ["Tamaño", o.size || "—"],
    ["Sabor del pastel", o.cakeFlavor || "—"],
    ["Relleno", o.fillingFlavor || "—"],
    ["Cantidad de rellenos", o.fillingCountLabel || "—"],
    ["Diseño", o.designLabel || "—"],
    ["Descripción", o.designNotes || "—"],
  ];
  const tr = rows
    .map(([k, v], i) => `<tr style="background:${i % 2 ? "#fff" : "#fff8fb"}">
      <td style="padding:8px 12px;color:#8a5a58;font-size:13px;width:40%">${esc(k)}</td>
      <td style="padding:8px 12px;color:#4a2c2a;font-weight:600">${esc(v)}</td></tr>`)
    .join("");
  return `<div style="font-family:Arial,Helvetica,sans-serif;background:#fff6f0;padding:24px">
    <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #f3d5de">
      <div style="background:#e23a6d;color:#fff;padding:18px 22px">
        <div style="font-size:13px;opacity:.9">Karla's Bake · Nuevo pedido</div>
        <div style="font-size:24px;font-weight:800">${esc(orderNumber)}</div>
      </div>
      <table style="width:100%;border-collapse:collapse">${tr}</table>
      <div style="padding:16px 22px;border-top:1px solid #f3d5de;display:flex;justify-content:space-between">
        <span style="color:#8a5a58">Total estimado</span>
        <strong style="font-size:20px;color:#e23a6d">$${Number(total).toFixed(2)}</strong>
      </div>
      ${hasPhoto ? `<p style="padding:0 22px 16px;color:#8a5a58;font-size:13px">La foto de referencia va adjunta a este correo.</p>` : ""}
    </div>
  </div>`;
}

function photoAttachment(dataUrl) {
  const m = /^data:image\/(jpeg|png|webp);base64,(.+)$/.exec(dataUrl || "");
  if (!m) return null;
  return { filename: `referencia.${m[1] === "jpeg" ? "jpg" : m[1]}`, content: m[2] };
}

async function sendResend(to, subject, html, attachments) {
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
    }),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, via: "resend", to, error: res.ok ? undefined : data?.message || `HTTP ${res.status}` };
}

export async function notifyNewOrder(orderNumber, order, total) {
  const photo = photoAttachment(order.designImage);
  const attachments = photo ? [photo] : [];
  const subject = `Nuevo pedido ${orderNumber} — ${order.customer.name} — ${prettyDate(order.deliveryDate)}`;
  const html = orderHtml(orderNumber, order, total, !!photo);
  try {
    let result = await sendResend(NOTIFY_TO, subject, html, attachments);
    if (!result.ok) {
      // Con el remitente de prueba de Resend solo se puede enviar al dueño de la cuenta.
      console.warn("[notify] falló envío a", NOTIFY_TO, "-", result.error, "→ se envía copia al dueño");
      result = await sendResend(RESEND_OWNER, subject + " (copia)", html, attachments);
    }
    return result;
  } catch (e) {
    console.error("[notify]", e);
    return { ok: false, error: String(e?.message || e) };
  }
}
