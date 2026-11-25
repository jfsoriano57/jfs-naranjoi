import { GoogleGenAI } from "@google/genai";
import { createClient } from "@/lib/supabase/server";
import { decrypt } from "@/lib/crypto";

/**
 * Obtiene una instancia del SDK de Google Gemini con la clave del estudiante actual.
 * Si el estudiante no ha configurado su clave, recurre a la clave del entorno (si existe).
 */
export async function getGeminiClient(): Promise<{
  ai: GoogleGenAI;
  isPersonalKey: boolean;
}> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Usuario no autenticado");
  }

  // Buscar si el alumno tiene clave propia cifrada
  const { data: profile } = await supabase
    .from("profiles")
    .select("gemini_key_enc")
    .eq("id", user.id)
    .single();

  if (profile?.gemini_key_enc) {
    try {
      const apiKey = decrypt(profile.gemini_key_enc);
      if (apiKey && apiKey.trim().length > 0) {
        return {
          ai: new GoogleGenAI({ apiKey }),
          isPersonalKey: true,
        };
      }
    } catch (err) {
      console.error("Error al descifrar la clave personal de Gemini:", err);
    }
  }

  // Clave del sistema por defecto (si la hubiera)
  const systemKey = process.env.GEMINI_API_KEY;
  if (systemKey && systemKey.trim().length > 0) {
    return {
      ai: new GoogleGenAI({ apiKey: systemKey }),
      isPersonalKey: false,
    };
  }

  throw new Error(
    "Debes configurar tu clave gratuita de Google Gemini en la sección 'Mi Clave IA' para continuar."
  );
}

export const PRIMARY_STUDY_MODEL = "gemini-3.5-flash-lite";

/**
 * Genera contenido de estudio de forma ultra-rápida y confiable con reintentos instantáneos.
 */
export async function generateStudyContent(
  ai: GoogleGenAI,
  params: {
    contents: any;
    systemInstruction?: string;
    temperature?: number;
  }
) {
  let lastError: unknown = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash-lite",
        contents: params.contents,
        config: {
          systemInstruction: params.systemInstruction,
          temperature: params.temperature ?? 0.6,
        },
      });
      return response;
    } catch (err) {
      lastError = err;
      if (attempt < 3) {
        await new Promise((r) => setTimeout(r, 400));
      }
    }
  }
  throw lastError;
}

/**
 * Genera el vector embedding (768 dimensiones) para un fragmento de texto usando Gemini.
 */
export async function generateEmbedding(ai: GoogleGenAI, text: string): Promise<number[]> {
  try {
    const response = await ai.models.embedContent({
      model: "gemini-embedding-001",
      contents: text,
      config: {
        outputDimensionality: 768,
      },
    });

    const resAny = response as unknown as {
      embedding?: { values?: number[] };
      embeddings?: Array<{ values?: number[] }>;
    };

    const values = resAny.embedding?.values || resAny.embeddings?.[0]?.values;
    if (!values || values.length === 0) {
      throw new Error("No se obtuvieron valores de embedding");
    }
    return values;
  } catch (err) {
    console.error("Error al generar embedding:", err);
    throw err;
  }
}
