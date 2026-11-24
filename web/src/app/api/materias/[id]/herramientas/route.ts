import { createClient } from "@/lib/supabase/server";
import { getGeminiClient } from "@/lib/gemini";
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

  try {
    const { action, topic, examDate } = await request.json();
    const { ai } = await getGeminiClient();

    // Obtener los fragmentos de conocimiento de la materia
    const { data: chunks } = await supabase
      .from("chunks")
      .select("content, page")
      .eq("subject_id", subjectId)
      .limit(30);

    const contextText = (chunks || [])
      .map((c) => `[Pág. ${c.page || "N/A"}]: ${c.content}`)
      .join("\n\n");

    if (action === "resumen") {
      const prompt = `Actúa como profesor universitario. Con base en los siguientes materiales de la materia, genera un resumen estructurado y profundo del tema: "${topic || "Temas principales"}".
Incluye:
1. Ideas clave y definiciones indispensables.
2. Fórmulas o leyes fundamentales (en formato LaTeX).
3. Aplicaciones prácticas o ejemplos de examen.

MATERIALES:
${contextText || "Usa conocimiento general de la materia si el contexto es breve."}`;

      const res = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [{ role: "user", parts: [{ text: prompt }] }],
      });

      return NextResponse.json({ result: res.text });
    }

    if (action === "cuestionario") {
      const prompt = `Genera un cuestionario de práctica para preparar un examen sobre esta materia.
Devuelve exactamente 5 preguntas tipo test de opción múltiple en formato JSON con la siguiente estructura:
[
  {
    "question": "Texto de la pregunta",
    "options": ["Opción A", "Opción B", "Opción C", "Opción D"],
    "answerIndex": 0,
    "explanation": "Explicación didáctica y cita de por qué es la correcta"
  }
]
Devuelve únicamente el array JSON válido sin bloques markdown adicionales.

MATERIALES:
${contextText || "Genera preguntas típicas del programa universitario estándar de la materia."}`;

      const res = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [{ role: "user", parts: [{ text: prompt }] }],
      });

      let jsonText = (res.text || "").trim();
      if (jsonText.startsWith("```json")) {
        jsonText = jsonText.replace(/^```json/, "").replace(/```$/, "").trim();
      } else if (jsonText.startsWith("```")) {
        jsonText = jsonText.replace(/^```/, "").replace(/```$/, "").trim();
      }

      const questions = JSON.parse(jsonText);
      return NextResponse.json({ questions });
    }

    if (action === "flashcards") {
      const prompt = `Genera 6 tarjetas de memoria (flashcards) de conceptos de alto valor para repaso espaciado.
Devuelve únicamente un array JSON con esta estructura:
[
  {
    "front": "Pregunta o concepto clave",
    "back": "Definición concisa, fórmula o respuesta exacta"
  }
]

MATERIALES:
${contextText || "Conceptos esenciales de la materia."}`;

      const res = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [{ role: "user", parts: [{ text: prompt }] }],
      });

      let jsonText = (res.text || "").trim();
      if (jsonText.startsWith("```json")) {
        jsonText = jsonText.replace(/^```json/, "").replace(/```$/, "").trim();
      } else if (jsonText.startsWith("```")) {
        jsonText = jsonText.replace(/^```/, "").replace(/```$/, "").trim();
      }

      const flashcards = JSON.parse(jsonText);
      return NextResponse.json({ flashcards });
    }

    if (action === "plan_estudio") {
      const prompt = `El estudiante tiene un examen el día: ${examDate || "en las próximas semanas"}.
Basándote en el contenido de sus materiales y el programa, genera un plan de estudio semanal detallado y organizado por días para llegar preparado con éxito.
Incluye temas a repasar cada día y técnicas recomendadas (fórmulas a memorizar, ejercicios a practicar).

MATERIALES DE LA MATERIA:
${contextText || "Estructura estándar de la materia."}`;

      const res = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [{ role: "user", parts: [{ text: prompt }] }],
      });

      return NextResponse.json({ result: res.text });
    }

    return NextResponse.json({ error: "Acción no reconocida" }, { status: 400 });
  } catch (err: unknown) {
    console.error("Error en herramientas de estudio:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error al generar herramienta de estudio" },
      { status: 500 }
    );
  }
}
