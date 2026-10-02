import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import {
  addDesign, deleteCake, deleteDesign, deleteOption, deleteSitePhoto, getFullCatalog, moveSitePhoto, setCategoryActive,
  setSetting, updateDesign, upsertCake, upsertOption, upsertSitePhoto,
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
      case "cake": await upsertCake(body); break;
      case "cake_delete": await deleteCake(Number(body.id)); break;
      case "setting":
        if (body.key !== "custom_cake") return fail("Ajuste inválido", 400);
        await setSetting("custom_cake", body.value ? "on" : "off");
        break;
      // Personalizar web: la portada se regenera en la siguiente visita.
      case "site_photo": await upsertSitePhoto(body); revalidatePath("/"); break;
      case "site_photo_delete": await deleteSitePhoto(Number(body.id)); revalidatePath("/"); break;
      case "site_photo_move": await moveSitePhoto(Number(body.id), Number(body.dir) < 0 ? -1 : 1); revalidatePath("/"); break;
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
    return /obligatorio|Agrega|inválida/.test(msg) ? fail(msg, 400) : fail("Error al guardar", 500);
  }
}
