import { createClient } from "@/lib/supabase/server";
import { getGeminiClient, generateEmbedding, generateStudyContent } from "@/lib/gemini";
import { NextResponse } from "next/server";

/**
 * Detecta si el mensaje es un saludo o cortesía inicial para responder
 * de forma inmediata y cálida sin realizar búsquedas innecesarias en los libros.
 */
function isGreeting(text: string): boolean {
  const clean = text
    .trim()
    .toLowerCase()
    .replace(/[¡!¿?.,;:]/g, "")
    .trim();

  const exactGreetings = new Set([
    "hola",
    "buenas",
    "buen dia",
    "buen día",
    "buenos dias",
    "buenos días",
    "buenas tardes",
    "buenas noches",
    "saludos",
    "hola buenas",
    "hola buenas tardes",
    "hola buenos dias",
    "hola buenos días",
    "hola buen dia",
    "hola buen día",
    "hola que tal",
    "hola qué tal",
    "que tal",
    "qué tal",
    "hey",
    "hi",
    "hello",
  ]);

  if (exactGreetings.has(clean)) return true;

  const greetingPrefixes = [
    "hola",
    "buenas",
    "buenos dias",
    "buenos días",
    "buenas tardes",
    "buenas noches",
    "buen dia",
    "buen día",
    "saludos",
  ];

  for (const prefix of greetingPrefixes) {
    if (clean.startsWith(prefix)) {
      const rest = clean.slice(prefix.length).trim();
      if (!rest) return true;
      if (
        /^(jfsp|tutor|profe|profesor|amigo|como estas|cómo estás|como te va|cómo te va|todo bien|amigos)\b/i.test(
          rest
        ) &&
        rest.length < 35
      ) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Limpia frases conversacionales iniciales de la pregunta para mejorar
 * la efectividad del motor de búsqueda Full-Text de PostgreSQL.
 */
function cleanSearchQuery(question: string): string {
  let cleaned = question
    .replace(/[¡!¿?.,;:]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const conversationalPrefixes = [
    /^(a qué llamamos|a que llamamos)\s+/i,
    /^(qué es|que es|cuál es|cual es|qué son|que son|cuáles son|cuales son)\s+/i,
    /^(explícame qué es|explicame que es|explícame|explicame)\s+/i,
    /^(cómo se define|como se define|cómo se calcula|como se calcula)\s+/i,
    /^(dime qué es|dime|por favor|podrías explicarme|podrias explicarme)\s+/i,
    /^(resuelve|calcular|determinar)\s+/i,
  ];

  for (const rx of conversationalPrefixes) {
    cleaned = cleaned.replace(rx, "").trim();
  }

  return cleaned.length > 2 ? cleaned : question;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();

  if (authErr || !user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const { question, subjectIds, conversationId, history } = await request.json();

    if (!question || typeof question !== "string") {
      return NextResponse.json({ error: "La pregunta es requerida" }, { status: 400 });
    }

    if (!Array.isArray(subjectIds) || subjectIds.length === 0) {
      return NextResponse.json({ error: "Debes seleccionar al menos una materia" }, { status: 400 });
    }

    // Identificar o crear la conversación
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

    // 1. GESTIÓN INMEDIATA DE SALUDOS (SIN BÚSQUEDA EN LIBROS NI CITAS)
    if (isGreeting(question)) {
      const { data: subs } = await supabase
        .from("subjects")
        .select("id, name")
        .in("id", subjectIds);
      const subjectNames = (subs || []).map((s: { name: string }) => s.name).join(", ");

      const greetingAnswer = subjectNames
        ? `¡Hola! Soy **JFSP**, tu tutor universitario para **${subjectNames}**.\n\nEstoy listo para acompañarte en tu estudio de tus libros y apuntes. ¿Qué tema, concepto o ejercicio te gustaría que revisemos o resolvamos hoy paso a paso?`
        : `¡Hola! Soy **JFSP**, tu tutor académico universitario.\n\nEstoy listo para resolver tus dudas y explicarte problemas paso a paso con fórmulas. ¿Qué materia o tema deseas estudiar hoy?`;

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
            content: greetingAnswer,
            citations: [],
          },
        ]);
      }

      return NextResponse.json({
        answer: greetingAnswer,
        citations: [],
        conversationId: convId,
      });
    }

    // 2. PREGUNTA DE ESTUDIO: Obtener cliente Gemini
    const { ai } = await getGeminiClient();

    // 3. Generar embedding y limpiar término de búsqueda
    const cleanedQuery = cleanSearchQuery(question);
    let questionEmbedding: number[] | null = null;
    try {
      questionEmbedding = await generateEmbedding(ai, cleanedQuery);
    } catch (e) {
      console.warn("No se pudo generar embedding de la pregunta, se usará búsqueda por texto:", e);
    }

    // 4. Búsqueda híbrida en Supabase (RPC match_chunks)
    let chunks: any[] = [];
    const { data: matchedChunks, error: matchErr } = await supabase.rpc("match_chunks", {
      query_embedding: questionEmbedding ? JSON.stringify(questionEmbedding) : null,
      query_text: cleanedQuery,
      subject_ids: subjectIds,
      match_count: 6,
    });

    if (!matchErr && Array.isArray(matchedChunks)) {
      chunks = matchedChunks;
    }

    // 5. Fallback con operadores OR (|) si la búsqueda estricta no encontró fragmentos
    if (chunks.length === 0) {
      const keywords = cleanedQuery.split(/\s+/).filter((w) => w.length >= 4);
      if (keywords.length > 0) {
        const { data: fallbackChunks } = await supabase
          .from("chunks")
          .select("id, document_id, subject_id, page, content")
          .in("subject_id", subjectIds)
          .textSearch("fts", keywords.join(" | "), { config: "spanish" })
          .limit(6);

        if (fallbackChunks && fallbackChunks.length > 0) {
          chunks = fallbackChunks;
        }
      }
    }

    // 6. Obtener títulos de los documentos para las citas
    const docIds = [...new Set(chunks.map((c: { document_id: string }) => c.document_id))];
    let docMap = new Map<string, string>();
    if (docIds.length > 0) {
      const { data: docs } = await supabase
        .from("documents")
        .select("id, title")
        .in("id", docIds);
      docMap = new Map((docs || []).map((d: { id: string; title: string }) => [d.id, d.title]));
    }

    const citations = chunks.map((c: { document_id: string; page: number | null; content: string }) => ({
      document_id: c.document_id,
      document_title: docMap.get(c.document_id) || "Material de estudio",
      page: c.page,
      snippet: c.content.slice(0, 200),
    }));

    // 7. Armar contexto y prompt para Gemini
    let contextText = "";
    if (chunks.length > 0) {
      contextText = chunks
        .map(
          (c: { document_id: string; page: number | null; content: string }, idx: number) =>
            `[Fragmento ${idx + 1} - ${docMap.get(c.document_id) || "Doc"} (Pág. ${c.page || "N/A"})]:\n${c.content}`
        )
        .join("\n\n---\n\n");
    }

    const systemPrompt = `Eres JFSP, un tutor universitario y pedagógico experto.
Tu misión es resolver las dudas, explicar conceptos y resolver ejercicios de los estudiantes basándote en sus materiales de estudio.

DIRECTRICES FUNDAMENTALES:
1. Responde de forma clara, didáctica y estructurada.
2. Si el problema involucra matemáticas, física, química o ingeniería, desarrolla la solución PASO A PASO usando fórmulas en formato LaTeX (entre $...$ para expresiones en línea o $$...$$ para bloques de fórmulas centradas).
3. SIEMPRE CITA LA FUENTE: Si la respuesta se fundamenta en los fragmentos provistos, indica de dónde proviene usando corchetes como [Libro, pág. X].
4. Si los materiales provistos no son suficientes para responder la duda puntual, responde con tu conocimiento pedagógico indicando claramente: "Nota: Esta respuesta se basa en principios generales de la materia, ya que este detalle específico no se encuentra en las páginas consultadas de tus materiales".`;

    // Armar historial si existe
    const contents: any[] = [];
    if (Array.isArray(history) && history.length > 0) {
      const recentHistory = history.slice(-6);
      for (const msg of recentHistory) {
        if (msg.role === "user" || msg.role === "assistant") {
          contents.push({
            role: msg.role === "assistant" ? "model" : "user",
            parts: [{ text: msg.content }],
          });
        }
      }
    }

    const currentPrompt = contextText
      ? `CONTEXTO DE LOS MATERIALES DEL ESTUDIANTE:\n${contextText}\n\nPREGUNTA DEL ESTUDIANTE:\n${question}`
      : `PREGUNTA DEL ESTUDIANTE:\n${question}`;

    contents.push({
      role: "user",
      parts: [{ text: `${systemPrompt}\n\n${currentPrompt}` }],
    });

    // 8. Generar respuesta con la cascada de modelos
    const response = await generateStudyContent(ai, { contents });
    const answer = response.text || "No se pudo generar una respuesta.";

    // 9. Guardar en historial de mensajes
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
