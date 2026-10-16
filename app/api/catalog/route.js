import { NextResponse } from "next/server";
import { getCatalog } from "@/lib/db";
import { hideDecorationOptions } from "@/lib/hideDecoration";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await hideDecorationOptions().catch(() => {});
    const data = await getCatalog();
    data.options = (data.options || []).filter((o) => o.category !== "decoration").map((o) => {
      if (o.category !== "delivery") return o;
      if (/env[ií]o|domicilio/i.test(o.label || "")) return { ...o, image: "/envio-domicilio.jpg", image_url: "/envio-domicilio.jpg" };
      if (/recogida|tienda|pickup/i.test(o.label || "")) return { ...o, image: "/recogida-tienda.jpg", image_url: "/recogida-tienda.jpg" };
      return o;
    });
    // Quitar el rojo de la personalización de color en todos los pasteles.
    for (const cake of data.cakes || []) {
      for (const opt of cake.options || []) {
        if (/color/i.test(opt.name || "") && Array.isArray(opt.choices)) {
          opt.choices = opt.choices.filter((c) => !/^rojo$/i.test(String(c).trim()));
        }
      }
    }
    return NextResponse.json(data);
  } catch (e) {
    console.error("[catalog]", e);
    return NextResponse.json({ error: "Catálogo no disponible" }, { status: 500 });
  }
}
