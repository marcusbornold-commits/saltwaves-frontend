import { auth } from "@/auth";
import { getToken } from "next-auth/jwt";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ token: null });
  }
  const token = await getToken({
    req: request,
    raw: true,
    secret: process.env.AUTH_SECRET,
  });
  return NextResponse.json({ token: typeof token === "string" ? token : null });
}
