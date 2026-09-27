const NOTIFY_TO = process.env.ORDER_NOTIFY_EMAIL || "karlagabizorrilla@gmail.com";

function orderHtml(orderNumber, body) {
  const c = body.customer || {};
  const rows = [
    ["Pedido", orderNumber],
    ["Cliente", c.name],
    ["Teléfono", c.phone],
    ["Email", c.email],
    ["Dirección", c.address || body.deliveryAddress || "—"],
    ["Entrega", `${body.deliveryType || "—"} · ${body.deliveryDate || ""} ${body.deliveryTime || ""}`],
    ["Tamaño", body.size || "—"],
    ["Forma", body.shape || body.selections?.shape || "—"],
    ["Sabor pastel", body.cakeFlavor || "—"],
    ["Relleno", body.fillingFlavor || "—"],
    ["Capas", body.fillingCount || "—"],
    ["Cobertura", body.frosting || body.selections?.frosting || "—"],
    ["Diseño", body.designLabel || "—"],
    ["Modelo", body.selections?.modelLabel || "—"],
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

async function sendpulseToken() {
  const id = process.env.SENDPULSE_API_ID || process.env.SENDPULSE_USER_ID;
  const secret = process.env.SENDPULSE_API_SECRET || process.env.SENDPULSE_SECRET;
  if (!id || !secret) return null;
  const res = await fetch("https://api.sendpulse.com/oauth/access_token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ grant_type: "client_credentials", client_id: id, client_secret: secret }),
  });
  const data = await res.json();
  return data.access_token || null;
}

export async function notifyNewOrder(orderNumber, body) {
  const subject = `Nuevo pedido ${orderNumber} — Karla's Bake`;
  const html = orderHtml(orderNumber, body);
  const text = `Nuevo pedido ${orderNumber}\nCliente: ${body.customer?.name}\nTel: ${body.customer?.phone}\nEmail: ${body.customer?.email}\nTotal: $${Number(body.total || 0).toFixed(2)}`;

  try {
    const token = await sendpulseToken();
    if (token) {
      const fromEmail = process.env.SENDPULSE_FROM_EMAIL || NOTIFY_TO;
      const fromName = process.env.SENDPULSE_FROM_NAME || "Karla's Bake";
      const res = await fetch("https://api.sendpulse.com/smtp/emails", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          email: {
            subject,
            html,
            text,
            from: { name: fromName, email: fromEmail },
            to: [{ name: "Karla", email: NOTIFY_TO }],
          },
        }),
      });
      const data = await res.json();
      return { ok: !!data.result || res.ok, via: "sendpulse", data };
    }

    const resend = process.env.RESEND_API_KEY;
    if (resend) {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resend}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: process.env.RESEND_FROM || "Karla's Bake <onboarding@resend.dev>",
          to: [NOTIFY_TO],
          subject,
          html,
        }),
      });
      return { ok: res.ok, via: "resend" };
    }

    console.warn("Sin claves de correo; no se envió el aviso.");
    return { ok: false, via: "none" };
  } catch (e) {
    console.error("notifyNewOrder", e);
    return { ok: false, error: String(e.message || e) };
  }
}
