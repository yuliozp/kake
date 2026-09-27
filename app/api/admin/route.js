import { NextResponse } from "next/server";
import { addDesign, getFullCatalog, upsertModel, upsertOption } from "@/lib/db";

export const dynamic = "force-dynamic";

function authorized(req) {
  const key = process.env.ADMIN_KEY || "kake";
  const header = req.headers.get("x-admin-key") || "";
  return header === key;
}

export async function GET(req) {
  if (!authorized(req)) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  try {
    const data = await getFullCatalog();
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: String(e.message || e) }, { status: 500 });
  }
}

export async function POST(req) {
  if (!authorized(req)) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  try {
    const body = await req.json();
    if (body.type === "design") await addDesign(body);
    else if (body.type === "model") await upsertModel(body);
    else await upsertOption(body);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e.message || e) }, { status: 500 });
  }
}
