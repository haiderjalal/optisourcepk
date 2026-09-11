import { NextResponse } from "next/server";
import type { ApiResponse } from "@/types/api";

export const dynamic = "force-dynamic";

/**
 * Liveness probe. Reports that the app is serving; deliberately says nothing
 * about internals, versions or dependencies.
 */
export function GET(): NextResponse<ApiResponse<{ status: "ok" }>> {
  return NextResponse.json({
    success: true,
    message: "Service is healthy.",
    data: { status: "ok" },
  });
}
