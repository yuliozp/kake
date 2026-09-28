import { NextResponse } from "next/server";
import { getOrderImage } from "@/lib/db";
import { isAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Foto de referencia del cliente o evidencia de pago. Solo con sesión admin.
export async function GET(req, { params }) {
  if (!isAdmin(req)) return new NextResponse("No autorizado", { status: 401 });
  const { id } = await params;
  const kind = req.nextUrl.searchParams.get("kind") === "proof" ? "proof" : "design";
  if (!/^\d+$/.test(id)) return new NextResponse("Not found", { status: 404 });
  try {
    const src = await getOrderImage(Number(id), kind);
    const m = /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/.exec(src || "");
    if (!m) return new NextResponse("Not found", { status: 404 });
    return new NextResponse(Buffer.from(m[2], "base64"), {
      headers: {
        "Content-Type": m[1],
        "Cache-Control": "private, no-store",
        "Content-Disposition": `inline; filename="${kind}-${id}.jpg"`,
      },
    });
  } catch (e) {
    console.error("[orders:image]", id, e);
    return new NextResponse("Error", { status: 500 });
  }
}
