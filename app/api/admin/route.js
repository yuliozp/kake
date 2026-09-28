import { NextResponse } from "next/server";
import {
  addDesign, deleteDesign, deleteOption, getFullCatalog, setCategoryActive, updateDesign, upsertOption,
} from "@/lib/db";
import { isAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

const unauthorized = () => NextResponse.json({ error: "Clave incorrecta" }, { status: 401 });

export async function GET(req) {
  if (!isAdmin(req)) return unauthorized();
  try {
    return NextResponse.json(await getFullCatalog());
  } catch (e) {
    console.error("[admin:get]", e);
    return NextResponse.json({ error: "No se pudo cargar el catálogo" }, { status: 500 });
  }
}

export async function POST(req) {
  if (!isAdmin(req)) return unauthorized();
  try {
    const body = await req.json();
    switch (body.type) {
      case "design": await addDesign(body); break;
      case "design_update": await updateDesign(body); break;
      case "design_delete": await deleteDesign(body.id); break;
      case "option_delete": await deleteOption(body.id); break;
      case "category_active": await setCategoryActive(body.category, !!body.active); break;
      default: await upsertOption(body);
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[admin:post]", e);
    return NextResponse.json({ error: String(e?.message || "Error al guardar") }, { status: 500 });
  }
}
