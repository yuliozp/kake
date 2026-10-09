import { NextResponse } from "next/server";
import { getCatalog } from "@/lib/db";
import { hideDecorationOptions } from "@/lib/hideDecoration";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await hideDecorationOptions().catch(() => {});
    const data = await getCatalog();
    data.options = (data.options || []).filter((o) => o.category !== "decoration");
    return NextResponse.json(data);
  } catch (e) {
    console.error("[catalog]", e);
    return NextResponse.json({ error: "Catálogo no disponible" }, { status: 500 });
  }
}
