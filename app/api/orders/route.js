import { NextResponse } from "next/server";
import { createOrder, findByClientRef, getOrderSummary, listOrders, priceOrder, rateLimit } from "@/lib/db";
import { notifyCustomerConfirmed, notifyCustomerReceived, notifyNewOrder } from "@/lib/notify";
import { customerUrl, karlaUrl, signLink, siteUrl } from "@/lib/links";
import { isAdmin } from "@/lib/auth";
import { clientIp, depositFor, isISODate, isShipping, isUploadedImage, MAX_DECOR_PHOTOS, MIN_TIME, minDeliveryDate, sameOrigin, str } from "@/lib/validate";

export const dynamic = "force-dynamic";

const fail = (error, status = 400) => NextResponse.json({ error }, { status });

// Respuesta cuando el mismo formulario llega dos veces: se devuelve el pedido ya creado.
const duplicate = (o) => NextResponse.json({
  orderNumber: o.order_number, total: Number(o.total), duplicate: true, pending: [],
  confirmed: o.status === "confirmado",
  ...(o.id ? { trackPath: `/mi-pedido/${o.id}?t=${signLink("cliente", o.id)}` } : {}),
});

// Solo el panel admin puede ver los pedidos (contienen datos de clientes).
export async function GET(req) {
  if (!isAdmin(req)) return fail("Sesión vencida. Vuelve a entrar.", 401);
  try {
    const orders = (await listOrders()).map((o) => ({
      ...o,
      karla_path: `/confirmar/${o.id}?t=${signLink("karla", o.id)}`,
      photo_token: signLink("karla", o.id),
    }));
    return NextResponse.json({ orders }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("[orders:list]", e);
    return fail("No se pudieron cargar los pedidos", 500);
  }
}

export async function POST(req) {
  if (!sameOrigin(req)) return fail("Origen no permitido", 403);

  const raw = await req.text().catch(() => "");
  if (raw.length > 4_200_000) return fail("El pedido es muy pesado. Prueba con una foto más pequeña.", 413);
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
    if (existing) return duplicate(existing);
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
  if (body.deliveryDate < minDeliveryDate()) return fail("Los pedidos se hacen con al menos 2 días de anticipación. Elige otra fecha.");
  if (!/^\d{2}:\d{2}$/.test(body.deliveryTime || "") || body.deliveryTime < MIN_TIME) {
    return fail("La hora de entrega debe ser a partir de las 10:00 a. m.");
  }
  const designImage = body.designImage || "";
  if (designImage && !isUploadedImage(designImage)) return fail("La foto no es válida o es muy pesada. Prueba con otra.");
  const decorationPhotos = Array.isArray(body.decorationPhotos) ? body.decorationPhotos : [];
  if (decorationPhotos.length > MAX_DECOR_PHOTOS) return fail(`Puedes enviar hasta ${MAX_DECOR_PHOTOS} fotos de decoración.`);
  if (decorationPhotos.some((ph) => !isUploadedImage(ph))) return fail("Una de las fotos de decoración no es válida. Prueba con otra.");

  const deliveryType = str(body.deliveryType, 120);
  const deliveryAddress = isShipping(deliveryType) ? str(body.deliveryAddress, 300) || customer.address : "";
  if (isShipping(deliveryType) && deliveryAddress.length < 6) return fail("Escribe la dirección completa para el envío.");
  // Personalizaciones del pastel del catálogo: { "Color": "Rosa", ... }
  const cakeOptions = {};
  if (body.cakeOptions && typeof body.cakeOptions === "object" && !Array.isArray(body.cakeOptions)) {
    for (const [k, v] of Object.entries(body.cakeOptions).slice(0, 12)) cakeOptions[str(k, 40)] = str(v, 60);
  }

  const order = {
    customer,
    clientRef,
    lang: body.lang === "en" ? "en" : "es",
    deliveryType,
    deliveryAddress,
    cakeId: /^\d+$/.test(String(body.cakeId ?? "")) ? Number(body.cakeId) : null,
    cakeOptions,
    deliveryDate: body.deliveryDate,
    deliveryTime: body.deliveryTime,
    size: str(body.size, 120),
    cakeFlavor: str(body.cakeFlavor, 120),
    fillingFlavor: str(body.fillingFlavor, 120),
    fillingCountLabel: str(body.fillingCount, 120),
    designId: /^\d+$/.test(String(body.designId ?? "")) ? String(body.designId) : null,
    designLabel: str(body.designLabel, 120),
    designNotes: str(body.designNotes, 1000),
    designImage,
    decorationLabel: str(body.decorationLabel, 120),
    decorationNotes: str(body.decorationNotes, 1000),
    decorationPhotos,
  };

  try {
    const { total, pending, cake } = await priceOrder(order);
    if (cake) {
      // Pastel del catálogo: no lleva los pasos de "arma tu pastel".
      Object.assign(order, {
        size: "", cakeFlavor: "", fillingFlavor: "", fillingCountLabel: "", designId: null, designLabel: "",
        designImage: "", decorationLabel: "", decorationNotes: "", decorationPhotos: [], cake,
      });
    }
    // Pastel del catálogo sin envío ni nada por cotizar: queda CONFIRMADO de inmediato.
    // (Un pastel "a tu medida" siempre lo revisa Karla antes de confirmar.)
    const confirmed = !!cake && pending.length === 0 && total > 0;
    const deposit = confirmed ? depositFor(total) : null;
    let orderId, orderNumber;
    try {
      ({ orderId, orderNumber } = await createOrder(order, total, pending, { confirmed, deposit, cake }));
    } catch (e) {
      // Dos envíos simultáneos del mismo formulario: gana el primero.
      const again = clientRef && (await findByClientRef(clientRef).catch(() => null));
      if (again) return duplicate(again);
      throw e;
    }
    const summary = confirmed ? await getOrderSummary(orderId).catch(() => null) : null;
    const [mail] = await Promise.all([
      notifyNewOrder({ orderNumber, order, total, pending, confirmed, deposit, karlaLink: karlaUrl(orderId), adminLink: `${siteUrl()}/admin` }),
      confirmed && summary
        ? notifyCustomerConfirmed({ o: summary, finalTotal: total, deposit, link: customerUrl(orderId) })
        : notifyCustomerReceived({ order, orderNumber, total, pending, link: customerUrl(orderId) }),
    ]);
    if (!mail.ok) console.warn("[orders:notify] no se envió el aviso", orderNumber, mail.error || mail.via);
    return NextResponse.json({
      orderNumber, total, pending, pricePending: pending.length > 0, confirmed,
      deposit: pending.length ? null : depositFor(total),
      trackPath: `/mi-pedido/${orderId}?t=${signLink("cliente", orderId)}`,
      emailed: mail.ok,
    });
  } catch (e) {
    if (e?.userFacing) return fail(e.message, 400);
    console.error("[orders:create]", e);
    return fail("No pudimos guardar tu pedido. Intenta de nuevo o escríbenos.", 500);
  }
}
