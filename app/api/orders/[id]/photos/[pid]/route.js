import { NextResponse } from "next/server";
import { getOrderPhoto } from "@/lib/db";
import { isAdmin } from "@/lib/auth";
import { verifyLink } from "@/lib/links";

export const dynamic = "force-dynamic";

// Fotos de decoración del cliente: solo con sesión admin o con el enlace de Karla.
export async function GET(req, { params }) {
  const { id, pid } = await params;
  if (!/^\d+$/.test(id) || !/^\d+$/.test(pid)) return new NextResponse("Not found", { status: 404 });
  const oid = Number(id);
  if (!isAdmin(req) && !verifyLink("karla", oid, req.nextUrl.searchParams.get("t"))) {
    return new NextResponse("No autorizado", { status: 401 });
  }
  const src = await getOrderPhoto(oid, Number(pid)).catch(() => null);
  const m = /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/.exec(src || "");
  if (!m) return new NextResponse("Not found", { status: 404 });
  return new NextResponse(Buffer.from(m[2], "base64"), {
    headers: { "Content-Type": m[1], "Cache-Control": "private, no-store" },
  });
}
