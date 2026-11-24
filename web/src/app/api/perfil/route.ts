import { createClient } from "@/lib/supabase/server";
import { encrypt, decrypt } from "@/lib/crypto";
import { NextResponse } from "next/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("display_name, gemini_key_enc, daily_quota")
    .eq("id", user.id)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    display_name: data.display_name,
    has_gemini_key: Boolean(data.gemini_key_enc),
    daily_quota: data.daily_quota,
  });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const { apiKey, displayName } = await request.json();

    const updatePayload: {
      display_name?: string;
      gemini_key_enc?: string | null;
    } = {};

    if (typeof displayName === "string") {
      updatePayload.display_name = displayName.trim();
    }

    if (apiKey !== undefined) {
      if (!apiKey || apiKey.trim() === "") {
        // Eliminar clave
        updatePayload.gemini_key_enc = null;
      } else {
        // Cifrar clave con AES-256 antes de guardarla en base de datos
        const trimmed = apiKey.trim();
        updatePayload.gemini_key_enc = encrypt(trimmed);
      }
    }

    const { error } = await supabase
      .from("profiles")
      .update(updatePayload)
      .eq("id", user.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    return NextResponse.json({ error: "Error al actualizar perfil" }, { status: 500 });
  }
}
