import { NextResponse } from "next/server";
import { createOrder, listOrders, priceOrder } from "@/lib/db";
import { notifyNewOrder } from "@/lib/notify";
import { isAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

const MAX_IMAGE = 1_500_000; // ~1.1 MB de foto ya comprimida
const str = (v, max = 200) => String(v ?? "").trim().slice(0, max);

// Solo el panel admin puede ver los pedidos (contienen datos de clientes).
export async function GET(req) {
  if (!isAdmin(req)) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  try {
    return NextResponse.json({ orders: await listOrders() });
  } catch (e) {
    console.error("[orders:list]", e);
    return NextResponse.json({ error: "No se pudieron cargar los pedidos" }, { status: 500 });
  }
}

export async function POST(req) {
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });
  }

  const customer = {
    name: str(body?.customer?.name, 120),
    phone: str(body?.customer?.phone, 40),
    email: str(body?.customer?.email, 160),
    address: str(body?.customer?.address, 300),
    smsOptIn: !!body?.customer?.smsOptIn,
  };
  if (!customer.name || !customer.phone || !customer.email) {
    return NextResponse.json({ error: "Faltan nombre, teléfono o correo" }, { status: 400 });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email)) {
    return NextResponse.json({ error: "El correo no es válido" }, { status: 400 });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(body.deliveryDate || "")) {
    return NextResponse.json({ error: "Elige una fecha de entrega" }, { status: 400 });
  }
  const designImage = typeof body.designImage === "string" ? body.designImage : "";
  if (designImage.length > MAX_IMAGE) {
    return NextResponse.json({ error: "La foto es muy pesada. Prueba con otra." }, { status: 413 });
  }

  const order = {
    customer,
    lang: body.lang === "en" ? "en" : "es",
    deliveryType: str(body.deliveryType, 120),
    deliveryAddress: str(body.deliveryAddress, 300),
    deliveryDate: body.deliveryDate,
    deliveryTime: str(body.deliveryTime, 10),
    size: str(body.size, 120),
    cakeFlavor: str(body.cakeFlavor, 120),
    fillingFlavor: str(body.fillingFlavor, 120),
    fillingCountLabel: str(body.fillingCount, 120),
    designId: body.designId ? str(body.designId, 20) : null,
    designLabel: str(body.designLabel, 120),
    designNotes: str(body.designNotes, 1000),
    designImage,
  };

  try {
    const total = await priceOrder(order);
    const { orderNumber } = await createOrder(order, total);
    const mail = await notifyNewOrder(orderNumber, order, total);
    if (!mail.ok) console.warn("[orders:notify] no se envió el aviso", orderNumber, mail.error || mail.via);
    return NextResponse.json({ orderNumber, total, emailed: mail.ok });
  } catch (e) {
    console.error("[orders:create]", e);
    const msg = String(e?.message || "");
    const userFacing = msg.includes("ya no está disponible") ? msg : "No pudimos guardar tu pedido. Intenta de nuevo o escríbenos.";
    return NextResponse.json({ error: userFacing }, { status: 500 });
  }
}
