import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { z } from "zod";

const materiaSchema = z.object({
  name: z.string().min(1, "El nombre es obligatorio").max(120),
  career: z.string().nullable().optional(),
  term: z.string().nullable().optional(),
  color: z.string().default("#f97316"),
  exam_date: z.string().nullable().optional(),
});

export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();

  if (authErr || !user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("subjects")
    .select("*, documents(count)")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();

  if (authErr || !user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const json = await request.json();
    const parsed = materiaSchema.parse(json);

    const { data, error } = await supabase
      .from("subjects")
      .insert({
        user_id: user.id,
        name: parsed.name,
        career: parsed.career || null,
        term: parsed.term || null,
        color: parsed.color,
        exam_date: parsed.exam_date || null,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0]?.message ?? "Datos inválidos" }, { status: 400 });
    }
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
