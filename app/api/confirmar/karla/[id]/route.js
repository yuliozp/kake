import { NextResponse } from "next/server";
import { getOrderSummary, karlaConfirm } from "@/lib/db";
import { verifyLink, customerUrl, signLink } from "@/lib/links";
import { depositFor, money, sameOrigin } from "@/lib/validate";
import { notifyCustomerConfirmed, notifyCustomerPrice } from "@/lib/notify";

export const dynamic = "force-dynamic";
const fail = (error, status = 400) => NextResponse.json({ error }, { status, headers: { "Cache-Control": "no-store" } });

async function load(params, token) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) return { err: fail("Pedido no encontrado", 404) };
  const oid = Number(id);
  if (!verifyLink("karla", oid, token)) return { err: fail("Enlace no válido", 403) };
  const o = await getOrderSummary(oid);
  if (!o) return { err: fail("Pedido no encontrado", 404) };
  return { o, oid };
}

function view(o, oid) {
  return {
    ...o,
    total: Number(o.total || 0),
    final_total: o.final_total != null ? Number(o.final_total) : null,
    deposit_amount: o.deposit_amount != null ? Number(o.deposit_amount) : null,
    photo_token: signLink("karla", oid),
  };
}

export async function GET(req, { params }) {
  const { o, oid, err } = await load(params, req.nextUrl.searchParams.get("t"));
  if (err) return err;
  return NextResponse.json(view(o, oid), { headers: { "Cache-Control": "no-store" } });
}

// Karla confirma y pone el precio final.
export async function POST(req, { params }) {
  if (!sameOrigin(req)) return fail("Origen no permitido", 403);
  const body = await req.json().catch(() => ({}));
  const { o, oid, err } = await load(params, body.t);
  if (err) return err;
  if (o.status !== "nuevo" || o.customer_confirmed_at) return fail("Este pedido ya fue confirmado o cancelado.", 409);
  const finalTotal = money(body.finalTotal);
  if (finalTotal === null || finalTotal <= 0) return fail("Escribe el precio final del pedido.");
  const estimate = Number(o.total || 0);
  // Si el precio estaba por confirmar o Karla lo cambió, el cliente debe aprobarlo.
  const needsCustomer = !!o.price_pending || Math.abs(finalTotal - estimate) >= 0.01;
  const deposit = depositFor(finalTotal);
  try {
    const ok = await karlaConfirm(oid, finalTotal, deposit, needsCustomer);
    if (!ok) return fail("Este pedido ya fue confirmado o cancelado.", 409);
    const link = customerUrl(oid);
    const mail = needsCustomer
      ? await notifyCustomerPrice({ o, finalTotal, deposit, link })
      : await notifyCustomerConfirmed({ o, finalTotal, deposit, link });
    return NextResponse.json({ ok: true, needsCustomer, finalTotal, deposit, emailed: !!mail?.ok });
  } catch (e) {
    console.error("[confirmar:karla]", oid, e);
    return fail("No se pudo confirmar. Intenta de nuevo.", 500);
  }
}
