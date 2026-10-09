import { NextResponse } from "next/server";
import { getOrderSummary } from "@/lib/db";
import { verifyLink } from "@/lib/links";
import { depositInfo, payableNow } from "@/lib/payments";
import { stripeEnabled, stripeTestMode } from "@/lib/stripe";
import { isShipping } from "@/lib/validate";

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
  const { paid, due, balance } = depositInfo(o);
  const pay = stripeEnabled() ? payableNow(o) : null;
  return {
    order_number: o.order_number, customer_name: o.customer_name, lang: o.lang, status: o.status,
    delivery_date: o.delivery_date, delivery_time: o.delivery_time, delivery_type: o.delivery_type,
    delivery_address: o.delivery_address, size_label: o.size_label, cake_flavor: o.cake_flavor,
    filling_flavor: o.filling_flavor, design_label: o.design_label, decoration_label: o.decoration_label,
    cake_name: o.cake_name, cake_details: o.cake_details, cake_options: o.cake_options, notes: o.cake_id ? o.design_notes : "",
    has_cake_image: !!o.cake_id, cake_id: o.cake_id,
    price_pending: o.price_pending, pending_items: o.pending_items,
    estimate: Number(o.total || 0), final_total: finalTotal,
    deposit: o.deposit_amount != null ? Number(o.deposit_amount) : null,
    price_confirmed: !!o.price_confirmed_at, customer_confirmed: !!o.customer_confirmed_at,
    paid_amount: paid, deposit_due: due,
    balance, pickup: !isShipping(o.delivery_type),
    can_pay: !!pay, pay_kind: pay?.kind || null, pay_amount: pay?.amount || 0, test_mode: stripeTestMode(),
    pay_online: stripeEnabled(),
  };
}

export async function GET(req, { params }) {
  const { o, err } = await load(params, req.nextUrl.searchParams.get("t"));
  if (err) return err;
  return NextResponse.json(view(o), { headers: { "Cache-Control": "no-store" } });
}
