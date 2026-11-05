import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { loadClassifieds } from "@/lib/classifieds";

export const runtime = "nodejs";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const data = loadClassifieds();
    return NextResponse.json({
      countries: data,
      count: Object.keys(data).length,
    });
  } catch (e: any) {
    console.error("[classifieds/countries] error:", e);
    return NextResponse.json(
      { error: `Failed to load countries: ${e.message}` },
      { status: 500 }
    );
  }
}