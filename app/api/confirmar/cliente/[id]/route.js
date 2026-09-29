import { NextResponse } from "next/server";
import { customerConfirm, getOrderSummary } from "@/lib/db";
import { customerUrl, verifyLink, siteUrl } from "@/lib/links";
import { depositFor, sameOrigin } from "@/lib/validate";
import { notifyCustomerConfirmed, notifyKarlaCustomerConfirmed } from "@/lib/notify";

export const dynamic = "force-dynamic";
const fail = (error, status = 400) => NextResponse.json({ error }, { status, headers: { "Cache-Control": "no-store" } });

async function load(params, token) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) return { err: fail("Not found", 404) };
  const oid = Number(id);
  if (!verifyLink("cliente", oid, token)) return { err: fail("Invalid link", 403) };
  const o = await getOrderSummary(oid);
  if (!o) return { err: fail("Not found", 404) };
  return { o, oid };
}

// Lo que ve el cliente: sin datos internos.
function view(o) {
  const finalTotal = o.final_total != null ? Number(o.final_total) : null;
  return {
    order_number: o.order_number, customer_name: o.customer_name, lang: o.lang, status: o.status,
    delivery_date: o.delivery_date, delivery_time: o.delivery_time, delivery_type: o.delivery_type,
    delivery_address: o.delivery_address, size_label: o.size_label, cake_flavor: o.cake_flavor,
    filling_flavor: o.filling_flavor, design_label: o.design_label, decoration_label: o.decoration_label,
    price_pending: o.price_pending, pending_items: o.pending_items,
    estimate: Number(o.total || 0), final_total: finalTotal,
    deposit: o.deposit_amount != null ? Number(o.deposit_amount) : null,
    price_confirmed: !!o.price_confirmed_at, customer_confirmed: !!o.customer_confirmed_at,
  };
}

export async function GET(req, { params }) {
  const { o, err } = await load(params, req.nextUrl.searchParams.get("t"));
  if (err) return err;
  return NextResponse.json(view(o), { headers: { "Cache-Control": "no-store" } });
}

// El cliente aprueba el precio final.
export async function POST(req, { params }) {
  if (!sameOrigin(req)) return fail("Origen no permitido", 403);
  const body = await req.json().catch(() => ({}));
  const { o, oid, err } = await load(params, body.t);
  if (err) return err;
  if (!o.price_confirmed_at) return fail(o.lang === "en" ? "Karla hasn't set the final price yet." : "Karla todavía no confirma el precio.", 409);
  if (o.customer_confirmed_at || o.status !== "nuevo") return NextResponse.json({ ok: true, already: true, ...view(o) });
  try {
    const ok = await customerConfirm(oid);
    if (!ok) return fail("No se pudo confirmar.", 409);
    const finalTotal = Number(o.final_total);
    const deposit = o.deposit_amount != null ? Number(o.deposit_amount) : depositFor(finalTotal);
    await Promise.all([
      notifyCustomerConfirmed({ o, finalTotal, deposit, link: customerUrl(oid) }),
      notifyKarlaCustomerConfirmed({ o, finalTotal, deposit, adminLink: `${siteUrl()}/admin` }),
    ]);
    const fresh = await getOrderSummary(oid);
    return NextResponse.json({ ok: true, ...view(fresh) });
  } catch (e) {
    console.error("[confirmar:cliente]", oid, e);
    return fail("No se pudo confirmar. Intenta de nuevo.", 500);
  }
}
