import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const consent =
    typeof body === "object" &&
    body !== null &&
    "consent" in body &&
    typeof (body as { consent: unknown }).consent === "boolean"
      ? (body as { consent: boolean }).consent
      : null;

  if (consent === null) {
    return NextResponse.json(
      { error: "Expected { consent: boolean }" },
      { status: 400 },
    );
  }

  const supabaseAdmin = getSupabaseAdmin();

  const { data, error } = await supabaseAdmin
    .from("profiles")
    .update({ training_data_consent: consent })
    .eq("id", session.user.id)
    .select("training_data_consent")
    .maybeSingle();

  if (error) {
    console.error("Failed to update training_data_consent:", error.message);
    return NextResponse.json(
      { error: "Failed to update preference" },
      { status: 500 },
    );
  }

  if (!data) {
    return NextResponse.json(
      { error: "Profile not found" },
      { status: 404 },
    );
  }

  return NextResponse.json({
    training_data_consent: data.training_data_consent === true,
  });
}
