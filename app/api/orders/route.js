import { NextResponse } from "next/server";
import { createOrder, listOrders } from "@/lib/db";
import { notifyNewOrder } from "@/lib/notify";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const orders = await listOrders();
    return NextResponse.json({ orders });
  } catch (e) {
    return NextResponse.json({ error: String(e.message || e) }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const body = await req.json();
    if (!body?.customer?.name || !body?.customer?.phone || !body?.customer?.email) {
      return NextResponse.json({ error: "Datos de cliente incompletos" }, { status: 400 });
    }
    const result = await createOrder(body);
    const mail = await notifyNewOrder(result.orderNumber, body);
    return NextResponse.json({ ...result, emailed: mail.ok, emailVia: mail.via });
  } catch (e) {
    return NextResponse.json({ error: String(e.message || e) }, { status: 500 });
  }
}
