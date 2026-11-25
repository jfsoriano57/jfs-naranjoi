import { createClient } from "@/lib/supabase/server";
import { getGeminiClient, generateEmbedding, generateStudyContent } from "@/lib/gemini";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();

  if (authErr || !user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const { question, subjectIds, conversationId } = await request.json();

    if (!question || typeof question !== "string") {
      return NextResponse.json({ error: "La pregunta es requerida" }, { status: 400 });
    }

    if (!Array.isArray(subjectIds) || subjectIds.length === 0) {
      return NextResponse.json({ error: "Debes seleccionar al menos una materia" }, { status: 400 });
    }

    // 1. Obtener cliente Gemini del alumno
    const { ai } = await getGeminiClient();

    // 2. Generar embedding de la pregunta
    let questionEmbedding: number[] | null = null;
    try {
      questionEmbedding = await generateEmbedding(ai, question);
    } catch (e) {
      console.warn("No se pudo generar embedding de la pregunta, se usará búsqueda por texto:", e);
    }

    // 3. Ejecutar búsqueda híbrida en Supabase (RPC match_chunks)
    const { data: chunks, error: matchErr } = await supabase.rpc("match_chunks", {
      query_embedding: questionEmbedding ? JSON.stringify(questionEmbedding) : null,
      query_text: question,
      subject_ids: subjectIds,
      match_count: 6,
    });

    if (matchErr) {
      console.error("Error en match_chunks:", matchErr);
    }

    // 4. Obtener títulos de los documentos para las citas
    const docIds = [...new Set((chunks || []).map((c: { document_id: string }) => c.document_id))];
    const { data: docs } = await supabase
      .from("documents")
      .select("id, title")
      .in("id", docIds);

    const docMap = new Map((docs || []).map((d: { id: string; title: string }) => [d.id, d.title]));

    // Construir citas formateadas
    const citations = (chunks || []).map((c: { document_id: string; page: number | null; content: string }) => ({
      document_id: c.document_id,
      document_title: docMap.get(c.document_id) || "Material de estudio",
      page: c.page,
      snippet: c.content.slice(0, 200),
    }));

    // 5. Armar el prompt con el contexto extraído
    let contextText = "";
    if (chunks && chunks.length > 0) {
      contextText = chunks
        .map(
          (c: { document_id: string; page: number | null; content: string }, idx: number) =>
            `[Fragmento ${idx + 1} - ${docMap.get(c.document_id) || "Doc"} (Pág. ${c.page || "N/A"})]:\n${c.content}`
        )
        .join("\n\n---\n\n");
    }

    const systemPrompt = `Eres NARANJO, un tutor universitario y pedagógico experto.
Tu misión es resolver las dudas, explicar conceptos y resolver ejercicios de los estudiantes basándote en sus materiales de estudio.

DIRECTRICES FUNDAMENTALES:
1. Responde de forma clara, didáctica y estructurada.
2. Si el problema involucra matemáticas, física, química o ingeniería, desarrolla la solución PASO A PASO usando fórmulas en formato LaTeX (entre $...$ para expresiones en línea o $$...$$ para bloques de fórmulas).
3. SIEMPRE CITA LA FUENTE: Si la respuesta se fundamenta en los fragmentos provistos, indica de dónde proviene usando corchetes como [Libro, pág. X].
4. Si los materiales provistos no son suficientes para responder la duda, responde con tu conocimiento general indicando claramente: "Nota: Esta respuesta se basa en conocimiento general, ya que no se encuentra detallado en los materiales subidos".`;

    const userPrompt = contextText
      ? `CONTEXTO DE LOS MATERIALES DEL ESTUDIANTE:\n${contextText}\n\nPREGUNTA DEL ESTUDIANTE:\n${question}`
      : `PREGUNTA DEL ESTUDIANTE:\n${question}`;

    // 6. Generar respuesta con Gemini
    const response = await generateStudyContent(ai, {
      contents: [{ role: "user", parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] }],
    });

    const answer = response.text || "No se pudo generar una respuesta.";

    // 7. Guardar en historial de mensajes
    let convId = conversationId;
    if (!convId) {
      const { data: newConv } = await supabase
        .from("conversations")
        .insert({
          user_id: user.id,
          title: question.slice(0, 60),
          subject_ids: subjectIds,
        })
        .select()
        .single();
      convId = newConv?.id;
    }

    if (convId) {
      await supabase.from("messages").insert([
        {
          conversation_id: convId,
          user_id: user.id,
          role: "user",
          content: question,
          citations: [],
        },
        {
          conversation_id: convId,
          user_id: user.id,
          role: "assistant",
          content: answer,
          citations,
        },
      ]);
    }

    return NextResponse.json({
      answer,
      citations,
      conversationId: convId,
    });
  } catch (err: unknown) {
    console.error("Error en Tutor IA:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error al procesar la consulta" },
      { status: 500 }
    );
  }
}
