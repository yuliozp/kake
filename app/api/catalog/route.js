import { NextResponse } from "next/server";
import { getCatalog } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await getCatalog();
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: String(e.message || e) }, { status: 500 });
  }
}
