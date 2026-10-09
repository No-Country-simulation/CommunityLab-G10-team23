import { NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000";

export async function GET() {
  try {
    const res = await fetch(`${BACKEND_URL}/health`, {
      method: "GET",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
    });
    if (res.ok) {
      const data = await res.json();
      return NextResponse.json({ status: "online", backend: data });
    }
    return NextResponse.json({ status: "offline", error: "Backend responded with non-200" });
  } catch (err: any) {
    return NextResponse.json({ status: "offline", error: err.message });
  }
}
