import { auth } from "@/auth";
import { getToken } from "next-auth/jwt";
import { NextResponse } from "next/server";

function getApiUrl(): string | null {
  const url = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL;
  if (!url) {
    return null;
  }
  return url.replace(/\/$/, "");
}

const VALID_MIC_TYPES = ["dynamic", "condenser", "headset", "unknown"] as const;
type MicType = (typeof VALID_MIC_TYPES)[number];

function parseMicType(value: FormDataEntryValue | null): MicType {
  if (typeof value === "string" && VALID_MIC_TYPES.includes(value as MicType)) {
    return value as MicType;
  }
  return "unknown";
}

export async function POST(request: Request) {
  const session = await auth();

  let jwt: string | null = null;
  if (session?.user?.id) {
    const token = await getToken({
      req: request,
      raw: true,
      secret: process.env.AUTH_SECRET,
    });
    if (typeof token === "string") {
      jwt = token;
    }
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file is required" }, { status: 400 });
  }

  if (!/\.(wav|mp3)$/i.test(file.name)) {
    return NextResponse.json(
      { error: "Only .wav or .mp3 files are allowed" },
      { status: 400 },
    );
  }

  const apiUrl = getApiUrl();
  if (!apiUrl) {
    return NextResponse.json(
      { error: "Upload service unavailable" },
      { status: 503 },
    );
  }

  const upstream = new FormData();
  upstream.append("file", file, file.name);

  const micType = parseMicType(formData.get("mic_type"));
  const upstreamUrl = `${apiUrl}/upload?mode=standard&mic_type=${encodeURIComponent(micType)}`;

  const headers: HeadersInit = {};
  if (jwt) {
    headers.Authorization = `Bearer ${jwt}`;
  }

  let upstreamRes: Response;
  try {
    upstreamRes = await fetch(upstreamUrl, {
      method: "POST",
      headers,
      body: upstream,
    });
  } catch (error) {
    console.error("FastAPI upload proxy failed:", error);
    return NextResponse.json(
      { error: "Upload service unavailable" },
      { status: 502 },
    );
  }

  const contentType = upstreamRes.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const data = await upstreamRes.json();
    return NextResponse.json(data, { status: upstreamRes.status });
  }

  const text = await upstreamRes.text();
  return new NextResponse(text, { status: upstreamRes.status });
}
