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
    const serviceClient = createServiceClient();
    let title = "Sin título";
    let kind = "otro";
    let mimeType = "application/pdf";
    let sizeBytes = 0;
    let storagePath: string | null = null;
    let fileBuffer: ArrayBuffer | null = null;

    const contentType = request.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      const body = await request.json();
      storagePath = body.storagePath;
      title = body.title || "Sin título";
      kind = body.kind || "otro";
      sizeBytes = body.sizeBytes || 0;
      mimeType = body.mimeType || "application/pdf";

      if (!storagePath) {
        return NextResponse.json({ error: "No se especificó la ruta del archivo" }, { status: 400 });
      }

      // Descargar desde Supabase Storage usando service role client
      const { data: fileBlob, error: downloadErr } = await serviceClient.storage
        .from("materiales")
        .download(storagePath);

      if (downloadErr || !fileBlob) {
        return NextResponse.json(
          { error: `No se pudo descargar el archivo de almacenamiento: ${downloadErr?.message || "Archivo no encontrado"}` },
          { status: 500 }
        );
      }

      fileBuffer = await fileBlob.arrayBuffer();
    } else {
      // Fallback FormData para archivos pequeños
      const formData = await request.formData();
      const file = formData.get("file") as File | null;
      if (!file) {
        return NextResponse.json({ error: "No se proporcionó ningún archivo" }, { status: 400 });
      }
      title = (formData.get("title") as string) || file.name || "Sin título";
      kind = (formData.get("kind") as string) || "otro";
      mimeType = file.type || "application/pdf";
      sizeBytes = file.size;
      fileBuffer = await file.arrayBuffer();
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
        storage_path: storagePath,
        mime_type: mimeType,
        size_bytes: sizeBytes,
        status: "procesando",
      })
      .select()
      .single();

    if (docInsertErr || !docRecord) {
      return NextResponse.json({ error: "Error al registrar el documento" }, { status: 500 });
    }

    let pages: ExtractedPage[] = [];

    // 2. Extraer texto según el formato
    if (mimeType === "application/pdf" || title.toLowerCase().endsWith(".pdf")) {
      pages = await extractTextFromPDF(fileBuffer, ai);
    } else if (
      mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      title.toLowerCase().endsWith(".docx")
    ) {
      pages = await extractTextFromDocx(Buffer.from(fileBuffer));
    } else if (mimeType.startsWith("image/")) {
      pages = await extractTextFromImage(Buffer.from(fileBuffer), mimeType, ai);
    } else {
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

    // 4. Preparar inserción de fragmentos
    // PostgreSQL Full-Text Search (FTS) funciona instantáneamente para todos los fragmentos
    const allChunksToInsert = chunks.map((c) => ({
      user_id: user.id,
      subject_id: subjectId,
      document_id: docRecord.id,
      page: c.pageNumber,
      content: c.content,
      embedding: null as string | null,
    }));

    // Generar embeddings para una muestra clave de fragmentos en paralelo
    // para mantener el tiempo de respuesta en Vercel rápido y sin timeouts
    const EMBED_COUNT = Math.min(chunks.length, 25);
    const embedPromises = chunks.slice(0, EMBED_COUNT).map(async (c, idx) => {
      try {
        const emb = await generateEmbedding(ai, c.content);
        allChunksToInsert[idx].embedding = JSON.stringify(emb);
      } catch (embErr) {
        // Fallback transparente: FTS cubre los fragmentos sin vector
      }
    });

    await Promise.allSettled(embedPromises);

    // Insertar en Supabase en lotes de 150 filas
    const BATCH_SIZE = 150;
    for (let i = 0; i < allChunksToInsert.length; i += BATCH_SIZE) {
      const batch = allChunksToInsert.slice(i, i + BATCH_SIZE);
      const { error: insErr } = await serviceClient.from("chunks").insert(batch);
      if (insErr) {
        console.error("Error al insertar lote de chunks:", insErr);
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
      chunks_count: allChunksToInsert.length,
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
