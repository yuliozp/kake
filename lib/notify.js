const NOTIFY_TO = process.env.ORDER_NOTIFY_EMAIL || "karlagabizorrilla@gmail.com";
const RESEND_OWNER = process.env.RESEND_OWNER_EMAIL || "yuliozorrilla@gmail.com";

function orderHtml(orderNumber, body) {
  const c = body.customer || {};
  const notes = body.selections?.designNotes || body.designNotes || "—";
  const rows = [
    ["Pedido", orderNumber],
    ["Cliente", c.name],
    ["Teléfono", c.phone],
    ["Email", c.email],
    ["Dirección", c.address || body.deliveryAddress || "—"],
    ["Entrega", `${body.deliveryType || "—"} · ${body.deliveryDate || ""} ${body.deliveryTime || ""}`],
    ["Tamaño", body.size || "—"],
    ["Sabor pastel", body.cakeFlavor || "—"],
    ["Relleno", body.fillingFlavor || "—"],
    ["Capas", body.fillingCount || "—"],
    ["Diseño", body.designLabel || "—"],
    ["Descripción", notes],
    ["Total", `$${Number(body.total || 0).toFixed(2)}`],
  ];
  const tr = rows
    .map(([k, v]) => `<tr><td style="padding:6px 10px;color:#4a2c2a;font-weight:700">${k}</td><td style="padding:6px 10px">${v}</td></tr>`)
    .join("");
  return `<div style="font-family:Nunito,Arial,sans-serif;background:#fff6f0;padding:24px">
    <h2 style="color:#e23a6d;margin:0 0 12px">Nuevo pedido Karla's Bake</h2>
    <p>Entró un pedido en kake.</p>
    <table style="background:#fff;border-radius:12px;border-collapse:collapse">${tr}</table>
  </div>`;
}

async function sendResend(to, subject, html) {
  const resend = process.env.RESEND_API_KEY;
  if (!resend) return { ok: false, via: "none" };
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${resend}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.RESEND_FROM || "Karla's Bake <onboarding@resend.dev>",
      to: [to],
      subject,
      html,
    }),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, via: "resend", data, to };
}

export async function notifyNewOrder(orderNumber, body) {
  const subject = `Nuevo pedido ${orderNumber} — Karla's Bake`;
  const html = orderHtml(orderNumber, body);
  try {
    let result = await sendResend(NOTIFY_TO, subject, html);
    if (!result.ok) {
      result = await sendResend(RESEND_OWNER, subject + " (copia)", html);
    }
    return result;
  } catch (e) {
    console.error("notifyNewOrder", e);
    return { ok: false, error: String(e.message || e) };
  }
}
