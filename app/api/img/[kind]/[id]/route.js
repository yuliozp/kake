import { NextResponse } from "next/server";
import { getImage } from "@/lib/db";

export const dynamic = "force-dynamic";

// Fotos públicas del catálogo, servidas con caché larga.
export async function GET(_req, { params }) {
  const { kind, id } = await params;
  if (!["option", "design"].includes(kind) || !/^\d+$/.test(id)) {
    return new NextResponse("Not found", { status: 404 });
  }
  try {
    const src = await getImage(kind, Number(id));
    if (!src) return new NextResponse("Not found", { status: 404 });
    if (/^https:\/\//.test(src)) return NextResponse.redirect(src, 302);
    const m = /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/.exec(src);
    if (!m) return new NextResponse("Not found", { status: 404 });
    return new NextResponse(Buffer.from(m[2], "base64"), {
      headers: {
        "Content-Type": m[1],
        // La URL lleva ?v=<hash>, así que cambia sola cuando se edita la foto.
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (e) {
    console.error("[img]", e);
    return new NextResponse("Error", { status: 500 });
  }
}
