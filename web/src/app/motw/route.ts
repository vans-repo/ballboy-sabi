import { connection, NextResponse } from "next/server";

import { currentMotw } from "@/lib/motw";

/** /motw always points at this week's Match of the Week (or its fallback). */
export async function GET(request: Request) {
  await connection();
  const w = await currentMotw(Date.now());
  return NextResponse.redirect(new URL(`/motw/${w.key}`, request.url), 307);
}
