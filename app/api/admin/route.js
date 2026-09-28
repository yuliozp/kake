import { NextResponse } from "next/server";
import {
  addDesign, deleteDesign, deleteOption, getFullCatalog, setCategoryActive, updateDesign, upsertOption,
} from "@/lib/db";
import { isAdmin } from "@/lib/auth";
import { CATEGORIES, isCatalogImage, sameOrigin } from "@/lib/validate";

export const dynamic = "force-dynamic";

const fail = (error, status) => NextResponse.json({ error }, { status });
const validId = (v) => Number.isInteger(Number(v)) && Number(v) > 0;

export async function GET(req) {
  if (!isAdmin(req)) return fail("Sesión vencida. Vuelve a entrar.", 401);
  try {
    return NextResponse.json(await getFullCatalog(), { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("[admin:get]", e);
    return fail("No se pudo cargar el catálogo", 500);
  }
}

export async function POST(req) {
  if (!isAdmin(req)) return fail("Sesión vencida. Vuelve a entrar.", 401);
  if (!sameOrigin(req)) return fail("Origen no permitido", 403);
  let body;
  try {
    body = await req.json();
  } catch {
    return fail("Solicitud inválida", 400);
  }
  const image = body.image_url ?? body.image;
  if (!isCatalogImage(image)) return fail("La foto no es válida o es muy pesada", 400);
  if (body.id != null && !validId(body.id)) return fail("Registro inválido", 400);
  try {
    switch (body.type) {
      case "design": await addDesign(body); break;
      case "design_update": await updateDesign(body); break;
      case "design_delete": await deleteDesign(Number(body.id)); break;
      case "option_delete": await deleteOption(Number(body.id)); break;
      case "category_active":
        if (!CATEGORIES.includes(body.category)) return fail("Categoría inválida", 400);
        await setCategoryActive(body.category, !!body.active);
        break;
      default:
        if (!CATEGORIES.includes(body.category)) return fail("Categoría inválida", 400);
        await upsertOption(body);
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[admin:post]", e);
    const msg = String(e?.message || "");
    return fail(/obligatorio|Agrega/.test(msg) ? msg : "Error al guardar", 500);
  }
}
