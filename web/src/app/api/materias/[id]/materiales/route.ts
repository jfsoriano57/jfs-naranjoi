import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getGeminiClient, generateEmbedding } from "@/lib/gemini";
import {
  extractTextFromPDF,
  extractTextFromDocx,
  extractTextFromImage,
  chunkPages,
  ExtractedPage,
} from "@/lib/extractor";
import { NextResponse } from "next/server";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id: subjectId } = await context.params;
  const supabase = await createClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();

  if (authErr || !user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  // Verificar que la materia pertenece al usuario
  const { data: subject, error: subErr } = await supabase
    .from("subjects")
    .select("id")
    .eq("id", subjectId)
    .single();

  if (subErr || !subject) {
    return NextResponse.json({ error: "Materia no encontrada" }, { status: 404 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const title = (formData.get("title") as string) || file?.name || "Sin título";
    const kind = (formData.get("kind") as string) || "otro";

    if (!file) {
      return NextResponse.json({ error: "No se proporcionó ningún archivo" }, { status: 400 });
    }

    // Comprobar que el estudiante tiene configurada su clave de IA
    const { ai } = await getGeminiClient();

    // 1. Crear registro inicial en la tabla documents
    const { data: docRecord, error: docInsertErr } = await supabase
      .from("documents")
      .insert({
        user_id: user.id,
        subject_id: subjectId,
        title,
        kind,
        source: "subido",
        mime_type: file.type,
        size_bytes: file.size,
        status: "procesando",
      })
      .select()
      .single();

    if (docInsertErr || !docRecord) {
      return NextResponse.json({ error: "Error al registrar el documento" }, { status: 500 });
    }

    const fileBuffer = await file.arrayBuffer();
    let pages: ExtractedPage[] = [];

    // 2. Extraer texto según el formato
    if (file.type === "application/pdf") {
      pages = await extractTextFromPDF(fileBuffer, ai);
    } else if (
      file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      file.name.endsWith(".docx")
    ) {
      pages = await extractTextFromDocx(Buffer.from(fileBuffer));
    } else if (file.type.startsWith("image/")) {
      pages = await extractTextFromImage(Buffer.from(fileBuffer), file.type, ai);
    } else if (file.type === "text/plain" || file.name.endsWith(".txt")) {
      const textContent = new TextDecoder().decode(fileBuffer);
      pages = [{ pageNumber: 1, text: textContent }];
    } else {
      // Intento genérico de texto
      const textContent = new TextDecoder().decode(fileBuffer);
      pages = [{ pageNumber: 1, text: textContent }];
    }

    if (pages.length === 0 || pages.every((p) => p.text.length === 0)) {
      await supabase
        .from("documents")
        .update({ status: "error", error: "No se pudo extraer texto del archivo" })
        .eq("id", docRecord.id);
      return NextResponse.json({ error: "El archivo no contiene texto legible" }, { status: 400 });
    }

    // 3. Dividir en fragmentos (chunks)
    const chunks = chunkPages(pages);

    // 4. Generar embeddings y guardar en la base de datos
    // Usamos el cliente de servicio para optimizar inserción por lotes
    const serviceClient = createServiceClient();

    const chunkInserts = [];
    for (const chunk of chunks) {
      try {
        const embedding = await generateEmbedding(ai, chunk.content);
        chunkInserts.push({
          user_id: user.id,
          subject_id: subjectId,
          document_id: docRecord.id,
          page: chunk.pageNumber,
          content: chunk.content,
          embedding: JSON.stringify(embedding),
        });
      } catch (embErr) {
        console.warn("Fallo embedding para un fragmento, guardando sin vector:", embErr);
        chunkInserts.push({
          user_id: user.id,
          subject_id: subjectId,
          document_id: docRecord.id,
          page: chunk.pageNumber,
          content: chunk.content,
          embedding: null,
        });
      }
    }

    if (chunkInserts.length > 0) {
      const { error: insertChunksErr } = await serviceClient
        .from("chunks")
        .insert(chunkInserts);

      if (insertChunksErr) {
        console.error("Error al insertar chunks:", insertChunksErr);
      }
    }

    // 5. Actualizar estado del documento a 'listo'
    await supabase
      .from("documents")
      .update({
        status: "listo",
        pages: pages.length,
      })
      .eq("id", docRecord.id);

    return NextResponse.json({
      success: true,
      document_id: docRecord.id,
      chunks_count: chunkInserts.length,
      pages_count: pages.length,
    });
  } catch (err: unknown) {
    console.error("Error al procesar material:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error al procesar el archivo" },
      { status: 500 }
    );
  }
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id: subjectId } = await context.params;
  const supabase = await createClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();

  if (authErr || !user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("documents")
    .select("*")
    .eq("subject_id", subjectId)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
