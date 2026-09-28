import { NextResponse } from "next/server";
import { createOrder, findByClientRef, listOrders, priceOrder, rateLimit } from "@/lib/db";
import { notifyNewOrder } from "@/lib/notify";
import { isAdmin } from "@/lib/auth";
import { clientIp, isISODate, isUploadedImage, sameOrigin, str, todayInTexas } from "@/lib/validate";

export const dynamic = "force-dynamic";

const fail = (error, status = 400) => NextResponse.json({ error }, { status });

// Solo el panel admin puede ver los pedidos (contienen datos de clientes).
export async function GET(req) {
  if (!isAdmin(req)) return fail("Sesión vencida. Vuelve a entrar.", 401);
  try {
    return NextResponse.json({ orders: await listOrders() }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("[orders:list]", e);
    return fail("No se pudieron cargar los pedidos", 500);
  }
}

export async function POST(req) {
  if (!sameOrigin(req)) return fail("Origen no permitido", 403);

  const raw = await req.text().catch(() => "");
  if (raw.length > 2_000_000) return fail("El pedido es muy pesado. Prueba con una foto más pequeña.", 413);
  let body;
  try {
    body = JSON.parse(raw);
  } catch {
    return fail("Solicitud inválida");
  }

  // Campo trampa: invisible para personas, los bots lo llenan.
  if (body.website) {
    console.warn("[orders:create] bloqueado por campo trampa", clientIp(req));
    return fail("Solicitud inválida");
  }

  const clientRef = /^[A-Za-z0-9-]{8,64}$/.test(body.clientRef || "") ? body.clientRef : null;
  if (clientRef) {
    const existing = await findByClientRef(clientRef).catch(() => null);
    if (existing) return NextResponse.json({ orderNumber: existing.order_number, total: Number(existing.total), duplicate: true });
  }

  try {
    if (!(await rateLimit("order:" + clientIp(req), 10, 60 * 60))) {
      return fail("Recibimos muchos pedidos desde tu conexión. Escríbenos por WhatsApp y te ayudamos.", 429);
    }
  } catch (e) {
    console.error("[orders:create] rate limit", e);
  }

  const customer = {
    name: str(body?.customer?.name, 120),
    phone: str(body?.customer?.phone, 40),
    email: str(body?.customer?.email, 160),
    address: str(body?.customer?.address, 300),
    smsOptIn: !!body?.customer?.smsOptIn,
  };
  if (!customer.name || !customer.phone || !customer.email) return fail("Faltan nombre, teléfono o correo");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email)) return fail("El correo no es válido");
  if (customer.phone.replace(/\D/g, "").length < 7) return fail("El teléfono no es válido");
  if (!isISODate(body.deliveryDate)) return fail("Elige una fecha de entrega");
  if (body.deliveryDate < todayInTexas()) return fail("La fecha de entrega ya pasó. Elige otra.");
  const designImage = body.designImage || "";
  if (designImage && !isUploadedImage(designImage)) return fail("La foto no es válida o es muy pesada. Prueba con otra.");

  const order = {
    customer,
    clientRef,
    lang: body.lang === "en" ? "en" : "es",
    deliveryType: str(body.deliveryType, 120),
    deliveryAddress: str(body.deliveryAddress, 300),
    deliveryDate: body.deliveryDate,
    deliveryTime: /^\d{2}:\d{2}$/.test(body.deliveryTime || "") ? body.deliveryTime : "",
    size: str(body.size, 120),
    cakeFlavor: str(body.cakeFlavor, 120),
    fillingFlavor: str(body.fillingFlavor, 120),
    fillingCountLabel: str(body.fillingCount, 120),
    designId: /^\d+$/.test(String(body.designId ?? "")) ? String(body.designId) : null,
    designLabel: str(body.designLabel, 120),
    designNotes: str(body.designNotes, 1000),
    designImage,
  };

  try {
    const total = await priceOrder(order);
    let orderNumber;
    try {
      ({ orderNumber } = await createOrder(order, total));
    } catch (e) {
      // Dos envíos simultáneos del mismo formulario: gana el primero.
      const again = clientRef && (await findByClientRef(clientRef).catch(() => null));
      if (again) return NextResponse.json({ orderNumber: again.order_number, total: Number(again.total), duplicate: true });
      throw e;
    }
    const mail = await notifyNewOrder(orderNumber, order, total);
    if (!mail.ok) console.warn("[orders:notify] no se envió el aviso", orderNumber, mail.error || mail.via);
    return NextResponse.json({ orderNumber, total, emailed: mail.ok });
  } catch (e) {
    console.error("[orders:create]", e);
    const msg = String(e?.message || "");
    return fail(msg.includes("ya no está disponible") ? msg : "No pudimos guardar tu pedido. Intenta de nuevo o escríbenos.", 500);
  }
}
