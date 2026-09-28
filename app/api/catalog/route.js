import { NextResponse } from "next/server";
import { getCatalog } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(await getCatalog());
  } catch (e) {
    console.error("[catalog]", e);
    return NextResponse.json({ error: "Catálogo no disponible" }, { status: 500 });
  }
}
